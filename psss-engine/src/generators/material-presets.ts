import type { MaterialConfig, MaterialPresetName, BuoyancyConfig, SparkConfig, VolumeRenderConfig, CrystalRenderConfig, LiquidSurfaceConfig, CohesionConfig, LiquidFieldConfig, DyeFieldConfig } from '../presets/types.ts';
// A TYPE-ONLY import, and `film-looks.ts` itself imports nothing at all — so this adds no module cycle.
import type { FilmLookParams } from '../renderers/film-looks.ts';
// ⚠️ TYPE-ONLY, for the render-mode resolver moved here by 22.1 (see its banner near the foot of this
// file). `core/interfaces.ts` has no imports of its own, so this closes no cycle.
import type { RenderMode } from '../core/interfaces.ts';

/**
 * The presentation half of a material bundle — everything a material needs in order to LOOK like itself
 * that `MaterialConfig`'s eleven fields cannot express.
 *
 * ## Why this exists
 *
 * Reported as *"when we select a material type in the dropdown, all settings that we define to belong to
 * this material config [should] be set and the UI settings should reflect those"*, after selecting `Fire`
 * on `Cycloid` changed nothing visible. The diagnosis, measured rather than assumed:
 *
 * - `Cycloid` authors `filmLook: 'Customize'` with `palette: 'Neon'`, `paletteMapping: 'phase'`.
 * - `hdr-particle.ts`'s splat shader assigns `rampColor.rgb = texture(uSplatPaletteTex, ...)` — an
 *   ASSIGNMENT, not a blend. So the material's `colourRamp` is uploaded every frame and then DISCARDED.
 * - `'phase'` indexes the palette by the PRESET's wave colour, so the material's heat reached neither the
 *   ramp (overwritten) nor the palette (not its index). **The material's only surviving contribution was
 *   its geometry**, which is exactly why `Fire` and `Ember` produced the same picture.
 *
 * ⚠️ **THE MATERIAL BLOCK WAS NEVER THE DEFECT.** Measured against `Lissajous Flame` — the user's own
 * template for `Fire` — **9 of the 11 `MaterialConfig` fields were already byte-equal to this bundle**;
 * only `thermalLag` (0.12 vs 0.04) and `emissionIntensity` (1.8 vs 2.0) differed. Everything that made
 * that preset read correctly lived in fields a bundle could not carry: the film look, the palette, the
 * renderer glow, the trail decay, and the buoyancy/spark blocks. **So the fix is a wider bundle, not a
 * retuned one** — and that is why the earlier proposals (force `paletteMapping`, disable the palette,
 * or extend `MaterialConfig`) were all rejected in favour of this.
 *
 * ## What it deliberately does NOT contain
 *
 * ⚠️ **Nothing that is the HOST PRESET's identity.** By explicit instruction: no `particleCount` (2000 on
 * the template vs 40 000 on `Cycloid` — applying it would change the FIGURE, not its presentation), no
 * waves, no `colorBase`/`colorAmp`, no rotation, no `speedFactor`, no TransMap and no attractor. Only
 * material, rendering and colour settings. **A field belongs here only if it changes how the material is
 * PRESENTED; if it changes what is being drawn, it does not.**
 *
 * ## It is a DEFAULT SET, not a lock
 *
 * Every field is applied through the same setter the UI uses, into ordinary live state. `setMaterialConfig`
 * already ends in `notifyExternalChange()` (`main.ts`) and Visual FX already subscribes to it
 * (`visual-fx.ts`), so the tab re-syncs to the new values with **no new wiring** — which is the
 * *"UI settings should reflect those"* half of the request. Afterwards every value is overwritable from
 * Visual FX or Materials exactly as before. ⚠️ **Nothing here is hardwired into the render path**, by
 * instruction: *"no further hardwiring or changes expected in how we process"*.
 *
 * ⚠️ **OPTIONAL BY DESIGN.** A material with no `presentation` behaves exactly as it did before this
 * existed, so materials can be given templates one at a time as the user supplies them. `Fire` is the
 * first (from `Lissajous Flame`); `Ember` is next.
 */
export interface MaterialPresentation {
  /**
   * ⚠️ **`'Customize'` and NOT `'Legacy'`, even though the template authors `Legacy`.**
   *
   * `Lissajous Flame` sets `filmLook: 'Legacy'`, and its own comment explains why: Legacy is no
   * post-processing, so the material's hand-tuned brightness *"read exactly as authored rather than
   * through a grade"*. But **Legacy forces `palette: 'none'`**, and a real fire palette is a stated
   * requirement (*"none is not good enough, we need a real fire one"*). `Customize` is the ONLY look
   * that can carry a chosen palette, so the grading below is taken from the template's own
   * `postProcessors` block — the numbers it authored before its look was switched to Legacy.
   */
  filmLook?: string;
  /**
   * Merged over the CURRENT film look's params, so a field omitted here keeps its live value rather than
   * snapping to a bundle default. Spread as a partial for that reason.
   */
  customFilmLookParams?: Partial<FilmLookParams>;
  /**
   * `renderer.decayFactor` — trail length. A RENDERING parameter, so it is in scope, and it moves the look
   * hard: Fire's template authors 0.86 against `Cycloid`'s 0.617.
   *
   * ⚠️ **THE ONE FIELD HERE WITH NO UI CONTROL OF ITS OWN, WHICH MAKES IT THE ONE PARTIAL EXCEPTION TO
   * *"later they can be changed again individually in the corresponding controls"*.** Grepped: `src/` has
   * no Visual FX or Materials row that writes `renderer.decayFactor`. The reachable levers are the Sliders
   * tab's `Glow` multiplier (which scales it as one of four coupled effects) and TransMap style 6's
   * `persist`, which OVERRIDES it — neither is "the corresponding control". It is included anyway because
   * omitting it would leave Fire's presentation visibly wrong on any preset with a short trail, which is
   * the larger of the two costs; **recorded rather than hidden**, and it is the argument for a Trail Decay
   * row if the user wants one.
   *
   * ⚠️ Interacts with `materialTrailDecayCap()` (`main.ts`): at 0.86 with emission 2.0 the accumulation
   * index is 14.3, under the 25 ceiling, so **the cap never engages for this authored presentation** —
   * which is what makes the `emissionIntensity` 1.8 -> 2.0 change safe. The cap stays what it was built to
   * be: a backstop for hand-set combinations.
   *
   * ⚠️ **Applied by WRITING THE PRESET FIELD, never by assigning `trailDecay`.** `applyFluidFeedbackState()`
   * re-derives `trailDecay` from `preset.renderer.decayFactor` on every call, so a direct assignment would
   * be silently reverted by the next material or TransMap touch — the exact leak that function's header
   * documents.
   */
  decayFactor?: number;
  /**
   * ⚠️ **Crystals must be stated EXPLICITLY, including `{enabled: false}`.** The dropdown already decides
   * this via `materialAutoEnablesCrystals()` (Ice on, everything else off), and Fire's `false` agrees with
   * that — so this field is currently a redundant restatement for Fire and load-bearing only once a
   * material other than Ice wants crystals (Organic is expected to). It is written out anyway because a
   * bundle that omits it would silently inherit whichever answer the previous material left behind.
   */
  crystals?: Partial<CrystalRenderConfig>;
  buoyancy?: Partial<BuoyancyConfig>;
  sparks?: Partial<SparkConfig>;
  /**
   * Which NAMED bundle the Sliders tab rebuilds its grading seed from. `filmLook: 'Customize'` needs one, or
   * `grading()` (`exploration/slider-mappings.ts`) falls back to the bare `'Legacy'` literal.
   *
   * ⚠️ **CHOSEN, not measured — the one field here with no template value**, `Lissajous Flame` authoring
   * `Legacy`, which this block deliberately does not use.
   *
   * ⚠️ **A KNOWN LIMITATION, AND NAMING A BETTER BASE CANNOT FIX IT — recorded rather than hidden.**
   * `grading()` rebuilds `customFilmLookParams` WHOLESALE from the named bundle (`params = {...seed}`) on
   * every Mood / Glow / Depth drag, and it does that deliberately: rebuilding is what makes those sliders
   * idempotent, which is the tab's core contract after a compounding defect once reached exposure x875. But
   * **no named bundle carries a material ramp as its palette** (measured: the 15 bundles use `none`, `Warm`,
   * `Neon`, `Pastel`, `Prismatic`, `Earth`, `Cool`, `Monochrome`, `Sunset`, `Aurora`, `Midnight`), so the
   * first such drag after selecting a material replaces `'Material: fire'` with the base's palette and the
   * material's colour reverts. The other twelve grading fields survive.
   *
   * This is not new behaviour and not specific to materials — it is what `sliderBaseFilmLook` exists to
   * mitigate, and it works for a preset like `Cycloid` only because that preset's palette IS its base's
   * palette. A material presentation is the first case where the two legitimately differ. Fixing it means
   * teaching `grading()` to carry the palette across a rebuild (safe in principle — no slider MULTIPLIES a
   * palette, so idempotency is untouched), which is a change to a different subsystem's contract and is
   * therefore **flagged, not made here**.
   */
  sliderBaseFilmLook?: string;
}

export interface MaterialPresetDefinition {
  name: MaterialPresetName;
  label: string;
  config: Omit<MaterialConfig, 'preset'>;
  /** See `MaterialPresentation`. Absent = this material behaves exactly as it did before the block existed. */
  presentation?: MaterialPresentation;
}

export const DEFAULT_BUOYANCY_CONFIG: BuoyancyConfig = {
  enabled: false,
  strength: 1.5,
  returnForce: 2.0,
  turbulence: 0.3,
  maxOffset: 200,
  curlOctaves: true,
  smokeThreshold: 0.25,
  smokeOpacity: 0.4,
  smokeDissipation: 0.95,
};

export const DEFAULT_SPARK_CONFIG: SparkConfig = {
  enabled: false,
  poolSize: 500,
  threshold: 0.6,
  // ⚠️ **1.2 UNTIL 2026-09-17, AND LEAVING IT THERE WOULD HAVE BROKEN THE FIX IN THE OPPOSITE DIRECTION.**
  // This is what ticking `Sparks` hands a user, and the number multiplies the particle's real per-frame
  // motion now that `lissajous.ts`' `frameMotion` reports it: 1.2 over a typical ~2 000 px/s base is
  // ~2 400 px/s, i.e. an ember crossing the frame in a fifth of a second. Re-fitted by this file's own
  // `gravity`/`drag`: 2 x 200 / 1.5 = 267 px/s target, which over that base asks for 0.13 and lands on the
  // 0.1 track floor. ⚠️ **There is no single correct default** — the base varies 140x across the library
  // (24 to 3 310 px/s measured), so this value is right for a fast figure and weak for a slow one; the
  // slider is where that gets resolved, and it cannot currently go below 0.1.
  ejectionSpeed: 0.1,
  gravity: 200,
  drag: 1.5,
  minLifetime: 0.3,
  maxLifetime: 1.0,
  coolingRate: 2.0,
  splatRadius: 3.0,
  maxSparksPerFrame: 5,
};

/**
 * v8 Step 15.7 (E90) — the advected dye field's defaults. **RESTORED 2026-09-03 with the render passes and
 * their frame-loop calls, which is the condition the 2026-08-12 deletion set** (triage G14 removed a
 * `DEFAULT_DYE_CONFIG` from exactly this spot because `injectDye`/`advectDye`/`renderDyeOverlay` had zero
 * callers; the owner is now `post-processors/dye-field.ts` and `main.ts` calls it per frame).
 *
 * ⚠️ **`decayRate: 0.985` and not 1.0, and the reason is the source's whole point.** A field that never fades
 * saturates to uniform on any figure that revisits its own path — i.e. every rotating preset — and a saturated
 * field is a FLAT COLOUR, which is precisely the `'ramp'` result this tint source exists to differ from. The
 * visible structure *is* the decay. It is also why the track's useful range is narrow and near 1: at 0.95 the
 * dye survives about 20 frames, a third of a second, and reads as a coloured glow rather than a wake.
 *
 * `advectionStrength: 1.0` is the PASS-THROUGH value — the dye follows the flow at the strength the velocity
 * field actually reports, so the control exists to under- or over-drive it. A default that already over-drove
 * would leave half the track unusable.
 *
 * ⚠️ **`enabled: false`.** No preset in the library authors an `overlay.dye` block, so this default merges into
 * all 360 of them; a true default would turn two 512² passes on for every preset and change every liquid
 * preset's colour. Phase 15 also forbids any step authoring or retuning a library preset.
 *
 * ⚠️ **`colourSource: 'depth'`, AND THE TWO REJECTED CANDIDATES ARE BOTH MORE INSTRUCTIVE THAN THE CHOICE.**
 * This default has now been wrong twice, in opposite directions, and each time it was wrong for a reason that
 * looked like a virtue:
 *
 * - **`'velocity'` (until 2026-09-03)** was chosen as the one source needing no material — true, and
 *   irrelevant. It deposits `state.colors[i] * k`, `k = 0.35 + 0.65·min(1, |v|/6)`: **the figure's own colour,
 *   dimmed.** So a subsystem whose entire purpose is a colour the figure does not already have deposited a
 *   darker copy of the colour the figure already had, and the browser pass reported *"makes the figure dark but
 *   no other visual change"* — invariant 13's harder form, the output channel unable to show a correct control.
 * - **`'fixed'` (for one day, 2026-09-03)** fixed that by being unmistakable, and broke something subtler: it
 *   is spatially CONSTANT, and the surface resolves the field as **`rgb / a`**, which is scale-invariant. A
 *   constant deposit therefore makes the quotient constant, so **Amount, Decay, Radius and Advection all
 *   divide away** — measured at exactly `1.0000, 0.3500, 0.1000` for every value of all four. The user's report
 *   was *"none of the sliders seems to have an effect"*, and it was precisely right.
 *
 * ⚠️ **THE RULE BOTH ROUNDS TEACH, and it is a stronger one than either fix: A DEFAULT MUST BE JUDGED AGAINST
 * WHAT THE READ CAN REPRESENT, NOT AGAINST WHETHER THE VALUE IS SENSIBLE.** `rgb / a` normalises away exactly
 * the quantity every slider drives, so *visibility* and *variability* are two separate requirements and the
 * first two defaults each satisfied only one. `'depth'` is the only source that satisfies both without a
 * material: it varies across the figure (so the sliders and the flow-mixing are both legible) and it needs
 * nothing but `state.depths`, which every generator always fills.
 */
export const DEFAULT_DYE_CONFIG: DyeFieldConfig = {
  enabled: false,
  decayRate: 0.985,
  opacity: 0.5,
  colourSource: 'depth',
  fixedColour: [1.0, 0.35, 0.1],
  injectionRadius: 12,
  advectionStrength: 1.0,
  // v8 28.3/28.4/28.5. ⚠️ **ALL THREE DEFAULTS ARE CHOSEN SO THAT EVERY EXISTING PRESET IS UNCHANGED**,
  // which is what makes this phase losslessly importable over the whole library:
  //   `ramp`       — read ONLY under `colourSource: 'ramp'`, which no library preset authors, so the value
  //                  is unreachable until a user picks that source. A real name rather than '' so the new
  //                  source does something the moment it is selected.
  //   `blendMode`  — 'over' is the in-surface wake's own algebra, so the 5 visible dye presets are
  //                  byte-identical. 'add' would have restyled all 5.
  //   `showFigure` — true is the pre-28 behaviour, and the reader forces it true anyway whenever the dye
  //                  is not drawing, so a black frame is unreachable by construction.
  ramp: 'Classic: fire',
  blendMode: 'over',
  showFigure: true,
  // v8 28.16. ⚠️ **`'depth'` and `1` are the pre-28.16 behaviour exactly**: the coordinate selector's
  // depth branch is byte-identical to the single expression it replaced, and `cycles` is unreachable
  // under that mapping — so no preset, authored or shipped, changes by one texel.
  mapping: 'depth',
  cycles: 1,
};

