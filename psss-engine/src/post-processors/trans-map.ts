// `MAX_SIN_MAGIC` and `DEG` lived here until 2026-08-20. Both moved to `static-field.ts`, which is now the
// only place a wave is built — this file composes waves into offsets and no longer evaluates a sine.

import type { ConformalConfig, IfsTransform, ParallaxConfig, ProceduralFlowConfig, RefractionConfig, SinMagicParams, TimeWarpSource, TransMapLayer, TransMapStyle } from '../presets/types.ts';
import { ProceduralFlowGenerator } from './procedural-flow.ts';
import { defaultIfsParams } from './ifs-presets.ts';
import { compileProgram, TRAIL_SANITISE_GLSL } from '../core/gl-program.ts';
import {
  bandSplitOf,
  buildChainPlan,
  makeLayer,
  normaliseChain,
  parallaxBandOf,
  parallaxOf,
  refractionOf,
  timeWarpOf,
  vortexGain,
  vortexOf,
  vortexOffsetAt,
  conformalOf,
  type ChainPlan,
} from './trans-map-chain.ts';
import {
  driftPhase,
  resolveStaticWaves,
  staticFieldOf,
  staticOffsetAt,
  STATIC_FIELD_TARGET_FRACTION,
  type ResolvedStaticLayer,
} from './static-field.ts';

/**
 * Offset ceiling, in UV, for a chain with 2+ enabled FIELD layers.
 *
 * ⚠️ **Deliberately NOT APPLIED for a single layer** (`NO_OFFSET_CLAMP` below), because styles 1-3 legitimately
 * produce offsets up to ±1.0 UV: `zoomCoordinate` multiplies by `1 - wX` where `wX` is an UNSCALED sum of the
 * raw `sinMagicParams` amplitudes, so a zoom factor of -7 is ordinary and `rollToRange` then folds the result
 * back into the frame. A clamp of 0.25 would have visibly altered **57 of the 177 legacy presets** (styles 1/2/3
 * = 5 + 33 + 19). So this bounds only the case that did not exist before — a SUM — and leaves every
 * single-style preset bit-identical.
 *
 * Units (invariant 10): UV, so 1.5 means one and a half frame widths, and the same constant is correct in a
 * 256 px tile as at 1080p without any `SCREEN_SPACE_TILE_SCALE` factor — decide by UNIT, not by field name.
 */
const MAX_CHAIN_OFFSET_UV = 1.5;

/**
 * Taps per side in style 9's separable blur — the loop BOUND, not the radius.
 *
 * The slider's maximum Band Radius is 16 full-resolution texels, which is 8 at the half-resolution target,
 * and the shader runs to `2 * sigma` where `sigma = radius / 2`. So 8 covers the whole slider range with the
 * Gaussian truncated at 2σ (≈95 % of the mass); the shader normalises by the accumulated weight, so the
 * truncation costs a slightly narrower kernel and never a brightness change. ⚠️ Raising this is not free —
 * it is a fixed `for` bound in a full-screen pass, so the cost is paid at every radius, not just large ones.
 */
const MAX_BAND_TAPS = 8;

/**
 * "No clamp at all" — a NEGATIVE sentinel, and the sign is the whole point.
 *
 * ⚠️ This was `8.0`, on the argument that `length(off) > 8` is unreachable. That argument does not hold up for
 * the fluid layer: `flOff = vel * uAmplify * 50` with `uAmplify` up to 10, so the ceiling depends on the
 * velocity field's actual magnitude — a quantity that varies with particle count, speed and `persist`, and one
 * `fluid-advection.ts` documents in the 1e-5..4e-2 range for related quantities. A bound I cannot establish is
 * not a bound, and getting it wrong means clamping a style-6 preset the old shader never clamped.
 *
 * The shader therefore tests `uMaxOffset > 0.0` before clamping, so a negative value takes the branch ZERO
 * times at any magnitude. That makes every single-field-layer chain provably identical to the pre-chain
 * shader instead of identical-if-the-estimate-was-right.
 */
const NO_OFFSET_CLAMP = -1.0;

export interface TransMapConfig {
  enabled: boolean;
  /**
   * The legacy single style. Still honoured: when `chain` is absent this is promoted to a one-layer chain,
   * which is what every one of the 177 legacy presets and every pre-chain export supplies.
   */
  style: TransMapStyle;
  /** The layer chain. Authoritative when present; `style` is ignored then. */
  chain?: TransMapLayer[];
  sinMagicParams: number[][];
  sinMagicParams2: number[][];
  zoomCenterX: number;
  zoomCenterY: number;
  width: number;
  height: number;
  ifsParams?: IfsTransform[];
}

/**
 * The two wave tables, as one string for `setChain`'s rebuild predicate (v8 21.12).
 *
 * ⚠️ **Both tables, unconditionally, even though only style 3 reads the second one.** Gating on the style
 * would be a second enumeration of "who reads `sinMagicParams2`" living next to the one in
 * `resolveStaticWaves`, and a chain holding a style-3 layer beside a style-1 layer would then need the
 * digest to depend on the layer — it does not, because the tables are per-PRESET. The cost of including a
 * table nobody reads is one rebuild that resolves to the same field.
 *
 * ⚠️ **Raw numbers, no rounding.** The term rows store what the user typed, to 8 decimals in the library, so
 * a `toFixed(4)` here — the convention the rest of the signature uses for *slider* values — would make an
 * edit in the 5th decimal invisible to the rebuild: the control moves, the picture does not. A slider cannot
 * reach that resolution; a typed box is the whole point of the term rows.
 */
function tableDigest(config: TransMapConfig | null): string {
  if (!config) return '';
  let s = '';
  for (const row of config.sinMagicParams) s += row.join(',') + ';';
  for (const row of config.sinMagicParams2) s += row.join(',') + ';';
  return s;
}

/**
 * TransMap — an ordered CHAIN of displacement/echo layers over the accumulated trail buffer.
 *
 * ## The layer chain
 *
 * This class used to link exactly ONE of four programs per instance, chosen by an `if / else if / else` on
 * `config.style`, with `apply()` mirroring the same partition through early returns. That exclusivity was
 * **structural, not algebraic**: six of the seven styles are the same function, since
 * `mix(vUv, dispUv, m) === vUv + (dispUv - vUv) * m`. So the styles now compose — see
 * `trans-map-chain.ts` for the stage table and why only one boundary in the chain is executable.
 *
 * ⚠️ **Every single-style configuration must stay bit-identical**, which constrains the merged shader in three
 * non-obvious ways. Each was verified against the pre-chain source, not assumed:
 *
 * 1. **`uMix` is passed separately from the per-layer weights.** Style 6's `strength` (which drives
 *    `uGlowBoost`) was computed from the offset BEFORE `uMix` was applied, so folding the global mix into a
 *    single combined weight would have scaled the glow by `uMix` — changing the documented behaviour that "at
 *    mix 0 the frame still gains glow". `uLayerWeight` therefore carries weight × per-layer fade only.
 * 2. **The offset clamp is disabled for a single field layer** — see `MAX_CHAIN_OFFSET_UV`.
 * 3. **`edgeFade` and the glow are gated on `uFeedbackPresent`**, so a chain without style 6 gets neither
 *    (matching styles 0-5 today) and a chain with it gets both unconditionally, outside `uMix` (matching
 *    style 6 today). The edge fade is what stops CLAMP_TO_EDGE border accumulation in the feedback loop, so
 *    it must not become a function of the mix.
 *
 *    ⚠️ **`uDispersion` was in this list until 2026-08-20 and no longer is** — it is chain-level state
 *    (`overlay.transMapDispersion`), because it modifies the summed offset rather than the fluid field. Being
 *    uploaded next to two genuinely style-6 uniforms is the whole reason it read as a Fluid Feedback feature.
 *    The remaining two are here on merit: `strength` is `length(flOff)`, which is 0 without a fluid layer.
 *
 * ## Where the per-style settings actually live
 *
 * ⚠️ **A layer's `proceduralFlow` / `fluidFeedback` / `ifsParams` blocks are for SERIALISATION.** The live
 * values stay in `main.ts` (`currentProceduralFlow`, `currentFluidFeedback`, `currentIfsParams`) and are
 * handed in per frame, exactly as before — which is why the Visual FX tab's `flow.*` and `fluidFeedback.*`
 * descriptors keep working untouched. Allowing at most one layer per style is what makes that sound.
 */
/**
 * v8 `30.5` / `30.4` — **the three enumeration maps, and each is a compile proof rather than a lookup.**
 *
 * ⚠️ **`Record<Union, number>` IS THE INSTRUMENT.** Each replaced (or pre-empted) a ternary or an
 * `if`-chain over a string union — the shape that type-checks perfectly while mapping an unnamed member
 * to whatever the fallback happens to be. With a `Record`, **a new member is a compile error at the one
 * site that has to know its code**, and so is a removed one.
 */
const TIME_WARP_SOURCE_CODE: Record<TimeWarpSource, number> = { field: 0, density: 1, coordinate: 2 };
const TIME_WARP_AXIS_CODE: Record<'x' | 'y' | 'radial', number> = { x: 0, y: 1, radial: 2 };
const CONFORMAL_MAP_CODE: Record<NonNullable<ConformalConfig['map']>, number> =
  { power: 0, inverse: 1, logPolar: 2, mobius: 3 };

/**
 * v8 `32.8` (`E127`) ⚠⚠ **the fourth enumeration map, and it REPLACED A LIVE TERNARY rather
 * than pre-empting one.**
 *
 * ⚠⚠ **THE OLD READ WAS `refract?.source === 'luminance' ? 1 : 0` AND WIDENING THE UNION LEFT
 * `tsc` COMPLETELY CLEAN** — measured, 2026-10-26: every branch is still a `number`, so three new
 * members silently mapped to `0` (density) and the dropdown would have changed a stored word and selected
 * nothing. **This is the identical defect `CLAUDE.md` already records for `E126`'s Time Warp source,
 * arriving a second time in the sibling style**, which is why the rule is a `Record` and not vigilance.
 *
 * ⚠⚠ **IT SURVIVED THE BLUR SOURCES' REMOVAL (`32.12`) AND THAT IS DELIBERATE.** With two members a
 * ternary would work again, and reverting to one would restore the latent defect for the NEXT member
 * somebody adds: the whole point is that a new member becomes a compile error at the one site that has to
 * know its code. **A fix whose value is only visible when the list grows must not be undone when it
 * shrinks.** The same reasoning kept the validated read-back in `visual-fx.ts`.
 */
const REFRACT_SOURCE_CODE: Record<NonNullable<RefractionConfig['source']>, number> =
  { density: 0, luminance: 1 };

export class TranslationMapProcessor {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private displacementTex: WebGLTexture | null = null;
  private uMixLoc: WebGLUniformLocation | null = null;
  // The remaining uniform locations, resolved in `init()` beside `uMixLoc` (triage H6). `uMixLoc` was
  // already cached and the other seventeen were not, which was an inconsistency rather than a design.
  // Safe because `init()` links the warp program exactly once per `init`, and the setters below only ever
  // mutate the VALUES uploaded through these — never the program.
  private uFrameLoc: WebGLUniformLocation | null = null;
  private uStaticFieldLoc: WebGLUniformLocation | null = null;
  private uFlowFieldLoc: WebGLUniformLocation | null = null;
  private uFluidFieldLoc: WebGLUniformLocation | null = null;
  private uLayerWeightLoc: WebGLUniformLocation | null = null;
  private uAmplifyLoc: WebGLUniformLocation | null = null;
  private uDispersionLoc: WebGLUniformLocation | null = null;
  private uGlowBoostLoc: WebGLUniformLocation | null = null;
  private uFeedbackPresentLoc: WebGLUniformLocation | null = null;
  private uMaxOffsetLoc: WebGLUniformLocation | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uStaticCountLoc: WebGLUniformLocation | null = null;
  private uStaticStyleLoc: WebGLUniformLocation | null = null;
  private uStaticCentreLoc: WebGLUniformLocation | null = null;
  private uStaticRatioLoc: WebGLUniformLocation | null = null;
  /**
   * The four per-layer wave index maps (`35.3`), one `vec4` array each:
   * `(cos, sin, centreIndex, rotatedLength)`.
   *
   * ⚠️⚠️ **`rotatedLength === 0` IS the "not rotated" flag, deliberately carried by the same float as the
   * clamp bound.** A separate boolean beside a separate length is precisely the flag-outliving-its-resource
   * shape (invariant 3): the two could disagree, and a true flag over a zero length would read texel −1.
   * One field, so the branch and the bound cannot come apart.
   */
  private uStaticWaveXLoc: WebGLUniformLocation | null = null;
  private uStaticWaveYLoc: WebGLUniformLocation | null = null;
  /** Style 3's ZOOM half — `angleX2`/`angleY2`, a second function's parameters, not a second pair. */
  private uStaticWaveZXLoc: WebGLUniformLocation | null = null;
  private uStaticWaveZYLoc: WebGLUniformLocation | null = null;
  private uBandBlurLoc: WebGLUniformLocation | null = null;

  private uBandAmountLoc: WebGLUniformLocation | null = null;
  private uRefractGainLoc: WebGLUniformLocation | null = null;
  private uRefractReachLoc: WebGLUniformLocation | null = null;
  private uRefractInvertLoc: WebGLUniformLocation | null = null;
  private uRefractSourceLoc: WebGLUniformLocation | null = null;
  private uVortexGainLoc: WebGLUniformLocation | null = null;
  // v8 30.4 (E125) — style 12. `uConformalMapLoc` is uploaded -1 when no style-12 layer is live, which is
  // the bit-identical no-op; see the shader's own note on why it is an int rather than a bool.
  private uConformalMapLoc: WebGLUniformLocation | null = null;
  private uConformalWeightLoc: WebGLUniformLocation | null = null;
  private uConformalCentreLoc: WebGLUniformLocation | null = null;
  private uConformalPowerLoc: WebGLUniformLocation | null = null;
  private uConformalMobiusABLoc: WebGLUniformLocation | null = null;
  private uConformalMobiusCLoc: WebGLUniformLocation | null = null;
  private uVortexWeightLoc: WebGLUniformLocation | null = null;
  private uVortexCentreLoc: WebGLUniformLocation | null = null;
  private uVortexRadiusLoc: WebGLUniformLocation | null = null;
  private uVortexInverseLoc: WebGLUniformLocation | null = null;
  private uHistoryLoc: WebGLUniformLocation | null = null;
  private uTimeWarpAmountLoc: WebGLUniformLocation | null = null;
  private uTimeWarpSourceLoc: WebGLUniformLocation | null = null;
  // v8 30.5 (E126) — the coordinate source's axis and bias. Unread unless `source: 'coordinate'`.
  private uTimeWarpAxisLoc: WebGLUniformLocation | null = null;
  private uTimeWarpBiasLoc: WebGLUniformLocation | null = null;
  private uDepthLoc: WebGLUniformLocation | null = null;
  private uParallaxAmountLoc: WebGLUniformLocation | null = null;
  private uParallaxNearLoc: WebGLUniformLocation | null = null;
  private uParallaxFarLoc: WebGLUniformLocation | null = null;
  private uParallaxSquaredLoc: WebGLUniformLocation | null = null;
  private uParallaxBandLoLoc: WebGLUniformLocation | null = null;
  private uParallaxBandScaleLoc: WebGLUniformLocation | null = null;
  /**
   * The figure's measured depth band, handed in by `main.ts` beside the depth texture (v8 Step 14.7b).
   *
   * ⚠️ **Defaults to the identity `0…1`, so a caller that never calls `setDepthBand()` gets `'canvas'`
   * behaviour** rather than a band of `undefined` collapsing to NaN — this processor is constructed by the
   * preview tiles too, and a tile that renders style 11 without wiring the band must degrade to the raw scale,
   * not to a dead frame.
   */
  private depthBandLo = 0;
  private depthBandHi = 1;
  private uIfsFrameLoc: WebGLUniformLocation | null = null;
  private uIfsCountLoc: WebGLUniformLocation | null = null;
  private uIfsMixLoc: WebGLUniformLocation | null = null;
  private uIfsDataLoc: WebGLUniformLocation | null = null;
  private uIfsWeightsLoc: WebGLUniformLocation | null = null;
  /**
   * `?gldiag=1`'s trail-guard release value, resolved per program because BOTH of this class's programs carry
   * a copy of `sanitiseTrail` (the warp pass and the echo pass, each of which can be the terminal write to
   * `texA`).
   *
   * ⚠️ **Re-uploaded per pass rather than once at init, unlike `main.ts`'s two blits.** Those programs are
   * `const` and outlive the session; these are relinked whenever the chain or the canvas size changes, and a
   * relink invalidates every location — so a set-once here would silently lapse the first time the user
   * touched a chain row, in exactly the session the diagnostic was turned on for. One `uniform1f` per pass.
   */
  private uDiagSentinelLoc: WebGLUniformLocation | null = null;
  private uIfsDiagSentinelLoc: WebGLUniformLocation | null = null;
  /** 0 = shipped behaviour (guard releases to black). Set to `DIAG_SENTINEL` only by `setDiagSentinel()`. */
  private diagSentinel = 0;
  private width = 0;
  private height = 0;
  private enabled = false;
  private mix = 1.0;
  /** `1 - attractorBlend`, un-exempted. Applied per layer in `layerWeights()`; style 6 is the exemption. */
  private fractalFade = 1.0;

  /** The live chain. Always normalised; `[]` only when TransMap is disabled. */
  private chain: TransMapLayer[] = [];
  private plan: ChainPlan = buildChainPlan([]);
  /**
   * Signature of what `displacementTex` was built from — `style:ratio:cx:cy` per static layer.
   * A weight change on a SINGLE static layer does not alter it (the ratio stays 1), so dragging that
   * slider costs no rebuild; only a multi-static ratio change does.
   */
  private staticSignature = '';
  /** Largest static-layer weight; the texture holds `Σ offset_i * (w_i / this)`. See `layerWeights()`. */
  private staticWeightScale = 1.0;

  // Procedural Flow resources (a style-5 layer)
  private flowGenerator: ProceduralFlowGenerator | null = null;

  // IFS Fractal Feedback resources (a style-4 layer)
  private ifsProgram: WebGLProgram | null = null;
  private ifsVao: WebGLVertexArrayObject | null = null;

  // Fluid Feedback inputs (a style-6 layer)
  private fluidVelocityTex: WebGLTexture | null = null;
  private fluidAmplify = 1.0;
  private fluidGlowBoost = 0.0;

  /**
   * Chromatic dispersion over the whole chain, 0..0.5 — see the upload site and `overlay.transMapDispersion`.
   *
   * ⚠️ **Deliberately NOT in the block above.** It lived there as `fluidDispersion` until 2026-08-20 and the
   * grouping was the defect: it made a chain-level quantity look like style-6 state, which is what kept it
   * gated behind the fluid layer. It has ONE writer (`setDispersion`), where `fluidAmplify` and
   * `fluidGlowBoost` are set together by `setFluidFeedbackParams` — two writers for one uniform is how the
   * per-frame fluid config would silently overwrite a global control.
   */
  private dispersion = 0.0;

  /**
   * 1×1 RG zero texture bound to every field sampler that has no layer this frame.
   *
   * ⚠️ **Invariant 4 — this is the highest-risk part of the whole chain feature.** The warp program declares
   * FOUR samplers; in a multi-sampler program every sampler must be assigned its unit UNCONDITIONALLY and
   * must always have a texture bound there (a 1×1 fallback, never `null`), or an absent field layer can
   * resolve the entire draw BLACK with no error and no log. Invariant 3 rides along: a nonzero weight over a
   * null texture is exactly the "true flag over a null texture" failure.
   */
  private zeroFieldTex: WebGLTexture | null = null;

  /**
   * Scratch render target for a two-pass chain (warp + echo), allocated ONLY when one is configured.
   *
   * The outer contract is fixed: read `texB`, leave the result in `fboA`. Step 1's decay and Step 4's bloom
   * both depend on that ping-pong, and `fboB` is the particle accumulation buffer next frame's decay reads,
   * so it cannot be borrowed. Hence `texB -> fboScratch -> fboA`.
   */
  private fboScratch: WebGLFramebuffer | null = null;
  private texScratch: WebGLTexture | null = null;
  private scratchFailed = false;

