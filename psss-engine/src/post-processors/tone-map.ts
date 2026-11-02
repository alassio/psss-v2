import { compileProgram } from '../core/gl-program.ts';

export interface ToneMapConfig {
  enabled: boolean;
  curve: 'none' | 'aces' | 'reinhard';
  exposure: number;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  saturation: number;
  vignette: number;
}

export class ToneMapProcessor {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private enabled = false;
  private width = 0;
  private height = 0;

  private curve: 'none' | 'aces' | 'reinhard' = 'none';
  private exposure = 1.0;
  private lift: [number, number, number] = [0, 0, 0];
  private gamma: [number, number, number] = [1, 1, 1];
  private gain: [number, number, number] = [1, 1, 1];
  private saturation = 1.0;
  private vignette = 0.0;

  // Uniform locations, resolved once in `init()`. `apply()` queried all nine on every frame; a
  // location is a property of the linked program and cannot change while the program lives, so the
  // repeat lookups were pure per-frame overhead (triage H6). `setParams` mutates the VALUES these are
  // uploaded from, never the program, so it does not invalidate them — and a `toneMapEnabled`/
  // `toneMapCurve` change goes through dispose+init (see `applyCustomParam`), which re-resolves them.
  private uInput: WebGLUniformLocation | null = null;
  private uCurve: WebGLUniformLocation | null = null;
  private uExposure: WebGLUniformLocation | null = null;
  private uLift: WebGLUniformLocation | null = null;
  private uGamma: WebGLUniformLocation | null = null;
  private uGain: WebGLUniformLocation | null = null;
  private uSaturation: WebGLUniformLocation | null = null;
  private uVignette: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;

