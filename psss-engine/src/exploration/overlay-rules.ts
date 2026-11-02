import type { OverlayState } from '../presets/types.ts';
import type { CategoryLock } from './state.ts';

/**
 * v8 Phase 23.1 + **24.1** — **THE ONE ENUMERATION OF HOW EVERY `overlay` KEY CROSSFADES *AND* MUTATES.**
 *
 * ⚠️ **TWO COLUMNS, TWO READERS, ONE LIST (24.D1).** `law` is the Mixer's (`interpolate.ts`); `mutate` is the
 * Randomiser's (`randomize.ts`). `tsc` now forces BOTH for every new `overlay` key, which is the whole point:
 * Phase 23's hole was two wholesale `result.overlay = {…}` literals and Phase 24's was a hand-written list of
 * jitter call sites, and **three enumerations of one list make a missing entry structurally invisible.** One
 * checker reads both columns (`mixercheck`, §A–§H for the blend and §I–§N for the mutation) — a second
 * checker would need its own basis and could disagree with this one.
 * ⚠️ **Phase 25 makes crossover the THIRD reader** (`25.D2` reuses `MixLaw` with a randomised snap threshold
 * rather than adding a `cross` column), so a change to either column after Phase 25 moves all three tabs.
 *
 * ⚠️ **PURE — NO IMPORTS BUT TYPES, and that is a hard constraint, not tidiness.** `checks/mixercheck.mjs`
 * imports this module under **Node**, which strips types and does nothing else: a value import would drag in
 * `presets/types.ts` and `exploration/state.ts` (classes, `JSON` helpers, the whole engine graph) and the
 * checker would die on the first browser global. The same rule `reel-model.ts` carries, and the same trap:
 * **a constructor parameter property or an `enum` throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at Node while
 * `tsc --noEmit` stays green**, so this file holds nothing but `type`, `interface` and plain `const`.
 * ⚠️ **It is also why the continuous bounds below are LITERALS and not imports** from `visual-fx.ts`'s
 * `PARTICLE_SIZE_MIN`/`MAX` and `SPEED_MIN`/`MAX`: that module reaches `document` on load. `CLAUDE.md`'s rule
 * is to share the clamp constant rather than assert that two literals agree — unsatisfiable here, so
 * **`mixercheck` §J closes the gap by reading both files' numbers and comparing them.**
 *
 * ⚠️ **`Record<keyof OverlayState, OverlayRule>` IS THE ENFORCEMENT, and it is the only thing in the codebase
 * that can see a new overlay key arrive.** Adding a field to `OverlayState` is otherwise invisible to every
 * consumer — `interpolatePreset` builds an object literal, so an unhandled key is simply absent from it, and
 * absent reads to the user as "the Mixer reset my preset", never as a missing case. With the `Record` below,
 * a new field is a **compile error until it has a rule**. This is the `RENDER_MODE_LABELS` / `REEL_*_LABELS`
 * precedent: the one site `tsc` can hold to an enumeration.
 *
 * **WHY THIS FILE EXISTS AT ALL** (plan step 23.0's census, measured 2026-10-01 over N = 274 presets):
 * `interpolatePreset` wrote **20** of the then 46 declared keys and assigned `result.overlay` **wholesale**
 * from two object literals, so the other 26 were destroyed at every `t` — including `t = 0`, where the
 * Mixer's own crossfader claims to be showing deck A untouched. 270 of 274 presets lost at least one
 * effective feature and 263 of 274 had their grade reset, at a median of 49 lost leaf paths. "24 keys
 * destroyed" and "26 keys unwritten" are the SAME HOLE on two bases (two keys had no users) — ⚠️ **never
 * reconcile the two figures by arithmetic; re-run the census.**
 *
 * **AND WHY IT GREW A SECOND COLUMN** (plan step 24.0's census, measured 2026-10-02 over the same N = 274):
 * the Randomiser could write **5** of the 44 authored keys — median **2** of a preset's 55 overlay leaf
 * paths, **6.8 %** — against **40.0 %** of its authored leaf paths overall. Press `Wild` on a modern preset
 * and you got a differently-shaped version of the same preset: same grade, same palette, same material, same
 * TransMap style, same attractor. ⚠️ **Two censuses, two bases, one defect class seen from two tabs; the
 * figures are dated readings and not index entries.**
 */

/**
 * The law a key's value is resolved by **when two presets are blended**.
 *
 * - `lerp` — `inv * a + t * b`. Exact at both endpoints (`0 * x` is 0, `1 * x` is x).
 * - `geometric` — `exp(inv * ln a + t * ln b)`. For a RATIO on a log track, where the arithmetic midpoint is
 *   not the midpoint of the handle the user set it with. ⚠️ Endpoint-exact only **to float rounding**
 *   (`exp(ln v)` is not always `v`), which is why `mixercheck` §C compares numbers with a tolerance and
 *   prints how many paths needed it.
 * - `snap` — the winning side's value, whole, at `t < 0.5`. The rule for everything categorical (invariant
 *   16) **and the default for anything whose units nobody has derived** (23.D1): a snapped key is at worst
 *   late, while a lerped one that should not have been is a value no deck authored.
 * - `bundle` — snapped, but every member of the bundle resolves from **ONE** winning side. The reason a
 *   modifier cannot be snapped independently of the thing it modifies.
 * - `custom` — the named function in `interpolate.ts` owns it, usually because the key is a block with a
 *   per-field split, or because its emission is value-gated. ⚠️ **`owner` is a UNION, not a `string`**, and
 *   `interpolate.ts` declares `Record<CustomMixerId, …>`: that makes "the owner exists" and "the owner is
 *   reachable" both compile facts, in both directions. The plan specified `owner: string` and this is
 *   narrower on purpose.
 */
export type MixLaw =
  | { kind: 'lerp' }
  | { kind: 'geometric' }
  | { kind: 'snap' }
  | { kind: 'bundle'; id: BundleId }
  | { kind: 'custom'; owner: CustomMixerId };

/** Bundle ids. Each must have **two or more** members below (`mixercheck` §B), or it is a `snap` misspelled. */
export type BundleId = 'palette' | 'grade';

/**
 * The law a key is **mutated** by — Phase 24's column, read by `randomize.ts` alone.
 *
 * ⚠️ **`frozen` IS WRITTEN OUT, NEVER LEFT IMPLICIT (24.D2).** "The Randomiser does not touch this" and "the
 * Randomiser forgot this" are the same table entry if omission is how you say the first, and the second is
 * exactly the defect Phase 24 exists to close. Every `frozen` law therefore carries a `why`, and
 * `mixercheck` §J asserts it is non-empty.
 *
 * - `continuous` — nudged by the gaussian jitter, in the units `unit` names, clamped to `[min, max]`.
 *   ⚠️ **`scale` is the TRACK the quantity lives on, not a preference**: a linear step through a log-scaled
 *   quantity is a fraction of the control at the top of the range and a total re-roll at the bottom, which
 *   is the slider-track rule restated for a mutation. ⚠️ **The bounds live HERE and not at the call site
 *   (24.D10)**, because `jitter()` returns the value UNCHANGED when a `paramRanges` entry is absent — a
 *   mutation that appears to work and does nothing — and a range built from the 2–30 presets that author
 *   one of these keys is nearly a point.
 * - `categorical` — re-rolled whole by `Look jump`. `members` NAMES the enumeration that owns the member
 *   list, module included; it is **never a copy of the list**, because a copy is the second enumeration this
 *   file exists to prevent. ⚠️ **Count the members at the owner, never here** — a count in a comment is the
 *   figure-in-an-index trap (`FILM_LOOKS`' own header read "The 14" while there were 15).
 * - `bundle` — categorical, but several keys are re-rolled **together or not at all** (24.D13: a
 *   `customFilmLookParams` left standing over a new `filmLook` is a grade no one authored).
 * - `block` — the named function in `randomize.ts` owns this key's mutation, because the key is a BLOCK with
 *   a per-field split, or because its write is value-gated (the `randomStaticField`-shaped re-rollers and
 *   the two scalars that are nudged only where they are already on).
 * - `frozen` — out of scope, with the reason. **The reason is the output-channel discriminator** for the
 *   field blocks: six field systems all terminate in ONE output channel, a smooth positional nudge, so
 *   randomising a seventh scalar inside one of them changes little the eye can name.
 */
export type MutateLaw =
  | { kind: 'continuous'; min: number; max: number; scale: 'linear' | 'geometric'; unit: string }
  | { kind: 'categorical'; members: string }
  | { kind: 'bundle'; id: MutateBundleId }
  | { kind: 'block'; owner: string }
  | { kind: 'frozen'; why: string };

/**
 * Mutation bundle ids — **a separate union from `BundleId` on purpose.** The two columns answer different
 * questions and the sets need not coincide: the palette PAIR is one bundle to the Mixer (one winning side)
 * while `palette` and `paletteMapping` are two independent draws to the Randomiser, each with its own member
 * enumeration, written by one owner.
 */
export type MutateBundleId = 'grade';

/**
 * Every custom owner is a function of this exact name in `interpolate.ts`. ⚠️ **Renaming one of those
 * functions is a compile error here** — which is the point, because `mixercheck`'s own check for the name is
 * a text grep and a grep cannot tell a rename from a deletion.
 */
export type CustomMixerId =
  | 'mixCurlNoise'
  | 'mixSymmetry'
  | 'mixTransMapChain'
  | 'mixDispersion'
  | 'mixPassOrder'
  | 'mixForceGate'
  | 'interpolateMaterial'
  | 'interpolateLiquid'
  | 'interpolateCohesion'
  | 'interpolateLiquidField'
  | 'interpolateDye'
  /*
   * v8 `34.4` (`34.D14`) — the three `Sharpness` LEVELS, which cannot use a scalar law at all.
   *
   * ⚠️⚠️ **IT IS NOT A STYLE CHOICE: `34.D11` requires `sharpnessStructure ?? sharpness`, and a scalar law's
   * absent-side value is its IDENTITY.** With `lerp` and identity 0, `interpolatePreset` — which reads preset
   * objects BEFORE adoption — resolves `Quader Faceted` at `t = 0` to Body 1 / Structure 0 / Detail 0, so the
   * crossfader de-facets two thirds of every pre-34 faceted preset at the position where it claims to show
   * deck A untouched. The owner backfills each side FIRST and then lerps. See `OVERLAY_RULES.sharpness`.
   */
  | 'mixSharpnessLevels';

