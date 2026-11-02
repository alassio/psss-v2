import { compileProgram, TRAIL_SANITISE_GLSL } from '../core/gl-program.ts';

/**
 * The Reel `'fade'` transition's image half — a frozen copy of the outgoing preset's last HDR frame,
 * composited over the incoming preset at a falling weight.
 *
 * The ARITHMETIC lives in `exploration/reel-model.ts` (`transitionMix`, pure and checker-visible); this file
 * owns nothing but the pixels. It consumes `freezeWeight` alone — `outputGain` belongs to the `'black'` mode
 * and reaches the screen through a DOM overlay, so nothing here reads it.
 *
 * ## ⚠️ DELIBERATE DEVIATION FROM THE IDEATION: the composite happens at PRESENT, not in the trail
 *
 * S2 was originally described as "inject A's frozen trail into B's trail with a falling weight" — i.e. blend
 * the captured image back into `fboState.texB` each frame and let the trail carry it. That is NOT what this
 * does, and the three reasons are worth stating because the ideation's phrasing is the more obvious design:
 *
 * (a) **Feeding the freeze back into the trail means B's trail dynamics REPROCESS it every frame, and those
 *     dynamics are preset-dependent.** The decay blit multiplies, and `decayFactor` changes meaning with
 *     `blendMode` — an additive material CAPS the trail, so the same injected weight reads as a slow smear on
 *     one preset and as a blown-out white field on another. A transition whose look depends on which preset it
 *     transitions INTO is not a transition, and on the additive presets it can genuinely run away: the trail is
 *     a feedback loop, so an injected value above the cap is re-multiplied rather than released.
 * (b) **Compositing at present is still PRE-BLOOM and PRE-TONEMAP, which is the entire property that made S2
 *     attractive in the first place.** A cross-fade done after the tone map dips in the middle (two images at
 *     50 % each tone-map darker than either at 100 %), and a cross-fade done additively blows the overlap out.
 *     Mixing in linear HDR ahead of the grading chain avoids both, and it keeps `acesToneMap` — which is
 *     rational and therefore NaN at Inf — downstream of the mix rather than inside it.
 * (c) **It leaves B's trail state completely untouched**, so an aborted transition (the user hits Escape, the
 *     reel stops, the preset is changed by hand) costs exactly one `releaseCapture()`. The injection design has
 *     no such exit: whatever it had already written into the trail stays there, decaying, and the preset that
 *     keeps playing has been corrupted by a transition that no longer exists.
 *
 * ## GL state contract
 *
 * **Before `capture()` or `mix()`** the caller need only have the source texture COMPLETE — i.e. call from the
 * present step, after the TransMap pass has written `fboState.texA` and before bloom/tone map read it. No
 * particular framebuffer, program, VAO or blend state is required.
 *
 * **After** either call, matching what `bloom.ts` and `tone-map.ts` leave behind:
 * - the framebuffer binding is **restored** to whatever was bound on entry (read once with `getParameter`;
 *   this is stricter than the neighbours, which leave their own target bound — cheap, and it means a caller
 *   inserting the mix between two passes cannot lose its render target);
 * - the **viewport is left at `(0, 0, width, height)`** and deliberately not restored. Every present branch in
 *   `main.ts` sets `gl.viewport(0, 0, canvas.width, canvas.height)` itself, which is the same rectangle this
 *   pass uses, so there is nothing to restore to that differs. Restoring it properly would mean
 *   `getParameter(gl.VIEWPORT)` every frame, and that allocates a fresh `Int32Array` per call — invariant 8's
 *   defect class (per-frame allocation RATE, surfacing as a jitter every few seconds), paid for no benefit;
 * - `BLEND` is left **disabled** (as bloom and the tone map leave it, and as all three present branches set it
 *   themselves). This pass WRITES, it does not accumulate;
 * - the VAO binding is left at `null` and `activeTexture` is restored to `TEXTURE0` (invariant 4);
 * - the program binding is left on this module's program, as the neighbours do — every downstream present
 *   branch calls `useProgram` before drawing.
 */
export class ReelCrossfade {
  private readonly gl: WebGL2RenderingContext;

