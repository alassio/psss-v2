/**
 * tipcheck — every UI control and header has a tooltip, and every tooltip reaches a control.
 *
 * ## Why this exists
 *
 * The tooltip pass (2026-08-28) moved the UI's explanatory prose out of inline paragraphs and into ONE table
 * (`src/ui/synthesis-lab/tooltips.ts`), keyed by each control's own descriptor `key` and each header's own
 * TEXT. That shape is the right one — it satisfies the descriptor-table rule and it is one site instead of
 * 82 — but it has exactly one failure mode, and `tsc` cannot represent it:
 *
 *   ⚠️ **`Record<string, string>` type-checks whatever key it holds.** Rename a descriptor key or retitle a
 *   header and its tooltip silently stops resolving — the control still works, still syncs, still renders, and
 *   simply has no hover text. Nothing throws, no test fails, and a browser pass sees a perfectly normal
 *   control unless the reviewer happens to hover that one. The inverse is equally silent: a table entry whose
 *   key no longer exists is dead weight that reads as coverage.
 *
 * So this is a COVERAGE checker in both directions, which is the property the table's own header claims and
 * could not previously assert. It is a text-pattern grep by necessity (the descriptors are TS object literals
 * inside a 3400-line class), and per `CLAUDE.md` that means **read the assertion before believing a failure is
 * a regression** — a new control legitimately fails §A until its tooltip is written, which is the point.
 *
 * ⚠️ **`stripComments()` is load-bearing**, exactly as it is in `deadcheck` and `trackcheck`: `visual-fx.ts`
 * has more prose in doc comments than in code, and several comments quote `key: '...'` while explaining a
 * defect. Without the strip, §B reports phantom uncovered keys that no control has.
 *
 * ## Sections
 *
 *   §A  every `key:` in a control descriptor has a `CONTROL_TIPS` entry
 *   §B  every `CONTROL_TIPS` entry is used by some descriptor        (no dead entries)
 *   §C  every `sectionTitle()` / `subTitle()` literal has a `HEADER_TIPS` entry
 *   §D  every `HEADER_TIPS` entry is used by some header            (no dead entries)
 *   §E  every `TAB_DEFS` entry carries a non-empty `hint`
 *   §F  every `SEMANTIC_SLIDERS` def carries a non-empty `hint`
 *   §G  no tooltip is empty, and none is so long it is prose in a worse place
 *   §H  the three HAND-WIRED tables resolve both ways: `TAB_TIPS`, `LOCK_CATEGORY_TIPS`, `DIALOG_TIPS`
 *   §I  the INLINE copy stays at one or two sentences — the half of the brief the tooltips do not cover
 *   §J  the facet filter's chrome text <-> its reader                (v8 Phase 22)
 *   §K  the warp wave-shape notices and BOTH dropdowns              (v8 35.4)
 */
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url);
const read = p => readFileSync(new URL(p, SRC), 'utf8');

/**
 * Strip `//` and block comments. ⚠️ Skips string literals so an apostrophe or a URL inside prose cannot
 * desynchronise the scan — the naive version ate the rest of the file at the first `don't`.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Keys of a top-level `export const NAME: Record<string, string> = { ... }` object literal. */
function tableKeys(src, name) {
  const start = src.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`tipcheck: no export named ${name} in tooltips.ts`);
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(open, end);
  const keys = new Set();
  // A key is at the start of a line: bare identifier, or quoted (dotted group keys like `cp.glow`).
  for (const m of body.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:/gm)) {
    keys.add(m[1] ?? m[2]);
  }
  if (keys.size === 0) throw new Error(`tipcheck: parsed 0 keys out of ${name}`);
  return keys;
}

/** Values of a table, for the length/emptiness assertions. Concatenated `+` string parts are joined. */
function tableValues(src, name) {
  const start = src.indexOf(`export const ${name}`);
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(open, end);
  const out = new Map();
  for (const m of body.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+),?$/gm)) {
    const key = m[1] ?? m[2];
    const text = [...m[3].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]).join('');
    out.set(key, text);
  }
  return out;
}

/**
 * The object literal that ENCLOSES `idx`, found by walking out to the balancing braces.
 *
 * ⚠️ **A window of N characters after the match is NOT a substitute and was the first version's defect.** A
 * lazy `[\s\S]{0,2000}?` lets one descriptor claim a LATER descriptor's field and then consumes the
 * intervening ones, so four defs that genuinely had a `hint` were reported as missing while the def that
 * lacked one passed. Balance the braces; do not guess a distance.
 */
function enclosingLiteral(src, idx) {
  let depth = 0;
  let start = -1;
  for (let i = idx; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return '';
  depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return src.slice(start);
}

const failures = [];
const fail = (section, msg) => failures.push(`§${section} ${msg}`);
let assertions = 0;
const ok = () => { assertions++; };

const tips = read('ui/synthesis-lab/tooltips.ts');
const vfxRaw = read('ui/synthesis-lab/tabs/visual-fx.ts');
const vfx = stripComments(vfxRaw);

const controlTips = tableKeys(tips, 'CONTROL_TIPS');
const headerTips = tableKeys(tips, 'HEADER_TIPS');

// ---- §A/§B: control descriptors <-> CONTROL_TIPS ------------------------------------------------------
//
// A descriptor key is `key: 'x'` inside a spec literal. The layer-body controls (`layerSlider`, and the
// hand-built selects in the style bodies) carry a REQUIRED literal `title` instead and are not in the table,
// so they are correctly absent from both sides of this comparison.
const descriptorKeys = new Set();
/** Descriptors carrying their OWN `title` — the table deliberately does not duplicate these. */
const selfTitled = new Set();
for (const m of vfx.matchAll(/\bkey:\s*'([^']+)'/g)) {
  descriptorKeys.add(m[1]);
  // ⚠️ A descriptor with its own `title` is COVERED, not missing: `tipFor()` resolves `spec.title` FIRST,
  // and those four texts are derived from the control's own arithmetic (Dispersion's feedback bound, the
  // gate's half-life units, Rotation's nominal-rate caveat) — precisely what a shared table cannot state.
  if (/\btitle:/.test(enclosingLiteral(vfx, m.index))) selfTitled.add(m[1]);
}
if (descriptorKeys.size < 50) fail('A', `parsed only ${descriptorKeys.size} descriptor keys — the scan is broken, not the code`);
else ok();
if (selfTitled.size === 0) fail('A', 'found no self-titled descriptor — the enclosing-literal walk is broken');
else ok();