// `velocityStretch: 0.5` was the fourth entry here until 2026-08-29. It had zero readers and cannot be
// wired as declared — volume draws POINT SPRITES, whose size is a scalar. See `VolumeRenderConfig`.
export const DEFAULT_VOLUME_CONFIG: VolumeRenderConfig = {
  extinction: 3.0,
  densityScale: 1.0,
  depthFade: 0.3,
};

/**
 * v8 Step 15.1 — the `liquid` render mode's defaults.
 *
 * `isoLevel: 1.0` — **the surface forms at the reference density itself**, i.e. at the typical half-eroded
 * surface. The value is a ratio, so it carries over unchanged between a 4000-particle legacy preset and a
 * 20 000-particle engine one — that count-independence is the whole point of the normalisation and is derived
 * in `LiquidSurfaceConfig`.
 *
 * ⚠️ **1.0 IS NOT AN ARBITRARY IDENTITY VALUE — IT IS WHERE `liquid-reference.ts`'s `CALIBRATION` PUTS THE
 * HALF-ERODED SURFACE**, measured as the geometric median over 15 figures. That is what makes 1.0 the right
 * default and what makes the track's two halves both useful: below it the lobes fuse, above it they separate.
 *
 * ⚠️ **THE 15.1 DEFAULT WAS 2.0 AGAINST THE FRAME MEAN, AND ITS OWN COMMENT'S REASONING WAS SOUND AND IS NOW
 * OBSOLETE** — that reference is only a lower bound today (see `liquidDensityReference`), so "twice the frame
 * mean" no longer names a look. Do not restore it by reading this file's history: the number is a consequence
 * of which reference is in force, and 15.1b changed the reference.
 *
 * The track constraint that produced 2.0 still applies and 1.0 satisfies it too: Iso Level runs 0.0625–4.0 on
 * a log slider (exactly 6 octaves, step 1/120 — see `ISO_LEVEL_TRACK`), and 1.0 is exactly reachable and
 * round-trips exactly. An unreachable default is `trackcheck`'s reachability failure class arriving through
 * the DEFAULT rather than through the range, and it is what ruled out the plan's originally specified value.
 *
 * `edgeSoftness: 0.15` — a narrow feather, so the silhouette reads as a boundary (which is the feature)
 * rather than as the cloud of light every other mode already produces. 0 is legitimate and gives flat paint.
 *
 * `tintSource: 'preset'` — the neutral choice: the particle's own colour is what every other point path
 * draws, so a preset that merely switches mode changes its SHAPE and not its palette. The other three
 * sources are opt-in.
 *
 * ⚠️ **v8 Step 15.2: `colourMix: 0.85` IS DELIBERATELY NOT NEUTRAL, and the alternative was measured and
 * chosen against.** A default merges into every preset that omits the block, so 0.85 visibly recolours the
 * shipped `Liquid Surface` — median deviation from 15.1's flat tint **0.0813** in RGB distance (~21/255,
 * against an 8-bit just-noticeable of ~0.0068). 0 would have been byte-identical everywhere, at the cost of a
 * step that ships invisible unless a browser pass is told which slider to move — the discoverability failure
 * invariant 25 is about. The user chose the visible default explicitly. `fieldcheck` §O therefore asserts an
 * **algebraic identity at `colourMix = 0`**, NOT preset neutrality; do not restate that assertion as the
 * latter. `mixModel: 'light'` keeps the *character* additive, which is what every palette and film look
 * expects — `'pigment'` is the opt-in that makes the surface read as ink rather than as coloured light.
 *
 * ⚠️ **v8 Step 15.3's FOUR defaults are all non-neutral, and unlike 15.2 there is no identity value to
 * protect.** 15.2's `colourMix: 0` had to remain byte-identical to 15.1 because it was the only way to
 * recover the previous image; here each of the four controls reaches neutral independently, so the step can
 * ship visible without giving anything up. They are deliberately MODEST rather than demonstrative — the
 * silhouette is still 15.1's feature and a hard key light would read as embossing:
 *
 * - `refraction: 0.25` — crystal's own default is 0.3 and its DEMO presets author 0.25–0.46, so this sits at
 *   the bottom of the established range. The dispersion it drives is a rim effect (median chromatic delta
 *   0.072 at full strength, against an 8-bit just-noticeable of ~0.004), so a quarter of it is visible
 *   without reading as chromatic aberration.
 * - `specular: 0.8` — below crystal's 1.5, because `SPEC_EXPONENT` is 16 against crystal's 42: the same
 *   strength on a broader lobe lights ~2.6× the area (45.2 % of surface pixels vs 17.3 %).
 * - `thickness: 0.5` — half of `ABSORB_SCALE`, so the median surface keeps ~0.84 of its light and the p99
 *   core ~0.22. At 1.0 a thick core goes far enough toward black to lose its chroma upstream of the tone
 *   map, and this value feeds the trail's feedback loop.
 * - `edgeBrightness: 0.6` — half crystal's 1.2. Fresnel is p99 0.156 here, so the rim is a narrow annulus
 *   and a crystal-strength value would make it the brightest thing on screen rather than a wet edge.
 */
export const DEFAULT_LIQUID_CONFIG: LiquidSurfaceConfig = {
  isoLevel: 1.0,
  kernelWidth: 1.0,
  edgeSoftness: 0.15,
  tintSource: 'preset',
  surfaceRamp: 'liquid',
  colourMix: 0.85,
  mixModel: 'light',
  refraction: 0.25,
  specular: 0.8,
  thickness: 0.5,
  edgeBrightness: 0.6,
};

/**
 * v8 Step 15.4 (E87) — cohesion's defaults. ⚠️ **`strength: 0` IS THE OPPOSITE DECISION FROM 15.2's AND
 * 15.3's, and it is a decision rather than caution.**
 *
 * The two previous steps shipped non-neutral defaults because they refine a surface that is already on
 * screen: a user who has selected `liquid` sees the change without being told where to look. This step
 * changes the FIGURE — it dissolves a Lissajous curve into droplets — and it is read in **every** render
 * mode, so a non-zero default would silently restyle all 360 presets, including the 177 legacy ones whose
 * whole purpose is parity with `psss.js`. So the neutral default here buys byte-identity on the entire
 * library, and the step is made discoverable by an inline hint in the tab instead (invariant 25's remedy:
 * the precondition goes inline, the description goes in the tooltip).
 *
 * The other two are the values a user arriving at a zero slider should find already sensible, chosen from
 * the blob-count sweep on `Liquid Surface` at 15 000 particles rather than picked:
 *
 * - `radius: 16` — 103 blobs of median 53 px, the middle of the 4–64 px track (which is 4 exact octaves).
 *   Below 8 the drops are near the kernel's own scale and read as noise on the curve rather than as beads;
 *   above 40 there are only ~30 of them and the figure reads as a few sagging lumps.
 * - `returnForce: 1.5` — measured, **0 of 10 000** particles reach the internal offset cap here and the max
 *   displacement settles at 43.9 px, against a population pinned at the cap when the spring is 0. So the
 *   figure still recognisably traces its trajectory while the beads are unmistakable.
 */
export const DEFAULT_COHESION_CONFIG: CohesionConfig = {
  strength: 0,
  radius: 16,
  returnForce: 1.5,
};

/**
 * v8 Step 15.5 (E88) — the liquid pool's defaults. **`enabled: false` follows 15.4's reasoning, not 15.2's or
 * 15.3's**, and one step further: this block does not merely restyle the figure, it ADDS PARTICLES, so a
 * non-false default would change `state.count` on all 360 presets and with it every published array's length,
 * the additive-overlap divisor, the trail's exposure and the frame cost. There is no version of that which is
 * an acceptable silent default.
 *
 * ⚠️ **THE OTHER FOUR ARE THEREFORE NOT "SAFE" VALUES BUT `DEMONSTRATIVE` ONES, WHICH IS THE OPPOSITE OF
 * `DEFAULT_COHESION_CONFIG`'s NEIGHBOURS — and that difference is the direct consequence of the gate.** With
 * `enabled` false the four scalars are unreachable until a user deliberately ticks a box, at which point they
 * are the FIRST thing that user sees; a cautious set would read as "I enabled it and nothing happened", which
 * is precisely the report Phase 14 collected three times. So they are chosen to make the effect unmistakable
 * on the one preset that can be judged in liquid mode:
 *
 * - `poolSize: 4000` — the step's own figure, and it is the median legacy particle count, so the pool is
 *   comparable in mass to the figure stirring it rather than a faint haze around it. At the 20 000 ceiling the
 *   pool would dominate its own cause.
 * - `seedPattern: 'cloud'` — the step's own default, and the only one of the four that is centred on the
 *   figure. `fill` spreads the pool so thin that a single curve's wake is a small local disturbance in it;
 *   `basin` puts the liquid where a legacy figure mostly is not (the frame's bottom edge); `blobs` starts
 *   already separated, so merging cannot be observed. A cloud concentrated where the figure actually draws is
 *   what makes the first frame after ticking the box show something.
 * - `fieldCoupling: 0.5` — the step's own figure, and it is the middle of a linear 0–1 track, so both
 *   directions are available from the default. The gain it multiplies is derived, not measured (the field's
 *   magnitude exists only in a live GL context — see `LiquidPool.SPEED`), so 0.5 is deliberately the value
 *   with a full octave of headroom in each direction.
 * - `fieldDecay: 0.985` — **the value the processor already holds** (`fluid-advection.ts`'s
 *   `private fieldDecay = 0.985`), so surfacing this control is neutral for `Fluid Feedback`, the field's
 *   existing author. A default that differed would have retuned style 6 as a side effect of adding a slider
 *   to a different feature, which no browser pass on a liquid preset would have caught.
 */
export const DEFAULT_LIQUID_FIELD_CONFIG: LiquidFieldConfig = {
  enabled: false,
  poolSize: 4000,
  seedPattern: 'cloud',
  fieldCoupling: 0.5,
  fieldDecay: 0.985,
};

/**
 * M2 — every `velocityStretch` here is <= 1.0, and that is a hard ceiling, not a coincidence.
 *
 * Both shader stages compute `blend = clamp(velocityStretch, 0.0, 1.0)` and use `blend` for
 * everything they do with the field, so a value above 1.0 is INERT. Six configs shipped at 1.2-2.0
 * and rendered exactly as 1.0 would, while the Materials slider advertised a 0-6 range in which
 * five sixths of the travel did nothing.
 *
 * Values were clamped rather than rescaled precisely because >1 never had an effect: clamping is
 * byte-identical output, whereas rescaling would have changed how every one of them looks.
 */
export const DEFAULT_MATERIAL_CONFIG: MaterialConfig = {
  preset: 'None',
  splatRadius: 8.0,
  coreBrightness: 1.5,
  haloStrength: 0.8,
  falloffExponent: 3.0,
  thermalLag: 0.286,
  emissionIntensity: 2.0,
  heatMode: 'velocity',
  heatGain: 1.0,
  blendMode: 'additive',
  colourRamp: 'fire',
  velocityStretch: 1.0,
};