  /**
   * Style 9's low-frequency base — its OWN half-resolution blur target, deliberately not bloom's mip chain.
   *
   * ⚠️ **Reusing `bloom.ts`'s first mip level was the cheaper option and is the wrong one.** It would make a
   * TransMap layer silently depend on Bloom being enabled, and a `uBandAmount > 0` over a disabled bloom's
   * texture is invariant 3 exactly — a true flag over a null texture, which can resolve the whole
   * four-sampler warp draw black rather than merely dropping the band term. The own target costs
   * `(w/2) * (h/2) * 8` bytes at RGBA16F — 1.98 MB at 1080p — allocated ONLY while a style-9 layer is live
   * (`plan.needsBandBlur`), and it is released the moment the layer is removed or muted.
   *
   * Two ping-pong targets because the blur is SEPARABLE: horizontal into `A`, vertical into `B`, and `B` is
   * what the warp samples. A single-pass 2D blur at radius 16 would be 1089 taps against 2 x 33.
   */
  private bandBlurProgram: WebGLProgram | null = null;
  private bandBlurVao: WebGLVertexArrayObject | null = null;
  private fboBandA: WebGLFramebuffer | null = null;
  private texBandA: WebGLTexture | null = null;
  private fboBandB: WebGLFramebuffer | null = null;
  private texBandB: WebGLTexture | null = null;
  private bandFailed = false;
  private uBandSrcLoc: WebGLUniformLocation | null = null;
  private uBandStepLoc: WebGLUniformLocation | null = null;
  private uBandSigmaLoc: WebGLUniformLocation | null = null;

  /**
   * Style 8's one frame of history — a FULL-RESOLUTION `RGBA16F` of its own.
   *
   * ⚠️ **Step 14.3's "one frame of history costs nothing" premise was FALSIFIED, and this target is the cost.**
   * The obvious reading is that `texA` already holds last frame's warp output, so style 8 could sample it for
   * free. But the warp pass RENDERS INTO `fboA` and `texA` is that FBO's own colour attachment: sampling it
   * inside the pass that writes it is a framebuffer feedback loop, undefined in WebGL2 and **silent on ANGLE**
   * — invariant 20's failure shape, not an error. Extending `fboScratch` was the other candidate and is worse:
   * that target is the echo intermediate, live in exactly the chains most likely to also want style 8, and it
   * sits behind a `scratchFailed` latch whose fallback (drop the echo) would then also silently drop history.
   *
   * `width × height × 8` bytes — **8.3 MB at 1080p** — allocated only while a style-8 layer is live at
   * `amount > 0` (`plan.needsHistory`) and released the moment it is removed, muted or zeroed.
   *
   * The copy is a `copyTexImage2D`-free blit of the pass's OWN OUTPUT at the end of `applyWarpPass`, so the
   * history is always exactly one warp older than the frame reading it — never two, and never the same frame.
   */
  private texHistory: WebGLTexture | null = null;
  private fboHistory: WebGLFramebuffer | null = null;
  private historyFailed = false;
  /**
   * False until the first frame has been copied into `texHistory`.
   *
   * ⚠️ **Load-bearing, and its absence would be invisible on the SECOND frame onward.** A freshly allocated
   * history target is cleared to transparent black, so frame 1 would lerp the figure toward nothing — a visible
   * flash on every chain edit, resolution change and preset load, i.e. exactly when the user is watching. The
   * shader is handed `uTimeWarpAmount = 0` until this is true, which is byte-identical to no layer.
   */
  private historyPrimed = false;

  /**
   * Style 11's depth source — **owned by `main.ts`, not by this class.**
   *
   * ⚠️ **A borrowed handle, so it must NOT be deleted here** (the mirror image of invariant 1: nulling is this
   * class's job, deleting is the owner's). It is set every frame by `setDepthTexture()` and falls back to
   * `zeroFieldTex` when absent, because unit 6 is bound unconditionally (invariant 4) and a depth of 0 makes
   * the parallax multiplier read `uParallaxFar` uniformly — which `uParallaxAmount = 0` then cancels anyway.
   */
  private depthTex: WebGLTexture | null = null;

  // ⚠️ The COMBINE PASS lived here — `combineProgram`, `combineVao`, `combinedFieldTex`,
  // `combinedFieldFBO`, three uniform locations, `combineFailed`, plus `ensureCombine`,
  // `releaseCombine`, `disposeCombine`, `renderCombinedField` and `createCombineProgram`. Deleted
  // 2026-08-20 as UNREACHABLE, not as tidiness.
  //
  // It existed to sum two force-feeding field textures into one, because `TransMapForceField` does a
  // single `readPixels` from a single texture. Its gate was `forceFieldLayerCount() > 1`, i.e. "a static
  // layer AND the flow layer". Styles 0-3 stopped feeding that path on the same day — they are sampled
  // analytically now (`sampleStaticOffset()`) — and the chain permits at most ONE style-5 layer, so the
  // count is 0 or 1 and the gate is provably never true.
  //
  // ⚠️ Left in place it would have been worse than dead: `renderCombinedField()` bound
  // `displacementTex` as a canvas-sized RGBA field and sampled it with `texture(uStaticField, vUv)`,
  // and that handle now points at a `max(w,h) x 8` WAVE table. Reaching it would have read wave
  // amplitudes as UV offsets. If a second readback-fed field style is ever added, restore this from git
  // rather than reconstructing it — and re-check that assumption first.

  init(gl: WebGL2RenderingContext, config: TransMapConfig): void {
    this.gl = gl;
    this.width = config.width;
    this.height = config.height;
    this.enabled = config.enabled;

    if (!config.enabled) {
      this.chain = [];
      this.plan = buildChainPlan([]);
      return;
    }

    // One warp program for every field layer, always linked when enabled — a merged shader replaces the
    // three that used to be selected between. ⚠️ The `label` is load-bearing: a shader that fails to
    // compile still links, still binds, and every draw succeeds as a NO-OP (a silently black frame), so
    // without it nothing says which of 33 shaders failed.
    this.program = this.createWarpProgram(gl);
    this.uMixLoc = gl.getUniformLocation(this.program, 'uMix');
    this.uFrameLoc = gl.getUniformLocation(this.program, 'uFrame');
    this.uStaticFieldLoc = gl.getUniformLocation(this.program, 'uStaticField');
    this.uFlowFieldLoc = gl.getUniformLocation(this.program, 'uFlowField');
    this.uFluidFieldLoc = gl.getUniformLocation(this.program, 'uFluidField');
    this.uLayerWeightLoc = gl.getUniformLocation(this.program, 'uLayerWeight');
    this.uAmplifyLoc = gl.getUniformLocation(this.program, 'uAmplify');
    this.uDispersionLoc = gl.getUniformLocation(this.program, 'uDispersion');
    this.uGlowBoostLoc = gl.getUniformLocation(this.program, 'uGlowBoost');
    this.uFeedbackPresentLoc = gl.getUniformLocation(this.program, 'uFeedbackPresent');
    this.uMaxOffsetLoc = gl.getUniformLocation(this.program, 'uMaxOffset');
    this.uResolutionLoc = gl.getUniformLocation(this.program, 'uResolution');
    this.uStaticCountLoc = gl.getUniformLocation(this.program, 'uStaticCount');
    this.uStaticStyleLoc = gl.getUniformLocation(this.program, 'uStaticStyle[0]');
    this.uStaticCentreLoc = gl.getUniformLocation(this.program, 'uStaticCentre[0]');
    this.uStaticRatioLoc = gl.getUniformLocation(this.program, 'uStaticRatio[0]');
    this.uStaticWaveXLoc = gl.getUniformLocation(this.program, 'uStaticWaveX[0]');
    this.uStaticWaveYLoc = gl.getUniformLocation(this.program, 'uStaticWaveY[0]');
    this.uStaticWaveZXLoc = gl.getUniformLocation(this.program, 'uStaticWaveZX[0]');
    this.uStaticWaveZYLoc = gl.getUniformLocation(this.program, 'uStaticWaveZY[0]');
    this.uBandBlurLoc = gl.getUniformLocation(this.program, 'uBandBlur');
    this.uBandAmountLoc = gl.getUniformLocation(this.program, 'uBandAmount');
    this.uRefractGainLoc = gl.getUniformLocation(this.program, 'uRefractGain');
    this.uRefractReachLoc = gl.getUniformLocation(this.program, 'uRefractReach');
    this.uRefractInvertLoc = gl.getUniformLocation(this.program, 'uRefractInvert');
    this.uRefractSourceLoc = gl.getUniformLocation(this.program, 'uRefractSource');
    this.uVortexGainLoc = gl.getUniformLocation(this.program, 'uVortexGain');
    this.uConformalMapLoc = gl.getUniformLocation(this.program, 'uConformalMap');
    this.uConformalWeightLoc = gl.getUniformLocation(this.program, 'uConformalWeight');
    this.uConformalCentreLoc = gl.getUniformLocation(this.program, 'uConformalCentre');
    this.uConformalPowerLoc = gl.getUniformLocation(this.program, 'uConformalPower');
    this.uConformalMobiusABLoc = gl.getUniformLocation(this.program, 'uConformalMobiusAB');
    this.uConformalMobiusCLoc = gl.getUniformLocation(this.program, 'uConformalMobiusC');
    this.uVortexWeightLoc = gl.getUniformLocation(this.program, 'uVortexWeight');
    this.uVortexCentreLoc = gl.getUniformLocation(this.program, 'uVortexCentre');
    this.uVortexRadiusLoc = gl.getUniformLocation(this.program, 'uVortexRadius');
    this.uVortexInverseLoc = gl.getUniformLocation(this.program, 'uVortexInverse');
    this.uHistoryLoc = gl.getUniformLocation(this.program, 'uHistory');
    this.uTimeWarpAmountLoc = gl.getUniformLocation(this.program, 'uTimeWarpAmount');
    this.uTimeWarpSourceLoc = gl.getUniformLocation(this.program, 'uTimeWarpSource');
    this.uTimeWarpAxisLoc = gl.getUniformLocation(this.program, 'uTimeWarpAxis');
    this.uTimeWarpBiasLoc = gl.getUniformLocation(this.program, 'uTimeWarpBias');
    this.uDepthLoc = gl.getUniformLocation(this.program, 'uDepth');
    this.uParallaxAmountLoc = gl.getUniformLocation(this.program, 'uParallaxAmount');
    this.uParallaxNearLoc = gl.getUniformLocation(this.program, 'uParallaxNear');
    this.uParallaxFarLoc = gl.getUniformLocation(this.program, 'uParallaxFar');
    this.uParallaxSquaredLoc = gl.getUniformLocation(this.program, 'uParallaxSquared');
    this.uParallaxBandLoLoc = gl.getUniformLocation(this.program, 'uParallaxBandLo');
    this.uParallaxBandScaleLoc = gl.getUniformLocation(this.program, 'uParallaxBandScale');
    this.uDiagSentinelLoc = gl.getUniformLocation(this.program, 'uDiagSentinel');
    this.vao = this.createQuad(gl);
    this.zeroFieldTex = this.createZeroFieldTexture(gl);

    const chain = config.chain && config.chain.length > 0
      ? normaliseChain(config.chain)
      : [this.legacyLayer(config)];
    this.setChain(chain, config);
  }

  /** The one-layer chain a pre-chain config describes. Carries `ifsParams` so a style-4 preset keeps them. */
  private legacyLayer(config: TransMapConfig): TransMapLayer {
    const layer = makeLayer(config.style, 1.0);
    if (config.style === 4 && config.ifsParams) layer.ifsParams = config.ifsParams.map(t => ({ ...t }));
    return layer;
  }

  /**
   * Install a chain, creating and releasing only the resources whose need actually changed.
   *
   * ⚠️ **Deliberately NOT `dispose()` + `init()`.** A weight drag or a per-layer mute must not recompile a
   * shader or rebuild the wave field, and rebuilding the flow generator would restart its noise phase — a
   * visible jump. So each resource is keyed on its own predicate, and the static field is keyed on a
   * SIGNATURE rather than on "the chain changed": a single static layer's ratio is always 1.0, so dragging
   * its weight rebuilds nothing.
   *
   * ⚠️ **The signature includes the static-field SHAPE but not its magnitude.** `pattern`/`pattern2`/
   * `detail`/`zoomBias` change the wave arrays; `strength`/`strength2` are folded into the gain, and `drift`
   * is a phase — including those would rebuild the field on every frame of a slider drag, and drift changes
   * every frame BY DESIGN, so it would pin the 0.8 ms gain solve to the frame loop. That split is the same
   * one `chainSignature()` makes, for the same reason (invariant 8). ⚠️ **`strength`/`strength2` ARE in the
   * signature today** — read the string below rather than this paragraph's first sentence: the gain solve is
   * on the archetype branch only, `drift`'s VALUE is the one term that is genuinely excluded, and a Strength
   * drag does rebuild the field. Stated because the two sat one line apart and disagreed.
   *
   * ⚠️ **`drift` is excluded as a value and INCLUDED as a boolean (2026-09-22)** — the comment at the term
   * itself owns the reason, which is a freeze on the way back to 0 that no measurement could see. Do not
   * "simplify" the two into one by dropping the flag or by admitting the number.
   *
   * ⚠️ **AND THE WAVE TABLES ARE PART OF THE SHAPE (v8 21.12).** They were absent from this signature for as
   * long as they were immutable: `sinMagicParams` reached the pass only through `init`, so nothing could
   * change one without a dispose+init. The Transmap tab makes them editable, and the `!arch` branch of
   * `resolveStaticWaves` reads *nothing else* — so without the digest below a term edit would assign a new
   * `lastConfig`, leave the signature equal, skip `rebuildStaticField`, and render the OLD field while every
   * control, readout and picture in the tab showed the new one. **A digest of the tables, not of the layer**:
   * the tables are per-PRESET and shared by every separable layer, so one entry per `setChain` is the whole
   * of it, and it is appended only when a static layer exists so a chain with none keeps its empty signature.
   */
  setChain(chain: readonly TransMapLayer[], config?: TransMapConfig): void {
    const gl = this.gl;
    this.chain = normaliseChain(chain);
    this.plan = buildChainPlan(this.chain);
    if (!gl || !this.enabled) return;

    // --- static wave field (styles 0-3), summed ---
    const statics = this.plan.staticStyles;
    this.staticWeightScale = statics.reduce((m, l) => Math.max(m, l.weight), 0) || 1.0;
    const cx = config?.zoomCenterX ?? this.lastConfig?.zoomCenterX ?? 50;
    const cy = config?.zoomCenterY ?? this.lastConfig?.zoomCenterY ?? 50;
    if (config) this.lastConfig = config;
    // Any nonzero drift on an enabled layer turns on the per-frame rebuild — and nothing else does.
    this.hasDrift = statics.some(l => staticFieldOf(l).drift !== 0);
    const signature = statics.length === 0 ? '' : statics
      .map(l => {
        const s = staticFieldOf(l);
        /*
         * ⚠️ **`drift` enters the signature as a BOOLEAN and must never enter it as a VALUE.** The value changes
         * the phase only, and `updateDrift()` re-solves every frame while it is nonzero, so putting the number
         * here would pin the 0.8-1.16 ms gain solve to a slider drag for no change in the field's shape. But its
         * on/off state is a genuine shape event in ONE direction that nothing else could see: dragging drift
         * back to 0 flips `hasDrift` false, `updateDrift()` returns immediately, and the displacement texture is
         * left **frozen at the last drifted phase** — a field visibly offset from every number the panel shows,
         * for the rest of the session, with no error, no console line and a green `verify`. Two values, one
         * transition each way, so the drag itself still costs nothing.
         *
         * ⚠️⚠️ **THE FOUR SHAPE FIELDS ENTER AS VALUES, NOT AS `drift`'s BOOLEAN.** A shape, a shape mix and
         * a zoom-half shape are all STATIC: nothing re-solves them per frame, so the reasoning above does not
         * transfer. Reducing one to an on/off bit would freeze the field mid-drag at the last rebuilt setting,
         * which is the documented `hasDrift` defect in a new place. ⚠️ **And omitting one means `strength` keeps
         * the PREVIOUS shape's gain calibration** until something else dirties the chain, while the panel's own
         * readouts — which resolve through `resolveStaticWaves` directly — show the NEW field over the old
         * canvas. That is the exact pair of symptoms `tableDigest` was added for in v8 21.12.
         *
         * ⚠️ `shapeMix` is at `detail`'s precision and for `detail`'s reason: it changes the built ARRAYS, so a
         * drag must rebuild. `strength` is excluded because it is applied as a gain; a mix is not.
         *
         * ⚠️⚠️ **THE FOUR ANGLES (`35.3`) ENTER AS VALUES TOO, AND THEY ARE THE STRONGEST CASE IN THE STRING
         * SO FAR: they change the ARRAY LENGTHS as well as the contents.** A rotated axis widens its table
         * from `max(w,h)` to `hypot(w,h)`, so an omitted angle leaves `waveTexWidth` describing a texture of
         * a different size — and `buildStaticWaveTexture`'s reuse test would `texSubImage2D` the new data
         * into the old dimensions. ⚠️ **And `strength` would carry the PREVIOUS orientation's calibration**,
         * because both gain solves now sample through the maps (measured spread 1.221× on `Turbulent
         * Weave`), while `field-measure.ts`' readouts resolve through `resolveStaticWaves` directly and
         * would show the new field over the old canvas — v8 21.12's exact pair of symptoms.
         */
        return `${l.style}:${(l.weight / this.staticWeightScale).toFixed(4)}:${l.zoomCenter?.x ?? cx}:${l.zoomCenter?.y ?? cy}`
          + `:${s.pattern}:${s.pattern2}:${s.detail.toFixed(4)}:${s.zoomBias.toFixed(4)}`
          + `:${s.strength.toFixed(4)}:${s.strength2.toFixed(4)}:${s.drift !== 0 ? 'd' : '-'}`
          + `:${s.shape}:${s.shapeMix.toFixed(4)}:${s.shape2}:${s.shapeMix2.toFixed(4)}`
          + `:${s.angleX.toFixed(4)}:${s.angleY.toFixed(4)}`
          + `:${s.angleX2.toFixed(4)}:${s.angleY2.toFixed(4)}`;
      })
      .join('|') + `|T${tableDigest(this.lastConfig)}`;
    if (signature !== this.staticSignature) {
      this.staticSignature = signature;
      if (statics.length > 0 && this.lastConfig) {
        // Phase 0 here: `updateDrift()` re-resolves per frame when some layer drifts, and a drifting
        // layer's first frame arrives before anything is shown.
        this.rebuildStaticField(0);
      } else if (this.displacementTex) {
        // ⚠️ Delete AND null (invariant 1): a handle left pointing at a deleted texture is precisely the
        // use-after-dispose that once handed the force field a freed texture to `readPixels` from.
        // `waveTexWidth` and `resolvedStatics` must die with it too — the first would let the next build
        // `texSubImage2D` into a deleted texture, and the second would leave `sampleStaticOffset()`
        // returning offsets for a chain that no longer has a static layer (invariant 3's shape: state
        // outliving its resource).
        gl.deleteTexture(this.displacementTex);
        this.displacementTex = null;
        this.waveTexWidth = 0;
        this.resolvedStatics = [];
      }
    }

    // --- procedural flow generator (style 5) ---
    if (this.plan.flowLayer && !this.flowGenerator) {
      this.flowGenerator = new ProceduralFlowGenerator();
      this.flowGenerator.init(gl, this.width, this.height);
    } else if (!this.plan.flowLayer && this.flowGenerator) {
      this.flowGenerator.dispose();
      this.flowGenerator = null;
    }

    // --- echo program (style 4) ---
    if (this.plan.echoLayer && !this.ifsProgram) {
      this.ifsProgram = this.createIfsProgram(gl);
      this.ifsVao = this.createQuad(gl, this.ifsProgram);
      this.uIfsFrameLoc = gl.getUniformLocation(this.ifsProgram, 'uFrame');
      this.uIfsCountLoc = gl.getUniformLocation(this.ifsProgram, 'uIfsCount');
      this.uIfsMixLoc = gl.getUniformLocation(this.ifsProgram, 'uMix');
      this.uIfsDataLoc = gl.getUniformLocation(this.ifsProgram, 'uIfs[0]');
      this.uIfsWeightsLoc = gl.getUniformLocation(this.ifsProgram, 'uIfsWeights[0]');
      this.uIfsDiagSentinelLoc = gl.getUniformLocation(this.ifsProgram, 'uDiagSentinel');
    } else if (!this.plan.echoLayer && this.ifsProgram) {
      gl.deleteProgram(this.ifsProgram);
      if (this.ifsVao) gl.deleteVertexArray(this.ifsVao);
      this.ifsProgram = null; this.ifsVao = null;
      this.uIfsFrameLoc = null; this.uIfsCountLoc = null; this.uIfsMixLoc = null;
      this.uIfsDataLoc = null; this.uIfsWeightsLoc = null;
      this.uIfsDiagSentinelLoc = null;
    }

    // --- scratch target for a two-pass chain ---
    if (this.plan.needsScratch) {
      this.ensureScratch(gl);
    } else {
      this.releaseScratch(gl);
    }

    // --- band-split blur targets (style 9) ---
    // Keyed on `needsBandBlur`, which is `bandLayer && needsWarp` — so a style-9 layer sitting alone in the
    // chain allocates nothing, matching the fact that it CONTRIBUTES nothing there (the two blur samples
    // cancel exactly at zero offset). `bandFailed` is cleared on release so a later chain retries the
    // allocation rather than inheriting a latch from a resolution that no longer applies.
    if (this.plan.needsBandBlur) {
      this.ensureBandBlur(gl);
    } else if (this.fboBandA || this.bandFailed) {
      this.releaseBandBlur(gl);
      this.bandFailed = false;
    }

    // --- history target (style 8) ---
    // Same shape as the band targets: keyed on `needsHistory` (which folds in `needsWarp` AND `amount > 0`),
    // and the failure latch is cleared on release so a later chain retries rather than inheriting a latch from
    // a resolution that no longer applies. ⚠️ `historyPrimed` is cleared on BOTH branches, including the
    // allocate one: an existing target that survives a chain edit still holds a frame produced by the OLD
    // chain, and lerping toward it would show one frame of the previous warp on every chain edit.
    if (this.plan.needsHistory) {
      this.ensureHistory(gl);
      this.historyPrimed = false;
    } else if (this.fboHistory || this.historyFailed) {
      this.releaseHistory(gl);
      this.historyFailed = false;
      this.historyPrimed = false;
    }
  }