/**
 * `group` is the CATEGORY LOCK the key answers to — which fader moves it, which lock holds it in the Mixer,
 * and which chip excludes it from mutation in the Randomiser. **One column, two verbs** (23.D4's warning,
 * still binding: the `categoryLocks` `Set` is shared and may not be retyped or relocated).
 *
 * ⚠️ **TWINS MUST SHARE A GROUP.** Four overlay keys have a `postProcessors`/`renderer` twin that the same
 * function also resolves (`renderMode` ↔ `renderer.mode`; `transMapEnabled`/`transMapStyle`/`ifsParams` ↔
 * `postProcessors.transMap.*`; `transMapBeforeParticles` ↔ `postProcessors.transMap.beforeParticles`). With
 * ONE master `t` the two halves of a pair could not disagree. With a fader per category they can: a pair
 * split across two groups resolves from two different winning sides, and since **the overlay wins at every
 * reader** (invariant 17) the frame would render deck A's mode under deck B's everything-else — with no
 * symptom in either half on its own. Every pair below already lands in the group its name implies; that is
 * now a RULE with a checker section (`mixercheck` §E), not a coincidence.
 *
 * ⚠️ **NINE KEYS CHANGED GROUP ON 2026-10-05 (24.1), AND THAT REVERSES THIS FILE'S OWN 23.1 NOTE**, which
 * read *"a finer split than these six is deliberately NOT done here … `palette` under `color` rather than
 * `visual` would read better in the UI and would silently change what the EXISTING `visual` lock holds, which
 * is a behaviour change dressed as a table entry."* **The behaviour change is now the point**, and it was
 * re-derived rather than inherited — three independent reasons, each of which fails without the move:
 *  1. **`24.D8` only exists if `palette` shares a group with the colour jitter.** The rule is that where two
 *     levers in one lock group mask each other the TOOLTIP says so and the code does not compensate; with
 *     `palette` in `visual` there is no shared group and therefore nothing to say.
 *  2. **`24.2` requires the `color`, `attractor` and `visual` chip tips to become TRUE.** `color` has
 *     promised *"base colour, palette and film look"* since before either phase; leaving the grade and the
 *     palette in `visual` would keep two thirds of that sentence false in the tab that owns the chip.
 *  3. **`mixercheck` §F's `live` predicates for the three zero-key groups already key off `figureScale`,
 *     `palette` and `speedFactor`** — Phase 23 wrote the fixture rule for the groups these keys now join.
 * ⚠️ **THE ACCEPTED COST, stated here rather than discovered later:** `material` and `renderMode` can now
 * snap at two DIFFERENT faders, so a blend can pair deck A's material with deck B's mode. That class is the
 * one `mixercheck`'s header records as reaching 122 of 274 pairs at an endpoint, and it is **`24.D3`'s
 * knowingly-accepted cost** — the seventh lock is what gives the user the way to hold one of the two.
 */
/**
 * The law a key is **SCALED** by — Phase 26's column, read by `slider-mappings.ts` alone.
 *
 * A Sliders row is a **relative multiplier on the preset's own value**, so this column answers one
 * question per key: *given a multiplier `m`, how does it apply here?*
 *
 * ⚠️ **`26.D6` SPECIFIED FOUR KINDS AND THERE ARE FIVE. THE FIFTH IS `block`, AND IT IS NOT A LIBERTY —
 * FOUR FLAT LAWS CANNOT EXPRESS THE SURFACE (owner-confirmed 2026-10-06).** Of the nine channels `26.5`
 * scales, **only `transMapWarpMix` and `transMapDispersion` are top-level numbers**; the other seven are
 * sub-fields of block keys (`curlNoise.turbulence`, `material.heatGain`, `liquid.thickness`, `dye.opacity`,
 * `sparks.poolSize`, `transMapChain[].weight` …). The alternatives were measured against `26.D6`'s real
 * prohibition — *no new column, no new module, no second enumeration* — and both failed it: letting each
 * ROW name its own sub-fields inline creates the fourth enumeration of the overlay surface that `26.D6`
 * and `P2` exist to prevent, and declarative `paths: string[]` puts field names in strings no compiler
 * checks, so a renamed sub-field goes quietly inert. **This adds a law KIND, not an enumeration.**
 *
 * ⚠️ **`owner` IS A UNION, NEVER A BARE `string`, AND THAT IS COPIED FROM `MixLaw.custom` RATHER THAN FROM
 * `MutateLaw.block`.** The two existing precedents disagree: `custom` carries `CustomMixerId` backed by a
 * `Record<CustomMixerId, …>` in `interpolate.ts`, which makes *"the owner exists"* and *"the owner is
 * reachable"* **both compile facts, in both directions**; `block` carries `owner: string` and nothing
 * enforces it. `custom`'s own header records that the plan had specified `string` and that the union is
 * "narrower on purpose" — so the strong form is the house style and the weak one is the outlier.
 *
 * - `mul` — multiply the value. No clamp, because the quantity has none.
 * - `mul-clamped` — multiply, then clamp to `[min, max]`. ⚠️ **The bounds live HERE as literals because
 *   this module may not import values** (it is imported under Node by two checkers), which is the same
 *   arrangement `MutateLaw.continuous` already uses — and `mixercheck` §J re-reads those constants from the
 *   files that own them and compares, so the literal is checked rather than trusted.
 * - `none` — a slider may not touch it, **with the reason**, because "no row scales this" and "a row
 *   forgot this" are the same table entry if omission is how you say the first.
 * - `categorical` — ⚠️ **never scalable. A slider may not flip an `enabled`, choose a `style`, or pick a
 *   `renderMode`** (`26.5`), and an index into a list is categorical however numeric it looks.
 * - `block` — the named scaler in `slider-mappings.ts` owns this key's sub-fields.
 */
export type ScaleLaw =
  | { kind: 'mul' }
  | { kind: 'mul-clamped'; min: number; max: number; unit: string }
  | { kind: 'none'; why: string }
  | { kind: 'categorical' }
  | { kind: 'block'; owner: ScalerId };

/**
 * Every scaler is a function of this exact name in `slider-mappings.ts`'s `SCALERS` record. ⚠️ **Renaming
 * one is a compile error here and an unreached one is a compile error there** — both directions, which is
 * the whole reason this is a union.
 */
export type ScalerId =
  | 'scaleCurlNoise'
  | 'scaleMaterial'
  | 'scaleLiquid'
  | 'scaleDye'
  | 'scaleSparks'
  | 'scaleChainWeights';

export interface OverlayRule {
  group: CategoryLock;
  /**
   * ⚠️ **NAMED `law`, NOT `mix` AS `24.D1`'s PROSE SPELLS IT, and the deviation is deliberate.**
   * `mixercheck` reads `r.law.kind` / `r.law.id` / `r.law.owner` at about ten sites; renaming the field buys
   * one word of symmetry with `mutate` and costs a rename in a measuring instrument, where a text-grep
   * clause that silently stops matching is this project's signature silent failure. The INTERFACE is renamed
   * as the step asks (`MixRule` → `OverlayRule`) because that name is read by `tsc` alone.
   */
  law: MixLaw;
  mutate: MutateLaw;
  /**
   * ⚠️ **THE FOURTH COLUMN, ADDED BY PHASE 26, AND THE TABLE NOW ANSWERS THREE SUBSYSTEMS: the Mixer blends
   * by `law`, the Randomiser mutates by `mutate`, Evolution's crossover re-reads `law` per gene, and the
   * Sliders scale by `scale`.** That is the benefit and the blast radius together: a key added to
   * `OverlayState` without all three answers does not compile, in one place, and every tab gains it at once.
   */
  scale: ScaleLaw;
}

/**
 * The category locks, in UI order. Lives here rather than beside `CategoryLock` in `state.ts` because
 * `mixercheck` imports THIS module under Node and `state.ts` is not import-safe there.
 *
 * `mixer.ts` and `randomiser.ts` both build their chip rows from this array (23.D4 / 24.2: "built from the
 * array, never hand-written"), and `25.5` makes Evolution a third consumer — **so hand-writing the rows
 * anywhere is now three times as expensive.**
 *
 * ⚠️ **`'material'` IS THE SEVENTH MEMBER (24.D3, added 2026-10-05) AND IT WENT IN BEFORE `'visual'`, NOT
 * AFTER IT.** `visual` stays last because it is the catch-all that owns 21 of the 46 keys, and keeping the
 * first five positions stable keeps every dated per-group count in this tree readable against its own order.
 */
export const CATEGORY_LOCKS = ['shape', 'color', 'motion', 'transmap', 'attractor', 'material', 'visual'] as const;

// Compile-time proof that the array above lists every member of the union. A new `CategoryLock` that is not
// added to `CATEGORY_LOCKS` makes `_LOCKS_COMPLETE` resolve to `never` and this assignment an error — the
// array alone could not do that, because a SHORTER array still satisfies `readonly CategoryLock[]`.
type _LocksComplete = Exclude<CategoryLock, (typeof CATEGORY_LOCKS)[number]> extends never ? true : never;
const _LOCKS_COMPLETE: _LocksComplete = true;
void _LOCKS_COMPLETE;

/**
 * Per-category crossfade weights (23.5). `master` is the fallback for any category the caller leaves out,
 * and is REQUIRED so that a weights object cannot be built with no weight in it at all.
 *
 * ⚠️ **`interpolatePreset`'s third parameter is named `mix`, not `t`, once it can be one of these.** A bare
 * `number | MixWeights` used arithmetically is a type error — which is exactly how the compiler finds any
 * `inv * a.x + t * b.x` that was never taught about groups. Keeping a module-level `t`/`inv` in scope "for
 * convenience" would re-open that hole invisibly; every block derives its own pair.
 */
export type MixWeights = { master: number } & Partial<Record<CategoryLock, number>>;

/**
 * Keys emitted **unconditionally**, i.e. even when NEITHER deck carries them.
 *
 * All four have an engine default of 1 (0.5 for `curlNoise.evolutionSpeed`) that is also their identity, so
 * writing it changes no frame — but it does ADD a leaf path that neither deck had, which is why
 * `mixercheck` §C reports ADDED paths against this named allowlist instead of requiring zero. ⚠️ **An
 * allowlist whose entries are not re-derived is a licence, not a check:** a key may join only if writing its
 * default is provably inert at every reader.
 */