export const MATERIAL_PRESETS: MaterialPresetDefinition[] = [
  {
    name: 'Plasma',
    label: 'Plasma',
    /**
     * RETUNED 2026-08-21, together with `LiquidLight`, to fix a MEASURED redundancy — the two were
     * very nearly the same material and the difference was not authorable away in a preset.
     *
     * The report was "what is Plasma actually different from Liquid Light?". Diffed field by field,
     * the two shared `colourRamp: 'liquid'`, `blendMode: 'additive'`, `heatMode: 'velocity'` AND
     * `velocityStretch: 1.0` — the four most visually decisive fields — leaving only `thermalLag`
     * (0.08 vs 0.3) plus sub-15 % deltas on radius/brightness/falloff. So the near-identity was an
     * ENGINE fact, not an authoring failure.
     *
     * ⚠️ **`heatGain` is a RAMP-WINDOW control, not a brightness control**, and that is the half of
     * this fix that actually separates them. Since the Open Point 7 fix 3b, steady-state temperature
     * is `driver * heatGain`, and the velocity driver is RANK-normalised per frame — so `heatGain`
     * sets which SEGMENT of the ramp the population occupies. Measured on the liquid ramp at each
     * material's own median normalised speed:
     *
     *     shipped   Plasma 0.95 -> median rgb(  0,200,129) hue 159d   } 23d apart: both teal-green,
     *               Liquid 0.90 -> median rgb(  0,168,174) hue 182d   } which is the reported problem
     *     retuned   Plasma 0.60 -> median rgb( 79, 52,200) hue 251d   } 73d apart: violet-blue vs
     *               Liquid 0.92 -> median rgb(  0,173,167) hue 178d   } teal-green
     *
     * 0.60 parks Plasma in the ramp's 0.09..0.60 window — the purple-through-electric-blue half —
     * and leaves the teal/green top end to `LiquidLight`. The ramp itself is UNTOUCHED: it is shared
     * with `LiquidLight` and (via `crystalRamp`) with the crystal pass, so widening the window rather
     * than editing control points is what keeps this local to one material.
     *
     * `velocityStretch` 1.0 -> 0.25 is the second axis, and it is a SHAPE control, not a colour one:
     * both shader stages compute `blend = clamp(velocityStretch, 0, 1)` and mix the round core/halo
     * kernel toward a tapered velocity-aligned FLAME kernel. At 1.0 both materials rendered as flame
     * streaks, so they matched in silhouette as well as in hue. 0.25 keeps Plasma nearly round — an
     * arc discharge is a point event, not a plume — while `LiquidLight` stays elongated at 0.85.
     *
     * `falloffExponent` 2.5 -> 3.2 and `splatRadius` 12 -> 9 tighten the halo for the same reason;
     * `coreBrightness` 1.5 -> 1.9 and `emissionIntensity` 1.7 -> 2.1 pay back the luminance the
     * lower `heatGain` costs (a narrower window sits lower on the ramp, hence darker per particle).
     * `thermalLag` stays at 0.08 — it was always the one honest difference, and it is what makes this
     * material read as INSTANTANEOUS against LiquidLight's trailing 0.3.
     *
     * ⚠️ Safe to change because `MATERIAL_PRESETS` is read by ONE caller — the Lab's material
     * dropdown (`ui/synthesis-lab/tabs/materials.ts`) — and never by the preset-load path. Every
     * preset carries its own full `overlay.material` block, so no shipped preset moves. Grep-verified
     * over all preset sources before editing.
     */
    config: {
      splatRadius: 9.0,
      coreBrightness: 1.9,
      haloStrength: 0.85,
      falloffExponent: 3.2,
      thermalLag: 0.08,
      emissionIntensity: 2.1,
      heatMode: 'velocity',
      heatGain: 0.60,
      blendMode: 'additive',
      colourRamp: 'liquid',
      velocityStretch: 0.25,
    },
    /**
     * PRESENTATION BLOCK, added 2026-09-05. The THIRD carrier, and the first whose template look is
     * **GRADED** rather than bare `Legacy` — which breaks the pattern Fire and Ember share and is the
     * reason three of this header's four sections exist.
     *
     * **Template: `Julia Burn Rivers` (`presets/fire-presets.ts`), chosen by MEASUREMENT over
     * `Anima Electrica`.** Both were offered. Censused all **26** presets carrying
     * `material.preset === 'Plasma'` (`FIRE_PRESETS` + `REFINED_PRESETS` + `DEMO_PRESETS`, collected by
     * importing the modules):
     *
     *                            Julia Burn Rivers      Anima Electrica
     *     buoyancy block         4 of 9 hand-set        ABSENT
     *     sparks block           4 of 11 hand-set       ABSENT
     *     material vs bundle     4 fields differ        2 fields differ
     *     closest named look     Neon, 4 fields         Plasma, 5 fields
     *     renderer.mode          splat (agrees)         star (DISAGREES with overlay.renderMode)
     *     extra overlay identity figureScale, speed     attractor+transMap+curl+physarum+fluid+ribbon
     *     decayFactor            0.84                   0.9
     *
     * `Anima Electrica` wins on material fidelity and look proximity, but **its buoyancy and sparks are
     * ABSENT**, and those are 20 of the ~30 fields a block authors — copying "nothing" is inventing them,
     * not deriving them. `Julia Burn Rivers` is the **only one of the 26** with both blocks hand-set, the
     * same property that decided Ember's template. ⚠️ **Plasma's cap does NOT discriminate here** (0.84 and
     * 0.9 both clear 0.9160), unlike Ember where the breach settled it — only `Breaking Through` (0.9877)
     * breaches. **A test that decided the previous case can be silent on this one; re-derive, do not reuse.**
     *
     * ⚠️ **1. THE BASE LOOK IS `FILM_LOOKS['Plasma']`, NOT `Legacy` — THE FIRST NON-LEGACY CARRIER.**
     * Fire's and Ember's templates author `filmLook: 'Legacy'`, so both blocks differ from
     * `FILM_LOOKS['Legacy']` on exactly two fields, the palette pair. Both Plasma candidates author a
     * *graded* `Customize` (bloom on, ACES on, saturation 1.4), so "Legacy plus a palette" is unavailable
     * and the 18 pass-through values cannot be copied from the earlier blocks. Measured over the 21 fields
     * each template authors: `Anima Electrica` is **5** from `FILM_LOOKS['Plasma']`, `Julia Burn Rivers` is
     * **4** from `Neon` and **11** from `Plasma`. Since a named `Plasma` look exists and the material is
     * *named* Plasma, the block is BASED on `FILM_LOOKS['Plasma']` — **NOT on the template's own cfp**,
     * which is the one place this block deliberately departs from its template. That makes
     * `sliderBaseFilmLook: 'Plasma'` a MEASURED answer rather than a guess: a grading drag rebuilds
     * `customFilmLookParams` wholesale from that bundle, so basing the block on it is what makes the
     * rebuild land where the block started. ⚠️ **Diffed against `FILM_LOOKS`, never against a preset's
     * JSON** — Fire's first defect was sourcing values from the DEPRECATED `postProcessors` block, which
     * the engine does not read, and both templates carry one.
     *
     * ⚠️ **BASED ON IS NOT VERBATIM, AND THE FIRST DRAFT'S "20 VALUES ARE `FILM_LOOKS['Plasma']` VERBATIM"
     * IS NO LONGER TRUE — SIX FIELDS NOW DEPART, SEE SECTION 5.** Two are the palette pair; four
     * (`exposure`, `saturation`, `glow`, the two bloom fields) are the review fix. ⚠️ **A named look is a
     * starting point, not an authority: `FILM_LOOKS['Plasma']` was authored for the non-material splat path
     * and had never met `emissionIntensity: 2.1` on an additive blend, which is a 2.1x multiplier upstream
     * of its `exposure: 2.0`. A block that inherits a bundle inherits its ASSUMPTIONS about input
     * magnitude — check that the bundle's exposure was chosen against this material's own emission.**
     *
     * ⚠️ **2. `palette: 'Neon'` IS DISQUALIFIED, AND 22 OF THE 26 PRESETS AUTHOR IT.** Under
     * `paletteMapping: 'temperature'` heat is the palette's INPUT, so luma must be monotonic or a hotter
     * particle comes out darker. Measured (luma 0..255 over the 256-entry LUT):
     *
     *     palette              dips   y@0    y@0.60   y@1.0
     *     Neon                  128   106     187      106   <- REJECTED: folds back to its own t=0 luma
     *     Classic: neon          99    65     195      237   <- REJECTED
     *     Material: liquid        0     7     122      229   <- chosen
     *     Classic: cyberpunk      0    14      96      241
     *     Classic: galaxy         0     6      94      241
     *
     * This is the same trap that rejected the cosine `Fire` palette (94 dips) for Fire's block. ⚠️ **And
     * `paletteMapping: 'temperature'` is a DEPARTURE here in a way it was not for Fire or Ember: 0 of the
     * 26 Plasma presets use it** (12 `phase`, 11 `velocity`, 2 `position`). It is chosen for the same
     * reason as the other two blocks — it is the only one of the six mappings that reads `vTemperature`,
     * so it is what makes the material's own heat compose with the palette instead of being overwritten.
     *
     * ⚠️ **`'Material: liquid'` RESTATES THIS MATERIAL'S OWN RAMP RATHER THAN REPLACING IT, and that is a
     * USER DECISION taken with the alternative on the table.** Verified by identity:
     * `getPaletteLUT('Material: liquid')` returns the **same `Uint8Array` object** as
     * `getColourRampData('liquid')`, which is `config.colourRamp` — so this is Fire's situation
     * (`'Material: fire'` over ramp `fire`), not Ember's (`'Classic: ember'`, a genuinely different array).
     * `Classic: cyberpunk` and `Classic: galaxy` were offered as the replacing alternatives and
     * **`Material: liquid` was chosen explicitly, to review the visual look first** — do not "upgrade" it
     * to a contrasting palette for variety's sake. Its violet→electric-blue→mint walk
     * (h270 → h195 → h149) is the plasma read the 0.60 window was retuned to produce.
     *
     * ⚠️ **THE REVIEW CONFIRMED THE PALETTE AND THIS DECISION IS NOW TWICE-STATED: the first draft read as a
     * "large pink blob", four replacement palettes were measured (`Cool` scored 0% magenta against
     * `Material: liquid`'s 36%), AND THE PALETTE WAS KEPT — the colours were reviewed as fine and the pink
     * was diagnosed as CLIPPING, fixed on exposure. See section 5's generalisation.** Do not re-propose a
     * palette swap for this material; the measured alternatives are recorded so the option need not be
     * re-derived to be re-rejected.
     *
     * ⚠️ **3. `buoyancy.enabled` IS OVERRIDDEN TO `true` AGAINST THE TEMPLATE'S `false`, AND THE BLOCK IS
     * INCOHERENT WITHOUT IT.** Plasma is on `FIRE_BEHAVIOUR_MATERIALS`, so `setMaterialConfig` assigns
     * `{...DEFAULT_BUOYANCY_CONFIG, enabled: true}` at `main.ts:4292` immediately BEFORE
     * `applyPresentation()` runs — copying the template's `false` would make selecting Plasma turn
     * buoyancy back OFF. Worse, every `setSmokeParams` caller reads
     * `enabled ? (smokeThreshold ?? 0.25) : 0` (`main.ts:928`, `:3094`, `:3275`, `:4296`, `:4332`, `:4390`)
     * and `hdr-particle.ts:3796` runs the 2-pass composite only `if (smokeThreshold > 0)` — so at
     * `enabled: false` the three smoke fields below are fields **the block claims to set and nothing
     * reads**, invariant 25's shape. ⚠️ **A template value is evidence about the TEMPLATE'S composition,
     * not about the material: `Julia Burn Rivers` can afford `false` because it never selected Plasma from
     * the dropdown.** Sparks are the template's own `enabled: true`, unchanged.
     *
     * **4. `smokeThreshold` IS READ AGAINST `heatGain`, NOT ABSOLUTELY — AND IT IS NOW `0`, BY USER
     * DECISION.** Steady-state temperature is `driver * heatGain`, so the smoke-pass fraction is
     * ~`threshold / heatGain` and Plasma's 0.60 is the **lowest ceiling of all nine materials** — it
     * reaches only **53%** of its ramp's luma (121.7 of 228.7), against Ember's 81% and Fire's 100%:
     *
     *     material   threshold / heatGain   smoke-pass fraction
     *     Fire         0.25 / 1.00                25%
     *     Ember        0.30 / 0.70                43%
     *     Plasma       0.25 / 0.60                42%   <- what a copied value would have given
     *     Plasma       0.15 / 0.60                25%   <- the first-draft derivation, REJECTED on review
     *     Plasma       0.00 / 0.60                 0%   <- shipped: no smoke at all
     *
     * The derivation above is kept because it is still the right *method* — but it answers "how much
     * smoke", and the reviewed answer was **none**. An arc discharge has no cold smouldering tail at all,
     * so the whole population belongs on the emissive pass. ⚠️ **At `0` the 2-pass composite does not run:
     * `hdr-particle.ts:3796` gates pass 0 on `if (smokeThreshold > 0)` and `uRenderPass` becomes 2
     * ("render all"), so this is a genuine bypass rather than a threshold nobody reaches.**
     * ⚠️ **`buoyancy.enabled` MUST STAY `true` REGARDLESS** — it drives the buoyancy force itself, and
     * only the threshold turns the smoke split off. `smokeOpacity`/`smokeDissipation` are retained as the
     * values the split WOULD use, since a user raising the threshold on the Materials tab needs them to be
     * something coherent rather than an inherited leftover. ⚠️ **The smoke pass reads the HARDCODED
     * `fire-smoke` ramp and never applies `emissionIntensity` (`hdr-particle.ts:762`), so population routed
     * there was unreachable by every brightness field in this bundle** — which is the mechanical reason
     * turning it off also *helps* complaints 2–4 rather than merely removing an element.
     *
     * ⚠️ **5. THE FIRST DRAFT SHIPPED `FILM_LOOKS['Plasma']`'s GRADING VERBATIM AND IT READ AS "ONE LARGE
     * ALMOST UNIFORM AREA WITH HALO" ON `Cycloid` AND `Cylinder`. FOUR FIELDS MOVED; the palette pair did
     * NOT.** The four complaints were smoke, a pink blob, an oversized halo, and no fine structure. Measured
     * causes, and the metric that names each one:
     *
     * ⚠️ **THE DECIDING METRIC IS *STEP COLLAPSE*, NOT CLIPPING.** Grade one palette colour at rising
     * accumulation and count adjacent density steps whose 8-bit outputs differ by <= 2: that is the fraction
     * of the figure's internal density variation which is **destroyed before it reaches the screen**. It was
     * **65%** as first shipped (71% at accumulation >= 1) — so most of the figure was literally one value,
     * which is what "no finer details" means and why clipping alone (58%) understates it. Now **24%** (34%
     * at high accumulation). ⚠️ **Clipping cannot discriminate here for the same reason it could not for
     * Fire's cap: the accepted look clips too. Measure whether two different densities still map to two
     * different pixels.**
     *
     *     field         was    now    why
     *     exposure      2.0    0.55   the dominant term. 2.0 x emissionIntensity 2.1 saturates almost the
     *                                 whole population; the ladder at ramp t=0.30 was ONE value
     *                                 (rgb 255,0,255) at every accumulation from 0.35 to 4.
     *     saturation    2.0    1.6    pushes an already-clipped channel further apart, adding no
     *                                 information. 1.6 keeps the plasma read without flattening hue.
     *     glow          6.0    3.0    THE HALO ANSWER — see section 6.
     *     bloomIntensity 0.65  0.25   with bloomThreshold 0.25 -> 0.60. Bloom blurs everything above the
     *                                 threshold back over the frame; at quarter-luma that is the whole
     *                                 figure, which is the "merges into one area" complaint DIRECTLY.
     *
     * ⚠️ **`gain`, `gamma`, `lift` AND THE PALETTE PAIR ARE DELIBERATELY UNTOUCHED — the colours were
     * reviewed as FINE and the fix was scoped to structure and headroom on that instruction.** Hue at
     * accumulation 1 walks violet 255 -> 271 -> 290 -> 300 -> blue 251 -> cyan 203 across the 0..0.60
     * window, where it was a flat 300 for five of seven stops. **The magenta was a SYMPTOM of clipping, not
     * a palette defect: the `liquid` ramp's violet half has green literally 0, so any channel that clips
     * there lands on hue 300 — restoring headroom restored the hue for free, and swapping the palette (four
     * candidates were measured, `Cool` scoring 0% magenta) proved UNNECESSARY.** ⚠️ **That is the useful
     * generalisation: a hue complaint on an additive path is an EXPOSURE reading until headroom is
     * restored. Do not re-propose a palette change for this material.**
     *
     * ⚠️ **6. THE HALO WAS THE `glow` FIELD, NOT SPARK SIZE — AND `config` NEEDED NO CHANGE.** The question
     * was asked explicitly. `sparks.splatRadius` is 3 against the particle's 9, so sparks cannot be the
     * dominant area. `glow` INVERTS in the shader (`effFalloff = falloffExponent * (4/glow)`,
     * `hdr-particle.ts:780`), so 6.0 DIVIDED the exponent to 2.13 and widened the kernel. Measured against
     * Fire's browser-confirmed sprite as the reference:
     *
     *     variant              effFalloff   shape@r=0.9   core:mid ratio   energy x radius^2
     *     Fire (confirmed)        3.50         0.284           2.7              209
     *     Plasma glow 6.0         2.13         0.394           2.7              173
     *     Plasma glow 3.0         4.27         0.183           3.3              138   <- shipped
     *
     * ⚠️ **I FIRST MIS-READ THIS AS AN ENERGY EXCESS AND IT IS NOT — with radius^2 included, glow 6.0 was
     * already 0.82x Fire's energy. The defect is the EDGE: 0.394 vs 0.284 means every sprite was a
     * near-flat disc whose rim stayed bright to r=0.9, so neighbours fused. `core:mid` (centre over
     * mid-halo) is what makes a particle read AS a particle; 3.0 raises it 2.7 -> 3.3.** So the fix is one
     * film-look field, and ⚠️ **no `MaterialConfig` field moved: `splatRadius` 9, `haloStrength` 0.85 and
     * `falloffExponent` 3.2 are the accepted 2026-08-21 separation from `LiquidLight` and are not this
     * block's to retune** — a presentation block carries presentation only.
     *
     * ⚠️ **KNOWN AND ACCEPTED: `sliderBaseFilmLook: 'Plasma'` MAKES THE PALETTE LOSS ACTIVELY WRONG RATHER
     * THAN MERELY ABSENT.** `grading()` rebuilds `customFilmLookParams` wholesale from the named bundle on
     * every Mood/Glow/Depth drag (deliberately, for idempotency), and no named bundle carries a material
     * ramp — so a drag here restores `FILM_LOOKS['Plasma'].palette`, which is **`'Neon'`, the 128-dip
     * palette this block exists to avoid**. For Fire and Ember the same drag reverts to Legacy's
     * `'none'`; this is the first carrier where the revert target is a *defect* rather than a blank. The
     * alternative — `sliderBaseFilmLook: 'Legacy'` — is worse, since it would strip the entire grade this
     * block is built on one drag later (exactly Fire's `'Legacy Graded'` defect). **Recorded, not hidden:
     * this is the strongest argument yet for teaching `grading()` to carry the palette, which is a change
     * to the Sliders tab's CONTRACT and is held for a separate decision.**
     *
     * ⚠️ **NO `MaterialConfig` FIELD IS AUTHORED HERE** — the 2026-08-21 retune above (`heatGain` 0.60,
     * `velocityStretch` 0.25) is the accepted separation from `LiquidLight` and a presentation block
     * carries presentation only. `crystals: {enabled: false}` agrees with `materialAutoEnablesCrystals()`
     * and is redundant today; it is stated so the block cannot inherit a previous material's answer.
     */
    presentation: {
      filmLook: 'Customize',
      customFilmLookParams: {
        // SIX fields DEPART from `FILM_LOOKS['Plasma']`. These two are the palette pair — header sections 1
        // and 2. Plasma's own pair is `'Neon'` / `'velocity'`, and `'Neon'` has 128 luma dips.
        palette: 'Material: liquid',
        paletteMapping: 'temperature',
        // The other four departures are the 2026-09-05 review fix (header section 5): `glow`,
        // `bloomThreshold`, `bloomIntensity`, `exposure`, `saturation` — five field names, four of which the
        // table there costs individually. Everything else below is `FILM_LOOKS['Plasma']`'s own value,
        // verified field-by-field against it (NOT against the template's cfp, and NOT against Legacy — this
        // is the first graded carrier). An OMITTED field is INHERITED from the outgoing preset's look rather
        // than defaulted, so all 20 are stated.
        // `glow` is the FILM-LOOK field, not `renderer.glow`, and it INVERTS: `effFalloff =
        // falloffExponent * (4/glow)`, so 3.0 gives 3.2 * 1.333 = 4.27 — a TIGHTER halo than the identity
        // 4.0. This is the halo answer (header section 6), and `config` is deliberately untouched.
        glow: 3.0,
        depthSize: 0.2,
        depthBrightness: 0.0,
        depthDof: 0.0,
        depthColorShift: 0.8,
        lightingMode: 2,
        lightDir: [0, 0, 1],
        rimPower: 1.5,
        bloomEnabled: true,
        bloomThreshold: 0.60,
        bloomIntensity: 0.25,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 0.55,
        lift: [0, 0, 0],
        gamma: [0.8, 0.8, 0.8],
        gain: [1.3, 0.9, 1.4],
        saturation: 1.6,
        vignette: 0.0,
      },
      // NOT 'Legacy' — see header section 1 and the palette-loss note. This block's 20 pass-through
      // values ARE this bundle, so a grading drag rebuilds to where the block started.
      sliderBaseFilmLook: 'Plasma',
      // 0.84, the template's own `renderer.decayFactor`, clearing this material's 1 - 2.1/25 = 0.9160
      // additive cap with margin. Both candidates cleared it, so it discriminated nothing here.
      decayFactor: 0.84,
      crystals: { enabled: false },
      buoyancy: {
        // `enabled: true` OVERRIDES the template's `false` — header section 3. Without it the three
        // smoke fields below are inert. The other five are the template's verbatim.
        enabled: true, strength: 1.2, returnForce: 2.5, turbulence: 0.2, maxOffset: 150,
        curlOctaves: true, smokeThreshold: 0.0, smokeOpacity: 0.30, smokeDissipation: 0.95,
      },
      sparks: {
        // The template's eleven verbatim. `threshold: 0.6` is a VELOCITY threshold
        // (`lissajous.ts`: `velocities[i] > threshold`), unrelated to the 0.60 heat ceiling.
        //
        // ⚠️ **`ejectionSpeed` WAS 0.7 UNTIL 2026-09-17 AND IS A SECOND AUTHORED COPY OF A QUANTITY THE
        // STALE-DELTA FIX RE-BASED** (`lissajous.ts`' `frameMotion`). All three carriers here — Plasma,
        // Fire, Ember — copy their template preset's spark block, so re-fitting `Julia Burn Rivers`,
        // `Lissajous Flame` and `Hopf Fire Ring` and stopping there turned `fieldcheck`'s verbatim clause
        // RED for all three at once. **That is the clause working, not a false alarm: the dropdown applies
        // THIS copy, so a preset fixed alone would revert the moment a user re-picked its material.**
        // All three landed on the 0.1 track FLOOR, which is why they now agree by coincidence rather than
        // by design — do not collapse them into one shared constant on that evidence.
        enabled: true, poolSize: 350, threshold: 0.6, ejectionSpeed: 0.1, gravity: 290, drag: 1.5,
        minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3, maxSparksPerFrame: 5,
      },
    },
  },
  {
    name: 'Fire',
    label: 'Fire',
    /**
     * `velocityStretch` 1.0 -> 0.4, 2026-09-04. ONE field; every other value here is untouched.
     *
     * ⚠️ **THE BUNDLE DISAGREED WITH ITS OWN BROWSER-CONFIRMED DEMO.** `Material Fire`
     * (`presets/demo-presets.ts`) is this material's accepted reference — part of the 2026-08-21 review
     * set, confirmed and CLOSED 2026-08-23 — and it authors `velocityStretch: 0.4`. So the value a user
     * gets from the dropdown was never the value the material was signed off at. Reported as *"Velocity
     * Stretch needs to be trimmed down (is at max by default)"*, and the report is exactly right: the
     * Materials slider is `min 0, max 1` (M2 clamped it from 0-6 because both shader stages compute
     * `blend = clamp(velocityStretch, 0, 1)`), so **1.0 IS the slider maximum** — the one value from
     * which a user cannot discover that the control has an upward direction at all.
     *
     * **Corroborated across the library, not taken from the demo alone.** Of the 8 presets that author
     * material `Fire`, five sit at or below 0.5 (`Material Fire` 0.4, `Lissajous Flame` 0.4, `Hopf Fire
     * Ring` 0.4, `Rising Inferno` 0.3, `Fire and Ice` 0.5) and the only three at 1.0 are pending
     * `'<X> new'` refined entries whose verdicts are unsettled. 0.4 is the attested authored value.
     *
     * ⚠️ **THIS MOVES NO SHIPPED PRESET.** `MATERIAL_PRESETS` is read by ONE caller — the Lab's material
     * dropdown (`ui/synthesis-lab/tabs/materials.ts:196,208`) — and never by the preset-load path; every
     * preset carries its own full `overlay.material` block. Grep-verified over `src/` before editing (the
     * only other hits are two prose references in `refined-presets.ts`). This is the same safety argument
     * the Plasma retune above records, and it is why a bundle default is cheap to correct.
     *
     * ⚠️ **THE DEMO'S OTHER TWO OVERRIDES WERE IMPORTED ON 2026-09-04, REVERSING THIS COMMENT'S OWN
     * EARLIER REFUSAL — and the refusal's stated reason is what changed, not the arithmetic.**
     * `thermalLag` 0.12 -> **0.04** and `emissionIntensity` 1.8 -> **2.0**, taken from `Lissajous Flame`,
     * which the user named as the template for this material. Measured against that template, these were
     * **the only 2 of 11 config fields that differed** — the other nine were already byte-equal, which is
     * the evidence that the material block was never what made that preset read correctly.
     *
     * The refusal argued that raising `emissionIntensity` would TIGHTEN the trail cap
     * (`cap = 1 - emissionIntensity / MAX_MATERIAL_ACCUM_INDEX`, so 0.9280 -> 0.9200) rather than brighten
     * anything. That was correct while a bundle could not author a decay: **the `presentation` block now
     * authors `decayFactor: 0.86`, which is below BOTH caps, so the cap does not engage and the 0.008
     * difference is unreachable.** ⚠️ **A constraint can be discharged by a change somewhere else
     * entirely — re-read a "do not" against the code that exists now, not the code it was written beside.**
     *
     * ⚠️ **`Ember` diverges the OPPOSITE way and is deliberately left alone** — its bundle is 0.8 while
     * its own confirmed demo overrides to 1.0, so there the demo is the outlier, not the bundle. Two
     * divergences, two directions: **do not unify them.** `Organic` is the only other bundle still at
     * slider max (1.0); it is alpha-blended, has no confirmed demo to check against, and is therefore
     * FLAGGED, not changed.
     */
    config: {
      splatRadius: 10.0,
      coreBrightness: 2.0,
      haloStrength: 1.0,
      falloffExponent: 3.5,
      thermalLag: 0.04,
      emissionIntensity: 2.0,
      heatMode: 'velocity',
      heatGain: 1.0,
      blendMode: 'additive',
      colourRamp: 'fire',
      velocityStretch: 0.4,
    },
    /**
     * THE FIRST `presentation` BLOCK. Taken from `Lissajous Flame` (`presets/fire-presets.ts`), which the
     * user named as the template for this material. See `MaterialPresentation` for why the block exists.
     *
     * ⚠️ **`filmLook: 'Customize'` although the template authors `'Legacy'`, and the substitution is the one
     * deliberate departure here.** Legacy is *no grade at all* — which is why the template chose it, its own
     * comment saying the material's tuned brightness then *"read exactly as authored rather than through a
     * grade"* — but Legacy also forces `palette: 'none'`, and a real fire palette is a stated requirement:
     * *"none is not good enough, we need a real fire one"*. `Customize` is the only look that can carry a
     * chosen palette, and `setPalette`/`setPaletteMapping` are their own uniform-and-texture path, entirely
     * independent of the bloom and tone-map flags — so **`Customize` can be Legacy in every respect EXCEPT
     * the palette, and that is exactly what this block is.** ⚠️ **EVERY OTHER FIELD HERE MUST THEREFORE
     * EQUAL `FILM_LOOKS['Legacy']`, AND THE ONLY WAY TO KNOW THAT IS TO DIFF IT AGAINST THAT OBJECT.**
     *
     * ⚠️ **THE FIRST DRAFT FAILED EXACTLY HERE, AND IT FAILED BY TRUSTING THE PRESET'S `postProcessors`
     * BLOCK.** It authored `bloomEnabled: true` / `bloomThreshold: 0.6` / `bloomIntensity: 0.3` /
     * `toneMapEnabled: true` / `toneMapCurve: 'aces'` from `Lissajous Flame`'s `postProcessors`, described
     * in the comment as *"the numbers it authored before its look was switched to Legacy"* — which made
     * **dead data look like provenance**. `postProcessors` **IS DEPRECATED AND NOT READ BY THE ENGINE**
     * (`CLAUDE.md` states this outright); the live grading is `overlay.filmLook` alone. `Legacy` has
     * **bloom OFF at intensity 0 and tone map OFF at curve `none`**, so the block was adding a bloom pass
     * and an ACES compression the template has never applied. Reported by the user as **"too much glow and
     * bloom"** after a `None` → `Fire` round trip, and localised by diffing the re-applied export against
     * `FIRE_PRESETS['Lissajous Flame']`: the `material`, `buoyancy` and `sparks` blocks came back
     * **byte-identical**, and all six differing fields were in `customFilmLookParams`.
     * ⚠️ **`glow` was NOT among them — it was 4.0 in both** — so *"too much glow"* was the bloom, which is
     * why the fix is four flags and not a brightness. **A symptom names a look, not a field.**
     * ⚠️ **The rule the draft broke: NEVER SOURCE A VALUE FROM A BLOCK NOTHING READS. If a preset's live
     * behaviour is the question, diff against the object the engine actually consumes** — here
     * `FILM_LOOKS['Legacy']`, not the preset's own JSON.
     *
     * ⚠️ **`palette: 'Material: fire'` WAS CHOSEN BY MEASUREMENT, AND THE OBVIOUS NAME IS A TRAP.** The
     * cosine palette literally called `Fire` has **NON-MONOTONIC luma** (164 -> 115, dipping to 25 mid-ramp),
     * so under a heat mapping a HOTTER particle would come out DARKER. `'Material: fire'` instead returns
     * `getColourRampData('fire')` — this material's own ramp — and not merely an equal copy: `palettes.ts`'s
     * prefix branch returns THAT ARRAY, so it is the same object and the identity holds by construction
     * rather than by a measurement that could drift. The palette therefore reproduces the ramp exactly and
     * **cannot fight it**, which matters because the shader ASSIGNS the palette over the ramp
     * (`hdr-particle.ts`) rather than blending. All four `getPaletteLUT` consumers only upload/sample it, so
     * the shared reference is safe — ⚠️ **but a consumer that ever WROTE to a LUT would corrupt the ramp for
     * every material at once.** The `'Material: '` prefix is load-bearing; five legacy names collide with
     * cosine names and are unreachable unprefixed.
     *
     * ⚠️ **`paletteMapping: 'temperature'` IS THE FIELD THAT ANSWERS THE ORIGINAL REPORT.** Of the six
     * mappings, `'temperature'` is the ONLY one that reads `vTemperature`, i.e. the material's heat. With
     * `heatMode: 'velocity'` the palette index then equals the ramp's own index. `Cycloid` authored
     * `'phase'`, which indexes by the PRESET's wave colour — so the material's heat reached neither the ramp
     * (assigned over) nor the palette (not its index), and *"changing the material did not change anything"*
     * followed necessarily. **Mapping is what decides whether a palette composes with a material or replaces
     * it.**
     *
     * ⚠️ **`glow: 4.0` AND NOT THE TEMPLATE'S `renderer.glow: 2.0` — THE TWO FIELDS ARE NOT THE SAME
     * QUANTITY, AND COPYING THE WRONG ONE WOULD HAVE HALVED THE HALO.** The splat shader's `uGlow` is
     * uploaded from `HDRParticleRenderer.this.glow` (`hdr-particle.ts`, the `splatUGlow` write), which
     * `setFilmLook` assigns from the **FILM LOOK's** glow — never from `renderer.glow`. So
     * `Lissajous Flame`, whose look is `Legacy`, actually renders its splats at Legacy's pinned **4.0**;
     * its own `renderer.glow: 2.0` reaches only the ribbon and neon paths, which that preset does not use.
     * 4.0 is what reproduces the template. **`effFalloff = falloffExponent * (4/glow)`, so at 4.0 the
     * material's authored `falloffExponent: 3.5` passes through as the IDENTITY** — which is the whole
     * reason Legacy's 4.0 is pinned, and it is why 2.0 would have doubled the exponent to 7.0 and shrunk
     * every halo. ⚠️ **Trace the uniform to its upload before copying a preset field that shares a name
     * with a film-look field** (`velocityStretch` is the same trap in `MaterialConfig`).
     *
     * ⚠️ **`depthSize: 0.0`, NOT the template's `renderer.depthSize: 0.3` — the same two-fields-one-name trap
     * as `glow`, checked because the first one was there.** `this.depthSize` is likewise assigned by
     * `setFilmLook` from the FILM LOOK, and `Legacy`'s value is 0.0, so `Lissajous Flame`'s splats have no
     * depth-size falloff at all despite what its renderer block says. 0.0 reproduces the template; 0.3 would
     * add a depth cue the reference look does not have.
     *
     * `crystals: {enabled: false}` currently AGREES with `materialAutoEnablesCrystals()` and is therefore
     * redundant for Fire; it is stated anyway so the block cannot inherit a previous material's answer.
     * The `buoyancy` and `sparks` blocks are the template's verbatim.
     */
    presentation: {
      filmLook: 'Customize',
      customFilmLookParams: {
        // The only two fields that DEPART from `FILM_LOOKS['Legacy']`, and the entire reason this block
        // cannot simply say `filmLook: 'Legacy'`.
        palette: 'Material: fire',
        paletteMapping: 'temperature',
        // Everything below is `Legacy`'s own value, verified field-by-field against `FILM_LOOKS['Legacy']`.
        // ⚠️ Bloom and tone map are OFF because Legacy has them off — the earlier `true`/`0.3`/`aces` came
        // from the DEPRECATED `postProcessors` block and were the reported "too much glow and bloom".
        glow: 4.0,
        depthSize: 0.0,
        bloomEnabled: false,
        bloomThreshold: 0.8,
        bloomIntensity: 0.0,
        toneMapEnabled: false,
        toneMapCurve: 'none',
        exposure: 1.0,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 1.0,
        vignette: 0.0,
        // ⚠️ THESE SIX ARE `Legacy`'s VALUES TOO, AND OMITTING THEM WAS A SECOND, SEPARATE DEFECT — an
        // INHERITANCE hole rather than a wrong value. `applyFilmLook('Customize')` does not reseed: it sets
        // `look = customFilmLookParams`, which still holds whatever the last NAMED look seeded. So any field
        // this block does not author survives from the outgoing preset's look, and **12 of the 15 named looks
        // differ from Legacy on at least one of these six** (`Void` on five). Simulated: arriving from
        // `Cinematic` kept `depthBrightness 0.6`, from `Void` `rimPower 6` and `lightDir [0,-1,0]`.
        // ⚠️ **It was INVISIBLE in the user's own test, because `Lissajous Flame`'s look IS `Legacy`** — the
        // one starting point where the hole has nothing to leak. **A round trip that returns to its own
        // preset cannot detect inheritance; vary the STARTING state.** A presentation block must therefore
        // author EVERY field of the look it reproduces, not only the fields it means to change.
        depthBrightness: 0.0,
        depthDof: 0.0,
        depthColorShift: 0.0,
        lightingMode: 0,
        lightDir: [0.5, -0.7, 0.3],
        rimPower: 3.0,
      },
      // ⚠️ `'Legacy'`, matching the template, NOT the `'Legacy Graded'` of the first draft. This is the base
      // the Sliders tab rebuilds the grade from, so a graded base would re-introduce on the first Mood/Glow/
      // Depth drag exactly the bloom and ACES that were just removed — i.e. the reported defect would come
      // back one slider move later. ⚠️ **A base film look is not cosmetic metadata: it is what the grade
      // REVERTS TO, so it must match the look being reproduced.** The palette is still lost on such a drag
      // (no named look carries a material ramp) but nothing else now changes.
      sliderBaseFilmLook: 'Legacy',
      decayFactor: 0.86,
      crystals: { enabled: false },
      buoyancy: {
        enabled: true, strength: 2.0, returnForce: 1.5, turbulence: 0.4, maxOffset: 200,
        curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95,
      },
      sparks: {
        enabled: true, poolSize: 200, threshold: 0.5, ejectionSpeed: 0.1, gravity: 150, drag: 3.0,
        minLifetime: 0.2, maxLifetime: 0.8, coolingRate: 3.0, splatRadius: 3, maxSparksPerFrame: 26,
      },
    },
  },
  {
    name: 'Ember',
    label: 'Ember',
    config: {
      splatRadius: 7.0,
      coreBrightness: 2.2,
      haloStrength: 0.6,
      falloffExponent: 5.0,
      thermalLag: 0.45,
      emissionIntensity: 3.4,
      heatMode: 'velocity',
      heatGain: 0.7,
      blendMode: 'additive',
      colourRamp: 'fire',
      velocityStretch: 0.8,
    },
    /**
     * THE SECOND `presentation` BLOCK, structurally identical to `Fire`'s — read that block's comments for
     * why `'Customize'` is required, why every `Legacy` field must be authored, and why
     * `sliderBaseFilmLook` is not metadata. Only what DIFFERS for Ember is argued here.
     *
     * ⚠️ **THE TEMPLATE IS `Material Ember` (`presets/demo-presets.ts`), NOT `Attractor Fire Cloud`, AND THE
     * NAMES ARE THE LEAST RELIABLE PART OF THAT CHOICE.** Both were offered as starting points; measured
     * against `DEFAULT_BUOYANCY_CONFIG` / `DEFAULT_SPARK_CONFIG`, three things separate them:
     *
     *   * **`Attractor Fire Cloud`'s buoyancy and sparks are DEFAULT-SHAPED.** Only `enabled`,
     *     `smokeThreshold` and `poolSize` are hand-set; the other **17 of 20** values are byte-equal to the
     *     defaults — the signature of the material dropdown having re-applied the bundle, which its own
     *     comment says outright. `Material Ember` has **7 of 9** buoyancy and **11 of 11** spark fields
     *     hand-set. **A presentation must be copied from something that was DESIGNED, and "it is named after
     *     the material" is not evidence of that** — the count is.
     *   * **Its `decayFactor: 0.88` BREACHES EMBER'S OWN CAP.** `materialTrailDecayCap()` solves
     *     `1 - emissionIntensity / MAX_MATERIAL_ACCUM_INDEX = 1 - 3.4/25 = 0.8640`, and `Math.min` only
     *     lowers — so 0.88 would be authored and then silently clamped, i.e. a block whose stated value is
     *     not the value that runs. `Material Ember`'s **0.85 is below the cap and passes through untouched.**
     *     ⚠️ **Fire's 0.86 is safe only because Fire's emission is 2.0 (cap 0.92); the same number would
     *     breach Ember's cap. Re-solve the cap per material — never carry a sibling's decay across.**
     *   * **Its `material` block reads as Fire wearing Ember's label:** `thermalLag` 0.047 against this
     *     bundle's 0.45 (Fire is 0.04), `emissionIntensity` 2.0 — exactly Fire's — and `velocityStretch` 0.2,
     *     below even Fire's 0.4. It also carries `attractorIndex` / `attractorBlend` / `figureScale`, which
     *     are the HOST PRESET's identity and excluded by instruction.
     *
     * ⚠️ **THE GRADE CANNOT DIFFERENTIATE EMBER FROM FIRE — BOTH TEMPLATES AUTHOR `Legacy`** — so a
     * mechanically copied block would differ from Fire's in `decayFactor` and the two field blocks alone.
     * The separation is real and measured, and three quarters of it is NOT in this block at all:
     *
     *   * **`heatGain: 0.7` CAPS STEADY-STATE TEMPERATURE AT 0.70** (`heatScale = 1 - coolFactor` makes the
     *     integrator converge to `driver * heatGain`), so Ember occupies only the lower two thirds of
     *     whatever ramp it is given and **never reaches the white-hot top**. Fire spans t 0.25→1.00.
     *   * **`smokeThreshold: 0.30` against Fire's 0.25, into a 0.70 ceiling rather than 1.00**: on a uniform
     *     driver that is **42.9 % of the population in the smoke pass against Fire's 25.0 %**
     *     (`th/heatGain`). Ember is mostly smoke; Fire is mostly flame. This is the sharpest single contrast.
     *   * **Sparks 4 per frame against Fire's 26** — 6.5x rarer, shorter-lived (`maxLifetime` 0.6 vs 0.8) and
     *     faster-cooling (4.0 vs 3.0): occasional pops, not a shower.
     *   * **Buoyancy `strength` 1.2 vs 2.0 and `maxOffset` 140 vs 200** — a lazier, shorter rise.
     *
     * ⚠️ **`palette: 'Classic: ember'` IS A USER DECISION AND IT BREAKS FIRE'S IDENTITY ARGUMENT ON
     * PURPOSE — do not "restore" `'Material: fire'` for consistency.** Fire's palette holds by construction:
     * `palettes.ts`'s `'Material: '` branch returns the SAME `Uint8Array` as `getColourRampData('fire')`, so
     * the palette cannot fight the ramp it is assigned over. `'Classic: ember'` is a different array, so here
     * the palette genuinely REPLACES this bundle's `colourRamp: 'fire'`. That is sound but it is a choice, and
     * it was checked against the one property that makes a palette safe under a heat mapping:
     *
     *     palette                luma monotonic   luma at t=0.30 / 0.70   hue span over Ember's band
     *     Classic: ember         YES, 0 dips           41 / 157               23° → 39°
     *     Material: fire         YES, 0 dips           60 / 203               14° → 44°
     *     Fire (cosine)          NO, 94 dips        — REJECTED: a hotter particle comes out DARKER
     *
     * **Monotonicity is the requirement** (`paletteMapping: 'temperature'` makes heat the palette's INPUT, so
     * a dip inverts the reading) and `Classic: ember` satisfies it. Its cost is deliberate: **peak luma 157
     * against 203, and a narrower hue span** — a darker, more sustained coal read rather than a second flame.
     * ⚠️ **The 0.70 ceiling is what makes this cost real: it is not the palette's top that Ember shows, but
     * its 70 % point.** Judge it on the FINAL 8-bit output, not on the ramp texture.
     *
     * ⚠️ **`paletteMapping: 'temperature'` for the same reason as Fire** — it is the only one of the six
     * mappings that reads `vTemperature`, so it is what makes the material's heat compose with the palette
     * instead of being overwritten by it.
     *
     * ⚠️ **NO `MaterialConfig` FIELD IS AUTHORED HERE, so the known `velocityStretch` divergence is
     * UNTOUCHED** — this bundle is 0.8 while its own confirmed demo overrides to 1.0, the opposite direction
     * from Fire's divergence, and both are a decided keep. A presentation block carries presentation only.
     *
     * ⚠️ **`sparks.threshold: 0.7` IS A VELOCITY THRESHOLD, NOT A TEMPERATURE ONE** — `lissajous.ts` tests
     * `velocities[i] > threshold` — so its numeric coincidence with the 0.70 heat ceiling is exactly that,
     * a coincidence, and there is no interaction. **Two quantities can share a number and share nothing else.**
     *
     * `crystals: {enabled: false}` agrees with `materialAutoEnablesCrystals()` and is redundant today; it is
     * stated so the block cannot inherit a previous material's answer. `buoyancy` and `sparks` are the
     * template's verbatim.
     */
    presentation: {
      filmLook: 'Customize',
      customFilmLookParams: {
        // The only two fields that DEPART from `FILM_LOOKS['Legacy']`, and the entire reason this block
        // cannot simply say `filmLook: 'Legacy'` (Legacy forces `palette: 'none'`).
        palette: 'Classic: ember',
        paletteMapping: 'temperature',
        // Everything below is `Legacy`'s own value, verified field-by-field against `FILM_LOOKS['Legacy']`
        // — the same 18 fields as Fire's block, and for the same two reasons: a wrong value here re-adds a
        // grade the template never had, and an OMITTED field is INHERITED from the outgoing preset's look
        // rather than defaulted. `glow: 4.0` is the film-look field, not `renderer.glow: 2.0`, and it is
        // also the identity for `falloffExponent` (`effFalloff = falloffExponent * (4/glow)`).
        glow: 4.0,
        depthSize: 0.0,
        bloomEnabled: false,
        bloomThreshold: 0.8,
        bloomIntensity: 0.0,
        toneMapEnabled: false,
        toneMapCurve: 'none',
        exposure: 1.0,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 1.0,
        vignette: 0.0,
        depthBrightness: 0.0,
        depthDof: 0.0,
        depthColorShift: 0.0,
        lightingMode: 0,
        lightDir: [0.5, -0.7, 0.3],
        rimPower: 3.0,
      },
      sliderBaseFilmLook: 'Legacy',
      // 0.85, the template's own `renderer.decayFactor`, and BELOW this material's 0.8640 cap — see the
      // block header for why `Attractor Fire Cloud`'s 0.88 would not have survived the derive.
      decayFactor: 0.85,
      crystals: { enabled: false },
      buoyancy: {
        enabled: true, strength: 1.2, returnForce: 2.0, turbulence: 0.5, maxOffset: 140,
        curlOctaves: true, smokeThreshold: 0.30, smokeOpacity: 0.45, smokeDissipation: 0.96,
      },
      sparks: {
        enabled: true, poolSize: 300, threshold: 0.7, ejectionSpeed: 0.1, gravity: 150, drag: 2.0,
        minLifetime: 0.2, maxLifetime: 0.6, coolingRate: 4.0, splatRadius: 2, maxSparksPerFrame: 4,
      },
    },
  },
  {
    /**
     * ⚠️ **RETUNED 2026-08-23 — the defaults must be able to lift this material into interesting
     * territory on their own**, which is the standing direction: *"the defaults used should be able to
     * lift it into interesting territory, otherwise it will never be used"*.
     *
     * ✅ **BROWSER-CONFIRMED AND CLOSED 2026-08-23 — do not re-tune.** The pass covered both demos AND
     * the Lab material dropdown; that third check is the load-bearing one, because a demo confirms a
     * *composition* and only the dropdown reads this table unmodified. `Material Smoke` and
     * `Material Fog` had been carrying private brightness deviations to clear the ramp bottom; the
     * deviation belonged here, and both demos now inherit these values verbatim.
     *
     * **The review complaint was "genuinely dark or boring presets (fog, smoke)", and the cause is
     * STRUCTURAL, not a brightness setting.** The smoke ramp's t=0 is `rgb(10,10,12)` at **alpha 0**,
     * and B15 folds `rampColor.a` into output alpha for an alpha-blend material — so a particle low on
     * the ramp is not merely dark, it is *absent*. The fix is to move the POPULATION up the ramp, never
     * to edit the ramp (it is shared with `Fog`, and `ICE_POINTS`' dark end is a decided keep for the
     * same reason). `heatGain` is the control that does that: steady state is `driver * heatGain`
     * (`heatScale = 1 - coolFactor` makes the geometric series converge to the driver), so it sets
     * which SEGMENT of the ramp the population occupies — the same lever the Plasma/LiquidLight
     * separation used.
     *
     * ⚠️ **`heatGain` does a SECOND thing on this material only, and it is the larger effect.** Smoke
     * is on `FIRE_BEHAVIOUR_MATERIALS`, so selecting it auto-enables buoyancy, which sets
     * `smokeThreshold: 0.25` and switches the splat renderer into its **2-pass composite**. Pass 0
     * (`temp <= threshold`) does not sample `colourRamp` at all — it reads `uSmokeRampTex`, hardcoded to
     * `fire-smoke`, whose t=0 is pure black at alpha 0 — **and it never applies `emissionIntensity`**
     * (`hdr-particle.ts:762`: `smokeAlpha = shape * uSmokeOpacity * coolness`). Measured against the
     * figure's velocity distribution, at the old `heatGain: 0.75` **54% of the population was in pass 0**,
     * i.e. more than half the particles were unreachable by every brightness control this table has.
     * That is why the demo needed a deviation to look like anything, and why raising `coreBrightness`
     * alone could not have fixed it.
     *
     * **`heatGain` 0.75 → 1.15**, chosen against the pinning cost rather than by eye. Measured over the
     * figure's own speed distribution (and against a uniform one as the pessimistic case, since
     * `normalized` is MIN-MAX normalised and therefore figure-dependent):
     *
     *     heatGain   pass-0 frac   temp < 0.20   pinned at 1.0 (measured / uniform)
     *     0.75  old      54.1%        47.5%        0.0%  /  0.0%
     *     1.00             43.9%        32.9%        0.1%  /  0.6%
     *     1.15  now       36.7%        27.1%        4.5%  / 14.2%
     *     1.30  demo      31.2%        22.8%        7.8%  / 24.7%
     *
     * ⚠️ **1.30 — the demo's own value — was REJECTED as a default.** A pinned particle sits at ramp
     * t=1.0 with no contrast against its neighbours, and smoke whose bright end is a flat plateau reads
     * as fog. 7.8% is tolerable on the demo's chosen figure but 24.7% is not on an arbitrary one, and a
     * DEFAULT is applied to whatever the user has loaded. 1.15 keeps pinning under 5% on the measured
     * distribution and moves 17 points of population out of the dark pass — most of the available gain
     * for a third of the pinning risk. **A demo may sit closer to an edge than a default: the demo knows
     * its figure.**
     *
     * `coreBrightness` 0.8 → 1.0 and `emissionIntensity` 1.5 → 1.8 are the smaller half, paying back the
     * per-particle luminance so the lift does not depend on `heatGain` alone. Median effective
     * contribution (`srcLum * outA`, i.e. what survives `SRC_ALPHA` blending) goes **0.088 → 0.302, 3.4x**
     * — matching the demo's own delivered brightness while pinning far less. ⚠️ **`coreBrightness` stops
     * at 1.0, not the demo's 1.15**: it multiplies into `outA` as well as luminance, and above ~1.0 the
     * core saturates alpha (`clamp(shape * rampColor.a)`) for every particle above the ramp's midpoint,
     * which flattens the soft-edged read a 16 px kernel exists for. `haloStrength`, `falloffExponent`,
     * `thermalLag` and `velocityStretch` are UNTOUCHED — the complaint was luminance, not silhouette.
     */
    name: 'Smoke',
    label: 'Smoke',
    config: {
      splatRadius: 16.0,
      coreBrightness: 1.0,
      haloStrength: 1.5,
      falloffExponent: 1.5,
      thermalLag: 0.55,
      emissionIntensity: 1.8,
      heatMode: 'velocity',
      heatGain: 1.15,
      blendMode: 'alpha',
      colourRamp: 'smoke',
      velocityStretch: 0.5,
    },
  },
  {
    /**
     * ⚠️ **RETUNED 2026-08-23, and `heatGain` is deliberately NOT the lever here — read `Smoke` above
     * for the shared reasoning and the ramp-alpha mechanism.** Fog reaches the same "genuinely dark"
     * complaint by a different route, so it takes a different fix.
     *
     * ✅ **BROWSER-CONFIRMED AND CLOSED 2026-08-23 (demo + Lab dropdown) — do not re-tune.**
     *
     * **`heatMode: 'position'` is a STATIC SPATIAL FIELD, and its driver is bottom-weighted by
     * construction:** `(sin(px·0.003)·0.5+0.5) · (cos(py·0.004)·0.5+0.5)` is a PRODUCT of two
     * half-cosines, each with mean 0.5, so the product's mean is **0.25** and its median 0.37 — most of
     * the canvas sits low on the ramp no matter how fast anything moves. ⚠️ **But raising `heatGain`
     * would be the wrong correction**: the field is a fixed function of screen position, so pushing it
     * up saturates the field's PEAKS into a flat plateau while its troughs stay dark, turning a smooth
     * spatial gradient into hard bright patches. The gradient *is* the material — that is what
     * distinguishes Fog from Smoke, and `heatGain` stays at 0.85.
     *
     * ⚠️ **Fog is NOT on `FIRE_BEHAVIOUR_MATERIALS`, so there is no 2-pass composite and no pass-0
     * population** — the whole 54%-unreachable problem that dominates `Smoke` does not exist here.
     * Every particle samples `colourRamp: 'smoke'` and every brightness control reaches all of them, so
     * the fix is simply the per-particle luminance the material was starving itself of.
     *
     * **`emissionIntensity` 0.5 → 1.1 and `coreBrightness` 0.6 → 0.95.** At 0.5, emission was *halving*
     * an already-dim ramp sample — the lowest value in the whole table by a factor of three, and the
     * single largest contributor to the complaint. Measured median effective contribution
     * (`srcLum * outA`): **0.038 → 0.208, 5.5x**, the largest lift of the eight materials, with **zero**
     * pinning risk because the driver's own ceiling is untouched. The q90 core contribution reaches
     * 0.54, i.e. the bright end of the field is now clearly lit while the troughs still fall away.
     *
     * The demo values were `coreBrightness: 0.9` / `emissionIntensity: 1.0`; these go marginally past
     * them because a default has no accompanying `filmLook: 'Luminous'` to help it. `splatRadius: 24`,
     * `haloStrength: 1.8`, `falloffExponent: 1.0` and `thermalLag: 1.0` are UNTOUCHED — a very wide,
     * very soft, very slow kernel is what makes this fog rather than dim smoke.
     */
    name: 'Fog',
    label: 'Fog',
    config: {
      splatRadius: 24.0,
      coreBrightness: 0.95,
      haloStrength: 1.8,
      falloffExponent: 1.0,
      thermalLag: 1.0,
      emissionIntensity: 1.1,
      heatMode: 'position',
      heatGain: 0.85,
      blendMode: 'alpha',
      colourRamp: 'smoke',
      velocityStretch: 0.3,
    },
  },
  {
    /**
     * v8 Phase 8a-3 — reworked. Ice was previously a blue-tinted FLAME: `velocityStretch: 1.0`
     * elongated every splat along its velocity like rising fire, and additive blending plus
     * `emissionIntensity: 2.2` made it emissive like plasma — every visual cue said hot gas.
     *
     * Now: `velocityStretch: 0` (pure circular kernel, no flame taper), alpha blending instead of
     * additive so ice reads as matter that occludes rather than light that sums, a dimmer core and
     * lower emission, a long thermal lag (ice holds its state), and a softer falloff so the splat is
     * a diffuse frost bed. The hard-edged, faceted, occluding look itself comes from the crystal
     * pass, which selecting Ice now auto-enables — see `ICE_CRYSTAL_DEFAULTS`.
     *
     * ⚠️ HISTORICAL: this preset once carried `coolingRate: 0.3` + `heatGain: 0.7`, which SATURATED
     * temperature at a flat 1.00 for every particle, and was hand-rebalanced to escape that. BOTH
     * halves of that story are now obsolete and must not be reasoned from:
     *
     *  - Saturation is impossible by construction since the heat fix (`heatScale = 1 - coolFactor`
     *    in `material.ts`), which makes the steady state exactly `driver * heatGain`.
     *  - `coolingRate` and `dissipation` no longer exist (M4). They collapsed into `thermalLag`, and
     *    that scalar affects only how much temperature LAGS its driver — not the range it covers.
     *
     * The old rule of thumb — pair a cooling change with a `heatGain` change to keep the range both
     * spread and unclipped — is therefore not merely stale but UNFOLLOWABLE, since neither field it
     * named still exists. RANGE is now `heatGain`'s job alone; lag is `thermalLag`'s.
     *
     * That leftover `heatGain: 0.45` capped Ice at temperature 0.37, leaving the top 63 % of the ice
     * ramp unreachable. **Widened to 0.8 by the Batch M recalibration (2026-08-08)**, which was a
     * calibration decision rather than a saturation risk, exactly as this note predicted.
     */
    name: 'Ice',
    label: 'Ice',
    config: {
      splatRadius: 11.0,
      coreBrightness: 1.3,
      haloStrength: 0.5,
      falloffExponent: 3.0,
      thermalLag: 0.7,
      emissionIntensity: 1.7,
      heatMode: 'velocity',
      heatGain: 0.8,
      blendMode: 'alpha',
      colourRamp: 'ice',
      velocityStretch: 0,
    },
  },
  {
    /**
     * ⚠️ HISTORICAL, same as Ice above: this was the second of the two presets that saturated
     * temperature at 1.00, and `heatGain` was cut to 0.4 to escape it. Saturation is now impossible
     * by construction, and `coolingRate`/`dissipation` no longer exist (M4) — so that 0.4 was a
     * leftover, and it is why LiquidLight only reached temperature 0.32: the liquid ramp's
     * purple → teal → green journey was unreachable and the material read as flat purple.
     * **Raised to 0.9 by the Batch M recalibration (2026-08-08)**; the ramp now spans to 0.73.
     */
    name: 'LiquidLight',
    label: 'Liquid Light',
    /**
     * RETUNED 2026-08-21 as the other half of the Plasma separation — see the derivation on `Plasma`
     * above for the measurement and the reason `heatGain` is the lever.
     *
     * This material keeps the ramp's TOP end (teal → green → pale mint) and gets pushed further into
     * it: `heatGain` 0.9 -> 0.92 so the window is 0.13..0.92, while Plasma retreats to 0.09..0.60.
     * The two now overlap only in the deep-violet bottom that every velocity-mode material passes
     * through at its slowest particles.
     *
     * Everything else here moves AWAY from Plasma rather than toward a better absolute look, because
     * "differentiated" was the requirement:
     *
     *     splatRadius       14  -> 18     broad and soft vs. Plasma's tight 9
     *     falloffExponent   2.0 -> 1.6    a wide gradual halo vs. Plasma's 3.2 hard core
     *     coreBrightness    1.6 -> 1.3    no hot pinpoint; the body of the splat carries the colour
     *     velocityStretch   1.0 -> 0.85   stays ELONGATED where Plasma drops to 0.25
     *     thermalLag        0.3           unchanged — the one difference that was always real
     *
     * ⚠️ `falloffExponent` is INVERTED in the shader relative to its name (`effFalloff` divides by
     * the film look's glow), so a LOWER number is a WIDER, softer halo. 1.6 is deliberate, not a typo.
     *
     * ⚠️ **THAT LAST LINE WAS WRONG AND IS CORRECTED HERE: `Lava Flow` IS NOT THE ONLY SHIPPED PRESET ON
     * THIS MATERIAL — THERE ARE 13.** Re-measured 2026-09-05 by importing the four preset modules and
     * filtering on `overlay.material.preset === 'LiquidLight'`: `Material Liquid Light` (`DEMO_PRESETS`),
     * `Lava Flow` (`FLOW_PRESETS`) and **eleven** `REFINED_PRESETS` (`Aurora Borealis`, `Fluid new`,
     * `Fluid Metall new`, `Fluid Metall 2 new`, `Ocean Of Experience new`, `Ripple Spiral new`,
     * `Rippled Rays Of Light new`, `Rippled Rays Of Light 2 new`, `Shades Of Waves new`,
     * `Vivianes Harp new`, `Waves new`). ⚠️ **The retune's safety argument survives the correction —
     * every one of the 13 carries its own full `material` block, so none inherits these fields — but the
     * COUNT it was stated with did not. A grep that answered "is anything affected" was read as if it had
     * answered "how many exist".** All eleven refined entries author `filmLook: 'Customize'` with a
     * 21-field cfp; their palettes are `Cool` x6, `Ocean` x4, `Sunset` x1, and **none** uses
     * `paletteMapping: 'temperature'` (4 `position`, 3 `depth`, 3 `velocity`, 1 `phase`).
     *
     * ⚠️ **`splatRadius` 18 -> 10 AND `haloStrength` 1.0 -> 0.4, 2026-09-05, ON THE USER'S DECISION — THE
     * BUNDLE DISAGREED WITH ITS OWN BROWSER-CONFIRMED DEMO ON THE TWO FIELDS THAT SET SPRITE AREA.** This
     * is Fire's `velocityStretch` trap in the two fields where it costs most. `Material Liquid Light`
     * (`demo-presets.ts`) is this material's confirmed reference from the 2026-08-21 review and authors
     * `splatRadius: 10`, `haloStrength: 0.4`; the bundle's 18 / 1.0 were never confirmed anywhere.
     * Measured against the shipped `Plasma` sprite (`glow 3.0`) as unit:
     *
     *     config              energy x radius^2   x Plasma   core:mid   edge@r=0.9
     *     bundle 18 / 1.0           798             5.80x       1.5        0.562   <- a flat disc
     *     demo   10 / 0.4           117             0.85x       3.9        0.225   <- shipped
     *
     * ⚠️ **`glow` CANNOT FIX THIS AND MEASURING THE LADDER IS WHAT PROVED IT: at radius 18 even `glow` 1.0
     * leaves the sprite 3.48x Plasma, because `glow` reshapes the kernel while `splatRadius` scales AREA —
     * radius^2 dominates every shape term.** Ask which quantity a field owns before reaching for the one
     * that is easier to author. Core:mid (centre over mid-halo) is the blob metric: 1.5 is a uniform disc,
     * and the shipped Plasma sprite is 3.3.
     *
     * ⚠️ **THIS IS A `config` EDIT MADE FROM A PRESENTATION SITTING, WHICH THE OTHER THREE BLOCKS
     * DELIBERATELY REFUSED — it is the user's explicit call, taken with the alternatives measured, NOT a
     * precedent.** The differentiation from Plasma is preserved because it never depended on size:
     * `falloffExponent` 1.6 (a WIDE gradual halo vs Plasma's 3.2 hard core), `velocityStretch` 0.85
     * (elongated vs Plasma's 0.25) and `heatGain` 0.92 (the ramp's bright mint top vs Plasma's 0.60
     * violet) are all untouched. ⚠️ **And `Ember` diverges from its own demo in the OPPOSITE direction on
     * purpose, so this correction is NOT a rule to apply to the next bundle — grade each against its own
     * confirmed reference.**
     */
    config: {
      splatRadius: 10.0,
      coreBrightness: 1.3,
      haloStrength: 0.4,
      falloffExponent: 1.6,
      thermalLag: 0.3,
      emissionIntensity: 1.5,
      heatMode: 'velocity',
      heatGain: 0.92,
      blendMode: 'additive',
      colourRamp: 'liquid',
      velocityStretch: 0.85,
    },
    /**
     * THE FOURTH `presentation` BLOCK (2026-09-05). Template: **`Material Liquid Light`**
     * (`presets/demo-presets.ts`), this material's browser-confirmed reference from the 2026-08-21 review.
     *
     * ⚠️ **THE TEMPLATE CHOICE INVERTS THE RULE THAT PICKED THE OTHER THREE, AND THE INVERSION IS THE
     * POINT.** Fire, Ember and Plasma were each given the candidate that HAND-SET both physics blocks,
     * because a designed look is the oracle and `DEFAULT_*` values are the signature of the dropdown having
     * re-applied the bundle. By that rule the answer here would be `Lava Flow` (`flow-presets.ts`), the only
     * other shipped LiquidLight preset with a designed look — 9 buoyancy + 11 spark fields, `Dramatic`, its
     * own bloom and tone map. **It is the wrong template anyway, and measuring it is what showed why: it
     * overrides EVERY material field it inherits** — `splatRadius` 4.5, `haloStrength` 0, `falloffExponent`
     * 2.5, `heatGain` 1.2, `emissionIntensity` 2.2, `velocityStretch` 0.2. Its grading was therefore designed
     * against a sprite the dropdown does not produce and a heat window the dropdown does not open.
     * ⚠️ **A TEMPLATE MUST BE A PRESET THE BUNDLE'S OWN CONFIG WOULD ACTUALLY DRAW — "it hand-set the most
     * fields" ranks candidates, it does not qualify them.** `Material Liquid Light` carries this material's
     * values verbatim (now byte-verified, since the config above was just corrected TO it), so its confirmed
     * look was confirmed against this sprite.
     *
     * ⚠️ **AND THE MEASUREMENT KILLED MY OWN PROPOSED CORRECTION: I HAD PLANNED `exposure: 1.0` FOR
     * HEADROOM, AND IT WOULD HAVE OVERRIDDEN A BROWSER-CONFIRMED STATE ON A METRIC.** Re-measured over the
     * REAL accumulation run — a repeatedly-hit pixel sums a geometric series, so the range is `1/(1-decay)`,
     * here **16.7**, not the ~3 my first pass used — step collapse (adjacent accumulation steps whose 8-bit
     * outputs differ by <= 2, i.e. figure detail destroyed before the screen):
     *
     *     block                                   step collapse   clipped
     *     shipped Plasma (accepted this sitting)        50 %         89 %
     *     LiquidLight, Legacy Graded verbatim           48 %         61 %   <- this block
     *     LiquidLight on a 4 000-particle figure        52 %         67 %
     *
     * **It is already inside the accepted band on both axes, so nothing is owed.** ⚠️ **AN ACCUMULATION
     * METRIC IS MEANINGLESS WITHOUT THE DECAY THAT SETS ITS RANGE — my narrow range reported 0 % collapse at
     * EVERY exposure from 1.4 to 0.85, i.e. it could not discriminate at all, and a metric that cannot
     * discriminate reads as a clean bill of health rather than as a broken instrument.** The Plasma figures
     * quoted elsewhere from the narrow range (65 % -> 24 %) are the same ratio measured on a shorter ruler;
     * the RATIO stands, the absolute numbers only compare within one range.
     *
     * ⚠️ **THE CONFIG EDIT ABOVE IS ALSO A BRIGHTNESS EDIT, WHICH IS THE SECOND THING I NEARLY GOT WRONG.**
     * `splatRadius` feeds the additive damping term `min(1.5, (40 / (count * radius^2 * 1e-4))^0.25)`
     * (`hdr-particle.ts:888`), so 18 -> 10 RAISES delivered emission by exactly **1.34x** at every particle
     * count. That looks like it demands an exposure cut — until you notice the confirmed demo already runs
     * radius 10 WITH `Legacy Graded`'s own 1.4, so the 1.34x is inside what the browser accepted, not new.
     * **Ask whether a coupled term's effect is already present in the reference before compensating for it.**
     *
     * **How this differentiates from Plasma, which was the stated requirement.** Nothing had to be invented:
     * **11 of the 21** film-look fields already differ (`glow` 4 vs 3, `exposure` 1.4 vs 0.55, `gamma`/`gain`
     * neutral vs graded, `saturation` 1.0 vs 1.6, `lightingMode` 0 vs 2, `rimPower` 3 vs 1.5, `depthSize`
     * 0 vs 0.2, `depthColorShift` 0 vs 0.8, `lightDir`, `bloomIntensity`), on top of the two separations that
     * predate this block — the heat window (**0..0.92** vs 0..0.60 of the SAME `liquid` ramp) and the trail
     * (decay 0.94, index **16.7**, vs 0.84 and 6.2). At mid-run the two read: Plasma violet-to-magenta
     * pinned at h300, LiquidLight walking violet h286 -> h277 -> cyan h181 -> mint h161. ⚠️ **The two share
     * a ramp and a palette and are still 11 fields apart: DIFFERENTIATION IS A PROPERTY OF THE WHOLE BLOCK,
     * so measure the diff before adding a departure to manufacture one.**
     *
     * ⚠️ **`palette: 'Material: liquid'` IS THE SAME `Uint8Array` AS `getColourRampData('liquid')`** (byte-
     * compared), so the palette provably cannot fight the ramp it is assigned over — the Fire property, which
     * Ember deliberately does not have. It has **0 luma dips**, which is what `paletteMapping: 'temperature'`
     * requires; the three palettes the 13 shipped LiquidLight presets actually use have **105 (`Cool`),
     * 104 (`Ocean`) and 91 (`Sunset`)**, so ⚠️ **the library's own most-used choice would make a hotter
     * particle darker under this mapping. A census of what presets use is not evidence of what a mapping
     * needs.**
     *
     * ⚠️ **THE PHYSICS HALF IS `enabled: false` AND THAT IS THE OPPOSITE OF THE OTHER THREE CARRIERS.**
     * `LiquidLight` is NOT on `FIRE_BEHAVIOUR_MATERIALS` (measured, not read off the list — see that
     * constant's note: luminous fluid is not combusting), so `main.ts:4292` force-DISABLES buoyancy and
     * sparks when it is selected. Copying `Lava Flow`'s two hand-set blocks would have fought the engine's
     * own decision — Plasma's row needs `enabled: true` for exactly the mirror-image reason. ⚠️ **AND
     * STATING IT CLOSES A REAL HOLE RATHER THAN RESTATING THE ENGINE: `main.ts:4327` re-applies the defaults
     * only when the auto-fire VERDICT CHANGES, so a swap between two non-fire materials (`Ice` ->
     * `LiquidLight`, both `false`) skips that branch entirely and carries a hand-enabled buoyancy across.**
     * This is the `crystals: {enabled: false}` argument — a bundle that omits it inherits the previous
     * material's answer — reaching a second pair of blocks. Only `enabled` is stated: `applyPresentation`
     * merges over the live config, so the other eighteen fields stay where the user left them, which is what
     * makes this a default SET and not a reset.
     *
     * ⚠️ **`decayFactor: 0.94` SITS EXACTLY ON ITS OWN CAP AND IS THE FIRST BLOCK TO DO SO.**
     * `1 - 1.5/25 = 0.9400`, and `materialTrailDecayCap()` uses `Math.min`, so this is a no-op today — but
     * with **zero margin**: one step of the `emissionIntensity` slider (1.5 -> 1.6) drops the cap to 0.9360
     * and silently shortens the trail with no control naming the cause. **Recorded, not "fixed" by lowering
     * the decay** — 0.94 is the template's own value and §T asserts the block equals it, so a defensive
     * 0.93 would depart from the look this block exists to reproduce in order to guard a case the user
     * reaches only by moving a slider they can also move back.
     */
    presentation: {
      filmLook: 'Customize',
      customFilmLookParams: {
        // The only two DEPARTURES from `FILM_LOOKS['Legacy Graded']`, and the whole reason this cannot say
        // `filmLook: 'Legacy Graded'` — a named look pins `palette: 'none'`, and a real palette is a stated
        // requirement. Verified both directions against the bundle: 2 departures, 0 unauthored fields.
        palette: 'Material: liquid',
        paletteMapping: 'temperature',
        // Everything below is `Legacy Graded`'s OWN value, field-by-field — including `exposure: 1.4` and the
        // bloom pair, which are NOT copied from the template's deprecated `postProcessors` block. See the
        // header: sourcing from a block nothing reads is what shipped Fire's first defect.
        glow: 4.0,
        depthSize: 0.0,
        depthBrightness: 0.0,
        depthDof: 0.0,
        depthColorShift: 0.0,
        lightingMode: 0,
        lightDir: [0.5, -0.7, 0.3],
        rimPower: 3.0,
        bloomEnabled: true,
        bloomThreshold: 0.6,
        bloomIntensity: 0.3,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 1.4,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 1.0,
        vignette: 0.0,
      },
      sliderBaseFilmLook: 'Legacy Graded',
      // The template's own `renderer.decayFactor`, and EXACTLY its cap of 0.9400 — see the header's
      // zero-margin note. This is the first block whose decay is not strictly below its cap.
      decayFactor: 0.94,
      crystals: { enabled: false },
      // ⚠️ OFF, and stated rather than omitted — the header explains both halves (the engine force-disables
      // these for this material, and the non-fire-to-non-fire swap path does not re-decide).
      buoyancy: { enabled: false },
      sparks: { enabled: false },
    },
  },
  {
    name: 'Organic',
    label: 'Organic',
    config: {
      splatRadius: 10.0,
      coreBrightness: 1.3,
      haloStrength: 1.0,
      falloffExponent: 3.0,
      thermalLag: 0.35,
      emissionIntensity: 1.2,
      heatMode: 'age',
      heatGain: 1.0,
      blendMode: 'alpha',
      colourRamp: 'organic',
      velocityStretch: 1.0,
    },
  },
  {
    /**
     * v8 step 15.9 (2026-09-04) — THE NINTH MATERIAL, and the only one that requests a render mode
     * other than `splat`.
     *
     * ⚠️ **THIS IS NOT `LiquidLight`, AND THE DIFFERENCE IS THE RENDER MODE, NOT THE NUMBERS.** Every
     * field below is copied verbatim from the `LiquidLight` donor above; what makes this a different
     * material is that selecting it requests `renderMode: 'liquid'` — the merged iso-surface — where
     * `LiquidLight` requests `splat` and draws separate sprites. Keeping the numbers identical is
     * deliberate: switching between the two is then a controlled comparison of the two PRESENTATIONS
     * of one substance, which is the whole reason both exist. **Do not "differentiate" them by
     * retuning these values** — that was `LiquidLight`-vs-`Plasma`'s problem (see its derivation) and
     * it is not this pair's.
     *
     * **Why the material exists at all.** Measured 2026-09-04 over the 207 TS presets: **five** author
     * `renderMode: 'liquid'` (`Liquid Surface`, `Liquid Field Pool`, `Liquid Cohesion Beads`, `Dye Wake`,
     * `Pigment Sheet`) and **all five carry NO material**; **79** carry a live material and **NONE**
     * of them is liquid. The two subsystems had zero overlap in the shipped library — not because they
     * conflict (since 2026-09-01 the mode owner guarantees a material cannot take `liquid` away) but
     * because nothing in the Materials tab ever suggested the surface existed. The mode lived behind a
     * technical dropdown that also holds `pixel` and `volume`. This entry is the second
     * route in, and it costs no new resolution path: it goes through the ONE owner (invariant 17).
     *
     * ⚠️ **THE FIVE SPLAT-SHAPING FIELDS BELOW ARE INERT UNDER THIS MATERIAL'S OWN MODE.**
     * `splatRadius`, `coreBrightness`, `haloStrength`, `falloffExponent` and `velocityStretch` all
     * shape an individual sprite, and the iso-surface has no sprites — it sums a smooth field and draws
     * one contour. They are carried because `MaterialConfig` requires them, and they are set to the
     * donor's values rather than to neutral ones precisely so that switching `Liquid` → `LiquidLight`
     * changes ONLY the presentation. **This is not invariant 13 (a control that moves nothing): the
     * fields are live the moment the user picks `splat` by hand, which stays legal.** Appendix A.4 of
     * `psss-engine-v2_how_it_works.md` has a row for it, because "the material controls stopped
     * working" is the expected report.
     *
     * ⚠️ **WHAT REACHES THE SCREEN IS THE PHYSICS HALF: `heatMode`, `heatGain`, `thermalLag` — plus
     * buoyancy and sparks, this material being on `FIRE_BEHAVIOUR_MATERIALS` (see the note there for
     * why that is not a contradiction of `LiquidLight`'s exclusion).** A material has two halves and
     * only the shaping half is splat-specific.
     *
     * ⚠️ **AND IT DOES NOT COLOUR THE SURFACE.** The surface's colour is resolved by the liquid
     * section's own `Tint Source`, whose single owner nothing here may write (invariant 17 — the
     * `applyPresetChange`/material-branch defect is exactly this shape). `colourRamp: 'liquid'` reaches
     * the surface only if the user sets `Tint Source = Material Ramp`, or indirectly through
     * `Figure Colour`, which averages the colours the particles already carry. **Selecting this
     * material and seeing no colour change is correct behaviour**, and Appendix A.4 of
     * `psss-engine-v2_how_it_works.md` has a row for it too.
     */
    name: 'Liquid',
    label: 'Liquid',
    config: {
      // ⚠️ INERT under `liquid` mode — carried for the type and for the `splat`-by-hand route. See above.
      splatRadius: 18.0,
      coreBrightness: 1.3,
      haloStrength: 1.0,
      falloffExponent: 1.6,
      // Live: the physics half. Identical to `LiquidLight` BY DESIGN — see the note above.
      thermalLag: 0.3,
      emissionIntensity: 1.5,
      heatMode: 'velocity',
      heatGain: 0.92,
      blendMode: 'additive',
      colourRamp: 'liquid',
      // ⚠️ INERT under `liquid` mode — `MaterialConfig.velocityStretch` IS a live field in general
      // (it is `volumeRender.velocityStretch` that was deleted), so this is a mode limitation, not a
      // dead field. Name trap, per CLAUDE.md's preset-format row.
      velocityStretch: 0.85,
    },
  },
];

