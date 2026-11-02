import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * ============================================================================================
 * TWO ARTEFACTS FROM ONE SOURCE TREE.
 * ============================================================================================
 *
 *   `npm run dev`   → the Vite dev server, unchanged: ES modules, HMR, `public/` served, the preset
 *                     library FETCHED from `public/psss_presets.json` and composed with the built-in
 *                     TS groups.
 *   `npm run build` → FOUR files in `dist/` that open by double-click from disk, with no server:
 *                     `index.html` + `psss-engine.js` + `psss_presets.json` + `psss_reels.json`. The legacy
 *                     engine's shape (`psss-original/`) plus the reel library, which v8 Phase 19.11
 *                     externalised on the same principle as the presets.
 *
 * ⚠️ **THE FOURTH FILE IS OPTIONAL AT RUNTIME AND THE THIRD IS NOT.** `psss_reels.json` missing costs a
 * deployment its own reels only — the three built-in reels travel inside the bundle — while
 * `psss_presets.json` missing costs it every preset and throws. Do not make the two symmetric in either
 * direction: a throw over the reel file turns a working page into a broken one, and a silent fallback for
 * the preset file hides a missing file behind an empty grid.
 *
 * ⚠️ **THIS BUILD EMPTIES `dist/`, WHICH DELETES `dist/screensaver/` — AND THAT IS A PROPERTY THIS FILE OWNS,
 * NOT A BUG TO FIX.** `npm run build:all` assembles the screensaver set (`psss.scr` + both data files) into
 * `dist/screensaver/`; a subsequent web-only `npm run build` removes it, so **a `.scr` can never outlive the
 * engine embedded in it** — the exact stale artefact `scripts/build-screensaver.mjs` exists to prevent. Two
 * traps follow from it. `emptyOutDir` is NOT set below: it is Vite's default (true whenever `outDir` is inside
 * the project root), so the behaviour is invisible in the `build` block and setting it `false` to "preserve"
 * the screensaver would resurrect the defect while also leaving orphaned bundles from earlier builds. And
 * nothing here or in `scripts/export-library.mjs` asserts a `dist/` LISTING — the "exactly four files" claim
 * lives in prose only — which is **why an assembled `dist/screensaver/` cannot break the web build**, and is
 * the premise to re-check before adding any such assertion.
 *
 * ⚠️ **EVERY SETTING IN THE `build` BLOCK BELOW EXISTS BECAUSE THE DEFAULT BREAKS `file://`, AND EACH
 * BREAKS IT SILENTLY IN A DIFFERENT WAY.** Do not "simplify" one back to its default without opening the
 * result from disk — `vite build` succeeds either way and the failure is a blank page:
 *
 *   `base: './'`            absolute URLs (`/psss-engine.js`) resolve to the FILESYSTEM ROOT under `file://`.
 *   `format: 'iife'`        ES modules are blocked under the file scheme outright (opaque origin, CORS).
 *   `inlineDynamicImports`  required by `iife`, and it is what folds the dev branch's `import()` back in.
 *                           ⚠️ **Vite 8 prints `inlineDynamicImports option is ignored because
 *                           codeSplitting: false is set` and folds the imports anyway** — the `iife` format
 *                           implies no code splitting, so the option is now redundant rather than wrong.
 *                           Measured 2026-09-24: one chunk emitted, `psss-engine.js`. **Left in place
 *                           deliberately: it states the requirement for any reader who changes `format`,
 *                           and removing it to silence a warning would make the fold depend on an implication.**
 *   `cssCodeSplit: false`   one stylesheet, so the packer below has exactly one file to inline.
 *   `copyPublicDir: false`  `public/` also holds `icons.svg` (referenced NOWHERE) and the 939 KB
 *                           `legacy_presets_original_177.json` reference dump; neither belongs in a
 *                           deployment, and the two files that do are written by `scripts/export-library.mjs`.
 *   `modulePreload: false`  a `<link rel="modulepreload">` is dead weight with no module graph.
 *
 * ⚠️ **`__PSSS_STANDALONE__` IS A BUILD-TIME LITERAL, NOT A RUNTIME FLAG** (declared in `main.ts`). It is
 * `true` only here, in `command === 'build'`, which is what eliminates the dev library branch from the
 * deployment bundle and with it all seven preset modules. A runtime flag would keep both paths in the
 * bundle and let a deployment silently fall back to built-in presets.
 */
