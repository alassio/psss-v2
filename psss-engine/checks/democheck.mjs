/*
 * `democheck.mjs` — **does each demo preset actually SHOW the operator it exists to demonstrate?**
 *
 * ⚠️ **IT EXISTS BECAUSE I CONFIRMED THREE DEMOS ON HOSTS INCAPABLE OF SHOWING THEIR OWN OPERATOR, AND THE
 * OWNER FOUND ALL THREE IN USE (2026-10-22).** A winding of 105 averaged the sample bias away; a material
 * splat filled the gaps that operator opens; a rotating figure swamped the conformal centre. **In every
 * case `verify` was green, `deformcheck` was green, and the engine was correct** — the DEMO was the defect,
 * and no clause in the tree could see it because none of them compared a demo with its parent.
 *
 * ⚠️ **OUTSIDE `verify`, ON PURPOSE, AND THE REASON IS THE INSTRUMENT RATHER THAN THE COST.** This needs a
 * browser: only a RENDERED FRAME answers *does this look different*. `verify` is the engine's gate and must
 * stay runnable without Chromium, so this joins `publishcheck` as a gate you run deliberately —
 * `npm run check:demos`, against a dev server on port 5190.
 *
 * ⚠️⚠️ **THE NOISE FLOOR IS MEASURED, NOT ASSUMED, AND THAT IS THE WHOLE DESIGN.** Several hosts animate:
 * `Cylinder` rotates at 3 deg/s and changes by 22.6 fingerprint units in three seconds with nothing
 * touched, which is nearly as much as a deliberate control move produced (26.9). **So "the demo differs
 * from its parent" is meaningless until you know how much the parent differs from ITSELF.** Each pair is
 * therefore measured three times: parent at t, parent at t+Δ, demo at t+Δ. The demo must beat the parent's
 * own drift by a stated margin, and a pair that cannot is reported as UNJUDGEABLE rather than as a pass —
 * because an operator whose effect is inside the pose noise cannot be judged on that host at all.
 *
 * ⚠️⚠️ **TWO MEASURED LIMITS OF THIS FILE, BOTH FOUND 2026-10-23 AND NEITHER FIXED HERE — `31.D7` keeps it
 * a SMOKE TEST and re-engineering it is the owner's call. Read a red below against both.**
 *
 * **1. THE POSE-INVARIANT FINGERPRINT IS STRUCTURALLY BLIND TO A ROTATION, WHICH IS WHAT IT WAS CHOSEN
 * FOR.** The note below says a histogram is right because *rotating a figure moves light around without
 * changing how much of it is at each brightness* — and `31.4`'s 4D rotation IS a rotation. Measured on
 * `Quader Hyperspin` against its parent, both fingerprints in one run:
 *
 *     histogram  (POSE-INVARIANT) : drift 13.0   effect 25.1   = 1.93x
 *     12x12 grid (POSE-SENSITIVE) : drift  399   effect 1616   = 4.05x
 *     lit coverage 22.2 % -> 35.9 %      mean luminance 11.7 -> 16.3
 *
 * **The demo is plainly different — it lights 62 % more of the frame — and the histogram cannot see it.**
 * The right instrument depends on what the operator does, and this file has one.
 *
 * **2. THE NOISE FLOOR ITSELF IS NOISY: the same host measured 5.2, 13.0 and 19.6 drift units in three
 * readings.** So a ratio near the margin is not a verdict. `Quader Hyperspin` scored **0.91x** in one run
 * and **1.93x** in the next, with nothing changed — a 2x swing in the number the pass/fail turns on.
 *
 * ⚠️ **Together these mean a red here is a QUESTION and never a conclusion**, which is what *smoke test,
 * not a gate* has to mean in practice. The three reds this file currently reports are, in order: two
 * Phase 30 demos on a host that self-drifts 372.8 px (`Pipes` — left alone, because re-hosting a shipped
 * preset is retuning the library and that is the owner's call), and one 4D rotation the fingerprint cannot
 * see.
 */
import { chromium } from 'playwright';