/**
 * v8 Phase 8a-3 — crystal params applied when the **Ice** material is selected.
 *
 * Decision D-A: crystals remain an INDEPENDENT toggle usable with any material or with none.
 * Ice merely auto-enables it, by the same convention that selecting Fire auto-enables buoyancy and
 * sparks. `Fire + crystals` therefore stays possible — that is the Fire-Ice duel the `cold` birth
 * rule exists for.
 *
 * A partial patch, not a whole config: everything unmentioned keeps its current value, so a user
 * who has already tuned lifecycle timings does not lose them by switching material.
 */
export const ICE_CRYSTAL_DEFAULTS: Partial<CrystalRenderConfig> = {
  enabled: true,
  birthRule: 'slow',
  crystalRamp: 'ice',
};

/**
 * v8 Phase 8a-3 — materials that must NOT receive the fire behaviour bundle.
 *
 * Selecting any material used to auto-enable buoyancy AND sparks. For a hot material that is the
 * point; for **Ice** it reintroduced through *motion* every cue C3 removed from the *kernel*:
 *
 * - Buoyancy lift is strictly upward and temperature-proportional (`fire-processor.ts`:
 *   `-strength * temp * dtNorm`), so ice rose like hot gas.
 * - Sparks ejected embers off the frost bed.
 * - Buoyancy is also what sets a non-zero `smokeThreshold`, which switches the splat renderer into
 *   its 2-pass smoke/flame composite. Pass 0 colours every particle below the threshold through
 *   `uSmokeRampTex`, and that texture is hardcoded to the `fire-smoke` ramp — dark red-brown around
 *   its middle — so Ice's *coldest* particles were being tinted with fire colours regardless of
 *   `colourRamp: 'ice'`.
 *
 * Ice's hard, faceted, occluding look comes from the crystal pass instead — which selecting Ice
 * auto-enables via `ICE_CRYSTAL_DEFAULTS`.
 *
 * This suppresses the *automatic* enable only. The Buoyancy and Sparks sections keep their own
 * independent Enable checkboxes, so `Ice + buoyancy` stays reachable for anyone who wants it, and
 * `Fire + crystals` (the Fire-Ice duel the `cold` birth rule exists for) is untouched.
 *
 * (The `COLD_MATERIALS` list this note once introduced was deleted once the decision moved to the
 * positive `FIRE_BEHAVIOUR_MATERIALS` list below — Ice is excluded by simply not being on it.)
 */
