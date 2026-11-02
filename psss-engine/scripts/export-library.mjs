#!/usr/bin/env node
/*
 * ============================================================================================
 * EXTERNALISE THE DEPLOYMENT'S DATA — the build's third and fourth files.
 * ============================================================================================
 *
 * Writes `dist/psss_presets.json` (the preset library) and `dist/psss_reels.json` (the reel library), the two
 * files a `file://` deployment loads at startup. Run by `npm run build` after `vite build`; runnable on its own
 * (`node scripts/export-library.mjs [outDir]`).
 *
 * ⚠️ **ONE SCRIPT FOR BOTH FILES, BECAUSE THE REELS' STRONGEST ASSERTION NEEDS THE COMPOSED LIBRARY.** A reel
 * naming a preset the deployment does not have is not an error at runtime — `resolveReel` skips it and the reel
 * simply plays shorter, which reads as "this build has fewer presets" and is the single most invisible defect in
 * the feature. The check for it is `names` ∩ every reel's `presets`, and `names` only exists after composition.
 * Splitting this into `export-reels.mjs` would mean composing the library twice, which is the one thing the
 * paragraph below forbids.
 *
 * ⚠️ **THE SOURCE OF TRUTH IS `src/presets/`, AND THIS FILE IS A BUILD ARTEFACT — never hand-edit it and
 * never commit it.** It is regenerated on every build, which is the only reason it cannot drift from the
 * library the dev build shows. Retuning a refined preset means re-running the build, nothing more.
 *
 * ⚠️ **COMPOSITION IS NOT REIMPLEMENTED HERE.** It calls `loadLibrary()` — the same function `main.ts`
 * calls — so the interleave, both orphan sweeps and the five built-in groups happen exactly once in the
 * codebase. Order is the property at risk: `PresetManager.list()` sorts nothing, so library position is
 * insertion order, and a second implementation would diverge silently in the one artefact nobody diffs.
 *
 * ⚠️ **NOT the UI's export path.** `ui/synthesis-lab/export.ts` gates overlay blocks per block, and a gate
 * DESTROYS a block rather than omitting it (CLAUDE.md invariant 17) — routing the library through it would
 * ship presets missing their overlay. This serialises `PresetManager.get()` structurally instead, which is
 * what `PresetManager.export()` already does.
 *
 * ⚠️ **ENGINE FORMAT (`metadata.version === 2`), NOT the legacy format.** Required: a TransMap chain
 * survives `migrate` but cannot be expressed in the legacy JSON, so exporting as legacy would silently drop
 * the chain presets. The file is therefore the same schema as a single-preset Export from the Lab, which is
 * what makes it mergeable with the user's own exports. `MigrationLayer.migrate` dispatches on the version, so
 * the runtime still accepts a legacy file dropped in its place.
 *
 * ⚠️ **NO npm DEPENDENCY AND NO SECOND BUNDLER PASS.** Node imports the `.ts` modules directly (type
 * stripping, unflagged since Node 22.18); measured working on Node 22.22. That holds only while
 * `presets/library.ts` and its import graph stay free of browser-only code — see the warning in that file.
 *
 * Every assertion below fails the BUILD. They are cheap (~a second on 360 presets) and each one covers a
 * defect that is otherwise invisible until someone opens the deployment:
 *   - a non-finite number, a function, an `undefined` value or a Map/Set/typed array, none of which JSON
 *     carries: `JSON.stringify` turns NaN/Infinity into `null` and drops the rest, silently.
 *   - an integer-like preset NAME: every JS engine hoists such keys to the front of an object, so the
 *     preset would jump to the top of the grid on reload. Measured 0 today.
 *   - the round trip itself: re-parse, re-load through `PresetManager`, compare NAME ORDER and every
 *     preset byte for byte against the library this process just composed.
 *
 * And four more that belong to the reel file, at the foot of this script:
 *   - every preset every emitted reel names exists in the library just composed — the one defect in the whole
 *     feature that is silent by design at runtime;
 *   - the main reel resolves to a reel that is actually in the file;
 *   - the reel file round-trips through `parseReelFile`, the engine's own parser, with nothing rejected;
 *   - `index.html` really does `<script src>` both emitted data files, which is the only thing tying the names
 *     here to the tags `vite.config.ts` writes.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, process.argv[2] ?? 'dist');
const OUT_FILE = resolve(OUT_DIR, 'psss_presets.json');

const { PresetManager } = await import(new URL('../src/presets/manager.ts', import.meta.url).href);
const { loadLibrary } = await import(new URL('../src/presets/library.ts', import.meta.url).href);
// v8 Phase 19. ⚠️ **Every name here is IMPORTED, never spelled again** — each exists in exactly one place
// (`reel-store.ts`) and a second literal is how the writer and the reader drift apart with nothing between them.
const { REEL_LIBRARY_KEY, REEL_DEPLOYMENT_FILE, REEL_DEPLOYMENT_GLOBAL, extractDeploymentReels, ReelStore } =
  await import(new URL('../src/presets/reel-store.ts', import.meta.url).href);
const { parseReelFile, resolveReel } = await import(new URL('../src/exploration/reel-model.ts', import.meta.url).href);
const REELS_OUT_FILE = resolve(OUT_DIR, REEL_DEPLOYMENT_FILE);

// The legacy file is `g_psss_presets={…}` — a script, not JSON. Same strip as `main.ts`'s dev branch.
const raw = readFileSync(resolve(ROOT, 'public/psss_presets.json'), 'utf8');
const rawPresets = JSON.parse(raw.replace(/^\s*(var\s+)?g_psss_presets\s*=\s*/, '').replace(/;\s*$/, ''));

