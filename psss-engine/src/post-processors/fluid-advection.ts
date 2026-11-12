import type { FluidAdvectionConfig } from '../presets/types.ts';
import { compileProgram } from '../core/gl-program.ts';

const FLUID_SIZE = 512;

/**
 * Every possible 16-bit half-float, pre-decoded — the whole domain of a `uint16` is only 65 536 values,
 * so `sampleVel` indexes instead of computing (triage H8).
 *
 * ⚠️ **This replaced a per-call `halfToFloat()`, which was the single most-called function in the CPU
 * fluid path.** `advectParticles` calls `sampleVel` twice per particle and each call bilinearly taps
 * four texels, so the decode ran **8× per particle per frame**: 32 000 calls at 4 000 particles and
 * **160 000 at 20 000**. Measured over a realistic velocity field:
 *
 *   4 000 particles   1.32 ms → 0.25 ms   (5.3×)
 *   20 000 particles  6.98 ms → 1.40 ms   (5.0×)
 *
 * At 20 000 particles that is **7 ms of a 16.7 ms frame** spent decoding, so this one is not a
 * micro-optimisation — it is most of a dropped frame whenever Fluid Advection Blend is above 0.
 *
 * **`Float64Array`, deliberately, not `Float32Array`.** They benchmark identically (1.399 vs 1.407 ms —
 * the cost is the memory access, not the width), but `Float32Array` is *not* bit-exact: rounding the
 * table to f32 changes **2 046 codes**, all of them subnormals, by up to 1.8e-12. Nothing here would
 * notice — the largest subnormal half is 6.1e-5 against typical velocities near 4e-2 — but there is no
 * reason to accept any deviation for 256 KB when 512 KB is exact. Verified: 0 differing codes over all
 * 65 536 against the old function, so this change cannot alter a single rendered pixel.
 *
 * **The triage row proposed reading back as `gl.FLOAT` instead, and that is the wrong fix.** It is
 * marginally faster (5.3× vs 5.0×, within noise of the LUT) but it **doubles the readback transfer**,
 * 2 MB → 4 MB per `readbackVelocity()` — and a synchronous `readPixels` stall is exactly what H2 is
 * about. The LUT costs zero bandwidth. Do not "finish" H8 by switching the format.
 *
 * 512 KB and one 4.5 ms build, both paid once at module load rather than per instance — the table is a
 * pure function of the format.
 */
const HALF_TO_FLOAT: Float64Array = (() => {
  const lut = new Float64Array(65536);
  for (let h = 0; h < 65536; h++) {
    const exp = (h >> 10) & 0x1f;
    const mant = h & 0x3ff;
    const sign = h >> 15 ? -1 : 1;
    lut[h] = exp === 0
      ? sign * 5.96046e-8 * mant
      : exp === 31
        ? (mant ? NaN : sign * Infinity)
        : sign * Math.pow(2, exp - 15) * (1 + mant / 1024);
  }
  return lut;
})();

function createRGBA16FTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, FLUID_SIZE, FLUID_SIZE, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

const BASE_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// Pass 1: Semi-Lagrangian advection
const ADVECT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_src;
uniform float u_dt;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 vel = texture(u_vel, v_uv).xy;
  vec2 px = 1.0 / vec2(${FLUID_SIZE}.0);
  vec2 prev = v_uv - vel * u_dt * px * 30.0;
  fragColor = texture(u_src, clamp(prev, px, 1.0 - px));
}`;

// Pass 2: Divergence
const DIVERGE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_vel;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 px = 1.0 / vec2(${FLUID_SIZE}.0);
  float L = texture(u_vel, v_uv - vec2(px.x, 0)).x;
  float R = texture(u_vel, v_uv + vec2(px.x, 0)).x;
  float B = texture(u_vel, v_uv - vec2(0, px.y)).y;
  float T = texture(u_vel, v_uv + vec2(0, px.y)).y;
  fragColor = vec4(0.5 * (R - L + T - B), 0, 0, 1);
}`;

