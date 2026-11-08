import { compileProgram } from '../core/gl-program.ts';
import { GLSL_SIMPLEX3D_CURL2D } from '../core/glsl-noise.ts';
import { STATIC_FIELD_TARGET_FRACTION } from './static-field.ts';

/**
 * @file v8 Phase 40 — **Electric Discharge**: crackling, forking filaments of light around the figure.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * WHERE THE LOOK COMES FROM, AND WHY THIS IS ITS OWN PASS
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Found by the owner on `Quader Star Eight`: a TransMap **Density Refraction** layer with **Invert** on, over a
 * short trail. Refraction is a feedback warp along the gradient of the trail's own coverage; Invert pulls light
 * TOWARD density, which is diffusion run backwards — unstable, it keeps collapsing light into thin filaments —
 * and the short trail erases them every frame, so they form, snap and re-form. That is the crackle.
 *
 * ⚠️⚠️ **This pass reproduces that mechanism on a BUFFER OF ITS OWN** (owner, Phase 40, ideas 1 + 2 + 3 + 4):
 *   - the figure's image is DEPOSITED into the discharge buffer each frame and never read back into the trail,
 *     so a preset's own trail, TransMap and decay behave exactly as before, and the effect works on any preset
 *     whatever its trail length;
 *   - the buffer is warped by the SAME soft-normalised, resolution-independent inverted gradient as style 7
 *     (`trans-map.ts`' `refractOffset`), toward its own coverage, and fades by a decay of its own;
 *   - **Crackle** sets that decay and a per-frame jitter of where the gradient is sampled, so a slow figure keeps
 *     flickering instead of freezing into a fixed pattern;
 *   - **Branching** bends the pull with a drifting curl-noise field, so filaments fork and wander instead of
 *     hugging the figure's edges;
 *   - the buffer REPLACES the image before Bloom — it does not sit on top of it.
 *
 * ⚠️⚠️ **REPLACE, NOT ADD — measured, and the first build got it wrong.** It added a pinched copy over the untouched
 * figure, and the result was a smooth glowing line with NO crackle (`p56-shots/Quader-Star-Eight-sheet.png`, row C
 * against the original in row B): the original's warp REPLACES the image, and the crackle is the halo itself being
 * torn into filaments. So the buffer is fed ENERGY-NEUTRALLY — `new = decay·warp(prev) + (1 − decay)·figure`, which
 * settles to exactly the figure when nothing pulls — and the image shown is the buffer.
 *
 * ⚠️⚠️ **OFF IS A BRANCH, NOT A WEIGHT**: `main.ts` calls `apply()` only while the section is enabled, and a
 * disabled frame does not touch `presentSource` — every preset without the effect is bitwise what it was.
 * ⚠️ Branching 0 is a branch inside the shader too, so the noise costs nothing until it is asked for.
 */

/** Crackle 0 → this decay (calm, long-lived filaments); Crackle 1 → `DECAY_VIOLENT`. */
const DECAY_CALM = 0.9;
const DECAY_VIOLENT = 0.5;
/** The curl field's spatial frequency (per min(w,h)) and drift rate (per second) for Branching. */
const BRANCH_SCALE = 6.0;
const BRANCH_RATE = 0.35;

/**
 * The engine default for every key a preset does not author — and therefore each key's Mixer IDENTITY
 * (`SCALAR_IDENTITIES` must equal the `?? default` every apply site reads).
 *
 * ⚠️ **MEASURED, not copied from Star Eight's TransMap numbers.** Those (0.9 / 2.7 / decay 0.606) gave a smooth
 * glowing line here, because this pass feeds the warp the preset's already-glowing trail rather than raw
 * particles; at 1.375 / 1.5 / 0.875 the strokes fracture into the original's sparkle (`p56-shots`, the
 * `1.5_1.5_1_0` sheet against row B). Every value sits on its row's power-of-two step.
 */
export const DISCHARGE_DEFAULTS = { intensity: 1.375, filament: 1.5, crackle: 0.875, branching: 0 } as const;
/** The rows' ranges, each a whole number of its row's power-of-two step. */
export const DISCHARGE_RANGES = {
  intensity: [0, 2], filament: [0.5, 8], crackle: [0, 1], branching: [0, 1],
} as const;

