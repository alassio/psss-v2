import type { PhysarumConfig } from '../presets/types.ts';
import { compileProgram } from '../core/gl-program.ts';

const TRAIL_SIZE = 512;

/**
 * The two non-palette values `PhysarumConfig.trailColour` can hold — v8 9.3.
 *
 * Exported and shared rather than written as literals at each site, for the reason `CLAUDE.md` gives for a
 * slider `min` sharing the engine's clamp: **three enumerations of one list make a missing entry
 * structurally invisible.** These strings are compared in `main.ts`'s resolver, offered by the Visual FX
 * dropdown, and named in the migration default — a typo in any one of the three is silent.
 *
 * ⚠️ **Both are parenthesised so neither can ever collide with a palette name.** `getAllPaletteNames()`
 * returns 12 cosine names, 13 `Classic: ` gradients and 7 `Material: ` ramps, and `getPaletteLUT` matches
 * cosine names CASE-INSENSITIVELY — so a bare `'Auto'` would be safe only until someone adds a palette
 * called `auto`. `'(Preset)'` also matches the spelling `static-field.ts` already uses for "defer to what
 * the preset says", so the idiom is the engine's, not this file's.
 */
export const PHYSARUM_TRAIL_COLOUR_PRESET = '(Preset)';
export const PHYSARUM_TRAIL_COLOUR_AUTO = '(Auto)';

function createTrailTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // RGBA32F: guaranteed color-renderable and readable via gl.RGBA+gl.FLOAT in WebGL2
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TRAIL_SIZE, TRAIL_SIZE, 0, gl.RGBA, gl.FLOAT, null);
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

// ---- Deposit shader: point sprites, additive blending ----
const DEPOSIT_VS = `#version 300 es
precision highp float;
in vec2 a_pos; // UV [0,1]
uniform float u_pointSize;
void main() {
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}`;

const DEPOSIT_FS = `#version 300 es
precision highp float;
uniform float u_amount;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float w = max(0.0, 1.0 - d);
  fragColor = vec4(w * u_amount, 0.0, 0.0, 1.0);
}`;