for (const k of [...descriptorKeys].sort()) {
  if (!controlTips.has(k) && !selfTitled.has(k)) fail('A', `descriptor '${k}' has neither a CONTROL_TIPS entry nor its own title`);
}
ok();

for (const k of [...controlTips].sort()) {
  if (!descriptorKeys.has(k)) fail('B', `CONTROL_TIPS['${k}'] matches no descriptor — renamed or removed?`);
  if (selfTitled.has(k)) fail('B', `CONTROL_TIPS['${k}'] is shadowed: that descriptor has its own title, so this entry never shows`);
}
ok();

// ---- §C/§D: headers <-> HEADER_TIPS ------------------------------------------------------------------
const headerTexts = new Set([
  ...[...vfx.matchAll(/this\.sectionTitle\('([^']+)'/g)].map(m => m[1]),
  // v8 31.U — the five collapsible GROUP headers. ⚠️ `groupTitle` reads HEADER_TIPS exactly as
  // `sectionTitle` does, so it must be matched here or §C/§D would enforce only half the surface.
  ...[...vfx.matchAll(/this\.groupTitle\('([^']+)'/g)].map(m => m[1]),
  ...[...vfx.matchAll(/this\.subTitle\('([^']+)'/g)].map(m => m[1]),
]);
if (headerTexts.size < 15) fail('C', `parsed only ${headerTexts.size} header literals — the scan is broken`);
else ok();

for (const t of [...headerTexts].sort()) {
  if (!headerTips.has(t)) fail('C', `header '${t}' has no HEADER_TIPS entry`);
}
ok();

for (const t of [...headerTips].sort()) {
  if (!headerTexts.has(t)) fail('D', `HEADER_TIPS['${t}'] matches no header — retitled or removed?`);
}
ok();

// ---- §E: the 9 Lab tab buttons ------------------------------------------------------------------------
const panel = stripComments(read('ui/synthesis-lab/panel.ts'));
// ⚠️ **Non-emptiness, not presence.** The first version tested only that `hint:` appeared, and calibration
// caught it: `hint: ''` type-checks, satisfies the required field, sets `btn.title = ''` — which the browser
// treats as NO tooltip — and passed. A required field is not a filled one.
const tabIds = [...panel.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)];
// ⚠️ **A `<` BOUND IS A SCAN-HEALTH GUARD, NOT A COUNT — do not "tighten" it to `!==`.** It exists so the
// section fails loudly if the regex stops matching, rather than passing green over zero entries. Raised 8 → 9
// on 2026-09-06 with the Composer, which also makes it the one assertion that notices a `TabId` member never
// reaching the tab bar: `TabId` is dispatched through a `Map`, so `tsc` cannot.
if (tabIds.length < 9) fail('E', `found ${tabIds.length} TAB_DEFS entries, expected at least 9 — the scan is broken, or a tab id never reached the bar`);
else ok();
for (const m of tabIds) {
  const hint = /\bhint:\s*'((?:[^'\\]|\\.)*)'/.exec(enclosingLiteral(panel, m.index));
  if (!hint) fail('E', `TAB_DEFS '${m[2]}' has no hint`);
  else if (hint[1].trim().length < 20) fail('E', `TAB_DEFS '${m[2]}' has an empty or near-empty hint (${hint[1].trim().length} chars)`);
}
ok();
if (!/btn\.title\s*=/.test(panel)) fail('E', 'TAB_DEFS carries hints but no tab button assigns .title — invariant 13');
else ok();

// ---- §F: the 10 semantic sliders ----------------------------------------------------------------------
//
// `sliders.ts` already applied `def.hint` to the row AND the label before this pass — the wiring was live and
// 8 of the 10 defs simply had no hint, so those rows showed nothing. That is the shape this section guards:
// present wiring, absent data.
const mappings = stripComments(read('exploration/slider-mappings.ts'));
const sliderDefs = [...mappings.matchAll(/\n    id:\s*'([^']+)'/g)];
if (sliderDefs.length < 10) fail('F', `found ${sliderDefs.length} SEMANTIC_SLIDERS, expected 10 — the scan is broken`);
else ok();
for (const m of sliderDefs) {
  if (!/\bhint:/.test(enclosingLiteral(mappings, m.index))) {
    fail('F', `SEMANTIC_SLIDERS '${m[1]}' has no hint, so its row shows no tooltip`);
  }
}
ok();
if (!/def\.hint/.test(stripComments(read('ui/synthesis-lab/tabs/sliders.ts')))) {
  fail('F', 'sliders.ts no longer reads def.hint — every hint above is inert (invariant 13)');
} else ok();

// ---- §G: the tooltips are neither empty nor prose -----------------------------------------------------
//
// ⚠️ The upper bound is a JUDGEMENT, not a measurement, and it is here to hold the line the brief drew: the
// inline paragraphs were cut because the UI was cluttered, and a 900-character tooltip is the same prose in a
// worse place. 600 is comfortably above every entry written for this pass (worst: 420) and well below the
// paragraphs that were removed (worst: 1183).
const MAX_TIP = 600;
// ⚠️ **`LOCK_CATEGORY_TIPS` is deliberately NOT in this loop.** Its values are noun PHRASES that a tab
// composes a verb around ("Freeze <phrase> at its blended value"), so the shortest is 34 characters — below
// the 20-char floor's intent but nowhere near a full sentence. It gets its own floor in §H, measured against
// its own shape rather than judged by a table it is not a member of. `DIALOG_TIPS` and `TAB_TIPS` ARE full
// sentences, so they belong here.
for (const name of ['CONTROL_TIPS', 'HEADER_TIPS', 'MATERIAL_TIPS', 'CHROME_TIPS', 'TAB_TIPS', 'DIALOG_TIPS']) {
  const vals = tableValues(tips, name);
  // ⚠️ **Coverage of the value parser itself.** `tableValues` matches a `'...' + '...'` concatenation, and an
  // entry written some other way (a template literal, a helper call) would simply not appear — so every
  // assertion below would pass by not looking. Compare against the KEY count, which is parsed independently.
  const keyCount = tableKeys(tips, name).size;
  if (vals.size !== keyCount) {
    fail('G', `${name}: parsed ${vals.size} values but ${keyCount} keys — ${keyCount - vals.size} entr(ies) escape the length checks`);
  }
  for (const [k, v] of vals) {
    if (v.trim().length < 20) fail('G', `${name}['${k}'] is empty or near-empty (${v.trim().length} chars)`);
    if (v.length > MAX_TIP) fail('G', `${name}['${k}'] is ${v.length} chars, over the ${MAX_TIP} ceiling — that is a paragraph, not a tooltip`);
  }
}
ok();

