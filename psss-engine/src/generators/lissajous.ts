import type { Generator, GeneratorState, GeneratorConfig, CanvasSize,  AttractorParams, WaveConfig,
  ChannelDriver, FigureType, LSystemConfig } from '../core/interfaces.ts';
import {
  LSYSTEM_RULE_BY_KEY, LSYSTEM_DEFAULT_RULE, DESCEND_MIN, DESCEND_MAX, type RuleKey,
} from './lsystem/rules.ts';
import { createFigureCache, resolveFigure } from './lsystem/figure.ts';
import { LSYSTEM_GENERATORS } from './lsystem/generator.ts';
import { resolveCustomRule, CUSTOM_RANGES, type ResolvedCurveRule } from './lsystem/custom.ts';
import { LSYSTEM_DESIGN_FRACTION } from './lsystem/curve.ts';
import { resolveSym3d, type Sym3dConfig, type Sym3dOperator } from '../core/symmetry-groups.ts';
import {
  createAttractorState, initAttractorState, iterateAttractor, type AttractorState, type AttractorTierOpts,
} from './attractors.ts';
import {
  AttractorStrand, STRAND_CAPABLE, STRAND_SPAN_MIN, STRAND_SPAN_MAX, STRAND_SPAN_DEFAULT,
  STRAND_ADVANCE_MIN, STRAND_ADVANCE_MAX, STRAND_ADVANCE_DEFAULT, type AttractorLayout, type StrandFrame,
} from './attractor-strand.ts';
import type { CurlNoiseConfig, PhysarumConfig, MaterialConfig, BuoyancyConfig, SparkConfig, CrystalRenderConfig, CohesionConfig, LiquidFieldConfig } from '../presets/types.ts';
import { CrystalPool } from '../crystal/crystal-pool.ts';
import { curlNoise3DInto } from '../core/curl-noise.ts';
import { CULL_SENTINEL } from '../core/projection.ts';
import { hasEscapeField } from './attractors.ts';
import { ROT_MAX_DPS } from '../core/rotation-track.ts';
// v8 Phase 30 — the deformation clamps. Shared with the Visual FX descriptors rather than typed twice;
// see the file header for why a range min is cosmetic and a clamp is not.
import {
  TWIST_MAX_TURNS, TWIST_SNAP, BOX_FOLD_MAX_ITERATIONS, BOX_FOLD_DEFAULT_LIMIT, BOX_FOLD_MIN_LIMIT,
  BOX_FOLD_MIN_SCALE, BOX_FOLD_MAX_SCALE,
  CHANNEL_MAX, CHANNEL_SIZE_FLOOR, CHANNEL_LOG_SPAN,
  W_SCALE_MAX, W_VIEW_DISTANCE, W_MIN_DEN_FRACTION,
  W_WINDING_MAX,
  TAPER_MIN_FACTOR, TAPER_MAX, TAPER_SNAP, BEND_MARGIN, BEND_MAX_RATE, BEND_SNAP,
  DEFORM_DET_FLOOR, DEFORM_ENERGY_SPAN,
  INVERT_MIN_R_FRACTION, INVERT_RADIUS_MIN, INVERT_RADIUS_MAX,
  SHARPNESS_MAX, TRAVEL_MAX, TRAVEL_SNAP,
  // v8 `34.2`/`34.3`/`34.4` — Offset, Grow, the four breathing depths and the one shared rate bound.
  OFFSET_MAX, OFFSET_SNAP, GROW_FLOOR, GROW_MAX,
  SHARPNESS_DEPTH_MAX, SHARPNESS_DEPTH_SNAP, TRAVEL_DEPTH_MAX, TRAVEL_DEPTH_SNAP,
  OFFSET_DEPTH_MAX, OFFSET_DEPTH_SNAP, GROW_DEPTH_MAX, GROW_DEPTH_SNAP,
  OP_RATE_MIN, OP_RATE_MAX,
} from '../core/deform-limits.ts';
import {
  FRACTAL_FOLD_MAX_ITERATIONS, FRACTAL_FOLD_MIN_LIMIT, FRACTAL_FOLD_MAX_LIMIT, FRACTAL_FOLD_DEFAULT_LIMIT,
  FRACTAL_FOLD_MAX_SCALE, FRACTAL_FOLD_DEFAULT_SCALE, FRACTAL_FOLD_SCALE_SNAP, FRACTAL_FOLD_LIMIT_DEPTH_MAX,
  FRACTAL_FOLD_SCALE_DEPTH_MAX, FRACTAL_FOLD_LIMIT_DEPTH_SNAP, FRACTAL_FOLD_SCALE_DEPTH_SNAP,
  fractalFoldPoint, fractalFoldGrowth, fractalFoldUnit, fractalFoldLimit,
} from '../core/fractal-fold.ts';

/**
 * v8 `34.1` — **the wave law lives in `core/wave-law.ts` and this file is one of its two callers.**
 *
 * ⚠️⚠️ **DO NOT RE-INLINE EITHER FUNCTION HERE.** The other caller is `ui/synthesis-lab/score-canvas.ts`,
 * which draws the Score an author reads *while authoring*; Phase 33 added `Sharpness` and `Travel` to this
 * file and to nothing else, so the diagram described a figure the engine does not render until `34.1`
 * extracted the shared owner. `composercheck` §R now asserts the two agree, and part of that clause is
 * source-shaped: it checks that **this file holds no triangle arithmetic and no second sine blend of its
 * own.** `INV_TAU` moved with them — it is `wave-law.ts`'s constant now.
 */
import { sumWaveAxesBulk, applyTravel, applyGrow, applyOffset } from '../core/wave-law.ts';
import type { PhysarumProcessor } from './physarum.ts';
import { MaterialProcessor } from './material.ts';
import { FireProcessor } from './fire-processor.ts';
import { SparkPool } from './spark-pool.ts';
import { CohesionField } from './cohesion-field.ts';
import { LiquidPool } from './liquid-pool.ts';
import { DEFAULT_COHESION_CONFIG, DEFAULT_LIQUID_FIELD_CONFIG } from './material-presets.ts';
import type { IndexPaletteSource } from '../renderers/palette-selection.ts';

const MAX_WAVES = 3;
const AXES = 3;
const DEG = 180 / Math.PI;

/**
 * v8 15.4 — the particle count above which cohesion is skipped, with a one-shot `console.warn`.
 *
 * ⚠️ **This sits deliberately ABOVE the UI's own `MAX_PARTICLE_COUNT` of 50 000, so nothing reachable today
 * trips it.** That is a measured conclusion, not an oversight: see `cohesionAllowed()` for the timings
 * (3.939 ms at 50 000) and for what the ceiling would have had to be under the mechanism the spec named
 * (~4 000, which is below every liquid preset in the library). The constant exists because the step requires
 * an explicit ceiling rather than a silent one, and because the count ceiling itself is authorable state that
 * a later step could raise.
 */
const COHESION_MAX_PARTICLES = 60000;

/**
 * Half-extent of a fully-blended attractor, as a FRACTION OF THE PRESET'S OWN DESIGN BOX.
 *
 * The attractor is normalised to [-1, 1] before it reaches the blend site, so this fraction is the single
 * number deciding how big a blend-1.0 attractor is — one value for all ten types, replacing the old
 * ten-branch per-type table of screen-space divisors.
 *
 * **0.45 rather than 0.5 so the figure clears the frame edge under rotation:** at blend 1.0 the attractor
 * is centred on the origin and the 3D rotation swings its corners out by up to √2, so a fit that exactly
 * filled the design box would clip on the diagonal. Measured across every design box and canvas aspect in
 * the library, this lands the attractor at **0.90 of the half-frame** on the governing axis.
 *
 * ⚠️ **A FRACTION of `min(designW, designH)`, not an absolute model-unit constant — and that distinction
 * is the whole of the 2026-08-13 over-correction (V7b).** A model-unit extent is only meaningful relative
 * to the design box it lives in, because `project()` multiplies by `waveScale = uniformFit(designW,
 * designH)`. An absolute 45 is right for the 177 legacy presets (100×100, so `waveScale` 7.68 ⇒ 346 px at
 * 1024×768) and 6.8× too small for a 960×720 preset, whose `waveScale` is 1.067 ⇒ 48 px. Scaling the
 * design box instead makes the projected size identical for every preset by construction.
 *
 * It is therefore in the same units as the wave amplitudes, which is what makes a PARTIAL blend
 * meaningful — at blend 0.5 the attractor and the wave figure are comparable rather than one dwarfing the
 * other. Measured against the real library: the median XY half-extent over all 177 presets is **exactly
 * 45 units in a 100×100 box**, i.e. 0.45 of it, so a blend-1.0 attractor is the size of a median figure.
 */
const ATTRACTOR_DESIGN_FRACTION = 0.45;

interface LegacyWaveAxis {
  phase: number;
  am: { base: number; amp: number; freq: number };
  fm: { base: number; amp: number; freq: number };
}

/**
 * v8 16.0 — the preset→internal wave mapping, extracted from `init()` so `setWaves()` cannot become a
 * SECOND copy of it.
 *
 * ⚠️ **THE SPELLING IS THE TRAP, AND IT FAILS SILENTLY.** `AxisWave` (the preset type) spells the
 * modulators `amplitude`/`frequency`; `LegacyWaveAxis` (what `update()` reads) spells them `amp`/`freq`.
 * A hand-written setter in the preset spelling type-checks against nothing — the target fields are plain
 * `number`s — assigns `undefined`, and `?? 0`s the whole figure to a black frame. Extracting the loop is
 * invariant 17's remedy applied before the fact: one owner, so there is nothing to drift.
 *
 * ⚠️ **THE PAD TO `MAX_WAVES` IS AN INTERNAL DETAIL AND MUST NEVER BE WRITTEN BACK TO A PRESET.** The
 * padding exists only because `update()` loops `t < MAX_WAVES` unconditionally; it says nothing about what
 * the preset contains. A caller that read this table back into `preset.generators.waves` would give every
 * short preset three slots. Step 16.1's `composercheck` owns that assertion — §B, tested against
 * SYNTHESISED one- and two-slot presets.
 *
 * ⚠️ **AND THE REASON IT NEEDS SYNTHETIC DATA IS A MEASUREMENT THAT CORRECTED MY OWN FIRST DRAFT OF THIS
 * COMMENT.** I wrote here that "47 presets author one live wave and 61 author two, so a reader-back would
 * normalise 108 presets" — but `{47, 61, 69}` is the **LIVE-wave** histogram, and `waves.length` itself is
 * **3 for all 399 collected presets** (the legacy JSON authors three and every TS group authors three).
 * A live wave and an authored slot are two different quantities: a slot is silent when
 * `am.base + am.amplitude === 0`, and a silent slot is still a slot. So the pad is currently unobservable on
 * real data, which makes it a defect waiting for the first hand-authored short preset rather than a defect
 * with 108 present-day victims. **Do not restore the stronger claim** — and note the shape, since it is the
 * same one `composercheck` §B is built around: an assertion that can only pass is not an assertion.
 */
function buildWaveTable(unifiedWaves: readonly WaveConfig[]): LegacyWaveAxis[][] {
  const table: LegacyWaveAxis[][] = [];
  for (let w = 0; w < MAX_WAVES; w++) {
    const waveConfig = unifiedWaves[w];
    const axisArr: LegacyWaveAxis[] = [];
    for (let a = 0; a < AXES; a++) {
      if (waveConfig) {
        const ax = waveConfig.axes[a]!;
        axisArr.push({
          phase: ax.phase,
          am: { base: ax.am.base ?? 0, amp: ax.am.amplitude ?? 0, freq: ax.am.frequency ?? 0 },
          fm: { base: ax.fm.base ?? 0, amp: ax.fm.amplitude ?? 0, freq: ax.fm.frequency ?? 0 },
        });
      } else {
        axisArr.push({ phase: 0, am: { base: 0, amp: 0, freq: 0 }, fm: { base: 0, amp: 0, freq: 0 } });
      }
    }
    table.push(axisArr);
  }
  return table;
}

/** The curl stage's one 3-slot result buffer (see the curl block in `update()`). */
const CURL_SCRATCH = new Float64Array(3);

/**
 * v8 Phase 37 follow-up — the PREVIEW TILE's attractor tier: a cheaper warm-up and escape grid, and an optional
 * prewarmed starting state from the tiles' shared cache (copied, never shared). Absent = the main view.
 */
export interface AttractorTileTier extends AttractorTierOpts {
  gridSize?: number;
  prewarmed?: AttractorState;
}

/** v8 Phase 37 — the strand settings `setAttractorStrand` takes and `getAttractorStrand` reads back. */
export interface AttractorStrandSettings {
  layout: AttractorLayout;
  span: number;
  spanDepth: number;
  spanRate: number;
  advance: number;
  advanceDepth: number;
  advanceRate: number;
}

export class LissajousGenerator implements Generator {
  readonly id = 'lissajous';

  private particleCount = 0;
  private positions: Float32Array = new Float32Array(0);
  private prevPositions: Float32Array = new Float32Array(0);
  private colors: Float32Array = new Float32Array(0);
  private depths: Float32Array = new Float32Array(0);
  private velocities: Float32Array = new Float32Array(0);
  private velocityDirs: Float32Array = new Float32Array(0);
  /**
   * This frame's per-particle screen motion in PIXELS, stride 2, captured at the ONE point in `update()`
   * where it still exists — v8 (2026-09-17).
   *
   * ⚠️ **THIS ARRAY EXISTS BECAUSE `prevPositions` IS OVERWRITTEN MID-FRAME AND THE SPARK SPAWN RAN AFTER
   * THE OVERWRITE**, so `px - prevPositions[idx]` — the ejection velocity every spark is born with — read
   * the difference between a position and ITSELF. Every spark was born at rest, `ejectionSpeed` multiplied
   * zero, and the only thing that ever moved one was gravity. The reported symptom was *"sparks appear but
   * are not ejected, and the ejection speed slider does nothing"*, three consequences of one stale read.
   *
   * ⚠️ **AND IT WAS INVISIBLE FOR 14 PRESETS BECAUSE 11 OF THEM RUN BUOYANCY OR COHESION**, both of which
   * write `positions` *between* the overwrite and the spawn — so those eleven read a nonzero difference,
   * namely the buoyancy offset alone, and fire sparks flew upward for a reason nobody had authored. Only
   * the three without either (`Inside Athlon`, `Julia Burn Rivers`, `Hopf Fire Ring`) showed the defect,
   * and none of them is a preset anyone watches for its embers. **A defect that hides behind an unrelated
   * feature being on is not rare — it is unobserved.**
   *
   * ⚠️ **It is filled from the SAME difference `velocities` is computed from, and that is the point rather
   * than a convenience.** `velocities[i] > threshold` is the spawn GATE and this is the spawn VELOCITY: two
   * readers of one quantity, which invariant 17 requires to resolve it identically. Capturing the delta
   * here rather than moving `prevPositions.set()` below the spawn is deliberate — moving that line would
   * silently re-base `velocities` itself on the next frame (it would then subtract a POST-buoyancy position
   * from a PRE-buoyancy one), and `velocities` feeds palette mapping 2, the spark gate and velocity stretch.
   * **Fixing the ejection may not cost the three of them their basis.**
   *
   * ⚠️ **THE FIX RE-BASED EVERY AUTHORED `ejectionSpeed` IN THE LIBRARY, AND ALL FOURTEEN WERE RE-FITTED IN
   * THE SAME SITTING** (2026-09-17, owner-requested). The number a preset stores is a MULTIPLIER on this
   * array, so correcting the array changed what every one of them means: measured over the particles that
   * actually pass the spawn gate, the median base went from 0–26 px/frame to 0.8–110, i.e. **×0.2 to ×53,
   * and not monotonically** — so no global constant could have absorbed it and each preset needed its own
   * value. The rule used, stated so a later reader can disagree with it deliberately: **birth speed ≈ 2 ×
   * the preset's own terminal fall speed (`gravity / drag`)**, so the spray reads as a spray and gravity
   * then bends it; where `gravity` is 0 (`Eternal Fire`, `Boiling Milk`) the pre-fix birth speed was
   * preserved instead, that being the only signal an accepted picture leaves behind.
   *
   * ⚠️ **AND THAT PASS FOUND A TRACK DEFECT IT COULD NOT FIX: `ejectionSpeed` IS `min 0.1, max 3, step 0.1`
   * (`tabs/materials.ts`) AND SIX OF THE FOURTEEN TARGETS FALL OUTSIDE IT.** Five want less than 0.1
   * (`Eternal Fire` 0.007, `Lissajous Flame` 0.035, `Hopf Fire Ring` 0.045, `Lava Flow` 0.056,
   * `Attractor Fire Cloud` 0.088) and two want more than 3 (`Material Ember` and `Protuberance`, both 6.3).
   * The range spans 30× while the required range spans ~900×, because the base is now the PARTICLE'S OWN
   * speed and that varies 140× across the library — whereas the buoyancy offset it used to be varied far
   * less. **Read the clustering of authored values at 0.1 as the track's floor, never as a taste** (see the
   * *Slider tracks* rule: reachability and resolution are separate properties, and a linear 0.1-step track
   * has 100 % resolution at its own bottom stop). Widening it is a real change with a real shape — the log
   * tracks in `trackcheck` §H exist for exactly this — and it was NOT made here.
   */
  private frameMotion: Float32Array = new Float32Array(0);
  private velRefEMA = 0;

  private waves: LegacyWaveAxis[][] = [];
  /*
   * v8 `36.10` — **the figure-source seam's whole state.** `figureType` selects which source fills the
   * `[wave]` block's positions; everything after the fill is untouched.
   *
   * ⚠️⚠️ **THE SEAM IS A BRANCH INSIDE `update()`, NOT A SECOND `Generator` IMPLEMENTATION (`36.D5`),
   * and that is `31.D1`'s measured ground rather than a preference:** `main.ts:845` is
   * `const generator = new LissajousGenerator();` — hardwired, constructed once, never replaced —
   * **seven adoption sites depend on that**, and Phase 30's twist/box-fold/bias state survives `init()`
   * precisely *because* the object is not rebuilt. A swappable `generator` invalidates that property.
   *
   * ⚠️ **COST, STATED: the class gets longer, not shorter.** The new code lives in
   * `generators/lsystem/*` so its SIZE does not land here, but the seam itself does.
   *
   * ⚠️ **`init()` resets `pos`, which is the breathing clock (`36.D6`) — so a type switch restarts the
   * animation phase.** Stated rather than fixed: a second clock would be a second source of truth for
   * the same quantity.
   */
  private figureType: FigureType = 'lissajous';
  private lsystem: LSystemConfig | null = null;
  private lsysCache = createFigureCache();
  /** Resolved curve, `particleCount` xyz triples in [-1,1]. A FIELD: invariant 8 is about RATE. */
  private lsysPoints = new Float64Array(0);
  private pos = 0;
  private waveSpeed = 0.05;

  private colorBase = [128, 128, 128];
  private colorAmp = [128, 128, 128];
  private colorFreq = [0.1, 0.1, 0.1];
  private colorShift = [0.1, 0.1, 0.1];
  /**
   * v8 Step 21.4a — the `index` palette mapping's source, or `null` when no palette supplies one.
   *
   * ⚠️ **NOT part of `GeneratorConfig` and deliberately not reset by `init()`.** It is a *rendering
   * selection* resolved from `overlay` + the film look by `resolvePaletteSelection()`, the way `renderMode`
   * is — not a figure parameter. Putting it in the config would give it a second authoring site inside every
   * preset body, which is invariant 17's shape for a value that already has two sources.
   *
   * `null` is the normal state and means "the colour law reads `colorBase`/`colorAmp`", which is the code
   * path that has always run. That is why a preset on one of the five unnamed pairs renders **bit-identically**
   * under `index`: there is nothing to substitute.
   */
  private indexPalette: IndexPaletteSource | null = null;
  /** v8 26.4 — turns; applied ONLY when `indexPalette` is non-null. */
  private indexHueShift = 0;
  /**
   * v8 CPU pass — the colour law's per-particle sine/cosine table (`writeAllColours`), keyed by the count and the three
   * colour frequencies; and the wave buffer the bulk wave sum writes into. Both are scratch, sized up, never shrunk.
   */
  private colourTab: Float64Array = new Float64Array(0);
  private colourTabKey = '';
  private waveBuf: Float64Array = new Float64Array(0);
  /** v8 CPU pass (B) — the curve's last resolved inputs, so an unchanged curve is not rebuilt (see the call site). */
  private lsysLastKey = '';
  private lsysLastGen: unknown = null;

  private canvasWidth = 800;
  private canvasHeight = 600;

  // 3D rotation state
  private angle = [0, 0, 0];
  private rotationSpeed = [0, 0, 0];
  private perspectiveZ = -700;

  // Curl noise state
  private curlConfig: CurlNoiseConfig = { enabled: false, turbulence: 0, scale: 1.0, evolutionSpeed: 0.5 };
  private curlTime = 0;

  // --- figure scaling (2026-08-06) ------------------------------------------------------------
  //
  // Wave amplitudes are kept in AUTHORED units and scaled at projection time, replacing the previous
  // in-place mutation on every resize. `waveScale` is the uniform canvas fit; `viewScale` is the user's
  // Figure Scale slider. Keeping them separate means a resize recomputes only the former and the user's
  // framing survives it.
  private designW = 100;
  private designH = 100;
  private waveScale = 1;
  private viewScale = 1;

  // --- E30 dihedral symmetry (2026-08-14) -----------------------------------------------------
  //
  // A model-space point-group fold applied to XY immediately before the rotation. `symmetryFold` is
  // the ORDER of the rotational symmetry, and 1 means OFF — the fold is skipped entirely, which is
  // what keeps all 177 legacy presets byte-identical until someone enables it.
  private symmetryFold = 1;
  private symmetryMirror = true;
  /** v8 Phase 42 — the resolved 3-D Symmetry operator, or null (OFF: the stage does not run). */
  private sym3d: Sym3dOperator | null = null;

  // --- v8 30.1 (E129a) Barr twist, turns per half-extent of the design box, per axis -----------------
  //
  // All zeros means OFF and the operator loop is skipped entirely, which is what keeps every preset
  // authored before 30.1 bit-identical. Applied UPSTREAM of the fold above (30.D9) — see the site.
  private twist: [number, number, number] = [0, 0, 0];

  /*
   * v8 `32.1`/`32.2` (`E129b`) — Barr taper and bend, per axis, TRIPLETS by `32.D4`.
   *
   * ⚠️ **ALL SIX ZERO MEANS OFF AND THE LOOP IS SKIPPED ENTIRELY**, which is what keeps every preset
   * authored before this phase bit-identical. Applied between the twist and the box-fold — see the site.
   */
  private taper: [number, number, number] = [0, 0, 0];
  private bend: [number, number, number] = [0, 0, 0];

  /*
   * v8 `33.2` — **`Sharpness`: how far the wave basis is moved from `sin` toward a triangle wave.**
   *
   * ⚠️⚠️ **THIS IS NOT A DEFORMATION AND IT IS NOT APPLIED AT THE OPERATOR SITE.** Every other member of
   * this group (twist, taper, bend, box-fold, inversion, 4D) is a map applied to a position AFTER the wave
   * sum. This one changes the FUNCTION THE SUM IS MADE OF, so it lives inside the evaluation loop and
   * there is nothing downstream for it to compose with. `facetcheck` §B records the distinction.
   *
   * ⚠️ **0 IS A HARD BRANCH, NOT A LERP WEIGHT, and that is required rather than tidy.** `33.D2` makes this
   * reachable on all 294 presets, so the identity must be **bit-identical** and not merely equal: with a
   * lerp, `x + 0*tri` is `x` for every finite `x` EXCEPT `-0`, where it silently becomes `+0`. One bit, on
   * every preset in the library. So the loop picks its basis once per frame and never blends at 0.
   */
  /*
   * ⚠️⚠️ **v8 `34.4`: THREE LEVELS, NOT ONE NUMBER, AND LEVELS ARE NOT AXES.** `34.D11` makes `Sharpness`
   * the one operator whose extra numbers are per wave LEVEL — Body / Structure / Detail, i.e. slots 0/1/2 —
   * so a per-axis split has nothing to apply to. **The two new levels are backfilled from the shipped
   * global `overlay.sharpness` at the ADOPT site (`?? sharpness`, never `?? 0`)**, because six shipped
   * presets carry that key as a value meaning *all three levels*: with `?? 0` they would silently facet one
   * level of three, and three of the six are the owner's finetuned star exports. **The generator never sees
   * an absent key, which is why the backfill is not here.**
   */
  private sharpnessLevels: [number, number, number] = [0, 0, 0];

  /*
   * v8 `34.4` — **`Temper`: ONE depth and ONE rate for all three levels**, matching the specification's own
   * defence of that asymmetry (*"all three levels breathe on one cycle"*). Resolved per FRAME, not per
   * particle, into the three-element table the wave law reads.
   */
  private sharpnessDepth = 0;
  private sharpnessRate = 0;

  /*
   * v8 `33.3` — **`Travel`: a secular (linear) term per axis, a fraction of the design half-extent across
   * the whole population.**
   *
   * ⚠️ **ALL THREE ZERO MEANS OFF**, which is what keeps every preset authored before this phase
   * bit-identical. ⚠️ **It is the one figure term with NO auto-fit behind it** — `waveScale` is fixed from
   * the design box and nothing measures the curve's extent — so `TRAVEL_MAX` is the only bound. See its
   * header in `core/deform-limits.ts`.
   *
   * v8 `34.4` — **`Stretch` is its depth and rate, PER AXIS (`34.D11`)**, which is what lets two axes
   * breathe in antiphase at one rate and is the whole of what the per-axis reversal bought.
   */
  private travel: [number, number, number] = [0, 0, 0];
  private travelDepth: [number, number, number] = [0, 0, 0];
  private travelRate: [number, number, number] = [0, 0, 0];

  /*
   * v8 `34.2` — **`Offset`: the DC translation term**, in design half-extents, plus `Sway`, its breathing.
   *
   * ⚠️ **The engine rotates about the model ORIGIN, so every figure in the library spins in place; this is
   * the term that turns that spin into an ORBIT.** The translation itself is exact — the operator's entire
   * value is in the motion, which is also why `34.D13` keeps it out of the Randomiser.
   *
   * ⚠️ **Nothing auto-fits it, and on Z it composes with `travel` toward the perspective divide**
   * (`34.D9`): the readout under the `Offset` row is the only guard, deliberately a readout rather than a
   * clamp, and it is CANVAS-dependent (invariant 27) so it must be recomputed on resize and never cached.
   */
  private offset: [number, number, number] = [0, 0, 0];
  private offsetDepth: [number, number, number] = [0, 0, 0];
  private offsetRate: [number, number, number] = [0, 0, 0];

  /*
   * v8 `34.3` — **`Grow`: the along-curve amplitude ramp coefficient**, plus `Flare`, its breathing.
   *
   * ⚠️⚠️ **`0` IS THE IDENTITY, NOT `1`** — see `GROW_FLOOR` in `core/deform-limits.ts`. The stroke's
   * amplitude runs `am · (1 + k·τ)`, so at 0 the multiplier is exactly 1 for every particle.
   *
   * ⚠️ **The stage runs on the WAVE SUM ALONE, upstream of travel and offset** (`applyGrow`'s header owns
   * the reason): downstream it would ramp the translation too, which is a different operator.
   */
  private grow: [number, number, number] = [0, 0, 0];
  private growDepth: [number, number, number] = [0, 0, 0];
  private growRate: [number, number, number] = [0, 0, 0];

  /*
   * v8 `34.2`/`34.D9` — **the figure's live model-space Z extent, measured in the position loop.**
   *
   * ⚠️⚠️ **NOTHING IN THIS ENGINE MEASURED THIS BEFORE, which is why `34.D9` could choose a readout over a
   * clamp but could not have it for free.** Two compares per particle in the one loop that already writes
   * `positions`, published through `getZExtent()`; the UI compares it against `getPerspectiveCullDepth()`,
   * which is the model z at which `project()`'s `q` reaches 0.
   *
   * ⚠️ **It is FRAME STATE and must die with the data (invariant 3), not grow-only scratch (invariant 7):**
   * `init()` resets it, so a re-init cannot leave the previous figure's numbers standing under the new
   * one's readout. The inverted sentinel is what makes "no frame yet" distinguishable from "a flat figure".
   */
  private zMin = Infinity;
  private zMax = -Infinity;

  /*
   * v8 `33.5` — **the per-particle smooth escape count, published so a channel can read it.**
   *
   * ⚠️⚠️ **THE VALUE WAS ALREADY BEING COMPUTED EVERY FRAME AND THROWN AWAY.** `advanceEscapeFlow` ends
   * each particle's update with `s.z[i] = esc / grid.maxIter` and the normaliser overwrites it with 0 four
   * lines later. This array is the one plumbing change that turns a discarded scalar into an output
   * channel — the project's own discriminator says that is the high-value class.
   *
   * ⚠️ **Populated ONLY by `julia`/`mandelbrot` (`hasEscapeField`), so the driver must degrade.** It takes
   * the full `depths` treatment — allocate at `init`, `grow()` with its siblings, fill per frame, publish
   * on the tail copy, **null at `dispose` (invariant 1)** — because a half-sized array read by a live
   * driver is invariant 6's defect in a new costume.
   */
  private escapes: Float32Array = new Float32Array(0);
  /** v8 `33.4` — which foliation the escape flow follows. Inert for 9 of the 11 attractor types. */
  private escapeFlow: 'contour' | 'ray' = 'contour';

  /*
   * v8 `32.3` — the composed determinant, per particle, for the energy compensation.
   *
   * ⚠️⚠️ **IT IS FOLDED INTO `writeChannels`' SIZE OUTPUT RATHER THAN PUBLISHED AS A SECOND BUFFER, and
   * that is invariant 6 avoidance as much as tidiness.** Two passes sharing a VAO must both upload every
   * per-instance buffer at the correct size; a new one is a real hazard for no gain, and `writeChannels`
   * is already **the one owner of the per-particle size multiplier**. A second compensation path would be
   * a second owner of one quantity.
   *
   * ⚠️ **`deformEnergyLive` must die with the data (invariant 3)** — a stale `true` over last frame's
   * values would scale every particle by a deformation no longer applied.
   */
  private deformEnergy: Float32Array = new Float32Array(0);
  private deformEnergyLive = false;