const URL = process.env.DEMO_URL ?? 'http://localhost:5190/';
const BINS = 24;        // luminance histogram bins — pose-invariant, density-sensitive
const SETTLE = 5000;    // ms after a preset click before the first read
const DRIFT = 3000;     // ms between the two same-setting reads — the noise-floor window
const MARGIN = 1.6;     // the demo must differ from its parent by this multiple of the parent's own drift

/** demo -> parent, and the operator each exists to show. */
const PAIRS = [
  ['Pipes Twist', 'Pipes', 'E129a twist'],
  /*
   * ⚠️⚠️ **THE `Pipes Chambers` ROW WENT WITH ITS PRESET ON 2026-11-01 (owner): the box-fold-ALONE demo was
   * deleted and `Pipes Wound Chambers` kept instead, so the row below is now the library's ONLY box-fold
   * demo and its label is the whole of that coverage.** The row was NOT re-pointed at Wound Chambers —
   * that preset already has its own row four lines down, and two rows on one preset would double-count a
   * single measurement rather than cover two operators. ⚠️ **`boxFoldScale` now has no carrier at all**
   * (Chambers authored it, at its identity `1`), so no demo exercises that field.
   */
  ['Cylinder Conformal', 'Cylinder', 'E125 conformal, power'],
  ['Pipes Droste', 'Pipes', 'E125 conformal, log-polar'],
  ['Pipes Timescan', 'Pipes', 'E126 time warp, coordinate'],
  ['Pipes Wound Chambers', 'Pipes', 'E130 + E129a combined'],
  /*
   * v8 31.6. ⚠️⚠️ **BOTH ON `Quader`, AND THAT IS WHY THE FIVE ROWS ABOVE READ UNJUDGEABLE.** This file's
   * header says the noise floor must be measured rather than assumed; measured in model space before
   * authoring, **`Pipes` moves 372.8 px per particle against ITSELF over 60 frames** while **`Quader`
   * moves 16.6 px**. So every demo hosted on `Pipes` is being asked to out-shout a host that never stops
   * moving — and the identical 4D setting scores **0.7x on `Pipes` and 13.1x on `Quader`.**
   *
   * ⚠️ **THE FIVE `Pipes` ROWS ARE LEFT ALONE DELIBERATELY: re-hosting a shipped preset is retuning the
   * library, which is the owner's call, and the UNJUDGEABLE verdicts are the honest report until they
   * make it.** What is fixed here is the new work.
   */
  // ⚠️ **EXPECTED TO READ UNJUDGEABLE, AND THE HEADER'S LIMIT 1 IS WHY: this file's fingerprint is
  // pose-invariant by design and a 4D rotation is a rotation.** Confirmed in a browser by the
  // pose-SENSITIVE fingerprint at 4.05x, with lit coverage 22.2 % -> 35.9 %. **The row is kept rather
  // than removed: a red that is explained is honest, and deleting it would hide a real limitation of
  // the instrument.**
  ['Quader Hyperspin', 'Quader', 'E132 4D rotation (see header limit 1 — expected UNJUDGEABLE here)'],
  /*
   * ⚠️ **ALSO EXPECTED UNJUDGEABLE, and for a DIFFERENT structural reason than the 4D row above: the
   * per-particle channels never move a particle.** They change size, alpha and lightness, so a
   * fingerprint built to be insensitive to brightness (this file normalises the histogram so "a
   * brightness change alone does not read as a shape change") is insensitive to most of what they do.
   * **The right instrument is the spread of the published multiplier, which `deformcheck` §J measures —
   * 13.1x at amount 0.8 on the `index` driver.** Kept in the list because a red that is explained is
   * honest and a missing row hides a limitation.
   */
  /*
   * ⚠️ **RE-POINTED 2026-11-01 (owner): `Pipes Spread` was merged into `Pipes Taper Bend Spread` with
   * `Pipes Taper` and `Pipes Bend` — the three were ONE LEAF apart.** The row keeps its subject (the
   * per-particle channels) and its *expected unjudgeable* note, but ⚠️ **the host now also carries a taper
   * and a bend, so a RED here can no longer be attributed to the channels alone** — which is the cost of
   * the merge arriving in this instrument, and the reason it is written down here rather than inferred.
   */
  ['Pipes Taper Bend Spread', 'Pipes', 'E112/E113/E137 per-particle channels + E129b taper/bend (expected UNJUDGEABLE — see note)'],
];