// Pass 3: Jacobi pressure solve
const JACOBI_FS = `#version 300 es
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 px = 1.0 / vec2(${FLUID_SIZE}.0);
  float L = texture(u_pressure, v_uv - vec2(px.x, 0)).x;
  float R = texture(u_pressure, v_uv + vec2(px.x, 0)).x;
  float B = texture(u_pressure, v_uv - vec2(0, px.y)).x;
  float T = texture(u_pressure, v_uv + vec2(0, px.y)).x;
  float div = texture(u_divergence, v_uv).x;
  fragColor = vec4((L + R + B + T - div) * 0.25, 0, 0, 1);
}`;

// Pass 4: Gradient subtraction
const GRAD_FS = `#version 300 es
precision highp float;
uniform sampler2D u_vel;
uniform sampler2D u_pressure;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 px = 1.0 / vec2(${FLUID_SIZE}.0);
  float pL = texture(u_pressure, v_uv - vec2(px.x, 0)).x;
  float pR = texture(u_pressure, v_uv + vec2(px.x, 0)).x;
  float pB = texture(u_pressure, v_uv - vec2(0, px.y)).x;
  float pT = texture(u_pressure, v_uv + vec2(0, px.y)).x;
  vec2 vel = texture(u_vel, v_uv).xy;
  vel -= 0.5 * vec2(pR - pL, pT - pB);
  fragColor = vec4(vel * 0.98, 0, 1); // 2% drain per frame — half-life ~35 frames for smooth sustained flow
}`;

// Blur + decay: 3×3 box blur with per-frame decay factor.
// Replaces the full NS pipeline — no pressure projection, no divergence artifacts.
const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_vel;
uniform float u_decay;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 px = 1.0 / vec2(${FLUID_SIZE}.0);
  vec2 sum = vec2(0.0);
  float count = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 sampleUv = v_uv + vec2(float(dx), float(dy)) * px;
      if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
        sum += texture(u_vel, sampleUv).xy;
        count += 1.0;
      }
    }
  }
  fragColor = vec4((sum / count) * u_decay, 0.0, 1.0);
}`;

// Splat shader: add velocity at a point
const SPLAT_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_vel;
out vec2 v_vel;
void main() {
  v_vel = a_vel;
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 6.0;
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 v_vel;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float w = max(0.0, 1.0 - d);
  fragColor = vec4(v_vel * w, 0, 0);
}`;

export class FluidAdvectionProcessor {
  private gl: WebGL2RenderingContext | null = null;

  // Velocity ping-pong FBOs
  private velTexA: WebGLTexture | null = null;
  private velTexB: WebGLTexture | null = null;
  private fboVelA: WebGLFramebuffer | null = null;
  private fboVelB: WebGLFramebuffer | null = null;

  // Pressure + divergence FBOs
  private presTex0: WebGLTexture | null = null;
  private presTex1: WebGLTexture | null = null;
  private fboP0: WebGLFramebuffer | null = null;
  private fboP1: WebGLFramebuffer | null = null;
  private divTex: WebGLTexture | null = null;
  private fboDiv: WebGLFramebuffer | null = null;

  // Programs
  private advectProg: WebGLProgram | null = null;
  private divergeProg: WebGLProgram | null = null;
  private jacobiProg: WebGLProgram | null = null;
  private gradProg: WebGLProgram | null = null;
  private blurProg: WebGLProgram | null = null;
  private splatProg: WebGLProgram | null = null;

  // Scratch FBO for blur pass
  private velTexC: WebGLTexture | null = null;
  private fboVelC: WebGLFramebuffer | null = null;

  // VAOs
  private quadVAO: WebGLVertexArrayObject | null = null;
  private splatVAO: WebGLVertexArrayObject | null = null;
  private splatVBO: WebGLBuffer | null = null;
  private splatVelVBO: WebGLBuffer | null = null;

  // Velocity readback — RGBA16F readback requires Uint16Array (half-float on CPU)
  private velReadbackBuf: Uint16Array = new Uint16Array(FLUID_SIZE * FLUID_SIZE * 4);
  /** G4b (2026-11-12) — the ASYNC velocity readback's PIXEL_PACK buffer and fence. See `readbackVelocity`. */
  private velPackBuffer: WebGLBuffer | null = null;
  private velPackSync: WebGLSync | null = null;
  private readbackFrame = 0;

