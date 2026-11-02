import type { ChannelDriver } from './interfaces.ts';

/**
 * v8 Phase 30 — **the clamp constants for the model-space deformation operators, and the ONE owner of each.**
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE A RANGE `min` IS COSMETIC AND A CLAMP IS NOT.** Each value below is read by
 * **two** parties — the generator's setter, which must reject a hand-edited import that never passed through
 * a slider, and the Visual FX descriptor, which draws the track. A constant typed into both is the shape
 * where the two drift and the symptom is an authored value the track cannot represent. **Share it; never
 * retype it.**
 *
 * ⚠️ **NONE OF THESE OPERATORS IS A TRACKED SLIDER, AND THAT IS DELIBERATE.** A tracked spec's `min`/`max`
 * are POSITIONS and its value reaches the element only through `toPos`/`fromPos` — a convention that has
 * already cost one defect and one over-correction in this codebase. These three are LINEAR, so the value IS
 * the position, exactly as `symmetryFold`'s own descriptor is, and the whole position/value question cannot
 * arise. **Do not add a `toPos`/`fromPos` pair to any of them without re-reading the slider-track rules.**
 */

/**
 * `30.1` (`E129a`) — the per-axis twist clamp, in **turns per half-extent of the design box**.
 *
 * **±2, derived rather than picked.** One turn from the centre to the box edge is already a figure wound
 * into a visible helix; two is the point past which a Lissajous body of typical amplitude self-occludes into
 * a solid tube and further winding adds no legible structure. ⚠️ **The ceiling is about LEGIBILITY, not
 * about stability** — the transform is a rigid rotation at every magnitude, `det J = 1` for any turn count,
 * and nothing diverges. So widening it is safe arithmetically and buys nothing visually; **if it is ever
 * widened, move the step with it or authored values fall off the grid.**
 */
export const TWIST_MAX_TURNS = 2;

/** `30.1` — the twist slider's step. 0.01 turns = 3.6°, below the threshold at which a step is visible. */
export const TWIST_STEP = 0.01;

/**
 * `30.1` — **the twist's DEAD ZONE: any |turns| below this snaps to exactly 0.**
 *
 * ⚠️ **Added on owner report (2026-10-25): the twist was "difficult to turn off by putting the sliders to
 * the middle".** The operator's gate is `!== 0` on the whole triple, so a drag that lands on 0.01 — one
 * cell out of 400 on a ±2 track with a 0.01 step — leaves it RUNNING. **An exact off position a mouse can
 * reach is a property of the control, not a convenience.**
 *
 * **0.05, and it is the smallest VISIBLE twist rather than a fraction of the track**: 0.05 turns rotates
 * the figure's edge by 18°, which reads; below that the result is indistinguishable from untwisted, so
 * snapping it away costs nothing reachable.
 */
/*
 * ⚠⚠ **RE-DERIVED AS A FRACTION OF TRAVEL, 2026-10-26, BECAUSE A SINGLE ABSOLUTE VALUE CANNOT SERVE
 * THREE DIFFERENT RANGES.** `0.05` was set for the twist, whose range is ±2 — so the dead zone was 2.5 %
 * of full travel, about 11 px on a triplet cell, which the owner reported as *"quite difficult"*. The same
 * constant on taper (±0.95) and bend (±0.85) gave 5.3 % and 5.9 %: three different targets from one number.
 *
 * **8 % of HALF travel is the rule now**, so every centre-off slider has the same aimable dead zone
 * whatever its range, and widening a range cannot silently shrink it. ⚠ It is a fraction of HALF travel
 * rather than of full travel because the zone is two-sided: ±8 % of the half is 8 % of the usable throw to
 * either side, which is what the hand actually aims at.
 *
 * ⚠ **THE SNAP MUST ALSO BE VISIBLE, AND IT WAS NOT.** See `32.14` in `tripletRow`: the handler formatted
 * the dragged value and threw the setter's result away, so this constant had no effect on screen for a
 * whole phase. **A dead zone nobody can see is a dead zone that does not exist.**
 */
export const DEAD_ZONE_FRACTION = 0.08;

/** The twist's own dead zone, derived. Kept as a named export because three call sites read it. */
export const TWIST_SNAP = TWIST_MAX_TURNS * DEAD_ZONE_FRACTION;



/**
 * `30.1` — the twist readout. **Exported for the Visual FX descriptor AND for `trackcheck`, exactly as
 * `fmtRotationRpm` is** — a readout assertion has to run the REAL function or it measures a copy.
 *
 * ⚠️ **THE SIGN IS CARRIED EXPLICITLY, AND IT IS INFORMATION RATHER THAN DECORATION.** The two signs are
 * mirror-image figures — a left-handed and a right-handed helix — and they are not interchangeable to the
 * eye. `fmtRotationRpm` makes the same choice for the same reason, and names its directions in words
 * because an arrow glyph's width varies by font; a twist has no comparable short word pair, so the signed
 * number is the readout.
 *
 * ⚠️ **`0` prints `Off`, not `0.00`**, matching `fmtRotationRpm`: zero is the value at which the operator's
 * loop is skipped entirely, so the readout should say the operator is not running rather than report a
 * magnitude of nothing.
 */
export function fmtTwistTurns(turns: number): string {
  if (turns === 0) return 'Off';
  return `${turns > 0 ? '+' : '−'}${Math.abs(turns).toFixed(2)} turns`;
}

/**
 * `30.2` (`E130`) — the maximum box-fold iteration count.
 *
 * ⚠️ **4, AND THE REASON IS HART'S COMPOSITION RULE RATHER THAN COST.** *The Lipschitz constant of the
 * composition of functions is at most the product of the component functions' Lipschitz constants* — and
 * iteration IS composition, so **n folds multiply the bound geometrically.** Each extra iteration is about
 * six arithmetic operations and is therefore nearly free in ALU, which is exactly the trap: the expense is
 * carried by everything downstream that depends on a bounded step, not by the loop.
 *
 * **Default 1, cap 4.** At one iteration the curve reflects off a cell wall; at two it builds nested
 * chambers; past four the structure stops reading as architecture and starts reading as foam.
 */
export const BOX_FOLD_MAX_ITERATIONS = 4;

/**
 * `30.2` — the cell half-width, as a **fraction of the design half-extent** (`min(designW, designH) / 2`).
 *
 * ⚠️ **A FRACTION RATHER THAN MODEL UNITS, so the control means one thing whatever design box a preset
 * declares** — the same argument that puts the twist angle on the design box (invariant 10).
 *
 * ⚠️ **DEFAULT 0.35, AND THIS DEVIATES FROM `30.2` AS SPECIFIED — recorded rather than quietly applied.**
 * The step text said *"default = the design-box half-width so it is a no-op even when switched on"*, i.e.
 * 1.0. **Measured against the library, that default would make the control read as INERT**: a typical
 * Lissajous body has an `am.base` around 10–20 in a 100-unit design box, so at a cell of 50 the figure
 * sits entirely inside and nothing folds. A control that does nothing on its first use is invariant 13's
 * trap, and the bit-exactness the step actually wanted is already guaranteed by `boxFoldIterations: 0`
 * being the gate. **0.35 puts the cell inside a typical body's own extent, so one iteration visibly
 * folds.**
 */
