#!/usr/bin/env node
/**
 * palettecheck — **v8 Step 21.4. The `index` mapping's whole claim is an IDENTITY, and an identity is the one
 * kind of claim a browser cannot confirm.**
 *
 * ## What this checker is for
 *
 * `21.D3` establishes that the legacy per-particle colour law *is* Quilez's cosine palette
 * (`a = colorBase/255`, `b = colorAmp/255`), so `index` is a seventh **mapping** rather than a new colour
 * system, and `21.4d`'s migration can name a palette on 114 shipping presets **without changing one pixel of
 * any of them**. Every word of that is falsifiable, and every way it can fail is silent:
 *
 *  - a palette authored to two decimals instead of `/255` shifts the output by **1 LSB** — invisible to the
 *    eye, and a lie in the one sentence the step rests on;
 *  - a TOLERANCE in the reverse lookup adopts a near-miss pair and **repaints** a preset the migration is
 *    supposed to leave alone (`Water Ice Crystal` is 64 away from `Cycle: Azure` in green alone);
 *  - the shader keeping its LUT under `index` draws a *different, plausible* picture — nothing black, nothing
 *    thrown, and the mapping's own controls still move;
 *  - a reader keeping its own `??` chain over the two sources draws the OTHER source's palette. Invariant 17
 *    is explicit that grepping the readers exonerated the buggy file last time.
 *
 * ⚠️ **This checker MEASURES, and it measures through the REAL code.** The colour law is not transcribed here:
 * §C instantiates `LissajousGenerator`, `init()`s it from the preset's own `generators` block and calls
 * `sampleIndexColours()`, which is the method the swatch and the per-particle loop share. A transcription of
 * the law would pass while the law was wrong, which is the failure `trackcheck`'s header describes in the
 * slider domain. Do not "simplify" any section below into a text pattern — but note that §E and §F are
 * SOURCE-SHAPED on purpose, and a failure there means an owner was bypassed or renamed rather than that the
 * arithmetic is wrong. Those are two different findings.
 *
 * ⚠️ **`pos = 0` is forbidden as a sampling instant anywhere in here (invariant 28).** At `pos === 0` the
 * drift term `sin(… + pos·shift[c])` collapses on all three channels at once, so a parity test run there
 * compares two pictures with the drift switched off — it would pass with `colorShift` ignored entirely. Every
 * instant this file samples is non-zero and the set is stated at `POS_SAMPLES`.
 *
 * ## What it deliberately does NOT assert
 *
 * Not that a palette is pretty, not that the nine names are the right names (`21.3`'s naming proposal is the
 * owner's call), and not a coverage floor over the 41 palettes — `coveragecheck`'s §G owns that as a REPORT
 * line by the owner's decision (`21.D7`, *"a long list does no harm"*).
 *
 * The two SLIDER TRACKS this step added (`CYCLES_TRACK`, `COLOUR_DRIFT_TRACK`) are asserted in
 * **`trackcheck` §J/§K**, not here: that file owns the `sanitize`/`stops` model of what a real
 * `<input type="range">` does to a value, and a second copy of it would be a second instrument measuring the
 * same quantity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
/** Load-bearing for §E/§F, exactly as in `deadcheck` and `trackcheck`: a pattern aimed at code must see code. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0, notes = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const note = (m) => { console.log(`  NOTE  ${m}`); notes++; };

const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { MigrationLayer } = await import('../src/presets/migration.ts');
const { LissajousGenerator } = await import('../src/generators/lissajous.ts');
const {
  CYCLE_PALETTES, CYCLE_PALETTE_PREFIX, COSINE_PALETTES, LEGACY_PALETTES,
  getIndexPaletteAB, cyclePaletteForPair, getPaletteLUT, getAllPaletteNames,
} = await import('../src/presets/palettes.ts');
const {
  resolvePaletteSelection, lookPaletteForAdoption, PALETTE_UNSET, INDEX_SWATCH_POS,
  PALETTE_MAPPING_LABELS, PALETTE_MAPPING_ORDER,
} = await import('../src/renderers/palette-selection.ts');
const {
  FILM_LOOKS, PALETTE_MAPPING_OFF, paletteMappingToInt,
} = await import('../src/renderers/film-looks.ts');

// COMPOSE THE LIBRARY — the same three lines `coveragecheck`, `fieldcheck` §U and `export-library.mjs` use.
// ⚠️ `public/psss_presets.json` is NOT plain JSON (it opens `g_psss_presets={`) and is READ-ONLY by project rule.
const rawText = rd('public/psss_presets.json');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const mgr = new PresetManager();
loadLibrary(mgr, rawLib);
const NAMES = mgr.list();
/** Mutable deep clones — `PresetManager` deep-freezes, and §D and §I mutate fixtures. */
const LIB = new Map(NAMES.map((n) => [n, JSON.parse(JSON.stringify(mgr.get(n)))]));

/**
 * The instants every colour comparison in this file is made at.
 *
 * ⚠️ **NONE of them is 0, and that is invariant 28, not caution.** Four rather than one because the drift is
 * per-channel: a single instant can coincidentally agree on a pair that differs, and `123.456` is included
 * specifically because it is far outside the `[0, 1]` range the swatch uses — an error proportional to `pos`
 * (a drift applied twice, say) is invisible near the origin and obvious out there.
 */
const POS_SAMPLES = [0.37, 1, 7.5, 123.456];