  /**
   * Hand this pass the depth texture style 11 reads. `null` unbinds it — see `depthTex`.
   *
   * ⚠️ Called every frame from `main.ts` rather than on chain change, because the depth target is reallocated
   * on every resize and a handle cached across one would be a use-after-delete.
   */
  setDepthTexture(tex: WebGLTexture | null): void {
    this.depthTex = tex;
  }

  /**
   * The figure's measured depth band for this frame, in TEXTURE units (0 = far, 1 = near) — the source for
   * `depthRange: 'figure'`. Handed in from `DepthFieldPass.getBand()` beside the texture itself.
   *
   * ⚠️ **Set it in the SAME place as the texture, never in a second one.** Depth and its band describe one
   * frame's geometry, and a band one frame out of step with the texture it describes is exactly the class of
   * asymmetry invariant 17 is about — with the added property here that it would be INVISIBLE on a slow figure,
   * because consecutive bands differ by ~0.0002.
   */
  setDepthBand(lo: number, hi: number): void {
    this.depthBandLo = Number.isFinite(lo) ? lo : 0;
    this.depthBandHi = Number.isFinite(hi) ? hi : 1;
  }

  /**
   * Resolve a style-11 layer's `depthRange` mode into the one `[lo, hi]` pair the shader consumes.
   *
   * ⚠️ **Delegates to `parallaxBandOf`, which is the ONE reader of the three modes.** It lives in
   * `trans-map-chain.ts` rather than here because that module is GL-free and therefore MEASURABLE by
   * `fieldcheck` §N — a three-way categorical decision whose wrong branches are all silent (`'canvas'` off the
   * identity, a negative manual span inverting near/far) is exactly what a grep cannot police.
   */
  private resolveParallaxBand(p: Required<ParallaxConfig>): { lo: number; hi: number } {
    const [lo, hi] = parallaxBandOf(p, this.depthBandLo, this.depthBandHi);
    return { lo, hi };
  }

  /**
   * Does this chain actually READ depth — i.e. is there a live style-11 layer with `amount > 0`?
   *
   * ⚠️ **The caller needs this to decide whether to ALLOCATE and RENDER the depth target at all** (v8 Step
   * 14.7). Without it `main.ts` would either run a full-canvas extra pass on all 359 presets, of which 1 uses
   * style 11 (`Sphere II`), or guess from the chain array and duplicate `buildChainPlan`'s `needsWarp && amount > 0`
   * conjunction — a second resolution of one condition, which is how the pair in invariant 17 came about.
   *
   * ⚠️ It is also the flag that must die with the resource (invariant 3): `apply()` binds the 1×1 fallback and
   * uploads `uParallaxAmount = 0` in exactly the cases this returns false, so a stale depth texture cannot be
   * sampled as if it held geometry.
   */
  needsDepth(): boolean {
    return this.enabled && this.plan.needsDepth;
  }

  /** The config last handed to `init`/`setChain`, kept so a chain edit can rebuild the static field. */
  private lastConfig: TransMapConfig | null = null;

  getChain(): TransMapLayer[] {
    return normaliseChain(this.chain);
  }

  /**
   * Field layers that feed the PARTICLE force path via a TEXTURE READBACK — style 5 only.
   *
   * ⚠️ **Styles 0-3 left this set on 2026-08-20 and that is not a regression** — they now feed the force
   * path ANALYTICALLY through `sampleStaticOffset()`, which evaluates the same 1D waves the shader reads,
   * per particle, with no GPU→CPU sync. They had to leave: the readback's source was the canvas-sized
   * displacement texture, and the separable rewrite does not produce one. What replaced it is strictly
   * cheaper — it deletes the largest of the engine's three synchronous `readPixels` calls (31.6 MB at
   * 1080p, every 4th frame) rather than shrinking it, and it removes the 4-frame staleness that readback
   * cadence imposed on what particles felt.
   *
   * ⚠️ **Style 6 feeds NO force path at all, and that exclusion is real rather than a gap.** Fluid Feedback
   * warps pixels from the 512² RGBA16F fluid velocity field; it never produces a canvas-resolution
   * displacement field, and particle coupling for the fluid is a separate feature with its own controls
   * (`overlay.fluidAdvection`). Enrolling it would need a resolution/format conversion AND would be a
   * visible behaviour change on a feature nobody asked to change — the force field pushes ~15× harder than
   * the warp step (8 px/frame clamp vs ≈0.54 px/frame). It still contributes to the WARP.
   *
   * ⚠️ **`forceFieldLayerCount()` was deleted here on 2026-08-20** — it answered "how many layers feed the
   * force path", a question that had exactly one purpose (deciding whether to combine two force textures)
   * and no longer has any: styles 0-3 are analytic, so the readback source is the flow texture or nothing.
   * Keeping a count that can only be 0 or 1 would have implied a combine case that cannot occur.
   */
  private forceReadbackLayerCount(): number {
    return this.plan.flowLayer ? 1 : 0;
  }

  /**
   * Per-family warp weight — `layer.weight × its own attractor-blend fade`, **without** the global `uMix`.
   *
   * The static entry also carries `staticWeightScale`, because the texture holds ratios (see `setChain`).
   * ⚠️ Style 6 alone omits `fractalFade`: it is the one style whose displacement source IS the motion being
   * displaced (the fluid velocity field is seeded from `state.positions`, which at blend 1.0 ARE the
   * attractor positions), so filaments smear ALONG their own flow rather than across it. Every other style's
   * source is unrelated to the attractor — a fixed wave table (0-3), an IFS transform (4), or procedural
   * noise (5) — and gets faded. This generalises `warpFadesWithFractalBlend()` from a per-instance boolean
   * to a per-layer factor; the single-layer case reproduces it exactly.
   */
  private layerWeights(): [number, number, number, number] {
    const fade = this.fractalFade;
    return [
      this.plan.staticStyles.length > 0 ? this.staticWeightScale * fade : 0,
      this.plan.flowLayer ? this.plan.flowLayer.weight * fade : 0,
      // No `fade` — style 6 is the exemption.
      this.plan.fluidLayer ? this.plan.fluidLayer.weight : 0,
      // Style 7 DOES fade. Its source is the trail's own density, which is not the attractor's position:
      // at blend 1.0 the figure is an attractor and its density gradient is still an unrelated quantity to
      // the direction that density is moving, so the style-6 argument for exemption does not transfer.
      this.plan.refractLayer ? this.plan.refractLayer.weight * fade : 0,
    ];
  }

  apply(readTex: WebGLTexture, writeFBO: WebGLFramebuffer | null, ifsParams?: IfsTransform[], time?: number, flowConfig?: ProceduralFlowConfig): void {
    const gl = this.gl;
    if (!gl || !this.enabled) return;

    // Advance the static field's drift phase BEFORE any pass reads it, and only when some layer drifts.
    // Placed here rather than in `main.ts` so the gate lives with the data it guards (I9's duplication).
    this.updateDrift(time ?? 0);

    const plan = this.plan;
    const hasEcho = plan.echoLayer !== null && this.ifsProgram !== null && this.ifsVao !== null;
    const hasWarp = plan.needsWarp && this.program !== null && this.vao !== null;

    if (!hasEcho && !hasWarp) {
      // Every layer muted or the chain is empty: fall through to a straight copy so the destination is not
      // left holding a stale frame. `main.ts` also blits when `isEnabled()` is false; this covers "enabled
      // but nothing to do", which the pre-chain code reached only by returning early (leaving fboA stale).
      this.blit(gl, readTex, writeFBO);
      return;
    }

    if (hasEcho && hasWarp) {
      const scratch = this.fboScratch;
      if (!scratch || !this.texScratch) {
        // ⚠️ Invariant 5 — an incomplete FBO throws nothing and logs nothing, and the trail goes black and
        // STAYS there. Degrade to the field-only chain rather than to a black frame.
        this.applyWarpPass(gl, readTex, writeFBO, time, flowConfig);
        return;
      }
      if (plan.echoFirst) {
        this.applyEchoPass(gl, readTex, scratch, ifsParams);
        this.applyWarpPass(gl, this.texScratch, writeFBO, time, flowConfig);
      } else {
        this.applyWarpPass(gl, readTex, scratch, time, flowConfig);
        this.applyEchoPass(gl, this.texScratch, writeFBO, ifsParams);
      }
      return;
    }

    if (hasEcho) {
      this.applyEchoPass(gl, readTex, writeFBO, ifsParams);
      return;
    }
    this.applyWarpPass(gl, readTex, writeFBO, time, flowConfig);
  }

  /**
   * The single warp pass — every enabled field layer at once.
   *
   * ⚠️ **All four samplers are assigned a unit and given a bound texture unconditionally** (invariant 4),
   * using `zeroFieldTex` wherever a layer is absent, and `activeTexture` is restored to unit 0 at the end.
   */
  private applyWarpPass(
    gl: WebGL2RenderingContext,
    readTex: WebGLTexture,
    writeFBO: WebGLFramebuffer | null,
    time?: number,
    flowConfig?: ProceduralFlowConfig,
  ): void {
    if (!this.program || !this.vao) return;
    const plan = this.plan;

    // The flow field must be regenerated before it is sampled. Self-gated on the plan, so no caller
    // re-tests the style (I9). Rebinds the FBO afterwards, which is why this precedes the bind below.
    if (plan.flowLayer && this.flowGenerator) {
      this.flowGenerator.render(
        time ?? 0,
        flowConfig ?? { strength: 0.3, scale: 1.5, curlAmount: 0.5, direction: [0, -1], radial: 0, evolutionSpeed: 0.8, archetype: 'Gentle Drift' },
      );
    }

    // Style 9's base is blurred from the INPUT frame, so it must be built BEFORE the FBO bind below — and it
    // reads `readTex`, the same texture the warp samples, which is why the two blur passes come first rather
    // than being interleaved. Self-gated on the plan, like the flow generator above (I9).
    const band = plan.bandLayer ? bandSplitOf(plan.bandLayer) : null;
    const bandLive = band !== null && band.amount > 0 && this.fboBandB !== null && this.texBandB !== null;
    if (bandLive) {
      this.renderBandBlur(gl, readTex, band!.radius * this.bandRadiusScale);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);

    const fallback = this.zeroFieldTex;
    const flowTex = (plan.flowLayer && this.flowGenerator ? this.flowGenerator.getTexture() : null) ?? fallback;
    const fluidTex = (plan.fluidLayer ? this.fluidVelocityTex : null) ?? fallback;
    const staticTex = (plan.staticStyles.length > 0 ? this.displacementTex : null) ?? fallback;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(this.uFrameLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, staticTex);
    gl.uniform1i(this.uStaticFieldLoc, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.uniform1i(this.uFlowFieldLoc, 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, fluidTex);
    gl.uniform1i(this.uFluidFieldLoc, 3);

    // ⚠️ Invariant 4 — unit 4 is assigned and bound UNCONDITIONALLY, with the 1×1 zero texture standing in
    // when no band layer is live. An unassigned fifth sampler defaults to unit 0 on top of `uFrame`, and some
    // drivers resolve the WHOLE draw black rather than ignoring it; `uBandAmount` below is what actually
    // decides whether it is read, and it is 0 in exactly the cases this binds the fallback.
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, (bandLive ? this.texBandB : null) ?? fallback);
    gl.uniform1i(this.uBandBlurLoc, 4);

    // Units 5 and 6 — styles 8 and 11. ⚠️ Invariant 4 again, and the risk grows with every sampler: the
    // program now declares SEVEN, and an unassigned one defaults to unit 0 on top of `uFrame`, which some
    // drivers resolve as a wholly black draw rather than as a bad read. `uTimeWarpAmount`/`uParallaxAmount`
    // below are what decide whether either is actually sampled, and both are 0 in exactly the cases these bind
    // the 1×1 fallback (invariant 3 — the flag dies with the resource).
    const historyLive = this.plan.needsHistory && this.texHistory !== null && this.historyPrimed;
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, (historyLive ? this.texHistory : null) ?? fallback);
    gl.uniform1i(this.uHistoryLoc, 5);