  /*
   * v8 `32.7` (`E133`) — the 3D spherical inversion. `invertAmount` 0 is a bit-exact no-op and is the
   * stage's gate; see the site for why it ships and why the shell is NOT a safety control.
   */
  private invertAmount = 0;
  private invertRadius = 1;

  // --- v8 30.2 (E130) box-fold -----------------------------------------------------------------------
  //
  // ITERATIONS IS THE GATE: 0 skips the operator entirely and is bit-exact for every preset authored
  // before 30.2. `boxFoldLimit` is a FRACTION of the design half-extent, never model units, so the cell
  // means the same thing whatever design box a preset declares. XY ONLY -- z is not folded, measured
  // (30.10, 30.D19); see the operator site.
  private boxFoldIterations = 0;
  private boxFoldLimit = BOX_FOLD_DEFAULT_LIMIT;
  private boxFoldScale = 1;

  // --- v8 Phase 38 the Fractal Fold ------------------------------------------------------------------
  //
  // ITERATIONS IS THE GATE (`38.D5`): 0 skips the operator entirely and is bit-exact for every preset authored
  // before Phase 38; `scale === 0` is a SECOND exact identity with its own branch. The cell and the scale
  // breathe (`38.D4`); the iteration count does not, because there is no figure between one fold and two.
  private fractalFoldIterations = 0;
  private fractalFoldLimit = FRACTAL_FOLD_DEFAULT_LIMIT;
  private fractalFoldScale = FRACTAL_FOLD_DEFAULT_SCALE;
  private fractalFoldLimitDepth = 0;
  private fractalFoldLimitRate = 0;
  private fractalFoldScaleDepth = 0;
  private fractalFoldScaleRate = 0;
  /** One point's scratch for `fractalFoldPoint` — a field, not a fresh array per particle (invariant 8). */
  private readonly ffScratch: number[] = [0, 0, 0];


  /*
   * --- v8 31.2 (E112/E113/E137) per-particle appearance ---------------------------------------------
   *
   * ⚠️ **ONE DRIVER FOR ALL THREE CHANNELS** (`31.D4`), and that is what separates this from noise: the
   * same particles end up large, bright and opaque together, so the eye reads one ordered quantity
   * rather than three unrelated speckles. **`age` is deliberately NOT a driver** — age is a GLOBAL clock
   * in this engine, not a per-element one, which is the study's own explicit exclusion.
   */
  private channelDriver: ChannelDriver = 'index';
  private channelSize = 0;
  private channelAlpha = 0;
  private channelLight = 0;
  /** Grow-only scratch for the packed `[sizeMul, alphaMul, lightMul]` triples. See `writeChannels`. */
  private channelScratch: Float32Array = new Float32Array(0);

  /*
   * --- v8 31.4 (E132) the 4D rotation -------------------------------------------------------------
   *
   * ⚠️ **ONLY THE THREE PLANES THAT INVOLVE `w` ARE HERE, AND THE ABSENCE OF `xy`/`xz`/`yz` IS THE
   * DESIGN**: those three ARE the existing 3D `Rotation` control, and a second copy of it would be two
   * controls for one quantity. The three below are the rotations that have no 3D equivalent at all.
   */
  private wScale = 0;
  private wAngleXW = 0;
  private wAngleYW = 0;
  private wAngleZW = 0;
  /*
   * v8 `31.4` — **3 rather than 1 as the shipped default, and the reason is the measurement that forced
   * this control to exist.** At winding 1 the fourth coordinate is one smooth oscillation and the figure
   * reads much as the original monotone ramp did; the crossings that distinguish a 4D rotation from a 3D
   * one need the coordinate to reverse several times along the curve. `W_WINDING_MAX` carries the
   * derivation. The stage is gated on `wScale`, so no preset can be moved by this default.
   */
  private wWinding = 3;

  // Physarum steering
  private physarumRef: PhysarumProcessor | null = null;
  private physarumConfig: PhysarumConfig | null = null;
  // Persistent per-particle offset accumulated across frames — survives wave recomputation
  private physarumOffsetX: Float32Array = new Float32Array(0);
  private physarumOffsetY: Float32Array = new Float32Array(0);

  // v8 Phase 8b.2 — cluster force field. Persistent per-particle offsets (same pattern as physarum
  // and RD) plus de-interleaved scratch for the hash query. All allocated LAZILY by
  // ensureClusterScratch(): the feature is off by default, and a preset that never enables it must
  // not pay 5 x particleCount floats.
  private clusterForceX: Float32Array = new Float32Array(0);
  private clusterForceY: Float32Array = new Float32Array(0);
  private clusterScratchX: Float32Array = new Float32Array(0);
  private clusterScratchY: Float32Array = new Float32Array(0);
  private clusterScratchZ: Float32Array = new Float32Array(0);

  // v8 Phase 8a-3 — Faceted Crystal, ADDITIVE.
  //
  // Phase 8a/8a-2 froze WAVE particles in place: `frozen[i] = 1` took particle `i` out of the wave
  // evaluation, so every crystal was a particle SUBTRACTED from the figure and the figure grew
  // holes and frozen arc gaps. That was rejected. Freezing is now BIRTH: `CrystalPool` owns its own
  // slots and its active state is CONCATENATED after the wave particles (and after the sparks) by
  // getState(). NO wave particle is ever frozen, dimmed or otherwise modified — nucleation only
  // READS `modelPos` and `velocityDirs`, so the whole wave-particle frozen surface is gone.
  private crystalPool = new CrystalPool();
  private crystalConfig: CrystalRenderConfig | null = null;

  // Snapshot of the final model-space positions of the current frame, taken immediately before
  // the rotation loop overwrites `positions` with screen coordinates. It is the birth source for a
  // crystal: the pool holds MODEL-space positions so a crystal rotates with the figure and receives
  // correct perspective scaling and a real depth.
  private modelPos: Float32Array = new Float32Array(0);
  // False until the first update() has filled `modelPos`. Nucleating before that would place every
  // crystal at the model origin.
  private modelPosReady = false;

  // Material processing
  private materialProcessor = new MaterialProcessor();
  private materialConfig: MaterialConfig | null = null;

  // Fire buoyancy
  private fireProcessor: FireProcessor | null = null;
  private buoyancyConfig: BuoyancyConfig = { enabled: false, strength: 1.5, returnForce: 2.0, turbulence: 0.3, maxOffset: 200, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 };

  // Cohesion (v8 15.4). Lazily constructed, like the crystal/spark subsystems: `strength: 0` is the shipped
  // default on all 360 presets, so the common case allocates nothing.
  private cohesionField: CohesionField | null = null;
  private cohesionConfig: CohesionConfig = { ...DEFAULT_COHESION_CONFIG };
  // One-shot latch for the ceiling warning — see `cohesionAllowed()`.
  private cohesionSkipWarned = false;

  /**
   * Liquid field pool (v8 15.5). Lazily constructed for the same reason as cohesion — `enabled: false` is the
   * shipped default on all 360 presets — but with a stronger consequence: this is the ONLY subsystem that
   * changes `state.count`, so with the pool absent every published array keeps exactly its 15.4 length and the
   * whole four-block partition below collapses to the three-block one it replaced.
   *
   * ⚠️ **`liquidFieldSample` is set once per frame by `main.ts` and is NOT owned here.** It is a closure over
   * `FluidAdvectionProcessor.sampleVelocity`, and it is `null` whenever no field is running — which leaves the
   * pool standing still rather than drifting from a stale readback. The generator cannot construct it itself:
   * the fluid processor is a post-processor and lives on the other side of the frame loop.
   */
  private liquidPool: LiquidPool | null = null;
  private liquidFieldConfig: LiquidFieldConfig = { ...DEFAULT_LIQUID_FIELD_CONFIG };
  private liquidFieldSample: ((u: number, v: number, channel: number) => number) | null = null;

  // Spark pool
  private sparkPool: SparkPool | null = null;
  private sparkConfig: SparkConfig = { enabled: false, poolSize: 500, threshold: 0.6, ejectionSpeed: 1.2, gravity: 200, drag: 1.5, minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3.0, maxSparksPerFrame: 5 };

  // Attractor blending
  private attractorParams: AttractorParams | null = null;
  private attractorState: AttractorState | null = null;
  private attractorX: Float32Array = new Float32Array(0);
  private attractorY: Float32Array = new Float32Array(0);
  private attractorZ: Float32Array = new Float32Array(0);
  private attractorBlend = 0; // 0 = pure waves, 1 = pure attractor
  /*
   * v8 Phase 37 — the attractor LAYOUT and the strand's six scalars (`overlay.attractor*`), handed over by
   * `setAttractorStrand`. ⚠️ **The strand itself is built LAZILY in `update()`** and dropped (set to null) by every
   * path that replaces the attractor — `init`, `setAttractor` — so a strand can never outlive the attractor it was
   * walked on (invariant 3: a flag must die with its resource). A count change re-fills it in place instead.
   */
  private strandLayout: AttractorLayout = 'cloud';
  private strandSpan = STRAND_SPAN_DEFAULT;
  private strandSpanDepth = 0;
  private strandSpanRate = 0;
  private strandAdvance = STRAND_ADVANCE_DEFAULT;
  private strandAdvanceDepth = 0;
  private strandAdvanceRate = 0;
  private strand: AttractorStrand | null = null;
  /*
   * v8 Phase 37 follow-up — the attractor TIER, set by `setAttractor`'s second argument. ⚠️ **`null` is the main
   * view: every call below passes `undefined` for it, which is today's exact path.** A preview tile passes a cheaper
   * warm-up budget and escape-grid size, plus an optional PREWARMED starting state from the tiles' shared cache.
   */
  private attractorTier: AttractorTileTier | null = null;
  private readonly strandFrame: StrandFrame = { span: STRAND_SPAN_DEFAULT, advance: STRAND_ADVANCE_DEFAULT, spanTop: STRAND_SPAN_DEFAULT };
  private readonly strandBase: StrandFrame = { span: STRAND_SPAN_DEFAULT, advance: STRAND_ADVANCE_DEFAULT, spanTop: STRAND_SPAN_DEFAULT };

  init(config: GeneratorConfig, canvasSize: CanvasSize): void {
    this.particleCount = config.particleCount;
    this.canvasWidth = canvasSize.width;
    this.canvasHeight = canvasSize.height;

    this.positions = new Float32Array(this.particleCount * AXES);
    this.prevPositions = new Float32Array(this.particleCount * AXES);
    this.colors = new Float32Array(this.particleCount * AXES);
    this.depths = new Float32Array(this.particleCount);
    this.velocities = new Float32Array(this.particleCount);
    this.escapes = new Float32Array(this.particleCount);   // v8 33.5 — sized with its siblings
    // `32.3` — sized with its siblings. ⚠️ Filled with the IDENTITY, not zero: zero would be a
    // deformation that shrinks every particle to nothing on the first frame after a re-init.
    this.deformEnergy = new Float32Array(this.particleCount).fill(1);
    this.deformEnergyLive = false;
    this.velocityDirs = new Float32Array(this.particleCount * 2);
    this.frameMotion = new Float32Array(this.particleCount * 2);
    this.physarumOffsetX = new Float32Array(this.particleCount);
    this.physarumOffsetY = new Float32Array(this.particleCount);
    this.modelPos = new Float32Array(this.particleCount * AXES);
    this.modelPosReady = false;

    this.materialProcessor.init(this.particleCount);
    // The crystal pool sizes itself lazily on the first ENABLED update(), so a build with crystal
    // off never allocates a slot (pixel-identical-when-off invariant). Its CONTENTS are transient
    // history, so a re-init must drop them.
    this.crystalPool.reset();
    this.fireProcessor = new FireProcessor(this.particleCount);
    this.sparkPool = new SparkPool(this.sparkConfig.poolSize);

    this.pos = 0;
    // Initial orientation from the preset. Load-bearing for presets with a fully
    // zero axis: Scanner has no Y wave at all, so without its Angle[0]=90 the Z
    // extent is never rotated into view and it renders as a flat line forever.
    const initAngle = config.angle;
    this.angle = initAngle ? [initAngle[0] ?? 0, initAngle[1] ?? 0, initAngle[2] ?? 0] : [0, 0, 0];
    this.waveSpeed = config.waveSpeed ?? 0.05;
    this.rotationSpeed = config.rotation ?? [0, 0, 0];
    this.perspectiveZ = -(this.canvasWidth + this.canvasHeight) / 2;
    /*
     * v8 `34.2` — ⚠️ **the Z extent is FRAME STATE and must die with the data (invariant 3).** Without this
     * reset a re-init would leave the previous figure's depth standing under the new figure's readout, and
     * the readout's whole job is to say *this* figure reaches NN % of the camera depth.
     */
    this.zMin = Infinity;
    this.zMax = -Infinity;

    // Convert unified wave format to legacy internal format
    this.waves = buildWaveTable(config.waves ?? []);
    /*
     * v8 `36.10` — the figure source, adopted here beside the wave table.
     *
     * ⚠️ **`config.type` ARRIVES ALREADY RESOLVED** (`resolveFigureType` at both call sites), so this is
     * an adoption and not a second resolution. A second one here would be invariant 17's two-sources
     * defect: *two readers must resolve them in the same order AND nothing may write the resolved value
     * afterwards.*
     * ⚠️ **The dormant block is adopted too** — `setLSystem(null)` only when the preset truly has none,
     * which is what makes `36.2`'s non-destructive switching work without a re-init.
     */
    this.figureType = config.type;
    this.lsystem = config.lsystem ?? null;

    // Fit the authored amplitudes to this canvas. The amplitudes themselves are NOT modified — the
    // factor is applied at projection time, so it can be recomputed on resize without accumulating.
    const designRes = config.designResolution;
    this.designW = designRes?.width ?? 100;
    this.designH = designRes?.height ?? 100;
    this.waveScale = this.uniformFit(this.designW, this.designH);

    // Color config
    this.colorBase = config.colorBase ?? [128, 128, 128];
    this.colorAmp = config.colorAmp ?? [128, 128, 128];
    this.colorFreq = config.colorFreq ?? [0.1, 0.1, 0.1];
    this.colorShift = config.colorShift ?? [0.1, 0.1, 0.1];

    // Attractor
    if (config.attractor) {
      this.attractorParams = config.attractor;
      this.attractorBlend = config.attractor.blend;
      this.attractorState = createAttractorState(this.particleCount);
      initAttractorState(this.attractorState, config.attractor);
      this.attractorX = new Float32Array(this.particleCount);
      this.attractorY = new Float32Array(this.particleCount);
      this.attractorZ = new Float32Array(this.particleCount);
    } else {
      this.attractorParams = null;
      this.attractorState = null;
      this.attractorBlend = 0;
    }
    this.strand = null;   // v8 Phase 37 — rebuilt lazily against the new attractor and population
  }

