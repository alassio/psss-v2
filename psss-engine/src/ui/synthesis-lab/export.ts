import type { UnifiedPreset } from '../../presets/types.ts';
import { stripDeploymentAssignment, writeDeploymentFile } from '../../presets/deployment-format.ts';
import { MigrationLayer } from '../../presets/migration.ts';
import { DIALOG_TIPS } from './tooltips.ts';
import { looksLikeReelFile, parseReelFile, type ParsedReelFile } from '../../exploration/reel-model.ts';

/**
 * `YYYYMMDD_HHMMSS` in LOCAL time, the suffix every export filename carries.
 *
 * Local, not UTC, deliberately: the stamp exists so a user can tell two exports of the same preset apart
 * at a glance, so it has to read as the wall-clock time they pressed the button. Do not "fix" it to
 * `toISOString()` — that would shift the visible time by the UTC offset and change every future filename.
 *
 * Was duplicated verbatim in both export functions (triage I7).
 */
function timestampSuffix(): string {
  const now = new Date();
  const p2 = (n: number) => n.toString().padStart(2, '0');
  return now.getFullYear().toString()
    + p2(now.getMonth() + 1)
    + p2(now.getDate())
    + '_'
    + p2(now.getHours())
    + p2(now.getMinutes())
    + p2(now.getSeconds());
}

/**
 * Blob → object URL → synthetic anchor click → revoke. `stem` is extended with the timestamp suffix.
 *
 * The anchor is never added to the document: a detached `<a>` click is honoured by every browser this
 * engine targets, and appending it would flash a link into the layout.
 */
function downloadJSON(stem: string, json: string, stamp = true): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // ⚠️ **`stamp: false` IS FOR THE TWO DROP-IN EXPORTS ONLY.** The timestamp exists because several
  // preset exports land in one downloads folder and are told apart by nothing else. The two library
  // exports are the exception on purpose: their whole job is to replace a file of a FIXED name, so a
  // stamped name would put the renaming back on the user, which is the step the owner asked to remove.
  a.download = stamp ? `${stem}_${timestampSuffix()}.json` : `${stem}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAllPresetsJSON(
  presetNames: string[],
  getPreset: (name: string) => UnifiedPreset | undefined,
  baseFilename: string,
): void {
  const all: Record<string, UnifiedPreset> = {};
  for (const name of presetNames) {
    const p = getPreset(name);
    if (p) all[name] = p;
  }
  /*
   * ⚠️ **A DROP-IN DEPLOYMENT FILE: the assignment and the exact filename** (owner, 2026-10-10). The
   * output is `psss_presets.json` containing `g_psss_presets={…}`, so replacing a deployment's library
   * is copy-over-and-done. It cannot be plain JSON — a page opened from `file://` can only read a
   * sibling data file by executing it (measured; see `presets/deployment-format.ts`).
   *
   * `baseFilename` is still honoured for the stem so a host can name the file something else, but the
   * default from `main.ts` is `psss_presets`, which is what the deployment reads.
   */
  downloadJSON(
    baseFilename.replace(/\.json$/i, ''),
    writeDeploymentFile('presets', JSON.stringify(all, null, 2)),
    false,
  );
}

/**
 * Keys that appear at the TOP LEVEL of a single preset, in either schema version.
 *
 * Used only by `isPresetShaped`, and deliberately a union of both versions: an `Export All` bundle can
 * hold v2 presets while a hand-kept legacy bundle holds v1 ones, and both must be restorable.
 */
const PRESET_MARKER_KEYS = [
  'metadata', 'generators', 'renderer', 'overlay', 'postProcessors',
  'ParticleCount', 'Waves', 'SinMagicParams', 'MotionBlur', 'Version',
] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isPresetShaped(v: unknown): boolean {
  return isPlainObject(v) && PRESET_MARKER_KEYS.some((k) => k in v);
}

/**
 * Is this parsed JSON a BUNDLE (`{ name: preset, ... }`, what `exportAllPresetsJSON` writes) rather than
 * a single preset?
 *
 * ⚠️ **The test is STRUCTURAL — every value is itself preset-shaped — and a top-level key sniff CANNOT
 * work here.** The obvious implementation is "does the object have a `metadata`/`ParticleCount`/... key",
 * but the library contains a preset literally named **`Waves`**, so a bundle has a top-level `Waves` key
 * and would be classified as a v1 single preset. Measured against all five real shapes (v1 single, v1
 * single *named `Waves`*, v2 single, v1 bundle, v2 bundle) before being trusted. A v2 single preset is not
 * mistaken for a bundle because its four values (`metadata`, `generators`, `renderer`, `postProcessors`)
 * are objects but none of them is preset-shaped.
 *
 * ⚠️ **This function exists because `Export All` wrote a file `Import` could not read.** The bundle was
 * handed whole to `MigrationLayer.migrate`, which does not throw on it: it silently produced ONE preset
 * (name `psss_presets`, `particleCount` 500) out of 177 — invariant 13's shape, a control that does not do
 * what it names, and invisible because nothing errored.
 */