    const depthLive = this.plan.needsDepth && this.depthTex !== null;
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, (depthLive ? this.depthTex : null) ?? fallback);
    gl.uniform1i(this.uDepthLoc, 6);

    const [wStatic, wFlow, wFluid, wRefract] = this.layerWeights();
    // A weight over a MISSING texture is invariant 3's failure mode, so zero it explicitly rather than
    // relying on the fallback texture's zeros. Style 7 needs no texture of its own — it reads `uFrame`,
    // which is always bound — so its channel is gated on the LAYER instead.
    gl.uniform4f(
      this.uLayerWeightLoc,
      staticTex === fallback ? 0 : wStatic,
      flowTex === fallback ? 0 : wFlow,
      fluidTex === fallback ? 0 : wFluid,
      plan.refractLayer ? wRefract : 0,
    );
    gl.uniform1f(this.uMixLoc, this.mix);
    // 0 on every shipped path, so `sanitiseTrail` releases to black exactly as before.
    gl.uniform1f(this.uDiagSentinelLoc, this.diagSentinel);

    // Style 7's three scalars plus the resolution-independent gain.
    //
    // ⚠️ **The gain is solved here, on the CPU, against `min(w, h)` — this is the units trap the plan names.**
    // `refractOffset()` returns a per-texel slope of a soft-normalised gradient, i.e. a dimensionless number
    // in (-1, 1); multiplying by `strength * STATIC_FIELD_TARGET_FRACTION * min(w,h)` makes it PIXELS, and the
    // shader's final divide by `uResolution` makes it UV. So `strength` means the same visible fraction of the
    // frame at 600p, at 1080p and in a 256×192 tile, and it means the same thing a static layer's `strength`
    // means. A gradient left in raw texel units would have been 1.8× stronger at 1080p than at 600p.
    const refract = plan.refractLayer ? refractionOf(plan.refractLayer) : null;
    const refractTarget = STATIC_FIELD_TARGET_FRACTION * Math.min(this.width, this.height);
    gl.uniform1f(this.uRefractGainLoc, refract ? refract.strength * refractTarget : 0);
    // Never 0 — it divides inside `refractOffset()`, and although the whole term is branched out at gain 0,
    // a 0 here would make the *first* frame after enabling the layer produce a NaN offset if that branch were
    // ever loosened. `reach` is in full-resolution texels; a tile scales it (screen-space unit).
    gl.uniform1f(this.uRefractReachLoc, Math.max(0.25, (refract?.reach ?? 1) * this.refractReachScale));
    gl.uniform1f(this.uRefractInvertLoc, refract?.invert ? -1 : 1);
    /*
     * ⚠ **A `Record` LOOKUP, NOT A TERNARY — see `REFRACT_SOURCE_CODE`.**
     *
     * ⚠ **`!` RATHER THAN `?? 0`, AND THE DIFFERENCE IS THE WHOLE POINT OF THE `Record`.** The lookup is
     * typed `number | undefined` because of `noUncheckedIndexedAccess`, not because a member can be
     * missing — the key is the union and the `Record` is total, so `tsc` has already proved every member
     * has a code. **A `?? 0` here would silently restore the ternary's defect** by mapping any future
     * unmapped member to `density`, which is the failure this map exists to make impossible.
     */
    gl.uniform1i(this.uRefractSourceLoc, REFRACT_SOURCE_CODE[refract?.source ?? 'density']!);

    // Style 9. `bandLive` already folds in "amount > 0" AND "the targets exist", so an incomplete-FBO
    // fallback (invariant 5) lands here as 0 rather than as a sampler read of the 1×1 zero texture.
    gl.uniform1f(this.uBandAmountLoc, bandLive ? band!.amount : 0);

    // Style 10 — the vortex's closed-form gain, solved on the CPU against the same 8%-of-`min(w,h)` target
    // every other style uses (`vortexGain()`), so `swirl` means here what `strength` means there.
    //
    // ⚠️ **The gain carries the SIGN and the weight does not.** `swirl` is signed (it reverses the turn) while
    // `layerWeights()`-style factors are magnitudes, so folding the sign into the weight would make a negative
    // swirl at half weight read as a positive one. The shader's gate is `uVortexGain != 0.0`, not `> 0.0`, for
    // the same reason — `> 0.0` would have made every anticlockwise vortex silently inert.
    //
    // ⚠️ `radius` is NORMALISED and therefore NOT scaled by the preview tile's `SCREEN_SPACE_TILE_SCALE`, unlike
    // `refract.reach` two blocks up which is in texels. Decide by UNIT, not by field name.
    const vortex = plan.vortexLayer ? vortexOf(plan.vortexLayer) : null;
    gl.uniform1f(
      this.uVortexGainLoc,
      vortex ? vortexGain(vortex.swirl, vortex.radius, vortex.falloff, Math.min(this.width, this.height)) : 0,
    );
    gl.uniform1f(this.uVortexWeightLoc, plan.vortexLayer ? plan.vortexLayer.weight * this.fractalFade : 0);
    gl.uniform2f(this.uVortexCentreLoc, vortex?.centre.x ?? 0.5, vortex?.centre.y ?? 0.5);
    // Never 0 — it squares into a denominator inside `vortexOffset()`. `vortexGain()` applies the same floor on
    // the CPU side, so the two agree on what a hand-edited `radius: 0` means.
    gl.uniform1f(this.uVortexRadiusLoc, Math.max(0.01, vortex?.radius ?? 0.4));
    gl.uniform1f(this.uVortexInverseLoc, vortex?.falloff === 'inverse' ? 1 : 0);

    // Style 8. `historyLive` folds in "the target exists" AND "it has been written at least once", so the first
    // frame after a chain edit is byte-identical to no layer rather than a lerp toward transparent black.
    const timeWarp = plan.timeWarpLayer ? timeWarpOf(plan.timeWarpLayer) : null;
    gl.uniform1f(this.uTimeWarpAmountLoc, historyLive && timeWarp ? timeWarp.amount : 0);
    /*
     * v8 `30.5` — ⚠️ **AN EXHAUSTIVE MAP, NOT A TERNARY, AND THE REPLACEMENT IS THE WHOLE POINT OF THE
     * STEP.** This line read `timeWarp?.source === 'density' ? 1 : 0`, which type-checks for any number
     * of members and maps every one it does not name to `0`, i.e. silently to `'field'`.
     * `TIME_WARP_SOURCE_CODE` is a `Record<TimeWarpSource, number>`, so **adding a fourth member is a
     * compile error here** — the only place that could have been wrong. `RenderMode`'s rule, applied
     * before it cost anything this time.
     */
    gl.uniform1i(this.uTimeWarpSourceLoc, timeWarp ? TIME_WARP_SOURCE_CODE[timeWarp.source] : 0);
    gl.uniform1i(this.uTimeWarpAxisLoc, timeWarp ? TIME_WARP_AXIS_CODE[timeWarp.axis] : 0);
    gl.uniform1f(this.uTimeWarpBiasLoc, timeWarp?.bias ?? 0);

    /*
     * v8 `30.4` — Style 12, Conformal. ⚠️ **`-1` IS THE NO-OP, uploaded whenever no style-12 layer is
     * live**, so the fragment's branch is skipped rather than multiplied by zero — the same shape as the
     * vortex gain's 0 above, and the reason the uniform is an `int`.
     *
     * ⚠️ **`weight × fractalFade`, like every other field style**: style 12 is not one of the three
     * `weightless` modifiers and is not the one exempt style, so it fades with `attractorBlend`.
     */
    const conformal = plan.conformalLayer ? conformalOf(plan.conformalLayer) : null;
    gl.uniform1i(this.uConformalMapLoc, conformal ? CONFORMAL_MAP_CODE[conformal.map] : -1);
    gl.uniform1f(
      this.uConformalWeightLoc,
      plan.conformalLayer ? plan.conformalLayer.weight * this.fractalFade : 0,
    );
    gl.uniform2f(this.uConformalCentreLoc, conformal?.centre.x ?? 0.5, conformal?.centre.y ?? 0.5);
    gl.uniform1f(this.uConformalPowerLoc, conformal?.power ?? 2);
    const mb = conformal?.mobius;
    gl.uniform4f(this.uConformalMobiusABLoc, mb?.aRe ?? 1, mb?.aIm ?? 0, mb?.bRe ?? 0, mb?.bIm ?? 0);
    gl.uniform2f(this.uConformalMobiusCLoc, mb?.cRe ?? 0, mb?.cIm ?? 0);

    // Style 11. `depthLive` folds in "a depth texture was handed to us this frame", so an amount over a missing
    // depth target reads 0 rather than sampling the 1×1 fallback as a uniform depth of 0 (invariant 3).
    const parallax = plan.parallaxLayer ? parallaxOf(plan.parallaxLayer) : null;
    gl.uniform1f(this.uParallaxAmountLoc, depthLive && parallax ? parallax.amount : 0);
    gl.uniform1f(this.uParallaxNearLoc, parallax?.nearScale ?? 1);
    gl.uniform1f(this.uParallaxFarLoc, parallax?.farScale ?? 1);
    gl.uniform1f(this.uParallaxSquaredLoc, parallax?.curve === 'squared' ? 1 : 0);
    // ⚠️ **The three range modes are resolved to ONE pair of numbers here, so the shader has no mode branch.**
    // `'canvas'` is `0/1`, which makes the remap arithmetically the identity — that is what keeps the pre-14.7b
    // behaviour reachable EXACTLY rather than approximately, and it is why `depthRange` is categorical.
    // ⚠️ `depthLive` gates the band the same way it gates the amount: with no depth texture the fallback reads a
    // uniform 0, and a `'figure'` band measured on a previous frame would then remap that 0 to a full near-field
    // multiplier — a flag outliving its resource (invariant 3) with a visible consequence rather than a null one.
    const pxBand = depthLive && parallax ? this.resolveParallaxBand(parallax) : { lo: 0, hi: 1 };
    gl.uniform1f(this.uParallaxBandLoLoc, pxBand.lo);
    // ⚠️ Guarded on the CPU, not the GPU: a degenerate band would be a division by zero producing Inf, and Inf
    // multiplies into `off`, which is the SAMPLING COORDINATE for every tap below (invariant 20's shape).
    gl.uniform1f(this.uParallaxBandScaleLoc, pxBand.hi - pxBand.lo > 1e-6 ? 1 / (pxBand.hi - pxBand.lo) : 1);

    // The static family's per-layer descriptors. ⚠️ `uStaticCount` must be 0 whenever the wave texture is
    // the 1x1 fallback, or the shader's `texelFetch` loop reads texel (0,0) of a zero texture as a wave
    // value for every pixel — a flag outliving its resource (invariant 3), and the reason the count is
    // derived from `staticTex` rather than from the plan.
    const statics = staticTex === fallback ? [] : this.resolvedStatics;
    gl.uniform1i(this.uStaticCountLoc, Math.min(statics.length, 4));
    gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    if (statics.length > 0) {
      // Fixed-length arrays, always fully assigned: an unwritten slot would keep the previous chain's
      // style/centre for a layer index this chain does not have.
      const styles = new Int32Array(4);
      const centres = new Float32Array(8);
      const ratios = new Float32Array(4);
      // The four wave index maps (`35.3`). ⚠️ Zero-filled, and an all-zero `vec4` has `rotatedLength === 0`,
      // which the shader reads as NOT ROTATED — so an unwritten slot degrades to the pre-change sampler
      // rather than to a rotation by a stale angle.
      const mapX = new Float32Array(16);
      const mapY = new Float32Array(16);
      const mapZX = new Float32Array(16);
      const mapZY = new Float32Array(16);
      for (let i = 0; i < 4 && i < statics.length; i++) {
        const L = statics[i]!;
        styles[i] = L.style;
        centres[i * 2] = L.centreX;
        centres[i * 2 + 1] = L.centreY;
        ratios[i] = L.ratio;
        // ⚠️ Read off `L.maps`, which `resolveStaticWaves` published beside the arrays — never re-derived
        // from the layer's angles here. A second derivation is where the rotation and the table it indexes
        // come apart, and `fieldcheck` §D's text scan cannot see that (see `staticOffsetAt`'s header).
        const m = L.maps;
        if (m) {
          for (const [dst, a] of [[mapX, m.x], [mapY, m.y], [mapZX, m.zx], [mapZY, m.zy]] as const) {
            dst[i * 4] = a.cos;
            dst[i * 4 + 1] = a.sin;
            dst[i * 4 + 2] = a.centreIndex;
            dst[i * 4 + 3] = a.rotated ? a.length : 0;
          }
        }
      }
      gl.uniform1iv(this.uStaticStyleLoc, styles);
      gl.uniform2fv(this.uStaticCentreLoc, centres);
      gl.uniform1fv(this.uStaticRatioLoc, ratios);
      gl.uniform4fv(this.uStaticWaveXLoc, mapX);
      gl.uniform4fv(this.uStaticWaveYLoc, mapY);
      gl.uniform4fv(this.uStaticWaveZXLoc, mapZX);
      gl.uniform4fv(this.uStaticWaveZYLoc, mapZY);
    }

    // ⚠️ A flag must die with its resource. `uFeedbackPresent` gates `edgeFade` and the glow, and both are
    // style 6's semantics — so it is derived from the fluid layer BEING DRAWN, not merely configured.
    const feedback = fluidTex !== fallback ? 1 : 0;
    gl.uniform1f(this.uFeedbackPresentLoc, feedback);
    gl.uniform1f(this.uAmplifyLoc, this.fluidAmplify);
    // ⚠️ **`uDispersion` is NOT gated on `feedback`, and that is the 2026-08-20 change.** It used to be
    // `feedback ? this.fluidDispersion : 0`, sitting between two uniforms that ARE style-6 semantics — which
    // is how a general warp modifier came to look like a Fluid Feedback feature. The shader applies it to the
    // SUMMED offset `(sOff + fOff + flOff)`, so it was always style-agnostic; only this upload confined it.
    //
    // Not an invariant-3 violation (a flag over a dead resource): dispersion needs no resource of its own. It
    // is self-limiting instead — where `off` is zero all three taps collapse to the same texel, so a chain
    // with no field layer renders identically at any dispersion value. `uGlowBoost` below stays gated,
    // because `strength` is computed from `flOff` alone and would read 0 without the fluid layer anyway.
    gl.uniform1f(this.uDispersionLoc, this.dispersion);
    gl.uniform1f(this.uGlowBoostLoc, feedback ? this.fluidGlowBoost : 0);
    // Single field layer => no clamp, so styles 1-3 keep their full ±1.0 UV range. See MAX_CHAIN_OFFSET_UV.
    //
    // ⚠️ **Style 7 counts here, and forgetting it would have been silent.** This gate is about bounding a SUM,
    // so every term of `off` must be represented — a static + refraction chain has two contributors and would
    // otherwise inherit the single-layer unbounded path, where styles 1-3 legitimately reach ±1.0 UV. Nothing
    // in the type system connects this arithmetic to the sum three lines of GLSL away; it is the same shape as
    // the four implicit style enumerations Step 14.0 removed, and it is why the count is written per PLAN FIELD
    // rather than as a style test. A band layer is deliberately absent: it contributes no offset.
    //
    // ⚠️ **Style 10 counts and the three modifiers do not** — the test is "does this layer add a term to `off`",
    // which vortex does and Band Split, Time Warp and Depth Parallax provably do not (they recompose the colour,
    // blend against a history texture, and MULTIPLY the sum respectively). Parallax is the one worth stating:
    // it does change `off`'s magnitude, but it cannot turn a one-term sum into a two-term one, so it cannot
    // create the cancellation-overshoot this clamp exists to bound — and it is applied BEFORE the clamp, so the
    // clamp still bounds what it produces.
    const fieldCount = (plan.staticStyles.length > 0 ? 1 : 0)
      + (plan.flowLayer ? 1 : 0)
      + (plan.fluidLayer ? 1 : 0)
      + (plan.refractLayer ? 1 : 0)
      + (plan.vortexLayer ? 1 : 0);
    gl.uniform1f(this.uMaxOffsetLoc, fieldCount > 1 ? MAX_CHAIN_OFFSET_UV : NO_OFFSET_CLAMP);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    // Leave the unit cursor where the rest of the engine expects it (invariant 4).
    gl.activeTexture(gl.TEXTURE0);

    // Style 8 — snapshot THIS pass's output for the next frame to lerp against.
    //
    // ⚠️ **After the draw, and copying the DESTINATION, so the history is exactly one warp old.** Copying the
    // input (`readTex`) instead would hold the pre-warp frame, which is a different operator: the figure would
    // lerp toward its own unwarped self, i.e. a warp that partially undoes itself, rather than toward where it
    // was a frame ago.
    if (this.plan.needsHistory && this.fboHistory) {
      this.copyToHistory(gl, writeFBO);
    }
  }

  /**
   * Blit the warp pass's own output into `texHistory`, and mark it primed.
   *
   * ⚠️ **`blitFramebuffer`, not `copyTexImage2D`.** The latter would need the destination texture rebound and
   * respecified, and `copyTexSubImage2D` reads from the READ framebuffer anyway — so the framebuffer blit is
   * both the direct expression and the one the driver can fast-path. Same size, same format, `NEAREST`: a
   * scaling or format-converting blit on a multisampled or differently-sized pair is where this call throws.
   *
   * ⚠️ **`writeFBO` can be `null`, meaning the default framebuffer** (the chain's last pass writes the screen in
   * the tile renderer's single-pass configuration). Reading the default framebuffer here would capture whatever
   * the compositor holds, so that case skips the copy and leaves `historyPrimed` false — style 8 then stays
   * byte-identical to absent rather than sampling something unrelated.
   */
  private copyToHistory(gl: WebGL2RenderingContext, writeFBO: WebGLFramebuffer | null): void {
    if (!writeFBO || !this.fboHistory) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, writeFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fboHistory);
    gl.blitFramebuffer(
      0, 0, this.width, this.height,
      0, 0, this.width, this.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );
    // ⚠️ Restore BOTH binding points. `bindFramebuffer(FRAMEBUFFER, ...)` sets read and draw together, so a
    // leaked READ_FRAMEBUFFER survives every later `FRAMEBUFFER` bind and silently redirects the next
    // `readPixels` — which is how the force field's readback and the `?gldiag=1` probe would start reading the
    // history target. The same class of leak as the blend function of invariant 9.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.historyPrimed = true;
  }

  private applyEchoPass(
    gl: WebGL2RenderingContext,
    readTex: WebGLTexture,
    writeFBO: WebGLFramebuffer | null,
    ifsParams?: IfsTransform[],
  ): void {
    const layer = this.plan.echoLayer;
    if (!this.ifsProgram || !this.ifsVao || !layer) return;

    const source = ifsParams && ifsParams.length > 0 ? ifsParams : (layer.ifsParams ?? defaultIfsParams());
    const transforms = source.slice(0, 6);

    // Normalize weights
    const totalWeight = transforms.reduce((s, t) => s + t.weight, 0) || 1;

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.ifsProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(this.uIfsFrameLoc, 0);
    gl.uniform1i(this.uIfsCountLoc, transforms.length);
    // The echo's `uMix` is an opacity, not a displacement — the one place `uMix` lerps a COLOUR. Style 4
    // fades with the attractor blend like every style but 6.
    gl.uniform1f(this.uIfsMixLoc, Math.max(0, Math.min(1, this.mix * layer.weight * this.fractalFade)));
    // This pass carries its own copy of `sanitiseTrail` and can be the terminal write to texA, so it needs
    // the diagnostic release value too. 0 on every shipped path.
    gl.uniform1f(this.uIfsDiagSentinelLoc, this.diagSentinel);

    // Pack IFS params as vec4 arrays [angle_rad, scale, tx, ty] and weights
    const ifsData = new Float32Array(transforms.length * 4);
    const wData = new Float32Array(transforms.length);
    for (let i = 0; i < transforms.length; i++) {
      const tr = transforms[i]!;
      ifsData[i * 4]     = tr.angle * Math.PI / 180;
      ifsData[i * 4 + 1] = tr.scale;
      ifsData[i * 4 + 2] = tr.tx;
      ifsData[i * 4 + 3] = tr.ty;
      wData[i] = tr.weight / totalWeight;
    }
    gl.uniform4fv(this.uIfsDataLoc, ifsData);
    gl.uniform1fv(this.uIfsWeightsLoc, wData);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.ifsVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * Identity copy, used when the chain is enabled but has nothing to draw.
   *
   * Reuses the warp program with every layer weight at zero rather than linking a fifth shader — at
   * `uLayerWeight = 0` and `uFeedbackPresent = 0` the merged shader IS a copy, which is exactly the
   * "`uMix = 0` is an identity pass" property, now true for every style because the edge fade is gated.
   */
  private blit(gl: WebGL2RenderingContext, readTex: WebGLTexture, writeFBO: WebGLFramebuffer | null): void {
    if (!this.program || !this.vao || !this.zeroFieldTex) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(this.uFrameLoc, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uStaticFieldLoc, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uFlowFieldLoc, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uFluidFieldLoc, 3);
    // Invariant 4 again — the identity path declares the same SEVEN samplers as the warp path, so units 4-6 are
    // assigned here too. Omitting one is how a "copy" turns black on the drivers that collide it with unit 0.
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uBandBlurLoc, 4);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uHistoryLoc, 5);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.zeroFieldTex);
    gl.uniform1i(this.uDepthLoc, 6);
    gl.uniform4f(this.uLayerWeightLoc, 0, 0, 0, 0);
    gl.uniform1f(this.uMixLoc, 0);
    // Set explicitly even though this path is an identity copy: it SHARES the warp program, so an unset value
    // here is whatever the last warp pass uploaded — the "assign every uniform every pass" habit invariant 4
    // exists for. It also keeps the guard armed on an all-muted chain, which is a state worth probing.
    gl.uniform1f(this.uDiagSentinelLoc, this.diagSentinel);
    gl.uniform1f(this.uFeedbackPresentLoc, 0);
    gl.uniform1f(this.uAmplifyLoc, 1);
    // Both new operators OFF, for the same reason dispersion is hardcoded 0 below: an identity pass must be a
    // copy at every setting. Style 7 in particular would NOT self-cancel — it reads its own offset from the
    // frame's alpha and does not depend on `uMix`-scaled field textures being zero.
    gl.uniform1f(this.uRefractGainLoc, 0);
    gl.uniform1f(this.uRefractReachLoc, 1);
    gl.uniform1f(this.uRefractInvertLoc, 1);
    gl.uniform1i(this.uRefractSourceLoc, REFRACT_SOURCE_CODE.density);
    gl.uniform1f(this.uBandAmountLoc, 0);
    // ⚠️ **`uVortexGain` at 0 is what makes this path a copy, and the vortex is the ONE new style that would
    // not self-cancel otherwise** — like style 7 it computes its own offset analytically and never reads a
    // zeroed field texture, so a leaked gain from the previous pass would warp an "identity" copy. The other
    // three are modifiers and would be inert here anyway; they are still assigned, per the habit above.
    gl.uniform1f(this.uVortexGainLoc, 0);
    // v8 30.4 — -1 is the no-op, for the same reason the vortex gain is 0 here: this path is a COPY and a
    // live conformal map would turn it into a warp.
    gl.uniform1i(this.uConformalMapLoc, -1);
    gl.uniform1f(this.uVortexWeightLoc, 0);
    gl.uniform2f(this.uVortexCentreLoc, 0.5, 0.5);
    gl.uniform1f(this.uVortexRadiusLoc, 0.4);
    gl.uniform1f(this.uVortexInverseLoc, 0);
    gl.uniform1f(this.uTimeWarpAmountLoc, 0);
    gl.uniform1i(this.uTimeWarpSourceLoc, 0);
    gl.uniform1i(this.uTimeWarpAxisLoc, 0);
    gl.uniform1f(this.uTimeWarpBiasLoc, 0);
    gl.uniform1f(this.uParallaxAmountLoc, 0);
    gl.uniform1f(this.uParallaxNearLoc, 1);
    gl.uniform1f(this.uParallaxFarLoc, 1);
    gl.uniform1f(this.uParallaxSquaredLoc, 0);
    // The identity band, for the same reason the dispersion below stays hardcoded: an identity pass must be a
    // copy at every setting, so it must not depend on a live band measurement.
    gl.uniform1f(this.uParallaxBandLoLoc, 0);
    gl.uniform1f(this.uParallaxBandScaleLoc, 1);
    // Stays hardcoded 0 rather than `this.dispersion` — this is the IDENTITY path, and an identity pass must
    // be a copy at every setting. Passing the live value would be harmless arithmetically (all three taps
    // land on the same texel when `off` is 0) but it would make a copy depend on a colour control, so the
    // next reader could not tell whether the zero mattered.
    gl.uniform1f(this.uDispersionLoc, 0);
    gl.uniform1f(this.uGlowBoostLoc, 0);
    gl.uniform1f(this.uMaxOffsetLoc, NO_OFFSET_CLAMP);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * `Chain Mix` — the GLOBAL multiplier on every layer, 0..1. Was `Warp Mix`; the KEY is unchanged
   * (`transMapWarpMix`), only the label moved, because the key is in `getSnapshot()`, in
   * `grid-tile-renderer.ts` and in a preset literal, and seven of the eight checkers are text greps.
   *
   * | family | expression | meaning |
   * |---|---|---|
   * | field layers (0-3, 5, 6) | `finalUv = vUv + Σ(offset_i · w_i) · uMix` | fraction of a relative offset |
   * | echo layer (4) | `fragColor = mix(original, echo, uMix · w)` | opacity of the IFS echo, in **colour** |
   *
   * - **Styles 0-3 and 5/6 were already the SAME function**: `mix(vUv, dispUv, m)` expands to
   *   `vUv + (dispUv - vUv) * m`, verified to 0.00e+0 over m ∈ [0,1]. The only difference was the TEXTURE
   *   format — absolute target UVs vs relative deltas — and `buildStaticFieldTexture` now stores relative
   *   offsets like every other field, which is what lets them sum with a plain `+`.
   * - **Style 4 remains the one genuine difference**: it lerps a COLOUR, on its own program with its own
   *   `uIfsMixLoc`, so the two never share a uniform.
   * - ⚠️ **`uMix = 0` is now an identity pass for every layer, including 6** — because `edgeFade` and the
   *   glow are gated on `uFeedbackPresent` rather than being unconditional in a style-6-only shader. When a
   *   fluid layer IS present the old behaviour is reproduced exactly: both terms sit outside `uMix`, so a
   *   mix of 0 still applies the 2 % border fade and still gains glow, and `strength` is still computed
   *   PRE-mix so the glow does not scale with the slider.
   */
  setMix(value: number): void {
    this.mix = Math.max(0, Math.min(1, value));
  }

  /**
   * `1 - attractorBlend`, un-exempted — the processor applies it PER LAYER (see `layerWeights()`).
   *
   * ⚠️ The style-6 exemption used to be a per-instance boolean (`warpFadesWithFractalBlend()`) consulted by
   * `main.ts` before it called `setMix`. That cannot express a 5+6 chain, which needs 5 faded and 6 exempt
   * in the SAME frame, so the decision moved in here where the per-layer information lives. `main.ts` now
   * passes the raw fade and no longer asks which styles are exempt.
   */
  setFractalFade(value: number): void {
    this.fractalFade = Math.max(0, Math.min(1, value));
  }

  setFluidVelocityTexture(tex: WebGLTexture | null): void {
    this.fluidVelocityTex = tex;
  }

  /**
   * ⚠️ **The `dispersion` parameter was REMOVED here on 2026-08-20, not left unused.** It now has its own
   * `setDispersion()`, because this method is called every frame from the fluid branch — so keeping the
   * argument would let a style-6 frame overwrite a global control with the fluid block's stale copy, and a
   * caller that kept passing it would compile clean while doing exactly that (invariant 13's class: a control
   * still wired, no longer to the thing it names). Dropping the parameter makes every such caller a type error.
   */
  setFluidFeedbackParams(amplify: number, glowBoost: number): void {
    this.fluidAmplify = amplify;
    this.fluidGlowBoost = glowBoost;
  }

  /** Chain-level chromatic dispersion, 0..0.5. Clamped here so no caller can push the taps outside the frame. */
  setDispersion(value: number): void {
    this.dispersion = Math.max(0, Math.min(0.5, value));
  }

  /**
   * Regenerate the force path's source texture.
   *
   * @returns `true` if anything was drawn — which means the FRAMEBUFFER BINDING changed and the caller must
   *   restore its own. Self-gated on the plan, so the caller does not re-test a style; that test was half of
   *   I9's duplication.
   */
  renderFlowField(time: number, config: ProceduralFlowConfig): boolean {
    if (this.plan.flowLayer && this.flowGenerator) {
      this.flowGenerator.render(time, config);
      return true;
    }
    return false;
  }

  /**
   * Which particle-force paths this chain supports — the ONE place the style partition is decided (I9).
   *
   * ⚠️ **Replaces `getForceMode(): 'ifs' | 'texture' | 'none'`, whose three-member enum had no answer for a
   * chain containing BOTH style 4 and a field style.** `applyIfsForces` and `applyForces` each add into
   * `state.positions` and can legitimately both run, so this is a SET, not a choice. `'none'` is both
   * flags false.
   *
   * - `ifs` — a style-4 layer is enabled: CPU-direct chaos-game force, no texture, no readback.
   * - `texture` — the style-5 flow layer is enabled: force sampled from its texture via `readback()`.
   * - `analytic` — at least one layer from {0,1,2,3}: force sampled per particle from the 1D waves by
   *   `sampleStaticOffset()`, with no texture and no GPU→CPU sync.
   *
   * ⚠️ **`analytic` is a THIRD member, added 2026-08-20, and styles 0-3 MOVED from `texture` into it.** A
   * caller that still treats `texture` as "any field style" silently loses the static force path — which is
   * why this returns a set rather than an enum, and why `main.ts` must act on all three. **Style 6 is in
   * none of them** — see `forceFieldLayerCount()` for why that is a real exclusion rather than a gap.
   *
   * ⚠️ **Style 10 joined `analytic` (v8 Step 14.5) and it is a SECOND source inside that one member, not a
   * fourth member.** Both are closed-form CPU samplers reached through the single `setAnalyticSampler` hook,
   * and a chain can hold a static layer AND a vortex — so they must SUM, exactly as `sampleForce` sums the
   * analytic and texture sources. Making it a fourth flag would have implied a second force pass and
   * double-counted such a chain. The consequence to hold onto: **`analytic` no longer implies "there are
   * static waves"**, so a reader must not use it to gate anything `resolvedStatics`-specific.
   */
  getForceModes(): { ifs: boolean; texture: boolean; analytic: boolean } {
    if (!this.enabled) return { ifs: false, texture: false, analytic: false };
    return {
      ifs: this.plan.echoLayer !== null,
      texture: this.forceReadbackLayerCount() > 0,
      analytic: this.plan.staticStyles.length > 0 || this.plan.vortexLayer !== null,
    };
  }

  /**
   * The texture the force field reads back. Only meaningful when `getForceModes().texture` — ask that
   * first; `null` otherwise, and a caller acting on the value alone cannot tell "no force path" from
   * "force path not ready yet".
   *
   * ⚠️ **This is now the FLOW texture only.** It used to return `displacementTex` for a static chain, and
   * that handle now points at the `max(w,h) x 8` wave table, which is not a displacement field — returning
   * it would make `sampleForce` read wave amplitudes as UV offsets. Styles 0-3 go through
   * `sampleStaticOffset()` instead.
   */
  getDisplacementTexture(): WebGLTexture | null {
    if (!this.plan.flowLayer) return null;
    return this.flowGenerator ? this.flowGenerator.getTexture() : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Arm the trail guard's diagnostic release value on this processor's two `sanitiseTrail` copies.
   * `?gldiag=1` only; pass `DIAG_SENTINEL`. Never called on the shipped path, where the value stays 0 and the
   * guard releases to black exactly as before.
   */
  setDiagSentinel(value: number): void {
    this.diagSentinel = value;
  }

  /**
   * The two INTERMEDIATE stages of the chain, for `?gldiag=1`'s stage probe. `null` means the stage is not
   * part of the current chain — which the probe reports as `absent` rather than as clean, since an unscanned
   * stage is not a clean one (invariant 21).
   *
   * ⚠️ **These exist because a probe that reads only the chain's ENDPOINTS cannot localise a producer inside
   * it.** `texB` (in) and `texA` (out) were the only two stages read on 2026-08-22, and they returned
   * `nan=4096` at both ends — a reading equally consistent with the particle draw, the band blur and the warp.
   * The band blur is the most interesting of the two here: it is fed the raw accumulated trail and it SUMS
   * taps, so it reaches a LARGER magnitude than anything upstream of it, which makes it the first stage where
   * a half-float overflow would appear on a Band Split chain.
   *
   * ⚠️ **Returns the FRAMEBUFFER and its own size, not the texture, and the size is the load-bearing half.**
   * The band target is HALF RESOLUTION (`ensureBandBlur` builds it at `width >> 1`), so a probe that reused
   * the full-res crop rectangle would read outside it — `readPixels` past an attachment's bounds returns
   * undefined content, which would be indistinguishable from a real defect. A caller must derive its crop
   * from the `width`/`height` reported here.
   *
   * Read-only by contract: binding either as a draw target would write into the middle of a live chain.
   */
  getDiagBandStage(): { fbo: WebGLFramebuffer; width: number; height: number } | null {
    if (!this.plan.bandLayer || !this.fboBandB) return null;
    return {
      fbo: this.fboBandB,
      width: Math.max(1, this.width >> 1),
      height: Math.max(1, this.height >> 1),
    };
  }

  /** The two-pass chain's intermediate. Full resolution, unlike the band stage above. */
  getDiagScratchStage(): { fbo: WebGLFramebuffer; width: number; height: number } | null {
    if (!this.fboScratch) return null;
    return { fbo: this.fboScratch, width: this.width, height: this.height };
  }

  // `resize(width, height, config)` was declared here and deleted on 2026-08-10 (triage G5). It had
  // ZERO callers: the only resize path is `resizeAll()` in `main.ts`, which does `transMap.dispose()`
  // + `initTransMap()` so that the LIVE overlay chain survives the rebuild rather than being reverted to
  // the preset's stored block. `GridTileRenderer`'s tiles are fixed-size and never resize at all. It was
  // also WRONG: unlike `init()`, it called the displacement build with no style check, and that switch has
  // cases for styles 0-3 only — so styles 4/5/6 would have paid an `Int32Array(w*h)` +
  // `Float32Array(w*h*4)` + an RGBA32F upload (~74 MB at 1080p) to produce an all-zero map they never
  // sample. Do not reinstate it without the gate; prefer dispose+init, which preserves overlay state.
  /**
   * ⚠️ **Every handle deleted here must also be NULLED** — three of the six were not, and since a chain
   * change used to be `dispose()` + `init()` on the SAME object, a field left pointing at a deleted GL
   * object is read again by the next configuration (I9).
   *
   * `displacementTex` is the one that mattered. It is built only for a chain containing a style 0-3 layer,
   * so after `0 -> 6` the field still held style 0's freed texture, and `getDisplacementTexture()` returned
   * it for any style but 4 or 5 — handing the force field a deleted texture to `readPixels` from.
   *
   * Not a leak either way — `deleteTexture` is what frees it — but "deleted and still referenced" is
   * exactly the use-after-dispose class B17 was, and none of the eight checkers can see it.
   */
  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.flowGenerator) { this.flowGenerator.dispose(); this.flowGenerator = null; }
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.displacementTex) gl.deleteTexture(this.displacementTex);
    if (this.ifsProgram) gl.deleteProgram(this.ifsProgram);
    if (this.ifsVao) gl.deleteVertexArray(this.ifsVao);
    if (this.zeroFieldTex) gl.deleteTexture(this.zeroFieldTex);
    this.releaseScratch(gl);
    this.releaseBandBlur(gl);
    this.releaseHistory(gl);
    this.program = null; this.vao = null; this.displacementTex = null;
    this.ifsProgram = null; this.ifsVao = null;
    this.zeroFieldTex = null;
    // Uniform locations belong to the deleted programs — nulling them keeps a stale location from being
    // uploaded into a freshly linked program by a setter that runs before the next `init()`.
    this.uMixLoc = null; this.uFrameLoc = null;
    this.uStaticFieldLoc = null; this.uFlowFieldLoc = null; this.uFluidFieldLoc = null;
    this.uLayerWeightLoc = null; this.uAmplifyLoc = null; this.uDispersionLoc = null;
    this.uGlowBoostLoc = null; this.uFeedbackPresentLoc = null; this.uMaxOffsetLoc = null;
    this.uResolutionLoc = null; this.uStaticCountLoc = null;
    this.uStaticStyleLoc = null; this.uStaticCentreLoc = null; this.uStaticRatioLoc = null;
    this.uStaticWaveXLoc = null; this.uStaticWaveYLoc = null;
    this.uStaticWaveZXLoc = null; this.uStaticWaveZYLoc = null;
    this.uBandBlurLoc = null; this.uBandAmountLoc = null;
    this.uRefractGainLoc = null; this.uRefractReachLoc = null;
    this.uRefractInvertLoc = null; this.uRefractSourceLoc = null;
    this.uVortexGainLoc = null; this.uVortexWeightLoc = null; this.uVortexCentreLoc = null;
    // v8 30.4 — invariant 1: nulled as well as released, so a later upload cannot target a stale location.
    this.uConformalMapLoc = null; this.uConformalWeightLoc = null; this.uConformalCentreLoc = null;
    this.uConformalPowerLoc = null; this.uConformalMobiusABLoc = null; this.uConformalMobiusCLoc = null;
    this.uVortexRadiusLoc = null; this.uVortexInverseLoc = null;
    this.uHistoryLoc = null; this.uTimeWarpAmountLoc = null; this.uTimeWarpSourceLoc = null;
    this.uTimeWarpAxisLoc = null; this.uTimeWarpBiasLoc = null;   // v8 30.5, invariant 1
    this.uDepthLoc = null; this.uParallaxAmountLoc = null;
    this.uParallaxNearLoc = null; this.uParallaxFarLoc = null; this.uParallaxSquaredLoc = null;
    this.uParallaxBandLoLoc = null; this.uParallaxBandScaleLoc = null;
    this.uIfsFrameLoc = null; this.uIfsCountLoc = null; this.uIfsMixLoc = null;
    this.uIfsDataLoc = null; this.uIfsWeightsLoc = null;
    this.uDiagSentinelLoc = null; this.uIfsDiagSentinelLoc = null;
    // ⚠️ `diagSentinel` is deliberately NOT reset — it is a session-wide diagnostic MODE set from the URL, not
    // per-program state, and `init()` does not restore it. Zeroing it here would silently disarm the probe on
    // the first chain edit or window resize, i.e. in the middle of the run it was turned on for.
    // The signature must die with the texture it describes, or the next `setChain` skips the rebuild.
    this.staticSignature = '';
    // ⚠️ All three of these describe `displacementTex`, which was just freed. `waveTexWidth` left nonzero
    // would make the next build `texSubImage2D` into a deleted texture (a silent no-op, so the field would
    // be whatever the new texture was created with — invariant 1's exact shape). `resolvedStatics` left
    // populated would keep `sampleStaticOffset()` pushing particles with a disposed chain's waves, and
    // `hasDrift` would schedule a per-frame rebuild for a chain that no longer exists.
    this.waveTexWidth = 0;
    this.resolvedStatics = [];
    this.hasDrift = false;
    this.scratchFailed = false;
    this.bandFailed = false;
    this.historyFailed = false;
    // ⚠️ Both of these are invariant 3's shape: `historyPrimed` left true over a released target would let the
    // next chain sample the 1×1 fallback as if it were a real frame of history, and `depthTex` is a BORROWED
    // handle whose owner (`main.ts`) deletes it on resize — so this class must forget it even though it must
    // not delete it.
    this.historyPrimed = false;
    this.depthTex = null;
  }

  // ---- resources -----------------------------------------------------------------------------------

  /** 1×1 RG16F zero texture — the never-`null` fallback every field sampler needs (invariant 4). */
  private createZeroFieldTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // `null` data leaves the contents undefined, so clear it explicitly to zero via a throwaway FBO.
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (fbo) gl.deleteFramebuffer(fbo);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private ensureScratch(gl: WebGL2RenderingContext): void {
    if (this.fboScratch || this.scratchFailed) return;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    // LINEAR + CLAMP_TO_EDGE, matching the trail buffers this sits between.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // ⚠️ Invariant 5 — an incomplete FBO throws nothing and logs nothing. Test it, and on failure leave
    // both handles null so `apply()` degrades to the field-only chain instead of a permanently black trail.
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (!ok) {
      console.error('TransMap: chain scratch FBO incomplete — echo layer disabled for this chain');
      if (fbo) gl.deleteFramebuffer(fbo);
      if (tex) gl.deleteTexture(tex);
      this.scratchFailed = true;
      return;
    }
    this.fboScratch = fbo;
    this.texScratch = tex;
  }

  private releaseScratch(gl: WebGL2RenderingContext): void {
    if (this.fboScratch) gl.deleteFramebuffer(this.fboScratch);
    if (this.texScratch) gl.deleteTexture(this.texScratch);
    this.fboScratch = null;
    this.texScratch = null;
  }

  /**
   * Allocate style 8's full-resolution history target. See `texHistory` for why it cannot be `texA`.
   *
   * ⚠️ Invariant 5 — the FBO is status-tested and on failure BOTH handles are left null and `historyFailed`
   * latches, so `applyWarpPass` degrades to `uTimeWarpAmount = 0` (the warp with no temporal blend) rather than
   * to a black trail. A full-res `RGBA16F` attachment needs `EXT_color_buffer_float`, which can be denied.
   */
  private ensureHistory(gl: WebGL2RenderingContext): void {
    if (this.fboHistory || this.historyFailed) return;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    // LINEAR + CLAMP_TO_EDGE, matching the trail buffers whose contents this holds a copy of.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok) {
      // `null` data leaves the contents undefined, which a half-float target can read back as NaN — and a NaN
      // history texel would be lerped into the trail on the first frame. Clear it while the FBO is bound.
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (!ok) {
      console.error('TransMap: history FBO incomplete — style 8 disabled for this chain');
      if (fbo) gl.deleteFramebuffer(fbo);
      if (tex) gl.deleteTexture(tex);
      this.historyFailed = true;
      return;
    }
    this.fboHistory = fbo;
    this.texHistory = tex;
  }

  /** ⚠️ Delete AND null every handle (invariant 1) — `setChain` calls this whenever the layer goes away. */
  private releaseHistory(gl: WebGL2RenderingContext): void {
    if (this.fboHistory) gl.deleteFramebuffer(this.fboHistory);
    if (this.texHistory) gl.deleteTexture(this.texHistory);
    this.fboHistory = null;
    this.texHistory = null;
  }

  /**
   * Allocate style 9's two half-resolution blur targets and its separable blur program.
   *
   * ⚠️ Invariant 5 twice over — BOTH FBOs are status-tested, and on either failure every handle is released
   * and `bandFailed` latches so `applyWarpPass` degrades to `uBandAmount = 0`, i.e. the warp with no band
   * term. A half-res RGBA16F attachment needs `EXT_color_buffer_float`, which the engine already requests
   * and can be denied (ADR 010), so this is a reachable path rather than a formality.
   */
  private ensureBandBlur(gl: WebGL2RenderingContext): void {
    if (this.fboBandA || this.bandFailed) return;
    const w = Math.max(1, this.width >> 1);
    const h = Math.max(1, this.height >> 1);
    const make = (): { fbo: WebGLFramebuffer | null; tex: WebGLTexture | null; ok: boolean } => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      // LINEAR so the half-res base can be sampled at full-res UVs (and at the WARPED UV) without stepping.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return { fbo, tex, ok };
    };
    const a = make();
    const b = make();
    if (!a.ok || !b.ok) {
      console.error('TransMap: band-split blur FBO incomplete — style 9 disabled for this chain');
      for (const t of [a, b]) {
        if (t.fbo) gl.deleteFramebuffer(t.fbo);
        if (t.tex) gl.deleteTexture(t.tex);
      }
      this.bandFailed = true;
      return;
    }
    this.bandBlurProgram = this.createBandBlurProgram(gl);
    this.bandBlurVao = this.createQuad(gl, this.bandBlurProgram);
    this.uBandSrcLoc = gl.getUniformLocation(this.bandBlurProgram, 'uSrc');
    this.uBandStepLoc = gl.getUniformLocation(this.bandBlurProgram, 'uStep');
    this.uBandSigmaLoc = gl.getUniformLocation(this.bandBlurProgram, 'uSigma');
    this.fboBandA = a.fbo; this.texBandA = a.tex;
    this.fboBandB = b.fbo; this.texBandB = b.tex;
  }

  /** ⚠️ Delete AND null every handle (invariant 1) — `setChain` calls this whenever the layer goes away. */
  private releaseBandBlur(gl: WebGL2RenderingContext): void {
    if (this.fboBandA) gl.deleteFramebuffer(this.fboBandA);
    if (this.texBandA) gl.deleteTexture(this.texBandA);
    if (this.fboBandB) gl.deleteFramebuffer(this.fboBandB);
    if (this.texBandB) gl.deleteTexture(this.texBandB);
    if (this.bandBlurProgram) gl.deleteProgram(this.bandBlurProgram);
    if (this.bandBlurVao) gl.deleteVertexArray(this.bandBlurVao);
    this.fboBandA = null; this.texBandA = null;
    this.fboBandB = null; this.texBandB = null;
    this.bandBlurProgram = null; this.bandBlurVao = null;
    this.uBandSrcLoc = null; this.uBandStepLoc = null; this.uBandSigmaLoc = null;
  }

  /**
   * Render the low-frequency base of `readTex` into `texBandB`, at half resolution, in two separable passes.
   *
   * `radius` arrives in FULL-RESOLUTION texels (that is the unit the slider names), so it is halved here to
   * match the target — the one units conversion in this operator, and getting it wrong would make Band Radius
   * mean two different frequencies at two different canvas sizes (invariant 10).
   */
  private renderBandBlur(gl: WebGL2RenderingContext, readTex: WebGLTexture, radius: number): void {
    if (!this.bandBlurProgram || !this.bandBlurVao || !this.fboBandA || !this.fboBandB) return;
    if (!this.texBandA) return;
    const w = Math.max(1, this.width >> 1);
    const h = Math.max(1, this.height >> 1);
    const sigma = Math.max(0.5, radius * 0.5);
    gl.useProgram(this.bandBlurProgram);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, w, h);
    gl.bindVertexArray(this.bandBlurVao);
    gl.uniform1f(this.uBandSigmaLoc, sigma);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBandA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(this.uBandSrcLoc, 0);
    gl.uniform2f(this.uBandStepLoc, 1 / w, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBandB);
    gl.bindTexture(gl.TEXTURE_2D, this.texBandA);
    gl.uniform1i(this.uBandSrcLoc, 0);
    gl.uniform2f(this.uBandStepLoc, 0, 1 / h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
  }

  /**
   * One axis of a Gaussian blur, `MAX_BAND_TAPS` taps wide, weights computed in the shader from `uSigma`.
   *
   * The tap count is a compile-time constant and the loop breaks on the sigma-derived extent, so changing
   * Band Radius costs no relink — the alternative (a radius-specialised shader) would recompile mid-drag.
   */
  private createBandBlurProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `#version 300 es
      precision highp float;
      uniform sampler2D uSrc;
      uniform vec2 uStep;
      uniform float uSigma;
      in vec2 vUv;
      out vec4 fragColor;
      void main() {
        // Extent at 2 sigma, capped at the loop bound. Weights are normalised by the accumulated total
        // rather than analytically, so a truncated tail cannot darken the base -- and a darkened base would
        // show up as a brightness SHIFT at amount > 0, not as a missing band effect.
        float ext = min(float(${MAX_BAND_TAPS}), ceil(uSigma * 2.0));
        vec4 sum = texture(uSrc, vUv);
        float total = 1.0;
        for (int i = 1; i <= ${MAX_BAND_TAPS}; i++) {
          float fi = float(i);
          if (fi > ext) break;
          float wgt = exp(-0.5 * (fi * fi) / (uSigma * uSigma));
          sum += (texture(uSrc, vUv + uStep * fi) + texture(uSrc, vUv - uStep * fi)) * wgt;
          total += 2.0 * wgt;
        }
        fragColor = sum / total;
      }`;
    return compileProgram(gl, vert, frag, 'TransMap band-split blur');
  }

  /**
   * Upload the static family's 1D WAVE ARRAYS — the whole field, in `max(w,h) x 8` texels.
   *
   * ## Why this is 1D at all
   *
   * ⚠️ **The field is SEPARABLE and always was**: `wX` depends only on `x` and `wY` only on `y`, so a
   * canvas-sized 2D table stored `w * h` values derived from `w + h` numbers. The 2D form only became
   * untenable when `drift` made the field time-varying — a per-frame full-resolution rebuild measured:
   *
   *   800x600     5.4 ms / 7.3 MB     (32 % of a 60 fps frame)
   *   1920x1080  18.9 ms / 31.6 MB    (**113 %** — a guaranteed frame drop before anything else runs)
   *   2560x1440  23.9 ms / 56.3 MB
   *   3840x2160  30.2 ms / 126 MB
   *
   * The separable rebuild is `w + h` sine sums instead of `w * h` composed transforms:
   *
   *   800x600     0.137 ms / 6.3 KB   (40x cheaper)
   *   1920x1080   0.285 ms / 15.0 KB  (**66x**, 1.7 % of a frame)
   *
   * That is what makes drift affordable, and it also retires a cost that predates drift: the documented
   * 9.5 ms chain-change hitch at 1080p (see the H13 note on the deleted `compute*` helpers) becomes ~0.3 ms,
   * because the per-pixel composition moved to the GPU where it is one texelFetch per axis.
   *
   * ## Layout
   *
   * `RG32F`, row `layer + axis * 4`: rows 0-3 are the X waves, rows 4-7 the Y waves. `.r` is the shift wave
   * and `.g` style 3's zoom wave (zero for styles 0-2). Width is `max(w, h)`, so the shorter axis leaves a
   * tail of unread texels — 4 layers x 8 rows is at most 8 rows of `max(w,h)`, i.e. 61 KB at 1080p against
   * the 31.6 MB it replaces, so padding is not worth avoiding.
   *
   * ⚠️⚠️ **THE WIDTH IS A MAXIMUM OVER EVERY TABLE SINCE `35.3`, NOT `max(w, h)`.** A rotated axis is
   * sampled along the frame's DIAGONAL, so its table is `hypot(w,h)`-sized — 2203 against 1920 at 1080p,
   * +14.7 %, i.e. 122,880 → 140,992 bytes for the whole 8-row texture. Taking `max(w,h)` as the FLOOR is
   * what keeps an all-angle-0 chain byte-identical in both the dimensions and the data.
   *
   * ⚠️ **The shift and zoom halves are written in SEPARATE loops, and that is not tidiness.** They carry
   * INDEPENDENT angles (`angleX` vs `angleX2`), so one can be rotated and the other not: their tables then
   * have different lengths and neither may bound the other's write. Sharing one loop silently truncated
   * whichever half was longer.
   *
   * ⚠️ **NEAREST filtering and `texelFetch` are both required.** The waves are indexed by integer texel, and
   * a linear filter would interpolate between two adjacent wave samples — which is not the field. This is a
   * DATA texture, not an image.
   */
  private buildStaticWaveTexture(layers: readonly ResolvedStaticLayer[]): void {
    const gl = this.gl!;
    // ⚠️ `max(w, h)` is the FLOOR, not the answer — see the header. A rotated table is `hypot(w,h)`-sized.
    let n = Math.max(this.width, this.height);
    for (let i = 0; i < layers.length && i < 4; i++) {
      const L = layers[i]!;
      for (const a of [L.waveX, L.waveY, L.zoomX, L.zoomY]) if (a && a.length > n) n = a.length;
    }
    const rows = 8;
    const data = new Float32Array(n * rows * 2);
    for (let i = 0; i < layers.length && i < 4; i++) {
      const L = layers[i]!;
      for (let axis = 0; axis < 2; axis++) {
        const shift = axis === 0 ? L.waveX : L.waveY;
        const zoom = axis === 0 ? L.zoomX : L.zoomY;
        const row = i + axis * 4;
        // ⚠️ TWO loops over TWO lengths — see the header. `data` is zero-filled, so a null zoom half leaves
        // `.g` at 0 exactly as the single-loop form did.
        for (let t = 0; t < shift.length; t++) data[(row * n + t) * 2] = shift[t]!;
        if (zoom) for (let t = 0; t < zoom.length; t++) data[(row * n + t) * 2 + 1] = zoom[t]!;
      }
    }

    // Reuse the texture when the dimensions have not moved: this runs on every drift frame, and
    // create/delete per frame is the driver-object churn invariant 8 is about.
    if (this.displacementTex && this.waveTexWidth === n) {
      gl.bindTexture(gl.TEXTURE_2D, this.displacementTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, rows, gl.RG, gl.FLOAT, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return;
    }
    if (this.displacementTex) gl.deleteTexture(this.displacementTex);
    this.displacementTex = gl.createTexture();
    this.waveTexWidth = n;
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, n, rows, 0, gl.RG, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Texel width of the wave texture, so a drift frame can `texSubImage2D` instead of reallocating. */
  private waveTexWidth = 0;

  /**
   * Resolve every static layer's waves at the current drift phase, and upload them.
   *
   * ⚠️ **`solveGain` runs inside `resolveStaticWaves`, so this is NOT free** (0.8 ms at 1080p). It is called
   * on chain change, and per frame ONLY while some layer has `drift != 0` — `hasDrift` is the gate, and it
   * must be derived from the resolved value rather than from "a staticField block exists", or every preset
   * with a static layer pays the solve on every frame to compute the same numbers.
   */
  private rebuildStaticField(time: number): void {
    const config = this.lastConfig;
    const statics = this.plan.staticStyles;
    if (!config || statics.length === 0) return;
    const p1 = config.sinMagicParams as SinMagicParams;
    const p2 = config.sinMagicParams2 as SinMagicParams;
    const resolved: ResolvedStaticLayer[] = [];
    for (const layer of statics) {
      const ratio = layer.weight / this.staticWeightScale;
      if (ratio <= 0) continue;
      const cxPct = layer.zoomCenter?.x ?? config.zoomCenterX;
      const cyPct = layer.zoomCenter?.y ?? config.zoomCenterY;
      const centreX = (cxPct * this.width) / 100;
      const centreY = (cyPct * this.height) / 100;
      // Via `driftPhase()`, never inline: the phase is normalised by the pattern's effective frequency, which
      // is derived from the archetype tables inside `static-field.ts`. Computing it here would duplicate those
      // tables and let the divisor drift out of step with the field it normalises.
      const phase = driftPhase(staticFieldOf(layer), time, this.driftScale);
      const waves = resolveStaticWaves(layer, p1, p2, this.width, this.height, centreX, centreY, phase);
      resolved.push({ style: layer.style, centreX, centreY, ratio, ...waves });
    }
    this.resolvedStatics = resolved;
    this.buildStaticWaveTexture(resolved);
  }

  /**
   * Per-frame drift refresh. Cheap and self-gated: returns immediately unless a layer actually drifts.
   *
   * Called from `apply()` rather than from `main.ts` so the gate lives with the data — a caller-side test
   * would be a second place that has to agree about which layers drift (I9's duplication).
   *
   * ⚠️ **`driftScale` is part of the GATE, not just of the phase.** `hasDrift` is derived from
   * `drift !== 0` in `setChain()` (and in `init()` through it), which is the right test for the main canvas and
   * the WRONG one for a preview
   * tile: `grid-tile-renderer.ts` sets `setDriftScale(0)` *after* `init()`, so the flag is already true and
   * a tile whose preset carries drift re-solved every static layer on every rendered frame — to produce
   * byte-identical phase-0 waves. Measured at tile size, one `resolveStaticWaves` is 0.81 ms (`Coarse
   * Swell`, style 0) to 1.16 ms (`Fine Mesh`, style 3) against a `STEADY_BUDGET_MS` of 10 ms shared by the
   * whole grid, so a few such tiles starve every other tile in the pass. Invisible either way — which is
   * why it needed the cost measured rather than the output compared.
   *
   * Testing the scale here rather than folding it into `hasDrift` keeps one gate: the scale can change at
   * any time after `init()`, and a cached flag would have to be recomputed at every `setDriftScale` call.
   */
  private updateDrift(time: number): void {
    if (!this.hasDrift || this.driftScale === 0 || this.plan.staticStyles.length === 0) return;
    this.rebuildStaticField(time);
  }

  /**
   * Scales the drift rate — 0 disables drift entirely, which is what preview TILES use.
   *
   * ⚠️ Deliberately a SCALE and not a boolean: a tile renderer sets 0 and gets a static field with no other
   * behavioural difference, so `staticField` still round-trips through a tile unchanged. Animating 177 tiles
   * would rebuild 177 wave sets per frame for a 256 px thumbnail nobody is watching for motion.
   */
  setDriftScale(scale: number): void {
    this.driftScale = Math.max(0, scale);
  }

  /**
   * Scales the two SCREEN-SPACE parameters of the new operators — style 7's `reach` and style 9's `radius`.
   *
   * ⚠️ **Decide by UNIT, not by field name.** Both of these are distances in TEXELS of the frame being warped,
   * so a 4 px band split on a 1080p canvas and on a 192 px tile are not the same *frequency* and a 1-texel
   * refraction reach is a far coarser gradient on a tile than on the canvas — they qualify. `strength` and
   * `amount` do NOT and are deliberately left alone: `strength` is solved against `min(w, h)` inside
   * `applyWarpPass` and is therefore already a ratio, and `amount` is a dimensionless blend. This is the same
   * split `staticField.detail` was MEASURED into (scaling it made the tile 2.6× less faithful, not more).
   *
   * One setter for both, not two, because a caller that scales one and forgets the other is exactly the
   * three-enumerations problem — and the two always come from the same place (`SCREEN_SPACE_TILE_SCALE`).
   */
  setScreenSpaceScale(scale: number): void {
    const s = Math.max(0.01, scale);
    this.refractReachScale = s;
    this.bandRadiusScale = s;
  }

  private refractReachScale = 1.0;
  private bandRadiusScale = 1.0;
  private driftScale = 1.0;
  /** True when some enabled static layer has nonzero drift — the per-frame rebuild gate. */
  private hasDrift = false;
  /** The resolved waves, kept for the analytic force path (`sampleStaticOffset`). */
  private resolvedStatics: ResolvedStaticLayer[] = [];

  /**
   * The static field's offset at a pixel, computed ANALYTICALLY — the force path's replacement for
   * `readPixels`.
   *
   * ⚠️ **This is what lets the 1D rewrite happen at all.** `TransMapForceField.readback()` did a
   * synchronous full-canvas `readPixels` (31.6 MB at 1080p, every 4th frame) on the 2D displacement
   * texture, and that texture no longer exists. Sampling the 1D waves on the CPU is O(1) per particle
   * against the same wave arrays the shader reads, so the force path stops needing a GPU→CPU sync at all
   * for styles 0-3 — strictly better than what it replaced, and it removes the largest of the engine's
   * three synchronous readbacks.
   *
   * Writes UV into `out`, matching what `sampleForce` read out of `.rg`; the caller scales by width/height.
   * The out-parameter is invariant 8 — see `staticOffsetAt`; this runs once per particle per frame.
   *
   * ⚠️ **Must write `out` on EVERY path, including the no-layer one.** The caller reuses one scratch buffer,
   * so an early `return` that left it alone would feed particles the previous particle's offset — the class
   * of defect invariant 11 is about, and silent because the values would look plausible.
   */
  sampleStaticOffset(x: number, y: number, out: Float64Array): void {
    if (this.resolvedStatics.length === 0) {
      out[0] = 0;
      out[1] = 0;
      return;
    }
    const px = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
    staticOffsetAt(this.resolvedStatics, px, py, this.width, this.height, out);
  }

  /**
   * The style-10 vortex offset at a pixel, in UV — the force path's twin of `vortexOffset()` in the warp GLSL
   * (v8 Step 14.5). Closed form, so like `sampleStaticOffset` it needs no texture and no GPU→CPU sync.
   *
   * ⚠️ **Applies the same `weight × fractalFade` the shader gets through `uVortexWeight`, and NOT `uMix`.**
   * That split is the class-header rule: `uMix` is the warp's own blend and the force path has its own
   * (`transMapForceBlend`), so folding `uMix` in here would make the Chain Mix slider silently scale the force
   * as well — two controls on one quantity. The fade is included because a vortex is faded like every style
   * except 6, so at attractor blend 1.0 the picture stops swirling and the particles must stop being swirled.
   *
   * ⚠️ **Writes `out` on EVERY path, including the no-layer one** — same reason as `sampleStaticOffset`: the
   * caller reuses one scratch buffer across particles, so an early `return` feeds this particle the PREVIOUS
   * particle's offset, which looks plausible and is invariant 11's class.
   *
   * ⚠️ **This produces a tangential LEAN, never a self-sustaining orbit.** `applyForces` samples at
   * `positions[i]`, which the generator rewrites from the mathematical curve every frame, so the offset is a
   * function of where the particle's CURVE puts it, not of where the force has pushed it: `off = off·retain +
   * f(base)·m` has no feedback and converges to `f(base)/(1−retain)`. Orbiting would need sampling at
   * `base + off` — Euler advection — a different model from the spring-to-curve offset every force style here
   * shares, and one invariant 12 is about avoiding.
   *
   * ⚠️ **But "constant" holds only for a STILL figure, and that distinction cost a wrong answer.** On a rotating
   * preset the base sweeps through the field, so the offset direction tracks it: measured on `Cylinder`
   * (`Rotation [0,3,0]`, swirl 0.5 / blend 0.5 / return 1.5) the direction runs 90.8° → 94.5° → 99.7° → 106.6°
   * → 117.3° at t = 1/5/10/15/20 s while the magnitude eases 79 → 66 px. Time-varying, but at 3°/s a full sweep
   * takes two minutes, which is why it was reported as *"only a distortion of the figure"*.
   *
   * ⚠️ **The swirl the style is NAMED for lives in the trail, so its real gate is `decayFactor`, not the
   * figure.** 8° accumulated at 0 (`Cylinder` as shipped), 19° at 0.6, 76° at 0.9, 634° at 0.988
   * (`MotionBlur 8`). A low-`MotionBlur` preset can therefore use a vortex perfectly well — it has to raise its
   * trail to do it, and no Lab control reaches `decayFactor` directly (the Sliders tab's Glow multiplier nudges
   * it as a side effect and saturates at 0.40 from a 0 base, i.e. 13°).
   */
  sampleVortexOffset(x: number, y: number, out: Float64Array): void {
    const layer = this.plan.vortexLayer;
    if (!layer) {
      out[0] = 0;
      out[1] = 0;
      return;
    }
    const v = vortexOf(layer);
    const gain = vortexGain(v.swirl, v.radius, v.falloff, Math.min(this.width, this.height));
    // `radius` is floored identically to the uniform upload — it squares into a denominator.
    vortexOffsetAt(
      x, y, v.centre.x, v.centre.y, Math.max(0.01, v.radius), v.falloff === 'inverse',
      gain * layer.weight * this.fractalFade, this.width, this.height, out,
    );
  }

  /**
   * H13 — the three `compute*` helpers wrote offsets DIRECTLY. There was no intermediate `Int32Array`.
   *
   * ⚠️ The triage row named the wrong cost. It said the table "iterates column-major while writing
   * row-major — cache-hostile over up to 2 M entries", and that half was **measured at 0.99-1.08×**:
   * swapping the loop order alone saves nothing (40 alternating reps at 1080p and 1440p, output verified
   * bit-identical). The stride is 4 bytes over a 8.3 MB array, so a whole cache line is 16 consecutive
   * `y` values — the column walk misses on the first of every 16 either way, and the compute per entry
   * (two `restrictToRange`, two `Math.round`, two `rollToRange`) dominates the miss.
   *
   * What actually cost is what the row did not mention: the map was built TWICE over. Pass 1 packed a
   * destination into one integer as `dstY * w + dstX`; pass 2 walked the whole array again and undid
   * exactly that packing with `% w` and `Math.floor(/ w)`, an integer division per pixel, purely to
   * write the normalised pair the texture wanted all along. Fusing them removes a full 2 M-entry walk,
   * 2 M integer divisions, and the `Int32Array` allocation itself.
   *
   * Measured (identical output verified to 1e-7 at all three sizes):
   *
   *   1920×1080   15.6 ms → 9.5 ms  (1.65×)   8.3 MB less allocated
   *   2560×1440   33.0 ms → 18.3 ms (1.80×)  14.7 MB
   *   3840×2160   70.8 ms → 40.0 ms (1.77×)  33.2 MB
   *
   * ## Chain changes: RELATIVE offsets, and a SUM
   *
   * ⚠️ **This texture now stores relative offsets (`dstUv - vUv`), not absolute target UVs.** That is what
   * lets the static family sum with the flow and fluid fields in one shader — the two forms were already
   * algebraically identical (`mix(vUv,d,m) === vUv + (d-vUv)*m`), so the warp output is unchanged.
   *
   * ⚠️ **It also fixes a latent force-field defect.** `TransMapForceField.sampleForce` returns
   * `[dx * width, dy * height]` — i.e. it has ALWAYS treated `.rg` as a relative offset, which is correct
   * for the procedural-flow texture but was wrong for the absolute UVs this used to store. A style 0-3
   * layer with Force Blend > 0 was therefore pushing particles by roughly half a frame instead of a few
   * pixels. No shipped preset reached it (all five presets with `transMapForceBlend` use style 5), so it
   * was only reachable by enabling the Force Field on a style 0-3 preset from the Visual FX tab.
   *
   * Entries are ADDED into, and every layer's contribution is scaled by `weight / staticWeightScale`, so
   * the caller's `uLayerWeight.x` can carry the scale back. The buffer is zero-filled first, and zero IS
   * the identity for a relative offset — strictly better than the old "unwritten entries sample texel
   * (0,0)" default, and unreachable anyway since each `compute*` writes every entry.
   */
  // ⚠️ `buildStaticFieldTexture` and the three `compute*` helpers (`computeSinMagic`,
  // `computeSinMagicZoom`, `computeSinMagicZoom2`) plus `addTranslation`, `rollToRange`,
  // `restrictToRange` and `zoomCoordinate` lived HERE and were deleted 2026-08-20 in favour of the
  // separable path above. Their arithmetic was not discarded: it moved to `staticOffsetAt()` in
  // `static-field.ts` (CPU, for the particle force path) and to `staticOffset()` in the warp GLSL
  // (GPU, for the picture), and `checks/fieldcheck.mjs` holds an INDEPENDENT transcription of the
  // pre-deletion versions as its parity oracle — which is why deleting them here is safe: all 177
  // shipped tables are asserted to reproduce the original field exactly, and that assertion carries its
  // own falsifiability test.
  //
  // Two measurements from the deleted code are worth keeping, because both bound what the replacement had
  // to beat and one of them corrected a triage row:
  //
  // 1. H13's row claimed the cost was cache-hostile traversal order ("iterates column-major while writing
  //    row-major, over up to 2 M entries"). That half measured 0.99-1.08× — swapping the loop order alone
  //    saved NOTHING, verified bit-identical over 40 alternating reps at 1080p and 1440p. The real cost was
  //    that the map was built TWICE: pass 1 packed a destination as `dstY * w + dstX`, pass 2 walked the
  //    whole array undoing exactly that packing with `% w` and `Math.floor(/ w)`, an integer division per
  //    pixel. Fusing them gave 15.6 ms → 9.5 ms at 1080p. **A size estimate is not evidence, and neither
  //    is a direction.**
  // 2. Even fused, the full-resolution rebuild cost 9.5 ms at 1080p and 40.0 ms at 4K, on chain change.
  //    That is the number the 0.285 ms separable rebuild replaced, and it is why drift — which needs a
  //    rebuild every frame — was affordable to add at all.
  //
  // One defect fixed on the way through, still true of the new path: the field carries RELATIVE offsets,
  // not absolute target UVs. `sampleForce` had ALWAYS treated its input as relative (it returns
  // `[dx * width, dy * height]`), so a style 0-3 layer with Force Blend > 0 used to push particles by
  // roughly half a frame instead of a few pixels. No shipped preset reached it — all five presets with
  // `transMapForceBlend` use style 5 — so it needed the Force Field switched on over a style 0-3 preset
  // from the Visual FX tab.

  /**
   * The merged warp program — every field layer in ONE pass, whatever the chain length.
   *
   * Replaces `createProgram` ('TransMap displacement warp'), `createFlowWarpProgram` ('TransMap flow warp')
   * and `createFluidFeedbackProgram` ('TransMap fluid feedback'). All three computed
   * `finalUv = vUv + offset * uMix` over different textures, so the merge is a sum of three samples.
   *
   * ⚠️ Three terms exist purely to keep each single-style case bit-identical — see the class header:
   * `uMix` separate from `uLayerWeight` (so style 6's `strength`, hence its glow, stays PRE-mix),
   * `uFeedbackPresent` gating `edgeFade`/glow (so styles 0-5 get neither and style 6 gets both
   * unconditionally), and `uMaxOffset` at an unreachable sentinel unless 2+ field layers are live (so
   * styles 1-3 keep their full ±1.0 UV range).
   */
  private createWarpProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `#version 300 es
      precision highp float;
      uniform sampler2D uFrame;
      uniform sampler2D uStaticField;
      uniform sampler2D uFlowField;
      uniform sampler2D uFluidField;
      uniform sampler2D uBandBlur;
      uniform vec4 uLayerWeight;
      uniform float uMix;
      uniform float uAmplify;
      uniform float uDispersion;
      uniform float uGlowBoost;
      uniform float uFeedbackPresent;
      uniform float uMaxOffset;
      uniform vec2 uResolution;
      uniform int uStaticCount;
      uniform int uStaticStyle[4];
      uniform vec2 uStaticCentre[4];
      uniform float uStaticRatio[4];
      // The wave INDEX maps (Step 35.3), one per layer per wave: (cos, sin, centreIndex, rotatedLength).
      // rotatedLength == 0.0 means NOT ROTATED, and the length is the clamp bound -- one float carrying
      // both so a flag cannot outlive the resource it describes (invariant 3). The trig is precomputed on
      // the CPU: it is constant over the whole draw, exactly as uParallaxBandScale is.
      uniform vec4 uStaticWaveX[4];
      uniform vec4 uStaticWaveY[4];
      // Style 3's ZOOM half, which carries its OWN angles and therefore needs its OWN taps -- it can no
      // longer ride along in .g of the shift wave's fetch.
      uniform vec4 uStaticWaveZX[4];
      uniform vec4 uStaticWaveZY[4];
      // Style 7 (Density Refraction). uRefractGain is in PIXELS at a normalised gradient of 1.0 --
      // strength x 8% x min(w,h), the same target the static family is solved against. uRefractReach is in
      // texels of THIS pass (already screen-space scaled by the caller), uRefractInvert is +1 or -1 and
      // uRefractSource is 0 for the trail alpha and 1 for luminance.
      uniform float uRefractGain;
      uniform float uRefractReach;
      uniform float uRefractInvert;
      uniform int uRefractSource;
      // Style 9 (Band Split). 0 is a bit-identical no-op, which is why the term is ADDITIVE below.
      uniform float uBandAmount;
      // Style 10 (Vortex). uVortexGain is in PIXELS at unit r*f(r) and is solved on the CPU by vortexGain()
      // against the SAME 8% x min(w,h) target as every other style; it is 0 when no style-10 layer is live.
      // uVortexCentre is normalised UV, uVortexRadius is normalised (fraction of min(w,h) -- NOT texels, so a
      // preview tile must not scale it), uVortexInverse is 1.0 for the long-range 1/(1+r2) falloff and 0.0 for
      // the contained gaussian.
      // ⚠️ uVortexWeight is a FIFTH weight and cannot join uLayerWeight: that vec4's four channels are all
      // spoken for (static, flow, fluid, refract). Kept separate from uVortexGain rather than folded into it on
      // the CPU because the two are different quantities -- the gain is the resolution/radius solve and is
      // constant while the layer exists, the weight is weight x attractor fade and moves with a slider -- and
      // folding them would make the "gain != 0" branch below silently double as the weight gate.
      uniform float uVortexGain;
      /*
       * v8 30.4 (E125) -- Style 12, Conformal. uConformalMap is -1 when no style-12 layer is live, which is
       * the bit-identical no-op: the branch below is skipped entirely rather than multiplied by zero.
       *   0 = z^n   1 = 1/z   2 = log-polar   3 = Mobius
       * uConformalMobius packs (aRe, aIm, bRe, bIm) and (cRe, cIm) with d normalised to 1 -- 30.D7.
       */
      // v8 30.4 -- log-polar's normalisation. LP_SCALE is the span of log(r) over a frame normalised on
      // min(w,h); dividing by it brings the radial axis back into z's own range. See the map's own note.
      // v8 30.4 -- the conformal displacement cap, in UV. See conformalOffset()'s own note for the
      // measurements that set it and for why the normalisation is soft rather than a clamp.
      const float CONF_CAP = 1.0;
      const float LP_SCALE = 3.0;
      const float LP_PI = 3.14159265;
      uniform int uConformalMap;
      uniform float uConformalWeight;
      uniform vec2 uConformalCentre;
      uniform float uConformalPower;
      uniform vec4 uConformalMobiusAB;
      uniform vec2 uConformalMobiusC;
      uniform float uVortexWeight;
      uniform vec2 uVortexCentre;
      uniform float uVortexRadius;
      uniform float uVortexInverse;
      // Style 8 (Time Warp). uTimeWarpAmount 0 is a bit-identical no-op and is 0 whenever the history target
      // is absent (invariant 3: the flag dies with its resource). uTimeWarpSource is 0 for the summed field
      // magnitude and 1 for the trail's own accumulated alpha.
      uniform sampler2D uHistory;
      uniform float uTimeWarpAmount;
      // v8 31.R2 -- the coordinate source's maximum temporal depth, in FRAMES at the trailing edge.
      // 32 is about half a second at 60 fps: long enough that the lagging edge shows a visibly different
      // pose, short enough that it still reads as the same figure rather than an unrelated ghost.
      // ⚠️ The history is ONE recursively blended frame, so this is the depth of an exponential smear
      // and not a distinct instant -- see the note at the use site. Do not describe it as a ring buffer.
      const float TW_COORD_DEPTH = 32.0;
      uniform int uTimeWarpSource;
      // v8 30.5 (E126) -- the coordinate source. 0 = x, 1 = y, 2 = radial; bias slides which end lags.
      uniform int uTimeWarpAxis;
      uniform float uTimeWarpBias;
      // Style 11 (Depth Parallax). uParallaxAmount 0 is a bit-identical no-op and is 0 whenever the depth
      // target is absent. uParallaxNear/Far are displacement multipliers and uParallaxSquared selects the
      // curve. Depth arrives in .r of its own R16F target, 0 = far, 1 = near.
      uniform sampler2D uDepth;
      uniform float uParallaxAmount;
      uniform float uParallaxNear;
      uniform float uParallaxFar;
      uniform float uParallaxSquared;
      // The band the 0..1 depth scale is measured against (v8 Step 14.7b). The caller resolves 'figure' /
      // 'canvas' / 'manual' into these two numbers, so the shader has ONE code path and no mode int:
      // 'canvas' uploads 0/1, which makes the remap the identity. uParallaxBandScale is precomputed as
      // 1/(hi-lo) on the CPU -- a GPU divide per fragment for a value constant over the whole draw.
      uniform float uParallaxBandLo;
      uniform float uParallaxBandScale;
      in vec2 vUv;
      out vec4 fragColor;
      ${TRAIL_SANITISE_GLSL}

      // ⚠️ NOT \`round()\`. GLSL leaves round() IMPLEMENTATION-DEFINED at exactly .5 (it may round to
      // even), while the CPU field this must reproduce used JS Math.round, which rounds half toward +inf.
      // Ties are reachable: the styles-0-3 field lands on integer+0.5 wherever a wave crosses a half-texel,
      // and a one-texel sampling difference on a high-contrast trail is visible as a stipple.
      float jsRound(float v) { return floor(v + 0.5); }

      // The legacy roll/restrict pair, verbatim in behaviour. \`rollToRange\` REFLECTS off the bounds (it is
      // not a wrap and not a clamp), which is what folds a style-1 negative zoom back into the frame.
      float rollToRange(float v, float mn, float mx) {
        if (v < mn) return mn + mod(mn - v, mx - mn);
        if (v > mx) return mx - mod(v - mx, mx - mn);
        return v;
      }
      float zoomCoordinate(float ref, float coord, float zoom) {
        return jsRound(ref + (coord - ref) * zoom);
      }

      // The two 1D wave arrays, packed one layer per texture ROW: .r = shift wave, .g = style-3 zoom wave.
      // X waves occupy rows 0..3 and Y waves rows 4..7, so one fetch per axis per layer replaces what used
      // to be a canvas-sized RGBA32F texture (31.6 MB at 1080p, rebuilt whenever the field changed).
      //
      // ⚠️ ONE wave sample, and it is the FIRST of the angle's four index consumers (the others are
      // staticOffsetAt, solveGain and solveGain3, all in static-field.ts). ⚠️⚠️ A rotation added here
      // and forgotten in one of those three leaves every fieldcheck section D clause GREEN: section D is a
      // TEXT scan for each style's distinguishing term in both files, not a comparison of the two indices.
      // shapecheck section N is the instrument that compares them.
      float waveTap(int row, int chan, vec4 m, float idx, vec2 d) {
        if (m.w < 0.5) {
          // ⚠️ THE PRE-CHANGE EXPRESSION, taken by a BRANCH: one texelFetch at the integer texel, no lerp.
          // Texel CENTRE -> texel INDEX; vUv at a pixel centre is (i + 0.5)/n, so floor() recovered i
          // exactly. Bit-identity is not algebraic identity -- cos(90 deg) is 6.1e-17, not 0, so a Y wave
          // "rotated by zero" would NOT be this. Branch, never weight.
          vec4 v = texelFetch(uStaticField, ivec2(int(idx), row), 0);
          return chan == 0 ? v.r : v.g;
        }
        // ⚠️⚠️ A ROTATED INDEX IS FRACTIONAL -- it recovers no texel exactly -- so 2 taps and a lerp.
        // NEAREST would stair-step along the wave's own iso-lines, and the jsRound note above already
        // records that a one-texel sampling difference on a high-contrast trail reads as a stipple. The
        // lerp is ARITHMETIC, not a filter mode: the sampler stays NEAREST and the fetch stays texelFetch,
        // so a discontinuous wave shape cannot be smoothed by accident.
        float t = m.z + dot(d, m.xy);
        float f0 = floor(t);
        // Defensive only -- waveAxisMap derives the table length so both taps are in range at every pixel
        // and every angle. The bound is m.w, the table's OWN length, never the texture width (a max over
        // all four tables, whose tail belongs to a different, longer table).
        float i0 = clamp(f0, 0.0, m.w - 1.0);
        float i1 = clamp(f0 + 1.0, 0.0, m.w - 1.0);
        vec4 a = texelFetch(uStaticField, ivec2(int(i0), row), 0);
        vec4 b = texelFetch(uStaticField, ivec2(int(i1), row), 0);
        return mix(chan == 0 ? a.r : a.g, chan == 0 ? b.r : b.g, t - f0);
      }

      vec2 staticOffset() {
        vec2 px = vUv * uResolution;
        // Texel CENTRE -> texel INDEX. vUv at pixel centre is (i + 0.5)/n, so floor() recovers i exactly.
        float x = floor(px.x);
        float y = floor(px.y);
        // The pixel's offset from the FRAME centre, which is what the sampling rotation pivots about.
        // ⚠️ NOT uStaticCentre, which is the ZOOM centre and is read by the radial styles below: two
        // quantities, two symbols, and the wave's phase origin has never depended on the zoom centre.
        vec2 d = vec2(x, y) - uResolution * 0.5;
        vec2 acc = vec2(0.0);
        for (int i = 0; i < 4; i++) {
          if (i >= uStaticCount) break;
          float wx = waveTap(i, 0, uStaticWaveX[i], x, d);
          float wy = waveTap(i + 4, 0, uStaticWaveY[i], y, d);
          vec2 c = uStaticCentre[i];
          float x2, y2;
          int style = uStaticStyle[i];
          if (style == 0) {
            // Cross-coupled by design: HORIZONTAL displacement comes from the Y wave.
            x2 = clamp(x + wy, -100000.0, 100000.0);
            y2 = clamp(y + wx, -100000.0, 100000.0);
          } else if (style == 1) {
            x2 = zoomCoordinate(c.x, x, 1.0 - wx);
            y2 = zoomCoordinate(c.y, y, 1.0 - wy);
          } else if (style == 2) {
            float zoom = 1.0 - (wx + wy) / 2.0;
            x2 = zoomCoordinate(c.x, x, zoom);
            y2 = zoomCoordinate(c.y, y, zoom);
          } else {
            // Style 3: a SHIFT composed with a ZOOM from the second table.
            // ⚠️ The zoom half's OWN maps (angleX2/angleY2) and its OWN taps -- it used to arrive as .g of
            // the shift wave's fetch, which is impossible once the two halves can be rotated differently.
            float zx = waveTap(i, 1, uStaticWaveZX[i], x, d);
            float zy = waveTap(i + 4, 1, uStaticWaveZY[i], y, d);
            float zoom = 1.0 - (zx + zy) / 2.0;
            x2 = zoomCoordinate(c.x, jsRound(x + wy), zoom);
            y2 = zoomCoordinate(c.y, jsRound(y + wx), zoom);
          }
          float sx = rollToRange(jsRound(x2), 0.0, uResolution.x - 1.0);
          float sy = rollToRange(jsRound(y2), 0.0, uResolution.y - 1.0);
          acc += vec2((sx - x) / uResolution.x, (sy - y) / uResolution.y) * uStaticRatio[i];
        }
        return acc;
      }

      // Style 7's height sample -- the trail's own accumulated COVERAGE (alpha) or its LUMINANCE.
      //
      // Alpha is what every particle shader writes as its shape term (hdr-particle.ts:204 and six sibling
      // sites) and it is RGBA16F, so it is unbounded above: a dense MotionBlur accumulation pushes it well
      // past 1.0. That is handled by normalising the GRADIENT below rather than the height here, because
      // clamping the height would flatten every dense region to a plateau and delete the gradient outright.
      float refractHeight(vec2 uv) {
        vec4 t = texture(uFrame, uv);
        if (uRefractSource == 1) return dot(t.rgb, vec3(0.2126, 0.7152, 0.0722));
        return t.a;
      }

      // Central differences at +/- uRefractReach texels, then a SOFT normalisation.
      //
      // ⚠️ Two units traps, both live (invariant 10). First, a central difference over 2*reach texels is a
      // difference, not a derivative -- dividing by the span makes it a per-texel slope, which is what makes
      // Reach behave as SOFTNESS rather than as strength. Second, the result must come out in UV: uRefractGain
      // is in PIXELS (strength x 8% x min(w,h)), so the final divide by uResolution converts it, and the same
      // gain therefore means the same visible fraction of the frame at 600p and at 1080p.
      vec2 refractOffset() {
        vec2 texel = uRefractReach / uResolution;
        float hL = refractHeight(vUv - vec2(texel.x, 0.0));
        float hR = refractHeight(vUv + vec2(texel.x, 0.0));
        float hD = refractHeight(vUv - vec2(0.0, texel.y));
        float hU = refractHeight(vUv + vec2(0.0, texel.y));
        // Points UPHILL, toward denser trail. The default displaces AWAY from density (a bulge), so the
        // sign is negated here and uRefractInvert flips it back to a pinch.
        vec2 grad = vec2(hR - hL, hU - hD) / (2.0 * uRefractReach);
        // Soft-normalise to (0,1) in magnitude -- NOT a clamp. length/(1+length) is smooth everywhere and
        // leaves the sparse case nearly linear, which is what keeps a low-accumulation preset (Pipes) from
        // reading as "does nothing" while a dense one still cannot run away.
        float m = length(grad);
        if (m <= 0.0) return vec2(0.0);
        vec2 dir = grad / m;
        return dir * (m / (1.0 + m)) * -uRefractInvert * uRefractGain / uResolution;
      }

      // Style 10 -- Vortex. The one field style with no texture at all: a closed-form tangential displacement
      // about a placeable eye. Returns UV, like every other offset function here.
      //
      // ⚠️ RIGID ROTATION (perp x falloff), NOT a unit tangent x falloff. A unit tangent has magnitude 1 at
      // every r > 0 but its DIRECTION reverses across the eye, so the pixels either side of the centre are both
      // displaced by the full amount in opposite directions -- a hard pinch point rather than rotation, and a
      // discontinuity inside a feedback loop. perp is zero AT the eye and grows linearly out of it, which is
      // what a rotating body actually does. vortexGain() solves the gain against the peak of r*f(r) for exactly
      // this form; the two are one derivation and must be changed together.
      //
      // ⚠️ Distances are measured in PIXELS and then normalised by min(w,h), which is what makes the eye ROUND
      // on a 16:9 canvas and makes uVortexRadius mean the same shape at every resolution. Working in raw UV
      // would make the radius mean 1.78x more horizontally than vertically, and would make the tangent
      // non-perpendicular on screen.
      //
      // ⚠️ Units, checked at the RESULT rather than at the expression (invariant 10). d is dimensionless (a
      // fraction of min(w,h)), so d x f x uVortexGain is PIXELS -- uVortexGain being in pixels at unit r*f(r),
      // exactly like uRefractGain -- and the final divide by uResolution converts pixels to UV per axis. A
      // divide by min(w,h) instead would yield "a fraction of min(w,h)", which is not UV and would be 1.78x
      // wrong on the x axis at 16:9.
      /*
       * v8 30.4 (E125) -- the conformal warp, as a DISPLACEMENT.
       *
       * ⚠️ **THE PLANE IS NORMALISED ON min(w,h) ON BOTH AXES** (invariant 26). A per-axis normalisation
       * would turn every circle into an ellipse and make the word "conformal" false in the one place it is
       * the entire point of the style. The same scale is then undone on the way out, so the result is UV.
       *
       * ⚠️ **off = f(z) - z, NOT a coordinate replacement** (30.D10) -- which is what lets this sum with
       * every other layer and makes weight 0 the exact identity. Accepted cost: at an intermediate weight
       * the displacement is partial and the map is therefore NOT angle-preserving. Conformality holds at
       * full weight only, and the manual says so.
       *
       * ⚠️ **EVERY BRANCH IS GUARDED AT THE POLE, and the floor is ONE TEXEL rather than a picked epsilon**
       * -- so the guard is sub-pixel and cannot be seen, while 1/z at the centre and log(0) are both
       * unreachable. An unguarded pole here reaches acesToneMap as an Inf, and the ONLY reason that is now
       * survivable is ACES_EXPOSURE_BIAS's own clamp; do not rely on a downstream guard for an upstream
       * singularity.
       */
      vec2 conformalOffset() {
        float minDim = max(min(uResolution.x, uResolution.y), 1.0);
        vec2 z = (vUv - uConformalCentre) * uResolution / minDim;
        float r = length(z);
        // One texel, expressed on the same normalised scale as z itself.
        float eps = 1.0 / minDim;
        vec2 w = z;
        if (uConformalMap == 0) {
          // z^n by polar form: angles about the centre are multiplied by n, giving n petals. INTEGER n
          // only (30.D16) -- a fractional exponent puts a branch cut along one ray.
          float a = atan(z.y, z.x) * uConformalPower;
          float m = pow(max(r, eps), uConformalPower);
          w = vec2(cos(a), sin(a)) * m;
        } else if (uConformalMap == 1) {
          // 1/z -- the centre explodes outward and the far field collapses to a point. SAFE here because
          // this is image space: E133 is the same formula in MODEL space, where it destroys depth order.
          float r2 = max(dot(z, z), eps * eps);
          w = vec2(z.x, -z.y) / r2;
        } else if (uConformalMap == 2) {
          /*
           * Log-polar -- the Droste recession. Its branch cut IS the deliberate seam (30.D16), which is
           * why z^n is kept clean: one member with a seam, one without, neither ambiguous.
           *
           * ⚠️⚠️ **THE CENTRING AND SCALING ARE NOT COSMETIC. WITHOUT THEM THIS MAP TRANSLATES THE WHOLE
           * FRAME AND THE FIGURE LEAVES THE SCREEN** -- reported by the owner 2026-10-22 as *the whole
           * figure is somehow only showing on the right side*, and measured: the raw form's mean offset
           * over the frame is **(-0.482, +0.037) UV**, nearly half a frame width to the left.
           *
           * **The cause is that log and atan are neither in z's units nor zero-centred.** Over a frame
           * normalised on min(w,h), r runs about 0..0.94, so log(r) is ALWAYS NEGATIVE (-3..0) while z.x
           * spans -0.8..0.8; and atan spans +/-pi against z.y's +/-0.5. So w - z inherits a large constant
           * on both axes. ⚠️ **power and inverse are both already centred (measured mean 0.000), which is
           * exactly why only this member showed the defect** -- and why the clause that catches it has to
           * measure the MEAN OFFSET per map rather than trust the formula.
           *
           * The remedy keeps the map conformal: log-polar composed with a similarity is still conformal,
           * so dividing the log by LP_SCALE and the angle by pi and then subtracting the map's own mean is
           * a legitimate member rather than a fudge. LP_SCALE is the span of log(r) over a frame, which
           * brings the radial axis back into z's own range; the angular mean is 0 by symmetry.
           */
          vec2 lp = vec2(log(max(r, eps)) / LP_SCALE, atan(z.y, z.x) / LP_PI);
          w = lp - vec2(log(0.5) / LP_SCALE, 0.0);
        } else {
          // Mobius (az + b) / (cz + d) with d = 1, complex arithmetic written out.
          vec2 a = uConformalMobiusAB.xy, b = uConformalMobiusAB.zw, c = uConformalMobiusC;
          vec2 num = vec2(a.x * z.x - a.y * z.y, a.x * z.y + a.y * z.x) + b;
          vec2 den = vec2(c.x * z.x - c.y * z.y, c.x * z.y + c.y * z.x) + vec2(1.0, 0.0);
          float d2 = max(dot(den, den), eps * eps);
          w = vec2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / d2;
        }
        /*
         * ⚠️⚠️ **SOFT-NORMALISED, AND WITHOUT THIS THE STYLE IS UNUSABLE AT FULL WEIGHT.** Measured over
         * the frame, the raw displacement magnitude in UV (1.0 = a whole frame):
         *
         *     power    median 0.30   p95 0.55   max  0.65
         *     logPolar median 0.38   p95 0.98   max  1.27
         *     inverse  median 1.59   p95 5.20   max 60.02
         *
         * So power works and the other two throw the image off the screen -- which is what the owner
         * reported on 2026-10-22 (*the whole figure is somehow only showing on the right side*) for the
         * log-polar demo. ⚠️ **AND CENTRING IT WAS NOT ENOUGH, which is the instructive half:** the first
         * fix drove log-polar's MEAN offset from -0.482 to -0.016 and the figure was still off screen,
         * because log-polar maps the plane to a STRIP -- zero mean with a whole frame of spread. **A mean
         * is the wrong statistic for a displacement field; the magnitude distribution is the right one.**
         *
         * ⚠️ **SOFT, NOT CLAMPED, and refractOffset() in this same shader states the reason:** a clamp
         * puts a derivative discontinuity at the cap, which reads as a visible ring where the map crosses
         * it. x/(1+x) leaves small offsets nearly faithful -- so local conformality survives where the
         * map is gentle -- and saturates the extremes instead of letting a pole run away.
         *
         * CONF_CAP is ONE FRAME of the smaller axis. It is not the 8 % target the static family and the
         * vortex share, deliberately: those add a nudge, while a conformal map RESTRUCTURES the frame and
         * at 8 % would read as doing nothing. **The layer weight is the control for less.**
         */
        vec2 off = (w - z) * minDim / uResolution;
        float mag = length(off);
        return mag > 1e-6 ? off * (CONF_CAP / (CONF_CAP + mag)) : off;
      }

      vec2 vortexOffset() {
        float minDim = max(min(uResolution.x, uResolution.y), 1.0);
        vec2 d = (vUv - uVortexCentre) * uResolution / minDim;
        float r2 = dot(d, d);
        float R2 = max(uVortexRadius * uVortexRadius, 1e-6);
        float f = mix(exp(-r2 / R2), 1.0 / (1.0 + r2 / R2), uVortexInverse);
        return vec2(-d.y, d.x) * f * uVortexGain / uResolution;
      }

      void main() {
        // Every field contributes a RELATIVE offset, so the layers simply add. The static family is
        // evaluated here from its 1D waves; flow and fluid still arrive as full-resolution textures.
        vec2 sOff = staticOffset() * uLayerWeight.x;
        vec2 fOff = texture(uFlowField, vUv).rg * uLayerWeight.y;
        // The fluid velocity texture stores small UV-space values (~0.001-0.01); scale up so the
        // amplify slider (1-10) produces visible pixel warping.
        vec2 flOff = texture(uFluidField, vUv).rg * uLayerWeight.z * uAmplify * 50.0;
        // Style 7. uLayerWeight.w carries weight x fade, and the gain is already zero when no style-7 layer
        // is live -- so this whole term costs 4 texture fetches only when the layer exists (the caller skips
        // the gain upload otherwise, and the branch below skips the fetches).
        vec2 rOff = uRefractGain > 0.0 ? refractOffset() * uLayerWeight.w : vec2(0.0);
        // Style 10. uVortexWeight carries weight x fade and the gain is 0 when no style-10 layer is live, so
        // the branch skips the whole term rather than multiplying by zero.
        vec2 vOff = uVortexGain != 0.0 ? vortexOffset() * uVortexWeight : vec2(0.0);
        // Style 12. uConformalMap is -1 when no style-12 layer is live, so the branch skips the whole term
        // -- the same shape as the two above, and the reason the uniform is an int rather than a bool.
        vec2 cOff = uConformalMap >= 0 ? conformalOffset() * uConformalWeight : vec2(0.0);

        // Fade displacement AND output to zero near edges to prevent border accumulation. The trail
        // buffer uses CLAMP_TO_EDGE, so any color at the border persists and gets re-read each frame.
        // Gated on a fluid layer being present: it is style 6's feedback loop that needs it, and styles
        // 0-5 had no edge fade at all.
        float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeFade = mix(1.0, smoothstep(0.0, 0.02, edgeDist), uFeedbackPresent);

        // strength drives the glow and is measured PRE-mix, which is what style 6 did.
        float strength = length(flOff * edgeFade);

        // Style 11 -- Depth Parallax. A MODIFIER: it multiplies whatever the field layers already produced, so
        // it contributes nothing of its own and is exactly 1.0 at amount 0 (bit-identical to no layer).
        //
        // ⚠️ Applied to the SUM, before the clamp, and that ordering is load-bearing. Scaling each term
        // separately would be the same arithmetic (multiplication distributes) but would place the multiply
        // INSIDE the two branches above, so a chain with no refraction layer would silently skip it. Scaling
        // after the clamp would let the near field exceed uMaxOffset by uParallaxNear -- the clamp bounds the
        // sum precisely so a multi-layer chain cannot sample from off screen, and a 1.5x multiplier applied
        // afterwards would reopen exactly that.
        //
        // ⚠️ The depth texture is bound UNCONDITIONALLY (invariant 4) and reads 0 from the 1x1 fallback when no
        // depth target exists, so uParallaxAmount is what decides whether it is read -- and the caller sets that
        // to 0 in exactly the cases the fallback is bound (invariant 3).
        // ⚠️ The remap is applied BEFORE the curve, and that order is load-bearing. uParallaxSquared
        // biases toward the near end of whatever scale it is handed, so squaring a raw canvas-normalised depth
        // would bias toward the near end of the CANVAS -- a place a narrow-band figure never reaches, making
        // the curve control inert on exactly the presets this remap exists to rescue. Remapped first, 'squared'
        // means "near end of the FIGURE", which is what the control claims.
        //
        // ⚠️ Clamped, because manual bands are allowed to sit INSIDE the figure (that is the slab-isolation
        // case): depths beyond the band must pin to the ends rather than extrapolate past Near/Far and reopen
        // the off-screen sampling that the offset clamp below exists to prevent.
        float depthRaw = texture(uDepth, vUv).r;
        float depth = clamp((depthRaw - uParallaxBandLo) * uParallaxBandScale, 0.0, 1.0);
        float dCurve = mix(depth, depth * depth, uParallaxSquared);
        float parallax = mix(1.0, mix(uParallaxFar, uParallaxNear, dCurve), uParallaxAmount);

        // Clamp the SUM, not the parts — and only for a multi-layer chain. uMaxOffset < 0 means "never",
        // which is how a single field layer keeps the pre-chain shader's exact unbounded behaviour.
        vec2 off = (sOff + fOff + flOff + rOff + vOff + cOff) * uMix * edgeFade * parallax;
        // ⚠️ **Released to ZERO if non-finite, and this is at the SOURCE on purpose** (invariant 20,
        // 2026-08-22). A NaN here is not one bad texel: it is the sampling COORDINATE for every fetch below,
        // so the whole frame becomes undefined in a single draw, and this pass writes the buffer the next
        // frame reads. Sanitising only the output (which the line at the end of main() also does) would leave
        // the frame finite but sampled from nowhere; zeroing the offset degrades gracefully to "no warp this
        // frame", which is a visible glitch rather than a dead preview.
        //
        // NO BACKTICKS IN THIS COMMENT (invariant 18): one terminates the template literal and tsc reports the
        // error far from here. Writing this very note cost a failed tsc.
        //
        // The NaN test comes FIRST and is a comparison against itself, because every comparison with NaN is
        // false -- the length test against uMaxOffset below is transparent to it, and so is any clamp.
        if (any(notEqual(off, off)) || any(greaterThan(abs(off), vec2(1e30)))) off = vec2(0.0);
        if (uMaxOffset > 0.0) {
          float mag = length(off);
          if (mag > uMaxOffset) off *= uMaxOffset / mag;
        }

        vec2 baseUv = vUv + off;
        // The three per-channel taps, hoisted out of the dispersion branch because the BAND TERM below has
        // to correct each channel at the UV that channel was actually sampled from. At dispersion 0 all
        // three are exactly baseUv, so the no-dispersion path is bit-identical.
        //
        // ⚠️ **This hoist is the fix for the 2026-08-21 report** ("applying dispersion to Chain Flow Split
        // converges to a green frame that never goes away"). The band correction is derived to CANCEL
        // against a frame sample taken at baseUv; it was computed once at baseUv and added to all three
        // channels, while dispersion samples R and B at DIFFERENT offsets. So for R and B the cancellation
        // failed and the residue became a per-frame GAIN inside the trail feedback loop. Measured in a 1D
        // simulation of this preset (decay 0.88, offset 0.072 UV, amount 1.0): bounded at dispersion
        // 0.00-0.03 (peak 7.1 -> 17.6), but overflowing RGBA16F within 400 frames at 0.04 and within 200 at
        // 0.05 -- and the slider step is 0.01, so the FOURTH step off zero destroyed the frame. Green
        // survived because G is the one channel whose tap IS baseUv, which is exactly why the report says
        // green. Once a texel overflows to Inf, Inf - Inf in this very term makes it NaN, and the fade pass
        // MULTIPLIES, so nothing short of an explicit clear releases it -- hence "does not go away even
        // when dispersion is turned off again".
        vec2 rUv = baseUv;
        vec2 bUv = baseUv;
        if (uDispersion > 0.0) {
          rUv = vUv + off * (1.0 - uDispersion * 3.0);
          bUv = vUv + off * (1.0 + uDispersion * 3.0);
        }
        if (uDispersion > 0.0) {
          // Spread R/B sampling +/-3x dispersion away from green for strong chromatic fringing.
          //
          // NO BACKTICKS IN THIS COMMENT (invariant 17): one would terminate the template literal, and tsc
          // reports the error far from here.
          //
          // Applies to off -- the SUMMED chain offset -- so this is a modifier on whatever warp exists, NOT a
          // colour operation and NOT a fluid one (it was reachable only via style 6 until 2026-08-20). Two
          // consequences worth knowing before changing it: where off is zero all three taps collapse to the
          // same texel, so the effect self-limits to warped regions and needs no gate; and the spread is
          // PROPORTIONAL to the local offset, so a strong warp fringes far more than a gentle one at the same
          // setting. A lens-style aberration would instead be radial and independent of the motion -- a
          // different effect, deliberately not this one.
          float r = texture(uFrame, rUv).r;
          vec2 ga = texture(uFrame, baseUv).ga;
          float b = texture(uFrame, bUv).b;
          // ⚠️ Alpha comes from the GREEN tap, not a hardcoded 1.0 -- and that changed on 2026-08-20 because
          // style 7 made alpha a READ channel. This pass writes the trail buffer the next frame accumulates
          // into, so a constant 1.0 here flattened the accumulated coverage to a plateau: style 7 would read a
          // zero gradient everywhere and do NOTHING, but only in a chain that also had dispersion turned up --
          // an interaction, invisible in either feature tested alone, and it would have read as "refraction is
          // broken" rather than as "dispersion overwrote its input". Behaviour-neutral for everything else:
          // bloom and tone map both discard alpha, and the no-dispersion branch below already carries it.
          fragColor = vec4(r, ga.x, b, ga.y);
        } else {
          fragColor = texture(uFrame, baseUv);
        }

        // Style 9 -- Band Split. Freeze the LOW frequencies where they were and let only the high-frequency
        // residual travel with the warp.
        //
        // ⚠️ **Derived to be ADDITIVE, which the plan's sketch was not.** Writing it as the plan sketched it
        // (base_unwarped + mix(resid_unwarped, resid_warped, amount)) makes amount 0 mean "no warp at all",
        // contradicting the control's own definition that 0 is today's behaviour. Lerping between the two
        // END STATES instead:
        //     mix(full_warped, base_unwarped + resid_warped, amount)
        //   = mix(full_warped, base_unwarped + full_warped - base_warped, amount)
        //   = full_warped + amount * (base_unwarped - base_warped)
        // so amount 0 is bit-identical to no layer, and ONE blur of the INPUT frame sampled twice replaces
        // the two blur passes the naive form needs. That algebra is the whole reason this step is cheap.
        //
        // It is also why the operator is inert with no field layer, rather than merely pointless: with
        // off == 0, baseUv == vUv and the two samples cancel EXACTLY. So needsWarp does not count a band
        // layer, and the UI says so in the row (invariant 13). NO BACKTICKS IN THIS COMMENT (invariant 18).
        //
        // rgb only: alpha carries the accumulated coverage style 7 reads back next frame, and mixing a
        // blurred alpha into it would feed a smoothed height field into a gradient operator.
        //
        // ⚠️ **baseThere is sampled PER CHANNEL, at that channel's own tap** (rUv / baseUv / bUv), not once at
        // baseUv. The cancellation above is only exact against the UV the channel was actually read from, so a
        // single shared correction turns into a feedback GAIN on R and B the moment dispersion is non-zero --
        // the 2026-08-21 green-frame report. See the hoist of rUv/bUv for the measured divergence thresholds.
        // At dispersion 0 all three taps equal baseUv, so this is bit-identical to the previous single sample.
        if (uBandAmount > 0.0) {
          vec3 baseHere = texture(uBandBlur, vUv).rgb;
          vec3 baseThere = vec3(
            texture(uBandBlur, rUv).r,
            texture(uBandBlur, baseUv).g,
            texture(uBandBlur, bUv).b
          );
          fragColor.rgb += uBandAmount * (baseHere - baseThere);
        }

        // Style 8 -- Time Warp. Lerp toward a PREVIOUS frame by a per-pixel weight, so different parts of one
        // figure appear to run at different speeds.
        //
        // ⚠️ Structurally the same operator as Band Split above -- a lerp against a second texture inside this
        // pass -- which is why style 8 is a MODIFIER and not a second COLOUR style. As a colour style it would
        // be a second full pass beside the echo, turning the chain's two executable arrangements into six and
        // needing two scratch intermediates; see echoRunsFirst().
        //
        // NO BACKTICKS IN THIS COMMENT (invariant 18): one terminates the template literal and tsc reports the
        // error ~350 lines away. Writing this very block cost a failed tsc, exactly as the invariant predicts.
        //
        // ⚠️ uHistory is a REAL third target, not uFrame and not this pass's own attachment. The plan's "one
        // frame of history is free" premise was falsified: this shader writes fboA and texA is fboA's own colour
        // attachment, so reading it here would be a framebuffer feedback loop -- undefined in WebGL2 and SILENT
        // on ANGLE, i.e. invariant 20's shape rather than an error.
        //
        // ⚠️ The weight is sampled at vUv, the pixel being WRITTEN, not at baseUv. The question the operator
        // answers is "how much is this location lagging", and the field/density AT this location is what the
        // viewer sees there; reading the source location instead would make the lag pattern itself travel with
        // the warp, which is a smear of a smear rather than differential speed.
        //
        // rgb AND alpha: unlike Band Split this is a temporal blend of the whole frame, and alpha is the
        // accumulated coverage the next frame reads back -- holding it at the current frame's value while rgb
        // lags would desynchronise the density field from the colour it belongs to.
        if (uTimeWarpAmount > 0.0) {
          // Field source: the offset magnitude relative to the clamp band, so "pushed hardest" means "lags
          // most" and motion coincides with smear. Density source: the trail's own coverage, so the dense core
          // lags and sparse arcs stay crisp -- the inverse of a global blur. Both are soft-normalised by
          // x/(1+x) rather than clamped, for the same reason refractOffset() is: a low-accumulation preset must
          // not read as "does nothing" while a dense one cannot run away.
          /*
           * v8 30.5 (E126) -- the THIRD source, driven by a COORDINATE rather than by image content.
           *
           * ⚠️ **A TEMPORAL GRADIENT, NOT DISTINCT INSTANTS, AND 30.D2 CHOSE IT KNOWING THAT.** uHistory
           * is ONE frame blended recursively, so a region's past is an exponential smear whose depth
           * varies across the frame, not a distinct earlier instant. The N-frame ring that would give the
           * literal slit-scan is a named follow-up. **Do not describe this control as though the ring
           * existed** (invariant 25: the description owns the gate).
           *
           * The ramp is 0..1 across the chosen axis, or the radius normalised on min(w,h) so it is a
           * circle at every aspect ratio. Negative bias mirrors which end lags hardest.
           *
           * ⚠️⚠️ **THE COORDINATE SOURCE GETS ITS OWN MAPPING AND THE SHARED SOFT-NORMALISATION WAS THE
           * DEFECT, NOT THE RANGE.** It shipped as ramp x 8 fed through raw/(1+raw) -- a normaliser built
           * for UNBOUNDED image statistics (a pixel offset in px, a coverage alpha). The coordinate ramp
           * is already bounded 0..1 BY CONSTRUCTION, so it was being normalised twice, and the result
           * SATURATED: weight 0.44 at a tenth of the frame and 0.80 by the middle, a plateau for the whole
           * trailing half. Temporal depth therefore ran 1.8 to 9 frames with almost all of the change in
           * the first quarter -- which reads as a uniform smear rather than a scan, and the owner reported
           * it as "not strongly visible".
           *
           * ⚠️⚠️ **AND THE QUANTITY MADE LINEAR IS THE DEPTH, NOT THE WEIGHT.** Depth is 1/(1-w), which
           * is convex, so a weight linear in the ramp would still pile every visible change into the last
           * quarter. Inverting it -- w = 1 - 1/(1 + ramp*D) -- makes DEPTH linear in the coordinate, which
           * is what a slit-scan actually is: an even temporal gradient across the frame. Measured over the
           * ramp, depth now runs 1, 9, 17, 25, 33 frames instead of 1.8, 3, 5, 7, 9.
           *
           * ⚠️ **w < 1 FOR EVERY FINITE D, which is the guard that matters here**: at w = 1 the region
           * is replaced ENTIRELY by a recursively-blended history and never updates again -- a permanently
           * frozen patch. The form cannot reach it.
           */
          float coord = uTimeWarpAxis == 0 ? vUv.x
                      : uTimeWarpAxis == 1 ? vUv.y
                      : clamp(length((vUv - 0.5) * uResolution
                            / max(min(uResolution.x, uResolution.y), 1.0)) * 2.0, 0.0, 1.0);
          float ramp = clamp(mix(coord, 1.0 - coord, clamp(-uTimeWarpBias, 0.0, 1.0)), 0.0, 1.0);
          float raw = uTimeWarpSource == 1 ? fragColor.a : length(off) * uResolution.y;
          float w = uTimeWarpSource == 2
                  ? 1.0 - 1.0 / (1.0 + ramp * TW_COORD_DEPTH)
                  : raw / (1.0 + raw);
          vec4 hist = texture(uHistory, vUv);
          // Boolean select, never mix(x, y, float), if the history texel is non-finite (invariant 20): a NaN
          // multiplied by a zero weight is still NaN, so an arithmetic lerp would ADD the NaN back.
          bool histBad = any(notEqual(hist, hist)) || any(greaterThan(abs(hist), vec4(1e30)));
          fragColor = histBad ? fragColor : mix(fragColor, hist, uTimeWarpAmount * w);
        }

        // Additive glow: adds brightness in flow regions without compounding in the feedback loop
        float glow = uGlowBoost * strength * 8.0;
        fragColor.rgb += glow * fragColor.rgb / (1.0 + fragColor.rgb);
        // Fade output to black at edges — kills border accumulation in the feedback loop
        fragColor.rgb *= edgeFade;

        // ⚠️ **This pass writes texA, and until 2026-08-22 NOTHING guarded texA** (invariant 20). The two
        // decay blits in main.ts sanitise texA -> texB, so the loop is broken there every frame — but the
        // screen path and the ?gldiag=1 probe both read texA, i.e. the output of THIS shader, downstream of
        // that guard. So a NaN produced here reached the user on every frame while looking, from the code,
        // like something the existing guard should already have cleared.
        //
        // Belt and braces with the offset release above: that one keeps the frame CORRECT when the coordinate
        // goes bad, this one keeps the buffer FINITE whatever the cause -- including a non-finite texel
        // arriving in uFrame itself, which no coordinate check can see. Both are containment, not fixes.
        fragColor = sanitiseTrail(fragColor);
      }`;

    return compileProgram(gl, vert, frag, 'TransMap chain warp');
  }

  private createQuad(gl: WebGL2RenderingContext, program?: WebGLProgram): WebGLVertexArrayObject {
    const prog = program ?? this.program!;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createIfsProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    // IFS Fractal Feedback: for each pixel, blend N IFS-mapped samples of the trail
    const frag = `#version 300 es
      precision highp float;
      uniform sampler2D uFrame;
      uniform int uIfsCount;
      uniform vec4 uIfs[6];        // [angle_rad, scale, tx, ty] per transform
      uniform float uIfsWeights[6]; // normalized blend weights
      uniform float uMix;
      in vec2 vUv;
      out vec4 fragColor;
      ${TRAIL_SANITISE_GLSL}
      void main() {
        vec4 result = vec4(0.0);
        for (int i = 0; i < uIfsCount; i++) {
          float a = uIfs[i].x;
          float s = uIfs[i].y;
          vec2 t = uIfs[i].zw;
          mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
          vec2 srcUv = rot * (vUv - 0.5) * s + 0.5 + t;
          srcUv = clamp(srcUv, 0.0, 1.0);
          result += uIfsWeights[i] * texture(uFrame, srcUv);
        }
        vec4 original = texture(uFrame, vUv);
        // NO BACKTICKS IN THIS COMMENT (invariant 18): one terminates the template literal.
        //
        // ⚠️ Guarded because THIS pass can be the terminal write to texA (invariant 20, 2026-08-22): with an
        // echo layer and a field layer both live and echoFirst false, apply() runs warp -> scratch then
        // echo -> writeFBO, which is exactly the Chain Zoom Fractal preset. So guarding only the warp pass would
        // have left that ordering -- and a lone style-4 chain, where echo is the only pass -- unprotected.
        // The clamp on srcUv above is NOT a substitute: it bounds the coordinate, and is transparent to a NaN.
        fragColor = sanitiseTrail(mix(original, result, uMix));
      }`;

    return compileProgram(gl, vert, frag, 'TransMap IFS feedback');
  }
}