  resize(newWidth: number, newHeight: number): void {
    if (this.canvasWidth === newWidth && this.canvasHeight === newHeight) return;

    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;
    this.perspectiveZ = -(newWidth + newHeight) / 2;

    // Recomputed from the DESIGN resolution, not chained from the previous canvas size. So resizing is
    // idempotent and lossless — the old code rescaled the stored amplitudes by `new/old` each time,
    // leaving no way back to the authored values (defect G16).
    this.waveScale = this.uniformFit(this.designW, this.designH);

    // v8 15.4: cohesion's offsets are deliberately NOT reset here, unlike `liquid-reference.ts`'s density EMA.
    // The distinction is what the stale value COSTS. That EMA feeds a divisor, so a stale one is a visible
    // exposure step; these are bounded displacements (capped at 4·radius) that the spring pulls back within
    // ~1/returnForce seconds, and clearing them would snap every drop home at once — a resize artefact where
    // there is currently a brief settle. The grid itself rebuilds on the next `update()`, since `ensure()`
    // keys on the cell count and this changes it.
    //
    // v8 15.5: the liquid pool needs no call here either, but for a THIRD reason again — it RESEEDS rather
    // than carries. `LiquidPool.ensure()` compares the frame size it was last seeded at against the one it is
    // handed, so the next `update()` re-places every particle in the new frame by itself. That is correct and
    // not merely cheap: the pool's homes are absolute pixels within a specific frame, so a `Basin` must sit at
    // the bottom of the NEW canvas rather than at the height the old one's bottom happened to be. Carrying the
    // positions instead — cohesion's answer, one paragraph up — would leave a basin floating mid-frame after a
    // fullscreen toggle.
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  /**
   * Re-size the particle population WITHOUT restarting the animation (Visual FX "Particle Number").
   *
   * A `dispose()` + `init()` would have been the obvious route and is wrong for a live slider: `init()`
   * resets `pos` to 0 and re-reads `angle` from the preset, so every step of a drag would snap the figure
   * back to its opening pose. It also re-parses the wave table and re-derives `waveScale` — work that
   * cannot change when only the count does. This keeps the animation clock, the accumulated rotation and
   * the wave/colour configuration exactly as they are, and touches only the per-particle arrays.
   *
   * ⚠️ EVERY per-particle array must be listed here. `getState()` publishes `positions`, `colors`,
   * `depths`, `velocities` and `velocityDirs` straight to the renderer, and a short one under-sizes the
   * draw — which ANGLE reports and then silently DROPS THE WHOLE DRAW, giving a black frame with no JS
   * exception. Three of them are consumed by index elsewhere too (`modelPos` by the crystal pool,
   * `prevPositions` by the velocity difference, the physarum/cluster offsets by their steering fields).
   *
   * GROWING PRESERVES history and ZEROES the new tail; SHRINKING truncates. That is the same grow-only
   * discipline `main.ts` uses for the fluid buffers (D8) and it matters for the same reason: the
   * persistent offsets, the EMA reference and `prevPositions` are integrated state, so reallocating them
   * to zeros would make the whole figure jump on a slider step rather than only the particles that
   * actually appeared. Newly-appeared slots read zeros for one frame, which the velocity teleport guard
   * already rejects.
   *
   * ⚠️ **The discipline extends to every sub-processor, and that is the non-obvious part.** A slider fires
   * on every `input` event, so anything reconstructed here is reconstructed dozens of times per drag.
   * `FireProcessor`, `MaterialProcessor` and the physarum headings therefore all grew real `resize()`
   * methods rather than being re-`init()`ed — each holds integrated state whose loss is visible as the
   * whole population resetting at once (buoyancy offsets snapping home, temperatures re-warming from
   * cold, every physarum particle losing its filament). Anything ADDED here must be checked the same way:
   * ask what the field accumulates, not merely whether it is the right length.
   */
  setParticleCount(count: number): void {
    const next = Math.max(1, Math.floor(count));
    if (next === this.particleCount) return;

    const grow = (src: Float32Array, stride: number): Float32Array => {
      const out = new Float32Array(next * stride);
      out.set(src.length <= out.length ? src : src.subarray(0, out.length));
      return out;
    };

    this.positions = grow(this.positions, AXES);
    this.prevPositions = grow(this.prevPositions, AXES);
    this.colors = grow(this.colors, AXES);
    this.depths = grow(this.depths, 1);
    this.velocities = grow(this.velocities, 1);
    this.escapes = grow(this.escapes, 1);   // v8 33.5 — see the field's header (invariant 6)
    this.velocityDirs = grow(this.velocityDirs, 2);
    // Not integrated state — it is rewritten in full every frame — but it must still be the right LENGTH
    // before the spark spawn reads it by index, and the spawn runs in the same frame as the drag.
    this.frameMotion = grow(this.frameMotion, 2);
    this.physarumOffsetX = grow(this.physarumOffsetX, 1);
    this.physarumOffsetY = grow(this.physarumOffsetY, 1);
    this.modelPos = grow(this.modelPos, AXES);
    // The cluster-force arrays are LAZY (`ensureClusterScratch`), so they are grown only if the feature
    // has actually allocated them. Zero-length IS the disabled state, and growing from zero would hand 5
    // arrays (400 KB at 20 000 particles) to a feature nobody switched on — the exact cost the laziness
    // exists to avoid.
    //
    // But when it IS on, they must be grown rather than left stale. `ensureClusterScratch` keys off a
    // length comparison, so a stale array is not a correctness problem — it would reallocate on the next
    // frame — it is a STATE problem: `clusterForceX/Y` are persistent accumulated deflections, so a
    // reallocation to zeros would snap every particle off the ice at once. Only the two force arrays
    // carry state; the three scratch arrays are rewritten from `positions` every frame and are grown
    // purely to keep `ensureClusterScratch` from firing and taking the force arrays down with them.
    if (this.clusterForceX.length > 0) {
      this.clusterForceX = grow(this.clusterForceX, 1);
      this.clusterForceY = grow(this.clusterForceY, 1);
      this.clusterScratchX = grow(this.clusterScratchX, 1);
      this.clusterScratchY = grow(this.clusterScratchY, 1);
      this.clusterScratchZ = grow(this.clusterScratchZ, 1);
    }

    this.particleCount = next;

    // Sub-processors own their own arrays and each has a documented re-size contract.
    //
    // Both sub-processors get a real `resize()` for the same reason the arrays above are grown rather
    // than reallocated: they hold INTEGRATED state, so re-initialising them to zeros would disturb the
    // whole population on a slider step instead of only the slots that actually appeared.
    //
    // `MaterialProcessor` carries integrated `temperatures` and an accumulating `lifetimes` age, which
    // `heatMode: 'age'` reads with a deliberate per-index stagger.
    this.materialProcessor.resize(next);
    // `FireProcessor.resize()`, NOT a reconstruction: its offsets and per-particle age are integrated
    // state on the same footing as the arrays above, so a fresh instance would snap every particle back
    // to its mathematical position and reset the turbulence-response curve on each slider step. It
    // extends `noisePhase` with the true per-index values rather than zeros — see the note there.
    if (this.fireProcessor) this.fireProcessor.resize(next);
    // `CohesionField.resize()`, on the same contract and for the same reason — its offsets are the integrated
    // displacement that IS the beading, so a reconstruction would dissolve every drop simultaneously on each
    // step of a Particle Number drag. Guarded on the instance because the field is lazily constructed: with
    // Cohesion at its default 0 there is nothing to resize and nothing to allocate.
    if (this.cohesionField) this.cohesionField.resize(next);
    // The crystal pool is deliberately NOT touched — not resized and not reset.
    //
    // Its capacity comes from `crystal.poolSize`, never from the particle count, and a crystal is an
    // independent additive entity: once born it carries its own position, age, growth and depth. So there
    // is nothing here to resize. Resetting was the first implementation and is wrong — it is the
    // established behaviour on a PRESET CHANGE (pool contents are history, not parameters, D-09), but a
    // slider fires on every `input` event, so a drag would demolish and re-grow the entire ice structure
    // dozens of times.
    //
    // The one index into the wave block is `srcIndex` — which wave particle a crystal nucleated from,
    // read each frame for the early-melt heat probe. It is ALREADY bounds-checked against `waveCount`
    // there (`src >= 0 && src < waveCount`), so shrinking cannot produce an out-of-range read: those
    // crystals simply skip the heat probe and melt on their own `crystalLifetime` instead. Indices below
    // the new count stay correct, because the arrays are truncated rather than reshuffled — slot i is
    // still particle i.
    // Sparks survive: `SparkPool` is sized by `sparkConfig.poolSize`, not by the particle count, and its
    // slots hold independent Newtonian state with no index into the wave block.

    if (this.attractorParams && this.attractorState) {
      // Grown, then only the NEW TAIL is seeded — `initAttractorState`'s `fromIndex`.
      //
      // Re-seeding the whole array was the first implementation and is the most visible failure of the
      // set: attractor state is the iteration itself, built up over thousands of frames, so a full re-seed
      // collapses the cloud back to its starting spiral on every `input` event. But the tail cannot be
      // left at zeros either — for the ODE attractors the origin is a FIXED POINT, so those particles
      // would sit there forever, which is exactly the trap the old comment here described.
      const prevCount = this.attractorState.x.length;
      const st = this.attractorState;
      const carry = (src: Float32Array): Float32Array => {
        const out = new Float32Array(next);
        out.set(src.length <= next ? src : src.subarray(0, next));
        return out;
      };
      // ⚠️ `rx`/`ry` must be carried alongside `x`/`y`, not merely allocated. They are the EMA-smoothed
      // RENDER positions of the discrete maps, i.e. integrated state — dropping them to zeros would pull
      // every drawn dot back through the origin on every step of a slider drag. `renderReady` and `cursor`
      // carry over for the same reason: a false flag would snap the whole cloud, and a reset cursor would
      // re-walk the population from index 0 instead of continuing round.
      // ⚠️ `centreX/Y/Z` carry over for a third reason: they are MEASURED once at the full seed, and a
      // grown tail deliberately does not republish them (`initAttractorState` only writes them at
      // `fromIndex === 0`). Dropping them to 0 here would shift the whole figure by the attractor's own
      // offset — up to 0.93 of the half-extent for `lorenz` — on the first step of a Particle Number drag.
      this.attractorState = {
        x: carry(st.x), y: carry(st.y), z: carry(st.z),
        rx: carry(st.rx), ry: carry(st.ry),
        renderReady: st.renderReady, cursor: st.cursor % (next || 1),
        centreX: st.centreX, centreY: st.centreY, centreZ: st.centreZ,
      };
      const grown = this.attractorState;
      if (next > prevCount) initAttractorState(grown, this.attractorParams, prevCount, this.attractorTier ?? undefined);
      // The three output arrays are pure per-frame scratch — `iterateAttractor` writes every slot before
      // anything reads it — so they only need the right length.
      this.attractorX = new Float32Array(next);
      this.attractorY = new Float32Array(next);
      this.attractorZ = new Float32Array(next);
      // v8 Phase 37 — the strand keeps its head and centre and RE-FILLS its buffer for the new count on its next
      // `step()` (its own count test), so a Particle Number drag neither re-warms the bank nor jumps the figure.
    }

    // Physarum headings, grown rather than re-spread: a heading turns by at most `turnSpeed` per frame
    // toward the strongest trail, which is how a particle locks onto a filament, so `resetHeadings` would
    // throw the whole population off its network on every slider step. Guarded on an active reference so
    // a disabled feature allocates nothing.
    if (this.physarumRef) this.physarumRef.resizeHeadings(next);

    // `velRefEMA` is the velocity normalisation reference and is a scalar, so it needs no resize — but
    // it is left alone deliberately: it is a population statistic that stays valid across a count
    // change, and zeroing it would re-trigger the first-frame seeding branch and flash the material.
  }

  setCurlNoise(config: CurlNoiseConfig): void {
    this.curlConfig = config;
  }

  /**
   * v8 Step 21.4a — where the `index` palette mapping's colour comes from, or `null` for "the preset's own
   * `colorBase`/`colorAmp`".
   *
   * ⚠️ **The ONLY caller must be `main.ts`'s palette resolution, handing over
   * `resolvePaletteSelection().indexPalette` verbatim.** Deciding here whether the mapping is `index` would
   * be a second resolution of a two-source value (invariant 17), and — worse — it would let the generator
   * and the renderer disagree about whether the shader's LUT is also running, which is the one failure mode
   * that produces a *plausible wrong picture* instead of a black frame.
   *
   * ⚠️ **Takes effect on the next `update()`, not immediately**, because the colour loop runs there. That
   * matters for the Preview tiles and the swatch strip, which sample a frame rather than a setter.
   */
  setIndexPalette(src: IndexPaletteSource | null): void {
    this.indexPalette = src;
  }

  /**
   * v8 `26.4` — the palette hue rotation, in TURNS, for the CPU `index` path.
   *
   * ⚠️ **BOTH HALVES OF THE `index` SPLIT MUST MOVE TOGETHER** (`26.4`): the LUT mappings are rotated in the
   * shader, `index` is rotated here, and a rotation applied to only one of them would show two different
   * pictures depending on which mapping a preset happens to use.
   *
   * ⚠️ **IT IS APPLIED ONLY WHERE AN INDEX PALETTE IS ACTUALLY IN FORCE — never to the preset's own colour
   * law.** The cosine branch below is *also* the no-palette fallback (`cBase = this.colorBase`), and on
   * those presets `Warmth` keeps its original `colorBase` law. Rotating there as well would move the same
   * quality twice on the same drag, which is the opposite of what `26.D5` specifies: the two laws are
   * mutually exclusive, decided by whether a palette resolves.
   */
  setIndexHueShift(turns: number): void {
    this.indexHueShift = Number.isFinite(turns) ? turns : 0;
  }

  /**
   * v8 Step 21.4e — the colour law's two RATE vectors, per channel: `colorFreq` (how many colour cycles the
   * law completes around the particle index) and `colorShift` (how fast each channel drifts with `pos`).
   *
   * ⚠️ **A getter pair, not a config read, and in the STORED unit.** `colorFreq` is divided by `DEG` inside
   * the loop and `colorShift` is not — the asymmetry the Composer's `FM.Base` note names — so the numbers
   * here are the authored ones and every unit conversion stays at the single site that owns it.
   *
   * ⚠️ **Deliberately NOT via `init()`.** Both are rates, so re-initialising to apply one would reset `pos`
   * to 0 and snap the figure back to its opening pose mid-drag — the same reason `setRotationSpeed`,
   * `setParticleCount` and `setWaves` all write in place. They are read fresh by the colour loop on every
   * `update()`, so an in-place write needs nothing else.
   *
   * ⚠️ **These reach the picture under EVERY mapping, not only `index`** — the law always writes
   * `state.colors`, which is what `phase` samples and what the no-palette path emits. Under a LUT mapping
   * other than `phase` the effect is invisible, which is invariant 13's shape: the control is live, the
   * output channel cannot show it. The UI gates the section on the mapping for exactly that reason.
   */
  getColorFreq(): [number, number, number] {
    return [this.colorFreq[0]!, this.colorFreq[1]!, this.colorFreq[2]!];
  }

  getColorShift(): [number, number, number] {
    return [this.colorShift[0]!, this.colorShift[1]!, this.colorShift[2]!];
  }

  setColorFreq(v: readonly number[]): void {
    this.colorFreq = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  }

  setColorShift(v: readonly number[]): void {
    this.colorShift = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  }

  /**
   * # THE ONE OWNER OF THE PARTICLE COLOUR LAW — one particle, three channels, written into `out` at `off`.
   *
   * The legacy law: `val[c] = clamp(base[c] + sin(n·freq[c]/DEG + pos·shift[c]) · amp[c], 0, 255) / 255`,
   * with `n = i · 360/count`.
   *
   * ⚠️ **v8 Step 21.4a: this law IS a cosine palette over the normalised particle index.** With `DEG = 180/π`
   * and `n = i · 360/count`, `n·freq/DEG` is exactly `2π · freq · (i/count)` — Quilez's
   * `a + b·cos(2π(c·t + d))` with `a = base/255`, `b = amp/255`, `c = freq`. See `CYCLE_PALETTES`' header for
   * the full identification. So the `index` mapping does **not** add a second colour system: it substitutes
   * where `base`/`amp` come from, once, and everything else — the per-channel phase, the clamp at 0 and 255,
   * the division — is the code that has always run. That identity is what makes an adopted preset
   * byte-identical to an unadopted one.
   *
   * ⚠️ **TWO CALLERS, ONE BODY, AND THAT IS WHY THIS IS A METHOD** — `update()`'s per-particle loop and
   * `sampleIndexColours()`, which draws the swatch (`21.4f`). A second clamped copy for the swatch is the
   * defect this shape exists to prevent: the clamp is part of each `Cycle:` palette's *identity*
   * (`Cycle: Shadowed` is black for half its cycle **because** of it), so a divergent copy changes the
   * gradient's SHAPE rather than its brightness — invariant 9's signature, which a visual review passes and
   * which would make the swatch confidently describe a picture the engine is not drawing.
   *
   * ⚠️ **`pos` is a PARAMETER, not `this.pos`.** The swatch samples a fixed non-zero instant while the figure
   * animates, and invariant 28's rule applies in full: at `pos === 0` the drift term vanishes on every channel
   * at once, so a swatch drawn there would show the same three-cosine ramp whatever `Colour Drift` said, and
   * the control would read inert.
   */
  private writeColourAt(
    i: number, count: number, pos: number,
    out: Float32Array | number[], off: number,
  ): void {
    const ip = this.indexPalette;

    // A `Classic:` gradient or a `Material:` ramp under the `index` mapping. These carry no `a`/`b` — they are
    // baked 256-entry RGBA ramps — so the population is coloured by walking the ramp instead of by evaluating
    // a cosine.
    //
    // ⚠️ **Per channel, at three different coordinates, and that is the point.** `colorFreq` and `colorShift`
    // are per-channel vectors (the drift is uniform across RGB in exactly ONE library preset, and 87 presets
    // share a 1 : 2 : 3 ratio), so reading one shared coordinate would leave both of the mapping's own
    // controls visibly inert on 20 of the 41 palettes — invariant 13, in the form where the control moves the
    // right thing and the *output channel* cannot show it. Sampling a ramp three times and taking one channel
    // from each is the same thing the cosine branch does with three phases.
    //
    // The coordinate WRAPS rather than clamping, because a cycle count above 1 is the normal case here and
    // clamping would flatten everything past the first pass onto the ramp's last texel.
    if (ip !== null && ip.kind === 'lut' && ip.lut) {
      const lut = ip.lut;
      const t = count > 1 ? i / count : 0;
      for (let c = 0; c < 3; c++) {
        // `n · freq / DEG` is `2π · freq · t`; dividing by 2π returns it to TURNS, which is what a ramp
        // coordinate is. Written this way rather than with `cStep` so the two branches are visibly the same
        // quantity in different units.
        let turns = t * this.colorFreq[c]! + (pos * this.colorShift[c]!) / (Math.PI * 2);
        // v8 26.4 — the coordinate is ALREADY in turns and ALREADY wraps here, so the rotation is one
        // addition and needs no identity guard: adding 0 changes nothing before the `floor`.
        turns += this.indexHueShift;
        turns -= Math.floor(turns);
        const texel = Math.round(turns * 255) * 4;
        out[off + c] = lut[texel + c]! / 255;
      }
      return;
    }

    const cBase = (ip !== null && ip.kind === 'ab' && ip.base) ? ip.base : this.colorBase;
    const cAmp = (ip !== null && ip.kind === 'ab' && ip.amp) ? ip.amp : this.colorAmp;
    const n = i * (360 / count);
    /*
     * v8 `26.4` — the rotation in RADIANS, and **only for a real `ab` index palette.**
     *
     * ⚠️ **THIS BRANCH IS ALSO THE NO-PALETTE FALLBACK, WHICH IS WHY THE GUARD IS NOT OPTIONAL.** When
     * `ip` is null, `cBase`/`cAmp` are the PRESET's own `colorBase`/`colorAmp` — and on those presets the
     * `Warmth` row keeps its original law of scaling `colorBase` directly. Rotating here as well would
     * move the same quality twice on one drag. The two laws are mutually exclusive by design, decided by
     * whether a palette resolves, and `rowLiveness()` reports which one is in force.
     */
    const hueRad = (ip !== null && ip.kind === 'ab') ? this.indexHueShift * Math.PI * 2 : 0;
    for (let c = 0; c < 3; c++) {
      let val = cBase[c]!
        + Math.sin((n * this.colorFreq[c]!) / DEG + pos * this.colorShift[c]! + hueRad) * cAmp[c]!;
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      out[off + c] = val / 255;
    }
  }
  /**
   * v8 CPU pass (A) — **`writeColourAt` for every particle at once**, the generator's per-frame path. Measured: colour
   * was 17–23 % of a figure update. ⚠️ **The SAME law as `writeColourAt` — that function stays its one owner and the
   * swatch's** — with two cost changes and no change of meaning:
   *   - the palette (`lut`) branch is the same arithmetic in the same order, with the per-frame term hoisted, so it is
   *     BIT-IDENTICAL;
   *   - the sine branch takes `sin(a + φ) = sin a·cos φ + cos a·sin φ`, with `sin a`/`cos a` per particle from a table
   *     cached by count and frequencies, and φ = the frame's phase. At φ = 0 (no colour shift) that is exactly `sin a`,
   *     so static colours are bit-identical too; with a shift the value differs at rounding level (colour only).
   */
  private writeAllColours(count: number, pos: number, out: Float32Array): void {
    const ip = this.indexPalette;
    if (ip !== null && ip.kind === 'lut' && ip.lut) {
      const lut = ip.lut;
      const f0 = this.colorFreq[0]!, f1 = this.colorFreq[1]!, f2 = this.colorFreq[2]!;
      const k0 = (pos * this.colorShift[0]!) / (Math.PI * 2);
      const k1 = (pos * this.colorShift[1]!) / (Math.PI * 2);
      const k2 = (pos * this.colorShift[2]!) / (Math.PI * 2);
      const hue = this.indexHueShift;
      for (let i = 0; i < count; i++) {
        const tt = count > 1 ? i / count : 0;
        const off = i * 3;
        let u = tt * f0 + k0; u += hue; u -= Math.floor(u); out[off] = lut[Math.round(u * 255) * 4]! / 255;
        u = tt * f1 + k1; u += hue; u -= Math.floor(u); out[off + 1] = lut[Math.round(u * 255) * 4 + 1]! / 255;
        u = tt * f2 + k2; u += hue; u -= Math.floor(u); out[off + 2] = lut[Math.round(u * 255) * 4 + 2]! / 255;
      }
      return;
    }
    const cBase = (ip !== null && ip.kind === 'ab' && ip.base) ? ip.base : this.colorBase;
    const cAmp = (ip !== null && ip.kind === 'ab' && ip.amp) ? ip.amp : this.colorAmp;
    const hueRad = (ip !== null && ip.kind === 'ab') ? this.indexHueShift * Math.PI * 2 : 0;
    const key = `${count}|${this.colorFreq[0]}|${this.colorFreq[1]}|${this.colorFreq[2]}`;
    if (key !== this.colourTabKey || this.colourTab.length < count * 6) {
      if (this.colourTab.length < count * 6) this.colourTab = new Float64Array(count * 6);
      const tab = this.colourTab;
      for (let i = 0; i < count; i++) {
        const n = i * (360 / count);
        for (let c = 0; c < 3; c++) {
          const a = (n * this.colorFreq[c]!) / DEG;
          tab[i * 6 + c * 2] = Math.sin(a);
          tab[i * 6 + c * 2 + 1] = Math.cos(a);
        }
      }
      this.colourTabKey = key;
    }
    const tab = this.colourTab;
    for (let c = 0; c < 3; c++) {
      const phi = pos * this.colorShift[c]! + hueRad;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      const base = cBase[c]!, amp = cAmp[c]!;
      const exact = phi === 0;
      for (let i = 0; i < count; i++) {
        const sA = tab[i * 6 + c * 2]!;
        const sv = exact ? sA : sA * cp + tab[i * 6 + c * 2 + 1]! * sp;
        let val = base + sv * amp;
        if (val < 0) val = 0;
        if (val > 255) val = 255;
        out[i * 3 + c] = val / 255;
      }
    }
  }


  /**
   * v8 Step 21.4f — `n` colours evenly spaced along the particle index, at `pos`, as 0–1 floats packed RGB.
   *
   * Drawn as the swatch strip under the `Index Colour` controls. It is the REAL law, through
   * `writeColourAt()`, so the strip cannot describe a gradient the engine is not drawing — including the
   * clamp, which is half of what makes a `Cycle:` palette look the way it does.
   *
   * ⚠️ **The caller chooses `pos` and must not pass 0** (invariant 28). `count` is the swatch's own resolution,
   * not `particleCount`: the law is continuous in `i/count`, so a 64-sample strip is a faithful picture of a
   * 50 000-particle figure, and tying it to the live count would make the strip re-render on every Particle
   * Number drag for no visible difference.
   */
  sampleIndexColours(n: number, pos: number): Float32Array {
    const count = Math.max(1, Math.floor(n));
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.writeColourAt(i, count, pos, out, i * 3);
    return out;
  }

  resetCurlTime(): void {
    this.curlTime = 0;
  }

  setPhysarumProcessor(ref: PhysarumProcessor | null, config: PhysarumConfig | null): void {
    this.physarumRef = ref;
    this.physarumConfig = config;
    this.physarumOffsetX.fill(0);
    this.physarumOffsetY.fill(0);
    if (ref) ref.resetHeadings(this.particleCount);
  }

  // ---- v8 Phase 8a-3: crystal pool ---------------------------------------------------------

  /**
   * Crystal pool occupancy, 0–1. The denominator is the POOL, not the figure (8a-3): crystals are
   * additive slots, so "what fraction of the figure is frozen" is no longer a meaningful question —
   * the answer is always zero. Read by the Crystal tab's readout and compared against `freezeCap`.
   *
   * The name is kept so the `VisualFxControls` surface and the tab need no rename.
   */
  getFrozenFraction(): number {
    return this.crystalPool.getFrozenFraction();
  }

  /**
   * The pool's ALLOCATED slot count — the denominator `getFrozenFraction()` divides by.
   *
   * Exposed for the Crystals readout (triage I5), which reconstructs an absolute count as
   * `fraction * capacity` and previously re-derived this by re-applying `CrystalPool`'s
   * `[MIN_CRYSTAL_POOL, MAX_CRYSTAL_POOL]` clamp to `overlay.crystal.poolSize` in the UI layer. That was
   * correct but was a second copy of the clamp: `poolSize` arrives from an imported preset with no
   * validation, so a UI that clamped differently from the pool would print a count against a capacity
   * that was never allocated.
   */
  getCrystalCapacity(): number {
    return this.crystalPool.getCapacity();
  }

  /**
   * Drop every crystal and all lifecycle history. Called on preset change — the crystal set is
   * history, not parameters (D-09), so it must never survive a switch and is never serialised.
   *
   * Kept under the 8a name because main.ts calls it from three sites.
   */
  resetFrozen(): void {
    this.crystalPool.reset();
  }

  /**
   * Supplies the pool with its parameters. `null` or `enabled: false` makes `CrystalPool.update()`
   * return before it allocates anything, so the feature costs nothing when off.
   */
  setCrystalConfig(config: CrystalRenderConfig | null): void {
    this.crystalConfig = config;
  }

  setMaterialConfig(config: MaterialConfig | null): void {
    const wasActive = this.materialConfig != null && this.materialConfig.preset !== 'None';
    this.materialConfig = config;
    const isActive = config != null && config.preset !== 'None';
    if (isActive) {
      this.materialProcessor.setMaterialTag(1);
    } else {
      this.materialProcessor.setMaterialTag(0);
      // D9: clear accumulated heat when the material is switched OFF.
      //
      // Only the tag was flipped before, so `temperatures[]` kept whatever it last integrated. That is
      // observable, not merely untidy: the splat and volume paths index their colour ramp by temperature, so
      // stale heat means stale colour — and since B14 a palette can be indexed by temperature too, which
      // would show heat from a material that is no longer running. Also affects anything else reading the
      // field: the crystal `cold` birth rule, `meltThreshold`, spark spawning.
      //
      // Guarded on `wasActive` so the common no-material case does not walk the array every call —
      // `setMaterialConfig` is invoked from 14 sites.
      if (wasActive) this.materialProcessor.resetTemperatures();
    }
  }

  // `getPositionsForFluidSeed()` was declared here and deleted on 2026-08-10 (triage H7, reclassified
  // from performance to dead code — it had ZERO callers, so its `this.positions.slice()` was never
  // actually costing the 240 KB/frame the triage attributed to it). The fluid sim does not want model
  // positions at all: `main.ts` builds normalised UV pairs plus frame-to-frame velocity UVs and calls
  // `fluidProcessor.seedFromParticles(uvs, velUVs, n)`, where `n` EXCLUDES the crystal block. A raw
  // positions copy would have seeded the field in model space and included crystals, which have no
  // trajectory. Do not reinstate this as a convenience accessor; `getState().positions` already
  // exposes the array without a copy.

  /**
   * Uniform fit factor: how much to scale authored amplitudes so the figure fits this canvas with its
   * AUTHORED ASPECT RATIO INTACT.
   *
   * `min(w/srcW, h/srcH)` — the smaller axis governs, so the figure is never stretched. Replaced
   * per-axis scaling (X by `w/srcW`, Y by `h/srcH`) on 2026-08-06, which distorted any preset whenever
   * the canvas aspect differed from the authored aspect. That was most visible on a preview↔fullscreen
   * toggle, which changes WIDTH ONLY: measured 104 % horizontal stretch at 1920×1080 with a half-width
   * preview panel, and the figure visibly snapped shape on every toggle.
   *
   * The cost is letterboxing on the long axis — at 1920×1080 from a 960×720 design the figure fills
   * 75 % of the width. `viewScale` (the Visual FX "Figure Scale" slider) is how the user reclaims that,
   * or deliberately overfills to frame part of a figure.
   */
  private uniformFit(srcW: number, srcH: number): number {
    const sw = srcW > 0 ? this.canvasWidth / srcW : 1;
    const sh = srcH > 0 ? this.canvasHeight / srcH : 1;
    return Math.min(sw, sh);
  }

  /**
   * Figure scale, applied at PROJECTION time rather than baked into the wave amplitudes.
   *
   * Amplitudes now stay in authored units for the lifetime of the generator (see `waveScale`), so this
   * is a pure view transform: changing it cannot accumulate error, and `resize()` is idempotent. The
   * old code multiplied the stored amplitudes in place on every resize, which meant the only way back
   * to the authored values was to re-init from the preset (defect G16).
   */
  setViewScale(scale: number): void {
    this.viewScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  getViewScale(): number {
    return this.viewScale;
  }

  /**
   * E30 — dihedral symmetry order. `fold` 1 disables the operator; 2–12 fold the figure into that many
   * identical sectors. `mirror` selects the DIHEDRAL group (each sector is a reflection of its
   * neighbour) over the CYCLIC one (each sector a plain rotation).
   *
   * ⚠️ **`mirror` is a CORRECTNESS setting as much as a stylistic one, and the default is `true` for
   * that reason.** The cyclic form is a bare `theta mod sector`, which is DISCONTINUOUS at the wedge
   * boundary: a particle crossing it jumps a whole sector in one frame, which trips three teleport
   * guards downstream — `outlierCap` below (zeroes the velocity, so velocity-driven materials, sparks
   * and `heatMode: 'velocity'` all see a dead particle), `NeonLineRenderer.computeTeleportSq()` (drops
   * the segment) and `RibbonRenderer`'s copy of the same test (alpha 0). The reflected form is
   * continuous everywhere, so it has none of that. Cyclic is offered anyway because the jump is
   * *visible* only in trail-drawing modes, and the un-mirrored rosette is a genuinely different look.
   */
  setSymmetry(fold: number, mirror: boolean): void {
    const f = Math.round(Number.isFinite(fold) ? fold : 1);
    this.symmetryFold = Math.max(1, Math.min(12, f));
    this.symmetryMirror = mirror;
  }

  /**
   * v8 Phase 42 — **3-D Symmetry**: one setter for the whole operator (`setSymmetry`'s shape). The group is resolved
   * and memoised in `core/symmetry-groups.ts`; `off` stores null, so the per-frame stage is skipped entirely.
   */
  setSymmetry3d(cfg: Sym3dConfig): void {
    this.sym3d = resolveSym3d(cfg);
  }
  getSymmetry3dCopies(): number {
    return this.sym3d?.copies ?? 1;
  }

  /**
   * Per-axis rotation SPEED, in **degrees per second** — the unit `generators.rotation` is stored in.
   *
   * ⚠️ **The unit is derived, not assumed** (invariant 10). `update()` does `angle[i] += rotationSpeed[i] *
   * (dt / 1000)` and the angles are consumed as `Math.sin(angle / DEG)` with `DEG = 180/π`, i.e. as DEGREES.
   * So one full turn is 360 of these units and `1 RPM = 6 °/s` exactly. The Visual FX rotation sliders are
   * labelled in RPM and convert with that factor; nothing here knows about RPM.
   *
   * ⚠️ **This clamp is the load-bearing half of the slider's range** (invariant 13): the slider's own ±10 RPM
   * is cosmetic, and `ROT_MAX_DPS` is shared with the track rather than duplicated as a literal, exactly as
   * `SPEED_MIN`/`SPEED_MAX` are. `init()` deliberately does NOT clamp — an authored preset keeps whatever it
   * authored, and the library's largest is 30 °/s (5 RPM), well inside the range.
   *
   * `angle` is untouched: this sets a RATE, so changing it must not teleport the figure's current pose.
   */
  setRotationSpeed(speed: readonly number[]): void {
    for (let i = 0; i < AXES; i++) {
      const v = speed[i];
      const f = Number.isFinite(v) ? (v as number) : 0;
      this.rotationSpeed[i] = Math.max(-ROT_MAX_DPS, Math.min(ROT_MAX_DPS, f));
    }
  }

  /** The live per-axis rotation speed in °/s. Copied — callers must not alias the generator's array. */
  getRotationSpeed(): [number, number, number] {
    return [this.rotationSpeed[0] ?? 0, this.rotationSpeed[1] ?? 0, this.rotationSpeed[2] ?? 0];
  }

  /**
   * v8 16.0 (E91) — replace the wave table IN PLACE, for the Composer tab's live edits.
   *
   * ⚠️ **THE WHOLE REASON THIS EXISTS: `initGenerator()` IS THE WRONG CALL, AND THIS FILE ALREADY SAYS SO
   * TWICE.** `main.ts`'s `initGenerator()` rebuilds the config and calls `init()`, which sets `this.pos = 0`
   * and re-reads `config.angle` — so routing a Composer stepper click through it would **snap the figure
   * back to its opening pose on every click**, discarding the phase the user is watching. `setRotationSpeed`
   * and `setParticleCount` both hit that and both solved it with an in-place setter; this follows the
   * precedent rather than inventing a pattern.
   *
   * ⚠️ **IT IS A PURE COPY, and that is a property of `waveScale` rather than of this method.** The authored
   * amplitudes are NOT baked at init: `init()` computes `waveScale = uniformFit(designW, designH)` and
   * `project()` applies it at projection time (defect G16's fix, which is also why `resize()` is
   * idempotent). So there is nothing here to refit, reallocate or re-integrate — no `pos` reset, no
   * `angle` re-read, no sub-processor `resize()`. **If a future change ever bakes an amplitude at init,
   * this method acquires a second responsibility and this comment is the place that says so.**
   *
   * The mapping is `buildWaveTable`'s, shared with `init()` — see its `amp`/`freq` vs
   * `amplitude`/`frequency` warning, which is the one way a caller can silently blank the figure.
   *
   * `speed` on each `WaveConfig` is deliberately ignored: it is required by the type, interpolated at
   * `interpolate.ts:555`, and **read by nothing** — `init()` takes `config.waveSpeed`, not a per-wave
   * value. A setter that pretended to honour it would be inert on arrival (invariant 13).
   */
  /**
   * v8 `36.10` — **`setLSystem` and `setWaves` are SIBLINGS, and the non-live one is a NO-OP rather than
   * an error.** A preset carrying both blocks is the entire point of `36.2`'s non-destructive switching,
   * so a setter that threw on the dormant type would make the format's own guarantee unusable.
   *
   * ⚠️ Passing `null` means *this preset has no curve block*; the figure falls back to the waves.
   */
  setLSystem(config: LSystemConfig | null): void {
    this.lsystem = config;
  }

  /**
   * v8 `39.A3`/`39.A4` — resolve `Twist` and `Stretch` for one frame through `resolveOp`, clamped to the rule's
   * own range, plus the "is it breathing" facts `resolveFigure` brackets on.
   *
   * ⚠️⚠️ **A RULE WITH NO TWISTABLE / STRETCHABLE COPY RETURNS THE IDENTITY REGARDLESS OF THE PRESET**, so a
   * stored `twist` on a rule that has no Twist row (e.g. left by a rule switch in an older file) can never
   * reach the figure — the row is ABSENT there, and an absent row must mean an inert key.
   */
  private resolveGeneratorAxes(cfg: LSystemConfig, key: RuleKey, scaledTime: number, custom: ResolvedCurveRule | null = null): {
    twist: number; stretch: number; anglesAnimated: boolean; twistAnimated: boolean; stretchAnimated: boolean;
    generator: (typeof LSYSTEM_GENERATORS)[RuleKey];
  } {
    const gen = LSYSTEM_GENERATORS[key];
    const anglesAnimated = cfg.yaw.amplitude !== 0 || cfg.pitch.amplitude !== 0 || cfg.roll.amplitude !== 0;
    const tw = cfg.twist, st = cfg.stretch;
    /*
     * v8 `39.C` — a custom generator's masks and ranges are its OWN (`CUSTOM_RANGES`), and an axis with no masked
     * copy is inert exactly as on a named rule: the row is absent, so the key must be too.
     */
    const steps = custom !== null && custom.kind === 'custom' ? custom.gen.steps : null;
    const twistable = steps !== null ? steps.some((s) => s.kind === 'move' && s.twistable)
      : gen !== null && gen.twistable.length > 0;
    const stretchable = steps !== null ? steps.some((s) => s.kind === 'move' && s.stretchable)
      : gen !== null && gen.stretchable.length > 0;
    const twistRange: readonly [number, number] = steps !== null ? CUSTOM_RANGES.twist : gen?.twistRange ?? [0, 0];
    const stretchRange: readonly [number, number] = steps !== null ? CUSTOM_RANGES.stretch : gen?.stretchRange ?? [1, 1];
    const twistOn = twistable && tw !== undefined;
    const stretchOn = stretchable && st !== undefined;
    return {
      twist: twistOn ? this.resolveOp(tw.base, tw.amplitude, tw.frequency, scaledTime,
        twistRange[0], twistRange[1]) : 0,
      stretch: stretchOn ? this.resolveOp(st.base, st.amplitude, st.frequency, scaledTime,
        stretchRange[0], stretchRange[1]) : 1,
      anglesAnimated,
      twistAnimated: twistOn && tw.amplitude !== 0,
      stretchAnimated: stretchOn && st.amplitude !== 0,
      generator: gen,
    };
  }

  /** v8 `36.1` — which source fills the `[wave]` block. Resolved by the caller (`resolveFigureType`). */
  setFigureType(type: FigureType): void {
    this.figureType = type;
  }

  setWaves(waves: readonly WaveConfig[]): void {
    this.waves = buildWaveTable(waves);
  }

  getSymmetryFold(): number {
    return this.symmetryFold;
  }

  getSymmetryMirror(): boolean {
    return this.symmetryMirror;
  }

  /**
   * v8 `30.1` (`E129a`) — Barr twist about one axis, in TURNS PER HALF-EXTENT of the design box.
   *
   * Per-axis rather than a whole triple, matching `setRotationSpeed` because the UI control is the same
   * `tripletRow` widget and each of its three sliders writes only its own axis (`30.D6`).
   *
   * ⚠️ **CLAMPED HERE AS WELL AS IN THE TRACK**, for `setRotationSpeed`'s reason: a hand-edited import
   * reaches this setter without passing the slider, and an unbounded turn count is a loop that winds the
   * figure into noise with no error anywhere. **The clamp constant is shared with the track rather than
   * typed twice** — see `TWIST_MAX_TURNS`.
   *
   * ⚠️ **This sets a SHAPE, not a rate, so it does not touch `angle` or `pos`** — unlike
   * `setRotationSpeed`, which has to say so for the opposite reason.
   */
  /**
   * ⚠️ **A DEAD ZONE AROUND CENTRE, added on owner report (2026-10-25): the twist was "difficult to turn
   * off by putting the sliders to the middle".** With a step of 0.01 over a ±2 range, the centre is one
   * grid cell among 400 and a drag lands on 0.01 as easily as on 0 — which keeps the operator RUNNING,
   * because its gate is `!== 0` on the whole triple.
   *
   * **`TWIST_SNAP` is the smallest twist that is visible rather than an arbitrary fraction of the
   * track**: at 0.05 turns the figure's edge rotates 18°, which reads; below it the figure is
   * indistinguishable from untwisted, so nothing is lost by snapping it away and the control gains an
   * exact off position the user can hit. ⚠️ **It lives in the SETTER rather than the widget, so an
   * imported 0.004 is also normalised** — and the UI reads the value back, so the readout says `Off`.
   */
  setTwist(axis: 0 | 1 | 2, turns: number): void {
    const t = Number.isFinite(turns) ? turns : 0;
    this.twist[axis] = Math.max(-TWIST_MAX_TURNS, Math.min(TWIST_MAX_TURNS, t));
    // The dead zone: see this method's header. Applied AFTER the clamp so both bounds are one rule.
    if (Math.abs(this.twist[axis]!) < TWIST_SNAP) this.twist[axis] = 0;
  }

  /**
   * v8 `33.2`, widened by `34.4` — the basis `Sharpness`, **all three wave LEVELS at once**, each clamped
   * to `[0, SHARPNESS_MAX]`.
   *
   * ⚠️ **ONE SETTER FOR THE WHOLE OPERATOR, like `setSymmetry` and `setChannels`, rather than three.** The
   * three levels are meaningless apart — the caller resolves them together through the `?? sharpness`
   * backfill (`34.D11`) and nothing may go stale between two of them. **It is also what makes the backfill
   * expressible exactly once**: a per-level setter would let a caller write Body and leave Structure
   * holding the previous preset's value, which is the defect class the single `setChannels` exists to
   * prevent.
   *
   * ⚠️ **NO DEAD ZONE, unlike the centre-off triples**, and that is in `SHARPNESS_MAX`'s header: the
   * control is one-sided, so there is no centre to aim at and a snap would only make the bottom of the
   * range unreachable. The identity is the slider's own end stop, which a user can hit exactly.
   */
  setSharpnessLevels(body: number, structure: number, detail: number): void {
    const cl = (s: number): number =>
      Math.max(0, Math.min(SHARPNESS_MAX, Number.isFinite(s) ? s : 0));
    this.sharpnessLevels[0] = cl(body);
    this.sharpnessLevels[1] = cl(structure);
    this.sharpnessLevels[2] = cl(detail);
  }

  /**
   * v8 `34.4` — `Temper`: the breathing of `Sharpness`, **one depth and one rate for all three levels.**
   *
   * ⚠️ The depth is SIGNED and centre-off, so it takes a dead zone (`32.14`); the rate is one-sided with 0
   * meaning *never cycles*, so it does not. **The resolved per-frame value is clamped, not the depth
   * against its base** — see `SHARPNESS_DEPTH_MAX`'s header for why, and note the clamp produces a DWELL at
   * each end which the readout must state or a later reader removes it as a stuck slider.
   */
  setSharpnessBreath(depth: number, rate: number): void {
    const d = Number.isFinite(depth) ? depth : 0;
    this.sharpnessDepth = Math.max(-SHARPNESS_DEPTH_MAX, Math.min(SHARPNESS_DEPTH_MAX, d));
    if (Math.abs(this.sharpnessDepth) < SHARPNESS_DEPTH_SNAP) this.sharpnessDepth = 0;
    this.sharpnessRate = this.clampRate(rate);
  }

  /**
   * v8 `33.3` — the secular term, one axis at a time, matching `setTwist`'s shape.
   *
   * ⚠️ The dead zone lives HERE rather than in the widget, exactly as the twist's does, so an imported
   * 0.004 is normalised too and the UI's read-back prints `Off`. `32.14` is why the read-back matters: a
   * snap the panel cannot show is a snap that does not exist.
   */
  setTravel(axis: 0 | 1 | 2, amount: number): void {
    const t = Number.isFinite(amount) ? amount : 0;
    this.travel[axis] = Math.max(-TRAVEL_MAX, Math.min(TRAVEL_MAX, t));
    if (Math.abs(this.travel[axis]!) < TRAVEL_SNAP) this.travel[axis] = 0;
  }

  /**
   * v8 `34.4` — `Stretch`: the breathing of `Travel`, per axis (`34.D11`), one axis at a time so the
   * triplet widget can write only the cell that moved (`tripletRow`'s header owns that rule).
   */
  setTravelDepth(axis: 0 | 1 | 2, depth: number): void {
    this.travelDepth[axis] = this.clampDepth(depth, TRAVEL_DEPTH_MAX, TRAVEL_DEPTH_SNAP);
  }

  setTravelRate(axis: 0 | 1 | 2, rate: number): void {
    this.travelRate[axis] = this.clampRate(rate);
  }

  /**
   * v8 `34.2` — `Offset`: the DC translation, one axis at a time, matching `setTravel`'s shape and sharing
   * its unit (design half-extents) by `34.D3`.
   */
  setOffset(axis: 0 | 1 | 2, amount: number): void {
    const o = Number.isFinite(amount) ? amount : 0;
    this.offset[axis] = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, o));
    if (Math.abs(this.offset[axis]!) < OFFSET_SNAP) this.offset[axis] = 0;
  }

  /** v8 `34.4` — `Sway`: the breathing of `Offset`, per axis. */
  setOffsetDepth(axis: 0 | 1 | 2, depth: number): void {
    this.offsetDepth[axis] = this.clampDepth(depth, OFFSET_DEPTH_MAX, OFFSET_DEPTH_SNAP);
  }