export const BOX_FOLD_DEFAULT_LIMIT = 0.35;

/** `30.2` — the tightest cell. Below this a typical body folds more than four times at one iteration. */
export const BOX_FOLD_MIN_LIMIT = 0.05;

/** `30.2` — the fold slider steps. The limit is a fraction, the scale a multiplier; both read to 0.01. */
export const BOX_FOLD_LIMIT_STEP = 0.01;

/**
 * `30.2` — the between-iteration scale bounds, **and they are deliberately asymmetric about 1.**
 *
 * ⚠️ **The ceiling is low because this is the ONE box-fold field that compounds.** `scale` applies once per
 * iteration, so the total is `scale^n` — at four iterations a scale of 1.5 is 5.06× and 2.0 would be 16×,
 * which drives the figure out of the design box entirely and then folds the overflow back into noise. 1.5
 * at n = 4 is already the useful limit. The floor is 0.5, where four iterations contract 16-fold and the
 * figure collapses toward the origin — self-similar nesting, which is the Mandelbox's own look.
 */
export const BOX_FOLD_MIN_SCALE = 0.5;
export const BOX_FOLD_MAX_SCALE = 1.5;

/**
 * `30.2` — the three box-fold readouts. Exported for the descriptors AND for `deformcheck`/`trackcheck`,
 * for `fmtRotationRpm`'s reason: a readout assertion has to run the real function.
 *
 * ⚠️ **`fmtFoldIterations` prints `Off` at 0 rather than `0`**, because 0 is not a quantity of folds — it
 * is the state in which the operator does not run at all and three other rows are hidden. The readout
 * should say which of those two things is true.
 */
export function fmtFoldIterations(n: number): string {
  if (n <= 0) return 'Off';
  return n === 1 ? '1 fold' : `${n} folds`;
}

/**
 * ⚠️ **The cell size prints as a PERCENTAGE of the figure's own box, because that is the question the
 * number answers** — "is the cell inside my figure or outside it", which is what decides whether anything
 * folds at all. A bare 0.35 invites being read as model units, which it is not.
 */
export function fmtFoldLimit(fraction: number): string {
  return `${Math.round(fraction * 100)}% of box`;
}

/**
 * ⚠️ **The scale prints its COMPOUNDED effect is NOT shown here and that is deliberate** — it depends on
 * the iteration count, which this formatter cannot see. The tooltip carries the compounding warning
 * instead; a readout that silently depended on another row's value would be the worse of the two.
 */
export function fmtFoldScale(s: number): string {
  return s === 1 ? '1.00× (none)' : `${s.toFixed(2)}×`;
}

/**
 * v8 `31.2` (`E112`/`E113`/`E137`) — **the per-particle channel amount ceiling, and ±1 is where the
 * MULTIPLIER's own floor is reached rather than a taste limit.**
 *
 * Each channel is applied as `1 + amount·(2d − 1)` with the driver `d ∈ [0, 1]`, so the multiplier spans
 * `[1 − amount, 1 + amount]`. ⚠️ **At amount 1 the lower end is exactly 0 — a particle of zero size, zero
 * alpha or zero lightness, i.e. gone.** Past 1 it goes NEGATIVE, and a negative size is a quad wound the
 * other way while a negative lightness subtracts light in an additive renderer: two different wrong
 * pictures from one number, neither of which reads as "too much". **So 1 is the edge of the meaningful
 * range in the strict sense.** (The twist and fold clamps above are bounded by legibility and by Hart's composition rule respectively; this one is bounded by the ARITHMETIC of the multiplier.)
 *
 * ⚠️ **SYMMETRIC ABOUT THE DRIVER'S MIDPOINT, AND THAT IS WHY A SIGNED AMOUNT IS USEFUL** rather than
 * redundant: at `+amount` the high-driver particles are the large/bright ones, at `−amount` the low-driver
 * ones are, and those are different pictures of the same ordering. **0 is the identity and the whole
 * computation is skipped there.**
 */
export const CHANNEL_MAX = 1;

/**
 * v8 `31.2` — **the channel law's LOG SPAN: the multiplier is `exp(amount · span · (2d − 1))`.**
 *
 * ⚠️⚠️ **THE LAW WAS LINEAR (`1 + amount·(2d − 1)`) AND THE OWNER ASKED FOR MORE RANGE AT BOTH ENDS
 * (2026-10-25). A LINEAR LAW CANNOT GIVE IT, which is why this is a change of law and not of a bound.**
 * At amount 1 the linear form spans `[0, 2]` — the top end is only 2x while the bottom end is exactly
 * **0**, i.e. gone. Widening `CHANNEL_MAX` past 1 would push the bottom NEGATIVE, and a negative size is
 * undefined behaviour that differs by driver while a negative lightness SUBTRACTS light in an additive
 * renderer. **So the linear law's useful range was bounded at both ends by different problems.**
 *
 * A geometric law is symmetric in RATIO, strictly positive, and still exactly 1 at amount 0 — so the
 * bit-exact gate is untouched. `log(5)` gives `[1/5, 5]` at amount 1: **a 25x spread against the linear
 * form's practical ~9x, with no reachable zero and no reachable negative.**
 *
 * ⚠️ **`exp(0) === 1` exactly in IEEE-754**, so amount 0 is bit-exact rather than nearly so — which the
 * gate relies on and a checker asserts.
 */
export const CHANNEL_LOG_SPAN = Math.log(5);

/** `31.2` — the channel sliders' step. 0.01 of the amount, matching the twist and fold steps. */
export const CHANNEL_STEP = 0.01;

/**
 * `31.2` — **the per-particle SIZE multiplier's floor, and it is a correctness clamp rather than a taste
 * one.** `gl_PointSize` of 0 is legal and draws nothing, but a NEGATIVE one is undefined behaviour that
 * differs by driver — and `estimateParticlePixels()` squares the size, so a negative would come back
 * positive and make the perf guard read a huge particle as a small one (`31.D11`). **Clamped in the
 * generator, where the estimator can see the same number the shader does.**
 */
export const CHANNEL_SIZE_FLOOR = 0.05;

/** `31.2` — the three channel readouts. `Off` at 0, where the whole computation is skipped. */
export function fmtChannelAmount(a: number): string {
  if (a === 0) return 'Off';
  // Signed, because the two signs invert WHICH particles are emphasised — a different picture, not a
  // smaller one, so the number alone cannot say which (fmtTwistTurns' argument).
  return `${a > 0 ? '+' : '−'}${Math.abs(a).toFixed(2)}`;
}

