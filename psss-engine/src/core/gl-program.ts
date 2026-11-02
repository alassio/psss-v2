/**
 * The one shader compile/link path (triage I6).
 *
 * ## Why this exists — and it is NOT only de-duplication
 *
 * There were **eleven** hand-written compile+link implementations across twelve files, and they had
 * drifted into two populations:
 *
 * - **Six checked their work** and threw with the driver's info log: `compute-backend.ts`, `physarum.ts`,
 *   `fluid-advection.ts`, `hdr-particle.ts`, `neon-line-renderer.ts`, `ribbon-renderer.ts`.
 * - **Five did not, over eight sites** — `main.ts`, `bloom.ts`, `tone-map.ts`, `procedural-flow.ts`,
 *   `grid-tile-renderer.ts` and all four `trans-map.ts` `create*Program` methods. Those called
 *   `compileShader`/`linkProgram` and returned the handle **without ever reading `COMPILE_STATUS` or
 *   `LINK_STATUS`**.
 *
 * ⚠️ **That second group is the interesting half, because of how a GL failure presents in this engine.**
 * A shader that fails to compile throws nothing. Its program still links (against an empty shader), still
 * binds, and every subsequent `uniform*`/`drawArrays` call succeeds as a no-op — so the symptom is a
 * **silently black frame with no JS exception**, which is indistinguishable from a hung render loop. That
 * exact confusion is on record twice: the untested log-density/volume FBOs, and the under-sized vertex
 * buffer that ANGLE reports before dropping the whole draw. `tsc` and `vite build` cannot see either,
 * because the GLSL lives in template-literal strings — and the seven `checks/` checkers are text greps, so
 * they cannot see a *runtime* status either. Reading the two status flags is the only thing that can.
 *
 * Eight of the engine's shader programs are therefore now diagnosable where they previously were not,
 * including every TransMap style, bloom, the tone curve and the whole preview grid.
 *
 * ## Throwing is the established convention, not a new policy
 *
 * The six checked sites all threw, `hdr-particle.ts` — the main particle renderer — among them. A thrown
 * error at init is strictly better than a black frame: the failing shader is named and the driver's log is
 * printed. Any caller that wants to degrade instead should catch, the way `initLogDensity`/`initVolume`
 * fall back to `'star'` on an incomplete framebuffer.
 *
 * ⚠️ `label` is not decorative. A driver's info log names a line inside an anonymous template literal, so
 * without a label there is nothing in the message that identifies **which** of the engine's 33 shaders
 * failed. Pass the program's own name.
 */

/** Compile one shader stage, throwing with the driver's log — and the label — on failure. */
function compileStage(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
  stage: 'vertex' | 'fragment',
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`${label}: failed to create ${stage} shader`);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`${label}: ${stage} shader compile failed: ${log}`);
  }
  return shader;
}

/**
 * Compile, link and return a program, deleting both shader objects on the way out.
 *
 * The `deleteShader` calls are the reason this is one function rather than an exported
 * `compileShader` + `linkProgram` pair: a shader is only reclaimed once it is both detached-or-deleted and
 * no longer referenced by a live program, so the delete has to happen after the link. Splitting the two
 * made it a caller's responsibility, and `fluid-advection.ts` had already grown a local `mkProg` closure
 * to stop forgetting it five times over.
 *
 * @param label Names the program in any thrown message — e.g. `'TransMap fluid feedback'`.
 */
export function compileProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
  label: string,
): WebGLProgram {
  const vert = compileStage(gl, gl.VERTEX_SHADER, vertSrc, label, 'vertex');
  let frag: WebGLShader;
  try {
    frag = compileStage(gl, gl.FRAGMENT_SHADER, fragSrc, label, 'fragment');
  } catch (e) {
    // The vertex stage compiled; without this it would leak on every fragment-stage failure.
    gl.deleteShader(vert);
    throw e;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`${label}: failed to create program`);
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Deleted regardless of the link result — a deleted shader stays alive while attached, and the program
  // is about to be destroyed on the failure path anyway.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`${label}: program link failed: ${log}`);
  }
  return program;
}

