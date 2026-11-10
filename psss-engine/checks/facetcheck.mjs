#!/usr/bin/env node
/**
 * facetcheck — v8 Phase 22 step 22.2. **The instrument for one class of defect: a facet predicate that reads
 * plausibly and answers wrongly.**
 *
 * ⚠️ **WHY THIS CHECKER EXISTS, STATED AS THE FAILURES IT PREVENTS.** Not one of them is visible to `tsc`, to a
 * browser pass on one preset, or to any of the other sixteen checkers:
 *
 * 1. **A presence test where an activation scalar belongs.** `overlay.physarum` is PRESENT on 179 of 274
 *    presets and 176 of those blocks are byte-identical to each other; `physarum.blend > 0` is true on **2**.
 *    `showTrail` defaults to `true` inside the block, so that predicate reports **178**. `attractorBlend`
 *    defaults non-zero, so a blend-only attractor test reports **179** against a real **9**. Every one of these
 *    is a compiling, type-correct, plausible-looking one-liner, and every one of them reaches the owner as
 *    *"the filter is broken"* — a UI report for a predicate defect, which is the most expensive shape a bug
 *    can have. §D is the only instrument that can see one, because it measures the DISTRIBUTION.
 * 2. **A field path that is silently absent.** `OverlayState` is an interface of optional fields, so
 *    `overlay.crystals` — the plural, and the natural thing to type — is not a type error. It reads
 *    `undefined` on all 274 and the facet is empty forever. `ATTRACTOR_PRESETS[i].params.type` is the same
 *    class: `params` is a `number[]` and `.type` is its sibling. **Both were REAL defects in the spec** and
 *    both are caught here only by a floor: a boolean facet matching nothing.
 * 3. **A two-source field resolved the near way.** Reading `overlay.transMapStyle` instead of going through
 *    `chainFromOverlay()` loses styles 8, 9 and 11 entirely — 13 presets — and **nothing else in the codebase
 *    fails**. Reading `overlay.palette` instead of `resolvePaletteSelection()` reports `No palette` on 160
 *    presets instead of 47, because the film look carries the majority. Reading `renderer.mode` without
 *    `resolveModeAgainstMaterial()` mis-reports every preset with a material. §E seeds all three.
 * 4. **A sub-enumeration that lost its parent's gate.** `Seed Pattern` without `liquidField.enabled` counts
 *    every preset carrying a default block. This one is invisible to a floor AND to a ceiling — the numbers
 *    stay small and plausible. §D's **sum-to-parent** clause is the only thing that sees it, which is why
 *    every enumeration in the catalogue must be declared as either a PARTITION of the library or a sub-enum of
 *    a named parent, with no third option.
 * 5. **A catalogue that silently stopped covering the engine.** A new palette, film look, material, warp style,
 *    render mode or crystal shape ships and no chip appears for it. There is no compiler between
 *    `FACET_GROUPS` and any of those six registries. §B asserts **both directions** against the registries
 *    themselves, and against the *type declaration text* for the five unions that have no runtime array.
 * 6. **A filter law that widens instead of narrowing.** `matchesFilter` has exactly one honest failure
 *    direction: returning `true` when it should return `false` shows presets that do not have the feature, and
 *    the owner has no way to tell. §F drives it against an independently written reference over the whole
 *    library and over a synthetic exhaustive space.
 *
 * ⚠️ **THIS CHECKER MEASURES; IT GREPS ONLY WHERE THERE IS NOTHING TO IMPORT.** It imports
 * `src/presets/preset-facets.ts` and runs it over the real composed library. The text-scan clauses are §B's
 * union declarations (a union has no runtime value) and §C's shipped-UI words (the labels live in `lit` modules
 * this checker must not load). **Every text clause asserts that its anchor matched SOMETHING**, because
 * `CLAUDE.md` records two occasions where an anchor matched nothing and so asserted nothing forever.
 *
 * ⚠️ **EVERY MEASURED GATE IS SEEDED, AND THE SEEDS ARE THE PREDICATES THAT WOULD ACTUALLY BE WRITTEN** — the
 * presence test, the default-true boolean, the plural field name, the blend without the index, the index
 * without the blend, the un-resolved mode, the un-resolved style, the un-resolved palette, the sub-enum
 * without its parent, and an exclusion applied after the OR instead of before it. **A seed that does not fail
 * is a CALIBRATION FAIL and exits non-zero exactly like a real failure**: an assertion that cannot fail is
 * worse than a missing one, because it occupies the slot the real check would take. ⚠️ **And the seeds do not
 * protect this file's own figures** — §A prints the basis and every gate derives its own, so a wrong N is
 * reported as a reconciliation failure by NAME and never absorbed into a total.
 *
 * ⚠️ **THE BASIS IS PRINTED AT RUN TIME AND IS NEVER QUOTED IN PROSE HERE.** A checker only knows what it was
 * pointed at: this one is pointed at `src/presets/preset-facets.ts`, the composed library, six engine
 * registries, the union declarations in `src/presets/types.ts` and `src/core/interfaces.ts`, and every `.ts`
 * file under `src/ui/` for §C. It is pointed at NO DOM and NO GL — the filter UI is `22.4`'s and its
 * instrument is the owner test script (`22.D16`: no Playwright spec).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------------------------------
// §0 PREFLIGHT — the subject must be loadable by NODE, which strips types only.
// ⚠️ `reel-model.ts`'s rule, verbatim and for the same reason: **a constructor parameter property throws
// `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` while `tsc --noEmit` stays green.** So does an `enum`, a `namespace`, a
// decorator and a non-`type` re-export. `preset-facets.ts` has no classes at all, which is the cheapest way to
// stay loadable — but the constraint is invisible in the file, so it is asserted here with a NAMED diagnosis
// rather than left to surface as a stack trace nobody can act on.
// ---------------------------------------------------------------------------------------------------
const SUBJECT = 'src/presets/preset-facets.ts';
/**
 * ⚠️ **COMMENTS AND STRINGS FIRST, ALWAYS.** `deadcheck`'s `stripComments()` rule, and this file proved it on
 * its own first run: the header two paragraphs above says *"one class of defect"*, and `/\bclass\s+\w/` matched
 * the PROSE. A checker whose corpus includes its subject's comments reports the subject's DOCUMENTATION as a
 * defect — the loudest possible false positive, and one that would have been "fixed" by weakening the anchor.
 */
const stripCommentsAndStrings = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
{
  const text = stripCommentsAndStrings(rd(SUBJECT));
  const hostile = [
    [/\bclass\s+\w/, 'a `class` (its constructor may grow a parameter property, which Node cannot strip)'],
    [/^\s*enum\s|\bconst enum\b/m, 'an `enum` (Node cannot strip one — it has a runtime value)'],
    [/^\s*namespace\s/m, 'a `namespace`'],
    [/^\s*@\w+/m, 'a decorator'],
  ].filter(([re]) => re.test(text)).map(([, why]) => why);
  if (hostile.length) {
    console.log(`\n  ${SUBJECT} contains ${hostile.join(', ')}.`);
    console.log('  Node strips TYPES only. Rewrite as plain functions and plain data; this checker does not\n'
      + '  make that edit.\n');
    console.log('FAIL  facetcheck: 0 passed, 1 failed (subject unreachable)\n');
    process.exit(1);
  }
}

const F = await import('../src/presets/preset-facets.ts');
const {
  FACET_GROUPS, ALL_FACETS, FACET_LABELS, FACET_GROUP_OF, computeFacets, matchesFilter,
  MODE_LABELS, RIBBON_LABELS, SEED_PATTERN_LABELS, TINT_LABELS, GATE_BY_LABELS, DYE_COLOUR_LABELS,
  MAPPING_LABELS, CRYSTAL_SHAPE_LABELS, DECAY_LABELS, WINDING_LABELS, ASPECT_LABELS,
} = F;

