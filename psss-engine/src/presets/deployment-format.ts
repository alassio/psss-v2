/**
 * The deployment data files' one format rule, and the ONE owner of both halves of it.
 *
 * ⚠️ **`psss_presets.json` AND `psss_reels.json` ARE SCRIPTS, NOT JSON, AND THAT IS NOT NEGOTIABLE.**
 * Each is `g_psss_presets={…}` / `g_psss_reels={…}` and is loaded by a `<script defer>` in the
 * deployment's `index.html`. **Measured 2026-10-10 against the real `dist/` opened as `file://`: both
 * `fetch` and `XMLHttpRequest` fail** — `TypeError: Failed to fetch` and
 * `NetworkError: Failed to load 'file:///…'` — while the `<script>`-assigned global is present. A page
 * opened by double-clicking `index.html` therefore has exactly one way to read a sibling data file, and
 * it is to execute it. Plain JSON cannot be auto-loaded from disk by any browser transport.
 *
 * ⚠️ **SO THE EXPORTS CARRY THE ASSIGNMENT RATHER THAN THE USER ADDING IT** (owner, 2026-10-10). The
 * owner's requirement was that `Export All` and `Export Reels` be **drop-in replacements** for the two
 * deployment files, with no hand-editing. Since the format cannot become JSON, the exporter writes the
 * format instead: `writeDeploymentFile()` below is what both export buttons go through, and both use the
 * deployment's exact filename so the only step left is copying the file over.
 *
 * **This REVERSES the standing "do not write the prefix in the exporter" rule**, whose stated reason was
 * that `Import` would then have to accept a second dialect. That reason is discharged rather than
 * ignored: `stripDeploymentAssignment()` is called on every read path, so **both** dialects import, and
 * an older plain-JSON export keeps working exactly as before.
 *
 * ⚠️ **A single preset export is NOT a deployment file** and is deliberately left alone — plain JSON,
 * with the timestamped filename. Only the two whole-library exports are drop-ins.
 */

/** The global each deployment file assigns. The build spells these in `vite.config.ts` as well. */
export const DEPLOYMENT_GLOBALS = {
  presets: 'g_psss_presets',
  reels: 'g_psss_reels',
} as const;

/**
 * Strip a leading `g_psss_*=` assignment, if there is one, leaving parseable JSON.
 *
 * ⚠️ **ONE PATTERN FOR BOTH GLOBALS, AND IT MUST TOLERATE A FILE THAT NEVER HAD ONE.** Every read path
 * runs this before `JSON.parse`, so a plain-JSON file and a deployment file are the same input as far as
 * importing is concerned. A trailing `;` is dropped too, because a hand-edited file often has one.
 *
 * ⚠️ **ANCHORED, and deliberately narrow.** It matches only `g_psss_` followed by word characters at the
 * very start of the text — not any assignment — so a preset legitimately *named* something with an `=`
 * in it cannot be clipped, and a file whose first bytes are a JSON string is untouched.
 */
export function stripDeploymentAssignment(text: string): string {
  return text
    .replace(/^\s*(?:var\s+|let\s+|const\s+)?g_psss_\w+\s*=\s*/, '')
    .replace(/;\s*$/, '');
}

/**
 * Wrap a JSON payload as the deployment file for `which`.
 *
 * The newline after the assignment is deliberate: it keeps the first line short enough to read in a text
 * editor, which is how anyone checking "did I copy the right file" will look at it.
 */
export function writeDeploymentFile(which: keyof typeof DEPLOYMENT_GLOBALS, json: string): string {
  return `${DEPLOYMENT_GLOBALS[which]}=${json}`;
}