export function isPresetBundle(raw: unknown): raw is Record<string, unknown> {
  if (!isPlainObject(raw)) return false;
  const values = Object.values(raw);
  return values.length > 0 && values.every(isPresetShaped);
}

/**
 * A trailing ` v<n>` VERSION SUFFIX, captured as `[stem, number]`.
 *
 * ⚠️ **The space before `v` and the anchored digits are both load-bearing**, and the pattern is measured
 * rather than merely written — **re-measured 2026-09-19 (EIGHTH settle batch) over the composed library of
 * 247 names: 0 match.** ⚠️ **That 0 is the whole point and also the limit of the evidence: nothing in the
 * library matches, so the rule is only ever exercised by an IMPORT**, and no library name can falsify it.
 * The version-*ish* names it correctly leaves alone are **THIRTY, in two populations an older wording here
 * blended into one list of twelve**: 7 digit-tailed (`Galaxy2`, `Nova2`, `Warp2`, `Deep Thought2`,
 * `Fluid Metall 2`, `Rippled Rays Of Light 2`/`3`) and 23 Roman-numeral (`Aurora Borealis II` …
 * `Who Needs A Fractal II`), the second class growing with every variant spawn. A looser pattern (`\d+$`)
 * would read `Galaxy2` as `Galaxy` at version 2 and rename an import to `Galaxy3` — and **6 of those 7
 * stems are themselves live presets**, so the damage is joining a real family rather than inventing one;
 * `Nova2` is the only one whose stem is absent. **Re-measure the three counts; never append a name.**
 */
const VERSION_SUFFIX_RE = /^(.*?)\s+v(\d+)$/i;

/**
 * The next free ` v<n>` name for `name`, given the names already taken.
 *
 * A name with no suffix goes to ` v2` (the original is version 1 implicitly); one that already ends in a
 * suffix has its number INCREMENTED, and the number keeps rising until the name is free. So `Cylinder` →
 * `Cylinder v2` → `Cylinder v3` on a repeated import, and `Moebius Paranoia v7` → `v8` → `v9` → `v10`.
 *
 * ⚠️ **`taken` must be a set of LOWER-CASED names**, because the four name-keyed maps downstream are
 * case-sensitive while a user is not: `activeSlots` would treat `cosmos` and `Cosmos` as two slots for one
 * apparent name. Same rule as `showImportDialog`'s duplicate test.
 *
 * ⚠️ **The stem is re-derived from `name` each call, never accumulated** — appending to the previous
 * candidate would produce `Cylinder v2 v3`.
 */
export function nextVersionedName(name: string, taken: ReadonlySet<string>): string {
  // Destructured with defaults rather than indexed: under `noUncheckedIndexedAccess` both groups are
  // `string | undefined`, and a bare `m[1]` in the template below would have compiled while printing the
  // literal word `undefined` into a preset name — i.e. into a primary key. Neither group can actually be
  // absent (`(.*?)` and `(\d+)` both always participate in a match), so the defaults are unreachable; they
  // exist to make that claim checkable instead of assumed.
  const [, matchedStem, matchedVersion] = VERSION_SUFFIX_RE.exec(name) ?? [];
  const stem = matchedVersion !== undefined ? matchedStem ?? name : name;
  let version = matchedVersion !== undefined ? parseInt(matchedVersion, 10) + 1 : 2;
  let candidate = `${stem} v${version}`;
  while (taken.has(candidate.toLowerCase())) candidate = `${stem} v${++version}`;
  return candidate;
}

/** `existingNames()` as a lower-cased set — the form every duplicate test here needs. */
function takenSet(existingNames: () => string[]): Set<string> {
  return new Set(existingNames().map((n) => n.toLowerCase()));
}

export function exportPresetJSON(preset: UnifiedPreset): void {
  downloadJSON(preset.metadata.name || 'preset', JSON.stringify(preset, null, 2));
}

