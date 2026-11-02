#!/usr/bin/env node
/**
 * reelcheck — v8 19.1/19.2. A Reel is an ordered set of preset NAMES, a schedule, and a transition; every one
 * of those three is arithmetic or bookkeeping, and every defect in them is silent.
 *
 * ⚠️ **WHY THIS CHECKER EXISTS AT ALL, STATED AS THE FAILURES IT PREVENTS.** Five of them, and not one is
 * visible to `tsc`, to a browser pass on one preset, or to any of the other thirteen checkers:
 *
 * 1. **A transition that does not release to its identity.** `outputGain` and `freezeWeight` are the two
 *    channels a reel gates the whole pipeline through. A gate that releases to 0.008 instead of 0 leaves a
 *    ghost of the previous figure on screen forever, at an intensity no one can name — `CLAUDE.md` invariant 21
 *    calls this the guard that hides its own trip. A gate that overshoots past 1 flashes. Both are `number`s.
 * 2. **A corner in a brightness ramp.** A linear cross-fade is the implementation anyone would write, it is
 *    correct at every sampled value, and it reads to the user as a "click" at each end of every transition.
 *    Only the DERIVATIVE at the segment endpoints can tell the two apart, so §C measures it.
 * 3. **`localStorage` persisting the MERGED view instead of the user's own reels.** This is the most expensive
 *    defect in the phase and the least visible: it freezes the built-in reels at whatever the first run of the
 *    first build wrote, so a later build that fixes a preset name inside `Grand Tour` ships that fix to new
 *    users only, and every user who ever opened the tab keeps the broken copy with no way to find out. §H
 *    parses what the persistence port actually received and asserts no built-in name is in it.
 * 4. **A typo in a built-in reel's preset list.** `resolveReel` drops an unknown name into `skipped` by design,
 *    so a typo is not an error at runtime — the reel simply plays shorter, which reads as "this build has fewer
 *    presets". §J is the only instrument in the project that can see one.
 * 5. **A deployment reel file the engine will not read, or read from the wrong source** (19.11). Everything about
 *    `psss_reels.json` fails quietly: a file the shape test refuses, a file name that disagrees with the
 *    `<script>` tag the packer writes, a second call site that re-resolves the two sources, or a deployment main
 *    reel frozen into `localStorage` by the first run. Every one of them leaves a page that opens and plays — the
 *    built-in reels, or last month's answer. §K is the only instrument for the lot.
 *
 * ⚠️ **THIS CHECKER MEASURES; IT DOES NOT GREP.** It imports the two real modules and drives them: the
 * transition is sampled densely across its whole domain including outside it, the cursor is driven with a seeded
 * LCG over thousands of decks, and the store is driven through an in-memory `ReelPersistence` port. The text-scan
 * clauses are §B's and §K's, and they are text scans for the SAME reason — a value that exists twice with no
 * compiler between the copies, where one copy cannot be imported: a module-private `const` (§B) and
 * `vite.config.ts`'s `REELS_FILE`, which cannot import from `src/` without dragging the UI graph into Vite's own
 * config resolution (§K). Every one of those clauses asserts that its regex matched SOMETHING, because `CLAUDE.md`
 * records two occasions where an anchor matched nothing and so asserted nothing forever.
 *
 * ⚠️ **EVERY MEASURED PROPERTY IS SEEDED, AND THE SEEDS ARE THE DESIGNS THAT WOULD ACTUALLY BE WRITTEN**, not
 * invented strawmen: a linear ramp, a `>` where `>=` belongs, a ramp normalised by the neighbouring segment's
 * length, a `random` mode that samples with replacement, an adjacent-repeat guard reading `d[0]` when the deck
 * is popped from the END, a validator that returns on the first problem, a per-FILE sanitiser, a discriminator
 * that accepts anything that parses, a store that persists its merged view, `onChange` as a slot rather than a
 * list, and a `mainReelName()` that returns the stored string unresolved. A seed that does not fail is reported
 * as **CALIBRATION FAIL** and exits non-zero exactly like a real failure, because an assertion that cannot fail
 * is worse than a missing one — it occupies the slot the real check would take.
 *
 * ⚠️ **THE BASIS IS PRINTED AT RUN TIME AND IS NEVER QUOTED IN PROSE HERE.** A checker only knows what it was
 * pointed at: this one is pointed at `src/exploration/reel-model.ts`, `src/presets/reel-store.ts`, the
 * `MATH_WARM_FRAMES` literal in `src/ui/preview-grid/grid-tile-renderer.ts`, for §G and §J the whole
 * preset library, collected the way `composercheck` collects it (the legacy JSON through its assignment-prefix
 * slice, plus the seven TS groups), and for §K `vite.config.ts` plus every `.ts` file under `src/` (a call-site
 * count, which is why that one clause walks the tree instead of naming a file). It is pointed at NO DOM and NO
 * GL, which is why both reel modules were written import-free and DOM-free; see `reel-model.ts`'s own header.
 *
 * ⚠️ **IT IS POINTED AT NEITHER `dist/` NOR `scripts/export-library.mjs`, AND THAT IS THE DIVISION OF LABOUR.**
 * `verify` runs without a build, so anything about the EMITTED files is asserted by the build itself — the exporter
 * checks its own two artefacts against the composed library and against the `index.html` the packer wrote. §K
 * covers what is true before any build runs: the adopter, the shape test, the resolution order, and the two names.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * ⚠️ **THE IMPORT IS GUARDED AND THE GUARD IS NOT DEFENSIVENESS — IT IS THE ONE FAILURE THIS FILE CANNOT REPORT
 * ANY OTHER WAY.** Node runs `.ts` in STRIP-ONLY mode: it deletes type syntax and never emits code, so a
 * construct that needs emit — a TS parameter property, an `enum`, a `namespace` — throws at load with a stack
 * that names Node's own internals and no clause of this file. `tsc` accepts all three, so this whole class is
 * invisible to `verify`'s first gate and visible only here. A bare crash would read as "the checker is broken";
 * the diagnosis below is measured from the two files' own text so it reads as what it is.
 */
const MODEL_PATH = '../src/exploration/reel-model.ts';
const STORE_PATH = '../src/presets/reel-store.ts';
let MODEL, STORE;
try {
  MODEL = await import(MODEL_PATH);
  STORE = await import(STORE_PATH);
} catch (err) {
  const files = ['src/exploration/reel-model.ts', 'src/presets/reel-store.ts'];
  console.log('\nreelcheck — CANNOT REACH ITS SUBJECT. Nothing below ran.\n');
  console.log(`  ${err.constructor.name}: ${String(err.message).split('\n')[0]}\n`);
  console.log('  Measured causes, from the two files\' own text:');
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    // A TS parameter property: an access modifier or `readonly` in a constructor's parameter list. Needs EMIT,
    // so `tsc` is happy and Node's strip-only loader is not.
    const paramProps = [...text.matchAll(/constructor\s*\(([^)]*)\)/g)]
      .flatMap((m) => [...m[1].matchAll(/(?:private|public|protected|readonly)\s+[A-Za-z_$][\w$]*\s*[:=]/g)].map((p) => p[0]));
    // A `*/` that is not a comment terminator ends the block comment early and turns the prose after it into
    // code. This is `CLAUDE.md` invariant 18 one medium along — there, a backtick in a GLSL comment ends a
    // template literal. **The signature is content AFTER the `*/` on a line that never opened a comment**: a
    // normal close has nothing after it and a one-line `/** … */` contains its own opener, so neither is flagged.
    // A looser test — every line containing `*/` — reports most of a well-commented file and so reports nothing.
    const strayEnds = text.split(/\r?\n/)
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => !l.includes('/*') && /\*\/\s*\S/.test(l));
    console.log(`    ${f}: ${paramProps.length} TS parameter propert${paramProps.length === 1 ? 'y' : 'ies'}`
      + `${paramProps.length ? ` (${paramProps.join(', ')})` : ''}, `
      + `${strayEnds.length} stray \`*/\` inside a comment`
      + `${strayEnds.length ? ` (line${strayEnds.length === 1 ? '' : 's'} ${strayEnds.map(([n]) => n).join(', ')})` : ''}`);
  }
  console.log('\n  A parameter property must be desugared to an explicit field + assignment; a stray `*/` must be\n'
    + '  reworded out of the comment. Both are edits under src/ and this checker does not make them.\n');
  console.log('FAIL  reelcheck: 0 passed, 1 failed (subject unreachable)\n');
  process.exit(1);
}

