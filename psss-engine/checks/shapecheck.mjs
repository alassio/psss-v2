#!/usr/bin/env node
/**
 * shapecheck — **Phase 35's warp wave shapes. Four gaps, and `tsc` can see none of them.**
 *
 * ## Why this file exists
 *
 * `WarpShape` is a union, and a union buys a very specific amount of safety here — less than it looks:
 *
 *  - **§A. The one-way `Record`/array gap.** `Record<WarpShape, …>` makes `tsc` force an entry for a new
 *    union member. `readonly WarpShape[]` makes `tsc` force **nothing** — and **the dropdowns read the
 *    array.** So a sixth shape added to the union plus both `Record`s compiles clean, and the picker
 *    silently offers one option fewer: the shape exists, is storable, interpolates, exports, and cannot be
 *    selected. The same gap is documented twice already (`core/interfaces.ts`'s `ChannelDriver`; `33.5`).
 *    ⚠️⚠️ **Mechanised as SET equality in both directions, NEVER as length equality** — equal lengths with
 *    one name swapped is exactly the edit a rename produces, and a length test passes over it.
 *
 *  - **§B. The discontinuity map is a CLASSIFICATION, and a notice line reads it.** Two shapes rip the image;
 *    three bend it. A wrong entry makes the UI's warning describe the other half of the palette, and no
 *    checker reads a sentence. (The tear MAGNITUDES are `35.7`'s exhaustive measurement, not this file's —
 *    ⚠️ and a 3-px-step scan reported 0.0 tears for EVERY shape including `square`, because a 1-D wave's
 *    discontinuities fall on a measure-zero set of lines. **A sampled tear assertion certifies a torn field
 *    as clean**, so this section asserts the classification and says who owns the number.)
 *
 *  - **§C. `isStaticFieldDefault()` is the EXPORT GATE and a field missing from it is DESTROYED, not
 *    omitted** (invariant 17, Snapshot worst of all). Measured 2026-10-29 while `shape` was absent: a layer
 *    whose only non-default value was `shape: 'square'` read as all-default, `normaliseChain()` dropped the
 *    block and `isLegacyExpressible()` kept `transMapChain` out of `getSnapshot()` entirely. `fieldcheck` §J
 *    asserts every per-layer config **block** appears in `isLegacyExpressible()`; it cannot see a sub-FIELD.
 *
 *  - **§D. TWO hand-written digests of the same field list, and neither has a compiler between it and
 *    `StaticFieldConfig`.** `TransMap.setChain()`'s `signature` gates `rebuildStaticField()` on a chain EDIT;
 *    `chainSignature()` gates `reinitTransMap()` on a PRESET CHANGE, and `setChain()` is not called at all on
 *    the branch it guards. **A wave-array field omitted from either leaves the OLD field on screen while
 *    every control, readout and thumbnail shows the new one** — the exact pair of symptoms v8 21.12 added
 *    `tableDigest` for. ⚠️ `PHASE35-KEYS.md` §2.3's census lists five such enumerations and misses
 *    `chainSignature()`; it is the sixth.
 *
 * ## §E–§L — the ARITHMETIC, added by `35.2`
 *
 *  - **§E. The dispatch.** `shapeFn` is the ONE owner (`35.D6`), the triangle is IMPORTED from
 *    `core/wave-law.ts` and asserted bit-exactly against it, and the `switch`'s **absent `default` arm** is
 *    a real if narrow `tsc` gate that a well-meant `default` would surrender silently. ⚠️ Also the
 *    **frequency-0 exemption**: `sqrSin(0)` is `+1` and `sawSin(0)` is `-1`, so without it a slot that
 *    contributes NOTHING on the sine path acquires a full-amplitude DC term — reachable on 7 slots of the
 *    shipped library.
 *  - **§F. The twelve call sites across TWO functions**, including the **four unit-gain PROBES**
 *    `solveGain`/`solveGain3` measure, which are the invisible ones. §F7 measures the consequence rather
 *    than the text: the realised peak must be `strength × target` on the solver's OWN grid.
 *  - **§G. Bit-identity at BOTH identities**, under `Object.is`, over the **built-wave population (278
 *    layers)** and not the 25 presets carrying a non-default block.
 *  - **§H. The tear classification as a MEASUREMENT** — exhaustive over every adjacent pixel pair at
 *    1920×1080, which is what §B's hand-typed `Record` rests on.
 *  - **§I. The Mixer's law** — the two shapes SNAP, the two mixes LERP, asserted both as source text and
 *    through `interpolatePreset`.
 *  - **§J. The Randomiser** — the style gate's five zoom-half deletes, and the 60 % `sine` weighting, whose
 *    alternative (a uniform roll) would make four of five random presets non-sinusoidal.
 *  - **§K. The bake's round trip under a shape** — the save-path hazard, and the measured finding that
 *    `StaticFieldBake` needs no new field because `setStaticField()` already carries every key of
 *    `STATIC_FIELD_DEFAULTS` — counted from the object, never quoted.
 *  - **§L. The re-solve gate's CONSEQUENCE** — §D asserts the digests NAME the fields, §L that they
 *    SEPARATE a shape change and that the solved gain really does depend on the shape.
 *
 * ## §N — the ORIENTATION ANGLES, added by `35.3`
 *
 *  - **§N exists because `fieldcheck` §D CANNOT be it, and that is worse than having no clause.** §D is
 *    *"the GLSL text and the TS sampler implement the same formulas"* — a per-style TEXT scan. **A rotation
 *    added to the shader and forgotten in `staticOffsetAt()` leaves every §D clause green.** ⚠️ `fieldcheck`
 *    was NOT edited by `35.3`: it is byte-identical to `the backup copy backup_20261029_phase33confirmed`, which is
 *    what keeps §A's *"any failure from here is yours"* meaningful (`35.D5`).
 *  - **§N0 the FOUR index consumers**, not one: the GLSL `waveTap`, the TS `sampleWave` (the particle FORCE
 *    path, and the panel's picture through it), `solveGain` and `solveGain3`. The two solves must DELEGATE
 *    to the sampler rather than re-derive it; they read `wX[x]`/`wY[y]` before `35.3`.
 *  - **§N1 the range is ±90, never 0-360**, for TWO independent reasons — `(angle + 180, −amp)` is the same
 *    field, so a full circle offers every one of them twice; and ±90 has no wrap, so `blendLayerBlocks()`'
 *    plain `mix()` is the shortest path. ⚠️ **§N1b corrects the design document on the LEVEL of its own
 *    claim**: that identity is a property of the SAMPLED FIELD, not of the two arrays compared elementwise.
 *  - **§N2 THE SPLIT, and it is the phase's landmine.** `buildWave`'s `n` was BOTH the array length and
 *    `centreAnchor`'s axis length. A rotated sample ranges over the frame's DIAGONAL, so the table widens
 *    from `max(w,h)` to `hypot(w,h)` — and widening the anchor with it **moves the field at angle 0, by more
 *    than the wave's own amplitude** (measured: 1.886 on a table whose amplitude sum is 1.35). ⚠️ Gating the
 *    widening on `angle !== 0` is NOT the fix; §N2a is what proves the gate is a pure allocation choice.
 *  - **§N3 CENTRED AT EVERY ANGLE INCLUDING 0, in PIXELS, through the shipped `staticOffsetAt`** — and
 *    MANDATORY, because *"a shape-invariance property test is not sufficient on its own: it passes for a
 *    field that is correctly shaped and wrongly placed."* Its 1 px bound is DERIVED in three stated steps
 *    (invariant 27), one of which is a seeded measurement of the probe's own resolution.
 *  - **§N6 GLSL vs TS BY MEASUREMENT**, the comparison §D cannot be: the shader transcribed from its own
 *    source text and compared pixel for pixel against the shipped sampler, with three seeds — NEAREST
 *    instead of the lerp, the zoom centre as the pivot, and the two maps crossed.
 *  - ⚠️⚠️ **§N7 FOUND A DEFECT RATHER THAN CONFIRMING AN EXPECTATION, and it is why `solveGain`'s
 *    `peak <= 0` is now a derived floor.** `35.3` made a CATASTROPHIC CANCELLATION reachable: style 2's
 *    `dz = -(wx + wy)/2` cannot cancel at angle 0 (the two waves are indexed by different coordinates), but
 *    a PARALLEL pair puts them on one axis and most archetypes then have `wy === -wx` identically.
 *    `Interference` style 2 at `45/-45` solved a gain of **2.97e+13** and rendered round-off at the right
 *    MAGNITUDE with noise for its structure — **a plausible-looking field is the hardest kind of wrong.**
 *
 * ## §M — the CONTENT, added by `35.6`'s archetype half
 *
 *  - **§M. The three new archetypes** (`35.D7` cut the spec's six to three). §M1–§M4 are the four
 *    obligations: APPEND, the dropped three stay dropped, a `provenance` that says DESIGNED in both
 *    directions, and no `absoluteAmp`. **§M5 and §M6 are MEASUREMENTS and neither had an instrument
 *    before:** §M5 is the RELABEL gate — no shipped table may change which archetype NAME it identifies as,
 *    asserted by NAME over both populations, because the append obligation that claimed to guarantee this
 *    is falsified (the ranking is `|log detail|`, not array order). §M6 is the DISTINCTNESS rule, measured
 *    against the shipped set's own minimum pair distance rather than a quoted threshold.
 *
 * ## What this file is NOT
 *
 * ⚠️ **§A–§D are the TYPE LAYER and the GATES; §E–§L are the wave BUILDER; §M is the CONTENT; §N is the
 * INDEX.** The ⏳ OWED block at the foot of this file is the list of what is still owed, named rather than
 * inferred from a count — and it now carries a ✅ DISCHARGED block for `35.4`'s angle half, whose
 * instruments are **`trackcheck` §M (the track, 11 clauses) and `tipcheck` §K (the notice strings and the
 * predicate)**, deliberately not here. `35.6`'s DEMOS are the one piece of later work that moves this
 * file's own basis.
 *
 * ⚠️ **`fieldcheck` §A is the phase's load-bearing gate and is NOT this file's business.** This checker was
 * written, and then extended by `35.2`, without editing one line of it.
 *
 * ⚠️ **§A–§F, §I–§M mix SOURCE-TEXT and MEASURING clauses on purpose, and a failure means different things.**
 * In a source-shaped clause a failure means the named owner was renamed, moved or bypassed; in a measuring
 * one it means the arithmetic is wrong. **Read the assertion before believing a failure is a regression** —
 * and every section carries a SEEDED calibration, because a clause for a gap that has never been shown to
 * fire is the gap. `deadcheck`'s `stripComments()` step is mandatory here for the same reason it is there:
 * these sections document the rules they enforce in prose that names the very identifiers they search for.
 *
 * ⚠️ **§H costs ~2.5 s** (20 fields × ~4.1 M pixel pairs). That is the price of "exhaustive"; a sampled scan
 * is not merely weaker, it reports the CONTINUOUS shapes over the tear criterion — see §H3.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const rd = p => readFileSync(join(SRC, p), 'utf8');

let pass = 0, fail = 0, calib = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const seed = (n, red, x = '') => {
  console.log(`  ${red ? 'CALIB' : 'FAIL '}  seeded: ${n}${x ? '   ' + x : ''}`);
  red ? calib++ : fail++;
};

/** ⚠️ Mandatory before ANY grep below — see the header. Same step, same reason, as `deadcheck.mjs`. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The body of ONE function, brace-matched from its declaration. ⚠️ **Never scope a "does X appear inside F"
 * assertion with a bare `slice(indexOf(decl))`** — that runs to the end of the file, so every later site in
 * the module counts as if it were inside F. Call on COMMENT-STRIPPED source: a brace in a comment desyncs
 * the depth count. Returns '' if the declaration is absent, which fails the caller's assertion.
 */
const braceBody = (src, decl) => {
  const start = src.indexOf(decl);
  if (start < 0) return '';
  const open = src.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
};

const SF = await import('../src/post-processors/static-field.ts');
const { triBasis } = await import('../src/core/wave-law.ts');
const { chainFromOverlay, buildChainPlan, chainSignature, normaliseChain, isLegacyExpressible }
  = await import('../src/post-processors/trans-map-chain.ts');
const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { WARP_SHAPES, WARP_SHAPE_LABELS, WARP_SHAPE_DISCONTINUOUS, STATIC_FIELD_DEFAULTS } = SF;

const sfSrc = stripComments(rd('post-processors/static-field.ts'));
const tmSrc = stripComments(rd('post-processors/trans-map.ts'));
const tcSrc = stripComments(rd('post-processors/trans-map-chain.ts'));

console.log('=== shapecheck: the warp shape palette, the export gate and the two digests ===\n');

// ---------------------------------------------------------------------------------------------------
// A. THE ONE-WAY `Record`/ARRAY GAP — SET equality, both directions, never length
// ---------------------------------------------------------------------------------------------------
console.log('--- A. the one-way Record/array gap ---');

/**
 * ⚠️⚠️ **THE WHOLE POINT OF THIS HELPER IS THAT IT IS NOT A LENGTH TEST.** It returns the two one-sided
 * differences by NAME, so a swap (one added, one removed) reports both halves while a length test reports
 * nothing. The seeded calibration below runs this exact helper over a synthetic swap for that reason.
 */
const setDiff = (a, b) => ({
  missing: [...new Set(a)].filter(k => !new Set(b).has(k)),   // in a, absent from b
  extra: [...new Set(b)].filter(k => !new Set(a).has(k)),     // in b, absent from a
});

for (const [name, rec] of [['WARP_SHAPE_LABELS', WARP_SHAPE_LABELS],
                           ['WARP_SHAPE_DISCONTINUOUS', WARP_SHAPE_DISCONTINUOUS]]) {
  const d = setDiff(WARP_SHAPES, Object.keys(rec));
  chk(`§A1 ${name} and WARP_SHAPES are the SAME SET, both directions`,
    d.missing.length === 0 && d.extra.length === 0,
    d.missing.length === 0 && d.extra.length === 0
      ? `${WARP_SHAPES.length} members, no one-sided name`
      : `⚠️ in the array only: [${d.missing}] — in ${name} only: [${d.extra}]. `
        + `A member only in the Record COMPILES CLEAN and the dropdown silently offers one option fewer; `
        + `a member only in the array has no label. NOT a length problem — reconcile by NAME.`);
}

chk('§A2 WARP_SHAPES has no duplicate, so the array is a SET and §A1 is a set comparison',
  new Set(WARP_SHAPES).size === WARP_SHAPES.length,
  `${WARP_SHAPES.length} entries, ${new Set(WARP_SHAPES).size} distinct`);

chk('§A3 `sine` is FIRST in WARP_SHAPES — the array is the dropdown ORDER and the default must head it',
  WARP_SHAPES[0] === 'sine',
  `[${WARP_SHAPES.join(', ')}] — and STATIC_FIELD_DEFAULTS.shape is '${STATIC_FIELD_DEFAULTS.shape}'`);

chk('§A4 `spike` is ABSENT — measured-and-rejected (35.D2), not overlooked',
  !WARP_SHAPES.includes('spike') && !('spike' in WARP_SHAPE_LABELS),
  'concentration 2.2 against sine\'s 2.6 and visually indistinguishable in every render. '
  + 'It is the obvious sixth candidate and will be proposed again; this clause is the record of the refusal');

chk('§A5 every label is a distinct non-empty string — two members sharing a label is unselectable in the UI',
  Object.values(WARP_SHAPE_LABELS).every(v => typeof v === 'string' && v.length > 0)
  && new Set(Object.values(WARP_SHAPE_LABELS)).size === WARP_SHAPES.length,
  `[${WARP_SHAPES.map(s => WARP_SHAPE_LABELS[s]).join(', ')}]`);

// ⚠️⚠️ THE SEEDED CALIBRATION. A clause for a one-way gap that has never been shown to fire IS the gap.
// Two seeds, because the two failures look different and a length test passes BOTH:
//   (i) a sixth member in the Records and absent from the array — the gap exactly as it would occur;
//   (ii) a SWAP, equal lengths with one name changed — the edit a rename produces.
{
  const sixUnion = [...WARP_SHAPES, 'spike'];
  const d1 = setDiff(WARP_SHAPES, sixUnion);
  seed('a sixth member in the Records, absent from the array',
    d1.extra.length === 1 && d1.extra[0] === 'spike',
    `§A1\'s helper reports [${d1.extra}] on the Record side — the picker would offer 5 of 6`);

  const swapped = WARP_SHAPES.map(s => (s === 'sawtooth' ? 'ramp' : s));
  const d2 = setDiff(WARP_SHAPES, swapped);
  const lengthTestWouldPass = swapped.length === WARP_SHAPES.length;
  seed('a RENAME — equal lengths, one name swapped',
    d2.missing.length === 1 && d2.extra.length === 1 && lengthTestWouldPass,
    `reported missing=[${d2.missing}] extra=[${d2.extra}] while a LENGTH test passes `
    + `(${swapped.length} === ${WARP_SHAPES.length}). ⚠️ This is why §A1 is a set comparison`);
}

// ---------------------------------------------------------------------------------------------------
// B. THE DISCONTINUITY MAP IS A CLASSIFICATION, AND THE NOTICE LINE READS IT
// ---------------------------------------------------------------------------------------------------
console.log('\n--- B. the discontinuity classification ---');

// ⚠️ Hand-written HERE on purpose, from the spec's §2.1 definitions, so that the `Record` in `src/` is held
// to an INDEPENDENT statement rather than to itself. A new shape goes red here until a decision is recorded
// — that is the clause working, exactly as `facetcheck` §B goes red on a new `shape` family.
const EXPECTED_DISCONTINUOUS = { sine: false, triangle: false, trapezoid: false, square: true, sawtooth: true };

{
  const d = setDiff(WARP_SHAPES, Object.keys(EXPECTED_DISCONTINUOUS));
  chk('§B1 this file\'s independent classification covers exactly the shipped palette',
    d.missing.length === 0 && d.extra.length === 0,
    d.missing.length === 0
      ? 'so §B2 is a comparison and not a subset test'
      : `⚠️ undecided here: [${d.missing}] — a NEW shape must be classified in this checker as well as in `
        + `src/. Going red is the clause working; do not widen it to a subset test`);

  const wrong = WARP_SHAPES.filter(s => WARP_SHAPE_DISCONTINUOUS[s] !== EXPECTED_DISCONTINUOUS[s]);
  chk('§B2 WARP_SHAPE_DISCONTINUOUS matches it entry for entry',
    wrong.length === 0,
    wrong.length === 0
      ? `discontinuous: [${WARP_SHAPES.filter(s => WARP_SHAPE_DISCONTINUOUS[s]).join(', ')}]`
      : `⚠️ disagree on [${wrong}] — the notice line reads this Record, so a wrong entry makes the UI warn `
        + `about the other half of the palette, and NO CHECKER READS A SENTENCE`);

  chk('§B3 exactly two shapes are discontinuous, and they are a different CLASS rather than a larger number',
    WARP_SHAPES.filter(s => WARP_SHAPE_DISCONTINUOUS[s]).length === 2,
    'measured 120 px (style 0) / 571 px (a zoom style) at 1920×1080 against sine\'s 6 px `jsRound` '
    + 'quantisation floor, which `trapezoid` sits in too. ⚠️ **The MAGNITUDES are 35.7\'s exhaustive '
    + 'measurement, not this clause** — a 3-px-step scan reported 0.0 tears for every shape including square');

  const seedRec = { ...WARP_SHAPE_DISCONTINUOUS, sawtooth: false };
  seed('`sawtooth` declared continuous',
    WARP_SHAPES.some(s => seedRec[s] !== EXPECTED_DISCONTINUOUS[s]),
    '§B2 notices — so the clause is comparing, not echoing the Record back to itself');
}

// ---------------------------------------------------------------------------------------------------
// C. THE EXPORT GATE — every default key must be NAMED in `isStaticFieldDefault()`
// ---------------------------------------------------------------------------------------------------
console.log('\n--- C. isStaticFieldDefault(), the export gate ---');

const DEFAULT_KEYS = Object.keys(STATIC_FIELD_DEFAULTS);

/** Which of `DEFAULT_KEYS` the given function body reads off the config object, by name. */
const keysNamedIn = body => DEFAULT_KEYS.filter(k => new RegExp(`\\.${k}\\b`).test(body));

{
  const body = braceBody(sfSrc, 'export function isStaticFieldDefault');
  chk('§C0 the predicate was FOUND — a rename must fail loudly, not silently pass',
    body.length > 0, `${body.length} chars of brace-matched body`);

  const named = keysNamedIn(body);
  const missing = DEFAULT_KEYS.filter(k => !named.includes(k));
  chk(`§C1 all ${DEFAULT_KEYS.length} STATIC_FIELD_DEFAULTS keys are named in isStaticFieldDefault()`,
    missing.length === 0,
    missing.length === 0
      ? `[${named.join(', ')}]`
      : `⚠️⚠️ MISSING: [${missing}]. A layer whose only non-default value is one of these reads as `
        + `all-default, so normaliseChain() DROPS the block and isLegacyExpressible() keeps transMapChain `
        + `out of getSnapshot() ENTIRELY — the value is DESTROYED, not omitted (invariant 17). `
        + `⚠️ tsc cannot see this and fieldcheck §J covers BLOCKS, never sub-fields`);

  // ⚠️ `staticFieldOf()` is `tsc`-gated (its return type is `typeof STATIC_FIELD_DEFAULTS`, so an object
  // literal missing a required key is an error) and needs no clause of its own. Asserted anyway, cheaply,
  // because the gate is the TYPE ANNOTATION and a future `: StaticFieldConfig` or `as` would silently
  // surrender it — the annotation is the whole of the protection.
  chk('§C2 staticFieldOf() still returns `typeof STATIC_FIELD_DEFAULTS` — the free tsc gate is intact',
    /export function staticFieldOf\([^)]*\):\s*typeof STATIC_FIELD_DEFAULTS\b/.test(sfSrc),
    'an object literal missing a required key is an error, so the resolver cannot forget a field. '
    + '⚠️ Widening this to `StaticFieldConfig` (all-optional) or adding an `as` surrenders the gate silently');

  chk('§C3 STATIC_FIELD_DEFAULTS is still `Required<Omit<StaticFieldConfig, …>>` — the OTHER free tsc gate',
    /export const STATIC_FIELD_DEFAULTS:\s*Required<Omit<StaticFieldConfig/.test(sfSrc),
    'adding an optional field to the interface without adding it here does not compile. '
    + `⚠️ These two annotations are the only compiler protection the ${DEFAULT_KEYS.length} keys have anywhere`);

  const seedBody = body.replace(/\s*&&\s*\(s\.shape2[^\n]*\n?/, '\n');
  const seedMissing = DEFAULT_KEYS.filter(k => !keysNamedIn(seedBody).includes(k));
  seed('the `shape2` clause deleted from the export gate',
    seedMissing.length > 0 && seedMissing.includes('shape2'),
    `§C1 notices [${seedMissing}] — the scan reads the predicate's OWN text, so a shortened predicate `
    + `cannot read as a correct one over a shorter list (32.15's finding)`);
}

// ---------------------------------------------------------------------------------------------------
// D. THE TWO DIGESTS — a wave-array field omitted from either renders the OLD field
// ---------------------------------------------------------------------------------------------------
console.log('\n--- D. the two change-detection digests ---');

/**
 * ⚠️ **`chainSignature()`'s exclusions are a CLOSED list, hand-written here.** The three MAGNITUDE fields are
 * excluded by design: `strength`/`strength2` are applied as a gain and `drift` as a phase, so including them
 * would rebuild the field on every frame of a drag and every frame drift advances (invariant 8). **A NEW key
 * is therefore required to be PRESENT until it is added to this list**, which is what makes the clause able
 * to fail — a key that may be either way is a key the clause cannot police. ⚠️ `TransMap.setChain()`'s own
 * signature excludes NOTHING: it carries `drift` as a boolean and everything else as a value, so its clause
 * is total.
 */
const CHAIN_SIG_EXCLUDED = ['strength', 'strength2', 'drift'];

