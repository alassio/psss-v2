/**
 * `searchcheck` — the cross-tab settings search, held to the properties that fail SILENTLY.
 *
 * ⚠️⚠️ **THE FEATURE'S WHOLE VALUE IS THAT IT IS TOTAL, AND TOTALITY IS EXACTLY WHAT CANNOT BE SEEN BY
 * READING THE CODE.** The owner's requirement is explicit: *"any new features in the UI need to be
 * integrated into the filters and this new search if applicable"*. A search that quietly covers nine
 * tabs of ten, or that stops indexing a tab after a class rename, reports **no match** — which is
 * indistinguishable from *"that setting does not exist"*. There is no error, no console line and no
 * visual tell.
 *
 * ⚠️⚠️ **WHAT THIS FILE CAN AND CANNOT ASSERT, STATED RATHER THAN BLURRED.** The index is SCANNED from
 * the rendered DOM (see `settings-index.ts` for why that beats registering), so the coverage half is a
 * browser property and lives in `uicheck.mjs`, which is outside `verify` by the same design decision
 * that put the rest of `uicheck` there. **What is checkable under Node is everything else**: the
 * matching law, the ranking, the id rule, the totality of the two `Record`s, and — §E — that the DOM
 * contract the scanner depends on is still present in the files that must honour it.
 *
 * ⚠️ **A measuring section's own basis has been the defect repeatedly in this project**, so every
 * clause here is seeded in §F and shown to FAIL on the defect it exists to catch.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0;
let fail = 0;
let calib = 0;
const chk = (n, ok, x = '') => {
  if (ok) { pass++; console.log(`  PASS  ${n}${x ? `   ${x}` : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${x ? `   ${x}` : ''}`); }
};
const seeded = (n, caught, x = '') => {
  if (caught) { calib++; console.log(`  CALIB  ${n} — seeded defect caught${x ? `   ${x}` : ''}`); }
  else { fail++; console.log(`  CALIBRATION FAIL  ${n} — seeded defect NOT CAUGHT${x ? `   ${x}` : ''}`); }
};

const M = await import('../src/ui/synthesis-lab/settings-search.ts');

/** A fixture entry. Deliberately verbose: every field is one the law reads. */
const E = (label, tabLabel, path, tip, reach = 'visible', kind = 'control', gate = null) => ({
  id: M.entryId(tabLabel, path, label),
  label, tabId: tabLabel.toLowerCase(), tabLabel, path, kind, tip, reach, gateLabel: gate,
});

const FIX = [
  E('Symmetry', 'Visual FX', ['Figure', 'Deformation'], 'dihedral symmetry order, 1-12. 1 is OFF'),
  E('Mirror', 'Visual FX', ['Figure', 'Deformation'], 'mirror each symmetry fold', 'collapsed'),
  E('Box Fold', 'Visual FX', ['Figure', 'Deformation'], 'reflects the figure at a limit'),
  E('Symmetry', 'Sliders', ['Figure'], 'the slider copy of the fold'),
  E('Neon', 'Visual FX', ['Colour', 'Film Look', 'Look'], 'a saturated look', 'visible', 'value'),
  E('Roll', 'Composer', ['Curve'], 'the third turn axis', 'absent'),
  E('Dye Blend', 'Visual FX', ['Fields', 'Dye Field'], 'how much dye reaches the frame', 'hidden',
    'control', 'Enable'),
];

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the search law: AND over terms, empty query, cap after sort ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

chk('an EMPTY query returns nothing, not everything',
  M.searchSettings(FIX, '', 10).length === 0 && M.searchSettings(FIX, '   ', 10).length === 0,
  '⚠️ the OPPOSITE of the facet drawer\'s rule, and deliberate: that drawer narrows a list already on '
  + 'screen, while this one is a dropdown that must not spring open with every control in the Lab the '
  + 'moment the field is focused');

const two = M.searchSettings(FIX, 'symmetry mirror', 10);
chk('every term must match — a second word NARROWS',
  two.length === 1 && two[0].entry.label === 'Mirror',
  `"symmetry mirror" → ${two.map((h) => h.entry.label).join(', ') || '(none)'}; `
  + '⚠️ an OR here would widen, which reads as the search ignoring what you typed');