const {
  // constants
  REEL_TRANSITION_TOTAL_MS, REEL_APPLY_AT_MS, REEL_WARM_FRAMES, REEL_WARM_MS,
  BLACK_FADE_OUT_MS, BLACK_HOLD_MS, BLACK_FADE_IN_MS, FADE_PLATEAU_MS, FADE_RAMP_MS,
  REEL_MIN_SECONDS, REEL_MAX_SECONDS, REEL_DEFAULT_SECONDS, REEL_MAX_NAME_LENGTH, REEL_FILE_VERSION,
  REEL_DEFAULT_PLAY_MODE, REEL_DEFAULT_TRANSITION, REEL_TRANSITION_LABELS, REEL_PLAY_MODE_LABELS,
  TRANSITION_IDENTITY,
  // behaviour
  transitionMix, ReelCursor, resolveReel, passSeconds, validateReel, sameReelName,
  sanitiseReel, serialiseReelFile, parseReelFile, looksLikeReelFile, sanitiseReelFile,
} = MODEL;
const {
  BUILT_IN_REELS, ReelStore, REEL_LIBRARY_KEY, REEL_STORAGE_KEY, extractDeploymentReels,
  REEL_DEPLOYMENT_FILE, REEL_DEPLOYMENT_GLOBAL,
} = STORE;
const { MigrationLayer } = await import('../src/presets/migration.ts');
// §J only: the COMPOSED library, for preset BODIES. A second basis — see §J's header for why it is not the
// name union above, and why the clause there asserts the two agree instead of assuming it.
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL, or the property it calibrates is decorative.** `seed` runs a
 * broken oracle — or the real oracle over a broken implementation — and asserts it produces at least one
 * violation. A seed that passes is a CALIBRATION FAIL and exits non-zero exactly like a real failure: the
 * checker is claiming it cannot see the thing it was written to see.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violations)` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};

// ---------------------------------------------------------------------------------------------------
// The preset library, collected by IMPORTING the modules — §G's discriminator corpus and §J's name set.
// ⚠️ `public/psss_presets.json` is NOT plain JSON: it opens `g_psss_presets={`, so `JSON.parse` throws until the
// assignment prefix is sliced off and a trailing `;` stripped. This is the same slice `composercheck` uses and
// the reason §G can test the reel/preset discriminator against the ACTUAL thing it has to tell reels apart from.
// ---------------------------------------------------------------------------------------------------
const rawJson = readFileSync(join(ROOT, 'public', 'psss_presets.json'), 'utf8');
const LEGACY = JSON.parse(rawJson.slice(rawJson.indexOf('{')).replace(/;\s*$/, ''));
const LEGACY_NAMES = new Set(Object.keys(LEGACY));
const TS_GROUPS = [
  ['../src/presets/refined-presets.ts', 'REFINED_PRESETS'],
  ['../src/presets/demo-presets.ts', 'DEMO_PRESETS'],
  ['../src/presets/fire-presets.ts', 'FIRE_PRESETS'],
  ['../src/presets/flow-presets.ts', 'FLOW_PRESETS'],
  ['../src/presets/showcase-presets.ts', 'SHOWCASE_PRESETS'],
  ['../src/presets/variant-presets.ts', 'VARIANT_PRESETS'],
  ['../src/presets/chain-presets.ts', 'CHAIN_PRESETS'],
];
const LIBRARY_NAMES = new Set(LEGACY_NAMES);
const GROUP_COUNTS = {};
for (const [mod, key] of TS_GROUPS) {
  const group = (await import(mod))[key];
  let n = 0;
  // ⚠️ `variant-presets.ts` NESTS its preset under a `.preset` key while the other six do not, and
  // `MATERIAL_PRESETS` taught the same lesson from the other direction (an ARRAY, not a keyed object). Both
  // shapes are handled rather than assumed — a naive walk scores the nested group 0 and §J then under-reports.
  for (const entry of (Array.isArray(group) ? group : Object.values(group))) {
    const p = entry?.preset ?? entry;
    if (p?.metadata?.name) { LIBRARY_NAMES.add(p.metadata.name); n++; }
  }
  GROUP_COUNTS[key] = n;
}

const TOTAL = REEL_TRANSITION_TOTAL_MS;
const APPLY = REEL_APPLY_AT_MS;
const MODES = Object.keys(TOTAL);
const SAMPLE_STEP = 5;
/** Every sampled instant for one transition: 50 ms of overshoot at BOTH ends, because a caller can produce both. */
const samplesFor = (tr) => {
  const out = [];
  for (let t = -50; t <= TOTAL[tr] + 50; t += SAMPLE_STEP) out.push(t);
  return out;
};
const SAMPLE_COUNT = MODES.reduce((n, tr) => n + samplesFor(tr).length, 0);
const REEL_PRESET_REFS = BUILT_IN_REELS.flatMap((r) => r.presets);

console.log(`\nreelcheck — basis: ${Object.keys(MODEL).length} model exports + ${Object.keys(STORE).length} store `
  + `exports; ${MODES.length} transitions (${MODES.map((m) => `${m} ${TOTAL[m]}ms`).join(', ')}) sampled at `
  + `${SAMPLE_COUNT} instants ${SAMPLE_STEP}ms apart; ${BUILT_IN_REELS.length} built-in reels naming `
  + `${REEL_PRESET_REFS.length} presets (${new Set(REEL_PRESET_REFS).size} distinct); library name set `
  + `${LIBRARY_NAMES.size} (legacy JSON ${LEGACY_NAMES.size} + ${TS_GROUPS.length} TS groups `
  + `${Object.values(GROUP_COUNTS).join('/')})\n`);

// ===================================================================================================
console.log('§A — the transition constants COHERE, recomputed from their parts and never restated');
// ===================================================================================================
/*
 * ⚠️ **EVERY FIGURE HERE IS DERIVED, SO EVERY ASSERTION RECOMPUTES IT.** `CLAUDE.md`'s first rule about figures
 * is that arithmetic on a quoted one is how they drift; a clause that wrote `=== 1900` would go stale silently
 * the moment a segment moved, and the stale clause is worse than no clause because it reads as coverage. The
 * only literals below are the STRUCTURE of each sum (which segments belong to which mode), which is the thing
 * being asserted.
 */
chk('`black`\'s total is exactly fade-out + hold + fade-in',
  TOTAL.black === BLACK_FADE_OUT_MS + BLACK_HOLD_MS + BLACK_FADE_IN_MS,
  `${TOTAL.black} = ${BLACK_FADE_OUT_MS} + ${BLACK_HOLD_MS} + ${BLACK_FADE_IN_MS}`);
chk('`fade`\'s total is exactly plateau + ramp',
  TOTAL.fade === FADE_PLATEAU_MS + FADE_RAMP_MS,
  `${TOTAL.fade} = ${FADE_PLATEAU_MS} + ${FADE_RAMP_MS}`);
seed('a total that forgets the hold — the segment with no visible motion, so the easiest one to drop',
  (BLACK_FADE_OUT_MS + BLACK_FADE_IN_MS === TOTAL.black ? 0 : 1)
  + (FADE_RAMP_MS === TOTAL.fade ? 0 : 1),
  'if a hold were 0 the sum would be insensitive to it and this pair of clauses would assert nothing');

// ⚠️ **THE APPLY INSTANT IS A CORRECTNESS BOUNDARY FOR `black`, NOT A TUNING VALUE** — `applyPresetChange`
// clears both trail buffers, so it must land where the presented image is exactly 0. An instant outside the
// transition means the switch happens with the gate already released, i.e. on screen.
let applyBad = 0;
for (const tr of MODES) if (!(APPLY[tr] >= 0 && APPLY[tr] <= TOTAL[tr])) applyBad++;
chk('`REEL_APPLY_AT_MS` lies inside [0, total] for every transition', applyBad === 0,
  MODES.map((tr) => `${tr} ${APPLY[tr]}/${TOTAL[tr]}`).join(', '));
seed('an apply instant past the end of its own transition',
  MODES.filter((tr) => !(TOTAL[tr] + 1 >= 0 && TOTAL[tr] + 1 <= TOTAL[tr])).length,
  'if the range test were written the other way round it would accept an instant outside the transition');

// ⚠️ **`black`'s apply instant must be the fade-out's END and not a value near it**, because that is the one
// instant where `outputGain` is exactly 0 — §C measures the channel there, this pins the arithmetic.
chk('...and `black` applies exactly at the bottom of its fade, while `fade` applies at t = 0',
  APPLY.black === BLACK_FADE_OUT_MS && APPLY.fade === 0,
  'the apply is a visible hard teardown, so for `black` it must be where the image is 0 and for `fade` it must '
  + 'be under the captured image');

chk('the play-time bounds are ordered min < default < max',
  REEL_MIN_SECONDS < REEL_DEFAULT_SECONDS && REEL_DEFAULT_SECONDS < REEL_MAX_SECONDS,
  `${REEL_MIN_SECONDS} < ${REEL_DEFAULT_SECONDS} < ${REEL_MAX_SECONDS}`);
seed('a default outside its own bounds — the shape a bound change leaves behind',
  [REEL_MIN_SECONDS - 1, REEL_MAX_SECONDS + 1].filter((d) => !(REEL_MIN_SECONDS < d && d < REEL_MAX_SECONDS)).length,
  'if the ordering test were vacuous a default could sit outside the range the UI clamps to');

/*
 * ⚠️ **THE HOLD FLOOR IS COUPLED TO THE LONGEST TRANSITION AND NOTHING BUT A COMMENT ENFORCES IT** — that
 * comment names §B as its owner, so the coupling is asserted here where both halves are in scope. Below the
 * floor a reel spends more time transitioning than showing a figure and reads as strobing rather than as a
 * sequence. The clause is `>=`, not the comment's "~2 s": the derivation is *the hold must at least cover the
 * longest transition*, and that is a quantity, not a taste.
 */
const longest = Math.max(...MODES.map((tr) => TOTAL[tr]));
chk('the minimum hold at least covers the LONGEST transition (the derivation the floor comes from)',
  REEL_MIN_SECONDS * 1000 >= longest,
  `floor ${REEL_MIN_SECONDS * 1000}ms against the longest transition ${longest}ms — margin ${REEL_MIN_SECONDS * 1000 - longest}ms`);

// ⚠️ **THE THREE `Record<Union, …>` TABLES ARE THE `tsc`-ENFORCED ENUMERATION SITES, and their agreement is
// not** — `tsc` proves each table total over the union but nothing compares the tables to each other, so a
// third transition added to two of the three compiles.
const keyLists = { TOTAL_MS: Object.keys(TOTAL), APPLY_AT: Object.keys(APPLY), LABELS: Object.keys(REEL_TRANSITION_LABELS) };
chk('the three per-transition tables enumerate the SAME members (`tsc` proves each total, not their agreement)',
  Object.values(keyLists).every((k) => k.length === MODES.length && k.every((m) => MODES.includes(m)))
  && Object.keys(REEL_PLAY_MODE_LABELS).length === 2,
  Object.entries(keyLists).map(([k, v]) => `${k} [${v.join('|')}]`).join(' '));
chk('the defaults are members of their own unions, and a label is never the stored word verbatim',
  MODES.includes(REEL_DEFAULT_TRANSITION) && Object.keys(REEL_PLAY_MODE_LABELS).includes(REEL_DEFAULT_PLAY_MODE)
  && MODES.every((m) => REEL_TRANSITION_LABELS[m] !== m),
  `default ${REEL_DEFAULT_TRANSITION}/${REEL_DEFAULT_PLAY_MODE}; labels `
  + `${MODES.map((m) => `${m}→"${REEL_TRANSITION_LABELS[m]}"`).join(', ')} — as bare words "Black"/"Fade" read as `
  + 'two intensities when the difference is whether both figures are ever on screen together');

// ===================================================================================================
console.log('\n§B — the warm window exists TWICE with no compiler between the copies');
// ===================================================================================================
/*
 * ⚠️ **THIS IS THE ONE TEXT-SCAN CLAUSE IN THE FILE AND IT HAS NO ALTERNATIVE.** `MATH_WARM_FRAMES` is a
 * module-private `const` in `grid-tile-renderer.ts` and is not exported; importing that module would drag a
 * renderer — and therefore a GL context — into a checker that must run under Node, which is the entire reason
 * `reel-model.ts` was written with zero imports. So the figure is read out of the source as text.
 *
 * ⚠️ **AND THE REGEX MUST BE ASSERTED TO HAVE MATCHED.** `CLAUDE.md` records two occasions where a
 * `braceBody`-style anchor matched nothing and therefore asserted nothing forever, always while reporting PASS.
 * An absence-shaped or comparison-shaped clause over an empty extraction is the same failure, so the match is
 * a clause of its own and the seed below is the anchor miss itself.
 */
const gridSrc = readFileSync(join(ROOT, 'src/ui/preview-grid/grid-tile-renderer.ts'), 'utf8');
const WARM_RE = /^const MATH_WARM_FRAMES\s*=\s*(\d+);/m;
const warmMatch = WARM_RE.exec(gridSrc);
chk('the `MATH_WARM_FRAMES` literal was actually FOUND in grid-tile-renderer.ts (the anchor asserts itself)',
  warmMatch !== null,
  warmMatch ? `matched "${warmMatch[0]}"` : 'the regex matched nothing — every clause below it would assert nothing');
const oracleWarm = (src) => {
  const m = WARM_RE.exec(src);
  if (m === null) return 1;                                   // an anchor miss is a VIOLATION, never silence
  return Number(m[1]) === REEL_WARM_FRAMES ? 0 : 1;
};
chk('`REEL_WARM_FRAMES` equals the renderer\'s own `MATH_WARM_FRAMES` — the second copy of one figure',
  oracleWarm(gridSrc) === 0,
  `model ${REEL_WARM_FRAMES} against renderer ${warmMatch ? warmMatch[1] : '(not found)'}`);
seed('the renderer\'s constant renamed, so the anchor matches nothing',
  oracleWarm(gridSrc.replace(/MATH_WARM_FRAMES/g, 'MATH_WARMUP_FRAMES')),
  'an anchor that matches nothing must report a VIOLATION — if it reported silence this clause would pass forever');
seed('the two copies drifting apart by one frame',
  oracleWarm(gridSrc.replace(WARM_RE, `const MATH_WARM_FRAMES = ${REEL_WARM_FRAMES + 1};`)),
  'if the comparison were not on the extracted number, a drift between the copies would be invisible');

/*
 * ⚠️ **THE UNIT CONVERSION IS THE PART THAT IS INVISIBLE IN THE RESULT (invariant 10): `tsc` sees frames and
 * milliseconds as the same `number`.** The floor is the wall clock those frames take at 60 fps — a ms figure
 * below it under-covers the warm window on a machine that is keeping up, which is the one case that must never
 * happen. The model converts at a deliberately pessimistic 50 fps, so the equality is asserted too: it is the
 * stated derivation, and asserting only the floor would let a 60 fps conversion in silently.
 */
const msAt = (fps) => (REEL_WARM_FRAMES / fps) * 1000;
chk('`REEL_WARM_MS` is at least the wall clock the frame count implies at 60 fps',
  REEL_WARM_MS >= msAt(60),
  `${REEL_WARM_MS}ms against ${msAt(60).toFixed(1)}ms for ${REEL_WARM_FRAMES} frames at 60 fps`);
chk('...and equals the documented pessimistic 50 fps conversion exactly',
  REEL_WARM_MS === msAt(50),
  `${REEL_WARM_MS}ms = ${REEL_WARM_FRAMES}/50 s; below 50 fps the plateau under-covers the warm window and `
  + 'the incoming figure is briefly visible while it settles — accepted, because PerfGuard has already tripped');
seed('the conversion done at 120 fps, i.e. a plateau shorter than the warm window it exists to cover',
  msAt(120) >= msAt(60) ? 0 : 1,
  'if the 60 fps floor were not the comparison, an optimistic frame-rate assumption would pass');

// ⚠️ **BOTH HOLDS ARE THE WARM WINDOW, and that is the whole reason the constant exists.** An earlier design
// held black for ~120 ms and let the fade-in cover the warm-up; that reveals the incoming preset filling in
// from an empty trail, which reads as a rendering fault rather than as a transition.
chk('both modes hold for exactly the warm window — the plateau IS the warm-up cover',
  BLACK_HOLD_MS === REEL_WARM_MS && FADE_PLATEAU_MS === REEL_WARM_MS,
  `black hold ${BLACK_HOLD_MS}, fade plateau ${FADE_PLATEAU_MS}, warm ${REEL_WARM_MS}`);

// ===================================================================================================
console.log('\n§C — `transitionMix` MEASURED across its whole domain, including outside it');
// ===================================================================================================
/*
 * ⚠️ **A LITERAL RE-IMPLEMENTATION OF THE MIX LIVES BELOW, DELIBERATELY, AND ONLY THE SEEDS CALL IT.** Every
 * assertion in this section is an oracle taking a mix FUNCTION; the clause runs the oracle over the real
 * `transitionMix` and the seed runs the SAME oracle over a variant with one design decision reversed. That is
 * what makes a seed a calibration rather than a second opinion: if the oracle cannot see the variant, the clause
 * it calibrates is measuring nothing.
 *
 * ⚠️ **`o.unclamped` DROPS THE `e >= total` EARLY RETURN AS WELL AS `clamp01`, AND IT HAS TO DROP BOTH.** With
 * `clamp01` inside the ease, an overshooting argument is already pinned to 1 — so a seed that only removed the
 * early return would produce the correct answer and report CALIBRATION FAIL while the defect it names is
 * perfectly real. The clamp and the early return are two guards over one hazard; the seed removes the hazard's
 * cover, not one of the two covers.
 */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
const easeRaw = (u) => u * u * (3 - 2 * u);
const mixSeeded = (tr, ms, o = {}) => {
  const total = TOTAL[tr];
  const e = ms < 0 ? 0 : ms;
  const applied = o.strictApplied ? e > APPLY[tr] : e >= APPLY[tr];
  const curve = o.linear ? clamp01 : (o.unclamped ? easeRaw : ease);
  if (!o.unclamped && e >= total) return { outputGain: 1, freezeWeight: 0, applied: true, done: true };
  if (tr === 'black') {
    let g;
    if (e < BLACK_FADE_OUT_MS) g = 1 - curve(e / BLACK_FADE_OUT_MS);
    else if (e < BLACK_FADE_OUT_MS + BLACK_HOLD_MS) g = 0;
    else g = curve((e - BLACK_FADE_OUT_MS - BLACK_HOLD_MS) / (o.wrongLen ? BLACK_FADE_OUT_MS : BLACK_FADE_IN_MS));
    return { outputGain: g, freezeWeight: o.bothChannels ? 1 - g : 0, applied, done: e >= total };
  }
  const f = e < FADE_PLATEAU_MS
    ? 1
    : 1 - curve((e - FADE_PLATEAU_MS) / (o.wrongLen ? FADE_PLATEAU_MS : FADE_RAMP_MS));
  return { outputGain: o.bothChannels ? f : 1, freezeWeight: f, applied, done: e >= total };
};
const variant = (o) => (tr, ms) => mixSeeded(tr, ms, o);

/** The channel each mode drives, and the one that must not move. Each mode moves exactly ONE. */
const DRIVEN = { black: 'outputGain', fade: 'freezeWeight' };
const FROZEN_AT = { outputGain: 1, freezeWeight: 0 };
/**
 * The segment table, derived from the same constants §A recomputes. The `to` of a ramp is the value at its
 * CLOSING instant, which for the last segment is produced by the `e >= total` branch rather than by the ease —
 * so these endpoints also pin the two branches agreeing at their seam.
 */
const SEGMENTS = {
  black: [
    { name: 'fade-out', t0: 0, t1: BLACK_FADE_OUT_MS, from: 1, to: 0, ramp: true },
    { name: 'hold at black', t0: BLACK_FADE_OUT_MS, t1: BLACK_FADE_OUT_MS + BLACK_HOLD_MS, from: 0, to: 0, ramp: false },
    { name: 'fade-in', t0: BLACK_FADE_OUT_MS + BLACK_HOLD_MS, t1: TOTAL.black, from: 0, to: 1, ramp: true },
  ],
  fade: [
    { name: 'plateau at full weight', t0: 0, t1: FADE_PLATEAU_MS, from: 1, to: 1, ramp: false },
    { name: 'ramp away', t0: FADE_PLATEAU_MS, t1: TOTAL.fade, from: 1, to: 0, ramp: true },
  ],
};
const RAMPS = MODES.flatMap((tr) => SEGMENTS[tr].filter((s) => s.ramp).map((s) => ({ tr, ...s })));

/*
 * ⚠️ **WHICH END IS THE IDENTITY IS NOT SYMMETRIC, AND THE FILE'S OWN COMMENT OVERSTATES IT.** `transitionMix`
 * says values before 0 and after the total are "clamped to the identity at both ends". Measured: only the FAR
 * end is the identity in all four fields. At the near end the function clamps `elapsedMs` to 0 and returns the
 * mix AT 0 — which for `black` happens to be the identity in both channels but reports `applied: false`, and for
 * `fade` is `freezeWeight: 1`, the frozen image at FULL weight, the opposite of the identity. That is correct
 * behaviour (a negative elapsed time means the transition has not started, and `fade` begins at full weight),
 * but a clause asserting the comment would fail on correct code — which is why the near end is asserted as an
 * IDEMPOTENT CLAMP and the far end as the identity, and each says which end it is.
 */
const oFarIdentity = (mix) => {
  let bad = 0;
  for (const tr of MODES) for (const t of samplesFor(tr)) {
    if (t < TOTAL[tr]) continue;
    const m = mix(tr, t);
    if (m.outputGain !== TRANSITION_IDENTITY.outputGain || m.freezeWeight !== TRANSITION_IDENTITY.freezeWeight
      || m.applied !== true || m.done !== true) bad++;
  }
  return bad;
};
chk('FAR END: at and after the total, the mix is byte-identical to `TRANSITION_IDENTITY` — the ungated pipeline',
  oFarIdentity(transitionMix) === 0,
  'a gate that releases to NEAR its identity is invariant 21\'s hidden trip: a residual frozen image at a '
  + 'weight nobody can name, or a gain above 1 that flashes');
seed('an ease with no `clamp01` and no far-end early return, so an overshooting caller never gets the identity',
  oFarIdentity(variant({ unclamped: true })),
  'if the far end were asserted only loosely, a release to 0.008 would pass and the ghost would be permanent');

const oNearClamp = (mix) => {
  let bad = 0;
  for (const tr of MODES) {
    const at0 = mix(tr, 0);
    for (const t of samplesFor(tr)) {
      if (t >= 0) continue;
      const m = mix(tr, t);
      if (m.outputGain !== at0.outputGain || m.freezeWeight !== at0.freezeWeight
        || m.applied !== at0.applied || m.done !== at0.done) bad++;
    }
  }
  return bad;
};
chk('NEAR END: every instant before 0 returns exactly the mix AT 0 — an idempotent clamp, not an identity',
  oNearClamp(transitionMix) === 0,
  `at t=0 \`black\` is ${JSON.stringify(transitionMix('black', 0))} and \`fade\` is `
  + `${JSON.stringify(transitionMix('fade', 0))} — so the doc's "identity at both ends" is true of the FAR end `
  + 'only; `fade` opens holding the captured image at full weight, which is what covers the apply at t=0');

const oOneChannel = (mix) => {
  let bad = 0;
  for (const tr of MODES) {
    const frozen = DRIVEN[tr] === 'outputGain' ? 'freezeWeight' : 'outputGain';
    for (const t of samplesFor(tr)) if (mix(tr, t)[frozen] !== FROZEN_AT[frozen]) bad++;
  }
  return bad;
};
chk('each mode moves exactly ONE channel and leaves the other at its identity everywhere',
  oOneChannel(transitionMix) === 0,
  `black drives ${DRIVEN.black} with freezeWeight pinned at 0; fade drives ${DRIVEN.fade} with outputGain `
  + 'pinned at 1 — a mode moving both means the two mechanisms are fighting and the result is a double dip');
seed('a `black` that also cross-fades and a `fade` that also dims — two mechanisms on one transition',
  oOneChannel(variant({ bothChannels: true })),
  'if the untouched channel were not asserted at its identity, a second mechanism could ride along unnoticed');

const oRange = (mix) => {
  let bad = 0;
  for (const tr of MODES) for (const t of samplesFor(tr)) {
    const m = mix(tr, t);
    for (const v of [m.outputGain, m.freezeWeight]) if (!Number.isFinite(v) || v < 0 || v > 1) bad++;
  }
  return bad;
};
chk('both channels are finite and inside [0, 1] at every sampled instant, inside the domain and outside it',
  oRange(transitionMix) === 0,
  `${SAMPLE_COUNT} instants across both modes, from -50ms to total+50ms`);
// ⚠️ **THIS SEED NEEDS BOTH DEFECTS AT ONCE AND THAT IS THE FINDING, NOT A CONCESSION.** The ease is
// `u²(3−2u)`, which stays inside [0,1] until its argument passes 1.5 — so an unclamped ramp alone overshoots by
// under 2 % across the reachable domain and the range clause cannot see it (the FAR-END clause is what catches
// that one). Push the argument past 1.5 by ALSO dividing by the wrong segment length and the gain goes NEGATIVE,
// which on the `black` path is a gate that inverts. Leaving [0,1] is therefore reachable, which is what makes
// the range clause a measurement rather than a restatement of the ease's algebra.
seed('an unclamped ease whose argument is also over-driven, i.e. a gate that goes NEGATIVE',
  oRange(variant({ unclamped: true, wrongLen: true })),
  'if the range clause were dropped as "guaranteed by the ease", a divisor change would ship an inverted gate');

const oApplied = (mix) => {
  let bad = 0;
  for (const tr of MODES) {
    let seenTrue = false;
    for (const t of samplesFor(tr)) {
      const got = mix(tr, t).applied;
      // ⚠️ The expectation is written against the CLAMPED time, because the function clamps: for `fade`, whose
      // apply instant is 0, this makes `applied` true even at a negative elapsed time. Writing the expectation
      // against the raw `t` would fail on correct code and read as a defect in the model.
      if (got !== (Math.max(0, t) >= APPLY[tr])) bad++;
      if (seenTrue && !got) bad++;                             // and it must never flip back
      if (got) seenTrue = true;
    }
  }
  return bad;
};
chk('`applied` is false strictly BEFORE the apply instant, true from it on, and never flips back',
  oApplied(transitionMix) === 0,
  'the incoming preset is applied once; a flag that flips back would re-apply mid-transition, and '
  + '`applyPresetChange` clears both trail buffers');