  private config: FluidAdvectionConfig = { blend: 0, returnForce: 2.0 };
  private fieldDecay = 0.985;
  // Persistent per-particle offsets in UV space — survive wave recomputation each frame
  private offsetX: Float32Array = new Float32Array(0);
  private offsetY: Float32Array = new Float32Array(0);

  // Uniform locations, resolved in `init()` alongside the blur program that owns them (triage H6).
  // `step()` already hoisted its two out of the 4-pass loop but still queried them once per frame.
  // This is also the only place `blurProg` is linked, and it re-runs when the program is re-created,
  // `resize()` being dispose+init.
  //
  // A DYE FIELD used to live here — 2 RGBA16F ping-pong textures, 2 FBOs, 3 programs, 2 VAOs, 3
  // buffers and 6 more uniform locations, with `initDye`/`injectDye`/`advectDye`/`renderDyeOverlay`/
  // `disposeDye`, four shader sources and a full Visual FX section. It was **deleted 2026-08-12**
  // (triage G14): the three draw passes had ZERO callers anywhere in `src/`, so no dye was ever
  // injected, advected or composited, while `setDyeConfig` really did allocate all 13 GL objects the
  // moment the Enable box was ticked. `DyeFieldConfig` survives in `presets/types.ts` for import
  // compatibility only — see the note there. A latent bug went with it: `resize()` is dispose+init and
  // `init()` never re-entered `initDye()`, so had the passes ever been wired up the field would have
  // died silently on the first window resize (B17's shape). If a dye field is ever wanted, build it as
  // its own render pass with its calls in the frame loop from the first commit, not as dormant methods.
  private uBlurDecayLoc: WebGLUniformLocation | null = null;
  private uBlurVelLoc: WebGLUniformLocation | null = null;

  private forceFieldActive = false;

  /**
   * v8 Step 15.5 (E88) — the liquid pool's claim on this field. **A THIRD, INDEPENDENT ACTIVATION SOURCE, and
   * it exists because neither of the other two can express it.**
   *
   * The field has had two consumers: `config.blend > 0` (CPU advection of the wave figure) and
   * `forceFieldActive` (TransMap style 6, which samples the texture on the GPU). The pool is a third shape —
   * it needs the field SIMULATED *and* READ BACK TO THE CPU, but must not touch the wave figure's positions —
   * and that combination is reachable through neither flag:
   *
   * - Setting `config.blend` would enable `advectParticles()`, which rewrites the wave positions in place. The
   *   figure would be dragged by its own wake, which is exactly the pollution relationship (B) is defined by
   *   NOT having. It would also change all 24 authored `fluidAdvection` blocks' meaning.
   * - Setting `forceFieldActive` simulates the field but leaves the readback gate closed (`step()` requires
   *   `blend > 0` for it), so `sampleVelocity()` would return the zeros `velReadbackBuf` is born with — a pool
   *   that renders, moves nothing, and reports no error. Invariant 13's shape, arriving through a second gate
   *   on a path whose first gate is open.
   *
   * ⚠️ **Both of those failures are SILENT and one of them is invisible in a diff**, which is why this is a
   * named third source rather than a reuse. `isActive()` and the readback gate below each read it.
   */
  private poolActive = false;