// ---- Diffuse + decay shader ----
const DIFFUSE_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Reads both trailTexB (fresh deposits) and trailTexA (accumulated trail).
// Output = blur3x3(deposits) + old_trail * (1 - decay)
const DIFFUSE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_deposit; // fresh deposits this frame
uniform sampler2D u_trail;   // accumulated trail from previous frames
uniform float u_decay;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 px = 1.0 / vec2(${TRAIL_SIZE}.0);
  float s = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      s += texture(u_deposit, v_uv + vec2(float(dx), float(dy)) * px).r;
    }
  }
  float blurred = s / 9.0;
  float prevTrail = texture(u_trail, v_uv).r;
  float v = clamp(blurred + prevTrail * (1.0 - u_decay), 0.0, 1.0);
  fragColor = vec4(v, 0.0, 0.0, 1.0);
}`;

// ---- Trail overlay shader ----
//
// v8 Step 9.3 — the trail's colour is now a CONTROL, sampled from a 256×1 LUT, where it used to be the
// literal `vec4(alpha, alpha * 0.65, alpha * 0.2, alpha)` — a fixed orange with no uniform able to reach
// it. That was invariant 13's shape in its purest form: the one lit thing in the engine outside the
// `palette > material ramp > preset colour` precedence every other coloured pass obeys.
//
// ⚠️ **`u_useLut` is what keeps the default's COLOUR EXPRESSION byte-identical, and that is a narrower claim
// than "the default is unchanged" — read the next paragraph before believing the wider one.** At `0` the
// shader emits exactly the legacy RGB above, so all 361 presets and every export written before this step
// carry the same tint; the CPU side never uploads a LUT in that state either. **Do not "simplify" it away by
// uploading an orange LUT instead:** a LUT is 256 quantised samples of the ramp, whereas the literal is
// evaluated at full float precision per fragment, so the two are close but not equal — and the point of the
// flag is that an unset control changes no colour.
//
// ⚠️ **THE COMPOSITE *DOES* CHANGE AT THE DEFAULT, AND IT IS THE ONE DELIBERATE LOOK CHANGE HERE.** The
// emitted colour is now PREMULTIPLIED (`tint * alpha`) and `renderOverlay` blends with
// `ONE, ONE_MINUS_SRC_ALPHA`; the pre-9.3 pair was a non-premultiplied `vec4(alpha, …)` under
// `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`, i.e. invariant 9 exactly — opacity applied TWICE, so `Trail Opacity`
// 0.8 reached the screen as 0.64. The loss was density-dependent, so it distorted the network's falloff
// rather than merely dimming it, and the trail is correspondingly stronger now at any opacity below 1.
// **The shader's `tint * alpha` and that blend equation are correct only as a PAIR — change neither alone.**
//
// ⚠️ **THE GAMMA LIFT IS APPLIED BEFORE THE LUT INDEX, AND THAT IS DELIBERATE.** `pow(t, 0.3)` exists to
// make a faint trail visible at all; it now also decides WHERE in the ramp a given density lands. Indexing
// the LUT with raw `t` instead would push almost the whole field into the ramp's bottom few percent — the
// dark, often transparent end of `fire`/`liquid`/`organic` — and the network would read as one flat dim
// colour with the ramp apparently inert (invariant 13's harder form: the control moves the right thing,
// but the output channel cannot show it). Boosting first spreads the real density range across the ramp.
// It follows that the exponent and the ramp are now COUPLED: changing 0.3 re-maps every ramp at once.
//
// The LUT carries RGB only, per `MATERIAL_RAMP_PREFIX`'s own rule — a ramp's authored alpha is not carried
// into the palette path, opacity being a separate concern. `u_opacity` remains the single owner of alpha,
// so `Trail Opacity` behaves identically whichever colour is chosen.
const OVERLAY_VS = DIFFUSE_VS;
const OVERLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D u_trail;
uniform sampler2D u_lut;     // 256x1 RGBA8 colour ramp; see u_useLut
uniform float u_useLut;      // 0 = legacy fixed orange (the pre-9.3 expression, exactly), 1 = sample u_lut
uniform float u_opacity;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  float t = texture(u_trail, v_uv).r;
  // Gamma lift: pow(t, 0.3) maps 0.01→0.20, 0.05→0.38, 0.15→0.57 — visible at any opacity
  float boosted = pow(clamp(t, 0.0, 1.0), 0.3);
  float alpha = boosted * u_opacity;
  // Half-texel inset: index 0 and 255 must reach the LUT's true end stops rather than blending with the
  // clamped edge, the sampler being LINEAR.
  vec3 ramped = texture(u_lut, vec2(boosted * (255.0 / 256.0) + (0.5 / 256.0), 0.5)).rgb;
  vec3 legacy = vec3(1.0, 0.65, 0.2);
  vec3 tint = mix(legacy, ramped, u_useLut);
  fragColor = vec4(tint * alpha, alpha);
}`;

export class PhysarumProcessor {
  private gl: WebGL2RenderingContext | null = null;
  // depositTex: cleared and filled with fresh point sprites each frame
  private depositTex: WebGLTexture | null = null;
  private depositFBO: WebGLFramebuffer | null = null;
  // trailTexA: accumulated trail (read source for diffuse + sensing)
  // trailTexB: diffuse output target (swapped with A each frame)
  private trailTexA: WebGLTexture | null = null;
  private trailTexB: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;
  // RGBA+FLOAT readback — gl.RED+gl.FLOAT is not guaranteed by WebGL2 spec, use RGBA
  private readbackBuf: Float32Array = new Float32Array(TRAIL_SIZE * TRAIL_SIZE * 4);
  private readbackFrame = 0;
  // Per-particle persistent headings (angle in radians) — survive across frames
  private headings: Float32Array = new Float32Array(0);

  private depositProg: WebGLProgram | null = null;
  private depositVAO: WebGLVertexArrayObject | null = null;
  private depositVBO: WebGLBuffer | null = null;
  private depositPointSizeLoc: WebGLUniformLocation | null = null;
  private depositAmountLoc: WebGLUniformLocation | null = null;