  setOffsetRate(axis: 0 | 1 | 2, rate: number): void {
    this.offsetRate[axis] = this.clampRate(rate);
  }

  /**
   * v8 `34.3` — `Grow`: the amplitude ramp COEFFICIENT, one axis at a time.
   *
   * ⚠️⚠️ **`0` IS THE IDENTITY AND THE RANGE IS ASYMMETRIC (`GROW_FLOOR` … `GROW_MAX`), so there is NO dead
   * zone** — `DEAD_ZONE_FRACTION` is a fraction of HALF travel and an asymmetric range has no single half
   * for it to apply to. The identity sits at 25 % of travel, which the 0.01 grid reaches exactly; a snap
   * would only make part of the range unreachable. See `GROW_STEP`'s neighbouring note.
   */
  setGrow(axis: 0 | 1 | 2, k: number): void {
    const v = Number.isFinite(k) ? k : 0;
    this.grow[axis] = Math.max(GROW_FLOOR, Math.min(GROW_MAX, v));
  }

  /** v8 `34.4` — `Flare`: the breathing of `Grow`, per axis. Signed, so it DOES take a dead zone. */
  setGrowDepth(axis: 0 | 1 | 2, depth: number): void {
    this.growDepth[axis] = this.clampDepth(depth, GROW_DEPTH_MAX, GROW_DEPTH_SNAP);
  }

  setGrowRate(axis: 0 | 1 | 2, rate: number): void {
    this.growRate[axis] = this.clampRate(rate);
  }

  /**
   * v8 `34.4` — the shared clamp for a signed breathing DEPTH: bound, then dead zone, in that order.
   *
   * ⚠️ **ONE helper rather than four copies, because four copies of a two-line rule is how `32.14`'s single
   * absolute snap came to serve three ranges at three different fractions of travel.** The bound and the
   * snap are passed in because they are DERIVED per operator (`*_DEPTH_MAX`, `*_DEPTH_SNAP`) — the rule is
   * the fraction, not the number.
   */
  private clampDepth(depth: number, max: number, snap: number): number {
    const d = Number.isFinite(depth) ? depth : 0;
    const v = Math.max(-max, Math.min(max, d));
    return Math.abs(v) < snap ? 0 : v;
  }

  /**
   * v8 `34.4` — the shared clamp for a breathing RATE. **One-sided with an EXACT, sticky 0**, which is the
   * "never cycles" state and the operator's identity, so there is no dead zone and no snap.
   *
   * ⚠️ **A non-zero rate below `OP_RATE_MIN` is raised to the floor rather than snapped to 0**, and the two
   * are different claims: 0 means *this never breathes*, while 0.01 means *a 20-minute cycle the author
   * asked for*. Silently turning the second into the first would discard an authored intention; raising it
   * to the slowest rate the track can show keeps the panel and the engine in agreement (`32.14`).
   */
  private clampRate(rate: number): number {
    const r = Number.isFinite(rate) ? rate : 0;
    if (r <= 0) return 0;
    return Math.max(OP_RATE_MIN, Math.min(OP_RATE_MAX, r));
  }

  /**
   * v8 `33.4` — which foliation of the escape field the particles follow.
   *
   * ⚠️ **No validation beyond the union, and no fallback here.** The mode is meaningless for 9 of the 11
   * attractor types, but it is also harmless there: `iterateAttractor` only reads it on the two escape
   * branches. Refusing it would need this object to know which attractor is live, which it does know —
   * and would then be a SECOND owner of a decision `advanceEscapeFlow` already makes correctly.
   */
  setEscapeFlow(mode: 'contour' | 'ray'): void {
    this.escapeFlow = mode;
  }

  getEscapeFlow(): 'contour' | 'ray' { return this.escapeFlow; }

  /**
   * v8 `33.5` — does the LIVE configuration actually publish an escape scalar?
   *
   * ⚠️ **The Lab's option-hiding test reads this rather than re-deriving it (`33.D17`)**, so the UI and
   * the generator's own fallback cannot disagree about whether the driver is usable. Four readers, one
   * predicate — see `hasEscapeField`.
   */
  escapeFieldLive(): boolean {
    return !!this.attractorParams && hasEscapeField(this.attractorParams.type) && this.attractorBlend > 0;
  }

  /** v8 `33.2`/`33.3`/`34.2`/`34.3`/`34.4` — read-back for the UI's clamped/snapped values (`32.14`'s rule). */
  getSharpnessLevels(): readonly [number, number, number] { return this.sharpnessLevels; }
  getSharpnessDepth(): number { return this.sharpnessDepth; }
  getSharpnessRate(): number { return this.sharpnessRate; }
  getTravel(): readonly [number, number, number] { return this.travel; }
  getTravelDepth(): readonly [number, number, number] { return this.travelDepth; }
  getTravelRate(): readonly [number, number, number] { return this.travelRate; }
  getOffset(): readonly [number, number, number] { return this.offset; }
  getOffsetDepth(): readonly [number, number, number] { return this.offsetDepth; }
  getOffsetRate(): readonly [number, number, number] { return this.offsetRate; }
  getGrow(): readonly [number, number, number] { return this.grow; }
  getGrowDepth(): readonly [number, number, number] { return this.growDepth; }
  getGrowRate(): readonly [number, number, number] { return this.growRate; }

  /**
   * v8 `34.D9` — **the figure's live model-space Z extent**, `[min, max]`, measured in the position loop.
   *
   * ⚠️ **`[0, 0]` BEFORE THE FIRST FRAME, not `[Infinity, -Infinity]`**: the caller is a readout, and an
   * infinite extent would print a percentage of the camera depth that is about no figure at all. The
   * sentinel stays internal so *"no frame yet"* and *"a flat figure"* remain distinguishable HERE while the
   * published value is always a real interval.
   */
  getZExtent(): readonly [number, number] {
    if (!Number.isFinite(this.zMin) || !Number.isFinite(this.zMax)) return [0, 0];
    return [this.zMin, this.zMax];
  }

  /**
   * v8 `34.D9` — **the MODEL z at which `project()` culls**, i.e. where its `q = zScaled - perspectiveZ`
   * reaches 0. Negative, because `perspectiveZ` is.
   *
   * ⚠️⚠️ **IT IS CANVAS-DEPENDENT AND THAT IS INVARIANT 27's LIVE TRAP IN THIS PHASE.** Both terms move with
   * the window — `perspectiveZ = -(cw + ch)/2`, re-set in `init()` AND in `resize()`, and
   * `effectiveScale() = waveScale · viewScale` with `waveScale = uniformFit(designW, designH)` — so the
   * depth at which a particle disappears, expressed in model units, changes when the window does. **A
   * reader must recompute it on resize and may never cache it across one**, and a readout built on it must
   * name the canvas it describes, because **a preset cannot compensate for a canvas-dependent error.**
   *
   * ⚠️ **There is no perspective SWITCH to gate on** (`34.D9`'s second premise correction): the divide runs
   * unconditionally, so invariant 25's "gate the description on every early return" has no mode to attach
   * to and the gate becomes the OPERATOR's own identity — a readout must say nothing while `offsetZ` and
   * `travelZ` are both 0, or it prints a number about every preset in the library and becomes noise.
   */
  getPerspectiveCullDepth(): number {
    const s = this.effectiveScale();
    return s > 0 ? this.perspectiveZ / s : this.perspectiveZ;
  }

  /**
   * v8 `31.2` (`E112`/`E113`/`E137`) — **the three per-particle channel amounts and their shared driver,
   * all four at once**, the box-fold's shape: they are meaningless apart and nothing may go stale.
   *
   * ⚠️ **ALL THREE AT 0 IS A HARD GATE, NOT AN IDENTITY MULTIPLY.** `writeChannels()` returns `undefined`
   * there, nothing is computed, nothing is published and both passes upload their neutral pad — so a
   * preset authored before `31.2` is bit-identical and pays nothing per frame.
   *
   * ⚠️ **The amounts are clamped to ±`CHANNEL_MAX`, where the multiplier's low end reaches exactly 0.**
   * Past it the multiplier goes negative: a negative size is undefined behaviour that varies by driver,
   * and a negative lightness SUBTRACTS light in an additive renderer. The clamp lives here rather than in
   * the UI so an imported value that never passed a slider is bounded by the same constant the track is
   * drawn from.
   */
  setChannels(driver: ChannelDriver, size: number, alpha: number, light: number): void {
    this.channelDriver = driver;
    const clamp = (v: number) => {
      const n = Number.isFinite(v) ? v : 0;
      return Math.max(-CHANNEL_MAX, Math.min(CHANNEL_MAX, n));
    };
    this.channelSize = clamp(size);
    this.channelAlpha = clamp(alpha);
    this.channelLight = clamp(light);
  }

  /**
   * v8 `31.4` (`E132`) — **the 4D rotation: the fourth-axis extent and the three `w` plane angles, all
   * four at once**, the box-fold's shape.
   *
   * Angles are in TURNS, matching the twist, so the sign convention and the readout are shared. ⚠️ **The
   * extent is clamped to `[0, W_SCALE_MAX]` and the angles are NOT** — an angle wraps, so a clamp would
   * silently disagree with a Mixer blend that lerped two of them or with an imported preset, which is
   * `setPaletteHueShift`'s own argument.
   */
  setWRotation(scale: number, xw: number, yw: number, zw: number, winding: number): void {
    const f = (v: number) => (Number.isFinite(v) ? v : 0);
    this.wScale = Math.max(0, Math.min(W_SCALE_MAX, f(scale)));
    this.wAngleXW = f(xw);
    this.wAngleYW = f(yw);
    this.wAngleZW = f(zw);
    // ⚠️ ROUNDED as well as clamped: a fractional winding does not close on a closed figure and the curve
    // tears at the seam.
    this.wWinding = Math.max(1, Math.min(W_WINDING_MAX, Math.round(f(winding)) || 1));
  }

  /** The live 4D rotation, clamped as the engine is using it. */
  getWRotation(): { scale: number; xw: number; yw: number; zw: number; winding: number } {
    return {
      scale: this.wScale, xw: this.wAngleXW, yw: this.wAngleYW,
      zw: this.wAngleZW, winding: this.wWinding,
    };
  }

  /** The live channel settings, clamped as the engine is using them. */
  getChannels(): { driver: ChannelDriver; size: number; alpha: number; light: number } {
    return {
      driver: this.channelDriver, size: this.channelSize,
      alpha: this.channelAlpha, light: this.channelLight,
    };
  }

  /**
   * v8 `31.2` — **the packed `[sizeMul, alphaMul, lightMul]` triples, or `undefined` when the whole
   * feature is off.**
   *
   * ⚠️ **THE DRIVER'S TWO ARRAY SOURCES ARE LENGTH-TESTED AND DEGRADE TO `index`, NEVER TO ZEROS**
   * (`31.2`'s own clause): `getState()` publishes grow-only scratch, so `length >= count` is the test
   * invariant 7 requires — and a zeroed driver is not a safe fallback, it is a channel that silently
   * renders flat, which is invariant 13's shape. **Degrading to the one source that cannot be absent
   * keeps the control visibly alive on every preset.**
   *
   * ⚠️ **ONLY THE WAVE PARTICLES ARE DRIVEN; the tail blocks get the neutral triple.** Sparks, the liquid
   * pool and the crystals are separate populations with no curve parameter — and a crystal whose size the
   * figure's index modulated would make the pool pulse with a control that names the figure.
   */
  private writeChannels(totalCount: number): Float32Array | undefined {
    /*
     * ⚠️ **THE GATE NOW HAS A SECOND REASON TO PUBLISH: `32.3`'s energy compensation.** The three
     * per-particle amounts can all be 0 while a taper or bend is live, and the compensation has to reach
     * the renderer through this same size multiplier — so returning `undefined` on the amounts alone
     * would silently drop it. **A gate that tests only one of two producers is the defect shape this
     * comment exists to prevent.**
     */
    if (this.channelSize === 0 && this.channelAlpha === 0 && this.channelLight === 0
      && !this.deformEnergyLive) return undefined;

    const need = totalCount * 3;
    if (this.channelScratch.length < need) this.channelScratch = new Float32Array(need);
    const out = this.channelScratch;
    const n = Math.min(this.particleCount, totalCount);

    // The two array drivers, resolved ONCE rather than per particle: a per-particle test would make the
    // fallback decision data-dependent inside the loop for no gain, and this way the chosen source is a
    // single named value the clause in `deformcheck` can assert against.
    let driver = this.channelDriver;
    if (driver === 'velocity' && this.velocities.length < n) driver = 'index';
    if (driver === 'depth' && this.depths.length < n) driver = 'index';
    /*
     * v8 `33.5` — ⚠️ **the same shape as `depth` above, and resolved ONCE outside the loop for the reason
     * the existing code states: a per-particle test would make the fallback decision data-dependent inside
     * the loop for no gain.** The extra clause is `hasEscapeField`: the array is the right LENGTH on every
     * preset (it is sized with its siblings) but only MEANS anything on the two escape-time types, so a
     * length test alone would pass on `Cylinder` and drive the channels from stale zeros.
     */
    if (driver === 'escape'
      && (this.escapes.length < n
        || !this.attractorParams
        || !hasEscapeField(this.attractorParams.type)
        || this.attractorBlend <= 0)) driver = 'index';

    const aS = this.channelSize, aA = this.channelAlpha, aL = this.channelLight;
    const invN = n > 1 ? 1 / (n - 1) : 0;
    for (let i = 0; i < n; i++) {
      let d: number;
      switch (driver) {
        case 'velocity': d = this.velocities[i]!; break;
        case 'depth': d = this.depths[i]!; break;
        // v8 33.5 — already normalised to [0,1] by `advanceEscapeFlow`; the clamp below is the shared one.
        case 'escape': d = this.escapes[i]!; break;
        case 'colourPhase': {
          // The colour law's own coordinate, in TURNS, for the red channel — the same quantity both
          // branches of `writeColourAt()` compute, so "the same colour" and "the same channel value"
          // agree by construction rather than by coincidence. Wrapped, because a cycle count above 1 is
          // the normal case and clamping would flatten every particle past the first pass onto 1.
          const turns = i * invN * this.colorFreq[0]! + (this.pos * this.colorShift[0]!) / (Math.PI * 2);
          d = turns - Math.floor(turns);
          break;
        }
        default: d = i * invN; break;   // 'index'
      }
      // The driver can leave [0, 1] only if a source does (a velocity normalisation outlier); clamping
      // here is what keeps the multiplier inside the range the clamp constants were derived for.
      d = d < 0 ? 0 : d > 1 ? 1 : d;
      const two = 2 * d - 1;           // -1 .. +1, so the driver's MIDPOINT is the identity
      const o = i * 3;
      /*
       * ⚠️ **GEOMETRIC, not linear, and `CHANNEL_LOG_SPAN` carries why.** `exp(amount·span·two)` is
       * symmetric in RATIO about 1, strictly positive, and exactly 1 at amount 0 — so the identity stays
       * bit-exact while the reachable spread at amount 1 is 25x instead of the linear law's ~9x. **The
       * linear form was bounded at BOTH ends by different problems: 2x at the top, and exactly 0 (gone)
       * at the bottom, with anything wider going negative.**
       *
       * ⚠️ The size floor is kept even though the law can no longer reach 0: it is a guard on the
       * ARGUMENT as much as the result, and `estimateParticlePixels()` squares this value, so a negative
       * arriving some other way would come back positive and read as a small particle.
       */
      /*
       * ⚠️ **`32.3`'s compensation MULTIPLIES the per-particle law rather than replacing it**: the two are
       * independent quantities — one is the user's chosen spread along a driver, the other is Barr's
       * `det J` for the deformation actually applied — and a particle can legitimately have both.
       * `deformEnergyLive` is tested rather than the array's length, because the array is grow-only
       * scratch and its length outlives the feature (invariant 7).
       */
      const energy = this.deformEnergyLive ? this.deformEnergy[i]! : 1;
      out[o] = Math.max(CHANNEL_SIZE_FLOOR, Math.exp(aS * CHANNEL_LOG_SPAN * two) * energy);
      out[o + 1] = Math.exp(aA * CHANNEL_LOG_SPAN * two);
      out[o + 2] = Math.exp(aL * CHANNEL_LOG_SPAN * two);
    }
    // The tail blocks: NEUTRAL, and written every frame because the scratch is reused — a stale triple
    // from a larger previous frame would otherwise survive here and resize part of the pool.
    for (let i = n * 3; i < need; i++) out[i] = 1;
    return out.subarray(0, need);
  }

  /** The live per-axis twist in turns per half-extent. Copied — callers must not alias the internal array. */
  getTwist(): [number, number, number] {
    return [this.twist[0]!, this.twist[1]!, this.twist[2]!];
  }

  /**
   * v8 `32.1` (`E129b`) — Barr taper, one axis at a time, matching `setTwist`'s shape.
   *
   * ⚠️ **CLAMPED HERE AS WELL AS IN THE TRACK**: a hand-edited import reaches this setter without passing
   * a slider, and a factor past `TAPER_MIN_FACTOR` is an unbounded luminance rather than a big figure.
   *
   * ⚠️ **THE DEAD ZONE IS `TWIST_SNAP`, SHARED (`32.D6`) rather than a third constant** — the owner asked
   * for it on the twist because a centre-off slider is hard to return to zero, and this control has the
   * identical shape and therefore the identical problem. Three constants for one ergonomic rule is three
   * places for it to drift.
   */
  setTaper(axis: 0 | 1 | 2, amount: number): void {
    const t = Number.isFinite(amount) ? amount : 0;
    this.taper[axis] = Math.max(-TAPER_MAX, Math.min(TAPER_MAX, t));
    if (Math.abs(this.taper[axis]!) < TAPER_SNAP) this.taper[axis] = 0;
  }

  /** The live per-axis taper. Copied — callers must not alias the internal array. */
  getTaper(): [number, number, number] {
    return [this.taper[0]!, this.taper[1]!, this.taper[2]!];
  }

  /**
   * v8 `32.2` (`E129b`) — Barr bend. ⚠️ **`BEND_MAX_RATE` is the SINGULARITY bound, not a taste bound**:
   * `det J = 1 − k·u`, so a rate of 1 puts the centre of curvature inside the figure and Barr's own text
   * says the region beyond it is everted.
   */
  setBend(axis: 0 | 1 | 2, rate: number): void {
    const k = Number.isFinite(rate) ? rate : 0;
    this.bend[axis] = Math.max(-BEND_MAX_RATE, Math.min(BEND_MAX_RATE, k));
    if (Math.abs(this.bend[axis]!) < BEND_SNAP) this.bend[axis] = 0;
  }

  /** The live per-axis bend rate. Copied — callers must not alias the internal array. */
  getBend(): [number, number, number] {
    return [this.bend[0]!, this.bend[1]!, this.bend[2]!];
  }

  /**
   * v8 `32.7` (`E133`) — the 3D inversion, all three fields at once.
   *
   * **One setter for the whole operator, like `setBoxFold`**, because the three are meaningless apart: a
   * radius with no amount inverts nothing, a shell with no amount protects nothing.
   *
   * ⚠️ **`amount` 0 must stay bit-exact**, so it is clamped but never snapped: unlike the taper and bend
   * sliders this one is NOT centre-off — its off position is the left end, where a dead zone would make
   * the first usable increment arbitrary.
   */
  setInversion(amount: number, radius: number): void {
    const a = Number.isFinite(amount) ? amount : 0;
    const r = Number.isFinite(radius) ? radius : 1;
    this.invertAmount = Math.max(0, Math.min(1, a));
    this.invertRadius = Math.max(INVERT_RADIUS_MIN, Math.min(INVERT_RADIUS_MAX, r));
  }

  /** The live inversion fields. */
  getInversion(): { amount: number; radius: number } {
    return { amount: this.invertAmount, radius: this.invertRadius };
  }

  /**
   * v8 `30.2` (`E130`) — the box-fold, all four fields at once.
   *
   * **One setter for the whole operator, like `setSymmetry`, rather than four** — the four are meaningless
   * apart (a limit with no iterations folds nothing, a scale with no iterations scales nothing), and one
   * call site cannot leave three of them stale.
   *
   * ⚠️ **CLAMPED HERE AS WELL AS IN THE TRACKS**: a hand-edited import reaches this setter without passing
   * a slider, and an unbounded iteration count is a loop whose Lipschitz bound grows geometrically
   * (`BOX_FOLD_MAX_ITERATIONS`' own header). `iterations` is also ROUNDED — there is no figure between one
   * fold and two, which is the same argument that makes it snap in the Mixer (`30.D12`).
   */
  setBoxFold(iterations: number, limit: number, scale: number): void {
    const n = Number.isFinite(iterations) ? Math.round(iterations) : 0;
    this.boxFoldIterations = Math.max(0, Math.min(BOX_FOLD_MAX_ITERATIONS, n));
    const l = Number.isFinite(limit) ? limit : BOX_FOLD_DEFAULT_LIMIT;
    this.boxFoldLimit = Math.max(BOX_FOLD_MIN_LIMIT, Math.min(1, l));
    const s = Number.isFinite(scale) ? scale : 1;
    this.boxFoldScale = Math.max(BOX_FOLD_MIN_SCALE, Math.min(BOX_FOLD_MAX_SCALE, s));
  }

  /** The live box-fold settings. Read by the Visual FX descriptors and by `30.10`'s measurement. */
  getBoxFold(): { iterations: number; limit: number; scale: number } {
    return { iterations: this.boxFoldIterations, limit: this.boxFoldLimit, scale: this.boxFoldScale };
  }

  /**
   * v8 Phase 38 — the Fractal Fold's three bases, one setter (they are meaningless apart, as the box fold's are).
   *
   * ⚠️ **CLAMPED AND SNAPPED HERE**, because a hand-edited import reaches this setter without passing a slider:
   * `iterations` is rounded into `0 … FRACTAL_FOLD_MAX_ITERATIONS`, the cell clamped into its range, and the
   * scale clamped and SNAPPED to exactly 0 inside its dead zone (`38.D9`) — the panel must re-read the result
   * (`32.14`: a snap nobody can see does not exist).
   */
  setFractalFold(iterations: number, limit: number, scale: number): void {
    const n = Number.isFinite(iterations) ? Math.round(iterations) : 0;
    this.fractalFoldIterations = Math.max(0, Math.min(FRACTAL_FOLD_MAX_ITERATIONS, n));
    const l = Number.isFinite(limit) ? limit : FRACTAL_FOLD_DEFAULT_LIMIT;
    this.fractalFoldLimit = Math.max(FRACTAL_FOLD_MIN_LIMIT, Math.min(FRACTAL_FOLD_MAX_LIMIT, l));
    const s = Number.isFinite(scale) ? scale : FRACTAL_FOLD_DEFAULT_SCALE;
    const sc = Math.max(-FRACTAL_FOLD_MAX_SCALE, Math.min(FRACTAL_FOLD_MAX_SCALE, s));
    this.fractalFoldScale = Math.abs(sc) < FRACTAL_FOLD_SCALE_SNAP ? 0 : sc;
  }

  /** v8 Phase 38 — the breathing of the cell and the scale (`38.D4`): signed depths with dead zones, shared rates. */
  setFractalFoldBreath(limitDepth: number, limitRate: number, scaleDepth: number, scaleRate: number): void {
    const ld = Number.isFinite(limitDepth) ? limitDepth : 0;
    this.fractalFoldLimitDepth = Math.max(-FRACTAL_FOLD_LIMIT_DEPTH_MAX, Math.min(FRACTAL_FOLD_LIMIT_DEPTH_MAX, ld));
    if (Math.abs(this.fractalFoldLimitDepth) < FRACTAL_FOLD_LIMIT_DEPTH_SNAP) this.fractalFoldLimitDepth = 0;
    this.fractalFoldLimitRate = this.clampRate(limitRate);
    const sd = Number.isFinite(scaleDepth) ? scaleDepth : 0;
    this.fractalFoldScaleDepth = Math.max(-FRACTAL_FOLD_SCALE_DEPTH_MAX, Math.min(FRACTAL_FOLD_SCALE_DEPTH_MAX, sd));
    if (Math.abs(this.fractalFoldScaleDepth) < FRACTAL_FOLD_SCALE_DEPTH_SNAP) this.fractalFoldScaleDepth = 0;
    this.fractalFoldScaleRate = this.clampRate(scaleRate);
  }

  /** The live Fractal Fold settings, as the ENGINE took them — what the panel re-reads after a set. */
  getFractalFold(): {
    iterations: number; limit: number; scale: number;
    limitDepth: number; limitRate: number; scaleDepth: number; scaleRate: number;
  } {
    return {
      iterations: this.fractalFoldIterations, limit: this.fractalFoldLimit, scale: this.fractalFoldScale,
      limitDepth: this.fractalFoldLimitDepth, limitRate: this.fractalFoldLimitRate,
      scaleDepth: this.fractalFoldScaleDepth, scaleRate: this.fractalFoldScaleRate,
    };
  }

  /**
   * v8 17.2 — the integration phase, for `?testhook=1` ONLY.
   *
   * ⚠️ **THIS IS THE ONE PIECE OF STATE THAT SEPARATES "THE FIGURE IS EDITED" FROM "THE FIGURE IS RUNNING",
   * AND NO OTHER PUBLISHED VALUE CAN STAND IN FOR IT.** `getState().positions` moves for a dozen reasons
   * (rotation, curl noise, the fluid field, an attractor blend), so a harness watching positions cannot tell a
   * live integrator from a frozen one being pushed around by a post-processor. `pos` advances if and only if
   * `update()` ran, which is exactly the question invariant 22 exists about — a single throw ended the loop for
   * a whole session, and the symptom was a picture that still looked plausible.
   *
   * ⚠️ **READ-ONLY BY CONSTRUCTION, AND THAT IS THE POINT RATHER THAN A COURTESY.** `pos` stays `private`; this
   * returns a number. A setter would be a second writer of the integration clock, and `setWaves`' own comment
   * records why `init()` is the wrong call precisely because it resets `pos`. **Do not add one, and do not
   * widen this to return the whole internal wave table** — `composercheck` §B already owns the rule that the
   * internal pad-to-`MAX_WAVES` must never escape this class.
   *
   * ⚠️ **NOT the deleted `getPositionsForFluidSeed()` shape.** That accessor was dead because its ONE plausible
   * consumer wanted different data (see the note above `uniformFit`); this one has a named caller in
   * `main.ts`'s `installTestHook()` and is reachable only under a URL guard, so `deadcheck` sees a live call
   * site. **If that guard is ever removed, this becomes a public accessor on the shipped path — which is the
   * thing `?gldiag=1`'s rules forbid.**
   */
  getPos(): number {
    return this.pos;
  }

  /**
   * Advance the wave phase by `frames` main-loop frames WITHOUT computing a figure — **the analytic half of a
   * warm-up** (2026-09-25).
   *
   * ⚠️ **THIS IS NOT THE SETTER `getPos()` FORBIDS, AND THE DIFFERENCE IS THE WHOLE JUSTIFICATION.** A caller
   * cannot choose `pos`, cannot rewind it and cannot reset it: the only thing on offer is the same monotone
   * `pos += waveSpeed * frames` that `update()` performs, with the arithmetic still owned by this class
   * (invariant 17 — one resolution order, one writer of the resolved value). What the note above `getPos()`
   * rules out is a second *owner* of the clock; this is the same owner reached by a second verb.
   *
   * ⚠️ **THE ROTATION POSE IS ADVANCED TOO, AND LEAVING IT OUT WAS MEASURABLY WRONG** (2026-09-25). `update()`
   * accumulates `angle[i] += rotationSpeed[i] * (dt / 1000)`, which is linear in `dt` and so jumps exactly like
   * `pos` does — three additions. The first draft of this method moved `pos` alone, and comparing "jump 38 +
   * 2 real updates" against "40 real updates" over all 177 library presets gave a worst relative position
   * difference of **1.39 of the figure's own extent** (`Dancing Rays`), with every one of the 140 rotating
   * presets divergent and all 37 non-rotating ones bit-exact — i.e. the residual was ENTIRELY the missing
   * pose, and it read as "the thumbnail shows the figure at the wrong angle" rather than as anything
   * recognisable as a warm-up bug. With the three additions below, all 177 are bit-exact (0.00e+0).
   *
   * ⚠️ **`* 0.016667` is `dt / 1000` at the nominal frame, the same `16.667` ms this file's `dtScale` and stall
   * clamp are written against.** It is the ONE place the two accumulations' units meet: `pos` counts frames of
   * `waveSpeed` while `angle` counts SECONDS of degrees-per-second, so a single `frames` argument has to be
   * converted for one of them and not the other (invariant 10 — check the unit of the RESULT). Dropping the
   * factor would advance the pose by 60x.
   *
   * ⚠️ **It is correct ONLY because the figure is an analytic function of `pos`.** `update()` reads
   * `scaledTime = this.pos` and computes `am`/`fm` through `calcWaveParam(axis, scaledTime)` and then
   * `v = sin((n + phase) * fm) * am` — no term carries over from the previous call, so one jump of N frames
   * lands on exactly the figure the Nth successive `update(16.667)` would have produced (to within the last
   * bits, a sum of N additions against one multiplication). **Everything INTEGRATED is a different matter and
   * is deliberately NOT advanced here**: the material processor's temperatures, the crystal pool, the spark
   * pool and `prevPositions`/`velocities` all stay where they were, so a caller that needs any of them must
   * follow this with real `update()` calls — the preview grid takes two, which is the minimum that makes
   * `velocities` a true one-frame delta rather than a difference against a zeroed `prevPositions`. **Never use
   * this to replace frames whose integration matters**, and note the discriminator: `pos` and `angle` qualify
   * because their increment does not depend on their own value, which is exactly what the pools and the
   * temperature field cannot say.
   *
   * ⚠️ **No `Math.min(…, 6.0)` clamp, unlike `update()`'s, and that is not an oversight.** There the clamp
   * stops a stalled frame from teleporting the figure; here the jump IS the intent, and clamping it would make
   * a 40-frame warm-up silently deliver 6.
   */
  advancePhase(frames: number): void {
    if (!Number.isFinite(frames) || frames <= 0) return;
    this.pos += this.waveSpeed * frames;
    const rotFactor = frames * 0.016667;
    this.angle[0]! += this.rotationSpeed[0]! * rotFactor;
    this.angle[1]! += this.rotationSpeed[1]! * rotFactor;
    this.angle[2]! += this.rotationSpeed[2]! * rotFactor;
  }

  /** Total model→screen factor: uniform canvas fit × the user's figure scale. */
  private effectiveScale(): number {
    return this.waveScale * this.viewScale;
  }