  /**
   * v8 Step 15.7 (E90), added 2026-09-03 — the dye field's claim on this field. **A FOURTH, INDEPENDENT
   * ACTIVATION SOURCE, and it is here because the step SHIPPED WITHOUT IT and the omission was silent.**
   *
   * ⚠️ **REPORTED BY THE USER, AND IT IS THE FIFTH TIME 15.7 FAILED ONE PASS DOWNSTREAM OF A CORRECT
   * PIPELINE:** with `Dye Field` enabled and `Liquid Field` DISABLED, `Advection` was inert at every value.
   * The dye still deposited, still decayed, still tinted the surface and still drew its wake — the one thing
   * missing was the *smearing*, which is the entire point of an ADVECTED dye field. `step()` advects along
   * `getVelocityTexture()`, and that texture is allocated-but-never-stepped unless something turns the
   * simulation on; the dye read a field of zeros and honestly reported nothing.
   *
   * **Neither of the other three flags can express it, for the same reasons `poolActive` could not reuse
   * them, plus one of its own:**
   *
   * - `config.blend > 0` switches on `advectParticles()`, which rewrites the wave positions in place — the
   *   figure dragged by its own wake. It would also change all authored `fluidAdvection` blocks' meaning.
   * - `forceFieldActive` belongs to TransMap style 6 and carries `trailDecay` and `fieldDecay` overrides with
   *   it (see `applyFluidFeedbackState`), so borrowing it would change a preset's trail persistence as a side
   *   effect of enabling a colour field.
   * - `poolActive` is the closest fit and is still wrong: it means *a second POPULATION exists*. Reusing it
   *   would make `Dye Field → Enable` publish pool tracers, i.e. one control silently creating the other
   *   feature's particles.
   *
   * ⚠️ **AND IT IS DELIBERATELY *NOT* ADDED TO THE READBACK GATE BELOW.** The dye advects on the **GPU**,
   * sampling `velTexA` directly in `ADVECT_FS` — it never calls `sampleVelocity()`. So it is `forceFieldActive`'s
   * shape (simulate, do not read back), not `poolActive`'s, and adding it to the `readPixels` gate would buy a
   * 2 MB synchronous stall every other frame for a consumer that cannot observe the result. **The two gates
   * answer different questions and a new source must be graded against each separately** — which is what made
   * 15.5's version of this a THIRD source in both and this one a FOURTH in only one.
   */
  private dyeActive = false;

  setForceFieldActive(on: boolean): void { this.forceFieldActive = on; }

  /** See `poolActive`. Called only from `applyFluidFeedbackState()`, the single owner of this class's state. */
  setPoolActive(on: boolean): void { this.poolActive = on; }

  /** See `dyeActive`. Called only from `applyFluidFeedbackState()`, for `setPoolActive`'s stated reason. */
  setDyeActive(on: boolean): void { this.dyeActive = on; }

  isActive(): boolean {
    return this.config.blend > 0 || this.forceFieldActive || this.poolActive || this.dyeActive;
  }

  getVelocityTexture(): WebGLTexture | null {
    return this.velTexA;
  }

  /**
   * Bilinear CPU read of the velocity field, UV in and UV-per-60 Hz-frame out.
   *
   * ⚠️ **PUBLIC ONLY FOR THE 15.5 POOL, WHICH INTEGRATES ITS OWN MOTION RATHER THAN BORROWING
   * `advectParticles()`** — that method owns ONE particle-indexed offset pair and writes its input array in
   * place, so a second population riding it would collide with the wave figure index for index.
   *
   * ⚠️ **The unit is the trap here (invariant 10 at a subsystem boundary): this is a per-frame DISPLACEMENT in
   * UV, not a velocity**, because `main.ts` seeds the field with `(dx / w) * 0.08` where `dx` is one frame's
   * pixel motion. `advectParticles` consumes it as a displacement, which is why it needs no `dt` in its
   * deposit; a consumer that treats it as a velocity must convert. `LiquidPool.SPEED` documents that
   * conversion and is the only other caller.
   *
   * Returns 0 before the first readback (`velReadbackBuf` is allocated zeroed), so a caller whose activation
   * has not yet reached `step()` sees a still field rather than stale garbage.
   */
  sampleVelocity(u: number, v: number, channel: number): number {
    return this.sampleVel(u, v, channel);
  }

  setFieldDecay(v: number): void {
    this.fieldDecay = Math.max(0.95, Math.min(0.999, v));
  }

  getBlend(): number { return this.config.blend; }

  setConfig(cfg: FluidAdvectionConfig): void { this.config = { ...cfg }; }

  resetOffsets(count: number): void {
    this.offsetX = new Float32Array(count);
    this.offsetY = new Float32Array(count);
  }

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;

