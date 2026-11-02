import type { Renderer, GeneratorState, ComputeBackend, GPUTarget, ParamSchema, RendererConfig } from '../core/interfaces.ts';
import { compileProgram } from '../core/gl-program.ts';
import type { WebGL2Backend } from '../core/compute-backend.ts';
import type { PaletteMapping } from './film-looks.ts';
import { TrajectoryPalette } from './trajectory-palette.ts';

// Quad-based thick-line renderer (works on Chrome/Windows where gl.lineWidth > 1 is unsupported).
// Each line segment is a pair of triangles oriented perpendicular to the segment direction.

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec3 aColor;
in float aAlpha;
in float aEdge;
uniform vec2 uResolution;
out vec3 vColor;
out float vAlpha;
out float vEdge;
void main() {
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vColor = aColor;
  vAlpha = aAlpha;
  vEdge = aEdge;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vEdge;
uniform float uGlow;
out vec4 fragColor;
void main() {
  float edge = 1.0 - smoothstep(0.2, 1.0, abs(vEdge));
    // HIGHER uGlow = MORE glow (softer edge), matching the particle shader.
  //
  // Was max(1.0, uGlow * 0.4) until 2026-08-06 — inverted, since edge is in [0,1] and a higher
  // exponent shrinks it. Dividing flips the sense. The 2.0 numerator is chosen so that at the
  // universal preset value glow: 2.0 the exponent is still exactly 1.0, i.e. **all 177 presets render
  // byte-identically**; only values away from 2.0 behave differently, and now in the same direction as
  // particle glow. The max(1.0, ...) clamp is retained from the original.
  float alpha = vAlpha * pow(edge, max(1.0, 2.0 / uGlow));
  if (alpha < 0.004) discard;
  fragColor = vec4(vColor * alpha, alpha);
}`;

const TRAIL_LENGTH = 8;
const VERTS_PER_SEGMENT = 4; // quad = 4 verts, 6 indices
const INDICES_PER_SEGMENT = 6;
const FLOATS_PER_VERTEX = 7; // 2 pos + 3 colour + 1 alpha + 1 edge — matches init()'s stride

/**
 * Floats per history sample: `[x, y, r, g, b, frozen]`, `frozen` stored as 1 or 0.
 *
 * ⚠️ **This replaced a `LinePoint[][]` — 20 000 arrays of 8 heap objects — on 2026-09-24, and the
 * reason it is flat is MEASURED, not stylistic.** `updateHistory` built one fresh object per particle
 * per frame, and `buildGeometry` then read four of them per segment through two pointer hops. Profiled
 * on `Chemical` (20 000 particles, ANGLE/D3D11, main-thread CPU-bound at 29.8 fps), `buildGeometry` was
 * **34 % of the entire frame** and the collector a further 6 %. The object churn did NOT show up in
 * `updateHistory`'s own self time (0.84 ms) — it showed up in the GC, which is invariant 8's rule
 * applied to a cost rather than to a jitter: **the allocation rate reaches the frame somewhere other
 * than the allocating function, so do not look for it under the allocator.**
 *
 * The `frozen` lane carries the rationale the old `LinePoint.frozen` field documented, and it is still
 * load-bearing: v8 Phase 8a-2. Neon draws trajectories, and a frozen particle has none — it is drawn by
 * the crystal pass instead. Segments touching a frozen sample are skipped entirely rather than merely
 * being dropped by the teleport test, because freezing snaps a particle's screen position by far more
 * than the teleport threshold. Without this the freeze/melt snaps poison the history and almost every
 * segment is discarded, making the neon lines disappear.
 */
const HISTORY_STRIDE = 6;

/**
 * How many slots neon should build trails for.
 *
 * v8 Phase 8a-3: `state.count` now includes the trailing crystal block, whose length changes every
 * frame as crystals nucleate and melt. `updateHistory` rebuilds the ENTIRE history whenever the
 * count changes, so walking all of `state.count` would rebuild every frame and no trail would ever
 * accumulate — every neon line would vanish the moment crystal was enabled. Crystals have no
 * trajectory to draw (they are drawn by the crystal pass alone), so the block is excluded here.
 *
 * There is deliberately NO upper clamp. A `MAX_PARTICLES = 8000` cap used to live here and was the
 * cause of neon showing only part of the figure: presets whose effective particle count exceeds
 * 8000 (the Sliders tab's Density multiplier scales a 4000-particle preset straight past it) had
 * every slot above the cap silently dropped, so a contiguous chunk of the figure had no lines.
 * Diagnostics on the reported case read `count=8000, drawn=56000/56000, skipTele=0` — nothing was
 * being skipped, the renderer was simply never told about the rest of the particles.
 *
 * `RibbonRenderer` has no equivalent cap, which is exactly why ribbons drew the complete figure
 * while neon did not — the asymmetry that identified this.
 *
 * v8 15.5 subtracts the LIQUID POOL block too: a pool particle is advected by a fluid field rather
 * than following a wave, so it has no trajectory this renderer can mean anything by. Both tail blocks
 * are excluded together, which leaves exactly `[wave][sparks]` — the blocks that DO move along a
 * curve. Subtracting both is only correct because the pool is INSERTED before the crystals
 * (`[wave][sparks][liquid][crystals]`), so the two lengths name two adjacent trailing blocks and their
 * sum is one contiguous tail; reordering them would make this arithmetic describe a range that skips
 * live particles.
 *
 * ⚠️ **Excluding it here does NOT leave it undrawn, and that is a property of the CALLER, not of this
 * file.** `main.ts`'s neon branch follows `neonLineRenderer.render()` with `drawSparkSubset()`, whose
 * range is `[waveCount, count - crystalCount)` — deliberately NOT narrowed by `liquidCount`, so it
 * covers the sparks and the pool together. Neon draws trail geometry and never a single particle, so
 * anything this function drops must be picked up there or it vanishes. **Check that pairing before
 * narrowing either bound.**
 *
 * ⚠️ `RibbonRenderer`'s equivalent line does NOT subtract the pool, and that difference is deliberate:
 * its `count` also bounds the hybrid POINT pass, which is the pool's only draw path in that one mode.
 * The two files spell the same expression and mean different things by it — see its own note.
 *
 * Cost is bounded by the caller's own particle count: geometry is 7 floats x 4 verts x 7 segments per
 * particle, i.e. ~784 KB per 4000 particles. ⚠️ It is no longer allocated per frame — both the history
 * and the geometry scratch became grow-only reused buffers on 2026-09-24, and the ONE remaining per-frame
 * upload is a ranged `bufferData` of the written prefix. This sentence said "allocated per frame as
 * before" until then; the figure it quotes is still the right size, but it is now a CAPACITY, not a
 * per-frame allocation rate, and the distinction is the whole of invariant 8.
 */
function trajectoryCount(state: GeneratorState): number {
  const n = state.count - (state.crystalCount ?? 0) - (state.liquidCount ?? 0);
  return n < 0 ? 0 : n;
}

export class NeonLineRenderer implements Renderer {
  readonly id = 'neon-line';

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uGlow: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private glow = 2.0;
  private lineWidth = 2.0;

  /**
   * Trail history, FLAT and grow-only. Sample `(slot i, ring k)` occupies `HISTORY_STRIDE` floats at
   * `(i * TRAIL_LENGTH + k) * HISTORY_STRIDE`, i.e. SLOT-MAJOR — see `ensureHistoryCapacity`.
   */
  private history = new Float32Array(0);
  /**
   * Slots currently SEEDED — the flat equivalent of the old `history.length`, and NOT the array's
   * capacity. Invariant 7's shape: `history` is grow-only scratch, so its length says nothing about how
   * much of it is meaningful. Every loop in this file bounds on this field or on `trajectoryCount()`,
   * never on `history.length`.
   */
  private historySlots = 0;
  private historyHead = 0;
  private initialized = false;

  /** Geometry scratch, grow-only, reused every frame. Written prefix length is `buildGeometry`'s return. */
  private vertexScratch = new Float32Array(0);
  /**
   * The index pattern, built ONCE per capacity change and never touched in the hot loop.
   *
   * ⚠️ **Why this can be constant at all.** `baseVert` advanced only on a segment that actually WROTE
   * vertices, so the j-th written segment always used `baseVert = 4j` — the index content was a pure
   * function of the written ordinal and therefore byte-identical every frame, yet it was rebuilt from
   * scratch 60 times a second. Measured at 20 000 particles, the index writes alone were **2.24 ms of
   * every frame**, all of it recomputing the same 840 000 integers. Only the COUNT varies per frame.
   */
  private indexPattern = new Uint32Array(0);
  /** Capacity of both geometry arrays, in SEGMENTS. */
  private geometryCapacity = 0;
  /** Set when the GL buffers must be reallocated and the index pattern re-uploaded. */
  private geometryDirty = true;

  /**
   * Film-look palette, resolved on the CPU as each history sample is captured.
   *
   * Without this the neon pass emitted `state.colors` unchanged, so a film look's palette was silently
   * dropped for the whole image — neon draws EVERY trajectory as a line, so unlike ribbon's `hybrid`
   * mode there is no palette-aware point pass left to mask it. See `TrajectoryPalette`.
   */
  private palette = new TrajectoryPalette();
  /** Reused by `updateHistory` so palette resolution allocates nothing per sample. */
  private paletteScratch = { r: 0, g: 0, b: 0 };

  init(backend: ComputeBackend, config: RendererConfig): void {
    const glBackend = backend as unknown as WebGL2Backend;
    this.gl = glBackend.gl;
    this.glow = config.glow;

    const gl = this.gl;
    this.program = compileProgram(gl, VERT_SRC, FRAG_SRC, 'NeonLine');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uGlow = gl.getUniformLocation(this.program, 'uGlow');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    const stride = FLOATS_PER_VERTEX * 4; // 2 pos + 3 color + 1 alpha + 1 edge, 4 bytes each
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);

    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 8);

    const aAlpha = gl.getAttribLocation(this.program, 'aAlpha');
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, stride, 20);

    const aEdge = gl.getAttribLocation(this.program, 'aEdge');
    gl.enableVertexAttribArray(aEdge);
    gl.vertexAttribPointer(aEdge, 1, gl.FLOAT, false, stride, 24);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    gl.bindVertexArray(null);
    this.initialized = false;
  }

  render(state: GeneratorState, _target: GPUTarget): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    this.updateHistory(state);
    const { vertexFloats, indexCount } = this.buildGeometry(trajectoryCount(state));
    if (indexCount === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uGlow, this.glow);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    if (this.geometryDirty) {
      // The ONLY index upload. `STATIC_DRAW` is honest here: the contents never change again until the
      // capacity does, which happens when a preset's particle count grows and at no other time.
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexPattern, gl.STATIC_DRAW);
      this.geometryDirty = false;
    }

    /*
     * ⚠️ **INVARIANT 6, at zero margin — read this before changing either counter.** The ranged
     * `bufferData` uploads and sizes the vertex buffer to EXACTLY the written prefix, so the buffer is
     * exactly long enough for the draw and never one byte shorter (ANGLE drops a whole draw whose vertex
     * buffer is short, silently and with a clean console). What makes that safe is not a margin but a
     * shared origin: `vertexFloats` and `indexCount` are both incremented by the SAME loop iteration in
     * `buildGeometry`, so `indexCount = 6w` and `vertexFloats = 28w` for one `w`, and the largest index
     * the draw can read is `4w - 1` against `4w` uploaded vertices. **Derive both from one counter or
     * give the buffer a real margin — do not pick a third arrangement.**
     *
     * It is the ranged form rather than `bufferSubData` into a capacity-sized buffer deliberately:
     * `bufferData` ORPHANS, which is what the previous full-array upload also did, so this cannot
     * introduce an implicit sync stall while it removes the transfer of the unwritten tail. At 20 000
     * particles the old pair of uploads was 19 MB/frame and 2.95 ms; the tail is unwritten whenever any
     * segment was skipped, i.e. on every frame of any preset with crystals, sparks or a teleport.
     */
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexScratch, gl.DYNAMIC_DRAW, 0, vertexFloats);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setGlow(glow: number): void {
    this.glow = glow;
  }

  setLineWidth(w: number): void {
    this.lineWidth = w;
  }

  setPalette(name: string): void {
    // Drop the history so the trail already in flight is recoloured too, not just samples captured
    // from now on — otherwise a palette change would crawl along each line over TRAIL_LENGTH frames.
    this.palette.setPalette(name);
    this.initialized = false;
  }

  /**
   * v8 `26.4` — forwards the palette hue rotation to the shared CPU LUT path.
   *
   * ⚠️ **This and the point shader must receive the SAME number, or `hybrid` mode shows a SEAM**
   * rather than a wrong colour: ribbons and points are drawn side by side from one figure.
   */
  setHueShift(turns: number): void {
    this.palette.setHueShift(turns);
  }

  setPaletteMapping(mapping: PaletteMapping): void {
    this.palette.setMapping(mapping);
    this.initialized = false;
  }

  isAdditiveBlend(): boolean {
    return true;
  }

  getSchema(): ParamSchema {
    return {
      params: [
        { key: 'lineWidth', type: 'number', label: 'Line Width', category: 'Rendering', min: 0.5, max: 10, step: 0.5, default: 2.0 },
      ],
    };
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    // Invariant 1: null every deleted handle. `render()`'s own `if (!gl || !this.program || !this.vao)`
    // guard is only a guard while these are null — left dangling it tests true over deleted objects.
    this.program = null;
    this.vao = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.history = new Float32Array(0);
    this.historySlots = 0;
    // Invariant 3, in its CPU form: the capacity counter is the flag over these two arrays, so it has to
    // die with them. Leaving it set would let `buildGeometry` skip the rebuild and write past a zero-length
    // scratch after a re-init — and a Float32Array store out of range is a silent no-op, not a throw.
    this.vertexScratch = new Float32Array(0);
    this.indexPattern = new Uint32Array(0);
    this.geometryCapacity = 0;
    this.geometryDirty = true;
    this.initialized = false;
  }

  /**
   * Grow the flat history, PRESERVING what is already in it.
   *
   * ⚠️ **The copy is load-bearing, not an optimisation.** The layout is slot-major with a fixed stride,
   * so copying the old prefix keeps every retained slot's ring intact AND keeps it aligned to the shared
   * `historyHead`. Dropping the copy would wipe every trail whenever the count grew, which is exactly the
   * defect the per-slot delta logic in `updateHistory` exists to prevent — and it would be invisible on a
   * preset with a fixed particle count, appearing only where a variable-length block (sparks) is live.
   *
   * Doubling rather than fitting for the same reason: the spark block's length changes EVERY frame, so
   * growing to exactly `slots` would reallocate and copy on most frames of any preset with sparks.
   */
  private ensureHistoryCapacity(slots: number): void {
    const needed = slots * TRAIL_LENGTH * HISTORY_STRIDE;
    if (this.history.length >= needed) return;
    const grown = new Float32Array(Math.max(needed, this.history.length * 2));
    grown.set(this.history);
    this.history = grown;
  }

  /** Grow the geometry scratch and rebuild the constant index pattern. See `indexPattern`. */
  private ensureGeometryCapacity(segments: number): void {
    if (segments <= this.geometryCapacity) return;
    const cap = Math.max(segments, this.geometryCapacity * 2);
    this.vertexScratch = new Float32Array(cap * VERTS_PER_SEGMENT * FLOATS_PER_VERTEX);
    this.indexPattern = new Uint32Array(cap * INDICES_PER_SEGMENT);
    for (let j = 0, k = 0, bv = 0; j < cap; j++, bv += VERTS_PER_SEGMENT) {
      this.indexPattern[k++] = bv;
      this.indexPattern[k++] = bv + 1;
      this.indexPattern[k++] = bv + 2;
      this.indexPattern[k++] = bv + 2;
      this.indexPattern[k++] = bv + 1;
      this.indexPattern[k++] = bv + 3;
    }
    this.geometryCapacity = cap;
    // No `vertexScratch` carry-over: unlike the history it holds nothing across frames, every frame
    // rewrites its whole used prefix, and nothing reads past that prefix.
    this.geometryDirty = true;
  }

  private updateHistory(state: GeneratorState): void {
    const count = trajectoryCount(state);
    // v8 Phase 8a-2: tag each sample with whether the particle was frozen at capture time.
    //
    // 8a-3: with crystal slots excluded above this tag can no longer be set by any slot in range —
    // wave particles and sparks are never crystals. It is kept because the skip it drives is the
    // last line of defence against a crystal slot reaching the neon geometry, and because a
    // hand-built sub-state (main.ts's ribbon-hybrid path) can still carry a frozen mask.
    const frozen = state.frozen;

    // PER-SLOT history, robust to a changing count (Open Point: sparks/neon thrash).
    //
    // This used to rebuild the ENTIRE history whenever count !== lastCount, which made trails
    // impossible whenever a variable-length tail block was active: the spark block sits INSIDE the
    // counted range at [particleCount, particleCount + sparkCount) and its length changes every
    // frame as sparks spawn and die, so the history was wiped before it could ever accumulate. The
    // crystal block was excluded outright to dodge this, but sparks cannot be — they are ordinary
    // additive particles that legitimately deserve trails.
    //
    // Now only the DELTA is touched: existing slots keep their history across a count change, new
    // slots are seeded, and surplus slots are dropped. A slot index is stable for wave particles (a
    // fixed count) and for crystals (a free-list pool), and while spark indices do shuffle as the pool
    // compacts, a spark's trail is short-lived and visually indistinguishable from its neighbour's —
    // far better than every trail in the scene vanishing.
    if (!this.initialized) {
      this.historySlots = 0;
      this.historyHead = 0;
      this.initialized = true;
    }
    this.ensureHistoryCapacity(count);

    const rgb = this.paletteScratch;
    const hist = this.history;
    /**
     * Capture one sample into `(slot i, ring k)`. Allocates NOTHING — this returned a fresh object per
     * call until 2026-09-24, i.e. one per particle per frame; see `HISTORY_STRIDE`.
     */
    const write = (i: number, k: number): void => {
      // Film-look palette applied at capture time, so it lands in the ring buffer and the whole trail
      // carries it. `depths`/`velocities` are per-particle scalars already normalised to [0,1] by the
      // generator, exactly as the point shader's `aDepth`/`aVelocity` attributes receive them.
      this.palette.resolve(
        rgb,
        state.colors[i * 3]!, state.colors[i * 3 + 1]!, state.colors[i * 3 + 2]!,
        state.depths[i] ?? 0.5, state.velocities[i] ?? 0,
      );
      const o = (i * TRAIL_LENGTH + k) * HISTORY_STRIDE;
      hist[o] = state.positions[i * 3]!;
      hist[o + 1] = state.positions[i * 3 + 1]!;
      hist[o + 2] = rgb.r;
      hist[o + 3] = rgb.g;
      hist[o + 4] = rgb.b;
      hist[o + 5] = frozen && frozen[i] === 1 ? 1 : 0;
    };

    // Grow: seed a new slot's whole ring with its current sample, so it starts as a zero-length trail
    // rather than a streak from wherever the previous occupant of this index was. The sample is resolved
    // ONCE and copied across the ring, as the old `{ ...p }` spread did — `palette.resolve` is not free.
    for (let i = this.historySlots; i < count; i++) {
      write(i, 0);
      const src = i * TRAIL_LENGTH * HISTORY_STRIDE;
      for (let t = 1; t < TRAIL_LENGTH; t++) {
        const dst = src + t * HISTORY_STRIDE;
        for (let c = 0; c < HISTORY_STRIDE; c++) hist[dst + c] = hist[src + c]!;
      }
    }
    // Shrink: drop surplus slots — a counter move, since the array is grow-only. Every retained slot's
    // ring stays put and stays aligned to the shared historyHead, which is the whole point of the
    // slot-major layout; a shrink followed by a re-grow re-seeds the slot's ENTIRE ring above, so no
    // stale tail can be read back (invariant 7).
    this.historySlots = count;

    for (let i = 0; i < count; i++) write(i, this.historyHead);
    this.historyHead = (this.historyHead + 1) % TRAIL_LENGTH;
  }

  /**
   * Squared per-frame step distance above which a segment is treated as a discontinuity.
   *
   * Two independent bounds, whichever is larger:
   *
   * 1. A fraction of the screen diagonal. A real teleport (reinit, wrap, projection flip) moves a
   *    particle a large fraction of the viewport; ordinary fast motion does not. This also makes the
   *    behaviour resolution-independent, where a fixed 30px was effectively far stricter at 1440p
   *    than at 720p.
   * 2. A multiple of THIS frame's median step, sampled from the live trail. Presets differ by more
   *    than an order of magnitude in speed, so the only robust reference is the population's own
   *    motion. Median (not mean) so a handful of genuine teleports cannot drag the threshold up and
   *    thereby admit themselves.
   */
  private computeTeleportSq(count: number): number {
    const diag = Math.hypot(this.width, this.height);
    const screenBound = (diag * 0.22) ** 2;

    if (count === 0 || this.historySlots === 0) return screenBound;

    // Sample up to 64 particles' most recent step — enough for a stable median at negligible cost.
    const stride = Math.max(1, Math.floor(count / 64));
    const prev = (this.historyHead + TRAIL_LENGTH - 1) % TRAIL_LENGTH;
    const cur = this.historyHead;
    const hist = this.history;
    const samples: number[] = [];
    for (let i = 0; i < count && i < this.historySlots; i += stride) {
      const a = (i * TRAIL_LENGTH + prev) * HISTORY_STRIDE;
      const b = (i * TRAIL_LENGTH + cur) * HISTORY_STRIDE;
      if (hist[a + 5] !== 0 || hist[b + 5] !== 0) continue;
      const dx = hist[b]! - hist[a]!;
      const dy = hist[b + 1]! - hist[a + 1]!;
      samples.push(dx * dx + dy * dy);
    }
    if (samples.length === 0) return screenBound;

    samples.sort((p, q) => p - q);
    const medianSq = samples[samples.length >> 1]!;
    // 6x the median step, in distance terms (hence 36x on the squared value).
    const motionBound = medianSq * 36;

    // Ceiling at half the diagonal. On a very fast preset the motion bound alone would grow past a
    // real teleport's length and start admitting the wrap-around segments this test exists to
    // reject — a bright line stitched straight across the figure. Half the screen is longer than any
    // legitimate single-frame step but shorter than a reinit jump.
    const ceiling = (diag * 0.5) ** 2;
    return Math.min(ceiling, Math.max(screenBound, motionBound));
  }

  private buildGeometry(particleCount: number): { vertexFloats: number; indexCount: number } {
    /*
     * No clamp on the PARTICLE count: see trajectoryCount. The caller already excluded the crystal block.
     *
     * ⚠️ The `historySlots` bound is a different thing and is NOT a cap on the figure. `render()` calls
     * `updateHistory(state)` immediately before this with the same state, and that sets `historySlots`
     * to this very `trajectoryCount(state)`, so the two are equal on every real call and the bound
     * narrows nothing. It is here because the flat history reads ZEROS rather than throwing if they ever
     * diverge, and a zero-filled sample passes both skip tests: it would draw a degenerate quad at the
     * origin with a live alpha, i.e. a bright dot in the corner, on every frame. That is the one
     * behavioural difference the flat layout introduces over `LinePoint[][]`, which crashed the frame
     * instead — louder, and per invariant 22 survivable, but not something to rely on.
     */
    const count = Math.min(particleCount, this.historySlots);
    const segmentsPerParticle = TRAIL_LENGTH - 1;
    const totalSegments = count * segmentsPerParticle;
    this.ensureGeometryCapacity(totalSegments);

    const verts = this.vertexScratch;
    const hist = this.history;
    let vIdx = 0;
    let iIdx = 0;
    const hw = this.lineWidth * 0.5;

    // Teleport rejection threshold, ADAPTIVE.
    //
    // This used to be the flat legacy constant 900 (30px). That silently broke fast presets: a
    // particle on a high-frequency wave legitimately moves 40-150px per frame, so its segments were
    // classified as teleports and DISCARDED, and the figure appeared only partly drawn. Miracle is
    // the reported case — its wave envelope gives ~38-150px/frame on the higher harmonics.
    //
    // The real thing being rejected is a genuine discontinuity: a reinit or a wrap, where a particle
    // jumps a large fraction of the screen. Scaling with screen size and taking the frame's own
    // median step as a reference separates "fast" from "discontinuous", which a fixed pixel count
    // cannot. Ribbon never hit this because it sets alpha=0 instead of dropping geometry, so a
    // false positive there is invisible — which is exactly why only neon showed the defect.
    const teleportSq = this.computeTeleportSq(count);

    for (let i = 0; i < count; i++) {
      const slot = i * TRAIL_LENGTH;

      for (let t = 0; t < TRAIL_LENGTH - 1; t++) {
        const a = (slot + ((this.historyHead + t) % TRAIL_LENGTH)) * HISTORY_STRIDE;
        const b = (slot + ((this.historyHead + t + 1) % TRAIL_LENGTH)) * HISTORY_STRIDE;

        // v8 Phase 8a-2: neon draws trajectories, and a frozen crystal has none — it is drawn by
        // the crystal pass instead. Skip any segment touching a frozen sample. This must be an
        // explicit test rather than relying on the teleport check below: freezing snaps a
        // particle's screen position by far more than 30px, so those samples would be silently
        // discarded anyway, but a STATIONARY frozen particle produces a zero-length "segment" that
        // passes the teleport test and would smear a bright dot over its own crystal.
        // NOTE: neither counter may advance here — a skipped segment writes NO vertices and consumes
        // NO indices. The old code carried a separate `baseVert` and the note here warned that
        // advancing it on a skip desynchronised it from vIdx, after which every subsequent segment's
        // indices pointed 4 vertices too far and the figure appeared partly missing. That variable is
        // gone with the constant index pattern, which removes the way to get it wrong: the written
        // ordinal is now `iIdx / 6` by construction and the pattern's `4j` can never disagree with it.
        if (hist[a + 5] !== 0 || hist[b + 5] !== 0) continue;

        const ax = hist[a]!, ay = hist[a + 1]!;
        const bx = hist[b]!, by = hist[b + 1]!;
        const dx = bx - ax;
        const dy = by - ay;
        const distSq = dx * dx + dy * dy;

        // Skip teleport jumps. Same rule as the frozen skip above: no vertices written, so no indices
        // consumed either.
        if (distSq > teleportSq) continue;

        const len = Math.sqrt(distSq);
        let nx = 0, ny = 1;
        if (len > 0.01) {
          nx = -dy / len;
          ny = dx / len;
        }

        const alpha = (t / (TRAIL_LENGTH - 1)) * 0.8;
        const r = hist[a + 2]!, g = hist[a + 3]!, b2 = hist[a + 4]!;
        const br = hist[b + 2]!, bg = hist[b + 3]!, bb = hist[b + 4]!;

        // 4 quad vertices
        // v0: pA left
        verts[vIdx++] = ax + nx * hw; verts[vIdx++] = ay + ny * hw;
        verts[vIdx++] = r; verts[vIdx++] = g; verts[vIdx++] = b2;
        verts[vIdx++] = alpha; verts[vIdx++] = -1.0;

        // v1: pA right
        verts[vIdx++] = ax - nx * hw; verts[vIdx++] = ay - ny * hw;
        verts[vIdx++] = r; verts[vIdx++] = g; verts[vIdx++] = b2;
        verts[vIdx++] = alpha; verts[vIdx++] = 1.0;

        // v2: pB left
        verts[vIdx++] = bx + nx * hw; verts[vIdx++] = by + ny * hw;
        verts[vIdx++] = br; verts[vIdx++] = bg; verts[vIdx++] = bb;
        verts[vIdx++] = alpha; verts[vIdx++] = -1.0;

        // v3: pB right
        verts[vIdx++] = bx - nx * hw; verts[vIdx++] = by - ny * hw;
        verts[vIdx++] = br; verts[vIdx++] = bg; verts[vIdx++] = bb;
        verts[vIdx++] = alpha; verts[vIdx++] = 1.0;

        // The indices themselves are pre-built and constant; only the COUNT is per-frame. See
        // `indexPattern`, and see `render()`'s invariant-6 note for why these two counters must stay
        // derived from this one loop iteration.
        iIdx += INDICES_PER_SEGMENT;
      }
    }

    return { vertexFloats: vIdx, indexCount: iIdx };
  }
}