const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { MATERIAL_PRESETS } = await import('../src/generators/material-presets.ts');
const { TRANS_MAP_STYLES, chainFromOverlay } = await import('../src/post-processors/trans-map-chain.ts');
const { resolvePaletteSelection, PALETTE_MAPPING_ORDER, PALETTE_MAPPING_LABELS } = await import('../src/renderers/palette-selection.ts');
const { FILM_LOOKS, CUSTOMIZE_FILM_LOOK } = await import('../src/renderers/film-looks.ts');
const { getAllPaletteNames } = await import('../src/presets/palettes.ts');
const { CRYSTAL_SHAPES } = await import('../src/crystal/crystal-config.ts');
const { ATTRACTOR_PRESETS } = await import('../src/generators/attractors.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const note = (m) => console.log(`  NOTE  ${m}`);
/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL.** `seed` runs the checker's OWN gate over a deliberately broken
 * predicate and asserts the gate reports at least one violation. A seed that passes is a CALIBRATION FAIL and
 * exits non-zero: the checker is claiming it cannot see the thing it was written to see.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violation${violations === 1 ? '' : 's'})` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the basis: the composed library, and the predicate as a pure function of it ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A TOTAL AGREEING WITH A TOTAL PROVES NOTHING** — `coveragecheck` §A's rule, and this section borrows its
 * reconciliation wholesale: the name set is compared as a SET against the source groups, so a settle that
 * replaced a legacy key in place is visible as a name rather than cancelling in a sum. **`public/psss_presets.json`
 * is NOT plain JSON** — it opens `g_psss_presets={`, so the assignment prefix is sliced off first.
 */
const rawText = rd('public/psss_presets.json');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const mgr = new PresetManager();
const orphans = loadLibrary(mgr, rawLib);
const NAMES = mgr.list();
const N = NAMES.length;

const groupSources = await Promise.all([
  import('../src/presets/refined-presets.ts'), import('../src/presets/variant-presets.ts'),
  import('../src/presets/fire-presets.ts'), import('../src/presets/flow-presets.ts'),
  import('../src/presets/showcase-presets.ts'), import('../src/presets/chain-presets.ts'),
  import('../src/presets/demo-presets.ts'),
]);
const expectedNames = new Set(Object.keys(rawLib));
for (const k of Object.keys(groupSources[0].REFINED_PRESETS)) expectedNames.add(k);
for (const v of groupSources[1].VARIANT_PRESETS) expectedNames.add(v.name);
for (const g of [groupSources[2].FIRE_PRESETS, groupSources[3].FLOW_PRESETS,
  groupSources[4].SHOWCASE_PRESETS, groupSources[5].CHAIN_PRESETS, groupSources[6].DEMO_PRESETS]) {
  for (const k of Object.keys(g)) expectedNames.add(k);
}
const missing = [...expectedNames].filter((n) => !NAMES.includes(n));
const extra = NAMES.filter((n) => !expectedNames.has(n));
chk(`the composed library is ${N} presets, and the source groups derive the SAME NAME SET`,
  missing.length === 0 && extra.length === 0 && orphans === 0,
  `missing ${JSON.stringify(missing.slice(0, 5))}, extra ${JSON.stringify(extra.slice(0, 5))}, `
  + `${orphans} orphan(s). ⚠️ Reconcile by NAME — every figure below inherits this basis`);

/** The facet sets, computed once. ⚠️ Deep-frozen bodies: `PresetManager` freezes, so a mutating predicate throws. */
const FACETS = new Map(NAMES.map((n) => [n, computeFacets(mgr.get(n))]));
const counts = new Map(ALL_FACETS.map((f) => [f.key, 0]));
for (const s of FACETS.values()) for (const k of s) counts.set(k, (counts.get(k) ?? 0) + 1);
const cnt = (k) => counts.get(k) ?? 0;

chk('computeFacets returns the SAME set on a second call over every preset (no hidden state)',
  NAMES.every((n) => {
    const a = FACETS.get(n), b = computeFacets(mgr.get(n));
    return a.size === b.size && [...a].every((k) => b.has(k));
  }),
  'a predicate that caches, or that reads a module-level mutable, would answer differently on the second grid '
  + 'build — and the first build is the one anyone would test');
chk('...and it MUTATES no preset body',
  (() => {
    const before = NAMES.map((n) => JSON.stringify(mgr.get(n)));
    NAMES.forEach((n) => computeFacets(mgr.get(n)));
    return NAMES.every((n, i) => JSON.stringify(mgr.get(n)) === before[i]);
  })(),
  '⚠️ `extractDeploymentReels(raw)` MUTATES its argument and that is documented; a predicate must not. A '
  + 'resolver that wrote a resolved value back would change what the next Export emits (invariant 17)');
const sizes = NAMES.map((n) => FACETS.get(n).size).sort((a, b) => a - b);
chk(`every preset matches at least one facet (min ${sizes[0]}, median ${sizes[sizes.length >> 1]}, max ${sizes[sizes.length - 1]})`,
  sizes[0] >= 1,
  'a preset with NO facets can never be reached by the drawer, only by the search field — and the whole point '
  + 'of the phase is that names are the axis that already exists');
chk(`the catalogue is ${ALL_FACETS.length} facets in ${FACET_GROUPS.length} groups`,
  ALL_FACETS.length > 0 && FACET_GROUPS.length > 0,
  'an empty catalogue passes every other clause in this file');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. catalogue completeness, BOTH directions, against the engine\'s own registries ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE DIRECTION THAT MATTERS IS "the engine grew and the drawer did not".** A missing chip is invisible:
 * the drawer looks complete, the filter works, and one palette simply cannot be selected. There is no compiler
 * between `FACET_GROUPS` and any registry, so each pair below is asserted as a SET in both directions and the
 * failure message prints the NAMES, never a count difference.
 */
const keys = new Set(ALL_FACETS.map((f) => f.key));
chk('every facet key is unique', keys.size === ALL_FACETS.length,
  `${ALL_FACETS.length - keys.size} duplicate(s) — a duplicate key silently merges two chips into one filter `
  + 'term and the second one\'s count is the one that shows');
chk('FACET_LABELS covers exactly the catalogue, both directions',
  Object.keys(FACET_LABELS).length === keys.size && [...keys].every((k) => typeof FACET_LABELS[k] === 'string'),
  'the derivation in the module is one line, but a derivation can still be wrong — and this is the clause that '
  + 'would survive someone re-authoring it as a second hand-written Record');
chk('FACET_GROUP_OF covers exactly the catalogue, both directions',
  FACET_GROUP_OF.size === keys.size && [...keys].every((k) => FACET_GROUP_OF.has(k)),
  '⚠️ `matchesFilter` treats an unknown key as an unsatisfiable one-key group, so a facet missing from this map '
  + 'would make its own chip select NOTHING — a chip that is worse than absent');
chk('every label and tip is non-empty, and every tip says something',
  ALL_FACETS.every((f) => f.label.trim().length > 0 && f.tip.trim().length >= 30),
  'the tip is where a facet\'s ACTIVATION SCALAR is explained in user words (22.8), because 22.D4\'s frame rule '
  + 'has an equally natural opposite reading');
/*
 * ⚠️ **THE UNIT OF AMBIGUITY IS THE ROW, NOT THE GROUP — and this clause was written at the wrong basis and
 * caught by its own first run.** Motion carries `Dye Colour` and `Gate By`, and each has a `Temperature` and a
 * `Depth`: four chips, two words, one group. That is NOT ambiguous, because a chip renders under its row
 * heading — the drawer reads *Gate By: Age · Temperature · Depth*. Two chips in ONE row sharing a word is
 * ambiguous and nothing downstream can recover which is which. ⚠️ **A duplicate ACROSS rows is printed as a
 * NOTE rather than asserted**, because the assertion would have to be "these two rows are far enough apart",
 * which is not a property this file can measure.
 */
const rowsOf = (g) => g.rows.map((r) => ({
  what: r.kind === 'boolean' ? `${g.id}/booleans` : `${g.id}/${r.id}`,
  labels: r.kind === 'boolean' ? [r.facet.label] : r.values.map((v) => v.label),
}));
const allRows = FACET_GROUPS.flatMap(rowsOf);
// The boolean rows of one group are one visual run of chips, so they are collapsed into a single unit above.
const rowUnits = [...allRows.reduce((m, r) => m.set(r.what, [...(m.get(r.what) ?? []), ...r.labels]), new Map())];
const ambiguous = rowUnits.filter(([, ls]) => new Set(ls).size !== ls.length);
chk(`no two chips in the same ROW carry the same label (${rowUnits.length} rows)`,
  ambiguous.length === 0,
  `${JSON.stringify(ambiguous.map(([w]) => w))} — two chips reading one word under one heading are `
  + 'indistinguishable, and the count shown against each is then the only thing that tells them apart');
const crossRow = [...ALL_FACETS.reduce((m, f) => m.set(f.label, (m.get(f.label) ?? 0) + 1), new Map())]
  .filter(([, c]) => c > 1).map(([l, c]) => `${l}×${c}`);
note(`${crossRow.length} label(s) repeat across rows, legitimately: ${crossRow.join(', ') || '(none)'}`);
chk('every group has at least one row, and every enumeration at least two values',
  FACET_GROUPS.every((g) => g.rows.length > 0
    && g.rows.every((r) => r.kind === 'boolean' || r.values.length >= 2)),
  'a one-value enumeration is a boolean wearing a dropdown');
chk('every group declares the combinator as a FIELD with the one legal value (22.D8)',
  FACET_GROUPS.every((g) => g.combinator === 'any'),
  'the law is *any within a group, all across groups* and it is printed in words with no switch — making it '
  + 'data is what lets a later phase vary it without rewriting matchesFilter');

/** Each pair: the engine's registry, and the facet keys derived from it. Asserted as SETS, both ways. */
const registryPairs = [
  ['MATERIAL_PRESETS', MATERIAL_PRESETS.map((m) => `material:${m.name}`), ['material:None'],
    'a new material with no chip cannot be filtered for, and `material:None` is an invented absence value'],
  ['FILM_LOOKS', Object.keys(FILM_LOOKS).map((k) => `filmLook:${k}`),
    ['filmLook:none', `filmLook:${CUSTOMIZE_FILM_LOOK}`],
    '⚠️ `Customize` is NOT a FILM_LOOKS key and 172 presets store it — a catalogue built from the registry '
    + 'alone would omit the library\'s single largest value'],
  ['getAllPaletteNames()', getAllPaletteNames().map(([n]) => `palette:${n}`), ['palette:none'],
    'the longest row in the drawer, and the reason the facet search is a requirement'],
  ['PALETTE_MAPPING_ORDER', PALETTE_MAPPING_ORDER.map((m) => `mapping:${m}`), [],
    '⚠️ there is NO unset mapping — the resolver defaults to `depth`, so this row is a total partition'],
  ['TRANS_MAP_STYLES', TRANS_MAP_STYLES.map((m) => `tmStyle:${m.style}`), [],
    '⚠️ TRANS_MAP_STYLES is THE one enumeration and the type is wider by one — a style with no chip is '
    + 'unfilterable while still shipping'],
  ['CRYSTAL_SHAPES', CRYSTAL_SHAPES.map((s) => `crystalShape:${s}`), [], 'the one union with a runtime array'],
  ['ATTRACTOR_PRESETS[].type', [...new Set(ATTRACTOR_PRESETS.map((a) => a.type))].map((t) => `attractorType:${t}`), [],
    '⚠️ `.type` is a SIBLING of `params`, which is a `number[]` — `params.type` reads `undefined` on all of '
    + 'them and this clause is what would have caught the spec\'s original path'],
];
for (const [regName, derived, invented, why] of registryPairs) {
  const family = derived[0].split(':')[0] + ':';
  const inCatalogue = [...keys].filter((k) => k.startsWith(family));
  const expected = new Set([...derived, ...invented]);
  const missingChips = [...expected].filter((k) => !keys.has(k));
  const orphanChips = inCatalogue.filter((k) => !expected.has(k));
  chk(`${regName} → ${derived.length} chip(s)${invented.length ? ` + ${invented.length} invented` : ''}, and the catalogue matches BOTH ways`,
    derived.length > 0 && missingChips.length === 0 && orphanChips.length === 0,
    `missing ${JSON.stringify(missingChips.slice(0, 4))}, orphaned ${JSON.stringify(orphanChips.slice(0, 4))}. ${why}`);
}

/*
 * ⚠️ **THE FIVE UNIONS WITH NO RUNTIME ARRAY.** `LiquidSeedPattern`, `LiquidTintSource`, `ForceGateSource`, the
 * inline `ribbonMode` union and the inline dye `colourSource` union are TYPES: there is nothing to import. The
 * module's `Record<Union, string>` label maps are the enumeration and `tsc` forces them total — which covers
 * the direction "a member with no label". **This is the OTHER direction: a union that GREW.** It is a text scan
 * of the declaration, which is the pattern `coveragecheck` already uses for `RenderMode`, and each clause
 * asserts its anchor MATCHED.
 */
const typesTs = rd('src/presets/types.ts');
const interfacesTs = rd('src/core/interfaces.ts');
const unionScans = [
  ['RenderMode', interfacesTs, /export type RenderMode = ([^;]+);/, MODE_LABELS,
    'the mode is resolved through `resolveModeAgainstMaterial()`, so a new member needs a predicate as well as a chip'],
  ['LiquidTintSource', typesTs, /export type LiquidTintSource = ([^;]+);/, TINT_LABELS, ''],
  ['LiquidSeedPattern', typesTs, /export type LiquidSeedPattern = ([^;]+);/, SEED_PATTERN_LABELS, ''],
  ['ForceGateSource', typesTs, /export type ForceGateSource = ([^;]+);/, GATE_BY_LABELS,
    '⚠️ `none` is in the LABEL record (so tsc stays total) and DROPPED from the chips — a live gate cannot be '
    + 'gated by nothing'],
  ['CrystalShape', typesTs, /export type CrystalShape = ([^;]+);/, CRYSTAL_SHAPE_LABELS, ''],
  ['OverlayState.ribbonMode', typesTs, /ribbonMode\?: *([^;]+);/, RIBBON_LABELS, ''],
  ['DyeFieldConfig.colourSource', typesTs, /colourSource: *([^;]+);/, DYE_COLOUR_LABELS, ''],
];
for (const [name, text, re, labels, why] of unionScans) {
  const m = re.exec(text);
  const declared = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  const labelled = Object.keys(labels);
  chk(`${name} declares ${declared ? declared.length : '?'} member(s) and the label record covers them BOTH ways`,
    declared !== null && declared.length > 0
    && declared.every((d) => labelled.includes(d)) && labelled.every((l) => declared.includes(l)),
    declared === null
      ? '⚠️ THE ANCHOR MATCHED NOTHING, so this clause was asserting nothing — re-point the regex at the '
        + 'declaration, do not delete the clause'
      : `declared ${JSON.stringify(declared)} vs labelled ${JSON.stringify(labelled)}. ${why}`);
}

/*
 * ⚠️⚠️ **THE `Deformed` CHIP AGAINST `OVERLAY_RULES`' `shape` GROUP — WRITTEN 2026-10-27 BECAUSE THE
 * PREDICATE HAD ALREADY BEEN WRONG FOR A WHOLE PHASE AND NOTHING HERE SAW IT.** Phase 32 added taper, bend
 * and spherical inversion and added none of them to `particles:deformed`, so two shipped demo presets
 * (`Pipes Taper`, `Pipes Bend`) could not be found by the one chip that exists to find them — 4 matched
 * against 6 genuinely deformed, measured over the composed library.
 *
 * **Why every other section was blind to it.** §B scanned the categorical UNIONS, which this is not. §D
 * measures the distribution, and a chip that is low by two is perfectly plausible behind a handful of
 * presets. §E seeds the predicates *as they would actually be written*, and the omission is not a wrong
 * predicate — it is a missing CLAUSE, which reads exactly like a correct predicate over a shorter list. §F
 * tests the filter law. **The gap was that no clause compared the predicate to a registry of operators**,
 * because `preset-facets.ts` was the only place the operator list existed — one hand-written enumeration
 * with nothing to disagree with it.
 *
 * ⚠️ **THE COMPARISON IS PER FAMILY, NOT PER KEY, AND THAT IS WHAT MAKES IT CHEAP ENOUGH TO BE TRUE.** A
 * per-key rule would need an exemption for every companion field — `boxFoldLimit`, `invertRadius`, the three
 * 4D angles — since only the GATE belongs in the predicate (`22.D4`). Folding the keys to their prefix
 * leaves one entry per operator, so the exemptions below are three families rather than a dozen keys, and
 * **a seventh operator family fails this clause until someone decides which side it is on.**
 */
/*
 * ⚠️ **v8 `34.5` — TWO ALTERNATIVES ADDED (`offset`, `grow`), AND THE PREFIX FOLD IS WHAT KEPT PHASE 34'S
 * TWENTY-EIGHT NEW `shape` KEYS DOWN TO TWO NEW DECISIONS.** The phase's naming convention is deliberately
 * `<operatorPrefix><Axis|Qualifier>` — `offsetDepthX`, `growRateZ`, `travelRateY`, `sharpnessStructure` —
 * so every new key folds onto an operator that already has a decision or needs exactly one. Naming the
 * depth keys after their LABELS (`sway*`, `flare*`, `stretch*`) would have created four more families, each
 * owing its own §B decision plus an alias table in this checker. **The key vocabulary and the label
 * vocabulary diverge on purpose; the correspondence is written down in `deform-limits.ts`'s section headers
 * and nowhere else.**
 */
const SHAPE_FAMILY_OF = (k) => {
  const m = /^(twist|taper|bend|boxFold|fractalFold|invert|channel|travel|sharpness|offset|grow)/.exec(k);   // v8 Phase 38: + fractalFold
  if (m) return m[1];
  if (/^w[A-Z]/.test(k)) return 'rot4d';
  return k;
};
/** Families in `group: 'shape'` that are deliberately NOT model-space deformations. Each needs a reason. */
const NOT_DEFORMATION = {
  sharpness: 'v8 33.2 — it changes the generator\'s BASIS FUNCTION (sine toward triangle), not positions '
    + 'as a function of position. Every real member of the chip maps a point AFTER the wave sum; this one '
    + 'changes what the sum is made of, so the chip would be wrong about it. '
    + '⚠ It still belongs to group `shape` because it changes the figure — "not a deformation" '
    + 'and "not a shape control" are different claims and only the first is being made here.',
  travel: 'v8 33.3 — a secular (linear) term added to the wave sum. It does not bend the figure, it stops '
    + 'the figure CLOSING: an arc with two free ends instead of a loop. 33.D10 gives it its OWN chip '
    + '(`Open figure`) because *which presets are not a closed loop* is a different question from *which '
    + 'presets bend their figure*, and 30.D18\'s "one row answers the question a user has" cuts that way. '
    + '⚠ So this is an exemption from `Deformed` ONLY — it is not an exemption from having a '
    + 'chip at all, and if that chip is ever removed this entry must be re-argued, not kept.',
  figureScale: 'a uniform view scale — it changes the figure\'s SIZE, not its shape, so every preset would match',
  particleSize: 'a per-draw point size; it never touches a position',
  offset: 'v8 `34.2` — an exact RIGID TRANSLATION of the whole figure (the specification measures max '
    + 'deviation from a clean shift at `0.00e+0`). Every real member of the chip maps a point AS A FUNCTION '
    + 'OF POSITION after the wave sum; this adds the same constant to every particle, so the chip would be '
    + 'wrong about it. ⚠ It is NOT `travel`\'s case either: travel stops the figure CLOSING and earned its '
    + 'own `Open figure` chip, while an offset leaves the curve closed and congruent — only its placement, '
    + 'and therefore the ORBIT its rotation traces, changes. Whether it deserves a chip of its own '
    + '(*Off-centre*) is the owner\'s call under `30.D18`; the Randomiser cannot reach it (`34.D13`, all '
    + 'nine keys `frozen`), so no preset gains one by accident.',
  grow: 'v8 `34.3` — an amplitude RAMP along the particle INDEX: it scales the wave sum by a function of '
    + '`tau`, not of position, so like `sharpness` it changes what the sum is MADE OF rather than mapping '
    + 'the sum. ⚠⚠ **THE TENSION IS REAL AND IS STATED HERE RATHER THAN HIDDEN: `grow` changes the '
    + 'SILHOUETTE materially** (a cone out of a circle), and a user hunting for *figures whose shape is '
    + 'operated on* would reasonably expect to find it. **The RULE decides it, not the intuition** — the '
    + 'chip\'s own members all map a point after the wave sum. If the owner wants it findable, the answer is '
    + 'a chip of its own, never a widening of `Deformed`. ⚠ This is the close call of Phase 34\'s two '
    + 'exemptions; `offset` is not close at all.',
  channel: 'per-particle size/alpha/lightness (`31.2`) — an APPEARANCE channel, not a position operator. '
    + '⚠️ It therefore has NO chip of its own, which is a real gap in the drawer rather than a decision: '
    + '3 presets use one today and no filter can find them. Raising it is the owner\'s call (`30.D18`\'s '
    + 'argument cuts both ways), but it must not be answered by widening `Deformed`.',
};
{
  /*
   * ⚠️ **READ RAW, NOT STRIPPED, AND THE REASON IS THE OPPOSITE OF THE PREDICATE SCAN BELOW.** Here the
   * thing being read IS a string literal — `group: 'shape'` — so `stripCommentsAndStrings` would blank
   * exactly the value this depends on. The predicate scan twenty lines down wants the opposite treatment
   * for the same reason: there the string literals are PROSE and must not be allowed to satisfy it.
   */
  const rulesRaw = rd('src/exploration/overlay-rules.ts');
  let cur = null; const shape = [];
  for (const line of rulesRaw.split('\n')) {
    const m = /^ {2}(\w+):\s*\{/.exec(line);
    if (m) cur = m[1];
    if (/group:\s*'shape'/.test(line) && cur) shape.push(cur);
  }
  chk(`the \`shape\` group anchor reaches the registry (${shape.length} key(s) found)`,
    shape.length > 10,
    'the `shape` group of `OVERLAY_RULES` is the registry the next clause compares against. ⚠️ A count near '
    + 'zero means the ANCHOR broke, not that the group emptied — re-point it, never delete the clause');

  const families = [...new Set(shape.map(SHAPE_FAMILY_OF))];
  /*
   * ⚠️ **THE PREDICATE BODY ALONE, SLICED FROM `(r) =>` ONWARD, AND BOTH BOUNDS ARE DELIBERATE.**
   *
   * - **Comments stripped**, so a `// v8 32.1` note naming an operator cannot stand in for a clause.
   * - **STRINGS NOT stripped, and the slice is what makes that safe.** `stripCommentsAndStrings` blanks
   *   `'particles:deformed'` itself — the facet key is a string literal — so a stripped corpus has nothing
   *   to anchor on. ⚠️ **This clause FAILED exactly that way when it was first written**, reporting *the
   *   anchor matched nothing*, which is the honest failure the anchor-assertions in this file exist for.
   *   Starting at `(r) =>` leaves the tip string OUTSIDE the corpus instead, which is the property that
   *   actually matters: the old tip named *"the bias"*, an operator that had been dropped, and prose must
   *   never be allowed to satisfy a coverage scan.
   */
  const facetsSrc = rd(SUBJECT).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const at = facetsSrc.indexOf("bool('particles:deformed'");
  const from = at < 0 ? -1 : facetsSrc.indexOf('(r) =>', at);
  const predicate = from < 0 ? '' : facetsSrc.slice(from, (() => {
    const nxt = facetsSrc.indexOf('\n    bool(', from);
    return nxt < 0 ? facetsSrc.length : nxt;
  })());
  const covers = (fam) => shape.filter((k) => SHAPE_FAMILY_OF(k) === fam)
    .some((k) => new RegExp(`\\.${k}\\b`).test(predicate));
  const unexplained = families.filter((f) => !covers(f) && !(f in NOT_DEFORMATION));
  chk(`the \`Deformed\` predicate names a gate for every one of ${families.length} \`shape\` families, `
    + `or exempts it by name`,
    predicate.length > 0 && unexplained.length === 0,
    predicate.length === 0
      ? '⚠️ THE PREDICATE ANCHOR MATCHED NOTHING — re-point it, do not delete the clause'
      : `unexplained ${JSON.stringify(unexplained)}. Each is a `
        + `model-space operator with no clause in the chip, OR an appearance field owed an entry in `
        + `NOT_DEFORMATION with a reason. ⚠️ Adding a deformation is a TWO-file edit`);
  seed('§B the `Deformed` family scan sees a DROPPED clause',
    (() => {
      const broken = predicate.replace(/\.taper[XYZ]\b/g, '.__gone');
      const c = (fam) => shape.filter((k) => SHAPE_FAMILY_OF(k) === fam)
        .some((k) => new RegExp(`\\.${k}\\b`).test(broken));
      return families.filter((f) => !c(f) && !(f in NOT_DEFORMATION)).length;
    })(),
    'with every `taper*` read removed the scan must report `taper` unexplained — if it does not, the clause '
    + 'is matching something other than the predicate body and would have passed over Phase 32 too');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. the labels are the SHIPPED words, not invented friendlier ones (22.D12) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A drawer that renames the features is a second vocabulary the owner has to learn**, and the cost lands
 * later: a facet called "Smoke plumes" and a Lab section called `Buoyancy` are two names for one thing, and
 * nothing will ever reconcile them. So each word below must appear as a STRING LITERAL in the shipped UI.
 *
 * ⚠️ **This is a TEXT SCAN over `src/ui/`, so a behaviour-neutral rename breaks it** — read the assertion
 * before believing a failure is a regression. It cannot import those modules: they are `lit` components with
 * side effects, and importing one under Node fails on `customElements`.
 *
 * ⚠️ **The ⚙ INVENTED words are declared here WITH their reason, and declaring one is the cost of inventing
 * it.** `22.D12` requires a shipped heading wherever one exists; a band over a quantity the UI never names as
 * a number has no heading to borrow, and that is the only licence.
 */