let passed = 0, failed = 0;
const chk = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS  ${name}   ${detail}`); }
  else { failed++; console.log(`  FAIL  ${name}   ${detail}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);

/*
 * ⚠️⚠️ **A LUMINANCE HISTOGRAM, NOT A SPATIAL GRID, AND THE FIRST VERSION OF THIS CHECKER GOT IT WRONG.**
 * It fingerprinted a 12x12 grid of cell luminances, which is a statement about WHERE light is — and every
 * one of these hosts animates, so two frames of the SAME preset at two moments differ enormously. Measured:
 * `Pipes` drifted **65-86 units** against itself, which swamped even the operators whose effect is obvious
 * to the eye (`Pipes Timescan` scored 0.62x and was reported UNJUDGEABLE while plainly transformed).
 *
 * **A histogram is pose-INVARIANT and density-SENSITIVE, which is exactly the discrimination wanted here.**
 * Rotating a figure moves light around without changing how much of it is at each brightness; a fold, a
 * twist or a reparameterisation changes the distribution itself. So the noise floor collapses while the
 * signal survives. ⚠️ **Normalised, so a brightness change alone does not read as a shape change**, and
 * compared as an L1 distance over 24 bins because a histogram is a distribution rather than a vector.
 */
const fingerprint = () => page.evaluate(() => {
  const c = document.querySelector('canvas');
  // Returns the engine's EXISTING context (the attributes here are ignored); it preserves its drawing buffer because
  // this runs under automation (`navigator.webdriver`, `core/compute-backend.ts`) — the readback below depends on it.
  const g = c.getContext('webgl2', { preserveDrawingBuffer: true });
  const px = new Uint8Array(c.width * c.height * 4);
  g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, px);
  const B = 24, h = new Float64Array(B);
  const n = c.width * c.height;
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    h[Math.min(B - 1, Math.floor(l / 256 * B))]++;
  }
  return Array.from(h, v => 100 * v / n);
});

// L1 over the normalised histogram: the total probability mass that moved between bins.
const dist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);

async function load(name) {
  const t = page.locator(`[data-preset="${name}"]:visible`).first();
  if (!await t.count()) return false;
  await t.scrollIntoViewIfNeeded();
  await t.click();
  await page.waitForTimeout(SETTLE);
  return true;
}

console.log(`\n=== every demo must differ from its parent by more than the parent's OWN drift ===\n`);
console.log(`    margin ${MARGIN}x, drift window ${DRIFT} ms, ${BINS}-bin luminance histogram (pose-invariant)\n`);

for (const [demo, parent, what] of PAIRS) {
  if (!await load(parent)) { chk(`${demo} vs ${parent}`, false, 'the PARENT is not in the grid'); continue; }
  const p1 = await fingerprint();
  await page.waitForTimeout(DRIFT);
  const p2 = await fingerprint();            // the parent against itself: the noise floor
  const drift = dist(p1, p2);

  if (!await load(demo)) { chk(`${demo} vs ${parent}`, false, 'the DEMO is not in the grid'); continue; }
  const d1 = await fingerprint();
  const effect = dist(p1, d1);
  const ratio = drift > 1e-9 ? effect / drift : Infinity;

  const detail = `${what}: effect ${effect.toFixed(1)} vs parent drift ${drift.toFixed(1)} `
    + `= ${ratio === Infinity ? 'inf' : ratio.toFixed(2)}x`;
  if (drift > 1e-9 && ratio < 1.0) {
    // ⚠️ Reported as its own class: the operator is not merely weak here, it is INSIDE the noise, so this
    // host cannot answer the question at all. Re-host rather than retune.
    chk(`${demo} is judgeable on ${parent}`, false, `${detail} — UNJUDGEABLE: the operator's effect is `
      + 'inside the host\'s own frame-to-frame variation. Choose a stationary or denser parent');
  } else {
    chk(`${demo} visibly differs from ${parent}`, ratio >= MARGIN,
      `${detail}${ratio >= MARGIN ? '' : ' — below the margin; the host may be hiding the operator'}`);
  }
}

console.log(`\nconsole errors: ${errs.length ? [...new Set(errs)].join(' | ') : 'none'}`);
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  democheck: ${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