/**
 * The trail-buffer finiteness guard, as GLSL — invariant 20's containment, in the one place every trail
 * writer can reach it.
 *
 * ⚠️ **This moved here from `main.ts` on 2026-08-22 because it was in the WRONG PLACE, not merely
 * duplicated.** It was a module-local constant in `main.ts`, so the only programs that could use it were the
 * two decay blits — and those write `texB`. Nothing guarded `texA`, which is what TransMap's warp writes and
 * what BOTH the screen path and the `?gldiag=1` probe read. So the engine sanitised the one buffer whose
 * producer is a linear blur and left unguarded the one whose producer samples at a computed UV.
 *
 * That gap has a specific consequence worth stating, because it is why a NaN could persist across frames at
 * all: the decay blit breaks the feedback loop every frame (it sanitises `texA` on the way to `texB`), so a
 * NaN in `texA` can only be *re-created*, never inherited. Guarding `texA` too means a single bad frame
 * stays a single bad frame — the trail recovers on the next one instead of latching, which is exactly the
 * "doesn't recover any more" half of the 2026-08-21 reports.
 *
 * ⚠️ **A guard is CONTAINMENT, never a fix.** It converts a permanent black frame into a transient artifact,
 * which also makes the underlying producer harder to see — so it belongs together with the probe that finds
 * the producer, not instead of it.
 *
 * ⚠️ **A NaN cannot be detected by comparison.** Every comparison with NaN is false, so `x > 1e30` does not
 * catch it and neither does `x < 0.0`. `!(x == x)` is the portable test, written as an explicit
 * `not(equal())` pair so no optimiser can fold it to a constant. `isnan()` exists in GLSL ES 3.00 but is
 * permitted to be unreliable where the compiler assumes finite math.
 *
 * ⚠️ **THE SELECT MUST BE `mix(a, b, bvecN)`, NEVER `mix(a, b, vecN(bvecN))` — and getting that wrong made
 * this entire guard A NO-OP FOR NaN, which is the 2026-08-23 root cause of the `Chain Flow Split` + Fire
 * black frame.** The two spellings are different functions:
 *
 * - `mix(x, y, bvec4 b)` — the GLSL ES 3.00 **genBType** overload. A true-valued component **SELECTS `y`
 *   outright**. No arithmetic touches `x`, so `x` being NaN is irrelevant.
 * - `mix(x, y, vec4 a)` — the **arithmetic** overload, defined as `x*(1-a) + y*a`. With `a = 1.0` that is
 *   `x*0.0 + y*1.0`, and **`NaN * 0.0 == NaN`**. The NaN survives its own detection, propagates through the
 *   add, and the function returns NaN — the exact value it was called to remove.
 *
 * The original code cast the `bvec4` to a `vec4`, taking the arithmetic path. So the guard detected the NaN
 * correctly (`not(equal(c, c))` was right all along), computed the release value correctly, and then
 * **multiplied the NaN by zero and added it back**. Both branches were affected, and so was `sampleTrail`'s
 * sentinel scrub. This is why the capture reads `nan = 4096/4096` with `trip = 0` on all four HDR stages
 * simultaneously: every guard in the chain fired and every one of them passed the NaN straight through, and a
 * trip that returns NaN instead of the sentinel is invisible to the probe by construction.
 *
 * ⚠️ **The consequence for reading a `?gldiag=1` capture is that `trip = 0` DID NOT MEAN "no guard fired"**,
 * and `FIRST BAD STAGE = 1_texB` did not mean the particle draw was the producer — with containment inert, a
 * NaN from anywhere reached every stage in one frame, so the six-stage partition of invariant 21 could not
 * localise anything. A probe cannot be more trustworthy than the guard it observes.
 *
 * A boolean select is also strictly cheaper than a multiply-add pair, so there is no cost to this being right.
 *
 * The bound is 1e30: above any legitimate HDR trail value (RGBA16F saturates at 65504, so a finite texel
 * cannot exceed it) and below Inf. Deliberately NOT a clamp into the representable range — this is a
 * last-resort release, not a tone control, and capping at 65504 would silently flatten real highlights.
 * Alpha is guarded too, because style 7 reads it back as a height field and a NaN there propagates into the
 * refraction gradient on the next frame.
 *
 * ⚠️ **Requires `precision highp float`.** In mediump the literal 1e30 is itself Inf and the bound is
 * useless — every consumer below declares highp for this reason.
 *
 * ⚠️ **`uDiagSentinel` exists because THIS GUARD MAKES ITS OWN TRIP INVISIBLE, and that cost the 2026-08-22
 * sitting.** A trip writes the release value frame-wide, so with the release hardcoded at 0 a guard firing on
 * every texel is bit-identical to a trail nothing ever drew into: the probe reads `nan=0 inf=0 lit=0` in both
 * cases and `probeTrail`'s classifier then reports "genuinely EMPTY — nothing drew", sending the reader after
 * a dropped draw that does not exist. Releasing to a DETECTABLE value instead splits those two, which is the
 * whole difference between "containment fired here" and "no draw reached this buffer".
 *
 * It is `0.0` unless `?gldiag=1` set it, so the shipped path is **byte-identical to before** — and it is
 * declared HERE rather than at each consumer so no call site can forget it and so `glslcheck` (which greps
 * these template literals for used-but-undeclared uniforms) sees the declaration beside the use. A program
 * that never sets it gets 0.0, GL's default for an unset float uniform, which is exactly the old behaviour.
 *
 * ⚠️ **The sentinel MUST be a value the target format can hold — `-1e20` would be wrong here.** Every trail
 * buffer is RGBA16F (max finite magnitude 65504), so a sentinel above that stores as `-Inf` and lands back in
 * the probe's `inf` bucket, re-conflating a trip with the overflow it was added to distinguish. `-2048.0` is
 * exactly representable in half float and unreachable legitimately: the trail is non-negative everywhere
 * except band split's `+= uBandAmount * (baseHere - baseThere)` residual, which is small — so a reader must
 * test a THRESHOLD (`< -1000.0`), never equality, since LINEAR filtering interpolates a sentinel texel
 * against its neighbours and a bilinear tap of one is no longer exactly -2048.
 */
