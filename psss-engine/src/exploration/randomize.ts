import type { MaterialConfig, MaterialPresetName, UnifiedPreset } from '../presets/types.ts';
// ⚠️ `RenderMode` lives in `core/interfaces.ts`, NOT in `presets/types.ts` which only re-declares it
// locally — the mode is a RENDERER concept the preset format happens to persist.
import type { RenderMode } from '../core/interfaces.ts';
import type { PaletteMapping } from '../renderers/film-looks.ts';
import type { CategoryLock } from './state.ts';
import type { KeysWithMutate, MutateLaw } from './overlay-rules.ts';
import type { PresetStatistics } from './preset-stats.ts';
import { deepCopy } from './state.ts';
import { ATTRACTOR_ENTRY_BLEND, OVERLAY_RULES } from './overlay-rules.ts';
import { ATTRACTOR_PRESETS } from '../generators/attractors.ts';
import { getMaterialPreset, MATERIAL_PRESETS, resolveModeAgainstMaterial } from '../generators/material-presets.ts';
import { FILM_LOOKS } from '../renderers/film-looks.ts';
import { getAllPaletteNames } from '../presets/palettes.ts';
import {
  chainFromOverlay,
  isSeparableStyle,
  makeLayer,
  TRANS_MAP_STYLES,
} from '../post-processors/trans-map-chain.ts';
import {
  findArchetype,
  isStaticFieldDefault,
  randomStaticField,
  staticFieldOf,
} from '../post-processors/static-field.ts';

export type Intensity = 'subtle' | 'medium' | 'wild';

/**
 * Every tier the mutator can run at, which since Phase 25 is **one more than the user can select**.
 *
 * ⚠️ **`'near'` IS DERIVED FROM `Intensity`, NOT A PARALLEL UNION (25.D10).** `25.D6` asks for "one new σ
 * below `subtle` and nothing else — no fourth control", so the tier has to exist for the mutator and not for
 * any UI. Writing it as `Intensity | 'near'` is what makes that shape a compile fact: every switch over a
 * USER choice still narrows to three, while `INTENSITY` is keyed by all four and cannot be missing a row.
 *
 * ⚠️ **Widening `Intensity` itself would have been the smaller edit and the wrong one** — it is the type the
 * Randomiser's and Evolution's selectors are written against, so a fourth member there is a tier the UI is
 * silently allowed to offer and a fourth button nobody notices is missing.
 */
export type MutationTier = Intensity | 'near';

/**
 * The tier a CARRIED PARENT is re-mutated at: one step gentler than the selector (`25.D6`).
 *
 * ⚠️ **It is a table rather than an index arithmetic over an ordered array**, because the scale's ends are
 * not symmetric: `wild → medium` is a large step down and `subtle → near` is a small one, and an ordered
 * array would invite "shift by one" to be read as a property of the scale rather than as four decisions.
 */
export const CARRY_TIER: Record<Intensity, MutationTier> = {
  subtle: 'near',
  medium: 'subtle',
  wild: 'medium',
};

/**
 * The modes the Randomiser is allowed to HAND OUT — **a deliberate SUBSET of `RenderMode`, and widening it
 * is the one change here that would reach a user as a black canvas.**
 *
 * ⚠️ This one is stricter than the other two subsets because `applyStyleJump` backs it with a **VALUE
 * ARRAY** it picks from at random, so every member is something the Randomiser will eventually produce
 * unprompted, on a preset the user did not author. `splat` renders black without a live material; `volume`
 * needs a `volumeRender` block; and any mode with its own required companion state belongs here only once
 * the Randomiser also produces that state.
 *
 * ⚠️ **`splat` STILL DOES NOT BELONG HERE, THOUGH `24.5` GAVE THE RANDOMISER A MATERIAL OWNER.** The
 * material jump reaches `splat` the only safe way — by setting a live material and letting
 * `resolveModeAgainstMaterial()` ask for the mode (`writeMaterialAndMode()` below). A member here would be
 * a mode drawn with no reference to the material at all, which is the black frame.
 *
 * ⚠️ **Named rather than inlined so the subset is stated in the TYPE** (v8 Step 15.0) — the array and its
 * annotation are two places one omission can hide, and the annotation is what stops the array from quietly
 * gaining a member. `OVERLAY_RULES.renderMode.mutate.members` names this constant, so the table's member
 * owner and the draw are the same object.
 */
export type RandomisableRenderMode = 'pixel' | 'blend' | 'star';

// ⚠️ **THREE MEMBERS SINCE `log-density` WAS RETIRED (2026-09-19), AND THE TYPE IS THE GUARD.** The array is
// a VALUE, so a mode dropped from `RenderMode` leaves it a type error rather than a dead string.
export const RANDOMISABLE_RENDER_MODES: readonly RandomisableRenderMode[] = ['pixel', 'blend', 'star'];

/**
 * What an intensity MEANS — one row per tier, and the row is the whole definition of the tier.
 *
 * ⚠️ **THIS WAS A BARE `Record<Intensity, number>` NAMED `SIGMA` UNTIL 2026-10-05 (24.4), AND THE TABLE IS
 * THE POINT.** The three tiers now differ in two independent ways, not one: how far a continuous nudge
 * travels, and **whether a press may re-roll a categorical identity at all** (24.D5). A second
 * `Record<Intensity, boolean>` beside the first would be the two-enumerations defect in miniature — a tier
 * added to one and not the other compiles, and reads as a tier that quietly behaves like `medium`.
 *
 * ⚠️ **`subtle: categorical false` IS A PROMISE THE TAB MAKES IN WORDS** ("Subtle never changes the palette,
 * the material or the warp style"), so it is also the one row whose meaning a user can check. It is enforced
 * in ONE place — `pickStrategy()` drops the `Look jump` from the draw — rather than by each owner testing the
 * intensity, because five owners testing a tier is five places a new tier can be forgotten.
 *
 * ⚠️ Phase 25 adds a fourth tier BELOW `subtle` (`25.D6`) and a per-tier column of its own (`25.D8`). Both
 * are one line here if this stays a table of profiles, and a refactor if it reverts to a scalar.
 */
interface IntensityProfile {
  /** One standard deviation, as a fraction of a control's FULL TRAVEL — not of its current value. */
  sigma: number;
  /** May a press of this tier re-roll a categorical identity (the grade, palette, material, warp or attractor)? */
  categorical: boolean;
  /**
   * Phase 25 (`25.D8`): how strongly Evolution's per-gene coin leans toward the DOMINANT parent. `0.5` is an
   * even coin; `0.85` means the dominant parent wins a gene 85 % of the time.
   *
   * ⚠️ **Read by `crossoverPresets`, not by anything in this file** — it lives here because `25.D8` says it
   * belongs beside the σ table "as a fourth row of the same constant, not as a free literal in
   * `crossoverPresets`", and because the reason it exists is a statement about what the WORD `subtle` means:
   * without it a Subtle child can arrive with a grade, palette or render mode neither parent is known for,
   * which is the opposite of the promise. **Subtle means loyal as well as small.**
   */
  dominance: number;
  /**
   * Phase 25 (`25.D11`): the probability that a crossover child is mutated at all, which strength scales
   * **in addition to** σ. ⚠️ **`medium` is exactly `0.60` so the default stays byte-comparable with the
   * behaviour that shipped before Phase 25** — the figure was a bare `Math.random() < 0.6` in
   * `breedGeneration`. The reason a probability was needed as well as a σ: at Subtle, σ alone still mutated
   * six children in ten, and the complaint the word invites is *"it changed more than I asked"*.
   */
  mutateProbability: number;
}

/**
 * ⚠️ **FOUR ROWS SINCE 2026-10-06 (25.D6) AND FOUR COLUMNS SINCE THE SAME DAY (25.D8, 25.D11).** The table
 * shape is doing real work: this is now the single place that answers "what does this tier mean" for three
 * tabs' worth of behaviour, and the header above is the argument for why it must not revert to scalars.
 *
 * ⚠️ **`near` IS NOT SELECTABLE AND MUST NEVER JUMP A CATEGORICAL** (`25.D6`). It exists only as the tier a
 * carried parent is re-mutated at under `Subtle`, and `categorical: false` is load-bearing there: a carried
 * tile that re-skinned itself would be *louder* than the children beside it, which breaks the one promise
 * the gentlest setting makes. Its σ is deliberately a third of `subtle`'s rather than half — the carry has to
 * read as "the tile you picked, varied" and not as "a new tile".
 */
const INTENSITY: Record<MutationTier, IntensityProfile> = {
  near: { sigma: 0.015, categorical: false, dominance: 0.85, mutateProbability: 1.00 },
  subtle: { sigma: 0.05, categorical: false, dominance: 0.85, mutateProbability: 0.35 },
  medium: { sigma: 0.15, categorical: true, dominance: 0.50, mutateProbability: 0.60 },
  wild: { sigma: 0.40, categorical: true, dominance: 0.50, mutateProbability: 0.85 },
};