/**
 * Ask for a new name for `currentName`, then hand the accepted name to `onConfirm`.
 *
 * ⚠️ **The conflict rule is the IMPORT rule, by calling the same `nextVersionedName`** — not a second
 * implementation of it. That matters because the suffix function is measured, not merely written: its
 * pattern was falsified over the composed library's 247 names for 0 false positives (re-measured 2026-09-19,
 * EIGHTH batch), and thirty version-*ish* names in TWO populations
 * (`Galaxy2`, `Aurora Borealis II`, `Fluid Metall 2`, …) depend on being left alone. A parallel
 * implementation here would be a second thing to keep true.
 *
 * ⚠️ **`existingNames` is a GETTER for the same reason the import dialog takes one** — the Lab's own name
 * list is a construction-time snapshot nothing refreshes (the D4 split), so an array parameter here would
 * validate a rename against the library as it stood at startup and accept a name added since.
 *
 * ⚠️ **Renaming to its own current name is accepted as a no-op, and a CASE-ONLY change is accepted too.**
 * `validate()` therefore excludes `currentName` from the clash test — comparing case-insensitively, so
 * `Cylinder` → `cylinder` is a recase of itself rather than a collision with itself.
 */
export function renamePresetWithDialog(
  currentName: string,
  existingNames: () => string[],
  onConfirm: (newName: string) => void,
): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;z-index:9999;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background:#1a1a2e;border:1px solid #3a3a5a;border-radius:8px;
    padding:24px;width:360px;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.6);
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-size:15px;font-weight:600;color:#fff;margin-bottom:16px;';
  title.textContent = 'Rename Preset';
  dialog.appendChild(title);

  const label = document.createElement('label');
  label.style.cssText = 'display:block;font-size:12px;color:#aaa;margin-bottom:6px;';
  label.textContent = 'Preset name';
  // On the LABEL as well as the field, because the label is the larger hover target and the two together
  // cover the whole row a pointer might rest on.
  label.title = DIALOG_TIPS['rename.name']!;
  dialog.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.title = DIALOG_TIPS['rename.name']!;
  input.style.cssText = `
    width:100%;box-sizing:border-box;padding:7px 10px;
    background:#2a2a4a;border:1px solid #3a3a5a;border-radius:4px;
    color:#ddd;font-size:13px;outline:none;
  `;
  dialog.appendChild(input);

  const error = document.createElement('div');
  error.style.cssText = 'font-size:11px;color:#e07070;margin-top:5px;min-height:16px;';
  dialog.appendChild(error);

  /** One-click acceptance of the ` v<n>` suggestion, exactly as the import dialog offers it. */
  const fixBtn = document.createElement('button');
  fixBtn.type = 'button';
  fixBtn.title = DIALOG_TIPS['rename.fix']!;
  fixBtn.style.cssText = `
    display:none;padding:3px 9px;margin-top:2px;border:1px solid #3a3a5a;border-radius:4px;
    background:#2a2a4a;color:#9ad4ea;cursor:pointer;font-size:11px;
  `;
  dialog.appendChild(fixBtn);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:18px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.title = DIALOG_TIPS['rename.cancel']!;
  cancelBtn.style.cssText = `
    padding:6px 14px;border:1px solid #3a3a5a;border-radius:4px;
    background:#2a2a4a;color:#ccc;cursor:pointer;font-size:12px;
  `;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Rename';
  confirmBtn.title = DIALOG_TIPS['rename.confirm']!;
  confirmBtn.style.cssText = `
    padding:6px 14px;border:none;border-radius:4px;
    background:#7ec8e3;color:#111;font-weight:600;cursor:pointer;font-size:12px;
  `;

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  /**
   * ⚠️ Calls `existingNames()` on every keystroke rather than closing over a prebuilt Set — hoisting the set
   * would re-freeze the list at dialog-open time, which is the same defect class the getter removes.
   */
  function validate(): boolean {
    const name = input.value.trim();
    if (!name) {
      error.textContent = 'Name cannot be empty.';
      fixBtn.style.display = 'none';
      return false;
    }
    // Its own name is not a conflict — that is the no-op / recase case.
    const clashes = name.toLowerCase() !== currentName.toLowerCase()
      && existingNames().some((n) => n.toLowerCase() === name.toLowerCase());
    if (clashes) {
      // The preset's OWN name must not be treated as taken while suffixing, or renaming `X` when `X v2`
      // exists would skip straight past a name that is in fact free.
      const taken = new Set(
        existingNames().map((n) => n.toLowerCase()).filter((n) => n !== currentName.toLowerCase()),
      );
      const suggestion = nextVersionedName(name, taken);
      error.textContent = `"${name}" already exists.`;
      fixBtn.textContent = `Use "${suggestion}"`;
      fixBtn.dataset.suggestion = suggestion;
      fixBtn.style.display = '';
      return false;
    }
    error.textContent = '';
    fixBtn.style.display = 'none';
    return true;
  }

  fixBtn.addEventListener('click', () => {
    const s = fixBtn.dataset.suggestion;
    if (!s) return;
    input.value = s;
    validate();
    input.focus();
  });

  input.addEventListener('input', () => validate());
  validate();

  function close(): void {
    overlay.remove();
  }

  function commit(): void {
    if (!validate()) return;
    const name = input.value.trim();
    close();
    // A rename to the identical name is dropped here rather than pushed through the five name-keyed owners
    // for no reason — releasing and re-acquiring a slot to arrive at the same key is pure risk.
    if (name !== currentName) onConfirm(name);
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  confirmBtn.addEventListener('click', commit);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') close();
  });

  requestAnimationFrame(() => { input.focus(); input.select(); });
}