const uiFiles = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.ts')) uiFiles.push(readFileSync(p, 'utf8'));
  }
})(join(SRC, 'ui'));
const uiText = uiFiles.join('\n');
chk(`§C is pointed at ${uiFiles.length} file(s) under src/ui/`, uiFiles.length > 5,
  'a scan over an empty corpus passes every clause below it');

/**
 * ⚙ invented, with the reason. A word here is NOT required to appear in the UI.
 * ⚠️ **Four of these entries exist because the first run of this clause found them, and each needed a DECISION
 * rather than a looser anchor** — which is the whole value of the clause: the alternative was to widen the scan
 * until the inventions passed, and then no invention would ever be visible again.
 */
const INVENTED = {
  /*
   * v8 `36.15`. ⚠️⚠️ **THIS ONE IS NOT ACTUALLY AN INVENTION, AND THE DISTINCTION IS WORTH THE
   * ENTRY RATHER THAN A WIDENED SCAN.** `Self-similar curve` is the figure-type registry's own
   * `label` in `src/generators/figure-types.ts`, and the Composer's dropdown ships it DERIVED from
   * there rather than restated — which is the property `36.20` clause 1 asserts. So it IS a shipped
   * literal; §C simply cannot see it, because its corpus is `src/ui/` and the registry is not in it.
   *
   * ⚠️ **Declared rather than widening §C, on this clause's own advice** (*widening the scan instead
   * is how a private vocabulary grows one word at a time*) — and recorded as a SCOPE gap rather than
   * as a private word, so a later reader does not 'fix' it by renaming the chip.
   */
  'Self-similar curve': 'the figure-type registry label, shipped via the Composer dropdown; outside the src/ui corpus that section C scans',
  // v8 Phase 30. The Visual FX section ships the NOUN, `Deformation`; a filter chip needs the
  // adjective, because every row in its group answers *presets that ARE this* (`Sparks`, `Crystals`,
  // `Buoyancy`). ⚠️ **Declared rather than renamed, and the alternative was considered**: calling the
  // chip `Deformation` would make it a shipped literal and need no entry here, at the cost of a chip
  // that reads as a category rather than as a property. **One word of private vocabulary, bought
  // deliberately and recorded, which is what this list is for.**
  Deformed: 'the adjective of the shipped `Deformation` section heading — a chip states a property of a '
    + 'preset, so the group that holds Sparks/Crystals/Buoyancy cannot hold a noun',
  // v8 33.3. The shipped control is `Travel` and the shipped section is `Curve Basis`; neither is the
  // right chip word, because a chip states what a preset IS. ⚠️ `Travel` as a chip would read as a
  // category of motion and collide with the Motion & Fields group; `Open figure` states the property the
  // user can actually see — two free ends instead of a loop — and is the only figure in the library that
  // is not a closed curve. Bought deliberately, like `Deformed` above.
  'Open figure': 'the shipped control is `Travel` and the shipped section `Curve Basis`; a chip must state '
    + 'a property, and the visible property is that the curve does not close',
  Winding: 'the UI never prints a winding number: `FM.Base` reaches the user as a Composer FIGURE, not a value, '
    + 'and the measured range is 0–8000 (22.D2)',
  1: 'a Winding band — see `Winding`', '2–4': 'a Winding band', '5–16': 'a Winding band',
  '17–64': 'a Winding band', '65–256': 'a Winding band', '257–1024': 'a Winding band',
  'over 1024': 'a Winding band',
  '1 slot': 'a Live Waves band — see `Live Waves`', '2 slots': 'a Live Waves band', '3 slots': 'a Live Waves band',
  '3D': 'the live half of `Flat / 3D`. ⚠️ `Flat` IS shipped (the Composer prints `flat here — no reach in this '
    + 'plane`), so only its opposite had to be invented',
  Square: 'a Design aspect value', Landscape: 'a Design aspect value', Portrait: 'a Design aspect value',
  'Crystal Shape': 'the Crystals section ships the control as `Shape`; a drawer row reading `Shape` alone, '
    + 'between `Sparks` and `Buoyancy`, does not say whose',
  'Attractor Type': 'the Lab ships the control as `Preset` inside an `Attractor` section — a row heading reading '
    + '`Preset` inside a PRESET filter is the one word this drawer cannot borrow',
  'Palette Mapping': 'the Lab ships the control as `Map`, a two-letter heading that carries its meaning only '
    + 'from the row above it',
  Crisp: 'a Trail Decay band. The slider prints a decay coefficient; no shipped word divides its range, so the '
    + 'four band names are invented together',
  Medium: 'a Trail Decay band — see `Crisp`',
  Long: 'a Trail Decay band — see `Crisp`. ⚠️ The word occurs in a crystal-lifetime tooltip as PROSE, which is '
    + 'not the same as shipping it as a label, and the scan is deliberately unable to tell the difference',
  'Very long': 'a Trail Decay band — see `Crisp`',
  'Live Waves': 'a count of non-silent slots; the Composer shows the slots but never counts them',
  'Flat / 3D': 'derived from whether any live slot drives Z; no control names this',
  'Design aspect': 'from `metadata.designResolution`, which has no UI at all',
  'Fixed colour': 'the STORED word is `fixed`, and a chip reading `Fixed` beside `Temperature`, `Velocity` and '
    + '`Depth` says nothing about what is fixed — the noun is the minimum honest expansion',
  'Force Gate': '⚠️ the Lab ships the gate as FOUR controls — `Gate By`, `Gate Amount`, `Gate Half-Life`, '
    + '`Invert Gate` — under the force section and never names the feature itself. `CLAUDE.md`\'s subsystem '
    + 'table calls it the force gate; a chip needs the noun the four controls share',
  Populations: 'the group heading (22.D13); the Lab has no section by this name',
  'Motion & Fields': 'a group heading spanning six subsystems that ship as separate sections',
  'Particles & Trails': 'a group heading', 'Colour & Grade': 'a group heading',
  Surfaces: 'a group heading', Figure: 'a group heading',
  'Chain of 2+': 'a structural property of the chain, not a control',
  'Warp first': 'reads `warpFirst`, which ships as a checkbox whose label is a sentence',
  'Symmetry fold': 'reads `symmetryFold`, a numeric control — the chip is the feature being ON at all',
  'No material': 'an invented absence value', 'No palette': 'an invented absence value',
  'No film look': 'an invented absence value', 'No ribbons': 'an invented absence value',
};
const REQUIRED_SHIPPED = [
  'Translation Map', 'Buoyancy', 'Trail Decay', 'Curl Noise', 'Fluid Advection', 'Physarum Network',
  'Liquid Surface', 'Liquid Field', 'Dye Field', 'Cohesion', 'Volume Render', 'Ribbon Rendering',
  'Neon Lines', 'Render Mode', 'Attractor', 'Colour Palette', 'Film Look', 'Sparks', 'Crystals',
];
const notShipped = REQUIRED_SHIPPED.filter((w) => !uiText.includes(`'${w}'`) && !uiText.includes(`>${w}<`)
  && !uiText.includes(`"${w}"`) && !uiText.includes(`${w}<`) && !uiText.includes(`>${w}`));
