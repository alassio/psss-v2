import type { DyeFieldConfig } from '../presets/types.ts';
import { compileProgram } from '../core/gl-program.ts';
// v8 28.1. ⚠️ **`DYE_HUE_GLSL` IS IMPORTED, NEVER RETYPED (28.D10)** — the quotient now has a fourth
// reader, in this file, and a second spelling across a module boundary is invisible to every compiler
// and to any grep over one file. `DYE_SATURATION_K` is the same constant the in-surface wake uploads,
// which is what makes the two paths agree on density rather than merely look similar.
import { DYE_HUE_GLSL, DYE_SATURATION_K } from '../renderers/liquid-reference.ts';

/**
 * v8 Step 15.7 (E90) — **the advected dye field: colour that is INDEPENDENT of the particles.**
 *
 * A particle deposits colour into a persistent field; the field is then pushed around by the same velocity
 * field the figure stirs (`FluidAdvectionProcessor`) and decays. So a streak of red keeps swirling *after*
 * the particle that laid it down has moved on — which is the one thing 15.2's per-particle colour structurally
 * cannot do, its colour being bound to live particles by construction.
 *
 * ## ⚠️ THIS IS A REBUILD OF A DELETED SUBSYSTEM, AND THE DELETION'S TERMS ARE NOT OPTIONAL
 *
 * Triage **G14** deleted the previous dye field on 2026-08-12: `injectDye`, `advectDye` and `renderDyeOverlay`
 * lived in `fluid-advection.ts` with **ZERO callers anywhere in `src/`**, so no dye was ever injected, advected
 * or composited — while ticking `Enable` really did allocate **13 GL objects** to draw nothing. Its own note
 * set the terms for any rebuild: *"build it as its own render pass with its calls in the frame loop from the
 * first commit, not as dormant methods."* Both halves are honoured here:
 *
 * - **Its own file, not a fifth concern inside `fluid-advection.ts`.** That file is 592 lines and already owns
 *   the velocity sim, the CPU readback, the particle advection and the splat path; the deleted dye code was
 *   invisible precisely because it sat among four live subsystems that all looked alike.
 * - **`step()` and `inject()` are called from `main.ts`'s frame loop in the same commit that adds them**, and
 *   `isActive()` gates allocation as well as drawing — see `ensureResources()`.
 *
 * ⚠️ **AND THE LATENT BUG THAT WENT WITH IT IS DESIGNED OUT RATHER THAN FIXED.** The old version would have
 * died on the first window resize: `FluidAdvectionProcessor.resize()` was `dispose(); init();` and `init()`
 * never re-entered `initDye()`, so the dye handles would have gone null with nothing to notice. This class is
 * **resolution-independent by construction** — `DYE_SIZE` is a fixed 512², every uniform is UV, and nothing
 * here derives from the canvas — so there is no `resize()` to forget, exactly as `fluid-advection.ts`'s own
 * H12 note argues for the velocity field. ⚠️ **Do not add one.** A canvas resize changes nothing this class
 * can observe.
 *
 * ## Why it is worth building NOW when `E57` was cut for looking like this
 *
 * ⚠️ **On additive splats a dye field is a third translucent overlay, near-identical to physarum's — which is
 * the output-channel critique that killed `E57`, and it would apply verbatim here.** What changed is 15.1: on
 * an iso-surface the dye is not an overlay at all, it is the **surface's ALBEDO**. It enters as
 * `LiquidTintSource` `'dye'` and is then lit, refracted, Fresnel-rimmed and absorbed exactly like any other
 * tint — i.e. it reaches the screen through the surface's existing output channel rather than adding a fourth
 * translucent one. That is why the phase plan ranks this last on a STRUCTURAL basis rather than by effort, and
 * why it must not be started before 15.1 and 15.2 are browser-confirmed (both were, 2026-08-30/31).
 *
 * ## ⚠️ A FIFTH TINT SOURCE, NOT A SIXTH BLEND — and that decision protects 15.2's identity
 *
 * The surface resolves `tint = mix(resolveSource(), weightedMean, colourMix)`. Dye joins `resolveSource()`'s
 * five-way switch, so that expression's shape is untouched and `colourMix == 0` remains an exact algebraic
 * identity (`fieldcheck` §O asserts it). The rejected alternative — a `dyeAmount` slider applying
 * `mix(tint, dye, dyeAmount)` afterwards — would have put two interacting colour controls in one section for a
 * composition none of the other four sources gets.
 *
 * ⚠️ **`'dye'` is the ONE source whose input is a TEXTURE rather than a number the CPU already holds, so it is
 * the one source that can be UNAVAILABLE** (field off, or `EXT_color_buffer_float` refused). It degrades to
 * `'ramp'` — the identical fallback `'material'` already takes when no material is live, resolved at the
 * identical site, so there is no second rule to learn. ⚠️ **A degrade must never resolve to `null`**: the
 * surface program is multi-sampler, and an unassigned `sampler2D` can resolve a whole draw black (invariant 4).
 *
 * ## Units and length scale
 *
 * `injectionRadius` is in **pixels of the CANVAS**, converted to the field's UV at the splat. ⚠️ **The
 * conversion divides by `min(w,h)`, not per-axis** — the field is a square 512² addressed in UV, whose two
 * canvas axes have different pixels-per-unit, so a per-axis radius would make an injected blob ELLIPTICAL on a
 * non-square canvas and the control would read as a shape change rather than a size one (invariant 26, whose
 * write-up cost a sitting over exactly this).
 *
 * `advectionStrength` multiplies the velocity field's own displacement, which is a **UV displacement per 60 Hz
 * frame** and NOT a velocity (`FluidAdvectionProcessor.sampleVelocity`'s doc is the owner of that unit). So the
 * advection shader needs no `dt` in its offset and must not be given one — the field's own decay and the
 * `dt`-corrected seed upstream already carry the time dependence. ⚠️ **Adding a `dt` here would double-count
 * it**, which at 30 fps is a 2× advection error that reads as "the dye moves faster on a slower machine".
 */