/** The live settings, already clamped by the caller's ranges. */
export interface DischargeSettings {
  /** Strength of the pull toward density, like a refraction layer's strength (0..2). */
  intensity: number;
  /** Gradient reach in pixels: fine (0.5) to thick filaments (8). */
  filament: number;
  /** 0 calm … 1 violent: the buffer's decay and the per-frame sampling jitter. */
  crackle: number;
  /** 0 = filaments hug the figure; up to 1 = they fork and wander along a drifting curl field. */
  branching: number;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/*
 * The UPDATE pass: newD = WARP( decay * prevD + deposit * figure ) — the warp acts on the COMBINED image.
 *
 * ⚠️⚠️ **The order is the effect, and the second build had it wrong.** `decay * warp(prev) + figure` lays the fresh
 * light down UNWARPED on top, and that smooth layer is what kept the halo intact (`p56-shots`). The original
 * frame order is `trail = warp(decay * trail + particles)`, so the fresh light is torn up in the frame it arrives
 * in. So: the pull is computed from the gradient of the BLEND's coverage, and both inputs are sampled at the
 * displaced position. The pull is style 7's inverted refraction offset; Crackle jitters where the gradient is
 * sampled, Branching bends it with a curl field.
 */
const UPDATE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform sampler2D uFigure;
uniform vec2 uResolution;
uniform float uGain;
uniform float uReach;
uniform vec2 uJitter;
uniform float uDecay;
uniform float uDeposit;
uniform float uBranch;
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;
${GLSL_SIMPLEX3D_CURL2D}
// Coverage of the pre-warp blend, the height the pull climbs.
float blendA(vec2 uv) { return texture(uPrev, uv).a * uDecay + texture(uFigure, uv).a * uDeposit; }
void main() {
  vec2 texel = uReach / uResolution;
  vec2 c = vUv + uJitter / uResolution;
  float hL = blendA(c - vec2(texel.x, 0.0));
  float hR = blendA(c + vec2(texel.x, 0.0));
  float hD = blendA(c - vec2(0.0, texel.y));
  float hU = blendA(c + vec2(0.0, texel.y));
  // Style 7's slope: a central difference over 2*reach is divided by the span, then SOFT-normalised.
  vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * uReach);
  float m = length(grad);
  vec2 pullPx = vec2(0.0);
  // Points UPHILL, toward denser light: Invert's sense (trans-map.ts refractOffset with uRefractInvert = -1).
  if (m > 0.0) pullPx = (grad / m) * (m / (1.0 + m)) * uGain;
  if (uBranch > 0.0) {
    // ISOTROPIC domain (invariant 26): pixels / min(w,h) on both axes, so the forks are not stretched at 16:9.
    float minDim = max(min(uResolution.x, uResolution.y), 1.0);
    vec2 q = vUv * (uResolution / minDim);
    vec2 curl = curl2D(vec3(q * ${BRANCH_SCALE.toFixed(1)}, uTime * ${BRANCH_RATE.toFixed(2)}));
    float cl = length(curl);
    // The curl's magnitude varies by orders across the field, so only its DIRECTION is used, scaled to the pull.
    if (cl > 0.0) pullPx += (curl / cl) * uBranch * uGain * (m / (1.0 + m) + 0.05);
  }
  vec2 src = vUv + pullPx / uResolution;
  vec4 d = texture(uPrev, src) * uDecay + texture(uFigure, src) * uDeposit;
  // Guard the feedback loop: a non-finite value would persist for the life of the buffer (invariant 20 — a
  // boolean select, not a mix, because mix() keeps a NaN).
  bvec4 bad = bvec4(isnan(d.x) || isinf(d.x), isnan(d.y) || isinf(d.y), isnan(d.z) || isinf(d.z),
    isnan(d.w) || isinf(d.w));
  fragColor = vec4(bad.x ? 0.0 : d.x, bad.y ? 0.0 : d.y, bad.z ? 0.0 : d.z, bad.w ? 0.0 : d.w);
}`;

/**
 * The COMPOSITE pass: the discharge buffer REPLACES the image (pre-Bloom, linear HDR) — see the file header.
 * ⚠️ Kept as its own pass rather than reading the buffer directly, so the returned texture is never the one the
 * next frame's update reads from (a read-after-write hazard inside one frame).
 */
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uDischarge;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = texture(uDischarge, vUv);
}`;

/** One ping-pong target. */
interface Target { tex: WebGLTexture; fbo: WebGLFramebuffer }

export class ElectricDischarge {
  private gl: WebGL2RenderingContext | null = null;
  private update: WebGLProgram | null = null;
  private composite: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private quadBuf: WebGLBuffer | null = null;
  private ping: Target | null = null;
  private pong: Target | null = null;
  private out: Target | null = null;
  private width = 0;
  private height = 0;
  /** Deterministic jitter sequence (invariant 12's spirit: never `Math.random()` in a render path). */
  private frame = 0;
  private u: Record<string, WebGLUniformLocation | null> = {};

  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.update = compileProgram(gl, VERT, UPDATE_FRAG, 'ElectricDischarge.update');
    this.composite = compileProgram(gl, VERT, COMPOSITE_FRAG, 'ElectricDischarge.composite');
    for (const n of ['uPrev', 'uFigure', 'uResolution', 'uGain', 'uReach', 'uJitter', 'uDecay', 'uDeposit',
      'uBranch', 'uTime']) this.u[`u:${n}`] = gl.getUniformLocation(this.update, n);
    this.u['c:uDischarge'] = gl.getUniformLocation(this.composite, 'uDischarge');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    // ⚠️ ONE VAO serves BOTH programs, so `aPos` is wired at EACH program's own location — equal in practice
    // (one attribute each), but a shared VAO that assumed it would draw nothing if a driver ever assigned them
    // differently.
    for (const p of [this.update, this.composite]) {
      const loc = gl.getAttribLocation(p, 'aPos');
      if (loc < 0) continue;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
  }