/**
 * Import a preset from a JSON file, after a name dialog that REJECTS a name already in the library.
 *
 * ⚠️ **`existingNames` is a GETTER, not an array, and that signature is the fix for a reported bug**
 * (2026-08-20): exporting a preset and importing it twice under the same name was accepted, producing two
 * tiles with one name — and only the second one animated.
 *
 * Why an array could not work here. Both callers held their own copy of the name list (the D4 split in
 * `main.ts`, which exists so `prependPreset`'s `unshift` cannot corrupt a shared array), and the Lab's copy
 * is never mutated or re-read: it is a snapshot from panel construction. So the FIRST import validated
 * against a list that had 177 entries, and the second validated against the same 177 — the name added
 * moments earlier was invisible to it. `PresetManager` knew; the dialog did not. Taking a getter makes the
 * list impossible to capture stale, because there is nothing to capture.
 *
 * The duplicate mattered far beyond a repeated label, which is why this is the load-bearing half of the fix:
 * `PresetManager.library`, `PreviewGridPanel.tileElements`/`tileCanvases` and `GridTileRenderer.activeSlots`
 * are ALL keyed by preset name. So `importSingle` overwrote the first preset's library entry, and
 * `acquireSlot` returned early on `activeSlots.has(name)` for the second tile — one slot, one generator, two
 * canvases, and the tile that owned the slot kept the animation. The frozen tile was not a rendering fault;
 * it was two tiles claiming one identity.
 */
export function importPresetWithDialog(
  existingNames: () => string[],
  onConfirm: (name: string, preset: UnifiedPreset) => void,
  onConfirmBundle?: (entries: { name: string; preset: UnifiedPreset }[]) => void,
): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let raw: unknown;
      try {
        // ⚠️ **STRIP FIRST, so a deployment file imports as readily as a plain-JSON one.** `Export All`
        // now writes `g_psss_presets={…}` so its output is a drop-in replacement for the deployment file
        // (see `presets/deployment-format.ts`), and this is the half of that change that keeps Import
        // able to read what Export writes. A file that never had the assignment is unaffected.
        raw = JSON.parse(stripDeploymentAssignment(reader.result as string));
      } catch {
        alert('Invalid JSON file.');
        return;
      }

      // A multi-preset bundle takes the other path entirely — see `isPresetBundle` for why the test is
      // structural, and why feeding a bundle to the single-preset path used to fail SILENTLY.
      if (isPresetBundle(raw)) {
        importBundleWithDialog(raw, existingNames, onConfirm, onConfirmBundle);
        return;
      }

      // ⚠️ **A REELS file must be REFUSED here, not migrated** (v8 Phase 19). It is an object with
      // `version`/`reels`/`mainReelName` and no preset shape at all, so `MigrationLayer.migrate` does not
      // throw on it — it defaults its way to a complete preset with no waves, which imports as a black tile
      // under the file's name. The user's mistake (wrong button) then looks like a broken export. The test is
      // the reel model's own discriminator, so the two importers agree on what a reels file is by
      // construction rather than by two similar-looking shape tests.
      if (looksLikeReelFile(reader.result as string)) {
        alert('That is a REELS file, not a preset.\n\nUse Import Reels in the Reel tab.');
        return;
      }

      // Derive candidate name: from metadata.name, or filename without extension
      const rawName = (raw as Record<string, unknown>)?.metadata
        ? ((raw as Record<string, unknown>).metadata as Record<string, unknown>)?.name as string | undefined
        : undefined;
      const candidate = rawName || file.name.replace(/\.json$/i, '') || 'Imported Preset';

      let preset: UnifiedPreset;
      try {
        preset = MigrationLayer.migrate(candidate, raw);
      } catch {
        alert('Could not parse preset file.');
        return;
      }

      // A name already in the library is pre-resolved to the next free ` v<n>`, so the dialog opens on a
      // name that is valid and the user can just press Enter. The dialog still REFUSES a duplicate typed by
      // hand — the suffix is a helpful default, not a licence to accept a clashing name.
      const taken = takenSet(existingNames);
      const suggested = taken.has(candidate.toLowerCase())
        ? nextVersionedName(candidate, taken)
        : candidate;

      showImportDialog(suggested, existingNames, (finalName) => {
        preset.metadata.name = finalName;
        onConfirm(finalName, preset);
      });
    };
    reader.readAsText(file);
  });
  fileInput.click();
}