    this.velTexA = createRGBA16FTexture(gl);
    this.velTexB = createRGBA16FTexture(gl);
    this.velTexC = createRGBA16FTexture(gl);
    this.fboVelA = createFBO(gl, this.velTexA);
    this.fboVelB = createFBO(gl, this.velTexB);
    this.fboVelC = createFBO(gl, this.velTexC);

    this.presTex0 = createRGBA16FTexture(gl);
    this.presTex1 = createRGBA16FTexture(gl);
    this.fboP0 = createFBO(gl, this.presTex0);
    this.fboP1 = createFBO(gl, this.presTex1);

    this.divTex = createRGBA16FTexture(gl);
    this.fboDiv = createFBO(gl, this.divTex);

    // Compile all programs
    const mkProg = (fs: string, label: string) => compileProgram(gl, BASE_VS, fs, label);

    this.blurProg = mkProg(BLUR_FS, 'Fluid blur');
    this.uBlurDecayLoc = gl.getUniformLocation(this.blurProg, 'u_decay');
    this.uBlurVelLoc = gl.getUniformLocation(this.blurProg, 'u_vel');
    this.advectProg = mkProg(ADVECT_FS, 'Fluid advect');
    this.divergeProg = mkProg(DIVERGE_FS, 'Fluid divergence');
    this.jacobiProg = mkProg(JACOBI_FS, 'Fluid jacobi');
    this.gradProg = mkProg(GRAD_FS, 'Fluid gradient subtract');