  /** Size-independent, built once on the first `capture()` and surviving a canvas resize. */
  private copyProgram: WebGLProgram | null = null;
  private mixProgram: WebGLProgram | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadVbo: WebGLBuffer | null = null;
  /**
   * ⚠️ Invariant 4's 1×1: the mix program declares TWO samplers and both units must have a real texture bound
   * whenever it draws. A `null` binding on either unit can black the whole draw with no GL error, so the bind
   * sites resolve through this rather than trusting that a handle is live. 4 texels — it is not a memory
   * decision, it is the only thing that makes "always bind a texture" structurally true instead of argued.
   */
  private fallbackTex: WebGLTexture | null = null;

  /** Canvas-sized, rebuilt on a size change. `freezeTex` holds the outgoing frame; `mixTex` is the output. */
  private freezeTex: WebGLTexture | null = null;
  private freezeFbo: WebGLFramebuffer | null = null;
  private mixTex: WebGLTexture | null = null;
  private mixFbo: WebGLFramebuffer | null = null;
  private allocWidth = 0;
  private allocHeight = 0;

  /**
   * ⚠️ Invariant 3 — A FLAG MUST DIE WITH ITS RESOURCE. This is never read directly; `hasCapture()` ANDs it
   * with `freezeTex !== null`, so a true flag cannot outlive the texture it describes. That ordering matters
   * because a true flag over a null texture would send `mix()` into a draw with a dead sampler binding, which
   * is a black frame rather than an exception.
   */
  private captured = false;

  private uCopySrc: WebGLUniformLocation | null = null;
  private uMixSrc: WebGLUniformLocation | null = null;
  private uMixFreeze: WebGLUniformLocation | null = null;
  private uMixWeight: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Copy `src` into the freeze buffer, allocating on first use. `false` means the freeze is unavailable and the
   * caller must degrade — a hard cut, which is a visibly different transition but not a broken one.
   *
   * ⚠️ Call this BEFORE the incoming preset is applied. `applyPresetChange` clears both trail buffers, so a
   * capture taken after it freezes black and the cross-fade silently becomes a fade-up from nothing — which
   * reads as the plateau being too long rather than as an ordering error. The copy is a real texture-to-texture
   * blit, so once it has returned true the clear cannot reach it.
   */
  capture(src: WebGLTexture, width: number, height: number): boolean {
    const gl = this.gl;
    if (width <= 0 || height <= 0) return false;
    if (!this.ensurePrograms()) return false;
    if (!this.ensureTargets(width, height)) return false;

    const freezeFbo = this.freezeFbo;
    if (!freezeFbo) return false;

    // Saved and restored rather than assumed: the capture is called from a preset-change path, not from a
    // fixed point in the present step, so there is no one binding it can be relied on to have found.
    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, freezeFbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.copyProgram);
    this.bindSampler(gl.TEXTURE0, 0, src, this.uCopySrc);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    // Invariant 4: `activeTexture` is global state and every later pass that binds without selecting a unit
    // first would write into whichever unit this method left current.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);

