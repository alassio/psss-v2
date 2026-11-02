#!/usr/bin/env node
/**
 * namecheck — a preset NAME is a primary key, and nothing in the type system says so.
 *
 * The reported bug (2026-08-20). A user exported `Cosmos Energy New`, imported it twice under that same
 * name, got two tiles, and only the second animated. Both halves of that were the same root cause:
 *
 *   1. the import dialog's duplicate check validated against a name list captured at panel CONSTRUCTION.
 *      `main.ts` deliberately hands each panel its own copy (the D4 split, so `prependPreset`'s `unshift`
 *      cannot corrupt a shared array), and the Lab's copy is never refreshed — so the second import
 *      compared against the same 177 names the first one saw. The name it had just added was invisible.
 *   2. the duplicate then collided in four name-keyed maps: `PresetManager.library`,
 *      `PreviewGridPanel.tileElements` / `tileCanvases`, and `GridTileRenderer.activeSlots`.
 *      `acquireSlot` returns early on `activeSlots.has(presetName)`, so the second tile never got a slot —
 *      one generator, two canvases. The frozen tile was two tiles claiming one identity.
 *
 * ⚠️ **Why a checker rather than "just fixed it".** Nothing here is visible to `tsc`: a `string[]` and a
 * `() => string[]` are both perfectly typed, `Map<string, T>` is correct whichever key it holds, and both
 * defects passed `npm run verify` green. And the failure is SILENT in the worst way — the app does not
 * throw, it shows you two tiles and animates one, which reads as a rendering bug rather than an identity
 * bug. That is the same class as invariant 13 (a control that no longer moves what it names).
 *
 * These are text-pattern assertions, like seven of the sibling checkers, and inherit their weakness: a
 * behaviour-neutral rename breaks them. Read the assertion before believing a failure is a regression.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
/** See `deadcheck`/`trackcheck`: these files are heavily commented, so a pattern aimed at code must see code. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

const exportTs = rd('src/ui/synthesis-lab/export.ts');
const exportCode = stripComments(exportTs);
const gridTs = stripComments(rd('src/ui/preview-grid/panel.ts'));
const labTs = stripComments(rd('src/ui/synthesis-lab/panel.ts'));
const mainTs = stripComments(rd('src/main.ts'));
const tileTs = stripComments(rd('src/ui/preview-grid/grid-tile-renderer.ts'));

console.log('\n=== A. the duplicate-name check cannot read a stale list ===\n');

// The signature IS the fix. An array parameter can be captured stale at any call site; a getter cannot.
chk('importPresetWithDialog takes a GETTER, not an array',
  /export function importPresetWithDialog\(\s*existingNames:\s*\(\)\s*=>\s*string\[\]/.test(exportCode),
  'an array parameter is what allowed a construction-time snapshot to be passed');

chk('...and so does showImportDialog, so the getter is not flattened one frame later',
  /function showImportDialog\([\s\S]{0,200}?existingNames:\s*\(\)\s*=>\s*string\[\]/.test(exportCode));

// ⚠️ The subtle regression this guards: hoisting the set back out of `validate()` would re-freeze the list
// at dialog-open time. Correct for a single dialog, and the same defect class again.
const validateBody = /function validate\(\)[\s\S]*?\n  \}/.exec(exportCode);
chk('validate() CALLS the getter on each keystroke rather than closing over a prebuilt Set',
  !!validateBody && /existingNames\(\)/.test(validateBody[1] ?? validateBody[0]),
  validateBody ? 'calls existingNames()' : 'validate() NOT FOUND');

chk('...and no hoisted `existingSet` survives above it',
  !/const existingSet\s*=/.test(exportCode),
  'a hoisted Set is a snapshot with extra steps');

// Case matters because the maps downstream are case-SENSITIVE while a human reading two labels is not.
chk('the comparison is case-insensitive, since activeSlots would treat Cosmos and cosmos as two slots',
  !!validateBody && /toLowerCase\(\)/.test(validateBody[1] ?? validateBody[0]));

console.log('\n=== B. both call sites pass the authoritative list ===\n');

for (const [label, src] of [['preview grid', gridTs], ['synthesis lab', labTs]]) {
  const call = new RegExp(String.raw`importPresetWithDialog\(\s*([A-Za-z_.\[\]\s{}()=>]+?),`).exec(src);
  const arg = call ? call[1].trim() : '';
  chk(`the ${label} passes a getter, not its own presetNames array`,
    /getPresetNames/.test(arg), `argument: ${JSON.stringify(arg) || 'CALL NOT FOUND'}`);
}

// The getter must reach PresetManager -- the owner -- and not some third copy of the list.
const getters = [...mainTs.matchAll(/getPresetNames:\s*\(\)\s*=>\s*([^,\n]+)/g)].map(m => m[1].trim());
chk('main.ts supplies both getters, and both read PresetManager directly',
  getters.length === 2 && getters.every(g => /presetManager\.list\(\)/.test(g)),
  `found ${getters.length}: ${JSON.stringify(getters)}`);

// ⚠️ `presetNames` (the local `let`) is refreshed only by `refreshPresetNames`, which runs AFTER the import
// completes -- so it is still stale at dialog time. This assertion exists because passing it would look
// right and behave exactly like the bug.
chk('...and NOT via the local presetNames array, which refreshPresetNames only updates after the import',
  getters.every(g => !/^\[?\.\.\.?presetNames/.test(g) && !/^presetNames/.test(g)));

console.log('\n=== C. a duplicate that arrives anyway degrades safely ===\n');

// Defence in depth: the dialog is the gate, but `prependPreset` is reachable from any future caller.
const prepend = /prependPreset\(name: string\): void \{([\s\S]*?)\n  \}/.exec(gridTs);
chk('prependPreset detects a name it already has a tile for', !!prepend && /tileElements\.get\(name\)/.test(prepend[1]),
  prepend ? '' : 'prependPreset NOT FOUND');

// ⚠️ Order matters: release the slot BEFORE dropping the Map entries, or the generator/TransMap/textures are
// unreachable -- invariant 1's shape (a dropped reference is not a disposal).
const releaseIdx = prepend ? prepend[1].indexOf('releaseSlot') : -1;
const deleteIdx = prepend ? prepend[1].indexOf('tileElements.delete') : -1;
chk('...and releases its renderer slot BEFORE dropping the map entries (else the slot leaks)',
  releaseIdx >= 0 && deleteIdx >= 0 && releaseIdx < deleteIdx,
  `releaseSlot at ${releaseIdx}, delete at ${deleteIdx}`);

chk('...unobserves the replaced tile, so a dead element cannot drive acquire/release',
  !!prepend && /unobserve\(/.test(prepend[1]));

chk('...and de-duplicates presetNames instead of listing one name twice',
  !!prepend && /presetNames\.splice\(/.test(prepend[1]));

// The early return is CORRECT -- it is what makes a slot idempotent -- but it is also why a duplicate tile
// froze. Assert it still exists, so the comment above it stays true.
chk('acquireSlot is still keyed by name and still returns early (the idempotence prependPreset relies on)',
  /acquireSlot\(presetName: string[\s\S]{0,200}?if \(this\.activeSlots\.has\(presetName\)\) return;/.test(tileTs),
  'if this stops being name-keyed, prependPreset\'s replace-not-add rule needs rethinking');

console.log('\n=== D. the bundle/single discriminator is STRUCTURAL, not a key sniff ===\n');

// ⚠️ The trap that makes this an assertion rather than a comment: a preset LITERALLY NAMED `Waves` exists in
// the legacy library, and `Waves` is also a v1 preset's own field name. So a bundle carrying it has a
// top-level `Waves` key, and the obvious implementation — "does it have a preset marker key at the top
// level?" — classifies that bundle as a single v1 preset. The correct test asks whether EVERY VALUE is
// preset-shaped, which no single preset satisfies (a v2 preset's four values are objects, but none of them
// carries a marker key).
chk('isPresetBundle tests every VALUE, never the top-level keys',
  /export function isPresetBundle\([\s\S]{0,400}?values\.every\(isPresetShaped\)/.test(exportCode),
  'a top-level key sniff is defeated by the preset named `Waves`');

chk('...and rejects an empty object, which is neither a bundle nor a preset',
  /values\.length > 0 &&/.test(exportCode));

// This is the defect the whole path exists to fix: `exportAllPresetsJSON` writes `{ name: preset }` and
// `importPresetWithDialog` used to hand the WHOLE FILE to `migrate` as one preset. It does not throw —
// measured result was ONE nonsense preset named after the file, particleCount 500, out of all 177.
chk('the reader routes a bundle away from MigrationLayer.migrate',
  /if \(isPresetBundle\(raw\)\) \{[\s\S]{0,200}?importBundleWithDialog\([\s\S]{0,120}?return;/.test(exportCode),
  'without the early return the bundle falls through to the single-preset migrate');

// A 177-entry bundle cannot go through `onConfirm`, which re-inits generators/renderer/TransMap and
// navigates PER CALL. The batch callback is what makes a restore survivable.
chk('a batch callback exists, so a bundle is not 177 full re-inits',
  /onConfirmBundle\?:\s*\(entries:\s*\{\s*name:\s*string;\s*preset:\s*UnifiedPreset\s*\}\[\]\)\s*=>\s*void/.test(exportCode));

chk('...and both panels forward it to main.ts',
  /onImportBundle\?:/.test(gridTs) && /onImportBundle\?:/.test(labTs));

const bundleWires = [...mainTs.matchAll(/onImportBundle:\s*([^,\n]+)/g)].map(m => m[1].trim());
chk('main.ts wires the batch path into BOTH panel configs',
  bundleWires.length === 2 && bundleWires.every(w => /applyImportedBundle/.test(w)),
  `found ${bundleWires.length}: ${JSON.stringify(bundleWires)}`);

console.log('\n=== E. the version-suffix rule, which mints primary keys ===\n');

// Every name this produces becomes a key in the four maps of section A, so a collision here reintroduces
// the frozen-tile bug by a different door.
chk('the suffix pattern requires a SPACE and anchored digits',
  /VERSION_SUFFIX_RE = \/\^\(\.\*\?\)\\s\+v\(\\d\+\)\$\/i/.test(exportCode),
  're-measured 2026-09-19 (EIGHTH settle batch) over the composed library of 247 names, and the basis matters: '
  + 'the SHIPPED pattern matches NONE of the 247, so "0 false positives" is measured over a set in which nothing '
  + 'matches at all — this rule only ever bites on an IMPORT, and no library name is evidence for it. '
  + '⚠️ The old wording here quoted "375 live names" and then listed TWELVE names from THREE different '
  + 'populations as if they were one, which is the failure to avoid: re-measure the three counts, never append a '
  + 'name. (1) A looser \\d+$ would match 7 of the 247: 4 GLUED (Deep Thought2, Galaxy2, Nova2, Warp2) and '
  + '3 SPACE+DIGIT (Fluid Metall 2, Rippled Rays Of Light 2, Rippled Rays Of Light 3). (2) The damage is NOT '
  + 'mostly an invented lineage — 6 of those 7 stems are themselves live presets, so an import of `Galaxy2` '
  + 'would be renamed `Galaxy3` INTO a real family it is not part of; `Nova2` is the only one whose stem is '
  + 'absent. (3) 23 of the 247 carry a Roman numeral (Aurora Borealis II … Who Needs A Fractal II), which no '
  + 'digit regex sees in either direction — that is where this library actually keeps its versions, and it '
  + 'grows with every variant spawn');

const nvn = /export function nextVersionedName\([\s\S]*?\n\}/.exec(exportCode);
chk('nextVersionedName escalates in a LOOP until the name is free',
  !!nvn && /while \(taken\.has\(/.test(nvn[0]),
  nvn ? '' : 'nextVersionedName NOT FOUND');

// ⚠️ The stem is re-derived from `name` on every call. Appending to the previous CANDIDATE instead would
// produce `Cylinder v2 v3` — a fresh name each time, so the loop would still terminate and no test of
// uniqueness alone would catch it.
// Both the regex exec and the fallback must name the parameter `name`. Anything else in either position
// means the stem is coming from somewhere other than the caller's original string.
chk('...and re-derives the stem from the ORIGINAL name, never from the last candidate',
  !!nvn && /VERSION_SUFFIX_RE\.exec\(name\)/.test(nvn[0]) && /:\s*name;/.test(nvn[0]),
  'appending to the candidate yields `Cylinder v2 v3`');

chk('...comparing case-insensitively, since the maps downstream are not',
  !!nvn && /taken\.has\(candidate\.toLowerCase\(\)\)/.test(nvn[0]));

// Both entry points must resolve names, or the version rule holds for one and not the other.
chk('the single-preset path pre-resolves a clashing name before opening the dialog',
  /const suggested = taken\.has\(candidate\.toLowerCase\(\)\)[\s\S]{0,120}?nextVersionedName\(candidate, taken\)/.test(exportCode));

chk('...and the dialog offers the suggestion rather than only rejecting',
  /fixBtn\.dataset\.suggestion = suggestion/.test(exportCode));

// ⚠️ The bundle loop must add each resolved name to its OWN set as it goes. `existingNames()` cannot see
// names resolved earlier in the same batch — nothing has been committed to `PresetManager` yet — so without
// this, importing a bundle whose entries all clash would mint the SAME `v2` name repeatedly.
const bundleLoop = /showBundleDialog\([\s\S]*?\n  \}\);/.exec(exportCode);
chk('the bundle loop adds each resolved name to the live set as it goes',
  !!bundleLoop && /live\.add\(finalName\.toLowerCase\(\)\)/.test(bundleLoop[0]),
  'existingNames() cannot see a name resolved earlier in the same batch');

chk('...and writes the final name back into metadata, the map key\'s other copy',
  !!bundleLoop && /preset\.metadata\.name = finalName/.test(bundleLoop[0]));

console.log('\n=== F. the bundle dialog does not leak a document listener ===\n');

// invariant 15's shape. The first draft bound the `keydown` unbind to `overlay.addEventListener('remove')`,
// which is not a DOM event at all — `Element.remove()` fires nothing — so the listener would have outlived
// the dialog for the whole session.
const bundleDlg = /function showBundleDialog\([\s\S]*?\n\}/.exec(exportCode);
chk('showBundleDialog unbinds its keydown handler in close()',
  !!bundleDlg && /function close\(\): void \{\s*document\.removeEventListener\('keydown', onKey\);/.test(bundleDlg[0]),
  bundleDlg ? '' : 'showBundleDialog NOT FOUND');

chk('...and never relies on a non-existent `remove` event to do it',
  !/addEventListener\('remove'/.test(exportCode),
  "Element.remove() fires no event; that binding is silently never called");

console.log('\n=== G. RENAME re-keys every owner, and SORT re-keys none ===\n');

// ⚠️ Sections A–F police how a name is MINTED. A rename is the other direction: it CHANGES a primary key
// that is already installed in five owners, four of which are invisible to `tsc`. The runtime suite
// (32 assertions, each falsified against a seeded defect) covers `PresetManager` itself; what it cannot
// reach is the WIRING — a rename that updates the library and leaves the grid's maps, the renderer slot or
// `lastAppliedPresetName` on the old key. Every one of those fails silently.

const managerTs = stripComments(rd('src/presets/manager.ts'));

// --- the manager's own two owners ---------------------------------------------------------------------
const renameFn = /rename\(from: string, to: string\): boolean \{[\s\S]*?\n  \}/.exec(managerTs);
chk('PresetManager.rename exists', !!renameFn);

// The map key and `metadata.name` are two copies of one identity. `main.ts` compares `metadata.name`
// against `lastAppliedPresetName`, and `exportPresetJSON` names the downloaded FILE from it, so a stale
// copy gives a preset that exports under its old name — invariant 17's shape.
chk('...and rewrites metadata.name, not only the map key',
  !!renameFn && /\.metadata\.name = trimmed/.test(renameFn[0]),
  'the key has a second copy inside the preset');

// ⚠️ The library is deep-frozen (D12), so `frozen.metadata.name = x` fails SILENTLY in sloppy mode. The
// entry must be rebuilt from a clone, and re-frozen — an unfrozen entry re-opens the D12 corruption path.
chk('...cloning before the write, since the library entry is deep-frozen',
  !!renameFn && /structuredClone\(preset\)/.test(renameFn[0]),
  'assigning into a frozen object is a silent no-op, not a throw');
chk('...and re-freezing the rebuilt entry',
  !!renameFn && /this\.library\.set\(trimmed, PresetManager\.deepFreeze\(/.test(renameFn[0]));

// ⚠️ The order index must be CARRIED, not re-issued. Re-issuing compiles, type-checks and looks right —
// and moves the preset to the end of every order sort, which for a refined preset means separating it from
// the original it exists to be compared against. Measured: order-asc keeps 177/177 pairs adjacent.
chk('...preserving the library-order index rather than issuing a new one',
  !!renameFn && /const position = this\.order\.get\(from\)/.test(renameFn[0])
    && /this\.order\.set\(trimmed, position\)/.test(renameFn[0]),
  'a fresh index moves the preset to the end of every order sort');
chk('...and deleting the old order key, so a renamed preset is not counted twice',
  !!renameFn && /this\.order\.delete\(from\)/.test(renameFn[0]));

// Case-insensitive, matching the import gate: `activeSlots` would hold `cosmos` and `Cosmos` as two slots
// for what a reader sees as one name.
chk('...refusing a name already taken, compared case-INSENSITIVELY',
  !!renameFn && /existing\.toLowerCase\(\) === lower/.test(renameFn[0]),
  'the import gate is case-insensitive; the four maps downstream are not');

// --- sorting is a VIEW ---------------------------------------------------------------------------------
const listFn = /list\(sort\?: PresetSortMode\): string\[\] \{[\s\S]*?\n  \}/.exec(managerTs);
chk('list() takes an optional sort mode', !!listFn);

// ⚠️ **The default must stay insertion order.** `presets/library.ts` interleaves each `"<Original> new"` preset
// immediately after its original in the object handed to `loadAll`, and insertion order is the ONLY thing
// putting the pair side by side. A default of `name-asc` splits 9 of the 177 pairs (measured), silently
// destroying the adjacency the refined set exists for.
chk('...and no argument means library order, never a name sort',
  !!listFn && /if \(!sort \|\| sort === 'order-asc'\)/.test(listFn[0]),
  'a name-sorted default splits 9 of the 177 original/refined pairs');

// A sort that rewrote `library` would be irreversible: the interleave cannot be reconstructed from names.
chk('...copying the keys rather than sorting the library in place',
  !!listFn && /const names = \[\.\.\.this\.library\.keys\(\)\];/.test(listFn[0])
    && !/this\.library\.clear\(\)/.test(managerTs),
  'reordering the library is not undoable — the interleave is not derivable from names');

// One comparator, shared. Two spellings is how the grid and the manager come to disagree about a sort.
chk('the name comparator keeps numeric:true, since imports MINT " v<n>" names',
  /localeCompare\([\s\S]{0,60}?numeric: true/.test(managerTs),
  'without it, `X v10` sorts before `X v2`');

// --- the grid's three owners --------------------------------------------------------------------------
const renameTile = /renameTile\(from: string, to: string\): void \{[\s\S]*?\n  \}/.exec(gridTs);
chk('the grid exposes renameTile', !!renameTile);

// ⚠️ Ordering is load-bearing and inverting it type-checks. `acquireSlot` returns early on
// `activeSlots.has(name)`, and the slot is keyed by NAME — so releasing after re-keying strands a
// generator, a TransMap and up to three textures with no handle able to reach them (invariant 1).
const relIdx = renameTile ? renameTile[0].indexOf('releaseSlot(from)') : -1;
const acqIdx = renameTile ? renameTile[0].indexOf('acquireSlot(to') : -1;
chk('...releasing the OLD slot before re-acquiring under the new name',
  relIdx > 0 && acqIdx > relIdx,
  'the slot is name-keyed; the wrong order strands a generator and 3 textures');

chk('...re-keying BOTH tile maps, not just the element one',
  !!renameTile && /this\.tileElements\.delete\(from\)/.test(renameTile[0])
    && /this\.tileCanvases\.delete\(from\)/.test(renameTile[0])
    && /this\.tileElements\.set\(to, tile\)/.test(renameTile[0])
    && /this\.tileCanvases\.set\(to, canvas\)/.test(renameTile[0]),
  'tileElements and tileCanvases are two maps under one key');

// `dataset.preset` is the key the click and dblclick handlers read — see below.
chk('...and rewriting dataset.preset, which is what the tile listeners read',
  !!renameTile && /tile\.dataset\.preset = to/.test(renameTile[0]));

// ⚠️ The listeners must NOT close over the constructor's `name` parameter: after a rename that captured
// string is the OLD name, so clicking the tile would apply a preset that no longer exists (or, worse, a
// different one that has since taken the name). This is the defect that made `buildTile` read the dataset.
const buildTile = /private buildTile\(name: string\)[\s\S]*?\n  \}/.exec(gridTs);
chk('tile listeners read dataset.preset rather than the captured name',
  !!buildTile && /const current = tile\.dataset\.preset/.test(buildTile[0])
    && !/addEventListener\('click', \(\) => \{\s*this\.config\.onPresetSelected\(name\)/.test(buildTile[0]),
  'a captured name is the OLD name after a rename');

// --- sorting moves nodes, never rebuilds them ---------------------------------------------------------
const applySort = /private applySort\(mode: PresetSortMode\): void \{[\s\S]*?\n  \}/.exec(gridTs);
chk('applySort exists', !!applySort);

// ⚠️ `appendChild` on an already-parented node MOVES it, keeping the element, the canvas and the renderer
// slot. Rebuilding would release and re-acquire up to 128 slots in one synchronous pass, thrashing the
// eviction path and blanking every visible tile for several frames — for a reorder.
chk('...moving existing tiles with appendChild rather than rebuilding them',
  !!applySort && /this\.gridEl\.appendChild\(tile\)/.test(applySort[0])
    && !/buildTile/.test(applySort[0]),
  'rebuilding re-acquires up to 128 slots synchronously');

// invariant 17's shape: `presetNames` drives the search suggestions and `Export All`'s entry order, so
// leaving it in the old order makes the search list disagree with the grid on screen.
chk('...reordering presetNames in place, so the search list agrees with the grid',
  !!applySort && /this\.config\.presetNames\.length = 0/.test(applySort[0])
    && /this\.config\.presetNames\.push\(\.\.\.present\)/.test(applySort[0]),
  'the array object is shared with main.ts — reassigning it would orphan their copy');

// A library entry with no tile must not inject a hole into the DOM order.
chk('...ordering only names this panel actually has a tile for',
  !!applySort && /sorted\.filter\(\(n\) => this\.tileElements\.has\(n\)\)/.test(applySort[0]));

// invariant 13: a dropdown that cannot reorder anything is a control that does not move what it names.
chk('the sort dropdown is built only when the sorted-name getter is supplied',
  /if \(this\.config\.getSortedPresetNames\) \{/.test(gridTs),
  'invariant 13 — otherwise the control is inert');

// --- both panels forward the handler, and main.ts wires BOTH configs ----------------------------------
chk('the grid config declares onRenamePreset',
  /onRenamePreset\?: \(from: string, to: string\) => string \| null;/.test(gridTs));
chk('the Lab config declares onRenamePreset',
  /onRenamePreset\?: \(from: string, to: string\) => string \| null;/.test(labTs));

// The same two-config trap as `onImportBundle`: wiring one panel and not the other gives a feature that
// works from the grid and silently does nothing from the Lab.
const renameWirings = [...mainTs.matchAll(/onRenamePreset: renamePreset,/g)];
chk('main.ts wires onRenamePreset into BOTH panel configs',
  renameWirings.length === 2,
  `found ${renameWirings.length} wiring(s), expected 2`);

chk('main.ts wires getSortedPresetNames from the manager',
  /getSortedPresetNames: \(sort\) => presetManager\.list\(sort\)/.test(mainTs));

// ⚠️ The suffix rule MINTS a primary key, so there must be exactly one implementation of it. A second
// hand-rolled `+ ' v2'` in the rename path would drift from the import path's measured rule.
chk('the rename path reuses nextVersionedName rather than re-implementing the suffix rule',
  /nextVersionedName\(wanted, taken\)/.test(mainTs),
  "a second implementation drifts from the rule measured over the composed library of 247 names (§E)");

// ⚠️ Renaming `X` while `X v2` exists must not skip a free name: the preset's OWN name is not "taken".
chk('...excluding the preset\'s own name from the taken set',
  /filter\(\(n\) => n !== from\.toLowerCase\(\)\)/.test(mainTs));

// ⚠️ **`lastAppliedPresetName` is the non-obvious fifth owner.** `main.ts` gates render-mode persistence on
// `preset.metadata.name === lastAppliedPresetName`; missing it makes the active preset compare unequal to
// ITSELF on the next apply and silently revert `renderer.mode`. Nothing about the name says it is a key.
chk('main.ts updates lastAppliedPresetName, the fifth name-keyed owner',
  /if \(lastAppliedPresetName === from\) lastAppliedPresetName = finalName;/.test(mainTs),
  'otherwise the active preset compares unequal to itself and render mode reverts');

// The Lab holds its own `metadata.name` in `workingPreset`. Reapplying the preset would re-init the
// generators, the renderer and TransMap for what is only an identity change.
chk('...and the Lab\'s working copy, without re-applying the preset',
  /working\.metadata\.name = finalName;/.test(mainTs)
    && !/setWorkingPresetExternal\(renamed/.test(mainTs));

// Same construction-time-snapshot trap as the import dialog (section A). The Lab's `presetNames` is never
// refreshed, so a rename dialog reading it would validate against the library as it was at startup.
chk('the rename dialog takes a GETTER for the existing names',
  /export function renamePresetWithDialog\(\s*currentName: string,\s*existingNames:\s*\(\)\s*=>\s*string\[\]/
    .test(exportCode),
  'the Lab\'s own name array is a construction-time snapshot nothing refreshes');

chk('...and the Lab passes getPresetNames, not its snapshot array',
  /renamePresetWithDialog\(current, getPresetNames,/.test(labTs));

// --- H. the grid's Rename/Save mode owns the SHARED search field ---------------------------------------
//
// The tile-level `dblclick` editor was removed on 2026-08-25 after a browser pass reported it simply did not
// work. Renaming is now a header mode, and its whole risk is that it BORROWS the search input: four handlers
// on that field, plus `setActivePreset`, all write or read it, and every one of them is correct for search
// and wrong for a rename. `tsc` sees a `string | null` flag being tested and can say nothing about who else
// writes the field. These assertions are that gate.

// ⚠️ The affordance must not come back. A `dblclick` on a tile also fires two `click`s that navigate and
// re-apply the preset, and the handler can only bind to the label span — the canvas is most of the tile.
chk('no dblclick rename handler survives on a tile',
  !/dblclick/.test(buildTile?.[0] ?? '') && !/private beginRename\(/.test(gridTs),
  'the tile-level rename editor was removed as unworkable — do not re-add it');

const beginMode = /private beginRenameMode\(\): void \{[\s\S]*?\n  \}/.exec(gridTs);
const endMode = /private endRenameMode\(commit: boolean\): void \{[\s\S]*?\n  \}/.exec(gridTs);
chk('the grid has a rename MODE, entered and left through one pair of methods',
  !!beginMode && !!endMode);

// invariant 13 again: no handler, no button — otherwise the control cannot do what it says.
chk('...with the button built only when onRenamePreset was supplied',
  /if \(this\.config\.onRenamePreset\) \{\s*this\.renameBtn = document\.createElement\('button'\)/.test(gridTs),
  'invariant 13 — a Rename button with no handler is inert');

// ⚠️ The caption IS the mode indicator, so one writer only. Two sites setting `textContent` is how a button
// comes to read "Rename" while the field is in rename mode.
const btnUpdate = /private updateRenameButton\(\): void \{[\s\S]*?\n  \}/.exec(gridTs);
chk('...one writer for the button caption, covering both states',
  !!btnUpdate && /'Save' : 'Rename'/.test(btnUpdate[0])
    && [...gridTs.matchAll(/renameBtn\.textContent/g)].length === 1,
  'two writers is how the caption comes to disagree with the mode');

// ⚠️ **The four field handlers are the actual defect surface.** `blur` is the one that bites: pressing Save
// blurs the field first, and `cancelSearch` rewrites its value back to `activeName` — so an ungated blur
// erases the typed name before the button can read it, and Save appears to do nothing. Exactly the class of
// silent failure that the removed dblclick editor was.
for (const [handler, gate] of [
  ['input', /addEventListener\('input', \(\) => \{\s*if \(this\.renamingName === null\) this\.onSearchInput\(\);/],
  ['focus', /addEventListener\('focus', \(\) => \{\s*if \(this\.renamingName !== null\) return;/],
  ['blur', /addEventListener\('blur', \(\) => \{\s*if \(this\.renamingName !== null\) return;/],
]) {
  chk(`...the search field's ${handler} handler is gated on rename mode`,
    gate.test(gridTs),
    'the rename borrows the search field; an ungated handler fights it for the value');
}

// `setActivePreset` runs ON the commit path (`renameTile` → main.ts → `setActivePreset`), so this is not a
// hypothetical writer — it is one that fires mid-rename.
chk('...and setActivePreset does not overwrite the field mid-rename',
  /if \(this\.searchInput && this\.renamingName === null\) \{/.test(gridTs),
  'it runs on the commit path itself, via renameTile');

// Enter/Escape must be handled AND stopped: `main.ts` binds document-level arrows to preset navigation and
// digits to film looks, which would fire while a name is being typed.
chk('...Enter commits, Escape restores, and the keys do not reach the document handler',
  /if \(this\.renamingName !== null\) \{\s*[\s\S]{0,400}?e\.stopPropagation\(\);[\s\S]{0,200}?if \(e\.key === 'Enter'\) this\.endRenameMode\(true\);[\s\S]{0,80}?if \(e\.key === 'Escape'\) this\.endRenameMode\(false\);/
    .test(gridTs),
  'main.ts binds arrows and digits at the document level');

// ⚠️ The agreed rule: a clash is OFFERED in the field for a second explicit Save, never auto-applied. So the
// early `return` must come before the commit and must NOT clear the mode — the button still says Save.
chk('...a name clash offers the versioned name and STAYS in rename mode',
  !!endMode && /this\.searchInput\.value = nextVersionedName\(typed, taken\);/.test(endMode[0])
    && endMode[0].indexOf('nextVersionedName') < endMode[0].indexOf('onRenamePreset?.('),
  'auto-applying on the first Save was the rejected behaviour');

// One implementation of the suffix rule, as in section D — it MINTS a primary key.
chk('...reusing nextVersionedName rather than re-implementing the suffix rule',
  /import \{[^}]*nextVersionedName[^}]*\} from '\.\.\/synthesis-lab\/export\.ts'/.test(gridTs),
  "a second implementation drifts from the rule measured over the composed library of 247 names (§E)");

// Same own-name exclusion as the main.ts path: renaming `X` while `X v2` exists must not skip `X v2`.
chk('...excluding the preset\'s own name from the taken set',
  !!endMode && /filter\(\(n\) => n !== original\.toLowerCase\(\)\)/.test(endMode[0]));

// ⚠️ A getter, not the panel's `presetNames` array — that one is the panel's own copy (the D4 split) and a
// sort reorders it, so a conflict test against it is testing a snapshot of a view.
chk('...validating against getPresetNames(), the authoritative list',
  !!endMode && /this\.config\.getPresetNames\(\)/.test(endMode[0]),
  'presetNames is this panel\'s own array, reordered by a sort');

// `renamingName` holds a name that `renameTile` changes underneath it — the same captured-key trap the tile
// listeners have, one level up.
chk('renameTile re-keys renamingName, not just activeName',
  !!renameTile && /if \(this\.renamingName === from\) this\.renamingName = to;/.test(renameTile[0]),
  'the flag would otherwise name a preset the library no longer has');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  namecheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