/** The live film look for a body, as `main.ts`'s `liveFilmLookParams()` resolves it. */
const liveLook = (ov) => {
  const n = ov?.filmLook;
  if (n === 'Customize') return ov?.customFilmLookParams;
  return FILM_LOOKS[n ?? 'Legacy'] ?? FILM_LOOKS['Legacy'];
};
/** The resolved selection for a body, through the ONE owner. */
const selectionFor = (p) => {
  const ov = p.overlay;
  const look = liveLook(ov);
  return resolvePaletteSelection(
    { palette: ov?.palette, paletteMapping: ov?.paletteMapping },
    look ? { palette: look.palette ?? 'none', paletteMapping: look.paletteMapping ?? 'depth' } : undefined,
  );
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the basis: who authors `index`, and the nine names reconciled BY NAME ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **Counted over the COMPOSED library, which is the MIGRATED library.** `PresetManager.get()` returns a
 * body that has been through `MigrationLayer.migrate()`, so the 114 adoptions of `21.4d` are visible here as
 * authored fields — they are not in any source file and a grep over `src/presets/` would report zero. That is
 * the whole reason this section exists rather than a count in a comment.
 *
 * ⚠️ **Reconciled BY NAME and by three-way partition, never by a total.** A sum agreeing with a sum proves
 * nothing (`coveragecheck` §A's rule): a preset that lost its mapping and one that gained a palette cancel.
 */
const indexBodies = NAMES.filter((n) => LIB.get(n).overlay?.paletteMapping === 'index');
const adoptedByName = new Map();
const unnamedIndex = [];
for (const n of indexBodies) {
  const pal = LIB.get(n).overlay?.palette;
  if (pal === undefined || pal === PALETTE_UNSET || pal === 'none') unnamedIndex.push(n);
  else adoptedByName.set(pal, [...(adoptedByName.get(pal) ?? []), n]);
}
const adoptedCount = [...adoptedByName.values()].reduce((a, l) => a + l.length, 0);
chk(`the library composes to ${NAMES.length} presets, of which ${indexBodies.length} author \`paletteMapping: 'index'\``,
  indexBodies.length === adoptedCount + unnamedIndex.length,
  `${adoptedCount} name a palette + ${unnamedIndex.length} leave it unset = ${indexBodies.length}. `
  + '⚠️ Re-run this rather than quoting the figures: they move with the library, and the RATIO is what carries '
  + 'the meaning (an `index` body with no palette reads its own quadruple, bit-identically — §C)');
for (const [name, list] of [...adoptedByName].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`         ${name.padEnd(20)} ${String(list.length).padStart(3)}`);
}
if (unnamedIndex.length) {
  note(`${unnamedIndex.length} \`index\` body/bodies name NO palette — by design (21.D3: a singleton hue gets no `
    + `name): [${unnamedIndex.join(', ')}]. 21.4f labels these \`Preset colour (index)\``);
}
/*
 * ⚠️ **"AN `index` BODY" AND "AN ADOPTED PALETTE" ARE TWO POPULATIONS, AND CONFLATING THEM WAS THIS SECTION'S
 * OWN DEFECT UNTIL 2026-09-19.** Both clauses below used to run over every `index` body, which was correct only
 * while the 21.4d migration was the ONLY writer of `overlay.palette` + `'index'`. Since 21.4g the Lab's one
 * Colour Palette field lets the owner pick any palette under any mapping and Export carries it, so an
 * owner-authored index palette is now an ordinary body — and the first one (`The Masters Light II`, `Aurora`
 * under `index`) failed BOTH clauses on arrival. **Neither failure was about the preset**: the parity clause
 * asserts "21.4d edits no preset's appearance", and an override exists precisely to change the appearance.
 *
 * ⚠️ **The partition is derived from the ADOPTION'S OWN RULE, not guessed.** `adoptIndexPalette` returns early
 * if EITHER field is already defined, and it writes only `cyclePaletteForPair(colorBase, colorAmp)` — so an
 * adopted body's palette EQUALS its own pair's reverse lookup, always, and a body whose name disagrees with its
 * pair cannot have been adopted.
 *
 * ⚠️ **The override class is a NAMED LIST and must stay one.** Deriving it would make the narrowing a hole: a
 * mis-adoption that wrote the wrong `Cycle:` name also disagrees with the pair, so it would land in the override
 * class and escape the parity clause silently — the exact failure 21.4d exists to prevent. Naming them costs one
 * line per authored override and turns a new one into a FAILURE that has to be read and accepted, which is the
 * only way this section can distinguish "the owner chose that" from "the adoption is broken".
 */
const AUTHORED_INDEX_PALETTES = {
  // `The Masters Light II` (2026-09-19, fifth settle batch) — the owner tuned `Aurora` under `index` in the Lab
  // and the variant is a verbatim paste of that export. Its pair reverse-looks-up to `Cycle: Embers`, which is
  // what the ANCHOR ships; the whole point of the variant is that it does not look like the anchor.
  'The Masters Light II': 'Aurora',
  // `Waves II` (2026-09-19, EIGHTH settle batch, from `Waves new_20260919_190248.json`) — the owner picked
  // `Cycle: Starfield` in the Lab's Colour Palette field; this body's pair ([128,128,128]/[128,128,128])
  // reverse-looks-up to `Cycle: Neutral`, which is what the ANCHOR ships. ⚠️ **Unlike `Aurora` above, this
  // override IS one of the nine `Cycle:` names, so NOTHING about the name distinguishes it from an adoption** —
  // only the comparison against the pair does, which is why the partition below is derived from the adoption's
  // own rule and not from the name's shape. Starfield's `a`/`b` are (64, 64, 128)/255 against Neutral's
  // (128, 128, 128)/255: half the red and green, blue kept.
  'Waves II': 'Cycle: Starfield',
  // `Curl Noise Braid` (2026-09-20, the coverage cohort's 27th body) — ⚠️ **the first override that is NOT an
  // owner Lab export**: the palette is authored in `demo-presets.ts` as part of the demo's argument (index
  // mapping separates the braid's strands, and the demo must not be read as a second fire preset next to
  // `Ember Storm`). ⚠️ **It is also the one override the adoption could not have produced even in principle**:
  // its pair ([128,128,128]/[96,96,96]) reverse-looks-up to `null`, and `adoptIndexPalette` writes the palette
  // ONLY on a match — so without this line the body would sit in the palette-free `index` class, not here.
  // That makes it the cheapest live example of why the partition is derived from the pair rather than the name.
  'Curl Noise Braid': 'Aurora',
  // `Depth Gate Veil` (2026-09-20, from `Depth Gate Veil_20260920_202236.json`) and `Time Warp Lattice`
  // (from `Time Warp Lattice_20260920_185718.json`) — owner Lab exports over two Phase 21 demos. ⚠️ **Both
  // bodies were already `index` bodies via 21.4d and sat in the palette-free class**, so the export changed
  // ONE thing each: it gave the existing mapping a NAME. Neither pair reverse-looks-up to the chosen palette
  // ([144,160,192]/[64,56,72] and [140,170,200]/[60,50,70] both to `null`), so the adoption could not have
  // produced either — the same argument as `Curl Noise Braid` above, now with two live instances.
  'Depth Gate Veil': 'Cycle: Azure',
  'Time Warp Lattice': 'Neon',
  // ─── 2026-09-21, the nine-preset owner-tuned export cohort ───────────────────────────────────────────────
  // ⚠️ **Three more arrived in ONE sitting, and they are not three instances of one case.** All three pairs
  // reverse-look-up to `null` ([120,144,184]/[72,64,80], [128,128,128]/[32,32,32], [176,152,96]/[56,48,64]),
  // so the adoption could not have written any of them — but what each export CHANGED differs:
  //
  //  - `Parallax Depth Shell` (`…_20260921_184531.json`) — was in the palette-free `index` class; the export
  //    gave the existing mapping a NAME, exactly like the two lines above.
  //  - `Aizawa Torus Shell` (`…_20260921_154044.json`) — ⚠️ **this one CHANGED MAPPING**: the body authored
  //    `palette: 'Classic: ice', paletteMapping: 'depth'` before, so it was never an `index` body at all. It
  //    is also the second override (after `Waves II`) whose name IS one of the nine, so nothing about the
  //    name distinguishes it from an adoption — only the pair comparison does.
  //  - `Julia Siegel Disk River` (`…_20260921_153331.json`, renamed from `Julia Pinwheel Arms`) — ⚠️ **the
  //    first override on a body whose `renderMode` is NOT in `INDEX_COLOUR_MODES`**: it ships `'liquid'`, so
  //    `MigrationLayer` would have refused to adopt here on step 3 (the colour law does not reach the screen
  //    through the point path) and the palette is authored over that refusal. It is nonetheless LIVE, by a
  //    route this section does not otherwise exercise: under `index` the GENERATOR carries the palette
  //    (`setIndexPalette`), so `state.colors` are Prismatic-derived, and the liquid surface reads those
  //    colours twice — as the CPU mean in `uTint` (`tintSource: 'preset'`) and per pixel through
  //    `uColorField` at `colourMix` 0.85. The shader's palette LUT is off, which is what `index` means.
  'Parallax Depth Shell': 'Sunset',
  'Aizawa Torus Shell': 'Cycle: Solar',
  'Julia Siegel Disk River': 'Prismatic',
  /*
   * ─── v8 `33.4`, 2026-10-28 ────────────────────────────────────────────────────────────────────
   *
   * ⚠️⚠️ **A THIRD CASE THIS LIST DID NOT ANTICIPATE, AND IT IS WORTH NAMING RATHER THAN JUST ADDING.**
   * The clause's own warning offers two readings of an unexpected body — *a new owner-authored palette*
   * or *a mis-adoption* — and this is neither. `Siegel Disk Rays` is a `33.4` DEMO cloned from
   * `Julia Siegel Disk River` directly above, so it carries the **same authored body, inherited**: not a
   * new authoring decision, and not a mis-adoption either.
   *
   * ⚠️ **The rule to carry forward: a demo cloned from a host on this list joins the list.** Thirteen of
   * `33.4`/`33.5`/`33.6`'s fourteen demos did not trip it, because only this host authors an `index`
   * palette body — so the next clone of a declared host is the next entry, and a red here means a demo
   * was added, not that a palette drifted.
   */
  // (`Siegel Disk Contours`, renamed 11-01 from `Siegel Disk Rays`, was DELETED 2026-11-13 by the owner: a
  // byte-identical copy of `Julia Siegel Disk River` once converted to contours.)
  /*
   * ⚠️ **AN OWNER-AUTHORED PALETTE, FROM THEIR OWN EXPORT** — `Quader Star Eight_20261028_233853.json`,
   * the finetuned replacement for the preset the specifier authored. This is the clause's FIRST reading
   * ("a new owner-authored palette, and say which export"), not the second ("a mis-adoption"): the body
   * arrived with the export rather than being written by an adoption path, and the export is named above
   * so the provenance is checkable rather than asserted.
   *
   * ⚠️ Its sibling `Quader Star Twelve` is NOT here, and the difference is the rule: that one authors
   * `Material: fire`, which is a registry name the adoption path resolves, so its body is ADOPTED.
   */
  'Quader Star Eight': 'Cycle: Neutral',
  // ─── 2026-10-07, the three owner presets added to the standard list ───────────────────────────
  // ⚠️ **ARRIVED AS A FAILURE OF THIS VERY CLAUSE, WHICH IS THE DESIGN WORKING**: the header's rule is that a
  // new override must be READ AND ACCEPTED rather than derived, because a mis-adoption that wrote a wrong
  // `Cycle:` name would otherwise escape the parity clause silently.
  //
  // All three are Lab exports the owner asked for by name (`Dancing Rays II` from `Evo Gen 9`, `Flying
  // Zebras` from `Evo Gen 1`, `Reflections in the Water` from `Behind A Glass Window v2`), and all three are
  // authored by CONSTRUCTION rather than by choice-over-an-adoption: they are TS bodies, so `MigrationLayer`
  // never sees them, and **adoption only ever runs over the legacy JSON.**
  //
  // ⚠️ **AND THE ADOPTION COULD NOT HAVE PRODUCED THEM EVEN IN PRINCIPLE — all three pairs reverse-look-up to
  // `null`**, measured 2026-10-07: `Dancing Rays II` ([161.39,163.25,102.47]/[116.57,81.30,154.81]),
  // `Flying Zebras` ([119.81,96.04,156.23]/[91.19,107.33,127.37]), `Reflections in the Water`
  // ([138.85,32,44.25]/[64,64,128]). That is the `Curl Noise Braid` case, now with three more instances —
  // and it is the ordinary case for an Evolution-derived body, whose colour pair is a crossover result and so
  // lands on no `Cycle:` palette's exact pair.
  //
  // ⚠️ **All three name `Cycle: Neutral`, which IS one of the nine**, so — as with `Waves II` and
  // `Aizawa Torus Shell` — nothing about the name distinguishes these from adoptions. Only the pair
  // comparison does, which is the whole reason the partition is derived from the pair.
  //
  // ⚠️ **TWO MORE (2026-10-19), AND BOTH ARRIVED AS A FAILURE OF THIS CLAUSE — which is the clause working.**
  // `Breathing Dye` is the owner's `Dye Index Bands_20261019_203114.json` and `Dye Holi Festival` is their
  // `Lava v2_20261019_195038.json`, both imported verbatim bar `metadata.name`.
  //
  // **`Breathing Dye` is the easy one: `Sunset` is NOT one of the nine `Cycle:` palettes**, and adoption only
  // ever writes a `Cycle:` name, so it could not have written this one even in principle. Measured anyway:
  // `cyclePaletteForPair([120,180,216], [40,32,24])` returns **null**.
  //
  // ⚠️ **`Dye Holi Festival` IS THE HARD ONE, AND IT LOOKED EXACTLY LIKE THE MIS-ADOPTION THIS CLAUSE WARNS
  // ABOUT: its body authors `Cycle: Neutral` while its own pair resolves to `Cycle: Solar`.** The header's
  // rule is to RESOLVE that rather than declare it, so:
  //
  //   - the EXPORT itself authors `palette: 'Cycle: Neutral'` with `paletteMapping: 'index'` — so the name
  //     is the owner's pick in the Lab, not something a loader computed;
  //   - the body's `colorBase`/`colorAmp` are `[224,96,32]`/`[32,96,32]`, which are **`Cycle: Solar`'s own
  //     `a`/`b` to the byte** — and they are `Lava`'s colours, inherited because this is a `Lava` variant;
  //   - ⚠️ **under `index` mapping with an AB palette the PALETTE's base/amp OVERRIDE the preset's own**
  //     (`writeColourAt`: `cBase = ip.kind === 'ab' && ip.base ? ip.base : this.colorBase`), so that pair is
  //     **INERT in this body**.
  //
  // **So `cyclePaletteForPair` is correctly identifying an unread leftover, not a live palette.** The
  // disagreement is explained rather than suspicious: a variant kept its anchor's colour pair, and the
  // mapping it authors stopped reading it. ⚠️ **Do not "repair" the pair to match the name** — it is
  // unread, so the edit would change nothing visible while touching an owner-authored body.
  'Breathing Dye': 'Sunset',
  'Dye Holi Festival': 'Cycle: Neutral',
  // v8 — `Dye Sunset` is `Dye Holi Festival`'s own child (export `…_20261019_232450.json`) and
  // inherits the identical situation: authored `Cycle: Neutral`, inherited `Cycle: Solar` pair,
  // unread under `index` + AB. Same resolution, measured the same way.
  'Dye Sunset': 'Cycle: Neutral',
  //
  'Dancing Rays II': 'Cycle: Neutral',
  'Flying Zebras': 'Cycle: Neutral',
  'Reflections in the Water': 'Cycle: Neutral',
  //
  // ⚠️ **TWO MORE OF THE SAME CASE (2026-10-10), AND THEY ALSO ARRIVED AS A FAILURE OF THIS CLAUSE.**
  // `Through a Lense` and `Vortex Dances` are Lab exports the owner asked for by name, both from
  // `Evo Gen 8` (`…_20261010_111916.json` and `…_20261010_105508.json` — one generation, two picks, so
  // the timestamp is the only thing that tells the sources apart).
  //
  // ⚠️ **RESOLVED BY MEASUREMENT, NOT BY PATTERN-MATCHING THE PREVIOUS THREE.** The header's rule is that
  // an override must be shown to be unreachable by adoption, and `Cycle: Neutral` being one of the nine
  // means the NAME proves nothing. Measured 2026-10-10: both bodies carry the pair
  // ([128,157.44,186.42]/[98.56,98.56,69.12]) and `cyclePaletteForPair` returns **null** on it, so
  // adoption could not have written that name even in principle. Same class as `Curl Noise Braid`, and
  // the ordinary outcome for an Evolution-derived body whose colour pair is a crossover result.
  //
  // ⚠️ **THE THIRD PRESET OF THAT COHORT, `Mosaic in Glass`, IS DELIBERATELY ABSENT FROM THIS LIST** — it
  // carries no `overlay.palette` at all, so it is not in the named-`index` class and has nothing to
  // declare. Adding it here would create a phantom row, which the clause above also catches.
  'Through a Lense': 'Cycle: Neutral',
  'Vortex Dances': 'Cycle: Neutral',
  /*
   * ─── v8 `34.6`, re-authored 2026-10-31 — a demo that LEFT the adopted partition ────────────────
   *
   * ⚠️⚠️ **`Quader Square Spring` IS THE ONE ROW HERE THAT WAS PREDICTED BY THE BODY IT DESCRIBES.** The
   * demo authored `Cycle: Embers` BECAUSE that is `cyclePaletteForPair([21,21,21], [64,32,32])` — its
   * host's own pair — so it sat in the ADOPTED partition and its doc comment warned that naming anything
   * else *"would make this an AUTHORED override in `palettecheck`'s partition and owe a declaration
   * there"*. **On 2026-10-31 the owner commissioned exactly that, and the warning held: this clause went
   * red until the row existed.**
   *
   * ⚠️ **The reason is a MEASUREMENT and not a colour preference: inheriting the host's pair made the demo
   * invisible** — mean 0.40 of 255, 1.93 % of pixels above the 8-bit floor, dimmest of the fourteen Phase
   * 34 demos by 3×, because the host pair is dark AND `Cycle: Embers` is the dimmest palette in the
   * registry (its brightest point, luminance 64, is darker than most palettes' darkest). `Pastel`/`index`
   * measures 37× the mean and 20× the structure. ⚠️ **The adoption could not have written `Pastel`:** it
   * is not one of the nine, and the body's pair still resolves to `Cycle: Embers`, so the pair disagrees
   * with the authored name — the same discriminator the `35.6` block below relies on.
   *
   * ⚠️ **So this list now carries THREE provenances, and the header's "an owner's export" is one of
   * them**: an export, a demo's own argument, and — new here — **an owner instruction that overrode a
   * demo's documented reason for the colour it had.** Each row says which it is.
   */
  'Quader Square Spring': 'Neon',
  /*
   * ─── v8 `35.6`, 2026-10-29 — the WARP SHAPE demos ─────────────────────────────────────────────
   *
   * ⚠️ **THREE MORE OF `Curl Noise Braid`'s CASE, AND THE CLAUSE'S FIRST READING IS THE RIGHT ONE: these
   * are palettes authored in `variant-presets.ts` AS PART OF EACH DEMO'S ARGUMENT, with no export behind
   * them.** There is no second reading to resolve here, and the reason is structural rather than a
   * judgement: they are TS bodies, so `MigrationLayer` never sees them and **adoption only ever runs over
   * the legacy JSON.** Each is written out in its own entry's doc comment with the reason the colour was
   * not left to the film look — `Void` carries `Midnight`, `Glacier` carries `Cool`, `Teal & Orange`
   * carries `Sunset`, and **a look only SETS a palette when it has one**, so inheriting would have shipped
   * a hue the demo does not want.
   *
   * ⚠️ **MEASURED, and the adoption could not have produced any of the three even in principle:** all
   * three carry the demo family's grey pair ([128,128,128]/[128,128,128]), which `cyclePaletteForPair`
   * resolves to **`Cycle: Neutral`** — so the pair disagrees with the authored name in every case. ⚠️ **On
   * `Warp Split Shapes` the NAME proves nothing, because `Cycle: Storm` IS one of the nine** (the
   * `Waves II` / `Aizawa Torus Shell` hazard); **only the pair comparison separates it from an adoption,
   * which is why this list is derived from the pair rather than from the name's shape.**
   *
   * ⚠️ **The other five `35.6` demos are DELIBERATELY ABSENT and adding one would create a phantom row
   * the clause above also catches:** `Warp Shape Dimmer` and `Warp Torn Zoom` author `palette: 'none'`
   * under `depth`, `Warp Triangle Weave` authors no palette at all (it is a one-operator A/B against
   * `Shift Lattice Drift`, which authors none either), and `Warp Ridge Blades` maps under `phase` rather
   * than `index`, so four of the five stay outside the named-`index` class.
   *
   * ⚠️⚠️ **THE FIFTH JOINED IT ON 2026-10-31 AND THIS CLAUSE IS WHAT FOUND THE EDIT — `Warp Sawtooth
   * Blade` moved from `Cycle: Embers`/`phase` to `Pastel`/`index` on the owner's instruction** (its
   * authored pair was the dimmest palette in the registry and the demo measured mean 0.31 of 255; the
   * preset's header owns the measurement). **No export behind it either — an owner instruction over a TS
   * body, which is the third provenance this list now carries after "an owner export" and "inherited from
   * a parent demo".** ⚠️ `Warp Square Mosaic`'s VALUE changed in the same sitting (`Monochrome` →
   * `Pastel`) while its row stayed — **the row is keyed by name and asserts the PAIR, so a value edit is
   * caught here too, and the two edits fail this clause in different ways: a new member by its absence
   * from the declared list, a changed value by the pair comparison.**
   */
  /*
   * ⚠️ **THREE ROWS WERE REMOVED HERE ON 2026-10-31 (owner's second deletion batch of that date) AND THE
   * CLAUSE CAUGHT THAT TOO — a PHANTOM row fails it exactly as a missing one does:** `Warp Trapezoid
   * Ribbon` (`Ocean`), `Warp Split Shapes` (`Cycle: Storm`) and `Warp Zoom Oblique` (`Cycle: Storm`) were
   * deleted from the library with four other demos. **Do not re-add them from an older plan or manual
   * paragraph that still names them** — those documents describe a 336-preset library.
   */
  'Warp Square Mosaic': 'Cycle: Solar',
  'Warp Sawtooth Blade': 'Pastel',
  /*
   * ─── the owner's REVIEW BATCH, 2026-10-31 — nine finetuned exports, five deletions, two additions ───
   *
   * ⚠️⚠️ **FIVE ROWS MOVED IN ONE EDIT AND THE CLAUSE CAUGHT ALL FIVE, IN TWO DIFFERENT WAYS: three bodies
   * ENTERED the named-`index` class (absent from the declared list) and two CHANGED VALUE (present, wrong
   * pair).** Both halves matter — a list keyed by name alone would have passed the value changes.
   *
   * **Provenance: owner exports, imported VERBATIM** (`Multiple Faceted Core_20261030_162729.json`,
   * `Quader Deep Orbit_20261030_154807.json`, `Warp Square Mosaic_20261030_160434.json` as the new
   * `Square Mosaic`, plus the finetuned `Quader Square Spring` and `Warp Square Mosaic`) — the first
   * provenance this list was built for. ⚠️ **They SUPERSEDE the 2026-10-31 palette re-authorings recorded
   * above**: the owner's own tuning kept `Pastel` on `Warp Sawtooth Blade`, replaced it with `Neon` on
   * `Quader Square Spring` and with `Cycle: Solar` on `Warp Square Mosaic` (whose look also left `Void`,
   * which is what the dimness note above said only an owner could decide).
   *
   * ⚠️ **`Warp Ridge Blades` is NOT here although it too was re-authored** — the owner's export maps
   * `Cycle: Solar` under `phase`, so it is outside the named-`index` class entirely. Same for
   * `Warp Chevron Score` and the new `Cylinder Kaleidoskope` (`Neon`/`velocity`).
   */
  /*
   * ─── the PHASE 33 CURVE bodies, finetuned 2026-10-31 (owner's third batch of that date) ────────
   *
   * ⚠️ **Both are owner exports imported VERBATIM** (`Cylinder Viviani_20261031_193403.json` and
   * `Cylinder Viviani_20261031_193630.json`, the second shipped as `Fluid Viviani`). They entered this list
   * because the `33.1` bodies they replaced carried **no overlay at all** — those presets were the phase's
   * zero-code curves, authored as `generators.waves` alone — so an authored palette is new to them.
   *
   * ⚠️ **`Cycle: Azure` IS one of the nine, so the NAME proves nothing here** (the `Waves II` hazard): what
   * puts them in the AUTHORED class rather than the ADOPTED one is that their own pair resolves elsewhere.
   * ⚠️ **`Quader Torus Knot` is NOT here and must not be added** — it authors no `overlay.palette` at all and
   * takes `Neon` from its `Customize` bundle, which is the look-supplied class §C now names separately.
   */
  'Cylinder Viviani': 'Cycle: Azure',
  'Fluid Viviani': 'Cycle: Azure',
  'Multiple Faceted Core': 'Cycle: Deep Blue',
  'Quader Deep Orbit': 'Cycle: Neutral',
  'Square Mosaic': 'Ocean',
  /*
   * ─── v8 `36.21`, 2026-11-03 — the SELF-SIMILAR CURVE demos ─────────────────────────────────────
   *
   * ⚠️ **TWO rows, both AUTHORED and neither from an export: they are TS bodies, and `MigrationLayer`
   * never sees one — adoption only ever runs over the legacy JSON.** Both are the first presets in the
   * library to store `generators.type: 'lsystem'`.
   *
   * ⚠️ **`paletteMapping: 'index'` IS LOAD-BEARING ON THIS FIGURE TYPE RATHER THAN DECORATIVE, which is
   * why the pair is authored rather than left to a look.** On a locality-preserving rule the curve
   * visits each sub-cube as a CONTIGUOUS INDEX RANGE, so `index` is a smooth 3-D gradient and a
   * bracketed rule bands by branch. `velocity` would be the wrong driver twice over — the figure has
   * no intrinsic motion (`motion: 'static'`).
   *
   * ⚠️⚠️ **EIGHT rows, and the NINTH demo's absence is the finding.** `Curve Subdivide` authors
   * `palette: 'Warm'` under `paletteMapping: 'depth'`, so it is **not in this clause's population
   * at all** — the clause reads `index`-mapped bodies. It was declared here while it mapped
   * `index` and had to be REMOVED when the owner's finetuned export changed the mapping, which is
   * this clause working in the direction nobody expects: **a declaration that stops being true is
   * as much a defect as a missing one.**
   *
   * ⚠️ **The other eight all map `index` and all author their palette explicitly**, because `index` is
   * load-bearing on this figure type rather than decorative: a locality-preserving rule visits each
   * sub-cube as a CONTIGUOUS index range, so `index` is a smooth 3-D gradient and a bracketed rule
   * bands by branch. `velocity` would be wrong twice over — the type declares `motion: 'static'`.
   *
   * ⚠️ `Curve Morph`'s palette is explicit because its look is `Customize`, which **adopts
   * nothing** — it is an edit mode, so the pair has to be authored or there is no palette at all.
   */
  'Curve Lattice': 'Prismatic',
  'Curve Descent': 'Cycle: Azure',
  // ⚠️ Was `Pastel`; the owner's finetuned export `Curve Gasket_20261105_075416.json` moved it to
  // `Cycle: Starfield` — an owner-authored palette, declared here from that export.
  'Curve Gasket': 'Cycle: Starfield',
  'Curve Island': 'Ocean',
  'Curve Thicket': 'Warm',
  'Curve Volume': 'Neon',
  'Curve Tilt': 'Prismatic',
  'Curve Morph': 'Neon',
  /*
   * ─── 2026-11-04 — the FIVE rule-coverage demos ────────────────────────────────────────────────
   *
   * Five of the thirteen rules carried a demo and `Hilbert 3D` carried five of the nine, so these
   * five add `Moore`, `Terdragon`, `Dragon`, `Levy C` and `Hilbert 2D`. ⚠️ **Chosen on the RENDER,
   * not on registry coverage:** four of the eight uncovered rules were refused — `Sierpinski-Knopp`
   * is `Levy C` mirrored (its own `provenance` says so and the render confirms it), `Bush 3D`'s yaw
   * is measured inert with its review owed, and `Peano` would be the third square maze.
   *
   * ⚠️ All five author `index` for the reason the block above states, and all five author the pair
   * EXPLICITLY: the palette is the demo's own choice and must not move when a look's bundle changes.
   * As authored none of their looks was `Customize`; the owner's 2026-11-05 finetunes moved `Curve
   * Weave` and `Curve Plane Dive` to it, which adopts nothing — so for those two the explicit pair is
   * now the ONLY palette they have, not merely the preferred one.
   *
   * ⚠️ **`Classic: ice` arrives here as a palette with ONE carrier**, which the NOTE below flags for
   * the 21.3 review. That is the note working, not a defect — but if `Curve Plane Dive` is ever cut,
   * the palette loses its only carrier and this row must go with it.
   */
  'Curve Weave': 'Cycle: Indigo',
  'Curve Triad': 'Aurora',
  // ⚠️ Declared `Cycle: Solar` first and the body moved to `Fire` during the look pass — this clause
  // caught the stale declaration, which is the direction nobody expects it to work in.
  'Curve Dragonfold': 'Fire',
  // (the `levyC` `Curve Scroll` declared `Pastel` here; the owner deleted it 2026-11-08 and the name now belongs to the
  // former `Curve Fold B`, declared below.)
  'Curve Plane Dive': 'Classic: ice',
  /*
   * ─── 2026-11-05 — v8 `39.A10`, the Stage A demos (Twist, Stretch, the new Koch / Minkowski rules, the Peano
   * zoom) ──────────────────────────────────────────────────────────────────────────────────────────────
   *
   * ⚠️ All ten take their LOOK from an owner-finetuned curve demo and author a DIFFERENT palette, so a family that
   * shares a parent stays distinct on the one axis the eye reads first. All map `index`, for the block above's
   * reason. `Curve Fold A` / `Curve Scroll` (`Curve Fold B` until 2026-11-08) share `Aurora` on purpose: they are a Mixer pair that must differ
   * ONLY in `twist`, so the crossfade plays the fold and nothing else.
   */
  'Curve Fold': 'Cycle: Solar',
  'Curve Fold A': 'Aurora',
  'Curve Scroll': 'Aurora',
  'Curve Koch Cesaro': 'Prismatic',
  'Curve Minkowski': 'Cycle: Indigo',
  'Curve Breathing Thicket': 'Warm',
  'Curve Spiral Thicket': 'Cycle: Azure',
  'Curve Peano Descent': 'Aurora',
  'Curve Hilbert Opening': 'Neon',
  'Curve Peano Fold': 'Pastel',
  /*
   * ─── 2026-11-05 — v8 Phase 40, the Electric Discharge demos. Each keeps its PARENT's authored palette unchanged
   * (`Quader Star Eight`, `Curve Weave`, `Curve Fold`), because the demo is about the effect, not a new look —
   * so these three rows restate their parents' declarations (a fourth demo, `Pipes Discharge`, was deleted 11-05).
   */
  'Quader Discharge': 'Cycle: Neutral',
  'Curve Weave Lightning': 'Cycle: Indigo',
  // ⚠️ 2026-11-08: `Curve Fold Discharge` was REPLACED by the owner's finetuned export, which maps `temperature`
  // (`Material: liquid`, `LiquidLight`) — so it LEAVES this `index` list.
  // 2026-11-05 — v8 `39.C7`, the Customize demo. ⚠️ 2026-11-08: REPLACED by the owner's finetuned export, which keeps
  // `index` but authors its OWN palette, `Material: liquid` (under a `Customize` look, no material).
  'Curve Rosette Chain': 'Material: liquid',
  // 2026-11-08 — the owner's own `Growing Corals` (`Curve Island` on Bush 3D, liquid): its OWN palette under `index`.
  'Growing Corals': 'Material: organic',
  // 2026-11-10 — v8 Phase 38, the Fractal Fold demos. `Fractal Butterfly` and `Fractal Star` author their OWN palettes
  // (a distinct colour per demo, owner); `Fractal Lattice` restates its parent `Curve Lattice`'s. `Fractal Cross` maps by
  // its base's look (`phase`), so it owes no row here.
  'Fractal Butterfly': 'Pastel',
  'Fractal Star': 'Warm',
  'Fractal Lattice': 'Prismatic',
  // 2026-11-13 (owner) — the four closed-tile rule demos and the `Customize` golden dragon: each takes its LOOK from an
  // owner-accepted curve demo and authors a DIFFERENT palette from its template (the `39.A10` rule above), all `index`.
  'Curve Snowflake': 'Cool',
  'Curve Pentigree': 'Sunset',
  'Curve Twindragon': 'Neon',
  'Curve Fudgeflake': 'Ocean',
  'Curve Golden Dragon': 'Warm',
  // 2026-11-13 — two more `Customize` demos ON TRIAL (owner review decides whether they stay). ⚠️ Twindragon, Golden Dragon,
  // Golden Lightning and Zigzag Cross were REPLACED the same day by the owner's finetuned exports (leaf-identical).
  'Curve Golden Lightning': 'Cycle: Solar',   // the owner's finetuned export, 2026-11-13
  'Curve Zigzag Cross': 'Sunset',   // the owner's finetuned export, 2026-11-13
  // 2026-11-13 — v8 Phase 37, the strand demos: each authors its OWN palette under `index`, because a gradient along
  // the stroke is the free half of the feature (the plan's demo table). Two of the four are the first presets ever
  // authored on their attractor type (`nose-hoover`, `halvorsen`).
  // ⚠️ 2026-11-13: `Lorenz Strand`, `Nosé-Hoover Fan` and `Halvorsen Thread` were REPLACED by the owner's finetuned
  // exports (verbatim) — the first two re-declared below; `Halvorsen Thread` now maps by its Customize look
  // (`velocity`), so it LEAVES this `index` list.
  'Lorenz Strand': 'Ocean',
  'Nosé-Hoover Fan': 'Fire',
  'Aizawa Overwound': 'Cycle: Azure',
  'Lorenz Strand Morph': 'Neon',
  // 2026-11-06 — v8 Phase 42 (revised to positions × copies at each), the 3-D Symmetry demos: each restates its
  // PARENT's authored palette unchanged (`Curve Morph`, `Curve Spiral Thicket`, `Curve Breathing Thicket`, `Curve Koch
  // Cesaro`, `Curve Hilbert Opening`, `Curve Tilt`) — the demo is about the arrangement. ⚠️ 2026-11-07: three were
  // REPLACED by the owner's finetuned exports — `Subdivide Sphere` now maps `index` (its parent maps `depth`), so it
  // gains a row with its own `Warm`; `Thicket Globe` now maps `phase` with `Sunset`, so it LEAVES this `index` list.
  // ⚠️ 2026-11-08: the other four were replaced too — `Morph Wreath` now authors its OWN `Midnight`; `Breathing Crown`
  // (`phase`, `Classic: thermal`) and `Tilt Octahedron` (`age`, `Ocean`) leave the `index` list; `Hilbert Tetra` keeps `Neon`.
  'Subdivide Sphere': 'Warm',
  'Morph Wreath': 'Midnight',
  'Cesaro Cube': 'Prismatic',
  'Hilbert Tetra': 'Neon',
  /*
   * ─── v8 `35.7`, 2026-10-30 — the ORIENTATION-ANGLE demos ──────────────────────────────────────
   *
   * ⚠️ **ONE row, and it is `Warp Split Shapes`' case inherited rather than a new one.**
   * `Warp Zoom Oblique` is that preset's body with both wave shapes removed and the ZOOM angle pair
   * turned 45°, so it keeps its parent's authored `palette: 'Cycle: Storm'` under `paletteMapping:
   * 'index'` and the demo family's grey pair ([128,128,128]/[128,128,128]). **No export behind it: it is
   * a TS body, and `MigrationLayer` never sees one — adoption only ever runs over the legacy JSON.**
   *
   * ⚠️ **MEASURED rather than pattern-matched from its parent, because `Cycle: Storm` IS one of the nine
   * and the name therefore proves nothing** (the `Waves II` / `Aizawa Torus Shell` hazard):
   * `cyclePaletteForPair` resolves the grey pair to `Cycle: Neutral`, which disagrees with the authored
   * name, so adoption could not have written it even in principle.
   *
   * ⚠️ **The other TWO `35.7` demos are DELIBERATELY ABSENT and adding either would create a phantom row
   * this clause also catches:** `Warp Oblique Ridge` and `Warp Chevron Score` author `palette: 'Aurora'`
   * under `paletteMapping: 'phase'`, so neither is in the named-`index` class at all.
   */
};
const pairPalette = (p) => cyclePaletteForPair(p.generators?.colorBase, p.generators?.colorAmp);
const namedIndex = indexBodies.filter((n) => !unnamedIndex.includes(n));
/**
 * The partition, and the undeclared members of the override class.
 *
 * ⚠️ **Taken as a FUNCTION of the body source so §I can seed a MIS-ADOPTION into it without touching `src/`** —
 * that is the one defect this narrowing could hide, so it is the one that has to be shown to be caught.
 */
const indexPartition = (bodyFor, declared) => {
  const adopted = namedIndex.filter((n) => bodyFor(n).overlay.palette === pairPalette(bodyFor(n)));
  const authored = namedIndex.filter((n) => !adopted.includes(n));
  const undeclared = authored.filter((n) => declared[n] !== bodyFor(n).overlay.palette);
  return { adopted, authored, undeclared };
};
const { adopted: migAdopted, authored: authoredIndex, undeclared: undeclaredIndex } =
  indexPartition((n) => LIB.get(n), AUTHORED_INDEX_PALETTES);
chk(`the ${namedIndex.length} named \`index\` bodies split into ${migAdopted.length} ADOPTED + `
  + `${authoredIndex.length} AUTHORED, and the authored ones are exactly the named list`,
  undeclaredIndex.length === 0 && authoredIndex.length === Object.keys(AUTHORED_INDEX_PALETTES).length,
  `authored: ${JSON.stringify(authoredIndex.map((n) => `${n} [${LIB.get(n).overlay.palette}]`))}, `
  + `declared: ${JSON.stringify(Object.keys(AUTHORED_INDEX_PALETTES))}. ⚠️ A body here that you did not expect is `
  + 'EITHER a new owner-authored palette (add it above, and say which export) OR a mis-adoption that wrote a name '
  + 'disagreeing with the body\'s own pair — those two look identical from here, so RESOLVE IT rather than '
  + 'declaring it');
// Every ADOPTED name must be one of the nine, and every AUTHORED one must at least be a real palette — a typo
// resolves to no `a`/`b` at all and silently falls back to the preset's own pair, i.e. to the correct picture by
// accident, so it is invisible except as a dropdown entry that does nothing.
const cycleNames = new Set(CYCLE_PALETTES.map((p) => p.name));
const badNames = [...new Set(migAdopted.map((n) => LIB.get(n).overlay.palette))].filter((n) => !cycleNames.has(n));
chk('...and every ADOPTED palette name is one of the nine `Cycle:` palettes',
  badNames.length === 0,
  badNames.length ? `NOT a Cycle palette: ${JSON.stringify(badNames)}`
    : `${new Set(migAdopted.map((n) => LIB.get(n).overlay.palette)).size} distinct names over `
    + `${migAdopted.length} bodies`);
// ⚠️ `getAllPaletteNames()` returns `[value, label]` PAIRS, not bare names — a `.includes(name)` over it is
// always false and reads as "no such palette" for every input, which is how this clause first went red.
const allPaletteValues = new Set(getAllPaletteNames().map(([v]) => v));
const unrealNames = authoredIndex.filter((n) => !allPaletteValues.has(LIB.get(n).overlay.palette));
chk('...and every AUTHORED index palette is a real name in the palette vocabulary',
  unrealNames.length === 0,
  unrealNames.length ? `no such palette: ${JSON.stringify(unrealNames.map((n) => LIB.get(n).overlay.palette))}`
    : `${authoredIndex.length} authored body/bodies, over the FULL vocabulary rather than the nine — an override `
    + 'is free to name any palette, so the `Cycle:` clause above cannot be the typo catch for these');
// The other direction: a Cycle palette with no carrier is not a failure (it is a vocabulary entry), but it is
// worth saying, because `21.D3` justified each of the nine by the presets that SHARE its pair.
const orphanCycles = CYCLE_PALETTES.map((p) => p.name).filter((n) => !adoptedByName.has(n));
if (orphanCycles.length) note(`Cycle palette(s) with no carrier in the library: ${orphanCycles.join(', ')}`);
const single = [...adoptedByName].filter(([, l]) => l.length === 1).map(([n]) => n);
if (single.length) {
  note(`Cycle palette(s) carried by exactly ONE preset: ${single.join(', ')} — 21.D3's argument for naming a `
    + 'pair was that it is SHARED, so a name that falls to one carrier is a candidate for the 21.3 review');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. the nine palettes: ONE declaration, exact `/255` authoring, and an exact inverse ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
chk(`\`CYCLE_PALETTES\` declares ${CYCLE_PALETTES.length} entries and every name carries the stored prefix`,
  CYCLE_PALETTES.length > 0 && CYCLE_PALETTES.every((p) => p.name.startsWith(CYCLE_PALETTE_PREFIX)),
  `prefix ${JSON.stringify(CYCLE_PALETTE_PREFIX)} — the prefix is the STORED word and the label drops it`);
chk('...and no two of them are the same pair',
  new Set(CYCLE_PALETTES.map((p) => `${p.a.join(',')}|${p.b.join(',')}`)).size === CYCLE_PALETTES.length,
  'two names for one pair would make the reverse lookup order-dependent — the first match would win silently');
chk('...and none collides with a curated cosine or a legacy gradient name',
  CYCLE_PALETTES.every((p) => !COSINE_PALETTES.some((c) => c.name.toLowerCase() === p.name.toLowerCase())
    && !LEGACY_PALETTES.some((l) => l.name === p.name)),
  `${COSINE_PALETTES.length} cosine + ${LEGACY_PALETTES.length} legacy names checked — `
  + '`getPaletteLUT`\'s cosine lookup is CASE-INSENSITIVE and runs after the Cycle table, so a collision '
  + 'would be resolved by table order rather than by the name');
/*
 * ⚠️ **THE 1-LSB ASSERTION, and it is the one the whole step rests on.** `Cycle: Neutral`'s `128/255` is
 * `0.50196…`, and `Monochrome`'s `0.5` is a DIFFERENT palette — it reaches the 8-bit output one level low.
 * Asserted by requiring every component to be an exact multiple of `1/255` in the sense that
 * `x * 255` is a value the library actually authors (an integer, or `32.5`, which one preset really carries),
 * NOT by comparing against a rounded decimal. A palette authored `0.5` fails here and nowhere else.
 */
const notOn255 = [];
for (const p of CYCLE_PALETTES) {
  for (const [k, v] of [['a', p.a], ['b', p.b]]) {
    for (let c = 0; c < 3; c++) {
      const x = v[c] * 255;
      // `x * 2` integral admits the authored `32.5` and rejects `0.5 → 127.5`… so the half-step must be
      // asserted as a NAMED exception rather than as a tolerance, or `0.5` (127.5) would pass as a half.
      const half = Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;
      const whole = Math.abs(x - Math.round(x)) < 1e-9;
      if (!whole && !(half && Math.abs(x - 32.5) < 1e-9)) notOn255.push(`${p.name}.${k}[${c}] = ${v[c]} (×255 = ${x})`);
    }
  }
}
chk('every component is authored as an exact `/255` division (the 1-LSB rule)',
  notOn255.length === 0,
  notOn255.length ? notOn255.join('; ')
    : 'incl. `Cycle: Storm`\'s 32.5/255, which is genuinely non-integer in the library and is the ONE named '
    + 'half-step. ⚠️ `Cycle: Neutral` is 128/255 = 0.50196…, NOT `Monochrome`\'s 0.5 — a two-decimal rewrite '
    + 'of either family shifts the 8-bit output by 1 level, which no visual review can see and §C fails on');
/*
 * The round trip both directions, which is what makes an adoption bit-identical: the 0–255 domain the preset
 * stores, through the `/255` authoring, back out through `getIndexPaletteAB`'s `* 255`.
 */
const rtBad = [];
for (const p of CYCLE_PALETTES) {
  const ab = getIndexPaletteAB(p.name);
  if (!ab) { rtBad.push(`${p.name}: getIndexPaletteAB returned null`); continue; }
  for (let c = 0; c < 3; c++) {
    if (ab.base[c] !== p.a[c] * 255) rtBad.push(`${p.name}.a[${c}]`);
    if (ab.amp[c] !== p.b[c] * 255) rtBad.push(`${p.name}.b[${c}]`);
  }
}
chk('`getIndexPaletteAB` returns the 0–255 domain LOSSLESSLY for all nine',
  rtBad.length === 0, rtBad.length ? rtBad.join(', ') : '(x/255)*255 === x exactly for every authored component');
/*
 * `cyclePaletteForPair` is the reverse, and its rule is EXACT EQUALITY. Two-sided: every palette's own pair
 * must be found, and the near-miss the header names must NOT be.
 */
const fwdBad = CYCLE_PALETTES.filter((p) => cyclePaletteForPair(p.a.map((x) => x * 255), p.b.map((x) => x * 255)) !== p.name);
chk('`cyclePaletteForPair` is the exact inverse over all nine',
  fwdBad.length === 0, fwdBad.length ? fwdBad.map((p) => p.name).join(', ') : 'each pair finds its own name');
chk('...and rejects a partial, a short and an absent vector rather than throwing',
  cyclePaletteForPair(undefined, undefined) === null
  && cyclePaletteForPair([128, 128], [128, 128, 128]) === null
  && cyclePaletteForPair([128, 128, 128], undefined) === null,
  'an imported body can carry a 2-element colorBase; `null` is the normal answer and means "use the pair"');
/*
 * ⚠️ **THE NEAR-MISS, stated as a MEASUREMENT of the gap rather than as "they differ".** `21.D3` chose exact
 * equality because of this pair specifically, and a later "let's tolerate float noise" edit is the regression
 * this clause exists to catch. The gap is reported in the 0–255 domain so its size is legible.
 */
const azure = CYCLE_PALETTES.find((p) => p.name === 'Cycle: Azure');
const nearMiss = NAMES
  .map((n) => ({ n, g: LIB.get(n).generators }))
  .filter(({ g }) => g?.colorBase && g?.colorAmp && azure
    && cyclePaletteForPair(g.colorBase, g.colorAmp) === null
    && g.colorBase.every((x, c) => x === azure.a[c] * 255));
chk('...and does NOT match a pair that agrees on `base` but not on `amp` (the tolerance trap)',
  nearMiss.length > 0 && nearMiss.every(({ g }) => cyclePaletteForPair(g.colorBase, g.colorAmp) === null),
  nearMiss.length
    ? `${nearMiss.length} such body/bodies: ` + nearMiss.map(({ n, g }) =>
      `"${n}" amp [${g.colorAmp}] vs Cycle: Azure [${azure.b.map((x) => x * 255)}] — worst component gap `
      + `${Math.max(...g.colorAmp.map((x, c) => Math.abs(x - azure.b[c] * 255)))}/255`).join('; ')
    : '⚠️ NO carrier of this shape in the library any more, so this clause asserts NOTHING and the exact-'
    + 'equality rule has lost its live witness. Re-derive the near-miss before trusting the §I seed alone');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. parity: an adopted preset renders BYTE-IDENTICALLY, through the REAL colour law ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * The claim `21.4d` rests on, measured rather than argued. For each `index` body: build the generator from the
 * preset's own `generators` block, ask it for the population's colours WITH the resolved index palette and
 * WITHOUT one, and compare the 8-bit results. `setIndexPalette(null)` IS the pre-adoption state — it is what
 * every preset in the library did before this step — so the two runs are literally before and after.
 *
 * ⚠️ **8-bit, because that is the channel the difference has to survive.** A float comparison would fail on
 * ordinary rounding noise and a "close enough" epsilon would swallow the 1-LSB defect §B exists to catch.
 * `Math.round(v * 255)` is the quantisation the display performs.
 */
const SWATCH_N = 64;
const toBytes = (floats) => {
  const out = new Uint8Array(floats.length);
  for (let i = 0; i < floats.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, floats[i])) * 255);
  return out;
};
const genFor = (p) => {
  const g = p.generators;
  const gen = new LissajousGenerator();
  gen.init({
    type: 'lissajous',
    particleCount: Math.max(10, Math.min(2000, g.particleCount ?? 1000)),
    waves: g.waves ?? [],
    waveSpeed: g.waveSpeed ?? 0.05,
    rotation: g.rotation ?? [0, 0, 0],
    angle: g.angle ?? [0, 0, 0],
    colorBase: g.colorBase ?? [128, 128, 128],
    colorAmp: g.colorAmp ?? [128, 128, 128],
    colorFreq: g.colorFreq ?? [0.1, 0.1, 0.1],
    colorShift: g.colorShift ?? [0.1, 0.1, 0.1],
    designResolution: p.metadata?.designResolution ?? { width: 100, height: 100 },
  }, { width: 256, height: 192 });
  return gen;
};
/**
 * Every (body, pos) disagreement between the adopted and unadopted colour law.
 *
 * Taken as a FUNCTION of the a/b source so §I can seed a wrong palette into it without touching `src/`. The
 * seeded defect is a palette that is one level off — the failure a visual review cannot see.
 */