chk(`all ${REQUIRED_SHIPPED.length} words 22.D12 names as shipped headings appear in src/ui/`,
  notShipped.length === 0,
  `absent: ${JSON.stringify(notShipped)} — either the heading was renamed (re-point the facet label at the new `
  + 'word) or the facet invented one (declare it in INVENTED with its reason)');

const allWords = new Set(ALL_FACETS.map((f) => f.label));
for (const g of FACET_GROUPS) {
  allWords.add(g.label);
  for (const r of g.rows) if (r.kind === 'enum') allWords.add(r.label);
}
/*
 * ⚠️ **THREE TIERS, AND THE SCAN IS NOT WIDENED TO ABSORB A FAILURE.** Tier 1 is a QUOTE-DELIMITED literal or a
 * lit text node — strong evidence the word is a label. Tier 2 is membership of an engine REGISTRY, compared
 * case-insensitively, because a chip legitimately sentence-cases a stored lowercase word (`hexagon` → `Hexagon`)
 * and that is typography, not a second vocabulary. Tier 3 is a declared invention.
 *
 * ⚠️ **Tier 1 is deliberately NOT a substring search.** `Wave Shift` occurs inside a tooltip SENTENCE and
 * `Long` inside *"How long a crystal lasts"* — a substring scan would have passed both, and passed every future
 * invention that happens to appear in prose. `Wave Shift` is instead tier 2 (it is `TRANS_MAP_STYLES[].name`,
 * ⚠️ **`.name`, NOT `.label` — the registry has no `label` field at all, and reading the wrong one yields the
 * empty string for every style, which compares equal to nothing and fails silently in the direction of MORE
 * work**), and `Long` is tier 3.
 */