const ENTRY_JS = 'psss-engine.js';
const ENTRY_CSS = 'psss-engine.css';
const PRESET_FILE = 'psss_presets.json';
/**
 * ⚠️ **SPELLED HERE AND IN `src/presets/reel-store.ts` (`REEL_DEPLOYMENT_FILE`), WITH NO COMPILER BETWEEN THE
 * TWO.** Importing that module here would drag the whole UI import graph into Vite's config resolution, so the
 * literal is repeated — and `scripts/export-library.mjs` closes the gap from the other end by asserting that
 * the `index.html` in `dist/` references the reel file it just wrote. A rename on one side alone therefore
 * fails the BUILD; without that assertion it ships a deployment that quietly plays the built-in reels.
 */
const REELS_FILE = 'psss_reels.json';

/**
 * Rewrites the emitted `index.html` into the deployable shape.
 *
 * ⚠️ **VITE'S HTML TRANSFORM ASSUMES AN ES-MODULE ENTRY AND STAMPS `type="module" crossorigin` ON THE TAG
 * REGARDLESS OF `output.format`.** Both attributes are fatal under `file://`, so the four tags are owned
 * here rather than fought upstream. Every step ASSERTS — an unmatched pattern throws and fails the build,
 * because the alternative is a `dist/` that looks complete and renders nothing.
 *
 * ⚠️ **`closeBundle` ALSO RUNS WHEN THE BUILD FAILED, AND A GUARD THAT THROWS THERE DESTROYS THE REAL ERROR.**
 * Measured 2026-09-24 with a probe plugin that threw in `renderStart`: the probe's message appeared NOWHERE in
 * the output — Vite reported `pack-standalone: …\dist\index.html was not emitted` and nothing else, because this
 * hook's throw replaced the failure being handled. Every upstream failure therefore arrived wearing the same
 * false diagnosis ("Vite emitted no HTML"), which sent one real red (2026-09-23) after a `dist/`-emptying
 * theory that was never the cause. Hence `sawOutput`: **`writeBundle` is the only evidence the generate phase
 * completed, and the emission guards below are meaningful ONLY after it ran.** Two rules follow.
 * **Do not re-collapse the two cases** — the assertions must stay unconditional once output exists (that is the
 * whole point of them), and they must not run at all when none does. And **do not re-raise the skip into a
 * throw**: staying silent is what lets the true error reach the console, and the skip cannot go unnoticed in a
 * SUCCEEDING build because the unpacked `index.html` still carries its module tag and no reel script, which
 * `scripts/export-library.mjs` then rejects. Detecting the failure by hooking `buildEnd(error)`/`renderError`
 * was rejected: a hook rolldown does not call fails silently, whereas a missing `writeBundle` fails loudly.
 */