/**
 * Write the reel library to a file (v8 Phase 19).
 *
 * ⚠️ **A SEPARATE FILE AND A SEPARATE BUTTON PAIR, BY THE OWNER'S DECISION** — the phase's stated requirement
 * was that reels ride along with the header's Export/Import, and it was overruled at specification time. The
 * reason is `isPresetBundle`: it is a STRUCTURAL classifier over "every value looks like a preset", and a
 * bundle carrying a reels key alongside 177 presets either breaks that test or forces it to grow a special
 * case — for a file the user meant as presets. Two files with two obvious buttons cannot be misfiled silently;
 * a widened classifier can. ⚠️ **Do not "restore" the original requirement.**
 *
 * ⚠️ **The stem differs from every preset export (`psss_reels`, not the preset name)**, because the two files
 * end up in the same downloads folder and are told apart by nothing else. `downloadJSON` adds the timestamp.
 *
 * ⚠️ **THIS FILE IS NOW A DROP-IN DEPLOYMENT FILE** (owner, 2026-10-10): the stem is the deployment's own
 * name, the timestamp is off, and the text carries the `g_psss_reels=` assignment a `<script>` tag needs.
 * Replacing a deployment's reels is copy-over-and-done.
 *
 * ⚠️ **THIS REVERSED THE PREVIOUS RULE IN THIS COMMENT, which said "do not fix this by writing the prefix
 * here" on the grounds that `Import` would then need a second dialect.** That objection was discharged, not
 * overruled: `stripDeploymentAssignment()` now runs on every read path, so the prefixed and plain forms
 * import identically and an older plain-JSON export still loads. **`parseReelFile` was left a bare
 * `JSON.parse`** — the strip happens at the import boundary instead, because `reel-model.ts` is imported
 * under Node by `reelcheck` and deliberately has no imports.
 *
 * ⚠️ **The prefix is OPTIONAL on the dev path and MANDATORY in the deployment** — `main.ts`'s dev branch
 * `fetch`es the file and strips the prefix only if it is there, so a prefix-less file dropped into `public/`
 * works under `npm run dev` and then, in `dist/`, is parsed as a bare block, raises a console `SyntaxError`,
 * leaves `g_psss_reels` undefined and makes the engine report the file as MISSING. That asymmetry is why the
 * exporter writes the prefix rather than leaving it to be added by hand.
 */
export function exportReelsJSON(json: string): void {
  // The reel half of the same change — `psss_reels.json` carrying `g_psss_reels={…}`, drop-in.
  downloadJSON('psss_reels', writeDeploymentFile('reels', json), false);
}

/**
 * Read a reels file and hand its contents to `onFile`.
 *
 * ⚠️ **Every rejection path says what the file WAS**, never just "invalid". The two importers accept
 * different files from the same folder, so "invalid file" is the one message that leaves the user unable to
 * tell a mistake from a bug. A preset bundle is named as such (via `isPresetBundle`, the preset side's own
 * classifier, so the two agree), and so is a single preset.
 *
 * ⚠️ **An empty-but-valid reels file is NOT an error and must reach `onFile`** — importing a file the user
 * emptied on purpose has to be distinguishable from importing a file that could not be read. `parseReelFile`
 * returns `null` only for "not a reels file"; a zero-length `reels` array parses fine.
 */