const registryWords = new Set([
  ...getAllPaletteNames().map(([, l]) => l), ...getAllPaletteNames().map(([n]) => n),
  ...Object.keys(FILM_LOOKS), CUSTOMIZE_FILM_LOOK,
  ...MATERIAL_PRESETS.flatMap((m) => [m.label, m.name]),
  ...TRANS_MAP_STYLES.map((m) => m.name),
  ...CRYSTAL_SHAPES, ...ATTRACTOR_PRESETS.flatMap((a) => [a.type, a.name]),
  // ⚠️ **`PALETTE_MAPPING_LABELS`, the ENGINE's record — NOT the subject's `MAPPING_LABELS`**, even though the
  // subject now re-exports the same object. An exemption drawn from the subject's own labels would exempt every
  // label from itself, and the clause would pass forever while asserting nothing. `MODE_LABELS` is deliberately
  // NOT here for the same reason: it is defended by the `visual-fx.ts` cross-check at the end of this section.
  ...Object.values(PALETTE_MAPPING_LABELS),
].filter((w) => typeof w === 'string' && w.length > 0).map((w) => w.toLowerCase()));
const tier1 = (w) => uiText.includes(`'${w}'`) || uiText.includes(`"${w}"`) || uiText.includes(`>${w}<`);
const tier2 = (w) => registryWords.has(w.toLowerCase());
const undeclared = [...allWords].filter((w) => !(w in INVENTED) && !tier1(w) && !tier2(w));
chk('every other facet or group word is a shipped LITERAL, a registry member, or a DECLARED invention',
  undeclared.length === 0,
  `undeclared: ${JSON.stringify(undeclared)}. ⚠️ Declaring an invention is the cost of making one, and widening `
  + 'the scan instead is how a private vocabulary grows one word at a time');