seed('`applied` computed with `>` instead of `>=` — a one-frame window where the switch has not happened',
  oApplied(variant({ strictApplied: true })),
  'if the boundary instant were not sampled exactly, the off-by-one would be unobservable');

const oDone = (mix) => {
  let bad = 0;
  for (const tr of MODES) for (const t of samplesFor(tr)) {
    if (mix(tr, t).done !== (Math.max(0, t) >= TOTAL[tr])) bad++;
  }
  return bad;
};
chk('`done` is true exactly at and after the total, and false everywhere before it',
  oDone(transitionMix) === 0, `boundary sampled exactly at ${MODES.map((tr) => TOTAL[tr]).join(' and ')}ms`);

/*
 * ⚠️ **THE SHAPE CLAUSES: ENDPOINTS, MONOTONICITY, AND THE MIDPOINT.** The midpoint is the one that pins the
 * NORMALISATION, and it is the reason it is here: a ramp divided by the neighbouring segment's length is still
 * monotonic, still inside [0,1], still exactly `from` and `to` at its endpoints, and still has zero derivative
 * at both ends — it just gets there early and then sits flat. Every other clause in this section passes on it.
 * What cannot survive is the ease's symmetry: `smoothstep(0.5) === 0.5`, so a correctly normalised ramp is at
 * exactly half its span at exactly its midpoint.
 */
const oSegments = (mix) => {
  let bad = 0;
  for (const tr of MODES) for (const s of SEGMENTS[tr]) {
    const f = (t) => mix(tr, t)[DRIVEN[tr]];
    if (f(s.t0) !== s.from || f(s.t1) !== s.to) bad++;
    const dir = Math.sign(s.to - s.from);
    let prev = f(s.t0);
    for (let t = s.t0 + 1; t <= s.t1; t++) {
      const v = f(t);
      if (s.ramp ? Math.sign(v - prev) !== dir : v !== s.from) bad++;
      prev = v;
    }
  }
  return bad;
};
chk('every segment starts and ends on its exact endpoint value, ramps STRICTLY monotone, plateaus constant',
  oSegments(transitionMix) === 0,
  MODES.map((tr) => `${tr}: ${SEGMENTS[tr].map((s) => `${s.name} ${s.t0}–${s.t1}ms ${s.from}→${s.to}`).join(', ')}`).join('  |  '));

const oMidpoint = (mix) => {
  let bad = 0;
  for (const r of RAMPS) {
    const mid = (r.t0 + r.t1) / 2;
    if (Math.abs(mix(r.tr, mid)[DRIVEN[r.tr]] - (r.from + r.to) / 2) > 1e-12) bad++;
  }
  return bad;
};
chk('each ramp is at exactly HALF its span at exactly its midpoint — the ease\'s symmetry, which pins the divisor',
  oMidpoint(transitionMix) === 0,
  RAMPS.map((r) => `${r.tr}/${r.name} @${(r.t0 + r.t1) / 2}ms = ${transitionMix(r.tr, (r.t0 + r.t1) / 2)[DRIVEN[r.tr]]}`).join(', '));
seed('a ramp normalised by the NEIGHBOURING segment\'s length — every other clause here passes on it',
  oMidpoint(variant({ wrongLen: true })),
  'a wrongly normalised ramp is monotone, in range, and zero-derivative at both ends; only the symmetry sees it');

/*
 * ⚠️ **THE ZERO DERIVATIVE IS THE REQUIREMENT, NOT THE SMOOTHNESS, AND IT IS THE ONLY THING THAT SEPARATES THE
 * SHIPPED EASE FROM THE RAMP ANYONE WOULD WRITE BY MISTAKE.** A linear ramp meeting a plateau has a corner;
 * every value along it is correct and the corner reads to the user as a distinct "click" in the fade. So the
 * per-frame delta is measured at both endpoints and at the midpoint, and the endpoints must be an order of
 * magnitude quieter. `d/du [u²(3−2u)] = 6u(1−u)`, which is 0 at 0 and at 1 and maximal at ½, so the ratio is
 * algebraically ~0 against ~1.5/span; the threshold below has three orders of magnitude of margin and a linear
 * ramp sits at exactly 1.0. **The margin is stated as a ratio, never as an absolute slope** — an absolute bound
 * would have to be re-derived every time a segment length changed.
 */
const SLOPE_H = 0.25;
const SLOPE_RATIO = 0.05;
const oEndpointSlope = (mix) => {
  let bad = 0;
  for (const r of RAMPS) {
    const f = (t) => mix(r.tr, t)[DRIVEN[r.tr]];
    const mid = (r.t0 + r.t1) / 2;
    const at0 = Math.abs(f(r.t0 + SLOPE_H) - f(r.t0)) / SLOPE_H;
    const at1 = Math.abs(f(r.t1) - f(r.t1 - SLOPE_H)) / SLOPE_H;
    const atMid = Math.abs(f(mid + SLOPE_H) - f(mid)) / SLOPE_H;
    if (!(atMid > 0) || at0 > atMid * SLOPE_RATIO || at1 > atMid * SLOPE_RATIO) bad++;
  }
  return bad;
};
chk('every ramp has a ZERO derivative at BOTH endpoints — no corner where a ramp meets a plateau',
  oEndpointSlope(transitionMix) === 0,
  RAMPS.map((r) => {
    const f = (t) => transitionMix(r.tr, t)[DRIVEN[r.tr]];
    const mid = (r.t0 + r.t1) / 2;
    const s = (a, b) => Math.abs(f(b) - f(a)) / SLOPE_H;
    return `${r.tr}/${r.name} ends ${s(r.t0, r.t0 + SLOPE_H).toExponential(1)}/`
      + `${s(r.t1 - SLOPE_H, r.t1).toExponential(1)} vs mid ${s(mid, mid + SLOPE_H).toExponential(1)}`;
  }).join('  '));
seed('a LINEAR ramp — the design that would actually be written, correct at every value and audible at both ends',
  oEndpointSlope(variant({ linear: true })),
  'a linear ramp has the SAME slope at its endpoints as at its midpoint, so if this oracle could not see it '
  + 'nothing in the project could, and the click would ship');

// ===================================================================================================
console.log('\n§D — `ReelCursor`, driven by a SEEDED LCG so every count below is reproducible');
// ===================================================================================================
/*
 * ⚠️ **A SCHEDULE WITH NO SEED DISCHARGES NOTHING** — `reel-model.ts` says so in the `Rng` type's own comment,
 * which is why the rng is injectable. The LCG is written out here rather than imported so that a change to the
 * engine cannot change what this section measured; the figures printed below are a function of this file alone.
 *
 * ⚠️ **`Math.random()` IS CORRECT IN THE SHIPPED DEFAULT and the distinction from invariant 12 is worth
 * restating: that invariant forbids `Math.random()` when RESEEDING A PARTICLE, because a per-particle random
 * offset destroys the spatial coherence the figure is made of. A schedule has no spatial structure to destroy.**
 */
const lcg = (s0) => { let s = s0 >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
const LAPS = 5;
const DECKS = 400;

let seqBad = 0, seqDraws = 0;
for (const n of COUNTS) {
  const c = new ReelCursor(n, 'sequential', lcg(0x5eed + n));
  for (let i = 0; i < n * LAPS; i++) { seqDraws++; if (c.next() !== i % n) seqBad++; }
}
chk(`\`sequential\` produces 0,1,…,n-1,0,… over ${LAPS} laps for every count 1…${COUNTS.at(-1)}`,
  seqBad === 0, `${seqDraws} draws, ${seqBad} out of order`);

chk('`current()` is -1 before the first `next()` and the last emitted index after it',
  (() => { const c = new ReelCursor(4, 'sequential', lcg(1)); if (c.current() !== -1) return false; const a = c.next(); return c.current() === a && a === 0; })(),
  'the runner reads `current()` to label what is playing; -1 is "nothing yet", not index 0');
chk('an EMPTY reel yields -1 rather than 0 — a resolved reel can be empty when every name went missing',
  new ReelCursor(0, 'sequential', lcg(2)).next() === -1 && new ReelCursor(0, 'random', lcg(2)).next() === -1,
  'index 0 of an empty order is `undefined`, which reaches the engine as a preset switch to nothing');

/**
 * Draw `DECKS` full decks and report the two properties as counts. Shared by the real cursor and by both seeds,
 * because a seed measured by a different oracle is a second opinion rather than a calibration.
 */
const deckStats = (draw, n, decks) => {
  const out = [];
  for (let i = 0; i < n * decks; i++) out.push(draw());
  let notPermutation = 0, adjacentRepeats = 0, boundaryRepeats = 0;
  for (let d = 0; d < decks; d++) {
    const block = out.slice(d * n, (d + 1) * n);
    if (new Set(block).size !== n || block.some((v) => v < 0 || v >= n)) notPermutation++;
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i] === out[i - 1]) { adjacentRepeats++; if (i % n === 0) boundaryRepeats++; }
  }
  return { notPermutation, adjacentRepeats, boundaryRepeats, draws: out.length };
};
let permBad = 0, adjBad = 0, totalDraws = 0, boundaries = 0;
for (const n of COUNTS) {
  const c = new ReelCursor(n, 'random', lcg(0xbeef + n));
  const st = deckStats(() => c.next(), n, DECKS);
  totalDraws += st.draws;
  permBad += st.notPermutation;
  if (n >= 2) { adjBad += st.adjacentRepeats; boundaries += DECKS - 1; }
}
chk(`\`random\` emits every index exactly once per deck — a permutation, never sampling with replacement`,
  permBad === 0,
  `${COUNTS.length * DECKS} decks, ${totalDraws} draws, ${permBad} decks that were not permutations — a `
  + 'per-step `Math.random()` would revisit some presets three times before touching others, which over a '
  + 'session reads as "the reel ignores half my picks"');
chk('...and no adjacent repeat ANYWHERE for count >= 2, deck boundaries included',
  adjBad === 0,
  `${boundaries} deck boundaries crossed at counts 2…${COUNTS.at(-1)}, ${adjBad} repeats`);

/*
 * ⚠️ **THE EXCEPTION AT `count === 1` IS ASSERTED, NOT SWEPT OVER.** One preset can only follow itself, so the
 * no-adjacent-repeat property is UNSATISFIABLE there — **a checker that swept the property from 1 would fail
 * against correct code**, which is why the sweep above starts at 2 and why the exception has a clause of its
 * own. `reel-model.ts` names this in `ReelCursor`'s own header.
 */
const one = new ReelCursor(1, 'random', lcg(7));
const oneDraws = Array.from({ length: 6 }, () => one.next());
chk('at count 1 the no-repeat property is UNSATISFIABLE and the cursor repeats — asserted, not swept over',
  oneDraws.every((v) => v === 0),
  `drew ${oneDraws.join(',')} — a clause asserting no adjacent repeat at count 1 would FAIL on correct code, `
  + 'so the sweep above is bounded at 2 and this clause owns the boundary');

// ⚠️ **SEED ONE: `random` as sampling with replacement.** The obvious implementation, and the one whose defect
// is statistical rather than functional — it never crashes and never repeats *visibly* on a short session.
seed('a `random` mode that samples with replacement instead of dealing a deck',
  (() => {
    const r = lcg(0xbeef);
    let bad = 0;
    for (const n of COUNTS) bad += deckStats(() => Math.floor(r() * n), n, DECKS).notPermutation;
    return bad;
  })(),
  'if the permutation clause were only a range test, sampling with replacement would pass it');

/*
 * ⚠️ **SEED TWO: THE GUARD ON THE WRONG END OF THE DECK, WHICH IS WHAT `refillDeck`'s OWN COMMENT WARNS
 * ABOUT.** The deck is POPPED, so the element that plays next is `d[d.length - 1]`; a guard inspecting `d[0]`
 * protects the slot that plays LAST and then reads as working — the repeat still happens, once per pass, which
 * is rare enough to look like chance. Shipped Fisher-Yates, shipped pop order, guard moved one index.
 */
seed('the adjacent-repeat guard reading `d[0]` when the deck is popped from the END',
  (() => {
    let bad = 0;
    for (const n of COUNTS) {
      if (n < 2) continue;
      const rng = lcg(0xbeef + n);
      let deck = [], last = -1;
      const draw = () => {
        if (deck.length === 0) {
          const d = []; for (let i = 0; i < n; i++) d.push(i);
          for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const a = d[i]; d[i] = d[j]; d[j] = a; }
          const first = d[0];                                   // the WRONG end
          if (d.length > 1 && first === last) { const sw = 1 + Math.floor(rng() * (d.length - 1)); d[0] = d[sw]; d[sw] = first; }
          deck = d;
        }
        last = deck.pop();
        return last;
      };
      const st = deckStats(draw, n, DECKS);
      bad += st.boundaryRepeats;
    }
    return bad;
  })(),
  'if the adjacency clause did not cross deck boundaries it would be satisfied by the permutation property '
  + 'alone, and a clause that can only fail when a sibling already has reports on nothing');

// ===================================================================================================
console.log('\n§E — `resolveReel` and `passSeconds`');
// ===================================================================================================
// ⚠️ **A MISSING PRESET IS SKIPPED AND COUNTED, never fatal and never silently dropped: an editor showing
// twelve rows while the runner plays ten is lying, and the only way to be honest is to publish both numbers.**
const mixedReel = { name: 'r', presets: ['A', 'B', 'A', 'C', 'D'], playMode: 'sequential', playSeconds: 20, transition: 'fade' };
const have = new Set(['A', 'C']);
const resolved = resolveReel(mixedReel, (n) => have.has(n));
chk('`resolveReel` preserves order, keeps DUPLICATES, and counts what it skipped',
  resolved.order.length === 3 && resolved.order.every((v, i) => v === ['A', 'A', 'C'][i])
  && resolved.skipped.length === 2 && resolved.skipped.every((v, i) => v === ['B', 'D'][i]),
  `order [${resolved.order}] skipped [${resolved.skipped}] — duplicates are allowed, a reel may deliberately `
  + 'revisit a figure');

// Order preservation on a long list, so the clause cannot pass on a three-element coincidence.
const longNames = Array.from({ length: 60 }, (_, i) => `p${i}`);
const keep = (n) => Number(n.slice(1)) % 3 !== 0;
const longRes = resolveReel({ ...mixedReel, presets: longNames }, keep);
const wantOrder = longNames.filter(keep), wantSkip = longNames.filter((n) => !keep(n));
chk('...and the order is the input order over a 60-name list, with nothing in both buckets',
  longRes.order.length === wantOrder.length && longRes.order.every((v, i) => v === wantOrder[i])
  && longRes.skipped.length === wantSkip.length && longRes.skipped.every((v, i) => v === wantSkip[i])
  && longRes.order.length + longRes.skipped.length === longNames.length
  && longRes.order.every((v) => !longRes.skipped.includes(v)),
  `${longRes.order.length} resolved + ${longRes.skipped.length} skipped = ${longNames.length}`);

/*
 * ⚠️ **`count` TRANSITIONS, NOT `count - 1`, BECAUSE THE REEL LOOPS.** The pass that returns to the first preset
 * also pays for a transition. Reading it as `count - 1` understates a twelve-item reel by about two seconds,
 * which is exactly the size of error a readout hides — nobody times a reel with a stopwatch, they just find the
 * estimate slightly optimistic and stop trusting it.
 */
let psBad = 0, psCases = 0;
for (const tr of MODES) for (const ps of [REEL_MIN_SECONDS, 14, REEL_DEFAULT_SECONDS, REEL_MAX_SECONDS]) {
  for (const n of [-1, 0, 1, 2, 8, 12, 60]) {
    psCases++;
    const want = n <= 0 ? 0 : n * (ps + TOTAL[tr] / 1000);
    if (passSeconds(n, ps, tr) !== want) psBad++;
  }
}
chk('`passSeconds` charges `count` transitions and returns 0 for an empty reel', psBad === 0,
  `${psCases} (count, playSeconds, transition) combinations`);
seed('`count - 1` transitions, i.e. a pass that forgets the reel loops',
  (() => {
    let bad = 0;
    for (const tr of MODES) for (const ps of [REEL_MIN_SECONDS, 14, REEL_DEFAULT_SECONDS]) {
      for (const n of [1, 2, 8, 12, 60]) if ((n - 1) * (ps + TOTAL[tr] / 1000) !== passSeconds(n, ps, tr)) bad++;
    }
    return bad;
  })(),
  'if the transition total were 0 the two formulas would agree and this clause would assert nothing');

// ===================================================================================================
console.log('\n§F — `validateReel` returns EVERY problem, not the first');
// ===================================================================================================
// ⚠️ **A FORM THAT REPORTS ONE PROBLEM AT A TIME MAKES THE USER DISCOVER THE SECOND BY FIXING THE FIRST**, and
// the early-return version is what anyone writes first: it is shorter, it type-checks, and it is correct on a
// reel with exactly one problem — which is every reel a developer tests with.
const goodReel = { name: 'Keeper', presets: ['Waves'], playMode: 'sequential', playSeconds: REEL_DEFAULT_SECONDS, transition: 'fade' };
chk('a valid reel produces NO problems (so the validator is not simply always unhappy)',
  validateReel(goodReel, ['Something Else']).length === 0);

const tripleWrong = { ...goodReel, name: '   ', presets: [], playSeconds: REEL_MIN_SECONDS - 0.5 };
const tripleProblems = validateReel(tripleWrong, []);
const tripleFields = new Set(tripleProblems.map((p) => p.field));
chk('a reel wrong in THREE ways reports three problems keyed to three distinct fields',
  tripleProblems.length === 3 && tripleFields.size === 3
  && ['name', 'presets', 'playSeconds'].every((f) => tripleFields.has(f)),
  `${tripleProblems.length} problems on [${[...tripleFields].join(', ')}]`);
