import type { Renderer, GeneratorState, ComputeBackend, GPUTarget,  RendererConfig } from '../core/interfaces.ts';
import { compileProgram } from '../core/gl-program.ts';
import type { WebGL2Backend } from '../core/compute-backend.ts';
import type { PaletteMapping } from './film-looks.ts';
import { TrajectoryPalette } from './trajectory-palette.ts';

/*
 * Quad-based thick-line renderer (works on Chrome/Windows where gl.lineWidth > 1 is unsupported). Each trail
 * segment is a quad oriented perpendicular to the segment direction.
 *
 * ⚠️⚠️ **THE QUADS ARE BUILT ON THE GPU, FROM A TRAIL HISTORY THAT LIVES IN A TEXTURE (2026-11-05).** Until then
 * the CPU expanded every particle's whole 8-sample history into 7 quads × 4 vertices × 7 floats = 196 floats per
 * particle and uploaded all of it EVERY FRAME — ~33 MB/frame at 42 000 particles, which dropped 130-141 frames
 * in 8 s on an AMD 8060S against 19-22 with lines off on the same preset (`p53-browser-frames.mjs`). The history
 * changes by ONE sample per particle per frame, so now only that sample is uploaded — 8 floats per particle, one
 * contiguous texture block — and the vertex shader reads the two ends of its segment with `texelFetch` and builds
 * the quad itself. **Every rule the CPU path applied is applied in the shader, unchanged**: the frozen skip, the
 * adaptive teleport skip (its threshold is still computed on the CPU from the same history and passed in), the
 * perpendicular, the alpha ramp, the per-end colour, the edge coordinate. The fragment shader is untouched.
 * The CPU version is kept in a private probe directory (not published) for the pixel comparison that licensed the change.
 */

