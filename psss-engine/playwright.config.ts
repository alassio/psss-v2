import { defineConfig, devices } from '@playwright/test';

/*
 * ============================================================================================
 * Phase 17.1 — the browser harness for `TESTPLAN-phase16-composer.md`.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE LIVES AT THE PACKAGE ROOT AND THE SPECS LIVE IN `tests/`, NEVER UNDER `src/` — THAT IS A
 * MEASURED CONSTRAINT, NOT A CONVENTION.** `deadcheck` enumerates its corpus with
 * `git ls-files -co --exclude-standard src`, so a single file added under `src/` moves its reported count. It
 * was measured on 2026-09-09: adding one file took it from **80 to 81**. A `src/__tests__/` layout would
 * therefore break a shipped checker the moment it appeared, and it would fail in the direction that reads like
 * a regression in the engine rather than a naming choice in the harness.
 *
 * ⚠️ **`tsconfig.json` HAS `"include": ["src"]`, SO `tsc --noEmit` DOES NOT SEE THIS FILE OR ANY SPEC.** That
 * is deliberate and it is a REAL LIMIT, stated rather than papered over: a type error in a spec is caught when
 * Playwright transpiles it, not by `npm run verify`. Widening `include` to cover `tests/` would put
 * `@playwright/test`'s types into the engine's own compile, and `noUnusedLocals` /
 * `exactOptionalPropertyTypes` are tuned for `src/` — the engine's compile settings are not the harness's to
 * change.
 */

/**
 * ⚠️ **THE BROWSER IS PINNED, AND LEAVING IT TO THE DEFAULT WAS MEASURED TO BE WRONG IN A WAY THAT WOULD HAVE
 * POISONED EVERY FUTURE PIXEL BASELINE.**
 *
 * Measured 2026-09-09 on the owner's machine, all three via Playwright 1.63:
 *   - `chromium.launch({})`                                  → ANGLE (Google, Vulkan, **SwiftShader**)
 *   - `chromium.launch({ args: ['--disable-gpu', ...] })`    → ANGLE (Google, Vulkan, **SwiftShader**)
 *   - `chromium.launch({ executablePath: <cached 1234> })`   → ANGLE (**AMD Radeon 8060S**, Direct3D11)
 *
 * So the renderer depends on HOW the browser is launched, and the third form silently reached the real GPU.
 * ⚠️ **A pixel baseline recorded against a discrete GPU and compared against SwiftShader is a diff nobody can
 * read** — it is not a small tolerance question, it is a different rasteriser, a different shader compiler and
 * a different set of precision decisions. **`--enable-unsafe-swiftshader` is therefore an ASSERTION about
 * which rasteriser drew the frame, not a fallback for machines without a GPU.**
 *
 * ⚠️ **AND THE ENGINE RUNS THERE AT ALL, WHICH IS THE ONE FACT PHASE 17 RESTS ON.** Headless SwiftShader
 * reports WebGL2 with `EXT_color_buffer_float` and `EXT_float_blend`, `MAX_TEXTURE_SIZE` 8192, and the engine
 * boots and draws `Aurora Borealis` with glow and grading intact — so all 58 shaders compile. ⚠️ **A CLEAN
 * CONSOLE COULD NOT HAVE ESTABLISHED THAT** (`CLAUDE.md`: a failed compile "throws nothing, links, binds and
 * no-ops to black"); only a screenshot could, which is why the probe took one before this file was written.
 */
const SWIFTSHADER_ARGS = [
  '--enable-unsafe-swiftshader',
  // ⚠️ **NOT a performance flag.** The engine's own context asks for `preserveDrawingBuffer: true`
  // (`core/compute-backend.ts`), which is what makes a screenshot of the GL canvas meaningful at all; these
  // two keep the compositor from second-guessing that on a headless surface.
  '--disable-lcd-text',
  '--force-color-profile=srgb',
];