chk('...and a term that matches nothing drops the entry entirely',
  M.searchSettings(FIX, 'symmetry zzzz', 10).length === 0);

const capped = M.searchSettings(FIX, 'the', 2);
chk('the cap truncates AFTER the sort, so it can never hide a better hit',
  capped.length <= 2 && (capped.length < 2 || capped[0].score >= capped[1].score),
  '⚠️ the grid\'s own name search had this defect: a truncated dropdown showed fewer names than the '
  + 'filter had matched');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. the ranking: where the term landed, never how often ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

const symm = M.searchSettings(FIX, 'symmetry', 10);
chk('a LABEL match outranks a TIP match',
  symm.length >= 3 && symm[0].matched === 'label' && symm[symm.length - 1].matched === 'tip',
  symm.map((h) => `${h.entry.label}:${h.matched}`).join(' '));

const fold = M.searchSettings(FIX, 'fold', 10);
chk('a WORD-START in a label outranks a mid-word one',
  fold.length > 0 && fold[0].entry.label === 'Box Fold',
  `"fold" → ${fold.map((h) => h.entry.label).join(', ')}; ⚠️ Box Fold starts a word, the others only `
  + 'contain the letters');

/*
 * ⚠️⚠️ **THE NOISE CLAUSE, AND IT IS A MEASURED CORRECTION RATHER THAN A PRECAUTION.** With a substring
 * tier over tooltips, searching `roll` returned four Film Look rows and one Evolution row before
 * anything named Roll, because a tooltip containing *"cont-roll-ed"* matched. A tooltip is PROSE: a
 * substring over it hits inside words constantly.
 */
const noise = [E('Mutation strength', 'Evolution', [], 'how far each value is controlled')];
chk('a tooltip matches on a WORD START only — "roll" must not find "controlled"',
  M.searchSettings(noise, 'roll', 10).length === 0,
  '⚠️ and the LABEL keeps its substring tier on purpose: labels are short and curated, and that is '
  + 'where a mid-word match is wanted');

chk('...while a real word in a tooltip still matches',
  M.searchSettings(noise, 'controlled', 10).length === 1);

const reachTie = [
  E('Thing', 'A', [], 'x', 'absent'),
  E('Thing', 'B', [], 'x', 'visible'),
];
chk('with scores equal, the entry you can REACH comes first',
  M.searchSettings(reachTie, 'thing', 10)[0].entry.reach === 'visible',
  '⚠️ `REACH_RANK` is the owner of that order, as a Record, so a new state is a compile error rather '
  + 'than a silent `undefined` in the comparator');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. the id rule: a label is NOT a primary key ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ids = new Set(FIX.map((e) => e.id));
chk('every fixture entry has a distinct id, including the two different `Symmetry` rows',
  ids.size === FIX.length, `${ids.size} of ${FIX.length}`);

chk('the id is built from tab + path + label, so a shared label cannot collapse two controls',
  M.entryId('materials', ['Sparks'], 'Enable') !== M.entryId('materials', ['Crystals'], 'Enable'),
  '⚠️ **Materials labels three different checkboxes just `Enable`** and relies on the section heading '
  + 'to tell them apart on screen — a label-keyed index would have merged them');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. the two Records are TOTAL over their unions ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

const REACHES = ['visible', 'collapsed', 'hidden', 'absent'];
const srcSearch = rd('src/ui/synthesis-lab/settings-search.ts');
const declared = [...srcSearch.matchAll(/export type SettingsReach =([^;]+);/g)]
  .flatMap((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]));
chk('`SettingsReach` declares exactly the four states this file knows about',
  declared.length === REACHES.length && REACHES.every((r) => declared.includes(r)),
  `declared [${declared.join(', ')}]`);

chk('`REACH_RANK` covers every state, with no two sharing a rank',
  REACHES.every((r) => typeof M.REACH_RANK[r] === 'number')
  && new Set(REACHES.map((r) => M.REACH_RANK[r])).size === REACHES.length,
  REACHES.map((r) => `${r}=${M.REACH_RANK[r]}`).join(' '));

