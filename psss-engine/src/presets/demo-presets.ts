import type { UnifiedPreset, SinMagicParams } from './types.ts';
// ⚠️ `WaveConfig` is re-exported by NOTHING — it lives in `core/interfaces.ts` and `types.ts` only imports it.
import type { WaveConfig } from '../core/interfaces.ts';

/**
 * # DEMO_PRESETS — one preset per FEATURE, authored to be judged and then kept or cut
 *
 * ⚠️ **THE GROUP HOLDS FIVE COHORTS WITH FIVE DIFFERENT STATUSES, AND THE LAST ONE IS BIGGER THAN THE OTHER
 * FOUR PUT TOGETHER — count keys by importing the module, never by reading a figure in this comment** (the
 * header said 18 for a sitting after the object held 19, and said 24 for a sitting after it held 50, which is
 * exactly the drift the project's counting rule exists for):
 *
 *   * **18 — the 2026-08-21 REVIEW SET.** ✅ browser-confirmed and CLOSED 2026-08-23. Everything the rest of
 *     this header describes is about these, and the *"do not re-tune"* rule below is theirs.
 *   * **1 — `Liquid Surface`.** Added at v8 Step 15.1; ✅ confirmed. Demonstrates the liquid RENDER MODE.
 *   * **4 — `Liquid Field Pool`, `Liquid Cohesion Beads`, `Dye Wake`, `Pigment Sheet`.** Added 2026-09-03, one per Phase 15
 *     subsystem, ✅ confirmed 2026-09-03. Their own banner sits above `Liquid Field Pool` and
 *     records why the render-mode demo could not cover them and what each one is picked on — those criteria
 *     are DIFFERENT from this header's, so read that banner rather than generalising from here.
 *   * **1 — `Physarum Flower`.** Added 2026-09-04, browser-confirmed the same day and its `'review'` tag
 *     removed — the pass found nothing, which was only evidence because a specific failure was available to
 *     it (the subsystem's two reads-as-broken-when-working modes, both in its own banner). That tick was
 *     WITHDRAWN earlier on 2026-09-20 because the engine units fix changed what the body draws
 *     (`trail/fig` 0.13 → 1.04) — **and the withdrawal was itself superseded the same day: the owner tuned
 *     BOTH physarum presets in the Lab against the FIXED engine and sent the exports**
 *     (`Physarum Flower_20260920_180450.json`, `Physarum Weave_20260920_180115.json`). ✅ **Both are
 *     OWNER-TUNED EXPORTS, both `'review'` tags are removed, and nothing in either body may be tuned back
 *     towards the derivations in their doc blocks.** ⚠️ **The exports came back with every physarum value
 *     this file had derived UNCHANGED** — `Weave` `blend: 0.03`, `Flower` `depositAmount: 0.08` — which is the
 *     one thing a derivation cannot give itself: independent agreement. What the owner did change is the
 *     GRADE (both to `filmLook: 'Customize'`), `Weave`'s count (4000 → 9900) and `Flower`'s palette and
 *     `figureScale`. ⚠️ **Exactly TWO presets in the whole library enable physarum** (`blend > 0`) — this one
 *     and `Physarum Weave`; every other block ships `blend: 0`, which is why the engine fix's blast radius
 *     was two bodies. Its banner carries the `decayRate` double-duty arithmetic and the two reasons the
 *     subsystem reads as broken when it is working — **read it, and `lissajous.ts`' deposit header, before
 *     touching any physarum value.**
 *   * **27 — the 2026-09-20 COVERAGE COHORT, ✅ 26 CONFIRMED / 1 OPEN as of 2026-09-21.** Twenty-six are one per row `coveragecheck` was
 *     asking for: ten for the §21.5 field systems, seven for §21.6's TransMap styles and chains, five for
 *     §21.7's attractor families, four for §21.8/§21.9's render modes and crystals. ⚠️ **The 27th,
 *     `Curl Noise Braid`, answers a DIFFERENT audit and `coveragecheck` never asked for it**: `21.D5`'s
 *     naming pass found curl noise live in six presets and named by NONE of them, four of the six below
 *     the visibility floor — a gate no coverage checker can express, since all six satisfy it. ⚠️ **The verdicts
 *     are in `REVIEW-phase21-demos.md`, which is the ONE record of them — re-count its table rather than
 *     quoting this line**; re-counted 2026-09-21 (late) it reads **27 rows, 27 ✅, 0 open, 0 never-attempted** —
 *     the cohort is COMPLETE. ⚠️ **Count the rows by NAME, not by symbol: a grep for 🔧 still finds FIVE rows and
 *     NONE of them is open now** (1, 4, 19, 23 and 24) — in every one the wrench is a fix the tick came AFTER, so
 *     it is history. ⚠️ **Complete is not the same claim as reviewed:** entry 24 was closed by a STEP-level line
 *     (*"21.11 is confirmed to work fine"*), which names no preset and states no route, and several `Look for:` /
 *     `Try:` lines remain unperformed or unperformable under ticked rows. **The table is where that is written.**
 *     ⚠️ **The `'review'` tag is NO LONGER the cohort's marker and never was a reliable way to find an open row:**
 *     after `Pixel Age Palette`'s was dropped on its 2026-09-21 confirmation, **exactly 1 of the 27 still carries
 *     it — `Liquid Field Fill` — and that one is STALE**: the owner confirmed it in passing on 2026-09-20 and the
 *     tag was never dropped. ⏳ **Owed, and deliberately not dropped unasked**, because a tag is what
 *     `coveragecheck` and the Lab see, so removing one is a library edit rather than a note. **Re-count the tag
 *     across the whole `'demo'` group by importing the module** — it survives on many bodies OUTSIDE this cohort,
 *     so a tag count is a fact about the group, never about these 27. ⚠️ **A ✅ here is a set verdict in almost every case** — the nine of
 *     2026-09-21 arrived in ONE owner message, which is the largest set verdict in the phase and therefore
 *     discharges the least per body; and `verify` being green over any of them says only that a body authors the
 *     feature, which is the distinction the whole phase is about. ⚠️ **Their banner sits above `Physarum Weave`
 *     and the BASIS of their numbers is different from every cohort above**: the four cohorts above were tuned in
 *     a browser and their figures are measurements, while these were derived from documented engine semantics and
 *     were PREDICTIONS. ⚠️ **That basis now differs BODY BY BODY: an owner export replaces the prediction with a
 *     measurement for that body alone** — **13 of the 27** have had one: `Physarum Weave`, `Depth Gate Veil`,
 *     `Time Warp Lattice` and `Mandelbrot Zoom` on 2026-09-20, plus the nine of 2026-09-21 (`Age Gate Embers`,
 *     `Parallax Depth Shell`, `Volume Depth Haze`, `Vortex Offset Drag`, `Chain Triple Cascade`,
 *     `Warp First Silhouette`, `Clifford Fern Veil`, `Aizawa Torus Shell`, `Julia Siegel Disk River`). **The
 *     other 14 are still predictions with a ✅ over them** — ⚠️ **and the 2026-09-21 `21.11` confirmation did NOT
 *     move that line: a WORD confirms the picture was acceptable, only an EXPORT replaces a predicted number with
 *     a measured one**, so `Pixel Age Palette` stays on the prediction side of it. Therefore **read each body's
 *     own doc block for which it is**
 *     and **do not copy a number out of one of them into a confirmed
 *     preset** — read that banner first, and see it also for why the four batches are grouped the way they are.
 *
 * ✅ **REVIEWED AND KEPT IN FULL — all 18 of the review set are browser-confirmed and CLOSED as of
 * 2026-08-23.** The group was
 * written on 2026-08-21 as a REVIEW SET to answer one question per feature: *does this feature have a look of
 * its own, and is that look distinguishable from what the 177 legacy presets already do?* Every entry is
 * therefore engineered to make exactly one feature as prominent as it can be, at the cost of being a balanced
 * image — that is authored intent here, not an oversight to be "balanced" later. ⚠️ **Nothing was cut**, and
 * the reason is worth recording because the file was written expecting deletions: the four presets that drew
 * criticism were all **fixed** rather than dropped, and in three of the four the complaint turned out to name
 * an ENGINE or GATING fact rather than a bad choice of numbers (Smoke's unreachable pass-0 population, the
 * buoyancy gate on the 2-pass composite, `Material Ice`'s folding static field). **A demo that looks wrong is
 * evidence about the engine first and about its own settings second.**
 *
 * ⚠️ **Do not re-tune any of the 18 review-set presets, and do not reopen a verdict by moving one value** — the
 * five liquid entries are outside that freeze only in the sense that their verdict has not been given yet;
 * every non-default value in them is measured and its measurement is in its own doc block, so a change there
 * needs the same standard rather than a lesser one. Several of the 18 were accepted
 * as compositions (`Material Ice`'s four crystal/warp values most explicitly). They still live in their own
 * file and load LAST, which now buys cheap *addition* rather than cheap deletion.
 *
 * ## The two criteria a demo has to satisfy
 *
 * 1. **Prominence** — the feature must be the obvious subject of the frame.
 * 2. ⚠️ **Differentiation from legacy** — and this is the criterion that shaped the settings most. **107 of
 *    the 177 legacy presets already run a live TransMap at styles 0-3 on their own `sinMagicParams`.** So a
 *    styles-0-3 demo built the obvious way — a legacy figure with `pattern: '(Preset)'` — would be
 *    *indistinguishable from the library it is supposed to be differentiated from*, no matter how strong the
 *    warp. **The two levers that do not exist anywhere in the legacy corpus are the ARCHETYPE (a shape
 *    defined up to scale, normalised to a target fraction of the frame) and DRIFT (a field that MOVES).**
 *    `drift: 0` is the standing lattice and the default on all 203 shipped presets, so **every styles-0-3
 *    demo here carries a non-zero drift** — that alone is the thing legacy cannot do.
 *
 * ## Coverage — and ⚠️ it spans TWO files
 *
 * | style | name | demo | file |
 * |---|---|---|---|
 * | 0 | Wave Shift | `Shift Lattice Drift` | this file |
 * | 1 | Wave Zoom | `Axis Zoom Breathe` | this file |
 * | 2 | Zoom Overlay | `Radial Zoom Overlay` | this file |
 * | 3 | Zoom Combined | `Shear Zoom Combined` | this file |
 * | 4 | Fractal Feedback | `Kaleido Fractal Feedback` | this file |
 * | 5 | Procedural Flow | `Procedural Flow Drift` | this file |
 * | 6 | Fluid Feedback | `Fluid Feedback Bloom` | this file | ⚠️ renamed from `Fluid Advection Demo`, 21.2
 * | 7 | Density Refraction | **`Refraction Bloom`** | ⚠️ `chain-presets.ts` |
 * | 9 | Band Split | **`Band Split Crawl`** | ⚠️ `chain-presets.ts` |
 * | 8 | Time Warp | `Time Warp Lattice`, `Time Warp Smear` | this file, 2026-09-20 |
 * | 10 | Vortex | `Vortex Offset Drag` | this file, 2026-09-20 |
 * | 11 | Depth Parallax | `Parallax Depth Shell` | this file, 2026-09-20 |
 *
 * ⚠️ **NINE PRESETS WERE RENAMED 2026-09-21 (`21.3`, owner-approved) — the old names are gone from `src/` and
 * this is the only place they are written down.** Search here for a name an older document or comment cites:
 *
 * | old | new | why |
 * |---|---|---|
 * | `Axis Breathe` | `Axis Zoom Breathe` | *Breathe* evoked the zoom but named no style |
 * | `Radial Pulse` | `Radial Zoom Overlay` | style 2 is Zoom Overlay |
 * | `Shear And Swell` | `Shear Zoom Combined` | style 3 is Zoom Combined |
 * | `Kaleido Echo` | `Kaleido Fractal Feedback` | *Echo* is not the feature's word |
 * | `Flow Vortex` | `Procedural Flow Drift` | ⚠️ the old name carried ANOTHER style's word — *Vortex* is style 10 |
 * | `Chain Warp Echo` | `Chain Zoom Fractal` | named neither of its two styles (3 + 4) |
 * | `Stirred Pool` | `Liquid Field Pool` | names the subsystem, matching `Liquid Field Clouds`/`Liquid Field Fill` |
 * | `Liquid Beads` | `Liquid Cohesion Beads` | *Beads* is the effect, `Cohesion` is the control |
 * | `Liquid Cosmos` | `Fluid Cosmos` | ⚠️ in `chain-presets.ts`: *Liquid* with no liquid mode, pool or dye |
 *
 * ⚠️ **A NAME IS A PRIMARY KEY IN FIVE OWNERS, so a rename is never a one-line edit** (*Preset identity*):
 * the object KEY and `metadata.name` must move together, and **`Grand Tour` in `reel-store.ts` is GENERATED —
 * it was reconciled against a fresh composition of the library (274/274, 0 orphans, no positional difference)
 * rather than trusted after the edit.** ⚠️ **The deployment artefacts under `dist/` and the published `.scr`
 * still carry the OLD names** until `npm run build:all` restages them; a stale artefact shows those slots
 * `.missing` and plays 265 of 274. Two proposals from the same audit were deliberately NOT applied:
 * `Pigment Sheet` (the owner's choice between a rename and giving it the dye field it implies) and the
 * `Chain …` prefix question, which is one decision about six presets.
 *
 * Styles 7 and 9 already had purpose-built presets from the 2026-08-21 Phase 14 diagnostic sitting, and
 * duplicating them here would have put two demos of one style in the review set. **They are part of this
 * review set even though they live in the other file.**
 *
 * ⚠️ **This table said "styles 8, 10 and 11 are NOT IMPLEMENTED" until 2026-09-20 and it was WRONG — all three
 * are in `TRANS_MAP_STYLES` (12 entries), so `normaliseChain` keeps them.** The sentence was true when written
 * and nothing failed when it stopped being: **an absent demo and an unimplemented style are indistinguishable
 * from inside this file**, which is why `coveragecheck` derives its style floors from `TRANS_MAP_STYLES`
 * instead of from a list here. ⚠️ **8 and 11 are `weightless: true, requiresField: true`** — they contribute no
 * offset of their own and are DROPPED unless a field style shares the chain, so each of those three demos pairs
 * its style with a live field layer (§F fails a preset that does not).
 *
 * Three chain combinations and all **eight** materials follow the single-style demos, and **five liquid demos**
 * follow those — one for the render mode itself (`Liquid Surface`) and one for each Phase 15 subsystem
 * (`Liquid Field Pool` → Liquid Field, `Liquid Cohesion Beads` → Cohesion, `Dye Wake` → the dye field, `Pigment Sheet` →
 * 15.2's `pigment` colour model on a flat figure). ⚠️ **They do not follow the two criteria above** — an
 * iso-surface demo is not graded on differentiation from legacy, because no legacy preset can occlude at all.
 * Their own criteria are in the banner above `Liquid Field Pool`.
 *
 * ## Facts that decided the shape of these presets, each verified in the source
 *
 * ⚠️ **A layer's `proceduralFlow` / `fluidFeedback` / `ifsParams` block is for SERIALISATION ONLY.** The
 * live values are `main.ts`'s `currentProceduralFlow` / `currentFluidFeedback` / `currentIfsParams`, loaded
 * from **`overlay.proceduralFlow` / `overlay.fluidFeedback` / `overlay.ifsParams`** (`main.ts` ~1668-1694).
 * A style-5 demo carrying its tuning only in the layer would render the DEFAULT flow and read as the feature
 * doing nothing. Every style 5/6/4 demo here therefore writes the OVERLAY block, which is also what
 * `getSnapshot()` emits.
 *
 * ⚠️ **A material forces `renderMode: 'splat'`** (`main.ts` ~1709) and **`overlay.material` has no
 * "inherit the default" form** — it is applied by assignment, so an ABSENT block lets the live session's
 * material leak into the preset. Every material demo therefore writes all twelve fields explicitly, even
 * where they equal the preset default, exactly as `Miracle Frost` does and for the same reason.
 *
 * ⚠️ **`MigrationLayer` clamps `style` to `Math.min(style, 4)` — on the LEGACY branch only.** A `version: 2`
 * preset takes the `structuredClone` path and keeps styles 5-9 intact. This was checked before authoring,
 * because if the clamp had applied here the style 5/6/7 demos would have silently loaded as style 4.
 *
 * ⚠️ **`postProcessors.bloom` is INERT** (`@deprecated NOT READ BY THE PIPELINE`). Grading comes solely from
 * `overlay.filmLook`. The block is written because every preset and export carries it, not to any effect.
 *
 * ⚠️ **Both halves of every dual-source field are written consistently** (invariant 17): `renderer.mode` with
 * `overlay.renderMode`, `postProcessors.transMap.enabled`/`style` with `overlay.transMapEnabled`/
 * `transMapStyle`, and `transMapStyle` mirroring `transMapChain[0].style`. The Lab writes only the overlay,
 * so a session export ships them disagreeing; a hand-authored file has no excuse. Do not de-duplicate one.
 *
 * ## House rules deliberately followed, and one deliberately not
 *
 * The warp demos obey the **low-accumulation** judging rule (`decayFactor` 0.72-0.86, moderate particle
 * counts) because a warp is read from displaced STRUCTURE and a long trail hides it. ⚠️ The two Phase 14
 * diagnostic presets in `chain-presets.ts` deliberately do NOT obey it — style 7's height field *is*
 * accumulated alpha — which is why they were left where they are rather than folded into this file's
 * conventions.
 *
 * ⚠️ **The warp demos are on `'Legacy Graded'` so the operator is read with minimal grading between it and
 * the observer — with ONE exception: `Chain Zoom Fractal` is on `'Plasma'`** (a user call from the 2026-08-21
 * review pass). That look overrides `renderer.glow` and installs a velocity-mapped `palette`, so on that one
 * preset the `renderer.glow` and `colorBase`/`colorAmp` values below are dead. Its own comment derives why
 * the trade is worth it there and nowhere else in this file.
 *
 * Preview-grid cost: this group adds 23 tiles. The grid is budget-driven with lazy slots, so the cost is
 * scheduling latency rather than frame time — but if the set is kept in full, that is the number to
 * re-measure against, not an assumption. ⚠️ **The five liquid tiles show the SURFACE ONLY** — preview tiles
 * never dye, never bead and never stir, by decision (`grid-tile-renderer.ts`'s `buildLiquidState()`), so on
 * those five a tile that looks unlike the main view is the documented behaviour rather than the grading-chain
 * defect that reading normally localises.
 */

/**
 * Wave-array builders — **functions, not shared constants, and that is deliberate.**
 *
 * Several demos reuse one legacy figure. A shared array literal would hand the SAME nested objects to
 * several presets, and anything that mutated one layer in place would silently edit the others (the I12
 * shared-mutable hazard `cloneIfsParams` exists for). `MigrationLayer.migrate` does `structuredClone` on a
 * v2 preset, so today nothing would notice — that is a property of the current load path, not a guarantee,
 * and a builder costs nothing.
 */
const zeroAxis = () => ({
  phase: 0,
  am: { base: 0, amplitude: 0, frequency: 0 },
  fm: { base: 0, amplitude: 0, frequency: 0 },
});

/** Two all-zero waves, the explicit spelling of "this figure uses wave 0 only". */
const silentTail = (): WaveConfig[] => [
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
];

/** Legacy `Cylinder` — a sparse, near-geometric lattice. The most legible surface a warp can act on. */
const cylinderWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 10.986328, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 20.182291, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 9.375, amplitude: 0, frequency: 0 }, fm: { base: 98, amplitude: 0, frequency: 0 } },
  ] },
  ...silentTail(),
];

/**
 * Legacy `Quader` — for **liquid** (v8 Step 15.1). All three waves active, transcribed from
 * `public/psss_presets.json` verbatim.
 *
 * ⚠️ Chosen for a MEASURED property: mean distance between CONSECUTIVE particle indices is 1.23 px at
 * 1024x768 **and at `Quader`'s own authored count of 25 000** — the widest among the low-accumulation presets
 * (`Cylinder` 0.50 at 10 000, `Pipes` 0.87 at 10 000, `Waves` 0.13 at 20 000). A summed density field only has
 * separate lobes to merge if the curve leaves gaps at the sprite's own scale, so a tighter figure is ONE blob
 * at every Iso Level and can demonstrate nothing. Design box 75x75.
 *
 * ⚠️ **The COUNT is half of that figure, so always state it.** Spacing is curve length / count, hence
 * inversely proportional to sampling density of the SAME curve: `Liquid Surface` draws this table at 15 000
 * and measures 2.06 px, which is `1.23 x 25000/15000 = 2.05` — the same table, more room between samples, not
 * a different figure. A bare "1.23 px" therefore describes a count as much as a shape.
 */
const quaderWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 24, amplitude: 0, frequency: 0 }, fm: { base: 21, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 24, amplitude: 0, frequency: 0 }, fm: { base: 21, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 24, amplitude: 0, frequency: 0 }, fm: { base: 0.5, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 4, amplitude: 6, frequency: 63 }, fm: { base: 63, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 4, amplitude: 6, frequency: 60 }, fm: { base: 63, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 96, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 1, amplitude: 1, frequency: 63 }, fm: { base: 105, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 1, amplitude: 1, frequency: 60 }, fm: { base: 105, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
  ] },
];

/** Legacy `Borg Cube` — an 11x7 nodal lattice; the reference case for reading a ZOOM against fixed nodes. */
const borgCubeWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 42.666664, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 8, frequency: 1 } },
    { phase: 0, am: { base: 42.666668, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 8, frequency: 2 } },
    zeroAxis(),
  ] },
  ...silentTail(),
];

/** Legacy `Pipes` — long smooth tubes, so a FLOW field's streamlines are visible along their length. */
const pipesWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 32, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 4, frequency: 1 } },
    { phase: 0, am: { base: 32, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 4, frequency: 2 } },
    { phase: 0, am: { base: 20, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 32, frequency: 1 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 4, amplitude: 0, frequency: 0 }, fm: { base: 32, amplitude: 16, frequency: 1 } },
    { phase: 0, am: { base: 4, amplitude: 0, frequency: 0 }, fm: { base: 32, amplitude: 16, frequency: 2 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
];

/** Legacy `Miracle` — a symmetric rosette, centred and untumbled: the figure an ECHO can register against. */
const miracleWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 0, amplitude: 40, frequency: 1 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 40, frequency: 2 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 30, am: { base: 0, amplitude: 20, frequency: 3 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 20, frequency: 4 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
];

/**
 * Legacy `Cosmos Energy`.
 *
 * ⚠️ **No longer the shared figure of the material demos** — see the MATERIALS section banner. It was, until
 * the 2026-08-21 review rejected the one-figure comparison set; it is kept because the TransMap demos above
 * still use it, and because it remains a good velocity-spread figure (`fm.amplitude` 16/16/64).
 */
const cosmosWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 16.479492, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 16, frequency: 1 } },
    { phase: 0, am: { base: 22.705078, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 16, frequency: 1.1 } },
    { phase: 0, am: { base: 12.053572, amplitude: 21.428572, frequency: 10 }, fm: { base: 0, amplitude: 64, frequency: 1 } },
  ] },
  ...silentTail(),
];

// ============================================================================================
// FIGURES FOR THE MATERIAL DEMOS — one per material, each picked by MEASUREMENT.
//
// ⚠️ **How these were chosen, because it is not by eye and it is not reproducible by intuition.** A probe
// replicated the real pipeline — `lissajous.ts`'s wave evaluation, its EMA-of-max velocity normalisation,
// and `material.ts`'s per-frame RANK normalisation — over all 177 legacy figures, and was VALIDATED against
// the one figure measurement this codebase records (`material.ts` states the `Fire and Ice` waves have
// median normalised speed 0.24; the probe returned 0.238).
//
// ⚠️ **The counter-intuitive result that drove every choice: FIGURE SPEED DOES NOT AFFECT TEMPERATURE.**
// Velocity is normalised TWICE — once by `velRefEMA` in `lissajous.ts` and again min-to-max across the
// frame in `material.ts` — so absolute speed divides out completely. What survives is the *within-frame
// speed CONTRAST*. So "make it move faster so it burns hotter" is false, `waveSpeed`/`speedFactor` are
// pacing controls only, and the figure property that matters is how widely its per-particle speeds SPREAD.
//
// Three measured statistics are quoted per figure below:
//   * **coverage** — of 20 ramp buckets, how many hold >=1 % of the population. A figure at coverage 1
//     shows ONE colour no matter which ramp is applied (six legacy figures are, e.g. `Cylinder`).
//   * **median heat / hot fraction** — where the population sits, and what share exceeds 0.7.
//   * **arc coherence** — mean distance between CONSECUTIVE particle indices over the step a smooth circle
//     of the same extent would take. Particle index maps directly to arc position, so a LOW value means
//     consecutive indices are spatially adjacent and the figure reads as continuous strands. This is what
//     decides whether `Organic`'s index-keyed age wave reads as a pulse travelling along the curve.
// Plus **extent** (model half-extent), which is `Fog`'s contrast control — see its own note.
// ============================================================================================

/**
 * Legacy `Barrock` — for **Plasma**. Coverage 19/20, median heat 0.77, hot fraction 0.57 at extent 17: the
 * hottest-running figure in the library that is also COMPACT. Plasma's `thermalLag` of 0.08 s tracks
 * velocity almost instantly, so a tight figure with high speed contrast crackles rather than glows.
 *
 * Structurally it is `Miracle` with amplitudes 18.75/18.75 instead of 40/20 — four single-harmonic axes on
 * frequencies 1,2,3,4. Authored in a 75x75 design box, which is the UNIT of the amplitudes below.
 */
const barrockWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 0, amplitude: 18.75, frequency: 1 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 18.75, frequency: 2 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 30, am: { base: 0, amplitude: 18.75, frequency: 3 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 18.75, frequency: 4 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
];

/**
 * Legacy `Diffusion`/`Meditation` waves — for **Liquid Light** and **Organic**.
 *
 * **Arc coherence 0.50 — the most coherent figure in the library**, and by a wide margin (the next is 0.64).
 * Only ONE wave is active and its two XY axes are pure AM bases with `fm.base: 0, fm.amplitude: 1`, so the
 * frequency sweeps slowly through zero and the curve stays a small number of long continuous strands rather
 * than a dense scribble. Coverage is still 19/20 with median heat 0.71.
 *
 * That combination — long strands PLUS wide speed spread — is why it serves two materials:
 *   * `LiquidLight` (velocity heat, `thermalLag` 0.3) reads as viscous flow ALONG the strands;
 *   * `Organic` (age heat, keyed to particle index ⇒ arc position) needs spatial adjacency of consecutive
 *     indices or its 6-second pulse degenerates into uncorrelated twinkling.
 *
 * ⚠️ The two legacy presets differ ONLY in `particleCount` (1000 vs 4000) and `sinMagicParams`; the waves
 * are byte-identical, which is why one builder serves both. Design box 75x100.
 */
const diffusionWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 37.5, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 50, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 0, amplitude: 10, frequency: 1 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
  ] },
  ...silentTail(),
];

/**
 * Legacy `Flower Power` — the donor figure for **physarum** (`Physarum Flower`, which is named after it), and
 * chosen on a MEASUREMENT rather than a look.
 *
 * ⚠️ **A FIELD SYSTEM'S DEMO FIGURE IS SELECTED ON FRAME COVERAGE, WHICH IS A PRECONDITION AND NOT A TASTE
 * JUDGEMENT.** Physarum is spatial — strands only find each other where deposits overlap — so a figure that
 * occupies a small fraction of the frame cannot exhibit the effect at any parameter value. Measured
 * instantaneous coverage (particles present in one frame, 64x64 grid over 1024x768, cap 4000):
 *
 *     diffusionWaves   0.8 %   <- this preset's FIRST version (then named `Slime Network`), and the whole
 *                                reason it failed review
 *     flowerWaves     32.9 %
 *     Penta Star      40.4 %   (higher coverage but slower to READ as a network — see below)
 *
 * ⚠️ **Coverage alone does not pick the winner: buildup speed and LEGIBILITY are separate properties.**
 * Simulating the deposit/diffuse/sense loop on CPU at identical physarum settings, `Flower Power` reaches
 * **18.0 %** visible trail by frame 10 against `Penta Star`'s 7.7 %, and starts at a higher *filament*
 * fraction (13.5 % vs 8.3 % of lit cells having an unlit 4-neighbour) — i.e. it looks like a **network**
 * immediately rather than becoming one later. `Penta Star` overtakes it on raw coverage by frame 180, which
 * is exactly the wrong end of the run to optimise: the report this replaced said *"takes a long time to
 * build up"*.
 *
 * The shape is a ten-petal rosette — wave 2 carries `am.frequency: 10` on both XY axes at an 18° phase
 * offset — laid over wave 1's slow AM/FM sweep (`fm.base: 128, amplitude: 64` on Z). That gives radial
 * strands with gaps between them, which is the substrate the sensors need: something to find, and somewhere
 * to spread into. `rotation: [0, 0, 0]` is the legacy preset's own and is kept — a rotating figure drags the
 * deposit across the trail and smears the network instead of reinforcing it. Design box 100x100.
 */
const flowerWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 25, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 25, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 20, amplitude: 10, frequency: 1 }, fm: { base: 128, amplitude: 64, frequency: 1 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 12.5, amplitude: 12.5, frequency: 10 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
    { phase: 18, am: { base: 12.5, amplitude: 12.5, frequency: 10 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [zeroAxis(), zeroAxis(), zeroAxis()] },
];

/**
 * Legacy `Burn Burn Burn` — for **Fire**. Extent 322 with z-spread 410 and coverage 19/20: large in every
 * axis, which is what buoyancy needs. Buoyancy applies an UPWARD offset per unit temperature capped at
 * `maxOffset` px, so a figure that already fills the frame vertically gives the rise somewhere to go; a
 * compact figure would simply translate upward as a blob.
 *
 * All three waves active, every axis fully AM- and FM-modulated (`am.base == am.amplitude` on all nine, so
 * each axis breathes from 0 to twice its base). Design box 75x60.
 */
const burnWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 112.5, amplitude: 112.5, frequency: 10 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 72, amplitude: 72, frequency: 11 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 97.2, amplitude: 97.2, frequency: 3 }, fm: { base: 8, amplitude: 10, frequency: 1 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 7.5, am: { base: 42, amplitude: 42, frequency: 7 }, fm: { base: 8, amplitude: 4, frequency: 5 } },
    { phase: 0, am: { base: 30, amplitude: 30, frequency: 8 }, fm: { base: 8, amplitude: 4, frequency: 6 } },
    { phase: 0, am: { base: 36, amplitude: 36, frequency: 9 }, fm: { base: 8, amplitude: 4, frequency: 7 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 7.5, amplitude: 7.5, frequency: 4 }, fm: { base: 32, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 4.8, amplitude: 4.8, frequency: 5 }, fm: { base: 32, amplitude: 2, frequency: 1 } },
    { phase: 0, am: { base: 6.3, amplitude: 6.3, frequency: 6 }, fm: { base: 32, amplitude: 3, frequency: 1 } },
  ] },
];

/**
 * Legacy `Inside Nebula` — for **Smoke**. Extent 328, z-spread 467, and arc coherence 4.72, i.e.
 * deliberately INCOHERENT: consecutive indices scatter, so the figure reads as a diffuse volume rather than
 * as strands. Smoke's 16 px splat at `falloffExponent 1.5` is a soft wide kernel that wants exactly that.
 *
 * Same three-wave skeleton as `Burn Burn Burn` at higher `fm.base` (32 and 128 against 8 and 32), which is
 * what turns the same construction from streaked into cloudy. Design box 75x75.
 */
const nebulaWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 112.5, amplitude: 112.5, frequency: 10 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 90, amplitude: 90, frequency: 11 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 108, amplitude: 108, frequency: 3 }, fm: { base: 32, amplitude: 10, frequency: 1 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 7.5, am: { base: 42, amplitude: 42, frequency: 7 }, fm: { base: 32, amplitude: 4, frequency: 5 } },
    { phase: 0, am: { base: 37.5, amplitude: 37.5, frequency: 8 }, fm: { base: 32, amplitude: 4, frequency: 6 } },
    { phase: 0, am: { base: 40, amplitude: 40, frequency: 9 }, fm: { base: 32, amplitude: 4, frequency: 7 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 7.5, amplitude: 7.5, frequency: 4 }, fm: { base: 128, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 6, amplitude: 6, frequency: 5 }, fm: { base: 128, amplitude: 2, frequency: 1 } },
    { phase: 0, am: { base: 7, amplitude: 7, frequency: 6 }, fm: { base: 128, amplitude: 3, frequency: 1 } },
  ] },
];

/**
 * Legacy `Dancing Elphes` — for **Fog**, and chosen on a measurement no other material shares.
 *
 * ⚠️ **`Fog` is the only material whose heat driver reads POSITION, and those positions are SCREEN PIXELS.**
 * `material.update()` is called at `lissajous.ts:1043`, i.e. AFTER the projection block, so the driver
 * `(sin(px*0.003)*0.5+0.5) * (cos(py*0.004)*0.5+0.5)` evaluates on projected pixel coordinates. Its
 * spatial period is ~2094x1571 px — about half a cycle across a 1024x768 canvas — which makes it a STATIC
 * screen-space field that the figure moves through.
 *
 * **Consequence: figure EXTENT is Fog's contrast control, not brightness.** Measured heat span against
 * model half-extent at `waveScale` 7.68:
 *
 *     extent 17 (131 px)  ->  heat 0.216 .. 0.650   span 0.43   <- the old `Cosmos Energy` demo, i.e. flat
 *     extent 32 (246 px)  ->  heat 0.068 .. 0.787   span 0.72
 *     extent 60 (461 px)  ->  heat 0.000 .. 0.850   span 0.85   <- the driver's full range
 *
 * `Dancing Elphes` has **extent 423, the largest in the library**, so it spans the field completely. And
 * because the field is stationary while the figure ROTATES through it, regions brighten and darken as it
 * turns — which is the only way to animate a position-driven material. That is why this preset's `rotation`
 * is non-zero on all three axes while most demos here rotate on Z alone. Design box 100x60.
 */
const elphesWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 150, amplitude: 150, frequency: 10 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 72, amplitude: 72, frequency: 11 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 115.2, amplitude: 115.2, frequency: 3 }, fm: { base: 8, amplitude: 10, frequency: 1 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 7.5, am: { base: 56, amplitude: 56, frequency: 7 }, fm: { base: 8, amplitude: 4, frequency: 5 } },
    { phase: 0, am: { base: 30, amplitude: 30, frequency: 8 }, fm: { base: 8, amplitude: 4, frequency: 6 } },
    { phase: 0, am: { base: 42.666668, amplitude: 42.666668, frequency: 9 }, fm: { base: 8, amplitude: 4, frequency: 7 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 10, amplitude: 10, frequency: 4 }, fm: { base: 32, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 4.8, amplitude: 4.8, frequency: 5 }, fm: { base: 32, amplitude: 2, frequency: 1 } },
    { phase: 0, am: { base: 7.4666667, amplitude: 7.4666667, frequency: 6 }, fm: { base: 32, amplitude: 3, frequency: 1 } },
  ] },
];

/**
 * Legacy `Water Ice Crystal` waves — for **Ice**, and chosen to be *not* `Miracle`.
 *
 * The 2026-08-21 browser verdict on the old `Material Ice` was *"too close to Miracle Frost"*, and the
 * mechanical reason was that the two shared BOTH halves of what makes a preset: the `Miracle` figure and
 * style 3 driven by `Miracle`'s own `sinMagicParams` tables. Only the crystal block differed, so the
 * differentiation lived entirely inside the one subsystem the verdict said the preset over-focused on.
 *
 * This figure is a different KIND of curve. All three waves are active and every axis is a 3/5/7-frequency
 * AM pair with `am.base == am.amplitude` on waves 1 and 2, so the outer contour is a 3-fold rounded triangle
 * with two progressively finer harmonic shells inside it — a faceted, concentric form rather than
 * `Miracle`'s 1:2 + 3:4 open Lissajous braid. Two properties earn it the slot:
 *
 *  - **A closed, layered silhouette gives accretion somewhere to build.** Crystal growth is spatial: arms
 *    extend where neighbouring wave particles are within `accretionRadius`. Concentric shells put particles
 *    at many radii along one contour, so a crystal has neighbours in more directions than on an open braid.
 *  - **The Z axis is silent on all three waves** (`zeroAxis()` on every third slot), so the figure is
 *    genuinely PLANAR. That matters here and nowhere else in this group: the crystal pass sorts back to
 *    front by depth and alpha-occludes, so on a deep figure crystals bury each other and the hexagonal
 *    lattice reads as clutter. Flat, they read as a sheet of ice seen face-on.
 *
 * ⚠️ Design box **80x60**, not 80x80 — the legacy figure is authored wider than tall and the uniform canvas
 * fit takes the smaller axis, so writing 80x80 would shrink it by a quarter.
 */
const waterIceWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 0, amplitude: 40, frequency: 3 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    { phase: 30, am: { base: 0, amplitude: 30, frequency: 3 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 10, amplitude: 10, frequency: 5 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
    { phase: 18, am: { base: 7.5, amplitude: 7.5, frequency: 5 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 5, amplitude: 5, frequency: 7 }, fm: { base: 7, amplitude: 0, frequency: 0 } },
    { phase: 12.857, am: { base: 3.75, amplitude: 3.75, frequency: 7 }, fm: { base: 7, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
];

// ============================================================================================
// FIGURES FOR THE PHASE 15 LIQUID DEMOS — chosen by MEASUREMENT, on properties that are specific to
// the liquid path and do not appear anywhere above.
//
// ⚠️ **The liquid demos are picked on DIFFERENT statistics from the material demos, and reusing the
// material criteria would have chosen wrong every time.** A material demo is graded on temperature
// spread; an iso-surface demo is graded on three things a material never cares about:
//
// ⚠️ **AND TWO OF THESE FIGURES WERE REPLACED AFTER A USER REVIEW, ON GROUNDS NO MEASUREMENT BELOW WAS
// TAKING — the two rejections are the most reusable thing in this block.** The pool demo's figure was
// chosen on displacement per frame and delivered a bar that retraced one groove; the correct statistic
// is SWEPT AREA, and the two disagree precisely at the extreme where a "best" figure is picked. The
// cohesion demo's figure was `Liquid Surface`'s own, defended in its doc block as a controlled
// side-by-side — and that defence lost: in a 360-preset grid, two adjacent tiles that look alike read as
// a duplicate rather than as a comparison. ⚠️ **A DEMO IS GRADED AGAINST ITS NEIGHBOURS IN THE GRID, NOT
// ONLY AGAINST ITS OWN SUBSYSTEM.** Both replacements are documented in place; see `rotatingBandWaves()`
// and `mastersLightWaves()`.
//
// ⚠️ **A FIGURE SWAP ON THE LIQUID PATH IS ALWAYS ALSO A THRESHOLD CHANGE.** `isoLevel` is a ratio
// against a reference measured on the FIGURE's own curve, so an elaborate figure has wider index
// spacing, a LOWER `isoRef`, and fattens into a solid mass at the threshold a simple one needed —
// measured at 14.23 % of the frame against the intended 2.78 %. **Never carry an iso/kernel pair across
// a figure change; re-derive it as a time series.**
//
//   * **index spacing** — `measureIndexSpacing()`'s own quantity, the distance between consecutive
//     particle indices. It is what decides whether the summed field has GAPS in it, so it is the
//     property that makes a merge threshold mean anything. A figure at spacing 0.5 px is one body at
//     every Iso Level and has no merge to demonstrate.
//   * **on-screen fraction** — measured as the share of the live population outside [0,w)x[0,h).
//     ⚠️ **This is invariant 21's clause: a magnitude is only a defect where the quantity is BOUNDED,
//     so for a coordinate the reading is the OFF-SCREEN FRACTION.** It disqualified two otherwise
//     ideal figures below, and it matters more here than in any other mode because the surface is a
//     FULLSCREEN pass — a clipped particle still contributes density at the frame edge, so the
//     silhouette gets cut rather than the particle simply vanishing.
//   * ⚠️ **particle COUNT, which is not a taste choice on this path.** `resolveLiquidReference()`
//     takes its reference from `min(state.waveCount, solidCount)` — the FIGURE's count, excluding
//     sparks, pool and crystals — so a denser figure raises `isoRef` for the whole frame. Measured on
//     `Rotating Band` with a 20 000-particle pool at kw 2.0: at N = 4 000 the reference is 1.11 and the
//     pool ADDS 14.3 coverage points; at N = 20 000 it is 5.54 and the pool adds 3.6. The pool demo's low
//     figure count is therefore the ENABLING CONDITION for the pool being visible at all.
// ============================================================================================

/**
 * Legacy `Rotating Band` — for the **Liquid Field** pool demo (v8 Step 15.5).
 *
 * ⚠️ **THIS FIGURE REPLACED `Radar`, AND THE MEASUREMENT THAT CHOSE `Radar` WAS THE WRONG ONE.** `Radar`
 * was selected on DISPLACEMENT PER FRAME (23.9 px/frame, the library's highest) on the reasoning that a
 * fast stirrer writes a strong velocity field. It does — into one groove. Measured afterwards on a 64x48
 * occupancy grid over 20 s, `Radar` visits **18.2 % of the frame, the worst of 27 candidates**: a thin
 * bar on a pure z-rotation retraces its own arc and the pool outside that arc is never touched. **A
 * stirrer is graded on SWEPT AREA, and displacement per frame does not imply it** — the two statistics
 * disagree at the extremes, which is exactly where a "best" figure gets picked.
 *
 * `Rotating Band` sweeps **70.0 %** of the frame over the same 20 s at an evenness (normalised entropy
 * over visited cells) of 0.982, and it does so with a genuinely elaborate body rather than a bar: three
 * active waves, six modulated axes, FM bases 12 and 18 carrying `fm.amplitude` 12/12/2 and 6/6/6 at
 * frequencies 1/2/3, so the band is a woven ribbon that folds through itself. `rotation` and `angle` are
 * `[0.5, 0.5, 0.5]` — tumbling on ALL THREE axes, which is what turns the ribbon over and is why the
 * swept area is high without the figure ever leaving its box. Measured extent 706x751 → 682x568 over
 * t = 3 → 45 s, **0.00 % off screen** at every sampled instant except a transient 0.33 % at t = 10 s.
 *
 * ⚠️ **A high swept fraction is necessary but NOT sufficient, and four better sweepers were rejected on
 * DIVERGENCE.** `Cosmo Flower`, `Protuberance`, `Space The Final Frontier` and `First Contact` all reach
 * 100 %, and `High Frequency` 99.8 %, but their forward-Euler integration walks off: `Protuberance`
 * reaches extent 1900682x794398 by t = 10 s (14.7 % off screen), `Disco Terror` 25.6 % off, `Cosmo
 * Flower` 8.4–10.8 % off throughout. This is invariant 21's clause — for a coordinate the reading is the
 * OFF-SCREEN FRACTION, not the magnitude — and it matters more here than anywhere because the surface is
 * a fullscreen pass, so a clipped particle still deposits density at the frame edge.
 *
 * Design box 100x100, `waveSpeed` 0.05, all three per-wave speeds 0.05. Displacement is 4.1 px/frame,
 * a sixth of `Radar`'s, and the pool is stirred better for it.
 */
const rotatingBandWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 30, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 30, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 54, am: { base: 16, amplitude: 0, frequency: 0 }, fm: { base: 12, amplitude: 12, frequency: 1 } },
    { phase: 0, am: { base: 16, amplitude: 0, frequency: 0 }, fm: { base: 12, amplitude: 12, frequency: 2 } },
    { phase: 0, am: { base: 3.5714285, amplitude: 0, frequency: 0 }, fm: { base: 12, amplitude: 2, frequency: 3 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 5, am: { base: 3.125, amplitude: 0, frequency: 0 }, fm: { base: 18, amplitude: 6, frequency: 1 } },
    { phase: 0, am: { base: 4.1666665, amplitude: 0, frequency: 0 }, fm: { base: 18, amplitude: 6, frequency: 2 } },
    { phase: 32, am: { base: 3.5714285, amplitude: 0, frequency: 0 }, fm: { base: 18, amplitude: 6, frequency: 3 } },
  ] },
];

/**
 * Legacy `The Masters Light` — for the **Cohesion** beading demo (v8 Step 15.4).
 *
 * ⚠️ **THIS FIGURE REPLACED `Phantasy Spiral`, WHOSE WAVE TABLE IS BYTE-IDENTICAL TO `quaderWaves()`** —
 * measured, and they are the only two of the 177 that share a table, differing solely in rotation
 * (`[0, 0, 0.3]` against `[0, 0.2, 0.3]`). That made the cohesion demo read as `Liquid Surface` with a
 * texture on it. ⚠️ **The earlier doc block argued the shared figure was a FEATURE — a clean side-by-side
 * where beading is the only variable — and that argument was overruled: a demo in a 360-preset library
 * competes for attention against its neighbours, so a controlled comparison the viewer never asked for
 * costs more than it buys.** The replacement carries a different silhouette AND a different motion.
 *
 * ⚠️ **It was chosen on the ON/OFF SEPARATION SUSTAINED OVER TIME, which is a stricter reading than the
 * blob count at one instant.** Measured at N = 12 000, kw 2.52 / iso 0.3536, cohesion 0.85 / 12.1 / 2.5
 * against cohesion off, at t = 5 / 10 / 20 / 30 / 45 s:
 *
 *     cohesion ON    45 / 39 / 123 / 131 / 60 bodies, median 296–556 px
 *     cohesion OFF    1 /  1 /   1 /   1 /  1 body,   median 119 655 – 186 889 px
 *
 * ⚠️ **The OFF row is the property that is hard to find and it is what disqualified every other
 * candidate.** Cohesion is read as *"the sheet broke into drops"*, so the unbeaded figure has to be an
 * unbroken sheet at EVERY instant — one body, no exceptions. `Spiritual`, `Galaxy` and `Time Vortex II`
 * each fall to a multi-body or near-empty frame at some sampled instant with cohesion OFF, so the reading
 * inverts there: the drops look like the figure's own structure rather than like the feature.
 * `The Masters Light` is a single 120 000–187 000 px body at all five instants.
 *
 * Structurally: two active waves. The first is a slow AM-modulated envelope (`am.amplitude` 12 at
 * frequencies 1 and 1.23 — a deliberate irrational-ish beat), the second a high-frequency lattice
 * (`am.amplitude` 6 at frequencies 63 and 60 over `fm.base` 63) whose third axis is pure `fm.base` 96
 * with zero amplitude. That is what makes it a SHEET with fine internal texture rather than a wire: the
 * fast lattice fills the envelope, which is why it holds together as one body until cohesion breaks it.
 *
 * ⚠️ **Index spacing 2.52 px at 12 000 particles** (against `quaderWaves()`'s 2.41 at 15 000), and z-span
 * 666 — the deepest of the candidate set, so `angle: [30, 30, 0]` presents it as a tilted plate rather
 * than edge-on. Design box 75x75, extent 607x533, **0.00 % off screen** at every sampled instant.
 */
const mastersLightWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 12, amplitude: 12, frequency: 1 }, fm: { base: 21, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 12, amplitude: 12, frequency: 1.23 }, fm: { base: 21, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 24, amplitude: 0, frequency: 0 }, fm: { base: 0.5, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 4, amplitude: 6, frequency: 63 }, fm: { base: 63, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 4.0000005, amplitude: 6, frequency: 60 }, fm: { base: 63, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 96, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    zeroAxis(),
    zeroAxis(),
    zeroAxis(),
  ] },
];

/**
 * Legacy `Montezuma Looks at You` — for the **flat** liquid-surface demo.
 *
 * ⚠️ **GENUINELY PLANAR: all three waves have an all-zero z axis, so the measured z-span is exactly
 * 0.0.** That is a structural property of the table below, not a measurement that could drift, and it
 * is why this is the flat figure in the set rather than a figure that merely happens to look flat from
 * one angle. It also means `rotation: [0, 0, 0]` costs nothing — there is no third dimension to tumble.
 *
 * Three near-identical waves on FM bases 101 / 100 / 99 with `fm.amplitude` 1 on the outer two: the
 * three lattices beat against each other at a period of about one part in a hundred, which is what
 * makes the figure breathe slowly through its own structure instead of holding a pose.
 *
 * ⚠️ **The widest index spacing of any flat figure in the library — 5.45 px at 20 000 particles**,
 * against `Quader`'s 2.06 px at 15 000 and `Cylinder`'s 0.50 px at 10 000. That is the whole reason it
 * is here: a flat figure concentrates every particle into one plane, so almost all of them collapse to
 * spacing well under a pixel and the summed field has no gaps for a threshold to find.
 *
 * ⚠️ **Design box 100x100, and shrinking it CLIPS.** Measured extent 691x691 at 1024x768 with 0.00 %
 * of the population off screen at 100x100; re-fitting to 85x85 clips 1.33 % and to 75x75 clips 4.63 %.
 * The figure is square and fills its box, so there is no slack to reclaim.
 */
const montezumaWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 101, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 101, amplitude: 1, frequency: 1 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 100, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 100, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 99, amplitude: 1, frequency: 1 } },
    { phase: 0, am: { base: 15, amplitude: 0, frequency: 0 }, fm: { base: 99, amplitude: 1, frequency: 1 } },
    zeroAxis(),
  ] },
];

/**
 * **AUTHORED, not legacy — the only figure in this file with no legacy original.** Written for
 * `Fixed Dye Plume` after the owner's review (2026-09-20: *"use another figure than Quader to make the shape
 * more interesting"*), because every existing builder was excluded: `quader` by the owner, `cosmos` as the
 * only other dye preset's figure, `flower`/`rotatingBand`/`burn`/`mastersLight`/`montezuma` as liquid
 * neighbours, `nebula`/`elphes`/`waterIce` as frame-fillers (82–83 % off screen — they would fill the
 * background this preset needs), `cylinder` and `diffusion` as too static. Authoring one is precedented by
 * `rotatingBandWaves()` and `mastersLightWaves()`, which were also written for their demos.
 *
 * Structure: wave 1 is a **3D knot** — FM bases 15 / 25 / 10 (windings 3 : 5 : 2) with an AM envelope that
 * breathes at frequencies 1 and 1.23, the same deliberate irrational-ish beat `mastersLightWaves()` uses, so
 * the silhouette never holds a pose. Wave 2 is a fast lattice that fills the envelope and is what gives the
 * iso surface something to merge ACROSS (`P4`); wave 3 is silent.
 *
 * ⚠️ **Wave 2 is NOT `mastersLightWaves()`' lattice and that is deliberate** — 57 / 54 over FM base 57
 * rather than 63 / 60 over 63. Its own doc block records what a shared table cost once (a demo that read as
 * its neighbour), and the alternative was measured rather than assumed: at N 13 000, `figureScale 0.70`,
 * kw 2.0 / iso 1.8025 the two lattices are the same surface class (L63-6: coverage 7.93–10.74 %, survive
 * 0.35–0.57, largest 88–100 %; L57-6 below: 7.84–9.88 %, 0.35–0.60, 88–100 %), so nothing was given up by
 * varying it. A third variant, `am.frequency` 75 / 72, is **not** in the class: it collapses to ONE body at
 * survive 0.60–0.65 with a 10.8 % footprint.
 *
 * ⚠️ **Measured in `Fixed Dye Plume`'s own frame** (N 13 000, `rotation [0, 0, 0.4]`, `angle [15, 0, 0]`,
 * design box 75×75, `figureScale 0.70`, `speedFactor 0.5`, 1024×768, eight instants over 900 frames):
 * extent **577×558**, **0.00 % off screen**, z-span 402, coarse instantaneous occupancy **23.7 %** of the
 * frame, index spacing **1.67–2.38 px**. Against `quaderWaves()` in the same frame at its `figureScale 0.9`:
 * extent 569×541, occupancy 17.3 %, spacing 2.05–2.97 px. ⚠️ **The two scales are what make the extents
 * comparable — this figure is intrinsically the larger one**, so `figureScale` is not free here: raising it
 * to 0.80 grows the footprint to 35.8 % and the occupancy to 29.9 %, which is the background the dye needs.
 */
const plumeKnotWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 24, amplitude: 6, frequency: 1 }, fm: { base: 15, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 24, amplitude: 6, frequency: 1.23 }, fm: { base: 25, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 20, amplitude: 0, frequency: 0 }, fm: { base: 10, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 90, am: { base: 4, amplitude: 6, frequency: 57 }, fm: { base: 57, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 4, amplitude: 6, frequency: 54 }, fm: { base: 57, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 90, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    zeroAxis(),
    zeroAxis(),
    zeroAxis(),
  ] },
];

/**
 * **AUTHORED for the `Physarum Weave` retune (2026-09-20), and the ONLY builder in this file whose
 * amplitudes are in CANVAS PIXELS rather than in a ~100-unit design box.** That is the point of it, not a
 * style choice — the preset's own doc block carries the measured units finding it answers. `am.base: 104`
 * over three waves is a ±312 px envelope, measured extent **~700 px** in a 1024×768 frame at 0.0–0.1 % of
 * the population off screen: the same framing `montezumaWaves()` reaches from design box 100×100, but
 * reached in the units the physarum deposit already assumes.
 *
 * Structure: `montezumaWaves()`' three near-equal windings (FM bases 101 / 100 / 99, so the lattices beat
 * against each other at about one part in a hundred) are carried over deliberately — that beat is why the
 * figure keeps presenting a slightly MOVED lattice to the sensors. What is new is the sweep: **all three
 * waves carry `fm.amplitude`, and the three sweep frequencies are mutually incommensurate** (6 @ 1.3,
 * 5 @ 1.9, 6 @ 0.9, against Montezuma's 1 @ 1 on the outer two only), so the winding triple never returns
 * to itself and there is no period at which the network could settle into a pose.
 *
 * ⚠️ **FM is the motion lever and AM is not — measured, against my own hypothesis.** A candidate that
 * breathed the whole figure through `am.amplitude` held particle motion at 5.7 px per 30 frames while the
 * extent crept 702 → 796 px: AM scales the figure, it does not carry a particle THROUGH the trail. Every
 * axis below therefore has `am.amplitude: 0` and the whole sweep lives in `fm`.
 *
 * ⚠️ **PLANAR — and since the 2026-09-20 engine fix that is a LOOK decision, not an alignment requirement.**
 * The old prohibition here ("it may not be given a z axis; `figureScale` must stay 1.0") was a consequence of
 * the units defect: the deposit uv had no depth term and no `effectiveScale()`. It now carries both (a
 * per-particle `perspectiveFactor()`, clamped at both ends because the inverse divides by it), so z-extent and
 * the Figure Scale slider both stay aligned. ⚠️ **What is still NOT modelled is the 3D ROTATION** — the deposit
 * runs before it, so a rotating figure's trail is drawn at the unrotated pose. Keep this figure planar at
 * `rotation [0, 0, 0]` anyway: the preset's own comment gives the rendering reason (a rotating deposit smears
 * the network instead of reinforcing it), which the fix does not touch.
 *
 * ⚠️ **The sweep magnitudes are a measured optimum, not "as much as the slider allows."** Over 105 instants
 * (frames 480–3600, 4000 particles, `speedFactor 0.35`, `blend 0.06` **on the pre-fix deposit map, i.e. the
 * same wander the shipped `blend: 0.03` produces today**), against COARSE network churn — 16×16
 * block means, so per-texel deposit flicker cancels and only a change in the NETWORK's layout survives:
 *
 *     fm sweeps                    churn mean   churn MIN   particle move (px/30f)
 *     4 @ 1 on one wave only         0.117        0.097            15.1
 *     4 / 3 / 4  @ 1 / 1.4 / 0.7     0.110        0.093            16.9
 *     6 / 5 / 6  @ 1.3 / 1.9 / 0.9   0.133        0.103            22.9   <- below
 *     8 / 7 / 8  @ 1.6 / 2.3 / 1.1   0.138        0.083            40.7
 *     12 / 10 / 12 @ 2 / 2.9 / 1.4   0.123        0.065            75.7
 *
 * **The curve TURNS OVER**: at 12 @ 2 the figure moves 3.3x faster and reorganises the network LESS, because
 * the deposit is dragged across the field faster than the 50-frame trail memory can consolidate it — the
 * same smear the preset's `rotation: [0, 0, 0]` comment warns about, arrived at from the other direction, so
 * "more sweep" is not a safe direction to tune in. The chosen row wins on the MINIMUM rather than the mean
 * (the worst instant is the one a viewer sits through) and is the sparsest of the moving rows (43 % of the
 * field lit against 49–50 %), which is what keeps the network legible as strands.
 *
 * ⚠️ **THE WHOLE TABLE'S BASIS IS 4000 PARTICLES AND THE PRESET NOW SHIPS 9900** (owner-tuned export,
 * 2026-09-20). The comparison between rows is unaffected — one instrument, one count, one cadence — but the
 * absolute figures are not this preset's any more, and **re-measuring the table at 9900 would answer a
 * question nobody asked**: the row was chosen against its alternatives, and the owner then confirmed the
 * result in a browser. What the count does change, measured on the 21-instant cadence at `blend: 0.03`:
 * `churnC` 0.130 → **0.118** with the minimum 0.108 → 0.090 and `late/early` 0.79 → 0.74, while `move` is
 * flat at 28.5 → 28.6 px (the wander is per-particle and count-free). **2.5× the particles is a slightly
 * more settled network, not a different one** — the figure that answered the owner's original complaint was
 * v1's 0.018, an order of magnitude below either. It is denser and brighter: `lit%` 41.7 → 51.4 and
 * `strong%` 0.6 → **7.4**, which is the other half of why the export raises `exposure` and drops the bloom
 * threshold rather than leaving `Legacy Graded` alone.
 */
const physarumLatticeWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 101, amplitude: 6, frequency: 1.3 } },
    { phase: 0, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 101, amplitude: 6, frequency: 1.3 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 100, amplitude: 5, frequency: 1.9 } },
    { phase: 0, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 100, amplitude: 5, frequency: 1.9 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0.9, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 99, amplitude: 6, frequency: 0.9 } },
    { phase: 0, am: { base: 104, amplitude: 0, frequency: 0 }, fm: { base: 99, amplitude: 6, frequency: 0.9 } },
    zeroAxis(),
  ] },
];

/**
 * **AUTHORED for the `Pixel Line Art` retune (2026-09-20 owner: "completely static, no color, boring and not
 * visible that Pixel mode should add anything interesting here").** The preset's own doc block carries what
 * `pixel` turned out to be; this block is about the FIGURE, whose job is to put two far-apart stretches of one
 * curve in the same pixel as often as possible — that overlap is the only place an alpha-composited mode looks
 * different from an additive one.
 *
 * **Structure: the harmonic triple the library's own crossing figures use** — coprime index frequencies
 * 2 : 3, then 5 : 7, then 11 : 13, over geometric FM bases 4 / 20 / 100 (`Band Split Crawl` and `Hypnosis` ship
 * 5 / 25 / 125 with the same pairs). Coprime pairs are what make the strands cross rather than nest, and the
 * geometric bases keep the three layers at visibly different scales.
 *
 * ⚠️ **The coarse wave breathes from `am.base: 0` and the two fine waves do not, and that asymmetry is the
 * whole reason the figure stays on screen.** With `base === amplitude` on all three (my first candidate) the
 * envelopes pass through zero TOGETHER and the figure collapses: measured MIN extent **2 × 21 %** of the frame
 * at **41 % of instants**, against 27 × 35 % / 10 % for the shipped asymmetry — which is the library reference's
 * own figure (`Band Split Crawl`: 28 × 38 %, 7 %). ⚠️ **Only a long-window instant search sees this** (9000
 * frames = 150 s, sampled every 50): the 150–900-frame probes that scored the candidates reported
 * `fig 56 × 79 %` and `off 0.0 %` for both, because a collapse is PERIODIC and they never sampled its phase
 * (invariant 28, in its "search the instants" form). `physarumLatticeWaves()`' block states the rule this is an
 * instance of — **AM scales the figure, FM carries the particle** — so an AM swing is a size risk by
 * construction, and it is measured here rather than reasoned about.
 *
 * ⚠️ **`rotation` must stay [0, 0, 0] — the figure is nearly planar (z span 168 px against x span 654 px), so a
 * Y rotation turns it EDGE ON.** At [0, 3, 0] the same instant search reports MIN **7 × 45 %** and narrow at
 * **57 %** of instants: a quarter turn is a vertical line. The whole family ships `[0, 0, 0]` for this reason,
 * and the motion does not need it — with rotation zeroed the figure still measures churn 0.758 and 6.2 px per
 * 30 frames, i.e. rotation contributed nothing but the collapse.
 *
 * The z axis on the middle wave (`am.base: 8.5`) is for `renderer.depthSize`, and is deliberately modest: it
 * leaves the depth-driven size and brightness something to read without making the figure a shell.
 */
const pixelCrossingWaves = (): WaveConfig[] => [
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 0, amplitude: 23.5, frequency: 2 }, fm: { base: 4, amplitude: 0, frequency: 0 } },
    { phase: 18, am: { base: 0, amplitude: 23.5, frequency: 3 }, fm: { base: 4, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 11.75, amplitude: 11.75, frequency: 5 }, fm: { base: 20, amplitude: 0, frequency: 0 } },
    { phase: 3.6, am: { base: 11.75, amplitude: 11.75, frequency: 7 }, fm: { base: 20, amplitude: 0, frequency: 0 } },
    { phase: 0, am: { base: 8.5, amplitude: 3.0, frequency: 3 }, fm: { base: 20, amplitude: 0, frequency: 0 } },
  ] },
  { speed: 0.05, axes: [
    { phase: 0, am: { base: 5.875, amplitude: 5.875, frequency: 11 }, fm: { base: 100, amplitude: 0, frequency: 0 } },
    { phase: 0.72, am: { base: 5.875, amplitude: 5.875, frequency: 13 }, fm: { base: 100, amplitude: 0, frequency: 0 } },
    zeroAxis(),
  ] },
];

/** The all-zero `sinMagicParams` table, for a demo whose field comes from an archetype instead. */
const zeroTable = (): SinMagicParams => [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];

/**
 * `Vertical Ripple`'s table — the single most common table in the library (52 presets ship it verbatim).
 *
 * ⚠️ **Written as the LEGACY reader's fallback, never as this engine's input.** Every demo here names an
 * archetype, so `resolveStaticWaves` takes the archetype branch and never reads this. It is present so that
 * a reader which collapses a chain to one style still produces a warp of roughly the right character rather
 * than a flat field.
 */
const rippleTable = (): SinMagicParams => [[0,0,0,0],[0,0,0,0],[1,0,0,0],[8,0,0,0]];

/** The inert grading block. See the header: `postProcessors.bloom` is not read by the pipeline. */
const inertGrading = () => ({
  bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
  // ⚠️ The three grading vectors are TUPLES (`[number, number, number]`), not `number[]`. A bare literal in a
  // helper widens to `number[]` and every preset spreading it then fails to assign — which is the only reason
  // these casts exist. They assert the LENGTH, nothing about the values.
  toneMap: {
    curve: 'none' as const, exposure: 1.0,
    lift: [0, 0, 0] as [number, number, number],
    gamma: [1, 1, 1] as [number, number, number],
    gain: [1, 1, 1] as [number, number, number],
  },
});

export const DEMO_PRESETS: Record<string, UnifiedPreset> = {
  /**
   * **Style 0 — Wave Shift.** `Interference` archetype, drifting.
   *
   * Style 0 displaces along a summed separable field and is **cross-coupled by design**: the HORIZONTAL
   * displacement comes from the Y wave (`x2 = x + wy`, `y2 = y + wx`). `Interference` is equal magnitude
   * and opposite sign (`xFreq -1`, `yFreq +1`) — one broad counter-rotating cell across the whole frame,
   * which makes the cross-coupling legible as a shear rather than as noise.
   *
   * ⚠️ **`drift: 0.25` is the entire differentiation claim of this preset.** A standing style-0 field on a
   * legacy table is what 52 presets in the library already are; a field that MOVES is what none of them
   * are. Judge this preset on whether the drifting shear reads as its own effect, not on warp strength.
   *
   * `Cylinder` at `decayFactor 0.72` obeys the low-accumulation rule: the figure is a sparse near-geometric
   * lattice, so displaced structure is visible as displacement instead of as smear.
   */
  'Shift Lattice Drift': {
    metadata: { name: 'Shift Lattice Drift', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style0', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 3, 0], angle: [0, 1, 0],
      waves: cylinderWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.72, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Interference', strength: 0.85, detail: 1.0, drift: 0.25 } },
      ],
      transMapWarpMix: 0.9,
      transMapDispersion: 0,
      speedFactor: 0.5,
    },
  },

  /**
   * **Style 1 — Wave Zoom.** Per-axis zoom, i.e. ANISOTROPIC scaling.
   *
   * ⚠️ **This is the preset that separates style 1 from style 2, and the separation is the only reason both
   * exist.** Style 1 zooms each axis by its OWN wave (`x2 = zoom(cx, x, 1 - wx)`, `y2 = zoom(cy, y, 1 - wy)`),
   * so X and Y scale by different amounts at the same pixel — the frame stretches and squashes
   * non-uniformly. Style 2 averages the two waves into ONE zoom factor and is therefore always isotropic.
   *
   * `Grid Lattice` is chosen for exactly that: **`xFreq 6` against `yFreq 4`**, deliberately unequal, so the
   * two axes are never in step and the anisotropy is continuously visible. An archetype with equal
   * frequencies (`Coarse Swell`, `Fine Mesh`) would make style 1 look like style 2 — which is the trap this
   * demo exists to avoid, and the reason `Coarse Swell` is used for style 2 below instead.
   *
   * `zoomCenter` is off-centre at (38, 44). A centred zoom on a centred figure is a pure size change and
   * reads as the *figure* pulsing rather than the *frame* being scaled; the offset is what makes it read as
   * a spatial transform. `Borg Cube`'s nodal lattice supplies fixed reference nodes to see it against.
   */
  'Axis Zoom Breathe': {
    metadata: { name: 'Axis Zoom Breathe', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style1', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 5000, waveSpeed: 0.05,
      rotation: [1, 1, 1], angle: [0, 0, 0],
      waves: borgCubeWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.78, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 1, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 38, y: 44 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 1,
      transMapChain: [
        // `zoomCenter` is per-layer here rather than inherited: styles 1-3 read the layer's own centre when
        // present, and an explicit value is what makes the off-centre choice above survive a chain edit.
        { style: 1, enabled: true, weight: 1.0, zoomCenter: { x: 38, y: 44 },
          staticField: { pattern: 'Grid Lattice', strength: 0.8, detail: 1.0, drift: 0.18 } },
      ],
      transMapWarpMix: 0.85,
      transMapDispersion: 0,
      speedFactor: 0.4,
    },
  },

  /**
   * **Style 2 — Zoom Overlay.** One ISOTROPIC zoom factor, averaged from both waves.
   *
   * `zoom = 1 - (wx + wy) / 2`, applied identically to both axes — so the effect is a pure radial
   * scale that varies across the frame. `Coarse Swell` (frequency 1 on both axes, the single most used
   * frequency in the legacy corpus) gives **one broad lens over the whole image**, which is the cleanest
   * possible statement of "isotropic": the centre magnifies while the surround compresses.
   *
   * ⚠️ **Read this one against `Axis Zoom Breathe` (style 1).** Alone, either can be mistaken for the other; the
   * pair is the demo. Same `zoomCenter` was deliberately NOT used — style 2's radial character shows best
   * from the centre, and forcing a shared centre for the comparison would misrepresent both.
   *
   * `drift: 0.12` is lower than the style-0 demo's. An isotropic zoom is a large-amplitude effect and fast
   * drift on it reads as a pumping artefact rather than as a moving field.
   */
  'Radial Zoom Overlay': {
    metadata: { name: 'Radial Zoom Overlay', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style2', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 3, 0], angle: [0, 1, 0],
      waves: cylinderWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.75, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 2, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 2,
      transMapChain: [
        { style: 2, enabled: true, weight: 1.0, zoomCenter: { x: 50, y: 50 },
          staticField: { pattern: 'Coarse Swell', strength: 0.9, detail: 1.0, drift: 0.12 } },
      ],
      transMapWarpMix: 0.85,
      transMapDispersion: 0,
      speedFactor: 0.45,
    },
  },

  /**
   * **Style 3 — Zoom Combined.** A SHIFT composed with a zoom from a SECOND, INDEPENDENT table.
   *
   * ⚠️ **Style 3 is not style 2 at a second detail level, and this is the demo that has to prove it.**
   * `waveX`/`waveY` shift (cross-coupled, as in style 0) while `zoomX`/`zoomY` — built from
   * `sinMagicParams2` / `pattern2` — zoom. Two transformations from two tables, composed.
   *
   * The two archetypes are therefore chosen to be **maximally unlike each other**, so the composition
   * cannot be mistaken for one effect: `Diagonal Shear` shifts (equal frequency, opposite sign — the
   * antiphase family in its simplest form) while `Coarse Swell` zooms (one broad frequency-1 lens). A
   * diagonal slide over a slow breathing lens is a thing neither table produces alone.
   *
   * ⚠️ **`pattern2`, `strength2` and `zoomBias` are LIVE here and only here.** On a style 0/1/2 layer they
   * are fields nothing reads and `applyStaticFieldJump` deletes them — which is why no other demo in this
   * file carries them. `zoomBias: 0.15` biases the zoom term positive so the composition leans toward
   * magnification rather than oscillating symmetrically about unity.
   */
  'Shear Zoom Combined': {
    metadata: { name: 'Shear Zoom Combined', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style3', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 5000, waveSpeed: 0.05,
      rotation: [1, 1, 1], angle: [0, 0, 0],
      waves: borgCubeWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.8, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: {
        enabled: true, style: 3, beforeParticles: false,
        sinMagicParams: rippleTable(),
        // Style 3's SECOND table. Non-zero here, unlike every other demo in this file, because style 3 is
        // the one style that reads it at all — a legacy reader collapsing this chain needs both halves.
        sinMagicParams2: [[1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]],
        zoomCenter: { x: 50, y: 50 },
      },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 3,
      transMapChain: [
        { style: 3, enabled: true, weight: 1.0, zoomCenter: { x: 50, y: 50 },
          staticField: {
            pattern: 'Diagonal Shear', strength: 0.8, detail: 1.0, drift: 0.2,
            pattern2: 'Coarse Swell', strength2: 0.7, zoomBias: 0.15,
          } },
      ],
      transMapWarpMix: 0.85,
      transMapDispersion: 0,
      speedFactor: 0.4,
    },
  },

  /**
   * **Style 4 — Fractal Feedback.** The one COLOUR-domain style: an IFS-transformed echo of the frame.
   *
   * ⚠️ **Style 4 contributes NO displacement.** Its `domain` is `'colour'` and its `weight` is the echo's
   * OPACITY rather than a share of a summed offset — so `transMapWarpMix` is irrelevant to it and the
   * effect is a self-similar ghost composited over the image, not a warp. Its whole look comes from
   * `ifsParams`.
   *
   * ⚠️ **The live IFS transforms are read from `overlay.ifsParams`**, not from the layer's copy — the layer
   * block is serialisation. Both are written here and they are identical; if they ever disagree, the
   * overlay is what renders.
   *
   * `Kaleidoscope` (three transforms at 120°/240°/360°, scale 0.9) is chosen over `Spiral` or `Zoom Tunnel`
   * because a THREE-fold echo cannot be confused with motion blur or a trail, which a single rotating
   * transform can. `Miracle`'s untumbled symmetric rosette (`rotation [0,0,0]`) is the figure: an echo has
   * to register against something stationary and centred to read as an echo at all.
   *
   * `decayFactor 0.86` is the highest of the warp demos and deliberate — the echo composites the ACCUMULATED
   * frame, so an over-short trail leaves it little to be an echo of.
   */
  'Kaleido Fractal Feedback': {
    metadata: { name: 'Kaleido Fractal Feedback', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style4', 'ifs', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: miracleWaves(),
      colorBase: [32, 64, 128], colorAmp: [64, 64, 128], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    renderer: { mode: 'star', glow: 2.4, decayFactor: 0.86, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: {
        enabled: true, style: 4, beforeParticles: false,
        sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 },
        ifsParams: [
          { angle: 120, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
          { angle: 240, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
          { angle: 360, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
        ],
      },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 4,
      // ⚠️ THE LIVE COPY. `main.ts` resolves `ov.ifsParams ?? preset.postProcessors.transMap.ifsParams`.
      ifsParams: [
        { angle: 120, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
        { angle: 240, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
        { angle: 360, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
      ],
      transMapChain: [
        // `weight` here is ECHO OPACITY, not a displacement share. 0.55 keeps the source figure dominant;
        // near 1.0 the echo and the figure compete and neither reads as primary.
        { style: 4, enabled: true, weight: 0.55,
          ifsParams: [
            { angle: 120, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
            { angle: 240, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
            { angle: 360, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
          ] },
      ],
      // Present for completeness, and INERT for this preset: there is no field layer to mix.
      transMapWarpMix: 1.0,
      transMapDispersion: 0,
      speedFactor: 0.6,
    },
  },

  /**
   * **Style 5 — Procedural Flow.** A curl-noise flow field, here as a vortex.
   *
   * ⚠️ **The live config is `overlay.proceduralFlow`; the layer's copy is serialisation only.** Writing the
   * tuning solely into the layer would render the DEFAULT flow — the single most likely way to author a
   * style-5 preset that looks like the feature is broken.
   *
   * The `Vortex` archetype (`curlAmount 0.9`, `direction [0,0]`, `radial 0`) is chosen for the reason the
   * Phase 14 measurement makes interesting: **the static archetypes summed reach a tangential fraction of
   * 0.431 against 1.000 for a true swirl, and curl noise 0.411-0.515** — so no shipped *static* field
   * produces coherent rotation. (Taken over the 8 shipping then, 14 since 2026-09-23; separability is the
   * reason, not the count — see `VortexConfig`'s header.) A high-curl flow field is the closest the engine currently gets, which
   * makes "does this read as rotation?" the specific question this demo puts to a browser pass.
   *
   * `strength` is raised to 0.75 from the archetype's 0.5 and `evolutionSpeed` lowered to 0.5 from 0.8: a
   * fast-evolving field re-randomises before the eye can follow a streamline, so slow evolution at high
   * strength is what makes the flow legible as flow. `Pipes` supplies long smooth tubes for exactly that —
   * a streamline is only visible along something extended.
   */
  'Procedural Flow Drift': {
    metadata: { name: 'Procedural Flow Drift', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style5', 'flow', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 0, 1], angle: [0, 0, 0],
      waves: pipesWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.84, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 5,
      // ⚠️ THE LIVE COPY — `main.ts` reads `ov.proceduralFlow`. Every field is required by
      // `ProceduralFlowConfig`, so there is no partial spelling of this block.
      proceduralFlow: {
        strength: 0.75, scale: 1.5, curlAmount: 0.9, direction: [0, 0], radial: 0,
        evolutionSpeed: 0.5,
        // 'Custom': the scalars above are off `Vortex`'s authored values, and the dropdown must say so
        // rather than name an archetype this config no longer equals.
        archetype: 'Custom',
      },
      transMapChain: [
        { style: 5, enabled: true, weight: 1.0 },
      ],
      transMapWarpMix: 0.9,
      transMapDispersion: 0,
      speedFactor: 0.5,
    },
  },

  /**
   * **Style 6 — Fluid Feedback.** Velocity-field advection of the accumulated frame.
   *
   * ⚠️ **`Fluid Cosmos` runs this style at weight 0.03 — a PERTURBATION, deliberately.** That preset's
   * own note warns the weight is load-bearing at that magnitude and is easy to mistake for a disabled
   * layer. **This demo is the opposite case on purpose: weight 1.0, so the advection IS the subject.** The
   * two together are the range of the style, and if the library keeps only one it should be clear which
   * question it answers.
   *
   * ⚠️ **Style 6 is EXEMPT from the warp fade** (`1 - attractorBlend`) and derives three global overrides in
   * `applyFluidFeedbackState()` — trail decay among them. That is why `persist: 0.975` is set here rather
   * than leaning on `renderer.decayFactor`: for a style-6 layer the fluid block is what actually governs
   * the trail, and setting only the renderer value would be overridden without trace.
   *
   * `amplify: 4.0` is well above `Fluid Cosmos`'s 2.6 and is the control that turns advection from a
   * shimmer into transport. `fieldDecay: 0.99` makes the velocity field persist, so the fluid has memory
   * and the motion accumulates into visible currents instead of resetting each frame.
   *
   * ⚠️ **`fluidFeedback.dispersion` is left at 0 and the chain-level `transMapDispersion` is used instead.**
   * The nested key is SUPERSEDED and kept only for import compatibility; writing both is how a preset ends
   * up with two disagreeing sources for one effect.
   */
  /*
   * ⚠️ **RENAMED `Fluid Advection Demo` -> `Fluid Feedback Bloom` — v8 Step 21.2, and the BODY IS UNTOUCHED.**
   * The old name was `21.D2`'s defect in its purest form: it named `fluidAdvection`, a subsystem this preset
   * does not carry the block for at all, while what it actually drives is **TransMap style 6, Fluid Feedback**
   * — a different subsystem with a similar name. A census that trusted the name would have recorded advection
   * as covered, and `variant-presets.ts`'s `Hypno Penta II` note records that it nearly did.
   *
   * ⚠️ **This is a correct style-6 demo, so nothing in the body changes** — the name was the whole defect, and
   * `21.5e` commissions the real advection demo separately. Checked against `BUILT_IN_REELS`, which names no
   * preset of either spelling; a NAME is a primary key in five owners, so the check is part of the rename.
   */
  'Fluid Feedback Bloom': {
    metadata: { name: 'Fluid Feedback Bloom', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'style6', 'fluid', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: cosmosWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.9, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 6, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 6,
      // ⚠️ THE LIVE COPY — `main.ts` reads `ov.fluidFeedback`. All five fields are required.
      fluidFeedback: { persist: 0.975, amplify: 4.0, dispersion: 0, fieldDecay: 0.99, glowBoost: 0.5 },
      transMapChain: [
        { style: 6, enabled: true, weight: 1.0 },
      ],
      transMapWarpMix: 1.0,
      transMapDispersion: 0.18,
      speedFactor: 0.35,
    },
  },

  /**
   * **CHAIN 1 — style 0 + style 7.** A field warp feeding density refraction.
   *
   * The pairing is not arbitrary: **style 7 reads the trail's own accumulated alpha**, and style 0 moves
   * where that alpha lands. So the static field continuously reshapes the height field the refraction then
   * reads — a genuine interaction rather than two effects sharing a frame.
   *
   * ⚠️ **`fieldCount` is 2 here, so `uMaxOffset` becomes `MAX_CHAIN_OFFSET_UV = 1.5` instead of the
   * no-clamp sentinel.** That is the concrete cost of chaining two field layers and the reason
   * `Refraction Bloom` deliberately ships ONE. Weights are 0.6/0.8 rather than 1.0/1.0 because the clamp
   * makes a sum of two maxed layers hit the ceiling, where both stop responding to their own sliders.
   *
   * `decayFactor 0.9` is high for a warp demo and required: with a short trail there is no density gradient
   * for style 7 to refract, and the chain degenerates to style 0 alone.
   */
  'Chain Warp Refract': {
    metadata: { name: 'Chain Warp Refract', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'chain', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 14000, waveSpeed: 0.05,
      rotation: [0, 0, 0.1], angle: [0, 0, 0],
      waves: cosmosWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.9, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        { style: 0, enabled: true, weight: 0.6,
          staticField: { pattern: 'Turbulent Weave', strength: 0.7, detail: 1.5, drift: 0.2 } },
        { style: 7, enabled: true, weight: 0.8,
          refraction: { strength: 0.9, reach: 4.0, invert: false, source: 'density' } },
      ],
      transMapWarpMix: 0.9,
      transMapDispersion: 0.2,
      // 0.2, halved from the 0.4 this shipped with — a user call from the 2026-08-21 review pass. It suits the
      // chain: style 7 refracts an ACCUMULATED density field, so the slower the figure moves the more settled
      // the height field it reads, and the refraction reads as a lens rather than as motion. Same reasoning as
      // `Refraction Bloom`'s 0.45, taken further because the style-0 drift is supplying movement of its own.
      speedFactor: 0.2,
    },
  },

  /**
   * **CHAIN 2 — style 5 + style 9.** A flow field, with only its fine detail allowed to move.
   *
   * The complement of `Band Split Crawl`, which splits a STATIC separable field. A flow field's residual is
   * organic and non-repeating where a static lattice's is periodic, so this tests whether Band Split is a
   * general operator or one that only reads a sine lattice — a question no single-style preset can answer.
   *
   * ⚠️ **`fieldCount` is 1, not 2**: style 9 is a `modifier` and is excluded from the count, so the flow
   * layer keeps the no-clamp sentinel and can be driven at weight 1.0. The A/B is the same as
   * `Band Split Crawl`'s — set Band Split to 0 and the whole figure starts travelling with the flow.
   *
   * `radius: 6.0` is half `Band Split Crawl`'s 12. A flow field is smooth at large scales, so a large split
   * radius would put almost all of its energy in the frozen band and leave the operator nothing to move.
   */
  'Chain Flow Split': {
    metadata: { name: 'Chain Flow Split', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'chain', 'band-split', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: pipesWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.88, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: true, transMapStyle: 5,
      proceduralFlow: {
        strength: 0.8, scale: 1.2, curlAmount: 0.75, direction: [0.4, -0.9], radial: 0.2,
        evolutionSpeed: 0.4, archetype: 'Custom',
      },
      transMapChain: [
        { style: 5, enabled: true, weight: 1.0 },
        { style: 9, enabled: true, weight: 1.0, bandSplit: { amount: 1.0, radius: 6.0 } },
      ],
      transMapWarpMix: 0.9,
      transMapDispersion: 0,
      speedFactor: 0.35,
    },
  },

  /**
   * **CHAIN 3 — style 3 + style 4.** A displacement and a colour composite, in two different DOMAINS.
   *
   * ⚠️ **The only chain in the library that crosses domains.** Style 3 contributes a summed displacement;
   * style 4 composites an IFS echo of the frame. They do not sum, do not compete for `uMaxOffset`, and
   * `fieldCount` is 1 — so both run at full strength with no interaction to tune. If the review keeps one
   * chain demo, this is the one that shows something structurally unavailable to a single layer.
   *
   * The echo is fed a frame that is ALREADY warped, so each generation of the self-similar ghost carries a
   * different phase of the drifting field — the echo stops being a static ghost and becomes a history of the
   * warp. That is the claim to judge.
   *
   * ⚠️ **The LAYER ORDER below is load-bearing, not cosmetic.** `echoRunsFirst` compares the echo's index
   * against the first field layer's (`trans-map-chain.ts:456`), so style 3 FIRST means `echoFirst: false` and
   * the pipeline runs warp → echo, which is the whole "echo of a warped frame" claim. Swap the two entries and
   * the same two styles at the same weights produce echo → warp instead: a warp applied to an already-echoed
   * frame, a different image. **Nothing in the type system ties the array order to that behaviour.**
   *
   * `Spiral` (one transform, 15°, scale 0.95) rather than `Kaleidoscope`: the warp is already supplying
   * structural complexity, and a three-fold echo on top of it was unreadable by design intent. `Kaleido
   * Echo` above is where the three-fold case is shown, on an unwarped figure.
   */
  'Chain Zoom Fractal': {
    metadata: { name: 'Chain Zoom Fractal', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'chain', 'ifs', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: miracleWaves(),
      colorBase: [32, 64, 128], colorAmp: [64, 64, 128], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    renderer: { mode: 'star', glow: 2.4, decayFactor: 0.87, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: {
        enabled: true, style: 3, beforeParticles: false,
        sinMagicParams: rippleTable(),
        sinMagicParams2: [[1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]],
        zoomCenter: { x: 50, y: 50 },
        ifsParams: [{ angle: 15, scale: 0.95, tx: 0, ty: 0, weight: 1.0 }],
      },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // `'Plasma'`, not this file's usual `'Legacy Graded'` — a user call from the 2026-08-21 review pass, and
      // the ONE demo here that is graded. ⚠️ **Three things it overrides, none of them obvious from the name:**
      // it sets `glow: 6.0` (so `renderer.glow: 2.4` above is dead on this preset — a film look's `glow` is
      // pushed straight into `renderer.setFilmLook`), `saturation: 2.0` with `gain [1.3, 0.9, 1.4]`, and a
      // **`palette: 'Neon'` mapped by velocity** — which by the standing precedence rule (palette > material
      // ramp > preset colour) means the `colorBase`/`colorAmp` above no longer reach the image either.
      // That suits an echo demo: the IFS ghost is a self-similar copy, so tying hue to VELOCITY gives each
      // generation its own colour instead of a dimmer copy of the same one, and `bloomThreshold: 0.25` lifts
      // the faint outer generations that `'Legacy Graded'` left near black.
      filmLook: 'Plasma',
      transMapEnabled: true, transMapStyle: 3,
      ifsParams: [{ angle: 15, scale: 0.95, tx: 0, ty: 0, weight: 1.0 }],
      transMapChain: [
        { style: 3, enabled: true, weight: 1.0, zoomCenter: { x: 50, y: 50 },
          staticField: {
            pattern: 'Interference', strength: 0.7, detail: 1.0, drift: 0.15,
            pattern2: 'Coarse Swell', strength2: 0.6, zoomBias: 0.1,
          } },
        { style: 4, enabled: true, weight: 0.5,
          ifsParams: [{ angle: 15, scale: 0.95, tx: 0, ty: 0, weight: 1.0 }] },
      ],
      transMapWarpMix: 0.85,
      transMapDispersion: 0,
      speedFactor: 0.4,
    },
  },

  // ==========================================================================================
  // MATERIALS — eight presets, each COMPOSED around its own material.
  //
  // ⚠️ **REWRITTEN 2026-08-21. The previous version of this section was a CONTROLLED COMPARISON SET — one
  // figure (`Cosmos Energy`), 8000 particles, identical renderer, and nothing varying but the material
  // block — and it was REJECTED on review. Do not restore that design.** The reasoning is worth keeping
  // because the mistake is an easy one to make again: a one-variable set optimises for ATTRIBUTION (any
  // difference you see is provably the material) while the brief asked for APPEAL. The ten TransMap demos
  // above succeeded because each one is composed AROUND its feature; these eight refused to compose, and
  // the result was, in the review's words, presets that "use all the same figure and only enable the
  // specific material without an attempt to get the optimal visual effect". Four specific failures were
  // named, and each is answered below by construction rather than by tuning:
  //
  //   * *"what is Plasma actually different from Liquid Light?"* — almost nothing, and it was an ENGINE
  //     fact rather than an authoring one. The two shipped configs shared `colourRamp`, `blendMode`,
  //     `heatMode` AND `velocityStretch`. **Fixed in `material-presets.ts`, not here** — see the
  //     derivation on `Plasma` there. The demos then separate them compositionally on top of that.
  //   * *"genuinely dark or boring presets (fog, smoke)"* — every ramp's t=0 is near-black at alpha 0–40,
  //     so a material whose population sits low on its ramp is NECESSARILY dark. Answered per preset by
  //     raising the population up the ramp, never by editing a ramp (`ICE_POINTS`' dark end is a decided
  //     keep — the crystal pass samples the same ramp from t=0.25).
  //   * *"the ice one in combination with crystal usage is not illustrating the possibilities"* — the old
  //     demo shipped `DEFAULT_CRYSTAL_CONFIG`, which has `growthEnabled: false`, `latticeSnap: 0` and
  //     `symmetryFold: false`. So dendrite arms never emerged and nothing read as a snowflake: the
  //     "override nothing" rule had guaranteed the WEAKEST crystal configuration.
  //   * *"fire doesn't use buoyancy or sparks and limits itself to the base material only"* — correct, and
  //     worse than it sounds. ⚠️ **The 2-pass smoke composite is gated on BUOYANCY**, confirmed at four
  //     sites (`main.ts:357`, `main.ts:1291`, `main.ts:1450` all compute
  //     `buoyancy.enabled ? smokeThreshold : 0`; `hdr-particle.ts:2333`/`2347` select
  //     `uRenderPass = smokeThreshold > 0 ? 1 : 2`). With buoyancy off, `Material Smoke` never entered the
  //     smoke path AT ALL — it was not badly tuned, it was not executing.
  //
  // ⚠️ **Every figure here was chosen by MEASUREMENT, not by eye** — see the FIGURES block above for the
  // probe, its validation against the one figure measurement in the codebase, and the counter-intuitive
  // finding that figure speed does not affect temperature (velocity is normalised twice, so only
  // within-frame CONTRAST survives).
  //
  // ⚠️ **`overlay.material` has no "inherit the default" form** — `main.ts` applies it by assignment, so an
  // ABSENT block lets the live session's material leak in. Every block is therefore written out in full,
  // and where a value differs from the material's own default the deviation is commented. **Re-sync the
  // non-deviating values if a default is ever retuned** — the same standing obligation `Miracle Frost`
  // carries.
  //
  // ⚠️ **Two demos deviate from their material's shipped defaults on purpose, and it was an explicit
  // decision, not drift:** `Smoke` and `Fog` raise `coreBrightness`/`emissionIntensity`/`heatGain` above
  // the table values, because at the defaults they sit on the near-black bottom of the smoke ramp. The
  // review's standing note on this: *"the defaults used should be able to lift it into interesting
  // territory, otherwise it will never be used"* — i.e. **retuning the `Smoke`/`Fog` DEFAULTS is agreed
  // follow-up work, deferred until these presets have been judged in a browser.** Until then the deviation
  // lives here rather than in the table.
  // ==========================================================================================

  /**
   * **Plasma** — *an arc discharge: tight, electric, INSTANTANEOUS.*
   *
   * The concept is the `thermalLag: 0.08` half of the Plasma/LiquidLight pair. Everything here is chosen to
   * read as a point event rather than a flow: the library's hottest compact figure, short trails, a nearly
   * round kernel, and a colour-domain echo instead of a geometric warp.
   *
   * **Figure `Barrock`** — coverage 19/20, median heat 0.77, hot fraction 0.57 at extent 17. With near-zero
   * thermal lag the whole figure crackles as its speed contrast changes.
   *
   * **TransMap style 4 (Fractal Feedback)** is the deliberate choice over a field style: style 4 is the ONE
   * `colour`-domain style in `TRANS_MAP_STYLES`, so it smears brightness WITHOUT displacing geometry. A
   * discharge afterimage, not a distortion. ⚠️ Its `ifsParams` must be written to the OVERLAY — the
   * per-layer `ifsParams` block is serialisation only, and a layer-only tuning renders the module default.
   *
   * ⚠️ **`filmLook: 'Legacy'`, NOT `'Plasma'`.** The named `'Plasma'` look was proposed and rejected on
   * review in favour of showing the material's own colour: it carries `palette: 'Neon'` mapped by velocity,
   * which by the standing precedence rule (palette > material ramp > preset colour) would REPLACE the
   * liquid ramp this preset exists to show — plus `glow: 6.0` and `saturation: 2.0`. The review's direction
   * was *"use here the original color and settings of the Plasma material, if it is suboptimal then let's
   * tune the material itself"*, and that is what happened: the material was retuned in
   * `material-presets.ts` and this preset shows the result ungraded.
   */
  'Material Plasma': {
    metadata: { name: 'Material Plasma', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'material', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 5000, waveSpeed: 0.05,
      rotation: [0, 0, 0.14], angle: [0, 0, 0],
      waves: barrockWaves(),
      colorBase: [32, 64, 128], colorAmp: [64, 64, 128], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    // decayFactor 0.90 — short trails. A discharge must not smear; contrast this with `Material Liquid
    // Light`'s 0.94, which is the same control used for the opposite purpose.
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.90, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 4, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy', speedFactor: 1.0,
      transMapEnabled: true, transMapStyle: 4,
      // ⚠️ THE OVERLAY COPY IS THE ONE THE ENGINE READS (`main.ts` ~1668-1694). A style-4 demo tuned only
      // in a chain layer would silently render the module default — green `verify`, wrong image.
      // Angle 8 / scale 0.97: a shallow spiral, so each echo generation rotates slightly and the discharge
      // leaves a curved afterimage rather than a concentric ring.
      ifsParams: [{ angle: 8, scale: 0.97, tx: 0, ty: 0, weight: 1.0 }],
      transMapWarpMix: 0.55,
      material: {
        // The RETUNED Plasma default, verbatim — `heatGain: 0.60` (ramp window 0.09..0.60, violet through
        // electric blue) and `velocityStretch: 0.25` (nearly round). See `material-presets.ts` for the
        // measurement that set both. No deviation from the table.
        preset: 'Plasma', splatRadius: 9, coreBrightness: 1.9, haloStrength: 0.85, falloffExponent: 3.2,
        thermalLag: 0.08, emissionIntensity: 2.1, heatMode: 'velocity', heatGain: 0.60,
        blendMode: 'additive', colourRamp: 'liquid', velocityStretch: 0.25,
      },
    },
  },

  /**
   * **Fire** — *the full fire STACK: flame body, rising heat, smoke above it, embers in it.*
   *
   * The review named `Lissajous Flame` as the reference that "exposes all aspects of fire nicely", so this
   * preset follows it on the two settings that most decide the look and departs only on the figure:
   *
   *   * ⚠️ **`velocityStretch: 0.4`, from `Lissajous Flame` — NOT 1.0.** This is a SHAPE control (both
   *     shader stages mix the round core/halo kernel toward a tapered velocity-aligned flame kernel), and
   *     the reference deliberately dials it BACK. My first proposal for this preset assumed the flame
   *     shape wanted maximising; the reference disproves that, and at 1.0 every particle becomes a hard
   *     directional streak that reads as fur rather than flame.
   *   * **`thermalLag: 0.04`** — also from the reference, and 3x shorter than the Fire table default of
   *     0.12. Fire's temperature should track velocity nearly instantly; the LAG belongs to `Ember`.
   *   * **`filmLook: 'Legacy'`** — no post-processing, `glow` pinned at 4.0, so the hand-tuned
   *     `coreBrightness`/`emissionIntensity` read exactly as authored. The reference's own note.
   *
   * **Figure `Burn Burn Burn`** (extent 322, z-spread 410) rather than the reference's own compact figure,
   * because buoyancy applies an upward offset per unit temperature and needs vertical room — a small figure
   * just translates upward as a blob.
   *
   * **Buoyancy is `Ember Storm`'s aggressive set**, and it is what makes this a stack rather than a
   * material: `strength: 3.0` lifts hot particles hard, `turbulence: 0.7` with `curlOctaves` breaks the
   * column up, and ⚠️ **`smokeThreshold: 0.25` switches on the 2-pass smoke composite** — cool particles
   * are drawn from the 9-stop `FIRE_SMOKE_POINTS` ramp instead of the fire ramp, so smoke appears above the
   * flame. That composite is reachable ONLY through buoyancy; it is the single largest gain in this rewrite.
   *
   * **Sparks** are `Ember Storm`'s too — 500 slots, a low `threshold: 0.3` so many particles qualify, and
   * `ejectionSpeed: 0.4` with `gravity: 300`: ballistic arcs that fall back through the flame. ⚠️ **0.4, not
   * the 2.0 this line read until 2026-09-17** — the stale-delta fix (`lissajous.ts`' `frameMotion`) multiplied
   * the base an ejection speed scales by ~16× here, so the SAME arc now costs a fifth of the number. The
   * shared value with `Ember Storm` survived the re-base because both were re-fitted by one rule.
   */
  'Material Fire': {
    metadata: { name: 'Material Fire', version: 2, designResolution: { width: 75, height: 60 }, tags: ['demo', 'material', 'fire', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 0, 0.06], angle: [0, 0, 0],
      waves: burnWaves(),
      colorBase: [192, 64, 16], colorAmp: [64, 64, 0], colorFreq: [0.1, 0.2, 0], colorShift: [0.6, 0.5, 0],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.88, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      // `speedFactor` 0.8 -> 0.4 (browser, 2026-08-21).
      renderMode: 'splat', filmLook: 'Legacy', speedFactor: 0.4,
      transMapEnabled: true, transMapStyle: 5,
      // ⚠️ OVERLAY, not the layer — see the header. `Thermal Column` is the archetype whose direction is
      // [0,-1] with radial -0.3, i.e. upward with a slight inward pull, so it REINFORCES the buoyancy
      // rather than fighting it. (`Fire Rise` was the alternative; its radial 0 makes a flatter sheet.)
      proceduralFlow: {
        archetype: 'Thermal Column', strength: 0.6, scale: 1.8, curlAmount: 0.5,
        direction: [0, -1], radial: -0.3, evolutionSpeed: 1.5,
      },
      transMapWarpMix: 0.7,
      material: {
        // ⚠️ Two deviations from the Fire table default, both taken from `Lissajous Flame` rather than
        // invented: `thermalLag` 0.12 -> 0.04 and `velocityStretch` 1.0 -> 0.4. `emissionIntensity` 2.0 is
        // also the reference's. Everything else is the table.
        preset: 'Fire', splatRadius: 10, coreBrightness: 2.0, haloStrength: 1.0, falloffExponent: 3.5,
        thermalLag: 0.04, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 1.0,
        blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.4,
      },
      // `Ember Storm`'s buoyancy, the most aggressive of the five fire presets. `smokeThreshold: 0.25` is
      // the field that switches the 2-pass smoke composite on at all.
      // ⚠️ **Browser-tuned 2026-08-21, and it moved AWAY from `Ember Storm`'s aggressive set on three of the
      // four fields.** `strength` 3.0 -> 1.2, `returnForce` 0.8 -> 2.2, `smokeThreshold` 0.25 -> 0.10.
      //
      // The first two are one change: a weak lift against a strong return pull. `Ember Storm`'s 3.0/0.8 is a
      // storm — particles are thrown far and drift back slowly. A flame is anchored: it licks upward and
      // snaps back, which is 1.2/2.2.
      //
      // `smokeThreshold: 0.10` is the consequential one and it runs OPPOSITE to `Material Ember`'s 0.30.
      // The threshold is the temperature below which a particle takes the SMOKE path, so 0.10 puts almost
      // the whole population on the FLAME path — this preset is fire, and its smoke is a thin cool margin.
      // Ember inverts it deliberately (mostly smouldering smoke, few live coals). Same field, opposite ends,
      // and that contrast is now a real part of what separates the two demos.
      buoyancy: {
        enabled: true, strength: 1.2, returnForce: 2.2, turbulence: 0.7, maxOffset: 300,
        curlOctaves: true, smokeThreshold: 0.10, smokeOpacity: 0.4, smokeDissipation: 0.95,
      },
      sparks: {
        enabled: true, poolSize: 500, threshold: 0.3, ejectionSpeed: 0.4, gravity: 300, drag: 0.8,
        minLifetime: 0.4, maxLifetime: 1.5, coolingRate: 1.5, splatRadius: 4, maxSparksPerFrame: 15,
      },
    },
  },

  /**
   * **Ember** — *a bed of dying coals: sparse, slow, mostly smoke, the occasional spark.*
   *
   * Deliberately the same FAMILY as `Material Fire` read at a different tempo, which is what a demo of
   * `Ember` versus `Fire` should be — both are the `fire` ramp additive, and the material's own separation
   * from Fire is `thermalLag` 0.45 vs 0.04 (11x) plus `falloffExponent` 5.0 vs 3.5 and `emissionIntensity`
   * 3.4 vs 1.8. So: tiny, intensely bright points whose heat TRAILS their motion.
   *
   * **Figure `Miracle`** — median heat 0.84 and hot fraction 0.65, **the hottest-running figure in the
   * library**, at a compact extent 22. With `falloffExponent 5.0` each particle is a hard bright point, and
   * a hot compact figure of them reads as a coal bed rather than as a flame.
   *
   * **Two inversions of Fire's bundle**, and they are the design:
   *   * `smokeThreshold: 0.30` is HIGHER than Fire's 0.25, so a LARGER share of the population falls below
   *     it and takes the smoke path. Embers smoulder — most of what you see should be smoke.
   *   * sparks are `Hopf Fire Ring`'s sparse set: `threshold: 0.7` (few particles qualify), 4 per frame
   *     against Fire's 15, `coolingRate: 4.0` so each fades fast. Occasional single embers popping, not a
   *     fountain.
   *
   * `particleCount: 3000` is the lowest in this group, and intentionally so: sparseness IS the coal-bed
   * read, and `emissionIntensity 3.4` survives it because the additive overlap compensation LIFTS sparse
   * scenes (clamped at 1.5x) rather than damping them.
   */
  'Material Ember': {
    metadata: { name: 'Material Ember', version: 2, designResolution: { width: 80, height: 80 }, tags: ['demo', 'material', 'fire', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 3000, waveSpeed: 0.05,
      rotation: [0, 0, 0.04], angle: [0, 0, 0],
      waves: miracleWaves(),
      colorBase: [192, 96, 32], colorAmp: [64, 48, 16], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.85, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      // Style 0 at low amplitude — a slow lateral drift standing in for heat haze. Chosen over a flow
      // archetype because the coals themselves should look nearly STILL; a flow field would animate them.
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy', speedFactor: 0.35,
      transMapEnabled: true, transMapStyle: 0,
      // ⚠️ `staticField` is PER-LAYER — there is no `overlay.staticField`. A one-layer chain is the only
      // spelling it has (`types.ts:701`), which is why this preset carries a `transMapChain` while the
      // style-4/5/6 demos in this group do not: those three DO have overlay-level blocks.
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Coarse Swell', strength: 0.35, detail: 1.0, drift: 0.05 } },
      ],
      transMapWarpMix: 0.5,
      material: {
        // The Ember table default, verbatim. `velocityStretch` 1.0 is kept here (unlike Fire's 0.4) because
        // at `falloffExponent 5.0` the kernel is so tight that the flame taper reads as a spark trail
        // rather than as fur — the two controls interact, which is why the same value is right here and
        // wrong there.
        preset: 'Ember', splatRadius: 7, coreBrightness: 2.2, haloStrength: 0.6, falloffExponent: 5.0,
        thermalLag: 0.45, emissionIntensity: 3.4, heatMode: 'velocity', heatGain: 0.7,
        blendMode: 'additive', colourRamp: 'fire', velocityStretch: 1.0,
      },
      // Gentle: `strength` 1.2 against Fire's 3.0, and `returnForce` 2.0 against 0.8 — so a particle is
      // lifted a little and pulled back quickly. Coals shimmer; they do not plume.
      buoyancy: {
        enabled: true, strength: 1.2, returnForce: 2.0, turbulence: 0.5, maxOffset: 140,
        curlOctaves: true, smokeThreshold: 0.30, smokeOpacity: 0.45, smokeDissipation: 0.96,
      },
      // `Hopf Fire Ring`'s sparse set — ⚠️ **no longer verbatim, and the divergence is the interesting part.**
      // 2026-09-17 re-fitted both against the real per-frame motion and they went OPPOSITE ways: Hopf to the
      // 0.1 FLOOR, this one to the 3.0 CEILING. `Ember`'s figure barely moves (median 0.79 px/frame against
      // Hopf's 110), so a velocity INHERITED from the particle is nearly nothing here — at the slider's max
      // the embers still birth at ~71 px/s against a 75 px/s terminal fall. **The coals are gravity-driven by
      // arithmetic, not by taste, and no `ejectionSpeed` on the track can change that.** Do not "restore" the
      // shared value: one number over two figures of different speeds is what the old defect made look sane.
      // ⚠️ **AND 3.0 SURVIVES A PRESET LOAD BUT NOT A DROPDOWN PICK.** `Ember`'s own `presentation.physics`
      // bundle carries `ejectionSpeed: 0.1` (its template is `Hopf Fire Ring`) and a `presentation` block
      // applies FROM THE DROPDOWN HANDLER ONLY — so re-selecting `Ember` in the Materials tab replaces this
      // 3.0 with 0.1 and the coals stop ejecting. Pre-existing behaviour of that bundle, newly VISIBLE here
      // because this is the first preset whose spark speed diverges from its own material's.
      sparks: {
        enabled: true, poolSize: 300, threshold: 0.7, ejectionSpeed: 3.0, gravity: 150, drag: 2.0,
        minLifetime: 0.2, maxLifetime: 0.6, coolingRate: 4.0, splatRadius: 2, maxSparksPerFrame: 4,
      },
    },
  },

  /**
   * **Smoke** — *a billowing volume, and the demo whose old version was not merely dull but INERT.*
   *
   * ⚠️ **The fix is `buoyancy.enabled: true`, and it is structural rather than cosmetic.** Confirmed at
   * four sites (see the section header), the splat renderer selects `uRenderPass = smokeThreshold > 0 ? 1 :
   * 2` and `smokeThreshold` is forced to 0 unless buoyancy is enabled. The previous demo therefore never
   * ran the 2-pass smoke composite and never sampled the 9-stop `FIRE_SMOKE_POINTS` ramp at all: it was
   * showing the smoke KERNEL over the plain smoke ramp, which is the greyscale flat look that was reported.
   *
   * **The buoyancy here is tuned for smoke, not borrowed from a fire preset:**
   *   * `smokeThreshold: 0.42` — far above Fire's 0.25, so MOST of the population takes the smoke path.
   *     This is the field that decides whether you are looking at smoke or at a fire that makes some.
   *   * `smokeDissipation: 0.985` — the top of its 0.9–1.0 range, so smoke LINGERS and accumulates.
   *   * `smokeOpacity: 0.75` — nearly double the fire presets' 0.4, because here the smoke is the subject.
   *   * `turbulence: 0.85` with `curlOctaves: true` — the 3-octave simplex curl is what makes it billow;
   *     `strength: 1.8` is a drift rather than a column.
   *   * **No sparks.** Sparks in smoke read as noise, and nothing in the concept wants them.
   *
   * **Figure `Inside Nebula`** — extent 328 with arc coherence 4.72, i.e. deliberately scattered, which
   * suits a 16 px soft kernel filling a volume.
   *
   * ⚠️ **Deviates from the Smoke table default on three fields** — see the section header's note on this
   * being an agreed, deferred follow-up rather than drift.
   */
  'Material Smoke': {
    metadata: { name: 'Material Smoke', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'material', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.05,
      rotation: [0, 0, 0.05], angle: [0, 0, 0],
      waves: nebulaWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.2, 0.1, 0.3], colorShift: [0.6, 0.2, 0.4],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.93, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Luminous', speedFactor: 0.5,
      transMapEnabled: true, transMapStyle: 5,
      // ⚠️ OVERLAY, not the layer. `Smoke Drift` is the archetype named for exactly this: a slow
      // up-and-slightly-right direction [0.3,-0.95] at a large scale 2.0 with high curl 0.6.
      proceduralFlow: {
        archetype: 'Smoke Drift', strength: 0.25, scale: 2.0, curlAmount: 0.6,
        direction: [0.3, -0.95], radial: 0, evolutionSpeed: 0.5,
      },
      transMapWarpMix: 0.65,
      material: {
        // ✅ **NO DEVIATIONS — the Smoke table default, verbatim (2026-08-23).** This block previously
        // carried three anti-darkness overrides (`coreBrightness` 1.15, `emissionIntensity` 1.9,
        // `heatGain` 1.30) and **the retune moved them into `material-presets.ts` where they belong**,
        // which was the agreed follow-up: *"the defaults used should be able to lift it into interesting
        // territory, otherwise it will never be used"*.
        //
        // ⚠️ **`heatGain` is 1.15 here, not the 1.30 this preset used to carry, and that is deliberate —
        // it is a DEFAULT now.** At 1.30 the measured pinning (population stuck at ramp t=1.0, no
        // contrast against neighbours) is 7.8% on this figure but **24.7% on a uniform speed
        // distribution**, and `normalized` is min-max normalised so the shape is figure-dependent. A demo
        // may sit closer to an edge than a default because it knows its figure; a default is applied to
        // whatever the user has loaded. 1.15 keeps pinning under 5% while still moving 17 points of
        // population out of the dark pass. The derivation, the pass-0 measurement and the rejected 1.30
        // row are on the `Smoke` entry in `material-presets.ts` — read them before changing either site.
        //
        // ✅ **BROWSER-CONFIRMED AND CLOSED 2026-08-23** — *"Material Fog, Material Smoke and the new
        // material dropdown settings are fine"*. Do not re-tune.
        //
        // ⚠️ **Re-sync this block if the Smoke default is ever retuned again.** It is written out in full
        // because `overlay.material` has no "inherit the default" form — `main.ts` applies it by
        // assignment, so an ABSENT block lets the live session's material leak in. That is the standing
        // obligation every material demo carries, and it is now load-bearing here rather than nominal.
        preset: 'Smoke', splatRadius: 16, coreBrightness: 1.0, haloStrength: 1.5, falloffExponent: 1.5,
        thermalLag: 0.55, emissionIntensity: 1.8, heatMode: 'velocity', heatGain: 1.15,
        blendMode: 'alpha', colourRamp: 'smoke', velocityStretch: 0.5,
      },
      buoyancy: {
        enabled: true, strength: 1.8, returnForce: 1.2, turbulence: 0.85, maxOffset: 280,
        curlOctaves: true, smokeThreshold: 0.42, smokeOpacity: 0.75, smokeDissipation: 0.985,
      },
    },
  },

  /**
   * **Fog** — *a luminous bank of mist, lit unevenly, turning slowly through its own light.*
   *
   * ⚠️ **`heatMode: 'position'` and the driver reads SCREEN PIXELS, not model units.** `material.update()`
   * is called at `lissajous.ts:1043`, AFTER the projection block, so the driver is
   * `(sin(px*0.003)*0.5+0.5) * (cos(py*0.004)*0.5+0.5)` on projected pixel coordinates. Periods are
   * 2094 px in X and 1571 px in Y — about HALF a cycle across a 1024x768 canvas. Three consequences, and
   * every choice in this preset follows from them:
   *
   *   1. **Figure EXTENT is Fog's contrast control.** A small figure occupies one small patch of that
   *      standing field and every particle in it gets nearly the same temperature — one flat grey. Measured
   *      heat span against model half-extent (at `waveScale` 7.68):
   *
   *          ext  17 -> 0.434     ext  32 -> 0.718     ext  60 -> 0.850
   *          ext  22 -> 0.544     ext  45 -> 0.837     ext  75 -> 0.850
   *
   *      It saturates around extent 60, so anything past that is free.
   *   2. **`waveSpeed`/`speedFactor` cannot change the colour at all** — the field is a function of position
   *      only. Fog is the one material where pacing is purely pacing.
   *   3. **ROTATION is the only thing that can ANIMATE the colour**, by carrying particles through the fixed
   *      field. Hence `rotation: [0.05, 0.12, 0.03]` — non-zero on all three axes, which no previous demo in
   *      this group had. The old version's `[0, 0, 0.1]` spun the figure in its own plane, which moves
   *      particles through the field far less than a tumble does.
   *
   * **Figure `Dancing Elphes`** — extent **423, the largest in the library**, with z-spread 486. Deep into
   * the saturated region, so the full 0.85 heat span is available and the mist is lit from bright to dark
   * across the frame. This is the single most consequential choice for Fog.
   *
   * **Style 6 — Fluid Feedback at a low blend.** The image advects along a velocity field accumulated from
   * the particles themselves, which is what mist does: it carries. Low `amplify` and a high `fieldDecay`
   * keep it a slow drift rather than a smear. ⚠️ Style 6 derives three global overrides in
   * `applyFluidFeedbackState()` (trail persistence among them) — those are not re-stated here, per the rule
   * against an assign-on-entry site.
   *
   * ⚠️ **Deviates from the Fog table default on two fields** — see the section header's note on the agreed,
   * deferred defaults follow-up.
   */
  'Material Fog': {
    metadata: { name: 'Material Fog', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'material', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      // ⚠️ All three axes, and this is the ONLY animator Fog's position-driven colour has. See the doc block.
      rotation: [0.05, 0.12, 0.03], angle: [0, 0, 0],
      waves: elphesWaves(),
      colorBase: [128, 132, 140], colorAmp: [96, 96, 112], colorFreq: [0.1, 0.15, 0.2], colorShift: [0.3, 0.5, 0.7],
    },
    // 0.96 is the highest accumulation in this group: a wide 24 px kernel at low opacity needs the trail to
    // build the VOLUME. Fog is the one material where smear is the subject rather than the risk.
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.96, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 6, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Luminous', speedFactor: 0.3,
      transMapEnabled: true, transMapStyle: 6,
      // ⚠️ OVERLAY, not the layer — `main.ts` reads `overlay.fluidFeedback`; a layer-only copy renders the
      // DEFAULT and passes `verify` green.
      // `amplify: 1.4` is near the bottom of its 1-10 range and `fieldDecay: 0.992` near the top of
      // 0.95-0.999: a weak field that persists a long time, i.e. a slow coherent drift.
      // `dispersion: 0` — superseded by `overlay.transMapDispersion`; written as 0 so nothing chromatic
      // leaks in, and NOT used as the dispersion control.
      fluidFeedback: { persist: 0.97, amplify: 1.4, dispersion: 0, fieldDecay: 0.992, glowBoost: 0.35 },
      transMapWarpMix: 0.45,
      material: {
        // ✅ **NO DEVIATIONS — the Fog table default, verbatim (2026-08-23).** The two anti-darkness
        // overrides this block carried (`emissionIntensity` 1.0, `coreBrightness` 0.9) **moved into
        // `material-presets.ts`**, and the defaults now go slightly past them (1.1 / 0.95) because a
        // default has no accompanying `filmLook: 'Luminous'` to help it — this preset does, so it inherits
        // a marginally stronger material and lands in the same place.
        //
        // `heatGain` remains 0.85 at BOTH sites, and the reasoning moved to the table with it: position
        // mode's driver is a PRODUCT of two half-cosines (mean 0.25), a fixed function of screen position,
        // so raising the gain saturates the field's peaks into flat patches instead of lifting its
        // troughs — and the smooth spatial gradient is what distinguishes Fog from Smoke. Fog is also NOT
        // on `FIRE_BEHAVIOUR_MATERIALS`, so unlike Smoke it has no 2-pass composite and no unreachable
        // pass-0 population; every brightness control reaches every particle. Measured 5.5x median lift
        // with zero pinning risk — the derivation is on the `Fog` entry in `material-presets.ts`.
        //
        // ✅ **BROWSER-CONFIRMED AND CLOSED 2026-08-23** (demo + Lab dropdown). Do not re-tune.
        //
        // ⚠️ **Re-sync this block if the Fog default is ever retuned again** — `overlay.material` has no
        // "inherit the default" form, so it must be written out in full.
        preset: 'Fog', splatRadius: 24, coreBrightness: 0.95, haloStrength: 1.8, falloffExponent: 1.0,
        thermalLag: 1.0, emissionIntensity: 1.1, heatMode: 'position', heatGain: 0.85,
        blendMode: 'alpha', colourRamp: 'smoke', velocityStretch: 0.3,
      },
    },
  },

  /**
   * **Ice** — *a snowflake lattice forming on a frost bed*, and the demo whose old version showed the
   * crystal pass with its two most characteristic features switched off.
   *
   * **Why the old one failed, mechanically.** It shipped `DEFAULT_CRYSTAL_CONFIG` verbatim on the principle
   * that a material demo should show the unmodified default. But three of those defaults are `false`/`0`
   * precisely because they are opt-in *looks* rather than baseline behaviour:
   *
   *     growthEnabled  false -> true    dendrite ARMS only emerge by accretion; at false a 'dendrite'
   *                                     appears at full size and never branches
   *     latticeSnap    0     -> 0.6     deposits land on a hex lattice, giving crisp angular joints
   *     symmetryFold   false -> true    each deposit is mirrored into all 6 sectors, so arms grow
   *                                     IDENTICALLY — this is what the eye reads as a snow crystal
   *
   * With all three off, nothing in the frame reads as a snowflake, which is what "not illustrating the
   * possibilities well" was pointing at. `latticeSnap` + `symmetryFold` are the Phase 8b.1 pair documented as
   * *"the step that turns fuzzy dendrites into recognisable SNOWFLAKES"*; using them is the whole point here.
   *
   * ---
   *
   * ## ⚠️ REDESIGNED 2026-08-21, on the browser verdict *"nice crystal growing effect, but otherwise too
   * close to Miracle Frost … currently focuses almost exclusively on crystals, should also use the main
   * figure and its color effects more effectively"*
   *
   * **The previous version's differentiation was on the wrong axis, and that is a diagnosis, not a
   * concession.** It kept `Miracle Frost`'s figure AND its style-3 tables on the argument that the pairing
   * was user-validated, and differentiated purely inside the crystal block (`latticeSnap`, `symmetryFold`,
   * pool size, lifetime). So *everything* that distinguished the two presets lived in the one subsystem the
   * verdict says the preset over-focuses on. Both halves of the report have the same single cause.
   *
   * Three changes, in the order of how much they move:
   *
   * **1. A different figure — `Water Ice Crystal`, not `Miracle`.** See `waterIceWaves()` for the derivation:
   * a planar 3-fold concentric form instead of an open 1:2 + 3:4 braid, with a silent Z axis on all three
   * waves so the crystal pass's back-to-front alpha occlusion does not bury the lattice in its own depth.
   *
   * **2. A different warp — style 1 (Wave Zoom) on a `Grid Lattice` archetype, not style 3 on `Miracle`'s
   * tables.** ⚠️ **Style 3 is `Miracle Frost`'s single largest contributor** (its own comment says so), so
   * reusing it with the same tables reproduces most of that preset's character regardless of what else
   * changes. Style 1 is a different operator on the same summed field: it scales UV about `zoomCenter`
   * instead of shifting, so structure moves radially — the figure appears to breathe against the frozen
   * lattice rather than to slide. `Grid Lattice` at `detail 1.0` puts the field's cell period at ~128 px,
   * roughly TEN TIMES `crystalSize`, so the warp carries the whole frost bed as one slow structural swell
   * beneath the lattice. ⚠️ **It was `Fine Mesh` at `detail 6.0` until 2026-08-23, on the reasoning that
   * matching the field's cells to the crystal spacing would read as the ice's own faceting. It did not: at
   * that setting the field FOLDED (`A/P = 3.23` against a `1/(2π)` limit) and quantised the frame into 8 px
   * blocks the size of the crystals. See the note on `transMapChain` for the derivation and the bound.**
   * ⚠️ The `transMapChain` is required, not decorative: **there is no `overlay.staticField`** — a
   * `StaticFieldConfig` exists only on a `TransMapLayer` (`types.ts:701`), so a one-layer chain is the only
   * spelling a styles-0-3 archetype has. Same reason `Material Ember` carries one.
   *
   * **3. The figure's own colour is now VISIBLE, via `filmLook: 'Customize'` + palette mapping 1 (`phase`).**
   * This is the half of the report that is a mechanism question rather than a taste question, because with a
   * material active the answer is normally *it cannot be*: precedence is **palette > material ramp > preset
   * colour**, and `colourRamp: 'ice'` is indexed by TEMPERATURE, so `colorBase`/`colorAmp`/`colorFreq` are
   * simply discarded. Mapping 1 is the one route back — `hdr-particle.ts:727` computes
   * `palCoord = dot(vSplatColor, vec3(0.2126, 0.7152, 0.0722))`, and `vSplatColor` IS the preset's own
   * oscillating colour (`aColorSplat`, uploaded unconditionally at `:2208`). So the figure's colour
   * oscillation becomes the coordinate into a palette, and the material keeps the physics.
   *
   * ⚠️ **Mapping 1 is a LUMINANCE, so the colour fields have to be authored for their luminance SPAN, not
   * their hue** — a hue rotation at constant luminance is invisible to it. Measured over 720 samples of the
   * legacy formula (`colorBase + sin(n·colorFreq/DEG + pos·colorShift) · colorAmp`):
   *
   *     Water Ice Crystal's own [128,128,255] / amp [64,64,0] / freq [0.1,0.1,0]  ->  span 0.08 .. 0.14
   *     this preset's           [150,165,210] / amp [80,70,55] / freq [3,3.5,2.5] ->  span 0.53 .. 0.55
   *
   * The legacy colour is nearly a constant to this mapping — a 0.08 span selects one palette entry and the
   * control would be inert (invariant 13). Raising `colorFreq` from 0.1 to ~3 is what does the work: `n` runs
   * `i · 360/count` over the population, so frequency 3 puts several complete luminance cycles AROUND the
   * curve, giving concentric colour BANDS. `colorShift` then advances their phase with `pos`, so the bands
   * travel along the figure. Measured window is **0.37 .. 0.92**, stable to ±0.03 across `pos` 0/15/45/90.
   *
   * **Palette `Classic: galaxy`, and it was chosen by measuring that window, not by name.** Over t=0.37..0.92
   * galaxy runs violet (295°, L 0.15) → magenta (307°, 0.20) → indigo (256°, 0.37) → cyan (197°, 0.54) →
   * pale ice-blue (189°, 0.79). That is an aurora over ice: it ENDS in the same blue-white the crystal pass
   * paints (`crystalRamp: 'ice'` is untouched), so the two channels share a top note while the figure alone
   * carries the violets. ⚠️ **`Cool` and `ice` were both rejected on the measurement**: cosine `Cool` inverts
   * mid-window (252°, L 0.02 — a dead black band at exactly the median), and `Classic: ice` runs
   * monotonically DARK with t (0.93 → 0.18), so the figure's brightest particles would render nearly black.
   * `Classic: ` is the required prefix — an unprefixed `galaxy` has no cosine collision, but the prefix is
   * what makes the route explicit (`palettes.ts` checks cosine first, case-insensitively).
   *
   * ⚠️ **`filmLook: 'Customize'` REQUIRES `customFilmLookParams` to be carried**, or the preset inherits
   * whatever the live session had. The block below is `Legacy` verbatim except `palette`/`paletteMapping` —
   * so `glow: 4.0` keeps the sprite geometry identical, and **bloom and the tone map stay OFF**, which is
   * Ice's standing reason for `Legacy`: bloom dissolves the crystal facet edges the preset exists to show.
   * A named look was not usable: only `Legacy`, `Legacy Graded` and `Cinematic` are `palette: 'none'`, all
   * three of which discard the figure colour, and `Glacier` — the obvious ice candidate — maps `depth`, not
   * phase, and turns bloom on.
   *
   * **4. The crystal block keeps what the verdict praised** (*"nice crystal growing effect"*) and is only
   * REBALANCED to stop being the whole picture: `poolSize` 900 → 520 and `crystalSize` 16 → 13, so the
   * lattice punctuates the coloured figure instead of covering it. `growthEnabled` / `latticeSnap: 0.6` /
   * `symmetryFold: true` — the three defaults whose being off caused the ORIGINAL complaint — are untouched.
   *
   * **Differentiation from `Miracle Frost`, restated on the axes that now differ:**
   *
   *                        Miracle Frost         Material Ice
   *     figure             Miracle               Water Ice Crystal   different curve family
   *     warp               style 3, Miracle's    style 1, Grid Latt. zoom-breathe vs. combined shift+zoom
   *     figure colour      discarded (no palette) galaxy via phase   the figure carries its own colour
   *     neon lines         ON (part of its look) off                 see the branch note below
   *     latticeSnap        0                     0.6                 organic vs. formal
   *     symmetryFold       false                 true                lumpy arms vs. 6-fold symmetry
   *     shape/size         dendrite 22           dendrite 13         subordinate to the figure
   *     poolSize           600                   520
   *     crystalLifetime    8 s                   5 s                 forming is visible, not just formed
   *
   * ⚠️ **The 2026-08-23 browser verdict was "strong pixelation, the crystals look more like pixels", and the
   * cause was the WARP FIELD FOLDING, not the crystal block.** `Fine Mesh` at `detail 6.0` put the field's
   * cell period at 8 px while its peak displacement was 25.8 px — `A/P = 3.23` against an injectivity limit
   * of `1/(2π) = 0.159`, i.e. **20x over**. A many-to-one warp resamples one texel across a run of pixels, so
   * the output quantises into flat cells; at an 8 px pitch against `crystalSize` 13 those cells were the same
   * visual scale as the crystals and read as their pixels. Now `Grid Lattice`, `detail 1.0`, `strength 0.28`,
   * `warpMix 0.75` — `A/P = 0.101`, inside the bound with ~1.6x headroom. **The derivation and the re-check
   * formula are on the `transMapChain` field itself; read them before touching `detail`, `strength` or
   * `warpMix`, which multiply into one ratio.** ⚠️ The original comment claimed matching the field cell size to
   * the crystal spacing would make the warp read as "the ice's own faceting" — that premise was exactly
   * inverted: a field whose cells match the geometry's scale COMPETES with it. Carry structure at ~10x the
   * feature size.
   *
   * **5. The EMERGENT EMISSION, emphasised 2026-08-23.** The follow-up browser verdict was that the fixed warp
   * gave the crystals *"kind of a light emitting effect"* and asked for slightly more of it. That effect is not
   * any glow control — `renderCrystalOnly()` runs BEFORE the render branch (`main.ts:1899`), so crystal pixels
   * are warped by the style-1 zoom and re-integrated at `decayFactor 0.9876`, smearing each crystal's rim
   * radially into the trail. **So it has two independent halves and both were nudged:** `edgeBrightness`
   * 1.4 → 1.55 with `internalRefraction` 0.35 → 0.46 (the halo's BRIGHTNESS, +11% area-integrated premultiplied
   * luminance with nothing pushed into saturation) and `warpMix` 0.65 → 0.75 (its REACH). ⚠️ **Three levers that
   * look right are all inert or wrong here — `emissionIntensity` cannot reach the crystal branch,
   * TransMap's glow term is fluid-field-only, and bloom is off by design.** The derivations, the measurements
   * and the rejected `edgeBrightness 2.2` row are on the `crystal` and `transMapWarpMix` fields.
   *
   * ⚠️ **`clusterForce` stays 0.** It is the only crystal control that deforms the LISSAJOUS FIGURE, and
   * `Miracle Frost`'s own history records a radius of 80 against a ~60-unit figure making every crystal a
   * global force and shredding the curve — after three wrong diagnoses. Not a knob for a material demo.
   */
  'Material Ice': {
    // 80x60 is `Water Ice Crystal`'s own legacy design box. ⚠️ NOT 100x100 (which the previous version
    // carried, for `Miracle`): the uniform canvas fit is `min(w/designW, h/designH)`, so the box is what the
    // figure's amplitudes are expressed in and a wrong one rescales the whole figure.
    metadata: { name: 'Material Ice', version: 2, designResolution: { width: 80, height: 60 }, tags: ['demo', 'material', 'crystal', 'review'] },
    generators: {
      // 20000 -> 12000. The old count was `Miracle Frost`'s, needed there for a neon line density this
      // preset does not use; here it is the coloured BANDS that must stay legible, and above ~15000 on this
      // compact planar figure consecutive bands overlap into a single wash.
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      // Z-only tumble at the legacy value (`Water Ice Crystal` ships `Rotation: [0,0,1]`), slowed to 0.35.
      // Rotation is applied as `angle += rotation * dt/1000` in DEGREES, so 0.35 is ~21°/minute — a drift.
      // It matters more here than on the other demos: crystals store a MODEL-space position and rotate WITH
      // the figure, so a visible tumble is what shows the lattice is attached to the ice rather than painted
      // on the frame.
      rotation: [0, 0, 0.35], angle: [0, 0, 0],
      waves: waterIceWaves(),
      // ⚠️ AUTHORED FOR PALETTE MAPPING 1, which is a LUMINANCE — see the doc block for the measurement.
      // `colorFreq` ~3 (not the legacy 0.1) is what puts several luminance cycles around the curve, giving
      // concentric colour bands; `colorShift` travels them. Measured window 0.37..0.92, stable across `pos`.
      // The base is a pale ice blue so that even the darkest band lands in galaxy's violet rather than black.
      colorBase: [150, 165, 210], colorAmp: [80, 70, 55], colorFreq: [3, 3.5, 2.5], colorShift: [0.6, 0.45, 0.3],
    },
    // `Water Ice Crystal`'s own MotionBlur 8 -> `decayFactor = 8/8.1`. The accumulation is what turns the
    // three harmonic shells into continuous coloured bands; the crystal pass draws on top and is unaffected.
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.9876543209876544, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      // Style 1 (Wave Zoom) with the legacy reader's fallback table. ⚠️ Deliberately NOT style 3 with
      // `Miracle`'s tables — that pairing is `Miracle Frost`'s single largest contributor and reusing it is
      // what made the old version read as the same preset. The engine takes the archetype branch below and
      // never reads this table; it is here so a single-style reader still produces a warp of the right kind.
      transMap: {
        enabled: true, style: 1, beforeParticles: false,
        sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(),
        zoomCenter: { x: 50, y: 50 },
      },
      ...inertGrading(),
    },
    overlay: {
      // ⚠️ `Customize` seeded from `Legacy`, so `customFilmLookParams` MUST be carried or the preset inherits
      // the live session's look. Every field below is `Legacy` verbatim EXCEPT the last two: `glow: 4.0` keeps
      // the sprite geometry byte-identical, and **bloom + tone map stay off**, which is Ice's standing reason
      // for `Legacy` — bloom on hard faceted alpha geometry blooms the FACET EDGES and dissolves exactly the
      // hard-edged read the crystal output channel exists to provide.
      //
      // `palette` + `paletteMapping: 'phase'` are the two fields that exist for this preset: they route the
      // figure's own `colorBase`/`colorAmp`/`colorFreq` into the splat pass, which a material otherwise
      // discards entirely (precedence is palette > material ramp > preset colour). See the doc block for why
      // `Classic: galaxy` and not `Cool`/`Classic: ice`, both of which were rejected on measurement.
      renderMode: 'splat', filmLook: 'Customize',
      customFilmLookParams: {
        glow: 4, depthSize: 0, depthBrightness: 0, depthDof: 0, depthColorShift: 0,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: false, bloomThreshold: 0.8, bloomIntensity: 0.0,
        toneMapEnabled: false, toneMapCurve: 'none', exposure: 1.0,
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.0, vignette: 0.0,
        palette: 'Classic: galaxy', paletteMapping: 'phase',
      },
      speedFactor: 0.6,
      // ⚠️ **`linesEnabled` is deliberately ABSENT (i.e. false), and this is a CORRECTION of a value copied
      // from `Miracle Frost`, not a stylistic difference.**
      //
      // `main.ts:944` is a three-way exclusive branch: `if (linesEnabled) {neon + sparks} else if
      // (ribbonState !== 'off') {ribbons} else {renderer.render(state, target)}`. The SPLAT material pass is
      // only reached by that final `else`. So `linesEnabled: true` does not add lines *on top of* the
      // material — it REPLACES it, and neon has no ramp support at all (`TrajectoryPalette` covers palettes
      // only; the material ramp lives in `hdr-particle.ts`).
      //
      // This preset's stated design is a soft alpha frost bed UNDER the hard faceted crystal pass. With
      // lines on, the frost bed would not be drawn at any point and the claim would be false while
      // `verify` stayed green — invariant 13's shape, found by tracing the branch rather than by looking.
      // (Crystals are unaffected either way: `renderCrystalOnly()` runs at main.ts:942, BEFORE the branch,
      // precisely so they survive all three paths.)
      transMapEnabled: true, transMapStyle: 1,
      // ⚠️ REQUIRED, not decorative: `staticField` is PER-LAYER (`types.ts:701`) and **there is no
      // `overlay.staticField`**, so a one-layer chain is the only spelling a styles-0-3 archetype has. Same
      // reason `Material Ember` carries one.
      //
      // ⚠️ **`Fine Mesh` at `detail 6.0, strength 0.42` was a FOLDING field and it is why the 2026-08-23
      // browser verdict read "strong pixelation... the crystals look more like pixels". This is a DERIVED
      // bound, not a taste adjustment.** A sinusoidal displacement `d(x) = A·sin(2πx/P)` applied as
      // `x -> x + d(x)` is injective only while `|d'|max < 1`, i.e.
      //
      //     A / P  <  1 / (2π)  =  0.159
      //
      // Above that the map is many-to-one: several source texels land on one destination, the inverse warp
      // samples the SAME texel across a whole run of pixels, and the output quantises into flat cells. That
      // is the "pixelation" — it is aliasing, not a filter setting, so no amount of blur removes it.
      //
      // The old numbers, measured at 877x768 (`STATIC_FIELD_TARGET_FRACTION` 0.08 of `min(w,h)`):
      //
      //     effective frequency  = 16 (Fine Mesh) x 6.0 (detail)   = 96 cycles/axis
      //     cell period P        = 768 / 96                        = 8.0 px
      //     peak displacement A  = 0.42 x 0.08 x 768               = 25.8 px
      //     A / P                = 3.23                            = 20x OVER the fold limit
      //
      // A 25.8 px displacement across an 8 px cell cannot be anything but blocks, and the block pitch (8 px)
      // landed just under `crystalSize` 13 — so the quantisation cells were the same visual size as the
      // crystals and read as their pixels. **The original comment's premise was the exact inversion of the
      // truth: matching the field's cell size to the crystal spacing is what destroyed the crystals, because
      // the field's own cells then compete with the geometry at the same scale instead of carrying it.**
      //
      // `Grid Lattice` at `detail 1.0, strength 0.28` gives P = 128 px, A = 17.2 px, **A/P = 0.134 — inside
      // the bound with ~16% headroom**. The 6/4 frequency pair keeps a lattice CHARACTER (which is why the
      // pattern changed rather than just the detail), but at a cell pitch ~10x the crystal size, so the warp
      // now moves the whole frost bed as a slow structural swell UNDER the crystals rather than dicing it.
      //
      // ⚠️ **Do not raise `detail` or `strength` here independently — they multiply into one ratio.** Any
      // future edit must re-check `strength · 0.08 · min(w,h) · baseFreq · detail / min(w,h) < 0.159`, which
      // reduces to `strength · detail · baseFreq < 1.99`. Current: 0.28 x 1.0 x 6 = 1.68. ✓
      //
      // `drift 0.03` is unchanged: drift is normalised to CELLS per second (`static-field.ts`), so it means
      // the same apparent speed after the pattern change, and the intended motion is still the figure
      // breathing through the zoom rather than the field sliding.
      transMapChain: [
        { style: 1, enabled: true, weight: 1.0,
          staticField: { pattern: 'Grid Lattice', strength: 0.28, detail: 1.0, drift: 0.03 } },
      ],
      // 0.8 -> 0.65 (2026-08-23, the fold fix) -> 0.75 (2026-08-23, the emission nudge). `warpMix` scales the
      // summed offset, so it is a FOURTH factor on the fold ratio the bound above does not include (it is
      // applied in the shader, after the field is solved, so it is not in the `strength · detail · baseFreq`
      // product). Measured against the `1/(2π) = 0.159` limit:
      //
      //     warpMix 0.65  ->  A/P 0.087   headroom x1.82
      //     warpMix 0.75  ->  A/P 0.101   headroom x1.58   <- here
      //     warpMix 1.15  ->  A/P 0.155   headroom x1.03   the fold is one step away
      //
      // ⚠️ **Raised for a REASON, and it is the same mechanism as the crystal block's two nudges** — read the
      // note there first. The zoom is what smears each crystal's rim radially into the accumulating trail, so
      // `warpMix` is the REACH of the emergent halo where `edgeBrightness`/`internalRefraction` are its
      // brightness. Nudging only the crystal terms would make the crystals brighter without making them read
      // as emitting further; the two together are what the request asked for.
      //
      // It stops at 0.75 rather than going back toward 0.8 because the zoom's other effect is the one the fold
      // fix was also treating: on a planar figure at `decayFactor 0.9876` a strong zoom smears the concentric
      // colour BANDS radially too, and those are what carries this preset's palette work. 0.75 keeps ~1.6x fold
      // headroom and leaves the bands legible.
      transMapWarpMix: 0.75,
      material: {
        // The Ice table default, verbatim — the frost bed under the crystals, and it needs no override.
        // `velocityStretch: 0` is load-bearing (8a-3 reworked Ice from a blue-tinted FLAME to a pure
        // circular kernel); alpha blend means it OCCLUDES rather than sums, i.e. matter, not light.
        //
        // ⚠️ The palette above replaces this ramp's RGB but NOT its ALPHA — `hdr-particle.ts:711` is explicit
        // that a palette carries no meaningful alpha, and `outA = shape * rampColor.a` for an alpha-blend
        // material (`:823`). So the ice ramp still governs how SOLID each particle is (cold particles stay
        // near-transparent at a 0.157 alpha), which is what lets a crystal behind a cold particle survive.
        // Choosing a palette therefore recolours this material without making it opaque.
        preset: 'Ice', splatRadius: 11, coreBrightness: 1.3, haloStrength: 0.5, falloffExponent: 3.0,
        thermalLag: 0.7, emissionIntensity: 1.7, heatMode: 'velocity', heatGain: 0.8,
        blendMode: 'alpha', colourRamp: 'ice', velocityStretch: 0,
      },
      crystal: {
        enabled: true,
        // 16 -> 13, and `poolSize` 900 -> 520: the verdict was that the preset focused almost exclusively on
        // crystals, so the pass is REBALANCED to punctuate the coloured figure rather than cover it. Effective
        // on-screen width carries `SHAPE_SIZE_COMPENSATION` (dendrite 1.11), so 13 renders ~14.4 px-equivalent.
        shape: 'dendrite', crystalSize: 13,
        // ⚠️ `edgeBrightness` 1.4 -> 1.55 and `internalRefraction` 0.35 -> 0.46 (2026-08-23), to emphasise the
        // light-emitting read the browser pass reported. **The mechanism is not a glow control, and the two
        // obvious levers are both wrong here** — see the `transMapWarpMix` note for the other half.
        //
        //   * **`material.emissionIntensity` CANNOT reach a crystal.** The crystal branch `return`s at
        //     `hdr-particle.ts:682`; `float intensity = uEmissionIntensity` is at `:813`. So raising it
        //     brightens the frost BED, which competes with the crystals instead of emphasising them.
        //   * **TransMap's own glow term is inert on this preset.** `trans-map.ts:1691` is
        //     `strength = length(flOff * edgeFade)` where `flOff` is the FLUID field only, and there is no
        //     fluid layer here — so `uGlowBoost * strength` is exactly zero whatever the control says.
        //   * **Bloom stays OFF** (see `customFilmLookParams`): on hard faceted alpha geometry it blooms the
        //     facet edges and dissolves the hard-edged read the crystal output channel exists to provide.
        //
        // What the emission actually IS: `renderCrystalOnly()` runs BEFORE the three-way render branch
        // (`main.ts:1899`), so crystal pixels land in the trail buffer and are then warped by the style-1 zoom
        // and re-accumulated at `decayFactor 0.9876`. Each crystal's bright terms are therefore smeared
        // radially and integrated over ~80 frames — an emergent halo, not a glow uniform.
        //
        // ⚠️ **So the quantity to raise is the AREA-INTEGRATED premultiplied luminance, not the peak — the rim
        // peak ALREADY clips** (modelled 1.32 against the 8-bit ceiling, with bloom and tone map off there is
        // nothing downstream to roll it off). Pushing `specularStrength` is the trap: its lobe is `pow(..., 42)`,
        // so it adds ~0.02 mean over the disc while sitting far above the clip at its centre — invisible.
        // `edgeBrightness` widens the Fresnel-weighted rim annulus and `internalRefraction` lifts the whole
        // interior by indexing further up the ice ramp, which is why those two and not the third.
        //
        // Modelled over 200 radial samples of the branch, area-weighted, premultiplied:
        //
        //     current  (1.4 / 0.35)   trail energy 0.368   clipped area 0.0%
        //     now      (1.55 / 0.46)  trail energy 0.407   x1.11   clipped area 0.0%
        //     rejected (2.2  / 0.35)  trail energy 0.447   x1.22   clipped area 9.1%  <- flat white blobs
        //
        // +11% with nothing driven into saturation, which is the "slightly" the request asked for. The 9.1%
        // row is the failure mode to avoid: once an annulus clips, the facet gradient inside it is gone and the
        // crystal reads as a flat cut-out — the exact thing 8a-5's Fresnel work was added to fix.
        facetSharpness: 0.9, specularStrength: 1.8, iceOpacity: 0.8, edgeBrightness: 1.55,
        // Left as `'ice'` on purpose: galaxy's window ENDS at the same pale ice-blue this ramp paints, so the
        // two output channels share a top note. Recolouring the crystals too would remove that link.
        // ⚠️ `iceOpacity` stays 0.8 deliberately: raising alpha raises the premultiplied output too, but it
        // also makes the crystals more OCCLUDING — reading as matter rather than as light, i.e. against the
        // request. Brightness comes from the colour terms; alpha stays where it governs solidity.
        internalRefraction: 0.46, crystalRamp: 'ice',
        // ⚠️ `nucleationBudget` is the real density control, NOT `slowFraction` — the latter is an
        // eligibility percentile that saturates above roughly `budget/particleCount`, and LOWERING it
        // increases clustering (slow particles bunch at the figure's cusps). 8/frame fills 312 slots
        // (freezeCap 0.6 of 520) in ~0.65 s, so the lattice still builds visibly rather than appearing at once.
        poolSize: 520, freezeCap: 0.6,
        birthRule: 'slow', slowFraction: 0.30, coldFraction: 0.25, nucleationBudget: 8,
        // 8 s -> 5 s: with `growthEnabled` the interesting part is the FORMING, so the population must
        // recycle rather than settle into a static field of finished crystals.
        nucleationTime: 0.4, crystalLifetime: 5, meltTime: 0.8, meltThreshold: 0.8,
        // See the doc block: deliberately OFF. ⚠️ And the radius is MEASURED against THIS figure, not
        // inherited: `clusterForceRadius` is in MODEL units, and this figure's radial half-extent sweeps
        // 14.5 -> 60 over its own AM cycle (12 000 samples, `pos` 0/15/45/90). So 40 is between a third of
        // the figure and three times it depending on the phase — i.e. at the widest point of the cycle every
        // crystal would be a GLOBAL force, which is precisely the failure `Miracle Frost` records. That the
        // value is inert at `clusterForce: 0` is what makes it safe to leave; do not enable it here.
        clusterForce: 0, clusterForceRadius: 40, clusterForceReturn: 1.5,
        // ⚠️ THE SNOWFLAKE PAIR (Phase 8b.1) — and the two numbers are NOT directly comparable: `latticeCell`
        // is in MODEL units (`types.ts:450`) while `crystalSize` is in PIXELS, so the old comment here
        // ("8 against 16") compared two different units. What matters is that the lattice pitch is small
        // relative to the figure — 8 against a 14.5-60 half-extent gives several cells across each crystal's
        // footprint, which is what makes the snap visible as angular joints instead of as a global grid.
        latticeSnap: 0.6, latticeCell: 8, symmetryFold: true,
        // ⚠️ THE OTHER HALF: arms only exist with growth on. `growthAnisotropy: 0.45` biases deposits along
        // the six axes more strongly than the 0.3 default, which is what makes ARMS rather than a blob.
        growthEnabled: true, accretionRadius: 12, stickingProbability: 0.35,
        growthAnisotropy: 0.45, maxGrowth: 2.2, accretionBudget: 8,
      },
    },
  },

  /**
   * **Liquid Light** — *a slow, broad, luminous flow*, and the material the user judged redundant against
   * Plasma. Both halves of that were addressed:
   *
   *   1. **The MATERIAL defaults were retuned** (`generators/material-presets.ts`) — measured hue separation
   *      from Plasma goes 23 degrees -> 73 degrees, plus a silhouette split (`velocityStretch` 0.85 here vs
   *      Plasma's 0.25) and a halo split (`falloffExponent` 1.6 wide vs 3.2 tight). Read the derivation
   *      comment on `Plasma` in that file; the short form is that `heatGain` is a RAMP-WINDOW control, so
   *      the two materials now occupy different segments of the shared `liquid` ramp.
   *   2. **This preset carries those retuned values VERBATIM** — deliberately no override. Its job is to show
   *      the material honestly, and the fix belonged in the material.
   *
   * **Figure `Diffusion`** — arc coherence **0.50, the most coherent figure in the library** (next best 0.64;
   * `Inside Nebula`, used for Smoke, is 4.72). Consecutive particle indices land close together, so the
   * population reads as a continuous FLOWING strand rather than as a cloud of points. That is precisely what
   * a liquid wants and what an 18 px soft kernel needs to avoid becoming a haze. Extent 56 with median heat
   * 0.71 and coverage 19/20 ramp buckets — the full teal-to-mint top end of the ramp is exercised.
   *
   * **Style 5 with `Ocean Current`** — the archetype named for this: direction [0.7,-0.7] diagonal, scale 3.0
   * (the largest of the four archetypes, so broad slow eddies), `curlAmount 0.7` for rotational structure,
   * and `evolutionSpeed 0.3` so the field itself barely changes. Slow, large and turning.
   *
   * The composition against `Material Plasma` is now differentiated on every axis: coherent strand vs.
   * compact hot knot, diagonal ocean flow vs. IFS echo, teal-mint vs. violet-blue, elongated soft vs. tight
   * round.
   */
  'Material Liquid Light': {
    metadata: { name: 'Material Liquid Light', version: 2, designResolution: { width: 75, height: 100 }, tags: ['demo', 'material', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 8000, waveSpeed: 0.05,
      rotation: [0, 0, 0.08], angle: [0, 0, 0],
      waves: diffusionWaves(),
      colorBase: [32, 128, 160], colorAmp: [32, 64, 96], colorFreq: [0.02, 0.05, 0.03], colorShift: [0.4, 0.6, 0.5],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.94, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.45,
      transMapEnabled: true, transMapStyle: 5,
      // ⚠️ OVERLAY, not the layer — `main.ts` reads `overlay.proceduralFlow`.
      proceduralFlow: {
        archetype: 'Ocean Current', strength: 0.3, scale: 3.0, curlAmount: 0.7,
        direction: [0.7, -0.7], radial: 0.1, evolutionSpeed: 0.3,
      },
      transMapWarpMix: 0.6,
      material: {
        // ⚠️ The RETUNED LiquidLight default, verbatim. Re-sync if that default moves again — this block
        // exists only because `overlay.material` has no "inherit the default" form (`Object.assign`, so an
        // absent block lets the live session's material leak in).
        // ⚠️ **Browser-tuned 2026-08-21, so this block is NO LONGER the retuned default verbatim** —
        // `splatRadius` 18 -> 10 and `haloStrength` 1.0 -> 0.4. Both tighten the kernel: 18 px at
        // `falloffExponent 1.6` is a very wide soft body, and on this figure's long continuous strands the
        // overlapping haloes fused the strands into a single mass. At 10 px with the halo cut to 0.4 the
        // individual strand stays readable while the material keeps its soft wide-falloff character.
        //
        // ⚠️ **THAT PARAGRAPH ONCE READ "do NOT propagate these two values back into the `LiquidLight`
        // DEFAULT", AND IT WAS REVERSED BY THE USER ON 2026-09-05: the default now IS 10/0.4 and this block
        // is byte-equal to it again.** The reasoning it gave was that 18/1.0 is what separated the bundle
        // from Plasma's 9/0.85 in a dropdown with no figure to overlap — but the measurement it never made
        // is that `splatRadius` scales sprite AREA, so 18/1.0 delivered 5.80x Plasma's kernel energy with a
        // core:mid ratio of 1.5, i.e. **a flat disc**, the exact "one large almost uniform area with halo"
        // the review rejected. **A separation argument is not a separation measurement.** The
        // differentiation survives through SHAPE instead — `falloffExponent` 1.6 vs 3.2, `heatGain` 0.92 vs
        // 0.60, `velocityStretch` 0.85 vs 0.25, plus 11 of 21 film-look fields — and `fieldcheck` §T's
        // `configDepartures: {}` row now PINS this equality, so a drift back to 18 fails rather than
        // passing as a permitted difference.
        preset: 'LiquidLight', splatRadius: 10, coreBrightness: 1.3, haloStrength: 0.4, falloffExponent: 1.6,
        thermalLag: 0.3, emissionIntensity: 1.5, heatMode: 'velocity', heatGain: 0.92,
        blendMode: 'additive', colourRamp: 'liquid', velocityStretch: 0.85,
      },
    },
  },

  /**
   * **Organic** — *a pulse of growth travelling along a living strand.*
   *
   * ⚠️ **`heatMode: 'age'` is unlike every other material here: colour is independent of motion.** The driver
   * is a raised cosine over a 6 s cycle with `phase = (i/count)*6.0`, i.e. keyed to particle INDEX. On a
   * COHERENT figure, index maps to position along the arc — so the cycle becomes a wave of growth/decay
   * travelling ALONG the curve. On an incoherent figure the same driver is just per-particle noise.
   *
   * **That is the whole reason the figure is `Meditation`** (arc coherence 0.50, tied with `Diffusion` as the
   * most coherent in the library — they share byte-identical waves and differ only in `particleCount` and
   * `sinMagicParams`). The old shared figure wasted the material's single most distinctive feature.
   *
   * ⚠️ **RIBBONS WERE PROPOSED HERE AND ARE NOT USED — they would have made this preset INVISIBLE.** The
   * idea was sound (connect consecutive indices into a visible vine and let the growth pulse travel along
   * it) and the mechanism defeats it, at two levels:
   *
   *   1. `main.ts:951` routes ribbon mode to `ribbonRenderer.render()`, which goes through
   *      `TrajectoryPalette` — a PALETTE path with no material-ramp support whatsoever. Ribboned strands
   *      would carry `state.colors`, not the organic ramp.
   *   2. Worse, in `hybrid` mode the other particles go through `drawParticleSubset` (`main.ts:870`), which
   *      copies positions, colours, depths, velocities and `frozen` — **but not `temperatures`**.
   *      `renderSplat` then falls back to `state.temperatures ?? new Float32Array(count)`, i.e. ALL ZEROS,
   *      pinning the whole population at ramp t=0. `ORGANIC_POINTS[0]` is `rgb(0,10,0)` at **alpha 0**, and
   *      this material is alpha-blended, so the figure would render as nothing at all.
   *
   * Both were found by tracing the branch rather than by looking at a frame; a `verify` pass cannot see
   * either. The coherent figure and the age driver deliver the travelling pulse on their own — the strand is
   * implied by index adjacency, which is exactly what arc coherence 0.50 measures.
   *
   * **NON-ICE CRYSTALS take the structural role ribbons were meant to play, and they are BUILT here rather
   * than deferred** — the request was for at least two demos using crystals with one of them not reading as
   * ice, and losing ribbons left this preset needing exactly the hard structural element crystals provide.
   * Pre-measured as viable rather than assumed: the crystal pass samples its ramp at
   * `clamp(0.25 + refract, 0, 1)` (`hdr-particle.ts:635`), and over t=0.25..1.0 the **organic** ramp spans
   * luminance 0.21 -> 0.89 (for comparison ice 0.27 -> 0.97, liquid 0.11 -> 0.90, smoke 0.20 -> 0.89).
   *
   * Four choices make them read as SEEDS/PODS rather than as ice, and the ramp is only the first:
   *   * `crystalRamp: 'organic'` — green-olive-yellow, sharing the material's own vocabulary. This is the
   *     whole point of the exercise: the crystal pass is a hard-edged occluding OUTPUT CHANNEL, not an
   *     "ice feature", and nothing about it is intrinsically frozen.
   *   * `shape: 'plate'` — not `dendrite` (branching frost) and not `hexagon` (which 8a-4 records as reading
   *     as ice cubes). A plate is a flat rounded body: a seed case.
   *   * `latticeSnap: 0` + `symmetryFold: false` — the inverse of `Material Ice`. Formal hexagonal symmetry
   *     is precisely the mineral cue to avoid; organic growth is irregular.
   *   * `birthRule: 'slow'` — ⚠️ **and NOT `'cold'`, which would silently degrade anyway.** `'cold'` needs
   *     `temperatures`, which exists here, but in `heatMode: 'age'` "cold" means young-or-dying rather than
   *     slow-moving, so it would nucleate on the age cycle's troughs and pulse in and out with it. `'slow'`
   *     nucleates at the figure's cusps, where a pod on a vine belongs.
   *
   * `specularStrength` 1.5 -> 0.6 and `facetSharpness` 0.85 -> 0.55: glint and hard facets are the two cues
   * that read as mineral, so both are cut well below the ice values.
   *
   * **Style 9 — Band Split at a low amount.** It holds the figure's overall shape and position while its
   * SURFACE texture crawls, which is what a growing thing does: the form persists, the detail changes. A
   * flow field would instead carry the whole strand off, fighting the coherence the figure was chosen for.
   *
   * ⚠️ **Style 9 is a MODIFIER, not a field — it is inert on its own** (`isInertModifier()`): it recomposes
   * a warp's output, so with no field layer `finalUv === vUv` and its two controls provably do nothing.
   * Hence the TWO-layer chain here. The field layer is `Turbulent Weave` because it is the **only
   * four-harmonic archetype** (`[1, 0.5, 0.25, 0.125]` over `[1, 2, 4, 8]`); handed a single-harmonic
   * archetype the split has either everything to freeze or nothing to move and looks broken while working
   * perfectly. Both halves are kept gentle (`strength 0.3`, `amount 0.55`) — this is a texture on a vine,
   * not the subject.
   *
   * `symmetryFold: 3` — a 3-fold rosette (⚠️ `OverlayState.symmetryFold` is the E30 dihedral ORDER, a
   * number where 1 means off; not to be confused with `CrystalRenderConfig.symmetryFold`, a boolean).
   * Botanical forms are radially symmetric, and 3 is low enough to keep the individual strand visible — 12
   * would make a mandala and lose the travelling pulse.
   *
   * Fallback figure if the strand reads wrong: `Looking For Rainbows`.
   */
  'Material Organic': {
    metadata: { name: 'Material Organic', version: 2, designResolution: { width: 75, height: 100 }, tags: ['demo', 'material', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 4000, waveSpeed: 0.05,
      rotation: [0, 0, 0.05], angle: [0, 0, 0],
      // `Meditation`'s waves — byte-identical to `Diffusion`'s, hence the shared builder. The two legacy
      // presets differ only in `particleCount` (1000 vs 4000) and their `sinMagicParams`.
      waves: diffusionWaves(),
      colorBase: [64, 160, 48], colorAmp: [48, 64, 32], colorFreq: [0.03, 0.02, 0.05], colorShift: [0.3, 0.5, 0.2],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.95, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      // ⚠️ `style: 0`, not 9. This block is the LEGACY collapse of the chain below — a reader that reduces
      // the preset to one style must land on the FIELD layer, since style 9 alone is inert. The table is
      // `rippleTable()` for the same reason: a flat field would collapse to no warp at all.
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      // ⚠️ No `ribbonMode` — see the doc block. `'hybrid'` would zero this material's temperatures.
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.55,
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        // The field. Gentle and slow — it exists to give the modifier something to split.
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Turbulent Weave', strength: 0.3, detail: 1.5, drift: 0.12 } },
        // The modifier. `weight` is required by `TransMapLayer` and filtered on by `buildChainPlan`, but
        // style 9 is `weightless` in `TRANS_MAP_STYLES` — the shader reads `bandSplit.amount` instead.
        { style: 9, enabled: true, weight: 1.0,
          bandSplit: { amount: 0.55, radius: 10.0 } },
      ],
      transMapWarpMix: 0.5,
      symmetryFold: 3, symmetryMirror: true,
      material: {
        // The Organic table default, verbatim. `heatMode: 'age'` and `heatGain: 1.0` are both load-bearing:
        // the age driver spends only 9 % of its cycle below 0.02 (the older clamped form spent 51 %, which
        // made half of an alpha-blended figure invisible), and at gain 1.0 the full organic ramp is used.
        preset: 'Organic', splatRadius: 10, coreBrightness: 1.3, haloStrength: 1.0, falloffExponent: 3.0,
        thermalLag: 0.35, emissionIntensity: 1.2, heatMode: 'age', heatGain: 1.0,
        blendMode: 'alpha', colourRamp: 'organic', velocityStretch: 1.0,
      },
      crystal: {
        // ⚠️ NON-ICE CRYSTALS — see the doc block for why each of these differs from `Material Ice`. The
        // block is written out in full because `applyOverlayConfigBlocks` applies it with `Object.assign`,
        // so any omitted key would inherit the LIVE SESSION's value (invariant 14).
        enabled: true,
        // A flat rounded body, not a frost branch and not a cube. `crystalSize: 10` against the material's
        // 10 px splat: a pod the same order of size as the strand it sits on, so it belongs to the figure
        // rather than looming over it. (Effective width also carries `SHAPE_SIZE_COMPENSATION`, which is
        // why `plate` — the least quad-filling shape at ~19 % — is not set smaller still.)
        shape: 'plate', crystalSize: 10,
        // Both cut hard from the ice values: glint and hard facets are the mineral cues.
        facetSharpness: 0.55, specularStrength: 0.6, iceOpacity: 0.75, edgeBrightness: 0.9,
        internalRefraction: 0.25, crystalRamp: 'organic',
        // Sparse. 4000 particles, 220 slots at 0.5 occupancy is ~110 pods — punctuation on the strand, not
        // a second population. `nucleationBudget: 4` fills that in ~0.5 s.
        poolSize: 220, freezeCap: 0.5,
        birthRule: 'slow', slowFraction: 0.30, coldFraction: 0.25, nucleationBudget: 4,
        // A pod grows in, holds, and goes. `meltThreshold: 0.85` sits above the age driver's cycle peak for
        // most particles, so pods die of AGE rather than being melted — a lifecycle, not a duel.
        nucleationTime: 0.8, crystalLifetime: 6, meltTime: 1.2, meltThreshold: 0.85,
        // OFF, as everywhere in this group: the only crystal control that deforms the figure.
        clusterForce: 0, clusterForceRadius: 40, clusterForceReturn: 1.5,
        // ⚠️ The INVERSE of `Material Ice`'s snowflake pair, deliberately — formal hexagonal symmetry is the
        // cue that would make these read as ice.
        latticeSnap: 0, latticeCell: 10, symmetryFold: false,
        // Growth on, but weakly anisotropic (0.15 vs Ice's 0.45): a pod SWELLS rather than branching into
        // six arms. `maxGrowth: 1.5` keeps the swelling modest.
        growthEnabled: true, accretionRadius: 10, stickingProbability: 0.3,
        growthAnisotropy: 0.15, maxGrowth: 1.5, accretionBudget: 5,
      },
    },
  },

  /**
   * **v8 Step 15.1 — the `liquid` iso-surface render mode.** The one preset in the library that DEMONSTRATES
   * merging, and every number in it was chosen by measuring the merge rather than by eye.
   *
   * Phase 15's entire basis is one diagnosis: **additive splats cannot merge** — two sprites get brighter,
   * never become one shape — so merging is a RENDERING problem. Liquid is therefore the first particle path
   * that OCCLUDES rather than adding light, and this preset exists to make that visible in one glance.
   *
   * ⚠️ **The figure is `Quader`'s, and that is the load-bearing choice.** A demo of merging needs a figure
   * whose blobs are SEPARATE at one end of the Iso range and ONE BODY at the other; most of the library
   * cannot show it at all. Measured at 1024x768, counting connected components of >= 50 px over the
   * thresholded field:
   *
   *   preset      kw 1, iso 1 -> iso 8        verdict (each at its OWN authored count)
   *   Cylinder    1 blob at every setting     no merge to demonstrate (spacing 0.50 px at 10 000)
   *   Pipes       1 blob until kw 4 / iso 8   ditto, 0.87 px at 10 000
   *   Quader      1 -> 23 -> 32 blobs         the sweep IS the feature (1.23 px at 25 000)
   *
   * So `Quader` is here for a MEASURED property (the widest inter-particle spacing among the low-accumulation
   * presets, hence a field with real gaps in it), not because it is the standing low-accumulation test figure
   * — though it is that too, which is convenient rather than the reason.
   *
   * ⚠️ **`particleCount: 15000`, well above `Quader`'s authored 5000, and NOT a taste decision.** At 10 000
   * the sweep at kernel width 1 starts at 19 blobs and never reaches a single body — the interesting end of
   * the range is missing. At 15 000 it runs 1 blob (iso 1) -> 5 (iso 3) -> 24 (iso 4) -> 32 (iso 8), i.e. the
   * full merge-to-separate transition sits inside the slider's own travel. Above 15 000 the measurements are
   * identical to the digit (20 000 gives 13.1 %/1b against 13.0 %/1b), because the density normalisation
   * makes the surface count-independent BY CONSTRUCTION — which is the whole point of `isoLevel` being a ratio,
   * and is itself worth seeing: raising Particle Count on this preset changes the SMOOTHNESS, not the shape.
   * ⚠️ 15.1b's on-curve reference PRESERVES that property rather than trading it away — measured spread at
   * N = 2 000 → 30 000 is 12.3 %, against the frame mean's 17.3 % — because `spacing ∝ 1/N` at fixed curve
   * length, so both terms of the reference scale with the count identically.
   * ⚠️ Count and index spacing are ONE quantity read two ways — at 15 000 this table measures 2.06 px against
   * `Quader`'s 1.23 px at 25 000 (verified: 507x529 px extent in both, so it is the same curve sampled more
   * sparsely). Quoting the spacing without the count is what makes the two numbers look contradictory.
   *
   * ⚠️ **`isoLevel: 0.8409` and `kernelWidth: 1.52` look like typos and are not — they are the values the
   * SLIDERS CAN REPRESENT.** Both tracks are logarithmic anchored at a non-power-of-two-friendly minimum
   * (0.0625 and 0.5), quantised in the stored unit, so the target lands on the nearest grid stop. Authoring a
   * round number instead would mean the handle jumps on first touch and a centre-restore could never return to
   * the authored value — the reachability class `trackcheck` §H exists for, arriving through an AUTHORED value
   * rather than through the range. (`DEFAULT_LIQUID_CONFIG.isoLevel` is 1.0 for the same reason; it happens to
   * be exact.)
   *
   * ⚠️ **`isoLevel` MOVED 3.03 → 0.8409 at 15.1b, and it is a MECHANICAL consequence of the reference change,
   * not a retune** — which matters because no Phase 15 step may retune a library preset. `liquid-reference.ts`
   * replaced the frame mean with the density measured ON the curve, so the same absolute threshold is now a
   * different ratio: `0.8358 = 3.03 × 0.554 / (0.567 × 3.542)` from this figure's own measured pair, then
   * snapped to the reachable 0.8409 (+0.61 %). The picture is intended to be the SAME picture; what changed is
   * that the number now means the same thing on every other preset too.
   *
   * The pair sits at the transition deliberately: measured 7.8 % coverage in 9 bodies, so the figure reads as
   * a handful of merging lobes — move Iso Level DOWN and they fuse into one body, UP and they separate into
   * three dozen droplets. That is the control the phase adds, and one preset showing both ends of it is worth
   * more than one showing a settled look.
   *
   * `tintSource: 'ramp'` with `surfaceRamp: 'liquid'` — the library's most-used ramp (39 uses), and the honest
   * 15.1 answer: a fullscreen pass has NO per-particle identity (it is gone the moment the field is summed),
   * so the surface is coloured by THICKNESS. Rim thin, interior thick, which is what reads as a body of
   * liquid. Step 15.2's weighted accumulation is what will make per-particle colour possible.
   *
   * ⚠️ **No material, and no `crystal` block.** A material would contribute only a colour ramp here (liquid
   * ignores `coreBrightness`/`haloStrength`/`velocityStretch` — there is no quad to shape), so it would add a
   * dependency and change nothing visible; and crystals would put an occluding population on top of the one
   * new occluding path, which is exactly the comparison this preset is for.
   *
   * `decayFactor: 0.45` is LOW on purpose. The surface is opaque, so a long trail stacks yesterday's
   * silhouette behind today's and the merge boundary — the thing being demonstrated — is what gets smeared
   * first. Slow rotation (`Quader`'s own 0.2/0.3 °/s) for the same reason: the lobes should be seen fusing,
   * not swept.
   */
  'Liquid Surface': {
    metadata: { name: 'Liquid Surface', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'liquid', 'render-mode', 'review'] },
    generators: {
      // `Quader`'s wave table verbatim, at 3x its authored count — see the doc block for the measurement.
      type: 'lissajous', particleCount: 15000, waveSpeed: 0.05,
      rotation: [0, 0.2, 0.3], angle: [0, 0, 0],
      waves: quaderWaves(),
      colorBase: [21, 21, 21], colorAmp: [64, 32, 32], colorFreq: [0, 0.1, 1], colorShift: [1, 2, 3],
    },
    // ⚠️ `mode: 'liquid'`, and the overlay says so too — invariant 17: `renderMode` has TWO sources and every
    // reader must resolve them in the same order, so both halves carry the same value rather than relying on
    // whichever one a given reader happens to consult.
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.45, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      // TransMap OFF. An image-domain warp on an iso-surface bends the silhouette, which is the one thing
      // this preset is asking to be looked at. `style: 0` with a ripple table is the inert legacy collapse.
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      speedFactor: 0.6,
      liquid: {
        // Both are the nearest SLIDER-REPRESENTABLE values to their targets — see the doc block. `isoLevel`'s
        // target is the 15.1b re-expression of the old 3.03, NOT a new look.
        isoLevel: 0.8409, kernelWidth: 1.52,
        // A narrow feather: the silhouette is the feature, and a wide one turns the surface back into the
        // cloud of light every other mode already draws.
        edgeSoftness: 0.15,
        tintSource: 'ramp', surfaceRamp: 'liquid',
        // v8 Step 15.2. ⚠️ **Written out explicitly rather than inherited, and this is NOT a retune** — the
        // two fields are `DEFAULT_LIQUID_CONFIG`'s own values, so the rendered result is identical either
        // way. They are stated because this is the preset the step will be JUDGED on: a reader comparing it
        // against a browser pass needs to see which colour mode produced the image, and a field that arrives
        // silently from a default cannot be read off the preset at all. The step's own rule stands — no
        // authored value here differs from the default.
        colourMix: 0.85, mixModel: 'light',
        // v8 Step 15.3. ⚠️ **`DEFAULT_LIQUID_CONFIG`'s own four values, written out for 15.2's reason and NOT
        // a retune** — the per-field `?? DEFAULT` merge supplies exactly these whether they appear here or
        // not, so the rendered result is identical either way, and this is the preset the step is judged on.
        // ⚠️ **All four defaults are NON-neutral, so this preset does change appearance at 15.3** — that is a
        // property of the DEFAULTS (see `DEFAULT_LIQUID_CONFIG`'s rationale: unlike `colourMix`, none of the
        // four has an identity value worth protecting), not an authoring decision taken here.
        refraction: 0.25, specular: 0.8, thickness: 0.5, edgeBrightness: 0.6,
      },
    },
  },

  // ============================================================================================
  // THE FOUR PHASE 15 SUBSYSTEM DEMOS — added 2026-09-03, one per subsystem the phase built.
  //
  // ⚠️ **`Liquid Surface` above demonstrates the RENDER MODE and nothing else, which is why it is not
  // enough on its own.** Phase 15 shipped four separable things and three of them are invisible on that
  // preset because it authors none of them: `overlay.liquidField` (the standing pool), `overlay.dye`
  // (the advected colour) and `overlay.cohesion` (the beading). Each of the three is off by
  // construction — `enabled: false`, `enabled: false`, `strength: 0` — so they cannot be shown by a
  // preset that omits the block, and each therefore needs its own entry.
  //
  // ⚠️ **THE FOURTH IS A SECOND SURFACE DEMO, AND IT EARNS ITS PLACE ON A DIFFERENT AXIS.** `Pigment
  // Sheet` authors the same block as `Liquid Surface` but exercises the parts of it that preset leaves
  // at their defaults: `mixModel: 'pigment'` (15.2's second colour model — the one with NO demo before
  // now) and a flat figure. It is not a variation of the look; it is the other half of a switch.
  //
  // ## The house rules these four follow
  //
  // **Every non-default value below has a measured reason recorded in its preset's doc block, and every
  // `isoLevel` / `kernelWidth` / `cohesion.radius` is an EXACT STOP on its logarithmic track**
  // (verified against `visual-fx.ts`'s real `ISO_LEVEL_TRACK` / `KERNEL_WIDTH_TRACK` /
  // `COHESION_RADIUS_TRACK` before authoring, which is the reachability class `trackcheck` §H asserts
  // over exactly this group — see `Liquid Surface`'s own note for why a round number is the defect).
  //
  // ⚠️ **All four are on `'Legacy Graded'`, and on this path that is load-bearing rather than a
  // convention.** Twelve of the fifteen film looks install a `palette`, which REPLACES the preset's
  // authored colour — and on the liquid path colour is the subject of two of these four demos (the dye
  // IS a colour field; `pigment` vs `light` IS a colour model). A palette would overwrite the thing
  // being demonstrated. `Legacy`, `Legacy Graded` and `Cinematic` are the only three at
  // `palette: 'none'`; `Legacy Graded` is the one of those with exposure above 1.
  //
  // ⚠️ **TransMap is OFF on all four, for `Liquid Surface`'s reason** — an image-domain warp bends the
  // silhouette, which is what an iso-surface demo is asking to be looked at. `Liquid Field Pool` has a
  // second reason on top: TransMap style 6 decays the SAME 512² velocity field the pool reads
  // (`applyFluidFeedbackState()` resolves the two authors), so a live style-6 layer would make the
  // pool's own `fieldDecay` fight a second author for one resource.
  //
  // ⚠️ **`decayFactor` is LOW on all four (0.35–0.5).** The surface OCCLUDES rather than adding light —
  // it is the only mode that does — so a long trail stacks yesterday's silhouette behind today's and
  // the boundary being demonstrated is the first thing to smear.
  //
  // ⚠️ **None of the four authors a material, and that is a decision.** A material forces
  // `renderMode: 'splat'` for every mode EXCEPT `liquid` (`resolveModeAgainstMaterial()` is the one
  // owner), so it would survive here — but it would also add a dependency and, on three of the four,
  // change what the demo is about: it re-routes colour through `tintSource: 'material'`'s ramp, which
  // is the channel `Dye Wake` and `Pigment Sheet` are using for something else.
  //
  // Preview-grid cost: four more tiles. ⚠️ **Preview tiles never dye, never bead and never stir, BY
  // DECISION** (`grid-tile-renderer.ts`'s `buildLiquidState()`), so all four tiles show the SURFACE
  // only. A tile that looks unlike the main view on these four is the documented behaviour, not the
  // grading-chain defect that reading usually localises.
  // ============================================================================================

  /**
   * **v8 Step 15.5 — Liquid Field.** Relationship (B): the figure SWIRLS THROUGH a standing liquid.
   *
   * The pool is a second population, seeded once and thereafter moved ONLY by the velocity field the
   * figure writes into `FluidAdvectionProcessor`. The curve itself stays a pure Lissajous figure — that
   * is the relationship's defining property — so everything interesting in this preset happens to
   * particles the figure never touches directly.
   *
   * ⚠️ **THE FIGURE IS `Rotating Band`, NOT `Radar`, AND THE SWAP CAME WITH A RE-TUNE** — see
   * `rotatingBandWaves()` for why swept area replaced displacement per frame as the selection statistic
   * (18.2 % → 70.0 % of the frame visited over 20 s). ⚠️ **An elaborate figure is not a drop-in for a
   * thin one on this path**: the density reference is measured on the FIGURE's own curve, so a woven
   * ribbon has wider index spacing, a LOWER `isoRef`, and therefore fattens into a solid mass at the
   * threshold the bar needed. At the inherited `isoLevel: 0.5` the band alone covers 14.23 % of the frame
   * and the pool's contribution is no longer distinguishable from it. **`isoLevel` had to go UP, not stay
   * put — a figure swap on the liquid path is always also a threshold change.**
   *
   * ⚠️ **`particleCount: 4000` IS THE ENABLING CONDITION, NOT A PERFORMANCE CHOICE, and getting this
   * backwards is the one way to author this preset into invisibility.** `resolveLiquidReference()` takes
   * the density reference from the FIGURE's count (`min(state.waveCount, solidCount)` — the pool is
   * excluded by construction), so a denser figure raises `isoRef` for the whole frame including the
   * pool. Re-measured on `Rotating Band` with this exact 20 000-particle pool, at kw 2.0 / iso 2.0:
   *
   *     figure N     spacing   isoRef (iso 1)    coverage the POOL adds
   *     4 000        3.74 px   1.11              14.3 points          <- authored
   *     10 000       1.50 px   2.77              13.5 points
   *     20 000       0.75 px   5.54               3.6 points          <- the pool is there and invisible
   *
   * So raising Particle Count on this preset does not make the liquid denser; it makes the liquid
   * DISAPPEAR. ⚠️ This is the calibration gap between the two populations stated as an authored fact —
   * it is a known open item, not something this preset works around by accident. Note the figure's own
   * coverage is **2.78 % at all three counts**: what changes is only the pool's visibility.
   *
   * ⚠️ **`kernelWidth: 2.0` / `isoLevel: 2.0`, chosen from a TIME SERIES over the iso track — a single
   * instant cannot separate the candidates.** At iso 1.5157 the band's own coverage swells from 3.35 % to
   * 6.08 % between t = 3 s and t = 20 s and collapses to 9 bodies of up to 41 694 px, i.e. the figure
   * becomes the mass. At iso 2.4623 it drops to 1.0–1.6 % and the ribbon thins into speckle. At 2.0 the
   * series is flat and the reading is stable at every sampled instant:
   *
   *     t (s)        3       10      20      30      45
   *     figure      1.67 %  2.78 %  3.00 %  2.57 %  1.90 %     (40–61 bodies — a woven ribbon)
   *     + pool     16.13 % 17.04 % 17.10 % 16.65 % 15.67 %
   *     pool adds  14.5    14.3    14.1    14.1    13.8  points
   *
   * ⚠️ **The pool's contribution is the SPREAD BETWEEN THE TWO ROWS, and that is the number a pool demo
   * lives or dies on** — it is within 0.7 points of constant across 45 s, so the pool never stops being
   * the majority of what is on screen. The figure alone is 1.67–3.00 %; with the pool it is ~16 %. The
   * band is the stirrer, and the frame is liquid.
   *
   * ⚠️ **`seedPattern: 'blobs'`, not the `'cloud'` default, and this is the recipe rule rather than a
   * preference.** `'cloud'` is one centre blob at 0.32·minDim, so the figure stirs a single mass and the
   * result reads as one wobbling shape; `'blobs'` is five discs on a ring at 0.26·minDim, so the band
   * sweeps ACROSS separate bodies and drags them into each other — the stirring is legible because
   * there is more than one thing being stirred. `'fill'` covers the frame and leaves nothing for the
   * motion to be read against; `'basin'` is the gravity-like case and wants a figure that enters from
   * above, which a three-axis tumble is not.
   *
   * ⚠️ **`fieldDecay: 0.995`, near the top of its 0.95–0.999 range.** This is the wake LENGTH: the field
   * is what remembers where the band has been, so a low value means the disturbance dies the instant it
   * passes and the pool looks merely jittery. It is deliberately NOT 0.999 — that decouples the pool
   * from its cause entirely (the field never forgets, so the motion stops corresponding to the figure)
   * and the slider's own top stop is excluded for that reason.
   *
   * `fieldCoupling: 0.5` is `DEFAULT_LIQUID_FIELD_CONFIG`'s own value, written out because this is the
   * preset the step is judged on and a field arriving from a default cannot be read off the preset.
   * ⚠️ **It is NOT `fluidAdvection.blend`** and cannot be implemented as it — `blend > 0` also gates
   * `advectParticles`, which would move the CURVE and break relationship (B). See `liquid-pool.ts`.
   *
   * `poolSize: 20000` is `LiquidPool.MAX_PARTICLES`, i.e. the whole budget. The pool is what the preset
   * is for, and at 20 000 the five blobs read as bodies of liquid rather than as sparse spray.
   */
  'Liquid Field Pool': {
    metadata: { name: 'Liquid Field Pool', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'liquid', 'liquid-field', 'review'] },
    generators: {
      // `Rotating Band`'s wave table — see the doc block for why swept area, not displacement per frame,
      // chose it, and why the count is load-bearing. 4000 is a quarter of the legacy preset's own 10 000.
      // ⚠️ `rotation` AND `angle` are both [0.5, 0.5, 0.5]: the three-axis tumble IS the swept area.
      type: 'lissajous', particleCount: 4000, waveSpeed: 0.05,
      rotation: [0.5, 0.5, 0.5], angle: [0.5, 0.5, 0.5],
      waves: rotatingBandWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.4, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      // OFF, and here for TWO reasons — see the group banner: the silhouette, and style 6 sharing the
      // pool's own velocity field.
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      // The band should fold, not race: at 1.0 the ribbon turns over faster than the pool can respond
      // and the stir degenerates into uniform agitation.
      speedFactor: 0.7,
      liquid: {
        // ⚠️ RE-TUNED FOR THE ELABORATE FIGURE — 4x `Liquid Surface`'s inherited 0.5, because a woven
        // ribbon has wider index spacing and a lower `isoRef`, so it fattens into a solid mass at the
        // threshold a thin bar needed. See the doc block's iso time series. Both are exact track stops.
        isoLevel: 2.0, kernelWidth: 2.0,
        edgeSoftness: 0.15,
        // `'ramp'` + `'liquid'`: the pool has no per-particle identity worth showing (it is seeded
        // uniformly), so thickness IS the only meaningful variation and the ramp is what reads it.
        tintSource: 'ramp', surfaceRamp: 'liquid',
        colourMix: 0.85, mixModel: 'light',
        refraction: 0.25, specular: 0.8, thickness: 0.5, edgeBrightness: 0.6,
      },
      liquidField: {
        enabled: true,
        poolSize: 20000,
        seedPattern: 'blobs',
        fieldCoupling: 0.5,
        fieldDecay: 0.995,
      },
    },
  },

  /**
   * **v8 Step 15.4 — Cohesion.** Relationship (A) at its limit: the figure stops being a curve and
   * becomes a population of DROPS that collide and fuse.
   *
   * Cohesion pulls each particle toward the centre of mass of its neighbourhood and integrates the pull
   * into a persistent positional offset, with a spring back to the mathematical curve. ⚠️ **It is a
   * GENERATOR block, so it beads in every render mode — but only `liquid` makes the drops FUSE**, which
   * is why this demo is in liquid mode rather than in the mode that shows the beading most cheaply.
   *
   * ⚠️ **THE FIGURE WAS REPLACED BECAUSE IT WAS `Liquid Surface`'S.** The first version used `Phantasy
   * Spiral`, whose wave table is byte-identical to `quaderWaves()` (measured — they are the only two of
   * the 177 that share a table, differing solely in rotation), and the doc block argued the shared figure
   * was a feature: a controlled side-by-side where beading is the only variable. ⚠️ **That argument was
   * overruled and the reasoning generalises — in a 360-preset grid a demo competes against its
   * neighbours, and two adjacent tiles that look the same read as a duplicate, not as a comparison.** The
   * replacement is `The Masters Light`: a different silhouette (a tilted textured plate against a
   * spiral), a different motion (`angle: [30, 30, 0]` with NO rotation against a z-spin), a different
   * design box and a different colour — see `mastersLightWaves()` for the selection measurement.
   *
   * ⚠️ **THE FIGURE WAS CHOSEN ON THE COHESION-OFF ROW, WHICH IS THE HARD HALF.** Cohesion reads as *"the
   * sheet broke into drops"*, so the unbeaded figure must be ONE UNBROKEN BODY at every instant or the
   * drops look like the figure's own structure. Measured at N = 12 000, kw 2.52 / iso 0.3536, at
   * t = 5 / 10 / 20 / 30 / 45 s:
   *
   *     cohesion 0.85    45 / 39 / 123 / 131 / 60 bodies,  median 296 – 556 px       <- authored
   *     cohesion 0        1 /  1 /   1 /   1 /  1 body,    median 119 655 – 186 889 px
   *
   * One body of 120 000–187 000 px against dozens of ~400: sustained at all five instants, which is what
   * `Spiritual`, `Galaxy` and `Time Vortex II` each fail (every one of them breaks into multiple bodies
   * at some instant with cohesion OFF, inverting the reading). `Pipes` was rejected earlier on the
   * off-screen fraction — it beads well but measures **7.2 % off screen at t = 12 s rising to 12.0 % at
   * t = 25 s**, extent 1116x1011 against a 1024x768 canvas, and on a fullscreen surface pass a clipped
   * particle still deposits density at the frame edge.
   *
   * ⚠️ **`strength: 0.85`, above the earlier 0.6, and the reason is the DROP COUNT'S STABILITY rather
   * than its peak.** On this figure 0.6 gives 19–71 bodies over the same series and 1.0 gives 53–188; at
   * 0.85 the count is 39–131 with a median drop of 296–556 px, which is the band where a drop is big
   * enough to read as a drop and small enough that there are many. ⚠️ **`strength: 0` is byte-identical
   * to no cohesion**, so this number is the whole feature.
   *
   * ⚠️ **`particleCount: 12000`, below the figure's own authored 15 000 and NOT a retune of it.** Cohesion
   * concentrates the population into drops, so local density inside a drop is far above the curve's — at
   * 15 000 the drops merge back into fewer, larger bodies and the count of DROPS, which is the reading,
   * falls. Index spacing is 2.52 px at 12 000 against 2.02 px at 15 000.
   *
   * ⚠️ **`radius: 12.1` IS THE DROP-SIZE CONTROL, and it is an exact stop on the log track — the round
   * 12 is NOT.** Measured on the earlier figure at 15 000: r = 4 / 8 / 16 / 24 / 40 / 64 gives 101 / 173
   * / 103 / 66 / 30 / 4 bodies of median 55 / 52 / 53 / 87 / 207 / 1085 px. Tightened from the default 16
   * because this figure's fine lattice supports smaller drops: at 16 the plate breaks into 39–131 large
   * bodies, at 12.1 into more of them with the same median, so the beading reads across the whole plate
   * rather than only at its folds.
   *
   * ⚠️ **`returnForce: 2.5` is the step's CORRECTNESS CONDITION, not a refinement.** With no spring the
   * drops keep coalescing (measured at strength 1 / radius 24 over 90 s: mean offset plateaus at 47.9 px
   * with the population pinned against the internal cap) and the figure collapses toward a single ball —
   * i.e. the trajectory identity every one of the 177 presets exists to express is simply gone. It is
   * above `DEFAULT_COHESION_CONFIG`'s 1.5 because `strength` is above the default too: the spring has to
   * match the pull it opposes, and at 1.5 against 0.85 the plate's outline softens over 45 s. At 2.5 the
   * extent holds and the drop count keeps oscillating with the figure's own breathing. ⚠️ **That
   * oscillation is the FIGURE's pulsation, not a cohesion divergence** — it is present with cohesion off.
   *
   * ⚠️ **`kernelWidth: 2.52` / `isoLevel: 0.3536` — WIDER AND LOWER than `Liquid Surface`'s pair, and
   * that is what makes the fusing visible rather than just the beading.** A drop is a tight cluster, so
   * at a narrow kernel each drop is its own island and nothing ever touches; widening the kernel and
   * dropping the threshold puts neighbouring drops just inside each other's reach, so they merge and
   * separate as the figure breathes. Both are exact track stops.
   */
  'Liquid Cohesion Beads': {
    metadata: { name: 'Liquid Cohesion Beads', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'liquid', 'cohesion', 'review'] },
    generators: {
      // `The Masters Light`'s wave table at 12 000 of its authored 15 000 — see the doc block. ⚠️ NO
      // rotation: `angle: [30, 30, 0]` is a fixed pose, which is what presents the 666-deep plate tilted
      // rather than edge-on, and it is half of what differentiates this tile from `Liquid Surface`.
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [30, 30, 0],
      waves: mastersLightWaves(),
      colorBase: [21, 21, 21], colorAmp: [64, 32, 32], colorFreq: [0, 0.1, 1], colorShift: [1, 2, 3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.35, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      // Slow: drops must be seen COLLIDING. At 1.0 the beading is there and reads as boiling.
      speedFactor: 0.5,
      liquid: {
        // ⚠️ Wider and lower than `Liquid Surface` ON PURPOSE — a drop is a tight cluster and needs a
        // wider kernel to reach its neighbour at all. Both are exact stops on their log tracks.
        isoLevel: 0.3536, kernelWidth: 2.52,
        edgeSoftness: 0.15,
        tintSource: 'ramp', surfaceRamp: 'liquid',
        colourMix: 0.85, mixModel: 'light',
        refraction: 0.25, specular: 0.8, thickness: 0.5, edgeBrightness: 0.6,
      },
      cohesion: {
        // ⚠️ All three are OFF the defaults, and they move TOGETHER — see the doc block. `strength: 0` is
        // byte-identical to no cohesion; `radius` is an exact stop on the log track (the round 12 is not);
        // `returnForce` is raised to match the stronger pull it opposes, not tuned independently.
        strength: 0.85,
        radius: 12.1,
        returnForce: 2.5,
      },
    },
  },

  /**
   * **v8 Step 15.7 — the Dye Field.** A colour field the figure DEPOSITS into and the velocity field
   * then carries, resolved as the liquid surface's albedo. The only Phase 15 subsystem that adds a new
   * colour channel rather than a new positional one.
   *
   * ⚠️ **THE FEATURE NEEDS THREE THINGS TRUE AT ONCE AND ALL THREE ARE AUTHORED HERE, IN THIS ORDER:**
   * render mode `liquid` (nothing else reads the field), `liquid.tintSource: 'dye'` (the field is a tint
   * SOURCE, so it is inert under the other four), and `dye.enabled: true`. ⚠️ **This chain is why 15.7
   * read as inert on three separate passes** — each pass had two of the three and the missing one was a
   * gate one stage away from where the reading was taken. A preset that authors all three is the
   * cheapest possible statement of the chain, which is a large part of what this entry is for.
   *
   * ⚠️ **`colourSource: 'velocity'`, WHICH REVERSES THIS PRESET'S FIRST AUTHORING — and the reversal is
   * a correction to the STATISTIC the choice was made on, not a change of taste.** Reported by the user
   * as *"everything looks almost the same blue"*, and the report is exactly right. The surface resolves
   * the field as `rgb / a`, which is SCALE-INVARIANT, so the only thing a source can deliver is HUE
   * VARIATION ACROSS THE FIGURE — Amount, Decay, Radius and Advection are all divided out of the hue.
   * Measured on this figure at 600 frames, hue bins of 10° and circular variance weighted by saturation:
   *
   *     colourSource: 'depth'    (ramp `ice`)          2 bins    circVar 0.001     <- the reported defect
   *     colourSource: 'depth'    (ramp `liquid`)       6 bins    circVar 0.065
   *     colourSource: 'depth'    (ramp `fire-phase`)   1 bin     circVar 0.000
   *     colourSource: 'velocity'                      36 bins    circVar 0.944
   *
   * ⚠️ **THE RAMP IS NOT THE LEVER, AND THAT IS THE WHOLE FINDING.** `ice` spans only 25° of hue, so it
   * looks like the culprit — but swapping in `fire-phase`, which spans **352°**, gives ONE bin. The cause
   * is upstream of the ramp: `'depth'` indexes it with `state.depths`, and **this figure's depth span
   * (P90 − P10) collapses to 0.072**, about 7 % of the ramp, so a 352° ramp contributes 25° of it. A wide
   * ramp cannot rescue a narrow index. ⚠️ **Ask what RANGE OF THE INDEX the figure actually produces
   * before crediting a lookup table with variation.**
   *
   * ⚠️ **AND THE ORIGINAL MEASUREMENT WAS NOT WRONG, IT WAS TAKEN AT ONE INSTANT OF A TIME-VARYING
   * QUANTITY.** This block used to record `Cosmos Energy`'s depth span as 0.362 and choose the figure on
   * it. Re-measured across time: **0.364 at t = 3 s, then 0.072 / 0.070 / 0.133 / 0.102 at t = 10 / 20 /
   * 30 / 45 s.** The figure settles into a shell that is nearly depth-flat, so the reading was true for
   * the first three seconds of a preset that runs indefinitely. ⚠️ **A statistic sampled once cannot
   * distinguish a figure's steady state from its transient — sample a figure's selection statistic at
   * SEVERAL instants, and prefer the steady state, because that is what the viewer looks at.**
   *
   * ⚠️ **So `main.ts`'s `resolveDyeColours` doc block and `CLAUDE.md`'s dye row are BOTH half-falsified
   * where they say `'velocity'` is "visibility-less" and warn against restoring it.** The general
   * argument still holds — `'velocity'` multiplies `state.colors` by `k = 0.35 + 0.65·min(1, |v|/6)`, so
   * it can only DIM, and on a figure whose own colour is dark it does read as the figure going black.
   * What was missing is that the argument is CONDITIONAL ON THE FIGURE: here `colorBase`/`colorAmp` are
   * 128/128/128 with `colorFreq` 1/1/1, a full-range bright cycle, so `k` lands on colours with plenty of
   * headroom and the dimming becomes the variation. ⚠️ **The defect was never "the wrong source", it was
   * the PAIRING of a depth-flat figure with a narrow-hue ramp; a source is not good or bad independently
   * of the figure it samples.** Neither the earlier default nor this one generalises — **re-measure the
   * hue on the figure at hand.**
   *
   * ⚠️ **`Cosmos Energy` is nonetheless KEPT, because the off-screen half of its selection still holds**
   * and that half is unconditional: extent 480x746 at N = 10 000, **0.00 % off screen**. `Aurora
   * Borealis` has the library's widest depth span at 0.473 and was rejected outright — **38.7 % of its
   * population is off screen** at 1024x768 (extent 2345x905); `Time Vortex` clips 17 %. On a fullscreen
   * surface pass a clipped particle still deposits dye at the frame edge, so a wide-but-clipped figure
   * paints the border rather than the body. Under `'velocity'` the depth span is simply not read.
   *
   * Structurally the figure is one wave with `fm.amplitude` 16 / 16 / 64 — heavy frequency modulation on
   * all three axes, so the curve sweeps through a wide velocity range. ⚠️ **Motion is not optional
   * here**: advection is the whole mechanism, and a still figure deposits a dye field that never moves
   * and reads as a flat recolour.
   *
   * ⚠️ **`particleCount: 10000`, above `Cosmos Energy`'s authored 3200.** The dye deposit is per particle
   * per frame, so at 3200 the field takes several seconds to reach a legible saturation and the wake is
   * thin. At 10 000 the deposit rate matches `decayRate: 0.995`'s persistence within about a second.
   *
   * ⚠️ **`decayRate: 0.964` IS A SURVIVAL FRACTION IN SPITE OF THE NAME** — 0.995 fades slowly, 0.90
   * fast. The name is frozen for import compatibility (`DyeFieldConfig`'s own warning). It is a per-frame
   * multiplier with **no `dt`**, matching the advect shader's own convention.
   *
   * ⚠️ **AND IT IS A HUE CONTROL AS WELL AS A LIFETIME — WHICH IS WHY IT CAME DOWN FROM 0.995.** The two
   * roles pull in OPPOSITE directions and nothing names the second: a wake wants a long life, but the hue
   * read `rgb / a` is a MEAN over every deposit a pixel ever received, so the longer the field lives the
   * more frames it averages and the more the hue regresses to one colour. Measured (steady-state
   * multiplier `1/(1−d)`, half-life, then hue):
   *
   *     0.999   1000x   11.55 s    circVar 0.839    screenSat 0.971
   *     0.995    200x    2.30 s    circVar 0.874    screenSat 0.934    <- the first authoring
   *     0.990    100x    1.15 s    circVar 0.899    screenSat 0.777
   *     0.964     28x    0.32 s    circVar 0.944    screenSat 0.848    <- authored
   *     0.950     20x    0.23 s    circVar 0.961    screenSat 0.926
   *
   * 0.964 is the user's own reference file's value and sits at the knee: below it the gain in hue is small
   * and the wake starts to shorten toward a halo. ⚠️ **When one field has two roles, MEASURE BOTH — the
   * old value was chosen on lifetime alone and was the better value for that role in isolation.**
   *
   * ⚠️ **`advectionStrength: 1.5`, above the default 1.0.** It scales a UV DISPLACEMENT PER 60 Hz FRAME,
   * not a velocity, so no `dt` enters the advect shader. Above the default because this figure's own
   * velocity field is moderate; the dye should visibly LEAD the figure rather than sit on it.
   *
   * ⚠️ **`injectionRadius: 38`, above the default 12, and the unit is CANVAS PIXELS on a fixed 512²
   * field.** The conversion divides by `min(w, h)` — never per axis (invariant 26) — so at 1024x768 the
   * 38 px here is about 25 field pixels. The old 1–8 range deposited a near-invisible speck; a wide radius
   * gives overlapping deposits along the curve, which is what makes the wake continuous instead of a
   * dotted line.
   *
   * ⚠️ **`opacity: 1.0`, NOT the 0.5 default, and 0.5 was leaving a third of the effect unused.** It is
   * the per-particle DEPOSIT WEIGHT, not a composite opacity — the dye IS the surface's albedo under
   * `tintSource: 'dye'`. **The weight reaches the screen as a SATURATION via `DYE_SATURATION_K`, because
   * the hue read (`rgb / a`) divides every slider out**: `sat = 1 − exp(−a · 0.02)`, so at 100 accumulated
   * deposits 0.5 gives 0.632 and 1.0 gives 0.865. ⚠️ **A field whose only visible output is saturation
   * should not be authored at half weight** — there is no second channel for the other half to reach. And
   * ⚠️ **`'dye'` is the one `LiquidTintSource` EXEMPT from `colourMix`** (the row labelled **`Figure
   * Colour`** since 15.9a; it was `Colour Mix` before, and the KEY never changed) — at `colourMix: 0.85` the
   * un-exempt `mix()` replaced 85 % of it, which is what made it unusable at its own default. The
   * `colourMix: 0.85` below is therefore INERT on this preset by design and is written out only so the
   * exemption is visible where someone would look for it.
   *
   * `fixedColour` is `DEFAULT_DYE_CONFIG`'s own value and is unread under `colourSource: 'depth'`; it is
   * present because the block must be complete, and it is spread as a fresh array at every construction
   * site because it is the FIRST reference type in any Phase 15 block.
   *
   * ⚠️ **THE WAKE IS COMPOSITED OUTSIDE THE ISO SURFACE** (`wakeA = (1 − cover) · dyeA`, an algebraic
   * identity for the other four sources), which is why the dye is visible where the figure is NOT — the
   * pass used to `discard` everywhere the figure is absent, and there is no density behind a moving
   * figure, so a wake was structurally undrawable. `kernelWidth: 1.78` / `isoLevel: 0.5946` keeps the
   * body a single coherent shape (measured 1 body at every sampled instant) precisely so the wake has an
   * unambiguous silhouette to trail from. Both are exact stops.
   */
  'Dye Wake': {
    metadata: { name: 'Dye Wake', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'liquid', 'dye', 'review'] },
    generators: {
      // `Cosmos Energy`'s table at 3x its authored count — see the doc block for the deposit-rate reason.
      type: 'lissajous', particleCount: 10000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: cosmosWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.4, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      // Motion is the mechanism — see the doc block. Full speed, and the only one of the four demos not
      // slowed down.
      speedFactor: 1.0,
      liquid: {
        // Chosen to keep the body ONE shape so the wake has an unambiguous silhouette to trail from.
        isoLevel: 0.5946, kernelWidth: 1.78,
        edgeSoftness: 0.15,
        // ⚠️ Link 2 of the three-link chain. Under any other value this preset's `dye` block is inert.
        tintSource: 'dye', surfaceRamp: 'liquid',
        // ⚠️ INERT HERE BY DESIGN — `'dye'` is the one source exempt from `colourMix` (`Figure Colour`). Written out so the
        // exemption is visible at the site someone would check.
        colourMix: 0.85, mixModel: 'light',
        refraction: 0.25, specular: 0.8, thickness: 0.5, edgeBrightness: 0.6,
      },
      dye: {
        // ⚠️ Link 3. Links 1 and 2 are `renderMode`/`renderer.mode` and `liquid.tintSource` above.
        enabled: true,
        // ⚠️ A SURVIVAL fraction despite the name — high fades SLOWLY. But it is ALSO a hue control, and
        // that is why it is no longer 0.995: the hue read is a MEAN over every deposit in the pixel, so a
        // long-lived field averages more frames and washes the hue out. Measured circVar by decay at
        // radius 38: 0.999 → 0.839, 0.995 → 0.874, 0.990 → 0.899, 0.964 → 0.944, 0.950 → 0.961.
        decayRate: 0.964,
        // ⚠️ 1.0, not the 0.5 default — the deposit weight reaches the screen ONLY as a saturation
        // (`DYE_SATURATION_K`), so 0.5 capped the dye at 0.632 of full saturation for free.
        opacity: 1.0,
        // ⚠️ `'velocity'`, and the doc block above says WHY this reverses the earlier default.
        colourSource: 'velocity',
        // Unread under `'velocity'`; a fresh array literal because this is the first reference type in any
        // Phase 15 block and a shared one would be aliased by the Mixer and the snapshot.
        fixedColour: [1, 0.35, 0.1],
        // 38 px on a 512² field converted by `min(w, h)` — about 25 field px at 1024x768. Wider than the
        // old 20 because the deposits must overlap ALONG the curve for the wake to be continuous.
        injectionRadius: 38,
        advectionStrength: 1.5,
      },
    },
  },

  /**
   * **The `palette` dye source (2026-10-16) — `Dye Wake` with ONE field changed, and the pair IS the demo.**
   *
   * ⚠️ **IT EXISTS BECAUSE THE PALETTE DROPDOWN CONTROLLED NOTHING UNDER `tintSource: 'dye'`**, which was an
   * owner report, not a tidy-up: the surface's palette branch is `uTintSource == 1` (not taken), `uRamp`
   * resolves to `surfaceRamp` (never a palette), and `colourMix` is forced to 0 for dye (so the per-particle
   * route is closed too). Three routes, all shut — see `DyeFieldConfig.colourSource`, which owns the
   * write-up. `'palette'` is the fifth source and reads the palette the user actually picked.
   *
   * ⚠️ **THE BODY IS THE OWNER'S OWN EXPORT, AND THE DIFF AGAINST `Dye Wake` WAS MEASURED RATHER THAN READ**
   * (`Dye Wake_20261015_172153.json`, confirmed by use before it was adopted). Flattened and compared field
   * by field against the shipped body, the export differed in **25 keys and exactly 3 of them are authored
   * intent** — `dye.colourSource` `'velocity'` → `'palette'`, plus `palette` and `paletteMapping`. The other
   * 22 are runtime-default noise the export gate emits (`curlNoise` disabled at its defaults, `physarum` at
   * blend 0, `fluidAdvection` at blend 0, `ribbonMode: 'off'`, `transMapStyle: 0`, `figureScale: 1`,
   * `attractorIndex: -1` with an inert `attractorBlend`, …). ⚠️ **That ratio is why the engine's rule is to
   * diff an export programmatically against the defaults instead of reading it** — eyeballing this file would
   * have adopted two dozen keys that say only what the preset is NOT.
   *
   * ⚠️ **A SIBLING RATHER THAN A REPLACEMENT, and `Dye Wake`'s own write-up is the reason.** That body's
   * `colourSource: 'velocity'` is a MEASURED reversal of its first authoring (36 hue bins, circular variance
   * 0.944, against 2 bins / 0.001 for `'depth'` on the `ice` ramp), and overwriting it would delete that
   * measurement to gain nothing — `'velocity'` would still need a carrier. Keeping both also makes the
   * cleanest possible demo: **two bodies one field apart, so switching between the tiles isolates the source
   * and nothing else.**
   *
   * ⚠️ **`paletteMapping` IS INERT HERE AND IS KEPT ANYWAY**, exactly as `Dye Wake` keeps its inert
   * `colourMix` and for the same reason — it is written out at the site someone would check. The new source
   * reads the RESOLVED palette's LUT directly by depth, so it is mapping-independent; under this tint source
   * nothing else reads the mapping either (the point/splat shaders are not drawing in `liquid` mode, ribbon
   * and neon are off). It stays because it is in the owner's confirmed body, not because it does anything.
   *
   * ⚠️ **`opacity: 1.0` SATURATES THE BODY, SO THIS DEMO SHOWS THE WAKE RATHER THAN THE BLEND.** `dyeA` is
   * `1 − exp(−alpha · 0.02)` and at this deposit weight it reaches ~1 over most of the figure, so
   * `surfaceRamp: 'liquid'` contributes only at thin rims. **That is the owner's confirmed value and is NOT
   * retuned here** — a lower `Dye Amount` is how a user sees ramp and dye as two colours, and the Visual FX
   * tooltip is where that belongs, not in a second body.
   */
  'Dye Palette Wake': {
    metadata: { name: 'Dye Palette Wake', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'liquid', 'dye', 'palette', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 10000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: cosmosWaves(),
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.4, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      speedFactor: 1.0,
      // ⚠️ **THE ONE FIELD THIS DEMO IS ABOUT, and it is authored HERE rather than inside the look** — the
      // pair has two sources (`overlay.palette` and the film look's bundle) and `palette-selection.ts` is
      // their one resolver, so an override on the overlay is the grading-free way to name a palette.
      // `'Neon'` against `surfaceRamp: 'liquid'` is a deliberate contrast: the wake and the body do not
      // agree, which is the whole thing the source makes possible.
      palette: 'Neon',
      // Inert under this tint source — see the doc block's own paragraph on it.
      paletteMapping: 'depth',
      liquid: {
        isoLevel: 0.5946, kernelWidth: 1.78,
        edgeSoftness: 0.15,
        tintSource: 'dye', surfaceRamp: 'liquid',
        // ⚠️ INERT, as in `Dye Wake` — `'dye'` is the one source exempt from `colourMix` (`Figure Colour`).
        colourMix: 0.85, mixModel: 'light',
        refraction: 0.25, specular: 0.8, thickness: 0.5, edgeBrightness: 0.6,
      },
      dye: {
        enabled: true,
        decayRate: 0.964,
        opacity: 1.0,
        // ⚠️ **THE MEMBER THIS BODY CARRIES**, and the only field that differs from `Dye Wake`'s dye block.
        colourSource: 'palette',
        // Unread under `'palette'`; a fresh array literal, never a shared one — the Mixer and the snapshot
        // would alias it (the rule `Dye Wake` states at the same field).
        fixedColour: [1, 0.35, 0.1],
        injectionRadius: 38,
        advectionStrength: 1.5,
      },
    },
  },

  /**
   * **v8 Step 15.2 — the `pigment` colour model, on a FLAT figure.** The second surface demo, and it is
   * on the axis `Liquid Surface` leaves at its default rather than being a variation of its look.
   *
   * ⚠️ **`mixModel: 'pigment'` had NO demo before this entry.** 15.2 shipped two models and every liquid
   * preset in the library authors `'light'`, so half of a categorical switch was unreachable by picking a
   * preset. `'light'` is what additive rendering does — two overlapping colours get brighter. `'pigment'`
   * is subtractive: it counts effective layers as `clamp(1 + 0.6·log2(max(wSum, 1)), 1, 3)` and absorbs
   * through them, so two overlapping colours get DARKER and more saturated, the way paint does. On a
   * merging surface that is the difference between a glow and a body of ink.
   *
   * ⚠️ **WHAT `pigment` IS, EXACTLY — one line of shader, because the question "how is it special" has a
   * short answer and the answer bounds the whole feature.** Both models start from the SAME weighted
   * arithmetic mean of the particle colours that formed the pixel, `perParticle = cf.rgb / cf.a`.
   * `'light'` stops there. `'pigment'` raises it to a power: `pow(perParticle, vec3(n))` with
   * `n = clamp(1 + 0.6·log2(max(wSum, 1)), 1, 3)`, where `wSum` is the accumulated deposit weight — i.e.
   * **how many particle-layers deep the pixel is.** So: **`n = 1` exactly where one layer contributes,
   * rising to 3 in the deepest overlaps.** ⚠️ **It is therefore an IDENTITY on the thin rim and acts ONLY
   * on the overlaps** — that is the signature to look for, a body whose edges match `'light'` and whose
   * interior deepens, not a global colour change.
   *
   * ⚠️ **AND WHAT IT IS NOT, so nobody looks for it: `pigment` CANNOT SHIFT HUE.** Real subtractive
   * mixing turns yellow over blue into GREEN; `c^n` moves each channel independently and can only
   * darken toward the colour's own dominant channel. Measured mean hue rotation across the surface: **2–7
   * degrees.** This is a hard structural bound, not a tuning gap — a transmittance product needs
   * `sum(w · log c)`, and there is exactly ONE accumulation target whose three channels already hold
   * `sum(w · c)` and whose alpha already holds `sum(w)`. ⚠️ **A future step wanting hue-shifting
   * subtraction must add a SECOND colour target; do not attempt it by reweighting this one.**
   *
   * ⚠️ **The figure is FLAT, and this is the one demo in the set where that is the point.** `Montezuma
   * Looks at You` has an all-zero z axis on all three waves, so its measured z-span is exactly 0.0 —
   * structural, not a measurement that could drift. A flat figure is the right choice here for a reason
   * specific to this model: `'pigment'`'s absorption reads as depth THROUGH the sheet, and on a 3D
   * figure that signal is confounded with actual depth ordering. Face-on, every darkening is the model's.
   *
   * ⚠️ **`particleCount: 20000` and this figure was chosen over every other flat one on INDEX SPACING —
   * 5.45 px at 20 000, against `Quader`'s 2.06 at 15 000 and `Cylinder`'s 0.50 at 10 000.** A flat figure
   * concentrates its whole population into one plane, so almost every flat candidate collapses to
   * sub-pixel spacing and its summed field has no gaps for a threshold to find. This is the widest-spaced
   * flat figure in the library, and it is what makes the iso sweep mean anything here.
   *
   * ⚠️ **THE BLOB COUNT IS NOT STABLE IN TIME, AND THAT IS THE AUTHORED EFFECT RATHER THAN A DEFECT TO
   * TUNE OUT.** The three waves sit on FM bases 101 / 100 / 99, so the lattices beat against each other
   * and the figure's own spacing drifts — which sweeps it through the merge transition on its own.
   * Measured at the authored pair (kw 1.48 / iso 1.0), spacing rising 5.45 → 7.72 px:
   *
   *     t =  3 s    89 bodies, median     74 px     coverage 33.3 %
   *     t =  5 s     2 bodies, median 35 813 px     coverage 31.2 %
   *     t =  8 s     2 bodies, median 28 646 px     coverage 28.6 %
   *     t = 15 s     1 body,   median 312 097 px    coverage 39.7 %
   *
   * So the sheet condenses from a stipple into a single pane over about fifteen seconds and stays there.
   * That is the merge transition happening WITHOUT ANYONE TOUCHING A SLIDER, which no other preset in the
   * library shows — it is why this figure earned the slot over the stable candidates, and it is stated
   * here so a reader does not "fix" it into a fixed look. ⚠️ **Judging this preset from one screenshot
   * will give a different verdict depending on when the screenshot was taken. Watch it for 20 s.**
   *
   * ⚠️ **`kernelWidth: 1.48` / `isoLevel: 1.0` — and the narrower 1.2 was rejected for a specific
   * reason.** At kw 1.2 the same figure holds 452 → 53 → 2 → 201 → 210 bodies of median 89 → 54 → 16 053
   * → 110 → 67 px over the same series: it never settles, oscillating between stipple and pane
   * indefinitely. That is more dramatic and less legible — the sheet never becomes a sheet. 1.48
   * completes the transition once and holds. `isoLevel: 1.0` is `DEFAULT_LIQUID_CONFIG`'s own value and
   * is exactly reachable; both are exact stops.
   *
   * ⚠️ **`tintSource: 'preset'`, the only demo here that uses it, and it is `DEFAULT_LIQUID_CONFIG`'s
   * default.** Under `'ramp'` the surface is coloured by THICKNESS, which is the same signal
   * `'pigment'`'s absorption is modulating — the two would be reading the same quantity twice and the
   * model's contribution would be unreadable. `'preset'` routes the figure's own authored colour through
   * the weighted per-particle mean, so the darkening the model adds is separable from the colour it acts
   * on.
   *
   * ⚠️ **WHICH MAKES `colorBase`/`colorAmp` PART OF THE MECHANISM, AND THE FIRST AUTHORING PUT THEM WHERE
   * THE MODEL COULD NOT BE SEEN.** Reported by the user as `pigment` being *"not really clear… unclear in
   * what sense pigment makes it special"* — and the model was running the whole time (mean
   * `|light − pigment|` 0.126–0.175, `n > 1` on 63–72 % of the surface). It was **illegible, not inert.**
   * `c^n` deepens a colour by pulling its channels apart, so its visible signature is a SATURATION GAIN —
   * and saturation is `1 − min/max`, which cannot rise once `min` is already ~0. The old `colorBase`
   * 32/64/128 / `colorAmp` 64/64/128 drove the surface to **saturation 0.998 with a minimum channel of
   * 0.003**: already at the ceiling. Measured thin→thick, at kw 1.48 / iso 1.0:
   *
   *     colorBase / colorAmp        min channel    saturation gain    value drop
   *     32/64/128  64/64/128 (old)      0.003          +0.002           0.076     <- the reported defect
   *     96/56/8    56/48/40             0.064          +0.192           0.211
   *     104/88/64  48/56/72             0.164          +0.240           0.279
   *     120/96/72  40/48/64  (authored) 0.221          +0.284           0.280
   *
   * ⚠️ **THE MINIMUM CHANNEL IS THE STATISTIC, AND IT IS NOT THE ONE ANYONE WOULD PICK.** A saturated
   * colour looks like the right choice for showing off a colour model and is precisely the wrong one: it
   * spends the headroom the model needs before the model runs. **A desaturated base is what gives `c^n`
   * somewhere to go** — hence a sand/ochre rather than the blue-violet. ⚠️ **Ask what QUANTITY a model
   * outputs and whether the preset has left any range in it** (invariant 13's harder form: the control
   * moved exactly the right thing and the output channel was saturated).
   *
   * ⚠️ **Widening the kernel does NOT substitute for this.** kw 1.78 / iso 0.7071 and kw 2.0 / iso 0.5 were
   * both measured on the OLD colours: the gain stays +0.002. More overlap raises `n`, but `n` acting on a
   * colour at saturation 0.998 still has nowhere to move it. **Fix the quantity that is clamped, not the
   * one that feeds it.**
   *
   * ⚠️ **`colourMix: 1.0`, the one value in this block that is neither a default nor a track snap.** The
   * mix is how far the surface colour comes from the particles that formed each pixel rather than from
   * `tintSource`, and `mixModel` governs HOW those particle colours combine — so at the 0.85 default,
   * 15 % of every pixel bypasses the model entirely. At 1.0 the model owns the whole colour and the
   * `light` / `pigment` switch is at its full contrast, which is what this preset exists to show.
   *
   * ⚠️ **`thickness: 1.2`, above the default 0.5.** Beer–Lambert absorption in nepers per unit
   * thickness — the term `'pigment'` is subtractive THROUGH. At the default the sheet is thin enough
   * that the two models look nearly alike; 1.2 is where the overlaps go visibly dark. `refraction`,
   * `specular` and `edgeBrightness` are left at their defaults so absorption is the only 15.3 term
   * moving.
   *
   * `rotation: [0, 0, 0]` — `Montezuma`'s own, and free: there is no third dimension to tumble. Design
   * box 100x100, and ⚠️ shrinking it clips (85x85 → 1.33 %, 75x75 → 4.63 % off screen).
   */
  'Pigment Sheet': {
    metadata: { name: 'Pigment Sheet', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'liquid', 'colour-mix', 'review'] },
    generators: {
      // `Montezuma Looks at You` — genuinely planar, and the widest-spaced flat figure in the library.
      type: 'lissajous', particleCount: 20000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: montezumaWaves(),
      // ⚠️ A DESATURATED SAND, AND THE COLOUR IS WHAT MAKES `pigment` VISIBLE AT ALL — see the doc block.
      // The old 32/64/128 amp 64/64/128 drove the surface to saturation 0.998, where `c^n` has nothing
      // left to saturate: it delivered +0.002. These keep the minimum channel at 0.221 and deliver +0.284.
      colorBase: [120, 96, 72], colorAmp: [40, 48, 64], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.5, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      // Slow, because the beat between the three lattices IS the effect and it needs time to be seen.
      speedFactor: 0.6,
      liquid: {
        // 1.48 completes the self-driven merge transition ONCE and holds; 1.2 oscillates forever. Both
        // are exact stops; `isoLevel: 1.0` is also `DEFAULT_LIQUID_CONFIG`'s own value.
        isoLevel: 1.0, kernelWidth: 1.48,
        edgeSoftness: 0.15,
        // ⚠️ `'preset'` rather than `'ramp'` on purpose: a thickness ramp would read the same quantity
        // `pigment`'s absorption is modulating, and the model's contribution would be unreadable.
        tintSource: 'preset', surfaceRamp: 'liquid',
        // ⚠️ THE POINT OF THIS PRESET. `'pigment'` had no demo before this entry, and at the 0.85 default
        // 15 % of every pixel bypasses the model — so the mix goes to 1.0 to put the switch at full
        // contrast.
        colourMix: 1.0, mixModel: 'pigment',
        // Only `thickness` moves off its default: it is the absorption term `pigment` is subtractive
        // THROUGH, so it is the one 15.3 field that changes what the model does rather than what the
        // surface looks like.
        refraction: 0.25, specular: 0.8, thickness: 1.2, edgeBrightness: 0.6,
      },
    },
  },

  /**
   * **`Physarum Flower` - the first preset in the library to ENABLE physarum.** Added 2026-09-04,
   * **REWRITTEN the same day after its first review**, which is recorded here because the rewrite's three
   * causes are all reusable and one of them was a false premise in this very banner.
   *
   * ⚠️ **It shipped for part of one sitting as `Slime Network` and was renamed by the user on 2026-09-04.**
   * The old name is recorded ONLY so this banner's own review history reads straight - it is not an alias.
   * A preset NAME IS A PRIMARY KEY IN FIVE OWNERS, so the key and `metadata.name` were moved together and
   * nothing else in `src/` or `public/` ever referenced it. ⚠️ **The name is NOT the donor figure's**:
   * `Flower Power` is the legacy Lissajous body this preset borrows, `Physarum Flower` is this preset, and
   * `flowerWaves()` is the shared helper - three similar names for three different things.
   *
   * WARNING: **The whole library authored physarum and left it OFF.** Measured by importing the seven TS
   * groups and walking every nested object: **29 presets carry an `overlay.physarum` block and all 29 have
   * `blend: 0`**, `DEFAULT_PHYSARUM.blend` is `0` (`main.ts:669`), and the 177 legacy JSON entries do not
   * mention physarum at all. WARNING: **The gate is `blend > 0` (`physarum.ts:139` - `isActive()`), NOT an
   * `enabled` flag: `PhysarumConfig` HAS NO `enabled` FIELD.** A census greping for `enabled: true` returns
   * zero for every possible library, so it measures nothing - the same trap as invariant 13's dead field.
   *
   * ## WARNING: THE FIRST VERSION FAILED REVIEW ON THREE COUNTS AND THE MEASUREMENTS ARE WHY
   *
   * It shipped `diffusionWaves()` at 4000 particles with `depositAmount: 0.06`. Reported as *not
   * attractive, slow to build up, confusing, and 90 % of the area simply black.* All three reproduce as
   * numbers, and **the third was the cause of the other two**:
   *
   *     figure                  instantaneous frame coverage   trail visible @ frame 10
   *     diffusionWaves (v1)                 0.8 %                       0.2 %
   *     flowerWaves (this one)             32.9 %                      18.0 %
   *
   * WARNING: **A FIELD SYSTEM CANNOT BE DEMONSTRATED ON A FIGURE THAT DOES NOT COVER THE FRAME.** Physarum
   * is a *spatial* effect - strands find each other only where deposits overlap - so the figure's coverage
   * is the precondition for the whole subsystem, not a matter of taste. At 0.8 % instantaneous coverage
   * there was no second strand within sensor range of the first, so the sensors read empty trail, the
   * steering degenerated to each particle's initial heading, and what reached the screen was a slow orange
   * smear. **The "90 % black" complaint was generous: it measured 97 %.**
   *
   * WARNING: **AND THIS BANNER'S OWN CENTRAL PREMISE WAS FALSE. v1 claimed a dense figure "saturates the
   * trail into one blob with no gradient" and chose a sparse figure to avoid it. Simulated over five
   * candidate figures, the dense ones saturate at `0.00 %` of cells while the SPARSE one was the only one
   * that saturated at all (0.21 %)** - because 4000 particles confined to 0.8 % of the frame pile into the
   * same cells, which is precisely the blob the premise feared. **The reasoning was not merely wrong, it
   * was backwards, and it is left here rather than deleted because it is the kind of plausible-mechanism
   * argument that reads as rigour.** Measure the figure; do not reason about the deposit.
   *
   * ## What the numbers say, at the shipped values
   *
   * `flowerWaves()` (legacy `Flower Power`) - a ten-petal rosette from wave 2's `am.frequency: 10` pair at
   * 18 deg phase offset, over a slow AM/FM-swept base. It won on **buildup speed and legibility together**,
   * measured against `Penta Star System` and `Mandala Tri` at identical physarum settings:
   *
   *     frame   10     20     40     90    180      (trail visible %, then filament %)
   *     Flower  18.0   24.7   36.9   57.3  62.8     filament 13.5 -> 4.6
   *     Penta    7.7   13.3   23.4   46.1  68.5     filament  8.3 -> 7.5
   *
   * **18 % of the frame carries visible trail within 10 frames - under 0.2 s - against v1's 0.2 %.** The
   * *filament* figure is the fraction of lit cells with an unlit 4-neighbour: high means strands, low means
   * fill. Flower starts highest, i.e. it reads as a network from the very first moment, which is what the
   * *"confusing"* half of the report was about - the effect has to be legible before it is dense.
   *
   * WARNING: **THE PARTICLES ARE COOL AND THE TRAIL IS WARM, AND THAT IS THE FIX FOR "CONFUSING".** v1
   * authored amber particles to HARMONISE with the trail, and so made the two populations
   * indistinguishable - you could not see which thing physarum was doing. `OVERLAY_FS`
   * (`physarum.ts:92`) is hardcoded `vec4(alpha, alpha * 0.65, alpha * 0.2, alpha)`, i.e. orange, until v8
   * Step 9.3 routes it through the ramp machinery. **So the figure is authored in blue-green to CONTRAST
   * with it:** cyan particles tracing the Lissajous curve, orange network spreading between them, and the
   * eye separates cause from effect immediately. WARNING: **This is the one place the unbuilt 9.3 is a
   * feature rather than a limitation - do not "fix" the colours to match, and do not pair physarum with a
   * warm ramp.**
   *
   * WARNING: **`decayRate` IS TWO QUANTITIES AND THE ARITHMETIC MAKES THEM ONE SLIDER.** It is the diffuse
   * pass's `u_decay` (`DIFFUSE_FS`: `blurred + prevTrail * (1 - u_decay)`) *and* the divisor of the steering
   * recurrence's steady state. **Lowering decay to lengthen the trail RAISES the displacement by the same
   * factor.** The displacement half of that is now
   * `sensorDistance / TRAIL_SIZE * blend / decayRate * canvasWidth` screen px — see the ADAPTED block below,
   * which replaced the `halfW` arithmetic this paragraph used to carry. Here:
   *
   *     22 / 512 * 0.08 / 0.06 * 1024 = 58.6 screen px steady displacement   (was documented as "29.3 px")
   *     0.08 / 0.06 = 1.33  -> still past DIFFUSE_FS's clamp, so strand CORES are still solid
   *     trail memory = 1/e at ~16 frames                        (long enough to read as a network)
   *
   * ## ⚠️ ADAPTED 2026-09-20 — the engine defect this entry used to disclaim was FIXED, and one value moved
   *
   * The 2026-09-20 correction note that used to sit here said the steering block's units were wrong, that this
   * preset's real displacement was ~225 px rather than 29.3, that the network reached the screen as a **13 %
   * scale copy of the figure, centred** (`trail/fig` **0.13**) with **33.4 %** of the population off frame —
   * and that **no value here would be changed**, because the owner had browser-confirmed the preset as it
   * stood. The owner has since asked for the opposite order: *"we should fix the functionality and then we can
   * adapt the impacted presets"*. **The engine fix is made** (`lissajous.ts`, the deposit/inverse block and
   * `perspectiveFactor()` — its ⚠️ header owns the full record), so the disclaimer is retired and this entry is
   * adapted to what the engine now draws.
   *
   * **What the fix changed for THIS preset, measured on one cadence (21 instants, 300→1500 f, every 60):**
   *
   *                              churnC (min, late/early)  move   lit%   strong%   tMed    off% max   trail/fig
   *     before the fix, as shipped    0.069 (0.025, 0.73)  62.5    0.8       0.6   1.000      33.4        0.13
   *     after the fix, same body      0.239 (0.132, 0.85)  44.2   45.7      25.1   0.205         4.5        1.04
   *     after the fix, deposit 0.08   0.240 (0.142, 0.85)  43.2   44.6       5.0   0.056         4.3        1.04
   *
   * **`tMed 1.000` is the whole reason a value had to move.** The trail was SATURATED: the old deposit landed
   * the entire population's worth of `0.30 / 0.06 = 5.0` equilibrium inside 0.8 % of the frame, so the median
   * lit texel sat pinned at the shader's clamp. With the network now spread across the figure it covers ~45 %
   * of the frame, and at the old deposit **25 % of the frame is brighter than half-alpha** — a bright wash, not
   * a web. **Both reference looks (this preset before the fix, and `Physarum Weave`) sit at `strong%` ≈ 0.6.**
   *
   * ⚠️ **`depositAmount: 0.30 → 0.08` is the ONE adapted value, and 0.08 rather than the brightness-parity
   * 0.04 because of the identity below it: `0.08 / 0.06 = 1.33` keeps the equilibrium PAST the clamp**, so the
   * solid-core claim in the next paragraph still holds; 0.04 would put it at 0.67, below the clamp, and turn
   * this preset into a second hazy `Physarum Weave`. Measured `strong%` across the sweep, with the dynamics
   * unaffected throughout (`churnC` 0.239–0.254, `move` 44): **0.30 → 25.1 · 0.15 → 13.6 · 0.08 → 5.0 ·
   * 0.04 → 1.0 · 0.02 → 0.1**. Nothing else in the body moved.
   *
   * ## ✅ OWNER-TUNED EXPORT, 2026-09-20 18:04 — the adapted body came back CONFIRMED, plus a grade
   *
   * The `'review'` tag was restored above because the 2026-09-04 confirmation had been given against a trail
   * that was a 13 % centred copy. **It is removed again, on a new pass rather than on the old one**: the owner
   * tuned this preset in the Lab against the FIXED engine and sent the export (*"We have reviewed more of the
   * finetuned presets and now adapt as follows: … Replace `Physarum Flower` by
   * `Physarum Flower_20260920_180450.json`"*). ⚠️ **That export outranks every derivation above it and nothing
   * here may be tuned back towards them.**
   *
   * ⚠️ **THE WHOLE `physarum` BLOCK CAME BACK BYTE-IDENTICAL, `depositAmount: 0.08` INCLUDED.** Diffed
   * leaf-by-leaf against the export programmatically (210 leaves, 1 changed, 45 export-only): the adaptation
   * measured out that morning is what the owner then ran and kept, which is the one kind of evidence a
   * derivation cannot manufacture for itself. The one CHANGED leaf is `filmLook`; **the 45 export-only ones are
   * 29 grading fields that come with it, 13 runtime defaults this body deliberately does not author**
   * (`ribbon*`, `lines*`, `attractor*`, `curlNoise`, `fluidAdvection`, `transMapStyle`) **and 3 that matter:
   * `palette`, `paletteMapping`, `figureScale`** — *an export is mostly default noise, so diff it
   * programmatically and paste nothing you did not diff.* **The three changes are all LOOK, not physarum:**
   *
   *   * **`filmLook: 'Legacy Graded'` → `'Customize'` with a full `customFilmLookParams` block.** Four fields
   *     depart from `FILM_LOOKS['Legacy Graded']`: `glow` 4 → **6**, `exposure` 1.4 → **2.1**,
   *     `bloomThreshold` 0.6 → **0.55**, `bloomIntensity` 0.3 → **0.1** — a brighter, glowier figure with the
   *     bloom threshold lowered but its contribution cut, i.e. a wide soft halo rather than a bloom highlight.
   *     ⚠️ **All 22 fields are authored and that is REQUIRED, not verbosity**: `main.ts:4181` applies this
   *     block with `Object.assign(customFilmLookParams, …)`, so **an omitted field is inherited from whatever
   *     look was live when the preset loaded** — the preset would grade differently depending on where the
   *     user came from, and only a varied starting state would ever show it.
   *   * **`palette: 'Neon'` + `paletteMapping: 'phase'`.** ⚠️ **This OVERRIDES the particle colour** — the
   *     precedence is palette > material ramp > preset colour — so `colorBase`/`colorAmp`/`colorFreq`/
   *     `colorShift` below are now INERT on this path. They are kept verbatim (clearing the palette must not
   *     leave the body colourless, and the Mixer interpolates them), but **the "cool on purpose" comment on
   *     them no longer describes what is drawn.** `'Neon'` is the cosine palette `a=b=0.5, c=[1,1,1],
   *     d=[0, 0.33, 0.67]` — a full rainbow — mapped by phase, so the contrast against the hardcoded orange
   *     trail now varies around the figure instead of being uniform cyan. ⚠️ **The banner's rule above
   *     ("do not pair physarum with a warm ramp") is not violated but it IS now partial**: a phase-mapped
   *     rainbow puts warm particles over the orange trail somewhere on every frame. The owner ran it and kept
   *     it — **that is the verdict, and the rule stands for the next preset, not against this body.**
   *   * **`figureScale: 0.8934537987672422`** — a drag value, kept at full precision because rounding it
   *     would be a retune. ⚠️ **It is a pure FRAMING choice and it is only available because of the engine
   *     fix**: pre-fix, `figureScale` detuned physarum (it is inside `effectiveScale()`), which is why the
   *     builder's doc block used to forbid it. Measured over the same 21-instant cadence, deposit 0.08, at
   *     `viewScale` 1.000 → 0.8935: `trail/fig` **1.03 → 1.03** and `churnC` 0.253 → 0.247, i.e. the alignment
   *     and the dynamics are untouched; `off% max` **4.3 → 1.3** (a smaller figure loses fewer particles off
   *     frame) and `move` 44.2 → 36.7 px, which is mostly the FIGURE travelling fewer pixels (×0.893 predicts
   *     39.5). The ~7 % beyond that is not attributed — a smaller figure concentrates the deposit on the
   *     fixed 512-cell grid and 3 % fewer particles are excluded as off-frame, and separating those two was
   *     not worth another cadence.
   *
   * ⚠️ **INSTRUMENT DRIFT, disclosed rather than reconciled:** the `depositAmount 0.08` row in the table above
   * reads `churnC 0.240 (0.142, 0.85)` and re-running the same line of the same harness now gives **0.253
   * (0.142, 0.91)** — the generator and the body are deterministic and unchanged, so the difference is in the
   * harness, which grew a `strong%` column mid-sitting. **Identical `min` and `off%`, different means: the two
   * sets of figures may not be reconciled, and the conclusion (0.08 sits at ~5 % of frame past half-alpha)
   * holds on both.**
   *
   * WARNING: **The equilibrium exceeding 1.0 is deliberate and is why the network has hard cores instead of
   * a uniform haze** - the shader's `clamp(..., 0.0, 1.0)` is doing authoring work here. It is also why
   * saturation is *checked* rather than assumed. ⚠️ **The old figures for that check (0.53 % of cells at the
   * ceiling, 2.5-3.3 % at `depositAmount: 0.5`) were taken over the 13 %-scale trail and DO NOT transfer** —
   * the post-fix reading is `tMed 0.056` with 5.0 % of the frame past half-alpha.
   *
   * `blend: 0.08` is low ON PURPOSE and is not timidity: it multiplies a UNIT direction, so it is the
   * displacement's only free scalar once decay is fixed. At `blend: 0.6` - an unremarkable-looking slider
   * position - the same figure displaces **440 px**, most of a half-width, and the particles abandon the
   * Lissajous curve entirely, which is the identity the engine exists for.
   *
   * WARNING: **`trailOpacity: 0.9`, not the 0.35 default, because the overlay DOUBLE-APPLIES ALPHA
   * (invariant 9).** The shader premultiplies (`rgb = alpha * orange`) and then blends under
   * `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`, so the red channel reaches the screen as `alpha^2`. At a mid trail
   * value of 0.2: opacity 0.35 -> effective red **0.047**; opacity 0.9 -> **0.308**. **The default is not a
   * dim setting, it is an invisible one** - a second reason the subsystem reads as not working when it is.
   *
   * `particleCount: 6000` is bounded by CPU sensing, not by taste. `senseAndSteer()` runs a three-probe
   * bilinear loop **per particle per frame on the CPU**, on top of a 4 MB `readPixels` every 4th frame
   * (`physarum.ts:339`, 512^2 RGBA float). The liquid demos above run 20 000 because their work is on the
   * GPU. 6000 over a 33 %-coverage figure puts ~2 particles in every trail cell that matters, which is what
   * 4000 over a 0.8 % figure could not do at any deposit value.
   *
   * `decayFactor: 0.80` and `blurRadius: 3` keep the PARTICLE trail short. The physarum trail is the
   * subject; a long motion-blur accumulation would composite two trails and neither would be legible.
   * `renderMode: 'star'` for the same reason - no material, so no second population competing with the
   * network, and WARNING: **`splat` with no material draws nothing at all.**
   */
  'Physarum Flower': {
    // ⚠️ `'review'` has been removed TWICE and restored once, and the history is the point: removed
    // 2026-09-04 on the owner's ✅ (*"note that Physarum Flower is fine"*), RESTORED 2026-09-20 because the
    // engine units fix changed what this body draws (trail/fig 0.13 → 1.04), and removed again the same day
    // on the OWNER-TUNED EXPORT that superseded both — a tick can be undone by a design change, and the way
    // back is a new pass, never a re-reading of the old one. ⚠️ **`version: 2` is the FORMAT version and
    // `UnifiedPreset` pins it to the literal 2** — it is not a revision counter, so a retune must NOT bump it
    // (`tsc` catches the attempt, which is the only reason this trap is not silent). Revisions live in prose.
    metadata: { name: 'Physarum Flower', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'physarum', 'field'] },
    generators: {
      // Legacy `Flower Power` - chosen on MEASURED frame coverage (32.9 % instantaneous), not on looks.
      // A field system cannot be demonstrated on a figure that does not cover the frame; see the banner.
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: flowerWaves(),
      // COOL ON PURPOSE - the trail overlay is hardcoded ORANGE until Step 9.3, so cyan particles make
      // the two populations separable at a glance. v1 matched the trail's amber and the effect became
      // unreadable, which was the "confusing" half of the review.
      // ⚠️ INERT SINCE THE 2026-09-20 OWNER EXPORT, and kept deliberately: `overlay.palette: 'Neon'` wins
      // (palette > material ramp > preset colour), so these four fields no longer reach the screen. They
      // stay because clearing the palette must not leave the body colourless and because the Mixer
      // interpolates them — but read the banner's export section, not this comment, for what is drawn.
      colorBase: [40, 140, 165], colorAmp: [30, 100, 90], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.80, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: `'Legacy Graded'` → `'Customize'` with the four departures below.
      // Every one of the 22 fields is authored because `main.ts:4181` applies this block with `Object.assign`
      // — an omitted field is INHERITED from the previously live look, so a partial block makes the grade
      // depend on which preset the user came from. The unmarked values ARE `FILM_LOOKS['Legacy Graded']`'s own.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 6, depthSize: 0, depthBrightness: 0, depthDof: 0, depthColorShift: 0,   // glow: LG's 4 -> 6
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3,
        // Threshold DOWN and intensity DOWN together: a wide soft halo, not a bloom highlight (LG: 0.6/0.3).
        bloomEnabled: true, bloomThreshold: 0.55, bloomIntensity: 0.1,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.1,                    // exposure: LG's 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1, vignette: 0,
        // ⚠️ `'none'` here means *this bundle makes no colour decision* — it does NOT clear the pair below.
        palette: 'none', paletteMapping: 'depth',
      },
      // ⚠️ OWNER-TUNED EXPORT: this pair OVERRIDES `generators.colorBase` &c (palette > ramp > preset colour),
      // so the figure is a phase-mapped rainbow rather than the authored cyan. `'Neon'` is the cosine palette,
      // not `FILM_LOOKS['Neon']` — the two share a name and only the tooltips separate them.
      palette: 'Neon', paletteMapping: 'phase',
      transMapEnabled: false,
      // THE LIVE COPY - `main.ts:3142` reads `o.physarum ?? DEFAULT_PHYSARUM`. All eight fields are
      // required by `PhysarumConfig`, so there is no partial spelling of this block.
      physarum: {
        // THE GATE. `isActive()` is `blend > 0` and every other field is inert while this is 0.
        // 0.08 buys 58.6 screen px of steady displacement at decayRate 0.06 - see the banner's arithmetic.
        // ⚠️ UNCHANGED by the 2026-09-20 engine fix, deliberately: the fix reduced this preset's real wander
        // from ~225 px to 58.6, which is what put the population back on frame (off% 33.4 -> 4.3).
        blend: 0.08,
        // 30 deg sensors with a 22 px reach: wide enough to find a neighbouring strand, short enough that
        // the three probes do not all land in the same blurred deposit.
        sensorAngle: 30, sensorDistance: 22,
        // 45 deg/step is the default and is the sharpest turn that still traces a curve rather than jittering.
        turnSpeed: 45,
        // BOTH the trail's decay AND the displacement's divisor. Do not treat it as a look-only control:
        // halving it doubles how far the particles wander. 1/e trail memory ~16 frames.
        decayRate: 0.06,
        // ⚠️ 0.30 -> 0.08, the ONE value the 2026-09-20 engine fix forced. The equilibrium is still ABOVE the
        // shader's clamp (0.08/0.06 = 1.33) so strand cores are still solid — but the network now covers ~45 %
        // of the frame instead of 0.8 %, and at 0.30 a quarter of the frame read brighter than half-alpha.
        // The brightness-parity alternative 0.04 would sit BELOW the clamp and lose the solid cores.
        depositAmount: 0.08,
        // 0.9, not the 0.35 default: the overlay applies alpha twice, so 0.35 reaches the screen as an
        // effective 0.047 on a mid trail value. See the banner.
        showTrail: true, trailOpacity: 0.9,
      },
      speedFactor: 0.5,
      // ⚠️ OWNER-TUNED EXPORT: a drag value, kept at full precision — rounding it would be a retune. It is a
      // FRAMING choice and only became one on 2026-09-20: pre-fix, `figureScale` sat inside the deposit's
      // effective scale and detuned physarum, which is why the builder's block used to pin it at 1.0.
      // Measured at 1.000 -> 0.8935: `trail/fig` 1.03 both, `churnC` 0.253 -> 0.247, `off% max` 4.3 -> 1.3.
      figureScale: 0.8934537987672422,
    },
  },

  /*
   * ============================================================================================
   * THE PHASE 21 COVERAGE COHORT — 2026-09-19, and ⚠️ **NONE OF IT HAS BEEN SEEN IN A BROWSER YET**
   * ============================================================================================
   *
   * ⚠️ **READ THIS BEFORE JUDGING ANY ENTRY BELOW, AND BEFORE COPYING A NUMBER OUT OF ONE.** Every preset
   * from here to the end of the file was authored in one sitting to close the gaps `checks/coveragecheck.mjs`
   * reports — one preset per FEATURE that the census counts at below its floor, per unauthored ENUM member and
   * per boolean leaf no shipping preset sets. The owner's instruction was *"add all the demos needed, be
   * creative and make sure the features that should be shown are well represented visually, also choose good
   * names for those demos which hint the feature they want to demo"*.
   *
   * **The difference between this cohort and the 24 above is the BASIS of its numbers, and it is the whole
   * reason this banner exists.** The 2026-08-21 review set and the five liquid entries carry *measurements* —
   * frame coverage percentages, index spacings, drop counts at five instants, heat spans. Those were taken with
   * instruments that had to be built and run per preset. **The values below are derived from DOCUMENTED ENGINE
   * SEMANTICS instead** — the plan's `21.0` preconditions, each subsystem's own doc comments, and the
   * arithmetic those comments state (`21.D8`'s PRE / APPEAL / DIVERSIFY is the shape of every block below).
   * That is a weaker basis, and it is stated rather than hidden:
   *
   *   * ⏳ **Every entry carries the `'review'` tag and it means what it means on the 18** — a verdict is OWED,
   *     and a checker cannot give it. `coveragecheck` will report these features as covered the moment they
   *     load, which is a claim about AUTHORING and not about appearance.
   *   * ⚠️ **A figure choice here cites the builder's own measurement, never a new one.** Where an entry says
   *     "the widest index spacing of any flat figure", that figure is `montezumaWaves()`'s, measured for
   *     `Pigment Sheet`; nothing below re-measured anything.
   *   * ⚠️ **Wave-builder REUSE across this cohort is deliberate and is not a duplicate.** All sixteen builders
   *     were already in use by the 24 above, so a new demo either reuses one or invents a figure with no
   *     measured properties at all. Reuse was chosen, and each entry's DIVERSIFY names the preset it must not
   *     be confused with — which is its own feature's existing demo, not every preset sharing its silhouette.
   *
   * **What a browser pass is looking for, per entry:** the APPEAL claim in its doc block, in the main view, at
   * the final 8-bit output, over a minute rather than at `t = 0` (`P11`), and never in a preview tile (`P12`,
   * and `P13` for `volume`). A pass that only confirms "it draws something" discharges nothing — every claim
   * below is falsifiable and names what would falsify it.
   */

  /**
   * **`21.5a` — the second PHYSARUM demo, at the opposite operating point.** Physarum's two readable
   * quantities are the SENSOR GEOMETRY and the TRAIL'S MEMORY, and `Physarum Flower` sits at one corner of
   * that plane: a 29.3-unit reach, a 1/e memory of ~16 frames and `deposit/decay = 5.0`, which is above the
   * shader's clamp and therefore draws SOLID cores. This preset moves all three.
   *
   * ## ⚠️ RETUNED 2026-09-20 (v2) — the review found a UNITS DEFECT, not a tuning problem — then ADAPTED (v3)
   *
   * Owner verdict v1: *"the problem with physarum is that quickly something like a quasi static equilibrum is
   * reached where not much is moving anymore, this makes it boring when this is achieved, it also means that we
   * see mainly the trail in the middle and not much of the other particles is left or visible any more — try
   * to fix this by searching a figure and physarum setting combination which makes the trails and particles
   * still change and move over time to get some interesting interactions"*.
   *
   * **Both halves of that came from ONE measured cause, and no figure or physarum value could reach it.** The
   * steering block (`lissajous.ts`) built its deposit uv from MODEL positions against the CANVAS
   * half-width — `uv = wx / (canvasWidth * 0.5) * 0.5 + 0.5` — and converted the sensed step back with the same
   * `halfW`. But `project()` multiplies those model positions by `effectiveScale() = waveScale *
   * viewScale`, and `waveScale = uniformFit(designW, designH)` is **7.68** for a 100×100 box at 1024×768. So
   * at v1's design box:
   *
   *   * the deposited network was a **1/7.68 = 13 % scale copy** of the figure, and `renderOverlay` draws the
   *     512² field across the WHOLE viewport (`OVERLAY_VS === DIFFUSE_VS`, a fullscreen quad) — so the trail
   *     sat in the middle of the frame while the particles spanned all of it. Measured `trail/fig`: **0.21**.
   *   * the steady wander, **68 model units** by the arithmetic below, arrived as **~474 screen px** and flung
   *     **74 %** of the population off frame (measured; at 1920×1080 92 %, at 3840×2160 **100 %** — no
   *     particles on screen at all). Off in empty field all three sensor probes tie, so those particles never
   *     turn again: `turned%` fell to ~10 and coarse network churn to **0.018**, against the owner-confirmed
   *     `Physarum Flower`'s 0.078. That is the "quasi static equilibrium" — it is not equilibrium, it is a
   *     population that has left the picture.
   *
   * **v2's fix was to author the figure in the units the deposit assumed**: `designResolution` is
   * **1024×768**, so `waveScale == 1.0` at that canvas and model units ARE canvas pixels, with the figure
   * sized by `am.base` instead (see `physarumLatticeWaves()`). That left invariant 27's second clause showing —
   * *a preset cannot compensate for a canvas-dependent error* — so v2 shipped with a stated residual:
   * `trail/fig` was `1/waveScale`, exact at 1024×768 and degrading to **0.37 at 3840×2160**.
   *
   * ## ⚠️ v3, 2026-09-20 — the ENGINE was fixed, and `blend` is HALVED to hold v2's tuning
   *
   * The owner's instruction: *"what should we now fix for physarum? note that we have not many presets using
   * physarum, we should fix the functionality and then we can adapt the impacted presets"*. `lissajous.ts` now
   * converts the deposit uv through `effectiveScale()` and a positive `perspectiveFactor()`, and steps back
   * through the **exact inverse** — that file's ⚠️ header owns the record. Two consequences land here:
   *
   *   * the old map was ALSO not self-inverse (`halfW` is **half** a uv span, so the step back was half the
   *     distance the sensors had looked), so the fix **doubles the step for a given `blend`** — hence
   *     `blend: 0.06 → 0.03`, which is v2's wander through the corrected map and nothing else;
   *   * physarum is now **resolution-independent**, so v2's `designResolution: 1024×768` is no longer
   *     load-bearing for ALIGNMENT. ⚠️ **It is still load-bearing for the builder** — `physarumLatticeWaves()`
   *     is authored in pixel-unit amplitudes — so do not shrink it back towards 100×100.
   *
   * **`blend: 0.03` is not a taste change: it is measured to reproduce v2 EXACTLY.** A/B on one cadence
   * (21 instants, frames 300→1500 every 60), the PRE-fix generator imported from
   * `backup_20260920_physarum_and_plume_retunes/` and the fixed one from the live tree:
   *
   *     run                           churnC (min, late/early)  move   lit%   strong%   tMed   off% max  trail/fig
   *     pre-fix engine, blend 0.06        0.130 (0.108, 0.79)   28.5   41.7       0.6  0.026      0.1      1.00
   *     post-fix engine, blend 0.06       0.175 (0.145, 0.86)   30.9   51.3         —  0.021      1.4      1.00
   *     post-fix engine, blend 0.03       0.130 (0.108, 0.79)   28.5   41.7       0.6  0.026      0.1      1.00
   *
   * Identical on every instrument — which is the claim: at `effectiveScale 1.0` the fix's only effect is the
   * factor of two, so halving `blend` preserves the measured optimum instead of re-opening it. ⚠️ **That cadence
   * is NOT the 105-instant one in the table further down. Do not reconcile the two sets of figures** — the A/B
   * establishes an EQUALITY between two runs of one instrument, not new absolute values for this preset.
   *
   * **And v2's canvas residual is gone**, same cadence, four canvases:
   *
   *     canvas       v3 trail/fig  off% max  churnC | v2 on the pre-fix engine: trail/fig  off% max  churnC
   *     1024x768         1.00        0.1     0.135  |                             1.00       0.1     0.135
   *     1280x800         1.00        0.0     0.135  |                             0.97       0.1     0.138
   *     1920x1080        1.01        0.1     0.139  |                             0.72       0.8     0.135
   *     3840x2160        1.01        0.1     0.139  |                             0.36       4.0     0.105
   *
   * ⚠️ **The 1920 and 3840 rows are IDENTICAL apart from `move` in px (42.0 → 84.1, exactly 2× with the
   * width)** — the resolution-independence measured rather than argued, since the wander is a constant FRACTION
   * of the frame. What dependence is left is on ASPECT alone (`canvasWidth / effectiveScale()` contains no
   * resolution), which is why the 1024×768 and 1920×1080 columns still differ slightly. **Invariant 27's second
   * clause is discharged at the engine instead of disclaimed here** — and `Physarum Flower`, the other impacted
   * preset, was adapted in the same sitting with one value.
   *
   * ## ✅ OWNER-TUNED EXPORT, 2026-09-20 18:01 — v3's physarum values CONFIRMED, plus a count and a grade
   *
   * *"We have reviewed more of the finetuned presets and now adapt as follows: Replace `Physarum Weave` by
   * `Physarum Weave_20260920_180115.json`"* — tuned in the Lab against the FIXED engine, which is the browser
   * verdict v3 owed. ⚠️ **It outranks everything above it and nothing here may be tuned back towards the
   * derivations.** `'review'` is removed.
   *
   * ⚠️ **THE ENTIRE `physarum` BLOCK CAME BACK BYTE-IDENTICAL — `blend: 0.03` INCLUDED.** Diffed leaf-by-leaf
   * against the export programmatically (210 leaves, 2 changed, 44 export-only, 0 missing): the halved `blend`
   * the A/B above derived that morning is the value the owner then ran and kept. **The waves, the design box,
   * `trailColour`, `speedFactor` and every renderer field are unchanged too.** The 44 export-only leaves are
   * **29** for the grading block this body now authors in full, **14** runtime defaults it deliberately does
   * not author (`ribbon*`, `lines*`, `attractor*`, `curlNoise`, `fluidAdvection`, `transMapStyle`,
   * `figureScale: 1`) and **1** `paletteMapping`, the last paragraph below — *an export is mostly default
   * noise, so diff it programmatically and paste nothing you did not diff.* **Two changes reach a pixel:**
   *
   *   * **`particleCount` 4000 → 9900.** ⚠️ **This overrides `P10`'s cap, which was a CPU-cost argument, not a
   *     measurement of this machine:** `senseAndSteer()` runs a three-probe bilinear loop per particle per
   *     frame on the CPU, so 9900 is ~2.5× that work — and the owner ran it and kept it. **Do not lower it
   *     back on the P10 reasoning.** What it does to the network is measured in `physarumLatticeWaves()`' doc
   *     block (denser and brighter, marginally more settled, `move` unchanged); ⏳ **what is NOT re-measured at
   *     9900 is the `late/early` figure on the LONG window** (105 instants, frames 480–3600) that the card
   *     line's *"still reorganising after a minute"* claim rests on — the owner's own viewing is the evidence
   *     for that now, and the short-window reading moved only 0.79 → 0.74.
   *   * **`filmLook: 'Legacy Graded'` → `'Customize'`**, six fields departing from that bundle: `glow` 4 →
   *     **5.5**, `exposure` 1.4 → **2.1**, `bloomThreshold` 0.6 → **0.2** (a very low threshold — most of the
   *     frame blooms), and the three DEPTH cues switched on from zero: `depthSize` **0.35**,
   *     `depthBrightness` **0.25**, `depthColorShift` **0.25**. ⚠️ **Those three DO reach this preset**
   *     (`hdr-particle.ts:3344–3347`, the star program's own uniforms) — the rule that only the film-look copy
   *     reaches splat says nothing about the star path, and `renderer.depthSize: 0` below is the OTHER
   *     `depthSize`, which is why the two can disagree without either being wrong.
   *
   * ⚠️ **All 22 grading fields are authored, and that is required rather than verbose**: `main.ts:4181` applies
   * the block with `Object.assign(customFilmLookParams, …)`, so an omitted field is inherited from whatever
   * look happened to be live — the preset would grade differently depending on which preset the user arrived
   * from, and **only a varied starting state would ever show it.**
   *
   * ⚠️ **The export carries `paletteMapping: 'index'` and this body does NOT, which is the one place it
   * deliberately departs from the export.** There is no `overlay.palette` in either, and the look's own
   * palette is `'none'`, so the mapping cannot reach a colour: authoring an inert field in a demo body would
   * read as a decision later. **Everything that can change a pixel is here.**
   *
   * **What each version changed.** v2, three values: `waves` → `physarumLatticeWaves()`, `designResolution` →
   * 1024×768, `blend` 0.04 → 0.06. **v3, one:** `blend` 0.06 → 0.03. **The owner's export, two:**
   * `particleCount` → 9900 and the grade → `Customize`. **Every physarum field is untouched
   * since v1 except `blend`**, so v1's identity claims below — 50-frame memory, equilibrium 1.0,
   * `turnSpeed 18`, the inverted P2 — all still hold verbatim. v2's `blend` change earned itself by measurement: the same figure at 0.04 read
   * churn 0.123 with a **minimum of 0.079** against 0.06's 0.103, a 30 % worse worst-instant. ⚠️ **The slider
   * step is 0.01, so 0.03 is an exact stop but its NEIGHBOURHOOD is coarse** — ±0.01 is ±33 % here against
   * ±17 % at 0.06. That is a resolution cost of the fix, recorded rather than worked around; it is not a reason
   * to keep the broken arithmetic, and `physarum.blend`'s track is not being changed for one preset.
   *
   * **The arithmetic, in screen pixels and now canvas-independent.** `decayRate` is two quantities (Flower's
   * banner): the steady screen displacement is
   * `sensorDistance / TRAIL_SIZE * blend / decayRate * canvasWidth`, i.e. **34 / 512 * 0.03 / 0.02 * 1024 =
   * 102 px** at 1024 wide — the same 102 px v2 had, which is the A/B equality said as arithmetic — a visible
   * detour off the curve against a ~700 px figure, where v1's intended 68 landed as 474. **Both
   * `effectiveScale()` and the perspective factor cancel out of that expression**, which is what makes it
   * canvas-independent. Trail memory is `1 / decayRate`: **50 frames against Flower's 16**. The deposit
   * equilibrium is `0.02 / 0.02 = 1.0`, **at** the shader clamp rather than past it (Flower: 1.33), so the
   * network is HAZY where the reference is solid. Long memory + low deposit is still the whole design: a
   * slowly woven web.
   *
   * ⚠️ **`turnSpeed: 18` is the third lever and the least obvious.** At the default 45 deg/step a particle
   * turns onto a found strand within two frames, which is what makes the reference read as a skeleton. At 18
   * it arcs onto it over several frames, so strands are laid down as long curves — the "weave".
   *
   * ⚠️ **`trailOpacity` stays at 0.9 and MUST NOT be raised.** The overlay applies alpha twice, so 0.35
   * reaches the screen as ~0.047; compensating for that with a number above 0.9 is invariant 9's shape —
   * treating a symptom whose cause is in a different subsystem.
   *
   * **P2 inverted, deliberately.** `Physarum Flower` is cyan particles over an orange trail with the
   * particles dominant. Here the trail owns the frame: `trailColour: 'Classic: ocean'` against dim amber
   * particles at `glow: 1.2`. Same precondition (two populations must be colour-separated), opposite
   * assignment — which is what `21.5a`'s DIVERSIFY asks for and is also a free exercise of the 9.3 trail-LUT
   * path, since `'(Preset)'` (the fixed orange) is what every other physarum body in the library resolves to.
   *
   * **The figure is `physarumLatticeWaves()`, not `montezumaWaves()` and not `flowerWaves()`.** Montezuma's
   * three beating near-equal windings are what v1 was here for and they are kept — but `Montezuma` is a fixed
   * lattice with a slow beat, and the second half of the owner's verdict asks for something that *keeps*
   * changing. The new builder sweeps all three winding numbers at mutually incommensurate rates, so the
   * figure has no period to settle into; its own doc block carries the sweep measurements and the turning
   * point past which more sweep buys LESS network change. `P10` still caps the count: 4000, CPU-side.
   *
   * **What the retune bought, on one instrument, 105 instants, 4000 particles, 1024×768** (coarse churn is
   * 16×16 block means, so per-texel deposit flicker cancels and only a NETWORK change survives):
   *
   *                        churn mean   churn MIN   late/early   move   off% max   trail/fig
   *     v1 (shipped)          0.018       0.013        0.98      11.7      74.3       0.21
   *     this body             0.133       0.103        1.20      22.9       0.1       1.00
   *     Physarum Flower       0.078         —            —       66.3      33.8       0.13
   *
   * ⚠️ **All three rows are PRE-fix-engine readings AT 4000 PARTICLES — two bases behind the shipped body,
   * which now runs the fixed engine at 9900 — and the `Physarum Flower` row no longer describes that
   * preset** (post-fix, adapted: churnC 0.240, move 43.2, off% 4.3, `trail/fig` 1.04 — on the other cadence).
   * **This body's row survives as a v1-versus-v2 comparison because v3 measured identical to v2**; it is kept at
   * its own basis rather than restated at the A/B's.
   *
   * ⚠️ **`late/early` is the instrument that answers the verdict, and it is the reason the others are not
   * enough.** It is the mean churn over the second half of the window divided by the first: v1's 0.98 is a
   * network that reorganises no more at 60 s than at 10 s — dead flat, which is what "quasi static
   * equilibrium" looks like as a number. **1.20 means this body is still MORE active late than early**, so
   * the claim is not "it settles more slowly", it is "it does not settle in the window measured".
   *
   * ⏳ **Card line:** *"Physarum's memory, not its shape: 50 frames of trail against `Physarum Flower`'s 16 —
   * and a figure whose three windings never repeat, so the web is rewoven rather than finished. Watch for a
   * minute: the network should still be reorganising at the end of it."*
   */
  'Physarum Weave': {
    // ⚠️ **1024×768 is not a frame size.** It was v2's workaround for the units defect (it puts `waveScale` at
    // 1.0, the regime the old deposit block assumed); the 2026-09-20 engine fix makes that alignment role
    // unnecessary, but the value MUST STAY — `physarumLatticeWaves()` is authored in pixel-unit amplitudes and
    // is sized by this box. Shrinking it towards 100×100 shrinks the FIGURE, not just its units.
    // ⚠️ `version: 2` is the FORMAT version, pinned to the literal 2 by `UnifiedPreset` — the v1/v2/v3 in the
    // block above are this preset's own revisions and live in prose only. Do not bump this field for a retune.
    metadata: { name: 'Physarum Weave', version: 2, designResolution: { width: 1024, height: 768 }, tags: ['demo', 'physarum', 'field'] },
    generators: {
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: 4000 -> 9900, which OVERRIDES `P10`'s CPU-cost cap (sensing is a
      // three-probe loop per particle per frame on the CPU). Every measurement in the banner and in
      // `physarumLatticeWaves()`' block was taken at 4000; the owner ran 9900 and kept it. Do not lower it.
      type: 'lissajous', particleCount: 9900, waveSpeed: 0.05,
      // `rotation: [0, 0, 0]` for `flowerWaves()`'s reason, which generalises: a rotating figure drags the
      // deposit across the trail and smears the network instead of reinforcing it. The retune's fm sweeps
      // are the measured alternative — they move the figure through its OWN structure rather than rigidly.
      rotation: [0, 0, 0], angle: [0, 0, 0],
      // ⚠️ Pixel-unit amplitudes, matching `designResolution` above. Not interchangeable with any other
      // builder in this file — every one of those is authored against a ~100-unit box.
      waves: physarumLatticeWaves(),
      // Dim amber — the INVERSE of `Physarum Flower`'s cool particles, because the trail is cool here.
      colorBase: [150, 96, 40], colorAmp: [60, 40, 16], colorFreq: [0.02, 0.03, 0.05], colorShift: [0.5, 0.3, 0.1],
    },
    // P3: a short particle trail, because the FEATURE owns a trail. Two long trails composite into mush.
    renderer: { mode: 'star', glow: 1.2, decayFactor: 0.80, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: `'Legacy Graded'` → `'Customize'` with the six departures below.
      // All 22 fields are authored because `main.ts:4181` applies this block with `Object.assign` — an omitted
      // field is INHERITED from the previously live look. Unmarked values are `FILM_LOOKS['Legacy Graded']`'s.
      filmLook: 'Customize',
      customFilmLookParams: {
        // ⚠️ The three DEPTH cues are ON, from zero, and they DO reach this preset: `hdr-particle.ts` sets
        // `uDepthSize`/`uDepthBrightness`/`uDepthColorShift` on the star program (3344–3347), so near and far
        // particles differ in size, brightness and hue. `renderer.depthSize: 0` above is the OTHER `depthSize`
        // — a preset field that only reaches splat — which is why the two disagree without either being wrong.
        glow: 5.5, depthSize: 0.35, depthBrightness: 0.25, depthDof: 0, depthColorShift: 0.25,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3,
        // 0.2 is a very low threshold (LG: 0.6) — most of the web blooms, which is the "woven" softness.
        bloomEnabled: true, bloomThreshold: 0.2, bloomIntensity: 0.3,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.1,                    // exposure: LG's 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1, vignette: 0,
        // `'none'` = this bundle makes no colour decision; there is no `overlay.palette` here, deliberately —
        // the trail owns the colour (`trailColour` below) and the particles stay dim amber.
        palette: 'none', paletteMapping: 'depth',
      },
      transMapEnabled: false,
      physarum: {
        // ⚠️ 0.03 = v2's 0.06 through the FIXED deposit map (2026-09-20), which doubled the step per unit of
        // `blend`. Measured identical to v2 on every instrument, so the tuning basis carries: 0.04 on the old
        // map gave churn 0.123 at a MINIMUM of 0.079, 0.06 gave 0.133 at 0.103 — chosen on the worst instant,
        // not the mean. Still 102 px of steady wander against a ~700 px figure. See the banner's A/B table.
        // ⚠️ The 2026-09-20 owner export returned this value — and the whole block — UNCHANGED.
        blend: 0.03,
        // Wide and long: a 60 deg cone at 34 px finds strands the reference's 30 deg / 22 px cannot.
        sensorAngle: 60, sensorDistance: 34,
        turnSpeed: 18,
        // BOTH the trail decay AND the displacement divisor — halving it doubles the wander. 1/e ~50 frames.
        decayRate: 0.02,
        // Equilibrium 1.0, below the shader clamp: hazy strands rather than solid cores.
        depositAmount: 0.02,
        showTrail: true, trailOpacity: 0.9,
        // ⚠️ A palette NAME as `getPaletteLUT` spells it — `'Classic: '` is required for `ocean`, which also
        // exists as a cosine palette and would otherwise resolve to that one (the prefix exists for this).
        trailColour: 'Classic: ocean',
      },
      speedFactor: 0.35,
    },
  },

  /**
   * **`21.5b` — the LIQUID FIELD, seeded as five separate BODIES.** ⚠️ **This preset is an OWNER-TUNED
   * EXPORT, imported verbatim on 2026-09-20 (`Liquid Field Basin_20260920_095602.json`) and RENAMED to
   * `Liquid Field Clouds` by the owner in the same instruction — it outranks every derivation below it, and
   * nothing here may be "improved" back towards them.** The import changed exactly two values against the
   * body derived that morning, measured leaf-by-leaf against the export rather than read off the diff:
   * `seedPattern` `'basin'` → **`'blobs'`** and `fieldDecay` 0.992 → **0.999**. Everything else in the export
   * was either identical or a runtime default the body deliberately does not author (22 leaves: `ribbon*`,
   * `palette: 'none'`, `attractor*`, `curlNoise`, `physarum`, `fluidAdvection`) — ⚠️ **an export is mostly
   * default noise, so diff it programmatically and paste NOTHING you did not diff.**
   *
   * ⚠️ **THE RENAME DOES NOT NAME THE SEED, AND THAT IS THE TRAP IN THIS BODY.** `'blobs'` is five discs on a
   * ring at `0.26·minDim`; the seed actually CALLED `'cloud'` is a single centre blob at `0.32·minDim` and is
   * NOT what this preset runs. The name describes what five long-memory bodies LOOK like, not the enum
   * member — `21.D2` only asks the name to hint the feature, which `Liquid Field` does. **Do not "correct"
   * the body to `'cloud'` to match the word.**
   *
   * ⚠️ **AND IT VACATES A COVERAGE ROW: `'basin'` now has NO carrier in the library**, so
   * `coveragecheck`'s `liquidField.seedPattern:basin` went back to COMMISSIONED `21.5b` in the same edit —
   * a GATED row with zero carriers FAILS, and repairing that by editing the checker instead of stating the
   * gap would have been the inversion this project forbids. `'blobs'` is now carried TWICE (here and by
   * `Liquid Field Pool`), which is coverage but not diversity: **the seed axis of `21.5b` is owed again.**
   *
   * ⚠️ **RETUNED 2026-09-20 ON AN OWNER REVIEW FIRST, and the report is the measurement here:** *"the screen
   * is 99% empty and dark, the figure is moving very slowly and at the end only an ellipse is left quasi
   * statically … a very boring preset"*, with `Liquid Field Fill` confirmed good in the same breath. Every
   * clause of that report has a cause in the FIRST version's own doc block, which is why the retune is a
   * correction by USE and not a taste change:
   *   * *99 % empty* — the figure was `diffusionWaves()`, measured at **0.8 % frame coverage**, the lowest
   *     in the library and already recorded four builders above as *"the whole reason it failed review"* for
   *     physarum. A `basin` pool occupies the full width of a band `0.22·min(w,h)` tall at the BOTTOM
   *     (`liquid-pool.ts`' `seedSlot`), so a 0.8 % figure cannot even reach the pool, let alone stir it.
   *     ⚠️ **A coverage figure measured for one field system is evidence for every field system** — it was
   *     in this file the whole time and the first version quoted the design box instead.
   *   * *only an ellipse* — `diffusionWaves()` is the most coherent figure in the library (arc coherence
   *     0.50) and its two XY axes are pure AM bases with `fm.base: 0`, so the frequency sweeps THROUGH ZERO
   *     and the curve degenerates to a single slow ellipse. That is the builder behaving as documented; the
   *     defect was choosing it for a demo whose subject needs a figure that keeps ploughing.
   *   * *very slowly* — `speedFactor: 0.45` under a `rotation` of 0.2 on Z alone.
   *   * *dark* — `isoLevel: 1.6245` over a pool spread thin across a wide band: most of the basin never
   *     crossed the threshold, so the one part of the frame that was supposed to be liquid was not drawn.
   *
   * **The figure is `flowerWaves()` — 32.9 % measured coverage — spun on Z at 0.45.** A ten-petal rosette
   * was chosen for the basin band (tips dip in, cut it, and LEAVE, the only way a lagging pool can be seen
   * lagging) and it survived the owner's own tuning unchanged, which is the one part of the derivation the
   * export confirms rather than supersedes: on a ring of five discs the petals reach every one of them, and
   * the rosette's own radius is what decides whether the five are stirred separately or dragged together.
   * ⚠️ **`rotatingBandWaves()` sweeps more (70 %, evenness 0.982) and is deliberately NOT used here** — it is
   * `Liquid Field Pool`'s figure, and with `Liquid Field Pool`'s seed now shared, the figure is the ONLY axis still
   * separating the two presets: **changing it would collapse them into one demo.**
   *
   * ⚠️ **`fieldCoupling: 0.35` is the differentiation from `Liquid Field Pool` (0.5), and low is the harder
   * setting to read.** Coupling is how strongly the figure's velocity carries the pool; 0 is a perfectly
   * still pool. Low enough that the pool visibly LAGS — an eddy forms behind a petal and is still unwinding
   * after it has gone, which is what `21.5b`'s DIVERSIFY asks for and what a high coupling hides by making
   * pool and figure move as one body. ⚠️ **It was 0.20, and the first version called that "the entire
   * differentiation": a differentiation nobody can see is not one.** The three liquid-field presets now read
   * 0.35 / 0.5 / 0.85 over three different seeds, which is the axis stated three times rather than once.
   *
   * ⚠️ **`fieldDecay: 0.999` is the owner's value and the TOP of the 0.95–0.999 band — the derivation argued
   * itself to 0.992 and was overruled by a run.** ~1000 frames (~17 s at 60 fps) is not a wake, it is
   * CUMULATIVE memory: what the pool holds is everywhere the petals have been since the preset loaded. The
   * 0.992 reasoning (an eddy that outlives its petal but never settles) was derived for the `basin` BAND,
   * where a frozen pool freezes the whole frame because the band IS the picture. Over five discs it reads
   * differently — the discs keep their identity, smear into slow trails and drift, which is what the name
   * describes. ⚠️ **So do not transplant a decay figure between two seeds: `0.998` is recorded four lines
   * above as "permanent" and `0.999` ships here deliberately.** Same resource TransMap style 6 decays
   * (`applyFluidFeedbackState()` resolves that with a stated precedence); this preset runs no TransMap, so
   * the pool's decay is unambiguous.
   *
   * **`isoLevel: 1.0` and `kernelWidth: 2.58`.** 1.0 is the calibrated *"typical half-eroded surface"* and
   * the shipped default, reachable exactly; the wide kernel is what lets a sparse pool close into a surface
   * at all rather than reading as a cloud of unrelated dots behind the figure. ⚠️ **Both are EXACT STOPS on
   * their logarithmic tracks** (`trackcheck` §H) — and the export came back with both unchanged, which is the
   * only evidence in this file that an authored stop survives a Lab round trip untouched: an authored value
   * BETWEEN two stops makes the handle jump on first touch and nothing in the UI says so.
   *
   * ⏳ **Card line:** *"Five bodies in a long-memory field: the petals drag them into each other and the
   * field remembers ~17 s of it. Coupling is 0.35 against `Liquid Field Pool`'s 0.5 — watch a smear keep drifting
   * after the petal has gone (`P11`: judge it over a minute)."*
   */
  'Liquid Field Clouds': {
    metadata: { name: 'Liquid Field Clouds', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'liquid', 'liquid-field'] },
    generators: {
      // `flowerWaves()`' own design box is 100x100 and the rosette is radial, so the box is square here —
      // the first version's 75x100 belonged to `diffusionWaves()` and would squash the petals.
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      rotation: [0, 0, 0.45], angle: [0, 0, 0],
      waves: flowerWaves(),
      colorBase: [96, 128, 160], colorAmp: [64, 64, 80], colorFreq: [0.05, 0.1, 0.15], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.4, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      speedFactor: 0.8, figureScale: 1.1,
      liquid: {
        // Lower iso and a wider kernel than `Liquid Surface`: the pool's density has to be able to join the
        // figure's, or the two read as a surface with a cloud of unrelated dots behind it — and five discs on
        // a ring leave wide gaps between them, so the kernel has to bridge more than a `fill` pool presents.
        isoLevel: 1.0, kernelWidth: 2.58,
        edgeSoftness: 0.18,
        tintSource: 'ramp', surfaceRamp: 'liquid',
        colourMix: 0.80, mixModel: 'light',
        refraction: 0.30, specular: 0.85, thickness: 0.65, edgeBrightness: 0.70,
      },
      liquidField: {
        enabled: true,
        poolSize: 22000,
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: these two values came back from the Lab as `'blobs'` / 0.999.
        // `'basin'` has no carrier in the library because of it — `coveragecheck` states that gap rather than
        // hiding it, and this body may not be edited back to close it.
        seedPattern: 'blobs',
        fieldCoupling: 0.35,
        fieldDecay: 0.999,
      },
    },
  },

  /**
   * **`21.5c` — the LIQUID FIELD's `fill` seed, whose subject is MIXING rather than shape.** A `fill` pool
   * has no negative space: at `t = 0` the frame is liquid everywhere the seeder reaches, so there is no
   * silhouette to admire and the only thing that can read is what the figure DOES to it. It carves channels,
   * they close behind it, and the closing rate is `fieldDecay`.
   *
   * ⚠️ **`fieldCoupling: 0.85` and `fieldDecay: 0.985` are the deliberate OPPOSITE corner from
   * `Liquid Field Clouds`' 0.35 / 0.999** (⚠️ **that preset has been three different pairs in one day** —
   * 0.20 / 0.998 as authored, 0.35 / 0.992 after the owner's 🔧 review, then 0.35 / **0.999** as the
   * owner-tuned export that also renamed it and moved its seed off `'basin'`; **this doc block is the second
   * site of the pair and `tsc` sees neither**). The teaching survives all three: the seed pattern is not the
   * only thing separating two liquid-field presets. ⚠️ **But read the corner on COUPLING, not on decay** —
   * this preset's 0.985 is now the SHORTER memory of the two, the reverse of the earlier pairing. High
   * coupling cuts a clean channel and the lower decay lets it heal within a second or two, so the figure is
   * always carving into a partly-recovered field; over there a weak coupling smears into a field that forgets
   * almost nothing.
   *
   * **The figure is `burnWaves()` (75x60, large in every axis — its own measurement, chosen there because
   * buoyancy needs room).** A `fill` pool needs `P1` coverage by construction, and a figure that fills the
   * frame is the one that can carve across all of it. No material here, so nothing of the fire preset's
   * behaviour comes with the figure — only its extent.
   *
   * ⚠️ **`poolSize` and `seedPattern` are CARRIED by the Mixer, not interpolated**, so a crossfade INTO this
   * preset keeps the shape of the pool it came from. That is not a defect to work around and it is the
   * cheapest way to see the difference between the seeds: cross-fade from `Liquid Field Clouds` and its five
   * discs are still five discs while everything else has become this preset.
   *
   * ⏳ **Card line:** *"A full pool has no shape, so watch the channels: the figure cuts, the field heals at
   * `Decay` 0.985. Cross-fade from `Liquid Field Clouds` — the pool's SHAPE is carried, not lerped."*
   */
  'Liquid Field Fill': {
    metadata: { name: 'Liquid Field Fill', version: 2, designResolution: { width: 75, height: 60 }, tags: ['demo', 'liquid', 'liquid-field', 'review'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0.35], angle: [0, 0, 0],
      waves: burnWaves(),
      colorBase: [72, 112, 144], colorAmp: [48, 72, 96], colorFreq: [0.1, 0.15, 0.2], colorShift: [0.2, 0.1, 0.4],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.4, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      speedFactor: 0.6,
      liquid: {
        // A lower threshold than the basin's: a filled field should read as a continuous sheet, so the
        // surface has to close over the pool's own spacing rather than resolve every pool particle.
        // Exact track stops for the intended 1.2 / 2.4 — see `Liquid Field Clouds` for why they read oddly.
        isoLevel: 1.1892, kernelWidth: 2.41,
        edgeSoftness: 0.10,
        tintSource: 'ramp', surfaceRamp: 'liquid',
        colourMix: 0.90, mixModel: 'light',
        refraction: 0.35, specular: 0.90, thickness: 0.70, edgeBrightness: 0.70,
      },
      liquidField: {
        enabled: true,
        poolSize: 18000,
        seedPattern: 'fill',
        fieldCoupling: 0.85,
        fieldDecay: 0.985,
      },
    },
  },

  /**
   * **`21.5d` — the DYE field's `fixed` source: one unambiguous colour laid into the flow.** Four OTHER dye
   * presets ship (`Dye Wake`, `Pipes Art`, `Hypnosis II`, `Liquid Mandala` — counted by importing the groups,
   * 5 of 270 bodies carry an `overlay.dye`; a grep of this file alone finds 2 and is the wrong basis) and all
   * four derive the colour from something (`velocity`, `velocity`, `temperature`, `depth`), so all four show
   * the field's COLOURING. This one shows its GEOMETRY — where the dye goes, how it spreads and how long it
   * survives — because the colour carries no information at all.
   *
   * ⚠️ **`liquid.tintSource` is `'preset'`, NOT `'dye'`, and that is the design.** `Dye Wake` routes the dye
   * into the surface tint, which makes the figure's own colour a function of the field. Here the figure keeps
   * its colour and the dye is only ever seen OUTSIDE the iso surface, which is exactly where it composites —
   * so `P6`'s visible background is not a nicety here, it is the only place the feature appears. Hence
   * `figureScale: 0.70` and a low particle count: unfilled canvas is the instrument.
   *
   * ⚠️ **`dye.fixedColour` is the Mixer's FIRST reference type** (every other interpolated field is a
   * scalar), so a crossfade with any other dye preset is a free test of that path. It is written as a fresh
   * array literal for the ordinary reason a reference type must be: a shared one would alias.
   *
   * **`rgb/a` is scale-invariant, so the HUE READ DIVIDES OUT EVERY SLIDER** — `opacity`, `injectionRadius`
   * and `advectionStrength` change how much dye there is and where, never what colour it is. If the plume
   * looks the wrong colour, `fixedColour` is the only suspect; if it is invisible, they are the suspects and
   * `fixedColour` is not.
   *
   * **The figure is `plumeKnotWaves()` at 13 000** — index spacing 1.67–2.38 px over the window, so the iso
   * surface has gaps to merge across (`P4`) and the frame keeps the unfilled background `P6` needs. `'dye'` is
   * also the one tint source whose data can be ABSENT at runtime, in which case it degrades to `'ramp'` — not
   * reachable here, because this preset authors the dye itself.
   *
   * ## The 2026-09-20 review (owner): *"use another figure than Quader … and change the colour scheme to
   * something more colourful and shiny, otherwise it looks good"*
   *
   * The figure half is `plumeKnotWaves()`, whose own doc block carries the exclusions, the derivation and the
   * geometry. Two things about the colour half are worth more than the numbers:
   *
   * ⚠️ **THE OUTPUT CHANNEL IS THE SURFACE, NOT THE INDEX, and the two disagree by a factor of two.** The
   * albedo is `mix(uTint, mixed, colourMix)` where `uTint` is the figure's stride-256 MEAN and `mixed` is the
   * per-PIXEL weighted mean of the particle colours. Spatially adjacent strands come from distant index zones,
   * so a scheme measured across the index reads far more varied than it looks: hue spread **0.218 across the
   * index collapses to 0.098 on the lit pixels**. The gain therefore has to come from `colorBase`/`colorAmp` —
   * the flat mean — and only the remainder from `colorFreq`. Measured over three instants on the lit pixels
   * only, at `colourMix 0.90`: the shipped grey read **saturation 0.300, value 0.921, hue spread 0.005**; this
   * scheme reads **0.535 / 0.867 / 0.098**. ⚠️ **Judging this on `state.colors` would have credited the index
   * spread and shipped a surface that is still one flat hue** (invariant 13's harder shape: the control moved
   * the right thing and the channel cannot show it).
   *
   * ⚠️ **"Not confusable with the dye" is a claim about the SURFACE's hue too, and one candidate step away
   * fails it at 0.1°.** `colorBase [208, 112, 184]` with `colorAmp [48, 72, 72]` — a plausible neighbour of
   * what ships — puts lit pixels exactly on the dye's 154.3°, because the per-pixel mean of a magenta and an
   * amber strand is not between them in HUE. The shipped scheme holds 111.6° at its closest, and the shipped
   * grey it replaced held only 53.8°. Re-measure this, do not reason about it, if any of the four colour
   * vectors changes.
   *
   * ⏳ **Card line:** *"A fixed dye says nothing about the figure, which is why it shows the FIELD: watch the
   * green plume spread outside the surface and decay. Every slider changes the amount, none the hue."*
   */
  'Fixed Dye Plume': {
    metadata: { name: 'Fixed Dye Plume', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'dye', 'liquid'] },
    generators: {
      type: 'lissajous', particleCount: 13000, waveSpeed: 0.05,
      rotation: [0, 0, 0.4], angle: [15, 0, 0],
      waves: plumeKnotWaves(),
      // Deliberately NOT green: the figure's colour must not be confusable with the dye's. Measured on the
      // SURFACE and not on the index — see the doc block. 111.6° is the closest any lit pixel comes to the
      // dye's hue over three instants; a rejected candidate one step away reached 0.1°.
      colorBase: [216, 104, 176], colorAmp: [40, 64, 80], colorFreq: [2, 3, 5], colorShift: [0.3, 0.45, 0.6],
    },
    renderer: { mode: 'liquid', glow: 2.0, decayFactor: 0.45, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'liquid', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      // ⚠️ **0.70, not 0.9 — `plumeKnotWaves()` is the larger figure and the two scales are what make the
      // extents comparable** (577×558 here against `quaderWaves()`' 569×541 at 0.9). The unfilled background
      // is still the instrument; it is 90–92 % of the frame rather than 92–95 %.
      speedFactor: 0.5, figureScale: 0.70,
      liquid: {
        // ⚠️ `kernelWidth: 2.0` IS a stop and `isoLevel: 1.8` was not — the two tracks have different grids,
        // so one half of a pair can be reachable while the other is not. 1.8025 is the stop next to 1.8.
        // ⚠️ **Both kept across the figure swap, and that was a measurement rather than an omission**: at this
        // pair the new figure reads coverage 7.84–9.88 % of frame, survive 0.35–0.60, largest component
        // 88–100 % of lit, 3–68 satellites — the same class as the quader's 5.20–7.85 % / 0.32–0.44 / 93–100 %
        // / 1–11, with more of the merging the mode is here to show.
        isoLevel: 1.8025, kernelWidth: 2.0,
        edgeSoftness: 0.15,
        // ⚠️ `'preset'`, not `'dye'` — see the doc block. The figure must keep its own colour.
        // ⚠️ `surfaceRamp` is INERT under `'preset'`: the ramp is read by sources 2 and 3 only. It is authored
        // anyway because it is this source's own documented degrade target, not because it shows.
        tintSource: 'preset', surfaceRamp: 'liquid',
        // 0.90 rather than 0.60: the per-pixel weighted mean of the particle colours is what carries the hue
        // VARIATION, so raising its weight is the only control that buys any (measured: surface hue spread
        // 0.068 at 0.75, 0.098 at 0.90). `Liquid Field Fill` authors 0.90 too.
        colourMix: 0.90, mixModel: 'light',
        // The shine half of the same review. ⚠️ **Under `'preset'` there is no LUT for `refraction` to shift,
        // so it reaches the image through the dispersion and scatter terms only — which is exactly what makes
        // it the COLOUR-PRESERVING shine control here**, where `specular` adds white and `edgeBrightness`
        // whitens the rim. Hence refraction 0.25 → 0.55 carries the "shinier" verdict, specular rises only to
        // 1.00, `edgeBrightness` is unchanged, and `thickness` 0.50 → 0.35 pays back the brightness the more
        // saturated palette costs (absorption is `exp(−t·uThickness·3)` and is applied LAST).
        refraction: 0.55, specular: 1.00, thickness: 0.35, edgeBrightness: 0.60,
      },
      dye: {
        enabled: true,
        decayRate: 0.975, opacity: 0.90,
        colourSource: 'fixed',
        // A fresh literal, and the Mixer's first reference-type field. Spring green: far from the figure's
        // neutral grey and from every material ramp, so its presence is never ambiguous.
        fixedColour: [0.15, 0.85, 0.55],
        injectionRadius: 26, advectionStrength: 1.2,
      },
    },
  },

  /**
   * **`Breathing Dye`** — index-mapped dye, owner-tuned. The carrier for `dye.mapping: 'index'`,
   * `colourSource: 'ramp'` and `showFigure: false`.
   *
   * Imported from an export (`Breathing Dye_20261019_203114.json`) and kept VERBATIM apart from one
   * substitution: `waves` is the shared `plumeKnotWaves()` call rather than the export's literal array,
   * **verified byte-identical before substituting**, so the builder link survives without changing a value.
   *
   * ⚠️ **THE FIGURE IS HIDDEN (`showFigure: false`), SO THIS IS A DYE-ONLY PRESET.** The curve still
   * moves, still paints and still stirs the field while drawing nothing itself — which is what makes it a
   * demonstration of `28.1`'s output channel as well as of index banding. `renderMode: 'star'` with no
   * material: nothing but the dye reaches the screen.
   *
   * **The figure is `plumeKnotWaves()`**, written for `Fixed Dye Plume` because every other builder filled
   * the frame and a dye needs the background it paints into. Its measurements carry at this
   * `particleCount` / `figureScale` / `speedFactor`: **index spacing 1.67–2.38 px** at 1024×768.
   *
   * **`cycles: 8` against the spatial-averaging limit.** The dye read is `rgb / a`, a weighted MEAN of
   * every deposit on a texel, so a mark of `injectionRadius` screen pixels averages roughly
   * `radius / spacing` consecutive particles and a band survives while one cycle spans many more:
   *
   *     particles averaged per mark  ~  8 / 1.67…2.38   =  3.4…4.8
   *     ceiling                      ~  13000 × 1.67 / 8  ≈  2700 cycles
   *     authored                        8  →  one band ≈ 1625 particles, ~400× the averaging width
   *
   * ⚠️ **`ramp: 'Sunset'` IS NOT A CYCLIC GRADIENT, so the index walk SEAMS once per cycle — eight times
   * here — and that is the owner's authored choice rather than an oversight.** Measured: its texel 0 is
   * `255,136,100` against texel 255's `255,136,15`, an end-to-end difference of **85**. `advectionStrength:
   * 1.3` is high enough that the flow smears the joins, which is presumably why they do not read as edges.
   * **Do not "fix" this by swapping to a `Cycle:` palette** — those are cosine-generated and seam-free
   * (difference exactly 0), so the swap would change the authored look, not repair it.
   *
   * ⚠️ **`blendMode: 'add'` with `decayRate: 0.99` and `opacity: 1`.** Under `add` the composite's fixed
   * point in the trail is `aC / (1 - k)`, so **Trail Decay is a brightness control for the dye here** —
   * lowering `decayFactor` dims the bands as well as shortening the trail.
   *
   * ⚠️ **`palette: 'Sunset'` with `paletteMapping: 'index'` is authored too, and it is NOT what colours
   * the dye.** The dye reads its own `ramp`; the palette colours the figure — which is hidden. It is kept
   * because the figure is one tick away from being visible again, and because the two settings agreeing on
   * `Sunset` is presumably deliberate.
   *
   * ⏳ **Card line:** *"The dye takes its colour from the particle ORDER, not from depth, and the figure
   * that paints it is switched off — watch the bands wrap along a curve you cannot see. Dye Cycles sets
   * how many; raise Dye Radius and they blur into one wash."*
   */
  'Breathing Dye': {
    metadata: {
      name: 'Breathing Dye',
      version: 2,
      designResolution: { width: 75, height: 75 },
      tags: ['demo', 'dye'],
    },
    generators: {
      type: 'lissajous',
      particleCount: 13000,
      waveSpeed: 0.05,
      rotation: [0, 0, 0.4],
      angle: [15, 0, 0],
      waves: plumeKnotWaves(),
      colorBase: [120, 180, 216],
      colorAmp: [40, 32, 24],
      colorFreq: [0.4763, 1, 1],
      colorShift: [0.2, 0.2, 0.2],
    },
    renderer: { mode: 'star', glow: 2, decayFactor: 0.45, blurRadius: 3, depthSize: 0, streaks: 0 },
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
      splatShear: 'tangent',
      ribbonWidth: 3,
      linesEnabled: false,
      lineWidth: 0.5,
      filmLook: 'Customize',
      palette: 'Sunset',
      paletteMapping: 'index',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'star',
      transMapEnabled: false,
      transMapStyle: 0,
      curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
      speedFactor: 0.5,
      figureScale: 0.7,
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
      dye: {
        enabled: true,
        decayRate: 0.99,
        opacity: 1,
        colourSource: 'ramp',
        fixedColour: [1, 0.35, 0.1],
        injectionRadius: 8,
        advectionStrength: 1.3,
        ramp: 'Sunset',
        blendMode: 'add',
        showFigure: false,
        mapping: 'index',
        cycles: 8,
      },
      customFilmLookParams: {
        glow: 5,
        depthSize: 0,
        depthBrightness: 0,
        depthDof: 0,
        depthColorShift: 0,
        lightingMode: 0,
        lightDir: [0.5, -0.7, 0.3],
        rimPower: 3,
        bloomEnabled: true,
        // ⚠️ **0.7, NOT 1.4 — AND THIS IS A RESTORE, NOT A RETUNE (2026-10-21).** Authored 10-19, between 27.1
        // dropping the stop the Narkowicz fit baked in and `ACES_EXPOSURE_BIAS` carrying it across, so the
        // authored value was compensating for a grading defect. Exposure is applied immediately before the
        // curve, so halving it is the EXACT algebraic inverse of that constant: this preset is bit-identical
        // to the frame the owner confirmed. **Do not 'restore' 1.4 — that is two stops hot.**
        bloomThreshold: 0.2,
        bloomIntensity: 0.7,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 0.7,
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

  /**
   * **`21.5e` — FLUID ADVECTION, the only field that transports the TRAIL instead of the particles.** One
   * preset in the library enables it and none is named for it. The confusion this demo exists to end is with
   * TransMap style 6 (`Fluid Feedback Bloom`): **feedback amplifies in place, advection transports** — that
   * one line is the card's whole job.
   *
   * ⚠️ **It advects what is ALREADY ON THE CANVAS, so it needs something to carry.** Hence
   * `decayFactor: 0.94` — a ~17-frame trail, long by this file's standards and the opposite of `P3`'s advice,
   * which applies when the feature owns a trail of its own. Advection owns no trail; it owns the figure's.
   * With a short trail there is nothing in flight and the feature reads as "slightly soft".
   *
   * **`blend: 0.75 / returnForce: 0.9`.** The field is 512² with a `HALF_TO_FLOAT` LUT (a measured 5x
   * speedup), so it is affordable to run it hard; the spring is what keeps the transported history from
   * walking off the figure permanently. The appeal is precisely the CONTRAST between a figure holding its
   * shape and its own past being dragged off it, so the two numbers must disagree: a high blend with a high
   * return force is a wash.
   *
   * **The figure is `cosmosWaves()` (`fm.amplitude` 16/16/64 — a wide velocity spread, its own reason for
   * existing in this file).** Advection's velocity comes from the particles, so a figure whose parts move at
   * very different speeds produces a structured field rather than a uniform drift. `P1`: the figure has to
   * cover the frame for an image-domain field to have anything to do.
   *
   * ⏳ **Card line:** *"Feedback amplifies in place, advection TRANSPORTS. The figure holds its shape while
   * its own trail is dragged off it — compare against `Fluid Feedback Bloom`, which is the other one."*
   */
  'Advection Carry': {
    metadata: { name: 'Advection Carry', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'advection', 'field'] },
    generators: {
      type: 'lissajous', particleCount: 8000, waveSpeed: 0.05,
      rotation: [0, 0, 0.6], angle: [0, 0, 0],
      waves: cosmosWaves(),
      colorBase: [96, 128, 176], colorAmp: [96, 64, 64], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.15, 0.35, 0.55],
    },
    // A LONG trail on purpose — the feature transports it. See the doc block.
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.94, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      transMapEnabled: false,
      speedFactor: 0.45,
      fluidAdvection: { blend: 0.75, returnForce: 0.90 },
    },
  },

  /**
   * **`21.5f` — the FORCE GATE on `age`: one population, two behaviours.** All three gate sources ship
   * unused. Age-gating is the one that tells a story — newborn particles are blown by the field while the
   * settled body holds the figure — and it is the clearest evidence the gate exists at all, because every
   * one of the library's force-field presets pushes the whole population uniformly.
   *
   * ⚠️ **The gate needs a LIVE MATERIAL for this source** (`prepareGate()` reads `state.lifetimes`, which
   * `MaterialProcessor.update()` never fills while the preset is `'None'`), and it needs a LIVE FORCE FIELD
   * (`transMapForceBlend > 0` over a chain with a field layer). Both are authored here: `Ember` and a style-5
   * flow. With either missing the gate reports itself INACTIVE — the honest failure, not a silent one.
   *
   * ⚠️ **`transMapForceGateHalfLife: 1.0` is the number that decides whether anything is visible, and its
   * unit is SECONDS of particle age.** `lifetimes` is an unbounded accumulating age, so the gate maps it
   * through `exp(-age·ln2/halfLife)`: at 1.0 s a particle is at half force, at 3 s at an eighth. Too long
   * and the whole population reads as ungated; too short and everything is gated off within a frame, which
   * is indistinguishable from `Force Blend` being 0.
   *
   * ⚠️ **`transMapForceGateAmount: 0.9`, not 1.0, and the gate is a LERP FROM 1** — `g = 1 + amount·(a01−1)`
   * — so 0 is byte-identical to ungated and 0.9 leaves the old body 10 % of the force rather than freezing
   * it. A fully-gated tail reads as two unrelated pictures; a tenth of the push keeps them one figure.
   *
   * **`Invert` is the second reading of this same preset** and costs nothing to try: it hands the force to
   * the OLD particles instead, so the figure sheds its settled body and keeps a crisp young core.
   *
   * **The figure is `nebulaWaves()` (extent 328, arc coherence 4.72 — deliberately incoherent, its own
   * measurement).** An age gate needs the two populations to be spatially MIXED, or "young" and "old" would
   * just name two regions of the figure and the gate would be indistinguishable from a static mask. An
   * incoherent figure scatters consecutive indices, which is the property that makes the split read as
   * behaviour rather than as geometry.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED. The body below is the owner's Lab export, not a
   * derivation**, and only four values moved: `filmLook` `Legacy` → **`Legacy Graded`**,
   * `material.emissionIntensity` 3.0 → **4.0**, `material.heatGain` 0.7 → **1.8**, and the one-layer chain
   * collapsed into the `transMapStyle: 5` scalar it was always equal to. **Every gate value survived
   * untouched** — `age`, amount 0.9, half-life 1.0 s, `Force Blend` 0.7, `Warp Mix` 0.35 — which is the
   * independent agreement a derivation cannot give itself: the four paragraphs above were checked against a
   * frame and none of their numbers needed moving.
   *
   * ⚠️ **THE EXPORT ALSO SETTLED A QUESTION THE DERIVATION GOT WRONG: this demo has never run `Fire Rise`.**
   * The flow config was authored on the chain LAYER, and no reader ever reads a layer's `proceduralFlow` —
   * `main.ts` reads `overlay.proceduralFlow`. So the live field was `DEFAULT_PROCEDURAL_FLOW` (`Gentle
   * Drift`), which is what came back in the export and what the owner judged. It is now authored at overlay
   * level, where it is read. **`transMapForceReturn: 1.5` and `transMapForceGateInvert: false` are absent
   * from the export because the export SUPPRESSES them at exactly those values, not because they were
   * changed** — `main.ts` emits `transMapForceReturn` only when `!== 1.5` and `Invert` only when true, so
   * both are kept below. *Diff an export against the default constants before adopting it.*
   *
   * ⏳ **Card line:** *"The field only blows the young: half force at one second of age. Tick `Invert` and
   * the story reverses — the settled body is dragged and the young core holds."*
   */
  'Age Gate Embers': {
    metadata: { name: 'Age Gate Embers', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'force-gate', 'material'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.05,
      rotation: [0, 0, 0.05], angle: [0, 0, 0],
      waves: nebulaWaves(),
      colorBase: [176, 88, 32], colorAmp: [64, 40, 16], colorFreq: [0.02, 0.03, 0.04], colorShift: [0.45, 0.25, 0.15],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.86, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.4,
      transMapEnabled: true, transMapStyle: 5,
      // ⚠️ **THE FIELD THE GATE GATES, and it is authored HERE rather than on a chain layer because the
      // layer's copy is SERIALISATION ONLY** — `main.ts` reads `ov.proceduralFlow` (~4376) and nothing reads
      // `layer.proceduralFlow`. Until 2026-09-21 this body carried a one-layer style-5 chain whose
      // `proceduralFlow` named `Fire Rise`, and **that block was never read**: the demo has always run
      // whatever `currentProceduralFlow` held, which at a cold start is `DEFAULT_PROCEDURAL_FLOW`. The
      // owner's export proves it — the live values came back as the seven defaults below, Gentle Drift
      // included. They are authored explicitly rather than left absent because `currentProceduralFlow` is
      // STICKY (the assign is `if (ov.proceduralFlow)`, with no reset), so an unauthored block means the
      // field is inherited from whichever preset was loaded before this one. **Restoring Fire Rise would be
      // a retune of an accepted frame — propose it, do not do it here.** The chain array is gone because
      // `isLegacyExpressible()` reduces it to exactly `transMapStyle: 5` above (`proceduralFlow` is not one
      // of the blocks that forces the array out, precisely because it is not read from the layer).
      proceduralFlow: { strength: 0.3, scale: 1.5, curlAmount: 0.5, direction: [0, -1], radial: 0, evolutionSpeed: 0.8, archetype: 'Gentle Drift' },
      transMapWarpMix: 0.35,
      // The FORCE path, which is what the gate scales — not the image warp above. Both read the same field.
      transMapForceBlend: 0.7, transMapForceReturn: 1.5,
      transMapForceGateBy: 'age', transMapForceGateAmount: 0.9,
      transMapForceGateInvert: false, transMapForceGateHalfLife: 1.0,
      // ⚠️ `emissionIntensity` and `heatGain` are the OWNER's values (2026-09-21), not derived ones — see the
      // doc block. `heatGain` 1.8 is a 2.6x rise on a `velocity` heat source, so the gate's two populations
      // separate by COLOUR as well as by motion; do not tune either back towards the numbers above it.
      material: {
        preset: 'Ember', splatRadius: 7, coreBrightness: 2.0, haloStrength: 0.7, falloffExponent: 4.5,
        thermalLag: 0.45, emissionIntensity: 4.0, heatMode: 'velocity', heatGain: 1.8,
        blendMode: 'additive', colourRamp: 'fire', velocityStretch: 1.0,
      },
    },
  },

  /**
   * **`21.5g` — the FORCE GATE on `temperature`, and the one body in the trio that runs it INVERTED.** So the
   * COLD half of the figure is what the field drags and the hot cores hold their place — frost sliding off a
   * shape that stays put. Paired with `Age Gate Embers` on all three axes `21.5g` distinguishes: the gating
   * QUANTITY, the material class (Ice against Ember) and now the POLARITY, so the pair teaches *"the gate has
   * sources and a direction"* rather than *"the gate has a number"*.
   *
   * ⚠️ **`transMapForceGateInvert: true` BELONGS ON THIS SOURCE AND WOULD MISBEHAVE ON `'age'`, which is an
   * algebraic fact and not a preference.** The gate is `g = 1 + amount·(a01 − 1)` and `invert` flips `a01`
   * before it. For `temperature` and `depth`, `a01` is the already-normalised attribute clamped to [0,1], so
   * inverting is a true swap of the two populations. For `'age'` it is `exp(-age·k)` over an UNBOUNDED age —
   * which decays toward 0, so an inverted age gate sends `a01` toward **1** for everything older than a couple
   * of half-lives and the gate quietly becomes a no-op on all but the newest particles. **Inverting an
   * exponentially-mapped source saturates; inverting a normalised one does not.** Hence the polarity is
   * demonstrated here.
   *
   * ⚠️ **The inversion does NOT reach the untracked tail.** `prepareGate` seeds `a01 = 1` for every slot past
   * the attribute array's length and applies `invert` only INSIDE that bound, so an unfed slot keeps FULL force
   * under either polarity. At 12 000 particles with a live material there is no tail here — but a reader who
   * shortens the array and expects the inverted half to appear there will not find it, and nothing reports it.
   *
   * ⚠️ **`heatMode: 'velocity'` is what makes the gate legible here, and it is a choice about the GATE, not
   * about the material.** Temperature is whatever the material computes; with `'position'` the gate would
   * follow a stationary field and read as a static mask, and with `'age'` it would duplicate `21.5f`.
   * Velocity heat plus the inversion means the SLOW parts of the figure are the dragged parts, so the gate
   * reads as the field preferring stillness — and `heatScale = 1 − coolFactor`, so the ramp's cool end is where
   * the gate now opens.
   *
   * ⚠️ **`transMapForceGateAmount: 0.95` with no `HalfLife`.** The half-life is read for `'age'` only; not
   * authoring it here is deliberate, so that a reader comparing the two bodies sees which fields belong to
   * which source. `temperatures` is already normalised to [0,1] by its writer, so the gate uses it directly.
   *
   * **The field is a style-0 STATIC field, not style 5** — a second difference from `21.5f`, and it puts the
   * force on the `analytic` path (`staticStyles.length > 0`) rather than the `texture` one. `Diagonal Shear`
   * at `drift: 0.2` gives a moving lattice, so the dragged cool material visibly slides along the shear while
   * the hot cores hold the figure's shape.
   *
   * **The figure is `waterIceWaves()` in its own 80x60 box, planar by construction** (the Z axis is silent on
   * all three waves). Flat is right here for the same reason it is right for crystals: the gate's two
   * populations must be distinguishable by BEHAVIOUR, and a deep figure adds a depth ordering that competes
   * with them.
   *
   * ⏳ **Card line:** *"The same gate, a different source and the opposite polarity: the cool (slow) frost
   * slides along the shear while the hot cores hold the figure. Untick `Invert` to swap which half is dragged —
   * on this source it is a clean swap, which is not true of the age gate."*
   */
  'Temperature Gate Frost': {
    metadata: { name: 'Temperature Gate Frost', version: 2, designResolution: { width: 80, height: 60 }, tags: ['demo', 'force-gate', 'material'] },
    generators: {
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      rotation: [0, 0, 0.1], angle: [0, 0, 0],
      waves: waterIceWaves(),
      colorBase: [120, 168, 200], colorAmp: [48, 56, 64], colorFreq: [0.05, 0.05, 0.05], colorShift: [0.2, 0.3, 0.4],
    },
    // `blendMode: 'alpha'` below, so this decay is a plain trail length — an ADDITIVE material would cap it.
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.90, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.5,
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Diagonal Shear', strength: 0.45, detail: 1.2, drift: 0.20 } },
      ],
      transMapWarpMix: 0.4,
      transMapForceBlend: 0.8, transMapForceReturn: 1.2,
      transMapForceGateBy: 'temperature', transMapForceGateAmount: 0.95,
      // ⚠️ TRUE here, and on this source only — see the doc block: inverting the exponentially-mapped `'age'`
      // gate saturates toward full force instead of swapping the two populations.
      transMapForceGateInvert: true,
      material: {
        preset: 'Ice', splatRadius: 9, coreBrightness: 1.4, haloStrength: 1.1, falloffExponent: 3.5,
        thermalLag: 0.25, emissionIntensity: 1.2, heatMode: 'velocity', heatGain: 1.0,
        blendMode: 'alpha', colourRamp: 'ice', velocityStretch: 1.0,
      },
    },
  },

  /**
   * **`21.5g`, folded — the FORCE GATE on `depth`, and it is the one source that needs NO MATERIAL.**
   * `prepareGate()` reads `state.depths`, which every generator always fills; only `'age'` and
   * `'temperature'` wait on `MaterialProcessor`. ⚠️ **So the gate's material precondition is PER-SOURCE, not
   * blanket** — the plan's `21.5f`/`21.5g` cards and `CLAUDE.md`'s force-gate row both state it as blanket,
   * which is true of the two sources they discuss and false of this one. This preset is that fact made
   * visible: a gated force field in `star` mode with no material anywhere.
   *
   * ⚠️ **`P8` is mandatory here in a way it is not for the other two gates: a flat figure has a constant
   * depth and the gate is then a global multiplier on the force** — a control that appears to work and does
   * nothing (invariant 13). `mastersLightWaves()` is chosen for its measured z-span of 666, the deepest of
   * its candidate set, and `angle: [30, 30, 0]` presents it as a TILTED PLATE rather than edge-on, which is
   * what turns that span into a visible near-to-far ordering. `Angle` is the initial pose, not a speed.
   *
   * **Which end moves.** `depths` runs 0 far to 1 near, and the gate is `g = 1 + amount·(depth−1)`, so at
   * `amount: 1.0` the near edge of the plate takes the full field and the far edge is frozen. The plate
   * therefore peels: its near half drifts with the swell while its far half holds the figure — a veil coming
   * off a solid. `Invert` pins the near edge instead and the plate reads as receding.
   *
   * **The field is `Coarse Swell` at `drift: 0.15`** — broad and slow. A fine field would move the near half
   * as noise, and the reading here is a whole surface separating, not a texture.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20 — `palette: 'Cycle: Azure'` under `paletteMapping: 'index'`, the ONE
   * change.** It OVERRIDES the authored `colorBase`/`colorAmp`/`colorFreq` below (precedence palette >
   * material ramp > preset colour) and it reaches the shader because `filmLook: 'Cinematic'` is one of the
   * three looks carrying `palette: 'none'` and therefore ABSTAINS — had the look been one of the other
   * twelve, the pair would have been overwritten and the export would have looked like a no-op. `'index'`
   * runs the hue ALONG the plate's structure rather than across its depth, which is the point of the choice
   * here: a depth-mapped palette would colour exactly the axis the gate is there to show, and the two
   * gradients would then be unreadable against each other.
   *
   * ⏳ **Card line:** *"The only gate source that works with no material: the plate's NEAR half peels away
   * while its far half holds. Needs a tilted pose — flatten the figure and the gate becomes a volume knob."*
   */
  'Depth Gate Veil': {
    metadata: { name: 'Depth Gate Veil', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'force-gate', 'depth'] },
    generators: {
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      // NO rotation and a tilted pose: the depth ordering must be stable for a depth gate to read as a
      // surface separating rather than as a flicker.
      rotation: [0, 0, 0], angle: [30, 30, 0],
      waves: mastersLightWaves(),
      colorBase: [144, 160, 192], colorAmp: [64, 56, 72], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.25, 0.35, 0.45],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.88, blurRadius: 3, depthSize: 0.6, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Cinematic', speedFactor: 0.4,
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Coarse Swell', strength: 0.5, detail: 0.75, drift: 0.15 } },
      ],
      transMapWarpMix: 0.3,
      transMapForceBlend: 0.75, transMapForceReturn: 1.0,
      // ⚠️ No `material` block in this preset AT ALL — that is the point of it. `'depth'` is the one source
      // that survives with none, and `star` is the mode that needs none.
      transMapForceGateBy: 'depth', transMapForceGateAmount: 1.0,
      // ⚠️ Kept EXPLICIT although the export omits it (`false` is the default and the export gate drops it) —
      // the doc block's "which end moves" paragraph is about this field, so a reader must find it here.
      transMapForceGateInvert: false,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20 — the only change to this body. See the doc block: `Cinematic`
      // abstains, so this pair is what reaches the shader and it overrides `generators.colorBase` &c.
      palette: 'Cycle: Azure', paletteMapping: 'index',
    },
  },

  /**
   * **`21.5h` — the SYMMETRY MIRROR, which is meaningless without a fold.** One preset in the library sets
   * `symmetryMirror` (`Material Organic`, fold 3) and three set a fold with no mirror. The pair is the
   * subject here: the fold is a rotation group, the mirror adds the reflection that turns it into a dihedral
   * one, and the difference is only visible on a figure with a strongly ASYMMETRIC arm.
   *
   * ⚠️ **On a symmetric figure the mirror is invisible BY CONSTRUCTION** — reflecting a motif that is already
   * its own mirror image changes nothing. That is why this preset uses `elphesWaves()` (extent 423, the
   * largest in the library, its own measurement) rather than a rosette: its arms differ from each other, so
   * folding them produces a pinwheel and mirroring them produces a kaleidoscope. Those are two pictures, and
   * one checkbox separates them.
   *
   * **`symmetryFold: 5` — odd on purpose.** An even fold already contains the reflection for many motifs, so
   * the mirror's contribution shrinks to a phase shift; at 5 the two states are unambiguous. The operation is
   * a model-space point group on XY applied IMMEDIATELY BEFORE the rotation and clamped to 1…12, so it is
   * part of what the figure IS rather than a post-process — `figureScale` and the pose apply after it.
   *
   * ⚠️ **Both fields are on the EXPORT path by ADDITION rather than by match**, and the Mixer must SNAP the
   * fold (invariant 16: a fold of 3.5 is not a figure). Check both directions when editing this body.
   *
   * **A palette, because the fold multiplies structure and not colour.** `Prismatic` on `paletteMapping:
   * 'phase'` gives each arm of the rosette its own hue, which is what makes five copies read as five copies
   * rather than as one thick shape.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20 — `filmLook: 'Legacy Graded'` → `'Customize'`, and the abstention
   * SURVIVES the change by a different route.** The old reading was "`Legacy Graded` is one of the three looks
   * carrying `palette: 'none'`, so the `overlay.palette` pair reaches the shader"; the new bundle carries
   * `palette: 'none'` too, so the conclusion holds — but it now holds because of a field authored HERE rather
   * than because of which of the fifteen bundles was named. `'none'` in a bundle means *this bundle makes no
   * colour decision*; it does not clear the pair. Seven of the bundle's fields depart from `Legacy Graded`
   * (marked in the body): the grade is brighter (`exposure` 1.9), the halo wider (`bloomThreshold` 0.25) and
   * the sprites now carry depth shading and a RIM light, which is what separates five overlapping arms into
   * five surfaces instead of five hues on one flat shape.
   *
   * ⏳ **Card line:** *"Fold 5 makes five copies; the `Mirror` box reflects each one. Untick it and watch the
   * kaleidoscope become a pinwheel — the figure's arms are asymmetric, which is what makes the box visible."*
   */
  'Mirror Fold Rosette': {
    metadata: { name: 'Mirror Fold Rosette', version: 2, designResolution: { width: 100, height: 60 }, tags: ['demo', 'symmetry'] },
    generators: {
      type: 'lissajous', particleCount: 6000, waveSpeed: 0.05,
      rotation: [0, 0, 0.08], angle: [0, 0, 0],
      waves: elphesWaves(),
      colorBase: [128, 128, 128], colorAmp: [96, 96, 96], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.92, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', speedFactor: 0.4,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: `'Legacy Graded'` → `'Customize'` with the seven departures below.
      // Every one of the 22 fields is authored because the block is applied with `Object.assign` — an omitted
      // field is INHERITED from the previously live look, so a partial block makes the grade depend on which
      // preset the user came from. The unmarked values ARE `FILM_LOOKS['Legacy Graded']`'s own.
      filmLook: 'Customize',
      customFilmLookParams: {
        // Depth shading + rim light, all four LG-zero: this is what makes the folded arms read as surfaces.
        glow: 5.5, depthSize: 0.35, depthBrightness: 0.2, depthDof: 0, depthColorShift: 0.15,
        lightingMode: 2, lightDir: [0.5, -0.7, 0.3], rimPower: 3,          // 2 = Rim (LG: 0 = None)
        bloomEnabled: true, bloomThreshold: 0.25, bloomIntensity: 0.3,     // threshold: LG's 0.6 -> 0.25
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.9,         // exposure: LG's 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1, vignette: 0,
        // ⚠️ `'none'` here means *this bundle makes no colour decision* — it does NOT clear the pair below.
        palette: 'none', paletteMapping: 'depth',
      },
      transMapEnabled: false,
      // The PAIR. A mirror at fold 1 is a no-op, so the two belong together in every reading of this preset.
      symmetryFold: 5, symmetryMirror: true,
      palette: 'Prismatic', paletteMapping: 'phase',
    },
  },

  /**
   * **`21.5i` — the `fire-smoke` material ramp, the one ramp of the seven that crosses TWO REGIMES in one
   * curve.** Every other ramp describes one substance; this one hands over from burning to smouldering
   * inside a single lookup, so the demo's subject is the HAND-OFF and not either end. The fire and smoke
   * demos above own the ends.
   *
   * ⚠️ **The figure must have both FAST and SLOW regions or the ramp cannot resolve across itself.**
   * `barrockWaves()` is chosen for exactly that: median heat 0.77 with a hot fraction of 0.57 at extent 17 —
   * the hottest-running COMPACT figure in the library (its own measurement), with high speed contrast between
   * its inner and outer arcs. On a uniform-speed figure a velocity-driven ramp samples one narrow band and
   * the crossover never appears.
   *
   * ⚠️ **`blendMode: 'alpha'`, and that decision owns the `decayFactor` above it.** An ADDITIVE material CAPS
   * the trail, so the cool half of this ramp would be swallowed by accumulated brightness — the crossover
   * would read as "bright, then slightly less bright". Under alpha the dark smoke end stays dark.
   * ⚠️ **`decayFactor` changes MEANING with `blendMode`; never carry a decay across a blend-mode change.**
   *
   * **`heatGain: 1.0` and `thermalLag: 0.30`.** Gain 1.0 uses the ramp's full range — a lower gain
   * compresses the sample into the hot end, which is the failure mode that makes a two-regime ramp look like
   * a one-regime one. The lag is short enough that a particle rounding a fast arc heats visibly and cools
   * again on the slow one, which is the motion that animates the hand-off.
   *
   * **Buoyancy, because the crossover wants a DIRECTION.** With the hot end rising and the cool end lagging,
   * the ramp's two regimes separate in space as well as in colour, so the frame shows the transition rather
   * than a mixture of it. ⚠️ `material.emissionIntensity` cannot reach a crystal — irrelevant here (none),
   * stated because it is the neighbouring trap.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20 — `smokeThreshold` 0.25 → 0.07 with `smokeOpacity` 0.40 → 0.2, and
   * they are ONE change.** The threshold no longer sits just under the ramp's turnover, which is what the
   * pre-export body aimed at: at 0.07 nearly the whole population qualifies as smoke, so the smoke pass stops
   * being a second substance drawn beneath the fire and becomes the medium the fire moves through — and the
   * halved opacity is what keeps that from flooding the frame. Do not carry either value alone: a 0.07
   * threshold at the old 0.40 opacity is a grey wash, and 0.2 at the old threshold is nearly invisible smoke.
   *
   * ⚠️ **The export also turns SPARKS on** — `threshold: 0.6` (the hot end of the ramp only), `poolSize: 500`
   * at 5 per frame, `gravity: 110` against `ejectionSpeed: 0.9`. They add a THIRD POPULATION rather than a
   * third colour: slot order is `[wave][sparks][liquid][crystals]`, so the sparks are their own pool and the
   * `fire-smoke` ramp above is untouched by them. That matters for this demo's claim — the hand-off is still
   * read off one ramp; the sparks mark where on the figure the hot end is being sampled.
   *
   * ⏳ **Card line:** *"One ramp, two substances: watch a particle heat on the fast arc and smoulder on the
   * slow one. The fire and smoke demos show the ends — this is the crossover between them."*
   */
  'Fire Smoke Crossover': {
    metadata: { name: 'Fire Smoke Crossover', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'material', 'fire'] },
    generators: {
      type: 'lissajous', particleCount: 5000, waveSpeed: 0.05,
      rotation: [0, 0, 0.06], angle: [0, 0, 0],
      waves: barrockWaves(),
      colorBase: [160, 96, 48], colorAmp: [64, 48, 24], colorFreq: [0.02, 0.03, 0.05], colorShift: [0.4, 0.25, 0.1],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.90, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.45,
      transMapEnabled: false,
      material: {
        preset: 'Fire', splatRadius: 12, coreBrightness: 1.6, haloStrength: 0.9, falloffExponent: 2.5,
        thermalLag: 0.30, emissionIntensity: 1.6, heatMode: 'velocity', heatGain: 1.0,
        // ⚠️ ALPHA, not additive — see the doc block. The cool half of the ramp depends on it.
        blendMode: 'alpha', colourRamp: 'fire-smoke', velocityStretch: 1.0,
      },
      buoyancy: {
        enabled: true, strength: 0.9, returnForce: 1.6, turbulence: 0.4, maxOffset: 120,
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: threshold 0.25 -> 0.07 AND opacity 0.40 -> 0.2, one change in two
        // fields. See the doc block — neither value survives being carried without the other.
        curlOctaves: true, smokeThreshold: 0.07, smokeOpacity: 0.2, smokeDissipation: 0.965,
      },
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: sparks ADDED. `threshold: 0.6` fires only on the ramp's hot end, so
      // the pool marks where the crossover is being sampled rather than adding a colour of its own.
      sparks: {
        enabled: true, poolSize: 500, threshold: 0.6, ejectionSpeed: 0.9, gravity: 110, drag: 1.5,
        minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3, maxSparksPerFrame: 5,
      },
    },
  },

  /**
   * **`21.6a` — TIME WARP (style 8) on `source: 'field'`: one figure moving at several speeds at once.** The
   * style ships with `amount: 0`, which is byte-identical to no layer, so **the whole feature is unreached by
   * the library** — this is the first of its two demos.
   *
   * ⚠️ **Style 8 is WEIGHTLESS and `requiresField`, so a chain holding it ALONE is inert** — it lags the frame
   * by the *field's own magnitude*, and with no field every pixel's weight is zero. The companion here is a
   * style-0 static field, and the pairing is the design rather than a formality: `'field'` weights the lag by
   * the summed chain offset, so **the parts of the figure the warp pushes hardest are exactly the parts that
   * lag**. Motion and smear coincide, which is what reads as "different speeds" instead of "a soft frame".
   *
   * ⚠️ **`drift: 0.35` — `P7` in its literal form.** A static field with `drift: 0` gives every pixel a fixed
   * lag, and a fixed lag is a static blur: the feature would be *authored, live and invisible*. The field has
   * to MOVE for the lag pattern to move with it. All 203 shipped presets carry `drift: 0`, which is one
   * reason this is a demo and not a preset.
   *
   * ⚠️ **`speedFactor: 0.25` is load-bearing.** A temporal effect is only legible if the figure's own motion
   * is slower than the lag it is being given; at full speed the smear is shorter than one frame's travel and
   * reads as motion blur, which is a different (and already-shipped) picture.
   *
   * **The figure is `cylinderWaves()` — the sparsest in the library (0.50 px index spacing at 10 000, its own
   * measurement) and a rigid geometric lattice.** Both properties are chosen for this feature: `P4`'s gaps let
   * the lagging copy be seen BESIDE the current one rather than inside it, and a lattice has straight lines,
   * which are the only shapes whose distortion a viewer can read exactly.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20 — `timeWarp.amount` 0.65 → 0.79.** The reason for staying under 1.0 is
   * unchanged (at the top of the range the current frame's contribution gets small enough that the figure
   * loses its edges); the owner simply took it as far toward that limit as the lattice's straight lines
   * survive. Judge any further move on the EDGES, not on the length of the smear.
   *
   * ⚠️ **The same export re-grades the preset and gives it a PALETTE, which changes what the demo is made of.**
   * `filmLook: 'Legacy Graded'` → `'Customize'` (six departures, marked in the body) plus `palette: 'Neon'`
   * under `paletteMapping: 'index'`. Two consequences worth stating because neither is visible in the body:
   * the authored `colorBase`/`colorAmp`/`colorFreq` below are now OVERRIDDEN (palette > ramp > preset colour),
   * and `'index'` runs the hue along the lattice's own index order — so the lagging copy and the current one
   * are drawn in the SAME hue at the same place, which is what keeps the smear reading as one figure at two
   * speeds rather than as two coloured figures.
   *
   * ⏳ **Card line:** *"The lattice's pushed parts lag and its held parts do not — one figure at several
   * speeds. Set `Drift` to 0 and the whole effect becomes a static blur; that is the trap it demonstrates."*
   */
  'Time Warp Lattice': {
    metadata: { name: 'Time Warp Lattice', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'time-warp'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0.12], angle: [0, 0, 0],
      waves: cylinderWaves(),
      colorBase: [140, 170, 200], colorAmp: [60, 50, 70], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.2, 0.3, 0.4],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.82, blurRadius: 2, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: `'Legacy Graded'` → `'Customize'` with the six departures below.
      // All 22 fields authored — the block is applied with `Object.assign`, so an omitted field is INHERITED
      // from the previously live look. The unmarked values ARE `FILM_LOOKS['Legacy Graded']`'s own.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5.5, depthSize: 0.35, depthBrightness: 0.25, depthDof: 0, depthColorShift: 0,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3,
        // Threshold well DOWN at unchanged intensity: a wide soft halo on the lattice's lines, which is what
        // lets the lagging copy be seen beside the current one instead of only under it (LG: 0.6/0.3).
        bloomEnabled: true, bloomThreshold: 0.25, bloomIntensity: 0.3,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.9,         // exposure: LG's 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.15, vignette: 0,
        // ⚠️ `'none'` here means *this bundle makes no colour decision* — it does NOT clear the pair below.
        palette: 'none', paletteMapping: 'depth',
      },
      // ⚠️ OWNER-TUNED EXPORT: this pair OVERRIDES `generators.colorBase` &c. `'Neon'` is the cosine palette,
      // not `FILM_LOOKS['Neon']` — the two share a name and only the tooltips separate them.
      palette: 'Neon', paletteMapping: 'index',
      // ⚠️ 0.25 — the lag has to be long relative to the figure's own travel. See the doc block.
      speedFactor: 0.25,
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        // The FIELD half. Weightless style 8 below reads this layer's offset as its per-pixel lag weight.
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Diagonal Shear', strength: 0.55, detail: 1.0, drift: 0.35 } },
        // The MODIFIER half. `weight` is ignored for a weightless style but is written anyway: the UI and the
        // export round-trip it, and a `weight: 0` row reads to a human as a muted one.
        { style: 8, enabled: true, weight: 1.0,
          // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: 0.65 -> 0.79, still short of the edge-destroying top.
          timeWarp: { amount: 0.79, source: 'field' } },
      ],
      transMapWarpMix: 0.6,
    },
  },

  /**
   * **`21.6b` — the SAME style on `source: 'density'`, which is the inverse picture.** `'field'` lags what the
   * warp is pushing; `'density'` lags what the trail has ACCUMULATED, so the bright core drags and the sparse
   * outer arcs stay crisp — **the inverse of a global blur**, which softens exactly the thin structure a blur
   * destroys first. The pair `21.6a`/`21.6b` exists because one preset cannot show both readings of one
   * dropdown, and the dropdown is the feature.
   *
   * ⚠️ **The figure must have a real density GRADIENT or the source cannot be distinguished from `'field'`.**
   * `miracleWaves()` is the symmetric centred rosette — its arcs converge on the middle, so accumulated alpha
   * is high in the core and low at the tips by construction. A figure of uniform density gives every pixel
   * the same weight, at which point both sources degrade to a frame blend and the demo asserts nothing.
   *
   * **The field companion is style 5 (`Procedural Flow`), not style 0** — a second difference from `21.6a`,
   * and it puts the requirement on the texture path rather than the analytic one. `Ocean Current` at stock
   * values is broad and slow (`evolutionSpeed: 0.3`), so the lag pattern evolves over seconds rather than
   * frames, which is the timescale `P11` asks the viewer to judge over.
   *
   * ⚠️ **`decayFactor: 0.92`, higher than `21.6a`'s 0.82, and that is a consequence rather than a taste.**
   * `'density'` reads the trail buffer, so the trail is the feature's INPUT: a short trail leaves it almost
   * nothing to weight, and the readable difference between the two sources collapses.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20 — the grade ONLY: `filmLook: 'Legacy Graded'` → `'Customize'` with
   * seven departures (marked in the body), no change to the chain, the figure or the trail.** `exposure: 2.3`
   * is the highest in this file and it is doing the work this demo needs: `'density'` weights the lag by
   * ACCUMULATED alpha, and alpha compositing is bounded below `s`, so the core's extra accumulation is a small
   * absolute difference that an ungraded blit puts in the bottom third of the 8-bit range. The grade is what
   * makes "the dense core smears while the thin tips stay sharp" a visible claim rather than a true one.
   * `lightingMode: 2` (Rim) + `depthColorShift: 0.2` are the other half: they give the smeared core an edge,
   * so the smear has a boundary to be seen against.
   *
   * ⚠️ **The export also carries an `overlay.proceduralFlow` block, and it is NOISE — do not adopt it.** It is
   * emitted whenever the chain holds a style-5 layer (`main.ts:5092`) and it carries the GLOBAL flow config,
   * which here is byte-identical to `DEFAULT_PROCEDURAL_FLOW` (`Gentle Drift`). The flow this preset actually
   * uses is the PER-LAYER block in the chain below. Adopting the global one would author a second, unrelated
   * `Ocean Current`-vs-`Gentle Drift` reading into a body whose whole point is the per-layer one. The export's
   * `paletteMapping: 'index'` with no `palette` beside it is noise for a different reason: the COMPOSED body
   * already carries it from the `21.4d` migration (`palettecheck` §A lists this preset among the twelve `index`
   * bodies that name no palette), so the export is round-tripping a migrated field, not recording a choice —
   * and with no palette it resolves bit-identically to no mapping at all (§C).
   *
   * ⏳ **Card line:** *"Same style, other source: the dense core smears while the thin tips stay sharp — the
   * inverse of a blur. Switch `Source` to `Field` and watch which half of the rosette changes."*
   */
  'Time Warp Smear': {
    metadata: { name: 'Time Warp Smear', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'time-warp'] },
    generators: {
      type: 'lissajous', particleCount: 8000, waveSpeed: 0.05,
      rotation: [0, 0, 0.18], angle: [0, 0, 0],
      waves: miracleWaves(),
      colorBase: [176, 128, 96], colorAmp: [64, 56, 40], colorFreq: [0.05, 0.08, 0.12], colorShift: [0.35, 0.2, 0.1],
    },
    // A LONG trail, because `'density'` reads it. See the doc block.
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.92, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: `'Legacy Graded'` → `'Customize'` with the seven departures below —
      // the ONLY change to this preset. All 22 fields authored (`Object.assign`: an omitted field is INHERITED
      // from the previously live look). The unmarked values ARE `FILM_LOOKS['Legacy Graded']`'s own.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5, depthSize: 0.3, depthBrightness: 0.2, depthDof: 0, depthColorShift: 0.2,
        lightingMode: 2, lightDir: [0.5, -0.7, 0.3], rimPower: 3,          // 2 = Rim (LG: 0 = None)
        // Bloom left at `Legacy Graded`'s own 0.6/0.3 — unlike the three sibling exports. A low threshold
        // would bloom the smeared core, which is the structure this demo is asking the viewer to compare.
        bloomEnabled: true, bloomThreshold: 0.6, bloomIntensity: 0.3,
        // The highest exposure in this file, and load-bearing — see the doc block (LG: 1.4).
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.3,
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.2, vignette: 0,
        // `'none'`: this bundle makes no colour decision, so the authored `colorBase` &c below still reach the
        // shader. There is deliberately NO `overlay.palette` pair here — see the doc block's last paragraph.
        palette: 'none', paletteMapping: 'depth',
      },
      speedFactor: 0.3,
      transMapEnabled: true, transMapStyle: 5,
      transMapChain: [
        // Stock `Ocean Current`, for the reason `Age Gate Embers` states: a named archetype whose numbers have
        // been edited is a body that lies to its reader.
        { style: 5, enabled: true, weight: 1.0,
          proceduralFlow: { strength: 0.3, scale: 3.0, curlAmount: 0.7, direction: [0.7, -0.7], radial: 0.1, evolutionSpeed: 0.3, archetype: 'Ocean Current' } },
        { style: 8, enabled: true, weight: 1.0,
          timeWarp: { amount: 0.75, source: 'density' } },
      ],
      transMapWarpMix: 0.5,
    },
  },

  /**
   * **`21.6c` — DEPTH PARALLAX (style 11), the one modifier whose weight comes from OUTSIDE the image.** It
   * scales each pixel's warp by the depth of what is drawn there, so a single field displaces the near
   * structure far and the far structure barely at all. One preset in the library enables it (`Sphere II`).
   *
   * ⚠️ **This is the first body in the library to author `depthRange: 'figure'`, and it is authored EXPLICITLY
   * even though it is the default.** `Sphere II` writes `'manual'`, so the default has never been exercised by
   * a shipped preset — and its own doc comment warns that a style-11 preset omitting the field *would* be
   * steered by it. Writing it makes this preset a test of the default rather than an accident of it.
   *
   * **What `'figure'` buys, in one number from its own measurement:** the depth scale's denominator is the
   * CANVAS while its numerator is the FIGURE, so a figure occupying a thin slice lands in a narrow band around
   * 0.5 and `Near`/`Far` cannot compensate — they scale the whole mapped interval. Median near:far ratio
   * across the 93 narrow-but-fittable legacy presets: **1.30x raw against 4.00x fitted.** `'figure'` refits
   * every frame; ⚠️ **the cost is that a figure turning edge-on has its collapsing band silently re-expanded**,
   * which is why `rotation` here is small and on one axis — a tumbling figure would make the fit pump.
   *
   * ⚠️ **`nearScale: 2.5` / `farScale: 0.5` deliberately DEPART from the defaults (1.5 / 0.4) in OPPOSITE
   * directions — the near end harder, the far end SOFTER.** A demo authored at the defaults is
   * indistinguishable from a demo that forgot to author anything, which is `21.D8`'s whole complaint about
   * coverage-by-presence. ⚠️ **`curve: 'linear'` EQUALS the default and is still authored explicitly**, for the
   * same reason `depthRange` is: this preset is the one place the style-11 defaults are exercised, so each one
   * agreed with is agreed with on the record. The derivation's `2.2 / 0.25 / 'squared'` was an 8.8× near:far
   * ratio on a squared curve; the owner's frame is **5.0× on a linear one** — see the ✅ section below.
   *
   * **The figure is `mastersLightWaves()` for its measured z-span of 666 — `P8` is not advisory here.** A flat
   * figure gives every pixel the same depth, at which point style 11 is an expensive global multiplier on the
   * field: live, authored and invisible (invariant 13). ⚠️ **It is the same builder `Depth Gate Veil` uses and
   * the two must not be confused:** that preset gates the FORCE on depth (particles move differently), this
   * one gates the IMAGE WARP on depth (pixels are displaced differently) — same input, two different
   * consumers, and the pose here is `[20, 45, 0]` rather than `[30, 30, 0]` so the silhouettes differ too.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED. The body below is the owner's Lab export, not a
   * derivation.** Four things moved. **(1) The parallax mapping RELAXED:** amount 0.85 → 0.9, but near/far
   * 2.2/0.25 → **2.5/0.5** and `curve` `'squared'` → **`'linear'`**, i.e. 8.8× on a squared curve down to
   * **5.0× linear**. The derivation optimised the ratio; the frame wanted the far field legible, which a
   * squared curve at 0.25 does not leave it. **(2) The grade is `'Customize'`, and it is `Cinematic` with
   * exactly three departures:** `glow` 3.0 → **5.0**, `bloomThreshold` 0.5 → **0.25**, `exposure` 1.4 → **2.0**
   * — every other field, `depthDof: 0.4` and `vignette: 0.3` included, is `Cinematic`'s own value, authored
   * because a `'Customize'` bundle must author all 21 (an omitted field is inherited). **(3) `palette:
   * 'Sunset'` under `paletteMapping: 'index'`,** which REPLACES the paragraph above about there deliberately
   * being no palette pair here: it is live because the bundle's own `palette` is `'none'` and a `'none'` bundle
   * ABSTAINS. **(4) `transMapDispersion: 0.15`** — chain-level fringing, new and gated `> 0` on export.
   * `colorShift` moved to `[0.68, 0.4, 1.055]`, which the palette now overrides anyway.
   *
   * ⚠️ **The export also carried `parallax.rangeFrom: 0.23` / `rangeTo: 0.79`, and they are NOT authored below
   * because `parallaxBandOf()` reads them only when `depthRange === 'manual'`** — the panel writes the manual
   * sliders whatever the mode, so an export shows a band this preset never used. Adopting them would put two
   * numbers in the body that no frame has ever been judged against. *Diff an export against the readers, not
   * only against the defaults.*
   *
   * ⏳ **Card line:** *"One field, depth-weighted: the near structure is dragged 2.5x and the far held at
   * 0.5x. `Range` is `Figure`, which refits the figure's own depth band every frame — `Canvas` is the
   * historical behaviour and on this figure it looks almost flat."*
   */
  'Parallax Depth Shell': {
    metadata: { name: 'Parallax Depth Shell', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'transmap', 'parallax', 'depth'] },
    generators: {
      type: 'lissajous', particleCount: 11000, waveSpeed: 0.05,
      // Small, single-axis: `depthRange: 'figure'` refits per frame, so a tumble makes the fit pump.
      rotation: [0, 0.05, 0], angle: [20, 45, 0],
      waves: mastersLightWaves(),
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `colorShift` [0.3, 0.4, 0.5] -> below. It is a PHASE, so the
      // out-of-01 blue component is legal; and `overlay.palette` now overrides this whole triple anyway
      // (palette > material ramp > preset colour), so it survives as the no-palette fallback only.
      colorBase: [120, 144, 184], colorAmp: [72, 64, 80], colorFreq: [0.08, 0.12, 0.16], colorShift: [0.68, 0.4, 1.055],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.86, blurRadius: 3, depthSize: 0.7, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'Cinematic'` -> `'Customize'`, which is `Cinematic` with exactly
      // three departures (marked below). All 21 fields are authored because an omitted one is INHERITED.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5.0,                                         // departure: 3.0
        depthSize: 0.8, depthBrightness: 0.6, depthDof: 0.4, depthColorShift: 0.5,
        lightingMode: 1, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: true, bloomThreshold: 0.25,          // departure: 0.5
        bloomIntensity: 0.6,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.0,  // departure: 1.4
        lift: [0.0, 0.0, 0.02], gamma: [1.0, 0.98, 0.95], gain: [1.0, 1.0, 1.0],
        saturation: 1.0, vignette: 0.3,
        // `'none'`: the bundle ABSTAINS, which is what lets the `palette` pair below reach the shader.
        palette: 'none', paletteMapping: 'depth',
      },
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED, and it REVERSES the doc block's old "no palette pair here".
      palette: 'Sunset', paletteMapping: 'index',
      speedFactor: 0.35,
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        // The field style 11 re-weights. Broad and slow: the reading is a DEPTH ordering, not a texture.
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Coarse Swell', strength: 0.6, detail: 0.8, drift: 0.28 } },
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 0.85/2.2/0.25/'squared' -> below, i.e. 8.8x near:far squared down
        // to 5.0x linear. `curve: 'linear'` EQUALS the default and is authored anyway; the export's
        // `rangeFrom`/`rangeTo` are NOT adopted — unread under `'figure'`. See the doc block.
        { style: 11, enabled: true, weight: 1.0,
          parallax: { amount: 0.9, nearScale: 2.5, farScale: 0.5, curve: 'linear', depthRange: 'figure' } },
      ],
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED. Chain-level chromatic fringing over the summed offset.
      transMapDispersion: 0.15,
      transMapWarpMix: 0.65,
    },
  },

  /**
   * **`21.6d` — the VORTEX (style 10) off-centre, on `falloff: 'inverse'`.** Style 10 is a FIELD, not a
   * modifier, so unlike 8/9/11 it is legal and live on its own — this is the only demo in the cohort whose
   * chain is a single layer, and that is itself the thing being shown.
   *
   * ⚠️ **`centre` is NORMALISED UV (0…1), and it falls back to the layer's own `zoomCenter` — which is 0…100
   * — before the default.** The `/100` conversion lives in `vortexOf()` exactly once, so a body writing 30
   * into `centre` asks for an eye thirty frames off the canvas. `{ x: 0.33, y: 0.62 }` is deliberately
   * off-centre: a centred vortex on a centred figure is a rotation, and the engine already has `rotation`.
   * Displaced, the same swirl SHEARS the figure against itself, which is the picture worth a demo.
   *
   * ⚠️ **`falloff: 'inverse'` against the default `'gaussian'` is the enum this demo discharges, and the two
   * differ where it matters: at the edge, not at the eye.** Gaussian dies smoothly to nothing, so the effect
   * is a local pinch; inverse decays as a reciprocal and therefore never quite reaches zero, so the whole
   * frame keeps a faint rotational bias with a hard core inside it. `radius: 0.28` (a fraction of the frame's
   * smaller axis, ⚠️ **already resolution-independent — a preview tile must NOT rescale it**) keeps that core
   * small enough that the outer bias is visible as a separate thing.
   *
   * **`swirl: -0.7` is NEGATIVE, and nothing else in the library is.** The sign reverses the sense of the
   * turn, so the vortex fights the figure's own `rotation` instead of adding to it — which is what makes the
   * shear legible rather than reading as "the figure spins faster near one corner".
   *
   * **The figure is `borgCubeWaves()`, the 11x7 nodal lattice.** A vortex needs a figure with straight rows
   * to bend: the lattice's rows enter the eye as lines and leave as spirals, and its nodes give the eye's
   * position an unambiguous address. ⚠️ **Do not confuse this with `High Frequency II`**, which runs a
   * centred, gaussian, positive-swirl vortex — every one of those three words is inverted here.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and the export changed the GRADE ONLY.** Every
   * number the four paragraphs above argue for came back untouched: `swirl: -0.7`, `radius: 0.28`, `centre
   * {0.33, 0.62}`, `falloff: 'inverse'`, `Warp Mix` 0.7, `rotation z` 0.3. That is the strongest shape a
   * confirmation can take here — the frame was judged and the geometry needed nothing.
   *
   * **The grade is `'Legacy Graded'` → `'Customize'` with seven departures:** `glow` 4 → **5.0**, `depthSize`
   * 0 → **0.35**, `depthBrightness` 0 → **0.25**, `depthColorShift` 0 → **0.35**, `bloomThreshold` 0.6 →
   * **0.35**, `exposure` 1.4 → **1.8**, `saturation` 1.0 → **1.1**. Four of the seven are the depth block,
   * which `Legacy Graded` zeroes entirely — ⚠️ **so this preset now reads depth TWICE, once as image warp
   * (style 11 is not here; `renderer.depthSize: 0.3` and the grade's `depthSize` are the two) and once as
   * shading.** The pair is intentional and they are different quantities (invariant 24): `renderer.depthSize`
   * scales the SPRITE, the film look's `depthSize` scales the GRADE's depth response.
   *
   * ⚠️ **The export's `paletteMapping: 'index'` is NOT authored below, because it is INERT here:** there is no
   * `overlay.palette`, and a `'Customize'` bundle whose own `palette` is `'none'` ABSTAINS — so nothing
   * consumes a mapping. The panel writes the key whatever the palette state; authoring it would ship a control
   * value with no reader (invariant 13's shape).
   *
   * ⏳ **Card line:** *"An off-centre eye turning against the figure's own spin. `Falloff` is `Inverse`, so
   * the bias never fully dies — switch it to `Gaussian` and the effect shrinks back to a local pinch."*
   */
  'Vortex Offset Drag': {
    metadata: { name: 'Vortex Offset Drag', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'vortex'] },
    generators: {
      type: 'lissajous', particleCount: 10000, waveSpeed: 0.05,
      // Positive Z spin against a negative swirl — see the doc block.
      rotation: [0, 0, 0.3], angle: [0, 0, 0],
      waves: borgCubeWaves(),
      colorBase: [96, 176, 160], colorAmp: [56, 64, 56], colorFreq: [0.1, 0.15, 0.1], colorShift: [0.4, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.88, blurRadius: 2, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 10, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'Legacy Graded'` -> `'Customize'` with the seven departures marked
      // below. All 21 fields are authored because an omitted one is INHERITED.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5.0,                                                   // departure: 4
        depthSize: 0.35, depthBrightness: 0.25,                      // departures: 0, 0
        depthDof: 0.0,
        depthColorShift: 0.35,                                       // departure: 0
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: true, bloomThreshold: 0.35,                    // departure: 0.6
        bloomIntensity: 0.3,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.8,    // departure: 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.1,                                             // departure: 1.0
        vignette: 0.0,
        // `'none'`: the bundle ABSTAINS, so the authored `colorBase` &c still reach the shader. There is no
        // `overlay.palette` pair here, which is WHY the export's `paletteMapping: 'index'` is not adopted.
        palette: 'none', paletteMapping: 'depth',
      },
      speedFactor: 0.4,
      transMapEnabled: true, transMapStyle: 10,
      transMapChain: [
        // ONE layer, and it is legal: style 10 is a field. `centre` is normalised UV, NOT the 0-100 of
        // `zoomCenter` — the conversion between them lives in `vortexOf()` and nowhere else.
        { style: 10, enabled: true, weight: 1.0,
          vortex: { swirl: -0.7, radius: 0.28, centre: { x: 0.33, y: 0.62 }, falloff: 'inverse' } },
      ],
      transMapWarpMix: 0.7,
    },
  },

  /**
   * **`21.6f` — THREE LIVE LAYERS, which is the first chain in the library to reach that depth.** The chain
   * exists to be composed, and every shipped chain is one or two layers; the census counts three-plus as its
   * own feature for that reason. The demo's job is to show that a chain is a CASCADE and not a list.
   *
   * **The three layers are chosen to be maximally unlike each other, by DOMAIN and by spatial frequency:**
   *
   *   1. **Style 0 (`Wave Shift`, field, analytic)** — `Coarse Swell` at low detail: the largest structure,
   *      the slow bulk motion everything else rides on.
   *   2. **Style 7 (`Density Refraction`, field, image-domain)** — reads the frame's own density gradient, so
   *      its frequency is the FIGURE's, not a noise function's. This is the middle scale.
   *   3. **Style 9 (`Band Split`, weightless modifier)** — splits the summed offset by radius, the finest
   *      scale, and it is what makes the composition legible: without it the first two sum into one offset
   *      and the eye cannot separate them.
   *
   * ⚠️ **`uMaxOffset` is 1.5 and it is the BUDGET the three layers share, not a per-layer clamp.** Three
   * layers at the strengths a solo demo would use saturate it, and a saturated chain reads as one violent
   * smear — the opposite of showing that there are three. Hence 0.45 / 0.40 strengths and a warp mix of 0.55:
   * the sum is what has to look composed. ⚠️ **The owner's frame spent part of that headroom** — see the ✅
   * section; the budget argument survives, the specific pair it quoted does not.
   *
   * ⚠️ **Style 9 is weightless and `requiresField`, and here it has TWO fields to modify.** That is legal and
   * is the point: a modifier acts on the SUM, so adding it is not a fourth force but a re-reading of the
   * first two. ⚠️ **9 does NOT count toward `needsWarp`** — the two field layers do, and if both were muted
   * the enabled chain would be inert while looking authored (the `deadChain` case §F fails on).
   *
   * **The figure is `quaderWaves()` at 12 000** — a box lattice, for `21.6a`'s reason squared: straight edges
   * are the only shapes whose triple distortion can be read apart, and the box's 75x75 design frame keeps the
   * whole cascade inside the canvas where `uMaxOffset` is measured.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and every change is INSIDE the three layers.**
   * The grade, the figure, the pose, the count and `Warp Mix` 0.55 all came back untouched; what moved is one
   * number per layer, all three UPWARD: layer 0 `drift` 0.3 → **0.423**, layer 1 `refraction.strength` 0.30 →
   * **0.40** with `reach` 2.0 → **2.5**, layer 2 `bandSplit.amount` 0.5 → **0.62** with `radius` 6.0 → **7.5**.
   * **That is the finding: the shared-budget argument was right about the mechanism and too cautious about the
   * level** — each layer got roughly a third more, in the same proportions, so the composition the paragraphs
   * describe is intact and simply louder. It still does not saturate `uMaxOffset`.
   *
   * ⚠️ **Three keys in the export are NOT authored below because the panel writes them at their defaults, not
   * because the owner set them:** `staticField.pattern2: '(Preset)'`, `strength2: 0.5` and `zoomBias: 0` are
   * `STATIC_FIELD_DEFAULTS` verbatim — the second-pattern UI emits the whole block whenever the layer is
   * touched. `paletteMapping: 'index'` is likewise inert here (no `overlay.palette`, and `Legacy Graded`
   * ABSTAINS). *An export is mostly runtime-default noise; diff it against the default constants.*
   *
   * ⏳ **Card line:** *"Three live layers: a slow swell, the figure's own density refracting it, and a band
   * split separating the two. Mute them one at a time from the top — the chain is a cascade, not a list."*
   */
  'Chain Triple Cascade': {
    metadata: { name: 'Chain Triple Cascade', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'transmap', 'chain'] },
    generators: {
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      rotation: [0, 0, 0.22], angle: [10, 10, 0],
      waves: quaderWaves(),
      colorBase: [160, 150, 120], colorAmp: [64, 60, 48], colorFreq: [0.1, 0.12, 0.14], colorShift: [0.25, 0.15, 0.35],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.86, blurRadius: 2, depthSize: 0.35, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      speedFactor: 0.4,
      transMapEnabled: true, transMapStyle: 0,
      // ⚠️ Three LIVE layers, and the strengths are low because `uMaxOffset` (1.5) is shared between them.
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: one number per layer moved, all three UP by roughly a third and in
      // the same proportions — see the doc block. The export's `pattern2`/`strength2`/`zoomBias` are
      // `STATIC_FIELD_DEFAULTS` written by the panel, so they are deliberately absent.
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Coarse Swell', strength: 0.45, detail: 0.7, drift: 0.423 } },
        { style: 7, enabled: true, weight: 1.0,
          refraction: { strength: 0.40, reach: 2.5, invert: false, source: 'density' } },
        // Weightless, and it modifies the SUM of the two above rather than adding a third offset.
        { style: 9, enabled: true, weight: 1.0,
          bandSplit: { amount: 0.62, radius: 7.5 } },
      ],
      transMapWarpMix: 0.55,
    },
  },

  /**
   * **`21.6g` — WARP BEFORE PARTICLES: the same chain, on the other side of the draw.** With the box ticked
   * the warp runs on the accumulated trail *before* this frame's particles land on it, so the figure is drawn
   * SHARP onto a distorted history — a crisp silhouette over its own melted past. Ticked off, the particles
   * are warped along with everything else and the figure itself dissolves.
   *
   * ⚠️ **ONE preset, not a pair, and that is the owner's decision (`21.6g`) — do not re-propose the pair.**
   * The comparison is made by unticking the box in Visual FX, which every user has, so a second preset would
   * only spend a library slot on a checkbox.
   *
   * ⚠️ **The flag lives in TWO places and both are written here** — `postProcessors.transMap.beforeParticles`
   * (the legacy field, which is what an export of this preset round-trips) and `overlay.transMapBeforeParticles`
   * (the live one, resolved first). A body writing only one of them is a preset whose behaviour depends on
   * which reader gets there first, and the census's §E resolves them in `main.ts`'s order precisely because
   * they can disagree.
   *
   * ⚠️ **It only does anything where a warp is actually live** (`needsWarp`), so the explicit style-0
   * `staticField` below is a precondition and not decoration: with an empty or all-modifier chain the box is
   * a control that describes a pass that never ran.
   *
   * ⚠️ **`decayFactor: 0.62` — the low value is what makes the order visible, and it is counter-intuitive.**
   * The effect is a difference between "warped history + sharp figure" and "warped everything", so the
   * HISTORY has to be short enough to read as a separate object. At 0.9 the trail is a long smear in both
   * orders and the checkbox looks broken. ⚠️ **`P14`: the discriminant is peak step x (1 − decayFactor)**, so
   * a short trail also needs a LARGE step — `strength: 0.9` at `detail: 0.6` gives one.
   *
   * **The figure is `pipesWaves()`, long smooth tubes.** A tube has a continuous edge, and a continuous edge
   * is the only thing that can look *sharp against* something: on a sparse dotted figure both orders produce
   * a cloud of warped dots and the distinction has nothing to attach to.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and the export STRENGTHENS the demo's own
   * argument rather than only grading it.** Two things moved. **(1) `ribbonMode: 'hybrid'`** (default `'off'`),
   * which replaces the plain point pass with a ribbon pass plus points for whatever the ribbon renderer did not
   * draw. ⚠️ **That is the paragraph above about a continuous edge, made literal:** a ribbon IS the continuous
   * edge, so the sharp-figure-over-melted-history reading no longer depends on `pipesWaves()` alone to supply
   * one. It also means this body's `renderMode: 'star'` now describes only the point subset. **(2) The grade is
   * `'Legacy Graded'` → `'Customize'` with seven departures:** `glow` 4 → **5.0**, `depthSize` 0 → **0.35**,
   * `depthBrightness` 0 → **0.25**, `depthColorShift` 0 → **0.35**, `bloomThreshold` 0.6 → **0.25**, `exposure`
   * 1.4 → **2.1**, `saturation` 1.0 → **1.2**. `decayFactor: 0.62`, `strength: 0.9`, `Warp Mix` 0.8 and BOTH
   * copies of `beforeParticles` came back untouched, which is the whole of `P14`'s discriminant confirmed.
   *
   * ⚠️ **Two export keys are NOT authored below because they are unread here:** `lineWidth: 1.5` (read only
   * under `linesEnabled`, and `main.ts` FORCES `linesEnabled` false whenever `ribbonMode !== 'off'`) and
   * `paletteMapping: 'index'` (no `overlay.palette`, and a `'none'` bundle abstains). `ribbonWidth: 3` IS read
   * now that ribbons are on, so it is authored even though it equals the default.
   *
   * ⏳ **Card line:** *"The figure is drawn sharp onto its own melted history. Untick `Warp before particles`
   * in Visual FX and the figure melts with it — same chain, other side of the draw."*
   */
  'Warp First Silhouette': {
    metadata: { name: 'Warp First Silhouette', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'order'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0.16], angle: [0, 0, 0],
      waves: pipesWaves(),
      colorBase: [184, 144, 96], colorAmp: [56, 64, 48], colorFreq: [0.08, 0.1, 0.12], colorShift: [0.3, 0.25, 0.1],
    },
    // ⚠️ A SHORT trail on purpose (P14) — see the doc block. The history must read as a separate object.
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.62, blurRadius: 2, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      // ⚠️ `beforeParticles: true` HERE as well as in the overlay — the flag exists twice and an export of
      // this preset round-trips through this copy.
      transMap: { enabled: true, style: 0, beforeParticles: true, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `renderMode` now describes only the POINT subset — `ribbonMode:
      // 'hybrid'` below moves the trajectories to the ribbon pass. See the doc block.
      renderMode: 'star',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'Legacy Graded'` -> `'Customize'` with the seven departures marked
      // below. All 21 fields are authored because an omitted one is INHERITED.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5.0,                                                   // departure: 4
        depthSize: 0.35, depthBrightness: 0.25,                      // departures: 0, 0
        depthDof: 0.0,
        depthColorShift: 0.35,                                       // departure: 0
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: true, bloomThreshold: 0.25,                    // departure: 0.6
        bloomIntensity: 0.3,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.1,    // departure: 1.4
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.2,                                             // departure: 1.0
        vignette: 0.0,
        // `'none'`: the bundle ABSTAINS. No `overlay.palette` pair here, which is why the export's
        // `paletteMapping: 'index'` is not adopted.
        palette: 'none', paletteMapping: 'depth',
      },
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED, and it is the bigger of the two changes — a ribbon IS the
      // continuous edge the doc block asks the figure for. `ribbonWidth` equals the default but IS read now
      // that ribbons are on, so it is authored. `linesEnabled` is deliberately absent: `main.ts` forces it
      // false whenever `ribbonMode !== 'off'`, which also makes the export's `lineWidth: 1.5` unread.
      ribbonMode: 'hybrid', ribbonWidth: 3.0,
      speedFactor: 0.45,
      transMapEnabled: true, transMapStyle: 0,
      transMapBeforeParticles: true,
      transMapChain: [
        // A LARGE step, because the trail is short: P14's discriminant is the product of the two.
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Diagonal Shear', strength: 0.9, detail: 0.6, drift: 0.22 } },
      ],
      transMapWarpMix: 0.8,
    },
  },

  /**
   * **`21.6h` — DENSITY REFRACTION (style 7) INVERTED, and on `source: 'luminance'`.** Both of that block's
   * categorical fields are unreached by the library: every shipped style-7 layer takes the default
   * `invert: false` / `source: 'density'`. The style bends the image by the gradient of the frame itself, so
   * the figure acts as its own lens — and the two fields decide *which* lens.
   *
   * **What `invert` does, stated as the sign it is:** normally the displacement follows the gradient, so
   * pixels are pushed AWAY from dense structure and the figure appears to swell — a bulge. Inverted, they are
   * pulled toward it: the figure PINCHES onto its own bright lines, and every gap between them stretches. The
   * name is the effect, which is `21.D2`'s requirement.
   *
   * **`source: 'luminance'` rather than `'density'` matters because the two are not the same picture.**
   * Density is how much has accumulated; luminance is how bright the result is after the palette has coloured
   * it. With a palette live those disagree strongly — a dim dense region and a bright sparse one swap places
   * — so the lens follows what the viewer can SEE rather than what the accumulator holds. Hence a palette
   * here: `Classic: cyberpunk` on `paletteMapping: 'velocity'`, which gives the figure large luminance
   * contrast along its arcs rather than across its depth.
   *
   * ⚠️ **`P6` is a precondition, not a preference: an image-domain lens needs EMPTY FRAME to bend things
   * into.** `montezumaWaves()` has the widest flat index spacing in the library (5.45 px at 20 000, its own
   * measurement) and this preset runs 9000, so the gaps are wide — and `figureScale: 0.85` keeps a margin.
   * ⚠️ **Shrinking `montezuma`'s design box CLIPS it** (the builder's own warning), so the margin is bought
   * with `figureScale` and never by narrowing `designResolution`.
   *
   * ⚠️ **`reach: 3.0` is in TEXELS of the full-resolution frame, so it is the one number in this body a
   * preview tile rescales** (`SCREEN_SPACE_TILE_SCALE`) — decide by unit, not by field name, and judge the
   * softness in the main view only.
   *
   * ⏳ **Card line:** *"The figure is its own lens, and inverted: it pinches onto its bright lines instead of
   * swelling away from them. `Source` is `Luminance`, so it follows the palette's colours, not the raw
   * density — untick `Invert` to see the ordinary bulge."*
   */
  'Inverse Refraction Pinch': {
    metadata: { name: 'Inverse Refraction Pinch', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'transmap', 'refraction'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0.1], angle: [0, 0, 0],
      waves: montezumaWaves(),
      colorBase: [128, 128, 144], colorAmp: [64, 64, 72], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.2, 0.2, 0.2],
    },
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.88, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 7, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      speedFactor: 0.4,
      // ⚠️ P6: the lens needs empty frame. `figureScale`, never a narrower design box — montezuma CLIPS.
      figureScale: 0.85,
      // `'luminance'` below reads what the PALETTE produced, so the palette is part of the feature here.
      palette: 'Classic: cyberpunk', paletteMapping: 'velocity',
      transMapEnabled: true, transMapStyle: 7,
      transMapChain: [
        { style: 7, enabled: true, weight: 1.0,
          // ⚠️ `reach` is in TEXELS — the one screen-space unit in this body.
          refraction: { strength: 0.55, reach: 3.0, invert: true, source: 'luminance' } },
      ],
      transMapWarpMix: 0.75,
    },
  },

  /**
   * **`21.7` opens with the ATTRACTOR that is NOT three-dimensional, because that is the one fact about the
   * subsystem a demo can hide.** `Clifford Fern` (index 2) is a **2D discrete map**: it iterates a point in
   * the plane, so its output has no Z at all and `P8` cannot be satisfied by the attractor alone.
   *
   * ⚠️ **`attractorBlend: 0.75`, and the remaining quarter is where the depth comes from.** The generator
   * lerps between the wave position and the attractor position, so the Lissajous half is what lifts the
   * filigree off the plane — `elphesWaves()` is chosen for it because it is the library's largest-extent
   * builder (423, its own measurement) and rotates on all three axes, so it contributes Z everywhere rather
   * than in one band. **A blend of 1.0 here would be a flat sheet**, which is a legitimate picture and is not
   * this demo's: `Fire Cloud` already ships Rössler at 0.7 for the opposite reason (a continuous 3D ODE that
   * has its own Z and needs no help).
   *
   * ⚠️ **THE FLICKER IS INTRINSIC AND IS NOT A DEFECT TO REPORT.** Clifford and De Jong are discrete maps
   * evaluated per particle per frame, so a particle does not travel along a trajectory — it lands somewhere
   * else in the attractor each frame. The result shimmers. A LONG trail is the answer the engine has
   * (`decayFactor: 0.894`): it integrates many landings into the *shape* the map describes, which is what the
   * viewer is meant to see. Judge this preset by the accumulated figure, never by a single frame.
   *
   * **`figureScale: 1.3`.** Every attractor is normalised to `ATTRACTOR_DESIGN_FRACTION` (0.45) of the design
   * box, which is the MEDIAN wave half-extent over the library — so a blended attractor is median-sized by
   * construction and framing is always a per-preset choice, never a correction to that normalisation.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and only two values moved, both of them about
   * the SHIMMER the paragraphs above defend.** `renderMode` `'star'` → **`'blend'`** and `decayFactor` 0.93 →
   * **0.894**. ⚠️ **Read them as one change, not two:** `'blend'` is a softer, wider sprite than `'star'`, so
   * each landing already covers more of the frame, and the trail can be shortened without the accumulated
   * shape coming apart. The flicker argument is unchanged and the numbers that carry the demo's actual subject
   * — `attractorIndex: 2`, `attractorBlend: 0.75`, `figureScale: 1.3`, `elphesWaves()` — came back untouched.
   *
   * ⚠️ **The export's `paletteMapping: 'index'` is NOT authored below, because it is INERT here:** there is no
   * `overlay.palette` and `Legacy Graded` is one of the three `palette: 'none'` looks, which ABSTAIN — so the
   * authored `colorBase` &c still own the colour and nothing reads a mapping.
   *
   * ⏳ **Card line:** *"A 2D map lifted into 3D: three quarters attractor, one quarter Lissajous, and the
   * Lissajous quarter is the only reason it has depth. The shimmer is the map itself — watch the accumulated
   * shape, not one frame."*
   */
  'Clifford Fern Veil': {
    metadata: { name: 'Clifford Fern Veil', version: 2, designResolution: { width: 100, height: 60 }, tags: ['demo', 'attractor'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0.05, 0.08, 0.04], angle: [0, 0, 0],
      // The quarter that supplies Z. See the doc block — this is not a leftover figure.
      waves: elphesWaves(),
      colorBase: [96, 160, 120], colorAmp: [48, 64, 56], colorFreq: [0.05, 0.08, 0.06], colorShift: [0.3, 0.45, 0.25],
    },
    // A LONG trail, because a discrete map's frames are independent samples of one shape.
    // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 0.93 -> 0.894, paired with `renderMode: 'blend'` below — a wider
    // sprite integrates more per frame, so the trail can be shorter. See the doc block.
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.894, blurRadius: 3, depthSize: 0.5, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'star'` -> `'blend'`, and it is the reason `decayFactor` could
      // come down. `renderer.mode` above stays `'star'`: the overlay is the live one, resolved first.
      renderMode: 'blend', filmLook: 'Legacy Graded',
      speedFactor: 0.5,
      attractorIndex: 2, attractorBlend: 0.75,
      figureScale: 1.3,
    },
  },

  /**
   * **`21.7` — `Lorenz Classic` (index 5), the one attractor whose SHAPE IS TWO OBJECTS.** The system's whole
   * fame is its pair of lobes and the unpredictable hand-off between them, and that hand-off is a *velocity*
   * event: a particle is slow deep inside a lobe and fast across the bridge. So this demo maps colour to
   * velocity and the two lobes separate themselves — **`P2` earned from the mathematics rather than imposed
   * on it.**
   *
   * ⚠️ **NO MATERIAL, and that is a decision rather than an omission.** Every temperature-derived channel
   * needs one, and the obvious reading of "fast is hot" would be a material on `heatMode: 'velocity'` — but
   * then the picture is the MATERIAL's ramp and the eight material demos above already own that. Here the
   * palette does it on the shared particle path, so the frame shows the attractor's own structure with
   * nothing between it and the screen. It is also why the mode is `star`: `splat` with no live material draws
   * NOTHING, so a material-free demo cannot use it.
   *
   * **`attractorBlend: 0.95`, not 1.0.** Lorenz is a continuous ODE integrated with `dt = 0.005`, so it has
   * genuine Z and needs no help with depth — but a forward-Euler integrator run per particle DIVERGES, and
   * the engine's answer is to reseed rather than clamp. The 5 % of Lissajous keeps a weak restoring pull
   * toward the figure, which visibly shortens the excursions of any particle that has wandered.
   *
   * ⚠️ **`figureScale` is a FRAMING choice, and the two ENGINE defects it used to compensate for are fixed
   * (2026-09-20, owner complaint: *"very soon consolidates into two small independent circles which are
   * rotating and then nothing changes anymore, the circles are too small"*).** The note that stood here
   * claimed the normalisation fits `bounds: [-30,-30,30,30]` — false since ODE normalisation moved to the
   * measured `ATTRACTOR_HALF_EXTENT`; `bounds` is read by the two escape-time types ALONE. What was really
   * wrong: (a) every ODE particle started on a small circle around the origin, which for Lorenz is an
   * UNSTABLE fixed point, so nothing but chaotic divergence separated the population and the butterfly took
   * MINUTES to appear — the two small rotating circles are that transient, not the attractor; (b) the
   * half-extent carries SCALE but no ORIGIN (invariant 27), and Lorenz's z centre is **+0.95 of it at this
   * body's 8 000 particles** (⚠️ **re-measured 2026-09-20 — the +0.93 that stood here was the MIDPOINT OF A
   * QUOTED SPAN, i.e. arithmetic on a figure, and the span and the centre were never one measurement; the
   * centre is a bounding-box midpoint, so it moves with `particleCount` — 0.908…0.946 over 2 k…24 k, and the
   * +0.91 in the backup row is the 4 k reading. The basis is part of the figure: `attractors.ts`'
   * `centreX/Y/Z` doc block owns the sweep and the reason the statistic is not being changed**), so the
   * figure sat pushed away in depth, shrunk by the perspective divide and swinging about a
   * pivot outside itself. Both fixed in `attractors.ts` (`warmOdeAttractor` seeds from a harvested reference
   * orbit; `state.centre*` is subtracted in `iterateAttractor`).
   *
   * **Measured on the screen, before → after.** At `t = 1 s` occupancy 0.9 % and a 5×19 % figure become
   * 23.2 % and 54×100 % — the full butterfly on the first second instead of after 90 s — and mean
   * per-particle motion 41.5 → 93.8 px/30f. ⚠️ **The footprint CHURN falls, 0.225 → 0.133, and that is the
   * fix working**: the population now covers the attractor from frame 1, so what changes is particles moving
   * *within* a stable footprint rather than the footprint itself still growing. Do not read the lower number
   * as less activity — read `move` for that.
   *
   * **`figureScale: 1.3`, down from 1.6**, because the figure it corrected for is no longer small: at 1.6 it
   * now clips 2.6 % of the particles, at 1.3 it clips 0.2 % — the pre-fix level — and fills 48×99 %.
   * **Switching the dropdown to another entry will still need a different scale.**
   *
   * ✅ **OWNER-CONFIRMED 2026-09-20: *"'Lorenz Twin Lobes' is now fine too!"*** — `'review'` tag removed. ⚠️ **The
   * verdict confirms the SEEDING AND CENTRING FIX, not just this body**, since both halves live in
   * `attractors.ts` and reach all six ODE types; the two sibling re-frames it forced (`Attractor Fire Cloud`
   * 2.5 → 1.4, `Aizawa Torus Shell` 1.5 → 1.2) are **still unconfirmed and keep their tags** — one preset's
   * verdict is not a verdict on a shared engine change's other consumers.
   *
   * ⏳ **Card line:** *"Two lobes and the jump between them, coloured by speed: slow inside a lobe, fast on
   * the bridge. No material — the palette does it, so nothing stands between the maths and the screen."*
   */
  'Lorenz Twin Lobes': {
    metadata: { name: 'Lorenz Twin Lobes', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'attractor', 'palette'] },
    generators: {
      type: 'lissajous', particleCount: 8000, waveSpeed: 0.05,
      rotation: [0, 0.1, 0], angle: [15, 0, 0],
      waves: cosmosWaves(),
      colorBase: [128, 128, 128], colorAmp: [32, 32, 32], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.2, 0.2, 0.2],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.90, blurRadius: 2, depthSize: 0.6, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded',
      speedFactor: 0.6,
      attractorIndex: 5, attractorBlend: 0.95,
      // Framing only — re-measured 2026-09-20 after the ODE seeding/centring fix (see the doc block).
      figureScale: 1.3,
      // The lobes colour themselves: slow inside, fast across the bridge.
      palette: 'Classic: aurora', paletteMapping: 'velocity',
    },
  },

  /**
   * **`21.7` — `Aizawa Torus` (index 11), the attractor that is a SURFACE, and the demo where depth is the
   * subject.** Aizawa wraps a torus with a spike through its axis: unlike Lorenz's two lobes or Clifford's
   * sheet, the near half of the figure genuinely occludes the far half, so it is the entry in the list that
   * can carry `P8` on its own — a depth span well past the ~0.5 the precondition asks for, with no help from
   * the Lissajous half and no tilt needed to expose it.
   *
   * **The derivation mapped the palette to `'depth'`, as the one mapping that is a STATEMENT here** rather
   * than a decoration: `Classic: ice` runs cold-far to bright-near, so the torus reads as a solid body turning
   * rather than as a wire outline. ⚠️ **Mapping 0 is `depth` and it takes `vDepth` directly** — no material
   * is involved, so this works on the shared particle path with nothing enabled but the palette. ⚠️ **THE
   * OWNER'S EXPORT REVERSED BOTH HALVES OF THIS PARAGRAPH — see the ✅ section; the mechanism above is still
   * correct, the choice it recommends is no longer what ships.**
   *
   * **`depthSize: 0.8` and `Cinematic` are the second half of the same idea.** Depth size is the main cue that
   * makes a 3D figure read as having depth, and `Cinematic` is one of the three looks that carry
   * `palette: 'none'` — it **ABSTAINS**, so the `overlay.palette` above is what reaches the shader while its
   * `depthSize`/`depthDof` terms still grade the frame. ⚠️ **A look WITH a palette would overwrite the choice,
   * which is why the pairing is deliberate and not stylistic.**
   *
   * **`attractorBlend: 1.0` — pure attractor, the only one in this group with no Lissajous contribution.**
   * The torus is a closed surface and any blend with a wave figure punches holes in it; a demo whose subject
   * is occlusion cannot afford that. `speedFactor: 0.3` so the rotation is slow enough that the near and far
   * halves can be told apart while they swap (`P11`: judge it over a minute, never at `t = 0`).
   *
   * ⚠️ **`figureScale: 1.2`, RE-FRAMED 2026-09-20 and not a retune.** The ODE seeding/centring fix in
   * `attractors.ts` (written up under `Lorenz Twin Lobes` above) reaches exactly three presets, this one
   * included — Aizawa's z centre is +0.40 of the half-extent. The authored 1.5 was measured against the old
   * off-centre figure and now fills the frame edge to edge, clipping 6.9 % of the particles (9.6 % at worst);
   * 1.2 gives 82×96 % at 0.9 %, which is BOTH larger and less clipped than the 58×68 % / 3.5 % the preset
   * actually shipped. **The intent that was preserved is the appearance, not the number.**
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and it is the one export in this cohort that
   * CHANGED THE DEMO'S OWN READING rather than tuning it.** Three things moved and they are one decision:
   * `palette` `Classic: ice` → **`Cycle: Solar`**, `paletteMapping` `'depth'` → **`'index'`**, and
   * **`linesEnabled: true` with `lineWidth: 1`** (default off). Together they take the torus from the solid
   * shaded body the paragraph above argues for to a **warm wire mesh**: neon draws trail GEOMETRY, not
   * particles, and colour now runs along the particle INDEX instead of towards the viewer.
   *
   * ⚠️ **The depth subject survives, but it is now carried by `depthSize: 0.8` and `Cinematic`'s depth terms
   * ALONE** — i.e. by the sprite and the grade, not by the colour. That is a weaker statement of `P8` than the
   * derivation wanted, and it is the owner's frame, accepted as such: **a hand-tuned preset the owner accepted
   * outranks a refinement rule.** ⚠️ **Do not "restore" `depth`/`Classic: ice` — propose it.** What is NOT in
   * question is the mechanism: `Cinematic` still ABSTAINS (`palette: 'none'`), which is the only reason the new
   * pair reaches the shader at all, and `attractorBlend: 1.0`, `figureScale: 1.2` and the 2026-09-20 re-framing
   * all came back untouched.
   *
   * ⏳ **Card line:** *"A closed surface, so its near half hides its far half. Pure attractor at blend 1.0: any
   * Lissajous blend would punch holes in the torus. `Neon Lines` draws the trajectories rather than the
   * particles — untick its `Enable` in Visual FX for the same figure as points."*
   */
  'Aizawa Torus Shell': {
    metadata: { name: 'Aizawa Torus Shell', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'attractor', 'depth'] },
    generators: {
      type: 'lissajous', particleCount: 10000, waveSpeed: 0.05,
      rotation: [0.06, 0.09, 0], angle: [25, 0, 0],
      // Present because the format requires it; at blend 1.0 it contributes nothing to position. Stated so
      // that a later reader does not "fix" the figure to match the picture.
      waves: miracleWaves(),
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `colorShift` [0.2, 0.2, 0.2] -> below. `overlay.palette` overrides
      // this whole triple (palette > material ramp > preset colour), so it is the no-palette fallback only.
      colorBase: [128, 128, 128], colorAmp: [32, 32, 32], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.775, 0.2, 0.573],
    },
    renderer: { mode: 'star', glow: 1.8, decayFactor: 0.85, blurRadius: 2, depthSize: 0.8, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star',
      // One of the three looks that ABSTAIN from the palette — see the doc block.
      filmLook: 'Cinematic',
      speedFactor: 0.3,
      attractorIndex: 11, attractorBlend: 1.0,
      // Framing only — re-measured 2026-09-20 after the ODE seeding/centring fix (see the doc block).
      figureScale: 1.2,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `Classic: ice`/`depth` -> below, which REVERSES the doc block's
      // second paragraph — colour now runs along the index, not towards the viewer. Live only because
      // `Cinematic` ABSTAINS. Do not restore the old pair; propose it.
      palette: 'Cycle: Solar', paletteMapping: 'index',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED. Neon draws trail GEOMETRY and replaces the point pass, so
      // the torus ships as a wire mesh. `ribbonMode` is absent: the panel forces the two apart anyway.
      linesEnabled: true, lineWidth: 1.0,
    },
  },

  /**
   * **`21.7` — `Julia Siegel Disk` (index 19): the ESCAPE-TIME family, where a particle's position is not a
   * trajectory at all.** ⚠️ **Escape time is not a coordinate.** A Julia set is sampled by iterating each
   * candidate point until it escapes and keeping the ones that do not, so the figure is a *set membership
   * test* rendered as points — there is no velocity, no integration and nothing to diverge. That is the
   * distinction this demo exists to draw against the four ODE and map entries above it.
   *
   * **`attractorBlend: 1.0` and a fast `rotation`, because `P7` has no other source here.** An escape-time
   * figure is STATIC: the set does not evolve, so with no rotation the frame is a still image and the preset
   * would fail the inter-frame-motion precondition while looking perfectly good in a screenshot. The rotation
   * is the animation.
   *
   * ⚠️ **`c = −0.391 − 0.587i` is EXACTLY ON the boundary of the Mandelbrot set, and that is the reason for
   * this entry over the eleven other Julias.** It is the golden-mean **Siegel disk** parameter, which is
   * derivable rather than folklore: for `z² + c` the fixed-point multiplier `λ` gives `c = λ/2 − λ²/4`, and at
   * `λ = e^(2πiθ)` with `θ` the golden mean 0.618034 that evaluates to **−0.3906 − 0.5868i** — the table's
   * entry to three decimals. A neutral, irrationally-rotating fixed point means the set is connected but has
   * no attracting interior dynamics, so the filigree is dense right up to the boundary everywhere at once.
   * ⚠️ **Do not "simplify" the parameter**: `Julia Fractal Dust` (0.36 + 0.1i) is disconnected and reads as
   * noise on a moving figure, and an interior parameter gives a fat body with thin arms instead.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, AND IT IS A DIFFERENT PICTURE, WHICH IS WHY THE
   * PRESET WAS RENAMED** (`Julia Pinwheel Arms` → `Julia Siegel Disk River`; the precedent and the rule are
   * `Mandelbrot Zoom`'s — **the name now describes what ships, and the index is not to be "corrected" back**).
   * Five things moved, and they are one decision:
   *
   *   1. **`attractorIndex` 20 → 19**, i.e. `Julia Pinwheel` (0.285 + 0.01i, just INSIDE the boundary) →
   *      `Julia Siegel Disk` (exactly ON it). The paragraph above is rewritten around the new parameter.
   *   2. **`renderMode` `'star'` → `'liquid'`**, with a full `overlay.liquid` block. ⚠️ **This REVERSES the
   *      derivation's central claim** — that the filaments must be resolved point by point, so the look had to
   *      be `Legacy` and the particle small. Liquid merges the splats into an ISO-SURFACE instead: the
   *      filigree becomes a body of flowing channels, which is what `River` in the new name refers to.
   *      ⚠️ **`liquid` is the ONE mode a material would not override** (`resolveModeAgainstMaterial()`), and
   *      there is no material here — so the mode survives on its own. **Three things are named "liquid"** (the
   *      mode, the material and `surfaceRamp`); this body uses the first and the third and no material.
   *   3. **`filmLook` `'Legacy'` → `'Customize'` with seven departures**: `glow` 4 → **5.5**, `bloomEnabled`
   *      false → **true**, `bloomThreshold` 0.8 → **0.25**, `bloomIntensity` 0 → **0.3**, `toneMapEnabled`
   *      false → **true**, `toneMapCurve` `'none'` → **`'aces'`**, `exposure` 1.0 → **2.1**. ⚠️ **Bloom is now
   *      ON, which the old second paragraph forbade in those words.** It is consistent: a low-pass filter
   *      erases filaments but not a surface, so the moment the mode changed the prohibition expired with it.
   *   4. **`palette: 'Prismatic'` + `paletteMapping: 'index'`** — live, because a `'Customize'` bundle carrying
   *      `palette: 'none'` ABSTAINS. This body therefore LEAVES the palette-free `index` class (manual §21.4d)
   *      by the authored-pair route.
   *   5. **`speedFactor` 0.5 → 1.51**, three times faster. An iso-surface has no per-point structure left to
   *      smear, so the rotation can carry the whole animation at a speed a point cloud could not.
   *
   * **`figureScale: 1.4`, `particleSize: 0.6` and `count: 11000` came back untouched** — the framing and the
   * splat size were right, and on the liquid path `particleSize` feeds the kernel rather than a sprite.
   *
   * ⚠️ **ONE value was adapted rather than adopted: `liquid.isoLevel` 2.7798 → 2.7321**, because the exported
   * number is not on the Iso Level track and an unrepresentable authored value is a defect in its own right
   * (`trackcheck` §H, which is what caught it). The body comment carries the arithmetic. **This is the only
   * place any of the nine bodies departs from its export**, and it is a −1.7 % snap to the value the slider
   * itself would show on first touch, not a retune.
   *
   * ⏳ **Card line:** *"A membership test, not a trajectory — and the golden-mean Siegel parameter, which sits
   * exactly on the boundary of the Mandelbrot set. `Liquid` merges the filigree into flowing channels; switch
   * `Mode` to `Star` in Visual FX to see the points it is built from."*
   */
  'Julia Siegel Disk River': {
    metadata: { name: 'Julia Siegel Disk River', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'attractor', 'fractal'] },
    generators: {
      type: 'lissajous', particleCount: 11000, waveSpeed: 0.05,
      // The ONLY motion in this preset — the set itself is static. See the doc block.
      rotation: [0, 0, 0.25], angle: [0, 0, 0],
      waves: cylinderWaves(),
      // `overlay.palette` overrides this triple (palette > material ramp > preset colour); it is the
      // no-palette fallback only. ⚠️ It is ALSO what `liquid.tintSource: 'preset'` names, so it is not dead.
      colorBase: [176, 152, 96], colorAmp: [56, 48, 64], colorFreq: [0.08, 0.1, 0.12], colorShift: [0.35, 0.2, 0.45],
    },
    // ⚠️ `glow: 1.0` is a SHAPE control and it is inverted: low means a tight core. Short trail, small points.
    renderer: { mode: 'star', glow: 1.0, decayFactor: 0.70, blurRadius: 1, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'star'` -> `'liquid'`, the change the rename is about. No material,
      // so nothing overrides it — `liquid` is the one mode exempt from `resolveModeAgainstMaterial()`.
      // `renderer.mode` above stays `'star'`: the overlay copy is the live one, resolved first.
      renderMode: 'liquid',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `'Legacy'` -> `'Customize'` with the seven departures marked below,
      // bloom and tone mapping among them — legal now only because the mode changed. See the doc block.
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 5.5,                                                   // departure: 4
        depthSize: 0.0, depthBrightness: 0.0, depthDof: 0.0, depthColorShift: 0.0,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: true, bloomThreshold: 0.25, bloomIntensity: 0.3,  // departures: false, 0.8, 0
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 2.1,      // departures: false, 'none', 1.0
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.0, vignette: 0.0,
        // `'none'`: the bundle ABSTAINS, which is the only reason the `palette` pair below is live.
        palette: 'none', paletteMapping: 'depth',
      },
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED. Leaves the palette-free `index` class (manual §21.4d).
      palette: 'Prismatic', paletteMapping: 'index',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 0.5 -> 1.51. A surface has no per-point structure left to smear.
      speedFactor: 1.51,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 20 -> 19. The name follows the index, not the other way round.
      attractorIndex: 19, attractorBlend: 1.0,
      figureScale: 1.4, particleSize: 0.6,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: ADDED, all eleven fields. Departures from `DEFAULT_LIQUID_CONFIG`
      // are marked; `tintSource`/`surfaceRamp`/`colourMix` equal it and are authored because the block must be
      // complete. ⚠️ `colourMix` holds most of the surface colour and is NOT a control — leave it at 0.85.
      liquid: {
        // ⚠️ default 1.0. The export carried **2.7798, which the Iso Level track cannot represent** — so it
        // did NOT come from this slider (which quantises in the stored unit, 4 decimals on a 1/20-octave log
        // grid); the Mixer interpolates `isoLevel` GEOMETRICALLY and a lerp of two stops lands between them.
        // Snapped through the track's own `toPos → snap → fromPos`, which is also the nearest stop (−1.72 %,
        // and 2.7798 sits almost exactly midway: 2.7321 is 0.0477 away, 2.8284 0.0486). The precedent is
        // `Liquid Surface`'s 0.8409; `trackcheck` §H is the instrument, and the defect it names is that a
        // centre-restore can never return to an unrepresentable value and the handle jumps on first touch.
        isoLevel: 2.7321,
        kernelWidth: 3.1,          // default 1.0
        edgeSoftness: 0.36,        // default 0.15
        tintSource: 'preset', surfaceRamp: 'liquid', colourMix: 0.85,
        mixModel: 'pigment',       // default 'light'
        refraction: 0.49,          // default 0.25
        specular: 2.0,             // default 0.8
        thickness: 0.7,            // default 0.5
        edgeBrightness: 1.1,       // default 0.6
      },
    },
  },

  /**
   * **`21.7` — the Mandelbrot escape-time field, and the demo whose real subject is that the iteration budget
   * is not the preset's to set.** ⚠️ **A preset's own `maxIter` IS NOT READ.** `computeAdaptiveMaxIter(bounds)`
   * derives the budget from the window's SPAN through five bands, and the cache tests *that* value — so the
   * number written beside an entry in `ATTRACTOR_PRESETS` is documentation of intent and nothing more. A card
   * that tells a user to raise it is describing a control that does not exist.
   *
   * ⚠️ **OWNER-TUNED EXPORT, 2026-09-20, AND IT MOVED THE WINDOW — the preset was `Mandelbrot Seahorse Zoom`
   * on `attractorIndex: 26` and is now `Mandelbrot Zoom` on 25.** Imported verbatim from the Lab; measured
   * against the authored body, exactly FIVE leaves changed (`rotation[2]` 0.12 → 0.49, `attractorIndex`
   * 26 → 25, `attractorBlend` 1 → 0.95, `filmLook` `'Legacy'` → `'Neon'`, `speedFactor` 0.4 → 1) plus the
   * whole `transMapChain` block, which the session ENABLED. Everything else in the export is runtime-default
   * noise (`ribbon*`, `lines*`, `curlNoise`, `physarum` at `blend: 0`, `fluidAdvection` at `blend: 0`).
   *
   * ⚠️ **NAME TRAP: "Zoom" IS NO LONGER THE WINDOW.** Index 25 is `Mandelbrot Full Set` —
   * `[-2.5,-1.5] … [1.0,1.5]`, span 3.5, the whole set — where index 26 was Seahorse Valley at span 0.04.
   * **Do not "correct" the body back to 26 because the name says zoom**; the zoom the name now describes is
   * the framing (`figureScale: 1.45` on a `Grid Lattice` static warp), and the window is the owner's call.
   * Measured with the checker's own `escapeFieldStats()`: the new window is **more** followable than the old
   * one (**0.8694** against 0.7097, floor 0.40) at escape range **250.4** (against 772.7, floor 10) — so the
   * `aestheticcheck` floors that grade a window are satisfied with more margin than before, which is the one
   * thing about the swap that a checker can see.
   *
   * ⚠️ **On THIS window the demo's own subject is invisible, and that is the cost of the move.** The five
   * bands are `span > 2 → 256`, `> 0.5 → 400`, `> 0.1 → 600`, `> 0.01 → 800`, else 1000; at span 3.5 the
   * derived budget is **256, which is exactly what `Mandelbrot Full Set` declares**. The declared and derived
   * values therefore AGREE here, so nothing on screen distinguishes "read" from "not read" — the claim is
   * still true and still worth the card line, but it is no longer demonstrated by this preset. On the old
   * window they disagreed (declared 400, span 0.04 ⇒ derived 800).
   *
   * ⚠️ **The grid cache is reused BY TOLERANCE, and that is not an optimisation.** A crossfade LERPS the
   * bounds, so a transition into this preset asks for a continuum of windows; exact-key matching would hit
   * 0 %. Two consequences for a reviewer: the frames during a Reel transition into this preset are a
   * neighbouring window's grid, deliberately, and a **stall on arrival is the cache MISSING, not the field
   * being slow**.
   *
   * ⚠️ **`P4` inverted was the argument for `blend`, and the owner kept the mode after widening the window.**
   * The density reasoning was derived on the deep window — most candidate points survive there, so on `star`
   * the figure fills into a slab — and the full set is the less dense case, yet `blend` is what came back.
   * It stays for the reason that survives either window: `blend` composites rather than accumulating, so
   * overlapping points stay distinguishable, and it is the cheapest honest way to see a mode that 37 presets
   * use and no other demo is named for.
   *
   * ⚠️ **`attractorBlend: 0.95`, not 1.0, so the wave figure is no longer fully replaced** — fade is
   * `1 − attractorBlend`, so 5 % of `quaderWaves()` now shows through the escape field. That is why the
   * figure's table is still load-bearing at all.
   *
   * ⚠️ **`filmLook: 'Neon'` kills two values below.** The look carries `glow: 5.4` and a palette, so
   * `renderer.glow: 1.4` is dead and — because `palette: 'Neon'` maps by `phase` — so are `colorBase` and
   * `colorAmp` (the same trade `Chain Zoom Fractal` makes on `'Plasma'`, and the same reason). The two palette
   * fields are authored explicitly at the look's OWN values, so the body does not depend on the look having
   * been applied first.
   *
   * ⚠️ **No respawn distribution rescues a window INSIDE the set** — if a future edit moves these bounds into
   * the black interior, every particle survives every iteration and the frame is a solid disc. The window is
   * part of the demo, not a starting point for exploration.
   *
   * ⏳ **Card line:** *"The whole set on a `Grid Lattice` warp, and an iteration budget that is derived from
   * the window's span rather than authored — the `maxIter` beside the entry is not read. `Blend` mode so
   * overlapping points stay distinguishable instead of accumulating into a slab."*
   */
  'Mandelbrot Zoom': {
    metadata: { name: 'Mandelbrot Zoom', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'attractor', 'fractal'] },
    generators: {
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: the z spin came back 0.49, four times the authored 0.12.
      rotation: [0, 0, 0.49], angle: [0, 0, 0],
      waves: quaderWaves(),
      // ⚠️ Dead under `filmLook: 'Neon'` — the look's `palette` outranks the preset colour. Kept verbatim
      // because the export carries them and because they return the moment the look is changed.
      colorBase: [112, 136, 184], colorAmp: [64, 48, 72], colorFreq: [0.1, 0.14, 0.18], colorShift: [0.3, 0.4, 0.2],
    },
    // ⚠️ `blend`, not `star` — see the doc block. `glow` here is dead under `'Neon'`, which carries 5.4.
    renderer: { mode: 'blend', glow: 1.4, decayFactor: 0.75, blurRadius: 1, depthSize: 0, streaks: 0 },
    postProcessors: {
      // ⚠️ BOTH halves of the dual-source field (invariant 17): the Lab exports the overlay only, so the
      // legacy half is mirrored by hand — `enabled: true, style: 0` — and `sinMagicParams` stays the
      // fallback table a legacy reader would use, exactly as the file header describes.
      transMap: { enabled: true, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'blend', filmLook: 'Neon',
      // The look's own two values, authored so a varied starting state cannot change what this preset is.
      palette: 'Neon', paletteMapping: 'phase',
      transMapEnabled: true, transMapStyle: 0,
      transMapChain: [
        { style: 0, enabled: true, weight: 1.0,
          staticField: { pattern: 'Grid Lattice', strength: 0.5, detail: 1.0, drift: 0 } },
      ],
      // ⚠️ `transMapWarpMix` is absent because its default IS 1.0 and `main.ts`'s export gate omits it there —
      // the full warp, not a bypass. `Chain Mix` 0 would be the inert case and is not what the export says.
      speedFactor: 1.0,
      attractorIndex: 25, attractorBlend: 0.95,
      figureScale: 1.45, particleSize: 0.7,
    },
  },

  /**
   * **`21.8a` — `pixel`, the render mode NO preset in either artefact selects.** Its census count is 0 out of
   * 247, which makes it the clearest case in the library of a reachable-but-unused configuration: a mode a
   * user can pick from the dropdown and that nothing has ever been authored to look good in.
   *
   * ⚠️ **RETUNED 2026-09-20 on the owner's verdict — "completely static, no color, boring and not visible that
   * Pixel mode should add anything interesting here" — and the retune had to start by CORRECTING THIS BLOCK.**
   * Every claim v1 made about the mode was false, which is why its figure and its colour were authored the way
   * they were. Read off `hdr-particle.ts` and `main.ts` rather than off the mode's name:
   *
   *   - **`pixel` is `modeInt` 0 and takes the SAME soft-sphere fragment branch as `blend`** (only `star`, 2,
   *     branches away, at line 111): `shape = pow(1 - smoothstep(0, 1, r), 8 / uGlow)` — a real radial falloff.
   *   - **Its sprite is 3 px, not 1** (`baseSize = (uRenderMode == 2) ? 5.0 : 3.0`, and the same 3.0 on the CPU
   *     side at `hdr-particle.ts:3835`). The `particleSize` tooltip has said "3 px for Pixel and Blend" all
   *     along — the UI was right and this block was wrong.
   *   - **`uGlow` is LIVE here, and it is the FILM LOOK's glow, not `renderer.glow`.** `applyFilmLook()` pushes
   *     `look.glow` into `setFilmLook()`, so under `Legacy Graded` the exponent is `8/4 = 2`. ⚠️ **The body's
   *     `renderer.glow: 1.0` is read once at `init()` and then OVERWRITTEN, so it is INERT here** — kept only
   *     because every point-mode preset carries one; v1's "raising Glow does nothing here" was true of the wrong
   *     field. ⚠️ **Do not delete it: `ribbonRenderer`/`neonLineRenderer` are handed `preset.renderer.glow`
   *     DIRECTLY**, so the same field is live in two renderers and dead in the one this preset uses.
   *   - **`pixel` is alpha-composited, but so is almost everything.** `isAdditiveBlend()` is `renderMode ===
   *     'blend'` alone, so `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` is the default and `blend` is the exception.
   *
   * **So the honest subject of this demo is `pixel` AS THE FINE-GRAINED TWIN OF `blend`: identical geometry,
   * opposite accumulation.** 3 px round sprites that do not sum, where `blend`'s identical sprites do. Measured
   * on this body, one graded frame each (`Legacy Graded`, 40-frame trail at `decayFactor 0.72`, the CPU model of
   * the fragment and blend funcs above): **`pixel` clips 0.0 % of its lit pixels and holds core saturation
   * 0.64; the same body in `blend` clips 32.4 % to white and falls to 0.37.** That contrast is the picture, and
   * it needs crossings to appear in — hence `pixelCrossingWaves()`, whose block owns the figure.
   *
   * **What the retune changed, all three against the owner's three words.** Every figure is measured, none is
   * an estimate; the geometry pair is a 256 × 192 occupancy grid over frames 150–900 at `speedFactor 0.4`:
   *
   *     quantity                                  v1 (shipped)      v2 (this)
   *     occupancy churn over 0.5 s                 0.005             0.758
   *     particle move per 30 frames                0.0 px            6.2 px
   *     cells holding two far-apart index ranges    0.1 %             100 %
   *     figure extent, mean over 150 s            18 x 44 %         50 x 67 %
   *     lit area of a graded frame                 1.7 %             5.5 %
   *     output saturation / core value             0.22 / 120        0.69 / 162
   *     hue bins holding >= 0.5 % of particles     1-6 of 15         13 of 15
   *
   * ⚠️ **"No colour" was a UNIT error in the colour law, not a taste question.** `writeColourAt()` computes
   * `n = i * (360 / count)` and then `sin(n * colorFreq / DEG)`, so **`colorFreq` is CYCLES ACROSS THE WHOLE
   * INDEX and is count-free**: v1's `[0.08, 0.1, 0.12]` completed a *twelfth* of one cycle over the population,
   * i.e. one flat colour however large `colorAmp` was. v2 authors `[2, 4, 6]` — integer cycles, so the closed
   * curve has no seam at the index wrap, and the library's dominant 1 : 2 : 3 ratio. ⚠️ **The other half is
   * `colorBase: 80` UNDER `colorAmp: 190`**, which drives each channel into the law's own clamp for part of
   * every cycle; measured composite saturation 0.37 → 0.69 going from `[1, 2, 3]` at base 128/amp 120 to this.
   *
   * ⚠️ **`Legacy Graded` STAYS, and the alternative was measured rather than assumed.** ACES at exposure 1.4
   * compresses channel RATIOS, so a `Customize` bundle at `saturation: 1.5` was the obvious lever — it reaches
   * core saturation 0.34 where the colour-law fix above reaches 0.64 on the plain look. **Fixing the colour at
   * its source beat re-grading it, and 22 authored bundle fields were not spent.**
   *
   * **The particle count stays 22 000, with a corrected reason.** v1 said the count closes 1 px gaps in line
   * art; at a 3 px sprite the strands are continuous long before that. What the count buys is OVERLAP — 8.5
   * particles per occupied 4 px cell, which is what gives the non-accumulating blend something to not
   * accumulate. `P10`'s ~6000 ceiling is still a CPU budget for the field systems, and none of them runs here.
   *
   * ⚠️ **`decayFactor: 0.72` and `blurRadius: 1` are unchanged, and the reason is now the opposite one.** v1
   * kept them to avoid softness the mode does not have; they stay because a long trail AVERAGES the crossings
   * over time, and the average of many hues is the grey the owner reported. A brief ghost keeps each crossing's
   * own colour.
   *
   * ✅ **OWNER-CONFIRMED 2026-09-20: *"'Pixel Line Art' is now good!"*** — `'review'` tag removed. The retune's
   * basis was a CPU model of the fragment shader and the blend funcs, not a browser — faithful to
   * `vec4(colour * shape * brightness * lighting, shape)` under `SRC_ALPHA` (hence `colour * shape²`), which is
   * where the numbers above come from, with the figure, the extents and the colour law measured through the real
   * `LissajousGenerator`. **The confirmation is what discharged that model, and it is the only thing that could
   * have**: three changes landed together (geometry, colour law, trail), so the verdict covers the SET and not
   * one clause of it. Do not re-tune any of the three back on a rule.
   *
   * ⏳ **Card line:** *"The fine-grained twin of Blend: the same 3 px sprite, composited instead of summed, so
   * where strands cross the colours hold instead of burning out to white. Switch the mode to Blend and back —
   * that is the whole demo."*
   */
  'Pixel Line Art': {
    metadata: { name: 'Pixel Line Art', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'render-mode', 'pixel'] },
    generators: {
      type: 'lissajous', particleCount: 22000, waveSpeed: 0.05,
      // ⚠️ [0, 0, 0] is load-bearing, not a default: the figure is nearly planar and a Y rotation turns it
      // edge on. `pixelCrossingWaves()`' block has the instant search.
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: pixelCrossingWaves(),
      // ⚠️ `colorFreq` is CYCLES ACROSS THE INDEX (count-free) — see the doc block. v1's 0.08 was a twelfth of
      // one cycle, i.e. flat. Base UNDER amp is the other half: it puts each channel into the law's clamp.
      colorBase: [80, 80, 80], colorAmp: [190, 190, 190], colorFreq: [2, 4, 6], colorShift: [0.2, 0.3, 0.4],
    },
    // ⚠️ A brief ghost, minimum blur: a long trail averages the crossings and the average of many hues is grey.
    // ⚠️ `glow: 1.0` is INERT on the screen path — the live falloff exponent is `8 / look.glow`. See the block.
    renderer: { mode: 'pixel', glow: 1.0, decayFactor: 0.72, blurRadius: 1, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'pixel',
      // ⚠️ Load-bearing twice over: it is one of the three `palette: 'none'` bundles, so it leaves the
      // generator's own colour alone, AND its `glow: 4` is what sets the live falloff exponent `8 / 4`.
      // Measured against a `saturation: 1.5` Customize bundle — see the doc block; the colour-law fix won.
      filmLook: 'Legacy Graded',
      speedFactor: 0.4,
      transMapEnabled: false,
      particleSize: 1.0,
    },
  },

  /**
   * **`21.8b` — `pixel` again, and the second demo exists because the mode has a second, unobvious property:
   * it reaches the SHARED palette path.** `paletteMapping` is read by the one particle program every point
   * mode uses, so a 1 px particle is coloured by exactly the same lookup a splat is. Two `pixel` demos
   * therefore cost one mode and buy two features.
   *
   * ⚠️ **`paletteMapping: 'age'` NEEDS NO MATERIAL, and that is a deliberate exception in the shader.** Only
   * mapping 3 (`temperature`) degrades when its array is missing; the renderer **synthesises a staggered age**
   * when `state.lifetimes` is absent, so this works with nothing enabled. **Do not "fix" this preset by adding
   * a material to feed it** — the absence is the thing being demonstrated.
   *
   * ⚠️ **The age used for the lookup is `fract(aPointAge / 6.0)`, so the palette CYCLES every six seconds.**
   * That is the feature's real appearance and the reason `Classic: thermal` was chosen: it is a ramp whose two
   * ends are far apart (dark violet to white-hot), so each six-second sweep reads as a wave of colour
   * travelling along the figure rather than as a gentle shimmer.
   *
   * ⚠️ **A `P11` clause stood here — *"at `t = 0` every particle is at the same phase and the preset looks like
   * a single flat colour"* — and it was FALSE, invented to explain a symptom instead of measuring it.** The
   * synth is `((i / count) * 6 + clock) % 6`, staggered BY INDEX, so `fract(age/6)` covers the whole ramp at
   * every clock phase including 0 (`fieldcheck` §V measures the spread at five phases). There was never a flat
   * instant to wait out. The flat instant the note described came from the defect below, and a "this is
   * expected" note beside a symptom is a claim that needs its own measurement — this one had none, and it cost
   * the preset a second rejection.
   *
   * ⚠️ **The look must ABSTAIN from the palette** — only three of the fifteen bundles carry `palette: 'none'`
   * (`Legacy`, `Legacy Graded`, `Cinematic`), and one that names a palette of its own would overwrite the
   * `overlay.palette` here and the demo would silently show the wrong ramp. **The look is part of the
   * authoring, not a style preference.**
   *
   * ⚠️ **RETUNED 2026-09-20 — `'Legacy'` → `'Legacy Graded'` on the owner's verdict "completely dark, nothing
   * really visible", and it is the ONLY field that changed.** `Legacy` is `curve: 'none'` at `exposure: 1.0`:
   * a bare clamp, so what the shader emits is what the screen gets, and `pixel`'s alpha compositing emits very
   * little. `Legacy Graded` is the same bundle with `curve: 'aces'` at `exposure: 1.4`, whose whole job is
   * lifting midtones. Measured on one graded frame of this body (a CPU model of the fragment and blend funcs):
   * **median lit value 27 → 56, 90th percentile 75 → 141, brightest cores 63 → 123.** Both bundles abstain, so
   * the `Classic: thermal` + `age` pairing above survives the swap untouched — that is why this was a one-field
   * fix and not an authoring change.
   *
   * ⚠️ **`decayFactor: 0.80` was the tempting wrong lever and is deliberately unchanged.** Raising it to 0.88
   * does raise lit area 9.6 % → 13.0 %, but it lowers the median value 56 → 40: a longer trail spreads the same
   * light over more pixels and each one is dimmer, which is the reported symptom, not its cure. **Geometry and
   * motion were measured and are already right** (occupancy churn 0.52 over 0.5 s, 68 px of travel per 30
   * frames, 28.6 % occupancy, figure 71 x 96 % of the frame) — "dark" was only ever about the grade.
   *
   * **The figure is `rotatingBandWaves()` (100x100, 4.1 px/frame — the fastest-travelling builder, its own
   * measurement)**, because an age-mapped palette is a demonstration about TIME: a band whose particles sweep
   * quickly through the frame makes the age gradient a spatial gradient, so the six-second cycle is visible
   * as a moving edge instead of having to be remembered.
   *
   * ⚠️ **REJECTED A SECOND TIME 2026-09-20 — *"still is only black, when I move the Color Palette Map to Depth,
   * the figure appears"* — and the cause was an ENGINE DEFECT, not this body: the retune above fixed a real
   * grading problem that was never the whole of what the owner saw.** The owner's own hypothesis (*"value Age
   * only works with some Material selected, right?"*) is FALSE and worth stating plainly, because the opposite
   * is true twice over: `age` is the one mapping deliberately built to need no material, and a material would
   * force the mode off `pixel` via `resolveModeAgainstMaterial()` onto `splat`, whose program has no palette
   * sampler at all. **Adding a material would REMOVE the palette.**
   *
   * The defect: `lissajous.ts` calls `MaterialProcessor.init()` unconditionally, so `state.lifetimes` was
   * published as a full-length array of ZEROS for every material-free preset, and the renderer's synth is
   * guarded on the array being ABSENT. Every particle therefore sampled `fract(0/6) = 0` — `Classic: thermal`
   * index 0, black — while `Map: Depth` looked fine because `vDepth` varies. **A guard that tests presence is
   * inert wherever presence is unconditional**, and `tsc`, `lencheck` (which asks about length) and
   * `coveragecheck` (which asks about authorship) were all structurally unable to see it. Fixed at the publish
   * site in `getState()`, with `MaterialProcessor.isLive()` as the one owner of the question; `fieldcheck` §V
   * holds the measurements and both seeds.
   *
   * ✅ **CONFIRMED BY THE OWNER 2026-09-21, ON THE THIRD SHOWING — the `'review'` tag is DROPPED.** It came inside
   * a step-level line (*"21.11 is confirmed to work fine"*), so **no route was stated and no preset was named**;
   * what it discharges is precisely what was owed here, that the producer-side fix is no longer unseen. ⚠️ **This
   * body was rejected TWICE with causes at two different LAYERS — one authored field, then an engine defect
   * upstream of the measurement that had exonerated the engine — so if it is ever re-opened, re-derive the cause
   * from scratch rather than nudging a value.** ⚠️ **The `Try:` step in the card (switch the mapping to
   * `Temperature`) is STILL inert**: `temperatures` ships published-and-zero by design, because sparks and
   * crystals feed its tail with no material, and the `effMapping` 3 → 2 degrade in `hdr-particle.ts` owns that
   * open defect. **Do not gate `temperatures` with the same `live` flag — it would drop spark heat out of the
   * splat ramp.**
   *
   * ⏳ **Card line:** *"Colour by age, on a mode with no material and no sprite: the ramp cycles every six
   * seconds and the band carries it around the figure — the whole ramp is on screen at once, because age is
   * staggered across the population rather than shared."*
   */
  'Pixel Age Palette': {
    metadata: { name: 'Pixel Age Palette', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'render-mode', 'pixel', 'palette'] },
    generators: {
      type: 'lissajous', particleCount: 18000, waveSpeed: 0.05,
      rotation: [0, 0, 0.2], angle: [0, 0, 0],
      waves: rotatingBandWaves(),
      // Neutral: the palette owns the colour here, and a strong generator colour would fight it.
      colorBase: [128, 128, 128], colorAmp: [24, 24, 24], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.2, 0.2, 0.2],
    },
    renderer: { mode: 'pixel', glow: 1.0, decayFactor: 0.80, blurRadius: 1, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'pixel',
      // ⚠️ ABSTAINS from the palette — see the doc block. This pairing is load-bearing. The `Graded` half is
      // the 2026-09-20 retune: same bundle, ACES at exposure 1.4, median lit value 27 -> 56.
      filmLook: 'Legacy Graded',
      speedFactor: 0.5,
      transMapEnabled: false,
      particleSize: 1.0,
      // ⚠️ No material anywhere in this preset: `'age'` is synthesised when `state.lifetimes` is absent — and
      // "absent" is only TRUE of a material-free preset since the 2026-09-20 publish gate (see the doc block).
      palette: 'Classic: thermal', paletteMapping: 'age',
    },
  },

  /**
   * **`21.8e` — `volume`, the second unreached render mode, and the one whose own plan step says the demo
   * might FAIL.** Volume ray-marches the accumulated density with a Beer-Lambert extinction term, so it is
   * the only mode that renders a MEDIUM rather than a set of particles: no cores, no halos, no line art — a
   * body of haze that gets denser where the figure folds over itself.
   *
   * ⚠️ **NO MATERIAL, and it is forced rather than chosen.** `resolveModeAgainstMaterial()` gives a live
   * material authority over the mode — any material except `Liquid` forces `'splat'`, and `liquid` is the only
   * mode exempt — so **a `volume` preset with a material is not a `volume` preset.** The consequence runs
   * further than the dropdown: with no material there is no temperature array, so `paletteMapping:
   * 'temperature'` is unavailable, and the volume pass reads `aColor` in any case.
   *
   * **So this demo's colour comes ENTIRELY from `colorBase/Amp/Freq/Shift`** — the generator's own per-particle
   * colour function, with no palette, no ramp and no material between it and the screen. ⚠️ **It was the ONLY
   * such demo until 2026-09-20, when `Pixel Line Art`'s retune made the same law carry its colour too; that is
   * now a pair, and a change to the law is a change to both.** The four vectors are authored as a cold
   * blue-violet with a wide `colorFreq` spread, because a
   * medium whose colour varies through its depth is what makes ray-marched haze read as volume rather than as
   * a flat wash.
   *
   * ⚠️ **`Cinematic` is here for two specific numbers: `depthSize` 0.8 and `depthDof` 0.4.** Volume reads
   * those two and ignores `glow` entirely (⚠️ **glow is an exact no-op in this mode** — the manual's *Read by*
   * column is the specification, and nothing in the UI greys it out). A look without them leaves the medium
   * uniformly sharp, which is the one appearance a haze must not have.
   *
   * ⚠️ **`P13`: THE PREVIEW TILE IS NOT THE INSTRUMENT FOR THIS PRESET.** The tile renderer collapses every
   * mode that is not `pixel` or `blend` to the same int, so a `volume` tile is drawn as `star` — it will look
   * like a perfectly ordinary particle figure and tell you nothing. **Judge it in the main view only**, and at
   * the final 8-bit output: a medium's whole content is in its low-amplitude gradients, which is exactly
   * where 8-bit banding appears.
   *
   * **`extinction: 2.2 / densityScale: 1.6 / depthFade: 0.45`, against the defaults 3.0 / 1.0 / 0.3.** Lower
   * extinction lets light through more of the body (at 3.0 the near surface hides everything behind it, which
   * defeats the mode), a raised density scale compensates so the medium is still substantial, and more depth
   * fade separates the front of the haze from the back. **The figure is `nebulaWaves()`**, whose measured
   * INCOHERENCE (arc coherence 4.72) is the property a medium wants: consecutive indices scatter, so density
   * accumulates as a cloud instead of as a visible wire.
   *
   * ✅ **OWNER-TUNED EXPORT, 2026-09-21 — `'review'` REMOVED, and all three moved values are about how the
   * medium is SEEN rather than what it is:** `decayFactor` 0.88 → **0.91**, `speedFactor` 0.3 → **0.5**,
   * `figureScale` 1.1 → **0.7018…**. **The volume block itself — `extinction: 2.2`, `densityScale: 1.6`,
   * `depthFade: 0.45` — came back untouched**, which is the measurement that mattered: the paragraph deriving
   * those three against the 3.0/1.0/0.3 defaults was checked against a frame and needed nothing. A denser trail
   * at a smaller figure is more medium in less of the canvas, i.e. the same haze with headroom around it, and
   * the faster sweep is affordable because a medium has no cores to smear.
   *
   * ⚠️ **`figureScale` is kept at FULL PRECISION** — it is a drag value, and rounding it would be a retune
   * (`Physarum Slime Net` above carries the same note for the same reason). It is a framing choice only: this
   * mode has no scale-coupled subsystem, so nothing downstream reads it twice.
   *
   * ⏳ **Card line:** *"A medium, not particles: ray-marched haze that thickens where the figure folds over
   * itself. No material and no palette — the colour is the generator's own. Watch it in the main view; the
   * preview tile draws this mode as `Star`."*
   */
  'Volume Depth Haze': {
    metadata: { name: 'Volume Depth Haze', version: 2, designResolution: { width: 75, height: 75 }, tags: ['demo', 'render-mode', 'volume'] },
    generators: {
      type: 'lissajous', particleCount: 14000, waveSpeed: 0.05,
      rotation: [0.05, 0.08, 0.03], angle: [15, 15, 0],
      waves: nebulaWaves(),
      // ⚠️ The ONLY colour source in this preset — the volume pass reads `aColor`, and there is no material
      // and no palette to override it. A wide `colorFreq` spread is what gives the medium internal variation.
      colorBase: [72, 96, 168], colorAmp: [56, 48, 72], colorFreq: [0.06, 0.11, 0.17], colorShift: [0.15, 0.35, 0.6],
    },
    // ⚠️ `glow` is an exact no-op in this mode; it is written at its neutral value rather than tuned.
    // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: `decayFactor` 0.88 -> 0.91.
    renderer: { mode: 'volume', glow: 1.0, decayFactor: 0.91, blurRadius: 3, depthSize: 0.8, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'volume',
      // For `depthSize` 0.8 / `depthDof` 0.4 — the two grading terms this mode DOES read.
      filmLook: 'Cinematic',
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 0.3 -> 0.5. A medium has no cores to smear.
      speedFactor: 0.5,
      transMapEnabled: false,
      // ⚠️ OWNER-TUNED EXPORT, 2026-09-21: 1.1 -> below, a drag value kept at full precision. FRAMING only —
      // no subsystem here reads the scale a second time. See the doc block.
      figureScale: 0.701821387749335,
      // ⚠️ Untouched by the owner's frame, which is the confirmation this block wanted.
      volumeRender: { extinction: 2.2, densityScale: 1.6, depthFade: 0.45 },
    },
  },

  /**
   * **`21.9` — the CRYSTAL pass on `shape: 'hexagon'` and `birthRule: 'random'`, the two members of their
   * unions no preset authors.** `Material Ice` ships `dendrite` + `slow`; this preset is the other corner, and
   * the two choices belong together for a reason the subsystem's own history states.
   *
   * ⚠️ **`hexagon` was the ORIGINAL default and was demoted on measurement: the 8a-3 gate found hexagons read
   * "like ice cubes" and, worse, INFLATE rather than branch when they grow.** So this body originally authored
   * **`growthEnabled: false`** and leaned the other way instead — `latticeSnap: 0.75` with `symmetryFold: true`
   * — which turns that formality into the subject: a lattice of flat six-sided plates snapping onto shared
   * axes, like frost on glass. ⚠️ **THE OWNER REVERSED THAT DECISION ON 2026-09-20 — growth is now ON; see the
   * export block at the end of this comment.** The paragraph is kept because the demotion it cites is still the
   * reason `dendrite` is the DEFAULT shape, and because the rule it stated ("a hexagon demo with growth on
   * would be a demo of the defect the demotion named", which nothing in `verify` can tell from the intended
   * thing) is exactly the kind of claim only an eye can settle — and the eye has now settled it the other way.
   *
   * ⚠️ **`crystalSize: 16`, and it is NOT comparable with `Material Ice`'s 13.** Apparent size is
   * `crystalSize x SHAPE_SIZE_COMPENSATION[shape]`, and hexagon is the 1.0 baseline while dendrite is 1.11 —
   * so 13 on a dendrite draws at 14.4 and 16 here draws at 16. **Never carry a `crystalSize` across a shape
   * change**; the compensation table is the reason the numbers look inconsistent and is not a rounding error.
   *
   * ⚠️ **`birthRule: 'random'` makes `slowFraction` and `coldFraction` UNREAD, and they are still authored in
   * full.** `applyOverlayConfigBlocks` uses `Object.assign`, so an omitted key inherits whatever the LIVE
   * session last had (invariant 14) — a crystal block must therefore write all 31 fields whether or not the
   * chosen rule reads them. Random birth is also the rule that suits `hexagon`: slow/cold birth nucleates in
   * one region of the figure, and a frost lattice wants seeds scattered over the whole of it.
   *
   * ⚠️ **Crystals are ADDITIVE pool slots — never destructive — and the slot order is
   * `[wave][sparks][liquid][crystals]`** (the pool was INSERTED, not appended). `poolSize: 1000` (owner, was
   * 640) at `freezeCap: 0.6` is the population; nucleation halts above `freezeCap x 1.1` and melting is never
   * gated, so the population self-corrects toward `freezeCap x poolSize` = **600 plates, was 384**, with the
   * nucleation halt at 660. ⚠️ **`freezeCap` is a fraction of the POOL, not of the figure**, so raising
   * `poolSize` is the only way to raise the plate count at a fixed cap.
   * ⚠️ **`material.emissionIntensity` cannot reach a crystal** — the crystal pass has its own
   * `edgeBrightness`/`specularStrength`, so brightening the material will not brighten a plate.
   *
   * **The figure is `montezumaWaves()`, flat with the widest index spacing in the library (5.45 px at
   * 20 000).** Both properties are preconditions rather than taste: crystals are drawn at the particle's
   * position, so a deep figure buries its own plates behind each other, and a tight figure produces a solid
   * white mat instead of a lattice. ⚠️ **Shrinking montezuma's design box CLIPS it**, so the framing is
   * `figureScale` only.
   *
   * ## ✅ OWNER-TUNED EXPORT, 2026-09-20 18:49 — growth ON, and the reversal is the finding
   *
   * *"Replace the following presets by finetuned ones: - Replace `Hexagon Crystal Bloom` by
   * `Hexagon Crystal Bloom_20260920_184958.json`"*. Diffed leaf by leaf against the shipped body
   * programmatically (**222 leaves, 9 changed, 22 export-only, 0 missing**): ⚠️ **every one of the nine sits in
   * `overlay.crystal`** — the figure, the material, the grade, the framing and the render mode all came back
   * byte-identical, so this export is a pass over one block and nothing else. The 22 export-only leaves are
   * runtime defaults this body deliberately does not author (`attractor*` at index -1, `curlNoise` disabled,
   * `physarum` at blend 0, `fluidAdvection` at blend 0, `ribbon*`, `lines*`, `transMapStyle`, `figureScale` 1)
   * — *an export is mostly default noise, so diff it programmatically and paste nothing you did not diff.*
   *
   * ⚠️ **`growthEnabled: false → true` REVERSES this body's own rule, and it is an AESTHETIC verdict, not a
   * measured engine defect — so the rule is recorded as overtaken, never argued with and never tuned back.**
   * The 8a-3 finding stands as a finding: hexagons DO inflate rather than branch. What the owner's eye
   * established is that inflation is not the wrong thing HERE, and the other seven live leaves say why —
   * **they are all pushing the same way, toward a merged sheet rather than isolated plates:**
   *
   *   * **`accretionRadius` 12 → 24 and `stickingProbability` 0.35 → 0.6.** Accretion is what feeds growth, and
   *     doubling the radius quadruples the neighbourhood a plate recruits from while the sticking probability
   *     nearly doubles the fraction that lands. ⚠️ **`accretionRadius` has its own spatial hash**, separate
   *     from the cluster force's, so this radius is free of the inert pair below it.
   *   * **`poolSize` 640 → 1000**, i.e. 600 live plates instead of 384 at the unchanged `freezeCap`.
   *   * **The lifecycle: `nucleationTime` 0.35 → 0.25, `crystalLifetime` 6 → 9, `meltTime` 0.9 → 0.3.** Both
   *     GHOST phases shortened while the solid phase got half again longer — 94 % of a plate's life is now
   *     solid against 83 % before. A nucleating or melting crystal is a ghost (and is excluded from the force
   *     filter), so this is the leaf that turns a flickering lattice into a standing one.
   *
   * **Inflating plates that are bigger, denser, longer-lived AND snapped onto a shared `latticeCell: 9` grid do
   * not read as ice cubes — they read as frost closing over the glass**, which is what the body was always
   * named for. `maxGrowth: 1.8` is unchanged, so a mature plate draws at `16 x 1.8 = 28.8` against a 9-unit
   * cell: **the lattice is what makes the merge legible rather than mushy**, and it is the reason growth-on
   * works here and would not in a body without `latticeSnap`.
   *
   * ⚠️ **`clusterForceRadius` 40 → 38 and `clusterForceReturn` 1.5 → 2.4 are INERT and are kept anyway.**
   * `clusterForce` came back 0 and `sampleClusterForce()` early-returns on `!force`, so neither value reaches a
   * pixel; they are the slider positions the owner left behind, and invariant 14 requires all 31 fields to be
   * authored regardless. **Do not read them as a decision** — and do not "clean them up" to the defaults either,
   * because the next export would only bring them back.
   *
   * ⏳ **Card line:** *"Frost closing over glass: six-sided plates seeded at random over the whole figure,
   * inflating on a shared lattice until they merge. The `hexagon`/`random` corner of the crystal unions —
   * `dendrite` is the default because hexagons inflate instead of branching, which is the point here."*
   */
  'Hexagon Crystal Bloom': {
    metadata: { name: 'Hexagon Crystal Bloom', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'crystal', 'material'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.05,
      rotation: [0, 0, 0.07], angle: [0, 0, 0],
      waves: montezumaWaves(),
      colorBase: [136, 168, 200], colorAmp: [48, 56, 64], colorFreq: [0.06, 0.08, 0.1], colorShift: [0.2, 0.3, 0.45],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.88, blurRadius: 3, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: rippleTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'splat', filmLook: 'Legacy Graded', speedFactor: 0.4,
      transMapEnabled: false,
      // `splat` needs a live material or it draws NOTHING, and the crystals need one to have a heat state.
      material: {
        preset: 'Ice', splatRadius: 8, coreBrightness: 1.3, haloStrength: 1.0, falloffExponent: 3.5,
        thermalLag: 0.30, emissionIntensity: 1.1, heatMode: 'velocity', heatGain: 0.9,
        blendMode: 'alpha', colourRamp: 'ice', velocityStretch: 1.0,
      },
      // ⚠️ All 31 fields, including the two `birthRule: 'random'` does not read. `Object.assign` inherits an
      // omitted key from the LIVE session (invariant 14), so a partial crystal block is not reproducible.
      crystal: {
        enabled: true,
        // The demoted original default — see the doc block. ⚠️ The clause "with growth OFF" that stood here was
        // left behind by the 2026-09-20 export, which turned growth ON forty lines below.
        shape: 'hexagon',
        // ⚠️ x SHAPE_SIZE_COMPENSATION['hexagon'] = 1.0. Not comparable with a dendrite's number.
        crystalSize: 16,
        facetSharpness: 0.95, specularStrength: 1.9, iceOpacity: 0.82,
        edgeBrightness: 1.65, internalRefraction: 0.42, crystalRamp: 'ice',
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: 640 -> 1000.
        poolSize: 1000, freezeCap: 0.6,
        birthRule: 'random', slowFraction: 0.30, coldFraction: 0.25, nucleationBudget: 10,
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: all three lifecycle times moved — 0.35/6/0.9 -> 0.25/9/0.3,
        // i.e. a longer SOLID phase with both ghost phases shortened (83 % -> 94 % of the life solid).
        nucleationTime: 0.25, crystalLifetime: 9, meltTime: 0.3, meltThreshold: 0.8,
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: the radius and return moved (40 -> 38, 1.5 -> 2.4) but
        // `clusterForce` is still 0, and `sampleClusterForce()` early-returns on `!force` — so these two are
        // INERT in this body. Kept as exported: they are the slider positions the owner left behind, and
        // authoring them is what invariant 14 requires of every field in the block anyway.
        clusterForce: 0, clusterForceRadius: 38, clusterForceReturn: 2.4,
        // The formal half: a shared lattice and 6-fold symmetry, which is what hexagons are GOOD at.
        latticeSnap: 0.75, latticeCell: 9, symmetryFold: true,
        // ⚠️ OWNER-TUNED EXPORT, 2026-09-20: growth ON, which REVERSES this body's original rule — see the
        // doc block. `accretionRadius` 12 -> 24 and `stickingProbability` 0.35 -> 0.6 come with it.
        growthEnabled: true, accretionRadius: 24, stickingProbability: 0.6,
        growthAnisotropy: 0.45, maxGrowth: 1.8, accretionBudget: 8,
      },
    },
  },

  /**
   * **`21.D5` — curl noise, the one feature the census found LIVE, TUNED and yet UNDISCOVERABLE.** The audit
   * behind this body is a naming-and-visibility one rather than a coverage one, and it is the only entry in
   * the cohort that exists for that reason: **six library presets enable `curlNoise` and NOT ONE of them
   * names it** (`Birth Of Venus`, `Mind Sight`, `Modern Art III`, `Video Tape Error`, `Ember Storm`,
   * `Imploding Sun` — measured by replay 2026-09-20), so a user who has never opened Visual FX's `Curl Noise`
   * section has no way to learn the feature exists, and `21.3`'s remedy for an existing preset — a rename —
   * is blocked pending the owner's answers. **A new named demo is therefore the only available remedy.**
   *
   * ⚠️ **Worse than unnamed: four of the six are at the edge of INVISIBLE.** Displacement is
   * `(canvasWidth + canvasHeight) x 0.05 x turbulence` PIXELS (`lissajous.ts` lines 1071-1087), so the four
   * quiet bodies — turbulence 0.03, 0.05, 0.03, 0.1 — displace **4.5, 7.5, 4.5 and 15.0 px at 1920x1080**
   * (2.7-9.0 px at 1024x768). At those magnitudes curl is a surface texture on someone else's preset, which
   * is a legitimate use and is NOT a demo. The two loud ones are loud for a different subject: `Ember Storm`
   * at 0.6 (90.0 px, scale 2, evolution 1.2) uses curl as fire's violence, and `Imploding Sun` at 0.3 uses it
   * as a collapse. **Nothing in the library shows the field's own SHAPE.**
   *
   * **What this body is FOR: the shape is divergence-free, and that is a claim you can falsify by eye.**
   * `core/curl-noise.ts` takes the curl of a 4D-simplex vector potential (Bridson et al. 2007), and the curl
   * of any field is divergence-free identically — **no sources and no sinks.** So the displacement can bend,
   * fold and braid the figure but **cannot thin it anywhere or pile it up anywhere.** That is the appeal claim
   * and it is the pass criterion: **if the frame develops holes, or knots of density, the displacement is not
   * what this body says it is** — and no checker can see that, because the arithmetic would still be right.
   *
   * **The figure is a REGULAR one on purpose — `borgCubeWaves()`, the 11x7 nodal lattice.** A deformation is
   * only visible against a shape whose undeformed form the eye already knows; on an organic figure a curl
   * displacement reads as "that is just what the figure looks like". ⚠️ **This is the same lattice as
   * `Axis Zoom Breathe` and `Radial Zoom Overlay`, and the reuse is the point**: those two warp the IMAGE (a zoom, uniform
   * and global), this one displaces the PARTICLES in model space, before the 3D transform. Loading the three
   * in turn is the cheapest way to see that an image-domain warp and a model-space displacement are different
   * subsystems that a still frame can confuse.
   *
   * **`turbulence: 0.35` -> 52.5 px at 1920x1080, 31.4 px at 1024x768.** Derived, not taste: the lattice's
   * nodes sit about 175 px apart across a 1920 frame, so 52.5 px is ~30 % of the node spacing — enough that
   * every node visibly leaves its place, not enough to dissolve the lattice into a cloud (which is what the
   * feature looks like at 0.6 on a figure not chosen for it).
   *
   * **`scale: 3.2` -> a noise wavelength of about 312 px, i.e. ~6 folds across the frame.** ⚠️ **`scale` is
   * INVERSE to feature size** — the sampled coordinate is `position x scale x 0.001`, so the wavelength is
   * roughly `1000 / scale` px and a HIGHER number means FINER structure. At 0.2 (`Modern Art III`) the whole
   * figure sways as one body; at 2.9 (`Video Tape Error`) it is per-particle jitter. What makes a braid legible
   * is the RATIO: 52.5 px of displacement over a 312 px wavelength is ~17 %, so neighbouring particles share a
   * direction and move together as a strand. Raise turbulence without raising scale and the strands stretch;
   * raise scale without lowering turbulence and the strands become fuzz.
   *
   * **`evolutionSpeed: 0.30`, low, because a braid must HOLD STILL long enough to be seen.** The field's own
   * time advances as `curlTime += dt x 0.001 x evolutionSpeed`, and what animates this preset is not the field
   * evolving but the figure's `rotation: [0, 0, 0.2]` carrying particles THROUGH a nearly static field — a
   * streamline you can follow. The slow evolution then rearranges the braid over tens of seconds.
   * ⚠️ **`P11`: at `t = 0` the noise is at one phase and the figure has not yet been carried anywhere. Judge
   * this one over a minute; a screenshot of the first second shows a lattice with a slight lean.**
   *
   * **Every authored value is representable on its shipped track** — `Turbulence` step 0.01, `Scale` step 0.1
   * at one decimal, `Evol. Speed` step 0.05 — so a user can land on this body's numbers by dragging, which is
   * the point of a demo that exists to teach the section.
   *
   * ⚠️ **The LIVE copy is `overlay.curlNoise`.** `generators.curlNoise` is deprecated, import-compat only and
   * read by nothing (`types.ts` line 676 against line 1095); a value written there is silently inert.
   * ⚠️ **`curlNoise.enabled` is CATEGORICAL, so the Mixer must SNAP it at t = 0.5** (invariant 16) — a 0.5
   * blend of on and off is not "half the turbulence", and `turbulence` is the field to interpolate.
   *
   * **`Aurora` on `paletteMapping: 'index'`, and the mapping is doing structural work rather than decorating.**
   * A braid is only a braid if you can tell one strand from another as it passes another; index mapping gives
   * each band of particle indices its own hue, so a fold reads as *this* strand crossing *that* one instead of
   * as a thicker patch. The palette is also deliberately not a fire one — `Ember Storm` owns curl-plus-fire,
   * and two presets differing only in turbulence would teach nothing. ⚠️ `filmLook: 'Legacy Graded'` is one of
   * the three looks carrying `palette: 'none'`, so it ABSTAINS and the `overlay.palette` above is what reaches
   * the shader.
   *
   * ⏳ **Card line:** *"A regular lattice folded by a divergence-free field: strands bend and braid past each
   * other, but the figure never thins out and never clumps — that is what 'no sources or sinks' looks like.
   * Load `Axis Zoom Breathe` next: same lattice, but that one warps the image instead of the particles."*
   */
  'Curl Noise Braid': {
    metadata: { name: 'Curl Noise Braid', version: 2, designResolution: { width: 100, height: 100 }, tags: ['demo', 'curl', 'noise'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.05,
      // Rotation is what carries particles THROUGH the near-static field; it is the animation, not `evolutionSpeed`.
      rotation: [0, 0, 0.2], angle: [18, 0, 0],
      waves: borgCubeWaves(),
      colorBase: [128, 128, 128], colorAmp: [96, 96, 96], colorFreq: [0.1, 0.2, 0.3], colorShift: [0.1, 0.2, 0.3],
    },
    // 0.94 / 2: long enough that a particle's path through the field draws a streamline, short enough that
    // the lattice's own nodes stay resolvable. A longer trail composites the braid into a glow.
    renderer: { mode: 'star', glow: 2.2, decayFactor: 0.94, blurRadius: 2, depthSize: 0, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: zeroTable(), sinMagicParams2: zeroTable(), zoomCenter: { x: 50, y: 50 } },
      ...inertGrading(),
    },
    overlay: {
      renderMode: 'star', filmLook: 'Legacy Graded', speedFactor: 0.5,
      transMapEnabled: false,
      // ⚠️ THE LIVE COPY — `main.ts` reads `ov.curlNoise`; `generators.curlNoise` is deprecated and inert.
      // 0.35 -> 52.5 px at 1920x1080; scale 3.2 -> ~312 px wavelength; both derived in the doc block.
      curlNoise: { enabled: true, turbulence: 0.35, scale: 3.2, evolutionSpeed: 0.30 },
      // Index mapping separates the strands, which is what makes a crossing read as a crossing.
      palette: 'Aurora', paletteMapping: 'index',
    },
  },


  /*
   * ════════════════════════════════════════════════════════════════════════════════════════════════
   * THE 2026-10-07 OWNER SET — three Lab exports, renamed and kept VERBATIM
   * ════════════════════════════════════════════════════════════════════════════════════════════════
   *
   * ⚠️ **THESE THREE ARE NOT FEATURE DEMOS AND THIS HEADER'S "one preset per FEATURE" RULE DOES NOT APPLY
   * TO THEM.** They are presets the owner made in the Lab and asked for by name, so the only criterion they
   * answer is that the owner wanted them in the standard list. **`coveragecheck` never asked for them**, and
   * a future audit that finds them answering no coverage row should leave them alone rather than cut them.
   *
   * ⚠️ **OWNER EXPORTS, KEPT VERBATIM APART FROM `metadata.name` AND NINE QUANTISED COMPONENTS — DO NOT
   * RE-TUNE BEYOND THAT, and do not "normalise" a value toward anything this file derives elsewhere.**
   * *A hand-tuned preset the owner accepted outranks any refinement rule.*
   *
   * ⚠️ **WHAT WAS QUANTISED, AND WHY IT IS NOT A RETUNE (2026-10-07):** the exports carried raw double
   * precision (`0.14005893094831323`, `1.6407267327783408`) and **an authored value a slider track cannot
   * represent is a defect — readout precision included.** `trackcheck` caught four clauses: the rotation
   * round-trip count, the rotation **READOUT**, and the `colorFreq`/`colorShift` curve round trips. The
   * rotation, `colorFreq` and `colorShift` components are therefore stored as **the value the track itself
   * produces** — `posToRotation(sanitize(rotationToPos(v)))` and each colour track's own `fromPos(toPos(v))`
   * — which is the number the engine would snap to on the first drag and the number the readout already
   * showed. **Nothing else was touched: every other value, including the long floats, is the export's own.**
   *
   * ⚠️ **ONLY ONE OF THE NINE CHANGED WHAT THE USER SEES** — `Dancing Rays II`'s rotation X readout, −0.27 cw
   * → −0.28 cw — and that is the defect, not the fix: the stored value and the displayed value disagreed, so
   * the preset would have shown a different number after a load. The other eight are invisible, the largest
   * being 1.6407 → 1.65 (0.57 %). **Do not restore the raw floats to make the bodies match the download; the
   * downloads are the source and these are the representable form of them.**
   *
   * ⚠️ **`Dancing Rays II` IS NAMED "II" BECAUSE `Dancing Rays` WAS ALREADY TAKEN, AND THAT WAS AN OWNER
   * DECISION RATHER THAN A TIDY-UP (2026-10-07).** The existing `Dancing Rays` is the grading-only settle of
   * 2026-09-12 in `refined-presets.ts`, which REPLACES the legacy original and its `Dancing Rays new`
   * counterpart and is named by two built-in reels. **A NAME IS A PRIMARY KEY IN FIVE OWNERS — a duplicate
   * FREEZES A TILE rather than repeating a label** — so the collision had to be resolved before these could
   * be added at all. The owner chose to keep both; the `II` suffix follows `Cycloid II`, `Aurora Borealis II`
   * and `Hypnosis II`. **Neither preset is a variant of the other and neither may be merged into the other.**
   *
   * ⚠️ **`Reflections in the Water` CARRIES `tags: ['refined', 'ice']` FROM ITS SOURCE EXPORT, and the tag is
   * descriptive here rather than structural** — it was tuned from `Behind A Glass Window v2`. It is a DEMO
   * entry, not a `refined-presets.ts` settle, so it REPLACES nothing and must not be keyed by another
   * preset's name.
   *
   * ⚠️ **It is also the only one of the three with an `overlay.transMapChain`**, which is why all three had
   * to go into a TS group rather than the curated JSON: **a TransMap chain survives `migrate` but cannot
   * live in the legacy JSON**, and the legacy schema carries no `overlay` block at all (0 of its 177 do).
   *
   * **All three were added to `Grand Tour` in the same sitting**, which is mandatory rather than optional:
   * that reel is GENERATED as the whole composed library and `reelcheck` asserts it equals the library as a
   * set in both directions, so a preset added here and not there goes red at the next `verify`.
   *
   * ⏳ **NOT BROWSER-CONFIRMED.** They are owner exports, so their bodies were seen in the Lab when they were
   * made — but nothing in this tree has rendered them since, and they have never been seen in the preview
   * grid, in a reel or at the deployment's canvas size.
   */
  /** Owner export `Evo Gen 9_20261003_225620.json`, exported as `Evo Gen 9`. Verbatim apart from `metadata.name`. */
  'Dancing Rays II': {
    metadata: { name: 'Dancing Rays II', version: 2, designResolution: { width: 75, height: 75 } },
    generators: {
      type: 'lissajous',
      particleCount: 14503,
      waveSpeed: 0.17718034140531363,
      rotation: [1.6500000000000001, 1.42, 4.88],
      angle: [0, 0, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 0,
              am: { base: 0, amplitude: 0, frequency: 0 },
              fm: { base: 0, amplitude: 2.5508312853783948, frequency: 2.1407409069659007 },
            },
            {
              phase: 0,
              am: { base: 61.14000198243448, amplitude: 1.7226251867725881, frequency: 0 },
              fm: { base: 0, amplitude: 5.13749648580074, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 483.0880269830107, frequency: 0 },
              fm: { base: 0, amplitude: 20.771762560528327, frequency: 3.290891559777044 },
            },
          ],
        },
        {
          speed: 0.05,
          axes: [
            {
              phase: 0.6359999999999997,
              am: { base: 0, amplitude: 8.874544627749884, frequency: 7.312567205744439 },
              fm: { base: 0, amplitude: 6.381973413748989, frequency: 4.42320314721538 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 9.9048669662585, frequency: 8.04382392631888 },
              fm: { base: 1.4015790880311307, amplitude: 12.551846792601182, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 0, frequency: 8.775080646893326 },
              fm: { base: 0, amplitude: 56.951114742691544, frequency: 10.650318125705972 },
            },
          ],
        },
        {
          speed: 0.05,
          axes: [
            {
              phase: 83.232,
              am: { base: 0, amplitude: 2.698387643694568, frequency: 0 },
              fm: { base: 91.93711547973611, amplitude: 0, frequency: 0.42776263326010866 },
            },
            {
              phase: 0,
              am: { base: 5.347962730983902, amplitude: 1.2068296410969637, frequency: 0 },
              fm: { base: 0, amplitude: 11.152024755475558, frequency: 1.9931925620651594 },
            },
            {
              phase: 0,
              am: { base: 41.22734885579886, amplitude: 0, frequency: 0 },
              fm: { base: 239.45745596279886, amplitude: 5.76015626729235, frequency: 2.525727281065472 },
            },
          ],
        },
      ],
      colorBase: [161.3890561842778, 163.25499173279252, 102.46869897436574],
      colorAmp: [116.5701897515547, 81.29542906777263, 154.81297115985785],
      colorFreq: [242.9, 64.9, 0],
      colorShift: [0.146, 0.398, 0.267],
    },
    renderer: {
      mode: 'blend',
      glow: 1.5746410910138926,
      decayFactor: 0.7113526572508124,
      blurRadius: 4,
      depthSize: 0.7357373527816242,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: false,
        style: 0,
        beforeParticles: false,
        sinMagicParams: [
          [0.6025, 0.735, 0.53, 1.06],
          [17.900000000000002, 10.36, 4.24, 2.12],
          [1.781, 1.212, 1.484, 2.968],
          [10.36, 8, 2.12, 1.06],
        ],
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
      palette: 'Cycle: Neutral',
      paletteMapping: 'index',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'blend',
      transMapEnabled: false,
      transMapStyle: 0,
      curlNoise: { enabled: false, turbulence: 0.17198838772894612, scale: 1.875596009176736, evolutionSpeed: 0.5 },
      speedFactor: 0.6580634937621823,
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
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 1.569320331070751,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 2.4627663015120116,
        vignette: 0,
        palette: 'none',
        paletteMapping: 'depth',
      },
    },
  },

  /** Owner export `Evo Gen 1_20261003_225157.json`, exported as `Evo Gen 1`. Verbatim apart from `metadata.name`. */
  'Flying Zebras': {
    metadata: { name: 'Flying Zebras', version: 2, designResolution: { width: 75, height: 75 } },
    generators: {
      type: 'lissajous',
      particleCount: 22822,
      waveSpeed: 0.08052153719229868,
      rotation: [2.42, 0.21, 4.88],
      angle: [0, 0, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 83.232,
              am: { base: 22.35, amplitude: 0, frequency: 0 },
              fm: { base: 0.47, amplitude: 5.85005376459555, frequency: 0.7312567205744438 },
            },
            {
              phase: 0,
              am: { base: 22.35, amplitude: 0, frequency: 0 },
              fm: { base: 0.47, amplitude: 5.85005376459555, frequency: 0.7312567205744438 },
            },
            {
              phase: 0,
              am: { base: 53, amplitude: 0, frequency: 0 },
              fm: { base: 0, amplitude: 11.7001075291911, frequency: 0.7312567205744438 },
            },
          ],
        },
        {
          speed: 0.05,
          axes: [
            {
              phase: 0.6359999999999997,
              am: { base: 0, amplitude: 6.399224910441838, frequency: 7.312567205744439 },
              fm: { base: 5.693460718654353, amplitude: 3.9113074485261716, frequency: 1.8724885651632743 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 20.471661313703834, frequency: 8.04382392631888 },
              fm: { base: 25.292279823062536, amplitude: 9.414092499091165, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 30.603083931443866, frequency: 8.775080646893326 },
              fm: { base: 0, amplitude: 0, frequency: 6.725272392176761 },
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
      colorBase: [119.80965361517718, 96.04088718294513, 156.232079609411],
      colorAmp: [91.19361796799083, 107.33109869135423, 127.36806866416867],
      colorFreq: [118.5, 0.003, 4.406],
      colorShift: [0.025, 0, 0.19],
    },
    renderer: {
      mode: 'blend',
      glow: 1.9341177473577842,
      decayFactor: 0.8011854374508085,
      blurRadius: 4,
      depthSize: 0.7357373527816242,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: false,
        style: 0,
        beforeParticles: false,
        sinMagicParams: [
          [0.6025, 0.735, 0.53, 1.06],
          [17.900000000000002, 10.36, 4.24, 2.12],
          [1.781, 1.212, 1.484, 2.968],
          [10.36, 8, 2.12, 1.06],
        ],
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
      palette: 'Cycle: Neutral',
      paletteMapping: 'index',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'blend',
      transMapEnabled: false,
      transMapStyle: 0,
      curlNoise: { enabled: false, turbulence: 0.009397957640209302, scale: 1.3623558786170145, evolutionSpeed: 0.5 },
      speedFactor: 0.6580634937621823,
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
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 1.569320331070751,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 2.4627663015120116,
        vignette: 0,
        palette: 'none',
        paletteMapping: 'depth',
      },
    },
  },

  /** Owner export `Behind A Glass Window v2_20261003_210948.json`, exported as `Behind A Glass Window v2`. Verbatim apart from `metadata.name`. */
  'Reflections in the Water': {
    metadata: {
      name: 'Reflections in the Water',
      version: 2,
      designResolution: { width: 75, height: 75 },
      createdWith: 'refined-presets generator',
      tags: ['refined', 'ice'],
    },
    generators: {
      type: 'lissajous',
      particleCount: 20000,
      waveSpeed: 0.07357373527816242,
      rotation: [0.14, 0.14, 2.81],
      angle: [16, 16, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 90,
              am: { base: 9.375, amplitude: 2.2744566959486825, frequency: 7.357373527816242 },
              fm: { base: 1, amplitude: 0, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 9.375, amplitude: 2.2744566959486825, frequency: 8.82884823337949 },
              fm: { base: 1, amplitude: 0, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 0, amplitude: 1.819565356758946, frequency: 1.4714747055632484 },
              fm: { base: 128, amplitude: 12.8, frequency: 0.2 },
            },
          ],
        },
        {
          speed: 0.05,
          axes: [
            {
              phase: 2.7,
              am: { base: 9.375, amplitude: 2.2744566959486825, frequency: 10.300322938942738 },
              fm: { base: 10, amplitude: 0, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 9.375, amplitude: 2.2744566959486825, frequency: 11.771797644505988 },
              fm: { base: 10, amplitude: 0, frequency: 0 },
            },
            {
              phase: 0,
              am: { base: 450, amplitude: 36.39130713517892, frequency: 1.4714747055632484 },
              fm: { base: 0, amplitude: 1.6, frequency: 0.1 },
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
      colorBase: [138.85497360743176, 32, 44.247604823794106],
      colorAmp: [64, 64, 128],
      colorFreq: [3.198, 0.9114, 0.9919],
      colorShift: [1.611, -0.127, 0.8],
    },
    renderer: {
      mode: 'star',
      glow: 1.40364277549867,
      decayFactor: 0.7703703703703705,
      blurRadius: 4,
      depthSize: 1.4005893094831323,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: true,
        style: 0,
        beforeParticles: false,
        sinMagicParams: [[3, 2, 1, 0], [-3, -9, -27, 0], [4.2, 2.8, 1.4, 0], [3, 9, 27, 0]],
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
      palette: 'Cycle: Neutral',
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
            pattern: '(Preset)',
            strength: 0.75,
            detail: 1,
            drift: 0.006,
            pattern2: '(Preset)',
            strength2: 0.5,
            zoomBias: 0,
          },
        },
      ],
      curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
      speedFactor: 1.9659270656966696,
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
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 1.2327247073043635,
        lift: [0, 0, 0],
        gamma: [1, 1, 1],
        gain: [1, 1, 1],
        saturation: 1.5196102039986283,
        vignette: 0,
        palette: 'none',
        paletteMapping: 'depth',
      },
    },
  },
  /* ════════════════════════════════════════════════════════════════════════════════════════════════
   * THE 2026-10-10 OWNER SET — three Lab exports, renamed and kept VERBATIM
   * ════════════════════════════════════════════════════════════════════════════════════════════════
   *
   * The second cohort of this kind; **every rule in the 2026-10-07 banner above applies unchanged** and
   * is not repeated here. In particular: these are **not** feature demos, `coveragecheck` never asked
   * for them, and *a hand-tuned preset the owner accepted outranks any refinement rule.*
   *
   * ⚠️ **ALL THREE WERE EXPORTED AS `Evo Gen 8`** — one generation, three picks — so the source files are
   * told apart by their TIMESTAMP and nothing else. The mapping is in each entry's own comment and is the
   * only record of which download became which name:
   *   `…_20261009_195801` → `Mosaic in Glass`,  `…_20261010_111916` → `Through a Lense`,
   *   `…_20261010_105508` → `Vortex Dances`.
   * **Do not infer it from the order of the entries below.**
   *
   * ⚠️ **NO NAME COLLISION TO RESOLVE THIS TIME** (checked before adding, against the whole library, not
   * just this file): unlike `Dancing Rays II`, none of these three needed a suffix. **A NAME IS A PRIMARY
   * KEY IN FIVE OWNERS and a duplicate FREEZES A TILE**, so that check is mandatory rather than tidy.
   *
   * **All three were added to `Grand Tour` in the same sitting**, which is mandatory: that reel is
   * GENERATED as the whole composed library and `reelcheck` asserts it equals the library as a set in
   * BOTH directions, so a preset added here and not there goes red at the next `verify`.
   *
   * ⏳ **NOT BROWSER-CONFIRMED.** Owner exports, so their bodies were seen in the Lab when they were made;
   * nothing in this tree has rendered them since.
   */
  /**
   * Owner export `Evo Gen 8_20261009_195801.json`, exported as `Evo Gen 8`. Verbatim apart from
   * `metadata.name` and ONE quantised component.
   *
   * ⚠️ **`generators.colorFreq[1]` is stored as `0.154`, not the export's `0.15400000000000003`.**
   * `trackcheck`'s "all authored colorFreq components round-trip exactly through the CURVE" clause
   * caught it — **an authored value a slider track cannot represent is a defect, readout precision
   * included** — and the stored form is the value the track itself produces, `fromPos(toPos(v))`, which
   * is what the engine would snap to on the first drag and what the readout already showed. The change
   * is INVISIBLE: it is float noise on a value that was already 0.154 to every digit the UI prints.
   * **Nothing else in any of the three was touched**; every other component round-trips exactly, which
   * was measured rather than assumed.
   */
  'Mosaic in Glass': {
    metadata: {
      name: 'Mosaic in Glass',
      version: 2,
      designResolution: {
        width: 100,
        height: 100,
      },
      createdWith: 'refined-presets generator',
      tags: [
        'refined',
        'abstract',
      ],
    },
    generators: {
      type: 'lissajous',
      particleCount: 14600,
      waveSpeed: 0.05,
      rotation: [0.54, 0.54, 1],
      angle: [0, 0, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 0,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 8.28,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
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
              phase: 48.6,
              am: {
                base: 23.03999856,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 0.54,
              },
            },
            {
              phase: 13.799999999999999,
              am: {
                base: 23.040000720000002,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 1.08,
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
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 5.914219999999999,
              am: {
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
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
      colorBase: [128, 157.44, 186.42000000000002],
      colorAmp: [98.56, 98.56, 69.12],
      colorFreq: [0.1, 0.154, 0.162],
      colorShift: [0.1, 0.2, 0.162],
    },
    renderer: {
      mode: 'star',
      glow: 2,
      decayFactor: 0.8543209876543211,
      blurRadius: 4,
      depthSize: 0,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: true,
        style: 2,
        beforeParticles: false,
        sinMagicParams: [
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
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
      ribbonWidth: 4,
      linesEnabled: true,
      lineWidth: 1,
      filmLook: 'Customize',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'star',
      transMapEnabled: true,
      transMapStyle: 2,
      transMapChain: [
        {
          style: 2,
          enabled: true,
          weight: 1,
          staticField: {
            pattern: '(Preset)',
            strength: 1.2,
            detail: 1,
            drift: 0,
            pattern2: '(Preset)',
            strength2: 0.5,
            zoomBias: 0,
          },
        },
      ],
      curlNoise: {
        enabled: false,
        turbulence: 0,
        scale: 1,
        evolutionSpeed: 0.5,
      },
      speedFactor: 1.01,
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
        bloomEnabled: false,
        bloomThreshold: 0.15,
        bloomIntensity: 1.2,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 0.78,
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
  /** Owner export `Evo Gen 8_20261010_111916.json`, exported as `Evo Gen 8`. Verbatim apart from `metadata.name`. */
  'Through a Lense': {
    metadata: {
      name: 'Through a Lense',
      version: 2,
      designResolution: {
        width: 100,
        height: 100,
      },
      createdWith: 'refined-presets generator',
      tags: [
        'refined',
        'abstract',
      ],
    },
    generators: {
      type: 'lissajous',
      particleCount: 14600,
      waveSpeed: 0.05,
      rotation: [0.54, 0.54, 1],
      angle: [0, 0, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 0,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 8.28,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
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
              phase: 48.6,
              am: {
                base: 23.03999856,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 0.54,
              },
            },
            {
              phase: 13.799999999999999,
              am: {
                base: 23.040000720000002,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 1.08,
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
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 5.914219999999999,
              am: {
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
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
      colorBase: [128, 157.44, 186.42000000000002],
      colorAmp: [98.56, 98.56, 69.12],
      colorFreq: [5.663, 1.167, 0.4225],
      colorShift: [0.093, 0.235, 0.162],
    },
    renderer: {
      mode: 'star',
      glow: 2,
      decayFactor: 0.8543209876543211,
      blurRadius: 4,
      depthSize: 0,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: true,
        style: 2,
        beforeParticles: false,
        sinMagicParams: [
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
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
      ribbonWidth: 4,
      linesEnabled: true,
      lineWidth: 1,
      filmLook: 'Customize',
      palette: 'Cycle: Neutral',
      paletteMapping: 'index',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'star',
      transMapEnabled: true,
      transMapStyle: 4,
      ifsParams: [
        {
          angle: 45,
          scale: 0.75,
          tx: 0,
          ty: 0,
          weight: 1,
        },
      ],
      transMapWarpMix: 0.32,
      curlNoise: {
        enabled: false,
        turbulence: 0,
        scale: 1,
        evolutionSpeed: 0.5,
      },
      speedFactor: 1.01,
      figureScale: 1,
      particleSize: 0.57,
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
        bloomEnabled: false,
        bloomThreshold: 0.15,
        bloomIntensity: 1.2,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 0.78,
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
  /** Owner export `Evo Gen 8_20261010_105508.json`, exported as `Evo Gen 8`. Verbatim apart from `metadata.name`. */
  'Vortex Dances': {
    metadata: {
      name: 'Vortex Dances',
      version: 2,
      designResolution: {
        width: 100,
        height: 100,
      },
      createdWith: 'refined-presets generator',
      tags: [
        'refined',
        'abstract',
      ],
    },
    generators: {
      type: 'lissajous',
      particleCount: 14600,
      waveSpeed: 0.05,
      rotation: [0.54, 0.54, 1],
      angle: [0, 0, 0],
      waves: [
        {
          speed: 0.05,
          axes: [
            {
              phase: 0,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 8.28,
              am: {
                base: 4.3125,
                amplitude: 4.3125,
                frequency: 2.3,
              },
              fm: {
                base: 2.3,
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
              phase: 48.6,
              am: {
                base: 23.03999856,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 0.54,
              },
            },
            {
              phase: 13.799999999999999,
              am: {
                base: 23.040000720000002,
                amplitude: 8.625,
                frequency: 1.38,
              },
              fm: {
                base: 1.38,
                amplitude: 4.32,
                frequency: 1.08,
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
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
                amplitude: 0,
                frequency: 0,
              },
            },
            {
              phase: 5.914219999999999,
              am: {
                base: 2.15625,
                amplitude: 2.15625,
                frequency: 3.2199999999999998,
              },
              fm: {
                base: 3.2199999999999998,
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
      colorBase: [128, 157.44, 186.42000000000002],
      colorAmp: [98.56, 98.56, 69.12],
      colorFreq: [5.663, 1.167, 0.4225],
      colorShift: [0.093, 0.235, 0.162],
    },
    renderer: {
      mode: 'star',
      glow: 2,
      decayFactor: 0.8543209876543211,
      blurRadius: 4,
      depthSize: 0,
      streaks: 0,
    },
    postProcessors: {
      transMap: {
        enabled: true,
        style: 2,
        beforeParticles: false,
        sinMagicParams: [
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
          [1, 1, 0.1, 0],
          [4, 1, 60, 0],
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
      ribbonWidth: 4,
      linesEnabled: true,
      lineWidth: 1,
      filmLook: 'Customize',
      palette: 'Cycle: Neutral',
      paletteMapping: 'index',
      attractorIndex: -1,
      attractorBlend: 0.6,
      renderMode: 'star',
      transMapEnabled: true,
      transMapStyle: 5,
      proceduralFlow: {
        strength: 0.9,
        scale: 0.7,
        curlAmount: 0.1,
        direction: [0, 0],
        radial: -1,
        evolutionSpeed: 0.4,
        archetype: 'Strong Implosion',
      },
      curlNoise: {
        enabled: false,
        turbulence: 0,
        scale: 1,
        evolutionSpeed: 0.5,
      },
      speedFactor: 1.01,
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
        bloomEnabled: false,
        bloomThreshold: 0.15,
        bloomIntensity: 1.2,
        toneMapEnabled: true,
        toneMapCurve: 'aces',
        exposure: 0.78,
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
};