/**
 * The two Phase 25 columns, read by `evolution-ops.ts`. ⚠️ **An accessor rather than exporting `INTENSITY`
 * itself**, so the table stays this module's own and a second reader cannot start depending on `sigma` or
 * `categorical` — those two are enforced in ONE place here (see `pickStrategy`) and a tier test spreading to
 * five owners is the defect that header warns about.
 */
export function tierProfile(tier: MutationTier): { dominance: number; mutateProbability: number } {
  const p = INTENSITY[tier];
  return { dominance: p.dominance, mutateProbability: p.mutateProbability };
}

/**
 * How often each strategy is drawn. **Sum = 1.00, and that is asserted by `mixercheck` §I rather than
 * trusted.**
 *
 * ⚠️ **RE-DERIVED FROM SCRATCH ON 2026-10-05 (24.4), NOT SCALED FROM THE OLD SIX-MEMBER ARRAY.** A rescaling
 * would have been the easy edit and would have carried forward a distribution nobody had re-examined since
 * the Randomiser was pre-overlay — when a "press" could only ever re-shape the figure, because the figure was
 * the only thing it could write. The derivation, stated so the next reader can disagree with the reasoning
 * rather than with the numbers:
 *
 *  - **One press in three is a continuous nudge** (`0.34`). The jitter is the only strategy that moves many
 *    parameters a little, so it is what "randomise" means when a user is converging on something they like.
 *    It was `0.45`, which made two presses in five a nudge — too many once there are five identities worth
 *    re-skinning.
 *  - **One press in five re-skins ONE identity** (`0.20`, the new `Look jump`). Five subjects share it
 *    (grade, palette, material + mode, warp style, attractor), so each arrives at about **4 %** of presses —
 *    deliberately rarer than any figure gesture, because a new palette or material is the most visible single
 *    change the Randomiser can make and a user who wanted that has the Visual FX tab.
 *  - **The remaining 46 % are the four figure gestures**, split by how much of the figure each one re-shapes:
 *    the wave swap and the frequency doubling re-shape the WHOLE figure (`0.13` each), the phase rotation and
 *    the mode jump change its pose or its material-free skin (`0.07` each), and the static-field jump gets
 *    `0.06` because it is the one strategy that reaches only a subset of presets — those with a separable
 *    TransMap layer — so a higher weight would spend presses doing nothing on everything else.
 *
 * ⚠️ **AT `subtle` THE TWO CATEGORICAL STRATEGIES ARE REMOVED FROM THE DRAW AND THE OTHER FIVE RENORMALISE
 * OVER `0.73`**, which puts the jitter at **46.6 %** against today's 45 %: `Subtle` therefore keeps very
 * nearly the press mix it has always had, and the whole re-derivation lands on `medium` and `wild`. That is
 * the property to preserve if these numbers are ever re-tuned — **a user who liked `Subtle` did not ask for
 * a new tab.**
 */
const STRATEGY_WEIGHTS = [0.34, 0.13, 0.07, 0.13, 0.07, 0.06, 0.20];
// Strategies: 0=gaussian jitter, 1=wave swap, 2=style jump, 3=freq doubling, 4=phase rotation,
//             5=static field jump, 6=look jump  ⚠️ **the index IS the contract** — `pickStrategy()` returns
//             one and the `switch` below dispatches on it, so inserting a strategy in the MIDDLE silently
//             re-points every weight. Append.
/**
 * The strategies whose subject is a CATEGORICAL field, which `subtle` withholds (24.D5).
 *
 * ⚠️ **THIS WAS `LOOK_JUMP = 6` AND A `last` CUTOFF, AND IT WAS WRONG THE MOMENT DEFECT 1 WAS FIXED
 * (2026-10-06, found by `mixercheck` §M, not by looking).** `2` is the style jump, which has been in
 * `subtle`'s draw since the tab shipped — but it used to write `preset.renderer.mode`, which `main.ts`
 * ignores on both branches, so **it had never once changed a render mode.** `24.5` re-routed it to
 * `overlay.renderMode`, and in doing so handed the quietest tier the single loudest change a press can make:
 * roughly one `subtle` press in twelve flipping `star` to `pixel` at `sigma` 0.05. **Fixing an inert write
 * makes a strategy live wherever it was reachable, and the tiers are part of "wherever".**
 *
 * ⚠️ **A CUTOFF INDEX CANNOT EXPRESS THIS SET** — the categorical strategies are 2 and 6, which are not a
 * tail — so the mechanism had to change with it. A set also survives `append`: a new categorical strategy is
 * one entry here, whereas a cutoff would have to be a tail forever.
 *
 * ⚠️ **5 (the static-field jump) IS CATEGORICAL AND IS DELIBERATELY NOT IN THIS SET.** `randomStaticField()`
 * picks a `pattern` NAME, and a name has no neighbourhood — so by subject it belongs here. It is left out
 * because its liveness is not new: it has reached `subtle` for as long as the tab has existed and nothing in
 * Phase 24 touched it, so removing it would be unasked retuning of a tier a user already likes. The cost is
 * stated where the user reads it (`TAB_TIPS['rnd.subtle']` names it as the exception) rather than hidden
 * here, and `mixercheck` §M's identity oracle excludes the static field for the SAME stated reason and not
 * because excluding it is what made the clause pass.
 */
const CATEGORICAL_STRATEGIES: ReadonlySet<number> = new Set([2, 6]);

export function randomizePreset(
  preset: UnifiedPreset,
  // ⚠️ **WIDENED FROM `Intensity` TO `MutationTier` BY 25.D6** — the parameter accepts the unselectable
  // `near` tier so the carry can reuse this one mutator. Every UI that picks a tier is still typed
  // `Intensity`, so widening here cannot put a fourth button anywhere.
  intensity: MutationTier,
  locks: Set<CategoryLock>,
  stats: PresetStatistics,
): UnifiedPreset {
  const result = deepCopy(preset);
  const profile = INTENSITY[intensity];
  const strategy = pickStrategy(profile.categorical);

  switch (strategy) {
    case 0: applyGaussianJitter(result, profile.sigma, locks, stats); break;
    case 1: applyWaveSwap(result, locks); break;
    case 2: applyStyleJump(result, locks); break;
    case 3: applyFreqDoubling(result, locks); break;
    case 4: applyPhaseRotation(result, locks); break;
    case 5: applyStaticFieldJump(result, locks); break;
    case 6: applyLookJump(result, locks); break;
  }

  return result;
}

/**
 * Draw a strategy index.
 *
 * ⚠️ **`allowCategorical === false` RENORMALISES RATHER THAN RE-ROLLING.** Drawing again when a categorical
 * strategy comes up would be the obvious alternative and it is subtly wrong: the probability of each
 * remaining strategy would depend on the number of re-draws allowed, which is a distribution nobody wrote
 * down. Dividing by the surviving total is exact and is one line.
 *
 * ⚠️ **AND IT SKIPS A SET, NOT A TAIL** — see `CATEGORICAL_STRATEGIES` for why the cutoff this replaced was
 * wrong rather than merely narrow. The fallback `return 0` is reached only on floating-point exhaustion and
 * is the jitter, which is the safe strategy to land on at any tier.
 */