const parityViolations = (names, abFor) => {
  const out = [];
  for (const n of names) {
    const p = LIB.get(n);
    if (!p.generators?.colorBase || !p.generators?.colorAmp) continue;
    const sel = selectionFor(p);
    const ab = abFor(sel, p);
    const gen = genFor(p);
    for (const pos of POS_SAMPLES) {
      gen.setIndexPalette(null);
      const before = toBytes(gen.sampleIndexColours(SWATCH_N, pos));
      gen.setIndexPalette(ab);
      const after = toBytes(gen.sampleIndexColours(SWATCH_N, pos));
      let worst = 0;
      for (let i = 0; i < before.length; i++) worst = Math.max(worst, Math.abs(before[i] - after[i]));
      if (worst !== 0) out.push(`${n} @pos=${pos} worst ${worst}/255`);
    }
  }
  return out;
};
// ⚠️ **The basis is the ADOPTED bodies plus the unnamed ones, NOT every `index` body** — see the partition
// above. An authored override changes the appearance ON PURPOSE, so including it asserts the negation of its
// reason for existing. The unnamed ones stay in because they resolve to a null palette and therefore assert
// that `setIndexPalette(null)` is genuinely the unadopted path rather than a no-op.
/*
 * ⚠️⚠️ **AND *UNNAMED* IS NOT *RESOLVES TO NOTHING* — THAT ASSUMPTION WAS THIS CLAUSE'S BASIS AND IT WAS
 * FALSIFIED BY A NEW BODY ON 2026-10-31.** The sentence above says the unnamed bodies *"resolve to a null
 * palette"*; `unnamedIndex` actually means *authors no `overlay.palette`*, and the two parted company the
 * moment a preset mapped `index` while taking its palette from its FILM LOOK. The owner's finetuned
 * `Quader Torus Knot` does exactly that — `paletteMapping: 'index'` in the overlay, `palette: 'Neon'` inside
 * its `Customize` bundle — so it resolves to the `Neon` index palette and renders **202/255** away from its
 * own `colorBase`/`colorAmp`. **The clause went red, the ENGINE was right, and the preset is right: a look
 * supplies the palette when the preset does not override it, which is the documented precedence.**
 *
 * **So the basis is now the RESOLVED one** (`indexPalette === null`), which is what the sentence always
 * claimed. ⚠️ **The excluded set gets its own clause below rather than a silent filter** — narrowing a basis
 * without naming what left it is indistinguishable from the defect this section exists to catch, and it is
 * the same rule the AUTHORED exclusion already follows two clauses down.
 */