/**
 * Materials that auto-enable the FIRE behaviour bundle (buoyancy + sparks).
 *
 * ⚠️ This is now an ALLOW-list. It used to be `everything except COLD_MATERIALS`, i.e. a two-way
 * hot/cold split — which quietly assumed every material that is not ice is *combusting*. Three are
 * not:
 *
 * - **`Organic`** — `heatMode: 'age'` on the organic ramp: a growth/decay cycle, not a flame. Sparks
 *   ejecting embers off it read as debris rather than as life.
 * - **`LiquidLight`** — luminous fluid. It glows, but nothing is burning, so upward buoyancy lift and
 *   ejected embers both contradict the "liquid" half of its name.
 * - **`Fog`** — `heatMode: 'position'`, a static spatial field. Its temperature does not even track
 *   motion, so spark spawning (velocity-triggered) fires essentially at random within it.
 *
 * `Smoke` DOES keep the bundle: smoke is what rises off a fire, and its buoyancy is the point.
 *
 * ⚠️ **`Liquid` JOINED THE LIST 2026-09-04 (v8 step 15.9), AND IT DOES NOT CONTRADICT THE
 * `LiquidLight` EXCLUSION ABOVE — the two are different materials and the bundle means something
 * different to each.** The exclusion's argument is about *combustion*: `LiquidLight` draws separate
 * luminous SPRITES, so buoyancy lifts each glowing dot upward and sparks eject embers off it, and both
 * read as fire on something that is not burning. `Liquid` draws ONE MERGED SURFACE, where the same two
 * forces read as liquid physics instead: buoyancy becomes the body rising and welling rather than dots
 * floating, and a spark is a DETACHED DROPLET — a second population the surface can merge back in, or
 * not. **The bundle is not "fire behaviour" here; it is the thing that makes a liquid body move like
 * one**, and it is why the material's character needs no new machinery. Note that the discriminator is
 * the RENDER MODE, not the substance: the same two forces on the same numbers read as embers under
 * `splat` and as drops under `liquid`.
 *
 * ⚠️ **EXTENDED, NEVER RENAMED.** The constant's name is matched by text-pattern checkers, and the
 * name still describes the mechanism (buoyancy + sparks) even though it now over-describes the
 * intent for one member. **Renaming it to something "more accurate" would break the greps and buy
 * nothing** — CLAUDE.md's rule that nine of the twelve checkers are text-pattern greps.
 *
 * As with crystals this remains a convention, not a lock — both sections keep independent Enable
 * checkboxes, so any combination stays reachable by hand. A cold, still `Liquid` is one untick away.
 */