/**
 * `31.2` — **the runtime list of channel drivers, and the ONE place the union's members exist as values.**
 *
 * ⚠️ **A TYPE UNION CANNOT BE ITERATED OR VALIDATED AGAINST AT RUNTIME, which is the whole reason this
 * exists** — `main.ts` must reject a bad `channelDriver` word arriving from an imported JSON preset, and
 * the Visual FX picker must be built from every member rather than from a hand-typed subset. **The Time
 * Warp source picker shipped naming two of its three members because its list was typed by hand in the
 * tab; this is the fix for that class, not a convenience.**
 *
 * ⚠️ **THE `readonly ChannelDriver[]` ANNOTATION IS LOAD-BEARING IN ONE DIRECTION ONLY, AND THE GAP IS
 * NAMED RATHER THAN PAPERED OVER:** it proves every entry here IS a driver, so a renamed union member
 * breaks this line. It does NOT prove every driver is listed — **a new union member would compile with
 * this list unchanged, and the picker would then silently offer one option fewer.**
 * **`REEL_*_LABELS`' `Record<Union, string>` is the shape that forces the other direction, and the LABELS
 * record in `visual-fx.ts` is where it is held.** Add a member to the union and the labels record is where
 * `tsc` will stop you; this list is where you then add the value.
 */
export const CHANNEL_DRIVERS: readonly ChannelDriver[] =
  ['index', 'velocity', 'depth', 'colourPhase', 'escape'];

/*
 * ⚠️⚠️ **DROPPED FEATURE, RECORD ONLY — THERE IS NO EXPORT UNDER THIS COMMENT AND THAT IS DELIBERATE.**
 * `31.3`'s `OCTA_PERMS` / `OCTA_GROUP_ORDER` (`E131`, the octahedral fold) were removed ENTIRE when the
 * owner cut the feature on visual grounds — *"chops the figure into multiplied line segments"* — and this
 * header was left behind. Found 2026-10-29 while writing `ENGINE-NOTES.md`'s arrears.
 *
 * ⚠️ **It was a JSDoc block (`/**`) immediately above another JSDoc block, so it had become a CONTAINMENT
 * error: a reader, an IDE or a doc tool attaches a dangling JSDoc to the declaration that FOLLOWS it — here
 * `31.4`'s 4D extent, which it says nothing about.** Demoted to a plain comment so the record survives
 * without claiming to document the constant below. ⚠️ **`deadcheck` cannot catch this class: it
 * `stripComments()` first, so a comment describing an export that no longer exists is invisible to it.**
 *
 * What it said, kept verbatim because it is the only remaining trace of the operator's one cost decision:
 * *"the six permutations of three axes, FLAT, as index triples into `[a, b, c]`. Flat rather than nested,
 * and that is the one performance choice in this operator: it is read three times per particle per frame,
 * and a nested array costs a pointer chase per component. 9 compares plus 3 loads is the whole cost of the
 * fold."*
 */

/**
 * v8 `31.4` (`E132`) — **the fourth axis's extent, as a multiple of the design half-extent.**
 *
 * `w = (i / count − 0.5) · 2 · halfExtent · wScale` (`31.D2`): the CURVE PARAMETER lifted into a fourth
 * coordinate. ⚠️ **It is the curve parameter and not a fourth wave, which is a never-re-propose owner
 * decision** — the figure *is* a curve traced by a parameter, so lifting that parameter generalises the
 * engine's own premise rather than bolting a dimension onto it. **And it is what makes the pass-through
 * lawful: two particles at the same `xyz` can differ in `w`, which no function of position can give.**
 *
 * ⚠️ **CEILING 1, AND IT IS WHERE THE PROJECTION'S MAGNIFICATION SPREAD IS ALREADY THE WHOLE FIGURE.** At
 * `wScale` 1 and no rotation, `w` spans ±halfExtent, so `d − w` spans `[2h, 4h]` against `d = 3h` — a
 * magnification of 0.75× to 1.5×, i.e. the near end of the curve drawn twice the size of the far end.
 * Past that the near end dwarfs the far end and the figure stops reading as one object.
 */
export const W_SCALE_MAX = 1;

/** `31.4` — the w-scale and w-angle steps. Angles are in TURNS, as the twist's are. */
export const W_STEP = 0.01;

/**
 * `31.4` — the fourth-axis viewer distance, as a multiple of the design half-extent.
 *
 * ⚠️ **3, AND IT IS NOT A FREE PARAMETER — it is what sets the projection's magnification spread**, which
 * is the entire visible content of the 4D projection. `d = 3h` with `w ∈ [−h, h]` gives `d/(d − w)` ∈
 * [0.75, 1.5]. A smaller `d` makes the figure explode near `w = d`; a larger one flattens the projection
 * toward the identity and the three angles stop doing anything visible. **It is deliberately NOT exposed:
 * `wScale` already controls the same quantity from the other side, and two controls for one effect is the
 * trap `31.4`'s own step text names for the `xy`/`xz`/`yz` planes.**
 */
export const W_VIEW_DISTANCE = 3;

/**
 * `31.4` — **the floor on the perspective denominator `d − w`, as a fraction of `d`.**
 *
 * ⚠️⚠️ **DERIVED FROM THE MAXIMUM MAGNIFICATION THE OPERATOR MAY PRODUCE, NOT FROM A FLOAT EPSILON, and
 * the distinction is the whole point of `31.4`'s own warning.** `d/(d − w)` is unbounded as `w → d`, and a
 * rotation in the `xw` plane mixes `x` into `w` — so `w` after rotation is bounded by the figure's own
 * radius, which no constant here can know. An epsilon floor would therefore admit a magnification of
 * thousands: one particle flung across the frame, which reads as a stray dot and not as an error.
 *
 * **0.25 caps the magnification at exactly 4×**, which is 2.7× the spread `wScale` 1 produces unrotated —
 * so the clamp cannot engage during normal use and exists for the rotated extremes alone. It is the one
 * remaining unguarded singularity class after `30.4`'s pole, and it is guarded by a BOUND rather than by
 * a nudge.
 */
export const W_MIN_DEN_FRACTION = 0.25;

/** `31.4` — the w-angle readout, in turns, with `fmtTwistTurns`' sign convention and its `Off` at 0. */
export function fmtWAngle(turns: number): string {
  if (turns === 0) return 'Off';
  return `${turns > 0 ? '+' : '−'}${Math.abs(turns).toFixed(2)} turns`;
}

/** `31.4` — the w-extent readout. `Off` at 0, where the whole stage is skipped. */
export function fmtWScale(s: number): string {
  if (s === 0) return 'Off';
  return `${Math.round(s * 100)}% of box`;
}