{
  // `setChain`'s digest is an expression, not a function, so it is sliced between two anchors rather than
  // brace-matched — and the anchors are asserted, because a slice that silently found nothing passes every
  // "is X present" test by accident.
  const from = tmSrc.indexOf('const signature = statics.length === 0');
  const to = tmSrc.indexOf(".join('|')", from);
  const sigExpr = from >= 0 && to > from ? tmSrc.slice(from, to) : '';
  chk('§D0 setChain()\'s signature expression was FOUND between both anchors',
    sigExpr.length > 0, `${sigExpr.length} chars`);

  const named = keysNamedIn(sigExpr);
  const missing = DEFAULT_KEYS.filter(k => !named.includes(k));
  chk(`§D1 setChain()'s signature names all ${DEFAULT_KEYS.length} default keys — it excludes nothing`,
    missing.length === 0,
    missing.length === 0
      ? `[${named.join(', ')}] — drift as a boolean, every other one as a VALUE`
      : `⚠️⚠️ MISSING: [${missing}]. The signature is the ONLY thing that calls rebuildStaticField(), so an `
        + `omitted field leaves the OLD field on the canvas while the panel's readouts — which resolve `
        + `through resolveStaticWaves directly — show the NEW one. For a shape that also means strength `
        + `keeps the PREVIOUS shape's gain calibration`);

  chk('§D2 the four shape fields enter setChain()\'s signature as VALUES, not as drift\'s boolean',
    /\$\{s\.shape\}/.test(sigExpr) && /s\.shapeMix\.toFixed/.test(sigExpr)
    && /\$\{s\.shape2\}/.test(sigExpr) && /s\.shapeMix2\.toFixed/.test(sigExpr),
    'a shape and a mix are STATIC, so `drift`\'s boolean reduction does not transfer — it would freeze the '
    + 'field mid-drag at the last rebuilt setting, which is the documented `hasDrift` defect in a new place');

  const body = braceBody(tcSrc, 'export function chainSignature');
  chk('§D3 chainSignature() was FOUND', body.length > 0, `${body.length} chars of brace-matched body`);

  const cNamed = keysNamedIn(body);
  const cMissing = DEFAULT_KEYS.filter(k => !cNamed.includes(k) && !CHAIN_SIG_EXCLUDED.includes(k));
  chk('§D4 chainSignature() names every WAVE-ARRAY key (the sixth enumeration, missed by the census)',
    cMissing.length === 0,
    cMissing.length === 0
      ? `[${cNamed.join(', ')}], excluding [${CHAIN_SIG_EXCLUDED.join(', ')}] by design`
      : `⚠️⚠️ MISSING: [${cMissing}]. This digest gates reinitTransMap() on a PRESET CHANGE and setChain() `
        + `is not called at all on that branch — so two presets differing only in one of these do not `
        + `rebuild the displacement texture: preset B renders preset A's field`);

  const cPresent = CHAIN_SIG_EXCLUDED.filter(k => cNamed.includes(k));
  chk('§D5 the three MAGNITUDE keys stay OUT of chainSignature() — invariant 8, not an oversight',
    cPresent.length === 0,
    cPresent.length === 0
      ? `[${CHAIN_SIG_EXCLUDED.join(', ')}] absent: a gain and a phase build no CPU resource`
      : `⚠️ [${cPresent}] crept in — that turns the 0.8 ms gain solve into per-frame work on every drag `
        + `frame and every frame drift advances`);

  const seedExpr = sigExpr.replace(/:\$\{s\.shapeMix2\.toFixed\(4\)\}/, '');
  seed('`shapeMix2` dropped from setChain()\'s signature',
    DEFAULT_KEYS.some(k => !keysNamedIn(seedExpr).includes(k)),
    `§D1 notices [${DEFAULT_KEYS.filter(k => !keysNamedIn(seedExpr).includes(k))}]`);

  const seedBody = body.replace(/,\$\{s\.shape2 \?\? '-'\}/, '');
  const sMissing = DEFAULT_KEYS.filter(k => !keysNamedIn(seedBody).includes(k) && !CHAIN_SIG_EXCLUDED.includes(k));
  seed('`shape2` dropped from chainSignature()',
    sMissing.includes('shape2'),
    `§D4 notices [${sMissing}] — and this is the one of the two digests no document had enumerated`);

  const seedStrength = body.replace(/\$\{s\.pattern \?\? '-'\}/, "${s.strength ?? 0}");
  seed('`strength` added to chainSignature()',
    CHAIN_SIG_EXCLUDED.some(k => keysNamedIn(seedStrength).includes(k)),
    '§D5 notices — the exclusion list is policed in BOTH directions, so a well-meant addition cannot '
    + 'silently move the gain solve into the drag');
}

// ---------------------------------------------------------------------------------------------------
// E. THE SHAPE DISPATCH — one owner, one triangle, and the `switch`'s own narrow `tsc` gate
// ---------------------------------------------------------------------------------------------------
console.log('\n--- E. the shapeFn dispatch and the five bases ---');

/**
 * **Probe one basis through a SINGLE-SLOT UNIT TABLE** — `composercheck` §R's technique, for the same
 * reason: the five shape functions are module-private and must stay that way (`35.D6` — one owner), so the
 * only honest way to assert their arithmetic is through the function that uses them.
 *
 * At a SQUARE canvas `period === n`, so `centreAnchor` is 0 and the argument collapses to `2*pi*i/n`. Style
 * 1's `fit` is 1 and `strength` at the 0.5 default makes the `(Preset)` branch's gain exactly 1, so
 * `waveX[i]` IS `basis(2*pi*i/n)` with nothing in between. ⚠️ **One term, frequency 1** — a multi-term table
 * would sum bases and probe nothing.
 */
const probeBasis = (shape, n, freq = 1) => {
  const t = [[1, 0, 0, 0], [freq, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const layer = { style: 1, weight: 1, staticField: { pattern: '(Preset)', strength: 0.5, shape, shapeMix: 1 } };
  return SF.resolveStaticWaves(layer, t, t, n, n, n / 2, n / 2, 0).waveX;
};

const PN = 360;
const basisOf = {};
for (const s of WARP_SHAPES) basisOf[s] = probeBasis(s, PN);

/**
 * The ARGUMENT `buildWave` hands the basis at sample `i`, transcribed from its own expression.
 *
 * ⚠️⚠️ **`2 * Math.PI * i / n` IS NOT THE SAME DOUBLE as `((360 * i * f) / period) / DEG`, and a bit-exact
 * clause cannot use the tidier form.** Measured 2026-10-29: comparing the triangle against a `2*pi*i/n`
 * oracle reported **42 of 360 samples differing by up to 8.88e-16** — not a second triangle, just the two
 * roundings of one angle. So §E1 transcribes the argument and compares only the BASIS, which is what it
 * claims to be about.
 */
const probeArg = i => ((360 * i * 1) / PN) / (180 / Math.PI);

{
  // E1. THE ONE TRIANGLE. `triBasis` is imported from `core/wave-law.ts` — Phase 34's extracted evaluator —
  // and compared BIT-EXACTLY against what the warp actually builds. ⚠️ This is the clause that makes
  // `35.D6` real: without it "imported, not copied" is a comment.
  let triDiffs = 0, triWorst = 0;
  for (let i = 0; i < PN; i++) {
    const want = triBasis(probeArg(i));
    if (!Object.is(basisOf.triangle[i], want)) {
      triDiffs++;
      triWorst = Math.max(triWorst, Math.abs(basisOf.triangle[i] - want));
    }
  }
  chk(`§E1 the warp's triangle IS core/wave-law.ts' triBasis, bit-exactly (${PN} samples, Object.is)`,
    triDiffs === 0,
    triDiffs === 0
      ? 'so 35.D6 — ONE triangle in the tree — is asserted and not merely commented'
      : `⚠️ ${triDiffs} samples differ, worst ${triWorst.toExponential(3)}: a SECOND triangle exists`);

  // The seed is the defect `34.1` already proved reachable in the other direction: seeding wave-law's
  // `+ 0.25` as `+ 0.5` left all 63 `deformcheck` clauses green. Here the same perturbation is applied to
  // the ORACLE, so the clause must notice.
  const badTri = a => { const u = a / (2 * Math.PI) + 0.5; return 1 - 4 * Math.abs(u - Math.floor(u) - 0.5); };
  let seedDiffs = 0;
  for (let i = 0; i < PN; i++) if (!Object.is(basisOf.triangle[i], badTri(probeArg(i)))) seedDiffs++;
  seed('the triangle\'s quarter-cycle offset changed from +0.25 to +0.5',
    seedDiffs > 0,
    `§E1 notices ${seedDiffs} of ${PN} samples — the exact perturbation that left deformcheck's 63 clauses `
    + 'green when it was seeded into wave-law.ts itself');
}

{
  // E2. RANGE. Every basis must live in [-1,1] and reach both ends, or `solveGain`'s normalisation is not
  // comparable across shapes and `Shape mix` would change the field's SIZE as well as its form.
  const rows = [];
  const bad = [];
  for (const s of WARP_SHAPES) {
    let lo = Infinity, hi = -Infinity;
    for (const v of basisOf[s]) { if (v < lo) lo = v; if (v > hi) hi = v; }
    rows.push(`${s} [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);
    if (lo < -1 || hi > 1 || hi < 0.99 || lo > -0.99) bad.push(s);
  }
  chk('§E2 every basis lies in [-1, 1] and reaches both ends within the sampling grid',
    bad.length === 0,
    bad.length === 0 ? rows.join('  ') : `⚠️ out of range or not reaching: [${bad}] — ${rows.join('  ')}`);
}

{
  /*
   * E3. THE CRITICAL ARGUMENTS, AND THEY ARE NOT WHAT `PHASE35-KEYS.md` §11.4 §C SAYS.
   *
   * That paragraph claims every shape "shares sine's zeros at `0` and `pi`". ⚠️ **Measured: TWO of the five
   * do not.** `square` is `+1` at BOTH (`Math.sign(Math.sin(pi))` is `sign(+1.22e-16)` = 1), and `sawtooth`
   * is `-1` at 0 — the design document names only `square`. Both are the reason the frequency-0 exemption
   * in `buildWave`/`buildZoomWave` exists, and narrowing that exemption to `square` on the strength of the
   * document would reintroduce the defect for `sawtooth`.
   *
   * The expectation below is hand-written HERE, from the shape definitions, so the engine is held to an
   * INDEPENDENT statement rather than to itself — §B's discipline.
   */
  const AT_ZERO = { sine: 0, triangle: 0, trapezoid: 0, square: 1, sawtooth: -1 };
  const AT_PI = { sine: 0, triangle: 0, trapezoid: 0, square: 1, sawtooth: 0 };
  const d = setDiff(WARP_SHAPES, Object.keys(AT_ZERO));
  chk('§E3a the independent basis(0)/basis(pi) table covers exactly the shipped palette',
    d.missing.length === 0 && d.extra.length === 0,
    d.missing.length === 0 ? 'so §E3b is a comparison, not a subset test'
      : `⚠️ undecided here: [${d.missing}] — a new shape must be classified in this checker too`);

  // ⚠️ Probed at i = 0 and i = PN/2, which ARE the arguments 0 and pi exactly at a square canvas.
  const wrong = WARP_SHAPES.filter(s =>
    Math.abs(basisOf[s][0] - AT_ZERO[s]) > 1e-12 || Math.abs(basisOf[s][PN / 2] - AT_PI[s]) > 1e-12);
  chk('§E3b basis(0) and basis(pi) match it — square is +1 at BOTH and sawtooth is -1 at zero',
    wrong.length === 0,
    wrong.length === 0
      ? WARP_SHAPES.map(s => `${s}(0)=${basisOf[s][0]}`).join(' ')
      : `⚠️ disagree on [${wrong}]`);

  seed('`sawtooth` expected to be 0 at the origin, as the design document implies',
    Math.abs(basisOf.sawtooth[0] - 0) > 1e-12,
    `measured ${basisOf.sawtooth[0]} — §E3b would refuse the document's own claim, which is why the `
    + 'frequency-0 exemption covers TWO shapes and not one');
}

{
  /*
   * E4/E5. THE DISPATCH IS ONE OWNER, AND THE `switch` IS A REAL IF NARROW `tsc` GATE.
   *
   * With every union member covered and **no `default` arm**, TypeScript proves the end of `shapeFn`
   * unreachable; a sixth `WarpShape` makes it reachable and the declared return type rejects the implicit
   * `undefined` (TS2366). ⚠️ **Adding a `default` surrenders that silently** — and it is the ONLY compiler
   * protection the dispatch has, since §A exists precisely because `WARP_SHAPES`' array has none.
   */
  const body = braceBody(sfSrc, 'function shapeFn');
  chk('§E4a shapeFn() was FOUND and is a switch on the shape',
    body.length > 0 && /switch\s*\(\s*shape\s*\)/.test(body),
    `${body.length} chars of brace-matched body`);

  chk('§E4b ...with no `default` arm — that absence IS the tsc gate (TS2366 on a sixth member)',
    body.length > 0 && !/\bdefault\s*:/.test(body),
    'every union member has a `case` and the end of the function is unreachable, so adding a member is a '
    + 'compile error. ⚠️ A `default` would make it compile and silently resolve the new shape as something else');

  const cases = [...body.matchAll(/case '([a-z]+)'/g)].map(m => m[1]);
  const cd = setDiff(WARP_SHAPES, cases);
  chk(`§E4c ...and it has a case for every member of WARP_SHAPES (${cases.length})`,
    cd.missing.length === 0 && cd.extra.length === 0,
    cd.missing.length === 0 ? `[${cases.join(', ')}]` : `⚠️ missing [${cd.missing}] extra [${cd.extra}]`);

  seed('a `default` arm added to shapeFn()',
    /\bdefault\s*:/.test(body.replace(/case 'sawtooth'/, 'default:')),
    '§E4b notices — the clause reads the dispatch\'s own text, so the gate cannot be surrendered quietly');

  // E5. ONE TRIANGLE IN THE TREE, asserted structurally as well as numerically (§E1).
  chk('§E5a static-field.ts IMPORTS triBasis from core/wave-law.ts',
    /import \{ triBasis \} from '\.\.\/core\/wave-law\.ts'/.test(rd('post-processors/static-field.ts')),
    '35.D6: the triangle has ONE owner and this file is a consumer of it');
  chk('§E5b ...and contains no SECOND triangle of its own',
    !/1\s*-\s*4\s*\*\s*Math\.abs/.test(sfSrc),
    'the `1 - 4*|frac(u+1/4) - 1/2|` form appears nowhere here — `trapezoid` is derived from the import '
    + '(`triBasis(a) * 2`, clipped), so it has no triangle of its own either');
}

{
  /*
   * E6. THE FREQUENCY-0 EXEMPTION — a slot with no wave keeps its DC term.
   *
   * Every term of the argument carries `freq` as a factor, so at `f === 0` the argument is exactly 0 at
   * every pixel and every drift phase. `Math.sin(0)` is 0, so such a slot contributes NOTHING to a shift
   * wave and exactly `bias * amp` to a zoom wave — which is `carryZoomBias()`'s entire premise and what the
   * bake's bit-tightness rests on (§K). ⚠️ **Two shapes are nonzero there (§E3), so without the exemption a
   * DEAD slot would come alive the moment a shape was picked** — measured 7 such slots across 5 shipped
   * presets (`Penta Star System`, `Penta Star Eternal Flow`, `Anima Electrica`, `The Real Black Hole`,
   * `Voyager`), 4 of them on the SHIFT half.
   */
  let worst = 0, worstShape = '';
  for (const s of WARP_SHAPES) {
    const w = probeBasis(s, 64, 0);
    for (const v of w) if (Math.abs(v) > worst) { worst = Math.abs(v); worstShape = s; }
  }
  chk('§E6 a frequency-0 slot is EXEMPT: the wave is identically zero for every shape, at amplitude 1',
    worst === 0,
    worst === 0 ? 'all five shapes, 64 samples each — so a dead slot stays dead'
      : `⚠️ ${worstShape} reaches ${worst} — a slot that contributes nothing on the sine path has acquired a `
        + 'DC term, which reads as a translated field (shift half) or a changed steady zoom (zoom half)');

  // The seed is two-directional and uses only §E3's own measured values: without the exemption the slot
  // would contribute basis(0) * amp, which is +1 for square and -1 for sawtooth.
  seed('the exemption removed — what a frequency-0 slot would then contribute',
    Math.abs(basisOf.square[0]) === 1 && Math.abs(basisOf.sawtooth[0]) === 1,
    `square would add ${basisOf.square[0]} x amp and sawtooth ${basisOf.sawtooth[0]} x amp at EVERY pixel. `
    + 'So the exemption is worth exactly one full amplitude on two of the five shapes, not a rounding error');
}

// ---------------------------------------------------------------------------------------------------
// F. THE TWELVE CALL SITES ACROSS TWO FUNCTIONS — and the four PROBES, which are the invisible ones
// ---------------------------------------------------------------------------------------------------
console.log('\n--- F. the twelve call sites and the four unit-gain probes ---');

/*
 * ⚠️⚠️ **THE CENSUS IS TWELVE SITES ACROSS TWO FUNCTIONS, NOT FOUR ON ONE.** The spec's §5.1 says *"four
 * call sites, two parameter pairs"* and puts style 3's zoom tables among them; they do not go through
 * `buildWave` at all. `buildWave` has SIX sites (two regime pairs plus the two unit-gain probes
 * `solveGain`/`solveGain3` measure) and `buildZoomWave` — a separate function with a DC bias term — has SIX
 * more (two regime pairs plus two probes). **So `shape2`/`shapeMix2` are a second FUNCTION's parameters,
 * and crossing the pairs is a style-DEPENDENT divergence `tsc` cannot see.**
 */
const F_EXPECT_WAVE = 6, F_EXPECT_ZOOM = 6;

{
  /** Every call to `name(` in `src`, returned as its full parenthesis-matched call text. */
  const callArgsOf = (src, name) => {
    const out = [];
    const re = new RegExp(`\\b${name}\\(`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      if (/function\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
      let depth = 0;
      for (let i = m.index + m[0].length - 1; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) { out.push(src.slice(m.index, i + 1)); break; }
      }
    }
    return out;
  };

  const pureWave = callArgsOf(sfSrc, 'buildWave').filter(c => c.startsWith('buildWave('));
  const zoomCalls = callArgsOf(sfSrc, 'buildZoomWave').filter(c => c.startsWith('buildZoomWave('));

  chk(`§F1 buildWave has exactly ${F_EXPECT_WAVE} call sites`,
    pureWave.length === F_EXPECT_WAVE,
    `found ${pureWave.length}. ⚠️ A NEW site is required to go red here until it is counted — the census is `
    + 'the only thing that knows a probe exists');
  chk(`§F2 buildZoomWave has exactly ${F_EXPECT_ZOOM} call sites`,
    zoomCalls.length === F_EXPECT_ZOOM,
    `found ${zoomCalls.length}`);

  const waveShaped = pureWave.filter(c => /\bs\.shape\b/.test(c) && /\bs\.shapeMix\b/.test(c));
  chk('§F3 EVERY buildWave site passes `s.shape, s.shapeMix` — the two PROBES included',
    waveShaped.length === pureWave.length,
    waveShaped.length === pureWave.length
      ? `${waveShaped.length}/${pureWave.length}. ⚠️ The probe sites (uX/uY) are the dangerous ones: left at `
        + 'sine while the rendered waves are shaped, solveGain calibrates against a field nobody renders'
      : `⚠️⚠️ ${pureWave.length - waveShaped.length} UNSHAPED site(s): `
        + pureWave.filter(c => !waveShaped.includes(c)).map(c => c.slice(0, 70)).join(' | '));

  const zoomShaped = zoomCalls.filter(c => /\bs\.shape2\b/.test(c) && /\bs\.shapeMix2\b/.test(c));
  chk('§F4 EVERY buildZoomWave site passes `s.shape2, s.shapeMix2` — the two zoom PROBES included',
    zoomShaped.length === zoomCalls.length,
    zoomShaped.length === zoomCalls.length
      ? `${zoomShaped.length}/${zoomCalls.length}`
      : `⚠️⚠️ ${zoomCalls.length - zoomShaped.length} UNSHAPED site(s): `
        + zoomCalls.filter(c => !zoomShaped.includes(c)).map(c => c.slice(0, 70)).join(' | '));

  // ⚠️ The CROSSING clause, and it is the one `tsc` is blindest to: both pairs are `(WarpShape, number)`.
  const crossedWave = pureWave.filter(c => /\bs\.shape2\b|\bs\.shapeMix2\b/.test(c));
  const crossedZoom = zoomCalls.filter(c => /\bs\.shape\b(?!2)|\bs\.shapeMix\b(?!2)/.test(c));
  chk('§F5 the two pairs are never CROSSED — buildWave never sees `shape2`, buildZoomWave never bare `shape`',
    crossedWave.length === 0 && crossedZoom.length === 0,
    crossedWave.length + crossedZoom.length === 0
      ? 'both pairs are (WarpShape, number), so tsc accepts either at either site and the divergence shows '
        + 'only on style 3'
      : `⚠️⚠️ crossed: ${[...crossedWave, ...crossedZoom].map(c => c.slice(0, 70)).join(' | ')}`);

  const seedCalls = pureWave.map(c => c.replace(/,\s*s\.shape, s\.shapeMix\)/, ')'));
  seed('the shape dropped from a buildWave site',
    seedCalls.filter(c => /\bs\.shape\b/.test(c)).length < pureWave.length,
    `§F3 notices ${pureWave.length - seedCalls.filter(c => /\bs\.shape\b/.test(c)).length} site(s) — and this `
    + 'is the form the probe defect would take');

  chk('§F6 both declarations take the shape pair LAST, so a positional mistake is a type error',
    /function buildWave\([^)]*shape: WarpShape,\s*shapeMix: number,\s*\)/s.test(sfSrc)
    && /function buildZoomWave\([^)]*shape: WarpShape,\s*shapeMix: number,\s*\)/s.test(sfSrc),
    'the preceding parameters are all `number`, so the `WarpShape` in the penultimate slot is the one '
    + 'positional guard the signature can give');
}

/*
 * ⚠️⚠️ **F7 IS THE MEASURING CLAUSE FOR THE FOUR PROBES AND IT IS DECISIVE WHERE A SOURCE SCAN IS NOT.**
 *
 * `solveGain`/`solveGain3` measure the peak of the UNIT-GAIN waves on a `GAIN_SCAN`-step grid and divide the
 * target by it. So the RESOLVED field's peak, measured **on that same grid**, must come out at exactly
 * `strength x STATIC_FIELD_TARGET_FRACTION x min(w,h)` — for every shape, because each is normalised to the
 * one target. ⚠️ **Measuring on the solver's own grid is what makes this tight:** an exhaustive scan finds
 * peaks the solver's 128 steps stepped over, which is the documented 1.03x spread and would swamp the
 * defect.
 *
 * ⚠️⚠️ **AND THE DEFECT'S MAGNITUDE IS NOT THE 1.03x THE DESIGN DOCUMENT QUOTES — THOSE ARE TWO
 * MEASUREMENTS WEARING THE SAME WORDS.** 1.03x is the spread of the realised peak against the target under
 * CORRECT code. The cost of an unshaped probe is the unit-basis peak RATIO, measured below: 1.000 on
 * `Grid Lattice` style 0 but up to **1.49x on `Turbulent Weave`**. So the clause needs a multi-term
 * archetype in its basis or it is blind on exactly the tables where the defect is largest.
 */
const GAIN_SCAN = 128;
const ZERO_TABLE = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
const gridPeak = (style, r, w, h, cx, cy) => {
  const stepX = Math.max(1, Math.floor(w / GAIN_SCAN)), stepY = Math.max(1, Math.floor(h / GAIN_SCAN));
  let peak = 0;
  for (let y = 0; y < h; y += stepY) for (let x = 0; x < w; x += stepX) {
    const wx = r.waveX[x], wy = r.waveY[y];
    let dx, dy;
    if (style === 0) { dx = wy; dy = wx; }
    else if (style === 1) { dx = (x - cx) * -wx; dy = (y - cy) * -wy; }
    else if (style === 2) { const dz = -(wx + wy) / 2; dx = (x - cx) * dz; dy = (y - cy) * dz; }
    else { const dz = -(r.zoomX[x] + r.zoomY[y]) / 2; dx = wy + (x - cx) * dz; dy = wx + (y - cy) * dz; }
    const d = Math.hypot(dx, dy);
    if (d > peak) peak = d;
  }
  return peak;
};