/**
 * Fixed field resolution, matching `FLUID_SIZE`. ⚠️ **The two MUST agree**: the advection pass samples the
 * velocity texture with the same `vUv` it writes dye at, so a mismatch would silently rescale the flow — dye
 * advecting along a stretched copy of the field the figure actually stirred. It is baked into every
 * `texImage2D` here and into `ADVECT_FS`'s `texelSize`, which is what makes this class resolution-independent
 * (see the header's `resize()` note).
 */
const DYE_SIZE = 512;

const QUAD_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 vUv;
void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/**
 * Advect + decay in ONE pass.
 *
 * ⚠️ **SEMI-LAGRANGIAN: the fragment reads BACKWARD along the velocity, it does not push colour forward.**
 * `texture(uDye, vUv - vel * strength)` asks "what dye arrives here", which is unconditionally stable and
 * needs no scatter. A forward push would need one draw per source texel and could leave gaps.
 *
 * ⚠️ **`uVel`'s two channels are a UV DISPLACEMENT PER FRAME — no `dt`** (see the class header). The `* 2.0 -
 * 1.0` is because the velocity field stores a signed displacement biased into an unsigned-looking range only
 * for the pressure programs' benefit; here it is read raw, so it is NOT rebiased — the sample is already
 * signed in RGBA16F.
 */