note(`${[...allWords].filter(tier1).length} word(s) are shipped literals, ${[...allWords].filter((w) => !tier1(w) && tier2(w)).length} `
  + `are registry members, ${[...allWords].filter((w) => w in INVENTED).length} are declared ⚙ invented`);

/*
 * ⚠️ **`MODE_LABELS` IS A SECOND COPY OF `visual-fx.ts`'s `RENDER_MODE_LABELS`, AND DELIBERATELY SO** — that one
 * is in a `lit` module the subject may not import. This is the clause that keeps the copies in step, and it is
 * the ONE `tsc`-enforced site for render-mode labels turning into two, so it has to be a text scan.
 */
const visualFx = rd('src/ui/synthesis-lab/tabs/visual-fx.ts');
const rmDecl = /RENDER_MODE_LABELS[^=]*= *\{([^}]+)\}/.exec(visualFx);
const shippedModeLabels = rmDecl ? [...rmDecl[1].matchAll(/'([^']*)'/g)].map((m) => m[1]) : null;
chk('every MODE_LABELS string also appears in visual-fx.ts\'s RENDER_MODE_LABELS',
  shippedModeLabels !== null && shippedModeLabels.length > 0
  && Object.values(MODE_LABELS).every((l) => shippedModeLabels.includes(l)),
  shippedModeLabels === null
    ? '⚠️ THE ANCHOR MATCHED NOTHING — re-point it at the declaration rather than deleting the clause'
    : `visual-fx.ts declares ${JSON.stringify(shippedModeLabels)} vs ${JSON.stringify(Object.values(MODE_LABELS))}`);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. the DISTRIBUTION — the only instrument for a plausible-but-wrong predicate ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE THREE GATES, AND EACH SEES A DIFFERENT DEFECT.** A ceiling sees a presence test (it reports a huge
 * number). A floor sees an absent field path (it reports zero). **Neither sees a sub-enumeration that lost its
 * parent's gate** — those numbers stay small and plausible — which is what the sum clauses are for. Every gate
 * is a FUNCTION of a counts map so §E can run it over a broken predicate, which is the only way a gate can be
 * shown to discriminate.
 *
 * ⚠️ **Every enumeration must be declared, and there are exactly THREE legal shapes**, each with a different
 * arithmetic: a PARTITION of the library (sums to N), a SUB-ENUM of a named parent (sums to the parent), or a
 * MULTI-VALUED row where one preset can match several chips (sums to AT LEAST its parent, and the equality has
 * no basis to be at). The completeness of the declaration is itself asserted, because **an undeclared
 * enumeration escapes all three gates** — the ceiling and the floor read booleans only.
 *
 * ⚠️ **The third shape is not a loophole and must be justified in words, not merely listed.** `tmStyle` is the
 * only member: a chain of two styles contributes two chips from one preset, so no equality holds. Putting an
 * enumeration here to make a failing sum go away would discard the clause; the sum failing is nearly always a
 * lost parent gate.
 */
const BOOLEAN_KEYS = FACET_GROUPS.flatMap((g) => g.rows.filter((r) => r.kind === 'boolean').map((r) => r.facet.key));
/** A boolean facet over this share of the library is a presence test until proven otherwise. */
const CEILING = 0.60;
/** ⚠️ **The ONE declared exception, with its reason** — adding a second one is a decision, not a maintenance step. */
const CEILING_EXCEPTIONS = {
  'tm:enabled': 'the warp is the engine\'s most-used feature and 178/274 is the measured truth — `transMapEnabled` '
    + 'is a real activation scalar, resolved from two sources, and every other TransMap facet sits under 11%',
};
const ceilingGate = (c) => BOOLEAN_KEYS.filter((k) => (c.get(k) ?? 0) / N > CEILING && !(k in CEILING_EXCEPTIONS));
const floorGate = (c) => BOOLEAN_KEYS.filter((k) => (c.get(k) ?? 0) === 0);

const PARTITIONS = ['material', 'mode', 'ribbon', 'trailDecay', 'liveWaves', 'flat3d', 'winding', 'aspect',
  'palette', 'mapping', 'filmLook'];
/** sub-enum id → the boolean facet key whose count it must sum to. */
const SUB_ENUMS = {
  crystalShape: 'pop:crystals', seedPattern: 'motion:liquidField', dyeColour: 'motion:dye',
  gateBy: 'motion:forceGate', tint: 'surface:liquid', attractorType: 'figure:attractor',
};
/** id → parent boolean, asserted with ≥ because one preset contributes several chips. Justify any addition. */
const MULTI_VALUED = { tmStyle: 'tm:enabled' };
const enumRows = FACET_GROUPS.flatMap((g) => g.rows.filter((r) => r.kind === 'enum'));
const declaredIds = (r) => PARTITIONS.includes(r.id) || r.id in SUB_ENUMS || r.id in MULTI_VALUED;
chk(`all ${enumRows.length} enumerations are declared: ${PARTITIONS.length} partition(s), ${Object.keys(SUB_ENUMS).length} sub-enum(s), ${Object.keys(MULTI_VALUED).length} multi-valued`,
  enumRows.every(declaredIds),
  `undeclared: ${JSON.stringify(enumRows.filter((r) => !declaredIds(r)).map((r) => r.id))}. `
  + '⚠️ An undeclared enumeration escapes all three gates — the ceiling and floor only read booleans');

const sumOf = (c, id) => {
  const row = enumRows.find((r) => r.id === id);
  return row ? row.values.reduce((a, v) => a + (c.get(v.key) ?? 0), 0) : NaN;
};
const partitionGate = (c) => PARTITIONS.filter((id) => sumOf(c, id) !== N);
const subEnumGate = (c) => Object.entries(SUB_ENUMS).filter(([id, parent]) => sumOf(c, id) !== (c.get(parent) ?? 0));

chk(`no boolean facet exceeds ${Math.round(CEILING * 100)}% of the library, bar ${Object.keys(CEILING_EXCEPTIONS).length} declared exception(s)`,
  ceilingGate(counts).length === 0,
  `over the ceiling: ${JSON.stringify(ceilingGate(counts).map((k) => `${FACET_LABELS[k]} ${cnt(k)}/${N}`))}. `
  + '⚠️ This is what a presence test looks like. Read it as a claim about the PREDICATE first');
chk('every boolean facet matches at least one preset',
  floorGate(counts).length === 0,
  `empty: ${JSON.stringify(floorGate(counts).map((k) => FACET_LABELS[k]))}. ⚠️ Either the field path is wrong `
  + '(the plural `crystals` class) or no preset uses the feature — the second needs a declared reason, and the '
  + 'first is the defect this clause exists for');
chk(`all ${PARTITIONS.length} partitioning enumerations sum to exactly ${N}`,
  partitionGate(counts).length === 0,
  `not a partition: ${JSON.stringify(partitionGate(counts).map((id) => `${id}=${sumOf(counts, id)}`))}. ⚠️ A `
  + 'partition summing LOW means a value with no chip (a preset falls through every one); summing HIGH means '
  + 'two chips both match — the second is worse, because the drawer then double-counts');
chk(`all ${Object.keys(SUB_ENUMS).length} sub-enumerations sum to exactly their PARENT facet\'s count`,
  subEnumGate(counts).length === 0,
  `disagreeing: ${JSON.stringify(subEnumGate(counts).map(([id, p]) => `${id}=${sumOf(counts, id)} vs ${FACET_LABELS[p]}=${cnt(p)}`))}. `
  + '⚠️ **The only clause that can see a sub-enum which lost its parent\'s gate** — those counts stay small and '
  + 'plausible, so no floor and no ceiling will ever fire on one');

const multiGate = (c) => Object.entries(MULTI_VALUED).filter(([id, parent]) => sumOf(c, id) < (c.get(parent) ?? 0));
chk(`the multi-valued row sums to AT LEAST its parent (tmStyle ${sumOf(counts, 'tmStyle')} ≥ Translation Map ${cnt('tm:enabled')})`,
  multiGate(counts).length === 0,
  `${JSON.stringify(multiGate(counts).map(([id, p]) => `${id}=${sumOf(counts, id)} < ${FACET_LABELS[p]}=${cnt(p)}`))}. `
  + '⚠️ Below the parent means a live warp with NO live style — `isInertModifier` firing on a preset that does '
  + 'warp, which is the direction that loses presets from the drawer rather than adding them');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. seeded defects — the predicates that would ACTUALLY be written ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **EACH SEED RUNS THE GATES FROM §D, NOT A BESPOKE ASSERTION.** That is the whole design: a seed proves the
 * SHIPPED gate discriminates. A seed with its own oracle proves only that a broken thing can be detected by
 * something, which is never in doubt.
 *
 * The recipe is always the same — recount ONE facet with the naive predicate, splice it into a copy of the
 * counts map, and run the gate that should fire. **Which gate fires is part of the seed**, and a seed that
 * fires the wrong gate is reported by name.
 */