    this.captured = true;
    return true;
  }

  /** True only when there is a live frozen frame AND the texture holding it still exists (invariant 3). */
  hasCapture(): boolean {
    return this.captured && this.freezeTex !== null;
  }

  /**
   * Composite the frozen frame over `src` at `weight`, returning the texture the caller should present.
   *
   * ⚠️ **`weight <= 0` returns `src` UNCHANGED rather than running the pass at a zero weight, and that is
   * invariant 20, not an optimisation.** `mix(a, b, w)` is the ARITHMETIC overload here — `a*(1-w) + b*w` —
   * and `NaN * 0.0 == NaN`, so a NaN anywhere in the frozen texture would reach the screen at weight 0, i.e.
   * for every frame after the transition has finished but before the caller stops asking. A zero weight is not
   * an identity in floating point; not running the pass is. (Both taps are sanitised inside the shader as
   * well, so the running pass cannot propagate one either — the two guards cover different instants and
   * neither replaces the other.)
   *
   * ⚠️ `weight >= 1` returns the freeze texture DIRECTLY. Exact algebra, not a shortcut with a tolerance:
   * `mix(a, b, 1.0)` is `b`. It matters because `FADE_PLATEAU_MS` holds the weight at exactly 1 for 800 ms of
   * an 1800 ms transition, so this removes the extra full-screen pass from 44 % of it. The caller must not
   * write into the returned texture — nothing but `capture()` ever writes the freeze buffer.
   */
  mix(src: WebGLTexture, weight: number, width: number, height: number): WebGLTexture {
    const gl = this.gl;
    // `!(weight > 0)` rather than `weight <= 0`, so a NaN weight takes the identity path instead of reaching
    // `uniform1f` — a NaN weight would otherwise NaN the whole frame through the mix, and every comparison
    // with NaN being false means `weight <= 0` would let it through.
    if (!(weight > 0) || !this.hasCapture()) return src;

    // ⚠️ Rule 7: a size change DROPS the capture rather than stretching it. The freeze is a photograph of a
    // canvas that no longer exists, and rescaling it produces an image that is wrong in a way the user reads
    // as a rendering fault (the figure jumps, then jumps back). Losing the cross-fade costs one transition out
    // of a session; the reallocation happens on the next `capture()`, so nothing here rebuilds a target it has
    // no content for. Deliberately NOT reallocating-and-continuing: there is nothing left to continue with.
    if (width !== this.allocWidth || height !== this.allocHeight) {
      this.releaseCapture();
      return src;
    }

    const freezeTex = this.freezeTex;
    const mixFbo = this.mixFbo;
    const mixTex = this.mixTex;
    if (!freezeTex || !mixFbo || !mixTex) return src;

    if (weight >= 1) return freezeTex;

    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, mixFbo);
    gl.viewport(0, 0, width, height);
    // The pass WRITES the composite; with blending left on, the mix would be added to whatever the mix target
    // held from the previous frame and the cross-fade would brighten instead of dissolving.
    gl.disable(gl.BLEND);
    gl.useProgram(this.mixProgram);
    // ⚠️ Invariant 4: both units are assigned UNCONDITIONALLY, on every frame the pass runs — not once at
    // init. A sampler uniform is program state that any other module's `useProgram` + `uniform1i` can leave
    // pointing at the wrong unit, and the failure is a silently black or wrongly-sourced draw.
    this.bindSampler(gl.TEXTURE0, 0, src, this.uMixSrc);
    this.bindSampler(gl.TEXTURE1, 1, freezeTex, this.uMixFreeze);
    gl.uniform1f(this.uMixWeight, weight);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);

    return mixTex;
  }

  /**
   * Drop the frozen content. Keeps every allocation, so a reel's next transition costs no allocation at all —
   * which is the whole reason this is not `dispose()`: a twelve-item reel would otherwise allocate and free
   * ~59 MB twelve times per pass, and that allocation rate is invariant 8's shape rather than a memory
   * problem.
   *
   * ⚠️ The freeze buffer's CONTENT is left alone deliberately — clearing it would be an extra pass to
   * overwrite data that `hasCapture()` now makes unreachable. Every reader is gated on the flag, and the flag
   * is ANDed with the texture handle, so there is no path that can sample it.
   */
  releaseCapture(): void {
    this.captured = false;
  }

  /**
   * Free every GL resource. Idempotent.
   *
   * ⚠️ This does NOT poison the object: a later `capture()` re-allocates, exactly as `dye-field.ts`'s
   * `disposeField()`/`ensureResources()` pair does. So `dispose()` means "give the memory back", and it is the
   * right call on a canvas resize or when the Reel tab is torn down — `releaseCapture()` is the right call
   * between two transitions of the same reel.
   */
  dispose(): void {
    const gl = this.gl;
    this.releaseTargets();
    if (this.copyProgram) gl.deleteProgram(this.copyProgram);
    if (this.mixProgram) gl.deleteProgram(this.mixProgram);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.fallbackTex) gl.deleteTexture(this.fallbackTex);
    // ⚠️ INVARIANT 1: every deleted handle is NULLED in the same breath. `ensurePrograms()` tests
    // `this.mixProgram` to decide whether to compile, so a deleted-but-non-null handle would make it return
    // true forever and every subsequent draw a silent no-op against freed objects — and nulling is also what
    // makes a second `dispose()` free rather than a double-delete.
    this.copyProgram = null;
    this.mixProgram = null;
    this.quadVao = null;
    this.quadVbo = null;
    this.fallbackTex = null;
    this.uCopySrc = null;
    this.uMixSrc = null;
    this.uMixFreeze = null;
    this.uMixWeight = null;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────
  // Lazy allocation
  // ───────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Compile on first use. ⚠️ The programs are lazy for the same reason the textures are: a user who never
   * plays a reel must pay nothing, and two shader compiles at startup are two more chances for a driver to
   * refuse something on a path that will never be used. Kept SEPARATE from `ensureTargets()` because the two
   * have different lifetimes — a program survives a canvas resize, a canvas-sized target does not. That is
   * `bloom.ts`'s `init()`/`resize()` split, arrived at for the same reason.
   */
  private ensurePrograms(): boolean {
    const gl = this.gl;
    // Invariant 1: return BEFORE any assignment when the handles are live, so nothing is ever reassigned over
    // a non-null handle. A leaked program is invisible — it neither throws nor changes the image.
    if (this.copyProgram && this.mixProgram && this.quadVao && this.fallbackTex) return true;

    // A partial build (a previous attempt that threw between two of the four) is torn down rather than
    // patched: the alternative is four independent null tests at every use site.
    this.dispose();

    try {
      this.copyProgram = compileProgram(gl, QUAD_VERT, COPY_FRAG, 'Reel cross-fade capture');
      this.mixProgram = compileProgram(gl, QUAD_VERT, MIX_FRAG, 'Reel cross-fade mix');
    } catch (e) {
      // ⚠️ Caught, not propagated. `compileProgram` throws by design and that is right at init — but this one
      // runs from a running reel, and invariant 22's lesson is that one throw out of the frame path ended the
      // render loop for the session. A reel that cannot cross-fade must degrade to a hard cut, not stop the
      // canvas.
      console.warn('PSSS: reel cross-fade shaders unavailable — transition degrades to a hard cut', e);
      this.dispose();
      return false;
    }

    // Resolved once — a location is a property of the linked program and cannot change while it lives, so the
    // per-frame re-query the neighbours were carrying (triage H6) is pure overhead across the JS/driver
    // boundary.
    this.uCopySrc = gl.getUniformLocation(this.copyProgram, 'uSrc');
    this.uMixSrc = gl.getUniformLocation(this.mixProgram, 'uSrc');
    this.uMixFreeze = gl.getUniformLocation(this.mixProgram, 'uFreeze');
    this.uMixWeight = gl.getUniformLocation(this.mixProgram, 'uWeight');
    // ⚠️ A NULL LOCATION IS THE ONE FAILURE `compileProgram` CANNOT CATCH, and it is silent in the worst way.
    // `getUniformLocation` returns null for a name the program does not have — a typo here, or a uniform an
    // optimiser dropped — and `gl.uniform1i(null, n)` is a LEGAL NO-OP with no GL error. Both samplers would
    // then keep their default of unit 0, so the mix would sample the LIVE frame twice and the frozen frame
    // would never appear at any weight: a cross-fade that looks like a hard cut, on a code path whose shaders
    // compiled and linked cleanly. Reported rather than thrown, for invariant 22's reason.
    if (!this.uCopySrc || !this.uMixSrc || !this.uMixFreeze || !this.uMixWeight) {
      console.warn(
        'PSSS: reel cross-fade uniform missing ' +
        `(copy.uSrc=${!!this.uCopySrc}, mix.uSrc=${!!this.uMixSrc}, mix.uFreeze=${!!this.uMixFreeze}, ` +
        `mix.uWeight=${!!this.uMixWeight}) — transition degrades to a hard cut`,
      );
      this.dispose();
      return false;
    }

    this.quadVao = gl.createVertexArray();
    this.quadVbo = gl.createBuffer();
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    // Four vertices, TRIANGLE_STRIP — and the draw call below asks for exactly four. ⚠️ A buffer shorter than
    // its draw call is dropped ENTIRELY by ANGLE, with no GL error and no partial triangle to hint at it.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    // ⚠️ Attribute 0 by NUMBER, matching `layout(location=0)` in `QUAD_VERT`. `bloom.ts` and `tone-map.ts`
    // both do this; the pair only works because the shader pins the location, and a `getAttribLocation` lookup
    // here with an unpinned shader can legally return a different slot and draw nothing.
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.fallbackTex = this.createHdrTexture(1, 1);
    return true;
  }

  /**
   * Allocate the two canvas-sized RGBA16F targets on first use, or after a size change.
   *
   * ⚠️ **LAZY IS A REQUIREMENT, NOT AN OPTIMISATION.** Two canvas-sized RGBA16F textures are 8 bytes a texel:
   * 2 × 2560 × 1440 × 8 = ~59 MB at a common fullscreen resolution, and more on a 4K panel. Every user of the
   * engine would pay that for a feature most of them never open, on top of the ping-pong pair, the post FBO
   * and bloom's mip chain. Nothing here is touched until a reel actually starts a `'fade'`.
   */
  private ensureTargets(width: number, height: number): boolean {
    const gl = this.gl;
    if (this.freezeTex && this.mixTex && width === this.allocWidth && height === this.allocHeight) return true;

    // Invariant 1 again: delete-and-null before reallocating, never assign over a live handle. On a resize
    // this is also what makes rule 7 true — the old capture cannot survive its own texture.
    this.releaseTargets();

    const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    this.freezeTex = this.createHdrTexture(width, height);
    this.freezeFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.freezeFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.freezeTex, 0);
    const freezeOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

    this.mixTex = this.createHdrTexture(width, height);
    this.mixFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mixFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.mixTex, 0);
    const mixOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // ⚠️ INVARIANT 5: BOTH are tested, and the status is tested rather than assumed. An incomplete FBO throws
    // nothing and logs nothing — every draw into it is silently dropped, so the freeze would stay at whatever
    // the texture was allocated with (undefined contents) while `hasCapture()` kept reporting true. RGBA16F as
    // a colour attachment is renderable only with `EXT_color_buffer_float`, so this is a driver refusal that
    // actually happens rather than a theoretical one. Tested individually because a shared boolean would
    // report the second one's status for both.
    if (!freezeOk || !mixOk) {
      console.warn(
        `PSSS: reel cross-fade RGBA16F target incomplete (freeze=${freezeOk}, mix=${mixOk}) — ` +
        'transition degrades to a hard cut',
      );
      this.releaseTargets();
      return false;
    }

    this.allocWidth = width;
    this.allocHeight = height;
    return true;
  }

  /**
   * ⚠️ The four sized handles and the capture flag die TOGETHER (invariant 3). `releaseCapture()` is called
   * from here rather than clearing `captured` inline so there is one owner of "there is no frozen frame".
   */
  private releaseTargets(): void {
    const gl = this.gl;
    if (this.freezeTex) gl.deleteTexture(this.freezeTex);
    if (this.freezeFbo) gl.deleteFramebuffer(this.freezeFbo);
    if (this.mixTex) gl.deleteTexture(this.mixTex);
    if (this.mixFbo) gl.deleteFramebuffer(this.mixFbo);
    // Invariant 1: nulled, because `ensureTargets()` tests these handles to decide whether to reallocate.
    this.freezeTex = null;
    this.freezeFbo = null;
    this.mixTex = null;
    this.mixFbo = null;
    // ⚠️ Zeroed, not left behind: a stale size with null textures would make `mix()`'s size test pass and send
    // it past the guard on the strength of a measurement of buffers that no longer exist.
    this.allocWidth = 0;
    this.allocHeight = 0;
    this.releaseCapture();
  }

  /**
   * ⚠️ Every parameter here is COPIED from `createFBOTexture()` in `main.ts` and must stay equal to it —
   * `RGBA16F`/`RGBA`/`HALF_FLOAT`, `LINEAR` both ways, `CLAMP_TO_EDGE` both ways. These targets sit in the
   * same chain as `fboState.texA`: a narrower internal format would clip the HDR range the mix is done in
   * (which is the one property that makes compositing here better than after the tone map), `NEAREST` would
   * make the freeze visibly harder-edged than the live frame beside it at the same weight, and `REPEAT` would
   * wrap the frozen figure's edge back in as a seam. None of the four raises a GL error when wrong.
   */
  private createHdrTexture(width: number, height: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /**
   * Select a unit, bind a REAL texture to it and assign the sampler — the three halves of invariant 4 in one
   * place so no call site can do two of them.
   *
   * ⚠️ `tex ?? this.fallbackTex` is not redundant despite `tex` being typed non-null: `src` arrives from
   * `main.ts` where the present chain's textures are `WebGLTexture` by declaration but reallocated by several
   * paths, and the cost of being wrong is not an exception but a whole multi-sampler draw resolving black.
   */
  private bindSampler(
    unit: number,
    index: number,
    tex: WebGLTexture | null,
    loc: WebGLUniformLocation | null,
  ): void {
    const gl = this.gl;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, tex ?? this.fallbackTex);
    gl.uniform1i(loc, index);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Identical to `bloom.ts`/`tone-map.ts`' quad vertex shader, including the pinned attribute location. */
const QUAD_VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/*
 * ⚠️ `precision highp float` in BOTH shaders below, and it is load-bearing twice over. `sanitiseTrail`
 * compares against 1e30, which is itself Inf in mediump (commonly fp16, max finite 65504) — the guard would
 * silently pass everything. And the mix is done on HDR values that legitimately exceed the mediump range, so
 * a mediump mix would clip the highlights of the frozen frame only, which reads as the freeze being graded
 * differently from the live image rather than as a precision error.
 *
 * ⚠️ NO BACKTICK may appear in any comment inside these template literals (invariant 18) — one terminates the
 * literal, and `tsc` then reports the error dozens of lines away from its cause.
 */

/**
 * The capture blit: one texture into another, finiteness-guarded on the way in.
 *
 * ⚠️ Sanitised at CAPTURE and not only at mix time, because the freeze is a STILL. A NaN in the trail is a
 * one-frame event that the decay blit releases on the next frame; a NaN frozen into this buffer is held for
 * the entire transition and re-composited every frame of it, so the transient becomes a persistent stain on
 * the one path that has no feedback loop to flush it.
 *
 * `texture()`, NOT `sampleTrail()`: the sentinel scrub belongs to the trail feedback loop's one break point
 * (the decay blits) and only they may use it. This pass is outside that loop, and scrubbing here would erase
 * a `?gldiag=1` sentinel that the probe is trying to observe.
 *
 * Alpha is carried through unchanged, as `main.ts`' own blit does (`sanitiseTrail(sampleTrail(...))` on the
 * whole `vec4`). It is not decoration: style 7 reads alpha back as a height field.
 */
const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 fragColor;
${TRAIL_SANITISE_GLSL}
void main() {
  // uDiagSentinel is declared by the shared guard above and left unset here, so it is GL's default 0.0 --
  // i.e. this program releases to black, byte-identical to the shipped trail path.
  fragColor = sanitiseTrail(texture(uSrc, vUv));
}`;

/**
 * The composite: `out = mix(live, frozen, weight)` in linear HDR, alpha included.
 *
 * ⚠️ Both taps are sanitised BEFORE the mix, and the order is the point. `mix` here is the arithmetic
 * overload (`a*(1-w) + b*w`), and `NaN * 0.0 == NaN` — so a NaN on EITHER side survives its own weight,
 * whatever that weight is. Sanitising after the mix would be too late (the NaN has already spread across both
 * operands' contribution) and testing the weight would not help at all. The CPU-side `weight <= 0` early
 * return covers the instants when this program does not run; this covers the instants when it does.
 *
 * A boolean select is what the shared guard uses internally, for the reason its own note gives: the `vecN`
 * spelling of `mix` is a no-op for NaN. Nothing here may reimplement it.
 */
const MIX_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uFreeze;
uniform float uWeight;
in vec2 vUv;
out vec4 fragColor;
${TRAIL_SANITISE_GLSL}
void main() {
  vec4 live = sanitiseTrail(texture(uSrc, vUv));
  vec4 frozen = sanitiseTrail(texture(uFreeze, vUv));
  // Linear HDR, pre-bloom and pre-tone-map. Mixing the whole vec4 so alpha follows the same ramp as colour --
  // splitting them would make the frozen frame fade in brightness and in coverage at two different rates.
  fragColor = mix(live, frozen, uWeight);
}`;