export function importReelsWithDialog(onFile: (parsed: ParsedReelFile) => void): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Stripped at this boundary rather than inside `parseReelFile`, which stays a bare `JSON.parse`
      // on purpose: `reel-model.ts` is imported under Node by `reelcheck` and has no imports of its own.
      const text = stripDeploymentAssignment(reader.result as string);
      const parsed = parseReelFile(text);
      if (!parsed) {
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          alert('Invalid JSON file.');
          return;
        }
        if (isPresetBundle(raw)) {
          alert('That is a PRESET BUNDLE, not a reels file.\n\nUse Import at the top of the Lab.');
        } else if (typeof raw === 'object' && raw !== null && 'metadata' in raw) {
          alert('That is a single PRESET, not a reels file.\n\nUse Import at the top of the Lab.');
        } else {
          alert('That file is not a reels file — it has no reel list.');
        }
        return;
      }
      onFile(parsed);
    };
    reader.readAsText(file);
  });
  fileInput.click();
}

/**
 * Restore a multi-preset bundle: migrate every entry, then let the user decide what to do about the names
 * already in the library.
 *
 * ⚠️ **A duplicate name cannot simply be allowed through, and that is not a cosmetic concern.** A preset
 * name is the primary key of four maps (`PresetManager.library`, the grid's `tileElements`/`tileCanvases`,
 * `GridTileRenderer.activeSlots`), and `acquireSlot` returns early on `activeSlots.has(name)` — so two
 * entries under one name means one gets no slot and freezes on its last painted frame, which reads as a
 * *rendering* bug. The single-preset dialog refuses a duplicate outright; a bundle of 177 cannot, so it
 * offers the two safe resolutions instead (skip, or suffix) and never silently overwrites.
 *
 * ⚠️ **The existing-name test is CASE-INSENSITIVE**, matching `showImportDialog`, because the maps
 * downstream are not: `activeSlots` would treat `cosmos` and `Cosmos` as two slots while a user reads them
 * as one name.
 *
 * ⚠️ **`existingNames` is re-read per candidate while suffixing**, never snapshotted — the names this call
 * is itself adding have to be visible to the next candidate, or a bundle containing both `X` and
 * `X (imported)` could still produce a collision.
 *
 * ⚠️ **`onConfirmBundle` is REQUIRED for a large bundle and is not an optimisation.** The single-preset
 * `onConfirm` does a full generator/renderer/TransMap re-init, a `prependPreset` and a navigation per call —
 * correct for one preset, but 177 of them in a synchronous loop is 177 re-inits, 177 tile prepends and 177
 * navigations, which locks the frame loop and thrashes `GridTileRenderer`'s slots. The batch callback adds
 * every preset to `PresetManager` first and refreshes the UI ONCE. The per-preset path is kept as the
 * fallback so a caller that has not been taught about bundles still behaves correctly, just slowly.
 */