/**
 * v8 `31.4` — **how many times the fourth coordinate WINDS across the population, and this is the control
 * that makes the operator's own promise reachable.**
 *
 * ⚠️⚠️ **IT SHIPPED WITH `w` AS A SINGLE MONOTONE RAMP IN THE PARTICLE INDEX, AND THE OWNER READ THE
 * RESULT CORRECTLY AS "stretches it in one direction".** With `w = (i/count − 0.5)·span`, `w` is a smooth
 * monotone function of the index — and on a figure whose index maps near-injectively to position (which
 * is every figure in the library: measured, 0.00–0.32 % of far-apart-in-index particle pairs sit at the
 * same place) `w` is therefore nearly a function of POSITION. **A 4D rotation of a coordinate that is a
 * function of position is a 3D deformation wearing a fourth axis**, which is why it read as a stretch plus
 * a turn and nothing a 3D control could not do.
 *
 * Winding replaces the ramp with `sin(pi·winding·u)`, `u ∈ [−1, 1]`: `w` now oscillates along the curve,
 * so walking the figure pushes it alternately toward and away from the 4D viewer and the strands **cross
 * each other**. That is the pass-through the operator was specified for, and it is only reachable once `w`
 * stops being monotone.
 *
 * ⚠️ **INTEGERS, and the reason is closure rather than taste: a fractional winding does not close**, so the first and last
 * particles of a closed figure get different `w` and the curve tears at the seam.
 *
 * ⚠️ **IT EXTENDS `31.D2` RATHER THAN CONTRADICTING IT — `w` is still a function of the CURVE PARAMETER
 * and nothing else**, which is the part of that decision that carries the "lawful" claim. What changes is
 * that the function is periodic instead of linear. **The owner approved this extension explicitly.**
 */
export const W_WINDING_MAX = 8;

