import type { SinMagicParams, UnifiedPreset } from './types.ts';
import type { WaveConfig } from '../core/interfaces.ts';

/**
 * @file ANCHORED VARIANTS — a hand-tuned second version of a library preset that ships ALONGSIDE it
 *       rather than replacing it, positioned immediately after its anchor.
 *
 * ## Why this file exists and why `refined-presets.ts` could not hold it
 *
 * `REFINED_PRESETS` has exactly two placements, both derived from the anchor's own name in `main.ts`'s
 * interleave loop: a key equal to a legacy name REPLACES that preset in place, and a key equal to
 * `` `${name}${REFINED_SUFFIX}` `` lands immediately after it. **A third name has no placement there** —
 * it falls to the orphan sweep and is appended at the END of the refined group, which is exactly the
 * "reads as a positioning bug rather than a naming one" failure that file's header warns about. Since
 * `public/psss_presets.json` is READ-ONLY and its key order is the only thing deciding position, and since
 * `PresetManager.list()` sorts nothing, an additional preset at a chosen position needs its anchor stated
 * explicitly. That is the whole content of this file: `after` is the position.
 *
 * ⚠️ **This is an ORDERED ARRAY, not a `Record`.** Two variants sharing one anchor must have a defined
 * order between them, and an object's key order would encode it invisibly; here the array index does.
 *
 * ⚠️ **A variant is a FULL, INDEPENDENT preset**, for the same reason the refined ones are: either half of
 * a pair may be deleted later, so nothing derives from its anchor at runtime.
 *
 * ⚠️ **The `name` and `preset.metadata.name` must agree** — they are two of the five owners of a preset
 * name (`namecheck`), and a mismatch is invisible to `tsc`.
 *
 * ⚠️ **A variant's source export almost always arrives under the ANCHOR's name**, since it was hand-tuned
 * on the anchor and exported from there — `Sphere II` came from a `Sphere new` export and
 * `Dual Spiral Wind II` from a `Dual Spiral Wind` one. So **re-writing `metadata.name` is not a tidy-up, it
 * is the step that makes the entry a variant at all**; pasted verbatim it would collide with its own anchor,
 * and a duplicate key is a frozen tile rather than a repeated label (`namecheck`). Worse, a settle and its
 * variant can arrive as TWO exports bearing ONE name (2026-09-12: `Dual Spiral Wind_…154255` and
 * `…154618`, 3 min 23 s apart) — **only the timestamp in the file name tells them apart, so record the
 * file name in the entry's doc comment**, which is the only thing that survives the download folder.
 * ⚠️ **"The anchor's name" above means the anchor's, its ` new` sibling's, or an ad-hoc WORKING name that was
 * never a library key at all — never the variant's own**, and which of the three a given batch uses is not a
 * rule. **SIX arrival combinations are on record** — so open the files rather than inferring the roles from
 * their names:
 *   1. a ` new` export with NO settle export at all (`Sphere II`; its anchor settled from no export) — ⚠️ **and
 *      2026-09-17's THIRD batch added TWO more in one sitting** (`Rubber Penta Spirals` ← `Penta Spirals`,
 *      `Dancing Quader` ← `Quader`), taking this shape from one instance in three weeks to three. **Both
 *      anchors settled by a pure RE-KEY**, which is what makes the shape available at all: there is no settle
 *      export, so there is no second timestamp and **"which export settled" is the wrong question here** —
 *      shapes 3 and 4's whole ambiguity is absent and the one file name on record is the variant's. ⚠️ **The
 *      by-product is that this shape measures the re-key/paste `sliderBaseFilmLook` divide with both halves in
 *      ONE sitting** (`refined-presets.ts`' header): the anchor keeps its base, the variant has none.
 *      ⚠️ **A FOURTH instance arrived 2026-09-19 in the EIGHTH settle batch (`Waves II`, from
 *      `Waves new_20260919_190248.json`) and it BREAKS that by-product**, because its anchor did not settle at
 *      all: **`Waves` took a KEEP-THE-ORIGINAL verdict**, so it ships as the raw migrated 2023 body with no
 *      `REFINED_PRESETS` entry of any kind, there was never a re-key to keep a base, and the deleted
 *      refinement's `sliderBaseFilmLook: 'Glacier'` is simply gone from the library. ⚠️ **So the shape is
 *      "no settle export", NOT "the anchor re-keyed"** — three instances had made those look like one fact, and
 *      the fourth separates them. It is also the entry that falsifies this file's "every anchor is settled"
 *      claim below, and **the only place the anchor's `water` refinement survives at all.**
 *   2. the ` new` half of a pair whose PLAIN half settled the anchor (`Entropy on Fire` 2026-09-12, and
 *      2026-09-13's `Hades on Fire II`, `Hell Razer II`, `High Frequency II`). ⚠️ **A FIFTH instance arrived
 *      2026-09-19 in the fifth settle batch (`The Masters Light II`), its first in six days** — and it is the
 *      one worth reading, because **the batch's two exports were three minutes apart and the request named
 *      them in the WRONG order for their file names**: `The Masters Light new_…150158` became the VARIANT and
 *      the PLAIN-named `The Masters Light_…150449` settled the anchor. An earlier audit of this very sitting
 *      recorded it as shape 4 from the names alone and was wrong. **Open both files; the ` new` in a file name
 *      says which key the owner had loaded when they exported, not which half of the pair it becomes.**
 *      ⚠️ **A SIXTH instance arrived 2026-09-19 in the EIGHTH batch (`Who Needs A Fractal II`, from
 *      `Who Needs A Fractal new_20260919_191926.json`, 14 min 56 s AFTER the plain-named export that settled
 *      the anchor)**, and this time the request's bullet order and both file names agreed with the roles — the
 *      opposite of the fifth instance. **Two instances of one shape disagreeing about whether the file names
 *      can be trusted is the reason the instruction is "open both files" rather than "check the order".**
 *      ⚠️ **Its pair is also the cleanest A/B this file holds**: the variant's `generators` block and its
 *      whole TransMap chain are BYTE-IDENTICAL to the settled anchor's, so the two differ in presentation
 *      only — `Legacy Graded` star rendering against an `Ember` splat with three live populations.
 *   3. two exports bearing ONE name, the anchor's PLAIN one (`Dual Spiral Wind II` 2026-09-12,
 *      `Fluid II` and `Inside Nebula II` 2026-09-13, `Lost In Another Sky II` 2026-09-14,
 *      `Birth of a Black Hole` 2026-09-17, `Multi Mixer` + `Aizawa Particle Swarm` in that day's SECOND
 *      batch, and `Transmission II` in its SEVENTH) — only the timestamp tells them apart, and ⚠️ **not even
 *      the ORDER
 *      is a rule**: `Dual Spiral Wind`'s EARLIER export settled the pair, `Lost In Another Sky`'s LATER one
 *      did. **Its EIGHT instances split 4–4, exactly even, for the LATER export settling** (re-counted
 *      2026-09-19, seventh batch, in the entries, each of which records both timestamps — do not count it from
 *      the two examples
 *      named here; the seventh batch's own export settled EARLIER, which is what tied it). ⚠️ **With the split
 *      tied there is no majority left to lean on**, so the refusal to predict "which export settled" is now
 *      arithmetic rather than caution.
 *      ⚠️ **This is the commonest shape — 8 of the 30 entries — so treat "which export settled" as
 *      a question to be ANSWERED per entry, never predicted.** ⚠️ **It gained nothing in 2026-09-17's THIRD
 *      batch, whose three variants are shapes 1, 1 and 4, nothing in 2026-09-18's either (shape 6), nothing in
 *      2026-09-19's (shape 4) and nothing in that day's FIFTH batch (shape 2)**, so its share fell from a third
 *      of the file to 7/27 with no entry moving:
 *      **that is a denominator change, not a trend away from the shape** — and it happened FOUR times,
 *      in consecutive sittings. ⚠️ **Four consecutive denominator-only moves is itself the thing to notice**: a
 *      share that only ever falls, while the shape it describes is unchanged, is why this file states counts
 *      over a named denominator instead of percentages. ⚠️ **The SEVENTH batch ENDED that run — 7/27 → 8/28,
 *      the numerator's first move since 2026-09-17's second batch** — and the share barely changed while the
 *      thing being counted did. **Read the numerator; the share is the part that moves for no reason.**
 *      ⚠️ **The EIGHTH batch resumed the denominator-only moves and did it by TWO at once — 8/28 → 8/30**,
 *      its two arrivals being shapes 1 and 2. **So a denominator-only move is not even reliably worth one**,
 *      and this shape's share has now fallen five times for reasons that say nothing about the shape.
 *      ⚠️ **The two 2026-09-17 additions land on OPPOSITE sides of that split, in ONE sitting**
 *      (`Multi Mixer`'s anchor settled from the LATER export, `Aizawa Particle Swarm`'s from the EARLIER),
 *      which is the strongest available evidence that the order is not even a per-batch convention.
 *   4. two exports bearing ONE name, the ` new` one (`Hypno Penta II`, 2026-09-13; and
 *      `Penta Star Eternal Flow`, 2026-09-17's THIRD batch, `…155329` settling and `…155608` shipping,
 *      2 min 39 s apart) — the awkward case: BOTH source files are named for a key that CEASES TO EXIST the
 *      moment the settle lands, so neither file name names anything in the shipped library. ⚠️ **Its second
 *      instance took nearly a month to arrive, and both times the LATER export became the variant** — with two
 *      data points that is a hint, not the rule shape 3 explicitly denies itself; **do not promote it to one.**
 *      ⚠️ **A THIRD instance arrived 2026-09-19 (`Solar Fusion II`, from `Solar Fusion new_…164636.json`
 *      settling and `…165044.json` shipping, 4 min 8 s apart) and the LATER export was the variant again** —
 *      three for three. **Still do not promote it**: shape 3 has seven instances and splits 4–3 on exactly this
 *      question, so the two shapes would then disagree about a property of the same act, which is the reason
 *      neither is allowed to be a rule. ⚠️ **Note what makes this shape's ambiguity real rather than theoretical
 *      here: BOTH files are `Solar Fusion new_…`, and `Solar Fusion new` no longer exists in the library at
 *      all** — the settle deleted it. **Match on the timestamp the request gives, never on the name.**
 *   5. ⚠️ **NO export of its own at all** (`Hypnosis II`, 2026-09-13) — a body already stored as a PENDING
 *      `REFINED_PRESETS` entry, moved here by a RENAME. **The first four all answer "which name did the
 *      export bear"; this one has no export to ask about**, so a variant does not imply a download, and the
 *      doc-comment rule above ("record the file name") has nothing to record but the rename itself.
 *   6. ⚠️ **an export under a THIRD name that was never a library key** (`Mandelbrot River`, 2026-09-16, from
 *      `Mandelbrot Simulation new v3_…213055.json`) — a working name with a version suffix. Shapes 1–4 all
 *      answer "which of the pair's two names did the export bear"; here the answer is NEITHER, so the file
 *      name resolves against nothing in the shipped library and nothing in `REFINED_PRESETS` either, and only
 *      the timestamp relates it to the settle export 10 min 23 s earlier. ⚠️ **FOUR exports of this one pair
 *      exist** — 21:20:32, 21:27:55, `v2` 21:29:04, `v3` 21:30:55 — **and the request named TWO**, the FIRST
 *      for the settle and the LAST for the variant; the two middle ones are working iterations that ship
 *      nowhere, so an unnamed file is not a missing half. And shape 3/4's ambiguity bites here as well: TWO of
 *      the four bear exactly `Mandelbrot Simulation new_…`, so **match on the timestamp the request gives,
 *      never on the name** — the earlier of those two is the settle.
 *      ⚠️ **Its second instance arrived 2026-09-18 (`Rippled Rays Of Light 3`, from
 *      `Rippled Rays Of Light 2 new v2_…105058.json`, 4 min 51 s after the plain-named export that settled the
 *      anchor) and it is the SAME working-name pattern — a name that WAS a library key plus a ` vN` suffix.**
 *      Two instances of one pattern is still not a rule, but it does say what to look for: **a suffixed name
 *      reads exactly like a library key**, so the ` v2`/` v3` tail is the whole difference between a shape-4
 *      file and a shape-6 one. ⚠️ **And the roles are not the ones the first instance recorded**: there the
 *      settle export ALSO bore a ` new` name, here it was PLAIN-named and only the variant's file carried the
 *      working name — so **the two halves of a shape-6 pair need not agree on which of the pair's names they
 *      use.** What held both times is that the ` vN` file is the variant.
 * ⚠️ **29 of the 30 entries here have a SETTLED anchor** (re-measured 2026-09-19, EIGHTH batch, by importing
 * both modules and testing each `after` for an `X new` key — and for the presence of `X`, which every anchor also
 * has), so a variant is no longer evidence
 * that its anchor's pair is still open — check `REFINED_PRESETS` for the ` new` key instead of assuming.
 * ⚠️ **That line read "all 28" until the EIGHTH batch, and the one exception is `Waves II`, whose anchor has
 * NO `REFINED_PRESETS` entry AT ALL** — not a settled one and not a pending one, because `Waves` took a
 * KEEP-THE-ORIGINAL verdict and that verdict is a pure deletion. **A test with two outcomes cannot see it**:
 * asking "is there an `X new` key?" answers no, exactly as it does for a settled anchor, so a query has to ask
 * for `X` as well and treat ABSENT as its own third answer. ⚠️ **It is also the only entry here whose anchor
 * ships from `public/psss_presets.json` untouched**, which is what makes its own doc comment the only record
 * of the refinement it was tuned from.
 * ⚠️ **A variant's name is NOT reliably derivable from its anchor's, so do not search for one by prefix.**
 * Measured the same way (2026-09-19, EIGHTH batch): **the name CONTAINS the anchor's name in 22 of 30
 * case-INSENSITIVELY and 21 of 30 case-SENSITIVELY**, and the eight case-insensitive misses are `Boiling Milk`
 * ← `Lava`, `Liquid Mandala` ← `Mandala Tri`, `Mandelbrot River` ← `Mandelbrot Simulation`,
 * `Birth of a Black Hole` ← `Miracle`, `Multi Mixer` ← `Multi Threads II`, `Aizawa Particle Swarm` ←
 * `Particle Swarm II`, `Penta Star Eternal Flow` ← `Penta Star System` and `Rippled Rays Of Light 3` ←
 * `Rippled Rays Of Light 2`.
 * ⚠️ **ON 2026-09-18 BOTH FIGURES STOOD STILL WHILE THE DENOMINATOR MOVED, so the miss count is where that
 * batch landed; on 2026-09-19 BOTH ROSE BY ONE AND THE MISS LIST DID NOT CHANGE AT ALL** — `Solar Fusion II`
 * is a plain suffix on its anchor, the easiest shape there is, so the eight misses below are still the eight,
 * and **the fifth batch's `The Masters Light II` is the same easiest shape and did the same thing again, as is the
 * seventh's `Transmission II` — three arrivals in a row that moved both hit counts and left the miss list alone.**
 * ⚠️ **The EIGHTH batch made it FIVE in a row and moved both counts by TWO** (`Waves II`, `Who Needs A
 * Fractal II`, both plain suffixes on their anchor), **so the misses have stood at EIGHT across four
 * denominators — 26, 27, 28 and 30.** A figure that holds while its denominator moves four times is the one
 * worth quoting; the hits have moved in every one of those batches and taught nothing.
 * **Read the misses, never the hits** — the hit count can move for a reason that teaches nothing, and the only
 * batches worth a sentence here are the ones that add a miss.
 * And 2026-09-18's new miss is the extreme case worth remembering: **it differs from
 * its anchor by ONE character** (`3` for `2`) and is still a miss under `includes`, `startsWith` AND
 * `endsWith`. **The closest name in the file to its anchor is invisible to every containment test**, which is
 * the whole argument for `after` in one entry.
 * ⚠️ **BOTH FIGURES ARE STATED BECAUSE THE DIFFERENCE BETWEEN THEM IS A REAL ENTRY AND THE OLDER LINE HERE
 * NAMED NEITHER MATCHING.** The one body that separates them is `Hades on Fire II`, whose anchor is
 * `Hades On Fire` — a capital `O` — so a plain `name.includes(after)` reports it as a miss and a lower-cased
 * one does not. This line previously read *"only 15 of 21"* with six misses listed, which was the
 * case-insensitive reading and was CORRECT; a later audit re-derived 14 with a case-sensitive `includes()` and
 * briefly recorded the 15 as an off-by-one error. ⚠️ **It was not an error, it was a second measurement
 * wearing the same words** — the lesson is that *"contains the anchor's name"* is not one quantity, and **a
 * census over preset names must state its case folding or it cannot be reproduced.** By word overlap the split
 * is **19 prefix / 9 sharing a word but not a prefix / 2 sharing nothing at all** (`Boiling Milk`,
 * `Birth of a Black Hole`); that partition sums to 30 and is case-folded throughout.
 * **`after` is the only machine-readable link between the two** — grep it, never the name.
 * ⚠️ **The third batch pushed the word-only class from 5 to 8 in one sitting**, and all three arrivals name
 * their anchor at the END rather than the start: `Rubber Penta Spirals` and `Dancing Quader` prepend an
 * adjective to the anchor's whole name, while `Penta Star Eternal Flow` keeps `Penta Star` and REPLACES
 * `System`. **The prefix class is a majority (19 of 30) but it grew by none of these three**, nor by
 * 2026-09-18's `Rippled Rays Of Light 3` (word-only, 8 → 9) — **it took four consecutive arrivals without
 * gaining one and then gained 2026-09-19's `Solar Fusion II`, the fifth batch's `The Masters Light II`, the
 * seventh's `Transmission II` and BOTH of the eighth's (`Waves II`, `Who Needs A Fractal II`).** ⚠️ **Five
 * consecutive Roman-numeral arrivals have now landed in that class, and the word-only class has not gained
 * one since 2026-09-18** — which is a fact about one owner's naming in one week, not a property of variants.
 * ⚠️ **So a prefix search misses 11 of the 30 — the SAME ELEVEN as at 26, at 27 and at 28**, because the class
 * and the denominator have risen together four times.
 * **A miss count that holds while both of its inputs move is the
 * figure to quote**,
 * and it is the reason the misses are named individually below rather than counted.
 * ⚠️ **The streak ending is not a trend either**: what it measures is that one owner named THREE variants with
 * a Roman numeral in one day, the same way the file's oldest entries were named. ⚠️ **Note the shape the two
 * adjective-prepended ones share: `name.endsWith(after)` would have caught both, and `startsWith` catches
 * neither** — which is the same trap as the case folding above. That test still catches only 3 of the 30
 * (`Liquid Fractal`, `Rubber Penta Spirals`, `Dancing Quader`), so **no pair of these tests covers the file
 * either**: `startsWith` ∪ `endsWith` ∪ `includes` leaves eight entries unmatched, the eight named above — a
 * count unmoved across four denominators. Do
 * not build a lookup on any single one of these tests, or on all of them; use `after`.
 * ⚠️ **Shape 5 is how a re-opened pair gets CLOSED**, which is why it matters beyond bookkeeping: a settle's
 * fourth outcome (`refined-presets.ts`' header) leaves `X` and `X new` coexisting, and renaming the ` new`
 * half to `X II` collapses that back to a settled anchor plus a variant **without touching either body**.
 *
 * ⚠️ **`after` names the ANCHOR, and the variant lands after the anchor AND its ` new` sibling if one is
 * still pending.** For a settled anchor (no ` new` key) that is simply the next slot. This ordering is
 * deliberate: while a pair is under review the two halves must stay adjacent, since that adjacency is the
 * only reason the refined set is interleaved at all.
 */
export interface VariantPreset {
  /**
   * v8 `31.6` — **place this variant at the very END of the library instead of beside its `after`
   * anchor.** Owner instruction, 2026-10-25: every demo preset goes to the bottom of the list so they are
   * easy to find. ⚠️ **It REVERSES `30.D17`'s placement** (each demo one tile from its parent, for a
   * cheap A/B) — the owner weighed findability higher.
   *
   * ⚠️ **`after` is still REQUIRED and still meaningful on an `atEnd` entry: it records which parent the
   * demo is ONE CHANGE from**, which is what makes it an attribution rather than an impression and is
   * what `democheck` reads to pick the comparison. The flag changes POSITION only.
   */
  atEnd?: boolean;
  /** The library preset this one is positioned immediately after. */
  after: string;
  /** The variant's library key. Must equal `preset.metadata.name`. */
  name: string;
  preset: UnifiedPreset;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────────────
 * v8 `35.6` — shared boilerplate for the WARP SHAPE demos at the end of this array.
 *
 * ⚠️ **These four helpers are a DELIBERATE second copy of `demo-presets.ts`' own.** That file declares
 * `cylinderWaves` / `rippleTable` / `zeroTable` / `inertGrading` as module-private `const`s and exports
 * none of them, so there is nothing to import; exporting them would make this file depend on the review
 * set it is explicitly NOT part of (`library.ts`' two separate load loops). The precedent is `32.13`'s
 * fixture expander, duplicated against `capture-ui.mjs` for the same reason and recorded as deliberate.
 *
 * ⚠️ **The figure's identity is the thing a copy can break, so it is asserted by VALUE rather than by
 * review:** `cylinderFigureWaves()` is `Cylinder`'s legacy table transcribed digit for digit, which is
 * what makes `after: 'Cylinder'` an A/B rather than an impression. If these numbers drift from
 * `demo-presets.ts`' `cylinderWaves()`, the eight demos below stop being comparable with the four shipped
 * transmap demos and nothing anywhere will say so.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Legacy `Cylinder` — a sparse, near-geometric lattice, and the most legible surface a warp can act on.
 * Every shipped transmap style-0/2 demo uses it, which is the whole reason the shape demos do too.
 */
const cylinderFigureWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 10.986328, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 20.182291, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 9.375, amplitude: 0, frequency: 0 }, fm: { base: 98, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
  ] },
];

/**
 * `Vertical Ripple`'s table, written as the LEGACY reader's fallback and never as this engine's input.
 *
 * ⚠️ **Every demo below names an ARCHETYPE**, so `resolveStaticWaves` takes the archetype branch and never
 * reads this. It is present so a reader that collapses the chain to one legacy style still produces a warp
 * of roughly the right character instead of a flat field — and ⚠️ **it carries no shape**, because the
 * shape lives on `overlay.transMapChain[].staticField` and the legacy block has no home for it. A legacy
 * reader therefore shows the SINE field of a shaped preset, which is a documented limit of the format and
 * not a defect in these bodies.
 */
const shapeDemoRippleTable = (): SinMagicParams => [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]];

/** The all-zero second table — the explicit spelling of "styles 0-2 do not read `sinMagicParams2`". */
const shapeDemoZeroTable = (): SinMagicParams => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

/**
 * The inert grading block. `postProcessors.bloom`/`toneMap` carry `@deprecated NOT READ BY THE PIPELINE`
 * and `applyFilmLook()` overwrites them — they must be PRESENT and they are inert.
 */
const shapeDemoInertGrading = () => ({
  bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
  // ⚠️ The three grading vectors are TUPLES, not `number[]`: a bare literal in a helper widens and every
  // preset spreading it then fails to assign. The casts assert the LENGTH, nothing about the values.
  toneMap: {
    curve: 'none' as const, exposure: 1.0,
    lift: [0, 0, 0] as [number, number, number],
    gamma: [1, 1, 1] as [number, number, number],
    gain: [1, 1, 1] as [number, number, number],
  },
});

export const VARIANT_PRESETS: VariantPreset[] = [
  {
    after: 'Lava',
    name: 'Dye Holi Festival',
    /**
     * **Dye Holi Festival** — the owner's hand-tuned variant of `Lava`, kept ALONGSIDE it.
     *
     * Imported from an export (`Lava v2_20261019_195038.json`) and kept VERBATIM: this object is exactly
     * what `Import` hands `MigrationLayer.migrate`, so it behaves identically to re-importing that file.
     * Only `metadata.name` was changed, from the export's `Lava v2` to this entry's own name.
     *
     * **What distinguishes it from `Lava`: the figure is GONE and the dye is the picture.** It keeps
     * Lava's `Ember` material and 20 000 particles, but authors `dye.showFigure: false` — so the curve
     * still moves, still paints and still stirs the field while drawing nothing itself. The visible image
     * is the advected dye alone, over a trail.
     *
     * ⚠️ **It reaches its colour through the PRE-28.16 route, and that is worth naming because the entry
     * documents a path a reader might otherwise think obsolete:** `palette: 'Cycle: Neutral'` with
     * `paletteMapping: 'index'` makes the CPU colour law write the palette into `state.colors`, and
     * `dye.colourSource: 'velocity'` is the one source that reads that array. **So the dye is coloured by
     * particle INDEX even though its own `mapping` is absent** — the figure's palette is doing the
     * indexing. `Breathing Dye` is the other half of the comparison: same banding, reached through the
     * dye's own `mapping: 'index'` instead.
     *
     * ⚠️ **`velocity` dims its deposit by `0.35 + 0.65 * min(1, |v| / 6)`, so the colour is modulated by
     * speed here** — on a figure whose parts move at very different rates that is a visible part of the
     * look rather than an artefact, and it is the difference `colourSource: 'figure'` would remove.
     *
     * **`blendMode: 'add'` with `decayRate: 0.988`.** Under `add` the composite's fixed point is
     * `aC / (1 - k)` in the trail, so Trail Decay is a brightness control for the dye — authored by eye at
     * this pairing, and ⚠️ **lowering `decayFactor` will dim the dye as well as shortening the trail.**
     *
     * ⚠️ **The `liquid` block is INERT here** and is authored anyway because the export carried it: a live
     * material forces the mode to `splat` (`resolveModeAgainstMaterial`), so no iso surface is built. It is
     * kept rather than stripped for this file's verbatim rule — **removing it would make the entry stop
     * matching the file it came from, which is the one property this file exists to preserve.**
     */
    preset: {
      metadata: {
        name: 'Dye Holi Festival',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'fire'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [224, 96, 32],
        colorAmp: [32, 96, 32],
        colorFreq: [2.96, 4.094, 0.3],
        colorShift: [0.224, 0.354, 0.532],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.849, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0.5, 1, 0, 0], [10, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.2,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Ember',
          splatRadius: 19.5,
          coreBrightness: 2,
          haloStrength: 0.8,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 3.4,
          heatMode: 'velocity',
          heatGain: 0.5,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.8,
        },
        liquid: {
          isoLevel: 4,
          kernelWidth: 1.41,
          edgeSoftness: 0.15,
          tintSource: 'dye',
          surfaceRamp: 'fire',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 1.55,
          thickness: 0.5,
          edgeBrightness: 1.35,
        },
        dye: {
          enabled: true,
          decayRate: 0.988,
          opacity: 1,
          colourSource: 'velocity',
          fixedColour: [1, 0.35, 0.1],
          injectionRadius: 8,
          advectionStrength: 0.4,
          ramp: 'Cycle: Solar',
          blendMode: 'add',
          showFigure: false,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.4,
          // ⚠️ **0.9, NOT 1.8 — AND THIS IS A RESTORE, NOT A RETUNE (2026-10-21).** Authored 10-19, between 27.1
          // dropping the stop the Narkowicz fit baked in and `ACES_EXPOSURE_BIAS` carrying it across, so the
          // authored value was compensating for a grading defect. Exposure is applied immediately before the
          // curve, so halving it is the EXACT algebraic inverse of that constant: this preset is bit-identical
          // to the frame the owner confirmed. **Do not 'restore' 1.8 — that is two stops hot.**
          bloomIntensity: 0.8,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.9,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.85,
          vignette: 0,
          palette: 'Classic: ember',
          paletteMapping: 'temperature',
        },
      },
    },
  },
  {
    after: 'Lava',
    name: 'Dye Sunset',
    /**
     * **Dye Sunset** — the owner's third dye preset, hand-tuned from `Dye Holi Festival` and kept alongside
     * it. Imported from an export (`Dye Holi Festival_20261019_232450.json`) and kept VERBATIM: only
     * `metadata.name` was changed, so the entry behaves exactly as re-importing that file would.
     *
     * ⚠️ **IT SHARES ITS ANCHOR WITH `Dye Holi Festival` (`after: 'Lava'`), SO THE ARRAY INDEX IS WHAT
     * ORDERS THE TWO** — this file's header states that rule, and it is why this is an ordered array rather
     * than a `Record`. Anchoring it to `Dye Holi Festival` instead would make its position depend on
     * another variant's placement, which is a second-order dependency for no gain.
     *
     * **What distinguishes it from `Dye Holi Festival`, measured as a field diff (6 differences):**
     *
     *   - **the FIGURE is a ring, not Lava's lattice.** Wave 1 alone is live, `am.base` 20 on X and Y with
     *     `fm.base` 1 and a 90° phase offset between them — equal amplitude, equal winding, quarter-turn
     *     apart, which is a circle. Waves 2 and 3 are silent.
     *   - **`rotation` `[1,1,1]` → `[4.66, 24.58, 5.49]` and `speedFactor` 0.2 → 2**, i.e. a ring tumbling
     *     an order of magnitude faster. ⚠️ **Both matter to the DYE rather than to the figure**, which is
     *     hidden: the deposit path and the advection velocity are what the motion feeds.
     *   - `customFilmLookParams.bloomIntensity` 0.8 → 0.3.
     *
     * ⚠️ **TWO OF THE SIX "DIFFERENCES" ARE NOT AUTHORING CHANGES AT ALL, and they are worth naming because
     * a byte-diff will show them:** `dye.mapping: 'depth'` and `dye.cycles: 1` are absent in the parent and
     * present here, both at their defaults. The export spreads the RESOLVED config, so a round trip
     * materialises every optional key — *an export is mostly runtime-default noise*. **They change nothing.**
     *
     * **It keeps the parent's dye wiring**: `colourSource: 'velocity'` reading the index-mapped palette out
     * of `state.colors`, `blendMode: 'add'`, `showFigure: false`, `Ember` live. ⚠️ **So its `mapping: 'depth'`
     * is inert** — `velocity` reads no ramp, and `mapping` is only read by the three ramp sources.
     *
     * ⚠️ **`palettecheck` NEEDS ITS DECLARATION FOR THE SAME REASON THE PARENT DID**, and it is the same
     * resolution: the body authors `Cycle: Neutral` while its inherited `colorBase`/`colorAmp` are
     * `Cycle: Solar`'s own pair, and under `index` with an AB palette the PALETTE's base/amp win — so that
     * pair is unread. **Do not "repair" it to match the name.**
     */
    preset: {
      metadata: {
        name: 'Dye Sunset',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'fire'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [4.66, 24.580000000000002, 5.49],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [224, 96, 32],
        colorAmp: [32, 96, 32],
        colorFreq: [2.96, 4.094, 0.3],
        colorShift: [0.224, 0.354, 0.532],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.849, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0.5, 1, 0, 0], [10, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 2,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Ember',
          splatRadius: 19.5,
          coreBrightness: 2,
          haloStrength: 0.8,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 3.4,
          heatMode: 'velocity',
          heatGain: 0.5,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.8,
        },
        liquid: {
          isoLevel: 4,
          kernelWidth: 1.41,
          edgeSoftness: 0.15,
          tintSource: 'dye',
          surfaceRamp: 'fire',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 1.55,
          thickness: 0.5,
          edgeBrightness: 1.35,
        },
        dye: {
          enabled: true,
          decayRate: 0.988,
          opacity: 1,
          colourSource: 'velocity',
          fixedColour: [1, 0.35, 0.1],
          injectionRadius: 8,
          advectionStrength: 0.4,
          ramp: 'Cycle: Solar',
          blendMode: 'add',
          showFigure: false,
          mapping: 'depth',
          cycles: 1,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.4,
          // ⚠️ **0.9, NOT 1.8 — AND THIS IS A RESTORE, NOT A RETUNE (2026-10-21).** Authored 10-19, between 27.1
          // dropping the stop the Narkowicz fit baked in and `ACES_EXPOSURE_BIAS` carrying it across, so the
          // authored value was compensating for a grading defect. Exposure is applied immediately before the
          // curve, so halving it is the EXACT algebraic inverse of that constant: this preset is bit-identical
          // to the frame the owner confirmed. **Do not 'restore' 1.8 — that is two stops hot.**
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.9,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.85,
          vignette: 0,
          palette: 'Classic: ember',
          paletteMapping: 'temperature',
        },
      },
    },
  },
  {
    after: 'Sphere',
    name: 'Sphere II',
    /**
     * **Sphere II** — the hand-tuned variant of `Sphere`, kept in ADDITION to it (2026-08-28, the user's
     * explicit request: *"we want both to be provided in the preset library"*).
     *
     * Imported from an export (`Sphere new_20260828_151546.json`) and kept VERBATIM: this object is
     * exactly what `Import` hands `MigrationLayer.migrate`, so it behaves identically to re-importing that
     * file. Only `metadata.name` was changed, from the export's `Sphere new` to this entry's own name.
     *
     * What distinguishes it from `Sphere`: a **two-layer TransMap chain** — the shared Zoom Overlay
     * (style 2) plus **Depth Parallax (style 11)** at `manual` range 0.3–0.7, `Near 0.2 / Far 2.0` — over
     * brighter grading (`glow` 5.4 → 6, `bloomThreshold` 0.3 → 0.15, `bloomIntensity` 0.55 → 0.8).
     * ⚠️ It is therefore the library's only **legacy-slot** preset carrying a chain, and it exercises
     * 14.7/14.7b: `Sphere`'s depth span is one of the widest in the library, which is what made the
     * parallax read at all (see `post-processors/depth-field.ts`).
     */
    preset: {
      metadata: {
        name: 'Sphere II',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0.5, 0.5, 0.5],
        angle: [0, 0, 0.1],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 16.479492, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 22.705078, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 257.14285, amplitude: 171.42857, frequency: 4 },
                fm: { base: 594, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 15,
                am: { base: 16.479492, amplitude: 0, frequency: 0 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 21.972656, amplitude: 0, frequency: 0 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.4, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.3703703703703704, blurRadius: 0, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[1, 0, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0], [0.5, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 2,
        transMapChain: [
          { style: 2, enabled: true, weight: 1 },
          {
            style: 11,
            enabled: true,
            weight: 1,
            parallax: {
              amount: 1,
              nearScale: 0.2,
              farScale: 2,
              curve: 'linear',
              depthRange: 'manual',
              rangeFrom: 0.3,
              rangeTo: 0.7,
            },
          },
        ],
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 6,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.8,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.93,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Cycloid',
    name: 'Cycloid II',
    /**
     * **Cycloid II** - the hand-tuned variant of `Cycloid`, kept in ADDITION to it. Added 2026-09-04 and
     * **RE-BODIED the same day from a newer export** (`Cycloid new_20260831_222000.json` replacing
     * `..._20260830_205513.json`) on the user's verdict that it is the better version. Its anchor had already
     * settled in the same sitting, so `refined-presets.ts` keys the refined body by the plain name `Cycloid`,
     * there is no ` new` sibling, and this lands in the very next slot.
     *
     * Kept VERBATIM apart from `metadata.name`.
     *
     * ⚠️ **What distinguishes it from `Cycloid` is INVISIBLE to a diff of their shared keys - that diff is
     * empty.** The whole difference is keys the anchor does not carry: `renderMode: 'liquid'` plus a `liquid`
     * block and `particleSize`. So the two share one 40000-particle geometric body and differ ENTIRELY in
     * presentation - the anchor draws stars, this one resolves the same figure as an iso-surface.
     * ⚠️ **`liquid` is the only render mode that OCCLUDES rather than adding light**, which is why the pair
     * reads as two different presets rather than as two gradings of one.
     *
     * ⚠️ **The re-body moved EIGHT liquid/size values and NOTHING ELSE** - generators, renderer, grading and
     * post-processors are byte-identical to the first version, so the improvement is entirely in how the
     * surface is resolved: `isoLevel` 2.64 -> 1.4897 (a lower threshold, so the drops merge into a body
     * instead of separating), `edgeSoftness` 0.46 -> 0.02 (feathered -> nearly hard, i.e. paint rather than
     * mist), `refraction` 0.25 -> 0.61 and `specular` 0.8 -> 1.45 (more internal scatter and a brighter
     * glint), `thickness` 0.5 -> 0.2 and `edgeBrightness` 0.6 -> 0 (less absorption, no Fresnel rim), and
     * `particleSize` 0.73 -> 1.27. ⚠️ **`mixModel` also flipped `'light'` -> `'pigment'`, which is
     * CATEGORICAL and therefore SNAPPED by the Mixer at t=0.5 rather than interpolated** (invariant 16) - a
     * Mixer deck blending this against a `'light'` preset jumps rather than crossfades, by design.
     *
     * ⚠️ It is one of the library's `liquid` presets carrying **no material**. The census figure that is
     * load-bearing is the ZERO (material-carrying liquid presets) - and **that zero no longer holds as of
     * this sitting**: `Flower Power II` below is `liquid` WITH a `Plasma` material. **Re-measure both halves
     * rather than trusting any recorded figure.**
     */
    preset: {
      metadata: {
        name: 'Cycloid II',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 25,
                  frequency: 3,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 25,
                  frequency: 3,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 3,
                  frequency: 11,
                },
                fm: {
                  base: 625,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 10,
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 18,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 10,
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 6.25,
                  amplitude: 6.25,
                  frequency: 15,
                },
                fm: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 3.6,
                am: {
                  base: 6.25,
                  amplitude: 6.25,
                  frequency: 15,
                },
                fm: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 1.27,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        liquid: {
          isoLevel: 1.4897,
          kernelWidth: 4,
          edgeSoftness: 0.02,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'pigment',
          refraction: 0.61,
          specular: 1.45,
          thickness: 0.2,
          edgeBrightness: 0,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.66,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Flower Power',
    name: 'Flower Power II',
    /**
     * **Flower Power II** - the hand-tuned variant of `Flower Power`, kept in ADDITION to it (2026-09-04).
     * Its anchor settled in the same sitting under the plain name `Flower Power`, so there is no ` new`
     * sibling and this lands in the very next slot.
     *
     * Imported from `Flower Power new_20260831_230436.json`, VERBATIM apart from `metadata.name`.
     *
     * ⚠️ **IT IS THE LIBRARY'S FIRST PRESET THAT IS `liquid` AND CARRIES A MATERIAL, WHICH FLIPS THE
     * LOAD-BEARING ZERO OF THE 2026-09-04 CENSUS** (`0 material-carrying presets are liquid`, reproduced
     * three times and quoted in `CLAUDE.md` as the one stable half of that count). It is therefore the first
     * authored witness to `resolveModeAgainstMaterial()`'s **`liquid` exemption**: a material overrides every
     * requested mode EXCEPT `liquid`, so `Plasma` here does NOT force `'splat'` the way it would from any
     * other mode. ⚠️ **Do not "fix" this preset to `splat` on the grounds that it carries a material** - the
     * exemption is the shipped rule (invariant 17) and this entry is what exercises it.
     *
     * ⚠️ **Its `generators` are BYTE-IDENTICAL to `Flower Power`'s** - verified, not assumed - so the two
     * differ ONLY in presentation. Against the anchor: `renderMode` `'splat'` -> `'liquid'` with a full
     * `liquid` block (`isoLevel` 0.5267, `kernelWidth` 4, `refraction` 0.73, `edgeBrightness` 1.85,
     * `thickness` 0.6), `particleSize` 1.62, and a softer material (`coreBrightness` 1.9 -> 1.2,
     * `haloStrength` 0.85 -> 0.5, `splatRadius` 9 -> 2). ⚠️ **`kernelWidth` 4 is the widest in the library
     * and `isoLevel` 0.5267 about half the default** - both push toward one merged body, which is what a
     * flower's overlapping petals need in order to read as a surface rather than as separate blobs.
     *
     * ⚠️ **`material.splatRadius` still matters even though nothing draws a splat here**: the material feeds
     * the density field the iso-surface is built from. Reading it as dead because the mode is not `splat`
     * would be the "control moves nothing" misdiagnosis inverted (invariant 13).
     *
     * ⚠️ It shares the anchor's donor role indirectly: `Physarum Flower` copies these same `waves` through
     * `flowerWaves()`. See the anchor's banner - a geometry retune here or there changes what the physarum
     * demo's measured 32.9 % coverage was measured ON.
     */
    preset: {
      metadata: {
        name: 'Flower Power II',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'plasma',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 30000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 10,
                  frequency: 1,
                },
                fm: {
                  base: 128,
                  amplitude: 64,
                  frequency: 1,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 10,
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 18,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 10,
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 1.62,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        material: {
          preset: 'Plasma',
          splatRadius: 2,
          coreBrightness: 1.2,
          haloStrength: 0.5,
          falloffExponent: 3.2,
          thermalLag: 0.08,
          emissionIntensity: 2.1,
          heatMode: 'velocity',
          heatGain: 0.6,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.25,
        },
        liquid: {
          isoLevel: 0.5267,
          kernelWidth: 4,
          edgeSoftness: 0.15,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.73,
          specular: 0.8,
          thickness: 0.6,
          edgeBrightness: 1.85,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.66,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Fractal',
    name: 'Liquid Fractal',
    /**
     * **Liquid Fractal** - the hand-tuned variant of `Fractal`, kept in ADDITION to it (2026-09-04). Its
     * anchor settled in the same sitting under the plain name `Fractal`, so there is no ` new` sibling and
     * this lands in the very next slot.
     *
     * Imported from `Fractal new_20260901_154048.json`, VERBATIM apart from `metadata.name`.
     *
     * ⚠️ **NAMED FOR WHAT IT DOES, NOT `Fractal II`** - the user's choice, and the file's `after` field is
     * what carries the position, so a variant's key is free of any naming convention. **Do not "normalise"
     * it**: a preset name is a primary key in five owners.
     *
     * Against the anchor: `renderMode: 'liquid'` with a full `liquid` block, plus a brighter, deeper grading
     * (`glow` 5.4 -> 7.5, `depthSize` 0.3 -> 0.55, `bloomThreshold` 0.3 -> 0.2, `bloomIntensity`
     * 0.55 -> 1.3). Same 40000-particle Lissajous body, no material.
     *
     * ⚠️ **The anchor authors NO `overlay.renderMode` AT ALL** - its overlay has three keys (`filmLook`,
     * `customFilmLookParams`, `sliderBaseFilmLook`), so it resolves through `renderer.mode: 'star'` instead.
     * **The pair therefore differs by a key the anchor does not merely set differently but LACKS**, which is
     * why `overlay.X ?? preset.Y` resolution order matters here (a tile that resolved it the other way round
     * would draw the wrong one of the two).
     *
     * ⚠️ **`isoLevel: 4` is the HIGHEST in the library - measured, next is `Liquid Field Pool` at 2 - and that is
     * the whole point of this preset.** The
     * threshold is in multiples of the measured density reference, so a high value means the surface forms
     * ONLY where particles pile deepest - tight separated droplets instead of one merged body, which is what
     * keeps a fractal's fine structure legible under a fullscreen pass that would otherwise fill it in.
     * ⚠️ **It is therefore the library's most sensitive preset to the pool's density-reference calibration**:
     * anything that shifts that reference moves this surface first, and a preset CANNOT compensate for it.
     * With `edgeSoftness` 0.51 (feathered, near the mist end), `specular` 2 and `edgeBrightness` 2.2, the
     * droplets read as glassy beads rather than as paint.
     */
    preset: {
      metadata: {
        name: 'Liquid Fractal',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 25,
                  frequency: 2,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 12.857,
                am: {
                  base: 0,
                  amplitude: 25,
                  frequency: 3,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 25,
                  frequency: 17,
                },
                fm: {
                  base: 2401,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 5,
                },
                fm: {
                  base: 49,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 1.836,
                am: {
                  base: 12.5,
                  amplitude: 12.5,
                  frequency: 7,
                },
                fm: {
                  base: 49,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 6.25,
                  amplitude: 6.25,
                  frequency: 11,
                },
                fm: {
                  base: 343,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0.262,
                am: {
                  base: 6.25,
                  amplitude: 6.25,
                  frequency: 13,
                },
                fm: {
                  base: 343,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        liquid: {
          isoLevel: 4,
          kernelWidth: 1.7,
          edgeSoftness: 0.51,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.5,
          specular: 2,
          thickness: 0.5,
          edgeBrightness: 2.2,
        },
        cohesion: {
          strength: 0.1,
          radius: 64,
          returnForce: 1.05,
        },
        customFilmLookParams: {
          glow: 7.5,
          depthSize: 0.55,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.2,
          bloomIntensity: 1.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.66,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Lava',
    name: 'Boiling Milk',
    /**
     * **Boiling Milk** - the hand-tuned variant of `Lava`, kept in ADDITION to it (2026-09-04). Its anchor
     * settled in the same sitting under the plain name `Lava`, so there is no ` new` sibling and this lands
     * in the very next slot.
     *
     * Imported from `Lava new_20260901_155756.json`, VERBATIM apart from `metadata.name`. ⚠️ **Named for the
     * LOOK, not `Lava II`** - and the name is the only thing that says the two are related, since nothing at
     * runtime derives a variant from its anchor.
     *
     * ⚠️ **It is the library's SECOND preset that is `liquid` AND carries a material** (`Ember`), after
     * `Flower Power II`. Both are authored witnesses to `resolveModeAgainstMaterial()`'s **`liquid`
     * exemption**: a material overrides every requested mode EXCEPT `liquid`, so `Ember` does NOT force
     * `'splat'` here the way it would from any other mode. ⚠️ **Do not "fix" this to `splat` because it
     * carries a material** - the exemption is the shipped rule (invariant 17). ⚠️ **And the census figure
     * these two moved was recorded as a load-bearing ZERO in three documents: cite the exemption and its
     * witnesses, never a count.**
     *
     * ⚠️ **It DIVERGES FROM ITS ANCHOR IN THE GENERATORS, WHICH NO OTHER VARIANT DOES**: 50000 particles
     * against `Lava`'s 20000. `Sphere II`, `Cycloid II` and `Flower Power II` are all presentation-only
     * siblings whose `generators` are byte-identical to their anchors - **this one is not, so a diff of the
     * two that stops at `overlay` misses the biggest difference.** The higher count is what the iso-surface
     * needs: a fullscreen pass resolves a surface from local density, so a population that reads fine as
     * discrete splats can fall BELOW the iso threshold and vanish entirely (measured 2026-09-01 - invariant
     * 13's harder form, where the control is right and the output channel cannot show it).
     *
     * The rest, against the anchor: `renderMode` `'splat'` -> `'liquid'` with a full `liquid` block
     * (`isoLevel` 1.9656, `kernelWidth` 4 - the widest in the library, `edgeSoftness` 0.12 so the boundary is
     * nearly hard, `thickness` 0.25, `edgeBrightness` 1.95), `particleSize` 1.74, and `material.splatRadius`
     * 7 -> 2. It does NOT take the anchor's 2026-09-04 retune: this export predates it, so it keeps
     * `heatGain` 0.7, palette `Earth` and `depth` mapping. ⚠️ **That is deliberate, not staleness - the two
     * halves of a two-part verdict are independent presets and the user accepted each as it stood.**
     */
    preset: {
      metadata: {
        name: 'Boiling Milk',
        version: 2,
        designResolution: {
          width: 75,
          height: 75,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'fire',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 50000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 6,
                  frequency: 5,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 6,
                  frequency: 6,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 6,
                  frequency: 7,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 6,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 100,
                  amplitude: 1,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 6,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 100,
                  amplitude: 2,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 6,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 100,
                  amplitude: 3,
                  frequency: 1,
                },
              },
            ],
          },
        ],
        colorBase: [224, 96, 32],
        colorAmp: [32, 96, 32],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.85,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0.5, 1, 0, 0],
            [10, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 0.2,
        figureScale: 1,
        particleSize: 1.74,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        material: {
          preset: 'Ember',
          splatRadius: 2,
          coreBrightness: 2.2,
          haloStrength: 0.6,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 3.4,
          heatMode: 'velocity',
          heatGain: 0.7,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.8,
        },
        sparks: {
          enabled: true,
          poolSize: 700,
          threshold: 0.6,
          ejectionSpeed: 0.2,
          gravity: 0,
          drag: 1.5,
          minLifetime: 0.3,
          maxLifetime: 1,
          coolingRate: 1.4,
          splatRadius: 6.5,
          maxSparksPerFrame: 8,
        },
        liquid: {
          isoLevel: 1.9656,
          kernelWidth: 4,
          edgeSoftness: 0.12,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 0.8,
          thickness: 0.25,
          edgeBrightness: 1.95,
        },
        cohesion: {
          strength: 0.51,
          radius: 64,
          returnForce: 2.75,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.5,
          depthBrightness: 0.3,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.17,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.1,
          vignette: 0,
          palette: 'Earth',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Pipes',
    name: 'Pipes Art',
    /**
     * **Pipes Art** - the hand-tuned variant of `Pipes`, kept in ADDITION to it (2026-09-04). Its anchor
     * settled in the same sitting under the plain name `Pipes`, so there is no ` new` sibling and this lands
     * in the very next slot (legacy index 122, so between the settled `Pipes` and `Plasma Power`).
     *
     * Imported from `Pipes new_20260903_173015.json`, VERBATIM apart from `metadata.name`. ⚠️ **The user
     * named it `Pipes Art`, not `Pipes II`** - it is the third variant in a row named for what it does
     * rather than by index (`Liquid Fractal`, `Boiling Milk`, this). **Do not "normalise" it to `Pipes II`.**
     *
     * ⚠️ **THE ANCHOR AND THIS VARIANT SHARE `generators`, `renderer` AND `postProcessors` BYTE-IDENTICALLY**
     * - verified, not assumed: the same 10000-particle Lissajous body, `renderer.mode: 'star'`, glow 2,
     * decay 0.370, blur 4. **The whole difference is the `overlay`**, which is why the pair reads as two
     * presets rather than two gradings: `liquid` is the only render mode that OCCLUDES rather than adding
     * light, so the same geometry becomes a surface instead of a cloud of sprites.
     *
     * ⚠️ **`isoLevel: 0.1272` IS THE LOWEST IN THE LIBRARY BY A FACTOR OF 2.8** - measured over all eleven
     * authored liquid presets, the next lowest being `Liquid Cohesion Beads` at 0.3536 and the highest
     * `Liquid Fractal` at 4. `isoLevel` is in multiples of the measured density reference, so LOW means the
     * surface is one merged body rather than separated droplets: at 0.127 nearly the whole splat field is
     * inside the surface. **That makes this the library's most sensitive preset in the OPPOSITE direction
     * from `Liquid Fractal`** - a density-reference recalibration that thins the field would make
     * `Liquid Fractal` vanish and would make this one flood.
     *
     * ⚠️ **`tintSource: 'dye'` with `dye.enabled: true` AND NO POOL, which is a shipped configuration and
     * not an oversight.** `Dye Wake` is the only precedent and it does the same thing (no `liquidField`).
     * `'dye'` is the only `LiquidTintSource` whose data can be ABSENT at runtime and it degrades to
     * `'ramp'`, never to black. Two gates matter here and they ask different questions: the 512² velocity
     * field steps because `isActive()` ORs four NAMED sources and the dye is the fourth, while the
     * `readbackFrame` CPU gate deliberately does NOT include the dye (it advects on the GPU, sampling
     * `velTexA` in `ADVECT_FS`). **Both are satisfied without a pool** - so `advectionStrength: 1.15` is
     * live, unlike `Field Coupling`, which IS correctly inert with no pool.
     *
     * ⚠️ **`colourMix: 0.64` is one of only two authored values off the 0.85 default** (the other is
     * `Pigment Sheet` at 1.0), and it matters more here than anywhere else **because the dye is the one
     * tint source EXEMPT from Colour Mix**: at the default 0.85 the un-exempt `mix()` would have replaced
     * 85 % of it. The 0.64 therefore acts on the surface's own thickness colour, not on the dye.
     *
     * ⚠️ **`cohesion.strength: 0.57` at `radius: 64` (MODEL units, not pixels) makes this the second-
     * strongest cohesion in the library** - three presets author a non-zero strength: `Liquid Cohesion Beads` 0.85
     * at radius 12.1, this at 0.57, and `Liquid Fractal` 0.1. Its `returnForce: 2.95` is the highest of the
     * three (next 2.75). Cohesion beads the field before the iso-surface reads it, which is visible under
     * an occluding surface in a way it is not under additive blending, where total light is conserved
     * exactly.
     *
     * ⚠️ **`specular: 0.95` + `thickness: 1.1` is the second-thickest surface in the library** (after
     * `Pigment Sheet` at 1.2), and `mixModel: 'pigment'` is CATEGORICAL, so the Mixer SNAPS it at t=0.5
     * rather than interpolating (invariant 16).
     *
     * ⚠️ **`ribbonMode: 'off'` here while the settled anchor is `'hybrid'`** - the one key the anchor's own
     * verdict turned on is the one this variant turns back off. The two halves of a two-part verdict are
     * INDEPENDENT presets; do not propagate either side's value to the other.
     */
    preset: {
      metadata: {
        name: 'Pipes Art',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 4, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 4, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 32, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 4, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 16, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 4, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 16, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 2,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        liquid: {
          isoLevel: 0.1272,
          kernelWidth: 1.62,
          edgeSoftness: 0.15,
          tintSource: 'dye',
          surfaceRamp: 'liquid',
          colourMix: 0.64,
          mixModel: 'pigment',
          refraction: 0.25,
          specular: 0.95,
          thickness: 1.1,
          edgeBrightness: 0.6,
        },
        cohesion: { strength: 0.57, radius: 64, returnForce: 2.95 },
        dye: {
          enabled: true,
          decayRate: 0.964,
          opacity: 1,
          colourSource: 'velocity',
          fixedColour: [1, 0.35, 0.1],
          injectionRadius: 38,
          advectionStrength: 1.15,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Dual Spiral Wind',
    name: 'Dual Spiral Wind II',
    /**
     * **Dual Spiral Wind II** — the hand-tuned variant of `Dual Spiral Wind`, kept in ADDITION to it
     * (2026-09-12, the user's explicit request: *"Add … as new preset `Dual Spiral Wind II` after
     * `Dual Spiral Wind`"*), which makes its anchor's settle the SECOND verdict in the refined-preset
     * review to spawn a preset rather than only collapse a pair — `Sphere II` above was the first.
     *
     * Imported from an export (`Dual Spiral Wind_20260912_154618.json`) and kept VERBATIM: only
     * `metadata.name` was changed, from the export's `Dual Spiral Wind`. That collision is also why the
     * two exports could not simply both be pasted — they arrived under ONE name, 3 min 23 s apart, and
     * only the timestamps in their file names tell them apart.
     *
     * What distinguishes it from the anchor, measured by diffing the two exports leaf by leaf (they agree
     * on everything else, the whole neon grade included, so this entry inherits every note in the
     * anchor's own comment — `renderMode: 'blend'` overriding `renderer.mode: 'star'` above all):
     *   - a **two-layer TransMap chain**: style 0 (Wave Shift, the Sin Magic block both presets already
     *     carry) + **style 6, Fluid Feedback**, both enabled at weight 1.
     *   - an `overlay.fluidFeedback` block, which is style 6's LIVE parameter source — `main.ts` reads
     *     `overlay.fluidFeedback`, never the layer's own copy — `persist 0.95`, `amplify 1`,
     *     `fieldDecay 0.978`, `dispersion` and `glowBoost` 0.
     *   - `speedFactor` **0.75** against the anchor's 1.
     */
    preset: {
      metadata: {
        name: 'Dual Spiral Wind II',
        version: 2,
        designResolution: { width: 75, height: 75 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.5],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: { base: 15, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 22.5, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 96, amplitude: 48, frequency: 12 },
                fm: { base: 2, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 0, amplitude: 3, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 3, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 3 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 3, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 4 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 1.5, frequency: 10 },
                fm: { base: 100, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 1.5, frequency: 10 },
                fm: { base: 100, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 1.5, frequency: 10 },
                fm: { base: 100, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.05, 0.05, 0.05],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.8641975308641976, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[2, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [1, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1 },
          { style: 6, enabled: true, weight: 1 },
        ],
        fluidFeedback: { persist: 0.95, amplify: 1, dispersion: 0, fieldDecay: 0.978, glowBoost: 0 },
        curlNoise: { enabled: false, turbulence: 0.03, scale: 0.4, evolutionSpeed: 0.5 },
        speedFactor: 0.75,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 3,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.75,
          bloomIntensity: 0.15,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.4,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.05,
          vignette: 0,
          palette: 'Neon',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Entropy',
    name: 'Entropy on Fire',
    /**
     * **Entropy on Fire** — the hand-tuned variant of `Entropy`, kept in ADDITION to it (2026-09-12, the
     * user's request: *"Add … as preset `Entropy on Fire`"*), which makes its anchor's settle the THIRD
     * verdict in the refined-preset review to spawn a preset rather than only collapse a pair
     * (`Sphere II` and `Dual Spiral Wind II` were the first two).
     *
     * Imported from an export (`Entropy new_20260912_162303.json`) and kept VERBATIM: only
     * `metadata.name` was changed, from the export's `Entropy new`. `createdWith` and
     * `tags: ['refined', 'plasma']` are the export's own and stay, as `Sphere II`'s do.
     *
     * ⚠️ **The two exports of this settle arrived under DIFFERENT names** — `Entropy_…162519` settled the
     * pair and `Entropy new_…162303` became this entry — so they are separable by STEM, not only by
     * timestamp as `Dual Spiral Wind`'s same-named pair was. **That is a third combination, not a third
     * arrival shape**: an export under the anchor's ` new` name is exactly what `Sphere II` came from, and
     * `Sphere`'s own settle came from no export at all. So the file names do NOT tell you which half is
     * which — only opening them does, which is why each entry records its own.
     *
     * ⚠️ **This is where `Entropy new`'s refinement actually survived.** The anchor's settle went back to
     * the legacy figure and discarded the `Plasma` material and the whole `Customize` grade, so the
     * comparison that means anything is against `Entropy new`, whose figure and 30000 particles this
     * shares leaf for leaf:
     *   - material **`Plasma` -> `Fire`** with `colourRamp` `liquid` -> `fire`, `heatGain`
     *     0.6 -> **3.1**, `splatRadius` 9 -> 5.5, `thermalLag` 0.08 -> 0.04, `falloffExponent`
     *     3.2 -> 3.5, `haloStrength` 0.85 -> 1, `velocityStretch` 0.25 -> 0.22.
     *   - **`renderer.decayFactor` 0.247 -> 0.86** — the one field that changes the frame's character
     *     rather than its colour: `Entropy new`'s crisp MotionBlur-2 trail becomes a long accumulating
     *     one, which is what the `Fire` material's heat needs to read as fire at all.
     *   - the `Customize` grade flattens to a plain read: bloom and the ACES tone map **off**,
     *     `lightingMode` 2 -> **0** (with `lightDir` and `rimPower` therefore inert),
     *     `depthSize`/`vignette`/`gain` back to identity, `saturation` 1.4 -> 1, `exposure`
     *     0.95 -> 1, and the palette **`Neon` by `phase` -> `Sunset` by `temperature`** — the colour
     *     now comes from the heat the material writes rather than from the wave's phase.
     *   - `overlay.renderMode` stays **`splat`**, which is the only reason the material reaches a pixel.
     *   - `sliderBaseFilmLook: 'Neon'` gone.
     */
    preset: {
      metadata: {
        name: 'Entropy on Fire',
        version: 2,
        designResolution: { width: 75, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'plasma'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 30000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.1],
        angle: [0, 0, 0.1],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 16.479492, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 30.273438, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 175.78125, frequency: 4 },
                fm: { base: 3528, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 15,
                am: { base: 8.239746, amplitude: 8.239746, frequency: 3 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 14.6484375, amplitude: 14.6484375, frequency: 3 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 2.5,
                am: { base: 4.119873, amplitude: 4.119873, frequency: 7 },
                fm: { base: 36, amplitude: 1, frequency: 7 },
              },
              {
                phase: 0,
                am: { base: 7.3242188, amplitude: 7.3242188, frequency: 7 },
                fm: { base: 36, amplitude: 2, frequency: 7 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.86, blurRadius: 0, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Fire',
          splatRadius: 5.5,
          coreBrightness: 2,
          haloStrength: 1,
          falloffExponent: 3.5,
          thermalLag: 0.04,
          emissionIntensity: 2,
          heatMode: 'velocity',
          heatGain: 3.1,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.22,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.8,
          bloomIntensity: 0,
          toneMapEnabled: false,
          toneMapCurve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'Sunset',
          paletteMapping: 'temperature',
        },
      },
    },
  },
  {
    after: 'Fluid',
    name: 'Fluid II',
    /**
     * **Fluid II** — the hand-tuned variant of `Fluid`, kept in ADDITION to it (2026-09-13, the user's
     * request: *"Add `Fluid_20260913_184456.json` as `Fluid II`"*), spawned by the same review that settled
     * its anchor.
     *
     * ⚠️ **Both exports of this pair arrived under the anchor's PLAIN name `Fluid`** —
     * `Fluid_20260913_184352.json` settled the pair and `Fluid_20260913_184456.json` (this one, 64 s later)
     * became the variant. **`metadata.name` was rewritten `'Fluid'` -> `'Fluid II'`**; pasted verbatim it
     * would have collided with its own anchor.
     *
     * It differs from the settled `Fluid` in exactly **THREE leaves**: `renderMode` **`liquid` -> `blend`**,
     * the style-**6 Fluid Feedback** chain layer **enabled** (`false` -> `true`), and `speedFactor`
     * 0.5 -> 0.2. Everything else, including the full `overlay.liquid` iso-surface block, is identical — and
     * that block is now INERT here, since it is read only while `renderMode === 'liquid'`.
     *
     * ⚠️ **Its leaf-diff COUNTS against both reference bodies are identical to the settle's** (1/0/49 against
     * migrated legacy, 3/45/47 against `Fluid new`) and the two bodies still differ in three visible leaves.
     * **A count is not a body**: two exports of one preset can agree on every summary figure a diff harness
     * prints and still render differently. Diff the LEAVES when deciding which of two same-named exports is
     * which.
     */
    preset: {
      metadata: {
        name: 'Fluid II',
        version: 2,
        designResolution: { width: 75, height: 75 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 22, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 16.5, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 4.5, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 5.142857, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 3, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 2.25, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 2.5714285, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.99, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[2, 6, 0, 0], [12, 4, 0, 0], [1, 4, 0, 0], [8, 3, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1 },
          { style: 6, enabled: true, weight: 1 },
        ],
        fluidFeedback: { persist: 0.96, amplify: 1, dispersion: 0, fieldDecay: 0.985, glowBoost: 0 },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.2,
        figureScale: 1,
        particleSize: 1.46,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        liquid: {
          isoLevel: 0.1862,
          kernelWidth: 3.17,
          edgeSoftness: 0.45,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.58,
          mixModel: 'light',
          refraction: 0.23,
          specular: 1.35,
          thickness: 0.3,
          edgeBrightness: 1.35,
        },
      },
    },
  },
  {
    after: 'Hades On Fire',
    name: 'Hades on Fire II',
    /**
     * **Hades on Fire II** — the hand-tuned variant of `Hades On Fire`, kept in ADDITION to it (2026-09-13,
     * the user's request: *"Add `Hades On Fire new_20260913_191907.json` as `Hades on Fire II`"*), spawned by
     * the same review that settled its anchor.
     *
     * ⚠️ **The name carries a lower-case "on" that its anchor does not have** (`Hades On Fire`). That is the
     * user's spelling, kept VERBATIM on the `Entropy on Fire` precedent — a preset name is authored text, not
     * a derived string. **So `after` MUST be spelled `'Hades On Fire'`, the anchor's own casing**: `after` is
     * matched against the legacy JSON key, and a near-miss does not error — the variant falls to
     * `library.ts`'s orphan sweep and is appended at the END of the group, which reads as a positioning bug
     * rather than a naming one.
     *
     * Imported from `Hades On Fire new_20260913_191907.json`; **`metadata.name` was rewritten
     * `'Hades On Fire new'` -> `'Hades on Fire II'`**.
     *
     * ⚠️ **This is where `Hades On Fire new`'s refinement survived.** The anchor's settle DISCARDED the
     * `Ember` material and the whole `Customize` grade; this half keeps them, retuned: `splatRadius`
     * 7 -> 5.5, `coreBrightness` 2.2 -> 1.8, `haloStrength` 0.6 -> 0.2, `velocityStretch` 0.8 -> 0.76 (4
     * changed, 1 removed, 25 added against the pending body). TransMap style 2, `speedFactor` 0.5.
     */
    preset: {
      metadata: {
        name: 'Hades on Fire II',
        version: 2,
        designResolution: { width: 100, height: 60 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'fire'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 16000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.2],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 150, amplitude: 150, frequency: 10 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 72, amplitude: 72, frequency: 11 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 115.2, amplitude: 115.2, frequency: 3 },
                fm: { base: 8, amplitude: 10, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 56, amplitude: 56, frequency: 7 },
                fm: { base: 8, amplitude: 4, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 30, amplitude: 30, frequency: 8 },
                fm: { base: 8, amplitude: 4, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 42.666668, amplitude: 42.666668, frequency: 9 },
                fm: { base: 8, amplitude: 4, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 10, amplitude: 10, frequency: 4 },
                fm: { base: 32, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 4.8, amplitude: 4.8, frequency: 5 },
                fm: { base: 32, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 7.4666667, amplitude: 7.4666667, frequency: 6 },
                fm: { base: 32, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [192, 64, 16],
        colorAmp: [64, 64, 0],
        colorFreq: [0.1, 0.2, 0],
        colorShift: [0.6, 0.5, 0],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.85, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[0.2, 0.1, 0.05, 0.05], [0.5, 4, 8, 7], [0.2, 0.1, 0.05, 0.05], [0.5, 4, 8, 7]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 98 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 2,
        transMapDispersion: 0.01,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.5,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Ember',
          splatRadius: 5.5,
          coreBrightness: 1.8,
          haloStrength: 0.2,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 3.4,
          heatMode: 'velocity',
          heatGain: 0.7,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.76,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.5,
          depthBrightness: 0.3,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.86,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.1,
          vignette: 0,
          palette: 'Warm',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Hell Razer',
    name: 'Hell Razer II',
    /**
     * **Hell Razer II** — the hand-tuned variant of `Hell Razer`, kept in ADDITION to it (2026-09-13, the
     * user's request: *"Add `Hell Razer new_20260913_192522.json` as `Hell Razer II`"*), spawned by the same
     * review that settled its anchor. Imported from that file; **`metadata.name` was rewritten
     * `'Hell Razer new'` -> `'Hell Razer II'`**.
     *
     * ⚠️ **This is where `Hell Razer new`'s refinement survived** — the anchor's settle discarded the `Ember`
     * material and the whole grade and went to `star` + neon lines. Against the pending body (8 changed, 1
     * removed, 24 added) this half keeps `Ember` and retunes it towards a longer, dimmer streak:
     * `splatRadius` 7 -> 7.5, `haloStrength` 0.6 -> 0.5, `emissionIntensity` 3.4 -> **1.6**, `heatGain`
     * 0.7 -> 0.9, `velocityStretch` 0.8 -> **0.44**, plus three grade fields. `decayFactor` 0.85, TransMap
     * style 2.
     *
     * ⚠️ **`velocityStretch` is a name trap** — `MaterialConfig.velocityStretch`, the field retuned here, IS
     * live; the identically named preset-level one is not (CLAUDE.md, *Preset format*). The 0.44 above is the
     * material's.
     */
    preset: {
      metadata: {
        name: 'Hell Razer II',
        version: 2,
        designResolution: { width: 100, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'fire'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.5],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 30, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 128, amplitude: 64, frequency: 12 },
                fm: { base: 2, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 0, amplitude: 4, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 4, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 3 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 4, frequency: 10 },
                fm: { base: 32, amplitude: 6, frequency: 4 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 2, frequency: 10 },
                fm: { base: 100, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 2, frequency: 10 },
                fm: { base: 100, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 2, frequency: 10 },
                fm: { base: 100, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.05, 0.05, 0.05],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.85, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[0.1, 0.1, 0, 0], [-1, -4, 0, 0], [0.1, 0.1, 0, 0], [1, 4, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 2,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Ember',
          splatRadius: 7.5,
          coreBrightness: 2.2,
          haloStrength: 0.5,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 1.6,
          heatMode: 'velocity',
          heatGain: 0.9,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.44,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.5,
          depthBrightness: 0.3,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.7,
          bloomIntensity: 0.1,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.17,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.1,
          vignette: 0,
          palette: 'Warm',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'High Frequency',
    name: 'High Frequency II',
    /**
     * **High Frequency II** — the hand-tuned variant of `High Frequency`, kept in ADDITION to it (2026-09-13,
     * the user's request: *"Add `High Frequency new_20260913_194700.json` as `High Frequency II`"*), spawned
     * by the same review that settled its anchor. Imported from that file; **`metadata.name` was rewritten
     * `'High Frequency new'` -> `'High Frequency II'`**.
     *
     * ⚠️ **FIRST library preset to use TransMap style 10 (Vortex) AT ALL** — as both its single style and a
     * one-layer chain. Measured 2026-09-13 over the composed library, style 10 had zero users, single or
     * chained; after this entry the only implemented style with no library user at all is **8 (Time Warp)**,
     * and 11 still has a chain user (`Sphere II`) but no single one. Two consequences worth keeping: the
     * vortex DOES count toward `needsWarp` (8, 9 and 11 do not), so this is also the first variant to force
     * that path from a single style; and style 10's own code had never been exercised by a library preset, so
     * a black-frame or GL-state defect in it would have gone unseen until a user picked it — exactly the
     * "reachable but unused" case.
     *
     * Against `High Frequency new` (2 changed, 1 removed, 32 added) it keeps the `Plasma` material the
     * anchor's settle discarded, hardened: `splatRadius` 9 -> **3**, `haloStrength` 0.85 -> **0.2**.
     * `decayFactor` stays at the legacy 0.4938271604938272 — note the anchor's settle moved it to 0.82, so
     * here the VARIANT is the one closer to legacy. `speedFactor` 0.75.
     */
    preset: {
      metadata: {
        name: 'High Frequency II',
        version: 2,
        designResolution: { width: 100, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'plasma'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 30000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.1],
        angle: [0, 0, 0.1],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 25, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 25, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 25, amplitude: 25, frequency: 20 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 15,
                am: { base: 25, amplitude: 25, frequency: 30 },
                fm: { base: 6, amplitude: 0, frequency: 0 },
              },
              {
                phase: 30,
                am: { base: 2, amplitude: 25, frequency: 4 },
                fm: { base: 0, amplitude: 400, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.4938271604938272, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 10,
        transMapChain: [
          {
            style: 10,
            enabled: true,
            weight: 1,
            vortex: {
              swirl: 0.35,
              radius: 0.4,
              centre: { x: 0.5, y: 0.5 },
              falloff: 'gaussian',
            },
          },
        ],
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.75,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Plasma',
          splatRadius: 3,
          coreBrightness: 1.9,
          haloStrength: 0.2,
          falloffExponent: 3.2,
          thermalLag: 0.08,
          emissionIntensity: 2.1,
          heatMode: 'velocity',
          heatGain: 0.6,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.25,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.68,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Hypno Penta',
    name: 'Hypno Penta II',
    /**
     * **Hypno Penta II** — the hand-tuned variant of `Hypno Penta`, kept in ADDITION to it (2026-09-13, the
     * user's request: *"Add `Hypno Penta new_20260913_195519.json` as `Hypno Penta II`"*), spawned by the same
     * review that settled its anchor.
     *
     * ⚠️ **Both exports of this pair arrived under the ` new` name `Hypno Penta new`** — `…_195140` settled
     * the anchor and `…_195519` (this one, 3 min 39 s later) became the variant. **A new arrival combination**
     * (the file header lists the four on record) and the awkward one: both halves are named for a key that
     * CEASES TO EXIST once the settle lands, so neither file name names anything in the shipped library.
     * **`metadata.name` was rewritten `'Hypno Penta new'` -> `'Hypno Penta II'`.**
     *
     * Against `Hypno Penta new` (2 changed, 30 removed, 25 added) it is the OPPOSITE verdict to its anchor's
     * settle, which went `liquid` + the `Liquid` material: here the whole `Customize` grade is dropped for the
     * built-in **`Dramatic`** film look (29 custom params gone), `renderMode` is **`blend`** with no material
     * at all, `renderer.decayFactor` 0.617283950617284 -> **0.169** — a very short trail — and
     * `overlay.fluidAdvection.blend` is 0.53 with `returnForce` 3.1.
     *
     * ⚠️ **That advection blend is the ONLY nonzero one in the library** (measured 2026-09-13: 85 presets carry
     * the block, 84 of them at `blend: 0`). ⚠️ **And `Fluid Feedback Bloom` — named `Fluid Advection Demo` when
     * this note was written, renamed by `21.2` for exactly the reason below — does NOT carry the block at all** —
     * the preset named for the feature drives TransMap style **6 Fluid Feedback** through its chain instead, a
     * different subsystem with a similar name. So before this entry the overlay advection FORCE had no library
     * user whatever, and a census that trusted the demo's name would have recorded one.
     *
     * ⚠️ **The pair ships both verdicts of a rebuilt renderer, not two tunings of one.** The anchor occludes
     * (`liquid` is the one render mode that does) and this one accumulates barely at all, so any judgement
     * that holds for one half of this pair says nothing about the other.
     */
    preset: {
      metadata: {
        name: 'Hypno Penta II',
        version: 2,
        designResolution: { width: 100, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'void'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 25, frequency: 2 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 18,
                am: { base: 0, amplitude: 25, frequency: 3 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 12.5, amplitude: 12.5, frequency: 5 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 3.6,
                am: { base: 12.5, amplitude: 12.5, frequency: 7 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 6.25, amplitude: 6.25, frequency: 11 },
                fm: { base: 125, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0.72,
                am: { base: 6.25, amplitude: 6.25, frequency: 13 },
                fm: { base: 125, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.169, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Dramatic',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'blend',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0.53, returnForce: 3.1 },
      },
    },
  },
  {
    after: 'Hypnosis',
    name: 'Hypnosis II',
    /**
     * **Hypnosis II** - the hand-tuned variant of `Hypnosis`, kept in ADDITION to it. ⚠️ **IT ARRIVED HERE BY
     * A RENAME, NOT AN IMPORT** (2026-09-13, the user's request: *"Rename `Hypnosis new` to `Hypnosis II`"*):
     * the body is the one added as the pending `Hypnosis new` earlier the same day, moved out of
     * `refined-presets.ts` VERBATIM with only `metadata.name` rewritten `'Hypnosis new'` -> `'Hypnosis II'`.
     *
     * ⚠️ **A FIFTH arrival shape for this file, and the first with NO export of its own** (shape 5 in the
     * header, which this entry is the whole reason for). **The other four all describe which NAME an export
     * bore**; this body was already stored, so what moved was its KEY and its FILE. **A variant therefore does not imply an export** - the
     * same lesson `Kaleido Star` teaches on the settle side, in the same batch.
     *
     * ⚠️ **And it CLOSES the re-opened pair of 2026-09-13.** `Hypnosis` + `Hypnosis new` no longer coexist,
     * so the FOURTH-outcome warning in `refined-presets.ts`' header and in the settled `Hypnosis`' own
     * comment now describes a state the library **no longer contains**: read both as history, and do not go
     * looking for the live example they describe. **The rule still stands - a settle CAN re-open its pair -
     * it just has no instance in the tree any more.**
     *
     * ⚠️ **The rename is POSITION-PRESERVING, measured rather than assumed:** `Hypnosis new` sat at library
     * index 80, directly after the settled `Hypnosis` at 79, and `after: 'Hypnosis'` places this entry at 80
     * too. Since a variant is positioned by its anchor and not by array order, the move cost the library no
     * reordering and no entry - **the only settle-adjacent operation so far that changes the library's COUNT
     * by nothing at all.**
     *
     * Against the settled `Hypnosis` (21 changed, 4 removed, 57 added) it takes a completely different
     * renderer: `renderMode` -> **`liquid`** with the **`Liquid` material**, an `overlay.liquid` iso-surface
     * block AND an `overlay.dye` block. The grade is retuned rather than kept: palette `Ocean` ->
     * **`Midnight`** by `depth`, `exposure` 3.44 -> 1.4, `glow` 1.5 -> 4, bloom 0.85/0.9 -> 0.6/0.3,
     * `saturation` 0.5 -> 1, `vignette` 0.6 -> 0. `decayFactor` is the legacy value, unchanged.
     *
     * ⚠️ **Third library preset to carry `overlay.dye`** (after `Pipes Art` and `Dye Wake`, measured
     * 2026-09-13) and the second to carry the `Liquid` material (with `Hypno Penta`). `'dye'` is the only
     * colour source whose DATA can be absent at runtime - it degrades to `'ramp'` - and the only one exempt
     * from Colour Mix, so judging this body means confirming the dye field is actually LIVE rather than
     * reading the block's presence.
     *
     * ⚠️ **It was already shaped like a variant before the rename: of the 98 pending entries it was the ONE
     * that carried no `overlay.sliderBaseFilmLook`** (measured 2026-09-13), because it came from an owner
     * export rather than from the generator - and 0 of the variants carry one. The rename moved it into the
     * group it already matched, which is the quiet argument that the owner's verdict was reading the same
     * thing the measurement was.
     */
    preset: {
      metadata: {
        name: 'Hypnosis II',
        version: 2,
        designResolution: { width: 100, height: 100 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 25, frequency: 2 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 30,
                am: { base: 0, amplitude: 25, frequency: 3 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 12.5, amplitude: 12.5, frequency: 5 },
                fm: { base: 9, amplitude: 0, frequency: 0 },
              },
              {
                phase: 10,
                am: { base: 12.5, amplitude: 12.5, frequency: 7 },
                fm: { base: 9, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 6.25, amplitude: 6.25, frequency: 11 },
                fm: { base: 81, amplitude: 0, frequency: 0 },
              },
              {
                phase: 1.111,
                am: { base: 6.25, amplitude: 6.25, frequency: 13 },
                fm: { base: 81, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.617283950617284, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Liquid',
          splatRadius: 18,
          coreBrightness: 1.3,
          haloStrength: 1,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 0.92,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.85,
        },
        liquid: {
          isoLevel: 0.1512,
          kernelWidth: 2.35,
          edgeSoftness: 0.15,
          tintSource: 'dye',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 1.4,
          thickness: 0.5,
          edgeBrightness: 1.15,
        },
        dye: {
          enabled: true,
          decayRate: 0.985,
          opacity: 0.5,
          colourSource: 'temperature',
          fixedColour: [1, 0.35, 0.1],
          injectionRadius: 12,
          advectionStrength: 1,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.4,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'Midnight',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Inside Nebula',
    name: 'Inside Nebula II',
    /**
     * **Inside Nebula II** — the hand-tuned variant of `Inside Nebula`, kept in ADDITION to it (2026-09-13,
     * the user's request: *"Add `Inside Nebula_20260913_201913.json` as `Inside Nebula II`"*), spawned by the
     * same review that settled its anchor.
     *
     * ⚠️ **Both exports of this pair arrived under the anchor's PLAIN name `Inside Nebula`** — `…_201454`
     * settled the pair, `…_201913` (this one, 4 min 19 s later) became the variant. **`metadata.name` was
     * rewritten `'Inside Nebula'` -> `'Inside Nebula II'`.**
     *
     * Against `Inside Nebula new` (22 changed, 4 removed, 37 added) it goes the opposite way from its
     * anchor's settle, which discarded the grade entirely: this half KEEPS a `Customize` grade and retunes 21
     * of its fields — palette `Ocean` -> **`Midnight`** by `velocity`, `glow` 1.5 -> 4, `exposure`
     * 3.5 -> 1.9, bloom 0.85/0.9 -> 0.6/0.3, `saturation` 0.5 -> 1, `vignette` 0.6 -> 0 — and ADDS a
     * `LiquidLight` material on the `splat` path, with `renderer.decayFactor` 0.617283950617284 -> **0.94**.
     *
     * ⚠️ **Its palette/mapping pair is the mirror of `Hypnosis II`'s** (added in the same batch as
     * `Hypnosis new`, renamed later that day — the body is the same one): both go `Ocean` -> `Midnight`, but
     * this one maps by `velocity` and that one by `depth`. The two are therefore a ready-made A/B for the
     * colour-mapping source with the palette held constant — and CLAUDE.md's rule that the depth conventions
     * are opposite where two subsystems meet makes that a pair worth keeping intact. **Both halves of the A/B
     * now live in THIS file**, two entries apart, which is the one thing the rename improved about it.
     */
    preset: {
      metadata: {
        name: 'Inside Nebula II',
        version: 2,
        designResolution: { width: 75, height: 75 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.2],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 112.5, amplitude: 112.5, frequency: 10 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 90, amplitude: 90, frequency: 11 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 108, amplitude: 108, frequency: 3 },
                fm: { base: 32, amplitude: 10, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 42, amplitude: 42, frequency: 7 },
                fm: { base: 32, amplitude: 4, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 37.5, amplitude: 37.5, frequency: 8 },
                fm: { base: 32, amplitude: 4, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 40, amplitude: 40, frequency: 9 },
                fm: { base: 32, amplitude: 4, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 7.5, amplitude: 7.5, frequency: 4 },
                fm: { base: 128, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 6, amplitude: 6, frequency: 5 },
                fm: { base: 128, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 7, amplitude: 7, frequency: 6 },
                fm: { base: 128, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.2, 0.1, 0.3],
        colorShift: [0.6, 0.2, 0.4],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.94, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 2,
        linesEnabled: false,
        lineWidth: 0.5,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'LiquidLight',
          splatRadius: 5.5,
          coreBrightness: 1.3,
          haloStrength: 0.4,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 0.92,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.54,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.9,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'Midnight',
          paletteMapping: 'velocity',
        },
      },
    },
  },
  {
    after: 'Lost In Another Sky',
    name: 'Lost In Another Sky II',
    /**
     * **Lost In Another Sky II** — the hand-tuned variant of `Lost In Another Sky`, kept in ADDITION to it
     * (2026-09-14, the user's request: *"Add `Lost In Another Sky_20260914_224724.json` as
     * `Lost In Another Sky II`"*), spawned by the same review that settled its anchor.
     *
     * ⚠️ **Both exports of this pair arrived under the anchor's PLAIN name `Lost In Another Sky`** — arrival
     * combination 3, and the FOURTH instance of it after `Dual Spiral Wind II`, `Fluid II` and
     * `Inside Nebula II`. `…_224724` (this one) became the variant and `…_225004`, **2 min 40 s LATER**, settled
     * the pair — the opposite order to `Dual Spiral Wind`, where the earlier export settled; so the timestamp
     * distinguishes the two files but does NOT decide which role either plays. **`metadata.name` was rewritten
     * `'Lost In Another Sky'` -> `'Lost In Another Sky II'`**, which is the step that makes this a variant at all:
     * pasted verbatim it would collide with its own anchor.
     *
     * Both halves were exported from the LEGACY body (neither carries `createdWith`/`tags`), so against the
     * migrated legacy body this one reports **1 changed leaf — `renderer.decayFactor` 0.9876543209876544 ->
     * 0.777** — with `generators` byte-identical. **Four things separate it from the settled anchor:**
     *   * **`decayFactor` 0.777 against the anchor's 0.99.** The anchor lengthened the `MotionBlur 8` trail; this
     *     half shortened it hard, which is the only reason the additions below are visible at all.
     *   * **A two-row TransMap CHAIN, live**: `{ style: 0 (Wave Shift), enabled, weight 1 }` +
     *     `{ style: 6 (Fluid Feedback), enabled, weight 1 }`, over `transMapEnabled: true` — so unlike
     *     `Lonely Particle`'s inert `proceduralFlow` (settled in the same message with Enable OFF), this chain
     *     runs. The array is present precisely BECAUSE it is not legacy-expressible: two full-weight layers
     *     cannot be said by the `transMapStyle` scalar.
     *   * **A `fluidFeedback` block** (`persist` 0.96, `amplify` 1, `dispersion` 0, `fieldDecay` 0.985,
     *     `glowBoost` 0.25) — style 6's own parameters, exported because its gate is `chainHasLayerFor(6)`. ⚠️
     *     **Style 6 OVERRIDES `trailDecay`** (`applyFluidFeedbackState()` owns the derivation, which is why
     *     `applyPresetChange` deliberately does not set it from `renderer.decayFactor`), so `0.777` and
     *     `persist: 0.96` are not two independent trail controls — read the owner before tuning either.
     *   * **`overlay.particleSize: 2`**, the plain multiplier (11 settled entries in `refined-presets.ts` carry
     *     one). It multiplies an already-scaled base, so never pair it with an absolute-pixel figure from
     *     elsewhere — applying both squares it.
     * Like the anchor it authors `filmLook: 'Legacy Graded'` and `renderMode: 'blend'` over `renderer.mode:
     * 'star'` (the overlay wins), and its `transMapStyle: 0` scalar mirrors the migrated
     * `postProcessors.transMap`.
     *
     * ⚠️ **Measured 2026-09-14: FOUR presets in the whole library run a live style-6 layer** — `Asymetry`
     * (decay 0.9876543209876544), `Dual Spiral Wind II` (0.864…), `Fluid II` (0.99) and this one, whose **0.777
     * is by far the shortest trail of the four**; `CHAIN_PRESETS` and `DEMO_PRESETS` contribute none. ⚠️ **A
     * FIFTH preset carries the block with the row DISABLED** — the settled `Fluid`, whose own variant `Fluid II`
     * enabled it — so `overlay.fluidFeedback` is not evidence that style 6 runs; read `enabled` on the row.
     * And this block is `Fluid`'s and `Fluid II`'s **field-for-field except `glowBoost` 0 -> 0.25**, so the three
     * are an A/B for the glow term across three trail lengths. That is the interesting half of the pair: the
     * anchor keeps the accumulation buffer doing the remembering, this one moves the job into the feedback field.
     * Judge it on the final 8-bit output rather than on the field's own brightness — `glowBoost` feeds the same
     * bloom the grade does.
     */
    preset: {
      metadata: {
        name: 'Lost In Another Sky II',
        version: 2,
        designResolution: { width: 100, height: 60 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0.5, 0],
        angle: [30, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 120, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 3, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 96, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 3, frequency: 1.1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 2, amplitude: 0, frequency: 0 },
                fm: { base: 16, amplitude: 8, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 1.2, amplitude: 0, frequency: 0 },
                fm: { base: 16, amplitude: 8, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 1.6, amplitude: 0, frequency: 0 },
                fm: { base: 16, amplitude: 8, frequency: 3 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [0, 0, 0],
        colorAmp: [128, 128, 128],
        colorFreq: [0.01, 0.01, 0.01],
        colorShift: [0.01, 0.02, 0.03],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.777, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0], [1, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1 },
          { style: 6, enabled: true, weight: 1 },
        ],
        fluidFeedback: { persist: 0.96, amplify: 1, dispersion: 0, fieldDecay: 0.985, glowBoost: 0.25 },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 2,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
      },
    },
  },
  {
    after: 'Mandala Tri',
    name: 'Liquid Mandala',
    /**
     * **Liquid Mandala** — the hand-tuned LIQUID variant of `Mandala Tri`, kept in ADDITION to it (2026-09-16,
     * the user request: *"Add `Mandala Tri new_20260916_211456.json` as `Liquid Mandala`"*), spawned by the same
     * review that settled its anchor. Imported from that export and kept VERBATIM; only `metadata.name` was
     * changed, from the export value `Mandala Tri new`.
     *
     * Arrival shape **1** (this file header): a ` new` export whose anchor settled from NO export at all —
     * `Mandala Tri` was settled the same day by a pure RE-KEY of the generated body. ⚠️ **So both halves of
     * this pair descend from ONE body**: `generators`, `renderer` and `postProcessors` are byte-identical to the
     * anchor and to the migrated legacy `Mandala Tri`, and the whole difference lives in `overlay`, at 59 leaves.
     * The figure is not what makes this a variant; the surface is.
     *
     * What distinguishes it: **`renderMode: 'liquid'`** — the library one OCCLUDING mode — over a `Liquid`
     * material and a LIVE dye field (`dye.enabled: true`, `liquid.tintSource: 'dye'`), so the surface tint reads
     * the dye texture rather than a ramp; this is one of the few entries where `'dye'` does not degrade to
     * `'ramp'` for want of data. `liquid.isoLevel: 4` is exactly `ISO_LEVEL_MAX`
     * (`ui/synthesis-lab/tabs/visual-fx.ts`) — the tightest surface the track can express, authored AT the
     * ceiling rather than near it.
     * ⚠️ **All three things named "liquid" are set here at once** (the render mode,
     * `material.preset: 'Liquid'`, and the `liquid`/`colourRamp: 'liquid'` ramps), which is why it reads as a
     * single decision; only the tooltips separate them.
     *
     * Against the anchor grade exactly ONE leaf moved — `palette` `'Neon'` → **`'Aurora'`**, still by `phase`;
     * the `Customize` container is otherwise the anchor one (glow 5.4, exposure 0.66, `gain` [1.1, 1.1, 1.1],
     * saturation 1.4, vignette 0.2, `depthSize` 0.3, `lightingMode` 2).
     * ⚠️ **The anchor keeps `overlay.sliderBaseFilmLook: 'Neon'` and this entry cannot**: a re-key
     * preserves the field and an export can never carry it, because `getSnapshot()` has no source for it. One
     * grade therefore exists twice in the library with two different rebuild behaviours — the anchor next
     * Mood/Glow drag rebuilds from `Neon`, this one from `Legacy`. `attractorBlend: 0.6` is inert here
     * (`attractorIndex` is -1).
     */
    preset: {
      metadata: {
        name: 'Liquid Mandala',
        version: 2,
        designResolution: { width: 100, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 25, frequency: 5 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 30,
                am: { base: 0, amplitude: 25, frequency: 5 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 25, frequency: 5 },
                fm: { base: 729, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 12.5, amplitude: 12.5, frequency: 10 },
                fm: { base: 9, amplitude: 0, frequency: 0 },
              },
              {
                phase: 10,
                am: { base: 12.5, amplitude: 12.5, frequency: 10 },
                fm: { base: 9, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 6.25, amplitude: 6.25, frequency: 15 },
                fm: { base: 81, amplitude: 0, frequency: 0 },
              },
              {
                phase: 1.111,
                am: { base: 6.25, amplitude: 6.25, frequency: 15 },
                fm: { base: 81, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.617283950617284, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Liquid',
          splatRadius: 18,
          coreBrightness: 1.3,
          haloStrength: 1,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 2.2,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.85,
        },
        liquid: {
          isoLevel: 4,
          kernelWidth: 2.05,
          edgeSoftness: 0.28,
          tintSource: 'dye',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 1.45,
          thickness: 0.5,
          edgeBrightness: 0.6,
        },
        dye: {
          enabled: true,
          decayRate: 0.906,
          opacity: 0.36,
          colourSource: 'depth',
          fixedColour: [1, 0.35, 0.1],
          injectionRadius: 12,
          advectionStrength: 1.4,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.66,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Aurora',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Mandelbrot Simulation',
    name: 'Mandelbrot River',
    /**
     * **Mandelbrot River** — the hand-tuned variant of `Mandelbrot Simulation`, kept in ADDITION to it
     * (2026-09-16, the user request: *"Add `Mandelbrot Simulation new v3_20260916_213055.json` as
     * `Mandelbrot River`"*). Imported from that export and kept VERBATIM; only `metadata.name` was changed.
     *
     * ⚠️ **A SIXTH arrival combination, added to this file header**: the export bears
     * `Mandelbrot Simulation new v3` — **neither the anchor name, nor its ` new` sibling name, nor this entry
     * own.** A working name with a version suffix that was NEVER a library key, so unlike shapes 1–4 the
     * file name names nothing in the shipped library and nothing in `REFINED_PRESETS` either. It arrived
     * 10 min 23 s after the export that settled the anchor (21:20:32 → 21:30:55) and was requested in the next
     * bullet of the same message: the pair is one sitting of work, so read the timestamps rather than the names.
     *
     * What distinguishes it from the settled `Mandelbrot Simulation`: **it is the half that actually turns the
     * attractor ON.** `attractorIndex: 25` is `ATTRACTOR_PRESETS`' **`Mandelbrot Full Set`** (of 35) at
     * `attractorBlend: 1` — fully attractor-positioned — against the anchor `attractorIndex: -1`, so the name is
     * literal: the figure is the set, not a Lissajous. The body is retuned to match: `particleCount` 20 000 →
     * **30 100**, `rotation` [0.5, 0.5, 0.5] → **[0, 0, 0.9]** (z-only spin), `speedFactor` 2 → **3.01**,
     * `figureScale` 1 → **1.4021152112778286**, a Lab drag carried at full precision rather than an authored
     * constant.
     * ⚠️ It authors no `maxIter`, and one would not be read if it did —
     * `computeAdaptiveMaxIter(bounds)` governs (`generators/attractors.ts`).
     *
     * ⚠️ **TransMap is OFF here and ON in the anchor** (`overlay.transMapEnabled` false against true),
     * while `postProcessors.transMap.enabled` stays `true` over the legacy four authored `sinMagicParams` rows:
     * `Enable` off is the only true bypass, so those numbers are inert and must not be read as a live warp. The
     * three-row `transMapChain` (styles 0, 4, 6) is disabled row by row as well — and **that is precisely why
     * `ifsParams` and `fluidFeedback` appear in this entry at all**: their export gates are `chainHasLayerFor(4)`
     * and `chainHasLayerFor(6)`, which test a row PRESENCE and not its `enabled` flag, so a configuration
     * survives the row being switched off. `ifsParams` is `IFS_PRESETS`' **`Kaleidoscope`** verbatim and
     * `fluidFeedback.persist` is 0.97 against the 0.96 default: authored values for two passes that never run.
     *
     * The grade is the anchor flat bright one minus the bloom — `Customize` with `bloomEnabled: false` (threshold
     * 0.05 and intensity 0.65 left behind, inert), `exposure` 2.3, `aces`, no palette and the whole depth block
     * at 0 — the same "removed rather than retuned" direction recorded on the anchor.
     */
    preset: {
      metadata: {
        name: 'Mandelbrot River',
        version: 2,
        designResolution: { width: 75, height: 60 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 30100,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.9],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 25, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 25, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 67.5, frequency: 1 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.3, 0.2],
        colorShift: [0.2, 0.3, 0.1],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.9876543209876544, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[-3.5252395, -0.13100608, 3.4336207, -0.18399265], [-0.85365725, 1.4781172, 6.382013, 0.35840952], [1.2670563, -2.5264447, 3.7346892, 1.4638029], [6.2106223, -0.96369255, 2.1401706, -8.016661]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 2.5,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: 25,
        attractorBlend: 1,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: false, weight: 1 },
          { style: 4, enabled: false, weight: 1 },
          { style: 6, enabled: false, weight: 1 },
        ],
        ifsParams: [
          { angle: 120, scale: 0.9, tx: 0, ty: 0, weight: 1 },
          { angle: 240, scale: 0.9, tx: 0, ty: 0, weight: 1 },
          { angle: 360, scale: 0.9, tx: 0, ty: 0, weight: 1 },
        ],
        transMapDispersion: 0.23,
        fluidFeedback: { persist: 0.97, amplify: 1, dispersion: 0, fieldDecay: 0.985, glowBoost: 0 },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 3.01,
        figureScale: 1.4021152112778286,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.05,
          bloomIntensity: 0.65,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.3,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Miracle',
    name: 'Birth of a Black Hole',
    /**
     * **Birth of a Black Hole** — the hand-tuned variant of `Miracle`, kept in ADDITION to it (2026-09-17, the
     * user request: *"Add `Miracle_20260917_075300.json` as `Birth of a Black Hole`"*), spawned by the same review
     * that settled its anchor. Imported from that export and kept VERBATIM; only `metadata.name` was changed,
     * from the export value `Miracle`.
     *
     * Arrival shape **3** (this file header): two exports bearing ONE name, the anchor's PLAIN one —
     * `Miracle_20260917_075300.json` here and `…_075553.json` for the settle, **2 min 53 s apart**, so only the
     * timestamp tells them apart and the request named both. The LATER one settled. ⚠️ **That remains a coin
     * toss, not a rule** — re-counted 2026-09-17 over the entries that record BOTH timestamps, shape 3's five
     * instances split **3–2** for the later export settling (later: `Inside Nebula II`,
     * `Lost In Another Sky II`, this one; earlier: `Dual Spiral Wind II`, `Fluid II`), and a 3–2 split is not
     * evidence of a convention. **Count it in the entries, never from the header's two named examples.**
     * ⚠️ **The name shares not one WORD with the anchor's**, so nothing in it says which preset it belongs to;
     * `after` is the only record of that. Measured 2026-09-17 over all nineteen entries: **14 start with the
     * anchor's name** (`Hades on Fire II` only differing in case), **3 share a word without being a prefix**
     * (`Liquid Fractal`, `Liquid Mandala`, `Mandelbrot River`) and **2 share nothing at all** — `Boiling Milk`
     * (anchor `Lava`) and this one. **So a name lookup finds 17 of 19 anchors and silently fails on 2**; any
     * tool that pairs variants with anchors must read `after`.
     *
     * **What distinguishes it: this is the half that turns an attractor on.** `attractorIndex: 13` is
     * `ATTRACTOR_PRESETS`' **`Julia Dendrite`** (of 35) at `attractorBlend: 0.75`, against the anchor's
     * `attractorIndex: -1` — so the figure is a dendrite the waves are pulled three-quarters of the way onto,
     * and `figureScale: 1.137411461756029` is a Lab drag carried at full precision rather than an authored
     * constant. `lineWidth` 2 → 1.
     *
     * ⚠️ **The two `transMapChain` rows are NOT comparable with the anchor's at their authored numbers.** Both
     * entries open with style 3; the second row is style **6** in the anchor and style **7** here, with
     * `refraction` { strength 0.3, reach 2.3, invert false, source `density` }. Two consequences, both measured
     * in the source rather than inferred:
     *   • **The whole warp runs at a QUARTER here.** `transMapFractalFade()` (`main.ts`) returns `1 - blend` when
     *     the GENERATOR reports a live attractor — 0.25 at 0.75 — and `layerWeights()` (`trans-map.ts`)
     *     multiplies the static layer AND the refract layer by it. **Style 6 is the one exemption and style 7 is
     *     explicitly not**, so the anchor's fluid row would have been exempt while this refraction row is faded.
     *     In the anchor the fade is **1.0**, because `attractorIndex: -1` makes its `attractorBlend: 0.6` inert.
     *     Read the authored 0.3 strength as ~0.075 effective; do not "correct" it — the owner tuned what he saw.
     *   • **It carries no `fluidFeedback` block at all**, where the anchor does: that block's export gate is
     *     `chainHasLayerFor(6)`, and there is no style-6 row here. Nor any `ifsParams` (no style 4). So the
     *     block's ABSENCE is the chain's shape, not an omission — verbatim means copying what is absent.
     *
     * The grade is a hand-built `Customize` container, not the anchor's: **24 leaves** differ from the refined
     * `Miracle new` its figure came from. The `Ethereal` bundle's depth shading and `Pastel` palette by `velocity`
     * are gone (whole depth block at 0, `palette` `'none'` by `depth`, `lift`/`gamma`/`gain` at identity,
     * `toneMapCurve` `reinhard` → `aces`, `saturation` 0.85 → 1, `vignette` 0.15 → 0), with `glow` 6.4 → 4 and
     * `exposure` 0.43 → **1.4**. ⚠️ The anchor settled to the NAMED look `Legacy Graded` instead, so the pair
     * ships two different grading paths over one figure — and neither can carry `sliderBaseFilmLook` (`Ethereal`
     * on the ` new` body, dropped by both pastes), so both rebuild from `Legacy` on the next Mood/Glow drag.
     * ⚠️ **`renderMode: 'blend'` sits over `renderer.mode: 'star'`** in both halves; the overlay wins.
     *
     * ✅ **BROWSER-CONFIRMED BY THE OWNER 2026-09-17**, with the eleven settles of the same sitting
     * (*"all of the changed presets work well"*) — so the quarter-strength refraction above is confirmed AS SEEN,
     * which is the standing reason not to "correct" an authored number a fade divides down.
     */
    preset: {
      metadata: {
        name: 'Birth of a Black Hole',
        version: 2,
        designResolution: { width: 80, height: 80 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 0, amplitude: 40, frequency: 1 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 40, frequency: 2 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: { base: 0, amplitude: 20, frequency: 3 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 20, frequency: 4 },
                fm: { base: 3, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [32, 64, 128],
        colorAmp: [64, 64, 128],
        colorFreq: [0.01, 0.02, 0.03],
        colorShift: [0.5, 0.23, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.9876543209876544, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [[20, 10, 5, 2.5], [-1, -2, -3, -4], [20, 10, 5, 2.5], [1, 2, 3, 4]],
          sinMagicParams2: [[-0.2, 0, 0, 0], [0.5, 0, 0, 0], [-0.2, 0, 0, 0], [-0.5, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 1,
        filmLook: 'Customize',
        attractorIndex: 13,
        attractorBlend: 0.75,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 3,
        transMapChain: [
          { style: 3, enabled: true, weight: 1 },
          {
            style: 7,
            enabled: true,
            weight: 1,
            refraction: { strength: 0.3, reach: 2.3, invert: false, source: 'density' },
          },
        ],
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1.137411461756029,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.4,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  {
    after: 'Multi Threads II',
    name: 'Multi Mixer',
    /**
     * **Multi Mixer** — the hand-tuned variant of `Multi Threads II`, kept in ADDITION to it (2026-09-17, the
     * user request: *"Add `Multi Threads II_20260917_145719.json` as `Multi Mixer`"*), spawned by the same
     * review that settled its anchor. Imported from that export and kept VERBATIM; only `metadata.name` was
     * changed, from the export value `Multi Threads II`.
     *
     * Arrival shape **3** (this file's header): two exports bearing ONE name, the anchor's PLAIN one —
     * `…_145719.json` here and `…_145957.json` for the settle, **2 min 38 s apart**, so only the timestamp
     * tells them apart and the request named both. The LATER one settled. ⚠️ Its sibling
     * `Aizawa Particle Swarm`, added in the SAME sitting two hours later, is shape 3 the other way round —
     * **one sitting contains both orders**, which is the strongest evidence yet that the split is not a
     * convention. Re-counted 2026-09-17 including both: **seven instances, 4–3 for the LATER export
     * settling.** Count it in the entries, never from the header's examples.
     *
     * **What distinguishes it: it is the library's widest field stack, and three of its blocks had almost no
     * other example.** Measured 2026-09-17 across all seven TS preset groups BEFORE this batch:
     * `renderMode: 'volume'` had **ZERO** users (this is the first), `liquidField.enabled` had **one**
     * (`Liquid Field Pool`, a demo), `overlay.cohesion` five, and a non-zero `transMapForceBlend` five — all five
     * in `flow-presets.ts`, so this is the first outside that group. It runs all of them at once: volume
     * render (`extinction` 3, `depthFade` 0.3, `densityScale` 1) over a `liquidField` (`cloud` seed,
     * `poolSize` 11 000, `fieldCoupling` 0.63, `fieldDecay` 0.984), a `cohesion` block (`strength` 0.57,
     * `radius` 64, `returnForce` 3.25), the force gate at `transMapForceBlend` 0.68 and curl noise at a
     * deliberately tiny `turbulence` 0.02 — under a `Customize` grade whose `vignette` **0.75 is the highest
     * in the library** (the previous maximum was 0.6, shared by six presets) with `bloom` switched OFF and
     * `exposure` 1.9.
     * ⚠️ **`particleSize` 0.62 and `decayFactor` 0.696 are the two values to leave alone**: against the
     * anchor's 1.57 and 0.841 they are less than half and a much shorter trail, which is what keeps a volume
     * render at `extinction` 3 from filling the frame. ⚠️ **It shares a WORD with its anchor without being a
     * prefix of it** — re-measured over all 21 entries, the name shapes are now 14 prefix / **5** share-a-word
     * / 2 share-nothing, so a name lookup still finds only 16 of 21 anchors and `after` remains the only
     * record.
     */
    preset: {
      metadata: {
        name: 'Multi Mixer',
        version: 2,
        designResolution: { width: 75, height: 100 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.4],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 37.5, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 16, frequency: 0.8 },
              },
              {
                phase: 0,
                am: { base: 50, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 16, frequency: 1.6 },
              },
              {
                phase: 0,
                am: { base: 43.75, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 8, frequency: 3 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 800, frequency: 1 },
                fm: { base: 0, amplitude: 4, frequency: 0.1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.696, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [[32, 0, 0, 0], [2, 0, 0, 0], [32, 0, 0, 0], [-1, 0, 0, 0]],
          sinMagicParams2: [[-0.1, 0, 0, 0], [-0.5, 0, 0, 0], [-0.1, 0, 0, 0], [0.5, 0, 0, 0]],
          zoomCenter: { x: 33, y: 66 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'volume',
        transMapEnabled: true,
        transMapStyle: 3,
        transMapForceBlend: 0.68,
        transMapForceReturn: 7.5,
        curlNoise: { enabled: false, turbulence: 0.02, scale: 0.7, evolutionSpeed: 0.15 },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 0.62,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        volumeRender: { extinction: 3, densityScale: 1, depthFade: 0.3 },
        cohesion: { strength: 0.57, radius: 64, returnForce: 3.25 },
        liquidField: { enabled: true, poolSize: 11000, seedPattern: 'cloud', fieldCoupling: 0.63, fieldDecay: 0.984 },
        customFilmLookParams: {
          glow: 6,
          depthSize: 0.45,
          depthBrightness: 0.35,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.45,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.9,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.3,
          vignette: 0.75,
          palette: 'none',
          paletteMapping: 'velocity',
        },
      },
    },
  },
  {
    after: 'Particle Swarm II',
    name: 'Aizawa Particle Swarm',
    /**
     * **Aizawa Particle Swarm** — the hand-tuned variant of `Particle Swarm II`, kept in ADDITION to it
     * (2026-09-17, the user request: *"Add `Particle Swarm II_20260917_153423.json` as
     * `Aizawa Particle Swarm`"*), spawned by the same review that settled its anchor. Imported from that
     * export and kept VERBATIM; only `metadata.name` was changed, from the export value `Particle Swarm II`.
     *
     * Arrival shape **3** again — `…_153311.json` settled the pair and `…_153423.json` is this one, **1 min
     * 12 s apart**. ⚠️ **Here the EARLIER export settled**, the opposite way round from `Multi Mixer` in the
     * same sitting; see that entry for the re-count (seven instances, 4–3 for the later one settling).
     *
     * **What distinguishes it: exactly TWO leaves.** `attractorBlend` 0 → **0.75** and `figureScale`
     * 1 → 1.336025049064065 (a Lab drag carried at full precision). Both bodies already carry
     * `attractorIndex: 11`, `ATTRACTOR_PRESETS`' **`Aizawa Torus`** (of 35), which the anchor holds at blend
     * 0 — inert — **so this pair is the library's one demonstration of a single attractor being switched on
     * against an otherwise identical figure.** Measured 2026-09-17 over the seven TS groups: `Aizawa Torus`
     * had **no other user at all**, and only three bodies ran ANY attractor at a non-zero blend
     * (`Mandelbrot River`, `Birth of a Black Hole`, `Attractor Fire Cloud`), so this is the fourth.
     * ⚠️ **The two leaves are one edit, not two.** An attractor is fitted to a fraction of the design box
     * (`generators/attractors.ts`), so pulling the figure three-quarters onto it shrinks the drawing;
     * `figureScale` 1.34 reads as the compensation for exactly that, which is why changing one without the
     * other loses the framing. ⚠️ **Grid reuse is by TOLERANCE**, so the anchor and this variant do not share
     * an attractor grid despite sharing the index — a crossfade between them lerps the bounds.
     */
    preset: {
      metadata: {
        name: 'Aizawa Particle Swarm',
        version: 2,
        designResolution: { width: 75, height: 100 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0.5, 0.5, 0.5],
        angle: [0.5, 0.5, 0.5],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 1, frequency: 1 },
              },
              {
                phase: 30,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 1, frequency: 2 },
              },
              {
                phase: 60,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 1, frequency: 3 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 10, amplitude: 0, frequency: 0 },
                fm: { base: 64, amplitude: 1, frequency: 1 },
              },
              {
                phase: 30,
                am: { base: 10, amplitude: 0, frequency: 0 },
                fm: { base: 64, amplitude: 1, frequency: 2 },
              },
              {
                phase: 60,
                am: { base: 10, amplitude: 0, frequency: 0 },
                fm: { base: 64, amplitude: 1, frequency: 3 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 5, amplitude: 0, frequency: 0 },
                fm: { base: 128, amplitude: 1, frequency: 1 },
              },
              {
                phase: 30,
                am: { base: 5, amplitude: 0, frequency: 0 },
                fm: { base: 128, amplitude: 1, frequency: 2 },
              },
              {
                phase: 60,
                am: { base: 5, amplitude: 0, frequency: 0 },
                fm: { base: 128, amplitude: 1, frequency: 3 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.2469135802469136, blurRadius: 0, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        attractorIndex: 11,
        attractorBlend: 0.75,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1.336025049064065,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
      },
    },
  },
  {
    after: 'Penta Spirals',
    name: 'Rubber Penta Spirals',
    /**
     * **Rubber Penta Spirals** — the hand-tuned variant of `Penta Spirals`, kept in ADDITION to it
     * (2026-09-17, third batch, the user request: *"Add `Penta Spirals new_20260917_154720.json` as
     * `Rubber Penta Spirals`"*), spawned by the review that settled its anchor. Imported from that export and
     * kept VERBATIM; only `metadata.name` was changed, from the export value `Penta Spirals new`.
     *
     * **Arrival shape 1** — a ` new` export with NO settle export at all, the anchor having settled from no
     * export whatever (a pure RE-KEY). ⚠️ **That shape had exactly ONE instance for three weeks (`Sphere II`,
     * 2026-08-28) and this batch adds TWO** (this and `Dancing Quader`), so **there is no pair of timestamps to
     * compare here and asking "which export settled" is the wrong question** — shapes 3 and 4's whole
     * ambiguity is absent, and the only file name on record is this one. Do not go looking for a second
     * download. The by-product is that this pair measures the re-key/paste `sliderBaseFilmLook` divide with
     * both halves in one sitting: the anchor keeps `'Neon'`, this body has none.
     *
     * **What it is: the anchor's grade rebuilt around a LIQUID SURFACE.** `renderMode` → **`liquid`**, a whole
     * `Liquid` material (`splatRadius` 18, `velocityStretch` 0.85, `emissionIntensity` 1.5,
     * `falloffExponent` 1.6, `heatMode: 'velocity'`, `blendMode: 'additive'`, `colourRamp: 'liquid'`), a whole
     * `overlay.liquid` block, `speedFactor` **0.8**, `transMapEnabled` explicitly **false**, and the grade
     * pushed to `bloomIntensity` 1.4 at `bloomThreshold` 0.35 with `depthSize` 0.45 / `depthBrightness` 0.25.
     * 54 differing leaves against the pending body, most of them the export's runtime-default blocks.
     *
     * ⚠️ **THE NAME IS EARNED BY TWO LEAVES THAT ARE BOTH LIBRARY MINIMA, AND THEY ARE ONE DECISION.**
     * Measured 2026-09-17 across all SEVEN TS groups — 240 bodies, of which 16 carried an `overlay.liquid`
     * block before this one and 17 now; ⚠️ **every figure in this comment was RE-RUN on that basis after a
     * sibling census turned out to have omitted `CHAIN_PRESETS` (see `Penta Star Eternal Flow`), and all of
     * them survived** — no liquid body lives in that group. **A shared basis error does not fail everywhere,
     * which is exactly why it survives**: re-run the census, do not reason about which figures it could have
     * touched. `isoLevel`
     * **0.0811** undercuts the previous lowest (`Pipes Art`, 0.1272) and `kernelWidth` **1.41** undercuts
     * `Pigment Sheet`'s 1.48 — **a low threshold over a narrow kernel is a thin, barely-connected sheet that
     * stretches and snaps rather than a blob**, which is what the name describes. ⚠️ **`kernelWidth` moves
     * `R`, which is BOTH terms of the density reference** (`setLiquidConfig` resets the smoothed reference for
     * exactly this reason), so the two are not independently tunable — **re-fit the pair or neither**, and do
     * not read either figure as a margin the surface has to spare.
     *
     * ⚠️ **AND IT IS THE LIBRARY'S FIRST `tintSource: 'palette'` — WHICH IT REACHES THROUGH THE SHADER'S
     * FALLBACK, NOT THROUGH A PALETTE.** Measured over the same 16: `preset` ×9, `dye` ×4, `ramp` ×3,
     * **`palette` ×0 before this body**. But the grade sets `palette: 'none'` (the anchor's `Neon` was
     * dropped), so `paletteEnabled` is false, `uLiquidSurfPaletteEnabled` is 0, and the shader's
     * `if (uTintSource == 1 && uPaletteEnabled == 1)` branch is not taken — the surface tints from **`uTint`,
     * the figure's CPU-resolved MEAN colour**, i.e. the same value `tintSource: 'preset'` uses. ⚠️ **So the
     * frame the owner approved is the `'preset'` picture, and the stored word is a latent instruction**: pick
     * any palette on the Visual FX tab and this surface's colour changes mode, not merely hue. **Do not
     * "correct" either leaf** — a hand-tuned preset the owner accepted outranks any rule, and both readings
     * are legitimate; it is recorded so a coverage census of `tintSource: 'palette'` does NOT count this body
     * as a demonstration of the palette path. ⚠️ **Note the asymmetry that makes this possible: `'material'`
     * and `'dye'` degrade to `'ramp'` on the CPU in `effSource`, and `'palette'` has NO CPU degrade at all** —
     * its fallback lives only in the shader, so nothing on the CPU side can report the source as unreachable.
     *
     * Everything else follows the 16's consensus rather than departing from it: `surfaceRamp: 'liquid'` (all
     * 16), `mixModel: 'light'` (13 of 16), `colourMix` 0.85, `thickness` 0.5, `refraction` 0.25, `specular`
     * 1.6, `edgeBrightness` 0.6, `edgeSoftness` 0.39. It is the **fourth** body on a `Liquid` material
     * (`Hypno Penta`, `Hypnosis II`, `Liquid Mandala`) and the **thirteenth** at `splatRadius` ≥ 15.
     * ⚠️ **`splatRadius` 18 under `renderMode: 'liquid'` is not the point-path size** — the accumulation pass
     * is what builds the density field the iso-level then cuts, so a large radius here buys surface CONTINUITY,
     * which is what lets an `isoLevel` of 0.08 hold together at all. The two are the same decision as the
     * kernel width; see *Particle size*' five-paths note before changing any of them.
     */
    preset: {
      metadata: {
        name: 'Rubber Penta Spirals',
        version: 2,
        designResolution: { width: 100, height: 100 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.2],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 25, frequency: 3 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 18,
                am: { base: 0, amplitude: 25, frequency: 3 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 80, frequency: 10 },
                fm: { base: 0, amplitude: 5, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 12.5, amplitude: 12.5, frequency: 10 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 3.6,
                am: { base: 12.5, amplitude: 12.5, frequency: 10 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 3.125, amplitude: 3.125, frequency: 15 },
                fm: { base: 625, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0.144,
                am: { base: 3.125, amplitude: 3.125, frequency: 15 },
                fm: { base: 625, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.617283950617284, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.8,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Liquid',
          splatRadius: 18,
          coreBrightness: 1.3,
          haloStrength: 1,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 0.92,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.85,
        },
        liquid: {
          isoLevel: 0.0811,
          kernelWidth: 1.41,
          edgeSoftness: 0.39,
          tintSource: 'palette',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'light',
          refraction: 0.25,
          specular: 1.6,
          thickness: 0.5,
          edgeBrightness: 0.6,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.45,
          depthBrightness: 0.25,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.35,
          bloomIntensity: 1.4,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.66,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'none',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Penta Star System',
    name: 'Penta Star Eternal Flow',
    /**
     * **Penta Star Eternal Flow** — the hand-tuned variant of `Penta Star System`, kept in ADDITION to it
     * (2026-09-17, third batch, the user request: *"Add `Penta Star System new_20260917_155608.json` as
     * `Penta Star Eternal Flow`"*), spawned by the review that settled its anchor. Imported from that export
     * and kept VERBATIM; only `metadata.name` was changed, from the export value `Penta Star System new`.
     *
     * **Arrival shape 4** — two exports bearing ONE name, the ` new` one: `…_155329.json` settled the pair and
     * `…_155608.json` is this body, **2 min 39 s apart**, the LATER one becoming the variant. ⚠️ **That shape
     * had exactly one instance before this (`Hypno Penta II`, 2026-09-13), and its awkwardness applies in full:
     * BOTH file names name `Penta Star System new`, a key that ceased to exist the moment the settle landed**,
     * so neither file resolves against anything in the shipped library and **only the timestamps tell them
     * apart** — which is why both are written down here and in the anchor.
     *
     * ⚠️ **THE TWO EXPORTS DIFFER BY ELEVEN LEAVES AND NOTHING ELSE, WHICH MAKES THIS THE LIBRARY'S CLEANEST
     * CONTROLLED DEMONSTRATION OF A FIELD SYSTEM.** Diffed directly against the settle export rather than
     * against the pending body: the grade, the material, the generators, the renderer and the clock are
     * **leaf-for-leaf identical**, and the eleven are the whole `overlay.fluidFeedback` block (`persist` 0.92,
     * `amplify` 2, `fieldDecay` 0.956, `dispersion` 0, `glowBoost` 0) plus a two-layer `transMapChain`
     * `[style 2 @ 1, style 6 @ 0.3]`. ⚠️ **Diff the variant against the SETTLE export, never against the
     * pending body** — the 43-leaf figure that comes out of the latter is dominated by the export's
     * runtime-default blocks and by the settle's own retune, and it hides exactly this result. Compare
     * `Aizawa Particle Swarm`, whose two leaves do the same job for an attractor.
     *
     * ⚠️ **THE TWO HALVES ARE ONE FEATURE, NOT TWO: `fluidFeedback` IS STYLE 6'S PER-LAYER BLOCK.** Adding the
     * block without a style-6 layer in the chain configures a warp that never runs. Measured 2026-09-17 across
     * **all SEVEN TS groups**, all **12** bodies carrying a `fluidFeedback` block reach style 6 — eleven
     * through a chain layer and **`Material Fog` through the SCALAR `transMapStyle: 6` with an EMPTY chain**,
     * which is the two-homes rule again in its per-layer form: ⚠️ **"does this body run style 6" must query the
     * chain AND the scalar**, or a single-style user reads as unconfigured.
     * **This body is the twelfth carrier and the eleventh chain user.**
     * ⚠️ **THE FIGURES IN THIS COMMENT WERE WRONG BY ONE UNTIL RE-MEASURED, AND THE CAUSE IS WORTH MORE THAN
     * THE CORRECTION: the census had been run over "the six TS groups" and there are SEVEN**
     * (`REFINED` 176, `VARIANT` 24, `FIRE` 5, `FLOW` 5, `SHOWCASE` 3, `CHAIN` 3, `DEMO` 24 = 240 bodies).
     * `CHAIN_PRESETS` is the small one and it is easy to drop, yet it is the group most likely to hold the
     * extreme value of any chain census — here `Fluid Cosmos`, which this comment originally missed on three
     * separate counts. ⚠️ **Enumerate the group map before running a preset census, and state the body total
     * (240) so the basis is checkable** — a figure quoting "six groups" is a figure with a known omission.
     * ⚠️ **TWO converse traps exist, not one, and they fail differently.** `Mandelbrot River` carries the block
     * with every chain layer DISABLED *and* `transMapEnabled: false` — authored and inert. **`Fluid` is the
     * subtler one: its chain is ENABLED and `transMapEnabled` is `true`, but the style-6 LAYER itself is
     * `enabled: false`** while its sibling style-0 layer runs. So "this body's TransMap is on" says nothing
     * about style 6, and a census must read the LAYER's own `enabled`, not the block's or the preset's.
     *
     * ⚠️ **ITS STYLE PAIR IS A FIRST; ITS WEIGHT IS A SECOND — AND THE DIFFERENCE MATTERS.** Re-measured
     * 2026-09-17 over all seven groups: **19 multi-layer chains existed before this batch**, with pairs `0+6`
     * ×6, `3+6` ×2, `0+7` ×2, `0+9` ×2, `4+7`, `3+5`, `2+11`, `3+7`, `5+9`, `3+4`, plus the library's one
     * THREE-layer chain `0+4+6` (`Mandelbrot River`) — so **`2+6` is genuinely new**, and `Dancing Quader`'s
     * `0+10` in the same batch makes 21.
     * ⚠️ **But `6 @ 0.3` is NOT the first fractional style 6 — `Fluid Cosmos` ships `6 @ 0.03`**, ten times
     * lower, and this comment claimed the opposite until the missing `CHAIN` group was restored to the census.
     * The full pre-batch list of weight-≠-1 LAYERS is SIX, not five: `Nova2` 7@0.21, **`Fluid Cosmos` 6@0.03**,
     * `Kaleido Fractal Feedback` 4@0.55, `Chain Warp Refract` 0@0.6 *and* 7@0.8, `Chain Zoom Fractal` 4@0.5 — six layers
     * across five bodies, since one body carries two. ⚠️ **So state whether a chain figure counts LAYERS or
     * BODIES**: those two numbers differ here and the words "5 chain layers" were doing duty for both.
     * `6 @ 0.3` is therefore the **seventh** fractional layer overall and the **second** fractional style 6.
     * ⚠️ **Read the weight as the thing that makes the look "eternal flow" rather than a smear** — a third of
     * the feedback warp over a full style-2 base — and note that the two fractional style-6 weights sit at
     * opposite ends (0.03 a trace, 0.3 a third), so **there is no house value for this control and the range
     * between them is unexplored.** Remember too that `Chain Mix` 0 is not the same as `Enable` off (`uMix`
     * scales only the summed offset), so a later "the chain does nothing, disable it" tidy-up would change the
     * frame.
     *
     * The settle's own retune shows through this body too, since the two exports share it: `exposure` 0.72 →
     * 0.9, `glow` 5 → 5.5, `bloomThreshold` 0.35 → 0.2, `depthSize` 0.3 → 0.4, `depthBrightness` 0.2 → 0.25
     * and `renderer.decayFactor` 0.98765 → **0.99**. ⚠️ **`decayFactor` 0.99 is a LONG trail** (7 bodies ran it
     * before this batch) and it is what a feedback field needs to accumulate — so that leaf belongs to the
     * anchor by provenance and to this variant by function. **Do not revert it here in isolation.**
     * `sliderBaseFilmLook: 'Holographic'` is dropped, as every pasted body drops it (see the anchor).
     */
    preset: {
      metadata: {
        name: 'Penta Star Eternal Flow',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'cosmic'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 0, amplitude: 18.75, frequency: 5 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 18.75, frequency: 5 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 18.75, frequency: 5 },
                fm: { base: 625, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 9.375, amplitude: 9.375, frequency: 10 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 18,
                am: { base: 9.375, amplitude: 9.375, frequency: 10 },
                fm: { base: 5, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 18.75, frequency: 1 },
                fm: { base: 0, amplitude: 25, frequency: 0.5 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 4.6875, amplitude: 4.6875, frequency: 15 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 3.6,
                am: { base: 4.6875, amplitude: 4.6875, frequency: 15 },
                fm: { base: 25, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.1, 0.1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.99, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[-0.1, 0, 0, 0], [0, 0, 0, 0], [-0.1, 0, 0, 0], [0, 0, 0, 0]],
          sinMagicParams2: [[1, 0, 0, 0], [8, 0, 0, 0], [-1, 0, 0, 0], [8, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 2,
        transMapChain: [
          { style: 2, enabled: true, weight: 1 },
          { style: 6, enabled: true, weight: 0.3 },
        ],
        fluidFeedback: { persist: 0.92, amplify: 2, dispersion: 0, fieldDecay: 0.956, glowBoost: 0 },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0.4,
          depthBrightness: 0.25,
          depthDof: 0.5,
          depthColorShift: 1,
          lightingMode: 3,
          lightDir: [0.4, -0.6, 0.7],
          rimPower: 1.8,
          bloomEnabled: true,
          bloomThreshold: 0.2,
          bloomIntensity: 0.45,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.9,
          lift: [0.01, 0.01, 0.02],
          gamma: [1, 1, 1.05],
          gain: [1, 1.05, 1.1],
          saturation: 1.5,
          vignette: 0.1,
          palette: 'Aurora',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Quader',
    name: 'Dancing Quader',
    /**
     * **Dancing Quader** — the hand-tuned variant of `Quader`, kept in ADDITION to it (2026-09-17, third batch,
     * the user request: *"Add `Quader new_20260917_162443.json` as `Dancing Quader`"*), spawned by the review
     * that settled its anchor. Imported from that export and kept VERBATIM; only `metadata.name` was changed,
     * from the export value `Quader new`.
     *
     * **Arrival shape 1**, like `Rubber Penta Spirals` earlier in the same batch — a ` new` export whose anchor
     * settled by a pure RE-KEY, so there is no settle export and no second timestamp. See that entry; the two
     * of them take shape 1 from one instance to three.
     *
     * ⚠️ **TWO LEAVES CARRY THE WHOLE VARIANT, AND THE SECOND ONE IS THE LIBRARY'S SECOND VORTEX EVER.**
     * `customFilmLookParams.palette` `Neon` → **`Prismatic`** and a two-layer `transMapChain`
     * `[style 0 @ 1, style 10 @ 1]` with a `vortex` block (`swirl` **0.53**, `radius` 0.4, centre 0.5/0.5,
     * `falloff: 'gaussian'`). 38 differing leaves against the pending body, every other one of them the
     * export's runtime-default noise. Measured 2026-09-17 across **all seven TS groups (240 bodies — see
     * `Penta Star Eternal Flow` for why "six" is the wrong basis and what it cost)**: **style 10 had exactly ONE
     * user** — `High Frequency II`, as a SINGLE-layer chain — so this is the second, **the first to run the
     * vortex in combination with another style**, and `0+10` is a new pair among the **19** multi-layer chains
     * that existed before this batch.
     *
     * ⚠️ **AND COMPARING THE TWO VORTEX USERS SAYS SOMETHING ABOUT THE CONTROLS, NOT ONLY ABOUT THE PRESETS:
     * three of the four vortex fields are IDENTICAL across both** (`radius` 0.4, centre 0.5/0.5, gaussian) and
     * only `swirl` differs (0.35 vs 0.53). **So `swirl` is the only vortex field that has ever varied in a
     * shipped body** — the geometry has never been moved off its default by anyone. Read that as a gap in the
     * demonstrations rather than as evidence the other three don't matter: a `radius` or an off-centre
     * `centre` is exactly what would show the falloff doing anything, and **a checker cannot notice a field no
     * preset has ever moved.** ⚠️ **Do not "simplify" the block to its swirl** on that evidence.
     * ⚠️ **The vortex DOES count toward `needsWarp`** (unlike styles 8, 9 and 11), so this body pays for the
     * warp pass, and it is NOT exempt from the `1 − attractorBlend` fade (style 6 is the one exempt style) —
     * with `attractorIndex: -1` here that fade is at its identity, but a later attractor would move the
     * vortex's strength as a side effect. **Say that before changing the attractor, not after.**
     *
     * `palette: 'Prismatic'` makes seven users (`Blue Planes`, `Deep Thought2`, `Dream Flash`,
     * `I Am The Voice Of Energy`, `Jupiter Spot`, `Vertical Attraction new`). ⚠️ **It also shadows the legacy
     * colour law, exactly as the anchor's `Neon` does** — precedence is palette > material ramp > preset colour
     * — so this variant does NOT restore `Quader`'s near-singleton `ColorBase`/`ColorAmp` signature; the anchor's
     * comment names the two carriers that keep it live. `renderMode` stays **`star`** and there is no material,
     * so the anchor's plain figure is what the vortex twists — which is the reason the pair reads as one
     * decision: **`Quader` is one of the three low-accumulation presets `CLAUDE.md` names as the judging
     * surface for a shape or grading change, and this variant keeps that property while adding the warp.**
     * `sliderBaseFilmLook: 'Neon'` is dropped, as every pasted body drops it.
     */
    preset: {
      metadata: {
        name: 'Dancing Quader',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [0, 0.2, 0.3],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 24, amplitude: 0, frequency: 0 },
                fm: { base: 21, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 24, amplitude: 0, frequency: 0 },
                fm: { base: 21, amplitude: 0, frequency: 0 },
              },
              {
                phase: 90,
                am: { base: 24, amplitude: 0, frequency: 0 },
                fm: { base: 0.5, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 4, amplitude: 6, frequency: 63 },
                fm: { base: 63, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 4, amplitude: 6, frequency: 60 },
                fm: { base: 63, amplitude: 0, frequency: 0 },
              },
              {
                phase: 90,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 96, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 1, amplitude: 1, frequency: 63 },
                fm: { base: 105, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 1, amplitude: 1, frequency: 60 },
                fm: { base: 105, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [21, 21, 21],
        colorAmp: [64, 32, 32],
        colorFreq: [0, 0.1, 1],
        colorShift: [1, 2, 3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.617283950617284, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[10, -10, 5, -5], [0.1, 0.101, 0.505, 0.5], [10, -10, 5, -5], [0.1, 0.101, 0.505, 0.5]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1 },
          {
            style: 10,
            enabled: true,
            weight: 1,
            vortex: {
              swirl: 0.53,
              radius: 0.4,
              centre: { x: 0.5, y: 0.5 },
              falloff: 'gaussian',
            },
          },
        ],
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Prismatic',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Rippled Rays Of Light 2',
    name: 'Rippled Rays Of Light 3',
    /**
     * **Rippled Rays Of Light 3** — an ADDITIONAL preset beside `Rippled Rays Of Light 2`, not a replacement
     * (2026-09-18: *"Add `Rippled Rays Of Light 2 new v2_20260918_105058.json` as `Rippled Rays Of Light
     * 3`"*).
     *
     * Imported from that export and kept VERBATIM: this object is exactly what `Import` hands
     * `MigrationLayer.migrate`. Only `metadata.name` was changed, from the export's `Rippled Rays Of Light 2
     * new v2`. Its anchor was settled in the SAME batch (`refined-presets.ts`), so the anchor has no ` new`
     * sibling and this lands in the next slot.
     *
     * ⚠️ **The name is the third member of a FAMILY, not a `II` sibling, so `name.startsWith(after)` is FALSE
     * for it** (the anchor is `Rippled Rays Of Light 2` and this is `… 3`). It joins the header's
     * word-overlap-only class rather than its prefix class — one more reason `after` is the only
     * machine-readable link.
     *
     * What distinguishes it from the settled anchor: a **two-layer TransMap chain** — Zoom Overlay (style 2)
     * plus **Fluid Feedback (style 6)**, both `enabled` at `weight: 1` — with a `fluidFeedback` block
     * (`persist` 0.95, `fieldDecay` 0.981, `amplify` 1, `dispersion` 0, `glowBoost` 0); the `LiquidLight`
     * material back on a `splat` at `splatRadius` **2** / `haloStrength` **0** / `velocityStretch` 0.54; the
     * `Ocean`-by-`position` depth-lit grade (`depthSize` 0.9, `depthDof` 0.9, `lightingMode` 2, `rimPower` 5,
     * `vignette` 0.25, `exposure` 1.27); and `decayFactor` 0.94 (17 frames) against the anchor's
     * 0.9876543209876544 (81).
     *
     * ⚠️ **The chain layer and the block are ONE authored pairing, and `main.ts`:4792 is why**: the export
     * gate emits `fluidFeedback` only `if (chainHasLayerFor(6))`, so deleting the style-6 layer would silently
     * drop the whole block from the NEXT export of this preset. Measured 2026-09-18 over the composed library,
     * eleven presets carried a style-6 chain layer and twelve a `fluidFeedback` block before this addition —
     * `Material Fog` is the one with a block and no layer, i.e. the case the gate produces.
     *
     * ⚠️ **Style 6 is the ONE TransMap style exempt from the `1 − attractorBlend` fade** (`CLAUDE.md` →
     * *TransMap*), so this preset's two layers do not respond to the attractor blend the same way — do not
     * "fix" the asymmetry.
     */
    preset: {
      metadata: {
        name: 'Rippled Rays Of Light 3',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'water'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 15000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0.5],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 15, amplitude: 15, frequency: 1 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 15, amplitude: 15, frequency: 2 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 15,
                am: { base: 15, amplitude: 15, frequency: 3 },
                fm: { base: 6, amplitude: 0, frequency: 10 },
              },
              {
                phase: 0,
                am: { base: 15, amplitude: 15, frequency: 4 },
                fm: { base: 6, amplitude: 0, frequency: 10 },
              },
              {
                phase: 0,
                am: { base: 100, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 3, frequency: 1 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.2, 0.3, 0.1],
        colorShift: [0.5, 0.11, 0.13],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.94, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[0.1, 0, 0, 0], [16, 0, 0, 0], [0.1, 0, 0, 0], [16, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 0, y: 0 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 2,
        transMapChain: [{ style: 2, enabled: true, weight: 1 }, { style: 6, enabled: true, weight: 1 }],
        fluidFeedback: { persist: 0.95, amplify: 1, dispersion: 0, fieldDecay: 0.981, glowBoost: 0 },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'LiquidLight',
          splatRadius: 2,
          coreBrightness: 1.3,
          haloStrength: 0,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 0.92,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.54,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.9,
          depthBrightness: 0.7,
          depthDof: 0.9,
          depthColorShift: 0.2,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 5,
          bloomEnabled: true,
          bloomThreshold: 0.45,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.27,
          lift: [0, 0.02, 0.05],
          gamma: [1, 1.05, 1.1],
          gain: [0.94, 0.98, 1.04],
          saturation: 0.75,
          vignette: 0.25,
          palette: 'Ocean',
          paletteMapping: 'position',
        },
      },
    },
  },
  {
    after: 'Solar Fusion',
    name: 'Solar Fusion II',
    /**
     * **Solar Fusion II** — the SECOND hand-tuned export of `Solar Fusion` from the same sitting, added
     * beside the settle at the owner's request (2026-09-19: *"Add `Solar Fusion new_20260918_165044.json` as
     * `Solar Fusion II`"*). Imported VERBATIM: this object is exactly what `Import` hands
     * `MigrationLayer.migrate`, so it behaves identically to re-importing that file. Only `metadata.name` was
     * changed, from the export's `Solar Fusion new` to this entry's own name.
     *
     * ⚠️ **Two exports of one preset arrived four minutes apart** — 16:46:36 settled the pair
     * (`refined-presets.ts`, `Solar Fusion`) and 16:50:44 is this one — the arrival shape
     * `Dual Spiral Wind II` established, **so `Solar Fusion`'s settle cost the library nothing.**
     *
     * What distinguishes it from the settled `Solar Fusion`: **a different renderer entirely.** That one is
     * `splat` with the `Fire` material; this one is **`liquid`** with the `Liquid` material and a full
     * `overlay.liquid` block (`isoLevel` 1.4389, `kernelWidth` 1.95, `edgeSoftness` 0.15, `tintSource`
     * `material`, `refraction` 0.25, `specular` 0.8, `edgeBrightness` 0.6), **sparks enabled** (pool 450,
     * `ejectionSpeed` 0.4, gravity 150, up to 26 per frame), a `cohesion` block (strength 0.52, radius 64,
     * `returnForce` 2.95) and `particleSize` 1.74. Its grade keeps bloom (threshold 0.15, intensity 0.65)
     * where the settle switches bloom AND the tone map off, and `decayFactor` is 0.797 against 0.86. Both
     * share the palette `Material: fire` by `temperature`.
     *
     * ⚠️ **`liquid` is the ONE mode a material does not override** (`resolveModeAgainstMaterial()`), so
     * the `Liquid` material and `renderMode: 'liquid'` agree here by construction rather than by luck. It is
     * also the library's only occluding mode, which makes this variant the one place `Solar Fusion`'s figure
     * is read as a surface instead of as additive splats — so judge the two side by side on the SAME preset
     * name in the Preview grid, where the difference is the point.
     */
    preset: {
      metadata: {
        name: 'Solar Fusion II',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'fire'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 20, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 1, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 2, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 100, amplitude: 3, frequency: 1 },
              },
            ],
          },
        ],
        colorBase: [224, 96, 32],
        colorAmp: [32, 96, 32],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.797, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [[0.5, -1, 0, 0], [10, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 0.5,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'liquid',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapForceReturn: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.5,
        figureScale: 1,
        particleSize: 1.74,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Liquid',
          splatRadius: 4.5,
          coreBrightness: 1.3,
          haloStrength: 0.2,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 2.4,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.66,
        },
        sparks: {
          enabled: true,
          poolSize: 450,
          threshold: 0.5,
          ejectionSpeed: 0.4,
          gravity: 150,
          drag: 3,
          minLifetime: 0.2,
          maxLifetime: 0.8,
          coolingRate: 3,
          splatRadius: 3,
          maxSparksPerFrame: 26,
        },
        liquid: {
          isoLevel: 1.4389,
          kernelWidth: 1.95,
          edgeSoftness: 0.15,
          tintSource: 'material',
          surfaceRamp: 'liquid',
          colourMix: 1,
          mixModel: 'light',
          refraction: 0.25,
          specular: 0.8,
          thickness: 0.5,
          edgeBrightness: 0.6,
        },
        cohesion: { strength: 0.52, radius: 64, returnForce: 2.95 },
        customFilmLookParams: {
          glow: 5,
          depthSize: 0.25,
          depthBrightness: 0.15,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.65,
          toneMapEnabled: false,
          toneMapCurve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'Material: fire',
          paletteMapping: 'temperature',
        },
      },
    },
  },
  {
    after: 'The Masters Light',
    name: 'The Masters Light II',
    /**
     * **The Masters Light II** — the hand-tuned variant of `The Masters Light`, kept in ADDITION to it
     * (2026-09-19: *"Add `The Masters Light new_20260919_150158.json` as 'The Masters Light II'"*).
     *
     * Imported from that export and kept VERBATIM, so it behaves identically to re-importing the file; only
     * `metadata.name` was changed, from the export's `The Masters Light new` to this entry's own name.
     *
     * ⚠️ **ARRIVAL SHAPE 2** (see this file's header): the ` new`-named export became the VARIANT and a
     * PLAIN-named one settled the anchor — `The Masters Light_…150449.json`, exported **2 min 51 s LATER**.
     * That takes shape 2 from four instances to five. ⚠️ **Note what it is NOT**: shape 4 needs BOTH files to
     * bear the ` new` name, and here they differ, so the ambiguity shape 4 warns about is absent — but only
     * because the files were opened. **Do not infer the roles from the names**; the earlier file is the variant
     * here, which is the OPPOSITE of shape 4's three-for-three record.
     *
     * What distinguishes it from `The Masters Light`, measured export against export — **22 changed,
     * 4 added, 0 removed**, and the split is the point: the anchor's settle FLATTENED the refinement's grade
     * and this variant KEEPS it. A **two-layer TransMap chain** (the shared Zoom Overlay, style 2, plus
     * **Depth Parallax 11** at `amount` 0.44, `nearScale` 1.55 / `farScale` 2.65, `depthRange` `figure`)
     * with `transMapDispersion` 0.22; the depth block alive (`depthSize` 0.3, `depthBrightness` 0.2,
     * `depthDof` 0.5, `depthColorShift` 1), `lightingMode` 3, `rimPower` 1.8, a graded
     * `lift`/`gamma`/`gain` (`[0.01, 0.01, 0.02]` / `[1, 1, 1.05]` / `[1, 1.05, 1.1]`), `saturation` 1.5,
     * `vignette` 0.1, `exposure` 1.7 against the anchor's 2.3 — and an `Aurora` palette on BOTH channels
     * (`overlay.palette` and the grade's own) where the anchor carries `Cycle: Embers`/`none`.
     * Its `curlNoise` is inert either way (`enabled: false`), and `fluidAdvection.returnForce` 0.5 against
     * the anchor's 2.8 is likewise inert at `blend` 0.
     *
     * ⚠️ **It is the library's second legacy-slot preset carrying a chain**, after `Sphere II`, and the second
     * to exercise 14.7/14.7b's Depth Parallax — but on an 81-frame trail rather than `Sphere`'s crisp splats,
     * so it is the first body where the parallax is judged THROUGH accumulation.
     */
    preset: {
      metadata: {
        name: 'The Masters Light II',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'aurora'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 15000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [30, 30, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 12, amplitude: 12, frequency: 1 },
                fm: { base: 21, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 12, amplitude: 12, frequency: 1.23 },
                fm: { base: 21, amplitude: 0, frequency: 0 },
              },
              {
                phase: 90,
                am: { base: 24, amplitude: 0, frequency: 0 },
                fm: { base: 0.5, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 4, amplitude: 6, frequency: 63 },
                fm: { base: 63, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 4.0000005, amplitude: 6, frequency: 60 },
                fm: { base: 63, amplitude: 0, frequency: 0 },
              },
              {
                phase: 90,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 96, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [21, 21, 21],
        colorAmp: [64, 32, 32],
        colorFreq: [0, 0.1, 1],
        colorShift: [1, 2, 3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.9876543209876544, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [[0.1, 0, 0, 0], [-8, 0, 0, 0], [0.1, 0, 0, 0], [8, 0, 0, 0]],
          sinMagicParams2: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
          zoomCenter: { x: 66, y: 33 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Aurora',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 2,
        transMapChain: [
          { style: 2, enabled: true, weight: 1 },
          {
            style: 11,
            enabled: true,
            weight: 1,
            parallax: {
              amount: 0.44,
              nearScale: 1.55,
              farScale: 2.65,
              curve: 'linear',
              depthRange: 'figure',
              rangeFrom: 0,
              rangeTo: 1,
            },
          },
        ],
        transMapDispersion: 0.22,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0.3,
          depthBrightness: 0.2,
          depthDof: 0.5,
          depthColorShift: 1,
          lightingMode: 3,
          lightDir: [0.4, -0.6, 0.7],
          rimPower: 1.8,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.45,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.7,
          lift: [0.01, 0.01, 0.02],
          gamma: [1, 1, 1.05],
          gain: [1, 1.05, 1.1],
          saturation: 1.5,
          vignette: 0.1,
          palette: 'Aurora',
          paletteMapping: 'phase',
        },
      },
    },
  },
  {
    after: 'Transmission',
    name: 'Transmission II',
    /**
     * **Transmission II** — the hand-tuned variant of `Transmission`, kept in ADDITION to it
     * (2026-09-19, seventh settle batch: *"Add `Transmission_20260919_183627.json` as 'Transmission II'"*).
     *
     * Imported from that export and kept VERBATIM, so it behaves identically to re-importing the file; only
     * `metadata.name` was changed — the export bore `Transmission`, the ANCHOR's own name, so pasting it
     * unaltered would have collided with the settle landing in the same batch.
     *
     * ⚠️ **ARRIVAL SHAPE 3** (see this file's header): two exports bearing ONE name, the anchor's PLAIN one -
     * `Transmission_...183352.json` settled the pair and `..._183627.json`, **2 min 35 s LATER**, ships here.
     * That takes shape 3 from seven instances to eight and **its split from 4-3 to 4-4, exactly even**: the
     * EARLIER export settled this time. ⚠️ **With the split now tied, the header's refusal to predict "which
     * export settled" is no longer a caution about a thin majority — there is no majority left to lean on.**
     * ⚠️ **It also ENDS four consecutive denominator-only moves** (the third, second-of-2026-09-17,
     * 2026-09-18 and 2026-09-19 batches each added variants of other shapes while this one stood still), so
     * this is the first sitting since 2026-09-17's second batch where shape 3's NUMERATOR moves. A share that
     * had only ever fallen rose, and nothing about the shape changed either time — which is the argument for
     * counts over a named denominator, made from the other direction.
     *
     * What distinguishes it from `Transmission`, measured export against export — **0 changed, 18 added,
     * 0 removed**. ⚠️ **No other entry in this file has a 0-changed diff** (the recorded figures are 22, 21,
     * 22, 8, 2, 2 and 1), so the two bodies are byte-identical everywhere they overlap and the variant is a
     * PURE ADDITION: same 75×60 design box, same 20000 `lissajous` particles, same 80/81 trail, same
     * `Cycle: Neutral`/`index` palette, same `Legacy Graded` look. **Judge it only on what the 18 leaves do.**
     *
     * The 18 are ONE feature in two blocks, not two features:
     *   — an **11-field three-layer TransMap chain** — `Wave Shift` (style 0, the anchor's own style, weight 1),
     *     `Procedural Flow` (style 5, weight 1) and `Band Split` (style 9, weight 1, `bandSplit` `amount` 0.64 /
     *     `radius` 7.5). ⚠️ **`TRANS_MAP_STYLES` is the one style enumeration — read a style's name there,
     *     never off its number.** Style 9 is a `weightless` MODIFIER with `requiresField`, and style 5 supplies
     *     that field, so the layer order is load-bearing rather than cosmetic.
     *   — style 5's own **7-field `overlay.proceduralFlow` block** (`strength` 0.3, `scale` 1.5, `curlAmount`
     *     0.5, `direction` `[0, -1]`, `radial` 0, `evolutionSpeed` 0.8, `archetype` `Gentle Drift`). ⚠️ **This
     *     is style 5's per-style parameter block, NOT a force field** (`trans-map-chain.ts`' `style === 5`
     *     branch owns it, and `main.ts` exports it only when the chain has a layer for 5) — so counting it as a
     *     second feature would double-count one layer. Every force field in this body is still at zero, exactly
     *     as in the anchor.
     *
     * ⚠️ **Nothing here is novel to the library** — `proceduralFlow` reaches 13 bodies with this one, chains
     * 42, and styles 5, 9 and the `bandSplit` block 3 each. **What is new is the COMBINATION**, which is also
     * the only thing the 0-changed diff leaves to judge: the pair is a controlled A/B of a three-layer chain
     * over one fixed body, and it is the cleanest such comparison in the library.
     *
     * ⚠️ **The export carries NEITHER provenance witness** (no `metadata.createdWith`, no `metadata.tags`),
     * like the anchor's settle export from the same sitting — so both halves were taken from the LEGACY origin
     * rather than from a generated refined body, and the variant has no `sliderBaseFilmLook` to lose. That
     * moves `refined-presets.ts`' header count of variants on the legacy route from 8 of 27 to 9 of 28 — **the
     * NUMERATOR's first move since 2026-09-17**, where the four batches since had only moved the denominator.
     */
    preset: {
      metadata: {
        name: 'Transmission II',
        version: 2,
        designResolution: { width: 75, height: 60 },
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 22, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 13.2, amplitude: 0, frequency: 0 },
                fm: { base: 1, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 7.5,
                am: { base: 6, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 5 },
              },
              {
                phase: 0,
                am: { base: 3.6, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 6 },
              },
              {
                phase: 0,
                am: { base: 4.6285715, amplitude: 0, frequency: 0 },
                fm: { base: 32, amplitude: 6, frequency: 7 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.9876543209876544, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [2, 6, 10, 2],
            [12, 4, 1, 3],
            [1, 4, 10, 2],
            [8, 3, 1, 3],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1 },
          { style: 5, enabled: true, weight: 1 },
          {
            style: 9,
            enabled: true,
            weight: 1,
            bandSplit: { amount: 0.64, radius: 7.5 },
          },
        ],
        proceduralFlow: {
          strength: 0.3,
          scale: 1.5,
          curlAmount: 0.5,
          direction: [0, -1],
          radial: 0,
          evolutionSpeed: 0.8,
          archetype: 'Gentle Drift',
        },
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
      },
    },
  },
  {
    after: 'Waves',
    name: 'Waves II',
    /**
     * **Waves II** — the hand-tuned variant of `Waves`, kept in ADDITION to it (2026-09-19, EIGHTH settle
     * batch: *"Add `Waves new_20260919_190248.json` as 'Waves II' and remove 'Waves new'"*).
     *
     * Imported from that export and kept VERBATIM, so it behaves identically to re-importing the file; only
     * `metadata.name` was changed — the export bore `Waves new`, the key the same bullet DELETES.
     *
     * ⚠️ **ARRIVAL SHAPE 1** (see this file's header): one export, no settle export at all — the fourth
     * instance. ⚠️ **And the first one whose anchor did NOT settle: `Waves` is a KEEP-THE-ORIGINAL**, so the
     * anchor ships as the raw migrated 2023 body and has no `REFINED_PRESETS` entry of any kind. The three
     * earlier shape-1 anchors all settled by a pure RE-KEY, which is where the shape's stated by-product came
     * from ("the anchor keeps its base, the variant has none"); **that by-product does not hold here** — the
     * anchor never had a base to keep and the refinement's `sliderBaseFilmLook: 'Glacier'` is simply gone.
     * ⚠️ **It also breaks the header's "all entries have a settled anchor" claim**, which is why that line
     * now reads 29 of 30.
     *
     * ⚠️ **With the ` new` key deleted and the anchor left raw, THIS ENTRY IS THE ONLY PLACE THE `water`
     * REFINEMENT SURVIVES in the library.** Nothing else carries it, so do not read the pair as
     * original-versus-refinement: it is original versus owner.
     *
     * `splat` on material **LiquidLight**, 20000 particles, `designResolution` 75x75, `decayFactor` **0.94**,
     * `speedFactor` 0.3, TransMap at **style 0** (SinMagic itself) with the anchor's own warp parameters and
     * `zoomCenter` 50/50; attractors off, `curlNoise`, `physarum` and `fluidAdvection` all at zero.
     * ⚠️ **0.94 is `LiquidLight`'s `presentation.decayFactor` VERBATIM**, not a slider value — the anchor
     * carries 80/81 and the deleted refinement carried 0.94 too. **An off-lattice `decayFactor` is evidence of
     * a dropdown-applied `presentation` block rather than of a drag**, and both off-lattice decays in this
     * batch (0.94 here, 0.85 in `Who Needs A Fractal II`) are their material's own presentation value exactly.
     *
     * ⚠️ **`overlay.palette` is `Cycle: Starfield` under `index` while this body's pair
     * ([128,128,128]/[128,128,128]) reverse-looks-up to `Cycle: Neutral` — so it is an owner-AUTHORED index
     * palette and is DECLARED in `checks/palettecheck.mjs`' `AUTHORED_INDEX_PALETTES`**, naming the export;
     * without that line §C fails, reading it as a possible mis-adoption. It is only the second authored
     * override ever and ⚠️ **the first that is itself one of the nine `Cycle:` names**, so nothing about the
     * NAME distinguishes it from an adoption — only the comparison against the pair does, which is exactly why
     * that section derives the partition from the adoption's rule instead of from the name's shape. The
     * difference it buys: Starfield's `a`/`b` are (64, 64, 128)/255 against Neutral's (128, 128, 128)/255, so
     * half the red and green with the blue kept — a dimmer blue cast, which the additive material carries.
     *
     * ⚠️ **The grade's OWN `palette: 'Cool'` / `paletteMapping: 'velocity'` is INERT**: `overlay.palette`
     * wins in `resolvePaletteSelection`, so reading the grade block alone names the wrong palette AND the
     * wrong mapping. Its sibling `Who Needs A Fractal II` in this same batch has the two in agreement, which
     * is the only reason this trap is visible as a trap.
     *
     * Measured against the ANCHOR's migrated body: **2 changed, 61 added, 0 removed** — the two changes are
     * `decayFactor` 80/81 → 0.94 and the palette name, everything else being overlay the legacy body has no
     * concept of. Against the refined `Waves new` this batch deletes: **7 changed, 26 added, 1 removed**, the
     * removal being `sliderBaseFilmLook: 'Glacier'`. ⚠️ **All seven changes are presentation**: four
     * material fields (`splatRadius` **18 → 2**, `coreBrightness` 1.3 → 0.9, `haloStrength` 1 → 0,
     * `velocityStretch` 0.85 → 0.18) and three grade fields (`bloomThreshold` 0.45 → 0.5, `exposure`
     * 1.83 → 2, `saturation` 0.75 → 0.85). The nine-fold splat shrink with the halo at zero is the edit:
     * 20000 additive core-only splats instead of 18-pixel discs, paid for by more exposure and saturation.
     * ⚠️ **None of those four material values matches `LiquidLight`'s dropdown default either** (10, 1.3,
     * 0.4, 0.85), so they are the owner's own numbers and not a second `presentation` application.
     *
     * The export carries BOTH provenance witnesses (`metadata.createdWith`, `tags: ['refined', 'water']`), so
     * it was tuned from the REFINED side — which is why exactly one field is lost.
     */
    preset: {
      metadata: {
        name: 'Waves II',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'water'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 8, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 8, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.94, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [-0.15307873, 3.845027, -1.6698377, -3.9947386],
            [1.2299505, 0.5805749, -4.4140005, -2.0798867],
            [1.807366, 0.11090933, -3.6146016, 3.567134],
            [-10.814448, -7.095548, 1.8963472, -1.8059905],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: { x: 50, y: 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Starfield',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.3,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'LiquidLight',
          splatRadius: 2,
          coreBrightness: 0.9,
          haloStrength: 0,
          falloffExponent: 1.6,
          thermalLag: 0.3,
          emissionIntensity: 1.5,
          heatMode: 'velocity',
          heatGain: 0.92,
          blendMode: 'additive',
          colourRamp: 'liquid',
          velocityStretch: 0.18,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.9,
          depthBrightness: 0.7,
          depthDof: 0.9,
          depthColorShift: 0.2,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 5,
          bloomEnabled: true,
          bloomThreshold: 0.5,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2,
          lift: [0, 0.02, 0.05],
          gamma: [1, 1.05, 1.1],
          gain: [0.94, 0.98, 1.04],
          saturation: 0.85,
          vignette: 0.25,
          palette: 'Cool',
          paletteMapping: 'velocity',
        },
      },
    },
  },
  {
    after: 'Who Needs A Fractal',
    name: 'Who Needs A Fractal II',
    /**
     * **Who Needs A Fractal II** — the hand-tuned variant of `Who Needs A Fractal`, kept in ADDITION to it
     * (2026-09-19, EIGHTH settle batch: *"Add `Who Needs A Fractal new_20260919_191926.json` as 'Who Needs A
     * Fractal II'"*).
     *
     * Imported from that export and kept VERBATIM; only `metadata.name` was changed — the export bore
     * `Who Needs A Fractal new`, the pending key the same batch deletes.
     *
     * ⚠️ **ARRIVAL SHAPE 2** (see this file's header): the ` new` half of a pair whose PLAIN half settled the
     * anchor — the SIXTH instance. `Who Needs A Fractal_…190430.json` settled the anchor and this file,
     * **14 min 56 s LATER**, ships here.
     *
     * `splat` on material **Ember**, 20000 particles, `designResolution` 75x75, `decayFactor` **0.85**,
     * `speedFactor` 0.3, TransMap at **style 3, Zoom Combined** with `zoomCenter` 0/0 — the anchor's warp
     * parameters and the anchor's figure, both byte-identical to it. ⚠️ **The pair is therefore a controlled
     * A/B of PRESENTATION over one fixed figure**: `Legacy Graded` star rendering against an Ember splat with
     * three live populations, nothing in `generators` or `postProcessors` differing at all.
     *
     * ⚠️ **ALMOST THE WHOLE BODY IS `Ember`'s `presentation` BLOCK, APPLIED FROM THE MATERIAL DROPDOWN AND
     * KEPT.** Measured field by field against `MATERIAL_PRESETS`' `Ember` entry: the 21-field grade differs in
     * ONE field, the 11-field `sparks` block in NONE, the 9-field `buoyancy` block in NONE, and
     * `decayFactor` 0.85 is the presentation's own value. **The owner's edits are exactly four**:
     * `material.splatRadius` 7 → 2.5, `material.haloStrength` 0.6 → 0.3,
     * `customFilmLookParams.exposure` 1 → 2, and the crystals switched ON (the presentation ships
     * `crystals: { enabled: false }`). ⚠️ **So the three live populations are NOT three authored decisions —
     * only the crystals are. Ask what the dropdown wrote before crediting a block to the owner**, which is the
     * general form of `CLAUDE.md`'s rule that a `presentation` block applies from the dropdown handler only.
     *
     * The crystals: `dendrite`, `crystalSize` 22, `poolSize` 600, `birthRule` `slow`,
     * **`growthEnabled: true`** with `accretionRadius` 12, `stickingProbability` 0.35, `growthAnisotropy` 0.3,
     * `maxGrowth` 1.8, `accretionBudget` 8 — and **`clusterForce` 0 with `latticeSnap` 0**, so the pool grows
     * by accretion but neither clusters nor snaps to a lattice. `sparks` sits at `ejectionSpeed` **0.1**,
     * which is the TRACK MINIMUM (`min 0.1, max 3, step 0.1`) and is Ember's post-2026-09-17 re-fitted value:
     * ⚠️ **a new library body INHERITED the floor rather than choosing it**, which is the shape of evidence
     * the owed `ejectionSpeed` track decision needs.
     *
     * Colour is `Classic: ember` by `temperature`, and the grade names the SAME pair, so the two agree here —
     * the opposite of `Waves II` in this batch, whose grade palette is inert. ⚠️ **Otherwise the grade is
     * FLAT**: bloom off, tone map off, no depth block at all, `saturation` 1, `vignette` 0, `glow` 4,
     * `exposure` 2. **`filmLook: 'Customize'` does not mean "graded"** — the picture here is the material and
     * the populations.
     *
     * Measured against the settle export the anchor now carries: **6 changed, 86 added, 0 removed** — and five
     * of the six changes are the Ember dropdown's own work (`decayFactor` 80/81 → 0.85, `filmLook`
     * `Legacy Graded` → `Customize`, `palette` `Cycle: Neutral` → `Classic: ember`, `paletteMapping`
     * `index` → `temperature`, `renderMode` `star` → `splat` through `resolveModeAgainstMaterial`). **The
     * sixth, `speedFactor` 1 → 0.3, is the owner's.** Against the refined `Who Needs A Fractal new` this
     * batch deletes: **18 changed, 90 added, 1 removed**, the removal being
     * `sliderBaseFilmLook: 'Cinematic'`; seventeen of the eighteen changes are grade fields, since the
     * refinement's graded `Cinematic` look is replaced wholesale by Ember's flat one.
     *
     * The export carries BOTH provenance witnesses (`metadata.createdWith`, `tags: ['refined', 'geo']`).
     */
    preset: {
      metadata: {
        name: 'Who Needs A Fractal II',
        version: 2,
        designResolution: { width: 75, height: 75 },
        createdWith: 'refined-presets generator',
        tags: ['refined', 'geo'],
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [1, 1, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 8, frequency: 1 },
              },
              {
                phase: 0,
                am: { base: 32, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 8, frequency: 2 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
              {
                phase: 0,
                am: { base: 0, amplitude: 0, frequency: 0 },
                fm: { base: 0, amplitude: 0, frequency: 0 },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [0.1, 0.2, 0.3],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.85, blurRadius: 4, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [
            [8, 0, 0, 0],
            [6, 0, 0, 0],
            [8, 0, 0, 0],
            [4, 0, 0, 0],
          ],
          sinMagicParams2: [
            [-0.1, 0, 0, 0],
            [8, 0, 0, 0],
            [-0.1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          zoomCenter: { x: 0, y: 0 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Classic: ember',
        paletteMapping: 'temperature',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 3,
        curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
        speedFactor: 0.3,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: { blend: 0, returnForce: 0.5 },
        material: {
          preset: 'Ember',
          splatRadius: 2.5,
          coreBrightness: 2.2,
          haloStrength: 0.3,
          falloffExponent: 5,
          thermalLag: 0.45,
          emissionIntensity: 3.4,
          heatMode: 'velocity',
          heatGain: 0.7,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.8,
        },
        buoyancy: {
          enabled: true,
          strength: 1.2,
          returnForce: 2,
          turbulence: 0.5,
          maxOffset: 140,
          curlOctaves: true,
          smokeThreshold: 0.3,
          smokeOpacity: 0.45,
          smokeDissipation: 0.96,
        },
        sparks: {
          enabled: true,
          poolSize: 300,
          threshold: 0.7,
          ejectionSpeed: 0.1,
          gravity: 150,
          drag: 2,
          minLifetime: 0.2,
          maxLifetime: 0.6,
          coolingRate: 4,
          splatRadius: 2,
          maxSparksPerFrame: 4,
        },
        crystal: {
          enabled: true,
          shape: 'dendrite',
          crystalSize: 22,
          facetSharpness: 0.85,
          specularStrength: 1.5,
          iceOpacity: 0.8,
          edgeBrightness: 1.2,
          internalRefraction: 0.3,
          crystalRamp: 'ice',
          poolSize: 600,
          freezeCap: 0.6,
          birthRule: 'slow',
          slowFraction: 0.3,
          coldFraction: 0.25,
          nucleationBudget: 8,
          nucleationTime: 0.5,
          crystalLifetime: 8,
          meltTime: 1,
          meltThreshold: 0.8,
          clusterForce: 0,
          clusterForceRadius: 40,
          clusterForceReturn: 1.5,
          latticeSnap: 0,
          latticeCell: 10,
          symmetryFold: false,
          growthEnabled: true,
          accretionRadius: 12,
          stickingProbability: 0.35,
          growthAnisotropy: 0.3,
          maxGrowth: 1.8,
          accretionBudget: 8,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.8,
          bloomIntensity: 0,
          toneMapEnabled: false,
          toneMapCurve: 'none',
          exposure: 2,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0,
          palette: 'Classic: ember',
          paletteMapping: 'temperature',
        },
      },
    },
  },

  /* ── v8 Phase 30 — the five operator demos plus the combined one (30.D8 / 30.D17) ─────────────
   *
   * ⚠️ **GENERATED from each parent's own body with ONE operator applied, then committed as literals.**
   * The bodies are clones, so a demo differs from its parent in exactly the keys named in its own doc
   * block and nothing else — which is what makes an A/B against the parent an attribution rather than
   * an impression. ⚠️ **Do not hand-tune these into independent presets**: the moment a demo diverges
   * from its parent in a second field, it stops being able to answer the question it exists for.
   *
   * ⚠️ **TWO of the six carry a CONFORMAL layer, and that is a `coveragecheck` FLOOR rather than
   * taste**: every implemented TransMap style needs at least two live presets, and the checker failed
   * on `tmstyle:12 >= 2` until the combined demo took one too.
   */
  /**
   * v8 `30.7` — Pipes Twist. **Derived from `Pipes` with ONE change**, so the operator's own
   * contribution is legible against a parent you already know (`30.D17`).
   *
   * E129a. Barr twist about Z at +0.50 turns per half-extent. Pipes is the standing low-accumulation preset AND has a z/xy amplitude ratio of 0.56, so it is one of the 163 bodies twist can be SEEN on — the other 61 are flat in z and twist is bit-exactly nothing on them.
   */
  {
    after: 'Pipes',
    name: 'Pipes Twist',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Pipes Twist',
        version: 2,
        designResolution: {
          width: 75,
          height: 75,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: true,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
        twistZ: 0.5,
      },
    },
  },
  /**
   * v8 `30.7` — Pipes Chambers. **Derived from `Pipes` with ONE change**, so the operator's own
   * contribution is legible against a parent you already know (`30.D17`).
   *
   * E130. One box-fold at a 60% cell. ONE iteration and a wide cell deliberately: the Lipschitz bound multiplies with composition, and past two folds the structure stops reading as architecture. The bright creases ARE the feature — a fold is many-to-one, so density piles up at the fold planes.
   */
  /**
   * v8 `30.7` — Cylinder Conformal. **Derived from `Cylinder` with ONE change**, so the operator's own
   * contribution is legible against a parent you already know (`30.D17`).
   *
   * E125. Conformal warp, z^3 — angles about the centre are tripled, so the frame blooms into three petals while local shapes stay un-sheared. INTEGER exponent (30.D16): a fractional one would put a branch cut along one ray.
   */
  {
    after: 'Cylinder',
    name: 'Cylinder Conformal',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Cylinder Conformal',
        version: 2,
        designResolution: {
          width: 75,
          height: 100,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 3, 0],
        angle: [0, 1, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0,
        blurRadius: 0,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.13,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
        sliderBaseFilmLook: 'Neon',
        transMapEnabled: true,
        transMapChain: [
          {
            style: 12,
            enabled: true,
            weight: 1,
            conformal: {
              map: 'power',
              power: 3,
            },
          },
        ],
      },
    },
  },
  /**
   * v8 `30.7` — Pipes Timescan. **Derived from `Pipes` with ONE change**, so the operator's own
   * contribution is legible against a parent you already know (`30.D17`).
   *
   * E126. Time Warp on the COORDINATE source, x axis — the lag varies across the frame, so one side shows a smeared past and the other shows now. A temporal GRADIENT rather than distinct instants (30.D2): the history is one frame blended recursively.
   */
  {
    after: 'Pipes',
    name: 'Pipes Timescan',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Pipes Timescan',
        version: 2,
        designResolution: {
          width: 75,
          height: 75,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
          },
          {
            style: 8,
            enabled: true,
            weight: 1,
            timeWarp: {
              amount: 1,
              source: 'coordinate',
              axis: 'x',
              bias: 0,
            },
          },
        ],
      },
    },
  },
  /**
   * v8 `30.7` — Pipes Wound Chambers. **The combined demo (`30.D17`): box-fold AND twist, both in model
   * space.** The fold builds the chambers; the twist spirals them through depth. Each is dialled below its
   * solo setting (twist 0.35 against `Pipes Twist`'s 0.5) because two operators at full strength are
   * illegible.
   *
   * ⚠️ **IT CARRIED A CONFORMAL LAYER TOO UNTIL 2026-10-22, AND THE MEASUREMENT REMOVED IT.** A conformal
   * layer resamples the TRAIL, so over `Pipes` (decay 0.37) it compounded with the fold's own density
   * pile-up and saturated the frame to white — and lowering its weight from 0.6 to 0.35 made it worse, not
   * better, which is the signature of a feedback loop rather than of a value being too high. **The
   * compositional claim this demo makes is now the one it can keep: two MODEL-SPACE operators compose
   * cleanly, because neither of them reads the trail.** `Cylinder Droste` shows the image-domain half on a
   * body with no accumulation to feed back.
   */
  {
    after: 'Pipes',
    name: 'Pipes Wound Chambers',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Pipes Wound Chambers',
        version: 2,
        designResolution: {
          width: 75,
          height: 75,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 1],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
        twistZ: 0.2,
        boxFoldIterations: 1,
        boxFoldLimit: 0.85,
      },
    },
  },
  /**
   * v8 `30.7` — Pipes Droste. **The log-polar member, on a host chosen BY MEASUREMENT after two
   * wrong ones.**
   *
   * ⚠️⚠️ **IT WAS `Cylinder Droste` AND IT WAS UNJUDGEABLE FOR TWO INDEPENDENT REASONS, BOTH
   * MEASURED ONLY AFTER THE OWNER REPORTED THEM (2026-10-22).** First, it barely differed from its
   * parent: mean frame luminance **4.62 against plain `Cylinder`'s 4.81**, lit coverage 6.40 % against
   * 6.83 % — a demo that proves nothing. Second, `Cylinder` carries `rotation: [0, 3, 0]`, and a
   * rotating figure swept through a centred map changes by **22.6 fingerprint units in three seconds
   * with nothing touched**, against **26.9** for a deliberate Centre X move. **The control's own effect
   * was inside the pose noise** — which is exactly why the Centre sliders read as irreversible:
   * returning the slider restores the SETTING and cannot restore the MOMENT.
   *
   * ⚠️ **So this host is STATIONARY (`rotation: [0, 0, 0]`) and DENSE** — `Pipes` is `star` mode at
   * 81 % lit coverage, where a warp has something to displace.
   *
   * ⚠️ **THE LESSON GENERALISES PAST THIS PRESET: three of the seven demos first shipped on a host that
   * could not show their own operator** — a winding of 105 averaged the sample bias away, a material
   * splat filled the gaps it opened, and a rotation swamped the conformal centre. **Each was confirmed
   * by me on a preset incapable of showing it.** `checks/democheck.mjs` now measures every demo
   * against its parent with the parent's own frame-to-frame drift as the noise floor, so the HOST is
   * checked rather than assumed.
   *
   * Weight 0.5 rather than 1: log-polar restructures the whole frame, and `Pipes` accumulates a trail
   * (`decayFactor` 0.37) that a full-weight remap drives into a feedback wash.
   */
  {
    after: 'Pipes',
    name: 'Pipes Droste',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Pipes Droste',
        version: 2,
        designResolution: {
          width: 75,
          height: 75,
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo',
        ],
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [0, 0, 0],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1,
                },
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [1, 0, 0, 0],
            [8, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
        transMapChain: [
          {
            style: 12,
            enabled: true,
            weight: 0.5,
            conformal: {
              map: 'logPolar',
            },
          },
        ],
      },
    },
  },
  /**
   * v8 `31.6` — Quader Hyperspin. **Derived from `Quader` with ONE change** (`30.D17`).
   *
   * `E132`. The 4D rotation at extent 0.70 with all three `w` planes turned: (0.18, -0.12, 0.09) turns.
   * **All three deliberately, rather than one**: a single plane reads as an ordinary perspective change,
   * and it is the combination that produces the pass-through no 3D rotation can give.
   *
   * ⚠️ **Same host, same measurement: 13.1x `Quader`'s own drift** (217.4 px against 16.6 px). On
   * `Pipes` the identical setting scores **0.7x** — below its host's drift, i.e. exactly the defect class
   * the owner found three times in Phase 30. **Check the host before authoring, not after.**
   *
   * ⚠️ **Extent 0.70 and not 1.00, which measured better (15.8x), because the magnification spread at
   * 1.00 puts the near end of the curve at twice the far end's size** and the figure stops reading as one
   * object. The demo exists to show the operator, not its ceiling.
   */
  {
    after: 'Quader',
    name: 'Quader Hyperspin',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    preset: {
      metadata: {
        name: 'Quader Hyperspin',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0.2,
          0.3
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 63
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 60
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 96,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 63
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 60
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0,
          0.1,
          1
        ],
        colorShift: [
          1,
          2,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        sliderBaseFilmLook: 'Neon',
        wScale: 0.7,
        wXW: 0.18,
        wYW: -0.12,
        wZW: 0.09,
        wWinding: 4
      }
    },
  },
  /**
   * v8 `31.6` — Pipes Spread. **Derived from `Pipes` by the per-particle channels plus `ribbonMode: 'off'`.**
   *
   * ⚠️ **THE RIBBON IS OFF BY OWNER DECISION (2026-10-25) AND THAT BREAKS `30.D17`'s ONE-CHANGE RULE ON
   * PURPOSE, for the same reason `Pipes Twist` and `Pipes Chambers` lost theirs: a ribbon draws the path
   * as a continuous band, and a continuous band has no per-particle marks for a per-particle channel to
   * vary.** The one-change rule exists so a demo attributes its effect to one operator; here the host's
   * own renderer was CONCEALING the operator, which is the case the rule has to yield to. **The channels
   * are still the only thing changed that the feature owns.**
   *
   * `E112`/`E113`/`E137`. Driver `index`, lightness 0.8, size 0.6, opacity 0.3 — so brightness and
   * mark size both sweep along the figure's own length. **Lightness is the strongest of the three by
   * design: the study's finding is *lightness before hue*, and two independent methodologies agree that
   * chromatic variation is largely invisible at a particle's spatial scale while intensity reads well.**
   *
   * ⚠️⚠️ **THE HOST IS `Pipes` AND NOT `Quader`, WHICH IS THE OPPOSITE OF THE OTHER DEMOS — because the
   * thing worth seeing here is the DRIVER DROPDOWN, and `Quader` cannot show it.** Measured, the spread
   * of the published multiplier at amount 0.8 on each of the four drivers:
   *
   *       driver          Quader     Pipes
   *       index            13.1x     13.1x
   *       colourPhase       1.0x     13.1x
   *       velocity          1.5x     10.5x
   *       depth             1.7x      1.7x
   *
   * **On `Quader` two of the four drivers are flat**, so switching the dropdown would look broken. On
   * `Pipes` three of four are strong. ⚠️ **`Pipes` self-drifts 372 px and is the wrong host for anything
   * judged on MOTION — but these channels never move a particle, so that objection does not apply here.**
   * The host criterion is per-feature, not per-phase.
   *
   * ⚠️ **`depth` is weak on every host measured (1.2-1.7x) and that is the figure's fault, not the
   * driver's**: a Lissajous body occupies a thin slab in z, so the depth coordinate has little range to
   * spread over. It is worth knowing before concluding the driver is broken.
   */
  /**
   * v8 `32.1` (`E129b`) — **Pipes Taper. Derived from `Pipes` by `taper` alone**, plus the ribbon off for
   * the reason every operator demo on this host has it off: a continuous band hides a cross-section
   * change.
   *
   * `taperZ: 0.55` — one axis, so the gesture is unambiguous. The figure flares open along z and pinches
   * shut at the other end. ⚠ **Positive is `flare`, negative is `pinch`, which is what `fmtTaper` prints**:
   * the sign carries the gesture and a bare signed number does not.
   *
   * ⚠⚠ **THIS IS THE FIRST DEMO IN THE LIBRARY WHOSE OPERATOR CHANGES BRIGHTNESS, and that is Barr's
   * determinant rather than a tuning choice.** Taper's `det J` is `r`², so density — and therefore
   * luminance in an additive renderer — changes as the cross-section does. `32.3` compensates it through
   * the per-particle size channel, which is why the pinched end does not go dark. **The twist needed none
   * of this: its determinant is exactly 1.**
   */
  /**
   * v8 `32.2` (`E129b`) — **Pipes Bend. Derived from `Pipes` by `bend` alone**, ribbon off for the same
   * reason.
   *
   * `bendZ: 0.45` arcs the figure's axis, so a run that was straight curls — the gesture Barr calls
   * bending and the one `Twist` cannot produce at any setting.
   *
   * ⚠⚠ **0.45 IS WELL INSIDE `BEND_MAX_RATE` AND THE MARGIN IS THE POINT.** `det J` is `1 − k·u`, so
   * the centre of curvature sits at `1/k` — at 0.45 that is 2.2 half-extents away, comfortably outside
   * the figure. Barr's own text says the region beyond it is **everted**, and Hsu, Lee and Wiseman
   * describe the same locus independently. **The slider cannot reach it; this preset does not go near
   * it; and the readout prints the radius so a user can see how close they are.**
   */
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Faceted',
    /*
     * v8 `33.2` — Sharpness at the top of its range: the wave basis is a pure triangle, so every lobe
     * is built from straight segments meeting at hard vertices. **The ONE change this demo owns.**
     *
     * ⚠️ **The knot is PROVABLY the same as `Quader`'s** — Jones & Przytycki 1998 Thm 1.3 over a convex
     * family containing both the cosine and the sawtooth. So this is not a new figure, it is the same
     * figure in a different visual language, and loading parent and demo in turn is the whole point.
     *
     * ⚠️ **Hosted on `Quader` because the corner is only 0.4 % of the waveform's energy** and a
     * high-accumulation trail averages it away. Quader is one of the three standing low-accumulation
     * judging hosts, which is exactly the condition under which this operator can be seen at all.
     */
    preset: {
      metadata: {
        name: 'Quader Faceted',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0.2,
          0.3
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 63
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 60
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 96,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 63
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 60
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0,
          0.1,
          1
        ],
        colorShift: [
          1,
          2,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        sliderBaseFilmLook: 'Neon',
        sharpness: 1
      }
    },
  },
  {
    after: 'Cylinder',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Cylinder Chamfered',
    /*
     * v8 `33.2` — Sharpness at the MIDDLE of its range, and that is the point of this demo rather than a
     * milder version of `Quader Faceted`: it shows the control is **continuous**, not a toggle.
     *
     * ⚠️ **The midpoint is reachable only because the family is CONVEX.** `(1−λ)·cos + λ·sawtooth` stays
     * inside Jones & Przytycki's **F** for every λ, so the knot type is constant along the whole slider —
     * which is what makes a halfway value a legitimate figure rather than an interpolation artefact.
     */
    preset: {
      metadata: {
        name: 'Cylinder Chamfered',
        version: 2,
        designResolution: {
          width: 75,
          height: 100
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          3,
          0
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0,
        blurRadius: 0,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.13,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        sliderBaseFilmLook: 'Neon',
        sharpness: 0.5
      }
    },
  },
  {
    after: 'Blue Planes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Blue Planes Helix',
    /*
     * v8 `33.3` — a secular sweep along Z on a figure that is **exactly flat in Z**, so the closed planar
     * loop is lifted into a helix. **The ONE change this demo owns.**
     *
     * ⚠️ **The host was chosen BY MEASUREMENT, not by name.** Across 24 instants `Blue Planes` measures
     * 126 × 132 × **0.0**, i.e. one of 63 library presets with no z extent at all — on a host with three
     * live axes a secular term smears instead of lifting. The demo therefore shows the operator rather
     * than the host's own depth.
     *
     * ⚠️ **The sweep is 1.0 design half-extents ≈ 30 % of the figure's own width**, which is a clearly
     * visible lift that stays inside the frame. `TRAVEL_MAX` is deliberately conservative for that reason:
     * nothing auto-fits this term, so a larger ceiling would mostly buy figures nobody can see.
     */
    preset: {
      metadata: {
        name: 'Blue Planes Helix',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        }
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 30,
                  amplitude: 30,
                  frequency: 2
                },
                fm: {
                  base: 0,
                  amplitude: 8,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 30,
                  amplitude: 30,
                  frequency: 3
                },
                fm: {
                  base: 0,
                  amplitude: 8,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          64,
          64,
          128
        ],
        colorAmp: [
          64,
          64,
          128
        ],
        colorFreq: [
          0.1,
          0.1,
          0.3
        ],
        colorShift: [
          0.1,
          0.1001,
          0.03
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 2,
          beforeParticles: false,
          sinMagicParams: [
            [
              0.2,
              0,
              0,
              0
            ],
            [
              -0.75,
              0,
              0,
              0
            ],
            [
              0.2,
              0,
              0,
              0
            ],
            [
              0.75,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 66,
            y: 66
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'adaptive',
        ribbonWidth: 1,
        linesEnabled: false,
        lineWidth: 0.5,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 2,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.7,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1.5,
          vignette: 0,
          palette: 'Prismatic',
          paletteMapping: 'phase'
        },
        travelZ: 1
      }
    },
  },
  {
    after: 'Water Ice Crystal',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Water Ice Crystal Spire',
    /*
     * v8 `33.3` — the same operator on a second measured-flat host (120 × 87 × **0.0**), at a smaller
     * sweep and in `splat` mode with 20 000 particles, so the open arc is shown as a dense surface rather
     * than as a line.
     *
     * ⚠️ **Two flat hosts rather than one, deliberately**: if these two read alike the finding is about
     * the secular term, and if they differ it is about the host's own figure. One demo could not separate
     * those.
     */
    preset: {
      metadata: {
        name: 'Water Ice Crystal Spire',
        version: 2,
        designResolution: {
          width: 80,
          height: 60
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'ice'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          1
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 40,
                  frequency: 3
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 30,
                am: {
                  base: 0,
                  amplitude: 30,
                  frequency: 3
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 10,
                  frequency: 5
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 18,
                am: {
                  base: 7.5,
                  amplitude: 7.5,
                  frequency: 5
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 5,
                  amplitude: 5,
                  frequency: 7
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 12.857,
                am: {
                  base: 3.75,
                  amplitude: 3.75,
                  frequency: 7
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          255
        ],
        colorAmp: [
          64,
          64,
          0
        ],
        colorFreq: [
          0.1,
          0.1,
          0
        ],
        colorShift: [
          0.1,
          0.2,
          0
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [
            [
              8,
              0,
              0,
              0
            ],
            [
              4,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ],
            [
              -4,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              -0.05,
              -0.3,
              0,
              0
            ],
            [
              1,
              16,
              0,
              0
            ],
            [
              -0.05,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 100
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 4.4,
          depthSize: 0.9,
          depthBrightness: 0.7,
          depthDof: 0.9,
          depthColorShift: 0.2,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 5,
          bloomEnabled: true,
          bloomThreshold: 0.45,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.62,
          lift: [
            0,
            0.02,
            0.05
          ],
          gamma: [
            1,
            1.05,
            1.1
          ],
          gain: [
            0.85,
            0.95,
            1.1
          ],
          saturation: 0.75,
          vignette: 0.25,
          palette: 'Ocean',
          paletteMapping: 'position'
        },
        sliderBaseFilmLook: 'Glacier',
        renderMode: 'splat',
        material: {
          preset: 'Ice',
          splatRadius: 11,
          coreBrightness: 1.3,
          haloStrength: 0.5,
          falloffExponent: 3,
          thermalLag: 0.7,
          emissionIntensity: 1.7,
          heatMode: 'velocity',
          heatGain: 0.8,
          blendMode: 'alpha',
          colourRamp: 'ice',
          velocityStretch: 0
        },
        travelZ: 0.75
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Torus Knot',
    /*
     * v8 `33.1` — **a (3,4) torus knot, drawn by the generator exactly as it has always been able to.**
     *
     * ⚠️⚠️ **THIS IS THE STEP THAT CORRECTED THE PHASE'S OWN PREMISE.** The generator was briefed as three
     * per-axis sinusoids (Fourier-(1,1,1), a Lissajous knot), which would make a torus knot unreachable —
     * and the obstruction literature says so: *no nontrivial torus knot is Lissajous*. But every wave SLOT
     * sums into every axis, so each coordinate carries three harmonics (Fourier-(3,3,3)), and
     * `(2 + cos qt)·cos pt = 2cos pt + ½cos((q−p)t) + ½cos((q+p)t)` is exactly three. **It fits in 3+3+1 of
     * the nine slots and nobody had ever authored one.**
     *
     * ⚠️ **Phases SNAPPED to whole degrees (`33.D18`, owner).** The exact value for the third x term is
     * 12.857°, which the `Shift °` slider (step 1) cannot hold — one drag would destroy the knot. Measured
     * cost of snapping: **0.145 % of the figure's own extent**, the smallest of the five.
     *
     * ⚠️ **It replaces the host's WAVE SET, not one overlay key**, unlike every `33.7` demo. That is inherent:
     * these five exist to show figures the generator could always draw, so the waves ARE the demo. The look
     * is inherited from `Quader` so nothing else differs.
     */
    preset: {
      metadata: {
        name: 'Quader Torus Knot',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          10,
          14,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 180,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 13,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0.6589,
          0.1301,
          1
        ],
        colorShift: [
          0.8,
          1.2,
          1.7
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        material: {
          preset: 'Organic',
          splatRadius: 21,
          coreBrightness: 2.8,
          haloStrength: 1.1,
          falloffExponent: 3,
          thermalLag: 0.35,
          emissionIntensity: 1.2,
          heatMode: 'age',
          heatGain: 1,
          blendMode: 'alpha',
          colourRamp: 'organic',
          velocityStretch: 1
        },
        customFilmLookParams: {
          glow: 7,
          depthSize: 0.5,
          depthBrightness: 0.35,
          depthDof: 0.3,
          depthColorShift: 0.35,
          lightingMode: 3,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.8,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Pipes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Toric Lissajous',
    /*
     * v8 `33.1` — **a Lissajous-toric knot K(3,4,2)** (Soret & Ville): a point runs a vertical Lissajous
     * curve while that curve rotates N times about the axis. The rope's cross-section oscillates as it
     * winds, so it reads as a lumpy hawser rather than a smooth tube.
     *
     * ⚠️ **Three free integers where a torus knot has two**, and it still fits the nine slots: x takes
     * `(N, q+N, q−N)` at amplitudes `(R, a/2, a/2)`, z takes `p` alone. **The best value-per-slot figure in
     * the step.**
     *
     * ⚠️ Snapping cost **0.449 %** of extent (`33.D18`).
     */
    preset: {
      metadata: {
        name: 'Pipes Toric Lissajous',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          4,
          14,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 45,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 39,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.7,
          1.1,
          1.5
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Cylinder',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Cylinder Viviani',
    /*
     * v8 `33.1` — **Viviani's curve**: a figure-eight lying on a sphere, crossing itself once.
     *
     * ⚠️⚠️ **THE HALF-FREQUENCY Z TERM IS THE WHOLE CURVE, AND IT IS WHY THIS ONE IS NOT A LISSAJOUS
     * VARIANT.** `z = 2a·sin(t/2)` needs `fm.base = 0.5`, a NON-INTEGER winding — so the curve closes only
     * after two turns of x and y. The library has exactly twelve real fractional windings and this is the
     * only one that is there for a published curve rather than for a look.
     *
     * ⚠️ **The DC term is dropped and that is correct, not an approximation.** The published form is
     * `x = a(1 + cos t)`; the engine has no constant term, and a constant is a pure TRANSLATION of a figure
     * that is centred and fitted anyway. ⚠️ **Use the full-curve form** — the widely-copied Wikipedia
     * parametrisation gives only HALF the curve and loses the double point, which is the one feature anyone
     * would recognise it by.
     *
     * ⚠️ **Snapping cost 0.000 %: its phases are already whole degrees** (90, 0, 0). The one curve of the
     * five that `33.D18` costs nothing at all.
     */
    preset: {
      metadata: {
        name: 'Cylinder Viviani',
        version: 2,
        designResolution: {
          width: 75,
          height: 100
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          3,
          14,
          0
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 60,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          12.74,
          8.831,
          2.051
        ],
        colorShift: [
          0.6,
          0.9,
          1.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.359,
        blurRadius: 0,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Azure',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 2.73,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.05,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.6,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Granny',
    /*
     * v8 `33.1` — **the granny knot**, a connected sum of two trefoils, so it reads as two linked bulbs
     * rather than one loop.
     *
     * ⚠️ **It needs only 2+2+1 slots**, because a cosine and a sine at the SAME frequency combine into one
     * amplitude-and-phase term — so the four-term-per-axis published form collapses to two. **Four of the
     * nine slots are free**, which is what would let a user add a twist or a taper on top without running
     * out of harmonics.
     *
     * ⚠️ Snapping cost **0.489 %** of extent, the largest of the three knots (`33.D18`).
     */
    preset: {
      metadata: {
        name: 'Quader Granny',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          14,
          10,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 190,
                am: {
                  base: 23.37786,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 280,
                am: {
                  base: 5.1825600000000005,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 40,
                am: {
                  base: 14.51214,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 310,
                am: {
                  base: 16.119899999999998,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 10,
                am: {
                  base: 10.73988,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0,
          0.1,
          1
        ],
        colorShift: [
          0.8,
          1.2,
          1.7
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617283950617284,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        paletteMapping: 'age',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1.1192520546443105,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        dye: {
          enabled: true,
          decayRate: 0.946,
          opacity: 0.22,
          colourSource: 'depth',
          fixedColour: [
            1,
            0.35,
            0.1
          ],
          injectionRadius: 14,
          advectionStrength: 0.85,
          ramp: 'Classic: fire',
          blendMode: 'over',
          showFigure: true,
          mapping: 'depth',
          cycles: 1
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Cylinder',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Cylinder Spherical Spiral',
    /*
     * v8 `33.1` — **a Clelia curve at c = 6**: longitude proportional to colatitude, so the curve winds on
     * a sphere like thread on a ball.
     *
     * ⚠️⚠️ **IT REPLACED `Salkowski` IN THIS STEP (`33.D19`) AND THE REASON IS THREE MEASURED FAULTS IN THE
     * ALTERNATIVE**: Salkowski's formula reached the project second-hand (the source paper was never read),
     * its speed **VANISHES** at `t = ±π/2n` so particles bunch to a bright singularity there, and
     * `m ≠ ±1/√3` is a hard exclusion a slider could cross. Clelia is (2,2,1), verified ON the unit sphere
     * to 1.1e-16, and cheap.
     *
     * ⚠️ **It is a second SPHERICAL figure beside `Cylinder Viviani` (which is Clelia at c = 1), and that
     * pairing is the point**: if the two read alike, the finding is about the sphere silhouette rather than
     * about either curve. One demo could not separate those.
     *
     * ⚠️ Snapping cost **1.309 %** of extent — the worst of the five, because its 1/5 and 3/7 phases round
     * hardest. Still an order of magnitude below anything visible.
     */
    preset: {
      metadata: {
        name: 'Cylinder Spherical Spiral',
        version: 2,
        designResolution: {
          width: 75,
          height: 100
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          4,
          27,
          0
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 18,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 36,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 39,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.6,
          0.9,
          1.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0,
        blurRadius: 0,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: true,
        lineWidth: 6.5,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 1.8,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.13,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Birth of a Black Hole',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Black Hole Contours',
    /*
     * v8 `33.4` — the escape field's OTHER foliation. **The ONE change this demo owns.**
     *
     * Its parent follows the field's iso-contours, which are the equipotentials of the Douady–Hubbard
     * potential — particles circle the Julia set at a constant distance. This follows the GRADIENT instead,
     * so they run straight at it: the dendrite's spikes gain filaments converging on their tips.
     *
     * ⚠️⚠️ **IT IS NOT AN EXTERNAL-RAY TRACER and the manual must not call it one.** The field is
     * low-passed by three 3×3 blur passes before anything reads it, so its gradient lines diverge from true
     * external rays by more than the 512² sampling implies. Two independent research agents reached that
     * separately. **A new visual family, not the exact object.**
     *
     * ⚠️ **Expect it to be GRAINIER than its parent, and that is structural rather than a tuning fault**: a
     * field line runs out to the window edge, so it fails the flow test and respawns far more often than a
     * closed contour does. Measured over the whole population, every particle lands somewhere different.
     */
    preset: {
      metadata: {
        name: 'Black Hole Contours',
        version: 2,
        designResolution: {
          width: 80,
          height: 80
        }
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 40,
                  frequency: 1
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 40,
                  frequency: 2
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: {
                  base: 0,
                  amplitude: 20,
                  frequency: 3
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 20,
                  frequency: 4
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          32,
          64,
          128
        ],
        colorAmp: [
          64,
          64,
          128
        ],
        colorFreq: [
          0.01,
          0.02,
          0.03
        ],
        colorShift: [
          0.5,
          0.23,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [
            [
              20,
              10,
              5,
              2.5
            ],
            [
              -1,
              -2,
              -3,
              -4
            ],
            [
              20,
              10,
              5,
              2.5
            ],
            [
              1,
              2,
              3,
              4
            ]
          ],
          sinMagicParams2: [
            [
              -0.2,
              0,
              0,
              0
            ],
            [
              0.5,
              0,
              0,
              0
            ],
            [
              -0.2,
              0,
              0,
              0
            ],
            [
              -0.5,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 1,
        filmLook: 'Customize',
        attractorIndex: 13,
        attractorBlend: 0.75,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 3,
        transMapChain: [
          {
            style: 3,
            enabled: true,
            weight: 1
          },
          {
            style: 7,
            enabled: true,
            weight: 1,
            refraction: {
              strength: 0.3,
              reach: 2.3,
              invert: false,
              source: 'density'
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1.137411461756029,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.4,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        },
        palette: 'Cycle: Deep Blue',
        paletteMapping: 'index',
        // ⚠️⚠️ CONVERTED TO CONTOURS 2026-11-01 (owner): this body authored `escapeFlow: 'ray'`,
        // and the field-lines flow was withdrawn from the UI because the lines get SWALLOWED at the
        // boundary — which is `33.22`'s replenishment defect, diagnosed and never fixed. **The key is now
        // ABSENT, and absent resolves to `'contour'`, the engine's default since `33.4`** — so the preset
        // still renders, with the flow it has rather than the one it was built for. ⚠️ **The name changed in
        // the same edit (`… Rays` → `… Contours`): a name is a claim about the picture, and this one's was
        // about to become false.** ⚠️ The ray path is still LIVE in the engine for an imported body.
      }
    },
  },
  {
    after: 'Mandelbrot River',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Mandelbrot River Contours',
    /*
     * v8 `33.4` — the same one change on the full Mandelbrot set, at 30 100 particles.
     *
     * ⚠️ **Two hosts for one operator, deliberately**: the dendrite is all spikes and the full set is one
     * body with a boundary, so if the two read alike the finding is about the foliation, and if they differ
     * it is about the set. One demo could not separate those.
     */
    preset: {
      metadata: {
        name: 'Mandelbrot River Contours',
        version: 2,
        designResolution: {
          width: 75,
          height: 60
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 30100,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0.9
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 67.5,
                  frequency: 1
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          0.1,
          0.3,
          0.2
        ],
        colorShift: [
          0.2,
          0.3,
          0.1
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              -3.5252395,
              -0.13100608,
              3.4336207,
              -0.18399265
            ],
            [
              -0.85365725,
              1.4781172,
              6.382013,
              0.35840952
            ],
            [
              1.2670563,
              -2.5264447,
              3.7346892,
              1.4638029
            ],
            [
              6.2106223,
              -0.96369255,
              2.1401706,
              -8.016661
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 2.5,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: 25,
        attractorBlend: 1,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: false,
            weight: 1
          },
          {
            style: 4,
            enabled: false,
            weight: 1
          },
          {
            style: 6,
            enabled: false,
            weight: 1
          }
        ],
        ifsParams: [
          {
            angle: 120,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          },
          {
            angle: 240,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          },
          {
            angle: 360,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          }
        ],
        transMapDispersion: 0.23,
        fluidFeedback: {
          persist: 0.97,
          amplify: 1,
          dispersion: 0,
          fieldDecay: 0.985,
          glowBoost: 0
        },
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 3.01,
        figureScale: 1.4021152112778286,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.05,
          bloomIntensity: 0.65,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.3,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        },
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        // ⚠️⚠️ CONVERTED TO CONTOURS 2026-11-01 (owner): this body authored `escapeFlow: 'ray'`,
        // and the field-lines flow was withdrawn from the UI because the lines get SWALLOWED at the
        // boundary — which is `33.22`'s replenishment defect, diagnosed and never fixed. **The key is now
        // ABSENT, and absent resolves to `'contour'`, the engine's default since `33.4`** — so the preset
        // still renders, with the flow it has rather than the one it was built for. ⚠️ **The name changed in
        // the same edit (`… Rays` → `… Contours`): a name is a claim about the picture, and this one's was
        // about to become false.** ⚠️ The ray path is still LIVE in the engine for an imported body.
      }
    },
  },
  {
    after: 'Julia Siegel Disk River',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Siegel Disk Contours',
    /*
     * v8 `33.4` — the third host, chosen because its interior is ROTATION-dominated.
     *
     * ⚠️ A Siegel disk's dynamics are an irrational rotation, so the equipotentials near it are nearly
     * circular and the gradient lines cross them nearly radially — the one host where the two foliations
     * should look most unlike each other. **If `33.4` reads as nothing anywhere, it should read as
     * something here.**
     */
    preset: {
      metadata: {
        name: 'Siegel Disk Contours',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        tags: [
          'demo',
          'attractor',
          'fractal'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 11000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0.25
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          176,
          152,
          96
        ],
        colorAmp: [
          56,
          48,
          64
        ],
        colorFreq: [
          0.08,
          0.1,
          0.12
        ],
        colorShift: [
          0.35,
          0.2,
          0.45
        ]
      },
      renderer: {
        mode: 'star',
        glow: 1,
        decayFactor: 0.7,
        blurRadius: 1,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        renderMode: 'liquid',
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.25,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        },
        palette: 'Prismatic',
        paletteMapping: 'index',
        speedFactor: 1.51,
        attractorIndex: 19,
        attractorBlend: 1,
        figureScale: 1.4,
        particleSize: 0.6,
        liquid: {
          isoLevel: 2.7321,
          kernelWidth: 3.1,
          edgeSoftness: 0.36,
          tintSource: 'preset',
          surfaceRamp: 'liquid',
          colourMix: 0.85,
          mixModel: 'pigment',
          refraction: 0.49,
          specular: 2,
          thickness: 0.7,
          edgeBrightness: 1.1
        },
        // ⚠️⚠️ CONVERTED TO CONTOURS 2026-11-01 (owner): this body authored `escapeFlow: 'ray'`,
        // and the field-lines flow was withdrawn from the UI because the lines get SWALLOWED at the
        // boundary — which is `33.22`'s replenishment defect, diagnosed and never fixed. **The key is now
        // ABSENT, and absent resolves to `'contour'`, the engine's default since `33.4`** — so the preset
        // still renders, with the flow it has rather than the one it was built for. ⚠️ **The name changed in
        // the same edit (`… Rays` → `… Contours`): a name is a claim about the picture, and this one's was
        // about to become false.** ⚠️ The ray path is still LIVE in the engine for an imported body.
      }
    },
  },
  {
    after: 'Birth of a Black Hole',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Black Hole Relief',
    /*
     * v8 `33.5` — **the per-particle size driven by distance from the Julia set.**
     *
     * ⚠️⚠️ **THE VALUE WAS ALREADY BEING COMPUTED EVERY FRAME AND THROWN AWAY.** `advanceEscapeFlow` ends
     * each particle's update with `s.z[i] = esc / grid.maxIter` and the normaliser overwrote it with 0 four
     * lines later. This demo is the first thing in the engine's history to read it. **No new mathematics:
     * the whole feature is plumbing a discarded scalar to a shipped output channel**, which is exactly the
     * class the project's own output-channel discriminator calls high-value.
     *
     * ⚠️ **Two keys, ONE change.** The driver alone is provably inert — `writeChannels()` returns
     * `undefined` while all three amounts are 0 — so the pair is a single operator, as
     * `boxFoldIterations`/`boxFoldLimit` already are.
     *
     * ⚠️ **The scalar is ALREADY in `[0,1]` and is not rescaled**, which is the channel driver's own range. A
     * second normalisation here would be `TW_COORD_DEPTH`'s double-normalisation defect in a new place.
     */
    preset: {
      metadata: {
        name: 'Black Hole Relief',
        version: 2,
        designResolution: {
          width: 80,
          height: 80
        }
      },
      generators: {
        type: 'lissajous',
        particleCount: 20000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 40,
                  frequency: 1
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 40,
                  frequency: 2
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: {
                  base: 0,
                  amplitude: 20,
                  frequency: 3
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 20,
                  frequency: 4
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          32,
          64,
          128
        ],
        colorAmp: [
          64,
          64,
          128
        ],
        colorFreq: [
          0.01,
          0.02,
          0.03
        ],
        colorShift: [
          0.5,
          0.23,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 3,
          beforeParticles: false,
          sinMagicParams: [
            [
              20,
              10,
              5,
              2.5
            ],
            [
              -1,
              -2,
              -3,
              -4
            ],
            [
              20,
              10,
              5,
              2.5
            ],
            [
              1,
              2,
              3,
              4
            ]
          ],
          sinMagicParams2: [
            [
              -0.2,
              0,
              0,
              0
            ],
            [
              0.5,
              0,
              0,
              0
            ],
            [
              -0.2,
              0,
              0,
              0
            ],
            [
              -0.5,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 1,
        filmLook: 'Customize',
        attractorIndex: 13,
        attractorBlend: 0.75,
        renderMode: 'blend',
        transMapEnabled: true,
        transMapStyle: 3,
        transMapChain: [
          {
            style: 3,
            enabled: true,
            weight: 1
          },
          {
            style: 7,
            enabled: true,
            weight: 1,
            refraction: {
              strength: 0.3,
              reach: 2.3,
              invert: false,
              source: 'density'
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1.137411461756029,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.4,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        },
        palette: 'Cycle: Deep Blue',
        paletteMapping: 'index',
        channelDriver: 'escape',
        channelSize: 0.7
      }
    },
  },
  {
    after: 'Mandelbrot Zoom',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Mandelbrot Seahorse Bands',
    /*
     * v8 `33.5` — the same scalar on LIGHTNESS rather than size, which reproduces the classic
     * iteration-band colouring of a Mandelbrot image — carried by particles instead of pixels.
     *
     * ⚠️ **Lightness rather than hue, and that is the study's own finding rather than a taste call**: two
     * independent lines of evidence agree that chromatic variation is largely invisible at a particle's
     * spatial scale while intensity reads well. `31.2` put `Lightness` first among the three amount rows
     * for the same reason.
     */
    preset: {
      metadata: {
        name: 'Mandelbrot Seahorse Bands',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        tags: [
          'demo',
          'attractor',
          'fractal'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 12000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0.49
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 63
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 60
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 96,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 63
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 60
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          112,
          136,
          184
        ],
        colorAmp: [
          64,
          48,
          72
        ],
        colorFreq: [
          0.1,
          0.14,
          0.18
        ],
        colorShift: [
          0.3,
          0.4,
          0.2
        ]
      },
      renderer: {
        mode: 'blend',
        glow: 1.4,
        decayFactor: 0.75,
        blurRadius: 1,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        renderMode: 'blend',
        filmLook: 'Neon',
        palette: 'Neon',
        paletteMapping: 'phase',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Grid Lattice',
              strength: 0.5,
              detail: 1,
              drift: 0
            }
          }
        ],
        speedFactor: 1,
        attractorIndex: 25,
        attractorBlend: 0.95,
        figureScale: 1.45,
        particleSize: 0.7,
        channelDriver: 'escape',
        channelLight: 0.85
      }
    },
  },
  {
    after: 'Mandelbrot River',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Mandelbrot River Glow',
    /*
     * v8 `33.5` — the third channel: ALPHA, so the boundary is opaque and the surrounding field recedes.
     *
     * ⚠️ **Three demos, one per channel, on purpose.** The driver is shared and the three amounts are
     * independent (`31.D4`), so a single demo would leave two thirds of the feature unexercised — and the
     * reachable-but-unused configuration is exactly where a black-frame defect hides.
     */
    preset: {
      metadata: {
        name: 'Mandelbrot River Glow',
        version: 2,
        designResolution: {
          width: 75,
          height: 60
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 30100,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          0.9
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 67.5,
                  frequency: 1
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          0.1,
          0.3,
          0.2
        ],
        colorShift: [
          0.2,
          0.3,
          0.1
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9876543209876544,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              -3.5252395,
              -0.13100608,
              3.4336207,
              -0.18399265
            ],
            [
              -0.85365725,
              1.4781172,
              6.382013,
              0.35840952
            ],
            [
              1.2670563,
              -2.5264447,
              3.7346892,
              1.4638029
            ],
            [
              6.2106223,
              -0.96369255,
              2.1401706,
              -8.016661
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        ribbonWidth: 2.5,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: 25,
        attractorBlend: 1,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: false,
            weight: 1
          },
          {
            style: 4,
            enabled: false,
            weight: 1
          },
          {
            style: 6,
            enabled: false,
            weight: 1
          }
        ],
        ifsParams: [
          {
            angle: 120,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          },
          {
            angle: 240,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          },
          {
            angle: 360,
            scale: 0.9,
            tx: 0,
            ty: 0,
            weight: 1
          }
        ],
        transMapDispersion: 0.23,
        fluidFeedback: {
          persist: 0.97,
          amplify: 1,
          dispersion: 0,
          fieldDecay: 0.985,
          glowBoost: 0
        },
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 3.01,
        figureScale: 1.4021152112778286,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.05,
          bloomIntensity: 0.65,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.3,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        },
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        channelDriver: 'escape',
        channelAlpha: 0.8
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Star Eight',
    /*
     * v8 `33.2` — **an eight-pointed star, built from the wave basis at `sharpness: 1`.**
     *
     * ⚠️⚠️ **THIS PRESET EXISTS BECAUSE `33.6` WAS DROPPED, AND IT IS THE BETTER ANSWER TO THE SAME QUESTION.**
     * Phase 33 originally shipped Lamm's cylinder knots as a new ATTRACTOR TYPE to get hard-edged star figures.
     * The owner asked why a curve was filed as an attractor and whether `Sharpness` could not do it — and
     * measurement said yes. **Reproduced here to within the metric's resolution:** corner-radius spread **0.0 %**
     * against the knot's 0.0 %, and reach **2.65** against its 2.61.
     *
     * ⚠️ **THE RECIPE IS TWO STRUCTURAL CHOICES AND NEITHER IS OBVIOUS.** (1) x and y share ONE frequency a
     * quarter-period apart — that is the triangle analogue of cos/sin and is what puts every corner on one
     * circle. Mismatched frequencies trace a Lissajous ribbon whose corners sit at many radii (measured
     * 16.6–21.9 % spread), which is what made the first attempt look nothing like a star. (2) The second term
     * **COUNTER-ROTATES** — its y-offset is `+90/f` where the first is `−90/f`. Same-direction harmonics only
     * bulge the edges (reach plateaus at 1.64 however large the amplitude); counter-rotation cuts the valleys in.
     *
     * ⚠️ **It is a FIGURE, not a figure source**, which is the whole gain: it edits in the Composer, responds to
     * Sharpness, Travel and every deformer, renders in the preview grid, and carries no second code path.
     * ⚠️ Phases are whole degrees, so a `Shift °` drag cannot destroy it (`33.D18`). Only f ∈ {2,3,5,6,10}
     * admit that — f = 4 and f = 12 need 67.5° and 22.5° and are therefore unusable.
     */
    preset: {
      metadata: {
        name: 'Quader Star Eight',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          13.92,
          6.2,
          5.94
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 315,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 45,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          3.924,
          0.4566,
          0.7749
        ],
        colorShift: [
          0.904,
          0.594,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.606,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'fixed',
        ribbonWidth: 3,
        linesEnabled: true,
        lineWidth: 0.5,
        filmLook: 'Customize',
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        // v8 33 - the owner's export carried `renderMode: 'splat'` with NO live material, and
      // `splat` with no material draws NOTHING, so the engine was already falling back to
      // `renderer.mode` (`star`). The key was INERT: removing it is byte-identical on screen and is
      // what `coveragecheck` prescribes -- adding a material instead would change a preset the
      // owner accepted (21.2). The sibling `Quader Star Twelve` keeps its `splat` because it
      // carries a Fire material, so there the mode is live.
        transMapEnabled: true,
        transMapStyle: 7,
        transMapChain: [
          {
            style: 7,
            enabled: true,
            weight: 1,
            refraction: {
              strength: 0.91,
              reach: 2.7,
              invert: true,
              source: 'density'
            }
          }
        ],
        transMapDispersion: 0.04,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 1.37,
        sharpness: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 6.5,
          depthSize: 0.4,
          depthBrightness: 0.3,
          depthDof: 0.3,
          depthColorShift: 0.4,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.05,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.6,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Star Twelve',
    /*
     * v8 `33.2` — twelve points, same recipe at f = 3. **The ONE change from `Quader Star Eight` is
     * the shared frequency**, so the three stars together show what that one integer does.
     *
     * ⚠️ Measured 0.0 % spread, reach 2.65 — identical to the eight-pointed version, which is the point: the
     * geometry is scale-free in the frequency, so a user can pick the point count without retuning anything.
     */
    preset: {
      metadata: {
        name: 'Quader Star Twelve',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0.07,
          -0.05
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 2,
                  frequency: 2
                }
              },
              {
                phase: 330,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 30,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 60,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 3,
                  amplitude: 2,
                  frequency: -2
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0,
          0.1,
          1
        ],
        colorShift: [
          1,
          2,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.847,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Material: fire',
        paletteMapping: 'temperature',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'splat',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        sharpness: 1,
        channelDriver: 'depth',
        channelSize: 0.23,
        channelAlpha: 0,
        channelLight: 0.22,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        material: {
          preset: 'Fire',
          splatRadius: 3.5,
          coreBrightness: 2,
          haloStrength: 0.1,
          falloffExponent: 3.5,
          thermalLag: 0.04,
          emissionIntensity: 2,
          heatMode: 'velocity',
          heatGain: 1,
          blendMode: 'additive',
          colourRamp: 'fire',
          velocityStretch: 0.4
        },
        buoyancy: {
          enabled: true,
          strength: 2,
          returnForce: 1.5,
          turbulence: 0.4,
          maxOffset: 200,
          curlOctaves: true,
          smokeThreshold: 0.03,
          smokeOpacity: 0.4,
          smokeDissipation: 0.95
        },
        sparks: {
          enabled: true,
          poolSize: 550,
          threshold: 0.5,
          ejectionSpeed: 0.3,
          gravity: 200,
          drag: 2,
          minLifetime: 0.2,
          maxLifetime: 0.8,
          coolingRate: 3,
          splatRadius: 3,
          maxSparksPerFrame: 26
        },
        cohesion: {
          strength: 0.13,
          radius: 16,
          returnForce: 1.5
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: false,
          bloomThreshold: 0.8,
          bloomIntensity: 0,
          toneMapEnabled: false,
          toneMapCurve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1,
          vignette: 0,
          palette: 'Material: fire',
          paletteMapping: 'temperature'
        }
      }
    },
  },
  {
    after: 'Pipes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Star Twenty',
    /*
     * v8 `33.2` — twenty points at f = 5, hosted on `Pipes` so the operator appears on two of the
     * three standing low-accumulation judging hosts.
     *
     * ⚠️ **At twenty points the corners are ~18° apart and a long trail will round them off**, which is the
     * 0.4 %-of-spectral-energy limit the `Sharpness` tooltip states. **If any of the three stars reads as
     * smooth, it should be this one** — so it is the honest upper bound on how fine a faceted figure can get
     * before the trail eats the facets.
     */
    preset: {
      metadata: {
        name: 'Pipes Star Twenty',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          20.77,
          0.12,
          5.25
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 342,
                am: {
                  base: 12,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 6,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 18,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 36,
                am: {
                  base: 28.5,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: true,
        lineWidth: 6,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        sharpness: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        dye: {
          enabled: true,
          decayRate: 0.985,
          opacity: 0.5,
          colourSource: 'figure',
          fixedColour: [
            1,
            0.35,
            0.1
          ],
          injectionRadius: 12,
          advectionStrength: 1,
          ramp: 'Classic: fire',
          blendMode: 'over',
          showFigure: true,
          mapping: 'depth',
          cycles: 1
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Orbit Wreath',
    /*
     * v8 `34.2` — `Offset`, and the ONE change this demo owns: `offsetX: 1.2` half-extents moves the whole
     * curve off the rotation centre. **The figure is `Quader`'s, untouched.**
     *
     * ⚠️ **The operator's entire value is in the MOTION, not in the position.** The translation itself is exact —
     * the specification measures max deviation `0.00e+0` from a clean shift — but the engine rotates about the
     * model ORIGIN, so every figure in the library spins IN PLACE. Offset is the term the rotation is taken
     * about, and it turns that spin into an ORBIT.
     *
     * ⚠️ **`rotation: [0, 0, 10]` — Z ONLY, and that is load-bearing.** A tumble on three axes smears the swept
     * ring into a shell and the demo stops teaching. 10 deg/s is one revolution per 36 s and round-trips exactly
     * on the rotation track — **of the integers 1–30 only 1, 3, 4, 10, 14 and 27 do**, and an authored value the
     * track cannot represent changes its own readout on the next load.
     *
     * ⚠️ **`decayFactor: 0.975` is LONG, against the Sharpness demos' short trails, and the reason is measured
     * rather than aesthetic: for Offset the swept torus IS the trail.** ⚠️ **But no reachable decay holds a whole
     * 36 s revolution** — the 0.99 ceiling is a half-life of about 1.1 s — so what the trail actually shows is an
     * orbital ARC behind the figure, not a closed ring. Stated so the next reader does not raise the decay
     * hunting for one.
     *
     * ⚠️ **`figureScale` here is FRAMING, not taste.** `Quader` reaches 0.96 half-extents, so a centre at 1.2
     * plus a radius of 0.96 is 2.16 half-extents of outer reach. `figureScale` scales the offset WITH the figure
     * (the whole position goes through `effectiveScale()`), so the composition's proportions survive and the
     * outer reach lands at 0.97 — inside the short edge on EVERY window shape, which is the only kind of bound a
     * preset may make (invariant 27). The value is an exact stop of the logarithmic Figure Scale track.
     */
    preset: {
      metadata: {
        name: 'Quader Orbit Wreath',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          10
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 63
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 60
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 96,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 63
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 60
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          0,
          0.1,
          1
        ],
        colorShift: [
          1,
          2,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.975,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        filmLook: 'Customize',
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        sliderBaseFilmLook: 'Neon',
        figureScale: 0.447213595499958,
        offsetX: 1.2
      }
    },
  },
  {
    after: 'Quader',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Square Spring',
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Quader Square Spring_20261030_153758.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️⚠️ **THE COLOUR PARAGRAPH BELOW IS SUPERSEDED: the export authors `Neon` under `index`.** The
     * paragraph's reasoning stands and is why the row exists at all — the host's own pair made this demo
     * invisible, and any name but that pair is an AUTHORED override owing a declaration. `Neon` owes one too,
     * and has it.
     *
     * v8 `33.3` × `33.2` — `Travel` × `Sharpness`: ten square frames stacked into a spring, **machined rather
     * than drawn**.
     *
     * ⚠️ **The square is not authored; it is what the triangle basis MAKES.** x and y share one winding (10) a
     * quarter period apart (phase 9, because `90/10` is an integer), which at `sharpness: 0` traces a circle and
     * at `sharpness: 1` traces a SQUARE — two linear ramps in quadrature. `travelZ: 1` then sweeps z across the
     * population, so the ten loops separate into a helix instead of overlaying.
     *
     * ⚠️ **Fm is frozen — `Quader`'s already is, which is why it is the host — and the z wave is deliberately
     * ZEROED**, so the only thing advancing along the stroke is the secular term. Otherwise the stack's pitch
     * would be two quantities and the demo would not be about one operator.
     *
     * ⚠️⚠️ **THE TRAIL IS SHORT (0.617), AGAINST THE "LONG FOR TRAVEL" HALF OF RULE 2, AND THE REASON IS THAT THE
     * TWO HALVES ARE NOT THE SAME KIND OF CLAIM.** `Travel` is a SPATIAL sweep across the population — the whole
     * helix is on screen in a single frame and needs no accumulation at all — while the Sharpness corner is a
     * sub-percent spectral perturbation that a high-accumulation trail provably averages away. **The measured
     * reason wins over the aesthetic one**, and 0.617 is `Quader Faceted`'s own value, so the two are comparable
     * side by side.
     *
     * ⚠️ `overlay.paletteMapping: 'index'` — `Travel` makes the figure OPEN (two free ends) and the colour law
     * wraps, so the seam at the open end is CORRECT and reads as a defect under a mapping that cycles.
     * ⚠️ **Never un-wrap the palette globally**; the mapping is the local fix.
     *
     * ⚠️⚠️ **THE MAPPING IS WRITTEN AT THE OVERLAY PATH AND NOT INSIDE `customFilmLookParams`, AND THAT IS A
     * MEASURED CHOICE RATHER THAN A STYLE ONE.** `resolvePaletteSelection()` reads
     * `ov?.paletteMapping ?? fp?.paletteMapping`, so either spelling renders the same — but **`'index'` has 125
     * carriers at the overlay path and had ZERO inside `customFilmLookParams`**, and `coveragecheck`'s §H seed
     * rests on exactly that absence: a first draft of this demo put the mapping in the look bundle and turned that
     * seed into a CALIBRATION FAIL. **A checker's own basis can be a property of the library, and authoring
     * against the library's minority spelling breaks it.**
     *
     * ⚠️ **`overlay.palette` is written EXPLICITLY (a film look ABSTAINS and writes nothing if it has none).**
     * It USED to name the body's OWN pair — `cyclePaletteForPair([21,21,21], [64,32,32])` is `Cycle: Embers` —
     * so that the colour under `index` was `Quader`'s own and the figure operator was the only variable, and
     * this paragraph warned that naming any other palette would make it an AUTHORED override in
     * `palettecheck`'s partition and owe a declaration there.
     *
     * ⚠️⚠️ **THAT COST WAS PAID ON 2026-10-31 (owner): `Cycle: Embers`/`index` → `Pastel`/`index`, AND THE
     * WARNING WAS RIGHT — the row had to be declared, `palettecheck` went red until it was, and the demo
     * moved from the ADOPTED partition into the AUTHORED one.** The reason it was paid: **inheriting the
     * host's colour made this demo INVISIBLE.** Measured mean 0.40 of 255, sd 2.36, 1.93 % of pixels above
     * the 8-bit floor — the dimmest of the fourteen Phase 34 demos by 3× — because `Quader`'s own pair IS
     * dark (`[21,21,21]` base) and `Cycle: Embers` is the dimmest entry in the registry, its BRIGHTEST point
     * (luminance 64) darker than most palettes' darkest. ⚠️ **No mapping could fix it** — under `index` the
     * dark pair drives the CPU law, under any LUT mapping the same dark ramp is sampled.
     *
     * ✅ **`Pastel`/`index` measures mean 14.85, sd 47.24, lit 11.61 % — 37× the mean and 20× the structure**,
     * and `Pastel` is FLAT in luminance (min 178, max 179), so the ten stacked frames separate by HUE across
     * the index rather than by brightness, which is what `index` is here for. `index` is unchanged and still
     * lives at the overlay path, for the `coveragecheck` §H reason above. ⚠️ **WHAT THE CHANGE COSTS, stated
     * rather than buried: the colour is no longer the host's, so a `Quader` ↔ this-demo comparison now has
     * TWO variables.** `Cycle: Azure`/`phase` measured brighter still (43×) and was refused for that reason —
     * it would have changed the mapping as well.
     */
    preset: {
      metadata: {
        name: 'Quader Square Spring',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          13.06,
          8.09
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 9,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 3,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          2.14,
          0.3301,
          1
        ],
        colorShift: [
          1,
          2,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.617,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Neon',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        sharpness: 1,
        sharpnessStructure: 1,
        sharpnessDetail: 0,
        travelX: 0,
        travelY: 0,
        travelZ: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Pipes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Conical Vortex',
    /*
     * v8 `34.3` — `Grow`, the along-curve amplitude ramp: `growX`/`growY` at **2.6** run the amplitude
     * ×1 → ×3.6 across the population while `travelZ: 0.8` advances z, so the curve opens into a CONE.
     *
     * ⚠️⚠️ **THE STORED VALUE IS THE RAMP COEFFICIENT `k` AND `0` IS THE IDENTITY — NOT `1`.** The law is
     * `am · (1 + k·τ)`. A reader who sees the word "multiplier" and writes 1 scales every amplitude by `1 + τ`,
     * doubling the far end of every stroke in the library; `tsc` sees `number`, `OVERLAY_RULES` cannot express an
     * identity, and **no instrument anywhere would say so.**
     *
     * ⚠️ **`growZ` is deliberately absent.** Growing z as well would flare the cone's AXIS along with its mouth,
     * which is a different shape and not the one the operator is being shown for.
     *
     * ⚠️ **`figureScale: 0.280…` is forced arithmetic rather than taste.** `Pipes` reaches 0.96 half-extents and
     * 3.6× that is 3.46, so the mouth alone would be three frames wide. Scaling the composition brings the mouth
     * to 0.97 half-extents on every window shape, and the tip is correspondingly small — which is what a cone
     * looks like.
     *
     * ⚠️ **This is the operator with the LEAST prior evidence in the phase — one render at one parameter set — and
     * the one most owed an eye.** `decayFactor: 0.9` is a medium-high trail, because the ramp reads through
     * accumulated brightness along the stroke. ⚠️ `overlay.paletteMapping: 'index'` with
     * `overlay.palette: 'Cycle: Neutral'` — the body's own pair — for `Quader Square Spring`'s reasons.
     */
    preset: {
      metadata: {
        name: 'Pipes Conical Vortex',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          4
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 0.28042304225556575,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        growX: 2.6,
        growY: 2.6,
        travelZ: 0.8
      }
    },
  },
  {
    after: 'Pipes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Taper Comet',
    /*
     * v8 `34.3` — `Grow` at its FLOOR: `-1` on all three axes, where the amplitude reaches exactly 0 at the end
     * of the stroke. **The demo's subject is why `GROW_FLOOR` is where it is**, not a look.
     *
     * Below −1 the amplitude goes negative mid-stroke — a phase inversion, visually a fold-back, and impossible to
     * read off the control — so the clamp is structural rather than a preference, and a full taper to a point is
     * the last legible state before it.
     *
     * ⚠️⚠️ **EVERY PARTICLE NEAR τ = 1 CONVERGES ON THE ORIGIN, SO THE TIP IS A DENSITY SPIKE** — the one place
     * these two new operators CREATE a hot spot rather than redistributing one. ⚠️ **If it blows out in the final
     * 8-bit output, `-0.9` is the fallback and THAT IS THE ACCEPTANCE FINDING, not a tuning failure:** the floor
     * would then be demonstrated by a value that approaches it instead of one that reaches it. Judged on `Pipes`
     * for the standing reason — one of the three low-accumulation hosts — and `decayFactor` is raised only to 0.6
     * from the host's 0.37, enough for the taper to read as a gradient and no further.
     *
     * ⚠️ No `figureScale`: the amplitude only ever SHRINKS, so the figure stays inside `Pipes`' own reach and
     * there is nothing to frame. ⚠️ This is the first demo to cut if the cohort is trimmed — it demonstrates a
     * clamp rather than a look, and this project's standing finding is that correctness demos get cut anyway.
     */
    preset: {
      metadata: {
        name: 'Pipes Taper Comet',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          1
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.6,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'hybrid',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        growX: -1,
        growY: -1,
        growZ: -1
      }
    },
  },
  {
    after: 'Multiple',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Multiple Faceted Core',
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Multiple Faceted Core_20261030_162729.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️ **It also became the library's carrier of the six `grow` depth/rate keys** (`growDepthX/Y/Z`,
     * `growRateX/Y/Z`) when `Quader Flare Pulse` and `Quader Flare Broadside` were deleted in the same batch —
     * measured before the deletions, which is why they cost no key its last carrier.
     *
     * v8 `34.4` — per-level `Sharpness` at `[1, 0, 0]`: **the Body faceted, the Structure and the Detail left
     * smooth.** The configuration a single global slider provably cannot reach — the closest of 41 global settings
     * is 0.0935 away, which is 78 % of the entire sweep.
     *
     * ⚠️⚠️ **ALL THREE KEYS ARE AUTHORED AND THE TWO ZEROS ARE LOAD-BEARING.** `sharpnessStructure` and
     * `sharpnessDetail` read `?? sharpness`, never `?? 0` (`34.D11`) — the backfill that keeps every preset
     * authored before this phase lossless — so **there is no absent-key spelling of "Body only"**. Omit either zero
     * and that level facets at 1, silently, on a figure whose whole subject is the contrast.
     *
     * ⚠️⚠️ **A NEW HOST WAS REQUIRED AND THE REASON IS MEASURED, NOT a preference.** Of the six presets carrying
     * `overlay.sharpness` today, **five have NO live Detail slot at all** — on those five a per-level Detail
     * sharpness is structurally INERT rather than merely quiet — and on three of them (the owner's finetuned
     * stars) Structure outweighs Body. `Multiple` is one of three hosts measured as able to carry all three
     * levels, and **its Fm is already frozen on every slot-axis**, which is the authoring rule a Sharpness demo may
     * not skip.
     *
     * ⚠️ **The amplitudes are authored at the library's own measured WITHIN-PRESET balance**: 25 / 9 / 3 per axis
     * gives shares of 67.6 / 24.3 / 8.1 % against the measured mean shares of 69.3 / 24.7 / 5.9 %. The windings
     * 5 / 15 / 45 are an octave-ish ladder and **all three divide 90**, so each level's quarter-period phase
     * (18 / 6 / 2) is an integer number of degrees.
     *
     * ⚠️ **Read it beside `Quader Faceted`** — global 1 against per-level `[1, 0, 0]` is the pair that shows
     * per-level is not just "less sharpness". ⚠️ **The two are NOT adjacent in the grid**: the standing rule since
     * `31.R` is that every demo sits at the library's END (`atEnd`, reversing `30.D17`), and that rule wins over
     * a placement request.
     */
    preset: {
      metadata: {
        name: 'Multiple Faceted Core',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'abstract'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 20160,
        waveSpeed: 0.05,
        rotation: [
          2.0100000000000002,
          6.93,
          5.73
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 18,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 5,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 25,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 2,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 6,
                am: {
                  base: 9,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 15,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 6,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 2,
                am: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 45,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 45,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 3,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 18,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          20,
          20,
          40
        ],
        colorAmp: [
          80,
          80,
          200
        ],
        colorFreq: [
          0.2709,
          574.5,
          176.9
        ],
        colorShift: [
          -0.1,
          0.5,
          1.1
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.96,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0.0252858,
              -0.02968797,
              0.08991147,
              0.01514526
            ],
            [
              8.474438,
              -2.0501366,
              -2.3632061,
              7.420106
            ],
            [
              0.08508337,
              -0.03149176,
              -0.03018411,
              0.02868106
            ],
            [
              5.108307,
              -11.202013,
              -0.19580902,
              -10.04513
            ]
          ],
          sinMagicParams2: [
            [
              -0.1,
              0,
              0,
              0
            ],
            [
              -0.5,
              0,
              0,
              0
            ],
            [
              -0.1,
              0,
              0,
              0
            ],
            [
              0.5,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 1,
        filmLook: 'Customize',
        palette: 'Cycle: Deep Blue',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        sharpness: 1,
        sharpnessStructure: 0,
        sharpnessDetail: 0,
        growX: 0.73,
        growY: 0.78,
        growZ: 0.67,
        growDepthX: -0.73,
        growDepthY: -0.74,
        growDepthZ: -0.94,
        growRateX: 16.181534008610157,
        growRateY: 20.922525886514254,
        growRateZ: 2.125317138365222,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 7,
          depthSize: 0.4,
          depthBrightness: 0.35,
          depthDof: 0.3,
          depthColorShift: 0.25,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.8,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════
   * v8 `35.6` — THE WARP SHAPE DEMOS. Eight entries, all `atEnd`.
   *
   * ⚠️⚠️ **WHY THESE ARE NOT COSMETIC, MEASURED 2026-10-29: BEFORE THEM, ZERO PRESETS IN A 325-PRESET
   * LIBRARY REFERENCED `shape`, `shapeMix`, `shape2`, `shapeMix2` OR ANY OF THE THREE PHASE 35
   * ARCHETYPES.** `35.1`/`35.2`/`35.4` built, instrumented and documented the whole shape palette with
   * nothing using it. **A key no preset authors is not COVERED by a green checker; it is INVISIBLE to
   * one** — the same sitting proved that on `mixercheck` §O, which had passed VACUOUSLY over all 28 of
   * Phase 34's registry keys for an entire phase and found two real defects in ITSELF the moment eleven
   * demos authored them (observable set 64 → 87). **These eight are what make every shape clause
   * non-vacuous.**
   *
   * ⚠️⚠️ **`shapeMix: 0` AND `shape: 'sine'` ARE BOTH THE IDENTITY** (`StaticFieldConfig.shape`'s own
   * doc), so a demo that names a shape and leaves the mix at 0 renders a SINE field and demonstrates
   * nothing. **Every entry below carries a non-zero mix, and the difference was MEASURED rather than
   * assumed** — max |Δ| of the resolved `waveX`/`waveY` (and `zoomX`/`zoomY` on style 3) against the same
   * body at `shapeMix: 0`, through `resolveStaticWaves` at 1920×1080. Figures are per entry. ⚠️ **They
   * are not a frame-rate or a pixel-on-screen claim**: they are differences in the gain-solved wave
   * table, which is the quantity a shape owns.
   *
   * ⚠️ **ONE- OR TWO-TERM TABLES THROUGHOUT, and the reason is measured, not aesthetic:** curvature
   * concentration runs 1.56 → 169 at ONE term against 2.34 → 23.7 at three, so **a rich multi-term table
   * HIDES the shape** — the opposite of what makes a good sine field (spec §12.4).
   *
   * ⚠️⚠️ **NO `square` + `drift` DEMO, AND THAT IS DELIBERATE.** `rollToRange` **REFLECTS** off the
   * bounds — it is neither a wrap nor a clamp — so with a discontinuous wave **the reflection point
   * itself jumps between frames** whenever `drift` is non-zero, giving an unpredictable fold instead of a
   * travelling lattice. Recorded as a KNOWN-UNTESTED COMBINATION rather than an oversight, and the spec's
   * own reason for recording it is that *it is the first thing an author will try after the flagship*.
   * **Both discontinuous shapes (`square`, `sawtooth`) therefore carry `drift: 0` here; `trapezoid` and
   * `triangle` are continuous and drift freely.** Do not add the missing combination to "complete" the
   * set.
   *
   * ⚠️ **TWO SHAPES ARE DOWNSTREAM OF A LOOK VERDICT NOBODY HAS TAKEN.** `triangle` and `trapezoid` both
   * measured as mere REFINEMENTS of sine (`shapecheck` §H puts `trapezoid` at 3.0 px in sine's own tear
   * class against `square`'s 71.0), and the judgement is owed to an EYE. **The couplings are written out
   * so a cut is one edit rather than a hunt:**
   *   - cut `trapezoid`  ⇒ delete `Warp Trapezoid Ribbon`, and the `Terraced Swell` archetype with it.
   *   - cut `triangle`   ⇒ delete `Warp Triangle Weave`, and set `Warp Split Shapes`' ZOOM half back to
   *                        `shape2: 'sine'` (which is where its own second-function carrier dies).
   * This is the project's standing finding in its fifth instance: `E121`, `E131`, `E136` and `E127` were
   * each found defective, FIXED, measured good and cut anyway. **Correctness is not the binding
   * constraint — plan around it.**
   *
   * ⚠️⚠️ **SUPERSEDED 2026-10-29 — THIS PARAGRAPH SAID THE ANGLES WERE NOT BUILT AND THEY ARE.** `35.3`
   * and `35.4` both landed: `WAVE_ANGLE_TRACK`, `waveAxisMap` and the rotated `maps` are live, and the
   * sliders are in both static-field editors. ✅ **AND THE DEMOS ARE NOW BUILT TOO (2026-10-30): `Warp
   * Oblique Ridge` (28/28), `Warp Chevron Score` (28/−28) and `Warp Zoom Oblique` (`angleX2`/`angleY2`
   * 45/45) carry the library's first non-zero wave angles.** ⚠️ **#10's `Chevron Press` archetype was cut
   * by `35.D7`, so `Warp Chevron Score` reaches the chevron through the ANGLES on `Interference` instead —
   * which is the better demonstration, since the splay is what makes the pattern and no shared angle or
   * frequency ratio can.** ⚠⚠ **ONLY #9 `Warp Parallel Rake` STAYS ABSENT, AND THE REASON IS MEASURED
   * RATHER THAN OWED: on a table whose two axes are EXACT OPPOSITES a parallel pair cancels ANALYTICALLY —
   * `Interference` at 45/−45 and `Diagonal Shear` at 90/0 both measure 0.00 px, while `Coarse Swell` at
   * 90/0 measures 61.03 px. A preset that renders NOTHING is not a demo, so that case is a MANUAL sitting.** ⚠️ **`Oblique Lattice` IS NOW GENUINELY OFF-AXIS without any angle** — the owner took the
   * sign-antiphase table (`xFreq [3, 7]` / `yFreq [-3, -7]`), measuring 1.363 from the shipped set against
   * 0.849 for the mirrored pair it first shipped as, because **an archetype is a TABLE and cannot carry an
   * `angleX`/`angleY` default, so a name promising obliqueness has to be true of the table alone.**
   *
   * ✅ **AND THAT VACUITY IS NOW CLOSED, WHICH IS THE WHOLE REASON THE THREE WERE AUTHORED: while no preset
   * authored an angle, the four angle keys were INVISIBLE to every green clause rather than covered by them
   * — the same hole that left `mixercheck` §O and `shapecheck` §G1 passing over keys nothing exercised.**
   * ⚠⚠ **AND IT PAID OUT IMMEDIATELY: the first angle carrier turned `shapecheck` §N4a RED, which was a
   * FOURTH instance of the same clause defect — its baseline was *the layer as authored*, so it compared a
   * tilted field against an untilted one over a bit-exact engine. Fixed in the checker, not the presets.**
   *
   * ⚠️ **ALL EIGHT ARE `atEnd`** (owner, 2026-10-25, reversing `30.D17`), and `after` still records which
   * parent each is one change from, because that pairing is the attribution and is what `democheck`
   * reads. ⚠️ **`democheck` has NO `PAIRS` row for any of these — that is OWED**, and it is outside
   * `verify` and a smoke test whose own variance exceeds its 1.6× margin, so never tune one of these
   * bodies to satisfy it.
   * ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  {
    after: 'Cylinder',
    name: 'Warp Square Mosaic',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Warp Square Mosaic_20261030_155210.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️⚠️ **THE COLOUR AND LOOK PARAGRAPHS BELOW ARE SUPERSEDED, AND THE OWNER'S EXPORT ANSWERED THE QUESTION
     * THEY LEFT OPEN: the body now reads `Cycle: Solar`/`index` under `Legacy Graded`, so `Void` is GONE.** The
     * dimness note below says in writing that `Void` (exposure 0.70, vignette 0.60) was the limit a palette
     * could not lift and that changing the look was the owner's call — this is that call, taken.
     *
     * v8 `35.6` demo 1 — **THE FLAGSHIP, and the image the whole phase exists for.** `shape: 'square'` at
     * `shapeMix: 1.0` on style 0: the wave's basis is a hard ±1 square, so the displacement field becomes
     * piecewise CONSTANT and the warp moves whole blocks rather than bending them. **Nothing else in this
     * engine makes hard rectilinear structure** — that is the phase's one claim that is a difference in
     * CATEGORY rather than a refinement (trap 5), and it is why `square` and `sawtooth` justify the shapes
     * while `triangle`/`trapezoid` are still owed an eye.
     *
     * **What a viewer should SEE:** a brick-course mosaic — a coarse lattice of flat-shifted tiles with
     * visible straight seams between them, built up over the trail. Against the four shipped transmap
     * demos (every one of them a SINE field) the difference is the presence of straight edges at all.
     *
     * ⚠️ **`Brick Weave` rather than spec §12.5's `Coarse Swell`, and the spec contradicts itself here:**
     * its own §12.8 coverage table assigns `Brick Weave` to this demo while its §12.5 body says
     * `Coarse Swell`. `Brick Weave` is taken because the archetype was DESIGNED for exactly this picture —
     * its `provenance` says so, *"7:3 against 3:7 … which is what reads as a brick course rather than a
     * lattice"* — and because it is one of the three new entries that had no carrier at all. ⚠️ It is the
     * one CROSSED table in the set (X `[7,3]`, Y `[3,7]`), and **slot order is part of its identity**:
     * swapping either pair silently stops it identifying while changing nothing on screen.
     *
     * ⚠️ **`drift: 0` DELIBERATELY** — see the block comment: `square` plus drift makes `rollToRange`'s
     * reflection point jump between frames. This demo is about the lattice, not the motion.
     *
     * ⚠️ **`transMapDispersion: 0` is load-bearing although it is also the engine default.** Chromatic
     * dispersion softens precisely the edge this demo is about, so the value is authored to say the choice
     * was made rather than inherited.
     *
     * `decayFactor: 0.80` is longer than `Shift Lattice Drift`'s 0.72 because **the mosaic is built by
     * accumulation**: one frame shows displaced points, many frames show the tiling.
     *
     * **Colour is authored EXPLICITLY** (`palette: 'Pastel'`, `paletteMapping: 'index'`) rather than
     * left to the look: `Void` carries `palette: 'Midnight'`, and a look only SETS a palette when it has
     * one, so relying on it here would have shipped a hue this demo does not want. Hard edges want hard
     * optics — `Void` is the crispest named look, near-black surround, exposure 0.70.
     *
     * ⚠️⚠️ **PALETTE RE-AUTHORED 2026-10-31 (owner, after the brightness sweep): `Monochrome`/`index` →
     * `Pastel`/`index`, and the ORIGINAL REASONING SURVIVES THE CHANGE — read why, because "hue-free" was
     * the stated want and `Pastel` is not.** The want behind it was *a silhouette defined by geometry
     * rather than by colour*, and a greyscale ramp does not deliver that: `Monochrome` runs 0 → 255, so
     * under the index law a large part of the population is darker than mid and some of it is BLACK —
     * brightness then carries shape information the geometry did not put there. **`Pastel` is FLAT in
     * luminance (min 178, max 179, measured over its 256-entry LUT), so every particle is equally bright
     * and only hue varies** — which is the stronger form of the same intent. Measured on this preset:
     * mean 1.26 → 2.10, sd 5.76 → 8.40, lit pixels 4.63 % → 6.94 % (**1.7×**).
     *
     * ⚠️ **IT ALSO MAKES DEMOS 1 AND 2 A ONE-FIELD A/B.** `Warp Sawtooth Blade` moved to the same
     * `Pastel`/`index` in the same sitting, so the pair now differs in `shape` (plus its own look and
     * `decayFactor`) rather than in colour as well — the comparison the two headers claim to support.
     *
     * ⏳ **AND THE REMAINING LIMIT IS NOT THE PALETTE: it is `Void` itself** (exposure 0.70, vignette
     * 0.60), which is why 1.7× is all a palette can buy here and this stays the dimmest of the eleven warp
     * demos. **Changing the look would change what the demo is** — it was chosen as the crispest surround
     * — so that is an owner decision and was not taken. `Classic: candy`/`index` is the brighter
     * alternative at 2.2× (mean 2.75, sd 10.23) and costs one word, at the price of a luminance ramp
     * (197 → 230) instead of a flat one.
     *
     * ✅ **MEASURED against this same body at `shapeMix: 0` (1920×1080, `resolveStaticWaves`, phase 0):
     * `waveX`/`waveY` max |Δ| = 54.98 px against a sine peak of 55.02 — 0.999×.** The field is not
     * perturbed, it is REPLACED: the largest disagreement is the size of the whole sine wave.
     */
    preset: {
      metadata: {
        name: 'Warp Square Mosaic',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'shape',
          'square',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 6000,
        waveSpeed: 0.05,
        rotation: [
          -7.22,
          10,
          -2.59
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          4.815,
          4.241,
          1
        ],
        colorShift: [
          0.397,
          0.612,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.8,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        palette: 'Cycle: Solar',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Brick Weave',
              strength: 0.9,
              detail: 1,
              drift: 0,
              shape: 'square',
              shapeMix: 1
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 2.309215172096753,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        }
      }
    },
  },
  {
    after: 'Cylinder',
    name: 'Warp Sawtooth Blade',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Warp Sawtooth Blade_20261031_174635.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ✅ **The export KEEPS `Pastel`/`index`**, so the invisibility measurement below still describes the colour
     * this body ships; the count, grading and warp values are the owner's.
     *
     * v8 `35.6` demo 2 — `shape: 'sawtooth'` at mix 1.0 on style 0. **Different in KIND from `square`,
     * not a variant of it:** `sawtooth` is **the only shape in the palette that is not EVEN**, a monotone
     * ramp then a single jump per period, so the field acquires a DIRECTION that no even basis has. It
     * also carries the highest curvature concentration of the five.
     *
     * **What a viewer should SEE:** wedge and blade forms — each cell ramps smoothly one way and snaps
     * back, so the trail reads as a comb of one-sided slivers rather than as a symmetric lattice. The
     * asymmetry is the subject; against demo 1 the difference is that these shapes have a handedness.
     *
     * ⚠️ **`Diagonal Shear` is chosen to ALIGN with that handedness rather than fight it** — equal
     * frequency, opposite sign (`4` / `−4`), the antiphase family in its simplest form, so the ramp runs
     * along the shear instead of across it. One live slot per axis, which is the one-term territory
     * §12.4's measurement asks for.
     *
     * ⚠️ **`drift: 0`, for the same `rollToRange` reason as demo 1** — `WARP_SHAPE_DISCONTINUOUS` is true
     * for `sawtooth` as well as `square`, and §12.7's reasoning is about discontinuity, not about the word
     * *square*. **Read the `Record`, never the demo list.**
     *
     * ⚠️ **A LOOK TO TAKE while this is on screen, and it is cheap: flip `strength` NEGATIVE and confirm
     * the blades reverse direction.** That is the claim that a *falling* sawtooth needs no control of its
     * own because `strength` has been signed since 2026-09-22 — if it does not reverse, the sign is not
     * passing through the shaped branch.
     *
     * `decayFactor: 0.84`. `Dramatic` (exposure 1.6, the strongest in the set) suits a high-contrast
     * silhouette; colour is authored explicitly as `Pastel` under `index`, because `Dramatic`'s own
     * `Prismatic` palette under `velocity` would spread hue across the blades and hide their shape.
     *
     * ⚠️⚠️ **PALETTE RE-AUTHORED 2026-10-31 (owner): `Cycle: Embers`/`phase` → `Pastel`/`index`, AND THE
     * ORIGINAL PAIR MADE THIS DEMO INVISIBLE — mean 0.31 of 255, sd 1.63, 0.94 % of pixels above the 8-bit
     * floor, the dimmest of all eleven warp demos by a factor of four and eighty times below their
     * median.** ⚠️ **THE CAUSE WAS THE PALETTE AND NOTHING ELSE, measured by substitution: `Cycle: Embers`
     * is the DIMMEST ENTRY IN THE WHOLE REGISTRY and its BRIGHTEST point (luminance 64) is darker than
     * most palettes' darkest** — so no mapping could rescue it (`phase` → `index` gave 0.40) and neither
     * could the look (`Dramatic` → `Legacy` gave 0.34). **A palette can clip a demo to a quarter
     * brightness before any grading runs, and nothing in `verify` measures what a preset puts on screen.**
     *
     * ✅ **`Pastel`/`index` measures mean 7.42, sd 21.27, lit 15.32 % — 24× the mean and 13× the structure**,
     * and it serves the sentence above BETTER than a greyscale would: `Pastel` is FLAT in luminance (min
     * 178, max 179 over its LUT), so no particle drops out and the comb's handedness is carried by
     * geometry alone. `index` rather than `phase` for the same reason the sentence gives — `phase` runs hue
     * ALONG the curve, which is the spreading this demo rejects. ⚠️ **`Classic: candy`/`index` is brighter
     * still (28×, mean 8.84) and is one word away; it was not taken because its luminance RAMPS (197 → 230)
     * and that puts shape information into brightness.** `Warp Square Mosaic` took the same `Pastel`/`index`
     * in the same sitting, so demo 1 ↔ demo 2 is now a one-field A/B on `shape`.
     *
     * ✅ **MEASURED against this same body at `shapeMix: 0`: `waveX`/`waveY` max |Δ| = 80.92 px against a
     * sine peak of 52.32 — 1.547×, the JOINT LARGEST of the eight with `Warp Ridge Blades`.** ⚠️ **A ratio
     * above 1 is not an error and it localises to the shape rather than to the gain:** `sawtooth` is the
     * one basis that is not even, so at a given index it can sit near `+1` where sine sits near `−1`, and
     * the disagreement exceeds either wave's own peak. `solveGain` normalises the PEAK, not the distance.
     */
    preset: {
      metadata: {
        name: 'Warp Sawtooth Blade',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'shape',
          'sawtooth',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 9800,
        waveSpeed: 0.05,
        rotation: [
          1.09,
          12.68,
          -0.61
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.84,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Pastel',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Diagonal Shear',
              strength: 0.85,
              detail: 1,
              drift: 0,
              shape: 'sawtooth',
              shapeMix: 1
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 0.5,
        figureScale: 1.6736721957917167,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 6.5,
          depthSize: 0.7,
          depthBrightness: 0.8,
          depthDof: 0.2,
          depthColorShift: 0.6,
          lightingMode: 3,
          lightDir: [
            0.7,
            -0.5,
            0.2
          ],
          rimPower: 2,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.7,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            0.9,
            0.9,
            0.9
          ],
          gain: [
            1.2,
            1.1,
            1
          ],
          saturation: 1.65,
          vignette: 0.4,
          palette: 'Prismatic',
          paletteMapping: 'velocity'
        }
      }
    },
  },
  {
    after: 'Warp Square Mosaic',
    name: 'Warp Shape Dimmer',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Warp Shape Dimmer_20261030_165912.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * v8 `35.6` demo 3 — **the `Shape mix` slider, read against demo 1.**
     *
     * ⚠️⚠️ **CORRECTION: THIS IS *NOT* A ONE-FIELD A/B, AND THIS COMMENT USED TO SAY IT WAS.** Measured
     * 2026-10-29 against `Warp Square Mosaic`: **FIVE leaves differ** — `shapeMix`, `filmLook`, `palette`,
     * `paletteMapping` and `decayFactor`. (Two of those are disclosed further down this very comment, which
     * is how the opening sentence survived: **a header can contradict its own later paragraphs and read as
     * consistent, because nobody compares a comment with itself.**) **So loading the two side by side shows
     * the mix difference PLUS a grading difference, and attributing all of it to `shapeMix` is wrong.**
     * ✅ **The honest one-field comparison is a MANUAL DRAG: load either preset and move `Shape Mix` alone
     * between 0.22 and 1.0.** The side-by-side is still worth having — it is what makes `shapeMix`'s LERP
     * observable to the Mixer — but it is a pair of presets, not a controlled experiment.
     *
     * `shapeMix: 0.22` instead of `1.0`. ⚠️ **`after` names `Warp Square Mosaic` rather
     * than `Cylinder` on purpose: the informative A/B here is against the full-mix flagship, not against
     * the unwarped figure.** Place the two side by side in the grid; **the pair IS the argument for the
     * slider being continuous rather than a checkbox.**
     *
     * **What a viewer should SEE:** a few-pixel CHATTER along the figure's edges instead of the mosaic's
     * flat tiles — the same square basis, admitted at a fifth of its weight. That is the half of the
     * decision that says the destructive shapes have a gradual approach, and the reason the control is a
     * mix at all: at 0.22 the field is 78 % sine, so the tear is a texture rather than a shred.
     *
     * ⚠️ **This is the entry that makes the `shapeMix` LERP observable to the Mixer**, which is what the
     * crossfade law needs: demo 1 and this one differ in exactly one interpolated scalar, so a blend
     * between them sweeps the mix with the categorical `shape` held equal and nothing to snap.
     *
     * `decayFactor: 0.88` — LONGER than demo 1's 0.80, and that is the one value not inherited:
     * **a small tear needs accumulation to read at all**, where the full mosaic is legible in a few frames.
     *
     * `Legacy Graded` deliberately — **the plainest look in the set.** This demo is about a QUANTITY, and
     * a strong grade would make it about the grade. `Legacy Graded` is one of the three looks carrying
     * `palette: 'none'`, so authoring `palette: 'none'` with `paletteMapping: 'depth'` agrees with it
     * rather than overriding it, and the figure's own grey colour pair carries the image.
     *
     * ✅ **MEASURED against this same body at `shapeMix: 0`: `waveX`/`waveY` max |Δ| = 12.10 px against a
     * sine peak of 55.02 — 0.220×, i.e. EXACTLY the authored mix.** That is the blend's arithmetic working
     * and it is the cheapest check that the mix is a weight rather than a switch: demo 1's 0.999× divided
     * by 0.22 lands here to three figures.
     */
    preset: {
      metadata: {
        name: 'Warp Shape Dimmer',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'shape',
          'mix',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 6000,
        waveSpeed: 0.05,
        rotation: [
          -12.68,
          0.65,
          -6.7
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.88,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Legacy Graded',
        palette: 'none',
        paletteMapping: 'depth',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Brick Weave',
              strength: 1.32,
              detail: 1,
              drift: 0.003,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'sawtooth',
              shapeMix: 1,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: -18,
              angleY: 23,
              angleX2: 0,
              angleY2: 0
            }
          },
          {
            style: 6,
            enabled: true,
            weight: 1
          }
        ],
        fluidFeedback: {
          persist: 0.98,
          amplify: 1.4,
          dispersion: 0,
          fieldDecay: 0.987,
          glowBoost: 0.25
        },
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 0.5,
        figureScale: 1.1558654978257918,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        }
      }
    },
  },
  {
    after: 'Shift Lattice Drift',
    name: 'Warp Triangle Weave',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * v8 `35.6` demo 5 — **AUTHORED AS A ONE-OPERATOR A/B AGAINST THE SHIPPED `Shift Lattice Drift`, and
     * that is the entire design. Do not "improve" any other field in this body.**
     *
     * Every value here is `Shift Lattice Drift`'s: `Interference`, `strength: 0.85`, `detail: 1.0`,
     * `drift: 0.25`, `decayFactor: 0.72`, `filmLook: 'Legacy Graded'`, `transMapWarpMix: 0.9`,
     * `transMapDispersion: 0`, `speedFactor: 0.5`, `Cylinder`'s waves at 6000, `rotation: [0, 3, 0]`,
     * design box 100×100. **The only difference is `shape: 'triangle'` + `shapeMix: 1.0`** — two keys
     * rather than one, because the mix is the operator's AMOUNT and `shape` alone is the identity.
     *
     * **What a viewer should SEE, and the question it answers:** straighter segments and tighter nodes in
     * the same drifting shear — the triangle basis replaces sine's rounded extrema with corners, so the
     * interference cell's crossings sharpen. **If that difference is not visible in this pair, `triangle`
     * has no case on the warp**, and cutting it also deletes `Warp Split Shapes`' zoom-half carrier.
     *
     * ⚠️ **It is also the most direct comparison available between two subsystems**: this is the same
     * basis the FIGURE's `Sharpness` slider interpolates toward (`wave-law.ts`' `triBasis`, held
     * bit-identical to the generator's inline copy by `deformcheck` §M), reached here through a per-layer
     * SELECTOR instead of a library-wide slider. The asymmetry is principled — the figure's basis must
     * stay inside Jones–Przytycki's family F because membership in F is what makes the knot type
     * invariant, and F is convex; **the warp has no knot to preserve**, which is why it may also offer
     * `trapezoid`, `square` and `sawtooth`, none of which is in F.
     *
     * ⚠️ **NO `overlay.palette` IS AUTHORED HERE, and that is the ONE place this body departs from the
     * standing "author colour explicitly" rule — deliberately, because the A/B outranks it.**
     * `Shift Lattice Drift` authors no palette either, and `Legacy Graded` is one of the three looks whose
     * `palette` is `'none'`, so it ABSTAINS and writes nothing: the colour comes from the figure's own
     * grey `colorBase`/`colorAmp` pair in both presets. **Adding a palette to only one half would make the
     * pair differ in two things and settle nothing.**
     *
     * ✅ **MEASURED against this same body at `shapeMix: 0`: `waveX`/`waveY` max |Δ| = 10.83 px against a
     * sine peak of 51.93 — 0.208×, THE SMALLEST RELATIVE DIFFERENCE OF THE EIGHT.** ⚠️ **That is the
     * expected result and not a weak authoring**: a triangle shares sine's zeros AND its ±1 peaks (two of
     * the three family-F conditions), so the two bases can differ only in the curvature between them —
     * which is also the entire reason the figure's `Sharpness` is provably knot-preserving. **The ratio is
     * the measurement that makes the look verdict a real question rather than a formality.**
     */
    preset: {
      metadata: {
        name: 'Warp Triangle Weave',
        version: 2,
        designResolution: { width: 100, height: 100 },
        tags: ['demo', 'transmap', 'style0', 'shape', 'triangle', 'review'],
      },
      generators: {
        type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
        rotation: [0, 3, 0], angle: [0, 1, 0],
        waves: cylinderFigureWaves(),
        colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
      },
      renderer: { mode: 'star', glow: 2.2, decayFactor: 0.72, blurRadius: 3, depthSize: 0, streaks: 0 },
      postProcessors: {
        transMap: {
          enabled: true, style: 0, beforeParticles: false,
          sinMagicParams: shapeDemoRippleTable(), sinMagicParams2: shapeDemoZeroTable(),
          zoomCenter: { x: 50, y: 50 },
        },
        ...shapeDemoInertGrading(),
      },
      overlay: {
        renderMode: 'star', filmLook: 'Legacy Graded',
        transMapEnabled: true, transMapStyle: 0,
        transMapChain: [
          { style: 0, enabled: true, weight: 1.0,
            staticField: {
              pattern: 'Interference', strength: 0.85, detail: 1.0, drift: 0.25,
              shape: 'triangle', shapeMix: 1.0,
            } },
        ],
        transMapWarpMix: 0.9,
        transMapDispersion: 0,
        speedFactor: 0.5,
      },
    },
  },
  {
    after: 'Cylinder',
    name: 'Warp Ridge Blades',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Warp Ridge Blades_20261031_175300.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️⚠️ **THE COLOUR PARAGRAPH BELOW IS SUPERSEDED: the export maps `Cycle: Solar` under `phase` and turns
     * `Ribbon Rendering` to `adaptive`.** The 2026-10-31 note about `Cycle: Azure` describes the body this one
     * replaced; the reasoning it records (a `phase` mapping runs hue ALONG the ridge, and a dark ramp took the
     * ridge's profile out of view) is why the owner's own pick is also a bright member under `phase`.
     *
     * v8 `35.6` demo 8 — **NOT one of spec §12.5's ten. It exists for one measured reason: `Oblique
     * Lattice` is one of the three archetypes `35.6` shipped and it had NO CARRIER ANYWHERE, so nothing in
     * the library exercised it and `shapecheck` §M's identification map ran over a table no preset uses.**
     *
     * ⚠️⚠️ **SUPERSEDED 2026-10-29 — THIS PARAGRAPH USED TO SAY `Oblique Lattice` IS NOT OBLIQUE, AND IT
     * NO LONGER APPLIES.** It did when this demo was written: the table was then the MIRRORED 3:7 pair,
     * axis-aligned, measuring 0.849, and the 1.393 the spec quoted for it was an ANGLE figure. ✅ **The
     * owner then took the SIGN-ANTIPHASE table (`xFreq [3, 7]` / `yFreq [-3, -7]`), which is the route
     * `static-field.ts` already documents at `Diagonal Shear`, so the lattice now runs genuinely off-axis
     * and measures 1.363 from the shipped set with 0 relabels.** ⚠️ **The reason a rename was not the fix is
     * worth keeping: AN ARCHETYPE IS A TABLE and cannot carry an `angleX`/`angleY` default, so a name
     * promising obliqueness has to be true of the table ALONE — a demo cannot rescue it.**
     *
     * ⚠️ **So this demo's subject MOVED UNDER IT WITHOUT ITS BODY CHANGING.** It still carries no angle and
     * still needs none; what it pictures is now an off-axis pair rather than a mirrored one. **That is the
     * hazard of describing a demo by its archetype's look instead of by the fields the demo itself sets** —
     * nothing in `verify` relates a preset's comment to the table it names.
     *
     * **What a viewer should SEE:** broad ridges whose profile is one-sided — `sawtooth` ramps each ridge
     * up and drops it, so the two harmonics give long swells with a repeated blade-edge riding them. The
     * contrast with `Warp Sawtooth Blade` is the TABLE, not the shape: that demo is one antiphase slot per
     * axis (a diagonal comb), this one is two mirrored slots (ridges at two scales).
     *
     * ⚠️ **It is also the set's only MULTI-TERM shaped table, and that is instrumentally load-bearing
     * rather than decorative.** `35.2`'s own build record measured that the unshaped-probe defect is
     * **1.000 on a single-term `Grid Lattice`** — i.e. completely invisible — **and 1.493× on a four-term
     * `Turbulent Weave`**: a single-term basis is BLIND to it. A two-slot shaped table in the library is
     * the cheapest standing carrier of that sensitivity. ⚠️ It is also the one entry that sits against
     * §12.4's *few terms* rule, which is why the table is only TWO slots and the second is at 0.4.
     *
     * ⚠️ **`drift: 0`** — `sawtooth` is discontinuous, so the `rollToRange` reflection hazard applies
     * exactly as it does to `square`. Read `WARP_SHAPE_DISCONTINUOUS`, not the shape's name.
     *
     * `strength: 0.95`, a shade under demo 1's: two live slots per axis sum to 1.4 before normalisation,
     * so the realised peak sits slightly higher for the same number. `decayFactor: 0.84`.
     * `Cinematic` (exposure 1.4, `palette: 'none'`, so it ABSTAINS) with colour authored explicitly as
     * `Cycle: Azure` under `phase` — phase mapping runs the hue along the ridge rather than across it.
     *
     * ⚠️ **PALETTE RE-AUTHORED 2026-10-31 (owner): `Cycle: Indigo` → `Cycle: Azure`, SAME FAMILY, SAME
     * MAPPING — the mapping is load-bearing here (it is what runs hue along the ridge) so only the member
     * changed.** `Cycle: Indigo` is a dark member (LUT luminance 0 → 154, mean 73) and this demo measured
     * mean 3.10 / sd 7.60 / lit 6.81 %, third-dimmest of the eleven warp demos and a third of their
     * median; `Cycle: Azure` is the bright member of the same family (106 → 234, mean 171) and measures
     * **mean 10.03 / sd 24.20 / lit 16.78 % — 3.2× both**, which puts it mid-pack. ⚠️ **A floor of 106
     * rather than 0 is the part that matters: under `phase` the hue runs along the ridge either way, but
     * with `Indigo` the dark end of the ramp took the ridge's own profile out of view.**
     *
     * ✅ **MEASURED against this same body at `shapeMix: 0`: `waveX`/`waveY` max |Δ| = 89.60 px against a
     * sine peak of 58.08 — 1.543×, the JOINT LARGEST of the eight with `Warp Sawtooth Blade`.** ⚠️ **The
     * two sawtooth demos landing at 1.547× and 1.543× on COMPLETELY DIFFERENT TABLES is a property of the
     * BASIS, not of either table** — which is what makes it a usable sanity figure and what makes the
     * visible difference between the two demos a question about the tables alone.
     */
    preset: {
      metadata: {
        name: 'Warp Ridge Blades',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'shape',
          'sawtooth',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10600,
        waveSpeed: 0.05,
        rotation: [
          0,
          3,
          0
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.84,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'adaptive',
        splatShear: 'tangent',
        ribbonWidth: 11.5,
        linesEnabled: false,
        lineWidth: 4,
        filmLook: 'Customize',
        palette: 'Cycle: Solar',
        paletteMapping: 'phase',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Oblique Lattice',
              strength: 0.95,
              detail: 1,
              drift: 0,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'sawtooth',
              shapeMix: 1,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: 0,
              angleY: 0,
              angleX2: 0,
              angleY2: 0
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1.51,
        figureScale: 1.2327247073043632,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0.8,
          depthBrightness: 0.6,
          depthDof: 0.4,
          depthColorShift: 0.5,
          lightingMode: 1,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.6,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2,
          lift: [
            0,
            0,
            0.02
          ],
          gamma: [
            1,
            0.98,
            0.95
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1.3,
          vignette: 0.3,
          palette: 'none',
          paletteMapping: 'depth'
        }
      }
    },
  },
  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════
   * v8 `35.7` — THE ORIENTATION-ANGLE DEMOS. Three entries, all `atEnd`. Spec §12.5's owed demos #8 and
   * #10, plus one the spec never wrote: a carrier for the ZOOM half's pair.
   *
   * ⚠️⚠️ **MEASURED 2026-10-30, BEFORE THESE THREE: ZERO PRESETS IN A 333-PRESET LIBRARY AUTHORED
   * `angleX`, `angleY`, `angleX2` OR `angleY2`.** `35.3` built the rotated sampling, `35.4` built the
   * sliders, both notices and the predicate, and nothing used any of it. **A key no preset authors is not
   * COVERED by a green checker, it is INVISIBLE to one** — the same vacuity let `mixercheck` §O pass over
   * all 28 of Phase 34's registry keys for a whole phase and `shapecheck` §G1 over the shape keys, and
   * both exposed real clause defects in THEMSELVES the moment demos authored them. ⚠️ `mixercheck` had
   * been PRINTING six of Phase 34's names in its own *"unobservable in this pairing"* list the whole time:
   * **that list was the gap report and was read as a set of exclusions.**
   *
   * ⚠️⚠️ **THE CANCELLING PAIR IS DELIBERATELY NOT SHIPPED.** Spec §12.5's demo #9 `Warp Parallel Rake`
   * is the PARALLEL configuration, and on style 2 a parallel pair over a symmetric table cancels
   * ANALYTICALLY: measured here 2026-10-30 through `measureStaticField`, `Interference` style 2 at 45/−45
   * and `Diagonal Shear` style 2 at 90/0 both give **0.00 px** — `solveGain` honestly returns 0, the built
   * arrays come out all-zero and the engine draws nothing. (`Coarse Swell` style 2 at 90/0 gives 61.03 px
   * instead, because there `wy = +wx` and the sum is twice the wave rather than zero.) **A preset that
   * renders nothing is not a demo**; the parallel configuration belongs to a manual sitting with the
   * `wavesParallel` / `wavesCancel` notices in view, which is where `35.4` put its remedy. Style 0 — all
   * three entries below — cannot cancel at all, because its two waves drive different OUTPUT axes.
   *
   * ⚠️ **±90, NEVER 0–360, and both reasons are load-bearing:** `(angle + 180, −amp)` is bit-identical, so
   * a full circle offers every distinct field twice; and ±90 has no wrap, which is what makes
   * `blendLayerBlocks()`' plain `mix()` the shortest path. Every value below is a whole degree, which
   * `WAVE_ANGLE_TRACK` can represent exactly (`trackcheck` §M owns that claim).
   *
   * ⚠️ **ALL THREE ARE PURE SINE — no `shape`, no `shapeMix`.** Spec §12.8's second open gap says a preset
   * carrying a new angle AND a new shape would not say which produced the image, and that is exactly the
   * question a screening pass has to answer. **Do not add a shape to any of these three.**
   *
   * ⚠️ **ALL THREE ARE `atEnd`** (owner, 2026-10-25, reversing `30.D17`), and `after` records which parent
   * each is one step from. ⚠️ **`democheck` has no `PAIRS` row for any of them and its own variance
   * exceeds its 1.6× margin — never tune one of these bodies to satisfy it.**
   * ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  {
    after: 'Warp Oblique Ridge',
    name: 'Warp Chevron Score',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Warp Chevron Score_20261030_161003.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️ **A SECOND export of this demo was added under its own name in the same batch — `Cylinder
     * Kaleidoskope`** — so the two are siblings rather than versions, and a leaf diff between them is the
     * honest way to see what the owner changed.
     *
     * v8 `35.7` demo 10 — **THE SPLAY: one angle positive, the other negative, which is the configuration
     * that proves these are TWO controls and not one.** Spec §12.5's demo #10.
     *
     * **WHAT TO EXPECT:** herringbone. The X wave samples along +28° and the Y wave along its baked-in
     * quarter turn minus 28°, i.e. +62°, so the two families cross at 34° instead of 90° and the lattice
     * becomes a scored chevron texture rather than a tilted grid. Against `Warp Oblique Ridge` — the same
     * body with `angleY` the other sign — the difference is that the cells LEAN AGAINST each other.
     *
     * **THE SETTING THAT CARRIES IT:** `angleY: -28`. That is the whole difference from
     * `Warp Oblique Ridge`.
     *
     * **WHERE IT IS:** **Transmap** tab → `Pattern` section → the `Angle` row, cell `Y`.
     *
     * **HOW TO VERIFY:** set `Angle Y` to +28 and the chevrons must become the parallel tilted grid of
     * `Warp Oblique Ridge`; set both cells to 0 and the lattice must snap square to the frame. **The splay
     * is what makes the pattern** — a shared angle cannot produce it and neither can any frequency ratio.
     *
     * ⚠️ **NOT `Chevron Press`, which the spec names:** that archetype was cut by `35.D7` as reachable
     * with one dropdown click plus one `Detail` drag, so the chevron has to come from the ANGLES, which is
     * the better demonstration anyway.
     *
     * ⚠️ **28/−28 is NOT the parallel case.** Parallel is `angleY + 90° ≡ angleX`, i.e. `angleY = −90` at
     * `angleX = 0`; here the two sampling directions are 34° apart. `shapeNoticeKeys()` is the owner of
     * that test and it reads `WAVE_QUARTER_TURN`, never a literal 90.
     *
     * ✅ **MEASURED against this same body at all four angles 0: max |Δ| = 80.00 px at 1440×900 against an
     * identity peak of 60.81 px (1.32×); 100.00 px against 73.54 px at 1920×1080.** ✅ **And MEASURED
     * against `Warp Oblique Ridge` itself — the splay is not a re-description of the tilt: ONE differing
     * leaf (`angleY`), and the two resolved fields disagree by 86.00 px at 1440×900, i.e. 1.41× the
     * identity peak, which is MORE than either of them differs from the untilted field (80.00 px, 1.32×).
     * At 1000×1000 the gap is wider still in relative terms: 94.00 px / 1.39× against 65.00 px / 0.96×.**
     *
     * ✅ **MEASURED leaf diff against `Warp Oblique Ridge`: ONE leaf, `angleY` (+28 → −28).**
     */
    preset: {
      metadata: {
        name: 'Warp Chevron Score',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'angle',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 6000,
        waveSpeed: 0.05,
        rotation: [
          0,
          8.09,
          -0.1
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.72,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Plasma',
        palette: 'Neon',
        paletteMapping: 'velocity',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Interference',
              strength: 0.85,
              detail: 1,
              drift: 0.25,
              angleX: 28,
              angleY: -28
            }
          }
        ],
        transMapWarpMix: 0.9,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 0.5,
        figureScale: 1.2327247073043632,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        }
      }
    },
  },
  /* ═════════════════════════════════════════════════════════════════════════════════════════════════════
   * v8 `34.5` — THE SIX UNCARRIED PHASE 34 KEYS. Three entries, all `atEnd`, each adding ONE operator's
   * pair to a sibling that already carries its base.
   *
   * ⚠️⚠️ **MEASURED 2026-10-30: of Phase 34's twenty-eight registry keys, SIX still had no carrier in a
   * 333-preset library** — `offsetY`, `offsetZ`, `travelDepthX`, `travelRateX`, `growDepthZ` and
   * `growRateZ`. **A key no preset authors is not COVERED by a green checker, it is INVISIBLE to one**, and
   * these six are the case that proves it: `mixercheck` §O **has been printing all six names in its own
   * "unobservable in this pairing" list the whole time.** That list was the gap report, and it was read as
   * a set of exclusions. The eleven `34.x` demos closed twenty-two of the twenty-eight and moved the
   * observable set 64 → 87, which is when §O's two real clause defects surfaced.
   *
   * ⚠️⚠️ **`offsetZ` IS THE ONE KEY THAT REACHES THE `Offset` ROW'S Z DEPTH READOUT, and before
   * `Quader Deep Orbit` NOTHING IN THE LIBRARY COULD MAKE THAT READOUT APPEAR.** Its gate is the
   * operator's own identity — it says nothing while `offsetZ` and `travelZ` are both 0 (`34.D9`, corrected
   * from invariant 25's "gate on the early return", because the perspective divide has no switch).
   * `travelZ` has five carriers, so the readout was reachable; the Z OFFSET half of it was not.
   *
   * ⚠️ **Every rate below is an exact stop of `OP_RATE_TRACK`** — the geometric rate track with a sticky
   * zero — verified by round-tripping through `toPos`/`fromPos` at `OP_RATE_STEP`. **An authored value the
   * track cannot represent is a defect**, and a rate is the easiest place to write one: the spec's own
   * §12.3 demo rates were an order of magnitude below `OP_RATE_MIN`.
   *
   * ⚠️ **Every depth below clears its operator's DEAD ZONE** (`DEAD_ZONE_FRACTION = 0.08` of half travel,
   * so `TRAVEL_DEPTH_SNAP` 0.08, `OFFSET_SNAP` 0.16, `GROW_DEPTH_SNAP` 0.16). A depth inside the zone is
   * snapped to 0 by the setter and the key would be authored, exported, interpolated — and inert.
   *
   * ⚠️ **ALL THREE ARE `atEnd`** (owner, 2026-10-25). ⚠️ **`democheck` has no `PAIRS` row for any of them
   * and its own variance exceeds its 1.6× margin — never tune one of these bodies to satisfy it.**
   * ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
  {
    after: 'Quader Orbit Wreath',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Quader Deep Orbit',
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Quader Deep Orbit_20261030_154807.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️ **It authors `Cycle: Neutral` under `index`, which makes it a declared row in `palettecheck`'s
     * authored-`index` list where it had none before.**
     *
     * v8 `34.5` — **`offsetY` AND `offsetZ`: the orbit moved onto the Y axis and pushed deep into the
     * perspective divide. The library's only carrier of either, and the only route to the `Offset` row's Z
     * depth readout.**
     *
     * **WHAT TO EXPECT:** `Quader Orbit Wreath`'s swept arc, but riding above the centre and seen through a
     * much wider lens. At `offsetZ: -1.8` the whole figure sits deep enough that the perspective divide
     * magnifies it by about 1.5× and, more visibly, FORESHORTENS it: the near edge of the orbit looms and
     * the far edge recedes, so the ring reads as a tilted hoop in depth rather than as a flat circle. The
     * orbit itself still runs in the screen plane, because the rotation is Z only.
     *
     * **THE SETTINGS THAT CARRY IT:** `offsetY: 0.9` and `offsetZ: -1.8`, both in design HALF-EXTENTS.
     * `offsetX` is GONE (the sibling's 1.2), and `figureScale` is re-derived as framing — see below.
     *
     * **WHERE THEY ARE:** **Visual FX** tab → `Figure` group → `Framing & Timing` section → the `Offset`
     * row, cells `Y` and `Z`. **The depth sentence appears directly under that row** and only while
     * `offsetZ` or `travelZ` is non-zero. `Figure Scale` is the first row of the same section.
     *
     * **HOW TO VERIFY:** set `Offset Z` to 0 — the figure must jump back to its unmagnified size with flat,
     * even perspective, the depth sentence must DISAPPEAR, and only the lifted orbit is left. Then set
     * `Offset Y` to 0 as well and the preset is `Quader Orbit Wreath`'s figure centred and spinning in
     * place. ⚠️ **While `Offset Z` is non-zero the sentence must read 32 % at 1440×900** (30 % at
     * 1920×1080, 42 % at 1000×1000) — see the measurement below, and note that the number MOVES with the
     * window because both of its terms do.
     *
     * ⚠️⚠️ **THE HAZARD IS REAL AND THIS BODY IS MEASURED CLEAR OF IT: a culled particle reads as a streak
     * leaving the screen, never as a clamp.** `project()` answers `CULL_SENTINEL` for `q <= 0`, i.e. at
     * 100 % of the depth readout, and the magnification runs as `1/(1 − readout)` on the way there — which
     * is what sets the framing, not the offset. ✅ **Measured over three canvas shapes and four instants:
     * ZERO culled particles, and the projected figure reaches at most 0.99 of the half-frame (1000×1000,
     * the binding shape; 0.53/0.84 at 1440×900).**
     *
     * ⚠️ **`figureScale: 0.3747` is FRAMING and is derived, not taste.** It is the largest stop of the
     * logarithmic Figure Scale track that keeps the magnified figure inside the SHORT edge on all three
     * canvas shapes — a preset may only make that kind of bound (invariant 27). Raising it one stop at a
     * time trades frame for readout at a known rate: the readout is proportional to `figureScale` while the
     * reach grows faster, which is why 0.6/−2.0 at 0.4060 reads 38 % and does NOT fit (1.02 at 1000×1000).
     *
     * ⚠️ **The readout compares the MODEL z against a MODEL cull depth, so it is exact only where the pose
     * preserves z.** This body's rotation is `[0, 0, 10]` — Z only — so it does. ⚠️ **A figure rotating
     * about X or Y has its depth changed by the rotation AFTER `zMin` is taken, and the sentence then
     * describes a quantity the projection does not use.** That is a property of the readout, not of this
     * preset, and it is why the orbit here was left in the screen plane rather than tipped into depth.
     *
     * ✅ **MEASURED against ITS OWN IDENTITY FORM — this exact shipped body with `offsetY` and `offsetZ`
     * at 0 and nothing else touched — at 1440×900 over six instants, none of them frame 0 (invariant 28):
     * mean displacement 39.9 % of the identity figure's own XY span, max 54.7 %.** The model z envelope
     * moves from [−17.0, 24.0] to [−84.5, −43.5] with its SPAN unchanged at 41.0 — a pure translation,
     * which is what `Offset` claims to be. ⚠️ **Measured against the SIBLING instead — i.e. with
     * `figureScale` back at its 0.4472 — the same displacement reads 20.4–23.0 % mean and 39–46 % max,
     * because the denominator is a figure 19 % larger. TWO MEASUREMENTS WEARING THE SAME WORDS: the first
     * is the operator's own identity test, the second is the pair difference, and neither is the other.**
     *
     * ✅ **MEASURED leaf diff against `Quader Orbit Wreath`: FOUR leaves — `offsetX` 1.2 → absent,
     * `offsetY` absent → 0.9, `offsetZ` absent → −1.8, `figureScale` 0.4472 → 0.3747.** Everything else,
     * including the 25 000 particles, the `decayFactor: 0.975` long trail and the whole `Customize` grade,
     * is its sibling's byte for byte.
     */
    preset: {
      metadata: {
        name: 'Quader Deep Orbit',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 25000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          10
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 21,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 24,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 63
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 6,
                  frequency: 60
                },
                fm: {
                  base: 63,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 90,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 96,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 63
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 1,
                  amplitude: 1,
                  frequency: 60
                },
                fm: {
                  base: 105,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          21,
          21,
          21
        ],
        colorAmp: [
          64,
          32,
          32
        ],
        colorFreq: [
          4.615,
          0.9114,
          0
        ],
        colorShift: [
          0.066,
          -0.301,
          3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.975,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ],
            [
              10,
              -10,
              5,
              -5
            ],
            [
              0.1,
              0.101,
              0.505,
              0.5
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Neutral',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1.3,
        figureScale: 0.41933025446320704,
        offsetX: 0,
        offsetY: 0.69,
        offsetZ: -1.8,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.45,
          depthBrightness: 0.3,
          depthDof: 0.35,
          depthColorShift: 0.5,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.35,
          bloomIntensity: 0.4,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.16,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Pipes Sweep',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Sweep Breath',
    /*
     * ⚠️⚠️ **BODY REPLACED 2026-10-31 BY AN OWNER-FINETUNED EXPORT (`Pipes Sweep Breath_20261030_161856.json`), kept VERBATIM:
     * this object is exactly what `Import` hands `MigrationLayer.migrate`, and only `metadata.name` was
     * changed. The paragraphs below describe the demo's SUBJECT and were written against the body this
     * one replaced — so read every figure in them as belonging to THAT body unless it is re-measured
     * here.** An owner-tuned body outranks any authoring rule in this file.
     *
     * ⚠️ **It also became the library's carrier of five `travel` keys plus `sharpnessDepth`/`sharpnessRate`**
     * (`travelY`, `travelDepthY/Z`, `travelRateY/Z`) when `Cylinder Breathing Helix` and `Cylinder Crystal
     * Breath` were deleted in the same batch.
     *
     * v8 `34.5` — **`Stretch` on X: `travelDepthX` + `travelRateX`, the breathing of `Travel`. The
     * library's only carrier of either.**
     *
     * **WHAT TO EXPECT:** `Pipes Sweep`'s open arc — the one family of figure in the library with two free
     * ends — pumping along X. `travelX` swings 0.2 → 1.0 half-extents and back on a 14.8 s cycle, so the
     * stroke stretches out into a long sweep and then draws back into a nearly closed loop, and the
     * trail's leading end walks across the frame while the trailing end stays put. **The figure's own
     * topology changes appearance within one cycle, which is the thing `Travel` alone cannot show.**
     *
     * **THE SETTINGS THAT CARRY IT:** `travelDepthX: 0.4` (signed, in half-extents) and
     * `travelRateX: 8.0856…` (an exact stop of the geometric rate track) over the sibling's own
     * `travelX: 0.6`. `figureScale` is lowered as framing — see below.
     *
     * **WHERE THEY ARE:** **Visual FX** tab → `Figure` group → `Framing & Timing` section → the `Travel`
     * row (cell `X`, the base), then `Stretch` (the depth) and `Stretch Rate` (the period) directly below
     * it. The `Stretch Rate` readout prints the period, not the rate: it must say **repeats every 14.8 s**.
     *
     * **HOW TO VERIFY:** set `Stretch X` to 0. The sweep must freeze at a fixed length — the preset is
     * then `Pipes Sweep` at a smaller scale — and the `Stretch Rate` readout becomes inert. ⚠️ **Setting
     * `Stretch Rate X` to 0 instead ALSO stops it, and for a different reason: 0 means "never cycles" and
     * is the rate's identity**, so a depth with no rate is a static offset on the base. Both are worth one
     * drag each.
     *
     * ⚠️ **`travelDepthX: 0.4` over a base of 0.6 reaches `TRAVEL_MAX` exactly at the peak and does not
     * exceed it, so the resolved value touches its clamp for an instant and never DWELLS there.** The
     * clamp is on the resolved value and a deeper swing would hold the figure at full extension for a
     * measurable part of every cycle — a documented feature of the operator, and the wrong thing for a
     * screening preset.
     *
     * ⚠️⚠️ **`figureScale: 0.4472` IS A FRAMING FIX FOR A PRE-EXISTING OVERFLOW, NOT A TUNING CHOICE, AND
     * THE SIBLING'S OVERFLOW IS DOCUMENTED BEHAVIOUR.** `Travel` makes the figure OPEN and **nothing
     * auto-fits it** — `waveScale` is fixed from the design box at `init()` and no code measures the
     * curve's extent. ✅ **Measured: `Pipes Sweep` as shipped reaches 1.21 / 1.26 of the half-frame at
     * 1440×900 and 2.09 on the x axis at 1000×1000, i.e. it already runs off frame on every shape; adding
     * the breath takes that to 1.40 / 2.43 at the peak.** At `figureScale: 0.4472` (= 5^−½, an exact
     * track stop) the peak reaches 0.55 / 0.51 at 1440×900 and 0.91 at 1000×1000 — **inside the frame on
     * every shape, which is the only kind of bound a preset may make** (invariant 27) — with ZERO culled
     * particles. **A breath you cannot see both ends of is not a demo of a breath.**
     *
     * ✅ **MEASURED against ITS OWN IDENTITY FORM — this exact shipped body with `travelDepthX` and
     * `travelRateX` at 0 — at 1440×900 over six instants: mean displacement up to 5.9 % of the figure's own
     * XY span and max 12.8 %.** ⚠️ **The figure varies by instant from 1.0 % to 5.9 % mean and that is the
     * operator working, not noise** —
     * the breath passes through its own zero twice a cycle, so a single-instant measurement of a breathing
     * operator can report it inert. **Six instants, none of them frame 0** (invariant 28).
     *
     * ✅ **MEASURED leaf diff against `Pipes Sweep`: THREE leaves — `travelDepthX` absent → 0.4,
     * `travelRateX` absent → 8.0856…, `figureScale` 1 → 0.4472.** The figure, the 10 000 particles, the
     * short `decayFactor: 0.370` trail, the `hybrid` ribbon and the whole grade are its sibling's.
     */
    preset: {
      metadata: {
        name: 'Pipes Sweep Breath',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          5.94
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'hybrid',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1.31,
        figureScale: 0.4925532603024024,
        sharpness: 0.3,
        sharpnessStructure: 0.3,
        sharpnessDetail: 0,
        sharpnessDepth: 0.31,
        sharpnessRate: 11.887933912050869,
        travelX: 0.6,
        travelY: 0,
        travelZ: 0,
        travelDepthX: 0.4,
        travelDepthY: 0,
        travelDepthZ: 0,
        travelRateX: 8.085646434159724,
        travelRateY: 0,
        travelRateZ: 0,
        offsetX: -0.46,
        offsetY: 0.48,
        offsetZ: 0,
        offsetDepthX: 0.48,
        offsetDepthY: 0.46,
        offsetDepthZ: 0,
        offsetRateX: 6.0948199559455025,
        offsetRateY: 7.88052778148603,
        offsetRateZ: 0,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 7,
          depthSize: 0.6,
          depthBrightness: 0.25,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 1.8,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Cylinder',
    name: 'Square Mosaic',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ✅ **MEASURED against `Warp Square Mosaic`, the demo it was exported from: 27 differing leaves** — a
     * whole `Customize` grade instead of `Legacy Graded` (`glow: 7`, every depth field zeroed), `Ocean`
     * rather than `Cycle: Solar`, a longer trail (`decayFactor` 0.8 → 0.911), wider ribbon/neon widths and
     * its own chain. **It is a re-grade of that demo's figure, not a one-field variant** — so do not read
     * the pair as an A/B for anything.
     *
     * **Square Mosaic** — an owner export of 2026-10-31, kept VERBATIM: this object is exactly what `Import`
     * hands `MigrationLayer.migrate`, so it behaves identically to re-importing that file. Only
     * `metadata.name` was changed, from the export's own name to this entry's.
     *
     * ⚠️ **Added as a SECOND body alongside the demo it was derived from** (`Warp Square Mosaic`), on the
     * owner's instruction — the two are kept apart rather than one replacing the other.
     */
    preset: {
      metadata: {
        name: 'Square Mosaic',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'shape',
          'square',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 6000,
        waveSpeed: 0.05,
        rotation: [
          -7.22,
          10,
          -2.59
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          4.815,
          4.241,
          1
        ],
        colorShift: [
          0.397,
          0.612,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.911,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 12.5,
        linesEnabled: false,
        lineWidth: 7,
        filmLook: 'Customize',
        palette: 'Ocean',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Terraced Swell',
              strength: -0.39,
              detail: 2.9,
              drift: 0.004,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'sawtooth',
              shapeMix: 0.9,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: 0,
              angleY: 0,
              angleX2: 0,
              angleY2: 0
            }
          }
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 2.309215172096753,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 7,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [
            0.5,
            -0.7,
            0.3
          ],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.2,
          bloomIntensity: 0.4,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ],
          saturation: 1.2,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth'
        }
      }
    },
  },
  {
    after: 'Cylinder',
    name: 'Cylinder Kaleidoskope',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    /*
     * ✅ **MEASURED against `Warp Chevron Score`, the demo it was exported from: ONE differing leaf — its
     * static field adds `shape: 'trapezoid'` at `shapeMix: 1.0` over the same oriented `Interference`
     * table (`angleX: 28`, `angleY: -28`).** So the pair is a genuine one-field A/B on the wave BASIS at a
     * fixed orientation, which nothing else in the library carries — and it is why keeping both is worth a
     * library slot rather than being a duplicate. ⚠️ The explicit `angleX2`/`angleY2: 0` and `shapeMix2: 0`
     * are the export's own full-block spelling, not a second operator.
     *
     * **Cylinder Kaleidoskope** — an owner export of 2026-10-31, kept VERBATIM: this object is exactly what `Import`
     * hands `MigrationLayer.migrate`, so it behaves identically to re-importing that file. Only
     * `metadata.name` was changed, from the export's own name to this entry's.
     *
     * ⚠️ **Added as a SECOND body alongside the demo it was derived from** (`Warp Chevron Score`), on the
     * owner's instruction — the two are kept apart rather than one replacing the other.
     */
    preset: {
      metadata: {
        name: 'Cylinder Kaleidoskope',
        version: 2,
        designResolution: {
          width: 100,
          height: 100
        },
        tags: [
          'demo',
          'transmap',
          'style0',
          'angle',
          'review'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 6000,
        waveSpeed: 0.05,
        rotation: [
          0,
          8.09,
          -0.1
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 10.986328,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 20.182291,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 9.375,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 98,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.72,
        blurRadius: 3,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: true,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Plasma',
        palette: 'Neon',
        paletteMapping: 'velocity',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Interference',
              strength: 14.34,
              detail: 0.7,
              drift: 0.25,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'trapezoid',
              shapeMix: 1,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: 28,
              angleY: -28,
              angleX2: 0,
              angleY2: 0
            }
          }
        ],
        transMapWarpMix: 0.9,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 0.5,
        figureScale: 1.2327247073043632,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        }
      }
    },
  },
  {
    after: 'Cylinder',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Fluid Viviani',
    /*
     * **Fluid Viviani** — an owner export of 2026-10-31, kept VERBATIM: this object is exactly what `Import`
     * hands `MigrationLayer.migrate`, so it behaves identically to re-importing that file. Only
     * `metadata.name` was changed, from the export's own `Cylinder Viviani` to this entry's.
     *
     * ⚠️ **Added as a SECOND body alongside `Cylinder Viviani`, which the owner finetuned in the same
     * sitting** — the two are siblings rather than versions.
     *
     * ✅ **MEASURED against `Cylinder Viviani`: SEVEN differing leaves and ALL SEVEN are in one subsystem** —
     * `transMapEnabled` false → true, `transMapStyle` 0 → **6** (fluid feedback), and the five-field
     * `fluidFeedback` block it needs (`persist: 0.98`, `amplify: 3`, `dispersion: 0`, `fieldDecay: 0.987`,
     * `glowBoost: 0.15`). **The FIGURE is byte-identical** — same waves, same count, same grade, same
     * `Cycle: Azure`/`index`. **So the pair is a one-subsystem A/B: the Viviani curve plain, and the same
     * curve fed through the image-domain fluid feedback**, which is what earns the name.
     *
     * ⚠️ **Style 6 is the ONE style exempt from the `1 − attractorBlend` fade rule** (`CLAUDE.md`'s TransMap
     * row), so do not read this body as a template for any other style's chain.
     */
    preset: {
      metadata: {
        name: 'Fluid Viviani',
        version: 2,
        designResolution: {
          width: 75,
          height: 100
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          3,
          14,
          0
        ],
        angle: [
          0,
          1,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 30,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 60,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0.5,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          12.74,
          8.831,
          2.051
        ],
        colorShift: [
          0.6,
          0.9,
          1.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.359,
        blurRadius: 0,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Azure',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 6,
        fluidFeedback: {
          persist: 0.98,
          amplify: 3,
          dispersion: 0,
          fieldDecay: 0.987,
          glowBoost: 0.15
        },
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 2.73,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.05,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.6,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        }
      }
    },
  },
  {
    after: 'Pipes',
    atEnd: true,   // v8 31.6 — every demo sits at the END of the library (owner, 2026-10-25)
    name: 'Pipes Taper Bend Spread',
    /*
     * **Pipes Taper Bend Spread** — ⚠️⚠️ **THREE DEMOS MERGED INTO ONE ON 2026-11-01 (owner), AND THE MEASUREMENT IS WHY:
     * `Pipes Spread`, `Pipes Taper` and `Pipes Bend` were ONE LEAF APART FROM EACH OTHER.** Measured over
     * the composed library: Spread ⇄ Taper differed by `overlay.taperZ` ALONE, Spread ⇄ Bend by
     * `overlay.bendZ` ALONE, Taper ⇄ Bend by those two keys — identical channel block, count, grade, pose
     * and render path in all three. **Three library slots for one picture plus two single-key changes.**
     *
     * **WHAT THIS BODY IS:** `Pipes Taper`'s own text, verbatim, plus one line (`bendZ: 0.45`). Both
     * operator values are the ones their demos shipped — **0.55 taper and 0.45 bend, unchanged** — so the
     * merge adds a key and re-tunes nothing. The per-particle channel block (`index` driver, light 0.8,
     * size 0.6, alpha 0.3) came with Taper and was common to all three.
     *
     * ⚠️⚠️ **IT IS NOW THE LIBRARY'S ONLY CARRIER OF BOTH `taperZ` AND `bendZ`, and that was the condition
     * on the merge rather than a side effect.** `Pipes Taper` was the only carrier of the first and
     * `Pipes Bend` of the second, so a merge that dropped either key would have taken a Phase 32 operator
     * out of the library entirely. **Measured after the edit: no overlay key lost its last live carrier.**
     *
     * ⚠️ **What the merge COSTS, stated rather than discovered later: the one-field A/B is gone.** Each of
     * the three used to isolate exactly one thing against `Pipes` — the channels alone, the channels plus a
     * taper, the channels plus a bend. This body shows all three at once, so *"which of these is the
     * taper"* is no longer answerable by loading a neighbour; it is answerable by zeroing `Taper Z` or
     * `Bend Z` in **Visual FX → Figure → Deformation**, which is two drags.
     *
     * ⚠️ **`ribbonMode: 'off'` is LOAD-BEARING and is inherited from Taper's body** (owner, `31.R`): the
     * ribbon renderer does not read the per-particle channels at all, so with ribbons on all three channel
     * rows are inert — the limit both manuals now state.
     *
     * **What a viewer should SEE:** a pipe figure whose run **flares along z** (taper) while its axis
     * **arcs** (bend), drawn with particles that vary in size, brightness and solidity along the curve.
     * ⚠️ **Taper and bend are evaluated from the PRE-deformation position, so the stage is order-free** —
     * the picture does not depend on which of the two is read first.
     */
    preset: {
      metadata: {
        name: 'Pipes Taper Bend Spread',
        version: 2,
        designResolution: {
          width: 75,
          height: 75
        },
        createdWith: 'refined-presets generator',
        tags: [
          'refined',
          'geo'
        ]
      },
      generators: {
        type: 'lissajous',
        particleCount: 10000,
        waveSpeed: 0.05,
        rotation: [
          0,
          0,
          1
        ],
        angle: [
          0,
          0,
          0
        ],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 32,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 4,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 32,
                  frequency: 1
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 1
                }
              },
              {
                phase: 0,
                am: {
                  base: 4,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 32,
                  amplitude: 16,
                  frequency: 2
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0
                }
              }
            ]
          }
        ],
        colorBase: [
          128,
          128,
          128
        ],
        colorAmp: [
          128,
          128,
          128
        ],
        colorFreq: [
          1,
          1,
          1
        ],
        colorShift: [
          0.1,
          0.2,
          0.3
        ]
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.3703703703703704,
        blurRadius: 4,
        depthSize: 0,
        streaks: 0
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              1,
              0,
              0,
              0
            ],
            [
              8,
              0,
              0,
              0
            ]
          ],
          sinMagicParams2: [
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ],
            [
              0,
              0,
              0,
              0
            ]
          ],
          zoomCenter: {
            x: 50,
            y: 50
          }
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1,
            1,
            1
          ]
        }
      },
      overlay: {
        // v8 2026-11-01 — the two Barr operators TOGETHER, which is what the merge is for. Both values
        // are the ones their own demos shipped: 0.55 and 0.45, unchanged, so the merge re-tunes nothing.
        taperZ: 0.55,
        bendZ: 0.45,
        ribbonMode: 'off',   // v8 31.R: owner, 2026-10-25 — the ribbon hid the per-particle spread
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5
        },
        customFilmLookParams: {
          glow: 5.4,
          depthSize: 0.3,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [
            0,
            0,
            1
          ],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 0.87,
          lift: [
            0,
            0,
            0
          ],
          gamma: [
            1,
            1,
            1
          ],
          gain: [
            1.1,
            1.1,
            1.1
          ],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase'
        },
        channelDriver: 'index',
        channelLight: 0.8,
        channelSize: 0.6,
        channelAlpha: 0.3
      }
    },
  },
  /**
   * **Curve Lattice** -- the REFERENCE body for the figure type: a Hilbert lattice held still enough to
   * read the locality colouring, with one angle breathing gently so it is not a turntable.
   *
   * ⚠️⚠️ **RE-AUTHORED BEFORE IT WAS EVER WRITTEN, AND THE SPEC'S VERSION WOULD HAVE BEEN A TURNTABLE.**
   * `SPEC-selfsimilar-curves` demo #1 gives it `centre` drift as its ONLY modulation, and `36.D3` makes
   * `centre` STATIC -- so as specified it is the exact *"correct, lifeless, and the easiest thing to ship
   * by accident because it looks fine in a screenshot"* case `36.21` rule (1) refuses. **A 6 deg yaw
   * breath is the whole re-authoring.**
   *
   * ⚠️ `paletteMapping: 'index'` is load-bearing here rather than decorative: on a locality-preserving
   * rule the curve visits each sub-cube as a CONTIGUOUS index range, so `index` is a smooth 3-D gradient.
   * That is the colour structure this figure type inherits for free.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Lattice',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Lattice',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 36000,
        waveSpeed: 0.05,
        rotation: [0.15, 4, -1.22],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert3d',
          recursion: {
            base: 3,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 6,
            frequency: 1.1,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.561,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Prismatic',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 7,
        transMapChain: [
          {
            style: 7,
            enabled: true,
            weight: 1,
            refraction: {
              strength: 0.49,
              reach: 2.3,
              invert: false,
              source: 'density',
            },
          },
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        particleSize: 1.8,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 4,
          depthSize: 0.4,
          depthBrightness: 0.4,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.2,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.15,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Descent** -- the self-similar ZOOM: travel INTO the curve, detail opening ahead.
   *
   * ⚠️⚠️ **THIS DEMO EXISTS ONLY BECAUSE `36.9` LANDED, AND IT WAS THE STEP MOST LIKELY TO SLIP** --
   * `36.D13` staged it LAST precisely so the phase could ship without it, and said this demo and
   * `Curve Volume` would go with it. **Both are here.**
   *
   * ⚠️⚠️ **AND THE ZOOM FAILED ITS OWN ACCEPTANCE CLAUSE TWICE BEFORE IT PASSED, so judge this preset on
   * whether the descent reads as travel rather than on whether it moves.** The clause is §10's: the mean
   * screen chord must hold within ±15 % across `descend`. An unaligned window measured **17.5x** and
   * taking the band after the resample measured **0.02x**; the shipped mechanism holds at **1.00x**.
   *
   * ⚠️ **`descend` BREATHES rather than drifts, which departs from the spec's "drifting over 90-150 s".**
   * The reason is measured: the cost ceiling is `recursionRange + 2`, about TWO octaves, so a long drift
   * would spend most of its time parked against the wall. A breath visits the usable range twice a cycle.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Descent',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Descent',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert3d',
          recursion: {
            base: 3,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 3.5,
            amplitude: 2.5,
            frequency: 0.6,
          },
          smoothness: 0.35,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [4.424, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.74,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Azure',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 12,
        transMapChain: [
          {
            style: 12,
            enabled: true,
            weight: 1,
            conformal: {
              map: 'mobius',
              power: 2,
              mobius: {
                aRe: 1,
                aIm: 0,
                bRe: 0,
                bIm: 0,
                cRe: 0.4,
                cIm: 0,
              },
              centre: {
                x: 0.5,
                y: 0.5,
              },
            },
          },
        ],
        transMapWarpMix: 0.23,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 6.5,
          depthSize: 0.8,
          depthBrightness: 0.6,
          depthDof: 0.4,
          depthColorShift: 0.5,
          lightingMode: 1,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3.5,
          bloomEnabled: true,
          bloomThreshold: 0.2,
          bloomIntensity: 0.65,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.9,
          lift: [0, 0, 0.02],
          gamma: [1, 0.98, 0.95],
          gain: [1, 1, 1],
          saturation: 1.3,
          vignette: 0.3,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Gasket** -- a second family: a Sierpinski gasket opening into a pagoda and closing again.
   *
   * ✅ **THE BEST-BEHAVED RULE IN THE SET, and that is measured rather than asserted:** the arrowhead's
   * density stays at **1.05-1.29 across its WHOLE sweep**, so it is the one demo whose range is safe
   * everywhere. The yaw breathes 54 deg to 78 deg, which is the interval §1.1 measured.
   *
   * ⚠️ **The palette is `Cycle: Starfield` (owner's finetune, 2026-11-05), replacing an authored `Pastel`.**
   * The authored choice rested on *a FLAT-luminance palette beats a greyscale RAMP wherever the subject is
   * a SHAPE*; the owner's eye overrules that here, and the export also raised `colorFreq` to 12.74 on X, so
   * the colour now cycles many times along the index rather than once.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Gasket',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Gasket',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 30000,
        waveSpeed: 0.05,
        rotation: [0.56, 6.93, -2.59],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'arrowhead',
          recursion: {
            base: 7,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 66,
            amplitude: 12,
            frequency: 1.6875,
          },
          pitch: {
            base: 60,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 60,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [12.74, 0.8084, 1],
        colorShift: [0.594, 0.461, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.62,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Starfield',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 6.5,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.2,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.2,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Island** -- the fractal BOUNDARY: the Gosper island's edge, relaxed toward a smooth coast.
   *
   * ⚠️⚠️ **THE SPEC GIVES THIS DEMO A BREATHING `Smoothness` THAT CROSSES ZERO EVERY CYCLE, AND THAT IS
   * REFUSED HERE.** `36.D10` makes `smoothness` a BRANCH and not a weighted blend -- at 0 no spline is
   * evaluated at all, which is what keeps the unsmoothed path bitwise the polyline and avoids `33.2`'s
   * measured 2x-cost defect. **A value breathing THROUGH 0 switches evaluation paths twice per period**,
   * and a stutter twice in 25 s is exactly the defect a still frame cannot show. **So the smoothness is
   * STATIC at 0.4 and the demo shows the relaxed coast rather than the transition.** Stated rather than
   * discovered: if the crossing is ever wanted, it needs specified behaviour AT the branch and a clause.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Island',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Island',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 34000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'gosper',
          recursion: {
            base: 4,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 60,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 60,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 60,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.4,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.882,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Ocean',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Fine Mesh',
              strength: 0.5,
              detail: 1,
              drift: 0,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'sine',
              shapeMix: 0,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: 0,
              angleY: 0,
              angleX2: 0,
              angleY2: 0,
            },
          },
        ],
        transMapWarpMix: 0.06,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 6,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.2,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.2,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Thicket** -- the BRACKETED case: a branching thicket, coloured in bands BY BRANCH because the
   * Euler tour visits each subtree contiguously.
   *
   * ⚠️⚠️ **THE SPEC GIVES IT `shrink: 0.72` AND THAT CONTROL NO LONGER EXISTS.** It was measured INERT on
   * every shipping rule -- the turtle applies a length shrink only at the symbol `!`, and of the thirteen
   * rules only `Bush 3D` contains one -- while §6.3 instructed labelling the row *"the density control"*.
   * **The owner dropped the row (`36.Q4`), so this body authors no shrink and the density comes from the
   * Euler-tour RETRACE, which is where §1.1's 6.61 actually came from.**
   *
   * ⚠️⚠️ **AND THIS IS THE `E131` COLLISION IN PRESET FORM.** That feature was cut on sight for
   * *"chopping the figure into multiplied line segments"*, which is a description of a bracketed tree.
   * **Of the nine this is the one most likely to be cut, and its removal costs the set nothing else:**
   * `plant` is the only bracketed rule with a demo, so a cut takes one body and no registry coverage.
   *
   * ⚠️ Its acceptance question is a GENERATOR question in disguise: the Euler tour draws every edge TWICE
   * -- does that read as weight, or as a double-struck line? **If it reads as a defect the retrace needs a
   * half-offset on the return leg, which is a generator change and not a preset one.**
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Thicket',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Thicket',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 50000,
        waveSpeed: 0.05,
        rotation: [0.15, 4, -1.22],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'plant',
          recursion: {
            base: 4,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 38,
            amplitude: 16,
            frequency: 0.7,
          },
          pitch: {
            base: 26,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 26,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.2,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.9,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Warm',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        symmetryFold: 5,
        symmetryMirror: false,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 7.5,
          depthSize: 0.65,
          depthBrightness: 0.55,
          depthDof: 0.45,
          depthColorShift: 0.5,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 6.5,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.75,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.5,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.45,
          vignette: 0,
          palette: 'Warm',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Volume** -- the honest LIMIT: the curve read as a coloured volume rather than as a stroke.
   *
   * ⚠️⚠️ **INCLUDED SO THE DULL-SILHOUETTE CLAIM IS DECIDED BY EYE RATHER THAN ARGUED, AND IT IS THE ONE
   * MOST LIKELY TO BE CUT AFTER `Curve Thicket`.** The risk `36.0(a)` names: a curve that self-crosses
   * thousands of times, splatted additively under a long trail with bloom, **accumulates toward a
   * uniformly bright rectangle** -- and Hilbert is the worst case because it is the most space-filling
   * rule in the set. **If it reads as a bright box, cut it rather than tune it.**
   *
   * ⚠️ **`Smoothness 0.85` rather than the spec's 1.0, and the difference is measured:** the spec's own
   * render shows 0.70 and 1.00 indistinguishable, so 1.0 would put this demo's headline setting in a
   * range where the control does nothing. 0.85 is inside the live part of the range.
   *
   * ⚠️ 50 000 particles is the spec's own choice for this body and it is the only demo in the set that
   * needs them -- the claim is about ACCUMULATION, which is a function of count.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Volume',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Volume',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 50000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert3d',
          recursion: {
            base: 4,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 2.2,
            amplitude: 1,
            frequency: 0.4,
          },
          smoothness: 0.85,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.88,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Neon',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0.65,
          depthBrightness: 0.55,
          depthDof: 0.45,
          depthColorShift: 0.5,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 6.5,
          bloomEnabled: false,
          bloomThreshold: 0.25,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.4,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.2,
          vignette: 0,
          palette: 'Warm',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Tilt** -- ⚠️⚠️ **THE ANSWER TO `36.Q5`, AND IT WAS A REAL ZERO-CARRIER GAP.**
   *
   * `36.D3` specifies THREE independently modulated turtle angles and the spec's eight demos modulate
   * only YAW -- so pitch and roll would have shipped with **no carrier at all**, which is precisely the
   * pattern Phases 34 and 35 spent two sittings closing. **This body is their carrier: pitch breathes
   * ±14 deg and roll ±9 deg, independently and at different rates.**
   *
   * ⚠️⚠️ **AND THE INDEPENDENT CASE WAS ALSO UNMEASURED, WHICH IS WORSE THAN A COVERAGE GAP.** §1.1's
   * whole angle table was taken with `yaw === pitch === roll` (`4-lsystem-model.mjs:108` passes one `d`
   * three times), so every published density figure is about ONE angle applied to three axes. **No
   * quoted number is evidence about this preset.**
   *
   * ⚠️ **Only TWO of the thirteen rules use pitch or roll at all** (`Hilbert 3D` and `Bush 3D`, measured
   * from the symbol sets), so the choice of host was forced. `Bush 3D` was refused: its correctness was
   * never established even in the prototype, and its yaw is additionally inert.
   *
   * ⚠️ **It rebuilds the curve EVERY FRAME and that is expected, not a defect.** `Hilbert 3D`'s
   * multi-axis bracket solves to 0.04 deg, far below the usable threshold, so the bracket is bypassed --
   * recursion 3 keeps that affordable (512 entries). The Composer states the cost in a gated notice.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Tilt',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Tilt',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 30000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert3d',
          recursion: {
            base: 3,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 90,
            amplitude: 14,
            frequency: 0.9,
          },
          roll: {
            base: 90,
            amplitude: 9,
            frequency: 0.55,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.25,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.802,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Prismatic',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 6,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.3,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.2,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Subdivide** — v8 `36.21`, the first of the self-similar curve demos.
   *
   * ⚠️⚠️ **THIS BODY IS THE OWNER'S FINETUNED EXPORT, TAKEN VERBATIM, AND IT REPLACED AN AUTHORED ONE
   * (2026-11-03).** That is this project's standing rule — *a hand-tuned preset the user accepted
   * outranks any refinement rule* — and the Phase 33 precedent is identical: three finetuned star
   * exports replaced their authored bodies outright. **Do not re-tune any value here against a rule
   * below; the rules describe what the engine does, not what this preset should look like.**
   *
   * **What a viewer should SEE:** a three-dimensional Hilbert lattice that **subdivides and coarsens** —
   * new detail appearing *between* existing strokes rather than the whole figure scaling. That
   * distinction is the entire subject, and it is also what `36.D14`'s original mechanism got wrong: one
   * held extent transform made a deeper recursion a BIGGER figure, so the control read as a zoom.
   * Rendered, caught and corrected before this preset existed.
   *
   * **CARRIED BY** `generators.lsystem`: `rule: 'hilbert3d'`, `recursion` breathing **base 3 ± 0.7**, so
   * it travels 2.3 ↔ 3.7 and crosses two integer brackets per cycle. Every angle sits at the published
   * 90°. ⚠️ **Breathing rather than drifting is deliberate** — the upper recursion range is the
   * dull-silhouette regime, so a breath visits the good range twice per cycle where a drift would park
   * in the bad one.
   *
   * ⚠️⚠️ **`paletteMapping: 'depth'`, NOT `'index'`, AND THAT IS THE OWNER'S CHOICE OVERRIDING
   * `36.21`'s OWN AUTHORING RULE.** That rule says *every demo wants `index`*, because on a
   * locality-preserving rule the index IS a smooth 3-D gradient — the colour structure this figure type
   * inherits for free. **The owner's export maps `depth` with the `Warm` palette and it is authoritative.**
   * Recorded as a departure rather than silently normalised, because the next author will read the rule
   * and wonder. ⚠️ `velocity` would still be wrong here twice over: this type declares
   * `motion: 'static'`.
   *
   * ⚠️⚠️ **IT CARRIES A DORMANT `waves` BLOCK ON PURPOSE AND THAT IS PART OF WHAT IT DEMONSTRATES.**
   * `generators.waves` is non-optional in the format, so every curve preset carries one; `36.2`'s
   * non-destructive rule means it is kept rather than zeroed, and switching the type back in the
   * Composer restores the wave figure exactly. **Measured at the engine level: a dormant block is
   * bit-identical — 0 of 6000 position slots differ.** ⚠️ It authors three slots because every preset in
   * the library does and `composercheck` asserts it — a short block here would have been the library's
   * first exception, and it is the `simple`-body-over-a-`full`-row hazard in data form.
   *
   * ⚠️ **`smoothness: 0` because `36.8`'s branch is the thing that reads it.** Authoring a non-zero value
   * before that step would ship a preset whose headline setting does nothing — the `shrink` defect this
   * phase already cut a control for.
   */
  {
    after: 'Cylinder',
    name: 'Curve Subdivide',
    atEnd: true,   // v8 `36.21` -- moved here from DEMO_PRESETS so all nine curve demos sit at
                   // the library END, which is `31.R`'s rule and the owner's restatement of it.
    preset: {
      metadata: {
        name: 'Curve Subdivide',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'recursion',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 50000,
        waveSpeed: 0.05,
        rotation: [0.15, 4, -1.22],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert3d',
          recursion: {
            base: 3,
            amplitude: 0.7,
            frequency: 3.5,
          },
          yaw: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.62,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Warm',
        paletteMapping: 'depth',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        channelDriver: 'depth',
        channelSize: 0,
        channelAlpha: -0.45,
        channelLight: 0,
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 7.5,
          depthSize: 0.78,
          depthBrightness: 0.8,
          depthDof: 0.45,
          depthColorShift: 0.5,
          lightingMode: 2,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 6.5,
          bloomEnabled: true,
          bloomThreshold: 0.15,
          bloomIntensity: 0.75,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.5,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.45,
          vignette: 0,
          palette: 'Warm',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Morph** — v8 `36.21`, ⚠️⚠️ **THE HEADLINE, and the one the spec says decides the phase.**
   *
   * ⚠️⚠️ **THE OWNER'S FINETUNED EXPORT, VERBATIM, REPLACING AN AUTHORED BODY (2026-11-03)** — see
   * `Curve Subdivide`'s header for why that outranks every authoring rule in the phase.
   *
   * **What a viewer should SEE:** one figure becoming a **different named fractal** and back — the
   * quadratic Koch curve at 90° opening into a **Sierpiński triangle** at 117°, continuously, at
   * constant size.
   *
   * ⚠️⚠️ **THE SPEC SAYS THIS INTERVAL HAD NEVER BEEN RENDERED**, and says in four separate places that
   * it decides the phase: its own angle sweep samples 90° and 117° as ADJACENT cells with nothing
   * between them. ✅ **Rendered offline at eight samples (the probe render `p36-koch-morph.png`, which is not published)
   * before a line of UI existed, and the morph is real, smooth and size-stable** — so `36.0(b)`'s
   * question is answered. What remained was whether it is *attractive*, and the owner's finetune of this
   * body is that answer.
   *
   * **CARRIED BY** `generators.lsystem`: `rule: 'kochQuad'`, `recursion: 4`, **`yaw` breathing base
   * 103.5° ± 13.5°** — exactly the 90°↔117° interval between the two named landmarks.
   *
   * ✅ **The angle bracket makes this cheap, and the number is measured:** `kochQuad`'s solved half-width
   * is **12°** against a 0.01-of-extent error budget, so the whole 27° sweep costs **8 list rebuilds**
   * rather than one per frame. ⚠️ **That is NOT true of every rule** — `Hilbert 3D`, `Moore` and `Peano`
   * bypass the bracket entirely and rebuild per frame, because a deep space-filling curve is not a
   * near-linear function of its angle at any useful width. Measured, and structural rather than tunable.
   *
   * ⚠️ **`publishedAngle` IS A LANDMARK, NOT A LIMIT** — that is the model's whole idea and this preset
   * is its proof: 90° is where the Koch production is *named*, and the figure is valid, different and
   * still self-similar everywhere between the two.
   */
  {
    after: 'Cylinder',
    name: 'Curve Morph',
    atEnd: true,   // v8 `36.21` -- moved here from DEMO_PRESETS so all nine curve demos sit at
                   // the library END, which is `31.R`'s rule and the owner's restatement of it.
    preset: {
      metadata: {
        name: 'Curve Morph',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'morph',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 50000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'kochQuad',
          recursion: {
            base: 4,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 103.5,
            amplitude: 13.5,
            frequency: 2,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [6.119, 2.216, 1],
        colorShift: [0.497, 0.612, 0.904],
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.523,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 1,
        filmLook: 'Customize',
        palette: 'Neon',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1.1013825725753204,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 7,
          depthSize: 0.3,
          depthBrightness: 0.3,
          depthDof: 0.2,
          depthColorShift: 0.3,
          lightingMode: 2,
          lightDir: [0, 0, 1],
          rimPower: 2.5,
          bloomEnabled: true,
          bloomThreshold: 0.3,
          bloomIntensity: 0.55,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.3,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1.1, 1.1, 1.1],
          saturation: 1.4,
          vignette: 0.2,
          palette: 'Neon',
          paletteMapping: 'phase',
        },
      },
    },
  },
  /**
   * **Curve Weave** -- moore, the only CLOSED rule — closure is the subject.
   *
   * ⚠️ **No longer a static loop (owner's finetune, 2026-11-05): yaw, pitch and roll each breathe ±4-4.5°.**
   * The authored body held every angle still because `moore`'s 0.85° bracket makes ANY animated angle a
   * per-frame list rebuild. The owner's body accepts that cost; if this preset is ever reported as slow,
   * that rebuild is the first suspect, not the renderer.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Weave',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Weave',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 40000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'moore',
          recursion: {
            base: 2,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 4,
            frequency: 15.046875,
          },
          pitch: {
            base: 90,
            amplitude: 4,
            frequency: 14.734375,
          },
          roll: {
            base: 90,
            amplitude: 4.5,
            frequency: 14.78125,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.22,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.6,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: true,
        lineWidth: 2,
        filmLook: 'Customize',
        palette: 'Cycle: Indigo',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 0.85,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5,
          depthSize: 0.8,
          depthBrightness: 0.6,
          depthDof: 0.4,
          depthColorShift: 0.5,
          lightingMode: 1,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.1,
          bloomIntensity: 0.6,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.1,
          lift: [0, 0, 0.02],
          gamma: [1, 0.98, 0.95],
          gain: [1, 1, 1],
          saturation: 1,
          vignette: 0.3,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
  /**
   * **Curve Triad** -- terdragon at 120 deg — the ONLY triangular-grid texture the engine can produce, wobbling inside its generous 6.3 deg bracket.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Triad',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Triad',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 36000,
        waveSpeed: 0.05,
        rotation: [0.15, 4, -1.22],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'terdragon',
          recursion: {
            base: 6,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 120,
            amplitude: 4.5,
            frequency: 0.07,
          },
          pitch: {
            base: 120,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 120,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.35,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2.4,
        decayFactor: 0.8,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'hybrid',
        splatShear: 'tangent',
        ribbonWidth: 3.5,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Neon',
        palette: 'Aurora',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: true,
        transMapStyle: 0,
        transMapChain: [
          {
            style: 0,
            enabled: true,
            weight: 1,
            staticField: {
              pattern: 'Grid Lattice',
              strength: 0.1,
              detail: 0.25,
              drift: 0,
              pattern2: '(Preset)',
              strength2: 0.5,
              zoomBias: 0,
              shape: 'square',
              shapeMix: 1,
              shape2: 'sine',
              shapeMix2: 0,
              angleX: 0,
              angleY: 0,
              angleX2: 0,
              angleY2: 0,
            },
          },
        ],
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1.15,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
      },
    },
  },
  /**
   * **Curve Dragonfold** -- the Heighway dragon at recursion 10 — the paperfolding turn sequence, softened by a little curl.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Dragonfold',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Dragonfold',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 42000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'dragon',
          recursion: {
            base: 8,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 6.5,
            frequency: 6.90625,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 7,
            frequency: 16.203125,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.3,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2.2,
        decayFactor: 0.605,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 1.5,
        linesEnabled: true,
        lineWidth: 0.5,
        filmLook: 'Plasma',
        palette: 'Fire',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 1,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
      },
    },
  },
  /**
   * **Curve Scroll** -- levyC at 45 deg — self-OVERLAPPING where the dragon at 90 deg is not, drifting under a low fluid advection.
   */
  {
    after: 'Cylinder',
    name: 'Curve Scroll',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Scroll',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 38000,
        waveSpeed: 0.05,
        rotation: [0.15, 4, -1.22],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'levyC',
          recursion: {
            base: 11,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 45,
            amplitude: 3.25,
            frequency: 0.06,
          },
          pitch: {
            base: 45,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 45,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 1,
            amplitude: 0,
            frequency: 0,
          },
          smoothness: 0.45,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 1.8,
        decayFactor: 0.92,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 3,
        linesEnabled: false,
        lineWidth: 2,
        filmLook: 'Plasma',
        palette: 'Pastel',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1,
        figureScale: 0.95,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0.2,
          returnForce: 0.6,
        },
      },
    },
  },
  /**
   * **Curve Plane Dive** -- hilbert2d — the second and last rule with a zoomInverse, so the ONLY place the Descend zoom is legible as a plane rather than a tangle.
   *
   * ⚠️⚠️ **THE BODY IS THE OWNER'S FINETUNED EXPORT, VERBATIM (2026-11-05), replacing the authored one.**
   * Where a sentence above describes a value, the body below is the authority (CLAUDE.md: *a
   * hand-tuned preset the user accepted outranks any refinement rule*).
   */
  {
    after: 'Cylinder',
    name: 'Curve Plane Dive',
    atEnd: true,   // v8 `36.21` -- every demo sits at the END of the library (31.R)
    preset: {
      metadata: {
        name: 'Curve Plane Dive',
        version: 2,
        designResolution: {
          width: 100,
          height: 100,
        },
        tags: [
          'demo',
          'lsystem',
          'review',
        ],
      },
      generators: {
        type: 'lsystem',
        particleCount: 44000,
        waveSpeed: 0.05,
        rotation: [0.12, 5.25, -0.33],
        angle: [0, 0, 0],
        waves: [
          {
            speed: 0.05,
            axes: [
              {
                phase: 90,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 20,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 1,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 10,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 7,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
          {
            speed: 0.05,
            axes: [
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
              {
                phase: 0,
                am: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
                fm: {
                  base: 0,
                  amplitude: 0,
                  frequency: 0,
                },
              },
            ],
          },
        ],
        lsystem: {
          rule: 'hilbert2d',
          recursion: {
            base: 5,
            amplitude: 0,
            frequency: 0,
          },
          yaw: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          pitch: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          roll: {
            base: 90,
            amplitude: 0,
            frequency: 0,
          },
          descend: {
            base: 3.5,
            amplitude: 2.25,
            frequency: 0.045,
          },
          smoothness: 0.18,
          centre: [0, 0, 0],
        },
        colorBase: [128, 128, 128],
        colorAmp: [128, 128, 128],
        colorFreq: [1, 1, 1],
        colorShift: [0.1, 0.2, 0.3],
      },
      renderer: {
        mode: 'star',
        glow: 2,
        decayFactor: 0.88,
        blurRadius: 2,
        depthSize: 0,
        streaks: 0,
      },
      postProcessors: {
        transMap: {
          enabled: false,
          style: 0,
          beforeParticles: false,
          sinMagicParams: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          sinMagicParams2: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
          zoomCenter: {
            x: 50,
            y: 50,
          },
        },
        bloom: {
          enabled: false,
          threshold: 0.8,
          intensity: 0.3,
          radius: 5,
        },
        toneMap: {
          curve: 'none',
          exposure: 1,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
      overlay: {
        ribbonMode: 'off',
        splatShear: 'tangent',
        ribbonWidth: 2,
        linesEnabled: false,
        lineWidth: 0.5,
        filmLook: 'Customize',
        palette: 'Classic: ice',
        paletteMapping: 'index',
        attractorIndex: -1,
        attractorBlend: 0.6,
        renderMode: 'star',
        transMapEnabled: false,
        transMapStyle: 0,
        curlNoise: {
          enabled: false,
          turbulence: 0,
          scale: 1,
          evolutionSpeed: 0.5,
        },
        speedFactor: 1.2,
        figureScale: 0.76,
        physarum: {
          blend: 0,
          sensorAngle: 30,
          sensorDistance: 20,
          turnSpeed: 45,
          decayRate: 0.2,
          depositAmount: 0.05,
          showTrail: true,
          trailOpacity: 0.8,
        },
        fluidAdvection: {
          blend: 0,
          returnForce: 0.5,
        },
        customFilmLookParams: {
          glow: 5.5,
          depthSize: 0,
          depthBrightness: 0,
          depthDof: 0,
          depthColorShift: 0,
          lightingMode: 0,
          lightDir: [0.5, -0.7, 0.3],
          rimPower: 3,
          bloomEnabled: true,
          bloomThreshold: 0.6,
          bloomIntensity: 0.3,
          toneMapEnabled: true,
          toneMapCurve: 'aces',
          exposure: 2.2,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
          saturation: 1.35,
          vignette: 0,
          palette: 'none',
          paletteMapping: 'depth',
        },
      },
    },
  },
];