const ADVECT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDye;
uniform sampler2D uVel;
uniform float uStrength;
uniform float uDecay;
out vec4 fragColor;
void main() {
  vec2 vel = texture(uVel, vUv).xy;
  vec2 src = vUv - vel * uStrength;
  vec4 dye = texture(uDye, clamp(src, 0.0, 1.0));
  // ⚠️ A NaN or Inf texel would persist for the whole session: this pass is a FEEDBACK LOOP (its output is
  // its own next input) and the decay MULTIPLIES, so a non-finite value can never be faded out — invariant
  // 20's exact shape, and the reason for a boolean select rather than a mix().
  bool bad = any(isnan(dye)) || any(isinf(dye));
  dye = bad ? vec4(0.0) : dye;
  fragColor = dye * uDecay;
}`;

/**
 * Additive point-sprite deposit — the same shape as `fluid-advection.ts`'s velocity splat, and deliberately
 * so: one idiom for "scatter per-particle data into a 512² field".
 *
 * ⚠️ **`ONE, ONE` blending with a radial falloff, and the colour is NOT premultiplied by the falloff twice**
 * (invariant 9 — `color * opacity` under `SRC_ALPHA` applies opacity twice and distorts the falloff rather
 * than merely dimming). Alpha carries the deposit weight so the field knows how much dye is present, which is
 * what lets the surface distinguish "no dye here" from "black dye here".
 */
const SPLAT_VS = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec3 a_colour;
uniform float uRadius;
out vec3 vColour;
void main() {
  vColour = a_colour;
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = uRadius;
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec3 vColour;
uniform float uAmount;
out vec4 fragColor;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float r2 = dot(pc, pc) * 4.0;
  if (r2 > 1.0) discard;
  // Wyvill (1-r^2)^3 — compact support and C1 at the boundary, so a sprite adds no step discontinuity at its
  // own square edge. The same kernel the liquid accumulation pass uses, for the same reason.
  float k = 1.0 - r2;
  float w = k * k * k * uAmount;
  fragColor = vec4(vColour * w, w);
}`;

/**
 * v8 28.1 (`28.D5`) — **THE DYE'S OWN OUTPUT CHANNEL: the wake, lifted out of the liquid surface shader.**
 *
 * ⚠️ **THIS IS NOT NEW MATHS. It is the `cover <= 0.0` branch of `LIQUID_SURF_FRAG`, which was already a
 * complete, seam-matched, premultiplied dye compositor depending on ZERO values from the `liquid` block.**
 * Phase 28 exists because those fifteen lines were trapped inside a 400-line fragment shader whose first
 * act is to compute a density no other render mode has. Read `28.0a` before changing anything here.
 *
 * ⚠️ **The fallback is `vec3(0.0)` and that is deliberate, not laziness** — the wake's own comment says
 * why: *"it is black rather than the ramp because there is no surface here to fall back to -- a ramp read
 * outside the body would paint the background in the surface's own colour at alpha 0."* It is also
 * unreachable, since `a > 0` implies `s.a > 0`.
 *
 * ⚠️ **PREMULTIPLIED OUTPUT, and it is correct for BOTH blend modes** (`28.D1`): `'over'` and `'add'`
 * differ only in the DESTINATION factor, so writing an un-premultiplied variant for `'add'` would be a
 * second spelling of one colour (invariant 9's shape).
 *
 * ⚠️ **`discard` rather than emitting zero**, because the wake can cover most of the frame: a
 * transparent-black blend is a read-modify-write per pixel for no effect.
 */