  private diffuseProg: WebGLProgram | null = null;
  private diffuseVAO: WebGLVertexArrayObject | null = null;
  private diffuseDecayLoc: WebGLUniformLocation | null = null;
  // Sampler locations, resolved in `init()` alongside `diffuseDecayLoc`. `updateTrail` queried these
  // two every frame and `renderOverlay` a third — an inconsistency rather than a design, since every
  // other uniform in this file was already cached right beside them (triage H6). `resize()` is
  // dispose+init here, so a re-created program re-resolves all of them together.
  private diffuseDepositLoc: WebGLUniformLocation | null = null;
  private diffuseTrailLoc: WebGLUniformLocation | null = null;

  private overlayProg: WebGLProgram | null = null;
  private overlayVAO: WebGLVertexArrayObject | null = null;
  private overlayOpacityLoc: WebGLUniformLocation | null = null;
  private overlayTrailLoc: WebGLUniformLocation | null = null;
  // v8 9.3. Both resolved in `init()` beside the two above, for the reason triage H6 gives for
  // `diffuseDepositLoc`: a per-frame `getUniformLocation` is an inconsistency, not a design.
  private overlayLutLoc: WebGLUniformLocation | null = null;
  private overlayUseLutLoc: WebGLUniformLocation | null = null;
  /**
   * The 256×1 trail LUT, and a 1×1 white fallback — v8 9.3.
   *
   * ⚠️ **Invariant 4: `u_lut` is assigned its unit UNCONDITIONALLY and a texture is ALWAYS bound there,
   * never `null`, even at `u_useLut = 0`.** This program has two samplers now, and an unassigned
   * `sampler2D` can resolve a whole multi-sampler draw black — which here would mean the trail vanishing
   * for every preset that never chose a colour, i.e. all of them. `lutFallbackTex` is that guaranteed bind.
   *
   * ⚠️ **Invariant 3: both die with the resource.** `lutReady` is false whenever `lutTex` is null.
   */
  private lutTex: WebGLTexture | null = null;
  private lutFallbackTex: WebGLTexture | null = null;
  private lutReady = false;

  private config: PhysarumConfig = {
    blend: 0, sensorAngle: 30, sensorDistance: 20,
    turnSpeed: 45, decayRate: 0.2, depositAmount: 0.05,
    showTrail: true, trailOpacity: 0.8, trailColour: PHYSARUM_TRAIL_COLOUR_PRESET,
  };

  isActive(): boolean { return this.config.blend > 0; }

  setConfig(cfg: PhysarumConfig): void { this.config = { ...cfg }; }

  /**
   * Upload the resolved trail LUT, or clear it back to the legacy orange — v8 9.3.
   *
   * ⚠️ **`main.ts` is the ONE resolver (`resolvePhysarumTrailLut`) and this method is deliberately DUMB:
   * it takes bytes or null and knows nothing about palettes, ramps, `'(Preset)'` or `'Auto'`.** Invariant
   * 17's rule is that a setting with two sources needs every reader to resolve them in the same order, and
   * the cheapest way to satisfy it is to have exactly ONE reader. A second resolution here — "if Auto, look
   * at the material" — would be that second reader, and this class cannot see the film look or the
   * material at all.
   *
   * `null` releases the LUT and returns the pass to the pre-9.3 expression, which is why `Trail Colour`
   * at `'(Preset)'` is not merely close to the old look but identical to it.
   */
  setTrailLut(lut: Uint8Array | null): void {
    const gl = this.gl;
    if (!gl || !this.lutTex) return;
    if (!lut) { this.lutReady = false; return; }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.lutReady = true;
  }