export const UNCONDITIONAL_KEYS = [
  'curlNoise', 'speedFactor', 'figureScale', 'particleSize',
  /*
   * v8 Phase 30. ⚠️ **FOUR MORE, AND EACH ONE IS RE-DERIVED HERE RATHER THAN ADDED BECAUSE A CHECK WENT
   * RED** — the header's own rule is that an unre-derived entry is a licence, not a check. `mixercheck` §C
   * reported `overlay.twistZ` ADDED on 8 paths and `overlay.curveBias` on 4, at `t = 0`, where a deck that
   * (⚠️ `curveBias` no longer exists — `E136` was dropped on the owner's visual review, 2026-10-25. The
   * REPORT is kept because it is the evidence this allowlist was derived from, not a live key list.)
   * omits the key is lerped against one that carries it and the result is a written 0.
   *
   * ⚠️ **THE CONDITION IS *provably inert at every reader*, AND THESE FOUR MEET IT MORE STRONGLY THAN THE
   * ORIGINAL FOUR DO.** Those are multipliers whose identity is 1, so a reader multiplies by it. These are
   * gated: the twist operator's first statement is `if (twX !== 0 || twY !== 0 || twZ !== 0)` and the
   * reparameterisation's is `bias === 0 ? i * cStep : …`. **At 0 the code does not run at all**, so the
   * written key cannot change a frame by one bit — which is a stronger claim than inertness under
   * arithmetic, and it is the same claim `SCALAR_IDENTITIES` makes to admit them.
   *
   * ⚠️ **`twistX`/`twistY` are listed even though only `twistZ` went red.** The three share one gate, so a
   * deck authoring a different axis would produce the same ADDED leaf on a path no current pairing happens
   * to sample — and an allowlist that tracks which pairings exist today is an allowlist that goes red when
   * the library grows. **Admit by the RULE, not by the observed path.**
   */
  'twistX', 'twistY', 'twistZ',
  /*
   * v8 `32.1`/`32.2`/`32.7`. ⚠⚠ **NINE MORE, AND THEY SPLIT ACROSS THE TWO STRENGTHS OF CLAIM THIS
   * LIST ADMITS — which is why they are commented together rather than appended to the twist's line.**
   *
   * **The six deformers meet the WEAKER condition, and exactly.** Their gate is the whole six-tuple, so
   * *the code does not run* holds only when all six are 0 — and the reachable ADDED case is the other
   * one: one key authored on one deck, the remaining five arriving as 0 with the stage RUNNING. The
   * justification is therefore arithmetic: a taper factor is `1 + t·u` and a bend factor `1 − k·u`,
   * both exactly 1 at 0, and both enter `det J` and the position as MULTIPLIERS. **That is `particleSize`'s
   * standing, not the twist's, and overstating it would licence a future key that only looked similar.**
   *
   * **`invertAmount` meets the STRONGER one, like `wScale`:** it is the stage's whole gate, which makes
   * `invertRadius` inert at EVERY value rather than only at its default.
   *
   * ⚠ **ADMITTED BY THE RULE, NOT BY AN OBSERVED RED** — `mixercheck` reported only `taperZ` and
   * `bendZ`, on 4 paths each, because those are the axes Phase 32's demos author. The other four share
   * one gate, so a deck authoring a different axis produces the same leaf on a path no current pairing
   * samples. **An allowlist that tracks today's pairings is one that goes red when the library grows.**
   */
  'taperX', 'taperY', 'taperZ', 'bendX', 'bendY', 'bendZ',
  'invertAmount', 'invertRadius',
  /*
   * v8 31.2. ⚠️ **THREE MORE, ADMITTED BY THE RULE AND NOT BY AN OBSERVED RED** — the header's own
   * condition is *provably inert at every reader*, and these meet it in the strong form the Phase 30 four
   * do: **the operator's first statement is a three-way test against 0** (`writeChannels()` returns
   * `undefined` when all three amounts are 0), so at the written default nothing is computed, nothing is
   * published, and both render passes upload their neutral pad. A written 0 cannot change a frame by one
   * bit.
   *
   * ⚠️ **`channelDriver` IS DELIBERATELY NOT HERE, and that is a consequence of its LAW rather than a
   * separate judgement:** it `snap`s, and a snap copies the winner's value, so a key neither deck carries
   * stays absent and no ADDED leaf can appear. The box-fold's four and the plate's four are absent from
   * this list for exactly that reason. **Only a LERPED key can need admitting.**
   */
  'channelSize', 'channelAlpha', 'channelLight',
  /*
   * v8 31.4. ⚠️ **FOUR MORE LERPED KEYS, ADMITTED BY THE RULE: `wScale` 0 is the stage's whole gate, so at
   * the written default the loop does not run and the three angles cannot reach anything.** That makes the
   * angles inert at 0 *and at every other value* while `wScale` is 0 — a stronger claim than the Phase 30
   * four, not a weaker one.
   *
   * ⚠️ **A `snap` key must NOT be added here**, because a snap copies the winner's value, so a key stays
   * absent. Only a LERPED key can need admitting — the same consequence that keeps the box-fold's four and
   * the plate's four off this list.
   */
  'wScale', 'wXW', 'wYW', 'wZW',
  /*
   * v8 `33.2`/`33.3`. ⚠️ **RE-DERIVED RATHER THAN ADDED BECAUSE `mixercheck` WENT RED** — the header's own
   * rule is that an un-re-derived entry is a licence, not a check. The red was `overlay.sharpness` ADDED on
   * **12** paths and `overlay.travelZ` on **8**, both at `t = 0`, where one deck carries the key and the
   * other omits it: the lerp then writes the identity and the result gains a leaf deck A never had.
   *
   * ⚠️ **BOTH EARNED THE STRONG CLAIM — *the code does not execute* — which is the twist's standing and not
   * the taper's.** `sharpness` 0 is a BRANCH in the evaluation loop: the triangle is never evaluated and
   * `Math.sin` is called directly, so the frame is bit-identical to a preset that omits the key. `travel*`
   * 0 is a PER-AXIS gate, and that is why those three `if`s exist: the triple gate alone would leave
   * `x += 0 * s` reachable, which is exactly `x` for every finite `x` except `-0`. **Per-axis testing
   * replaces a reachability argument nobody can check with a branch anybody can read.**
   *
   * ⚠️⚠️ **v8 `34.D14` — `'sharpness'` HAS LEFT THIS LIST AND ITS DEPARTURE IS FORCED BY ITS LAW, NOT BY A
   * NEW JUDGEMENT ABOUT INERTNESS.** It is now a `custom` key, and a custom owner decides its own emission:
   * `mixSharpnessLevels` writes exactly the UNION of the three level keys the two decks carry, so a key
   * NEITHER deck has stays absent. **This list's own first sentence is the test — *keys emitted even when
   * neither deck carries them* — and the three level keys are not.**
   *
   * ⚠️⚠️ **AN ADDED LEAF IS STILL REACHABLE AND THE DESIGN PASS GOT THAT WRONG — measured.** `mixercheck`
   * §C went red on `Interference × Quader Faceted` at `t = 0`: deck B carries the key, deck A does not, and
   * the union emits it. **The admission could not be an entry here even so**, because an absent level means
   * *follow Body*, so the inert value is the DECK'S OWN resolved level rather than the constant 0 this list
   * admits at. `mixercheck`'s rule **(3f)** is a measured equality against that resolved value instead.
   * ⚠️ **`UNCONDITIONAL_LEAVES` holds itself to this array by name, so `'sharpness'` had to leave both
   * together**; that clause is what would have caught a half-done removal.
   */
  'travelX', 'travelY', 'travelZ',
  /*
   * v8 `34.2`/`34.3`/`34.4`. ⚠️⚠️ **TWENTY-SIX MORE — the largest growth this list has had — AND THEY SPLIT
   * ACROSS THE TWO STRENGTHS OF CLAIM IT ADMITS. ADMITTED BY THE RULE AND NOT BY AN OBSERVED RED**, because
   * no shipped preset carries one of them yet and an allowlist derived from today's pairings is one that goes
   * red the moment the library grows (`32.9`'s lesson, already recorded above for the taper).
   *
   * **`offsetX/Y/Z` meet the STRONG condition — *the code does not execute*.** `applyOffset` tests each axis
   * separately, exactly as `applyTravel` does and for the identical reason: the triple gate alone would leave
   * `x += 0 * h` reachable with the stage running, which is `x` for every finite `x` **except `-0`**.
   *
   * **`growX/Y/Z` meet the WEAKER one, and overstating them would licence a future key that only looked
   * similar.** Their per-axis `if` is a COST gate: the factor is `1 + 0·τ`, exactly 1, and it enters as a
   * MULTIPLIER, so `x * 1` preserves `-0` and the admission is arithmetic. **That is `particleSize`'s
   * standing, not the twist's.**
   *
   * **The twenty depths and rates meet the STRONG one.** `resolveOp` returns the base UNCHANGED where
   * `depth === 0` — it does not compute `base + sin(x)·0` and then clamp — so at the written identity
   * nothing is evaluated and the resolved value is bit-identical to the base. ⚠️ A rate is admitted at 0 for
   * a second, independent reason as well: a rate with no depth is read by nothing.
   */
  'offsetX', 'offsetY', 'offsetZ',
  'offsetDepthX', 'offsetDepthY', 'offsetDepthZ',
  'offsetRateX', 'offsetRateY', 'offsetRateZ',
  'growX', 'growY', 'growZ',
  'growDepthX', 'growDepthY', 'growDepthZ',
  'growRateX', 'growRateY', 'growRateZ',
  'travelDepthX', 'travelDepthY', 'travelDepthZ',
  'travelRateX', 'travelRateY', 'travelRateZ',
  'sharpnessDepth', 'sharpnessRate',
] as const;

/**
 * The blend an attractor ENTERS at when the Randomiser switches one on from `-1` (24.D9).
 *
 * ⚠️ **DERIVED FROM THE LIBRARY, NOT PICKED BECAUSE IT LOOKS GENTLE** — that is the whole of 24.D9. Measured
 * 2026-10-05 over N = 274: `attractorIndex` is authored by 183 presets and **173 of them author `-1`**, so
 * switching one on is almost always *introducing* an attractor into a preset never designed for one. The
 * **10** presets that do carry one author blends `1, 0.75, 0, 0.75, 0.7, 0.75, 0.95, 1, 1, 0.95` — bimodal,
 * one muted 0, and **a visible floor of 0.70**: no author has ever shipped a *visible* attractor below it.
 * The entry blend is therefore the midpoint of the empty interval `[0, 0.70]`, i.e. **half the authored
 * visible floor** — present enough to see, far enough below every authored value to read as an addition to
 * the figure rather than as a different animation.
 *
 * ⚠️ **NOT `DEFAULT_ATTRACTOR_BLEND` (0.6, `main.ts`)**, which is most of the way to a different animation
 * and is the engine's answer to "the key is missing", a different question. **Switching from one live
 * attractor to another leaves `attractorBlend` alone.**
 */
export const ATTRACTOR_ENTRY_BLEND = 0.35;

/*
 * Shared `frozen` reasons. ⚠️ **ONE SENTENCE PER CLASS, NOT PER KEY, because the reason really is the same
 * one** — and a per-key paraphrase of a shared argument is how a table grows 27 subtly different versions of
 * one rule. The classes are the ones `24.D2` names.
 */