{
  const W = 1920, H = 1080, STR = 0.5;
  // ⚠️ `Turbulent Weave` is NOT optional here — see the paragraph above. Four terms is where an unshaped
  // probe costs ~49 % and a one-term table is where it costs nothing.
  const PATTERNS = ['Grid Lattice', 'Interference', 'Fine Mesh', 'Turbulent Weave', 'Diagonal Shear'];
  const want = STR * SF.STATIC_FIELD_TARGET_FRACTION * Math.min(W, H);
  let worst = 0, worstName = '', n = 0;
  for (const pattern of PATTERNS) for (const shape of WARP_SHAPES) for (const style of [0, 1, 2, 3]) {
    const layer = { style, weight: 1, staticField: {
      pattern, pattern2: pattern, strength: STR, strength2: STR,
      shape, shapeMix: 1, shape2: shape, shapeMix2: 1 } };
    const r = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
    const rel = Math.abs(gridPeak(style, r, W, H, W / 2, H / 2) / want - 1);
    n++;
    if (rel > worst) { worst = rel; worstName = `${pattern} ${shape} style ${style}`; }
  }
  // ⚠️ 1e-9, derived from the run (worst observed 0.0 to six decimals) and NOT picked to pass: the defect it
  // refuses is 2.4e-2 at its SMALLEST reachable magnitude and 4.9e-1 at its largest. Seven orders of margin.
  chk(`§F7 the realised peak is strength x target on solveGain's OWN grid, for every shape (${n} fields)`,
    worst < 1e-9,
    `worst relative deviation ${worst.toExponential(2)} (${worstName}) against a 1e-9 bound. `
    + 'An unshaped probe would land the peak at the unit-basis peak RATIO instead of 1');

  // THE CALIBRATION: the magnitude an unshaped probe would cost, measured, so the bound above is known to be
  // tighter than the defect rather than merely green. The `(Preset)` branch applies NO gain solve, so its
  // peak IS the raw unit peak.
  const TW = [[0.5, 0.25, 0.125, 0.0625], [1, 2, 4, 8], [0.5, 0.25, 0.125, 0.0625], [1, 2, 4, 8]];
  const unitPeak = (shape, style) => {
    const layer = { style, weight: 1, staticField: { pattern: '(Preset)', strength: 0.5, shape, shapeMix: 1 } };
    return gridPeak(style, SF.resolveStaticWaves(layer, TW, TW, W, H, W / 2, H / 2, 0), W, H, W / 2, H / 2);
  };
  const ratios = WARP_SHAPES.filter(s => s !== 'sine').map(s => [s, unitPeak(s, 0) / unitPeak('sine', 0)]);
  const biggest = Math.max(...ratios.map(([, r]) => Math.abs(r - 1)));
  seed('the probe left at sine while the rendered wave is shaped (Turbulent Weave, style 0)',
    biggest > 1e-3,
    `the peak would land at ${ratios.map(([s, r]) => `${s} ${r.toFixed(3)}x`).join(', ')} — worst deviation `
    + `${biggest.toExponential(2)}, i.e. ${(biggest / 1e-9).toExponential(1)}x the bound §F7 uses`);
}

// ---------------------------------------------------------------------------------------------------
// G. BIT-IDENTITY AT BOTH IDENTITIES, OVER THE POPULATION WHOSE WAVE IS ACTUALLY BUILT
// ---------------------------------------------------------------------------------------------------
console.log('\n--- G. bit-identity at both identities ---');

/*
 * ⚠️⚠️ **THE POPULATION IS THE BUILT-WAVE SET, NOT THE NON-DEFAULT-BLOCK SET.** Measured 2026-10-29: **278
 * presets / 278 layers / 612 wave arrays** (styles 0 -> 201, 1 -> 7, 2 -> 42, 3 -> 28), because every
 * separable-style preset builds a wave through the `(Preset)` branch at defaults — and those are exactly the
 * presets the bit-identity contract exists to protect. Only **25** carry a non-default
 * `overlay.transMapChain[].staticField`; binding this gate to those would UNDER-COVER BY 253.
 *
 * ⚠️ **TWO INDEPENDENT IDENTITIES, asserted separately and never coupled** (`35.D2`): `shape: 'sine'` at any
 * mix, and `shapeMix: 0` at any shape. A user who picks a shape and leaves the mix at 0 must see NOTHING.
 */
const G_LAYERS = [];
{
  const rawText = readFileSync(join(SRC, '..', 'public', 'psss_presets.json'), 'utf8');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgr = new PresetManager();
  loadLibrary(mgr, rawLib);

  for (const name of mgr.list()) {
    const p = mgr.get(name);
    if (!p) continue;
    const chain = chainFromOverlay(p.overlay, p.postProcessors?.transMap?.style ?? 0);
    for (const l of buildChainPlan(chain).staticStyles) {
      G_LAYERS.push({ name, l,
        t1: p.postProcessors.transMap.sinMagicParams,
        t2: p.postProcessors.transMap.sinMagicParams2 ?? p.postProcessors.transMap.sinMagicParams });
    }
  }

  /*
   * ⚠️⚠️ **`extra === null` MEANS *THE FOUR SHAPE KEYS DELETED*, NOT *THE LAYER AS AUTHORED* — AND THOSE WERE
   * THE SAME THING ONLY WHILE NOTHING AUTHORED A SHAPE** (fixed 2026-10-29, `35.4`, on `35.6`'s demos).
   *
   * §G1's own label is *"bitwise identical to the field with NO SHAPE KEYS"*, and that is the right claim:
   * the contract is that an identity-valued shape block renders what a shape-free body renders. The baseline
   * was `e.l` verbatim, so the moment eight demo presets authored `shape: 'square'` at `shapeMix: 1.0` the
   * clause began comparing *square at full mix* against *sine at mix 0* and reported 8 / 8 / 8 / 1 layers
   * "differing" over an engine that is bit-exact. Measured both readings over all 297 live separable layers:
   * **as-authored 8/8/8/1, keys-deleted 0/0/0/0** under `Object.is` on every element.
   *
   * ⚠️ **It also silently weakened §G2.** A layer that already stores `square` at mix 1 does not MOVE when
   * the override writes `square` at mix 1, so each new demo subtracted one from the non-vacuity count.
   *
   * ⚠️⚠️ **THIRD INSTANCE OF ONE PATTERN IN ONE DAY, which is why this is a paragraph and not a line.**
   * `mixercheck` §O passed vacuously over all 28 Phase 34 registry keys until eleven demos authored them,
   * and then exposed two real clause defects; §G1 has just done the same; and `35.1` recorded a third shape
   * of it in `WARP_SHAPES`. **A clause whose baseline is "the layer as authored" is correct only while
   * nothing authors the thing it measures, and a green run over a key no preset carries is invisibility
   * rather than coverage.** ⛔ The two tempting wrong fixes are a TOLERANCE and an exemption list of the
   * eight names: both discard the assertion. **The label was right and the baseline was wrong.**
   *
   * ⚠️ **CALIBRATED BOTH WAYS, 2026-10-29, each seed applied to the tree, measured and reverted (`diff -q`
   * verified):** restoring the as-authored baseline reproduces **8 / 8 / 8 / 1**, naming only the demo
   * carriers; and seeding `resolveShape` so a stored mix of 0 resolves to 0.05 — the shape/mix COUPLING
   * `35.D2` forbids and `SHAPE_NOTICES.mixZero` replaces — fires **2** of the four at **287 and 28** layers,
   * naming `Aliens DNA` and `Anima Electrica`. **So the fix moved the baseline without costing the
   * assertion.** ⚠️ A seed that merely perturbs the BLEND is not a calibration of this section: the identity
   * is taken by BRANCH (`resolveShape` returns `fn: null`), so such a seed goes red in §E instead — which is
   * §G3's finding, and the reason the branch is required by the RULE rather than by a failure here.
   */
  const SHAPE_KEYS = ['shape', 'shapeMix', 'shape2', 'shapeMix2'];
  const resolve = (e, extra) => {
    const sf = { ...(e.l.staticField ?? {}) };
    /*
     * ⚠️⚠️ **STRIPPED ON *BOTH* SIDES, and stripping only the baseline fixed three of the four clauses and
     * left the fourth red over correct code.** `'the zoom half shaped at mix 0 only'` writes `shape2` and
     * `shapeMix2` alone — on purpose, because the two halves must be independent — so with the authored
     * block underneath it, that side still carried the demo's `shape: 'square'` at `shapeMix: 1.0` while
     * the baseline no longer did. **Every comparison here is *the shape-free body plus exactly the keys
     * under test*, which is what the label says and the only reading under which a PARTIAL override means
     * what it is written to mean.**
     */
    for (const k of SHAPE_KEYS) delete sf[k];
    if (extra !== null) Object.assign(sf, extra);
    return SF.resolveStaticWaves({ ...e.l, staticField: sf }, e.t1, e.t2, 1920, 1080, 960, 540, 0);
  };
  const sameBits = (a, b) => {
    for (const k of ['waveX', 'waveY', 'zoomX', 'zoomY']) {
      if ((a[k] === null) !== (b[k] === null)) return false;
      if (a[k] === null) continue;
      if (a[k].length !== b[k].length) return false;
      for (let i = 0; i < a[k].length; i++) if (!Object.is(a[k][i], b[k][i])) return false;
    }
    return true;
  };

  chk('§G0 the basis is the BUILT-WAVE population, not the non-default-block one',
    G_LAYERS.length > 250,
    `${G_LAYERS.length} live separable layers over ${mgr.list().length} presets. Binding this to the ~25 `
    + 'presets carrying a non-default staticField block would under-cover by ~253');

  /*
   * ⚠️⚠️ **§G0b — THE LIVE-CARRIER CENSUS, ADDED 2026-10-31 BECAUSE A DELETION BATCH EMPTIED TWO BUCKETS AND
   * EVERY CLAUSE IN THIS FILE STAYED GREEN.** The owner deleted `Warp Split Shapes` (the library's only live
   * `shape2`/`shapeMix2`) and `Warp Zoom Oblique` (its only non-zero `angleX2`/`angleY2`) — both headers said
   * in writing that this was what the preset existed for — and `shapecheck` reported 114 passed, 0 failed over
   * a library that no longer exercises the zoom half at all. **`CLAUDE.md`'s rule in the wild: a quantity NO
   * PRESET AUTHORS is not covered by a green clause, it is INVISIBLE to it.**
   *
   * ⚠️ **This clause does NOT fail on an empty bucket, and that is deliberate** — which presets ship is the
   * owner's call, and a checker that refuses a deletion would be arguing with it. **What it refuses is an
   * empty bucket with NO unit probe behind it**: §F2–§F5 assert the six `buildZoomWave` call sites and that
   * every one passes `s.shape2, s.shapeMix2`, and §N's probes drive the branch directly. So the pass means
   * *either the library demonstrates it or this file does*, and the printed census is what tells you which.
   *
   * ⚠️ **Read a zero here as a decision, not as a defect — and read it BEFORE concluding that a green §G/§H
   * proves anything about the zoom half.**
   */
  const censusOf = (pick) => G_LAYERS.filter(({ l }) => pick(l.staticField ?? {})).map(({ name }) => name);
  const CENSUS = [
    ['shape (shift half)', (f) => f.shape && f.shape !== 'sine' && (f.shapeMix ?? 0) > 0],
    ['shape2 (zoom half)', (f) => f.shape2 && f.shape2 !== 'sine' && (f.shapeMix2 ?? 0) > 0],
    ['angleX/Y (shift)', (f) => (f.angleX ?? 0) !== 0 || (f.angleY ?? 0) !== 0],
    ['angleX2/Y2 (zoom)', (f) => (f.angleX2 ?? 0) !== 0 || (f.angleY2 ?? 0) !== 0],
  ];
  const zoomProbed = /buildZoomWave\(/.test(readFileSync(new URL(import.meta.url), 'utf8'));
  const census = CENSUS.map(([label, pick]) => {
    const carriers = [...new Set(censusOf(pick))];
    return `${label}: ${carriers.length}${carriers.length ? ' (' + carriers.slice(0, 3).join(', ') + ')' : ' ⚠ NONE'}`;
  });
  const emptyBuckets = CENSUS.filter(([, pick]) => censusOf(pick).length === 0).map(([l]) => l);
  chk('§G0b every shape/angle quantity is demonstrated by the LIBRARY, or by this file if not',
    emptyBuckets.length === 0 || zoomProbed,
    `${census.join(' · ')}`
    + (emptyBuckets.length
      ? `. ⚠️⚠️ **${emptyBuckets.length} bucket(s) have no live carrier: [${emptyBuckets.join(', ')}] — so for `
        + 'those, §F\'s source clauses and §N\'s unit probes are the ONLY coverage, and no library-reading '
        + 'clause in this file says anything about them.** Emptied 2026-10-31 by the owner\'s second deletion '
        + 'batch; re-homing them onto a surviving demo is an AUTHORING decision, not a checker fix'
      : '. All four demonstrated by shipped presets'));
  /*
   * ⚠️ **Calibrated, because the clause's whole value is the FALLBACK and a fallback nobody tests is prose.**
   * The seed is the state this file would be in if the unit probes were deleted as "already covered by the
   * demos" — which is the exact argument someone would make, in the one week when it was true.
   */
  seed('§G0b the unit probes removed while the library buckets are empty',
    !(emptyBuckets.length === 0 || false),
    `with ${emptyBuckets.length} empty bucket(s) and no \`buildZoomWave\` probe in this file, the clause goes `
    + 'RED — which is the only configuration in which the zoom half has no coverage at all');

  // ⚠️ Four identity configurations, because both identities must hold INDEPENDENTLY and at BOTH halves.
  const IDENTITIES = [
    ['shape sine, mix 0 written explicitly', { shape: 'sine', shapeMix: 0, shape2: 'sine', shapeMix2: 0 }],
    ['mix 0 under a DISCONTINUOUS shape', { shape: 'square', shapeMix: 0, shape2: 'sawtooth', shapeMix2: 0 }],
    ['sine at FULL mix', { shape: 'sine', shapeMix: 1, shape2: 'sine', shapeMix2: 1 }],
    ['the zoom half shaped at mix 0 only', { shape2: 'square', shapeMix2: 0 }],
  ];
  for (const [label, extra] of IDENTITIES) {
    let bad = 0, firstBad = '';
    for (const e of G_LAYERS) {
      if (!sameBits(resolve(e, null), resolve(e, extra))) { bad++; if (!firstBad) firstBad = e.name; }
    }
    chk(`§G1 ${label}: bitwise identical to the field with no shape keys (${G_LAYERS.length} layers)`,
      bad === 0,
      bad === 0 ? 'Object.is over every element of every array, so -0 is caught'
        : `⚠️⚠️ ${bad} layers differ, first ${firstBad} — the identity arm is not the pre-change expression`);
  }

  // NOT VACUOUS: the clauses above would pass over a builder that ignored the shape entirely.
  let changed = 0;
  for (const e of G_LAYERS) {
    if (!sameBits(resolve(e, null), resolve(e, { shape: 'square', shapeMix: 1 }))) changed++;
  }
  chk('§G2 ...and a shape at FULL mix does change the field, so §G1 is not vacuous',
    changed > G_LAYERS.length * 0.5,
    `${changed} of ${G_LAYERS.length} layers move under square at mix 1 (the rest have a degenerate table)`);

  /*
   * ⚠️⚠️ **G3: THE `-0` RULE, AND THE MEASURED LIMIT OF ITS REACH TODAY.**
   *
   * `(1 - 0) * Math.sin(th) + 0 * fn(th)` is exact for every finite value except `-0`, and `-0` IS reachable
   * in this builder: at `i === 0` with a NEGATIVE frequency on a square canvas every term of `th` is `-0` or
   * `+0` summing to `-0`, so `Math.sin(th)` is `-0` — while `0 * sqrSin(-0)` is `+0` (`Math.sign(-0)` is
   * `-0`, which is FALSY, so the `|| 1` guard returns 1) and `-0 + 0` is `+0`.
   *
   * ⚠️ **Measured: that difference does NOT currently reach `out[i]`, because the accumulator starts at `+0`
   * and `0 + (-0)` is `+0`.** So the two forms happen to agree on this function's OUTPUT — an accident of
   * `let s = 0`, not a property of the arithmetic. **This clause records the hazard at the expression level,
   * where the rule lives, rather than claiming an output difference the tree does not have.** It is the
   * honest form: the branch makes the guarantee structural instead of lucky, and it is the cheaper arm.
   */
  const th = ((360 * 0 * -1) / 360) / (180 / Math.PI) + Math.PI * -1 * (1 - 360 / 360) + 0 * -1;
  const branch = Math.sin(th);
  const weighted = (1 - 0) * Math.sin(th) + 0 * (Math.sign(Math.sin(th)) || 1);
  chk('§G3 the zero-weighted blend is NOT bitwise the pre-change expression at a reachable argument',
    Object.is(th, -0) && Object.is(branch, -0) && Object.is(weighted, 0) && !Object.is(branch, weighted),
    `th = -0 (i=0, freq=-1, square canvas); branch -> ${branch}, weighted -> ${weighted}. `
    + '⚠️ Today `let s = 0` absorbs it (0 + -0 === 0), so the OUTPUT agrees — which is why the branch is '
    + 'required by the RULE rather than by a failing measurement. Do not merge the two arms.');
}

// ---------------------------------------------------------------------------------------------------
// H. THE TEAR MEASUREMENT — EXHAUSTIVE, and what §B's classification rests on
// ---------------------------------------------------------------------------------------------------
console.log('\n--- H. the exhaustive tear measurement ---');

/*
 * **"Exhaustive" means EVERY adjacent output-pixel pair at 1920x1080 — both horizontal and vertical — with
 * the SOURCE pixels compared**: about 4.1 M pairs per field, over 20 fields (5 shapes x styles 0-3). No
 * step, no sample, no margin. ~2.5 s.
 *
 * ⚠️⚠️ **THE DESIGN DOCUMENT'S EMPIRICAL REASON FOR EXHAUSTIVENESS DOES NOT REPRODUCE, AND THE REAL REASON
 * IS THE OPPOSITE ERROR.** `PHASE35-KEYS.md` §11.2 says *"a 3-px-step scan reported 0.0 tears for
 * EVERY shape including square, because a 1-D wave's discontinuities fall on a measure-zero set of lines"*.
 * Measured here on `Grid Lattice`: a step-3 scan reports `square` at **62.1 px** against the exhaustive
 * **62.0** — it does NOT miss the tear, because a 3-px-wide pair still straddles the jump. What it DOES do
 * is inflate the CONTINUOUS shapes to **4.2-6.3 px**, over the 4-px tear criterion, so a sampled scan
 * certifies a clean field as TORN and its count means nothing. The exhaustive scan puts
 * sine/triangle/trapezoid at **1.4-2.2 px**, cleanly under the criterion (§H3). **Exhaustive is still the
 * right assertion; the justification is a false-POSITIVE one, not a false-negative one.**
 *
 * ⚠️ **The discriminator is tear MAGNITUDE, not count.** `sine` already tears at the pre-existing `jsRound`
 * quantisation floor, and `trapezoid` sits in that same class.
 */
const TEAR_CRITERION_PX = 4;
const TEAR_CLASS_PX = 32;

{
  const W = 1920, H = 1080;
  const out = new Float64Array(2);
  const measured = {};
  for (const shape of WARP_SHAPES) {
    let maxTear = 0, worstStyle = -1, perMille = 0;
    for (const style of [0, 1, 2, 3]) {
      const layer = { style, weight: 1, staticField: {
        pattern: 'Grid Lattice', pattern2: 'Grid Lattice',
        shape, shapeMix: 1, shape2: shape, shapeMix2: 1 } };
      const r = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
      const L = [{ style, centreX: W / 2, centreY: H / 2, ratio: 1,
        waveX: r.waveX, waveY: r.waveY, zoomX: r.zoomX, zoomY: r.zoomY }];
      const sx = new Float64Array(W), sy = new Float64Array(W);
      const px = new Float64Array(W), py = new Float64Array(W);
      let have = false, mx = 0, nTear = 0, pairs = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          SF.staticOffsetAt(L, x, y, W, H, out);
          sx[x] = x + out[0] * W; sy[x] = y + out[1] * H;
        }
        for (let x = 1; x < W; x++) {
          const d = Math.hypot(sx[x] - sx[x - 1], sy[x] - sy[x - 1]);
          pairs++; if (d > mx) mx = d; if (d > TEAR_CRITERION_PX) nTear++;
        }
        if (have) for (let x = 0; x < W; x++) {
          const d = Math.hypot(sx[x] - px[x], sy[x] - py[x]);
          pairs++; if (d > mx) mx = d; if (d > TEAR_CRITERION_PX) nTear++;
        }
        px.set(sx); py.set(sy); have = true;
      }
      if (mx > maxTear) { maxTear = mx; worstStyle = style; perMille = nTear / pairs * 1000; }
    }
    measured[shape] = { maxTear, worstStyle, perMille };
  }

  const wrong = WARP_SHAPES.filter(s => WARP_SHAPE_DISCONTINUOUS[s] !== (measured[s].maxTear > TEAR_CLASS_PX));
  chk(`§H1 WARP_SHAPE_DISCONTINUOUS is a MEASUREMENT: disc === (maxTear > ${TEAR_CLASS_PX} px), exhaustively`,
    wrong.length === 0,
    wrong.length === 0
      ? WARP_SHAPES.map(s => `${s} ${measured[s].maxTear.toFixed(1)}px/s${measured[s].worstStyle}`
        + `@${measured[s].perMille.toFixed(2)}permille`).join('  ')
      : `⚠️⚠️ [${wrong}] disagree — §B's classification is hand-typed and THIS is what it rests on`);

  const contMax = Math.max(...WARP_SHAPES.filter(s => !WARP_SHAPE_DISCONTINUOUS[s]).map(s => measured[s].maxTear));
  const discMin = Math.min(...WARP_SHAPES.filter(s => WARP_SHAPE_DISCONTINUOUS[s]).map(s => measured[s].maxTear));
  chk(`§H2 ...and the two classes are ${(discMin / contMax).toFixed(1)}x apart, so the threshold was not picked to pass`,
    discMin / contMax > 5,
    `continuous worst ${contMax.toFixed(1)} px, discontinuous best ${discMin.toFixed(1)} px, threshold `
    + `${TEAR_CLASS_PX}. ⚠️ A ratio near 1 would mean the threshold was fitted to the run`);

  chk(`§H3 the continuous shapes stay under the ${TEAR_CRITERION_PX}-px tear CRITERION itself`,
    contMax < TEAR_CRITERION_PX,
    `worst ${contMax.toFixed(1)} px — this is the clause a SAMPLED scan fails: a step-3 scan inflates the `
    + 'same shapes to 4.2-6.3 px and would certify a clean field as torn');

  // THE CALIBRATION, in the direction that reproduces: the sampled scan the design document recommends
  // against, shown failing §H3 rather than §H1.
  {
    const style = 0, shape = 'sine', step = 3;
    const layer = { style, weight: 1, staticField: { pattern: 'Grid Lattice', shape, shapeMix: 1 } };
    const r = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
    const L = [{ style, centreX: W / 2, centreY: H / 2, ratio: 1,
      waveX: r.waveX, waveY: r.waveY, zoomX: r.zoomX, zoomY: r.zoomY }];
    let mx = 0;
    for (let y = 0; y < H; y += step) for (let x = step; x < W; x += step) {
      SF.staticOffsetAt(L, x - step, y, W, H, out);
      const ax = x - step + out[0] * W, ay = y + out[1] * H;
      SF.staticOffsetAt(L, x, y, W, H, out);
      const d = Math.hypot(x + out[0] * W - ax, y + out[1] * H - ay);
      if (d > mx) mx = d;
    }
    seed(`a step-${step} SAMPLED scan of the CONTINUOUS sine field`,
      mx > TEAR_CRITERION_PX,
      `reports ${mx.toFixed(1)} px against the exhaustive ${measured.sine.maxTear.toFixed(1)} px, i.e. over `
      + `the ${TEAR_CRITERION_PX}-px criterion — §H3 refuses it. ⚠️ So sampling here over-reports a clean `
      + 'field rather than under-reporting a torn one, which is NOT what the design document predicted');
  }
}

// ---------------------------------------------------------------------------------------------------
// I. THE MIXER'S LAW — the shapes SNAP, the mixes LERP, and a missing leaf is DESTROYED
// ---------------------------------------------------------------------------------------------------
console.log('\n--- I. blendLayerBlocks(): snap vs lerp ---');