seed('a validator that returns on the first problem it finds',
  (() => {
    const first = validateReel(tripleWrong, []).slice(0, 1);
    return new Set(first.map((p) => p.field)).size < 3 ? 1 : 0;
  })(),
  'if the fixture were wrong in only one way, an early-return validator would be indistinguishable from this one');

// ⚠️ **THE DUPLICATE TEST IS CASE-INSENSITIVE because a name is a primary key**, and a case-sensitive second
// comparison reads as "the dropdown shows two reels but Delete only ever removes one of them".
const caseDup = validateReel({ ...goodReel, name: '  gRaNd tOuR ' }, ['Grand Tour']);
chk('the duplicate-name test is case-insensitive and trims both sides',
  caseDup.length === 1 && caseDup[0].field === 'name'
  && validateReel({ ...goodReel, name: 'Grand Tour' }, ['  grand tour  ']).length === 1,
  `"  gRaNd tOuR " against ["Grand Tour"] → ${caseDup.length} problem`);
seed('a case-SENSITIVE duplicate test',
  ['Grand Tour'].some((t) => t === '  gRaNd tOuR '.trim()) ? 0 : 1,
  'a case-sensitive comparison accepts a second reel whose name differs only in case, and every later lookup '
  + 'then resolves to whichever one `find` reaches first');

// ⚠️ **NON-FINITE AND OUT-OF-RANGE ARE TWO PROBLEMS WITH TWO MESSAGES**, and they must not collapse: `NaN < min`
// is false, so a validator that only range-tested would accept NaN and the reel would hold a play time that
// every arithmetic on it turns into NaN.
const rangeCases = [
  ['below the floor', REEL_MIN_SECONDS - 0.001], ['above the ceiling', REEL_MAX_SECONDS + 1],
  ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
];
let rangeBad = 0;
for (const [, v] of rangeCases) {
  const ps = validateReel({ ...goodReel, playSeconds: v }, []);
  if (ps.length !== 1 || ps[0].field !== 'playSeconds') rangeBad++;
}
const nanMsg = validateReel({ ...goodReel, playSeconds: NaN }, [])[0]?.message;
const lowMsg = validateReel({ ...goodReel, playSeconds: REEL_MIN_SECONDS - 1 }, [])[0]?.message;
chk('out-of-range AND non-finite play times are both caught, with DIFFERENT messages',
  rangeBad === 0 && typeof nanMsg === 'string' && nanMsg !== lowMsg,
  `${rangeCases.length} cases (${rangeCases.map(([n]) => n).join(', ')}); "${nanMsg}" vs "${lowMsg}"`);
seed('a range-only test, which accepts NaN because every comparison with NaN is false',
  [NaN, Infinity].filter((v) => !(v < REEL_MIN_SECONDS || v > REEL_MAX_SECONDS)).length,
  'if `NaN < min` were true a range test would suffice and the finiteness clause would be redundant');

// The name-length bound, which is a KEY limit rather than a display limit.
chk('an over-long name is a problem and a name exactly at the bound is not',
  validateReel({ ...goodReel, name: 'x'.repeat(REEL_MAX_NAME_LENGTH + 1) }, []).length === 1
  && validateReel({ ...goodReel, name: 'x'.repeat(REEL_MAX_NAME_LENGTH) }, []).length === 0,
  `bound ${REEL_MAX_NAME_LENGTH}`);
// ⚠️ `sameReelName` is the ONE place reel names are compared; asserted directly so §H's clauses can lean on it.
chk('`sameReelName` trims and folds case, and is the single comparison every owner routes through',
  sameReelName(' Grand Tour ', 'grand tour') && !sameReelName('Grand Tour', 'Grand Tour 2'),
  'four owners compare names — the merge, the dropdown, `mainReelName`, the import collision test');

// ===================================================================================================
console.log('\n§G — serialisation: a round trip, per-ENTRY rejection, and the reel/preset discriminator');
// ===================================================================================================
const fixtureReels = [
  { name: 'Alpha', presets: ['Waves', 'Galaxy', 'Waves'], playMode: 'sequential', playSeconds: REEL_MIN_SECONDS, transition: 'fade' },
  { name: 'Beta', presets: ['Cylinder'], playMode: 'random', playSeconds: REEL_MAX_SECONDS, transition: 'black' },
  { name: 'Gamma & Co', presets: [], playMode: 'random', playSeconds: 14.25, transition: 'fade' },
  { name: 'Delta', presets: ['Pipes', 'Quader'], playMode: 'sequential', playSeconds: REEL_DEFAULT_SECONDS, transition: 'black' },
];
const reelEq = (a, b) =>
  a.name === b.name && a.playMode === b.playMode && a.playSeconds === b.playSeconds
  && a.transition === b.transition
  && a.presets.length === b.presets.length && a.presets.every((p, i) => p === b.presets[i]);
const roundTripped = parseReelFile(serialiseReelFile(fixtureReels, 'Beta'));
chk('`serialiseReelFile` → `parseReelFile` is field-identical, comparing `presets` ELEMENT-WISE',
  roundTripped !== null && roundTripped.reels.length === fixtureReels.length
  && fixtureReels.every((r, i) => reelEq(r, roundTripped.reels[i]))
  && roundTripped.mainReelName === 'Beta' && roundTripped.rejected === 0,
  `${fixtureReels.length} reels over both play modes and both transitions, including an empty list, a `
  + 'duplicated preset name and a fractional play time — an element-wise compare cannot pass on array identity');
chk('...and the parsed reels share no array with the input (a round trip through JSON must not alias)',
  fixtureReels.every((r, i) => r.presets !== roundTripped.reels[i].presets),
  'an aliasing round trip would make the store\'s copy-on-read guarantees untestable');

// ⚠️ **PER-REEL REJECTION, NEVER PER-FILE**: a hand-edited or half-written `localStorage` entry must cost the
// user that one reel, not the whole set. "3 reels loaded, 1 unreadable" instead of a profile that looks wiped.
const junkFile = JSON.stringify({
  version: REEL_FILE_VERSION,
  reels: [fixtureReels[0], 42, fixtureReels[1], { name: '   ', presets: [] }],
  mainReelName: null,
});
const oPerEntry = (parse) => {
  const p = parse(junkFile);
  return (p !== null && p.reels.length === 2 && p.rejected === 2
    && reelEq(p.reels[0], fixtureReels[0]) && reelEq(p.reels[1], fixtureReels[1])) ? 0 : 1;
};
const junkParsed = parseReelFile(junkFile);
chk('a file with 2 good and 2 junk entries yields 2 reels and `rejected === 2`',
  oPerEntry(parseReelFile) === 0,
  junkParsed ? `${junkParsed.reels.length} reels, ${junkParsed.rejected} rejected` : 'parse returned null');
seed('a per-FILE sanitiser that rejects the whole set when one entry is unreadable',
  oPerEntry((text) => {
    let o; try { o = JSON.parse(text); } catch { return null; }
    if (typeof o?.version !== 'number' || !Array.isArray(o.reels)) return null;
    const rs = o.reels.map((e) => sanitiseReel(e));
    if (rs.some((r) => r === null)) return null;                       // the whole file goes
    return { version: o.version, reels: rs, mainReelName: o.mainReelName ?? null, rejected: 0 };
  }),
  'if the fixture held no junk entry, per-file and per-entry rejection would be indistinguishable');

// `sanitiseReel`'s coercions, which are what make a junk entry survivable rather than fatal.
const coerced = sanitiseReel({ name: '  Trimmed  ', presets: ['A', 7, '', 'B'], playMode: 'nonsense', transition: 'nonsense', playSeconds: REEL_MAX_SECONDS * 10 });
chk('`sanitiseReel` trims the name, drops non-string presets, defaults bad enums and CLAMPS the play time',
  coerced !== null && coerced.name === 'Trimmed'
  && coerced.presets.length === 2 && coerced.presets[0] === 'A' && coerced.presets[1] === 'B'
  && coerced.playMode === REEL_DEFAULT_PLAY_MODE && coerced.transition === REEL_DEFAULT_TRANSITION
  && coerced.playSeconds === REEL_MAX_SECONDS,
  JSON.stringify(coerced));

/*
 * ⚠️ **THE DISCRIMINATOR IS TESTED AGAINST THE ACTUAL THING IT HAS TO TELL REELS APART FROM.** Two importers
 * that quietly accept each other's files are a silent-misfile defect: `Import Reels` on a preset bundle must say
 * so, and a preset import handed a reels file must say so too. So the negative corpus is built from the real
 * library rather than from a hand-written stub — the raw `g_psss_presets=` text, the sliced JSON object, and a
 * migrated single preset as the modern exporter writes it.
 */
const someLegacyName = Object.keys(LEGACY)[0];
const NEGATIVE_CORPUS = [
  ['the raw public/psss_presets.json text, assignment prefix and all', rawJson],
  ['the same file with the prefix sliced off — a bare 177-key preset object', JSON.stringify(LEGACY)],
  ['one migrated preset, as the preset exporter writes it', JSON.stringify(MigrationLayer.migrate(someLegacyName, LEGACY[someLegacyName]))],
  ['a bare array', '[]'],
  ['not JSON at all', 'g_psss_reels = oops'],
];
const accepted = NEGATIVE_CORPUS.filter(([, text]) => looksLikeReelFile(text));
chk('`looksLikeReelFile` is TRUE for a reel file and FALSE for every preset-shaped corpus',
  looksLikeReelFile(serialiseReelFile(fixtureReels, null)) && accepted.length === 0,
  `${NEGATIVE_CORPUS.length} negative corpora rejected (${NEGATIVE_CORPUS.map(([n]) => n.split(',')[0]).join('; ')})`);
seed('a discriminator that accepts anything that parses as a JSON object',
  NEGATIVE_CORPUS.filter(([, text]) => { try { const o = JSON.parse(text); return typeof o === 'object' && o !== null; } catch { return false; } }).length,
  'the shape test anyone writes first; it accepts a preset bundle, and `Import Reels` then reports "0 reels '
  + 'loaded" over a perfectly good preset file');

// ⚠️ **PERSISTED DATA WITH NO VERSION IS A MIGRATION WITH NO WAY TO TELL OLD FROM NEW**, so the version is
// required rather than defaulted — the first schema change would otherwise have to guess from the shape, which
// is the classifier problem the clause above exists to avoid.
const MALFORMED = [
  ['no `version` at all', JSON.stringify({ reels: [fixtureReels[0]], mainReelName: null })],
  ['a STRING version, which `?? default` does not rescue', JSON.stringify({ version: '1', reels: [fixtureReels[0]], mainReelName: null })],
  ['no `reels` array', JSON.stringify({ version: REEL_FILE_VERSION, mainReelName: null })],
];
const oMalformed = (parse) => MALFORMED.filter(([, t]) => parse(t) !== null).length;
chk('a reel file with no `version`, or a non-numeric one, is REJECTED outright',
  oMalformed(parseReelFile) === 0,
  MALFORMED.map(([n]) => n).join('; '));
seed('a parser that skips the version test, keeping only the shape test',
  oMalformed((text) => {
    let o; try { o = JSON.parse(text); } catch { return null; }
    if (!Array.isArray(o?.reels)) return null;                         // version never consulted
    return { version: o.version ?? REEL_FILE_VERSION, reels: o.reels.map((e) => sanitiseReel(e)).filter(Boolean), mainReelName: null, rejected: 0 };
  }),
  'a defaulted version makes every future migration guess from the shape, which is the classifier problem the '
  + 'discriminator clause above exists to avoid');

// ===================================================================================================
console.log('\n§H — the store\'s THREE LAYERS, driven through an in-memory `ReelPersistence`');
// ===================================================================================================
/*
 * ⚠️ **THE PORT IS INJECTED PRECISELY SO THIS SECTION CAN EXIST** — `reel-store.ts` says so at its constructor.
 * Everything below drives the real `ReelStore` against a string in memory, so the persisted TEXT is readable and
 * the most valuable clause in the file (only user reels are written) is a measurement rather than a reading of
 * the code.
 *
 * ⚠️ **`console.warn` IS CAPTURED, NOT SILENCED.** The store warns on an unreadable stored entry and on a failed
 * write; those warnings are part of the contract (they are what the user sees instead of reels vanishing), so
 * they are collected and asserted rather than swallowed — and the capture also keeps them out of this file's
 * own output, where they would read as checker failures.
 */
const warnings = [];
const realWarn = console.warn;
console.warn = (...a) => warnings.push(a.map(String).join(' '));

const makePort = (initial = null) => {
  const port = {
    text: initial, writes: 0, reads: 0, cleared: 0, throwOnWrite: false, throwOnRead: false,
    read() { port.reads++; if (port.throwOnRead) throw new Error('storage revoked'); return port.text; },
    write(t) { port.writes++; if (port.throwOnWrite) throw new Error('quota exceeded'); port.text = t; },
    clear() { port.cleared++; port.text = null; },
  };
  return port;
};
const BUILT_IN_NAMES = BUILT_IN_REELS.map((r) => r.name);
const userReel = (name, presets = ['Waves']) => ({ name, presets, playMode: 'random', playSeconds: 33, transition: 'black' });

// ── the floor ──────────────────────────────────────────────────────────────────────────────────────
const floorStore = new ReelStore(null);
chk('with no persistence and no deployment layer, `list()` IS the built-ins, in declaration order',
  floorStore.names().length === BUILT_IN_NAMES.length && floorStore.names().every((n, i) => n === BUILT_IN_NAMES[i])
  && floorStore.count() === BUILT_IN_REELS.length,
  `[${floorStore.names().join(', ')}]`);
chk('...and `status().persistent` is FALSE rather than pretending a save will last',
  floorStore.status().persistent === false && new ReelStore(makePort()).status().persistent === true,
  'a UI that cannot tell the difference tells the user their reels are saved when they are not');
chk('`list()` is recomputed per call, never cached — a fresh array and fresh `presets` every time',
  (() => { const a = floorStore.list(), b = floorStore.list(); return a !== b && a[0] !== b[0] && a[0].presets !== b[0].presets; })(),
  'five mutators would have to invalidate a cache, and the fifth is the one that gets forgotten');

// ── the deployment layer ───────────────────────────────────────────────────────────────────────────
const depPort = makePort();
const depStore = new ReelStore(depPort);
const shadowName = BUILT_IN_NAMES[BUILT_IN_NAMES.length - 1];
const shadowPos = BUILT_IN_NAMES.indexOf(shadowName);
const adopted = depStore.adoptDeploymentReels([
  { name: shadowName, presets: ['Waves'], playMode: 'random', playSeconds: 9, transition: 'fade' },
  { name: 'Deployment Only', presets: ['Galaxy'], playMode: 'sequential', playSeconds: 11, transition: 'black' },
  'not a reel',
]);
chk('a deployment reel sharing a built-in\'s name REPLACES IT IN PLACE and does not lengthen the list',
  adopted === 2 && depStore.count() === BUILT_IN_REELS.length + 1
  && depStore.names()[shadowPos] === shadowName
  && depStore.get(shadowName).presets.length === 1 && depStore.get(shadowName).presets[0] === 'Waves'
  && depStore.origin(shadowName) === 'deployment' && depStore.names().at(-1) === 'Deployment Only',
  `adopted ${adopted} of 3 entries; "${shadowName}" still at index ${shadowPos} with the deployment's content; `
  + `1 junk entry counted in status().rejected = ${depStore.status().rejected}`);
chk('...and adopting the deployment layer writes NOTHING to persistence — it is not the user\'s data',
  depStore.status().rejected === 1 && depPort.writes === 0 && depPort.text === null,
  `${depPort.writes} writes and the stored text is still ${depPort.text} after adopting ${adopted} reels — `
  + 'persisting the deployment layer would freeze it exactly the way persisting the built-ins would, and this '
  + 'clause is the one that would catch a `persist()` added to `adoptDeploymentReels` for symmetry');
chk('a non-array deployment payload adopts 0 and leaves the list alone',
  (() => { const s = new ReelStore(null); return s.adoptDeploymentReels(undefined) === 0 && s.adoptDeploymentReels({ nope: 1 }) === 0 && s.count() === BUILT_IN_REELS.length; })());

// ── shadow, restore, remove ────────────────────────────────────────────────────────────────────────
const shadowTarget = BUILT_IN_NAMES[0];
const builtInPresets = BUILT_IN_REELS[0].presets;
const shStore = new ReelStore(makePort());
chk('an unshadowed base reel is NOT removable, and that is a decision (a tombstone is a second schema)',
  shStore.canRemove(shadowTarget) === false && shStore.origin(shadowTarget) === 'builtin'
  && shStore.isShadowing(shadowTarget) === false && shStore.remove(shadowTarget) === 'absent');
shStore.save(userReel(shadowTarget, ['Pipes', 'Quader']));
chk('a user `save()` under a built-in\'s name shadows it IN PLACE and becomes removable',
  shStore.count() === BUILT_IN_REELS.length && shStore.names()[0] === shadowTarget
  && shStore.origin(shadowTarget) === 'user' && shStore.isShadowing(shadowTarget) === true
  && shStore.canRemove(shadowTarget) === true && shStore.get(shadowTarget).presets.length === 2,
  `"${shadowTarget}" now user-owned at index 0, list still ${shStore.count()} long`);
chk('...and `remove()` reports `restored`, with the built-in content back byte for byte',
  shStore.remove(shadowTarget) === 'restored'
  && shStore.origin(shadowTarget) === 'builtin'
  && shStore.get(shadowTarget).presets.length === builtInPresets.length
  && shStore.get(shadowTarget).presets.every((p, i) => p === builtInPresets[i]),
  '"Delete Grand Tour?" is a lie when the answer restores the built-in version — the three outcomes exist so '
  + 'the confirmation can say which one it is');