const FIRE_BEHAVIOUR_MATERIALS: readonly MaterialPresetName[] = ['Plasma', 'Fire', 'Ember', 'Smoke', 'Liquid'];

/**
 * True when selecting `name` should auto-enable buoyancy and sparks.
 *
 * Kept as an explicit list rather than `!COLD_MATERIALS.includes(name)` so that adding a material
 * defaults it to NO automatic behaviour. The old negative form did the opposite: a new material
 * silently inherited fire buoyancy and sparks unless someone remembered to exclude it.
 */
export function materialAutoEnablesFireBehaviour(name: MaterialPresetName): boolean {
  return FIRE_BEHAVIOUR_MATERIALS.includes(name);
}

/**
 * Materials that should auto-enable CRYSTALS.
 *
 * Only `Ice` — but the point of naming it is that crystals must now also be turned OFF for every
 * other material, which is what fixes the reported defect.
 *
 * **The bug this closes:** selecting Ice enabled crystals, and NOTHING ever disabled them again.
 * Switching Ice → Organic or Ice → LiquidLight left the faceted, hard-edged, alpha-OCCLUDING crystal
 * pass drawing on top of a soft organic or liquid material, which reads as wrong because those two
 * materials have no mineral vocabulary at all. Buoyancy and sparks never had this problem: they are
 * re-decided on every hot/cold crossing (`materialAutoEnablesFireBehaviour`), so they were correctly
 * given up on the way IN to Ice and taken back on the way out. Crystals had the enable half of that
 * convention and not the disable half.
 *
 * ⚠️ Deliberately still a *convention*, not a lock. The Crystals section keeps its own independent
 * Enable checkbox, so `Fire + crystals` — the Fire/Ice duel the `cold` birth rule exists for — stays
 * reachable by hand. What changes is only what a material SWITCH decides on your behalf.
 */