    // Shared quad VAO for fullscreen passes
    this.quadVAO = gl.createVertexArray()!;
    const quadVBO = gl.createBuffer()!;
    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLocBase = gl.getAttribLocation(this.advectProg, 'a_pos');
    gl.enableVertexAttribArray(posLocBase);
    gl.vertexAttribPointer(posLocBase, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Splat program
    this.splatProg = compileProgram(gl, SPLAT_VS, SPLAT_FS, 'Fluid splat');

    this.splatVAO = gl.createVertexArray()!;
    this.splatVBO = gl.createBuffer()!;
    this.splatVelVBO = gl.createBuffer()!;
    gl.bindVertexArray(this.splatVAO);
    const posLoc = gl.getAttribLocation(this.splatProg, 'a_pos');
    const velLoc = gl.getAttribLocation(this.splatProg, 'a_vel');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVBO);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelVBO);
    gl.enableVertexAttribArray(velLoc);
    gl.vertexAttribPointer(velLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    [this.advectProg, this.divergeProg, this.jacobiProg, this.gradProg, this.blurProg, this.splatProg]
      .forEach(p => { if (p) gl.deleteProgram(p); });
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.splatVAO) gl.deleteVertexArray(this.splatVAO);
    if (this.splatVBO) gl.deleteBuffer(this.splatVBO);
    if (this.splatVelVBO) gl.deleteBuffer(this.splatVelVBO);
    // G4b — invariant 1: the async readback's buffer and fence.
    if (this.velPackBuffer) gl.deleteBuffer(this.velPackBuffer);
    if (this.velPackSync) gl.deleteSync(this.velPackSync);
    this.velPackBuffer = null; this.velPackSync = null;
    [this.fboVelA, this.fboVelB, this.fboVelC, this.fboP0, this.fboP1, this.fboDiv]
      .forEach(f => { if (f) gl.deleteFramebuffer(f); });
    [this.velTexA, this.velTexB, this.velTexC, this.presTex0, this.presTex1, this.divTex]
      .forEach(t => { if (t) gl.deleteTexture(t); });
    this.gl = null;
  }

  /**
   * ⚠️ There is deliberately NO `resize()`. Deleted 2026-08-12 (triage H12); do not reinstate it as an
   * obvious missing method — the same regrowth path `deadcheck` already guards for
   * `TranslationMapProcessor.resize()` (G5).
   *
   * **This simulation is resolution-independent by construction.** `FLUID_SIZE` is a module constant
   * baked into every `texImage2D` above *and* into the shader sources as `1.0 / vec2(512.0)`, `init()`
   * takes only `(gl)` and no field on this class derives from the canvas, and every interface is
   * UV-space: `seedFromParticles()` takes normalised UVs, `sampleVel()` returns UV-space velocity, and
   * `getVelocityTexture()` is sampled by `vUV`. A window resize changes nothing this class can observe.
   *
   * So the old body — `dispose(); init(gl);` — rebuilt 6 programs, 6 textures, 6 FBOs, 2 VAOs and
   * 2 buffers to produce a byte-identical simulation. Under H11 that ran TWICE per Lab panel toggle
   * (`setPanelMode` calls `resizeAll()` immediately and again from a 350 ms `setTimeout` chasing the CSS
   * `grid-template-columns` transition), so a single panel toggle paid four full teardown/rebuilds
   * across this class and `PhysarumProcessor`.
   *
   * One deliberate behaviour change: the old rebuild also CLEARED the velocity field to zeros, so a
   * resize visibly popped the flow field back to nothing. It is now preserved. If the aspect ratio
   * changed, the retained field is stretched in UV space — accepted, and far less visible than the pop.
   */

  // Blur-decay pass: smooths and decays the accumulated velocity field.
  // No NS pressure projection — avoids divergence-free shear artifacts that cause electric jitter.
  step(_dt: number): void {
    const gl = this.gl;
    if (!gl || !this.isActive()) return;

    const savedVP = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.viewport(0, 0, FLUID_SIZE, FLUID_SIZE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // 4 blur passes: each spreads velocity ~1px, 4 passes → ~4px radius flow corridor.
    // Only the final pass applies decay; intermediate passes are lossless spreads.
    const decayLoc = this.uBlurDecayLoc;
    const velLoc   = this.uBlurVelLoc;
    gl.useProgram(this.blurProg!);
    for (let pass = 0; pass < 4; pass++) {
      const isLast = pass === 3;
      // decay 0.985/frame → half-life ~46 frames (~770ms) — field builds up, reads as flow
      gl.uniform1f(decayLoc, isLast ? this.fieldDecay : 1.0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.velTexA);
      gl.uniform1i(velLoc, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboVelC!);
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      [this.velTexA, this.velTexC] = [this.velTexC!, this.velTexA!];
      [this.fboVelA, this.fboVelC] = [this.fboVelC!, this.fboVelA!];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    gl.viewport(savedVP[0]!, savedVP[1]!, savedVP[2]!, savedVP[3]!);

    this.readbackFrame++;
    // Only readback to CPU when a CPU consumer needs it. When only forceFieldActive (style 6 TransMap),
    // the GPU reads the texture directly and this 2 MB transfer is pure cost.
    //
    // ⚠️ v8 15.5: `poolActive` is a SECOND CPU consumer and it is NOT implied by `blend > 0` — the pool
    // deliberately does not set `blend`, because that flag also switches on `advectParticles()` and would drag
    // the wave figure through its own wake. Omitting it here is the failure mode that costs nothing visible:
    // the field simulates, the pool renders, and every sample reads the zeros `velReadbackBuf` is born with,
    // so a completely still pool is the ONLY symptom (invariant 13 behind a second gate).
    // G4b: a finished read is collected EVERY frame (a poll, never a wait), and a new one issued on the 2nd frame.
    this.collectVelocity(gl);
    if (this.readbackFrame % 2 === 0 && (this.config.blend > 0 || this.poolActive)) {
      this.readbackVelocity(gl);
    }
  }

  /*
   * T009: read velocity back to CPU.
   *
   * ⚠️ **ASYNCHRONOUS since 2026-11-12 (G4b).** The synchronous `readPixels` waited for every queued GPU command every
   * 2nd frame — on the owner's integrated-GPU machine `The Real Super Man` (fluid advection) ran at 32 fps with
   * p95 67 ms. Now the read lands in a PIXEL_PACK buffer behind a fence and `collectVelocity` copies it into
   * `velReadbackBuf` (the one array `sampleVelocity` reads) once the fence has signalled — one or two frames later.
   * A new read is issued only when the previous one has been collected.
   */
  private readbackVelocity(gl: WebGL2RenderingContext): void {
    if (this.velPackSync) return;
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboVelA);
    if (!this.velPackBuffer) {
      this.velPackBuffer = gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.velPackBuffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, this.velReadbackBuf.byteLength, gl.STREAM_READ);
    } else {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.velPackBuffer);
    }
    gl.readPixels(0, 0, FLUID_SIZE, FLUID_SIZE, gl.RGBA, gl.HALF_FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.velPackSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    // A debug block used to live here, walking all 262 144 texels and hand-decoding two half-float
    // channels each (~500 000 `halfToFloat` calls) every 240th readback, purely to `console.log` one
    // maximum. Removed 2026-08-12 (triage H3) — a guaranteed frame hitch on a fixed schedule, in
    // shipped code, for a number nobody reads. If it is needed again, gate it behind a debug flag and
    // sample a stride rather than every texel.
  }

  /** G4b — copy a finished velocity read into `velReadbackBuf`; a poll of the fence, never a wait. */
  private collectVelocity(gl: WebGL2RenderingContext): void {
    if (!this.velPackSync || !this.velPackBuffer) return;
    if (gl.getSyncParameter(this.velPackSync, gl.SYNC_STATUS) !== gl.SIGNALED) return;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.velPackBuffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.velReadbackBuf);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteSync(this.velPackSync);
    this.velPackSync = null;
  }

  // T009: scatter particle velocities into the fluid field as initial seed
  seedFromParticles(positions: Float32Array, velocities: Float32Array, count: number): void {
    const gl = this.gl;
    if (!gl || !this.splatProg) return;

    const savedVP = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.viewport(0, 0, FLUID_SIZE, FLUID_SIZE);
    // No clear — particle velocities accumulate on top of the existing (decayed) field.
    // ⚠️ **Steady-state decay is `this.fieldDecay` on the LAST of `step()`'s four blur passes.** This line
    // used to credit "the 0.98 drain in GRAD shader", which is false and misleading in a specific way:
    // `GRAD_FS` is part of the Navier-Stokes projection, and that path is COMPILED BUT NEVER DRAWN (see
    // `step()`), so a reader looking for the drain would find a plausible constant in dead code and
    // conclude the decay is fixed at 0.98 rather than being the `Field Decay` control (0.95-0.999).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboVelA);

    gl.useProgram(this.splatProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVBO!);
    gl.bufferData(gl.ARRAY_BUFFER, positions.subarray(0, count * 2), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelVBO!);
    gl.bufferData(gl.ARRAY_BUFFER, velocities.subarray(0, count * 2), gl.DYNAMIC_DRAW);

    gl.bindVertexArray(this.splatVAO);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    gl.viewport(savedVP[0]!, savedVP[1]!, savedVP[2]!, savedVP[3]!);
  }

  // Accumulate fluid velocity into persistent per-particle offsets, then apply to wave positions.
  // Offsets survive wave recomputation each frame — without this, each frame's displacement is
  // overwritten before it renders, producing a single-frame flicker instead of visible flow.
  //
  // Design: scale is large so offsets charge up fast. maxOffset = blend * MAX is the hard
  // magnitude ceiling — blend directly controls effect strength. decayRate controls snappiness
  // (how fast offsets return to zero when the field changes direction).
  advectParticles(
    wavePositions: Float32Array,  // pure wave UV positions this frame (pre-advection)
    count: number,
    dtMs = 1000 / 60,             // frame delta; the default reproduces the historical 60fps behaviour
  ): void {
    // Grow-only, PRESERVING existing offsets (D8). This was `length !== count → resetOffsets(count)`,
    // and `count` includes the spark pool, whose active size changes on most frames — so an ordinary
    // spark spawning threw away the accumulated displacement of every particle in the figure at once.
    // Since the offsets are a decaying accumulator (`o = (o + v) * retain`), that reads as the whole
    // figure snapping back toward its mathematical position and then charging up again. Slots above the
    // old length start at zero, which is what a genuinely new particle should have. A buffer longer
    // than `count` is harmless: the loop below is bounded by `count`.
    if (this.offsetX.length < count) {
      const gx = new Float32Array(count); gx.set(this.offsetX); this.offsetX = gx;
      const gy = new Float32Array(count); gy.set(this.offsetY); this.offsetY = gy;
    }

    const cfg = this.config;
    // maxOffset: blend=0 → no effect, blend=1 → up to 12% of UV range displaced
    const maxOff = cfg.blend * 0.12;
    // Offset decay, dt-CORRECT as of 2026-08-06.
    //
    // `decayRate` is still authored as a fraction removed PER FRAME AT 60 FPS, but it is now converted
    // to a continuous rate — `k = -ln(1 - decayRate) * 60` — and applied as `exp(-k * dt)`. It used to
    // be applied once per frame with no reference to `dt`, so the decay per SECOND scaled with frame
    // rate: at 30 fps offsets persisted twice as long and the flow read as noticeably stronger. The
    // conversion is exact at 60 fps, so every preset and the whole returnForce range keep their tuned
    // behaviour there and only the frame-rate dependence is gone.
    //
    // returnForce=0 → 1%/frame  (half-life ~1.15 s, slow organic drift)
    // returnForce=5 → 10%/frame (half-life ~0.11 s, noticeably snappy but still visible)
    // The ACCUMULATION below is scaled by the matching factor, for the same reason as physarum: this
    // is a recurrence (`o = (o + v*0.5) * retain`, steady state `v*0.5*retain/(1-retain)`), so making
    // `retain` dt-dependent while the velocity term stays a fixed per-frame amount would make the
    // AMPLITUDE depend on frame time — whole-figure jitter under ordinary rAF wobble. `depositScale`
    // cancels it exactly and is 1.0 at 60 fps.
    const decayRate = Math.min(0.999, Math.max(0.0001, 0.01 + cfg.returnForce * 0.018));
    const decayK = -Math.log(1 - decayRate) * 60;
    const retain = Math.exp(-decayK * (dtMs / 1000));
    const depositScale = ((1 - decayRate) / decayRate) * ((1 - retain) / retain);

    for (let i = 0; i < count; i++) {
      // Sample velocity at the wave position (not offset position — avoids feedback)
      const u = wavePositions[i * 2]!;
      const v = wavePositions[i * 2 + 1]!;
      const vx = this.sampleVel(u, v, 0);
      const vy = this.sampleVel(u, v, 1);

      // Large accumulation scale so offsets charge up within a few frames,
      // then the clamp provides the magnitude ceiling
      this.offsetX[i] = (this.offsetX[i]! + vx * 0.5 * depositScale) * retain;
      this.offsetY[i] = (this.offsetY[i]! + vy * 0.5 * depositScale) * retain;

      // Clamp to blend-controlled max — this is what blend actually controls
      this.offsetX[i] = Math.max(-maxOff, Math.min(maxOff, this.offsetX[i]!));
      this.offsetY[i] = Math.max(-maxOff, Math.min(maxOff, this.offsetY[i]!));

      // Apply offset to the wave position
      wavePositions[i * 2]     = Math.max(0, Math.min(1, u + this.offsetX[i]!));
      wavePositions[i * 2 + 1] = Math.max(0, Math.min(1, v + this.offsetY[i]!));
    }
  }

  private sampleVel(u: number, v: number, channel: number): number {
    const x = Math.max(0, Math.min(FLUID_SIZE - 1, u * FLUID_SIZE));
    const y = Math.max(0, Math.min(FLUID_SIZE - 1, v * FLUID_SIZE));
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const x1 = Math.min(xi + 1, FLUID_SIZE - 1);
    const y1 = Math.min(yi + 1, FLUID_SIZE - 1);
    const stride = 4;
    const lut = HALF_TO_FLOAT;
    const buf = this.velReadbackBuf;
    const a = lut[buf[(yi * FLUID_SIZE + xi) * stride + channel]!]!;
    const b = lut[buf[(yi * FLUID_SIZE + x1) * stride + channel]!]!;
    const c = lut[buf[(y1 * FLUID_SIZE + xi) * stride + channel]!]!;
    const d = lut[buf[(y1 * FLUID_SIZE + x1) * stride + channel]!]!;
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }
}