const lookSuppliedIndex = unnamedIndex.filter((n) => selectionFor(LIB.get(n)).indexPalette !== null);
const parityBasis = [...migAdopted, ...unnamedIndex.filter((n) => !lookSuppliedIndex.includes(n))];
const parityBad = parityViolations(parityBasis, (sel) => sel.indexPalette);
/*
 * ⚠️⚠️ **THE EXCLUSION, BY NAME AND IN BOTH DIRECTIONS — added 2026-10-31 with the basis repair above.** A body
 * that maps `index` while its FILM LOOK supplies the palette is in the same class as an AUTHORED override: its
 * appearance differs from its own pair ON PURPOSE, so the parity clause must not run over it — but the set must
 * be NAMED, or the next basis narrowing is invisible.
 *
 * ⚠️ **Both halves matter.** An EMPTY set would mean the repair above is inert and the clause is asserting
 * nothing new (fine today, a trap the moment such a body exists again) — so the set is printed either way, and
 * the clause asserts that every member genuinely RESOLVES to an index palette, which is the property that put
 * it here. **It does NOT assert that the colour differs**: a look whose palette happened to equal the body's
 * own pair would be in this set and would be parity-identical, and that is a legitimate state.
 */
const lookSuppliedBad = lookSuppliedIndex.filter((n) => {
  const sel = selectionFor(LIB.get(n));
  return sel.indexPalette === null || sel.mapping !== 'index' || LIB.get(n).overlay?.palette !== undefined;
});
chk(`...and the ${lookSuppliedIndex.length} \`index\` body/bodies whose PALETTE comes from the film look are excluded by name`,
  lookSuppliedBad.length === 0,
  lookSuppliedBad.length
    ? `misclassified: ${lookSuppliedBad.join(', ')} — each should author NO \`overlay.palette\`, map \`index\`, `
      + 'and still resolve to a real index palette'
    : lookSuppliedIndex.length === 0
      ? '⚠️ NONE TODAY — the basis repair of 2026-10-31 is inert, so re-derive it before trusting the parity '
        + 'clause over a library that has gained a look-supplied `index` body'
      : `[${lookSuppliedIndex.map((n) => `${n} → ${selectionFor(LIB.get(n)).name}`).join(', ')}] — the palette `
        + 'comes from the look and the MAPPING from the overlay, which is the documented precedence rather than '
        + 'a defect. `Quader Torus Knot` (2026-10-31) is the first such body and measured 202/255 from its own '
        + 'pair, which is what the old basis read as a parity failure');
chk(`${parityBasis.length} ADOPTED/unnamed \`index\` bodies × ${POS_SAMPLES.length} instants: the adopted palette `
  + "and the preset's own pair produce IDENTICAL 8-bit colour",
  parityBad.length === 0,
  parityBad.length ? `${parityBad.length} disagreement(s): ${parityBad.slice(0, 5).join(', ')}`
    : `instants ${JSON.stringify(POS_SAMPLES)} (never 0 — invariant 28), ${SWATCH_N} samples each, through `
    + '`LissajousGenerator.sampleIndexColours` — the SAME `writeColourAt()` the per-particle loop uses. '
    + '⚠️ This is the one assertion that makes "21.4d edits no preset\'s appearance" a measurement, and it says '
    + `nothing about the ${authoredIndex.length} AUTHORED override(s), which are excluded by construction`);
// ⚠️ **And the exclusion needs its own assertion, or narrowing the basis would be indistinguishable from
// dropping the clause.** An authored override must actually DIFFER from the preset's own pair: if it agreed, the
// owner's palette pick would be doing nothing and the entry in `AUTHORED_INDEX_PALETTES` would be describing a
// control that cannot move the picture (invariant 13). So the excluded bodies are asserted to be exactly the
// ones the clause above would have failed on.
const authoredParity = parityViolations(authoredIndex, (sel) => sel.indexPalette);
chk(`each of the ${authoredIndex.length} AUTHORED override(s) genuinely DIFFERS from the preset's own pair`,
  authoredIndex.length === 0 || authoredParity.length >= authoredIndex.length,
  authoredParity.length ? `${authoredParity.length} difference(s) over ${authoredIndex.length} body/bodies: `
    + `${authoredParity.slice(0, 4).join(', ')}`
    : '⚠️ an override that matches its pair is either a redundant authoring or evidence the partition above put '
    + 'an ADOPTED body in the wrong class');
/*
 * ⚠️ **The clamp is part of a palette's identity, and this clause proves the parity test above could SEE it.**
 * `Cycle: Shadowed` is `a = 0`, so half its cycle clamps to black; if either side of the comparison dropped
 * the clamp, the difference would be a change in the gradient's SHAPE rather than its brightness (invariant
 * 9's signature — the kind a visual review passes). Asserted by counting clamped samples: a parity test over
 * a population that never clamps would be blind to the clamp entirely.
 */
let clampedLow = 0, clampedHigh = 0, sampled = 0;
for (const n of indexBodies) {
  const p = LIB.get(n);
  if (!p.generators?.colorBase) continue;
  const g = p.generators;
  for (let c = 0; c < 3; c++) {
    sampled++;
    if (g.colorBase[c] - g.colorAmp[c] < 0) clampedLow++;
    if (g.colorBase[c] + g.colorAmp[c] > 255) clampedHigh++;
  }
}
chk('...and the population the comparison runs over DOES exercise the clamp, both ends',
  clampedLow > 0 && clampedHigh > 0,
  `${clampedLow} channel(s) clamp low and ${clampedHigh} clamp high across ${sampled} channels. `
  + 'Without both, the parity test would be measuring the unclamped law and a divergent clamp would pass');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. the migration: three conditions, each with its own failure, and idempotence ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * `MigrationLayer.adoptIndexPalette()` adopts only where all three hold. Each clause below removes ONE of them
 * from a fixture and asserts the adoption does not happen — the three conditions are not interchangeable and a
 * single "does it adopt?" test would pass with two of them deleted.
 */
const migrated = (body) => MigrationLayer.migrate('__fixture__', JSON.parse(JSON.stringify(body)));
/** A body that DOES get adopted, borrowed from the library so the fixture is never hand-invented. */
const donorName = [...adoptedByName.values()][0]?.[0];
const donor = donorName ? LIB.get(donorName) : null;
chk('a fixture donor exists — an adopted body to strip conditions from',
  !!donor, donorName ? `"${donorName}" → ${donor.overlay.palette}` : 'NO adopted body: every clause below is vacuous');
if (donor) {
  /** The donor with its adoption undone, i.e. what the migration was handed. */
  const virgin = () => {
    const b = JSON.parse(JSON.stringify(donor));
    delete b.overlay.palette;
    delete b.overlay.paletteMapping;
    return b;
  };
  chk('the donor, re-migrated from its pre-adoption state, is adopted again',
    migrated(virgin()).overlay?.paletteMapping === 'index'
    && migrated(virgin()).overlay?.palette === donor.overlay.palette,
    'if this fails, every NEGATIVE clause below passes for the wrong reason');
  // Condition 1 — idempotence. An already-authored mapping is never touched, in EITHER field.
  const handNone = virgin();
  handNone.overlay.palette = 'none';
  chk('...but a HAND-AUTHORED `palette: \'none\'` survives re-migration untouched',
    migrated(handNone).overlay?.palette === 'none' && migrated(handNone).overlay?.paletteMapping === undefined,
    '⚠️ `\'none\'` is a real authored choice ("no palette"), NOT the absence of one — the gate tests '
    + '`!== undefined`, and a truthiness test here is the whole defect in one character: it would overwrite '
    + 'the user\'s explicit "no palette" on every load');
  const handMapping = virgin();
  handMapping.overlay.paletteMapping = 'depth';
  chk('...and an authored MAPPING alone also blocks adoption (two fields, two ways in)',
    migrated(handMapping).overlay?.paletteMapping === 'depth' && migrated(handMapping).overlay?.palette === undefined,
    'a preset that chose `depth` must not be given `index` because its pair happens to match');
  // Condition 2 — a palette already owns the colour.
  const withLook = virgin();
  const lookWithPalette = Object.keys(FILM_LOOKS).find((k) => (FILM_LOOKS[k].palette ?? 'none') !== 'none');
  withLook.overlay.filmLook = lookWithPalette;
  chk(`...and a body whose film look supplies a palette ("${lookWithPalette}") is NOT adopted`,
    migrated(withLook).overlay?.paletteMapping === undefined,
    '⚠️ MEASURED, not assumed: adopting on these would replace a LUT-mapped picture with the generator\'s own '
    + 'colours — a mass restyle of a fifth of the library, and every one of them would still LOOK like a '
    + 'plausible preset. This is the condition the first draft of 21.4d did not have');
  // Condition 3 — does the law reach the screen at all? (The honesty condition.)
  const notPointPath = virgin();
  notPointPath.overlay.renderMode = 'volume';
  delete notPointPath.overlay.ribbonMode;
  notPointPath.overlay.linesEnabled = false;
  chk('...and a body on a non-point path (`volume`) is NOT adopted, even with a matching pair',
    migrated(notPointPath).overlay?.paletteMapping === undefined,
    'the per-particle law does not reach `volume`/`liquid`/`splat` output, so naming a palette there would be '
    + 'a LIE in the UI rather than a change in the picture — 21.4f labels these `None`');
  const withMaterial = virgin();
  withMaterial.overlay.material = { preset: 'Fire', colourRamp: 'fire' };
  chk('...and a body with a LIVE material is NOT adopted (the material owns the mode)',
    migrated(withMaterial).overlay?.paletteMapping === undefined,
    '`materialRequestedRenderMode()` returns `splat` for eight of the nine materials and `liquid` for the '
    + 'ninth, so a live material can never yield a point path — the condition reads the material rather than '
    + 're-implementing `resolveModeAgainstMaterial()`');
  const ribbonOnly = virgin();
  ribbonOnly.overlay.renderMode = 'volume';
  ribbonOnly.overlay.linesEnabled = true;
  chk('...but a RIBBON/LINES path rescues a non-point mode, because it reads `state.colors` too',
    migrated(ribbonOnly).overlay?.paletteMapping === 'index',
    'the trajectory renderers take the generator\'s colours through `TrajectoryPalette.resolve()`\'s '
    + 'pass-through, so the law does reach the screen there');
  // The fields the migration may NEVER remove: the pair IS the fallback, and 21.4e's two controls edit it.
  const after = migrated(virgin());
  chk('...and adoption never deletes `colorBase`/`colorAmp`/`colorFreq`/`colorShift`',
    ['colorBase', 'colorAmp', 'colorFreq', 'colorShift']
      .every((k) => JSON.stringify(after.generators[k]) === JSON.stringify(donor.generators[k])),
    'the quadruple is the fallback when no palette resolves, the two RATE vectors are 21.4e\'s controls, and '
    + 'Export/Snapshot byte-identity depends on all four surviving');
}
/*
 * Idempotence over the WHOLE library, which is what a re-import does: `migrate` runs on every load path, so a
 * body that drifts on the second pass drifts a little more on every subsequent one.
 */
const drifted = NAMES.filter((n) => {
  const once = LIB.get(n);
  return JSON.stringify(MigrationLayer.migrate(n, JSON.parse(JSON.stringify(once)))) !== JSON.stringify(once);
});
chk(`re-migrating all ${NAMES.length} composed bodies changes NONE of them`,
  drifted.length === 0,
  drifted.length ? `${drifted.length} drifted: ${drifted.slice(0, 5).join(', ')}`
    : '`migrate` runs on both load paths and inside `export-library.mjs`, so non-idempotence would compound');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. the `index` guard — BOTH directions, and the shader fallthroughs that make it load-bearing ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A test that only checks `shaderPalette` passes with `shaderMappingInt` wired to 6.** The shader's chain
 * ends in an `else`, so an unmatched int selects a mapping rather than doing nothing — which is why the
 * resolver returns both guards and why both are asserted here.
 */
const MAPPINGS = PALETTE_MAPPING_ORDER;
const idxSel = resolvePaletteSelection({ palette: 'Cycle: Solar', paletteMapping: 'index' }, undefined);
chk('under `index` the resolver returns BOTH guards',
  idxSel.shaderPalette === 'none' && idxSel.shaderMappingInt === PALETTE_MAPPING_OFF && idxSel.indexPalette !== null,
  `shaderPalette=${JSON.stringify(idxSel.shaderPalette)}, shaderMappingInt=${idxSel.shaderMappingInt} `
  + `(PALETTE_MAPPING_OFF=${PALETTE_MAPPING_OFF}), indexPalette.kind=${idxSel.indexPalette?.kind}`);
chk('...and `PALETTE_MAPPING_OFF` is NEGATIVE, so it can match no shader branch',
  PALETTE_MAPPING_OFF < 0 && MAPPINGS.filter((m) => m !== 'index').every((m) => paletteMappingToInt(m) >= 0),
  `6 would be an unmatched int too, but it is the NEXT free branch index — a later shader edit adding a sixth `
  + 'LUT mapping would claim it silently. A negative can never be claimed');