function importBundleWithDialog(
  bundle: Record<string, unknown>,
  existingNames: () => string[],
  onConfirm: (name: string, preset: UnifiedPreset) => void,
  onConfirmBundle?: (entries: { name: string; preset: UnifiedPreset }[]) => void,
): void {
  const entries: { name: string; preset: UnifiedPreset }[] = [];
  const failed: string[] = [];
  for (const [name, raw] of Object.entries(bundle)) {
    try {
      entries.push({ name, preset: MigrationLayer.migrate(name, raw) });
    } catch {
      failed.push(name);
    }
  }
  if (entries.length === 0) {
    alert('No readable presets in this file.');
    return;
  }

  const taken = takenSet(existingNames);
  const clashing = entries.filter((e) => taken.has(e.name.toLowerCase()));

  showBundleDialog(entries.length, clashing.length, failed.length, (mode) => {
    // Resolve every final name FIRST, against a live set this loop keeps up to date itself. The set is
    // seeded from `existingNames()` and then extended locally, because in the batch path nothing has been
    // handed to `PresetManager` yet — so the getter alone would not see the names decided a moment ago.
    const live = takenSet(existingNames);
    const resolved: { name: string; preset: UnifiedPreset }[] = [];
    let skipped = 0;
    let renamed = 0;
    for (const { name, preset } of entries) {
      let finalName = name;
      if (live.has(finalName.toLowerCase())) {
        if (mode === 'skip') { skipped++; continue; }
        finalName = nextVersionedName(name, live);
        renamed++;
      }
      live.add(finalName.toLowerCase());
      preset.metadata.name = finalName;
      resolved.push({ name: finalName, preset });
    }

    if (onConfirmBundle) {
      onConfirmBundle(resolved);
    } else {
      for (const { name, preset } of resolved) onConfirm(name, preset);
    }

    const parts = [`${resolved.length} preset${resolved.length === 1 ? '' : 's'} imported`];
    if (renamed) parts.push(`${renamed} version-suffixed`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (failed.length) parts.push(`${failed.length} unreadable`);
    console.debug(`Bundle import: ${parts.join(', ')}.`);
  });
}

/**
 * The bundle summary modal. Shares the single-preset dialog's markup idiom (inline `cssText`, detached
 * overlay, Escape/backdrop to cancel) rather than abstracting a component out of two callers — see the
 * note on `showImportDialog` about triage I7.
 */
function showBundleDialog(
  total: number,
  clashing: number,
  unreadable: number,
  onConfirm: (mode: 'skip' | 'suffix') => void,
): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;z-index:9999;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background:#1a1a2e;border:1px solid #3a3a5a;border-radius:8px;
    padding:24px;width:400px;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.6);
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-size:15px;font-weight:600;color:#fff;margin-bottom:14px;';
  title.textContent = 'Import Preset Bundle';
  dialog.appendChild(title);

  const body = document.createElement('div');
  body.style.cssText = 'font-size:12px;color:#bbb;line-height:1.6;margin-bottom:16px;';
  const lines = [`<b style="color:#e0e0e0">${total}</b> preset${total === 1 ? '' : 's'} in this file.`];
  if (clashing > 0) {
    lines.push(`<b style="color:#e0c070">${clashing}</b> name${clashing === 1 ? '' : 's'} already in the library.`);
    lines.push('<span style="color:#999">Importing all gives those the next free <b>&nbsp;v2</b>, <b>v3</b>, … suffix.</span>');
  } else {
    lines.push('No name conflicts.');
  }
  if (unreadable > 0) {
    lines.push(`<span style="color:#e07070">${unreadable} entr${unreadable === 1 ? 'y' : 'ies'} could not be read and will be skipped.</span>`);
  }
  body.innerHTML = lines.join('<br>');
  dialog.appendChild(body);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.title = DIALOG_TIPS['bundle.cancel']!;
  cancelBtn.style.cssText = `
    padding:6px 14px;border:1px solid #3a3a5a;border-radius:4px;
    background:#2a2a4a;color:#ccc;cursor:pointer;font-size:12px;
  `;
  btnRow.appendChild(cancelBtn);

  /**
   * ⚠️ Unbinds the `document` listener as well as removing the overlay. There is no `'remove'` DOM event to
   * hang that on — `Element.remove()` fires nothing — so a listener bound to `document` has to be dropped
   * here, on every exit path, or it survives the dialog for the rest of the session (invariant 15's shape:
   * a subscription must die with the thing that made it).
   */
  function close(): void {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  // With no conflicts the two modes are identical, so only one button is offered — an "Import as (imported)"
  // button that can never rename anything is invariant 13's shape in miniature.
  if (clashing > 0) {
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip existing';
    skipBtn.title = DIALOG_TIPS['bundle.skip']!;
    skipBtn.style.cssText = `
      padding:6px 14px;border:1px solid #3a3a5a;border-radius:4px;
      background:#2a2a4a;color:#ddd;cursor:pointer;font-size:12px;
    `;
    skipBtn.addEventListener('click', () => { close(); onConfirm('skip'); });
    btnRow.appendChild(skipBtn);
  }

  const addBtn = document.createElement('button');
  addBtn.textContent = clashing > 0 ? 'Import all, version clashes' : 'Import all';
  // Two texts for one button, because with no clashes it cannot rename anything and saying it would suffix
  // names describes a pass that never runs — invariant 25's shape at the scale of one tooltip.
  addBtn.title = clashing > 0 ? DIALOG_TIPS['bundle.allSuffix']! : DIALOG_TIPS['bundle.all']!;
  addBtn.style.cssText = `
    padding:6px 14px;border:none;border-radius:4px;
    background:#7ec8e3;color:#111;font-weight:600;cursor:pointer;font-size:12px;
  `;
  addBtn.addEventListener('click', () => { close(); onConfirm('suffix'); });
  btnRow.appendChild(addBtn);

  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  requestAnimationFrame(() => addBtn.focus());
}