  resetHeadings(count: number): void {
    this.headings = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Spread initial headings evenly around the circle so particles fan out immediately
      this.headings[i] = (i / count) * Math.PI * 2;
    }
  }

  /**
   * Grow or shrink while KEEPING existing headings (Visual FX "Particle Number").
   *
   * `resetHeadings` would also produce a correctly-sized array — and `senseAndSteer` calls it on any
   * length mismatch, so this is not about avoiding a crash. Headings are integrated state: each is turned
   * by at most `turnSpeed` per frame toward the strongest trail, which is precisely how a particle finds
   * and follows a filament. Re-spreading them evenly around the circle throws every particle off its
   * filament at once, and the network has to re-form from scratch — on every step of a slider drag.
   *
   * The new tail gets the same even spread `resetHeadings` uses, so newcomers still fan out instead of
   * all starting at heading 0.
   */
  resizeHeadings(count: number): void {
    const next = Math.max(0, Math.floor(count));
    if (this.headings.length === next) return;
    const prev = this.headings;
    const out = new Float32Array(next);
    out.set(prev.length <= next ? prev : prev.subarray(0, next));
    for (let i = prev.length; i < next; i++) {
      out[i] = (i / next) * Math.PI * 2;
    }
    this.headings = out;
  }

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    // R32F is not color-renderable in WebGL2 by default — must enable this extension
    const floatExt = gl.getExtension('EXT_color_buffer_float');
    console.log('[Physarum] EXT_color_buffer_float:', floatExt ? 'OK' : 'MISSING — FBO writes will silently fail');
    // 3 textures: deposit (scratch), trailA (read), trailB (write-then-swap)
    this.depositTex = createTrailTexture(gl);
    this.depositFBO = createFBO(gl, this.depositTex);
    this.trailTexA = createTrailTexture(gl);
    this.trailTexB = createTrailTexture(gl);
    this.fboA = createFBO(gl, this.trailTexA);
    this.fboB = createFBO(gl, this.trailTexB);
    // Check FBO completeness
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    console.log('[Physarum] FBO status:', status === gl.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : `INCOMPLETE (${status})`);
    // Clear all three to zero
    for (const fbo of [this.depositFBO, this.fboA, this.fboB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Deposit program
    this.depositProg = compileProgram(gl, DEPOSIT_VS, DEPOSIT_FS, 'Physarum deposit');
    this.depositPointSizeLoc = gl.getUniformLocation(this.depositProg, 'u_pointSize');
    this.depositAmountLoc = gl.getUniformLocation(this.depositProg, 'u_amount');
    this.depositVAO = gl.createVertexArray()!;
    this.depositVBO = gl.createBuffer()!;
    gl.bindVertexArray(this.depositVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depositVBO);
    const posLoc = gl.getAttribLocation(this.depositProg, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Diffuse+decay program
    this.diffuseProg = compileProgram(gl, DIFFUSE_VS, DIFFUSE_FS, 'Physarum diffuse');
    this.diffuseDecayLoc = gl.getUniformLocation(this.diffuseProg, 'u_decay');
    this.diffuseDepositLoc = gl.getUniformLocation(this.diffuseProg, 'u_deposit');
    this.diffuseTrailLoc = gl.getUniformLocation(this.diffuseProg, 'u_trail');
    this.diffuseVAO = this.makeQuadVAO(gl, this.diffuseProg);

    // Overlay program
    this.overlayProg = compileProgram(gl, OVERLAY_VS, OVERLAY_FS, 'Physarum overlay');
    this.overlayOpacityLoc = gl.getUniformLocation(this.overlayProg, 'u_opacity');
    this.overlayTrailLoc = gl.getUniformLocation(this.overlayProg, 'u_trail');
    this.overlayLutLoc = gl.getUniformLocation(this.overlayProg, 'u_lut');
    this.overlayUseLutLoc = gl.getUniformLocation(this.overlayProg, 'u_useLut');
    this.overlayVAO = this.makeQuadVAO(gl, this.overlayProg);

    // v8 9.3 — the trail LUT and its guaranteed-bind fallback.
    //
    // `LINEAR` on S so a 256-entry ramp reads as a gradient rather than as 256 bands across a 512 px
    // network, and `CLAMP_TO_EDGE` on both so the half-texel inset in the shader lands on the true end
    // stops. `lutReady` stays false until something uploads, so the fallback is what is bound on frame 1.
    this.lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Invariant 4: a 1×1 WHITE texture, never `null` — an unassigned sampler can resolve the whole draw
    // black, and white is the value that makes the legacy branch's arithmetic unchanged if it were ever
    // sampled (it is not: `u_useLut` is 0 there, and `mix` discards the ramped operand).
    this.lutFallbackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lutFallbackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.lutReady = false;
  }

  private makeQuadVAO(gl: WebGL2RenderingContext, prog: WebGLProgram): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.depositProg) gl.deleteProgram(this.depositProg);
    if (this.depositVAO) gl.deleteVertexArray(this.depositVAO);
    if (this.depositVBO) gl.deleteBuffer(this.depositVBO);
    if (this.diffuseProg) gl.deleteProgram(this.diffuseProg);
    if (this.diffuseVAO) gl.deleteVertexArray(this.diffuseVAO);
    if (this.overlayProg) gl.deleteProgram(this.overlayProg);
    if (this.overlayVAO) gl.deleteVertexArray(this.overlayVAO);
    if (this.depositFBO) gl.deleteFramebuffer(this.depositFBO);
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.depositTex) gl.deleteTexture(this.depositTex);
    if (this.trailTexA) gl.deleteTexture(this.trailTexA);
    if (this.trailTexB) gl.deleteTexture(this.trailTexB);
    if (this.lutTex) gl.deleteTexture(this.lutTex);
    if (this.lutFallbackTex) gl.deleteTexture(this.lutFallbackTex);
    // Invariant 1: every deleted handle is also NULLED — `init()` is the only thing that reassigns them,
    // and `setTrailLut` tests `lutTex` before uploading. Invariant 3: `lutReady` dies with the texture, or
    // a true flag over a deleted LUT leaves `u_useLut = 1` sampling a dead handle.
    this.lutTex = null;
    this.lutFallbackTex = null;
    this.lutReady = false;
    this.gl = null;
  }

  /**
   * ⚠️ There is deliberately NO `resize()`. Deleted 2026-08-12 (triage H12); do not reinstate it as an
   * obvious missing method — the same regrowth path `deadcheck` already guards for
   * `TranslationMapProcessor.resize()` (G5).
   *
   * **This simulation is resolution-independent by construction.** `TRAIL_SIZE` is a module constant
   * baked into every `texImage2D` above *and* into the shader sources, `init()` takes only `(gl)`, and no
   * field on this class derives from the canvas — `renderOverlay(gl, targetFBO, width, height)` receives
   * the target dimensions per call and uses them solely for `gl.viewport`, restoring the saved viewport
   * afterwards. Sensing and deposit are model-space/UV; `updateTrail()` takes normalised UVs.
   *
   * So the old body — `dispose(); init(gl);` — rebuilt 3 programs, 3 textures, 3 FBOs, 3 VAOs and a
   * buffer to produce a byte-identical simulation. Under H11 that ran TWICE per Lab panel toggle
   * (`setPanelMode` calls `resizeAll()` immediately and again from a 350 ms `setTimeout` chasing the CSS
   * `grid-template-columns` transition).
   *
   * One deliberate behaviour change: the old rebuild also CLEARED the trail field, so every physarum
   * filament vanished on a window resize or panel toggle and had to re-grow from scratch — the trail is
   * the whole point of the simulation, and it is accumulated over hundreds of frames. It now survives.
   */

  // T004: deposit + diffuse+decay pass
  updateTrail(particleUVs: Float32Array, count: number): void {
    const gl = this.gl;
    if (!gl || !this.isActive()) return;

    const cfg = this.config;
    const savedVP = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    gl.viewport(0, 0, TRAIL_SIZE, TRAIL_SIZE);
    gl.disable(gl.DEPTH_TEST);

    // --- Deposit pass: render particles as point sprites into depositFBO (cleared each frame) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depositFBO);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.depositProg);
    gl.uniform1f(this.depositPointSizeLoc, 1.0);
    gl.uniform1f(this.depositAmountLoc, cfg.depositAmount);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.bindVertexArray(this.depositVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depositVBO);
    gl.bufferData(gl.ARRAY_BUFFER, particleUVs.subarray(0, count * 2), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    // --- Diffuse+decay pass ---
    // Reads: depositTex (fresh sprites) + trailTexA (accumulated trail)
    // Writes: trailTexB (new accumulated trail)
    // Then swap A↔B so trailTexA is always the authoritative read source.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
    gl.useProgram(this.diffuseProg);
    gl.uniform1f(this.diffuseDecayLoc, cfg.decayRate);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.depositTex);
    gl.uniform1i(this.diffuseDepositLoc, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTexA);
    gl.uniform1i(this.diffuseTrailLoc, 1);
    gl.bindVertexArray(this.diffuseVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    // Swap: fboB/trailTexB is now the new accumulated trail — promote it to A
    [this.trailTexA, this.trailTexB] = [this.trailTexB!, this.trailTexA!];
    [this.fboA, this.fboB] = [this.fboB!, this.fboA!];

    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    gl.viewport(savedVP[0]!, savedVP[1]!, savedVP[2]!, savedVP[3]!);
    // The diffuse pass above leaves `activeTexture` on unit 1. Restore it: this method saves and
    // restores the viewport and framebuffer but did not save the texture unit, so it was the one piece
    // of global state it silently mutated. Defensive today — every consumer downstream selects its own
    // unit — but this runs mid-frame from `lissajous.ts update()`, i.e. deep inside the generator step
    // rather than in a post-processing chain, so the set of things that follow it is wide.
    gl.activeTexture(gl.TEXTURE0);

    // T005: readback every 4 frames
    this.readbackFrame++;
    if (this.readbackFrame % 4 === 0) {
      this.readbackTrail(gl);
    }
  }

  // T005: read trail texture back to CPU
  private readbackTrail(gl: WebGL2RenderingContext): void {
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    // WebGL2 only guarantees RGBA+FLOAT readback from float FBOs, not RED+FLOAT
    gl.readPixels(0, 0, TRAIL_SIZE, TRAIL_SIZE, gl.RGBA, gl.FLOAT, this.readbackBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    // A debug block used to live here, walking the entire 1 M-float readback buffer every 240th
    // readback purely to `console.log` one maximum. Removed 2026-08-12 (triage H3) — see the matching
    // note in `fluid-advection.ts`.
  }

  // T005: sample readback buffer bilinearly (stride 4 — RGBA readback, red channel only)
  private sampleTrail(u: number, v: number): number {
    const x = Math.max(0, Math.min(TRAIL_SIZE - 1, u * TRAIL_SIZE));
    const y = Math.max(0, Math.min(TRAIL_SIZE - 1, v * TRAIL_SIZE));
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const x1 = Math.min(xi + 1, TRAIL_SIZE - 1);
    const y1 = Math.min(yi + 1, TRAIL_SIZE - 1);
    const a = this.readbackBuf[(yi * TRAIL_SIZE + xi) * 4]!;
    const b = this.readbackBuf[(yi * TRAIL_SIZE + x1) * 4]!;
    const c = this.readbackBuf[(y1 * TRAIL_SIZE + xi) * 4]!;
    const d = this.readbackBuf[(y1 * TRAIL_SIZE + x1) * 4]!;
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  // T005: CPU sensing — returns per-particle position deltas (dU, dV) in UV space
  senseAndSteer(positions: Float32Array, count: number): Float32Array {
    const deltas = new Float32Array(count * 2);
    const cfg = this.config;
    if (!this.isActive()) return deltas;

    // Ensure heading array is sized for current count
    if (this.headings.length !== count) this.resetHeadings(count);

    const angleRad = (cfg.sensorAngle * Math.PI) / 180;
    const turnRad = (cfg.turnSpeed * Math.PI) / 180;
    const dist = cfg.sensorDistance / TRAIL_SIZE;
    const step = dist * cfg.blend;

    for (let i = 0; i < count; i++) {
      const u = positions[i * 2]!;
      const v = positions[i * 2 + 1]!;
      const heading = this.headings[i]!;

      const hx = Math.cos(heading);
      const hy = Math.sin(heading);

      // Three sensor probes at sensorDistance ahead
      const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
      const fwdU = u + hx * dist;
      const fwdV = v + hy * dist;
      const leftU = u + (hx * cosA - hy * sinA) * dist;
      const leftV = v + (hx * sinA + hy * cosA) * dist;
      const rightU = u + (hx * cosA + hy * sinA) * dist;
      const rightV = v + (-hx * sinA + hy * cosA) * dist;

      const fwd = this.sampleTrail(fwdU, fwdV);
      const left = this.sampleTrail(leftU, leftV);
      const right = this.sampleTrail(rightU, rightV);

      // A per-particle debug log for particle 0 used to sit here, firing every 300th readback frame.
      // Removed 2026-08-12 (triage H3). Cheap in itself — the `i === 0` short-circuits — but it is
      // CONTINUOUS rather than one-shot, so it was a third offender H3's tally of "two catastrophic,
      // fifteen one-shot" did not account for.
      // Turn toward highest concentration; update persistent heading
      let newHeading = heading;
      if (left > fwd && left > right) {
        newHeading = heading - turnRad;
      } else if (right > fwd && right > left) {
        newHeading = heading + turnRad;
      } else if (left > right) {
        newHeading = heading - turnRad * 0.5;
      } else if (right > left) {
        newHeading = heading + turnRad * 0.5;
      }
      this.headings[i] = newHeading;

      // Move one step in the new heading direction
      deltas[i * 2]     = Math.cos(newHeading) * step;
      deltas[i * 2 + 1] = Math.sin(newHeading) * step;
    }
    return deltas;
  }

  // T006: render trail overlay onto the current bound framebuffer
  renderOverlay(gl: WebGL2RenderingContext, targetFBO: WebGLFramebuffer | null, width: number, height: number): void {
    if (!this.isActive() || !this.config.showTrail) return;
    if (!this.overlayProg || !this.overlayVAO || !this.trailTexA) return;

    const savedVP = gl.getParameter(gl.VIEWPORT) as Int32Array;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.overlayProg);
    gl.uniform1f(this.overlayOpacityLoc, this.config.trailOpacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTexA);
    gl.uniform1i(this.overlayTrailLoc, 0);
    // v8 9.3 — invariant 4: unit 1 is assigned UNCONDITIONALLY and always has a texture bound, the 1×1
    // fallback when no LUT has been uploaded. `u_useLut` is likewise always written, so a stale 1 from a
    // previous configuration cannot survive a return to `'(Preset)'`.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutReady ? this.lutTex : this.lutFallbackTex);
    gl.uniform1i(this.overlayLutLoc, 1);
    gl.uniform1f(this.overlayUseLutLoc, this.lutReady ? 1 : 0);
    // Invariant 4's second half: restore unit 0 before leaving, or the next pass's single-sampler bind
    // lands on unit 1 and reads this LUT as its own input.
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    // ⚠️ **Invariant 9: the shader premultiplies (`tint * alpha`), so this MUST be `ONE`, not `SRC_ALPHA`.**
    // It was `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` against a NON-premultiplied `vec4(alpha, alpha*0.65, ...)`,
    // which is the same pairing — the old colour was already `orange * alpha` written into rgb, so the
    // hardware's second multiply by `SRC_ALPHA` applied opacity TWICE. Writing `tint * alpha` and blending
    // with `ONE` reproduces the intended single application; **the change is only correct as a PAIR, and
    // reverting either half alone re-introduces the defect in one direction or the other.**
    //
    // ⚠️ **This is a deliberate, visible change to the pre-9.3 look and the ONE thing here that is not
    // byte-identical.** At `trailOpacity` 0.8 the old pass reached the screen at 0.64 of its nominal
    // strength, and the loss was density-dependent (it distorted the falloff, not just the level), which is
    // exactly invariant 9's signature — found twice before, five sittings apart. **Judge it on a
    // low-accumulation preset; the trail will read slightly stronger and its fringes further out.**
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.overlayVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.viewport(savedVP[0]!, savedVP[1]!, savedVP[2]!, savedVP[3]!);
  }
}
