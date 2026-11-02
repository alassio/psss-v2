import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type { RibbonMode } from '../../../renderers/ribbon-renderer.ts';
import type { RenderMode, WaveConfig } from '../../../core/interfaces.ts';
import type { OverlayState, FilmLookParams, IfsTransform, PhysarumConfig, FluidAdvectionConfig, MaterialConfig, BuoyancyConfig, SparkConfig, VolumeRenderConfig, LiquidSurfaceConfig, LiquidTintSource, LiquidColourMixModel, CohesionConfig, LiquidFieldConfig, LiquidSeedPattern, DyeFieldConfig, ColourRampName, ProceduralFlowConfig, FluidFeedbackConfig, CrystalRenderConfig, UnifiedPreset, TransMapLayer, TransMapStyle, ForceGateSource, SinMagicParams } from '../../../presets/types.ts';
import { CUSTOMIZE_FILM_LOOK, type PaletteMapping } from '../../../renderers/film-looks.ts';
import {
  PALETTE_MAPPING_LABELS,
  PALETTE_MAPPING_ORDER,
  // ⚠️ `PALETTE_UNSET` is deliberately NOT imported since 21.4g: this tab neither offers "inherit" as an
  // option nor reads the raw override, so an import would be the first step back towards two answers.
  type PaletteSelection,
} from '../../../renderers/palette-selection.ts';
import {
  ALL_STYLES,
  conformalOf,
  styleOwnsBody,
  BAND_SPLIT_DEFAULTS,
  ECHO_STYLE,
  PARALLAX_DEFAULTS,
  REFRACTION_DEFAULTS,
  TIME_WARP_DEFAULTS,
  TRANS_MAP_STYLES,
  TRANS_MAP_STYLE_NAMES,
  bandSplitOf,
  isInertModifier,
  isSeparableStyle,
  isWeightless,
  makeLayer,
  parallaxOf,
  refractionOf,
  timeWarpOf,
  vortexOf,
} from '../../../post-processors/trans-map-chain.ts';
/*
 * ⚠️ **21.12's §H SPLIT IS REVERSED (owner, 2026-09-23), AND THE RULE THAT REPLACES IT IS NOT "TWO OWNERS ARE
 * FINE" — IT IS "ONE OWNER OF THE DATA, TWO EDITORS OF IT".** §H removed every styles-0-3 control from this
 * file and left a pointer at the Transmap tab, on the reasoning that a `Strength` slider in two places is
 * state that goes out of sync. The owner's instruction is that the chain is assembled HERE, so every per-layer
 * setting must be editable HERE: *"all settings which can be configured per transmap style including selecting
 * strength, drift, style preset, zoom centers etc as part of a chain except the wave tables shall still be
 * editable in the Visual Fx tab directly where we assemble a transmap chain"*.
 *
 * ⚠️ **What makes that safe is that there was never any per-tab STATE to diverge.** Both tabs read and write
 * the same chain through `getTransMapChain()` / `setTransMapChain()` — one door, and both getters COPY
 * (invariant 12). Neither tab caches a layer: every handler in both re-reads the chain. So the thing §H feared
 * is only reachable by introducing a cached copy, which is the property to protect rather than the import list.
 *
 * ⚠️ **THE WAVE TABLES ARE THE ONE THING THAT STAYS SINGLE-OWNER, AND THEY ARE NOT CHAIN STATE.** The terms
 * live in `workingPreset.postProcessors.transMap.sinMagicParams`, i.e. they are PRESET data shared by every
 * layer, so a per-layer term editor would be a control that silently edits all the others. They are the
 * Transmap tab's alone, and `Pattern` here is the only field-shape surface this tab has.
 *
 * ⚠️ **The MEASUREMENT is shared as a FUNCTION, not copied as a method.** `updateStaticReadout` below is three
 * calls into `field-measure.ts` — the same module the Transmap tab measures through — so the two tabs cannot
 * print different numbers for one field. A re-transcribed 64x64 scan here would be the copy that drifts.
 */
import {
  PATTERN_CUSTOM,
  STATIC_FIELD_DEFAULTS,
  STATIC_FIELD_DETAIL_MAX,
  STATIC_FIELD_DETAIL_MIN,
  STATIC_FIELD_DETAIL_STEP,
  STATIC_FIELD_STRENGTH_STEP,
  STATIC_FIELD_STRENGTH_TRACK,
  WARP_SHAPES,
  WARP_SHAPE_LABELS,
  WAVE_ANGLE_STEP,
  WAVE_ANGLE_TRACK,
  findArchetype,
  patternNames,
  staticFieldOf,
} from '../../../post-processors/static-field.ts';
import {
  SHAPE_NOTICES,
  SHIFT_SHAPE_NOTICES,
  ZOOM_SHAPE_NOTICES,
  describeStaticField,
  fieldCentre,
  measureStaticField,
  shapeNoticeKeys,
} from '../field-measure.ts';
import type { ShapeNoticeKey } from '../field-measure.ts';
import { FLOW_ARCHETYPES, getFlowArchetype } from '../../../post-processors/flow-archetypes.ts';
import { IFS_PRESETS, getIfsPreset, defaultIfsParams } from '../../../post-processors/ifs-presets.ts';
import { getAllPaletteNames } from '../../../presets/palettes.ts';
import { PHYSARUM_TRAIL_COLOUR_AUTO, PHYSARUM_TRAIL_COLOUR_PRESET } from '../../../generators/physarum.ts';
import { sliderMul } from '../../../exploration/slider-mappings.ts';
import { ROT_STEP, fmtRotationRpm, posToRotation, rotationToPos } from '../../../core/rotation-track.ts';
import { CONTROL_TIPS, HEADER_TIPS } from '../tooltips.ts';
import { makeCollapsible, type Collapsible } from '../collapsible.ts';
import type { ChannelDriver } from '../../../core/interfaces.ts';
// v8 Phase 30 — the deformation clamps, shared with the generator's own setters rather than typed
// twice: a range min is cosmetic and a clamp is not. See core/deform-limits.ts.
import {
  TWIST_MAX_TURNS,
  TAPER_MAX, TAPER_STEP, BEND_MAX_RATE, fmtTaper, fmtBend,
  // v8 33.2/33.3 — the basis and the sweep. Bounds shared with the generator, never typed twice.
  SHARPNESS_MAX, SHARPNESS_STEP, fmtSharpness, TRAVEL_MAX, TRAVEL_STEP, fmtTravel,
  // v8 `34.2`/`34.3`/`34.4` — Offset, Grow, the four breathing depths, the shared rate TRACK and `fmtDepth`.
  // ⚠️ `OP_RATE_TRACK` is the only `toPos`/`fromPos` pair in `deform-limits.ts`; a tracked spec's `min`/`max`
  // are POSITIONS (0..1), which is what `trackcheck` §G2 asserts over every tracked call site in this file.
  OFFSET_MAX, OFFSET_STEP, fmtOffset, GROW_FLOOR, GROW_MAX, GROW_STEP, fmtGrow,
  SHARPNESS_DEPTH_MAX, TRAVEL_DEPTH_MAX, OFFSET_DEPTH_MAX, GROW_DEPTH_MAX,
  OP_RATE_STEP, OP_RATE_TRACK, fmtDepth,
  INVERT_STEP, INVERT_RADIUS_MIN, INVERT_RADIUS_MAX,
  fmtInvertAmount, fmtInvertRadius, TWIST_STEP, fmtTwistTurns,
  BOX_FOLD_MAX_ITERATIONS, BOX_FOLD_MIN_LIMIT, BOX_FOLD_LIMIT_STEP,
  BOX_FOLD_MIN_SCALE, BOX_FOLD_MAX_SCALE,
  fmtFoldIterations, fmtFoldLimit, fmtFoldScale,
  CHANNEL_MAX, CHANNEL_STEP, CHANNEL_DRIVERS, fmtChannelAmount,
  W_SCALE_MAX, W_STEP, W_WINDING_MAX, fmtWAngle, fmtWScale, fmtWWinding,
} from '../../../core/deform-limits.ts';

/**
 * v8 `31.2` (`E112`/`E113`/`E137`) — **the channel drivers' labels, and this record is the half of the
 * enumeration that `tsc` actually enforces.**
 *
 * ⚠️ **`Record<ChannelDriver, string>` FORCES A LABEL FOR A NEW UNION MEMBER, which `CHANNEL_DRIVERS`
 * cannot do** — an annotated array proves each entry IS a driver, never that every driver is present. So
 * the two together close the gap in both directions: add a member and this file stops compiling; add it
 * here and `deform-limits.ts` is where you then add the value. **`REEL_*_LABELS` is the precedent and the
 * reason is identical: a list typed by hand in a tab is how the Time Warp picker came to offer two of its
 * three sources.**
 *
 * ⚠️ **The stored words and the shown words are DIFFERENT and only this record may hold the shown ones**
 * — the Reel's rule verbatim: a label persisted, or a stored word printed, is the defect.
 */
const CHANNEL_DRIVER_LABELS: Record<ChannelDriver, string> = {
  // v8 33.5 — ⚠️ the option is REMOVED from the live list when no escape-time attractor is running
  // (33.D17), so this label is for the two Julia/Mandelbrot cases only. It still belongs in the total
  // Record: `tsc` is what forces a label to exist at all, and a missing one is a build error rather than
  // a blank row.
  escape: 'Escape time (distance from the set)',
  index: 'Along the curve',
  velocity: 'Speed',
  depth: 'Depth',
  colourPhase: 'Colour cycle',
};

/*
 * v8 Phase 30 — **the three picker vocabularies, each the ONE list its control is built from.**
 *
 * ⚠️ **THEY EXIST BECAUSE A HARD-CODED OPTION LIST MADE TWO BUILT FEATURES UNREACHABLE** (owner report,
 * 2026-10-22). The Time Warp source picker named two of its three members and its change handler was a
 * ternary mapping anything unrecognised to `'field'` — so the engine's `coordinate` source could not be
 * selected and, had it been, would have been silently discarded. **Building the control FROM the list and
 * validating the change AGAINST it is the only shape in which the two cannot disagree.**
 */
const TIME_WARP_SOURCES: readonly (readonly ['field' | 'density' | 'coordinate', string])[] = [
  ['field', 'Field (warp strength)'],
  ['density', 'Density (trail alpha)'],
  ['coordinate', 'Coordinate (slit-scan)'],
];

const TIME_WARP_AXES: readonly (readonly ['x' | 'y' | 'radial', string])[] = [
  ['x', 'Across the frame'],
  ['y', 'Down the frame'],
  ['radial', 'Out from the centre'],
];

const CONFORMAL_MAPS: readonly (readonly ['power' | 'inverse' | 'logPolar' | 'mobius', string])[] = [
  ['power', 'Power z^n (petals)'],
  ['inverse', 'Inverse 1/z (turn inside out)'],
  ['logPolar', 'Log-polar (Droste spiral)'],
  ['mobius', 'Mobius (lens)'],
];

/*
 * v8 Step 21.4e — the seconds arithmetic and the phrase that states it, IMPORTED rather than re-derived.
 *
 * ⚠️ **`POS_PER_SECOND`'s factor of 60 is invariant 10's territory** and its own header says what a factor of 60
 * out looks like: a control reading "40 s" over a 0.67 s flicker, with `tsc` seeing every term as `number`. The
 * `Colour Drift` readout below is the second consumer of that factor; a local copy would be the second owner.
 */
import { modulatorSeconds, periodPhrase, SLOT_LABELS } from '../composer-model.ts';
/*
 * v8 15.5 — imported for `LiquidPool.MAX_PARTICLES` alone, and deliberately imported rather than restated.
 * `CLAUDE.md`'s own rule for a range whose engine has its own clamp: **share the constant, never assert that two
 * literals agree.** A `Pool Size` maximum written out here would be invariant 13's shape — the engine clamps to
 * its own ceiling in `LiquidPool.update()`, so a UI maximum above it is silently inert travel and one below it
 * makes reachable pool sizes unreachable. The pool owns the number; this file reads it.
 */
import { LiquidPool } from '../../../generators/liquid-pool.ts';

/**
 * Inverse of `sliderMul`: scale -> 0-1 slider position. Needed to place the handle when the value comes
 * from a preset rather than from a drag.
 *
 * ⚠️ **EXPORTED for the Composer's Framing & Timing repeat** — same reason as `fmtSpeed` below: the
 * Composer repeats this slider verbatim and must not own a second copy of the curve.
 */
export function figureScaleToPos(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pos = (Math.log2(s) / Math.log2(5) + 1) / 2;
  return Math.max(0, Math.min(1, pos));
}

/**
 * Two decimals below 1x where the steps are fine, two above as well, but always suffixed.
 * ⚠️ **EXPORTED for the Composer's Framing & Timing repeat** (one owner per readout).
 */
export function fmtFigureScale(scale: number): string {
  return `${scale.toFixed(2)}x`;
}

/**
 * Drift: 0..1 cells/s on a SQUARED track, so the slow end gets most of the travel.
 *
 * ⚠️ **The engine-side normalisation (`effectiveFrequency`) and this track fix two DIFFERENT halves of the
 * same report, and neither one substitutes for the other.** Normalisation removed the 128x spread *between*
 * patterns — one slider value now means one speed everywhere. This track fixes the distribution *within* the
 * slider: even normalised, the interesting range is the bottom of it, because a cell per 4 s already reads as
 * a clear slide and 1 cell/s reads as a fast crawl. Squaring gives the 0..0.25 cells/s range half the travel
 * instead of a quarter of it, so `0.25` sits at the midpoint.
 *
 * Squared rather than logarithmic (the `sliderMul` curve Figure Scale uses) because the value has a
 * MEANINGFUL ZERO that has to stay exactly reachable — 0 is "standing lattice", the default on all 190
 * presets, and a log track has no zero at all. `pos*pos` is exact at both ends: 0 -> 0 and 1 -> 1.
 *
 * Measured, at `step = 0.005`: the handle at 50 % of travel gives 0.25 cells/s (one cell per 4 s), at 25 %
 * gives 0.063, and the value -> position -> value round trip is exact (0 error over 201 values), so a preset
 * load places the handle where a drag would have left it. The bottom ~3 % of travel quantises to exactly 0 —
 * kept deliberately, because 0 is the categorical "standing lattice" every shipped preset uses and a sticky
 * zero makes it easy to return to; the values it swallows (below 0.001 cells/s, i.e. slower than one cell per
 * 1000 s) are indistinguishable from standing anyway.
 *
 * ⚠️ **EXPORTED SINCE v8 21.12, AND THE REASON IS THAT ITS ONLY CONSUMER MOVED.** The `Drift` slider now lives
 * on the **Transmap** tab (§H reduced this tab's `Static field` body to a pointer), so this constant is
 * imported from there rather than copied into it — the same rule the Composer's `Framing & Timing` section
 * follows for `sliderMul` and `ROT_STEP`: **a differently-shaped `<div>` is visible, a drifted curve is not.**
 * `trackcheck` already imports this module for `SPEED_*`, `PARTICLE_SIZE_*` and `COLOUR_DRIFT_TRACK`, so
 * exported track constants living here is the established shape and not a new one.
 */
export const DRIFT_TRACK = {
  toPos: (v: number): number => Math.sqrt(Math.max(0, Math.min(1, v))),
  // Quantised to a 0.001 grid, so a handle at rest reports a round number rather than 0.087916... — the value
  // is exported, and an export is mostly runtime-default noise already.
  fromPos: (pos: number): number => Math.round(pos * pos * 1000) / 1000,
};

/**
 * Animation Speed: 0.01x-5.0x on a SQUARED track (2026-08-20; was linear 0.1-5.0 at `step` 0.05).
 *
 * The request was only "make the min 0.01 so it can go slower". The min alone would not have delivered it:
 * on the linear track the whole 0.01-0.10 range is **1.8 % of the travel** — about 5 px of a 300 px slider —
 * so the new range would have existed and been unusable, and `step: 0.05` could not have reached a single
 * value inside it (its first stop above the min is 0.06). Both the curve and the step follow from the min.
 *
 * Measured on the shipped track (`step: 0.002`, 501 stops):
 *
 *   - 0.01-0.10 gets **13.4 %** of the travel (linear: 1.8 %), and 0.01-1.0 gets **44.5 %** (linear: 19.8 %).
 *     So 1.0x — the default and the value the old track put at 18.4 % — sits just below the midpoint, and
 *     each half of the slider is one direction, the same argument Figure Scale's log curve makes above.
 *   - the value is quantised to a **0.01 grid** and floored at MIN, giving 376 distinct speeds; the
 *     value -> position -> value round trip is **exact** for every speed in the library (0.4, 0.5, 0.6, 0.7,
 *     0.75, 0.9, 1.0, 1.2, 1.5) and for 0.01/0.02/0.05/0.1/2/3/5, so a preset load leaves the handle where a
 *     drag would have.
 *   - the bottom **3.2 %** of travel quantises to exactly 0.01. Kept, for the reason `DRIFT_TRACK` keeps its
 *     sticky zero: the extreme is the point of the change and a sticky end makes it easy to return to.
 *
 * Squared rather than the logarithmic `sliderMul` Figure Scale uses, because `sliderMul` is symmetric about
 * a centre of 1.0 and its endpoints are reciprocal (0.2x/5x). Here the ends are 0.01x and 5x — a 500x spread
 * with the interesting part all at the bottom — so there is no centre to be symmetric about.
 *
 * ⚠️ **The engine clamp had to move too.** `setSpeedFactor` in `main.ts` clamped to `Math.max(0.1, ...)`, so
 * a UI-only min change would have been INERT below 0.1 (invariant 13) — the handle would move and the
 * figure would not. `slider-mappings.ts`'s Speed slider is a separate 0.5x-2x multiplier that writes
 * `overlay.speedFactor` through the same setter and inherits the new floor.
 */
// Exported and consumed by `setSpeedFactor` in `main.ts`, the same way `MIN/MAX_PARTICLE_COUNT` are, rather
// than left as a literal in both places: the UI min is cosmetic and the engine clamp is what the render loop
// obeys, so two copies of the number can drift into exactly the inert control invariant 13 describes. One
// constant makes that drift unrepresentable, which is worth more than a checker asserting the two agree.
export const SPEED_MIN = 0.01;
export const SPEED_MAX = 5.0;
/** Track resolution. Exported with the mappings so `trackcheck` measures the step the descriptor uses. */
export const SPEED_STEP = 0.002;
export const SPEED_TRACK = {
  toPos: (v: number): number => {
    const s = Number.isFinite(v) ? Math.max(SPEED_MIN, Math.min(SPEED_MAX, v)) : 1;
    return Math.sqrt((s - SPEED_MIN) / (SPEED_MAX - SPEED_MIN));
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const v = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * p * p;
    // ⚠️ **The `max` is UNREACHABLE at the current constants** — measured: the lowest value over all 501 stops
    // is 0.01, at position 0, because the curve only ever climbs from `SPEED_MIN` and 0.01 survives the 0.01
    // grid exactly. It is kept as a floor against a future `SPEED_MIN` below 0.005, which WOULD round to 0 and
    // freeze the animation at a position that is not the end of the track. Do not read it as live protection:
    // what actually catches that case is `trackcheck`'s "no stop maps to 0" assertion, which was falsified by
    // deleting this `max` and did NOT fail — the honest reason it is here is cheapness, not necessity.
    return Math.max(SPEED_MIN, Math.round(v * 100) / 100);
  },
};

/**
 * Two decimals, suffixed, matching Figure Scale — both are multipliers and are read side by side.
 *
 * ⚠️ **EXPORTED for v8 16.19 (E110), and the export is the whole of what that step needed from this file.**
 * The Composer repeats this slider verbatim, so it imports `SPEED_MIN`/`SPEED_MAX`/`SPEED_STEP`/`SPEED_TRACK`
 * **and this formatter**; a second `v.toFixed(2) + 'x'` at the other site would be a second owner of the
 * readout, which is the shape `CLAUDE.md` names for slider tracks (*"the READOUT's precision is part of the
 * same property"*). ⚠️ **The phase plan asserted this was ALREADY exported and it was not** — it was
 * module-private, and only trying the import found that out. **Re-derive a plan's premise; do not build on it.**
 */
export function fmtSpeed(v: number): string {
  return `${v.toFixed(2)}x`;
}

/**
 * Particle Size: a global 0.25x-4x multiplier on every particle path's base size, on a LOGARITHMIC track.
 *
 * `pos = (log2(v) + 2) / 4`, so 1.00x sits at **exactly** the track centre (`log2(1) = 0`, giving 0.5) and each
 * half of the travel is a factor of 4. That symmetry is the reason for a log track rather than the squared
 * curve `SPEED_TRACK` uses: this is a multiplier with a meaningful identity in the middle, and halving must
 * cost the same travel as doubling — the same argument `sliderMul` makes for Figure Scale, expressed directly
 * here because the endpoints are 0.25/4 rather than `sliderMul`'s 0.2/5.
 *
 * ⚠️ **`STEP = 0.0125` was chosen by MEASURING the track, not by picking a round number, and the deciding
 * property is not resolution — it is which values EXIST.** Values are quantised to 2 decimals in the STORED
 * unit, so two constraints compete: consecutive stops must not collide on that grid, and the OCTAVES of a log
 * track are the values a user aims at. `1/STEP` must therefore be a multiple of the octave count 4, or the
 * stops straddle 0.5x and 2x instead of landing on them. Measured over four candidates: **0.0125 gives 81
 * stops, all 81 distinct, with 0.5x / 1.00x / 2.00x all EXACTLY reachable** and a worst adjacent gap of 0.010
 * — exactly on the quantisation grid, so nothing collides. `0.02` (51 stops, also all distinct) was the first
 * draft and is strictly worse: `1/0.02 = 50` is not a multiple of 4, so **half and double are both
 * unreachable** (0.51 and 2.06 are the nearest stops) while only the centre survives. `0.01` collides — 101
 * stops, 99 distinct. This is the reachability failure class `trackcheck` was written for: the handle moves,
 * nothing throws, and the round number the user typed simply never appears.
 *
 * ⚠️ **The engine clamp shares these constants**, exactly as `SPEED_MIN`/`SPEED_MAX` do: `main.ts`'s
 * `setParticleSize` imports them rather than repeating 0.25 and 4, because a UI-only range change would be
 * inert against a separate engine clamp (invariant 13) and a UI-only clamp would let an imported preset
 * exceed the track and then be silently rewritten on the first drag.
 *
 * ⚠️ **The readout prints an estimated PIXEL size beside the multiplier, and that is not decoration.** The
 * base size differs by mode (3.0 pixel/blend, 5.0 star, `splatRadius * 1.5` volume) and the
 * point paths clamp to `ALIASED_POINT_SIZE_RANGE[1]` — commonly 64 — while the material splat path does not,
 * because it draws quads. So the same 4.00x is a visible doubling in one mode and hits a hardware ceiling in
 * another, and a bare multiplier would be a control whose readout cannot tell the user which. The number comes
 * from `HDRParticleRenderer.estimateParticlePixels()`, the one owner that can see mode, canvas and material at
 * once — never recomputed here (invariant 17).
 */
export const PARTICLE_SIZE_MIN = 0.25;
export const PARTICLE_SIZE_MAX = 4.0;
/** Track resolution. Exported with the mappings so `trackcheck` measures the step the descriptor uses. */
export const PARTICLE_SIZE_STEP = 0.0125;
/** `log2(MAX/MIN)` — the number of octaves the track spans. 4, at the shipped constants. */
const PARTICLE_SIZE_OCTAVES = Math.log2(PARTICLE_SIZE_MAX / PARTICLE_SIZE_MIN);

export const PARTICLE_SIZE_TRACK = {
  toPos: (v: number): number => {
    const s = Number.isFinite(v) ? Math.max(PARTICLE_SIZE_MIN, Math.min(PARTICLE_SIZE_MAX, v)) : 1;
    return Math.log2(s / PARTICLE_SIZE_MIN) / PARTICLE_SIZE_OCTAVES;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const v = PARTICLE_SIZE_MIN * Math.pow(2, p * PARTICLE_SIZE_OCTAVES);
    // Quantise in the STORED unit — the multiplier — not in position. Quantising position instead would make
    // which values EXIST depend on the curve, which is the trap `core/rotation-track.ts` documents: an RPM
    // grid dropped exact round trips on a library authored in degrees per second.
    return Math.max(PARTICLE_SIZE_MIN, Math.min(PARTICLE_SIZE_MAX, Math.round(v * 100) / 100));
  },
};

/** Two decimals, suffixed, matching Figure Scale and Speed — all three are multipliers read side by side. */
function fmtParticleSize(v: number): string {
  return `${v.toFixed(2)}x`;
}

/**
 * Iso Level: **0.0625–4.0 multiples of the ON-CURVE density reference**, on a log track.
 *
 * ⚠️ **THE PHASE PLAN'S PROPOSED RANGE (0.2–20) IS ARITHMETICALLY UNWORKABLE AND WAS REPLACED BY
 * MEASUREMENT, NOT BY PREFERENCE.** `log2(20/0.2) = 6.6438…` octaves — a NON-INTEGER — and the reachability
 * rule `Particle Size` derives above requires `1/STEP` to be a multiple of the octave count, which no step
 * can satisfy against a fractional one. Measured over 11 candidate steps on 0.2–20: **every one missed at
 * least one of 2.5 (the plan's own default), 5 and 10.** So the range is the thing that had to move.
 *
 * ⚠️ **THE RANGE MOVED AGAIN AT 15.1b (0.25–16 → 0.0625–4), AND IT IS A CONSEQUENCE OF THE REFERENCE CHANGE
 * RATHER THAN A SECOND OPINION ABOUT THE UI.** 15.1's reference was the FRAME mean; `liquid-reference.ts` now
 * measures the density ON the curve, which is 1–2 orders of magnitude larger, so every authored ratio slides
 * down by that factor. It was not guessed: whole-octave candidate ranges were swept and scored on two metrics
 * over 8 presets — the fraction of the track's travel that lies between "solid sheet" and "gone", and the
 * cross-preset spread of the half-erosion point. **0.0625–4 won at 79 % mean / 62 % worst-case travel and a
 * 4.9× spread**, against 0.125–4 at 71 % (the range I assumed before measuring, and it was worse).
 *
 * **0.0625–4.0 is exactly 6 octaves, and at `STEP = 1/120` it measures: 121 stops, all 121 DISTINCT, every
 * octave (0.0625 / 0.125 / 0.25 / 0.5 / 1 / 2 / 4) exactly reachable, every stop round-tripping exactly
 * through `sanitize`, worst adjacent relative gap 3.64 %.**
 *
 * ⚠️ **THE 2-DECIMAL QUANTISER SURVIVED THE RANGE CHANGE AS A DEFECT AND HAD TO MOVE WITH IT — a quantiser is
 * part of the track, not of the display.** At the old 0.25 anchor two decimals was harmless; at 0.0625 it
 * measures **only 100 of 121 stops distinct, a worst gap of 14.29 %, and the 0.125 anchor MISSED outright**
 * (`Math.round(0.125 * 100)/100 = 0.13`). Three decimals still misses the 0.0625 min. **Four is the first that
 * is exact at every anchor** — which is invariant 10's shape one level up: the units were right and the
 * RESOLUTION silently stopped matching the range.
 *
 * A log track rather than a linear one because this is a RATIO with a meaningful identity: the interesting
 * span is roughly 0.3–2 (merged sheet to separated drops) and a linear 0.0625–4 would compress all of it into
 * the first 50 % of the travel with the upper half dead.
 *
 * ⚠️ **The value is a RATIO against the reference, so it is NOT scaled for preview tiles** — see
 * `grid-tile-renderer.ts`. Kernel Width is a dimensionless multiplier and is not scaled either; only ABSOLUTE
 * PIXELS take `SCREEN_SPACE_TILE_SCALE`.
 */
export const ISO_LEVEL_MIN = 0.0625;
export const ISO_LEVEL_MAX = 4.0;
export const ISO_LEVEL_STEP = 1 / 120;
const ISO_LEVEL_OCTAVES = Math.log2(ISO_LEVEL_MAX / ISO_LEVEL_MIN);

export const ISO_LEVEL_TRACK = {
  toPos: (v: number): number => {
    const s = Number.isFinite(v) ? Math.max(ISO_LEVEL_MIN, Math.min(ISO_LEVEL_MAX, v)) : 1;
    return Math.log2(s / ISO_LEVEL_MIN) / ISO_LEVEL_OCTAVES;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const v = ISO_LEVEL_MIN * Math.pow(2, p * ISO_LEVEL_OCTAVES);
    // Quantised in the STORED unit, as every other non-linear track here is — see PARTICLE_SIZE_TRACK. FOUR
    // decimals, not the usual two: see the header. `1e4` is exact for every anchor down to 0.0625.
    return Math.max(ISO_LEVEL_MIN, Math.min(ISO_LEVEL_MAX, Math.round(v * 10000) / 10000));
  },
};

/**
 * ⚠️ **THREE decimals, not the usual two, and the count was MEASURED against the track rather than chosen for
 * looks:** over the 121 stops `toFixed(2)` yields only **100 distinct labels** — the bottom octave reads
 * `0.06 / 0.07 / 0.07 / 0.07 / 0.08 …`, so several distinct handle positions print the same number and the
 * readout stops being a readout. `toFixed(3)` gives 121/121. This is `trackcheck`'s readout-uniqueness
 * assertion, and it is the same finding the Rotation sliders produced from the opposite direction (there, too
 * MANY decimals separated values that quantise together).
 *
 * No suffix: the unit is "multiples of the surface density reference", which the tooltip names.
 *
 * Exported for `trackcheck` §H only, exactly as `fmtRotationRpm` is — the assertion has to run the REAL
 * formatter over the REAL stops, or it measures a transcription instead of the readout.
 */
export function fmtIsoLevel(v: number): string {
  return v.toFixed(3);
}

/**
 * v8 Step 15.1 — Kernel Width: **0.5–16.0× the liquid sprite's base radius**, on a log track.
 *
 * Exactly 5 octaves, so the same reachability rule applies and `STEP = 1/150` satisfies it: **151 stops, all
 * 151 distinct, 0.5 / 1 / 2 / 4 / 8 / 16 all exactly reachable, worst adjacent gap 3.85 %.** Log rather than
 * linear for the same reason as Particle Size — it is a multiplier whose identity sits in the middle, and
 * halving the merge distance must cost the same travel as doubling it.
 *
 * ⚠️ **WIDENED FROM 0.5–4.0 ON 2026-10-19 (owner), AND `STEP` HAD TO MOVE WITH THE RANGE — that is the part
 * a range change invites you to forget.** `1/150 = 1/90 x 3/5` keeps the resolution PER OCTAVE identical, so
 * the worst adjacent gap is still 3.85 % rather than 5.17 %. **Measured: keeping `1/90` across five octaves
 * would have left 10 of the 16 distinct authored library values off the grid** (`1.48 1.52 1.62 1.70 1.95
 * 2.05 2.35 2.41 2.58 3.10`) — *an authored value the track cannot represent is a defect, and it has one
 * more failure mode: a centre-restore can never return to it.* `trackcheck` §H asserts that, so the mistake
 * fails there rather than in a browser; the measurement was taken first and the checker then confirmed it.
 *
 * ⚠️ **THE TOP OF THIS RANGE IS NOT ALWAYS LIVE, AND THE LIMIT IS NOT IN THIS FILE.** The accumulation pass
 * draws point sprites, so `liquidPointDiameter()` clamps the diameter to the driver's
 * `ALIASED_POINT_SIZE_RANGE[1]` (fallback 64). Above that clamp Kernel Width is **exactly inert, not merely
 * diminishing** — `uIsoRef`'s frame-mean reference is derived from the SAME clamped number, so both stop
 * moving together. The clamp is canvas-dependent: at a 64 px ceiling and `particleSize` 1 it bites at
 * kernelWidth 8.00 at 1024x768, 4.78 at 1920x1080 and **2.39 at 3840x2160**. ⚠️ **So part of this widened
 * track is unreachable on a large canvas, which the owner accepted when asking for 16 — the real remedy is
 * instanced quads in the accumulation pass (the crystal pass already uses them and has no such ceiling),
 * and that is its own piece of work.** Do not "fix" the saturation by moving this constant again.
 *
 * ⚠️ **This one IS in texels, so the preview tiles scale it by `SCREEN_SPACE_TILE_SCALE`.** It multiplies a
 * pixel radius that is already canvas-scaled, so it is a multiplier on a length — the tile decision follows
 * from the UNIT, not from the field name.
 */
export const KERNEL_WIDTH_MIN = 0.5;
export const KERNEL_WIDTH_MAX = 16.0;
export const KERNEL_WIDTH_STEP = 1 / 150;
const KERNEL_WIDTH_OCTAVES = Math.log2(KERNEL_WIDTH_MAX / KERNEL_WIDTH_MIN);

export const KERNEL_WIDTH_TRACK = {
  toPos: (v: number): number => {
    const s = Number.isFinite(v) ? Math.max(KERNEL_WIDTH_MIN, Math.min(KERNEL_WIDTH_MAX, v)) : 1;
    return Math.log2(s / KERNEL_WIDTH_MIN) / KERNEL_WIDTH_OCTAVES;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const v = KERNEL_WIDTH_MIN * Math.pow(2, p * KERNEL_WIDTH_OCTAVES);
    return Math.max(KERNEL_WIDTH_MIN, Math.min(KERNEL_WIDTH_MAX, Math.round(v * 100) / 100));
  },
};

/** Suffixed like the other multipliers on this tab (Speed, Figure Scale, Particle Size). */
function fmtKernelWidth(v: number): string {
  return `${v.toFixed(2)}x`;
}

/**
 * v8 Step 15.4 — Cohesion Radius: **4–64 SCREEN PIXELS**, on a log track.
 *
 * Log because it is a length whose effect is scale-free: it sets the drop SIZE, and going 8 → 16 px must cost
 * the same travel as 16 → 32. Measured on `Liquid Surface` at 15 000 particles, r = 4 / 8 / 16 / 24 / 40 / 64
 * gives 101 / 173 / 103 / 66 / 30 / 4 connected blobs of median 55 / 52 / 53 / 87 / 207 / 1085 px — so the
 * whole shipped range is live, and above 64 the count collapses to 1 (the figure is one lump again, i.e. the
 * feature undoes itself, which is why the range stops there rather than at a rounder number).
 *
 * ⚠️ **Range derived from WHOLE OCTAVES FIRST, then the step** — `log2(64/4)` is **exactly 4**, and
 * `1/STEP = 120` is a multiple of 4, so every octave boundary EXISTS as a stop. Measured over the 121 stops:
 * 121/121 distinct values, `toFixed(1)` gives **121/121 distinct labels** (`toFixed(0)` gives only 57, so a
 * whole-pixel readout would make roughly half the drags read as inert — the same defect Iso Level's
 * `toFixed(2)` had), worst adjacent gap **4.00 %**, and 4 / 8 / 16 / 32 / 64 all land exactly.
 * ⚠️ **That 4.00 % is `trackcheck`'s measurement over the real stops, and this comment first said 2.44 %** —
 * an arithmetic estimate of the geometric ratio that ignored the 0.1 px rounding in `fromPos`, which widens the
 * bottom gaps. Well under the 8 % ceiling either way, so the assertion was green while the note was wrong:
 * **re-run the checker rather than doing arithmetic on a figure quoted here** (CLAUDE.md's own standing rule).
 *
 * ⚠️ **These ARE absolute pixels, so a preview tile would have to scale them by `SCREEN_SPACE_TILE_SCALE`** —
 * the `splatRadius` category, not the `kernelWidth` one. It does not arise today because tiles run no
 * cohesion at all (see `buildCohesionSection`), but a step that gives them one must apply the factor.
 */
export const COHESION_RADIUS_MIN = 4;
export const COHESION_RADIUS_MAX = 64;
export const COHESION_RADIUS_STEP = 1 / 120;
const COHESION_RADIUS_OCTAVES = Math.log2(COHESION_RADIUS_MAX / COHESION_RADIUS_MIN);

export const COHESION_RADIUS_TRACK = {
  toPos: (v: number): number => {
    const s = Number.isFinite(v) ? Math.max(COHESION_RADIUS_MIN, Math.min(COHESION_RADIUS_MAX, v)) : COHESION_RADIUS_MIN;
    return Math.log2(s / COHESION_RADIUS_MIN) / COHESION_RADIUS_OCTAVES;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const v = COHESION_RADIUS_MIN * Math.pow(2, p * COHESION_RADIUS_OCTAVES);
    // Quantised in the STORED unit (pixels), matching the readout's one decimal — a stored value finer than
    // the label would make the round trip inexact and the handle jump on first touch.
    return Math.max(COHESION_RADIUS_MIN, Math.min(COHESION_RADIUS_MAX, Math.round(v * 10) / 10));
  },
};

/**
 * ⚠️ **ONE decimal, and the count was MEASURED over the real stops, not chosen** — `toFixed(0)` yields only
 * **57 distinct labels** across the 121 stops, so the bottom two octaves print `4 / 4 / 4 / 5 / 5 …` and about
 * half of the drags read as doing nothing. `toFixed(1)` gives 121/121.
 *
 * Exported for `trackcheck` §H only, exactly as `fmtIsoLevel` and `fmtRotationRpm` are: the assertion must run
 * the REAL formatter over the REAL stops or it is measuring a transcription.
 */
export function fmtCohesionRadius(v: number): string {
  return `${v.toFixed(1)} px`;
}

/**
 * v8 Step 21.4e — **Index Cycles** (`generators.colorFreq`): how many colour cycles the legacy colour law
 * completes around the particle index, per channel. **0 … 2016**, sticky zero then LOGARITHMIC.
 *
 * ## The range is the library's, measured — not chosen
 *
 * Census over the composed library (276 presets, 828 channels, 2026-09-18 — the WHOLE library, **not** the
 * `index`-mapping reach set, whose own maximum is far lower and which is the wrong basis for a track because
 * any preset can be loaded): **0 … 2016**, smallest non-zero **0.002**, **22 zero channels**, **no negatives**,
 * 34 distinct channel values in 36 distinct vectors. `Multiple` alone carries 2016 / 1008 / 50; `Quasar`
 * carries 16 on all three. So the track must span **six decades** and must reach 0 exactly.
 *
 * ⚠️ **Negatives are deliberately unreachable**, and that is not laziness: the law is
 * `sin(n · freq / DEG + …)`, odd in `freq`, so `−f` is the same colour sequence read backwards around a ring —
 * indistinguishable on a closed figure. Half the travel would buy nothing. (`colorShift` is different: it
 * multiplies `pos`, so its sign is a direction in TIME and one preset authors it negative.)
 *
 * ## Why a sticky zero rather than a log track anchored at 0.002
 *
 * 0 is **categorical**, not small: at `freq === 0` every particle gets the same colour and the whole figure is
 * one flat hue. 22 authored channels are 0. A pure log map has no zero at all, so the bottom 2 % of the travel
 * quantises to it, exactly as `rotationToPos` keeps 9.6 % for its own categorical zero. 2 % rather than 10 %
 * because the values just above (0.002 = one cycle per 500 particles) are perfectly usable here, where a
 * sub-0.002-RPM rotation is not.
 *
 * ## Quantised to FOUR SIGNIFICANT FIGURES, in the stored unit — and that is what makes the library exact
 *
 * A fixed decimal grid cannot serve six decades: 0.001 is coarser than the whole bottom decade, and 0.0001
 * would print eight digits at the top. Four significant figures is the one grid every authored value fits —
 * `0.002`, `0.193`, `2016` and `1008` all have ≤ 4 — and measured over the 2001 stops it gives:
 *
 *   - endpoints EXACT: 0 and 2016 (`CYCLES_MAX` *is* `Multiple`'s value, so pos 1 lands on it by construction);
 *   - **1962 distinct values and 1962 distinct labels — 1:1**, so no drag anywhere reads as inert;
 *   - **zero non-zero dead runs** (every non-zero stop has its own value), against a 60-stop house ceiling;
 *   - IDEMPOTENT at all 2001 stops, so repeated resyncs cannot make a value creep;
 *   - worst adjacent gap **0.79 %**.
 *
 * ⚠️ **TWO ROUND TRIPS WEAR THE SAME WORDS, and only one of them is what a browser does.** `fromPos(toPos(v))`
 * is exact for **34 of 34** authored values — and that is the WRONG instrument, because the `<input>` snaps the
 * position to its own `min + k·step` grid first. Through that grid only **4 of 34** are exact; the rest move by
 * up to **0.35 %**, which is half the worst adjacent gap and therefore the best any 2001-stop grid over six
 * decades can do. It is not a defect and it is not fixable by a finer `step`: exactness would need a stop whose
 * value rounds to each authored number, and a step fine enough for that reintroduces the dead runs. What makes
 * it harmless is asserted separately (`trackcheck` §J): **a resync writes the handle and the readout from the
 * STORED value and never calls the setter**, so a load cannot rewrite a preset — only a deliberate drag of that
 * channel moves it, by less than the label's own resolution at that point on the track.
 *
 * ⚠️ **Re-run the checker rather than doing arithmetic on those figures** — they move with the library.
 */
export const CYCLES_MIN = 0.002;
export const CYCLES_MAX = 2016;
/** Fraction of the travel that quantises to the categorical 0. Measured at 2.0 % over the real stops. */
const CYCLES_ZERO_BAND = 0.02;
const CYCLES_SPAN = Math.log(CYCLES_MAX / CYCLES_MIN);
export const CYCLES_STEP = 0.0005;
/** Significant figures in the STORED unit. See the header for why a fixed decimal grid cannot work here. */
const CYCLES_SIGFIG = 4;

/**
 * Round to `sig` significant figures. Module-private and used by `CYCLES_TRACK` alone — a general-purpose
 * helper here would invite a second caller with a different `sig`, which is how one grid becomes two.
 */
function toSignificant(v: number, sig: number): number {
  if (!(v > 0)) return 0;
  const exp = Math.ceil(Math.log10(v));
  const f = Math.pow(10, sig - exp);
  return Math.round(v * f) / f;
}

export const CYCLES_TRACK = {
  toPos: (v: number): number => {
    // `!(v > 0)` rather than `v <= 0`, so a NaN from an imported preset parks on the zero stop rather than
    // producing NaN as a slider position (which the element silently reads as its `min`).
    if (!(Number.isFinite(v) && v > 0)) return 0;
    const c = Math.max(CYCLES_MIN, Math.min(CYCLES_MAX, v));
    return CYCLES_ZERO_BAND + (1 - CYCLES_ZERO_BAND) * Math.log(c / CYCLES_MIN) / CYCLES_SPAN;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    // STRICTLY below the band, so `toPos(CYCLES_MIN) === CYCLES_ZERO_BAND` maps back to `CYCLES_MIN` and the
    // smallest authored value is on the track rather than one stop inside the dead zone. `CYCLES_ZERO_BAND`
    // is an exact multiple of `CYCLES_STEP` (0.02 / 0.0005 = 40) so that boundary IS a stop.
    if (p < CYCLES_ZERO_BAND) return 0;
    const raw = CYCLES_MIN * Math.exp(((p - CYCLES_ZERO_BAND) / (1 - CYCLES_ZERO_BAND)) * CYCLES_SPAN);
    return toSignificant(Math.max(CYCLES_MIN, Math.min(CYCLES_MAX, raw)), CYCLES_SIGFIG);
  },
};

/**
 * ⚠️ **FOUR SIGNIFICANT FIGURES, the same grid `fromPos` quantises to, which is why it is 1:1 over the stops.**
 * A fixed `toFixed(3)` was measured first and is wrong: it collapses the bottom of the range, giving **1482
 * labels over 1962 values and a 48-stop run all reading `0.003`** — half the bottom decade reading as inert.
 * `Number(v.toPrecision(4))` strips the trailing zeros `toPrecision` leaves, so `0.002` prints as `0.002` and
 * `2016` as `2016` rather than `2.016e+3`.
 *
 * `Flat` at 0, not `0`, for `fmtSymmetryFold`'s reason: 0 is categorical here — every particle takes the same
 * colour and the figure is a single hue — and a bare `0.000` reads as "a very slow cycle".
 *
 * Exported for the checker, exactly as `fmtIsoLevel` / `fmtCohesionRadius` / `fmtRotationRpm` are: the
 * assertion has to run the REAL formatter over the REAL stops or it measures a transcription.
 */
export function fmtIndexCycles(v: number): string {
  if (v === 0) return 'Flat';
  return String(Number(v.toPrecision(CYCLES_SIGFIG)));
}

/**
 * v8 Step 21.4e — **Colour Drift** (`generators.colorShift`): how fast each channel's hue drifts with the
 * figure's sweep. **±3**, SIGNED QUARTIC with a sticky zero.
 *
 * Census over the same 276 presets: **−0.1 … 3**, smallest non-zero magnitude **0.001**, **26 zero channels**,
 * **exactly one negative channel**, 30 distinct values in 31 vectors — and **every one is a multiple of
 * 0.001** except `0.1001`.
 *
 * ⚠️ **Named `COLOUR_DRIFT_*` and not `DRIFT_*`: the static field's lattice drift already owns that prefix in
 * this file, and the two are different quantities in different units** — cells per second there, radians of
 * phase per `pos` unit here. `tsc` caught the collision on the track itself, which was luck: the three scalars
 * around it are unique names and would have compiled, leaving two `DRIFT_STEP`-shaped constants one screen
 * apart.
 *
 * ⚠️ **Signed, because this one's sign is a DIRECTION IN TIME.** `colorShift` multiplies `pos`, so `−s` runs the
 * hue sweep the other way — a visibly different animation, and one preset authors it. That is the whole
 * difference from `CYCLES_TRACK` above, whose parameter multiplies the particle INDEX and is therefore even in
 * effect.
 *
 * Quartic rather than logarithmic for `rotationToPos`'s reason: 0 is categorical (26 channels), a log map has
 * no zero, and `sign(p)·|p|^4` is exact at 0 and at both ends by construction. Measured over 2001 stops:
 * endpoints exactly ±3; **1345 distinct values and 1345 distinct labels — 1:1**; worst non-zero dead run
 * **36 stops**, inside the 60-stop house ceiling; sticky zero **11.3 %** of the travel; idempotent at every stop.
 *
 * ⚠️ **The round-trip figure depends on WHICH round trip, exactly as `CYCLES_TRACK`'s header says.** Ignoring the
 * element's position grid, **29 of 30** authored values are exact (the one exception is `0.1001 → 0.100`, whose
 * READOUT is unchanged). Through the grid the `<input>` actually applies, **18 of 30** are exact and the worst
 * deviation is **0.004**, at the authored `2` — where adjacent stops are 0.008 apart, so that IS the nearest
 * stop. A curved track cannot do better, and the harmlessness is the same property §J relies on: nothing
 * rewrites a stored value on a resync.
 *
 * ⚠️ **`DRIFT_STEP` is 0.001 and NOT 0.0005, and the two were measured against each other**: the finer step
 * doubles the dead run at the smallest representable magnitude to **72 stops**, past the ceiling, and buys no
 * new values the 0.001 grid can hold.
 */
export const COLOUR_DRIFT_MAX = 3;
const COLOUR_DRIFT_CURVE = 4;
export const COLOUR_DRIFT_STEP = 0.001;
/** Quantisation grid in the STORED unit. Every authored value but `0.1001` is a multiple of it. */
const COLOUR_DRIFT_GRID = 0.001;

export const COLOUR_DRIFT_TRACK = {
  toPos: (v: number): number => {
    const c = Math.max(-COLOUR_DRIFT_MAX, Math.min(COLOUR_DRIFT_MAX, Number.isFinite(v) ? v : 0));
    return Math.sign(c) * Math.pow(Math.abs(c) / COLOUR_DRIFT_MAX, 1 / COLOUR_DRIFT_CURVE);
  },
  fromPos: (pos: number): number => {
    const p = Math.max(-1, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const mag = COLOUR_DRIFT_MAX * Math.pow(Math.abs(p), COLOUR_DRIFT_CURVE);
    // ⚠️ `toFixed(3)` on the way out, not just `Math.round(raw / GRID) * GRID` — that product yields
    // `0.7000000000000001` for the authored `0.7`, which is a DIFFERENT number from the preset's and breaks the
    // exact round trip by a float artefact rather than by the grid.
    //
    // ⚠️ **Quantise the MAGNITUDE and re-apply the sign — never `Math.round` a signed value.** `Math.round`
    // breaks ties toward +∞, so a magnitude landing exactly on a half-grid went one way on the right of centre
    // and the other way on the left: `fromPos(0.5)` gave `0.188` while `fromPos(-0.5)` gave `-0.187`. The track
    // then was not an ODD function, which is the one property a signed track of a DIRECTION has to have, and the
    // error was 1 LSB of the last printed decimal — invisible in the figure, invisible to `tsc`, and caught only
    // by asserting `fromPos(-p) === -fromPos(p)` over the stops (`trackcheck` §K).
    const q = Number((Math.round(mag / COLOUR_DRIFT_GRID) * COLOUR_DRIFT_GRID).toFixed(3));
    // `Math.sign(p) * 0` is `-0`, which prints as `0` and compares equal but is a different stored number.
    return q === 0 ? 0 : Math.sign(p) * q;
  },
};

/**
 * ⚠️ **THREE DECIMALS EVERYWHERE, matching `COLOUR_DRIFT_GRID` — measured 1:1 over the stops.** The adaptive
 * precision `fmtRotationRpm` needs is wrong here, and for a reason specific to this quantity: there, two
 * decimals were forced by values that could not round-trip; here the grid IS three decimals, so a coarser label
 * would only hide the difference between stops. At two decimals the 1345 values collapse to 781 labels — two
 * thirds of every drag reading as inert.
 *
 * ⚠️ This prints the value it is GIVEN, which on a resync is the preset's stored number rather than the handle's
 * stop — so an authored value the position grid cannot hold still reads exactly as authored. That is deliberate
 * and is the reason the inexact round trip above is harmless; see `COLOUR_DRIFT_TRACK`'s header.
 *
 * `Off` at 0 rather than `0.000`, because 0 is categorical: the channel's hue does not move at all.
 */
export function fmtColourDrift(v: number): string {
  if (v === 0) return 'Off';
  return (v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
}

/**
 * `colorShift` is in RADIANS of phase per `pos` unit; `modulatorSeconds` wants the modulators' unit, where a
 * cycle is `360 / rate`. One cycle of the drift is `2π / |shift|`, so the equivalent rate is
 * `360 / (2π / |shift|) = |shift| · 180/π`. See `driftPeriod()` for what getting this backwards looks like.
 */
const DRIFT_RATE_PER_UNIT = 180 / Math.PI;

/**
 * v8 Step 21.4f — the swatch strip: how many colours are shown, and how wide each one is drawn.
 *
 * **64 samples, and the number is the population's own sweep rather than a pixel budget.** The strip is a
 * picture of `val[c] = base + sin(i · 360/count · freq/DEG + …)`, sampled with `count = 64` — so it shows one
 * full traverse of the index domain whatever the live particle count is, which is what makes it comparable
 * between a 400-particle and a 40 000-particle preset. It undersamples a high `Cycles` value by construction
 * (aliasing above 32 cycles), and that is honest: the figure itself is sampled at ITS count and aliases too.
 */
const INDEX_SWATCH_SAMPLES = 64;
const INDEX_SWATCH_CELL = 3;

/**
 * Particle Number: 1-50 000 on a CUBIC track, so the sparse end gets most of the travel.
 *
 * `pos = ((count - 1) / 49999) ^ (1/3)`. Counts 1-2 000 are 4 % of the value range and get 34 % of the
 * slider, while 20 000-50 000 — where several thousand particles either way is barely visible — is
 * compressed into the top 26 %. A linear track would have given everything below 2 000 just 4 % of the
 * travel, i.e. about 12 px of a 300 px slider, and the whole sparse-figure range would be unreachable in
 * practice.
 *
 * Cubic rather than the logarithmic `sliderMul` curve the Figure Scale slider uses, for two reasons:
 * `sliderMul` is symmetric about a centre of 1.0, which is meaningful for a multiplier and meaningless
 * for an absolute count; and a pure log map would hand 42 % of the track to the 1-100 range, which is
 * below the point where a Lissajous figure reads as a curve at all. Exact at both ends by construction,
 * and the round trip is exact at every value in the library (500, 2 500, 5 000, 10 000, 20 000, 40 000).
 */
export const MIN_PARTICLE_COUNT = 1;
export const MAX_PARTICLE_COUNT = 50000;

/**
 * Trail Decay's upper bound, and the ENGINE's clamp — `main.ts`'s `setDecayFactor` imports this rather than
 * repeating the literal, per the CLAUDE.md track rule that a range `min`/`max` is cosmetic while the engine's
 * clamp is what actually moves.
 *
 * ⚠️ **0.99 and not 1.0, for a reason that is not taste.** The fade pass draws black at `alpha = 1 - decay`, so
 * at 1.0 it draws nothing at all — and `sanitiseTrail()`'s siblings aside, `dst * 1.0` reproduces any NaN or
 * Inf that reaches the trail *forever*, with no decay left to drain it (`main.ts`'s own note on the feedback
 * loop). 0.99 still gives a ~100-frame trail, longer than any value in the library: the highest authored is
 * the migrated `MotionBlur 8` = 0.9876543 that **70 presets** carry, which is representable here.
 *
 * ⚠️ **LINEAR, not the log/cubic curve the neighbouring controls use, and that is a derivation rather than a
 * default.** The quantity a user perceives is the trail's LENGTH in frames, `L = 1/(1-d)`, which is already
 * strongly expansive in `d`: a linear track spends its top 15 % on L = 6.7 -> 100, and its bottom half on
 * L = 1 -> 2. A log curve on `d` itself would pull travel toward `d -> 0`, i.e. toward the range where there is
 * no trail at all, and compress exactly the 0.85-0.99 band where every authored value in the library lives.
 *
 * ⚠️ **STEP 0.001 IS SET BY THE READOUT, NOT PICKED.** 991 stops against a 3-decimal label is exactly 991
 * distinct labels — 1:1, so no drag can read as inert (the failure the CLAUDE.md track rule measures as "100
 * labels over 121 stops"). A coarser 0.005 was written here first and was wrong on the library: the migrated
 * `MotionBlur 8` value **0.9876543 that 70 presets carry** falls between its stops, and an authored value the
 * track cannot represent is a defect. At 0.001 it lands on 0.988 — 0.0003 away, L = 83.3 against 81.0 — and
 * that residue is only ever written if the user actually drags the control, `syncFromControls` setting the
 * slider's position without writing back.
 */
export const MAX_TRAIL_DECAY = 0.99;
export const TRAIL_DECAY_STEP = 0.001;
const PARTICLE_CURVE = 3;
/** Below this the count is left alone; at or above it, it snaps to a multiple of `PARTICLE_SNAP`. */
export const PARTICLE_SNAP = 100;
/** Track resolution — coupled to `PARTICLE_SNAP`; see the descriptor's doc block for the measurement. */
export const PARTICLE_STEP = 0.0005;

export function particleCountToPos(count: number): number {
  const c = Number.isFinite(count) ? count : MIN_PARTICLE_COUNT;
  const clamped = Math.max(MIN_PARTICLE_COUNT, Math.min(MAX_PARTICLE_COUNT, c));
  const norm = (clamped - MIN_PARTICLE_COUNT) / (MAX_PARTICLE_COUNT - MIN_PARTICLE_COUNT);
  return Math.pow(norm, 1 / PARTICLE_CURVE);
}

/**
 * Snap a count to the nearest multiple of 100 (2026-08-20) — "very odd numbers are not needed".
 *
 * ⚠️ **Counts below 100 are passed through UNSNAPPED, and that exception is load-bearing.** Rounding them
 * would collapse the entire 1-99 range onto 100 or 0, and it is neither empty nor decorative: two shipped
 * presets live there — `Lonely Particle` at **1** and `Alpha Particles` at **88** — so a blanket rule would
 * make both unreachable from the slider and would silently rewrite them on the first drag. 100 is also where
 * `MIN_PARTICLE_COUNT = 1` anchoring puts the bottom **12.6 %** of the travel, so the exception costs nothing
 * at the useful end: every stop from 12.6 % upward snaps.
 *
 * The `min` with MAX is a guard, not a live path: measured over every stop, 0 of them snap above 50 000,
 * because 50 000 is itself a multiple of 100 so the curve's top value rounds to itself. It matters only if
 * MAX ever stops being one — and unlike the `SPEED_TRACK` floor, a checker CANNOT catch that case, since the
 * only observable would be a count above a MAX that the same edit moved.
 */
function snapParticleCount(count: number): number {
  if (count < PARTICLE_SNAP) return count;
  return Math.min(MAX_PARTICLE_COUNT, Math.round(count / PARTICLE_SNAP) * PARTICLE_SNAP);
}

export function posToParticleCount(pos: number): number {
  const p = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
  const raw = Math.round(MIN_PARTICLE_COUNT + (MAX_PARTICLE_COUNT - MIN_PARTICLE_COUNT) * Math.pow(p, PARTICLE_CURVE));
  return snapParticleCount(raw);
}

/**
 * Thousands separator, because five-digit counts are the common case and misread without one.
 * ⚠️ **EXPORTED for the Composer's Framing & Timing repeat** (one owner per readout).
 */
export function fmtParticleCount(count: number): string {
  return count.toLocaleString('en-US');
}

/**
 * E30 Symmetry Fold. Prints `Off` at 1 rather than `1-fold`, because 1 is the identity and "1-fold
 * symmetry" reads as though something were happening.
 *
 * ⚠️ **MODULE-PRIVATE AGAIN AS OF 2026-09-10, WHICH IS THE SYMMETRIC UNDO OF THE EXPORT THE COMPOSER'S FRAMING
 * REPEAT ASKED FOR — the owner removed that row the same day it shipped.** Re-checked rather than assumed: the
 * only reader is this file's own `Symmetry` row, and `trackcheck` MENTIONS this function in a comment about
 * `fmtRotationRpm`'s `Off` but does not import it (it imports the module and reads `fmtIsoLevel` /
 * `fmtCohesionRadius` only). **`tsc` reports nothing about an unused export, so the narrowing is by hand or not
 * at all** — an export whose stated reason has gone reads as a dependency to the next reader.
 */
function fmtSymmetryFold(n: number): string {
  return n <= 1 ? 'Off' : `${n}-fold`;
}


/**
 * v8 `31.U` — one collapsible group or section: the wrapper to append, the body to build into, and the
 * setter for its activity marker. ⚠️ `setCount` is called from `syncVisibility()` and nowhere else, so
 * there is one owner for the number.
 */
// v8 31.U3 — the shape is the shared module's; this alias keeps the local name the file already uses.
type VfxGroup = Collapsible;

/**
 * v8 `31.U2` — the six marked containers, as a NAMED type rather than a `Record<string, VfxGroup>`.
 *
 * ⚠️ **A `Record` is the obvious choice and it is the weaker one twice over:** under
 * `noUncheckedIndexedAccess` every lookup is `VfxGroup | undefined`, so the count block would need six
 * non-null assertions — and an assertion is exactly the thing that would stay green if a mark were
 * dropped. **A named type makes the compiler prove all six exist at the assignment site instead.**
 */
interface VfxMarks {
  gFigure: VfxGroup;
  gParticles: VfxGroup;
  gColour: VfxGroup;
  gImage: VfxGroup;
  gFields: VfxGroup;
  cDeform: VfxGroup;
}

export interface VisualFxControls {
  getRibbonState(): 'off' | RibbonMode;
  getSplatShear(): string;
  setSplatShear(v: string): void;
  setRibbonState(mode: 'off' | RibbonMode): void;
  getRibbonWidth(): number;
  setRibbonWidth(w: number): void;
  getLinesEnabled(): boolean;
  setLinesEnabled(on: boolean): void;
  getLineWidth(): number;
  setLineWidth(w: number): void;
  getFilmLook(): string;
  setFilmLook(name: string): void;
  /** Returns a copy of the current custom film look params (seeded from last named bundle). */
  getCustomFilmLookParams(): FilmLookParams;
  /** Applies a partial update to the custom film look params (only valid when film look is 'Customize'). */
  setCustomFilmLookParam(patch: Partial<FilmLookParams>): void;
  /*
   * v8 Step 21.4c — the PALETTE's second, grading-free source: `overlay.palette` / `overlay.paletteMapping`.
   *
   * ⚠️ **Why not just use the `cp.*` pair that used to exist.** Writing a palette through `FilmLookParams`
   * forces `filmLook: 'Customize'`, which discards the preset's named look and every grading value with it.
   * A preset that wants `Cinematic` grading AND a palette cannot say so through the look.
   *
   * ⚠️ **SETTERS ONLY since `21.4g` — there is deliberately no getter for either field.** The one palette
   * control displays `getPaletteSelection()`, the resolved answer; a getter for the raw stored override would
   * be a second answer to "which palette is showing", differing in exactly the state that matters (a preset
   * loaded and not yet touched, where the override is absent and the look supplies the palette).
   * `resolvePaletteSelection()` in `renderers/palette-selection.ts` is the ONE place that reconciles the two
   * sources, and nothing may re-derive it from these setters.
   *
   * ⚠️ **`PALETTE_UNSET` (`''`) is still what the setters take for "not overridden", and it is NOT `'none'`**
   * — `''` leaves the film look's pair in charge, `'none'` is an override that says *no palette*. One
   * character apart, opposite meanings. The UI no longer offers `''` (see `buildPaletteSection`), but the
   * setters still accept it because the Lab's Reset path restores whatever the preset authored.
   */
  setOverlayPalette(name: string): void;
  setOverlayPaletteMapping(m: PaletteMapping | ''): void;
  /**
   * v8 Step 21.4g — copy the palette the LIVE film look carries into the override above.
   *
   * ⚠️ **Not for the `Look` dropdown, which gets this for free** — `setFilmLook` already adopts, because
   * choosing a look is exactly the action the rule is about. This exists for the ONE caller that establishes
   * a look in **two** steps: a material's `presentation` block, which sets `filmLook: 'Customize'` and *then*
   * patches `customFilmLookParams` with its own palette pair. Between those two calls the live look is the
   * previous preset's Customize state, so `setFilmLook`'s adoption captures a **stale** palette — and since
   * the override wins, that stale value would then beat the palette the material ships. Re-adopting after the
   * patch is what makes a presentation's palette the one in force.
   *
   * ⚠️ **Never call this from a slider or a params drag.** `grading()` in `slider-mappings.ts` rebuilds
   * `customFilmLookParams` wholesale on every drag, palette pair included, so an adoption wired into
   * `setCustomFilmLookParam` would fire on each mouse-move — writing a resolved value back over a source on a
   * path the user never asked to change the palette on (invariant 17). The call belongs at the end of a
   * discrete *choice*, and there are two such choices in the engine.
   */
  adoptLookPalette(): void;
  /**
   * The RESOLVED selection — what the engine is actually drawing with, after both sources are reconciled.
   *
   * Read for the gate on the `Index Colour` subsection and for `21.4f`'s `Preset colour (index)` label, so
   * that neither the gate nor the label re-implements the resolution (invariant 17). A snapshot, not a live
   * reference: it is replaced wholesale on every palette push.
   */
  getPaletteSelection(): PaletteSelection;
  /**
   * v8 Step 21.4e — the colour law's two per-channel RATE vectors, index 0 = R, 1 = G, 2 = B.
   *
   * `Index Cycles` is `generators.colorFreq`: how many full colour cycles the law completes around the
   * particle index. `Colour Drift` is `generators.colorShift`: how fast each channel drifts with `pos`.
   *
   * ⚠️ **In the STORED unit both times, and the two units are different** — `colorFreq` is divided by `DEG`
   * inside the law, `colorShift` is not. The conversion stays inside the generator; nothing here or in the
   * tab may pre-divide (invariant 10).
   *
   * ⚠️ **The getters read the GENERATOR**, for `getRotationSpeed`'s reason: it holds what is being animated,
   * and `main.ts`'s `preset` and the Lab's `state.workingPreset` are different objects.
   */
  getIndexCycles(): [number, number, number];
  setIndexCycles(channel: 0 | 1 | 2, v: number): void;
  getColourDrift(): [number, number, number];
  setColourDrift(channel: 0 | 1 | 2, v: number): void;
  /**
   * v8 Step 21.4f — `n` colours along the particle index as packed 0–1 RGB floats, for the swatch strip.
   *
   * ⚠️ **No `pos` argument, on purpose** (invariant 28): the instant is `INDEX_SWATCH_POS`, fixed at one site
   * in `palette-selection.ts`, and a caller that could choose it could choose 0 — where every channel's drift
   * term vanishes and the strip would describe a picture nothing draws.
   */
  sampleIndexColours(n: number): Float32Array;
  getAttractorIndex(): number;
  setAttractorIndex(idx: number): void;
  getAttractorBlend(): number;
  setAttractorBlend(v: number): void;
  getSpeedFactor(): number;
  setSpeedFactor(v: number): void;
  /** Figure Scale: multiplier on the generator's uniform canvas fit. 0.2-5, default 1, log track. */
  getFigureScale(): number;
  setFigureScale(v: number): void;
  /**
   * E30 Symmetry Fold: dihedral symmetry order, 1-12. **1 is OFF** (the identity), which is the default.
   *
   * An INTEGER, and the slider steps in whole numbers, because fold 4.5 is not a blend of 4 and 5 —
   * it is a broken figure. The Mixer snaps this field for the same reason.
   */
  /**
   * Per-axis rotation speed in the STORED unit (degrees/second), index 0 = X, 1 = Y, 2 = Z.
   *
   * ⚠️ **Degrees/second, NOT the RPM the slider shows.** `core/rotation-track.ts` owns the conversion
   * (`1 RPM = 6 °/s`), the sign inversion that makes "left = clockwise" true, and the quartic curve. Keeping
   * this interface in the engine's unit means the tab is the only place that knows about RPM, so nothing
   * downstream has to guess which unit a number is in — the exact trap invariant 10 names.
   *
   * The getter returns what the GENERATOR holds (see `main.ts`), which is what is actually being animated.
   */
  getRotationSpeed(): [number, number, number];
  setRotationSpeed(axis: 0 | 1 | 2, v: number): void;
  getSymmetryFold(): number;
  setSymmetryFold(v: number): void;
  /** E30 Mirror: `true` = dihedral (sectors reflected), `false` = cyclic (sectors rotated). */
  getSymmetryMirror(): boolean;
  setSymmetryMirror(v: boolean): void;
  /**
   * v8 `30.1` (`E129a`) — Barr twist per axis, in **turns per half-extent of the design box**.
   *
   * Per-axis `set`, matching `setRotationSpeed` because the control is the same `tripletRow` and each of
   * its three sliders writes only its own axis (`30.D6`). ⚠️ **`get` returns the CLAMPED value the engine
   * is actually using** — the clamp is the generator's, so the UI cannot show a number the figure is not
   * being drawn from.
   */
  getTwist(): [number, number, number];
  setTwist(axis: 0 | 1 | 2, v: number): void;
  // v8 32.1/32.2 (E129b) — Barr taper and bend, the same per-axis shape as the twist above.
  getTaper(): [number, number, number];
  setTaper(axis: 0 | 1 | 2, v: number): void;
  getBend(): [number, number, number];
  setBend(axis: 0 | 1 | 2, v: number): void;
  // v8 33.2/33.3 — the wave basis and the secular sweep. ⚠️ NEITHER is a deformation: `sharpness` changes
  // the basis FUNCTION and `travel` adds a term to the sum, where every operator above maps a position.
  // `facetcheck` §B records both decisions, and `34.2`'s `offset` and `34.3`'s `grow` join them there.
  /**
   * v8 `34.4` (`34.D11`) — **`Sharpness` per wave LEVEL: index 0 is Body, 1 Structure, 2 Detail.**
   *
   * ⚠️ **The index is a LEVEL, not an axis**, even though the widget is the same `tripletRow` the per-axis
   * triples use. That is the one shape mismatch in this interface and it is stated rather than hidden: the
   * captions are `SLOT_LABELS`, not `['X','Y','Z']`.
   *
   * ⚠️⚠️ **`34.D12` IS REVERSED AS OF 2026-10-31 (owner): a cell for a SILENT level is now DISABLED with a
   * reason, not visible-and-inert.** The decision's text was *"a silent level's cell stays VISIBLE and
   * inert"*, and its cost paragraph — *"183 of 314 presets have no live Detail slot-axis at all, so on the
   * majority of the library the third cell does nothing. Accepted."* — is exactly what the owner reported
   * on `Quader Square Spring`. **The cell still SHOWS (so the triplet does not change shape with the
   * preset); what changed is that it can no longer be operated.** The *"Visual FX has no `silent` notion"*
   * half of the old reasoning was the real obstacle and it is gone: `getLiveWaveLevels()` below answers it
   * from `composer-model.ts`' own predicate rather than from a second copy of the rule.
   */
  getSharpnessLevels(): [number, number, number];
  setSharpnessLevels(axis: 0 | 1 | 2, v: number): void;
  /**
   * v8 2026-10-31 (owner) — **which of the three wave LEVELS has anything to shape**, `[Body, Structure,
   * Detail]`.
   *
   * ⚠️ **`main.ts` answers it through `readFigure()` so the `silent` rule has ONE owner** —
   * `size + pulse === 0` on every axis, and NEVER `FM.Base === 0` (the Composer's own trap: a winding of 0
   * is a live slot that does not travel). A second predicate in this tab would be a second answer to
   * *"is this level silent"*, which is invariant 17's shape.
   *
   * ⚠️ **It is a GETTER called on every sync, not a cached array**: the answer moves with the preset and
   * with any Composer edit, and a stale copy re-enables a cell over a figure that no longer has the slot.
   */
  getLiveWaveLevels(): [boolean, boolean, boolean];
  /**
   * v8 `34.4` — `Temper`: ONE depth and ONE rate for all three levels, set together because the generator
   * holds one of each and a half-written pair would leave the rate describing a depth that is gone.
   */
  getSharpnessDepth(): number;
  getSharpnessRate(): number;
  setSharpnessBreath(depth: number, rate: number): void;
  getTravel(): [number, number, number];
  setTravel(axis: 0 | 1 | 2, v: number): void;
  // v8 34.4 — `Stretch`: Travel's breathing, per axis (34.D11). Three axes at three rates is what the
  // per-axis reversal bought.
  getTravelDepth(): [number, number, number];
  setTravelDepth(axis: 0 | 1 | 2, v: number): void;
  getTravelRate(): [number, number, number];
  setTravelRate(axis: 0 | 1 | 2, v: number): void;
  // v8 34.2 — `Offset`, the DC translation, in design half-extents; and `Sway`, its breathing.
  getOffset(): [number, number, number];
  setOffset(axis: 0 | 1 | 2, v: number): void;
  getOffsetDepth(): [number, number, number];
  setOffsetDepth(axis: 0 | 1 | 2, v: number): void;
  getOffsetRate(): [number, number, number];
  setOffsetRate(axis: 0 | 1 | 2, v: number): void;
  // v8 34.3 — `Grow`, the amplitude ramp COEFFICIENT (⚠️ 0 is the identity, not 1); and `Flare`.
  getGrow(): [number, number, number];
  setGrow(axis: 0 | 1 | 2, v: number): void;
  getGrowDepth(): [number, number, number];
  setGrowDepth(axis: 0 | 1 | 2, v: number): void;
  getGrowRate(): [number, number, number];
  setGrowRate(axis: 0 | 1 | 2, v: number): void;
  /**
   * v8 `34.D9` — **the two quantities the `Offset` row's Z readout compares**, both in MODEL units and both
   * read LIVE from the generator on every paint.
   *
   * ⚠️⚠️ **NEITHER MAY BE CACHED ACROSS A RESIZE (invariant 27).** `getPerspectiveCullDepth()` is
   * `perspectiveZ / (waveScale · viewScale)` and **every term in it is a function of the canvas**, so the
   * depth at which a particle is dropped moves with the window. **A preset cannot compensate for a
   * canvas-dependent error**, which is why the readout names the window it describes.
   *
   * ⚠️ `getZExtent()` answers `[0, 0]` before the first frame rather than an infinite interval.
   */
  getZExtent(): [number, number];
  getPerspectiveCullDepth(): number;
  // v8 33.4/33.5 — the escape foliation, and whether the escape CHANNEL has data on this preset.
  // ⚠️ `escapeFieldLive()` is the generator's own answer; the Lab must not re-derive it (33.D17).
  /*
   * ⚠️ **`getEscapeFlow`/`setEscapeFlow` WERE REMOVED FROM THIS INTERFACE ON 2026-11-01 with the `Flow`
   * row they served** (see the note in the Attractor section). The engine side stays: `main.ts` keeps
   * `escapeFlowMode`, adopts it from a preset and gates it into an export, so an imported `'ray'` body
   * still renders as rays. **Re-adding a control means re-adding this pair, not reviving the engine.**
   */
  escapeFieldLive(): boolean;
  // v8 32.7 (E133) — the 3D inversion, all three fields at once (the three are meaningless apart).
  getInversion(): { amount: number; radius: number };
  setInversion(amount: number, radius: number): void;
  /**
   * v8 `30.2` (`E130`) — the box-fold. **One getter for the whole operator, four setters**: the UI has four
   * rows while the generator takes the four together, and `iterations` is the gate the other three hang
   * off. ⚠️ **`get` returns the CLAMPED state**, so a row cannot display a cell size the fold is not using.
   */
  getBoxFold(): { iterations: number; limit: number; scale: number };
  setBoxFoldIterations(v: number): void;
  setBoxFoldLimit(v: number): void;
  setBoxFoldScale(v: number): void;
  /**
   * v8 `31.2` (`E112`/`E113`/`E137`) — per-particle appearance: one shared driver, three amounts.
   *
   * ⚠️ **The setter takes a `ChannelDriver`, not a `string`**, so this tab cannot hand the engine a word
   * the enumeration does not contain. The validation in `main.ts` is for IMPORTS, which are the only
   * untyped source — two different problems, and conflating them is how a cast ends up on this boundary.
   */
  getChannels(): { driver: ChannelDriver; size: number; alpha: number; light: number };
  setChannelDriver(d: ChannelDriver): void;
  setChannelSize(v: number): void;
  setChannelAlpha(v: number): void;
  setChannelLight(v: number): void;
  /**
   * v8 `31.4` (`E132`) — the 4D rotation.
   *
   * ⚠️ **The angle setter is PER-PLANE, keyed by the plane's own name rather than by an index**, which is
   * the one place this differs from `setTwist(axis: 0 | 1 | 2, …)`: there is no natural ordering of the
   * `xw`/`yw`/`zw` planes to make an index mean anything, and a numbered plane is exactly the kind of
   * argument that gets passed in the wrong order with no compiler to notice.
   */
  getDeform4d(): { wScale: number; xw: number; yw: number; zw: number; winding: number };
  setWScale(v: number): void;
  setWAngle(plane: 'xw' | 'yw' | 'zw', v: number): void;
  setWWinding(v: number): void;
  /**
   * Particle Number: how many particles the figure is drawn from. 1-50 000, cubic track.
   *
   * Unlike every other control on this tab, this reads and writes `preset.generators.particleCount`
   * rather than an `overlay` field — see the implementation in `main.ts` for why. The getter returns what
   * the GENERATOR currently holds, which is the count actually being drawn.
   */
  getParticleCount(): number;
  setParticleCount(v: number): void;
  /**
   * v8 16.3 (E94) — the Composer's door to the wave table itself.
   *
   * ⚠️ **AFTER FIFTEEN PHASES THIS IS THE FIRST SURFACE OF ANY KIND ONTO THE LISSAJOUS CURVE.** Every other
   * entry on this interface reaches a *decoration* of the figure — a field, a material, a grading, a
   * presentation. The figure itself, the thing all of them decorate and the thing 361 library presets are
   * made of, had no reader and no writer in `src/ui/` at all. That absence was found by grepping for what was
   * missing rather than by any browser pass, and it is the whole argument for Phase 16.
   *
   * ⚠️ **THE GETTER RETURNS A DEEP COPY AND THE SETTER TAKES ONE.** `WaveConfig.axes[].am` and `.fm` are
   * nested objects, so handing out the live array would let the Composer mutate `preset.generators.waves` in
   * place — the tab would then be editing the engine's own state behind `setWaves()`'s back, and a `Reset`
   * would have nothing to restore. `dye.fixedColour` taught this in the Mixer: the first reference type in
   * any of those blocks had to be spread, or two owners shared one array.
   *
   * ⚠️ **Reads and writes `preset.generators`, like `getParticleCount` and NOT via an `overlay` twin.**
   * `waves` already has mutating consumers (Mixer interpolation, Randomiser jitter, Evolution crossover), so
   * a second source would be invariant 17's shape for the largest object in the preset.
   */
  getWaves(): WaveConfig[];
  setWaves(waves: WaveConfig[]): void;
  /**
   * `generators.waveSpeed` — how fast the figure's modulators sweep. ⚠️ **NOT `WaveConfig.speed`**, which is
   * required by the type, interpolated by the Mixer, and read by nothing (invariant 13 if it were exposed).
   */
  getWaveSpeed(): number;
  setWaveSpeed(v: number): void;
  /**
   * ⚠️ **The Composer's Region D precondition reads `getAttractorBlend()`, WHICH ALREADY EXISTS ABOVE — and I
   * nearly added a second copy of it here that read `preset.generators.attractor.blend` instead.** `tsc`
   * caught it as a duplicate key, which was luck: had I named it `getFigureAttractorBlend` it would have
   * compiled, and the two would have disagreed. The existing one returns `currentBlend`, the LIVE resolved
   * value the attractor pass actually uses; the preset field is only its authored input. **A precondition
   * readout must read the value the pipeline reads** — reading the authored one would describe a blend that
   * a Visual FX drag had already overridden, which is invariant 25 wearing invariant 17's clothes.
   */
  /**
   * `renderer.decayFactor` — trail persistence per frame, 0 (no trail) to 0.99 (near-permanent).
   *
   * ⚠️ **Reads and writes `preset.renderer`, like `getParticleCount` and unlike everything else here** — the
   * field already exists there with six mutating consumers (Mixer, Randomiser, Evolution, Archetypes, the
   * Sliders tab's `Glow` multiplier, `preset-stats`), so an `overlay` twin would create the two-sources shape
   * invariant 17 exists to prevent.
   *
   * ⚠️ **The GETTER returns the preset field, NOT the live `trailDecay`, and the two legitimately differ.**
   * `trailDecay` is DERIVED from this by `applyFluidFeedbackState()`, which both caps it for an additive
   * material and lets TransMap style 6's `persist` replace it outright. Returning the derived value would make
   * this control read back something it did not set, and a slider that snaps away from where you dropped it is
   * worse than one that shows an unclamped intent. The two overrides are named in the tooltip instead.
   */
  getDecayFactor(): number;
  setDecayFactor(v: number): void;
  getCurlEnabled(): boolean;
  setCurlEnabled(on: boolean): void;
  getCurlTurbulence(): number;
  setCurlTurbulence(v: number): void;
  getCurlScale(): number;
  setCurlScale(v: number): void;
  getCurlEvolutionSpeed(): number;
  setCurlEvolutionSpeed(v: number): void;
  getRenderMode(): RenderMode;
  setRenderMode(mode: RenderMode): void;
  getParticleSize(): number;
  setParticleSize(v: number): void;
  /**
   * The size in SCREEN PIXELS the current multiplier actually produces, for the slider's readout.
   *
   * ⚠️ **Asked of the engine rather than recomputed here, deliberately (invariant 17).** It depends on the
   * render mode, the canvas size, whether a material is running, that material's `splatRadius`, and the
   * hardware point-size ceiling — five inputs the tab does not own. A second copy of that arithmetic in the
   * UI is exactly the two-sources shape `fieldcheck` §I exists to catch, and it would go stale the first
   * time a base size changed.
   */
  getParticlePixelEstimate(): number;
  getTransMapEnabled(): boolean;
  setTransMapEnabled(on: boolean): void;
  /**
   * The chain's FIRST layer — what the `Style` dropdown shows and sets.
   *
   * ⚠️ **The setter REPLACES the whole chain with one layer.** That is what the dropdown has always meant,
   * and the dropdown is only shown for a one-layer chain, so there is nothing to preserve. Multi-layer
   * editing goes through `setTransMapChain`.
   */
  getTransMapStyle(): TransMapStyle;
  setTransMapStyle(style: TransMapStyle): void;
  /** The layer chain. Both accessors COPY (I12) — the rows edit their layer objects in place. */
  getTransMapChain(): TransMapLayer[];
  setTransMapChain(chain: TransMapLayer[]): void;
  /** One-line description of the passes the chain actually compiles to, for the tab's readout. */
  getTransMapPipelineDescription(): string;
  /**
   * The PRESET's shared zoom centre, in percent — the fallback a layer with no `zoomCenter` inherits.
   *
   * Read-only on purpose: it comes from `postProcessors.transMap.zoomCenter`, which is preset data rather
   * than overlay state, so the tab shows it as the starting point for a per-layer centre and never writes
   * back to it. A setter here would edit the preset from a panel that says it does not.
   */
  getTransMapZoomCenterX(): number;
  getTransMapZoomCenterY(): number;
  /**
   * The PRESET's own 4×4 wave tables — what `(Preset)` means, and what the static-field readout measures.
   *
   * ⚠️ **No longer read-only, and this tab is still not the writer** (v8 21.12): the **Transmap** tab owns the
   * term rows and calls `setTransMapWaveTables`. Visual FX reads the pair for its readout only. **They come as
   * a pair because only style 3 reads the second one** and a caller that took just the first would silently
   * measure a Zoom Combined layer's shift half as if it were the whole field.
   *
   * ⚠️ **This exists because the panel could not DESCRIBE the field it was controlling** (T2, 2026-09-18).
   * Every styles-0-3 control is exposed and correct, but two legacy presets whose warps measure 2.8 px and
   * 1691 px present byte-identical panel state on `(Preset)`, so "the slider does nothing" and "the slider
   * works and the preset's table is flat" were indistinguishable without leaving the UI. That confusion has
   * now cost two separate mis-recommendations (see `buildTimeWarpBody`'s header on `Rose`).
   */
  getTransMapWaveTables(): { table1: SinMagicParams; table2: SinMagicParams };
  /**
   * Write both wave tables into the live preset and rebuild the static field (v8 21.12, the Transmap tab).
   *
   * ⚠️ **Both tables every call** — the implementation writes what it is given, so passing a fresh `table1`
   * with a stale `table2` stores the stale one. Read the current pair, change what changed, send both.
   *
   * ⚠️ **The arrays are COPIED by the implementation**, so a row may keep editing its own; the corresponding
   * rule for the caller is that the getter's arrays are live preset data and must never be written through.
   */
  setTransMapWaveTables(table1: SinMagicParams, table2: SinMagicParams): void;
  /**
   * The live drawing-buffer size in pixels, for readouts that convert a normalised field to px.
   *
   * ⚠️ **The CANVAS, not the viewport** — the two differ (the canvas is the narrower of the pair), and the
   * static field's magnitude is scaled by `min(width, height)`, so reading the window would misreport the
   * one quantity the readout exists to state. Invariant 26: an image-domain operator measures length on one
   * shared scale, and a readout of one inherits the same requirement.
   */
  getFrameSize(): { width: number; height: number };
  getIfsParams(): IfsTransform[];
  setIfsParams(params: IfsTransform[]): void;
  getTransMapWarpMix(): number;
  setTransMapWarpMix(v: number): void;
  getTransMapDispersion(): number;
  setTransMapDispersion(v: number): void;
  /** v8 Step 14.6 — run the warp BEFORE the particle draw. See `overlay.transMapBeforeParticles`. */
  getTransMapBeforeParticles(): boolean;
  setTransMapBeforeParticles(on: boolean): void;
  getTransMapForceBlend(): number;
  setTransMapForceBlend(v: number): void;
  getTransMapForceReturn(): number;
  setTransMapForceReturn(v: number): void;
  getTransMapForceSparks(): boolean;
  setTransMapForceSparks(on: boolean): void;
  getForceGateBy(): ForceGateSource;
  setForceGateBy(v: ForceGateSource): void;
  getForceGateAmount(): number;
  setForceGateAmount(v: number): void;
  getForceGateInvert(): boolean;
  setForceGateInvert(on: boolean): void;
  getForceGateHalfLife(): number;
  setForceGateHalfLife(v: number): void;
  getFluidFeedback(): FluidFeedbackConfig;
  setFluidFeedback(cfg: Partial<FluidFeedbackConfig>): void;
  getProceduralFlowConfig(): ProceduralFlowConfig;
  setProceduralFlowConfig(config: Partial<ProceduralFlowConfig>): void;
  getSnapshot(): OverlayState;
  getFilmLookNames(): string[];
  getAttractorPresetNames(): string[];
  /**
   * Register a sync callback; main.ts fires every registered callback when state changes externally
   * (preset switch, R / A / number-key shortcuts, material auto-enables). Callbacks ACCUMULATE —
   * both the Visual FX and Materials tabs subscribe, so registering must never displace another.
   */
  /** Subscribe to external state changes. Returns an unsubscribe function — call it in `dispose()` (D17). */
  onExternalChange(cb: () => void): () => void;
  getPhysarumConfig(): PhysarumConfig;
  setPhysarumBlend(v: number): void;
  setPhysarumSensorAngle(v: number): void;
  setPhysarumSensorDistance(v: number): void;
  setPhysarumTurnSpeed(v: number): void;
  setPhysarumDecayRate(v: number): void;
  setPhysarumDepositAmount(v: number): void;
  setPhysarumShowTrail(on: boolean): void;
  setPhysarumTrailOpacity(v: number): void;
  /**
   * v8 9.3. `string`, not a union: the value space is `'(Preset)'`, `'(Auto)'` and every name
   * `getAllPaletteNames()` returns, which is data rather than a type. `main.ts` owns the resolution and
   * degrades an unresolvable name to the legacy orange.
   */
  setPhysarumTrailColour(name: string): void;
  getFluidAdvectionConfig(): FluidAdvectionConfig;
  setFluidBlend(v: number): void;
  setFluidReturnForce(v: number): void;
  getMaterialConfig(): MaterialConfig | null;
  setMaterialConfig(config: MaterialConfig | null): void;
  getBuoyancyConfig(): BuoyancyConfig;
  setBuoyancyConfig(config: BuoyancyConfig): void;
  getSparkConfig(): SparkConfig;
  setSparkConfig(config: SparkConfig): void;
  getVolumeConfig(): VolumeRenderConfig;
  setVolumeConfig(config: VolumeRenderConfig): void;
  // v8 Step 15.1 — Liquid Surface
  getLiquidConfig(): LiquidSurfaceConfig;
  setLiquidConfig(config: LiquidSurfaceConfig): void;
  // v8 Step 15.4 — Cohesion. A GENERATOR config, so unlike the liquid pair above it is read in every mode.
  getCohesionConfig(): CohesionConfig;
  setCohesionConfig(config: CohesionConfig): void;
  /**
   * v8 Step 15.5 — the liquid field pool. Also a generator config, so also read in every render mode.
   *
   * ⚠️ **The setter has a SECOND owner behind it** (`applyFluidFeedbackState()`, which derives whether the
   * 512² velocity field simulates and reads back at all), so every control in the section must go through it —
   * never through a narrower per-field setter. See its implementation's note in `main.ts`.
   */
  getLiquidFieldConfig(): LiquidFieldConfig;
  setLiquidFieldConfig(config: LiquidFieldConfig): void;
  /**
   * v8 Step 15.7 — the advected dye field.
   *
   * ⚠️ **The setter deliberately does NOT reset the field.** The field's contents are HISTORY, not a
   * parameter (D-09), so `main.ts` clears it on a preset change and nowhere else — a slider drag must not
   * erase the wake the user is looking at while judging that very slider.
   */
  getDyeConfig(): DyeFieldConfig;
  setDyeConfig(config: DyeFieldConfig): void;
  // v8 Phase 8a — Faceted Crystal
  getCrystalConfig(): CrystalRenderConfig;
  setCrystalConfig(config: CrystalRenderConfig): void;
  getFrozenFraction(): number;
  /**
   * The pool's ALLOCATED capacity, i.e. the denominator of `getFrozenFraction()`.
   *
   * The Crystals readout needs it to print an absolute count. It must come from the pool rather than be
   * re-derived from `overlay.crystal.poolSize` in the UI (triage I5) — the pool clamps that value, and a
   * second copy of the clamp can disagree with the allocation it is describing.
   */
  getCrystalCapacity(): number;
  /** Reset all overlay state to defaults or to values from the given preset's overlay block. */
  resetOverlays(preset: UnifiedPreset): void;
  /*
   * ---- v8 16.18 (E109) — the Composer's two PREVIEW BYPASS switches ----
   *
   * ⚠️ **VIEW STATE OVER THE ENGINE, NOT EDITS TO THE FIGURE, AND THAT IS ASSERTED RATHER THAN INTENDED:**
   * Export, Snapshot and the Mixer are byte-identical with either flag on, because `getSnapshot()` returns the
   * overlay CAPTURED when the first flag was set. See `main.ts`'s `PLAIN_BYPASS_MODES` block for why a re-apply
   * needs that freeze and why neither setter notifies.
   *
   * ⚠️ **`bypassVisualFx` KEEPS Film Look AND ALL of Framing & Timing** (Figure Scale, Speed, Particle Number,
   * Rotation, Symmetry) — the owner's scope. **`bypassMaterials` forces `star` where a material was live**, also
   * the owner's, overriding the plan's *"let `resolveModeAgainstMaterial()` decide"*: its cost is that 2 of 399
   * presets lose an authored iso-surface, since `liquid` is the one mode a material does not override.
   *
   * ⚠️ **THEY ARE DELIBERATELY NOT ON THE VISUAL FX TAB ITSELF.** A switch that neutralises a whole tab does not
   * belong inside that tab's own control list, where it would sit beside the sliders it makes inert with nothing
   * but its label to say so; it belongs where the bare figure is being composed and is the reason to want it.
   */
  getBypassVisualFx(): boolean;
  setBypassVisualFx(on: boolean): void;
  getBypassMaterials(): boolean;
  setBypassMaterials(on: boolean): void;
  /**
   * v8 `26.8` - `Strip to figure`. A THIRD bypass, owned by the Sliders header.
   *
   * WARNING: it is a VIEW state, not an edit - Export, Snapshot and the Mixer stay byte-identical with it
   * on, and it holds with the Lab closed, because the bypass is applied engine-side.
   */
  setStripToFigure(on: boolean): void;
  /**
   * v8 `26.8` — `Strip to figure`. A THIRD bypass, owned by the Sliders header.
   *
   * ⚠️ **It is a VIEW state, not an edit** — Export, Snapshot and the Mixer stay byte-identical with it on,
   * and it holds with the Lab closed, because the bypass is applied engine-side.
   */
  setStripToFigure(on: boolean): void;
}

/* ================================================================================================
 * The control descriptor table (triage J1)
 * ================================================================================================
 *
 * This tab used to be THREE parallel enumerations of one control list, and the duplication — not the
 * line count — was the reason it was 1 895 lines:
 *
 *   1. 48 `build*Control()` methods, each ~20 lines of identical `<input type=range>` boilerplate.
 *   2. `syncFromControls()`, 120 lines of `if (this.xSlider) { this.xSlider.value = …; label … }`.
 *   3. `dispose()`, 80 lines of `this.x = null;` — every line of it.
 *
 * ...over 82 private fields, 80 of which were element refs. Adding one control meant editing all three
 * places, and forgetting the second or third failed SILENTLY: a control that builds but never syncs looks
 * fine until an external change (a preset switch) leaves it displaying stale values, and one that never
 * releases keeps the whole subtree alive after `dispose()`.
 *
 * Now each control is ONE descriptor. `build*` is `this.slider(...)` / `this.check(...)` /
 * `this.select(...)`, which registers the descriptor as it creates the DOM; `syncFromControls()` walks the
 * registry; `dispose()` drops it in a single statement. The three enumerations cannot drift because there
 * is only one.
 *
 * ⚠️ **The `key` is NOT a repeat of the string-field-name hazard I1 removed.** That cast wrote
 * `(this as Record<string, …>)[fieldName]`, so the string named a CLASS FIELD declared somewhere else and
 * a rename on either side silently created a new property. A `key` here names nothing outside its own
 * descriptor: `slider()` and `syncControl()` both read `c.key` off the same object, so there is no second
 * site to drift from. It exists only for `syncKey()` / `syncGroup()`, the two cross-control cases — and
 * `syncKey` THROWS on an unknown key rather than no-oping, so a typo fails at first use.
 *
 * Two latent defects the uniformity fixed, both of the "built but not synced" class above:
 *   - Ribbon Width and Neon Line Width updated their value labels on drag but not on sync, so after a
 *     preset change the number beside the slider disagreed with the handle.
 *   - Picking `volume` in the Render Mode dropdown did not reveal the Volume Render section. `setRenderMode`
 *     only notifies externally when the renderer REFUSES the mode (`reconcileRenderMode`), so on success
 *     nothing re-ran `syncFromControls()` and the section stayed hidden until the tab was switched. Same
 *     shape as I9's Force Field section: a `change` handler that updated some of the dependent state.
 */

/** Formatting/behaviour of one control, minus the element slot the registry adds. */
interface SliderSpec {
  key: string;
  min: number;
  max: number;
  step: number;
  get(): number;
  set(v: number): void;
  /** value -> 0-1 track position. Omit for a linear track, where value IS the position. */
  toPos?(v: number): number;
  /** track position -> value. Must be the inverse of `toPos`; omit together with it. */
  fromPos?(pos: number): number;
  /** Decimals for the value label; ignored when `fmt` is given. Defaults to 2. */
  decimals?: number;
  fmt?(v: number): string;
  /** Widens the label cell — five-digit counts do not fit the default. */
  wideLabel?: boolean;
  /**
   * Move the HANDLE to `toPos(value)` when the drag ends (2026-08-20). Opt-in, and only meaningful with a
   * `toPos`/`fromPos` pair whose `fromPos` quantises — Particle Number (multiples of 100) and Speed (a 0.01
   * grid). Many positions map to one value there, so a released handle otherwise rests wherever the cursor
   * was rather than at its value's own position, and the next `syncControl()` teleports it for no reason the
   * user can see.
   *
   * ⚠️ **This must not be able to CHANGE the value** — it is a cosmetic reposition, so the handler checks
   * that the canonical position still reads back the same value and abandons the move if it does not.
   * Verified over every stop of both tracks (501 speed, 2001 particle): the value survives on all of them,
   * and the handle actually moves on 125 and 1404 of them respectively.
   */
  settleOnRelease?: boolean;
  /**
   * Hover tooltip on the input. Optional, so every existing descriptor is unaffected.
   *
   * `staticSlider` already had a REQUIRED `title` of its own; this is the same idea on the general slider,
   * added rather than hand-setting `.title` on one row, because the tab is built from a descriptor table and
   * a one-off would be the hand-wiring its header warns against.
   *
   * ⚠️ **Omitting it is the NORMAL case — the factory falls back to `CONTROL_TIPS[key]`** (`../tooltips.ts`),
   * so every control is tooltipped from one table rather than 82 call sites. Set it here only when the text
   * is derived from this control's own arithmetic and a shared table could not state it; an explicit `title`
   * WINS over the table.
   */
  title?: string;
}

interface CheckSpec {
  key: string;
  get(): boolean;
  set(v: boolean): void;
  /** Hover tooltip. Falls back to `CONTROL_TIPS[key]`; see {@link SliderSpec.title}. */
  title?: string;
}

/**
 * The Render Mode dropdown's options — **a `Record<RenderMode, string>` so `tsc` FORCES a new mode to get a
 * label here**, added by v8 Step 15.0 (E83).
 *
 * ⚠️ **This is the site that makes Step 15.0 do what it claims, and it was found by testing the claim
 * rather than by trusting it.** The step's premise is that naming the union means *"`tsc` then names every
 * site that must handle the new member"* — and adding `| 'liquid'` to `RenderMode` produced **zero** `tsc`
 * errors. The reason is structural and worth recording: **`src/` contains no `switch` on a render mode and
 * no exhaustiveness guard anywhere** (measured 2026-08-30 — 0 `switch (…mode)` sites, 0 `: never` /
 * `assertNever` sites). Every consumer is an `if (mode === '…')` chain with a fallthrough, so a widened
 * union type-checks everywhere by construction: `modeInt`'s ternary chain in `hdr-particle.ts` silently
 * yields the `star` branch, `baseSize` yields 5.0, and no per-mode `init*` call fires. **The union alone
 * therefore buys type SAFETY, not the enumeration coverage the step is for** — this map is what buys the
 * second half, because an unlabelled mode is a compile error rather than a mode missing from the UI.
 *
 * ⚠️ **A missing entry here would otherwise be INVISIBLE in exactly the way the step exists to prevent**:
 * the mode would be fully functional in the engine, reachable from a preset's `overlay.renderMode` and from
 * an import, but absent from the one control that selects it — invariant 13's shape from the other side (not
 * a control that moves nothing, but a working feature with no control at all).
 *
 * The insertion ORDER is the dropdown's display order (`Object.entries` preserves it), so a new mode's
 * position is chosen here too rather than falling wherever the union happens to list it.
 */
const RENDER_MODE_LABELS: Record<RenderMode, string> = {
  'pixel':       'Pixel',
  'blend':       'Blend',
  'star':        'Star',
  'splat':       'Splat',
  'volume':      'Volume',
  'liquid':      'Liquid',
};

/**
 * Modes the engine KNOWS but the dropdown must not yet OFFER — **empty is the normal state.**
 *
 * ⚠️ **`RenderMode` gains its member in Step 15.0 while the branch that draws it lands in Step 15.1, so
 * there is a window where a mode is nameable but not drawable** — and an ungated dropdown would ship a
 * selectable `Liquid` that falls through `modeInt`'s ternary chain to the `star` branch and renders as
 * `star`. Not a black frame, which is why it would survive a browser pass: it looks like a mode that
 * "doesn't seem to change anything", i.e. **invariant 13 introduced deliberately by a type-safety step.**
 *
 * This list is the alternative to the two things that would each be worse: deferring `| 'liquid'` to 15.1
 * (which loses 15.0's whole point — the compile-time coverage this map provides has to exist BEFORE the
 * mode is implemented, or the implementation is what discovers the missing sites), and leaving the label out
 * of `RENDER_MODE_LABELS` (which would make the map non-exhaustive and defeat the coverage).
 *
 * ⚠️ **Step 15.1 empties this set in the same edit that adds the `liquid` branch** — that one deletion is
 * what publishes the feature, so it must not be forgotten and must not happen early. ✅ **Done 2026-08-30:
 * `HDRParticleRenderer.renderLiquid()` draws the mode, so `Liquid` is now offered.** The set stays (empty)
 * because the next unbuilt mode wants the same window, and because emptying it is a one-token change
 * against re-deriving the reasoning above.
 */
const UNSELECTABLE_RENDER_MODES: ReadonlySet<RenderMode> = new Set<RenderMode>([]);

interface SelectSpec {
  key: string;
  options: [string, string][];
  /**
   * v8 `33.5` — **an option list recomputed on every sync, for a member whose data can be absent.**
   *
   * ⚠️ **Added as a DESCRIPTOR field rather than by reaching into the `<select>` from `syncVisibility()`**,
   * which is this file's standing rule: a control is one descriptor, and a hand-wired DOM edit would be
   * invisible to the registry that syncs everything else.
   *
   * ⚠️ **Rebuilt only when the list actually CHANGES**, compared as a joined string. A select that
   * re-creates its children every sync loses an open dropdown under the user's cursor, which is the kind
   * of churn defect that reads as "the panel fights me" rather than as a bug.
   */
  dynamicOptions?: () => [string, string][];
  get(): string;
  set(v: string): void;
  /** Hover tooltip. Falls back to `CONTROL_TIPS[key]`; see {@link SliderSpec.title}. */
  title?: string;
}

/** Three sliders driving one vec3 setter, with per-channel captions and no value label. */
interface RgbSpec {
  key: string;
  min: number;
  max: number;
  step: number;
  get(): [number, number, number];
  set(v: [number, number, number]): void;
  /** Hover tooltip, applied to all three inputs. Falls back to `CONTROL_TIPS[key]`. */
  title?: string;
}

/**
 * Three sliders on ONE row, each with its own caption, its own value readout and its own PER-INDEX setter.
 *
 * Distinct from {@link RgbSpec}, which was the near-miss: that one has no value labels (a colour-grading
 * channel is judged by eye, a rotation rate is not) and its setter takes the whole vec3, so a per-axis clamp
 * read back from the engine would have to be re-derived from three DOM elements. Extending `RgbSpec` in place
 * was rejected — Lift/Gamma/Gain are three shipped controls whose layout is confirmed, and adding labels to
 * them would change all three to fix none.
 *
 * The `toPos`/`fromPos` pair is the same contract `SliderSpec` documents: both or neither.
 */
interface TripletSpec {
  key: string;
  min: number;
  max: number;
  step: number;
  /** Per-channel captions, shown above each slider. */
  captions: [string, string, string];
  get(): [number, number, number];
  set(index: 0 | 1 | 2, v: number): void;
  toPos?(v: number): number;
  fromPos?(pos: number): number;
  /**
   * v8 `34.4` — ⚠️ **`axis` IS A SECOND PARAMETER BECAUSE FOUR OF THIS PHASE'S ROWS CANNOT FORMAT A CELL
   * WITHOUT KNOWING WHICH CELL IT IS.** `Stretch`, `Sway` and `Flare` print `(clipped)` when the breathing
   * would hit its operator's bound, and whether it does depends on **that axis's own BASE** — so a
   * one-argument formatter would have had to pick one axis's base for all three cells and would have printed
   * a true statement about the wrong slider. Every pre-existing formatter ignores the argument, which is why
   * widening the signature was cheaper than three bespoke rows.
   */
  fmt(v: number, axis: 0 | 1 | 2): string;
  /** Hover tooltip, applied to all three inputs. */
  title?: string;
  /**
   * v8 2026-10-31 (owner) — ⚠️⚠️ **PER-CELL LIVENESS, AND IT REVERSES `34.D12`.** That decision was *"a
   * silent level's cell stays VISIBLE and inert"*; the owner reported the consequence on
   * `Quader Square Spring` — *"does not have DETAIL structure, but Sharpness slider for DETAIL is still
   * enabled"* — which is invariant 13's harder form arriving in the panel: the cell shapes a wave slot
   * that is silent, so it can move, read back its own number, and change nothing on screen.
   *
   * **Returning `false` for a cell DISABLES it and explains why in its title; the stored value is left
   * exactly as authored** (`sharpnessStructure`/`sharpnessDetail` read `?? sharpness`, so zeroing one
   * would change what a re-authored preset means — `34.D11`). Absent ⇒ all three live, which is every
   * pre-existing triplet.
   *
   * ⚠️ **Re-read on every `sync()`, not only at construction** — the answer changes with the preset AND
   * with a Composer edit that silences a slot, and a cell left enabled after the figure changed is the
   * same defect one preset later.
   */
  cellLive?(): [boolean, boolean, boolean];
  /** Why a dead cell is dead, shown as its title. Required in practice wherever `cellLive` is given. */
  deadReason?: string;
}

type SliderControl = SliderSpec & { kind: 'slider'; el: HTMLInputElement | null };
type CheckControl = CheckSpec & { kind: 'check'; el: HTMLInputElement | null };
type SelectControl = SelectSpec & { kind: 'select'; el: HTMLSelectElement | null };
type RgbControl = RgbSpec & { kind: 'rgb'; els: (HTMLInputElement | null)[] };
type TripletControl = TripletSpec & { kind: 'triplet'; els: (HTMLInputElement | null)[]; labels: (HTMLElement | null)[] };
type ControlEntry = SliderControl | CheckControl | SelectControl | RgbControl | TripletControl;

function sliderFmt(c: SliderControl): (v: number) => string {
  return c.fmt ?? ((v: number) => v.toFixed(c.decimals ?? 2));
}

/**
 * The tooltip for a descriptor: its own `title` if it has one, else the shared table's entry for its `key`.
 *
 * ⚠️ **The descriptor WINS.** A handful of controls (Dispersion, the force gate's two) carry a hand-written
 * `title` derived from their own arithmetic, which is more specific than anything a shared table can say.
 */
function tipFor(spec: { key: string; title?: string }): string | undefined {
  return spec.title ?? CONTROL_TIPS[spec.key];
}

/**
 * v8 2026-10-31 (owner) — ⚠️ **ONE owner for "this cell has nothing to act on", so the disabled state and
 * the explanation cannot drift apart.** Called from `tripletRow`'s construction AND from `sync()`.
 *
 * ⚠️ **`disabled` is the whole mechanism and `display` is deliberately NOT touched.** A hidden cell would
 * make the triplet change SHAPE with the preset — three sliders on one figure and two on the next, with the
 * captions no longer lining up — and `34.D12` chose visibility for that reason; what the owner reported is
 * the cell being *operable*, not its being present. **So the cell stays, greyed, and says why on hover.**
 *
 * ⚠️ **The title is restored to the ROW's tip when the cell comes back**, rather than left on the reason:
 * a stale *"this level is silent"* over a live control is the inverse defect and reads as a broken figure.
 */
function applyCellLiveness(
  el: HTMLInputElement, live: boolean, reason: string | undefined, rowTip: string | undefined,
): void {
  el.disabled = !live;
  /*
   * ⚠️ **The class goes on the CELL, not on the input, and the DOM order is why.** `.sl-vfx-slider:disabled`
   * already dims the track (a global rule since `21.12` §J), but the caption is appended BEFORE the input
   * and the readout AFTER it, so no sibling selector from the input can reach both — a dead cell still read
   * as live at a glance because its `Detail` caption and its number stayed at full contrast.
   */
  el.closest('.sl-vfx-triplet-cell')?.classList.toggle('sl-vfx-cell-dead', !live);
  const tip = live ? rowTip : (reason ?? rowTip);
  if (tip) el.title = tip; else el.removeAttribute('title');
}

export class VisualFxTab implements TabModule {
  readonly id: TabId = 'visual-fx';
  private controls: VisualFxControls;
  private container: HTMLElement | null = null;
  /** Unsubscribe for `onExternalChange`; called in `dispose()` so a dead tab stops reacting (D17). */
  private unsubscribeExternal: (() => void) | null = null;

  /** The descriptor registry — build order, which is also sync order. Cleared by `dispose()`. */
  private controlList: ControlEntry[] = [];

  // Panels and sections: containers rather than controls, so they are not in the registry. Their
  // visibility is derived in `syncVisibility()`.
  private customizePanel: HTMLElement | null = null;
  private forceFieldSection: HTMLElement | null = null;
  private proceduralFlowPanel: HTMLElement | null = null;
  private fluidFeedbackPanel: HTMLElement | null = null;
  private volumeSection: HTMLElement | null = null;
  /** v8 Step 15.1. Shown only in the `liquid` render mode, exactly as `volumeSection` is for `volume`. */
  private liquidSection: HTMLElement | null = null;
  /** The Surface Ramp row — a section WITHIN a section, shown for `tintSource` `'ramp'` AND `'dye'`. */
  private liquidRampRow: HTMLElement | null = null;
  /**
   * The two rows that `tintSource === 'dye'` makes UNREADABLE (2026-10-16) — see where they are built, and
   * `syncVisibility()` for why all three are hidden rather than greyed. **They are the inverse of
   * `liquidRampRow`: it appears under `'dye'` and these two leave**, which is why the three live in one
   * `tintSource` read rather than in three independent rules.
   */
  private liquidColourMixRow: HTMLElement | null = null;
  private liquidMixModelRow: HTMLElement | null = null;
  /**
   * v8 Step 15.7 — the Fixed Colour row, shown only for `dye.colourSource === 'fixed'`.
   *
   * ⚠️ **The Dye Field SECTION itself has no field here and is never hidden** — see `buildDyeSection()` for
   * why: the field runs in every render mode, so hiding it would deny the feature rather than explain that its
   * output has nowhere to go. This row is the section's only conditional part.
   */
  private dyeFixedColourRow: HTMLElement | null = null;
  /** v8 28.4 — shown only under `colourSource === 'ramp'`, like `dyeFixedColourRow` under `'fixed'`. */
  private dyeRampRow: HTMLElement | null = null;
  /** v8 28.16 — shown for the three RAMP sources only; `Dye Cycles` only under `Index`. */
  private dyeMapRow: HTMLElement | null = null;
  private dyeCyclesRow: HTMLElement | null = null;
  /** E30: the Mirror row, hidden at fold 1 where it has nothing to mirror. */
  private symmetryMirrorRow: HTMLElement | null = null;
  /**
   * v8 `34.D9` — the Z depth precondition under the `Offset` row. **The ONE inline string this phase adds**,
   * because a precondition is the single exception to *every `title` comes from `tooltips.ts`*.
   *
   * ⚠️ **Its TEXT is assigned once per sync and only `display` is toggled, never a ternary** — `INLINE_SINK`
   * matches a literal after `=`, so ternary-assigned copy is invisible to `tipcheck`. The percentage is part
   * of the text and therefore recomputed, which is required anyway: the threshold is canvas-dependent
   * (invariant 27) and may not be cached across a resize.
   */
  private zDepthNote: HTMLElement | null = null;
  // v8 30.2 — the three box-fold rows that are meaningless at 0 iterations. See syncVisibility().
  private foldLimitRow: HTMLElement | null = null;
  private foldScaleRow: HTMLElement | null = null;
  // v8 32.7 — revealed by `Inversion > 0`, the section's threshold convention.
  private invertRadiusRow: HTMLElement | null = null;
  // v8 31.1 — the three rows the plate's BLEND gates. The blend row itself is always visible.
  // v8 31.4 — the three 4D angles, gated on the extent. The extent row itself is always visible.
  /*
   * v8 `31.U` — **the gated BODIES of the enabler-driven sections.** Each holds every row of its section
   * except the section title and the enabler itself, so an off feature costs two lines instead of five
   * to twelve. Owner instruction, 2026-10-25: *"features with an explicit enabler checkbox which have
   * additional settings should only show the settings when the feature is enabled"*.
   *
   * ⚠️ **TWO DIFFERENT GATE KINDS, which is `22.D4`'s point arriving in the UI:** `Neon Lines`,
   * `Curl Noise`, `Liquid Field` and `Dye Field` have a BOOLEAN enabler, while `Physarum` has none —
   * its activation scalar is `Blend`, so its gate is `blend > 0`. **A checkbox and a threshold are not
   * interchangeable and the predicate has to match the subsystem's own scalar.**
   *
   * ⚠️ **Gating hides, it never defers construction** — `display: none` stops a row being SEEN, not
   * working, so every gated row still exports, still snapshots and still takes a Reset.
   */
  /**
   * v8 `31.U2` — the five group marks plus `Deformation`'s, so `syncVisibility()` can update the counts.
   * ⚠️ **Assigned when the panel is built and `null` before that, because `syncVisibility()` can run
   * first** — the tab's own `resume()` calls it, and a tab can be resumed before its body exists.
   */
  private groupMarks: VfxMarks | null = null;
  private liquidFieldBody: HTMLElement = document.createElement('div');
  private dyeBody: HTMLElement = document.createElement('div');
  private neonBody: HTMLElement = document.createElement('div');
  private curlBody: HTMLElement = document.createElement('div');
  private physarumBody: HTMLElement = document.createElement('div');
  private wAngleRow: HTMLElement | null = null;
  private wWindingRow: HTMLElement | null = null;
  // v8 Step 14.4 — the force gate's dependent rows and its "needs a material" note. Visibility is derived
  // in `updateGateRows()`, which is called from `syncFromControls()` and from the Gate By handler.
  private gateBySelect: HTMLSelectElement | null = null;
  private gateAmountRow: HTMLElement | null = null;
  private gateHalfLifeRow: HTMLElement | null = null;
  private gateInvertRow: HTMLElement | null = null;
  private gateNote: HTMLElement | null = null;

  /*
   * v8 Step 21.4e / 21.4f — the Colour Palette section's derived parts. Every one of them is a READOUT or a
   * container; the four controls in the section are ordinary descriptors and live in `controlList`.
   *
   * ⚠️ **All four prose elements have their text set ONCE, at build time, and are shown or hidden by
   * `display`** — never assigned from a ternary. `CLAUDE.md`'s rule: `tipcheck`'s `INLINE_SINK` matches a
   * literal after `=`, so ternary-assigned copy is invisible to the one checker that caps the UI's inline
   * prose. The force gate's `gateNote` two fields up is the pattern NOT to copy here.
   *
   * The two exceptions are the palette NAME and the drift PERIOD, which are values rather than copy and are
   * therefore assigned live — neither is a literal, so neither escapes a scan that could have seen it.
   */
  private indexColourPanel: HTMLElement | null = null;
  /** 21.4f: the two mutually exclusive source labels — `usesPresetQuadruple` picks which one is shown. */
  private indexSourcePresetLabel: HTMLElement | null = null;
  private indexSourceNameLabel: HTMLElement | null = null;
  private indexSwatch: HTMLCanvasElement | null = null;
  /** The drift period, when one exists — and the static note for when no channel drifts at all. */
  private indexPeriodLabel: HTMLElement | null = null;
  private indexStaticNote: HTMLElement | null = null;

  // The IFS transforms editor is deliberately NOT in the registry: its rows are created and destroyed as
  // transforms are added and removed, so it has no fixed control list to describe.
  private ifsPanel: HTMLElement | null = null;
  private ifsRows: HTMLElement[] = [];
  private ifsArchetypeSel: HTMLSelectElement | null = null;

  // ---- TransMap layer chain ------------------------------------------------------------------------
  //
  // Outside the registry for the SAME reason as the IFS rows, and on the same precedent: layers are added
  // and removed, so there is no fixed control list to describe. `syncLayerRows()` is its own sync.
  //
  // ⚠️ **What is NOT rebuilt here is the load-bearing part.** Each layer row hosts the EXISTING
  // `ifsPanel` / `proceduralFlowPanel` / `fluidFeedbackPanel` by `appendChild`, which MOVES the node. At
  // most one layer per style is what makes that legal: with two style-5 layers there would be two panels
  // wanting the same `flow.*` descriptor keys, and `syncKey('flow.strength')` resolves exactly one
  // control. So the chain length is bounded at 7 by construction, and the panels keep their identity,
  // their registry entries and their handles across every chain edit.
  private layerPanel: HTMLElement | null = null;
  private layerRowContainer: HTMLElement | null = null;
  /** The `Style` dropdown row — the one-layer view. Hidden once the chain has 2+ layers. */
  private styleRow: HTMLElement | null = null;
  /** Per-layer row elements, index-aligned with the chain. */
  private layerRows: HTMLElement[] = [];
  /** Per-layer body containers, the drop targets the shared panels are moved into. */
  private layerBodies: (HTMLElement | null)[] = [];
  /** Styles whose settings body is expanded. Survives a row rebuild, so a weight drag does not collapse it. */
  private expandedLayers = new Set<number>();
  private addLayerSelect: HTMLSelectElement | null = null;
  private pipelineReadout: HTMLElement | null = null;
  private swapButton: HTMLButtonElement | null = null;
  /** Where the three shared panels sit in the FLAT (one-layer) layout — a position, not a container. */
  private flatPanelSlot: HTMLElement | null = null;

  constructor(controls: VisualFxControls) {
    this.controls = controls;
  }

  init(container: HTMLElement, _state: ExplorationState): void {
    this.container = container;
    this.render();
    this.unsubscribeExternal = this.controls.onExternalChange(() => this.syncFromControls());
  }

  activate(): void {
    this.syncFromControls();
  }

  deactivate(): void {}

  /**
   * Nothing tab-local to restore — but the controls must be re-read.
   *
   * The panel's Reset calls `visualFxControls.resetOverlays()` first, which rewrites the live overlay
   * state this tab is a view of. Without re-syncing, every control here would keep displaying the
   * pre-reset values while the renderer used the restored ones.
   */
  reset(_entryPreset: UnifiedPreset): void {
    this.syncFromControls();
  }

  dispose(): void {
    // D17: drop the external-change subscription. Without this the disposed tab kept running
    // `syncFromControls()` on every preset change, writing into DOM elements that had been replaced.
    this.unsubscribeExternal?.();
    this.unsubscribeExternal = null;
    // One statement in place of 80 `this.x = null;` lines — see the descriptor-table note above.
    this.controlList = [];
    this.container = null;
    this.customizePanel = null;
    this.forceFieldSection = null;
    this.proceduralFlowPanel = null;
    this.fluidFeedbackPanel = null;
    this.volumeSection = null;
    // Invariant 1's shape in the UI: `render()` reassigns both, so a stale node here would be written into
    // after the tab was replaced — the same defect D17's unsubscribe above exists to prevent.
    this.liquidSection = null;
    this.liquidRampRow = null;
    // ⚠️ Nulled for `liquidRampRow`'s reason, not as housekeeping: `render()` reassigns all three, so a
    // stale node here would be `show()`n after the tab was replaced (invariant 1's shape in the UI).
    this.liquidColourMixRow = null;
    this.liquidMixModelRow = null;
    this.dyeFixedColourRow = null;
    this.dyeRampRow = null;
    this.dyeMapRow = null;
    this.dyeCyclesRow = null;
    this.symmetryMirrorRow = null;
    this.zDepthNote = null;
    this.gateBySelect = null;
    this.gateAmountRow = null;
    this.gateHalfLifeRow = null;
    this.gateInvertRow = null;
    this.gateNote = null;
    // 21.4e/f — invariant 1's shape in the UI, the same reason the four fields above it are nulled: `render()`
    // rebuilds all of them, and a stale swatch canvas would be drawn into after the tab was replaced.
    this.indexColourPanel = null;
    this.indexSourcePresetLabel = null;
    this.indexSourceNameLabel = null;
    this.indexSwatch = null;
    this.indexPeriodLabel = null;
    this.indexStaticNote = null;
    this.ifsPanel = null;
    this.ifsRows = [];
    this.ifsArchetypeSel = null;
    this.layerPanel = null;
    this.layerRowContainer = null;
    this.styleRow = null;
    this.layerRows = [];
    this.layerBodies = [];
    this.expandedLayers.clear();
    this.addLayerSelect = null;
    this.pipelineReadout = null;
    this.swapButton = null;
    this.flatPanelSlot = null;
  }

  syncFromControls(): void {
    for (const c of this.controlList) this.syncControl(c);
    // Before `syncVisibility()`: the rows are what the shared panels get moved INTO, so they must exist
    // and match the chain first. A preset change RESYNCS the whole tab by design, and a preset can arrive
    // carrying a chain of a different length.
    this.syncLayerRows();
    this.syncVisibility();
    this.syncIfsRows();
    // v8 Step 14.4 — the gate's row visibility depends on `Gate By` AND on whether a material is live, and
    // the latter is set in a DIFFERENT TAB. `syncControl` restores each handle's value but nothing about
    // which rows apply, so this must run on every sync, not only when the select changes.
    this.updateGateRows();
    // v8 Step 21.4e — for `updateGateRows()`' reason and one more: the palette selection has TWO sources
    // (`overlay` and the live film look), so a `Look` change in this same tab moves it without either palette
    // control being touched. `syncControl` restores the two dropdowns' own values and knows nothing about what
    // they resolve TO.
    this.updatePaletteRows();
  }

  // ---- descriptor registry ------------------------------------------------------------------------

  private syncControl(c: ControlEntry): void {
    switch (c.kind) {
      case 'slider': {
        if (!c.el) return;
        const v = c.get();
        c.el.value = String(c.toPos ? c.toPos(v) : v);
        const lbl = c.el.nextElementSibling as HTMLElement | null;
        if (lbl) lbl.textContent = sliderFmt(c)(v);
        return;
      }
      case 'check':
        if (c.el) c.el.checked = c.get();
        return;
      case 'select': {
        if (!c.el) return;
        // v8 33.5 — see `SelectSpec.dynamicOptions`. The compare is what keeps this cheap and stable.
        if (c.dynamicOptions) {
          const want = c.dynamicOptions();
          const have = Array.from(c.el.options).map(o => [o.value, o.textContent ?? ''] as [string, string]);
          if (want.map(x => x.join('\u0000')).join('\u0001') !== have.map(x => x.join('\u0000')).join('\u0001')) {
            c.el.replaceChildren();
            for (const [value, text] of want) {
              const o = document.createElement('option');
              o.value = value;
              o.textContent = text;
              c.el.appendChild(o);
            }
          }
        }
        c.el.value = c.get();
        return;
      }
      case 'rgb': {
        const v = c.get();
        c.els.forEach((el, i) => { if (el) el.value = String(v[i]); });
        return;
      }
      case 'triplet': {
        // Both halves, on every sync. A control that moves its handle but not its readout is the
        // "built but not synced" class this registry exists to make impossible — Ribbon Width and Neon
        // Line Width were both that defect before the table.
        const v = c.get();
        // v8 2026-10-31 — the third half, and it has to be here for the reason the two above are: a cell
        // whose liveness is read only at construction is enabled over a figure that changed since.
        const live = c.cellLive?.();
        c.els.forEach((el, i) => {
          const raw = v[i] ?? 0;
          if (el) el.value = String(c.toPos ? c.toPos(raw) : raw);
          const lbl = c.labels[i];
          if (lbl) lbl.textContent = c.fmt(raw, i as 0 | 1 | 2);
          if (el && live) applyCellLiveness(el, live[i] !== false, c.deadReason, c.title);
        });
        return;
      }
    }
  }

  /**
   * Re-read one control. For the cross-control cases only — Ribbon/Neon are mutually exclusive, and
   * editing a flow parameter has to flip the archetype dropdown to Custom.
   *
   * Throws on an unknown key so a typo surfaces at first use instead of becoming a silent no-op; the
   * empty-registry check is for a stray event arriving after `dispose()`.
   */
  private syncKey(key: string): void {
    if (this.controlList.length === 0) return;
    const c = this.controlList.find(x => x.key === key);
    if (!c) throw new Error(`VisualFxTab: no control registered under "${key}"`);
    this.syncControl(c);
  }

  /** Re-read every control whose key starts with `prefix` (`'flow.'`, `'cp.'`). */
  private syncGroup(prefix: string): void {
    for (const c of this.controlList) {
      if (c.key.startsWith(prefix)) this.syncControl(c);
    }
  }

  private slider(spec: SliderSpec): HTMLElement {
    const c: SliderControl = { ...spec, kind: 'slider', el: null };
    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    /*
     * ⚠️ **THE ELEMENT'S RANGE IS IN *POSITION* UNITS WHENEVER A TRACK SUPPLIES `toPos`/`fromPos`, AND
     * SETTING IT FROM THE VALUE RANGE WAS A REAL DEFECT (owner report 2026-10-19).** The `input` handler
     * reads `input.value` and hands it to `fromPos`, so the element's value IS the position — but `c.min`
     * and `c.max` are in the control's own unit. Where the two spaces differ the element clamps every
     * position into the value range and `fromPos` then clamps the result to the track's end, so the handle
     * reaches the maximum a few per cent along and the rest of the travel is dead.
     *
     * **Measured before the fix** — *"the max value is already achieved at a fraction of the slider length
     * and the rest cannot be used"*:
     *
     *     Iso Level        0.0625-4   lowest reachable 0.0811   max at 23.8 % of travel
     *     Kernel Width     0.5-16     lowest reachable 2.83     max at  3.2 %
     *     Cohesion Radius  4-64       lowest reachable 64       STUCK AT MAX, one value only
     *     Colour Drift     -1..1      outer ~24 % of each side dead
     *
     * ⚠️ **DERIVED FROM `toPos` RATHER THAN HARDCODED TO 0..1, AND THAT IS NOT TIDINESS: TWO TRACKS ARE
     * SIGNED.** `COLOUR_DRIFT_TRACK.toPos` returns ±0.7598 and `rotationToPos` is signed too, so clamping
     * the element to 0..1 would have deleted their whole negative half. **Asking the track where its own
     * endpoints land is correct for every track and needs no per-track knowledge.**
     *
     * ⚠️ **`step` is ALREADY in position units for these tracks** — `trackcheck` models the grid as
     * `sanitize(pos, 0, 1, STEP)`, so it has asserted the position-space model all along. **The checker was
     * right and the widget never matched it**, which is why no clause went red: nothing asserted the
     * element's own `min`/`max` wiring.
     *
     * ⚠️ **THE SAME THREE LINES EXIST IN `rgbRow` AND `tripletRow`. ONE RULE, THREE WIDGETS — fixing one
     * is how they diverge.** A control with no `toPos` is unchanged: the bounds are then its own min/max.
     */
    /*
     * ⚠️ **A SLIDER'S `min`/`max` ARE IN THE UNIT THE ELEMENT CONSUMES: a POSITION whenever the spec
     * supplies `toPos`/`fromPos`, and the control's own value otherwise.** The `input` handler reads
     * `input.value` and hands it to `fromPos`, so for a tracked control the element's whole domain is the
     * position domain -- `0..1` for an unsigned track, `-1..1` for a signed one -- and `fromPos` maps that
     * onto the real value range.
     *
     * ⚠️ **THIS LINE WAS 'FIXED' TO `toPos(c.min)`..`toPos(c.max)` AND THAT WAS A DEFECT OF ITS OWN
     * (2026-10-19, reported as *"Particle Number and Figure Scale sliders are blocked"*).** Deriving the
     * bounds from the track is only correct where the spec states VALUES, which was three controls out of
     * nine; everywhere else it collapsed the element onto `toPos` of a position -- e.g. `speedFactor` to
     * `0..0.4454`, so its top value became 1 instead of 5, and `colourDrift` to `±0.7598`, capping it at
     * `±1` instead of `±3`.
     *
     * ⚠️ **THE REAL DEFECT WAS NEVER THIS LINE. IT WAS TWO CONVENTIONS SHARING ONE SIGNATURE** -- some call
     * sites passed position bounds and three passed value constants, and no type distinguished them. The
     * three have been changed to declare positions, so **there is now ONE convention and this line can be
     * the honest one-liner it always looked like.** `trackcheck` §G2 asserts that no tracked call site
     * passes a value constant again; that clause is the whole guard, because nothing else can see it.
     */
    input.min = String(c.min);
    input.max = String(c.max);
    input.step = String(c.step);
    const initial = c.get();
    input.value = String(c.toPos ? c.toPos(initial) : initial);
    input.className = 'sl-vfx-slider';
    const tip = tipFor(c);
    if (tip) {
      input.title = tip;
      // Also on the wrapper, so the hover target is the whole slider cell rather than the 12 px handle track.
      wrap.title = tip;
    }
    const valueLabel = document.createElement('span');
    valueLabel.className = c.wideLabel ? 'sl-vfx-value sl-vfx-value--wide' : 'sl-vfx-value';
    valueLabel.textContent = sliderFmt(c)(initial);
    input.addEventListener('input', () => {
      const pos = parseFloat(input.value);
      const v = c.fromPos ? c.fromPos(pos) : pos;
      valueLabel.textContent = sliderFmt(c)(v);
      c.set(v);
    });
    if (c.settleOnRelease && c.toPos && c.fromPos) {
      // `change` is the RELEASE event on a range input — it fires once when the drag ends (and on a keyboard
      // step), where `input` fires continuously during the drag. Both are needed: dragging must stay live,
      // and only the release may reposition the handle.
      input.addEventListener('change', () => {
        const v = c.fromPos!(parseFloat(input.value));
        const canon = String(c.toPos!(v));
        // Assign, then read back: the element SANITISES the value to its own `min + k*step` grid, so the
        // string that goes in is not necessarily the one that comes out. If the sanitised position no longer
        // maps to `v` the reposition would silently change the count, so restore and leave the handle be.
        const before = input.value;
        input.value = canon;
        if (c.fromPos!(parseFloat(input.value)) !== v) input.value = before;
      });
    }
    // The label must stay the input's NEXT SIBLING — `syncControl` locates it that way rather than
    // holding a second reference per control.
    wrap.appendChild(input);
    wrap.appendChild(valueLabel);
    c.el = input;
    this.controlList.push(c);
    return wrap;
  }

  private check(spec: CheckSpec): HTMLInputElement {
    const c: CheckControl = { ...spec, kind: 'check', el: null };
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'sl-vfx-check';
    const tip = tipFor(c);
    if (tip) input.title = tip;
    input.checked = c.get();
    input.addEventListener('change', () => c.set(input.checked));
    c.el = input;
    this.controlList.push(c);
    return input;
  }

  private select(spec: SelectSpec): HTMLSelectElement {
    const c: SelectControl = { ...spec, kind: 'select', el: null };
    const sel = document.createElement('select');
    sel.className = 'sl-vfx-select';
    const tip = tipFor(c);
    if (tip) sel.title = tip;
    for (const [value, text] of c.options) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      sel.appendChild(o);
    }
    sel.value = c.get();
    sel.addEventListener('change', () => c.set(sel.value));
    c.el = sel;
    this.controlList.push(c);
    return sel;
  }

  private rgbRow(label: string, spec: RgbSpec): HTMLElement {
    const c: RgbControl = { ...spec, kind: 'rgb', els: [null, null, null] };
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    // On the ROW, so the label and all three channels share one hover target — the three sliders are one
    // control here (`set` takes the whole vec3) and three separate tooltips would say the same thing thrice.
    const tip = tipFor(c);
    if (tip) row.title = tip;
    const lbl = document.createElement('span');
    lbl.className = 'sl-vfx-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;gap:4px;';
    const initial = c.get();
    const channels = ['R', 'G', 'B'];
    const inputs: HTMLInputElement[] = [];
    for (let i = 0; i < 3; i++) {
      const mini = document.createElement('div');
      mini.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;';
      const ch = document.createElement('span');
      ch.style.cssText = 'font-size:10px;color:#666;';
      ch.textContent = channels[i]!;
      const input = document.createElement('input');
      input.type = 'range';
      // ⚠️ **THIS ROW IS EXEMPT FROM `slider()`'s POSITION/VALUE RULE, and `tsc` is what proved it:**
      // `RgbControl` declares no `toPos` at all, so an RGB channel is a plain 0–1 VALUE slider and its
      // range was always in the right unit. **Stated rather than left silent** — the three widgets carry
      // identical-looking lines, and the next reader comparing them needs to know this one is correct as
      // it stands rather than overlooked. `slider()` and `tripletRow()` are the two that take tracks.
      input.min = String(c.min);
      input.max = String(c.max);
      input.step = String(c.step);
      input.value = String(initial[i]);
      input.className = 'sl-vfx-slider';
      inputs.push(input);
      input.addEventListener('input', () => {
        c.set([parseFloat(inputs[0]!.value), parseFloat(inputs[1]!.value), parseFloat(inputs[2]!.value)]);
      });
      c.els[i] = input;
      mini.appendChild(ch);
      mini.appendChild(input);
      wrap.appendChild(mini);
    }
    row.appendChild(wrap);
    this.controlList.push(c);
    return row;
  }

  /**
   * Three captioned sliders on one row, each with its own value readout — see {@link TripletSpec}.
   *
   * ⚠️ **Each handler writes only ITS OWN axis** (`c.set(i, v)`), never a whole vec3 rebuilt from the three
   * DOM elements the way `rgbRow` does. That difference is load-bearing: the setter clamps in the engine and
   * the getter reads the clamp back, so a rebuild-from-DOM would take the OTHER two axes from the elements
   * rather than from the engine, and a clamped axis would be silently re-written from its stale handle
   * position on the next sibling's drag.
   */
  private tripletRow(label: string, spec: TripletSpec): HTMLElement {
    const c: TripletControl = { ...spec, kind: 'triplet', els: [null, null, null], labels: [null, null, null] };
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    const rowTip = tipFor(c);
    if (rowTip) row.title = rowTip;
    const lbl = document.createElement('span');
    lbl.className = 'sl-vfx-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-triplet';
    const initial = c.get();
    for (let i = 0; i < 3; i++) {
      const axis = i as 0 | 1 | 2;
      const cell = document.createElement('div');
      cell.className = 'sl-vfx-triplet-cell';
      const cap = document.createElement('span');
      cap.className = 'sl-vfx-triplet-caption';
      cap.textContent = c.captions[i]!;
      const input = document.createElement('input');
      input.type = 'range';
      // ⚠️ **THE SAME POSITION/VALUE MISMATCH AS `slider()` — see that method's note for the measurements
      // and for why the bounds come from `toPos` rather than from 0..1 (two tracks are SIGNED).**
      // **ONE RULE, THREE WIDGETS: `slider`, `rgbRow` and `tripletRow` all had it.**
      // ⚠️ **The same ONE convention as `slider()` — see that method's note.** This widget
      // takes tracks too (`Rotation` is signed), so it had the same wrong 'fix' and the same revert.
      input.min = String(c.min);
      input.max = String(c.max);
      input.step = String(c.step);
      const start = initial[i] ?? 0;
      input.value = String(c.toPos ? c.toPos(start) : start);
      input.className = 'sl-vfx-slider';
      if (rowTip) input.title = rowTip;
      /*
       * v8 `34.5` — ⚠️ **AN `aria-label` ON EACH OF THE THREE, AND IT IS A PRE-EXISTING GAP THIS PHASE IS
       * THE FIRST TO NEED CLOSED.** `makeRow(label, control, aria?)` labels its single input;
       * `tripletRow` labelled NONE of its three, so `Rotation`, `Travel`, the twist, the taper, the bend
       * and the channels were all unreachable by name. Phase 17's rule is *no `data-testid` — ever: select
       * on the `aria-label`*, and `34.4` converts `Sharpness` from a single slider (which HAD a name) into
       * a triplet, so any spec or `capture-ui.mjs` recipe reaching it by name would have stopped matching.
       * **Fixed for every caller rather than special-cased for this row.**
       */
      input.setAttribute('aria-label', `${label} ${c.captions[i]}`);
      const valueLabel = document.createElement('span');
      valueLabel.className = 'sl-vfx-triplet-value';
      valueLabel.textContent = c.fmt(start, axis);
      input.addEventListener('input', () => {
        const pos = parseFloat(input.value);
        const v = c.fromPos ? c.fromPos(pos) : pos;
        c.set(axis, v);
        /*
         * v8 `32.14` ⚠⚠ **READ BACK WHAT THE ENGINE TOOK, RATHER THAN SHOWING WHAT WAS DRAGGED, AND
         * THE OLD ORDER MADE EVERY DEAD ZONE INVISIBLE.** This handler used to format `v` and *then* call
         * `set`, so a setter that CLAMPS or SNAPS had its result thrown away: the readout printed the
         * dragged number and the thumb stayed where the pointer left it.
         *
         * ⚠⚠ **THAT IS WHY `TWIST_SNAP` NEVER WORKED IN THE UI.** The owner asked for a snap in Phase
         * 31 because centre-off sliders were hard to return to zero; `setTwist` has snapped since, and the
         * panel has been showing `+0.03 turns` over an operator the engine had already set to 0 the whole
         * time. **The engine was right, the readout could not show it** — invariant 13's harder form, and
         * it hid the fix for a full phase. `32.1`/`32.2` then inherited the same silence.
         *
         * ⚠ **THE THUMB IS MOVED TOO, not just the text.** A readout saying `Off` under a thumb sitting
         * off-centre is a second disagreement, and the thumb is what the user aims with.
         */
        const live = c.get()[axis];
        if (live !== undefined && live !== v) {
          valueLabel.textContent = c.fmt(live, axis);
          input.value = String(c.toPos ? c.toPos(live) : live);
        } else {
          valueLabel.textContent = c.fmt(v, axis);
        }
      });
      c.els[i] = input;
      c.labels[i] = valueLabel;
      // v8 2026-10-31 — the construction-time half of `cellLive`; `sync()` owns the re-read.
      const liveNow = c.cellLive?.();
      if (liveNow) applyCellLiveness(input, liveNow[i] !== false, c.deadReason, rowTip);
      cell.appendChild(cap);
      cell.appendChild(input);
      cell.appendChild(valueLabel);
      wrap.appendChild(cell);
    }
    row.appendChild(wrap);
    this.controlList.push(c);
    return row;
  }

  /** Shorthand used by all 20 Customize descriptors, and the reason `FilmLookParams` is imported. */
  private cpSet(patch: Partial<FilmLookParams>): void {
    this.controls.setCustomFilmLookParam(patch);
  }

  // ---- visibility ---------------------------------------------------------------------------------

  /**
   * Every conditional section, derived from the live state in ONE place.
   *
   * This is the same shape as `applyFluidFeedbackState()` in `main.ts`: each `change` handler that can
   * affect a section calls this rather than toggling the sections it happens to remember. The Force Field
   * section (I9) and the Volume Render section were both left behind by handlers that toggled some of
   * their dependents.
   *
   * The Force Field section applies to a chain with at least one FIELD layer other than 6:
   * `getForceModes().texture` is false for a style-6-only chain, because Fluid Feedback warps pixels from
   * the 512² fluid velocity field and never builds a displacement texture, and false for an IFS-only chain
   * too — but style 4 has its own CPU force path, so that one keeps the section. Leaving it visible for a
   * chain with no force path at all meant three live controls driving something that does not exist.
   *
   * ⚠️ **This also OWNS where the three per-style panels live in the DOM.** They are moved, never rebuilt
   * (see the `layerPanel` field comment), and the destination is DERIVED here from the chain rather than
   * assigned by whichever handler ran — the same shape as `applyFluidFeedbackState()` in `main.ts`, and
   * for the same reason: six sites that each assigned on entry and never restored is how the style-6
   * override came to leak.
   */
  /**
   * v8 `34.4` — the ONE readout for all four breathing RATES.
   *
   * ⚠️ **It uses `periodPhrase()` from `composer-model.ts` VERBATIM and may not reword either spelling** —
   * both are asserted by `tests/04-preview-only-and-readouts.spec.ts`, and the phrase is already shared by
   * two tabs, so a reword silently retitles both.
   *
   * ⚠️ **`repeats: true` IS CORRECT HERE AND MEANS SOMETHING NARROWER THAN IT DOES IN THE COMPOSER.** There
   * the flag is COMMENSURABILITY across several modulator rates, tested on their ratio; here there is exactly
   * ONE rate per cell, so a period always exists and always repeats. **Each cell therefore describes its own
   * axis and nothing else** — three cells of `Sway Rate` at three rates print three different periods, which
   * is the whole point of `34.D11`'s per-axis reversal and is not a readout that needs reconciling.
   *
   * ⚠️ **THE PERIOD INHERITS `generators.waveSpeed` AND `overlay.speedFactor`**, so it moves when either
   * does. That is correct — all breathing in this engine does — and it will surprise an author who reads the
   * number as wall-clock seconds, which is what the tooltip answers. ⚠️ `waveSpeed` 0 gives no period at all
   * (`modulatorSeconds` returns `null`), and the honest answer there is that the figure's modulators are
   * frozen, not that the control is off.
   */
  private fmtOpRate(rate: number): string {
    if (rate === 0) return 'Off';
    const seconds = modulatorSeconds(rate, this.controls.getWaveSpeed());
    if (seconds === null) return 'figure paused';
    return periodPhrase({ seconds, repeats: true });
  }

  /**
   * v8 `34.D9` — **how close the figure's own Z extent comes to the depth at which particles are dropped.**
   *
   * ⚠️⚠️ **THE GATE IS THE OPERATOR'S OWN IDENTITY, not a mode, and that is a CORRECTION to `34.D9`'s
   * premise.** The decision assumed invariant 25 would apply — *a control that explains the pipeline must be
   * gated on every early return upstream of it* — but there is **no perspective switch**: the divide runs
   * unconditionally and `project()` answers `CULL_SENTINEL` for `q <= 0`. So the row says nothing while
   * `offsetZ` and `travelZ` are both 0, because otherwise it prints a number about all 314 presets and
   * becomes noise. **The description owns the gate.**
   *
   * ⚠️⚠️ **INVARIANT 27: BOTH QUANTITIES ARE CANVAS-DEPENDENT, SO THIS IS RECOMPUTED ON EVERY SYNC AND
   * NEVER CACHED.** `perspectiveZ = -(cw + ch)/2` and `waveScale = min(cw/designW, ch/designH)` both move
   * with the window, so **the same preset is safe on one window and clips on another** — which is why the
   * sentence names the window rather than implying a safe value. **A preset cannot compensate for a
   * canvas-dependent error.**
   *
   * ⚠️ **It reads the DEEPEST point, `min(z)`, against a NEGATIVE cull depth.** The near side cannot be
   * culled: `q = zScaled - perspectiveZ` grows as z grows, so only the far side approaches 0. Reporting
   * `max |z|` would be a true number about the wrong end of the figure (invariant 24 — measure the direction
   * of the scale, and invert exactly once).
   *
   * ⚠️⚠️ **STATED LIMIT, NOT A DEFECT TO FIX WITH A LISTENER: a bare WINDOW RESIZE does not repaint this
   * note.** It is recomputed on every `syncVisibility()` — which runs on any control interaction, on a
   * preset change and on re-showing the tab — but nothing in this tab observes the canvas. **Adding a resize
   * listener here would be a second owner of "the canvas changed"**, which `main.ts` already owns, and the
   * identical limit is recorded for `16.20a`'s `setSpeedFactor` and for the Composer's Score. The read is of
   * the LIVE generator, so the number is never stale in the sense that matters; it is LATE, and the sentence
   * says the limit depends on the window precisely so a reader who resizes knows to expect a different
   * answer.
   */
  private updateZDepthNote(): void {
    const note = this.zDepthNote;
    if (!note) return;
    const live = this.controls.getOffset()[2] !== 0 || this.controls.getTravel()[2] !== 0;
    note.style.display = live ? '' : 'none';
    if (!live) return;
    const cull = this.controls.getPerspectiveCullDepth();
    const deepest = this.controls.getZExtent()[0];
    // `cull` is negative; a deepest point of 0 is 0 % of the way to it. Guard the degenerate canvas.
    const pct = cull < 0 ? Math.max(0, (deepest / cull) * 100) : 0;
    note.textContent = `This figure now reaches ${pct.toFixed(0)} % of the camera depth on this window. `
      + 'Past 100 % the far particles pass behind the camera and are dropped, which looks like a streak '
      + 'leaving the screen rather than a clip. The limit is set by the window size, not by the preset — a '
      + 'value that is safe here can clip on a different window.';
  }

  private syncVisibility(): void {
    const chain = this.controls.getTransMapChain();
    const show = (elem: HTMLElement | null, visible: boolean): void => {
      if (elem) elem.style.display = visible ? '' : 'none';
    };
    show(this.customizePanel, this.controls.getFilmLook() === CUSTOMIZE_FILM_LOOK);

    /**
     * ⚠️ **THE LAYER PANEL IS ALWAYS VISIBLE. It must never be gated on chain length.**
     *
     * It was, and the result was a BOOTSTRAP DEADLOCK: `+ Add Layer` lives inside this panel, so hiding the
     * panel for a chain of one hid the only way to reach a chain of two — the panel appeared exactly when it
     * was no longer needed to get there. Every one of the 177 presets loads with a single layer, so the
     * feature was unreachable from every starting state, and it presented as "the UI is missing" rather than
     * as anything broken. `display:none` is why no checker could see it: the DOM, the descriptors and the
     * engine were all correct and complete.
     *
     * The Style dropdown stays for a chain of ONE, where it has a single well-defined value, as the one-step
     * fast path for the overwhelmingly common edit (change which style a single-style preset uses). With two
     * or more layers there is no single style for it to show, so it hides and the rows are the only truth.
     */
    const single = chain.length <= 1;
    show(this.styleRow, single);
    show(this.layerPanel, true);

    const has = (style: number): boolean => chain.some(l => l.style === style);
    // Present-but-muted still shows its settings: a muted layer keeps its configuration, and hiding the
    // controls would make the mute look like a removal.
    this.placeStylePanel(4, this.ifsPanel, has(4), single);
    this.placeStylePanel(5, this.proceduralFlowPanel, has(5), single);
    this.placeStylePanel(6, this.fluidFeedbackPanel, has(6), single);

    const fieldForce = chain.some(l => l.enabled && l.style !== 6 && l.style !== ECHO_STYLE);
    const ifsForce = chain.some(l => l.enabled && l.style === ECHO_STYLE);
    show(this.forceFieldSection, this.controls.getTransMapEnabled() && (fieldForce || ifsForce));
    show(this.volumeSection, this.controls.getRenderMode() === 'volume');
    show(this.liquidSection, this.controls.getRenderMode() === 'liquid');
    /*
     * ⚠️ **THREE ROWS, ONE `tintSource` READ, AND THEY MOVE IN OPPOSITE DIRECTIONS** (2026-10-16). Hidden
     * rather than disabled throughout, because a control the active configuration does not READ is absent,
     * not inapplicable — **a greyed row would imply it still applies.** That rule was already stated here
     * for `Surface Ramp` and at `dyeFixedColourRow`; this is the same rule applied to the two rows that were
     * contradicting it.
     *
     * ⚠️ **`Surface Ramp` NOW SHOWS UNDER `'dye'` TOO, AND THE OLD COMMENT WAS WRONG ABOUT WHY IT DIDN'T.**
     * It read *"the other three sources do not read it at all"* — true of `'preset'` and `'palette'`, and
     * FALSE of `'dye'` since 15.7: `liquidRampName()` returns `surfaceRamp` for every source except
     * `'material'`-with-a-material, and the dye branch samples it as its **per-pixel fallback** wherever the
     * field is thin or has never been visited. So the one source whose body colour the ramp actually governs
     * was the one source that could not reach the control, and the workaround was to flip to `Ramp`, pick,
     * and flip back. ⚠️ **Reported by the owner as the figure's colour being unconfigurable** — the honest
     * reading of the old comment is that it described four sources and had been checked against two.
     *
     * ⚠️ **`material` is STILL excluded and that asymmetry is deliberate** — it falls back to the ramp only
     * when no material is live, which is a degradation the tooltip states rather than a second authoring
     * path. Showing the row there would suggest the two sources combine. **`dye` is different in kind: its
     * fallback is PER-PIXEL and permanent, not a degradation of a missing dependency.**
     */
    const liquidTint = this.controls.getLiquidConfig().tintSource;
    show(this.liquidRampRow, liquidTint === 'ramp' || liquidTint === 'dye');
    // The inverse pair — see where they are built for the `mixAmt = 0` identity that makes them unreadable.
    show(this.liquidColourMixRow, liquidTint !== 'dye');
    show(this.liquidMixModelRow, liquidTint !== 'dye');
    // v8 15.7 — Fixed Colour applies to exactly one Colour Source, and hidden rather than greyed for
    // `liquidRampRow`'s reason: the other two sources do not read it at all. ⚠️ **No entry for the Dye Field
    // SECTION on purpose** — it is not mode-gated (see `buildDyeSection`).
    show(this.dyeFixedColourRow, this.controls.getDyeConfig().colourSource === 'fixed');
    // v8 28.4 — the same one-source rule as the row above it.
    show(this.dyeRampRow, this.controls.getDyeConfig().colourSource === 'ramp');
    /*
     * v8 28.16 — ⚠️ **`Dye Map` is shown for the THREE RAMP SOURCES ONLY (`28.D17`)**: the other four read
     * no ramp, so an index coordinate there would be a control with nothing to move. `Dye Cycles` is then
     * nested one level deeper, since it is unreachable under the depth coordinate.
     */
    const dyeCfg = this.controls.getDyeConfig();
    const dyeRampSource = dyeCfg.colourSource === 'depth' || dyeCfg.colourSource === 'palette'
      || dyeCfg.colourSource === 'ramp';
    show(this.dyeMapRow, dyeRampSource);
    show(this.dyeCyclesRow, dyeRampSource && (dyeCfg.mapping ?? 'depth') === 'index');
    // E30: Mirror selects between the dihedral and cyclic groups, and neither exists at fold 1.
    show(this.symmetryMirrorRow, this.controls.getSymmetryFold() > 1);
    this.updateZDepthNote();
    // v8 30.2 — the three dependent fold rows. The ITERATION COUNT is the gate, in the engine and here.
    {
      const folding = this.controls.getBoxFold().iterations > 0;
      show(this.foldLimitRow, folding);
      show(this.foldScaleRow, folding);
      // v8 32.7 — the inversion's own activation scalar, exactly as `folding` is the fold's.
      const inverting = this.controls.getInversion().amount > 0;
      show(this.invertRadiusRow, inverting);
    }
    // v8 31.4 — the three angles are provably inert at extent 0 (the stage is skipped), so the row is
    // hidden there rather than shown dead. ⚠️ `display: none` stops a row being SEEN, not working: the
    // authored angles stay exported and stay in the snapshot, which is why the engine's gate is on the
    // EXTENT and not on this row's visibility.
    /*
     * v8 `31.U` — **the enabler gates. An off feature shows its title and its switch and nothing else.**
     *
     * ⚠️ **`Liquid Field` IS HERE AND THAT REVERSES A STANDING never-re-propose** (*"Liquid Field rows
     * disabled with Enable off"*). **The owner reversed it explicitly on 2026-10-25**, asking for the
     * same treatment across the tab. ⚠️ **The old decision was about DISABLING (greying rows in place);
     * this HIDES them, which is what buys the space the reversal was asked for** — so the two are not
     * quite the same proposal, and the reversal is recorded rather than assumed.
     *
     * ⚠️ **`Physarum` is gated on `blend > 0`, NOT on a checkbox**: its `Show Trail` box is a sub-option
     * and the subsystem's activation scalar is the blend. **Reading the checkbox would have gated the
     * whole section on an unrelated switch** — every field system here has a different activation
     * scalar, which is `22.D4`'s point.
     */
    /*
     * v8 `31.U2` — **the activity counts. ONE owner for every number, here, beside the gates that read
     * the same scalars.**
     *
     * ⚠️⚠️ **EVERY PREDICATE IS A DIFFERENT SCALAR AND THAT IS WHY THIS CANNOT BE A LOOP OVER A KEY
     * LIST** — `enabled` for curl / liquid field / dye / neon, `blend` for physarum and fluid advection,
     * `strength` for cohesion, an INDEX for the attractor, a mode WORD for the renderer, and a compound
     * for deformation. **`22.D4`'s finding, as data.**
     *
     * ⚠️ **IT COUNTS ACTIVE FEATURES, NOT CHANGED SETTINGS** — see `makeGroup`, where the choice and its
     * reason are recorded. The number a user sees is *how many things in here are doing something*.
     *
     * ⚠️ **`Framing & Timing` contributes NOTHING to `Figure`'s count, deliberately: size, speed and
     * particle count have no off state**, so counting them would light the badge on all 292 presets and
     * the number would stop carrying information.
     */
    if (this.groupMarks) {
      const m = this.groupMarks;
      const on = (b: boolean) => (b ? 1 : 0);
      /*
       * ⚠️ **`32` ADDS THREE OPERATORS AND THEREFORE THREE TERMS, and the badge counts ACTIVE OPERATORS
       * rather than non-default fields** — so taper and bend are two terms, not six, and the inversion is
       * one, not three. Each term is the operator's own activation scalar, which is what the badge
       * promises in `makeCollapsible`'s header.
       */
      const deformN = on(this.controls.getTwist().some(v => v !== 0))
        + on(this.controls.getTaper().some(v => v !== 0))
        + on(this.controls.getBend().some(v => v !== 0))
        + on(this.controls.getInversion().amount > 0)
        + on(this.controls.getBoxFold().iterations > 0)
        + on(this.controls.getDeform4d().wScale > 0)
        + on(this.controls.getSymmetryFold() > 1);
      m.cDeform.setCount(deformN);
      m.gFigure.setCount(deformN + on(this.controls.getAttractorIndex() >= 0));

      const ch = this.controls.getChannels();
      m.gParticles.setCount(on(this.controls.getRenderMode() !== 'star')
        + on(ch.size !== 0 || ch.alpha !== 0 || ch.light !== 0)
        + on(this.controls.getRibbonState() !== 'off')
        + on(this.controls.getLinesEnabled()));

      // ⚠️ The palette has TWO sources and `resolvePaletteSelection` owns the order; this reads the
      // SELECTION rather than either raw field, so the badge cannot disagree with what is drawn.
      const pal = this.controls.getPaletteSelection();
      m.gColour.setCount(on(!!pal && pal.name !== 'none')
        + on(this.controls.getFilmLook() !== 'Legacy'));

      m.gImage.setCount(on(this.controls.getTransMapEnabled()));

      m.gFields.setCount(on((this.controls.getCohesionConfig()?.strength ?? 0) > 0)
        + on(this.controls.getLiquidFieldConfig().enabled)
        + on(this.controls.getDyeConfig().enabled)
        + on((this.controls.getFluidAdvectionConfig()?.blend ?? 0) > 0)
        + on(this.controls.getCurlEnabled())
        + on((this.controls.getPhysarumConfig()?.blend ?? 0) > 0));
    }
    show(this.liquidFieldBody, this.controls.getLiquidFieldConfig().enabled);
    show(this.dyeBody, this.controls.getDyeConfig().enabled);
    show(this.neonBody, this.controls.getLinesEnabled());
    show(this.curlBody, this.controls.getCurlEnabled());
    show(this.physarumBody, (this.controls.getPhysarumConfig()?.blend ?? 0) > 0);
    show(this.wAngleRow, this.controls.getDeform4d().wScale > 0);
    show(this.wWindingRow, this.controls.getDeform4d().wScale > 0);

    if (this.pipelineReadout) {
      this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
    }
    // The swap is only meaningful with an echo layer AND something to swap it past — see
    // `echoRunsFirst()` for why field-layer order is a mathematical no-op and this is the ONE executable
    // reordering. Disabled rather than hidden, so its meaning stays discoverable.
    if (this.swapButton) {
      this.swapButton.disabled = !(has(ECHO_STYLE) && chain.some(l => l.style !== ECHO_STYLE));
    }
  }

  /**
   * Move a shared per-style panel to where the current chain shape wants it, and show or hide it.
   *
   * `appendChild` MOVES a node; it never copies. That is the whole mechanism — the panel keeps its
   * identity, so its descriptor entries in `controlList` stay valid and `syncKey('flow.strength')` keeps
   * resolving. A no-op guard on `parentElement` avoids re-appending every sync, which would otherwise
   * reset a focused slider's interaction.
   */
  private placeStylePanel(style: number, panel: HTMLElement | null, present: boolean, single: boolean): void {
    if (!panel) return;
    panel.style.display = present ? '' : 'none';
    if (!present) return;
    const idx = this.controls.getTransMapChain().findIndex(l => l.style === style);
    const body = single || idx < 0 ? null : (this.layerBodies[idx] ?? null);
    // ⚠️ The flat destination is a dedicated SLOT, not `this.container`. `appendChild(container)` would
    // move the panel to the END of the tab — below Physarum, Fluid and Materials — because that is what
    // appending to a container does. The slot holds the panel's original position in the TransMap section.
    const target = body ?? this.flatPanelSlot;
    if (target && panel.parentElement !== target) target.appendChild(panel);
    // Inside a layer row the panel's own left indent would double up with the row's.
    panel.style.marginLeft = body ? '0' : '12px';
  }

  // ---- render -------------------------------------------------------------------------------------

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.controlList = [];

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Live rendering overlays — hover any control or header for what it does. Changes apply immediately and are only saved by Export or Snapshot.';
    el.appendChild(desc);

    // --- Framing section (FIRST) ---
    //
    // Figure Scale and Animation Speed sit at the top because they answer "how big and how fast",
    // which is what a user reaches for before any styling — and because Figure Scale is the control
    // that compensates for the uniform canvas fit, so it needs to be found without hunting.
    // The three per-section hint paragraphs that used to sit here (Figure Scale's letterboxing note,
    // Rotation's unit/nominal-rate note, Symmetry's density note) are now the TOOLTIPS on those controls
    // and on this header — see `../tooltips.ts`. Nothing was dropped; it moved to where it is asked for.
    /*
     * v8 `31.U` — **FIVE COLLAPSIBLE GROUPS, and the assembly at the end of this method is what decides
     * the on-screen order.** Every section below is built exactly where it always was and appended into
     * its own container; nothing was moved. **A reordering done by moving blocks would have put ~2 000
     * lines of unrelated diff between the reader and the change, and any one of those moves could have
     * dropped a row from `syncVisibility`.**
     *
     * ⚠️⚠️ **THIS IS A LAYOUT CHANGE ONLY — no control, handler, key, default or gate is touched, so
     * Export, Import, Snapshot, History and the Mixer see an identical preset structure.** The one thing
     * that could have broken that is deferring construction, and `makeGroup` deliberately does not:
     * collapsing toggles `hidden`, and **`display: none` stops a row being SEEN, not working.**
     *
     * ⚠️ **`tgt` is a cursor, switched at each section boundary.** A section whose boundary is missed
     * lands in whichever group precedes it rather than vanishing — which is a visible defect rather than
     * a silent one, and that is the right failure mode for a cursor.
     */
    /*
     * ⚠️⚠️ **ALL FIVE START COLLAPSED (owner, option B, 2026-10-25), AND THAT IS ONLY SAFE BECAUSE OF THE
     * ACTIVITY MARKER.** Collapsing trades clutter for CONCEALMENT: measured over the 292-preset library,
     * 170 presets (58 %) run a Translation Map and 123 (42 %) a palette, so without a marker a user
     * loading one of those gets no hint that a live effect sits inside a closed group. **The badge is
     * what pays for the collapse — the two are one decision and neither should ship alone.**
     */
    const gFigure = this.makeGroup(this.groupTitle('Figure'), false);
    const gParticles = this.makeGroup(this.groupTitle('Particles'), false);
    const gColour = this.makeGroup(this.groupTitle('Colour'), false);
    const gImage = this.makeGroup(this.groupTitle('Image'), false);
    const gFields = this.makeGroup(this.groupTitle('Fields'), false);
    // v8 31.U2 — `Deformation` is a 9-row section with no enabler, so it gets a collapsible HEAD rather
    // than a predicate gate. See `makeCollapsibleSection` for why a predicate would be wrong.

    const cDeform = this.makeCollapsibleSection(this.groupTitle('Deformation'));
    this.groupMarks = { gFigure, gParticles, gColour, gImage, gFields, cDeform };

    const mk = () => document.createElement('div');
    const secFraming = mk(), secBasis = mk(), secDeform = mk(), secAttractor = mk();
    const secRenderMode = mk(), secVolume = mk(), secLiquidSurface = mk(), secPerParticle = mk();
    const secSplat = mk(), secRibbon = mk(), secNeon = mk();
    const secFilm = mk(), secPalette = mk(), secDye = mk();
    const secTransMap = mk();
    const secCohesion = mk(), secLiquidField = mk(), secFluid = mk(), secCurl = mk(), secPhysarum = mk();
    let tgt: HTMLElement = secFraming;

    tgt = secFraming;
    tgt.appendChild(this.sectionTitle('Framing & Timing', false));

    /**
     * Figure Scale, 0.2×–5.0× on a LOGARITHMIC track.
     *
     * The slider position is 0–1 and the scale is `sliderMul(pos)` = `2^(log2(5)·(2·pos−1))`, the same
     * curve the Sliders tab uses for its ten semantic multipliers — reused rather than reinvented so the
     * two feel identical and the endpoints stay exact (0 → 0.2×, 0.5 → 1.0×, 1 → 5.0×).
     *
     * Logarithmic because a linear 0.2–5.0 track would give shrinking only 17 % of the travel: halving
     * the figure and doubling it are equal-sized visual changes, so they deserve equal-sized gestures.
     * On this curve each half of the track covers exactly one direction, and a step near 0.2× moves
     * 0.003× versus 0.036× near 2.2× — fine control where the figure is small, which is what was asked
     * for.
     */
    tgt.appendChild(this.makeRow('Figure Scale', this.slider({
      key: 'figureScale', min: 0, max: 1, step: 0.005,
      get: () => this.controls.getFigureScale(),
      set: v => this.controls.setFigureScale(v),
      toPos: figureScaleToPos, fromPos: sliderMul, fmt: fmtFigureScale,
    })));
    // Speed — 0.01x-5.0x on the squared `SPEED_TRACK` defined at the top of this file, where the measurements
    // and the reason the min could not be changed on its own are recorded.
    tgt.appendChild(this.makeRow('Speed', this.slider({
      key: 'speedFactor', min: 0, max: 1, step: SPEED_STEP,
      get: () => this.controls.getSpeedFactor(),
      set: v => this.controls.setSpeedFactor(v),
      toPos: SPEED_TRACK.toPos, fromPos: SPEED_TRACK.fromPos, fmt: fmtSpeed,
      settleOnRelease: true,
    })));
    /**
     * Particle Number — 1–50 000 on the cubic track defined at the top of this file.
     *
     * The DOM track is 0–1 and the count is derived through `posToParticleCount`, rather than putting
     * `min='1' max='50000'` on the element directly: a native range input is linear in its own value, so the
     * non-linearity has to live in the mapping. The cubic pins every position below `(0.5/49999)^(1/3)` =
     * 0.0215 to a count of 1 no matter how fine the step; that plateau is ~2.2 % of the track (about 6 px of
     * 300) and is inherent to anchoring the range at 1. It is the one place the curve gives the sparse end
     * LESS than a linear track would, and it is small enough to accept.
     *
     * ⚠️ **`step` is 0.0005, and it is 0.0005 BECAUSE of the snap to 100** (2026-08-20) — the two changed
     * together. `posToParticleCount` now rounds to a multiple of 100 (`snapParticleCount`), which makes the
     * step a question of which multiples the track can REACH rather than how fine the drag feels. Measured
     * over every stop:
     *
     *   - at the old `step: 0.001`, **44 of the 500 multiples were unreachable** — the whole 29 900-49 800
     *     range, in which 45 000 landed on 44 900. A round number a user asks for by dragging has to exist.
     *   - at `0.0005` all 500 are reachable and only 89 and 98 drop out of the unsnapped 1-99 range, where 27
     *     were already unreachable before this change.
     *   - 0.0002 buys nothing further (both figures reach 0) and quadruples the dead stops: 135 consecutive
     *     positions map to 200, so a keyboard arrow would appear to do nothing 135 times in a row.
     *
     * The snap also CUTS the work of a drag, which is the opposite of the usual direction for a finer step:
     * 599 distinct counts over a full sweep against 947 before, i.e. 348 fewer buffer reallocations
     * (`setParticleCount` grows nine typed arrays).
     *
     * The getter reads the GENERATOR's count, so a preset change, a Density-slider move or a Randomiser
     * mutation all show up here. ⚠️ Those three paths are NOT snapped — only this slider is — which is why
     * `Multiple`'s 4 032 keeps its exact count until someone drags the handle.
     */
    tgt.appendChild(this.makeRow('Particle Number', this.slider({
      key: 'particleCount', min: 0, max: 1, step: PARTICLE_STEP,
      get: () => this.controls.getParticleCount(),
      set: v => this.controls.setParticleCount(v),
      toPos: particleCountToPos, fromPos: posToParticleCount, fmt: fmtParticleCount,
      wideLabel: true, settleOnRelease: true,
    })));

    /**
     * X / Y / Z rotation speed, ±10 RPM on the signed quartic track in `core/rotation-track.ts`.
     *
     * Everything numeric about this control — the unit derivation (`1 RPM = 6 °/s`), the sign inversion that
     * makes left-of-centre clockwise, the curve, the step, the quantisation grid and the round-trip
     * measurements against all 177 legacy presets — is documented and measured there, because those numbers
     * have three owners: this track, the generator's clamp, and `trackcheck`.
     *
     * ⚠️ **Three sliders, one row, and each writes only its own axis** — `tripletRow`'s header says why that
     * matters against the engine's clamp.
     *
     * Lives in Framing & Timing between Figure Scale (how big) and Speed (how fast overall) because it is the
     * third framing question — which way the figure faces over time — and because the two it sits between are
     * the controls it interacts with: Figure Scale decides whether a tumble swings the figure out of frame,
     * and Speed multiplies the actual rate (`generator.update(dt * speedFactor)`), which is why the readout
     * is deliberately NOMINAL RPM and the TOOLTIP says so.
     */
    tgt.appendChild(this.tripletRow('Rotation', {
      key: 'rotationSpeed', min: -1, max: 1, step: ROT_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getRotationSpeed(),
      set: (axis, v) => this.controls.setRotationSpeed(axis, v),
      toPos: rotationToPos, fromPos: posToRotation, fmt: fmtRotationRpm,
      title: 'Full turns per minute, ±10 — left of centre is clockwise, right counter-clockwise, centre none. '
        + 'X and Y tumble the figure toward and across the camera, Z spins it in the picture plane. '
        + 'The numbers are NOMINAL: Speed above multiplies the actual rate, so at 0.5× a 2 rpm spin takes two '
        + 'minutes. Saved with the preset.',
    }));

    /*
     * v8 `33.3` — `Travel`, a triplet by `33.D7`.
     *
     * ⚠️ **FILED IMMEDIATELY AFTER `Rotation` IN `Framing & Timing` ON OWNER INSTRUCTION (2026-10-28),
     * after both this and `Sharpness` were confirmed BY USE.** It was built in `Curve Basis` beside
     * `Sharpness` on the specifier's argument that both change what the curve IS. The owner's filing is
     * the better one and the reason is legible in the pairing: `Rotation` is how the figure turns over
     * time and `Travel` is how it advances along an axis — a user reaching for one is reaching for the
     * other, and `Framing & Timing` is already *"how big and how fast"*. ⚠️ **`Sharpness` stayed**, so
     * `Curve Basis` is now a one-row section and its header tip was rewritten to stop promising two.
     *
     * ⚠️ **Routed through `tripletRow`, which `32.14` repaired**: the handler sets FIRST and then re-reads
     * `c.get()[axis]` into both the readout and the THUMB, so the dead zone this setter applies is one the
     * panel can actually show. Before that fix a snapping triplet setter snapped the engine and lied to
     * the user for a whole phase.
     */
    tgt.appendChild(this.tripletRow('Travel', {
      key: 'travel', min: -TRAVEL_MAX, max: TRAVEL_MAX, step: TRAVEL_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getTravel(),
      set: (axis, v) => { this.controls.setTravel(axis, v); this.syncVisibility(); },
      fmt: fmtTravel,
    }));
    /*
     * v8 `34.4` — `Stretch`, the breathing of `Travel`, **per axis (`34.D11`)**, filed immediately after it
     * so the shipped operator keeps its breathing beside it rather than across an unrelated row.
     */
    tgt.appendChild(this.tripletRow('Stretch', {
      key: 'travelDepth', min: -TRAVEL_DEPTH_MAX, max: TRAVEL_DEPTH_MAX, step: TRAVEL_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getTravelDepth(),
      set: (axis, v) => { this.controls.setTravelDepth(axis, v); this.syncVisibility(); },
      fmt: (d, axis) => fmtDepth(d, 'half-extent',
        Math.abs(this.controls.getTravel()[axis]) + Math.abs(d) > TRAVEL_MAX),
    }));
    tgt.appendChild(this.tripletRow('Stretch Rate', {
      key: 'travelRate', min: 0, max: 1, step: OP_RATE_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getTravelRate(),
      set: (axis, v) => this.controls.setTravelRate(axis, v),
      toPos: OP_RATE_TRACK.toPos, fromPos: OP_RATE_TRACK.fromPos, fmt: r => this.fmtOpRate(r),
    }));
    /*
     * v8 `34.2` — `Offset`, the DC translation, and `34.4`'s `Sway`.
     *
     * ⚠️ **`Offset` IS FRAMING, AND THE OWNER'S OWN 2026-10-28 REASONING DECIDES IT.** `Travel` was moved
     * out of `Curve Basis` into here because *"`Rotation` is how the figure turns over time and `Travel` is
     * how it advances along an axis — a user reaching for one is reaching for the other."* **Offset is
     * *where the figure sits*, which is the same question one step earlier — and it is the term the rotation
     * is taken ABOUT.** `Stretch` sits above it so `Travel` keeps its breathing adjacent.
     *
     * ⚠️ **The whole value of the operator is in the MOTION, not the position**: the engine rotates about
     * the model origin, so every figure in the library spins in place and an offset turns that spin into an
     * orbit. A still picture of an offset figure is a figure that is off-centre, which is why the tooltip has
     * to say what the control is FOR.
     */
    tgt.appendChild(this.tripletRow('Offset', {
      key: 'offset', min: -OFFSET_MAX, max: OFFSET_MAX, step: OFFSET_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getOffset(),
      set: (axis, v) => { this.controls.setOffset(axis, v); this.syncVisibility(); },
      fmt: fmtOffset,
    }));
    /*
     * v8 `34.D9` — **the Z depth warning, and it is the ONE inline string this phase adds.**
     *
     * ⚠️ **It is inline because it is a PRECONDITION, which is the single exception the house rule allows**
     * (`tipcheck` §A/§B assert that every `title` comes from `tooltips.ts` otherwise). ⚠️ **The text is set
     * ONCE and only `display` is toggled, never a ternary-assigned string**: `INLINE_SINK` matches a literal
     * after `=`, so ternary copy is invisible to the checker that polices this.
     *
     * ⚠️⚠️ **THE GATE IS THE OPERATOR'S OWN IDENTITY, because there is no perspective SWITCH to gate on.**
     * `34.D9` assumed invariant 25 would apply — *a control that explains the pipeline must be gated on every
     * early return upstream of it* — but the perspective divide runs unconditionally and `project()` answers
     * `CULL_SENTINEL` for `q <= 0` with no mode behind it. So the gate becomes *say nothing while `offsetZ`
     * and `travelZ` are both 0*, or the row prints a number about all 314 presets and becomes noise. **The
     * description owns the gate; the gate is now an identity rather than a mode.**
     *
     * ⚠️⚠️ **INVARIANT 27 IS THE LIVE TRAP: THE THRESHOLD IS CANVAS-DEPENDENT.** `perspectiveZ = -(cw+ch)/2`
     * and `waveScale = min(cw/designW, ch/designH)` are BOTH functions of the canvas, so the depth at which a
     * particle is dropped — expressed in model units — moves with the window. **A preset cannot compensate
     * for a canvas-dependent error**, so the sentence names the window rather than implying a safe value, and
     * the percentage is recomputed on every paint rather than cached. At 1440×900 on a 100×100 design box
     * the `MAX 20` clamp bites at −2.47 half-extents and the cull at −2.60, **so the hazard is reachable
     * inside the recommended range** — `offsetZ: -2` alone sits at 77 % of the cull depth.
     */
    const zNote = document.createElement('div');
    zNote.className = 'sl-vfx-note';
    zNote.style.cssText = 'margin:2px 0 0 4px;font-size:10px;color:#888;display:none;';
    this.zDepthNote = zNote;
    tgt.appendChild(zNote);
    tgt.appendChild(this.tripletRow('Sway', {
      key: 'offsetDepth', min: -OFFSET_DEPTH_MAX, max: OFFSET_DEPTH_MAX, step: OFFSET_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getOffsetDepth(),
      set: (axis, v) => { this.controls.setOffsetDepth(axis, v); this.syncVisibility(); },
      fmt: (d, axis) => fmtDepth(d, 'half-extent',
        Math.abs(this.controls.getOffset()[axis]) + Math.abs(d) > OFFSET_MAX),
    }));
    tgt.appendChild(this.tripletRow('Sway Rate', {
      key: 'offsetRate', min: 0, max: 1, step: OP_RATE_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getOffsetRate(),
      set: (axis, v) => this.controls.setOffsetRate(axis, v),
      toPos: OP_RATE_TRACK.toPos, fromPos: OP_RATE_TRACK.fromPos, fmt: r => this.fmtOpRate(r),
    }));

    /**
     * E30 — Symmetry Fold, 1–12, and its Mirror companion.
     *
     * A LINEAR track with `step: 1`, so no `toPos`/`fromPos` pair: the value IS the position, and there
     * are only twelve of them. It is deliberately an integer control — fold 4.5 is not a blend of a
     * 4-arm and a 5-arm rosette, it is a figure whose arms do not close, which is also why the Mixer
     * snaps this field rather than interpolating it.
     *
     * Lives in Framing because it changes the figure's SHAPE in model space, alongside Figure Scale
     * (its size) and before anything about how it is coloured or post-processed. The `set` handler calls
     * `syncVisibility()` because the Mirror checkbox is meaningless at fold 1.
     */

    /**
     * v8 `30.3` (`E136`) — Sample Bias, ±1, linear, identity 0.
     *
     * ⚠️ **IN `Framing & Timing` BY `30.D5`, AND THE PLACEMENT SURVIVED A CHANGE IN ITS REASON.** The
     * decision put it here because it was specified as a TIMING control; implementing it established that
     * the curve carries no per-element clock and the operator is a sample-DENSITY control instead. It stays
     * here anyway, on the better argument: this section owns what the figure IS — its size, its spin, its
     * symmetry — and where the figure carries its weight belongs with those rather than with the operators
     * that bend space. **Recorded because the decision and its reason no longer match.**
     *
     * ⚠️ **Signed linear track, so the value IS the position** — no `toPos`/`fromPos`, like Twist.
     */
    tgt = secBasis;
    tgt.appendChild(this.sectionTitle('Curve Basis', false));
    /*
     * v8 `33.2`, converted to a TRIPLET by `34.4` (`34.D11`) — `Sharpness`, **per wave LEVEL**.
     *
     * ⚠️ **A PLAIN LINEAR TRACK, 0..1, and no dead zone** — the control is one-sided, so
     * `DEAD_ZONE_FRACTION` has nothing to apply to and a snap would only make the bottom of the range
     * unreachable. `SHARPNESS_MAX` carries the derivation and the theorem.
     *
     * ⚠️ **THE CAPTIONS ARE `SLOT_LABELS`, NOT `['X','Y','Z']`, and that is the one place in this tab where
     * a triplet's three cells are not axes.** Levels, not axes: Body / Structure / Detail are wave SLOTS,
     * which is why this operator gains four keys where `Offset` and `Grow` gain nine.
     *
     * ⚠️ **`34.D12` is satisfied here for free, and that is worth recording rather than inferring.** The
     * refused rule — *hide a cell whose wave level is silent* — was only ever expressible on the Composer,
     * whose `FigureModel` carries `slots[t].silent`. **Visual FX has no slot model and no `silent` notion**,
     * so a per-level cell is unconditionally visible by construction: nothing to hide, nothing to collapse,
     * nothing to disable-with-reason. ⚠️ The COST still lands — 183 of 314 presets have no live Detail
     * slot-axis, so the third cell is inert on the majority of the library — and the tooltip is where that
     * is answered, in its PROPORTIONAL form only.
     */
    tgt.appendChild(this.tripletRow('Sharpness', {
      key: 'sharpnessLevels', min: 0, max: SHARPNESS_MAX, step: SHARPNESS_STEP,
      captions: [SLOT_LABELS[0], SLOT_LABELS[1], SLOT_LABELS[2]],
      get: () => this.controls.getSharpnessLevels(),
      set: (axis, v) => { this.controls.setSharpnessLevels(axis, v); this.syncVisibility(); },
      fmt: fmtSharpness,
      /*
       * v8 2026-10-31 (owner) — ⚠️⚠️ **A LEVEL WITH NO WAVE HAS NOTHING TO FACET, AND THE CELL USED TO SAY
       * OTHERWISE.** Reported on `Quader Square Spring`: no Detail slot, Detail cell operable. The answer
       * comes from `composer-model.ts`' own `silent` predicate through `getLiveWaveLevels()` — ONE owner
       * for *is this slot silent* (`size + pulse === 0`, never `FM.Base === 0`), because a second copy of
       * that rule here is exactly the kind of divergence `34.1` spent a step closing.
       */
      cellLive: () => this.controls.getLiveWaveLevels(),
      deadReason: 'This level has no wave on any axis, so there is no curve here to facet. '
        + 'Give the level size or pulse in the Composer to make it live; the value is kept.',
    }));
    /*
     * v8 `34.4` — `Temper`, the breathing of `Sharpness`. **ONE depth and ONE rate for all three levels**
     * (`34.D11`'s single asymmetry), so these are two `makeRow`s rather than two triplets.
     *
     * ⚠️ **THE SETTER TAKES THE PAIR**, so each row re-sends the other's live value. The generator holds one
     * depth and one rate, and a half-written pair would leave a rate describing a depth that is gone.
     *
     * ⚠️ **THE READOUT SAYS `(clipped)` AND THE DWELL THAT CAUSES IT IS A FEATURE** — see `fmtDepth` and
     * `SHARPNESS_DEPTH_MAX`. The clipped test reads all THREE levels, because one depth drives all three and
     * the swing can hit a bound on one level while clearing it on the others.
     */
    tgt.appendChild(this.makeRow('Temper', this.slider({
      key: 'sharpnessDepth', min: -SHARPNESS_DEPTH_MAX, max: SHARPNESS_DEPTH_MAX, step: SHARPNESS_STEP,
      get: () => this.controls.getSharpnessDepth(),
      set: v => this.controls.setSharpnessBreath(v, this.controls.getSharpnessRate()),
      fmt: d => fmtDepth(d, 'blend', this.controls.getSharpnessLevels()
        .some(L => L - Math.abs(d) < 0 || L + Math.abs(d) > SHARPNESS_MAX)),
    })));
    tgt.appendChild(this.makeRow('Temper Rate', this.slider({
      key: 'sharpnessRate', min: 0, max: 1, step: OP_RATE_STEP,
      get: () => this.controls.getSharpnessRate(),
      set: v => this.controls.setSharpnessBreath(this.controls.getSharpnessDepth(), v),
      toPos: OP_RATE_TRACK.toPos, fromPos: OP_RATE_TRACK.fromPos, fmt: r => this.fmtOpRate(r),
      wideLabel: true,
    })));
    /*
     * v8 `34.3` — `Grow` and `34.4`'s `Flare`, **in `Curve Basis` rather than in `Deformation`**.
     *
     * ⚠️ **That classification is the same one `Sharpness` and `Travel` carry and it is not a filing
     * convenience:** this is a GENERATOR term — it scales the wave sum by a function of the particle index —
     * not a map from position to position. `facetcheck` §B's `NOT_DEFORMATION.grow` records the decision and
     * records that it is the CLOSE CALL of the two, because `Grow` changes the silhouette materially.
     *
     * ⚠️⚠️ **THE STORED VALUE IS A RAMP COEFFICIENT AND `0` IS THE IDENTITY, NOT `1`.** The range is
     * ASYMMETRIC (`GROW_FLOOR` … `GROW_MAX` = −1 … +3), so there is **no dead zone** — a fraction of half
     * travel has no single half to apply to here — and the identity sits at 25 % of travel, which the 0.01
     * grid reaches exactly. `fmtGrow` never prints a bare multiplier at 0.
     */
    tgt.appendChild(this.tripletRow('Grow', {
      key: 'grow', min: GROW_FLOOR, max: GROW_MAX, step: GROW_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getGrow(),
      set: (axis, v) => this.controls.setGrow(axis, v),
      fmt: fmtGrow,
    }));
    tgt.appendChild(this.tripletRow('Flare', {
      key: 'growDepth', min: -GROW_DEPTH_MAX, max: GROW_DEPTH_MAX, step: GROW_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getGrowDepth(),
      set: (axis, v) => this.controls.setGrowDepth(axis, v),
      fmt: (d, axis) => fmtDepth(d, 'ramp', (() => {
        const b = this.controls.getGrow()[axis];
        return b + Math.abs(d) > GROW_MAX || b - Math.abs(d) < GROW_FLOOR;
      })()),
    }));
    tgt.appendChild(this.tripletRow('Flare Rate', {
      key: 'growRate', min: 0, max: 1, step: OP_RATE_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getGrowRate(),
      set: (axis, v) => this.controls.setGrowRate(axis, v),
      toPos: OP_RATE_TRACK.toPos, fromPos: OP_RATE_TRACK.fromPos, fmt: r => this.fmtOpRate(r),
    }));

    tgt = secDeform;
    // The collapsible head replaces the plain section title. ⚠️ `groupTitle` reads HEADER_TIPS exactly as
    // `sectionTitle` did, and `tipcheck` §C/§D matches both, so the tip stays enforced both ways.
    secDeform.appendChild(cDeform.wrap);
    tgt = cDeform.body;

    /**
     * v8 `30.1` (`E129a`) — Barr twist, three axes, one row.
     *
     * ⚠️ **A `tripletRow` matching `Rotation`, by `30.D6`, and the shared widget is the point** — three
     * sliders, one row, each writing only its own axis. It is NOT a tracked spec: the range is ±2 and
     * linear, so **the value IS the position** and there is no `toPos`/`fromPos` pair, exactly as
     * `symmetryFold`'s descriptor has none. That is what keeps the position/value convention out of this
     * control entirely.
     *
     * ⚠️ **The bounds come from `TWIST_MAX_TURNS`, shared with the generator's clamp rather than typed
     * twice** — a range `min` is cosmetic and a clamp is not.
     *
     * ⚠️ **It reads z, so on a planar figure it correctly does nothing** — 61 of 277 preset bodies have
     * zero z amplitude (measured 2026-10-22). **That PRECONDITION is carried in the tooltip text**, because
     * the alternative is a user concluding the control is broken on a figure where it is behaving exactly
     * as specified (invariant 13's harder shape).
     *
     * ⚠️ **NO `title` HERE: the factory falls back to `CONTROL_TIPS[key]`, which is the normal case and
     * what `tipcheck` asserts in both directions.** The copy lives in `tooltips.ts` under the key `twist`.
     */
    /*
     * ⚠️ **SYMMETRY MOVED HERE FROM `Framing & Timing` (owner, 2026-10-25) so the model-space operators
     * sit together.** It belongs: the E30 fold is a model-space point group applied in the same stage as
     * the twist and the box-fold, and it is the LAST of them — *symmetry is the outermost property*, so a
     * folded rosette keeps identically-deformed arms. Its old home grouped it with size and speed, which
     * are view and timing rather than shape.
     *
     * ⚠️ **It is placed FIRST in the section even though it runs LAST in the pipeline, and that is
     * deliberate**: it is the operator a user reaches for first and the one whose effect the others
     * compose inside. **The pipeline order is a contract fixed at the operator sites, not something a
     * panel's row order can imply** — see `lissajous.ts`'s stage header.
     */
    tgt.appendChild(this.makeRow('Symmetry', this.slider({
      key: 'symmetryFold', min: 1, max: 12, step: 1,
      get: () => this.controls.getSymmetryFold(),
      set: v => { this.controls.setSymmetryFold(v); this.syncVisibility(); },
      fmt: fmtSymmetryFold,
    })));
    this.symmetryMirrorRow = this.makeRow('Mirror', this.check({
      key: 'symmetryMirror',
      get: () => this.controls.getSymmetryMirror(),
      set: v => this.controls.setSymmetryMirror(v),
    }));
    tgt.appendChild(this.symmetryMirrorRow);

    tgt.appendChild(this.tripletRow('Twist', {
      key: 'twist', min: -TWIST_MAX_TURNS, max: TWIST_MAX_TURNS, step: TWIST_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getTwist(),
      set: (axis, v) => this.controls.setTwist(axis, v),
      fmt: fmtTwistTurns,
    }));

    /*
     * v8 `32.1`/`32.2` (`E129b`) — **BARR TAPER AND BEND, two `tripletRow`s matching `Twist` above.**
     *
     * ⚠️ **TRIPLETS BY `32.D4`, AGAINST THE SPECIFIER'S RECOMMENDATION, and the trade is recorded because
     * it is still live.** The proposal was one scalar plus a conditional axis row each, on the grounds
     * that bending about two axes at once is a different operator rather than a sum. The owner chose three
     * sliders each for consistency with the row above and to avoid two dropdowns. **The consequence is
     * arithmetic, not cosmetic**: six composing factors mean `det J` is a six-term product, so the clamp
     * is per-axis AND on the product — see `32.3` at the operator site.
     *
     * ⚠️ **NOT TRACKED SPECS: the range is linear and symmetric, so the value IS the position** and there
     * is no `toPos`/`fromPos` pair, exactly as `twist` and `symmetryFold` have none. **That keeps the
     * position/value convention out of these controls entirely.**
     *
     * ⚠️ **The bounds are the CLAMP constants, shared with the generator rather than typed twice** — a
     * range `min` is cosmetic and a clamp is not, and here the clamp is what stops the determinant
     * reaching zero.
     */
    tgt.appendChild(this.tripletRow('Taper', {
      key: 'taper', min: -TAPER_MAX, max: TAPER_MAX, step: TAPER_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getTaper(),
      set: (axis, v) => { this.controls.setTaper(axis, v); this.syncVisibility(); },
      fmt: fmtTaper,
    }));
    tgt.appendChild(this.tripletRow('Bend', {
      key: 'bend', min: -BEND_MAX_RATE, max: BEND_MAX_RATE, step: TAPER_STEP,
      captions: ['X', 'Y', 'Z'],
      get: () => this.controls.getBend(),
      set: (axis, v) => { this.controls.setBend(axis, v); this.syncVisibility(); },
      fmt: fmtBend,
    }));

    /**
     * v8 `30.2` (`E130`) — the box-fold, four rows with the iteration count as the gate.
     *
     * ⚠️ **`Fold` IS THE GATE AND IS THEREFORE ALWAYS VISIBLE; the other three are hidden at 0** through
     * `syncVisibility()`, the pattern `Mirror` uses at fold 1. **`display: none` stops a row being SEEN,
     * not working** — the values stay authored, stay exported and stay in the snapshot, which is why the
     * gate is on the ITERATION COUNT in the engine rather than on the row's visibility.
     *
     * ⚠️ **Integer track with `step: 1`, so the value IS the position** — no `toPos`/`fromPos` pair, the
     * same shape `symmetryFold` has, and for the same reason: there are five of them.
     */
    tgt.appendChild(this.makeRow('Fold', this.slider({
      key: 'boxFoldIterations', min: 0, max: BOX_FOLD_MAX_ITERATIONS, step: 1, decimals: 0,
      get: () => this.controls.getBoxFold().iterations,
      set: v => { this.controls.setBoxFoldIterations(v); this.syncVisibility(); },
      fmt: fmtFoldIterations,
    })));
    this.foldLimitRow = this.makeRow('Cell Size', this.slider({
      key: 'boxFoldLimit', min: BOX_FOLD_MIN_LIMIT, max: 1, step: BOX_FOLD_LIMIT_STEP, decimals: 2,
      get: () => this.controls.getBoxFold().limit,
      set: v => this.controls.setBoxFoldLimit(v),
      fmt: fmtFoldLimit,
    }));
    tgt.appendChild(this.foldLimitRow);
    this.foldScaleRow = this.makeRow('Fold Scale', this.slider({
      key: 'boxFoldScale', min: BOX_FOLD_MIN_SCALE, max: BOX_FOLD_MAX_SCALE, step: BOX_FOLD_LIMIT_STEP,
      decimals: 2,
      get: () => this.controls.getBoxFold().scale,
      set: v => this.controls.setBoxFoldScale(v),
      fmt: fmtFoldScale,
    }));
    tgt.appendChild(this.foldScaleRow);

    /*
     * v8 `32.7` (`E133`) — **THE 3D SPHERICAL INVERSION, placed here because it IS the spherical fold and
     * the box-fold above is its sibling.** Putting it elsewhere in the section would hide the one
     * relationship a reader needs: these two are alternative members of one family with opposite depth
     * behaviour, which is why `30.2` shipped and this one needed a measurement first.
     *
     * ⚠️⚠️ **THE INLINE NOTE IS A PRECONDITION IN INVARIANT 25's SENSE, NOT A CAPTION.** A control whose
     * effect is to change how THREE other subsystems read — depth shading, the Volume mode and Liquid's
     * occlusion — must say so where the eye lands. A tooltip is found only by someone who already
     * suspects the control, and the person who needs this sentence is the one who does not.
     *
     * ⚠️ **It also has to distinguish itself from `Inverse 1/z` in Translation Map, which is the SAME
     * FORMULA after the projection.** Two controls that look alike and differ only in where they act is
     * the hazard `CLAUDE.md` names for the three things called "liquid".
     */
    tgt.appendChild(this.makeRow('Inversion', this.slider({
      key: 'invertAmount', min: 0, max: 1, step: INVERT_STEP, decimals: 2,
      get: () => this.controls.getInversion().amount,
      set: v => {
        const cur = this.controls.getInversion();
        this.controls.setInversion(v, cur.radius);
        this.syncVisibility();
      },
      fmt: fmtInvertAmount,
    })));
    {
      // ⚠️ **One literal, set ONCE, `display` toggled** — `tipcheck`'s inline-copy scan matches a literal
      // after `.textContent =`, so a ternary assignment renders identically and is invisible to it.
      const note = document.createElement('p');
      // ⚠️ **`sl-tab-desc`, the class every other inline note in this tab uses** (Cohesion's, Liquid
      // Field's, Dye Field's) — not a new one. A second class for one appearance is a second owner of it,
      // and an unreferenced CSS name is worse: it looks styled and is not.
      note.className = 'sl-tab-desc';
      note.textContent = 'Turns the figure inside out in 3D — near becomes far, so depth shading, the '
        + 'Volume mode and Liquid\u2019s occlusion all read differently. Translation Map\u2019s '
        + 'Inverse 1/z is the same shape applied to the finished picture instead.';
      tgt.appendChild(note);
    }
    this.invertRadiusRow = this.makeRow('Sphere', this.slider({
      key: 'invertRadius', min: INVERT_RADIUS_MIN, max: INVERT_RADIUS_MAX, step: INVERT_STEP, decimals: 2,
      get: () => this.controls.getInversion().radius,
      set: v => {
        const cur = this.controls.getInversion();
        this.controls.setInversion(cur.amount, v);
      },
      fmt: fmtInvertRadius,
    }));
    tgt.appendChild(this.invertRadiusRow);

    /*
     * v8 `31.4` (`E132`) — the 4D rotation: one extent row that gates three angle rows.
     *
     * ⚠️ **`4D Extent` IS THE GATE AND THE THREE ANGLES ARE HIDDEN AT 0**, the box-fold's pattern: at
     * extent 0 the stage is skipped and all three angles are provably inert, so three rows that cannot
     * move anything would be three rows inviting the conclusion that the feature is broken.
     *
     * ⚠️ **ONLY THE THREE PLANES THAT INVOLVE THE FOURTH AXIS ARE HERE. `X-Y`, `X-Z` and `Y-Z` ARE THE
     * `Rotation` ROW IN `Framing & Timing`** — the same control, already on this tab, and offering it
     * twice is the trap `31.4`'s own step text names. The labels say which plane each one is so that
     * absence reads as deliberate rather than as an omission.
     */
    tgt.appendChild(this.makeRow('4D Extent', this.slider({
      key: 'wScale', min: 0, max: W_SCALE_MAX, step: W_STEP, decimals: 2,
      get: () => this.controls.getDeform4d().wScale,
      set: v => { this.controls.setWScale(v); this.syncVisibility(); },
      fmt: fmtWScale,
    })));
    this.wAngleRow = this.tripletRow('4D Spin', {
      key: 'wAngles', min: -0.5, max: 0.5, step: W_STEP,
      captions: ['X-W', 'Y-W', 'Z-W'],
      get: () => {
        const d = this.controls.getDeform4d();
        return [d.xw, d.yw, d.zw] as [number, number, number];
      },
      set: (axis, v) => {
        // The axis index is translated to a PLANE NAME at the one boundary that has an index at all —
        // the `tripletRow` widget, which is built around three positional sliders. Everything below this
        // line is keyed by name, so a reordered caption array cannot silently rotate the wrong plane.
        const plane = axis === 0 ? 'xw' : axis === 1 ? 'yw' : 'zw';
        this.controls.setWAngle(plane, v);
      },
      fmt: fmtWAngle,
    });
    tgt.appendChild(this.wAngleRow);
    this.wWindingRow = this.makeRow('4D Winding', this.slider({
      key: 'wWinding', min: 1, max: W_WINDING_MAX, step: 1, decimals: 0,
      get: () => this.controls.getDeform4d().winding,
      set: v => this.controls.setWWinding(v),
      fmt: fmtWWinding,
    }));
    tgt.appendChild(this.wWindingRow);

    // --- Ribbon section ---
    tgt = secRibbon;
    tgt.appendChild(this.sectionTitle('Ribbon Rendering'));
    tgt.appendChild(this.makeRow('Mode', this.select({
      key: 'ribbonMode',
      options: [['off', 'Off'], ['hybrid', 'Hybrid'], ['streaks', 'Streaks'], ['adaptive', 'Adaptive']],
      get: () => this.controls.getRibbonState(),
      set: v => {
        const mode = v as 'off' | RibbonMode;
        this.controls.setRibbonState(mode);
        // Ribbons and neon lines are mutually exclusive — both draw a trail per particle.
        if (mode !== 'off') {
          this.controls.setLinesEnabled(false);
          this.syncKey('linesEnabled');
        }
      },
    })));
    tgt.appendChild(this.makeRow('Width', this.slider({
      key: 'ribbonWidth', min: 0.5, max: 20, step: 0.5, decimals: 1,
      get: () => this.controls.getRibbonWidth(),
      set: v => this.controls.setRibbonWidth(v),
    }), 'Ribbon Width'));

    // --- Splat Shear section (27.6) ---
    // ⚠️ A DESCRIPTOR, never hand-wiring, and its own section rather than a row under Ribbon Rendering:
    // this governs the MATERIAL SPLAT quad, which is a different renderer from `ribbonMode`'s trail. Filing
    // it under Ribbon Rendering would put two unrelated features behind one word, which is the name trap
    // the value spellings below already avoid.
    tgt = secSplat;
    tgt.appendChild(this.sectionTitle('Splat Shear'));
    tgt.appendChild(this.makeRow('Cross-axis', this.select({
      key: 'splatShear',
      options: [['tangent', 'Follow path'], ['fixed', 'Flat nib']],
      get: () => this.controls.getSplatShear(),
      set: v => this.controls.setSplatShear(v),
    })));

    // --- Neon Lines section ---
    tgt = secNeon;
    tgt.appendChild(this.sectionTitle('Neon Lines'));
    tgt.appendChild(this.makeRow('Enable', this.check({
      key: 'linesEnabled',
      get: () => this.controls.getLinesEnabled(),
      set: on => {
        this.controls.setLinesEnabled(on);
        if (on) {
          this.controls.setRibbonState('off');
          this.syncKey('ribbonMode');
        }
        this.syncVisibility();
      },
    }), 'Enable Neon Lines'));
    secNeon.appendChild(this.neonBody);
    tgt = this.neonBody;
    tgt.appendChild(this.makeRow('Width', this.slider({
      key: 'lineWidth', min: 0.5, max: 10, step: 0.5, decimals: 1,
      get: () => this.controls.getLineWidth(),
      set: v => this.controls.setLineWidth(v),
    }), 'Neon Width'));

    // --- Film Look section ---
    tgt = secFilm;
    tgt.appendChild(this.sectionTitle('Film Look'));
    tgt.appendChild(this.makeRow('Look', this.select({
      key: 'filmLook',
      options: this.controls.getFilmLookNames().map(n => [n, n] as [string, string]),
      get: () => this.controls.getFilmLook(),
      set: v => {
        this.controls.setFilmLook(v);
        // Any named bundle re-seeds `customFilmLookParams` as a side effect, so the Customize sliders
        // have to be re-read even when the panel is being hidden.
        this.syncVisibility();
        this.syncGroup('cp.');
        // 21.4a — a named bundle carries a palette AND a mapping, so both are resolved anew here even though
        // neither palette control was touched. This is the two-source shape the section's header names.
        this.updatePaletteRows();
      },
    })));
    this.customizePanel = this.buildCustomizePanel();
    tgt.appendChild(this.customizePanel);

    // --- Colour Palette section (21.4a) — the per-preset override, downstream of the look it composes with ---
    tgt = secPalette;
    tgt.appendChild(this.buildPaletteSection());

    // --- Attractor section ---
    tgt = secAttractor;
    tgt.appendChild(this.sectionTitle('Attractor'));
    tgt.appendChild(this.makeRow('Preset', this.select({
      key: 'attractorIndex',
      options: [
        ['-1', 'Off'],
        ...this.controls.getAttractorPresetNames().map((name, i) => [String(i), name] as [string, string]),
      ],
      get: () => String(this.controls.getAttractorIndex()),
      set: v => this.controls.setAttractorIndex(parseInt(v, 10)),
    })));
    tgt.appendChild(this.makeRow('Blend', this.slider({
      key: 'attractorBlend', min: 0, max: 1, step: 0.05,
      get: () => this.controls.getAttractorBlend(),
      set: v => this.controls.setAttractorBlend(v),
    })));
    /*
     * ⚠️⚠️ **THE ATTRACTOR `Flow` ROW WAS REMOVED FROM THIS TAB ON 2026-11-01 (owner) AND THE ENGINE PATH
     * WAS DELIBERATELY KEPT.** The row offered `33.4`'s two escape-field flows — *Contours (around the
     * set)* and *Field lines (into the set)* — and the owner's verdict on the second was that it has no
     * visual case: **the field lines get swallowed at the boundary.** That is the same thing `33.22`
     * diagnosed as a replenishment defect (seeds respawning into cells with no inward path, and every
     * surviving ray ending in an exact two-point oscillation).
     *
     * **So `'contour'` is now the only flow a user can reach, and it was already the default** — an absent
     * `overlay.escapeFlow` has always meant contours, which is what every preset authored before `33.4`
     * gets.
     *
     * ⚠️ **`'ray'` IS STILL A LIVE TYPE MEMBER AND THE ENGINE STILL HONOURS IT (owner: UI-only removal).**
     * An imported preset or a hand-edited body that authors `escapeFlow: 'ray'` renders as rays, `main.ts`
     * still adopts it on load and still gates it into an export. **What is gone is the control, not the
     * capability** — so this is NOT the "removed entire" shape of `E121`/`E131`/`E136`/`E127`, and a reader
     * looking for the dropdown should find this paragraph rather than conclude it was lost.
     *
     * ⚠️ **No preset in the library authors it any more either**: the three that did (`Black Hole Rays`,
     * `Mandelbrot River Rays`, `Siegel Disk Rays`) were converted to contours and renamed in the same
     * sitting. So the ray path now ships REACHABLE AND DEMONSTRATED BY NOTHING, which is `shapecheck`
     * §G0b's lesson arriving in a second subsystem — recorded here because this file is where the control
     * was, and `33.22`'s diagnosis is the only other place that knows the path is defective.
     */
    // --- Curl Noise section ---
    /*
     * --- Per-Particle section (v8 `31.2`, `E112`/`E113`/`E137`) ---
     *
     * ⚠️ **ONE DRIVER ROW ABOVE THREE AMOUNT ROWS, AND THE ORDER IS THE CONTROL'S OWN GRAMMAR:** the
     * driver answers *which ordered quantity*, the amounts answer *how much of it reaches size, alpha and
     * lightness*. Reading them the other way round invites the amounts being read as three independent
     * features, which is exactly what `31.D4` decided against.
     *
     * ⚠️ **THE DRIVER ROW IS NOT GATED ON THE AMOUNTS, DELIBERATELY.** Hiding it while every amount is 0
     * would make the feature's own premise invisible at the one moment a user is looking for it.
     *
     * ⚠️ **`Lightness` IS FIRST AMONG THE THREE, AND THAT IS THE STUDY'S OWN FINDING RATHER THAN
     * ALPHABETICAL LUCK: lightness before hue.** Two independent methodologies agree that chromatic
     * variation is largely invisible at a particle's spatial scale while intensity reads well.
     */
    tgt = secPerParticle;
    tgt.appendChild(this.sectionTitle('Per-Particle'));
    tgt.appendChild(this.makeRow('Driver', this.select({
      key: 'channelDriver',
      // Built from the ONE enumeration, never a hand-typed subset — see CHANNEL_DRIVER_LABELS.
      options: CHANNEL_DRIVERS.map(d => [d, CHANNEL_DRIVER_LABELS[d]] as [string, string]),
      /*
       * v8 `33.5` — ⚠️ **`'escape'` IS HIDDEN UNLESS IT HAS DATA (`33.D17`, owner), *OR* IS THE STORED
       * VALUE — and that second clause is not a softening of the decision, it is what stops the hiding
       * from creating a worse defect.**
       *
       * Hiding on availability alone would mean: load a preset that stores `channelDriver: 'escape'`,
       * switch to an attractor without an escape field, and the dropdown shows a DIFFERENT driver from the
       * one the preset carries and the one Export will write. **The panel would be lying about the preset**
       * — which is invariant 13's harder form, the exact class this hiding was chosen to avoid.
       *
       * So: offered only where usable, but never concealed when selected. The generator independently
       * falls back to `index` for RENDERING on the same predicate, so an inert-but-selected `escape`
       * draws correctly and reads honestly.
       */
      dynamicOptions: () => CHANNEL_DRIVERS
        .filter(d => d !== 'escape'
          || this.controls.escapeFieldLive()
          || this.controls.getChannels().driver === 'escape')
        .map(d => [d, CHANNEL_DRIVER_LABELS[d]] as [string, string]),
      get: () => this.controls.getChannels().driver,
      // ⚠️ VALIDATED against the enumeration rather than cast. A cast here is the precise shape that let
      // the Time Warp handler map every unrecognised value to `field`.
      set: v => {
        const found = CHANNEL_DRIVERS.find(d => d === v);
        if (found) this.controls.setChannelDriver(found);
      },
    })));
    tgt.appendChild(this.makeRow('Lightness', this.slider({
      key: 'channelLight', min: -CHANNEL_MAX, max: CHANNEL_MAX, step: CHANNEL_STEP, decimals: 2,
      get: () => this.controls.getChannels().light,
      set: v => this.controls.setChannelLight(v),
      fmt: fmtChannelAmount,
    })));
    tgt.appendChild(this.makeRow('Size Spread', this.slider({
      key: 'channelSize', min: -CHANNEL_MAX, max: CHANNEL_MAX, step: CHANNEL_STEP, decimals: 2,
      get: () => this.controls.getChannels().size,
      set: v => this.controls.setChannelSize(v),
      fmt: fmtChannelAmount,
    })));
    tgt.appendChild(this.makeRow('Opacity Spread', this.slider({
      key: 'channelAlpha', min: -CHANNEL_MAX, max: CHANNEL_MAX, step: CHANNEL_STEP, decimals: 2,
      get: () => this.controls.getChannels().alpha,
      set: v => this.controls.setChannelAlpha(v),
      fmt: fmtChannelAmount,
    })));

    tgt = secCurl;
    tgt.appendChild(this.sectionTitle('Curl Noise'));
    tgt.appendChild(this.makeRow('Enable', this.check({
      key: 'curlEnabled',
      get: () => this.controls.getCurlEnabled(),
      set: on => { this.controls.setCurlEnabled(on); this.syncVisibility(); },
    }), 'Enable Curl Noise'));
    secCurl.appendChild(this.curlBody);
    tgt = this.curlBody;
    tgt.appendChild(this.makeRow('Turbulence', this.slider({
      key: 'curlTurbulence', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getCurlTurbulence(),
      set: v => this.controls.setCurlTurbulence(v),
    })));
    tgt.appendChild(this.makeRow('Scale', this.slider({
      key: 'curlScale', min: 0.1, max: 10, step: 0.1, decimals: 1,
      get: () => this.controls.getCurlScale(),
      set: v => this.controls.setCurlScale(v),
    })));
    tgt.appendChild(this.makeRow('Evol. Speed', this.slider({
      key: 'curlEvolutionSpeed', min: 0, max: 2, step: 0.05,
      get: () => this.controls.getCurlEvolutionSpeed(),
      set: v => this.controls.setCurlEvolutionSpeed(v),
    })));

    // --- Render Mode section ---
    tgt = secRenderMode;
    tgt.appendChild(this.sectionTitle('Render Mode'));
    tgt.appendChild(this.makeRow('Mode', this.select({
      key: 'renderMode',
      options: (Object.entries(RENDER_MODE_LABELS) as [RenderMode, string][])
        .filter(([m]) => !UNSELECTABLE_RENDER_MODES.has(m)),
      get: () => this.controls.getRenderMode(),
      set: v => {
        this.controls.setRenderMode(v as RenderMode);
        // The Volume Render section is gated on this. `setRenderMode` only notifies externally when the
        // renderer REFUSES the mode (ADR 010's 'star' fallback), so on success nothing else re-syncs and
        // picking Volume used to leave its own two controls hidden.
        this.syncVisibility();
        // Particle Size's readout carries a PIXEL estimate that depends on the mode, so a mode change moves
        // a number on a row whose own handle did not move — 3.0 to 5.0 to volume's splatRadius*1.5 is up to
        // a 13x jump. Without this the row keeps printing the previous mode's estimate until some other
        // event resyncs the tab, which is a readout describing a pass that is no longer running.
        this.syncKey('particleSize');
      },
    })));
    // Directly under Mode and ALWAYS VISIBLE, not inside Customize: the base size is a property of the
    // render mode (3.0 pixel/blend, 5.0 star, splatRadius*1.5 volume), so this is the row
    // that answers "why are volume's particles enormous" at the moment the user picks volume. Depth Size and
    // Depth DoF stay in Customize because they are film-look fields and shape a size this one sets.
    //
    // ⚠️ The readout appends the engine's own pixel estimate, so `fmt` is built here rather than being the
    // shared `fmtParticleSize`: the estimate is state the formatter has to READ, which no pure formatter can.
    tgt.appendChild(this.makeRow('Particle Size', this.slider({
      key: 'particleSize',
      min: 0,
      max: 1,
      step: PARTICLE_SIZE_STEP,
      toPos: PARTICLE_SIZE_TRACK.toPos,
      fromPos: PARTICLE_SIZE_TRACK.fromPos,
      wideLabel: true,
      // The estimate is read at FORMAT time, not captured: the mode can change under this row without the
      // slider moving, and `syncFromControls` re-formats every control on a preset change.
      fmt: (v: number) => `${fmtParticleSize(v)} (~${Math.round(this.controls.getParticlePixelEstimate())} px)`,
      get: () => this.controls.getParticleSize(),
      set: v => { this.controls.setParticleSize(v); },
      settleOnRelease: true,
    })));
    /*
     * Trail Decay — added 2026-09-04 alongside the material presentation blocks.
     *
     * ⚠️ **IN `Render Mode` AND NOT IN `Framing & Timing`, WHICH IS WHERE ITS NAME SUGGESTS IT BELONGS.** The
     * fade pass this controls is what MAKES a trail, and every neighbouring question ("how big is a particle",
     * "which mode draws it") is answered here; `Framing & Timing` is about the figure, not its residue. It sits
     * under Particle Size because the two together decide how much light a revisited pixel accumulates, which
     * is the pairing the additive-material cap exists to bound.
     *
     * ⚠️ **NO `show()` GATE, deliberately** — the fade pass runs in all seven render modes, so a gate would be
     * wrong on the facts. Its two OVERRIDES are the interesting part and they live in the tooltip: an additive
     * material caps it (`materialTrailDecayCap()`) and TransMap style 6 replaces it with `persist`. Both are
     * cases where the live trail is SHORTER or different than this handle reads — invariant 25's shape, which is
     * why the condition is named on the control rather than left for the user to discover.
     */
    tgt.appendChild(this.makeRow('Trail Decay', this.slider({
      key: 'decayFactor',
      min: 0, max: MAX_TRAIL_DECAY, step: TRAIL_DECAY_STEP, decimals: 3,
      get: () => this.controls.getDecayFactor(),
      set: v => { this.controls.setDecayFactor(v); },
    })));
    // Directly under the Mode dropdown it gates on — see `buildLiquidSection`'s own comment for why the
    // position is load-bearing rather than cosmetic.
    tgt = secLiquidSurface;
    tgt.appendChild(this.buildLiquidSection());
    // v8 15.4 — below Liquid Surface but OUTSIDE it, and with no `show()` entry: cohesion moves the particles
    // themselves, so it is live in all seven modes. See `buildCohesionSection`.
    tgt = secCohesion;
    tgt.appendChild(this.buildCohesionSection());
    // v8 15.5 — below Cohesion and also with no `show()` entry, for one step further than cohesion's reason:
    // the pool's particles are published into `positions` and drawn by whichever renderer is live, so a
    // stirred `star`-mode figure is a legitimate authored look. See `buildLiquidFieldSection`.
    tgt = secLiquidField;
    tgt.appendChild(this.buildLiquidFieldSection());
    // v8 15.7 — below Liquid Field and also ungated, for a reason that is NOT cohesion's or the pool's: the
    // dye field runs in every mode (it injects and advects regardless), but it is only ever SEEN through
    // `Tint Source = Dye` on the liquid surface. So the gate is a Tint Source value in the section eight rows
    // above, not the render mode — too far away for gate-adjacency to be available, which is why the
    // precondition is carried INLINE instead. See `buildDyeSection`.
    tgt = secDye;
    tgt.appendChild(this.buildDyeSection());

    // --- TransMap section ---
    tgt = secTransMap;
    tgt.appendChild(this.sectionTitle('Translation Map'));
    tgt.appendChild(this.makeRow('Enable', this.check({
      key: 'transMapEnabled',
      get: () => this.controls.getTransMapEnabled(),
      set: on => { this.controls.setTransMapEnabled(on); this.syncVisibility(); },
    }), 'Enable Translation Map'));
    // The one-layer view: a plain Style dropdown, exactly as before. Hidden (not removed) once a second
    // layer exists, because a chain has no single style for it to show.
    this.styleRow = this.makeRow('Style', this.select({
      key: 'transMapStyle',
      // ⚠️ **DERIVED from `TRANS_MAP_STYLES`, never hand-listed.** This was a literal seven-entry array and
      // was the SECOND of the three enumerations Step 14.0 collapsed: a style added to the type, the names
      // record and the add-layer menu but not here would be reachable as a chained layer and absent from
      // the dropdown every single-layer preset actually uses.
      options: TRANS_MAP_STYLES.map(m => [String(m.style), m.name] as [string, string]),
      get: () => String(this.controls.getTransMapStyle()),
      set: v => {
        this.controls.setTransMapStyle(parseInt(v, 10) as TransMapStyle);
        this.rebuildLayerRows();
        this.syncVisibility();
      },
    }));
    tgt.appendChild(this.styleRow);

    // ⚠️ Created BEFORE `buildLayerPanel()`, which ends in `rebuildLayerRows()` — and that reads
    // `flatPanelSlot` to park the shared panels. With the slot still null the parking step silently does
    // nothing; harmless on the first pass (the panels do not exist yet either) but an order dependency with
    // no guard, and `render()` is one edit away from being called twice. Appended below, so the DOM order
    // the flat layout wants is unchanged.
    this.flatPanelSlot = document.createElement('div');

    // Chain Mix ABOVE the layer list (design §3.2): it is the master multiplier every layer weight feeds
    // into, so it reads as the heading for the list rather than a footnote after it.
    tgt.appendChild(this.makeRow('Chain Mix', this.slider({
      // ⚠️ KEY UNCHANGED — only the label moved from 'Warp Mix'. `transMapWarpMix` is the serialised
      // overlay field, is read by the preview grid and `interpolate.ts`, and appears in a preset literal;
      // seven of the eight checkers are text-pattern greps over these names.
      key: 'transMapWarpMix', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getTransMapWarpMix(),
      set: v => this.controls.setTransMapWarpMix(v),
    })));

    // Beside Chain Mix because it is the same KIND of control — a global modifier on the summed warp, not a
    // per-style setting. It was a Fluid Feedback slider until 2026-08-20; that panel's copy is gone, because
    // two handles writing one uniform is how a control comes to disagree with the engine (invariant 13).
    tgt.appendChild(this.makeRow('Dispersion', this.slider({
      key: 'transMapDispersion', min: 0, max: 0.5, step: 0.01,
      get: () => this.controls.getTransMapDispersion(),
      set: v => this.controls.setTransMapDispersion(v),
      title: 'Chromatic fringing along the warp direction — red and blue are sampled ahead of and behind '
        + 'green. Scales with the LOCAL offset, so it shows up wherever the chain actually displaces the '
        + 'image and does nothing where the warp is zero (including with TransMap off, or at Chain Mix 0). '
        + 'Applies to every style, not just Fluid Feedback.',
    })));

    // v8 Step 14.6 — beside Chain Mix and Dispersion for the same reason they are beside each other: it is a
    // property of the whole chain (WHEN the one warp pass runs), not of any layer, so it never moves into a
    // layer row. A checkbox rather than a two-item dropdown because the states are not two named modes — it
    // is one boolean about pass order, and the label says which way `on` means.
    tgt.appendChild(this.makeRow('Warp First', this.check({
      key: 'transMapBeforeParticles',
      get: () => this.controls.getTransMapBeforeParticles(),
      set: on => this.controls.setTransMapBeforeParticles(on),
    })));

    this.layerPanel = this.buildLayerPanel();
    tgt.appendChild(this.layerPanel);

    // The three per-style panels are built ONCE here and then MOVED between this slot and a layer row by
    // `syncVisibility()` (`appendChild` moves a node rather than copying it, which is what keeps their
    // descriptor keys — `flow.*`, `fluidFeedback.*` — registered and their handles valid; rebuilding them
    // would orphan every entry in `controlList` and `syncKey()` would then throw, D17). The slot exists so
    // "move it back to the flat layout" has a position to name that is not "the end of the tab".
    tgt.appendChild(this.flatPanelSlot);

    this.ifsPanel = this.buildIfsPanel();
    this.flatPanelSlot.appendChild(this.ifsPanel);

    this.proceduralFlowPanel = this.buildProceduralFlowPanel();
    this.flatPanelSlot.appendChild(this.proceduralFlowPanel);

    this.fluidFeedbackPanel = this.buildFluidFeedbackPanel();
    this.flatPanelSlot.appendChild(this.fluidFeedbackPanel);

    // Stays OUTSIDE the slot and below it: the Force Field is a property of the whole chain (one readback,
    // one `applyForces` over all particles), not of any single layer, so it is never moved into a row.
    this.forceFieldSection = this.buildForceFieldSection();
    tgt.appendChild(this.forceFieldSection);

    // --- Physarum Network section ---
    tgt = secPhysarum;
    tgt.appendChild(this.sectionTitle('Physarum Network'));
    tgt.appendChild(this.makeRow('Blend', this.slider({
      key: 'physarum.blend', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getPhysarumConfig().blend,
      set: v => this.controls.setPhysarumBlend(v),
    })));
    secPhysarum.appendChild(this.physarumBody);
    tgt = this.physarumBody;
    tgt.appendChild(this.makeRow('Sensor Angle', this.slider({
      key: 'physarum.sensorAngle', min: 5, max: 90, step: 1, decimals: 0,
      get: () => this.controls.getPhysarumConfig().sensorAngle,
      set: v => this.controls.setPhysarumSensorAngle(v),
    })));
    tgt.appendChild(this.makeRow('Sensor Dist', this.slider({
      key: 'physarum.sensorDistance', min: 5, max: 50, step: 1, decimals: 0,
      get: () => this.controls.getPhysarumConfig().sensorDistance,
      set: v => this.controls.setPhysarumSensorDistance(v),
    })));
    tgt.appendChild(this.makeRow('Turn Speed', this.slider({
      key: 'physarum.turnSpeed', min: 5, max: 90, step: 1, decimals: 0,
      get: () => this.controls.getPhysarumConfig().turnSpeed,
      set: v => this.controls.setPhysarumTurnSpeed(v),
    })));
    tgt.appendChild(this.makeRow('Decay Rate', this.slider({
      key: 'physarum.decayRate', min: 0.01, max: 0.5, step: 0.01,
      get: () => this.controls.getPhysarumConfig().decayRate,
      set: v => this.controls.setPhysarumDecayRate(v),
    })));
    tgt.appendChild(this.makeRow('Deposit', this.slider({
      key: 'physarum.depositAmount', min: 0.01, max: 1, step: 0.01,
      get: () => this.controls.getPhysarumConfig().depositAmount,
      set: v => this.controls.setPhysarumDepositAmount(v),
    })));
    tgt.appendChild(this.makeRow('Show Trail', this.check({
      key: 'physarum.showTrail',
      get: () => this.controls.getPhysarumConfig().showTrail,
      set: on => this.controls.setPhysarumShowTrail(on),
    })));
    tgt.appendChild(this.makeRow('Trail Opacity', this.slider({
      key: 'physarum.trailOpacity', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getPhysarumConfig().trailOpacity,
      set: v => this.controls.setPhysarumTrailOpacity(v),
    })));
    // v8 Step 9.3 — the trail overlay's colour vocabulary. Same `getAllPaletteNames()` source as the
    // Colour/Palette dropdown further down, so the two lists cannot drift; the two extra entries are
    // parenthesised because a bare name would be ambiguous against a palette (and `getPaletteLUT` matches
    // cosine names case-INSENSITIVELY, so `Preset`/`preset` would both be candidates).
    //
    // ⚠️ **Only the Trail Opacity precondition is shared, not restated: this row needs `Show Trail` ON and
    // `Blend > 0` like every row above it.** The tooltip carries that; per `CLAUDE.md`'s tooltip rule a
    // PRECONDITION is the one thing that may stay inline, and here it is the section's, not this row's.
    tgt.appendChild(this.makeRow('Trail Colour', this.select({
      key: 'physarum.trailColour',
      options: [
        [PHYSARUM_TRAIL_COLOUR_PRESET, 'Preset (orange)'],
        [PHYSARUM_TRAIL_COLOUR_AUTO, 'Auto (film look → material)'],
        ...getAllPaletteNames(),
      ],
      get: () => this.controls.getPhysarumConfig().trailColour ?? PHYSARUM_TRAIL_COLOUR_PRESET,
      set: v => this.controls.setPhysarumTrailColour(v),
    })));

    // --- Fluid Advection section ---
    tgt = secFluid;
    tgt.appendChild(this.sectionTitle('Fluid Advection'));
    tgt.appendChild(this.makeRow('Blend (γ)', this.slider({
      key: 'fluid.blend', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getFluidAdvectionConfig().blend,
      set: v => this.controls.setFluidBlend(v),
    })));
    tgt.appendChild(this.makeRow('Return (k)', this.slider({
      key: 'fluid.returnForce', min: 0, max: 5, step: 0.1,
      get: () => this.controls.getFluidAdvectionConfig().returnForce,
      set: v => this.controls.setFluidReturnForce(v),
    })));

    // A DYE FIELD section used to live here — Enable / Decay / Opacity / Colour Src, gated on
    // `fluidAdvection.blend > 0`. Deleted 2026-08-12 (triage G14) along with the whole subsystem in
    // `fluid-advection.ts`: the three draw passes had zero callers, so every one of these four controls
    // wrote a config nothing read, and Enable allocated 13 GL objects to draw nothing.
    // ⚠️ **REBUILT 2026-09-03 as v8 Step 15.7, and NOT here** — the section is `buildDyeSection()`, appended
    // beside the other liquid sections, and its owner is `post-processors/dye-field.ts` rather than
    // `fluid-advection.ts`. It is not gated on `fluidAdvection.blend` any more either: the dye reads the
    // velocity field's TEXTURE directly and needs no CPU readback, so the two subsystems no longer share a gate.

    // --- Volume Render section (visible when render mode is 'volume') ---
    const volumeSection = document.createElement('div');
    volumeSection.style.marginTop = '12px';
    // Through `sectionTitle` rather than hand-built, so it gets its `HEADER_TIPS` entry like the other ten —
    // `spaced: false` because the section wrapper already carries the top margin. `tipcheck` §D caught this
    // one: a hand-built header is invisible to the header scan, which is the same hand-wiring the tab's own
    // doc comment warns about.
    volumeSection.appendChild(this.sectionTitle('Volume Render', false));
    volumeSection.appendChild(this.makeRow('Extinction', this.slider({
      key: 'volume.extinction', min: 0.1, max: 10, step: 0.1, decimals: 1,
      get: () => this.controls.getVolumeConfig().extinction,
      set: v => this.controls.setVolumeConfig({ ...this.controls.getVolumeConfig(), extinction: v }),
    })));
    volumeSection.appendChild(this.makeRow('Density Scale', this.slider({
      key: 'volume.densityScale', min: 0.1, max: 5, step: 0.1,
      get: () => this.controls.getVolumeConfig().densityScale,
      set: v => this.controls.setVolumeConfig({ ...this.controls.getVolumeConfig(), densityScale: v }),
    })));
    secVolume.appendChild(volumeSection);
    this.volumeSection = volumeSection;

    this.syncFromControls();
    /*
     * v8 `31.U` — **THE ASSEMBLY. This is the single place the tab's order is decided**, and it is the
     * owner's ordering (2026-10-25): Figure, Particles, Colour, Image, Fields — **Fields last because it
     * is the least used.**
     *
     * ⚠️ **Within `Particles`, `Render Mode` comes FIRST because it governs the rest**: `Splat Shear`
     * reaches only the `splat` mark, and `Volume Render` and `Liquid Surface` are each one mode's own
     * settings and are already hidden unless that mode is live.
     *
     * ⚠️⚠️ **`Dye Field` IS FILED UNDER `Fields`, AND THE MEASUREMENT OVERRODE THE TAXONOMY.** It is
     * genuinely two things: a simulation like the five around it, and the only colour source exempt from
     * Colour Mix — and **mechanically it belongs with Colour, because its output channel is COLOUR where
     * every other field's is a positional nudge.** But the dimension that matters for a COLLAPSING panel
     * is how often a thing is on, and measured over the 292-preset library the dye is enabled in **9
     * (3.1 %)** against `Film Look`'s **288 (98.6 %)** and the palette's **123 (42.1 %)** — while its
     * Fields neighbours run 0.7-2.4 %. **Filing a mostly-off 12-row subsystem beside the two things
     * nearly every preset uses is the clutter this change exists to remove.**
     *
     * ⚠️ **Placed immediately after `Liquid Field` rather than last**, because that is the neighbour it
     * actually couples to: the dye is advected by the same velocity field and its wake is its own pass.
     */
    /*
     * v8 `33.2`/`33.3` — ⚠️ **`Curve Basis` SITS BETWEEN `Framing & Timing` AND `Deformation`, AND THE
     * ORDER IS THE ARGUMENT.** These two controls change what the curve IS; the deformers below change
     * where an already-built curve's points go. Filing them inside `Deformation` would have been the
     * convenient choice and it would have been wrong in a way the filter can see: `facetcheck` §B's
     * family scan asks whether each `shape`-group key is a deformation, and both answer no.
     *
     * ⚠️ **The manual's §6.2 mirrors this order**, so adding a section here is a TWO-file edit.
     */
    gFigure.body.append(secFraming, secBasis, secDeform, secAttractor);
    gParticles.body.append(secRenderMode, secVolume, secLiquidSurface, secPerParticle,
      secSplat, secRibbon, secNeon);
    gColour.body.append(secFilm, secPalette);
    gImage.body.append(secTransMap);
    gFields.body.append(secCohesion, secLiquidField, secDye, secFluid, secCurl, secPhysarum);
    el.append(gFigure.wrap, gParticles.wrap, gColour.wrap, gImage.wrap, gFields.wrap);

  }

  /**
   * The Liquid Surface controls, built into their own container so `syncVisibility()` can show the whole
   * group at once.
   *
   * ⚠️ **IT SITS DIRECTLY UNDER Render Mode, NOT AT THE END OF THE TAB, AND THE POSITION IS THE FEATURE.**
   * Built last (after the eleven other sections) it landed below Fluid Advection, i.e. below the fold at any
   * ordinary panel height — so picking `Liquid` appeared to add no controls at all, and the first report was
   * *"the Liquid Surface controls are not there"*. Volume Render has the same shape and got away with it only
   * because no preset selects `volume`. **A section gated on a control must be adjacent to that control**, or
   * the gate reads as an absent feature. The section is HIDDEN rather than disabled: greyed-out rows would
   * leave a permanent five-row gap high in the list for the 6 of 7 modes that cannot use them.
   *
   * ⚠️ **A MATERIAL IS PERMITTED HERE AND IS NOT THE SPLAT PATH.** Liquid ignores `coreBrightness`,
   * `haloStrength` and `velocityStretch` (it draws no sprites of its own), but Tint Source `Material Ramp`
   * reads the live material's `colourRamp` — so choosing `LiquidLight` does change this mode's colour. The
   * tooltip says so, because "material controls do nothing in liquid" would be the natural and wrong
   * conclusion from the mode's own name.
   */
  private buildLiquidSection(): HTMLElement {
    const liquidSection = document.createElement('div');
    liquidSection.style.marginTop = '12px';
    liquidSection.appendChild(this.sectionTitle('Liquid Surface', false));

    /*
     * ⚠️ **THE COUNTERPART TO HIDING THREE ROWS ON `Tint Source` (2026-10-16): a vanishing row is its own
     * small confusion, and this is where the engine answers that** — CLAUDE.md's tooltip rule is that *a
     * precondition stays inline*, and the Dye Field section below already carries one for the same reason.
     *
     * ⚠️ **IT IS A STATIC LITERAL, NEVER A TERNARY ON `tintSource`.** `tipcheck`'s `INLINE_SINK` matches a
     * string literal after `=`, so copy assigned through a conditional is INVISIBLE to the scan that holds
     * this text to two sentences and 420 characters — the documented way to lose inline copy to the checker.
     * The rule in this file is: set the text once and toggle `display`. Here nothing is toggled at all,
     * because the note describes the whole section rather than one configuration of it.
     *
     * ⚠️ **It could NOT go in `Tint Source`'s tooltip: that entry is at 586 of `tipcheck` §G's 600-char
     * ceiling**, so adding a clause there means rewriting a working tooltip rather than extending it.
     * Measured, not assumed — and the same squeeze the `Dye Colour` tooltip hit when `Palette` was added.
     */
    const liquidNote = document.createElement('p');
    liquidNote.className = 'sl-tab-desc';
    liquidNote.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    liquidNote.textContent = 'Tint Source decides where the body’s colour comes from, and the rows below it '
      + 'change with that choice. Under Dye the figure takes Surface Ramp wherever the dye is thin and the '
      + 'dye’s own colour elsewhere, so Figure Colour and Mix Model are absent — that source reads neither.';
    liquidSection.appendChild(liquidNote);
    liquidSection.appendChild(this.makeRow('Iso Level', this.slider({
      key: 'liquid.isoLevel',
      // ⚠️ **POSITIONS, not the value constants.** The element's domain for a tracked control is
      // the POSITION domain; `ISO_LEVEL_MIN`/`ISO_LEVEL_MAX` reach it through the track's own
      // `toPos`/`fromPos`, which `trackcheck` §H already asserts span exactly `0..1`. Passing the
      // value constants here is what made this slider's travel mostly dead.
      min: 0, max: 1, step: ISO_LEVEL_STEP,
      toPos: ISO_LEVEL_TRACK.toPos, fromPos: ISO_LEVEL_TRACK.fromPos, fmt: fmtIsoLevel,
      get: () => this.controls.getLiquidConfig().isoLevel,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), isoLevel: v }),
    })));
    liquidSection.appendChild(this.makeRow('Kernel Width', this.slider({
      key: 'liquid.kernelWidth',
      // ⚠️ **POSITIONS, not the value constants.** The element's domain for a tracked control is
      // the POSITION domain; `KERNEL_WIDTH_MIN`/`KERNEL_WIDTH_MAX` reach it through the track's own
      // `toPos`/`fromPos`, which `trackcheck` §H already asserts span exactly `0..1`. Passing the
      // value constants here is what made this slider's travel mostly dead.
      min: 0, max: 1, step: KERNEL_WIDTH_STEP,
      toPos: KERNEL_WIDTH_TRACK.toPos, fromPos: KERNEL_WIDTH_TRACK.fromPos, fmt: fmtKernelWidth,
      get: () => this.controls.getLiquidConfig().kernelWidth,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), kernelWidth: v }),
    })));
    liquidSection.appendChild(this.makeRow('Edge Softness', this.slider({
      key: 'liquid.edgeSoftness', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getLiquidConfig().edgeSoftness,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), edgeSoftness: v }),
    })));
    liquidSection.appendChild(this.makeRow('Tint Source', this.select({
      key: 'liquid.tintSource',
      // v8 15.7 — `Dye` is the FIFTH entry and last in the list, which is where its precondition puts it: it
      // is the only source that can be UNAVAILABLE (the dye field off, or its float target refused), and it
      // then degrades to `Ramp` exactly as `Material Ramp` does. The tooltip says so; the Dye Field section
      // below carries the rest.
      options: [
        ['preset', 'Preset'],
        ['palette', 'Palette'],
        ['material', 'Material Ramp'],
        ['ramp', 'Ramp'],
        ['dye', 'Dye'],
      ],
      get: () => this.controls.getLiquidConfig().tintSource,
      set: v => {
        this.controls.setLiquidConfig({
          ...this.controls.getLiquidConfig(),
          tintSource: v as LiquidTintSource,
        });
        // Surface Ramp is gated on this value, and nothing else re-syncs after a select's own `change` —
        // the same omission that left Volume's controls hidden when Volume was picked (see `setRenderMode`).
        this.syncVisibility();
      },
    })));
    // A NAMED RAMP rather than a colour picker, and that was a decision rather than a shortcut: there is no
    // colour-input primitive anywhere in `src/` (measured: zero `type = 'color'` sites), the engine's
    // established idiom for an authorable colour is a ramp name (`crystalRamp`), and a ramp gives a
    // density-indexed GRADIENT — thin rim, thick core — where a flat fill would give one colour.
    const rampRow = this.makeRow('Surface Ramp', this.select({
      key: 'liquid.surfaceRamp',
      options: [
        ['liquid', 'Liquid'],
        ['ice', 'Ice'],
        ['fire', 'Fire'],
        ['organic', 'Organic'],
        ['smoke', 'Smoke'],
        ['fire-phase', 'Fire Phase'],
        ['fire-smoke', 'Fire Smoke'],
      ],
      get: () => this.controls.getLiquidConfig().surfaceRamp,
      set: v => this.controls.setLiquidConfig({
        ...this.controls.getLiquidConfig(),
        surfaceRamp: v as ColourRampName,
      }),
    }));
    liquidSection.appendChild(rampRow);
    this.liquidRampRow = rampRow;
    // v8 Step 15.2 — BELOW Surface Ramp, not above it: Surface Ramp is gated on Tint Source and has to stay
    // adjacent to the control that gates it, which is the same adjacency rule this section's own position
    // records. These two are ungated and apply to all four Tint Sources, so they read as a refinement OF the
    // colour block rather than as a second, competing source.
    // ⚠️ **v8 15.9a (2026-09-04): the LABEL is `Figure Colour`, the KEY is still `liquid.colourMix`.**
    // The rename is copy-only — no shader, preset, export or migration change — and the reason it was
    // worth doing is the "direction finding": at the shipped 0.85 default the DOMINANT 85 % of the
    // surface colour comes from the figure's own particle colours, which are not a control at all,
    // while `Tint Source` — the row that reads primary — contributes the remaining 15 %. `Colour Mix`
    // named the operation and left the dominant operand unnamed, so the UI read inverted. **Do not
    // "fix" the key to match: `colourMix` is in every export, the Mixer and `fieldcheck` §O, and a
    // label is not a key** (CLAUDE.md's preset-identity row — a name is a primary key in five owners,
    // and this is not one of them).
    /*
     * ⚠️ **BOTH ROWS ARE CAPTURED AND HIDDEN UNDER `Tint Source = Dye` (2026-10-16), BECAUSE UNDER THAT
     * SOURCE NEITHER IS READ AT ALL.** The surface shader resolves
     * `mixAmt = (uTintSource == 4) ? 0.0 : uColourMix`, so `mix(tint, mixed, 0.0)` is `tint` EXACTLY — an
     * algebraic identity. That discards `uColourMix` and, with it, `mixed`, which is the only thing
     * `uMixModel` feeds. **Two visible controls, zero reach.**
     *
     * ⚠️ **HIDDEN, NOT GREYED, AND THE REASON IS ALREADY WRITTEN DOWN TWICE IN `syncVisibility()`** — at
     * `liquidRampRow` (*"a greyed row would imply it still applies"*) and at `dyeFixedColourRow`. This tab's
     * rule is: a control the active configuration does not READ is hidden. The Sliders tab's opposite
     * convention — disable and print a reason line — is for a row that is live under two different laws and
     * has to say which; that is not this case. **Do not convert these to greyed rows**, and do not rename
     * either control: both names are correct for the other four tint sources, where `Figure Colour` really
     * is the figure-versus-per-particle-mean blend.
     *
     * ⚠️ **The STORED values are untouched by hiding**, so `colourMix`/`mixModel` keep exporting,
     * interpolating in the Mixer and satisfying `fieldcheck` §O exactly as before — the same property
     * `Surface Ramp` has had since 15.1. Hiding a row is a statement about reach, never about the format.
     */
    const colourMixRow = this.makeRow('Figure Colour', this.slider({
      key: 'liquid.colourMix', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getLiquidConfig().colourMix,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), colourMix: v }),
    }));
    liquidSection.appendChild(colourMixRow);
    this.liquidColourMixRow = colourMixRow;
    const mixModelRow = this.makeRow('Mix Model', this.select({
      key: 'liquid.mixModel',
      options: [
        ['light', 'Light'],
        ['pigment', 'Pigment'],
      ],
      get: () => this.controls.getLiquidConfig().mixModel,
      set: v => this.controls.setLiquidConfig({
        ...this.controls.getLiquidConfig(),
        mixModel: v as LiquidColourMixModel,
      }),
    }));
    liquidSection.appendChild(mixModelRow);
    this.liquidMixModelRow = mixModelRow;
    /*
     * v8 Step 15.3 — the surface MATERIAL, below the colour block because it operates ON whatever colour the
     * block above resolved (dispersion, scatter and absorption all read `tint`), so the panel's order is the
     * shader's order.
     *
     * ⚠️ **The ranges are CRYSTAL'S, taken from `CrystalRenderConfig` rather than from the step's own spec** —
     * the step instructs "use the crystal section's names and ranges verbatim", and the spec text then
     * contradicted itself by writing Specular as 0–3 where crystal's `specularStrength` is **0–4**. Crystal
     * wins: the point of sharing a vocabulary is that a value means the same in both sections, and a narrower
     * duplicate of one control is exactly the drift the instruction exists to prevent.
     *
     * Linear tracks, unlike Iso Level and Kernel Width: these four are magnitudes whose neutral value is 0,
     * and 0 is unreachable on a geometric track (`Slider tracks` — the octave rule constrains the range).
     */
    liquidSection.appendChild(this.makeRow('Refraction', this.slider({
      key: 'liquid.refraction', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getLiquidConfig().refraction,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), refraction: v }),
    })));
    liquidSection.appendChild(this.makeRow('Specular', this.slider({
      key: 'liquid.specular', min: 0, max: 4, step: 0.05,
      get: () => this.controls.getLiquidConfig().specular,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), specular: v }),
    })));
    liquidSection.appendChild(this.makeRow('Thickness', this.slider({
      key: 'liquid.thickness', min: 0, max: 2, step: 0.05,
      get: () => this.controls.getLiquidConfig().thickness,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), thickness: v }),
    })));
    liquidSection.appendChild(this.makeRow('Edge Bright', this.slider({
      key: 'liquid.edgeBrightness', min: 0, max: 4, step: 0.05,
      get: () => this.controls.getLiquidConfig().edgeBrightness,
      set: v => this.controls.setLiquidConfig({ ...this.controls.getLiquidConfig(), edgeBrightness: v }),
    })));
    this.liquidSection = liquidSection;
    return liquidSection;
  }

  /**
   * v8 Step 15.4 (E87) — **Cohesion.** Short-range attraction between nearby particles, applied as a positional
   * offset after the projection, so the figure beads into drops instead of staying one continuous curve.
   *
   * ⚠️ **NOT GATED ON THE RENDER MODE, unlike the section above it, and it has no `show()` entry at all.**
   * Cohesion moves `positions`, so every one of the seven modes draws the beaded figure — a beaded `star` or
   * `pixel` preset is a legitimate authored look, not a liquid-only accident. Hiding it behind
   * `renderMode === 'liquid'` would be invariant 13 reached through a gate: three controls that work
   * everywhere, visible in one seventh of the tab's states.
   *
   * It is placed immediately BELOW Liquid Surface because that is where its effect is most visible (with the
   * iso-surface live the drops actually fuse rather than merely crowding), and because the two share one
   * mental model. Adjacency here is a discoverability choice rather than the load-bearing gate-adjacency rule
   * the section above records.
   *
   * ⚠️ **`strength` DEFAULTS TO 0, so the section is inert until touched** — which is the one thing an inline
   * hint has to say, since a section of three live-looking sliders that changes nothing is exactly the report
   * invariant 25 exists to prevent. The other inline fact is that **preview tiles do not bead**: tiles run no
   * force field at all today (`grid-tile-renderer.ts` calls only the material, buoyancy and spark setters), so
   * a tile that stays smooth beside a beaded main view otherwise reads as a rendering defect.
   */
  private buildCohesionSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '12px';
    section.appendChild(this.sectionTitle('Cohesion', false));

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'Pulls nearby particles together so the figure beads into drops — in every render mode, '
      + 'though only Liquid makes them fuse. ⚠️ Off at 0; preview tiles never bead.';
    section.appendChild(hint);

    section.appendChild(this.makeRow('Cohesion', this.slider({
      key: 'cohesion.strength', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getCohesionConfig().strength,
      set: v => this.controls.setCohesionConfig({ ...this.controls.getCohesionConfig(), strength: v }),
    })));
    section.appendChild(this.makeRow('Cohesion Radius', this.slider({
      key: 'cohesion.radius',
      // ⚠️ **POSITIONS, not the value constants.** The element's domain for a tracked control is
      // the POSITION domain; `COHESION_RADIUS_MIN`/`COHESION_RADIUS_MAX` reach it through the track's own
      // `toPos`/`fromPos`, which `trackcheck` §H already asserts span exactly `0..1`. Passing the
      // value constants here is what made this slider's travel mostly dead.
      min: 0, max: 1, step: COHESION_RADIUS_STEP,
      toPos: COHESION_RADIUS_TRACK.toPos, fromPos: COHESION_RADIUS_TRACK.fromPos, fmt: fmtCohesionRadius,
      get: () => this.controls.getCohesionConfig().radius,
      set: v => this.controls.setCohesionConfig({ ...this.controls.getCohesionConfig(), radius: v }),
    })));
    // Linear, and 0 is a REACHABLE end rather than a neutral one: at Return Force 0 nothing pulls a particle
    // back and the offsets creep to the internal cap (measured: 164-285 of 10 000 pinned there after 90 s), so
    // the bottom of this track is a legitimate but degenerate setting the tooltip warns about.
    section.appendChild(this.makeRow('Return Force', this.slider({
      key: 'cohesion.returnForce', min: 0, max: 5, step: 0.05,
      get: () => this.controls.getCohesionConfig().returnForce,
      set: v => this.controls.setCohesionConfig({ ...this.controls.getCohesionConfig(), returnForce: v }),
    })));
    return section;
  }

  /**
   * v8 Step 15.5 — the liquid FIELD pool: a body of liquid the figure stirs, rather than a figure that IS the
   * liquid (15.1). Five controls, and like Cohesion above it has **no `show()` entry** — but for a stronger
   * reason than cohesion's. Cohesion nudges particles the figure already owns; this section CREATES particles,
   * publishes them into the same `positions` array, and lets whatever renderer is live draw them. So it is not
   * merely "live in all seven modes", it is authorable in all seven: a `star` figure trailing a stirred cloud is
   * a look, not a misconfiguration. Gating it on Liquid mode would hide a working feature.
   *
   * ⚠️ **THE INLINE HINT CARRIES THREE FACTS, ALL OF THEM PRECONDITIONS RATHER THAN DESCRIPTIONS
   * (invariant 25), because each one independently makes the whole section read as broken.** A tooltip cannot
   * carry them: it is discovered only by someone who already suspects the control, which is not the person who
   * has concluded the feature does nothing.
   *
   * 1. **`Enable` is OFF by default**, so the four sliders below it are inert until it is ticked — the shape of
   *    report Phase 14 collected three times.
   * 2. **The pool only MOVES if the figure moves.** The velocity field is fed by the figure's own displacement
   *    (`main.ts` seeds it from per-particle motion), so on a still or very slowly rotating preset the pool
   *    stands at its seed positions no matter what `Field Coupling` says — 14.3's finding, and the reason the
   *    step's own verification note says to watch a *moderately rotating* preset for a minute.
   * 3. **Preview tiles do not stir**, exactly as they do not bead: the tile renderer has no liquid-field setter
   *    at all, so a smooth tile beside a stirred main view is not a rendering defect.
   *
   * ⚠️ **Every control goes through the one `setLiquidFieldConfig` pair, never a narrower per-field setter** —
   * there is a SECOND owner behind that setter (`applyFluidFeedbackState()`, which derives whether the 512²
   * velocity field simulates and reads back at all), and a control that bypassed it would move a number with a
   * dead field behind it.
   */
  private buildLiquidFieldSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '12px';
    section.appendChild(this.sectionTitle('Liquid Field', false));

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'Adds a pool of free particles the figure stirs as it moves, in every render mode. '
      + '⚠️ Off by default; it only flows while the figure moves, and preview tiles never stir.';
    section.appendChild(hint);

    section.appendChild(this.makeRow('Enable', this.check({
      key: 'liquidField.enabled',
      get: () => this.controls.getLiquidFieldConfig().enabled,
      set: on => { this.controls.setLiquidFieldConfig({ ...this.controls.getLiquidFieldConfig(), enabled: on }); this.syncVisibility(); },
    }), 'Enable Liquid Field'));
    // Linear, `step` 100. ⚠️ **A step of 1 would be a defect rather than a nicety here**: `LiquidPool.ensure()`
    // reseeds only the APPENDED range on growth, so every stop of a drag appends particles — a 1-wide grid makes
    // 20 000 discrete appends out of one gesture. 100 also matches Particle Number's own grid, which is the
    // control this one is read against.
    section.appendChild(this.liquidFieldBody);
    const gated = this.liquidFieldBody;
    gated.appendChild(this.makeRow('Pool Size', this.slider({
      key: 'liquidField.poolSize', min: 0, max: LiquidPool.MAX_PARTICLES, step: 100, decimals: 0,
      get: () => this.controls.getLiquidFieldConfig().poolSize,
      set: v => this.controls.setLiquidFieldConfig({ ...this.controls.getLiquidFieldConfig(), poolSize: Math.round(v) }),
    })));
    // Categorical → SNAPPED in the Mixer (invariant 16). Changing it RESEEDS the whole pool by design, which is
    // why it is a dropdown rather than something a crossfade could sweep.
    gated.appendChild(this.makeRow('Seed Pattern', this.select({
      key: 'liquidField.seedPattern',
      options: [['fill', 'Fill'], ['cloud', 'Cloud'], ['blobs', 'Blobs'], ['basin', 'Basin']],
      get: () => this.controls.getLiquidFieldConfig().seedPattern,
      set: v => this.controls.setLiquidFieldConfig({
        ...this.controls.getLiquidFieldConfig(), seedPattern: v as LiquidSeedPattern,
      }),
    })));
    // ⚠️ **0 is this control's neutral value and the pool is still DRAWN there** — it stands at its seed
    // positions rather than disappearing, which is exactly what makes the Mixer's one-sided case fade smoothly
    // (see `interpolateLiquidField`). It is not an off switch; `Enable` is.
    gated.appendChild(this.makeRow('Field Coupling', this.slider({
      key: 'liquidField.fieldCoupling', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getLiquidFieldConfig().fieldCoupling,
      set: v => this.controls.setLiquidFieldConfig({ ...this.controls.getLiquidFieldConfig(), fieldCoupling: v }),
    })));
    // ⚠️ **Three decimals, not two, and that is the 15.1b readout defect avoided rather than a style choice**:
    // the whole range is 0.95-0.999, so `toFixed(2)` would print 0.95 for the bottom fifth of the travel and
    // 1.00 for the top — a slider that reads as inert over most of its length. Measured against the track's own
    // 50 stops: 50 distinct labels at three decimals, 5 at two.
    //
    // ⚠️ **The range's TOP is 0.999 and not 1.0 for a reason the slider cannot show**: at 1.0 the velocity field
    // never forgets, so a stir persists for the session and the pool's motion decouples from the figure entirely.
    gated.appendChild(this.makeRow('Field Decay', this.slider({
      key: 'liquidField.fieldDecay', min: 0.95, max: 0.999, step: 0.001, decimals: 3,
      get: () => this.controls.getLiquidFieldConfig().fieldDecay,
      set: v => this.controls.setLiquidFieldConfig({ ...this.controls.getLiquidFieldConfig(), fieldDecay: v }),
    })));
    return section;
  }

  /**
   * v8 Step 15.7 (E90) — the **Dye Field**: a 512² colour field the figure paints into and the fluid velocity
   * field advects, read back as the liquid surface's ALBEDO.
   *
   * ⚠️ **THIS SECTION'S CONTROLS ALL WORK AND STILL SHOW NOTHING UNTIL `Tint Source = Dye`** — the one fact
   * an inline hint has to carry, and the hardest shape of invariant 25 in the tab so far. The gate is not the
   * render mode (Cohesion's and Liquid Field's case, where the answer is *"it applies everywhere"*) and not a
   * checkbox in this section (`Enable`'s case, one row up): the gate is a *value of a dropdown in a different
   * section*, and one that is itself hidden unless the mode is `liquid`. So the precondition chain is three
   * links long — mode `liquid` → `Tint Source = Dye` → `Enable` — and NO amount of adjacency can express it.
   * It goes in the hint, in full, because *"the dye sliders do nothing"* is otherwise the only available
   * reading and it would be a report about the wrong section.
   *
   * ⚠️ **The section is NOT hidden when the mode is not `liquid`.** Hiding it would be worse than the current
   * discoverability cost: the field genuinely runs in every mode (it injects and advects unconditionally), so
   * a hidden section would claim the feature does not exist rather than that its output has nowhere to go —
   * and the user who wants to prime a wake *before* switching to `liquid` has no control at all. Compare
   * `liquidSection`, which IS hidden: there the controls do nothing whatsoever outside their mode.
   *
   * ⚠️ **Why the deleted section's four controls are six here.** Enable / Decay / Opacity / Colour Src were
   * the 2026-08-12 set (triage G14). `Advection Strength` and `Injection Radius` are new because they are the
   * two the rebuilt field actually needs authored: with no advection the dye is a static stain, and the radius
   * decides whether a deposit reads as a stroke or a speck (its range widened 1–8 → 2–64 — see
   * `DyeFieldConfig.injectionRadius` for the arithmetic).
   *
   * `Fixed Colour` is gated on `Colour Source = Fixed` and sits directly under it, the one place in this
   * section where gate-adjacency IS available and therefore where it is used.
   */
  private buildDyeSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '12px';
    section.appendChild(this.sectionTitle('Dye Field', false));

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    // ⚠️ **TWO sentences, and §I of `tipcheck` enforces that** — the cap exists because tooltips are additive
    // and an inline paragraph passes every other section. So the hint carries only what a tooltip cannot: the
    // three-link visibility chain, which is a fact about a control in a DIFFERENT section. Motion and the
    // preview-tile exception moved to `dye.enabled`'s tooltip, where the other two sections put them too.
    /*
     * v8 28.6 — ⚠️ **THIS SENTENCE IS THE ONE PHASE 28 FALSIFIED, AND IT IS THE MOST IMPORTANT EDIT IN THE
     * STEP.** It used to read *"only VISIBLE via Render Mode Liquid with Tint Source = Dye — otherwise it
     * runs unseen"*, which was true for 15.7 and is now false: 28.1 gave the dye its own output channel.
     *
     * ⚠️ **It now has to distinguish TWO claims that used to be one** — the field is SIMULATED whenever it
     * is enabled (always was), and it is now VISIBLE in every mode rather than in one. The same stale
     * sentence also lived in `tooltips.ts`, the user manual's three-link chain and
     * `DESIGN-liquid-material.md`; all are corrected in 28.9.
     */
    // ⚠️ **TWO SENTENCES, because §I caps inline copy at two and the first draft had four.** The cap is
    // right: this is a precondition, not documentation. Trail Decay and the preview-tile exception moved to
    // `dye.enabled`'s tooltip, which is where the motion note already lives.
    hint.textContent = 'The figure paints colour into a field the flow then carries, and it needs motion. '
      + '⚠️ Off by default; in Liquid mode with Tint Source = Dye it colours the surface, and in every other '
      + 'mode it draws behind the figure.';
    section.appendChild(hint);

    section.appendChild(this.makeRow('Enable', this.check({
      key: 'dye.enabled',
      get: () => this.controls.getDyeConfig().enabled,
      set: on => { this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), enabled: on }); this.syncVisibility(); },
    }), 'Enable Dye Field'));
    // ⚠️ **Named `Dye Amount`, not `Opacity`, although the field is `opacity`** — the number changed meaning
    // when the subsystem was rebuilt (a per-particle DEPOSIT WEIGHT, not a composite opacity, see the type's
    // own warning), and the field name is frozen for import compatibility. The label follows the meaning; the
    // key follows the field. This is the one place in the tab where the two deliberately disagree.
    /*
     * v8 28.5 (`28.D3`) — ⚠️ **PLACED DIRECTLY UNDER `Enable` BECAUSE THE TWO TOGETHER ARE "what exists"
     * and "what you see"**, which is the distinction the whole phase turns on. The four sliders below are
     * the field's own behaviour; the three rows after them are how it reaches the screen.
     *
     * ⚠️ **NOT DISABLED WHEN THE DYE IS NOT DRAWING, and that is a standing rule rather than an
     * oversight** — rows disabled behind a gate is a never-re-propose (`Liquid Field` rows with `Enable`
     * off). The engine forces the figure back on in that case (`28.D11`); the stored value stays exactly
     * what you set, because **the values are what you set BEFORE ticking the gate.**
     */
    section.appendChild(this.dyeBody);
    const gated = this.dyeBody;
    gated.appendChild(this.makeRow('Show Figure', this.check({
      key: 'dye.showFigure',
      get: () => this.controls.getDyeConfig().showFigure ?? true,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), showFigure: v }),
    })));

    gated.appendChild(this.makeRow('Dye Amount', this.slider({
      key: 'dye.opacity', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getDyeConfig().opacity,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), opacity: v }),
    })));
    // ⚠️ **Three decimals and a 0.90 floor, both for Field Decay's reason** (15.1b's readout defect): the
    // useful range is 0.90–1.0, so `toFixed(2)` would print eleven distinct labels over the whole travel and
    // most of a drag would read as inert. The floor is 0.90 rather than 0 because below it the dye clears
    // faster than the figure can lay it down — travel that only ever produces the empty field.
    //
    // ⚠️ **The top is 1.0 and IS reachable here, unlike Field Decay's 0.999**, and the difference is real: a
    // velocity field that never forgets decouples the pool from its cause, while dye that never fades
    // saturates to a flat colour — which is a legitimate authored look (a fully dyed body) and is also
    // recoverable, since a preset change clears the field.
    gated.appendChild(this.makeRow('Dye Decay', this.slider({
      key: 'dye.decayRate', min: 0.9, max: 1, step: 0.001, decimals: 3,
      get: () => this.controls.getDyeConfig().decayRate,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), decayRate: v }),
    })));
    // 0 is a REACHABLE end rather than a neutral one, and it is the "static stain" look: the dye still
    // deposits and still fades, it just does not travel. 1.0 is the pass-through value the default uses.
    gated.appendChild(this.makeRow('Advection', this.slider({
      key: 'dye.advectionStrength', min: 0, max: 2, step: 0.05,
      get: () => this.controls.getDyeConfig().advectionStrength,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), advectionStrength: v }),
    })));
    // CANVAS pixels, converted to field UV by `min(w,h)` in `dye-field.ts` (invariant 26 — per-axis would make
    // the deposit elliptical and the control would read as a shape change). Integer steps: the conversion
    // lands on ~0.4 field pixels per canvas pixel at 1024×768, so a fractional step buys nothing visible.
    gated.appendChild(this.makeRow('Dye Radius', this.slider({
      key: 'dye.injectionRadius', min: 2, max: 64, step: 1, decimals: 0,
      get: () => this.controls.getDyeConfig().injectionRadius,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), injectionRadius: Math.round(v) }),
    })));
    // Categorical → must SNAP at t=0.5 in the Mixer (invariant 16).
    /*
     * v8 28.3 (`28.D1`) — ⚠️ **TWO STEADY STATES, NOT TWO BRIGHTNESSES, which is why this is a dropdown
     * and not a slider.** Composited into a buffer that then decays by k, the fixed point for dye colour
     * C at alpha a is `aC / (1 - (1-a)k)` under Over but `aC / (1 - k)` under Add — 1.00x C against
     * 6.67x C at a = 1, k = 0.85. So Over is self-limiting and Add makes Trail Decay a brightness control.
     *
     * ⚠️ **It has no effect in Render Mode Liquid with Tint Source = Dye**, where the surface pass does the
     * compositing with its own fixed equation. The row stays visible and live there for the same reason
     * `Show Figure` does.
     */
    gated.appendChild(this.makeRow('Blend', this.select({
      key: 'dye.blendMode',
      options: [['over', 'Over'], ['add', 'Add']],
      get: () => this.controls.getDyeConfig().blendMode ?? 'over',
      set: v => this.controls.setDyeConfig({
        ...this.controls.getDyeConfig(),
        blendMode: v === 'add' ? 'add' : 'over',
      }),
    })));

    gated.appendChild(this.makeRow('Dye Colour', this.select({
      key: 'dye.colourSource',
      options: [
        ['depth', 'Depth'],
        // ⚠️ **SECOND, directly under `Depth`, because it IS `Depth` with the palette's ramp** (2026-10-15):
        // one coordinate, one fallback, and `main.ts` resolves them in one branch. Ordered by the same
        // property the paragraph below lists the others by — it both varies and needs no material — and
        // placed under its twin rather than at the end so the pair reads as a pair.
        ['palette', 'Palette'],
        // v8 28.4 — the sixth source. ⚠️ **The label must stay spelled `Ramp`**: `facetcheck` §C holds
        // `DYE_COLOUR_LABELS` to the SHIPPED words, and that record is keyed off the union itself, so
        // `tsc` demanded the entry the moment the union grew.
        ['ramp', 'Ramp'],
        ['velocity', 'Velocity'],
        // v8 28.15 — the UNDIMMED read of the figure's own colours. `Velocity` reads the same
        // array and scales it by speed; this one does not. Both are kept because the dimming is a
        // feature (a 0.35 floor stops a stationary particle punching a hole in the wake).
        ['figure', 'Figure'],
        ['temperature', 'Temperature'],
        ['fixed', 'Fixed'],
      ],
      get: () => this.controls.getDyeConfig().colourSource,
      set: v => {
        this.controls.setDyeConfig({
          ...this.controls.getDyeConfig(),
          colourSource: v as DyeFieldConfig['colourSource'],
        });
        // Fixed Colour is gated on this value, and a select's own `change` re-syncs nothing else — the
        // omission that left Volume's section hidden when Volume was picked (see `setRenderMode`).
        this.syncVisibility();
      },
    })));
    // ⚠️ **`Temperature` needs a MATERIAL and degrades to the figure's own colour without one** — stated in the
    // tooltip rather than by disabling the option, because a material can be picked after the source is.
    //
    // ⚠️ **`Depth` IS FIRST BECAUSE IT IS THE DEFAULT, AND IT IS THE DEFAULT BECAUSE IT WAS THE ONLY ONE
    // THAT BOTH VARIED AND NEEDED NO MATERIAL.** The other three each fail one half: `Fixed` cannot vary at
    // all (which is what made every dye slider read as inert — the surface's hue read is a weighted MEAN, so
    // a constant deposit is a constant result), `Temperature` varies only under a live material, and
    // `Velocity` varies but derives from the figure's OWN colour dimmed, so its output is invisible against
    // the thing it is meant to tint. Ordering the list by that property rather than alphabetically is the
    // only place the UI can say which one to reach for first.
    //
    // ⚠️ **`Palette` (2026-10-15) HAS BOTH PROPERTIES TOO, AND `Depth` STAYS THE DEFAULT ANYWAY** — a
    // default that depended on a palette being live would read as inert on every preset that has none, which
    // is the exact failure the paragraph above is a record of. `Palette` degrades TO `Depth` rather than the
    // other way round, so the pair cannot both be wrong at once.
    /*
     * v8 28.16 (`28.D17`) — the coordinate the three RAMP sources index, and the band count for `Index`.
     *
     * ⚠️ **FOUR CONDITIONAL ROWS IN THIS SECTION NOW, AND `updateRows()` IS THEIR ONE OWNER.** A fifth
     * added anywhere else is how two of them come to disagree about the same source.
     */
    const mapRow = this.makeRow('Dye Map', this.select({
      key: 'dye.mapping',
      options: [['depth', 'Depth'], ['index', 'Index']],
      get: () => this.controls.getDyeConfig().mapping ?? 'depth',
      set: v => this.controls.setDyeConfig({
        ...this.controls.getDyeConfig(),
        mapping: v === 'index' ? 'index' : 'depth',
      }),
    }));
    gated.appendChild(mapRow);
    this.dyeMapRow = mapRow;

    const cyclesRow = this.makeRow('Dye Cycles', this.slider({
      key: 'dye.cycles', min: 1, max: 64, step: 1, decimals: 0,
      get: () => this.controls.getDyeConfig().cycles ?? 1,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), cycles: Math.round(v) }),
    }));
    gated.appendChild(cyclesRow);
    this.dyeCyclesRow = cyclesRow;

    const fixedRow = this.rgbRow('Fixed Colour', {
      key: 'dye.fixedColour', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getDyeConfig().fixedColour,
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), fixedColour: v }),
    });
    gated.appendChild(fixedRow);
    this.dyeFixedColourRow = fixedRow;

    /*
     * v8 28.4 (`28.D2`) — the dye's OWN gradient, shown only under Colour Source = Ramp.
     *
     * ⚠️ **`getAllPaletteNames()`, the SAME list the Colour Palette dropdown offers**, because the dye
     * resolves this through `getPaletteLUT()` — one colour vocabulary rather than a second, smaller one.
     * ⚠️ **No `None` entry:** an unresolvable name already degrades to Depth's ramp on the CPU side and
     * never to black, so an explicit "no ramp" option would be a second spelling of that degrade.
     *
     * Hidden rather than greyed, for `dyeFixedColourRow`'s reason: the other five sources do not read it.
     */
    const rampRow = this.makeRow('Dye Ramp', this.select({
      key: 'dye.ramp',
      options: getAllPaletteNames(),
      get: () => this.controls.getDyeConfig().ramp ?? 'Classic: fire',
      set: v => this.controls.setDyeConfig({ ...this.controls.getDyeConfig(), ramp: v }),
    }));
    gated.appendChild(rampRow);
    this.dyeRampRow = rampRow;
    return section;
  }

  /**
   * A section header. Its tooltip comes from `HEADER_TIPS`, keyed by the header's own TEXT.
   *
   * Keyed by text rather than by an id because both header factories take only the text, and adding an id
   * parameter would mean editing all 23 call sites to say twice what they already say once. ⚠️ The cost is
   * that renaming a header silently drops its tooltip — grep `tooltips.ts` when renaming one.
   */
  /**
   * v8 `31.U3` — **delegates to the shared `makeCollapsible`, which TWO tabs now use.** The
   * implementation moved out of this file when the Materials tab needed the same behaviour; a second
   * copy of the collapse semantics is how the two come to disagree. **The tip is passed from THIS tab's
   * own table, so the shared module names no tooltips.**
   */
  private makeGroup(text: string, open = true, headClass = 'sl-vfx-group-head'): VfxGroup {
    return makeCollapsible({ text, tip: HEADER_TIPS[text], open, headClass });
  }

  /**
   * v8 `31.U2` — **a SECTION-level collapsible, for a section with many rows and no enabler.**
   *
   * ⚠️⚠️ **A PREDICATE GATE WOULD BE WRONG HERE AND THAT IS THE WHOLE REASON THIS EXISTS.** The five
   * enabler-gated sections each keep the control that flips the predicate VISIBLE — `Dye Field`,
   * `Liquid Field`, `Curl Noise` and `Neon Lines` their `Enable` box, `Physarum` its `Blend` slider — so
   * an off feature can always be switched back on. **`Deformation` has no such scalar: hiding its body
   * whenever every operator sits at identity would make it permanently unreachable**, which is a gate
   * that locks the door from the inside.
   */
  private makeCollapsibleSection(text: string, open = false): VfxGroup {
    return this.makeGroup(text, open, 'sl-vfx-sub-head');
  }

  /**
   * v8 `31.U` — the group header's text, split out ONLY so `tipcheck` has a literal to match. The
   * helper above reads `HEADER_TIPS` directly; this exists because §C/§D scan for a call expression and
   * a template or a variable would be invisible to them. **Call it with a literal or the check is dead.**
   */
  private groupTitle(text: string): string {
    return text;
  }

  private sectionTitle(text: string, spaced = true): HTMLElement {
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    if (spaced) title.style.marginTop = '16px';
    title.textContent = text;
    const tip = HEADER_TIPS[text];
    if (tip) title.title = tip;
    return title;
  }

  private subTitle(text: string): HTMLElement {
    const title = document.createElement('div');
    title.className = 'sl-vfx-sub-title';
    title.textContent = text;
    const tip = HEADER_TIPS[text];
    if (tip) title.title = tip;
    return title;
  }

  /**
   * Label + control on one row.
   *
   * ⚠️ **The row LIFTS its control's tooltip onto itself**, so hovering the LABEL — the part a user actually
   * reads and aims at — shows the same text as hovering the slider. This is why all 82 call sites needed no
   * edit for the tooltip pass: the control already resolved its own tip in the factory, and the row copies it.
   * `layerSlider` hands over a wrapper whose title sits on the inner `input`, hence the descendant fallback.
   */
  /**
   * One label-and-control row.
   *
   * ⚠️⚠️ **`aria` EXISTS BECAUSE THE ROW LABEL IS NOT ALWAYS A USABLE ACCESSIBLE NAME, AND THE GAP WAS
   * BOTH AN ACCESSIBILITY DEFECT AND A TESTABILITY ONE.** `slider()`, `check()` and `select()` set no
   * `aria-label` at all — only two specialised widgets in this tab do — so a screen reader read these
   * controls unnamed, and `CLAUDE.md`'s rule for a spec (*select on the `aria-label`, never on
   * position*) could not be followed because there was nothing to select on. **A `uicheck` clause
   * asserted `!isVisible()` on `[aria-label="Dye Amount"]` and PASSED against an element that never
   * existed** — a negative assertion on a selector matching nothing, which is worse than no clause.
   *
   * ⚠️ **SEVEN ROWS SHARE A LABEL WITH ANOTHER ROW**: `Enable` on FIVE sections (Neon Lines, Curl Noise,
   * Translation Map, Liquid Field, Dye Field) and `Width` on two (Ribbon, Neon). ⚠️ **I first wrote
   * "four" and the assertion that names them by KEY caught the fifth** — Translation Map's — which is
   * why the mapping is keyed by the control's key and not by a count. The section header disambiguates
   * them on screen; a screen reader and a selector get neither. **A lookup table keyed by LABEL could
   * not have fixed this: the labels are the thing that collides.**
   *
   * ⚠️ **It does not rename anything a user SEES**, and it applies only where the control has no name of
   * its own, so the two widgets that already name themselves keep theirs.
   */
  private makeRow(label: string, control: HTMLElement, aria?: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    const lbl = document.createElement('span');
    lbl.className = 'sl-vfx-label';
    lbl.textContent = label;
    const tip = control.title
      || control.querySelector<HTMLElement>('input[title],select[title]')?.title
      || '';
    if (tip) row.title = tip;
    const named = control.matches('input,select')
      ? control
      : control.querySelector<HTMLElement>('input,select');
    if (named && !named.getAttribute('aria-label')) {
      named.setAttribute('aria-label', aria ?? label);
    }
    row.appendChild(lbl);
    row.appendChild(control);
    return row;
  }

  // ---- Colour Palette section (v8 Step 21.4a / 21.4e / 21.4f) ------------------------------------

  /**
   * **The ONE palette area** — the palette, the mapping, and the `index` mapping's own two rate rows.
   *
   * ## v8 Step 21.4g — one control, and the film look feeds it
   *
   * `21.4c` put these two rows here because the Customize panel's own `Palette` / `Map` are **unreachable
   * for a preset that wants to keep its film look**: `setCustomFilmLookParam` forces `filmLook: 'Customize'`
   * and discards the named bundle, so choosing a palette there cost the preset its grading. (Re-measured
   * 2026-09-18: 108 of the composed library's 276 bodies would have paid that price — 73 carry a NAMED look
   * and 35 carry none, while the other 168 already read `Customize`. An earlier draft of this header said
   * `129 … and none carries a palette`, on a basis that reconciles with no collector; re-measure by importing
   * the library and reading `overlay.filmLook ?? filmLook`, and never grep the `palette:` literals — 171 of
   * them belong to `customFilmLookParams`.)
   *
   * That left **two rows labelled `Palette` and two labelled `Map`**, one pair of which was silently inert
   * whenever the other was set — invariant 13 in the readout, and the owner's finding on sight. `21.4g` is
   * the fix, and it is a UI rule, not a new field:
   *
   * - **The Customize panel has no palette rows at all** (see `buildCustomizePanel`).
   * - **These two rows DISPLAY the resolved selection**, never the raw stored override — so a preset that
   *   inherits its palette from its film look shows that palette here, by name.
   * - **Choosing a film look, a number-key look, or a material that brings one WRITES its palette here**
   *   (`adoptLookPalette()` in `main.ts`). *Last action wins*: pick a look and you get the look's palette;
   *   pick a palette and it stays until the next look choice.
   * - ⚠️ **…but only a look that HAS a palette writes here.** Three bundles (`Legacy`, `Legacy Graded`,
   *   `Cinematic`) carry `palette: 'none'`, which means *this look declines to choose a colour* — they exist so
   *   a grading change can be judged without restyling — and `lookPaletteForAdoption()` returns `null` for
   *   them, so these two rows keep whatever they showed. **Writing their `'none'` here was a live defect the
   *   owner reported on 2026-09-19**, one day after `21.4g` shipped: it erased the palette the preset itself
   *   had selected, on every one of the 114 bodies the `21.4d` migration adopts. `palettecheck` §H measures
   *   the rule over 15 looks × the 9 pairs the library authors; `palette-selection.ts`'s header owns the why.
   *
   * ⚠️ **`'From film look'` is retired as an option and its return is a regression** (`palettecheck` §H
   * asserts the absence of the string). With the look materialised on choice and resolved on display, an
   * "inherit" entry could only ever mean *the state this preset is already in*, and offering it as a choice
   * is what produced two plausible answers to "which palette is showing".
   *
   * ⚠️ **`PALETTE_UNSET` (`''`) survives in the FORMAT and only there** — it is the state of every preset in
   * the library that has never been touched, and `resolvePaletteSelection()` is the single owner of what it
   * means (invariant 17). This tab neither offers it nor re-derives it: every readout below, the two
   * dropdowns' own values included, comes from `getPaletteSelection()`.
   */
  private buildPaletteSection(): HTMLElement {
    const section = document.createElement('div');
    section.appendChild(this.sectionTitle('Colour Palette'));

    section.appendChild(this.makeRow('Palette', this.select({
      key: 'overlayPalette',
      options: [
        ['none', 'None'],
        ...getAllPaletteNames(),
      ],
      // ⚠️ **The RESOLVED name, which is why `updatePaletteRows()` re-reads this control.** `sel.name` is
      // never `PALETTE_UNSET` — the resolver folds an absent override to the look's palette and an absent
      // look to `'none'` — so every value it can return has an option here. Reading the stored override
      // instead would leave this row blank on the 168 untouched bodies whose palette comes from their look.
      get: () => this.controls.getPaletteSelection().name,
      set: v => {
        this.controls.setOverlayPalette(v);
        this.updatePaletteRows();
      },
    })));

    section.appendChild(this.makeRow('Map', this.select({
      key: 'overlayPaletteMapping',
      options: PALETTE_MAPPING_ORDER.map(m => [m, PALETTE_MAPPING_LABELS[m]] as [string, string]),
      // The resolved mapping, for the `Palette` row's reason. It is always one of the seven: the resolver
      // falls back to the look's mapping and then to `'depth'`, so there is no empty state to show.
      get: () => this.controls.getPaletteSelection().mapping,
      set: v => {
        this.controls.setOverlayPaletteMapping(v as PaletteMapping | '');
        this.updatePaletteRows();
      },
    })));

    section.appendChild(this.buildIndexColourPanel());
    return section;
  }

  /**
   * `Index Colour` — shown only under the `index` mapping, which is the one mapping whose colour is computed
   * per particle on the CPU and therefore the only one these two rates reach.
   *
   * ⚠️ **Gated by `display`, and the gate is DERIVED in `updatePaletteRows()` from the RESOLVED mapping**, not
   * from this tab's own dropdown: the mapping has two sources, so a film look can select `index` with the `Map`
   * row still reading `From film look`. Invariant 25's rule — *a control that explains the pipeline must be
   * gated on every early return upstream of it* — with the resolved selection as the one upstream truth.
   */
  private buildIndexColourPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sl-vfx-customize-panel';
    panel.appendChild(this.subTitle('Index Colour'));

    // 21.4f — the source, as TWO labels with their text set once and `display` toggled. A single element
    // assigned from a ternary would be invisible to `tipcheck` §I (see the field comments), and the state it
    // names is the one a user cannot otherwise infer: with no palette named, the `index` mapping colours the
    // figure from the preset's OWN `colorBase`/`colorAmp` — bit-identical to what it always rendered, which is
    // precisely why it looks like nothing happened.
    const sourceRow = document.createElement('div');
    sourceRow.className = 'sl-vfx-row';
    const sourceLbl = document.createElement('span');
    sourceLbl.className = 'sl-vfx-label';
    sourceLbl.textContent = 'Source';
    sourceRow.appendChild(sourceLbl);
    this.indexSourcePresetLabel = document.createElement('span');
    this.indexSourcePresetLabel.style.cssText = 'font-size:11px;color:#aaa;';
    this.indexSourcePresetLabel.textContent = 'Preset colour (index)';
    sourceRow.appendChild(this.indexSourcePresetLabel);
    // The palette NAME is a value, not copy — assigned live, and a name is never a literal in this file.
    this.indexSourceNameLabel = document.createElement('span');
    this.indexSourceNameLabel.style.cssText = 'font-size:11px;color:#aaa;';
    sourceRow.appendChild(this.indexSourceNameLabel);
    panel.appendChild(sourceRow);

    // The swatch strip: the population's colours at ONE instant, which is `INDEX_SWATCH_POS` and is not a
    // parameter — see that constant's header for invariant 28 in full, and for why the instant is 1 rather
    // than the tempting 0.
    const swatchRow = document.createElement('div');
    swatchRow.className = 'sl-vfx-row';
    const swatchLbl = document.createElement('span');
    swatchLbl.className = 'sl-vfx-label';
    swatchLbl.textContent = 'Ramp';
    swatchRow.appendChild(swatchLbl);
    this.indexSwatch = document.createElement('canvas');
    // Backing store = CSS size, so the strip is crisp: every sample is a whole number of pixels wide.
    this.indexSwatch.width = INDEX_SWATCH_SAMPLES * INDEX_SWATCH_CELL;
    this.indexSwatch.height = 14;
    this.indexSwatch.style.cssText =
      `flex:1;height:14px;max-width:${INDEX_SWATCH_SAMPLES * INDEX_SWATCH_CELL}px;border-radius:2px;`;
    swatchRow.appendChild(this.indexSwatch);
    panel.appendChild(swatchRow);

    panel.appendChild(this.tripletRow('Cycles', {
      key: 'indexCycles',
      min: 0, max: 1, step: CYCLES_STEP,
      captions: ['R', 'G', 'B'],
      toPos: CYCLES_TRACK.toPos,
      fromPos: CYCLES_TRACK.fromPos,
      fmt: fmtIndexCycles,
      get: () => this.controls.getIndexCycles(),
      set: (i, v) => {
        this.controls.setIndexCycles(i, v);
        this.updatePaletteRows();
      },
    }));

    panel.appendChild(this.tripletRow('Drift', {
      key: 'colourDrift',
      min: -1, max: 1, step: COLOUR_DRIFT_STEP,
      captions: ['R', 'G', 'B'],
      toPos: COLOUR_DRIFT_TRACK.toPos,
      fromPos: COLOUR_DRIFT_TRACK.fromPos,
      fmt: fmtColourDrift,
      get: () => this.controls.getColourDrift(),
      set: (i, v) => {
        this.controls.setColourDrift(i, v);
        this.updatePaletteRows();
      },
    }));

    const periodRow = document.createElement('div');
    periodRow.className = 'sl-vfx-row';
    const periodLbl = document.createElement('span');
    periodLbl.className = 'sl-vfx-label';
    periodLbl.textContent = 'Cycle';
    periodRow.appendChild(periodLbl);
    // A period is a VALUE and is assigned live, in `periodPhrase`'s wording — the Composer's own, imported
    // rather than respelled, because one quantity may not have two conventions.
    this.indexPeriodLabel = document.createElement('span');
    this.indexPeriodLabel.style.cssText = 'font-size:11px;color:#aaa;';
    periodRow.appendChild(this.indexPeriodLabel);
    // …and the no-period state is COPY, so its text is set once here and only its `display` moves. Printing a
    // period where none exists is the defect this pair exists to avoid (`Radar` drifts on no channel at all).
    this.indexStaticNote = document.createElement('span');
    this.indexStaticNote.style.cssText = 'font-size:11px;color:#888;';
    this.indexStaticNote.textContent =
      'Every channel’s Drift is zero, so each particle keeps one fixed colour and the ramp never moves.';
    periodRow.appendChild(this.indexStaticNote);
    panel.appendChild(periodRow);

    this.indexColourPanel = panel;
    return panel;
  }

  /**
   * The Colour Palette section's derived state: **the two dropdowns' own values**, the gate, the source
   * labels, the swatch and the period.
   *
   * Called from `syncFromControls()` (so a preset load, a Reset and an external change all reach it) and from
   * every handler in the section, for `updateGateRows()`' reason: `syncControl` restores each control's own
   * value and knows nothing about what the pair of them RESOLVES to.
   *
   * ⚠️ **Since `21.4g` the two dropdowns are themselves derived, so they are re-read HERE and this is the one
   * place that does it.** Their `get()` returns the resolved selection, which moves without either control
   * being touched: choosing a film look (this tab's `Look` row, a number key, or a material's `presentation`
   * block) materialises that look's palette into the override. A handler that wrote the override and did not
   * come through here would leave the row showing the previous palette while the figure had changed.
   */
  private updatePaletteRows(): void {
    const sel = this.controls.getPaletteSelection();
    const show = (elem: HTMLElement | null, visible: boolean): void => {
      if (elem) elem.style.display = visible ? '' : 'none';
    };

    this.syncKey('overlayPalette');
    this.syncKey('overlayPaletteMapping');

    show(this.indexColourPanel, sel.mapping === 'index');
    // Everything below only describes the `index` mapping, and sampling the generator is not free.
    if (sel.mapping !== 'index') return;

    show(this.indexSourcePresetLabel, sel.usesPresetQuadruple);
    show(this.indexSourceNameLabel, !sel.usesPresetQuadruple);
    if (this.indexSourceNameLabel && !sel.usesPresetQuadruple) {
      this.indexSourceNameLabel.textContent = sel.name;
    }

    this.drawIndexSwatch();

    const period = this.driftPeriod();
    show(this.indexPeriodLabel, period !== null);
    show(this.indexStaticNote, period === null);
    if (this.indexPeriodLabel && period) this.indexPeriodLabel.textContent = periodPhrase(period);
  }

  /** The population's colours at `INDEX_SWATCH_POS`, one cell per sample. */
  private drawIndexSwatch(): void {
    const cv = this.indexSwatch;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const cols = this.controls.sampleIndexColours(INDEX_SWATCH_SAMPLES);
    const n = Math.floor(cols.length / 3);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < n; i++) {
      // The generator works in 0–1 floats and the law has already clamped; this is the same 8-bit round the
      // screen path takes, so the strip shows the colours the frame shows rather than a second quantisation.
      const r = Math.round(255 * (cols[i * 3] ?? 0));
      const g = Math.round(255 * (cols[i * 3 + 1] ?? 0));
      const b = Math.round(255 * (cols[i * 3 + 2] ?? 0));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i * INDEX_SWATCH_CELL, 0, INDEX_SWATCH_CELL, cv.height);
    }
  }

  /**
   * How long the slowest drifting channel takes to come back round, in seconds at the figure's sweep rate.
   *
   * ⚠️ **The unit conversion is invariant 10's territory and it is `× 180/π`, not `÷`.** `modulatorSeconds`
   * expects a rate in the modulators' own unit, where a full cycle is `360 / rate` in `pos` units; the colour
   * law's drift term is `sin(… + pos · shift)` with **no `/DEG`**, so its cycle is `2π / |shift|` and the
   * equivalent rate is `360 · |shift| / 2π = |shift| · 180/π`. Getting this backwards is a readout wrong by
   * 3283× that `tsc` cannot see — it would put `Radar`-class drifts in the hours.
   *
   * ⚠️ **It refuses only on a zero RATE, never on a zero amplitude**, exactly as `slowestModulatorSeconds` and
   * `phaseForTarget` do one module over: a flat channel is a *different* inertness, and it is already named —
   * by the swatch strip two rows up, which simply shows a flat band. The amplitude is also not this tab's to
   * read under a palette, where it belongs to the palette rather than to the preset.
   */
  private driftPeriod(): { seconds: number; repeats: boolean } | null {
    const waveSpeed = this.controls.getWaveSpeed();
    const rates: number[] = [];
    for (const shift of this.controls.getColourDrift()) {
      if (shift !== 0 && Number.isFinite(shift)) rates.push(Math.abs(shift) * DRIFT_RATE_PER_UNIT);
    }
    if (rates.length === 0) return null;
    const slowest = Math.min(...rates);
    const seconds = modulatorSeconds(slowest, waveSpeed);
    if (seconds === null) return null;
    // ⚠️ On the RATIO, which is dimensionless — `slowestModulatorSeconds`' own argument: an absolute epsilon
    // over drifts spanning 0.001 to 3 would call the fast end commensurate with anything.
    const repeats = rates.every(r => Math.abs(r / slowest - Math.round(r / slowest)) < 1e-9);
    return { seconds, repeats };
  }

  // ---- Customize sub-panel -----------------------------------------------------------------------

  /**
   * 20 of the 21 `FilmLookParams` fields. `lightDir` has no control — it is settable only by a named
   * bundle or by hand-editing `overlay.customFilmLookParams` in an exported preset (triage E5).
   *
   * Every entry is keyed `cp.*` so `syncGroup('cp.')` can re-read the whole panel when a named bundle
   * re-seeds the params.
   */
  private buildCustomizePanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sl-vfx-customize-panel';
    const p = (): FilmLookParams => this.controls.getCustomFilmLookParams();

    panel.appendChild(this.subTitle('Particle Shape'));
    panel.appendChild(this.makeRow('Glow', this.slider({
      key: 'cp.glow', min: 0, max: 10, step: 0.5, decimals: 1,
      get: () => p().glow, set: v => this.cpSet({ glow: v }),
    })));
    panel.appendChild(this.makeRow('Depth Sz', this.slider({
      key: 'cp.depthSize', min: 0, max: 1, step: 0.05,
      get: () => p().depthSize, set: v => this.cpSet({ depthSize: v }),
    })));
    panel.appendChild(this.makeRow('Depth Br', this.slider({
      key: 'cp.depthBrightness', min: 0, max: 1, step: 0.05,
      get: () => p().depthBrightness, set: v => this.cpSet({ depthBrightness: v }),
    })));
    panel.appendChild(this.makeRow('DoF', this.slider({
      key: 'cp.depthDof', min: 0, max: 1, step: 0.05,
      get: () => p().depthDof, set: v => this.cpSet({ depthDof: v }),
    })));
    panel.appendChild(this.makeRow('Color Sh', this.slider({
      key: 'cp.depthColorShift', min: 0, max: 1, step: 0.05,
      get: () => p().depthColorShift, set: v => this.cpSet({ depthColorShift: v }),
    })));
    panel.appendChild(this.makeRow('Lighting', this.select({
      key: 'cp.lightingMode',
      options: [['0', 'None'], ['1', 'Directional'], ['2', 'Rim'], ['3', 'Both']],
      get: () => String(p().lightingMode),
      set: v => this.cpSet({ lightingMode: parseInt(v, 10) }),
    })));
    panel.appendChild(this.makeRow('Rim Pow', this.slider({
      key: 'cp.rimPower', min: 1, max: 8, step: 0.5, decimals: 1,
      get: () => p().rimPower, set: v => this.cpSet({ rimPower: v }),
    })));

    /*
     * ⚠️ **NO `Palette` / `Map` ROWS HERE, AND RE-ADDING A PAIR IS THE REGRESSION `21.4g` EXISTS TO PREVENT.**
     *
     * `FilmLookParams.palette` / `.paletteMapping` are still live fields — 15 named bundles author them, the
     * Mixer interpolates them, an import can carry them — but they are **a look's contribution to the
     * palette, not the palette**, and since `21.4g` the one control that shows and sets the palette is the
     * `Colour Palette` section's `Palette` row (`buildPaletteSection`). Choosing a look here writes that
     * look's pair into the override, so the value these two rows used to edit is visible there, by name, the
     * instant a look is picked.
     *
     * Two rows labelled `Palette` is what the owner saw and named: whichever pair was not winning read as a
     * live control that could not move the picture (invariant 13), with no indication which was which. The
     * fix had to be one control, not a second annotation — hence also the retirement of the inline note that
     * used to sit under the `Colour Palette` row explaining the inert state, and of the `'From film look'`
     * option that created it. `palettecheck` §H asserts the absence of the `cp.palette` / `cp.paletteMapping`
     * keys and of that string.
     *
     * The preconditions the removed `Map` row documented are NOT lost — they moved with the control:
     * `temperature` needs a live material (its label says so, and `HDRParticleRenderer` falls back to
     * velocity regardless), and both dropdowns are built from `PALETTE_MAPPING_ORDER` /
     * `PALETTE_MAPPING_LABELS`, which exist because the hand-written six-pair literal that used to live here
     * CAST its value to a union of its own and so produced no `tsc` error when `PaletteMapping` gained
     * `index`.
     */
    panel.appendChild(this.subTitle('Bloom'));
    panel.appendChild(this.makeRow('Enabled', this.check({
      key: 'cp.bloomEnabled',
      get: () => p().bloomEnabled, set: v => this.cpSet({ bloomEnabled: v }),
    })));
    panel.appendChild(this.makeRow('Threshold', this.slider({
      key: 'cp.bloomThreshold', min: 0, max: 1, step: 0.05,
      get: () => p().bloomThreshold, set: v => this.cpSet({ bloomThreshold: v }),
    })));
    panel.appendChild(this.makeRow('Intensity', this.slider({
      key: 'cp.bloomIntensity', min: 0, max: 2, step: 0.05,
      get: () => p().bloomIntensity, set: v => this.cpSet({ bloomIntensity: v }),
    })));

    panel.appendChild(this.subTitle('Tone Map'));
    panel.appendChild(this.makeRow('Enabled', this.check({
      key: 'cp.toneMapEnabled',
      get: () => p().toneMapEnabled, set: v => this.cpSet({ toneMapEnabled: v }),
    })));
    panel.appendChild(this.makeRow('Curve', this.select({
      key: 'cp.toneMapCurve',
      options: [['none', 'None'], ['aces', 'ACES'], ['reinhard', 'Reinhard']],
      get: () => p().toneMapCurve,
      set: v => this.cpSet({ toneMapCurve: v as 'none' | 'aces' | 'reinhard' }),
    })));
    panel.appendChild(this.makeRow('Exposure', this.slider({
      key: 'cp.exposure', min: 0.1, max: 4, step: 0.1, decimals: 1,
      get: () => p().exposure, set: v => this.cpSet({ exposure: v }),
    })));
    panel.appendChild(this.makeRow('Saturation', this.slider({
      key: 'cp.saturation', min: 0, max: 2.5, step: 0.05,
      get: () => p().saturation, set: v => this.cpSet({ saturation: v }),
    })));
    panel.appendChild(this.makeRow('Vignette', this.slider({
      key: 'cp.vignette', min: 0, max: 1, step: 0.05,
      get: () => p().vignette, set: v => this.cpSet({ vignette: v }),
    })));

    panel.appendChild(this.rgbRow('Lift', {
      key: 'cp.lift', min: -0.2, max: 0.2, step: 0.01,
      get: () => p().lift, set: v => this.cpSet({ lift: v }),
    }));
    panel.appendChild(this.rgbRow('Gamma', {
      key: 'cp.gamma', min: 0.5, max: 2.0, step: 0.05,
      get: () => p().gamma, set: v => this.cpSet({ gamma: v }),
    }));
    panel.appendChild(this.rgbRow('Gain', {
      key: 'cp.gain', min: 0.5, max: 2.0, step: 0.05,
      get: () => p().gain, set: v => this.cpSet({ gain: v }),
    }));

    return panel;
  }

  // ---- TransMap layer chain editor ----------------------------------------------------------------
  //
  // Same tier as the IFS editor below: outside the descriptor registry because layers are added and
  // removed. See the `layerPanel` field for why the per-style panels are MOVED rather than rebuilt.

  private buildLayerPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sl-vfx-layer-panel';
    panel.style.cssText = 'margin-left:12px;margin-bottom:8px;';

    // Needed once the panel became unconditionally visible: without it the rows read as loose controls
    // hanging off Chain Mix, and a one-layer chain — every shipped preset — gives no other hint that the
    // single row is one entry in a list that accepts more.
    panel.appendChild(this.subTitle('Layers'));

    const rows = document.createElement('div');
    this.layerRowContainer = rows;
    panel.appendChild(rows);

    // --- Add Layer: a dropdown of the styles NOT already in the chain ---
    //
    // Offering only absent styles is how "at most one layer per style" is enforced in the UI rather than
    // being an error message. The list is rebuilt on every sync, since the chain changes underneath it.
    const addRow = document.createElement('div');
    addRow.className = 'sl-vfx-row';
    addRow.style.marginTop = '4px';
    const sel = document.createElement('select');
    sel.className = 'sl-vfx-select';
    this.addLayerSelect = sel;
    const addBtn = document.createElement('button');
    addBtn.className = 'sl-btn sl-btn-sm';
    addBtn.textContent = '+ Add Layer';
    addBtn.style.marginLeft = '6px';
    addBtn.addEventListener('click', () => {
      const style = parseInt(sel.value, 10);
      if (!Number.isFinite(style)) return;
      const chain = this.controls.getTransMapChain();
      if (chain.some(l => l.style === style)) return;
      chain.push(makeLayer(style as TransMapLayer['style']));
      this.commitChain(chain);
    });
    addRow.appendChild(sel);
    addRow.appendChild(addBtn);
    panel.appendChild(addRow);

    // --- The one executable reordering ---
    //
    // ⚠️ **ONE swap button, not per-row arrows.** Field layers SUM, and addition commutes, so moving one
    // field layer past another cannot change a single pixel; only the echo layer's position relative to
    // them is real (warp-then-echo blurs the echo's source, echo-then-warp warps the echo). With at most
    // one echo layer there are exactly two arrangements. Per-row arrows would be four controls that mostly
    // do not move the thing they name, which is invariant 13.
    const swapRow = document.createElement('div');
    swapRow.className = 'sl-vfx-row';
    swapRow.style.marginTop = '2px';
    const swap = document.createElement('button');
    swap.className = 'sl-btn sl-btn-sm';
    swap.textContent = '⇅ Swap warp / echo order';
    swap.title = 'Move the Fractal Feedback (echo) pass to the other side of the displacement pass. Reordering displacement layers among themselves has no effect — they sum.';
    swap.addEventListener('click', () => {
      const chain = this.controls.getTransMapChain();
      const echoIdx = chain.findIndex(l => l.style === ECHO_STYLE);
      if (echoIdx < 0) return;
      const [echo] = chain.splice(echoIdx, 1);
      if (!echo) return;
      // Front if it was not already at the front, back otherwise — a toggle between the only two
      // arrangements, derived from where the echo currently sits rather than from a remembered flag.
      if (echoIdx === 0) chain.push(echo); else chain.unshift(echo);
      this.commitChain(chain);
    });
    this.swapButton = swap;
    swapRow.appendChild(swap);
    panel.appendChild(swapRow);

    // --- What actually runs ---
    const readout = document.createElement('div');
    readout.style.cssText = 'font-size:10px;color:#888;margin-top:4px;font-family:monospace;';
    this.pipelineReadout = readout;
    panel.appendChild(readout);

    this.rebuildLayerRows();
    return panel;
  }

  /** Push a chain edit to the engine and re-render the list. The single write path for every layer edit. */
  private commitChain(chain: TransMapLayer[]): void {
    this.controls.setTransMapChain(chain);
    this.rebuildLayerRows();
    this.syncVisibility();
  }

  /**
   * Re-read the chain. Rebuilds the rows only when the SHAPE changed, so dragging a weight does not
   * destroy the slider being dragged (the same reason `syncIfsRows()` compares lengths before rebuilding —
   * but keyed on styles too, since a chain can swap a style without changing length).
   */
  private syncLayerRows(): void {
    if (!this.layerRowContainer) return;
    const chain = this.controls.getTransMapChain();
    const sameShape = this.layerRows.length === chain.length
      && chain.every((l, i) => this.layerRows[i]?.dataset.style === String(l.style));
    if (!sameShape) {
      this.rebuildLayerRows();
      return;
    }
    chain.forEach((l, i) => this.updateLayerRow(i, l));
    this.refreshAddOptions(chain);
  }

  private rebuildLayerRows(): void {
    const container = this.layerRowContainer;
    if (!container) return;
    const chain = this.controls.getTransMapChain();
    // ⚠️ The shared panels are children of these rows. Detach them to the flat slot BEFORE clearing, or
    // `innerHTML = ''` destroys the live `proceduralFlowPanel` / `fluidFeedbackPanel` / `ifsPanel` DOM
    // while `controlList` still holds handles into it — every `flow.*` descriptor would then write to a
    // detached node and the panel would never reappear.
    for (const p of [this.ifsPanel, this.proceduralFlowPanel, this.fluidFeedbackPanel]) {
      if (p && this.flatPanelSlot && p.parentElement !== this.flatPanelSlot) this.flatPanelSlot.appendChild(p);
    }
    container.innerHTML = '';
    this.layerRows = [];
    this.layerBodies = [];
    chain.forEach((layer, i) => {
      const row = this.buildLayerRow(i, layer, chain.length);
      this.layerRows.push(row);
      container.appendChild(row);
    });
    this.refreshAddOptions(chain);
  }

  /**
   * Only styles absent from the chain are offerable — the UI form of "at most one layer per style".
   *
   * ⚠️ **`ALL_STYLES`, never a literal.** This line held `[0, 1, 2, 3, 4, 5, 6]` until Step 14.0 and was the
   * THIRD enumeration of the vocabulary — the one that fails most quietly, because a style missing from it
   * still type-checks, still loads from a preset, still renders correctly and is simply **unreachable from
   * the UI**. Nothing in `tsc` compares an array literal to a union.
   */
  private refreshAddOptions(chain: readonly TransMapLayer[]): void {
    const sel = this.addLayerSelect;
    if (!sel) return;
    const present = new Set(chain.map(l => l.style));
    const wanted = ALL_STYLES.filter(s => !present.has(s));
    const current = sel.value;
    sel.innerHTML = '';
    for (const s of wanted) {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = TRANS_MAP_STYLE_NAMES[s]!;
      sel.appendChild(o);
    }
    // Keep the user's pick across a rebuild when it is still offerable.
    if (wanted.some(s => s === parseInt(current, 10))) sel.value = current;
    sel.disabled = wanted.length === 0;
  }

  private buildLayerRow(index: number, layer: TransMapLayer, chainLength: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-layer-row';
    row.dataset.style = String(layer.style);
    row.style.cssText = 'border:1px solid #333;border-radius:4px;padding:5px 7px;margin-bottom:5px;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px;';

    /**
     * ⚠️ **`chainLength > 1` is part of the condition, and it has to be** — otherwise this expander is a
     * control that does not move the thing it names (invariant 13).
     *
     * `placeStylePanel()` keeps the shared Flow / Fluid / IFS panel in the FLAT SLOT for a one-layer chain,
     * so this row's body is empty in that case and toggling it would open an empty box while the settings
     * sit visible a few pixels below. The two halves of the single-layer view must agree on where the panel
     * lives; they are derived from the same `chain.length <= 1` test for that reason.
     *
     * ⚠️ **Styles 0-3, 7, 10 and every `weightless` style are the exception to the `chainLength > 1` clause,
     * and deliberately so.** They OWN their body — `buildStaticFieldBody()` / `buildWeightlessBody()` /
     * `buildVortexBody()` — rather than borrowing the shared panel from the flat slot, so there is nothing to
     * double up with and nothing sitting visible a few pixels below, which is the whole reason the clause
     * exists for the other three. Styles 0-3 had no body at all until 2026-08-20 (their parameters were the
     * preset's shared `sinMagicParams`, not editable here) and the button was inert.
     *
     * ⚠️ **The weightless clause is DERIVED from `isWeightless`, never hand-listed.** It read `=== 9` while
     * style 9 was the only weightless style, and styles 8 and 11 inherited a DISABLED expander at every chain
     * length — their rows built the real sliders (`buildWeightlessBody` dispatches correctly) into a body that
     * nothing could ever open, so both features were unreachable in the UI while looking completely present.
     * The same missing-entry shape as the three chain lists, one enumeration further out.
     */
    const isStatic = isSeparableStyle(layer.style);
    // Style 10 joins the owned-body list for the same reason as 7: its parameters are its own, not the shared
    // Flow/Fluid/IFS panel, so there is nothing for the `chainLength > 1` clause to avoid doubling up with.
    /*
     * ⚠️ **STYLE 12 JOINED THIS LIST ON 2026-10-22 BECAUSE ITS ABSENCE MADE A BUILT STYLE UNREACHABLE** —
     * owner report, and it is **exactly the defect the paragraph above describes, one occurrence later**:
     * the engine, the config, the shader and the export gate were all in place, `TRANS_MAP_STYLES` offered
     * the style in the add-layer menu, and the expander was `disabled` because this hand-written list did
     * not name it. **So the style could be added and never configured.** `deformcheck` §G now asserts the
     * membership, which is the only form that cannot drift from the dispatch below.
     */
    const ownsBody = isStatic || styleOwnsBody(layer.style) || isWeightless(layer.style);
    const hasBody = ownsBody
      || (chainLength > 1 && (layer.style === ECHO_STYLE || layer.style === 5 || layer.style === 6));
    const expander = document.createElement('button');
    expander.className = 'sl-btn sl-btn-sm';
    expander.style.cssText = 'padding:0 4px;font-size:10px;min-width:18px;';
    expander.textContent = this.expandedLayers.has(layer.style) ? '▾' : '▸';
    expander.disabled = !hasBody;
    expander.addEventListener('click', () => {
      if (this.expandedLayers.has(layer.style)) this.expandedLayers.delete(layer.style);
      else this.expandedLayers.add(layer.style);
      this.rebuildLayerRows();
      this.syncVisibility();
    });
    head.appendChild(expander);

    // Per-layer MUTE. Keeps the layer's settings while contributing nothing — the point is A/B comparison
    // without losing a tuning, which is why removal is a separate button.
    const mute = document.createElement('input');
    mute.type = 'checkbox';
    // ⚠️ Marker classes, because `updateLayerRow` cannot query this row by TYPE. A row's `body` is where
    // `placeStylePanel()` MOVES the Procedural Flow / Fluid Feedback / IFS panel, and those hold their own
    // checkboxes, ranges and `.sl-vfx-value` spans. `querySelector('input[type=range]')` happens to find the
    // weight slider today only because `head` precedes `body` in document order — a guarantee that evaporates
    // the moment anything is inserted above the head.
    mute.className = 'sl-vfx-layer-mute';
    mute.checked = layer.enabled;
    mute.title = 'Mute this layer (keeps its settings)';
    mute.addEventListener('change', () => {
      const chain = this.controls.getTransMapChain();
      const entry = chain[index];
      if (entry) entry.enabled = mute.checked;
      this.commitChain(chain);
    });
    head.appendChild(mute);

    const name = document.createElement('span');
    name.style.cssText = 'font-size:11px;color:#ccc;font-weight:600;flex:1;';
    name.className = 'sl-vfx-layer-name';
    name.textContent = TRANS_MAP_STYLE_NAMES[layer.style] ?? `Style ${layer.style}`;
    head.appendChild(name);

    /**
     * ⚠️ **A `weightless` style gets NO weight slider — it is not shipped disabled and it is not shipped
     * inert.** Band Split recomposes the whole frame, so "this layer's share of the displacement" is not a
     * quantity it has; a slider that moved and changed nothing is invariant 13, and `normaliseChain` pins
     * such a layer's weight to 1 so nothing downstream can read a stale value from an import.
     *
     * The early `return` is deliberate: the code below builds and appends the slider, and a guard around
     * just the `appendChild` would leave the listener alive on a detached node.
     */
    if (isWeightless(layer.style)) {
      // The inert-modifier notice takes the space the slider would have occupied, so the two never collide.
      const note = document.createElement('span');
      note.className = 'sl-vfx-layer-note';
      note.style.cssText = 'font-size:9px;color:#888;font-style:italic;';
      this.applyModifierNote(note, layer.style);
      head.appendChild(note);
      head.appendChild(this.buildLayerRemoveButton(index, chainLength));
      row.appendChild(head);
      const bodyOnly = document.createElement('div');
      bodyOnly.style.cssText = 'margin-top:4px;';
      bodyOnly.style.display = this.expandedLayers.has(layer.style) ? '' : 'none';
      // ⚠️ **Dispatched on the style, because `weightless` now has THREE members.** This called
      // `buildModifierBody` unconditionally while style 9 was the only one, so styles 8 and 11 would each have
      // been given BAND SPLIT's two sliders — writing a `bandSplit` block their own pass never reads, while
      // their real parameters stayed at defaults and unreachable. Two controls that move nothing plus a whole
      // style with no controls at all: invariant 13 twice over, and it would have looked like a working row.
      bodyOnly.appendChild(this.buildWeightlessBody(index, layer));
      row.appendChild(bodyOnly);
      this.layerBodies[index] = bodyOnly;
      return row;
    }

    const weight = document.createElement('input');
    weight.type = 'range';
    weight.min = '0'; weight.max = '1'; weight.step = '0.01';
    weight.value = String(layer.weight);
    weight.className = 'sl-vfx-slider sl-vfx-layer-weight';
    weight.style.maxWidth = '90px';
    weight.title = 'Layer weight — its share of the displacement, before Chain Mix';
    const weightVal = document.createElement('span');
    weightVal.className = 'sl-vfx-value sl-vfx-layer-weight-val';
    weightVal.textContent = layer.weight.toFixed(2);
    weight.addEventListener('input', () => {
      const v = parseFloat(weight.value);
      weightVal.textContent = v.toFixed(2);
      // Re-reads the chain on every change rather than closing over `layer` — the same G11 hazard the IFS
      // rows document: a row outlives the array snapshot that built it, so a captured layer object would
      // take edits that are then thrown away by the next rebuild.
      const chain = this.controls.getTransMapChain();
      const entry = chain[index];
      if (entry) entry.weight = v;
      // NOT `commitChain`: rebuilding the rows mid-drag would destroy this slider. The shape has not
      // changed, so only the engine needs telling.
      //
      // ⚠️ **Known cost, bounded and drag-only: a chain with TWO OR MORE static layers (styles 0-3) rebuilds
      // the canvas-sized displacement texture on each step of this drag** — 9.5 ms at 1080p, 40 ms at 4K (see
      // `buildStaticFieldTexture`). `setChain` keys that texture on a signature of per-layer weight RATIOS, and
      // with two static layers a ratio genuinely changes every step, so the rebuild is not spurious: the summed
      // field really is different. `input` on a range is pointer-rate, i.e. about one event per frame, so this
      // is a frame-rate dip while dragging rather than an unbounded allocation rate (invariant 8) — and it
      // settles the instant the drag stops. A single static layer, which is every shipped preset, has ratio
      // 1.0 always and rebuilds NOTHING here.
      this.controls.setTransMapChain(chain);
      if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
    });
    head.appendChild(weight);
    head.appendChild(weightVal);

    head.appendChild(this.buildLayerRemoveButton(index, chainLength));

    row.appendChild(head);

    // The body is the drop target `placeStylePanel()` moves the shared panel into — EXCEPT for the styles
    // that own theirs (0-3 static, 7 refraction). The two cases never collide: `placeStylePanel` is only
    // ever called for styles 4, 5 and 6, so no shared panel can be moved into an owned body.
    const body = document.createElement('div');
    body.style.cssText = 'margin-top:4px;';
    body.style.display = (hasBody && this.expandedLayers.has(layer.style)) ? '' : 'none';
    if (isStatic) body.appendChild(this.buildStaticFieldBody(index, layer));
    else if (layer.style === 7) body.appendChild(this.buildRefractionBody(index, layer));
    else if (layer.style === 10) body.appendChild(this.buildVortexBody(index, layer));
    else if (layer.style === 12) body.appendChild(this.buildConformalBody(index, layer));
    row.appendChild(body);
    this.layerBodies[index] = body;

    return row;
  }

  /** The ✕ button, shared by the weighted and weightless row shapes so the two cannot drift apart. */
  private buildLayerRemoveButton(index: number, chainLength: number): HTMLElement {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'sl-btn sl-btn-sm';
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'padding:1px 5px;font-size:10px;';
    // The last layer is not removable: an empty chain has no style for the collapsed one-layer view to
    // show, and TransMap's own Enable checkbox is what turns the whole pass off.
    removeBtn.disabled = chainLength <= 1;
    removeBtn.addEventListener('click', () => {
      const chain = this.controls.getTransMapChain();
      if (chain.length <= 1) return;
      chain.splice(index, 1);
      this.commitChain(chain);
    });
    return removeBtn;
  }

  private updateLayerRow(index: number, layer: TransMapLayer): void {
    const row = this.layerRows[index];
    if (!row) return;
    // Queried by MARKER CLASS, never by input type — see `buildLayerRow`. A moved-in style panel is a
    // descendant of this row and is full of ranges, checkboxes and `.sl-vfx-value` spans.
    const mute = row.querySelector<HTMLInputElement>('.sl-vfx-layer-mute');
    if (mute) mute.checked = layer.enabled;
    // Absent on a weightless row BY DESIGN, so every one of these is a null-tolerant lookup rather than an
    // assertion — a weightless row has no weight slider to sync.
    const weight = row.querySelector<HTMLInputElement>('.sl-vfx-layer-weight');
    if (weight) weight.value = String(layer.weight);
    const val = row.querySelector<HTMLElement>('.sl-vfx-layer-weight-val');
    if (val) val.textContent = layer.weight.toFixed(2);
    // ⚠️ **THIS CALL IS BACK (2026-09-23) BECAUSE THE CONTROLS ARE**, and the obligation is the one §H briefly
    // removed: styles 0-3 own a body full of pattern/strength/detail/drift/zoom/centre handles, so this row has
    // the same resync duty as the four below. **A preset change RESYNCS the tab**, so the failure mode is a
    // handle left over the PREVIOUS preset's value — which reads as "the value survived" rather than as a bug,
    // and is invariant 13's readout form. It is also the path an edit made in the Transmap tab arrives by.
    this.updateStaticRows(row, layer);
    // Same obligation for the two Phase 14 owned bodies, and for the same reason.
    this.updateRefractionRows(row, layer);
    this.updateBandRows(row, layer);
    // ⚠️ Same obligation for the four Phase-14 styles, and it is not optional for any of them: **a preset
    // change RESYNCS the whole tab, by design**, so a handle left over a previous preset's value is the
    // documented failure mode — not a value that "survived". Each returns early on the wrong style, so all
    // four run on every row.
    this.updateTimeWarpRows(row, layer);
    this.updateVortexRows(row, layer);
    this.updateParallaxRows(row, layer);
    // The inert-modifier notice depends on the OTHER layers, so it must be re-evaluated on every sync and
    // not only when this row is rebuilt — muting the last field layer is what makes Band Split inert.
    const note = row.querySelector<HTMLElement>('.sl-vfx-layer-note');
    if (note) this.applyModifierNote(note, layer.style);
  }

  // ---- per-layer static field settings (styles 0-3) — RESTORED 2026-09-23 (§H reversed by the owner) ----
  //
  // Tier 2, like the layer rows themselves: hand-built with its own sync rather than descriptor entries,
  // because these controls are created and destroyed as layers come and go, so there is no fixed key to
  // register. Every handler RE-READS the chain instead of closing over the layer object (the G11 hazard the
  // weight slider documents), and none of them calls `commitChain` — rebuilding the rows mid-drag would
  // destroy the slider being dragged.
  //
  // ⚠️ **WHAT IS HERE AND WHAT IS NOT, AND THE LINE IS THE OWNER'S:** Pattern, Strength, Detail, Drift, the
  // style-3 zoom trio and the zoom-centre pair are per-LAYER, so they are here, and the measured readout comes
  // with them because a chain's second separable layer can be measured nowhere else. The wave TERMS are not —
  // they are one table shared by every layer in the chain, so a per-layer term editor would be a control that
  // silently edits every other layer. `Pattern` is this tab's only field-shape surface, exactly as the
  // instruction says ("limited to select one of the style presets in the dropdown in the Visual Fx tab").
  //
  // ⚠️ **`⟳ Random pattern` is NOT restored.** It was retired with §H, it is not a setting, and the Transmap
  // tab's Reset/Reapply pair replaced it. Re-adding it is a design change, not part of this restoration.
  //
  // ⚠️ **THE COPY IS DELIBERATELY NOT THE TRANSMAP TAB'S COPY, AND THAT IS NOT DUPLICATION.** That tab's
  // tooltips point at "the terms below" and "the line at the bottom of the tab"; neither exists here, and
  // reusing those strings would make every one of them describe a control that is not on screen — invariant
  // 25's shape. Two true sentences about one control, each in its own place; the SHARED thing is the
  // measurement function and the tracks, which are imported rather than restated.

  /** Marker classes, so `updateStaticRows` never has to query by input type. See `buildLayerRow`. */
  private static readonly SF_MARKERS = {
    pattern: 'sl-vfx-sf-pattern',
    strength: 'sl-vfx-sf-strength',
    detail: 'sl-vfx-sf-detail',
    /** The Detail ROW, not its input — hidden wholesale on the `(Preset)` path where `detail` is inert. */
    detailRow: 'sl-vfx-sf-detail-row',
    drift: 'sl-vfx-sf-drift',
    pattern2: 'sl-vfx-sf-pattern2',
    strength2: 'sl-vfx-sf-strength2',
    zoomBias: 'sl-vfx-sf-zoombias',
    /**
     * ⚠️ **§J's notice, and it had to come back WITH the controls.** `Zoom Pattern` and `Zoom Bias` are read by
     * the engine on the archetype branch only — the `!arch` branch of `resolveStaticWaves` takes the zoom half
     * from the second wave table and calls `buildZoomWave` with the bias **hardcoded to 1**. The restoration
     * put both controls back live in BOTH regimes, which is invariant 25's exact shape: a control describing a
     * pass that never ran. Disabled rather than hidden, because these two have stored values the engine
     * ignores and a hidden control cannot say so. One test owns the two `disabled` flags and this sentence.
     */
    zoomInert: 'sl-vfx-sf-zoominert',
    /**
     * The warp wave shape (`35.4`), and style 3's zoom half's.
     *
     * ⚠️ **The dropdowns are BUILT FROM `WARP_SHAPES`** — see `staticShapeSelect`. ⚠️ **Neither shape row is
     * regime-gated**, unlike `detailRow` above: `35.D2` decision 1 keeps the shape live on `(Preset)` too,
     * which is the OPPOSITE of `detail`'s treatment and is a decision rather than an oversight.
     */
    shape: 'sl-vfx-sf-shape',
    shapeMix: 'sl-vfx-sf-shapemix',
    shape2: 'sl-vfx-sf-shape2',
    shapeMix2: 'sl-vfx-sf-shapemix2',
    /**
     * The four wave ORIENTATIONS (`35.4`) — two per row, and **four markers because the resync writes four
     * handles**. A pair sharing one marker class would make `updateStaticRows`' `querySelector` find the
     * first cell twice and leave the second showing the previous preset's angle.
     *
     * ⚠️ **Not regime-gated and not style-gated either**, unlike `detailRow` and the zoom trio: all four
     * separable styles read `angleX`/`angleY`, and the zoom pair comes and goes with the style-3 block it
     * is built inside.
     */
    angleX: 'sl-vfx-sf-anglex',
    angleY: 'sl-vfx-sf-angley',
    angleX2: 'sl-vfx-sf-anglex2',
    angleY2: 'sl-vfx-sf-angley2',
    centreX: 'sl-vfx-sf-centrex',
    centreY: 'sl-vfx-sf-centrey',
    /** The MEASURED field readout — the one row here that states a number the panel cannot otherwise show. */
    readout: 'sl-vfx-sf-readout',
  } as const;

  /**
   * The marker class for one wave-shape notice, **DERIVED from the key rather than enumerated** — the layer
   * bodies are created and destroyed as layers come and go, so a notice needs a class per key and a second
   * hand-written list of five class names is the thing `35.4` exists not to add.
   */
  private static shapeNoticeClass(k: ShapeNoticeKey): string {
    return `sl-vfx-sf-notice-${k.toLowerCase()}`;
  }

  /**
   * Write one static-field field on a layer and push the chain, without rebuilding the rows.
   *
   * ⚠️ **A slider edit must NOT touch `pattern`, and an earlier version of this method flipped it to
   * `(Custom)`.** That was a data-loss bug, not a labelling choice: `(Custom)` is not a shape. It has no
   * archetype, so `findArchetype()` returns undefined for it and `resolveStaticWaves` takes its `!arch`
   * branch — straight back to the preset's own `sinMagicParams`. Measured: `(Custom)` produces a field
   * byte-identical to `(Preset)`. So picking `Diagonal Shear` and then moving Strength silently threw the
   * archetype away and rendered the preset's original table, which is exactly how it was reported.
   *
   * ⚠️ **The premise was also wrong on its own terms.** The flip existed because a slider was assumed to move
   * the field OFF the archetype's values, the way the Flow dropdown works. It does not: `strength` and
   * `detail` are inputs the archetype is evaluated WITH, not overrides of what it contains — measured, peak
   * displacement scales exactly 3.00x from strength 0.3 to 0.9 on an unchanged `Diagonal Shear`. The name
   * still describes the shape at every slider setting, so there is nothing to invalidate.
   *
   * ⚠️ **`fieldcheck` §G asserts this property over BOTH tabs since 2026-09-23.** Its negated regex was
   * pointed at `transmap.ts` alone while this file had no `setStaticField`, and a negated assertion about a
   * file is satisfied vacuously by the function not being there — so restoring the function here without
   * widening that clause would have restored the hazard and kept the green.
   */
  private setStaticField(index: number, patch: Partial<typeof STATIC_FIELD_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.staticField = { ...staticFieldOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /** A labelled range that reads and writes one `staticField` scalar. */
  private staticSlider(
    index: number,
    marker: string,
    label: string,
    opts: {
      min: number; max: number; step: number; decimals?: number; title: string;
      /**
       * Optional non-linear track. `fromPos` maps the handle position to the stored VALUE and `toPos` is its
       * inverse, used to place the handle when the value arrives from a preset rather than from a drag.
       *
       * ⚠️ **Both or neither** — a `fromPos` without its inverse would place the handle at the raw value on
       * every preset load, i.e. a control that silently disagrees with the number beside it. The pair is the
       * same shape the descriptor registry's `toPos`/`fromPos` uses (Figure Scale, Particle Number), and
       * `updateStaticRows` must apply `toPos` for any marker that has one.
       */
      map?: { toPos: (v: number) => number; fromPos: (pos: number) => number };
    },
    get: (s: typeof STATIC_FIELD_DEFAULTS) => number,
    set: (v: number) => Partial<typeof STATIC_FIELD_DEFAULTS>,
  ): HTMLElement {
    const chain = this.controls.getTransMapChain();
    const initial = get(staticFieldOf(chain[index]));
    const dec = opts.decimals ?? 2;
    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(opts.map ? opts.map.toPos(initial) : initial);
    input.className = `sl-vfx-slider ${marker}`;
    input.title = opts.title;
    input.setAttribute('aria-label', label);
    const val = document.createElement('span');
    val.className = `sl-vfx-value ${marker}-val`;
    val.textContent = initial.toFixed(dec);
    input.addEventListener('input', () => {
      const pos = parseFloat(input.value);
      const v = opts.map ? opts.map.fromPos(pos) : pos;
      val.textContent = v.toFixed(dec);
      this.setStaticField(index, set(v));
      // ⚠️ **The measured readout in this same body has to follow the drag**, or it states the field the row
      // was built with and contradicts the handle immediately above it. Refreshed in place: a `syncLayerRows()`
      // here would rebuild the row and destroy the slider under the pointer.
      const row = this.layerRows[index];
      if (!row) return;
      const readout = row.querySelector<HTMLElement>(`.${VisualFxTab.SF_MARKERS.readout}`);
      const live = this.controls.getTransMapChain()[index];
      if (readout && live) this.updateStaticReadout(readout, live);
      /*
       * ⚠️ **AND THE REGIME/NOTICE GATES, BECAUSE A `Shape Mix` DRAG IS WHAT TURNS THE `mixZero` NOTICE OFF**
       * (`35.4`). Without this call the line *“Shape mix is 0 — the field is still Sine”* would stay on screen
       * for the whole drag that disproves it — invariant 13's readout form, and the one place the notice could
       * have been built, gated and still be wrong. `applyStaticRegimeGates` is idempotent and writes no
       * VALUES, so calling it mid-drag cannot disturb the handle under the pointer.
       */
      if (live) this.applyStaticRegimeGates(row, live);
    });
    wrap.appendChild(input);
    wrap.appendChild(val);
    return this.makeRow(label, wrap);
  }

  /**
   * **One `Angle` row for a static-field layer: TWO captioned sliders, X and Y** (`35.4`).
   *
   * ⚠️⚠️ **ONE ROW WITH TWO CELLS, NEVER TWO ROWS**, and the reason is not layout: the two angles are one
   * quantity in two halves, because every degenerate configuration the notices warn about (parallel, ±90,
   * style 2's exact cancellation) is a property of the PAIR. Two rows would read as two unrelated
   * orientations. `transmap.ts` carries the same row for the same reason — **this is the second of the two
   * editors, which is the whole trap `35.4` was written around** (`32.15`'s finding verbatim: adding an
   * operator is a two-file edit, and Phase 32 did only one).
   *
   * ⚠️ **`min`/`max` are POSITIONS (±1)** — `WAVE_ANGLE_TRACK` is linear, so the only things it buys are
   * that convention and the quantiser, and it is `WAVE_ANGLE_MAX`'s only reader in `src/`. A VALUE bound
   * here would be read as a position and clamp the travel to a ninetieth of itself.
   *
   * ⚠️ **`set` FIRST, then re-read the engine's answer into BOTH the readout and the thumb** — `32.14`'s
   * repair. `fromPos` rounds to whole degrees, so a handler that formatted the dragged number would print a
   * fraction of a degree nothing stored. The readout and the gates are refreshed in place for
   * `staticSlider`'s reason: a `syncLayerRows()` here would destroy the slider under the pointer.
   */
  private staticAnglePair(
    index: number,
    markers: readonly [string, string],
    label: string,
    title: string,
    get: (s: typeof STATIC_FIELD_DEFAULTS) => readonly [number, number],
    set: (cell: 0 | 1, v: number) => Partial<typeof STATIC_FIELD_DEFAULTS>,
  ): HTMLElement {
    const initial = get(staticFieldOf(this.controls.getTransMapChain()[index]));
    const pair = document.createElement('div');
    pair.className = 'sl-vfx-triplet';
    const fmt = (v: number): string => `${Math.round(v)}°`;
    for (let c = 0; c < 2; c++) {
      const cell = c as 0 | 1;
      const marker = markers[cell];
      const box = document.createElement('div');
      box.className = 'sl-vfx-triplet-cell';
      const cap = document.createElement('span');
      cap.className = 'sl-vfx-triplet-caption';
      cap.textContent = cell === 0 ? 'X' : 'Y';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '-1';
      input.max = '1';
      input.step = String(WAVE_ANGLE_STEP);
      input.className = `sl-vfx-slider ${marker}`;
      input.title = title;
      // ⚠️ **The per-cell accessible name, because the ROW label says only "Angle"** and `makeRow` names
      // only the FIRST input it finds. *Phase 17*: no `data-testid`, ever — select on the `aria-label`, so
      // an unnamed cell is unreachable for the suite and for `capture-ui.mjs`' `setControl`.
      input.setAttribute('aria-label', `${label} ${cap.textContent}`);
      input.value = String(WAVE_ANGLE_TRACK.toPos(initial[cell]));
      const val = document.createElement('span');
      val.className = `sl-vfx-triplet-value ${marker}-val`;
      val.textContent = fmt(initial[cell]);
      input.addEventListener('input', () => {
        const v = WAVE_ANGLE_TRACK.fromPos(parseFloat(input.value));
        this.setStaticField(index, set(cell, v));
        const now = get(staticFieldOf(this.controls.getTransMapChain()[index]))[cell];
        val.textContent = fmt(now);
        const pos = String(WAVE_ANGLE_TRACK.toPos(now));
        if (input.value !== pos) input.value = pos;
        const row = this.layerRows[index];
        if (!row) return;
        const readout = row.querySelector<HTMLElement>(`.${VisualFxTab.SF_MARKERS.readout}`);
        const live = this.controls.getTransMapChain()[index];
        if (readout && live) this.updateStaticReadout(readout, live);
        // ⚠️ **AND THE NOTICE GATES, because an angle drag is what turns `wavesParallel` and `wavesCancel`
        // ON AND OFF** — without this call the lines would appear only after some unrelated structural
        // event, which is invariant 13's readout form in the one place the notice could have been built,
        // gated and still be wrong. `applyStaticRegimeGates` writes no VALUES, so it cannot disturb the
        // handle under the pointer.
        if (live) this.applyStaticRegimeGates(row, live);
      });
      box.appendChild(cap);
      box.appendChild(input);
      box.appendChild(val);
      pair.appendChild(box);
    }
    return this.makeRow(label, pair);
  }

  /** A pattern dropdown for `pattern` or `pattern2`. */
  private staticPatternSelect(index: number, marker: string, second: boolean): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = `sl-vfx-select ${marker}`;
    sel.setAttribute('aria-label', second ? 'Zoom Pattern' : 'Pattern');
    // `(Custom)` is offered so the dropdown can DISPLAY it, but picking it is meaningless — it resolves as
    // `(Preset)` for shape purposes. Disabled as an option rather than omitted, or assigning the live value
    // would silently fall back to the first entry and re-shape the field on every sync.
    for (const name of patternNames()) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (name === PATTERN_CUSTOM) o.disabled = true;
      sel.appendChild(o);
    }
    const s0 = staticFieldOf(this.controls.getTransMapChain()[index]);
    sel.value = second ? s0.pattern2 : s0.pattern;
    sel.title = second
      ? 'Shape of the ZOOM half of Zoom Combined. (Preset) uses the preset’s own second wave table, which is '
        + 'edited in the Transmap tab.'
      : 'Field shape for this layer. (Preset) uses the preset’s own wave table — the default, what every '
        + 'shipped preset renders with, and the thing the Transmap tab edits. A named pattern takes over and '
        + 're-solves its own size on every canvas.';
    sel.addEventListener('change', () => {
      this.setStaticField(index, second ? { pattern2: sel.value } : { pattern: sel.value });
      // A shape change is not a drag, so a full row refresh is safe — and it is REQUIRED, because the Detail
      // row's visibility depends on whether an archetype is now in effect.
      this.syncLayerRows();
    });
    return sel;
  }

  /**
   * A wave-shape dropdown for `shape` or `shape2` — **BUILT FROM `WARP_SHAPES`, labels from
   * `WARP_SHAPE_LABELS`.**
   *
   * ⚠️⚠️ **NEVER A HAND-WRITTEN OPTION LIST, AND THAT IS THE PHASE'S ONE-WAY `tsc` GAP:**
   * `Record<WarpShape, …>` makes `tsc` force an entry for a new union member; `readonly WarpShape[]` makes it
   * force **nothing**, and the dropdown reads the array. A sixth shape added to the union and both `Record`s
   * compiles clean while the picker offers one option fewer. ⚠️ **This file is the SECOND of the two editors
   * and that is the trap `35.4` was written around** — `32.15`'s finding verbatim: adding an operator is a
   * two-file edit and Phase 32 did only one, so a row added to the Transmap tab alone leaves the shape
   * unreachable from here. **The source-text clause asserting both dropdowns read the array belongs in
   * `shapecheck` §B and is reported as OWED.**
   *
   * ⚠️ **The copy is this tab's own, not the Transmap tab's** — the same rule the static-field block's header
   * states: that tab's tips point at "the terms below", which do not exist here, so reusing them would make
   * every one describe a control that is not on screen (invariant 25). The SHARED thing is `SHAPE_NOTICES`
   * and the predicate, which are imported.
   */
  private staticShapeSelect(index: number, marker: string, second: boolean): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = `sl-vfx-select ${marker}`;
    sel.setAttribute('aria-label', second ? 'Zoom Shape' : 'Shape');
    for (const name of WARP_SHAPES) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = WARP_SHAPE_LABELS[name];
      sel.appendChild(o);
    }
    const s0 = staticFieldOf(this.controls.getTransMapChain()[index]);
    sel.value = second ? s0.shape2 : s0.shape;
    sel.title = second
      ? 'Wave shape for the ZOOM half of Zoom Combined. It is built by a separate pass, so it can carry a '
        + 'different shape from the shift half. ⚠️ Inert until Zoom Shape Mix is above 0.'
      : 'The wave the field is built from. Sine is every shipped preset; Square and Sawtooth cut the image '
        + 'rather than bending it. ⚠️ Inert until Shape Mix is above 0 — the two are separate on purpose, '
        + 'and unlike Detail this applies on (Preset) too.';
    sel.addEventListener('change', () => {
      const shape = sel.value as (typeof WARP_SHAPES)[number];
      this.setStaticField(index, second ? { shape2: shape } : { shape });
      // A shape pick changes which notices apply, and it is not a drag, so a full refresh is safe. It goes
      // through `syncLayerRows()` for `staticPatternSelect`'s reason: one owner of the row state.
      this.syncLayerRows();
    });
    return sel;
  }

  /**
   * The notice paragraphs for one half of the shape set.
   *
   * ⚠️⚠️ **`mixZero` IS WHY `35.4` EXISTS.** `shapeMix: 0` and `shape: 'sine'` are BOTH the identity by
   * decision (`35.D2`), so a user who picks a shape and leaves the mix at 0 sees **nothing** — the phase's
   * most likely first-use confusion, and this line is the whole fix. **Do not couple the two fields instead.**
   *
   * ⚠️ **Text written ONCE from `SHAPE_NOTICES` and only `display` ever moves** — the `INLINE_SINK` rule
   * (`tipcheck` matches a literal after `=`, so a ternary-assigned string is invisible to it). ⚠️ **The
   * wordings AND the discontinuity test have ONE owner in `field-measure.ts`**, which is also the Transmap
   * tab's, so the two editors cannot say different things about one field. `WARP_SHAPE_DISCONTINUOUS` is the
   * single source for "is this shape discontinuous" — **never a second hand-typed list.**
   */
  private buildStaticShapeNotices(keys: readonly ShapeNoticeKey[]): HTMLElement[] {
    return keys.map(k => {
      const p = document.createElement('p');
      p.className = `sl-tab-desc ${VisualFxTab.shapeNoticeClass(k)}`;
      p.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
      p.textContent = SHAPE_NOTICES[k];
      p.style.display = 'none';
      return p;
    });
  }

  /**
   * The body of a styles-0-3 layer row.
   *
   * ⚠️ **The expander must not open an empty box** (invariant 13), which is why `buildLayerRow`'s `hasBody`
   * includes styles 0-3.
   *
   * Which controls appear is decided by STYLE, not by showing everything and hoping:
   *   - style 0 has no zoom centre — it is a pure shift, so a centre control would move nothing.
   *   - styles 1-3 take a centre; absent means "inherit the preset's shared `zoomCenter`".
   *   - style 3 alone has the second table, so it alone gets Zoom Pattern / Zoom Strength / Zoom Bias.
   */
  private buildStaticFieldBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-sf-body';
    const M = VisualFxTab.SF_MARKERS;
    const style = layer.style;

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'Pattern replaces the preset’s own wave table with a shape. ⚠️ On (Preset) the field is '
      + 'only as live as that table — which is shared by every layer and edited in the Transmap tab.';
    body.appendChild(hint);

    body.appendChild(this.makeRow('Pattern', this.staticPatternSelect(index, M.pattern, false)));

    /*
     * ⚠️ **The shape pair sits with Pattern, which is the Transmap tab's placement too** — a shape is a
     * shape, not an amount. ⚠️ **Neither row is regime-gated** (`35.D2` decision 1 keeps the shape live on
     * `(Preset)`), which is the OPPOSITE of the Detail row below; the asymmetry is a decision and
     * `applyStaticRegimeGates` deliberately does not touch these two.
     */
    body.appendChild(this.makeRow('Shape', this.staticShapeSelect(index, M.shape, false)));
    body.appendChild(this.staticSlider(index, M.shapeMix, 'Shape Mix',
      {
        min: 0, max: 1, step: 0.01,
        title: 'How much of Shape is blended into the plain sine wave: 0 is pure Sine whatever Shape says, '
          + '1 is the shape alone. Strength re-solves itself as you move it, so the warp keeps its measured '
          + 'size — except on Macrolense and Distant Lense, which carry their own amplitudes and skip that '
          + 'step.',
      },
      s => s.shapeMix, v => ({ shapeMix: v })));

    /*
     * ⚠️ **The orientation pair, beside Pattern and Shape rather than in with the sizes** — the Transmap
     * tab's placement, so the two editors present one order. ⚠️ **Not gated**: all four separable styles
     * read these two, and the notices below are the whole of the remedy for a degenerate pair (`35.D2`
     * forbids clamping or refusing one).
     */
    body.appendChild(this.staticAnglePair(index, [M.angleX, M.angleY], 'Angle',
      'Which direction each wave runs in, in degrees. At 0 and 0 they are at right angles, the way every '
      + 'shipped preset is built; turning them apart tilts the lattice, and turning them together gives '
      + 'stripes in one direction only. ⚠️ The range is ±90 because +120° is the same field as −60° with '
      + 'the amplitudes flipped.',
      s => [s.angleX, s.angleY],
      (cell, v) => (cell === 0 ? { angleX: v } : { angleY: v })));

    for (const el of this.buildStaticShapeNotices(SHIFT_SHAPE_NOTICES)) body.appendChild(el);

    // ⚠️ **The VALUE bounds are not on this row — they are inside `STATIC_FIELD_STRENGTH_TRACK`** (2026-09-25,
    // the sitting that reversed 21.13 and took the ceiling to 16). `min`/`max` here are the ±1 POSITION of a
    // mapped signed track. `Strength` has been SIGNED since 2026-09-22 — 0 is the dead centre and the negative
    // half draws the same field inverted — and a `min: 0` restored from the pre-split backup would still
    // silently remove half the range on this copy only, with the Transmap tab's copy reaching it: `trackcheck`
    // §M counts the rows in `transmap.ts` alone, so nothing would report it. **Import the track, never restate
    // the curve**: the two tabs' four handles are one control in four places.
    body.appendChild(this.staticSlider(index, M.strength, 'Strength',
      {
        min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP, map: STATIC_FIELD_STRENGTH_TRACK,
        title: 'Peak displacement of this layer. On a pattern: a fraction of 8% of the smaller frame '
          + 'dimension, so the same amount in every style. On (Preset): a relative gain on the preset’s own '
          + 'amplitudes, where 0.5 is the authored field unchanged. 0 is the dead centre, not an end stop — '
          + 'below it the same field is inverted at the same size. Quartic track: the small end gets most of '
          + 'the travel, so the ±16 ends cost nothing where presets actually sit.',
      },
      s => s.strength, v => ({ strength: v })));

    // ⚠️ **The Detail ROW carries a marker class so `updateStaticRows` can HIDE it on the `(Preset)` path.**
    // `detail` multiplies the archetype's frequencies, and a preset's authored frequencies are not a shape
    // defined up to scale — see the `!arch` branch in `resolveStaticWaves` for why scaling them would replace
    // the figure rather than refine it. Hidden rather than left visible-but-inert, which is invariant 13.
    const detailRow = this.staticSlider(index, M.detail, 'Detail',
      {
        min: STATIC_FIELD_DETAIL_MIN, max: STATIC_FIELD_DETAIL_MAX, step: STATIC_FIELD_DETAIL_STEP,
        title: 'Frequency multiplier — how fine the pattern is, without changing its size. 1.0 is the '
          + 'pattern’s own frequencies. Hidden while Pattern is (Preset): the preset’s frequencies encode '
          + 'exact whole-number ratios, so scaling them would replace the figure rather than refine it.',
      },
      s => s.detail, v => ({ detail: v }));
    detailRow.classList.add(M.detailRow);
    body.appendChild(detailRow);

    body.appendChild(this.staticSlider(index, M.drift, 'Drift',
      {
        min: 0, max: 1, step: 0.005, map: DRIFT_TRACK,
        title: 'Drift speed, in pattern cells per second at Animation Speed 1x (0.25 = one cell every 4 s). '
          + '0 — the default, and every shipped preset — is a fixed lattice. It moves the field rigidly, so '
          + 'the shape and the size never change. Squared track: the slow end gets most of the travel.',
      },
      s => s.drift, v => ({ drift: v })));

    if (style === 3) {
      body.appendChild(this.subTitle('Zoom half'));
      body.appendChild(this.makeRow('Zoom Pattern', this.staticPatternSelect(index, M.pattern2, true)));
      body.appendChild(this.staticSlider(index, M.strength2, 'Zoom Strength',
        {
          // The same track OBJECT as Strength above — see that row's note.
          min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP, map: STATIC_FIELD_STRENGTH_TRACK,
          title: 'Size of the zoom half only, on the same scale as Strength. The shift half keeps its own, so '
            + 'the two are balanced against each other here — and opposite signs make them oppose rather '
            + 'than reinforce.',
        },
        s => s.strength2, v => ({ strength2: v })));
      body.appendChild(this.staticSlider(index, M.zoomBias, 'Zoom Bias',
        {
          min: -0.5, max: 0.5, step: 0.01,
          title: 'Constant added to the zoom wave — a steady push in or out under the oscillation. ⚠️ Read '
            + 'only while a pattern is picked; on (Preset) the engine holds it at a fixed value.',
        },
        s => s.zoomBias, v => ({ zoomBias: v })));
      // ⚠️ **Built unconditionally and toggled by `display`, never assembled per regime** — the `INLINE_SINK`
      // rule's reason: text set once in one place, visibility the only thing that moves. `updateStaticRows`
      // owns the gate, so this element is never shown without both controls being disabled.
      const zoomInert = document.createElement('p');
      zoomInert.className = `sl-tab-desc ${M.zoomInert}`;
      zoomInert.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
      // ⚠️ TWO sentences, which is `tipcheck` §I's ceiling for inline copy — the first draft was three and it
      // failed. The stored-values clause is the one that had to fold in, because it is the reason these two are
      // greyed rather than hidden; "Zoom Strength still reads" stays its own sentence, being the exemption.
      zoomInert.textContent = 'Pattern and Bias above are greyed because Pattern is (Preset): the engine builds '
        + 'the zoom half from the preset’s second wave table and holds the bias fixed, so their stored values '
        + 'are shown and kept but not read. Zoom Strength still reads.';
      body.appendChild(zoomInert);

      /*
       * ⚠️⚠️ **THE ZOOM HALF NEEDS ITS OWN PAIR BECAUSE IT IS A SEPARATE FUNCTION**, not a second parameter
       * pair on one: `shape2`/`shapeMix2` drive `buildZoomWave`, which carries a DC bias term `buildWave`
       * does not have. **Crossing the two pairs is silent.**
       *
       * ⚠️ **Appended BELOW the inert notice on purpose** — that notice says "Pattern and Bias *above*", so
       * inserting rows between it and the two controls it names would make its own word wrong. ⚠️ And these
       * two are in `Zoom Strength`'s class, NOT `Zoom Pattern`'s: they are read on both branches, so
       * `applyStaticRegimeGates` must not add them to the `zoomInert` disabled pair.
       */
      body.appendChild(this.makeRow('Zoom Shape', this.staticShapeSelect(index, M.shape2, true)));
      body.appendChild(this.staticSlider(index, M.shapeMix2, 'Zoom Shape Mix',
        {
          min: 0, max: 1, step: 0.01,
          title: 'How much of Zoom Shape is blended into the zoom half’s sine wave: 0 is pure Sine whatever '
            + 'Zoom Shape says. Independent of the shift half’s Shape Mix, so one half can be shaped and the '
            + 'other left smooth.',
        },
        s => s.shapeMix2, v => ({ shapeMix2: v })));

      /*
       * ⚠️ **`angleX2`/`angleY2` are a THIRD and FOURTH angle, not a second reading of the first pair** —
       * `waveMaps()` builds four index mappings and `buildZoomWave` must get the zoom ones; crossing the two
       * pairs is as silent as crossing the shape pairs. ⚠️ **No notice for this pair** — a stated bound, see
       * `SHIFT_SHAPE_NOTICES`' header: style 3 keeps the shift half as an additive term, so a parallel zoom
       * pair is one-directional and cannot make the field vanish.
       */
      body.appendChild(this.staticAnglePair(index, [M.angleX2, M.angleY2], 'Zoom Angle',
        'The same pair for the zoom half, which is built by a separate pass and can run at its own '
        + 'orientation. Leaving these at 0 while the shift angles turn is a legitimate field: the zoom keeps '
        + 'its lattice square while the shift half tilts.',
        s => [s.angleX2, s.angleY2],
        (cell, v) => (cell === 0 ? { angleX2: v } : { angleY2: v })));

      for (const el of this.buildStaticShapeNotices(ZOOM_SHAPE_NOTICES)) body.appendChild(el);
    }

    if (style !== 0) {
      // ⚠️ Styles 1-3 only. Style 0 adds the wave as a PIXEL SHIFT with no centre term at all, so a centre
      // control there would be three pixels of UI that move nothing.
      body.appendChild(this.subTitle('Zoom centre'));
      const centreHint = document.createElement('p');
      centreHint.className = 'sl-tab-desc';
      centreHint.style.cssText = 'margin:0 0 4px 0;font-size:10px;';
      centreHint.textContent = 'Per-layer, in percent of the frame. Untouched, the layer inherits the preset’s own zoom centre.';
      body.appendChild(centreHint);
      body.appendChild(this.staticCentreSlider(index, M.centreX, 'Centre X', 'x'));
      body.appendChild(this.staticCentreSlider(index, M.centreY, 'Centre Y', 'y'));
    }

    // ⚠️ **THE MEASURED READOUT, LAST so it describes every control above it — the centre included**, which for
    // styles 1-3 is part of the field's geometry and therefore part of what gets measured. The hint at the top
    // of this body WARNS that `(Preset)` is only as live as the preset's own table; this states how live, in
    // pixels. That is the difference between a caveat and an answer.
    //
    // ⚠️ **It is the only place a chain's SECOND separable layer can be measured at all** — the Transmap tab
    // measures the layer it is editing, so before this existed a two-layer chain had one unmeasurable half.
    const readout = document.createElement('p');
    readout.className = `sl-tab-desc ${M.readout}`;
    readout.style.cssText = 'margin:4px 0 0 0;font-size:10px;opacity:0.85;';
    body.appendChild(readout);
    this.updateStaticReadout(readout, layer);

    /*
     * ⚠️ **THE BUILDER APPLIES ITS OWN REGIME GATES, AND THIS LINE IS THE FIX FOR A REPORTED DEFECT (2026-09-23):
     * the Detail slider showed on a `(Preset)` `Zoom Overlay` layer in THIS tab while the Transmap tab correctly
     * hid it, and dragging it did nothing** — all three halves of the report being one cause.
     *
     * Every row above is appended unconditionally, which is `INLINE_SINK`'s rule and is right: structure and text
     * written once, only `display` moving. But that left the two regime gates — `Detail`'s visibility and §J's
     * zoom trio — living in `updateStaticRows()` alone, and that method is reached from `updateLayerRow()` only,
     * i.e. from `syncLayerRows()`' SAME-SHAPE branch. **Every path that REBUILDS bypassed it**: the first render,
     * the expander toggle, `commitChain` (add / remove / restyle a layer) and a preset whose chain shape differs.
     * Hence the intermittence that makes this kind of report hard to read — load a preset over an equal-shaped
     * chain and the gates were right; open the expander and they were gone.
     *
     * ⚠️ **The remedy is ONE OWNER reached from both paths, not a second call site.** A `updateStaticRows()` call
     * bolted onto `buildLayerRow` would have fixed the symptom while leaving the gates reachable only from a
     * method the builder does not have to call — the same shape the defect had. `applyStaticRegimeGates()` is now
     * the single owner and the builder calls it directly, so a body cannot exist ungated.
     */
    this.applyStaticRegimeGates(body, layer);

    return body;
  }

  /**
   * The REGIME gates for one styles-0-3 body: what is on screen, and what is greyed, given the pattern.
   *
   * ⚠️ **ONE OWNER, TWO CALLERS, AND THAT IS THE POINT** (invariant 17's shape, and see the defect written up in
   * `buildStaticFieldBody`): `buildStaticFieldBody` calls it so a freshly built body is never ungated, and
   * `updateStaticRows` calls it so a pattern change re-gates. Both pass a root the markers live UNDER — the body
   * itself at build time, the whole row afterwards — which works because every query below is a descendant
   * lookup and every marker is inside the body.
   *
   * ⚠️ **VALUES ARE NOT WRITTEN HERE.** The builder fills each control from the chain as it creates it and
   * `updateStaticRows` re-reads them; folding that in would make one of those two a second write of one number.
   * This method decides visibility and `disabled` only — the properties whose omission is invisible.
   */
  private applyStaticRegimeGates(root: HTMLElement, layer: TransMapLayer): void {
    const M = VisualFxTab.SF_MARKERS;
    // Detail is inert unless an ARCHETYPE is in effect. Tested with `findArchetype`, not against the
    // `(Preset)`/`(Custom)` literals, for the same reason `randomize.ts` does: `resolveStaticWaves` sends
    // `(Custom)` and any unknown name from a hand-edited import down the same preset-table branch, so
    // comparing to the two names would be a narrower enumeration of the same question — and the one that
    // disagrees with the engine is the one nothing reports.
    const arch = findArchetype(staticFieldOf(layer).pattern);
    const detailRow = root.querySelector<HTMLElement>(`.${M.detailRow}`);
    if (detailRow) detailRow.style.display = arch ? '' : 'none';
    // ⚠️ **§J, and it is the Transmap tab's gate re-derived here rather than a second rule.** `Zoom Pattern` and
    // `Zoom Bias` are read on the archetype branch ONLY: `resolveStaticWaves`' `!arch` branch builds the zoom
    // half from the second wave table and passes a hardcoded bias of 1. The engine defect stays (honouring the
    // stored bias would move 23 of the 25 style-3 presets, which `21.D1` forbids), so the controls declare it.
    // ONE binding drives both `disabled` flags and the sentence — invariant 25: the description owns the gate.
    // Disabled, not hidden: both have stored values, and a hidden control cannot say they are ignored.
    const zoomInert = layer.style === 3 && !arch;
    const p2 = root.querySelector<HTMLSelectElement>(`.${M.pattern2}`);
    if (p2) p2.disabled = zoomInert;
    const bias = root.querySelector<HTMLInputElement>(`.${M.zoomBias}`);
    if (bias) bias.disabled = zoomInert;
    const zoomNote = root.querySelector<HTMLElement>(`.${M.zoomInert}`);
    if (zoomNote) zoomNote.style.display = zoomInert ? '' : 'none';
    /*
     * ⚠️ **The wave-shape notices, and this is the one gate owner for them** — reached from the builder, from
     * `updateStaticRows` and from a `Shape Mix` DRAG (see `staticSlider`). ⚠️ **ALL the keys are iterated, not
     * only the ones that apply**: showing the applicable set alone would leave a stale notice lit forever,
     * and a warning nothing ever hides is worse than a missing one.
     *
     * ⚠️ **ONE predicate, in `field-measure.ts`, shared with the Transmap tab** — and it reads
     * `WARP_SHAPE_DISCONTINUOUS` for the tear test, never a second hand-typed list. ⚠️ **The two SHAPE rows
     * themselves are deliberately NOT gated here**: `35.D2` decision 1 keeps the shape live in both regimes.
     */
    const on = new Set(shapeNoticeKeys(layer));
    for (const k of [...SHIFT_SHAPE_NOTICES, ...ZOOM_SHAPE_NOTICES]) {
      const el = root.querySelector<HTMLElement>(`.${VisualFxTab.shapeNoticeClass(k)}`);
      if (el) el.style.display = on.has(k) ? '' : 'none';
    }
  }

  /**
   * Write the measured field readout for one styles-0-3 layer.
   *
   * ⚠️ **THREE calls into `field-measure.ts` AND NOTHING ELSE — the arithmetic and the wording are both that
   * module's.** The pre-split version of this method carried its own 64x64 scan and its own three-way
   * 0-px message, and a second copy of either is a copy that drifts: the two tabs would print different
   * numbers, or different sentences, for one field. `fieldcheck` and `trackcheck` §M both measure through
   * that module, so a local transcription would also be a figure no checker could see.
   *
   * ⚠️ **Called on chain change, never per frame.** Invariant 8 is about allocation RATE, and a 64x64 scan that
   * crept into `drawFrame` would reach the user as a periodic jitter rather than as a slow panel.
   */
  private updateStaticReadout(el: HTMLElement, layer: TransMapLayer): void {
    const { table1, table2 } = this.controls.getTransMapWaveTables();
    const { width, height } = this.controls.getFrameSize();
    const { cx, cy } = fieldCentre(layer, this.controls.getTransMapZoomCenterX(),
      this.controls.getTransMapZoomCenterY(), width, height);
    const m = measureStaticField(layer, table1, table2, width, height, cx, cy);
    // A null measurement is a degenerate canvas (a hidden tab, a zero-height window mid-drag), and
    // `describeStaticField` answers it with an empty string rather than `NaN%`.
    el.textContent = describeStaticField(m, layer, table1, table2);
  }

  /**
   * A zoom-centre slider. Separate from `staticSlider` because the centre lives on `layer.zoomCenter`, not
   * in `staticField`, and ABSENT is a meaningful third state (inherit the preset's).
   *
   * Touching either axis materialises both, since `zoomCenter` is a pair — and its presence is what
   * `isLegacyExpressible()` reads to decide the chain must be serialised, so a half-written pair would
   * export a centre with one axis defaulted.
   */
  private staticCentreSlider(index: number, marker: string, label: string, axis: 'x' | 'y'): HTMLElement {
    const chain = this.controls.getTransMapChain();
    const layer = chain[index];
    const fallback = axis === 'x' ? this.controls.getTransMapZoomCenterX() : this.controls.getTransMapZoomCenterY();
    const initial = layer?.zoomCenter ? layer.zoomCenter[axis] : fallback;
    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0'; input.max = '100'; input.step = '1';
    input.value = String(initial);
    input.className = `sl-vfx-slider ${marker}`;
    input.title = 'Where this layer’s zoom pushes away from, in percent of the frame. Wave Shift ignores it '
      + 'entirely. Touching either axis fixes both for this layer, which otherwise follows the preset’s own centre.';
    input.setAttribute('aria-label', label);
    const val = document.createElement('span');
    val.className = `sl-vfx-value ${marker}-val`;
    val.textContent = `${Math.round(initial)}%`;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = `${Math.round(v)}%`;
      const c = this.controls.getTransMapChain();
      const entry = c[index];
      if (!entry) return;
      const other = axis === 'x' ? 'y' : 'x';
      const otherVal = entry.zoomCenter
        ? entry.zoomCenter[other]
        : (other === 'x' ? this.controls.getTransMapZoomCenterX() : this.controls.getTransMapZoomCenterY());
      entry.zoomCenter = axis === 'x' ? { x: v, y: otherVal } : { x: otherVal, y: v };
      this.controls.setTransMapChain(c);
      // The centre is part of the field's geometry, so the readout below it has to follow — in place, for the
      // same reason the scalar sliders do.
      const row = this.layerRows[index];
      const readout = row?.querySelector<HTMLElement>(`.${VisualFxTab.SF_MARKERS.readout}`);
      if (readout) this.updateStaticReadout(readout, entry);
    });
    wrap.appendChild(input);
    wrap.appendChild(val);
    return this.makeRow(label, wrap);
  }

  /**
   * Re-read a row's static-field controls from the chain.
   *
   * Queried by MARKER CLASS for the same reason `updateLayerRow` is: a row can also contain a moved-in
   * shared panel full of ranges. A missing marker is not an error — style 0 has no centre rows and only
   * style 3 has the second pair, so every lookup is optional by design.
   */
  private updateStaticRows(row: HTMLElement, layer: TransMapLayer): void {
    // By metadata, not `style > 3` — the same implicit enumeration `buildChainPlan` shed in Step 14.0.
    if (!isSeparableStyle(layer.style)) return;
    const s = staticFieldOf(layer);
    const M = VisualFxTab.SF_MARKERS;
    const setSel = (cls: string, v: string): void => {
      const el = row.querySelector<HTMLSelectElement>(`.${cls}`);
      if (el) el.value = v;
    };
    // `toPos` is the handle POSITION and is separate from the value the label shows — on a mapped track the
    // two are different numbers, and passing the raw value as both is how a handle ends up disagreeing with
    // the figure printed next to it (invariant 13's readout form).
    const setRange = (
      cls: string, v: number, fmt: (n: number) => string, toPos?: (n: number) => number,
    ): void => {
      const el = row.querySelector<HTMLInputElement>(`.${cls}`);
      if (el) el.value = String(toPos ? toPos(v) : v);
      const lbl = row.querySelector<HTMLElement>(`.${cls}-val`);
      if (lbl) lbl.textContent = fmt(v);
    };
    const f2 = (n: number): string => n.toFixed(2);
    setSel(M.pattern, s.pattern);
    // ⚠️ **Both Strength rows became MAPPED on 2026-09-25 and so both need `toPos` here** — the resync is the
    // only direction that places a handle from a stored value, so a missed `toPos` is silent on every drag and
    // wrong on every preset load: 0.5 would be read as a POSITION and park the handle at 87% of the track.
    setRange(M.strength, s.strength, f2, STATIC_FIELD_STRENGTH_TRACK.toPos);
    setRange(M.detail, s.detail, f2);
    setRange(M.drift, s.drift, f2, DRIFT_TRACK.toPos);

    // ⚠️ **Both shape pairs resync here or a preset load leaves the dropdown showing the PREVIOUS preset's
    // shape over the new preset's field** — and `staticFieldOf()` resolves an absent field to `'sine'`, which
    // is `WARP_SHAPES[0]` and therefore always an option, so there is no unmatched-value case to guard.
    setSel(M.shape, s.shape);
    setRange(M.shapeMix, s.shapeMix, f2);

    setSel(M.pattern2, s.pattern2);
    setRange(M.strength2, s.strength2, f2, STATIC_FIELD_STRENGTH_TRACK.toPos);
    setRange(M.zoomBias, s.zoomBias, f2);
    setSel(M.shape2, s.shape2);
    setRange(M.shapeMix2, s.shapeMix2, f2);

    /*
     * ⚠️ **ALL FOUR ANGLES RESYNC, EACH WITH `toPos`, OR A PRESET LOAD LEAVES THE HANDLE WHERE THE PREVIOUS
     * PRESET PUT IT** — the resync is the only direction that places a handle from a stored value, so a
     * missed row here is silent on every drag and wrong on every load. ⚠️ And a missed `toPos` is worse than
     * a missed row: a stored 28 would be written as a POSITION, which the element clamps to 1, parking the
     * handle at 90° with the label beside it still reading 28°.
     */
    const deg = (n: number): string => `${Math.round(n)}°`;
    setRange(M.angleX, s.angleX, deg, WAVE_ANGLE_TRACK.toPos);
    setRange(M.angleY, s.angleY, deg, WAVE_ANGLE_TRACK.toPos);
    setRange(M.angleX2, s.angleX2, deg, WAVE_ANGLE_TRACK.toPos);
    setRange(M.angleY2, s.angleY2, deg, WAVE_ANGLE_TRACK.toPos);
    // ⚠️ **The two regime gates are NOT re-derived here** — `applyStaticRegimeGates` owns them, and the builder
    // calls the same method so a fresh row cannot be ungated. That split is the 2026-09-23 fix; the write-up of
    // what a second copy of these tests cost is in `buildStaticFieldBody`.
    this.applyStaticRegimeGates(row, layer);
    const cx = layer.zoomCenter?.x ?? this.controls.getTransMapZoomCenterX();
    const cy = layer.zoomCenter?.y ?? this.controls.getTransMapZoomCenterY();
    const pct = (n: number): string => `${Math.round(n)}%`;
    setRange(M.centreX, cx, pct);
    setRange(M.centreY, cy, pct);
    // ⚠️ **The readout must be refreshed HERE and not only at build time**, or it states the field the row was
    // CREATED with and then contradicts every slider above it — invariant 13's readout form, and the worse half
    // of it: a stale number reads as authoritative. This method is the row's one re-read path (a preset change,
    // a `syncLayerRows` and an edit made in the Transmap tab all arrive through it), so one call covers them.
    const readout = row.querySelector<HTMLElement>(`.${M.readout}`);
    if (readout) this.updateStaticReadout(readout, layer);
  }

  // ---- per-layer Density Refraction (style 7) and Band Split (style 9) ---------------------------
  //
  // Tier 2, exactly like the static-field body above and for the same reason: these controls come and go
  // with their layer, so there is no fixed descriptor key to register. Every handler RE-READS the chain
  // (the G11 hazard) and none calls `commitChain` (it would destroy the slider under the pointer).

  private static readonly RF_MARKERS = {
    strength: 'sl-vfx-rf-strength',
    reach: 'sl-vfx-rf-reach',
    invert: 'sl-vfx-rf-invert',
    source: 'sl-vfx-rf-source',
  } as const;

  private static readonly BS_MARKERS = {
    amount: 'sl-vfx-bs-amount',
    radius: 'sl-vfx-bs-radius',
  } as const;

  /** Style 8 (Time Warp). */
  private static readonly TW_MARKERS = {
    amount: 'sl-vfx-tw-amount',
    source: 'sl-vfx-tw-source',
  } as const;

  /** Style 10 (Vortex). `centreX/Y` are normalised UV here, unlike the static body's PERCENT `zoomCenter`. */
  /**
   * v8 `30.4` — the conformal body's own marker classes. ⚠️ **ITS OWN SET rather than borrowing the
   * vortex's**, for the reason every other body here has one: `tipcheck` and the Phase 17 specs select
   * on these, so two bodies sharing a class cannot be told apart by any DOM instrument.
   */
  private static readonly CF_MARKERS = {
    map: 'sl-vfx-cf-map',
    power: 'sl-vfx-cf-power',
    centreX: 'sl-vfx-cf-cx',
    centreY: 'sl-vfx-cf-cy',
    mobius: 'sl-vfx-cf-mobius',
  } as const;

  private static readonly VX_MARKERS = {
    swirl: 'sl-vfx-vx-swirl',
    radius: 'sl-vfx-vx-radius',
    centreX: 'sl-vfx-vx-cx',
    centreY: 'sl-vfx-vx-cy',
    falloff: 'sl-vfx-vx-falloff',
  } as const;

  /** Style 11 (Depth Parallax). */
  private static readonly PX_MARKERS = {
    amount: 'sl-vfx-px-amount',
    near: 'sl-vfx-px-near',
    far: 'sl-vfx-px-far',
    curve: 'sl-vfx-px-curve',
    range: 'sl-vfx-px-range',
    rangeFrom: 'sl-vfx-px-from',
    rangeTo: 'sl-vfx-px-to',
    manualRow: 'sl-vfx-px-manual',
  } as const;

  /**
   * Write one field of a layer's `refraction` block and push the chain, without rebuilding the rows.
   *
   * ⚠️ **Writes the FULL resolved block, not just the touched key.** `refractionOf()` fills every default on
   * read, so writing a partial `{ strength }` would leave the other three absent — and `isLegacyExpressible`
   * keys the whole chain's serialisation on the block's PRESENCE, so a partial write exports a layer whose
   * remaining values silently come from whatever the defaults are at import time. The static-field body
   * resolves-then-spreads for the same reason.
   */
  private setRefraction(index: number, patch: Partial<typeof REFRACTION_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.refraction = { ...refractionOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /** Write one field of a layer's `bandSplit` block. See `setRefraction` for why the block is written whole. */
  private setBandSplit(index: number, patch: Partial<typeof BAND_SPLIT_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.bandSplit = { ...bandSplitOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /** Write one field of a layer's `timeWarp` block. See `setRefraction` for why the block is written whole. */
  private setTimeWarp(index: number, patch: Partial<typeof TIME_WARP_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.timeWarp = { ...timeWarpOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /**
   * Write one field of a layer's `vortex` block. See `setRefraction` for why the block is written whole.
   *
   * ⚠️ **Resolving through `vortexOf()` is what makes the `zoomCenter` inheritance survive the first edit.** An
   * absent `centre` falls back to the layer's `zoomCenter`, so a user who set a zoom centre and then added a
   * vortex sees the eye they were already looking at — but the moment ANY field is written, the block becomes
   * present and the fallback stops applying. Writing the resolved block pins the inherited centre; writing a
   * partial `{ swirl }` would silently snap the eye back to (0.5, 0.5) on the first touch of the swirl slider.
   */
  private setVortex(index: number, patch: Partial<ReturnType<typeof vortexOf>>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.vortex = { ...vortexOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /** Write one field of a layer's `parallax` block. See `setRefraction` for why the block is written whole. */
  private setParallax(index: number, patch: Partial<typeof PARALLAX_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.parallax = { ...parallaxOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /** A labelled range writing one scalar of a per-layer block. The generic form of `staticSlider`. */
  private layerSlider(
    marker: string,
    label: string,
    initial: number,
    opts: { min: number; max: number; step: number; decimals?: number; title: string; suffix?: string },
    onInput: (v: number) => void,
  ): HTMLElement {
    const dec = opts.decimals ?? 2;
    const fmt = (n: number): string => `${n.toFixed(dec)}${opts.suffix ?? ''}`;
    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(initial);
    input.className = `sl-vfx-slider ${marker}`;
    input.title = opts.title;
    const val = document.createElement('span');
    val.className = `sl-vfx-value ${marker}-val`;
    val.textContent = fmt(initial);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      onInput(v);
    });
    wrap.appendChild(input);
    wrap.appendChild(val);
    return this.makeRow(label, wrap);
  }

  /** The body of a style-7 layer row. */
  private buildRefractionBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-rf-body';
    const M = VisualFxTab.RF_MARKERS;
    const r = refractionOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    // No PRECONDITION to state — style 7 warps unconditionally, so this line keeps only the one property that
    // distinguishes it from every other style, which is what a user choosing a style needs. The rest is on the
    // sliders. (It is not a tooltip on the Style dropdown because that list is DERIVED from
    // `TRANS_MAP_STYLES` — a per-style description there would be a fourth hand-written enumeration.)
    hint.textContent = 'Refracts around the figure itself, so empty space stays perfectly still.';
    body.appendChild(hint);

    body.appendChild(this.layerSlider(M.strength, 'Refract', r.strength,
      {
        min: 0, max: 1, step: 0.01,
        title: 'Peak displacement, as a fraction of 8% of the smaller frame dimension — the same unit as a '
          + 'static layer’s Strength, so it means the same amount at any resolution and in a preview tile.',
      },
      v => this.setRefraction(index, { strength: v })));

    body.appendChild(this.layerSlider(M.reach, 'Reach', r.reach,
      {
        min: 0.5, max: 8, step: 0.1, decimals: 1, suffix: ' px',
        title: 'Gradient sample distance, in pixels of the full-resolution frame. Small reads the fine strand '
          + 'edges as sharp lens rims; large reads the whole knot as one soft, glassy mass.',
      },
      v => this.setRefraction(index, { reach: v })));

    const invert = document.createElement('input');
    invert.type = 'checkbox';
    invert.className = `sl-vfx-check ${M.invert}`;
    invert.checked = r.invert;
    invert.title = 'Displace TOWARD density instead of away — pinch rather than bulge, so the figure reads as '
      + 'collapsing into its own mass.';
    invert.addEventListener('change', () => this.setRefraction(index, { invert: invert.checked }));
    body.appendChild(this.makeRow('Invert', invert));

    const source = document.createElement('select');
    source.className = `sl-vfx-select ${M.source}`;
    /*
     * ⚠⚠ **v8 `32.8` ADDED THREE BLUR OPTIONS HERE AND `32.12` REMOVED THEM** on the owner's visual
     * review: *"not visible and therefore not adding value at all"*. **The validated read-back below
     * SURVIVES them deliberately** — see its own comment.
     */
    for (const [v, label] of [
      ['density', 'Density (coverage)'], ['luminance', 'Luminance (brightness)'],
    ] as const) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      source.appendChild(o);
    }
    source.value = r.source;
    source.title = 'What the height field is read from. Density follows accumulated coverage; Luminance follows '
      + 'the bright core, which on a palette-mapped preset travels along the ramp as the figure animates.';
    source.addEventListener('change', () => {
      /*
       * ⚠⚠ **A VALIDATED LOOKUP, NOT A TERNARY, AND THIS SITE IS WHY THE SHADER'S `Record` IS NOT
       * ENOUGH.** The old read was `source.value === 'luminance' ? 'luminance' : 'density'` — so adding
       * options to the list above would have changed the stored word for none of them and silently written
       * `density` instead. **The same defect as `E126`'s source read, in the UI layer, where no shader-side
       * map can see it.**
       *
       * ⚠⚠ **IT SURVIVED THE BLUR OPTIONS' REMOVAL (`32.12`) ON PURPOSE.** With two members a ternary
       * would work again, and reverting would restore the latent defect for whoever adds the next member.
       * **A fix whose value is only visible when the list grows must not be undone when it shrinks** —
       * the same reasoning kept `REFRACT_SOURCE_CODE` a `Record`.
       */
      const want = source.value;
      const valid = ['density', 'luminance'] as const;
      const picked = valid.find(v => v === want) ?? 'density';
      this.setRefraction(index, { source: picked });
    });
    body.appendChild(this.makeRow('Source', source));

    return body;
  }

  /**
   * The body of a WEIGHTLESS layer row — dispatched on the style, because there are three of them.
   *
   * ⚠️ **The `default` is a real branch, not a fallback for tidiness.** `isWeightless()` is derived from
   * `TRANS_MAP_STYLES`, so adding a `weightless` entry to that table immediately routes a row here — and
   * before this dispatcher existed, that row silently got BAND SPLIT's sliders. The note below is what a
   * fourth weightless style sees until someone writes its body, which is honest rather than wrong.
   */
  private buildWeightlessBody(index: number, layer: TransMapLayer): HTMLElement {
    switch (layer.style) {
      case 8: return this.buildTimeWarpBody(index, layer);
      case 9: return this.buildModifierBody(index, layer);
      case 11: return this.buildParallaxBody(index, layer);
      default: {
        const box = document.createElement('p');
        box.className = 'sl-tab-desc';
        box.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
        box.textContent = 'This modifier has no editable settings yet.';
        return box;
      }
    }
  }

  /**
   * The body of a style-8 (Time Warp) layer row.
   *
   * ⚠️ Its `amount` is a LERP toward the previous frame's warped result, so `historyPrimed` means the first
   * frame after any chain edit shows no lag at all rather than one frame of the OLD chain's warp. The slider
   * therefore looks momentarily dead on the frame you add the layer; that is the priming, not a dead control.
   *
   * ⚠️ **SECOND-ORDER: it lags motion, it does not create any, so its output is bounded by how much consecutive
   * frames DIFFER — and on a fixed lattice over a slow figure that is nearly nothing.** An EMA at amount 0.95
   * with field weight 0.9 averages over ~6.9 frames, so the smear is `per-frame image displacement × 6.9`.
   * Measured at a 300 px rim: `Quader` (`Rotation [0,0.2,0.3]`, 0.3 °/s → 0.026 px/frame) gives **0.18 px** —
   * correctly invisible, and reported as *"does not do anything to Quader"*. `Bermuda Twister` 0.60 px,
   * `Cylinder` 1.81 px, and `Rose` — 30 °/s, the ONE preset in the library fast enough, 10× the next — 18.1 px.
   * ⚠️ **The other driver is `staticField.drift`, which is 0 on all 177 presets**, so the warp recomputes an
   * IDENTICAL offset every frame and the history matches the current frame by construction. Raising Drift to
   * 0.25–0.5 cells/s gives ~3.6–7.2 px of smear on any preset, which is the controllable demonstration.
   *
   * ⚠️ **BUT THE `Rose` FIGURE ABOVE IS WRONG, AND THE WAY IT IS WRONG IS THE REAL TRAP: under the default
   * `source: 'field'` THIS STYLE'S OWN WEIGHT IS DERIVED FROM THE FIELD IT MODIFIES**, via
   * `raw = length(off) * uResolution.y; w = raw / (1.0 + raw)`. So a zero field gives `w == 0` and the blend is
   * byte-identical to absent at ANY amount — not "0.18 px", exactly nothing. ⚠️ **`Rose`'s field is an EXACT
   * IDENTITY** — both of its wave tables are all zeros, and it is also one of the 60 with `TransMapFilter:
   * false` — and `migration.ts` already records what that means: styles 0–3 "render exactly as if TransMap were
   * switched off". So the preset picked for having the fastest rotation was one that could not respond at all,
   * and BOTH of its preconditions were off.
   *
   * ⚠️ **`Rose` is NOT the only one, and the earlier "1 of 177" here was measuring the wrong thing.** Two
   * legacy presets resolve to a 0 px field (measured at 1920×1080): `Rose`, and `Penta Star System`, whose
   * table is visibly full of numbers but carries every live amplitude at **frequency 0** (`sin(0) · amp ≡ 0`).
   * Three presets have an all-zero `SinMagicParams` and only one of those is inert, because `Subspace` and
   * `The Real Black Hole` are style 3 and their zoom half is live. The predicate that matters is the measured
   * peak, which is why the Static Field readout prints one — see `updateStaticReadout`. **Recommending it cost a second
   * failed retest**; the user localised it by switching the pattern from `(Preset)` to `Vertical Ripple`, which
   * is what first produced a non-zero `off`. ⚠️ **Check that a MODIFIER's driver is non-zero, not merely that
   * the driver EXISTS** — `isInertModifier` tests for a field layer's PRESENCE, and a present layer with a
   * zero-amplitude table passes it. A `(Preset)` pattern is only as live as the preset's own table.
   * `source: 'density'` is the escape, since `raw = fragColor.a` reads trail coverage instead.
   *
   * **Judge this style on a preset with a NON-ZERO field table, on `source: 'density'`, or with Drift raised —
   * never on a still figure, and never on `Rose` at `(Preset)`.**
   */
  private buildTimeWarpBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-tw-body';
    const M = VisualFxTab.TW_MARKERS;
    const t = timeWarpOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    // ⚠️ The PRECONDITIONS stay inline, per `tooltips.ts`'s rule: a hover is discovered only by someone who
    // already suspects the control, which is not the person who has concluded the feature is broken. All three
    // of these drew "no visible effect" reports. The mechanism explanation is now the tooltips.
    hint.textContent = 'Lags the warp behind the motion, per pixel. ⚠️ Needs all three: Enable ticked, a field '
      + 'that is actually non-zero (or Source: Density), and visible motion between frames — raise Drift or '
      + 'use a fast preset.';
    body.appendChild(hint);

    body.appendChild(this.layerSlider(M.amount, 'Time Warp', t.amount,
      {
        min: 0, max: 0.95, step: 0.01,
        title: '0 is byte-identical to no layer. High values approach a persistent smear — the lag compounds '
          + 'frame over frame, so past about 0.8 the figure reads as being dragged through syrup.',
      },
      v => this.setTimeWarp(index, { amount: v })));

    /*
     * v8 `30.5` (`E126`) — the source picker, **THREE members since the coordinate source shipped.**
     *
     * ⚠️ **THE OPTION LIST AND THE CHANGE HANDLER WERE BOTH A TWO-MEMBER HARD-CODE, AND THAT MADE A BUILT
     * ENGINE FEATURE UNREACHABLE** (owner report, 2026-10-22): the list named two options and the handler
     * was `value === 'density' ? 'density' : 'field'`, which silently maps anything else to `'field'`.
     * **That is the same ternary-over-a-union shape `30.5` removed from the uniform upload, in the UI
     * instead** — and it is the third place this phase found it. `TIME_WARP_SOURCES` is now the one list,
     * and the handler validates against it rather than guessing.
     */
    const source = document.createElement('select');
    source.className = `sl-vfx-select ${M.source}`;
    for (const [v, label] of TIME_WARP_SOURCES) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      source.appendChild(o);
    }
    source.value = t.source;
    source.title = 'What decides where the lag is strong. Field lags most where the chain displaces most, so '
      + 'the effect differentiates within a single frame. Density lags the dense core and leaves sparse arcs '
      + 'crisp — the inverse of a global blur. Coordinate ignores the picture entirely and lags by WHERE a '
      + 'pixel is, which is the slit-scan: one side of the frame shows a smeared past and the other shows now.';
    source.addEventListener('change', () => {
      // Validate against the one list rather than testing for one member and defaulting the rest.
      const picked = TIME_WARP_SOURCES.find(([v]) => v === source.value)?.[0] ?? 'field';
      this.setTimeWarp(index, { source: picked });
      this.rebuildLayerRows();   // the two rows below are only meaningful under `coordinate`
    });
    body.appendChild(this.makeRow('Source', source));

    /*
     * ⚠️ **SHOWN ONLY UNDER `coordinate`, and built rather than hidden**, because the layer body is rebuilt
     * on every chain edit anyway — so there is no stale-row problem of the kind `syncVisibility()` exists
     * to solve. The values stay in the block either way; this is a visibility decision, not a gate.
     */
    if (t.source === 'coordinate') {
      const axis = document.createElement('select');
      axis.className = `sl-vfx-select ${M.source}`;
      for (const [v, label] of TIME_WARP_AXES) {
        const o = document.createElement('option');
        o.value = v; o.textContent = label;
        axis.appendChild(o);
      }
      axis.value = t.axis;
      axis.title = 'Which direction the lag ramps along. Across and Down give the classic slit-scan shear — '
        + 'one edge of the frame showing a smeared past, the other showing now. Radial lags by distance from '
        + 'the centre instead, so the figure trails its own halo.';
      axis.addEventListener('change', () => {
        const picked = TIME_WARP_AXES.find(([v]) => v === axis.value)?.[0] ?? 'x';
        this.setTimeWarp(index, { axis: picked });
      });
      body.appendChild(this.makeRow('Axis', axis));

      body.appendChild(this.layerSlider(M.source, 'Lag Bias', t.bias,
        {
          min: -1, max: 1, step: 0.01,
          title: 'Which END of the axis lags hardest. 0 is the plain ramp — the far end smeared, the near end '
            + 'crisp. Negative mirrors it. The amount of lag is Time Warp above; this only decides which way '
            + 'round the gradient runs.',
        },
        v => this.setTimeWarp(index, { bias: v })));
    }

    return body;
  }

  /**
   * The body of a style-11 (Depth Parallax) layer row.
   *
   * ⚠️ **`nearScale` and `farScale` are MULTIPLIERS on the summed chain offset, not displacements**, so the row
   * has no pixel units. Equal values are exactly no parallax whatever `amount` says, which is why the defaults
   * are deliberately unequal.
   *
   * ⚠️ **BUT "THE SPREAD IS THE EFFECT" IS WRONG, AND IT WAS TOLD TO THE USER THAT WAY.** The pair encodes TWO
   * INDEPENDENT QUANTITIES against the fixed reference `1.0 = the warp with no parallax layer`: the DIFFERENCE
   * sets depth separation, the LEVEL sets overall warp strength. Measured at amount 1 — `Near 0/Far 0.4` gives
   * near ×0.00 / far ×0.40, while `Near 0.4/Far 0.8` gives ×0.40 / ×0.80: identical spread, **~2× the total
   * warp**, and only the second leaves the front moving. Asked directly (*"does it make a difference if Near = 0
   * and Far = 0.4 vs Near = 0.4 and Far = 0.8, same difference?"*) — it does, and describing a two-parameter
   * control by one derived statistic is what hid that. **Say what each value multiplies, not what their
   * relationship implies.**
   *
   * ⚠️ **`Near 0` READS AS INVERTED WITHOUT BEING INVERTED, so a report of "near ones have the biggest effect"
   * at `Near 0 / Far max` CONFIRMS the convention rather than falsifying it.** A multiplier of 0 pins the near
   * strands perfectly still against a violently warping background, and total suppression is more conspicuous
   * than exaggeration — so the near field dominates attention while receiving the least displacement. Verified
   * numerically end-to-end rather than from any comment (the phase plan has one direction backwards): generator
   * `z = −1400` → `depths 0.033` (LOW = near) → this pass writes `1 − aDepth` = `0.967` (HIGH = near) →
   * `mix(uParallaxFar, uParallaxNear, 0.967)` selects NEAR. At `Near 0/Far 3`: near ×0.099, far ×2.901. ⚠️ **Do
   * not "fix" the direction on such a report — reproduce it at a MODERATE ratio first** (`Near 2.0 / Far 0.5`),
   * because a ×0-vs-×3 extreme is perceptually ambiguous by construction. ⚠️ **And empty background reads as
   * `Far`** (the depth target clears to 0 = far, per invariant 24), so a high `Far` mostly amplifies the
   * BACKGROUND, which is a second reason the extreme misreads.
   *
   * ⚠️ **THE THREE MODIFIERS' PRECONDITIONS DIFFER IN STRENGTH, AND `isInertModifier` STATES ONLY THE WEAKEST
   * ONE.** It tests a field layer's PRESENCE (`requiresField` + `chain.some(isFieldStyle)`), which is the whole
   * story for style 9 and NOT for the other two — so its *"needs a warp layer"* note is true but insufficient,
   * and a row can satisfy it and still be arithmetically incapable of any output:
   *
   * | style | actual precondition | escape when the field is zero |
   * |---|---|---|
   * | 9 Band Split | a field layer exists | — (it recomposes; nothing to recompose) |
   * | 8 Time Warp | a field of NON-ZERO magnitude, on `source: 'field'` | **yes** — `source: 'density'` reads `fragColor.a` |
   * | 11 Depth Parallax | a field of NON-ZERO magnitude | **NONE — it is a pure multiplier on the offset sum** |
   *
   * ⚠️ **AND ITS SECOND PRECONDITION IS THE FIGURE'S DEPTH SPAN, WHICH THE LIBRARY LARGELY DOES NOT HAVE.**
   * `depths` is normalised over `canvasW + canvasH`, not over the figure, so a legacy figure lands in a thin
   * band around 0.5. Measured across all 177 legacy presets (widest span over t ∈ {0,5,20,60,120} s at
   * 1000×800): median **0.304**, 22 flat throughout — and only **65 of 177** non-flat at the OPENING pose,
   * because `Rotation` is what tilts a planar figure into depth. `Aurora Borealis` spans **0.20** (figure
   * texels 0.43/0.54/0.63), so at `Near 0.5/Far 2.0` its whole figure sits between ×1.06 and ×1.36 while the
   * background — 78 % of the pixels — sits at ×2.00. Reported as *"for `Aurora Borealis` looks like everything
   * is far"*, which is **accurate about the frame and wrong only about the figure** (uniformly mid, not far).
   * Full table and the reasoning: `post-processors/depth-field.ts` class header.
   *
   * Style 11 is the strictest of the three: `off = (sOff + … + vOff) * uMix * edgeFade * parallax`, so with no
   * field the sum is 0 and every multiplier is 0. There is no source switch to route around it. Reported as
   * *"tried to apply it to `Aurora Borealis`, playing with the sliders had no visible effect, it was again the
   * only transmap set"* — the user inferred the missing field layer unaided, from the `Rose` case one step
   * earlier. ⚠️ **Do not "unify" these into one note**: the strictness is a property of each operator's
   * arithmetic, and collapsing them would restore the under-statement this table exists to correct.
   */
  private buildParallaxBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-px-body';
    const M = VisualFxTab.PX_MARKERS;
    const p = parallaxOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    // ⚠️ The PRECONDITIONS stay inline (see `tooltips.ts`) and are all this line keeps: the style MULTIPLIES,
    // so all four are silent exact no-ops and two of them drew "no visible effect" reports. What the style
    // DOES, the Near/Far arithmetic and the depth-span advice are tooltips on the controls themselves — this
    // paragraph used to repeat the first of those, which is the clutter the tooltip pass exists to remove.
    hint.textContent = 'Scales the warp by how NEAR each pixel is. ⚠️ It multiplies, so it needs a warp layer '
      + 'present, Near ≠ Far, and a figure with some depth span — set Depth Range to Figure if it is narrow.';
    body.appendChild(hint);

    body.appendChild(this.layerSlider(M.amount, 'Parallax', p.amount,
      {
        min: 0, max: 1, step: 0.01,
        title: '0 is byte-identical to no layer — the multiplier is a lerp from 1, so nothing is scaled until '
          + 'this moves. 1 applies the near/far pair in full.',
      },
      v => this.setParallax(index, { amount: v })));

    body.appendChild(this.layerSlider(M.near, 'Near', p.nearScale,
      {
        min: 0, max: 3, step: 0.05,
        title: 'Displacement multiplier for the closest pixels — 1.0 is exactly the warp you get with no '
          + 'parallax layer, so below 1 attenuates and above 1 overshoots. The DIFFERENCE from Far sets how '
          + 'much depth separation you see; the LEVEL of the pair sets the overall warp strength. Those are '
          + 'independent: Near 0/Far 0.4 and Near 0.4/Far 0.8 share a spread but the second warps ~2x as much. '
          + 'Equal values mean no parallax at any amount. At 0 the near strands are pinned perfectly still, '
          + 'which is conspicuous but is suppression, not parallax.',
      },
      v => this.setParallax(index, { nearScale: v })));

    body.appendChild(this.layerSlider(M.far, 'Far', p.farScale,
      {
        min: 0, max: 3, step: 0.05,
        title: 'Displacement multiplier for the most distant pixels, on the same 1.0 = unchanged scale as Near. '
          + 'At 0 the far side of the figure holds perfectly still while the near side sweeps — the strongest '
          + 'reading of the effect. ⚠️ EMPTY BACKGROUND reads as Far too (the depth buffer clears to "far"), so '
          + 'a high Far amplifies the background rather than the figure.',
      },
      v => this.setParallax(index, { farScale: v })));

    const curve = document.createElement('select');
    curve.className = `sl-vfx-select ${M.curve}`;
    for (const [v, label] of [['linear', 'Linear'], ['squared', 'Squared (near-biased)']] as const) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      curve.appendChild(o);
    }
    curve.value = p.curve;
    curve.title = 'How depth maps onto the multiplier. Linear spreads the effect evenly through the scene; '
      + 'Squared concentrates it in the nearest layer, so most of the figure holds and only the front sweeps.';
    curve.addEventListener('change', () => {
      this.setParallax(index, { curve: curve.value === 'squared' ? 'squared' : 'linear' });
    });
    body.appendChild(this.makeRow('Curve', curve));

    // `Depth Range` — what the 0..1 scale is measured against. See the doc header: this is the control that
    // makes the style work on the ~93 legacy presets whose figure occupies a thin slice of a canvas-normalised
    // scale (median near:far ratio 1.30x raw against 4.00x fitted).
    const range = document.createElement('select');
    range.className = `sl-vfx-select ${M.range}`;
    for (const [v, label] of [
      ['figure', 'Figure (auto-fit)'],
      ['canvas', 'Canvas (raw)'],
      ['manual', 'Manual'],
    ] as const) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      range.appendChild(o);
    }
    range.value = p.depthRange;
    range.title = 'What "near" and "far" are measured against. The raw depth scale is normalised over the '
      + 'CANVAS (width + height), not over your figure, so a legacy figure usually occupies only a thin band '
      + 'around the middle and Near/Far cannot open it up — they scale the whole interval at once. '
      + 'Figure (auto-fit) measures the figure\'s own depth extent each frame and stretches it to the full '
      + 'scale: measured over the 93 narrow-but-not-flat legacy presets, that lifts the median near:far ratio '
      + 'from 1.30x to 4.00x. Canvas (raw) is the unfitted scale. Manual pins a fixed band, which auto-fit '
      + 'deliberately cannot do — use it to hold a frame of reference while the figure turns, to exaggerate '
      + 'past the figure\'s real depth, or to isolate a slab.';
    range.addEventListener('change', () => {
      const v = range.value === 'canvas' ? 'canvas' : range.value === 'manual' ? 'manual' : 'figure';
      this.setParallax(index, { depthRange: v });
      syncManual(v);
    });
    body.appendChild(this.makeRow('Depth Range', range));

    // The manual band. ⚠️ Built ALWAYS and hidden by mode, never built conditionally: `display: none` is what
    // the rest of this tab uses for the same job, and a conditionally-built row would need the layer rows
    // rebuilt on a mode change — which `setParallax` deliberately does not do (it pushes the chain without
    // rebuilding, so a drag does not lose focus).
    const manual = document.createElement('div');
    manual.className = M.manualRow;
    manual.appendChild(this.layerSlider(M.rangeFrom, 'From', p.rangeFrom,
      {
        min: 0, max: 1, step: 0.01,
        title: 'Start of the manual band, on the RAW depth scale (0 = far, 1 = near). Only used when Depth '
          + 'Range is Manual. Set From and To inside the figure\'s own extent to isolate a slab and let the '
          + 'rest hold still; set them wider to exaggerate. From above To is accepted and means the same band.',
      },
      v => this.setParallax(index, { rangeFrom: v })));
    manual.appendChild(this.layerSlider(M.rangeTo, 'To', p.rangeTo,
      {
        min: 0, max: 1, step: 0.01,
        title: 'End of the manual band, same raw 0 = far / 1 = near scale as From. ⚠️ Equal to From is a '
          + 'degenerate band and falls back to the raw scale rather than amplifying float noise.',
      },
      v => this.setParallax(index, { rangeTo: v })));
    body.appendChild(manual);

    const syncManual = (mode: string): void => {
      manual.style.display = mode === 'manual' ? '' : 'none';
    };
    syncManual(p.depthRange);

    return body;
  }

  /**
   * The body of a style-10 (Vortex) layer row — a FIELD style, so it keeps its weight slider and this is an
   * ordinary owned body, not a weightless one.
   *
   * ⚠️ **`radius` is NORMALISED (fractions of `min(w,h)`), not pixels** — decide by UNIT, not by field name.
   * The refraction `reach` and band `radius` sliders above are in texels and a preview tile scales them by
   * `SCREEN_SPACE_TILE_SCALE`; this one must NOT be scaled, or the eye would change size with the tile.
   */
  /**
   * v8 `30.4` — write one field of a layer's `conformal` block. See `setVortex` for why the block is
   * written whole and resolved through its `*Of()` helper: that is what makes the `zoomCenter` inheritance
   * survive the first edit.
   */
  private setConformal(index: number, patch: Partial<ReturnType<typeof conformalOf>>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[index];
    if (!entry) return;
    entry.conformal = { ...conformalOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
    if (this.pipelineReadout) this.pipelineReadout.textContent = this.controls.getTransMapPipelineDescription();
  }

  /**
   * v8 `30.4` (`E125`) — the body of a style-12 (Conformal) layer row.
   *
   * ⚠️ **WRITTEN 2026-10-22, AFTER THE STYLE SHIPPED WITHOUT IT.** The engine, the config, the shader and
   * the export gate were all built and verified through demo presets — which write the values straight
   * into preset data and therefore never exercise a control. **The style was addable and unconfigurable.**
   * *A checker cannot hold a UI to its purpose, only a user can.*
   *
   * ⚠️ **The rows shown depend on the MAP, because the four members take different parameters** — `power`
   * needs an exponent, Möbius needs six, and `inverse`/`logPolar` need none. The body is rebuilt on every
   * chain edit, so switching the map re-renders the rows rather than hiding stale ones.
   */
  private buildConformalBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-vx-body';
    const M = VisualFxTab.CF_MARKERS;
    const c = conformalOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'Angle-preserving distortion: straight features bow into arcs while local shapes stay '
      + 'un-sheared, which is why it reads as lawful rather than as the picture being pushed around. '
      + '⚠️ Angles are preserved at layer weight 1 only — below that the displacement is partial.';
    body.appendChild(hint);

    const map = document.createElement('select');
    map.className = `sl-vfx-select ${M.map}`;
    for (const [v, label] of CONFORMAL_MAPS) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      map.appendChild(o);
    }
    map.value = c.map;
    map.title = 'Which complex function warps the frame. Power blooms it into n petals. Inverse turns it '
      + 'inside out through a circle — safe here because this is the image, not the figure. Log-polar gives '
      + 'the self-similar spiral recession and is the one member with a deliberate seam. Mobius is the '
      + 'general case: it can inflate one region like a lens while the far field squeezes to a point.';
    map.addEventListener('change', () => {
      const picked = CONFORMAL_MAPS.find(([v]) => v === map.value)?.[0] ?? 'power';
      this.setConformal(index, { map: picked });
      this.rebuildLayerRows();
    });
    // ⚠️ **`Function`, NOT `Map` — renamed 2026-10-22 after the owner reported picking the wrong row.**
    // The dye's own mapping row is also labelled `Map` and is visible in the same tab, so two unrelated
    // dropdowns shared one word. **A label is an address when two controls are on screen together.**
    body.appendChild(this.makeRow('Function', map));

    if (c.map === 'power') {
      // ⚠️ INTEGER ONLY (30.D16): a fractional exponent puts a branch cut along one ray, i.e. a hard radial
      // discontinuity in a warp whose whole selling point is smoothness. `step: 1` is that constraint.
      body.appendChild(this.layerSlider(M.power, 'Petals', c.power,
        {
          min: 2, max: 8, step: 1,
          title: 'The exponent of z^n, and the number of lobes the frame blooms into. Whole numbers only — '
            + 'a fractional exponent would tear the image along one ray.',
        },
        v => this.setConformal(index, { power: Math.round(v) })));
    }

    if (c.map === 'mobius') {
      /*
       * ⚠️ **SIX SCALARS IN TWO ROWS, AND `d` IS NORMALISED TO 1** (`30.D7`). Scaling all four Möbius
       * parameters leaves the map unchanged, so the raw eight-scalar form lets two different settings
       * produce one image — which makes the Mixer and the Randomiser waste moves on duplicates.
       *
       * ⚠️ **TWO `tripletRow`s rather than three pairs, because there is no two-up row widget in this
       * codebase** — the census found `makeRow`, `tripletRow` and `rgbRow` and nothing else. Grouping by
       * PART (all three real components, then all three imaginary) is what makes a shipped widget fit.
       */
      const mb = c.mobius;
      body.appendChild(this.tripletRow('Mobius Re', {
        key: 'conformalMobiusRe', min: -2, max: 2, step: 0.01,
        captions: ['a', 'b', 'c'],
        get: () => [mb.aRe, mb.bRe, mb.cRe],
        set: (ax, v) => this.setConformal(index, {
          mobius: { ...mb, ...(ax === 0 ? { aRe: v } : ax === 1 ? { bRe: v } : { cRe: v }) },
        }),
        fmt: (v) => v.toFixed(2),
        title: 'The REAL parts of (az + b) / (cz + 1). a scales and rotates, b translates, c is what bends '
          + 'the far field inward. d is fixed at 1 — scaling all four changes nothing, so it is not a '
          + 'degree of freedom.',
      }));
      body.appendChild(this.tripletRow('Mobius Im', {
        key: 'conformalMobiusIm', min: -2, max: 2, step: 0.01,
        captions: ['a', 'b', 'c'],
        get: () => [mb.aIm, mb.bIm, mb.cIm],
        set: (ax, v) => this.setConformal(index, {
          mobius: { ...mb, ...(ax === 0 ? { aIm: v } : ax === 1 ? { bIm: v } : { cIm: v }) },
        }),
        fmt: (v) => v.toFixed(2),
        title: 'The IMAGINARY parts of (az + b) / (cz + 1). Imaginary a rotates, imaginary b translates '
          + 'perpendicular, imaginary c skews which direction the far field collapses toward.',
      }));
    }

    // The point the map operates about. ⚠️ Resolves `centre` -> the layer's own `zoomCenter` -> the shared
    // default, which is the vortex eye's precedence verbatim (30.D13) — so there is no second rule for
    // "the point this layer operates about".
    body.appendChild(this.layerSlider(M.centreX, 'Centre X', c.centre.x,
      { min: 0, max: 1, step: 0.01, title: 'Where the map is centred, across the frame. Inherits the layer’s own zoom centre until you move it.' },
      v => this.setConformal(index, { centre: { x: v, y: c.centre.y } })));
    body.appendChild(this.layerSlider(M.centreY, 'Centre Y', c.centre.y,
      { min: 0, max: 1, step: 0.01, title: 'Where the map is centred, down the frame.' },
      v => this.setConformal(index, { centre: { x: c.centre.x, y: v } })));

    return body;
  }

  private buildVortexBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-vx-body';
    const M = VisualFxTab.VX_MARKERS;
    const v = vortexOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'The one style that produces coherent ROTATION. ⚠️ It resamples the TRAIL, so the swirl '
      + 'is the per-frame step times how long the trail lives — with little motion blur the same setting reads '
      + 'as a static shear (8° at Motion Blur 0, 634° at 8).';
    body.appendChild(hint);

    body.appendChild(this.layerSlider(M.swirl, 'Swirl', v.swirl,
      {
        min: 0, max: 1, step: 0.01,
        title: 'Peak rotation, as a fraction of 8% of the smaller frame dimension — the same unit as a static '
          + 'layer’s Strength, so it means the same amount at any resolution and in a preview tile. Negative '
          + 'rotation is the Falloff-independent job of the layer weight and chain mix, not of this slider.',
      },
      v2 => this.setVortex(index, { swirl: v2 })));

    body.appendChild(this.layerSlider(M.radius, 'Eye Radius', v.radius,
      {
        min: 0.05, max: 1.5, step: 0.01,
        title: 'Size of the rotating region, as a fraction of the smaller frame dimension — NOT pixels, so it '
          + 'holds its proportion at every resolution. Small spins a tight knot inside a still frame; large '
          + 'rotates the whole composition.',
      },
      v2 => this.setVortex(index, { radius: v2 })));

    body.appendChild(this.layerSlider(M.centreX, 'Eye X', v.centre.x,
      {
        min: 0, max: 1, step: 0.01,
        title: 'Horizontal position of the eye, in normalised frame coordinates. Inherited from this layer’s '
          + 'Zoom Centre if it had one, so a vortex added to a zoomed chain spins about the same point.',
      },
      v2 => this.setVortex(index, { centre: { x: v2, y: vortexOf(this.controls.getTransMapChain()[index]).centre.y } })));

    body.appendChild(this.layerSlider(M.centreY, 'Eye Y', v.centre.y,
      {
        min: 0, max: 1, step: 0.01,
        title: 'Vertical position of the eye, in normalised frame coordinates.',
      },
      v2 => this.setVortex(index, { centre: { x: vortexOf(this.controls.getTransMapChain()[index]).centre.x, y: v2 } })));

    const falloff = document.createElement('select');
    falloff.className = `sl-vfx-select ${M.falloff}`;
    for (const [val, label] of [['gaussian', 'Gaussian (contained)'], ['inverse', 'Inverse (long tail)']] as const) {
      const o = document.createElement('option');
      o.value = val; o.textContent = label;
      falloff.appendChild(o);
    }
    falloff.value = v.falloff;
    falloff.title = 'How the rotation dies away from the eye. Gaussian stops cleanly, leaving the rest of the '
      + 'frame untouched — a whirlpool in still water. Inverse keeps turning faintly to the frame edge, so the '
      + 'whole composition drifts around the eye.';
    falloff.addEventListener('change', () => {
      this.setVortex(index, { falloff: falloff.value === 'inverse' ? 'inverse' : 'gaussian' });
    });
    body.appendChild(this.makeRow('Falloff', falloff));

    return body;
  }

  /** The body of a style-9 (Band Split) layer row. */
  private buildModifierBody(index: number, layer: TransMapLayer): HTMLElement {
    const body = document.createElement('div');
    body.className = 'sl-vfx-bs-body';
    const M = VisualFxTab.BS_MARKERS;
    const b = bandSplitOf(layer);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.style.cssText = 'margin:2px 0 4px 0;font-size:10px;';
    hint.textContent = 'Warps only the fine detail, holding the broad composition. ⚠️ It modifies the OTHER '
      + 'layers rather than displacing anything itself, so it needs one present to do anything.';
    body.appendChild(hint);

    body.appendChild(this.layerSlider(M.amount, 'Band Split', b.amount,
      {
        min: 0, max: 1, step: 0.01,
        title: '0 is exactly the unsplit behaviour. 1 freezes the low-frequency base completely and warps only '
          + 'the high-frequency residual.',
      },
      v => this.setBandSplit(index, { amount: v })));

    body.appendChild(this.layerSlider(M.radius, 'Band Radius', b.radius,
      {
        min: 1, max: 16, step: 0.5, decimals: 1, suffix: ' px',
        title: 'The split frequency, as a blur radius in pixels of the full-resolution frame — where '
          + '“composition” ends and “texture” begins. Small reads as fine electric crawl along each strand; '
          + 'large inverts the effect perceptually, holding tonal masses while whole sub-strands slide.',
      },
      v => this.setBandSplit(index, { radius: v })));

    return body;
  }

  /**
   * Say so when a `modifier` layer has no field layer to modify — rather than let two sliders move nothing.
   *
   * ⚠️ **Depends on the OTHER rows**, so `updateLayerRow` re-applies it on every sync: muting the last field
   * layer is what makes Band Split inert, and that happens in a different row than this one.
   */
  private applyModifierNote(note: HTMLElement, style: number): void {
    const chain = this.controls.getTransMapChain();
    const inert = isInertModifier(chain, style);
    note.textContent = inert ? 'needs a warp layer' : 'modifier';
    note.title = inert
      ? 'This layer recomposes what the warp produces. With no active warp layer in the chain there is '
        + 'nothing to recompose, so its settings currently change nothing.'
      : 'Modifies how the warp composites its result. It contributes no displacement of its own, so it has '
        + 'no layer weight.';
  }

  /** Re-read a row's refraction controls from the chain. Absent markers are not errors — see `updateStaticRows`. */
  private updateRefractionRows(row: HTMLElement, layer: TransMapLayer): void {
    if (layer.style !== 7) return;
    const M = VisualFxTab.RF_MARKERS;
    const r = refractionOf(layer);
    const setRange = (cls: string, v: number, dec: number, suffix = ''): void => {
      const el = row.querySelector<HTMLInputElement>(`.${cls}`);
      if (el) el.value = String(v);
      const lbl = row.querySelector<HTMLElement>(`.${cls}-val`);
      if (lbl) lbl.textContent = `${v.toFixed(dec)}${suffix}`;
    };
    setRange(M.strength, r.strength, 2);
    setRange(M.reach, r.reach, 1, ' px');
    const inv = row.querySelector<HTMLInputElement>(`.${M.invert}`);
    if (inv) inv.checked = r.invert;
    const src = row.querySelector<HTMLSelectElement>(`.${M.source}`);
    if (src) src.value = r.source;
  }

  /** Re-read a row's band-split controls from the chain. */
  private updateBandRows(row: HTMLElement, layer: TransMapLayer): void {
    if (layer.style !== 9) return;
    const M = VisualFxTab.BS_MARKERS;
    const b = bandSplitOf(layer);
    const setRange = (cls: string, v: number, dec: number, suffix = ''): void => {
      const el = row.querySelector<HTMLInputElement>(`.${cls}`);
      if (el) el.value = String(v);
      const lbl = row.querySelector<HTMLElement>(`.${cls}-val`);
      if (lbl) lbl.textContent = `${v.toFixed(dec)}${suffix}`;
    };
    setRange(M.amount, b.amount, 2);
    setRange(M.radius, b.radius, 1, ' px');
  }

  /**
   * Re-read a row's range/label pair. The four `update*Rows` bodies below all needed this identical closure, so
   * it is hoisted — the three above predate it and are left alone rather than churned.
   *
   * Absent markers are not errors: a row for a different style simply has none of them (see `updateStaticRows`).
   */
  private syncRange(row: HTMLElement, cls: string, v: number, dec: number, suffix = ''): void {
    const el = row.querySelector<HTMLInputElement>(`.${cls}`);
    if (el) el.value = String(v);
    const lbl = row.querySelector<HTMLElement>(`.${cls}-val`);
    if (lbl) lbl.textContent = `${v.toFixed(dec)}${suffix}`;
  }

  /** Re-read a row's time-warp controls from the chain. */
  private updateTimeWarpRows(row: HTMLElement, layer: TransMapLayer): void {
    if (layer.style !== 8) return;
    const M = VisualFxTab.TW_MARKERS;
    const t = timeWarpOf(layer);
    this.syncRange(row, M.amount, t.amount, 2);
    const src = row.querySelector<HTMLSelectElement>(`.${M.source}`);
    if (src) src.value = t.source;
  }

  /** Re-read a row's vortex controls from the chain. `radius` and the centre are normalised, hence no ` px`. */
  private updateVortexRows(row: HTMLElement, layer: TransMapLayer): void {
    if (layer.style !== 10) return;
    const M = VisualFxTab.VX_MARKERS;
    const v = vortexOf(layer);
    this.syncRange(row, M.swirl, v.swirl, 2);
    this.syncRange(row, M.radius, v.radius, 2);
    this.syncRange(row, M.centreX, v.centre.x, 2);
    this.syncRange(row, M.centreY, v.centre.y, 2);
    const fo = row.querySelector<HTMLSelectElement>(`.${M.falloff}`);
    if (fo) fo.value = v.falloff;
  }

  /** Re-read a row's parallax controls from the chain. All three scalars are multipliers, so no unit suffix. */
  private updateParallaxRows(row: HTMLElement, layer: TransMapLayer): void {
    if (layer.style !== 11) return;
    const M = VisualFxTab.PX_MARKERS;
    const p = parallaxOf(layer);
    this.syncRange(row, M.amount, p.amount, 2);
    this.syncRange(row, M.near, p.nearScale, 2);
    this.syncRange(row, M.far, p.farScale, 2);
    const cv = row.querySelector<HTMLSelectElement>(`.${M.curve}`);
    if (cv) cv.value = p.curve;
  }

  // ---- IFS transforms editor (style 4) -----------------------------------------------------------
  //
  // Deliberately outside the descriptor registry: the rows are created and destroyed as transforms are
  // added and removed, so there is no fixed control list to describe. `syncIfsRows()` is its own sync.

  private buildIfsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sl-vfx-ifs-panel';

    const header = this.subTitle('IFS Transforms');
    panel.appendChild(header);

    panel.appendChild(this.makeRow('Preset', this.buildIfsArchetypeControl()));

    const addBtn = document.createElement('button');
    addBtn.className = 'sl-btn sl-btn-sm';
    addBtn.textContent = '+ Add Transform';
    addBtn.style.marginBottom = '6px';
    addBtn.addEventListener('click', () => {
      const params = this.controls.getIfsParams();
      if (params.length >= 6) return;
      params.push({ angle: 0, scale: 0.9, tx: 0, ty: 0, weight: 1.0 });
      this.controls.setIfsParams(params);
      this.rebuildIfsRows(params);
      this.setIfsArchetypeCustom();
    });
    panel.appendChild(addBtn);

    const rowContainer = document.createElement('div');
    rowContainer.className = 'sl-vfx-ifs-rows';
    panel.appendChild(rowContainer);

    this.ifsRows = [];
    this.rebuildIfsRows(this.controls.getIfsParams(), rowContainer);

    return panel;
  }

  private buildIfsArchetypeControl(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'sl-vfx-select';
    for (const preset of IFS_PRESETS) {
      const o = document.createElement('option');
      o.value = preset.name;
      o.textContent = preset.name;
      sel.appendChild(o);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'Custom';
    customOpt.textContent = '(Custom)';
    sel.appendChild(customOpt);

    sel.value = this.matchCurrentIfsPreset();
    sel.addEventListener('change', () => {
      if (sel.value === 'Custom') return;
      const preset = getIfsPreset(sel.value);
      if (preset) {
        const transforms = preset.transforms.map(t => ({ ...t }));
        this.controls.setIfsParams(transforms);
        this.rebuildIfsRows(transforms);
      }
    });
    this.ifsArchetypeSel = sel;
    return sel;
  }

  private matchCurrentIfsPreset(): string {
    const current = this.controls.getIfsParams();
    for (const preset of IFS_PRESETS) {
      if (preset.transforms.length !== current.length) continue;
      const match = preset.transforms.every((t, i) => {
        const c = current[i]!;
        return t.angle === c.angle && t.scale === c.scale &&
               t.tx === c.tx && t.ty === c.ty &&
               Math.abs(t.weight - c.weight) < 0.001;
      });
      if (match) return preset.name;
    }
    return 'Custom';
  }

  private setIfsArchetypeCustom(): void {
    if (this.ifsArchetypeSel && this.ifsArchetypeSel.value !== 'Custom') {
      this.ifsArchetypeSel.value = 'Custom';
    }
  }

  private syncIfsRows(): void {
    if (!this.ifsPanel) return;
    const params = this.controls.getIfsParams();
    if (this.ifsRows.length !== params.length) {
      this.rebuildIfsRows(params);
    } else {
      params.forEach((p, i) => this.updateIfsRow(i, p));
    }
    if (this.ifsArchetypeSel) {
      this.ifsArchetypeSel.value = this.matchCurrentIfsPreset();
    }
  }

  private rebuildIfsRows(params: IfsTransform[], container?: HTMLElement): void {
    const rowContainer = container ?? this.ifsPanel?.querySelector('.sl-vfx-ifs-rows') as HTMLElement | null;
    if (!rowContainer) return;
    rowContainer.innerHTML = '';
    this.ifsRows = [];
    params.forEach((p, i) => {
      const row = this.buildIfsRow(i, p);
      this.ifsRows.push(row);
      rowContainer.appendChild(row);
    });
  }

  /**
   * `p` seeds the slider positions ONCE; it is deliberately not retained. A third `allParams` argument
   * was dropped on 2026-08-10 (triage G11) — it was discharged with `void allParams` and never read,
   * because `commit()` re-reads `controls.getIfsParams()` on every change rather than closing over the
   * array it was built from. That is load-bearing, not incidental: a row outlives the array snapshot
   * that produced it (a preset change or an IFS preset pick calls `setIfsParams` and rebuilds), so a
   * captured array would commit edits into a stale object and silently lose them.
   */
  private buildIfsRow(index: number, p: IfsTransform): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-ifs-row';
    row.style.cssText = 'border:1px solid #333;border-radius:4px;padding:6px 8px;margin-bottom:6px;';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
    const title = document.createElement('span');
    title.style.cssText = 'font-size:11px;color:#aaa;font-weight:600;';
    title.textContent = `Transform ${index + 1}`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'sl-btn sl-btn-sm';
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'padding:1px 5px;font-size:10px;';
    removeBtn.addEventListener('click', () => {
      const params = this.controls.getIfsParams();
      params.splice(index, 1);
      this.controls.setIfsParams(params.length > 0 ? params : defaultIfsParams());
      this.rebuildIfsRows(this.controls.getIfsParams());
      this.setIfsArchetypeCustom();
    });
    titleRow.appendChild(title);
    titleRow.appendChild(removeBtn);
    row.appendChild(titleRow);

    const mkSlider = (label: string, min: number, max: number, step: number, value: number,
                      onChange: (v: number) => void): void => {
      const r = document.createElement('div');
      r.className = 'sl-vfx-row';
      r.style.marginBottom = '2px';
      const lbl = document.createElement('span');
      lbl.className = 'sl-vfx-label';
      lbl.style.minWidth = '50px';
      lbl.textContent = label;
      const wrap = document.createElement('div');
      wrap.className = 'sl-vfx-slider-wrap';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(min); slider.max = String(max); slider.step = String(step);
      slider.value = String(value);
      slider.className = 'sl-vfx-slider';
      const vl = document.createElement('span');
      vl.className = 'sl-vfx-value';
      vl.textContent = value.toFixed(step < 0.1 ? 2 : 1);
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        vl.textContent = v.toFixed(step < 0.1 ? 2 : 1);
        onChange(v);
      });
      wrap.appendChild(slider); wrap.appendChild(vl);
      r.appendChild(lbl); r.appendChild(wrap);
      row.appendChild(r);
    };

    const commit = (field: keyof IfsTransform, value: number): void => {
      const params = this.controls.getIfsParams();
      const entry = params[index];
      if (entry) entry[field] = value;
      this.controls.setIfsParams(params);
      this.setIfsArchetypeCustom();
    };

    mkSlider('Angle', 0, 360, 1, p.angle, v => commit('angle', v));
    mkSlider('Scale', 0.1, 2.0, 0.05, p.scale, v => commit('scale', v));
    mkSlider('TX', -0.5, 0.5, 0.01, p.tx, v => commit('tx', v));
    mkSlider('TY', -0.5, 0.5, 0.01, p.ty, v => commit('ty', v));
    mkSlider('Weight', 0.0, 1.0, 0.05, p.weight, v => commit('weight', v));

    return row;
  }

  private updateIfsRow(index: number, p: IfsTransform): void {
    const row = this.ifsRows[index];
    if (!row) return;
    const sliders = row.querySelectorAll<HTMLInputElement>('input[type=range]');
    const vals = [p.angle, p.scale, p.tx, p.ty, p.weight];
    sliders.forEach((s, i) => { if (vals[i] !== undefined) s.value = String(vals[i]); });
  }

  // ---- Force Field sub-section -------------------------------------------------------------------

  private buildForceFieldSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '12px';
    section.style.marginLeft = '12px';
    section.appendChild(this.subTitle('Force Field'));

    section.appendChild(this.makeRow('Force Blend', this.slider({
      key: 'force.blend', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getTransMapForceBlend(),
      set: v => this.controls.setTransMapForceBlend(v),
    })));
    section.appendChild(this.makeRow('Return Force', this.slider({
      key: 'force.return', min: 0, max: 10, step: 0.1,
      get: () => this.controls.getTransMapForceReturn(),
      set: v => this.controls.setTransMapForceReturn(v),
    })));
    section.appendChild(this.makeRow('Affects Sparks', this.check({
      key: 'force.sparks',
      get: () => this.controls.getTransMapForceSparks(),
      set: on => this.controls.setTransMapForceSparks(on),
    })));

    // ---- Particle-attribute gate (v8 Step 14.4) --------------------------------------------------
    //
    // Extends this section rather than adding a style, because it modifies a force that already has its
    // own section. Four controls, three of them dependent on the first — `updateGateRows()` owns the
    // dependencies in ONE place, on the same discipline as `syncVisibility()`.
    const gateSelect = this.select({
      key: 'force.gateBy',
      options: [
        ['none', 'None'],
        ['age', 'Age'],
        ['temperature', 'Temperature'],
        ['depth', 'Depth'],
      ],
      get: () => this.controls.getForceGateBy(),
      set: v => {
        this.controls.setForceGateBy(v as ForceGateSource);
        this.updateGateRows();
      },
    });
    gateSelect.title = 'Which per-particle attribute decides how hard the force pushes THAT particle. '
      + 'Force Blend moves the whole cloud together; this makes susceptibility a property of the particle, '
      + 'so the figure can hold its shape where the gate is low while the rest streams.';
    this.gateBySelect = gateSelect;
    section.appendChild(this.makeRow('Gate By', gateSelect));

    this.gateAmountRow = this.makeRow('Gate Amount', this.slider({
      key: 'force.gateAmount', min: 0, max: 1, step: 0.01,
      get: () => this.controls.getForceGateAmount(),
      set: v => this.controls.setForceGateAmount(v),
      title: '0 is exactly the ungated behaviour at any attribute value. 1 lets the attribute fully '
        + 'determine susceptibility, so a particle at attribute 0 is not pushed at all.',
    }));
    section.appendChild(this.gateAmountRow);

    this.gateHalfLifeRow = this.makeRow('Gate Half-Life', this.slider({
      key: 'force.gateHalfLife', min: 0.1, max: 20, step: 0.1, fmt: v => `${v.toFixed(1)}s`,
      get: () => this.controls.getForceGateHalfLife(),
      set: v => this.controls.setForceGateHalfLife(v),
      title: 'The age at which a particle has lost half its susceptibility. Particle age is unbounded, so '
        + 'it needs a half-life to become a 0..1 gate — short means only just-emitted particles move.',
    }));
    section.appendChild(this.gateHalfLifeRow);

    this.gateInvertRow = this.makeRow('Invert Gate', this.check({
      key: 'force.gateInvert',
      get: () => this.controls.getForceGateInvert(),
      set: on => { this.controls.setForceGateInvert(on); },
    }));
    section.appendChild(this.gateInvertRow);

    this.gateNote = document.createElement('div');
    this.gateNote.className = 'sl-vfx-note';
    this.gateNote.style.cssText = 'margin:2px 0 0 4px;font-size:10px;color:#888;';
    section.appendChild(this.gateNote);

    this.updateGateRows();
    return section;
  }

  /**
   * The gate's four controls depend on each other and on whether a material is live — derived HERE, once.
   *
   * ⚠️ **`Age` and `Temperature` are DISABLED, not hidden, when no material is running.**
   * `MaterialProcessor.update()` returns early on `preset === 'None'`, so `state.lifetimes` never accumulates
   * and is not published at all (the `isLive()` gate, 2026-09-20), while `state.temperatures` IS still
   * published frozen at zero — so `Age` makes the gate report itself inactive and `Temperature` makes it scale
   * every force by a constant. This row is the honest channel for both. Leaving
   * the options selectable would be invariant 13 — a control that moves and changes nothing — and hiding them
   * would make the dependency undiscoverable, which is why the note says what is missing.
   *
   * ⚠️ **Called from `syncFromControls()` as well as from the select's own handler**: switching a material off
   * in the Materials tab is what makes `Age` inert, and that happens in a different tab entirely.
   */
  private updateGateRows(): void {
    const by = this.controls.getForceGateBy();
    // ⚠️ Read through the EXISTING `getMaterialConfig()` rather than a second accessor that means the same
    // thing — and note a material's inactive state is the STRING `'None'`, not null (invariant 18).
    const cfg = this.controls.getMaterialConfig();
    const materialActive = !!cfg && cfg.preset !== 'None';
    const needsMaterial = by === 'age' || by === 'temperature';
    const show = (row: HTMLElement | null, visible: boolean): void => {
      if (row) row.style.display = visible ? '' : 'none';
    };
    show(this.gateAmountRow, by !== 'none');
    // Only `'age'` reads the half-life — see `prepareGate()`. Shown for that source alone, or it is an inert
    // control for the other two.
    show(this.gateHalfLifeRow, by === 'age');
    show(this.gateInvertRow, by !== 'none');

    if (this.gateBySelect) {
      for (const opt of Array.from(this.gateBySelect.options)) {
        if (opt.value === 'age' || opt.value === 'temperature') {
          opt.disabled = !materialActive;
          opt.textContent = materialActive
            ? (opt.value === 'age' ? 'Age' : 'Temperature')
            : (opt.value === 'age' ? 'Age (needs a material)' : 'Temperature (needs a material)');
        }
      }
    }

    if (this.gateNote) {
      const inert = needsMaterial && !materialActive;
      this.gateNote.style.display = inert ? '' : 'none';
      this.gateNote.textContent = inert
        ? 'needs a material — the force is running ungated'
        : '';
    }
  }

  // ---- Fluid Feedback sub-section (style 6) -----------------------------------------------------

  private buildFluidFeedbackPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.marginTop = '12px';
    panel.style.marginLeft = '12px';
    panel.appendChild(this.subTitle('Fluid Feedback'));

    const fb = (): FluidFeedbackConfig => this.controls.getFluidFeedback();

    panel.appendChild(this.makeRow('Trail Persist', this.slider({
      key: 'fluidFeedback.persist', min: 0.90, max: 0.99, step: 0.01,
      get: () => fb().persist, set: v => this.controls.setFluidFeedback({ persist: v }),
    })));
    panel.appendChild(this.makeRow('Warp Amplify', this.slider({
      key: 'fluidFeedback.amplify', min: 1.0, max: 10.0, step: 0.1, decimals: 1,
      get: () => fb().amplify, set: v => this.controls.setFluidFeedback({ amplify: v }),
    })));
    // ⚠️ **The `fluidFeedback.dispersion` slider was REMOVED here on 2026-08-20, not moved.** Dispersion is
    // now the chain-level `transMapDispersion` control beside Chain Mix, because the shader applies it to the
    // summed offset and it was never a fluid quantity. Leaving this row would have put two handles on one
    // uniform: `setFluidFeedback({dispersion})` still writes `currentFluidFeedback.dispersion`, which nothing
    // uploads any more — a control that moves and does nothing (invariant 13). The FIELD survives in
    // `FluidFeedbackConfig` for import compatibility only; see its note in `types.ts`.
    panel.appendChild(this.makeRow('Field Decay', this.slider({
      key: 'fluidFeedback.fieldDecay', min: 0.95, max: 0.999, step: 0.001, decimals: 3,
      get: () => fb().fieldDecay, set: v => this.controls.setFluidFeedback({ fieldDecay: v }),
    })));
    panel.appendChild(this.makeRow('Glow Boost', this.slider({
      key: 'fluidFeedback.glowBoost', min: 0.0, max: 2.0, step: 0.05,
      get: () => fb().glowBoost, set: v => this.controls.setFluidFeedback({ glowBoost: v }),
    })));

    return panel;
  }

  // ---- Procedural Flow sub-section (style 5) ----------------------------------------------------

  private buildProceduralFlowPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.marginTop = '12px';
    panel.style.marginLeft = '12px';
    panel.appendChild(this.subTitle('Procedural Flow'));

    const cfg = (): ProceduralFlowConfig => this.controls.getProceduralFlowConfig();

    panel.appendChild(this.makeRow('Archetype', this.select({
      key: 'flow.archetype',
      options: [
        ...FLOW_ARCHETYPES.map(a => [a.name, a.name] as [string, string]),
        ['Custom', 'Custom'],
      ],
      get: () => cfg().archetype || 'Custom',
      set: v => {
        if (v === 'Custom') return;
        const arch = getFlowArchetype(v);
        if (!arch) return;
        this.controls.setProceduralFlowConfig({ ...arch.config, archetype: v });
        this.syncGroup('flow.');
      },
    })));
    panel.appendChild(this.makeRow('Strength', this.slider({
      key: 'flow.strength', min: 0, max: 1, step: 0.01,
      get: () => cfg().strength,
      set: v => { this.controls.setProceduralFlowConfig({ strength: v }); this.setFlowArchetypeCustom(); },
    })));
    panel.appendChild(this.makeRow('Scale', this.slider({
      key: 'flow.scale', min: 0.1, max: 5, step: 0.1, decimals: 1,
      get: () => cfg().scale,
      set: v => { this.controls.setProceduralFlowConfig({ scale: v }); this.setFlowArchetypeCustom(); },
    })));
    panel.appendChild(this.makeRow('Curl Amount', this.slider({
      key: 'flow.curlAmount', min: 0, max: 1, step: 0.01,
      get: () => cfg().curlAmount,
      set: v => { this.controls.setProceduralFlowConfig({ curlAmount: v }); this.setFlowArchetypeCustom(); },
    })));
    // Stored as a unit vector, edited as an angle — the round trip through `directionToAngle` is what
    // keeps the handle where the user left it after an external change.
    panel.appendChild(this.makeRow('Direction', this.slider({
      key: 'flow.direction', min: 0, max: 360, step: 1, decimals: 0,
      get: () => this.directionToAngle(cfg().direction),
      set: v => {
        const rad = v * Math.PI / 180;
        this.controls.setProceduralFlowConfig({ direction: [Math.cos(rad), Math.sin(rad)] });
        this.setFlowArchetypeCustom();
      },
    })));
    panel.appendChild(this.makeRow('Radial', this.slider({
      key: 'flow.radial', min: -1, max: 1, step: 0.01,
      get: () => cfg().radial,
      set: v => { this.controls.setProceduralFlowConfig({ radial: v }); this.setFlowArchetypeCustom(); },
    })));
    panel.appendChild(this.makeRow('Evol. Speed', this.slider({
      key: 'flow.evolutionSpeed', min: 0, max: 2, step: 0.01,
      get: () => cfg().evolutionSpeed,
      set: v => { this.controls.setProceduralFlowConfig({ evolutionSpeed: v }); this.setFlowArchetypeCustom(); },
    })));

    return panel;
  }

  /**
   * Editing any flow parameter takes the config off its archetype.
   *
   * Tested against the CONFIG rather than the dropdown's DOM value, so the dropdown is a view of the
   * config in both directions instead of a second copy of the state.
   */
  private setFlowArchetypeCustom(): void {
    if (this.controls.getProceduralFlowConfig().archetype === 'Custom') return;
    this.controls.setProceduralFlowConfig({ archetype: 'Custom' });
    this.syncKey('flow.archetype');
  }

  private directionToAngle(dir: [number, number]): number {
    const angle = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    return ((angle % 360) + 360) % 360;
  }
}
