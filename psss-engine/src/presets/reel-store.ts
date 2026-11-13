/**
 * The reel library — three sources, one merged view, and the engine's FIRST persistence of any kind.
 *
 * ⚠️ **Read `research_paper_psss_fractal_v8.md` → *Phase 19* → 19.2 before editing.** Three properties here
 * fail silently and none of them is visible to `tsc`:
 *
 * 1. **`localStorage` holds ONLY the user's own reels, never the merged view.** Writing the merge back is the
 *    obvious implementation and it freezes the built-in reels at whatever the FIRST run of the FIRST build
 *    wrote: a later build that adds a preset to `Grand Tour`, or fixes a name in it, would ship that change
 *    to new users only, and the ones who had ever opened the tab would keep the old copy forever with no way
 *    to tell. The merge is recomputed on every read; only a reel the user actually saved is persisted.
 * 2. **A name is a primary key in four places here** (the merge, the dropdown, `mainReelName`, the import
 *    collision test) and every comparison goes through `sameReelName`. A second, case-sensitive comparison
 *    reads as "the dropdown shows two reels but Delete only ever removes one of them".
 * 3. **The main reel is a NAME on the store, not a flag on a `Reel`.** A `boolean` per reel makes "two mains"
 *    and "no main" both representable, and the second one is silent: the autostart just does nothing. See
 *    `reel-model.ts`'s `Reel` interface, which deliberately has no `isMain` field.
 *
 * The precedence, lowest first: **built-in (this file) → deployment (`psss_reels.json`, or the legacy
 * `__reels` key) → the user's `localStorage`**. Each layer shadows the one below it BY NAME, so a user who
 * edits `Grand Tour` gets their own copy and the built-in one steps aside; deleting that copy brings the
 * built-in back (`remove`'s write-up).
 *
 * ⚠️ **The deployment layer has TWO possible sources and exactly ONE field** (`deploymentReels`): `main.ts`
 * chooses between them once, in one stated order, and neither `adoptDeploymentReelFile` nor
 * `adoptDeploymentReels` may be called after the other. See `REEL_DEPLOYMENT_FILE` at the foot of this file.
 */

import {
  REEL_DEFAULT_SECONDS,
  sameReelName,
  sanitiseReel,
  sanitiseReelFile,
  serialiseReelFile,
  parseReelFile,
  type Reel,
} from '../exploration/reel-model.ts';
import { nextVersionedName } from '../ui/synthesis-lab/export.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The built-in reels — the floor, and the only layer that is guaranteed to exist
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **SIX of the seven are GENERATED and `Fire & Plasma` is CURATED — the shapes are not interchangeable and
 * the difference is stated per reel.** For a generated reel the rule above it is authoritative and the list is
 * a reproducible snapshot of running that rule; for the curated one the LIST is authoritative and there is no
 * rule to re-run. ⚠️ **Never regenerate `Fire & Plasma`**: the owner replaced the classifier's 68-preset output
 * with a hand-picked seven on 2026-09-24 (adopted from their own `Export Reels` file — see that reel's own
 * write-up), which is a verdict on the classifier, and a well-meaning regeneration would silently discard it.
 *
 * ⚠️ **The whole array is the owner's 2026-09-24 import, adopted as the production list.** The instruction was
 * *"only use the reels in that import file and make those the official reel list which is included in the
 * production build version"*, so this array and that file are two copies of one decision: **six reels came back
 * from it BYTE-IDENTICAL, `Fire & Plasma` is the only member that moved**, and the deployment's
 * `psss_reels.json` is written from this array by `scripts/export-library.mjs` — never hand-authored.
 *
 * `Grand Tour` is the WHOLE composed library in library order (2026-09-19 at 247 names,
 * owner request; REGENERATED 2026-09-20 at 273 after the demo cohort, and again the same day at 274 when
 * `Curl Noise Braid` was added — ⚠️ **three readings of one instrument, not a series: never scale a figure
 * below from one of the others**), obtained by listing `PresetManager` after `loadLibrary`, never typed out —
 * ⚠️ **the generator must `delete rawPresets.__reels` first**, exactly as `export-library.mjs` does, or
 * composition migrates the reel list into a preset named `__reels` and the array gains ONE MORE member than
 * the library has, resolving to a garbage tile.
 *
 * A name that resolves to nothing is not an error at runtime: `resolveReel` drops it into `skipped` and the
 * reel plays shorter, which reads as "the reel is fine, this build just has fewer presets". The only thing
 * standing between a typo and a silently shorter built-in reel is `reelcheck` §J, which resolves every name
 * here AND asserts `Grand Tour` equals the library exactly. That second clause is what goes red when a preset
 * is added, renamed or settled: **regenerate that list, never relax it.**
 *
 * ⚠️ **The generated themed reels have no such clause, and only two can have one**: their rules read `overlay`
 * fields (material, palette, crystals, the wave's Z reach, the transmap style) that a preset is free to change,
 * so a retune can move a preset between reels with nothing going red. `Materials` and `Geometry` are the
 * exceptions — their rule is one objective predicate and `reelcheck` §J re-derives both. The rules are stated
 * per reel below so a regeneration is reproducible; they are NOT a runtime filter, because a reel is a stored
 * list of names and making one computed would make its membership unexportable and unpersistable.
 *
 * ⚠️ **SIX share one playback mode, `Fire & Plasma` does not, and the exception is the owner's** (the rule was
 * "the same mode as Grand Tour shall be applied", 2026-09-24; the curated reel came back the same day at its own
 * `sequential`/18 s/`fade`). The shared mode is `random` — which deals from a shuffled deck and reshuffles per
 * pass, so a pass is every member exactly once in an order that differs run to run — `REEL_DEFAULT_SECONDS`
 * (20 s), and `black`. **`Grand Tour` moved from `fade` to `black` on 2026-09-24 by owner decision**, which
 * closes the defect its old comment recorded: the twelve hand-picked members it began as were all
 * high-accumulation, but the library is not, so cross-fading a pass put a visible double image on the crisp
 * low-accumulation figures (`Cylinder`, `Quader`, `Pipes`). ⚠️ **That is an argument about the MEMBERSHIP, not
 * about `fade`** — which is why the seven-preset curated reel keeps it.
 *
 * At `black` = 1900 ms a pass is `passSeconds(274, 20, 'black')` = 6000.6 s (~100 min); the themed reels come to
 * 569.4 / 1839.6 / **138.6** / 1160.7 / 1730.1 / 1511.1 s in array order. **The `black` figures are
 * `count × 21.9` and `Fire & Plasma`'s is `count × 19.8` (18 s + `fade`'s 1800 ms) — two rates, so a figure
 * scaled from the wrong neighbour is wrong by 10 %; compute each per reel.**
 */