/** `31.4` — the winding readout. `1` is the single oscillation; the plural reads as a count. */
export function fmtWWinding(w: number): string {
  const n = Math.round(w);
  return n === 1 ? '1 wind' : `${n} winds`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * v8 Phase 32 — `E129b` Barr taper and bend, and `E133`'s 3D inversion
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️⚠️ **THESE THREE OPERATORS ARE WHERE THE DETERMINANT STOPS BEING 1, AND EVERY CONSTANT BELOW IS A
 * CLAMP RATHER THAN A RANGE.** Barr gives the determinant per deformation, and the trio splits cleanly:
 *
 *     twisting, θ = f(z)      det J = 1              exactly energy-neutral  <- shipped, needs nothing
 *     tapering, r = f(z)      det J = r²             ∝ 1/r², unbounded as r → 0
 *     bending,  rate k        det J = 1 − k·z        singular at z = 1/k, the radius of curvature
 *
 * **`E129a` shipped with none of this machinery precisely because twist is the member with determinant
 * 1.** Taper and bend are the two that can drive the determinant to zero at reachable parameter values,
 * and in an additive renderer a vanishing determinant is an **unbounded luminance** — which lands in an
 * HDR buffer whose trail fade MULTIPLIES, so one Inf can never be cleared by any number of later frames.
 * Barr says taper *"passes through a singularity at f(z) = 0 and becomes everted when f(z) < 0"*; Hsu,
 * Lee and Wiseman describe the same locus for bend as features *"beyond the centre of curvature"* being
 * *"inverted and expanded"*. **Two independent descriptions of one failure point.**
 *
 * ⚠️ **SO THE RANGE AND THE CLAMP COME FROM ONE CONSTANT EACH, NOT TWO: a range `min` is cosmetic and a
 * clamp is not**, and the slider's own travel must be unable to reach the singularity.
 */

/**
 * The smallest taper factor any axis may produce. `det J` contains `s²` per axis, so the energy
 * compensation divides by `s²` — at `s = 0.05` that is a ×400 amplification, which is large and FINITE.
 *
 * ⚠️ **A MAGNITUDE GUARD, NOT A FLOAT EPSILON (invariant 10): both expressions look reasonable and only
 * the unit of the result distinguishes them.** An epsilon here would admit amplifications of millions.
 */
export const TAPER_MIN_FACTOR = 0.05;

/**
 * `taper[axis]` bound, derived so a single axis at full travel cannot reach `TAPER_MIN_FACTOR`.
 *
 * The factor is `s = 1 + t·u/halfExtent` with `|u| ≤ halfExtent`, so the worst case is `s = 1 − |t|`.
 * Setting `1 − TAPER_MAX = TAPER_MIN_FACTOR` gives the bound below. ⚠️ **It bounds ONE axis; with three
 * composing (`32.D4`'s triplet) the PRODUCT needs its own clamp, which lives at the operator site** —
 * this constant cannot see the other two axes.
 */
export const TAPER_MAX = 1 - TAPER_MIN_FACTOR;

/** Slider step for taper and bend. Matches `TWIST_STEP`'s resolution so the three rows feel the same. */
export const TAPER_STEP = 0.01;

/**
 * How far from the bend singularity the reachable range must stop. `det J = 1 − k·u`, so the bound is on
 * the PRODUCT `k·u` and `BEND_MAX_RATE` below is what makes it unreachable at `|u| = halfExtent`.
 */
export const BEND_MARGIN = 0.15;

/**
 * `bend[axis]` bound. With `u` normalised by the half-extent the determinant contribution is `1 − k·û`
 * for `|û| ≤ 1`, so `|k| ≤ 1 − BEND_MARGIN` keeps it at or above `BEND_MARGIN`.
 *
 * ⚠️ **PER AXIS, AND NOT SUFFICIENT ON ITS OWN**: three bend rates compose multiplicatively, so three
 * axes each at `0.85` give a product of `0.15³ ≈ 0.0034`. The product clamp is at the operator site.
 */
export const BEND_MAX_RATE = 1 - BEND_MARGIN;

/** `32.1` — taper's dead zone, derived from its own range so the zone is the same SIZE on screen. */
export const TAPER_SNAP = TAPER_MAX * DEAD_ZONE_FRACTION;

/** `32.2` — bend's, likewise. See `DEAD_ZONE_FRACTION` for why these are derived and not literals. */
export const BEND_SNAP = BEND_MAX_RATE * DEAD_ZONE_FRACTION;


/**
 * The floor on the composed determinant, applied to the PRODUCT of all six taper and bend factors.
 *
 * ⚠️⚠️ **THIS IS THE CONSTANT `32.D4`'s TRIPLET CHOICE MADE NECESSARY.** With one scalar per operator the
 * per-axis bounds above would have been the whole guard; with three composing factors each, the product is
 * a six-term product and **any single term can drive it toward zero while every term is individually in
 * range.** The compensation multiplies by `det J`, so the floor bounds how dark a region may get, and its
 * reciprocal bounds how bright — which is the half that reaches the trail.
 */
export const DEFORM_DET_FLOOR = 1e-3;

/**
 * The bound on how far the energy compensation may push the per-particle SIZE multiplier, in RATIO.
 *
 * ⚠️⚠️ **MEASURED, AND IT IS A PROPERTY OF THE VEHICLE RATHER THAN OF BARR'S ALGEBRA.** The raw product
 * reaches **x15.6** at full taper on `Quader` (probed 2026-10-26), and the compensation travels through
 * `writeChannels`' size channel — whose own law spans `[1/5, 5]` (`CHANNEL_LOG_SPAN = log 5`) and whose
 * consumers are calibrated for exactly that: the renderer clamps `gl_POINT_SIZE` and
 * `estimateParticlePixels()` mirrors the clamp through `channelSizeMin`. **Past the ceiling the
 * compensation is silently CLIPPED by the driver** — a track dead at its top for a reason outside it —
 * so a x15.6 request buys nothing and costs fill rate on the splat path, where the primitive is a quad.
 *
 * **So the compensation SATURATES rather than tracking `det J` exactly at extremes, and that is a stated
 * limitation, not a defect**: it is exact over the range the slider is usable in and bounded beyond it.
 * Matching the channel law's own span keeps ONE calibration instead of two.
 */
export const DEFORM_ENERGY_SPAN = 5;

/**
 * `E133` — the smallest radius the inversion may divide by, as a fraction of the figure's half-extent.
 *
 * ⚠️ **AT THE CENTRE THE MAP IS A TRUE POLE**, so this is a magnitude guard on the same footing as
 * `W_MIN_DEN_FRACTION`: an epsilon would admit a magnification of millions, which reaches the user as one
 * stray dot at infinity rather than as an error — and ANGLE drops a vertex at infinity entirely, so the
 * symptom is a MISSING particle, not a broken one.
 */
export const INVERT_MIN_R_FRACTION = 0.02;

/** `E133` — the inversion sphere's radius, as a multiple of the figure's half-extent. */
export const INVERT_RADIUS_MIN = 0.25;
export const INVERT_RADIUS_MAX = 2;
export const INVERT_STEP = 0.01;

/**
 * `32.1` — the taper readout. ⚠️ **`0` prints `Off`, matching `fmtTwistTurns`**: zero is where the
 * operator's loop is skipped entirely, so the readout should say it is not running rather than report a
 * magnitude of nothing.
 *
 * The sign carries the gesture and the words are the point: a positive taper widens the far end of the
 * axis and a negative one narrows it, and *"flare"* / *"pinch"* is the pair a user can act on, where a
 * bare signed number is not.
 */
export function fmtTaper(amount: number): string {
  if (amount === 0) return 'Off';
  return `${amount > 0 ? 'flare' : 'pinch'} ${Math.abs(amount).toFixed(2)}`;
}

/**
 * `32.2` — the bend readout. Same `Off` rule.
 *
 * ⚠️ **It reports the RADIUS OF CURVATURE as well as the rate, because that is the quantity the limit is
 * about.** Barr's determinant vanishes at `u = 1/k`, so `1/k` is where the figure would evert; printing it
 * tells the user how close the arc's centre is to the figure in the figure's own units, which the rate
 * alone cannot.
 */
export function fmtBend(rate: number): string {
  if (rate === 0) return 'Off';
  const radius = 1 / Math.abs(rate);
  return `${rate > 0 ? '+' : '−'}${Math.abs(rate).toFixed(2)} (r ${radius.toFixed(1)})`;
}

/** `32.7` — the inversion amount. `0` prints `Off`: it is the stage's gate. */
export function fmtInvertAmount(a: number): string {
  return a === 0 ? 'Off' : `${(a * 100).toFixed(0)}%`;
}

/** `32.7` — the inversion sphere, as a multiple of the figure's half-extent. */
export function fmtInvertRadius(r: number): string {
  return `${r.toFixed(2)}x figure`;
}

/* ---- `33.2` (Sharpness) — the basis function, not a deformation ------------------------------------- */

/**
 * `33.2` — how far the generator's basis is moved from `sin` toward a triangle wave. 0 = pure sine.
 *
 * ⚠️⚠️ **THE GUARANTEE HERE IS A PUBLISHED THEOREM AND IT IS THE REASON THIS CONTROL IS SAFE ON ALL 294
 * PRESETS.** Jones & Przytycki, *Banach Center Publications* **42** (1998) 145–163, DOI
 * `10.4064/-42-1-145-163`, Theorem 1.3: over their family **F** of continuous `f` with `f(t+1) = −f(t)`,
 * `f(−t) = f(t)`, `f(0) = 1` and `f` strictly decreasing on `(0, ½)`, the resulting knot **does not depend
 * on which member of F is used**. **F is convex**, and it contains both the cosine and the sawtooth — so
 * every value of this control yields the SAME KNOT TYPE as every other. **The figure changes its visual
 * language and provably cannot change its topology.**
 *
 * ⚠️ **It is NOT a deformation and `facetcheck` §B records that**: it changes the BASIS FUNCTION of the wave
 * sum, not positions as a function of position. The `Deformed` chip would be wrong about it.
 *
 * ⚠️ **AND THE VISIBLE DIFFERENCE IS ONLY 0.4 % OF THE SPECTRAL ENERGY.** A triangle wave keeps 99.6 % of
 * its energy in three harmonics, so what a user sees is the CORNER — which a high-accumulation trail
 * smears away. **Judge it on `Quader`/`Pipes`/`Cylinder` and measure the final 8-bit output**, never on a
 * heavy preset. The measured compensation: the triangle form runs at a speed ratio of **2.1** against the
 * smooth generator's **5.8**, so it also FLATTENS particle density, which additive splatting wants.
 */
export const SHARPNESS_MAX = 1;

/** `33.2` — slider resolution. One percent of the full travel, like `CHANNEL_STEP`. */
export const SHARPNESS_STEP = 0.01;

/**
 * `33.2` — the readout. **`Off` at exactly 0, because 0 is the identity and the code BRANCHES on it.**
 *
 * ⚠️ There is no dead zone here and that is deliberate, unlike `twist`/`taper`/`bend`: this control is
 * one-sided (0..1, not centre-off), so there is no centre to aim at and `DEAD_ZONE_FRACTION` has nothing
 * to apply to. A snap would only make the bottom of the range unreachable.
 */
export function fmtSharpness(s: number): string {
  if (s === 0) return 'Off';
  if (s >= SHARPNESS_MAX) return 'faceted';
  return `${(s * 100).toFixed(0)}% faceted`;
}

/* ---- `33.3` (Travel) — the secular term -------------------------------------------------------------- */

/**
 * `33.3` — the per-axis secular (linear) term, as a FRACTION OF THE DESIGN HALF-EXTENT across the whole
 * population. `travelZ: 1` sweeps the figure one half-extent along z from the first particle to the last.
 *
 * ⚠️⚠️ **NOTHING AUTO-FITS THIS AND THAT IS WHY THE BOUND IS A CONSTANT RATHER THAN A MEASUREMENT.**
 * `project()` multiplies by `waveScale = uniformFit(designW, designH)`, a **fixed** scale taken from the
 * design box at `init()` — and **no code anywhere measures the curve's own extent.** So a secular term can
 * walk the figure out of frame and no fit will catch it; the clamp is the only thing between a slider and
 * a figure nobody can see. 1.0 of the half-extent is the largest sweep that still leaves the oscillating
 * part of a typical figure inside the box.
 *
 * ⚠️ **IT MAKES THE FIGURE OPEN, which is the point and the risk.** Every other figure in the library is a
 * closed loop oscillating in place; a secular term gives an arc with two free ends. **No finite sum of
 * sinusoids can produce a monotone ramp**, which is exactly why this one line reaches helices, conical
 * spirals and spherical spirals that the generator cannot otherwise draw at any winding.
 */
export const TRAVEL_MAX = 1.0;

/** `33.3` — slider resolution, matching the other centre-off triples. */
export const TRAVEL_STEP = 0.01;

/**
 * `33.3` — the dead zone, **DERIVED from `DEAD_ZONE_FRACTION` exactly as `TWIST_SNAP` is.**
 *
 * ⚠️ `32.14` established the rule and the reason: one absolute constant cannot serve three ranges, so the
 * FRACTION is the rule and every snap is its consequence. Widening `TRAVEL_MAX` therefore cannot silently
 * shrink the aimable zone. **A centre-off slider the user cannot return to zero is a control with no off.**
 */
export const TRAVEL_SNAP = TRAVEL_MAX * DEAD_ZONE_FRACTION;

/** `33.3` — the travel readout. `Off` inside the dead zone, since that is where the setter snaps to 0. */
export function fmtTravel(t: number): string {
  if (t === 0) return 'Off';
  return `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(2)} half-extent`;
}

/* ---- `34.2` (Offset) — the DC translation term -------------------------------------------------------- */

/**
 * `34.2` — the per-axis DC term, as a **FRACTION OF THE DESIGN HALF-EXTENT**. `offsetX: 1` moves the whole
 * figure one half-extent along x. **Shares `halfExtent` with `TRAVEL_MAX`'s own term**, so the two rows read
 * in one unit and an author can compare them.
 *
 * ⚠️ **±2.0 IS DERIVED, NOT PICKED, AND THE SPECIFICATION'S OWN NUMBER AGREES ONCE THE UNIT CHANGES.** The
 * spec measured the useful band directly: an offset of ~1× the figure radius opens a ball into a torus with
 * a hole, ~2.6× gives a wide wreath. A library-typical Body amplitude is **25.00 design units** (the MEDIAN
 * of 830 live Body slot-axes, `PHASE34-BASES.md` §2) against the 50-unit half-extent of the 100×100
 * design box every legacy preset carries — i.e. a figure radius of ~0.5 half-extents for a median preset and
 * ~1.0 at p75. So 2.6 radii lands between 1.3 and 2.6 half-extents, and **2.0 reaches the wreath on a
 * typical figure while stopping short of it on a large one.** ⚠️ It is also EXACTLY the spec's ±100 on a
 * 100×100 box (one design box either way), so only the UNIT is being changed and not the reach — which is
 * `34.D3` applied rather than a re-pricing.
 *
 * ⚠️⚠️ **NOTHING AUTO-FITS THIS, exactly as nothing auto-fits `Travel`, and the two now COMPOSE.** A figure
 * can carry both, so the worst case is `|offset| + |travel|` half-extents from the origin on one axis. On Z
 * that reaches the perspective divide — see `34.D9`'s readout, which is the only guard this phase adds and
 * is deliberately a READOUT rather than a clamp.
 *
 * ⚠️⚠️ **AND THIS BOUND IS NOT DERIVED BY `TRAVEL_MAX`'s STANDARD, THOUGH IT SHARES ITS UNIT — MEASURED
 * 2026-10-29, AND THE ASYMMETRY IS STATED RATHER THAN LEFT TO BE REDISCOVERED.** On the median-amplitude
 * host of `GROW_MAX`'s table (1440×900, design 100×100, `figureScale` 1): `travelX` at `TRAVEL_MAX` puts
 * **0.0 %** of the figure off-frame — its header's claim that 1.0 is *"the largest sweep that still leaves
 * the oscillating part of a typical figure inside the box"* reproduces exactly — while `offsetX` at
 * `OFFSET_MAX` puts **76.9 %** off-frame. **The two are not the same kind of number: `TRAVEL_MAX` is a
 * FITTING bound and this is a REACH.** The reason a fitting bound is impossible here is the aspect ratio:
 * `uniformFit` maps the design box onto the canvas's SHORTER dimension, so one half-extent is about the
 * half-HEIGHT, and the largest offset that keeps a median figure framed is ~1.0 on x and ~0.5 on y. **One
 * constant cannot be both** (invariant 26: an image-domain length must be measured on one shared scale),
 * and `34.D3` chose the design-box derivation precisely because a canvas-fitting one is canvas-dependent
 * and *a preset cannot compensate for a canvas-dependent error*. **The usable band is therefore well below
 * the bound, and the bound is what the control may reach.**
 *
 * ⚠️ **It is the term the ROTATION is taken about.** The generator rotates about the model origin, so every
 * figure in the library spins in place; an offset turns that same spin into an orbit. **That motion is the
 * operator's entire value** (the translation itself is exact — the spec measures max deviation `0.00e+0`
 * from a clean shift), which is why `34.D13` keeps it out of the Randomiser: a random offset breaks the
 * centring every preset relies on.
 */
export const OFFSET_MAX = 2.0;

/** `34.2` — slider resolution, matching every other centre-off figure triple (400 stops over the range). */
export const OFFSET_STEP = 0.01;

/**
 * `34.2` — the dead zone, **DERIVED from `DEAD_ZONE_FRACTION` exactly as `TRAVEL_SNAP` is** (`32.14`): the
 * FRACTION is the rule and every snap is its consequence, so widening `OFFSET_MAX` cannot silently shrink
 * the aimable zone. A centre-off slider the user cannot return to zero is a control with no off.
 */
export const OFFSET_SNAP = OFFSET_MAX * DEAD_ZONE_FRACTION;

/** `34.2` — `Off` at exactly 0, which is where the setter snaps. Unit shared with `fmtTravel`. */
export function fmtOffset(o: number): string {
  if (o === 0) return 'Off';
  return `${o > 0 ? '+' : '−'}${Math.abs(o).toFixed(2)} half-extent`;
}

/* ---- `34.3` (Grow) — the along-curve amplitude ramp --------------------------------------------------- */

/**
 * `34.3` — ⚠️⚠️ **THE AMPLITUDE RAMP COEFFICIENT `k`, NOT A MULTIPLIER. `0` IS THE IDENTITY, NOT `1`.**
 *
 * The stroke's amplitude runs `am · (1 + k·τ)` from the first particle (`τ = 0`) to the last (`τ → 1`). So
 * at `k = 0` the multiplier is exactly 1 for every particle and the figure is bit-identical to one that
 * never authored the key. **A reader who sees the word "multiplier" and writes `1` as the default scales
 * every amplitude by `1 + τ`, doubling the far end of every stroke in the library** — and `tsc` sees
 * `number`, `OVERLAY_RULES` cannot express an identity, and no preset would change in a way a checker
 * notices. **This is the one defect in the phase that would be silent and library-wide**, which is why the
 * statement is repeated in `OverlayState.growX`'s own doc comment, in `SCALAR_IDENTITIES` (beside
 * `invertRadius: 1.0`, the counter-example), in `CONTROL_TIPS.grow` and in `fmtGrow` below.
 *
 * **THE FLOOR IS STRUCTURAL, NOT A TASTE.** At exactly −1 the amplitude reaches 0 at the end of the stroke —
 * a full taper to a point. Below −1 it goes NEGATIVE, which is a phase inversion mid-stroke: mathematically
 * fine, visually a fold-back, and impossible to read from the control. **Clamp at −1**, and the clamp has to
 * be on the RESOLVED value because a base of 0 with a `Flare` depth of 2 would reach −2 without it.
 */
export const GROW_FLOOR = -1;

/**
 * `34.3` — the ceiling. ⚠️ **IT CANNOT COME FROM THE DESIGN BOX THE WAY `OFFSET_MAX` DOES, because the
 * figure already fills the box** — so this is a LEGIBILITY bound and is stated as one.
 *
 * ⚠️⚠️ **MEASURED 2026-10-29 rather than picked, because this file's own rule is to derive a bound from the
 * worst case and never to pick one that passes.** Method: the generator driven under Node on a
 * median-amplitude host (`am.base` 25.00 on all three axes of a 100×100 design box, windings 1/2/3, the
 * `PHASE34-BASES.md` §2 median), canvas **1440×900**, `figureScale` 1, 2000 particles, measuring
 * what fraction of the LAST TENTH of the population — the end of the stroke, where the ramp is largest —
 * projects outside the canvas. Measured, `k` applied to all three axes:
 *
 * | k | last tenth off-frame | whole population off-frame |
 * |---|---|---|
 * | 0.0 … 1.7 | **0.0 %** | 0 % at 0.5, 4.4 % at 1.0 |
 * | 1.8 | **1.5 %** (the first k at which the stroke's end leaves at all) | 15.8 % |
 * | 2.0 | 6.5 % | 21.1 % |
 * | 3.0 (`GROW_MAX`) | **22.5 %** | 30.3 % |
 *
 * **So the legible limit is k ≈ 1.8 and the bound is 3: the top of the range is deliberately past it**, for
 * `TRAVEL_MAX`'s reason — the constant is what the control may REACH, not a recommendation — and the
 * authoring band is 0.5 … 1.8. ⚠️ It is also what makes the specification's own strongest-evidenced value
 * (2.6) and its breathing demo's peak (+2.4) authorable; capping at 1.8 would have made both unreachable.
 * ⚠️ **Every figure above is CANVAS-dependent** (invariant 27: `waveScale = min(cw/designW, ch/designH)`,
 * so a taller window clips sooner), which is the second reason this is a stated reach rather than a safety
 * guarantee.
 *
 * ⚠️ **It is DELIBERATELY BELOW the spec's +4, and the spec's own demos are the evidence**: its
 * strongest-evidenced Grow value is 2.6 and its breathing demo peaks at +2.4. +4 is two design boxes of
 * overshoot that nothing authored needs.
 */
export const GROW_MAX = 3;

/** `34.3` — slider resolution. 400 positions over the full range, matching `TRAVEL_STEP`'s density. */
export const GROW_STEP = 0.01;

/*
 * `34.3` — ⚠️ **NO DEAD ZONE, and the reason is the RANGE's SHAPE rather than a preference.**
 * `DEAD_ZONE_FRACTION` is 8 % of HALF travel and this range is ASYMMETRIC (−1 … +3), so there is no single
 * half for the fraction to apply to and no centre for a mouse to aim at: the identity 0 sits at 25 % of
 * travel, which a drag reaches on the 0.01 grid exactly. `SHARPNESS_MAX`'s header makes the same argument
 * for a one-sided range. **A snap here would only make part of the range unreachable.**
 */

/**
 * `34.3` — ⚠️ **never prints a bare multiplier at 0; see `GROW_FLOOR`'s identity trap.** `Off` at exactly 0
 * and the floor names itself, so a reader cannot mistake the stored 0 for a multiplier OF zero.
 */
export function fmtGrow(k: number): string {
  if (k === 0) return 'Off';
  if (k <= GROW_FLOOR) return 'tapers to a point';
  return `×${(1 + k).toFixed(2)} at the end`;
}

/* ---- `34.4` — the four breathing DEPTHS, each derived from its own base range ------------------------- */

/**
 * The rule, written once for all four: **a depth's ceiling is its base range's HALF-WIDTH.**
 *
 * That is the largest depth which can reach every resolved value in the range; a larger one buys only DWELL
 * duration, and a dwell is better set by moving the BASE toward a bound. ⚠️ **Deriving rather than picking
 * is `32.14`'s lesson applied to depth**: widening a base range cannot then silently leave its depth
 * behind, which is exactly how one absolute `0.05` came to serve three different ranges at 2.5 %, 5.3 % and
 * 5.9 % of travel.
 *
 * ⚠️ **ALL FOUR ARE SIGNED (`±max`), so all four are centre-off and all four owe a dead zone** (`32.14`
 * again). **A sign is not redundant with the rate**: it is the only way to put two axes in ANTIPHASE at one
 * rate, which is `WaveParam.amplitude`'s own reason for being signed.
 *
 * ⚠️ **THE RESOLVED VALUE IS CLAMPED, NOT THE DEPTH AGAINST ITS BASE** (spec §2.4, adopted whole). The
 * rejected alternative — constraining the UI so `base ± depth` stays in range — makes the depth slider's
 * maximum depend on the base slider's value, i.e. two interdependent controls for one quantity. **A clamped
 * cycle DWELLS at the bound instead of passing through it, which is a FEATURE the readouts must state** or
 * the next reader removes it as a stuck slider.
 */
/** `34.4` — `Temper`'s depth. Half-width of `[0, SHARPNESS_MAX]`. */
export const SHARPNESS_DEPTH_MAX = SHARPNESS_MAX / 2;
/** `34.4` — `Stretch`'s depth. Half-width of `[−TRAVEL_MAX, +TRAVEL_MAX]`. */
export const TRAVEL_DEPTH_MAX = TRAVEL_MAX;
/** `34.4` — `Sway`'s depth. Half-width of `[−OFFSET_MAX, +OFFSET_MAX]`. */
export const OFFSET_DEPTH_MAX = OFFSET_MAX;
/** `34.4` — `Flare`'s depth. Half-width of the ASYMMETRIC `[GROW_FLOOR, GROW_MAX]`. */
export const GROW_DEPTH_MAX = (GROW_MAX - GROW_FLOOR) / 2;

/** `34.4` — the four dead zones, each `DEAD_ZONE_FRACTION` of its own half travel. Derived, never typed. */
export const SHARPNESS_DEPTH_SNAP = SHARPNESS_DEPTH_MAX * DEAD_ZONE_FRACTION;
export const TRAVEL_DEPTH_SNAP = TRAVEL_DEPTH_MAX * DEAD_ZONE_FRACTION;
export const OFFSET_DEPTH_SNAP = OFFSET_DEPTH_MAX * DEAD_ZONE_FRACTION;
export const GROW_DEPTH_SNAP = GROW_DEPTH_MAX * DEAD_ZONE_FRACTION;

/**
 * `34.4` — the ONE readout shape for all four depths, so the DWELL is explained in one place.
 *
 * ⚠️ **`clipped` IS THE CALLER'S MEASUREMENT, NOT THIS FUNCTION'S**, and it has to be: whether a swing hits
 * a bound depends on the live BASE, which only the panel can read back from the engine (`32.14`'s rule — the
 * engine clamps and snaps, and the panel must print what the engine took). The caller tests
 * `base ± |depth|` against the operator's own range and passes the answer in.
 */
export function fmtDepth(d: number, unit: string, clipped: boolean): string {
  if (d === 0) return 'Off';
  return `±${Math.abs(d).toFixed(2)} ${unit}${clipped ? ' (clipped)' : ''}`;
}

/* ---- `34.4` — the breathing RATE, ONE track for all four operators ----------------------------------- */

/**
 * `34.4` — the rate ceiling for every breathing operator this phase adds.
 *
 * ⚠️ **ONE constant for all four, because the quantity is one quantity.** `34.D11` makes the KEYS per axis;
 * it does not make the BOUND per axis.
 *
 * ⚠️ **A RATE IS NOT A LENGTH, so `34.D3`'s design-box derivation has nothing to say about it.** The basis
 * is `modulatorSeconds()` plus the library's measured `waveSpeed`, and that basis travels with the number:
 * `modulatorSeconds(rate, waveSpeed) = |360/rate| / (POS_PER_SECOND · |waveSpeed|)` with `POS_PER_SECOND =
 * 60` (`ui/synthesis-lab/composer-model.ts`), i.e. **`seconds = 6 / (rate · waveSpeed)`**. Measured
 * 2026-10-29 over 310 authored `waveSpeed` literals across every preset module: **min 0.005, p25 0.05,
 * median 0.05, p75 0.05, max 0.5** — a literal count rather than a per-preset count, but p25 = median = p75,
 * so the reference is robust. At `waveSpeed = 0.05`, `seconds = 120 / rate`.
 *
 * **60 = a 2-second cycle at that reference.** Below 2 s a morph of half a per-cent of the radius per frame
 * reads as a flicker rather than as a transformation.
 */
export const OP_RATE_MAX = 60;

/**
 * `34.4` — the slowest NON-ZERO rate. **0.4 = a 300-second cycle at the reference `waveSpeed` 0.05**, past
 * which the breathing cannot complete inside a viewing session and reads as static.
 *
 * ⚠️ **The spec's §12.3 demo rates (0.05 … 0.15) are an ORDER OF MAGNITUDE below this floor** — 860 s to
 * 2400 s — and would all read as static. **Re-derive every authored rate through `modulatorSeconds()`**; the
 * 6–90 s band a demo wants is rate **1.3 … 20**.
 */
export const OP_RATE_MIN = 0.4;

/**
 * `34.4` — ⚠️ **A GEOMETRIC TRACK WITH A STICKY ZERO, and both halves are forced.**
 *
 * Geometric because halving a period must cost the same travel as doubling it (the octave rule): the span is
 * `OP_RATE_MIN … OP_RATE_MAX`, **150×, i.e. 7.2 octaves**, and a linear track would spend 99 % of its throw
 * above 1 s. Sticky zero because `0` must stay reachable EXACTLY — `modulatorSeconds` returns `null` there,
 * which is the "never cycles" state and the operator's identity — and **a pure log map has no zero at all**
 * (`ln 0 = −∞`). The precedent is `CYCLES_TRACK` and `COLOUR_DRIFT_TRACK`, both of which quantise the bottom
 * few per cent of travel to exactly 0 and say so.
 *
 * ⚠️ **`OP_RATE_STEP` IS A TRACK POSITION STEP (0…1), NOT A VALUE STEP.** These four descriptors therefore
 * carry a `toPos`/`fromPos` pair, unlike every other constant in this file — **a tracked spec's `min`/`max`
 * are POSITIONS and a value constant there kills the travel** (`trackcheck` §G2 asserts exactly that).
 *
 * ⚠️ **THE LAW AND THE TRACK DISAGREE ON PURPOSE.** The track is geometric; the `OVERLAY_RULES` law is
 * `lerp`, because `geometric` is `exp(inv·ln a + t·ln b)` and `ln 0` is `−∞` — **a key whose identity is 0
 * cannot have a geometric mix law.** The same split already exists for `colorShift`. Do not "fix" one half
 * to match the other.
 */
export const OP_RATE_STEP = 0.005;
/** `34.4` — how much of the track's bottom maps to exactly 0. 2 % = four stops at `OP_RATE_STEP`. */
export const OP_RATE_ZERO_BAND = 0.02;

/**
 * `34.4` — the FIRST LIVE POSITION: one `OP_RATE_STEP` above the zero band's top.
 *
 * ⚠️⚠️ **IT IS NOT COSMETIC AND THE FIRST DRAFT OF THE TRACK DID NOT HAVE IT — `trackcheck` §N caught the
 * defect on its first run.** With the geometric map anchored at the band's TOP, the band's top position maps
 * to 0 (it is inside the band) and the first stop ABOVE it mapped to **0.4104**, so `OP_RATE_MIN` itself was
 * **unreachable by a drag**: the slowest rate the readout and both headers describe was not a value the
 * control could produce. **That is this file's own rule — an authored value the track cannot represent is a
 * defect** — and reachability and resolution are separate properties, the first of which passes green on a
 * useless track.
 *
 * Anchoring the map one STEP further along makes the first live stop exactly `OP_RATE_MIN`. ⚠️ It therefore
 * **depends on `OP_RATE_STEP`**: changing the step moves the anchor, which is correct (the anchor is *the
 * first stop a drag can reach*) and is the reason it is derived rather than written as 0.025.
 */
export const OP_RATE_LIVE_FROM = OP_RATE_ZERO_BAND + OP_RATE_STEP;

/**
 * `34.4` — the rate track. ⚠️ **`fromPos` is the authority and `toPos` is its inverse ABOVE the zero band**;
 * inside the band `toPos` answers 0, so a stored 0 puts the handle at the hard left where a drag can return.
 *
 * ⚠️ A stored rate between 0 and `OP_RATE_MIN` (reachable only from a hand-edited import) maps to the first
 * live position rather than below it, so the handle is never left where `fromPos` is a different value.
 */
export const OP_RATE_TRACK = {
  toPos(v: number): number {
    if (!(v > 0)) return 0;
    const u = Math.log(v / OP_RATE_MIN) / Math.log(OP_RATE_MAX / OP_RATE_MIN);
    return OP_RATE_LIVE_FROM + Math.max(0, Math.min(1, u)) * (1 - OP_RATE_LIVE_FROM);
  },
  fromPos(pos: number): number {
    if (pos <= OP_RATE_ZERO_BAND) return 0;
    const u = (pos - OP_RATE_LIVE_FROM) / (1 - OP_RATE_LIVE_FROM);
    return OP_RATE_MIN * Math.pow(OP_RATE_MAX / OP_RATE_MIN, Math.max(0, Math.min(1, u)));
  },
};