/** The six field systems and the populations that ride them. */
const WHY_FIELD = 'Field block (24.D2): six field systems all terminate in ONE output channel, a smooth '
  + 'positional nudge, so a seventh random scalar inside one changes little the eye can name — and the thin '
  + 'end of the library cannot supply a usable range for it (24.D10). Adding an output channel is the '
  + 'high-value move; adding a field is not.';
/** Renderer populations: a width or a flag for something that is or is not drawn. */
const WHY_POPULATION = 'Renderer population (24.D2): the flag and its scalars resolve together or the '
  + 'feature half-arrives, and a width for a ribbon that is not drawn is not a mutation anyone can see.';
/** TransMap's remaining scalars — in scope for the Mixer, out of scope for the Randomiser. */
const WHY_TRANSMAP_SCALAR = 'Out of the identity tier (24.D2): the TransMap jump re-rolls the STYLE through '
  + 'the chain owner, which is the change a user can name; nudging one of the warp\'s own scalars reads as '
  + 'the same warp drifting.';
/**
 * v8 `34.2`/`34.D13` — the nine `Offset` keys' shared reason. ⚠️ **ONE sentence for the class, like the
 * three above**, because the reason really is one reason: the base, the depth and the rate all move the
 * figure off the centre every rotation is taken about.
 */
const WHY_OFFSET_CENTRING = 'Centring (34.D13): a random Offset breaks the centring every preset relies on '
  + 'and that every rotation is taken ABOUT, so the Randomiser would routinely hand back figures spinning '
  + 'off-centre or out of frame — which reads as the Randomiser being broken rather than as variety. '
  + '⚠ The reason is written here rather than left as an absence, because a key missing from the Randomiser '
  + 'for a reason nobody wrote down is indistinguishable from a key somebody forgot. ⚠ It cuts the OPPOSITE '
  + 'way from Phase 35\'s warp shapes, which ARE reachable: a warp shape cannot produce an invalid field, '
  + 'only a torn one, while an Offset can put the subject off the screen. State the contrast; do not '
  + 'harmonise it.';

/**
 * ⚠️ **ALL 46 KEYS OF `OverlayState`, TWICE OVER, AND THE COMPILER WILL NOT LET EITHER BE 45.**
 *
 * The twenty keys `interpolatePreset` already handled on 2026-10-05 keep their `law` **verbatim** — this
 * table NAMES what that function does, it does not redefine it, and a law here that disagrees with the code
 * there is the defect (`mixercheck` §B checks the owners by name; §C and §D check the arithmetic by
 * measurement). The twenty-six revived ones are `snap` per 23.D1, plus the three-key `grade` bundle per
 * 23.D2.
 *
 * The `mutate` column is `24.D2`'s identity tier — **19 keys reachable, 27 explicitly `frozen`** — and those
 * two numbers are a dated reading of the table below, not a budget: count them from the table.
 */