/*
 * ⚠️ **`reachReason` must ANSWER for every state, and the two that return `null` must do so because
 * they are reachable — not because the `switch` fell through.** A missing case returns `undefined`,
 * which the row builder treats exactly like `null`: the reason line simply never renders, and an
 * `absent` entry then looks like a normal one you can click.
 */
const reasons = REACHES.map((r) => M.reachReason({ ...FIX[0], reach: r, gateLabel: 'Enable' }));
chk('`reachReason` answers for all four states, and only the reachable two answer `null`',
  reasons[0] === null && reasons[1] === null
  && typeof reasons[2] === 'string' && typeof reasons[3] === 'string',
  reasons.map((x, i) => `${REACHES[i]}:${x === null ? 'null' : 'text'}`).join(' '));

chk('...and a `hidden` entry with NO gate still gets a sentence',
  typeof M.reachReason({ ...FIX[0], reach: 'hidden', gateLabel: null }) === 'string',
  '⚠️ the gate is a HEURISTIC and is allowed to fail; what is not allowed is a hidden row with no '
  + 'explanation, which reads as a jump that simply does nothing');

chk('`formatPath` always leads with the TAB',
  M.formatPath(FIX[0]).startsWith('Visual FX'), M.formatPath(FIX[0]));

/*
 * ⚠️⚠️ **`pathSegments` RETURNS THE TAB SEPARATELY BECAUSE THE PATH IS THE DECISION INFORMATION, AND IT
 * SHIPPED AS THE DIMMEST THING ON THE ROW.** Owner-reported: *"the location of the functionality is an
 * important information to decide which of the hits is the right one"* — three rows called `Symmetry`
 * are told apart by nothing else. The label answers *is this the thing*; the path answers *is this the
 * RIGHT one*. This clause pins the shape the row's emphasis depends on, so a future change that flattens
 * it back into one string fails here rather than quietly returning the row to small print.
 */
const seg = M.pathSegments(FIX[0]);
chk('`pathSegments` separates the tab from the rest, losing nothing',
  seg.tab === 'Visual FX'
  && [seg.tab, ...seg.rest].join(' › ') === M.formatPath(FIX[0]),
  `tab "${seg.tab}" + [${seg.rest.join(', ')}] reassembles to "${M.formatPath(FIX[0])}"`);

chk('...and a row that sits directly on a tab still names the tab',
  M.pathSegments(FIX[5]).tab === 'Composer' && M.pathSegments(FIX[3]).rest.length === 1,
  '⚠️ the tab is never omitted, even for a hit in the tab you are already on: a path that starts at '
  + 'the group is ambiguous across ten tabs');

/*
 * ⚠️⚠️ **A TIP-ONLY HIT MUST CARRY THE FRAGMENT THAT MATCHED, AND THIS CLAUSE EXISTS BECAUSE ONE DID
 * NOT AND WAS REPORTED AS A FALSE POSITIVE.** Searching `symme` returned `Master crossfader`, whose
 * tooltip names *"symmetry fold"* among the categorical fields the Mixer SNAPS rather than blends —
 * a TRUE hit that the row gave no way to judge. **The tempting fix was to drop tip-only hits, which
 * would have discarded a correct answer invisibly**; the shipped fix shows the evidence instead, so
 * this asserts the evidence exists and actually contains the term.
 */
const mixerLike = E('Master crossfader', 'Mixer', ['Crossfader'],
  'The master blend. Continuous values move smoothly between the decks; categorical ones — render '
  + 'mode, curl noise, symmetry fold, material, TransMap style — cannot be half-way, so they SNAP.');
const mixHit = M.searchSettings([mixerLike], 'symme', 5);
const snip = mixHit.length === 1 ? M.tipSnippet(mixerLike, 'symme') : null;
chk('a tooltip-only hit yields a snippet, and the snippet contains the matched term',
  mixHit.length === 1 && mixHit[0].matched === 'tip'
  && snip !== null && snip.match.toLowerCase() === 'symme'
  && (snip.before + snip.match + snip.after).includes('symmetry fold'),
  snip === null ? '(no snippet)' : `"${snip.before}[${snip.match}]${snip.after}"`);