// ---- §H: the hand-wired tables <-> their readers ------------------------------------------------------
//
// Six tabs (Mixer, Randomise, Sliders, Archetypes, Evolution, History) and the three modal dialogs are NOT
// descriptor-driven — they have a handful of controls each, so they are hand-wired by necessity. `TAB_TIPS`
// and `DIALOG_TIPS` exist so the COPY still lives beside the rest of the UI's text, and that shape has the
// same single failure mode §A/§B guard for the descriptors: a `Record<string, string>` type-checks whatever
// key it holds, so `TAB_TIPS['evo.aply']` compiles, resolves to `undefined`, and the non-null `!` at the call
// site turns it into `title = "undefined"` — a tooltip that reads as a bug rather than as missing text.
//
// ⚠️ **The subscript is not always a bare literal.** `mixer.ts` reads
// `TAB_TIPS[label === 'A' ? 'mixer.deckA' : 'mixer.deckB']`, so a scan that captures ONE quoted string per
// `[...]` would see `mixer.deckA` alone and report `mixer.deckB` as dead. Collect EVERY literal inside the
// subscript. A non-literal subscript (`TAB_TIPS[someVar]`) is reported rather than ignored: it defeats the
// coverage check entirely, which is worth knowing about at the moment it is introduced.
//
// ⚠️ **THIS LIST IS THE SCAN'S ENTIRE SCOPE, so a new hand-wired tab that is not added here is checked by
// NOTHING — and it fails in the direction that looks like a pass.** Its keys would be reported as read by no
// tab (a loud failure, which is fine), but every `TAB_TIPS['typo']` in the unlisted file would resolve to
// `undefined` and set `title = "undefined"` with no assertion able to see it. `composer` was added 2026-09-06
// with v8 Phase 16; ⚠️ **add the file in the same edit that adds its reads** — the same rule `glslcheck`'s
// `FILES` list earned the hard way, where listing a file was not even sufficient because its naming convention
// escaped the scan.
// ⚠️ **`transmap` was added 2026-09-22 with v8 21.12, and this list is the ONLY instrument that saw the new
// `TabId` at all** — `tsc` does not, because the dispatch is a `Map` and `TAB_TIPS` is a `Record<string,
// string>` that type-checks any key. Not adding it would have left every one of that tab's ~23 reads free to
// resolve to `undefined`.
// ⚠️ **`archetypes` was REMOVED from this list on 2026-10-04 with the tab itself**, and removal is the
// direction that fails LOUDLY rather than silently: the name is mapped to a file path, so a stale entry
// makes `read()` throw instead of producing a finding. The quiet half is the OTHER side — `TAB_TIPS`
// entries that were only read by the deleted tab become unread, which is what §H's second direction is
// for. **Delete a tab's `TAB_TIPS` keys in the same edit that drops it from here.**
const TAB_FILES = ['mixer', 'randomiser', 'sliders', 'evolution', 'history', 'composer', 'transmap', 'reel']
  .map(n => `ui/synthesis-lab/tabs/${n}.ts`);

/** Every string literal appearing in a `NAME['...']` subscript across `files`. */
function subscriptLiterals(name, files) {
  const found = new Set();
  let dynamic = 0;
  for (const f of files) {
    const src = stripComments(read(f));
    for (const m of src.matchAll(new RegExp(`\\b${name}\\[([^\\]]*)\\]`, 'g'))) {
      const lits = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]);
      if (lits.length === 0) dynamic++;
      for (const l of lits) found.add(l);
    }
  }
  return { found, dynamic };
}

const tabTipKeys = tableKeys(tips, 'TAB_TIPS');
const tabRead = subscriptLiterals('TAB_TIPS', TAB_FILES);
// ⚠️ The floor is a SCAN-BROKEN sentinel, not a coverage target: it says the regex still matches something,
// and the two directions below are what actually measure coverage. It deliberately quotes no tab count — the
// message said "the six tabs" while `TAB_FILES` held nine, and a figure in a failure message is the one a
// future reader reconciles against the list instead of re-counting it.
if (tabRead.found.size < 15) fail('H', `found only ${tabRead.found.size} TAB_TIPS reads across ${TAB_FILES.length} tab files — the scan is broken, not the code`);
else ok();
if (tabRead.dynamic > 0) fail('H', `${tabRead.dynamic} TAB_TIPS read(s) use a non-literal key, so their coverage cannot be checked`);
else ok();
for (const k of [...tabTipKeys].sort()) {
  if (!tabRead.found.has(k)) fail('H', `TAB_TIPS['${k}'] is read by no tab — dead entry, or a renamed control`);
}
for (const k of [...tabRead.found].sort()) {
  if (!tabTipKeys.has(k)) fail('H', `a tab reads TAB_TIPS['${k}'], which the table does not define — that control's title becomes "undefined"`);
}
ok();

const dialogKeys = tableKeys(tips, 'DIALOG_TIPS');
const dialogRead = subscriptLiterals('DIALOG_TIPS', ['ui/synthesis-lab/export.ts']);
if (dialogRead.found.size < 10) fail('H', `found only ${dialogRead.found.size} DIALOG_TIPS reads in export.ts — the scan is broken`);
else ok();
if (dialogRead.dynamic > 0) fail('H', `${dialogRead.dynamic} DIALOG_TIPS read(s) use a non-literal key`);
else ok();
for (const k of [...dialogKeys].sort()) {
  if (!dialogRead.found.has(k)) fail('H', `DIALOG_TIPS['${k}'] is read nowhere in export.ts — dead entry`);
}
for (const k of [...dialogRead.found].sort()) {
  if (!dialogKeys.has(k)) fail('H', `export.ts reads DIALOG_TIPS['${k}'], which the table does not define`);
}
ok();