export const OVERLAY_RULES = {
  // ── Ribbons and lines: four keys, one feature, 178 presets. `ribbonMode` is categorical; the three
  // scalars COULD lerp and deliberately do not (23.D1) — `ribbonWidth` without `ribbonMode` is a width for
  // a ribbon that is not drawn, so the four must resolve together or the feature half-arrives.
  // ── 27.6: the splat shear convention. Categorical, so `snap` rather than `lerp` — invariant 16, and a
  // blended two-way choice has no meaning. `frozen` for mutation on the same WHY_POPULATION grounds as the
  // ribbon keys: it changes the whole population's mark shape at once, so a randomiser flipping it reads as
  // the preset having been replaced rather than varied.
  splatShear: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_POPULATION },
    scale: { kind: 'categorical' },
  },
  ribbonMode: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_POPULATION },
    scale: { kind: 'categorical' },
  },
  ribbonWidth: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_POPULATION },
    scale: { kind: 'mul' },
  },
  linesEnabled: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_POPULATION },
    scale: { kind: 'categorical' },
  },
  lineWidth: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_POPULATION },
    scale: { kind: 'mul' },
  },

  // ── The GRADE, as ONE bundle from ONE winning side (23.D2) and ONE draw (24.D13). `customFilmLookParams`
  // is meaningless under a different look's name, and `sliderBaseFilmLook` is the palette the sliders
  // restore FROM — three keys describing one decision. ⚠️ This REVERSES the exclusion `interpolate.ts`
  // argued for until 2026-10-05 (a grade applied before a crossfade used to survive it); see that
  // function's header for the trade.
  // ⚠️ **GROUP `color` SINCE 24.1** (was `visual`): the chip has always promised the film look.
  // ⚠️ **3 of `FILM_LOOKS`' bundles carry no palette and ABSTAIN** — they write nothing, so a jump onto one
  // leaves the previous palette standing. That is the engine's rule (21.4g), not a defect to route around.
  filmLook: {
    group: 'color', law: { kind: 'bundle', id: 'grade' },
    mutate: { kind: 'bundle', id: 'grade' },
    scale: { kind: 'categorical' },
  },
  customFilmLookParams: {
    group: 'color', law: { kind: 'bundle', id: 'grade' },
    mutate: { kind: 'bundle', id: 'grade' },
    scale: { kind: 'none', why: 'the grading pass owns it (26.D2)' },
  },
  sliderBaseFilmLook: {
    group: 'color', law: { kind: 'bundle', id: 'grade' },
    mutate: { kind: 'bundle', id: 'grade' },
    scale: { kind: 'categorical' },
  },

  // ── The palette pair: one winner, each emitted only where that winner has it (v8 Step 21.4c).
  // `undefined` is not `'none'` — absent means "inherit the look's palette".
  // ⚠️ **ONE `law` BUNDLE, TWO `mutate` DRAWS.** The Mixer must take both from one side or a mapping arrives
  // under a palette that has no such channel; the Randomiser draws each from its own enumeration and one
  // owner (`applyPaletteJump`) writes both. ⚠️ **`paletteMapping`'s `'index'` member resolves to
  // `PALETTE_MAPPING_OFF`** — the owner handles it explicitly rather than drawing it blind.
  // ⚠️ **GROUP `color` SINCE 24.1** (was `visual`), which is what makes 24.D8 expressible: a palette jump
  // MASKS the `colorBase/Amp/Freq/Shift` jitter in the same group, precedence being
  // palette > material ramp > preset colour. **The tooltip says so; the code does not compensate.**
  palette: {
    group: 'color', law: { kind: 'bundle', id: 'palette' },
    mutate: { kind: 'categorical', members: 'getAllPaletteNames() in presets/palettes.ts' },
    scale: { kind: 'categorical' },
  },
  paletteMapping: {
    group: 'color', law: { kind: 'bundle', id: 'palette' },
    mutate: {
      kind: 'categorical',
      // ⚠️ Declared THREE times with different members — `film-looks.ts`'s is the one `OverlayState` imports.
      members: 'PaletteMapping in renderers/film-looks.ts',
    },
    scale: { kind: 'categorical' },
  },

  // ── Attractors. ⚠️ `attractorIndex` is an INDEX into a list of unrelated maps, so a lerp would sweep
  // through attractors neither deck chose; and `attractorBlend`'s engine default is **0.6, not 0**, so
  // losing the key did not fade the attractor out, it faded a DIFFERENT one in at 60%.
  // ⚠️ **THE `attractor` CHIP GATED NOTHING IN THE RANDOMISER UNTIL 24.5** (`randomize.ts` contained zero
  // occurrences of `attractor`) while its tooltip promised the generator and its blend — defect 2. These two
  // rows are its subject: the index jumps, the blend is nudged, and `ATTRACTOR_ENTRY_BLEND` is where an
  // attractor switched on from `-1` enters.
  /*
   * v8 `26.4`'s new key, and the first key added since the table grew its fourth column — so it is also the
   * proof the arrangement works: **`tsc` refused to compile until all four laws were answered**, in one
   * place, and the Mixer, the Randomiser, Evolution and the Sliders gained it together.
   */
  paletteHueShift: {
    group: 'color',
    // Lerped, not snapped: it is an angle, and a crossfade through intermediate hues is what a fader
    // promises. It sits in `color` so it travels with the palette it rotates.
    law: { kind: 'lerp' },
    // ⚠️ **FROZEN DELIBERATELY.** The Randomiser already re-skins colour by drawing a whole new PALETTE (a
    // categorical jump); a hue nudge on top would move the same quality twice in one press. `26.D6` forbids
    // this phase from changing a law another phase owns — this is a NEW key, so the law is ours to set, and
    // it is set to "out of scope, with the reason".
    mutate: { kind: 'frozen', why: 'colour identity is re-rolled by the palette jump, not by a hue nudge' },
    // ⚠️ **NOT SCALABLE, AND THE REASON IS ARITHMETIC RATHER THAN POLICY: multiplying an ANGLE is
    // meaningless** — 0 is the identity, so no multiplier can ever leave it. The `Warmth` row therefore
    // SETS this key from its own position, exactly as `Speed` sets `speedFactor`.
    scale: { kind: 'none', why: 'an angle has no meaningful multiplier; the Warmth row SETS it' },
  },
  attractorIndex: {
    group: 'attractor', law: { kind: 'snap' },
    mutate: { kind: 'categorical', members: 'ATTRACTOR_PRESETS in generators/attractors.ts, plus -1 for off' },
    scale: { kind: 'categorical' },
  },
  attractorBlend: {
    group: 'attractor', law: { kind: 'snap' },
    mutate: {
      kind: 'continuous', min: 0, max: 1, scale: 'linear',
      unit: 'fraction of the attractor field mixed into the figure (0 = off-looking, 1 = the attractor)',
    },
    scale: { kind: 'mul-clamped', min: 0, max: 1, unit: 'fraction' },
  },

  // ── Render mode. Twin of `renderer.mode`, which snaps in the SAME group (see the twin rule above).
  // ⚠️ **`overlay.renderMode` IS THE ONLY CHANNEL A RE-APPLY READS** — `main.ts`'s resolution is
  // `preset.overlay?.renderMode ?? (isSamePreset ? currentRenderMode : (preset.renderer.mode ?? 'star'))`,
  // so **both** branches ignore `preset.renderer.mode`. Writing that field instead was defect 1: inert on
  // every preset, and worse than inert, because the spurious value forced a renderer dispose + re-init into
  // the mode the engine was already in. The write site is `writeMaterialAndMode()` in `randomize.ts`, shared
  // with `material` so the two cannot race (24.D12).
  renderMode: {
    group: 'visual', law: { kind: 'snap' },
    mutate: {
      kind: 'categorical',
      members: 'RANDOMISABLE_RENDER_MODES in exploration/randomize.ts (a deliberate subset of RenderMode, '
        + 'whose one tsc-enforced site is RENDER_MODE_LABELS in ui/synthesis-lab/tabs/visual-fx.ts)',
    },
    scale: { kind: 'categorical' },
  },

  // ── TransMap's overlay half. The first three are twins of `postProcessors.transMap.*`, all in `transmap`.
  // ⚠️ **A STYLE JUMP GOES THROUGH THE CHAIN OWNER, NEVER THROUGH `transMapStyle` ALONE (24.D11)** — all 52
  // chain-carrying presets would mask the write, because `chainFromOverlay()` prefers the chain. So the
  // `mutate` laws of these two name the enumeration they draw from while `transMapChain`'s names the owner
  // that does the writing.
  transMapEnabled: {
    group: 'transmap', law: { kind: 'snap' },
    mutate: { kind: 'categorical', members: 'boolean, drawn by applyTransMapJump() together with the style' },
    scale: { kind: 'categorical' },
  },
  transMapStyle: {
    group: 'transmap', law: { kind: 'snap' },
    mutate: {
      kind: 'categorical',
      members: 'TRANS_MAP_STYLES in post-processors/trans-map-chain.ts, less the requiresField modifiers',
    },
    scale: { kind: 'categorical' },
  },
  transMapBeforeParticles: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixPassOrder' },
    mutate: {
      kind: 'frozen',
      why: 'Pass ORDER, not an identity (24.D2): it re-sequences the whole pipeline, and the same frame '
        + 'warped before rather than after the particles is not a different idea, it is a different engine.',
    },
    scale: { kind: 'categorical' },
  },
  ifsParams: {
    group: 'transmap', law: { kind: 'snap' },
    mutate: {
      kind: 'frozen',
      why: 'A correlated matrix of affine transforms (24.D10): no single field has a neighbourhood worth '
        + 'jittering, and a random transform set is a different attractor rather than a nudged one. A style-4 '
        + 'jump with no ifsParams falls back to defaultIfsParams(), so the jump stays reachable without this.',
    },
    scale: { kind: 'none', why: 'a transform list, not a scalar' },
  },

  // ── The four already-written `visual` scalars, THREE OF WHICH MOVED GROUP IN 24.1. `curlNoise` is a block
  // (snapped flag, three lerps); `particleSize` is GEOMETRIC because its slider is a log track — see the
  // derivation in `interpolate.ts`.
  // ⚠️ **`curlNoise` is the one of the four the Randomiser could ALREADY write** — two of its four fields,
  // on the 181 presets that carry the block.
  curlNoise: {
    group: 'visual', law: { kind: 'custom', owner: 'mixCurlNoise' },
    mutate: { kind: 'block', owner: 'applyGaussianJitter' },
    scale: { kind: 'block', owner: 'scaleCurlNoise' },
  },
  // ⚠️ **GROUP `motion` SINCE 24.1** (was `visual`) — it is the playback rate, and `mixercheck` §F already
  // used it as the `motion` group's liveness predicate.
  // ⚠️ **107i's `speedFactor` fix is undecided between two non-equivalent one-liners — CHANGE NEITHER SIDE**
  // (24.D15). The bounds are the engine's own clamp, `SPEED_MIN`/`SPEED_MAX` in `visual-fx.ts`; the library
  // authors 0.1–5 on 243 presets at a median of 1 (measured 2026-10-05).
  speedFactor: {
    group: 'motion', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.01, max: 5.0, scale: 'linear',
      unit: 'playback-rate multiplier (1 = the preset\'s authored speed)',
    },
    scale: { kind: 'mul-clamped', min: 0.01, max: 5, unit: 'x' },
  },
  // ⚠️ **GROUP `shape` SINCE 24.1** (was `visual`) — it is the figure's size, and §F already used it as the
  // `shape` group's liveness predicate.
  // ⚠️ **`scale: 'geometric'` DEVIATES FROM 24.0's TABLE, WHICH LEAVES THIS CELL UNMARKED, and the reason is
  // a measurement rather than a preference.** `figureScaleToPos()` is `(log2(s)/log2(5) + 1) / 2` — a LOG
  // track from 0.2 to 5 — so a linear step of `sigma × 4.8` is a tenth of the control at 5× and a total
  // re-frame at 0.25×. The MIX law stays `lerp`, which is Phase 23's separately measured answer to a
  // different question: **two measurements wearing the same words.**
  figureScale: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.2, max: 5.0, scale: 'geometric',
      unit: 'multiplier on the design box (main.ts clamps to this range; the slider track is log base 5)',
    },
    scale: { kind: 'mul-clamped', min: 0.2, max: 5, unit: 'x' },
  },
  // ⚠️ **GROUP `shape` SINCE 24.1** (was `visual`). Bounds are `PARTICLE_SIZE_MIN`/`MAX` in `visual-fx.ts`,
  // repeated as literals because this module may import no values (see the header) — **`mixercheck` §J reads
  // both files and compares the numbers**, which is the nearest reachable form of "share the constant".
  // The library authors 0.6 / 1.46 / 3.03 as min / median / max on 30 presets (measured 2026-10-05), which
  // is `24.D10`'s thin end: the table's bounds are the engine's, not that sample's.
  particleSize: {
    group: 'shape', law: { kind: 'geometric' },
    mutate: {
      kind: 'continuous', min: 0.25, max: 4.0, scale: 'geometric',
      unit: 'multiplier on every particle base size; four paths share it, plus a fifth BASE on the splat path',
    },
    scale: { kind: 'mul-clamped', min: 0.25, max: 4, unit: 'x' },
  },

  // ── Symmetry: a small integer naming a point group, plus the mirror flag that follows it. Value-gated
  // (emitted only above fold 1), hence `custom` rather than `bundle`.
  symmetryFold: {
    group: 'visual', law: { kind: 'custom', owner: 'mixSymmetry' },
    mutate: {
      kind: 'frozen',
      why: 'Out of the identity tier (24.D2). A fold is a point group: it reads as a kaleidoscope over the '
        + 'figure rather than as a new figure, and the Composer owns the only Symmetry row by owner ruling.',
    },
    scale: { kind: 'categorical' },
  },
  symmetryMirror: {
    group: 'visual', law: { kind: 'custom', owner: 'mixSymmetry' },
    mutate: { kind: 'frozen', why: 'Follows symmetryFold, which is frozen: a mirror of no fold is nothing.' },
    scale: { kind: 'categorical' },
  },

  /*
   * ── v8 30.1 (E129a) Barr twist, three signed scalars. GROUP `shape`, like `figureScale`, because the
   * operator changes what the figure IS rather than how it is rendered.
   *
   * ⚠️ **`lerp` IS CORRECT HERE WHERE `symmetryFold` NEEDED A CUSTOM OWNER, and the difference is the
   * quantity rather than a preference.** A fold is a point group: there is no figure halfway between a
   * 4-arm and a 5-arm rosette, so it snaps. A twist is a continuous angle, and half of one turn is exactly
   * half a turn — so the midpoint of a Mixer blend is a real figure and a plain lerp is the honest law.
   *
   * ⚠️ **MUTABLE, UNLIKE `symmetryFold`, AND THE REASON IS THE PHASE'S OWN PURPOSE.** The fold is frozen
   * out of the identity tier because *it reads as a kaleidoscope over the figure rather than as a new
   * figure*. A twist is the opposite: it produces a body the generator cannot otherwise reach, which is
   * exactly what the Randomiser and Evolution exist to find. **If a mutated twist turns out to read as
   * noise rather than as variety, freeze it here — that is a one-line change and it is the right site.**
   *
   * ⚠️ **FIRST SIGNED `continuous` RANGE IN THIS TABLE**, so `scale: 'linear'` is not a default inherited
   * from a neighbour — a geometric scale cannot pass through zero, and zero is this operator's identity.
   *
   * ⚠️ **±2 IS REPEATED FROM `TWIST_MAX_TURNS` AS A LITERAL BECAUSE THIS MODULE MAY IMPORT NO VALUES** (see
   * the header: `mixercheck` imports it under Node). That is the same compromise `particleSize` makes, and
   * it carries the same obligation — **a checker must read both files and compare the numbers**, which is
   * owed by `30.8` and is not discharged by this comment.
   *
   * ⚠️ **`scale: none` RATHER THAN A MULTIPLIER, and it is a property of the identity rather than an
   * omission:** a Sliders-tab scaler multiplies a value, and this value's identity is **0**, where any
   * multiplier is inert. Nothing in `SLIDER_OWNED_OVERLAY_KEYS` may therefore point at these three — which
   * is the one way this key could leak.
   */
  /*
   * ── v8 30.2 (E130) box-fold, four keys, ALL FOUR `snap` AND ALL FOUR `frozen`.
   *
   * ⚠️ **`snap`, NOT `lerp`, AND THE ARGUMENT IS `symmetryFold`'s VERBATIM (30.D12):** a fold is a
   * categorical operator. There is no figure halfway between one fold at one cell size and three folds at
   * another — the intermediate is not a blend of the two, it is a fourth figure neither deck authored.
   * ⚠️ **And it is why none of these four may enter `SCALAR_IDENTITIES`**: `boxFoldLimit`'s default is
   * 0.35, which is NOT an identity (an absent key must stay absent, and 0.35 is a real cell), so the rule
   * that record states — *a scalar law whose default is not its identity belongs in the snap column* —
   * puts it here by construction rather than by preference.
   *
   * ⚠️ **`frozen` FOR MUTATION, WHICH SPLITS THIS PHASE'S TWO OPERATORS, AND THE SPLIT IS PRINCIPLED.**
   * `twist` above is mutable; this is not. The dividing line is the one `symmetryFold`'s own row already
   * draws: *a fold reads as a kaleidoscope over the figure rather than as a new figure.* A twist is a
   * continuous deformation and produces a body the generator cannot otherwise reach — which is what the
   * Randomiser exists to find. A fold replaces the figure with an arrangement OF the figure, and rolling
   * one into a preset never designed for it is the `attractorBlend` hazard in a cheaper form.
   * **Continuous deformations mutate; folds do not. Apply that rule to anything added to this group.**
   */
  boxFoldIterations: {
    group: 'shape', law: { kind: 'snap' },
    mutate: {
      kind: 'frozen',
      why: 'A fold is an arrangement OF the figure, not a new figure — symmetryFold’s own argument. '
        + 'Continuous deformations (twist) mutate; folds do not.',
    },
    scale: { kind: 'categorical' },
  },
  boxFoldLimit: {
    group: 'shape', law: { kind: 'snap' },
    mutate: { kind: 'frozen', why: 'Follows boxFoldIterations: a cell size with no fold folds nothing.' },
    scale: { kind: 'none', why: 'Gated by the iteration count; no scaler owns a fold.' },
  },
  boxFoldScale: {
    group: 'shape', law: { kind: 'snap' },
    mutate: { kind: 'frozen', why: 'Follows boxFoldIterations, and it is the one fold field that compounds.' },
    scale: { kind: 'none', why: 'Gated by the iteration count; no scaler owns a fold.' },
  },

  /*
   * ── v8 31.2 (E112/E113/E137) per-particle appearance: ONE categorical driver + THREE lerped amounts.
   *
   * ⚠️ **THE DRIVER SNAPS AND THE AMOUNTS LERP, AND THE SPLIT IS NOT A COMPROMISE — IT IS WHAT EACH
   * QUANTITY IS.** The driver names which ordered quantity is read; there is no quantity halfway between
   * `velocity` and `depth`, so it is `attractorIndex`'s case exactly (invariant 16: the Mixer must SNAP
   * categorical fields at t = 0.5). An amount is a continuous strength about an identity of 0, so half of
   * it is exactly half, and a midpoint blend IS a figure someone could have authored — `twistX`'s case.
   *
   * ⚠️ **AND THIS BLOCK IS *NOT* `attractorBlend`'s SHAPE.** There the
   * continuous amount had to snap because it travelled with a categorical identity that jumped under it —
   * lerping the amount would crossfade toward a plate about to be replaced. Here the categorical and the
   * continuous are INDEPENDENT: a driver change does not invalidate an amount, because every driver is a
   * `d ∈ [0, 1]` and the amount means the same thing against all four. **Two superficially identical
   * blocks with opposite laws, and the test that separates them is whether the categorical field changes
   * what the continuous one MEANS.**
   *
   * ⚠️ **MUTABLE, UNLIKE THE PLATE AND THE FOLD, AND IT FALLS ON `twist`'s SIDE OF PHASE 30's DIVIDING
   * LINE.** These do not replace the figure or arrange it: they modulate the appearance of the particles
   * the preset already chose, which is a body the generator cannot otherwise reach — exactly what the
   * Randomiser and Evolution exist to find. **Continuous modulations mutate; figure sources and folds do
   * not.**
   *
   * ⚠️ **ALL FOUR ARE `scale: none`, AND FOR THE AMOUNTS IT IS THE IDENTITY RATHER THAN POLICY:** a
   * Sliders-tab scaler MULTIPLIES, and these identities are 0, where any multiplier is inert — `twistX`'s
   * reason verbatim. Nothing in `SLIDER_OWNED_OVERLAY_KEYS` may therefore point at any of them.
   */
  channelDriver: {
    group: 'shape', law: { kind: 'snap' },
    mutate: {
      kind: 'categorical',
      members: 'ChannelDriver in core/interfaces.ts — index | velocity | depth | colourPhase',
    },
    scale: { kind: 'categorical' },
  },
  channelSize: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'per-particle SIZE amount; the multiplier spans 1±amount (CHANNEL_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  channelAlpha: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'per-particle ALPHA amount; folded into the premultiplied output (invariant 9)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  /*
   * ⚠️ `channelLight` is in `shape` rather than `color` DESPITE multiplying the resolved colour, and the
   * reason is what the group means for a LOCK. The `color` lock exists so a user can hold a deck's colour
   * identity while the rest blends — and this key carries no colour identity at all: it modulates whatever
   * the precedence chain already chose, in whichever palette wins. Locking `color` and finding the
   * lightness channel frozen with it would freeze a *structural* property under a colour lock. **The
   * driver and its three amounts are one control surface and they travel together.**
   */
  channelLight: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'per-particle LIGHTNESS amount, applied AFTER the colour precedence chain (31.D12)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },

  /*
   * ── v8 31.4 (E132) the 4D rotation: an EXTENT and three ANGLES, all four `lerp`.
   *
   * ⚠️ **ALL FOUR LERP, because the midpoint of two 4D poses is a real 4D pose** — the same claim
   * `twistX` makes and the same one `paletteHueShift` makes for an angle. **This is NOT the attractor's
   * case: there is no categorical identity underneath that a lerped amount could crossfade toward and
   * then have replaced.**
   *
   * ⚠️ **MUTABLE, and it falls on `twist`'s side of Phase 30's dividing line:** a 4D pose is a continuous
   * reorientation producing a body the generator cannot otherwise reach, which is what the Randomiser
   * exists to find. `wScale` is mutable for the same reason; at 0 the whole stage is skipped, so a
   * mutation that lands there is simply the operator off.
   */
  wScale: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0, max: 1, scale: 'linear',
      unit: 'fourth-axis extent, as a fraction of the design half-extent (W_SCALE_MAX in '
        + 'core/deform-limits.ts). 0 skips the whole stage bit-exactly',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  /*
   * ⚠️ The three angles are in TURNS and are **not clamped in the engine**, deliberately — an angle wraps,
   * so `setPaletteHueShift`'s argument applies verbatim: clamping would silently disagree with a Mixer
   * blend of two angles or with an imported preset. **The `continuous` bounds below are the RANDOMISER's
   * range, which is a different quantity from a clamp.**
   */
  wXW: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.5, max: 0.5, scale: 'linear',
      unit: 'rotation in the x-w plane, in TURNS; ±0.5 is a half turn, which covers every distinct pose',
    },
    scale: { kind: 'none', why: 'An angle has no meaningful multiplier; identity is 0.' },
  },
  wYW: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.5, max: 0.5, scale: 'linear',
      unit: 'rotation in the y-w plane, in TURNS',
    },
    scale: { kind: 'none', why: 'An angle has no meaningful multiplier; identity is 0.' },
  },
  /*
   * ⚠️ **`wWinding` SNAPS while the three angles LERP, in one block, and the split is the same one the
   * channel block draws: a winding COUNT is categorical** (there is no figure at 2.5 winds — it does not
   * close) **while an angle is continuous.** It is also the one key here whose default is not its
   * identity, which independently forces `snap`.
   */
  wWinding: {
    group: 'shape', law: { kind: 'snap' },
    mutate: {
      kind: 'categorical',
      members: 'integers 1..W_WINDING_MAX in core/deform-limits.ts',
    },
    scale: { kind: 'categorical' },
  },
  wZW: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.5, max: 0.5, scale: 'linear',
      unit: 'rotation in the z-w plane, in TURNS. ⚠️ This is the plane that moves DEPTH — 31.9 measured '
        + '66.9 % depth inversion here against a 27.9 % image change',
    },
    scale: { kind: 'none', why: 'An angle has no meaningful multiplier; identity is 0.' },
  },

  /*
   * v8 `32.1`/`32.2`/`32.7` — Phase 32's nine fields.
   *
   * ⚠️ **`mutate` is column two and it is NOT documentation**: fixing an inert write makes a strategy live
   * wherever it is reachable, tiers included. The taper and bend bounds below are the CLAMP constants, so
   * the Randomiser cannot author a value the generator would then clamp — which would make an exported
   * preset differ from the one that was randomised.
   *
   * ⚠️ **`invertAmount` carries the operator's gate, so its identity is 0 and its `scale` is `none`** for
   * `twistX`'s reason: a multiplier on an identity of 0 is inert.
   */
  taperX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.95, max: 0.95, scale: 'linear',
      unit: 'cross-section scale per half-extent about X (TAPER_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  taperY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.95, max: 0.95, scale: 'linear',
      unit: 'cross-section scale per half-extent about Y (TAPER_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  taperZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.95, max: 0.95, scale: 'linear',
      unit: 'cross-section scale per half-extent about Z (TAPER_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  bendX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.85, max: 0.85, scale: 'linear',
      unit: 'curvature rate per half-extent about X (BEND_MAX_RATE in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  bendY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.85, max: 0.85, scale: 'linear',
      unit: 'curvature rate per half-extent about Y (BEND_MAX_RATE in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  bendZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.85, max: 0.85, scale: 'linear',
      unit: 'curvature rate per half-extent about Z (BEND_MAX_RATE in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  /*
   * v8 `33.2` — `Sharpness`. ⚠️ **`'shape'` BECAUSE IT CHANGES THE FIGURE, AND YET IT IS NOT A
   * DEFORMATION** — it moves the basis function, not positions as a function of position. `facetcheck`
   * §B's family scan will demand a decision about it; the decision is `NOT_DEFORMATION`, recorded there
   * with this reason. Those two statements are the whole of `33.D9`.
   */
  /*
   * ⚠️⚠️ **v8 `34.D14` — THE LAW IS `custom`, NOT `lerp`, AND THE SHIPPED KEY'S LAW MOVED WITH ITS TWO
   * NEW SIBLINGS. IT IS A CONSEQUENCE OF `34.D11`, NOT A CHOICE, AND THE FAILURE IT PREVENTS IS SILENT AT
   * THE WORST POSSIBLE POSITION.**
   *
   * `34.D11` requires `sharpnessStructure ?? sharpness` (never `?? 0`), and `SCALAR_IDENTITIES`' own header
   * forbids exactly that: *"a scalar law whose default is NOT its identity must not be added here"*.
   * `interpolatePreset` reads the PRESET objects, **before any adoption** — so with `lerp` and a scalar
   * identity of 0, at **t = 0** `Quader Faceted` (which carries `sharpness: 1` and neither new key) would
   * resolve to Body 1 / Structure 0 / Detail 0. **The Mixer's own crossfader would de-facet two thirds of
   * every pre-Phase-34 faceted preset at the position where it claims to be showing deck A untouched.**
   *
   * ⚠️⚠️ **`mixercheck` §C IS STRUCTURALLY BLIND TO IT: the leaf is written on BOTH sides, so it is
   * neither ADDED nor DESTROYED — only WRONG**, and §C's whole question is add-versus-destroy.
   * `deformcheck` §N carries the clause that does see it, over the six named presets.
   *
   * `mixSharpnessLevels` resolves each side's three levels through the same `?? sharpness` backfill FIRST
   * and then lerps the three resolved triples. One owner, two readers (the Mixer and Evolution's crossover,
   * which re-reads `law` per gene), and `tsc` enforces the owner's existence in BOTH directions.
   *
   * ⚠️ **Rejected alternatives, named so they are not re-proposed:** a `MigrationLayer` backfill (forbidden
   * by `34.D6`, and invariant 14 says two optional scalars do not earn one); a normaliser at the reader (*an
   * identity gate belongs in the ONE owner of the set, never in a normaliser at the reader*); and `snap` for
   * all three, which would make Sharpness categorical — it is not, the midpoint of two blends is a real
   * blend, and the shipped key already lerped on 12 paths.
   *
   * ⚠️ **All three therefore LEAVE `SCALAR_IDENTITIES` and `UNCONDITIONAL_KEYS`** — the first by `tsc`
   * (`KeysWithLaw<'lerp' | 'geometric'>` excludes `custom`), the second by hand, since that list is a bare
   * string array. **With a custom owner the EMISSION is the owner's own decision**: it emits exactly the
   * union of keys the two decks carry, so a key NEITHER deck has stays absent.
   *
   * ⚠️⚠️ **BUT THAT DOES NOT MAKE AN ADDED LEAF UNREACHABLE, AND THE DESIGN PASS PREDICTED OTHERWISE AND WAS
   * WRONG — MEASURED.** `mixercheck` §C went red on `Interference × Quader Faceted` at `t = 0`, 22
   * comparisons: deck **B** carries `sharpness` and deck A does not, so the union includes it and the result
   * gains a leaf deck A never had. **Carrying the key on EITHER side is what materialises it; the custom
   * owner changes nothing about that.** The honest admission is a RULE rather than an allowlist entry,
   * because an absent level means *follow Body* and the inert value is therefore the DECK'S OWN resolved
   * level rather than a constant — `mixercheck`'s rule **(3f)** owns it.
   *
   * v8 `33.2` — `'shape'` BECAUSE IT CHANGES THE FIGURE, AND YET IT IS NOT A DEFORMATION: it moves the
   * basis function, not positions as a function of position. `facetcheck` §B carries that decision in
   * `NOT_DEFORMATION` with the reason. Those two statements are the whole of `33.D9`.
   */
  sharpness: {
    group: 'shape', law: { kind: 'custom', owner: 'mixSharpnessLevels' },
    mutate: {
      kind: 'continuous', min: 0, max: 1, scale: 'linear',
      unit: 'basis blend from sine (0) to triangle (1) at wave level 0 (Body); SHARPNESS_MAX in core/deform-limits.ts',
    },
    scale: { kind: 'none', why: 'Identity is 0 and the generator BRANCHES on it; no scaler owns it.' },
  },
  /*
   * v8 `34.4` (`34.D11`) — the other two wave LEVELS. ⚠️ **Levels are not axes**, which is why `Sharpness`
   * is the one operator of the four that gains four keys rather than nine.
   *
   * ⚠️ **`mutate: continuous` AND NOTHING ROLLS THEM — the gap is DECLARED here rather than hidden
   * (`34.D13`).** Measured 2026-10-29: `jitterRuled` has exactly FOUR literal call sites (`figureScale`,
   * `particleSize`, `speedFactor`, `attractorBlend`) while **sixteen keys declared `continuous` have none** —
   * all of twist, taper, bend, inversion, channels, 4D, `sharpness` and `travel*`. So `sharpness` never
   * rolled either, and this column is a DECLARATION whose only reader is a `Record` totality check.
   * **`34.D13` keeps it that way on purpose and forbids adding the call sites here**: fixing the seventeen
   * changes behaviour on a shipped surface across every Randomiser tier and is owed its own step.
   * ⚠️ **`mixercheck`'s out-of-bounds scan cannot see it** (`if (v === undefined) continue`, so an unwritten
   * key passes vacuously) — read that clause's own message with this paragraph beside it.
   */
  sharpnessStructure: {
    group: 'shape', law: { kind: 'custom', owner: 'mixSharpnessLevels' },
    mutate: {
      kind: 'continuous', min: 0, max: 1, scale: 'linear',
      unit: 'basis blend at wave level 1 (Structure); defaults to `sharpness`, NEVER to 0 (34.D11)',
    },
    scale: { kind: 'none', why: 'Identity is 0 and the generator BRANCHES on it; no scaler owns it.' },
  },
  sharpnessDetail: {
    group: 'shape', law: { kind: 'custom', owner: 'mixSharpnessLevels' },
    mutate: {
      kind: 'continuous', min: 0, max: 1, scale: 'linear',
      unit: 'basis blend at wave level 2 (Detail); defaults to `sharpness`, NEVER to 0 (34.D11)',
    },
    scale: { kind: 'none', why: 'Identity is 0 and the generator BRANCHES on it; no scaler owns it.' },
  },
  /*
   * v8 `34.4` — `Temper`, the breathing of `Sharpness`. ⚠️ **ONE depth and ONE rate for all three LEVELS**,
   * which is the specification's own asymmetry (*"all three levels breathe on one cycle"*) and the reason
   * this operator is +4 rather than +9.
   *
   * ⚠️⚠️ **THE MIX LAW IS `lerp` WHILE THE RATE'S SLIDER TRACK IS GEOMETRIC, AND THE DISAGREEMENT IS
   * DELIBERATE.** `geometric` is `exp(inv·ln a + t·ln b)` and `ln 0` is `−∞`, so **a key whose identity is
   * 0 cannot have a geometric mix law.** The same split already exists for `colorShift`. **Do not "fix" one
   * half to match the other.** The `mutate` scale IS geometric, because that one governs a nudge WITHIN the
   * range and never touches 0.
   */
  sharpnessDepth: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -0.5, max: 0.5, scale: 'linear',
      unit: 'signed breathing depth of the basis blend (SHARPNESS_DEPTH_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  sharpnessRate: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate in modulator units; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  /*
   * v8 `33.3` — `Travel`, the secular term, one rule per axis (`33.D7`, triplets).
   *
   * ⚠️ The bound is `TRAVEL_MAX = 1.0` of the design HALF-extent and it is the only thing between a
   * slider and a figure off screen — **nothing auto-fits this term**, unlike every other figure quantity.
   */
  travelX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'secular sweep along X across the population, in design half-extents (TRAVEL_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  travelY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'secular sweep along Y across the population, in design half-extents (TRAVEL_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  travelZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'secular sweep along Z across the population, in design half-extents (TRAVEL_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  /*
   * v8 `34.4` — `Stretch`, the breathing of `Travel`, **PER AXIS (`34.D11`, reversing `34.D8`)**.
   *
   * ✅ **WHAT THE PER-AXIS REVERSAL BOUGHT, and it is the whole of what it bought:** three axes wandering at
   * three different rates give a slow Lissajous drift rather than a straight-line shuttle. One rate per
   * operator could not express that, and it was the only demo subject the narrowing changed.
   *
   * ⚠️ **`travelY` HAS NO CARRIER IN THE LIBRARY** (`travelX` 1, `travelY` **0**, `travelZ` 2), so these
   * two Y keys are authorable, interpolated, exported and reached by no preset-driven instrument. Named, so
   * the first author to use Y is not the one who finds the defect.
   */
  travelDepthX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'signed breathing depth of the X sweep, in design half-extents (TRAVEL_DEPTH_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  travelDepthY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'signed breathing depth of the Y sweep, in design half-extents (TRAVEL_DEPTH_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  travelDepthZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 1, scale: 'linear',
      unit: 'signed breathing depth of the Z sweep, in design half-extents (TRAVEL_DEPTH_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  travelRateX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the X sweep; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  travelRateY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the Y sweep; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  travelRateZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the Z sweep; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  /*
   * v8 `34.2` — **`Offset`, the DC translation term**, and `34.4`'s `Sway`, its breathing. Nine rows
   * (`34.D11`): three bases, three depths, three rates.
   *
   * ⚠️ **The unit is the design HALF-EXTENT, shared with `travel` above by `34.D3`**, so the two rows read
   * in one unit and a Z offset composes with a Z travel in a quantity the perspective readout can bound.
   *
   * ⚠️⚠️ **ALL NINE ARE `frozen` (`34.D13`) AND THE REASON IS IN THE COLUMN.** It is the one operator in
   * this phase the Randomiser must not reach, and `Sway` is frozen for the base's reason: a breathing offset
   * is still an offset.
   *
   * ⚠️ **It is NOT a member of the `Deformed` chip** — the translation is exact (max deviation `0.00e+0`
   * from a clean shift), and every real member of that chip maps a point as a function of POSITION after the
   * wave sum. `facetcheck` §B's `NOT_DEFORMATION.offset` carries the decision and the reason.
   */
  offsetX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the stage does not execute; no scaler owns it.' },
  },
  offsetY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the stage does not execute; no scaler owns it.' },
  },
  offsetZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the stage does not execute; no scaler owns it.' },
  },
  offsetDepthX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  offsetDepthY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  offsetDepthZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  offsetRateX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  offsetRateY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  offsetRateZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: { kind: 'frozen', why: WHY_OFFSET_CENTRING },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  /*
   * v8 `34.3` — **`Grow`, the along-curve amplitude RAMP COEFFICIENT**, and `34.4`'s `Flare`, its breathing.
   * Nine rows (`34.D11`).
   *
   * ⚠️⚠️ **`0` IS THE IDENTITY, NOT `1`, AND THIS TABLE CANNOT EXPRESS AN IDENTITY.** The stroke's
   * amplitude runs `am · (1 + k·τ)`, so at `k = 0` the multiplier is exactly 1 for every particle. A reader
   * who sees "multiplier" and writes 1 as a default doubles the far end of every stroke in the library,
   * silently. The full statement is on `GROW_FLOOR` in `core/deform-limits.ts`; `SCALAR_IDENTITIES` is where
   * the claim is actually MADE, beside `invertRadius: 1.0` as the counter-example.
   *
   * ⚠️ **`continuous`, with the same declared-but-unreached gap as `sharpness` above — `34.D13` option
   * (b), chosen by the owner and stated rather than hidden.** `34.D10` had said *"`Grow` rolls"*; the
   * measurement that followed showed the Randomiser reaches no figure operator at all, so what ships is the
   * DECLARATION plus the named gap. **Do not add the call site here**; it is one of seventeen and they go
   * together.
   *
   * ⚠️ **NOT a member of the `Deformed` chip, and this is the CLOSE CALL of the two** — it changes the
   * SILHOUETTE materially (a cone out of a circle), so a user hunting for *figures whose shape is operated
   * on* would reasonably expect to find it. **The rule decides it, not the intuition:** the chip's members
   * all map a point AFTER the wave sum, and this scales the sum by a function of the particle INDEX. If the
   * owner wants it findable the answer is a chip of its own, never a widening of `Deformed`.
   */
  growX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 3, scale: 'linear',
      unit: 'amplitude RAMP COEFFICIENT along X; 0 is the identity, -1 tapers to a point (GROW_FLOOR/GROW_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the factor is exactly 1; no scaler owns it.' },
  },
  growY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 3, scale: 'linear',
      unit: 'amplitude RAMP COEFFICIENT along Y; 0 is the identity, -1 tapers to a point (GROW_FLOOR/GROW_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the factor is exactly 1; no scaler owns it.' },
  },
  growZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -1, max: 3, scale: 'linear',
      unit: 'amplitude RAMP COEFFICIENT along Z; 0 is the identity, -1 tapers to a point (GROW_FLOOR/GROW_MAX)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the factor is exactly 1; no scaler owns it.' },
  },
  growDepthX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'signed breathing depth of the X amplitude ramp (GROW_DEPTH_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  growDepthY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'signed breathing depth of the Y amplitude ramp (GROW_DEPTH_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  growDepthZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'signed breathing depth of the Z amplitude ramp (GROW_DEPTH_MAX in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where the modulator is SKIPPED; no scaler owns it.' },
  },
  growRateX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the X amplitude ramp; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  growRateY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the Y amplitude ramp; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  growRateZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.4, max: 60, scale: 'geometric',
      unit: 'breathing rate of the Z amplitude ramp; 0 = never cycles (OP_RATE_MIN/OP_RATE_MAX)',
    },
    scale: { kind: 'none', why: 'A rate is not a magnitude a Sliders multiplier could mean anything by.' },
  },
  /*
   * v8 `33.4` — which foliation of the escape field the particles follow.
   *
   * ⚠️ **`snap`, NOT `lerp` (`33.D11`, invariant 16)** — there is no halfway between following a level set
   * and following its gradient, so the Mixer must choose one at t = 0.5 rather than interpolate a word.
   * ⚠️ **`'motion'` rather than `'shape'`: it changes HOW the particles move through a field, not what the
   * figure is** — and that keeps it out of `facetcheck` §B's shape-family scan, which is correct here
   * rather than convenient: the escape-time figure's shape is set by `bounds`, not by this.
   */
  escapeFlow: {
    group: 'motion', law: { kind: 'snap' },
    mutate: {
      kind: 'categorical',
      members: "OverlayState.escapeFlow in presets/types.ts — contour | ray",
    },
    scale: { kind: 'categorical' },
  },
  invertAmount: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0, max: 0.6, scale: 'linear',
      unit: 'lerp from identity toward a full 3D sphere inversion; 32.6 measured 0.3 as clean',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  invertRadius: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: 0.25, max: 2, scale: 'linear',
      unit: 'inversion sphere radius, as a multiple of the figure half-extent',
    },
    scale: { kind: 'none', why: 'Inert while invertAmount is 0, which is the normal case.' },
  },
  twistX: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'turns per half-extent of the design box about X (TWIST_MAX_TURNS in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  twistY: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'turns per half-extent of the design box about Y (TWIST_MAX_TURNS in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },
  twistZ: {
    group: 'shape', law: { kind: 'lerp' },
    mutate: {
      kind: 'continuous', min: -2, max: 2, scale: 'linear',
      unit: 'turns per half-extent of the design box about Z (TWIST_MAX_TURNS in core/deform-limits.ts)',
    },
    scale: { kind: 'none', why: 'Identity is 0, where a multiplier is inert; no scaler owns it.' },
  },

  // ── Field systems and populations, all snapped: each is a block whose own flags gate GL resources, and
  // 23.D1's units argument applies to every scalar inside them (invariant 10).
  physarum: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  fluidAdvection: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  buoyancy: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  sparks: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'block', owner: 'scaleSparks' },
  },
  volumeRender: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  fluidFeedback: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  proceduralFlow: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  crystal: { group: 'visual', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  // ⚠️ `growth` is IMPORT-ONLY — nothing live reads it. Snapped like the rest so a round trip through the
  // Mixer does not silently drop a block a hand-authored file carries.
  growth: {
    group: 'visual', law: { kind: 'snap' },
    mutate: {
      kind: 'frozen',
      why: 'Import-only: nothing live reads it, so a mutation here is invisible BY CONSTRUCTION — the exact '
        + 'shape of defect this phase exists to remove, not to add.',
    },
    scale: { kind: 'none', why: 'import-only' },
  },

  // ── The five blocks with per-field asymmetric rules. ⚠️ **Four of them demonstrate four different
  // asymmetric-side rules and NONE generalises to the next** — read each owner's header before touching it.
  // ⚠️ **`material` IS THE SEVENTH GROUP'S ONLY KEY (24.D3)**, and it is the one key in this table whose
  // mutation can black the frame: `splat` with no material draws NOTHING, and all 77 presets whose effective
  // mode is `splat` carry a live material. One owner writes it and `renderMode` together (24.D12).
  material: {
    group: 'material', law: { kind: 'custom', owner: 'interpolateMaterial' },
    mutate: {
      kind: 'categorical',
      members: 'MATERIAL_PRESETS in generators/material-presets.ts, plus the bare string None (invariant 18)',
    },
    scale: { kind: 'block', owner: 'scaleMaterial' },
  },
  dye: { group: 'visual', law: { kind: 'custom', owner: 'interpolateDye' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'block', owner: 'scaleDye' },
  },
  liquid: { group: 'visual', law: { kind: 'custom', owner: 'interpolateLiquid' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'block', owner: 'scaleLiquid' },
  },
  cohesion: { group: 'visual', law: { kind: 'custom', owner: 'interpolateCohesion' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  liquidField: { group: 'visual', law: { kind: 'custom', owner: 'interpolateLiquidField' }, mutate: { kind: 'frozen', why: WHY_FIELD },
    scale: { kind: 'none', why: 'no row scales it' },
  },

  // ── TransMap's force field and warp. ⚠️ `transMapWarpMix`'s engine default is **1.0**, so losing the key
  // did not disable the warp, it put it to FULL on 33 presets that had dialled it back.
  transMapWarpMix: {
    group: 'transmap', law: { kind: 'snap' },
    mutate: {
      kind: 'frozen',
      why: WHY_TRANSMAP_SCALAR + ' And `Chain Mix` 0 is not `Enable` off — uMix scales only the summed '
        + 'offset, so a roll to 0 would read as a broken warp rather than as a bypass.',
    },
    scale: { kind: 'mul-clamped', min: 0, max: 1, unit: 'mix' },
  },
  // Nudged only where it is already nonzero — a value-gated write, so an owner rather than bounds.
  transMapDispersion: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixDispersion' },
    mutate: { kind: 'block', owner: 'applyGaussianJitter' },
    scale: { kind: 'mul' },
  },
  transMapForceBlend: { group: 'transmap', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_TRANSMAP_SCALAR },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  transMapForceReturn: { group: 'transmap', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_TRANSMAP_SCALAR },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  transMapForceSparks: { group: 'transmap', law: { kind: 'snap' }, mutate: { kind: 'frozen', why: WHY_TRANSMAP_SCALAR },
    scale: { kind: 'categorical' },
  },
  transMapForceGateBy: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixForceGate' },
    mutate: {
      kind: 'frozen',
      why: 'A source NAME has no neighbourhood to jitter in, and a roll onto age/temperature with no live '
        + 'material would silently turn a working gate OFF — so even the categorical jump leaves it alone.',
    },
    scale: { kind: 'categorical' },
  },
  transMapForceGateAmount: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixForceGate' },
    mutate: { kind: 'block', owner: 'applyGaussianJitter' },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  transMapForceGateInvert: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixForceGate' },
    mutate: { kind: 'frozen', why: 'A boolean whose only nudge is its opposite — that is a jump, not a jitter.' },
    scale: { kind: 'categorical' },
  },
  transMapForceGateHalfLife: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixForceGate' },
    mutate: { kind: 'block', owner: 'applyGaussianJitter' },
    scale: { kind: 'none', why: 'no row scales it' },
  },
  // ⚠️ **TWO WRITERS, ONE SPELLING, AND THEY WRITE DIFFERENT PARTS OF IT.** `applyTransMapJump` owns the
  // layer's STYLE (24.D11) and `applyStaticFieldJump` / `jitterStaticFields` own a separable layer's
  // `staticField` block. The `owner` below names the style one because that is the write 24.1 adds; both go
  // through `chainFromOverlay()` and write the chain back whole, which is the only spelling `staticField`
  // has.
  transMapChain: {
    group: 'transmap', law: { kind: 'custom', owner: 'mixTransMapChain' },
    mutate: { kind: 'block', owner: 'applyTransMapJump' },
    scale: { kind: 'block', owner: 'scaleChainWeights' },
  },
  // ⚠️ **`as const satisfies` AND NOT A `Record<…>` ANNOTATION, THOUGH IT DOES THE SAME JOB AND MORE.**
  // `satisfies` still requires every key of `keyof OverlayState` — the completeness check this file exists
  // for is unchanged — but it keeps each entry's LITERAL types, which is what lets `KeysWithLaw` below read
  // a key's law back out at compile time. With the annotation instead, every law widened to `MixLaw` and
  // `SCALAR_IDENTITIES` in `interpolate.ts` would have had to re-list the scalar keys by hand.
} as const satisfies Record<keyof OverlayState, OverlayRule>;