/**
 * The one modal in the engine. Hand-rolled with inline `cssText` deliberately — triage I7 proposed
 * extracting a modal component, and there is no second caller to extract it FOR: `grep` finds exactly one
 * `position:fixed;inset:0` overlay in `src/`. Inline `cssText` is also the house style for built DOM in
 * `visual-fx.ts` and `materials.ts`, so a styled-component layer here would be the odd one out rather
 * than a shared convention. Revisit if a second modal is ever needed.
 */
function showImportDialog(
  initialName: string,
  existingNames: () => string[],
  onConfirm: (name: string) => void,
): void {
  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;z-index:9999;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background:#1a1a2e;border:1px solid #3a3a5a;border-radius:8px;
    padding:24px;width:360px;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.6);
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-size:15px;font-weight:600;color:#fff;margin-bottom:16px;';
  title.textContent = 'Import Preset';
  dialog.appendChild(title);

  const label = document.createElement('label');
  label.style.cssText = 'display:block;font-size:12px;color:#aaa;margin-bottom:6px;';
  label.textContent = 'Preset name';
  label.title = DIALOG_TIPS['import.name']!;
  dialog.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialName;
  input.title = DIALOG_TIPS['import.name']!;
  input.style.cssText = `
    width:100%;box-sizing:border-box;padding:7px 10px;
    background:#2a2a4a;border:1px solid #3a3a5a;border-radius:4px;
    color:#ddd;font-size:13px;outline:none;
  `;
  dialog.appendChild(input);

  const error = document.createElement('div');
  error.style.cssText = 'font-size:11px;color:#e07070;margin-top:5px;min-height:16px;';
  dialog.appendChild(error);

  /** One-click acceptance of the ` v<n>` suggestion. Hidden unless the current name actually clashes. */
  const fixBtn = document.createElement('button');
  fixBtn.type = 'button';
  fixBtn.title = DIALOG_TIPS['import.fix']!;
  fixBtn.style.cssText = `
    display:none;padding:3px 9px;margin-top:2px;border:1px solid #3a3a5a;border-radius:4px;
    background:#2a2a4a;color:#9ad4ea;cursor:pointer;font-size:11px;
  `;
  dialog.appendChild(fixBtn);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:18px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.title = DIALOG_TIPS['import.cancel']!;
  cancelBtn.style.cssText = `
    padding:6px 14px;border:1px solid #3a3a5a;border-radius:4px;
    background:#2a2a4a;color:#ccc;cursor:pointer;font-size:12px;
  `;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Add to presets';
  confirmBtn.title = DIALOG_TIPS['import.confirm']!;
  confirmBtn.style.cssText = `
    padding:6px 14px;border:none;border-radius:4px;
    background:#7ec8e3;color:#111;font-weight:600;cursor:pointer;font-size:12px;
  `;

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  /**
   * ⚠️ Built on EVERY call, not hoisted into a `const` above. The set is the thing that went stale in the
   * reported bug's sibling form: hoisting it here would re-freeze the list at dialog-open time, which is
   * enough for one dialog but silently reintroduces the same class of defect the getter removes.
   *
   * Case-insensitive, because the maps downstream are not: `activeSlots` would treat `cosmos` and `Cosmos`
   * as two slots while a user reads them as one name, so the dialog is the only place that can refuse it.
   */
  function validate(): boolean {
    const name = input.value.trim();
    if (!name) {
      error.textContent = 'Name cannot be empty.';
      fixBtn.style.display = 'none';
      return false;
    }
    if (existingNames().some(n => n.toLowerCase() === name.toLowerCase())) {
      const suggestion = nextVersionedName(name, takenSet(existingNames));
      error.textContent = `"${name}" already exists.`;
      // Offer the versioned name rather than only refusing — same rule the bundle path applies silently.
      fixBtn.textContent = `Use "${suggestion}"`;
      fixBtn.dataset.suggestion = suggestion;
      fixBtn.style.display = '';
      return false;
    }
    error.textContent = '';
    fixBtn.style.display = 'none';
    return true;
  }

  fixBtn.addEventListener('click', () => {
    const s = fixBtn.dataset.suggestion;
    if (!s) return;
    input.value = s;
    validate();
    input.focus();
  });

  input.addEventListener('input', () => validate());
  // Run once so a pre-resolved or pre-clashing initial name is reflected immediately.
  validate();

  function close(): void {
    overlay.remove();
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', () => {
    if (!validate()) return;
    close();
    onConfirm(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { if (!validate()) return; close(); onConfirm(input.value.trim()); }
    if (e.key === 'Escape') close();
  });

  // Focus and select name so user can immediately retype
  requestAnimationFrame(() => { input.focus(); input.select(); });
}