chk('...and the other six mappings each keep a DISTINCT non-negative int and pass their palette through',
  new Set(MAPPINGS.filter((m) => m !== 'index').map(paletteMappingToInt)).size === MAPPINGS.length - 1
  && MAPPINGS.filter((m) => m !== 'index').every((m) => {
    const s = resolvePaletteSelection({ palette: 'Cycle: Solar', paletteMapping: m }, undefined);
    return s.shaderPalette === 'Cycle: Solar' && s.indexPalette === null;
  }),
  'the negative direction: a guard that fired on every mapping would switch the palette off everywhere, which '
  + 'reads as "palettes stopped working" rather than as an index-mapping defect');
chk('...and a `Cycle:` palette is still a legal choice on the six LUT mappings',
  CYCLE_PALETTES.every((p) => getPaletteLUT(p.name) instanceof Uint8Array),
  'authored `c`/`d` exist for exactly this reason — without a LUT the nine would be a second-class family and '
  + 'the orthogonality 21.4b buys would be fictional');
/*
 * SOURCE-SHAPED. Both shaders' fallthrough branches are the reason the int guard matters, and they differ:
 * the main shader falls through to velocity, the TILE shader to temperature. A failure here means a shader was
 * edited, not that the resolver is wrong.
 */
const hdr = rd('src/renderers/hdr-particle.ts');
chk('the main fragment shader\'s mapping chain still ends in an `else` (velocity), matching no int explicitly',
  /else\s*\{\s*palCoord = vVelocity;\s*\}/.test(hdr),
  'if this ever becomes a `switch` with no default, an unmatched int leaves `palCoord` UNINITIALISED — which '
  + 'in GLSL is a value, not an error');
const tile = rd('src/ui/preview-grid/grid-tile-renderer.ts');
chk('...and the TILE shader falls through to TEMPERATURE, which is why the tile needs no-LUT rather than an int',
  /float paletteCoord\(float temp\)\s*\{[\s\S]{0,400}?return temp;\s*\}/.test(tile),
  '⚠️ The two fallthroughs are DIFFERENT. On a tile with no material `temperatures[]` is absent, so an '
  + 'unmatched int there is one flat colour across the whole figure — not a wrong gradient, a wrong picture');
/*
 * ⚠️ **INVARIANT 28, asserted algebraically rather than trusted.** The swatch samples ONE instant. A "ghost"
 * is an instant at which `pos · shift[c] ≡ 0 (mod 2π)` on every channel, where the swatch would show the same
 * ramp whatever `Colour Drift` said and the control would read inert while working.
 */
const driftMax = Math.max(0, ...NAMES.map((n) => {
  const s = LIB.get(n).generators?.colorShift;
  return s ? Math.max(...s.map(Math.abs)) : 0;
}));
chk(`\`INDEX_SWATCH_POS\` is ${INDEX_SWATCH_POS} and no authored drift can complete a full turn by then`,
  INDEX_SWATCH_POS !== 0 && driftMax * INDEX_SWATCH_POS < 2 * Math.PI,
  `max |colorShift| in the library ${driftMax}; ${driftMax} × ${INDEX_SWATCH_POS} = `
  + `${(driftMax * INDEX_SWATCH_POS).toFixed(4)} < 2π = ${(2 * Math.PI).toFixed(4)}. ⚠️ At pos = 2π every `
  + 'channel authoring shift = 1 IS a ghost, so a larger instant reintroduces the risk — and a quarter period '
  + 'is the tempting near-miss invariant 28 names');
/*
 * The same invariant from the other side, MEASURED: at pos = 0 the drift is provably invisible, so a swatch
 * drawn there would be the same picture for two different `Colour Drift` settings.
 */
const ghostProbe = (pos) => {
  const p = JSON.parse(JSON.stringify(LIB.get(NAMES.find((n) => LIB.get(n).generators?.colorShift))));
  const g = genFor(p);
  const a = toBytes(g.sampleIndexColours(SWATCH_N, pos));
  const p2 = JSON.parse(JSON.stringify(p));
  p2.generators.colorShift = [1.7, 0.9, 2.3];
  const b = toBytes(genFor(p2).sampleIndexColours(SWATCH_N, pos));
  return a.some((x, i) => x !== b[i]);
};
chk('...and at `pos = 0` two DIFFERENT drifts are provably indistinguishable, while at the chosen instant they are not',
  ghostProbe(0) === false && ghostProbe(INDEX_SWATCH_POS) === true,
  'this is the falsification of the instant, not a restatement of it: a checker that only asserted '
  + '`INDEX_SWATCH_POS !== 0` would pass with the swatch drawing at 0 anyway');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. ONE resolution order — invariant 17, over the four readers ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **SOURCE-SHAPED, and the only instrument for the defect whose last instance was found by NOT grepping.**
 * Invariant 17's write-up says it plainly: *grepping the readers exonerated the buggy file*. So these clauses
 * do not check that each reader looks right — they check that no reader RESOLVES at all. `paletteMappingToInt`
 * is the tell: it converts the stored word to the shader's int, which is precisely the decision the resolver
 * owns, and a reader that calls it has its own chain whatever the chain looks like.
 */
const RESOLVER = 'src/renderers/palette-selection.ts';
const READERS = [
  ['src/main.ts', 'the main view (renderer + both trajectory renderers + the generator)'],
  ['src/ui/preview-grid/grid-tile-renderer.ts', 'the preview grid — added 21.4c; it was the reader that had been left behind'],
];
const intCallers = [];
for (const f of ['src/main.ts', 'src/ui/preview-grid/grid-tile-renderer.ts', 'src/ui/synthesis-lab/tabs/visual-fx.ts',
  'src/renderers/hdr-particle.ts', 'src/renderers/ribbon-renderer.ts', 'src/renderers/neon-line-renderer.ts',
  'src/renderers/trajectory-palette.ts', 'src/exploration/interpolate.ts']) {
  if (/paletteMappingToInt\s*\(/.test(stripComments(rd(f)))) intCallers.push(f);
}
chk('`paletteMappingToInt` is CALLED from exactly one place — the resolver',
  intCallers.length === 0,
  intCallers.length ? `also called from: ${intCallers.join(', ')} — that file has its own chain`
    : `declared in film-looks.ts, called only in ${RESOLVER}. A second caller is a second resolution order, `
    + 'and invariant 17 is that two orders do not announce themselves');
for (const [f, why] of READERS) {
  const src = stripComments(rd(f));
  chk(`${f} resolves through \`resolvePaletteSelection\` — ${why}`,
    /resolvePaletteSelection\s*\(/.test(src),
    'this reader pushes a palette at the pipeline, so it must read BOTH sources in the resolver\'s order');
}
chk('...and both of them hand the GENERATOR the resolved `indexPalette` (the CPU half)',
  READERS.every(([f]) => /setIndexPalette\(/.test(stripComments(rd(f)))),
  '⚠️ The tile runs a REAL `LissajousGenerator`, so withholding this would make the tile draw the preset\'s '
  + 'own quadruple while the main view drew the palette\'s — a colour SOURCE divergence, which is the D16 '
  + 'defect and is NOT covered by the C7 reduced-fidelity decision');
/*
 * The two dropdowns store `''` for "not overridden" and `'none'` for "no palette", and those are different
 * answers. The resolver is the only place that knows; asserted as behaviour, because a `??`-only chain reads
 * correctly and silently turns an unset dropdown into "palette off".
 */
const look = { palette: 'Neon', paletteMapping: 'phase' };
chk('`PALETTE_UNSET` (`\'\'`) inherits the film look\'s palette; `\'none\'` overrides it OFF',
  resolvePaletteSelection({ palette: PALETTE_UNSET, paletteMapping: undefined }, look).name === 'Neon'
  && resolvePaletteSelection({ palette: undefined, paletteMapping: undefined }, look).name === 'Neon'
  && resolvePaletteSelection({ palette: 'none', paletteMapping: undefined }, look).name === 'none',
  `PALETTE_UNSET=${JSON.stringify(PALETTE_UNSET)} — a plain \`??\` makes the first case return \`''\`, which `
  + '`getPaletteLUT` reads as no palette: one character between "the look still applies" and "the look '
  + 'silently stopped applying"');
chk('...and the MAPPING falls back independently of the palette',
  resolvePaletteSelection({ palette: 'Cycle: Solar', paletteMapping: undefined }, look).mapping === 'phase'
  && resolvePaletteSelection({ palette: undefined, paletteMapping: 'index' }, look).mapping === 'index'
  && resolvePaletteSelection(undefined, undefined).mapping === 'depth',
  'two fields, two independent gates — the pair is snapped together by the MIXER (21.4c) but resolved apart');
chk('every mapping has a LABEL and the order lists each exactly once',
  MAPPINGS.length === new Set(MAPPINGS).size
  && MAPPINGS.every((m) => typeof PALETTE_MAPPING_LABELS[m] === 'string' && PALETTE_MAPPING_LABELS[m].length > 0)
  && Object.keys(PALETTE_MAPPING_LABELS).length === MAPPINGS.length,
  `${MAPPINGS.length} mappings; \`index\` is LAST in the dropdown order (${MAPPINGS[MAPPINGS.length - 1]}) — a `
  + '`Record<PaletteMapping, string>` is what makes `tsc` demand a label for a new member, but nothing makes '
  + 'it demand an ORDER entry');
chk('...and no stored mapping word leaks a label, nor a label a stored word',
  MAPPINGS.every((m) => !NAMES.some((n) => LIB.get(n).overlay?.paletteMapping === PALETTE_MAPPING_LABELS[m])),
  'a label persisted, or a stored word printed, is the defect — the same rule the Reel\'s `REEL_*_LABELS` '
  + 'carries. `temperature`\'s label holds a PRECONDITION and would be especially visible if stored');
const allPal = getAllPaletteNames();
chk(`\`getAllPaletteNames\` offers ${allPal.length} palettes, each stored value unique and no label stored`,
  new Set(allPal.map(([v]) => v)).size === allPal.length
  && allPal.every(([v, l]) => typeof l === 'string' && l.length > 0 && v !== l)
  && CYCLE_PALETTES.every((p) => allPal.some(([v]) => v === p.name)),
  `incl. all ${CYCLE_PALETTES.length} Cycle entries. A stored value equal to its label is how a family becomes `
  + 'unreachable by name — the defect `LEGACY_PALETTE_PREFIX` exists to prevent');

/*
 * ⚠️ **The clauses above are FILE-granular and that is not enough — a file can resolve correctly in one function
 * and read a raw source in another.** Found 2026-09-18, while documenting `16.4a`: `resolvePhysarumTrailLut()`
 * read `customFilmLookParams.palette`, which was the live palette while the film look was the only source.
 * `21.4a` added `overlay.palette` and left that function behind, so a palette chosen in the Colour Palette
 * section coloured the figure and **not** the physarum trail, while `main.ts` passed every clause above —
 * literally invariant 17's *grepping the readers exonerated the buggy file*, one scope smaller.
 *
 * So the instrument has to be a ban on reading a SOURCE, not a check that a resolver is called somewhere in the
 * file. The three legitimate mentions of a source field in `main.ts` are the two capture sites
 * (`overlayPalette = preset.overlay?.palette`) and `patch.palette !== undefined`, which is a *did this patch
 * touch the field* gate and not a colour decision — hence the specific forms below rather than `/\.palette/`.
 */
const mainSrc = stripComments(rd('src/main.ts'));
const rawSourceReads = [
  ['customFilmLookParams.palette', /customFilmLookParams\.palette(?!\s*=)/],
  ['customFilmLookParams.paletteMapping', /customFilmLookParams\.paletteMapping(?!\s*=)/],
  ['look.palette', /\blook\.palette\b/],
  ['look.paletteMapping', /\blook\.paletteMapping\b/],
  ['liveFilmLookParams().palette', /liveFilmLookParams\(\)\.palette/],
].filter(([, re]) => re.test(mainSrc)).map(([n]) => n);
chk('no function in `main.ts` reads a palette SOURCE for a colour decision — only the resolver does',
  rawSourceReads.length === 0,
  rawSourceReads.length ? `reads ${rawSourceReads.join(', ')} — a second reader of one of the two sources`
    : 'the only source mentions left are the two `overlayPalette = preset.overlay?.palette` captures, which feed '
    + 'the resolver, and `patch.palette !== undefined`, which is a change gate. A whole-file `resolvePaletteSelection` '
    + 'test cannot see this class: it passed while `resolvePhysarumTrailLut` had its own chain');
/*
 * The physarum trail is the FOURTH consumer and the only one that takes a LUT rather than a mapping, so it is
 * invisible to the `paletteMappingToInt` tell above — it never converts a mapping at all. Asserted on its body.
 */
const trailFn = /function resolvePhysarumTrailLut\(\)[\s\S]*?\n  \}/.exec(mainSrc);
chk('`resolvePhysarumTrailLut` reads the RESOLVED selection, and reads `name` rather than `shaderPalette`',
  !!trailFn && /livePaletteSelection\.name/.test(trailFn[0]) && !/shaderPalette/.test(trailFn[0]),
  '⚠️ `shaderPalette` is `\'none\'` by construction under the `index` mapping — that is how the LUT path is '
  + 'switched off for the three shader consumers — so reading it here would blank the trail\'s palette branch on '
  + `every one of the library's index bodies while the figure was visibly palette-coloured. ${
    trailFn ? '' : 'FUNCTION NOT FOUND — a rename makes this clause vacuous, which is worse than missing'}`);
chk('...and it still falls THROUGH `\'none\'` and `PALETTE_UNSET` to the material ramp, never to a black LUT',
  !!trailFn && /!==\s*'none'/.test(trailFn[0]) && /PALETTE_UNSET/.test(trailFn[0])
  && /MATERIAL_RAMP_PREFIX/.test(trailFn[0]),
  'the resolved `name` can be either word, and both mean "no ramp here" rather than "a ramp of nothing" — the '
  + 'pre-existing rule, which the source change had to preserve: 3 of the 15 named looks carry `palette: none`');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. 21.4f — the TWO honest inactive states, and the population each one describes ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * `21.4f` is the only part of `21.4` that ships **no** behaviour: it adds two labels. That makes it the easiest
 * part to get silently wrong, because a label cannot crash and a wrong one is indistinguishable from a right one
 * unless you know the population it is describing.
 *
 * The two states, and why they are NOT one state with a parameter:
 *
 *   - **`Preset colour (index)`** — the `index` mapping is live and no palette is named, so the generator reads
 *     the preset's own `colorBase`/`colorAmp`. The colour is REAL and the picture is bit-identical to what the
 *     preset always drew, which is exactly why it looks like nothing happened and why it needs saying.
 *   - **`None`** — nothing supplies a palette at all. True only where the colour law does not reach the screen
 *     (a live material, or `splat`/`volume`/`liquid`), which is the migration's honesty condition 3.
 *
 * ⚠️ **A label that is right for one population and wrong for the other is the defect, and it reads as a
 * documentation quibble rather than as a bug.** So this section measures the two populations through the REAL
 * resolver and then asserts, source-shaped, that the UI picks between them on `usesPresetQuadruple` — the
 * resolved fact — rather than on its own dropdown, which is one of two sources (invariant 17).
 */
const QUAD_LABEL = [];
const NAME_LABEL = [];
const NONE_LABEL = [];
for (const n of NAMES) {
  const s = selectionFor(LIB.get(n));
  if (s.mapping === 'index') (s.usesPresetQuadruple ? QUAD_LABEL : NAME_LABEL).push(n);
  else if (s.name === 'none' || s.name === PALETTE_UNSET) NONE_LABEL.push(n);
}
chk(`every one of the ${NAMES.length} bodies falls in exactly ONE of the three label states`,
  QUAD_LABEL.length + NAME_LABEL.length + NONE_LABEL.length
    + NAMES.filter((n) => {
      const s = selectionFor(LIB.get(n));
      return s.mapping !== 'index' && s.name !== 'none' && s.name !== PALETTE_UNSET;
    }).length === NAMES.length,
  `${QUAD_LABEL.length} read \`Preset colour (index)\`, ${NAME_LABEL.length} read a palette NAME, `
  + `${NONE_LABEL.length} read \`None\`, and the rest carry a LUT palette on one of the six other mappings — `
  + 'the fourth state, which has always had an honest label because the name IS the label');
/*
 * ⚠️ **The `Preset colour (index)` population is the unnamed-pair set, and the plan's count of it is
 * HISTORICAL.** `21.D3` named six singleton hues, a 2026-09-17 note cut it to five, and it measures FOUR today —
 * two bodies were re-keyed to carriers of a palette and left the set. Reconciled BY NAME below, never by count,
 * because "five became four" and "one body silently stopped matching" look identical in a total.
 */
chk(`the \`Preset colour (index)\` population is exactly the bodies whose pair matches NO Cycle palette`,
  QUAD_LABEL.every((n) => {
    const g = LIB.get(n).generators;
    return g?.type === 'lissajous' && cyclePaletteForPair(g.colorBase, g.colorAmp) === null;
  }),
  `${QUAD_LABEL.length}: ${JSON.stringify(QUAD_LABEL)}. ⚠️ A body here whose pair DOES match means the adoption `
  + 'skipped it — the label would be honest and the palette name missing, which is the one failure this clause '
  + 'can see and §A\'s per-name table cannot');
chk('...and each of them resolves NO index palette, so the generator reads its own quadruple',
  QUAD_LABEL.every((n) => selectionFor(LIB.get(n)).indexPalette === null),
  'this is what makes the label true rather than decorative: `indexPalette === null` is the argument '
  + '`setIndexPalette` gets, and it means "use `colorBase`/`colorAmp`"');
/*
 * The `None` side. The gate names "a sample of the splat/volume/liquid `PALETTE none` presets"; measured here as
 * the whole set, split by WHY it has no palette — and the interesting half is the one the migration REFUSED.
 */
const REFUSED = NONE_LABEL.filter((n) => {
  const g = LIB.get(n).generators;
  return g?.type === 'lissajous' && cyclePaletteForPair(g.colorBase, g.colorAmp) !== null;
});
chk(`\`None\` is the truth on all ${NONE_LABEL.length} palette-free bodies, ${REFUSED.length} of which carry a `
  + 'MATCHING pair the migration refused on honesty grounds',
  REFUSED.every((n) => {
    const s = selectionFor(LIB.get(n));
    return s.mapping !== 'index' && s.indexPalette === null && s.shaderMappingInt >= 0;
  }),
  `${JSON.stringify(REFUSED)} — condition 3: a live material or a \`splat\`/\`volume\`/\`liquid\` mode owns the `
  + 'colour, so a `Cycle:` name would be a lie. ⚠️ These are the bodies where the two labels are BOTH wrong if '
  + 'the label is chosen from the pair instead of from the resolved mapping');
/*
 * Source-shaped from here: three rules about the two elements, each of which `tsc` and every measurement above
 * are blind to.
 */
{
  const vfx = rd('src/ui/synthesis-lab/tabs/visual-fx.ts');
  const code = stripComments(vfx);
  chk('the copy is set ONCE and only `display` moves — no ternary-assigned label',
    (code.match(/indexSourcePresetLabel\.textContent = 'Preset colour \(index\)';/g) ?? []).length === 1
    && !/indexSourcePresetLabel\.textContent = .*\?/.test(code)
    && /show\(this\.indexSourcePresetLabel, sel\.usesPresetQuadruple\);/.test(code)
    && /show\(this\.indexSourceNameLabel, !sel\.usesPresetQuadruple\);/.test(code),
    '`tipcheck`\'s `INLINE_SINK` matches a literal after `=`, so a ternary-assigned string is invisible to it — '
    + 'the *Tooltips / inline copy* rule. The NAME label is the opposite case and is assigned live, because a '
    + 'palette name is a VALUE and never copy');
  chk('...and the choice between them is made on the RESOLVED fact, never on this tab\'s dropdown',
    /const sel = this\.controls\.getPaletteSelection\(\);/.test(code)
    && !/getOverlayPaletteMapping\(\) === 'index'/.test(code),
    'the mapping has two sources: a film look can select `index` with the `Map` row still reading `From film '
    + 'look`, and a label keyed on the dropdown would then read `None` over a palette-coloured figure');
  // ⚠️ The label state may not write anything. This is E109–E111's rule in a new place: Export and Snapshot must
  // be byte-identical before and after 21.4f, and the only way to guarantee that is for the readout to be
  // read-only. `updatePaletteRows` is the one owner of the derived state, so the assertion is over ITS body.
  const body = /private updatePaletteRows\(\): void \{[\s\S]*?\n  \}/.exec(code)?.[0] ?? '';
  chk('...and `updatePaletteRows` is READ-ONLY — no setter, no `workingPreset` write',
    !!body && !/this\.controls\.set/.test(body) && !/workingPreset/.test(body),
    body ? 'so 21.4f cannot move a byte of an export or a Snapshot — it has no state of its own to move'
      : '⚠️ `updatePaletteRows` was not found, so this clause is measuring nothing');
  chk('`\'None\'` the MATERIAL\'s inactive state is still a separate string from the palette\'s `\'none\'`',
    /preset !== 'None'/.test(code) || /=== 'None'/.test(code),
    'the two must not be unified (21.4f\'s trap): the palette\'s stored word is lower-case `none` and the '
    + 'material\'s is the capitalised `None`, and a shared constant would make one rename break the other');
}
chk('no body stores a palette under the material\'s spelling, or any label, as its palette',
  NAMES.every((n) => LIB.get(n).overlay?.palette !== 'None'),
  'the stored value stays `\'none\'` — 21.4f relabels the ROW and never the data');
if (QUAD_LABEL.length !== 5) {
  note(`21.D3 names FIVE unnamed pairs (six before 2026-09-17) and the library now has ${QUAD_LABEL.length}: `
    + `${JSON.stringify(QUAD_LABEL)}. Re-derive the plan's list rather than the count — this is a BASIS `
    + 'difference (two bodies re-keyed to palette carriers), not a lost preset');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== H. 21.4g — ONE palette control, and the film look FEEDS it ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ## What `21.4g` is, and why it needs a section rather than a comment
 *
 * The owner's finding, on first sight of the built UI: **two rows labelled `Palette` and two labelled `Map`**
 * — one pair inside the Customize sub-panel writing `FilmLookParams`, one pair in the `Colour Palette` section
 * writing the overlay — with nothing saying which was in force. The overlay pair wins whenever it is set, so
 * the other pair was a live-looking control that could not move the picture: **invariant 13 in the readout**,
 * and `21.4c` had shipped an inline note explaining the state rather than removing it.
 *
 * `21.4g` is the fix and it adds no field: the Customize palette rows are GONE, the surviving pair DISPLAYS
 * the resolved selection, and choosing a film look (dropdown, number key, or a material's `presentation`
 * block) WRITES that look's palette into the override — *last action wins*.
 *
 * ## Why every clause here is either source-shaped or a fixed-point measurement
 *
 * ⚠️ **The removals are the load-bearing half, and a removal is exactly what no behavioural test can see.** A
 * re-added `cp.palette` row would compile, render, carry a tooltip and pass every other section of this file;
 * the only instrument is an assertion on its ABSENCE, in the manner of `composercheck` §N's retired words.
 *
 * ⚠️ **And the materialisation's safety property is an IDENTITY, like the rest of `21.4`**: writing the look's
 * own palette into the override must change nothing that renders. That is measured over all 15 named looks
 * below rather than argued, because the one way it could fail — adopting a *different* pair from the one the
 * look applies — produces a plausible picture and no error.
 */
const vfxSrc = rd('src/ui/synthesis-lab/tabs/visual-fx.ts');
const vfxCode = stripComments(vfxSrc);
const tipSrc = stripComments(rd('src/ui/synthesis-lab/tooltips.ts'));
const RETIRED = [
  ["the Customize panel's `Palette` row (`cp.palette`)", /'cp\.palette'/, vfxCode],
  ["its `Map` row (`cp.paletteMapping`)", /'cp\.paletteMapping'/, vfxCode],
  ["the `Palette` sub-header", /subTitle\('Palette'\)/, vfxCode],
  ["the `'From film look'` option", /From film look/, vfxCode],
  ['the `cp.palette` tooltip', /'cp\.palette'/, tipSrc],
  ['the `cp.paletteMapping` tooltip', /'cp\.paletteMapping'/, tipSrc],
];
const revived = RETIRED.filter(([, re, src]) => re.test(src)).map(([n]) => n);
chk('every retired palette control is ABSENT from the source', revived.length === 0,
  revived.length ? `back in the source: ${revived.join('; ')}`
    : `${RETIRED.length} spellings checked, over code with comments stripped — this file's own prose names `
    + 'all of them, so a pattern run over the raw text would match itself and pass forever');

/*
 * The two survivors must read the RESOLVED selection. Reading the raw override instead is the defect that
 * looks like nothing: it differs only on a preset whose palette comes from its look and has not been
 * touched — **145 of the library's 247 bodies, re-measured 2026-09-19 after that day's EIGHTH settle batch, the
 * one that CLOSED the refined-preset review** (it read 146 of 248 after the seventh, 152 of 258 after the sixth,
 * 154 of 260 after the fifth and 168 of 276 on 2026-09-18, and the
 * move is settle batches replacing legacy bodies, not a change to the reader) — where the row would show `''`,
 * i.e. blank or the first option. ⚠️ **Neither figure is asserted anywhere, which is why this one went stale
 * silently for two batches** — re-measure it as `bodies with no overlay.palette` over the composed library.
 * ⚠️ **The SHARE has barely moved across five bases (60.9 %, then 59.2, 58.9, 58.9, 58.7) while the numerator fell
 * by 23 — so the share is the part of this figure that carries no information**, and the review closing does not
 * retire the measurement: a variant spawn or a keep-the-original still moves both terms.
 */
const paletteRow = /key: 'overlayPalette',[\s\S]{0,700}?\n    \}\)\)\);/.exec(vfxCode);
const mapRow = /key: 'overlayPaletteMapping',[\s\S]{0,700}?\n    \}\)\)\);/.exec(vfxCode);
chk('the `Palette` row reads `getPaletteSelection().name`, not the stored override',
  !!paletteRow && /getPaletteSelection\(\)\.name/.test(paletteRow[0])
  && !/getOverlayPalette/.test(paletteRow[0]),
  paletteRow ? 'the resolved name is never `PALETTE_UNSET`, so every value it returns has an option'
    : 'ROW NOT FOUND — a rename makes this clause vacuous, which is worse than missing');