  /**
   * `project()`'s perspective factor, POSITIVE, for a z that has already been multiplied by
   * `effectiveScale()`. The physarum deposit's only 3D term — see the units paragraph in `update()`.
   *
   * ⚠️ **There is no mirror, and the sign is the trap.** `project()` writes `origin - x * (perspZ / q)`
   * with `perspectiveZ` NEGATIVE (`-(w + h) / 2`), so `perspZ / q` is about **-1** near z 0 and the
   * visible factor is `-perspZ / q`: model +x is screen +x. Returning the positive form is what lets the
   * deposit site read as `0.5 + model * scale * factor` and be checked against `project()` by eye.
   *
   * ⚠️ **Clamped at BOTH ends because the physarum inverse divides by this.** A particle at or behind the
   * camera (`q <= 0`, which `project()` answers with `CULL_SENTINEL`) would otherwise turn one steering
   * step into an unbounded model displacement, and that arrives as a permanent off-frame particle rather
   * than as a visible glitch. The bounds are deliberately wide: at the shipped `perspectiveZ` a figure
   * would have to reach ±19 canvas-diagonals of depth to touch either one.
   */
  private perspectiveFactor(zScaled: number): number {
    const MIN = 0.05, MAX = 20;
    const q = zScaled - this.perspectiveZ;
    if (!(q > 0)) return MIN;
    return Math.min(MAX, Math.max(MIN, -this.perspectiveZ / q));
  }

  private calcWaveParam(wp: { base: number; amp: number; freq: number }, time: number): number {
    return wp.base + Math.sin(time * wp.freq / DEG) * wp.amp;
  }

  /**
   * v8 `34.4` — **the FIGURE OPERATORS' breathing**: `base + sin(pos · rate / DEG) · depth`, resolved ONCE
   * PER FRAME for each of the eleven breathing quantities and never per particle.
   *
   * ⚠️⚠️ **IT IS THE SAME ARITHMETIC AS `calcWaveParam` ABOVE AND IT IS DELIBERATELY A SECOND FUNCTION
   * RATHER THAN A SHARED ONE — because of the `depth === 0` SKIP, which the other must not have.** Here the
   * skip is load-bearing: `base + sin(x)·0` is `base` for every finite base **except `-0`**, and these
   * operators sit on the identity of all 314 presets, so the identity must be bit-exact and not merely
   * equal. `calcWaveParam` CANNOT take the same skip, and that is measured rather than assumed: `am.amp`
   * is 0 on most slot-axes, so adding the branch there would change which of `+0`/`-0` a zero-amplitude
   * axis contributes, and `-0 + -0` is `-0` while `-0 + 0` is `+0`. **One expression, two quantities, two
   * bit-exactness obligations pointing opposite ways** — do not "tidy" them together.
   *
   * ⚠️ **The temporal function stays SINUSOIDAL and must never take the `Sharpness` blend.** A triangle
   * here would make the breathing's own motion piecewise-linear, which is a different control nobody asked
   * for and which would make the dwell indistinguishable from the ramp.
   *
   * ⚠️ **It does NOT clamp** — the caller clamps the resolved value against the operator's own range,
   * because the clamp bound differs per operator and because `SHARPNESS_DEPTH_MAX`'s header records WHY the
   * resolved value is what gets clamped rather than the depth against the base.
   */
  private modulateOp(base: number, depth: number, rate: number, time: number): number {
    if (depth === 0) return base;
    return base + Math.sin(time * rate / DEG) * depth;
  }

  /**
   * v8 `34.4` — `modulateOp` plus the operator's own clamp. **The clamp is on the RESOLVED value**, which is
   * what produces the dwell; see the per-frame block in `update()`.
   *
   * ⚠️⚠️ **AT `depth === 0` THE BASE IS RETURNED WITHOUT PASSING THROUGH THE CLAMP, AND THAT IS REQUIRED
   * RATHER THAN SLOPPY.** Every setter already clamps its own base to the same range, so a clamp here would
   * be a second owner of one bound — **and the clamp is not sign-of-zero preserving where `lo` is 0**:
   * `Math.max(0, -0)` is `+0` by specification, so a base of `-0` would come back as `+0` and the
   * bit-exactness every identity argument in this phase rests on would hold for ten of the eleven
   * quantities and silently fail for `Sharpness`, whose `lo` IS 0. **Branch, never weight — and never clamp
   * an identity either.**
   */
  private resolveOp(
    base: number, depth: number, rate: number, time: number, lo: number, hi: number,
  ): number {
    if (depth === 0) return base;
    const v = this.modulateOp(base, depth, rate, time);
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * v8 `34.4` — `resolveOp` over a per-axis TRIPLE, written into a caller-owned scratch.
   *
   * ⚠️ **The scratch is a field rather than a fresh array, because this runs once per frame per operator and
   * invariant 8 is about the allocation RATE** — three arrays a frame is 180 a second, which reaches the user
   * as a jitter every few seconds rather than as a cost anyone attributes to a figure operator.
   */
  private opTriple(
    base: readonly number[], depth: readonly number[], rate: readonly number[],
    time: number, lo: number, hi: number, out: [number, number, number],
  ): [number, number, number] {
    out[0] = this.resolveOp(base[0]!, depth[0]!, rate[0]!, time, lo, hi);
    out[1] = this.resolveOp(base[1]!, depth[1]!, rate[1]!, time, lo, hi);
    out[2] = this.resolveOp(base[2]!, depth[2]!, rate[2]!, time, lo, hi);
    return out;
  }

  /* v8 `34.4` — the four per-frame resolution scratches. See `opTriple`. */
  private sharpScratch: [number, number, number] = [0, 0, 0];
  private twScratch: [number, number, number] = [0, 0, 0];
  private offScratch: [number, number, number] = [0, 0, 0];
  private gwScratch: [number, number, number] = [0, 0, 0];

  update(dt: number): void {
    const scaledTime = this.pos;

    // Calculate effective AM, FM, Phase for each wave/axis
    const am: number[][] = [];
    const fm: number[][] = [];
    const ph: number[][] = [];

    for (let t = 0; t < MAX_WAVES; t++) {
      am.push([0, 0, 0]);
      fm.push([0, 0, 0]);
      ph.push([0, 0, 0]);
      const wave = this.waves[t];
      if (!wave) continue;
      for (let q = 0; q < AXES; q++) {
        const axis = wave[q]!;
        am[t]![q] = this.calcWaveParam(axis.am, scaledTime);
        fm[t]![q] = this.calcWaveParam(axis.fm, scaledTime) / DEG;
        ph[t]![q] = axis.phase;
      }
    }

    const cStep = 360 / this.particleCount;

    // v8 Phase 8a-3: NO wave particle is ever frozen — crystals are separate pool slots. Every
    // "skip frozen" guard in this method has therefore been retired; the wave loop is back to its
    // pre-8a form.
    // Generate particle positions in 3D (same as legacy calcWave)
    /*
     * ⚠️ **`n` IS PURELY SPATIAL AND THAT IS WORTH STATING BECAUSE A FEATURE WAS BUILT ON THE OPPOSITE
     * ASSUMPTION AND REMOVED.** It is the per-particle phase, `i * cStep` across the whole population, and
     * every particle exists SIMULTANEOUSLY as a point along one curve. **Time enters only through `pos`,
     * which modulates the `am`/`fm` envelopes** — see `jumpFrames`' header.
     *
     * ⚠️ **`E136` (`30.3`, `Spacing`) reparameterised this phase to redistribute sample density, shipped,
     * and was DROPPED on the owner's visual review (2026-10-25): "no visual effect ... marginal effect is
     * not worth having this setting".** `democheck` had measured it at **0.43x its host's own drift, the
     * weakest of the ten demos**, which is the number that should have been read as a verdict rather than
     * as a demo-hosting problem. ⚠️ **Its own specification also claimed *"timing and tone from one
     * function"* and the TIMING half never existed here** — there is no per-element clock for a monotone
     * reparameterisation to attach to, which was re-derived before implementing and recorded then.
     * **Do not re-propose a sampling control without a visual argument that survives a sparse preset.**
     */
    /*
     * v8 `33.2`/`33.3`, re-pointed by `34.1` — the basis and the secular term, both hoisted OUT of the
     * particle loop and both evaluated by `core/wave-law.ts`.
     *
     * ⚠️⚠️ **`sumWaveAxes` AND `applyTravel` ARE THE SHARED OWNERS AND THE SHARING IS THE FIX.** Phase 33
     * added `Sharpness` and `Travel` here and nowhere else, so the Composer's Score — the diagram an author
     * reads *while authoring* — drew a figure this loop does not render on any preset carrying either value.
     * **Read `wave-law.ts`'s headers before changing anything about the basis**: the three-case branch is a
     * measured bug fix (an earlier draft called `Math.sin` twice and made the faceted basis 2× *more*
     * expensive than the smooth one), `sharp === 0` is a branch rather than a zero weight because `x + 0*tri`
     * is wrong at `-0`, and the per-axis travel gate is what `mixercheck`'s allowlist rests on.
     *
     * ⚠️ `pt` is a hoisted 3-element scratch: the law writes the point in place, so the innermost loop of the
     * hottest function in the engine allocates nothing (invariant 8 is about RATE).
     */
    /*
     * v8 `34.4` — **the eleven breathing quantities, resolved ONCE PER FRAME and never per particle**, and
     * their resolved values CLAMPED to their own ranges.
     *
     * ⚠️⚠️ **THE CLAMP IS ON THE RESOLVED VALUE, WHICH PRODUCES A DWELL AT EACH BOUND — AND THE DWELL IS A
     * FEATURE.** `SHARPNESS_DEPTH_MAX`'s header owns the derivation: constraining the UI so `base ± depth`
     * stays in range would make a depth slider's maximum depend on a base slider's value, i.e. two
     * interdependent controls for one quantity. A clamped cycle therefore *dwells* at the bound rather than
     * passing through it — crystallise, hold, melt, hold — **and every one of the four readouts says
     * `(clipped)` while it does**, or the next reader removes the clamp as a stuck slider.
     *
     * ⚠️ **`modulateOp` SKIPS ITSELF ENTIRELY AT `depth === 0`** rather than adding `sin(x)·0`, which is what
     * earns the twenty depth and rate keys their place in `UNCONDITIONAL_KEYS` on the STRONG claim (*the code
     * does not execute*) — see its header for why `calcWaveParam` must NOT take the same skip.
     */
    const sharp = this.sharpScratch;
    for (let t = 0; t < 3; t++) {
      sharp[t] = this.resolveOp(this.sharpnessLevels[t]!, this.sharpnessDepth, this.sharpnessRate,
        scaledTime, 0, SHARPNESS_MAX);
    }
    const tw = this.opTriple(this.travel, this.travelDepth, this.travelRate, scaledTime,
      -TRAVEL_MAX, TRAVEL_MAX, this.twScratch);
    const off = this.opTriple(this.offset, this.offsetDepth, this.offsetRate, scaledTime,
      -OFFSET_MAX, OFFSET_MAX, this.offScratch);
    const gw = this.opTriple(this.grow, this.growDepth, this.growRate, scaledTime,
      GROW_FLOOR, GROW_MAX, this.gwScratch);
    const hasTravel = tw[0] !== 0 || tw[1] !== 0 || tw[2] !== 0;
    const hasOffset = off[0] !== 0 || off[1] !== 0 || off[2] !== 0;
    const hasGrow = gw[0] !== 0 || gw[1] !== 0 || gw[2] !== 0;
    // The secular term is a fraction of the design HALF-extent, spread across the whole population, so it
    // is resolved here once rather than per particle. `invCount` turns the index into [0,1).
    const halfExtent = Math.min(this.designW, this.designH) * 0.5;
    const invCount = this.particleCount > 0 ? 1 / this.particleCount : 0;
    const pt: number[] = [0, 0, 0];
    // v8 `34.D9` — the Z extent, re-measured from scratch every frame. See `getZExtent()`.
    let zLo = Infinity, zHi = -Infinity;

    /*
     * v8 `36.10` — **THE FIGURE SOURCE. Resolved ONCE, OUTSIDE the loop, into a buffer.**
     *
     * ⚠️⚠️ **THE WAVE PATH BELOW IS BIT-IDENTICAL TO THE PRE-`36.10` CODE, AND THAT IS THE STEP'S WHOLE
     * CORRECTNESS CLAIM** — `36.20` clause 2 holds the entire library to it. So the seam is a NULL CHECK
     * hoisted out of the loop, not a per-particle `FigureSource` call: `wave-law.ts`' header records that
     * routing nine per-particle evaluations through a function measured a **2.1x regression** because V8
     * does not inline across them, and this loop is the same hot path. ⚠️ **If the one remaining branch
     * ever measures badly the remedy is TWO loops sharing the operator stages — not an indirection.**
     *
     * ⚠️ The curve arrives normalised to [-1,1] and is scaled by a FRACTION of the design box, which is
     * `ATTRACTOR_DESIGN_FRACTION`'s convention and for its reason (`36.7`): an absolute extent is right
     * for a 100x100 design box and 6.8x too small for a 960x720 one.
     */
    let lsysPts: Float64Array | null = null;
    let lsysFit = 0;
    if (this.figureType === 'lsystem' && this.lsystem !== null) {
      const cfg = this.lsystem;
      /*
       * v8 `39.C` — THE ONE RESOLVER (`resolveCustomRule`, spec §3.4): a named rule, a `Customize` generator that
       * equals one (resolved to THAT rule — the no-op), or a genuinely custom generator with its own ranges.
       */
      const resolved = resolveCustomRule(cfg);
      const custom = resolved.kind === 'custom' ? resolved : null;
      const rule = resolved.kind === 'named' ? resolved.rule : LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE];
      const recRange: readonly [number, number] = custom !== null ? [1, custom.maxDepth] : rule.recursionRange;
      const yawRange: readonly [number, number] = custom !== null ? CUSTOM_RANGES.yaw : rule.angleRange;
      const pitchRange: readonly [number, number] = custom !== null ? CUSTOM_RANGES.pitch : rule.angleRange;
      if (this.lsysPoints.length < this.particleCount * 3) {
        this.lsysPoints = new Float64Array(this.particleCount * 3);
      }
      // The five modulated parameters go through the SHIPPED operator law (`36.D6`) -- no new law, and
      // `resolveOp`'s `depth === 0` branch is what makes a preset authoring only bases bit-exact.
      const recursion = this.resolveOp(cfg.recursion.base, cfg.recursion.amplitude, cfg.recursion.frequency,
        scaledTime, recRange[0], recRange[1]);
      const yaw = this.resolveOp(cfg.yaw.base, cfg.yaw.amplitude, cfg.yaw.frequency,
        scaledTime, yawRange[0], yawRange[1]);
      const pitch = this.resolveOp(cfg.pitch.base, cfg.pitch.amplitude, cfg.pitch.frequency,
        scaledTime, pitchRange[0], pitchRange[1]);
      const roll = this.resolveOp(cfg.roll.base, cfg.roll.amplitude, cfg.roll.frequency,
        scaledTime, rule.angleRange[0], rule.angleRange[1]);
      const lsysPose = {
        rule, recursion, yaw, pitch, roll,
        // ⚠️ `multiAxis` selects the bracket width and the two differ by 5x on `Hilbert 3D`, so it must
        // read whether pitch or roll is BREATHING -- not whether the rule uses those axes.
        multiAxis: cfg.pitch.amplitude !== 0 || cfg.roll.amplitude !== 0,
        smoothness: Math.max(0, Math.min(1, cfg.smoothness)),
        // ⚠️ `descend` is resolved through the SAME operator law as the angles (`36.D6`), and its
        // bounds are geometric -- see `DESCEND_MIN`/`DESCEND_MAX`.
        descend: this.resolveOp(cfg.descend.base, cfg.descend.amplitude, cfg.descend.frequency,
          scaledTime, DESCEND_MIN, DESCEND_MAX),
        centre: cfg.centre,
        /*
         * v8 `39.A3`/`39.A4` — the generator axes, through the SAME operator law and clamped to the RULE's own
         * range. ⚠️ Both keys are optional and read at their IDENTITY (`twist ?? 0`, `stretch ?? 1`), and a
         * rule with no twistable/stretchable copy ignores them entirely, so a preset that predates Phase 39
         * resolves exactly as before. "Animated" is a non-zero modulation amplitude, the `multiAxis` rule.
         */
        ...this.resolveGeneratorAxes(cfg, rule.key as RuleKey, scaledTime, resolved),
        custom: custom !== null ? { gen: custom.gen, tile: custom.tile, maxDepth: custom.maxDepth } : null,
      };
      /*
       * v8 CPU pass (B) — **an UNCHANGED curve is not rebuilt.** The figure is a pure function of these resolved inputs
       * (the rule, the four angles and the recursion after breathing, the descend, the smoothness, the centre, the
       * generator axes, and the custom generator BY IDENTITY — `resolveCustomRule` memoises by identity), so equal
       * inputs give the points already in `lsysPoints`. A still curve skips the whole build; a breathing one builds as
       * before. The key is compared by VALUE (numbers print exactly), the custom generator by reference.
       */
      const { rule: _r, custom: _c, ...scalars } = lsysPose;
      const lsysKey = `${this.particleCount}|${rule.key}|${JSON.stringify(scalars)}`;
      const lsysGen = custom !== null ? custom.gen : null;
      if (lsysKey !== this.lsysLastKey || lsysGen !== this.lsysLastGen) {
        resolveFigure(this.lsysCache, lsysPose, this.lsysPoints, this.particleCount);
        this.lsysLastKey = lsysKey;
        this.lsysLastGen = lsysGen;
      }
      lsysPts = this.lsysPoints;
      lsysFit = LSYSTEM_DESIGN_FRACTION * Math.min(this.designW, this.designH);
    }

    // v8 CPU pass (C) — the wave sum for the WHOLE figure at once (`sumWaveAxesBulk`: a rotation recurrence instead of
    // nine `Math.sin` per particle, re-anchored every 32). The Score keeps the exact per-particle `sumWaveAxes`.
    let waveBuf: Float64Array | null = null;
    if (lsysPts === null) {
      if (this.waveBuf.length < this.particleCount * 3) this.waveBuf = new Float64Array(this.particleCount * 3);
      waveBuf = this.waveBuf;
      sumWaveAxesBulk(waveBuf, this.particleCount, cStep, am, fm, ph, sharp);
    }
    for (let i = 0; i < this.particleCount; i++) {
      const tau = i * invCount;
      if (lsysPts !== null) {
        const b = i * 3;
        pt[0] = lsysPts[b]! * lsysFit;
        pt[1] = lsysPts[b + 1]! * lsysFit;
        pt[2] = lsysPts[b + 2]! * lsysFit;
      } else {
        const b = i * 3;
        pt[0] = waveBuf![b]!;
        pt[1] = waveBuf![b + 1]!;
        pt[2] = waveBuf![b + 2]!;
      }
      /*
       * v8 `34.3` — **STAGE A: `Grow`, and it MUST be here, on the wave sum ALONE.** Downstream of either
       * stage below it would ramp the secular term and the DC term too — a quadratic sweep and a ramped
       * translation, two operators nobody specified. **`applyGrow`'s header owns that argument and it is
       * the one ordering CONTRACT these two operators add.**
       */
      if (hasGrow) applyGrow(pt, tau, gw);
      /*
       * v8 `33.3` — the secular term. ⚠️ **ADDED AFTER THE WAVE SUM AND BEFORE EVERY OPERATOR**, so the
       * deformers downstream see the travelled position and a twist of a helix is a twisted helix rather
       * than a twisted loop that is then slid. That ordering is a choice and it is the one that composes:
       * the alternative (travel last) would translate an already-deformed figure, which no operator needs.
       */
      if (hasTravel) applyTravel(pt, tau, tw, halfExtent);
      /*
       * v8 `34.2` — **STAGE C: `Offset`.** ⚠️ **It COMMUTES EXACTLY with the travel above** — two additions
       * into the same accumulator — **so the written order is NOT a contract and must not be read as one.**
       * Say so here, because the stage above it and the stage above that both are contracts.
       */
      if (hasOffset) applyOffset(pt, off, halfExtent);

      const idx = i * 3;
      this.positions[idx] = pt[0]!;
      this.positions[idx + 1] = pt[1]!;
      this.positions[idx + 2] = pt[2]!;
      /*
       * v8 `34.D9` — two compares, in the one loop that already writes `positions`, which is the only place
       * this measurement is free. ⚠️ **It is the MODEL z, taken BEFORE the rotation overwrites the array
       * with screen coordinates** — the readout compares it against `getPerspectiveCullDepth()`, which is
       * also in model units, and taking it after the projection would compare two different quantities
       * wearing one name (invariant 24).
       */
      const z = pt[2]!;
      if (z < zLo) zLo = z;
      if (z > zHi) zHi = z;
    }
    this.zMin = zLo;
    this.zMax = zHi;

    // Attractor blending in model space (before rotation/projection — matches legacy)
    if (this.attractorState && this.attractorParams && this.attractorBlend > 0) {
      // `dt` is in ms; `speedFactor` has already been folded into it by the caller (`main.ts` multiplies
      // the frame delta before calling `update`), so normalising by 16.667 yields exactly the `dtScale`
      // contract documented on `iterateAttractor`: 1.0 at 60 fps with the slider centred.
      const dtScale = dt > 0 ? dt / 16.667 : 1;
      // v8 Phase 37 — the STRAND layout, on a type that has a trajectory to order (`STRAND_CAPABLE`). Its two
      // breathing scalars resolve ONCE per frame through the shipped operator law (`37.D4`), outside the loop.
      // Everywhere else — and always on the cloud layout — the cloud path runs exactly as before.
      if (this.strandLayout === 'strand' && STRAND_CAPABLE[this.attractorParams.type]) {
        const f = this.strandFrame;
        f.span = this.resolveOp(this.strandSpan, this.strandSpanDepth, this.strandSpanRate, scaledTime,
          STRAND_SPAN_MIN, STRAND_SPAN_MAX);
        f.advance = this.resolveOp(this.strandAdvance, this.strandAdvanceDepth, this.strandAdvanceRate, scaledTime,
          STRAND_ADVANCE_MIN, STRAND_ADVANCE_MAX);
        // The buffer is laid at the BASE span and sized for the breathing's TOP; the breathing RE-READS it.
        const b = this.strandBase;
        b.span = this.strandSpan;
        b.advance = f.advance;
        b.spanTop = Math.min(STRAND_SPAN_MAX, this.strandSpan + this.strandSpanDepth);
        if (this.strand === null) {
          // A tile hands its tier and (for the centre) the attractor state it already warmed — no second bank.
          this.strand = new AttractorStrand(this.attractorParams, this.particleCount, b,
            this.attractorTier ? { tier: this.attractorTier, bank: this.attractorState } : undefined);
        }
        this.strand.step(b, dtScale, this.attractorX, this.attractorY, this.attractorZ, this.particleCount);
        if (f.span !== b.span) this.strand.fill(f.span, this.attractorX, this.attractorY, this.attractorZ, this.particleCount);
      } else {
        iterateAttractor(
          this.attractorState, this.attractorParams,
          this.attractorX, this.attractorY, this.attractorZ,
          dtScale,
          // v8 33.4/33.5 — both optional, so a non-escape type ignores them entirely. The tile tier's smaller
          // escape grid rides the same options object; absent (the main view) it is the 512² grid.
          { escapeFlow: this.escapeFlow, outEscape: this.escapes,
            ...(this.attractorTier?.gridSize !== undefined ? { gridSize: this.attractorTier.gridSize } : {}) },
        );
      }

      const blend = this.attractorBlend;
      const invBlend = 1 - blend;

      // --- One UNIFORM model-space fit for every attractor type (2026-08-13) ---
      //
      // ⚠️ **Two independent units errors lived in the code this replaced, and both are the same class of
      // mistake this file already fixed once for the waves.**
      //
      // **(1) Per-axis scaling stretched every attractor by the canvas aspect ratio.** The old table used
      // separate `w / k` and `h / k` divisors, so an attractor whose true shape is round was drawn
      // **1.333× wider than tall** at 1024×768 — regardless of preset. That is precisely the defect
      // `uniformFit()` was introduced to fix for wave amplitudes on 2026-08-06 ("distorted any preset
      // whenever the canvas aspect differed from the authored aspect"); the attractor path simply never
      // received it. It is what the user described as "flat 2D attractors put on a plane in space, which
      // distorts them" — the distortion is in-plane, not a projection artefact, which is why it survived
      // `attractZ = 0` already being set for julia/mandelbrot.
      //
      // **(2) The canvas fit was applied TWICE.** These values are model-space, and `project()` then
      // multiplies by `effectiveScale() = waveScale × viewScale`. So the old `w / 4` was compounded by
      // `waveScale`, which is **7.68** for every one of the 177 legacy presets (`migration.ts` defaults
      // `designResolution` to 100×100) and 9.60 for `Miracle Frost`. Measured oversize on a legacy preset:
      // clifford **7.7×**, julia **11.0×**, thomas **12.8×** — and still 1.5–2.6× oversize with Figure
      // Scale wound all the way down to 0.2. That is the "too large, and only visible fully downscaled"
      // report, and it also explains why the constants looked plausible: they were evidently tuned on a
      // 960×720 preset, where `waveScale` is 1.067 and the double application is nearly invisible.
      //
      // **(3) The FIRST fix for (2) over-corrected by 40.5×, and it was the same units mistake again
      // (V7b, 2026-08-13).** It read
      //
      //     uniformFit(EXTENT * 2, EXTENT * 2) / this.waveScale
      //
      // `uniformFit()` returns **px per model unit**; so does `waveScale`. Dividing one by the other yields
      // a DIMENSIONLESS ratio (1.111 on a legacy preset at 1024×768) where a MODEL-UNIT EXTENT was needed —
      // so the attractor half-extent was 1.111 units, projecting to 8.5 px against a 384 px half-frame.
      // Reported as "now everything is tiny, even scaling it 5x is still too small", and 5× indeed cannot
      // reach it: the shortfall is 40.5×.
      //
      // The correct form needs no `uniformFit` at all. This value is consumed in MODEL space and `project()`
      // supplies the canvas fit afterwards, so the extent is simply a fraction of the preset's own design
      // box — see `ATTRACTOR_DESIGN_FRACTION` for why a fraction and not an absolute constant. Both of the
      // original errors stay fixed: it is a single scalar (no aspect stretch) and it is applied once (no
      // double fit), leaving `viewScale` — the Figure Scale slider — as the user's single meaningful control
      // over attractor size, exactly as it is for the waves.
      //
      // ⚠️ The lesson is the one this file keeps re-learning: **check the UNITS of the result, not the
      // plausibility of the expression.** Every step above was individually reasonable and all three were
      // dimensionally wrong.
      const fit = ATTRACTOR_DESIGN_FRACTION * Math.min(this.designW, this.designH);

      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        // attractorX/Y/Z arrive already normalised to [-1, 1] by `iterateAttractor` — against the MEASURED
        // extent for the ODE and discrete types, and against `bounds` for the escape-time fields. Z is
        // forced to 0 there for every `isFlatAttractor` type, so no per-type branch is needed here any
        // more; the whole `scaleZ`/`rawZ - 0.5` family is gone with it.
        this.positions[idx]     = invBlend * this.positions[idx]!     + blend * this.attractorX[i]! * fit;
        this.positions[idx + 1] = invBlend * this.positions[idx + 1]! + blend * this.attractorY[i]! * fit;
        this.positions[idx + 2] = invBlend * this.positions[idx + 2]! + blend * this.attractorZ[i]! * fit;
      }
    }