const CRYSTAL_MATERIALS: readonly MaterialPresetName[] = ['Ice'];

/** True when selecting `name` should auto-enable the crystal pass. */
export function materialAutoEnablesCrystals(name: MaterialPresetName): boolean {
  return CRYSTAL_MATERIALS.includes(name);
}

export function getMaterialPreset(name: MaterialPresetName): MaterialConfig {
  if (name === 'None') return { ...DEFAULT_MATERIAL_CONFIG };
  const def = MATERIAL_PRESETS.find(p => p.name === name);
  if (!def) return { ...DEFAULT_MATERIAL_CONFIG };
  return { preset: name, ...def.config };
}

/**
 * The presentation half of a material bundle, or `null` when that material has none.
 *
 * ⚠️ **DEEP-COPIED, and the arrays are the reason.** `FilmLookParams`'s `lift`, `gamma`, `gain` and `lightDir`
 * are tuple REFERENCES: a shallow spread would hand every caller the same three arrays that live inside the
 * module-level `MATERIAL_PRESETS`, so the first user to drag a Gain slider would edit the bundle itself and
 * every later selection of that material would apply the drifted value. Same class of defect as
 * `dye.fixedColour` in the Mixer (CLAUDE.md's *first reference type* note) — a module constant is not a
 * scratch object.
 *
 * ⚠️ **`null` and not `{}`** so a caller must decide explicitly what "no presentation" means; an empty object
 * would apply silently and read as success.
 */