export const TRAIL_SANITISE_GLSL = `
    uniform float uDiagSentinel;
    vec4 sanitiseTrail(vec4 c) {
      // 0.0 in every shipped path; -2048.0 only under ?gldiag=1, so a trip becomes visible to the probe.
      vec4 release = vec4(uDiagSentinel);
      // Portable NaN test: NaN is the only value not equal to itself.
      bvec4 nan = not(equal(c, c));
      c = mix(c, release, nan);
      // Inf (and any absurd finite runaway) -> release. Comparison is safe now that NaN is gone.
      bvec4 huge = greaterThan(abs(c), vec4(1e30));
      return mix(c, release, huge);
    }
    // Sample a trail buffer, mapping any sentinel back to 0 on the way IN. Only the decay blits use this,
    // and only they may: the sentinel is a marker living in a FEEDBACK BUFFER, so without a scrub at the
    // loop's one break point a single trip would be multiplied by decayFactor every frame and read as a
    // permanent -2048 stain rather than as the one-frame event it actually was.
    //
    // Scrubbing PER TAP, not on the blur's summed result: one sentinel tap at weight 0.0625 contributes
    // -128, which is above the threshold and would slip through a test applied after the sum.
    //
    // ⚠️ Partial residue is accepted deliberately. These buffers filter LINEAR, so a tap landing between
    // texels returns a sentinel already blended toward its neighbours and can fall above the threshold. That
    // residue is a small negative value in a buffer the fade pass MULTIPLIES, so it decays to nothing like
    // any other trail value — it cannot latch, which is the only property that matters here.
    //
    // Inert on the shipped path: with uDiagSentinel at 0.0 nothing can be below the threshold, so the mix
    // resolves to the sampled value unchanged.
    vec4 sampleTrail(sampler2D s, vec2 uv) {
      vec4 c = texture(s, uv);
      bvec4 mark = lessThan(c, vec4(-1000.0));
      return mix(c, vec4(0.0), mark);
    }`;

/**
 * The diagnostic release value, and the threshold a reader tests it with.
 *
 * Shared so the shader-side uniform, the decay blit's scrub and the probe's classifier cannot drift apart —
 * three sites agreeing by coincidence is the shape that hid the styles 0-3 field formula in three copies.
 */
export const DIAG_SENTINEL = -2048.0;
/** A bilinear tap of a sentinel texel is no longer exactly `DIAG_SENTINEL`, so readers test this bound. */
export const DIAG_SENTINEL_THRESHOLD = -1000.0;