function packStandalone(): Plugin {
  let config: ResolvedConfig;
  let sawOutput = false;
  return {
    name: 'psss-pack-standalone',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) { config = resolved; },
    writeBundle() { sawOutput = true; },
    closeBundle() {
      if (!sawOutput) {
        console.warn('[pack-standalone] skipped: the build wrote no output, so there is nothing to pack — '
          + 'the real failure is the error reported by the build itself, not a missing index.html');
        return;
      }
      const outDir = resolve(config.root, config.build.outDir);
      const htmlPath = resolve(outDir, 'index.html');
      const cssPath = resolve(outDir, ENTRY_CSS);
      if (!existsSync(htmlPath)) throw new Error(`pack-standalone: ${htmlPath} was not emitted`);
      let html = readFileSync(htmlPath, 'utf8');

      // The stylesheet becomes an inline <style> IN PLACE, so it stays in <head> ahead of the body.
      const linkRe = new RegExp(`[ \\t]*<link\\b[^>]*href="[^"]*${ENTRY_CSS}"[^>]*>\\r?\\n?`);
      if (!existsSync(cssPath)) throw new Error(`pack-standalone: ${ENTRY_CSS} was not emitted — is cssCodeSplit still false?`);
      if (!linkRe.test(html)) throw new Error(`pack-standalone: no <link> to ${ENTRY_CSS} in index.html`);
      const css = readFileSync(cssPath, 'utf8');
      html = html.replace(linkRe, `    <style>\n${css}\n    </style>\n`);
      rmSync(cssPath);

      // ⚠️ **`defer` ON ALL THREE, AND THE DATA FILES BEFORE THE ENGINE.** `main.ts` ends in a top-level
      // `init()` that reads `getElementById('canvas')`, so a classic script must not run before the DOM —
      // `defer` restores the module tag's timing. `defer` also guarantees execution ORDER, which is what lets
      // the engine read `g_psss_presets` and `g_psss_reels` synchronously instead of racing the files it
      // depends on. ⚠️ **A missing reel file leaves `g_psss_reels` UNDEFINED, which is a supported state** —
      // the engine warns and plays the built-ins — so the tag may be emitted unconditionally, and a browser's
      // console 404 on it is the intended report rather than a build defect.
      // ⚠️ **THE TWO GLOBAL NAMES ARE OWNED BY `src/presets/deployment-format.ts`** (`DEPLOYMENT_GLOBALS`),
      // which is also what the browser's `Export All` / `Export Reels` write since 2026-10-10 so that an
      // export is a drop-in replacement. They are spelled again HERE and in `scripts/export-library.mjs`,
      // with no compiler between the three copies — the same unenforced gap as the FILENAMES two lines up.
      const scriptRe = new RegExp(`[ \\t]*<script\\b[^>]*src="[^"]*${ENTRY_JS}"[^>]*></script>`);
      if (!scriptRe.test(html)) throw new Error(`pack-standalone: no <script> to ${ENTRY_JS} in index.html`);
      html = html.replace(scriptRe, [
        `    <!-- The preset library and the reel library, external and editable BY DESIGN: one file each,`,
        `         loaded as scripts because \`fetch\` cannot read a sibling file under \`file://\`.`,
        `         Both written by scripts/export-library.mjs. -->`,
        `    <script defer src="./${PRESET_FILE}"></script>`,
        `    <script defer src="./${REELS_FILE}"></script>`,
        `    <script defer src="./${ENTRY_JS}"></script>`,
      ].join('\n'));

      // What must NOT survive into the deployment. Each of these renders a blank page from disk.
      for (const [pattern, why] of [
        ['type="module"', 'ES modules are blocked under file://'],
        ['crossorigin', 'a CORS attribute on a file:// request fails the fetch'],
        ['src="/', 'an absolute path resolves to the filesystem root'],
        ['href="/', 'an absolute path resolves to the filesystem root'],
        ['modulepreload', 'no module graph exists in an iife bundle'],
      ] as const) {
        if (html.includes(pattern)) throw new Error(`pack-standalone: '${pattern}' survived into index.html — ${why}`);
      }

      writeFileSync(htmlPath, html, 'utf8');
      console.log(`[pack-standalone] ${htmlPath} — CSS inlined (${css.length} bytes), ${PRESET_FILE} + ${REELS_FILE} + ${ENTRY_JS} deferred`);
    },
  };
}

export default defineConfig(({ command }) => ({
  // Relative, so every URL in the emitted HTML works from a directory opened as a file.
  base: './',
  define: {
    __PSSS_STANDALONE__: JSON.stringify(command === 'build'),
  },
  plugins: [packStandalone()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: 'es2022',
    assetsDir: '.',
    cssCodeSplit: false,
    modulePreload: false,
    copyPublicDir: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: ENTRY_JS,
        assetFileNames: 'psss-engine.[ext]',
      },
    },
  },
}));