chk('...and the `Map` row reads `getPaletteSelection().mapping`',
  !!mapRow && /getPaletteSelection\(\)\.mapping/.test(mapRow[0])
  && !/getOverlayPaletteMapping/.test(mapRow[0]),
  mapRow ? '' : 'ROW NOT FOUND — see above');
chk('...and neither getter exists any more, on either side of the interface',
  !/getOverlayPalette\b/.test(vfxCode) && !/getOverlayPaletteMapping\b/.test(vfxCode)
  && !/getOverlayPalette\b/.test(mainSrc) && !/getOverlayPaletteMapping\b/.test(mainSrc),
  'a getter for the raw override is a SECOND answer to "which palette is showing", and it disagrees with the '
  + 'resolved one in exactly the untouched-preset state that made 21.4g necessary');
chk('...and the two dropdowns are re-read in `updatePaletteRows()`, the one place that derives them',
  /private updatePaletteRows\(\)[\s\S]*?syncKey\('overlayPalette'\)[\s\S]*?syncKey\('overlayPaletteMapping'\)/
    .test(vfxCode),
  'their value now moves without either control being touched (a `Look` pick, a number key, a material). A '
  + 'handler that wrote the override without coming through here leaves the row on the previous palette while '
  + 'the figure has already changed — the same class as the note 21.4g deleted');

/*
 * The adoption owner. ⚠️ **The ORDER and the CALL SITES are the whole of it**, and both fail silently:
 * adopting before `applyFilmLook` adopts the OUTGOING look's palette (a working-looking feature, one look
 * behind), and adopting inside `applyFilmLook` would materialise on the preset-load and Lab-Reset paths,
 * writing two fields into every export in the library and firing `adoptIndexPalette`'s idempotence exit on
 * the very bodies 21.4d adopts.
 */
const adoptFn = /function adoptLookPalette\(\)[\s\S]*?\n  \}/.exec(mainSrc);
const applyFilmLookFn = /function applyFilmLook\(name: string\)[\s\S]*?\n  \}/.exec(mainSrc);
const adoptCalls = (mainSrc.match(/adoptLookPalette\(\)/g) ?? []).length - 1; // minus the declaration
/*
 * The `setFilmLook` setter's whole body, as ONE pattern: the order (`applyFilmLook` first) and the
 * `Customize` gate (2026-10-31) are two rules over the same three lines, and both fail silently. Kept as a
 * single constant so the order clause, the gate clause and §I's two seeds all read the same text — three
 * copies of a regex over one statement is how a mutation stops being discriminating without saying so.
 */
const CUSTOMIZE_GATE = /applyFilmLook\(name\);\s*\n\s*if \(name !== CUSTOMIZE_FILM_LOOK\) adoptLookPalette\(\);/;
chk('`main.ts` owns the adoption in ONE function, reading the look through `lookPaletteForAdoption`',
  !!adoptFn && /lookPaletteForAdoption\(liveFilmLookParams\(\)\)/.test(adoptFn[0]),
  adoptFn ? 'so §F\'s ban on reading a palette SOURCE in `main.ts` stays literally true — the read lives in '
    + '`palette-selection.ts`, which is now the only file in `src/` that touches either source'
    : 'FUNCTION NOT FOUND — a rename makes every clause below it vacuous');
chk('...called from exactly the THREE user-initiated look sites, and NOT from `applyFilmLook` itself',
  adoptCalls === 3 && !!applyFilmLookFn && !/adoptLookPalette/.test(applyFilmLookFn[0]),
  `${adoptCalls} call site(s) in \`main.ts\` — the \`setFilmLook\` control setter, the number-key shortcut, and `
  + 'the `adoptLookPalette` entry on the controls literal (the Materials tab\'s two-step path, below). ⚠️ A '
  + 'FOURTH is not automatically wrong, but it must be a user choosing a look: `applyFilmLook` is also the '
  + 'preset-load and revert path');
chk('...and after `applyFilmLook`, never before it',
  CUSTOMIZE_GATE.test(stripComments(mainSrc))
  && /applyFilmLook\(filmLookNames\[num - 1\]!\);\s*\n\s*adoptLookPalette\(\);/.test(stripComments(mainSrc)),
  '`applyFilmLook` is what re-seeds `customFilmLookParams` from a named bundle, so before it '
  + '`liveFilmLookParams()` still describes the look being REPLACED — one line up and the feature adopts the '
  + 'previous palette on every pick');
/*
 * ⚠️⚠️ **THE `Customize` GATE — the owner's requirement of 2026-10-31, and it is the 2026-09-19 defect one
 * case wider.** *"Switching from an authored film look to Customize should not have any effect on the
 * settings; the look remains identical and nothing can go black."* `Customize` makes the live bundle
 * EDITABLE and decides no colour of its own (`applyFilmLook` does not re-seed on that branch), so there is
 * nothing to materialise — and adopting there wrote the SEED bundle's pair over the preset's authored
 * `overlay.palette`, unrecoverably, because re-picking the original look adopts the same pair again.
 *
 * ⚠️ **The abstain rule could not catch this and never will:** `lookPaletteForAdoption` answers *does this
 * bundle carry a palette*, and a `Customize` seeded from a CARRIER does. The discriminator is WHICH NAME the
 * user picked, which only the call site knows — so the gate is asserted here as source, and the clause below
 * measures the consequence over the library's own pairs.
 *
 * ⚠️ **The number-key path needs no gate** — `filmLookNames` is `Object.keys(FILM_LOOKS)`, which does not
 * contain `Customize`, so that site cannot reach this branch. A key chord that ever did would need the gate
 * too, and this clause would NOT see it: it reads the setter alone.
 */
chk('...and picking `Customize` adopts NOTHING — it is an EDIT mode, not a colour decision (2026-10-31)',
  CUSTOMIZE_GATE.test(stripComments(mainSrc))
  && /CUSTOMIZE_FILM_LOOK/.test(stripComments(mainSrc)),
  CUSTOMIZE_GATE.test(stripComments(mainSrc))
    ? 'the gate is on the NAME the user picked, which is the only thing that distinguishes the two cases — '
      + '`lookPaletteForAdoption` cannot, because a `Customize` seeded from a carrier carries that carrier\'s '
      + 'pair. Measured on `Warp Split Shapes`: without it, `Cycle: Storm`/`index` became `Sunset`/`depth` '
      + 'and the frame went sd 7.57 → 0.50'
    : 'GATE NOT FOUND — picking `Customize` then overwrites the preset\'s own palette pair with the seed '
      + 'bundle\'s, and the grading sliders cannot recover a black ramp because they multiply zero');

/*
 * ⚠️ **The TWO-STEP look path, which 21.4g broke and this clause pair guards.** A material's `presentation`
 * does not choose a look in one call: it sends `filmLook: 'Customize'` and *then* patches
 * `customFilmLookParams` with its own palette pair. `applyFilmLook('Customize')` does NOT re-seed — it adopts
 * whatever Customize state the previous preset left — so the adoption inside `setFilmLook` captures a STALE
 * pair, and because the override WINS, the set's own palette resolves as the loser. Symptom: pick `Fire` from
 * the dropdown and every field of the set applies except its colours, which stay on the previous preset's.
 * The fix is a second adoption AFTER the patch; the order is the whole rule and nothing throws if it is wrong.
 */
const matSrc = stripComments(rd('src/ui/synthesis-lab/tabs/materials.ts'));
const presentOrder = /setFilmLook\(p\.filmLook\);[\s\S]{0,200}?setCustomFilmLookParam\(p\.customFilmLookParams\);[\s\S]{0,200}?adoptLookPalette\(\);/
  .test(matSrc);
chk('`applyPresentation` re-adopts AFTER patching the params, so a presentation keeps its own palette',
  presentOrder && /adoptLookPalette\(\): void;/.test(vfxCode),
  presentOrder ? 'order asserted as look → params → adopt, and the entry point is declared on '
    + '`VisualFxControls` (the Materials tab shares that interface)'
    : 'ORDER NOT FOUND — either the re-adoption is gone (the four presentation sets silently keep the previous '
    + "preset's palette) or the sequence was reordered, which is the same defect");
/*
 * ⚠️ **Scoped to the SETTER and its body, and the first version of this clause was wrong in a way worth
 * recording**: a 400-character window after `setCustomFilmLookParam:` reached the `adoptLookPalette:` entry a
 * few lines further down the same object literal and reported the shipped code as defective. Read a failure as
 * a claim about the checker until the checker is exonerated — the line and the function body are the two exact
 * scopes, and a slack window is not a third.
 */