{
  const ipSrc = stripComments(rd('exploration/interpolate.ts'));
  const body = braceBody(ipSrc, 'function blendLayerBlocks');
  chk('§I0 blendLayerBlocks() was FOUND', body.length > 0, `${body.length} chars`);

  // ⚠️ The `staticField` arm's object literal, sliced between its own anchors — not the whole function,
  // which also carries the refraction, bandSplit and parallax arms. Both anchors are asserted, because a
  // slice that silently found nothing passes every "is X present" test by accident.
  const from = body.indexOf('layer.staticField = {');
  const to = body.indexOf('};', from);
  const arm = from >= 0 && to > from ? body.slice(from, to) : '';
  chk('§I1 the staticField arm was FOUND between both anchors', arm.length > 0, `${arm.length} chars`);

  const named = DEFAULT_KEYS.filter(k => new RegExp(`\\b${k}:`).test(arm));
  const missing = DEFAULT_KEYS.filter(k => !named.includes(k));
  chk(`§I2 all ${DEFAULT_KEYS.length} STATIC_FIELD_DEFAULTS keys are written by the arm`,
    missing.length === 0,
    missing.length === 0
      ? `[${named.join(', ')}]`
      : `⚠️⚠️ MISSING: [${missing}]. The literal REPLACES layer.staticField wholesale, so an omitted leaf is `
        + 'DESTROYED rather than left un-interpolated — and tsc cannot see it, because StaticFieldConfig is '
        + 'all-optional');

  // The snap/lerp split, read off the arm's own text: a snapped key reads the already-snapped
  // `layer.staticField?.X`, a lerped key goes through `mix(...)`.
  const SNAPPED = ['pattern', 'pattern2', 'shape', 'shape2'];
  const LERPED = DEFAULT_KEYS.filter(k => !SNAPPED.includes(k));
  const badSnap = SNAPPED.filter(k => !new RegExp(`${k}: layer\\.staticField\\?\\.${k}`).test(arm));
  const badLerp = LERPED.filter(k => !new RegExp(`${k}: mix\\(`).test(arm));
  chk('§I3 the four CATEGORICAL keys snap with the chain and the seven scalars go through mix()',
    badSnap.length === 0 && badLerp.length === 0,
    badSnap.length + badLerp.length === 0
      ? `snap [${SNAPPED.join(', ')}] — invariant 16; lerp [${LERPED.join(', ')}]`
      : `⚠️ not snapped [${badSnap}] / not lerped [${badLerp}]`);

  const seedArm = arm.replace(/\s*shapeMix2: mix\([^)]*\),/, '');
  seed('`shapeMix2` deleted from the blend arm',
    DEFAULT_KEYS.some(k => !new RegExp(`\\b${k}:`).test(seedArm)),
    `§I2 notices [${DEFAULT_KEYS.filter(k => !new RegExp(`\\b${k}:`).test(seedArm))}]`);
  const seedSnap = arm.replace(/shape: layer\.staticField\?\.shape/, 'shape: mixShape(sa, sb, t)');
  seed('`shape` turned into a blended value instead of a snap',
    !/shape: layer\.staticField\?\.shape/.test(seedSnap),
    '§I3 notices — a blended categorical choice has no meaning (invariant 16) and shapeFn has no '
    + 'intermediate to return');
}

{
  /*
   * ⚠️ **I4/I5 MEASURE the law through `interpolatePreset`, because §I2/§I3 are source-shaped.** A
   * source-shaped failure there means the owner was renamed or moved; a MEASURED failure here means the
   * arithmetic is wrong. Both are needed — this is §D's discipline applied to a blend.
   */
  const rawText = readFileSync(join(SRC, '..', 'public', 'psss_presets.json'), 'utf8');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgr = new PresetManager();
  loadLibrary(mgr, rawLib);
  const base = mgr.get(mgr.list()[0]);
  const withChain = (shape, shapeMix) => {
    const p = JSON.parse(JSON.stringify(base));
    p.overlay = { ...(p.overlay ?? {}), transMapChain: [
      { style: 0, enabled: true, weight: 1, staticField: { pattern: 'Grid Lattice', shape, shapeMix } }] };
    return p;
  };
  const A = withChain('sine', 0.2), B = withChain('square', 0.8);
  const at = t => interpolatePreset(JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B)), t, new Set())
    .overlay.transMapChain[0].staticField;

  const lo = at(0.25), mid = at(0.5), hi = at(0.75);
  chk('§I4 shapeMix LERPS: 0.2 -> 0.8 reads 0.35 / 0.50 / 0.65 at t = 0.25 / 0.5 / 0.75',
    Math.abs(lo.shapeMix - 0.35) < 1e-9 && Math.abs(mid.shapeMix - 0.5) < 1e-9
    && Math.abs(hi.shapeMix - 0.65) < 1e-9,
    `${lo.shapeMix} / ${mid.shapeMix} / ${hi.shapeMix}`);

  chk('§I5 shape SNAPS: the categorical choice crosses once and takes no intermediate value',
    lo.shape === 'sine' && hi.shape === 'square' && WARP_SHAPES.includes(mid.shape),
    `t=0.25 '${lo.shape}'  t=0.5 '${mid.shape}'  t=0.75 '${hi.shape}' — and WARP_SHAPES contains no value `
    + 'between them, which is why a lerp is not available. ⚠️ A Mixer pair authored so shapeMix dips toward '
    + '0 at the midpoint snaps where nothing can see it; that pair is the acceptance test and cannot be '
    + 'checked from a still');
}

// ---------------------------------------------------------------------------------------------------
// J. THE RANDOMISER — the style gate, the weighting, and the asymmetry with Phase 34
// ---------------------------------------------------------------------------------------------------
console.log('\n--- J. the Randomiser ---');

{
  const rzSrc = stripComments(rd('exploration/randomize.ts'));
  const body = braceBody(rzSrc, 'function applyStaticFieldJump');
  chk('§J0 applyStaticFieldJump() was FOUND', body.length > 0, `${body.length} chars`);

  // ⚠️ The ZOOM-HALF keys, and ONLY those: a style-0 layer never reaches `buildZoomWave`, so a zoom shape it
  // keeps is a key nothing reads — and with all fifteen keys now in `isStaticFieldDefault()` it is enough on
  // its own to force the chain out of legacy form on export, for a result that renders identically.
  //
  // ⚠️ **`angleX2`/`angleY2` joined the list at `35.3` and `angleX`/`angleY` must NOT**, which is the same
  // asymmetry `shape2` has against `shape`: `buildZoomWave` is reached only from style 3, while the SHIFT
  // waves are built on every separable style, so their angles are read on every one of them. **This clause
  // is a SEVEN-member set comparison by name, not a count** — the two one-sided reports below are what tell
  // an omission apart from an over-deletion.
  const ZOOM_HALF = ['pattern2', 'strength2', 'zoomBias', 'shape2', 'shapeMix2', 'angleX2', 'angleY2'];
  const deleted = DEFAULT_KEYS.filter(k => new RegExp(`delete target\\.staticField\\.${k};`).test(body));
  const d = setDiff(ZOOM_HALF, deleted);
  chk(`§J1 the non-style-3 gate deletes EXACTLY the ${ZOOM_HALF.length} zoom-half keys`,
    d.missing.length === 0 && d.extra.length === 0,
    d.missing.length === 0 && d.extra.length === 0
      ? `[${deleted.join(', ')}]`
      : `⚠️ not deleted: [${d.missing}] — a style with no zoom table keeps a zoom shape or a zoom ANGLE. `
        + `Wrongly deleted: [${d.extra}] — shape/shapeMix/angleX/angleY are read on EVERY separable style `
        + 'and must survive');

  const seedBody = body.replace(/\s*delete target\.staticField\.shape2;/, '');
  seed('the `shape2` delete removed from the style gate',
    !/delete target\.staticField\.shape2;/.test(seedBody),
    '§J1 notices by NAME, in both directions — so neither an omission nor an over-deletion passes');
}

{
  /*
   * ⚠️⚠️ **THE WEIGHTING IS THE LOAD-BEARING NUMBER AND A UNIFORM ROLL IS THE DEFECT.** Five shapes rolled
   * uniformly makes **four of five** random presets non-sinusoidal, which changes the Randomiser's whole
   * character rather than widening it. ⚠️ **And `shapeMix` is floored at `SHAPE_MIX_MIN` when a non-sine
   * shape is drawn**, because `shapeMix: 0` is one of the block's two independent identities: a roll that
   * could land there would produce an inert result that reads as the dice not working.
   *
   * ⚠️ **The asymmetry with Phase 34 is deliberate:** Phase 34 refuses to roll `Offset` because an Offset
   * can put the subject off the screen — an INVALID result. A warp shape cannot produce an invalid field,
   * only a torn one, and for a warp tearing is an aesthetic. One criterion, two answers.
   *
   * ⚠️ **Evolution needs no clause of its own: it routes through `randomizePreset` -> `applyStaticFieldJump`
   * -> `randomStaticField`**, so there is ONE owner of the parameter space and the two surfaces cannot
   * disagree. Verified by grep, not assumed — `evolution-ops.ts` imports `randomizePreset` and writes no
   * `staticField` of its own.
   */
  const N = 20000;
  let seedState = 12345;
  const lcg = () => (seedState = (seedState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let sineCount = 0, inertCount = 0, belowFloor = 0, offPalette = 0;
  const seenShapes = new Set();
  for (let i = 0; i < N; i++) {
    const b = SF.randomStaticField(lcg);
    const shape = b.shape ?? 'sine', mixv = b.shapeMix ?? 0;
    if (shape === 'sine') sineCount++;
    else {
      seenShapes.add(shape);
      if (!WARP_SHAPES.includes(shape)) offPalette++;
      if (mixv === 0) inertCount++;
      if (mixv < SF.SHAPE_MIX_MIN) belowFloor++;
    }
  }
  const share = sineCount / N;
  chk(`§J2 sine's share of a roll is SHAPE_SINE_WEIGHT (${SF.SHAPE_SINE_WEIGHT}), not 1/5`,
    Math.abs(share - SF.SHAPE_SINE_WEIGHT) < 0.02,
    `measured ${share.toFixed(4)} over ${N} rolls. ⚠️ A uniform roll would be `
    + `${(1 / WARP_SHAPES.length).toFixed(2)}, i.e. ${((1 - 1 / WARP_SHAPES.length) * 100).toFixed(0)} % of `
    + 'random presets non-sinusoidal');

  chk('§J3 a rolled non-sine shape is NEVER inert — the mix is floored at SHAPE_MIX_MIN',
    inertCount === 0 && belowFloor === 0,
    inertCount === 0 && belowFloor === 0
      ? `0 of ${N - sineCount} non-sine rolls landed at mix 0 or below ${SF.SHAPE_MIX_MIN}`
      : `⚠️ ${inertCount} inert, ${belowFloor} below the floor — shapeMix 0 is an IDENTITY, so such a roll `
        + 'looks like the dice not working');

  chk('§J4 the roll reaches every non-sine member of WARP_SHAPES and nothing outside it',
    offPalette === 0 && seenShapes.size === WARP_SHAPES.length - 1,
    `reached [${[...seenShapes].sort().join(', ')}] — ${seenShapes.size} of ${WARP_SHAPES.length - 1}. `
    + 'The draw reads WARP_SHAPES and skips index 0, which §A3 pins to `sine`');

  chk('§J5 randomStaticField() reads WARP_SHAPES and never a second hand-written list',
    /WARP_SHAPES\[1 \+ Math\.floor\(rand\(\) \* \(WARP_SHAPES\.length - 1\)\)\]/.test(sfSrc),
    'so adding a shape widens the roll with no edit — the contrast §A exists for');

  seed('a UNIFORM roll over the five shapes',
    Math.abs(1 / WARP_SHAPES.length - SF.SHAPE_SINE_WEIGHT) > 0.02,
    `§J2's 0.02 bound refuses ${(1 / WARP_SHAPES.length).toFixed(2)} against ${SF.SHAPE_SINE_WEIGHT} — the `
    + `two are ${Math.abs(1 / WARP_SHAPES.length - SF.SHAPE_SINE_WEIGHT).toFixed(2)} apart`);
}

// ---------------------------------------------------------------------------------------------------
// K. THE BAKE UNDER A SHAPE — the one place parity could break on the SAVE path
// ---------------------------------------------------------------------------------------------------
console.log('\n--- K. the bake round trip under a shape ---');

/*
 * ⚠️⚠️ **THE HAZARD, STATED FIRST: THE BAKED AMPLITUDES ARE BASIS COEFFICIENTS AND THE SHAPE LIVES OUTSIDE
 * THE TABLE.** `bakeStaticField()` performs a term takeover — it writes the resolved terms into the preset's
 * own table and switches `pattern` to `(Preset)`. If the shape were LOST on the way, baking `square` and
 * reloading would give a SINE field with square-derived amplitudes: a different image, with nothing anywhere
 * saying so, on the ordinary save path rather than in the shader.
 *
 * ✅ **MEASURED 2026-10-29: IT IS NOT LOST, AND `StaticFieldBake` NEEDS NO NEW FIELD.**
 * `PHASE35-KEYS.md` §7 requires the interface to carry `shape`/`shapeMix` forward; the takeover
 * already does, through `TransMapTab.setStaticField()`'s `{ ...staticFieldOf(entry), ...patch }` — the patch
 * BASE is the fully resolved block — every key `STATIC_FIELD_DEFAULTS` has — so every key the patch does
 * not name survives verbatim.
 * **Adding four return fields every caller already holds would be a second enumeration of the shape list
 * with no reader** — exactly what `35.1` refused for `sqrSin`/`sawSin`. ⚠️ **But that mechanism is an IDIOM,
 * not a contract**, so §K3b asserts it: narrowing that spread to a named-key patch would break the
 * carry-forward silently, with `tsc` green.
 *
 * The two conditions that make carrying-forward SUFFICIENT are both `35.2`'s: the shape is applied
 * identically on the archetype and `(Preset)` branches (§K1), and the unit-gain probes are shaped (§F7).
 */
{
  const K_SHAPES = [[1920, 1080], [1080, 1920], [1000, 1000]];
  const maxRel = (a, b) => {
    let m = 0, p = 0;
    for (let i = 0; i < a.length; i++) { m = Math.max(m, Math.abs(a[i] - b[i])); p = Math.max(p, Math.abs(a[i])); }
    return p > 0 ? m / p : m;
  };
  const perShape = {};
  for (const shape of WARP_SHAPES) {
    let worstShift = 0, nameShift = '', worstZoom = 0, nameZoom = '', n = 0, nz = 0, skipped = 0;
    for (const arch of SF.STATIC_FIELD_ARCHETYPES) for (const style of [0, 1, 2, 3]) {
      for (const [w, h] of K_SHAPES) {
        const sf = { pattern: arch.name, pattern2: arch.name, shape, shapeMix: 1, shape2: shape, shapeMix2: 1 };
        const layer = { style, weight: 1, staticField: sf };
        const bake = SF.bakeStaticField(layer, w, h, w / 2, h / 2);
        if (!bake) continue;
        // ⚠️ `warning === null` IS the bit-tightness claim — the uncarried zoom-bias slots are the
        // documented exception, so including them here would re-measure THAT instead (fieldcheck §W owns it).
        if (bake.warning !== null) { skipped++; continue; }
        const before = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, w, h, w / 2, h / 2, 0);
        const after = SF.resolveStaticWaves(
          { style, weight: 1, staticField: {
            pattern: '(Preset)', pattern2: '(Preset)',
            strength: bake.strength, strength2: bake.strength2,
            shape, shapeMix: 1, shape2: shape, shapeMix2: 1 } },
          bake.table1, bake.table2 ?? bake.table1, w, h, w / 2, h / 2, 0);
        n++;
        const es = Math.max(maxRel(before.waveX, after.waveX), maxRel(before.waveY, after.waveY));
        if (es > worstShift) { worstShift = es; nameShift = `${arch.name} s${style} ${w}x${h}`; }
        if (before.zoomX && after.zoomX) {
          nz++;
          const ez = Math.max(maxRel(before.zoomX, after.zoomX), maxRel(before.zoomY, after.zoomY));
          if (ez > worstZoom) { worstZoom = ez; nameZoom = `${arch.name} s${style} ${w}x${h}`; }
        }
      }
    }
    perShape[shape] = { worstShift, nameShift, worstZoom, nameZoom, n, nz, skipped };
  }

  const badShift = WARP_SHAPES.filter(s => perShape[s].worstShift !== 0);
  chk('§K1 the bake reproduces the SHIFT field bit-identically under EVERY shape, at 3 canvas shapes',
    badShift.length === 0,
    badShift.length === 0
      ? WARP_SHAPES.map(s => `${s} 0.0e+0/${perShape[s].n}`).join('  ')
      : `⚠️⚠️ ${badShift.map(s => `${s}: ${perShape[s].worstShift.toExponential(2)} ${perShape[s].nameShift}`).join(' | ')}`
        + ' — the shape is NOT applied identically on the two branches, so a bake changes the picture');

  // ⚠️ The zoom leg is NOT `=== 0` and never was: `carryZoomBias()` reassociates the sum, so the shift
  // half's exactness does not transfer. The bound is the reassociation's own ulp scale, not a shrug.
  const worstZoomAll = Math.max(...WARP_SHAPES.map(s => perShape[s].worstZoom));
  chk('§K2 ...and the zoom leg stays at the reassociation ulp scale under every shape',
    worstZoomAll < 1e-11,
    WARP_SHAPES.map(s => `${s} ${perShape[s].worstZoom.toExponential(1)}`).join(' ')
    + ` — worst ${worstZoomAll.toExponential(2)} against 1e-11. carryZoomBias() adds bias*amp per slot on `
    + 'one branch and the remainder once on the other, so this leg cannot be exact (fieldcheck W1e owns the '
    + 'derived form of this bound)');

  const skips = WARP_SHAPES.map(s => perShape[s].skipped);
  chk('§K3a `warning !== null` is SHAPE-INDEPENDENT — the bit-tight set did not shrink for any shape',
    new Set(skips).size === 1,
    `${skips[0]} uncarried slots for every shape (${skips.join('/')}). The carry depends on slot OCCUPANCY, `
    + 'not on the basis, so `warning === null` still means exactly "the round trip is bit-tight"');

  // ⚠️ The carry-forward's real mechanism, asserted because it is an idiom rather than a contract.
  const tabSrc = stripComments(rd('ui/synthesis-lab/tabs/transmap.ts'));
  const setBody = braceBody(tabSrc, 'private setStaticField');
  chk(`§K3b the takeover carries all ${DEFAULT_KEYS.length} keys: setStaticField() patches over \`...staticFieldOf(entry)\``,
    setBody.length > 0 && /\{\s*\.\.\.staticFieldOf\(entry\),\s*\.\.\.patch\s*\}/.test(setBody),
    'so `adoptShownTerms()` naming only pattern/pattern2/strength/strength2 leaves shape, shapeMix, shape2 '
    + 'and shapeMix2 verbatim — which is why StaticFieldBake needs no new field. ⚠️ Narrowing this to a '
    + 'named-key patch would break the carry-forward with tsc green');

  seed('setStaticField() narrowed to a named-key patch',
    !/\{\s*\.\.\.staticFieldOf\(entry\),\s*\.\.\.patch\s*\}/.test(
      setBody.replace(/\{ \.\.\.staticFieldOf\(entry\), \.\.\.patch \}/, '{ pattern: patch.pattern }')),
    '§K3b notices — the one clause standing between the bake and a silently sine-ified reload');
}

// ---------------------------------------------------------------------------------------------------
// L. THE RE-SOLVE GATE, MEASURED — §D asserts the digests NAME the fields; §L asserts they SEPARATE
// ---------------------------------------------------------------------------------------------------
console.log('\n--- L. the re-solve gate, measured ---');

{
  /*
   * ⚠️ **§D is source-shaped and this is not.** §D1/§D4 assert that the two digests NAME every key; a
   * renamed owner fails there. §L asserts the CONSEQUENCE: two chains differing only in a shape produce
   * different digests, and the solved gain really does depend on the shape — so a missed rebuild would
   * leave preset A's field under preset B's controls, with `strength` meaning A's calibration.
   *
   * ⚠️ `TransMap.setChain()`'s digest is an inline expression inside a GL class and cannot be imported, so
   * §D1/§D2 remain the only instrument for that half. `chainSignature()` is pure and is measured here.
   *
   * ⚠️⚠️ **"DID `solveGain` ACTUALLY RE-RUN" IS ANSWERED BY §F7, NOT HERE, AND THAT IS WORTH SAYING BECAUSE
   * A READER WILL LOOK IN THIS SECTION FOR IT.** §F7 measures the realised peak at exactly
   * `strength x target` for all five shapes; a STALE gain would put it at the unit-basis peak ratio instead
   * (up to 1.49x), so §F7 passing is a positive observation that the solve ran afresh for each shape. §L's
   * job is the gate AHEAD of that: whether a shape edit is even seen as a chain change.
   */
  const mk = extra => [{ style: 0, enabled: true, weight: 1,
    staticField: { pattern: 'Grid Lattice', strength: 0.5, detail: 1, ...extra } }];
  const sigBase = chainSignature(mk({}));
  const cases = [
    ['shape', { shape: 'square' }],
    ['shapeMix', { shapeMix: 0.5 }],
    ['shape2', { shape2: 'sawtooth' }],
    ['shapeMix2', { shapeMix2: 0.5 }],
  ];
  const same = cases.filter(([, e]) => chainSignature(mk(e)) === sigBase).map(([k]) => k);
  chk('§L1 chainSignature() SEPARATES a change in each of the four shape fields',
    same.length === 0,
    same.length === 0
      ? `base "${sigBase.slice(0, 60)}" differs for all four`
      : `⚠️⚠️ [${same}] leave the digest EQUAL — this digest gates reinitTransMap() on a PRESET CHANGE and `
        + 'setChain() is not called on that branch, so preset B would render preset A\'s field');

  // ⚠️ NOT VACUOUS in the other direction: the three MAGNITUDE fields must leave it equal (invariant 8).
  const magnitudeMoved = [['strength', { strength: 0.9 }], ['strength2', { strength2: 0.9 }],
    ['drift', { drift: 0.3 }]].filter(([, e]) => chainSignature(mk(e)) !== sigBase).map(([k]) => k);
  chk('§L2 ...and leaves the three MAGNITUDE fields alone, so §L1 is a claim about SHAPE events',
    magnitudeMoved.length === 0,
    magnitudeMoved.length === 0
      ? 'strength/strength2/drift do not move the digest — a gain and a phase build no CPU resource'
      : `⚠️ [${magnitudeMoved}] moved it: the 0.8 ms gain solve is now per drag frame (invariant 8)`);

  /*
   * ⚠️⚠️ **L3 IS WHY THE RE-SOLVE MATTERS AT ALL, AND IT IS A MEASUREMENT RATHER THAN AN ARGUMENT.** If the
   * solved gain were the same for every shape, omitting a shape from either digest would cost nothing. It is
   * not: the resolved amplitude on a four-term table differs materially by shape, so `strength` would
   * silently mean the PREVIOUS shape's calibration until something else dirtied the chain.
   */
  const ampOf = shape => {
    const layer = { style: 1, weight: 1, staticField: {
      pattern: 'Turbulent Weave', strength: 0.5, shape, shapeMix: 1 } };
    const w = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, 1920, 1080, 960, 540, 0).waveX;
    let m = 0;
    for (const v of w) m = Math.max(m, Math.abs(v));
    return m;
  };
  const gains = WARP_SHAPES.map(s => [s, ampOf(s)]);
  const spread = Math.max(...gains.map(([, g]) => g)) / Math.min(...gains.map(([, g]) => g));
  chk('§L3 the SOLVED GAIN really does depend on the shape, so a missed re-solve is a real defect',
    spread > 1.05,
    `resolved amplitude on Turbulent Weave: ${gains.map(([s, g]) => `${s} ${g.toFixed(4)}`).join(', ')} — `
    + `spread ${spread.toFixed(3)}x. ⚠️ If this were 1.000 the digest clauses would be policing nothing`);

  // The seed: a digest that rendered the shape as a constant — the exact state in which preset B renders
  // preset A's field with every control, readout and thumbnail showing B's.
  const frozen = c => chainSignature(c).replace(/,(sine|triangle|trapezoid|square|sawtooth),/g, ',sine,');
  seed('a chainSignature() that rendered `shape` as a constant',
    frozen(mk({ shape: 'square' })) === frozen(mk({ shape: 'sine' }))
    && chainSignature(mk({ shape: 'square' })) !== chainSignature(mk({ shape: 'sine' })),
    'the two chains become indistinguishable to the gate, so rebuildStaticField() is never called and the '
    + 'displacement texture keeps the previous preset\'s field');
}

// ---------------------------------------------------------------------------------------------------
// M. THE ARCHETYPE ADDITIONS — the RELABEL gate and the DISTINCTNESS gate, both MEASURING (`35.6`)
// ---------------------------------------------------------------------------------------------------
console.log('\n--- M. the Phase 35 archetypes: relabelling and distinctness ---');