const VERT_SRC = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uHist;
uniform vec2 uResolution;
uniform int uHead;
uniform int uPlaneRows;
uniform float uHalfWidth;
uniform float uTeleportSq;
out vec3 vColor;
out float vAlpha;
out float vEdge;
const int TRAIL = 8;
const int TEX_W = 2048;
// One history sample is two texels: (x, y, r, g) and (b, frozen, 0, 0).
void fetchSample(int i, int k, out vec4 t0, out vec4 t1) {
  int t = 2 * i;
  int row = k * uPlaneRows + t / TEX_W;
  int col = t - (t / TEX_W) * TEX_W;
  t0 = texelFetch(uHist, ivec2(col, row), 0);
  t1 = texelFetch(uHist, ivec2(col + 1, row), 0);
}
void main() {
  int seg = gl_InstanceID % (TRAIL - 1);
  int i = gl_InstanceID / (TRAIL - 1);
  int ka = (uHead + seg) % TRAIL;
  int kb = (uHead + seg + 1) % TRAIL;
  vec4 a0; vec4 a1; vec4 b0; vec4 b1;
  fetchSample(i, ka, a0, a1);
  fetchSample(i, kb, b0, b1);
  vec2 d = b0.xy - a0.xy;
  float distSq = dot(d, d);
  // The two skips of the CPU path: a segment touching a FROZEN sample, and a TELEPORT jump. A skipped
  // segment is moved wholly outside clip space, so it rasterises nothing.
  if (a1.y != 0.0 || b1.y != 0.0 || distSq > uTeleportSq) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec3(0.0);
    vAlpha = 0.0;
    vEdge = 0.0;
    return;
  }
  float len = sqrt(distSq);
  vec2 n = vec2(0.0, 1.0);
  if (len > 0.01) n = vec2(-d.y, d.x) / len;
  // Strip order: 0 = A left, 1 = A right, 2 = B left, 3 = B right. Left is +n with edge -1.
  bool atB = gl_VertexID >= 2;
  bool left = gl_VertexID == 0 || gl_VertexID == 2;
  vec2 p = (atB ? b0.xy : a0.xy) + n * (left ? uHalfWidth : -uHalfWidth);
  vColor = atB ? vec3(b0.z, b0.w, b1.x) : vec3(a0.z, a0.w, a1.x);
  vAlpha = (float(seg) / float(TRAIL - 1)) * 0.8;
  vEdge = left ? -1.0 : 1.0;
  vec2 ndc = (p / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
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
/** Segments per particle: a trail of `TRAIL_LENGTH` samples has one fewer segment. */
const SEGMENTS_PER_PARTICLE = TRAIL_LENGTH - 1;
/**
 * The history texture's width in texels. ⚠️ **Must equal the shader's `TEX_W`** and stay within WebGL2's
 * guaranteed `MAX_TEXTURE_SIZE` floor of 2048; even, so a sample's two texels never straddle a row.
 */
const TEX_W = 2048;
/** Floats per history sample in the CPU mirror: two RGBA texels, `[x, y, r, g]` + `[b, frozen, 0, 0]`. */
const SAMPLE_FLOATS = 8;
/** The texture unit the history is bound to — a high one, so no other pass's unit-0 assumption is touched. */
const HIST_UNIT = 7;

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
 * covers the sparks and the pool together. **Check that pairing before narrowing either bound.**
 *
 * ⚠️ `RibbonRenderer`'s equivalent line does NOT subtract the pool, and that difference is deliberate:
 * its `count` also bounds the hybrid POINT pass, which is the pool's only draw path in that one mode.
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
  private histTexture: WebGLTexture | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uGlow: WebGLUniformLocation | null = null;
  private uHist: WebGLUniformLocation | null = null;
  private uHead: WebGLUniformLocation | null = null;
  private uPlaneRows: WebGLUniformLocation | null = null;
  private uHalfWidth: WebGLUniformLocation | null = null;
  private uTeleportSq: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private glow = 2.0;
  private lineWidth = 2.0;

  /**
   * The trail history's CPU MIRROR, PLANE-MAJOR: ring sample `k` of every slot is one contiguous plane of
   * `planeRows × TEX_W` texels, slot `i` at texels `2i, 2i+1` within it. ⚠️ **Plane-major is what makes the
   * per-frame upload ONE contiguous block** — the newest sample of every particle is plane `historyHead`.
   */
  private history = new Float32Array(0);
  /** Slot capacity of `history` and of the texture; grow-only (doubling). */
  private capacitySlots = 0;
  /** Rows per ring plane: `ceil(2 * capacitySlots / TEX_W)`. */
  private planeRows = 0;
  /**
   * Slots currently SEEDED — NOT the capacity. Invariant 7's shape: every loop in this file bounds on this field
   * or on `trajectoryCount()`, never on the array's length.
   */
  private historySlots = 0;
  private historyHead = 0;
  private initialized = false;
  /** Set when the whole texture must be (re)uploaded: a reallocation, a re-seed, or newly seeded slots. */
  private fullUpload = true;

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
  /** Reused by `computeTeleportSq` (invariant 8: it runs every frame). */
  private teleportSamples: number[] = [];

  init(backend: ComputeBackend, config: RendererConfig): void {
    const glBackend = backend as unknown as WebGL2Backend;
    this.gl = glBackend.gl;
    this.glow = config.glow;

    const gl = this.gl;
    this.program = compileProgram(gl, VERT_SRC, FRAG_SRC, 'NeonLine');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uGlow = gl.getUniformLocation(this.program, 'uGlow');
    this.uHist = gl.getUniformLocation(this.program, 'uHist');
    this.uHead = gl.getUniformLocation(this.program, 'uHead');
    this.uPlaneRows = gl.getUniformLocation(this.program, 'uPlaneRows');
    this.uHalfWidth = gl.getUniformLocation(this.program, 'uHalfWidth');
    this.uTeleportSq = gl.getUniformLocation(this.program, 'uTeleportSq');

    // No vertex attributes: every vertex is derived from gl_InstanceID / gl_VertexID and the history texture.
    this.vao = gl.createVertexArray();
    this.histTexture = gl.createTexture();
    this.capacitySlots = 0;
    this.planeRows = 0;
    this.initialized = false;
    this.fullUpload = true;
  }

  render(state: GeneratorState, _target: GPUTarget): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao || !this.histTexture) return;

    this.updateHistory(state);
    const count = Math.min(trajectoryCount(state), this.historySlots);
    if (count === 0) return;
    const teleportSq = this.computeTeleportSq(count);

    gl.useProgram(this.program);
    // Invariant 4: the sampler's unit is assigned EVERY time and a texture is always bound to it.
    gl.activeTexture(gl.TEXTURE0 + HIST_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.histTexture);
    this.uploadHistory(count);
    gl.uniform1i(this.uHist, HIST_UNIT);
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uGlow, this.glow);
    // `uHead` is the head AFTER `updateHistory` advanced it — the same value `buildGeometry` read, so ring
    // offset `t` from it walks oldest (t = 0) to newest exactly as the CPU loop did.
    gl.uniform1i(this.uHead, this.historyHead);
    gl.uniform1i(this.uPlaneRows, this.planeRows);
    gl.uniform1f(this.uHalfWidth, this.lineWidth * 0.5);
    gl.uniform1f(this.uTeleportSq, teleportSq);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count * SEGMENTS_PER_PARTICLE);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
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

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.histTexture) gl.deleteTexture(this.histTexture);
    // Invariant 1: null every deleted handle. `render()`'s guard is only a guard while these are null.
    this.program = null;
    this.vao = null;
    this.histTexture = null;
    // Invariant 3, CPU form: the capacity is the flag over the mirror and the texture, so it dies with them —
    // a live capacity over a fresh texture would skip the allocation and upload into nothing.
    this.history = new Float32Array(0);
    this.capacitySlots = 0;
    this.planeRows = 0;
    this.historySlots = 0;
    this.initialized = false;
    this.fullUpload = true;
  }

  /** Float offset of sample `(slot i, ring k)` in the plane-major mirror. */
  private sampleOffset(i: number, k: number): number {
    return (k * this.planeRows * TEX_W + 2 * i) * 4;
  }

  /**
   * Grow the mirror (and mark the texture for reallocation), PRESERVING every retained slot's ring.
   *
   * ⚠️ **The copy is load-bearing, not an optimisation.** Dropping it would wipe every trail whenever the count
   * grew — invisible on a fixed-count preset, appearing only where a variable-length block (sparks) is live.
   * Each plane's slots are one contiguous span, so the copy is one `set` per ring plane. Doubling for the same
   * reason as before: the spark block's length changes EVERY frame.
   */
  private ensureHistoryCapacity(slots: number): void {
    if (slots <= this.capacitySlots) return;
    const cap = Math.max(slots, this.capacitySlots * 2, 1024);
    const rows = Math.ceil((2 * cap) / TEX_W);
    const grown = new Float32Array(TRAIL_LENGTH * rows * TEX_W * 4);
    const keep = this.historySlots * 2 * 4;
    for (let k = 0; k < TRAIL_LENGTH && keep > 0; k++) {
      const from = k * this.planeRows * TEX_W * 4;
      grown.set(this.history.subarray(from, from + keep), k * rows * TEX_W * 4);
    }
    this.history = grown;
    this.capacitySlots = cap;
    this.planeRows = rows;
    this.fullUpload = true;
  }

  /**
   * Upload the history: the WHOLE texture after a reallocation or a re-seed, otherwise only the newest plane's
   * written rows — one contiguous block, ~8 floats per particle.
   */
  private uploadHistory(count: number): void {
    const gl = this.gl!;
    const H = TRAIL_LENGTH * this.planeRows;
    if (this.fullUpload) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEX_W, H, 0, gl.RGBA, gl.FLOAT, this.history);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fullUpload = false;
      return;
    }
    // The plane written THIS frame is the one before the (already advanced) head.
    const plane = (this.historyHead + TRAIL_LENGTH - 1) % TRAIL_LENGTH;
    const rowsUsed = Math.min(this.planeRows, Math.ceil((2 * count) / TEX_W));
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, plane * this.planeRows, TEX_W, rowsUsed, gl.RGBA, gl.FLOAT,
      this.history, plane * this.planeRows * TEX_W * 4);
  }

  private updateHistory(state: GeneratorState): void {
    const count = trajectoryCount(state);
    // v8 Phase 8a-2: tag each sample with whether the particle was frozen at capture time. 8a-3: no slot in
    // range can be a crystal any more; the tag is kept as the last line of defence, and because a hand-built
    // sub-state (main.ts's ribbon-hybrid path) can still carry a frozen mask.
    const frozen = state.frozen;

    // PER-SLOT history, robust to a changing count: only the DELTA is touched — existing slots keep their
    // history across a count change, new slots are seeded, and surplus slots are dropped. (Rebuilding the whole
    // history on every count change made trails impossible while a variable-length spark block was live.)
    if (!this.initialized) {
      this.historySlots = 0;
      this.historyHead = 0;
      this.initialized = true;
      this.fullUpload = true;
    }
    this.ensureHistoryCapacity(count);

    const rgb = this.paletteScratch;
    const hist = this.history;
    /** Capture one sample into `(slot i, ring k)`. Allocates nothing. */
    const write = (i: number, k: number): void => {
      // Film-look palette applied at capture time, so it lands in the ring and the whole trail carries it.
      this.palette.resolve(
        rgb,
        state.colors[i * 3]!, state.colors[i * 3 + 1]!, state.colors[i * 3 + 2]!,
        state.depths[i] ?? 0.5, state.velocities[i] ?? 0,
      );
      const o = this.sampleOffset(i, k);
      hist[o] = state.positions[i * 3]!;
      hist[o + 1] = state.positions[i * 3 + 1]!;
      hist[o + 2] = rgb.r;
      hist[o + 3] = rgb.g;
      hist[o + 4] = rgb.b;
      hist[o + 5] = frozen && frozen[i] === 1 ? 1 : 0;
    };

    // Grow: seed a new slot's whole ring with its current sample, so it starts as a zero-length trail rather
    // than a streak from wherever the previous occupant of this index was. Resolved ONCE, copied across.
    if (count > this.historySlots) this.fullUpload = true;
    for (let i = this.historySlots; i < count; i++) {
      write(i, 0);
      const src = this.sampleOffset(i, 0);
      for (let t = 1; t < TRAIL_LENGTH; t++) {
        const dst = this.sampleOffset(i, t);
        for (let c = 0; c < SAMPLE_FLOATS; c++) hist[dst + c] = hist[src + c]!;
      }
    }
    // Shrink: a counter move; a later re-grow re-seeds the slot's ENTIRE ring above (invariant 7).
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
   *
   * ⚠️ The threshold this replaced was the flat legacy constant 900 (30px), which silently broke fast presets:
   * a particle on a high-frequency wave legitimately moves 40-150px per frame, so its segments were discarded
   * and the figure appeared only partly drawn (`Miracle` was the reported case).
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
    const samples = this.teleportSamples;
    samples.length = 0;
    for (let i = 0; i < count && i < this.historySlots; i += stride) {
      const a = this.sampleOffset(i, prev);
      const b = this.sampleOffset(i, cur);
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
}