    // Curl noise perturbation (after attractor blend, before 3D transform — RN-02)
    if (this.curlConfig.enabled && this.curlConfig.turbulence > 0) {
      const gamma = this.curlConfig.turbulence;
      const scale = this.curlConfig.scale * 0.001; // convert pixel space to noise space
      const t = this.curlTime;
      const dispScale = (this.canvasWidth + this.canvasHeight) * 0.05 * gamma;
      // v8 2026-11-12: the analytic-gradient curl (`curlNoise3DInto`) into one reused 3-slot scratch — three noise
      // evaluations per particle instead of twelve, and no array per particle (`deformcheck` §CURL).
      const c = CURL_SCRATCH;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        const px = this.positions[idx]!;
        const py = this.positions[idx + 1]!;
        const pz = this.positions[idx + 2]!;
        curlNoise3DInto(px, py, pz, t, scale, c, 0);
        this.positions[idx]     = px + c[0]! * dispScale;
        this.positions[idx + 1] = py + c[1]! * dispScale;
        this.positions[idx + 2] = pz + c[2]! * dispScale;
      }
      this.curlTime += dt * 0.001 * this.curlConfig.evolutionSpeed;
    }

    // Physarum steering (after curl noise, before 3D rotation)
    // Uses persistent per-particle offsets that accumulate across frames.
    // Wave positions are recomputed from scratch each frame, so a one-shot delta would
    // be wiped immediately — the offset array survives the recomputation.
    //
    // ⚠️ **THE TRAIL FIELD IS SCREEN-ALIGNED WHILE `positions` IS MODEL SPACE, SO ONE CONVERSION APPEARS
    // TWICE AND THE SECOND USE MUST BE THE EXACT INVERSE OF THE FIRST.** `renderOverlay()` draws the 512²
    // field across the whole viewport as a fullscreen quad, so field uv *is* viewport uv, and a particle's
    // own screen position is `project()`'s `origin + model * effectiveScale() * perspectiveFactor(z)`.
    // The deposit uv below is exactly that map; the step back divides by the same two factors, recomputed
    // from the same inputs in the second loop rather than cached — which is sound only because **this
    // block writes x and y and never z**, so `perspectiveFactor` cannot have moved between the loops.
    //
    // ⚠️ **FIXED 2026-09-20, AND BOTH HALVES OF A USER-REPORTED DEFECT WERE THIS ONE ERROR.** The block
    // used `halfW = canvasWidth * 0.5` in both directions and no `effectiveScale()` at all — i.e. it
    // treated model units as screen pixels. `waveScale` is **7.68** for every 100×100 design box at
    // 1024×768 (the 177 legacy presets and most demos), so (a) the deposited network reached the screen as
    // a 1/7.68 = **13 % scale copy of the figure, centred**, and (b) the steady wander came out 7.68× too
    // large — 68 model units arriving as ~474 px, which flung **74 %** of `Physarum Weave`'s particles off
    // frame. The report was *"we see mainly the trail in the middle"* and *"not much is moving anymore"*,
    // and it was one missing factor: this file's fifth instance of **check the UNITS of the RESULT, not the
    // plausibility of the expression** (invariant 10). ⚠️ The old form was not self-inverse either —
    // `halfW` is HALF a uv span, so the step was half the distance the sensors had just looked. **A preset
    // authored against the old form therefore needs `blend` halved as well as re-measuring**; both shipped
    // physarum presets were re-tuned with this fix (`demo-presets.ts`).
    //
    // ⚠️ **Two consequences worth keeping.** (1) `effectiveScale()` is `uniformFit(design) × figureScale`
    // and `uniformFit` is proportional to the canvas, so `canvasWidth / effectiveScale()` depends on the
    // ASPECT RATIO only: the simulation is now resolution-independent, and a Grid tile steers its
    // particles exactly as the main view does. (2) `figureScale` no longer detunes it — the trail follows
    // the figure the slider is scaling.
    //
    // ⚠️ **What is NOT modelled: the 3D ROTATION.** The deposit runs before it, so the map is `project()`'s
    // at `angle = 0` — exact for both shipped presets (`rotation [0,0,0]`) and for any unrotated figure,
    // and self-consistent at any rotation (deposit and step share one space either way), but a SPINNING
    // figure's trail is drawn at the unrotated pose. The remedy is to transform the overlay QUAD, not the
    // deposit — a fullscreen quad cannot rotate — which is a display change and deliberately not made here.
    if (this.physarumRef && this.physarumConfig && this.physarumConfig.blend > 0) {
      const figScale = this.effectiveScale();
      // model → field uv per axis, before the particle's own perspective factor.
      const uvPerModelX = figScale / this.canvasWidth;
      const uvPerModelY = figScale / this.canvasHeight;
      // Build deposit UVs from wave position + current offset, through `project()`'s own map at z.
      const uvs = new Float32Array(this.particleCount * 2);
      for (let i = 0; i < this.particleCount; i++) {
        const wx = this.positions[i * 3]! + this.physarumOffsetX[i]!;
        const wy = this.positions[i * 3 + 1]! + this.physarumOffsetY[i]!;
        const persp = this.perspectiveFactor(this.positions[i * 3 + 2]! * figScale);
        uvs[i * 2]     = 0.5 + wx * uvPerModelX * persp;
        uvs[i * 2 + 1] = 0.5 + wy * uvPerModelY * persp;
      }
      // Deposit trail and sense — both use the same UVs
      this.physarumRef.updateTrail(uvs, this.particleCount);
      const deltas = this.physarumRef.senseAndSteer(uvs, this.particleCount);
      // Accumulate deltas into persistent offsets.
      // Offsets decay toward 0 so particles can't drift arbitrarily far from their wave home.
      //
      // dt-CORRECT as of 2026-08-06. This was `retain = 1 - decayRate`, applied once per frame with no
      // reference to `dt` — so the decay per SECOND scaled with frame rate and physarum steering was
      // visibly stronger at 30 fps than at 60. The crystal cluster force already used the exponential
      // form; physarum and fluid did not.
      //
      // `decayRate` is still authored as a PER-FRAME-AT-60FPS fraction, and
      // `k = -ln(1 - decayRate) * 60` is the continuous rate that reproduces it EXACTLY at 60 fps. So
      // every existing preset and the whole slider range keep their current behaviour on a 60 fps
      // machine and only the frame-rate dependence is removed — no re-tuning required.
      // decayRate 0.2 → half-life ~0.05 s; 0.05 → ~0.23 s of drift persistence.
      //
      // THE DEPOSIT MUST BE SCALED BY THE SAME FACTOR. This is a recurrence, not a plain decay:
      //
      //     offset = offset * retain + delta            steady state = delta / (1 - retain)
      //
      // so making `retain` depend on `dt` while `delta` stays a fixed per-frame amount makes the
      // AMPLITUDE depend on frame time. Shipping it that way (2026-08-06) caused visible whole-figure
      // jitter: an ordinary 14–20 ms rAF wobble moved the steady state by ~42 %, and because every
      // particle's offset scales by the same factor, the entire figure breathed in and out together.
      // Reported on `Chemical` within the hour.
      //
      // `depositScale = (1 - retain) / decayRate` cancels it exactly — steady state becomes
      // `delta / decayRate` for ANY `dt`, which is precisely the old 60 fps value. It evaluates to 1.0
      // at 60 fps, so nothing changes there.
      const decayRate = Math.min(0.999, Math.max(0.0001, this.physarumConfig.decayRate));
      const physarumK = -Math.log(1 - decayRate) * 60;
      const retain = Math.exp(-physarumK * (dt / 1000));
      const depositScale = (1 - retain) / decayRate;
      //
      // The uv → model step: the EXACT inverse of the deposit map above, per particle. The screen-space
      // consequence is worth stating because it is what a retune is aimed at: the steady wander reduces to
      // `sensorDistance / 512 * blend / decayRate * canvasWidth` PIXELS, with `effectiveScale()` and the
      // perspective factor cancelling out of it entirely.
      for (let i = 0; i < this.particleCount; i++) {
        const persp = this.perspectiveFactor(this.positions[i * 3 + 2]! * figScale);
        const modelPerUvX = 1 / (uvPerModelX * persp);
        const modelPerUvY = 1 / (uvPerModelY * persp);
        this.physarumOffsetX[i] = (this.physarumOffsetX[i]! * retain) + deltas[i * 2]! * modelPerUvX * depositScale;
        this.physarumOffsetY[i] = (this.physarumOffsetY[i]! * retain) + deltas[i * 2 + 1]! * modelPerUvY * depositScale;
      }
      // Apply accumulated offset to positions for this frame.
      for (let i = 0; i < this.particleCount; i++) {
        this.positions[i * 3]!     += this.physarumOffsetX[i]!;
        this.positions[i * 3 + 1]! += this.physarumOffsetY[i]!;
      }
    }

    // v8 Phase 8b.2 — cluster force field: live particles react to the frozen structure.
    //
    // LAST of the model-space DISPLACEMENT stages, deliberately: the field is sampled against crystal
    // MODEL positions, so the particle positions compared against them must already carry every other
    // model-space offset. Sampling earlier would test a particle against ice it is not actually near
    // yet. (E30's symmetry fold runs after this, but it is a point-group OPERATOR rather than a
    // displacement field — it must see the fully-displaced figure, and the crystals must in turn be
    // born on the FOLDED one, which is why the order is fields → fold → modelPos snapshot.)
    //
    // Same persistent-offset pattern as physarum and RD — wave positions are recomputed from scratch
    // every frame, so a one-shot delta would be wiped immediately.
    const cf = this.crystalConfig;
    if (cf !== null && cf.enabled && cf.clusterForce !== 0) {
      this.ensureClusterScratch();
      const px = this.clusterForceX;
      const py = this.clusterForceY;

      // Exponential decay toward the mathematical position, applied BEFORE accumulating this frame's
      // push, so a particle that has left the field returns home rather than holding its last
      // displacement forever.
      //
      // `clusterDeposit` scales the push so the recurrence's STEADY STATE (`push / (1 - retain)`) is
      // frame-time independent — see the parameter doc on `sampleClusterForce`. Without it the settled
      // displacement varied ~53 % across an ordinary 13–20 ms frame spread, and since every particle
      // scales together that reads as the whole figure breathing. Normalised to 60 fps, so
      // `clusterDeposit` is 1.0 there and nothing changes.
      const clusterReturn = Math.max(0, cf.clusterForceReturn);
      const retain = Math.exp(-clusterReturn * (dt / 1000));
      const rate60 = 1 - Math.exp(-clusterReturn / 60);
      const clusterDeposit = rate60 > 1e-6 ? (1 - retain) / rate60 : dt / (1000 / 60);
      for (let i = 0; i < this.particleCount; i++) {
        px[i] = px[i]! * retain;
        py[i] = py[i]! * retain;
      }

      // sampleClusterForce wants separate x/y/z arrays; `positions` is interleaved stride-3.
      const sx = this.clusterScratchX;
      const sy = this.clusterScratchY;
      const sz = this.clusterScratchZ;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        sx[i] = this.positions[idx]! + px[i]!;
        sy[i] = this.positions[idx + 1]! + py[i]!;
        sz[i] = this.positions[idx + 2]!;
      }

      this.crystalPool.sampleClusterForce(
        this.particleCount, sx, sy, sz, cf, px, py, clusterDeposit,
      );

      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        this.positions[idx] = this.positions[idx]! + px[i]!;
        this.positions[idx + 1] = this.positions[idx + 1]! + py[i]!;
      }
    }

    /*
     * v8 `31.4` (`E132`) — **THE 4D ROTATION. FIRST IN THE OPERATOR STAGE, and that is `31.D9`.**
     *
     * ⚠️ **IT RUNS FIRST BECAUSE IT PRODUCES THE `xyz` EVERY LATER OPERATOR READS.** The twist reads z,
     * the box-fold reads x and y, and the E30 fold reads the angle —
     * all of them against the figure as it will actually be drawn. Running this after any of them would
     * mean they had deformed a figure the projection then replaced.
     *
     * ⚠️ **THE ORDER IS THE CONTRACT** (`31.D9`): `w`-lift → 4D rotate → twist → box-fold → E30 symmetry
     * fold. **Four non-commuting operators, so a preset is portable only while it is fixed — and it is
     * fixed HERE, at the sites, not in a document.** ⚠️ **`31.D9` itself names an octahedral fold between
     * the box-fold and E30; that operator was DROPPED on the owner's visual review (2026-10-25), so the
     * decision's order is one stage longer than the code's. The CODE is the contract — read it here.**
     *
     * **The lift** (`31.D2`): `w = (i / count − 0.5) · 2 · halfExtent · wScale`. The fourth coordinate is
     * the CURVE PARAMETER, which is the most on-identity choice available — the figure *is* a curve traced
     * by a parameter, so lifting that parameter and rotating generalises the engine's own premise. ⚠️ **It
     * is already per-particle, so there is no new array**: `w` lives in a local for the length of one
     * iteration and is consumed by the projection in the same iteration.
     *
     * **The rotation**: three angles, in the three planes that involve `w`. ⚠️ **`xy`/`xz`/`yz` are
     * DELIBERATELY ABSENT — those are the existing 3D `Rotation` control**, and exposing them here would
     * be two controls for one quantity.
     *
     * **The projection**: `p' = p · d / (d − w)`, a perspective divide from a viewer at `w = d`.
     * ⚠️⚠️ **`det J` IS NOT 1 AND `30.D14`'s CORRECTION APPLIES DIRECTLY: a 4D rotation preserves
     * 4-VOLUME, and the 3D projection does not.** So density — and therefore brightness — changes,
     * uncompensated, and that is CORRECT. **Do not reach for `27.2`'s energy law: that normalises a splat
     * quad's own area, not a projection's density.** Phase 30 learned this the expensive way, on this
     * exact confusion.
     *
     * ⚠️ **THE DENOMINATOR IS FLOORED BY A BOUND ON MAGNIFICATION, NEVER BY AN EPSILON** — see
     * `W_MIN_DEN_FRACTION`, where the derivation is. An `xw` rotation mixes `x` into `w`, so the post-
     * rotation `w` is bounded by the figure's own radius and no constant can know it; an epsilon floor
     * would admit a magnification of thousands, which reaches the user as one stray dot rather than as an
     * error.
     *
     * ⚠️ **`wScale` 0 IS A BIT-EXACT NO-OP WITH THE ANGLES AT ANY VALUE, and the gate is `wScale` ALONE
     * rather than the whole quadruple** — which is the opposite of the twist's gate and is forced by the
     * arithmetic: at `wScale` 0 every `w` is 0, so all three rotations are identities on a zero fourth
     * coordinate and the divide is `d/d = 1`. **Gating on the angles too would leave the stage running
     * (and the divide rounding) for an operator that provably cannot move anything.**
     */
    if (this.wScale > 0) {
      const halfExtent = Math.max(1e-6, Math.min(this.designW, this.designH) * 0.5);
      const d = W_VIEW_DISTANCE * halfExtent;
      const minDen = W_MIN_DEN_FRACTION * d;
      const wSpan = 2 * halfExtent * this.wScale;
      // Turns -> radians, the twist's own convention.
      const TAU = Math.PI * 2;
      const cxw = Math.cos(this.wAngleXW * TAU), sxw = Math.sin(this.wAngleXW * TAU);
      const cyw = Math.cos(this.wAngleYW * TAU), syw = Math.sin(this.wAngleYW * TAU);
      const czw = Math.cos(this.wAngleZW * TAU), szw = Math.sin(this.wAngleZW * TAU);
      const invN = this.particleCount > 1 ? 1 / this.particleCount : 0;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        let x = this.positions[idx]!;
        let y = this.positions[idx + 1]!;
        let z = this.positions[idx + 2]!;
        /*
         * ⚠️ **PERIODIC, NOT A RAMP, AND THAT IS THE WHOLE DIFFERENCE BETWEEN THIS OPERATOR AND A 3D ONE.**
         * `w = sin(pi·winding·u)` with `u ∈ [−1, 1]`: the fourth coordinate reverses `winding` times along
         * the curve, so the 4D rotation pushes successive stretches of the figure in OPPOSITE directions
         * and the strands cross. The original `(i/count − 0.5)·span` was monotone in the index, hence
         * nearly a function of position, hence a 3D deformation in all but name — see `W_WINDING_MAX`.
         */
        let w = Math.sin(Math.PI * this.wWinding * (i * invN * 2 - 1)) * wSpan * 0.5;

        // xw, then yw, then zw. ⚠️ **THE ORDER IS PART OF THE CONTRACT** for the twist's reason exactly:
        // 4D rotations do not commute either, and the order is what makes a preset portable rather than
        // an artefact of how this loop happened to be written.
        let k = x * cxw - w * sxw; w = x * sxw + w * cxw; x = k;
        k = y * cyw - w * syw; w = y * syw + w * cyw; y = k;
        k = z * czw - w * szw; w = z * szw + w * czw; z = k;

        // The 4D -> 3D perspective divide, floored by the magnification bound rather than an epsilon.
        const den = Math.max(minDen, d - w);
        const proj = d / den;
        this.positions[idx] = x * proj;
        this.positions[idx + 1] = y * proj;
        this.positions[idx + 2] = z * proj;
      }
    }

    /*
     * v8 `30.1` (`E129a`) — **BARR TWIST. The first model-space operator that READS z.**
     *
     * ⚠️ **UPSTREAM OF THE E30 FOLD, AND THAT IS `30.D9` RATHER THAN CONVENIENCE.** The fold's own header
     * below says it *"composes with everything upstream for free"* and symmetrises every field system.
     * Running the deformers here keeps **symmetry the OUTERMOST property**, so a folded rosette stays a
     * rosette whose arms are identically deformed. Downstream of the fold a twist would break the symmetry
     * it had just been given — a different and much narrower feature, and not the one that was specified.
     *
     * ⚠️ **THE ORDER X -> Y -> Z IS PART OF THE CONTRACT** (`30.D6`, and `OverlayState.twistX`'s header).
     * Rotations do not commute, so the order is what makes a preset portable rather than an artefact of
     * how this loop happened to be written. **Do not reorder these three blocks.**
     *
     * ⚠️ **`det J = 1` EXACTLY for each axis**, because each is a rigid rotation of the plane perpendicular
     * to its driving axis, whose own coordinate is untouched. **So no energy compensation is owed and none
     * may be added** — the operator creates and destroys no light, and it changes no splat's size or shape.
     *
     * ⚠️ **BUT THE FRAME STILL GETS BRIGHTER, AND `30.D14` WAS WRONG TO CALL THIS AN INSTRUMENT CHECK FOR
     * `27.2`'s ENERGY LAW. Measured on `Pipes` at Twist Z +0.50, 1440x900: mean luminance 93.9 -> 141.6,
     * near-clipped pixels 7.52 % -> 1.85 %, lit coverage 83.5 % -> 95.3 %.** The light was REDISTRIBUTED,
     * not created: winding the figure spreads a clipping tangle over more of the frame, so more pixels are
     * lit at lower peak and the mean rises because fewer are black. **`det J` is a MODEL-SPACE volume ratio
     * and mean frame luminance is a SCREEN-SPACE coverage statistic — invariant 10's trap, two quantities a
     * plausible sentence treated as one.** So a brightness reading after a twist is confounded by coverage
     * and cannot exonerate or convict the energy law. **The discriminator is per-splat intensity, and the
     * reason twist cannot disturb it is structural rather than measured: this loop writes `positions` and
     * nothing else.**
     *
     * ⚠️ **The angle is derived from the DESIGN BOX, not from the canvas and not from a picked constant**
     * (invariant 10): `halfExtent = min(designW, designH) / 2`, the same basis `ATTRACTOR_DESIGN_FRACTION`
     * measures against. So `1.0` means one full turn from the centre to the box edge, which means the same
     * thing at every `figureScale` and on every canvas shape.
     *
     * ⚠️ **ALL-ZERO IS A BIT-EXACT NO-OP and the gate is the whole triple**, exactly as `fold > 1` gates the
     * loop below: no preset authored before `30.1` may move by one bit, and the only way to promise that is
     * to skip the loop rather than to multiply by an identity.
     */
    const twX = this.twist[0]!, twY = this.twist[1]!, twZ = this.twist[2]!;
    if (twX !== 0 || twY !== 0 || twZ !== 0) {
      const halfExtent = Math.max(1e-6, Math.min(this.designW, this.designH) * 0.5);
      const kx = (twX * Math.PI * 2) / halfExtent;
      const ky = (twY * Math.PI * 2) / halfExtent;
      const kz = (twZ * Math.PI * 2) / halfExtent;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        let x = this.positions[idx]!;
        let y = this.positions[idx + 1]!;
        let z = this.positions[idx + 2]!;
        // X: rotate (y, z) by a function of x. x itself is never written.
        if (twX !== 0) {
          const th = kx * x;
          const c = Math.cos(th), s = Math.sin(th);
          const ny = y * c - z * s;
          z = y * s + z * c;
          y = ny;
        }
        // Y: rotate (z, x) by a function of y. y itself is never written.
        if (twY !== 0) {
          const th = ky * y;
          const c = Math.cos(th), s = Math.sin(th);
          const nz = z * c - x * s;
          x = z * s + x * c;
          z = nz;
        }
        // Z: rotate (x, y) by a function of z. z itself is never written — which is the whole reason this
        // operator is depth-safe where `E133`'s inversion is not.
        if (twZ !== 0) {
          const th = kz * z;
          const c = Math.cos(th), s = Math.sin(th);
          const nx = x * c - y * s;
          y = x * s + y * c;
          x = nx;
        }
        this.positions[idx] = x;
        this.positions[idx + 1] = y;
        this.positions[idx + 2] = z;
      }
    }

    /*
     * v8 `32.1`/`32.2`/`32.3` (`E129b`) — **BARR TAPER AND BEND, the two members of the trio whose
     * DETERMINANT IS NOT 1.**
     *
     * ⚠️⚠️ **ONE LOOP FOR BOTH OPERATORS AND THE COMPENSATION, AND THAT IS NOT AN OPTIMISATION — IT IS
     * THE ONLY PLACE THE COMPOSED DETERMINANT EXISTS.** Barr's determinants are per deformation (`r²` for
     * taper, `1 − k·u` for bend); the quantity the energy law needs is their PRODUCT, and a product of six
     * factors spread over two loops is a product neither loop can clamp. Splitting them would give two
     * individually-correct stages and an unbounded composition.
     *
     * ⚠️⚠️ **EVERY FACTOR IS EVALUATED FROM THE PRE-DEFORMATION POSITION, SO THE STAGE IS ORDER-FREE
     * (`32.D5`).** Composing three Barr tapers sequentially is NOT commutative — taper-x would evaluate
     * `f(x)` at an `x` that taper-z had already scaled — so a sequential reading needs a declared axis
     * order, exactly as the 4D rotation above declares `xw → yw → zw`. **The engine already carries one
     * load-bearing order contract in this stage and a second one is a liability, not a feature**: an
     * invisible ordering is how a preset stops being portable. Reading `x0/y0/z0` throughout makes the
     * result independent of how this loop happens to be written.
     *
     * ⚠️ **THE TWIST ABOVE CONTRIBUTES EXACTLY 1 AND IS DELIBERATELY NOT IN THIS PRODUCT.** Barr's
     * determinant for twisting is 1 — it is the only energy-neutral member, which is why `30.1` shipped
     * with none of this machinery. Including it would be arithmetically harmless and would teach the next
     * reader that twist needs compensating.
     *
     * ⚠️⚠️ **THE COMPENSATION IS CLAMPED AT THE WRITE SITE, AND `acesToneMap` DOES NOT DISCHARGE THIS.**
     * That function is guarded against NaN-at-infinity internally, which protects the SCREEN path. It does
     * not protect the TRAIL: the fade MULTIPLIES, so one Inf written into the accumulation buffer can
     * never be cleared by any number of subsequent frames (invariant 20 — *enumerate the trail's writers
     * before believing it is guarded*). `DEFORM_DET_FLOOR` bounds the product in both directions.
     *
     * ⚠️ **GATED ON THE WHOLE SIX-TUPLE, bit-exact skipped rather than multiplied by an identity** — the
     * twist's rule, for the twist's reason: no preset authored before this phase may move by one bit.
     */
    const tpX = this.taper[0]!, tpY = this.taper[1]!, tpZ = this.taper[2]!;
    const bdX = this.bend[0]!, bdY = this.bend[1]!, bdZ = this.bend[2]!;
    if (tpX !== 0 || tpY !== 0 || tpZ !== 0 || bdX !== 0 || bdY !== 0 || bdZ !== 0) {
      const halfExtentTB = Math.max(1e-6, Math.min(this.designW, this.designH) * 0.5);
      const invHE = 1 / halfExtentTB;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        const x0 = this.positions[idx]!;
        const y0 = this.positions[idx + 1]!;
        const z0 = this.positions[idx + 2]!;
        // Normalised coordinates, clamped to the design box so a figure that overshoots its own
        // designResolution cannot push a factor past the bound the constants were derived against.
        const ux = Math.max(-1, Math.min(1, x0 * invHE));
        const uy = Math.max(-1, Math.min(1, y0 * invHE));
        const uz = Math.max(-1, Math.min(1, z0 * invHE));

        // ---- taper: scale the whole triple by a product of three cross-section factors ----
        const sx = Math.max(TAPER_MIN_FACTOR, 1 + tpX * ux);
        const sy = Math.max(TAPER_MIN_FACTOR, 1 + tpY * uy);
        const sz = Math.max(TAPER_MIN_FACTOR, 1 + tpZ * uz);
        const taperFactor = sx * sy * sz;

        // ---- bend: Barr's `1 − k·u` per axis, as a scale on the triple ----
        // ⚠️ Each factor is floored at `BEND_MARGIN` rather than at 0: past 0 Barr's map is EVERTED, and
        // an everted region is the geometric face of the same singularity the luminance sees.
        const bx = Math.max(BEND_MARGIN, 1 - bdX * ux);
        const by = Math.max(BEND_MARGIN, 1 - bdY * uy);
        const bz = Math.max(BEND_MARGIN, 1 - bdZ * uz);
        const bendFactor = bx * by * bz;

        const scale = taperFactor * bendFactor;
        this.positions[idx] = x0 * scale;
        this.positions[idx + 1] = y0 * scale;
        this.positions[idx + 2] = z0 * scale;

        /*
         * `32.3` — the energy compensation. `det J = (sx·sy·sz)² · (bx·by·bz)`: the taper factors SQUARED
         * because taper scales a cross-section (two axes per factor) and the bend factors linear, which is
         * Barr's own pairing. Luminance in an additive renderer scales as `1/det J`, so the correction
         * multiplies by `det J`.
         */
        /*
         * ⚠️ **TWO CLAMPS, AND THEY ARE DIFFERENT QUANTITIES.** `DEFORM_DET_FLOOR` guards the ARITHMETIC
         * — the raw product must not reach 0, because the law divides by it. `DEFORM_ENERGY_SPAN` bounds
         * the VEHICLE — the size channel's consumers are calibrated for `[1/5, 5]` and the driver clips
         * anything past the point-size ceiling, so a larger request buys nothing and costs fill rate.
         * Collapsing them into one constant would tie Barr's algebra to a renderer limit.
         */
        const raw = Math.max(DEFORM_DET_FLOOR,
          Math.min(1 / DEFORM_DET_FLOOR, taperFactor * taperFactor * bendFactor));
        this.deformEnergy[i] = Math.max(1 / DEFORM_ENERGY_SPAN, Math.min(DEFORM_ENERGY_SPAN, raw));
      }
      this.deformEnergyLive = true;
    } else if (this.deformEnergyLive) {
      // ⚠️ **The flag must die with its data (invariant 3).** A stale `true` over last frame's energies
      // would scale every particle by a deformation that is no longer applied.
      this.deformEnergy.fill(1);
      this.deformEnergyLive = false;
    }

    /*
     * v8 `32.7` (`E133`) — **SPHERICAL INVERSION, `p → p·R²/|p|²`. LICENSED BY MEASUREMENT, 2026-10-26.**
     *
     * ⚠️⚠️ **THE IMAGE-SPACE FORM OF THIS ALREADY SHIPS and this stage is NOT that.** TransMap style 12's
     * `inverse` map is the same formula applied after the projection, where depth has already been
     * discarded — see `trans-map.ts`, which names `E133` at that branch. **This one runs BEFORE the
     * projection, so it reorders which particles are in front.** Anything describing this as "adding
     * inversion" is mis-scoped: the look was already reachable; the stage is what is new.
     *
     * ⚠️⚠️ **WHY IT SHIPS, GIVEN `31.9` FALSIFIED THE BOUND THAT GATED IT.** `32.6` re-ran the corrected
     * discriminator — *inversion WITH NO CHANGE TO THE PROJECTED IMAGE*, calibrated against the removed
     * `boxFoldZ` — over 174 strong-z bodies. Full-strength inversion trips the rule on **31** bodies; the
     * engine's own `angle: [0, 90, 0]` trips it on **39** and `[45, 0, 0]` on **65**. **A rule that
     * refuses a candidate less often than it refuses the oldest correct control in the engine has not
     * refused the candidate.** What the rule catches is SILENT reversal: `boxFoldZ` scored 67.3 % depth at
     * 0.0 % image change; inversion scores 19.6 % depth at **102.6 %** image change — it moves the
     * projection further than the figure's own width. It is the loudest operator measured.
     *
     * ⚠⚠ **A SHELL PARAMETER WAS SPECIFIED, MEASURED, AND REMOVED THE SAME DAY. DO NOT RE-PROPOSE
     * IT AS A SAFETY MECHANISM.** It restricted the map to `r > shell`, on the study's suggestion that
     * protecting the core would protect depth ordering. Measured: **31 bodies either way** — identically
     * to no shell — because a figure spanning the design extent has most of its particles outside it.
     * Halving the radius did nothing either. **The effective safety control is the amount lerp, which
     * passes 0 of 174 bodies at 0.3.**
     *
     * ⚠️ **The instrument is `MEASUREMENT-phase32-inversion.mjs` and it is the authoritative basis** —
     * kept beside Phase 30's and 31's, because a verdict with no surviving instrument cannot be re-derived.
     */
    const invAmt = this.invertAmount;
    if (invAmt > 0) {
      const halfExtentInv = Math.max(1e-6, Math.min(this.designW, this.designH) * 0.5);
      const R = halfExtentInv * this.invertRadius;
      // ⚠️ A MAGNITUDE guard, not an epsilon (invariant 10): at the centre the map is a true pole, and a
      // float epsilon would admit a magnification of millions — which ANGLE answers by dropping the
      // primitive, so it reaches the user as a MISSING particle rather than a broken one.
      const minR = R * INVERT_MIN_R_FRACTION;
      const R2 = R * R;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        const x = this.positions[idx]!;
        const y = this.positions[idx + 1]!;
        const z = this.positions[idx + 2]!;
        const r = Math.sqrt(x * x + y * y + z * z);
        const rr = Math.max(r, minR);
        const k = R2 / (rr * rr);
        // Lerp from identity, so amount 0 is byte-identical to ungated and the stage gates on it.
        const w = 1 + (k - 1) * invAmt;
        this.positions[idx] = x * w;
        this.positions[idx + 1] = y * w;
        this.positions[idx + 2] = z * w;
      }
    }

    /*
     * v8 `30.2` (`E130`) — **BOX-FOLD. The engine's first MANY-TO-ONE coordinate map.**
     *
     * ⚠️ **THAT PROPERTY IS THE WHOLE FEATURE, not an implementation detail.** Every other operator in this
     * engine — all five field systems, every TransMap style, the twist above — is ONE-TO-ONE: it moves a
     * point somewhere else. A fold is many-to-one and idempotent on its fundamental domain, so **separate
     * stretches of one curve land on the same place, density piles up at the fold planes, and density is
     * brightness in an additive renderer.** The architecture therefore arrives LIT AT ITS SEAMS. **No
     * amount of added displacement can produce a seam. If the seams are not bright, the fold is not
     * folding.**
     *
     * ⚠️ **THE REFLECTION IS CONTINUOUS, AND THAT IS WHY THIS OPERATOR IS AFFORDABLE AT ALL.** At `c = L`
     * the fold gives `2L - L = L`: the one-sided limits agree, so the map has no jump. **`symmetryFold`'s
     * own setter documents what the alternative costs** — its *cyclic* form is a bare `theta mod sector`,
     * discontinuous at the wedge boundary, and it trips THREE teleport guards (`outlierCap`, which zeroes
     * the velocity so velocity materials, sparks and `heatMode: 'velocity'` see a dead particle;
     * `NeonLineRenderer.computeTeleportSq()`, which drops the segment; and `RibbonRenderer`'s copy, which
     * sets alpha 0). Box-fold is the REFLECTED member of that family and inherits the mirrored form's
     * safety. ⚠️⚠️ **NEVER ADD A MODULAR OR "WRAP" VARIANT OF THIS OPERATOR** — it would be the cyclic
     * hazard a second time, in a stage that has already paid for the lesson once. `deformcheck` §B bans it
     * over string literals, because its RETURN is the regression.
     *
     * ⚠️ **ITERATIONS IS THE GATE, NOT THE LIMIT, and `0` is bit-exact.** A limit wide enough to fold
     * nothing is still a loop over every particle every frame; and no preset authored before `30.2` may
     * move by one bit, which only a skipped loop can promise.
     *
     * ⚠️ **`|det J| = 1` PER FOLD** (a reflection), so the fold itself changes no density. **`scale != 1`
     * DOES, uncompensated, and that is CORRECT rather than a defect** — `27.2` normalises the splat quad's
     * own area, not model-space density, and compressing a figure genuinely does put more particles in a
     * pixel. The tooltip says so, because it is certain to be reported otherwise.
     *
     * ⚠️ **Z IS OPT-IN (`30.D1`) AND THE REASON IS THE DEPTH GATE.** The fold is piecewise-monotone but not
     * globally monotone, so folding z inverts the depth order of any pair that straddles a fold plane —
     * which is what removed `E133` from the study. `30.10` measures the inversion rate against a bound
     * fixed in advance (`30.D15`: 10 % of visible pairs).
     */
    const bfIter = this.boxFoldIterations;
    if (bfIter > 0) {
      // The cell half-width in MODEL units, from a fraction of the design half-extent — so the control
      // means the same thing whatever design box a preset declares (invariant 10, as twist's angle is).
      const halfExtent = Math.max(1e-6, Math.min(this.designW, this.designH) * 0.5);
      const L = Math.max(1e-6, this.boxFoldLimit * halfExtent);
      const L2 = L * 2;
      const sc = this.boxFoldScale;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        let x = this.positions[idx]!;
        let y = this.positions[idx + 1]!;
        for (let it = 0; it < bfIter; it++) {
          if (x > L) x = L2 - x; else if (x < -L) x = -L2 - x;
          if (y > L) y = L2 - y; else if (y < -L) y = -L2 - y;
          // ⚠️ **Z IS NOT FOLDED AND NOT SCALED. `30.10` MEASURED THE ALTERNATIVE AND IT FAILED THE
          // GATE BY AN ORDER OF MAGNITUDE** -- 61-100 % of sampled depth pairs inverted against the 10 %
          // bound `30.D15` fixed in advance, over all 164 strong-z bodies and every cell size and
          // iteration count in the shipped range. **The cause is structural: a reflection does not PERTURB
          // an ordering, it REVERSES it wholesale for everything in the reflected region** -- so there is
          // no parameter at which folding z is depth-safe. Scaling z without folding it would shrink the
          // depth extent without reflecting it, changing the perspective divide for no reason the fold
          // asked for. **`boxFoldZ` was specified, built, measured and REMOVED; do not re-add either
          // half** (`30.D19`). This is the gate that removed `E133`.
          if (sc !== 1) {
            x *= sc; y *= sc;
          }
        }
        this.positions[idx] = x;
        this.positions[idx + 1] = y;
      }
    }

    /*
     * v8 Phase 38 — **the Fractal Fold**, XY only (`core/fractal-fold.ts` owns the law and the compensation table).
     *
     * ⚠️ **ITS POSITION IS A CHOICE, STATED HERE AS ONE**: after the box fold (and so after the inversion, which
     * runs before it — the plan's "before the inversion" was false against this file), before the 2-D
     * symmetry and the 3-D replication. The operator's OWN internals are order-free (it re-anchors to `x₀`, the
     * position ENTERING it); its place in the chain is not, and a load-bearing axis order is a liability
     * (`32`'s lesson), so moving it is a visible change, not a refactor.
     *
     * ⚠️ **TWO IDENTITIES, TWO BRANCHES** (`38.D5`, `33.2`'s rule — branch, never weight): `iterations === 0`
     * skips the stage; a RESOLVED `scale === 0` skips the loop (the law is then `x = x₀` exactly, and `x + 0·k`
     * is exact for every finite value except `−0`).
     */
    const ffIter = this.fractalFoldIterations;
    if (ffIter > 0) {
      const ffL = this.resolveOp(this.fractalFoldLimit, this.fractalFoldLimitDepth, this.fractalFoldLimitRate,
        scaledTime, FRACTAL_FOLD_MIN_LIMIT, FRACTAL_FOLD_MAX_LIMIT);
      const ffS = this.resolveOp(this.fractalFoldScale, this.fractalFoldScaleDepth, this.fractalFoldScaleRate,
        scaledTime, -FRACTAL_FOLD_MAX_SCALE, FRACTAL_FOLD_MAX_SCALE);
      // The unit is the figure's OWN size (`core/fractal-fold.ts`' header: the design-box unit failed by
      // measurement); a collapsed figure folds as the identity.
      const hFF = fractalFoldUnit(this.positions, this.particleCount);
      if (ffS !== 0 && hFF > 1e-6) {
        // The MEASURED growth divided out (`38.D3`), then the per-particle soft limiter for the tails.
        const g = 1 / fractalFoldGrowth(ffIter, ffL, ffS);
        const inv = 1 / hFF;
        const out = this.ffScratch;
        for (let i = 0; i < this.particleCount; i++) {
          const idx = i * 3;
          fractalFoldPoint(this.positions[idx]! * inv, this.positions[idx + 1]! * inv, this.positions[idx + 2]! * inv,
            ffIter, ffL, ffS, out);
          out[0] = out[0]! * g; out[1] = out[1]! * g;
          fractalFoldLimit(out);
          this.positions[idx] = out[0]! * hFF;
          this.positions[idx + 1] = out[1]! * hFF;
          // ⚠️ z is NOT written: the fold is XY-only (owner, 2026-11-10), so depth is bit-identical.
        }
      }
    }

    // E30 — dihedral symmetry fold. THE LAST MODEL-SPACE STAGE, before the rotation.
    //
    // Every particle's XY is folded into one base wedge of `sector = 2π/n` radians and then rotated
    // back out into the sector its own index selects, so the figure becomes n identical arms — a
    // rosette, mandala or snowflake depending on n and on what the underlying curve looks like.
    //
    // ⚠️ **Model space, BEFORE the rotation, and that is the whole point.** A screen-space kaleidoscope
    // (which is what TransMap's IFS `Kaleidoscope`/`Mirror` presets give, warping the accumulated trail
    // buffer) produces flat overlapping ghosts pinned to the viewport. Folding here makes the symmetry
    // a property of the FIGURE: the symmetry axis tumbles with `angle`/`rotationSpeed`, so the result
    // reads as a 3D symmetric solid seen from a moving viewpoint rather than as a post-effect. It also
    // means it composes with everything upstream for free — the five positional-nudge field systems
    // (physarum, buoyancy, cluster force, TransMap force, curl noise) and the attractor blend all get
    // symmetrised, and the crystal pool nucleates on the folded figure because `modelPos` is snapshotted
    // a few lines below this.
    //
    // `z` is deliberately UNTOUCHED. The operator is a plane point group; folding z as well would
    // collapse the figure's depth structure and defeat the perspective projection.
    const fold = this.symmetryFold;
    if (fold > 1) {
      const sector = (Math.PI * 2) / fold;
      const halfSector = sector / 2;
      const mirror = this.symmetryMirror;
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        const x = this.positions[idx]!;
        const y = this.positions[idx + 1]!;
        const r = Math.sqrt(x * x + y * y);
        if (r < 1e-9) continue;   // a particle at the origin has no angle to fold

        // `atan2` returns (-π, π]; shift into [0, 2π) so the modulo lands in the base wedge rather
        // than producing a negative residue for the whole lower half-plane.
        let th = Math.atan2(y, x);
        if (th < 0) th += Math.PI * 2;
        th %= sector;

        // The reflection. See `setSymmetry` — this is what makes the mapping CONTINUOUS across the
        // wedge boundary, and therefore what keeps the three downstream teleport guards quiet.
        if (mirror && th > halfSector) th = sector - th;

        // Sector assignment by STRIDE (`i % fold`), never by contiguous block.
        //
        // ⚠️ Particle index maps directly to position along the arc of the curve (that is also why the
        // crystal `slowFraction` percentile clusters spatially). A contiguous block would therefore hand
        // each arm a DIFFERENT PIECE of the figure — arm 0 gets the first sixth of the curve, arm 1 the
        // second — and the result does not read as symmetric at all, just as a chopped-up figure. A
        // stride gives every arm a uniformly decimated copy of the WHOLE curve, so the arms are
        // recognisably the same shape. Same reasoning as the crystal 3D tilt keying off the stable slot
        // index rather than `gl_InstanceID`.
        th += (i % fold) * sector;

        this.positions[idx] = r * Math.cos(th);
        this.positions[idx + 1] = r * Math.sin(th);
      }
    }

    /*
     * v8 Phase 42 — **3-D SYMMETRY: the figure REPLICATED around the centre, after the 2-D fold and before the
     * rotation.** Particle `i` belongs to copy `c = i mod copies`; that copy is turned by its matrix (its place among the
     * copies at its position, mirrored or not, then facing outward or kept parallel) and moved `radius · halfExtent` to
     * its position — the 2-D fold's STRIDE rule, so every copy is a thinned copy of the WHOLE figure.
     *
     * ⚠️⚠️ **REPLICATE, NEVER FOLD (`42.D1`).** A fold cuts the curve at every mirror plane, and `E131`'s 3-D fold was
     * dropped for exactly that (*"chops the figure into multiplied line segments"*). A replicated copy is whole.
     * ⚠️ **Model space, before the rotation** — `E30`'s argument: the arrangement tumbles with the figure, and every
     * field system upstream is replicated for free.
     * ⚠️ **The arrangement is FITTED back to the figure's size**: the copies spread to about `(1 + radius)` half-extents,
     * so the whole is scaled by `1 / (1 + radius)` and stays in the design box.
     * ⚠️ **A copy index is a FIXED function of `i`**, so a particle never jumps between copies from frame to frame —
     * nothing here can trip the three teleport guards downstream (`setSymmetry`'s note).
     */
    const s3 = this.sym3d;
    if (s3 !== null) {
      const M = s3.mats, D = s3.dirs, copies = s3.copies;
      const shift = s3.radius * 0.5 * Math.min(this.designW, this.designH);
      const fit = 1 / (1 + s3.radius);
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        const x = this.positions[idx]!, y = this.positions[idx + 1]!, z = this.positions[idx + 2]!;
        const c = i % copies, m = c * 9, d = c * 3;
        this.positions[idx] = (M[m]! * x + M[m + 1]! * y + M[m + 2]! * z + D[d]! * shift) * fit;
        this.positions[idx + 1] = (M[m + 3]! * x + M[m + 4]! * y + M[m + 5]! * z + D[d + 1]! * shift) * fit;
        this.positions[idx + 2] = (M[m + 6]! * x + M[m + 7]! * y + M[m + 8]! * z + D[d + 2]! * shift) * fit;
      }
    }

    // Update rotation angle (legacy: rotInc = rotationSpeed / (1000/delta))
    const rotFactor = dt / 1000;
    this.angle[0]! += this.rotationSpeed[0]! * rotFactor;
    this.angle[1]! += this.rotationSpeed[1]! * rotFactor;
    this.angle[2]! += this.rotationSpeed[2]! * rotFactor;

    // 3D rotation (same as legacy Util3d.rotatePoints)
    const angX = this.angle[0] ?? 0;
    const angY = this.angle[1] ?? 0;
    const angZ = this.angle[2] ?? 0;
    const sinWx = Math.sin(angX / DEG);
    const cosWx = Math.cos(angX / DEG);
    const sinWy = Math.sin(angY / DEG);
    const cosWy = Math.cos(angY / DEG);
    const sinWz = Math.sin(angZ / DEG);
    const cosWz = Math.cos(angZ / DEG);

    const originX = this.canvasWidth / 2;
    const originY = this.canvasHeight / 2;
    const perspZ = this.perspectiveZ;

    // Last point at which `positions` still holds MODEL space. Snapshot it: it is the birth source
    // for a crystal, which stores a MODEL-space position so it rotates with the figure.
    //
    // Gated on `enabled`, so a build/session that never turns crystal on pays nothing per frame
    // (the copy is ~240 KB/frame at 20 000 particles). The snapshot is taken in the SAME frame that
    // `crystalPool.update()` consumes it, further down this method, so the first enabled frame
    // already sees fresh model space — there is no warm-up gap and `modelPosReady` stays honest.
    if (this.crystalConfig?.enabled === true) {
      this.modelPos.set(this.positions);
      this.modelPosReady = true;
    }

    // Apply scale + rotation + perspective projection.
    // The crystal pool runs the SAME maths over its own slots (`CrystalPool.project()`), reusing
    // the trig values hoisted above — that is what keeps crystals attached to the figure.
    //
    // `figScale` is applied BEFORE the rotation, so it scales the figure in its own model space rather
    // than the projected image: a scaled figure keeps the same perspective foreshortening and the same
    // depth ordering it would have at scale 1. Scaling after projection would flatten it instead.
    const figScale = this.effectiveScale();
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;

      let x = this.positions[idx]! * figScale;
      let y = this.positions[idx + 1]! * figScale;
      let z = this.positions[idx + 2]! * figScale;

      // Rotate X
      let k = y * cosWx - z * sinWx;
      z = y * sinWx + z * cosWx;
      y = k;

      // Rotate Y
      k = x * cosWy + z * sinWy;
      z = -x * sinWy + z * cosWy;
      x = k;

      // Rotate Z
      k = x * cosWz - y * sinWz;
      y = x * sinWz + y * cosWz;
      x = k;

      // Perspective projection (same as legacy Util3d.projectPoints)
      const q = z - perspZ;
      if (q > 0) {
        const proj = perspZ / q;
        this.positions[idx] = originX - x * proj;
        this.positions[idx + 1] = originY - y * proj;
        this.positions[idx + 2] = z;
      } else {
        // Behind the camera: park it off-screen. See CULL_SENTINEL — the magnitude is load-bearing,
        // because no consumer tests for the value, they only rely on it exceeding their own guards.
        this.positions[idx] = CULL_SENTINEL;
        this.positions[idx + 1] = CULL_SENTINEL;
        this.positions[idx + 2] = z;
      }

      // Depth normalized to [0,1] based on perspective
      const depthRange = -perspZ * 2;
      this.depths[i] = Math.max(0, Math.min(1, (z - perspZ) / depthRange));
    }

    // Colors — the legacy law, whose single owner is `writeColourAt()` below. See its header for the
    // algebra, for why the `index` mapping is a substitution rather than a second law, and for why the two
    // callers must never be allowed to diverge.
    this.writeAllColours(this.particleCount, this.pos, this.colors);

    // Compute per-particle velocity normalized to [0,1]
    // Use adaptive reference: EMA of 95th-percentile velocity, with a hard
    // outlier cap (canvas diagonal) to reject perspective teleports.
    const outlierCap = Math.sqrt(this.canvasWidth * this.canvasWidth + this.canvasHeight * this.canvasHeight) * 0.1;
    // MISNAMED: this holds the MAXIMUM, not a 95th percentile (E2). The loop below takes an unconditional
    // running max; there is no ranking or histogram anywhere. Kept as-is rather than renamed because the
    // value feeds `velRefEMA`, which is tuned around the max's behaviour — a true p95 would sit lower and
    // would silently rescale every velocity-driven effect (palette mapping 2, spark spawning, velocity
    // stretch). Rename only together with a re-tune.
    let p95Vel = 0;   // = max velocity this frame, despite the name
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      const dx = this.positions[idx]! - this.prevPositions[idx]!;
      const dy = this.positions[idx + 1]! - this.prevPositions[idx + 1]!;
      const vel = Math.sqrt(dx * dx + dy * dy);
      this.velocities[i] = vel < outlierCap ? vel : 0;
      // The spark spawn's ejection velocity, captured HERE because `prevPositions` is overwritten at :1210
      // and the spawn runs at :1306 — see `frameMotion`'s declaration. The outlier cap is applied to both or
      // to neither: a perspective teleport that `velocities` rejects must not be allowed to fling an ember
      // across the canvas instead, and the gate would in any case never fire on a rejected particle.
      const capped = vel < outlierCap;
      this.frameMotion[i * 2] = capped ? dx : 0;
      this.frameMotion[i * 2 + 1] = capped ? dy : 0;
      if (this.velocities[i]! > p95Vel) p95Vel = this.velocities[i]!;
    }
    // Smooth the reference over time so it doesn't jitter
    if (this.velRefEMA <= 0) {
      this.velRefEMA = p95Vel > 0 ? p95Vel : 1;
    } else {
      this.velRefEMA = this.velRefEMA * 0.95 + p95Vel * 0.05;
    }
    const invRef = 1.0 / Math.max(this.velRefEMA, 0.01);
    for (let i = 0; i < this.particleCount; i++) {
      this.velocities[i] = Math.min(1, this.velocities[i]! * invRef);
    }

    // Compute per-particle velocity direction with temporal smoothing
    // EMA avoids zig-zag artifacts from frame-to-frame direction noise
    const dirSmooth = 0.3;
    for (let i = 0; i < this.particleCount; i++) {
      // v8 Phase 8a-3: no guard needed. A crystal's facet grain must be fixed at formation time,
      // and it is: `CrystalPool` CAPTURES this vector once at birth and never re-derives it.
      const idx = i * 3;
      const dx = this.positions[idx]! - this.prevPositions[idx]!;
      const dy = this.positions[idx + 1]! - this.prevPositions[idx + 1]!;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        const nx = dx / len;
        const ny = dy / len;
        const prevX = this.velocityDirs[i * 2]!;
        const prevY = this.velocityDirs[i * 2 + 1]!;
        if (prevX === 0 && prevY === 0) {
          this.velocityDirs[i * 2] = nx;
          this.velocityDirs[i * 2 + 1] = ny;
        } else {
          let sx = prevX + dirSmooth * (nx - prevX);
          let sy = prevY + dirSmooth * (ny - prevY);
          const sLen = Math.sqrt(sx * sx + sy * sy);
          if (sLen > 0.001) { sx /= sLen; sy /= sLen; }
          this.velocityDirs[i * 2] = sx;
          this.velocityDirs[i * 2 + 1] = sy;
        }
      }
    }

    // Store current positions for next frame
    this.prevPositions.set(this.positions);

    // Material state update (after velocities are computed)
    this.materialProcessor.update(dt, this.velocities, this.positions, this.materialConfig);

    // v8 Phase 8a-3 — crystal pool: advance → nucleate → project. Deliberately HERE:
    //  - `velocities` are normalised just above, so `slow` sees 0–1 values;
    //  - `temperatures` were refreshed by the call immediately above, so `cold` and the
    //    melt-on-heat probe see this frame's heat;
    //  - `modelPos` was snapshotted before the rotation loop and is not written again this frame,
    //    so a crystal is born at a correct MODEL-space position;
    //  - the rotation trig hoisted above is still in scope and has already been advanced for this
    //    frame, so the pool projects with EXACTLY the wave particles' angle — a crystal cannot
    //    lag or lead the figure by a frame;
    //  - it is upstream of getState(), so a crystal born now is published with its growth already
    //    seeded, with no one-frame flicker.
    //
    // Nucleation only READS the source wave particle. There is no write path back into
    // `positions`/`velocities`/`colors` from here — `CrystalPool` holds no generator reference.
    // No-op when the config is null or disabled (pixel-identical-when-off invariant).
    this.crystalPool.update({
      dt,
      config: this.crystalConfig,
      waveCount: this.particleCount,
      velocities: this.velocities,
      temperatures: this.materialProcessor.getTemperatures(),
      modelPos: this.modelPos,
      modelPosReady: this.modelPosReady,
      velocityDirs: this.velocityDirs,
      projection: { sinWx, cosWx, sinWy, cosWy, sinWz, cosWz, originX, originY, perspZ, figScale },
    });

    // Fire buoyancy (after material temperatures are computed, applies to projected positions)
    if (this.fireProcessor && this.buoyancyConfig.enabled) {
      const temps = this.materialProcessor.getTemperatures();
      this.fireProcessor.update(dt, temps, this.buoyancyConfig, this.positions);
      const offX = this.fireProcessor.getOffsetX();
      const offY = this.fireProcessor.getOffsetY();
      // v8 Phase 8a-3: no frozen guard. This loop covers wave particles only, and none are frozen;
      // crystals live in their own pool and are never reachable from here, so buoyancy cannot lift
      // ice.
      for (let i = 0; i < this.particleCount; i++) {
        this.positions[i * 3] = this.positions[i * 3]! + offX[i]!;
        this.positions[i * 3 + 1] = this.positions[i * 3 + 1]! + offY[i]!;
      }
    }

    // Cohesion (v8 15.4) — drops FORM. Beside fire buoyancy and for the SAME reason: its radius is in SCREEN
    // PIXELS, so it can only run downstream of the perspective projection.
    //
    // ⚠️ **DO NOT MOVE THIS BESIDE `sampleClusterForce` AT :812 EVEN THOUGH THE TWO READ AS SIBLINGS.** That
    // block runs in MODEL space and `clusterForceRadius` is in model units; a pixel radius evaluated there
    // would scale with the figure and with `perspZ` (itself `-(w+h)/2`), so the same slider value would mean a
    // different neighbourhood at every canvas size and every zoom — invariant 10 at a subsystem boundary,
    // failing plausibly rather than visibly, since a wrong-by-a-factor cohesion still beads.
    //
    // ⚠️ It also has to sit AFTER buoyancy rather than before: buoyancy displaces the projected positions, so
    // running cohesion first would gather neighbourhoods from a configuration that no longer exists by the
    // time the frame is drawn — the drops would be built around where the flames were not.
    if (this.cohesionConfig.strength > 0 && this.cohesionAllowed()) {
      if (!this.cohesionField) this.cohesionField = new CohesionField(this.particleCount);
      this.cohesionField.update(dt, this.particleCount, this.positions, this.canvasWidth, this.canvasHeight, this.cohesionConfig);
      const cohX = this.cohesionField.getOffsetX();
      const cohY = this.cohesionField.getOffsetY();
      for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        // A culled slot holds `CULL_SENTINEL` and `CohesionField` keeps its offset at exactly 0, so this adds
        // nothing there — but the test is kept explicit rather than relying on that, because a sentinel that
        // drifts by even one pixel stops being recognised by every downstream consumer that compares against
        // it (`liquid-reference.ts`'s spacing chain, the trajectory renderers' break test).
        if (this.positions[idx] === CULL_SENTINEL) continue;
        this.positions[idx] = this.positions[idx]! + cohX[i]!;
        this.positions[idx + 1] = this.positions[idx + 1]! + cohY[i]!;
      }
    }

    // Liquid field pool (v8 15.5) — the figure SWIRLS THROUGH a liquid. Beside cohesion and for the same
    // reason again: the pool lives in SCREEN PIXELS, samples a screen-space velocity field in UV, and is
    // published as screen coordinates, so it can only run downstream of the perspective projection.
    //
    // ⚠️ **This is the ONE stage in `update()` that does not touch `this.positions` at all.** Cohesion,
    // buoyancy, physarum, curl noise and the force field are five displacements of the WAVE figure; this adds
    // a SECOND POPULATION beside it. That is the whole point of relationship (B) — the curve stays a pure
    // Lissajous figure and the liquid is what responds to it — and it is why the block is a plain `update()`
    // with no offset loop underneath.
    //
    // ⚠️ **The gate is ANCHORED at the statement start and tests `enabled` FIRST**, so a preset that never
    // authored an `overlay.liquidField` block reaches neither the lazy construction nor the pool's own
    // `ensure()`. `Enable` off is therefore byte-identical to 15.4 rather than merely visually identical: no
    // allocation, `getState()`'s `liquidCount` stays 0, and every published array keeps its previous length.
    if (this.liquidFieldConfig.enabled && this.liquidFieldConfig.poolSize > 0) {
      if (!this.liquidPool) this.liquidPool = new LiquidPool();
      this.liquidPool.update(dt, this.canvasWidth, this.canvasHeight, this.liquidFieldConfig, this.liquidFieldSample);
    }

    // Spark spawning (after velocities computed)
    //
    // ⚠️ **THE EJECTION VELOCITY COMES FROM `frameMotion`, NEVER FROM `prevPositions`, AND THAT IS THE WHOLE
    // OF THE 2026-09-17 SPARK FIX.** `prevPositions.set(this.positions)` runs at the end of the velocity
    // block above, which is UPSTREAM of this statement, so the obvious `px - prevPositions[idx]` written here
    // subtracted a position from itself: every spark was born at rest and `ejectionSpeed` scaled a zero.
    // Read `frameMotion`'s declaration before touching either — the choice not to move that `set()` call is
    // load-bearing, and the spawn position still has to be the FINAL one (post-buoyancy, post-cohesion),
    // which is why this block cannot simply move up instead.
    if (this.sparkPool && this.sparkConfig.enabled) {
      let spawned = 0;
      const startIdx = Math.floor(Math.random() * this.particleCount);
      for (let j = 0; j < this.particleCount && spawned < this.sparkConfig.maxSparksPerFrame; j++) {
        const i = (startIdx + j) % this.particleCount;
        // v8 Phase 8a-3: no frozen guard. The walk covers wave particles only; a crystal pool slot
        // can never be a spark spawn source, so ice cannot shed sparks.
        if (this.velocities[i]! > this.sparkConfig.threshold) {
          const idx = i * 3;
          const px = this.positions[idx]!;
          const py = this.positions[idx + 1]!;
          // px/frame → px/s. 30 rather than 60 is the pre-existing half-speed convention and is preserved
          // deliberately: it is the number every authored `ejectionSpeed` in the library was tuned against.
          const dx = this.frameMotion[i * 2]! * 30;
          const dy = this.frameMotion[i * 2 + 1]! * 30;
          this.sparkPool.spawn(px, py, dx, dy, this.sparkConfig);
          spawned++;
        }
      }
      this.sparkPool.update(dt, this.sparkConfig);
    }

    // Advance time (time-normalized per AMB-002)
    const correction = Math.min(dt / 16.667, 6.0);
    this.pos += this.waveSpeed * correction;
  }

  getVelocityDirs(): Float32Array { return this.velocityDirs; }

  /**
   * CANONICAL SLOT ORDER: `[wave][sparks][liquid][crystals]` (v8 15.5 inserted the third block).
   *
   * Sparks, liquid-pool particles and crystals are all ADDITIVE tail blocks — the wave block is
   * always `[0, particleCount)` and always complete, so the figure never loses a particle to any of
   * them. Crystals occupy the HIGHEST indices. Every per-slot array below must cover all three tail
   * blocks in this order; mixing them is silent and invisible by eye.
   *
   * ⚠️ **THE LIQUID BLOCK IS INSERTED BEFORE CRYSTALS, NEVER APPENDED, AND THAT IS A HARD
   * CONSTRAINT RATHER THAN A CONVENTION.** `crystalCount` is published as the count of the array's
   * TRAILING block and every trajectory consumer excludes it by subtracting from `count`
   * (`neon-line-renderer.ts:95`, `ribbon-renderer.ts:299`); appending liquid after crystals would
   * make that subtraction remove liquid particles and leave the crystals in, so the ribbon and neon
   * renderers would draw strands THROUGH the crystal pool. Crystals must stay last.
   *
   * The three blocks differ in what their per-slot pads MEAN, and the differences do not follow one
   * rule:
   * - A **spark** is a free screen-space body, so its depth and velocity are meaningless and get
   *   PADDED to constants (0.5 and 1.0).
   * - A **liquid-pool particle** is also a free screen-space body — so it takes the same `depth`
   *   constant — but its speed is REAL and is published as a normalised value from the pool itself,
   *   because three consumers read `velocities` for something other than a stretch (palette mapping
   *   2, the spark spawn threshold, velocity stretch) and a constant 1.0 there would paint the whole
   *   pool at the top of the ramp. Its direction is likewise real.
   * - A **crystal** is attached to the figure and carries a REAL projected depth — the crystal pass
   *   sorts back-to-front on it — so the pad loops below are bounded to the spark AND liquid ranges
   *   only. Left unbounded they would flatten every crystal depth to 0.5 and silently disable that
   *   sort.
   */
  /**
   * v8 Phase 8b.2 — lazily allocate the cluster-force arrays on first use.
   *
   * Lazy rather than allocated in init(), because `clusterForce` defaults to 0 and most presets never
   * touch it: 5 x particleCount floats (400 KB at 20 000 particles) should not be paid to keep a
   * disabled feature disabled. Idempotent, and re-allocates if the particle count changed.
   */
  private ensureClusterScratch(): void {
    if (this.clusterForceX.length === this.particleCount) return;
    this.clusterForceX = new Float32Array(this.particleCount);
    this.clusterForceY = new Float32Array(this.particleCount);
    this.clusterScratchX = new Float32Array(this.particleCount);
    this.clusterScratchY = new Float32Array(this.particleCount);
    this.clusterScratchZ = new Float32Array(this.particleCount);
  }

  /**
   * GROW-ONLY scratch for the CONCATENATED publication arrays, reused across frames.
   *
   * `getState()` used to allocate all eight of these fresh on every frame that had a tail block, and
   * that was the cause of a reported periodic jitter: *"preset Water Ice Crystal with material Ice
   * jitters every few seconds; disabling crystals fixes it"*. Measured at that preset's real
   * population (`ParticleCount: 4000`, x5 in `migration.ts` => 20 000 wave particles, plus a ~396-slot
   * crystal tail at the default `poolSize: 600` / `freezeCap: 0.6`):
   *
   * | | |
   * |---|---|
   * | per frame | **976 KB** across 8 arrays |
   * | at 60 fps | **57 MB/s** of garbage |
   * | nursery fill | ~67 frames = **~1.1 s** |
   *
   * So a young-generation GC is forced roughly once a second, and the pause is the jitter. The period
   * the user reported is the *allocation rate*, not anything in the crystal lifecycle — which is worth
   * stating because `crystalLifetime` defaults to 8 s and is a tempting red herring.
   *
   * ⚠️ **The asymmetry in the report is the diagnostic, and it is exact.** `getState()` has a zero-copy
   * `else` branch taken when `tailCount === 0`, which publishes the generator's own persistent arrays
   * directly. Ice is in `CRYSTAL_MATERIALS` and NOT in `FIRE_BEHAVIOUR_MATERIALS`, so it enables
   * crystals without enabling sparks — meaning the crystal checkbox alone decides whether this function
   * allocates ~1 MB/frame or nothing at all. That is why toggling crystals cured it, and why no
   * fire-behaviour material shows the same thing as sharply (they allocate either way).
   *
   * ⚠️ **Grow-only is safe here ONLY because no consumer retains a published array beyond the frame,
   * which was checked rather than assumed.** Both trajectory renderers read positions element-wise into
   * their own history structures, and `grid-tile-renderer.ts` copies into `prevPositions` inside the
   * same call. Every GL consumer uploads via `bufferData` immediately.
   *
   * ⚠️ **A grown buffer is therefore LONGER than `state.count`, and `count` is the only length that may
   * be trusted.** Three consumers already test `array.length >= state.count` rather than equality, so
   * they are correct by construction; the hazard is any FUTURE consumer that derives a count from
   * `array.length`, which would read stale slots from a previous, larger frame. The `frozen` mask and
   * the spark depth/velocity pads are re-filled over the live range on every frame for exactly this
   * reason — a stale `1` left in `frozen` above the current crystal block would draw a wave particle
   * as ice.
   */
  private tailPositions = new Float32Array(0);
  private tailColors = new Float32Array(0);
  private tailTemps = new Float32Array(0);
  private tailDepths = new Float32Array(0);
  private tailVelocities = new Float32Array(0);
  private tailVelocityDirs = new Float32Array(0);
  private tailFrozen = new Uint8Array(0);
  private tailGrowth = new Float32Array(0);

  /** Grow the publication scratch to hold `total` slots. Never shrinks. */
  private ensureTailScratch(total: number): void {
    if (this.tailPositions.length >= total * 3) return;
    this.tailPositions = new Float32Array(total * 3);
    this.tailColors = new Float32Array(total * 3);
    this.tailTemps = new Float32Array(total);
    this.tailDepths = new Float32Array(total);
    this.tailVelocities = new Float32Array(total);
    this.tailVelocityDirs = new Float32Array(total * 2);
    this.tailFrozen = new Uint8Array(total);
    this.tailGrowth = new Float32Array(total);
  }

  getState(): GeneratorState {
    const sparkState = (this.sparkPool && this.sparkConfig.enabled) ? this.sparkPool.getActiveState() : null;
    const sparkCount = sparkState ? sparkState.count : 0;
    // Gated on `enabled` as well as on occupancy. The pool cannot GROW while disabled (update()
    // returns before it does anything), but a pool that already holds slots when the toggle goes
    // off must stop being published immediately: otherwise those slots stay in the concatenated
    // arrays while the crystal pass — which checks `enabled` itself — refuses to draw them, and the
    // splat path's frozen attribute is zeroed for the same reason, so the ice would reappear as
    // ordinary glowing splats. This is what makes `enabled: false` alone the whole inertness gate.
    const crystalEnabled = this.crystalConfig?.enabled === true;
    const crystalState = (crystalEnabled && this.crystalPool.getActiveCount() > 0)
      ? this.crystalPool.getActiveState()
      : null;
    const crystalCount = crystalState ? crystalState.count : 0;

    // v8 15.5. Gated on `enabled` as well as on the pool's own occupancy, exactly as sparks are and for the
    // same reason: a pool holding slots when the toggle goes off must stop being published in the SAME frame,
    // or the particles keep drawing while every control that would move them is inert. `update()`'s gate
    // already stops it advancing, so this is the second half of that one switch, not a duplicate of it.
    const liquidPoolActive = this.liquidFieldConfig.enabled && !!this.liquidPool;
    const liquidCount = liquidPoolActive ? this.liquidPool!.getCount() : 0;

    // ⚠️ `[wave][sparks][liquid][crystals]` — the liquid block is INSERTED, never appended. See the CANONICAL
    // SLOT ORDER note above for why crystals must keep the trailing position.
    const sparkBase = this.particleCount;
    const liquidBase = sparkBase + sparkCount;
    const crystalBase = liquidBase + liquidCount;
    const totalCount = crystalBase + crystalCount;
    const tailCount = sparkCount + liquidCount + crystalCount;

    let positions: Float32Array;
    let colors: Float32Array;
    let temps: Float32Array | null;
    let depths: Float32Array;
    let velocities: Float32Array;
    let velocityDirs: Float32Array;

    if (tailCount > 0) {
      // Grow-only scratch, reused across frames — see `ensureTailScratch` for the measured reason.
      // Every array is fully overwritten over `[0, totalCount)` below, so no stale slot from a
      // previous, larger frame can be read within the published range.
      this.ensureTailScratch(totalCount);

      positions = this.tailPositions;
      positions.set(this.positions);
      if (sparkState) positions.set(sparkState.positions, sparkBase * 3);
      // ⚠️ BOUNDED by `subarray` for the same reason the crystal copies below are: `LiquidPool.getPositions()`
      // returns GROW-ONLY scratch sized to the largest pool the session has held, so after a `Pool Size` drag
      // downward its length exceeds `liquidCount * 3` and a bare `.set()` would write past the liquid block
      // into the crystals (invariant 7 — `count` is the only trustworthy length).
      if (liquidCount > 0) positions.set(this.liquidPool!.getPositions().subarray(0, liquidCount * 3), liquidBase * 3);
      // ⚠️ Every crystal copy below is BOUNDED by `subarray`. `CrystalPool.getActiveState()` returns
      // CAPACITY-sized reused buffers (up to 2000 slots) while publishing only `[0, count)`, so a bare
      // `.set()` would copy the whole capacity — writing past the end of a tail block sized to
      // `crystalCount` and throwing RangeError, or silently overwriting nothing at all when the tail
      // happens to be the last block. The pool's own doc comment states the contract; honour it here.
      if (crystalState) positions.set(crystalState.positions.subarray(0, crystalCount * 3), crystalBase * 3);

      // `colors` used to be published at `particleCount * 3` while `count` was larger, so every
      // consumer indexing a spark slot's colour read past its end. Concatenating fixes that for
      // sparks (black — they are drawn by the splat pass from `temperatures`) as well as for
      // crystals (a pale ice tint, though the crystal pass takes its colour from the ramp texture).
      colors = this.tailColors;
      colors.set(this.colors);
      // Sparks have no colour of their own (the splat pass takes theirs from `temperatures`), so their
      // range is zeroed rather than left carrying a previous frame's crystal tint.
      colors.fill(0, sparkBase * 3, liquidBase * 3);
      // ⚠️ **THE LIQUID BLOCK MUST NOT INHERIT THE SPARK RANGE'S ZERO, AND THE REASON IS THAT THE POOL IS
      // DRAWN IN ALL SEVEN RENDER MODES, NOT ONLY IN `liquid`.** A spark can be black because the splat pass
      // reconstructs its colour from `temperatures`; a pool particle has no such second source, so on the five
      // point-sprite paths a zero would draw it as an invisible black dot on an additive target — *"I enabled
      // the pool and nothing happened"*, which is invariant 13's shape and the report Phase 14 collected three
      // times. It would also poison 15.2's `Σ(colour·w)` accumulation, pulling the weighted mean toward black
      // wherever the pool overlaps the figure.
      //
      // ⚠️ **ONE TINT FOR THE WHOLE POOL, sampled from the figure — not a per-slot colour.** The pool has no
      // per-particle identity to colour BY (that is the same absence 15.2's block header records for the
      // fullscreen pass), and the two obvious per-slot rules both fail: `i % particleCount` gives spatially
      // adjacent pool particles uncorrelated wave indices, so a rainbow preset renders the liquid as coloured
      // speckle rather than as a substance; and a fixed literal ignores the preset entirely. The figure's own
      // mean reads as one liquid of the figure's material, which is what relationship (B) is about.
      if (liquidCount > 0) {
        // Subsampled at a stride that caps the work at ~256 reads regardless of `particleCount`, so this stays
        // O(1) per frame at the 50 000-particle ceiling (invariant 8 — the RATE is what reached a user as a GC
        // pause, and an unsubsampled mean here would be 150 000 reads every frame for one colour).
        const step = Math.max(1, Math.floor(this.particleCount / 256));
        let cr = 0, cg = 0, cb = 0, n = 0;
        for (let i = 0; i < this.particleCount; i += step) {
          const ci = i * 3;
          cr += this.colors[ci]!; cg += this.colors[ci + 1]!; cb += this.colors[ci + 2]!;
          n++;
        }
        if (n > 0) { cr /= n; cg /= n; cb /= n; }
        for (let i = liquidBase; i < crystalBase; i++) {
          const ci = i * 3;
          colors[ci] = cr; colors[ci + 1] = cg; colors[ci + 2] = cb;
        }
      }
      if (crystalState) colors.set(crystalState.colors.subarray(0, crystalCount * 3), crystalBase * 3);

      const baseTemps = this.materialProcessor.getTemperatures();
      if (baseTemps) {
        temps = this.tailTemps;
        temps.set(baseTemps);
        if (sparkState) temps.set(sparkState.temperatures, sparkBase);
        // Liquid is COLD, and 0 is a statement rather than a pad: on the splat path a material's ramp is
        // indexed by temperature, so this is what makes the pool read as the material's coolest tone beside a
        // hot figure instead of glowing with it. It must be written every frame regardless — the scratch is
        // reused, so a stale spark temperature from a larger previous frame would otherwise survive here and
        // set part of the pool alight (the `frozen` mask's documented failure, one block over).
        temps.fill(0, liquidBase, crystalBase);
        if (crystalState) temps.set(crystalState.temperatures.subarray(0, crystalCount), crystalBase);
      } else {
        temps = null;
      }

      depths = this.tailDepths;
      depths.set(this.depths);
      // Sparks AND liquid — both are free screen-space bodies with no model-space z, so both take the same
      // mid-depth constant. Crystals supply real per-slot depths and are excluded by the bound.
      //
      // ⚠️ 0.5 is not a neutral filler here, it is the value 14.7's depth parallax and `paletteMapping: 'depth'`
      // both READ, and the engine's two depth conventions run OPPOSITE ways (invariant 24). 0.5 is the one
      // value that is the same in both, so it is the only pad that cannot silently place the pool in front of
      // or behind the figure depending on which consumer is looking.
      for (let i = sparkBase; i < crystalBase; i++) depths[i] = 0.5;
      if (crystalState) depths.set(crystalState.depths.subarray(0, crystalCount), crystalBase);

      velocities = this.tailVelocities;
      velocities.set(this.velocities);
      // Sparks inherit velocity = 1.0 (they're always fast-moving). Crystals are 0: ice does not
      // streak, and the pool's own zero-filled array is copied in below.
      for (let i = sparkBase; i < liquidBase; i++) velocities[i] = 1.0;
      // ⚠️ **THE POOL IS THE ONE TAIL BLOCK WHOSE SPEED IS REAL, so it is COPIED and not padded** — see the
      // CANONICAL SLOT ORDER note. A constant 1.0 here would put the entire pool at the top of a
      // `paletteMapping: 'velocity'` ramp (making a still pool look as fast as the figure) and, worse, above
      // `sparkConfig.threshold`, so a fire preset with sparks on would spawn embers from standing liquid. The
      // pool normalises against its own `VEL_REF`, so the published value is already 0..1.
      if (liquidCount > 0) velocities.set(this.liquidPool!.getSpeeds().subarray(0, liquidCount), liquidBase);
      if (crystalState) velocities.set(crystalState.velocities.subarray(0, crystalCount), crystalBase);

      velocityDirs = this.tailVelocityDirs;
      velocityDirs.set(this.velocityDirs);
      // Zeroed first: the loop below fills the spark range only when the pool publishes velocities, so
      // without this a stale direction from a previous frame could survive there.
      velocityDirs.fill(0, sparkBase * 2, crystalBase * 2);
      // Liquid directions are REAL and come from the pool, which already normalises them and already substitutes
      // `(0, -1)` for a slot that is standing still — the same fallback the spark loop below applies, in one
      // place rather than two. Written AFTER the `fill(0, …)` above, which covers both blocks.
      if (liquidCount > 0) velocityDirs.set(this.liquidPool!.getVelocityDirs().subarray(0, liquidCount * 2), liquidBase * 2);
      // Spark velocity directions: compute from spark velocities
      if (sparkState && sparkState.velocities) {
        for (let i = 0; i < sparkState.count; i++) {
          const si = i * 3;
          const vx = sparkState.velocities[si] ?? 0;
          const vy = sparkState.velocities[si + 1] ?? 0;
          const len = Math.sqrt(vx * vx + vy * vy);
          const offset = (sparkBase + i) * 2;
          if (len > 0.001) {
            velocityDirs[offset] = vx / len;
            velocityDirs[offset + 1] = vy / len;
          } else {
            velocityDirs[offset] = 0;
            velocityDirs[offset + 1] = -1;
          }
        }
      }
      // Crystal facet grain: captured AT BIRTH by the pool and never re-derived, so it is copied
      // rather than computed from this frame's motion.
      if (crystalState) velocityDirs.set(crystalState.velocityDirs.subarray(0, crystalCount * 2), crystalBase * 2);
    } else {
      positions = this.positions;
      colors = this.colors;
      temps = this.materialProcessor.getTemperatures();
      depths = this.depths;
      velocities = this.velocities;
      velocityDirs = this.velocityDirs;
    }

    const state: GeneratorState = {
      positions,
      colors,
      depths,
      velocities,
      count: totalCount,
      // Stable partition point for trajectory consumers — see GeneratorState.waveCount.
      waveCount: this.particleCount,
      velocityDirs,
    };
    /*
     * v8 31.2 — the packed per-particle channels. ⚠️ **PUBLISHED ONLY WHEN THE FEATURE IS ON**, so with
     * all three amounts at 0 the field is absent and every consumer takes its pre-31.2 path — the same
     * contract `temperatures` and the liquid pool have, and the gate the whole step's bit-exactness rests
     * on. ⚠️ **Computed HERE rather than in `update()` because the published length is only known here**:
     * the tail blocks need the neutral triple and `totalCount` is this function's own arithmetic.
     */
    const channels = this.writeChannels(totalCount);
    if (channels) state.channels = channels;
    if (temps) state.temperatures = temps;
    // v8 15.5. Published only when the pool holds something, so with the feature off the field is absent and
    // every consumer takes its pre-15.5 path — the same contract `crystalCount` has.
    //
    // ⚠️ **This is the count consumers use to EXCLUDE the pool, and the partition is NOT the same for all of
    // them: the discriminator is "is a pool particle drawable here", and it is answered per consumer, not
    // once.** The point/volume/splat paths INCLUDE it (a pool particle is a body and must draw); the trajectory
    // renderers, the fluid field's own seeding, the spark index range and the liquid density REFERENCE all
    // exclude it — the last because the reference measures spacing along a CURVE and the pool is a cloud.
    if (liquidCount > 0) state.liquidCount = liquidCount;
    // ⚠️ **Published only while a material is INTEGRATING, not merely while the array exists** — the same
    // "only when the pool holds something" contract as `liquidCount`/`crystalCount` above, and the fix for a
    // 2026-09-20 defect that reached the user as *"Pixel Age Palette is only black"*.
    //
    // `MaterialProcessor.init()` runs unconditionally from this generator's own init, so `getLifetimes()` is
    // non-null and `particleCount` long for EVERY preset, material or not; `update()` meanwhile returns early
    // on `preset === 'None'`, leaving it all zeros. Every consumer — `hdr-particle.ts`' age synth, the
    // TransMap force gate, `types.ts`' own field doc — was written against *"absent without a live material"*
    // and tests PRESENCE, so a full-length zero array passed the guard and was read as real data: mapping 5
    // sampled `fract(0/6) = 0` for every particle. Ask `isLive()`, never `!= null` (see its declaration).
    //
    // ⚠️ **`temperatures` above has a SECOND producer and is NOT gated with it**: sparks and crystals carry
    // their own temperatures into the merged tail array and need no material (the spark gate is
    // `sparkConfig.enabled` + a velocity threshold), so hiding it when the material is idle would drop the
    // spark block's heat from the splat ramp. That is why the mapping-3 degrade in `hdr-particle.ts` is still
    // inert and is recorded as OPEN rather than fixed here — one cause, two symptoms, two different repairs.
    // `lifetimes` has exactly one producer, which is what makes this gate safe.
    const lifetimes = this.materialProcessor.getLifetimes();
    if (lifetimes && this.materialProcessor.isLive()) state.lifetimes = lifetimes;
    const tags = this.materialProcessor.getMaterialTags();
    if (tags) state.materialTags = tags;

    // v8 Phase 8a-3: `frozen` now means "this SLOT is a crystal", not "this wave particle stopped".
    // It is 1 across exactly the crystal tail block and 0 for every wave particle and every spark.
    // Published only when the pool holds something, so with crystal off both fields are absent and
    // every renderer takes its pre-feature path unchanged.
    if (crystalState && crystalCount > 0) {
      state.crystalCount = crystalCount;
      // ⚠️ Both ranges are written EVERY frame, and that is load-bearing under the reused buffer: the
      // crystal block shrinks as crystals melt, so a stale `1` left above `totalCount` from a larger
      // previous frame would mark a WAVE particle as ice — drawn as a hard-edged occluding facet in the
      // middle of the figure. `fill(0, …)` over the non-crystal range is the guard.
      const frozen = this.tailFrozen;
      frozen.fill(0, 0, crystalBase);
      frozen.fill(1, crystalBase, totalCount);
      state.frozen = frozen;

      // `growth` rides the same gate. Non-crystal slots get 1.0, not 0: the vertex shader only
      // applies growth under `aFrozen > 0.5`, but 1.0 is the neutral value and keeps the array
      // meaningful if any other consumer ever reads it.
      const growth = this.tailGrowth;
      growth.fill(1, 0, crystalBase);
      growth.set(crystalState.growth.subarray(0, crystalCount), crystalBase);
      state.growth = growth;
    }
    return state;
  }

  setBuoyancyConfig(config: BuoyancyConfig): void {
    this.buoyancyConfig = config;
    if (!config.enabled && this.fireProcessor) {
      this.fireProcessor.reset();
    }
  }

  setSparkConfig(config: SparkConfig): void {
    this.sparkConfig = config;
    if (!config.enabled && this.sparkPool) {
      this.sparkPool.reset();
    }
    // Reallocate only when the requested size differs from the ALLOCATED CAPACITY.
    //
    // This compared against `getActiveCount()` — the number of LIVE sparks — until 2026-08-06. The two
    // agree only in the instant the pool happens to be exactly full, so almost every call took the
    // reallocate branch and destroyed every in-flight spark. With 14 call sites (a material swap, any
    // Sparks slider, every preset change, `resetOverlays`) the visible effect was sparks repeatedly
    // vanishing mid-flight for reasons unrelated to pool size.
    if (this.sparkPool && config.poolSize !== this.sparkPool.getCapacity()) {
      this.sparkPool.dispose();
      this.sparkPool = new SparkPool(config.poolSize);
    }
  }

  /**
   * v8 15.4. ⚠️ **Calling this with `strength: 0` must RELEASE the accumulated offsets, not merely stop
   * integrating them** — otherwise the figure stays permanently beaded at the neutral value, i.e. a control
   * that cannot be undone, which reads as a corrupted preset rather than as a slider at 0. Same contract as
   * `setBuoyancyConfig`'s `fireProcessor.reset()`, and for the same reason: both own integrated state that
   * outlives the frame in which it was earned.
   */
  setCohesionConfig(config: CohesionConfig): void {
    this.cohesionConfig = config;
    if (config.strength <= 0 && this.cohesionField) {
      this.cohesionField.reset();
    }
  }

  /**
   * v8 15.5 — the liquid pool's config, and the same discontinuity contract as `setCohesionConfig` /
   * `setBuoyancyConfig`: turning the feature OFF returns the integrated state to its origin, so switching it
   * back on gives the authored pattern rather than wherever a minute of stirring had carried the particles.
   *
   * ⚠️ **The pool is NOT reallocated on a `poolSize` change, unlike `setSparkConfig`'s pool** — and the
   * difference is a property of the two seeding rules, not a style choice. A spark pool's slots are
   * interchangeable, so `SparkPool` reallocates and loses whatever was in flight; `LiquidPool.ensure()` grows
   * in place and seeds only the APPENDED slots, because its Halton seeding makes `seed(i)` independent of the
   * pool's size. Reallocating here would re-seed every existing particle on every one of the 121 stops of a
   * `Pool Size` drag — the pool would visibly tear apart and re-form under the handle.
   */
  setLiquidFieldConfig(config: LiquidFieldConfig): void {
    this.liquidFieldConfig = config;
    if (!config.enabled && this.liquidPool) {
      this.liquidPool.reset();
    }
  }

  /**
   * Hand the pool its field sampler for the coming frame. `null` leaves it standing still.
   *
   * ⚠️ **A SETTER RATHER THAN AN ARGUMENT TO `update()`, because the generator interface is shared** — every
   * other `Generator` implementation would have to grow the parameter, and the sampler exists only for this one.
   * It is re-set every frame by `main.ts` rather than latched, so a fluid processor that stops running (a preset
   * change, a chain without style 6, a context that refused the float target) makes the pool still on the very
   * next frame instead of leaving it reading a torn-down buffer — invariant 3's shape: the capability dies with
   * the resource that provides it.
   */
  setLiquidFieldSample(sample: ((u: number, v: number, channel: number) => number) | null): void {
    this.liquidFieldSample = sample;
  }

  /**
   * The particle ceiling the step mandates: *"Specify a particle count ceiling above which cohesion is
   * skipped with a `log()`, never silently."*
   *
   * ⚠️ **MEASURED, and the measurement is what makes it a formality rather than a limit.** The shipped
   * cloud-in-cell stage costs 1.407 ms at 20 000 particles and 3.939 ms at the hard `MAX_PARTICLE_COUNT` of
   * 50 000 (radius 16, 1024×768) — so the ceiling sits ABOVE anything the UI can request and the feature is
   * never actually skipped. It exists because the spec asked for one and because a future step could raise
   * the count ceiling; the alternative mechanism (per-particle `SpatialHash.queryRadius`, which the spec
   * named) measured **19.49 ms at 20 000** and would have needed a ceiling near 4 000, i.e. below every
   * liquid preset in the library. The `log()` fires ONCE, not per frame — a per-frame warning at 60 Hz is
   * how a diagnostic becomes the thing that has to be diagnosed.
   *
   * ⚠️ **THE 3.939 ms IS THE COST OF ONE INTEGRATED STEP, AND SINCE 2026-09-25 THAT IS NO LONGER ONE PER
   * FRAME** — `CohesionField.MIN_STEP_MS` samples the field at most every 33.4 ms and the loop below applies
   * the standing offsets every frame, so the amortised cost at 60 fps is about half. The figure above is still
   * the right one for THIS decision (whether a single step can be afforded at all) and must not be halved to
   * suit the other one. Read `MIN_STEP_MS` before quoting either.
   */
  private cohesionAllowed(): boolean {
    if (this.particleCount <= COHESION_MAX_PARTICLES) return true;
    if (!this.cohesionSkipWarned) {
      this.cohesionSkipWarned = true;
      console.warn(`[Cohesion] Skipped: ${this.particleCount} particles exceeds the ${COHESION_MAX_PARTICLES} ceiling. Reduce Particle Number to bead the figure.`);
    }
    return false;
  }

  setAttractor(params: AttractorParams | null, tier?: AttractorTileTier): void {
    this.strand = null;   // v8 Phase 37 — a strand never outlives the attractor it was walked on
    this.attractorTier = tier ?? null;
    if (!params) {
      this.attractorParams = null;
      this.attractorState = null;
      this.attractorBlend = 0;
      return;
    }
    this.attractorParams = params;
    this.attractorBlend = params.blend;
    const warm = tier?.prewarmed;
    if (warm && warm.x.length === this.particleCount) {
      // A tile's shared-cache state: COPIED, so each tile iterates its own population from the same start.
      this.attractorState = {
        x: warm.x.slice(), y: warm.y.slice(), z: warm.z.slice(), rx: warm.rx.slice(), ry: warm.ry.slice(),
        renderReady: warm.renderReady, cursor: warm.cursor,
        centreX: warm.centreX, centreY: warm.centreY, centreZ: warm.centreZ,
      };
    } else {
      this.attractorState = createAttractorState(this.particleCount);
      initAttractorState(this.attractorState, params, 0, tier);
    }
    this.attractorX = new Float32Array(this.particleCount);
    this.attractorY = new Float32Array(this.particleCount);
    this.attractorZ = new Float32Array(this.particleCount);
  }

  // `resumeAttractor()` and `getAttractorState()` were removed on 2026-08-06.
  //
  // They existed to carry attractor state across a preset switch, and were called only from the
  // arrow-key handler in `main.ts`. That call NEVER TOOK EFFECT: the handler went on to trigger
  // `applyPresetChange`, which disposes the generator and calls `setAttractor()` — allocating a
  // fresh state via `createAttractorState()` and discarding the resumed one. So no preset-change
  // path ever preserved attractor state, despite the extraction recording that arrow keys uniquely
  // did (finding M19, since corrected). The redundant inline block was removed with defect M2 and
  // both methods were left with zero callers.
  //
  // If attractor continuity is wanted, it belongs in `applyPresetChange` so every path behaves the
  // same — not in one handler that another code path immediately overwrites.
  setAttractorBlend(blend: number): void {
    this.attractorBlend = Math.max(0, Math.min(1, blend));
  }

  /**
   * v8 Phase 37 — the attractor LAYOUT and the strand's scalars, CLAMPED here (the one owner of the bounds). A
   * layout or base-span change drops the strand so it is rebuilt against the new values; the other four only
   * re-resolve per frame. ⚠️ **The cloud layout is the identity**: with `'cloud'` nothing on the strand path runs.
   */
  setAttractorStrand(c: AttractorStrandSettings): void {
    const span = Math.max(STRAND_SPAN_MIN, Math.min(STRAND_SPAN_MAX, c.span));
    const layout: AttractorLayout = c.layout === 'strand' ? 'strand' : 'cloud';
    if (layout !== this.strandLayout || span !== this.strandSpan) this.strand = null;
    this.strandLayout = layout;
    this.strandSpan = span;
    this.strandSpanDepth = Math.max(0, Math.min(STRAND_SPAN_MAX, c.spanDepth));
    this.strandSpanRate = Math.max(0, c.spanRate);
    this.strandAdvance = Math.max(STRAND_ADVANCE_MIN, Math.min(STRAND_ADVANCE_MAX, c.advance));
    this.strandAdvanceDepth = Math.max(0, Math.min(STRAND_ADVANCE_MAX, c.advanceDepth));
    this.strandAdvanceRate = Math.max(0, c.advanceRate);
  }

  /** The clamped values in force, read back by the caller so the panel and every export carry what runs. */
  getAttractorStrand(): AttractorStrandSettings {
    return {
      layout: this.strandLayout, span: this.strandSpan, spanDepth: this.strandSpanDepth, spanRate: this.strandSpanRate,
      advance: this.strandAdvance, advanceDepth: this.strandAdvanceDepth, advanceRate: this.strandAdvanceRate,
    };
  }

  /** True while the STRAND is what is drawn: the strand layout, a strand-capable type, and a live blend. */
  isStrandActive(): boolean {
    return this.strandLayout === 'strand' && !!this.attractorParams && !!this.attractorState
      && this.attractorBlend > 0 && STRAND_CAPABLE[this.attractorParams.type];
  }

  /**
   * How strongly an attractor is actually displacing particles this frame — `0` when none is.
   *
   * ⚠️ **The gate is the SAME three-part condition `update()` uses** (`attractorState &&
   * attractorParams && attractorBlend > 0`), and that is the point of the method: `main.ts` cannot
   * answer this question from its own state. It holds `currentBlend`, which is set to
   * `DEFAULT_ATTRACTOR_BLEND` (0.6) by BOTH overlay-apply paths *even when `currentAttractorIndex` is
   * -1* — so "is an attractor running" and "what is `currentBlend`" are independent there, and a
   * `currentBlend > 0` test reports 0.6 with no attractor selected at all.
   *
   * Added 2026-08-13 for the TransMap fractal fade, which needs one number that is non-zero exactly
   * when the attractor is live, regardless of WHICH of the two routes (`preset.fractal` or
   * `overlay.attractorIndex`) selected it.
   */
  getEffectiveAttractorBlend(): number {
    if (!this.attractorState || !this.attractorParams) return 0;
    return this.attractorBlend;
  }

  getSparkPool(): SparkPool | null {
    return this.sparkPool;
  }

  dispose(): void {
    this.positions = new Float32Array(0);
    this.prevPositions = new Float32Array(0);
    this.colors = new Float32Array(0);
    this.depths = new Float32Array(0);
    this.escapes = new Float32Array(0);   // v8 33.5 — invariant 1, with its siblings
    this.velocities = new Float32Array(0);
    this.deformEnergy = new Float32Array(0);
    this.deformEnergyLive = false;
    this.velocityDirs = new Float32Array(0);
    this.frameMotion = new Float32Array(0);
    this.materialConfig = null;
    this.buoyancyConfig = { enabled: false, strength: 1.5, returnForce: 2.0, turbulence: 0.3, maxOffset: 200, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 };
    this.sparkConfig = { enabled: false, poolSize: 500, threshold: 0.6, ejectionSpeed: 1.2, gravity: 200, drag: 1.5, minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3.0, maxSparksPerFrame: 5 };
    // v8 15.4. Reset to the default OBJECT rather than left holding the last preset's block, exactly as the
    // two config literals above are — `dispose()` is followed by `init()` and a preset that omits `cohesion`
    // must not inherit the previous one's beading (invariant 14's shape at teardown).
    this.cohesionConfig = { ...DEFAULT_COHESION_CONFIG };
    this.cohesionSkipWarned = false;
    // v8 15.5, same reasoning one step further: a preset that omits `liquidField` must not inherit the previous
    // one's pool. And here the stake is higher than an inherited look — this block changes `state.count`, so an
    // inherited `enabled: true` would leave a stale population in every published array.
    this.liquidFieldConfig = { ...DEFAULT_LIQUID_FIELD_CONFIG };
    // The sampler is a closure over a processor that `dispose()` precedes tearing down. Dropping it here means
    // a generator reused before `main.ts` re-sets it publishes a still pool rather than calling into a dead
    // processor (invariant 1 — the handle is nulled, not merely its resource released).
    this.liquidFieldSample = null;
    this.materialProcessor.dispose();
    this.crystalPool.dispose();
    if (this.fireProcessor) { this.fireProcessor.dispose(); this.fireProcessor = null; }
    // Invariant 1 — the handle is NULLED as well as disposed, so `update()`'s lazy construction reallocates
    // instead of calling into a torn-down instance.
    if (this.cohesionField) { this.cohesionField.dispose(); this.cohesionField = null; }
    if (this.liquidPool) { this.liquidPool.dispose(); this.liquidPool = null; }
    if (this.sparkPool) { this.sparkPool.dispose(); this.sparkPool = null; }
    this.attractorState = null;
    this.attractorParams = null;
    this.attractorX = new Float32Array(0);
    this.attractorY = new Float32Array(0);
    this.attractorZ = new Float32Array(0);
  }
}