// `LOCK_CATEGORY_TIPS` is keyed by `CategoryLock`, a UNION TYPE — so unlike the two tables above, the set of
// keys it must cover is stated in `state.ts` and is checkable exactly. A missing member is the silent case: a
// seventh lock would render a chip whose title reads `Freeze undefined at its current blended value`.
const lockKeys = tableKeys(tips, 'LOCK_CATEGORY_TIPS');
const lockUnion = /export type CategoryLock\s*=\s*([^;]+);/.exec(read('exploration/state.ts'));
if (!lockUnion) fail('H', 'could not find `export type CategoryLock` in state.ts — the scan is broken');
else {
  ok();
  const members = [...lockUnion[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  if (members.length < 6) fail('H', `parsed only ${members.length} CategoryLock members — the scan is broken`);
  else ok();
  for (const m of members) {
    if (!lockKeys.has(m)) fail('H', `CategoryLock '${m}' has no LOCK_CATEGORY_TIPS entry, so its chip title says "undefined"`);
  }
  for (const k of lockKeys) {
    if (!members.includes(k)) fail('H', `LOCK_CATEGORY_TIPS['${k}'] is not a CategoryLock — dead entry`);
  }
  ok();
}

// ⚠️ **BOTH tabs must read it**, or the table is half-inert and the tab that stopped reading it has hardcoded
// its own copy — invariant 17's shape (one text, two sources). This is the assertion that would have caught
// the `CHROME_TIPS`-with-no-reader state that this pass's own first draft shipped.
for (const f of ['ui/synthesis-lab/tabs/mixer.ts', 'ui/synthesis-lab/tabs/randomiser.ts']) {
  if (!/LOCK_CATEGORY_TIPS\[/.test(stripComments(read(f)))) {
    fail('H', `${f} does not read LOCK_CATEGORY_TIPS — its lock chips have hardcoded text instead`);
  }
}
ok();

// ⚠️ **A noun-phrase floor, measured against this table's own shape rather than §G's sentence floor.** The
// shortest legitimate entry is `color` at 34 chars; 15 is comfortably below that and still catches the case
// this exists for — a placeholder or a single word where a scope belongs. An upper bound matters too: a
// full sentence here would read wrong inside BOTH composing tabs, since each supplies its own verb.
for (const [k, v] of tableValues(tips, 'LOCK_CATEGORY_TIPS')) {
  if (v.trim().length < 15) fail('H', `LOCK_CATEGORY_TIPS['${k}'] is ${v.trim().length} chars — too short to name a scope`);
  if (v.length > 120) fail('H', `LOCK_CATEGORY_TIPS['${k}'] is ${v.length} chars — it is composed INTO a sentence, so it must stay a noun phrase`);
  // ⚠️ **BOTH ends, and the leading capital is the one that matters.** The first version tested only for a
  // trailing full stop, and calibration caught it: a seeded `'This locks the wave speed and the three rotation
  // rates'` has no full stop, is 55 chars, contains no forbidden word — and PASSED, while rendering as
  // `Freeze This locks the wave speed ... at its current blended value`. The phrase is spliced MID-sentence,
  // after `Freeze ` / `Leave `, so lower case is the actual invariant and a capital is the actual defect.
  // (If an entry ever legitimately opens on a proper noun, this needs an allow-list, not a deletion.)
  if (/^[A-Z]/.test(v.trim())) fail('H', `LOCK_CATEGORY_TIPS['${k}'] starts with a capital — it is spliced mid-sentence after "Freeze"/"Leave", so it must be lower case`);
  if (/[.!]$/.test(v.trim())) fail('H', `LOCK_CATEGORY_TIPS['${k}'] ends in a full stop — it is a phrase spliced mid-sentence, not a sentence`);
}
ok();

// ---- §I: the INLINE text stays short — the other half of the brief ------------------------------------
//
// ⚠️ **Every section above guards the tooltips, and NONE of them guards the thing the tooltips were written
// to replace.** The brief had two halves — *"all inline explanation texts should be minimized to one or max
// two explanation sentences"* and *"instead however all controls and headers shall get tooltips"* — and a
// checker that only measures the second passes a UI that grew its paragraphs straight back. Tooltips are
// additive, so nothing else would ever notice: the hover text would be correct, the inline prose would be
// correct, and the CLUTTER the pass exists to remove would be back with no assertion able to see it.
//
// The measured state after the pass: 11 visible texts of 120+ chars across all of `src/ui`, worst 240, each
// two sentences and each carrying either a PRECONDITION (which invariant-25 reasoning keeps inline
// deliberately) or a tab's orientation line. Before the pass the worst was 1183. So the ceiling is set at
// 420 — comfortably above the worst survivor and far below anything that reads as a paragraph — and the
// SENTENCE COUNT is asserted directly, because that is the number the brief actually names and a long
// two-sentence line is fine while three short ones are not.
const MAX_INLINE = 420;
const MAX_SENTENCES = 2;
const UI_FILES = [
  'ui/synthesis-lab/tabs/visual-fx.ts', 'ui/synthesis-lab/tabs/materials.ts',
  'ui/synthesis-lab/tabs/mixer.ts', 'ui/synthesis-lab/tabs/randomiser.ts',
  'ui/synthesis-lab/tabs/sliders.ts',
  'ui/synthesis-lab/tabs/evolution.ts', 'ui/synthesis-lab/tabs/history.ts',
  // ⚠️ `composer.ts` carries the Region D precondition, which is exactly the kind of inline copy §I caps —
  // and a precondition is the one thing that legitimately stays inline, so the ceiling is what stops it from
  // growing into the paragraph a tooltip should have held.
  'ui/synthesis-lab/tabs/composer.ts',
  // ⚠️ `transmap.ts` (21.12) carries FOUR inline preconditions, the most of any tab, so the ceiling is doing
  // more work here than anywhere else. ⚠️ **But its two LONGEST visible texts — the measured readout and the
  // identification line — are returned by `field-measure.ts` and are invisible to this scan**, because
  // `INLINE_SINK` matches a string LITERAL after the assignment and those arrive as a function call. That is
  // not an oversight to close by widening the regex: they are measurements whose whole purpose is to state a
  // number in a sentence, so a sentence cap would be the wrong instrument. Their wording is owned by that
  // module's own comments and by `fieldcheck`.
  'ui/synthesis-lab/tabs/transmap.ts',
  'ui/synthesis-lab/panel.ts', 'ui/synthesis-lab/export.ts', 'ui/preview-grid/panel.ts',
  // ⚠️ `filter-drawer.ts` (v8 22.4/22.5) is the phase's only new writer of visible copy, and the ceiling is the
  // instrument that matters there: the empty state EXPLAINS itself, which is precisely the shape that grows into
  // a paragraph. Its measured texts are two short ones; the variable half is composed at runtime and is
  // invisible to `INLINE_SINK` by the same rule as `transmap.ts`'s readouts above.
  'ui/preview-grid/filter-drawer.ts',
];

/**
 * Sentences in a piece of UI copy.
 *
 * ⚠️ **A bare `split('.')` is wrong here and would have miscounted almost every line**: the copy is full of
 * decimals (`0.2×–5.0×`), ellipses, ranges (`p2…p98`) and abbreviations. Count terminators that are followed
 * by a space and a capital, plus one for the final clause — and treat `⚠️` as a sentence boundary too, since
 * the precondition lines use it exactly that way.
 */
function sentenceCount(text) {
  const t = text.trim();
  if (!t) return 0;
  let n = 1;
  for (const _ of t.matchAll(/[.!?](?=\s+[A-Z⚠])/g)) n++;
  for (const _ of t.matchAll(/(?<![.!?]\s)⚠️/g)) n++;
  return n;
}

// ⚠️ Comments are NOT stripped: the visible-text sinks are string literals, and `stripComments` keeps those
// while removing the doc comments that quote them — which is exactly what is wanted, since a quoted example
// in a comment is not on screen.
const INLINE_SINK = /(?:\.textContent\s*=|\.innerHTML\s*=|label:)\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)/g;
let inlineScanned = 0;
for (const f of UI_FILES) {
  const src = stripComments(read(f));
  for (const m of src.matchAll(INLINE_SINK)) {
    const text = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]).join('');
    if (text.length < 60) continue;                       // a caption or a label, not explanatory prose
    inlineScanned++;
    const line = src.slice(0, m.index).split('\n').length;
    if (text.length > MAX_INLINE) {
      fail('I', `${f}:${line} has ${text.length} chars of inline copy (ceiling ${MAX_INLINE}) — move the explanation into a tooltip: "${text.slice(0, 70)}…"`);
    }
    const s = sentenceCount(text);
    if (s > MAX_SENTENCES) {
      fail('I', `${f}:${line} has ${s} inline sentences (max ${MAX_SENTENCES}) — "${text.slice(0, 70)}…"`);
    }
  }
}
if (inlineScanned < 20) fail('I', `scanned only ${inlineScanned} inline texts across ${UI_FILES.length} UI files — the scan is broken, not the code`);
else ok();
ok();