shStore.save(userReel('Fresh One'));
chk('a `save()` under a fresh name then `remove()` reports `removed`, and an unknown name reports `absent`',
  shStore.remove('Fresh One') === 'removed' && shStore.has('Fresh One') === false
  && shStore.remove('No Such Reel') === 'absent' && shStore.remove('  fresh one  ') === 'absent',
  'three outcomes, three different confirmations');
chk('a user reel shadowing a DEPLOYMENT reel also restores rather than disappearing',
  (() => {
    const s = new ReelStore(makePort());
    s.adoptDeploymentReels([{ name: 'Dep', presets: ['Waves'], playMode: 'random', playSeconds: 7, transition: 'fade' }]);
    s.save(userReel('Dep', ['Galaxy']));
    return s.remove('Dep') === 'restored' && s.origin('Dep') === 'deployment' && s.get('Dep').presets[0] === 'Waves';
  })(),
  '`baseReel` resolves deployment before built-in, so the layer the user was shadowing is the one that returns');

// ⚠️ **THE NAME IS A PRIMARY KEY AND EVERY COMPARISON GOES THROUGH `sameReelName`.** A case-sensitive second
// comparison reads as "the dropdown shows two reels but Delete only ever removes one of them".
const caseStore = new ReelStore(makePort());
caseStore.save(userReel(shadowTarget.toLowerCase(), ['Galaxy']));
chk('saving a built-in\'s name in a DIFFERENT CASE shadows it rather than adding a second entry',
  caseStore.count() === BUILT_IN_REELS.length && caseStore.names()[0] === shadowTarget.toLowerCase()
  && caseStore.origin(shadowTarget) === 'user' && caseStore.has(shadowTarget.toUpperCase()) === true
  && caseStore.remove(shadowTarget.toUpperCase()) === 'restored',
  `saved "${shadowTarget.toLowerCase()}" over "${shadowTarget}", list still ${caseStore.count()} long`);
seed('a merge and a delete comparing names with `===`',
  (() => {
    const seen = new Set(BUILT_IN_NAMES);                       // case-SENSITIVE
    return seen.has(shadowTarget.toLowerCase()) ? 0 : 1;
  })(),
  'if every built-in name were already lower case, a case-sensitive comparison would be indistinguishable here');

/*
 * ⚠️ **THE MOST VALUABLE CLAUSE IN THIS FILE.** `localStorage` must hold the USER's reels and nothing else.
 * Writing the merged view back is the obvious implementation, it is invisible to every other instrument, and it
 * freezes the built-in reels at whatever the FIRST run of the FIRST build wrote — so a later build that adds a
 * preset to a built-in reel, or fixes a name in it, ships that change to new users only, and everyone who ever
 * opened the tab keeps the old copy forever with no way to tell. Measured by PARSING what the port received.
 */
const persistPort = makePort();
const persistStore = new ReelStore(persistPort);
persistStore.adoptDeploymentReels([{ name: 'Deployed', presets: ['Waves'], playMode: 'random', playSeconds: 8, transition: 'fade' }]);
persistStore.save(userReel('Mine Only', ['Galaxy', 'Waves']));
const written = parseReelFile(persistPort.text);
const leaked = written === null ? ['(the written text does not parse)'] : written.reels
  .map((r) => r.name)
  .filter((n) => [...BUILT_IN_NAMES, 'Deployed'].some((b) => sameReelName(b, n)));
chk('the persisted text holds ONLY user reels — no built-in, no deployment reel',
  written !== null && leaked.length === 0 && written.reels.length === 1 && written.reels[0].name === 'Mine Only',
  written === null ? 'unparseable' : `${written.reels.length} reel persisted (${written.reels.map((r) => r.name).join(', ')}) `
    + `out of ${persistStore.count()} in the merged view; leaked: ${leaked.length ? leaked.join(', ') : 'none'}`);
seed('a store that persists its MERGED view — the obvious implementation, and the one that freezes the built-ins',
  (() => {
    const merged = parseReelFile(serialiseReelFile(persistStore.list(), persistStore.mainReelName()));
    return merged === null ? 0 : merged.reels.filter((r) => [...BUILT_IN_NAMES, 'Deployed'].some((b) => sameReelName(b, r.name))).length;
  })(),
  'if the merged view happened to contain no base reel, this clause could not distinguish the two designs');
// ⚠️ The EXPORT is the opposite decision and both are deliberate: a reels FILE is a portable set, not a diff
// against this build, so `toFileText()` must include the built-ins that `persist()` must exclude.
const exported = parseReelFile(persistStore.toFileText());
chk('...while `toFileText()` exports the MERGED view — the opposite rule, for a file that must travel',
  exported !== null && exported.reels.length === persistStore.count()
  && BUILT_IN_NAMES.filter((n) => n !== 'Deployed').every((n) => exported.reels.some((r) => sameReelName(r.name, n))),
  exported ? `${exported.reels.length} reels exported against ${written.reels.length} persisted — a file that `
    + 'held only the user\'s own would play differently on a machine whose built-ins differ' : 'unparseable');

// ── copy-on-read and copy-on-write ─────────────────────────────────────────────────────────────────
// ⚠️ **The tab holds a working reel it mutates on every drag; handing that object into the map would make every
// later mutation land in the store UNSAVED, so `Save` would appear to work before it was pressed.**
const aliasStore = new ReelStore(makePort());
const gotOut = aliasStore.get(shadowTarget);
gotOut.presets.push('INJECTED');
gotOut.name = 'RENAMED';
gotOut.playSeconds = 999;
const handedIn = userReel('Handed In', ['Waves']);
aliasStore.save(handedIn);
handedIn.presets.push('INJECTED');
handedIn.playSeconds = 999;
chk('neither `get()` nor `save()` aliases: mutating either side leaves the store\'s contents where they were',
  aliasStore.get(shadowTarget).presets.length === builtInPresets.length
  && !aliasStore.get(shadowTarget).presets.includes('INJECTED')
  && aliasStore.has('RENAMED') === false && aliasStore.get(shadowTarget).playSeconds !== 999
  && aliasStore.get('Handed In').presets.length === 1
  && aliasStore.get('Handed In').playSeconds === 33,
  'both directions, because only one of them is usually remembered');
seed('a store that hands back the stored object, i.e. a `Map` with no copy on either side',
  (() => {
    const naive = new Map([['k', userReel('k', ['Waves'])]]);
    const out = naive.get('k');
    out.presets.push('INJECTED');
    return naive.get('k').presets.includes('INJECTED') ? 1 : 0;
  })(),
  'if the fixture mutated a scalar rather than the array, a shallow copy would pass and the real defect '
  + '(a shared `presets`) would ship');

// ── the main reel ──────────────────────────────────────────────────────────────────────────────────
/*
 * ⚠️ **THE MAIN REEL IS A NAME ON THE STORE, NOT A FLAG ON A `Reel`** (`Reel` deliberately has no `isMain`).
 * A boolean per reel makes "two mains" and "no main" both representable, and the second is silent: the
 * autostart just does nothing. And the stored name is RESOLVED on read, because it can point at a reel that no
 * longer exists — every caller either autostarts it or ticks a checkbox, and both do nothing at all when handed
 * a dead name.
 */
const ghostPort = makePort(serialiseReelFile([], 'Ghost Reel'));
const ghostStore = new ReelStore(ghostPort);
chk('a stored main-reel name that no longer exists falls back to a reel that EXISTS',
  ghostStore.storedMainReelName() === 'Ghost Reel'
  && ghostStore.has(ghostStore.mainReelName()) === true
  && ghostStore.mainReelName() === 'Grand Tour'
  && ghostStore.mainReel() !== undefined,
  `stored "Ghost Reel" resolves to "${ghostStore.mainReelName()}" (the documented default), and the RAW value `
  + 'is still readable so the exporter does not write a resolved fallback back to a file');
seed('a `mainReelName()` that returns the stored string unresolved',
  ghostStore.has('Ghost Reel') ? 0 : 1,
  'a dead name reaches the autostart as "play nothing" and the checkbox as "nothing ticked", neither of which '
  + 'looks like a defect');
chk('`isMainReel` folds case, and `setMainReel` canonicalises the name and PERSISTS it',
  (() => {
    const p = makePort();
    const s = new ReelStore(p);
    if (!s.isMainReel('grand tour') || !s.isMainReel('  GRAND TOUR  ')) return false;
    s.setMainReel(BUILT_IN_NAMES[2].toUpperCase());
    const back = parseReelFile(p.text);
    return s.storedMainReelName() === BUILT_IN_NAMES[2] && back?.mainReelName === BUILT_IN_NAMES[2]
      && s.isMainReel(BUILT_IN_NAMES[2].toLowerCase());
  })(),
  'the mark is stored canonicalised, so the dropdown and the file agree on one spelling');

// ── import ─────────────────────────────────────────────────────────────────────────────────────────
const impStore = new ReelStore(makePort());
const impResult = impStore.importReels({ reels: [userReel(shadowTarget, ['Galaxy'])], mainReelName: null, rejected: 0 });
chk('`importReels` version-suffixes a colliding name and does NOT overwrite the existing reel',
  impResult.added === 1 && impResult.renamed === 1
  && impStore.has(`${shadowTarget} v2`) === true
  && impStore.origin(shadowTarget) === 'builtin'
  && impStore.get(shadowTarget).presets.length === builtInPresets.length
  && impStore.get(`${shadowTarget} v2`).presets[0] === 'Galaxy',
  `"${shadowTarget}" collided → "${shadowTarget} v2"; the original is still the built-in`);
chk('...and a file holding both `X` and `X v2` against an existing `X` cannot collide with ITSELF',
  (() => {
    const s = new ReelStore(makePort());
    s.save(userReel('X', ['Waves']));
    const r = s.importReels({ reels: [userReel('X', ['Galaxy']), userReel('X v2', ['Pipes'])], mainReelName: null, rejected: 0 });
    const names = s.names().filter((n) => /^X( v\d+)?$/.test(n));
    return r.added === 2 && r.renamed === 2 && new Set(names).size === 3
      && s.get('X').presets[0] === 'Waves' && s.get('X v2').presets[0] === 'Galaxy' && s.get('X v3').presets[0] === 'Pipes';
  })(),
  '`live` is extended as the loop goes; re-reading `names()` per candidate would not see the names this call '
  + 'has already decided');
chk('a RENAMED reel does not become the main reel',
  impStore.storedMainReelName() !== `${shadowTarget} v2` && impStore.mainReelName() !== `${shadowTarget} v2`,
  'a renamed reel is a different reel by primary key, and silently promoting it would change what autostarts');
/*
 * ⚠️ **AND HERE IS WHERE THAT RULE STOPS SHORT — A MEASURED CLAUSE OVER THE SHIPPED BEHAVIOUR, WHICH MEANS ITS
 * GREEN SAYS THE BEHAVIOUR IS STILL THIS.** `importReels` gates the file's main-reel mark on
 * `live.has(name)`, but `live` is seeded from `names()` BEFORE the loop, so a name that collided — and was
 * therefore renamed — is in `live` because the PRE-EXISTING reel is. The mark is then honoured against that
 * pre-existing reel. The renamed import is not promoted (the clause above), but something is: importing a file
 * marked `Geometry` promotes THIS build's `Geometry`, not the one in the file. Reported, not fixed here; the
 * one-line shape of the fix is to test the mark against the names this call ADDED un-renamed.
 */
const markStore = new ReelStore(makePort());
const markBefore = markStore.storedMainReelName();
const markResult = markStore.importReels({ reels: [userReel(BUILT_IN_NAMES[2], ['Waves'])], mainReelName: BUILT_IN_NAMES[2], rejected: 0 });
chk('MEASURED: a colliding main-reel mark is still honoured, against the PRE-EXISTING reel of that name',
  markResult.mainReelChanged === true && markStore.storedMainReelName() === BUILT_IN_NAMES[2]
  && markStore.has(`${BUILT_IN_NAMES[2]} v2`) === true && markBefore === null,
  `imported "${BUILT_IN_NAMES[2]}" arrived as "${BUILT_IN_NAMES[2]} v2" while the mark moved to the built-in `
  + `"${BUILT_IN_NAMES[2]}" (stored main ${markBefore} → ${markStore.storedMainReelName()}) — this clause asserts `
  + 'the SHIPPED behaviour, so its green means what autostarts can still be changed by a file whose reel was renamed');
chk('...and `rejected` is passed through rather than recounted, so the caller reports one number',
  impStore.importReels({ reels: [], mainReelName: null, rejected: 7 }).rejected === 7);

// ── a write that fails ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **A FAILED WRITE MUST NEVER DISCARD THE IN-MEMORY EDIT.** A quota error mid-session must cost persistence,
// not the reel the user is looking at; the latch is what lets the tab say "not saved to this browser" ONCE
// instead of the reel disappearing on the next reload with no explanation.
const failPort = makePort();
const failStore = new ReelStore(failPort);
failPort.throwOnWrite = true;
const warnsBefore = warnings.length;
failStore.save(userReel('Survivor', ['Waves']));
const failWarns = warnings.length - warnsBefore;
failPort.throwOnWrite = false;
failStore.save(userReel('Second', ['Galaxy']));
chk('a persistence port whose `write` THROWS keeps the reel in memory and LATCHES `status().writeFailed`',
  failStore.has('Survivor') === true && failStore.get('Survivor').presets[0] === 'Waves'
  && failStore.status().writeFailed === true && failWarns === 1,
  `write threw once (${failWarns} warning), the reel survived, and the latch stayed true across a later `
  + 'successful write — a latch that cleared would make the notice flicker rather than inform');
chk('...and an unreadable STORED entry costs the read, not the entry: it is counted and NOT cleared',
  (() => {
    const p = makePort('{ this is not json');
    const s = new ReelStore(p);
    return s.status().rejected === 1 && p.cleared === 0 && p.text === '{ this is not json'
      && s.count() === BUILT_IN_REELS.length;
  })(),
  'the entry is the only evidence of what went wrong, and the next successful save overwrites it anyway');
chk('...and a port whose `read` throws leaves the store empty rather than propagating',
  (() => { const p = makePort('{}'); p.throwOnRead = true; const s = new ReelStore(p); return s.count() === BUILT_IN_REELS.length; })(),
  'storage can be revoked between the constructor\'s probe and the first read');

// ── change notification ────────────────────────────────────────────────────────────────────────────
// ⚠️ **INVARIANT 15: `onChange` RETURNS AN UNSUBSCRIBE AND IT IS A LIST, NOT A SLOT.** The tab subscribes and so
// does the runner; a single slot means whichever registered last silently wins while the other goes stale on
// screen.
const notifyStore = new ReelStore(makePort());
let hitA = 0, hitB = 0;
const offA = notifyStore.onChange(() => hitA++);
notifyStore.onChange(() => hitB++);
notifyStore.save(userReel('N1'));
const bothFired = hitA === 1 && hitB === 1;
offA();
notifyStore.save(userReel('N2'));
offA();
chk('`onChange` is a LIST: two subscribers both fire, and unsubscribing one leaves the other working',
  bothFired && hitA === 1 && hitB === 2,
  `A fired ${hitA} time(s) and stopped after its unsubscribe; B fired ${hitB}; calling the unsubscribe twice `
  + 'is harmless');
seed('`onChange` as a single SLOT, so the second subscriber silently replaces the first',
  (() => { let slot = null; let a = 0, b = 0; slot = () => a++; slot = () => b++; slot(); return a === 0 ? 1 : 0; })(),
  'the tab and the runner both subscribe; with a slot, whichever registered last wins and the other goes stale');
chk('...and every mutator notifies: save, remove, setMainReel and importReels',
  (() => {
    const s = new ReelStore(makePort());
    let n = 0;
    s.onChange(() => n++);
    s.save(userReel('M'));
    s.remove('M');
    s.setMainReel(BUILT_IN_NAMES[1]);
    s.importReels({ reels: [userReel('Imported')], mainReelName: null, rejected: 0 });
    return n === 4;
  })(),
  'a mutator that does not notify leaves the dropdown showing a reel the store no longer has');

console.warn = realWarn;
chk('the store\'s own warnings were the expected ones and nothing else logged',
  warnings.length === 2 && warnings.some((w) => /could not write/.test(w)) && warnings.some((w) => /could not be read/.test(w)),
  `${warnings.length} captured: ${warnings.map((w) => w.replace(/^\[reels\]\s*/, '"') + '"').join(', ')}`);
chk('the storage key carries the version as well as the payload — two independent decisions',
  /\.v\d+$/.test(REEL_STORAGE_KEY) && REEL_STORAGE_KEY.includes('reels'),
  `"${REEL_STORAGE_KEY}" — the payload version lets a future build migrate, the KEY version lets it decline to `
  + 'without destroying the evidence of what went wrong');

// ===================================================================================================
console.log('\n§I — `extractDeploymentReels` strips the reserved key, and what happens when it does not');
// ===================================================================================================
const rawWith = { [Object.keys(LEGACY)[0]]: LEGACY[Object.keys(LEGACY)[0]], [REEL_LIBRARY_KEY]: [userReel('Shipped')] };
const keysBefore = Object.keys(rawWith).length;
const pulled = extractDeploymentReels(rawWith);
chk('after the call the reserved key is ABSENT by `hasOwnProperty`, and the return is what it held',
  Object.prototype.hasOwnProperty.call(rawWith, REEL_LIBRARY_KEY) === false
  && Object.keys(rawWith).length === keysBefore - 1
  && Array.isArray(pulled) && pulled.length === 1 && pulled[0].name === 'Shipped',
  `"${REEL_LIBRARY_KEY}" deleted from a ${keysBefore}-key object; \`!== undefined\` would also be satisfied by a `
  + 'key set to `undefined`, which `Object.keys` still reports and `loadAll` would still walk');