const OVERLAY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDye;
uniform float uSatK;
out vec4 fragColor;
${DYE_HUE_GLSL}
void main() {
  vec4 s = texture(uDye, vUv);
  // The SAME saturation mapping the in-surface wake uses, from the SAME constant -- sat = 1 - exp(-a * k).
  // The hue comes from the quotient; the DENSITY has to come from the alpha, or no slider reaches the
  // screen (DYE_SATURATION_K's own derivation).
  float a = clamp(1.0 - exp(-max(s.a, 0.0) * uSatK), 0.0, 1.0);
  if (a <= 0.0) discard;
  fragColor = vec4(dyeHueOf(s, vec3(0.0)) * a, a);
}`;

export class DyeFieldProcessor {
  private gl: WebGL2RenderingContext | null = null;

  /** Ping-pong pair. `texA` is always the CURRENT field — `step()` swaps after each advect. */
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;

  private advectProg: WebGLProgram | null = null;
  private splatProg: WebGLProgram | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadVbo: WebGLBuffer | null = null;
  private splatVao: WebGLVertexArrayObject | null = null;
  private splatPosVbo: WebGLBuffer | null = null;
  private splatColVbo: WebGLBuffer | null = null;

  private uAdvectDye: WebGLUniformLocation | null = null;
  private uAdvectVel: WebGLUniformLocation | null = null;
  private uAdvectStrength: WebGLUniformLocation | null = null;
  private uAdvectDecay: WebGLUniformLocation | null = null;
  private uSplatRadius: WebGLUniformLocation | null = null;
  private uSplatAmount: WebGLUniformLocation | null = null;

  /*
   * v8 28.1 — the overlay pass's own program, VAO and uniforms.
   *
   * ⚠️ **ITS OWN VAO, SHARING `quadVbo`, RATHER THAN REUSING `quadVao`.** `quadVao` was configured with
   * `getAttribLocation(this.advectProg, 'a_pos')`, and an attribute location is a property of the
   * PROGRAM, not of the source. Both programs compile the same `QUAD_VS` and would almost certainly
   * both put `a_pos` at 0 — but *almost certainly* is how a driver-specific black frame gets shipped,
   * and the whole cost of removing the assumption is one VAO object.
   */
  private overlayProg: WebGLProgram | null = null;
  private overlayVao: WebGLVertexArrayObject | null = null;
  private uOverlayDye: WebGLUniformLocation | null = null;
  private uOverlaySatK: WebGLUniformLocation | null = null;

  /**
   * 1×1 transparent-black stand-in handed out by `getDyeTexture()` when the field is not running.
   *
   * ⚠️ **INVARIANT 4: never `null`.** The liquid surface program is multi-sampler, so an unassigned
   * `sampler2D` can resolve the ENTIRE draw black on some drivers rather than only the unused sampler — the
   * defect `normalizeFrameFallbackTex` and the tile renderer's `fallbackTex` both exist for. Transparent black
   * is the honest "no dye" value here: alpha 0 makes the surface's fallback branch take over.
   */
  private fallbackTex: WebGLTexture | null = null;

  private config: DyeFieldConfig | null = null;
  /** Grow-only scratch for the splat upload — invariant 8: never a per-frame allocation. */
  private splatPos = new Float32Array(0);
  private splatCol = new Float32Array(0);

  /**
   * ⚠️ **`enabled` AND a positive amount — the same two-part shape `liquidField`'s export gate uses.** A field
   * enabled at `opacity: 0` deposits nothing visible while still paying two 512² passes a frame, and gating on
   * `enabled` alone is how a control that reads as off costs a frame budget anyway.
   */
  isActive(): boolean {
    const c = this.config;
    return !!c && c.enabled && c.opacity > 0 && !!this.gl;
  }

  setConfig(cfg: DyeFieldConfig): void {
    this.config = { ...cfg };
  }

  /**
   * ⚠️ **`init(gl)` STORES THE CONTEXT AND ALLOCATES THE 1×1 FALLBACK ONLY — the 8 field objects are allocated
   * lazily by `ensureResources()` on the first active frame.** This is G14's finding turned into a
   * constructor-time rule: the deleted version allocated 13 GL objects the moment `setDyeConfig` ran, for a
   * subsystem with no callers, and every preset in the library pays this class's `init()`. With 0 of 360
   * presets authoring a dye block, eager allocation would be 8 objects per session for nothing.
   */
  init(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    this.fallbackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fallbackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Allocate the field on first use. Returns false if the context refused a float target.
   *
   * ⚠️ **`checkFramebufferStatus` IS TESTED (invariant 5).** An incomplete FBO throws nothing and logs nothing;
   * the field would simply stay at its clear value and the tint would silently fall back to `'ramp'`, which
   * looks like a preset choice rather than a failure. On refusal the resources are disposed and `enabled` is
   * left alone — the config is the user's, and the *capability* is what is absent.
   */
  private ensureResources(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    if (this.texA) return true;
    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('PSSS: EXT_color_buffer_float unavailable; dye field disabled, tint falls back to ramp');
      return false;
    }

    const mkTex = (): WebGLTexture => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, DYE_SIZE, DYE_SIZE, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const mkFbo = (tex: WebGLTexture): WebGLFramebuffer => {
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return f;
    };

    const saved = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    this.texA = mkTex();
    this.texB = mkTex();
    this.fboA = mkFbo(this.texA);
    const okA = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    this.fboB = mkFbo(this.texB);
    const okB = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (okA && okB) {
      // Clear both halves to transparent black, so the first advect reads an empty field rather than
      // uninitialised texture memory.
      for (const f of [this.fboA, this.fboB]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, saved);
    if (!okA || !okB) {
      console.warn('PSSS: dye field FBO incomplete; dye disabled, tint falls back to ramp');
      this.disposeField();
      return false;
    }

    this.advectProg = compileProgram(gl, QUAD_VS, ADVECT_FS, 'Dye advect');
    this.uAdvectDye = gl.getUniformLocation(this.advectProg, 'uDye');
    this.uAdvectVel = gl.getUniformLocation(this.advectProg, 'uVel');
    this.uAdvectStrength = gl.getUniformLocation(this.advectProg, 'uStrength');
    this.uAdvectDecay = gl.getUniformLocation(this.advectProg, 'uDecay');

    this.quadVao = gl.createVertexArray();
    this.quadVbo = gl.createBuffer();
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const qPos = gl.getAttribLocation(this.advectProg, 'a_pos');
    gl.enableVertexAttribArray(qPos);
    gl.vertexAttribPointer(qPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.splatProg = compileProgram(gl, SPLAT_VS, SPLAT_FS, 'Dye splat');
    this.uSplatRadius = gl.getUniformLocation(this.splatProg, 'uRadius');
    this.uSplatAmount = gl.getUniformLocation(this.splatProg, 'uAmount');
    this.splatVao = gl.createVertexArray();
    this.splatPosVbo = gl.createBuffer();
    this.splatColVbo = gl.createBuffer();
    gl.bindVertexArray(this.splatVao);
    const sPos = gl.getAttribLocation(this.splatProg, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatPosVbo);
    gl.enableVertexAttribArray(sPos);
    gl.vertexAttribPointer(sPos, 2, gl.FLOAT, false, 0, 0);
    const sCol = gl.getAttribLocation(this.splatProg, 'a_colour');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatColVbo);
    gl.enableVertexAttribArray(sCol);
    gl.vertexAttribPointer(sCol, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // v8 28.1 — the overlay program. Through `compileProgram()` WITH A LABEL: a failed compile throws
    // nothing, links, binds and no-ops to black, and the label is the only thing that names it.
    this.overlayProg = compileProgram(gl, QUAD_VS, OVERLAY_FS, 'Dye overlay');
    this.uOverlayDye = gl.getUniformLocation(this.overlayProg, 'uDye');
    this.uOverlaySatK = gl.getUniformLocation(this.overlayProg, 'uSatK');
    this.overlayVao = gl.createVertexArray();
    gl.bindVertexArray(this.overlayVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    const oPos = gl.getAttribLocation(this.overlayProg, 'a_pos');
    gl.enableVertexAttribArray(oPos);
    gl.vertexAttribPointer(oPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return true;
  }

  /**
   * Deposit this frame's dye from the live particles.
   *
   * ⚠️ **`count` MUST be `state.waveCount` (or the caller's own curve count), not `state.count`** — see the
   * call site. The three colour sources come off arrays the caller already has, so this method reads no
   * generator state itself.
   *
   * @param positions `[x, y, z]` triples in CANVAS pixels.
   * @param colours `[r, g, b]` triples, 0..1 — resolved by the caller per `config.colourSource`.
   * @param count particles to deposit, ≤ both arrays' capacity in triples.
   * @param width canvas width in pixels; @param height canvas height in pixels.
   */
  inject(positions: Float32Array, colours: Float32Array, count: number, width: number, height: number): void {
    const gl = this.gl;
    const cfg = this.config;
    if (!gl || !cfg || !this.isActive() || count <= 0) return;
    if (!this.ensureResources()) return;

    const w = Math.max(1, width), h = Math.max(1, height);
    if (this.splatPos.length < count * 2) this.splatPos = new Float32Array(count * 2);
    if (this.splatCol.length < count * 3) this.splatCol = new Float32Array(count * 3);
    const P = this.splatPos, C = this.splatCol;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3]!, y = positions[i * 3 + 1]!;
      // A culled or diverged slot must not deposit: `CULL_SENTINEL` is a large magnitude, so without this it
      // would land at a clamped frame corner and build a permanent bright dot there (invariant 21 — scan the
      // CPU arrays; every GPU guard is downstream of this upload).
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const u = x / w, v = y / h;
      if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) continue;
      P[n * 2] = u;
      // ⚠️ Y IS FLIPPED. Canvas pixels run downward and the field's UV runs upward, exactly as every other
      // pass in this engine converts (`ndc.y = -ndc.y` in the liquid accumulator). Getting this wrong is not
      // subtly wrong: the dye advects along a vertically mirrored copy of the flow, so it drifts the opposite
      // way from the figure that laid it down — and on a symmetric figure that reads as "the strength is off".
      P[n * 2 + 1] = 1.0 - v;
      C[n * 3] = colours[i * 3] ?? 1;
      C[n * 3 + 1] = colours[i * 3 + 1] ?? 1;
      C[n * 3 + 2] = colours[i * 3 + 2] ?? 1;
      n++;
    }
    if (n === 0) return;

    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const savedVp = gl.getParameter(gl.VIEWPORT) as Int32Array;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
    gl.viewport(0, 0, DYE_SIZE, DYE_SIZE);
    gl.useProgram(this.splatProg);
    gl.enable(gl.BLEND);
    // Invariant 9: `ONE, ONE`. The falloff is applied ONCE in the shader and the colour is premultiplied by
    // it there, so an alpha-blend equation here would apply it a second time — a density-dependent loss that
    // distorts the deposit's falloff rather than merely dimming it.
    gl.blendFunc(gl.ONE, gl.ONE);
    // ⚠️ `min(w,h)`, NOT per-axis: the field is square and addressed in UV, so a per-axis conversion makes an
    // injected blob elliptical on a non-square canvas (invariant 26).
    gl.uniform1f(this.uSplatRadius, Math.max(1, (cfg.injectionRadius / Math.min(w, h)) * DYE_SIZE));
    gl.uniform1f(this.uSplatAmount, cfg.opacity);
    gl.bindVertexArray(this.splatVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatPosVbo);
    gl.bufferData(gl.ARRAY_BUFFER, P.subarray(0, n * 2), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatColVbo);
    gl.bufferData(gl.ARRAY_BUFFER, C.subarray(0, n * 3), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);
    gl.viewport(savedVp[0]!, savedVp[1]!, savedVp[2]!, savedVp[3]!);
  }

  /**
   * Advect and decay by one frame. `velocityTex` is `FluidAdvectionProcessor.getVelocityTexture()`; a `null`
   * one leaves the dye standing (it still DECAYS, so the field fades rather than freezing — the honest
   * behaviour when no flow exists).
   *
   * ⚠️ **NO `dt`, and that is deliberate** — the velocity texture holds a per-frame UV displacement, not a
   * velocity (see the class header). Multiplying by `dt` here would double-count the time dependence.
   */
  step(velocityTex: WebGLTexture | null): void {
    const gl = this.gl;
    const cfg = this.config;
    if (!gl || !cfg || !this.isActive()) return;
    if (!this.ensureResources()) return;

    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const savedVp = gl.getParameter(gl.VIEWPORT) as Int32Array;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
    gl.viewport(0, 0, DYE_SIZE, DYE_SIZE);
    gl.disable(gl.BLEND);
    gl.useProgram(this.advectProg);
    // Invariant 4: BOTH samplers get a unit unconditionally and BOTH have a texture bound — a 1×1 fallback
    // for the velocity slot, never `null`, or the whole draw can resolve black on some drivers.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.uniform1i(this.uAdvectDye, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityTex ?? this.fallbackTex);
    gl.uniform1i(this.uAdvectVel, 1);
    gl.uniform1f(this.uAdvectStrength, velocityTex ? cfg.advectionStrength : 0);
    gl.uniform1f(this.uAdvectDecay, Math.min(1, Math.max(0, cfg.decayRate)));
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    // Restore unit 0 (invariant 4) so no later pass inherits unit 1 as active.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);
    gl.viewport(savedVp[0]!, savedVp[1]!, savedVp[2]!, savedVp[3]!);

    [this.texA, this.texB] = [this.texB, this.texA];
    [this.fboA, this.fboB] = [this.fboB, this.fboA];
  }

  /**
   * v8 28.1 (`28.D5`, `28.D6`) — composite the field into the caller's buffer. **The dye's output channel
   * outside `liquid` mode, and the whole point of Phase 28.**
   *
   * ⚠️ **THE CALLER OWNS THE DECISION, NOT THIS METHOD.** `main.ts`'s `dyeOverlayActive()` is the ONE
   * resolver (`28.D8`, invariant 17) and it also refuses when `renderMode === 'liquid'` with
   * `tintSource === 'dye'`, because the surface pass already composites the wake in its own fragment —
   * running both would double-draw it at `1 - (1-a)^2`. This method only guards its own resources.
   *
   * ⚠️ **IT MUST BE CALLED BEFORE THE FIGURE IS DRAWN** (`28.D6`), i.e. straight after the particle FBO is
   * bound and before the crystal pass, so the dye reads as a BACKGROUND. The physarum overlay deliberately
   * sits on the other side of the renderer branch and therefore veils the figure; this one must not.
   *
   * ⚠️ **NO OPACITY UNIFORM. `dye.opacity` was already applied at INJECTION as `uSplatAmount`** — applying
   * it again here is invariant 9's shape, opacity twice, which distorts the falloff rather than dimming.
   *
   * ⚠️ **It restores the framebuffer, the viewport and `blendFunc(ONE, ONE)`** — the same contract the
   * liquid surface pass follows, and the reason the TransMap flow-field call needs an explicit restore
   * while `inject`/`step` do not is a property of who saves, not an omission at one of the sites.
   *
   * @param fbo the target the figure is about to be drawn into — `particleFbo()`, never `fboState.fboB`.
   */
  renderOverlay(fbo: WebGLFramebuffer | null, width: number, height: number): void {
    const gl = this.gl;
    const cfg = this.config;
    if (!gl || !cfg || !this.isActive()) return;
    if (!this.ensureResources()) return;
    if (!this.overlayProg || !this.overlayVao) return;

    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const savedVp = gl.getParameter(gl.VIEWPORT) as Int32Array;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, Math.max(1, width), Math.max(1, height));
    gl.useProgram(this.overlayProg);
    gl.enable(gl.BLEND);
    /*
     * 28.D1 — the two blend modes are two STEADY STATES, not two brightnesses. Composited into a buffer
     * that then decays by k, the fixed point for dye colour C at alpha a is:
     *     'over'  ->  aC / (1 - (1-a)k)     self-limiting; 1.00 x C at a=1, k=0.85
     *     'add'   ->  aC / (1 - k)          6.67 x C at the same point, and steep as k -> 1
     * So 'over' cannot blow out, while under 'add' Trail Decay becomes a brightness control for the dye.
     * 'over' is the default and is byte-identical to the in-surface wake's own equation.
     */
    gl.blendFunc(gl.ONE, (cfg.blendMode ?? 'over') === 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    // Invariant 4: the sampler gets its unit unconditionally and a texture is ALWAYS bound. `texA` is
    // non-null here (ensureResources succeeded), but the fallback is spelled anyway so this bind cannot
    // become the one that hands a multi-sampler program a null.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texA ?? this.fallbackTex);
    gl.uniform1i(this.uOverlayDye, 0);
    gl.uniform1f(this.uOverlaySatK, DYE_SATURATION_K);
    gl.bindVertexArray(this.overlayVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);
    gl.viewport(savedVp[0]!, savedVp[1]!, savedVp[2]!, savedVp[3]!);
    // Restore the additive equation the particle draws expect, exactly as the liquid surface pass does.
    gl.blendFunc(gl.ONE, gl.ONE);
  }

  /**
   * The field the liquid surface samples for `tintSource: 'dye'` — **`null` when no field is running.**
   *
   * ⚠️ **RETURNING `null` HERE IS DELIBERATE, AND HANDING BACK THE 1×1 STAND-IN INSTEAD WOULD BE A DEFECT
   * OF INVARIANT 25's SHAPE.** The consumer needs to distinguish "the field exists" from "it does not", to
   * choose between sampling it and degrading `'dye'` → `'ramp'` on the CPU. A never-null accessor makes that
   * test constantly true, so the degrade branch becomes unreachable — green forever, occupying the slot the
   * real check would take — and the only remaining fallback is the shader's per-pixel one, which cannot cover
   * a REFUSED float target (there is no field to sample at all).
   *
   * ⚠️ **INVARIANT 4 IS THEREFORE THE CONSUMER'S TO HONOUR, AT THE BIND**, which is the only place it can be:
   * `hdr-particle.ts` binds `this.dyeTexture ?? this.normalizeFrameFallbackTex` so the sampler unit always
   * carries a complete texture. ⚠️ **A new consumer must do the same — never bind this return value raw.**
   * This class's own `fallbackTex` covers the velocity slot inside `step()`, not this one.
   */
  getDyeTexture(): WebGLTexture | null {
    return this.isActive() ? this.texA : null;
  }

  /**
   * Clear both halves of the field to transparent black.
   *
   * ⚠️ **THE FIELD'S CONTENTS ARE HISTORY, NOT PARAMETERS — so a preset change must call this** (the rule
   * `generator.resetFrozen()` follows for the crystal pool, D-09). The dye is an integrated trace of where the
   * figure HAS BEEN; carried across a switch it tints the new preset's surface with the previous figure's wake.
   *
   * ⚠️ **It clears BOTH halves, not only `texA`.** `step()` reads `texA` and writes `texB` before swapping, so
   * clearing one leaves the other's stale contents one frame from being current again — a wake that reappears
   * for a single frame after being reset, which is the kind of symptom that gets blamed on the decay control.
   *
   * A no-op before the field is allocated, which is the common case: nothing to clear is not an error.
   */
  reset(): void {
    const gl = this.gl;
    if (!gl || !this.texA) return;
    const saved = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    for (const f of [this.fboA, this.fboB]) {
      if (!f) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, saved);
  }

  /** Drop the field's 8 objects but keep `gl` and the fallback — used on refusal and by `dispose()`. */
  private disposeField(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.advectProg) gl.deleteProgram(this.advectProg);
    if (this.splatProg) gl.deleteProgram(this.splatProg);
    if (this.overlayProg) gl.deleteProgram(this.overlayProg);
    if (this.overlayVao) gl.deleteVertexArray(this.overlayVao);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    if (this.splatVao) gl.deleteVertexArray(this.splatVao);
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.splatPosVbo) gl.deleteBuffer(this.splatPosVbo);
    if (this.splatColVbo) gl.deleteBuffer(this.splatColVbo);
    // ⚠️ INVARIANT 1: every deleted handle is also NULLED, because `ensureResources()` tests `this.texA` to
    // decide whether to re-allocate. A deleted-but-non-null handle would make it return true forever and
    // every subsequent draw a silent no-op against freed objects.
    this.texA = null; this.texB = null; this.fboA = null; this.fboB = null;
    this.advectProg = null; this.splatProg = null;
    // v8 28.1 — invariant 1: nulled as well as deleted. `renderOverlay()` tests `this.overlayProg`, so a
    // deleted-but-non-null handle would make every overlay draw a silent no-op against a freed program.
    this.overlayProg = null; this.overlayVao = null;
    this.quadVao = null; this.splatVao = null;
    this.quadVbo = null; this.splatPosVbo = null; this.splatColVbo = null;
    this.uAdvectDye = null; this.uAdvectVel = null; this.uAdvectStrength = null; this.uAdvectDecay = null;
    this.uSplatRadius = null; this.uSplatAmount = null;
    this.uOverlayDye = null; this.uOverlaySatK = null;
  }

  dispose(): void {
    const gl = this.gl;
    this.disposeField();
    if (gl && this.fallbackTex) gl.deleteTexture(this.fallbackTex);
    this.fallbackTex = null;
    this.splatPos = new Float32Array(0);
    this.splatCol = new Float32Array(0);
    this.gl = null;
  }
}