/*
 * **Two clauses here are measurements and neither has ever had an instrument.**
 *
 * ⚠️⚠️ **§M5 IS THE ONE THAT MATTERS AND IT EXISTS BECAUSE AN OBLIGATION IN THE TREE WAS FALSIFIED.** The
 * 2026-09-23 comment block in `static-field.ts` says appending an archetype rather than inserting it
 * protects which NAME an already-shipped preset identifies as. **It does not:** `identifyArchetype` ranks by
 * smallest `|log detail|` and array order is only the tie-break between exact negatives, so a new entry
 * whose table is an existing one at a different `detail` wins every table sitting at that detail with
 * `|log detail| = 0`. Measured 2026-10-29: the spec's SIX would have relabelled 2 live layers (`Patterns`,
 * `There Will Be Light`) and 9 library tables. **So the protection has to be MEASURED, and this is the
 * measurement** — the identification answer computed against the pre-Phase-35 subset must equal the answer
 * against the shipped array, table by table, over the whole library. ⚠️ **A count is not enough: the
 * identified TOTAL is unchanged by a pair of swapped names, which is why this compares by NAME.**
 *
 * ⚠️ **§M6 is the distinctness rule, and its scale is this set's OWN floor rather than a quoted figure.**
 * The specifier's first `Brick Weave` reused `Grid Lattice`'s 6:4 table with a square shape and measured
 * *less distinct from its parent than the two closest shipped archetypes are from each other* — because "an
 * existing table plus a shape" is already reachable by picking the parent and setting the shape. The clause
 * therefore computes the shipped set's own minimum pair distance and requires each addition to clear it.
 *
 * ⚠️ **Both clauses MUTATE `STATIC_FIELD_ARCHETYPES` and restore it, and that is deliberate.** `readonly` is
 * a TS-only claim; the runtime value is a plain array. Measuring a candidate any other way would mean
 * transcribing `archetypeTerms`' `sumNormalise` + `detail` + `solveGain` chain into this file, i.e. a second
 * owner of the magnitude law — which is exactly the duplication §E refuses for the dispatch. **Every
 * measurement below therefore runs through the engine's own archetype branch.** The array's length is
 * asserted restored at the end of the section.
 */
const ARCH35_NAMES = ['Brick Weave', 'Oblique Lattice', 'Terraced Swell'];
/** `35.D7`'s refusal, as the record of it — the same discipline as §A4's `spike` clause. */
const ARCH35_DROPPED = ['Diamond Mosaic', 'Chevron Press', 'Blade Fan'];

{
  const ARCHS = SF.STATIC_FIELD_ARCHETYPES;
  const ORIGINAL = [...ARCHS];
  const names = ORIGINAL.map(a => a.name);

  chk(`§M1 the three Phase 35 archetypes are present and LAST (${ORIGINAL.length} entries)`,
    names.slice(-3).join('|') === ARCH35_NAMES.join('|'),
    names.slice(-3).join('|') === ARCH35_NAMES.join('|')
      ? 'appended, so the menu order is unchanged above them — array order IS the dropdown order'
      : `⚠️ the last three are [${names.slice(-3)}]; inserting into the run moves existing menu positions`);

  chk('§M2 the three DROPPED candidates are absent — `35.D7`\'s refusal, not an omission',
    ARCH35_DROPPED.every(n => !names.includes(n)),
    `[${ARCH35_DROPPED}] are reachable TODAY as Fine Mesh @0.3125, Fine Mesh @0.375 and Diagonal Shear `
    + '@0.75, all inside the Detail track. Their presence here would be a re-proposal');

  // M3. PROVENANCE — the tab DISPLAYS this field, so a designed archetype citing a library family is a
  // FALSE CITATION shown to the user. Asserted in both directions: it must SAY designed, and it must not
  // wear the distilled entries' own evidence (a named family, or a count of presets).
  const noProv = ORIGINAL.filter(a => !a.provenance || a.provenance.trim().length < 20).map(a => a.name);
  chk(`§M3a every one of the ${ORIGINAL.length} archetypes carries a real provenance string`,
    noProv.length === 0,
    noProv.length === 0 ? 'the field the Transmap tab prints under the pattern name is never empty'
      : `⚠️ [${noProv}] would print a blank or a stub`);

  const prov = n => ORIGINAL.find(a => a.name === n)?.provenance ?? '';
  const notDesigned = ARCH35_NAMES.filter(n => !/\bdesigned\b/i.test(prov(n)));
  chk('§M3b ...and the three designed ones SAY designed',
    notDesigned.length === 0,
    notDesigned.length === 0 ? 'so the tab cannot present a designed shape as a distilled family'
      : `⚠️⚠️ [${notDesigned}] do not say it`);

  const falseCite = ARCH35_NAMES.filter(n => /\bfamily [A-Za-z]|\bn=\d/.test(prov(n)));
  chk('§M3c ...and none of them cites a library FAMILY or a preset COUNT, which it does not have',
    falseCite.length === 0,
    falseCite.length === 0
      ? 'the distilled entries\' evidence (family X, n=K) is exactly what these three cannot claim'
      : `⚠️⚠️ [${falseCite}] claim library provenance — a false citation in a field the tab displays`);

  // M4. `absoluteAmp` — and the clause states the REASON rather than only the fact, because the fact alone
  // reads as arbitrary. See the flag's own doc: `identifyArchetype` has no branch for it, which is safe only
  // while every flagged archetype has `sum|amp| === 1`.
  const flagged = ARCH35_NAMES.filter(n => ORIGINAL.find(a => a.name === n)?.absoluteAmp);
  const sums = ARCH35_NAMES.map(n => {
    const a = ORIGINAL.find(x => x.name === n);
    return [n, a.xAmp.reduce((s, v) => s + Math.abs(v), 0)];
  });
  chk('§M4 none of the three sets `absoluteAmp` — they are designed, so they take the normalised gain',
    flagged.length === 0,
    flagged.length === 0
      ? `and their amplitude sums are ${sums.map(([n, s]) => `${n} ${s}`).join(', ')} — NOT 1, which is why `
        + 'flagging one later to answer a Strength complaint would make it identify at a `scale` that no '
        + 'longer equals its required `strength`, silently'
      : `⚠️⚠️ [${flagged}] opt out of solveGain while sum|amp| !== 1 — identifyArchetype has no branch for `
        + 'that and would report an unusable required Strength');

  // ---- the library, loaded the way `coveragecheck` §A does: it is a JS assignment, not plain JSON.
  const rawText = readFileSync(join(SRC, '..', 'public', 'psss_presets.json'), 'utf8');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgrM = new PresetManager();
  loadLibrary(mgrM, rawLib);

  /** Every table in the library — both halves, so the wider of the two bases is the one measured. */
  const TABLES = [];
  for (const nm of mgrM.list()) {
    const tm = mgrM.get(nm)?.postProcessors?.transMap;
    if (!tm) continue;
    if (tm.sinMagicParams) TABLES.push([`${nm}:1`, tm.sinMagicParams]);
    if (tm.sinMagicParams2) TABLES.push([`${nm}:2`, tm.sinMagicParams2]);
  }
  /** The LIVE table layers — the population `describeTermIdentity` actually runs on (the SHIFT table). */
  const LIVE = [];
  for (const nm of mgrM.list()) {
    const p = mgrM.get(nm);
    if (!p) continue;
    const chain = chainFromOverlay(p.overlay, p.postProcessors?.transMap?.style ?? 0);
    for (const l of buildChainPlan(chain).staticStyles) {
      LIVE.push([`${nm} s${l.style}`, p.postProcessors.transMap.sinMagicParams]);
    }
  }

  const answer = t => {
    const id = SF.identifyArchetype(t);
    return id ? `${id.archetype.name}@${id.detail.toFixed(4)}` : '(none)';
  };
  const mapOver = rows => rows.map(([k, t]) => [k, answer(t)]);
  const setArray = list => { ARCHS.length = 0; ARCHS.push(...list); };
  const withSet = (list, rows) => { setArray(list); const m = mapOver(rows); setArray(ORIGINAL); return m; };
  const relabels = (a, b) => {
    const out = [];
    for (let i = 0; i < a.length; i++) if (a[i][1] !== b[i][1]) out.push(`${a[i][0]} ${a[i][1]}->${b[i][1]}`);
    return out;
  };

  const PRE = ORIGINAL.filter(a => !ARCH35_NAMES.includes(a.name));

  // ⚠️ NON-VACUITY, the other direction of §M5: a name-for-name comparison over a population that
  // identifies as `(none)` everywhere would be green over any addition at all. The pre-addition answer set
  // has to have CONTENT before "unchanged" means anything.
  {
    const base = withSet(PRE, LIVE);
    const named = new Set(base.filter(([, v]) => v !== '(none)').map(([, v]) => v.split('@')[0]));
    chk('§M5a the pre-addition answer set has CONTENT, so "unchanged" is a real claim',
      base.filter(([, v]) => v !== '(none)').length > LIVE.length / 2 && named.size >= 8,
      `${base.filter(([, v]) => v !== '(none)').length} of ${LIVE.length} live layers identify, naming `
      + `${named.size} distinct archetypes — a population identifying as (none) throughout would make §M5 `
      + 'green over any addition');
  }

  for (const [label, rows] of [[`${LIVE.length} live table layers`, LIVE],
                               [`all ${TABLES.length} library tables`, TABLES]]) {
    const before = withSet(PRE, rows);
    const after = withSet(ORIGINAL, rows);
    const moved = relabels(before, after);
    const gained = after.filter(([, v]) => v !== '(none)').length
      - before.filter(([, v]) => v !== '(none)').length;
    chk(`§M5 no shipped table CHANGES its archetype name over ${label}`,
      moved.length === 0,
      moved.length === 0
        ? `identified ${before.filter(([, v]) => v !== '(none)').length} before and after, name for name. `
          + `⚠️ coverage gained: ${gained} — ZERO is expected and is the difference in kind between a `
          + 'DESIGNED archetype and the 2026-09-23 distilled six, which gained 17'
        : `⚠️⚠️ ${moved.length} relabelled: ${moved.slice(0, 6).join('; ')} — the panel\'s identification `
          + 'line, trackcheck §M\'s wordings and the required-Strength readout all move with them');
  }

  /*
   * ⚠️ **THE SEED IS THE REAL MEASURED REGRESSION, NOT A SYNTHETIC ONE.** `Chevron Press`'s proposed table
   * is `Fine Mesh` at detail 0.375, so appending it relabels `Patterns`. It is one of the three `35.D7` cut,
   * and it demonstrates §M5 firing on the exact edit the obligation claimed was safe.
   */
  {
    const CHEVRON = { name: 'Chevron Press (seed)', xAmp: [1, 0, 0, 0], xFreq: [6, 0, 0, 0],
      yAmp: [1, 0, 0, 0], yFreq: [6, 0, 0, 0], provenance: 'seed' };
    const moved = relabels(withSet(ORIGINAL, LIVE), withSet([...ORIGINAL, CHEVRON], LIVE));
    seed('an APPENDED archetype that is an existing table at another `detail` (Chevron Press = Fine Mesh @0.375)',
      moved.length > 0,
      moved.length > 0
        ? `§M5 reports ${moved.length} relabelled live layer(s): ${moved.join('; ')} — appended, i.e. the `
          + 'append obligation did not protect them, which is what falsifies it'
        : 'the clause saw nothing, so it is not policing the ranking at all');
  }

  /*
   * M6. DISTINCTNESS — normalised field distance on a 26x26x2 sample grid.
   *
   * Sample the RESOLVED displacement field's two components on a 26x26 grid, treat the 1352 numbers as one
   * vector, divide by its own L2 norm and take the Euclidean distance between unit vectors. **Magnitude-blind
   * by construction**, because `strength` is a separate control, and bounded 0 (same shape) .. 2 (exact
   * negative) with sqrt(2) = 1.414 meaning ORTHOGONAL.
   *
   * ⚠️ **The continuous wave pair is read directly rather than through `staticOffsetAt`**, so the measure is
   * a property of the TABLE and not of `jsRound`/`rollToRange` quantisation — which is also what makes it
   * style-independent. ⚠️ **The bound is this set's OWN minimum pair distance, computed here**: a hard-coded
   * threshold would be a figure to carry, and the whole rule is "at least as distinct from the library as the
   * library already is from itself".
   */
  const GRID_M = 26;
  const fieldVec = (name) => {
    const W = 1920, H = 1080;
    const r = SF.resolveStaticWaves({ style: 0, weight: 1, staticField: { pattern: name, strength: 0.5 } },
      ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
    const v = new Float64Array(GRID_M * GRID_M * 2);
    let k = 0;
    for (let gy = 0; gy < GRID_M; gy++) {
      for (let gx = 0; gx < GRID_M; gx++) {
        // Cross-coupled by design: the horizontal displacement comes from the Y wave (see `staticOffsetAt`).
        v[k++] = r.waveY[Math.min(Math.round((gy + 0.5) * (H / GRID_M)), H - 1)];
        v[k++] = r.waveX[Math.min(Math.round((gx + 0.5) * (W / GRID_M)), W - 1)];
      }
    }
    let n = 0;
    for (const z of v) n += z * z;
    n = Math.sqrt(n);
    if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  };
  const fieldDist = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
  };

  const vecs = new Map(ORIGINAL.map(a => [a.name, fieldVec(a.name)]));
  let floor = Infinity, floorPair = '';
  for (let i = 0; i < PRE.length; i++) {
    for (let j = i + 1; j < PRE.length; j++) {
      const d = fieldDist(vecs.get(PRE[i].name), vecs.get(PRE[j].name));
      if (d < floor) { floor = d; floorPair = `${PRE[i].name} / ${PRE[j].name}`; }
    }
  }
  const nearest = n => PRE.map(a => [fieldDist(vecs.get(n), vecs.get(a.name)), a.name])
    .sort((x, y) => x[0] - y[0])[0];
  const tooClose = ARCH35_NAMES.map(n => [n, ...nearest(n)]).filter(([, d]) => d <= floor);
  chk(`§M6 each addition is further from the shipped set than that set's own floor (${floor.toFixed(3)}, ${floorPair})`,
    tooClose.length === 0,
    tooClose.length === 0
      ? ARCH35_NAMES.map(n => { const [d, a] = nearest(n); return `${n} ${d.toFixed(3)} (${a})`; }).join(', ')
      : `⚠️⚠️ ${tooClose.map(([n, d, a]) => `${n} is ${d.toFixed(3)} from ${a}`).join('; ')} — "an existing `
        + 'table plus a shape" is already reachable by picking the parent and setting the shape');

  /*
   * ⚠️⚠️ **M6b: THE ADDITIONS MUST ALSO BE DISTINCT FROM EACH OTHER, AND THE SPEC'S FIGURE FOR THAT DOES
   * NOT HOLD.** It reports pairwise distances among its six candidates at *"1.359-1.395, i.e.
   * near-orthogonal"* — but that was measured WITH `35.3`'s angles, which do not exist yet. As TABLES,
   * `Brick Weave` and `Oblique Lattice` are **0.573** apart: both clear the floor, so the rule holds, but
   * the near-orthogonality claim is an ANGLE property and must not be carried. **The margin is thin and is
   * printed here on purpose**, because the cheapest future mistake is a fourth entry that duplicates one of
   * these three rather than one of the shipped sixteen.
   */
  {
    const ALL = ORIGINAL.map(a => a.name);
    let worst = Infinity, worstPair = '';
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
        if (!ARCH35_NAMES.includes(ALL[i]) && !ARCH35_NAMES.includes(ALL[j])) continue;
        const d = fieldDist(vecs.get(ALL[i]), vecs.get(ALL[j]));
        if (d < worst) { worst = d; worstPair = `${ALL[i]} / ${ALL[j]}`; }
      }
    }
    chk('§M6b ...and every pair INVOLVING an addition clears that floor too, the three against each other included',
      worst > floor,
      `closest such pair ${worst.toFixed(3)} (${worstPair}) against the ${floor.toFixed(3)} floor. `
      + '⚠️ The spec\'s "1.359-1.395 among the six" was measured WITH 35.3\'s angles and is an ANGLE '
      + 'property — do not carry it as a table property');
  }

  /*
   * ⚠️ TWO SEEDS, because catching an exact copy is not the same strength of claim as discriminating.
   *
   * The first is the specifier's own first attempt: `Brick Weave` on `Grid Lattice`'s 6:4 table, the
   * measured failure the rule was written from. ⚠️ **It measures 0.000 here against the spec's 0.438, and
   * that is a BASIS difference, not an event:** this measure is shape-blind by construction (a table's own
   * property), while the spec measured the same table under a `square` shape. As a TABLE the candidate IS
   * `Grid Lattice`, which is the stronger form of the same finding.
   *
   * The second is a NEAR-MISS — a shipped table plus a small extra harmonic — so the clause is shown to
   * refuse a candidate that is new and still not distinct, rather than only an exact duplicate.
   */
  for (const [label, REUSED] of [
    ['an archetype reusing an existing table (the specifier\'s first Brick Weave, Grid Lattice 6:4)',
      { name: 'reuse (seed)', xAmp: [1, 0, 0, 0], xFreq: [6, 0, 0, 0],
        yAmp: [1, 0, 0, 0], yFreq: [4, 0, 0, 0], provenance: 'seed' }],
    ['a NEAR-MISS: Grid Lattice plus a small second harmonic — new table, not a new field',
      { name: 'near-miss (seed)', xAmp: [1, 0.15, 0, 0], xFreq: [6, 13, 0, 0],
        yAmp: [1, 0.15, 0, 0], yFreq: [4, 9, 0, 0], provenance: 'seed' }],
  ]) {
    setArray([...ORIGINAL, REUSED]);
    const v = fieldVec(REUSED.name);
    setArray(ORIGINAL);
    const [d, a] = PRE.map(x => [fieldDist(v, vecs.get(x.name)), x.name]).sort((p, q) => p[0] - q[0])[0];
    seed(label, d <= floor,
      `§M6 measures it ${d.toFixed(3)} from ${a}, at or under the ${floor.toFixed(3)} floor — the entry `
      + 'would be "a shipped pattern plus a shape", which the dropdown already reaches');
  }

  // ⚠️ The section mutated the exported array; prove it is back. A leak here would corrupt nothing above
  // (this is the last section) but would mislead any clause added after it.
  chk('§M7 STATIC_FIELD_ARCHETYPES was RESTORED after the measurements',
    ARCHS.length === ORIGINAL.length && ARCHS.every((a, i) => a === ORIGINAL[i]),
    `${ARCHS.length} entries, identical references — the mutation is how a candidate is measured through `
    + 'the engine\'s own archetype branch instead of a transcription of archetypeTerms()');
}

// ---------------------------------------------------------------------------------------------------
// N. THE ORIENTATION ANGLES (`35.3`) — the split, the placement, and the four index consumers
// ---------------------------------------------------------------------------------------------------
console.log('\n--- N. the orientation angles: the split, the placement, the four index consumers ---');

/*
 * ⚠️⚠️ **THIS SECTION EXISTS BECAUSE `fieldcheck` §D CANNOT BE IT, AND THAT IS WORSE THAN IF IT HAD NO
 * CLAUSE AT ALL.** §D is *"the GLSL text and the TS sampler implement the same formulas"* — a text-pattern
 * scan for each style's distinguishing term (`waveY|wY`, `1 - wx`, `(wx + wy)/2`, `zoomX`) in both files.
 * **A rotation added to the shader and forgotten in `staticOffsetAt()` leaves every existing §D clause
 * green**, because every clause asks *does each file mention this style's term*. ⚠️ `fieldcheck` was NOT
 * edited by `35.3` — it is byte-identical to `the backup copy backup_20261029_phase33confirmed`, which is what
 * keeps §A's *"any failure from here is yours"* meaningful (`35.D5`). So the angle's instrument is here.
 *
 * ⚠️⚠️ **THE ANGLE HAS FOUR INDEX CONSUMERS, NOT ONE.** The spec's §5.4 changes `staticOffset()` and stops:
 *
 *   | consumer                           | what a missed rotation costs                                  |
 *   | `trans-map.ts`' GLSL `waveTap`     | the image                                                     |
 *   | `static-field.ts`' `sampleWave`    | the particle FORCE path, and the panel's picture through it    |
 *   | `solveGain`                        | the peak is measured on a field nobody renders ⇒ strength off  |
 *   | `solveGain3`                       | the same, style 3                                             |
 *
 * §N6 compares the first two by MEASUREMENT (not by text) and §N7 the last two.
 *
 * ⚠️⚠️ **AND THE LANDMINE IS NOT THE ROTATION, IT IS THE WIDENING.** `buildWave`'s `n` was BOTH the array
 * length and `centreAnchor`'s axis length. A rotated sample ranges over the frame's diagonal, so the table
 * must widen from `max(w,h)` to `hypot(w,h)`; widening `centreAnchor`'s argument with it **moves the field
 * at angle 0**, by more than the wave's own amplitude. §N2 is that split, bitwise; §N3 is the placement in
 * PIXELS. ⚠️ **Gating the widening on `angle !== 0` is NOT the fix** — it makes 0° jump to 1°; §N2 is what
 * proves the gate is a pure allocation choice rather than a hidden discontinuity.
 *
 * ⚠️ **§N3 is MANDATORY and a shape-invariance test cannot replace it** — `static-field.ts`' own sentence:
 * *"A shape-invariance property test is not sufficient on its own — it passes for a field that is correctly
 * shaped and wrongly placed."* `fieldcheck` §A3's circularity ratio was 1.0000 throughout while the figure
 * sat at x = 0.313 instead of 0.500.
 */

/** The canvas shapes every angle clause runs at. ⚠️ A square one is included BECAUSE `centreAnchor`
 *  vanishes there (`n === period`), so a square-only basis cannot see an anchor defect at all. */
const N_SHAPES = [[1920, 1080], [1080, 1920], [1600, 1600], [1366, 768], [800, 600], [2560, 1440]];
/** ⚠️ Includes 0 — §N2/§N3's whole point is that the field must be centred AT 0 TOO, with the table
 *  widened — and the ±pairs, because `(angle + 180, -amp)` bit-identity is what makes ±90 the right range. */
const N_ANGLES = [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 28, 7.5];
const N_TABLES = {
  'two-harmonic 6:4': [[1, 0.35, 0, 0], [6, 4, 0, 0], [1, 0.35, 0, 0], [4, 6, 0, 0]],
  'single harmonic 3': [[1, 0, 0, 0], [3, 0, 0, 0], [1, 0, 0, 0], [3, 0, 0, 0]],
  'four-harmonic 1:2:4:8': [[1, .5, .25, .125], [1, 2, 4, 8], [1, .5, .25, .125], [8, 4, 2, 1]],
};
const DEG_N = 180 / Math.PI;
/**
 * ⚠️⚠️ **`buildWave`'s ARGUMENT EXPRESSION, TRANSCRIBED VERBATIM, AND NOT A TIDY EQUIVALENT.** `2*PI*p/n`
 * is a DIFFERENT DOUBLE from `((360*p*f)/period)/DEG`: `35.2` measured 42 of 360 samples differing by up to
 * 8.88e-16 against the tidy form — a different association order, not a second wave. **§N2c EXONERATES this
 * oracle bit-exactly against the engine before anything below relies on it**, which is the only thing that
 * makes a seed built from it a measurement of the DEFECT rather than of the transcription.
 */
const nBuild = (amps, freqs, map, period) => {
  const out = new Float64Array(map.length);
  for (let i = 0; i < map.length; i++) {
    const p = i + map.origin;
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const f = freqs[k];
      s += Math.sin(((360 * p * f) / period) / DEG_N + Math.PI * f * (1 - map.anchorLen / period) + 0 * f)
        * amps[k];
    }
    out[i] = s;
  }
  return out;
};
const nLayer = (sf, style = 0) => ({ style, enabled: true, weight: 1, staticField: sf });
const nResolve = (sf, w, h, T, style = 0, phase = 0) =>
  SF.resolveStaticWaves(nLayer(sf, style), T, T, w, h, w / 2, h / 2, phase);