function pickStrategy(allowCategorical: boolean): number {
  const open = (i: number) => allowCategorical || !CATEGORICAL_STRATEGIES.has(i);
  let total = 0;
  for (let i = 0; i < STRATEGY_WEIGHTS.length; i++) if (open(i)) total += STRATEGY_WEIGHTS[i]!;
  const r = Math.random() * total;
  let cumulative = 0;
  for (let i = 0; i < STRATEGY_WEIGHTS.length; i++) {
    if (!open(i)) continue;
    cumulative += STRATEGY_WEIGHTS[i]!;
    if (r < cumulative) return i;
  }
  return 0;
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Nudge a value whose range was MEASURED over the shipped library (`preset-stats.ts`).
 *
 * ⚠️ **Returns the value UNCHANGED when the range is absent, which is a mutation that appears to work and
 * does nothing** — `deadcheck`'s G12 `missing` assertion exists for exactly this and found
 * `overlay.curlNoise.turbulence`/`scale` dead on 2026-08-10. Every key passed here must be collected there,
 * **and must be a LITERAL at the call site**, because that is how the checker pairs the two files.
 *
 * ⚠️ **It is also why the `overlay` scalars do NOT come through here** — see `jitterRuled()`.
 */
function jitter(value: number, key: string, sigma: number, stats: PresetStatistics): number {
  const range = stats.paramRanges.get(key);
  if (!range) return value;
  const delta = gaussianRandom() * sigma * (range.max - range.min);
  return Math.max(range.min, Math.min(range.max, value + delta));
}

/**
 * The continuous `overlay` bounds, read back out of the shared table.
 *
 * ⚠️ **`Record<KeysWithMutate<'continuous'>, …>` IS A COMPILE PROOF IN BOTH DIRECTIONS, which is why four
 * lines of apparent duplication are worth it.** Every continuous key in `OVERLAY_RULES` must appear here (or
 * the `Record` is incomplete), and every entry must still BE continuous (or its initialiser no longer
 * satisfies the value type). So a key that changes law in the table breaks this file at the line that reads
 * it, rather than keeping a treatment the table no longer describes. The precedent is `SCALAR_IDENTITIES` in
 * `interpolate.ts`, which derives the Mixer's identity values the same way.
 *
 * ⚠️ **The alternative — `const law = OVERLAY_RULES[key].mutate; if (law.kind !== 'continuous') return …` —
 * was rejected because that branch is UNREACHABLE.** An unreachable guard is worse than no guard: it reads
 * like a safety net and it is dead weight that no test can ever cover.
 */
const CONTINUOUS: Record<KeysWithMutate<'continuous'>, Extract<MutateLaw, { kind: 'continuous' }>> = {
  speedFactor: OVERLAY_RULES.speedFactor.mutate,
  figureScale: OVERLAY_RULES.figureScale.mutate,
  particleSize: OVERLAY_RULES.particleSize.mutate,
  attractorBlend: OVERLAY_RULES.attractorBlend.mutate,
  // v8 30.1. The three twist axes, read back out of the table like the four above. ⚠️ **These are the FIRST
  // SIGNED continuous keys the Randomiser has had**, so `jitter()`'s own arithmetic is exercised across zero
  // for the first time: a nudge may cross the identity and reverse the twist's handedness, which is a real
  // figure rather than an artefact and must not be clamped away at the origin.
  taperX: OVERLAY_RULES.taperX.mutate,
  taperY: OVERLAY_RULES.taperY.mutate,
  taperZ: OVERLAY_RULES.taperZ.mutate,
  bendX: OVERLAY_RULES.bendX.mutate,
  bendY: OVERLAY_RULES.bendY.mutate,
  bendZ: OVERLAY_RULES.bendZ.mutate,
  invertAmount: OVERLAY_RULES.invertAmount.mutate,
  invertRadius: OVERLAY_RULES.invertRadius.mutate,
  twistX: OVERLAY_RULES.twistX.mutate,
  twistY: OVERLAY_RULES.twistY.mutate,
  twistZ: OVERLAY_RULES.twistZ.mutate,
  // v8 31.2. The three per-particle channel amounts, signed like the twist axes above and exercised across
  // zero for the same reason: a nudge may cross the identity and swap WHICH particles are emphasised, which
  // is a different picture of one ordering rather than an artefact. ⚠️ **`channelDriver` is categorical and
  // is therefore absent from this record by construction** — it is rolled by the categorical path, not
  // jittered, and a `Record<KeysWithMutate<'continuous'>, …>` entry for it would not compile.
  channelSize: OVERLAY_RULES.channelSize.mutate,
  channelAlpha: OVERLAY_RULES.channelAlpha.mutate,
  channelLight: OVERLAY_RULES.channelLight.mutate,
  // v8 31.4. ⚠️ **The three angles' bounds here are the RANDOMISER's range, not a clamp** — the engine
  // does not clamp an angle at all (it wraps), so these four lines are the only place a bound on them
  // exists, and the table's `unit` strings say which kind of bound each is.
  wScale: OVERLAY_RULES.wScale.mutate,
  wXW: OVERLAY_RULES.wXW.mutate,
  wYW: OVERLAY_RULES.wYW.mutate,
  wZW: OVERLAY_RULES.wZW.mutate,
  // v8 33.2. ⚠️ **ONE-SIDED (0..1), unlike every signed key above**, so `jitter()` never crosses zero here
  // and the dead-zone reasoning that applies to the twist and taper axes does not apply at all: the
  // identity is the range's own end stop, which the randomiser can land on exactly.
  sharpness: OVERLAY_RULES.sharpness.mutate,
  // v8 33.3. Signed and centre-off like the twist axes, so a nudge may cross the identity and reverse the
  // sweep's direction — which is a real figure (the open arc runs the other way) rather than an artefact.
  // ⚠️ **The randomiser can therefore hand a user an OPEN figure from a closed preset**, which is the
  // loudest thing in this table and is exactly what the `Open figure` chip exists to let them find again.
  travelX: OVERLAY_RULES.travelX.mutate,
  travelY: OVERLAY_RULES.travelY.mutate,
  travelZ: OVERLAY_RULES.travelZ.mutate,
  /*
   * v8 `34.4` — ⚠️⚠️ **NINETEEN MORE DECLARED ENTRIES AND NOT ONE NEW CALL SITE, WHICH IS `34.D13` AND IS
   * DELIBERATE RATHER THAN UNFINISHED.**
   *
   * Measured 2026-10-29: `jitterRuled` is called at **exactly four literal sites** — `figureScale`,
   * `particleSize`, `speedFactor`, `attractorBlend` — while **sixteen keys in this record had none**: all of
   * `twist*`, `taper*`, `bend*`, `invert*`, `channel*`, `w*`, `sharpness` and `travel*`. **So `sharpness`
   * and `travel*` never rolled**, and `34.D10`'s *"they roll, `Grow` joins them"* described a DECLARATION
   * rather than a behaviour. `34.D13` records the correction and chooses to keep declaring: `grow*` joins as
   * `continuous` **with the gap named**, because a key missing from the Randomiser for a reason nobody wrote
   * down is indistinguishable from a key somebody forgot.
   *
   * ⚠️⚠️ **DO NOT ADD THE CALL SITES HERE. THERE ARE NOW THIRTY-FIVE OF THEM AND THEY GO TOGETHER.** Making
   * them live changes behaviour on a shipped surface across every Randomiser tier, and this phase already
   * carries 28 new keys. It is owed its own step. ⚠️ **And `mixercheck`'s out-of-bounds scan cannot see the
   * gap** — it does `if (v === undefined) continue`, so a key the Randomiser never writes passes VACUOUSLY,
   * which is this project's *a mutation that appears to work and does nothing* at thirty-five keys, green.
   *
   * ⚠️ **`offset*` IS ABSENT FROM THIS RECORD BY CONSTRUCTION, not by omission**: all nine are `frozen` with
   * the centring reason in the table, so they are not members of `KeysWithMutate<'continuous'>` and an entry
   * here would not compile. **That is the asymmetry `34.D13` wanted stated, and `tsc` is what states it.**
   */
  sharpnessStructure: OVERLAY_RULES.sharpnessStructure.mutate,
  sharpnessDetail: OVERLAY_RULES.sharpnessDetail.mutate,
  sharpnessDepth: OVERLAY_RULES.sharpnessDepth.mutate,
  sharpnessRate: OVERLAY_RULES.sharpnessRate.mutate,
  travelDepthX: OVERLAY_RULES.travelDepthX.mutate,
  travelDepthY: OVERLAY_RULES.travelDepthY.mutate,
  travelDepthZ: OVERLAY_RULES.travelDepthZ.mutate,
  travelRateX: OVERLAY_RULES.travelRateX.mutate,
  travelRateY: OVERLAY_RULES.travelRateY.mutate,
  travelRateZ: OVERLAY_RULES.travelRateZ.mutate,
  growX: OVERLAY_RULES.growX.mutate,
  growY: OVERLAY_RULES.growY.mutate,
  growZ: OVERLAY_RULES.growZ.mutate,
  growDepthX: OVERLAY_RULES.growDepthX.mutate,
  growDepthY: OVERLAY_RULES.growDepthY.mutate,
  growDepthZ: OVERLAY_RULES.growDepthZ.mutate,
  growRateX: OVERLAY_RULES.growRateX.mutate,
  growRateY: OVERLAY_RULES.growRateY.mutate,
  growRateZ: OVERLAY_RULES.growRateZ.mutate,
};

/**
 * Nudge one of the four continuous `overlay` scalars, with its bounds and its TRACK taken from the table.
 *
 * ⚠️ **THE BOUNDS COME FROM THE TABLE AND NOT FROM `paramRanges`, AND THAT IS `24.D10`, MEASURED.** These
 * four keys are authored by a thin slice of the library — `particleSize` by **30** presets of 274 (0.6 /
 * 1.46 / 3.03 as min / median / max, measured 2026-10-05) — so a collected range is nearly a point, and
 * `jitter()` is exactly inert where it is one. The table's bounds are the ENGINE's clamps, which is what the
 * user's slider can reach and therefore what "a fraction of the control" has to mean.
 *
 * ⚠️ **`scale: 'geometric'` NUDGES IN LOG SPACE, and skipping that is the slider-track rule restated.** For
 * `figureScale` (a log-base-5 track, 0.2–5) a linear step of `sigma × 4.8` is a tenth of the control at 5×
 * and a total re-frame at 0.25× — the same defect `jitterStaticFields` fixes for Drift with its sqrt mapping
 * and for Detail with its octaves. ⚠️ `Math.max(law.min, value)` before the `log` is load-bearing: an
 * imported preset can carry 0, and `log(0)` is `-Infinity`, which would propagate through the clamp as `NaN`
 * and reach the GL uniform — invariant 10's class, with no compiler and no console to say so.
 */
function jitterRuled(value: number, key: KeysWithMutate<'continuous'>, sigma: number): number {
  const law = CONTINUOUS[key];
  if (law.scale === 'geometric') {
    const lo = Math.log(law.min);
    const hi = Math.log(law.max);
    const next = Math.log(Math.max(law.min, value)) + gaussianRandom() * sigma * (hi - lo);
    return Math.exp(Math.max(lo, Math.min(hi, next)));
  }
  const delta = gaussianRandom() * sigma * (law.max - law.min);
  return Math.max(law.min, Math.min(law.max, value + delta));
}

function applyGaussianJitter(preset: UnifiedPreset, sigma: number, locks: Set<CategoryLock>, stats: PresetStatistics): void {
  if (!locks.has('shape')) {
    /*
     * v8 `36.15`/`36.D20` — **`generators.lsystem` DOES NOT ROLL, and the REASON is recorded here rather
     * than the absence being left to be discovered.**
     *
     * `rule` is categorical and has no interpolant. The three angles and the recursion each move the
     * figure to a **different NAMED fractal** rather than to a variant of the same one, so a roll would
     * hand back a different figure rather than variety — **which reads as the Randomiser being broken**,
     * exactly as `34.D10` reasoned about `Offset` and centring.
     *
     * ⚠️⚠️ **WRITTEN AS A COMMENT AT THE SITE THAT WOULD DO IT, AND DELIBERATELY NOT AS A `mutate` COLUMN
     * ON A REGISTRY WITH NO READER FOR IT.** `34.D13` is the trap: `jitterRuled` has FOUR literal call
     * sites while SIXTEEN `overlay` keys declare `mutate: 'continuous'` and have NONE — **a declaration
     * is not a behaviour**, and adding one here would advertise a roll that does not happen.
     *
     * ✅ **Evolution's crossover is the opposite case and DOES owe an entry** — it reads `law` generically
     * and reaches `generators` fields — so `evolution-ops.ts` carries one, as a WHOLE-BLOCK choice and
     * never a per-field lerp (`36.D18`).
     */
    preset.generators.particleCount = Math.max(10, Math.round(jitter(preset.generators.particleCount, 'generators.particleCount', sigma, stats)));
    for (let w = 0; w < preset.generators.waves.length; w++) {
      const wave = preset.generators.waves[w]!;
      for (let a = 0; a < 3; a++) {
        const ax = wave.axes[a]!;
        ax.fm.base = jitter(ax.fm.base, `wave${w}.axis${a}.fm.base`, sigma, stats);
        ax.fm.amplitude = jitter(ax.fm.amplitude, `wave${w}.axis${a}.fm.amplitude`, sigma, stats);
        ax.fm.frequency = jitter(ax.fm.frequency, `wave${w}.axis${a}.fm.frequency`, sigma, stats);
        ax.am.base = jitter(ax.am.base, `wave${w}.axis${a}.am.base`, sigma, stats);
        ax.am.amplitude = jitter(ax.am.amplitude, `wave${w}.axis${a}.am.amplitude`, sigma, stats);
        // ⚠️ **TWO KEYS ADDED 2026-10-05 (24.D7) AND BOTH WERE ALREADY COLLECTED** — `preset-stats.ts` has
        // measured a range for all seven axis scalars since it was written, and the Randomiser read five.
        // That is the harmless direction of `deadcheck`'s G12 (collected-but-unread) and it hid a real gap:
        // `am.frequency` is the modulator's own rate, so leaving it out meant the jitter could re-shape an
        // axis's amplitude envelope but never its SPEED.
        ax.am.frequency = jitter(ax.am.frequency, `wave${w}.axis${a}.am.frequency`, sigma, stats);
        // ⚠️ **AND `phase` MAY NOT BE FOLDED INTO `applyPhaseRotation` (24.D7).** That strategy adds a
        // NAMED angle from `[90, 120, 180, 240, 270]` to one axis, which is a pose change a user can name;
        // this is a sub-degree drift across every axis at once, which is a different gesture with a
        // different output channel. Merging them would delete the one that is harder to see.
        ax.phase = jitter(ax.phase, `wave${w}.axis${a}.phase`, sigma, stats);
      }
    }
    // The figure's SIZE, through the shared table (24.3). Both default to 1, which is their identity, so
    // reading `?? 1` writes a real nudge rather than materialising a value the preset never had.
    // ⚠️ **`figureScale` and `particleSize` ARE `shape` KEYS SINCE `24.1`** — they were `visual`, which is
    // why they could not be jittered here before without the `visual` lock holding the figure's size.
    const size = {
      figureScale: jitterRuled(preset.overlay?.figureScale ?? 1, 'figureScale', sigma),
      particleSize: jitterRuled(preset.overlay?.particleSize ?? 1, 'particleSize', sigma),
    };
    preset.overlay = { ...preset.overlay, ...size };
  }

  if (!locks.has('color')) {
    for (let c = 0; c < 3; c++) {
      preset.generators.colorBase[c] = jitter(preset.generators.colorBase[c]!, `generators.colorBase.${c}`, sigma, stats);
      preset.generators.colorAmp[c] = jitter(preset.generators.colorAmp[c]!, `generators.colorAmp.${c}`, sigma, stats);
      preset.generators.colorFreq[c] = jitter(preset.generators.colorFreq[c]!, `generators.colorFreq.${c}`, sigma, stats);
      preset.generators.colorShift[c] = jitter(preset.generators.colorShift[c]!, `generators.colorShift.${c}`, sigma, stats);
    }
    // ⚠️ **NO PALETTE WRITE HERE, AND THE MASKING IS LEFT IN PLACE DELIBERATELY (24.D8).** Precedence is
    // palette > material ramp > preset colour, so on the 114 presets that author a palette the four curves
    // above are invisible — the jitter runs, the frame does not change, and that reads as a broken control
    // (invariant 13's harder half). The remedy is the chip's TOOLTIP, which now says so in words. Damping
    // or skipping the curves would make the Randomiser quietly disagree with the Visual FX sliders, which
    // move the same four arrays under the same precedence.
  }

  if (!locks.has('motion')) {
    preset.generators.waveSpeed = jitter(preset.generators.waveSpeed, 'generators.waveSpeed', sigma, stats);
    for (let r = 0; r < 3; r++) {
      preset.generators.rotation[r] = jitter(preset.generators.rotation[r] ?? 0, `generators.rotation.${r}`, sigma, stats);
    }
    // ⚠️ **`speedFactor` IS A `motion` KEY SINCE `24.1`, AND IT IS NOT `generators.waveSpeed`.** The two are
    // separate quantities wearing one word: `waveSpeed` is baked at `init()` and resets `pos`, while this is
    // the live playback multiplier that scales wave motion AND every rotation rate together. ⚠️ **107i's
    // `speedFactor` fix is undecided between two non-equivalent one-liners — this writes the preset field and
    // takes no position on that (24.D15).**
    preset.overlay = {
      ...preset.overlay,
      speedFactor: jitterRuled(preset.overlay?.speedFactor ?? 1, 'speedFactor', sigma),
    };
  }

  if (!locks.has('attractor')) {
    // ⚠️ **GATED ON A LIVE ATTRACTOR, because the blend is unread without one** — `attractorIndex` is `-1`
    // on 173 of the 183 presets that author it, and nudging a number nothing reads is the inert mutation
    // this phase exists to delete. Switching one ON is the `Look jump`'s job (and `ATTRACTOR_ENTRY_BLEND`'s).
    const idx = preset.overlay?.attractorIndex ?? -1;
    if (idx >= 0) {
      preset.overlay = {
        ...preset.overlay,
        attractorBlend: jitterRuled(preset.overlay?.attractorBlend ?? ATTRACTOR_ENTRY_BLEND, 'attractorBlend', sigma),
      };
    }
  }

  if (!locks.has('visual')) {
    // ⚠️ **`renderer.glow` REACHES THE RIBBON AND NEON-LINE RENDERERS, NOT THE PARTICLE GLOW** (measured
    // 2026-10-05): `main.ts` forwards it at `ribbonRenderer.setGlow()`/`neonLineRenderer.setGlow()`, while
    // the HDR particle path's `uGlow` is re-handed from the FILM LOOK (`setFilmLook({ glow: look.glow })`)
    // on every apply and on every renderer re-init. So this line is live only on a ribbon or neon preset.
    // **Left exactly as it was** — it is a real nudge on those presets, and the particle glow has an owner
    // of its own (the grade bundle). `applyStyleJump` used to write this field too, and there it WAS the
    // defect; see that function.
    preset.renderer.glow = jitter(preset.renderer.glow, 'renderer.glow', sigma, stats);
    preset.renderer.decayFactor = Math.max(0, Math.min(0.99, jitter(preset.renderer.decayFactor, 'renderer.decayFactor', sigma, stats)));
    // ⚠️ **TWO MORE KEYS ADDED 2026-10-05 (24.D7), BOTH ALLOW-LISTED IN `deadcheck` AS "collected but
    // unread" SINCE G12** — the allow-list named their readers (`blurRadius` gates the blur pass at `> 0`
    // and is read by every tile renderer; `depthSize` is `uDepthSize` in both the point and splat vertex
    // shaders), so the ranges were right and the gap was on this side all along. `deadcheck`'s `UNREAD_OK`
    // shrinks to one entry as a result, which is the two-file half of this edit.
    preset.renderer.blurRadius = Math.max(0, jitter(preset.renderer.blurRadius, 'renderer.blurRadius', sigma, stats));
    preset.renderer.depthSize = Math.max(0, jitter(preset.renderer.depthSize, 'renderer.depthSize', sigma, stats));
    // ⚠️ **`renderer.streaks` IS THE ONE OF THE THREE LEFT ALONE, AND THE REASON IS A MEASUREMENT:** it is
    // **0 on all 274 presets**, so its collected range is a POINT and a jitter through it is arithmetically
    // guaranteed to return the value unchanged. `deadcheck`'s own note goes further — no renderer or shader
    // reads it (there is no `uStreaks`), so it is an inert preset field kept for the on-disk format. Wiring
    // it would add a call site that cannot move anything, which is the exact defect class `24.0` measured.
    if (preset.overlay?.curlNoise) {
      preset.overlay.curlNoise.turbulence = Math.max(0, Math.min(1,
        jitter(preset.overlay.curlNoise.turbulence, 'overlay.curlNoise.turbulence', sigma, stats)
      ));
      preset.overlay.curlNoise.scale = Math.max(0.1, Math.min(10,
        jitter(preset.overlay.curlNoise.scale, 'overlay.curlNoise.scale', sigma, stats)
      ));
    }
  }

  // Under its OWN lock, not `visual` — see `jitterStaticFields`. A separate `if` rather than a line inside
  // the block above, because the two gates genuinely differ and folding them would make one of them wrong.
  if (!locks.has('transmap')) {
    jitterStaticFields(preset, sigma);

    // Chain-level dispersion, jittered HERE and not inside `jitterStaticFields` — that function returns early
    // when there is no `transMapChain` (222 of 274 presets) and iterates per LAYER, so a global scalar in it
    // would be skipped on almost every preset and multiply-nudged on a multi-layer one.
    //
    // Only once it is already nonzero, for the same reason drift is: 0 means "no fringing" on every shipped
    // preset, and introducing an effect the preset never had is a categorical change rather than a nudge —
    // that is what a Randomise STRATEGY is for, not what jitter means.
    const disp = preset.overlay?.transMapDispersion;
    if (disp !== undefined && disp > 0) {
      preset.overlay = {
        ...preset.overlay,
        // Span 0.5 = the slider's full range, keeping `sigma` a fraction-of-the-control as everywhere else.
        // Floored at 0.01 rather than 0: a jitter must not silently switch the effect off, which is the
        // categorical state this branch just tested for.
        transMapDispersion: Math.max(0.01, Math.min(0.5, disp + gaussianRandom() * sigma * 0.5)),
      };
    }

    /**
     * FORCE GATE (Step 14.4) — jittered only where it is ALREADY ON, and only its two continuous scalars.
     *
     * ⚠️ **`transMapForceGateBy` is never touched**, for the reason `pattern` is not: a source name has no
     * neighbourhood to jitter in, and switching from `'depth'` to `'age'` is a categorical change — plus
     * `'age'`/`'temperature'` would silently produce an INERT gate on any preset with no material, so a
     * "subtle" pass could turn a working gate off. Same for `Invert`, whose only nudge is its opposite.
     * **`24.1` writes that rule down as `frozen` laws in the shared table, where `fieldcheck` §K's two
     * negative clauses over this file are now its second half.**
     *
     * ⚠️ **Requires `amount > 0` as well as a source**, because the pair is what makes the gate real —
     * `prepareGate()` reports itself inactive on either, so jittering the half-life of a zero-amount gate
     * would move a number nothing reads. Floored at 0.02 rather than 0: a jitter must not switch the effect
     * off, the same rule as dispersion above.
     */
    const gateBy = preset.overlay?.transMapForceGateBy ?? 'none';
    const gateAmount = preset.overlay?.transMapForceGateAmount ?? 0;
    if (gateBy !== 'none' && gateAmount > 0) {
      preset.overlay = {
        ...preset.overlay,
        // Span 1.0 = the slider's full 0..1 range, keeping `sigma` a fraction-of-the-control as everywhere.
        transMapForceGateAmount: Math.max(0.02, Math.min(1, gateAmount + gaussianRandom() * sigma)),
      };
      if (gateBy === 'age') {
        // Only `'age'` reads the half-life. Span 5s, not the slider's full 20 — the visible difference lives
        // in the first few seconds, so a 20s span would make most rolls a jump to "effectively ungated".
        const half = preset.overlay.transMapForceGateHalfLife ?? 2.0;
        preset.overlay = {
          ...preset.overlay,
          transMapForceGateHalfLife: Math.max(0.1, Math.min(20, half + gaussianRandom() * sigma * 5)),
        };
      }
    }
  }
}

function applyWaveSwap(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  if (locks.has('shape')) return;
  const waves = preset.generators.waves;
  if (waves.length < 2) return;
  const i = Math.floor(Math.random() * waves.length);
  let j = Math.floor(Math.random() * waves.length);
  while (j === i && waves.length > 1) j = Math.floor(Math.random() * waves.length);
  const tmp = waves[i]!;
  waves[i] = waves[j]!;
  waves[j] = tmp;
}

/**
 * Jump to a different render mode — **and this function was a NO-OP on every preset until 2026-10-05.**
 *
 * ## Defect 1, measured at `24.0` and fixed here under `24.D6`
 *
 * It wrote `preset.renderer.mode`, and **`main.ts` never reads that field for a re-apply.** The resolution
 * is `preset.overlay?.renderMode ?? (isSamePreset ? currentRenderMode : (preset.renderer.mode ?? 'star'))`,
 * and a randomised preset keeps its NAME, so `isSamePreset` is true and the middle branch wins: the engine
 * stayed in the mode it was already in. **Both branches ignore `preset.renderer.mode`** — the fallback only
 * ever fires on a genuine preset switch, and even there the overlay would have won. ⚠️ **That resolution is
 * CORRECT and is not to be touched**; it is what makes a live Render Mode choice survive a slider drag.
 *
 * ⚠️ **AND IT WAS WORSE THAN INERT.** `applyPresetChange` compares the resolved mode against the live one
 * and calls `reinitRenderer()` on a difference — so a `renderer.mode` write that the resolution ignored
 * still travelled far enough to force a renderer dispose + re-init **into the mode the engine was already
 * in**: a full program recompile and buffer reallocation for a frame that looked identical. At 9 % of presses
 * that is the Randomiser's most expensive operation being also its least visible one.
 *
 * ⚠️ **The `renderer.glow = 1.0 + Math.random() * 6.0` write is GONE, not re-routed.** On the three modes
 * this hands out, the particle `uGlow` comes from the film look and is re-handed at every apply, so the
 * write could not reach the frame either; where `renderer.glow` IS live — ribbons and neon lines — it is a
 * population scalar this strategy never meant to touch, and a six-fold random re-roll of it is not a "style
 * jump". Glow now has one owner, the grade bundle (`applyGradeJump`).
 *
 * ⚠️ **A LIVE MATERIAL PINS THE MODE, SO THIS IS A NO-OP ON THE 84 PRESETS THAT CARRY ONE — BY DESIGN, AND
 * SAID OUT LOUD RATHER THAN WORKED AROUND.** `writeMaterialAndMode()` resolves the request through
 * `resolveModeAgainstMaterial()`, which is invariant 17's one owner: a material overrides every mode except
 * `liquid`. Writing the drawn mode anyway would re-create defect 1 in a new shape — a preset carrying a mode
 * the engine overrules on apply. Freeing the mode means changing the MATERIAL, which is the `material`
 * group's own subject and a different lock. ⚠️ **This is one of `P6`'s reachable-but-unused configurations
 * and is for the owner reading to judge, not for this function to compensate for.**
 */
function applyStyleJump(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  if (locks.has('visual')) return;
  const requested = RANDOMISABLE_RENDER_MODES[Math.floor(Math.random() * RANDOMISABLE_RENDER_MODES.length)]!;
  // ⚠️ **THE MATERIAL IS PASSED THROUGH BY REFERENCE, NOT RE-RESOLVED FROM ITS NAME.** An earlier draft
  // handed the NAME to the shared owner, which called `getMaterialPreset()` on it — and that silently
  // replaced a hand-tuned `MaterialConfig` with the canonical one from `MATERIAL_PRESETS` on every style
  // jump. A library preset may carry any of eleven material fields edited away from its preset's values
  // (the Materials tab writes them), so a round trip through the name is lossy in exactly the way that
  // reads as "the Randomiser reset my material" while the strategy's own subject is the render mode.
  // ⚠️ `mixercheck` §M is the instrument: with `material` LOCKED, a style jump must leave `overlay.material`
  // byte-identical, and a name round trip fails that on every preset whose material is not stock.
  writeMaterialAndMode(preset, preset.overlay?.material ?? null, requested, locks);
}

/**
 * **THE ONE PLACE THE RANDOMISER WRITES A MATERIAL OR A RENDER MODE (24.D12).**
 *
 * Two strategies need the pair — `applyStyleJump` asks for a mode and keeps the material,
 * `applyMaterialJump` asks for a material and lets the mode follow — and they must not race. The pair is
 * one decision because **`splat` with no material draws NOTHING**: every ordering of two independent writes
 * has an arrangement that publishes a preset which renders black.
 *
 * ⚠️ **`main.ts` ALREADY GUARDS THE BLACK FRAME ON APPLY** (`(!currentMaterial || preset === 'None') &&
 * currentRenderMode === 'splat'` reverts to `previousRenderMode`, else `'star'`), so this is not the last
 * line of defence — it is about what gets PUBLISHED. The preset the Randomiser hands out is exported,
 * snapshotted, bred and sent to the Mixer; a dead `splat` + `None` pair inside it would be a defect that
 * only ever shows up in the artefacts, long after the frame looked fine.
 *
 * ⚠️ **`liquid` IS NOT TOUCHED, AND IT IS NOT AN OVERSIGHT.** `resolveModeAgainstMaterial()` exempts it, and
 * `liquid` with no material is a shipped authored look on five library presets — so the `'star'` fallback
 * below tests `splat` alone, exactly as `main.ts`'s three revert sites do. Adding `liquid` to that test
 * would re-open the 2026-09-01 fix.
 *
 * ⚠️ **With `visual` LOCKED the mode is not written at all**, because `renderMode` is a `visual` key and a
 * lock means a lock. The caller is then responsible for not handing over a material that would strand a
 * live `splat` — see `applyMaterialJump`, which drops `'None'` from its draw in exactly that case.
 *
 * ⚠️ **AND THE `visual` LOCK CANNOT FULLY HOLD THE MODE WHILE `material` IS FREE — THAT IS INVARIANT 17, NOT
 * A GAP HERE.** `applyPresetChange` runs `resolveModeAgainstMaterial()` on every apply, so a new material
 * that requests a mode gets it whether or not this function wrote the field. What the lock does hold is the
 * preset's own `renderMode` value, which is what is exported, snapshotted and mixed. Locking BOTH `visual`
 * and `material` holds the pair outright, and the material chip's tooltip says the two travel together.
 *
 * ⚠️ **`material` IS A CONFIG, NOT A NAME, AND THAT IS LOAD-BEARING** — see `applyStyleJump`.
 */
function writeMaterialAndMode(
  preset: UnifiedPreset,
  material: MaterialConfig | null,
  requested: RenderMode,
  locks: Set<CategoryLock>,
): void {
  const ov = { ...preset.overlay };
  // ⚠️ **ABSENCE is how a material is REMOVED** — `applyPresetChange` reads `currentMaterial = ov.material ??
  // null`, so deleting the key clears the material at the generator and the renderer. Writing a `'None'`
  // CONFIG would also work today but would publish eleven fields describing nothing.
  if (material) ov.material = material; else delete ov.material;
  if (!locks.has('visual')) {
    const resolved = resolveModeAgainstMaterial(requested, material);
    ov.renderMode = (!material && resolved === 'splat') ? 'star' : resolved;
  }
  preset.overlay = ov;
}

/**
 * `Look jump` (24.4) — **re-skin exactly ONE identity, drawn from the five that have a categorical owner.**
 *
 * ⚠️ **ONE SUBJECT PER PRESS, NOT A SWEEP OF ALL FIVE.** A press that re-rolled the grade, the palette, the
 * material, the warp and the attractor together would produce a preset with nothing left of the original,
 * which is not "randomise this preset" — it is "give me a different preset", and the library already has
 * 274 of those. One subject keeps every press attributable: the user can see what changed and press again.
 *
 * ⚠️ **A LOCKED SUBJECT IS REMOVED FROM THE DRAW, NOT SKIPPED AFTER BEING DRAWN.** Skipping would make a
 * press do nothing at a rate equal to the number of locks — the user would experience their locks as the
 * Randomiser becoming unresponsive. With the draw filtered, locking four subjects makes the fifth four times
 * as likely, which is what "lock everything but one to explore a single axis" means in the tab's own copy.
 *
 * ⚠️ **`renderMode` IS NOT A SIXTH SUBJECT HERE** — strategy 2 (`Style jump`) owns it at 7 %, and the
 * material subject below already moves it through the shared owner. A sixth entry would give the mode two
 * draws with two different weights.
 *
 * ⚠️ **TWO SUBJECTS SHARE THE `color` LOCK** (the grade and the palette pair), so locking `color` removes
 * two of the five. That is correct and is the reason the table is a list of `{ lock, apply }` pairs rather
 * than a `Record<CategoryLock, …>`: the mapping is many-to-one.
 */
const LOOK_SUBJECTS: readonly { lock: CategoryLock; apply: (preset: UnifiedPreset, locks: Set<CategoryLock>) => void }[] = [
  { lock: 'color', apply: applyGradeJump },
  { lock: 'color', apply: applyPaletteJump },
  { lock: 'material', apply: applyMaterialJump },
  { lock: 'transmap', apply: applyTransMapJump },
  { lock: 'attractor', apply: applyAttractorJump },
];

function applyLookJump(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  const open = LOOK_SUBJECTS.filter(s => !locks.has(s.lock));
  // Every subject locked: the honest answer is to do nothing. The press is still counted by the tab's
  // history, which is the one place a user can see that a lock, not a bug, is why the frame held still.
  if (open.length === 0) return;
  open[Math.floor(Math.random() * open.length)]!.apply(preset, locks);
}

/**
 * The GRADE, as one bundle (24.D13) — a named film look replaces the whole thing.
 *
 * ⚠️ **`customFilmLookParams` AND `sliderBaseFilmLook` ARE DELETED, NOT LEFT STANDING.** Both describe the
 * look that was there: `customFilmLookParams` is the `Customize` bundle (meaningless under another look's
 * name, and the SEED the next Customize starts from), and `sliderBaseFilmLook` is the palette the Sliders
 * tab restores from. Carrying either across a jump would publish a grade no one authored — which is exactly
 * why the three keys share a bundle id in both columns of the shared table.
 *
 * ⚠️ **THREE OF THE LOOKS ABSTAIN FROM THE PALETTE** (`palette: 'none'` — `Legacy`, `Legacy Graded` and
 * `Cinematic`, measured 2026-10-05), so a jump onto one of those leaves the previous palette in place rather
 * than clearing it. That is the engine's rule (21.4g: a look SETS the palette only if it HAS one) and not
 * something to route around here; the palette has its own subject.
 *
 * ⚠️ **`CUSTOMIZE_FILM_LOOK` IS NOT IN THE DRAW**, and `Object.keys(FILM_LOOKS)` is why — `getFilmLookNames()`
 * appends it for the dropdown. Handing it out would name a bundle whose contents live in whatever
 * `customFilmLookParams` happened to hold, i.e. the key this function just deleted.
 */
function applyGradeJump(preset: UnifiedPreset): void {
  const prev = preset.overlay?.filmLook;
  const names = Object.keys(FILM_LOOKS).filter(n => n !== prev);
  if (names.length === 0) return;
  const ov = { ...preset.overlay, filmLook: names[Math.floor(Math.random() * names.length)]! };
  delete ov.customFilmLookParams;
  delete ov.sliderBaseFilmLook;
  preset.overlay = ov;
}

/**
 * The palette PAIR — a palette and the channel it is read along, drawn together.
 *
 * ⚠️ **THE PAIR IS ONE PRESS BECAUSE A MAPPING WITHOUT A PALETTE IS INVISIBLE.** `paletteMapping` only
 * matters once a palette is live, so drawing them separately would spend half the subject's presses on a
 * key that may change nothing.
 *
 * ⚠️ **`'index'` IS EXCLUDED FROM THE MAPPING DRAW, EXPLICITLY AND WITH ITS REASON**, because it is not a
 * channel: `paletteMappingToInt('index')` returns `PALETTE_MAPPING_OFF` (`-1`) and the shader's `if`-chain
 * ends in a bare `else { palCoord = vVelocity; }`, so "index" reads as velocity with the palette switched
 * off. A random draw that turned the palette off one time in six would read as the Randomiser losing the
 * palette it had just chosen.
 *
 * ⚠️ **`'temperature'` IS IN THE DRAW ONLY WITH A LIVE MATERIAL**, which is the same precondition the Visual
 * FX row states inline: the temperature channel is written by the material's thermal model, so without one
 * it is a constant and the palette collapses to a single colour.
 */
function applyPaletteJump(preset: UnifiedPreset): void {
  const prev = preset.overlay?.palette;
  // `getAllPaletteNames()` returns `[value, label]` pairs — **the stored value is `[0]`, never the label**
  // (`palettes.ts`: "a LABEL may never be what gets stored").
  const values = getAllPaletteNames().map(p => p[0]).filter(v => v !== prev);
  if (values.length === 0) return;
  const material = preset.overlay?.material;
  const channels: PaletteMapping[] = ['depth', 'phase', 'velocity', 'position', 'age'];
  if (material && material.preset !== 'None') channels.push('temperature');
  preset.overlay = {
    ...preset.overlay,
    palette: values[Math.floor(Math.random() * values.length)]!,
    paletteMapping: channels[Math.floor(Math.random() * channels.length)]!,
  };
}

/**
 * The MATERIAL, with the render mode it requires — the seventh lock's one subject (24.D3).
 *
 * ⚠️ **`'None'` IS A MEMBER OF THE DRAW, because removing a material has to be reachable.** 190 of the 274
 * presets carry no live material, so a draw that could only ever ADD one would ratchet: press enough times
 * and every preset ends up a splat preset, with no press able to go back.
 *
 * ⚠️ **EXCEPT WHEN `visual` IS LOCKED AND THE EFFECTIVE MODE IS `splat`** — there `'None'` is dropped,
 * because the mode cannot be written to compensate and the published pair would draw nothing. This is the
 * one place a lock on ONE category constrains the draw of ANOTHER, and it is a black frame rather than a
 * preference.
 *
 * ⚠️ **THE EFFECTIVE MODE IS READ FROM THE PRESET AND MAY NOT BE THE LIVE ONE.** `main.ts` keeps the live
 * mode across a re-apply of the same preset name (`isSamePreset`), and a randomised preset keeps its name —
 * so where `overlay.renderMode` is absent the engine's mode is whatever the user last picked and this
 * function cannot see it. `preset.renderer.mode ?? 'star'` is the best available estimate; `main.ts`'s own
 * splat guard is what makes the gap harmless, and it is stated here rather than discovered later.
 */
function applyMaterialJump(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  const prev = preset.overlay?.material?.preset ?? 'None';
  const mode: RenderMode = preset.overlay?.renderMode ?? preset.renderer.mode ?? 'star';
  const names: MaterialPresetName[] = MATERIAL_PRESETS.map(p => p.name);
  if (!(locks.has('visual') && mode === 'splat')) names.push('None');
  const open = names.filter(n => n !== prev);
  if (open.length === 0) return;
  const next = open[Math.floor(Math.random() * open.length)]!;
  // THIS is the one site where resolving a name to a config is right: the material is the subject, so the
  // canonical config from `MATERIAL_PRESETS` is exactly what "jump to Plasma" means.
  writeMaterialAndMode(preset, next === 'None' ? null : getMaterialPreset(next), mode, locks);
}

/**
 * The WARP STYLE — a new TransMap style in one of the chain's layers.
 *
 * ⚠️ **IT GOES THROUGH THE CHAIN, NEVER THROUGH `overlay.transMapStyle` (24.D11).** `chainFromOverlay()`
 * prefers the chain, so writing the scalar would be masked on all 52 chain-carrying presets — the same
 * shape as defect 1, where a write landed in the field the reader does not consult.
 *
 * ⚠️ **THE LAYER IS REPLACED WITH `makeLayer()`, NOT RE-STYLED IN PLACE.** A `TransMapLayer` carries NINE
 * optional per-style blocks (`staticField`, `ifsParams`, `proceduralFlow`, `fluidFeedback`, `refraction`,
 * `timeWarp`, `bandSplit`, `vortex`, `parallax`), and re-pointing `style` would leave the old style's block
 * sitting on a layer that no longer reads it. That costs nothing visually and **breaks the export**: a block
 * the new style does not own forces the chain out of legacy form, and `isLegacyExpressible()` is a
 * hand-written list that a per-style block must be added to or its tuning dies on export. Replacing the
 * whole layer honours that rule STRUCTURALLY, so no list here can fall out of date with that one.
 *
 * ⚠️ **THE THREE `requiresField` MODIFIERS ARE EXCLUDED FROM THE DRAW** (8 Time Warp, 9 Band Split, 11 Depth
 * Parallax). `isInertModifier()` makes a modifier a no-op on a chain with no live field layer, and replacing
 * the chain's only field layer WITH a modifier produces exactly that chain — a press that reliably turns the
 * warp off. The nine remaining styles (0–7, 10) are all self-sufficient.
 *
 * ⚠️ **`transMapEnabled: true` IS PART OF THE JUMP.** 111 presets have the warp off; without this the press
 * would author a style nothing runs. ⚠️ **And a replaced layer inherits its predecessor's weight unless that
 * weight was 0** — `buildChainPlan()` drops a layer at `weight <= 0`, so inheriting a 0 would hand over a
 * new style that cannot be seen.
 *
 * Style 4 (Fractal Feedback) needs no `ifsParams`: `applyEchoPass` falls back to `defaultIfsParams()`, so
 * the jump stays reachable without this function authoring a 6×5 matrix of affine transforms.
 */
function applyTransMapJump(preset: UnifiedPreset): void {
  const chain = chainFromOverlay(
    preset.overlay,
    preset.postProcessors.transMap.style,
    preset.postProcessors.transMap.ifsParams,
  );
  const draw = TRANS_MAP_STYLES.filter(m => m.requiresField !== true);
  const pick = draw[Math.floor(Math.random() * draw.length)]!;
  // Which layer to re-style: any that is not itself a modifier. A chain of modifiers alone cannot render, so
  // in practice this is "the field or colour layer", and an empty chain gets a new one.
  const slots = chain
    .map((layer, i) => ({ layer, i }))
    .filter(s => TRANS_MAP_STYLES.find(m => m.style === s.layer.style)?.requiresField !== true);
  if (slots.length === 0) {
    chain.push(makeLayer(pick.style));
  } else {
    const slot = slots[Math.floor(Math.random() * slots.length)]!;
    chain[slot.i] = makeLayer(pick.style, slot.layer.weight > 0 ? slot.layer.weight : 1.0);
  }
  preset.overlay = { ...preset.overlay, transMapChain: chain, transMapEnabled: true };
}

/**
 * The ATTRACTOR — which strange attractor is mixed into the figure, or none.
 *
 * ⚠️ **THE `attractor` CHIP GATED NOTHING UNTIL THIS FUNCTION EXISTED.** `randomize.ts` contained **zero
 * occurrences of the word `attractor`** (measured at `24.0`, defect 2) while the chip's tooltip promised
 * "the strange-attractor generator and how strongly it is blended in" — a lock over an empty set, which
 * reads as a lock that works.
 *
 * ⚠️ **TWO-WAY BY CONSTRUCTION, AND THE 50 % IS DERIVED FROM THE LIBRARY RATHER THAN CHOSEN.** 173 of the
 * 183 presets that author `attractorIndex` author `-1`: an attractor is the exception, not the norm. A draw
 * over `[-1, ...35 attractors]` would switch one OFF 2.8 % of the time, so repeated presses would ratchet a
 * preset into permanently having one. Splitting the live case evenly between "off" and "a different one"
 * makes the subject reversible, which is what every other subject here already is.
 *
 * ⚠️ **`ATTRACTOR_ENTRY_BLEND` IS WRITTEN ONLY WHEN SWITCHING ON FROM OFF** — see its derivation in
 * `overlay-rules.ts` (half the authored visible floor). Switching between two live attractors leaves the
 * blend alone, because the user's chosen strength is about how much attractor they want, not about which one.
 * ⚠️ And the engine's `-1`-absent default is **0.6**, not 0, so a missing blend never means "off".
 */
function applyAttractorJump(preset: UnifiedPreset): void {
  const prev = preset.overlay?.attractorIndex ?? -1;
  if (prev >= 0 && Math.random() < 0.5) {
    // Off. The blend is left exactly as authored: `attractorIndex: -1` is the only thing any reader consults
    // to decide there is no attractor, so clearing the strength too would lose the user's value for nothing.
    preset.overlay = { ...preset.overlay, attractorIndex: -1 };
    return;
  }
  const indices = ATTRACTOR_PRESETS.map((_, i) => i).filter(i => i !== prev);
  if (indices.length === 0) return;
  const next = indices[Math.floor(Math.random() * indices.length)]!;
  const ov = { ...preset.overlay, attractorIndex: next };
  if (prev < 0) ov.attractorBlend = ATTRACTOR_ENTRY_BLEND;
  preset.overlay = ov;
}

/**
 * Re-roll the static field of one styles-0-3 TransMap layer — the whole `staticField` block at once.
 *
 * ⚠️ **Gated on the `transmap` lock, NOT `visual`.** This is TransMap state; `interpolate.ts` gates the
 * chain and `blendLayerBlocks()` the same way, and a user who locked TransMap to hold the warp while
 * randomising the figure would otherwise watch the field re-shape anyway (invariant 13's class — a control
 * that stops doing what it names).
 *
 * ⚠️ **`randomStaticField()` is called on the whole block, not `jitter()` per field, and that is deliberate.**
 * `jitter()` needs a `paramRanges` entry, and `preset-stats.ts` builds those from the shipped library —
 * where **no preset carries a `staticField` block at all** (measured: every TransMap-live preset is style 0-3
 * on its own `sinMagicParams`). A range collected from absent values would be empty, and `jitter()` returns
 * the value UNCHANGED when the range is absent — a mutation that appears to work and does nothing, which is
 * exactly the defect `deadcheck`'s G12 `missing` assertion exists to catch. The bounds here are therefore
 * written as literals in `randomStaticField()`, where the units are documented. **`24.D10` generalises this
 * argument to the four continuous `overlay` scalars; see `jitterRuled()`.**
 *
 * `pattern` is a NAME and jumps outright; the scalars are re-drawn rather than nudged, because a jitter of
 * `(Preset)`'s implicit defaults would produce a field the preset never described at a strength nobody chose.
 *
 * ⚠️ **THIS IS NOT `applyTransMapJump` AND THE TWO MUST NOT MERGE.** This one re-rolls a layer's FIELD and
 * keeps its style; that one replaces the STYLE and drops every per-style block. Two subjects, two output
 * channels, two weights — and the static-field jump is the rarer of the two because it only reaches presets
 * with a separable layer.
 */
function applyStaticFieldJump(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  if (locks.has('transmap')) return;
  // Derived the sanctioned way: a legacy preset has no `transMapChain`, so reading the key directly would
  // make this inert on 222 of 274 presets (the compatibility contract in `trans-map-chain.ts`).
  const chain = chainFromOverlay(
    preset.overlay,
    preset.postProcessors.transMap.style,
    preset.postProcessors.transMap.ifsParams,
  );
  // `isSeparableStyle`, not `style <= 3` — the table decides which styles have a `staticField`, or this test
  // and the four Step 14.0 removed would drift apart the next time a style is added (a style-7 layer handed a
  // `staticField` block would carry seven keys nothing reads and force the chain out of legacy form on export).
  const statics = chain.filter(l => isSeparableStyle(l.style));
  if (statics.length === 0) return;
  const target = statics[Math.floor(Math.random() * statics.length)]!;
  target.staticField = randomStaticField(Math.random);
  // A style-0 layer has no second table and no zoom term, so leaving `pattern2`/`strength2`/`zoomBias`/
  // `shape2`/`shapeMix2`/`angleX2`/`angleY2` in the block would write seven fields nothing reads — and then
  // force the chain out of legacy form on export for a difference that renders identically. Styles 1-2 are
  // the same case.
  //
  // ⚠️ **`shape2`/`shapeMix2` and `angleX2`/`angleY2` belong in THIS list and not in the one above**:
  // `buildZoomWave` is reached only from a style-3 layer, so a style-0 layer keeping a zoom shape or a zoom
  // ANGLE is a key nothing reads — and since `isStaticFieldDefault()` now tests all fifteen keys, a
  // non-default one here is enough on its own to force the chain into the array form on export (`35.1`'s fix
  // working in the direction that costs something).
  //
  // ⚠️ **`angleX`/`angleY` must NOT join this list**, and the asymmetry is the same one `shape` has: the
  // SHIFT waves are built on every separable style, so their angles are read on every one of them.
  if (target.style !== 3) {
    delete target.staticField.pattern2;
    delete target.staticField.strength2;
    delete target.staticField.zoomBias;
    delete target.staticField.shape2;
    delete target.staticField.shapeMix2;
    delete target.staticField.angleX2;
    delete target.staticField.angleY2;
  }
  // Written back as the chain, since that is the only spelling `staticField` has (`isLegacyExpressible()`
  // now returns false for it, so an export of this result carries the array).
  preset.overlay = { ...preset.overlay, transMapChain: chain };
}

/**
 * Nudge an EXISTING static field's continuous scalars — the gaussian-jitter counterpart to the jump above.
 *
 * ⚠️ **Only acts on a layer that already carries a non-default block.** Materialising one here would change
 * every styles-0-3 preset's warp on a `subtle` pass, which is not what "jitter the current preset" means: the
 * shape would leave `(Preset)` — the preset's own authored table — for an archetype the user never picked.
 * That is what `applyStaticFieldJump` is for, and it is a separate strategy the user rolls into explicitly.
 *
 * `pattern` is untouched for the same reason it snaps in the Mixer: a name has no neighbourhood to jitter in.
 */
function jitterStaticFields(preset: UnifiedPreset, sigma: number): void {
  const chain = preset.overlay?.transMapChain;
  if (!chain) return;
  let touched = false;
  for (const layer of chain) {
    if (!isSeparableStyle(layer.style) || isStaticFieldDefault(layer.staticField)) continue;
    const s = staticFieldOf(layer);
    const nudge = (v: number, span: number, lo: number, hi: number): number =>
      Math.max(lo, Math.min(hi, v + gaussianRandom() * sigma * span));

    // ⚠️ **Drift first, and OUTSIDE the archetype test, because it is the one field the `(Preset)` path
    // reads.** `resolveStaticWaves` threads `phase` into `buildWave` whichever branch it takes, so drift is
    // live on a preset-shaped field — while `strength`, `detail`, `strength2` and `zoomBias` are all ignored
    // there (the `!arch` branch uses the authored amplitudes and a hardcoded bias of 1). Jittering those on a
    // preset-shaped layer would write values with no visual effect AND force the chain out of legacy form on
    // export, for a result that renders identically.
    //
    // Only jittered once it is already moving: a standing lattice is a deliberate look — the default on every
    // library preset — so starting it drifting is a categorical change, not a nudge.
    //
    // ⚠️ **Nudged in TRACK space (sqrt), not in cells/s**, for the same reason `detail` is nudged in octaves:
    // the Drift slider is a squared track, so a linear step of `sigma * 1.0` is a fraction of the control at
    // the top of the range and a total re-roll at the bottom — at drift 0.05 a `subtle` ±0.05 is a doubling.
    // Mapping through sqrt keeps `sigma` a fraction of the slider's TRAVEL, which is what it means everywhere
    // else. Clamped to a floor of 0.005 rather than 0: a jitter must not silently stop the motion, since 0 is
    // the categorical "standing lattice" this branch just tested for.
    const drift = s.drift > 0
      ? {
          drift: Math.max(0.005, Math.min(1,
            Math.pow(Math.max(0, Math.sqrt(s.drift) + gaussianRandom() * sigma), 2))),
        }
      : {};

    // Tested with `staticFieldOf`'s resolved name against the archetype table, NOT against `PATTERN_PRESET`,
    // because `resolveStaticWaves` sends `(Custom)` and any unknown name from a hand-edited import down the
    // same preset-table branch. Comparing to the two literals would be a second, narrower enumeration of
    // "which names mean the preset's own table" — and the one that disagrees is the silent one.
    const shaped = findArchetype(s.pattern) !== undefined;
    if (!shaped) {
      if (s.drift <= 0) continue;
      layer.staticField = { ...layer.staticField, ...drift };
      touched = true;
      continue;
    }

    // Spans are the UI slider ranges (`visual-fx.ts`'s `staticSlider` calls), so `sigma` means the same
    // fraction-of-a-control here as it does for every other jittered parameter.
    layer.staticField = {
      ...layer.staticField,
      strength: nudge(s.strength, 1.0, 0, 1),
      // Detail is perceptually logarithmic — jittered in OCTAVES, then mapped back, or a fixed linear step
      // would be imperceptible at 8 and a total re-shape at 0.25 (the same reasoning as
      // `randomStaticField`'s `Math.pow(2, ...)` draw). The 5 is the slider's span in octaves
      // (log2(8/0.25) = 5), keeping `sigma` a fraction of the control here too.
      detail: Math.max(0.25, Math.min(8, Math.pow(2, Math.log2(s.detail) + gaussianRandom() * sigma * 5))),
      ...drift,
      ...(layer.style === 3
        ? {
            strength2: nudge(s.strength2, 1.0, 0, 1),
            zoomBias: nudge(s.zoomBias, 1.0, -0.5, 0.5),
          }
        : {}),
    };
    touched = true;
  }
  if (touched) preset.overlay = { ...preset.overlay, transMapChain: chain };
}

function applyFreqDoubling(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  if (locks.has('shape')) return;
  const waves = preset.generators.waves;
  if (waves.length === 0) return;
  const w = Math.floor(Math.random() * waves.length);
  const a = Math.floor(Math.random() * 3);
  const axis = waves[w]!.axes[a]!;
  axis.fm.frequency *= 2;
  axis.fm.base *= 0.8;
}

/**
 * Rotate ONE axis's phase by a NAMED angle.
 *
 * ⚠️ **NOT TO BE MERGED WITH THE `phase` JITTER `24.D7` ADDED TO `applyGaussianJitter` (stated in both
 * places).** The five angles are the ones that land a figure back on a recognisable pose — a quarter, a
 * third, a half turn — so this is a deliberate re-pose of one axis. The jitter is a sub-degree drift on all
 * nine axes at once. Same field, two output channels; folding them would keep the loud one.
 */
function applyPhaseRotation(preset: UnifiedPreset, locks: Set<CategoryLock>): void {
  if (locks.has('shape')) return;
  const waves = preset.generators.waves;
  if (waves.length === 0) return;
  const rotation = [90, 120, 180, 240, 270][Math.floor(Math.random() * 5)]!;
  const w = Math.floor(Math.random() * waves.length);
  const a = Math.floor(Math.random() * 3);
  waves[w]!.axes[a]!.phase += rotation;
}