const rawWithout = { A: 1, B: 2 };
chk('a raw object without the key is UNTOUCHED and the call returns `undefined`',
  extractDeploymentReels(rawWithout) === undefined
  && Object.keys(rawWithout).length === 2 && rawWithout.A === 1 && rawWithout.B === 2,
  'the mutation is the point of the function, so "no key" must not become "one fewer key"');
seed('a strip written as `raw[KEY] = undefined` rather than `delete`',
  (() => { const o = { [REEL_LIBRARY_KEY]: [1] }; o[REEL_LIBRARY_KEY] = undefined; return Object.prototype.hasOwnProperty.call(o, REEL_LIBRARY_KEY) ? 1 : 0; })(),
  'a `!== undefined` test would report the key gone while `Object.keys` still lists it — the exact difference '
  + 'between the two absence tests, which is why the clause uses `hasOwnProperty`');

/*
 * ⚠️ **AND NOW WHY IT MATTERS, MEASURED RATHER THAN ARGUED.** The store's comment claims a forgotten strip does
 * not throw — it becomes a PRESET named `__reels`, i.e. a black tile in the grid that no one can explain. That
 * claim is the whole reason the strip has to be checked at all, so it is measured here: if `migrate` threw, a
 * forgotten strip would be a loud error and this function would be a convenience. It does not throw.
 */
let migrateOutcome;
try {
  const p = MigrationLayer.migrate(REEL_LIBRARY_KEY, [userReel('Shipped')]);
  const reach = Math.max(0, ...(p?.generators?.waves ?? []).flatMap((w) => w.axes.map((a) => Math.abs(a.am.base ?? 0) + Math.abs(a.am.amplitude ?? 0))));
  migrateOutcome = { threw: false, name: p?.metadata?.name, waves: p?.generators?.waves?.length ?? 0, reach };
} catch (e) { migrateOutcome = { threw: true, message: `${e.constructor.name}: ${e.message}` }; }
chk('MEASURED: a forgotten strip becomes a silent PRESET, not an error — `migrate` accepts the reels array',
  migrateOutcome.threw === false && migrateOutcome.name === REEL_LIBRARY_KEY && migrateOutcome.waves > 0
  && migrateOutcome.reach === 0,
  migrateOutcome.threw
    ? `migrate threw (${migrateOutcome.message}) — then a forgotten strip is LOUD and this section's premise is stale`
    : `migrate produced a preset named "${migrateOutcome.name}" with ${migrateOutcome.waves} wave slots and an `
      + `authored reach of ${migrateOutcome.reach} — an all-zero figure, which is the unexplainable black tile `
      + 'the store\'s comment predicts');
// ⚠️ And the OTHER half of the same trap, asserted because it is the louder failure: the reserved key must be a
// key INSIDE the existing object, never a second `g_psss_reels = {...}` statement — the dev loader slices one
// assignment prefix and `JSON.parse`s the rest, so a second statement makes that parse throw, the catch logs
// `Could not load legacy presets`, and the whole app carries on with an EMPTY library because of a reel.
chk('...and the reserved key is a KEY, so the dev loader\'s assignment-prefix slice still parses',
  (() => {
    const withReels = `g_psss_presets={${JSON.stringify(REEL_LIBRARY_KEY)}:[],${JSON.stringify('Waves')}:${JSON.stringify(LEGACY['Waves'] ?? {})}};`;
    try { JSON.parse(withReels.slice(withReels.indexOf('{')).replace(/;\s*$/, '')); } catch { return false; }
    const twoStatements = `${withReels}\ng_psss_reels={};`;
    try { JSON.parse(twoStatements.slice(twoStatements.indexOf('{')).replace(/;\s*$/, '')); return false; } catch { return true; }
  })(),
  'the key form parses and a second assignment does not — measured on the real slice, not asserted from the comment');

// ===================================================================================================
console.log('\n§J — every preset a BUILT-IN reel names must exist (the only instrument that can see a typo)');
// ===================================================================================================
/*
 * ⚠️ **A MISSING NAME IS NOT A RUNTIME ERROR.** `resolveReel` drops it into `skipped` and the reel plays
 * shorter, which reads as "the reel is fine, this build just has fewer presets". No browser pass would catch it
 * either, because the reel still runs. So this section is the only thing standing between a typo and a silently
 * shorter built-in reel — and it has to be re-run whenever a name in `BUILT_IN_REELS` changes.
 *
 * ⚠️ **THE REEL POPULATIONS CARRY DIFFERENT CLAIMS AND NO BASIS IS SUMMED.** Until 2026-09-19 every built-in
 * reel named LEGACY presets only, because the refined/variant TS groups were under review and a reel naming one
 * could go stale by a settle. That clause covered `Grand Tour` until the review closed and the reel became the
 * whole composed library; it covered the hand-picked reels until 2026-09-24, when the owner replaced the two of
 * them with six generated by criteria over the WHOLE library. ⚠️ **The legacy-only claim was not
 * relaxed, it was FALSIFIED by the new design**: `Materials` means every preset that uses a material and 42 of
 * those 84 live in the TS groups, so a legacy-only reel could not answer the commission at all. What stands in
 * its place:
 *
 *   - `Grand Tour` is asserted EQUAL to the library as a set, both directions, with no duplicates. A preset
 *     added to a TS group, renamed, or settled under a new key now fails this clause loudly, which is the only
 *     way the generated list can be kept honest — regenerate it, never relax the clause. Order is deliberately
 *     NOT asserted: library order is an insertion artefact and the reel plays `random` anyway.
 *   - every name in every reel must RESOLVE (the clause above, on the union's own base). That is detective
 *     where the legacy rule was prophylactic: it cannot stop a verdict renaming a preset a themed reel names,
 *     but it goes red at the next `verify`, which is before any change may be called done.
 *   - ⚠️ **two of the six themed rules are objective and get an EQUALITY clause of their own; three cannot and
 *     the seventh reel has no rule at all.** `Materials` is exactly "`overlay.material.preset` is set and is not
 *     `'None'`" and `Geometry` excludes the same predicate, so both are re-derived here from the COMPOSED
 *     library and compared — this is what catches a retune that adds or drops a material without regenerating
 *     the reel, which nothing else can see. `Water and Ice`, `2D` and `3D` read palettes, tags, crystals, Z
 *     reach and transmap styles; re-deriving those here would be transcribing the generator rather than checking
 *     it, and a checker that restates its subject measures nothing. Their rules stay written in `reel-store.ts`
 *     and unenforced, which is stated there.
 *   - ⚠️ **`Fire & Plasma` is CURATED since 2026-09-24 and is a different KIND of subject.** The owner replaced
 *     the classifier's 68-preset output with a hand-picked seven, so there is no predicate to re-derive and a
 *     membership clause here could only transcribe the list. What IS asserted is that its names resolve (the
 *     clause above, which is the defect that matters for a hand-written list) and that its three playback
 *     fields are exactly the owner's `sequential`/18 s/`fade` — see the mode clause below, which is why that
 *     clause could not stay a uniformity test.
 *   - the OWNER's cross-reel claims are asserted because a hand-edit is what breaks them: the six generated
 *     reels share one playback mode, `2D` and `3D` are disjoint, and no reel names anything twice.
 *
 * ⚠️ **The composed library is a SECOND basis and is used for BODIES ONLY.** `LIBRARY_NAMES` above is the union
 * of the legacy keys and the seven TS groups; `COMPOSED` here is `loadLibrary`'s output, where a refined entry
 * keyed by an original name REPLACES it in place. The two agree on the name set today and the clause below
 * asserts that rather than assuming it — but they are two measurements, so never quote one's figure for the
 * other, and read a material off `COMPOSED`: the union would give the material of the preset a verdict
 * replaced, which is the value the engine does not run.
 */
const FULL_LIBRARY_REEL = 'Grand Tour';
// ⚠️ "THEMED" and not "curated": since 2026-09-24 exactly one reel here IS curated (`Fire & Plasma`) and the
// other five themed ones are generated, so the old name would now read as a claim about how they were built.
const THEMED_REELS = BUILT_IN_REELS.filter((r) => r.name !== FULL_LIBRARY_REEL);
const missingUnion = [];
for (const r of BUILT_IN_REELS) for (const p of r.presets) {
  if (!LIBRARY_NAMES.has(p)) missingUnion.push(`${r.name}/${p}`);
}
chk(`every one of the ${REEL_PRESET_REFS.length} preset names in the ${BUILT_IN_REELS.length} built-in reels resolves`,
  missingUnion.length === 0,
  missingUnion.length ? `missing: ${missingUnion.join(', ')}` : `against a ${LIBRARY_NAMES.size}-name library`);
// ⚠️ Bodies, from the COMPOSED library — see the section header. The reel names are compared against BOTH bases
// so that a divergence between them is reported here instead of being inherited by the two equality clauses.
const composedManager = new PresetManager();
{
  const rawForCompose = JSON.parse(rawJson.slice(rawJson.indexOf('{')).replace(/;\s*$/, ''));
  extractDeploymentReels(rawForCompose);   // MUTATES — must precede loadLibrary or `__reels` becomes a preset
  loadLibrary(composedManager, rawForCompose);
}
const COMPOSED = new Map(composedManager.list().map((n) => [n, composedManager.get(n)]));
const composedOnly = [...COMPOSED.keys()].filter((n) => !LIBRARY_NAMES.has(n));
const unionOnly = [...LIBRARY_NAMES].filter((n) => !COMPOSED.has(n));
chk(`...and the two library bases agree on the name set, so a material read off the composed one is the material `
  + 'the engine runs',
  composedOnly.length === 0 && unionOnly.length === 0,
  composedOnly.length || unionOnly.length
    ? `composed-only: ${composedOnly.slice(0, 8).join(', ')}; union-only: ${unionOnly.slice(0, 8).join(', ')}`
    : `${COMPOSED.size} composed names = ${LIBRARY_NAMES.size} union names, both directions — asserted, not `
      + 'assumed, because a refined entry REPLACES a legacy one in place and only the composed side shows it');
/** The `Materials`/`Geometry` predicate, in one place: invariant 18 — the inactive state is the STRING 'None'. */
const usesMaterial = (name) => {
  const m = COMPOSED.get(name)?.overlay?.material?.preset;
  return typeof m === 'string' && m.length > 0 && m !== 'None';
};
const materialNames = [...COMPOSED.keys()].filter(usesMaterial);
const materialsReel = BUILT_IN_REELS.find((r) => r.name === 'Materials');
const matSet = new Set(materialsReel ? materialsReel.presets : []);
const matMissing = materialNames.filter((n) => !matSet.has(n));
const matExtra = [...matSet].filter((n) => !usesMaterial(n));
chk(`...and \`Materials\` is EXACTLY the ${materialNames.length} presets whose \`overlay.material.preset\` is set `
  + 'and not \'None\' — both directions, the one themed rule that is fully objective',
  !!materialsReel && matMissing.length === 0 && matExtra.length === 0,
  matMissing.length || matExtra.length
    ? `${matMissing.length} with a material but not in the reel (${matMissing.slice(0, 8).join(', ')}), `
      + `${matExtra.length} in the reel without one (${matExtra.slice(0, 8).join(', ')})`
    : `${matSet.size} names, set-equal to the material-bearing presets — this is the clause that goes red when a `
      + 'retune adds or drops a material, a change no other instrument in the project can see');
const geometryReel = BUILT_IN_REELS.find((r) => r.name === 'Geometry');
const geoWithMaterial = (geometryReel ? geometryReel.presets : []).filter(usesMaterial);
chk('...and `Geometry` names NO preset that uses a material (the owner\'s own criterion, same predicate)',
  !!geometryReel && geoWithMaterial.length === 0,
  geoWithMaterial.length
    ? `carries a material: ${geoWithMaterial.map((n) => `${n} (${COMPOSED.get(n).overlay.material.preset})`).join(', ')}`
    : `all ${geometryReel.presets.length} are material-free — the retired hand-picked list had \`Borg Cube\` in `
      + 'it, which carries Ember, so this clause would have been red against the list it replaced');
// ⚠️ Set equality BOTH DIRECTIONS. "Every library preset appears" alone passes a list that also names a
// deleted preset; "every name resolves" alone (above) passes a list that is missing half the library. A
// duplicate is its own defect: the random cursor deals from the list, so a doubled name plays twice a pass.
const tourReel = BUILT_IN_REELS.find((r) => r.name === FULL_LIBRARY_REEL);
const tourNames = tourReel ? tourReel.presets : [];
const tourSet = new Set(tourNames);
const tourMissing = [...LIBRARY_NAMES].filter((n) => !tourSet.has(n));
const tourExtra = tourNames.filter((n) => !LIBRARY_NAMES.has(n));
const tourDupes = tourNames.filter((n, i) => tourNames.indexOf(n) !== i);
chk(`...and \`${FULL_LIBRARY_REEL}\` is EXACTLY the ${LIBRARY_NAMES.size}-name library — no preset missing, none `
  + 'extra, none twice (it is GENERATED; a red here means regenerate it)',
  tourMissing.length === 0 && tourExtra.length === 0 && tourDupes.length === 0 && tourNames.length > 0,
  tourMissing.length || tourExtra.length || tourDupes.length
    ? `${tourMissing.length} missing (${tourMissing.slice(0, 6).join(', ')}), ${tourExtra.length} extra `
      + `(${tourExtra.slice(0, 6).join(', ')}), ${tourDupes.length} duplicated (${tourDupes.slice(0, 6).join(', ')})`
    : `${tourNames.length} names, set-equal to the library in both directions; order not asserted (insertion `
      + `artefact, and the reel plays ${tourReel.playMode})`);
/*
 * ⚠️ The owner's cross-reel claims. Each is what a HAND-EDIT breaks, and none is visible to `tsc`: a second
 * `playSeconds`, a preset pasted into both `2D` and `3D`, a name pasted twice into one reel.
 *
 * ⚠️ **THE MODE CLAUSE IS NO LONGER A UNIFORMITY TEST, AND THAT IS A REDUCTION IN STRENGTH — recorded as one.**
 * It asserted all seven at `random`/20 s/`black` until 2026-09-24, when the owner's import brought the curated
 * `Fire & Plasma` back at `sequential`/18 s/`fade`. A uniformity test cannot express "six the same and one
 * deliberately different" — it can only be relaxed to nothing — so the clause was SPLIT: the six keep the
 * uniformity test they had, and the seventh gets an EQUALITY test against the owner's three values. ⚠️ **Both
 * halves are needed and each is green over what the other rejects:** the uniformity half alone would accept
 * `Fire & Plasma` drifting to any values at all (it is excluded from the set), and the equality half alone would
 * accept a second reel quietly acquiring its own timing. The exception is named by NAME, not by index and not by
 * "the one that differs", because "whichever reel differs is allowed to differ" is not an assertion.
 */
const CURATED_MODE_REEL = 'Fire & Plasma';
const CURATED_MODE = { playMode: 'sequential', playSeconds: 18, transition: 'fade' };
const uniformReels = BUILT_IN_REELS.filter((r) => r.name !== CURATED_MODE_REEL);
const oddMode = uniformReels.filter((r) => r.playMode !== 'random' || r.playSeconds !== REEL_DEFAULT_SECONDS
  || r.transition !== 'black');
chk(`...and the ${uniformReels.length} GENERATED reels share ONE playback mode — \`random\`, `
  + `${REEL_DEFAULT_SECONDS}s, \`black\``,
  oddMode.length === 0 && uniformReels.length === BUILT_IN_REELS.length - 1,
  oddMode.length
    ? `differ: ${oddMode.map((r) => `${r.name} (${r.playMode}/${r.playSeconds}s/${r.transition})`).join(', ')}`
    : 'owner 2026-09-24, "the same mode as Grand Tour shall be applied" — `black` also retired the double image '
      + 'a cross-fade put on the crisp low-accumulation figures a full-library pass now includes');
const curatedModeReel = BUILT_IN_REELS.find((r) => r.name === CURATED_MODE_REEL);
const modeDiff = curatedModeReel
  ? Object.entries(CURATED_MODE).filter(([k, v]) => curatedModeReel[k] !== v)
  : [['(reel missing)', CURATED_MODE_REEL]];
chk(`...and \`${CURATED_MODE_REEL}\`, the one CURATED reel, is exactly the owner's \`${CURATED_MODE.playMode}\`/`
  + `${CURATED_MODE.playSeconds}s/\`${CURATED_MODE.transition}\` — asserted verbatim because there is no rule to `
  + 're-derive it from',
  modeDiff.length === 0,
  modeDiff.length
    ? `differs: ${modeDiff.map(([k, v]) => `${k} is ${JSON.stringify(curatedModeReel?.[k])}, owner said `
      + `${JSON.stringify(v)}`).join('; ')}`
    : 'seven hand-ordered high-accumulation presets are the population `fade` was designed for, and `sequential` '
      + 'is what makes a hand-picked ORDER mean anything — a regeneration would silently take both away');