chk('...and a LABEL hit gets no snippet, so the list is not a wall of prose',
  M.searchSettings(FIX, 'symmetry', 10)[0].matched === 'label',
  '⚠️ the snippet is evidence for the rows that need it, never a second description for every row — '
  + 'it would bury the PATHS, which are the actual answer to "where does this live"');

/*
 * ⚠️ The snippet's own window rule: it must obey the SAME word-start law as the scoring, or the row
 * could show a fragment that does not explain the match it is evidence for.
 */
const midWord = E('x', 'y', [], 'this value is controlled elsewhere');
chk('the snippet honours the word-start law, so it cannot explain a match the law did not make',
  M.tipSnippet(midWord, 'roll') === null && M.searchSettings([midWord], 'roll', 5).length === 0,
  '"controlled" contains "roll" mid-word: neither the law nor the snippet accepts it');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. the DOM contract the scanner depends on is still honoured ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️⚠️ **THE SCAN READS THE DOM, SO THE DOM IS A CONTRACT — AND A CONTRACT NOTHING ELSE ENFORCES.**
 * These clauses are the Node-side half: the classes the scanner anchors on must still be the ones the
 * builders emit, and every tab must contribute something indexable. The browser-side half (does the
 * live index actually contain a known control from each tab) is in `uicheck.mjs`.
 */
const srcIndex = rd('src/ui/synthesis-lab/settings-index.ts');
const anchors = ['sl-vfx-group-body', 'sl-section-title', 'sl-vfx-group-head', 'sl-vfx-sub-head'];
for (const cls of anchors) {
  const inScanner = srcIndex.includes(cls) || rd('src/ui/synthesis-lab/settings-search-panel.ts').includes(cls);
  const inBuilder = rd('src/ui/synthesis-lab/collapsible.ts').includes(cls)
    || rd('src/ui/synthesis-lab/tabs/visual-fx.ts').includes(cls);
  chk(`the anchor class \`${cls}\` is emitted by a builder AND read by the scanner`,
    inScanner && inBuilder,
    `scanner ${inScanner ? 'yes' : 'NO'} · builder ${inBuilder ? 'yes' : 'NO'}`);
}

/*
 * ⚠️⚠️ **THE FILTER DRAWER MUST STAY EXCLUDED, AND ITS CLASS NAMES ARE THE ONLY THING DOING IT.** The
 * Reel tab hosts a copy of the drawer; its chips carry a COMPOSED accessible name, and before the
 * exclusion the results showed *"Symmetry fold, 2 presets, not filtered"* beside the real control.
 * **A rename in `filter-drawer.ts` would silently re-pollute the index**, so the names are asserted
 * against that file rather than trusted.
 */
const skip = [...srcIndex.matchAll(/const SKIP_SUBTREES = '([^']+)'/g)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/^\./, '')));
const drawerSrc = rd('src/ui/preview-grid/filter-drawer.ts');
chk('every class in `SKIP_SUBTREES` still exists where it is meant to be skipped',
  skip.length > 0 && skip.every((c) => drawerSrc.includes(c) || srcIndex.includes(c)
    || rd('src/ui/synthesis-lab/panel.css').includes(c)),
  `skipping [${skip.join(', ')}]`);

chk('...and the preset filter drawer is one of them',
  skip.some((c) => drawerSrc.includes(c)),
  '⚠️ a filter chip is worth having only when enough PRESETS carry the feature, while a settings entry '
  + 'is worth having for every CONTROL — two universes, and merging them in one list is the defect');

/*
 * Every tab file must contribute something the scan can see: an `aria-label`, or a `<button>` whose
 * text is its name. ⚠️ **Measured: Randomise, Evolution and History hold ZERO labelled inputs between
 * them** — which is why buttons are indexed at all, and why this clause tests for either.
 */