const setterLine = /setCustomFilmLookParam: .*/.exec(stripComments(mainSrc))?.[0] ?? '';
const customParamFn = /function applyCustomParam\([\s\S]*?\n  \}/.exec(mainSrc);
const sliderSrc = stripComments(rd('src/exploration/slider-mappings.ts'));
chk('...and never wired into the params path, which a slider drag rebuilds wholesale',
  !!setterLine && !/adoptLookPalette/.test(setterLine)
  && !!customParamFn && !/adoptLookPalette/.test(customParamFn[0])
  && !/adoptLookPalette/.test(sliderSrc) && !/adoptLookPalette/.test(vfxCode.replace(/\badoptLookPalette\(\): void;/, '')),
  '`grading()` in `slider-mappings.ts` rebuilds `customFilmLookParams` on every mouse-move, palette pair '
  + 'included, so an adoption on that path would write the override on a drag the user never aimed at the '
  + 'palette. Three scopes checked: the setter line, `applyCustomParam`\'s body, and the two files that drag');
/*
 * ⚠️ **MEASURED, over the presentation sets as they ship.** The source-shaped clause above says the call is
 * there; this one says it is the call that was NEEDED — it replays the real three-step sequence from a stale
 * Customize state and asserts the set's own palette wins. Without the re-adoption the same replay returns the
 * stale palette (seeded in §I), which is a plausible picture and no error.
 */
const { MATERIAL_PRESETS, getMaterialPresentation } = await import('../src/generators/material-presets.ts');
const STALE = { palette: 'Classic: cyberpunk', paletteMapping: 'velocity' };   // the previous preset's leftovers
/*
 * ⚠️⚠️ **RE-BASED 2026-10-31 WITH THE `Customize` GATE, AND THE RE-BASING IS THE POINT.** Until then this
 * replay modelled `setFilmLook('Customize')` adopting the STALE pair, and the seed in §I worked by that write
 * losing to the set's own patch. The gate removes that write — so with an EMPTY override the missing
 * re-adoption would now resolve to the set's palette anyway and **the seed would have stopped
 * discriminating while still reading as caught.** The replay therefore starts from an AUTHORED OVERRIDE,
 * which is the real state the two-step path has to win against: `overlay.palette` is present on most of the
 * library, it beats the live bundle, and only the explicit second adoption replaces it.
 *
 * `reAdopt: 'yes' | 'no'` — the third value (`'none'`, modelling no adoption anywhere) went with the write it
 * described; it was never passed.
 */
const PRESET_OWN = { palette: 'Cycle: Storm', paletteMapping: 'index' };   // the preset's authored pair
const replayPresentation = (p, reAdopt) => {
  let live = { ...STALE };                                  // applyFilmLook('Customize') keeps this state
  let ov = { ...PRESET_OWN };
  // `setFilmLook('Customize')` adopts NOTHING since 2026-10-31 — the gate in `main.ts`'s setter. Modelled by
  // the ABSENCE of a step here, which is why the clause above names the date: an absence cannot be grepped.
  live = { ...live, ...p.customFilmLookParams };            // setCustomFilmLookParam
  // ⚠️ `?? ov`, because `lookPaletteForAdoption` returns `null` for a look with no palette and
  // `adoptLookPalette()` then writes NOTHING (2026-09-19). The replay has to model the abstention, not just
  // the write, or it would stop describing the engine the moment a presentation seeds from `Legacy`.
  if (reAdopt === 'yes') ov = lookPaletteForAdoption(live) ?? ov;    // the 21.4g fix
  return resolvePaletteSelection(ov, live);
};
const withPresentation = MATERIAL_PRESETS
  .map((m) => [m.name, getMaterialPresentation(m.name)])
  .filter(([, p]) => !!p && !!p.customFilmLookParams);
const presentDrift = withPresentation.filter(([, p]) =>
  replayPresentation(p, 'yes').name !== p.customFilmLookParams.palette
  || replayPresentation(p, 'yes').mapping !== p.customFilmLookParams.paletteMapping);
/*
 * ⚠️ **The replay's two starting values must name nothing a set names, or the clause passes on a coincidence**
 * — asserted here rather than assumed, because both are literals chosen by hand.
 */
const replayBasisClean = withPresentation.every(([, p]) =>
  p.customFilmLookParams.palette !== PRESET_OWN.palette && p.customFilmLookParams.palette !== STALE.palette);
chk(`a presentation's OWN palette is the one in force, over all ${withPresentation.length} sets that patch params`,
  withPresentation.length > 0 && presentDrift.length === 0 && replayBasisClean,
  withPresentation.length === 0 ? 'NO SETS FOUND — the clause is vacuous, which is worse than missing'
    : !replayBasisClean ? `the replay's own basis collides with a set: \`${PRESET_OWN.palette}\` or `
        + `\`${STALE.palette}\` is one of [${withPresentation.map(([, p]) => p.customFilmLookParams.palette).join(', ')}]`
      : presentDrift.length ? `resolves to something else on ${presentDrift.map(([n]) => n).join(', ')}`
        : `replayed over an authored \`${PRESET_OWN.palette}\`/\`${PRESET_OWN.paletteMapping}\` override and a `
          + `stale \`${STALE.palette}\`/\`${STALE.paletteMapping}\` Customize state: `
          + withPresentation.map(([n, p]) => `${n}→${p.customFilmLookParams.palette}`).join(', '));

/*
 * ⚠️ **The looks split in TWO, and that split is the 2026-09-19 fix.** A bundle either CARRIES a palette or
 * ABSTAINS (`palette: 'none'` — `Legacy`, `Legacy Graded`, `Cinematic`, plus `Customize` whenever it is seeded
 * from one of them). A carrier materialises; an abstainer must write NOTHING, and `lookPaletteForAdoption`
 * says which by returning `null`. Reconciled BY NAME below rather than by count, because the guard could test
 * the wrong field and still produce a plausible-sized set.
 */
const lookNames = Object.keys(FILM_LOOKS);
const CARRIERS = lookNames.filter((k) => lookPaletteForAdoption(FILM_LOOKS[k]) !== null);
const ABSTAINERS = lookNames.filter((k) => lookPaletteForAdoption(FILM_LOOKS[k]) === null);
const byPaletteField = lookNames.filter((k) => (FILM_LOOKS[k].palette ?? 'none') === 'none');
chk(`the abstainers are exactly the bundles whose \`palette\` is \`'none'\` — ${ABSTAINERS.length} of ${lookNames.length}`,
  ABSTAINERS.length === byPaletteField.length && ABSTAINERS.every((k) => byPaletteField.includes(k)),
  ABSTAINERS.length === byPaletteField.length && ABSTAINERS.every((k) => byPaletteField.includes(k))
    ? `[${ABSTAINERS.join(', ')}] abstain, the other ${CARRIERS.length} carry a palette. ⚠️ A guard reading `
      + '`paletteMapping` instead, or testing `!fp.palette`, would give a set of a believable size and the '
      + 'wrong members — which is why this is reconciled by name'
    : `abstainers [${ABSTAINERS.join(', ')}] vs bundles with \`palette: 'none'\` [${byPaletteField.join(', ')}]`);
/*
 * ⚠️ **The identity, over the CARRIERS only.** Materialising a carrier's pair must resolve to what that look
 * already resolved to on its own. This is the clause that would catch `lookPaletteForAdoption` plucking the
 * wrong field or an adoption that is not a fixed point. ⚠️ **It is blind to the abstainers by construction** —
 * with no override present, `'none'` and "nothing written" resolve identically, which is exactly how the
 * 2026-09-19 defect passed every clause in this section. The clause after it is the one with an override.
 */
const adoptionDrift = CARRIERS.filter((k) => {
  const fp = FILM_LOOKS[k];
  const before = resolvePaletteSelection(undefined, fp);
  const pair = lookPaletteForAdoption(fp);
  const after = resolvePaletteSelection({ palette: pair.palette, paletteMapping: pair.paletteMapping }, fp);
  const again = lookPaletteForAdoption(fp);
  return before.name !== after.name || before.mapping !== after.mapping
    || before.shaderPalette !== after.shaderPalette || before.shaderMappingInt !== after.shaderMappingInt
    || again.palette !== pair.palette || again.paletteMapping !== pair.paletteMapping;
}).map((k) => `${k}(${FILM_LOOKS[k].palette}/${FILM_LOOKS[k].paletteMapping})`);
chk(`adopting a carrier's palette changes NOTHING that renders, over all ${CARRIERS.length} of them`,
  adoptionDrift.length === 0,
  adoptionDrift.length ? `drifts on ${adoptionDrift.join(', ')}`
    : 'all four resolved outputs identical before and after, and the adoption is idempotent');
/*
 * ⚠️ **MEASURED, and this is the owner-reported defect of 2026-09-19 — the one clause in §H that needs an
 * OVERRIDE to exist.** Reported as: `Spiritual` shows `Cycle: Indigo` + `Particle index`, and picking
 * `Legacy Graded` (or `Customize`) replaces it with `None` + `Depth`. Every other clause here was green over
 * it, because they all start from a preset that has selected nothing.
 *
 * The oracle reads `FILM_LOOKS[k].palette` DIRECTLY — the subject reads the same field through
 * `lookPaletteForAdoption` — so the two are not the same expression: *a carrier's palette ends up in force, an
 * abstainer leaves the preset's selection exactly where it was.* That catches the `'none'` write as shipped,
 * the `PALETTE_UNSET` coercion (which resolves back to `'none'` and reads identical to the first), and a write
 * of the mapping alone (which would re-point a `Cycle:` palette from the CPU index law at a depth LUT — a
 * different picture, not a missing one).
 *
 * ⚠️ **The override pairs are the library's OWN, deduped** — not invented ones. `21.4d` adopted 114 bodies,
 * so this is the population the defect was actually destroying.
 */
const AUTHORED_PAIRS = [...new Map(NAMES
  .map((n) => LIB.get(n).overlay)
  .filter((ov) => ov?.palette !== undefined && ov.palette !== PALETTE_UNSET && ov.palette !== 'none')
  .map((ov) => [`${ov.palette}|${ov.paletteMapping ?? 'depth'}`,
    { palette: ov.palette, paletteMapping: ov.paletteMapping ?? 'depth' }])).values()];
const wanted = (fp, ov) => ((fp.palette ?? 'none') !== 'none'
  ? { palette: fp.palette, paletteMapping: fp.paletteMapping ?? 'depth' }
  : { palette: ov.palette, paletteMapping: ov.paletteMapping });
const overrideWipes = [];
for (const k of lookNames) {
  const fp = FILM_LOOKS[k];
  for (const ov of AUTHORED_PAIRS) {
    const pair = lookPaletteForAdoption(fp);                 // null ⇒ adoptLookPalette() writes nothing
    const after = resolvePaletteSelection(pair ?? ov, fp);
    const want = wanted(fp, ov);
    if (after.name !== want.palette || after.mapping !== want.paletteMapping) {
      overrideWipes.push(`${k} over ${ov.palette}/${ov.paletteMapping} → ${after.name}/${after.mapping}`);
    }
  }
}
chk(`picking a look over an EXISTING palette: ${lookNames.length} looks × ${AUTHORED_PAIRS.length} authored pairs`,
  AUTHORED_PAIRS.length > 0 && overrideWipes.length === 0,
  AUTHORED_PAIRS.length === 0 ? 'NO AUTHORED PAIRS FOUND — the clause is vacuous, which is worse than missing'
    : overrideWipes.length ? `${overrideWipes.length} combination(s) resolve wrongly: ${overrideWipes.slice(0, 6).join('; ')}`
      : `a carrier wins, an abstainer leaves the preset's pair untouched. The ${ABSTAINERS.length} abstainers × `
        + `${AUTHORED_PAIRS.length} pairs are the ${ABSTAINERS.length * AUTHORED_PAIRS.length} cases the shipped `
        + 'code got wrong (seeded in §I), and the oracle reads `FILM_LOOKS` directly rather than through the '
        + 'function under test');
/*
 * ⚠️ **MEASURED — the owner-reported defect of 2026-10-31, and the clause carries BOTH directions because the
 * gated half alone is vacuous.** With the gate, switching to `Customize` resolves to exactly what the named
 * look resolved to (same override, same live bundle — `applyFilmLook` copies the bundle rather than reseeding),
 * so "identical" is true by construction and proves nothing on its own. What gives the clause teeth is the
 * second half: the UNGATED form has to be shown to MOVE something, over the library's own authored pairs.
 *
 * The reported case is in this set: `Warp Split Shapes` authors `Cycle: Storm`/`index` under
 * `Teal & Orange`, whose own pair is `Sunset`/`depth` — and `Sunset` at that figure's depth is ≈(0,0,0.06),
 * i.e. black. ⚠️ **This clause cannot see the blackness** (a palette's own values are §B/§C's subject, and no
 * clause relates a palette to the figure sampling it) — it sees the pair being REPLACED, which is the defect.
 */
const CUSTOMIZE_SEED_CASES = CARRIERS.flatMap((k) => AUTHORED_PAIRS.map((ov) => ({ k, ov })));
const customizeNoOp = CUSTOMIZE_SEED_CASES.filter(({ k, ov }) => {
  const fp = FILM_LOOKS[k];
  const named = resolvePaletteSelection(ov, fp);              // the named look, override in force
  const live = { ...fp };                                     // applyFilmLook('Customize') — a COPY, no reseed
  const gated = resolvePaletteSelection(ov, live);             // the gate writes nothing
  return named.name !== gated.name || named.mapping !== gated.mapping
    || named.shaderPalette !== gated.shaderPalette || named.shaderMappingInt !== gated.shaderMappingInt;
});
const customizeWouldWipe = CUSTOMIZE_SEED_CASES.filter(({ k, ov }) => {
  const live = { ...FILM_LOOKS[k] };
  const ungated = lookPaletteForAdoption(live) ?? ov;          // the shipped pre-fix write
  const after = resolvePaletteSelection(ungated, live);
  const named = resolvePaletteSelection(ov, FILM_LOOKS[k]);
  return after.name !== named.name || after.mapping !== named.mapping;
});
chk(`switching to \`Customize\` changes NOTHING that renders — ${CUSTOMIZE_SEED_CASES.length} carrier × authored-pair cases`,
  CUSTOMIZE_SEED_CASES.length > 0 && customizeNoOp.length === 0 && customizeWouldWipe.length > 0,
  CUSTOMIZE_SEED_CASES.length === 0 ? 'NO CASES — the clause is vacuous, which is worse than missing'
    : customizeNoOp.length ? `${customizeNoOp.length} case(s) drift: `
        + customizeNoOp.slice(0, 4).map(({ k, ov }) => `${k} over ${ov.palette}/${ov.paletteMapping}`).join('; ')
      : customizeWouldWipe.length === 0
        ? '⚠️ THE SECOND HALF IS THE INSTRUMENT AND IT REPORTS NOTHING: the ungated adoption would move no '
          + 'case, so this clause can no longer tell the gate from its absence — re-derive it before trusting '
          + 'a green here'
        : `all ${CUSTOMIZE_SEED_CASES.length} identical with the gate, and the ungated form would have `
          + `replaced the authored pair on ${customizeWouldWipe.length} of them — e.g. `
          + customizeWouldWipe.slice(0, 3).map(({ k, ov }) =>
            `${k} turns ${ov.palette}/${ov.paletteMapping} into ${FILM_LOOKS[k].palette}/${FILM_LOOKS[k].paletteMapping}`).join('; '));
const unsetLeak = CARRIERS.filter((k) => lookPaletteForAdoption(FILM_LOOKS[k]).palette === PALETTE_UNSET);
chk('...and no carrier adopts `PALETTE_UNSET`, which would mean "inherit" with nothing to inherit from',
  unsetLeak.length === 0,
  unsetLeak.length ? `${unsetLeak.join(', ')} adopt the empty string` : '`\'\'` and `\'none\'` are one '
    + 'character apart and mean opposite things; only the second is a palette decision — and after 2026-09-19 '
    + 'neither of them is ever WRITTEN, because a look that has neither abstains');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== I. calibration — every rule class seeded and shown to FAIL ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A measuring section's own basis has been the defect repeatedly, and seeds do not protect a checker's own
 * figures.** Each seed below breaks one rule the way a real edit would and asserts the rule's own function
 * reports it. None of them touches `src/` — they mutate a fixture or pass a wrong value into the function
 * under test, which is why §C can be calibrated without authoring a defective palette.
 */
let calib = 0, calibFail = 0;
const seed = (what, caught, why) => {
  const ok = caught > 0;
  console.log(`  ${ok ? 'CALIB' : 'FAIL '}  ${what} — seeded defect ${ok ? `caught (${caught} violations)` : 'NOT CAUGHT'}`
    + (why ? `\n           ${why}` : ''));
  ok ? calib++ : (calibFail++, fail++);
};
// 1. The 1-LSB rule. A palette authored `0.5` instead of `128/255` — the exact rewrite §B's header forbids.
const oneLsb = parityViolations(
  [...adoptedByName.entries()].find(([n]) => n === 'Cycle: Neutral')?.[1] ?? [],
  () => ({ kind: 'ab', base: [127.5, 127.5, 127.5], amp: [127.5, 127.5, 127.5] }),
);
seed('1-LSB rule: `Cycle: Neutral` re-authored as `0.5` rather than `128/255`', oneLsb.length,
  'the difference is ONE 8-bit level and no visual review can see it; a float-epsilon comparison would not either');
// 1b. THE NARROWING'S OWN RISK, 2026-09-19. §C's parity clause runs over the ADOPTED bodies rather than every
// `index` body, so the question a calibration has to answer is whether a MIS-ADOPTION can now slip out of the
// basis. Seed: one adopted body's palette rewritten to a DIFFERENT `Cycle:` name — the picture changes, the name
// is still one of the nine, and the body no longer matches its own pair. It leaves the parity basis exactly as
// feared, and the partition clause is what catches it instead.
const misAdoptVictim = migAdopted[0];
const misAdoptName = CYCLE_PALETTES.map((p) => p.name).find((n) => n !== LIB.get(misAdoptVictim).overlay.palette);
const seededBody = (n) => (n === misAdoptVictim
  ? { ...LIB.get(n), overlay: { ...LIB.get(n).overlay, palette: misAdoptName } }
  : LIB.get(n));