const twoD = BUILT_IN_REELS.find((r) => r.name === '2D');
const threeD = BUILT_IN_REELS.find((r) => r.name === '3D');
const bothDims = twoD && threeD ? twoD.presets.filter((n) => threeD.presets.includes(n)) : ['(reel missing)'];
chk('...and `2D` and `3D` name no preset in common, which `reel-store.ts` claims "by construction"',
  bothDims.length === 0,
  bothDims.length ? `in both: ${bothDims.join(', ')}`
    : `${twoD.presets.length} + ${threeD.presets.length} names, disjoint — the generator subtracts \`2D\` from `
      + '`3D`, so a preset hand-added to either one is the way this goes red');
const dupedReels = BUILT_IN_REELS
  .map((r) => ({ name: r.name, dupes: r.presets.filter((n, i) => r.presets.indexOf(n) !== i) }))
  .filter((r) => r.dupes.length > 0);
chk('...and no reel names the same preset twice (the random cursor deals from the list, so a doubled name plays '
  + 'twice a pass)',
  dupedReels.length === 0,
  dupedReels.length ? dupedReels.map((r) => `${r.name}: ${r.dupes.join(', ')}`).join('; ')
    : `checked all ${BUILT_IN_REELS.length} reels, not just \`${FULL_LIBRARY_REEL}\` — its own equality clause `
      + 'already covers duplicates, the other six had no duplicate test at all before 2026-09-24');
for (const r of BUILT_IN_REELS) {
  const res = resolveReel(r, (n) => LIBRARY_NAMES.has(n));
  console.log(`         ${r.name}: ${res.order.length}/${r.presets.length} resolve, ${r.playMode}/${r.transition}, `
    + `one pass ${passSeconds(res.order.length, r.playSeconds, r.transition).toFixed(1)}s`);
}
// ⚠️ The seed injects a typo into a COPY of the built-in reels — never into the tree — and requires the oracle
// to name it. `deadcheck` counts `src` files, so a scratch copy on disk would move an unrelated figure.
seed('a one-character typo in a built-in reel\'s preset list',
  (() => {
    const mutated = BUILT_IN_REELS.map((r) => ({ ...r, presets: r.presets.map((p, i) => (i === 0 ? `${p}x` : p)) }));
    return mutated.flatMap((r) => r.presets).filter((p) => !LIBRARY_NAMES.has(p)).length;
  })(),
  'if the name set were built wrongly — a grep basis rather than an import, or the nested VARIANT group '
  + 'missed — every name would look missing and the clause would fail rather than calibrate');
seed('a per-REEL check ("does this reel resolve to anything at all") instead of a per-NAME one',
  (() => {
    const mutated = BUILT_IN_REELS.map((r) => ({ ...r, presets: r.presets.map((p, i) => (i === 0 ? p : `${p}x`)) }));
    // The per-reel oracle is satisfied: every reel still resolves to at least one preset...
    const perReel = mutated.filter((r) => resolveReel(r, (n) => LIBRARY_NAMES.has(n)).order.length === 0).length;
    // ...while the per-name oracle sees every one of the typos.
    const perName = mutated.flatMap((r) => r.presets).filter((p) => !LIBRARY_NAMES.has(p)).length;
    return perReel === 0 && perName > 0 ? perName : 0;
  })(),
  'a reel with all but ONE of its names typo\'d still "works", so a per-reel clause reports nothing');
// ⚠️ The equality clause needs its own calibration, and BOTH one-directional forms have to be seeded: each
// one is green over a list the other rejects, so a clause written with only one of them reads exactly like a
// clause written with both.
seed('a `Grand Tour` clause that only asks "does every name resolve" (the subset direction)',
  (() => {
    const half = tourNames.slice(0, Math.floor(tourNames.length / 2));
    const resolvesOnly = half.filter((n) => !LIBRARY_NAMES.has(n)).length;      // the weak oracle: 0
    const bothWays = [...LIBRARY_NAMES].filter((n) => !half.includes(n)).length; // the real one
    return resolvesOnly === 0 && bothWays > 0 ? bothWays : 0;
  })(),
  'half the library dropped from the generated list still passes "every name resolves" — and it is the shape a '
  + 'truncated regeneration actually takes, so the missing-direction count is the only witness');
seed('a `Grand Tour` clause that only counts coverage, with no duplicate or extra test',
  (() => {
    const doubled = [...tourNames, tourNames[0], 'Preset That Was Deleted'];
    const covers = [...LIBRARY_NAMES].filter((n) => !doubled.includes(n)).length; // the weak oracle: 0
    const extra = doubled.filter((n) => !LIBRARY_NAMES.has(n)).length;
    const dupes = doubled.filter((n, i) => doubled.indexOf(n) !== i).length;
    return covers === 0 && extra + dupes > 0 ? extra + dupes : 0;
  })(),
  'a doubled name plays twice in a `random` pass and a deleted one is skipped silently — both survive a '
  + 'coverage-only clause, which is why the assertion tests three properties and not one');
// ⚠️ The `Materials` equality needs the SAME two one-directional seeds as `Grand Tour`'s, on its own base: the
// two directions fail on different edits (a retune that ADDS a material vs. one that REMOVES it) and a clause
// written with either alone is green over the list the other rejects.
seed('a `Materials` clause that only asks "does everything in the reel have a material" (the subset direction)',
  (() => {
    const half = materialNames.slice(0, Math.floor(materialNames.length / 2));
    const subsetOnly = half.filter((n) => !usesMaterial(n)).length;          // the weak oracle: 0
    const bothWays = materialNames.filter((n) => !half.includes(n)).length;  // the real one
    return subsetOnly === 0 && bothWays > 0 ? bothWays : 0;
  })(),
  'this is the shape a retune takes: a preset GAINS a material and the reel is not regenerated, so every name '
  + 'still in the reel is still correct and the clause has nothing to say');
seed('a `Materials` clause that only asks "is every material-bearing preset named" (the coverage direction)',
  (() => {
    const padded = [...materialNames, ...[...COMPOSED.keys()].filter((n) => !usesMaterial(n)).slice(0, 3)];
    const coverageOnly = materialNames.filter((n) => !padded.includes(n)).length;  // the weak oracle: 0
    const extra = padded.filter((n) => !usesMaterial(n)).length;                  // the real one
    return coverageOnly === 0 && extra > 0 ? extra : 0;
  })(),
  'the mirror edit — a preset LOSES its material — leaves it named by a reel called `Materials`, which plays '
  + 'perfectly well and is simply in the wrong reel, the one failure a resolution clause can never see');
seed('a `Geometry` clause that trusts the reel instead of re-deriving the material predicate',
  (() => {
    const withMaterial = materialNames[0];
    const mutated = [...(geometryReel ? geometryReel.presets : []), withMaterial];
    return mutated.filter(usesMaterial).length;
  })(),
  `injecting \`${materialNames[0]}\` (a material-bearing preset) into \`Geometry\` — if the predicate read `
  + '`overlay.material` for presence only, or read the union basis rather than the composed one, this would '
  + 'score 0 and the owner\'s "no materials" criterion would be unchecked');
seed('a preset hand-pasted into both `2D` and `3D`',
  (() => (twoD && threeD ? [...twoD.presets, threeD.presets[0]].filter((n) => threeD.presets.includes(n)).length : 0))(),
  'the generator subtracts one list from the other, so the only way they overlap is an edit — and an overlapping '
  + 'preset simply plays in two reels, which looks like nothing at all');
// ⚠️ The split mode clause needs a seed per HALF, because each half is green over the mutation the other
// catches. Seeding only the uniformity half is how the clause would have read before 2026-09-24 — and it is
// precisely the half that stopped covering `Fire & Plasma` when the reel was excluded from its set.
seed('a GENERATED reel given its own play time or transition',
  (() => uniformReels
    .map((r, i) => (i === 1 ? { ...r, playSeconds: 14, transition: 'fade' } : r))
    .filter((r) => r.playMode !== 'random' || r.playSeconds !== REEL_DEFAULT_SECONDS || r.transition !== 'black')
    .length)(),
  'this is exactly what the two RETIRED hand-picked reels looked like (18s/fade and 14s/black), so the clause is '
  + 'calibrated against the real previous state of the file rather than an invented one');
seed('the CURATED reel drifting off the owner\'s three values, which the uniformity half cannot see at all',
  (() => {
    const drifted = { ...curatedModeReel, playMode: 'random', playSeconds: REEL_DEFAULT_SECONDS, transition: 'black' };
    // The uniformity half excludes this reel by name, so it scores 0 no matter what the reel says...
    const uniformityHalf = [drifted]
      .filter((r) => r.name !== CURATED_MODE_REEL)
      .filter((r) => r.playMode !== 'random' || r.playSeconds !== REEL_DEFAULT_SECONDS || r.transition !== 'black')
      .length;
    // ...while the equality half names all three fields that moved.
    const equalityHalf = Object.entries(CURATED_MODE).filter(([k, v]) => drifted[k] !== v).length;
    return uniformityHalf === 0 && equalityHalf > 0 ? equalityHalf : 0;
  })(),
  'the mutation is a REGENERATION — the exact edit a later reader makes when they see six reels at `random`/20s/'
  + '`black` and one that is not, and it silently discards a hand-picked ORDER as well as the transition');
seed('a name pasted twice into a THEMED reel, where no duplicate test existed before',
  (() => {
    const mutated = THEMED_REELS.map((r, i) => (i === 0 ? { ...r, presets: [...r.presets, r.presets[0]] } : r));
    const resolvesFine = mutated.flatMap((r) => r.presets).filter((n) => !LIBRARY_NAMES.has(n)).length;
    const dupes = mutated.flatMap((r) => r.presets.filter((n, k) => r.presets.indexOf(n) !== k)).length;
    return resolvesFine === 0 && dupes > 0 ? dupes : 0;
  })(),
  'every name still resolves, so the resolution clause is green — the duplicate is visible only to a clause that '
  + 'looks for one, and before 2026-09-24 only `Grand Tour` had it');

// ===================================================================================================
console.log(`\n§K — the deployment's own reel FILE (${REEL_DEPLOYMENT_FILE}): one adopter, one shape test, one order`);
// ===================================================================================================
/*
 * v8 Phase 19.11. The reels moved out of the preset file's reserved `__reels` key and into a file of their own,
 * on the same principle as `psss_presets.json`: `.json` by extension, JavaScript by content, loaded by a
 * `<script defer>` because `fetch` cannot read a sibling under `file://`.
 *
 * ⚠️ **THE WHOLE FEATURE FAILS SILENTLY, IN FOUR DIFFERENT PLACES, AND EVERY ONE LEAVES A PAGE THAT PLAYS.**
 * That is what makes it checkable-or-nothing; there is no symptom to notice:
 *
 *   - a file the shape test refuses → the engine warns to a console nobody has open and plays the BUILT-INS,
 *     which look exactly like a deployment whose reels were never authored;
 *   - the file name spelled differently in `vite.config.ts` and `reel-store.ts` → a `dist/` that is complete and
 *     opens, with a 404 on a `<script>` tag and, again, the built-ins;
 *   - a second call site resolving the two sources → whichever adopter runs last wins, and both write the ONE
 *     `deploymentReels` field (invariant 17);
 *   - the deployment's main reel persisted → frozen at whatever the FIRST run saw, so a later build's kiosk reel
 *     is ignored on every machine that ever opened the page. This is failure 3 of this file's header, applied to
 *     the main reel instead of to a reel's contents, and it is the one that cannot be undone by shipping a fix.
 *
 * ⚠️ **THE ADOPTER IS NOT A SECOND LAYER AND `null` IS NOT AN EMPTY FILE.** `adoptDeploymentReelFile` writes the
 * same field `adoptDeploymentReels` writes, and returns `null` for "not a reel file" — which the caller MUST tell
 * apart from a valid file holding no reels, because the first is worth a warning and the second is not.
 */
const REEL_FILE_OF = (reels, main = null, version = REEL_FILE_VERSION) => ({ version, reels, mainReelName: main });
const D1 = userReel('Kiosk', ['Waves', 'Galaxy']);
const D2 = userReel('Lobby', ['Cylinder']);

// --- a well-formed file is adopted, into the DEPLOYMENT layer ---------------------------------------
const dfStore = new ReelStore(null);
const dfBefore = dfStore.count();
const dfAdopted = dfStore.adoptDeploymentReelFile(REEL_FILE_OF([D1, D2], 'Kiosk'));
chk('a well-formed reel file is adopted whole, and its reels land in the DEPLOYMENT layer',
  dfAdopted !== null && dfAdopted.reels === 2 && dfAdopted.rejected === 0 && dfAdopted.mainReelName === 'Kiosk'
  && dfStore.count() === dfBefore + 2
  && dfStore.origin('Kiosk') === 'deployment' && dfStore.origin('Lobby') === 'deployment'
  && dfStore.canRemove('Kiosk') === false,
  `${dfBefore} built-in + 2 from the file; \`origin\` is what the tab's badge and \`canRemove\` read, so a `
  + 'deployment reel landing in the USER layer would be deletable and would be persisted back — the merge would '
  + 'look right and the layering would be gone');

// --- the same layer as the legacy adopter, measured as an equality ----------------------------------
const viaFile = new ReelStore(null);
viaFile.adoptDeploymentReelFile(REEL_FILE_OF([D1, D2]));
const viaArray = new ReelStore(null);
viaArray.adoptDeploymentReels([D1, D2]);
chk('the two adopters produce the IDENTICAL merged list — one field, one layer, not a fifth',
  JSON.stringify(viaFile.list()) === JSON.stringify(viaArray.list()),
  'the file adopter carries a main reel the array adopter cannot, and that is the ONLY difference between them; '
  + 'a separate field would need its own place in `list()`, its own shadowing rule and its own eviction from '
  + '`persist()`, none of which any test would ask for');
const twice = new ReelStore(null);
twice.adoptDeploymentReels([D1, D2]);
twice.adoptDeploymentReelFile(REEL_FILE_OF([D2]));
chk('...so a second adoption REPLACES the layer rather than appending to it',
  twice.count() === dfBefore + 1 && twice.has('Lobby') && twice.has('Kiosk') === false,
  `${twice.count()} reels, not ${dfBefore + 2} — \`main.ts\` calls exactly one of the two, and this is what makes `
  + 'the accident (calling both) almost harmless: the last one wins cleanly instead of merging two sources');

// --- the shape test: what is NOT a reel file --------------------------------------------------------
/*
 * ⚠️ **THE FIRST FIXTURE IS THE MISTAKE THAT WOULD ACTUALLY BE MADE.** `[D1, D2]` is precisely what the legacy
 * `__reels` key holds, and the two adopters sit next to each other in the same class — handing one the other's
 * input is a one-line slip. The second is the same slip from the loader's side: passing the file's raw TEXT to
 * the adopter that takes an already-parsed value.
 */
const NOT_A_FILE = [
  ['a bare reels ARRAY (the legacy `__reels` shape)', [D1, D2]],
  ['the file TEXT rather than the parsed object', JSON.stringify(REEL_FILE_OF([D1]))],
  ['a file with no `version`', { reels: [D1], mainReelName: null }],
  ['a `version` that is a STRING', { version: '1', reels: [D1] }],
  ['a file with no `reels`', { version: REEL_FILE_VERSION, mainReelName: 'Kiosk' }],
  ['`reels` as an object rather than an array', { version: REEL_FILE_VERSION, reels: { a: D1 } }],
  ['`null`', null],
  ['a number', 42],
  ['the PRESET library object', LEGACY],
];
const wronglyAccepted = NOT_A_FILE.filter(([, v]) => sanitiseReelFile(v) !== null).map(([n]) => n);
chk(`none of the ${NOT_A_FILE.length} non-reel-file values is accepted, the preset library included`,
  wronglyAccepted.length === 0,
  wronglyAccepted.length ? `accepted: ${wronglyAccepted.join('; ')}`
    : 'the last fixture is the discriminator §G tests from the other end — the two deployment files must not be '
      + 'readable as each other, or a swapped pair boots with no presets and no reels');
const untouched = new ReelStore(null);
untouched.adoptDeploymentReelFile(REEL_FILE_OF([D1], 'Kiosk'));
const untouchedList = JSON.stringify(untouched.list());
const untouchedMain = untouched.mainReelName();
const rejects = NOT_A_FILE.map(([, v]) => untouched.adoptDeploymentReelFile(v));
chk('a rejected value returns `null` and changes NOTHING — no partial adoption, no cleared layer',
  rejects.every((r) => r === null)
  && JSON.stringify(untouched.list()) === untouchedList && untouched.mainReelName() === untouchedMain,
  'the dangerous half is the layer already adopted: a shape test that wrote `deploymentReels = []` before '
  + 'discovering the value was wrong would DELETE a good deployment set on a bad reload');
const emptyFile = new ReelStore(null);
const emptyAdopted = emptyFile.adoptDeploymentReelFile(REEL_FILE_OF([]));
chk('an EMPTY but valid file is not a rejection — `{reels: 0}`, never `null`',
  emptyAdopted !== null && emptyAdopted.reels === 0 && emptyAdopted.mainReelName === null
  && emptyFile.count() === dfBefore,
  'the caller warns on `null` ("this file is not a reel file") and stays silent on an empty one; collapsing the '
  + 'two makes a deliberately empty deployment file look like a corrupt one, and vice versa');

// --- ONE shape test, with a `JSON.parse` in front of it ---------------------------------------------
const AGREE = [...NOT_A_FILE.map(([n, v]) => [n, v]), ['a valid file', REEL_FILE_OF([D1, D2], 'Kiosk')],
  ['a valid EMPTY file', REEL_FILE_OF([])]];