/*
 * ⚠️ **`__reels` OUT BEFORE `loadLibrary`, AND — SINCE 19.11 — NEVER BACK IN.** It now feeds
 * `dist/psss_reels.json` at the foot of this file instead of riding along inside the preset file. The rule the
 * removal replaces one half of still holds, and it is the half that fails silently:
 *
 * - Not extracting it makes `loadLibrary` migrate the reel list INTO a preset named `__reels` — it does not
 *   throw, `MigrationLayer` defaults its way to a wave-less preset, and the deployment ships a black tile.
 * - Putting it BACK is now the defect: a deployment carrying its reel list in two files is two sources for one
 *   value (CLAUDE.md invariant 17), and the runtime resolves the external file first, so the copy inside the
 *   preset file would be dead weight that a hand-edit could silently disagree with.
 *
 * `extractDeploymentReels` MUTATES `rawPresets`, which is the point — the same call `main.ts` makes on both of
 * its load paths, so this script cannot disagree with the engine about what a preset is.
 */
const deploymentReels = extractDeploymentReels(rawPresets);

const manager = new PresetManager();
const orphans = loadLibrary(manager, rawPresets);
const names = manager.list();
if (names.length === 0) throw new Error('export-library: composed library is EMPTY');
if (orphans > 0) console.warn(`[export-library] ${orphans} refined/variant preset(s) had no matching original`);

const library = {};
for (const name of names) library[name] = manager.get(name);

// --- what JSON cannot carry ----------------------------------------------------------------------
const hazards = [];
const walk = (v, path) => {
  if (typeof v === 'number') { if (!Number.isFinite(v)) hazards.push(`${path} = ${v}`); return; }
  if (typeof v === 'function') { hazards.push(`${path} = function`); return; }
  if (v === undefined) { hazards.push(`${path} = undefined`); return; }
  if (v === null || typeof v !== 'object') return;
  if (v instanceof Map || v instanceof Set || ArrayBuffer.isView(v)) { hazards.push(`${path} = ${v.constructor.name}`); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
  for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
};
for (const name of names) walk(library[name], name);
if (hazards.length > 0) {
  throw new Error(`export-library: ${hazards.length} value(s) JSON cannot carry:\n  ${hazards.slice(0, 10).join('\n  ')}`);
}

// --- a name JSON would reorder -------------------------------------------------------------------
const integerLike = names.filter((n) => /^(0|[1-9]\d*)$/.test(n));
if (integerLike.length > 0) {
  throw new Error(`export-library: integer-like preset name(s) would be hoisted to the front of the library: ${integerLike.join(', ')}`);
}

// --- write, then prove it reloads identically ----------------------------------------------------
// Pretty-printed on purpose: editing this file and merging it with other exports is its declared purpose
// (2.2 MB against 0.8 MB minified, on a local deployment where the difference does not matter).
// ⚠️ **PRESETS ONLY — no reserved key** (19.11). The reel list goes to its own file below.
// ⚠️ **THE FORMAT'S OWNER IS `src/presets/deployment-format.ts`, AND THIS IS A HAND-KEPT THIRD COPY OF IT.**
// Since 2026-10-10 the browser's `Export All` / `Export Reels` write the same `g_psss_*=` prefix, through
// `writeDeploymentFile()` there, precisely so an export is a drop-in replacement for what this script emits.
// A Node build script cannot import that TS module without a build step of its own, so the prefix and the
// strip regex are spelled here as well as there, with **no compiler between the copies** — the same gap the
// filename has, which `reelcheck` §K closes for the reel file only. **Change the global's spelling and you
// are editing three files**: this one, `deployment-format.ts` and `vite.config.ts`'s `<script src>` emitter.
const text = `g_psss_presets=${JSON.stringify(library, null, 2)}\n`;
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, text, 'utf8');