const misAdopt = indexPartition(seededBody, AUTHORED_INDEX_PALETTES);
seed(`the mis-adoption rule: \`${misAdoptVictim}\` adopted as \`${misAdoptName}\` instead of its own pair`,
  misAdopt.undeclared.length,
  `it DROPS OUT of the parity basis (${migAdopted.length} → ${misAdopt.adopted.length}) and lands in the override `
  + 'class, so narrowing the basis without this clause would have made the defect invisible. ⚠️ **The declared '
  + 'list is what fails it** — which is why the override class may not be derived: a derived one would have '
  + 'absorbed this silently, and the shipped picture would be a palette nobody chose');
// 2. The exact-equality rule, two-sided: a tolerant version of the reverse lookup DOES claim the near-miss.
const tolerantMatch = (base, amp, tol) => {
  for (const p of CYCLE_PALETTES) {
    let hit = true;
    for (let c = 0; c < 3; c++) {
      if (Math.abs(p.a[c] * 255 - base[c]) > tol || Math.abs(p.b[c] * 255 - amp[c]) > tol) { hit = false; break; }
    }
    if (hit) return p.name;
  }
  return null;
};
const tolCaught = nearMiss.filter(({ g }) =>
  cyclePaletteForPair(g.colorBase, g.colorAmp) === null && tolerantMatch(g.colorBase, g.colorAmp, 64) !== null).length;
seed('exact-equality rule: a tolerance of 64/255 in the reverse lookup adopts the near-miss pair', tolCaught,
  'reported as the COMPARISON changing its answer, not as a number differing — a tolerance picked to "allow '
  + 'float noise" is the edit this guards, and 64 is the measured gap rather than a chosen one');
// 3. Both guards. A resolver variant that keeps `shaderPalette` under `index` — the half-fix.
const halfGuard = (sel) => (sel.mapping === 'index' && sel.shaderPalette === 'none' ? 0 : 1);
const brokenSel = { mapping: 'index', shaderPalette: 'Cycle: Solar', shaderMappingInt: PALETTE_MAPPING_OFF };
seed('both-guards rule: a resolver that switches the int off but leaves the palette NAME on',
  halfGuard(brokenSel), 'the LUT would overwrite the CPU answer with a different, plausible picture — nothing '
  + 'black, nothing thrown, and both of the mapping\'s controls still move');
// 4. Invariant 28. A swatch drawn at pos = 0 is indistinguishable under two different drifts.
seed('swatch-instant rule: the strip sampled at `pos = 0`', ghostProbe(0) === false ? 1 : 0,
  'at 0 the drift term vanishes on all three channels at once, so `Colour Drift` reads inert while working '
  + 'perfectly — and the remedy has to be checked algebraically, which is what §E\'s 2π clause does');
// 5. The reader rule. A reader with its own chain — seeded as the PATTERN over a synthetic source, because the
//    real regression is a file that stops calling the resolver and starts calling the int converter.
const fakeReader = 'const mapping = paletteMappingToInt(look.paletteMapping ?? "depth");';
seed('one-resolution-order rule: a reader that converts the mapping itself',
  /paletteMappingToInt\s*\(/.test(stripComments(fakeReader)) ? 1 : 0,
  'asserted over a synthetic source rather than by editing a reader: the clause in §F is a text pattern and '
  + 'its calibration has to show the PATTERN discriminates, not that a file can be broken');
// 5a. The SOURCE-read ban, and the LUT consumer. Seeded over synthetic bodies for seed 5's reason — and these two
//     are the pair that matters most, because the real defect they were written for was live in `src/` and every
//     pre-existing §F clause was green over it. The first seed is the pre-2026-09-18 line verbatim.
const preFixTrail = `
  function resolvePhysarumTrailLut() {
    const palette = customFilmLookParams.palette;
    if (palette && palette !== 'none') { const lut = getPaletteLUT(palette); if (lut) return lut; }
    return null;
  }`;
seed('the source-read ban: the pre-fix trail resolver reading `customFilmLookParams.palette`',
  /customFilmLookParams\.palette(?!\s*=)/.test(stripComments(preFixTrail)) ? 1 : 0,
  'the exact line that shipped from 21.4a until 2026-09-18. ⚠️ It is caught by the SOURCE-read pattern and by '
  + 'nothing else in this file: the function never touches a mapping, so `paletteMappingToInt` cannot see it, and '
  + '`main.ts` called the resolver elsewhere, so the file-granular clause passed');
const shaderPalTrail = preFixTrail.replace('customFilmLookParams.palette', 'livePaletteSelection.shaderPalette');
seed('...and the near-miss fix: resolving, but reading `shaderPalette` instead of `name`',
  /shaderPalette/.test(stripComments(shaderPalTrail)) ? 1 : 0,
  '⚠️ **The tempting one-word fix, and it is wrong on exactly the bodies `21.4d` adopted**: `shaderPalette` is '
  + '`\'none\'` under `index`, so the trail would fall through to orange on all 114 of them. A fix that reads a '
  + 'resolved field is not automatically a fix that reads the RIGHT resolved field');
// 6. The migration's condition 2 — the one the first draft of 21.4d lacked.
if (donor) {
  const b = JSON.parse(JSON.stringify(donor));
  delete b.overlay.palette; delete b.overlay.paletteMapping;
  const lookWithPalette = Object.keys(FILM_LOOKS).find((k) => (FILM_LOOKS[k].palette ?? 'none') !== 'none');
  b.overlay.filmLook = lookWithPalette;
  // "Caught" here means: the condition is LIVE, i.e. the body is not adopted. Seeded by REMOVING the
  // condition — emulated by asking whether the pair alone would have matched.
  const pairAlone = cyclePaletteForPair(b.generators.colorBase, b.generators.colorAmp) !== null;
  seed('migration condition 2: adopting on the PAIR alone would restyle a look-palette preset',
    pairAlone && migrated(b).overlay?.paletteMapping === undefined ? 1 : 0,
    'the pair matches AND the migration refuses — so the refusal is the condition doing work, not the pair '
    + 'failing to match. Measured at 120 bodies of this shape, a fifth of the library');
}

/*
 * 7. §H's four rule classes. ⚠️ **Three of them are assertions on an ABSENCE, and an absence-assertion is the
 * one shape that can pass because its subject was DELETED rather than because the rule holds** — the same trap
 * `21.1`'s scaffold seed exists for. So each is seeded by putting the retired thing BACK into a copy of the
 * source and confirming the pattern fires.
 */
const revivedVfx = vfxCode.replace("key: 'overlayPalette',", "key: 'cp.palette',\n      key: 'overlayPalette',");
seed('the retired-control rule: `cp.palette` put back as a Customize row',
  RETIRED.filter(([, re, src]) => re.test(src === vfxCode ? revivedVfx : src)).length,
  'a re-added row compiles, renders, carries a tooltip and passes every other section of this file — the '
  + 'absence assertion is the only instrument, and it must be shown to discriminate');
const rawReadRow = paletteRow
  ? paletteRow[0].replace('this.controls.getPaletteSelection().name', 'this.controls.getOverlayPalette()')
  : '';
seed('the resolved-read rule: the `Palette` row reading the stored override instead',
  rawReadRow && (!/getPaletteSelection\(\)\.name/.test(rawReadRow) || /getOverlayPalette/.test(rawReadRow))
    ? 1 : 0,
  '⚠️ **This is the pre-21.4g reader and it is wrong on 145 of 247 bodies** (re-measured 2026-09-19, EIGHTH settle batch) — every preset whose palette comes '
  + 'from its film look and has not been touched, where the row would show the empty string. It looks right on '
  + 'any preset that HAS an override, which is every preset you would think to test it on');
const gateSrc = /setFilmLook: \(name\) => \{[\s\S]*?\n    \},/.exec(stripComments(mainSrc))?.[0] ?? '';
const orderSwapped = gateSrc.replace(/applyFilmLook\(name\);\s*\n(\s*)if \(name !== CUSTOMIZE_FILM_LOOK\) adoptLookPalette\(\);/,
  'if (name !== CUSTOMIZE_FILM_LOOK) adoptLookPalette();\n$1applyFilmLook(name);');
seed('the adoption-order rule: adopting BEFORE the look is applied',
  gateSrc && !CUSTOMIZE_GATE.test(orderSwapped) ? 1 : 0,
  'the feature then works, one look behind — `liveFilmLookParams()` still describes the look being replaced, '
  + 'so the first pick adopts the OUTGOING palette. No error, and the second pick of the same look is correct. '
  + '⚠️ **Seeded against the SETTER BODY rather than the whole file since 2026-10-31**: the statement now spans '
  + 'three lines, and a whole-file `replace` of a multi-line pattern that no longer matches is a seed that '
  + 'silently mutates nothing — which reads exactly like a caught one');
/*
 * ⚠️⚠️ **THE `Customize` GATE, seeded by REMOVING it — i.e. by replaying the defect the owner reported on
 * 2026-10-31.** Two instruments are needed and they catch different things: this one restores the ungated
 * source (the source-shaped clause must fire), and §H's measured clause counts the authored pairs an ungated
 * adoption would overwrite. **Neither alone is enough** — the source clause cannot say the gate MATTERS, and
 * the measured one is a model of the call site rather than the call site itself.
 */
const gateRemoved = gateSrc.replace(/if \(name !== CUSTOMIZE_FILM_LOOK\) adoptLookPalette\(\);/,
  'adoptLookPalette();');
seed('the `Customize`-is-an-edit-mode rule: the gate removed from `setFilmLook`',
  gateSrc && !CUSTOMIZE_GATE.test(gateRemoved) && /adoptLookPalette\(\);/.test(gateRemoved) ? 1 : 0,
  'picking `Customize` then materialises the SEED bundle\'s palette pair over the preset\'s own — '
  + '`Warp Split Shapes` lost `Cycle: Storm`/`index` to `Teal & Orange`\'s `Sunset`/`depth` and the frame went '
  + 'sd 7.57 → 0.50, unrecoverably, because re-picking the original look adopts the same pair again. ⚠️ **It '
  + 'is invisible to the abstain rule by construction**: `lookPaletteForAdoption` answers *does this bundle '
  + 'carry a palette*, and a `Customize` seeded from a carrier does');
const adoptInApply = applyFilmLookFn
  ? applyFilmLookFn[0].replace('\n  }', '\n    adoptLookPalette();\n  }') : '';
seed('the load-path rule: `applyFilmLook` itself calling the adoption',
  adoptInApply && /adoptLookPalette/.test(adoptInApply) ? 1 : 0,
  '⚠️ **The most tempting wrong home for it, and the most expensive**: `applyFilmLook` is also the preset-load '
  + 'and Lab-Reset path, so every preset would gain `overlay.palette` + `overlay.paletteMapping` the moment it '
  + 'loaded — every Export and Snapshot in the library pinned to two fields it never authored, and '
  + '`adoptIndexPalette`\'s idempotence exit firing on the bodies 21.4d exists to adopt');
/*
 * The two-step path, seeded by REMOVING the re-adoption — i.e. by replaying 21.4g exactly as it shipped for
 * the first hour, before the materials path was traced. ⚠️ **This one was a live defect, not a hypothetical**:
 * every other field of a presentation set applied, so the material looked like it worked.
 */
const staleWins = withPresentation.filter(([, p]) =>
  replayPresentation(p, 'no').name !== p.customFilmLookParams.palette).length;
seed('the two-step rule: `applyPresentation` NOT re-adopting after its params patch',
  staleWins,
  `${staleWins} of ${withPresentation.length} sets then resolve to the previous preset's palette instead of `
  + 'their own. ⚠️ **The source-shaped clause and this measured one catch different things**: a reorder of the '
  + 'three calls also breaks it while leaving all three present, and a set whose patch happened to name the '
  + 'same palette as the stale state would be caught by neither — which is why the replay starts from a '
  + 'palette no set uses');
seed('the drag-path rule: the adoption wired into `setCustomFilmLookParam` instead',
  /adoptLookPalette/.test(setterLine.replace('applyCustomParam(patch);',
    'applyCustomParam(patch); adoptLookPalette();')) ? 1 : 0,
  '⚠️ **The tidy-looking generalisation — "adopt whenever the look\'s params change" — and it fires on every '
  + 'mouse-move**, because `grading()` rebuilds the whole bundle per drag. The palette would then be pinned by '
  + 'a Bloom slider, which is the defect `sliderBaseFilmLook` exists for, re-created one layer up');
seed('...and the same rule with the calls present but REORDERED (adopt before the patch)',
  /setFilmLook\(p\.filmLook\);[\s\S]{0,200}?setCustomFilmLookParam\(p\.customFilmLookParams\);[\s\S]{0,200}?adoptLookPalette\(\);/
    .test(matSrc.replace('if (p.customFilmLookParams) this.controls.adoptLookPalette();', '')
      .replace('if (p.filmLook) this.controls.setFilmLook(p.filmLook);',
        'if (p.filmLook) this.controls.setFilmLook(p.filmLook);\n    this.controls.adoptLookPalette();')) ? 0 : 1,
  'the adoption is still called, from the same tab, one statement too early — and the frame it produces is the '
  + 'unfixed one. A grep for the call site passes; only the ORDER clause fires');

/*
 * # The abstain rule — the OWNER-REPORTED defect of 2026-09-19, seeded three ways
 *
 * ⚠️ **This section's own basis was the defect, and that is the lesson worth keeping.** Until 2026-09-19 §H
 * asserted the OPPOSITE of the rule below in as many words — *"adopting `'none'` is correct: it is the stored
 * word for no palette, which is what that look means"* — and the seed that used to stand here justified
 * itself with *"nothing above a film look supplies a palette"*. That premise was false when it was written:
 * `21.4d` had adopted a palette into 114 of the library's bodies through the MIGRATION, which is precisely
 * "something above a film look". Every clause in §H was green, `verify` was green, and the owner found it in
 * the UI in one minute. **Re-derive the premise of a calibration, not only the seed.**
 *
 * The three seeds below are one rule at three distances: the write as it shipped, the tempting near-miss fix,
 * and the half-write. All three are measured over the same population — every look × every palette pair the
 * library actually authors — because a defect that only shows up when a preset HAS a selection cannot be
 * seeded against a preset that has none.
 */
const unguarded = (fp) => ({ palette: fp.palette, paletteMapping: fp.paletteMapping });   // pre-fix behaviour
const coerced = (fp) => ({
  palette: fp.palette === 'none' ? PALETTE_UNSET : fp.palette,
  paletteMapping: fp.paletteMapping,
});
// ⚠️ Takes the OVERRIDE too, because "adopt the mapping only" means the preset's palette SURVIVES — modelling
// it as `palette: undefined` would make it fall through to the look and measure the wipe a second time. The
// first version of this seed did exactly that and reported the same 27; the rationale said the palette survives
// while the arithmetic said it did not. **Check what the seed MODELS against what its sentence claims.**
const mappingOnly = (fp, ov) => ({ palette: ov.palette, paletteMapping: fp.paletteMapping });
const wipesUnder = (adopt) => {
  let n = 0;
  for (const k of lookNames) {
    for (const ov of AUTHORED_PAIRS) {
      const after = resolvePaletteSelection(adopt(FILM_LOOKS[k], ov) ?? ov, FILM_LOOKS[k]);
      const want = wanted(FILM_LOOKS[k], ov);
      if (after.name !== want.palette || after.mapping !== want.paletteMapping) n++;
    }
  }
  return n;
};
const CASES = `${lookNames.length} × ${AUTHORED_PAIRS.length}`;
seed('the abstain rule: an adoption with no guard, writing a look\'s `\'none\'` over the preset\'s palette',
  wipesUnder(unguarded),
  `${wipesUnder(unguarded)} of ${CASES} (look, authored pair) combinations lose the preset's palette — exactly `
  + `the ${ABSTAINERS.length} abstainers × ${AUTHORED_PAIRS.length} pairs. ⚠️ **This is what shipped**, and the `
  + 'owner\'s report is one row of this table: `Spiritual` (`Cycle: Indigo`/`index`) + `Legacy Graded` → '
  + '`None`/`Depth`. ⚠️ The identity clause above is blind to every one of them, because it starts from no '
  + 'override — so a seed against an empty preset would have reported this rule as unseedable');
seed('...and the near-miss fix: coercing the look\'s `\'none\'` to `PALETTE_UNSET` instead of abstaining',
  wipesUnder(coerced),
  `the SAME ${wipesUnder(coerced)} combinations, and that is the point: \`''\` means "not overridden", so the `
  + 'chain falls through to the look\'s own `\'none\'` — the identical resolved answer by a different route, '
  + 'with the preset\'s selection deleted on the way. ⚠️ **A fix that changes the stored word without '
  + 'changing whether a write HAPPENS is not a fix**, and no clause reading only the stored word can tell the '
  + 'two apart');
seed('...and the half-write: abstaining on the palette but still adopting the mapping',
  wipesUnder(mappingOnly),
  `${wipesUnder(mappingOnly)} of ${CASES} combinations — MORE than either wipe, and differently: here the `
  + 'palette survives and is RE-POINTED, so a `Cycle:` palette computed by the generator under `index` becomes '
  + 'a depth LUT sample instead of disappearing. ⚠️ **A different plausible picture, which this file\'s header '
  + 'calls the worst kind of defect** — the two fields are adopted together or not at all, which is why the '
  + 'early return in `adoptLookPalette()` sits ABOVE both writes rather than between them');

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  palettecheck: ${pass} passed, ${fail} failed, `
  + `${calib} calibrated${notes ? `, ${notes} note(s)` : ''}\n`);
process.exit(fail === 0 ? 0 : 1);