export function getMaterialPresentation(name: MaterialPresetName): MaterialPresentation | null {
  if (name === 'None') return null;
  const p = MATERIAL_PRESETS.find(m => m.name === name)?.presentation;
  if (!p) return null;
  const out: MaterialPresentation = { ...p };
  if (p.customFilmLookParams) {
    const c = { ...p.customFilmLookParams };
    if (c.lift) c.lift = [...c.lift];
    if (c.gamma) c.gamma = [...c.gamma];
    if (c.gain) c.gain = [...c.gain];
    if (c.lightDir) c.lightDir = [...c.lightDir];
    out.customFilmLookParams = c;
  }
  if (p.crystals) out.crystals = { ...p.crystals };
  if (p.buoyancy) out.buoyancy = { ...p.buoyancy };
  if (p.sparks) out.sparks = { ...p.sparks };
  return out;
}


// ============================================================================================
// THE RENDER-MODE RESOLVER — moved here from `main.ts` by v8 22.1 (2026-09-24)
// ============================================================================================
/*
 * ⚠️ **BOTH FUNCTIONS BELOW ARE VERBATIM THE `main.ts` ORIGINALS, `export` aside.** Their headers are the
 * 2026-09-01 and 15.9 write-ups and are the authority on the RULE; this banner is the authority on the
 * MOVE, and nothing else about them changed. `main.ts` still holds every call site and now imports them.
 *
 * ## Why they live in a pure module now
 *
 * Phase 22's facet predicate (`presets/preset-facets.ts`) has to answer "which mode does this preset's
 * frame actually draw in" — invariant 17's two-sources rule, so it must go through the OWNER. But
 * `checks/facetcheck.mjs` imports that predicate under Node, and **`main.ts` cannot be imported under Node
 * at all: importing it boots the engine.** `coveragecheck.mjs` already carries a hand-written
 * re-implementation for exactly this reason and says so in its own header. A second one would have made
 * THREE copies of the single rule whose single ownership the header below was written to establish — so the
 * rule moved to a module Node can load instead.
 *
 * ⚠️ **This file was the only candidate that is not a new file.** It is already the materials owner, already
 * imported by `main.ts`, and `core/interfaces.ts` imports nothing, so the added `RenderMode` type import
 * closes no cycle. **Do not "tidy" these into a new `render-mode.ts`** — a fourth home for the rule in one
 * month is the drift the rule exists to prevent.
 *
 * ⚠️ **`main.ts` must keep declaring NEITHER of them.** `fieldcheck` asserts their shape HERE and asserts
 * `main.ts` has no local copy, because a re-added local declaration would shadow the import in silence:
 * `tsc` sees a valid function and an unused import, and reports neither.
 */

/**
 * The ONE owner of "does a live material override the requested render mode".
 *
 * ## Why this exists (2026-09-01, user report)
 *
 * Reported as *"export / import / snapshot does not properly work for the liquid related config settings,
 * one observation is that importing an exported preset with liquid mode seems to render fine in preview
 * tile but not in main preview or fullscreen (no liquid mode)"* — and the tile-right/main-wrong asymmetry
 * is the whole diagnosis, not a side observation. **Invariant 17: the same question had THREE readers with
 * THREE different answers, and the checker already policed the one that was right.**
 *
 * - `grid-tile-renderer.ts`'s `modeInt` tests `liquid` FIRST, ahead of the material branch, and
 *   `fieldcheck` §I 3b asserts that order with the reason: a material contributes only a colour ramp to an
 *   iso-surface, which `tintSource: 'material'` reads separately, so folding it the other way makes the
 *   mode invisible on exactly the presets the phase is for.
 * - `applyPresetChange` and `setMaterialConfig` both forced `'splat'` whenever a material was live,
 *   unconditionally, on EVERY apply — i.e. on every import, every history restore and every Sliders /
 *   Randomiser / Mixer re-apply.
 * - `resetOverlays` is revert-only and so agreed with the tile by accident.
 *
 * ⚠️ **Measured on the user's own export files rather than argued from the code**, which is what named the
 * discriminator: of four real liquid exports in `Downloads`, `Lava new` (material `Ember`) and
 * `Cosmos Energy new` (material `Plasma`) resolved `splat` in the main view against `liquid` in the tile,
 * while `Fractal new` and `Liquid Surface` — same `overlay.renderMode: 'liquid'`, no material — resolved
 * `liquid` in BOTH. **A live material is the discriminator; the liquid block itself imports fine.**
 *
 * ⚠️ **The reason it reads as "the settings did not import" rather than as "the mode reverted" is a third
 * consequence: `visual-fx.ts` gates the whole Liquid Surface section on `getRenderMode() === 'liquid'`, so
 * the eleven controls VANISH along with the mode.** Nothing on screen contradicts the conclusion that the
 * import dropped the block — and the block is sitting in `currentLiquid`, correctly merged, unread.
 *
 * The rule, stated once so a fourth site cannot invent a fifth answer: a material overrides every mode
 * EXCEPT `liquid`. Returns the mode that should actually be active.
 *
 * ⚠️ **EXTENDED 2026-09-04 (v8 step 15.9) AND THE EXEMPTION ABOVE IS UNTOUCHED.** A material no longer
 * always means `splat` — it means *the mode that material REQUESTS*, which is `splat` for eight of the
 * nine and `liquid` for the new `Liquid` material. The `liquid` exemption is still tested FIRST and is
 * still absolute, so **for the eight pre-existing materials this function is byte-identical**: they all
 * request `splat`, which is the literal that used to be written here. See
 * `materialRequestedRenderMode()` below for why the mapping is a named function rather than an inline
 * `? :`, and for why the REVERT cannot be derived from it.
 *
 * ⚠️ **`material` is typed by the NAMED `MaterialConfig`, never by an inline `{ preset: string }` — and that
 * is a CHECKER constraint, not a style preference.** `fieldcheck`'s `braceBody(src, decl)` takes the first
 * `{` after the declaration, so an inline object type in the signature hands it the ANNOTATION's brace
 * instead of the body's: the section scoped to 18 characters, matched nothing, and reported PASS-shaped
 * emptiness. That is v8 15.5's finding (d) reproduced on the very next function written — the only reason it
 * surfaced is that the assertion reports the matched body's LENGTH.
 */
export function resolveModeAgainstMaterial(
  requested: RenderMode,
  material: MaterialConfig | null | undefined,
): RenderMode {
  const materialLive = !!material && material.preset !== 'None';
  if (!materialLive) return requested;
  // ⚠️ The `liquid` exemption stays FIRST and unchanged — see the header. A material cannot take
  // `liquid` away, whichever mode that material would otherwise request.
  if (requested === 'liquid') return 'liquid';
  return materialRequestedRenderMode(material) ?? requested;
}

/**
 * v8 step 15.9 (2026-09-04) — **which render mode a live material ASKS FOR.** The second half of the
 * one owner above; `null` means "no live material, so no opinion".
 *
 * ## Why this is a separate function and not an inline test
 *
 * Before 15.9 the rule had no need for the concept: every material wanted `splat`, so
 * `resolveModeAgainstMaterial` could write the literal. `Liquid` wants `liquid`, and the moment two
 * answers exist the mapping is a *thing* with a name — which is what stops a second site from
 * hand-writing `preset === 'Liquid' ? 'liquid' : 'splat'` and drifting. **CLAUDE.md's render-modes rule
 * applies with full force here: `src/` has ZERO `switch` on a render mode, so every consumer is an
 * `if`-chain that falls through to `star`; the defence is one owner, not exhaustiveness.**
 *
 * ⚠️ **BYTE-IDENTICAL FOR THE EIGHT PRE-EXISTING MATERIALS.** Each returns `'splat'`, which is the
 * literal the caller used to write, so the only behavioural change in the whole engine is that
 * `Liquid` returns `'liquid'`. That is the property to preserve if this is ever refactored: a ninth
 * material must not change what the other eight do.
 *
 * ⚠️ **AND IT IS NOT THE INVERSE OF THE REVERT.** Reverting when a material is CLEARED cannot be
 * derived from this function, and the reason is a defect that would otherwise re-open the 2026-09-01
 * fix: the three revert sites test `currentRenderMode === 'splat'` because **splat with no material
 * draws nothing** (CLAUDE.md's particle-size row), whereas **`liquid` with no material is a shipped,
 * authored look — five library presets are exactly that.** So `liquid` must NOT be added to those
 * tests. Only the ONE site that can see *which* material is going away (`setMaterialConfig`'s
 * clear branch, which holds `prevPreset`) reverts out of `liquid`, and only when the departing
 * material is `Liquid` itself. **Asking "is the mode one a material auto-switched into" is the wrong
 * question; "did the material that requested this mode just leave" is the right one.**
 */
export function materialRequestedRenderMode(material: MaterialConfig | null | undefined): RenderMode | null {
  if (!material || material.preset === 'None') return null;
  return material.preset === 'Liquid' ? 'liquid' : 'splat';
}