  init(gl: WebGL2RenderingContext, config: ToneMapConfig): void {
    this.gl = gl;
    this.enabled = config.enabled;
    this.curve = config.curve;
    this.exposure = config.exposure;
    this.lift = config.lift;
    this.gamma = config.gamma;
    this.gain = config.gain;
    this.saturation = config.saturation ?? 1.0;
    this.vignette = config.vignette ?? 0.0;

    if (!config.enabled) return;

    this.program = compileProgram(gl, QUAD_VERT, TONEMAP_FRAG, 'ToneMap');
    this.quadVao = this.createQuad(gl);

    this.uInput = gl.getUniformLocation(this.program, 'uInput');
    this.uCurve = gl.getUniformLocation(this.program, 'uCurve');
    this.uExposure = gl.getUniformLocation(this.program, 'uExposure');
    this.uLift = gl.getUniformLocation(this.program, 'uLift');
    this.uGamma = gl.getUniformLocation(this.program, 'uGamma');
    this.uGain = gl.getUniformLocation(this.program, 'uGain');
    this.uSaturation = gl.getUniformLocation(this.program, 'uSaturation');
    this.uVignette = gl.getUniformLocation(this.program, 'uVignette');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  apply(inputTex: WebGLTexture, outputFBO: WebGLFramebuffer | null): void {
    const gl = this.gl;
    if (!gl || !this.enabled || !this.program) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(this.uInput, 0);

    gl.uniform1i(this.uCurve, this.curve === 'aces' ? 1 : this.curve === 'reinhard' ? 2 : 0);
    gl.uniform1f(this.uExposure, this.exposure);
    gl.uniform3f(this.uLift, ...this.lift);
    gl.uniform3f(this.uGamma, ...this.gamma);
    gl.uniform3f(this.uGain, ...this.gain);
    gl.uniform1f(this.uSaturation, this.saturation);
    gl.uniform1f(this.uVignette, this.vignette);
    gl.uniform2f(this.uResolution, this.width, this.height);

    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setParams(config: Partial<ToneMapConfig>): void {
    if (config.curve !== undefined) this.curve = config.curve;
    if (config.exposure !== undefined) this.exposure = config.exposure;
    if (config.lift !== undefined) this.lift = config.lift;
    if (config.gamma !== undefined) this.gamma = config.gamma;
    if (config.gain !== undefined) this.gain = config.gain;
    if (config.saturation !== undefined) this.saturation = config.saturation;
    if (config.vignette !== undefined) this.vignette = config.vignette;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
  }

  private createQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

}

const QUAD_VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const TONEMAP_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uInput;
uniform int uCurve;
uniform float uExposure;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uVignette;
uniform vec2 uResolution;

in vec2 vUv;
out vec4 fragColor;

/*
 * Phase 27.1 — the FITTED ACES curve, replacing the single-rational approximation that was here.
 *
 * Originally written by Stephen Hill (@self_shadow), taken from MJP and David Neubelt's Baking Lab
 * (BakingLab/ACES.hlsl, MIT licence) — the published source, fetched rather than recalled, because
 * 27.D9 forbids typing a matrix constant from memory into this codebase.
 *
 * ⚠️ **THE MATRICES ARE TRANSPOSED RELATIVE TO THE PUBLISHED HLSL AND THAT IS NOT OPTIONAL.** HLSL's
 * float3x3 initialiser fills ROWS and mul(M, v) is row-dot-vector; GLSL's mat3 initialiser fills
 * COLUMNS and M * v is column-combination. Writing the published rows straight into mat3(...)
 * therefore applies the TRANSPOSE of the intended matrix — a silent, plausible-looking colour shift
 * with no error anywhere. Each mat3 below is written COLUMN BY COLUMN.
 *
 * ⚠️ **27.D10: THE INPUT IS GUARDED, AND THE OLD OUTPUT CLAMP COULD NOT DO THIS JOB.** Any rational
 * fit is Inf/Inf = NaN at infinity, and the previous clamp ran AFTER the division, so it could not
 * recover one. CLAUDE.md records this path as unreachable by sanitiseTrail(), i.e. unguarded.
 * The clamp below handles Inf (clamp(Inf, 0, C) == C); NaN needs the select above it.
 *
 * ⚠️ **A NaN CANNOT BE FOUND BY COMPARISON, AND THE SELECT MUST BE THE bvec OVERLOAD** — invariant 20
 * and gl-program.ts's note: !(x == x) written as an explicit not(equal()) pair is the portable
 * test (isnan() is permitted to be unreliable where the compiler assumes finite math), and
 * mix(a, b, bvec3) SELECTS whereas mix(a, b, vec3(bvec3)) ARITHMETICALLY BLENDS and is a no-op for
 * NaN. The second spelling is the 2026-08-23 black-frame root cause.
 *
 * ⚠️ The denominator cannot vanish for any real input: its discriminant is negative
 * (0.432951² − 4·0.983729·0.238081 < 0), so b > 0 everywhere. The only hazard was non-finite input.
 */
const float ACES_IN_CEIL = 1.0e4;   // far above anything the curve resolves; finite, which is the point

/*
 * 2026-10-21 — **THE EXPOSURE THE NARKOWICZ FIT BAKED IN, CARRIED ACROSS. 27.1 REPLACED THE CURVE AND
 * DROPPED IT, AND THAT COST THE WHOLE ACES LIBRARY ABOUT ONE STOP.**
 *
 * ⚠️ **THIS IS NOT A TASTE KNOB AND IT IS NOT A SECOND uExposure.** The single-rational curve 27.1
 * removed was Narkowicz's, which is a fit to ACES *with an input gain already folded into its
 * coefficients*. Hill's rrtAndOdtFit is the curve alone. Swapping one for the other therefore changes
 * the TRANSFER as well as the shape, and every preset in the library was authored against the transfer.
 * The two curves differ by this one factor and by nothing else that a gain can express.
 *
 * ⚠️ **MEASURED, NOT RECALLED — 27.D9's rule applies to this constant too.** Fitted over
 * x in [0.005, 8] by least squares on 8-bit output codes: the optimum is 2.005, and 2.0 is used because
 * it is indistinguishable from it (full-range RMS 1.21 vs 1.20 codes) and because a round number cannot be
 * mistaken for a measurement of something else. Against the pre-27.1 response on neutrals: **RMS 1.21,
 * worst case 3.28 of 255 codes.** Do not re-derive it from a remembered figure; 1.8 is the tempting
 * near-miss and measures 5.17 RMS / 9.39 worst.
 *
 * ⚠️ **IT RESTORES LUMINANCE, NOT CHROMA, AND THAT ASYMMETRY IS THE POINT OF KEEPING 27.1.** The RRT's
 * per-channel desaturation of bright saturated colour is real colour science that no scalar gain can
 * reproduce — at k = 2 a saturated sweep still differs from the old curve by up to 94 codes in one
 * channel. **That residual is 27.1's intended contribution; the stop was not.** Judging this constant on a
 * saturated hue therefore measures the wrong quantity — calibrate it on NEUTRALS.
 *
 * ⚠️ **THE DEFECT SURFACED ON THE DYE AND THAT IS A PROPERTY OF WHERE EACH SIGNAL SITS ON THE CURVE, NOT
 * OF THE DYE.** A splat core clips (x ≳ 2) and lost 6–17 %, i.e. nothing a user can see. The dye wake is
 * 1 - exp(-a * DYE_SATURATION_K), so its whole range is x ≈ 0.01–0.4, where the loss was 58–80 % — and
 * the fitted toe goes NEGATIVE below AP1 linear 0.00325, so at exposure 1.4 the skirt needed 2.4x more
 * signal just to light a single code. **The owner read a lost stop in the toe as the dye field having
 * become SMALLER**, which is CLAUDE.md's own rule: judge a grading change on a LOW-ACCUMULATION signal and
 * measure the final 8-bit output. The dye range recovers to RMS 0.44 codes.
 *
 * ⚠️ **AND THE "SMALLER" IS A BAND, NOT AN EXTINCTION — measured off the real frame, which is why the
 * threshold figure above is not the whole story.** On Dye Wake at 1440x900 the LIT fraction barely moved
 * (57.0 % -> 57.6 %); what moved was mean luminance, 25.29 -> 52.73 of 255. The skirt was not clamped away,
 * it was sitting in codes **1–15**, which reads as black on any real display: that band fell from 4.9 % of
 * the frame to 2.0 % as those pixels rose OUT of it. **A lit-pixel count is therefore the wrong instrument
 * for this defect and would have exonerated the curve** — the discriminating measurement is the histogram's
 * low band, not the coverage.
 *
 * ⚠️ **AFTER THE NaN SELECT AND BEFORE THE CEILING, both deliberately.** NaN * 2.0 is NaN, so the
 * select must precede it; and applying the gain before the clamp keeps ACES_IN_CEIL the single true bound
 * on what the matrices ever see, which is what 27.D10 guarantees.
 */
const float ACES_EXPOSURE_BIAS = 2.0;

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT   (columns, see the transpose note)
const mat3 ACES_IN_MAT = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777);

// ODT_SAT => XYZ => D60_2_D65 => sRGB   (columns, see the transpose note)
const mat3 ACES_OUT_MAT = mat3(
   1.60475, -0.10208, -0.00327,
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602);

vec3 rrtAndOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 acesToneMap(vec3 x) {
  x = mix(x, vec3(0.0), not(equal(x, x)));   // NaN -> 0 by SELECT; see the header
  x = x * ACES_EXPOSURE_BIAS;                // the stop 27.1 dropped; see that constant's header
  x = clamp(x, 0.0, ACES_IN_CEIL);           // and this catches Inf
  x = ACES_IN_MAT * x;
  x = rrtAndOdtFit(x);
  x = ACES_OUT_MAT * x;
  return clamp(x, 0.0, 1.0);
}

vec3 reinhardToneMap(vec3 x) {
  return x / (1.0 + x);
}

vec3 liftGammaGain(vec3 c, vec3 lift, vec3 gamma, vec3 gain) {
  vec3 lifted = c * gain + lift;
  return pow(max(lifted, vec3(0.0)), 1.0 / gamma);
}

void main() {
  vec3 hdr = texture(uInput, vUv).rgb;

  // Exposure
  hdr *= uExposure;

  // Tone mapping
  vec3 mapped;
  if (uCurve == 1) {
    mapped = acesToneMap(hdr);
  } else if (uCurve == 2) {
    mapped = reinhardToneMap(hdr);
  } else {
    mapped = clamp(hdr, 0.0, 1.0);
  }

  // Lift/Gamma/Gain colour grading
  mapped = liftGammaGain(mapped, uLift, uGamma, uGain);

  // Saturation
  float lum = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(vec3(lum), mapped, uSaturation);

  // Vignette
  if (uVignette > 0.0) {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 1.414;
    float vig = 1.0 - uVignette * dist * dist;
    mapped *= max(vig, 0.0);
  }

  fragColor = vec4(mapped, 1.0);
}`;