// ---- §J: the facet filter's chrome text <-> its reader (v8 Phase 22) ----------------------------------
//
// ⚠️ **`CHROME_TIPS` had NO reader-coverage check at all before this section, and it is the one table whose
// reads escape §H's scan by construction**: every other table is read as `TABLE['key']`, which
// `subscriptLiterals` can see, while `CHROME_TIPS` is read as `CHROME_TIPS.filter` — a property access. So the
// two failure modes §H exists for were both live here and neither had an instrument: a key renamed in
// `tooltips.ts` alone leaves `title = undefined` on screen, and a key deleted from the reader alone leaves dead
// copy in the table. §G measures these values' LENGTH, which passes cheerfully in both cases.
//
// ⚠️ **Scoped to the `filter*` keys, deliberately, and this is a bound on the section rather than a decision
// about the others.** The rest of `CHROME_TIPS` is read across several files (the grid header, the Lab header,
// the mode buttons) and a full audit is not this phase's work; asserting both directions over the subset this
// phase ADDED is what stops the phase shipping a broken one. A later pass that widens the file list should
// widen the key filter with it, in one edit.
// ⚠️ **CALIBRATED against four seeded defects on 2026-09-24, each shown to FAIL before this section was
// believed** — a section that has only ever been green is a claim about the code made by an uncalibrated
// instrument. (a) renaming a reader to `CHROME_TIPS.filterClearX` fired BOTH directions, 2 failures; (b)
// replacing `label.title = row.tip` fired the inert-tooltip clause, which `'.tip'` alone would have missed;
// (c) writing the clear button's text inline fired the literal clause at both of its call sites AND the
// dead-copy direction, 3 failures; (d) renaming the `filter` key in `tooltips.ts` fired the
// table-does-not-define direction. ⚠️ **Read a future failure here as a claim about the SCAN first**: all of
// this is text greps, so a behaviour-neutral rename of `filter-drawer.ts` or of the `filter*` key prefix breaks
// the section without touching a tooltip.
const CHROME_READER = 'ui/preview-grid/filter-drawer.ts';
const chromeKeys = tableKeys(tips, 'CHROME_TIPS');
const filterKeys = [...chromeKeys].filter(k => k.startsWith('filter'));
// A scan-broken sentinel, quoting no target: the phase wrote several and the directions below do the measuring.
if (filterKeys.length < 4) {
  fail('J', `parsed only ${filterKeys.length} CHROME_TIPS 'filter*' key(s) — the scan is broken, not the code`);
} else ok();

const chromeSrc = stripComments(read(CHROME_READER));
const chromeRead = new Set([...chromeSrc.matchAll(/\bCHROME_TIPS\.([A-Za-z0-9_]+)/g)].map(m => m[1]));
for (const k of filterKeys) {
  if (!chromeRead.has(k)) fail('J', `CHROME_TIPS['${k}'] is read nowhere in ${CHROME_READER} — dead copy, or a control that lost its title`);
}
for (const k of [...chromeRead].sort()) {
  if (!chromeKeys.has(k)) fail('J', `${CHROME_READER} reads CHROME_TIPS.${k}, which the table does not define — that control's title becomes "undefined"`);
}
ok();