export const BUILT_IN_REELS: readonly Reel[] = [
  {
    name: 'Grand Tour',
    // GENERATED — the whole composed library, in library order. Regenerate; do not edit a name by hand.
    // ⚠️ **REGENERATED 2026-11-13 at 377** (was 375) — the owner's `Jagged Glass` and `Skin of a Snake`, appended at the END.
    // ⚠️ **REGENERATED 2026-11-13 at 375** (was 378) — the three `… Contours` presets DELETED (owner): each was a
    // byte-identical copy of its own parent once the 11-01 ray→contour conversion removed their one difference.
    // ⚠️ **REGENERATED 2026-11-13 at 378** (was 373) — the five Phase 37 strand demos, appended in library order.
    // ⚠️ **REGENERATED 2026-11-13 at 373** (was 366) — the seven curve demos of that date (two of them on trial) (four new closed-tile rules
    // and the `Customize` golden dragon), appended in library order at the END (`atEnd`).
    // ⚠️⚠️ **REGENERATED 2026-11-01 at 325** (was 330) — the owner's `Pipes`-FAMILY CONSOLIDATION, taken
    // after a measured similarity census of the sixteen `Pipes` derivatives. SIX entries left and ONE
    // arrived: `Pipes Spread` + `Pipes Taper` + `Pipes Bend` merged into **`Pipes Taper Bend Spread`**
    // (they were ONE LEAF apart from each other), and `Pipes Mitred`, `Pipes Sweep` (redundant against
    // `Pipes Sweep Breath`, which carries both their operators) and `Pipes Chambers` (kept `Pipes Twist`
    // and `Pipes Wound Chambers` instead) were deleted.
    // ⚠️ **No themed reel named ANY of the six — checked, not assumed**: `Geometry`, `Water and Ice`, `2D`,
    // `3D` and `Fire & Plasma` hold `Pipes` and `Pipes Art` only, so this edit touches `Grand Tour` alone.
    // ⚠️ **`Materials` re-derived at 89, identical INCLUDING ORDER** — none of the six carried a material.
    // ⚠️⚠️ **ONE KEY LOST ITS LAST CARRIER AND IT WAS NOMINAL: `boxFoldScale`, authored ONLY by
    // `Pipes Chambers` and authored there at `1`, which IS the generator's default.** So no picture and no
    // behaviour depends on it; what is gone is the key being authored anywhere, which makes any
    // library-reading clause for it vacuous. Re-homing it means giving `Pipes Wound Chambers` a
    // NON-identity scale, i.e. changing a kept preset's picture — an owner decision, not a repair.
    // ⚠️ **REGENERATED 2026-10-31 at 330** (was 329) — the owner's THIRD batch of that date: four Phase 33
    // curve bodies replaced by finetuned exports (`Quader Torus Knot`, `Cylinder Viviani`, `Quader Granny`,
    // `Cylinder Spherical Spiral`) and one addition, `Fluid Viviani`, `atEnd`. ⚠️ **339 → 336 → 329 → 330 in
    // ONE DAY: four events. Never quote a net figure for this date.**
    // ⚠️⚠️ **AND `Materials` MOVED FOR THE FIRST TIME IN THIS WHOLE SEQUENCE — 88 → 89 — because the
    // finetuned `Quader Torus Knot` ships `renderMode: 'splat'` with the `Organic` MATERIAL, where the body
    // it replaced carried no overlay at all.** Re-derived from its own rule (`overlay.material.preset` set
    // and not `'None'`) and re-emitted, rather than hand-edited. **Three previous batches left it untouched
    // and that was MEASURED each time; this one does not, which is why the rule is re-run and never assumed.**
    // ⚠️⚠️ **REGENERATED 2026-10-31 at 329** (was 336, earlier the same day 339) — the owner's SECOND
    // deletion batch of that date: `Pipes Gear Crown`, `Cylinder Drift Nebula`, `Warp Trapezoid Ribbon`,
    // `Warp Split Shapes`, `Warp Torn Zoom`, `Warp Oblique Ridge`, `Warp Zoom Oblique`. ⚠️ **339 → 336 →
    // 329 is THREE events in one day; read the figure by the batch that moved it, never as a net change.**
    // ⚠️ **`Materials` re-derived at 88, identical INCLUDING ORDER, so untouched; `Fire & Plasma` curated
    // and untouched. No deleted name appears in any other built-in reel — checked, not assumed.**
    // ⚠️⚠️ **THE CENSUS THIS TIME FOUND NO OVERLAY KEY LOSING ITS LAST CARRIER, BUT FOUR STATIC-FIELD
    // QUANTITIES LOSING EVERY LIVE ONE: `shape2` + `shapeMix2` (only `Warp Split Shapes` drove them) and
    // `angleX2` + `angleY2` (only `Warp Zoom Oblique`).** Both presets' own headers said they existed for
    // exactly that — the zoom half's shape and the zoom angle pair — so after this batch **no shipped
    // preset exercises `buildZoomWave`'s shaped branch or the zoom-angle index**, and every clause that
    // reads the LIBRARY for them is vacuous. `shapecheck`'s unit clauses still cover the arithmetic.
    // ⚠️⚠️ **REGENERATED 2026-10-31 at 336** (was 339) for the owner's review batch, and it is THREE
    // events in one edit rather than a net change: FIVE Phase 34 demos deleted on visual grounds
    // (`Cylinder Crystal Breath`, `Multiple Scale Ladder`, `Quader Flare Broadside`, `Quader Flare Pulse`,
    // `Cylinder Breathing Helix`), NINE bodies replaced by owner-finetuned exports (no count change), and
    // TWO new bodies added (`Square Mosaic`, `Cylinder Kaleidoskope`), both `atEnd`.
    // ⚠️ **`reelcheck` demanded it before anything else ran**: *"5 missing"* on the name-resolution clause
    // and *"2 missing, 5 extra"* on the equals-the-library clause. Read a red here as an un-regenerated
    // list, never as a broken assertion.
    // ⚠️ **`Materials` did NOT move and that is MEASURED, not assumed: re-derived from its own rule
    // (`overlay.material.preset` set and not `'None'`) it came out at 88, identical to the shipped array
    // INCLUDING ORDER, so the array was left untouched rather than re-emitted.** None of the five deleted
    // demos carried a material, and none of the eleven new or replaced bodies does either.
    // ⚠️ **`Fire & Plasma` is CURATED and was not touched.**
    // ⚠️⚠️ **THE DELETIONS COST NO KEY ITS LAST CARRIER, AND THAT WAS MEASURED BEFORE THEY WERE MADE:
    // the five bodies were the ONLY carriers of thirteen Phase 34 keys** (`travelY`, `travelDepth/RateY`,
    // `travelDepth/RateZ`, `growDepthX/Y/Z`, `growRateX/Y/Z`, `sharpnessDepth`, `sharpnessRate`) — **and
    // the owner's own finetuned exports re-home all thirteen**: `Multiple Faceted Core` takes the six grow
    // depth/rate keys and `Pipes Sweep Breath` the five travel keys plus the two sharpness ones. Without
    // that coincidence the deletions would have returned `mixercheck` §O to passing VACUOUSLY over them.
    // ⚠️ **REGENERATED 2026-10-30 at 339** (was 333) when the SIX zero-carrier demos joined — `35.7`'s
    // three orientation-angle demos (`Warp Oblique Ridge`, `Warp Chevron Score`, `Warp Zoom Oblique`) and
    // `34.5`'s three (`Quader Deep Orbit`, `Pipes Sweep Breath`, `Quader Flare Broadside`), all `atEnd`.
    // ⚠️ **`reelcheck` is what demanded it, before anything else ran**: *"6 missing"*, plus the companion
    // CALIBRATION FAIL on the coverage-only seed. Read a red here as an un-regenerated list, never as a
    // broken assertion.
    // ⚠️ **`Materials` did NOT move and that is MEASURED rather than assumed: re-derived from its own rule
    // (`overlay.material.preset` set and not `'None'`) it came out at 88, identical to the shipped array
    // INCLUDING ORDER, so the array was left untouched rather than re-emitted.** Three of the six host on
    // `Cylinder`'s demo figure and three on `Quader`/`Pipes` refined bodies; none carries a material.
    // ⚠️ **`Fire & Plasma` is CURATED and was not touched** — it is 7 owner-picked names and must never be
    // regenerated.
    // ⚠️ **REGENERATED 2026-10-29 at 333** (was 325) when `35.6`'s EIGHT warp-shape demos joined —
    // `Warp Square Mosaic`, `Warp Sawtooth Blade`, `Warp Shape Dimmer`, `Warp Trapezoid Ribbon`,
    // `Warp Triangle Weave`, `Warp Split Shapes`, `Warp Torn Zoom` and `Warp Ridge Blades`, all `atEnd`.
    // ⚠️ **`reelcheck` is what demanded it, before anything else ran**: *"8 missing"*. Read a red here as
    // an un-regenerated list, never as a broken assertion.
    // ⚠️ **`Materials` did NOT move and that is MEASURED rather than assumed: re-derived from its own rule
    // (`overlay.material.preset` set and not `'None'`) it came out at 88 BYTE-IDENTICAL, so the array was
    // left untouched rather than re-emitted.** All eight demos host on `Cylinder`'s figure and none
    // carries a material — the same reason `34.6`'s eleven and `31.6`'s two did not move it.
    // ⚠️⚠️ **TWO DATES READ 2026-10-29 AND THEY ARE THREE EVENTS, NOT ONE: 314 → 325 (`34.6`) → 333
    // (`35.6`).** Read the figures by the step that moved them, never as a net change.
    // ⚠️ **REGENERATED 2026-10-29 at 325** (was 314) when `34.6`'s eleven demos joined — `Quader Orbit
    // Wreath`, `Pipes Gear Crown`, `Cylinder Drift Nebula`, `Quader Square Spring`, `Cylinder Breathing
    // Helix`, `Pipes Conical Vortex`, `Pipes Taper Comet`, `Quader Flare Pulse`, `Cylinder Crystal
    // Breath`, `Multiple Faceted Core` and `Multiple Scale Ladder`, all `atEnd`. ⚠️ **`reelcheck` is what
    // demanded it, before anything else ran**: *"11 missing"*, plus the companion CALIBRATION FAIL on the
    // coverage-only seed. Read a red here as an un-regenerated list, never as a broken assertion.
    // ⚠️ **`Materials` did NOT move and that is a measured fact rather than an oversight: its rule selects
    // `overlay.material.preset` set and not `'None'`, and none of the eleven carries a material** — the
    // four hosts (`Quader`, `Cylinder`, `Pipes`, `Multiple`) all ship without one. Re-measured at **88**,
    // identical before and after. ⚠️ **Its own header comment still says `GENERATED (86)` and that figure
    // is STALE and PRE-EXISTING** — the array has held 88 since `33.x`; left alone rather than repaired
    // here, because a figure in a comment is not an index entry and the array is the thing to count.
    // ⚠️⚠️ **REGENERATED 2026-10-26 at 294** — it was 295 for part of the same sitting, because
    // `Pipes Blur Warp` joined with `E127` and left again when the owner cut the blur sources on visual
    // review. ⚠️ **A net figure conceals a repair: read 293 → 295 → 294 as three events, not one.**
    // ⚠️ **REGENERATED 2026-10-26 at 295** (was 293) when Phase 32's three demos joined — `Pipes
    // Taper`, `Pipes Bend` and `Pipes Blur Warp`, all `atEnd`. ⚠️ **`reelcheck` is what demanded it,
    // before anything else ran**: *"3 missing"*. Read a red here as an un-regenerated list, never as
    // a broken assertion. ⚠️ **`Materials` did NOT move, and that is a fact rather than an oversight:
    // all three host on `Pipes`, which carries no material**, so the rule generating that reel does
    // not select them — the same reason `31.6`'s `Quader` demos did not move it.
    // ⚠️ **REGENERATED 2026-10-25 at 293**, and the figure moved THREE times in one sitting: 294 when
    // the `E131` demo joined, 292 when the owner's visual review dropped `E121` and `E131` with their
    // two demos, and 293 when `Pipes Spread` was added for the per-particle channels. ⚠️ **A net figure
    // conceals a repair — read it as the state after the review, not as one addition.** ⚠️ **The same
    // sitting moved all derived demos to the END of the library (`atEnd`, owner instruction), which
    // REORDERS this generated list without changing its membership — `reelcheck` compares it as a SET
    // in both directions, so a pure reorder goes green either way and only a regeneration keeps the
    // list honest about library ORDER.**
    // ⚠️ **REGENERATED 2026-10-23 at 293** (was 291) when `31.6`'s two demos joined — `Quader Plate` and
    // `Quader Hyperspin`, both inserted after `Quader` in library order. ⚠️ **`reelcheck` is what demanded
    // it, before anything else ran**: *"2 missing (Quader Plate, Quader Hyperspin)"*. Read a red here as
    // an un-regenerated list, never as a broken assertion. ⚠️ **`Materials` did NOT move and that is a
    // fact rather than an oversight: both demos host on `Quader`, which carries no material**, so its
    // `overlay.material.preset` is absent and the rule that generates that reel does not select them.
    // ⚠️ **REGENERATED 2026-10-19 at 283** (was 282) when the owner replaced `Dye Index Bands` with
    // their own export and added `Holi Festival`; the 282 before that was `Dye Index Bands` joining. (was 281) when `Dye Index Bands` joined the demo cohort as
    // `28.18`'s carrier — and ⚠️ **the checker demanded it again**: `reelcheck` went red with
    // *"1 missing (Dye Index Bands)"* before anything else ran. **Read a red here as an
    // un-regenerated list, never as a broken assertion.**
    // ⚠️ **REGENERATED 2026-10-16 at 281** (was 280) when `Dye Palette Wake` joined the demo cohort — and
    // ⚠️ **the checker is what demanded it, not a memory of this rule**: adding the preset turned
    // `reelcheck` red with *"1 missing (Dye Palette Wake)"* before anything else was run. **That is the
    // clause working exactly as the paragraph below describes, so read a red here as an un-regenerated list
    // rather than as a broken assertion.**
    // ⚠️ **REGENERATED 2026-10-10 at 280** (was 277) when the owner added `Mosaic in Glass`,
    // `Through a Lense` and `Vortex Dances`; the 277 before that was `Dancing Rays II`,
    // `Flying Zebras` and `Reflections in the Water`. `reelcheck` asserts this reel EQUALS the library
    // as a set in BOTH directions, so a preset added to a group and not to this list goes red at the
    // next `verify` — which is the only thing keeping a generated list honest. **Never relax that
    // clause to make an addition pass; regenerate instead.** Order is deliberately NOT asserted
    // (library order is an insertion artefact and this reel plays `random`), but it is kept in
    // library order anyway so a diff of this block reads as an append rather than a reshuffle.
    presets: [
      'Aliens DNA',
      'Alpha Particles',
      'Andromeda',
      'Anima Electrica',
      'Argus',
      'Asymetry',
      'Aurora Borealis II',
      'Aurora Borealis',
      'Barrock',
      'Behind A Glass Window',
      'Bermuda Twister',
      'Birds Flying',
      'Birth Of Venus',
      'Black Electricity',
      'Black Hole',
      'Blue Planes',
      'Blue Spiralo',
      'Blue',
      'Borg Cube',
      'Bors dream',
      'Breaking Through',
      'Burn Burn Burn',
      'Chemical',
      'Complex Or Simple Mind',
      'Core',
      'Cosmo Flower',
      'Cosmos Energy',
      'Crystal Reflections',
      'Curtains Falling',
      'Cycloid',
      'Cycloid II',
      'Cylinder',
      'Dancing Elphes',
      'Dancing Rays',
      'Deep Thought',
      'Deep Thought2',
      'Diffusion',
      'Disco Terror',
      'Disolve',
      'Distortion',
      'Dream Flash',
      'Dual Spiral Wind',
      'Dual Spiral Wind II',
      'Dual System',
      'Entropy',
      'Entropy on Fire',
      'Eternal Fire',
      'Faked Thwister',
      'Fire Band',
      'Fire Storm',
      'Fire Wire',
      'First Contact',
      'Flame',
      'Flare',
      'Flight Into Energy',
      'Flight Through Milky Way',
      'Flower Power',
      'Flower Power II',
      'Fluid Metall 2',
      'Fluid Metall',
      'Fluid',
      'Fluid II',
      'Fogs Of Another World',
      'Four',
      'Fractal',
      'Liquid Fractal',
      'Galaxy',
      'Galaxy2',
      'Ghosts',
      'Gold Fire',
      'Gold Rush',
      'Hades On Fire',
      'Hades on Fire II',
      'Hell Razer',
      'Hell Razer II',
      'High Frequency',
      'High Frequency II',
      'Hypno Penta',
      'Hypno Penta II',
      'Hypnosis',
      'Hypnosis II',
      'I Am The Voice Of Energy',
      'Inside Athlon',
      'Inside Nebula',
      'Inside Nebula II',
      'Interference',
      'Intro System',
      'Jupiter Spot',
      'Kaleido Star',
      'Kaleidoscope',
      'Kissing Deeply',
      'Lava',
      'Dye Holi Festival',
      'Dye Sunset',
      'Boiling Milk',
      'Lightening',
      'Living Blue',
      'Lonely Particle',
      'Look Into My Eye',
      'Looking For Rainbows',
      'Lost In Another Sky',
      'Lost In Another Sky II',
      'Magic Square',
      'Magnetic Fields',
      'Mandala Tri',
      'Liquid Mandala',
      'Mandelbrot Simulation',
      'Mandelbrot River',
      'Meditation',
      'Metalic Electricity',
      'Metaphysical Transformation',
      'Metaphysics',
      'Milky Way',
      'Millenium Falcon',
      'Mind Sight',
      'Miracle',
      'Birth of a Black Hole',
      'Mirrors In Mirror',
      'Modern Art II',
      'Modern Art III',
      'Modern Art',
      'Moebius Paranoia',
      'Mondrian Melting',
      'Montezuma Looks at You',
      'Multi Threads II',
      'Multi Mixer',
      'Multi Threads',
      'Multidimensional Rings',
      'Multiple',
      'NCC1701 Warp Core Plasma',
      'Neutrino Storm',
      'Nexus',
      'Nirwana',
      'Nova2',
      'Ocean Of Experience',
      'Particle Swarm II',
      'Aizawa Particle Swarm',
      'Particle Swarm',
      'Patterns',
      'Penta Spirals',
      'Rubber Penta Spirals',
      'Penta Star System',
      'Penta Star Eternal Flow',
      'Penta',
      'Phantasy Spiral',
      'Pipes',
      'Pipes Art',
      'Plasma Power',
      'Plasma',
      'Projection',
      'Protuberance',
      'Pulse Color',
      'Quader',
      'Dancing Quader',
      'Quantum Mathematic',
      'Quasar',
      'Radar',
      'Reaction',
      'Ripple Spiral',
      'Rippled Rays Of Light 2',
      'Rippled Rays Of Light 3',
      'Rippled Rays Of Light',
      'Rose',
      'Rotating Band',
      'Scanner',
      'Shades Of Waves',
      'Shapes Of Infinity',
      'Shell',
      'Solar Fusion',
      'Solar Fusion II',
      'Space The Final Frontier',
      'Sphere',
      'Sphere II',
      'Spiritual',
      'Stairway To Heaven',
      'Star Dust',
      'Star',
      'Storm',
      'Streams In Space',
      'Stripes',
      'Subspace',
      'Symbol Of Infinity Transformed',
      'Symbol Of Infinity',
      'Synapsis',
      'The Masters Light',
      'The Masters Light II',
      'The Real Black Hole',
      'The Real Super Man',
      'The Secret Of The Pyramid',
      'There Will Be Light',
      'Time Vortex II',
      'Time Vortex',
      'Transmission',
      'Transmission II',
      'Transporter Beam',
      'Tunnels or Not',
      'Unfiy The Force',
      'Vertical Attraction',
      'Video Tape Error',
      'Vivianes Harp',
      'Voyager',
      'Warp',
      'Warp2',
      'Water Ice Crystal',
      'Waves',
      'Waves II',
      'Who Needs A Fractal',
      'Who Needs A Fractal II',
      'Wormhole',
      'Lissajous Flame',
      'Attractor Fire Cloud',
      'Julia Burn Rivers',
      'Hopf Fire Ring',
      'Ember Storm',
      'Rising Inferno',
      'Smoke Cathedral',
      'Firestorm',
      'Lava Flow',
      'Imploding Sun',
      'Spectrum Bloom',
      'Miracle Frost',
      'Fire and Ice',
      'Fluid Cosmos',
      'Refraction Bloom',
      'Band Split Crawl',
      'Shift Lattice Drift',
      'Axis Zoom Breathe',
      'Radial Zoom Overlay',
      'Shear Zoom Combined',
      'Kaleido Fractal Feedback',
      'Procedural Flow Drift',
      'Fluid Feedback Bloom',
      'Chain Warp Refract',
      'Chain Flow Split',
      'Chain Zoom Fractal',
      'Material Plasma',
      'Material Fire',
      'Material Ember',
      'Material Smoke',
      'Material Fog',
      'Material Ice',
      'Material Liquid Light',
      'Material Organic',
      'Liquid Surface',
      'Liquid Field Pool',
      'Liquid Cohesion Beads',
      'Dye Wake',
      'Dye Palette Wake',
      'Pigment Sheet',
      'Physarum Flower',
      'Physarum Weave',
      'Liquid Field Clouds',
      'Liquid Field Fill',
      'Fixed Dye Plume',
      'Breathing Dye',
      'Advection Carry',
      'Age Gate Embers',
      'Temperature Gate Frost',
      'Depth Gate Veil',
      'Mirror Fold Rosette',
      'Fire Smoke Crossover',
      'Time Warp Lattice',
      'Time Warp Smear',
      'Parallax Depth Shell',
      'Vortex Offset Drag',
      'Chain Triple Cascade',
      'Warp First Silhouette',
      'Inverse Refraction Pinch',
      'Clifford Fern Veil',
      'Lorenz Twin Lobes',
      'Aizawa Torus Shell',
      'Julia Siegel Disk River',
      'Mandelbrot Zoom',
      'Pixel Line Art',
      'Pixel Age Palette',
      'Volume Depth Haze',
      'Hexagon Crystal Bloom',
      'Curl Noise Braid',
      'Dancing Rays II',
      'Flying Zebras',
      'Reflections in the Water',
      'Mosaic in Glass',
      'Through a Lense',
      'Vortex Dances',
      'Pipes Twist',
      'Cylinder Conformal',
      'Pipes Timescan',
      'Pipes Wound Chambers',
      'Pipes Droste',
      'Quader Hyperspin',
      'Quader Faceted',
      'Cylinder Chamfered',
      'Blue Planes Helix',
      'Water Ice Crystal Spire',
      'Quader Torus Knot',
      'Pipes Toric Lissajous',
      'Cylinder Viviani',
      'Quader Granny',
      'Cylinder Spherical Spiral',
      'Black Hole Relief',
      'Mandelbrot Seahorse Bands',
      'Mandelbrot River Glow',
      'Quader Star Eight',
      'Quader Star Twelve',
      'Pipes Star Twenty',
      'Quader Orbit Wreath',
      'Quader Square Spring',
      'Pipes Conical Vortex',
      'Pipes Taper Comet',
      'Multiple Faceted Core',
      'Warp Square Mosaic',
      'Warp Sawtooth Blade',
      'Warp Shape Dimmer',
      'Warp Triangle Weave',
      'Warp Ridge Blades',
      'Warp Chevron Score',
      'Quader Deep Orbit',
      'Pipes Sweep Breath',
      'Square Mosaic',
      'Cylinder Kaleidoskope',
      'Fluid Viviani',
      'Pipes Taper Bend Spread',
      'Curve Lattice',
      'Curve Descent',
      'Curve Gasket',
      'Curve Island',
      'Curve Thicket',
      'Curve Volume',
      'Curve Tilt',
      'Curve Subdivide',
      'Curve Morph',
      'Curve Weave',
      'Curve Triad',
      'Curve Dragonfold',
      'Curve Plane Dive',
      'Curve Fold',
      'Curve Fold A',
      'Curve Scroll',
      'Curve Koch Cesaro',
      'Curve Minkowski',
      'Curve Breathing Thicket',
      'Curve Spiral Thicket',
      'Curve Peano Descent',
      'Curve Hilbert Opening',
      'Curve Peano Fold',
      'Quader Discharge',
      'Curve Weave Lightning',
      'Curve Fold Discharge',
      'Curve Rosette Chain',
      'Liquid Maze',
      'Subdivide Sphere',
      'Morph Wreath',
      'Thicket Globe',
      'Breathing Crown',
      'Cesaro Cube',
      'Hilbert Tetra',
      'Tilt Octahedron',
      'Chaos to Order',
      'Growing Corals',
      'Fractal Cross',
      'Fractal Butterfly',
      'Fractal Star',
      'Fractal Lattice',
      'Curve Snowflake',
      'Curve Pentigree',
      'Curve Twindragon',
      'Curve Fudgeflake',
      'Curve Golden Dragon',
      'Curve Golden Lightning',
      'Curve Zigzag Cross',
      'Lorenz Strand',
      'Nosé-Hoover Fan',
      'Halvorsen Thread',
      'Aizawa Overwound',
      'Lorenz Strand Morph',
      'Jagged Glass',
      'Skin of a Snake',
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
  {
    name: 'Geometry',
    // GENERATED (26) — "plain geometric figures, no materials and no fancy transmaps".
    // Rule: tagged `geo`, plus the two plainly geometric presets the tagging pass never reached
    // (`Blue Planes`, `Shell` — 74 of the 274 carry no tags at all, so the tag cannot be the whole rule);
    // then MINUS anything with a material, a transmap chain, or an image-re-imaging style (4 Fractal
    // Feedback, 5 Procedural Flow, 6 Fluid Feedback, 7 Density Refraction, 10 Vortex — styles 0-3 stay,
    // being the separable shift/zoom field, which nudges the figure rather than replacing it).
    // ⚠️ The material exclusion is the owner's own criterion and it DROPPED `Borg Cube`, a member of the
    // retired hand-picked list, because it carries the Ember material. It is in `Materials` instead.
    presets: [
      'Blue Planes', 'Blue Spiralo', 'Cycloid', 'Cycloid II', 'Cylinder', 'Fractal', 'Liquid Fractal',
      'Kaleidoscope', 'Magic Square', 'Mandala Tri', 'Mandelbrot Simulation', 'Mirrors In Mirror',
      'Moebius Paranoia', 'Multi Threads', 'Multidimensional Rings', 'Patterns', 'Penta Spirals', 'Penta',
      'Phantasy Spiral', 'Pipes', 'Pipes Art', 'Quader', 'Rotating Band', 'Shell', 'Sphere', 'Stripes',
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
  {
    name: 'Materials',
    // GENERATED (93) — "all presets using materials". Rule: `overlay.material.preset` is set and is not
    // `'None'` (invariant 18: a material's inactive state is the STRING `'None'`, not absence).
    presets: [
      "Anima Electrica",
      "Aurora Borealis",
      "Behind A Glass Window",
      "Bermuda Twister",
      "Black Electricity",
      "Borg Cube",
      "Breaking Through",
      "Burn Burn Burn",
      "Cosmos Energy",
      "Curtains Falling",
      "Dream Flash",
      "Entropy on Fire",
      "Eternal Fire",
      "Fire Band",
      "Fire Storm",
      "Fire Wire",
      "Flame",
      "Flight Into Energy",
      "Flower Power",
      "Flower Power II",
      "Fluid Metall",
      "Fogs Of Another World",
      "Ghosts",
      "Gold Rush",
      "Hades on Fire II",
      "Hell Razer II",
      "High Frequency II",
      "Hypno Penta",
      "Hypnosis II",
      "I Am The Voice Of Energy",
      "Inside Athlon",
      "Inside Nebula II",
      "Interference",
      "Lava",
      "Dye Holi Festival",
      "Dye Sunset",
      "Boiling Milk",
      "Lightening",
      "Liquid Mandala",
      "NCC1701 Warp Core Plasma",
      "Neutrino Storm",
      "Nova2",
      "Ocean Of Experience",
      "Rubber Penta Spirals",
      "Plasma Power",
      "Plasma",
      "Protuberance",
      "Pulse Color",
      "Quantum Mathematic",
      "Quasar",
      "Ripple Spiral",
      "Rippled Rays Of Light 3",
      "Solar Fusion",
      "Solar Fusion II",
      "Synapsis",
      "There Will Be Light",
      "Unfiy The Force",
      "Vivianes Harp",
      "Water Ice Crystal",
      "Waves II",
      "Who Needs A Fractal II",
      "Lissajous Flame",
      "Attractor Fire Cloud",
      "Julia Burn Rivers",
      "Hopf Fire Ring",
      "Ember Storm",
      "Rising Inferno",
      "Smoke Cathedral",
      "Firestorm",
      "Lava Flow",
      "Imploding Sun",
      "Spectrum Bloom",
      "Miracle Frost",
      "Fire and Ice",
      "Material Plasma",
      "Material Fire",
      "Material Ember",
      "Material Smoke",
      "Material Fog",
      "Material Ice",
      "Material Liquid Light",
      "Material Organic",
      "Age Gate Embers",
      "Temperature Gate Frost",
      "Fire Smoke Crossover",
      "Hexagon Crystal Bloom",
      "Water Ice Crystal Spire",
      "Quader Torus Knot",
      "Quader Star Twelve",
      "Curve Fold Discharge",
      "Liquid Maze",
      "Fractal Cross",
      "Jagged Glass",
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
  {
    name: 'Fire & Plasma',
    /*
     * ⚠️ **CURATED BY THE OWNER — the ONE reel here that is not generated, and the one that must not be
     * regenerated.** Adopted verbatim from the owner's own `Export Reels` file
     * (`psss_reels_20260924_081407.json`, 2026-09-24) with the instruction *"only use the reels in that import
     * file and make those the official reel list which is included in the production build version"*.
     *
     * ⚠️ **It is the RETIRED hand-picked reel, back, minus one member.** The same seven names in the same order
     * as the pre-2026-09-24 built-in, at the same `sequential`/18 s/`fade`, with `Protuberance` dropped — so the
     * owner did not accept the generated 68-preset classifier output for this theme and edited the curated list
     * instead. **Read that as a VERDICT on the classifier, not as a stale file:** a hot-material predicate over
     * the whole library is correct and unwatchable, because "everything with the Fire material" is 68 presets of
     * which most are not about fire, and a showcase reel is a curation problem. The generated rule is kept
     * below so the difference is legible, not so it can be re-run.
     *
     * ⚠️ **`sequential`/18 s/`fade` is deliberate and is the exception to the array's one-mode rule.** Seven
     * hand-ordered high-accumulation presets are exactly the population a frozen-trail cross-fade was designed
     * for — the reason `Grand Tour` had to leave `fade` (a double image on `Cylinder`, `Quader`, `Pipes`) does
     * not reach a list with none of those in it — and `sequential` is what makes a hand-picked ORDER mean
     * anything. `reelcheck` §J asserts these three values verbatim rather than a uniform rule.
     *
     * THE RETIRED GENERATED RULE, for the record (68 presets): material ∈ {Fire, Plasma, Ember} (the CORE), OR
     * — only where no cool core contradicts it — a hot palette ∈ {Neon, Cycle: Embers, Cycle: Solar, Sunset,
     * Fire, Classic: ember, Classic: thermal, Classic: cyberpunk} or the tag `fire`/`plasma` (the SKIN).
     * ⚠️ **NOT `material.colourRamp`**, and this trap outlives the rule that met it: the Plasma material ships
     * ramp `'liquid'`, so the 40 `liquid` ramps are Plasma 26 + LiquidLight 10 + Liquid 5, and reading the ramp
     * put every plasma preset in BOTH this reel and `Water and Ice`. The ramp carries no information the
     * material does not — the next reader to classify by colour will reach for it again.
     */
    presets: [
      'Eternal Fire', 'Fire Storm', 'Gold Fire', 'Hades On Fire', 'Lava', 'Plasma Power',
      'Solar Fusion',
    ],
    playMode: 'sequential',
    playSeconds: 18,
    transition: 'fade',
  },
  {
    name: 'Water and Ice',
    // GENERATED (53) — "Ice and / or Crystals or the cool color palettes".
    // Rule: material ∈ {Ice, Liquid, LiquidLight} or `crystal.enabled` (the CORE), OR — only where no hot
    // core or hot skin contradicts it — a cool palette ∈ {Cycle: Deep Blue, Cycle: Azure, Cycle: Indigo,
    // Cycle: Storm, Aurora, Classic: aurora, Material: liquid}, any of the liquid/dye field subsystems
    // (`liquid`, `liquidField`, `dye`), or the tag `water`/`ice`/`crystal`/`aurora`/`liquid`.
    // The palettes are ENUMERATED rather than pattern-matched: the library carries 19 distinct names, and a
    // loose pattern matched `Cycle: Deep Blue` for "deep" and `Neon` for the other side.
    presets: [
      'Aurora Borealis II', 'Aurora Borealis', 'Barrock', 'Behind A Glass Window', 'Bermuda Twister',
      'Dancing Rays', 'Faked Thwister', 'Fluid Metall', 'Hypno Penta', 'Hypnosis II', 'Inside Nebula II',
      'Liquid Mandala', 'Miracle', 'Birth of a Black Hole', 'Montezuma Looks at You', 'Multi Mixer',
      'Ocean Of Experience', 'Rubber Penta Spirals', 'Pipes Art', 'Ripple Spiral',
      'Rippled Rays Of Light 3', 'Solar Fusion II', 'Spiritual', 'Symbol Of Infinity',
      'The Masters Light II', 'The Real Black Hole', 'The Real Super Man', 'Unfiy The Force',
      'Vivianes Harp', 'Water Ice Crystal', 'Waves II', 'Who Needs A Fractal II', 'Lava Flow',
      'Spectrum Bloom', 'Miracle Frost', 'Fire and Ice', 'Kaleido Fractal Feedback', 'Material Ice',
      'Material Liquid Light', 'Material Organic', 'Liquid Surface', 'Liquid Field Pool',
      'Liquid Cohesion Beads', 'Dye Wake', 'Pigment Sheet', 'Liquid Field Clouds', 'Liquid Field Fill',
      'Fixed Dye Plume', 'Temperature Gate Frost', 'Depth Gate Veil', 'Lorenz Twin Lobes',
      'Hexagon Crystal Bloom', 'Curl Noise Braid',
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
  {
    name: '2D',
    // GENERATED (79) — "only using X/Y and no Z depth, or transmaps which create a 2D image only".
    // Rule: the wave has NO Z reach at all (every wave's axis[2] has zero am/fm base AND amplitude) AND
    // `generators.rotation` has no X or Y component — OR an image-re-imaging transmap style is active
    // (4, 5, 6, 7, 10, in the single style or anywhere in the chain), which replaces the frame with a
    // picture of itself regardless of what the figure was doing in Z.
    // ⚠️ Styles 8 Time Warp, 9 Band Split and 11 Depth Parallax are deliberately NOT here: 8 and 9 are
    // weightless modifiers that do not re-image, and 11 is a DEPTH effect, so it belongs to `3D`.
    // ⚠️ `2D` and `3D` are disjoint by construction — `3D` subtracts this list.
    presets: [
      'Alpha Particles', 'Anima Electrica', 'Asymetry', 'Barrock', 'Bermuda Twister', 'Birth Of Venus',
      'Blue Planes', 'Blue', 'Cosmo Flower', 'Cosmos Energy', 'Curtains Falling', 'Dual Spiral Wind II',
      'Fluid Metall 2', 'Fluid', 'Fluid II', 'Four', 'Galaxy2', 'High Frequency', 'High Frequency II',
      'Hypno Penta', 'Hypno Penta II', 'Hypnosis', 'Hypnosis II', 'I Am The Voice Of Energy',
      'Looking For Rainbows', 'Lost In Another Sky II', 'Mandelbrot River', 'Metaphysical Transformation',
      'Miracle', 'Birth of a Black Hole', 'Modern Art III', 'Montezuma Looks at You', 'Neutrino Storm',
      'Nexus', 'Nova2', 'Penta Star Eternal Flow', 'Dancing Quader', 'Rippled Rays Of Light 3',
      'Streams In Space', 'Symbol Of Infinity Transformed', 'Symbol Of Infinity', 'There Will Be Light',
      'Transmission II', 'Vivianes Harp', 'Water Ice Crystal', 'Hopf Fire Ring', 'Rising Inferno',
      'Smoke Cathedral', 'Firestorm', 'Lava Flow', 'Imploding Sun', 'Miracle Frost', 'Fluid Cosmos',
      'Refraction Bloom', 'Band Split Crawl', 'Kaleido Fractal Feedback', 'Procedural Flow Drift',
      'Fluid Feedback Bloom', 'Chain Warp Refract', 'Chain Flow Split', 'Chain Zoom Fractal',
      'Material Plasma', 'Material Fire', 'Material Ember', 'Material Smoke', 'Material Fog',
      'Material Ice', 'Material Liquid Light', 'Pigment Sheet', 'Physarum Weave', 'Age Gate Embers',
      'Temperature Gate Frost', 'Fire Smoke Crossover', 'Time Warp Smear', 'Vortex Offset Drag',
      'Chain Triple Cascade', 'Inverse Refraction Pinch', 'Hexagon Crystal Bloom', 'Curl Noise Braid',
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
  {
    name: '3D',
    // GENERATED (69) — "presets which are showing real 3D moving figures".
    // Rule: the wave HAS Z reach (nonzero am/fm on axis[2]) AND `generators.rotation` turns about X or Y,
    // minus everything in `2D`. ⚠️ The TUMBLE is the discriminator, not the Z reach: a figure with depth but
    // viewed head-on with no X/Y rotation reads flat, which is why the 60 presets in neither reel are mostly
    // "has Z, does not turn". Z about the view axis (`rotation[2]`) is a spin in the picture plane and does
    // not qualify. Nothing here is a measurement of the RENDERED depth — `volumeRender` and `liquid`
    // occlusion are not read.
    presets: [
      'Aurora Borealis II', 'Aurora Borealis', 'Bors dream', 'Breaking Through', 'Cylinder', 'Dancing Rays',
      'Diffusion', 'Disolve', 'Dream Flash', 'Fire Storm', 'Fire Wire', 'Flame', 'Flight Into Energy',
      'Galaxy', 'Gold Rush', 'Interference', 'Intro System', 'Kissing Deeply', 'Lava', 'Boiling Milk',
      'Look Into My Eye', 'Lost In Another Sky', 'Magic Square', 'Mandelbrot Simulation', 'Meditation',
      'Metalic Electricity', 'Modern Art II', 'Moebius Paranoia', 'Multidimensional Rings', 'Multiple',
      'Particle Swarm II', 'Aizawa Particle Swarm', 'Particle Swarm', 'Plasma Power', 'Plasma',
      'Projection', 'Quader', 'Quasar', 'Reaction', 'Ripple Spiral', 'Rotating Band', 'Scanner',
      'Shades Of Waves', 'Solar Fusion', 'Solar Fusion II', 'Sphere', 'Sphere II', 'Stairway To Heaven',
      'Storm', 'Stripes', 'The Secret Of The Pyramid', 'Time Vortex', 'Transmission', 'Vertical Attraction',
      'Video Tape Error', 'Lissajous Flame', 'Attractor Fire Cloud', 'Julia Burn Rivers', 'Ember Storm',
      'Spectrum Bloom', 'Fire and Ice', 'Shift Lattice Drift', 'Radial Zoom Overlay', 'Liquid Surface',
      'Liquid Field Pool', 'Parallax Depth Shell', 'Clifford Fern Veil', 'Lorenz Twin Lobes',
      'Volume Depth Haze',
    ],
    playMode: 'random',
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: 'black',
  },
];

/** The main reel when nothing has ever chosen one. First built-in, by name — not by index at read time. */
const DEFAULT_MAIN_REEL_NAME = 'Grand Tour';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Persistence — a port, because `localStorage` is not always there and not always writable
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **`psss.reels.v1` — the version is in the KEY as well as in the payload**, which is not redundant. The
 * payload version lets a future build migrate; the key version lets it decline to, by simply not reading the
 * old key. Without the key version, a schema change that cannot be migrated has no way to start clean
 * without also destroying the evidence of what went wrong.
 */
export const REEL_STORAGE_KEY = 'psss.reels.v1';

export interface ReelPersistence {
  read(): string | null;
  write(text: string): void;
  clear(): void;
}

/**
 * A `localStorage`-backed port, or `null` if this document cannot use `localStorage` at all.
 *
 * ⚠️ **The probe writes and deletes a sentinel; a `typeof localStorage` test is not enough.** In Safari's
 * private mode and under a blocked-third-party-storage policy the OBJECT exists and `getItem` works while
 * `setItem` throws, so a presence test hands back a port whose every write fails — and the failure surfaces
 * as "my reels vanish when I reload", one session later, with nothing in the console.
 *
 * ⚠️ **Merely READING `globalThis.localStorage` can throw** (a `SecurityError` in a sandboxed iframe), which
 * is why the access itself is inside the `try` rather than guarded by a `typeof` in front of it.
 */
export function createLocalStoragePersistence(key: string = REEL_STORAGE_KEY): ReelPersistence | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${key}.probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      read: () => ls.getItem(key),
      write: (text: string) => ls.setItem(key, text),
      clear: () => ls.removeItem(key),
    };
  } catch {
    return null;
  }
}

/** Where a reel in the merged view came from. Drives what Delete is allowed to do, and the origin badge. */
export type ReelOrigin = 'builtin' | 'deployment' | 'user';

export interface ReelImportResult {
  added: number;
  renamed: number;
  rejected: number;
  mainReelChanged: boolean;
}

export interface ReelStoreStatus {
  /** False when reels live for this page load only — the UI says so rather than lying about saving. */
  persistent: boolean;
  /** Entries the last read could not make a reel out of. Reported once, at construction. */
  rejected: number;
  /** True once a write has failed (quota, or storage revoked mid-session). Latches. */
  writeFailed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The store
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export class ReelStore {
  /** The user's own reels, insertion-ordered. A re-save keeps a reel's position (`Map.set` on a live key). */
  private readonly userReels = new Map<string, Reel>();
  /** Reels shipped with the deployment — `psss_reels.json`, or the legacy `__reels` key. ONE field, one source. */
  private deploymentReels: Reel[] = [];
  /**
   * The main reel the DEPLOYMENT asks for, below the user's own choice and above the built-in default.
   *
   * ⚠️ **A deployment must be able to say which reel autostarts, and this is the only field that can carry
   * it.** Before 19.11 the deployment layer was an array with nowhere to put that answer, so a kiosk build
   * that wanted anything other than `Grand Tour` first had to edit `DEFAULT_MAIN_REEL_NAME` in the source —
   * i.e. it needed a code change to express a deployment choice. It is deliberately NOT written to
   * `localStorage`: persisting it would freeze the deployment's answer at whatever the first run saw, which is
   * property 1 of this file's header, applied to the main reel instead of to a reel's contents.
   */
  private deploymentMainName: string | null = null;
  private storedMainName: string | null = null;
  private readonly listeners: ((store: ReelStore) => void)[] = [];
  /** ⚠️ Not `status` — the accessor below owns that name, and a field of the same name is a duplicate-identifier error. */
  private readonly storeStatus: ReelStoreStatus;

  /** Injected, never constructed here — see the constructor. */
  private readonly persistence: ReelPersistence | null;

  /**
   * ⚠️ **`persistence` is injected, not constructed here**, so `reelcheck` can drive the whole store over an
   * in-memory port under Node. `null` means "this session only" and is a supported state, not an error —
   * `status().persistent` is how the UI tells the user, instead of a save silently not lasting.
   *
   * ⚠️ **The field above is declared explicitly on purpose: a constructor PARAMETER PROPERTY here breaks
   * `npm run build` while leaving `tsc` and `verify` green.** `scripts/export-library.mjs` imports this
   * module under Node's strip-only TypeScript mode, which rejects the syntax at parse time. The full
   * write-up is on `ReelCursor` in `exploration/reel-model.ts`, which is bound by the same rule.
   */
  constructor(persistence: ReelPersistence | null = null) {
    this.persistence = persistence;
    this.storeStatus = { persistent: persistence !== null, rejected: 0, writeFailed: false };
    this.load();
  }

  // ── reading ────────────────────────────────────────────────────────────────────────────────────────

  /**
   * The merged view, in a deliberately stable order: the base layers in declaration order (deployment
   * shadowing built-in), then the user's own reels in creation order.
   *
   * ⚠️ **Recomputed per call, never cached.** The dropdown, the strip, the runner and the exporter all read
   * this, and a cache would need invalidating from five mutators — the fifth being the one that gets
   * forgotten. The list is at most a few dozen entries; there is nothing here worth a stale read.
   */
  list(): Reel[] {
    const out: Reel[] = [];
    const seen = new Set<string>();
    const base: Reel[] = [...BUILT_IN_REELS, ...this.deploymentReels];
    for (const reel of base) {
      const key = reel.name.trim().toLowerCase();
      if (seen.has(key)) {
        // A deployment reel shadowing a built-in one: replace in place, keeping the built-in's position.
        const at = out.findIndex((r) => sameReelName(r.name, reel.name));
        if (at >= 0) out[at] = reel;
        continue;
      }
      seen.add(key);
      out.push(reel);
    }
    for (const reel of this.userReels.values()) {
      const at = out.findIndex((r) => sameReelName(r.name, reel.name));
      if (at >= 0) out[at] = reel;
      else out.push(reel);
    }
    return out.map((r) => ({ ...r, presets: [...r.presets] }));
  }

  names(): string[] {
    return this.list().map((r) => r.name);
  }

  count(): number {
    return this.list().length;
  }

  /** A DEEP-ENOUGH copy: `presets` is cloned, so an editing UI cannot mutate the stored reel by reference. */
  get(name: string): Reel | undefined {
    const found = this.list().find((r) => sameReelName(r.name, name));
    return found ? { ...found, presets: [...found.presets] } : undefined;
  }

  has(name: string): boolean {
    return this.list().some((r) => sameReelName(r.name, name));
  }

  origin(name: string): ReelOrigin | undefined {
    for (const key of this.userReels.keys()) {
      if (sameReelName(key, name)) return 'user';
    }
    if (this.deploymentReels.some((r) => sameReelName(r.name, name))) return 'deployment';
    if (BUILT_IN_REELS.some((r) => sameReelName(r.name, name))) return 'builtin';
    return undefined;
  }

  /** True when a user reel is sitting on top of a base reel of the same name — so Delete RESTORES. */
  isShadowing(name: string): boolean {
    return this.origin(name) === 'user' && this.baseReel(name) !== undefined;
  }

  /**
   * Whether `Delete` can do anything at all.
   *
   * ⚠️ **An unshadowed base reel is NOT deletable, and that is a decision, not an omission.** Making it
   * deletable needs a tombstone — a persisted record of a name the user does not want — and a tombstone is a
   * second schema with its own silent failure (a built-in renamed in a later build leaves a tombstone
   * pointing at nothing, which is invisible). The button is disabled with its reason in the `title` instead;
   * a user who wants a built-in reel out of their way edits it and saves over it.
   */
  canRemove(name: string): boolean {
    return this.origin(name) === 'user';
  }

  status(): ReelStoreStatus {
    return { ...this.storeStatus };
  }

  // ── the main reel ──────────────────────────────────────────────────────────────────────────────────

  /**
   * The name marked as main, RESOLVED against the current list.
   *
   * ⚠️ **Resolved, not returned raw.** The stored name can point at a reel that no longer exists (a delete,
   * or a deployment file that dropped it), and every caller of this either autostarts it or ticks a checkbox
   * — both of which do nothing at all when handed a dead name. Falling back to the default built-in, and
   * then to the first reel, means "Play with nothing selected" always has something to play.
   *
   * ⚠️ **FOUR candidates, ONE resolution order, and it is written down exactly once — here** (invariant 17):
   * the user's stored choice → the deployment's (`psss_reels.json`) → `DEFAULT_MAIN_REEL_NAME` → the first
   * reel. Each is skipped if it names nothing in the current list, and **nothing writes the resolved value
   * back** — no caller may cache it, because the list changes under it on every save, import and delete.
   */
  mainReelName(): string | null {
    const list = this.list();
    if (list.length === 0) return null;
    for (const candidate of [this.storedMainName, this.deploymentMainName, DEFAULT_MAIN_REEL_NAME]) {
      if (!candidate) continue;
      const hit = list.find((r) => sameReelName(r.name, candidate));
      if (hit) return hit.name;
    }
    return list[0]?.name ?? null;
  }

  /**
   * The raw stored value: what `setMainReel` was given, with no fallback applied.
   *
   * ⚠️ **`toFileText()` deliberately does NOT use this — it exports the RESOLVED name**, so a deployment file
   * always carries an answer even when nobody has chosen one. The two are different verbs for different files:
   * this one is what `persist()` writes to `localStorage`, where storing a resolved fallback would freeze it (see
   * `deploymentMainName`). Nothing in `src/` reads it today; `reelcheck` §H and §K do, because the distinction
   * between the stored and the resolved name is exactly what those clauses measure.
   */
  storedMainReelName(): string | null {
    return this.storedMainName;
  }

  mainReel(): Reel | undefined {
    const name = this.mainReelName();
    return name === null ? undefined : this.get(name);
  }

  isMainReel(name: string): boolean {
    const main = this.mainReelName();
    return main !== null && sameReelName(main, name);
  }

  /**
   * ⚠️ **Un-ticking the main checkbox does NOT clear the mark** — the UI offers no way to have no main reel,
   * because `mainReelName()` would then fall back and the checkbox would spring straight back on, which reads
   * as a broken control (invariant 13 by way of the output channel). Passing `null` here is still supported
   * for the importer, which legitimately has no opinion.
   */
  setMainReel(name: string | null): void {
    const next = name === null ? null : (this.get(name)?.name ?? null);
    if (next === this.storedMainName) return;
    this.storedMainName = next;
    this.persist();
    this.notify();
  }

  // ── writing ────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Create or overwrite a user reel. The ONE write path — `New Reel`, `Save`, the importer and the tab's
   * reordering all end up here.
   *
   * ⚠️ **The stored reel is a fresh object with a copied `presets` array.** The tab holds a working reel it
   * mutates on every drag and every Add; handing that object straight into the map would make every later
   * mutation land in the store unsaved, so `Save` would appear to work before it was pressed and `Cancel`
   * would have nothing to cancel.
   *
   * ⚠️ **Keyed by the reel's own trimmed name, so a rename is a save under a NEW key** and leaves the old one
   * behind. The tab's rename path calls `remove(oldName)` explicitly; this method cannot infer it.
   */
  save(reel: Reel): void {
    const stored: Reel = { ...reel, name: reel.name.trim(), presets: [...reel.presets] };
    const existingKey = this.userKey(stored.name);
    this.userReels.set(existingKey ?? stored.name, stored);
    this.persist();
    this.notify();
  }

  /**
   * Remove a user reel.
   *
   * Returns `'restored'` when a base reel of the same name has reappeared, `'removed'` when the name is now
   * gone entirely, and `'absent'` when there was no user reel to remove.
   *
   * ⚠️ **The three outcomes exist so the CONFIRMATION can say which one it is.** "Delete Grand Tour?" is a
   * lie when the answer restores the built-in version, and a user who reads it as "gone" and then sees it
   * still in the dropdown reads the delete as broken.
   */
  remove(name: string): 'removed' | 'restored' | 'absent' {
    const key = this.userKey(name);
    if (key === undefined) return 'absent';
    const hadBase = this.baseReel(name) !== undefined;
    this.userReels.delete(key);
    this.persist();
    this.notify();
    return hadBase ? 'restored' : 'removed';
  }

  /**
   * Adopt the reels shipped inside the deployment preset file's reserved `__reels` key.
   *
   * ⚠️ **Called BEFORE anything reads the store, and exactly once.** The deployment layer sits under the user
   * layer, so adopting it late would briefly show a merge with the middle layer missing — and the tab's first
   * render is what seeds its working reel, so "late" here means the user starts editing a reel the store is
   * about to replace.
   */
  adoptDeploymentReels(raw: unknown): number {
    if (!Array.isArray(raw)) return 0;
    const reels: Reel[] = [];
    for (const entry of raw) {
      const reel = sanitiseReel(entry);
      if (reel) reels.push(reel);
      else this.storeStatus.rejected++;
    }
    this.deploymentReels = reels;
    if (reels.length > 0) this.notify();
    return reels.length;
  }

  /**
   * Adopt the deployment's own reel file — `psss_reels.json`, the reels' half of the externalised deployment
   * data (v8 Phase 19.11). Returns `null` when `raw` is not a reel file at all, so the caller can tell "no
   * file" from "an empty one".
   *
   * ⚠️ **This is the SAME LAYER as `adoptDeploymentReels`, not a fifth one** — both write the one
   * `deploymentReels` field, and the resolution between the two sources happens once, in `main.ts`, which
   * calls exactly one of them (invariant 17: two sources need one resolution order and nothing may write the
   * resolved value afterwards). Calling both would make the second silently win, which is *almost* harmless
   * and therefore the version that ships.
   *
   * ⚠️ **The shape test is `sanitiseReelFile`, shared with the Import button** — see its write-up in
   * `reel-model.ts`. A second shape test here is the defect it exists to prevent.
   *
   * ⚠️ **The file's `mainReelName` is adopted even when it names nothing yet.** It is resolved lazily by
   * `mainReelName()` against the live list, and the list is not final at adoption time: a user reel loaded from
   * `localStorage` can be what the name refers to. Validating it here would drop a legitimate answer and the
   * only symptom would be the wrong reel autostarting.
   */
  adoptDeploymentReelFile(raw: unknown): { reels: number; mainReelName: string | null; rejected: number } | null {
    const parsed = sanitiseReelFile(raw);
    if (!parsed) return null;
    this.deploymentReels = parsed.reels;
    this.deploymentMainName = parsed.mainReelName;
    this.storeStatus.rejected += parsed.rejected;
    if (parsed.reels.length > 0 || parsed.mainReelName !== null) this.notify();
    return { reels: parsed.reels.length, mainReelName: parsed.mainReelName, rejected: parsed.rejected };
  }

  // ── file in, file out ──────────────────────────────────────────────────────────────────────────────

  /**
   * ⚠️ **Exports the MERGED view, including the built-ins.** A reels file is a portable set, not a diff
   * against this build: exporting only the user's own would produce a file that plays differently on a
   * machine whose built-ins differ, which is the one thing a hand-carried file has to be safe from.
   */
  toFileText(): string {
    return serialiseReelFile(this.list(), this.mainReelName());
  }

  /**
   * Import a reels file's contents. Every incoming reel becomes a USER reel; a name already in the merged
   * view is version-suffixed rather than overwritten.
   *
   * ⚠️ **`nextVersionedName` is imported from the preset importer, not reimplemented.** Its ` v<n>` pattern
   * was measured against the whole library (see its write-up), and a second implementation here would drift —
   * the visible symptom being two different suffix styles for the two Import buttons.
   *
   * ⚠️ **`live` is extended as the loop goes**, so a file containing both `X` and `X v2` cannot collide with
   * itself. Re-reading `names()` per candidate would not see the names this call has already decided.
   */
  importReels(parsed: { reels: readonly Reel[]; mainReelName: string | null; rejected: number }): ReelImportResult {
    const live = new Set(this.names().map((n) => n.trim().toLowerCase()));
    let added = 0;
    let renamed = 0;
    for (const incoming of parsed.reels) {
      let finalName = incoming.name.trim();
      if (live.has(finalName.toLowerCase())) {
        finalName = nextVersionedName(finalName, live);
        renamed++;
      }
      live.add(finalName.toLowerCase());
      this.userReels.set(finalName, { ...incoming, name: finalName, presets: [...incoming.presets] });
      added++;
    }

    // A file's main-reel mark is honoured only if it names a reel that survived un-renamed. A renamed reel is
    // a different reel by primary key, and silently promoting it would change what autostarts on next load.
    let mainReelChanged = false;
    if (parsed.mainReelName && live.has(parsed.mainReelName.trim().toLowerCase())) {
      const before = this.storedMainName;
      this.storedMainName = this.get(parsed.mainReelName)?.name ?? before;
      mainReelChanged = this.storedMainName !== before;
    }

    this.persist();
    this.notify();
    return { added, renamed, rejected: parsed.rejected, mainReelChanged };
  }

  // ── change notification ────────────────────────────────────────────────────────────────────────────

  /**
   * ⚠️ **Returns an unsubscribe, and it is a LIST, not a slot — invariant 15.** The tab subscribes and so
   * does the runner (it re-resolves the playing reel when the reel it is playing is edited); a single slot
   * means whichever registered last silently wins and the other goes stale while still on screen. The
   * returned function MUST be called from the subscriber's `dispose()`.
   */
  onChange(cb: (store: ReelStore) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const at = this.listeners.indexOf(cb);
      if (at >= 0) this.listeners.splice(at, 1);
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────────────────────────────

  /** The `userReels` key matching `name` case-insensitively, or `undefined`. */
  private userKey(name: string): string | undefined {
    for (const key of this.userReels.keys()) {
      if (sameReelName(key, name)) return key;
    }
    return undefined;
  }

  /** The reel `name` would resolve to if the user's copy were removed. */
  private baseReel(name: string): Reel | undefined {
    return (
      this.deploymentReels.find((r) => sameReelName(r.name, name)) ??
      BUILT_IN_REELS.find((r) => sameReelName(r.name, name))
    );
  }

  private load(): void {
    if (!this.persistence) return;
    let text: string | null = null;
    try {
      text = this.persistence.read();
    } catch {
      // Storage revoked between the constructor's probe and this read. Nothing to recover; stay empty.
      return;
    }
    if (!text) return;
    const parsed = parseReelFile(text);
    if (!parsed) {
      // ⚠️ The entry is NOT cleared. It is the only evidence of what went wrong, and a user who hand-edited
      // it can still fix it; the next successful `save` overwrites it anyway.
      console.warn('[reels] stored reels could not be read and were ignored');
      this.storeStatus.rejected++;
      return;
    }
    for (const reel of parsed.reels) this.userReels.set(reel.name, reel);
    this.storedMainName = parsed.mainReelName;
    this.storeStatus.rejected += parsed.rejected;
  }

  /**
   * ⚠️ **Writes the USER layer alone** (property 1 in this file's header), and **a failed write never
   * discards the in-memory edit.** A quota error mid-session must cost persistence, not the reel the user is
   * looking at; the latch on `status.writeFailed` is what lets the tab say "not saved to this browser" once,
   * instead of the reel disappearing on the next reload with no explanation.
   */
  private persist(): void {
    if (!this.persistence) return;
    try {
      this.persistence.write(serialiseReelFile([...this.userReels.values()], this.storedMainName));
    } catch {
      this.storeStatus.writeFailed = true;
      console.warn('[reels] could not write to localStorage — reels will not survive a reload');
    }
  }

  private notify(): void {
    // A copy of the list, because a listener may unsubscribe (a tab disposing on a preset switch) while the
    // notification is in flight — splicing the array being iterated would skip the next subscriber.
    for (const cb of [...this.listeners]) cb(this);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The deployment's reel file — v8 Phase 19.11
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The deployment's externalised reel file, and the global it assigns.
 *
 * ⚠️ **A SECOND FILE WITH A SECOND GLOBAL IS CORRECT; A SECOND GLOBAL *INSIDE `psss_presets.json`* IS STILL
 * THE DEFECT.** Those read like the same thing and they are not, so both rules have to be carried at once.
 * `REEL_LIBRARY_KEY`'s write-up below records why `g_psss_reels = {…}` may not be appended to the *preset*
 * file: the dev loader strips one leading assignment and `JSON.parse`s the whole remainder, so a second
 * statement in that file makes the parse throw and the app continues with an EMPTY preset library. A file of
 * its own has one leading assignment of its own, is parsed by nobody else, and cannot reach that path.
 * ⚠️ **Do not "restore" the reserved key on the strength of the older rule** — it is scoped to one file.
 *
 * ⚠️ **`.json` BY EXTENSION AND JAVASCRIPT BY CONTENT, exactly like `psss_presets.json`.** The file is
 * `g_psss_reels={…}` and is loaded with a `<script defer>` tag, because `fetch` cannot read a sibling file
 * under `file://` — the same constraint, the same shape, and the reason the two files look identical from
 * outside. A reader who assumes it is plain JSON and `JSON.parse`s it whole gets a syntax error at column 1.
 *
 * ⚠️ **The name is spelled here and in `vite.config.ts` (the `<script>` tag) and nowhere else.** The two
 * cannot be made to share a literal — importing this module into the Vite config would drag the UI import
 * graph into config resolution — so `scripts/export-library.mjs` asserts instead that the `index.html` it
 * finds in `dist/` actually references the file it just wrote. Without that assertion a rename on either side
 * ships a deployment that plays the built-in reels and reports nothing.
 */
export const REEL_DEPLOYMENT_FILE = 'psss_reels.json';
export const REEL_DEPLOYMENT_GLOBAL = 'g_psss_reels';

/**
 * The reserved key the deployment preset file carries its reels under.
 *
 * ⚠️ **SUPERSEDED AS THE EMITTED FORMAT BY `REEL_DEPLOYMENT_FILE` (19.11), AND STILL READ.** The exporter no
 * longer writes this key — one deployment carrying its reel list twice is two sources for one value, which is
 * the invariant-17 defect made physical — but `extractDeploymentReels` still runs on both load paths, so a
 * hand-edited or older preset file that carries one is still honoured, and the key can still never become a
 * preset. `main.ts` decides between the two sources in one place, in one stated order.
 *
 * ⚠️ **A KEY INSIDE the existing `g_psss_presets` object, not a second assignment in the file.** The dev
 * loader strips the leading `g_psss_presets =` assignment with a single anchored regex and then `JSON.parse`s
 * the whole of the rest of the file — ⚠️ **do not quote that regex here: it ends in `\s` followed by a star and
 * a slash, which closes this comment block, and the file then fails to parse 25 lines further down where the
 * next backtick opens a template literal that is never closed.** (It did, once. `tsc` reports the damage at the
 * unterminated literal, nowhere near the cause, and a parse error suppresses every semantic diagnostic in the
 * project, so the whole `verify` gate goes blind at the same time. `regexcheck` has no rule for it.)
 *
 * A second `g_psss_reels = {...}` statement in the same file makes that parse throw — and the `catch` around
 * it logs `Could not load legacy presets` and carries on with an EMPTY library, i.e. the whole app looks
 * broken because of a reel.
 *
 * ⚠️ **It must be deleted from the raw object before `loadLibrary`/`loadAll` sees it**, or the array becomes a
 * preset named `__reels`: `MigrationLayer.migrate` is tolerant enough to produce something from it, and the
 * result is a black tile in the grid that no one can explain. `extractDeploymentReels` is the one place that
 * happens, and it is called on BOTH load paths — dev and standalone do not share one.
 */
export const REEL_LIBRARY_KEY = '__reels';

/**
 * Take the reserved reels key out of a raw preset object, returning what it held.
 *
 * ⚠️ **Mutates `raw` on purpose** — the deletion is the point, and returning a filtered copy would leave the
 * caller free to pass the original on. In the standalone build `raw` is `globalThis.g_psss_presets`; deleting
 * one own property of it is exactly what makes the object safe to hand to `loadAll`.
 */
export function extractDeploymentReels(raw: Record<string, unknown>): unknown {
  if (!Object.prototype.hasOwnProperty.call(raw, REEL_LIBRARY_KEY)) return undefined;
  const value = raw[REEL_LIBRARY_KEY];
  delete raw[REEL_LIBRARY_KEY];
  return value;
}