const tabFiles = readdirSync(join(ROOT, 'src/ui/synthesis-lab/tabs')).filter((f) => f.endsWith('.ts'));
const noneIndexable = [];
for (const f of tabFiles) {
  const s = rd(`src/ui/synthesis-lab/tabs/${f}`);
  if (!s.includes('aria-label') && !s.includes('createElement(\'button\')')) noneIndexable.push(f);
}
chk(`all ${tabFiles.length} tab modules emit something the scan can index`,
  noneIndexable.length === 0,
  noneIndexable.length === 0
    ? 'every tab contributes an `aria-label` or a labelled button'
    : `UNINDEXABLE: ${noneIndexable.join(', ')} — a tab with neither is INVISIBLE to the search, and `
      + 'the search reports that as "no match"');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. calibration — every clause above, seeded and shown to fail ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

// (a) An OR over terms instead of AND — the widening direction a search defect hides in.
const orLaw = (entries, q) => {
  const terms = M.queryTerms(q);
  return entries.filter((e) => terms.some((t) => `${e.label} ${e.tip}`.toLowerCase().includes(t)));
};
seeded('an OR over the query terms instead of an AND',
  orLaw(FIX, 'symmetry mirror').length > 1,
  `${orLaw(FIX, 'symmetry mirror').length} hits where the AND law gives 1`);

// (b) An empty query matching everything — the facet drawer's rule, wrong here.
seeded('an empty query treated as "match everything", as the facet drawer does',
  FIX.length > 0 && M.searchSettings(FIX, '', 10).length === 0 && FIX.length !== 0);

/*
 * (c) A frequency score instead of a positional one: the longest tooltip wins.
 *
 * ⚠️⚠️ **THE FIRST VERSION OF THIS SEED RAN OVER `FIX` AND DID NOT DISTINGUISH THE TWO LAWS — it
 * reported CALIBRATION FAIL, which is the calibration working on the calibration.** In `FIX` the entry
 * whose LABEL is `Symmetry` also happens to mention the word most often, so both laws agree and the
 * seed proved nothing. **A seed needs a fixture where the two laws DISAGREE**, which is this one: a
 * control whose label does not contain the term at all, and whose tooltip repeats it three times.
 */
const FREQ_FIX = [
  E('Symmetry', 'Visual FX', ['Figure'], 'dihedral order'),
  E('Trail Decay', 'Visual FX', ['Particles'],
    'symmetry changes how the trail reads: a symmetry fold repeats the stroke, and symmetry is '
    + 'therefore the control to check first'),
];
const freqScore = (e, t) => (`${e.label} ${e.tip}`.toLowerCase().split(t).length - 1);
const byFreq = [...FREQ_FIX].sort((a, b) => freqScore(b, 'symmetry') - freqScore(a, 'symmetry'));
const byLaw = M.searchSettings(FREQ_FIX, 'symmetry', 10);
seeded('a frequency score, which ranks the most talkative tooltip above the control itself',
  byFreq[0].label === 'Trail Decay' && byLaw[0].entry.label === 'Symmetry',
  `frequency puts "${byFreq[0].label}" first (${freqScore(byFreq[0], 'symmetry')} mentions); the `
  + `positional law puts "${byLaw[0].entry.label}" first`);

// (d) A label-keyed index, which merges Materials' three `Enable` checkboxes.
const labelKeyed = new Set(FIX.map((e) => e.label));
seeded('a LABEL-keyed index, which collapses the two different `Symmetry` controls',
  labelKeyed.size < FIX.length, `${labelKeyed.size} keys for ${FIX.length} entries`);

// (e) A tooltip substring tier, which is how "roll" found "controlled".
const substrTier = (entries, q) => entries.filter((e) => e.tip.toLowerCase().includes(q));
seeded('a tooltip SUBSTRING tier, which matches inside words',
  substrTier(noise, 'roll').length === 1,
  'the shipped law requires a word start and returns 0 for this query');

// (f) `reachReason` with a case missing — returns `undefined`, which renders as no reason at all.
const partialReason = (e) => (e.reach === 'hidden' ? 'x' : null);
seeded('a `reachReason` missing the `absent` case, so an unavailable row looks clickable',
  partialReason({ reach: 'absent' }) === null,
  '⚠️ `undefined`/`null` is treated exactly like "reachable" by the row builder — the reason line '
  + 'simply never renders');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  searchcheck: ${pass} passed, ${fail} failed, ${calib} calibrated`);
process.exit(fail === 0 ? 0 : 1);