// ⚠️ **The ~168 FACET tooltips are NOT in `tooltips.ts` and must not be** — each lives on its own `FacetDef`
// beside the predicate that earns it, which is `TAB_DEFS`' precedent and the only arrangement in which a new
// facet cannot be added without its text. `facetcheck` owns their content (non-empty, and a floor measured
// against what a tip has to explain); what CANNOT be checked there is whether they reach the DOM at all, since
// that is a property of this file. Both sinks are asserted: the boolean chips read `row.facet.tip` and the
// enumeration ROWS read `row.tip`, and dropping either would leave a whole class of chips untitled with every
// other assertion still green (invariant 13 — the text exists and reaches nothing).
// ⚠️ `'.tip'` alone would be a WEAKER test than either of these and would have passed seed (b) below, because
// `row.facet.tip` contains it — the two sinks have to be named separately or the specific one is unreachable.
for (const expr of ['row.facet.tip', 'row.tip']) {
  if (!chromeSrc.includes(expr)) {
    fail('J', `${CHROME_READER} no longer reads \`${expr}\` — the facet tooltips are inert (invariant 13)`);
  }
}
ok();

// ⚠️ **No inline `title`, in EITHER of this phase's two new/edited UI files.** This is `CLAUDE.md`'s standing
// rule ("every `title` comes from `tooltips.ts`, never inline") and the reason it needs an assertion here is
// that the drawer builds its own controls: writing one more `btn.title = 'Clear every filter'` is a one-line
// edit that no other section can see. A `FacetDef.tip` is not inline — it comes from a descriptor table, which
// is the rule's intent — so the test is for a string LITERAL on the right-hand side.
for (const f of [CHROME_READER, 'ui/preview-grid/panel.ts']) {
  const src = stripComments(read(f));
  for (const m of src.matchAll(/\.title\s*=\s*'((?:[^'\\]|\\.)*)'/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    fail('J', `${f}:${line} sets a title from an inline literal ("${m[1].slice(0, 40)}…") — it belongs in tooltips.ts`);
  }
}
ok();