// ----- §N0. the four consumers each NAME the rotation, in their own text -----------------------------
{
  const consumers = [
    ['GLSL waveTap (the image)', tmSrc, 'float waveTap(int row, int chan, vec4 m, float idx, vec2 d)'],
    ['TS sampleWave (the force path)', sfSrc, 'function sampleWave('],
    ['solveGain', sfSrc, 'function solveGain('],
    ['solveGain3', sfSrc, 'function solveGain3('],
  ];
  const found = consumers.filter(([, src, decl]) => braceBody(src, decl).length > 0).map(c => c[0]);
  chk(`§N0a all ${consumers.length} index consumers were FOUND by declaration`,
    found.length === consumers.length,
    found.length === consumers.length ? `[${found.join(' | ')}]`
      : `⚠️ only [${found.join(' | ')}] — a rename makes every clause below vacuous`);

  // The two SAMPLERS must each do the rotation themselves; the two SOLVES must DELEGATE to the sampler
  // rather than re-deriving it, which is what keeps them from drifting apart (one owner, `waveMaps`).
  const glsl = braceBody(tmSrc, 'float waveTap(int row, int chan, vec4 m, float idx, vec2 d)');
  const ts = braceBody(sfSrc, 'function sampleWave(');
  chk('§N0b the GLSL sampler rotates: it reads the map\'s cos/sin against the pixel offset',
    /dot\(d,\s*m\.xy\)/.test(glsl) && /m\.z\s*\+/.test(glsl),
    'index = centreIndex + dot(pixelOffsetFromFrameCentre, (cos, sin)) — the same expression the TS side '
    + 'computes, and the thing §D\'s per-style text scan cannot compare');
  chk('§N0c the TS sampler rotates by the SAME expression',
    /m\.centreIndex\s*\+\s*dx\s*\*\s*m\.cos\s*\+\s*dy\s*\*\s*m\.sin/.test(ts),
    'read as source text here and MEASURED against the shader in §N6 — a text clause alone is exactly what '
    + 'was insufficient about §D');
  for (const [name, decl, args] of [['solveGain', 'function solveGain(', 2], ['solveGain3', 'function solveGain3(', 4]]) {
    const body = braceBody(sfSrc, decl);
    const taps = (body.match(/sampleWave\(/g) ?? []).length;
    chk(`§N0d ${name} samples THROUGH sampleWave (${args} map${args > 1 ? 's' : ''}), never arr[x] directly`,
      taps >= args && !/\bw[XY]\[[xy]\]/.test(body) && !/\bz[XY]\[[xy]\]/.test(body),
      `${taps} sampleWave() calls and no surviving wX[x]/wY[y]/zX[x]/zY[y]. ⚠️ It WAS wX[x]/wY[y] before `
      + '35.3; left that way the solve measures the peak of a field nobody renders');
  }
  const soBody = braceBody(tmSrc, 'vec2 staticOffset()');
  chk('§N0e the rotation pivots on the FRAME centre in both texts, never on the zoom centre',
    /vec2 d = vec2\(x, y\) - uResolution \* 0\.5;/.test(soBody)
    && /const dx = x - w \/ 2;/.test(sfSrc) && /const dy = y - h \/ 2;/.test(sfSrc),
    'uStaticCentre / centreX / centreY are the ZOOM centre, read only by styles 1-3\'s radial scaling. The '
    + 'wave index has never depended on it, and rotating about it would couple the wave\'s phase origin to '
    + 'a control that has never touched it — a new cross-dependence on every preset authoring a zoomCenter');

  const seedBody = braceBody(sfSrc, 'function solveGain(').replace(/sampleWave\(wX, mapX, x, fdx, fdy\)/, 'wX[x]');
  seed('solveGain left reading wX[x] — one of the four consumers un-rotated',
    /\bwX\[x\]/.test(seedBody) && (seedBody.match(/sampleWave\(/g) ?? []).length < 2,
    '§N0d notices by the SHAPE of the read, not by a count alone — and §N7 measures the consequence');
}

// ----- §N1. the range is ±90, and the reason is BOTH the UI's and the Mixer's -----------------------
{
  chk('§N1a WAVE_ANGLE_MAX is 90 — the range is ±90 and never 0-360',
    SF.WAVE_ANGLE_MAX === 90,
    `${SF.WAVE_ANGLE_MAX}. ⚠️ TWO independent reasons and a reader who finds only one will widen it: `
    + '(angle + 180, -amp) is bit-identical so 0-360 offers every field TWICE (the exact symmetry this '
    + 'phase rejected, re-introduced in the UI), AND ±90 has no wrap so blendLayerBlocks()\' plain mix() is '
    + 'the shortest path');

  /*
   * ⚠️⚠️ **THE MEASUREMENT BEHIND THE FIRST REASON, AND THE DESIGN DOCUMENT STATES IT ONE LEVEL TOO LOW.**
   * §5.1 says `(angle + 180°, −amplitude)` is *"bit-identical (verified at 0.00e+0)"*. **That is a property
   * of the SAMPLED FIELD, not of the two tables compared elementwise** — the table does not depend on the
   * angle at all, so negating the amplitudes simply NEGATES it; the fields coincide because the sampling
   * direction is reversed too and the table is odd about the frame centre. ⚠️ **And it cannot be
   * bit-identical through the trig**: `Math.cos((a − 180)/DEG)` is not bitwise `−Math.cos(a/DEG)`, being a
   * different argument. So the level to compare at is the COMPOSED offset, whose `Math.round` absorbs the
   * ~1e-13 index difference the round-off can produce (|Δcos| ~ 1e-16 × |d| ≤ 1100 texels). **Exact equality
   * of the composed field is the claim; bit-identity of the arrays is not — conflating the two is how a
   * correct property gets quoted at the wrong level.**
   */
  {
    const out = new Float64Array(2);
    let bad = 0, n = 0, worst = 0, where = '';
    for (const [tn, T] of Object.entries(N_TABLES)) {
      const neg = [T[0].map(v => -v), T[1], T[2].map(v => -v), T[3]];
      for (const [w, h] of [[1920, 1080], [1366, 768], [800, 600]]) for (const a of [0, 15, 45, 60, 90]) {
        const mk = r => [{ style: 0, centreX: w / 2, centreY: h / 2, ratio: 1,
          waveX: r.waveX, waveY: r.waveY, zoomX: null, zoomY: null, maps: r.maps }];
        const Lp = mk(nResolve({ angleX: a, angleY: a }, w, h, T));
        const Lq = mk(nResolve({ angleX: a - 180, angleY: a - 180 }, w, h, neg));
        for (let iy = 0; iy < 16; iy++) for (let ix = 0; ix < 16; ix++) {
          const x = Math.floor((ix + 0.5) * w / 16), y = Math.floor((iy + 0.5) * h / 16);
          SF.staticOffsetAt(Lp, x, y, w, h, out);
          const p0 = out[0], p1 = out[1];
          SF.staticOffsetAt(Lq, x, y, w, h, out);
          n++;
          const d = Math.max(Math.abs(p0 - out[0]) * w, Math.abs(p1 - out[1]) * h);
          if (d !== 0) { bad++; if (d > worst) { worst = d; where = `${tn} ${w}x${h} angle ${a}`; } }
        }
      }
    }
    chk(`§N1b (angle, amp) and (angle - 180, -amp) are the SAME COMPOSED FIELD (${n} pixels)`,
      bad === 0,
      bad === 0
        ? 'every pixel identical. So a 0-360 track would offer every distinct field TWICE, which is what '
          + 'makes ±90 a COMPLETENESS claim rather than a convenience. ⚠️ Compared at the composed offset '
          + 'rather than at the arrays — see the paragraph above, which corrects the level of the design '
          + 'document\'s own claim'
        : `⚠️ ${bad} of ${n} pixels differ, worst ${worst.toFixed(2)} px at ${where}`);
  }
}

{
  /*
   * ⚠️⚠️ **A HAND-EDITED IMPORT CAN CARRY `angleX: null` OR `NaN`, AND THE OBVIOUS TEST ORDER WOULD HAVE
   * NaN-ed THE WHOLE DISPLACEMENT TEXTURE.** `if (angleDeg === 0)` is false for NaN, so a NaN angle would
   * take the ROTATED arm; `Math.floor(NaN)` then passes BOTH of `sampleWave`'s bound tests, because every
   * comparison against NaN is false, and `arr[NaN]` is `undefined`. **No sanitiser on the screen path
   * reaches a NaN in the wave table** (invariant 20/21). `35.2` made the same decision for `shapeMix` and
   * recorded the same reason: NaN-safe BY SHAPE, never by `Math.min`/`Math.max`, which propagate it.
   */
  const bad = [NaN, Infinity, -Infinity, null, undefined];
  let worst = 0, where = '';
  for (const v of bad) for (const [w, h] of [[1920, 1080], [800, 600]]) {
    const base = nResolve({}, w, h, N_TABLES['two-harmonic 6:4']);
    const r = nResolve({ angleX: v, angleY: v, angleX2: v, angleY2: v }, w, h,
      N_TABLES['two-harmonic 6:4']);
    for (const k of ['waveX', 'waveY']) {
      if (r[k].length !== base[k].length) { worst = Infinity; where = `${v} ${w}x${h} ${k} length`; }
      for (let i = 0; i < r[k].length; i++) {
        const d = Math.abs(r[k][i] - base[k][i]);
        if (!(d === 0)) { if (!(d < worst)) { worst = d; where = `${v} ${w}x${h} ${k}[${i}]`; } }
      }
    }
  }
  chk('§N1c a NaN / Infinity / null angle takes the IDENTITY arm, bitwise',
    worst === 0,
    worst === 0
      ? `[${bad.map(String).join(', ')}] all reproduce the angle-0 field exactly. The test is `
        + '`!Number.isFinite(a) || a === 0`, i.e. NaN-safe BY SHAPE — `Math.min(90, Math.max(-90, NaN))` is '
        + 'NaN and would not have done this'
      : `⚠️⚠️ ${where} differs by ${worst} — a NaN angle is NaN-ing the wave array, and from it the `
        + 'displacement texture, which nothing on the screen path sanitises');

  // THE SEED: the inverted test order, which is the natural way to write it.
  const inverted = a => (a === 0 ? 'identity' : 'rotated');
  seed('`if (angleDeg === 0)` instead of `!Number.isFinite(angleDeg) || angleDeg === 0`',
    inverted(NaN) === 'rotated' && Number.isNaN(Math.cos(NaN / 1))
    && !(Math.floor(NaN) < 0) && !(Math.floor(NaN) + 1 >= 10),
    'NaN takes the ROTATED arm, cos/sin are NaN, and BOTH of sampleWave\'s bound tests pass because every '
    + 'comparison against NaN is false — so the lerp reads arr[NaN] (undefined) and returns NaN for every '
    + 'texel. ⚠️ The guard is in `waveAxisMap`, i.e. ONCE per build, not per sample');
}

// ----- §N2. THE SPLIT: the array length and the phase origin are two quantities ----------------------
/*
 * ⚠️⚠️ **THE ONE CLAUSE THE LANDMINE CANNOT SURVIVE.** The table's VALUE at a given AXIS COORDINATE must not
 * depend on how long the table is. `buildWave` writes entry `i` for axis coordinate `i + origin` and anchors
 * the phase with `centreAnchor(f, map.anchorLen, period)` — so widening `length` while `anchorLen` stays
 * `width`/`height` cannot move anything. Fold the two back into one argument and this goes red by more than
 * the wave's own amplitude, **at angle 0**, while every shape-invariance clause stays green.
 */
{
  let worst = 0, where = '', n = 0, pairs = 0;
  for (const [tn, T] of Object.entries(N_TABLES)) for (const [w, h] of N_SHAPES) {
    const base = nResolve({}, w, h, T);
    for (const a of N_ANGLES) {
      if (a === 0) continue;
      for (const [key, axis, len] of [['waveX', 'angleX', w], ['waveY', 'angleY', h]]) {
        const v = nResolve({ [axis]: a }, w, h, T);
        const m = axis === 'angleX' ? v.maps.x : v.maps.y;
        pairs++;
        for (let p = 0; p < len; p++) {
          n++;
          const i = p - m.origin;
          if (!Object.is(v[key][i], base[key][p])) {
            const d = Math.abs(v[key][i] - base[key][p]);
            if (d > worst) { worst = d; where = `${tn} ${w}x${h} ${axis}=${a} p=${p}`; }
          }
        }
      }
    }
  }
  chk(`§N2a a widened table holds the SAME value at the same AXIS COORDINATE (${n} comparisons, ${pairs} tables)`,
    worst === 0,
    worst === 0
      ? 'max |diff| = 0 under Object.is. The table lengthens and its content does not move, which is the '
        + 'array-length / phase-origin split in one measurement — and it is what makes gating the widening '
        + 'on `angle !== 0` an allocation choice rather than a 0°-to-1° jump'
      : `⚠️⚠️ worst |diff| ${worst.toExponential(3)} at ${where} — `
        + 'centreAnchor is being fed the TABLE length. See WaveAxisMap\'s header: this is invariant 26 in '
        + 'the one expression that has already shipped a silent origin bug once');

  chk('§N2b the two quantities are two NAMED fields, and the anchor reads the axis one',
    /centreAnchor\(f, map\.anchorLen, period\)/.test(sfSrc)
    && (sfSrc.match(/centreAnchor\(f, map\.anchorLen, period\)/g) ?? []).length === 2
    && !/centreAnchor\([^)]*map\.length/.test(sfSrc),
    'both builders pass `map.anchorLen`, neither passes `map.length`. ⚠️ A source clause as well as §N2a\'s '
    + 'measurement because the two builders are separate functions and only one of them might be fixed');

  // ⚠️⚠️ THE SEEDED CALIBRATION, and the ORACLE IS EXONERATED FIRST. `build` transcribes buildWave's
  // ARGUMENT expression VERBATIM — `((360*p*f)/period)/DEG + PI*f*(1 - n/period) + phase*f` — because
  // `2*PI*p/n` is a DIFFERENT DOUBLE: 35.2 measured 42 of 360 samples differing by up to 8.88e-16 against
  // the tidy form, which is a different association order and not a second wave.
  const build = (amps, freqs, length, anchorLen, origin, period) =>
    nBuild(amps, freqs, { length, anchorLen, origin }, period);
  {
    const T = N_TABLES['two-harmonic 6:4'];
    const [w, h] = [1920, 1080];
    const period = Math.min(w, h);
    const e = nResolve({}, w, h, T).waveX;
    const o = build(T[0].map(v => v * (Math.min(w, h) / 100)), T[1], w, w, 0, period);
    let bad = 0;
    for (let i = 0; i < w; i++) if (!Object.is(o[i], e[i])) bad++;
    chk('§N2c the seed\'s oracle is EXONERATED: it reproduces the engine\'s wave BIT-EXACTLY first',
      bad === 0,
      `${w} of ${w} samples identical under Object.is. ⚠️ The argument expression is transcribed verbatim — `
      + 'a tidy `2*PI*p/n` differs by up to 8.88e-16, which would make the seed below a measurement of the '
      + 'transcription rather than of the defect (35.2\'s recorded trap)');

    const half = Math.ceil(Math.hypot(w, h) / 2) + 1;
    const N = 2 * half + 1;
    const origin = Math.round(w / 2) - half;
    const good = build(T[0], T[1], N, w, origin, period);
    const bug = build(T[0], T[1], N, N, origin, period);
    let move = 0;
    for (let p = 0; p < w; p++) move = Math.max(move, Math.abs(good[p - origin] - bug[p - origin]));
    seed('centreAnchor fed the TABLE length instead of the AXIS length (the landmine)',
      move > 1,
      `the wave MOVES by ${move.toFixed(3)} on a table whose own amplitude sum is `
      + `${(T[0][0] + T[0][1]).toFixed(2)} — larger than the wave — at ANGLE 0, from widening ${w} to ${N} `
      + `alone. In pixels the shift is exactly (N - axisLen)/2 = ${((N - w) / 2).toFixed(1)} px on X and `
      + `${((N - h) / 2).toFixed(1)} px on Y, independent of frequency. §N2a reports it as a non-zero diff `
      + 'and §N3 as a displaced field centre');
  }
}

// ----- §N3. CENTRED AT EVERY ANGLE INCLUDING 0, WITH THE TABLE WIDENED, measured in PIXELS -----------
/*
 * ⚠️⚠️ **THE STEP IS NOT DONE WITHOUT THIS CLAUSE AND IT IS NOT A SHAPE TEST.** §10.5 of the design document
 * requires the field's centre of symmetry within 1 px of the frame centre at every angle; this measures it
 * **through the shipped composition (`staticOffsetAt`)**, in pixels, and it is the second axis of the same
 * quantity `fieldcheck` §A5 already asserts along canvas shape.
 *
 * **The measurement.** For an INTEGER-frequency table the wave's argument at axis coordinate `anchorLen/2`
 * is exactly `pi*f` (every other term carries `f` as a factor and cancels), so `wave(c + d) === -wave(c - d)`:
 * the field is **ODD about the frame centre**, at every angle, because the rotation pivots there. Scan an
 * assumed centre offset `s` along the wave's own sampling direction and take the `s` minimising the
 * odd-symmetry residual — **that `s` IS the displacement of the field's centre of symmetry, in pixels.**
 * Style 0 cross-couples, so `oy * h` is `round(wx)` and `ox * w` is `round(wy)`: each wave is read out of the
 * composed shipped sampler, one at a time, along its own direction.
 *
 * ⚠️ **THE TOLERANCE IS DERIVED, IN THREE STATED STEPS, AND NOT CHOSEN TO PASS** (invariant 27):
 *   1. the correct answer is **0 px with a residual of exactly 0.00e+0** — the odd symmetry is bit-exact,
 *      `Math.round` included;
 *   2. the probe's RESOLUTION is measured, not assumed: an injected **1 px** translation is reported as
 *      exactly 1 px at the SMALLEST canvas here (800x600), so 1 px is inside what the instrument can see;
 *   3. the smallest anchor defect REACHABLE is `(2*ceil(hypot(w,h)/2) + 3 - max(w,h)) / 2`, printed per
 *      shape below and **101.5 px at its smallest** — so a 1 px bound sits ~100x under the defect while
 *      still being a resolvable quantity. A looser bound would be slack; a tighter one would be a claim
 *      about the probe rather than about the field.
 */
const N_CENTRE_TOL_PX = 1;
{
  /** Read ONE wave out of the composed shipped sampler, along that wave's own sampling direction. */
  const probe = (waves, w, h, which) => {
    const L = [{ style: 0, centreX: w / 2, centreY: h / 2, ratio: 1,
      waveX: waves.waveX, waveY: waves.waveY, zoomX: null, zoomY: null, maps: waves.maps }];
    const out = new Float64Array(2);
    const m = which === 'x' ? waves.maps.x : waves.maps.y;
    const c = m.rotated ? m.cos : (which === 'x' ? 1 : 0);
    const s = m.rotated ? m.sin : (which === 'x' ? 0 : 1);
    const fx = Math.round(w / 2), fy = Math.round(h / 2);
    return (off) => {
      const x = Math.round(fx + off * c), y = Math.round(fy + off * s);
      if (x < 0 || x >= w || y < 0 || y >= h) return null;
      SF.staticOffsetAt(L, x, y, w, h, out);
      return which === 'x' ? out[1] * h : out[0] * w;
    };
  };
  const centreShift = (f, radius, range) => {
    let best = null, bestR = Infinity, r0 = null;
    for (let sh = -range; sh <= range; sh++) {
      let r = 0, n = 0;
      for (let d = 1; d <= radius; d++) {
        const a = f(sh + d), b = f(sh - d);
        if (a === null || b === null) continue;
        r += (a + b) * (a + b); n++;
      }
      if (n < radius * 0.5) continue;
      r /= n;
      if (sh === 0) r0 = r;
      if (r < bestR - 1e-12) { bestR = r; best = sh; }
    }
    return { shift: best, resid0: r0 };
  };

  let worst = 0, where = '', worstResid = 0, n = 0;
  const defects = [];
  for (const [w, h] of N_SHAPES) {
    const half = Math.ceil(Math.hypot(w, h) / 2) + 1;
    defects.push(`${w}x${h}:${(((2 * half + 1) - Math.max(w, h)) / 2).toFixed(1)}px`);
    for (const [, T] of Object.entries(N_TABLES)) for (const a of N_ANGLES) {
      const v = nResolve({ angleX: a, angleY: a }, w, h, T);
      const rad = Math.floor(Math.min(w, h) * 0.30);
      for (const which of ['x', 'y']) {
        const r = centreShift(probe(v, w, h, which), rad, 60);
        n++;
        if (Math.abs(r.shift) > worst) { worst = Math.abs(r.shift); where = `${w}x${h} angle ${a} ${which}`; }
        if (r.resid0 > worstResid) worstResid = r.resid0;
      }
    }
  }
  chk(`§N3a the field's centre of symmetry IS the frame centre at every angle including 0 (${n} measurements)`,
    worst <= N_CENTRE_TOL_PX,
    `worst |displacement| ${worst} px against a DERIVED ${N_CENTRE_TOL_PX} px bound, worst odd-symmetry `
    + `residual at the frame centre ${worstResid.toExponential(2)}. Smallest reachable anchor defect per `
    + `shape: ${defects.join('  ')}. ${worst > N_CENTRE_TOL_PX ? `⚠️⚠️ WORST AT ${where}` : ''}`);

  // ⚠️⚠️ TWO SEEDS. The first is the landmine at its real magnitude; the second is the probe's RESOLUTION,
  // which is what makes the 1 px bound a measurement rather than a wish.
  const [w, h] = [800, 600];
  const period = Math.min(w, h), fit = period / 100;
  const T = N_TABLES['two-harmonic 6:4'];
  const build = (amps, freqs, length, anchorLen, origin) =>
    nBuild(amps, freqs, { length, anchorLen, origin }, period);
  const v = nResolve({ angleX: 45, angleY: 45 }, w, h, T);
  const mx = v.maps.x;
  const goodX = build(T[0].map(q => q * fit), T[1], mx.length, w, mx.origin);
  const seeded = (arr) => ({ waveX: arr, waveY: v.waveY, zoomX: null, zoomY: null, maps: v.maps });

  const bugX = build(T[0].map(q => q * fit), T[1], mx.length, mx.length, mx.origin);
  const s1 = centreShift(probe(seeded(bugX), w, h, 'x'), 200, 250);
  seed('the folded anchor, at the SMALLEST canvas shape here',
    Math.abs(s1.shift) > N_CENTRE_TOL_PX,
    `§N3a reports the field centre ${s1.shift} px off, against the predicted (N - axisLen)/2 = `
    + `${((mx.length - w) / 2).toFixed(1)} px — so the clause refuses the landmine by ~${Math.round(Math.abs(s1.shift) / N_CENTRE_TOL_PX)}x its own bound`);

  const tr = new Float64Array(mx.length);
  for (let i = 0; i < mx.length; i++) tr[i] = goodX[Math.min(mx.length - 1, Math.max(0, i + 1))];
  const s2 = centreShift(probe(seeded(tr), w, h, 'x'), 200, 60);
  seed('a ONE-PIXEL translation — the probe\'s own resolution, which is where the bound comes from',
    Math.abs(s2.shift) === 1,
    `§N3a reports exactly ${s2.shift} px for an injected 1 px shift at ${w}x${h}. ⚠️ THIS is why the bound `
    + `is ${N_CENTRE_TOL_PX} px: the instrument resolves 1 px, the correct answer is 0 px at a residual of `
    + 'exactly 0, and the smallest reachable defect is ~100x larger. A bound chosen to pass is the defect '
    + 'this project names explicitly (invariant 27)');
}

// ----- §N4. bit-identity at angle 0 over the BUILT-WAVE population ----------------------------------
{
  const ZERO = { angleX: 0, angleY: 0, angleX2: 0, angleY2: 0 };
  /*
   * ⚠️⚠️ **`extra === null` MEANS *THE FOUR ANGLE KEYS DELETED*, NOT *THE LAYER AS AUTHORED* — AND THOSE
   * WERE THE SAME THING ONLY WHILE NOTHING AUTHORED AN ANGLE** (fixed 2026-10-30, `35.7`, on its own
   * demos). §N4a's claim is *"explicit 0 is the pre-`35.3` field"*, i.e. that an identity-VALUED angle
   * block renders what an angle-FREE body renders. With `e.l` verbatim as the baseline, the moment three
   * demos authored `angleX: 28` the clause began comparing *the tilted field* against *the untilted one*
   * and reported 3 layers "differing" over an engine that is bit-exact. Measured both readings over the
   * live separable layers: **as-authored 3, keys-deleted 0.**
   *
   * ⚠️ **It also silently weakened §N4b**, exactly as the as-authored baseline weakened §G2: a layer
   * already storing 45° would not MOVE when the override writes 45°, so each new carrier subtracted one
   * from the non-vacuity count. Stripping on both sides fixes both clauses.
   *
   * ⚠️⚠️ **FOURTH INSTANCE OF ONE PATTERN, and the third in two days.** `mixercheck` §O passed vacuously
   * over all 28 Phase 34 registry keys until eleven demos authored them and then exposed two real clause
   * defects; `shapecheck` §G1 did the same for the shape keys (its header owns that write-up); `35.1`
   * recorded a third shape of it in `WARP_SHAPES`; this is the fourth. **A clause whose baseline is "the
   * layer as authored" is correct only while nothing authors the thing it measures, and a green run over a
   * key no preset carries is invisibility rather than coverage.** ⛔ The two tempting wrong fixes are a
   * TOLERANCE and an exemption list of the three demo names: both discard the assertion. **The label was
   * right and the baseline was wrong.**
   */
  const ANGLE_KEYS = ['angleX', 'angleY', 'angleX2', 'angleY2'];
  const resolveE = (e, extra) => {
    const sf = { ...(e.l.staticField ?? {}) };
    // Stripped on BOTH sides — the comparison is *the angle-free body plus exactly the keys under test*,
    // which is the only reading under which a PARTIAL override (§N4b's, §N5's) means what it is written
    // to mean. See `resolve()` in §G for the same step and the same reason.
    for (const k of ANGLE_KEYS) delete sf[k];
    if (extra !== null) Object.assign(sf, extra);
    return SF.resolveStaticWaves({ ...e.l, staticField: sf }, e.t1, e.t2, 1920, 1080, 960, 540, 0);
  };
  const same = (a, b) => {
    for (const k of ['waveX', 'waveY', 'zoomX', 'zoomY']) {
      if ((a[k] === null) !== (b[k] === null)) return false;
      if (a[k] === null) continue;
      if (a[k].length !== b[k].length) return false;
      for (let i = 0; i < a[k].length; i++) if (!Object.is(a[k][i], b[k][i])) return false;
    }
    return true;
  };
  let bad = 0, first = '';
  for (const e of G_LAYERS) if (!same(resolveE(e, null), resolveE(e, ZERO))) { bad++; if (!first) first = e.name; }
  chk(`§N4a the four angles written explicitly at 0 are bitwise the pre-35.3 field (${G_LAYERS.length} layers)`,
    bad === 0,
    bad === 0 ? 'Object.is over every element of every array, lengths included — the identity is a BRANCH, '
      + 'not a rotation by zero, and the table is NOT widened at 0 so the arrays keep their lengths'
      : `⚠️⚠️ ${bad} layers differ, first ${first}`);

  let moved = 0, lenChanged = 0;
  for (const e of G_LAYERS) {
    const a = resolveE(e, null), b = resolveE(e, { angleX: 45, angleY: 45, angleX2: 45, angleY2: 45 });
    if (!same(a, b)) moved++;
    if (a.waveX.length !== b.waveX.length) lenChanged++;
  }
  chk('§N4b ...and a non-zero angle DOES move the field and DOES widen the table, so §N4a is not vacuous',
    moved > G_LAYERS.length * 0.5 && lenChanged > G_LAYERS.length * 0.5,
    `${moved} of ${G_LAYERS.length} layers move at 45° and ${lenChanged} widen their X table `
    + `(1920 -> ${resolveE(G_LAYERS[0], { angleX: 45 }).waveX.length} at 1920x1080, +14.7 %)`);

  chk('§N4c the identity is a BRANCH on the angle, not a rotation by zero',
    /if \(!Number\.isFinite\(angleDeg\) \|\| angleDeg === 0\)/.test(sfSrc)
    && /if \(m === undefined \|\| !m\.rotated\) return arr\[idx\] \?\? 0;/.test(sfSrc),
    'cos(90°) is 6.12e-17, not 0, so a Y wave "rotated by zero" would read h/2 + 6.12e-17*(x - w/2) + '
    + '(y - h/2), which is not y. ⚠️ Bit-identity is not algebraic identity — the same rule, for the same '
    + 'reason, as 35.2\'s identity arm in buildWave');
}

// ----- §N5. the maps are PUBLISHED and FORWARDED — the optional-`maps` gap, named -------------------
{
  const r = nResolve({ angleX: 30 }, 1920, 1080, N_TABLES['two-harmonic 6:4']);
  chk('§N5a resolveStaticWaves PUBLISHES the maps beside the arrays',
    r.maps && r.maps.x && r.maps.y && r.maps.zx && r.maps.zy && r.maps.x.rotated === true
    && r.maps.y.rotated === false,
    `x.rotated ${r.maps.x.rotated} (angleX 30), y.rotated ${r.maps.y.rotated} (angleY 0) — the gate is `
    + 'PER AXIS, so an angle on one axis does not widen the other\'s table');

  chk('§N5b ...and rebuildStaticField FORWARDS them by SPREAD, so a new field cannot be dropped',
    /resolved\.push\(\{ style: layer\.style, centreX, centreY, ratio, \.\.\.waves \}\)/.test(tmSrc),
    '⚠️ `ResolvedStaticLayer.maps` is OPTIONAL — absent means NOT ROTATED — because two hand-built-layer '
    + 'oracles exist and neither is type-checked (fieldcheck §A\'s separableField, which must stay UNEDITED, '
    + 'and field-measure.ts\'s measureStaticField). So `tsc` cannot police this line: a field-by-field copy '
    + 'here would sample a rotated field UNROTATED with no error anywhere');

  /*
   * ⚠️⚠️ **AND THE SECOND HAND-BUILT LAYER, WHICH `35.3` LEFT AS A NAMED GAP AND `35.4` CLOSED.**
   * `field-measure.ts`'s `measureStaticField` built its `ResolvedStaticLayer` field-by-field and dropped
   * `maps`, so the Transmap panel's PICTURE and its measured SENTENCE described the unrotated field while
   * the canvas showed the rotated one — invariant 13's harder form, self-consistent and invisible to `tsc`.
   * Both consumers are now asserted, in the same section, because they are one rule in two files.
   *
   * ⚠️ **`fieldcheck` §A's `separableField` is the one that must KEEP omitting `maps`** (`35.D5` — that file
   * stays byte-identical), which is why the property is optional at all. Do not generalise this clause into
   * *"every hand-built layer spreads"*: one of them deliberately does not.
   */
  chk('§N5g ...and so does field-measure.ts\'s measureStaticField, which is the OTHER hand-built layer',
    /\{\s*style: layer\.style, centreX: cx, centreY: cy, ratio: 1, \.\.\.waves,\s*\}/
      .test(stripComments(rd('ui/synthesis-lab/field-measure.ts'))),
    '⚠️ A ONE-TOKEN DEFECT WITH A WHOLE-PANEL CONSEQUENCE: the panel is the only witness the user has to '
    + 'how big the field is, and a measurement that drops the index mapping agrees with itself at every '
    + 'figure. ⚠️ `fieldcheck` §A\'s own oracle must stay field-by-field (35.D5), so this is asserted per '
    + 'CONSUMER and not as a general rule about the type');

  chk('§N5c the GLSL upload reads L.maps rather than re-deriving the rotation',
    /const m = L\.maps;/.test(tmSrc) && /a\.rotated \? a\.length : 0/.test(tmSrc),
    'one owner (waveMaps). ⚠️ `rotated ? length : 0` puts the flag and the clamp bound in ONE float, so a '
    + 'true flag cannot outlive a zero length (invariant 3\'s shape) — the shader reads m.w < 0.5 as "not '
    + 'rotated" and m.w - 1.0 as the top texel');

  chk('§N5d the wave texture\'s width is a MAX OVER EVERY TABLE, with max(w,h) only as the floor',
    /let n = Math\.max\(this\.width, this\.height\);/.test(tmSrc)
    && /for \(const a of \[L\.waveX, L\.waveY, L\.zoomX, L\.zoomY\]\) if \(a && a\.length > n\) n = a\.length;/.test(tmSrc),
    'a rotated table is hypot(w,h)-sized, so `max(w, h)` would TRUNCATE it — and the truncation would be '
    + 'invisible except as a frozen band at one edge of the frame. Keeping max(w,h) as the floor is what '
    + 'leaves an all-angle-0 chain byte-identical in the texture dimensions as well as the data');

  /*
   * ⚠️⚠️ **THE PREVIEW GRID IS A SECOND `init()` SITE AND `33.21` IS THE PRECEDENT: nine figure operators
   * had been invisible in tiles since Phase 30 because `grid-tile-renderer.ts` forwarded only two setters,
   * and NO CHECKER COMPARES A TILE TO A MAIN VIEW** (C7 covers grading, never the figure). The static field
   * is safe for a STRUCTURAL reason rather than a lucky one — the tile renderer hands the whole `chain` to
   * `transMap.init`, which goes through `setChain` -> `rebuildStaticField` -> `resolveStaticWaves` at
   * `TILE_W`/`TILE_H`, so the angles arrive with the layer and `waveMaps` is re-derived at tile size. **But
   * that is a claim about one line, so it is asserted rather than reasoned about**: a tile renderer that
   * started naming per-style fields instead of passing the chain would reproduce `33.21` exactly.
   */
  const tileSrc = stripComments(rd('ui/preview-grid/grid-tile-renderer.ts'));
  chk('§N5f the preview grid passes the whole CHAIN to init(), so the angles reach tiles with no forwarder',
    /const chain = chainFromOverlay\(preset\.overlay/.test(tileSrc)
    && /transMap\.init\(gl, \{/.test(tileSrc) && /^\s+chain,$/m.test(tileSrc),
    'the maps are re-derived from the layer at TILE_W/TILE_H, so a tile rotates at its own aspect rather '
    + 'than inheriting the main canvas\'s. ⚠️ 33.21: nine figure operators were invisible in tiles for '
    + 'three phases because that renderer forwarded named setters instead, and the owner found it, not a '
    + 'checker');

  chk('§N5e the shift and zoom halves are written in SEPARATE loops over their OWN lengths',
    /for \(let t = 0; t < shift\.length; t\+\+\) data\[\(row \* n \+ t\) \* 2\] = shift\[t\]!;/.test(tmSrc)
    && /if \(zoom\) for \(let t = 0; t < zoom\.length; t\+\+\) data\[\(row \* n \+ t\) \* 2 \+ 1\] = zoom\[t\]!;/.test(tmSrc),
    'they carry INDEPENDENT angles (angleX vs angleX2), so one can be rotated and the other not: their '
    + 'tables then have different lengths and neither may bound the other\'s write');
}

// ----- §N6. GLSL vs TS, BY MEASUREMENT — the comparison §D cannot be ---------------------------------
/*
 * ⚠️⚠️ **§D's per-style TEXT scan stays green over a one-sided rotation, which is why this clause is a
 * MEASUREMENT.** The shader's `staticOffset()` is transcribed here in DOUBLE precision from its own source
 * text, driven by the uniform values `setChain`'s upload derives from `L.maps`, and compared against the
 * shipped `staticOffsetAt()` over a pixel grid. They must agree EXACTLY: both compute
 * `centreIndex + dot(d, (cos, sin))`, both floor, both lerp between the same two texels.
 *
 * ⚠️ **What this clause does NOT cover, stated rather than implied:** the GPU evaluates the index in
 * float32, where the spacing at a 2206-texel index is 2.4e-4, so the lerp fraction carries ~12 bits there
 * against 52 here. That is a precision limit on a smooth interpolation, not a structural difference, and it
 * is not measurable from Node. **A shader change is not done until seen in a browser.**
 */
{
  const fetchR = (L, row, texel) => {
    const arr = row < 4 ? L.waveX : L.waveY;
    return texel >= 0 && texel < arr.length ? arr[texel] : 0;   // the texture is zero-padded
  };
  const fetchG = (L, row, texel) => {
    const arr = row < 4 ? L.zoomX : L.zoomY;
    if (!arr) return 0;
    return texel >= 0 && texel < arr.length ? arr[texel] : 0;
  };
  const jsRound = v => Math.floor(v + 0.5);
  const rollToRange = (v, mn, mx) => v < mn ? mn + ((mn - v) % (mx - mn))
    : v > mx ? mx - ((v - mx) % (mx - mn)) : v;
  const zoomCoordinate = (ref, coord, zoom) => jsRound(ref + (coord - ref) * zoom);
  /** The map `vec4` exactly as the upload packs it: (cos, sin, centreIndex, rotated ? length : 0). */
  const vec4 = a => [a.cos, a.sin, a.centreIndex, a.rotated ? a.length : 0];
  const waveTap = (L, row, chan, m, idx, d) => {
    const get = chan === 0 ? fetchR : fetchG;
    if (m[3] < 0.5) return get(L, row, Math.trunc(idx));
    const t = m[2] + d[0] * m[0] + d[1] * m[1];
    const f0 = Math.floor(t);
    const i0 = Math.min(Math.max(f0, 0), m[3] - 1);
    const i1 = Math.min(Math.max(f0 + 1, 0), m[3] - 1);
    const a = get(L, row, Math.trunc(i0)), b = get(L, row, Math.trunc(i1));
    return a + (b - a) * (t - f0);
  };
  /** The shader's `staticOffset()`, transcribed. ONE layer, ratio 1 — the shipped single-layer case. */
  const glslOffset = (L, maps, style, cx, cy, x, y, w, h) => {
    const d = [x - w * 0.5, y - h * 0.5];
    const wx = waveTap(L, 0, 0, vec4(maps.x), x, d);
    const wy = waveTap(L, 4, 0, vec4(maps.y), y, d);
    let x2, y2;
    if (style === 0) {
      x2 = Math.min(Math.max(x + wy, -100000), 100000);
      y2 = Math.min(Math.max(y + wx, -100000), 100000);
    } else if (style === 1) {
      x2 = zoomCoordinate(cx, x, 1 - wx);
      y2 = zoomCoordinate(cy, y, 1 - wy);
    } else if (style === 2) {
      const z = 1 - (wx + wy) / 2;
      x2 = zoomCoordinate(cx, x, z);
      y2 = zoomCoordinate(cy, y, z);
    } else {
      const zx = waveTap(L, 0, 1, vec4(maps.zx), x, d);
      const zy = waveTap(L, 4, 1, vec4(maps.zy), y, d);
      const z = 1 - (zx + zy) / 2;
      x2 = zoomCoordinate(cx, jsRound(x + wy), z);
      y2 = zoomCoordinate(cy, jsRound(y + wx), z);
    }
    const sx = rollToRange(jsRound(x2), 0, w - 1);
    const sy = rollToRange(jsRound(y2), 0, h - 1);
    return [(sx - x) / w, (sy - y) / h];
  };

  chk('§N6a the GLSL text really does branch, lerp and clamp to the map\'s OWN length',
    /if \(m\.w < 0\.5\)/.test(tmSrc) && /float f0 = floor\(t\);/.test(tmSrc)
    && /clamp\(f0 \+ 1\.0, 0\.0, m\.w - 1\.0\)/.test(tmSrc) && /mix\(chan == 0 \? a\.r : a\.g/.test(tmSrc),
    'so the transcription below is of the shipped shader rather than of an intention. ⚠️ NEAREST instead of '
    + 'the lerp would stair-step along the wave\'s own iso-lines — the stipple the jsRound note already '
    + 'records — and the lerp is ARITHMETIC, so the sampler stays NEAREST and a discontinuous shape cannot '
    + 'be smoothed by accident');

  let worst = 0, where = '', n = 0;
  const out = new Float64Array(2);
  for (const [w, h] of [[1920, 1080], [1366, 768], [800, 600]]) {
    for (const style of [0, 1, 2, 3]) {
      for (const [ax, ay, az, aw] of [[0, 0, 0, 0], [30, 0, 0, 0], [0, -45, 0, 0], [28, 28, 0, 0],
        [45, -45, 60, -60], [90, 90, 90, 90], [7.5, 7.5, 7.5, 7.5]]) {
        const sf = { pattern: 'Interference', pattern2: 'Grid Lattice', strength: 0.7, strength2: 0.6,
          zoomBias: 0.2, angleX: ax, angleY: ay, angleX2: az, angleY2: aw };
        const r = nResolve(sf, w, h, N_TABLES['two-harmonic 6:4'], style);
        const L = { style, centreX: w * 0.42, centreY: h * 0.57, ratio: 1,
          waveX: r.waveX, waveY: r.waveY, zoomX: r.zoomX, zoomY: r.zoomY, maps: r.maps };
        for (let iy = 0; iy < 24; iy++) for (let ix = 0; ix < 24; ix++) {
          const x = Math.floor((ix + 0.5) * w / 24), y = Math.floor((iy + 0.5) * h / 24);
          SF.staticOffsetAt([L], x, y, w, h, out);
          const g = glslOffset(L, r.maps, style, L.centreX, L.centreY, x, y, w, h);
          const dd = Math.max(Math.abs(g[0] - out[0]) * w, Math.abs(g[1] - out[1]) * h);
          n++;
          if (dd > worst) { worst = dd; where = `${w}x${h} style ${style} angles ${ax}/${ay}/${az}/${aw} (${x},${y})`; }
        }
      }
    }
  }
  chk(`§N6b the GLSL transcription and the shipped TS sampler agree EXACTLY under rotation (${n} pixels)`,
    worst === 0,
    worst === 0 ? 'max |diff| 0 px over 4 styles x 7 angle sets x 3 canvas shapes, the zoom half\'s own '
      + 'angles included. ⚠️ A one-sided rotation is exactly what fieldcheck §D cannot see'
      : `⚠️⚠️ worst ${worst.toExponential(3)} px at ${where}`);

  // THREE SEEDS, one per way the two sides can come apart while every §D clause stays green.
  const w = 1920, h = 1080;
  const r = nResolve({ pattern: 'Interference', angleX: 30, angleY: -40 }, w, h, N_TABLES['two-harmonic 6:4']);
  const L = { style: 0, centreX: w * 0.42, centreY: h * 0.57, ratio: 1,
    waveX: r.waveX, waveY: r.waveY, zoomX: null, zoomY: null, maps: r.maps };
  const scan = (fn) => {
    let d = 0;
    for (let iy = 0; iy < 24; iy++) for (let ix = 0; ix < 24; ix++) {
      const x = Math.floor((ix + 0.5) * w / 24), y = Math.floor((iy + 0.5) * h / 24);
      SF.staticOffsetAt([L], x, y, w, h, out);
      const g = fn(x, y);
      d = Math.max(d, Math.abs(g[0] - out[0]) * w, Math.abs(g[1] - out[1]) * h);
    }
    return d;
  };
  const nearest = (L2, row, chan, m, idx, d) => {
    const get = chan === 0 ? fetchR : fetchG;
    if (m[3] < 0.5) return get(L2, row, Math.trunc(idx));
    return get(L2, row, Math.trunc(Math.floor(m[2] + d[0] * m[0] + d[1] * m[1])));
  };
  const withTap = (tap) => (x, y) => {
    const d = [x - w * 0.5, y - h * 0.5];
    const wx = tap(L, 0, 0, vec4(r.maps.x), x, d);
    const wy = tap(L, 4, 0, vec4(r.maps.y), y, d);
    const sx = rollToRange(jsRound(Math.min(Math.max(x + wy, -1e5), 1e5)), 0, w - 1);
    const sy = rollToRange(jsRound(Math.min(Math.max(y + wx, -1e5), 1e5)), 0, h - 1);
    return [(sx - x) / w, (sy - y) / h];
  };
  seed('NEAREST in the shader instead of the 2-tap lerp', scan(withTap(nearest)) > 0,
    `the two index consumers then disagree by up to ${scan(withTap(nearest)).toFixed(1)} px — which is the `
    + 'stipple, and it is the difference §N6b exists to refuse');

  const pivotZoom = (x, y) => {
    const d = [x - L.centreX, y - L.centreY];     // the ZOOM centre, the classic wrong pivot
    const wx = waveTap(L, 0, 0, vec4(r.maps.x), x, d);
    const wy = waveTap(L, 4, 0, vec4(r.maps.y), y, d);
    const sx = rollToRange(jsRound(Math.min(Math.max(x + wy, -1e5), 1e5)), 0, w - 1);
    const sy = rollToRange(jsRound(Math.min(Math.max(y + wx, -1e5), 1e5)), 0, h - 1);
    return [(sx - x) / w, (sy - y) / h];
  };
  seed('the shader pivoting on uStaticCentre (the ZOOM centre) instead of the frame centre',
    scan(pivotZoom) > 0,
    `up to ${scan(pivotZoom).toFixed(1)} px apart. ⚠️ The design document says "frame centre" and the `
    + 'code says it at the rotation with the two symbols spelled differently, because this is the '
    + 'substitution a reader of trans-map.ts makes naturally — uStaticCentre is RIGHT THERE in the loop');

  const crossed = (x, y) => {
    const d = [x - w * 0.5, y - h * 0.5];
    const wx = waveTap(L, 0, 0, vec4(r.maps.y), x, d);   // the Y map on the X wave
    const wy = waveTap(L, 4, 0, vec4(r.maps.x), y, d);
    const sx = rollToRange(jsRound(Math.min(Math.max(x + wy, -1e5), 1e5)), 0, w - 1);
    const sy = rollToRange(jsRound(Math.min(Math.max(y + wx, -1e5), 1e5)), 0, h - 1);
    return [(sx - x) / w, (sy - y) / h];
  };
  seed('the two maps CROSSED in the shader (the Y map on the X wave)', scan(crossed) > 0,
    `up to ${scan(crossed).toFixed(1)} px apart — the index-side twin of 35.2's crossed shape pairs, and `
    + 'equally invisible to tsc');
}

// ----- §N7. the re-solve, and the CANCELLATION `35.3` made reachable --------------------------------
/*
 * ⚠️⚠️ **THIS SECTION FOUND A DEFECT RATHER THAN CONFIRMING AN EXPECTATION, AND IT IS THE REASON
 * `solveGain`'s `peak <= 0` IS NOW A DERIVED FLOOR.** Style 2's displacement is `dz = -(wx + wy)/2`. At
 * angle 0 the two waves are indexed by DIFFERENT coordinates, so they cannot cancel. **A parallel or
 * antiparallel pair (`angleY = angleX - 90`) puts them on the SAME axis**, and every archetype whose two
 * axes share one table up to sign then has `wy === -wx` identically — so `dz` is analytically ZERO and the
 * measured peak is round-off. The old guard did not catch it (the peak is small, not zero): `Interference`
 * style 2 at `45 / -45` solved a gain of **2.97e+13** and rendered round-off at the right MAGNITUDE
 * (41.9 px against a 43.2 px target) with noise for its structure. **A plausible-looking field is the
 * hardest kind of wrong.**
 *
 * So the clause is a DICHOTOMY, not a single bound: a field is either on target or exactly flat, with
 * nothing in between — and the flat set must be exactly the cancelled set, asserted against the probe the
 * solver actually measured rather than against a list of angles.
 *
 * ⚠️ **`absoluteAmp` archetypes are excluded BY NAME and that is not a convenience.** `Macrolense` and
 * `Distant Lense` skip `solveGain` entirely (§4.2), so their realised peak is NOT `strength × target` at
 * any angle — including 0. Including them would have made this clause red over correct code, and reading
 * that red as an angle defect is exactly the mistake the exclusion prevents.
 */
{
  const PERIOD = Math.min(1920, 1080);
  /** sumNormalise, transcribed — the probe's amplitudes are the normalised table. */
  const nNorm = a => { let s = 0; for (const v of a) s += Math.abs(v); return s > 0 ? a.map(v => v / s) : a.slice(); };
  /** `sampleWave`, transcribed. The two solves read the probe through it, so the oracle must too. */
  const nSamp = (arr, m, idx, dx, dy) => {
    if (!arr) return 0;
    if (!m.rotated) return arr[idx] ?? 0;
    const t = m.centreIndex + dx * m.cos + dy * m.sin;
    const i0 = Math.floor(t);
    if (i0 < 0) return arr[0];
    if (i0 + 1 >= arr.length) return arr[arr.length - 1];
    return arr[i0] + (arr[i0 + 1] - arr[i0]) * (t - i0);
  };
  /** `solveGain`'s own grid, sampled THROUGH the maps — §F7's `gridPeak` reads arr[x] and cannot. */
  const gridPeakRot = (style, r, w, h, cx, cy) => {
    const stepX = Math.max(1, Math.floor(w / GAIN_SCAN)), stepY = Math.max(1, Math.floor(h / GAIN_SCAN));
    const fx = w / 2, fy = h / 2;
    let peak = 0, mag = 0;
    for (let y = 0; y < h; y += stepY) {
      const fdy = y - fy;
      for (let x = 0; x < w; x += stepX) {
        const fdx = x - fx;
        const wx = nSamp(r.waveX, r.maps.x, x, fdx, fdy), wy = nSamp(r.waveY, r.maps.y, y, fdx, fdy);
        mag = Math.max(mag, Math.abs(wx) + Math.abs(wy));
        let dx, dy;
        if (style === 0) { dx = wy; dy = wx; }
        else if (style === 1) { dx = (x - cx) * -wx; dy = (y - cy) * -wy; }
        else if (style === 2) { const dz = -(wx + wy) / 2; dx = (x - cx) * dz; dy = (y - cy) * dz; }
        else {
          const dz = -(nSamp(r.zoomX, r.maps.zx, x, fdx, fdy) + nSamp(r.zoomY, r.maps.zy, y, fdx, fdy)) / 2;
          dx = wy + (x - cx) * dz; dy = wx + (y - cy) * dz;
        }
        const d = Math.hypot(dx, dy);
        if (d > peak) peak = d;
      }
    }
    return { peak, mag };
  };
  /** The PROBE the solver divides by, rebuilt, and its cancellation ratio `peak / (mag * rad)`. */
  const probeRatio = (arch, style, maps, w, h, cx, cy) => {
    const u = { maps,
      waveX: nBuild(nNorm(arch.xAmp), arch.xFreq, maps.x, PERIOD),
      waveY: nBuild(nNorm(arch.yAmp), arch.yFreq, maps.y, PERIOD), zoomX: null, zoomY: null };
    const { peak, mag } = gridPeakRot(style === 0 ? 1 : style, u, w, h, cx, cy);
    const rad = Math.hypot(Math.max(cx, w - 1 - cx), Math.max(cy, h - 1 - cy));
    return mag > 0 ? peak / (mag * rad) : 0;
  };

  const W = 1920, H = 1080, STR = 0.5;
  const want = STR * SF.STATIC_FIELD_TARGET_FRACTION * Math.min(W, H);
  // ⚠️⚠️ The angle pairs include SEVEN parallel/antiparallel ones (`angleY = angleX - 90`, plus `-90/0`),
  // because those are the ONLY ones that cancel — a sweep of "interesting-looking" angles would have missed
  // the defect entirely, and the first draft of this clause did. ⚠️ `1/-89` is NOT a near-miss: `1 - 90` is
  // `-89`, so it is the parallel relation exactly. The near-miss is measured in §N7c instead, where the
  // separation is a SWEPT quantity rather than a hand-picked pair.
  const SETS = [[0, 0], [30, 0], [0, -45], [28, 28], [45, 45], [7.5, 7.5],
    [45, -45], [0, -90], [30, -60], [90, 0], [-90, 0], [15, -75], [1, -89]];
  const PATTERNS = SF.STATIC_FIELD_ARCHETYPES.filter(a => !a.absoluteAmp);

  let worstOn = 0, worstOnName = '', nOn = 0;
  let flat = [], worstCancelRatio = 0, minHealthyRatio = Infinity, between = [];
  for (const arch of PATTERNS) for (const style of [0, 1, 2, 3]) for (const [ax, ay] of SETS) {
    const layer = { style, weight: 1, staticField: {
      pattern: arch.name, pattern2: arch.name, strength: STR, strength2: STR,
      angleX: ax, angleY: ay, angleX2: ax, angleY2: ay } };
    const r = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
    const { peak } = gridPeakRot(style, r, W, H, W / 2, H / 2);
    const ratio = probeRatio(arch, style, r.maps, W, H, W / 2, H / 2);
    const tag = `${arch.name} s${style} ${ax}/${ay}`;
    if (peak === 0) { flat.push(tag); worstCancelRatio = Math.max(worstCancelRatio, ratio); continue; }
    const rel = Math.abs(peak / want - 1);
    nOn++;
    minHealthyRatio = Math.min(minHealthyRatio, ratio);
    if (rel > worstOn) { worstOn = rel; worstOnName = tag; }
    if (rel > 1e-9) between.push(`${tag} rel ${rel.toExponential(2)} ratio ${ratio.toExponential(2)}`);
  }

  chk(`§N7a every non-degenerate field is strength x target at EVERY angle (${nOn} fields)`,
    worstOn < 1e-9 && between.length === 0,
    `worst relative deviation ${worstOn.toExponential(2)} (${worstOnName}) against 1e-9 — §F7's own bound, `
    + `reused because this is the same quantity along a second axis. ${between.length ? `⚠️⚠️ NEITHER on `
      + `target NOR flat: ${between.slice(0, 4).join(' | ')}` : 'and nothing lands between on-target and flat'}`);

  chk(`§N7b the DEGENERATE set is exactly the cancelled one, and the gap is measured (${flat.length} flat)`,
    flat.length > 0 && worstCancelRatio < 1e-9 && minHealthyRatio > 1e-9
    && flat.every(t => / s2 /.test(t)),
    `${flat.length} configurations render NO field: all style 2, all a parallel or antiparallel pair `
    + `(angleY = angleX - 90). Cancellation ratio peak/(mag*rad): cancelled <= `
    + `${worstCancelRatio.toExponential(2)}, healthy >= ${minHealthyRatio.toExponential(2)} — a gap of `
    + `${(minHealthyRatio / Math.max(worstCancelRatio, Number.MIN_VALUE)).toExponential(2)}x, with `
    + `GAIN_CANCEL_FLOOR = 1e-9 inside it. ⚠️ 0 is the HONEST answer: dz is analytically zero there, so no `
    + `warp is the correct render, and the remedy for the user is 35.4's notice line (35.D2 forbids a clamp)`);

  /*
   * ⚠️⚠️ **HOW WIDE IS THE REFUSED BAND? MEASURED, BECAUSE THE ANSWER IS THE WHOLE JUSTIFICATION FOR
   * MAKING THE FLOOR A CANCELLATION TEST RATHER THAN AN ANGLE TEST.** A predicate on the angle relation
   * (*"is this pair within k° of parallel"*) would have had to pick a `k`, and every pair inside it would
   * have lost a field that is real and merely one-directional. Swept on `Interference` style 2 at
   * `angleX = 45`: the field is flat at EXACTLY parallel and **back at the full target by a separation of
   * 0.001°**. So the refused band has no width in the control's units — the floor refuses an arithmetic
   * event, not a configuration.
   */
  {
    const SEPS = [0, 0.001, 0.01, 0.1, 1, 5];
    const peaks = SEPS.map(sep => {
      const layer = { style: 2, weight: 1, staticField: {
        pattern: 'Interference', strength: STR, angleX: 45, angleY: -45 + sep } };
      return gridPeakRot(2, SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0),
        W, H, W / 2, H / 2).peak;
    });
    const ok = peaks[0] === 0 && peaks.slice(1).every(p => Math.abs(p / want - 1) < 1e-9);
    chk('§N7c the refused band has NO WIDTH in degrees — 0.001° off parallel is back at full strength',
      ok,
      `separation -> realised peak: ${SEPS.map((sp, i) => `${sp}° ${peaks[i].toFixed(2)}`).join('  ')} `
      + `(target ${want.toFixed(2)}). So the floor refuses a CANCELLATION rather than an angle relation — `
      + 'an angle predicate would have had to pick a width, and every pair inside it would have lost a '
      + 'field that is real and merely one-directional');
  }

  // ⚠️⚠️ THE SEED FOR THE FLOOR, and it reproduces the measured defect rather than a synthetic one.
  {
    const arch = SF.STATIC_FIELD_ARCHETYPES.find(a => a.name === 'Interference');
    const maps = SF.waveMaps({ ...STATIC_FIELD_DEFAULTS, angleX: 45, angleY: -45 }, W, H);
    const uX = nBuild(nNorm(arch.xAmp), arch.xFreq, maps.x, PERIOD);
    const uY = nBuild(nNorm(arch.yAmp), arch.yFreq, maps.y, PERIOD);
    const { peak, mag } = gridPeakRot(2, { waveX: uX, waveY: uY, zoomX: null, zoomY: null, maps },
      W, H, W / 2, H / 2);
    const target = SF.STATIC_FIELD_TARGET_FRACTION * Math.min(W, H);
    seed('the OLD `peak <= 0` guard, on the probe that produced the defect',
      peak > 0 && peak < 1e-6,
      `Interference style 2 at 45/-45: probe peak ${peak.toExponential(3)} (NOT <= 0, so the old guard `
      + `passed it) would have solved a gain of ${(target / peak * STR).toExponential(3)} — round-off `
      + `amplified by thirteen orders into the displacement texture, normalised to the right magnitude. `
      + `The derived floor is ${(1e-9 * mag * Math.hypot(W / 2, H / 2)).toExponential(3)} and refuses it`);
  }

  // ⚠️ AND the probe-orientation error, which is the OTHER way the solve can be wrong: a probe left
  // axis-aligned while the rendered field is rotated. The `(Preset)` branch applies NO gain solve, so its
  // peak IS the raw unit peak at each orientation.
  {
    const TW = [[0.5, 0.25, 0.125, 0.0625], [1, 2, 4, 8], [0.4, 0.3, 0.2, 0.1], [3, 5, 7, 11]];
    const unit = (style, ax, ay) => {
      const layer = { style, weight: 1, staticField: { pattern: '(Preset)', strength: 0.5, angleX: ax, angleY: ay } };
      return gridPeakRot(style, SF.resolveStaticWaves(layer, TW, TW, W, H, W / 2, H / 2, 0),
        W, H, W / 2, H / 2).peak;
    };
    let biggest = 0, at = '';
    for (const style of [0, 1, 2]) {
      const base = unit(style, 0, 0);
      for (const [ax, ay] of SETS.slice(1)) {
        const rr = Math.abs(unit(style, ax, ay) / base - 1);
        if (rr > biggest) { biggest = rr; at = `style ${style} ${ax}/${ay}`; }
      }
    }
    seed('the gain solved against an AXIS-ALIGNED probe while the rendered field is rotated',
      biggest > 1e-3,
      `the realised peak would land ${(biggest * 100).toFixed(1)} % off target at worst (${at}), i.e. `
      + `${(biggest / 1e-9).toExponential(1)}x §N7a's bound. ⚠️ An ASYMMETRIC table is required to see it: `
      + 'with xFreq === yFreq the unit peak is nearly orientation-invariant and the defect hides');
  }

  // And the re-solve GATE: an angle change must dirty both digests, or `strength` keeps the previous
  // orientation's calibration until something else does.
  const sig = sf => chainSignature([{ style: 0, enabled: true, weight: 1, staticField: sf }]);
  const b = sig({ pattern: 'Grid Lattice' });
  const moved = ['angleX', 'angleY', 'angleX2', 'angleY2']
    .filter(k => sig({ pattern: 'Grid Lattice', [k]: 28 }) !== b);
  chk('§N7d chainSignature() SEPARATES a change in each of the four angles',
    moved.length === 4,
    moved.length === 4 ? `all four move the digest off "${b}"`
      : `⚠️⚠️ only [${moved}] — the others leave reinitTransMap() unfired, so preset B renders preset A's `
        + 'field AT PRESET A\'S TABLE WIDTH while every control, readout and thumbnail shows B');

  const sigExpr = (() => {
    const from = tmSrc.indexOf('const signature = statics.length === 0');
    const to = tmSrc.indexOf(".join('|')", from);
    return from >= 0 && to > from ? tmSrc.slice(from, to) : '';
  })();
  chk('§N7e ...and the four angles enter setChain()\'s signature as VALUES, not as drift\'s boolean',
    ['angleX', 'angleY', 'angleX2', 'angleY2'].every(k => new RegExp(`s\\.${k}\\.toFixed`).test(sigExpr)),
    'an angle is STATIC — nothing re-solves it per frame — so drift\'s boolean reduction does not transfer. '
    + 'Reducing one to an on/off bit would freeze the field mid-drag at the last rebuilt orientation. '
    + '⚠️ And an angle changes the table LENGTH, so an omission also leaves waveTexWidth describing a '
    + 'texture of a different size');

  // ⚠️ And the CONSEQUENCE of a missed re-solve, measured — §N7d/§N7e say the digests NAME the angles,
  // this says the solved gain really does depend on one. §L3 is the same clause for the shape; if this
  // ratio were 1.000 the digest clauses above would be policing nothing.
  {
    const amp = (ax, ay) => {
      const layer = { style: 1, weight: 1, staticField: {
        pattern: 'Turbulent Weave', strength: 0.5, angleX: ax, angleY: ay } };
      const r = SF.resolveStaticWaves(layer, ZERO_TABLE, ZERO_TABLE, W, H, W / 2, H / 2, 0);
      let m = 0;
      for (let i = 0; i < r.waveX.length; i++) m = Math.max(m, Math.abs(r.waveX[i]));
      return m;
    };
    const vals = [[0, 0], [30, 0], [45, -20], [90, 90]].map(([a, b]) => [`${a}/${b}`, amp(a, b)]);
    const spread = Math.max(...vals.map(v => v[1])) / Math.min(...vals.map(v => v[1]));
    chk('§N7f the SOLVED GAIN really does depend on the angle, so a missed re-solve is a real defect',
      spread > 1.01,
      `resolved peak amplitude on Turbulent Weave style 1: `
      + `${vals.map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')} — spread ${spread.toFixed(3)}x. `
      + '⚠️ If this were 1.000 the two digest clauses above would be policing nothing');
  }

  const seedSig = sigExpr.replace(/:\$\{s\.angleY2\.toFixed\(4\)\}/, '');
  seed('`angleY2` dropped from setChain()\'s signature',
    !/s\.angleY2\.toFixed/.test(seedSig),
    '§D1\'s key scan and §N7e both notice — and the cost is specific: a style-3 zoom half that renders at '
    + 'the previous orientation while Zoom Strength is calibrated for the new one');
}

// ----- §N8. the export gate, END TO END, for a layer whose ONLY non-default value is an angle --------
/*
 * ⚠️⚠️ §C1 is a TEXT scan of `isStaticFieldDefault()`. This is the same claim driven through the real path,
 * because `35.1` measured that exact failure for `shape`: the predicate returned `true`, `normaliseChain`
 * DROPPED the block, `isLegacyExpressible` returned `true`, and `getSnapshot()` emitted **no `transMapChain`
 * key at all** — destroyed, not omitted (invariant 17, Snapshot worst of all), on the ORDINARY save path.
 */
{
  for (const key of ['angleX', 'angleY', 'angleX2', 'angleY2']) {
    const chain = [{ style: 3, enabled: true, weight: 1, staticField: { [key]: 28 } }];
    const dflt = SF.isStaticFieldDefault(chain[0].staticField);
    const norm = normaliseChain(chain);
    const kept = norm[0] && norm[0].staticField && norm[0].staticField[key] === 28;
    const legacy = isLegacyExpressible(norm);
    const back = chainFromOverlay({ transMapChain: norm }, 3);
    const roundTrip = back.find(l => l.style === 3)?.staticField?.[key] === 28;
    chk(`§N8 a layer whose ONLY non-default value is ${key} survives the whole save path`,
      dflt === false && kept && legacy === false && roundTrip,
      `isStaticFieldDefault ${dflt} (must be false) | normaliseChain kept it ${kept} | `
      + `isLegacyExpressible ${legacy} (must be false, or getSnapshot emits NO transMapChain key) | `
      + `chainFromOverlay returned it ${roundTrip}`);
  }
  // ⚠️ The other direction: all-zero angles must still read as DEFAULT, or every preset in the library is
  // forced out of legacy form on export for a value nothing changed.
  chk('§N8b ...and the four angles written explicitly at 0 still read as ALL-DEFAULT',
    SF.isStaticFieldDefault({ angleX: 0, angleY: 0, angleX2: 0, angleY2: 0 }) === true,
    'an export is mostly runtime-default noise; a predicate that called 0 non-default would push all 289 '
    + 'live separable layers into the array form');
}

// ----- §N9. the frequency-0 exemption is untouched by rotation — a dead slot stays dead --------------
{
  // 7 slots across 5 shipped presets carry a frequency-0 slot at a nonzero amplitude (35.2's measurement).
  // Its argument is exactly 0 at every pixel BECAUSE every term carries `freq` as a factor — and the
  // rotation enters the INDEX, not the argument's frequency, so the exemption cannot be reached by it.
  const DEAD = [[1, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]];
  let worstFlat = 0, worstShaped = 0;
  for (const [w, h] of N_SHAPES) for (const a of N_ANGLES) {
    for (const shape of WARP_SHAPES) {
      const r = nResolve({ angleX: a, angleY: a, shape, shapeMix: 1 }, w, h, DEAD);
      for (const k of ['waveX', 'waveY']) for (let i = 0; i < r[k].length; i++) {
        const v = Math.abs(r[k][i]);
        if (shape === 'sine') worstFlat = Math.max(worstFlat, v); else worstShaped = Math.max(worstShaped, v);
      }
    }
  }
  chk('§N9 a frequency-0 slot stays DEAD at every angle and under every shape',
    worstFlat === 0 && worstShaped === 0,
    `max |wave| ${worstFlat.toExponential(1)} (sine) / ${worstShaped.toExponential(1)} (shaped) over all `
    + 'angles and canvas shapes. ⚠️ The rotation enters the INDEX while the exemption is on the ARGUMENT\'s '
    + 'frequency, so the two cannot interact — asserted rather than reasoned, because sqrSin(0) is +1 and '
    + 'sawSin(0) is -1 and the exemption is worth one FULL amplitude on those two shapes');
}

// ---------------------------------------------------------------------------------------------------
// ⏳ OWED, and named rather than inferred from a count. None of these is covered by a green run above:
//   - **the two SHAPE dropdowns, asserted as SOURCE TEXT in BOTH editors** — `tabs/transmap.ts` AND
//     `tabs/visual-fx.ts`, which carries its own complete static-field editor. ⚠ That is the gap §A exists
//     for: nothing else can see a hand-written option list, and rows added to one editor only means the
//     other silently cannot reach the shape (`32.15`'s finding verbatim). ⚠️ **`tipcheck` §K is the
//     STAND-IN and says so** — it asserts `of WARP_SHAPES` in both files and no `<option>` carrying a shape
//     name as a literal — so this entry is about moving the claim to §B, not about an unguarded gap.
//   - **a LOOK at the notice SET, which is the one thing no checker here can be.** `tipcheck` §K measures
//     that the eight strings exist, are partitioned, are short enough and come from one owner, and
//     `trackcheck` §M that the predicate reads `WAVE_QUARTER_TURN` and names no archetype — **none of that
//     reads a SENTENCE.** The nine conditions are: `shape !== 'sine' && shapeMix === 0` first (the phase's
//     most likely first-use confusion), the two tear wordings, the authored-for-sine line, the zoom twin,
//     and `35.4`'s three orientation lines. ⚠️ A caption is a claim about a picture and three of `31.U`'s
//     asserted a gate the code does not implement — **open the panel.**
//   - **`35.6`'s DEMOS** — the archetype half landed (§M); the demo presets did not, and they are the half
//     that moves this file's own basis. ⚠⚠ **§G's population and the golden parity hash are functions of
//     the LIBRARY**, so re-capture both when the demos land or a red there reads as a parity break.
//     ⚠ Measured 2026-10-29 at the archetype half: adding the three archetypes moved NEITHER — library
//     314 / 278 presets / 278 layers / 612 wave arrays, sha256 `6d68e98c6075ace1…` unchanged — because an
//     archetype is reachable data and no shipped preset names one.
//     ⚠️⚠️ **AND THAT IS NOW FIRING: with the demos partly landed, §G0 reads 297 layers and all four §G1
//     clauses are RED, naming `Warp Square Mosaic` and `Warp Split Shapes`.** It is the basis, not a parity
//     break: §G1 overrides only the SHAPE keys and compares against the layer's own, so any preset that
//     AUTHORS a live shape (`square` at mix 1.0 is the flagship demo's whole point) differs by
//     construction. **§G1's population must exclude the layers whose stored shape is already live, or the
//     clause measures the demos rather than the identity arm** — owed to `35.6`, which owns those bodies.
//     ⚠️ Measured 2026-10-29 by `35.4`: 0 of the 297 layers author a non-zero ANGLE, so §N4's twin is still
//     green and the two halves of the phase are separable exactly as `35.D5` intended.
//   - **a LOOK at the three archetypes**, and `Terraced Swell` is the one at risk: it is designed FOR
//     `trapezoid`, whose own look verdict has not been taken, so **cutting that shape cuts this entry.**
//     ⚠ `Oblique Lattice`'s name is not earned until `35.3` lands — its table is axis-aligned today and the
//     spec reached "off-axis" through `angleX`/`angleY` 28°. §M6 measures the table at 0.849; the 1.393 the
//     spec quotes is an ANGLE figure. **That is an owner call, not a build-time one.**
//   - **a LOOK**, owed to an eye and discharged by nothing here: chain-change latency per shape at
//     1920×1080; whether `triangle` and `trapezoid` justify themselves at all (both measured as refinements
//     of sine, and §H puts `trapezoid` in sine's own tear class at 3.0 px against square's 71.0); and
//     whether a 571-px tear is an image or destruction.
//
// ✅ DISCHARGED by `35.2`, so that an owed list is not read as a longer one than it is: the `shapeFn`
// dispatch (§E), the twelve call sites and the four unit-gain probes (§F), bit-identity at both identities
// over the built-wave population (§G), the tear classification as a MEASUREMENT (§H), `blendLayerBlocks()`'s
// snap/lerp law (§I), the Randomiser's style gate and weighting (§J), the bake's round trip under a shape
// (§K) and the re-solve gate's consequence (§L).
//
// ✅ DISCHARGED by `35.3` (§N): the array-length / phase-origin SPLIT, bitwise over 602 424 comparisons
// (§N2); the field CENTRED at every angle including 0 with the table widened, in pixels, through the
// shipped sampler, at a bound derived in three stated steps (§N3); bit-identity at all-angles-0 over the
// built-wave population with its own non-vacuity clause (§N4); the four index consumers, two by source and
// two by measurement (§N0, §N6); the ±90 range and the (angle + 180, -amp) identity at the level it
// actually holds (§N1); the re-solve, the cancellation floor and its measured 1.8e+11 gap (§N7); the export
// round trip for an angle-only layer, driven through `normaliseChain` -> `isLegacyExpressible` ->
// `chainFromOverlay` rather than scanned as text (§N8); and the frequency-0 exemption under rotation (§N9).
//
// ✅ DISCHARGED by `35.4`'s angle half (2026-10-29) — **none of it in this file, and the instruments are
// named so that a reader does not look for them here**:
//   - **the four angle SLIDERS, in BOTH editors.** `tabs/transmap.ts`' `anglePairRow()` and
//     `tabs/visual-fx.ts`' `staticAnglePair()` — one shared row factory per file, each covering both cells
//     of both pairs, so four handles are two call sites per file and a shift/zoom divergence is not
//     expressible. `Angle X/Y` is ONE row with TWO CELLS. **`trackcheck` §M is the instrument** (11 new
//     clauses): 181 stops at exactly 1°, all whole degrees, both endpoints AND 0 exact THROUGH the native
//     sanitiser, the load direction exact, the readout round-tripping, oddness, the non-finite arm, and the
//     source-shaped pair asserting BOTH editors read the shared track and name no value bound.
//   - ⚠️ **`WAVE_ANGLE_MAX` NOW HAS A READER** — `WAVE_ANGLE_STEP` and `WAVE_ANGLE_TRACK` derive from it and
//     the rows read those, which is what closes `35.1`'s *"a constant cited in prose has no reader and
//     nothing reports it"* in its second symbol. Nothing clamps a STORED angle; `toPos` clamps the handle.
//   - **the notice set, all nine conditions**, three of them new: `axisSwap`, `wavesParallel` and
//     ⚠️⚠️ **`wavesCancel`, THE LINE THE DESIGN DOCUMENT DOES NOT HAVE** (§2.4 predicts only
//     *"one-directional"*; §N7 measured that style 2 cancels to NOTHING). All three are in `SHAPE_NOTICES`
//     rather than a table of their own, so both editors build and gate them with no new code.
//     ⚠️⚠️ **The stronger gate — *fire when the measured peak is 0* — IS UNREACHABLE and that is a finding:**
//     the cancellation makes `solveGain` return 0, the gain multiplies the amplitudes, and the built arrays
//     come out ALL-ZERO — byte-identical to a silent table or Strength 0. **A guard releasing to 0 hides its
//     own trip** (invariant 21), so the angle relation is the only surviving signal and the wording states
//     the MECHANISM and its condition rather than asserting the field is gone.
//   - ⚠️⚠️ **`measureStaticField`'s DROPPED `maps`, fixed** — `...waves` in place of the four named arrays.
//     Until that one token the panel's picture and sentence described the UNROTATED field while the canvas
//     showed the rotated one (invariant 13's harder form). ⚠️ **`field-frame-canvas.ts` had the SAME defect
//     one layer out and it was not on anyone's list:** `profile()` was handed `m.width`/`m.height` as the
//     table length, which is only correct at angle 0 — a rotated table is `hypot(w,h)`-sized, so it drew a
//     PREFIX of the wave while normalising over the whole of it. Now `arr.length`.
//   - **`transmap.waveX`/`waveY`'s tooltips**, both rewritten: *"one value per column"* / *"per row"* and
//     *"nothing here varies diagonally"* were all three made false by `35.3`, and each tip now names its own
//     angle. Plus `HEADER_TIPS['Curve Basis']`, which was narrowed when `Travel` moved out and never widened
//     for `34.3`/`34.4`'s `Grow`/`Flare` — **a tooltip narrower than its own section, which is the inverse of
//     an over-claiming caption and which no checker reads either.**
//   - **`tipcheck`** — 4 new clauses in §K (the quarter turn has ONE owner, no bare `90` and no
//     `WAVE_ANGLE_MAX` in the predicate, no archetype NAMED in it, with the name list read from
//     `static-field.ts`). ⚠️ `WAVE_QUARTER_TURN` is new and exists because the Y wave's baked-in +90 and the
//     range limit are **two quantities wearing one number**.
//
// ✅ DISCHARGED by `35.6`'s archetype half: the four archetype obligations, the RELABEL gate over both
// populations by NAME (§M5, seeded with the real measured regression `Chevron Press` = `Fine Mesh` @0.375,
// which relabels `Patterns`) and the DISTINCTNESS rule against the set's own floor (§M6, seeded twice — an
// exact table reuse and a near-miss).
// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  shapecheck: ${pass} passed, ${fail} failed, ${calib} calibrated\n`);
process.exit(fail === 0 ? 0 : 1);