export default defineConfig({
  testDir: './tests',

  /*
   * ⚠️ **`fullyParallel` IS OFF AND `workers` IS 1, AND THIS IS A CORRECTNESS SETTING RATHER THAN A RESOURCE
   * ONE.** Every spec drives ONE shared engine instance through the same singleton UI: a preset load is
   * global, the Lab's tab state is global, and 16.18's bypass flags are engine-side by design (they must hold
   * with the Lab closed). Two workers would interleave preset loads and produce failures that reproduce only
   * under concurrency — the most expensive kind of red herring this project can generate, given that its
   * characteristic defect already reads as *"I changed it and nothing happened."*
   *
   * ⚠️ **SwiftShader is also CPU rasterisation**, so parallel workers would contend for the same cores and
   * make the frame-timing steps flaky for a reason that has nothing to do with the engine.
   */
  fullyParallel: false,
  workers: 1,

  /*
   * ⚠️ **THE DEFAULT 30 s TIMEOUT IS UNUSABLE HERE AND THAT IS A MEASUREMENT, NOT A GUESS — IT WAS THE ENTIRE
   * CAUSE OF PHASE 1'S FIRST THREE RED RUNS, EACH OF WHICH LOOKED LIKE A DIFFERENT DEFECT.** Stage timings for a
   * single preset round-trip under SwiftShader, measured 2026-09-09:
   *
   *   openLab 6.3 s · openComposer 6.3 s · click `Grid` 3.4 s · tiles visible 0.5 s
   *   · scrollIntoView 2.9 s · tile click 3.2 s · reopen Composer 2.2 s   → **~25 s for ONE preset**
   *
   * The cost is located: the grid renders **360 tiles with 360 live canvases**, all rasterised on CPU. A spec
   * that visits four presets — which steps 6–9 do, by design — needs ~100 s.
   *
   * ⚠️ **AND THE FAILURE MODE IS WHAT MAKES THIS WORTH RECORDING RATHER THAN JUST FIXING.** The deadline expiring
   * mid-`await` surfaced as **`Target page, context or browser has been closed`** — which reads exactly like a
   * renderer CRASH. Two sittings' worth of wrong theories followed from it (a second-load crash, then a
   * preset-specific crash); both were falsified by loading each preset in its own test, where all four passed.
   * ⚠️ **`CLAUDE.md`'s rule applies verbatim: *read a failure as a claim about the CHECKER until the checker is
   * exonerated*. Here the instrument's own deadline was impersonating an engine crash.**
   *
   * So: a generous per-test timeout, and specs that visit several presets say so with `test.slow()`. ⚠️ **This is
   * NOT a flakiness sedative — `retries` stays 0.** A timeout must still be able to fail; it just may not fire
   * before the work it is timing could possibly have finished.
   */
  timeout: 180_000,

  /*
   * ⚠️ **`retries: 0` IS DELIBERATE AND IT IS THE PHASE-7 RULE ARRIVING EARLY.** A retry converts a flaky
   * failure into a green run, which is precisely the *"a SKIPPED mutation reads exactly like a caught one"*
   * shape `CLAUDE.md` warns about — and this suite's whole purpose is to be believed. A step that only passes
   * on the second attempt is a finding about the harness (or about a real race in the tab) and must be read,
   * not retried away.
   */
  retries: 0,

  // `forbidOnly` so a stray `test.only` cannot silently reduce the suite to one spec — the same failure class
  // as a checker whose anchor matches nothing: it reports PASS over a corpus of one.
  forbidOnly: !!process.env['CI'],

  /*
   * ⚠️ **THE REPORT AND THE TRACES LIVE OUTSIDE `tests/`, WHICH IS A BACKUP CONSTRAINT RATHER THAN A TIDINESS
   * ONE.** `psss-engine/` is UNTRACKED, so file-copy backups are the only safety net and `psss-engine/tests/` is
   * a backup ITEM — it must stay copyable as a unit of SOURCE. A 516 KB HTML report and a trace zip per failure
   * inside it would put run artefacts into every future copy, and `CLAUDE.md` is explicit that **a copy exists to
   * be restored**: restoring a stale report alongside the specs is restoring a claim about a run that did not
   * happen. Both directories are git-ignored and neither is an item.
   */
  reporter: [['list'], ['html', { outputFolder: '.playwright/report', open: 'never' }]],
  outputDir: '.playwright/results',

  /*
   * ⚠️ **THE DEV SERVER IS A FIXTURE, NOT A PRECONDITION IN A README.** `reuseExistingServer` is on so a
   * sitting that already has `npm run dev` up does not fight it — but note the port: vite falls back to 5174
   * when 5173 is taken, which is exactly what happened during the 2026-09-09 probe. Pinning `strictPort`
   * makes the harness fail loudly on a port clash instead of silently testing whatever else is on 5173.
   */
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  use: {
    baseURL: 'http://localhost:5173/',

    /*
     * ⚠️ **A FIXED VIEWPORT IS LOAD-BEARING FOR THIS ENGINE SPECIFICALLY, NOT JUST FOR SCREENSHOT STABILITY.**
     * `CLAUDE.md` invariant 26: an image-domain operator must measure length on one shared scale
     * (`min(w,h)`), and invariant 27 records that *"a preset cannot compensate for a canvas-dependent error."*
     * So canvas SIZE is an input to the thing under test. Resizing the viewport between runs would change the
     * subject, not merely the framing — and the diagram's own thumbnails are asserted at "the size they are
     * actually drawn" (§O, step 98–102).
     */
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,

    // Traces and screenshots only on failure: a passing run should leave nothing behind to interpret.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'composer',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
        launchOptions: { args: SWIFTSHADER_ARGS },
        /*
         * ⚠️ **THE VIEWPORT IS RE-PINNED *AFTER* THE SPREAD, AND OMITTING IT WAS A REAL HARNESS DEFECT THAT RAN
         * GREEN FOR TWO PHASES — MEASURED 2026-09-09, PHASE 17.5.** `devices['Desktop Chrome']` CARRIES ITS OWN
         * `viewport: { width: 1280, height: 720 }`, and a **project's** `use` beats the top-level `use` — so the
         * `1600 × 900` pin above was silently overridden and the whole suite ran at **1280 × 720, canvas
         * 640 × 720.** ⚠️ **THE `viewport` KEY MUST STAY BELOW THE SPREAD; MOVING IT ABOVE RESTORES THE DEFECT
         * WHILE LOOKING IDENTICAL.**
         *
         * ⚠️ **AND IT FAILED IN THE SILENT DIRECTION, WHICH IS WHY IT SURVIVED: the top-level comment explains why
         * the pin is load-bearing, `03-testhook-channel.spec.ts` §17.2i asserts the canvas rather than the window
         * *exactly to keep this honest* — and its clause is `> 0`, which 640 × 720 satisfies.** The one reading
         * that would have caught it, the measured `800 × 900`, came from a hand-run probe launched WITHOUT this
         * config, so it described a configuration the suite never actually ran. ⚠️ **`CLAUDE.md`'s "THE CANVAS IS
         * 800 × 900" is therefore a claim about that probe: with this line present the suite now agrees with it,
         * and it is asserted below rather than believed.**
         *
         * ⚠️ **NO PIXEL BASELINE IS INVALIDATED, WHICH IS LUCK AND NOT DESIGN** — Phase 4 deliberately committed no
         * `toHaveScreenshot` PNGs (`07-diagram-panes.spec.ts` measures pane geometry and colour instead), so
         * nothing on disk was captured at the wrong size. **Had it committed baselines, every one would have been
         * void and green.**
         *
         * ⚠️ **`deviceScaleFactor` IS RE-PINNED FOR THE SAME REASON AND ONLY BECAME LOAD-BEARING ON 2026-09-25.**
         * Until that date the renderer sized its backing store from the CSS box alone, so the device ratio could
         * not reach the canvas and pinning it here would have been decoration. `resolveRenderSize()` now reads
         * `readDevicePixelRatio()` and resolves `backing = floor(CSS × DPR × min(scale, 1) / 2) × 2` under
         * `RENDER_PIXEL_BUDGET` — so the ratio is an INPUT to the `800 × 900` that §17.2i asserts exactly, and a
         * project-level `2` would resolve the canvas to **1332 × 1498** (1600 × 1800 device px is 2.88 Mpx, above
         * the ~2 Mpx budget, so the scale would bind at 0.833 where at DPR 1 it does not bind at all). ⚠️ **This
         * changes nothing today and that is the point**: `devices['Desktop Chrome']` also carries `1`, so the
         * suite was protected by a value inside Playwright's device table rather than by anything in this repo —
         * exactly the shape of the defect above, one door further along. Re-pinning makes the protection local.
         * **`03-testhook-channel.spec.ts` §17.2i names both owners in its clause**; if that assertion ever fails,
         * read THIS key before believing the viewport moved.
         */
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],

  /*
   * ⚠️ **PIXEL TOLERANCE IS SET HERE AND IS NOT ZERO, WHICH NEEDS ITS REASON RECORDED BECAUSE THE PROBE
   * MEASURED BYTE-IDENTICAL FRAMES AND THAT IS A NARROWER RESULT THAN IT LOOKS.** Two independent headless
   * launches produced `md5`-equal PNGs of the boot frame — so the STATIC first frame is reproducible. It does
   * not follow that a STEPPED frame is: `dt` is wall-clock (`main.ts:2230`, `time - lastTime`), so the number
   * of integration steps between load and screenshot depends on machine speed, and `lissajous.ts:1282` calls
   * `Math.random()` (gated on `sparkConfig.enabled`) when sparks are live.
   *
   * ⚠️ **SO: byte-equality for a boot frame, tolerance for anything animated — and a spec must say which it is
   * relying on.** `maxDiffPixelRatio` here is the floor for the deterministic 2D diagram canvases that
   * Phase 4 will compare; Phase 5's GL comparisons will state their own, larger, per-assertion tolerance.
   */
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' },
  },
});