// ---- §K: the warp wave-shape notices, and BOTH dropdowns (v8 35.4) -----------------------------------
//
// ⚠️⚠️ **THE NOTICE THIS SECTION EXISTS FOR IS THE ONE THAT MAKES THE WHOLE FEATURE DISCOVERABLE.**
// `shapeMix: 0` AND `shape: 'sine'` are **both** the identity, by decision (`35.D2`), so a user who picks a
// shape and leaves the mix at 0 sees **nothing at all** — `PHASE35-KEYS.md` §2.4 calls that the
// phase's most likely first-use confusion and `SHAPE_NOTICES.mixZero` is the entire remedy. A notice whose
// string is dead, whose key is unreachable or whose text no editor reads is therefore the feature failing,
// not a cosmetic lapse, and NOTHING ELSE in `checks/` can see any of those three.
//
// ⚠️ **THE NOTICES ARE INVISIBLE TO §I BY CONSTRUCTION, WHICH IS WHY THEIR CAP IS RE-APPLIED HERE.**
// `INLINE_SINK` matches a string LITERAL after `.textContent =`; both editors assign `SHAPE_NOTICES[k]`, so
// every one of these texts escapes §I's sentence and length ceilings. That arrangement is deliberate — the
// strings have ONE owner for TWO editors, and `CLAUDE.md`'s rule is *set the text once and toggle `display`,
// never a ternary-assigned string* — but it moves the measurement here rather than removing it.
//
// ⚠️ **`WARP_SHAPES` IS A `readonly T[]` AND FORCES NOTHING** (`35.1`'s one-way gap, documented three times
// in this tree): `Record<WarpShape, …>` makes `tsc` demand an entry for a new union member, the array does
// not, and **the dropdowns read the array**. `shapecheck` §A mechanises the two `Record`s as set equality;
// ⏳ **the clause asserting that both dropdowns are BUILT FROM the array belongs in `shapecheck` §B and is
// OWED** — that file was being edited by another hand when this was written. The two clauses below are this
// section's stand-in and are a claim about the CONSTRUCTION, not about behaviour.
//
// ⚠️ **TWO EDITORS, ONE OWNER, AND BOTH DIRECTIONS MATTER.** `visual-fx.ts` carries its own complete
// static-field editor beside `transmap.ts`'s pane, which is `32.15`'s finding verbatim — *adding an operator
// is a two-file edit and Phase 32 did only one.* A dropdown in one file alone leaves the shape unreachable
// from the other, and no `tsc` error and no other checker says so.
{
  const SHAPE_EDITORS = ['ui/synthesis-lab/tabs/transmap.ts', 'ui/synthesis-lab/tabs/visual-fx.ts'];
  const fm = read('ui/synthesis-lab/field-measure.ts');

  /** A top-level `export function NAME(...)`'s body, brace-matched. Comments stripped by the caller. */
  const fnBody = (src, name) => {
    const at = src.indexOf(`export function ${name}`);
    if (at < 0) return '';
    const open = src.indexOf('{', src.indexOf(')', at));
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
    }
    return '';
  };

  // ---- the key set: the union, the `Record` and the two placement lists are ONE set --------------------
  const unionDecl = /export type ShapeNoticeKey\s*=\s*([^;]+);/.exec(fm);
  if (!unionDecl) fail('K', 'no `export type ShapeNoticeKey` in field-measure.ts — the scan is broken');
  else {
    ok();
    const members = [...unionDecl[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    const noticeKeys = tableKeys(fm, 'SHAPE_NOTICES');
    if (members.length < 3) fail('K', `parsed only ${members.length} ShapeNoticeKey members — the scan is broken`);
    else ok();
    // ⚠️ SET equality in both directions, never a length test: equal lengths with one name swapped is
    // exactly the edit a rename produces, and `35.1` recorded that a length test passes `5 === 5` over it.
    for (const m of members) {
      if (!noticeKeys.has(m)) fail('K', `ShapeNoticeKey '${m}' has no SHAPE_NOTICES entry — its notice renders as "undefined"`);
    }
    for (const k of noticeKeys) {
      if (!members.includes(k)) fail('K', `SHAPE_NOTICES['${k}'] is not a ShapeNoticeKey — dead copy`);
    }
    ok();

    /*
     * ⚠️ **A COUNTED, DISJOINT UNION, and it is hand-written with no compiler between it and the `Record`.**
     * The two lists say which notices each editor places beside the SHIFT half's rows and which beside the
     * ZOOM half's. A key in NEITHER is a string with no reader — the notice simply never appears, which is
     * `35.1`'s *"three new symbols have no reader in `src/` and nothing will report it"* in a new place. A
     * key in BOTH is a sentence the user reads twice.
     */
    const listMembers = (name) => {
      const at = fm.indexOf(`export const ${name}`);
      if (at < 0) return null;
      // ⚠️ From the `=`, not from `at` — the type annotation `readonly ShapeNoticeKey[]` carries the FIRST
      // `[` on the line, and parsing from there found an empty pair and reported all five keys unplaced.
      const open = fm.indexOf('[', fm.indexOf('=', at));
      const close = fm.indexOf(']', open);
      return [...fm.slice(open, close).matchAll(/'([^']+)'/g)].map(m => m[1]);
    };
    const shift = listMembers('SHIFT_SHAPE_NOTICES');
    const zoom = listMembers('ZOOM_SHAPE_NOTICES');
    if (!shift || !zoom) fail('K', 'SHIFT_SHAPE_NOTICES / ZOOM_SHAPE_NOTICES not found — the scan is broken');
    else {
      ok();
      const union = [...shift, ...zoom];
      const dupes = union.filter((k, i) => union.indexOf(k) !== i);
      if (dupes.length > 0) fail('K', `${JSON.stringify(dupes)} is placed in BOTH halves' notice lists — the user reads it twice`);
      for (const k of noticeKeys) {
        if (!union.includes(k)) fail('K', `SHAPE_NOTICES['${k}'] is in neither placement list, so no editor ever builds it — a string with no reader`);
      }
      for (const k of union) {
        if (!noticeKeys.has(k)) fail('K', `a placement list names '${k}', which SHAPE_NOTICES does not define — that paragraph renders as "undefined"`);
      }
      ok();
    }
  }

  // ---- the strings: §I's ceilings, re-applied where §I cannot see them --------------------------------
  const noticeVals = tableValues(fm, 'SHAPE_NOTICES');
  const noticeKeyCount = tableKeys(fm, 'SHAPE_NOTICES').size;
  // Coverage of the value parser itself, exactly as §G does it: an entry written some other way would make
  // every assertion below pass by not looking.
  if (noticeVals.size !== noticeKeyCount) {
    fail('K', `SHAPE_NOTICES: parsed ${noticeVals.size} values but ${noticeKeyCount} keys — ${noticeKeyCount - noticeVals.size} escape the ceilings`);
  } else ok();
  for (const [k, v] of noticeVals) {
    if (v.trim().length < 20) fail('K', `SHAPE_NOTICES['${k}'] is empty or near-empty (${v.trim().length} chars)`);
    if (v.length > MAX_INLINE) fail('K', `SHAPE_NOTICES['${k}'] is ${v.length} chars (ceiling ${MAX_INLINE}) — that is a paragraph, not a notice`);
    const s = sentenceCount(v);
    if (s > MAX_SENTENCES) fail('K', `SHAPE_NOTICES['${k}'] has ${s} sentences (max ${MAX_SENTENCES}) — "${v.slice(0, 70)}…"`);
  }
  ok();

  /*
   * ⚠️⚠️ **ONE THRESHOLD SOURCE: "is this shape discontinuous" IS READ FROM `WARP_SHAPE_DISCONTINUOUS` AND
   * FROM NOWHERE ELSE.** A second hand-typed list of shape names inside the predicate would pass every other
   * clause here, keep `tsc` green, and go stale the moment a sixth shape is added — the notice and the tear
   * measurement would then disagree with nothing able to say so. Asserted in BOTH directions: the `Record` is
   * read, and no shape NAME is written as a literal in the predicate's own body.
   */
  const pred = fnBody(stripComments(fm), 'shapeNoticeKeys');
  if (pred.length < 100) fail('K', 'could not extract shapeNoticeKeys()\'s body from field-measure.ts — the scan is broken');
  else ok();
  if (!/WARP_SHAPE_DISCONTINUOUS\[/.test(pred)) {
    fail('K', 'shapeNoticeKeys() does not read WARP_SHAPE_DISCONTINUOUS — the discontinuity test has a second owner');
  } else ok();
  for (const m of pred.matchAll(/'(triangle|trapezoid|square|sawtooth)'/g)) {
    fail('K', `shapeNoticeKeys() names the shape '${m[1]}' as a literal — that is the second hand-typed list WARP_SHAPE_DISCONTINUOUS exists to replace`);
  }
  ok();

  /*
   * ⚠️⚠️ **THE SAME RULE IN TWO NEW PLACES, ADDED WITH THE ORIENTATION NOTICES (`35.4`).**
   *
   *  - **The quarter turn has ONE owner.** The parallel test asks *"is `angleY` plus the Y wave's baked-in
   *    quarter turn the same direction as `angleX`"*, so the number has to be `waveAxisMap`'s own
   *    `WAVE_QUARTER_TURN`. A hand-typed `90` passes `tsc`, passes every other clause here, and would
   *    describe a geometry the sampler does not index the moment either quantity moves — and the range limit
   *    `WAVE_ANGLE_MAX` is **also 90**, which is two quantities wearing one number and the likeliest wrong
   *    fix. Both are refused.
   *  - **NO ARCHETYPE IS NAMED.** `shapecheck` §N7b lists the archetypes whose two axes share a table up to
   *    sign and therefore cancel on style 2. Enumerating those names in the predicate would be the
   *    `WARP_SHAPE_DISCONTINUOUS` mistake in a new field: a hand-typed list that goes stale the moment an
   *    archetype is added (`35.6` added three), with the notice and the arithmetic disagreeing and nothing
   *    able to say so. The wording states the CONDITION instead.
   *
   * ⚠️ **CALIBRATED 2026-10-29, both seeded against `src/`, measured and reverted (`diff -q` verified):**
   * writing the quarter turn as a literal `90` fired **2** (the reader clause and the no-bare-90 clause,
   * which is the pair that makes the claim unambiguous); adding `&& s.pattern === 'Interference'` to the
   * `wavesCancel` test fired **1**, and only its own.
   */
  if (!/WAVE_QUARTER_TURN/.test(pred)) {
    fail('K', 'shapeNoticeKeys() does not read WAVE_QUARTER_TURN — the Y wave\'s baked-in +90 has a second owner, and the symptom is a notice describing a geometry the sampler does not index');
  } else ok();
  for (const m of pred.matchAll(/(?<![\w.])(90|WAVE_ANGLE_MAX)(?![\w.])/g)) {
    fail('K', `shapeNoticeKeys() uses \`${m[1]}\` for the quarter turn — WAVE_ANGLE_MAX is the RANGE and a bare 90 is a second copy; the two being equal today is a coincidence of numbers, not of meaning`);
  }
  ok();
  {
    // The archetype names, read from the one file that owns them rather than retyped here.
    const archNames = [...read('post-processors/static-field.ts').matchAll(/^\s{4}name: '([^']+)',$/gm)]
      .map(m => m[1]);
    if (archNames.length < 10) {
      fail('K', `parsed only ${archNames.length} archetype names out of static-field.ts — the scan is broken, not the code`);
    } else ok();
    for (const n of archNames) {
      if (pred.includes(`'${n}'`)) {
        fail('K', `shapeNoticeKeys() names the archetype '${n}' as a literal — a hand-typed list of which tables cancel goes stale the moment an archetype is added; the wording must state the CONDITION`);
      }
    }
    ok();
  }

  /*
   * ⚠️⚠️ **BOTH EDITORS, AND THE DROPDOWN IS BUILT FROM THE ARRAY.** The two clauses are one claim: a
   * `for (… of WARP_SHAPES)` in each file, and no `<option>` carrying a shape name as a literal anywhere in
   * either. The second half is what a hand-written list would trip — and a hand-written list is the only way
   * the one-way `Record`/array gap reaches a user.
   */
  for (const f of SHAPE_EDITORS) {
    const src = stripComments(read(f));
    if (!/\bof WARP_SHAPES\b/.test(src)) {
      fail('K', `${f} does not iterate WARP_SHAPES — its shape dropdown is a hand-written list, or there is no dropdown at all`);
    }
    // The notice TEXT comes from the shared table, not from a literal in the tab: the `INLINE_SINK` rule's
    // whole point, and the reason §I cannot see these strings.
    if (!/SHAPE_NOTICES\[/.test(src)) {
      fail('K', `${f} does not read SHAPE_NOTICES — its notices have hardcoded text, or it has none`);
    }
    if (!/\bshapeNoticeKeys\(/.test(src)) {
      fail('K', `${f} does not call shapeNoticeKeys() — its notices are built and never gated (invariant 13)`);
    }
    for (const m of src.matchAll(/(?:textContent|value)\s*=\s*'(sine|triangle|trapezoid|square|sawtooth)'/g)) {
      fail('K', `${f} writes the shape name '${m[1]}' as a literal — the labels are WARP_SHAPE_LABELS' and the values are WARP_SHAPES'`);
    }
  }
  ok();

  /*
   * ⚠️⚠️ **TWO CLAUSES OVER ONE FUNCTION, AND THEY POINT IN OPPOSITE DIRECTIONS.** `visual-fx.ts`'s
   * `applyStaticRegimeGates()` is the ONE owner of *what is on screen and what is greyed given the pattern*,
   * reached from the builder, from `updateStaticRows` and from a `Shape Mix` drag:
   *
   *  - it MUST gate the notices (`shapeNoticeClass`), or they are built and never shown — invariant 13, and
   *    the drag path is the one that matters: without it *"Shape mix is 0"* stays lit through the whole drag
   *    that disproves it;
   *  - it must NOT touch the four shape MARKERS, because `35.D2` decision 1 keeps the shape live on
   *    `(Preset)` as well as on an archetype. That is the OPPOSITE of the `Detail` row two lines above it,
   *    and a reader who "harmonises" the inconsistency would silently remove the shape from the regime
   *    201 of the 278 live layers sit in.
   */
  {
    const vfxSrc = stripComments(read('ui/synthesis-lab/tabs/visual-fx.ts'));
    const at = vfxSrc.indexOf('applyStaticRegimeGates(root');
    let body = '';
    if (at >= 0) {
      const open = vfxSrc.indexOf('{', vfxSrc.indexOf(')', at));
      let depth = 0;
      for (let i = open; i < vfxSrc.length; i++) {
        if (vfxSrc[i] === '{') depth++;
        else if (vfxSrc[i] === '}') { depth--; if (depth === 0) { body = vfxSrc.slice(open, i + 1); break; } }
      }
    }
    if (body.length < 100) fail('K', 'could not extract applyStaticRegimeGates()\'s body — the scan is broken');
    else ok();
    if (!/shapeNoticeClass\(/.test(body)) {
      fail('K', 'applyStaticRegimeGates() does not gate the shape notices — they are built and never shown, so a Shape Mix drag cannot clear "Shape mix is 0"');
    } else ok();
    for (const m of body.matchAll(/\bM\.(shapeMix2|shapeMix|shape2|shape)\b/g)) {
      fail('K', `applyStaticRegimeGates() touches the '${m[1]}' row — 35.D2 decision 1 keeps the shape live in BOTH regimes, unlike Detail`);
    }
    ok();
  }
}

// ---- report ------------------------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`tipcheck FAILED — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error('\n⚠️ Read the assertion before believing this is a regression: a NEW control fails §A until its');
  console.error('   tooltip is written, and a RENAMED key fails §A and §B together.');
  process.exit(1);
}
console.log(`tipcheck: ${assertions} assertions passed`);
console.log(`  ${controlTips.size} control tooltips, ${headerTips.size} header tooltips, all matched both ways`);
console.log(`  ${tabTipKeys.size} hand-wired tab tooltips, ${dialogKeys.size} dialog tooltips, ${lockKeys.size} lock scopes, all matched both ways`);