  /** Forget the buffer's contents (a preset change, or the section being switched on again). */
  reset(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const t of [this.ping, this.pong]) {
      if (!t) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private makeTarget(w: number, h: number): Target | null {
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // Invariant 5: an incomplete FBO renders nothing and logs nothing — test it, and refuse to run on one.
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (!ok) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); return null; }
    return { tex, fbo };
  }

  private freeTargets(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const t of [this.ping, this.pong, this.out]) {
      if (!t) continue;
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    this.ping = null; this.pong = null; this.out = null;
    this.width = 0; this.height = 0;
  }

  /** (Re)allocate the three targets at the canvas size; a size change also clears the discharge. */
  private ensureSize(w: number, h: number): boolean {
    if (this.ping && this.pong && this.out && w === this.width && h === this.height) return true;
    this.freeTargets();
    const a = this.makeTarget(w, h), b = this.makeTarget(w, h), o = this.makeTarget(w, h);
    if (!a || !b || !o) {
      for (const t of [a, b, o]) if (t) { this.gl!.deleteFramebuffer(t.fbo); this.gl!.deleteTexture(t.tex); }
      return false;
    }
    this.ping = a; this.pong = b; this.out = o;
    this.width = w; this.height = h;
    this.reset();
    return true;
  }

  /**
   * Advance the discharge one frame from `figure` and return the image with it added on top. On any failure
   * (an incomplete FBO) the input is returned unchanged — a degraded effect, never a black frame.
   */
  apply(figure: WebGLTexture, w: number, h: number, s: DischargeSettings, timeSec: number): WebGLTexture {
    const gl = this.gl;
    if (!gl || !this.update || !this.composite || !this.vao) return figure;
    if (!this.ensureSize(w, h)) return figure;
    const prev = this.ping!, next = this.pong!, out = this.out!;

    // Crackle → decay and jitter. The jitter is a deterministic low-discrepancy walk (golden-angle), so two runs
    // of the same session crackle identically and nothing in a render path calls Math.random().
    this.frame++;
    const crackle = Math.min(1, Math.max(0, s.crackle));
    const ang = this.frame * 2.399963229728653;
    const jr = crackle * s.filament * (0.5 + 0.5 * ((this.frame * 0.618034) % 1));

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);

    // --- update: prev → next
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.useProgram(this.update);
    // Invariant 4: every sampler gets its unit, every unit a texture, and unit 0 is restored afterwards.
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, figure);
    gl.uniform1i(this.u['u:uPrev']!, 0);
    gl.uniform1i(this.u['u:uFigure']!, 1);
    gl.uniform2f(this.u['u:uResolution']!, w, h);
    gl.uniform1f(this.u['u:uGain']!, s.intensity * STATIC_FIELD_TARGET_FRACTION * Math.min(w, h));
    gl.uniform1f(this.u['u:uReach']!, Math.max(0.25, s.filament));
    gl.uniform2f(this.u['u:uJitter']!, Math.cos(ang) * jr, Math.sin(ang) * jr);
    const decay = DECAY_CALM + (DECAY_VIOLENT - DECAY_CALM) * crackle;
    gl.uniform1f(this.u['u:uDecay']!, decay);
    // ENERGY-NEUTRAL: what fades is replaced by the figure, so with no pull the buffer settles to the figure itself.
    gl.uniform1f(this.u['u:uDeposit']!, 1 - decay);
    gl.uniform1f(this.u['u:uBranch']!, Math.min(1, Math.max(0, s.branching)));
    gl.uniform1f(this.u['u:uTime']!, timeSec);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- composite: next → out (the buffer replaces the image)
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.useProgram(this.composite);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, next.tex);
    gl.uniform1i(this.u['c:uDischarge']!, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    // Swap: the buffer just written is next frame's `prev`.
    this.ping = next; this.pong = prev;
    return out.tex;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    this.freeTargets();
    if (this.update) gl.deleteProgram(this.update);
    if (this.composite) gl.deleteProgram(this.composite);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.quadBuf) gl.deleteBuffer(this.quadBuf);
    // Invariant 1: null every deleted handle; the uniform locations die with their programs.
    this.update = null; this.composite = null; this.vao = null; this.quadBuf = null;
    this.u = {};
    this.gl = null;
  }
}