const ovOf = (n) => mgr.get(n).overlay ?? {};
const recount = (key, pred) => {
  const c = new Map(counts);
  c.set(key, NAMES.filter((n) => pred(mgr.get(n), ovOf(n))).length);
  return c;
};

seed('the presence test: `overlay.physarum` present instead of `blend > 0`',
  ceilingGate(recount('motion:physarum', (p, ov) => !!ov.physarum)).length,
  '179 of 274 carry the block and 176 of those are byte-identical — the CEILING is the instrument, and the '
  + 'honest answer is 2');
seed('the default-true boolean: `physarum.showTrail === true`',
  ceilingGate(recount('motion:physarum', (p, ov) => ov.physarum?.showTrail === true)).length,
  '`showTrail` defaults to `true` INSIDE the default block, so this reads 178 — a boolean sub-field of a default '
  + 'block is never an activation scalar (22.D4)');
seed('the plural field name: `overlay.crystals` instead of the SINGULAR `overlay.crystal`',
  floorGate(recount('pop:crystals', (p, ov) => ov.crystals?.enabled === true)).length,
  '⚠️ **This was a REAL defect in the spec.** `OverlayState` is all-optional, so the typo is not a type error — '
  + 'it reads 0 of 274 in silence, and only a FLOOR can see it');
seed('the blend without the index: `attractorBlend > 0` alone',
  ceilingGate(recount('figure:attractor', (p, ov) => (ov.attractorBlend ?? 0) > 0)).length,
  '`attractorBlend` defaults to 0.6, so 179 presets "have an attractor" while `main.ts` hands the generator '
  + '`null` on all but 9 of them');
seed('the index without the blend — the spec\'s OWN predicate, corrected while building 22.1',
  subEnumGate(recount('figure:attractor', (p, ov) => (ov.attractorIndex ?? -1) >= 0)).length,
  '⚠️ **Neither the floor nor the ceiling can see this**: 10 instead of 9 is entirely plausible. The SUB-ENUM '
  + 'sum is the instrument — `Attractor Type` gates on the blend, so the parent and its children disagree by '
  + 'exactly `Particle Swarm II`, which 22.D4a names as its example of authored-but-inert');
/*
 * ⚠️ **TWO DEFECT CLASSES ARE UNREACHABLE THROUGH THE LIBRARY, AND THAT IS A MEASUREMENT, NOT A GAP TO WAIVE.**
 * Both were written as library seeds first and both came back NOT CAUGHT, which is the calibration working:
 *
 *   • **A lost parent gate cannot be seeded from the library**, because no library preset carries an
 *     authored-but-DISABLED sub-block: liquid field 4 present / 4 enabled, crystal 8 / 8, dye 5 / 5. Dropping
 *     `enabled` from the predicate therefore changes no count TODAY — and would change many the first time the
 *     owner unticks a box and saves, which is the likeliest way it would ever ship.
 *   • **The render-mode resolver is a no-op over today's library** — all 274 presets store the mode a live
 *     material would have forced anyway, so `renderer.mode` read raw agrees with the resolver on every one. A
 *     mis-resolved partition is also still a partition, so §D's sum clause is blind to it by construction; that
 *     is exactly why invariant 17 is a rule about resolution ORDER and not about totals.
 *
 * So both are seeded against FIXTURES built by mutating a real preset, and the honest predicate is asserted on
 * the same fixture in the same breath. ⚠️ **A fixture is where false passes live** — each one below is a clone
 * of a preset found BY PREDICATE at run time rather than by name, so a settle that renames it cannot silently
 * empty the seed.
 */
const crystalName = NAMES.find((n) => ovOf(n).crystal?.enabled === true && ovOf(n).crystal?.shape !== undefined);
const materialName = NAMES.find((n) => {
  const m = ovOf(n).material;
  return !!m && !!m.preset && m.preset !== 'None' && m.preset !== 'Liquid';
});
chk('§E\'s fixtures have a donor preset in the library',
  crystalName !== undefined && materialName !== undefined,
  `crystal donor ${crystalName}, material donor ${materialName} — ⚠️ an absent donor makes every fixture seed `
  + 'below throw or, worse, assert nothing');

const inertCrystal = structuredClone(mgr.get(crystalName));
inertCrystal.overlay.crystal.enabled = false;
const shapeRow = enumRows.find((r) => r.id === 'crystalShape');
const crystalCounts = (pred) => {
  const c = new Map(counts);
  for (const k of computeFacets(inertCrystal)) c.set(k, (c.get(k) ?? 0) + 1);
  for (const v of shapeRow.values) {
    const shape = v.key.split(':')[1];
    c.set(v.key, [...NAMES.map((n) => mgr.get(n)), inertCrystal]
      .filter((p) => pred(p.overlay ?? {}, shape)).length);
  }
  return c;
};
chk(`an authored-but-DISABLED crystal block matches neither the population nor a shape (22.D4a, fixture from ${crystalName})`,
  !computeFacets(inertCrystal).has('pop:crystals')
  && shapeRow.values.every((v) => !computeFacets(inertCrystal).has(v.key))
  && subEnumGate(crystalCounts((ov, s) => ov.crystal?.enabled === true && ov.crystal?.shape === s)).length === 0,
  '⚠️ **22.D4a is the decision that a facet answers "will I see this", not "was this authored"** — and it has an '
  + 'equally natural opposite reading, which is why it is asserted rather than left to the predicate');
seed('the sub-enum that lost its parent\'s gate: `crystal.shape` without `crystal.enabled`',
  subEnumGate(crystalCounts((ov, s) => ov.crystal?.shape === s)).length,
  'the shape row gains the inert fixture while the parent facet does not — small, plausible numbers that no '
  + 'floor and no ceiling can see, and the SUM is the only thing that disagrees');

const starWithMaterial = structuredClone(mgr.get(materialName));
starWithMaterial.overlay.renderMode = 'star';
const liquidWithMaterial = structuredClone(mgr.get(materialName));
liquidWithMaterial.overlay.renderMode = 'liquid';
const splatNoMaterial = structuredClone(mgr.get(materialName));
splatNoMaterial.overlay.renderMode = 'splat';
delete splatNoMaterial.overlay.material;
const modeOf = (p) => [...computeFacets(p)].find((k) => k.startsWith('mode:'));
chk(`a live material OVERRIDES the stored mode (fixture from ${materialName}: stored star → ${modeOf(starWithMaterial)})`,
  modeOf(starWithMaterial) === 'mode:splat',
  '⚠️ resolved through `resolveModeAgainstMaterial()`, the ONE owner — invariant 17: two sources mean every '
  + 'reader resolves them in the same order, and grepping the readers is what exonerated the buggy file last time');
chk(`...and liquid is the ONE mode a material cannot take away (stored liquid → ${modeOf(liquidWithMaterial)})`,
  modeOf(liquidWithMaterial) === 'mode:liquid',
  'the exemption is the first line of the resolver and five library presets are exactly this shape');
chk(`...and splat with NO material falls back to ${modeOf(splatNoMaterial)}, because splat with no material draws NOTHING`,
  modeOf(splatNoMaterial) === 'mode:star',
  '⚠️ **this rule moves no library figure today (0 of 274) and is still the honest predicate**: the facet says '
  + 'what the frame does, and that frame has no splat in it');
seed('the un-resolved mode: `overlay.renderMode ?? renderer.mode` without the resolver',
  (starWithMaterial.overlay.renderMode ?? starWithMaterial.renderer?.mode ?? 'star') !== modeOf(starWithMaterial).slice(5)
    ? 1 : 0,
  '⚠️ the raw read agrees with the resolver on all 274 library presets, so ONLY a fixture can seed this — a '
  + 'library-only seed came back NOT CAUGHT and that is what put this fixture here');
seed('the un-resolved style: `overlay.transMapStyle` instead of chainFromOverlay()',
  (() => {
    const live = new Set();
    for (const n of NAMES) {
      const p = mgr.get(n), ov = p.overlay ?? {}, tm = p.postProcessors?.transMap;
      if (!(ov.transMapEnabled ?? tm?.enabled ?? false)) continue;
      live.add(ov.transMapStyle ?? tm?.style ?? 0);
    }
    const chainOnly = TRANS_MAP_STYLES.map((m) => m.style)
      .filter((s) => cnt(`tmStyle:${s}`) > 0 && !live.has(s));
    return chainOnly.length;
  })(),
  `⚠️ the scalar-only read loses every style that appears ONLY as a chain layer, and nothing else in the `
  + 'codebase fails — the chain wins if non-empty, else the single resolved scalar');
