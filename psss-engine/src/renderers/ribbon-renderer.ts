import type { Renderer, GeneratorState, ComputeBackend, GPUTarget, ParamSchema, RendererConfig } from '../core/interfaces.ts';
import { compileProgram } from '../core/gl-program.ts';
import type { WebGL2Backend } from '../core/compute-backend.ts';
import type { PaletteMapping } from './film-looks.ts';
import { TrajectoryPalette } from './trajectory-palette.ts';

const VERT_SRC = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aNormal;
in vec3 aColor;
in float aAlpha;
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
  vEdge = aNormal.x;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vEdge;
uniform float uGlow;
out vec4 fragColor;
void main() {
  float dist = abs(vEdge);
  float edge = 1.0 - smoothstep(0.3, 1.0, dist);
    // HIGHER uGlow = MORE glow (softer edge), matching the particle shader.
  //
  // Was max(1.0, uGlow * 0.5) until 2026-08-06 — inverted, since edge is in [0,1] and a higher
  // exponent shrinks it. Dividing flips the sense. The 2.0 numerator is chosen so that at the
  // universal preset value glow: 2.0 the exponent is still exactly 1.0, i.e. **all 177 presets render
  // byte-identically**; only values away from 2.0 behave differently, and now in the same direction as
  // particle glow. The max(1.0, ...) clamp is retained from the original.
  float alpha = vAlpha * pow(edge, max(1.0, 2.0 / uGlow));
  if (alpha < 0.005) discard;
  fragColor = vec4(vColor * alpha, alpha);
}`;

export type RibbonMode = 'hybrid' | 'streaks' | 'adaptive';

interface RibbonPoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

const VERTEX_BUDGET = 200000;
const HYBRID_RIBBON_COUNT = 200;
const HYBRID_TRAIL_LENGTH = 64;
const STREAKS_TRAIL_LENGTH = 6;
const ADAPTIVE_MAX_TRAIL = 12;

export class RibbonRenderer implements Renderer {
  readonly id = 'ribbon';

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
  private ribbonWidth = 3.0;
  private attractorBlend = 0;

  private mode: RibbonMode = 'hybrid';

  /**
   * Film-look palette, resolved on the CPU as each history sample is captured.
   *
   * Without this the ribbon pass emitted `state.colors` unchanged, so a film look's palette was
   * silently dropped — invisible in `hybrid` (200 ribbons, everything else drawn by the palette-aware
   * point pass) but total in `streaks`/`adaptive`, where every wave particle is ribboned. See
   * `TrajectoryPalette`.
   */
  private palette = new TrajectoryPalette();
  /** Reused by `updateHistory` so palette resolution allocates nothing per sample. */
  private paletteScratch = { r: 0, g: 0, b: 0 };

  // History ring buffer
  private history: RibbonPoint[][] = [];
  private historyHead = 0;
  private historyLength = 0; // actual trail length in use
  private initialized = false;
  private lastParticleCount = 0;

  // Indices of particles that get ribbons (for hybrid mode)
  private ribbonIndices: number[] = [];
  // Indices of particles rendered as points (hybrid mode only)
  private pointIndices: number[] = [];
  /** Wave + sparks: everything drawable. See computeRibbonIndices. */
  private drawableCount = 0;

  init(backend: ComputeBackend, config: RendererConfig): void {
    const glBackend = backend as unknown as WebGL2Backend;
    this.gl = glBackend.gl;
    this.glow = config.glow;

    const gl = this.gl;
    this.program = compileProgram(gl, VERT_SRC, FRAG_SRC, 'Ribbon');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uGlow = gl.getUniformLocation(this.program, 'uGlow');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    const stride = 8 * 4; // 2 pos + 2 normal + 3 color + 1 alpha
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);

    const aNormal = gl.getAttribLocation(this.program, 'aNormal');
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 2, gl.FLOAT, false, stride, 8);

    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 16);

    const aAlpha = gl.getAttribLocation(this.program, 'aAlpha');
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, stride, 28);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    gl.bindVertexArray(null);
    this.initialized = false;
  }

  setMode(mode: RibbonMode): void {
    if (mode !== this.mode) {
      this.mode = mode;
      this.initialized = false;
    }
  }

  getMode(): RibbonMode {
    return this.mode;
  }

  render(state: GeneratorState, _target: GPUTarget): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    this.updateHistory(state);

    const { vertices, indices, indexCount } = this.buildRibbonGeometry();
    if (indexCount === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uGlow, this.glow);

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  getPointIndices(): number[] {
    return this.pointIndices;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setRibbonWidth(width: number): void {
    this.ribbonWidth = width;
  }

  setAttractorBlend(blend: number): void {
    this.attractorBlend = blend;
  }

  setGlow(glow: number): void {
    this.glow = glow;
  }

  setPalette(name: string): void {
    // Recolour the trail already in flight, not just samples captured from now on. The ring buffer
    // holds up to HYBRID_TRAIL_LENGTH (64) frames, so without this a palette change would crawl along
    // each ribbon over ~1s instead of applying at once.
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
        { key: 'ribbonWidth', type: 'number', label: 'Ribbon Width', category: 'Rendering', min: 0.5, max: 20, step: 0.5, default: 3.0 },
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
    this.history = [];
    this.initialized = false;
  }

  private computeTrailLength(particleCount: number): number {
    if (this.mode === 'hybrid') {
      return HYBRID_TRAIL_LENGTH;
    }
    if (this.mode === 'streaks') {
      return STREAKS_TRAIL_LENGTH;
    }
    // Adaptive: budget / (particleCount * 2 verts per trail point), capped short
    const trail = Math.floor(VERTEX_BUDGET / (particleCount * 2));
    return Math.max(4, Math.min(ADAPTIVE_MAX_TRAIL, trail));
  }

  private computeRibbonIndices(particleCount: number): void {
    // TWO DIFFERENT BOUNDS, deliberately.
    //
    // selectionCount is the stable wave block: it decides which particles get a ribbon, and must not
    // move when a tail block changes length, or the selection churns and ribbons flicker between
    // particles. drawCount is everything drawable (wave + sparks) and decides what the hybrid POINT
    // pass covers — sparks have no useful trajectory but they must still be DRAWN, so they belong in
    // pointIndices even though they are excluded from the ribbon selection. Using one bound for both
    // is what made sparks invisible in hybrid mode when the selection was first narrowed.
    const selectionCount = particleCount;
    const drawCount = Math.max(particleCount, this.drawableCount);

    if (this.mode === 'hybrid') {
      const ribbonCount = Math.min(selectionCount, HYBRID_RIBBON_COUNT);
      const step = Math.max(1, Math.floor(selectionCount / Math.max(1, ribbonCount)));
      this.ribbonIndices = [];
      const ribbonSet = new Set<number>();
      for (let i = 0; i < selectionCount; i += step) {
        this.ribbonIndices.push(i);
        ribbonSet.add(i);
      }
      this.pointIndices = [];
      for (let i = 0; i < drawCount; i++) {
        if (!ribbonSet.has(i)) this.pointIndices.push(i);
      }
    } else {
      // Streaks and Adaptive: every wave particle gets a ribbon. Sparks are not ribboned (no useful
      // trajectory) but still need drawing, so they go to the point pass.
      this.ribbonIndices = [];
      for (let i = 0; i < selectionCount; i++) {
        this.ribbonIndices.push(i);
      }
      this.pointIndices = [];
      for (let i = selectionCount; i < drawCount; i++) {
        this.pointIndices.push(i);
      }
    }
  }

  private updateHistory(state: GeneratorState): void {
    // v8 Phase 8a-3: exclude the trailing crystal block. state.count now includes it and its
    // length changes every frame, which would rebuild the whole history (and destroy every ribbon)
    // on every frame. Crystals have no trajectory to draw — the crystal pass owns them. This also
    // keeps getPointIndices() free of crystal slots, so the hybrid point pass cannot redraw a
    // glowing dot inside an already-drawn crystal.
    //
    // ⚠️ **v8 15.5 — THE LIQUID POOL IS *NOT* SUBTRACTED HERE, AND `NeonLineRenderer` SUBTRACTS IT.
    // THAT ASYMMETRY IS CORRECT AND IT IS THE TRAP: THE TWO FILES SPELL THE SAME EXPRESSION AND MEAN
    // DIFFERENT THINGS BY IT.** Neon's `trajectoryCount()` is a pure history bound. This `count` is
    // TWO quantities at once, and only one of them is about trajectories:
    //
    // - it clamps `selectionBase`, which decides which slots get a RIBBON — and the pool is excluded
    //   from that already, because `selectionBase` is `min(count, waveCount)` and the pool sits above
    //   the wave block. So a pool particle never gets a ribbon regardless of what this line says;
    // - it is assigned to `this.drawableCount`, which `computeRibbonIndices()` uses as `drawCount` —
    //   the bound of the HYBRID POINT PASS, i.e. "every drawable slot that did not get a ribbon".
    //
    // Subtracting the pool would satisfy the first (redundantly) and break the second: `main.ts` draws
    // `getPointIndices()` in hybrid mode INSTEAD OF `drawSparkSubset()`, so a pool excluded here has no
    // draw path at all in that one mode — it simulates, it is published, and it is invisible. That is
    // invariant 13 reached through a bound that looks like the neon one, on the single ribbon mode of
    // three, and only when a pool is running. Crystals are excluded precisely BECAUSE they must not
    // reach the point pass (the crystal pass already drew them); pool particles must.
    //
    // The `count !== this.drawableCount` rebuild below is also NOT the thrash hazard it is in neon: it
    // rebuilds the two INDEX LISTS only. `this.history` is reset in the next block, which keys on
    // `selectionBase` — so a `Pool Size` drag re-partitions the point pass without touching a ribbon.
    const count = Math.max(0, state.count - (state.crystalCount ?? 0));

    // Derive the ribbon SELECTION from the stable wave block, not from the live count.
    //
    // computeRibbonIndices picks every Nth particle with N = floor(count / ribbonCount). The spark
    // block sits inside count and its length changes every frame, so a count-derived stride made the
    // stride — and therefore the identity of every ribboned particle — churn frame to frame. Combined
    // with the wholesale rebuild below, ribbons could never accumulate whenever sparks were active.
    // The wave block has a fixed length for a given preset, so a stride derived from it is stable.
    const selectionBase = Math.max(0, Math.min(count, state.waveCount ?? count));
    const trailLength = this.computeTrailLength(selectionBase);

    // Rebuild the SELECTION only when its inputs actually change — no longer on every count change.
    // The point pass must follow the tail length even when the SELECTION is unchanged, or newly
    // spawned sparks go undrawn until the next selection rebuild.
    if (count !== this.drawableCount) {
      this.drawableCount = count;
      if (this.initialized) this.computeRibbonIndices(this.lastParticleCount);
    }

    if (!this.initialized || selectionBase !== this.lastParticleCount || trailLength !== this.historyLength) {
      this.historyLength = trailLength;
      this.lastParticleCount = selectionBase;
      this.computeRibbonIndices(selectionBase);
      this.history = [];
      this.historyHead = 0;
      this.initialized = true;
    }

    // Palette-resolved colour for slot `pi`. Reuses one scratch object across the whole frame — this
    // runs once per ribbon plus once per seeded sample, so allocating per call would churn hard on a
    // 20 000-particle preset in streaks mode.
    const rgb = this.paletteScratch;
    const sampleColour = (pi: number): void => {
      this.palette.resolve(
        rgb,
        state.colors[pi * 3]!, state.colors[pi * 3 + 1]!, state.colors[pi * 3 + 2]!,
        state.depths[pi] ?? 0.5, state.velocities[pi] ?? 0,
      );
    };

    // Seed any newly added ribbon slot with its current sample repeated, so it begins as a
    // zero-length trail instead of streaking from the previous occupant's position.
    for (let ri = this.history.length; ri < this.ribbonIndices.length; ri++) {
      const pi = this.ribbonIndices[ri]!;
      sampleColour(pi);
      const trail: RibbonPoint[] = [];
      for (let t = 0; t < this.historyLength; t++) {
        trail.push({
          x: state.positions[pi * 3]!,
          y: state.positions[pi * 3 + 1]!,
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
        });
      }
      this.history.push(trail);
    }
    if (this.history.length > this.ribbonIndices.length) {
      this.history.length = this.ribbonIndices.length;
    }

    // Write current positions for ribbon particles
    for (let ri = 0; ri < this.ribbonIndices.length; ri++) {
      const pi = this.ribbonIndices[ri]!;
      const trail = this.history[ri]!;
      sampleColour(pi);
      trail[this.historyHead] = {
        x: state.positions[pi * 3]!,
        y: state.positions[pi * 3 + 1]!,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
      };
    }
    this.historyHead = (this.historyHead + 1) % this.historyLength;
  }

  /**
   * Squared per-frame step distance above which a segment is treated as a discontinuity (D7).
   *
   * Two independent bounds, whichever is larger — the same shape as `NeonLineRenderer.computeTeleportSq`:
   *
   * 1. A fraction of the screen diagonal, so the rule is resolution-independent.
   * 2. A multiple of THIS frame's median step, sampled from the live trail, because presets differ by more
   *    than an order of magnitude in speed and the only robust reference is the population's own motion.
   *    Median rather than mean, so a handful of genuine teleports cannot drag the threshold up and admit
   *    themselves.
   *
   * Ceilinged at half the diagonal: on a very fast preset the motion bound alone would grow past a real
   * teleport's length and start admitting the wrap-around segments this test exists to reject.
   */
  private computeTeleportSq(): number {
    const diag = Math.hypot(this.width, this.height);
    const screenBound = (diag * 0.22) ** 2;

    const trailLen = this.historyLength;
    if (trailLen < 2 || this.history.length === 0) return screenBound;

    // Sample up to 64 ribbons' most recent step — enough for a stable median at negligible cost.
    const stride = Math.max(1, Math.floor(this.history.length / 64));
    const cur = this.historyHead;
    const prev = (this.historyHead + trailLen - 1) % trailLen;
    const samples: number[] = [];
    for (let i = 0; i < this.history.length; i += stride) {
      const trail = this.history[i];
      if (!trail) continue;
      const a = trail[prev];
      const b = trail[cur];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      samples.push(dx * dx + dy * dy);
    }
    if (samples.length === 0) return screenBound;

    samples.sort((p, q) => p - q);
    const medianSq = samples[samples.length >> 1]!;
    const motionBound = medianSq * 36;          // 6x the median step, squared

    const ceiling = (diag * 0.5) ** 2;
    return Math.min(ceiling, Math.max(screenBound, motionBound));
  }

  private buildRibbonGeometry(): { vertices: Float32Array; indices: Uint32Array; indexCount: number } {
    const ribbonCount = this.ribbonIndices.length;
    const trailLen = this.historyLength;

    const vertsPerRibbon = trailLen * 2;
    const indicesPerRibbon = (trailLen - 1) * 6;

    const vertices = new Float32Array(ribbonCount * vertsPerRibbon * 8);
    const indices = new Uint32Array(ribbonCount * indicesPerRibbon);
    let vertIdx = 0;
    let idxIdx = 0;
    let baseVertex = 0;

    // Teleport threshold, ADAPTIVE — matching what neon adopted in 028/W008 (D7).
    //
    // This was the flat legacy constant 900 (30 px). Two problems with a fixed pixel count:
    //
    // 1. **It is resolution-dependent.** 30 px is a much stricter bound at 1440p than at 720p, so the same
    //    preset classifies different segments as teleports depending on window size.
    // 2. **Fast presets are not teleporting.** A particle on a high-frequency wave legitimately moves
    //    40-150 px per frame. `Miracle` reaches ~38-150 px/frame on its higher harmonics.
    //
    // The thing actually being rejected is a DISCONTINUITY — a reinit or wrap, where a particle jumps a large
    // fraction of the screen. So the bound scales with the screen and with the population's own motion, the
    // same two-part rule neon uses.
    //
    // ⚠️ Note this operates on a DIFFERENT QUANTITY than neon's: ribbon measures the jump to the NEXT trail
    // sample (`next.x - pt.x`) to decide taper, whereas neon measures the step BETWEEN consecutive samples of
    // one segment. The threshold form is shared; the measured distance is not, which is why 028's fix could
    // not simply be copied across.
    //
    // Ribbon sets `alpha = 0` on a false positive rather than dropping geometry, so a mis-classification here
    // is invisible — which is exactly why this went unnoticed while the same bug was glaring in neon.
    const TELEPORT_THRESH_SQ = this.computeTeleportSq();

    for (let ri = 0; ri < ribbonCount; ri++) {
      const trail = this.history[ri]!;

      for (let t = 0; t < trailLen; t++) {
        const ringIdx = (this.historyHead + t) % trailLen;
        const pt = trail[ringIdx]!;

        // Tangent from neighbors
        const nextRingIdx = (this.historyHead + t + 1) % trailLen;
        const prevRingIdx = (this.historyHead + t - 1 + trailLen) % trailLen;
        const next = trail[t < trailLen - 1 ? nextRingIdx : ringIdx]!;
        const prev = trail[t > 0 ? prevRingIdx : ringIdx]!;

        // Teleport detection: clamp to zero if jump is too large
        const jumpDx = next.x - pt.x;
        const jumpDy = next.y - pt.y;
        const isTeleport = (jumpDx * jumpDx + jumpDy * jumpDy) > TELEPORT_THRESH_SQ;

        let dx = next.x - prev.x;
        let dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.01) {
          dx /= len;
          dy /= len;
        } else {
          dx = 0;
          dy = 1;
        }

        const nx = -dy;
        const ny = dx;

        let alpha = t / (trailLen - 1); // 0=oldest, 1=newest
        if (isTeleport) alpha = 0;
        // Attractor-aware alpha: reduce opacity to prevent white-out from additive stacking
        alpha *= (1 - this.attractorBlend * 0.6);
        // Density-adaptive width: thinner ribbons with more particles.
        //
        // Guarded because `lastParticleCount` is the ribbon SELECTION size, derived from `state.waveCount`,
        // and a zero-particle frame makes this `sqrt(Infinity)` -> `Infinity`. That propagates into every
        // vertex position below, and a single NaN/Infinity vertex takes out the whole triangle strip rather
        // than one ribbon (D6). Reachable transiently: the selection is rebuilt on preset change, and a
        // preset can legitimately declare very few particles.
        const densityScale = Math.sqrt(1000 / Math.max(1, this.lastParticleCount));
        const modeScale = this.mode === 'streaks' ? 0.2 : 1.0;
        const effectiveWidth = this.ribbonWidth * modeScale * densityScale;
        const width = effectiveWidth * (t / (trailLen - 1));

        // Left vertex
        vertices[vertIdx++] = pt.x + nx * width;
        vertices[vertIdx++] = pt.y + ny * width;
        vertices[vertIdx++] = -1.0;
        vertices[vertIdx++] = 0.0;
        vertices[vertIdx++] = pt.r;
        vertices[vertIdx++] = pt.g;
        vertices[vertIdx++] = pt.b;
        vertices[vertIdx++] = alpha;

        // Right vertex
        vertices[vertIdx++] = pt.x - nx * width;
        vertices[vertIdx++] = pt.y - ny * width;
        vertices[vertIdx++] = 1.0;
        vertices[vertIdx++] = 0.0;
        vertices[vertIdx++] = pt.r;
        vertices[vertIdx++] = pt.g;
        vertices[vertIdx++] = pt.b;
        vertices[vertIdx++] = alpha;
      }

      for (let t = 0; t < trailLen - 1; t++) {
        const i0 = baseVertex + t * 2;
        const i1 = baseVertex + t * 2 + 1;
        const i2 = baseVertex + (t + 1) * 2;
        const i3 = baseVertex + (t + 1) * 2 + 1;

        indices[idxIdx++] = i0;
        indices[idxIdx++] = i1;
        indices[idxIdx++] = i2;
        indices[idxIdx++] = i2;
        indices[idxIdx++] = i1;
        indices[idxIdx++] = i3;
      }

      baseVertex += vertsPerRibbon;
    }

    return { vertices, indices, indexCount: idxIdx };
  }
}