const back = JSON.parse(readFileSync(OUT_FILE, 'utf8').replace(/^\s*(var\s+)?g_psss_presets\s*=\s*/, ''));
// ⚠️ **Asserted ABSENT rather than stripped** (19.11). The key must not be in the emitted preset file at all;
// if it ever were, `loadAll` below would make `names2` one longer than `names` and the failure would arrive as
// a message about the library ORDER, which names the wrong subject entirely.
if (Object.prototype.hasOwnProperty.call(back, REEL_LIBRARY_KEY)) {
  throw new Error(`export-library: '${REEL_LIBRARY_KEY}' is in the emitted preset file — the reel list belongs in ${REEL_DEPLOYMENT_FILE} and nowhere else`);
}
const reloaded = new PresetManager();
reloaded.loadAll(back);
const names2 = reloaded.list();
if (JSON.stringify(names) !== JSON.stringify(names2)) {
  throw new Error(`export-library: library ORDER changed across the round trip (${names.length} vs ${names2.length} names)`);
}
const differing = names.filter((n) => JSON.stringify(manager.get(n)) !== JSON.stringify(reloaded.get(n)));
if (differing.length > 0) {
  throw new Error(`export-library: ${differing.length} preset(s) differ after the round trip, first: ${differing.slice(0, 5).join(', ')}`);
}

console.log(`[export-library] ${names.length} presets -> ${OUT_FILE} (${text.length} bytes), round trip verified`);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// THE REEL LIBRARY — `dist/psss_reels.json`, the deployment's fourth file (v8 Phase 19.11)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **COMPOSED BY THE ENGINE'S OWN `ReelStore`, NOT ASSEMBLED HERE.** The store owns the layer merge
 * (built-in → deployment, shadowing BY NAME and keeping position) and `toFileText()` owns the file format, so
 * this script cannot ship a set the engine would compose differently or a file the Import button would reject.
 * The same reasoning as `loadLibrary` above, applied to the other library.
 *
 * ⚠️ **`new ReelStore(null)` — no persistence, deliberately.** Under Node there is no `localStorage`, and if
 * there were, the build would start baking the developer's own saved reels into the deployment. `null` is a
 * supported state (see the constructor), not a degraded one.
 *
 * ⚠️ **A `__reels` key in `public/psss_presets.json` is still HONOURED — as input to this file.** That is the
 * one remaining reason to author one, and the extraction above is what keeps it from becoming a preset.
 */
const reelStore = new ReelStore(null);
if (deploymentReels !== undefined) reelStore.adoptDeploymentReels(deploymentReels);
const reelText = `${REEL_DEPLOYMENT_GLOBAL}=${reelStore.toFileText()}\n`;
const reelsOut = reelStore.list();
const reelMain = reelStore.mainReelName();
if (reelsOut.length === 0) throw new Error('export-library: the composed reel library is EMPTY — a deployment with no reel cannot autostart');