/**
 * The overlay keys whose mixing law is one of `K` — derived FROM the table, never listed again.
 *
 * ⚠️ **This is the mechanism that stops a second enumeration appearing.** `interpolate.ts` needs the set of
 * scalar-law keys (to give each an identity value) and a checker needs the set of snapped ones; writing
 * either list out by hand would mean a key could change law in this file and keep its old treatment over
 * there, which is precisely the class of silent defect Phase 23 exists to close. ⚠️ A key with NO entry in
 * the derived `Record` does not compile — in both directions.
 */
export type KeysWithLaw<K extends MixLaw['kind']> = {
  [P in keyof typeof OVERLAY_RULES]: (typeof OVERLAY_RULES)[P]['law']['kind'] extends K ? P : never;
}[keyof typeof OVERLAY_RULES];

/**
 * The same derivation over the MUTATION column — `KeysWithMutate<'continuous'>` is the set `randomize.ts`
 * may hand to `jitterRuled()`, and a key that changes law there loses its call site as a type error rather
 * than keeping a treatment the table no longer describes.
 */
export type KeysWithMutate<K extends MutateLaw['kind']> = {
  [P in keyof typeof OVERLAY_RULES]: (typeof OVERLAY_RULES)[P]['mutate']['kind'] extends K ? P : never;
}[keyof typeof OVERLAY_RULES];

/**
 * The same derivation over the SCALE column. `KeysWithScale<'block'>` is the set whose sub-fields a scaler
 * owns, and `KeysWithScale<'mul-clamped'>` the set that carries bounds — so a key that changes law here
 * loses its call site as a type error rather than keeping a treatment the table no longer describes.
 */
export type KeysWithScale<K extends ScaleLaw['kind']> = {
  [P in keyof typeof OVERLAY_RULES]: (typeof OVERLAY_RULES)[P]['scale']['kind'] extends K ? P : never;
}[keyof typeof OVERLAY_RULES];

/**
 * Resolve one category's weight out of `mix`. The ONE place the `number | MixWeights` union is collapsed.
 *
 * A plain `number` means "this weight for every category", which is what the master fader alone sends and
 * what `fieldcheck`'s four call sites pass. A `MixWeights` resolves the category's own fader, falling back to
 * `master` for any category the caller left out (a row with `follow master` ticked sends nothing).
 */
export function weightsFor(mix: number | MixWeights, group: CategoryLock): { t: number; inv: number } {
  const t = typeof mix === 'number' ? mix : (mix[group] ?? mix.master);
  return { t, inv: 1 - t };
}