const disagreed = AGREE.filter(([, v]) => {
  const viaValue = sanitiseReelFile(v);
  const viaText = parseReelFile(JSON.stringify(v) ?? '');
  return JSON.stringify(viaValue) !== JSON.stringify(viaText);
}).map(([n]) => n);
chk(`\`parseReelFile\` and \`sanitiseReelFile\` agree on all ${AGREE.length} values — one shape test, two doors`,
  // The TEXT fixture is the one legitimate disagreement: as a value it is a string and refused; as text it is
  // a re-encoded JSON string, still refused. Both `null`, which is why it does not appear here.
  disagreed.length === 0,
  disagreed.length ? `disagreed on: ${disagreed.join('; ')}`
    : 'the deployment hands over an OBJECT (a `<script>` assigned a global) and the Import button hands over '
      + 'TEXT; two shape tests for one format is the defect, and it would show up as a file the deployment '
      + 'plays and the Import button refuses');
chk('a FUTURE `version` is accepted and sanitised per ENTRY, so a later build\'s file still plays',
  (() => {
    const future = sanitiseReelFile(REEL_FILE_OF([D1, D2], 'Kiosk', REEL_FILE_VERSION + 1));
    return future !== null && future.reels.length === 2 && future.mainReelName === 'Kiosk';
  })(),
  `\`typeof version === 'number'\`, not \`=== ${REEL_FILE_VERSION}\` — every reel is validated field by field `
  + 'anyway, so refusing the file wholesale on its version number would trade a working set for nothing');

// --- the main reel: FOUR candidates, ONE order ------------------------------------------------------
/*
 * ⚠️ **THE DEFAULT IS NEVER NAMED HERE.** `DEFAULT_MAIN_REEL_NAME` is module-private, and spelling it in this
 * file would make the clauses below pass for the wrong reason after a rename. Each one is written as a DIFFERENCE
 * against what a fresh store answers, so the order is asserted without the checker knowing any of the four values.
 */
const freshMain = new ReelStore(null).mainReelName();
const otherBuiltIn = BUILT_IN_NAMES.find((n) => !sameReelName(n, freshMain));
const mo1 = new ReelStore(null);
mo1.adoptDeploymentReelFile(REEL_FILE_OF([], otherBuiltIn));
chk('the DEPLOYMENT\'s main reel outranks the built-in default',
  freshMain !== otherBuiltIn && mo1.mainReelName() === otherBuiltIn,
  `a fresh store answers "${freshMain}", the file asks for "${otherBuiltIn}" and gets it — before 19.11 the `
  + 'deployment layer was a bare array with nowhere to put this answer, so a kiosk build needed a SOURCE change '
  + 'to choose its own autostart reel');
const mo2 = new ReelStore(makePort(null));
mo2.adoptDeploymentReelFile(REEL_FILE_OF([D1], 'Kiosk'));
mo2.save(userReel('Mine', ['Waves']));
mo2.setMainReel('Mine');
chk('...and the USER\'s stored choice outranks the deployment\'s',
  mo2.mainReelName() === 'Mine' && mo2.storedMainReelName() === 'Mine',
  'the deployment says which reel autostarts on a machine nobody has configured; it does not get to overrule '
  + 'someone who ticked the box');
const mo3 = new ReelStore(null);
mo3.adoptDeploymentReelFile(REEL_FILE_OF([D1], 'Typo Reel'));
chk('a deployment main naming NOTHING falls through to the default rather than being returned',
  mo3.mainReelName() === freshMain && mo3.has('Typo Reel') === false,
  `"Typo Reel" is in no layer, so the answer is "${freshMain}" — an unresolved name reaches the autostart as a `
  + 'reel that cannot be found, and "Play" then does nothing at all with no message');
const mo4 = new ReelStore(makePort(null));
mo4.adoptDeploymentReelFile(REEL_FILE_OF([], 'Later'));
const mo4Before = mo4.mainReelName();
mo4.save(userReel('Later', ['Waves']));
chk('the file\'s main name is kept UNRESOLVED and re-resolved on every read — a name can arrive later',
  mo4Before === freshMain && mo4.mainReelName() === 'Later',
  'the list is not final when the file is adopted: `localStorage` is read in the constructor but an import, a '
  + 'save or a rename all happen afterwards, so validating the name at adoption time would silently discard a '
  + 'legitimate answer');
chk('the file\'s main name resolves through `sameReelName`, and the CANONICAL spelling comes back',
  (() => {
    const s = new ReelStore(null);
    s.adoptDeploymentReelFile(REEL_FILE_OF([D1], '  kIOSK  '));
    return s.mainReelName() === 'Kiosk';
  })(),
  'a hand-edited deployment file is the whole point of externalising it, so the case and the padding a human '
  + 'types must not decide whether the reel autostarts');

// --- and it is NOT persisted -----------------------------------------------------------------------
const mainPort = makePort(null);
const mpStore = new ReelStore(mainPort);
const writesBefore = mainPort.writes;
mpStore.adoptDeploymentReelFile(REEL_FILE_OF([D1, D2], 'Kiosk'));
chk('adopting the file writes NOTHING to the persistence port',
  mainPort.writes === writesBefore && mpStore.mainReelName() === 'Kiosk',
  `${mainPort.writes} write(s) after adoption, ${writesBefore} before — the resolved answer is "Kiosk" and the `
  + 'store still has no record of anyone choosing it');
mpStore.save(userReel('Mine', ['Waves']));
const mpWritten = parseReelFile(mainPort.text ?? '');
chk('...and a LATER save does not smuggle it into the payload either',
  mpWritten !== null && mpWritten.mainReelName === null
  && mpWritten.reels.length === 1 && mpWritten.reels[0].name === 'Mine',
  `the persisted file carries ${mpWritten?.reels.length} user reel and \`mainReelName: ${JSON.stringify(mpWritten?.mainReelName)}\` `
  + '— `persist()` writes `storedMainName`, which only `setMainReel` ever assigns; writing the RESOLVED value '
  + 'here is the freeze, and `toFileText()` (which does resolve) is a different verb for a different file');
seed('a store that persists the deployment\'s main reel as if the user had chosen it',
  (() => {
    // What the first run would have written, then a LATER build shipping a different main reel.
    const port = makePort(serialiseReelFile([], 'Kiosk'));
    const s = new ReelStore(port);
    s.adoptDeploymentReelFile(REEL_FILE_OF([D1, D2], 'Lobby'));
    return s.mainReelName() === 'Lobby' ? 0 : 1;
  })(),
  'if the stored name did NOT outrank the deployment, this seed could not distinguish a freeze from correct '
  + 'precedence — the two clauses above are what make the difference legible: a stored name must come from '
  + '`setMainReel` and from nowhere else');
seed('a resolution order that consults the deployment BEFORE the user\'s stored choice',
  (() => {
    const s = new ReelStore(makePort(null));
    s.adoptDeploymentReelFile(REEL_FILE_OF([D1], 'Kiosk'));
    s.save(userReel('Mine', ['Waves']));
    s.setMainReel('Mine');
    const list = s.list();
    // The swapped order, written out: deployment first, stored second.
    const swapped = ['Kiosk', 'Mine'].find((c) => list.some((r) => sameReelName(r.name, c))) ?? null;
    return swapped !== s.mainReelName() ? 1 : 0;
  })(),
  'both candidates resolve to a live reel here, which is the only configuration where the ORDER is observable at '
  + 'all — a fixture where one of them is dead would pass under either order');
seed('a `mainReelName()` that returns the deployment\'s candidate without testing membership',
  (() => {
    const s = new ReelStore(null);
    s.adoptDeploymentReelFile(REEL_FILE_OF([D1], 'Typo Reel'));
    // The unresolved form: hand back whatever the file said.
    return 'Typo Reel' !== s.mainReelName() ? 1 : 0;
  })(),
  'the resolved and unresolved forms are the same string whenever the name is correct, so a fixture with a '
  + 'VALID deployment main cannot calibrate this at all');
seed('a shape test of `typeof raw === \'object\'` only',
  NOT_A_FILE.filter(([, v]) => typeof v === 'object' && v !== null).length,
  'the lax test is the one anyone would write for a value that arrives from a `<script>` tag; if the fixture '
  + 'table held only primitives it would agree with the real test everywhere');
seed('a bespoke shape test in the store pinning `version` exactly, instead of sharing `sanitiseReelFile`',
  (() => {
    const future = REEL_FILE_OF([D1, D2], 'Kiosk', REEL_FILE_VERSION + 1);
    const bespoke = future.version === REEL_FILE_VERSION && Array.isArray(future.reels);
    return sanitiseReelFile(future) !== null && !bespoke ? 1 : 0;
  })(),
  'a second shape test is only visible when the two disagree, and a same-version fixture is exactly where they '
  + 'agree — the disagreement a duplicated test produces is forward compatibility, which no current file exercises');

// --- the emitted text, and the two names that carry it ----------------------------------------------
/*
 * ⚠️ **THE FILE IS `.json` BY EXTENSION AND JAVASCRIPT BY CONTENT, AND BOTH HALVES ARE LOAD-BEARING.** The
 * extension is what makes it obviously editable and what the preset file already established; the assignment
 * prefix is what lets a `<script>` tag deliver it, because `fetch` cannot read a sibling under `file://`. So the
 * emitted text is `g_psss_reels=` + a reel file, and BOTH readers strip the prefix with the same slice — the dev
 * branch's `fetch` and `scripts/export-library.mjs`'s round trip.
 */
const emittedText = `${REEL_DEPLOYMENT_GLOBAL}=${new ReelStore(null).toFileText()}\n`;
const emittedBack = parseReelFile(emittedText.replace(new RegExp(`^\\s*(var\\s+)?${REEL_DEPLOYMENT_GLOBAL}\\s*=\\s*`), '').replace(/;\s*$/, ''));
chk('the emitted `<global>=<reel file>` text survives the assignment-prefix slice both readers use',
  emittedBack !== null && emittedBack.rejected === 0
  && JSON.stringify(emittedBack.reels) === JSON.stringify(new ReelStore(null).list())
  && emittedBack.mainReelName === new ReelStore(null).mainReelName(),
  `${emittedText.length} bytes, ${emittedBack?.reels.length} reels, main "${emittedBack?.mainReelName}" — `
  + '`toFileText()` resolves the main reel on purpose here, so a deployment always carries an answer even when '
  + 'nobody has chosen one; the FROZEN value is a `localStorage` payload, not a shipped file');
chk('the file name and the global are shaped for their transport, and neither collides with the preset pair',
  REEL_DEPLOYMENT_FILE.endsWith('.json') && /^[A-Za-z_$][\w$]*$/.test(REEL_DEPLOYMENT_GLOBAL)
  && REEL_DEPLOYMENT_FILE !== 'psss_presets.json' && REEL_DEPLOYMENT_GLOBAL !== 'g_psss_presets',
  `"${REEL_DEPLOYMENT_FILE}" assigned to \`${REEL_DEPLOYMENT_GLOBAL}\` — a global that is not a bare identifier `
  + 'would be a syntax error in the emitted file, which the deployment reports as a console error and a page that '
  + 'plays the built-ins');

// --- the two text-scan clauses: the name, and the number of call sites ------------------------------
/*
 * ⚠️ **`vite.config.ts` CANNOT IMPORT `REEL_DEPLOYMENT_FILE`, SO THE LITERAL EXISTS TWICE.** Importing
 * `reel-store.ts` there would pull the whole `src/` graph into Vite's config resolution. `export-library.mjs`
 * closes the gap at BUILD time (it asserts the emitted `index.html` references both data files); this closes it at
 * `verify` time, which is the gate that actually runs on every change. Both halves are worth having: the build
 * check sees the emitted HTML, this one sees the source and runs without a build.
 */
const viteSrc = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
const reelsLiteralRe = new RegExp(`REELS_FILE\\s*=\\s*'${REEL_DEPLOYMENT_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
chk('`vite.config.ts` spells the SAME reel file name the store exports (the regex is asserted to match)',
  reelsLiteralRe.test(viteSrc),
  `\`${reelsLiteralRe.source}\` matched — a rename on one side alone ships a \`dist/\` that opens, 404s on one `
  + '`<script>` tag, and plays the built-in reels with nothing in the UI to say why');
const tagOrder = ['PRESET_FILE', 'REELS_FILE', 'ENTRY_JS'].map((n) => viteSrc.indexOf(`<script defer src="./\${${n}}">`));
chk('...and the packer emits all three tags DEFERRED, both data files ahead of the engine',
  tagOrder.every((i) => i >= 0) && tagOrder[0] < tagOrder[1] && tagOrder[1] < tagOrder[2],
  tagOrder.some((i) => i < 0) ? `not found: ${['preset', 'reels', 'engine'].filter((_, i) => tagOrder[i] < 0).join(', ')}`
    : '`defer` is what guarantees execution ORDER as well as DOM readiness, and the engine reads both globals '
      + 'synchronously at `init()` — a data file after the entry is undefined at the moment it is read');
// ⚠️ **THE MUTATION MUST NOT BE THE LIVE NAME.** It was `psss_reels.json` until the file was renamed to exactly
// that on 2026-09-12, at which point the seed became an IDENTITY edit and reported 0 — a seed that mutates nothing
// reads exactly like a caught one only because `seed` demands 1. Re-check this line, not just the count, if the
// name ever changes again; the hyphen form is the plausible typo now because every pre-rename doc and every
// already-deployed copy spells it that way.
seed('the reel file renamed on one side only',
  (() => {
    const mutated = viteSrc.replace(reelsLiteralRe, `REELS_FILE = 'psss-reels.json'`);
    return mutated !== viteSrc && !reelsLiteralRe.test(mutated) ? 1 : 0;
  })(),
  'the hyphen-for-underscore typo is the plausible one, and it is invisible to `tsc`, to the packer\'s own '
  + 'assertions and to every other checker');
seed('the reel tag emitted AFTER the engine\'s',
  (() => {
    // Swap the two lines in a COPY and re-run the order oracle over it.
    const reelTag = '<script defer src="./${REELS_FILE}">';
    const entryTag = '<script defer src="./${ENTRY_JS}">';
    const mutated = viteSrc.replace(reelTag, '\u0000TMP\u0000').replace(entryTag, reelTag).replace('\u0000TMP\u0000', entryTag);
    const order = [`<script defer src="./\${PRESET_FILE}">`, reelTag, entryTag].map((t) => mutated.indexOf(t));
    return order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2] ? 0 : 1;
  })(),
  'a swapped pair would leave `g_psss_reels` undefined at `init()`, which the engine reports as "no reel file '
  + 'beside index.html" — the same message a genuinely missing file produces');

/*
 * ⚠️ **INVARIANT 17'S SECOND HALF, COUNTED: how many places resolve the two sources.** The rule is not "prefer
 * the file" — it is that the choice is made in ONE function and that nothing writes the resolved value
 * afterwards. `CLAUDE.md` records the shape of the miss: grepping the READERS exonerated the buggy file, because
 * the defect was a second WRITER. So this counts call sites over the whole `src/` tree rather than reading
 * `main.ts` and trusting it.
 */
const SRC = join(ROOT, 'src');
const tsFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(SRC, f));
const callers = { adoptDeploymentReelFile: [], adoptDeploymentReels: [] };
for (const f of tsFiles) {
  const text = readFileSync(f, 'utf8');
  const rel = f.slice(SRC.length + 1).replace(/\\/g, '/');
  if (rel === 'presets/reel-store.ts') continue; // the definitions live here, by definition
  for (const m of Object.keys(callers)) if (text.includes(`${m}(`)) callers[m].push(rel);
}
chk(`each adopter is called from exactly ONE file among the ${tsFiles.length} under \`src/\`, and it is the same one`,
  callers.adoptDeploymentReelFile.length === 1 && callers.adoptDeploymentReels.length === 1
  && callers.adoptDeploymentReelFile[0] === 'main.ts' && callers.adoptDeploymentReels[0] === 'main.ts',
  `file adopter: ${callers.adoptDeploymentReelFile.join(', ') || 'nowhere'}; array adopter: `
  + `${callers.adoptDeploymentReels.join(', ') || 'nowhere'} — two call sites make the LAST one win over a field `
  + 'that has no history, and the loser leaves no trace anywhere');
const mainSrc = readFileSync(join(SRC, 'main.ts'), 'utf8');
const resolverAt = mainSrc.indexOf('function adoptDeploymentReelSource(');
// ⚠️ The next top-level function is `async function`, so both openers have to be searched — anchoring on
// `\nfunction ` alone would silently run the scan to the end of the file and stop discriminating anything.
const resolverEnd = Math.min(...['\nfunction ', '\nasync function ']
  .map((k) => mainSrc.indexOf(k, resolverAt + 1)).filter((i) => i > 0));
chk('...and both calls sit inside the one named resolver, not in the two load branches',
  resolverAt >= 0 && resolverEnd > resolverAt
  && ['adoptDeploymentReelFile(', 'adoptDeploymentReels(']
    .every((m) => { const at = mainSrc.indexOf(m); return at > resolverAt && at < resolverEnd && mainSrc.indexOf(m, at + 1) < 0; }),
  'the two load branches (`__PSSS_STANDALONE__` and the dev fetch) both call the resolver and neither adopts '
  + 'anything itself — the alternative is the same order written twice, where the second copy is the one that '
  + 'goes stale');
seed('the resolution written inline in a load branch instead of in the one resolver',
  (() => {
    const mutated = mainSrc.replace('function adoptDeploymentReelSource(', 'function adoptDeploymentReelSourceX(');
    return mutated.indexOf('function adoptDeploymentReelSource(') < 0 ? 1 : 0;
  })(),
  'the clause is anchored on the resolver\'s NAME, so it must fail when that anchor stops matching rather than '
  + 'silently asserting nothing — the failure mode `CLAUDE.md` records twice');

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  reelcheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