/*
 * ⚠️ **THE ASSERTION THIS FILE EXISTS FOR: every preset every reel names must be IN the library just composed.**
 * A missing name is silent at runtime by design — `resolveReel` puts it in `skipped`, the reel plays shorter and
 * the strip shows it `.missing`, which a user reads as "this build has fewer presets". `reelcheck` §J checks the
 * built-in reels against `public/psss_presets.json`; this checks whatever is actually being SHIPPED against
 * whatever was actually composed, which is a different pair and the one the deployment runs on.
 *
 * ⚠️ **Per NAME, never per reel.** A reel with eleven of its twelve names wrong still "resolves", so a per-reel
 * test reports nothing at all — the calibration for that is `reelcheck` §J's second seed.
 */
const missing = [];
for (const reel of reelsOut) {
  const { skipped } = resolveReel(reel, (n) => Object.prototype.hasOwnProperty.call(library, n));
  for (const name of skipped) missing.push(`${reel.name} -> ${name}`);
}
if (missing.length > 0) {
  throw new Error(`export-library: ${missing.length} reel entr(ies) name a preset the deployment does not have:\n  ${missing.slice(0, 10).join('\n  ')}`);
}

// The main reel must resolve, or the deployment autostarts the fallback and nothing says so.
if (reelMain === null || !reelsOut.some((r) => r.name === reelMain)) {
  throw new Error(`export-library: the main reel (${reelMain ?? 'none'}) is not in the emitted reel set`);
}

writeFileSync(REELS_OUT_FILE, reelText, 'utf8');

// --- the reel file's own round trip, through the ENGINE'S parser -----------------------------------
// ⚠️ `parseReelFile` and not a bespoke shape test: this is the exact function `Import Reels` and the deployment
// loader both go through, so a file that fails here is a file the engine would have refused at startup — where
// the only symptom is that the built-in reels play instead.
const reelBack = parseReelFile(readFileSync(REELS_OUT_FILE, 'utf8').replace(new RegExp(`^\\s*(var\\s+)?${REEL_DEPLOYMENT_GLOBAL}\\s*=\\s*`), '').replace(/;\s*$/, ''));
if (!reelBack) throw new Error(`export-library: ${REEL_DEPLOYMENT_FILE} is not a reel file the engine can read`);
if (reelBack.rejected > 0) throw new Error(`export-library: ${reelBack.rejected} emitted reel(s) came back unreadable`);
if (JSON.stringify(reelBack.reels) !== JSON.stringify(reelsOut)) {
  throw new Error('export-library: the reel set changed across the round trip (order, or a field a reel lost)');
}
if (reelBack.mainReelName !== reelMain) {
  throw new Error(`export-library: the main reel did not survive the round trip (${reelMain} -> ${reelBack.mainReelName})`);
}

/*
 * --- both files are actually REFERENCED by the HTML ------------------------------------------------
 *
 * ⚠️ **THE ONE CHECK THAT SPANS `vite.config.ts` AND THIS SCRIPT, WHICH SHARE NO LITERAL.** The file names are
 * spelled in three places — the `<script>` tags the packer writes, `REEL_DEPLOYMENT_FILE`/`OUT_FILE` here, and
 * the fetch path in `main.ts` — and a rename in any one of them produces a `dist/` that is complete, opens, and
 * plays the wrong thing: no presets (a thrown error, at least loud) or the built-in reels (silent). Both halves
 * exist by the time this runs, because `vite build` is build step 2 and this is step 3.
 *
 * ⚠️ **Skipped, with a warning, when `index.html` is absent** — this script is documented as runnable on its own
 * against an arbitrary `outDir`, and turning that into a failure would make the standalone invocation useless.
 */
const htmlPath = resolve(OUT_DIR, 'index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8');
  for (const file of ['psss_presets.json', REEL_DEPLOYMENT_FILE]) {
    if (!html.includes(`src="./${file}"`)) {
      throw new Error(`export-library: index.html does not load './${file}' — the packer in vite.config.ts and this script disagree about the name`);
    }
  }
} else {
  console.warn(`[export-library] no index.html in ${OUT_DIR} — skipped the cross-reference check`);
}

const reelSourceNote = deploymentReels === undefined ? 'built-in' : `built-in + ${Array.isArray(deploymentReels) ? deploymentReels.length : '?'} from ${REEL_LIBRARY_KEY}`;
console.log(`[export-library] ${reelsOut.length} reels (${reelSourceNote}), main "${reelMain}" -> ${REELS_OUT_FILE} (${reelText.length} bytes), round trip verified`);