seed('the un-resolved palette: `overlay.palette` instead of resolvePaletteSelection()',
  (() => {
    const naive = NAMES.filter((n) => !(ovOf(n).palette) || ovOf(n).palette === 'none').length;
    return naive !== cnt('palette:none') ? 1 : 0;
  })(),
  '⚠️ the film-look half carries the MAJORITY of both palette and mapping, so the overlay-only read reports '
  + '`No palette` on far more presets than actually resolve to none — and every one of them is a preset whose '
  + 'palette the drawer would then be unable to find');
seed('the exclusion applied AFTER the group OR instead of before it',
  (() => {
    // The broken law: OR first, then subtract only if nothing was included. A plausible refactor, and it
    // WIDENS — the one direction a filter defect must never take.
    const broken = (facets, filter) => {
      if (filter.include.size === 0) {
        for (const k of filter.exclude) if (facets.has(k)) return false;
        return true;
      }
      for (const k of filter.include) if (facets.has(k)) return true;
      return false;
    };
    const q = { include: new Set(['material:Fire', 'material:Ember']), exclude: new Set(['tm:enabled']) };
    const good = NAMES.filter((n) => matchesFilter(FACETS.get(n), q)).length;
    const bad = NAMES.filter((n) => broken(FACETS.get(n), q)).length;
    return bad !== good ? 1 : 0;
  })(),
  '⚠️ **`matchesFilter` has exactly one dangerous failure direction** — returning `true` where it should return '
  + '`false` shows presets that do not have the feature, and the owner cannot tell. An exclusion that only '
  + 'applies when nothing is included is the refactor that does it');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. the filter law: any within a group, all across groups, exclusions always AND-NOT ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **ASSERTED AGAINST AN INDEPENDENTLY WRITTEN REFERENCE, NOT AGAINST A TABLE OF EXPECTED NUMBERS.** A table
 * inherits whatever the implementation did on the day it was written; a reference written from the LAW in
 * `22.D8`'s words disagrees wherever the implementation departs from the law. The two are driven over the real
 * library with a seeded LCG, and separately over a synthetic exhaustive space, because the library may not
 * contain a preset for every corner the law has to answer.
 */
const reference = (facets, include, exclude) => {
  for (const k of exclude) if (facets.has(k)) return false;
  const byGroup = new Map();
  for (const k of include) {
    const g = FACET_GROUP_OF.get(k) ?? `__unknown:${k}`;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(k);
  }
  for (const [, ks] of byGroup) if (!ks.some((k) => facets.has(k))) return false;
  return true;
};
chk('empty filter matches every preset',
  NAMES.every((n) => matchesFilter(FACETS.get(n), { include: new Set(), exclude: new Set() })),
  'the drawer opens with nothing ticked and must show the whole grid');
chk('an unknown include key matches NOTHING (it never WIDENS)',
  NAMES.every((n) => !matchesFilter(FACETS.get(n), { include: new Set(['nope:x']), exclude: new Set() })),
  '⚠️ silently ignoring an unknown key widens the result, which is the direction a filter defect hides in');
chk('a key both included and excluded matches nothing',
  NAMES.every((n) => !matchesFilter(FACETS.get(n), { include: new Set(['tm:enabled']), exclude: new Set(['tm:enabled']) })),
  'the UI cannot produce this state (a chip has one state at a time) but the model must still answer it');

let lcg = 20260924;
const rnd = () => (lcg = (lcg * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const keyList = [...keys];
let mismatches = 0, trials = 0, sawEmpty = 0, sawFull = 0;
for (let t = 0; t < 4000; t++) {
  const inc = new Set(), exc = new Set();
  const ni = Math.floor(rnd() * 4), ne = Math.floor(rnd() * 3);
  for (let i = 0; i < ni; i++) inc.add(keyList[Math.floor(rnd() * keyList.length)]);
  for (let i = 0; i < ne; i++) exc.add(keyList[Math.floor(rnd() * keyList.length)]);
  let hits = 0;
  for (const n of NAMES) {
    const f = FACETS.get(n);
    trials++;
    const a = matchesFilter(f, { include: inc, exclude: exc });
    if (a !== reference(f, inc, exc)) mismatches++;
    if (a) hits++;
  }
  if (hits === 0) sawEmpty++;
  if (hits === N) sawFull++;
}
chk(`matchesFilter agrees with the reference over ${trials} (preset, query) pairs from 4000 random queries`,
  mismatches === 0, `${mismatches} disagreement(s)`);
chk(`...and the sweep reached both ends (${sawEmpty} empty result(s), ${sawFull} full)`,
  sawEmpty > 0 && sawFull > 0,
  '⚠️ **A sweep that never produces an empty result has not tested the empty state**, which is 22.5\'s whole '
  + 'subject — and one that never produces a full result has not tested the identity');

/*
 * The synthetic exhaustive space: 3 keys in group X, 2 in group Y, every subset of every role. ⚠️ **The library
 * cannot reach every corner of the law** — there is no preset with a `Basin` seed pattern, for instance — so the
 * law is also driven over a space that has one of everything.
 */
{
  const G = new Map([['a1', 'X'], ['a2', 'X'], ['a3', 'X'], ['b1', 'Y'], ['b2', 'Y']]);
  const ks = [...G.keys()];
  const refSyn = (facets, inc, exc) => {
    for (const k of exc) if (facets.has(k)) return false;
    const bg = new Map();
    for (const k of inc) { const g = G.get(k); if (!bg.has(g)) bg.set(g, []); bg.get(g).push(k); }
    for (const [, l] of bg) if (!l.some((k) => facets.has(k))) return false;
    return true;
  };
  // A synthetic FACET_GROUP_OF, so the subject's own grouping is exercised on keys the library never produces.
  let bad = 0, cases = 0;
  for (let fm = 0; fm < 32; fm++) {
    const facets = new Set(ks.filter((_, i) => fm & (1 << i)));
    for (let im = 0; im < 32; im++) {
      for (let em = 0; em < 32; em++) {
        const inc = new Set(ks.filter((_, i) => im & (1 << i)));
        const exc = new Set(ks.filter((_, i) => em & (1 << i)));
        // Map synthetic keys onto real ones sharing a group, so matchesFilter's own grouping is under test.
        const realOf = { a1: 'material:Fire', a2: 'material:Ember', a3: 'material:Ice', b1: 'tm:enabled', b2: 'tm:chain2' };
        const rf = new Set([...facets].map((k) => realOf[k]));
        const ri = new Set([...inc].map((k) => realOf[k]));
        const re = new Set([...exc].map((k) => realOf[k]));
        cases++;
        if (matchesFilter(rf, { include: ri, exclude: re }) !== refSyn(facets, inc, exc)) bad++;
      }
    }
  }
  chk(`the law holds over all ${cases} synthetic (facets, include, exclude) combinations in a 3+2 key space`,
    bad === 0, `${bad} disagreement(s) — these corners include ones the library cannot reach at all`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. the report: what the drawer will actually show ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **NOT ASSERTIONS. These lines exist so a distribution change is VISIBLE in a diff of the run**, which is
 * the one thing a pass/fail line cannot carry — and so the greyed-zero path (`22.D7`) can be seen to be
 * exercised rather than claimed.
 */
console.log(`  boolean coverage over ${BOOLEAN_KEYS.length} boolean chips (⚠️ the plan's basis table says "the 22`);
console.log('  boolean feature facets" — that is a DIFFERENT SET, not a missing row: it counts `Ribbon Rendering');
console.log('  ≠ off` as one boolean, where 22.0\'s catalogue makes ribbon a four-value enumeration. Two');
console.log('  measurements wearing the same words; this line states its own basis rather than reproducing a');
console.log('  figure at the other one.)\n');
for (const k of [...BOOLEAN_KEYS].sort((a, b) => cnt(b) - cnt(a))) {
  const c = cnt(k);
  console.log(`    ${String(c).padStart(4)}  ${((c / N) * 100).toFixed(1).padStart(5)}%  ${FACET_LABELS[k]}`);
}
const zeros = ALL_FACETS.filter((f) => cnt(f.key) === 0);
console.log(`\n  ${zeros.length} chip(s) have a count of ZERO and will render greyed-but-clickable (22.D7):`);
console.log(`    ${zeros.map((f) => FACET_LABELS[f.key]).join(', ') || '(none — the greyed path would then be UNEXERCISED)'}`);
console.log('\n  ⚠️ **This is the measurement that licensed deriving the palette and film-look rows from the ENGINE\'S');
console.log('  registries rather than from the library\'s used values** (22.1 deviation (a)). 22.D7 requires the');
console.log('  zero case to be shown, not special-cased and never reached; at the library-derived basis every');
console.log('  count would be non-zero and the greyed state would ship untested.');
const single = NAMES.filter((n) => FACETS.get(n).size === sizes[0]);
console.log(`\n  thinnest preset(s) — ${sizes[0]} facets: ${single.slice(0, 4).join(', ')}`);
console.log(`  facets per preset: min ${sizes[0]}, median ${sizes[sizes.length >> 1]}, max ${sizes[sizes.length - 1]}`);

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  facetcheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
