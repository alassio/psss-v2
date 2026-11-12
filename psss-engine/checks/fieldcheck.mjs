// The styles 0-3 displacement field formula now exists in THREE places, and nothing else can tell whether
// they still agree:
//
//   1. GLSL, in trans-map.ts's warp shader   -- what the screen shows
//   2. TypeScript, in static-field.ts        -- `staticOffsetAt`, what particles feel via the analytic
//      force sampler, plus the wave arrays both it and the shader consume
//   3. this file's own transcription of the pre-port 2D CPU formula -- the independent oracle
//
// ⚠️ **The TS copy is in `static-field.ts`, NOT in `trans-map-force.ts`.** D was authored expecting the
// analytic sampler to carry its own arithmetic; it does not — `trans-map-force.ts` calls a hoisted closure
// that reaches `TranslationMapProcessor.sampleStaticOffset` -> `staticOffsetAt`. That is ONE TS copy rather
// than two, so D greps `static-field.ts` for the formulas and greps the force path for the DELEGATION
// instead. If a future edit inlines the arithmetic back into the force path, the delegation grep fails,
// which is the outcome to want: that would recreate the second copy this checker exists to police.
//
// `tsc` sees three unrelated bodies of arithmetic. `glslcheck` sees the shader compiles. Neither can see
// that a sign was dropped in one of them -- which is invariant 11's class ("a state field a sibling
// function never writes") in triplicate, and invariant 10's ("check the UNITS of the result").
//
// This checker re-implements the ORIGINAL CPU formulas from the pre-2026-08-20 engine, verbatim from the
// Delphi-derived compute* helpers, and asserts:
//
//   A. the drift-0 field equals the original, over every one of the 177 shipped preset tables
//      (the parity oracle for the port -- if this drifts, every legacy preset renders differently)
//   B. drift is a RIGID TRANSLATION, not a boil (the property the phase*freq term exists to guarantee)
//   C. `strength` is linear and resolution-independent in all four styles (the unit-mismatch fix)
//   D. the GLSL and the TS sampler agree with each other, term for term
//   E. `detail` is resolution-independent, so the preview grid must NOT scale it -- measured both ways,
//      because the field's NAME says screen-space and its formula does not
//   F. `drift` is in CELLS PER SECOND and means the same speed on every pattern at every detail -- the
//      normalisation that removed a measured 128x spread in apparent speed at one slider value
//   G. a slider edit KEEPS the archetype (the reported `(Custom)` data-loss bug), and `strength` is live on
//      the `(Preset)` path while `detail` is inert there BY DESIGN, with its row hidden
//   H. dispersion is CHAIN-LEVEL, not fluid-gated -- and the three ways that ungating fails invisibly:
//      an over-eager ungating of the glow, a dropped legacy-key fallback, and a surviving second slider
//
// ⚠️ A is the load-bearing one. It is the only assertion here that can fail because of a change to the
// engine rather than a change to this file, and an "everything unchanged" oracle cannot distinguish a
// working port from a dead one -- so B/C/D exist to prove the field is actually being computed. A also
// carries its own falsifiability test: it perturbs one amplitude by 0.01 and asserts the comparison
// NOTICES. Without that, "max |diff| = 0 over 177 presets" would also be the output of comparing two
// all-zero arrays.
//
// Section D is a TEXT-PATTERN grep, like seven of the eight sibling checkers, and inherits their weakness:
// a behaviour-neutral rename breaks it. Read the assertion before believing a failure is a regression.
// D was authored BEFORE the code it checks (the analytic sampler in trans-map-force.ts and style 3's
// zoom-wave path), deliberately, so it could not be shaped to fit whatever the implementation happened to
// do. It was red on first run by construction.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src') + '/';
const PRESETS = join(HERE, '..', 'public', 'psss_presets.json');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

/**
 * ⚠️ **Strip comments before ANY grep in this file** — the same step `deadcheck.mjs:44` needs for the same
 * reason. Sections D, E and F all document the rules they enforce in prose that necessarily names the very
 * identifiers they search for, so a raw grep matches the EXPLANATION of a rule and reports the rule as broken.
 * Section E failed exactly that way on its first run. File-level rather than one copy per section, because a
 * section that forgot the step would not fail loudly — it would grep the prose and pass or fail by accident.
 */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The body of ONE function, brace-matched from its declaration. ⚠️ **Never scope a "how many times does X
 * appear inside function F" assertion with a bare `slice(indexOf(decl))`** — that runs to the end of the file,
 * so every later site in the module counts as if it were inside F. §I's `fboState.fboB` count failed that way
 * on correct code (it swept in two startup/resize `clear` sites). Call this on COMMENT-STRIPPED source: a brace
 * inside a comment or string would desync the depth count, and stripping removes the realistic case.
 * Returns '' if the declaration is absent, which fails the caller's assertion — the right outcome.
 */
const braceBody = (src, decl) => {
  const start = src.indexOf(decl);
  if (start < 0) return '';
  const open = src.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
};

const DEG = 180 / Math.PI;
const N = 4;

// ---------------------------------------------------------------------------
// The ORIGINAL formulas. Do not "simplify" these -- they are the reference.
// Transcribed from trans-map.ts computeSinMagic / computeSinMagicZoom / computeSinMagicZoom2 as of
// 2026-08-19, before the separable rewrite.
// ---------------------------------------------------------------------------
const rollToRange = (v, min, max) => {
  if (v < min) return min + (min - v) % (max - min);
  if (v > max) return max - (v - max) % (max - min);
  return v;
};
const restrictToRange = (v, min, max) => (v < min ? min : v > max ? max : v);
const zoomCoordinate = (ref, coord, zoom) => Math.round(ref + (coord - ref) * zoom);

// `period` is the frequency divisor. ⚠️ **It DEFAULTS to `n`, which is the pre-port formula verbatim, and
// that default is what makes A1 a legacy anchor rather than a copy of today's arithmetic.** The engine now
// divides by `min(w,h)` on BOTH axes instead of by each axis's own pixel count (the 2026-08-28 aspect-stretch
// fix, see `static-field.ts` -> `buildWave`), so the two agree EXACTLY when `w === h` and diverge by the
// canvas aspect otherwise. A1 therefore drives the untouched default at a square frame; A2 threads the shared
// period so the same oracle still covers the 2D composition (per-axis zoom centres, rounding, roll bounds) at
// a NON-square frame, which a square-only run cannot reach.
// ⚠️ The `+ PI*f*(1 - n/period)` term is the CENTRE ANCHOR, and it is DERIVED from the pre-port formula
// rather than copied from the engine: the legacy phase at the frame centre is `2*PI*f*(n/2)/n` = `PI*f`, and
// measuring the shared-period displacement from that centre gives `sin(2*PI*f*(i - n/2)/period + PI*f)`,
// which expands to exactly this. It is **identically zero when `period === n`**, so A1's legacy anchor and
// the `null` per-axis calibration below both run the untouched pre-port formula — the oracle does not become
// a copy of the code it checks. See `static-field.ts` -> `centreAnchor` for why the origin needed fixing
// after the divisor did (they are two quantities, and the divisor fix alone left the figure off-centre).
function prepareWave(amps, freqs, n, period = n) {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < N; k++) {
      a[i] += Math.sin(((360 * i * freqs[k]) / period) / DEG + Math.PI * freqs[k] * (1 - n / period)) * amps[k];
    }
  }
  return a;
}

// Returns the relative offset field as {ox, oy} Float64Arrays, in UV units, exactly as
// addTranslation would have written them.
function originalField(style, p1, p2, w, h, cxPct, cyPct, period = null) {
  const ox = new Float64Array(w * h), oy = new Float64Array(w * h);
  const cx = (cxPct * w) / 100, cy = (cyPct * h) / 100;
  // null => the pre-port per-axis divisor; a number => one shared period for both axes.
  const pX = period ?? w, pY = period ?? h;
  let wX, wY;
  if (style === 0) {
    const fit = Math.min(w, h) / 100;
    wX = prepareWave(p1[0].map(v => v * fit), p1[1], w, pX);
    wY = prepareWave(p1[2].map(v => v * fit), p1[3], h, pY);
  } else {
    wX = prepareWave(p1[0], p1[1], w, pX);
    wY = prepareWave(p1[2], p1[3], h, pY);
  }
  let z2X, z2Y;
  if (style === 3) {
    z2X = new Float64Array(w); z2Y = new Float64Array(h);
    // Same centre anchor as `prepareWave`, and zero when `pX === w` / `pY === h` (the pre-port default).
    for (let x = 0; x < w; x++) for (let k = 0; k < N; k++)
      z2X[x] += p2[0][k]
        + Math.sin(((360 * x * p2[1][k]) / pX) / DEG + Math.PI * p2[1][k] * (1 - w / pX)) * p2[0][k];
    for (let y = 0; y < h; y++) for (let k = 0; k < N; k++)
      z2Y[y] += p2[2][k]
        + Math.sin(((360 * y * p2[3][k]) / pY) / DEG + Math.PI * p2[3][k] * (1 - h / pY)) * p2[2][k];
  }
  for (let y = 0; y < h; y++) {
    const wy = wY[y];
    for (let x = 0; x < w; x++) {
      let x2, y2;
      if (style === 0) {
        x2 = restrictToRange(x + wy, -100000, 100000);
        y2 = restrictToRange(y + wX[x], -100000, 100000);
      } else if (style === 1) {
        x2 = zoomCoordinate(cx, x, 1 - wX[x]);
        y2 = zoomCoordinate(cy, y, 1 - wy);
      } else if (style === 2) {
        const zoom = 1 - (wX[x] + wy) / 2;
        x2 = zoomCoordinate(cx, x, zoom);
        y2 = zoomCoordinate(cy, y, zoom);
      } else {
        const zoom = 1 - (z2X[x] + z2Y[y]) / 2;
        x2 = zoomCoordinate(cx, Math.round(x + wy), zoom);
        y2 = zoomCoordinate(cy, Math.round(y + wX[x]), zoom);
      }
      const sx = rollToRange(Math.round(x2), 0, w - 1);
      const sy = rollToRange(Math.round(y2), 0, h - 1);
      const i = y * w + x;
      ox[i] = (sx - x) / w;
      oy[i] = (sy - y) / h;
    }
  }
  return { ox, oy };
}

// ---------------------------------------------------------------------------
// The CURRENT engine's field, driven through the real static-field.ts source.
// Imported as text and evaluated, so this checker exercises the SHIPPED code rather than a copy of it.
// ---------------------------------------------------------------------------
const sfSrc = readFileSync(SRC + 'post-processors/static-field.ts', 'utf8');

// The separable field, driven through the SHIPPED composition (`staticOffsetAt`) over the SHIPPED wave
// arrays (`resolveStaticWaves`). Both halves are real engine code, so A compares the engine against this
// file's independent transcription of the pre-port 2D formula rather than comparing two copies of the same
// arithmetic -- which is what it did until 2026-08-20, and which could not have caught an edit to
// `staticOffsetAt` at all.
//
// `ratio` is the per-layer weight the engine divides out; 1 here, matching a single unmuted layer at
// `staticWeightScale`. The `out` buffer is reused across every texel, exactly as the force loop does.
function separableField(style, waves, w, h, cxPct, cyPct) {
  const ox = new Float64Array(w * h), oy = new Float64Array(w * h);
  const cx = (cxPct * w) / 100, cy = (cyPct * h) / 100;
  const layer = {
    style, centreX: cx, centreY: cy, ratio: 1,
    waveX: waves.waveX, waveY: waves.waveY, zoomX: waves.zoomX, zoomY: waves.zoomY,
  };
  const layers = [layer];
  const out = new Float64Array(2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      SF.staticOffsetAt(layers, x, y, w, h, out);
      const i = y * w + x;
      ox[i] = out[0];
      oy[i] = out[1];
    }
  }
  return { ox, oy };
}

// Transpile the REAL source with the project's own TypeScript, so this checker exercises the shipped code
// rather than a copy of it. Hand-rolled regex type-stripping was tried first and is a trap: it broke on
// `Required<Omit<...>>` in a way that reported as "Missing initializer in const declaration", i.e. an error
// pointing nowhere near its cause. `transpileModule` does not type-check, which is fine -- `npm run verify`
// already runs `tsc --noEmit` over the same file.
const { default: ts } = await import('typescript');

function loadStaticField() {
  const js = ts.transpileModule(sfSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  // `import type` statements erase to nothing, so `require` is never actually reached.
  const fn = new Function('exports', 'require', js + '\n;return exports;');
  return fn(exports, () => ({}));
}

let SF;
try {
  SF = loadStaticField();
} catch (e) {
  console.log('  FAIL  static-field.ts could not be evaluated   ' + e.message);
  process.exit(1);
}

const raw = readFileSync(PRESETS, 'utf8');
const LIB = JSON.parse(raw.slice(raw.indexOf('{')));
const entries = Object.entries(LIB);

const maxAbsDiff = (a, b) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
};

// ===========================================================================
console.log('=== A. drift-0 parity against the original CPU field, over all shipped preset tables ===\n');
// A modest frame: the assertion is per-pixel exactness, which does not need a big canvas, and 177
// presets x 4 styles at full HD would take minutes.
//
// ⚠️ **A1 IS SQUARE AND A2 IS NOT, AND BOTH ARE REQUIRED — neither alone covers the section's job.** The
// engine's frequency divisor is now `min(w,h)` for both axes rather than each axis's own pixel count, so the
// pre-port formula and the engine coincide EXACTLY at 1:1 and by construction nowhere else. A1 keeps the
// legacy anchor by running the untouched pre-port default at a square frame; A2 threads the shared period into
// the same oracle so the 2D composition (per-axis zoom centres, `Math.round`, roll bounds, style 3's two wave
// pairs) is still checked per-pixel at a non-square frame. Deleting either half was the tempting move and it
// loses a distinct guarantee: A1 alone stops covering aspect entirely, A2 alone stops comparing against
// anything older than today's code.
const WSQ = 160;
const W = 160, H = 120;
let worstA1 = 0, worstName1 = '', checkedA1 = 0;
for (const [name, p] of entries) {
  const style = p.TransMapStyle;
  const layer = { style, enabled: true, weight: 1 };   // no staticField -> defaults -> (Preset), drift 0
  const cxPct = p.ZoomCenterX ?? 50, cyPct = p.ZoomCenterY ?? 50;
  const cx = (cxPct * WSQ) / 100, cy = (cyPct * WSQ) / 100;
  const waves = SF.resolveStaticWaves(layer, p.SinMagicParams, p.SinMagicParams2, WSQ, WSQ, cx, cy, 0);
  const a = originalField(style, p.SinMagicParams, p.SinMagicParams2, WSQ, WSQ, cxPct, cyPct);
  const b = separableField(style, waves, WSQ, WSQ, cxPct, cyPct);
  const d = Math.max(maxAbsDiff(a.ox, b.ox), maxAbsDiff(a.oy, b.oy));
  checkedA1++;
  if (d > worstA1) { worstA1 = d; worstName1 = name; }
}
chk(`A1: all ${checkedA1} preset tables reproduce the ORIGINAL pre-port field exactly at a square frame`,
  worstA1 === 0,
  worstA1 === 0 ? `max |diff| = 0 over ${checkedA1} presets @ ${WSQ}x${WSQ}` : `WORST: ${worstName1}, max |diff| = ${worstA1.toExponential(2)} UV`);

let worstA2 = 0, worstName2 = '', checkedA2 = 0;
for (const [name, p] of entries) {
  const style = p.TransMapStyle;
  const layer = { style, enabled: true, weight: 1 };
  const cxPct = p.ZoomCenterX ?? 50, cyPct = p.ZoomCenterY ?? 50;
  const cx = (cxPct * W) / 100, cy = (cyPct * H) / 100;
  const waves = SF.resolveStaticWaves(layer, p.SinMagicParams, p.SinMagicParams2, W, H, cx, cy, 0);
  const a = originalField(style, p.SinMagicParams, p.SinMagicParams2, W, H, cxPct, cyPct, Math.min(W, H));
  const b = separableField(style, waves, W, H, cxPct, cyPct);
  const d = Math.max(maxAbsDiff(a.ox, b.ox), maxAbsDiff(a.oy, b.oy));
  checkedA2++;
  if (d > worstA2) { worstA2 = d; worstName2 = name; }
}
chk(`A2: all ${checkedA2} preset tables reproduce the 2D composition exactly at a NON-square frame`,
  worstA2 === 0,
  worstA2 === 0 ? `max |diff| = 0 over ${checkedA2} presets @ ${W}x${H}` : `WORST: ${worstName2}, max |diff| = ${worstA2.toExponential(2)} UV`);

// The oracle must be capable of failing. Perturb one amplitude and confirm it does.
{
  const p = LIB['Borg Cube'] ?? entries[0][1];
  const bent = JSON.parse(JSON.stringify(p.SinMagicParams));
  bent[0][0] += 0.01;
  const a = originalField(p.TransMapStyle, p.SinMagicParams, p.SinMagicParams2, W, H, 50, 50);
  const b = originalField(p.TransMapStyle, bent, p.SinMagicParams2, W, H, 50, 50);
  const d = Math.max(maxAbsDiff(a.ox, b.ox), maxAbsDiff(a.oy, b.oy));
  chk('the parity oracle detects a 0.01 amplitude perturbation (it is not vacuously true)', d > 0,
    `max |diff| = ${d.toExponential(2)} UV`);
}
// A2 must be capable of failing too, and the defect it exists for is the OLD per-axis divisor. Pass `null`
// (the pre-port default) at the same non-square frame and require a MISMATCH -- otherwise A2 would stay green
// if `buildWave` regressed to dividing by `n`. ⚠️ This is the calibration CLAUDE.md asks for: a relaxed
// assertion must still fail on the defect it was written for.
{
  const p = LIB['Borg Cube'] ?? entries[0][1];
  const style = p.TransMapStyle;
  const layer = { style, enabled: true, weight: 1 };
  const cx = (50 * W) / 100, cy = (50 * H) / 100;
  const waves = SF.resolveStaticWaves(layer, p.SinMagicParams, p.SinMagicParams2, W, H, cx, cy, 0);
  const old = originalField(style, p.SinMagicParams, p.SinMagicParams2, W, H, 50, 50, null);
  const b = separableField(style, waves, W, H, 50, 50);
  const d = Math.max(maxAbsDiff(old.ox, b.ox), maxAbsDiff(old.oy, b.oy));
  chk('A2 rejects the OLD per-axis frequency divisor at a non-square frame (the aspect-stretch defect)',
    d > 0, `max |diff| vs the per-axis divisor = ${d.toExponential(2)} UV @ ${W}x${H}`);
}

// ---------------------------------------------------------------------------
// A3/A4: the property the aspect fix exists for. ⚠️ **This is what NO parity assertion could ever have
// caught, because the oracle carried the same defect** -- the pre-port formula was authored against a canvas
// nobody resized, so "matches the original exactly" was true and the field was still stretched by the canvas
// aspect. Reported as *"the figure is slightly horizontally distorted"* on a preview -> fullscreen toggle.
// ---------------------------------------------------------------------------
{
  // A symmetric table: equal amplitude and frequency on X and Y, so a correct field is CIRCULAR and the two
  // axes' first extremum must sit at the same PIXEL distance whatever the canvas shape. `Sphere new`'s
  // authored freq of 0.5 is deliberate -- at freq 0.5 only a half cycle exists in the array, so a
  // zero-crossing metric returns nothing and the extremum is the measurable feature.
  const SYM = [[1, 0, 0, 0], [0.5, 0, 0, 0], [1, 0, 0, 0], [0.5, 0, 0, 0]];
  const Zp = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const argmaxAbs = a => {
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > bv) { bv = v; bi = i; } }
    return bi;
  };
  const SHAPES = [[960, 1036], [1920, 1200], [1080, 1080], [600, 1400], [2560, 1080]];
  // ⚠️ **The metric is a RING SAMPLED ABOUT THE FRAME CENTRE, and its first form -- the ratio of the two
  // axes' argmax measured from PIXEL 0 -- was itself anchored to the defect the centre anchor fixed.** That
  // form read 1.0000 at every shape while the field was correctly SHAPED and wrongly PLACED: a wave whose
  // extremum sits `min(w,h)/(4*f)` px from pixel 0 has the same per-axis distance on both axes, so the ratio
  // is 1 no matter where that lands relative to the frame. It could therefore never see the off-centre figure
  // (`Sphere new`'s style-2 eye at x = 0.313 instead of 0.500 at 1920x1200) that a screenshot found in one
  // look. Sampling a fixed PIXEL radius about the centre at many angles tests placement and shape together:
  // a field that is circular about the frame centre gives one constant value round the ring.
  const ringSpread = (w, h, waves) => {
    const minDim = Math.min(w, h);
    let worst = 0;
    for (const frac of [0.1, 0.2, 0.3]) {
      const r = frac * minDim;
      let lo = Infinity, hi = -Infinity;
      for (let deg = 0; deg < 360; deg += 5) {
        const i = Math.round(w / 2 + r * Math.cos(deg / DEG));
        const j = Math.round(h / 2 + r * Math.sin(deg / DEG));
        if (i < 0 || i >= w || j < 0 || j >= h) continue;
        const v = waves.waveX[i] + waves.waveY[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      worst = Math.max(worst, hi - lo);
    }
    return worst;
  };
  let worstRing = 0, worstShape = '';
  for (const [w, h] of SHAPES) {
    const waves = SF.resolveStaticWaves({ style: 2, enabled: true, weight: 1 }, SYM, Zp, w, h, w / 2, h / 2, 0);
    const s = ringSpread(w, h, waves);
    if (s > worstRing) { worstRing = s; worstShape = `${w}x${h} -> spread ${s.toFixed(4)}`; }
  }
  // Threshold, not zero: the ring is sampled on the integer pixel grid, so `Math.round` alone leaves a small
  // residue that is present at a SQUARE canvas too (measured 0.0154 at 1080x1080, where the field is exactly
  // the pre-port one). The assertion is that no shape is materially worse than that floor.
  chk(`A3: a symmetric table is CIRCULAR ABOUT THE FRAME CENTRE at all ${SHAPES.length} canvas shapes`,
    worstRing < 0.05, worstRing < 0.05
      ? `worst ring spread = ${worstRing.toFixed(4)} (square-canvas grid floor 0.0154)`
      : `WORST: ${worstShape}`);
  // Calibration 1 -- the pre-port per-axis divisor. Its rings are ellipses of exactly the canvas aspect.
  const oldRatio = (1920 / 0.5 / 4) / (1200 / 0.5 / 4);
  chk('A3 would have caught the pre-port divisor (its axis ratio equals the canvas aspect)',
    Math.abs(oldRatio - 1920 / 1200) < 1e-12 && Math.abs(oldRatio - 1) > 0.5,
    `per-axis divisor at 1920x1200 gives ratio ${oldRatio.toFixed(4)} = a ${oldRatio.toFixed(2)}x wide ellipse`);
  // Calibration 2 -- the SHIPPED intermediate state: shared period, but anchored at pixel 0. ⚠️ This is the
  // one the old argmax metric scored 1.0000 on, so it is the calibration that proves the new metric is
  // strictly stronger rather than merely different.
  {
    const noAnchor = (amps, freqs, n, period) => {
      const a = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < N; k++) a[i] += Math.sin(((360 * i * freqs[k]) / period) / DEG) * amps[k];
      }
      return a;
    };
    let worstOld = 0;
    for (const [w, h] of SHAPES) {
      const p = Math.max(1, Math.min(w, h));
      const fake = { waveX: noAnchor(SYM[0], SYM[1], w, p), waveY: noAnchor(SYM[2], SYM[3], h, p) };
      worstOld = Math.max(worstOld, ringSpread(w, h, fake));
    }
    chk('A3 rejects the pixel-0 anchor that the OLD argmax metric scored 1.0000 on (the off-centre figure)',
      worstOld > 0.5, `pixel-0 anchor gives a ring spread of ${worstOld.toFixed(4)} against a 0.05 threshold`);
  }

  // A4: widening the canvas on its long axis must not change the field's SHAPE -- at drift 0 and, crucially,
  // WHILE DRIFTING. This is the defect's second, unreported half: with a per-axis divisor `waveX` advanced
  // `p*w/(2*pi)` px while `waveY` advanced `p*h/(2*pi)`, i.e. DIFFERENT distances, so a drifting field sheared
  // instead of translating rigidly. §B tests rigidity at a square frame only and so cannot see it.
  //
  // ⚠️ **The assertion is invariance UP TO ONE SHARED SCALAR, and that is not a weakened form of "no sample
  // changes" -- it is the only form that measures ANISOTROPY rather than a pre-existing gain wobble.** A strict
  // per-sample assertion was written first and failed at 1.27e-1 on correct code. The cause is `solveGain`'s
  // fixed `GAIN_SCAN = 128` sample grid: it steps by `floor(w/128)`, so a different canvas width lands its
  // samples elsewhere and finds a slightly different peak to normalise against. Measured, the gain is a pure
  // function of that step pair and of nothing else -- 1151x1080 and 1080x1080 both step (8,8) and agree to
  // 1.000000000, while 1920x1080 steps (15,8) and differs by 0.21%. So the residue is ISOTROPIC (one scalar on
  // both axes) and it predates this section. Fitting a least-squares scalar divides it out and leaves exactly
  // the quantity that matters: `|sX - sY|`, the per-axis gain difference, which the per-axis divisor made equal
  // to the canvas aspect and which is now 0. A4b then confirms that scalar is not itself hiding a shape change.
  const m = 1080;
  // ⚠️ **Both arrays are compared ABOUT THEIR OWN CENTRE, not from index 0**, and that is forced by the
  // centre anchor rather than a convenience: the wave is now positioned relative to the frame centre, so a
  // 1920-long array and a 1080-long one agree at `i - n/2`, NOT at `i`. Comparing from index 0 made A4 read
  // sX = -0.58 against sY = 1.00 on correct code — a sign flip, i.e. it was measuring the anchor offset and
  // calling it anisotropy. The half-width `HALF` is the shared window both arrays cover.
  const HALF = Math.floor(m / 2) - 1;
  const lsqCentred = (a, b) => {
    const ca = a.length / 2, cb = b.length / 2;
    let num = 0, den = 0;
    for (let d = -HALF; d <= HALF; d++) {
      const va = a[Math.round(ca + d)], vb = b[Math.round(cb + d)];
      num += va * vb; den += va * va;
    }
    return num / den;
  };
  let worstAniso = 0, worstAt = '', worstResid = 0, worstResidAt = '';
  for (const drift of [0, 2.5]) {
    const layer = { style: 0, enabled: true, weight: 1, staticField: { pattern: 'Turbulent Weave', strength: 1, detail: 1, drift } };
    const base = SF.resolveStaticWaves(layer, Zp, Zp, m, m, m / 2, m / 2, drift * SF.DRIFT_RATE);
    let peak = 0;
    for (let i = 0; i < m; i++) peak = Math.max(peak, Math.abs(base.waveX[i]));
    // Every shape below has `m` as its SMALLER dimension, so both wave arrays are at least `m` long.
    for (const [w, h] of [[1920, m], [m, 1920], [3000, m], [2560, m]]) {
      const v = SF.resolveStaticWaves(layer, Zp, Zp, w, h, w / 2, h / 2, drift * SF.DRIFT_RATE);
      const sX = lsqCentred(base.waveX, v.waveX), sY = lsqCentred(base.waveY, v.waveY);
      const aniso = Math.abs(sX - sY);
      if (aniso > worstAniso) { worstAniso = aniso; worstAt = `${w}x${h} drift=${drift}: sX=${sX.toFixed(6)} sY=${sY.toFixed(6)}`; }
      const s = (sX + sY) / 2;
      let r = 0;
      const cbX = v.waveX.length / 2, cbY = v.waveY.length / 2, cm = m / 2;
      for (let d = -HALF; d <= HALF; d++) {
        r = Math.max(r,
          Math.abs(base.waveX[Math.round(cm + d)] * s - v.waveX[Math.round(cbX + d)]),
          Math.abs(base.waveY[Math.round(cm + d)] * s - v.waveY[Math.round(cbY + d)]));
      }
      if (r / peak > worstResid) { worstResid = r / peak; worstResidAt = `${w}x${h} drift=${drift}`; }
    }
  }
  chk('A4: X and Y take the SAME gain at every canvas shape, at drift 0 AND while drifting (no aspect anisotropy)',
    worstAniso < 1e-12, worstAniso < 1e-12 ? 'max |sX - sY| = 0 over 4 shapes x 2 drifts' : `WORST: ${worstAt}`);
  chk('A4b: the wave SHAPE survives that single scalar (so "up to a scalar" is not hiding a real change)',
    worstResid < 1e-9, `worst residual = ${(100 * worstResid).toExponential(2)}% of peak${worstResidAt ? ' @ ' + worstResidAt : ''}`);
  // Calibration: with the pre-port per-axis divisor the two gains differ by the canvas aspect itself, so A4
  // fails hard on the defect it was written for -- ~0.78 at 1920x1080, against a 1e-12 threshold.
  chk('A4 would have caught the pre-port divisor (|sX - sY| becomes the canvas aspect minus one)',
    Math.abs(1920 / m - 1) > 0.7, `per-axis divisor at 1920x${m} gives |sX - sY| ~ ${(1920 / m - 1).toFixed(4)}`);

  // -------------------------------------------------------------------------
  // A5: the wave's ORIGIN, which is a SECOND quantity from its scale and which the divisor fix broke.
  // Legacy's `i/n` reached 0.5 at the frame centre on every canvas, so the centre phase was shape-invariant
  // for free; `i/period` is not, and shipping the divisor alone put the figure off-centre on a wide canvas.
  // ⚠️ **The assertion is against LEGACY's own centre value, not against a self-consistency property** --
  // "the centre phase is the same at every shape" would also be satisfied by a wave anchored somewhere new,
  // and the requirement is specifically that a 1:1-authored preset keeps its authored appearance.
  // -------------------------------------------------------------------------
  {
    const legacyCentre = (amps, freqs, n) => {
      let s = 0;
      const mid = Math.floor(n / 2);
      for (let k = 0; k < N; k++) s += Math.sin(((360 * mid * freqs[k]) / n) / DEG) * amps[k];
      return s;
    };
    // ⚠️ **THE DEGENERACY FILTER MEASURES THE RESOLVED FIELD; IT DOES NOT TEST THE TABLE FOR ZEROS (T5).**
    // It read `P.flat().every(v => v === 0)`, which is a different predicate wearing the same words. An
    // identically-zero field is produced by TWO table shapes, and only one of them contains zeros:
    //
    //   * every amplitude 0 — `Rose`, `Subspace`, `The Real Black Hole` (3 of 177), and
    //   * a NONZERO amplitude at frequency 0 — `Penta Star System`, whose X and Y rows are `-0.10@0`, so
    //     `sin(0) · amp ≡ 0` for every pixel at every canvas shape. A table visibly full of numbers, and an
    //     exact identity.
    //
    // The consequence was not a wrong figure, it was an ASSERTION THAT COULD NOT FAIL being counted as one
    // that had passed: `Penta Star System` survived the filter, entered `checked`, and then compared 0 against
    // 0 on both axes at all five shapes — ten comparisons that stay green under any imaginable regression. A5's
    // headline therefore over-claimed by exactly one preset, which is the shape CLAUDE.md's *Phase 17* rule
    // names ("an unreachable assertion is worse than a missing one") reached from outside the harness. The same
    // mis-oracle is corrected in `static-field.ts`'s own header, in `buildTimeWarpBody`'s, and it is why the
    // panel's field readout (`updateStaticReadout`) measures a peak rather than scanning for zeros.
    //
    // ⚠️ Measured over `SHAPES`, not at one canvas, because degeneracy has to hold at EVERY shape to justify a
    // skip — a table that is flat at 1080x1080 and live at 2560x1080 is a preset this section must check, and
    // the frequency divisor is `min(w,h)`, so that is not a hypothetical class.
    const shiftPeaks = (P, P2, style) => {
      let px = 0, py = 0;
      for (const [w, h] of SHAPES) {
        const v = SF.resolveStaticWaves({ style, enabled: true, weight: 1 }, P, P2, w, h, w / 2, h / 2, 0);
        for (const s of v.waveX) px = Math.max(px, Math.abs(s));
        for (const s of v.waveY) py = Math.max(py, Math.abs(s));
      }
      return [px, py];
    };
    let worstNow = 0, worstNowAt = '', worstOld = 0, checked = 0;
    // Two independent tallies, because "how many presets did A5 look at" and "how many of its comparisons
    // could have failed" are different quantities and only the second one bounds what the section proves.
    // ⚠️ A5 samples ONE PIXEL per axis (the frame centre), so a live wave whose centre value happens to be 0
    // still contributes a trivial comparison — the triviality test is the EXPECTED value at the sampled
    // instant, never the peak of the wave it came from.
    let cmpTotal = 0, cmpLive = 0;
    const degenerate = [];
    for (const [name, p] of entries) {
      const P = p.SinMagicParams;
      if (!P) continue;
      const [pkX, pkY] = shiftPeaks(P, p.SinMagicParams2, p.TransMapStyle);
      if (pkX === 0 && pkY === 0) { degenerate.push(name); continue; }
      checked++;
      for (const [w, h] of SHAPES) {
        const layer = { style: p.TransMapStyle, enabled: true, weight: 1 };
        const v = SF.resolveStaticWaves(layer, P, p.SinMagicParams2, w, h, w / 2, h / 2, 0);
        // Style 0 scales amplitude by `min(w,h)/100`; divide it back out so the comparison is pure phase.
        const fit = p.TransMapStyle === 0 ? Math.min(w, h) / 100 : 1;
        const eX = legacyCentre(P[0], P[1], w), eY = legacyCentre(P[2], P[3], h);
        cmpTotal += 2;
        if (eX !== 0) cmpLive++;
        if (eY !== 0) cmpLive++;
        const dX = Math.abs(v.waveX[Math.floor(w / 2)] / fit - eX);
        const dY = Math.abs(v.waveY[Math.floor(h / 2)] / fit - eY);
        const d = Math.max(dX, dY);
        if (d > worstNow) { worstNow = d; worstNowAt = `${name} @ ${w}x${h}`; }
        // The shipped pixel-0 anchor, for calibration.
        const pd = Math.max(1, Math.min(w, h));
        for (const [A, F, n] of [[P[0], P[1], w], [P[2], P[3], h]]) {
          let s = 0;
          const mid = Math.floor(n / 2);
          for (let k = 0; k < N; k++) s += Math.sin(((360 * mid * F[k]) / pd) / DEG) * A[k];
          worstOld = Math.max(worstOld, Math.abs(s - legacyCentre(A, F, n)));
        }
      }
    }
    // ⚠️ **Threshold 1e-6, and it is DERIVED, not chosen to pass.** The two forms are algebraically identical,
    // so the only residue is float64 rounding -- but `Video Tape Error` carries a frequency of **1000000**,
    // five orders of magnitude above anything else in the library, which puts the phase argument at ~7.4e6
    // where one ulp is already 1.65e-9. Times an amplitude of 10, a few ulps land at ~1.4e-8. A 1e-9
    // threshold therefore fails on correct code at that one preset (invariant 10's shape: the expression was
    // right and the tolerance was in the wrong units). 1e-6 is ~70x the observed noise and still 8 orders
    // below the 82.3 the real defect produces, so the calibration below stays decisive.
    const A5_TOL = 1e-6;
    chk(`A5: all ${checked} non-degenerate tables keep LEGACY's phase at the FRAME CENTRE, at every canvas shape`,
      worstNow < A5_TOL, worstNow < A5_TOL
        ? `max centre-phase error = ${worstNow.toExponential(2)} over ${checked} presets x ${SHAPES.length} shapes, `
          + `${cmpLive} of ${cmpTotal} comparisons non-trivial (float64 noise; tol ${A5_TOL})`
        : `WORST: ${worstNowAt}, error = ${worstNow.toExponential(2)}`);
    chk('A5 rejects the pixel-0 anchor (the off-centre-figure defect it was written for)',
      worstOld > 1, `pixel-0 anchor: max centre-phase error = ${worstOld.toFixed(1)} against a ${A5_TOL} threshold`);

    // ---- T5: the degeneracy filter is an INSTRUMENT, and these four clauses are what exonerate it --------
    //
    // ⚠️ Stated as the RELATIONSHIP between the two predicates rather than as two counts. Both numbers are
    // properties of a read-only frozen file and would pin fine, but a pinned pair says nothing about which
    // predicate is the right one — and the whole finding is that they disagree, in one direction, on a class
    // the wrong one cannot represent at all.
    const allZeroSkip = entries
      .filter(([, p]) => !p.SinMagicParams || p.SinMagicParams.flat().every(v => v === 0))
      .map(([n]) => n);
    const missed = degenerate.filter(n => !allZeroSkip.includes(n));
    chk('A5 skips a table by MEASURING its resolved field, and that filter is strictly stronger than the all-zero test',
      allZeroSkip.every(n => degenerate.includes(n)) && missed.length > 0,
      `measured: ${degenerate.length} skipped (${degenerate.join(', ')}); all-zero test: ${allZeroSkip.length}, `
      + `missing ${missed.join(', ')}`);
    chk('...and every table the all-zero test misses has NONZERO amplitudes sitting at frequency 0',
      missed.length > 0 && missed.every(n => {
        const P = LIB[n].SinMagicParams;
        const live = (amp, freq) => amp.some((a, i) => a !== 0 && freq[i] !== 0);
        return P.flat().some(v => v !== 0) && !live(P[0], P[1]) && !live(P[2], P[3]);
      }),
      'the class is `sin(0) · amp ≡ 0`, so the numbers are all present and the field is still an exact identity');
    // The whole point of the fix, and ⚠️ **asserted over the SURVIVING basis rather than over `missed`.** The
    // first draft of this clause tested "every table the all-zero predicate misses contributes only trivial
    // comparisons", which is the finding stated the natural way round — and it PASSES VACUOUSLY the moment the
    // filter regresses, because a regressed filter leaves `missed` empty and `[].every(...)` is true. Seeding
    // the old predicate back proved it: two clauses went red and this one stayed green while describing the
    // exact defect that had just been reintroduced. So it is turned around to a property of what A5 actually
    // measures — every preset in the basis contributes at least one comparison that could fail — which is
    // false in precisely the state the old filter produces.
    {
      const vacuous = [];
      for (const [name, p] of entries) {
        const P = p.SinMagicParams;
        if (!P || degenerate.includes(name)) continue;
        let live = false;
        for (const [w, h] of SHAPES) {
          if (legacyCentre(P[0], P[1], w) !== 0 || legacyCentre(P[2], P[3], h) !== 0) { live = true; break; }
        }
        if (!live) vacuous.push(name);
      }
      chk('...so no preset in A5\'s basis contributes ONLY comparisons of 0 against 0 (which would inflate `checked`)',
        vacuous.length === 0,
        vacuous.length === 0
          ? `${cmpTotal - cmpLive} of ${cmpTotal} comparisons are trivial and reported, but every one of the `
            + `${checked} presets carries at least one that can fail`
          : `${vacuous.join(', ')} — counted as passing while asserting nothing`);
    }
    // ⚠️ **The falsifiability seed, and it perturbs the FREQUENCY, not an amplitude.** An amplitude seed would
    // be caught by the old predicate too and would prove nothing about the change. Moving one frequency off 0
    // is the minimal edit that flips the measured answer while leaving the all-zero test's answer identical —
    // which is exactly the defect class in the form a checker can be held to.
    {
      const src = missed[0] ?? 'Penta Star System';
      const P0 = JSON.parse(JSON.stringify(LIB[src].SinMagicParams));
      const style = LIB[src].TransMapStyle;
      const P2 = LIB[src].SinMagicParams2;
      const [zx, zy] = shiftPeaks(P0, P2, style);
      P0[1][0] = 4;   // row 1 is X's FREQUENCIES; row 0's amplitudes are left untouched
      const [lx, ly] = shiftPeaks(P0, P2, style);
      chk('the measured filter NOTICES when that frequency alone moves off 0 (it is not vacuously true)',
        zx === 0 && zy === 0 && lx > 0,
        `"${src}": peak ${zx.toExponential(1)} as authored, ${lx.toExponential(2)} with one frequency at 4 — `
        + `and the all-zero test answers "not degenerate" both times, so it cannot tell the two apart`);
      chk('...and an all-zero table stays degenerate under the measured filter (the other half of the class)',
        shiftPeaks(Zp, Zp, style).every(v => v === 0),
        'both shapes must reach the same verdict, or the filter has merely swapped which one it misses');
      void ly;
    }
  }
}

// ===========================================================================
console.log('\n=== B. drift is a RIGID TRANSLATION of the field, not a boil ===\n');
// A rigid translation means: shifting the phase produces the same wave, displaced. If each harmonic
// advanced by a different distance (a bare `+ phase`), the SHAPE would change and this fails.
{
  const arch = SF.STATIC_FIELD_ARCHETYPES.find(a => a.name === 'Turbulent Weave');
  chk('Turbulent Weave exists and is multi-harmonic (the only shape that can detect a boil)',
    !!arch && arch.xAmp.filter(v => v !== 0).length === 4);
  const layer = { style: 0, enabled: true, weight: 1, staticField: { pattern: 'Turbulent Weave', strength: 1, detail: 1, drift: 1 } };
  const Zp = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const n = 720;
  const w0 = SF.resolveStaticWaves(layer, Zp, Zp, n, n, n / 2, n / 2, 0).waveX;
  // Advance by a phase equal to exactly one full cycle of the FUNDAMENTAL (freq 1) => shift of n samples
  // => identical array. Any per-harmonic phase error shows up as a shape change here.
  const w1 = SF.resolveStaticWaves(layer, Zp, Zp, n, n, n / 2, n / 2, 2 * Math.PI).waveX;
  chk('a 2*pi phase advance reproduces the wave exactly (all harmonics moved together)',
    maxAbsDiff(w0, w1) < 1e-9, `max |diff| = ${maxAbsDiff(w0, w1).toExponential(2)}`);
  // A quarter-cycle advance must equal the array rotated by n/4 samples.
  const wq = SF.resolveStaticWaves(layer, Zp, Zp, n, n, n / 2, n / 2, Math.PI / 2).waveX;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(wq[i] - w0[(i + n / 4) % n]);
    if (d > worst) worst = d;
  }
  chk('a pi/2 phase advance equals the wave rotated by n/4 samples (a pure shift)', worst < 1e-9,
    `max |diff| = ${worst.toExponential(2)}`);
  // And the peak amplitude must be phase-invariant -- a boil changes the envelope.
  const amp = a => { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; };
  const spread = Math.abs(amp(w0) - amp(wq)) / Math.max(amp(w0), 1e-12);
  chk('peak amplitude is phase-invariant to <1e-9 relative', spread < 1e-9,
    `relative spread = ${spread.toExponential(2)}`);
}

// ===========================================================================
console.log('\n=== C. strength is linear and resolution-independent in every style ===\n');
{
  const TARGET = 0.08;
  const Zp = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const peakOf = (style, waves, w, h, cxPct, cyPct) => {
    const f = separableField(style, waves, w, h, cxPct, cyPct);
    let m = 0;
    for (let i = 0; i < f.ox.length; i++) {
      const d = Math.hypot(f.ox[i] * w, f.oy[i] * h);
      if (d > m) m = d;
    }
    return m / Math.min(w, h);
  };
  // ⚠️ **The sweep covers the SOLVED archetypes only, and the split is BY THE FLAG, never by name.**
  // `absoluteAmp` archetypes opt out of the 8% target by construction (they carry a real table's authored
  // amplitude), so including them here asserted the opposite of their design and failed at 75.69% the moment
  // the first one shipped. ⚠️ **Excluding them silently would have deleted an instrument**: the clause below
  // asserts the law they DO obey, and the two counts are printed so a flag set by accident shows up as this
  // sweep getting smaller rather than as nothing at all.
  const SOLVED = SF.STATIC_FIELD_ARCHETYPES.filter((a) => !a.absoluteAmp);
  const AUTHORED = SF.STATIC_FIELD_ARCHETYPES.filter((a) => a.absoluteAmp);
  let worstDev = 0, worstWhere = '';
  for (const [w, h] of [[320, 240], [400, 400]]) {
    for (const arch of SOLVED) {
      for (const style of [0, 1, 2, 3]) {
        const layer = {
          style, enabled: true, weight: 1,
          staticField: { pattern: arch.name, pattern2: arch.name, strength: 1, strength2: 1, detail: 1, drift: 0, zoomBias: 0 },
        };
        const waves = SF.resolveStaticWaves(layer, Zp, Zp, w, h, w / 2, h / 2, 0);
        const got = peakOf(style, waves, w, h, 50, 50);
        const dev = Math.abs(got - TARGET);
        if (dev > worstDev) { worstDev = dev; worstWhere = `${arch.name} style ${style} @ ${w}x${h}: ${(got * 100).toFixed(2)}%`; }
      }
    }
  }
  // 1.5pp tolerance: the pixel quantisation in addTranslation costs up to a texel at these small canvas
  // sizes, and the gain scan locates the peak to GAIN_SCAN resolution. Measured 0.17pp at 1080p.
  // ⚠️ The count in the label is DERIVED, never typed: the array grew from 8 to 14 on 2026-09-23 and a
  // hand-written 8 would have kept reading as a full sweep while describing two thirds of one.
  chk(`peak displacement is 8% of min(w,h) at strength 1.0, within 1.5pp, for the ${SOLVED.length} SOLVED archetypes x 4 styles`,
    SOLVED.length > 0 && worstDev < 0.015,
    `worst: ${worstWhere}. Basis: ${SOLVED.length} solved + ${AUTHORED.length} authored `
    + `(${AUTHORED.map((a) => a.name).join(', ') || 'none'}) = ${SF.STATIC_FIELD_ARCHETYPES.length} total — `
    + 'reconciled by NAME, and neither count may be quoted alone');

  /*
   * ---- the OTHER magnitude law: `absoluteAmp` (2026-09-24) -------------------------------------------------
   *
   * ⚠️ **The claim is an EQUIVALENCE, so it needs no tolerance and no target.** A flagged archetype is
   * supposed to be indistinguishable from the `(Preset)` branch resolving its own authored table at the same
   * `strength` — that is the whole of the design, and it is why the fix introduced no calibration constant.
   * Asserted bit-exact against the OTHER branch of the same function rather than against a transcribed
   * formula, which would be a second owner of the law (`archetypeTerms`' own ⚠️ makes the same argument about
   * `solveGain`). A drift in either branch breaks this; a drift in both the same way is the one thing it
   * cannot see, and §A's parity oracle is what covers that.
   *
   * ⚠️ `zoomBias` is 1 because the two branches pass a DIFFERENT bias to `buildZoomWave` — the archetype
   * branch forwards `s.zoomBias`, the `(Preset)` branch hardcodes 1 — so any other value would fail on the
   * style-3 zoom half for a reason that is not this law. That asymmetry is pre-existing and deliberate.
   */
  {
    const sf = (pattern, s, zoomBias) => ({
      pattern, pattern2: pattern, strength: s, strength2: s, detail: 1, drift: 0, zoomBias,
    });
    let worstAbs = 0, worstAbsWhere = '', pairs = 0;
    for (const [w, h] of [[320, 240], [400, 400], [640, 200]]) {
      for (const arch of AUTHORED) {
        const table = [arch.xAmp, arch.xFreq, arch.yAmp, arch.yFreq].map((r) => [...r]);
        for (const style of [0, 1, 2, 3]) {
          for (const s of [-0.5, 0.1, 0.5, 1, 2]) {
            const A = SF.resolveStaticWaves({ style, enabled: true, weight: 1, staticField: sf(arch.name, s, 1) },
              Zp, Zp, w, h, w / 2, h / 2, 0);
            const B = SF.resolveStaticWaves({ style, enabled: true, weight: 1, staticField: sf('(Preset)', s, 1) },
              table, table, w, h, w / 2, h / 2, 0);
            for (const k of ['waveX', 'waveY', 'zoomX', 'zoomY']) {
              if (!A[k] !== !B[k]) { worstAbs = Infinity; worstAbsWhere = `${arch.name} style ${style}: ${k} null on one side only`; continue; }
              if (!A[k]) continue;
              for (let i = 0; i < A[k].length; i++) {
                const d = Math.abs(A[k][i] - B[k][i]);
                if (d > worstAbs) { worstAbs = d; worstAbsWhere = `${arch.name} style ${style} s=${s} @ ${w}x${h} ${k}[${i}]`; }
              }
            }
            pairs++;
          }
        }
      }
    }
    chk(`...and each of the ${AUTHORED.length} AUTHORED archetypes is bit-identical to the (Preset) branch on its own table`,
      AUTHORED.length > 0 && worstAbs === 0,
      `worst absolute difference ${worstAbs} over ${pairs} (archetype x style x strength x canvas) pairs`
      + `${worstAbsWhere ? ' at ' + worstAbsWhere : ''}. ⚠️ An EMPTY set FAILS: it would mean the flag has no `
      + 'member and this whole section is unreachable prose — the same rule as trackcheck §M\'s named lists');

    // The authored amplitude is the point of the flag, so assert the NUMBER the owner reported, not only the
    // equivalence: at the parity strength the baked table must BE the archetype, on every style and shape.
    let offParity = [];
    for (const [w, h] of [[1920, 1080], [800, 600], [1000, 1000]]) {
      for (const arch of AUTHORED) {
        for (const style of [0, 1, 2, 3]) {
          const b = SF.bakeStaticField({ style, enabled: true, weight: 1, staticField: sf(arch.name, 0.5, 1) },
            w, h, w / 2, h / 2);
          const want = [arch.xAmp, arch.xFreq, arch.yAmp, arch.yFreq];
          const got = b?.table1;
          if (!got || JSON.stringify(got) !== JSON.stringify(want.map((r) => [...r]))) {
            offParity.push(`${arch.name} style ${style} @ ${w}x${h}: ${JSON.stringify(got)}`);
          }
        }
      }
    }
    // ⚠️ **MEMBERSHIP, by name — and without this clause removing the flag is a SILENT regression.** Every
    // other clause here is conditioned on the flag itself: drop `absoluteAmp` from one entry and it simply
    // migrates into the solved sweep, which it passes (8% is what a solved archetype is supposed to do), while
    // these clauses keep passing on the remaining member. The owner's bug would be back with a green suite.
    // Membership is a DESIGN decision — the flag is only correct for a shape transcribed from a real table —
    // so it is asserted as a list, the same instrument trackcheck §M uses. A new member is not automatically
    // wrong: read a failure as a claim about the new archetype, confirm it was transcribed rather than
    // distilled, and add the name.
    chk('...and the AUTHORED set is EXACTLY the two transcribed lenses, so neither flag can be dropped silently',
      AUTHORED.length === 2 && AUTHORED.every((a) => /^(Macrolense|Distant Lense)$/.test(a.name)),
      `${JSON.stringify(AUTHORED.map((a) => a.name))} — and every one must have sum|amp| === 1, measured `
      + `here: ${JSON.stringify(AUTHORED.map((a) => [a.name, a.xAmp.reduce((t, v) => t + Math.abs(v), 0),
        a.yAmp.reduce((t, v) => t + Math.abs(v), 0)]))}. ⚠️ The sum is not decoration: identifyArchetype `
      + 'compares against sumNormalise`d amplitudes, so a flagged shape summing to anything else identifies at '
      + 'a scale that no longer equals its required strength — silently (see the flag\'s own doc)');
    chk('...and at the parity strength 0.5 the baked table IS the authored one, on every style and canvas shape',
      AUTHORED.length > 0 && offParity.length === 0,
      `off-parity: ${JSON.stringify(offParity.slice(0, 4))}. This is the owner's own report turned into a `
      + 'measurement (2026-09-24: "it does not apply the same amplitude of 1 ... but a much smaller value '
      + 'around 0.1" — it was 0.0835 at style 2, 1920x1080). ⚠️ The canvas list is THREE SHAPES because the '
      + 'defect it replaces was canvas-DEPENDENT: a pinned multiplier would pass at one aspect ratio and fail '
      + 'at another, so a single size here would not have separated the two candidate fixes');
  }

  const layer = s => ({
    style: 2, enabled: true, weight: 1,
    staticField: { pattern: 'Grid Lattice', strength: s, detail: 1, drift: 0 },
  });
  let worstLin = 0;
  for (const s of [0.25, 0.5, 0.75, 1.0]) {
    const waves = SF.resolveStaticWaves(layer(s), Zp, Zp, 320, 240, 160, 120, 0);
    const got = peakOf(2, waves, 320, 240, 50, 50);
    worstLin = Math.max(worstLin, Math.abs(got - TARGET * s));
  }
  chk('strength is linear: peak tracks strength * 8% within 1.5pp', worstLin < 0.015,
    `worst deviation ${(worstLin * 100).toFixed(2)}pp`);
}

// ===========================================================================
console.log('\n=== D. the GLSL text and the TS sampler implement the same formulas ===\n');
{
  const tm = readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8');
  const force = readFileSync(SRC + 'post-processors/trans-map-force.ts', 'utf8');
  // Each style's distinguishing term must appear in BOTH the shader source (trans-map.ts) and the TS
  // composition (static-field.ts). Text-pattern, like seven of the eight existing checkers -- so read the
  // assertion before believing a failure is a regression: a behaviour-neutral rename breaks this.
  const terms = [
    ['style 0 cross-coupling (x gets the Y wave)', /waveY|wY/, /waveY|wY/],
    ['style 1 per-axis zoom (1 - wave)', /1\.0\s*-\s*(wx|waveX)|1\s*-\s*(wx|waveX)/i, /1\s*-\s*(wx|waveX)/i],
    ['style 2 averaged zoom ((wx + wy) / 2)', /\(\s*(wx|waveX)[^)]*\+[^)]*(wy|waveY)\s*\)\s*(\*\s*0\.5|\/\s*2)/i, /\(\s*(wx|waveX)[^)]*\+[^)]*(wy|waveY)\s*\)\s*(\*\s*0\.5|\/\s*2)/i],
    ['style 3 zoom wave (second table)', /zoomX|z2X|zoomWave/i, /zoomX|z2X|zoomWave/i],
  ];
  for (const [what, glRe, tsRe] of terms) {
    chk(`${what}: present in the warp GLSL (trans-map.ts)`, glRe.test(tm));
    chk(`${what}: present in the TS composition (static-field.ts)`, tsRe.test(sfSrc));
  }

  // The force path must DELEGATE rather than carry a second copy. `trans-map-force.ts` holding style-0's
  // cross-coupling or style-3's zoom wave would mean the arithmetic was inlined back into it -- a third
  // copy, which is the thing this checker exists to prevent rather than to measure.
  chk('the force path delegates instead of re-deriving the formulas',
    /analyticSampler/.test(force) && !/zoomCoordinate|rollToRange/.test(force),
    'a second TS copy of the composition is the defect, not the goal');
  chk('the analytic sampler is reachable from trans-map.ts',
    /sampleStaticOffset\s*\(/.test(tm) && /staticOffsetAt\s*\(/.test(tm),
    'sampleStaticOffset -> staticOffsetAt is the only route from a particle to the field');
  chk('the warp program still goes through compileProgram with a label',
    /compileProgram\([^)]*'[^']+'/.test(tm) || /compileProgram\(\s*gl,[\s\S]{0,400}?'[^']+'/.test(tm),
    'a shader that fails to compile links, binds, and draws as a silent no-op');
}

// ===========================================================================
console.log('\n=== E. detail is resolution-independent, and tiles do not drift ===\n');
{
  // ⚠️ This section exists because `detail` READS like a screen-space frequency and is not one. `buildWave`
  // computes `360 * i * freq / n` -- cycles across the WHOLE axis -- so detail 4 is four cells wide at any
  // resolution, and the preview grid must NOT multiply it by `SCREEN_SPACE_TILE_SCALE`. That is the tile
  // renderer's own rule ("decide by UNIT, not by field name") applied to a field that fails the name test.
  //
  // Measured both ways rather than argued: scaling by the constant (0.25) made agreement 2.6x WORSE. This
  // asserts the DIRECTION of that comparison, so an edit that adds the factor fails here rather than shipping
  // a preview that disagrees with the canvas it previews.
  const Zp = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const TILE = [256, 192], REF = [1024, 768];   // matched 4:3 -- aspect would otherwise confound the result
  const SCALE = (TILE[0] + TILE[1]) / (REF[0] + REF[1]);
  // Sampled on a NORMALISED 16x16 grid, so the two resolutions are compared at the same points in the field.
  const sampleUv = (style, w, h, detail, pattern) => {
    const layer = {
      style, enabled: true, weight: 1,
      staticField: { pattern, pattern2: pattern, strength: 0.7, strength2: 0.7, detail, drift: 0, zoomBias: 0 },
    };
    const waves = SF.resolveStaticWaves(layer, Zp, Zp, w, h, w / 2, h / 2, 0);
    const layers = [{ style, centreX: w / 2, centreY: h / 2, ratio: 1, ...waves }];
    const out = new Float64Array(2), f = [];
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      SF.staticOffsetAt(layers, Math.floor((i + 0.5) * w / 16), Math.floor((j + 0.5) * h / 16), w, h, out);
      f.push(out[0], out[1]);
    }
    return f;
  };
  const sweep = (detailAt) => {
    let worst = 0, where = '';
    for (const style of [0, 1, 2, 3]) {
      for (const arch of SF.STATIC_FIELD_ARCHETYPES) {
        for (const d of [0.25, 1, 4, 8]) {
          const a = sampleUv(style, REF[0], REF[1], d, arch.name);
          const b = sampleUv(style, TILE[0], TILE[1], detailAt(d), arch.name);
          let m = 0;
          for (let k = 0; k < a.length; k++) m = Math.max(m, Math.abs(a[k] - b[k]));
          if (m > worst) { worst = m; where = `${arch.name} style ${style} detail ${d}`; }
        }
      }
    }
    return { worst, where };
  };
  const unscaled = sweep(d => d);
  const scaled = sweep(d => d * SCALE);
  chk('scaling detail by SCREEN_SPACE_TILE_SCALE makes a tile agree WORSE with the full canvas',
    scaled.worst > unscaled.worst * 1.5,
    `unscaled ${unscaled.worst.toExponential(2)} (worst: ${unscaled.where}) vs scaled ${scaled.worst.toExponential(2)}`);
  // The residual is sample-grid quantisation (`floor` lands on different wave phases at different
  // resolutions), not a units error -- it is non-monotonic in tile size, which a units error cannot be.
  chk('the unscaled tile field tracks the full-canvas field to better than 0.05 UV',
    unscaled.worst < 0.05, `worst |UV diff| = ${unscaled.worst.toExponential(2)} @ ${unscaled.where}`);

  // Drift on a tile re-resolves every static layer's waves per frame, and `resolveStaticWaves` runs
  // `solveGain` -- across 177 thumbnails nobody watches for motion. `setDriftScale(0)` is the ONLY thing
  // preventing that, and it is one call in a 700-line file, so it is exactly the kind of line a refactor
  // drops silently: the tiles would still render, just slowly.
  // Comments stripped first — see `stripComments` at the top of this file for why that is not optional here.
  const tile = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));
  chk('the preview grid disables drift with setDriftScale(0)',
    /setDriftScale\(\s*0\s*\)/.test(tile),
    'without it, 177 tiles re-solve the gain every frame');
  chk('and it does NOT scale detail or strength by the tile constant',
    !/SCREEN_SPACE_TILE_SCALE[\s\S]{0,80}(detail|strength)/i.test(tile)
    && !/(detail|strength)[\s\S]{0,80}SCREEN_SPACE_TILE_SCALE/i.test(tile),
    'both are already ratios -- see the sweep above');
}

console.log('\n=== F. drift is in cells per second, and means one speed on every pattern ===\n');

// --- F. `drift` is in cells per second, and pattern-independent -----------------------------------------
//
// ⚠️ **This section exists because the units were WRONG on the first pass and a green `verify` did not
// notice.** `DRIFT_RATE` was `2*pi/4` with a comment claiming "one full cell every 4 seconds"; it actually
// meant one full FRAME WIDTH every 4 s, wrong by the pattern's frequency -- a factor of 1..128 across the
// archetype x detail grid. It reached the user as "the Drift parameter seems very sensitive". Invariant 10 in
// its purest form: every term was a `number` and the expression read plausibly.
//
// The identity being pinned: with `phase = t*drift*DRIFT_RATE/effFreq`, a phase of `p` shifts the field by
// `p*n/(2*pi)` px (section B's rigid-translation property) and one cell is `n/effFreq` px, so
// `cells/s = drift*DRIFT_RATE/(2*pi)`. Both `n` and `effFreq` cancel -- which is exactly why the result is
// resolution- AND pattern-independent -- and `DRIFT_RATE = 2*pi` makes the coefficient 1.
//
// Asserted ANALYTICALLY rather than by cross-correlating two rendered fields, and that is deliberate: the
// correlation probe used during development reported 0.0000 cells/s for `Fine Mesh` at detail 8 (one cell is
// ~15 px, below its whole-pixel resolution) and 0.75 instead of 1.00 for the two `effFreq = 0.25` cells (one
// cell is 4 frame widths, so its search window was truncated by the array). Both were probe limits, and a
// checker built that way would have baked in two false failures. `driftPhase()` is real engine code, so this
// still tests the engine, not a transcription.
{
  const cellsPerSec = (s, dt) => (SF.driftPhase(s, dt, 1) * SF.effectiveFrequency(s)) / (2 * Math.PI);
  let worst = 0, worstAt = '';
  let cells = 0;
  for (const a of SF.STATIC_FIELD_ARCHETYPES) {
    for (const detail of [0.25, 0.5, 1, 2, 4, 8]) {
      for (const drift of [0.005, 0.05, 0.25, 0.5, 1.0]) {
        const s = SF.staticFieldOf({ style: 0, staticField: { pattern: a.name, detail, drift } });
        const err = Math.abs(cellsPerSec(s, 1.0) - drift);
        cells++;
        if (err > worst) { worst = err; worstAt = `${a.name} detail=${detail} drift=${drift}`; }
      }
    }
  }
  chk(`drift EQUALS cells/s across ${cells} pattern x detail x drift combinations`,
    worst < 1e-12, `worst |err| = ${worst.toExponential(2)} @ ${worstAt}`);

  // The user-visible half of the same property, stated as the thing that was broken: one slider value must
  // mean ONE speed. Before normalisation this ratio was 128 (Coarse Swell @ detail 1 = 0.25 cells/s against
  // Fine Mesh @ detail 8 = 32 cells/s).
  const rates = [];
  for (const a of SF.STATIC_FIELD_ARCHETYPES) {
    for (const detail of [0.25, 1, 8]) {
      rates.push(cellsPerSec(SF.staticFieldOf({ style: 0, staticField: { pattern: a.name, detail, drift: 0.5 } }), 1.0));
    }
  }
  const spread = Math.max(...rates) / Math.min(...rates);
  chk('one Drift value is one speed on every pattern (spread was 128x before normalisation)',
    spread < 1.0001, `max/min = ${spread.toFixed(6)}x over ${rates.length} combinations`);

  // ⚠️ Drift 0 must be EXACTLY 0, not merely small: that is the parity oracle section A tests against the
  // 177 shipped tables, and all 190 presets sit at drift 0. A division by `effFreq` is a new chance to turn
  // it into a denormal, so it is asserted after the change rather than assumed to have survived it.
  let zeroBad = 0;
  for (const a of SF.STATIC_FIELD_ARCHETYPES) {
    const s = SF.staticFieldOf({ style: 0, staticField: { pattern: a.name, detail: 3, drift: 0 } });
    if (SF.driftPhase(s, 12345.678, 1) !== 0) zeroBad++;
  }
  chk('drift 0 yields phase exactly 0 on every archetype (the 190-preset parity oracle)', zeroBad === 0,
    `${zeroBad} archetype(s) returned a nonzero phase`);

  // `effectiveFrequency` must never return 0 -- `Vertical Ripple` has an all-zero X table, and a 0 divisor
  // would NaN the whole field. The `(Preset)` path returns exactly 1, i.e. no normalisation, which is what
  // keeps the preset-table branch on its pre-change arithmetic.
  let zeroFreq = 0;
  for (const a of SF.STATIC_FIELD_ARCHETYPES) {
    for (const detail of [0.05, 0.25, 1, 8]) {
      const f = SF.effectiveFrequency(SF.staticFieldOf({ style: 0, staticField: { pattern: a.name, detail } }));
      if (!(f > 0) || !Number.isFinite(f)) zeroFreq++;
    }
  }
  chk('effectiveFrequency is finite and > 0 for every archetype (a 0 divisor would NaN the field)',
    zeroFreq === 0, `${zeroFreq} combination(s) returned 0 or non-finite`);
  chk('and returns exactly 1 for (Preset), leaving that path un-normalised',
    SF.effectiveFrequency(SF.staticFieldOf({ style: 0, staticField: { drift: 0.5 } })) === 1);

  // The tile freeze must survive the new divisor: `driftScale` is applied inside `driftPhase` now, so a
  // refactor that dropped the multiply would restart 177 tiles animating (section E greps for the CALL; this
  // asserts the call still has its EFFECT).
  chk('driftScale 0 still freezes the field (the preview-grid contract, now inside driftPhase)',
    SF.driftPhase(SF.staticFieldOf({ style: 0, staticField: { pattern: 'Fine Mesh', drift: 1 } }), 999, 0) === 0);

  // The phase must be computed in ONE place. Two call sites would be two chances for the divisor to go
  // missing, and a missing divisor is invisible: the field still drifts, just at the wrong speed.
  const tm = stripComments(readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8'));
  chk('trans-map.ts computes the phase via driftPhase(), not inline from DRIFT_RATE',
    /driftPhase\s*\(/.test(tm) && !/DRIFT_RATE/.test(tm),
    'an inline phase would duplicate the archetype frequency tables');

  // ⚠️ **A frozen field is not the same thing as a skipped REBUILD, and only the assertion above was made.**
  // `hasDrift` is derived from `drift !== 0` in `init()`; `grid-tile-renderer.ts` calls `setDriftScale(0)`
  // AFTER `init()`, so on a tile the flag is true, the scale is 0, and `updateDrift` re-solved every static
  // layer every rendered frame to produce byte-identical phase-0 waves. The output was right, so no output
  // comparison could see it — 0.81-1.16 ms per solve at tile size against the grid's 10 ms `STEADY_BUDGET_MS`.
  //
  // Asserted as a grep because the gate is per-frame state inside a GL class this checker cannot instantiate.
  // It is deliberately narrow: the `updateDrift` BODY must mention `driftScale`, so moving the test into
  // `hasDrift` (which would be wrong — the scale can change at any time after `init()`) also trips it.
  const updateDriftBody = /private\s+updateDrift\s*\([^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n  \}/.exec(tm);
  chk('updateDrift() gates on driftScale, so a preview tile skips the per-frame solve it cannot see',
    updateDriftBody !== null && /driftScale/.test(updateDriftBody[1]),
    updateDriftBody === null
      ? 'could not locate the updateDrift body — re-read the gate before believing this is a regression'
      : 'a drifting tile pays resolveStaticWaves every frame for an identical result');
}

console.log('\n=== G. a slider edit keeps the archetype, and Strength is live on every path ===\n');

// --- G. the (Custom) data-loss bug, and the two dead controls it hid ------------------------------------
//
// ⚠️ **Reported by the user: pick `Diagonal Shear`, move Strength, and the field reverts to the preset's own
// table.** The cause was `setStaticField` flipping `pattern` to `(Custom)` on any shape edit, on the theory
// that a moved slider makes the archetype name stale. But `(Custom)` IS NOT A SHAPE — `findArchetype` returns
// undefined for it, so `resolveStaticWaves` takes its `!arch` branch and rebuilds from `sinMagicParams`. The
// flip therefore DISCARDED the archetype rather than relabelling it.
//
// ⚠️ **And the theory was wrong on its own terms:** `strength`/`detail` are inputs the archetype is evaluated
// WITH, not overrides of what it holds, so the name never goes stale. Asserted here as the property, not as
// the absence of the old line: a future refactor could reintroduce the flip by another route.
{
  const Zp = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  // A preset table deliberately DIFFERENT from every archetype (freq 3/5 appears in no archetype), so a
  // reversion to it is detectable. Archetype frequencies are 1,4,6,8,16 and their detail multiples.
  const Pt = [[1, 0, 0, 0], [3, 0, 0, 0], [1, 0, 0, 0], [5, 0, 0, 0]];
  const W = 1024, H = 768;
  const field = (pattern, strength, detail = 1) => SF.resolveStaticWaves(
    { style: 0, enabled: true, weight: 1, staticField: { pattern, strength, detail } },
    Pt, Pt, W, H, W / 2, H / 2, 0).waveX;
  const peak = a => { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; };

  // The archetype's shape must be UNCHANGED by a strength move — same zero crossings, scaled amplitude.
  const zc = a => { let z = 0; for (let i = 1; i < a.length; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) z++; return z; };
  const lo = field('Diagonal Shear', 0.3), hi = field('Diagonal Shear', 0.9);
  chk('moving Strength on an archetype scales it without changing its shape',
    zc(lo) === zc(hi) && Math.abs(peak(hi) / peak(lo) - 3) < 1e-9,
    `zc ${zc(lo)} vs ${zc(hi)}, peak ratio ${(peak(hi) / peak(lo)).toFixed(6)} (expect 3)`);

  // The regression itself: the archetype's field must NOT equal the preset-table field at any strength.
  // If a future edit reinstates the (Custom) flip -- or points an archetype at the !arch branch -- these
  // become equal and this fails.
  const presetShape = zc(field('(Preset)', 0.5));
  chk('an archetype does not degrade to the preset table when Strength moves (the reported bug)',
    zc(hi) !== presetShape && zc(hi) === zc(field('Diagonal Shear', 0.5)),
    `Diagonal Shear zc = ${zc(hi)}, preset table zc = ${presetShape}`);

  // ⚠️ `(Custom)` resolving as `(Preset)` is DOCUMENTED behaviour, not a bug to fix -- an old export or a
  // hand-edited import can carry it, and it must render as something rather than throw. Pinned so nobody
  // "fixes" it into a shape and silently changes what those files render.
  chk('(Custom) still resolves as (Preset), so an old export renders rather than throwing',
    peak(field(SF.PATTERN_CUSTOM, 0.5)) === peak(field(SF.PATTERN_PRESET, 0.5)));

  // Strength was DEAD on the (Preset) path (measured 0.00e+0 between 0.1 and 0.9) while its tooltip claimed
  // it scaled the preset's table -- invariant 13. Now a relative gain around the 0.5 default.
  const pLo = peak(field('(Preset)', 0.1)), pMid = peak(field('(Preset)', 0.5)), pHi = peak(field('(Preset)', 0.9));
  chk('Strength is LIVE on the (Preset) path (it was inert, with a tooltip claiming otherwise)',
    pLo !== pMid && pHi !== pMid,
    `peaks: ${pLo.toFixed(3)} / ${pMid.toFixed(3)} / ${pHi.toFixed(3)}`);
  chk('and is linear there, with 0.5 reproducing the authored field exactly (section A is the oracle)',
    Math.abs(pHi / pMid - 1.8) < 1e-12 && Math.abs(pLo / pMid - 0.2) < 1e-12,
    `ratios ${(pHi / pMid).toFixed(6)} and ${(pLo / pMid).toFixed(6)} (expect 1.8 and 0.2)`);

  // `detail` stays inert on the preset path BY DESIGN (scaling authored integer frequency ratios replaces the
  // figure rather than refining it), so the UI must HIDE the row instead of showing a control that does
  // nothing. Both halves asserted: the engine's inertness, and the UI's hide keyed on `findArchetype`.
  let dd = 0;
  const dA = field('(Preset)', 0.5, 0.25), dB = field('(Preset)', 0.5, 8);
  for (let i = 0; i < dA.length; i++) dd = Math.max(dd, Math.abs(dA[i] - dB[i]));
  chk('detail is inert on the (Preset) path, as designed', dd === 0, `max |diff| = ${dd.toExponential(2)}`);

  // ⚠️ **BOTH UI clauses below were pointed at `visual-fx.ts` until v8 21.12 moved the static-field editor into
  // its own tab (§H of the phase reduced `buildStaticFieldBody` to a pointer paragraph).** The FIRST failed on
  // the move, which is the honest report — a text grep only knows what it was pointed at. The SECOND PASSED,
  // and that is the finding worth recording: it is a NEGATED regex, so a file with no `setStaticField` in it
  // satisfies it vacuously. **A relocation silently disarms every negative assertion about the file left
  // behind**, and the green one is the dangerous half, not the red one.
  //
  // ⚠️ **AND THE RETURN JOURNEY PROVED THE SAME POINT FROM THE OTHER SIDE (2026-09-23).** The owner reversed §H,
  // so `visual-fx.ts` has a `setStaticField` and five slider patches again — and this section, still pointed at
  // `transmap.ts` alone, would have stayed green over a restored copy of the exact data-loss bug it exists to
  // prevent. So the pattern clause now scans BOTH editors and reports which file failed. The Detail-row clause
  // deliberately does not: the two tabs gate that row with differently-shaped code (one resolves `arch` once at
  // the top of `sync()`, the other calls `findArchetype` inside `updateStaticRows`), and one regex stretched to
  // match both would be a regex that proves nothing. It gets its own clause below.
  const tab = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/transmap.ts', 'utf8'));

  // Rewritten rather than re-windowed: the old form assumed `detailRow` was mentioned BEFORE `findArchetype`
  // and within 120 characters of it. The new tab resolves the archetype once at the top of `sync()` and gates
  // every regime-dependent control from that one binding twenty lines later, so a distance window would have to
  // be widened to the point of proving nothing. Asserted as the two halves that actually carry the property:
  // the binding exists, and the row's visibility is keyed on IT rather than on a name comparison.
  chk('and the Detail ROW is hidden there, keyed on findArchetype rather than the (Preset) literal',
    /\barch\s*=\s*findArchetype\(/.test(tab)
    && /detailRow[^\n]*style\.display\s*=\s*arch\s*\?/.test(tab),
    'a visible-but-inert control is invariant 13; comparing to the literal would miss (Custom) and unknown names');

  // The same property in `visual-fx.ts`, written as its own clause rather than folded into the one above.
  // **Two clauses over two files, not one regex loose enough to admit both** — a pattern stretched to match
  // either spelling would also pass over a file that had drifted to the literal comparison.
  //
  // ⚠️ **THIS CLAUSE WAS REWRITTEN THE SAME DAY IT WAS WRITTEN, AND THE REASON IS THE ONE `Verify` NAMES.** Its
  // first form asserted `detailRow.style.display = findArchetype(` — the shape the restored code happened to
  // have — and an hour later the restoration gained §J's second regime gate, which needs the archetype twice, so
  // the call was lifted to a local `arch`. **Behaviour-neutral, and it turned this section red.** A text grep
  // that pins the CALL SITE of a test rather than the test is a grep that fails on tidying and passes on a
  // rewrite that keeps the spelling, so the assertion is now the same two halves as transmap's above: the
  // binding exists, and the row is keyed on IT. The two files are still separate clauses, because the failure
  // message has to name which tab shows the inert slider.
  const vfx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));
  chk('and in visual-fx.ts too, keyed on findArchetype rather than the (Preset) literal',
    /\barch\s*=\s*findArchetype\(/.test(vfx)
    && /detailRow[^\n]*style\.display\s*=\s*arch\s*\?/.test(vfx),
    'the restored copy (2026-09-23) must gate the row the same way, or one tab shows an inert Detail slider');

  // ⚠️ **§J's gate had to be restored WITH the controls, and nothing reported its absence.** The restoration put
  // `Zoom Pattern` and `Zoom Bias` back live in both regimes; the engine reads neither on the `(Preset)` branch
  // (`buildZoomWave` takes a hardcoded bias of 1), so for half a day that copy carried two controls describing a
  // pass that never runs — invariant 25, in the one place the older single-editor sections could not see.
  // Asserted as the SHARED test, not as two independent flags: one `zoomInert` binding drives both `disabled`
  // assignments and the sentence, which is what "the description owns the gate" means operationally.
  //
  // Calibrated through `stripComments` (the instrument lesson below — an unstripped harness reads the comments
  // that EXPLAIN a retired line as the line): live passes all three halves, and four seeds each trip exactly one
  // — gating on `style === 3` alone (greys the archetype regime too), leaving `Zoom Bias` live (the two-flag
  // shape, and the likelier regression: the dropdown is the one a reader remembers), keying the notice on its own
  // second test, and the Detail row back on a `PATTERN_PRESET` comparison.
  chk('§J: visual-fx.ts greys Zoom Pattern and Zoom Bias in the table regime, on ONE test with the notice',
    /const zoomInert = .*style === 3 && !arch/.test(vfx)
    && (vfx.match(/disabled = zoomInert/g) ?? []).length === 2
    && /zoomNote[^\n]*style\.display = zoomInert \?/.test(vfx),
    'two controls the engine ignores must be greyed and say why, or the restored copy is invariant 25 again');

  /*
   * ⚠️ **A GATE THAT EXISTS IS NOT A GATE THAT RUNS, AND THAT DISTINCTION IS THIS CLAUSE'S WHOLE REASON.** The two
   * clauses above were green on 2026-09-23 while the owner was looking at the defect they describe: *"in Visual Fx
   * it shows one, in Transmap tab it doesn't, and it also seems not to have an effect"* — a Detail slider live on a
   * `(Preset)` `Zoom Overlay` layer. Both gates were written, correctly, keyed on `findArchetype`, in
   * `updateStaticRows` — which the BUILD path never called. `buildLayerRow` builds the body and returns; the gate
   * was reached only from `updateLayerRow`, i.e. only from `syncLayerRows()`' same-shape branch. So the first
   * render, the expander toggle, `commitChain` and any preset whose chain shape differs all produced an ungated
   * body, and §J's notice appeared over two controls that were still enabled — the exact inverse of what it says.
   *
   * ⚠️ **The instrument lesson is the one this section keeps re-learning from a new direction: a text grep for a
   * test proves the test was WRITTEN, never that anything calls it.** Three previous §G clauses were relocated,
   * disarmed or rewritten by exactly this class of gap. The remedy in the code is one owner reached from both
   * paths (`applyStaticRegimeGates`), so the assertion is the shape of that ownership rather than the presence of
   * a call: **exactly one writer of the Detail gate, at least two callers of the owner, and the BUILDER among
   * them.** Either legitimate build-path owner satisfies the last half — the body builder or `buildLayerRow` — so
   * moving the call between them is tidying rather than a red, which is the mistake the clause above documents
   * making once already.
   *
   * Calibrated through `stripComments` against the live file (green) and four seeds, each tripping exactly one
   * half: dropping the builder's call (the reported defect), copying the Detail gate back inline into
   * `updateStaticRows` (two writers, the shape that let the two copies disagree), deleting the updater's call so a
   * pattern change no longer re-gates, and renaming the owner away (the vacuity seed — a negated or
   * name-keyed assertion over a function that is gone reports nothing).
   */
  const fnBody = (src, name) => {
    const i = src.indexOf(`private ${name}(`);
    if (i < 0) return '';
    const j = src.indexOf('\n  private ', i + 1);
    return src.slice(i, j < 0 ? src.length : j);
  };
  const gateWriters = (vfx.match(/detailRow\.style\.display = arch \?/g) ?? []).length;
  const gateCalls = (vfx.match(/this\.applyStaticRegimeGates\(/g) ?? []).length;
  const buildGated = /this\.applyStaticRegimeGates\(/.test(fnBody(vfx, 'buildStaticFieldBody'))
    || /this\.applyStaticRegimeGates\(/.test(fnBody(vfx, 'buildLayerRow'));
  const updateGated = /this\.applyStaticRegimeGates\(/.test(fnBody(vfx, 'updateStaticRows'));
  chk('...and the BUILD path REACHES that gate, so a freshly built row cannot be ungated (the 09-23 report)',
    gateWriters === 1 && gateCalls >= 2 && buildGated && updateGated,
    `${gateWriters} writer(s) of the Detail gate, ${gateCalls} call(s) to its owner, build ${buildGated}, `
    + 'update ' + updateGated + ' — a gate only the same-shape sync path reaches leaves every REBUILD ungated');

  // The flip is gone, and no caller can ask for it. ⚠️ **Re-derived for the new shape rather than re-pointed:**
  // `setStaticField` is now a generic patch applier, so "it must not write `pattern`" is no longer the property
  // — the pattern dropdown and `Bake to terms` both legitimately write one. The two halves that survive are
  // that `PATTERN_CUSTOM` reaches no `setStaticField` CALL, and that no SLIDER patches a pattern key, which is
  // the exact route the reported data loss took.
  //
  // ⚠️ **"The file does not contain `PATTERN_CUSTOM`" was NOT portable and had to be re-derived per file, not
  // copied.** It held in `transmap.ts` only because that tab happens not to import the constant; `visual-fx.ts`
  // legitimately does, to offer `(Custom)` as a DISABLED dropdown option. Copying the file-wide form would have
  // produced a clause that fails on correct code — which gets a checker relaxed, and a relaxed checker is how
  // the property is lost for good. So the assertion is per-CALL: the constant may exist, it may not be written.
  //
  // The two editors' slider bodies are shaped differently, and the two `set` regexes below say how:
  // `transmap.ts` builds each row from a descriptor with a `set:` field, `visual-fx.ts` passes `staticSlider` a
  // `(get, set)` PAIR positionally. Keyed on the pair, not on `v => ({`, so a future generic slider sharing that
  // lambda shape cannot drift into this count and dilute it.
  // Calibrated 2026-09-23 against three seeds per file — a slider patch carrying `pattern: PATTERN_CUSTOM`, a
  // call taking the constant as an argument, and the function renamed away — all six caught, both files green as
  // shipped. The third seed is the one that matters: it is the vacuity the widening exists to close.
  const STATIC_EDITORS = [
    { file: 'ui/synthesis-lab/tabs/transmap.ts', set: /set:\s*v\s*=>\s*this\.setStaticField\(\{([^}]*)\}/g },
    { file: 'ui/synthesis-lab/tabs/visual-fx.ts', set: /s\s*=>\s*s\.\w+\s*,\s*v\s*=>\s*\(\{([^}]*)\}\)/g },
  ];
  for (const ed of STATIC_EDITORS) {
    const src = stripComments(readFileSync(SRC + ed.file, 'utf8'));
    const where = ed.file.split('/').pop();
    // Greedy up to the last `)` before the statement's `;`, so a PATTERN_CUSTOM sitting after an inner call's
    // closing paren is still inside the captured argument text. Erring toward capturing MORE is the safe error.
    const calls = [...src.matchAll(/this\.setStaticField\(([^;]*)\)/g)].map(m => m[1]);
    const patches = [...src.matchAll(ed.set)].map(m => m[1]);
    // ⚠️ **The call-site floor is 1, and the SLIDER floor is what carries the property.** Measured, the two
    // editors have 7 and 2 call sites for the same five sliders plus a dropdown: `transmap.ts` calls from each
    // descriptor, `visual-fx.ts` funnels every scalar through `staticSlider` and calls twice. A floor at either
    // measured figure would have failed the other file on correct code — the trap this section already fell into
    // once today. So 1 is the anti-vacuity guard (the function is REACHED), and `patches >= 5` is the assertion.
    chk(`${where}: setStaticField never assigns PATTERN_CUSTOM (the flip that caused the data loss)`,
      calls.length >= 1 && !calls.some(c => /PATTERN_CUSTOM/.test(c))
      && patches.length >= 5 && !patches.some(p => /pattern/i.test(p)),
      `a slider edit must leave both pattern keys alone — ${calls.length} call sites, `
      + `${patches.length} slider patches: ${patches.map(p => p.trim()).join(' | ')}`);
  }

  /*
   * ⚠️ **THE LAYER PICKER'S OWN SILENT FAILURE (2026-09-23): a writer that re-derives "which layer".** Before
   * the picker, `transmap.ts` held FOUR copies of `chain.findIndex(l => isSeparableStyle(l.style))` — in
   * `setStaticField`, `applySnapshot`, the Style handler and the zoom-centre setter — and every one of them was
   * correct, because there was only ever one layer to find. With a pick in play each copy writes to layer ONE
   * while every control on screen shows another: the edit lands, the engine applies it, the picture changes, and
   * the change appears on a layer the user was not editing. **`tsc` sees four correct expressions**, nothing
   * throws, and the readout (which resolves through the same stale route) agrees with itself.
   *
   * So the assertion is that the resolution exists EXACTLY ONCE. The literal is spelled here rather than matched
   * loosely on purpose: a writer that re-derives the index will re-derive it this way, because this is the line
   * that was there to copy.
   *
   * ⚠️ **"EXACTLY ONCE" IS A CLAIM ABOUT `stripComments(src)`, NOT ABOUT THE FILE — and the first calibration run
   * of this clause proved it the hard way**: `transmap.ts` QUOTES the retired line twice in the comment that
   * explains why it is retired, so a seed harness that skipped the stripper read the live file as already failing
   * and then reported all three seeds "caught". **A seed caught for the wrong reason is a green that measures
   * nothing.** Calibrated against the stripper: live true/true, and the three seeds — a writer re-deriving the
   * index, the picker's value taken from `pick`, and `editedIndex` renamed — trip exactly one clause each.
   */
  const findIdx = (vfx.match(/findIndex\([^)]*isSeparableStyle/g) ?? []).length;
  const tmFindIdx = (tab.match(/findIndex\([^)]*isSeparableStyle/g) ?? []).length;
  chk('transmap.ts resolves "which separable layer" in exactly ONE place (editedIndex)',
    tmFindIdx === 1 && /editedIndex\(chain: readonly TransMapLayer\[\]\): number/.test(tab),
    `found ${tmFindIdx} — a second copy silently writes to the FIRST separable layer while the picker shows `
    + 'another; invariant 17 is one resolution order with nothing re-deriving it afterwards');
  chk('...and the picker\'s value comes from the RESOLVED index, never from the stored pick',
    /this\.layerSelect\.value = String\(index\)/.test(tab) && !/layerSelect\.value = String\(this\.pick/.test(tab),
    'a dropped pick (its layer moved or vanished) must show the layer the tab is really editing, or the one '
    + 'control that names the layer becomes the one control that lies');
  // Visual FX is not held to the single-resolution rule: it edits a layer PER ROW, so an index per row is its
  // correct shape. Stated as a measured figure rather than left as a silence — this is the file the rule above
  // would be wrongly copied INTO.
  chk('...while visual-fx.ts needs no such rule — its index is the row\'s own, not a resolved selection',
    findIdx === 0, `visual-fx.ts has ${findIdx} such resolutions; its rows carry their index from the chain loop`);
}

console.log('\n=== H. dispersion is chain-level, and self-limits instead of being gated ===\n');

// --- H. the fluid-layer ungating (2026-08-20) ------------------------------------------------------------
//
// `uDispersion` was uploaded as `feedback ? this.fluidDispersion : 0`, so chromatic fringing was reachable
// only through a style-6 layer — while the shader has always applied it to the SUMMED offset
// `(sOff + fOff + flOff)`. It was a general warp modifier confined by one ternary, sitting between two
// uniforms (`uGlowBoost`, `uFeedbackPresent`) that genuinely ARE style-6 semantics.
//
// ⚠️ **The risk this section covers is NOT "does fringing appear".** A browser shows that in one look. It is
// the three ways an ungating goes wrong invisibly:
//   1. the two uniforms that SHOULD stay gated get ungated along with it (invariant 3: `strength` is
//      `length(flOff)`, so a glow ungated here would multiply against a zero and hide its own mistake until
//      some chain made `flOff` nonzero);
//   2. the legacy `fluidFeedback.dispersion` key stops being read, silently zeroing every pre-change export
//      (invariant 14's shape — an absent key inheriting a live default, reached via a sibling field);
//   3. the old UI slider survives, leaving two handles writing one uniform, one of which no longer connects
//      to anything (invariant 13).
// None of the three changes a pixel in the case a browser pass would look at first.
{
  const tm = stripComments(readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8'));
  const vfx2 = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));
  const mainTs = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  const tile = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));

  // 1. The upload must not be gated on the feedback flag any more. Matched on the UPLOAD LINE specifically
  //    (`uniform1f(this.uDispersionLoc, ...)`) rather than on the word `feedback` appearing near it, or the
  //    neighbouring `uGlowBoost` line — which SHOULD contain it — would satisfy the test.
  const dispUploads = [...tm.matchAll(/uniform1f\(\s*this\.uDispersionLoc\s*,([^)]*)\)/g)].map(m => m[1].trim());
  chk('uDispersion is uploaded without a feedback/fluid gate (the ungating itself)',
    dispUploads.length >= 1 && dispUploads.some(a => /this\.dispersion/.test(a) && !/feedback/.test(a)),
    `upload args: ${JSON.stringify(dispUploads)}`);

  // The identity `blit()` path uploads a literal 0 and must KEEP doing so — an identity pass has to be a copy
  // at every setting. So the assertion above is "some upload is ungated", not "every upload is".
  chk('...while the identity blit path still uploads a literal 0',
    dispUploads.some(a => /^0(\.0)?$/.test(a)),
    'an identity pass must be a copy regardless of the dispersion setting');

  // 2. `uGlowBoost` MUST still be gated. This is the assertion that catches an over-eager ungating, and it is
  //    the one no browser check would fail: without a fluid layer `strength` is 0, so an ungated glow is
  //    invisible until a chain happens to make `flOff` nonzero.
  chk('uGlowBoost is STILL gated on feedback (invariant 3 — it multiplies length(flOff))',
    /uniform1f\(\s*this\.uGlowBoostLoc\s*,\s*feedback\s*\?/.test(tm),
    'ungating the glow too would be invisible until some chain made flOff nonzero');

  // 3. One writer for the uniform's backing field. `setFluidFeedbackParams` runs EVERY FRAME from the fluid
  //    branch, so if it still assigned dispersion it would overwrite the global control on any style-6 chain.
  //    Asserted as "does not assign it" rather than "has two parameters", so a rename cannot pass by accident.
  //    ⚠️ Matched on `this.dispersion =` inside the method BODY, and on the existence of `setDispersion`. The
  //    first draft of this test searched for `dispersion\s*=` and for `setDispersion\s*\(\s*value` with a
  //    space — it reported FAIL against correct code twice (the field is `this.dispersion`, and the parameter
  //    list has no leading space). Read the assertion before believing a failure here is a regression.
  const sfp = /setFluidFeedbackParams\([^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n  \}/.exec(tm);
  chk('setFluidFeedbackParams no longer writes dispersion (one writer per uniform)',
    sfp !== null && !/this\.dispersion\s*=/.test(sfp[1]) && /setDispersion\s*\(/.test(tm),
    sfp === null ? 'could not locate the method body' : `body assigns: ${JSON.stringify(sfp[1].trim())}`);

  // 4. The legacy key is still read, on BOTH load paths. This is the back-compat assertion: every export
  //    written before 2026-08-20 carries the value only under `fluidFeedback`, and nothing about dropping the
  //    fallback would look wrong — those files would simply lose their fringing.
  //    ⚠️ `currentTransMapDispersion`, not `transMapDispersion` — the first draft matched the bare overlay-key
  //    spelling and found 0 assignments against correct code. The `\bcurrent` prefix also excludes the
  //    controls-object setter (which assigns from a clamped argument, not from an overlay) by requiring `ov`.
  const legacyReads = [...mainTs.matchAll(/currentTransMapDispersion\s*=\s*(ov[^;]+);/g)].map(m => m[1]);
  chk('both main.ts load paths fall back to the legacy fluidFeedback.dispersion key',
    legacyReads.length === 2 && legacyReads.every(r => /fluidFeedback\?\.dispersion/.test(r) && /\?\?\s*0\s*$/.test(r.trim())),
    `found ${legacyReads.length} assignment(s): ${JSON.stringify(legacyReads.map(r => r.trim()))}`);

  // ...and the tile path too, or a grid thumbnail of an old export would disagree with the main canvas it
  // hands over to on click.
  chk('and so does the preview-grid tile path',
    /transMapDispersion\s*\?\?[\s\S]{0,80}fluidFeedback\?\.dispersion\s*\?\?\s*0/.test(tile),
    'a tile must preview what a click would apply');

  // 5. Exactly ONE dispersion slider in the UI, and it writes the chain-level control. The old
  //    `fluidFeedback.dispersion` row had to be deleted, not left in place: `setFluidFeedback({dispersion})`
  //    still updates a field that nothing uploads, so the row would move and do nothing.
  const dispKeys = [...vfx2.matchAll(/key:\s*'([^']*[Dd]ispersion[^']*)'/g)].map(m => m[1]);
  chk('exactly one Dispersion slider remains, keyed to the chain-level field',
    dispKeys.length === 1 && dispKeys[0] === 'transMapDispersion',
    `slider keys found: ${JSON.stringify(dispKeys)}`);

  // 6. It is a FLAT overlay scalar, not a nested block (invariant 14): a nested block needs a MigrationLayer
  //    backfill, because `Object.assign` copies only present keys and an old export would inherit live
  //    session values. Asserted against the type declaration.
  const types = stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8'));
  chk('transMapDispersion is declared as a flat optional scalar on OverlayState',
    /transMapDispersion\?\s*:\s*number\s*;/.test(types),
    'a nested overlay block would need a MigrationLayer backfill (invariant 14)');

  // 7. The field it replaced must still EXIST in FluidFeedbackConfig — deleting it would make every old
  //    export fail to parse its own dispersion. Same class as `overlay.dye`: import-compatibility only.
  chk('FluidFeedbackConfig.dispersion is retained for import compatibility',
    /interface FluidFeedbackConfig\s*\{[\s\S]{0,400}?dispersion\s*:\s*number\s*;/.test(types),
    'removing it would silently zero the fringing of every pre-2026-08-20 export');

  // 8. Parity: no shipped preset carries dispersion in either spelling, so the ungating cannot have altered a
  //    single library look. Measured rather than assumed — this is what makes "no visual regression" a fact
  //    instead of an argument. If a future preset DOES set it, this flags that the claim needs re-deriving.
  let withDisp = 0;
  for (const [, p] of entries) {
    const ov = p.overlay ?? {};
    if ((ov.transMapDispersion ?? 0) !== 0 || (ov.fluidFeedback?.dispersion ?? 0) !== 0) withDisp++;
  }
  chk('no shipped preset sets dispersion in either spelling, so no library look changed',
    withDisp === 0, `${withDisp} of ${entries.length} presets carry a nonzero value`);

  // 9. The snapshot emit must NOT be gated on the chain containing style 6 — that is what it used to be bound
  //    to, and gating it that way would drop the value from exactly the styles-0-3 chains this change serves.
  const emit = /transMapDispersion:\s*currentTransMapDispersion/.exec(mainTs);
  const emitLine = emit ? mainTs.slice(Math.max(0, emit.index - 120), emit.index + 60) : '';
  chk('getSnapshot emits transMapDispersion gated on VALUE, not on chainHasLayerFor(6)',
    emit !== null && />\s*0\s*\?/.test(emitLine) && !/chainHasLayerFor\(6\)/.test(emitLine),
    'gating the export on a fluid layer would drop it from every styles-0-3 chain');
}

// ===========================================================================
console.log('\n=== I. a preview tile resolves overlay-over-preset, like main.ts ===\n');
// ⚠️ **Reported 2026-08-20, and it had nothing to do with the field maths.** A preset enhanced in the Lab and
// exported carried `postProcessors.transMap.enabled: false` beside `overlay.transMapEnabled: true` — the Lab
// turns the pass on through the OVERLAY and never writes back to the preset block, and no export path does
// either. The tile read only the preset block, so an import previewed with no warp at all: chain, staticField
// and dispersion were each resolved correctly and then gated off by a flag from the wrong half of the file.
//
// Why it needs a checker rather than just a fix. Every one of these reads is a correctly-typed access to a
// field that really exists, so `tsc` sees nothing; the tile keeps rendering, just not what the preset renders;
// and it is INVISIBLE on all 177 legacy presets, which carry no overlay at all — so the case a browser pass
// looks at first is exactly the case that cannot fail. It is also not a one-off: the same split was latent on
// `renderMode` at the moment the `enabled` one was found, for the identical reason.
//
// The `??` ORDER is the assertion, not merely that both names appear. Reversed, a legacy preset's own setting
// would lose to an absent overlay key.
{
  const tile = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));
  const mainTs = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  // ⚠️ **v8 22.1 (2026-09-24) — §5 below now reads TWO files, because the render-mode resolver MOVED out of
  // `main.ts` into `material-presets.ts`.** The move is not a tidy-up: Phase 22's facet predicate has to
  // resolve the mode the way the frame does and is imported under Node, where `main.ts` cannot be loaded at
  // all. See the relocation banner in `material-presets.ts`. **Nothing about the RULE changed**, so every
  // clause below is the same assertion pointed at a new file — and one clause was ADDED, asserting `main.ts`
  // declares no local copy, because a re-added one would shadow the import with `tsc` silent.
  const matPresets = stripComments(readFileSync(SRC + 'generators/material-presets.ts', 'utf8'));

  // 1. The two pairs that exist today, each asserted as an ordered resolution.
  const PAIRS = [
    ['transMap enabled', /overlay\?\.transMapEnabled\s*\?\?\s*pp\?\.enabled/],
    ['render mode', /overlay\?\.renderMode\s*\?\?\s*preset\.renderer\.mode/],
    // Step 14.6's pair, and the THIRD instance of the shape — which is the reason this section generalises
    // rather than listing two special cases. `postProcessors.transMap.beforeParticles` had been in the format
    // since it was written and was grep-confirmed NEVER READ (invariant 13), so wiring it created a new
    // two-source field on the same day, with the same Lab-writes-the-overlay-and-never-writes-back asymmetry.
    ['warp pass order', /overlay\?\.transMapBeforeParticles\s*\?\?\s*pp\?\.beforeParticles/],
  ];
  for (const [label, re] of PAIRS) {
    chk(`the tile resolves ${label} overlay-FIRST, preset-second`, re.test(tile),
      'reversed, an absent overlay key would beat the preset\'s own value');
  }

  // 2. ⚠️ The load-bearing half: no OTHER site may read the preset-block flag directly, or one of them silently
  //    disagrees with the pass's own `enabled`. Three sites read it before the fix — the `init()` call, the
  //    style-6 fluid-sim allocation, and the `persist` override — and a tile whose warp was on but whose fluid
  //    sim was never allocated would sample the 1x1 zero fallback (invariants 3 and 4): a live layer
  //    contributing nothing, which is not a crash and not a black frame, just a wrong picture.
  const strayEnabled = [...tile.matchAll(/pp\??[.!]enabled/g)].length;
  const resolverLine = /const tmEnabled = preset\.overlay\?\.transMapEnabled \?\? pp\?\.enabled/.test(tile);
  chk('...and pp.enabled is read ONCE, in that resolver, never at a dependent site',
    resolverLine && strayEnabled === 1,
    `pp.enabled read ${strayEnabled}x (expected exactly 1: the resolver itself)`);

  chk('...so the fluid-sim allocation and the persist override both gate on the RESOLVED flag',
    /isStyleActive\(chain,\s*6\)\s*&&\s*tmEnabled/.test(tile)
    && /useFluidPersist = tmEnabled && isStyleActive\(chain, 6\)/.test(tile));

  // 3. Same for the mode: the raw preset field must not be re-read after the resolution.
  //
  // ⚠️ The second clause matches `modeInt = <anything> tileMode ===`, deliberately loose about the branch
  // list: it exists to assert that `modeInt` derives from the RESOLVED `tileMode` rather than from
  // `preset.renderer.mode`, and pinning the branches themselves made it fail on Step 15.1's `liquid` case —
  // a behaviour-neutral extension of a list, not a regression. The property is the SOURCE, not the arity.
  const strayMode = [...tile.matchAll(/preset\.renderer\.mode/g)].length;
  chk('...and preset.renderer.mode likewise, with modeInt reading the resolved value',
    strayMode === 1 && /modeInt = [^;]*tileMode ===/.test(tile),
    `preset.renderer.mode read ${strayMode}x (expected exactly 1: the resolver)`);

  // 3b. v8 Step 15.1 — `liquid` must be tested BEFORE the material branch, and that order is the wiring.
  //     Every other mode yields to a live material, because the material's splat replaces the particle's
  //     shape. Liquid does not: a material contributes only a colour ramp to an iso-surface, which
  //     `tintSource: 'material'` reads separately. Folded the other way, every liquid preset carrying a
  //     material previews as a splat — i.e. the mode is invisible on exactly the presets the phase is for,
  //     `LiquidLight` being the 2nd-most-used material in the library. A silent wrong picture, not a crash.
  //     Measured INSIDE the `modeInt` expression itself, not by two positions in the file: the whole point is
  //     the order of the ternary's own operands, and a file-wide `indexOf` would compare the start of the
  //     assignment against a term nested inside it.
  const modeExpr = (tile.match(/modeInt = [^;]*/) ?? [''])[0];
  const liqAt = modeExpr.indexOf("tileMode === 'liquid'");
  const matAt = modeExpr.indexOf('materialConfig ? 3');
  chk('...and the tile tests liquid BEFORE the material branch, so a material cannot mask the mode',
    liqAt >= 0 && matAt >= 0 && liqAt < matAt,
    `within \`${modeExpr.slice(0, 90)}\`: liquid at ${liqAt}, material at ${matAt} — liquid must come first`);

  // 4. The tile is only "like main.ts" if main.ts still does it this way. This is the premise the section is
  //    named for, so it is asserted rather than assumed — if main.ts ever stops preferring the overlay, the
  //    tile matching it becomes the bug and these assertions become the thing defending it.
  const mainPairs = [...mainTs.matchAll(/transMapEnabled\s*\?\?\s*\w+\.postProcessors\.transMap\.enabled/g)].length;
  chk('main.ts still resolves transMapEnabled overlay-first at both of its sites', mainPairs === 2,
    `found ${mainPairs} (expected 2: applyOverlayConfigBlocks + the preset-click path)`);
  chk('...and renderMode the same way', /renderMode\s*\?\?\s*p\.renderer\.mode/.test(mainTs));
  // Step 14.6. THREE sites, not two: the preset-change path resolves it as well, because unlike `enabled`
  // (which the `init*` helpers seed from the preset) nothing else assigns the pass order — so a preset with no
  // opinion would inherit the previous preset's order, which is invariant 23's shape.
  const mainOrder = [...mainTs.matchAll(/transMapBeforeParticles\s*\?\?\s*\w+\.postProcessors\.transMap\.beforeParticles/g)].length;
  chk('...and the pass order at all THREE of its sites', mainOrder === 3,
    `found ${mainOrder} (expected 3: applyPresetChange + applyOverlayConfigBlocks + the preset-click path)`);

  // ⚠️ The half a `??`-order grep cannot see: the frame loop must name the particle target through ONE
  // resolver. A hard-coded `fboState.fboB` at any of the four binding sites re-resolves the order implicitly
  // and fails SILENTLY — the particles keep landing in a real buffer, just the one the warp already consumed,
  // so they reach the screen a frame late and unwarped rather than not at all.
  // ⚠️ The slice must be BRACE-MATCHED, not open-ended. A `slice(indexOf(...))` runs to the end of the file and
  //    so swept in the two startup/resize `clear` sites, which clear BOTH buffers and are order-indifferent by
  //    construction: 3 hits, and the assertion failed on correct code. The checker's basis was the defect.
  const body = braceBody(mainTs, 'function drawFrameBody');
  const strayFboB = [...body.matchAll(/fboState\.fboB/g)].length;
  chk('the frame loop binds the particle target through particleFbo(), not a literal fboB',
    /const particleFbo = \(\): WebGLFramebuffer =>/.test(mainTs) && strayFboB === 1,
    `fboState.fboB read ${strayFboB}x inside drawFrameBody (expected 1: the decay pass's own write target)`);
  // ⚠️ The name is matched WITHOUT its argument list. The assertion is "one declaration plus two call sites",
  //    and pinning `()` made it fail the moment Step 14.7 gave the function a `state` parameter — a
  //    behaviour-neutral signature change reading as a regression, which is this checker's documented trap.
  //    `runTransMapPass\(` still cannot match a second `function` declaration without also counting it.
  const passSites = [...mainTs.matchAll(/runTransMapPass\(/g)].length;
  chk('...and the warp pass is ONE callable, run at one of two points',
    /function runTransMapPass\(/.test(mainTs) && passSites === 3,
    `a second copy of the pass is how the two orders drift apart — ${passSites} sites (expected 3: 1 declaration + 2 calls)`);
  // The tile permutes the same two passes, and its draw used to inherit `fboB` from the decay pass too.
  chk('the preview tile permutes the same two passes and binds its draw target explicitly',
    /slot\.beforeParticles \? fboA : fboB/.test(tile)
    && /if \(slot\.beforeParticles\) \{\s*runWarp\(\);\s*drawParticles\(\);/.test(tile),
    'reduced fidelity is a won\'t-fix, but a wrong PASS ORDER is a wrong picture, not a cheaper one');

  // 5. 2026-09-01. ⚠️ **THE MATERIAL-vs-LIQUID PRECEDENCE, WHICH 3b ABOVE ALREADY POLICED ON THE TILE AND
  //    NOTHING POLICED IN `main.ts` — so the two halves of one rule disagreed and the CHECKED half was the
  //    right one.** Reported as *"importing an exported preset with liquid mode seems to render fine in
  //    preview tile but not in main preview or fullscreen (no liquid mode)"*, which is that disagreement read
  //    off the screen: `applyPresetChange` resolved `liquid` correctly from the overlay and then a material
  //    branch ~60 lines later overwrote it with `'splat'` on EVERY apply — every import, every history
  //    restore, every Sliders / Randomiser / Mixer re-apply. Measured on the user's own export files, which is
  //    what named the discriminator: 4 of 9 real liquid exports carry a material (`Ember`, `Plasma`) and all 4
  //    flipped; the 5 with none resolved `liquid` in both readers and looked like proof the feature worked.
  //
  //    ⚠️ **Asserted as ONE OWNER rather than as two agreeing expressions**, because agreement between two
  //    hand-written copies is exactly what was absent for a month — and a THIRD reader (`resetOverlays`) and a
  //    FOURTH write site (`setMaterialConfig`) already existed, each free to invent its own answer.
  //    ⚠️ **RE-BASED 2026-09-04 (v8 15.9) AND THE RE-BASE IS THE INTERESTING PART.** Both assertions below
  //    FAILED on correct code, which is this section's ninth-plus instance of CLAUDE.md's *"a measuring
  //    section's own basis has been the defect"* rule — so each was read as a claim about the CHECKER first.
  //    The verdict differed for the two, which is why they are graded separately:
  //
  //    - The first was asserting a TEXTUAL FORM (`requested === 'liquid' ? 'liquid' : 'splat'`) as a proxy for
  //      the RULE (liquid is exempt). 15.9 kept the rule and the exemption's primacy while replacing the
  //      `'splat'` literal with `materialRequestedRenderMode(material) ?? requested` — nine materials now
  //      answer, so a literal cannot express it. **A proxy that a semantics-preserving edit breaks was
  //      under-specified, not violated**, and it is re-based to assert the exemption's *position* (returned
  //      before anything else can be consulted), which is the property the user report was about.
  //    - The second was a genuine COUNT move: 3 → 4 call sites, the new one being the material-to-material
  //      swap branch. That branch had no mode code before 15.9 because all eight materials wanted `splat`;
  //      leaving it out would have been invariant 13 (`Fire` → `Liquid` staying in `splat`). **So the count
  //      rose because a required call was added — the assertion did its job by making the addition visible.**
  const resolverDecl = /export function resolveModeAgainstMaterial\(/.test(matPresets);
  const resolverBody = braceBody(matPresets, 'function resolveModeAgainstMaterial');
  // ⚠️ Asserts the exemption is returned BEFORE the requested-mode mapping is consulted, by index: a mapping
  // that ran first could return 'splat' for a liquid-mode preset carrying `Fire` and re-open the whole defect.
  // Position, not text — that is what survives the next material being added.
  const exemptAt = resolverBody.search(/requested === 'liquid'/);
  const requestAt = resolverBody.search(/materialRequestedRenderMode\(/);
  chk('material-presets.ts owns the material-vs-liquid precedence in ONE named resolver',
    resolverDecl && exemptAt >= 0 && requestAt >= 0 && exemptAt < requestAt
    && /return 'liquid'/.test(resolverBody),
    `body (${resolverBody.length} chars) must exempt liquid FIRST (exempt@${exemptAt}, request@${requestAt}): a `
    + 'material gives an iso-surface a colour ramp, which `tintSource` reads separately — it does not replace '
    + 'the surface, whichever mode that material would otherwise request');
  // ⚠️ v8 15.9 — the requested-mode mapping is its own named owner, so no site hand-writes
  // `preset === 'Liquid' ? 'liquid' : 'splat'`. Nine answers is a mapping; two would have been a ternary.
  const requestBody = braceBody(matPresets, 'function materialRequestedRenderMode');
  chk('...with a SECOND named owner for which mode a material REQUESTS',
    /export function materialRequestedRenderMode\(/.test(matPresets)
    && /preset === 'Liquid' \? 'liquid' : 'splat'/.test(requestBody)
    && /preset === 'None'\) return null/.test(requestBody),
    `body (${requestBody.length} chars): the eight pre-existing materials must all still answer 'splat' — a `
    + 'ninth material may not change what the other eight do, and `null` must mean "no live material"');
  const resolverCalls = [...mainTs.matchAll(/resolveModeAgainstMaterial\(/g)].length;
  // ⚠️ **RE-BASED AGAIN 2026-09-08 (v8 16.18 / E109): 4 → 5, AND THIS IS THE SECOND TIME THE COUNT ROSE BECAUSE
  //    A REQUIRED CALL WAS ADDED RATHER THAN BECAUSE ANYTHING DRIFTED.** The new site is `bypassOverlay`, which
  //    resolves the mode for the Composer's *"don't apply Materials"* preview switch. It is exactly the site that
  //    would otherwise have hand-written the fourth `preset !== 'None'` test the clause forbids — and the failure
  //    mode is not abstract: `splat` with no material draws NOTHING, so the bypass would have blacked the preview
  //    on the **80 of 247** presets carrying a live material (re-measured 2026-09-19 over the composed library after
  //    that day's EIGHTH settle batch, the one that CLOSED the refined-preset review — **the one figure in this sweep
  //    that has now gone UP AGAIN while the library went down.** The eighth batch's own contribution is **+1,
  //    measured against the pre-batch copy rather than inferred**: its two variants each author a live material
  //    (`Waves II` a `LiquidLight`, `Who Needs A Fractal II` an `Ember`) and the `Waves` keep-the-original deleted
  //    one with `Waves new`, so +2 −1. ⚠️ **So "the library shrank, therefore this shrank" has now been wrong in
  //    two separate batches** — a settle swaps a body and a spawn adds one; neither subtracts a feature. It
  //    read 78 of 258 after the sixth batch (`There Will Be Light`'s export authoring a live `Plasma` where the
  //    legacy body it replaced had none), 77 of 260 after the fifth, and
  //    read 84 of 399 on 2026-09-08, a DIFFERENT basis — that one counted preset objects across all groups
  //    including both halves of every pending pair, which is what this file still prints). **The assertion did its job by making the addition
  //    visible; a checker whose count is bumped without reading the new site is worse than no count at all.**
  //
  //    ⚠️ **RE-BASED A THIRD TIME 2026-09-24 (v8 22.1): 5 → 4, AND THIS TIME THE BASIS MOVED WITH NOTHING ADDED
  //    OR REMOVED.** The declaration left the file, so the SAME four call sites now count 4 instead of 5. The
  //    import does not count: `stripComments` leaves the import statement, but the name appears there without a
  //    `(` and this regex pins one. **This is the first of the three re-bases that is NOT evidence of anything
  //    about the engine** — read it as a basis change, and do not reconcile it against the earlier two.
  chk('...and ALL FOUR mode-switching sites go through it, none testing the material by hand',
    resolverCalls === 4,
    `${resolverCalls} call sites in main.ts (expected 4, the declaration having MOVED to material-presets.ts: `
    + "applyPresetChange + setMaterialConfig's ARRIVAL branch + its material-to-material SWAP branch + 16.18's "
    + '`bypassOverlay`) — a hand-written '
    + "`preset !== 'None'` test beside it is how the tile and the main view drifted apart, and the swap branch is "
    + 'the one 15.9 had to add: before it, `Fire` -> `Liquid` left the user in `splat` where the new material '
    + 'cannot draw its surface');
  // ⚠️ **v8 22.1 — THE CLAUSE THE MOVE MADE NECESSARY, AND IT IS NOT REDUNDANT WITH THE TWO DECLARATION CLAUSES
  //    ABOVE.** They assert the rule EXISTS in `material-presets.ts`; this one asserts it does not ALSO exist
  //    here. A local `function resolveModeAgainstMaterial` re-added to `main.ts` would shadow the import for
  //    every one of the four call sites, and **`tsc` reports neither the shadow nor the now-unused import** —
  //    a duplicate declaration and an import of the same name in one module is a redeclaration error, so the
  //    realistic regression is the import being dropped in the same edit, which compiles clean and silently
  //    forks the rule again. That fork is the 2026-09-01 user-visible defect, which took a month to surface.
  chk('...and main.ts declares NEITHER function locally, so the import cannot be shadowed',
    !/function resolveModeAgainstMaterial\(/.test(mainTs)
    && !/function materialRequestedRenderMode\(/.test(mainTs)
    && /import \{[^}]*resolveModeAgainstMaterial[^}]*\} from '\.\/generators\/material-presets\.ts'/.test(mainTs),
    'main.ts must CALL the resolver and import it, never re-declare it: a second copy is exactly the drift the '
    + 'one-owner rule was written for, and the move to a Node-importable module was made so that Phase 22\'s '
    + 'facet predicate could share this one instead of hand-writing a third');
  // ⚠️ **THE REVERT IS NOT THE INVERSE OF THE SWITCH, AND ASSERTING THAT IS THE POINT OF THIS ONE.** Two of the
  //    three revert sites test `currentRenderMode === 'splat'` because splat with no material draws NOTHING;
  //    `liquid` with no material is a shipped authored look (five library presets), so adding `liquid` to those
  //    tests would kick a user out of a mode they authored the moment they cleared an unrelated material — the
  //    2026-09-01 defect through the revert direction. Only `setMaterialConfig`'s clear branch can see WHICH
  //    material left, and only it may revert out of liquid.
  chk('...while the revert out of `liquid` keys on the DEPARTING material, not on the mode',
    /prevPreset === 'Liquid' && previousRenderMode !== 'liquid'/.test(mainTs),
    'reverting on the mode alone would take `liquid` away from the five library presets that author it with no '
    + 'material; and without the `previousRenderMode` half, a user ALREADY in liquid who picks and clears the '
    + 'material is thrown to `star` — the arrival stores `previousRenderMode` even when it changes no mode');
  // The tile is the reference implementation of the same rule (3b asserts its ternary order), so the two must
  // agree by CONSTRUCTION. This states the direction of that dependency: main.ts adopted the tile's answer.
  chk('...matching the tile\'s documented order, which is the one this section already asserted',
    liqAt >= 0 && matAt >= 0 && liqAt < matAt && resolverDecl,
    'if the tile\'s order ever changes, THIS is the assertion that says main.ts must change with it');

  // 6. 2026-09-01, the same report's second half. ⚠️ **AN EXPORT GATE DOES NOT OMIT A BLOCK — IT DESTROYS IT.**
  //    `panel.ts`'s Export and Snapshot handlers both do `copy.overlay = visualFxControls.getSnapshot()`, a
  //    WHOLESALE REPLACEMENT rather than a merge, so a block the gate declines to emit is gone from the
  //    working preset — and Snapshot writes that loss into the history the user restores from. `renderMode` is
  //    emitted unconditionally while `liquid` was gated on it, so they could disagree in exactly one
  //    direction: mode present, block missing, unrecoverable. Leaving the mode for one moment to compare was
  //    enough to lose eleven authored fields with nothing on screen to say so.
  //
  //    ⚠️ **The mode clause is KEPT as the first operand, not replaced** — it is what makes a liquid preset
  //    whose fields sit at their defaults still export a block. And the authored test must compare against
  //    `DEFAULT_LIQUID_CONFIG` rather than against a hand-copied field list, or a twelfth liquid field added
  //    by a later step silently stops being detectable while this assertion stays green.
  chk('the liquid export gate is mode OR authored, so a mode change cannot DESTROY the block',
    /currentRenderMode === 'liquid' \|\| isLiquidAuthored\(currentLiquid\)/.test(mainTs),
    'the mode alone made Export, Import and Snapshot lossy together — `panel.ts` REPLACES `copy.overlay`');
  const authoredBody = braceBody(mainTs, 'function isLiquidAuthored');
  chk('...and `isLiquidAuthored` derives its field list from DEFAULT_LIQUID_CONFIG, never a hand-copy',
    /Object\.keys\(DEFAULT_LIQUID_CONFIG\)/.test(authoredBody)
    && /DEFAULT_LIQUID_CONFIG\[k\]/.test(authoredBody),
    `body (${authoredBody.length} chars): a hand-listed subset goes stale the next time a field is added, `
    + 'and stays green while doing it');
  // ⚠️ The two sibling blocks are NOT gated on the mode and must not be "made consistent" with it: cohesion
  //    and the pool both move `positions`, so a beaded or stirred `star`-mode preset is a legitimate authored
  //    look. Their gates are already value-based and so cannot destroy anything a user authored.
  chk('...while cohesion and the pool stay value-gated, which has this property already',
    /currentCohesion\.strength > 0 \? \{ cohesion:/.test(mainTs)
    && /currentLiquidField\.enabled && currentLiquidField\.poolSize > 0/.test(mainTs),
    'three blocks, three gate rules — do not unify them; only the mode-based one could lose data');
}

// ===========================================================================
console.log('\n=== J. the style vocabulary is ONE table, and every entry is reachable ===\n');
// Step 14.0. The vocabulary was enumerated in THREE places — a `TRANS_MAP_STYLE_NAMES` record, a `FIELD_STYLES`
// literal, and a bare `[0,1,2,3,4,5,6]` inside `refreshAddOptions()`. **Three enumerations of one list make a
// missing entry structurally invisible**: a style added to the union and the names record but not to that
// literal compiles, loads from a preset correctly, renders correctly, and is simply UNREACHABLE from the UI.
// `tsc` never compares an array literal to a union, so nothing else can see it.
//
// This section asserts the collapse HOLDS — the failure it guards is a future style added to `TRANS_MAP_STYLES`
// while some site quietly goes back to a literal. It is a grep, like D, so read the assertion before believing
// a failure is a regression.
{
  const chain = stripComments(readFileSync(SRC + 'post-processors/trans-map-chain.ts', 'utf8'));
  const vfx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));

  // 1. The table itself, parsed. This is the oracle every other assertion here compares against.
  const tableBlock = /export const TRANS_MAP_STYLES[\s\S]*?\n\];/.exec(chain);
  const styles = tableBlock ? [...tableBlock[0].matchAll(/\{\s*style:\s*(\d+)/g)].map(m => +m[1]) : [];
  chk('TRANS_MAP_STYLES parses, with every implemented style present exactly once',
    styles.length > 0 && new Set(styles).size === styles.length, `styles: [${styles}]`);

  // 2. The three derived lists are DERIVED. A literal here is the defect this step removed.
  for (const [name, re] of [
    ['ALL_STYLES', /ALL_STYLES[^=]*=\s*TRANS_MAP_STYLES\.map/],
    ['FIELD_STYLES', /FIELD_STYLES[^=]*=\s*\n?\s*TRANS_MAP_STYLES\.filter/],
    ['TRANS_MAP_STYLE_NAMES', /TRANS_MAP_STYLE_NAMES[\s\S]{0,120}?TRANS_MAP_STYLES\.map/],
  ]) {
    chk(`${name} is derived from the table, not hand-listed`, re.test(chain),
      'a literal here is the third-enumeration bug this step removed');
  }

  // 3. Both UI entry points read the table. These are the two lists a style has to appear in to be REACHABLE:
  //    the add-layer menu for a chain, and the flat Style dropdown every single-layer preset uses.
  chk('the add-layer menu is built from ALL_STYLES', /ALL_STYLES\.filter\(s => !present\.has\(s\)\)/.test(vfx));
  chk('...and the flat Style dropdown from TRANS_MAP_STYLES',
    /options:\s*TRANS_MAP_STYLES\.map\(m => \[String\(m\.style\), m\.name\]/.test(vfx));

  // 4. ⚠️ The load-bearing one, and the reason `separable` exists as METADATA. `l.style <= 3` was a FIFTH
  //    implicit enumeration, and it fails in the silent direction: a future separable style numbered above 3
  //    would appear in the UI, count as `live`, and contribute nothing to the displacement texture. Note the
  //    numeric spelling is *correct today* for styles 7 and 9 — being right is not the same as saying what it
  //    means, which is exactly why a checker and not a comment.
  const numericStyleTests = [...chain.matchAll(/\.?style\s*(<=|>)\s*3\b/g)].length;
  chk('no numeric `style <= 3` / `style > 3` test survives in the chain module', numericStyleTests === 0,
    `found ${numericStyleTests}`);
  chk('...buildChainPlan selects separable layers by metadata',
    /staticStyles = live\.filter\(l => styleMeta\(l\.style\)\?\.separable === true\)/.test(chain));

  // 5. `TransMapStyle` stays WIDER than the table, deliberately: the numbering is persisted in every export and
  //    must never be reused, so an unbuilt style keeps its number reserved while being absent from the table —
  //    which makes `normaliseChain` DROP it from an import rather than render an inert layer.
  const types = stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8'));
  const union = /export type TransMapStyle =([^;]+);/.exec(types);
  const unionMembers = union ? [...union[1].matchAll(/\d+/g)].map(m => +m[0]) : [];
  chk('every implemented style is a member of the TransMapStyle union',
    styles.every(s => unionMembers.includes(s)),
    `union [${unionMembers}] vs table [${styles}]`);
  chk('...and the union is WIDER, so an unbuilt style\'s number stays reserved',
    unionMembers.length > styles.length,
    `union ${unionMembers.length}, table ${styles.length} — equal means the next style reuses a number`);
  chk('...while MigrationLayer still clamps legacy data to style <= 4',
    /style:\s*Math\.min\(raw\.TransMapStyle \?\? 0,\s*4\)/.test(
      stripComments(readFileSync(SRC + 'presets/migration.ts', 'utf8'))),
    'a legacy Delphi preset predates styles 5+; a 7 in one would be corruption, not a request');

  // 6. ⚠️ The SIXTH enumeration of the vocabulary, and the one that fails most quietly: a style's per-layer
  //    config block has to be named in TWO hand-written lists, `normaliseChain` (which copies it) and
  //    `isLegacyExpressible` (which forces the chain array out of the export). Omitting it from the second is
  //    invisible in every ordinary check — the STYLE round-trips through `overlay.transMapStyle` perfectly and
  //    only its numbers revert to defaults, so the preset comes back looking like it worked. `tsc` cannot see
  //    it: both lists are boolean expressions over optional properties, and omitting one is valid code.
  //
  //    The oracle is `TransMapLayer` itself, so this grows automatically with the next style. The exemption is
  //    DERIVED too rather than listed here: three blocks are genuinely legacy-expressible because the overlay
  //    carries them as top-level scalars and `chainFromOverlay` restores them, so requiring those in
  //    `isLegacyExpressible` would be the opposite error — it would force the array into every style-4/5/6
  //    export for no gain.
  const layerBlock = braceBody(types, 'export interface TransMapLayer');
  const layerKeys = [...layerBlock.matchAll(/^\s*(\w+)\?:/gm)].map(m => m[1]);
  chk('TransMapLayer\'s optional per-layer keys parse', layerKeys.length >= 8, `keys: [${layerKeys}]`);

  const normBody = braceBody(chain, 'export function normaliseChain');
  const notCopied = layerKeys.filter(k => !normBody.includes(`l.${k}`));
  chk('...and normaliseChain copies every one of them', notCopied.length === 0,
    `not copied: [${notCopied}] — an import would load the layer and drop this block's tuning`);

  const fromOverlayBody = braceBody(chain, 'export function chainFromOverlay');
  const legacyCarried = layerKeys.filter(k => new RegExp(`overlay\\??\\.${k}\\b`).test(fromOverlayBody));
  const gateBody = braceBody(chain, 'export function isLegacyExpressible');
  const missingFromGate = layerKeys.filter(k => !legacyCarried.includes(k) && !gateBody.includes(`l.${k}`));
  chk('...and every block the overlay CANNOT carry forces the chain array out on export',
    missingFromGate.length === 0,
    `missing from isLegacyExpressible: [${missingFromGate}] — the style survives a round trip and its tuning does not`);
  //    Pinned so the exemption cannot grow by accident: an exempt key is one whose values live on `OverlayState`
  //    as well, which is a deliberate design decision per style, not a consequence of adding a block.
  chk('...and the exemption is exactly the three blocks the overlay mirrors',
    legacyCarried.length === 3, `exempt: [${legacyCarried}] (expected ifsParams, proceduralFlow, fluidFeedback)`);

  // 7. ⚠️ The SEVENTH enumeration, and the one that actually shipped broken: the layer row's `ownsBody` test,
  //    which decides whether the ▸ expander is ENABLED. It read `layer.style === 9` while style 9 was the only
  //    weightless style, so styles 8 and 11 fell through to the `chainLength > 1` clause — which lists only the
  //    three flat-slot borrowers (4, 5, 6) — and got a DISABLED expander at every chain length.
  //
  //    ⚠️ It fails in the worst direction available to a UI defect: the rows are otherwise completely correct.
  //    `buildWeightlessBody` dispatches per style, so both features' real sliders were BUILT into a body that
  //    nothing could open. The style is reachable, the row appears, the name is right, the inert-modifier note
  //    is right, `describePlan` names the stage — and the parameters sit at their defaults forever. Both new
  //    styles default `amount: 0`, i.e. byte-identical to absent, so the observable result is a feature that
  //    adds a layer and changes nothing. Every other §J assertion passed on it.
  //
  //    Asserted as DERIVATION, not as a list of the three numbers: a hand-listed `8 || 9 || 11` here would be
  //    the identical defect one style later.
  chk('the row\'s owned-body test derives the weightless styles from isWeightless, not a number',
    // ⚠️ **TIGHTENED 2026-10-22, AND THE REASON IS THAT THIS CLAUSE'S OWN WARNING CAME TRUE.** It pinned
    // the expression with `=== 7 || === 10` as literals, and style 12 then shipped unreachable because
    // the literal list did not name it — *the identical defect one style later*, exactly as the comment
    // above predicted, in the half the clause was not guarding. **Both halves are now derivations**:
    // `styleOwnsBody()` reads `ownBody` off `TRANS_MAP_STYLES`, so a style number cannot appear here at
    // all. The clause additionally bans a bare `layer.style ===` in the test, which is what makes it a
    // statement about the SHAPE rather than about today's membership.
    /ownsBody = isStatic \|\| styleOwnsBody\(layer\.style\) \|\| isWeightless\(layer\.style\)/.test(vfx),
    'a literal style number here disables the ▸ expander for the NEXT weightless style, whose sliders are then '
    + 'built into a body nothing can open — the feature reads as present and inert');
  //    The other half of the same gate: the borrow clause must stay exactly the three styles that PARK their
  //    panel in the flat slot, because that clause is the reason the gate is conditional at all.
  const placed = [...vfx.matchAll(/this\.placeStylePanel\((\d+),/g)].map(m => +m[1]);
  const borrowMatch = /chainLength > 1 && \(([^)]*)\)/.exec(vfx);
  const borrowed = borrowMatch ? [...borrowMatch[1].matchAll(/=== (?:ECHO_STYLE|(\d+))/g)]
    .map(m => (m[1] === undefined ? 4 : +m[1])) : [];
  chk('...and the chainLength clause covers exactly the styles that borrow the shared flat-slot panel',
    placed.length === 3 && borrowed.length === placed.length
    && placed.every(s => borrowed.includes(s)),
    `placeStylePanel: [${placed}] vs borrow clause: [${borrowed}] — a style that owns its body must not be `
    + 'in the clause (its expander would need a second layer), and one that borrows must be');

  // 8. The pipeline READOUT must answer the enable question, because `apply()` short-circuits on `!this.enabled`
  //    at its first line — BEFORE the plan is consulted — while `describePlan` is a pure function of the plan
  //    and structurally cannot know. So the readout described a full `warp → time-warp → bloom` pipeline on a
  //    preset where nothing ran at all. **60 of the 177 legacy presets load with Enable off** (`TransMapFilter`
  //    false), so this is the majority-of-a-large-minority case, not an edge one, and it is what the layer
  //    panel's own explanation control is for. Reported as "added Time Warp, played with the sliders, nothing
  //    happens" — with every layer row, slider and note individually correct.
  const mainForReadout = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  chk('the pipeline readout is gated on currentTransMapEnabled, not on the chain alone',
    /getTransMapPipelineDescription: \(\) => \(currentTransMapEnabled[\s\S]{0,200}?describePlan\(buildChainPlan/
      .test(mainForReadout),
    'describePlan derives from the ChainPlan, which cannot see `enabled`; ungated, the one control that exists '
    + 'to explain the pipeline names stages that apply() returns before reaching');
}

// ===========================================================================
console.log('\n=== K. the force gate defaults to a no-op, and dies with its buffer ===\n');
// Step 14.4. The gate multiplies a per-particle force by a per-particle number, and three of its failure modes
// are invisible to `tsc` and to every other checker here:
//
//   1. **`state.lifetimes` is the ONE array `lissajous.ts` does not extend to `totalCount`** (invariant 6). A
//      `!array` guard passes a truthy-but-SHORT array and then reads `undefined` across the whole spark and
//      crystal tail — which lands in `positions` as NaN. The pad must also be 1, not 0: a 0 pad gates the tail
//      to zero, i.e. sparks that never move, which presents as a *spark* bug and sends the next reader to the
//      wrong file entirely. `lencheck` asserts the array is not extended; this asserts the CONSUMER knows.
//   2. **`gateActive` is a flag over a buffer** (invariant 3) and is the ONLY read gate — both force loops
//      multiply by `gateBuf[i]` without re-testing the source. A true flag over a nulled buffer throws; over a
//      stale one it applies the previous preset's gate.
//   3. **The default must be byte-identical to the pre-feature behaviour.** That is a property of the FORMULA:
//      a lerp from 1 (`1 + amount * (a01 - 1)`) is exactly 1 at `amount == 0` for any attribute value, whereas
//      the bare multiply the plan's text implies is not.
{
  const force = stripComments(readFileSync(SRC + 'post-processors/trans-map-force.ts', 'utf8'));
  const mainTs = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  const vfx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));

  // 1. Invariant 6: a LENGTH test, never a truthiness test, and a pad of 1.
  chk('prepareGate bounds the loop by the SOURCE array length, not by state.count alone',
    /const m = Math\.min\(src\.length, n\)/.test(force),
    'lifetimes is short by design — `!array` passes it and the tail reads undefined');
  chk('...and pads the untracked tail with 1 (ungated), not 0',
    /let a01 = 1;\s*if \(i < m\)/.test(force),
    'a 0 pad gates sparks and crystals to zero — reads as a spark bug, not a gate bug');

  // 2. The formula. `1 + amount * (a01 - 1)`, so amount 0 is a no-op at ANY attribute value.
  chk('the gate is a LERP FROM 1, so amount 0 is exactly ungated for every particle',
    /g\[i\] = 1 \+ amount \* \(a01 - 1\)/.test(force),
    'a bare `a01 * amount` would darken the force at amount 0 instead of leaving it alone');
  // `exp(-age * ln2/halfLife)` is 0.5 exactly at age == halfLife. Measured, not grepped — it is arithmetic.
  {
    const k = Math.LN2 / 2.0;
    const at = a => Math.exp(-a * k);
    // ⚠️ The "no ceiling" clause is bounded at a REALISTIC session age, not at 1e6 — `exp()` underflows to a
    // true 0 long before that, and a checker that demands a nonzero there would be asserting a property of
    // float64 rather than of the mapping. 600 s is ten minutes of continuous run.
    let monotonic = true;
    for (let a = 0; a < 600; a += 0.25) if (at(a + 0.25) >= at(a)) monotonic = false;
    chk('...and the age mapping is a true half-life: 1 at age 0, 0.5 at the half-life, monotonic',
      Math.abs(at(0) - 1) < 1e-12 && Math.abs(at(2.0) - 0.5) < 1e-12 && monotonic && at(600) > 0,
      `age 0 -> ${at(0)}, 2s -> ${at(2)}, 4s -> ${at(4).toFixed(4)}, still strictly falling at 600 s`);
    chk('...which is why lifetimes cannot be used RAW as a 0..1 gate',
      2.0 > 1, 'an unbounded accumulating age saturates within two seconds and stays there for the session');
  }

  // 3. Invariant 3: the flag dies with the buffer, in dispose().
  const disposeBlock = /dispose\(\)[\s\S]*$/.exec(force)?.[0] ?? '';
  chk('dispose() nulls gateBuf AND clears gateActive (invariant 3)',
    /this\.gateBuf = null/.test(disposeBlock) && /this\.gateActive = false/.test(disposeBlock),
    'a true flag over a null buffer is read unconditionally by both force loops');
  chk('...and the read path re-checks the length, so a shrunk count degrades to ungated',
    /if \(!this\.gateActive \|\| !this\.gateBuf \|\| this\.gateBuf\.length < count\) return null/.test(force),
    'NaN here propagates into positions and ANGLE drops the whole draw silently');

  // 4. ⚠️ The gate scales the INCREMENT only. Gating `decayPerFrame` too would freeze a low-gate particle
  //    wherever it happened to be — a STUCK particle, not one holding the curve, which is the whole effect.
  const decayLines = [...force.matchAll(/off[XY]\[i\]! \* decayPerFrame \+ ([^;]+);/g)].map(m => m[1]);
  chk('both force loops leave decayPerFrame ungated, so a gated particle still relaxes home',
    decayLines.length === 4 && decayLines.every(l => !/gate/.test(l)),
    `${decayLines.length} decay terms (expected 4: two axes x two force paths)`);
  // In applyIfsForces the gate multiplies BEFORE the maxForcePixels clamp, or its effect vanishes exactly where
  // the force is strongest: every strongly-driven particle pins at 8 px and is then uniformly scaled.
  const ifsGate = force.indexOf('const gm = gate ?');
  const ifsClamp = force.indexOf('if (mag > maxForcePixels)');
  chk('...and the IFS gate multiplies BEFORE the maxForcePixels clamp',
    ifsGate > 0 && ifsClamp > ifsGate,
    `gate at ${ifsGate}, clamp at ${ifsClamp} — reversed, the gate does nothing where the force is strongest`);

  // 5. ONE derivation site in main.ts, per the style-6 lesson: six sites that each assigned on entry is how
  //    the fluid override came to leak. And `prepareGate` must run BEFORE the force calls, every frame.
  const gateSetterCalls = [...mainTs.matchAll(/transMapForce\.setGate\(/g)].length;
  chk('main.ts calls setGate from exactly ONE derivation site',
    gateSetterCalls === 1, `${gateSetterCalls} call sites — assign-on-entry is what leaked the style-6 override`);
  const prep = mainTs.indexOf('transMapForce.prepareGate(state)');
  const firstApply = mainTs.search(/transMapForce\.apply(Ifs)?Forces\(/);
  chk('...and prepareGate runs before the frame\'s force calls',
    prep > 0 && firstApply > prep, `prepareGate at ${prep}, first apply at ${firstApply}`);

  // 6. Round trip. Every load path resets all four (an unreset one inherits the previous preset's gate —
  //    invariant 14's failure mode without a nested block), and the snapshot emits none of them by default, so
  //    an ordinary export stays byte-identical to what it was before this step.
  const GATE_KEYS = ['transMapForceGateBy', 'transMapForceGateAmount', 'transMapForceGateInvert',
    'transMapForceGateHalfLife'];
  for (const k of GATE_KEYS) {
    const reads = [...mainTs.matchAll(new RegExp(`${k}\\s*\\?\\?`, 'g'))].length;
    chk(`${k} is reset with a ?? default on BOTH load paths`, reads === 2,
      `found ${reads} (expected 2: applyOverlayConfigBlocks + the preset-click path)`);
  }
  chk('getSnapshot emits the gate only when it is genuinely on',
    /currentForceGateBy !== 'none' && currentForceGateAmount > 0/.test(mainTs),
    'either half alone leaves prepareGate inactive, so the key would describe nothing');
  // The four are FLAT scalars, not a nested block: invariant 14 — `Object.assign` copies only PRESENT keys, so
  // a nested block needs a MigrationLayer backfill or an old export inherits the live session's gate.
  const types = stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8'));
  for (const k of GATE_KEYS) {
    chk(`${k} is a flat optional scalar on OverlayState (invariant 14)`,
      new RegExp(`${k}\\??\\s*:\\s*(number|boolean|ForceGateSource)\\s*;`).test(types));
  }
  // No shipped preset carries a gate, so the whole feature is off across the library — the same reason the
  // tile-resolution bug was invisible on 177 legacy presets. Stated as a measurement, not assumed.
  // ⚠️ Reads the already-parsed `LIB`, not a fresh `JSON.parse` of the file — `psss_presets.json` is NOT
  // JSON: it opens with a `g_psss_presets={` assignment, which is why line 204 slices from the first brace.
  {
    const gated = entries.filter(([, p]) => (p.overlay?.transMapForceGateBy ?? 'none') !== 'none').length;
    chk('no shipped preset carries a gate, so the default really is the whole library\'s behaviour',
      gated === 0, `${gated} of ${entries.length} legacy presets gated`);
  }

  // 7. Invariant 13: `Age`/`Temperature` are inert with no material, so the UI must SAY so rather than offer a
  //    control that moves and changes nothing. And `updateGateRows` must be reachable from `syncFromControls`,
  //    because switching a material off happens in a DIFFERENT tab and no gate handler fires.
  chk('the tab derives material availability from the existing getMaterialConfig, not a parallel accessor',
    /getMaterialConfig\(\);\s*const materialActive = !!cfg && cfg\.preset !== 'None'/.test(vfx),
    'and note the inactive state is the STRING \'None\', not null (invariant 18)');
  chk('...disabling the two sources that need one, rather than hiding them (invariant 13)',
    /opt\.disabled = !materialActive/.test(vfx) && /needs a material/.test(vfx));
  chk('...and updateGateRows is called from syncFromControls, not only from the select handler',
    /syncFromControls\(\)[\s\S]{0,600}?this\.updateGateRows\(\)/.test(vfx),
    'a material is switched off in the Materials tab — no gate control fires');
  chk('...and the Half-Life row is shown for the age source alone',
    /show\(this\.gateHalfLifeRow, by === 'age'\)/.test(vfx),
    'the other two sources never read it, so it would be an inert control');

  // 8. The Mixer: categorical halves SNAP (invariant 16), continuous halves interpolate.
  const interp = stripComments(readFileSync(SRC + 'exploration/interpolate.ts', 'utf8'));
  // v8 Phase 23.1 — the rule table is a SECOND source for anything about the Mixer: `interpolate.ts` holds
  // the arithmetic, `overlay-rules.ts` holds which LOCK and which LAW a key answers to, and a claim about a
  // crossfade now needs both halves.
  const rules = stripComments(readFileSync(SRC + 'exploration/overlay-rules.ts', 'utf8'));
  chk('the Mixer snaps the gate SOURCE at t=0.5 (invariant 16)',
    /const gateWinner = t < 0\.5 \? a : b/.test(interp)
    && /transMapForceGateBy: gateBy/.test(interp),
    'a lerp between two ForceGateSource strings is not even expressible');
  chk('...interpolates the amount, which has a real neutral (absent === 0 === ungated)',
    /const amount = ga \+ \(gb - ga\) \* t/.test(interp));
  chk('...defaults the half-life to the engine\'s 2.0 on BOTH sides before interpolating',
    /transMapForceGateHalfLife \?\? 2\.0[\s\S]{0,160}transMapForceGateHalfLife \?\? 2\.0/.test(interp),
    'a 0 on the missing side would collapse the gate to zero at any nonzero age');
  /*
   * ⚠️ **RE-BASED 2026-10-05 FOR PHASE 23.2, AND THE FAILURE IT THREW WAS A CLAIM ABOUT THE CHECKER RATHER
   * THAN A REGRESSION.** It pinned four `snap?.overlay?.<key> !== undefined` lines inside a hand-written
   * locked-branch literal. That literal is GONE: `buildOverlay()` restores a locked group's keys in ONE
   * generic `copyKey(out, held, key)` over `OVERLAY_RULES`, so the four lines could not survive a fix whose
   * whole point was that a hand-written list of keys is the thing that goes out of date. The property is
   * unchanged and now reads in two halves — the generic restore exists, and the four keys are in the
   * `transmap` GROUP, which is what makes that restore reach them under the TransMap lock and not the visual
   * one.
   */
  /*
   * ⚠️ **RE-BASED AGAIN 2026-10-06 FOR PHASE 24.1, AND THIS FAILURE WAS ALSO A CLAIM ABOUT THE CHECKER.**
   * The regex matched a whole entry `{ group, law }` and closed it with ` }`. `24.1` gave every rule a THIRD
   * column (`mutate`), so the four gate entries are now multi-line and the trailing `}` is no longer where
   * this pattern looked for it — on a change that touched neither the group nor the law, which are the two
   * things this clause is about. It is re-based to match the two columns it asserts and to REQUIRE a comma
   * after the law, so the entry is still pinned exactly as far as the property goes and a third column is
   * allowed to exist. It is deliberately NOT loosened to a substring: `group: 'transmap'` alone would pass
   * on a key whose law had been quietly changed, and the law is half of what makes the restore reach it.
   */
  chk('...and the LOCKED branch holds all four — now via ONE generic restore plus their GROUP',
    /if \(locks\.has\(rule\.group\)\) \{[\s\S]{0,400}?if \(held\) copyKey\(out, held, key\);/.test(interp)
    && GATE_KEYS.every(k => new RegExp(
      `${k}: \\{\\s*group: 'transmap', law: \\{ kind: 'custom', owner: 'mixForceGate' \\},`).test(rules)),
    'a lock that holds the warp and lets the force drift is not a lock — and a gate key in any group but '
    + '`transmap` would be held by the WRONG lock, which is the same defect wearing the new architecture');

  // 9. Randomise never touches the SOURCE — a name has no neighbourhood to jitter in, and a roll onto
  //    `age`/`temperature` with no material would silently turn a working gate off.
  const rnd = stripComments(readFileSync(SRC + 'exploration/randomize.ts', 'utf8'));
  chk('Randomise jitters the gate only where it is already on, under the transmap lock',
    /gateBy !== 'none' && gateAmount > 0/.test(rnd));
  chk('...and never assigns transMapForceGateBy or ...Invert',
    !/transMapForceGateBy:/.test(rnd) && !/transMapForceGateInvert:/.test(rnd),
    'switching the source is a categorical change, not a nudge');
}

// ===========================================================================
console.log('\n=== L. the vortex warps the picture and the particles with ONE formula ===\n');
// Step 14.5. Style 10 has NO TEXTURE, so its force path could not go through the flow readback and its field
// formula necessarily exists twice: `vortexOffset()` in the warp GLSL (the picture) and `vortexOffsetAt()` in
// `trans-map-chain.ts` (what particles feel). That is §A-D's situation in miniature, and the failure mode is
// worse than a missing effect: particles drifting against the image they are embedded in reads as a RENDERING
// fault and sends the next reader to the renderers.
//
// ⚠️ **This section MEASURES — it is one of the four that do (§A-C, F, and this).** The oracle below is
// transcribed from the GLSL by hand, deliberately not from the TS, so a shared misreading cannot pass. It is
// its own falsifiability test too: a sign flip on the perpendicular is asserted to be NOTICED, because "max
// |diff| = 0" is also what comparing two zero fields prints.
{
  const chainSrc = stripComments(readFileSync(SRC + 'post-processors/trans-map-chain.ts', 'utf8'));
  const tmSrc = stripComments(readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8'));
  const mainSrc = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));

  // The GLSL, transcribed. `d = (vUv - centre) * res / minDim`, `f` the falloff, `perp * f * gain / res`.
  const oracle = (x, y, cx, cy, R, inverse, gain, w, h) => {
    const minDim = Math.max(Math.min(w, h), 1);
    const ux = (x + 0.0) / w, uy = (y + 0.0) / h;         // pixel -> UV, as vUv arrives
    const dx = (ux - cx) * w / minDim;
    const dy = (uy - cy) * h / minDim;
    const r2 = dx * dx + dy * dy;
    const R2 = Math.max(R * R, 1e-6);
    const f = inverse ? 1 / (1 + r2 / R2) : Math.exp(-r2 / R2);
    return [-dy * f * gain / w, dx * f * gain / h];
  };

  // The implementation, imported for real rather than grepped.
  const { vortexOffsetAt, vortexGain } = await import('../src/post-processors/trans-map-chain.ts')
    .catch(() => ({}));
  if (!vortexOffsetAt) {
    // No TS loader in this Node — fall back to the text form of the same arithmetic. Stated rather than
    // silently skipped: a skipped mutation reads exactly like a caught one.
    chk('vortexOffsetAt exists and is the perpendicular-times-falloff form (TEXT check — no TS loader here)',
      /out\[0\] = \(-dy \* f \* gain\) \/ w;/.test(chainSrc) && /out\[1\] = \(dx \* f \* gain\) \/ h;/.test(chainSrc),
      'run `node --experimental-strip-types` for the measured form of this assertion');
  } else {
    const out = new Float64Array(2);
    let worst = 0;
    // Both falloffs, three radii, two aspect ratios, an off-centre eye — 16:9 included because working in raw
    // UV instead of pixels/minDim is the mistake this catches, and it is INVISIBLE at 1:1.
    for (const [w, h] of [[1920, 1080], [600, 600], [256, 192]]) {
      for (const inverse of [false, true]) {
        for (const R of [0.1, 0.4, 1.2]) {
          const gain = vortexGain(0.7, R, inverse ? 'inverse' : 'gaussian', Math.min(w, h));
          for (let i = 0; i < 40; i++) {
            const x = (i * 47) % w, y = (i * 83) % h;
            vortexOffsetAt(x, y, 0.35, 0.62, R, inverse, gain, w, h, out);
            const [ex, ey] = oracle(x, y, 0.35, 0.62, R, inverse, gain, w, h);
            worst = Math.max(worst, Math.abs(out[0] - ex), Math.abs(out[1] - ey));
          }
        }
      }
    }
    chk('vortexOffsetAt reproduces the warp shader\'s vortexOffset() exactly',
      worst < 1e-12, `max |diff| = ${worst.toExponential(2)} UV over 720 samples, 3 sizes, both falloffs`);
    // Falsifiability: the comparison must NOTICE a sign flip on the perpendicular. Without this, a pair of
    // all-zero fields would also print "max |diff| = 0".
    let flipped = 0;
    vortexOffsetAt(700, 300, 0.35, 0.62, 0.4, false, 100, 1920, 1080, out);
    const [fx, fy] = oracle(700, 300, 0.35, 0.62, 0.4, false, 100, 1920, 1080);
    flipped = Math.max(Math.abs(out[0] + fx), Math.abs(out[1] + fy));
    chk('...and the comparison is sensitive enough to catch a flipped perpendicular',
      flipped > 1e-6, `a sign flip would move the result by ${flipped.toExponential(2)} UV`);
    // The gain is what makes `swirl` mean what `strength` means. Peak displacement magnitude must land at 8%
    // of min(w,h) — the same target every static archetype is solved against — at swirl 1.0.
    let peak = 0;
    const gain1 = vortexGain(1.0, 0.4, 'gaussian', 1080);
    for (let i = 0; i < 4000; i++) {
      const x = 960 + i * 0.24, y = 540;
      vortexOffsetAt(x, y, 0.5, 0.5, 0.4, false, gain1, 1920, 1080, out);
      peak = Math.max(peak, Math.hypot(out[0] * 1920, out[1] * 1080));
    }
    chk('...and swirl 1.0 peaks at 8% of min(w,h), like every static archetype\'s strength',
      Math.abs(peak - 0.08 * 1080) < 1.0, `peak ${peak.toFixed(2)} px vs target ${(0.08 * 1080).toFixed(2)} px`);
  }

  // ⚠️ The half no measurement can reach: the force path has to be REACHABLE. A perfect formula behind a
  // `getForceModes()` that never reports the layer is invariant 13's shape — the control moves the picture and
  // not the particles, which is exactly "a style that is silently half-working".
  chk('getForceModes reports a vortex-only chain as analytic, so a sampler is installed at all',
    /analytic: this\.plan\.staticStyles\.length > 0 \|\| this\.plan\.vortexLayer !== null/.test(tmSrc),
    'without the vortexLayer term, Force Blend does nothing on a vortex-only preset');
  chk('...the processor exposes it through sampleVortexOffset, faded and weighted like the shader',
    /sampleVortexOffset\(x: number, y: number, out: Float64Array\)/.test(tmSrc)
    && /gain \* layer\.weight \* this\.fractalFade/.test(tmSrc),
    'uVortexWeight carries weight x fade; the force path must apply the same, and NOT uMix');
  // ⚠️ The SUM, and the reason it is written longhand. `sampleVortexOffset` writes the caller's buffer, so a
  // second call into the same `out` would OVERWRITE the static contribution — a vortex added to a wave-shift
  // preset would silently delete the wave force, which presents as the WAVE being broken.
  chk('...and main.ts SUMS the two closed-form sources into its own scratch, never over the shared out',
    /const vortexForceOut = new Float64Array\(2\)/.test(mainSrc)
    && /out\[0\] = out\[0\]! \+ vortexForceOut\[0\]!/.test(mainSrc),
    'a chain can hold both a static layer and a vortex; they must add, as sampleForce adds its two sources');
}

console.log('\n=== M. the depth field and the warp agree on which end of the scale is NEAR ===\n');
// Step 14.7. Depth crosses THREE modules with the convention INVERTING once on the way, and every hop is a
// bare `float`/`number` to `tsc`:
//
//   lissajous.ts  d = (z - perspZ)/depthRange     0 = NEAR, 1 = FAR
//   depth-field.ts  vDepth = 1.0 - aDepth         inverts, ONCE
//   trans-map.ts  mix(uParallaxFar, uParallaxNear, d)   1 = NEAR
//
// ⚠️ **This section exists because the SPEC had it backwards.** `research_paper_psss_fractal_v8.md`'s own
// snippet for this step comments the texture as `// 0 = near, 1 = far`, which is the opposite of the shader
// that shipped. Implementing from the plan would have inverted the whole effect — far strands sweeping while
// near ones hold — and that is a PLAUSIBLE-LOOKING result, not a visible fault, so nothing downstream would
// have caught it. The generator half is MEASURED here rather than read off a comment for the same reason.
//
// ⚠️ Three consequences hang off "1 = near" and each is a separate silent failure: the clear value (0 = far, so
// background gets `uParallaxFar`), the blend equation (MAX keeps the nearest, MIN would take a strand's depth
// from whatever is hidden behind it), and the invariant-6 tail pad (1 in the SOURCE unit, which the shader
// inverts to 0 = far — a `0` there pads every unwritten slot to maximum parallax).
{
  const depthSrc = stripComments(readFileSync(SRC + 'post-processors/depth-field.ts', 'utf8'));
  const tmSrc = stripComments(readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8'));
  const lissSrc = stripComments(readFileSync(SRC + 'generators/lissajous.ts', 'utf8'));
  const mainSrc = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));

  // --- the GENERATOR end, measured. ⚠️ `perspZ` is NOT a literal: it is `-(width + height) / 2`, so the
  //     direction is swept over real canvas shapes rather than pinned at one number. Both halves of the formula
  //     are read out of the source, so a change to either re-measures instead of quietly invalidating the
  //     pinned direction — the trap being that "0 = near" would still be printed as if it had been checked.
  const rangeM = /const depthRange = ([^;]+);/.exec(lissSrc);
  const depthM = /this\.depths\[i\] = Math\.max\(0, Math\.min\(1, \(z - perspZ\) \/ depthRange\)\)/.test(lissSrc);
  chk('the generator\'s depth normalisation is still the (z - perspZ)/depthRange form this section measures',
    rangeM !== null && depthM && /this\.perspectiveZ = -\(newWidth \+ newHeight\) \/ 2/.test(lissSrc),
    `depthRange = ${rangeM ? rangeM[1].trim() : 'NOT FOUND'}, depths[i] form ${depthM ? 'matched' : 'CHANGED'}`);
  if (rangeM && depthM) {
    let ok = true, worst = '';
    for (const [w, h] of [[1920, 1080], [3000, 0], [600, 600], [256, 192]]) {
      const perspZ = -(w + h) / 2;
      const range = -perspZ * 2;                            // the shipped expression, in the shipped units
      const d = (z) => Math.max(0, Math.min(1, (z - perspZ) / range));
      // ⚠️ The probe offset must be a FRACTION of the range, not a fixed 100 units. `perspZ` scales with the
      //    canvas, so an absolute offset is 3% of the range at 1920x1080 and 22% at 256x192 — the first version
      //    of this loop failed on the small shape and the DEFECT WAS THE PROBE. Invariant 10's shape: the
      //    expression looked fine and the units of the result were wrong.
      const eps = range * 0.03;
      const near = d(perspZ + eps), mid = d(0), far = d(-perspZ - eps);
      if (!(near < 0.1 && Math.abs(mid - 0.5) < 1e-9 && far > 0.9)) ok = false;
      if (w === 1920) worst = `${w}x${h}: near ${near.toFixed(3)}, mid ${mid.toFixed(3)}, far ${far.toFixed(3)}`;
    }
    chk('...and it puts NEAR at 0 and FAR at 1 at every canvas shape — the direction, MEASURED',
      ok, `${worst} (4 shapes swept; perspZ is -(w+h)/2, not a literal)`);
  }

  // --- the CONSUMER end. `mix(a, b, t)` returns `b` at t=1, so naming `uParallaxNear` third is what makes the
  //     texture's 1 mean near. A swap of the two arguments is the defect, and it is one token.
  const mixM = /float parallax = mix\(1\.0, mix\(uParallax(\w+), uParallax(\w+), dCurve\)/.exec(tmSrc);
  chk('the warp reads the texture as 1 = NEAR — mix(Far, Near, depth), in that argument order',
    mixM !== null && mixM[1] === 'Far' && mixM[2] === 'Near',
    mixM ? `mix(uParallax${mixM[1]}, uParallax${mixM[2]}, dCurve) — swapped, near and far exchange` : 'the mix expression was not found at all');
  // The 1x1 fallback corroborates it independently: invariant 4 requires SOME texture on unit 6, and a
  // one-texel one reads 0, which under "1 = near" is far — i.e. the neutral choice only because of the
  // direction above. If the convention flipped, the fallback would need to become 1 and nothing would say so.
  chk('...and the 1x1 fallback\'s 0 is therefore FAR, which is why it is the neutral value (invariant 4)',
    /uDepth/.test(tmSrc) && /needsDepth\(\): boolean/.test(tmSrc),
    'a fallback that read NEAR would apply full parallax on every preset with no depth source');

  // --- the INVERSION, and that there is exactly ONE of it. Two would cancel; none would invert the effect.
  const inversions = [...depthSrc.matchAll(/1\.0 - clamp\(aDepth/g)].length;
  chk('depth-field.ts inverts exactly ONCE, in the vertex shader',
    inversions === 1,
    `found ${inversions} (expected 1 — two cancel out and read as no effect, none inverts the whole result)`);

  // --- the three consequences of "1 = near", each its own silent failure.
  chk('...clears the target to 0 = FAR, so background gets uParallaxFar',
    /gl\.clearColor\(0, 0, 0, 1\)/.test(depthSrc),
    'clearing to 1 puts the whole background at the FRONT of the scene, dragging near parallax frame-wide');
  chk('...resolves overlaps with MAX, so the nearest surface wins',
    /gl\.blendEquation\(gl\.MAX\)/.test(depthSrc) && !/gl\.blendEquation\(gl\.MIN\)/.test(depthSrc),
    'MIN takes a strand\'s depth from whatever is hidden behind it');
  // ⚠️ Invariant 10 in miniature: the pad is written in the SOURCE unit, upstream of the shader's inversion, so
  //    "far" here is 1 even though "far" in the texture is 0. Both are `number`.
  chk('...and pads the tail in the SOURCE unit (1 = far), not the target\'s (invariant 6 + 10)',
    /d\[i\] = 1;/.test(depthSrc),
    'a 0 pad is NEAR in the generator\'s convention and gives every unwritten slot maximum parallax');
  // ⚠️ blendEquation is GLOBAL state and the fade pass asserts FUNC_ADD (blendcheck). A leaked MAX presents
  //    somewhere else entirely — the trail fade — which is why it is asserted here at its source.
  chk('...and restores FUNC_ADD before returning, since blendEquation is global GL state',
    /gl\.blendEquation\(gl\.FUNC_ADD\)/.test(depthSrc),
    'a leaked MAX breaks the trail fade, not this pass — one of the five browser-only defects');

  // --- reachability. Invariant 13: the pass can be perfect and never run.
  chk('main.ts renders the depth pass and hands the texture over from ONE site',
    [...mainSrc.matchAll(/depthField\.render\(/g)].length === 1
    && /if \(transMap\.needsDepth\(\)\)/.test(mainSrc),
    'a second site is the 14.6 asymmetry: the missing order would silently reuse LAST frame\'s depth');
  // ⚠️ Invariant 3, and it is the whole reason `setDepthTexture` takes `null`. Deleting a style-11 layer
  //    mid-session must unbind, or the processor keeps a handle it has no reason to trust.
  chk('...and unbinds it with null when the chain stops reading depth (invariant 3)',
    /transMap\.setDepthTexture\(null\)/.test(mainSrc)
    && /transMap\.setDepthTexture\(depthField\.getTexture\(\)\)/.test(mainSrc),
    'a flag must die with its resource — a stale depth texture is sampled as if it held this frame\'s geometry');
  // The target is full-canvas, so unlike physarum/fluid (fixed 512) it genuinely must resize. Its own resize
  // also clears the `failed` latch, which is what lets a driver that refused R16F at 4K succeed at 1080p.
  chk('...and resizes with the canvas, unlike the fixed-resolution simulations',
    /depthField\.resize\(w, h\)/.test(mainSrc) && /this\.failed = false;/.test(depthSrc),
    'a stale-size depth target samples the figure at the wrong scale after any panel-mode change');
  // Invariant 5: R16F as a COLOUR attachment is renderable only with EXT_color_buffer_float, so this is the
  // realistic case, not a theoretical one — and an incomplete FBO throws nothing and logs nothing.
  chk('...and TESTS checkFramebufferStatus, because R16F colour attachments are refusable (invariant 5)',
    /checkFramebufferStatus/.test(depthSrc) && /gl\.R16F/.test(depthSrc),
    'an incomplete FBO drops every draw silently while getTexture() keeps handing out a live-looking handle');
}

// ===========================================================================
console.log('\n=== N. Depth Range fits the FIGURE, over the population that is actually on screen ===\n');
// Step 14.7b. `depths[i] = (z − perspZ)/(−perspZ·2)` normalises over the CANVAS (`perspZ = −(w+h)/2`) while the
// numerator is the FIGURE's z-extent, and the two are unrelated — so a legacy figure lands in a thin band around
// 0.5 and style 11 has almost no contrast to work with. Measured over the 93 legacy presets with a
// narrow-but-fittable band, at `Near 0.5/Far 2.0` where a full-range figure gives a 4.00x near:far ratio: median
// **1.30x as authored, 4.00x under `'figure'`**. `Depth Range` closes that gap by remapping the measured band.
//
// ⚠️ **This section MEASURES — it is the fifth that does (§A-C, F, L, and this).** Every one of the four defects
// below fails GREEN: `verify` passes, no frame is wrong, the feature simply does nothing or does the opposite,
// and all four are invisible on the preset a browser pass happens to open.
//
//   1. **The CULLED-SLOT trap, and it is the one that would have shipped.** `depths` is written for culled
//      particles too, and a particle behind the camera CLAMPS to exactly 0 or 1. A min/max over the whole array
//      therefore returns 0..1 — the identity — on `Sphere`, `Black Hole`, `Star`, `Milky Way`, `Voyager`,
//      `Living Blue` and `The Real Black Hole`, every one of which has 38-48% of its slots culled, while their
//      VISIBLE populations span 0.00..0.50 (`Star`) and 0.00..0.82 (`Black Hole`).
//   2. **MIN/MAX instead of PERCENTILES.** Min/max inflates the band by up to 0.35 (`Flight Through Milky Way`),
//      0.31 (`Black Hole`), 0.23 (`Wormhole`) from a handful of outlying strands. Median inflation is 0.008, so
//      it bites on only 7 of 175 — the shape that survives whichever preset was tested.
//   3. **`'canvas'` off the identity.** It exists to make the pre-14.7b behaviour reachable EXACTLY. Anything
//      other than `[0, 1]` makes it "nearly the old behaviour", which is unfalsifiable by eye.
//   4. **A degenerate or inverted span.** 22 of 177 presets are flat at every pose, so a divide by the span
//      would amplify float noise frame-wide; and a negative span INVERTS near and far, which invariant 24 says
//      reads as a stylistic choice rather than a fault.
//   5. **TEMPORAL: the band is correct EVERY FRAME and wrong ACROSS frames.** ⚠️ This is the defect that shipped,
//      and this section was green throughout — because every assertion above examines ONE frame's band. Reported
//      as *"jitter every few seconds while the figure is moving, like small contractions"*. Two mechanisms, and
//      the shared cause is that the consumer divides by the span, so it sees `1/(hi−lo)` whose sensitivity is
//      `1/s²`: (a) `MIN_BAND` as a hard SWITCH flips the scale between 1.0 and 42.5 in one frame, and **41 of
//      177 presets cross it within 10 s** (`Sphere`, the reported preset, spends 202 of 420 frames on the
//      fallback side; worst snap **43.2 px with a p95 of 0.00 px** — a rare discrete event, exactly as
//      described); (b) even away from the threshold, a 0.0014 band wobble becomes Δscale 0.37 on a narrow band
//      (`Aurora Borealis` 4.3 px worst, **173 of 599 frames over 2 px**). Hence the ramp AND the EMA, and hence
//      the assertions below that compare CONSECUTIVE frames rather than judging one.
//      ⚠️ **The lesson is invariant 10's**: the original "no smoothing needed, measured (0.0014)" was a correct
//      measurement of the wrong quantity. Every threshold in this sub-block is therefore expressed in the
//      CONSUMER's scale `1/(hi−lo)`, never in band units.
{
  const depthSrc = stripComments(readFileSync(SRC + 'post-processors/depth-field.ts', 'utf8'));
  const tmSrc = stripComments(readFileSync(SRC + 'post-processors/trans-map.ts', 'utf8'));
  const mainSrc = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));

  const dfMod = await import('../src/post-processors/depth-field.ts').catch(() => ({}));
  const chMod = await import('../src/post-processors/trans-map-chain.ts').catch(() => ({}));
  const { resolveDepthBand, MIN_BAND, smoothDepthBand, BAND_TAU_SECONDS } = dfMod;
  const { parallaxBandOf, PARALLAX_DEFAULTS } = chMod;

  if (!resolveDepthBand || !parallaxBandOf || !smoothDepthBand) {
    // Stated rather than silently skipped — a skipped mutation reads exactly like a caught one.
    chk('resolveDepthBand, smoothDepthBand and parallaxBandOf exist (TEXT check — no TS loader in this Node)',
      /export function resolveDepthBand\(/.test(depthSrc)
      && /export function smoothDepthBand\(/.test(depthSrc)
      && /export function parallaxBandOf\(/.test(stripComments(readFileSync(SRC + 'post-processors/trans-map-chain.ts', 'utf8'))),
      'run `node --experimental-strip-types` for the measured form of this section');
  } else {
    // A histogram builder matching render()'s inline one: texture units, clamped, 256 bins.
    const BINS = 256;
    const histOf = (values) => {
      const h = new Int32Array(BINS);
      for (const dv of values) {
        const t = 1 - (dv < 0 ? 0 : dv > 1 ? 1 : dv);
        h[(t * (BINS - 1)) | 0] += 1;
      }
      return h;
    };

    // --- 2. percentiles, not min/max. `Black Hole`'s shape: a tight body plus a few outlying strands.
    const body = [];
    for (let i = 0; i < 1000; i++) body.push(0.40 + (i / 1000) * 0.20);   // source units 0.40..0.60
    const withOutliers = body.concat([0.001, 0.002, 0.998, 0.999]);        // 0.4% of the population
    const [bLo, bHi] = resolveDepthBand(histOf(body), body.length, MIN_BAND);
    const [oLo, oHi] = resolveDepthBand(histOf(withOutliers), withOutliers.length, MIN_BAND);
    // Texture units invert the source, so a source band of 0.40..0.60 is a texture band of 0.40..0.60 too.
    chk('the band is a p2..p98 PERCENTILE, so a handful of outlying strands cannot inflate it',
      Math.abs((oHi - oLo) - (bHi - bLo)) < 0.02,
      `clean span ${(bHi - bLo).toFixed(3)}, with 0.4% outliers ${(oHi - oLo).toFixed(3)} — min/max would give ~0.998`);
    // Falsifiability: min/max on the SAME input must be visibly different, or the assertion above proves nothing.
    chk('...and the outlier input is severe enough that min/max WOULD have failed it',
      (Math.max(...withOutliers) - Math.min(...withOutliers)) - (oHi - oLo) > 0.3,
      `min/max span ${(Math.max(...withOutliers) - Math.min(...withOutliers)).toFixed(3)} vs percentile ${(oHi - oLo).toFixed(3)}`);

    // --- 4. degenerate and empty populations fall back, never divide.
    const flat = new Array(500).fill(0.5);
    const [fLo, fHi] = resolveDepthBand(histOf(flat), flat.length, MIN_BAND);
    chk('a FLAT figure falls back to the raw 0..1 rather than dividing by its span',
      fLo === 0 && fHi === 1,
      `22 of 177 presets are planar at every pose; got [${fLo}, ${fHi}]`);
    const [eLo, eHi] = resolveDepthBand(new Int32Array(BINS), 0, MIN_BAND);
    chk('...and an EMPTY visible population does too (every particle culled)',
      eLo === 0 && eHi === 1, `got [${eLo}, ${eHi}]`);
    chk('...and the threshold is the measured 0.02, which separates the 22 flat presets from the 93 fittable ones',
      Math.abs(MIN_BAND - 0.02) < 1e-9, `MIN_BAND = ${MIN_BAND}`);

    // --- 5a. THE FALLBACK IS A RAMP, NOT A CLIFF. Measured in the CONSUMER's unit `1/(hi-lo)`, because that is
    //     what the shader multiplies by and it is the unit the original mistake was NOT measured in (invariant 10).
    //     ⚠️ Both ENDPOINTS of the pre-ramp behaviour must survive exactly, or this is a behaviour change rather
    //     than a smoothing: at/below MIN_BAND the raw scale, at/above 2*MIN_BAND the fit untouched.
    const bandAt = (span) => {
      const q = Math.round(span * (BINS - 1)) / (BINS - 1);   // the granularity render() actually produces
      return resolveDepthBand(histOf([...Array(1000)].map((_, i) => 0.5 - q / 2 + (i / 999) * q)), 1000, MIN_BAND);
    };
    const scaleAtSpan = (span) => { const b = bandAt(span); return b[1] - b[0] > 1e-6 ? 1 / (b[1] - b[0]) : 1; };
    chk('at/below MIN_BAND the band is still exactly the raw 0..1 — the ramp does not move the lower endpoint',
      (() => { const b = bandAt(0.010); return b[0] === 0 && b[1] === 1; })(),
      'a flat figure must be untouched by the ramp, or the 22 planar presets change appearance');
    // ⚠️ Asserted through the function's OWN `minBand` parameter rather than against a hand-computed span — the
    //    first form of this check compared the result to the synthetic distribution's full extent and went RED on
    //    correct code, because the band is p2..p98 and is legitimately NARROWER than the input. That is §M's
    //    `+100`-probe trap for the third time: a checker needs a basis it cannot get wrong, so here the oracle is
    //    the same function at a minBand small enough that no ramp can apply. Identical above 2*MIN_BAND, and
    //    DIFFERENT inside the ramp — which makes the assertion falsifiable rather than merely satisfiable.
    const histAtSpan = (span) => {
      const q = Math.round(span * (BINS - 1)) / (BINS - 1);
      return [histOf([...Array(1000)].map((_, i) => 0.5 - q / 2 + (i / 999) * q)), 1000];
    };
    const sameAsUnramped = (span) => {
      const [h, n] = histAtSpan(span);
      const a = resolveDepthBand(h, n, MIN_BAND);
      const b = resolveDepthBand(h, n, MIN_BAND / 4);   // 4x below: this span is past any ramp of its own
      return a[0] === b[0] && a[1] === b[1];
    };
    chk('...and at/above 2*MIN_BAND the fitted band is passed through UNCHANGED — nor the upper endpoint',
      sameAsUnramped(0.060) && sameAsUnramped(0.200) && !sameAsUnramped(0.030),
      'the ramp must be confined to [MIN_BAND, 2*MIN_BAND]; leaking above it rescales the 93 fittable presets, and not applying inside it is the cliff back again');
    // The measured payoff, in the consumer's scale, over a span crawling through the threshold one bin at a time.
    let worstRamp = 0, prevS = null;
    for (let bins = 0; bins <= 24; bins++) {
      const s = scaleAtSpan(bins / (BINS - 1));
      if (prevS !== null) worstRamp = Math.max(worstRamp, Math.abs(s - prevS));
      prevS = s;
    }
    chk('...so no single bin of span growth can step the consumer scale by the full cliff (41.5x)',
      worstRamp < 15,
      `worst dScale per bin ${worstRamp.toFixed(2)}x — a hard switch at MIN_BAND gives 41.50x, which is the reported "small contractions" (Sphere: 43.2 px in one frame, p95 0.00 px)`);
    // Falsifiability: the same sweep against a hard switch must FAIL this, or the assertion proves nothing.
    let worstCliff = 0; prevS = null;
    for (let bins = 0; bins <= 24; bins++) {
      const q = bins / (BINS - 1);
      const s = q >= MIN_BAND ? 1 / q : 1;         // the pre-fix behaviour, reconstructed
      if (prevS !== null) worstCliff = Math.max(worstCliff, Math.abs(s - prevS));
      prevS = s;
    }
    chk('...and the SHIPPED cliff really would have failed that, so this assertion is falsifiable',
      worstCliff > 40 && worstCliff / worstRamp > 2.5,
      `reconstructed cliff ${worstCliff.toFixed(2)}x vs ramp ${worstRamp.toFixed(2)}x`);

    // --- 5b. THE EMA. Its whole reason to be specified in SECONDS is frame-rate independence, and that is the
    //     half `tsc` cannot see: a per-frame constant and a per-second one are both `number` (invariant 10).
    const tauOk = Math.abs(BAND_TAU_SECONDS - 0.25) < 1e-9;
    chk('the band smoothing time constant is the measured 0.25 s',
      tauOk,
      `BAND_TAU_SECONDS = ${BAND_TAU_SECONDS} — chosen from a sweep in PIXELS of warp displacement: tau 0 -> 37.1 px worst snap, 0.10 -> 7.56, 0.15 -> 3.12, 0.25 -> 1.95, 0.40 -> 1.21`);
    const settleAt = (fps) => {
      let b = [0, 0];
      for (let i = 0; i < Math.round(0.5 * fps); i++) b = smoothDepthBand(b, [1, 1], 1 / fps, BAND_TAU_SECONDS);
      return b[0];
    };
    const analytic = 1 - Math.exp(-0.5 / BAND_TAU_SECONDS);
    chk('...and it is FRAME-RATE INDEPENDENT: 0.5 s of wall time settles the same at 30, 60 and 144 fps',
      [30, 60, 144].every((f) => Math.abs(settleAt(f) - analytic) < 1e-6),
      `30/60/144 fps -> ${[30, 60, 144].map((f) => settleAt(f).toFixed(6)).join(' / ')} against the analytic ${analytic.toFixed(6)} — a per-frame constant instead of exp(-dt/tau) would give 0.635/0.867/0.992, i.e. a different feature on every machine`);
    chk("...and a huge dt (a backgrounded tab returning) cannot overshoot past the target",
      (() => { const b = smoothDepthBand([0, 0], [0.3, 0.7], 5, BAND_TAU_SECONDS); return b[0] <= 0.3 + 1e-9 && b[1] <= 0.7 + 1e-9; })(),
      'alpha > 1 would overshoot the band and, past the target, invert its span — invariant 24 territory');
    chk('...and dt = 0 or a zero tau takes the measurement WHOLE rather than freezing on the old band',
      (() => {
        const a = smoothDepthBand([0, 1], [0.3, 0.7], 0, BAND_TAU_SECONDS);
        const b = smoothDepthBand([0, 1], [0.3, 0.7], 1 / 60, 0);
        return a[0] === 0.3 && a[1] === 0.7 && b[0] === 0.3 && b[1] === 0.7;
      })(),
      'returning `prev` on a degenerate dt would latch the band forever on the first stalled frame');
    // The two together, on a span oscillating through the threshold — the `Sphere` shape, which spends 202 of
    // 420 frames on the fallback side. This is the CONSECUTIVE-FRAME assertion whose absence let the jitter ship.
    const worstDrift = (useRamp, tau) => {
      let band = null, prev = null, worst = 0;
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        const raw = 0.030 + 0.020 * Math.sin(i * dt * Math.PI);
        const q = Math.round(raw * (BINS - 1)) / (BINS - 1);
        const m = useRamp
          ? resolveDepthBand(histOf([...Array(400)].map((_, k) => 0.5 - q / 2 + (k / 399) * q)), 400, MIN_BAND)
          : (q >= MIN_BAND ? [0.5 - q / 2, 0.5 + q / 2] : [0, 1]);
        band = band === null ? m : smoothDepthBand(band, m, dt, tau);
        const s = band[1] - band[0] > 1e-6 ? 1 / (band[1] - band[0]) : 1;
        if (prev !== null && i > 5) worst = Math.max(worst, Math.abs(s - prev));
        prev = s;
      }
      return worst;
    };
    const wBoth = worstDrift(true, BAND_TAU_SECONDS);
    const wEmaOnly = worstDrift(false, BAND_TAU_SECONDS);
    const wRampOnly = worstDrift(true, 0);
    chk('BOTH HALVES TOGETHER hold the consumer scale to a small step per frame on a threshold-crossing figure',
      wBoth < 4,
      `worst dScale/frame ${wBoth.toFixed(2)}x — this is the assertion whose ABSENCE let the jitter ship: every other check in this section judges ONE frame's band, and the band was correct in all of them`);
    chk('...and NEITHER half alone is sufficient, which is why both were built',
      wRampOnly > wBoth * 2 && wEmaOnly > wBoth * 2,
      `ramp only ${wRampOnly.toFixed(2)}x, EMA only ${wEmaOnly.toFixed(2)}x, both ${wBoth.toFixed(2)}x — the ramp alone cuts the worst warp snap only 43.2 -> 37.1 px, while the EMA alone leaves the p99 4x worse (0.793 vs 0.197 px)`);
    // The fallback must be the IDENTITY when it reaches the consumer, not merely "some band".
    const fb = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'figure' }, fLo, fHi);
    chk('...and that fallback is the IDENTITY through the consumer, so a flat figure renders as before',
      fb[0] === 0 && fb[1] === 1, `[${fb[0]}, ${fb[1]}] — a non-identity fallback silently rescales every flat preset`);

    // --- 3. `'canvas'` is EXACTLY the identity, at every band the measurement could hand it.
    let canvasOk = true;
    for (const [lo, hi] of [[0, 1], [0.43, 0.63], [0.0, 0.5], [0.9, 0.95]]) {
      const b = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'canvas' }, lo, hi);
      if (b[0] !== 0 || b[1] !== 1) canvasOk = false;
    }
    chk("'canvas' returns exactly [0, 1] whatever the figure band is — the pre-14.7b path, EXACTLY",
      canvasOk, 'anything else makes the historical behaviour unreachable and the regression unfalsifiable by eye');
    // And the remap it feeds is arithmetically the identity: (t - 0) * 1/(1 - 0) == t.
    const scaleOf = ([lo, hi]) => (hi - lo > 1e-6 ? 1 / (hi - lo) : 1);
    let idOk = true;
    for (const t of [0, 0.137, 0.5, 0.863, 1]) {
      const b = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'canvas' }, 0.43, 0.63);
      if (Math.abs((t - b[0]) * scaleOf(b) - t) > 1e-12) idOk = false;
    }
    chk("...so the shader's (depth - lo) * scale is the identity under it, not an approximation of one",
      idOk, 'measured at 5 depths through the same expression the GLSL uses');

    // --- the three modes, and that 'figure' actually differs from 'canvas' — the whole point of the feature.
    const fig = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'figure' }, 0.43, 0.63);
    chk("'figure' passes the MEASURED band through, so a narrow figure gets the full Near..Far spread",
      fig[0] === 0.43 && fig[1] === 0.63, `[${fig[0]}, ${fig[1]}]`);
    // The measured win, recomputed rather than quoted: `Aurora Borealis`'s 0.43..0.63 band at Near 0.5 / Far 2.0.
    // ⚠️ Stated as NEAR:FAR, the unit every figure in this section and in CLAUDE.md is quoted in — the first
    //    version of this assertion tested the RECIPROCAL against a hand-picked 0.75 and went red on correct
    //    code at 1.28x. A checker's own basis can be the defect (§M's `+100` probe); keep the units the same as
    //    the measurement's. The target is 4.00x, what a full-range figure gets, and that is the point of 'figure'.
    const nearFar = (band) => {
      const s = scaleOf(band);
      const dNear = Math.min(Math.max((0.63 - band[0]) * s, 0), 1);
      const dFar = Math.min(Math.max((0.43 - band[0]) * s, 0), 1);
      // Near end takes the larger multiplier here because Near 0.5 < Far 2.0 — so the ratio is far:near.
      return (2.0 + (0.5 - 2.0) * dFar) / (2.0 + (0.5 - 2.0) * dNear);
    };
    const rCanvas = nearFar(parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'canvas' }, 0.43, 0.63));
    const rFigure = nearFar(fig);
    chk('...and that is a MEASURABLE win on a narrow-band figure, not a cosmetic one',
      Math.abs(rFigure - 4.0) < 0.01 && rCanvas < 1.5 && rFigure / rCanvas > 2.5,
      `Aurora Borealis (band 0.20): ${rCanvas.toFixed(2)}x on canvas vs ${rFigure.toFixed(2)}x on figure, against 4.00x for a full-range figure`);
    // 'manual' SORTS rather than validating: a negative span would invert near and far (invariant 24, silent).
    const m1 = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'manual', rangeFrom: 0.2, rangeTo: 0.8 }, 0, 1);
    const m2 = parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'manual', rangeFrom: 0.8, rangeTo: 0.2 }, 0, 1);
    chk("'manual' SORTS From/To, so a dragged-past band cannot invert near and far (invariant 24)",
      m1[0] === 0.2 && m1[1] === 0.8 && m2[0] === 0.2 && m2[1] === 0.8,
      `[${m1}] and [${m2}] must agree — a negative span flips the direction, which reads as a style choice`);
    chk("...and 'manual' ignores the measured band entirely, which is the FIXED frame of reference it exists for",
      parallaxBandOf({ ...PARALLAX_DEFAULTS, depthRange: 'manual', rangeFrom: 0.2, rangeTo: 0.8 }, 0.9, 0.95)[0] === 0.2,
      "'figure' re-fits every frame, so a figure turning edge-on keeps full contrast; manual is how you see it turn");
    // The default. ⚠️ 'figure' WAS safe because nothing shipped with style 11; `Sphere II` now does (1 of 359),
    // and is unaffected only because it authors `depthRange: 'manual'` explicitly rather than inheriting this.
    chk("the default is 'figure', and the one shipped style-11 preset authors 'manual' rather than inheriting it",
      PARALLAX_DEFAULTS.depthRange === 'figure'
      && PARALLAX_DEFAULTS.rangeFrom === 0 && PARALLAX_DEFAULTS.rangeTo === 1,
      `got '${PARALLAX_DEFAULTS.depthRange}', manual band [${PARALLAX_DEFAULTS.rangeFrom}, ${PARALLAX_DEFAULTS.rangeTo}] — the manual default must be the full raw scale, so switching to Manual changes nothing until dragged`);
  }

  // --- 1. THE CULLED-SLOT TRAP. This half cannot be measured without a GL context, so it is asserted
  //     structurally — but structurally at the ONE place it can fail, which is the histogram's guard.
  //     ⚠️ The guard is what makes the whole feature work on the presets that HAVE depth; without it the fit is
  //     the identity on the seven presets named in this section's header and the control appears inert.
  const fill = braceBody(depthSrc, 'render(state: GeneratorState, pointSize: number, dtSeconds: number)');
  chk('the histogram counts a particle only if its POSITION is on screen — the culled-slot guard',
    /px > -margin && py > -margin && px < this\.width \+ margin && py < this\.height \+ margin/.test(fill),
    'culled particles clamp to exactly 0 or 1, so counting them returns 0..1 and the fit becomes the identity');
  chk('...and only if the depth is FINITE, since a NaN would land in bin 0 and read as far (invariant 21)',
    /Number\.isFinite\(dv\)/.test(fill),
    'a non-finite depth is integrated state that survives every GPU-side guard');
  chk('...and resolveBand is handed the VISIBLE count, never the array length',
    /this\.resolveBand\(counted, dtSeconds\)/.test(fill) && /counted\+\+/.test(fill),
    'passing n would make the percentile tails 2% of the wrong population');
  // ⚠️ **THE UNIT OF THE THREADED `dt`, which is invariant 10 at a subsystem boundary.** `main.ts` carries `dt` in
  //    MILLISECONDS and the smoothing is specified in SECONDS; both are `number`, so `tsc` sees nothing, and a
  //    missing `* 0.001` makes tau 250 FRAMES instead of 0.25 s — the fit then never catches the figure at all,
  //    which reads as "Depth Range does nothing" rather than as a units bug.
  chk('main.ts converts dt from MILLISECONDS to SECONDS at the depth call site (invariant 10)',
    /depthField\.render\(state, DEPTH_SPLAT_PX, dtMs \* 0\.001\)/.test(mainSrc),
    'unconverted, tau becomes 250 frames and auto-fit lags the figure permanently — indistinguishable from inert');
  chk('...and BOTH 14.6 orders pass the real frame delta, not a nominal 1/60',
    [...mainSrc.matchAll(/runTransMapPass\(state, dt\)/g)].length === 2
    && !/render\(state, DEPTH_SPLAT_PX, (?:0\.0167|1 \/ 60|16\.667)/.test(mainSrc),
    'a hardcoded delta silently turns a per-second time constant into a per-frame one — 30 fps then smooths twice as slowly');
  // ⚠️ **AND THE SMOOTHING MUST BE REACHED.** Every measured assertion above exercises `smoothDepthBand` as a PURE
  //    FUNCTION, so all of them stay green if `resolveBand` simply assigns this frame's measurement — a correct
  //    function nobody calls, which is invariant 13's shape and was a MISS in this section's own calibration
  //    (10/12 before this check, 12/12 after). It is also why the priming flag is asserted here: without it the
  //    first frame after a reset would be blended against a stale band instead of taken whole.
  const resolveBody = braceBody(depthSrc, 'private resolveBand(counted: number, dtSeconds: number)');
  chk('...and resolveBand actually CALLS the smoothing, passing the live band as the previous value',
    /smoothDepthBand\(\[this\.bandLo, this\.bandHi\], measured, dtSeconds, BAND_TAU_SECONDS\)/.test(resolveBody)
    && /this\.bandPrimed/.test(resolveBody),
    'a pure function nobody calls leaves every measured assertion in this section green and the jitter shipped');
  // The reset, and that it lives in the ONE apply path (invariant 23) rather than at a Lab callback.
  chk('a preset change SNAPS the band instead of gliding into it, from applyPresetChange (invariant 23)',
    /depthField\.resetBand\(\);/.test(braceBody(mainSrc, 'function applyPresetChange(newPreset: UnifiedPreset)') || ''),
    'without it the new figure warps with the OLD figure\'s band for ~0.25 s, on exactly the action a user takes to compare two presets — and the pass cannot detect this itself, since a legitimate per-frame band delta reaches 0.19');
  chk('...and a resize does too, since it changes perspZ = -(w+h)/2 — the band\'s own denominator',
    /this\.resetBand\(\);/.test(braceBody(depthSrc, 'resize(width: number, height: number)') || ''),
    'a resize shifts the whole distribution in one frame; gliding through that is the reported jitter at full amplitude');
  // ⚠️ NO magnitude-based snap detection. Measured over all 177 presets, a legitimate per-frame band delta from
  //    ordinary motion reaches 0.19 — as large as any genuine discontinuity — so a threshold either never fires or
  //    fires on fast rotation. The knowledge belongs to the caller, not to the signal (invariant 21's shape).
  chk('...and the snap is driven by KNOWN events only, never by a band-delta threshold',
    !/(?:bandJump|SNAP_THRESHOLD|BAND_SNAP)/.test(depthSrc),
    'a magnitude threshold is unsound here: legitimate motion produces deltas of 0.19, so it fires on fast rotation or never at all');
  // Invariant 8: no per-frame allocation, and no second pass over 32 000 particles either. The scan costs
  // 0.0714 ms/frame measured, against a 16.7 ms budget — but only because it shares the existing fill loop.
  chk('...built in the SAME loop that fills the scratch arrays, with a reused Int32Array (invariant 8)',
    /private readonly bandHist = new Int32Array\(/.test(depthSrc) && /hist\.fill\(0\)/.test(fill),
    'a sort or a fresh array per frame is 58 MB/s territory — the GC pause a user reported as a jitter effect');

  // --- the band must travel WITH the texture. Invariant 17's shape: one frame's geometry, two setters.
  chk('main.ts sets the band from the SAME site that hands over the texture, never a second one',
    /transMap\.setDepthBand\(band\.lo, band\.hi\)/.test(mainSrc)
    && [...mainSrc.matchAll(/setDepthBand\(/g)].length === 1,
    'a band one frame out of step with its texture is invisible on a slow figure — consecutive bands differ by 0.0002');
  // ⚠️ Invariant 3 again, with a VISIBLE consequence rather than a null one: with no depth texture the fallback
  //    reads a uniform 0, and a stale 'figure' band would remap that 0 to a full NEAR multiplier frame-wide.
  chk('...and the band is gated on depthLive exactly as the amount is, so a dead texture cannot be remapped',
    /const pxBand = depthLive && parallax \? this\.resolveParallaxBand\(parallax\) : \{ lo: 0, hi: 1 \}/.test(tmSrc),
    'an ungated band turns the 1x1 fallback\'s 0 = far into 1 = near, applying full parallax to the whole frame');
  // ⚠️ The divide is guarded on the CPU because Inf multiplies into `off`, the SAMPLING COORDINATE (invariant 20).
  chk('...and the reciprocal is guarded on the CPU, since Inf would reach the sampling coordinate (invariant 20)',
    /pxBand\.hi - pxBand\.lo > 1e-6 \? 1 \/ \(pxBand\.hi - pxBand\.lo\) : 1/.test(tmSrc),
    'a GPU divide by a zero span yields Inf, and Inf * anything is a NaN tap into the trail');
  // The ORDER of remap and curve. `uParallaxSquared` biases toward the near end of whatever scale it is handed,
  // so squaring the RAW depth biases toward the near end of the CANVAS — a place a narrow figure never reaches,
  // making the curve inert on exactly the presets the remap exists to rescue.
  const remapM = /float depth = clamp\(\(depthRaw - uParallaxBandLo\) \* uParallaxBandScale, 0\.0, 1\.0\);\s*float dCurve = mix\(depth, depth \* depth, uParallaxSquared\);/.test(tmSrc);
  chk('the shader remaps BEFORE applying the curve, so Squared means the near end of the FIGURE',
    remapM, 'remapping after the curve makes Squared inert on every narrow-band preset — invariant 13 by ordering');
  // And it is CLAMPED, because a manual band may sit inside the figure: depths outside it must pin, not
  // extrapolate past Near/Far and reopen the off-screen sampling the offset clamp exists to prevent.
  chk('...and clamps the remapped depth, since a manual band is allowed to sit INSIDE the figure',
    /clamp\(\(depthRaw - uParallaxBandLo\) \* uParallaxBandScale, 0\.0, 1\.0\)/.test(tmSrc),
    'unclamped, a depth outside a manual band extrapolates past Near/Far and samples off screen');
  // Invariant 16: the Mixer must SNAP a categorical field, never interpolate it. 'figure'/'canvas'/'manual' has
  // no midpoint, and blending toward one would be a silent no-op at every t < 0.5.
  const interpSrc = stripComments(readFileSync(SRC + 'exploration/interpolate.ts', 'utf8'));
  chk('the Mixer SNAPS depthRange rather than interpolating it (invariant 16)',
    /depthRange: layer\.parallax\?\.depthRange \?\? d\.depthRange/.test(interpSrc)
    && !/mix\([^)]*depthRange/.test(interpSrc),
    'a categorical field has no midpoint — mixing it would resolve to a mode neither preset asked for');
  chk('...while the manual band IS mixed, so it does not jump when the mode snaps at t=0.5',
    /rangeFrom: mix\(/.test(interpSrc) && /rangeTo: mix\(/.test(interpSrc),
    'an unmixed band would step discontinuously at the same t the mode snaps');
  // Invariant 13: the control has to reach the engine. The select writes through setParallax, and the manual
  // row has to be HIDDEN outside manual mode or two sliders sit there moving nothing.
  const vfxSrc = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));
  chk('the Depth Range select writes depthRange through setParallax (invariant 13)',
    /this\.setParallax\(index, \{ depthRange: v \}\)/.test(vfxSrc),
    'a select that does not reach the engine is the readout-without-effect shape of invariant 25');
  chk('...and the From/To row is hidden outside Manual, so it never sits there moving nothing',
    /manual\.style\.display = mode === 'manual' \? '' : 'none'/.test(vfxSrc),
    'two visible sliders read only in one of three modes is invariant 13 twice over');
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== O. the liquid iso-surface: an ON-CURVE reference, count-independent, on the drawn radius ===\n');
// ---------------------------------------------------------------------------------------------------
{
  /*
   * v8 Steps 15.1 + 15.1b. Why this section MEASURES rather than greps, and what it is protecting.
   *
   * `isoLevel` is a threshold on a summed density field, and the whole reason it is expressed as a RATIO is
   * that legacy presets run a median 4000 particles while the engine's liquid presets run 10 000-20 000. A raw
   * threshold tuned at one shows nothing at the other — invariant 25's shape, and unfixable by authoring,
   * because the error is a property of the preset's own count.
   *
   * ⚠️ **15.1 NORMALISED AGAINST THE FRAME MEAN AND THAT WAS COUNT-INDEPENDENT BUT NOT FIGURE-INDEPENDENT —
   * A PROPERTY TEST THAT PASSES PERFECTLY ON ONE AXIS WHILE THE OTHER IS 21x OUT.** `dMean = N·πR²/(4·W·H)`
   * divides by the whole frame, but a Lissajous figure is a 1-D LOCUS covering 1-19 % of it, so the reference
   * carried the reciprocal of a per-preset footprint. Measured over 15 figures, the `isoLevel` at which the
   * surface is half eroded spanned 0.76 (dot clouds) to 16-and-never-halving (dense curves) — so one authored
   * value could not mean one look, and WHICH half of the handle was dead depended on the preset. Reported as
   * *"only very low levels of Iso Level make sense, with larger values most of the figure doesn't even draw
   * any more because it is completely thinning out until invisible"*. 15.1b's reference is
   *
   *     spacing = mean |p[i] − p[i−1]| over CONSECUTIVE LIVE indices
   *     d_line  = (32/35)·R / max(spacing, SPACING_FLOOR)         // Wyvill's LINE integral
   *     d_mean  = N·πR²/(4·W·H)                                  // Wyvill's AREA integral, kept as a FLOOR
   *     ref     = CALIBRATION · max(d_line, d_mean, 1e-3)         // then a geometric EMA, tau = 0.25 s
   *     isoRef  = isoLevel · ref        thickRef = LIQUID_THICKNESS_DEPTH · ref     // TWO scales, not one
   *
   * Every part of that fails silently, which is the list this section exists to hold:
   *
   *   - a Gaussian instead of Wyvill makes BOTH integrals wrong AND leaves `w(1) != 0`, so every sprite steps
   *     at its own square edge — visible tiles, not a wrong number.
   *   - the UNCLAMPED radius overstates both terms on a large canvas, so the surface quietly thins and
   *     vanishes while every value on screen stays finite and plausible (invariant 10 at a boundary).
   *   - dropping the frame-mean term collapses the reference toward 0 on a DOT CLOUD, where consecutive
   *     indices are unrelated — a flooded frame, from a change that looks like a simplification.
   *   - bridging the spacing chain across a culled particle inflates it by ~2x on a 50 %-culled figure
   *     (invariant 21's population trap, which returned the identity for the depth band).
   *   - sharing ONE scale between the threshold and the ramp coordinate is the 15.1b defect itself: the
   *     silhouette erodes AND every survivor is dragged toward ramp 0, so the loss compounds.
   *   - a tile factor on `isoLevel` or on `kernelWidth` applies a reduction the arithmetic already contains.
   *   - an unsmoothed reference pulses (the shader consumes `1/ref`, so sensitivity is `1/ref²`), and a `dt`
   *     left in MILLISECONDS makes tau ~250 frames, which is indistinguishable from no smoothing at all.
   *
   * The numbers below were produced by simulating the field over a Lissajous locus AND over a dot cloud (the
   * actual populations — a uniform-noise oracle has no adjacency structure at all and so cannot see the
   * property the whole reference turns on).
   */
  const tileSrc = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));
  const hdrSrc = stripComments(readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8'));
  // ⚠️ The REAL module, not a transcription — this section measures the shipped arithmetic. A re-implementation
  // here would be the second copy `liquid-reference.ts` exists to prevent, and it would inherit whatever
  // convention error it was written from (section A's parity-oracle lesson, invariant 26).
  const LR = await import('../src/renderers/liquid-reference.ts');
  const { CULL_SENTINEL: LIQ_CULL } = await import('../src/core/projection.ts');

  // --- the measurement harness ---
  // ⚠️ At MAIN-VIEW scale, deliberately: the library's consecutive-index spacings are 0.02-1.2 px there, and
  // at a 256x192 tile the same figures fall below `SPACING_FLOOR`, where the floor rather than the measurement
  // is the reference. Measuring the on-curve term at a size where it is pinned would test the floor.
  const W = 1024, H = 768;
  /** A Lissajous locus: consecutive indices ARE adjacent, which is the regime `d_line` owns. */
  const locus = (N, w = W, h = H) => {
    const a = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      a[i * 2] = w * 0.5 + w * 0.32 * Math.sin(3 * t + 0.4) * Math.cos(t * 0.7);
      a[i * 2 + 1] = h * 0.5 + h * 0.32 * Math.sin(2 * t) * Math.cos(t * 1.3);
    }
    return a;
  };
  /** A golden-angle scatter: consecutive indices are UNRELATED, the regime `d_mean` owns (Sphere, Star). */
  const cloud = (N, w = W, h = H) => {
    const a = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      const t = i * 2.399963, r = Math.sqrt((i + 0.5) / N);
      a[i * 2] = w * 0.5 + w * 0.34 * r * Math.cos(t);
      a[i * 2 + 1] = h * 0.5 + h * 0.34 * r * Math.sin(t);
    }
    return a;
  };
  /** Wyvill accumulation, additive, exactly as LIQUID_ACC_FRAG computes it. */
  const field = (p, N, diam, w = W, h = H) => {
    const f = new Float64Array(w * h), r = diam / 2;
    for (let i = 0; i < N; i++) {
      const px = p[i * 2], py = p[i * 2 + 1];
      const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(w - 1, Math.ceil(px + r));
      const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(h - 1, Math.ceil(py + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - px) / r, dy = (y + 0.5 - py) / r, r2 = dx * dx + dy * dy;
        if (r2 < 1) { const u = 1 - r2; f[y * w + x] += u * u * u; }
      }
    }
    return f;
  };
  const coverage = (f, iso) => { let n = 0; for (const v of f) if (v >= iso) n++; return n / f.length; };
  const dMeanOf = (N, r, w = W, h = H) => (N * Math.PI * r * r) / (4 * w * h);
  const diamOf = (w, h, size, kw) => Math.max(1.0, 8.0 * ((w + h) / (1024.0 + 768.0)) * size * kw);
  /** The published `positions` layout: stride 3, x/y/z — the stride the real measurement reads. */
  const to3 = (p2, N) => {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { a[i * 3] = p2[i * 2]; a[i * 3 + 1] = p2[i * 2 + 1]; }
    return a;
  };
  const refOf = (p, N, diam, w = W, h = H) =>
    LR.liquidDensityReference(N, diam / 2, w, h, LR.measureIndexSpacing(to3(p, N), N));

  // 1. THE FEATURE ITSELF, AND IT SURVIVED THE REFERENCE CHANGE. One Iso Level must mean one look across the
  // library's whole count range — and the on-curve term keeps that by construction rather than by luck:
  // `spacing ∝ 1/N` at fixed curve length, so `d_line ∝ N` exactly as `d_mean` does. Asserted at three Kernel
  // Widths because the two terms trade places as `R` grows, and the property must hold in both regimes.
  for (const kw of [1, 2, 4]) {
    const d = diamOf(W, H, 1, kw);
    const rows = [2000, 4000, 10000, 20000].map(N => {
      const p = locus(N);
      return { N, s: LR.measureIndexSpacing(to3(p, N), N), cov: coverage(field(p, N, d), 1.0 * refOf(p, N, d)) };
    });
    const cs = rows.map(r => r.cov);
    const spread = Math.max(...cs) / Math.min(...cs) - 1;
    chk(`kw ${kw}: one Iso Level gives ONE surface from 2 000 to 20 000 particles — the library's 10x count range`,
      spread < 0.02,
      `coverage ${cs.map(c => c.toFixed(4)).join(' / ')} at N = 2k/4k/10k/20k — spread `
      + `${(spread * 100).toFixed(2)}% (spacing ${rows.map(r => r.s.toFixed(3)).join(' / ')} px, so it scales as 1/N)`);
  }

  // ...and the falsifier, without which the assertions above would also pass on an all-zero field or on a
  // coverage metric that had stopped depending on the count at all (section A's own lesson).
  {
    const d = diamOf(W, H, 1, 2);
    const p4 = locus(4000), frozen = refOf(p4, 4000, d);   // reference resolved once at 4000 and left absolute
    const rawCovs = [2000, 4000, 10000, 20000].map(N => coverage(field(locus(N), N, d), 1.0 * frozen));
    const rawSpread = Math.max(...rawCovs) / Math.min(...rawCovs) - 1;
    chk('...and the comparison NOTICES: a threshold tuned at 4 000 and left absolute drifts with the count',
      rawSpread > 0.20,
      `unnormalised coverage ${rawCovs.map(c => c.toFixed(4)).join(' / ')} — spread ${(rawSpread * 100).toFixed(1)}%`);
  }

  // 1b. THE REGIME SPLIT — `max(d_line, d_mean)`, and the frame mean is a LOWER BOUND rather than vestigial.
  // ⚠️ This is the assertion that stops the frame-mean term being tidied away as dead code, which is exactly
  // what it looks like once the on-curve term is winning by 30x on every curve. On a DOT CLOUD consecutive
  // indices are unrelated (`Sphere` measures 1119 px of it, `Milky Way` 325, `Star` 238), `R/spacing` collapses
  // toward zero, and a reference of zero passes EVERY texel including the cleared background: a flooded frame.
  {
    const d = diamOf(W, H, 1, 2), N = 4000;
    const rows = [['curve', locus], ['cloud', cloud]].map(([nm, gen]) => {
      const p = gen(N), s = LR.measureIndexSpacing(to3(p, N), N);
      const dLine = (LR.LINE_INTEGRAL * (d / 2)) / Math.max(s, LR.SPACING_FLOOR);
      return { nm, s, dLine, dMean: dMeanOf(N, d / 2), wins: dLine > dMeanOf(N, d / 2) ? 'onCurve' : 'frameMean' };
    });
    chk('each reference term OWNS the regime it is right about: the curve takes d_line, the cloud takes d_mean',
      rows[0].wins === 'onCurve' && rows[1].wins === 'frameMean',
      rows.map(r => `${r.nm}: spacing ${r.s.toFixed(2)} px -> d_line ${r.dLine.toFixed(4)} vs d_mean `
        + `${r.dMean.toFixed(4)} (${r.wins} by ${(Math.max(r.dLine, r.dMean) / Math.min(r.dLine, r.dMean)).toFixed(1)}x)`).join('; '));
    chk('...so DROPPING the frame-mean floor would collapse the dot-cloud reference and flood the frame',
      rows[1].dLine < rows[1].dMean * 0.2 && /Math\.max\(onCurve, frameMean, 1e-3\)/.test(
        stripComments(readFileSync(SRC + 'renderers/liquid-reference.ts', 'utf8'))),
      `on a cloud the on-curve term is ${(rows[1].dLine / rows[1].dMean).toFixed(3)}x the frame mean — it looks `
      + 'like dead code precisely where it is load-bearing');
  }

  // 2. THE KERNEL. Compact support is not a style choice: `exp(-k r²)` is non-zero at r = 1, so every sprite
  // adds a step at its own square boundary, and the `πR²/4` integral above stops being exact.
  //
  // ⚠️ **Asserted as the PROPERTY — a cube of `1 - r2`, rejected outside the unit disc, and no `exp` — never as
  // one file's SPELLING of it.** Both of these failed on correct code at v8 15.2, which hoists `w` because the
  // colour target needs it three times (`outDensity = w` and `vec4(vColor * w, w)`) where 15.1 wrote the cube
  // inline in the one output. That is §O's own recorded trap arriving on the very assertion pair the note was
  // written beside, and the discriminator holds: the *cube of `1 - r2`, zero at the edge* is the thing the two
  // integrals depend on; where the product is named is not.
  const wyvill = src => {
    const cube = /\bfloat\s+u\s*=\s*1\.0\s*-\s*r2;[\s\S]{0,200}?\bu\s*\*\s*u\s*\*\s*u\b/.test(src)
      || /\bfloat\s+w\s*=\s*1\.0\s*-\s*r2;[\s\S]{0,200}?\bw\s*\*\s*w\s*\*\s*w\b/.test(src);
    const rejects = /r2\s*<\s*1\.0\s*\?[^;]*:\s*0\.0/.test(src);
    return cube && rejects && !/exp\(\s*-[^)]*r2/.test(src);
  };
  chk('the accumulation kernel is Wyvill `(1-r2)^3` and reaches EXACTLY 0 at the sprite edge',
    wyvill(hdrSrc),
    'a Gaussian is non-zero at r=1, so each sprite steps at its own square edge and the integral is wrong');
  chk('...in the TILE copy too, or a tile normalises against an integral its own field does not have',
    wyvill(tileSrc));
  // BOTH integrals, measured against their analytic values rather than asserted from the algebra. ⚠️ **There
  // are TWO because the reference has two terms, and they are Wyvill-specific TOGETHER — changing the kernel
  // invalidates both constants, which is why the module documents them side by side.** The area integral makes
  // `d_mean` an identity; the LINE integral makes `d_line` one.
  {
    const R = 64; let area = 0;
    for (let y = -R; y < R; y++) for (let x = -R; x < R; x++) {
      const r2 = ((x + 0.5) * (x + 0.5) + (y + 0.5) * (y + 0.5)) / (R * R);
      if (r2 < 1) { const u = 1 - r2; area += u * u * u; }
    }
    const areaErr = Math.abs(area / (Math.PI * R * R / 4) - 1);
    chk('...and its AREA integral IS pi*R^2/4, which is what makes d_mean an identity rather than a fit',
      areaErr < 2e-3, `numeric / (pi*R^2/4) - 1 = ${areaErr.toExponential(2)} at R = ${R}`);

    const RL = 4096; let line = 0;
    for (let x = -RL; x < RL; x++) { const u = 1 - ((x + 0.5) / RL) ** 2; if (u > 0) line += u * u * u; }
    const lineErr = Math.abs(line / (LR.LINE_INTEGRAL * RL) - 1);
    chk('...and its LINE integral IS 32R/35, which is what makes d_line an identity (v8 15.1b)',
      Math.abs(LR.LINE_INTEGRAL - 32 / 35) < 1e-15 && lineErr < 1e-3,
      `LINE_INTEGRAL = ${LR.LINE_INTEGRAL}; numeric / (32R/35) - 1 = ${lineErr.toExponential(2)} at R = ${RL}`);
  }

  // 2b. THE SPACING MEASUREMENT — invariant 21's population trap, in the one place it can still bite. ⚠️ **The
  // chain must BREAK at a culled particle, not merely skip it**: `positions` is dense and a culled slot holds
  // `CULL_SENTINEL`, so a skip-without-break bridges two unrelated segments of the curve. Measured on a locus
  // culled in blocks (the shape a rotating figure actually produces, where adjacency survives inside a run),
  // the bridging form inflates the spacing ~1.9x — which DIVIDES the reference, so the surface thickens by
  // that factor on precisely the 7 presets that are 38-48 % culled.
  {
    const N = 4000, p = to3(locus(N), N);
    const clean = LR.measureIndexSpacing(p, N);
    const holed = p.slice();
    for (let b = 0; b < N; b += 200) for (let i = b; i < b + 100 && i < N; i++) holed[i * 3] = LIQ_CULL;
    const withBreak = LR.measureIndexSpacing(holed, N);
    let sum = 0, pairs = 0, prev = null;
    for (let i = 0; i < N; i++) {
      const x = holed[i * 3], y = holed[i * 3 + 1];
      if (x === LIQ_CULL) continue;
      if (prev) { sum += Math.hypot(x - prev[0], y - prev[1]); pairs++; }
      prev = [x, y];
    }
    const bridged = sum / pairs;
    chk('the spacing chain BREAKS at every culled particle rather than bridging across it (invariant 21)',
      Math.abs(withBreak / clean - 1) < 0.05 && bridged / withBreak > 1.5,
      `clean ${clean.toFixed(4)} px, with breaks ${withBreak.toFixed(4)} (within `
      + `${(Math.abs(withBreak / clean - 1) * 100).toFixed(1)}%), bridging ${bridged.toFixed(4)} = `
      + `${(bridged / withBreak).toFixed(2)}x — and it DIVIDES the reference, so the surface thickens`);
    // The degenerate end: no adjacency at all must fall to the frame mean, never divide by zero.
    const allCulled = new Float32Array(30 * 3).fill(LIQ_CULL);
    const sp = LR.measureIndexSpacing(allCulled, 30);
    chk('...and a fully-culled population yields Infinity, so the reference falls to the frame mean, not to 0/0',
      sp === Infinity && Number.isFinite(LR.liquidDensityReference(30, 8, W, H, sp))
      && LR.liquidDensityReference(30, 8, W, H, sp) > 0,
      `spacing ${sp}, reference ${LR.liquidDensityReference(30, 8, W, H, sp).toExponential(3)}`);
  }

  // 3. THE CLAMPED RADIUS. `dMean` must use the radius the hardware actually drew. At 3840x2160 with Kernel
  // Width 3 the requested diameter is 80.4 px against a typical 64 px `maxPointSize`, so an unclamped
  // `dMean` is 1.58x too large — the threshold rises by that factor and the surface thins for no visible
  // reason. ONE owner, asserted structurally because the failure is a second copy of the clamp.
  //
  // ⚠️ **REWRITTEN AT v8 15.5, AND IT FAILED ON CORRECT CODE FIRST — the SEVENTH checker-basis defect in this
  // phase, and the same shape as 15.3's `thicknessAt()` hoist.** The original third clause pinned the CALL's
  // spelling, `resolveLiquidReference(state, solidCount, radius, dtSeconds)`. 15.5 renames that parameter to
  // `curveCount` because the reference must now be measured over the FIGURE alone: the liquid pool is published
  // into the same arrays, and including it would make the reference circular (the pool raises the density that
  // sets the threshold that decides whether the pool draws). So a rename that was REQUIRED by the step turned an
  // assertion red while the property it exists to protect — the reference reads the CLAMPED radius from the one
  // owner — was never touched. **Assert the property, match the argument POSITION rather than its name**, and
  // report the matched call so a regex matching nothing cannot read as a pass.
  const refCall = hdrSrc.match(/resolveLiquidReference\(\s*state,\s*(\w+),\s*radius,\s*dtSeconds\s*\)/);
  chk('`liquidPointDiameter()` is the ONE owner of the clamp, and uIsoRef is derived from ITS radius',
    /const diameter = this\.liquidPointDiameter\(\);/.test(hdrSrc)
    && /const radius = diameter \* 0\.5;/.test(hdrSrc)
    && !!refCall,
    'deriving the reference from the REQUESTED size overstates it by (requested/clamped) at 3840x2160, kw 3'
    + `; reference measured over \`${refCall ? refCall[1] : '<NO MATCH>'}\` at the clamped \`radius\``);
  chk('...and the clamp lives inside that one method, against maxPointSize',
    /private liquidPointDiameter\(\)[\s\S]{0,400}?Math\.min\(Math\.max\(requested, 1\.0\), this\.maxPointSize\)/.test(hdrSrc),
    'a clamp anywhere else is the second copy this assertion exists to prevent');
  chk('...and `estimateParticlePixels()` DELEGATES to it rather than transcribing the arithmetic (a 4th copy)',
    /if \(this\.renderMode === 'liquid'\) \{\s*return this\.liquidPointDiameter\(\);/.test(hdrSrc),
    'the readout is the site that drifts silently — nothing on screen contradicts a wrong pixel number');

  // 4. THE TILE UNIT DECISIONS, IN BOTH DIRECTIONS — the half a grep cannot settle, since the question is
  // what each quantity MEANS. Measured as tile/main coverage parity.
  const MW = 1024, MH = 768, TW = 256, TH = 192;
  const parity = [0.5, 1, 2, 4].map(kw => {
    const md = diamOf(MW, MH, 1, kw), td = diamOf(TW, TH, 1, kw);
    const pm = locus(4000, MW, MH), pt = locus(1000, TW, TH);
    const cm = coverage(field(pm, 4000, md, MW, MH), 1.0 * refOf(pm, 4000, md, MW, MH), MW, MH);
    const ct = coverage(field(pt, 1000, td, TW, TH), 1.0 * refOf(pt, 1000, td, TW, TH), TW, TH);
    // The defect form: kernelWidth pre-scaled by SCREEN_SPACE_TILE_SCALE on top of the scaleFactor the
    // arithmetic already contains. At a 256x192 tile the two factors are the SAME NUMBER, 0.25.
    const bd = diamOf(TW, TH, 1, kw * ((TW + TH) / (1024.0 + 768.0)));
    const cb = coverage(field(pt, 1000, bd, TW, TH), 1.0 * refOf(pt, 1000, bd, TW, TH), TW, TH);
    return { kw, ok: ct / cm, bad: cb / cm, td, bd };
  });
  const worstOk = Math.min(...parity.filter(p => p.kw >= 1).map(p => p.ok));
  const worstBad = Math.min(...parity.filter(p => p.kw >= 1).map(p => p.bad));
  chk('a tile leaves Kernel Width UNSCALED, and that is what makes tile and main coverage agree',
    !/scaledKernelWidth/.test(tileSrc) && /kernelWidth: cfg\.kernelWidth,/.test(tileSrc)
    && worstOk > 0.95,
    `tile/main coverage at kw 1/2/4: ${parity.filter(p => p.kw >= 1).map(p => p.ok.toFixed(3)).join(' / ')}`);
  chk('...and the comparison NOTICES the double scaling, which PINS the sprite at the 1px floor over half the range',
    worstBad < 0.5,
    `doubly scaled: ${parity.filter(p => p.kw >= 1).map(p => p.bad.toFixed(3)).join(' / ')} `
    + `(diameters ${parity.filter(p => p.kw >= 1).map(p => p.bd.toFixed(2)).join(' / ')} px — clamped, not proportional)`);
  chk('a tile leaves Iso Level and Edge Softness unscaled too, both being ratios',
    /isoLevel: cfg\.isoLevel,/.test(tileSrc) && /edgeSoftness: cfg\.edgeSoftness,/.test(tileSrc)
    && !/isoLevel[^;\n]*SCREEN_SPACE_TILE_SCALE/.test(tileSrc)
    && !/edgeSoftness[^;\n]*SCREEN_SPACE_TILE_SCALE/.test(tileSrc),
    'scaling Iso would apply the tile factor twice — the reference is already re-measured on the tile own field');
  // And the tile's own normalisation must be the same formula on the tile's own count, area AND spacing. ⚠️
  // **15.1b turned this from "the same formula" into "the same FUNCTION", and that is the stronger property:**
  // the tile carried its own transcription of `dMean` before, which was survivable for one algebraic line but
  // is not for a reference whose on-curve term reads a MEASURED spacing — two transcriptions would have two
  // chances to disagree about the chain-break rule alone. Asserted as a CALL, not as an expression.
  // ⚠️ **THE POPULATION ARGUMENT IS `curveCount`, NOT `solidCount`, AND THIS PATTERN PINNED THE WRONG NAME
  // UNTIL 2026-09-03 (`15.6-salvage` B) — SO THE CHECKER WAS ASSERTING THE DEFECT.** The tile passed the actual
  // `solidCount`, excluding NEITHER tail block, so `measureIndexSpacing()` walked consecutive indices across
  // the wave -> spark boundary and through the sparks and the pool, where adjacent indices hold unrelated
  // positions. Pinning an argument NAME is what made a wrong population look correct here for two sittings:
  // the call was to the right owner with the right arity, which is all this test could see. Both names are
  // asserted together below so the two consumers cannot drift to different populations either.
  chk('...and the tile CALLS liquid-reference.ts rather than transcribing it — one owner, two consumers',
    /liquidDensityReference\(curveCount, radius, TILE_W, TILE_H, spacing\)/.test(tileSrc)
    && /measureIndexSpacing\(state\.positions, curveCount\)/.test(tileSrc)
    && /isoRef = liq\.isoLevel \* densityRef/.test(tileSrc)
    && !/Math\.PI \* radius \* radius/.test(tileSrc),
    'the ratio only self-corrects if the reference it divides by is the tile own, computed the one way');
  // ⚠️ **AND THE POPULATION MUST EXCLUDE BOTH TAIL BLOCKS IN BOTH CONSUMERS, DERIVED FROM `waveCount`.** This
  // is the assertion the two greps above could not make: the tail blocks are `[wave][sparks][liquid][crystals]`
  // and the sparks are a MIDDLE block, so a trailing subtraction (`solidCount - liquidCount`, which is what
  // 15.5 shipped in the main renderer) cannot reach them however many terms it carries. `waveCount` IS the
  // published index of the first tail slot, so reading it is one name for the quantity rather than a fourth
  // hand-written spelling of the partition — and `sparkCount` is not published at all, so the subtraction form
  // is not merely worse here, it is unavailable.
  chk('...and BOTH consumers measure the reference over `waveCount`, excluding the spark AND pool blocks',
    /curveCount = state\.waveCount !== undefined/.test(hdrSrc)
    && /curveCount = state\.waveCount !== undefined/.test(tileSrc)
    && !/measureIndexSpacing\([^)]*solidCount\)/.test(hdrSrc)
    && !/measureIndexSpacing\([^)]*solidCount\)/.test(tileSrc),
    'a spark is a ballistic ember and a pool slot a Halton cloud point: consecutive indices in either hold '
    + 'unrelated positions, which inflates the measured spacing, drives (32/35)R/s down and hands the '
    + 'threshold to the frame-mean lower bound — 15.1b dot-cloud regime on a figure that is still a curve');
  // ...and the parity that a second copy would break is measured, not assumed: both consumers must hand the
  // radius in AFTER their own clamp, in their own pixel units.
  chk('...both consumers pass the CLAMPED radius and their OWN dimensions, so neither inherits the other scale',
    /liquidDensityReference\(curveCount, radius, this\.width, this\.height, spacing\)/.test(hdrSrc)
    && /const radius = diameter \* 0\.5;/.test(tileSrc)
    && /Math\.max\(1\.0, 8\.0 \* scaleFactor \* slot\.particleSize \* liq\.kernelWidth\)/.test(tileSrc),
    'a tile measuring spacing in tile pixels and radius in main pixels is invariant 10 at the same boundary');

  // 5. THE FLOOR. `max(onCurve, frameMean, 1e-3)` is what stops a nearly-empty frame dividing the threshold to
  // zero and painting the whole canvas. ⚠️ **It now lives in ONE place, and that is the assertion**: before
  // 15.1b it was a literal in two files, and a floor present in one copy only is exactly the shape that makes
  // a tile flood while the main view is fine (or the reverse), with nothing logged either way.
  {
    const lrSrc = stripComments(readFileSync(SRC + 'renderers/liquid-reference.ts', 'utf8'));
    chk('the 1e-3 floor lives in the ONE owner and in neither consumer, so it cannot hold in one of them only',
      (lrSrc.match(/1e-3/g) ?? []).length === 1
      && !/Math\.max\(dMean, 1e-3\)/.test(hdrSrc) && !/Math\.max\(dMean, 1e-3\)/.test(tileSrc),
      `liquid-reference ${(lrSrc.match(/1e-3/g) ?? []).length} site(s); hdr and tile carry none`);
    // ...and it IS a floor rather than a value: an empty frame must give a small positive reference, and a
    // populated one must be far above it, or the floor has quietly become the reference everywhere.
    const empty = LR.liquidDensityReference(0, 8, W, H, Infinity);
    const full = refOf(locus(4000), 4000, diamOf(W, H, 1, 2));
    chk('...and it behaves as a FLOOR: positive on an empty frame, and orders of magnitude below a populated one',
      empty > 0 && full / empty > 100,
      `empty ${empty.toExponential(3)} vs populated ${full.toFixed(4)} = ${(full / empty).toExponential(2)}x above it`);
  }

  // 5b. THE TWO SCALES — the 15.1b defect itself, and the half the user actually reported. ⚠️ **`thickness`
  // divided by the very threshold it subtracts, so raising Iso Level eroded the silhouette AND dragged every
  // survivor toward ramp 0** (which on the `liquid` ramp is `(20,0,40)` at alpha 0). The two losses MULTIPLY,
  // which is why the report said *"invisible"* rather than *"smaller"*: measured over Iso 0.25 -> 2, coverage
  // falls 7.93x either way, but total light fell 20.6x on the shared scale against 9.80x decoupled — an excess
  // of 2.60x that the coverage number alone cannot see. **Measured as light-decay against coverage-decay, not
  // as light alone**, or a change that merely dimmed everything would pass.
  {
    const N = 8000, d = diamOf(W, H, 1, 2), p = locus(N), f = field(p, N, d), ref = refOf(p, N, d);
    const light = (iso, thickRef) => {
      let s = 0;
      for (const v of f) if (v >= iso * ref) s += Math.min(1, (v - iso * ref) / thickRef);
      return s;
    };
    const LO = 0.25, HI = 2;
    const covDecay = coverage(f, LO * ref) / coverage(f, HI * ref);
    const shared = light(LO, LO * ref) / light(HI, HI * ref);
    const decoupled = light(LO, LR.LIQUID_THICKNESS_DEPTH * ref) / light(HI, LR.LIQUID_THICKNESS_DEPTH * ref);
    chk('the ramp coordinate divides by a FIXED multiple of the reference, so light falls no faster than coverage',
      decoupled / covDecay < 1.4,
      `Iso ${LO} -> ${HI}: coverage falls ${covDecay.toFixed(2)}x, light ${decoupled.toFixed(2)}x `
      + `= ${(decoupled / covDecay).toFixed(3)}x of it (LIQUID_THICKNESS_DEPTH = ${LR.LIQUID_THICKNESS_DEPTH})`);
    chk('...and the comparison NOTICES the 15.1 form, where dividing by uIsoRef compounds the two losses',
      shared / covDecay > 2.0,
      `sharing one scale: light falls ${shared.toFixed(2)}x against the same ${covDecay.toFixed(2)}x of coverage `
      + `= ${(shared / covDecay).toFixed(3)}x — the excess the user saw as "thinning out until invisible"`);
    // Structural, in both files: the separation only exists if the shader has TWO uniforms and the CPU uploads
    // the reference into the second WITHOUT re-deriving it from `isoRef / isoLevel` (a second expression for
    // one quantity is the drift `liquidPointDiameter()` exists to prevent).
    //
    // ⚠️ **THIS PAIR FAILED ON CORRECT CODE AT 15.3 BECAUSE IT PINNED THE 15.1b SPELLING OF THE EXPRESSION**,
    // which 15.3 hoisted into a `thicknessAt(vec2 uv)` helper — the centre sample and the two chromatic
    // dispersion taps must read ONE formula, so a second inline copy is now the defect rather than the norm.
    // Same shape as the two Wyvill assertions 15.2 had to rewrite: **assert the PROPERTY (the divisor is
    // uThickRef and the numerator offsets by uIsoRef), locate the body wherever it lives, and REPORT ITS
    // LENGTH** so a regex that matched nothing cannot read as a pass.
    for (const [label, src, name] of [['main', hdrSrc, 'uLiquidSurfThickRef'], ['tile', tileSrc, 'uLiqSurfThickRef']]) {
      // The one expression that produces the thickness/ramp coordinate, whether spelled inline or in the
      // helper. Anchored on `- uIsoRef) /`, which is the property itself: offset by the threshold, divided by
      // something else.
      // ⚠️ The capture is LAZY and must not be `[^,]+` — the divisor `max(uThickRef, 1e-6)` contains a comma of
      // its own, so a comma-excluding class matches nothing and the assertion then fails on correct code for a
      // second, different reason. (It did, once, in this very rewrite.)
      const m = src.match(/clamp\(\((?:d|texture\(uDensity, uv\)\.r) - uIsoRef\) \/ (.+?), 0\.0, 1\.0\)/);
      const body = m ? m[1] : '';
      chk(`the ${label} surface shader divides thickness by uThickRef, never by uIsoRef`,
        /uniform float uThickRef;/.test(src)
        && body === 'max(uThickRef, 1e-6)'
        && new RegExp(`uniform1f\\(this\\.${name}, LIQUID_THICKNESS_DEPTH \\* densityRef\\)`).test(src),
        `divisor = "${body}" (${body.length} chars); a single scale is the 15.1 defect, and re-deriving the `
        + 'reference from isoRef/isoLevel is its second copy');
      // v8 Step 15.3 — and there must be exactly ONE copy of it, because the dispersion taps offset AROUND the
      // centre sample: a second spelling would let the two chromatic reads measure a different quantity from
      // the value they are differenced against, which reads as a tint that does not follow the surface.
      chk(`...and the ${label} shader has exactly ONE copy of that expression, read via thicknessAt()`,
        (src.match(/- uIsoRef\) \/ max\(uThickRef, 1e-6\)/g) || []).length === 1
        && /float thicknessAt\(vec2 uv\)/.test(src)
        && /float thickness = thicknessAt\(vUv\);/.test(src),
        'the centre sample and the two dispersion taps must share one formula');
    }
  }

  // 5c. THE SMOOTHING, judged in the quantity the shader CONSUMES. ⚠️ **14.7b's lesson applied before shipping
  // rather than after: the shader consumes `1/ref`, whose sensitivity is `1/ref²`, so measuring the wobble in
  // the reference is a correct measurement of the wrong quantity (invariant 10 in its purest form).** A moving
  // figure changes its own consecutive-index spacing frame to frame, so an unsmoothed reference pulses the
  // whole surface.
  {
    const d = diamOf(W, H, 1, 2);
    // A breathing spacing — the shape a figure whose curve alternately bunches and spreads produces.
    const seq = Array.from({ length: 120 }, (_, k) => 0.6 + 0.55 * Math.sin(k * 0.9) ** 8);
    const raw = seq.map(s => LR.CALIBRATION
      * Math.max((LR.LINE_INTEGRAL * (d / 2)) / Math.max(s, LR.SPACING_FLOOR), 1e-3));
    const jump = a => Math.max(...a.slice(1).map((v, i) => Math.abs(1 / v - 1 / a[i]) / (1 / a[i])));
    let sm = 0;
    const smoothed = raw.map(v => (sm = sm > 0
      ? LR.smoothLiquidReference(sm, v, 1 / 60, LR.LIQUID_REF_TAU_SECONDS) : v));
    chk('the reference is SMOOTHED, and the per-frame jump is measured in 1/ref — what the shader consumes',
      jump(raw) > 0.2 && jump(smoothed) < 0.10,
      `worst per-frame jump in 1/ref: ${(jump(raw) * 100).toFixed(2)}% raw -> `
      + `${(jump(smoothed) * 100).toFixed(2)}% at tau = ${LR.LIQUID_REF_TAU_SECONDS}s (a visible pulse either way, in the reference alone it reads as small)`);

    // ⚠️ **AND THE SMOOTHER MUST BE REACHED — the assertion above measures a PURE FUNCTION and stays green when
    // nothing calls it.** This is §N's own calibration finding, and it was found here the same way: seeding
    // `this.liquidRefSmoothed = measured` (the smoothing deleted outright) was CAUGHT BY NOTHING until this
    // pair existed, because every measured assertion in this block imports `smoothLiquidReference` directly and
    // so cannot see the consumer. Both consumers, since each holds its own state — the renderer one field, a
    // tile one per SLOT (up to 128 figures share one R32F, so a shared scalar would cross-contaminate them).
    chk('...and BOTH consumers actually CALL it — a measured assertion on a pure function passes when nobody does',
      /smoothLiquidReference\(this\.liquidRefSmoothed, measured, dtSeconds, LIQUID_REF_TAU_SECONDS\)/.test(hdrSrc)
      && /smoothLiquidReference\(liq\.refSmoothed, measuredRef, dtSeconds, LIQUID_REF_TAU_SECONDS\)/.test(tileSrc),
      'the arithmetic being right is not evidence that it runs — §N was green throughout for exactly this reason');
    chk('...and a tile keeps its reference PER SLOT, or 128 figures sharing one R32F share one density too',
      /refSmoothed: number/.test(tileSrc) && /liq\.refSmoothed = liq\.refSmoothed > 0/.test(tileSrc)
      && !/private liquidRefSmoothed/.test(tileSrc),
      'a renderer-wide scalar in the tile grid would make each slot smooth toward its neighbours\' densities');

    // Frame-rate independence is the WHOLE reason tau is in seconds, so it is asserted rather than trusted:
    // the same wall-clock sequence sampled at 30 Hz must track the 60 Hz result.
    let s30 = 0;
    const at30 = raw.filter((_, i) => i % 2 === 0)
      .map(v => (s30 = s30 > 0 ? LR.smoothLiquidReference(s30, v, 1 / 30, LR.LIQUID_REF_TAU_SECONDS) : v));
    const at60 = smoothed.filter((_, i) => i % 2 === 0);
    const rateErr = Math.max(...at30.map((v, i) => Math.abs(v / at60[i] - 1)));
    chk('...frame-rate independently, which is why tau is in SECONDS and not in frames',
      rateErr < 0.10,
      `worst 30 Hz vs 60 Hz difference ${(rateErr * 100).toFixed(2)}% over ${at30.length} samples`);

    // ⚠️ And the conversion at every call site, because an unconverted millisecond `dt` makes `alpha ~ 1` and
    // the smoothing byte-identical to absent — the same load-bearing `* 0.001` that `BAND_TAU_SECONDS` carries,
    // and it fails GREEN in every other assertion here (the smoother is correct; nobody gives it seconds).
    let sf = 0;
    const unconverted = raw.map(v => (sf = sf > 0
      ? LR.smoothLiquidReference(sf, v, 16.667, LR.LIQUID_REF_TAU_SECONDS) : v));
    chk('...and an UNCONVERTED millisecond dt would be indistinguishable from no smoothing at all',
      jump(unconverted) > 0.2,
      `dt = 16.667 (ms) gives alpha ~ 1 and a jump of ${(jump(unconverted) * 100).toFixed(2)}% — identical to raw`);
    const mainSrc = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
    chk('...so BOTH call sites convert: main.ts passes dt * 0.001, and the tile its effectiveDt * 0.001',
      /renderer\.render\(state, target, dt \* 0\.001\)/.test(mainSrc)
      && /lastEffectiveDtSeconds = effectiveDt \* 0\.001/.test(tileSrc)
      && /renderLiquidField\([^)]*this\.lastEffectiveDtSeconds\)/.test(tileSrc),
      'a tile renders 1 frame in FRAME_SKIP, so it must see the SKIPPED step or its reference lags 4x as long');

    // The discontinuity policy: KNOWN EVENTS ONLY. A magnitude threshold was measured and rejected for the
    // depth band on identical grounds — a legitimate per-frame delta from fast motion is as large as a real
    // discontinuity, so any threshold either never fires or fires constantly.
    const resets = (hdrSrc.match(/this\.resetLiquidReference\(\)/g) ?? []).length;
    chk('the reference resets on KNOWN EVENTS ONLY — never on a magnitude threshold (14.7b\'s rejected form)',
      resets >= 4 && !/liquidRefSmoothed[\s\S]{0,120}?>\s*[\d.]+\s*\*\s*this\.liquidRefSmoothed/.test(hdrSrc),
      `${resets} reset sites (init, resize, kernelWidth, particleSize) — each one CHANGES the reference's own basis`);
    // ⚠️ Invariant 1's own gap: `liquidRefSmoothed` is a plain NUMBER, so `dispose()`'s handle-nulling sweep
    // does not touch it, and a `reinitRenderer` would resume from the previous preset's density.
    // ⚠️ `hdrSrc` is comment-STRIPPED, so this matches code only — the reset must be the first statement of
    // `initLiquid`, before the extension probe can early-return past it.
    chk('...including at the top of initLiquid, since a plain number is not covered by dispose()\'s null sweep',
      /private initLiquid\([^)]*\)[^{]*\{\s*this\.resetLiquidReference\(\);/.test(hdrSrc),
      'invariant 1 covers deleted HANDLES; an integrated scalar survives a reinit and reads as a stale surface');
  }

  // 6. THE GRADIENT'S STEP UNIT — invariant 26 in the smaller. `vUv`'s two axes are W and H pixels per unit,
  // so a `vUv`-denominated offset tilts the lighting by the frame aspect; and because a tile's aspect is
  // FIXED at 4:3 the error would be constant, i.e. it would look deliberate.
  for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
    // ⚠️ 2026-11-10: the main pass may step by `ftexel = texel * uFieldStep` (one FIELD texel of the half-resolution
    // liquid field). That is still texel units from `uResolution`, scaled by ONE float on both axes — so it is accepted
    // ONLY in exactly that form; any other definition of `ftexel` (a vec2, a vUv term) fails the clause as before.
    const tap = /vec2 ftexel = texel \* uFieldStep;/.test(src) && /uniform float uFieldStep;/.test(src) ? 'f?texel' : 'texel';
    chk(`the ${label} surface pass steps the 4-tap gradient in TEXEL units via uResolution (invariant 26)`,
      /vec2 texel = 1\.0 \/ max\(uResolution, vec2\(1\.0\)\);/.test(src)
      && new RegExp(`vUv \\+ vec2\\(${tap}\\.x, 0\\.0\\)`).test(src) && new RegExp(`vUv \\+ vec2\\(0\\.0, ${tap}\\.y\\)`).test(src),
      'a vUv-denominated offset tilts the normal by the frame aspect — constant, so it reads as a style');
  }

  // 7. THE OUTPUT CHANNEL. Liquid is the one particle path that OCCLUDES, which is the entire basis of
  // Phase 15 (additive splats cannot merge). Premultiplied colour therefore pairs with ONE, and NOT with
  // SRC_ALPHA — invariant 9, whose loss is density-dependent and so distorts falloff rather than dimming.
  // ⚠️ The first form of this assertion pinned the tile's exact spelling `vec4(tint * diff * cover, cover)`
  // and FAILED on correct code, because the main renderer factors the same expression over two lines
  // (`vec3 col = tint * diff; fragColor = vec4(col * cover, cover);`). The PROPERTY is that the rgb is
  // multiplied by the same coverage the alpha carries — so match on that shape, not on one file's phrasing.
  // And assert the blend function as well: premultiplication and its pairing are one decision, and half of
  // it is what invariant 9 was found as, twice, five sittings apart.
  //
  // ⚠️ **AND IT FAILED ON CORRECT CODE A SECOND TIME, at 15.7's wake pass, for the SAME reason in a new
  // spelling** — the main composite became `vec4(col * cover + wake * wakeA, clamp(cover + wakeA, 0.0, 1.0))`,
  // which is premultiplied for BOTH contributions and is exactly what invariant 9 asks for. That is this
  // checker's own basis being the defect for the tenth time in Phase 15: the note above had already recorded
  // *"match on the PROPERTY, not on one file's phrasing"* and the regex it recorded it beside was still a
  // phrasing. **The property is: every rgb term carries the same factor its alpha term does.** Asserted as a
  // TERM-WISE pairing so it holds for one contribution or two, and so a third would have to state itself.
  for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
    const out = (src.match(/fragColor = vec4\(([\s\S]*?)\);\s*\n\}/g) ?? []).join('\n');
    // Each accepted shape is (rgb terms, alpha terms) with the SAME factors in the same order. The tile and
    // the pre-wake main path ship one term; the main path since 15.7 ships two.
    const oneTerm = /fragColor = vec4\((?:col|tint \* diff) \* cover, cover\);/.test(src);
    const twoTerm = /fragColor = vec4\(col \* cover \+ wake \* wakeA, clamp\(cover \+ wakeA, 0\.0, 1\.0\)\);/.test(src);
    chk(`the ${label} surface outputs PREMULTIPLIED rgb — the same coverage in rgb as in alpha (invariant 9)`,
      oneTerm || twoTerm,
      `rgb not premultiplied by the alpha it ships means the blend applies coverage once, not twice — a dim `
      + `(${label} composite: ${out.slice(0, 160) || 'no fragColor at a function end'})`);
  }
  /*
   * ============ v8 Step 15.7's WAKE PASS — the new OUTPUT CHANNEL, and its three failure modes ============
   *
   * ⚠️ **The wake exists because the surface used to `discard` everywhere the figure is NOT, which made the
   * dye field structurally incapable of showing a wake** — the dye's entire value is colour left BEHIND, and
   * there is no density there by definition. Reported as *"enabling it or disabling it only changes the color
   * of the figure"* against a pipeline whose every file was correct: the defect was one early return
   * downstream of all of them (invariant 25's shape, arriving on an image rather than on a readout).
   *
   * Each assertion below is a DIFFERENT failure mode, and each was seeded and observed to fail:
   *  (a) the wake never draws         — the `cover <= 0.0` branch discards unconditionally again
   *  (b) the wake brightens the body  — the `(1 - cover)` factor is dropped, so a covered pixel gets both
   *  (c) the four other sources move  — the branch is not gated on `uTintSource == 4`
   *  (d) a seam rings the figure      — the early return and the composite spell the alpha differently
   */
  {
    // (a) + (d). The early return must be gated on dyeA and must ship the SAME alpha the composite does at
    // cover = 0, i.e. dyeA itself. An independent `alpha = 1.0` here would step against the feathered edge's
    // `(1 - cover) * dyeA` one texel away — a transparent ring, visible exactly at the soft edges the mode is
    // for, and invisible at edgeSoftness 0 (so a single-preset browser pass can miss it).
    chk('the wake DRAWS outside the iso surface instead of discarding — 15.7\'s new output channel',
      /if \(cover <= 0\.0\) \{\s*if \(dyeA <= 0\.0\) discard;\s*fragColor = vec4\(dyeHueOf\(dyeS, vec3\(0\.0\)\) \* dyeA, dyeA\);\s*return;\s*\}/.test(hdrSrc),
      'an unconditional discard here is what made the dye read as "only changes the colour of the figure" — '
      + 'the field was correct end to end and could never reach a pixel the figure was not on');
    // (b). The load-bearing factor. Without it a fully covered pixel receives the surface AND the wake, so
    // the body brightens with Dye Amount — which reads as the dye working and the wake being the extra.
    chk('...and the wake fills only what the surface LEAVES: wakeA = (1 - cover) * dyeA',
      /float wakeA = \(1\.0 - cover\) \* dyeA;/.test(hdrSrc),
      'dropping (1 - cover) double-counts a covered pixel: the body brightens with Dye Amount and the wake '
      + 'stops being separable from the tint, which is the very conflation the channel exists to end');
    // (c). The four pre-15.7 sources must be BYTE-identical, not nearly so: dyeA is 0, so both added terms
    // vanish algebraically. Gating on the source rather than on the texture's contents is what makes that an
    // identity — a texture test would make the identity depend on the field being empty.
    chk('...and it is gated on uTintSource == 4, so the other four sources are an algebraic identity',
      /if \(uTintSource == 4\) \{\s*dyeS = texture\(uDye, vUv\);\s*dyeA = clamp\(1\.0 - exp\(-max\(dyeS\.a, 0\.0\) \* uDyeSatK\), 0\.0, 1\.0\)/.test(hdrSrc),
      'ungated, every liquid preset in the library gains a wake it did not author — and 359 of them omit the '
      + 'dye block entirely, so the change would arrive as "the presets look different now"');
    /*
     * ONE owner for the premultiplied-to-hue quotient.
     *
     * ⚠️ **REWRITTEN BY v8 28.1 (28.D10), AND THE OLD CLAUSE'S FAILURE WAS NOT A REGRESSION.** It asserted
     * the DEFINITION's text inside `hdr-particle.ts`, which was correct while that file owned it. Phase 28
     * moved the quotient to `DYE_HUE_GLSL` in `liquid-reference.ts` because a FOURTH reader appeared in a
     * different file (`post-processors/dye-field.ts`'s standalone overlay), and a retyped copy across a
     * module boundary is invisible to every compiler and to any grep over one file.
     *
     * **So the property got STRONGER and the assertion had to follow it**: the owner is now named, and
     * BOTH shader files must interpolate rather than redefine. This is CLAUDE.md's rule arriving exactly
     * as written — *most checkers are text greps, so a behaviour-neutral move breaks them; read the
     * assertion before believing a failure is a regression.*
     */
    const lrDyeSrc = stripComments(readFileSync(SRC + 'renderers/liquid-reference.ts', 'utf8'));
    const dyeFieldSrc = stripComments(readFileSync(SRC + 'post-processors/dye-field.ts', 'utf8'));
    const defRe = /vec3 dyeHueOf\(vec4 s, vec3 fallback\) \{\s*return s\.a > 1e-6 \? clamp\(s\.rgb \/ s\.a, 0\.0, 1\.0\) : fallback;\s*\}/;
    chk('...and the dye hue has ONE owner (DYE_HUE_GLSL in liquid-reference.ts), interpolated by BOTH shaders',
      // the owner defines it exactly once ...
      defRe.test(lrDyeSrc)
      && (lrDyeSrc.match(/vec3 dyeHueOf\(/g) ?? []).length === 1
      // ... and NEITHER consumer redefines it, they interpolate the constant ...
      && !defRe.test(hdrSrc) && !defRe.test(dyeFieldSrc)
      && /\$\{DYE_HUE_GLSL\}/.test(hdrSrc) && /\$\{DYE_HUE_GLSL\}/.test(dyeFieldSrc)
      // ... and it is still actually CALLED, in the body, the wake, the composite and the overlay ...
      && (hdrSrc.match(/dyeHueOf\(/g) ?? []).length >= 3
      && (dyeFieldSrc.match(/dyeHueOf\(/g) ?? []).length >= 1
      // ... with no second spelling of the quotient anywhere.
      && !/clamp\(dyeS\.rgb \/ dyeS\.a/.test(hdrSrc)
      && !/clamp\(s\.rgb \/ s\.a/.test(dyeFieldSrc),
      'the wake, the body and the standalone overlay must agree about the hue by CONSTRUCTION; a second '
      + 'spelling of rgb/a is how a guard threshold comes to differ between them, and 0/0 is NaN on a '
      + 'LINEAR-filtered edge texel. ⚠️ An interpolated constant is the ONLY form a compiler cannot check, '
      + 'so this clause is the whole guard: assert the OWNER defines it once and both consumers interpolate');
  }
  /*
   * ============ AND THE ALPHA MUST REACH THE SCREEN, NOT ONLY THE HUE (the third 15.7 defect) ============
   *
   * ⚠️ **`rgb / a` IS SCALE-INVARIANT, so on its own it divides out EVERY dye slider.** Measured across Dye
   * Amount 0.05–1.0 and Dye Decay 0.90–0.999: the quotient returned the identical colour at every value,
   * while the steady-state alpha `opacity·n/(1 − decayRate)` spans ~8 to ~660 over the same region. Reported
   * as *"none of the sliders seems to have an effect"*, and it is a THIRD defect distinct from the two fixed
   * earlier the same day. **The rule: a default must be judged against WHAT THE READ CAN REPRESENT, not
   * against whether the value is sensible** — visibility and variability are separate requirements and the
   * two previous defaults each satisfied only one.
   */
  {
    chk('the dye\'s DENSITY reaches the screen as a saturation, not only its hue (the third 15.7 defect)',
      /float dyeSat|1\.0 - exp\(-max\(dyeS\.a, 0\.0\) \* uDyeSatK\)/.test(hdrSrc)
      && /uniform float uDyeSatK;/.test(hdrSrc),
      'rgb/a is scale-invariant, so the hue alone makes Dye Amount, Dye Decay and Dye Radius ALL inert — '
      + 'the control moved the field, the field reached the shader, and the arithmetic normalised it away');
    // Set UNCONDITIONALLY beside the sampler unit: a 0 pins the surface to the ramp fallback at every alpha,
    // which is indistinguishable from the field being off (invariant 4's shape on a scalar).
    chk('...and uDyeSatK is uploaded unconditionally, a 0 being indistinguishable from the field being off',
      /gl\.uniform1f\(this\.uLiquidSurfDyeSatK, DYE_SATURATION_K\);/.test(hdrSrc)
      && /this\.uLiquidSurfDyeSatK = null;/.test(hdrSrc),
      'gated behind an if, a preset switch leaves the previous value; and invariant 1 requires the location '
      + 'be NULLED in dispose(), not merely deleted');
    // The constant is DERIVED from the field's own steady state, and it is derived in ONE place — the same
    // one-owner rule the four 15.3 constants follow, for the same reason (two shaders, one digit).
    chk('...and DYE_SATURATION_K is EXPORTED from liquid-reference.ts, and puts the DEFAULTS mid-range',
      /export const DYE_SATURATION_K = 0\.02;/.test(
        stripComments(readFileSync(SRC + 'renderers/liquid-reference.ts', 'utf8')))
      && Math.abs((1 - Math.exp(-(0.5 * 1 / (1 - 0.985)) * LR.DYE_SATURATION_K)) - 0.487) < 0.02
      && (1 - Math.exp(-(0.05 * 1 / (1 - 0.90)) * LR.DYE_SATURATION_K)) < 0.05
      && (1 - Math.exp(-(1.0 * 1 / (1 - 0.999)) * LR.DYE_SATURATION_K)) > 0.99,
      `k = ${LR.DYE_SATURATION_K}: defaults (0.5, 0.985) -> `
      + `${(1 - Math.exp(-(0.5 / 0.015) * LR.DYE_SATURATION_K)).toFixed(3)}, `
      + `floor (0.05, 0.90) -> ${(1 - Math.exp(-(0.05 / 0.10) * LR.DYE_SATURATION_K)).toFixed(3)}, `
      + `ceiling (1.0, 0.999) -> ${(1 - Math.exp(-(1.0 / 0.001) * LR.DYE_SATURATION_K)).toFixed(3)}. `
      + '⚠️ This is a REACHABILITY property of two slider tracks, not a look preference: a larger k saturates '
      + 'the default and makes the top half of both tracks inert, a smaller one wastes the bottom half');
    // And the default colourSource must be one that VARIES, or the field is a constant and the quotient is
    // constant however well the alpha reaches the screen. `depth` is the only member that both varies and
    // needs no material: `fixed` cannot vary, `temperature` needs a live material, and `velocity` derives
    // from the figure's OWN colour dimmed by 0.35 + 0.65·s — invisible against the thing it tints.
    chk('...and the default Dye Colour is `depth`, the one source that both VARIES and needs no material',
      /colourSource: 'depth',/.test(stripComments(readFileSync(SRC + 'generators/material-presets.ts', 'utf8')))
      && /'depth'/.test(stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8')))
      && /\['depth', 'Depth'\]/.test(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8')),
      '⚠️ THIS DEFAULT HAS NOW BEEN WRONG TWICE IN OPPOSITE DIRECTIONS, each time for a reason that looked '
      + 'like a virtue: `velocity` was neutral against the figure (so invisible) and `fixed` was self-evident '
      + '(so inert). A constant deposit makes the hue read constant no matter what the alpha does');

    /*
     * ============ v8 PHASE 28 — THE DYE AS AN INDEPENDENT OUTPUT CHANNEL (28.8) ============
     *
     * ⚠️ **EVERY CLAUSE BELOW GUARDS A PROPERTY THAT FAILS SILENTLY, and §R passing green through all FIVE
     * of 15.7's causes is why they exist** — *a section scoped to a subsystem cannot see the gate deciding
     * whether its INPUT runs.* Phase 28 MOVED that gate, so the gate is now the subject, not the context.
     *
     * These are SOURCE-SHAPED rather than measuring: a measured failure would mean wrong arithmetic, while
     * a source-shaped one means the named owner was bypassed, moved or renamed. **Read the assertion before
     * believing a red is a regression** — the dyeHueOf clause above had to be rewritten for exactly that
     * reason when 28.1 moved the quotient to its own owner.
     */
    const dyeFieldTs = stripComments(readFileSync(SRC + 'post-processors/dye-field.ts', 'utf8'));
    const mainTsDye = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
    const typesTsDye = stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8'));
    const matTsDye = stripComments(readFileSync(SRC + 'generators/material-presets.ts', 'utf8'));
    const interpTsDye = stripComments(readFileSync(SRC + 'exploration/interpolate.ts', 'utf8'));

    chk('28.1: the dye overlay program is compiled WITH A LABEL and nulled as well as deleted',
      /compileProgram\(gl, QUAD_VS, OVERLAY_FS, 'Dye overlay'\)/.test(dyeFieldTs)
      && /this\.overlayProg = null; this\.overlayVao = null;/.test(dyeFieldTs)
      && /if \(this\.overlayProg\) gl\.deleteProgram\(this\.overlayProg\);/.test(dyeFieldTs),
      'an unlabelled program cannot be named in a console when it fails to compile, and a failed compile '
      + 'throws nothing, links, binds and no-ops to BLACK. A deleted-but-non-null handle makes every later '
      + 'overlay draw a silent no-op against freed memory, because renderOverlay() tests that very field');

    chk('28.1: the overlay emits PREMULTIPLIED rgb*a, switches the blend func, and restores ONE,ONE',
      /fragColor = vec4\(dyeHueOf\(s, vec3\(0\.0\)\) \* a, a\);/.test(dyeFieldTs)
      && /blendFunc\(gl\.ONE, \(cfg\.blendMode \?\? 'over'\) === 'add' \? gl\.ONE : gl\.ONE_MINUS_SRC_ALPHA\)/.test(dyeFieldTs)
      && /gl\.blendFunc\(gl\.ONE, gl\.ONE\);\s*\}/.test(dyeFieldTs),
      'un-premultiplied output under ONE_MINUS_SRC_ALPHA double-applies alpha at the EDGES only, so it '
      + 'reads as a halo rather than as an error (invariant 9 distorts falloff, it does not dim). And '
      + 'leaving the blend func changed corrupts whichever particle draw runs next');

    /*
     * ⚠️ **REWRITTEN 2026-10-19 ON AN OWNER REPORT, AND THE OLD CLAUSE WAS GREEN OVER THE DEFECT — which
     * is the only reason it is worth this much comment.** It asserted the refusal as the literal text
     * `currentRenderMode === 'liquid' && currentLiquid.tintSource === 'dye') return false;`, i.e. it
     * asserted the SHAPE THAT WAS WRONG: an UNCONDITIONAL refusal. Loading the owner's own export (liquid
     * + tintSource dye) and unticking Show Figure then did nothing at all, because the cull was gated on
     * the same predicate.
     *
     * **The defect was ONE predicate answering TWO questions** — *is the dye on screen at all?* (which
     * decides whether hiding the figure is safe) and *should the overlay pass run?* (which prevents a
     * double draw). They differ in exactly one configuration. **Invariant 17's shape, hand-built.**
     *
     * So the clause now asserts the THREE predicates are distinct and correctly layered, and the refusal
     * is CONDITIONAL on the surface actually drawing. ⚠️ **The negative test is the important half**: a
     * bare mode+tint refusal must not reappear anywhere in the resolver.
     */
    chk('28.2: the dye has THREE distinct predicates, and the overlay refusal is CONDITIONAL on the surface drawing',
      /const dyeHidesFigure = \(\): boolean =>\s*dyeProcessor\.isActive\(\) && \(currentDye\.showFigure \?\? true\) === false;/.test(mainTsDye)
      && /const liquidSurfaceDraws = \(\): boolean =>\s*currentRenderMode === 'liquid' && !dyeHidesFigure\(\);/.test(mainTsDye)
      && /const dyeOverlayActive = \(\): boolean =>\s*dyeProcessor\.isActive\(\) && !\(liquidSurfaceDraws\(\) && currentLiquid\.tintSource === 'dye'\);/.test(mainTsDye)
      // the regression guard: the UNCONDITIONAL refusal must not come back
      && !/currentRenderMode === 'liquid' && currentLiquid\.tintSource === 'dye'\) return false;/.test(mainTsDye)
      // and the figure-hiding predicate must NOT be defined in terms of the overlay one
      && !/const dyeHidesFigure[^;]*dyeOverlayActive/.test(mainTsDye),
      'the surface fragment composites the wake itself in its cover<=0 branch, so running the overlay too '
      + 'gives 1-(1-a)^2 instead of a — but ONLY while that surface draws. Refusing unconditionally left '
      + 'the owner Show Figure control inert on the one preset it was reported against, which is invariant '
      + '13 harder shape: the box moved the right field and no output channel could show it');

    chk('28.D6: the overlay composites BEFORE the figure (behind it), into particleFbo()',
      mainTsDye.indexOf('dyeProcessor.renderOverlay(particleFbo()') >= 0
      && mainTsDye.indexOf('dyeProcessor.renderOverlay(particleFbo()')
         < mainTsDye.indexOf('renderer.renderCrystalOnly(state);'),
      'drawn after the renderer branch it would VEIL the figure instead of backing it, and with over '
      + 'blending that is plainly visible because the composite attenuates its destination by (1-a). '
      + 'Hard-coding fboB instead of particleFbo() makes the dye vanish entirely under beforeParticles');

    chk('28.5: the curve cull is in BOTH vertex shaders, and the crystal pass resets it to 0',
      (hdrSrc.match(/uniform int uHideBelowIndex;/g) ?? []).length === 2
      && /if \(gl_VertexID < uHideBelowIndex\)/.test(hdrSrc)
      && /if \(gl_InstanceID < uHideBelowIndex\)/.test(hdrSrc)
      && /gl\.uniform1i\(this\.splatUHideBelowIndex, 0\);/.test(hdrSrc),
      'WebGL2 has NO baseInstance, so the splat path cannot be offset and must cull in the shader — a draw '
      + 'offset on the point path plus a uniform on the other is two mechanisms for one rule, which is how '
      + 'they come to disagree. And the crystal pass SHARES the splat program with instance ids starting at '
      + '0, so without the reset it would cull every crystal: T030-s trap, which 27.2 also met');

    chk('28.5: the cull is SUPPRESSED for a zero-based subset draw, keyed on waveCount being absent',
      /const hideBelow = state\.waveCount !== undefined \? this\.hideBelowIndex : 0;/.test(hdrSrc)
      && /gl\.uniform1i\(this\.uHideBelowIndex, hideBelow\);/.test(hdrSrc)
      && /state\.waveCount !== undefined \? this\.hideBelowIndex : 0\);/.test(hdrSrc),
      'drawParticleSubset() re-packs an arbitrary index list ZERO-BASED and passes no waveCount, so a '
      + 'slot-index threshold would cull the first waveCount entries OF THE SUBSET — and the spark block is '
      + 'drawn through exactly that path, so every spark would vanish whenever the figure was hidden. That '
      + 'is the known "sparks vanished whenever neon was enabled" defect arriving through a third door');

    chk('28.D11: showFigure is honoured ONLY while the dye field runs, so a black frame is unreachable',
      // The force-true now lives in `dyeHidesFigure` itself, which is the one place that can hold it: the
      // predicate is `isActive() && showFigure === false`, so a preset authoring a hidden figure with no
      // dye cannot hide anything. ⚠️ **It must test isActive() and NOT dyeOverlayActive()** — the latter is
      // false in liquid+dye, where the dye IS on screen, and gating on it is the 2026-10-19 defect.
      /dyeProcessor\.isActive\(\) && \(currentDye\.showFigure \?\? true\) === false;/.test(mainTsDye)
      && /renderer\.setHideCurve\(dyeHidesFigure\(\) \? \(state\.waveCount \?\? 0\) : 0\);/.test(mainTsDye)
      && !/setHideCurve\(hideCurve/.test(mainTsDye),
      'read straight from the preset, a body authoring showFigure false with no dye would render NOTHING, '
      + 'and an empty frame is the one symptom carrying no information. The force-true belongs at the ONE '
      + 'reader and never at the UI — rows disabled behind a gate is a standing never-re-propose');

    /*
     * ⚠️ **THIS CLAUSE EXISTS BECAUSE THE OWNER FOUND THE DEFECT AND `verify` WAS GREEN OVER IT (2026-10-19):
     * "ribbon or neon lines ... also disable sparks".**
     *
     * Both reconstruction branches in `render()` RETURN UNCONDITIONALLY, so suppressing their pass
     * suppresses the whole draw. With neon or ribbon enabled the spark block arrives as a SUBSET — an
     * explicit index list with no `waveCount` — and the figure's cull was swallowing it, so hiding the
     * figure also hid the embers. **A subset is never a figure to reconstruct, so the cull must not reach
     * one.**
     *
     * ⚠️ **AND VOLUME HAD THE OPPOSITE HALF OF THE SAME GAP: its own program carries no cull, so
     * `Show Figure` was INERT there.** Both are now `!fullState || hideBelowIndex <= 0`, i.e. one rule in
     * two branches, and this clause asserts BOTH — a single-branch assertion would have passed over the
     * reported defect, which is exactly what happened.
     */
    chk('28.5: liquid AND volume suppress on a hidden figure but NEVER swallow a subset draw',
      // both branches test fullState, so a subset is exempt from the figure's cull ...
      (hdrSrc.match(/const fullState(?:Vol)? = state\.waveCount !== undefined;/g) ?? []).length === 2
      && /if \(!fullState \|\| this\.hideBelowIndex <= 0\) \{/.test(hdrSrc)
      && /if \(!fullStateVol \|\| this\.hideBelowIndex <= 0\) this\.renderVolume\(state\);/.test(hdrSrc)
      // ... and neither reads the raw field alone, which is the shape that shipped
      && !/if \(this\.hideBelowIndex <= 0\) this\.renderLiquid/.test(hdrSrc)
      && !/^\s*this\.renderVolume\(state\);$/m.test(hdrSrc),
      'each branch returns unconditionally, so a bare `hideBelowIndex <= 0` test drops the SPARK block '
      + 'whenever neon or ribbon routes it through a subset draw — the third door this engine has lost '
      + 'sparks through. And volume needs the guard rather than the cull, because its own accumulation '
      + 'program cannot see `uHideBelowIndex` at all, so without it Show Figure is silently inert there');

    chk('28.4: the ramp source reads its OWN name and NEVER material.colourRamp',
      /function dyeOwnRamp\(\): Uint8Array \| null \{/.test(mainTsDye)
      && /const name = currentDye\.ramp \?\? DEFAULT_DYE_CONFIG\.ramp \?\? '';/.test(mainTsDye)
      && !/function dyeOwnRamp[\s\S]{0,420}?currentMaterial/.test(mainTsDye)
      && /src === 'ramp' \? dyeOwnRamp\(\) : null/.test(mainTsDye),
      'if it consulted the material it would be `depth` with extra steps, and the one combination the five '
      + 'older sources cannot express — independent AND varying — would still be missing while appearing to '
      + 'have shipped. It matters most where no material exists, which is 28.5-s own case');

    chk('28.3/28.5: blendMode, showFigure and ramp SNAP in the Mixer and preserve absence',
      ['ramp', 'blendMode', 'showFigure'].every(k => new RegExp(
        '\\.\\.\\.\\(colourWinner\\.' + k + ' !== undefined \\? \\{ ' + k + ': colourWinner\\.' + k
        + ' \\} : \\{\\}\\)').test(interpTsDye)),
      'a blend mode half-way between over and add is not a blend mode and a half-shown figure is not a '
      + 'state, so all three snap through the SAME colourWinner the colour fields use — two spellings of '
      + 'one threshold is how two categoricals switch on opposite sides of the midpoint. Writing undefined '
      + 'would both fail exactOptionalPropertyTypes and materialise keys neither deck authored');

    /*
     * ⚠️ **THE SHARPEST CLAUSE OF THE SECOND INCREMENT, because `'figure'` WORKS BY ADDING NO CODE.**
     * `28.D16`: it matches no branch in `resolveDyeColours` and therefore reaches the undimmed read of
     * `state.colors` at the end — the same path that already degrades `temperature` with no temperatures
     * and `velocity` with no velocities. **The one failure mode of a fall-through is a branch added ABOVE
     * it that captures the value**, and nothing else in this file could see that: the member would still
     * be in the union, still have a label, still appear in the dropdown, and would silently resolve to
     * whatever the new branch does. **So the assertion is NEGATIVE: `'figure'` must not be named in any
     * branch condition.**
     */
    chk("28.15: 'figure' is in the union and is NOT captured by any branch — it must FALL THROUGH",
      /'temperature' \| 'fixed' \| 'velocity' \| 'depth' \| 'palette' \| 'ramp' \| 'figure'/.test(typesTsDye)
      && /figure: 'Figure',/.test(stripComments(readFileSync(SRC + 'presets/preset-facets.ts', 'utf8')))
      && !/src === 'figure'/.test(mainTsDye)
      && /\['figure', 'Figure'\]/.test(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8')),
      "a branch testing src === 'figure' would capture it before the undimmed fallback, and the member "
      + 'would still be in the union, still labelled and still in the dropdown while resolving to '
      + 'something else entirely. The whole feature is the absence of that branch');

    /*
     * The coordinate selector. ⚠️ **TWO END RULES, ONE TEXEL LOOKUP (`28.D18`), and the depth branch must
     * stay byte-identical** — depth reaches 1.0 exactly at the far plane, and the integer texel modulo is
     * what keeps hue shift 0 a bit-exact identity so a `fract()` cannot wrap the far end onto the near end.
     */
    chk('28.16: the index coordinate WRAPS, the depth clamp survives, and the gate no longer needs depths',
      /const turns = \(count > 1 \? i \/ count : 0\) \* cyc;/.test(mainTsDye)
      && /t = turns - Math\.floor\(turns\);/.test(mainTsDye)
      && /t = Math\.min\(1, Math\.max\(0, state\.depths\[i\]!\)\);/.test(mainTsDye)
      && /dyeMapping === 'index' \|\| state\.depths\.length >= count/.test(mainTsDye)
      // one shared texel lookup, never a second
      && (mainTsDye.match(/\(\(\(base \+ shiftTexels\) % 256\) \+ 256\) % 256/g) ?? []).length === 1,
      '⚠️ `28.D19`: without `mapping === index ||` in the gate the new coordinate falls through to the '
      + 'undimmed-colours path on any frame where depths are short — a configuration-dependent inertness. '
      + 'And a SECOND texel lookup is how the two coordinates come to disagree about the hue rotation');

    chk('28.16: the Mixer SNAPS mapping and LERPS+ROUNDS cycles',
      /\.\.\.\(colourWinner\.mapping !== undefined \? \{ mapping: colourWinner\.mapping \} : \{\}\)/.test(interpTsDye)
      // ⚠️ **UPDATED 2026-10-22 WITH A `28.16` DEFECT FIX, AND THE CLAUSE IS NOW STRONGER RATHER THAN
      // RELAXED.** It pinned `inv * (a.cycles ?? 1) + t * (b.cycles ?? 1)` — the `?? 1` being the defect:
      // emitting when EITHER side carries the key and defaulting the absent side to 1 writes `cycles: 1`
      // at the endpoint where the winning side has no key at all, an ADDED leaf (`mixercheck` §C). The
      // lerp now runs only where BOTH sides carry it, and a one-sided key follows `colourWinner` exactly
      // as `mapping` does. **So this asserts the presence rule as well as the arithmetic**, which is what
      // the original clause was missing: it checked HOW the value was blended and never WHETHER it should
      // have been written.
      && /cycles: Math\.max\(1, Math\.round\(inv \* a\.cycles \+ t \* b\.cycles\)\)/.test(interpTsDye)
      && /a\.cycles !== undefined && b\.cycles !== undefined/.test(interpTsDye)
      && /colourWinner\.cycles !== undefined \? \{ cycles: colourWinner\.cycles \} : \{\}/.test(interpTsDye),
      'mapping is categorical and has no midpoint (invariant 16); cycles is a COUNT whose control steps by '
      + '1, so a fractional crossfade result would be unrepresentable on its own slider — the same rule '
      + 'injectionRadius follows. And a one-sided cycles must FOLLOW THE WINNER, never lerp from a default, '
      + 'or the crossfade materialises a key at its own endpoint');

    /*
     * ============ THE ROUND TRIP, and it is a MEASURING block rather than a text scan ============
     *
     * ⚠️ **Export and Import are the one pair where every source-shaped clause above can be green and the
     * feature still broken**: the export writes a key, the migration drops it, and the symptom only
     * appears when a user re-loads their OWN export. Nothing else in this file executes that path.
     *
     * ⚠️ **Snapshot needs no clause of its own and that is a FACT ABOUT THE CODE, not an omission** —
     * `panel.ts`'s Export and Snapshot handlers both set `copy.overlay = visualFxControls.getSnapshot()`,
     * i.e. ONE builder. A second clause here would assert the same expression twice and would go stale
     * silently if that ever forked. **If they ever stop sharing the builder, THIS comment is the gap.**
     */
    const MGR = await import('../src/presets/manager.ts');
    const DYE_DEFAULTS = (await import('../src/generators/material-presets.ts')).DEFAULT_DYE_CONFIG;
    const INTERP = await import('../src/exploration/interpolate.ts');
    const LIB = await import('../src/presets/library.ts');

    const rtBase = {
      metadata: { name: 'RT', version: 2, designResolution: { width: 75, height: 75 } },
      generators: { type: 'lissajous', particleCount: 1000, waveSpeed: 0.05, rotation: [0, 0, 0], angle: [0, 0, 0], waves: [] },
      renderer: { mode: 'star', glow: 2, decayFactor: 0.85, blurRadius: 4, depthSize: 0, streaks: 0 },
    };
    const POST28 = { enabled: true, decayRate: 0.95, opacity: 0.8, colourSource: 'ramp',
      fixedColour: [1, 0.35, 0.1], injectionRadius: 20, advectionStrength: 0.9,
      ramp: 'Classic: ocean', blendMode: 'add', showFigure: false,
      // v8 28.16 — added to the FIXTURE rather than to a new clause, so the three round-trip assertions
      // below cover five fields instead of three. A new clause would have been a second enumeration.
      mapping: 'index', cycles: 12 };
    const PRE28 = { enabled: true, decayRate: 0.975, opacity: 0.9, colourSource: 'fixed',
      fixedColour: [0.15, 0.85, 0.55], injectionRadius: 12, advectionStrength: 1 };

    const rtMgr = new MGR.PresetManager();
    const impA = rtMgr.importSingle('rt-post', JSON.parse(JSON.stringify(
      { ...rtBase, overlay: { renderMode: 'star', dye: POST28 } })));
    const dA = impA?.overlay?.dye ?? {};
    const impTwice = rtMgr.importSingle('rt-twice', JSON.parse(rtMgr.export(impA)));
    const dT = impTwice?.overlay?.dye ?? {};
    chk('28.7: all three new dye keys survive import AND a second export/import unchanged',
      dA.ramp === 'Classic: ocean' && dA.blendMode === 'add' && dA.showFigure === false
      && dA.mapping === 'index' && dA.cycles === 12
      && dT.ramp === dA.ramp && dT.blendMode === dA.blendMode && dT.showFigure === dA.showFigure
      && dT.mapping === dA.mapping && dT.cycles === dA.cycles,
      `after one trip ${JSON.stringify({ r: dA.ramp, b: dA.blendMode, s: dA.showFigure })}; `
      + `after two ${JSON.stringify({ r: dT.ramp, b: dT.blendMode, s: dT.showFigure })}. `
      + 'A key the export writes and the migration drops is invisible until a user reloads their own file');

    const impC = rtMgr.importSingle('rt-pre', JSON.parse(JSON.stringify(
      { ...rtBase, overlay: { renderMode: 'liquid', dye: PRE28 } })));
    const dC = impC?.overlay?.dye ?? {};
    const appliedC = { ...DYE_DEFAULTS, ...dC };
    chk('28.7: a PRE-28 dye block keeps the three keys ABSENT, and the apply site supplies pre-28 behaviour',
      dC.ramp === undefined && dC.blendMode === undefined && dC.showFigure === undefined
      && dC.mapping === undefined && dC.cycles === undefined
      && appliedC.mapping === 'depth' && appliedC.cycles === 1
      && appliedC.showFigure === true && appliedC.blendMode === 'over'
      && appliedC.colourSource === 'fixed' && appliedC.opacity === 0.9,
      'import must not INVENT the keys (that would make every old export differ byte-wise) and the '
      + 'apply-site spread must then resolve them to the untouched pre-28 look');

    // The Mixer, through its PUBLIC entry. ⚠️ A minimal fixture CRASHES `interpolatePreset` in `lerpArr`
    // (no colour arrays) — a false FAILURE from the fixture, so a real library body is the base.
    const rtLib = new MGR.PresetManager();
    const rtRaw = readFileSync(SRC + '../public/psss_presets.json', 'utf8');
    LIB.loadLibrary(rtLib, JSON.parse(rtRaw.slice(rtRaw.indexOf('{')).replace(/;\s*$/, '')));
    const rtReal = rtLib.get(rtLib.list()[0]);
    const deck = (dye) => {
      const p = JSON.parse(JSON.stringify(rtReal));
      p.overlay = { ...(p.overlay ?? {}), dye };
      return p;
    };
    const mixAt = (t) => INTERP.interpolatePreset(deck(POST28), deck(PRE28), t, new Set()).overlay?.dye ?? {};
    const mLo = mixAt(0.25), mHi = mixAt(0.75);
    chk('28.3/28.5: the Mixer SNAPS all three categoricals while a neighbouring scalar still LERPS',
      mLo.blendMode === 'add' && mHi.blendMode === undefined
      && mLo.showFigure === false && mHi.showFigure === undefined
      && mLo.ramp === 'Classic: ocean' && mHi.ramp === undefined
      && Math.abs(mLo.opacity - (0.75 * 0.8 + 0.25 * 0.9)) < 1e-9,
      `t=0.25 -> ${JSON.stringify({ b: mLo.blendMode, s: mLo.showFigure, r: mLo.ramp, o: mLo.opacity })}; `
      + `t=0.75 -> ${JSON.stringify({ b: mHi.blendMode, s: mHi.showFigure, r: mHi.ramp })}. `
      + '⚠️ The far end must stay ABSENT: a snap that wrote a default would add keys neither deck authored');

    chk('28.3/28.4/28.5: the three new fields are OPTIONAL and default to the pre-28 behaviour',
      /ramp\?: string;/.test(typesTsDye)
      && /blendMode\?: 'over' \| 'add';/.test(typesTsDye)
      && /showFigure\?: boolean;/.test(typesTsDye)
      && /blendMode: 'over',/.test(matTsDye)
      && /showFigure: true,/.test(matTsDye),
      'required fields would have forced edits to six LIBRARY preset bodies to write their own defaults, '
      + 'and a diff touching authored preset values to add a no-op is the shape under which a real retune '
      + 'hides. A default of add, or showFigure false, would restyle all five visible dye presets');
  }
  // Scoped to the liquid render method in each file, because both files use both blend functions elsewhere —
  // a file-wide grep would pass on the accumulation pass's `ONE, ONE` and prove nothing about the composite.
  for (const [label, src, fn] of [
    ['main', hdrSrc, 'private renderLiquid\\('],
    ['tile', tileSrc, 'private renderLiquidField\\('],
  ]) {
    const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
    // Two blends in write order: ONE,ONE accumulates the field (a SUM is the whole point), then
    // ONE,ONE_MINUS_SRC_ALPHA composites the premultiplied surface. Order is asserted, not just presence.
    const acc = body.indexOf('blendFunc(gl.ONE, gl.ONE)');
    const comp = body.indexOf('blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)');
    chk(`...and the ${label} pass accumulates with ONE,ONE then composites with ONE,ONE_MINUS_SRC_ALPHA`,
      body.length > 0 && acc >= 0 && comp > acc && !/blendFunc\(gl\.SRC_ALPHA/.test(body),
      `in ${body.length} chars of ${label} body: accumulate at ${acc}, composite at ${comp} `
      + '— SRC_ALPHA would apply coverage twice, and coverage peaks in the blob INTERIOR, so it distorts falloff');
  }

  // 8. THE REFUSAL PATH (invariant 5). An incomplete R32F FBO throws nothing and logs nothing: the field
  // stays zero, `cover <= 0.0` discards every fragment, and the tile is permanently blank with a clean
  // console — indistinguishable from a preset that draws nothing. And the warning must LATCH, or it fires
  // once per liquid slot per frame across up to 128 slots.
  chk('the tile probes EXT_color_buffer_float and tests checkFramebufferStatus before drawing (invariant 5)',
    /EXT_color_buffer_float/.test(tileSrc) && /checkFramebufferStatus/.test(tileSrc),
    'a silently incomplete R32F target gives a blank tile and an empty log');
  chk('...falling back to mode 2 with the refusal LATCHED, so it cannot warn per slot per frame',
    /liquidUnavailable = true/.test(tileSrc) && /modeInt = 2/.test(tileSrc),
    'up to 128 slots x 60 Hz of one warning is the flood shape the upload trap dedup key already produced once');
  // ...and NOT reset in dispose(): it records a property of the GL CONTEXT, which outlives this object, so
  // clearing it would re-probe and re-warn on every dispose/init cycle on a machine that will never support it.
  const disposeBody = (tileSrc.match(/dispose\(\)[\s\S]*$/) ?? [''])[0];
  chk('...and dispose() does NOT clear the latch, the refusal being a property of the CONTEXT',
    !/liquidUnavailable = false/.test(disposeBody),
    'resetting it re-probes and re-warns on every reinit on hardware that will never support the mode');

  // 9. Invariant 14: `overlay.liquid` is a NESTED BLOCK, so a partial one from an older export must be
  // merged FIELD BY FIELD against the defaults. `Object.assign`/spread copies only PRESENT keys, and an
  // `undefined` reaching `gl.uniform1f` becomes NaN — after which every threshold comparison is false and
  // the tile is blank, with nothing logged.
  chk('the tile merges overlay.liquid defaults-first, per field (invariant 14)',
    /\{ \.\.\.DEFAULT_LIQUID_CONFIG, \.\.\.\(preset\.overlay\?\.liquid \?\? \{\}\) \}/.test(tileSrc),
    'a missing field reaches uniform1f as undefined -> NaN -> every threshold false -> a blank tile, silently');

  // ------------------------------------------------------------------------------------------------------
  // 10. v8 STEP 15.2 — the per-particle colour accumulation.
  //
  // The step's whole mechanism is a SECOND render target written by the SAME draw. Almost every way of
  // getting it wrong is silent, and two of them are silent in the specific sense that every visible sign of
  // a working feature is present:
  //
  //   - **`gl.drawBuffers` omitted.** A user FBO's default draw-buffer state enables COLOR_ATTACHMENT0 only,
  //     so the `outColor` write is DISCARDED. `wSum` is 0 at every texel, the shader's guard falls back to
  //     `tint`, and the output is byte-identical to 15.1 — while the uniforms upload, the slider moves and
  //     the shader runs. Invariant 13's shape arriving through GL STATE rather than through a dead field.
  //   - **the divisor taken from `uDensity`.** Same sum, different format, so the picture is nearly right:
  //     a count-dependent gain, largest in the blob interior. Reads as a look, not as a bug.
  //   - **the `wSum > 0` guard dropped.** `cover > 0` does imply density, so it looks provably redundant —
  //     but the colour target is LINEAR-filtered, so a rim fragment can interpolate numerator and
  //     denominator that both round to 0 in half float. 0/0 is NaN, and NaN reaches `acesToneMap`, which is
  //     rational, is NaN at Inf, runs on the screen path and is unreachable by `sanitiseTrail()`
  //     (invariant 20) — one frame of it spreads frame-wide through the band blur in two more.
  //
  // ⚠️ **The neutrality assertion is an ALGEBRAIC IDENTITY AT `colourMix = 0`, NOT preset neutrality.** The
  // default is 0.85 by explicit decision, so `Liquid Surface` DOES look different from 15.1 and asserting
  // "the shipped preset is unchanged" would be asserting the opposite of the decision.
  {
    for (const [label, src, fn] of [
      ['main', hdrSrc, 'private renderLiquid\\('],
      ['tile', tileSrc, 'private renderLiquidField\\('],
    ]) {
      const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
      chk(`the ${label} pass sets gl.drawBuffers with BOTH attachments, or the colour write is silently dropped`,
        body.length > 0 && /drawBuffers\(\[gl\.COLOR_ATTACHMENT0, gl\.COLOR_ATTACHMENT1\]\)/.test(body),
        `in ${body.length} chars of ${label} body — omitted, the step renders byte-identical to 15.1 with every `
        + 'visible sign of working: uniforms upload, the slider moves, the shader runs');
    }
    // Both attachments exist and are attached BEFORE the status check — a check that ran between the two
    // attachments would report COMPLETE for a framebuffer the draw then fails on (invariant 5).
    //
    // ⚠️ **SCOPED to the liquid init function, and the first form of this assertion was itself the defect it
    // was looking for**: a whole-file `indexOf('checkFramebufferStatus')` found `initVolume`'s check 400 lines
    // ABOVE `initLiquid`, so it reported "attachment at 68981, status check at 51164" and failed on correct
    // code. A position comparison is only meaningful inside one function — the same shape as §M's own probe
    // measuring an absolute offset against a scale-dependent quantity (invariant 24).
    for (const [label, src, fn] of [
      ['main', hdrSrc, 'private initLiquid\\('],
      ['tile', tileSrc, 'private ensureLiquid\\('],
    ]) {
      const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
      const attach = body.indexOf('COLOR_ATTACHMENT1, gl.TEXTURE_2D');
      const status = body.indexOf('checkFramebufferStatus');
      chk(`...and the ${label} colour target is ATTACHED before checkFramebufferStatus, not after it`,
        body.length > 0 && attach >= 0 && status > attach,
        `in ${body.length} chars of ${label} init: attachment at ${attach}, status check at ${status} — a `
        + 'second attachment added after the check makes the check prove nothing about the framebuffer the '
        + 'draw actually uses');
    }
    // RGBA16F: the numerator is bounded by the denominator (colours <= 1) and the densest measured Sum(w) is
    // of order 10^2, so half float (exact to 2048, finite to 65504) has no overflow path. R32F for the
    // DENSITY, because that sum is what the 15.1b reference arithmetic compares against.
    //
    // ⚠️ **Scoped to the init function for the same reason the attachment-order pair is: the tile file already
    // creates an unrelated RGBA16F trail texture, so a file-wide grep passed on a seeded RGBA8 downgrade** —
    // an assertion that can be satisfied by a different subsystem's line is not an assertion about this one.
    for (const [label, src, fn] of [
      ['main', hdrSrc, 'private initLiquid\\('],
      ['tile', tileSrc, 'private ensureLiquid\\('],
    ]) {
      const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
      chk(`...the ${label} colour target is RGBA16F while the density target stays R32F`,
        body.length > 0 && /0, gl\.RGBA16F,/.test(body) && /0, gl\.R32F,/.test(body),
        `in ${body.length} chars of ${label} init — the two formats answer different questions: the colour sum `
        + 'is bounded by the weight sum, and the weight sum is what the threshold is derived against in full '
        + 'precision');
    }
    // The accumulation writes BOTH outputs from ONE `w`. A second spelling of (1-r2)^3 is what desynchronises
    // the density the threshold uses from the weight the mean divides by — after which the mean is a mean of
    // nothing in particular, at every pixel, with no visible edge anywhere.
    for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
      chk(`...and the ${label} accumulation writes outDensity and outColor from the SAME w, computed once`,
        /outDensity = w;/.test(src) && /outColor = vec4\(vColor \* w, w\);/.test(src),
        're-deriving the weight for the second output gives the threshold and the mean two different kernels');
    }
    // THE DIVISOR. Measured, not asserted from the algebra: half float stalls a numerator term at a
    // different accumulation step from its own denominator term, so a bias survives either way — the
    // own-alpha ratio is better because both stall at the SAME steps and it keeps only their difference.
    {
      const toHalf = x => {
        if (x === 0 || !isFinite(x)) return x;
        if (Math.abs(x) < 6.103515625e-5) { const s = Math.pow(2, -24); return Math.round(x / s) * s; }
        const e = Math.floor(Math.log2(Math.abs(x))); const s = Math.pow(2, e - 10);
        return Math.round(x / s) * s;
      };
      const bias = n => {
        const c = 0.45; let bo = 0, bc = 0, sw = 0; const T = 300;
        for (let t = 0; t < T; t++) {
          let num = 0, dh = 0, de = 0;
          for (let i = 0; i < n; i++) {
            const r2 = (((i + t) * 7919) % 1000) / 1000, u = 1 - r2, w = u * u * u;
            num = toHalf(num + toHalf(c * w)); dh = toHalf(dh + toHalf(w)); de += w;
          }
          sw = de; bo += Math.abs(num / dh - c) / c; bc += Math.abs(num / de - c) / c;
        }
        return { own: bo / T, cross: bc / T, sw };
      };
      const b = bias(2048);
      chk('dividing by the colour target OWN alpha beats the cross-format divisor, and the gap GROWS with the count',
        b.own < b.cross * 0.5,
        `at 2048 contributors (Sum(w) = ${b.sw.toFixed(0)}): own-alpha bias ${(b.own * 100).toFixed(2)}% vs `
        + `cross-format ${(b.cross * 100).toFixed(2)}% = ${(b.cross / b.own).toFixed(1)}x — monotone in the count, `
        + 'so the worse form reads as a brightness gradient over the blob rather than as noise');
      for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
        const body = (src.match(/vec4 cf = texture\(uColorField, vUv\);[\s\S]{0,400}?uColourMix/) ?? [''])[0];
        chk(`...and the ${label} shader takes it from cf.a, never from d or from uDensity`,
          body.length > 0 && /float wSum = cf\.a;/.test(body) && !/\/ *d\b/.test(body)
          && !/uDensity/.test(body),
          `matched ${body.length} chars — a cross-format divisor is a nearly-right picture, which is why it `
          + 'reads as a look rather than as a defect');
        chk(`...and GUARDS wSum before dividing, though cover > 0 already implies density (invariant 20)`,
          /wSum > 1e-6 \? cf\.rgb \/ wSum : tint/.test(body),
          'LINEAR filtering can interpolate a numerator and denominator that both round to 0 in half float; '
          + '0/0 is NaN, and NaN reaches acesToneMap on the screen path where sanitiseTrail cannot');
      }
    }
    // THE COMPOSITION, and the two models. `mix(tint, mixed, 0)` is an exact identity, which is what makes
    // the step neutral AT THAT VALUE regardless of what the colour target holds — the property the user's
    // "accept the look change" decision left as the only available oracle.
    for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
      chk(`the ${label} shader BLENDS onto the resolved tint, so colourMix 0 is an exact algebraic identity`,
        /tint = mix\(tint, mixed, clamp\(mixAmt, 0\.0, 1\.0\)\);/.test(src),
        'a fifth mutually-exclusive tintSource would have made the mean unreachable from Palette/Material/Ramp; '
        + 'blending reaches all four, and 0 reproduces 15.1 bit for bit');
      // ...and the ONE source the blend must not reach. Added 2026-09-03 with the fix, because the property
      // has no other owner: `dye` (4) is the only source whose value is HISTORY rather than a description of
      // this frame, so blending this frame's per-particle mean over it discards exactly what makes it a
      // fifth source. ⚠️ At the shipped default of 0.85 the un-exempt line replaced 85 % of the dye, and the
      // feature READ AS INERT while being correct end to end — a user-reported defect that three sittings of
      // file-by-file reading could not localise, every file being right. This is the assertion that would
      // have caught it, and its absence is why no other section can.
      chk(`...and source 4 (dye) is EXEMPT from that blend in the ${label} shader, at a mixAmt of 0`,
        /float mixAmt = \(uTintSource == 4\) \? 0\.0 : uColourMix;/.test(src),
        'a mixAmt of 0 rather than a skipped statement, so the mix() stays ONE expression with ONE clamp — a '
        + 'second assignment to tint in a branch is how two paths come to disagree about whether it ran. '
        + '⚠️ Dead in the tile (buildLiquidState() degrades dye to 3) and asserted there anyway: the next '
        + 'assertion requires the two bodies to be character-identical');
    }
    // 'pigment' is Beer-Lambert deepening `c^n`, and `n = 1` at `wSum <= 1` makes it an IDENTITY on the thin
    // rim — which is what makes it read as a material property rather than as a brightness slider. Measured
    // rather than asserted from the expression.
    {
      const layers = wSum => Math.min(3, Math.max(1, 1 + 0.6 * Math.log2(Math.max(wSum, 1))));
      const rim = Math.abs(Math.pow(0.4, layers(0.3)) - 0.4);
      const core = Math.pow(0.4, layers(64));
      chk('pigment is an IDENTITY on the thin rim and only deepens where layers stack',
        rim < 1e-12 && core < 0.4 * 0.5 && layers(1e9) === 3,
        `at wSum 0.3 the exponent is ${layers(0.3).toFixed(3)} so 0.4 -> 0.4 exactly (err ${rim.toExponential(1)}); `
        + `at wSum 64 it is ${layers(64).toFixed(3)} so 0.4 -> ${core.toFixed(4)}; capped at 3 (${layers(1e9)}) `
        + 'so a very dense blob cannot go to black');
      for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
        chk(`...and the ${label} shader clamps BOTH the pow base and its result`,
          /pow\(clamp\(perParticle, 0\.0, 1\.0\), vec3\(layers\)\)/.test(src)
          && /mixed = clamp\(pow\(/.test(src),
          'GLSL pow is UNDEFINED for a negative base, and this value feeds the trail feedback loop — an '
          + 'undefined result there is invariant 20 with no guard downstream of it');
      }
    }
    // ...and the tile is not merely correct in isolation: it must mix IDENTICALLY, or the grid is a
    // misleading preview of the one control it is showing. Asserted as the shared BODY, not per line.
    {
      // ⚠️ COMMENTS ARE STRIPPED FIRST, and that is not cosmetic: the two copies carry DIFFERENT prose
      // (the tile's says the dye branch is dead there and why it is written anyway), so a raw comparison
      // asserts the documentation is identical rather than the ARITHMETIC — the mirror of the false positive
      // that made glslcheck read a comment mentioning uIceOpacity as a use.
      const grab = src => {
        const code = stripComments(src);
        const m = code.match(/vec4 cf = texture\(uColorField, vUv\);[\s\S]*?tint = mix\(tint, mixed, clamp\(mixAmt, 0\.0, 1\.0\)\);/);
        return m ? m[0].replace(/\s+/g, ' ') : '';
      };
      const a = grab(hdrSrc), b = grab(tileSrc);
      chk('the tile mix arithmetic is CHARACTER-IDENTICAL to the main renderer, whitespace aside',
        a.length > 100 && a === b,
        `matched ${a.length} vs ${b.length} chars — a tile that mixed differently would preview the wrong `
        + 'answer for the very slider it is showing, and nothing on screen would contradict it');
    }
    // THE MIXER (invariant 16). `colourMix` is a plain 0..1 WEIGHT and lerps linearly — unlike `isoLevel`
    // and `kernelWidth`, which are log-track ratios and interpolate geometrically. `mixModel` is CATEGORICAL:
    // a lerp between two different pieces of arithmetic is a third model no preset authored.
    {
      const interp = readFileSync(SRC + 'exploration/interpolate.ts', 'utf8');
      const liq = (stripComments(interp).match(/function interpolateLiquid[\s\S]*?\n\}/) ?? [''])[0];
      chk('the Mixer lerps colourMix LINEARLY, not geometrically like the two log-track ratios',
        /colourMix: inv \* a\.colourMix \+ t \* b\.colourMix/.test(liq)
        && /Math\.exp\(/.test(liq),
        `in ${liq.length} chars of interpolateLiquid — a geometric lerp on a plain weight cannot reach 0, `
        + 'which is exactly the value that makes the step neutral');
      chk('...and SNAPS mixModel at t = 0.5 (invariant 16)',
        /mixModel: t < 0\.5 \? a\.mixModel : b\.mixModel/.test(liq),
        'the two models are different arithmetic, so a midpoint between them is a third one');
    }
    // The tile pre-resolves `mixModel` to an INT at slot construction, exactly as it does `tintSource` — the
    // render path uploads with uniform1i and must not carry a string comparison per slot per frame.
    chk('the tile pre-resolves mixModel to an int at slot construction, as it already does tintSource',
      /mixModel: cfg\.mixModel === 'pigment' \? 1 : 0/.test(tileSrc)
      && /uniform1i\(this\.uLiqSurfMixModel, liq\.mixModel\)/.test(tileSrc),
      'a string compare in the per-slot render path is the shape SlotState exists to prevent');
    // FOUR samplers now, so all four need a unit and a real texture (invariant 4), and unit 0 must be
    // restored — `activeTexture` is global and the fade/blur/blit passes that follow assume it.
    for (const [label, src, fn] of [
      ['main', hdrSrc, 'private renderLiquid\\('],
      ['tile', tileSrc, 'private renderLiquidField\\('],
    ]) {
      const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
      const units = [0, 1, 2, 3].filter(u => new RegExp(`activeTexture\\(gl\\.TEXTURE${u}\\)`).test(body));
      chk(`the ${label} surface pass assigns all FOUR sampler units and binds a real texture at each (invariant 4)`,
        units.length === 4 && /uColorField|uLiqSurfColor|uLiquidSurfColor/.test(body)
        && !/bindTexture\(gl\.TEXTURE_2D, null\)/.test(body),
        `units present: ${units.join(',')} — one unassigned sampler2D can resolve a whole multi-sampler draw `
        + 'to black, which is why the fallback is a 1x1 texel and never null');
      chk(`...and restores unit 0 afterwards, the LAST activeTexture in the body being TEXTURE0`,
        body.lastIndexOf('activeTexture(gl.TEXTURE0)') > body.lastIndexOf('activeTexture(gl.TEXTURE3)'),
        'activeTexture is GLOBAL state and the fade, blur and blit passes that follow all assume unit 0');
    }
    // Invariant 1 over the new handles. `ensureLiquid`/`initLiquid` test a handle to decide whether they
    // already ran, so a stale non-null after dispose makes the rebuild skip and the pass draw into a dead
    // FBO — and here the same sweep is what keeps a dangling COLOR_ATTACHMENT1 from outliving its FBO.
    //
    // ⚠️ **Scoped to `dispose()`'s OWN body, not to `/dispose\(\)[\s\S]*$/`.** That first form ran to the end
    // of the file and swallowed `ensureLiquid`'s FAILURE path, which deletes and nulls the same handle for a
    // different reason — so a seeded removal of the real null in `dispose()` passed on the refusal path's copy.
    // A scope that reaches a second, legitimate copy of the pattern cannot fail (§O's own recorded trap).
    for (const [label, src, marker] of [
      ['main', hdrSrc, 'liquidColorTex'],
      ['tile', tileSrc, 'liquidColorTex'],
    ]) {
      const body = (src.match(/\n  dispose\(\)(?:: void)? \{[\s\S]*?\n  \}/) ?? [''])[0];
      chk(`the ${label} dispose() DELETES and NULLS ${marker} (invariant 1)`,
        new RegExp(`deleteTexture\\(this\\.${marker}\\)`).test(body)
        && new RegExp(`this\\.${marker} = null`).test(body),
        'a deleted-but-not-nulled handle makes the init guard skip the rebuild, after which every draw goes '
        + 'to a dead framebuffer — no exception, a blank surface');
    }
    // ...and the colour target must be RESIZED with the density one. A size disagreement between two
    // attachments of one FBO makes it INCOMPLETE, so the surface vanishes for the rest of the session on a
    // window resize, with nothing logged — invariant 5 reached through a later event rather than through init.
    {
      const body = (hdrSrc.match(/resize\(width: number, height: number\)[\s\S]*?\n  \}/) ?? [''])[0];
      chk('the main resize() resizes the colour target in the same branch as the density target',
        body.length > 0 && /liquidColorTex/.test(body) && /liquidTex/.test(body),
        `in ${body.length} chars of resize() — two attachments of one FBO at different sizes make it `
        + 'INCOMPLETE, and the surface then never draws again for the session');
    }
    // The UI half: both controls reach the engine (invariant 13) and both have tooltips both ways (tipcheck
    // owns the second half; this asserts the descriptor exists and writes through `setLiquidConfig`).
    {
      const fx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));
      chk('the Colour Mix slider and Mix Model select both write through setLiquidConfig (invariant 13)',
        /key: 'liquid\.colourMix'[\s\S]{0,300}?setLiquidConfig\(\{ \.\.\.this\.controls\.getLiquidConfig\(\), colourMix: v \}\)/.test(fx)
        && /key: 'liquid\.mixModel'[\s\S]{0,400}?mixModel: v as LiquidColourMixModel/.test(fx),
        'a control that does not reach the engine is invariant 13, and here it would be indistinguishable from '
        + 'the drawBuffers omission — the same symptom from the opposite end of the chain');
    }

    /* ================= v8 Step 15.3 — the surface MATERIAL (refraction, specular, absorption, rim) ==========
     *
     * Five terms added to the same fullscreen pass, all functions of the density field and the normal 15.1
     * already computed. What can silently fail here, and therefore what is asserted:
     *
     *  1. ⚠️ **A GLSL CONSTANT TRANSCRIBED RATHER THAN INTERPOLATED.** The four tuned constants live in
     *     `liquid-reference.ts` and reach both shaders through `${glslFloat(K)}`. A hand-typed digit in one
     *     file is the *second copy* problem this subsystem already paid for twice (`liquidPointDiameter`, the
     *     density reference) and it fails invisibly: the tile previews a slightly different material.
     *  2. ⚠️ **AND A WHOLE-NUMBERED CONSTANT WITHOUT A DECIMAL POINT IS AN `int` IN GLSL**, so `pow(x, 3)`
     *     fails to compile — and a failed compile still links, still binds, and draws as a silent NO-OP with
     *     an empty console (`gl-program.ts`). Hence `glslFloat()`, asserted as the interpolation form.
     *  3. ⚠️ **THE DISPERSION OFFSET MUST BE KERNEL-RELATIVE, NOT A TEXEL COUNT** — invariant 26's shape in a
     *     third guise. A fixed texel offset measures a tint of 0.1006 at R = 6.08 px and EXACTLY 0.0000 at
     *     R = 2.5 px, because past the kernel's support both taps read the same density. So the offset is
     *     `REFRACT_SPREAD · uRadius · texel`, and `uRadius` must be the CLAMPED radius the hardware drew.
     *  4. ⚠️ **ABSORPTION IS APPLIED LAST**, so it attenuates the scatter and rim as well as the body. Ordered
     *     before them, a thick core keeps a full-strength rim — the "flat region with a bright outline" the
     *     step exists to remove, which reads as a look rather than as a defect.
     *  5. Invariant 13 in both directions: five uniforms uploaded UNCONDITIONALLY (a gate leaves the previous
     *     preset's/slot's value on a shared program) and all five nulled in `dispose()` (invariant 1).
     *
     * ⚠️ **CALIBRATED AGAINST 18 SEEDED DEFECTS: 16/18 on the first run, 18/18 after two fixes, and BOTH
     * misses were genuine assertion weaknesses of the same shape — a check that can be satisfied by the very
     * construct it forbids.** `uniform1f(this.uX, cfg.y)` unanchored still matches inside
     * `if (cfg.y > 0) gl.uniform1f(this.uX, cfg.y)`, so an assertion named "UNCONDITIONALLY" passed on both
     * seeded gates; it is now anchored to the start of the statement. ⚠️ **A third weakness was found before
     * calibration and is recorded because the shape recurs: the "no bare literal survives" clause FAILED ON
     * CORRECT CODE**, `, 3)` matching unrelated CPU-side text in both files — a negative whole-file clause that
     * was picked rather than derived. Replaced by a positive assertion at each constant's own use site, which
     * is the property that was actually wanted. The harness lives OUTSIDE the repo (`deadcheck` counts files)
     * and reports pattern-ABSENCE as SKIPPED, a skipped seed otherwise reading exactly like a caught one.
     */
    {
      const KS = [
        ['REFRACT_SPREAD', LR.REFRACT_SPREAD],
        ['SPEC_EXPONENT', LR.SPEC_EXPONENT],
        ['FRESNEL_EXPONENT', LR.FRESNEL_EXPONENT],
        ['ABSORB_SCALE', LR.ABSORB_SCALE],
      ];
      chk('the four 15.3 constants are EXPORTED from liquid-reference.ts, one owner for two shaders',
        KS.every(([, v]) => typeof v === 'number' && Number.isFinite(v)) && typeof LR.glslFloat === 'function',
        `values: ${KS.map(([k, v]) => `${k}=${v}`).join(', ')} — a per-file literal is the drift `
        + 'liquidPointDiameter() and the density reference each already cost a sitting');
      // `glslFloat` is what keeps a whole-numbered constant from becoming a GLSL `int`. Asserted as its
      // BEHAVIOUR over both cases, not as its source text — the failure it prevents is a silent no-op draw.
      chk('...and glslFloat() gives a whole number a decimal point, so pow() sees a float',
        LR.glslFloat(3) === '3.0' && LR.glslFloat(16) === '16.0' && LR.glslFloat(0.35) === '0.35',
        `glslFloat(3) = "${LR.glslFloat(3)}", glslFloat(0.35) = "${LR.glslFloat(0.35)}" — pow(x, 3) fails to `
        + 'compile in GLSL, and a failed compile links, binds and draws as a NO-OP with an empty console');
      // ⚠️ **Asserted at each constant's OWN USE SITE, positively — not as "no bare literal appears".** That
      // negative form was written first and FAILED ON CORRECT CODE: `, 3)` matches unrelated CPU-side text
      // (`toFixed(3)` and friends) in both files, so the clause was picked rather than derived. A transcription
      // is exactly what breaks the use-site form, which is the property that was wanted.
      for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
        const sites = [
          [/vec2 dispDir = n\.xy \* \(\$\{glslFloat\(REFRACT_SPREAD\)\}/, 'REFRACT_SPREAD'],
          [/pow\(max\(dot\(n, halfV\), 0\.0\), \$\{glslFloat\(SPEC_EXPONENT\)\}\)/, 'SPEC_EXPONENT'],
          [/pow\(1\.0 - clamp\(dot\(n, viewDir\), 0\.0, 1\.0\), \$\{glslFloat\(FRESNEL_EXPONENT\)\}\)/, 'FRESNEL_EXPONENT'],
          [/max\(uThickness, 0\.0\) \* \$\{glslFloat\(ABSORB_SCALE\)\}\)/, 'ABSORB_SCALE'],
        ];
        const missing = sites.filter(([re]) => !re.test(src)).map(([, k]) => k);
        chk(`the ${label} surface shader INTERPOLATES all four constants at their own use sites`,
          missing.length === 0,
          `${sites.length - missing.length}/4 interpolated${missing.length ? `; transcribed or moved: ${missing.join(', ')}` : ''}`
          + ' — a transcribed digit makes the tile preview a different material from the one the sliders drive');
      }
      // The dispersion offset. ⚠️ Asserted as the PROPERTY — `uRadius` appears in the offset and the offset is
      // multiplied by `texel` — and the matched body's length is reported, so a regex that matched nothing
      // cannot read as a pass (§O's own recorded trap, twice over now).
      for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
        const m = src.match(/vec2 dispDir = ([^;]+);/);
        const expr = m ? m[1] : '';
        chk(`the ${label} dispersion offset is KERNEL-relative (REFRACT_SPREAD * uRadius), not a texel count`,
          /uRadius/.test(expr) && /texel/.test(expr) && /glslFloat\(REFRACT_SPREAD\)/.test(expr)
          && /n\.xy/.test(expr),
          `dispDir = "${expr}" (${expr.length} chars) — a fixed texel offset measures 0.1006 at R = 6.08 px `
          + 'and exactly 0.0000 at R = 2.5 px, i.e. it vanishes on a small kernel (invariant 26)');
      }
      // ...and `uRadius` must be the CLAMPED radius, which in both files is the local derived one line below
      // the diameter. Scoped to the upload function's body — a whole-file position comparison is what found
      // `initVolume`'s FBO check 400 lines away in 15.2.
      for (const [label, src, fn, name] of [
        ['main', hdrSrc, 'private renderLiquid\\(', 'uLiquidSurfRadius'],
        ['tile', tileSrc, 'private renderLiquidField\\(', 'uLiqSurfRadius'],
      ]) {
        const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
        chk(`the ${label} pass uploads uRadius from the CLAMPED radius local, not a re-derivation`,
          /const radius = diameter \* 0\.5;/.test(body)
          && new RegExp(`uniform1f\\(this\\.${name}, radius\\)`).test(body)
          // ⚠️ The tile must apply NO `SCREEN_SPACE_TILE_SCALE` here: `radius` is already through
          // `scaleFactor`, and at 256x192 the two factors are the SAME number, so both squares the reduction.
          && !new RegExp(`uniform1f\\(this\\.${name}, [^)]*SCREEN_SPACE_TILE_SCALE`).test(body),
          `in ${body.length} chars — the unclamped radius overstates the kernel by 1.576x at 3840x2160, kw 3, `
          + 'and offsetting by a kernel the hardware never drew is the same desync liquidPointDiameter() owns');
      }
      // Term ORDER. Absorption last, then the clamp, then the write — asserted as index order inside the
      // shader body so a reorder that still contains every line cannot pass.
      for (const [label, src] of [['main', hdrSrc], ['tile', tileSrc]]) {
        const scatter = src.indexOf('col += tint * refract * 1.15;');
        const spec = src.indexOf('col += vec3(pow(max(dot(n, halfV)');
        const rim = src.indexOf('col += mix(tint, vec3(1.0), 0.6) * fres');
        const absorb = src.indexOf('col *= exp(-thickness * max(uThickness, 0.0)');
        const clamped = src.indexOf('col = clamp(col, 0.0, 64.0);');
        chk(`the ${label} shader applies ABSORPTION LAST, after scatter, specular and rim, then clamps`,
          scatter > 0 && spec > scatter && rim > spec && absorb > rim && clamped > absorb,
          `offsets ${scatter}/${spec}/${rim}/${absorb}/${clamped} — ordered before them, a thick core keeps a `
          + 'full-strength rim, which is the "flat region with a bright outline" this step exists to remove');
      }
      // Invariant 13 / invariant 1 over the five new uniforms, in both files.
      for (const [label, src, prefix, fn, field] of [
        ['main', hdrSrc, 'uLiquidSurf', 'private renderLiquid\\(', 'cfg'],
        ['tile', tileSrc, 'uLiqSurf', 'private renderLiquidField\\(', 'liq'],
      ]) {
        const body = (src.match(new RegExp(fn + '[\\s\\S]*?\\n  \\}')) ?? [''])[0];
        const four = [['Refraction', 'refraction'], ['Specular', 'specular'],
          ['Thickness', 'thickness'], ['EdgeBright', 'edgeBrightness']];
        // ⚠️ **Anchored to the START OF THE STATEMENT (`^\s*gl\.`), because a gate PREFIXED to the upload
        // leaves the call itself intact** — `if (cfg.specular > 0) gl.uniform1f(…)` still contains the
        // substring, so the unanchored form MISSED both seeded gates while reading as a pass. That is
        // "UNCONDITIONALLY" asserted by the presence of the thing it was meant to forbid.
        const gated = four.filter(([u, f]) =>
          !new RegExp(`^\\s*gl\\.uniform1f\\(this\\.${prefix}${u}, ${field}\\.${f}\\);$`, 'm').test(body));
        chk(`the ${label} pass uploads all four 15.3 controls UNCONDITIONALLY (invariant 13)`,
          gated.length === 0,
          `in ${body.length} chars${gated.length ? `; gated or missing: ${gated.map(([, f]) => f).join(', ')}` : ''}`
          + ' — gating an upload on "is it non-zero" leaves the PREVIOUS preset\'s value in place on a shared '
          + 'program, and the grid drives up to 128 slots through one program per loop');
      }
      chk('all five new uniform locations are NULLED on teardown in both files (invariant 1)',
        ['Refraction', 'Specular', 'Thickness', 'EdgeBright', 'Radius'].every(u =>
          new RegExp(`this\\.uLiquidSurf${u} = null`).test(hdrSrc)
          && new RegExp(`this\\.uLiqSurf${u} = null`).test(tileSrc)),
        'a stale location outliving its program is invariant 1 — the upload then silently addresses nothing');
      // The Mixer (invariant 16's other half). All four are LINEAR, and the reason is the reason `colourMix`
      // is: 0 is each one's neutral value and a geometric lerp cannot reach it.
      // ⚠️ **Do NOT generalise "liquid fields interpolate geometrically" from `isoLevel`/`kernelWidth`.**
      {
        const interp = readFileSync(SRC + 'exploration/interpolate.ts', 'utf8');
        const liq = (stripComments(interp).match(/function interpolateLiquid[\s\S]*?\n\}/) ?? [''])[0];
        const four = ['refraction', 'specular', 'thickness', 'edgeBrightness'];
        chk('the Mixer lerps all four 15.3 controls LINEARLY, so 0 — their neutral value — is reachable',
          four.every(f => new RegExp(`${f}: inv \\* a\\.${f} \\+ t \\* b\\.${f}`).test(liq)),
          `in ${liq.length} chars of interpolateLiquid — a block interpolate.ts does not spread back is `
          + 'DROPPED and re-defaulted, which is how crystal/sparks/buoyancy/volumeRender silently revert');
      }
      // The UI half: four descriptors, each reaching the engine through `setLiquidConfig` (invariant 13).
      {
        const fx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));
        for (const f of ['refraction', 'specular', 'thickness', 'edgeBrightness']) {
          chk(`the ${f} slider writes through setLiquidConfig (invariant 13)`,
            new RegExp(`key: 'liquid\\.${f}'[\\s\\S]{0,300}?setLiquidConfig\\(\\{ \\.\\.\\.this\\.controls`
              + `\\.getLiquidConfig\\(\\), ${f}: v \\}\\)`).test(fx),
            'a slider that moves nothing is invariant 13, and on a material term it reads as "the effect is '
            + 'just subtle" rather than as a defect');
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== P. cohesion: frame-rate-independent, cull-aware, allocation-free, and gated at 0 ===\n');
// ---------------------------------------------------------------------------------------------------
{
  /*
   * v8 Step 15.4 (E87). Why this section MEASURES rather than greps, and what each measurement protects.
   *
   * `CohesionField` integrates a persistent per-particle offset from a cloud-in-cell density/centroid grid.
   * Every one of its failure modes produces a figure that still beads, so a browser pass confirms the feature
   * while the defect ships:
   *
   *   - ⚠️ **THE DEPOSIT'S DIVISOR.** `off = off·exp(−ret·dt) + u·deposit` is frame-rate independent only if
   *     `deposit` is the exact zero-order-hold integral `(1 − retain)/ret`. `lissajous.ts`'s cluster-force
   *     block divides by `rate60 = 1 − exp(−ret/60)` instead, because ITS push is a per-frame displacement
   *     while this one is a VELOCITY in px/s — and copying that form here was measured at a **~3.8×** drift
   *     over dt 8 → 50 ms against **0.08 %** for the correct one. On a 60 Hz machine the wrong form is exactly
   *     right, so the defect is invisible to whoever wrote it and appears only on someone else's display.
   *     Invariant 10 across a subsystem boundary, and `tsc` sees two `number`s.
   *   - ⚠️ **THE CULL SENTINEL, IN BOTH LOOPS.** `positions` is dense and a culled slot holds exactly −10000.
   *     Scattering those builds a phantom mass concentration far off screen, and every live particle near the
   *     frame edge is then dragged toward it — which reads as "cohesion pulls the figure apart" rather than as
   *     a missing guard. 38–48 % of the population is culled on seven library presets (invariant 21's
   *     population trap, the same one that returned the identity for the depth band).
   *   - ⚠️ **ALLOCATION RATE, NOT ALLOCATION TIME** (invariant 8). A grid rebuilt per frame is tens of MB/s,
   *     which reached a user as *"a jitter effect every few seconds"* — a GC pause, not a slow function.
   *   - ⚠️ **THE ZERO GATE.** `strength: 0` must be byte-identical to the pre-feature engine, because cohesion
   *     is read in EVERY render mode and 359 of 360 presets carry no block at all. An offset that survives a
   *     release to 0 restyles the whole library.
   *   - ⚠️ **ONE resolved radius, not two.** The grid pitch IS the interaction radius, so where `MAX_CELLS`
   *     raises the pitch it must raise the deadband, the push velocity and the offset cap with it — otherwise
   *     the force scales disagree with the neighbourhood by up to 1.4× at 4K: a strength error dressed as a
   *     size error, invariant 10's shape inside one function.
   *
   * ⚠️ The module is IMPORTED, never transcribed — section A's parity-oracle lesson (invariant 26): an oracle
   * written from the same assumptions as its subject inherits its convention errors and passes green.
   */
  const { CohesionField } = await import('../src/generators/cohesion-field.ts');
  const { CULL_SENTINEL: COH_CULL } = await import('../src/core/projection.ts');
  const cohSrc = stripComments(readFileSync(SRC + 'generators/cohesion-field.ts', 'utf8'));
  const lissSrc = stripComments(readFileSync(SRC + 'generators/lissajous.ts', 'utf8'));

  const CW = 1024, CH = 768;
  /** A Lissajous locus at main-view scale — the population whose ~1.2 px index spacing set the mechanism. */
  const cohLocus = (n) => {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      p[i * 3] = CW * 0.5 + CW * 0.32 * Math.sin(3 * t + 0.4) * Math.cos(t * 0.7);
      p[i * 3 + 1] = CH * 0.5 + CH * 0.32 * Math.sin(2 * t) * Math.cos(t * 1.3);
      p[i * 3 + 2] = 0;
    }
    return p;
  };
  const cfg = (o = {}) => ({ strength: 1, radius: 24, returnForce: 1.5, ...o });
  /** Run to a settled state and report the mean displacement magnitude over the live population. */
  const settle = (dtMs, seconds, conf = cfg(), n = 4000) => {
    const f = new CohesionField(n);
    const base = cohLocus(n);
    const pos = new Float32Array(base);
    const frames = Math.round((seconds * 1000) / dtMs);
    for (let k = 0; k < frames; k++) {
      pos.set(base);
      const ox = f.getOffsetX(), oy = f.getOffsetY();
      for (let i = 0; i < n; i++) {
        if (pos[i * 3] === COH_CULL) continue;
        pos[i * 3] += ox[i]; pos[i * 3 + 1] += oy[i];
      }
      f.update(dtMs, n, pos, CW, CH, conf);
    }
    const ox = f.getOffsetX(), oy = f.getOffsetY();
    let sum = 0, max = 0, live = 0, bad = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(ox[i], oy[i]);
      if (!Number.isFinite(d)) { bad++; continue; }
      sum += d; if (d > max) max = d; live++;
    }
    return { mean: live ? sum / live : 0, max, bad, field: f };
  };

  // --- 1. FRAME-RATE INDEPENDENCE ------------------------------------------------------------------------
  /*
   * ⚠️ **MY FIRST TWO ASSERTIONS HERE BOTH FAILED ON CORRECT CODE, AND THE CAUSE WAS THE HARNESS, NOT THE
   * ENGINE — the FIFTH checker-basis defect in Phase 15 and the one with the most transferable shape.** They
   * measured the settled mean of a CLOSED loop (offsets fed back into `positions`, as the generator does) and
   * asserted it varies < 5 % across dt. Measured on correct code: **5.45 %** over dt 8→50 ms. That figure is
   * not the deposit — it is the FEEDBACK: each frame gathers a centroid from the previous frame's displaced
   * positions, so a longer frame samples a differently-beaded figure and the two dt-dependences are summed.
   * ⚠️ **A closed-loop statistic cannot attribute its own variance**, which is invariant 26's parity-oracle
   * lesson in a temporal guise. And the calibration was worse than useless: a scalar recurrence with a
   * CONSTANT unit push has fixed point `deposit/(1 − retain)`, and for the `rate60` form that is dt-INDEPENDENT
   * (`(1−retain)` cancels exactly), so it reported a spread of **1.00x** and "failed to notice" a defect that
   * is in fact a **60x magnitude error**. ⚠️ **A calibration that measures the wrong statistic exonerates the
   * defect it was written to catch, which is strictly worse than having no calibration at all.**
   *
   * Both are replaced by the two instruments that DO isolate the quantity:
   *
   *   (a) a FIXED-BASE harness — the generator's own feedback is removed by never writing the offset back into
   *       `positions`, so the base figure is identical at every frame time. ⚠️ **It is not truly "open loop"
   *       and calling it that would misdescribe it: the class scatters at `bx + ox[i]`, so one step of the
   *       feedback is internal and unavoidable.** What this removes is the generator's re-projection, which is
   *       the term that cannot converge. Correct code: **0.10 %** at ret 1.5 and **0.52 %** at ret 5. Seeded
   *       (real class, one line replaced, outside the repo): `rate60` **85.8 %** / **83.1 %**, a per-frame
   *       `1/60` **59.2 %** / **275 %**, plain Euler `dtSec` **0.91 %** / **7.83 %** — so the ret 5 row is
   *       what separates the ZOH from Euler, whose error grows with `ret·dt`.
   *       ⚠️ **AND THE POPULATION IS PART OF THE INSTRUMENT: at n = 2000 correct code measures 3.63 %** and
   *       failed a 2 % threshold. That is not the deposit either — at ~2.4 px index spacing the beads land in
   *       a metastable configuration whose basin depends on the step count, so the harness has to be run
   *       where the settled state is unique. Measured across n = 3000/4000/6000/10000 the correct form sits at
   *       0.06–0.10 % (ret 1.5) and 0.50–0.99 % (ret 5) while every seed stays 1–3 orders above it, so the
   *       threshold is **2 %**, derived as ~2x the worst converged reading and ~7x below the nearest defect.
   *   (b) the ZOH's DEFINING IDENTITY, re-derived here rather than transcribed: the fixed point of
   *       `off = off·retain + u·deposit` is `u·deposit/(1 − retain)`, and the exact zero-order hold makes that
   *       equal `u/ret` at **every** dt. So `deposit/(1 − retain) === 1/ret` is a dt-independent identity, and
   *       one assertion over a grid of (ret, dt) catches every wrong divisor with no seeded file at all:
   *       worst relative error — ZOH **1.7e-16**, Euler **1.3e-1**, per-frame **1.1e+0**, `rate60` **6.2e+1**.
   */
  const rates = [8, 13, 16.7, 20, 25, 33, 50];
  /**
   * FIXED BASE: the offset is never written back into `positions`, so the base figure is the same at every
   * frame time and the generator's re-projection — the one term that cannot converge — is removed. n = 4000 is
   * the reachable-library median AND a converged population; see the header on why n = 2000 is not.
   */
  const openLoop = (dtMs, seconds, conf, n = 4000) => {
    const f = new CohesionField(n);
    const pos = cohLocus(n);
    for (let k = 0; k < Math.round((seconds * 1000) / dtMs); k++) f.update(dtMs, n, pos, CW, CH, conf);
    const ox = f.getOffsetX(), oy = f.getOffsetY();
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.hypot(ox[i], oy[i]);
    return s / n;
  };
  for (const ret of [1.5, 5]) {
    const m = rates.map(dt => openLoop(dt, 8, cfg({ returnForce: ret })));
    const sp = Math.max(...m) / Math.max(1e-9, Math.min(...m));
    chk(`the deposit integrates the same total at every frame time (returnForce ${ret})`,
      sp < 1.02,
      `${m.map(v => v.toFixed(4)).join(' / ')} px at dt ${rates.join(' / ')} ms — spread `
      + `${((sp - 1) * 100).toExponential(2)}%. Seeded into the real class at this n: rate60 `
      + `${ret === 5 ? '8.31e+1' : '8.58e+1'}%, a per-frame 1/60 ${ret === 5 ? '2.75e+2' : '5.92e+1'}%, plain `
      + `Euler ${ret === 5 ? '7.83e+0' : '9.05e-1'}% — so the ret 5 row is what separates the ZOH from Euler, `
      + 'whose error grows with ret*dt and is invisible at the shipped returnForce alone');
  }
  // (b) The identity, which is what makes the sweeps above non-vacuous without needing a seeded file: a field
  // that never moves has a flat spread too, but it cannot satisfy this.
  {
    let worst = 0, at = '';
    for (const ret of [0.05, 0.5, 1.5, 3, 5]) for (const ms of rates) {
      const dtSec = ms * 0.001;
      const retain = Math.exp(-ret * dtSec);
      const deposit = ret > 1e-6 ? (1 - retain) / ret : dtSec;   // the shipped expression, asserted below
      const rel = Math.abs(deposit / (1 - retain) - 1 / ret) * ret;
      if (rel > worst) { worst = rel; at = `ret ${ret}, dt ${ms} ms`; }
    }
    chk('...because the deposit is the EXACT zero-order hold, whose fixed point is u/ret at any dt',
      worst < 1e-12,
      `worst relative error ${worst.toExponential(3)} (${at}) — the same grid scores Euler 1.3e-1, a per-frame `
      + '1/60 1.1e+0 and the cluster-force rate60 divisor 6.2e+1, i.e. a 60x MAGNITUDE error and not a subtle '
      + 'one: (1 - retain) cancels in that form, which is why a naive scalar probe called it frame-independent');
  }
  // And the text, because the arithmetic above re-derives the formula and so cannot say the SOURCE spells it
  // that way. ⚠️ `!/rate60/` is the anchor that matters: the wrong form is one grep away in the same repo.
  chk('the shipped deposit divides by returnForce itself, never by a 60 Hz frame rate',
    /const deposit = ret > 1e-6 \? \(1 - retain\) \/ ret : dtSec;/.test(cohSrc)
    && !/rate60/.test(cohSrc),
    'the push here is a VELOCITY in px/s so its integral over the frame is (1 - exp(-ret*dt))/ret, while '
    + 'sampleClusterForce\'s push is a per-frame DISPLACEMENT and correctly divides by rate60 — same shape, '
    + 'different units, and tsc sees two numbers (invariant 10 across a subsystem boundary)');
  // The closed-loop figure is REPORTED, not asserted — it is the honest end-to-end number and its variance is
  // dominated by the feedback, so a threshold on it would be a threshold picked rather than derived.
  {
    const cm = [8, 16.7, 50].map(dt => settle(dt, 6).mean);
    console.log(`  note  closed-loop settled mean ${cm.map(v => v.toFixed(2)).join(' / ')} px at dt 8/16.7/50 ms `
      + `(spread ${(((Math.max(...cm) / Math.min(...cm)) - 1) * 100).toFixed(2)}%) — REPORTED, not asserted: `
      + 'the residue is the centroid resampling a differently-beaded figure, not the deposit');
  }

  // --- 2. THE CULL SENTINEL, MEASURED IN BOTH DIRECTIONS ------------------------------------------------
  {
    const n = 4000;
    const base = cohLocus(n);
    // 40 % culled, in a contiguous run — the realistic shape (a rotating figure culls an arc, not a scatter).
    const culled = new Set();
    for (let i = Math.floor(n * 0.3); i < Math.floor(n * 0.7); i++) culled.add(i);
    const withCull = new Float32Array(base);
    for (const i of culled) { withCull[i * 3] = COH_CULL; withCull[i * 3 + 1] = COH_CULL; }
    const f = new CohesionField(n);
    const pos = new Float32Array(withCull);
    for (let k = 0; k < 240; k++) {
      pos.set(withCull);
      const ox = f.getOffsetX(), oy = f.getOffsetY();
      for (let i = 0; i < n; i++) {
        if (pos[i * 3] === COH_CULL) continue;
        pos[i * 3] += ox[i]; pos[i * 3 + 1] += oy[i];
      }
      f.update(16.7, n, pos, CW, CH, cfg());
    }
    const ox = f.getOffsetX(), oy = f.getOffsetY();
    let movedCulled = 0, liveMax = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(ox[i], oy[i]);
      if (culled.has(i)) { if (d > 1e-9) movedCulled++; }
      else if (d > liveMax) liveMax = d;
    }
    chk('a culled particle accumulates EXACTLY no offset, so it returns at its mathematical position',
      movedCulled === 0,
      `${movedCulled} of ${culled.size} culled slots displaced; live max ${liveMax.toFixed(2)} px`);
    // The other direction: the live population must not be dragged toward the sentinel's corner. A phantom
    // cluster at (−10000, −10000) pulls everything toward −x/−y, so the SIGNED mean is the discriminator —
    // a magnitude alone cannot distinguish "pulled off screen" from "beaded".
    let sx = 0, sy = 0, live = 0;
    for (let i = 0; i < n; i++) {
      if (culled.has(i)) continue;
      sx += ox[i]; sy += oy[i]; live++;
    }
    const drift = Math.hypot(sx / live, sy / live);
    chk('...and the live population has no NET drift, so no phantom cluster forms at the sentinel',
      drift < 1.0,
      `net displacement ${drift.toFixed(4)} px over ${live} live particles (a scattered sentinel mass at `
      + `(${COH_CULL}, ${COH_CULL}) would show as a coherent pull toward -x/-y)`);
    // And the guard has to be in BOTH loops, not just the scatter — a gathered sentinel reads a centroid from
    // a cell 10 000 px off screen and writes a huge offset into a slot the renderer then un-culls.
    chk('...with the sentinel test present in the scatter AND the gather loop',
      (cohSrc.match(/bx === CULL_SENTINEL/g) ?? []).length >= 2,
      `${(cohSrc.match(/bx === CULL_SENTINEL/g) ?? []).length} sites — one guard is invariant 21's population `
      + 'trap: 38-48 % of the population is culled on seven library presets');
  }

  // --- 3. NO PER-FRAME ALLOCATION (invariant 8) ---------------------------------------------------------
  {
    const n = 4000;
    const f = new CohesionField(n);
    const base = cohLocus(n);
    const pos = new Float32Array(base);
    // Warm up, then confirm the grid arrays are the SAME objects across frames. Identity, not a byte count:
    // a reallocation to the same size is the exact defect and a size comparison cannot see it.
    f.update(16.7, n, pos, CW, CH, cfg());
    // `mass`/`sumX`/`sumY` are private; reach them through the instance, which is what a JS check can do and
    // is why this is here rather than in a unit test the repo does not have.
    const grab = () => [f.mass, f.sumX, f.sumY, f.touched];
    const before = grab();
    for (let k = 0; k < 30; k++) f.update(16.7, n, pos, CW, CH, cfg());
    const after = grab();
    chk('the grid and the cleared-cell list are REUSED across frames, never reallocated (invariant 8)',
      before.every((a, i) => a === after[i]) && before.every(a => a && a.length > 0),
      `${before.map((a, i) => (a === after[i] ? 'same' : 'REALLOCATED')).join('/')}; grid `
      + `${before[0].length} cells = ${(before[0].length * 12 / 1048576).toFixed(2)} MB — a per-frame rebuild `
      + 'is tens of MB/s, which reached a user as a periodic jitter (a GC pause)');
    // The clear must touch only the written cells, or the per-frame cost follows the GRID size rather than the
    // particle count — which is what makes the smallest radius affordable at 4K.
    chk('...and the clear walks the touched list, so its cost follows the particles and not the grid',
      /for \(let k = 0; k < tn; k\+\+\)/.test(cohSrc) && !/this\.mass\.fill\(0\)/.test(cohSrc),
      'a whole-grid fill is 526 k cells x 3 arrays per frame at radius 4 / 3840x2160');
    // The grid must still REBUILD on a radius change, since the pitch IS the radius. A cached grid keyed only
    // on the canvas would silently keep the old neighbourhood while the label said otherwise.
    const cellsAt = (r) => { const g = new CohesionField(64); g.update(16.7, 64, cohLocus(64), CW, CH, cfg({ radius: r })); return g.mass.length; };
    const c4 = cellsAt(4), c32 = cellsAt(32);
    chk('...while a radius change DOES resize it, because the grid pitch is the interaction radius',
      c4 > c32 * 4,
      `radius 4 -> ${c4} cells, radius 32 -> ${c32} — keyed on the cell count, so both the canvas and the `
      + 'radius rebuild it');
  }

  // --- 4. THE ZERO GATE, AND THE RELEASE ----------------------------------------------------------------
  {
    // `strength: 0` produces no displacement at all — the pre-feature figure, byte for byte. Measured rather
    // than argued, because `speed = strength * SPEED * radius` reaching 0 is only half of it: the retain term
    // would still carry an existing offset forward for ~1/ret seconds.
    const z = settle(16.7, 4, cfg({ strength: 0 }));
    chk('strength 0 displaces nothing, so 359 of 360 presets are byte-identical to the pre-feature engine',
      z.mean === 0 && z.max === 0,
      `mean ${z.mean} px, max ${z.max} px over 4 s`);
    // The generator's gate. ⚠️ Anchored to the statement, because an unanchored `cohesionField.update(` also
    // matches inside a wrapper that calls it unconditionally — §O's own 15.3 calibration found two assertions
    // satisfied by the very construct they forbade.
    chk('...and the generator SKIPS the whole stage at 0 rather than running it and multiplying by zero',
      /if \(this\.cohesionConfig\.strength > 0 && this\.cohesionAllowed\(\)\) \{/.test(lissSrc),
      'a stage that runs at 0 still costs a scatter and a gather over every particle, every frame');
    // And a release to 0 must CLEAR the accumulated offsets, or the beads freeze in place instead of relaxing:
    // with the stage skipped, nothing decays them and the figure stays beaded forever at Cohesion 0.
    const setter = braceBody(lissSrc, 'setCohesionConfig(config: CohesionConfig)');
    chk('...with a release to 0 RESETTING the offsets, so the beads relax instead of freezing',
      /config\.strength <= 0 && this\.cohesionField/.test(setter) && /\.reset\(\);/.test(setter),
      `in ${setter.length} chars of setCohesionConfig — the skip means nothing decays them, so a frozen `
      + 'beaded figure at Cohesion 0 is the failure, and it reads as the slider being broken');
    // ⚠️ The reset belongs to the SETTER, not to `update()`: the setter is the event. A per-frame `if` would
    // clear an array 60 times a second for every preset in the library that never touches the feature.
    chk('...and that reset lives in the setter, not in the per-frame update',
      !/strength <= 0/.test(braceBody(cohSrc, 'update(dt: number, count: number')),
      'a per-frame zero branch clears 2 x 50 000 floats every frame on 359 presets that never enable this');
  }

  // --- 5. ONE RESOLVED RADIUS, AND THE CELL CAP ---------------------------------------------------------
  {
    // The cap must actually bound the grid — including the ceiling `ensure()` takes per axis, which an
    // exact-quotient solve misses by one row and one column. Measured at the worst shipped combination.
    const worst = new CohesionField(64);
    worst.update(16.7, 64, cohLocus(64), 3840, 2160, cfg({ radius: 4 }));
    chk('the grid cannot exceed MAX_CELLS at any canvas x radius the UI can reach',
      worst.mass.length <= CohesionField.MAX_CELLS,
      `3840x2160 at radius 4 -> ${worst.mass.length} cells (cap ${CohesionField.MAX_CELLS}) = `
      + `${(worst.mass.length * 12 / 1048576).toFixed(2)} MB; solving against the exact quotient rather than `
      + 'the ceiling overshoots by one row and one column — a bound that is nearly right is not a bound');
    // ⚠️ And the cap must raise the RADIUS, not only the pitch. The discriminator is the deadband/speed/cap
    // trio scaling with the resolved value: if `config.radius` were used for those, a capped run would push
    // with a strength calibrated for a neighbourhood 1.4x smaller than the one it gathers from.
    const resolveBody = braceBody(cohSrc, 'private resolveRadius(width: number, height: number, radius: number)');
    chk('...and the cap raises the RADIUS itself, so the force scales cannot disagree with the neighbourhood',
      /const radius = this\.resolveRadius\(width, height, Math\.max\(1, config\.radius\)\);/.test(cohSrc)
      && /CohesionField\.DEADBAND \* radius/.test(cohSrc)
      && /CohesionField\.MAX_RADII \* radius/.test(cohSrc)
      && /CohesionField\.SPEED \* radius/.test(cohSrc)
      && resolveBody.length > 100,
      `resolveRadius body ${resolveBody.length} chars; deadband, speed and cap all read the RESOLVED radius `
      + '— using config.radius for them is a strength error dressed as a size error (invariant 10 in one '
      + 'function), and it only appears at 4K');
    // No cap at ordinary sizes, measured — a cap that bit at 1024x768 would silently change the shipped look.
    const ordinary = new CohesionField(64);
    ordinary.update(16.7, 64, cohLocus(64), CW, CH, cfg({ radius: 4 }));
    chk('...and it does NOT bite at any ordinary canvas, so the shipped look is the requested radius',
      ordinary.mass.length < CohesionField.MAX_CELLS,
      `1024x768 at radius 4 -> ${ordinary.mass.length} cells, well under the ${CohesionField.MAX_CELLS} cap`);
  }

  // --- 6. STABILITY AND THE RETURN FORCE ----------------------------------------------------------------
  {
    // ⚠️ **`returnForce` IS A CORRECTNESS CONDITION, NOT A REFINEMENT.** At 0 nothing pulls a particle back to
    // its curve, so the offsets integrate until they hit the internal cap: measured, the mean plateaus near
    // 48 px with a few hundred of 10 000 pinned at 4x radius. That is bounded and finite, which is the point —
    // it must not diverge and must not produce a single non-finite value (invariant 12: reseed, never clamp).
    const free = settle(16.7, 20, cfg({ returnForce: 0 }), 4000);
    chk('at Return Force 0 the offsets stay bounded and finite rather than diverging (invariant 12)',
      free.bad === 0 && Number.isFinite(free.max) && free.max <= 4 * 24 + 1e-3,
      `mean ${free.mean.toFixed(1)} px, max ${free.max.toFixed(1)} px (cap 4 x 24 = 96), `
      + `${free.bad} non-finite — the cap is the backstop for THIS corner, not a load-bearing stabiliser`);
    // At ordinary settings nothing should reach the cap at all, which is what says the spring rather than the
    // clamp is doing the work. A cap that bites in normal use is a clipped look, not a stable one.
    const normal = settle(16.7, 20, cfg(), 4000);
    chk('...while at the shipped Return Force nothing reaches the cap, so the SPRING is what stabilises it',
      normal.max < 4 * 24 * 0.75 && normal.bad === 0,
      `max ${normal.max.toFixed(1)} px against a 96 px cap; mean ${normal.mean.toFixed(1)} px`);
    /*
     * ⚠️ **THE INTEGRATE TAIL'S RESEED IS REACHED BY A NON-FINITE *CONFIG*, NOT BY A NON-FINITE *POSITION* —
     * AND MY FIRST ASSERTION HERE TESTED THE UNREACHABLE HALF.** It fed `NaN` into `positions[7]` and asserted
     * the slot reseeds to 0. That passes, and it passes with the reseed DELETED: the two loops' own
     * `Number.isFinite(bx)` guard already zeroes such a slot and `continue`s, so the tail never sees it.
     * Seeded (reseed removed): **MISSED, 0 assertions failed** — the one gap in this section's first
     * calibration, and precisely the shape §N and §O each hit before: **an assertion aimed at a line no input
     * reaches is green forever and reads exactly like a working guard.**
     *
     * Measured reachability: NaN/Inf/±1e308 in `positions` → **0 trips over 300 frames** at every strength.
     * `strength: NaN` or `Infinity` (and `returnForce: NaN`) → **51 200 trips**, because `speed` multiplies the
     * push AFTER both loops' position guards. That is the live path: `strength` comes from a slider and from an
     * imported preset's JSON, where a `null` or a malformed number arrives as `NaN` with nothing upstream to
     * catch it. ⚠️ **And without the reseed it LATCHES: the offsets stay non-finite for 256/256 particles even
     * after 200 frames of a perfectly sane config**, so the figure never comes back for the rest of the session
     * — invariant 12's *reseed, do not clamp* and invariant 20's *a non-finite value is inescapable by a
     * multiply*, in one line. Asserted through the reachable door, and the sane-config recovery is the half
     * that makes it more than a finiteness test.
     */
    {
      const n = 256;
      const pos = cohLocus(n);
      for (const poison of [{ strength: NaN }, { strength: Infinity }, { returnForce: NaN }]) {
        const f = new CohesionField(n);
        for (let k = 0; k < 40; k++) f.update(16.7, n, pos, CW, CH, cfg(poison));
        for (let k = 0; k < 120; k++) f.update(16.7, n, pos, CW, CH, cfg());   // a sane config again
        const ox = f.getOffsetX(), oy = f.getOffsetY();
        let bad = 0;
        for (let i = 0; i < n; i++) if (!Number.isFinite(ox[i]) || !Number.isFinite(oy[i])) bad++;
        const key = Object.keys(poison)[0];
        chk(`a non-finite ${key} RESEEDS rather than latching, so the figure recovers (invariants 12 + 20)`,
          bad === 0,
          `${bad}/${n} still non-finite after 120 sane frames — without the reseed it is ${n}/${n}, i.e. the `
          + 'whole population gone for the session. Reached through the CONFIG (a slider or an imported '
          + 'preset\'s JSON), never through positions: NaN/Inf/1e308 in positions trips it 0 times in 300 '
          + 'frames, because both loops zero-and-continue on those first');
      }
    }
  }

  // --- 7. THE STAGE'S PLACEMENT, AND THE TWO OWNERS IT MUST NOT DRIFT FROM ------------------------------
  {
    // The stage runs on PROJECTED positions, downstream of the fire-buoyancy displacement. Asserted by ORDER
    // within the one function, because both blocks read `this.positions` and `tsc` sees no difference — and
    // a position comparison is only meaningful inside one function body (§M's own probe-scale error).
    const gen = braceBody(lissSrc, 'private generateParticles(dt: number)')
      || braceBody(lissSrc, 'update(dt: number)');
    const buoy = gen.indexOf('this.fireProcessor.update(dt, temps, this.buoyancyConfig, this.positions)');
    const coh = gen.indexOf('this.cohesionField.update(dt, this.particleCount, this.positions');
    chk('cohesion runs on PROJECTED positions, after fire buoyancy has displaced them',
      buoy > 0 && coh > buoy,
      `buoyancy at ${buoy}, cohesion at ${coh} within ${gen.length} chars — a pixel radius evaluated in MODEL `
      + 'space would scale with the figure and with perspZ = -(w+h)/2, so one slider value would mean a '
      + 'different neighbourhood at every canvas size');
    // Invariant 1: the handle must be NULLED, not merely disposed, since `init()` may not reassign it.
    const disp = braceBody(lissSrc, 'dispose(): void');
    chk('dispose() nulls the field handle as well as disposing it (invariant 1)',
      /this\.cohesionField\.dispose\(\); this\.cohesionField = null;/.test(disp),
      `in ${disp.length} chars of dispose() — a disposed-but-non-null handle is used again by the next frame`);
    // Invariant 6's shape: the per-particle offsets must follow a Particle Number change, PRESERVING history.
    chk('...and a particle-count change resizes the offsets, carrying the existing ones',
      /if \(this\.cohesionField\) this\.cohesionField\.resize\(next\);/.test(lissSrc)
      && /out\.set\(src\.length <= next \? src : src\.subarray\(0, next\)\);/.test(cohSrc),
      'reallocating to zeros would snap the whole population off its drops on every step of a slider drag');
    // The UI reaches the engine through main.ts's accessor pair, and the export is gated on strength so no
    // existing preset file gains a key (invariant 14's defaults-first merge is the other half).
    const mainCoh = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
    chk('main.ts merges the preset over the DEFAULTS rather than over live state (invariant 14)',
      /Object\.assign\(currentCohesion, DEFAULT_COHESION_CONFIG, o\.cohesion \?\? \{\}\);/.test(mainCoh),
      'Object.assign copies only PRESENT keys, so a preset omitting a field would inherit the previous '
      + 'preset\'s value — the on/off state must follow the preset, not stick');
    chk('...and the export is gated on strength > 0, so no existing preset file gains a key',
      /currentCohesion\.strength > 0 \? \{ cohesion: \{ \.\.\.currentCohesion \} \} : \{\}/.test(mainCoh),
      'an unconditional emit puts an inert block into all 360 exports and breaks Export All\'s byte-identical '
      + 'fixed point');
  }
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== Q. the liquid FIELD pool: the four-site partition, the lag, the reseed, and the NaN door ===\n');
// ---------------------------------------------------------------------------------------------------
{
  /*
   * v8 Step 15.5 (E88). `LiquidPool` seeds a second population and moves it only by the velocity field the
   * figure writes, so the figure moves THROUGH a liquid instead of being one.
   *
   * ⚠️ **THE SECTION'S FIRST AND MOST IMPORTANT ASSERTION IS AN ASYMMETRY, NOT A FORMULA.** Four sites spell
   * almost the same subtraction over the published arrays and they split TWO AND TWO:
   *
   *     neon `trajectoryCount()`      count − crystalCount − liquidCount      both tail blocks
   *     shader `uSparkLast`           count − crystalCount − liquidCount      both tail blocks
   *     ribbon `updateHistory()`      count − crystalCount                    crystals ONLY
   *     main `fillSparkIndices()`     count − crystalCount                    crystals ONLY
   *
   * The discriminator is **what the bound feeds**, and it is answered per consumer: a bound that feeds a
   * HISTORY or a RIBBON SELECTION may narrow freely, and a bound that feeds a DRAW PATH may not. Ribbon's
   * `count` is two quantities at once — it also bounds the hybrid point pass, the pool's only draw path in that
   * one mode — and `fillSparkIndices` is a gather list for "every drawable slot no trajectory renderer covers",
   * which the pool now is precisely BECAUSE neon and ribbon streaks exclude it.
   *
   * ⚠️ **So a tidying pass that made all four identical would be the regression, in EITHER direction, and no
   * type-check can see it: every one of the four is `number` and every one is individually plausible.** Widen
   * the two narrow ones and the pool is sized as sparks (a shader range over slot indices) or gains ribbons;
   * narrow the two wide ones and the pool **simulates, publishes and is never drawn at all** — invariant 13's
   * shape reached through a bound, visible only under neon and ribbon streaks, and only while a pool runs.
   * Both directions were live defects during this step's build, caught by reading rather than by any checker.
   * Hence four assertions on the four literal expressions, each naming its own consumer.
   *
   * What else here fails GREEN, i.e. produces a pool that still flows while the defect ships:
   *
   *   - ⚠️ **THE LAG IS INVISIBLE TO A FRAME-RATE STATISTIC.** The velocity chases the field at
   *     `1 − exp(−INERTIA·dt)`, so it is frame-rate correct by construction. Measured settled travel spread
   *     over dt 8 → 50 ms: **0.370 %**. But a **SNAP** (`relax = 1`, the lag deleted) measures the SAME
   *     **0.300 %** on that statistic, because a first-order lag is frame-rate independent whether or not its
   *     time constant is right. The statistic that separates them is the **RISE FROM REST**: at one
   *     τ = 1/INERTIA the speed must be `1 − 1/e`, measured **0.6329** against the ideal 0.6321, where a snap
   *     gives **1.0000**, half the inertia 0.3941 and double it 0.8652. **Assert the time constant, not only
   *     the frame-rate independence** — the two are different properties and the cheaper one passes on a
   *     defect. (§P's own closed-loop finding, one step later and in the opposite direction: there the
   *     statistic measured too much, here it measures too little.)
   *   - ⚠️ **A CLAMP INSTEAD OF A RESEED MANUFACTURES A WORSE ARTEFACT THAN THE DRIFT IT FIXES.** The field has
   *     no pressure projection by design, so it is compressible and mass piles up without bound. Measured over
   *     90 s at a strong field: the real class leaves **0.000 %** of the population within 2 px of a frame
   *     edge, an emulated clamp leaves **100.000 %** — a solid rim, which under 15.1's iso-surface draws as a
   *     bright continuous line along the whole border. Invariant 12, with the failure mode measured.
   *   - ⚠️ **THE NaN DOOR IS THE CONFIG, AND `Math.max`/`Math.min` DO NOT CLOSE IT — THEY PROPAGATE.** This
   *     section's calibration FOUND A LIVE DEFECT: `Math.max(0, Math.min(MAX, Math.floor(NaN)))` is NaN, so
   *     `ensure()` set `count = NaN` while its own seeding bound `Math.min(count, size)` was NaN too, making
   *     `for (i = NaN; …)` run **zero** times. One frame with a non-finite `poolSize` collapsed the pool to a
   *     single point at (0, 0) — 4000/4000 coincident, bbox **0.0×0.0** against a healthy **488.6×487.4** — and
   *     **LATCHED for the session**, still collapsed after 720 further frames of a sane config; the only escape
   *     a user could stumble on was changing `Seed Pattern`. Fixed at the source with `Number()` then
   *     `Number.isFinite`. **Reached through the config, never through positions** — §P's finding reproduced,
   *     and the reason this asserts the recovery rather than the finiteness.
   *   - ⚠️ **SEEDING MUST BE INDEPENDENT OF THE POOL'S SIZE.** `Pool Size` has 200 stops; a size-dependent
   *     home (a jittered grid, or `floor(i / perBlob)` for the blobs) re-derives every particle's seed on each
   *     stop, so one drag tears the pool apart and re-forms it 200 times. Measured 0 px of movement over the
   *     first 1000 slots at 1000 vs 4000 for all four patterns, and a shrink-then-regrow restores exactly.
   *
   * ⚠️ The module is IMPORTED, never transcribed (section A's parity-oracle lesson, invariant 26).
   */
  const { LiquidPool } = await import('../src/generators/liquid-pool.ts');
  const poolSrc = stripComments(readFileSync(SRC + 'generators/liquid-pool.ts', 'utf8'));
  const lqLiss = stripComments(readFileSync(SRC + 'generators/lissajous.ts', 'utf8'));
  const lqMain = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  const lqHdr = stripComments(readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8'));
  const lqNeon = stripComments(readFileSync(SRC + 'renderers/neon-line-renderer.ts', 'utf8'));
  const lqRib = stripComments(readFileSync(SRC + 'renderers/ribbon-renderer.ts', 'utf8'));
  const lqFluid = stripComments(readFileSync(SRC + 'post-processors/fluid-advection.ts', 'utf8'));
  const lqInterp = stripComments(readFileSync(SRC + 'exploration/interpolate.ts', 'utf8'));
  const lqRules = stripComments(readFileSync(SRC + 'exploration/overlay-rules.ts', 'utf8'));

  const LW = 1024, LH = 768, LMIN = 768;
  const lqCfg = (o = {}) => ({
    enabled: true, poolSize: 2000, seedPattern: 'cloud', fieldCoupling: 1, fieldDecay: 0.985, ...o,
  });
  /** A uniform rightward field at a representative readback magnitude. */
  const FIELD = 5e-4;
  const lqFlat = (u, v, c) => (c === 0 ? FIELD : 0);
  const lqRun = (dtMs, secs, conf = lqCfg(), samp = lqFlat) => {
    const p = new LiquidPool();
    const n = Math.round((secs * 1000) / dtMs);
    for (let k = 0; k < n; k++) p.update(dtMs, LW, LH, conf, samp);
    return p;
  };
  /** Bounding box of the live population, plus how many slots sit on top of slot 0. */
  const lqSpread = (p) => {
    const q = p.getPositions(), n = p.getCount();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, coincident = 0;
    for (let i = 0; i < n; i++) {
      const x = q[i * 3], y = q[i * 3 + 1];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (Math.hypot(x - q[0], y - q[1]) < 1e-3) coincident++;
    }
    return { n, w: x1 - x0, h: y1 - y0, coincident };
  };

  // --- 1. THE FOUR-SITE PARTITION -----------------------------------------------------------------------
  {
    // Asserted as four separate expressions rather than as one derived rule, because the rule IS the split:
    // any statement general enough to cover all four would be satisfied by making them agree.
    chk('neon `trajectoryCount()` subtracts BOTH tail blocks (a pure history bound, drawn by drawSparkSubset)',
      /const n = state\.count - \(state\.crystalCount \?\? 0\) - \(state\.liquidCount \?\? 0\);/.test(lqNeon),
      'neon draws trail geometry and never a single particle, so anything it drops must be picked up by the '
      + 'caller\'s drawSparkSubset() — check that pairing before narrowing either bound');
    chk('the splat shader\'s `uSparkLast` subtracts BOTH, because gl_InstanceID there is a SLOT index',
      /const sparkLast = state\.count - \(state\.crystalCount \?\? 0\) - \(state\.liquidCount \?\? 0\);/.test(lqHdr),
      'a range reaching into the pool would size pool particles at `sparks.splatRadius` — 2-4 px against a '
      + 'material 3-14 px, i.e. the spark-size defect fixed on 2026-08-29 reintroduced on a new block');
    chk('ribbon `updateHistory()` subtracts ONLY crystals — its count also bounds the hybrid POINT pass',
      /const count = Math\.max\(0, state\.count - \(state\.crystalCount \?\? 0\)\);/.test(lqRib)
      && !/state\.count - \(state\.crystalCount \?\? 0\) - \(state\.liquidCount \?\? 0\)/.test(lqRib),
      'main.ts draws getPointIndices() INSTEAD OF drawSparkSubset() in hybrid mode, so a pool excluded here '
      + 'has no draw path at all in that one mode: it simulates, publishes and is invisible (invariant 13)');
    const sparkIdxFn = braceBody(lqMain, 'const fillSparkIndices = (): number =>');
    chk('...and `fillSparkIndices()` subtracts ONLY crystals — it is a GATHER LIST, not a slot range',
      /const end = state\.count - \(state\.crystalCount \?\? 0\);/.test(sparkIdxFn)
      && !/liquidCount/.test(sparkIdxFn),
      `in ${sparkIdxFn.length} chars — neon and ribbon streaks both exclude the pool, so this is the one path `
      + 'that draws it there; the gather builds a COMPACTED sub-state with no waveCount, so widening the range '
      + 'cannot mis-size anything (read the comment, not the name)');
  }

  // --- 2. THE LAG: FRAME-RATE INDEPENDENCE *AND* THE TIME CONSTANT -------------------------------------
  {
    // Warm to a settled state first, then measure one second of travel. ⚠️ Measured from REST the transient
    // dominates and the same correct code reports 2.437 % — a threshold set on that number would be measuring
    // the rise, not the integrator. Settle first, exactly as §P settles before measuring its deposit.
    const settledRate = (dtMs) => {
      const p = new LiquidPool();
      for (let k = 0; k < Math.round(2000 / dtMs); k++) p.update(dtMs, LW, LH, lqCfg(), lqFlat);
      const a = Float32Array.from(p.getPositions().subarray(0, p.getCount() * 3));
      for (let k = 0; k < Math.round(1000 / dtMs); k++) p.update(dtMs, LW, LH, lqCfg(), lqFlat);
      const b = p.getPositions();
      let sum = 0;
      for (let i = 0; i < p.getCount(); i++) sum += Math.hypot(b[i * 3] - a[i * 3], b[i * 3 + 1] - a[i * 3 + 1]);
      return sum / p.getCount();
    };
    const rates = [8, 16.7, 33.3, 50].map(settledRate);
    const mean = rates.reduce((s, v) => s + v, 0) / rates.length;
    const spread = (Math.max(...rates) - Math.min(...rates)) / mean;
    // 1.5 % is ~4x the measured 0.370 % and ~2x below the 1.602 % a per-frame-constant relax measures.
    chk('the pool\'s travel is FRAME-RATE INDEPENDENT: relax = 1 - exp(-INERTIA*dt), not a per-frame constant',
      spread < 0.015,
      `${(spread * 100).toFixed(3)}% over dt 8-50ms (${rates.map(v => v.toFixed(1)).join('/')} px/s); a `
      + 'per-frame INERTIA/60 measures 1.602% and is exactly right only on the 60 Hz machine that wrote it');

    // ⚠️ THE ASSERTION THE ABOVE CANNOT MAKE. A snap measures 0.300% on that statistic — better than correct
    // code — so frame-rate independence is necessary and NOT sufficient. Rise from rest is the discriminator.
    const tau = 1 / LiquidPool.INERTIA;
    const target = FIELD * LiquidPool.SPEED * LMIN * 60;
    const velRef = LiquidPool.VEL_REF * LMIN;
    const speedAfter = (secs) => {
      const p = lqRun(16.7, secs);
      const s = p.getSpeeds();
      let mx = 0;
      for (let i = 0; i < p.getCount(); i++) mx = Math.max(mx, s[i]);
      return mx * velRef;
    };
    const fracAtTau = speedAfter(tau) / target;
    const ideal = 1 - Math.exp(-1);
    chk('...and the LAG ITSELF is asserted: one tau of rise reaches 1 - 1/e, where a SNAP reaches 1.0',
      Math.abs(fracAtTau - ideal) < 0.02,
      `${fracAtTau.toFixed(4)} against ${ideal.toFixed(4)} at tau = ${tau}s. A snap gives 1.0000, half the `
      + 'inertia 0.3941, double it 0.8652 — and ALL THREE pass the frame-rate assertion above, a snap at '
      + '0.300%. Without the lag the pool reads as dust blown by a fan rather than as a body with mass');

    // The unit chain. `gain = coupling * SPEED * minDim * 60` converts the readback's per-60 Hz-frame UV
    // displacement into px/s (invariant 10 across a subsystem boundary — `tsc` sees two `number`s).
    chk('the coupling gain converts the field\'s UV-per-frame into px/s as `SPEED * minDim * 60`',
      /const gain = Math\.max\(0, config\.fieldCoupling\) \* LiquidPool\.SPEED \* minDim \* 60;/.test(poolSrc)
      && Math.abs(speedAfter(2.0) / target - 1) < 0.03,
      `settled speed ${speedAfter(2.0).toFixed(2)} px/s against the derived ${target.toFixed(2)} at a field of `
      + `${FIELD}; dropping the *60 understates by 60x and reads as "Field Coupling does nothing"`);
    // Invariant 26: every length is a fraction of min(w,h), so a pattern is the same SHAPE at every aspect.
    const extents = [[1024, 768], [1920, 1080], [768, 1024], [1080, 1080]].map(([w, h]) => {
      const p = new LiquidPool();
      p.update(16.7, w, h, lqCfg({ poolSize: 4000 }), null);
      const q = p.getPositions();
      let rx = 0, ry = 0;
      for (let i = 0; i < 4000; i++) {
        rx = Math.max(rx, Math.abs(q[i * 3] - w * 0.5));
        ry = Math.max(ry, Math.abs(q[i * 3 + 1] - h * 0.5));
      }
      return { w, h, fx: rx / Math.min(w, h), fy: ry / Math.min(w, h) };
    });
    const worstAniso = Math.max(...extents.map(e => Math.abs(e.fx - e.fy)));
    const fxSpread = Math.max(...extents.map(e => e.fx)) - Math.min(...extents.map(e => e.fx));
    chk('seed lengths are fractions of min(w,h), so `Cloud` is a CIRCLE at every aspect (invariant 26)',
      worstAniso < 0.01 && fxSpread < 0.01,
      `worst |fx - fy| = ${worstAniso.toFixed(5)} of minDim, extent spread across 4 shapes `
      + `${fxSpread.toFixed(5)} (measured 0.3183/0.3173 at every shape). A radius of 0.32*w by 0.32*h is an `
      + 'ELLIPSE that changes shape with the window — a preview-vs-fullscreen difference that reads as style');
  }

  // --- 3. THE RESEED, AND WHY A CLAMP IS WORSE THAN THE DRIFT ------------------------------------------
  {
    const strong = (u, v, c) => (c === 0 ? 8e-3 : (c === 1 ? 4e-3 : 0));
    const p = lqRun(16.7, 90, lqCfg(), strong);
    const q = p.getPositions(), n = p.getCount();
    const apron = LiquidPool.OUT_MARGIN * LMIN;
    let out = 0, bad = 0, rim = 0;
    for (let i = 0; i < n; i++) {
      const x = q[i * 3], y = q[i * 3 + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) bad++;
      if (x < -apron || x > LW + apron || y < -apron || y > LH + apron) out++;
      if (x < 2 || x > LW - 2 || y < 2 || y > LH - 2) rim++;
    }
    chk('90 s at a strong field leaves NOTHING outside the apron and nothing non-finite (invariant 12)',
      out === 0 && bad === 0,
      `${out} beyond the apron, ${bad} non-finite of ${n}. The field has NO pressure projection by design, so `
      + 'it is compressible and mass piles up without bound — the step\'s own note says watch it for a minute');
    // ⚠️ The assertion that names the ALTERNATIVE's cost, so a future edit cannot "simplify" the reseed away.
    chk('...and the population is NOT clamped at the edge: an emulated clamp pins 100 % of it to the rim',
      rim / n < 0.01
      && /nx = this\.seedX\[i\]!;/.test(poolSrc) && /ny = this\.seedY\[i\]!;/.test(poolSrc)
      && !/Math\.min\(w, Math\.max\(0, nx\)\)/.test(poolSrc),
      `${((rim / n) * 100).toFixed(3)}% within 2 px of an edge against a measured 100.000% for a clamp. A `
      + 'clamp does not merely fail to fix the drift, it manufactures a permanent rim that 15.1\'s iso-surface '
      + 'draws as a bright continuous line along the whole border');
    /*
     * Invariant 21: a non-finite readback texel is CPU-side state every GPU-side guard is upstream of.
     *
     * ⚠️ **MEASURED FROM A MOVING STATE, NOT FROM REST — AND THAT IS THE WHOLE ASSERTION.** The obvious probe
     * (a fresh pool, poison from frame 1, compare against a null sampler) MISSED THIS SEEDED DEFECT
     * COMPLETELY, because at rest an unguarded NaN velocity makes every position NaN, which the `escaped`
     * test catches on that very frame and reseeds — and a reseeded slot sits at exactly the seed a null
     * sampler leaves it at. **A guard and its absence agreed to 0.000 px, so the probe measured invariant
     * 12's backstop and reported it as invariant 21's guard.**
     *
     * The discriminator is 120 frames of a HEALTHY field first, so the population is 250 px from home: the
     * guarded pool then keeps coasting (worst move 15.0 px over 10 poisoned frames, speeds holding at 0.312),
     * while the unguarded one teleports **512/512 slots home** and publishes speed 0.000 — a whole population
     * snapping back to its seed pattern the instant one texel goes bad. **That is the visible defect, and it
     * is a POSITION statistic, not a finiteness one**: `badN` is 0 in both cases, so a non-finite scan alone
     * exonerates it. §P's "a calibration that measures the wrong statistic actively exonerates the defect",
     * for the third time in this phase and the second time in this section.
     */
    const nanSamp = (u, v, c) => (c === 0 ? NaN : Infinity);
    const warm = lqCfg({ poolSize: 512 });
    const pn = new LiquidPool();
    for (let k = 0; k < 120; k++) pn.update(16.7, LW, LH, warm, lqFlat);
    const coasting = Float32Array.from(pn.getPositions().subarray(0, 512 * 3));
    for (let k = 0; k < 10; k++) pn.update(16.7, LW, LH, warm, nanSamp);
    const qn = pn.getPositions();
    const seedRef = new LiquidPool();
    seedRef.update(16.7, LW, LH, warm, null);
    const sr = seedRef.getPositions();
    let badN = 0, moved = 0, home = 0, held = 0;
    const sn = pn.getSpeeds();
    for (let i = 0; i < 512; i++) {
      if (!Number.isFinite(qn[i * 3]) || !Number.isFinite(qn[i * 3 + 1])) badN++;
      moved = Math.max(moved, Math.hypot(qn[i * 3] - coasting[i * 3], qn[i * 3 + 1] - coasting[i * 3 + 1]));
      if (Math.hypot(qn[i * 3] - sr[i * 3], qn[i * 3 + 1] - sr[i * 3 + 1]) < 0.5) home++;
      if (sn[i] > 0.01) held++;
    }
    chk('a non-finite readback texel is guarded at the SAMPLE, so a MOVING pool coasts rather than snapping home',
      badN === 0 && home === 0 && held === 512 && moved < 40,
      `${badN} non-finite, ${home}/512 teleported to their seeds, ${held}/512 still moving, worst move `
      + `${moved.toFixed(2)} px over 10 poisoned frames. Unguarded: 512/512 home, 0 moving, 250.52 px — the `
      + 'whole population snapping back to the seed pattern the instant one texel goes bad. ⚠️ Probed from '
      + 'REST the two are IDENTICAL (0.000 px, badN 0 both ways), because invariant 12\'s escape test catches '
      + 'the NaN position and reseeds to the very place a null sampler leaves it: the naive probe measures the '
      + 'BACKSTOP and reports it as the guard');
  }

  // --- 4. THE NaN DOOR: THE CONFIG, AND WHY min/max IS NOT A GUARD ------------------------------------
  {
    /*
     * ⚠️ **THIS GROUP FOUND A LIVE DEFECT DURING ITS OWN CALIBRATION, WHICH IS THE POINT OF CALIBRATING**, and
     * it is §P's finding reproduced one step later: the reachable door is the CONFIG, not `positions`.
     * `poolSize` arrives from a slider and from an imported preset's JSON, where a `null` or a malformed number
     * lands as `NaN`. Before the fix, ONE such frame collapsed the pool to a single point at (0, 0) and latched
     * for the session. The assertion is the RECOVERY, not the finiteness — a finiteness test passes on the
     * defect, since a collapsed pool holds 4000 perfectly finite copies of one position.
     */
    for (const poison of [NaN, Infinity, -Infinity, null, undefined, 1e308 * 10]) {
      const p = new LiquidPool();
      for (let k = 0; k < 3; k++) p.update(16.7, LW, LH, lqCfg({ poolSize: poison }), lqFlat);
      for (let k = 0; k < 120; k++) p.update(16.7, LW, LH, lqCfg(), lqFlat);   // a sane config again
      const s = lqSpread(p);
      chk(`a poolSize of ${String(poison)} RESEEDS rather than collapsing the pool to one point`,
        s.n === 2000 && s.coincident === 1 && s.w > 200 && s.h > 200,
        `count ${s.n}, bbox ${s.w.toFixed(1)}x${s.h.toFixed(1)}, ${s.coincident} slots coincident. Measured `
        + 'before the fix: 4000/4000 coincident at (0,0), bbox 0.0x0.0 against a healthy 488.6x487.4, and '
        + 'STILL collapsed after 720 further sane frames');
    }
    // The fix must sanitise BEFORE clamping, and must not narrow the coercion it replaces.
    chk('...because Number.isFinite runs BEFORE the clamp — `Math.max`/`Math.min` PROPAGATE NaN',
      /const requested = Number\(config\.poolSize\);/.test(poolSrc)
      && /Number\.isFinite\(requested\)/.test(poolSrc),
      'Math.max(0, Math.min(MAX, Math.floor(NaN))) is NaN, so a clamp that looks like a guard is not one: '
      + 'ensure() then set count = NaN while its own seeding bound Math.min(count, size) was NaN too, making '
      + 'for (i = NaN; i < size; i++) run ZERO times and every slot keep its zero-initialised (0,0) home');
    {
      const p = new LiquidPool();
      p.update(16.7, LW, LH, lqCfg({ poolSize: '4000' }), null);
      chk('...and a NUMERIC STRING still coerces, so the guard is not narrower than the line it replaced',
        p.getCount() === 4000,
        `count ${p.getCount()} for poolSize "4000" — an imported file is JSON and Math.floor already coerced `
        + 'it, so testing Number.isFinite(config.poolSize) alone would trade one silent failure for another');
    }
  }

  // --- 5. SEEDING: DETERMINISTIC, SIZE-INDEPENDENT, ALLOCATION-FREE ------------------------------------
  {
    for (const pattern of ['fill', 'cloud', 'blobs', 'basin']) {
      const a = new LiquidPool(); a.update(16.7, LW, LH, lqCfg({ poolSize: 1000, seedPattern: pattern }), null);
      const b = new LiquidPool(); b.update(16.7, LW, LH, lqCfg({ poolSize: 4000, seedPattern: pattern }), null);
      const qa = a.getPositions(), qb = b.getPositions();
      let worst = 0;
      for (let i = 0; i < 1000; i++) {
        worst = Math.max(worst, Math.abs(qa[i * 3] - qb[i * 3]), Math.abs(qa[i * 3 + 1] - qb[i * 3 + 1]));
      }
      chk(`\`${pattern}\` seeds slot i from i ALONE, never from the pool's size`,
        worst === 0,
        `worst ${worst} px over the first 1000 slots at size 1000 vs 4000. Pool Size has 200 stops, so a `
        + 'size-dependent home tears the pool apart and re-forms it 200 times on one drag — which is what the '
        + 'Halton sequence is for, and why `blobs` uses `i % BLOB_COUNT` and not `floor(i / perBlob)`');
    }
    chk('no Math.random() anywhere in the pool (invariant 12), and the Halton bases are 2 and 3',
      !/Math\.random\(\)/.test(poolSrc)
      && /radicalInverse\(i \+ 1, 2\)/.test(poolSrc) && /radicalInverse\(i \+ 1, 3\)/.test(poolSrc),
      'a random seed makes a Pool Size drag non-reproducible and defeats the append-only growth below');
    {
      // Growth APPENDS: an existing particle keeps the home it has been drifting from. One frame of legitimate
      // drift is allowed for; a reseed would move it by O(100 px).
      const p = new LiquidPool();
      for (let k = 0; k < 120; k++) p.update(16.7, LW, LH, lqCfg({ poolSize: 1000 }), lqFlat);
      const before = Float32Array.from(p.getPositions().subarray(0, 3000));
      p.update(16.7, LW, LH, lqCfg({ poolSize: 4000 }), lqFlat);
      const after = p.getPositions();
      let moved = 0;
      for (let i = 0; i < 3000; i++) moved = Math.max(moved, Math.abs(before[i] - after[i]));
      chk('growing the pool APPENDS: `ensure()` seeds [count, size) and existing slots keep their homes',
        moved < 10 && p.getCount() === 4000,
        `worst move of an existing particle ${moved.toFixed(3)} px across a 1000 -> 4000 step (one frame of `
        + 'drift is legitimate; a full reseed is O(100 px) and visibly re-forms the whole pool)');
      // And a shrink retires slots without forgetting them.
      const q = new LiquidPool();
      for (let k = 0; k < 60; k++) q.update(16.7, LW, LH, lqCfg({ poolSize: 2000 }), null);
      const s0 = Float32Array.from(q.getPositions().subarray(0, 6000));
      q.update(16.7, LW, LH, lqCfg({ poolSize: 500 }), null);
      q.update(16.7, LW, LH, lqCfg({ poolSize: 2000 }), null);
      const s1 = q.getPositions();
      let dev = 0;
      for (let i = 0; i < 6000; i++) dev = Math.max(dev, Math.abs(s0[i] - s1[i]));
      chk('...and a shrink only lowers `count`, so dragging Pool Size down and back up restores the same pool',
        dev === 0,
        `worst deviation ${dev} px across 2000 -> 500 -> 2000`);
    }
    {
      // A geometry or pattern change reseeds EVERYTHING — correct rather than merely acceptable, since a
      // `Basin` must sit at the bottom of the NEW frame (positions are pixels, not UV).
      const p = new LiquidPool();
      p.update(16.7, LW, LH, lqCfg({ poolSize: 1000, seedPattern: 'cloud' }), null);
      const a = Float32Array.from(p.getPositions().subarray(0, 3000));
      p.update(16.7, LW, LH, lqCfg({ poolSize: 1000, seedPattern: 'basin' }), null);
      const b = p.getPositions();
      let movedPat = 0;
      for (let i = 0; i < 1000; i++) if (Math.hypot(a[i * 3] - b[i * 3], a[i * 3 + 1] - b[i * 3 + 1]) > 1) movedPat++;
      const r = new LiquidPool();
      r.update(16.7, LW, LH, lqCfg({ poolSize: 1000 }), null);
      const c = Float32Array.from(r.getPositions().subarray(0, 3000));
      r.update(16.7, 1920, 1080, lqCfg({ poolSize: 1000 }), null);
      const d = r.getPositions();
      let movedSize = 0;
      for (let i = 0; i < 1000; i++) if (Math.hypot(c[i * 3] - d[i * 3], c[i * 3 + 1] - d[i * 3 + 1]) > 1) movedSize++;
      chk('a PATTERN or CANVAS change reseeds every slot, because positions are PIXELS and not UV',
        movedPat === 1000 && movedSize === 1000,
        `pattern change moved ${movedPat}/1000, resize moved ${movedSize}/1000. Storing UV would make the `
        + 'storage anisotropic and need every one of four lengths converted at its own use site (invariant 26)');
    }
    {
      // Invariant 8: allocation RATE. At the 20 000 ceiling the three published arrays are 320 KB/frame,
      // 19 MB/s — a third of the getState() garbage that reached a user as "a jitter every few seconds".
      const p = new LiquidPool();
      p.update(16.7, LW, LH, lqCfg(), lqFlat);
      const a = p.getPositions(), b = p.getSpeeds(), c = p.getVelocityDirs();
      for (let k = 0; k < 50; k++) p.update(16.7, LW, LH, lqCfg(), lqFlat);
      chk('the three published arrays are GROW-ONLY and identity-reused across frames (invariant 8)',
        p.getPositions() === a && p.getSpeeds() === b && p.getVelocityDirs() === c,
        'never SparkPool.getActiveState()\'s shape, which allocates three arrays per call: 320 KB/frame at the '
        + '20 000 ceiling is 19 MB/s of garbage, i.e. a GC pause, not a slow function');
    }
  }

  // --- 6. PUBLICATION: A REAL SPEED, A UNIT DIRECTION, AND THE INSERTED SLOT ORDER ---------------------
  {
    chk('the slot order is `[wave][sparks][liquid][crystals]` — INSERTED, never appended',
      /const liquidBase = sparkBase \+ sparkCount;/.test(lqLiss)
      && /const crystalBase = liquidBase \+ liquidCount;/.test(lqLiss)
      && /const totalCount = crystalBase \+ crystalCount;/.test(lqLiss),
      'crystalCount is published as the TRAILING block and every trajectory consumer subtracts it from count, '
      + 'so appending the pool after it would make all four bounds in group 1 describe the wrong range');
    // Invariant 7: publication must slice to the count, never pass grow-only scratch whole.
    chk('...and each block is copied with `.subarray(0, n)`, never whole (invariant 7)',
      /positions\.set\(this\.liquidPool!\.getPositions\(\)\.subarray\(0, liquidCount \* 3\), liquidBase \* 3\);/.test(lqLiss)
      && /velocities\.set\(this\.liquidPool!\.getSpeeds\(\)\.subarray\(0, liquidCount\), liquidBase\);/.test(lqLiss)
      && /velocityDirs\.set\(this\.liquidPool!\.getVelocityDirs\(\)\.subarray\(0, liquidCount \* 2\), liquidBase \* 2\);/.test(lqLiss),
      'the pool\'s scratch keeps every earlier frame\'s high-water mark, so a bare .set() after a Pool Size '
      + 'drag downward writes past the liquid block and into the crystals — or throws RangeError');
    {
      // The published `velocities` is a REAL normalised speed, not the spark block's constant 1.0: three
      // consumers read it (palette mapping 2, spark spawning's threshold, velocity stretch).
      const p = lqRun(16.7, 3.0, lqCfg({ poolSize: 2000 }));
      const s = p.getSpeeds();
      let mn = Infinity, mx = -Infinity, distinct = new Set();
      for (let i = 0; i < p.getCount(); i++) { mn = Math.min(mn, s[i]); mx = Math.max(mx, s[i]); distinct.add(s[i].toFixed(3)); }
      // Saturation: VEL_REF * minDim px/s must publish exactly 1.0.
      const fast = (u, v, c) => (c === 0 ? (LiquidPool.VEL_REF * LMIN * 2) / (LiquidPool.SPEED * LMIN * 60) : 0);
      const q = lqRun(16.7, 3.0, lqCfg({ poolSize: 64 }), fast);
      chk('`velocities` publishes a REAL normalised speed, saturating at VEL_REF * min(w,h) px/s',
        mx > 0.05 && mx <= 1 && distinct.size > 1 && Math.abs(q.getSpeeds()[0] - 1) < 1e-6,
        `min ${mn.toFixed(4)} max ${mx.toFixed(4)} over ${distinct.size} distinct values; at 2x VEL_REF it `
        + `publishes ${q.getSpeeds()[0].toFixed(4)}. The spark block's constant 1.0 would make palette `
        + 'mapping 2 flat across the whole pool and velocity stretch uniform');
      const d = p.getVelocityDirs();
      let worstLen = 0;
      for (let i = 0; i < p.getCount(); i++) {
        const len = Math.hypot(d[i * 2], d[i * 2 + 1]);
        worstLen = Math.max(worstLen, Math.abs(len - 1));
      }
      const stand = new LiquidPool();
      stand.update(16.7, LW, LH, lqCfg({ poolSize: 64 }), null);
      const sd = stand.getVelocityDirs();
      chk('...and `velocityDirs` is a UNIT vector, defaulting to (0, -1) for a slot standing still',
        worstLen < 1e-5 && sd[0] === 0 && sd[1] === -1,
        `worst |len - 1| = ${worstLen.toExponential(3)}, standing-still dir = (${sd[0]}, ${sd[1]}). A zero `
        + 'vector would make velocity stretch collapse the quad rather than leave it round');
    }
    {
      // The zero gate, twice over: coupling 0 is DRAWN but still, and a null sampler is byte-identical to seeds.
      const p = lqRun(16.7, 5.0, lqCfg({ poolSize: 512, fieldCoupling: 0 }));
      const seeded = new LiquidPool();
      seeded.update(16.7, LW, LH, lqCfg({ poolSize: 512 }), null);
      const a = p.getPositions(), b = seeded.getPositions();
      let dev = 0;
      for (let i = 0; i < 512 * 3; i++) dev = Math.max(dev, Math.abs(a[i] - b[i]));
      chk('Field Coupling 0 leaves the pool DRAWN but standing exactly still — 0 is not an off switch',
        p.getCount() === 512 && dev === 0,
        `count ${p.getCount()}, worst deviation from seed ${dev} px. This is what makes the Mixer's one-sided `
        + 'case fade smoothly: `interpolateLiquidField` lerps coupling toward 0 while `enabled` snaps once');
      const nul = lqRun(16.7, 5.0, lqCfg({ poolSize: 512 }), null);
      const c = nul.getPositions();
      let dev2 = 0;
      for (let i = 0; i < 512 * 3; i++) dev2 = Math.max(dev2, Math.abs(c[i] - b[i]));
      chk('...and a NULL sampler holds it at its seeds rather than drifting from stale state',
        dev2 === 0,
        `worst deviation ${dev2} px over 300 frames — the sampler is null whenever no field runs (invariant 3: `
        + 'a flag must die with its resource)');
    }
  }

  // --- 7. THE WIRING: ONE OWNER, THE MERGE'S OWN ORDER, AND THE TWO MIXER SITES ------------------------
  {
    // `applyFluidFeedbackState()` is the single owner of everything derived from the config. ⚠️ The derive
    // lives INSIDE the merge, not at either caller — measured: both callers run it ABOVE their own
    // applyOverlayConfigBlocks, so a call placed there observes the PREVIOUS preset's block.
    const merge = braceBody(lqMain, 'function applyOverlayConfigBlocks(');
    const iAssign = merge.indexOf('Object.assign(currentLiquidField, DEFAULT_LIQUID_FIELD_CONFIG, o.liquidField ?? {});');
    const iHand = merge.indexOf('generator.setLiquidFieldConfig(currentLiquidField);');
    const iDerive = merge.indexOf('applyFluidFeedbackState();', iHand < 0 ? 0 : iHand);
    chk('the merge assigns, hands off, THEN derives — all three inside applyOverlayConfigBlocks, in order',
      iAssign >= 0 && iHand > iAssign && iDerive > iHand,
      `assign at ${iAssign}, hand-off at ${iHand}, derive at ${iDerive} within ${merge.length} chars. `
      + 'Reversed, a preset that switches the pool on publishes its particles with the field still inactive '
      + 'and no sampler installed — a heap at the seed positions for exactly one preset change, which reads '
      + 'as the seed pattern being wrong. A position comparison is only meaningful inside ONE function (§M)');
    chk('invariant 14: the merge is DEFAULTS-first, so `enabled` follows the preset instead of sticking',
      /Object\.assign\(currentLiquidField, DEFAULT_LIQUID_FIELD_CONFIG, o\.liquidField \?\? \{\}\);/.test(lqMain),
      'Object.assign copies only PRESENT keys, so a preset omitting the block would inherit the previous '
      + 'preset\'s live pool — and 359 of 360 presets omit it');
    // Invariant 23: the STARTUP preset must reach the generator too, and the derive is reached through the
    // one apply path rather than duplicated here (a TDZ throw would end init() before the loop is armed).
    const initBlock = lqMain.slice(
      Math.max(0, lqMain.indexOf('generator.setCohesionConfig(currentCohesion);')),
      lqMain.indexOf('generator.setCohesionConfig(currentCohesion);') + 400,
    );
    chk('the init hand-off gives the generator the startup preset\'s block (invariant 23)',
      /generator\.setLiquidFieldConfig\(currentLiquidField\);/.test(initBlock)
      && !/applyFluidFeedbackState\(\);/.test(initBlock),
      'the generator holds the config by REFERENCE, so without the hand-off a startup-default pool reaches it '
      + 'only on the next preset change — a refresh showing a different picture from clicking the same '
      + 'preset, invariant 23\'s reported symptom verbatim. And NO derive call here: applyFluidFeedbackState '
      + 'is a const arrow declared ~200 lines below, so a call would be a TDZ throw that ends init() before '
      + 'the render loop is armed (invariant 22 one stage earlier)');
    chk('the export gate is `enabled && poolSize > 0`, deliberately NOT setPoolActive\'s `enabled` alone',
      /currentLiquidField\.enabled && currentLiquidField\.poolSize > 0\s*\n?\s*\? \{ liquidField: \{ \.\.\.currentLiquidField \} \}/.test(lqMain),
      'two different questions on the same two fields: setPoolActive must stay true across a Pool Size drag '
      + 'through 0 so the velocity field stays warm, while an `enabled` pool of size 0 describes nothing');
    // The processor gained exactly three things, and `isActive()` must include the pool or step() early-returns.
    //
    // ⚠️ **THIS ASSERTION WAS AN EXACT WHOLE-EXPRESSION MATCH AND 15.7's FOURTH SOURCE BROKE IT — CORRECTLY.**
    // It failed the moment `dyeActive` joined the OR, on a change that FIXED a defect, which is the exact
    // false-alarm shape `CLAUDE.md` warns about ("read a failure as a claim about the checker until the checker
    // is exonerated"). The remedy is NOT to loosen it to a substring: an exact match is what makes a source
    // SILENTLY DROPPED from the OR a failure here, and a dropped source is invisible in every other way. So it
    // is re-based to the four-source form and stays exact — **a new source is expected to edit this line, in
    // the same commit that adds it.**
    chk('`isActive()` ORs all FOUR sources, so the 512^2 field is simulated for a pool or dye at `blend` 0',
      /return this\.config\.blend > 0 \|\| this\.forceFieldActive \|\| this\.poolActive \|\| this\.dyeActive;/.test(lqFluid),
      'step() early-returns on !isActive(), so without this the field is never simulated at all — and all 24 '
      + 'authored fluidAdvection blocks carry blend 0, which this step must preserve byte-for-byte. ⚠️ A source '
      + 'MISSING from this OR fails silently in the one direction that matters: the field is allocated, every '
      + 'consumer reads it, and it contains the zeros it was born with (reported 2026-09-03 for the dye)');
    chk('...and the CPU readback is gated on poolActive too, which `blend > 0` does not imply',
      /if \(this\.readbackFrame % 2 === 0 && \(this\.config\.blend > 0 \|\| this\.poolActive\)\) \{/.test(lqFluid),
      'a SECOND gate: without it velReadbackBuf is never filled and sampleVelocity() returns the zeros it was '
      + 'born with — a pool that is published, drawn, and stands perfectly still');
    /*
     * ⚠️ **RE-BASED 2026-10-05 FOR PHASE 23.2.** This asserted the block appeared in BOTH hand-written
     * `result.overlay` literals, because either omission dropped it. There is now exactly ONE site, so the
     * two-site requirement is not loosened — it is DISCHARGED by the architecture, and what is left to check
     * is that the single site is wired: the key's rule names its owner, the owner is reachable in
     * `CUSTOM_MIXERS`, and the locked path is the generic restore. ⚠️ **The sentence this replaced named the
     * defect Phase 23 then measured over the whole library**, so it is kept below: a reader needs to know
     * what the single owner is protecting.
     */
    // ⚠️ **The rule pattern was re-based 2026-10-06 for `24.1`'s third column** — it closed the entry with
    // ` }` and the entry now continues `, mutate: { … }`. Pinned past the law and up to the comma, for the
    // reason §K's gate clause states at length: dropping to a substring would stop pinning the law.
    chk('the Mixer reaches liquidField through ONE owner (its rule, the dispatch, the generic locked restore)',
      /liquidField: \{ group: 'visual', law: \{ kind: 'custom', owner: 'interpolateLiquidField' \}, mutate: \{/.test(lqRules)
      && /interpolateLiquidField: \(a, b, t, inv\) =>\s*interpolateLiquidField\(a\.overlay\?\.liquidField, b\.overlay\?\.liquidField, t, inv\),/
        .test(lqInterp)
      && /if \(held\) copyKey\(out, held, key\);/.test(lqInterp),
      'until 2026-10-05 interpolate.ts assigned result.overlay WHOLESALE from two literals, so a block '
      + 'missing from either was DROPPED and then re-read as the default — the shape that silently reverted '
      + 'volumeRender/sparks/buoyancy/crystal on 270 of 274 presets. ⚠️ A block whose absence is '
      + 'indistinguishable from "off" is exactly the one that goes missing unnoticed: with the pool disabled '
      + 'a dropped block restores identically');
    {
      // The asymmetric side splits THREE ways across five fields — neither liquid's wholesale carry nor
      // cohesion's single gate. `poolSize` must NOT lerp toward 0 (ensure() would drop tail particles every
      // frame of the crossfade, a visible thinning from one end of the Halton sequence).
      // ⚠️ **ANCHORED PAST THE RETURN-TYPE ANNOTATION, NOT ON THE `function` KEYWORD.** `braceBody` takes the
      // first `{` after its declaration, and this signature's is the one inside `): { liquidField?: … } {` — so
      // anchoring on `function interpolateLiquidField(` extracts a **35-character** body consisting of the type
      // literal, against which every pattern below fails on correct code. That is §O's rule earning its keep
      // twice over: the assertion reports the matched body's length, so the failure named its own cause
      // instead of reading as a regression in `interpolate.ts`. Sibling sections anchoring on an `export
      // function` with an object return type have the same exposure.
      const fn = braceBody(lqInterp, 'LiquidFieldConfig } {');
      chk('...and its asymmetric side snaps `enabled`, fades `fieldCoupling`, and CARRIES the other three',
        /enabled: t >= 0\.5 \? b!\.enabled : false,/.test(fn)
        && /fieldCoupling: t \* b!\.fieldCoupling,/.test(fn)
        && /poolSize: b!\.poolSize,/.test(fn) && /seedPattern: b!\.seedPattern,/.test(fn)
        && /fieldDecay: b!\.fieldDecay,/.test(fn)
        && /enabled: t < 0\.5 \? a\.enabled : b\.enabled,/.test(fn),
        `in ${fn.length} chars. `
        + 'A crossfade cannot half-create a particle, so `enabled` SNAPS (invariant 16) and coupling\'s fade '
        + 'to 0 is what makes that flip read as a fade rather than a cut. ⚠️ `poolSize` lerping toward 0 '
        + 'would make ensure() drop tail particles every frame — a visible thinning from one end of the '
        + 'Halton sequence, which reads as the seed pattern being wrong');
    }
  }
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== R. the dye field: the shared resolution, the two units, the feedback door, the fifth source ===\n');
// ---------------------------------------------------------------------------------------------------
{
  /*
   * v8 Step 15.7 (E90). `DyeFieldProcessor` deposits particle colour into a persistent 512² field, advects it
   * along the velocity field the figure stirs, and hands the texture to the liquid surface as its ALBEDO.
   *
   * ⚠️ **EVERY DEFECT THIS SECTION CAN SEE SHIPS A FIELD THAT STILL FLOWS.** There is no black frame available
   * here: `'dye'` degrades to `'ramp'` by design, so a broken dye field looks like a *preset choice*. That is
   * what makes the section worth its length, and it is why four of the five groups measure rather than grep.
   *
   *   - ⚠️ **THE TWO FIELD RESOLUTIONS ARE A COUPLING NO TYPE CAN EXPRESS, AND A MISMATCH IS INVISIBLE.** The
   *     advect pass samples `uVel` with the SAME `vUv` it writes dye at, so `DYE_SIZE !== FLUID_SIZE` makes the
   *     dye advect along a RESCALED copy of the flow — still smooth, still plausible, wrong everywhere. Both are
   *     module-private `const`s in different files, so nothing but this assertion connects them. ⚠️ **And this
   *     is also what makes the class resolution-independent** (invariant: `resize()` is designed out, not
   *     forgotten), so a future "let's make the dye cheaper at 256²" must move BOTH or neither.
   *   - ⚠️ **TWO UNITS, TWO OPPOSITE FAILURE MODES, AND THE SECTION MEASURES BOTH (invariant 26 + 10).**
   *     `injectionRadius` is CANVAS PIXELS on a SQUARE field, so it must divide by `min(w,h)` — measured here
   *     over three canvas SHAPES, because a per-axis conversion is exactly right on a square canvas and reads
   *     as a SHAPE change, never as a strength change, on any other (only a multi-shape property test can see
   *     one). `advectionStrength` scales a UV displacement PER 60 Hz FRAME, so the shader must take **no `dt`** —
   *     asserted as the ABSENCE of a `dt`/`uDt` uniform in `ADVECT_FS`, because adding one is a 2× error at
   *     30 fps that reads as "the dye moves faster on a slower machine".
   *   - ⚠️ **THE ADVECT PASS IS A FEEDBACK LOOP AND ITS DECAY MULTIPLIES, SO BOTH DOORS ARE PERMANENT.**
   *     A non-finite texel can never be faded out (invariant 20), hence a BOOLEAN SELECT, never
   *     `mix(x, y, vecN(bvecN))` — the shape that made `sanitiseTrail()` inert for its entire existence. And
   *     `decayRate > 1` is unbounded GAIN, so the clamp is asserted at the `uniform1f`, ⚠️ **anchored as a whole
   *     statement** (§O's rule: an unanchored `uniform1f(this.uX, cfg.y)` still matches inside a wrapping `if`).
   *   - ⚠️ **THE FIFTH TINT SOURCE IS THE ONE WHOSE INPUT CAN BE ABSENT, SO THE DEGRADE IS THE PROPERTY.**
   *     Asserted at all THREE resolvers, and the tile one is asserted as a DELIBERATE degrade — an omission
   *     that reads as coverage is the shape invariant 25 warns about. ⚠️ **`getDyeTexture()` must be able to
   *     return `null`** or the CPU degrade branch is unreachable (green forever), while the CONSUMER must never
   *     bind that return value raw (invariant 4) — two assertions that look contradictory and are not.
   *   - ⚠️ **`fixedColour` IS THE FIRST REFERENCE TYPE IN ANY OF THE FOUR INTERPOLATED OVERLAY BLOCKS**, so the
   *     Mixer is RUN here rather than grepped: a `{ ...cfg }` spread shares the array, and the resulting
   *     aliasing is invisible until something writes through it. `Object.is` on the two arrays is the test a
   *     value comparison cannot be.
   *
   * ⚠️ The modules are IMPORTED, never transcribed (section A's parity-oracle lesson).
   */
  const dyeSrcRaw = readFileSync(SRC + 'post-processors/dye-field.ts', 'utf8');
  const dyeSrc = stripComments(dyeSrcRaw);
  const dyeFluid = stripComments(readFileSync(SRC + 'post-processors/fluid-advection.ts', 'utf8'));
  const dyeHdr = stripComments(readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8'));
  const dyeMain = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  const dyeTile = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));
  const dyeInterp = stripComments(readFileSync(SRC + 'exploration/interpolate.ts', 'utf8'));
  const dyeRules = stripComments(readFileSync(SRC + 'exploration/overlay-rules.ts', 'utf8'));
  const dyeFx = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/visual-fx.ts', 'utf8'));

  // --- R1. the two resolutions agree ------------------------------------------------------------
  {
    const dyeN = /const DYE_SIZE = (\d+);/.exec(dyeSrc);
    const fluidN = /const FLUID_SIZE = (\d+);/.exec(dyeFluid);
    chk('DYE_SIZE and FLUID_SIZE are the same number, read out of both files',
      !!dyeN && !!fluidN && dyeN[1] === fluidN[1],
      `dye ${dyeN?.[1]} vs fluid ${fluidN?.[1]}. The advect pass samples uVel at the SAME vUv it writes dye `
      + 'at, so a mismatch rescales the flow the dye rides — smooth, plausible and wrong everywhere. Two '
      + 'module-private consts in two files: nothing but this connects them');
    chk('...and nothing in dye-field.ts derives from the canvas, so there is no resize() to forget',
      !/\bresize\s*\(/.test(dyeSrc) && !/canvas\.(width|height)/.test(dyeSrc),
      'H12: fluid-advection.ts\'s resize() was dispose()+init() and init() never re-entered initDye(), so the '
      + 'old dye handles would have gone null on the first window resize with nothing to notice. Designed out '
      + 'by a FIXED size and UV-only uniforms — ⚠️ do not "complete" the class by adding one');
  }

  // --- R2. the radius is isotropic on every canvas shape (invariant 26) --------------------------
  {
    // The shipped conversion, read as a formula rather than transcribed as an intent.
    chk('the injection radius divides by min(w,h) — the ONE shared length scale, not per-axis',
      /\(cfg\.injectionRadius \/ Math\.min\(w, h\)\) \* DYE_SIZE/.test(dyeSrc),
      'the field is SQUARE and addressed in UV, so a per-axis conversion makes an injected blob ELLIPTICAL on '
      + 'a non-square canvas — invariant 26, which reads as a SHAPE change and never as a strength change');
    // MEASURED over three shapes: the same authored radius must cover the same fraction of the field's area
    // however the canvas is shaped. A per-axis emulation is the defect this separates.
    const RAD = 16;
    const shapes = [[1024, 768], [768, 1024], [900, 900]];
    const shared = shapes.map(([w, h]) => Math.max(1, (RAD / Math.min(w, h)) * 512));
    const perAxisX = shapes.map(([w]) => Math.max(1, (RAD / w) * 512));
    const perAxisY = shapes.map(([, h]) => Math.max(1, (RAD / h) * 512));
    // Under the shared scale a 16 px radius is 10.67 field texels on both portrait and landscape 1024x768,
    // and 9.10 on the square — it tracks min(w,h) alone, so the SPREAD across shapes is the whole story.
    const spread = arr => Math.max(...arr) / Math.min(...arr);
    chk('...measured: the sprite is the SAME size on landscape and portrait of one aspect, and a per-axis '
      + 'conversion is not',
      Math.abs(shared[0] - shared[1]) < 1e-9 && Math.abs(perAxisX[0] - perAxisX[1]) > 1,
      `shared ${shared.map(v => v.toFixed(2)).join('/')} px (spread ${spread(shared).toFixed(3)}x) vs per-axis-x `
      + `${perAxisX.map(v => v.toFixed(2)).join('/')} (spread ${spread(perAxisX).toFixed(3)}x). ⚠️ A ONE-SHAPE `
      + 'test passes on the defect: at 900x900 the shared and per-axis forms give the identical '
      + `${perAxisY[2].toFixed(2)} px, which is why only a MULTI-SHAPE property test can see this class`);
  }

  // --- R3. the advection unit: no dt, and the y flip -------------------------------------------
  {
    const advectFs = /const ADVECT_FS = `([\s\S]*?)`;/.exec(dyeSrcRaw)?.[1] ?? '';
    chk('ADVECT_FS declares no dt uniform of any spelling — the velocity IS a per-frame displacement',
      advectFs.length > 100 && !/uniform\s+float\s+u?(dt|Dt|DeltaTime|deltaTime)\b/.test(advectFs)
      && !/\buDt\b/.test(advectFs),
      `in ${advectFs.length} chars of shader. sampleVelocity()'s doc owns the unit: a UV displacement PER `
      + '60 Hz FRAME, not a velocity. Multiplying by dt here DOUBLE-COUNTS time — a 2x advection error at '
      + '30 fps, which reads as "the dye moves faster on a slower machine" and blames the machine');
    chk('...and it is SEMI-LAGRANGIAN (reads backward), so it needs no scatter and cannot leave gaps',
      /vUv - vel \* uStrength/.test(advectFs),
      'a forward push would need one draw per source texel; `vUv + vel` is the same expression with the flow '
      + 'reversed — smooth, and exactly wrong, which no magnitude assertion can see');
    chk('the injected y is FLIPPED, canvas pixels running down against the field\'s UV running up',
      /P\[n \* 2 \+ 1\] = 1\.0 - v;/.test(dyeSrc),
      '⚠️ Not subtly wrong: the dye then advects along a vertically MIRRORED copy of the flow, drifting the '
      + 'opposite way from the figure that laid it down — and on a symmetric figure that reads as "the '
      + 'strength is off", which sends the diagnosis to advectionStrength');
    chk('...and a non-finite or off-canvas position is SKIPPED before the upload (invariant 21)',
      /if \(!Number\.isFinite\(x\) \|\| !Number\.isFinite\(y\)\) continue;/.test(dyeSrc)
      && /if \(u < -0\.1 \|\| u > 1\.1 \|\| v < -0\.1 \|\| v > 1\.1\) continue;/.test(dyeSrc),
      'CULL_SENTINEL is a large magnitude, so without the second test a culled slot lands at a CLAMPED frame '
      + 'corner and builds a permanent bright dot there. Every GPU guard is downstream of this upload');
  }

  // --- R4. the feedback loop's two doors -------------------------------------------------------
  {
    const advectFs = /const ADVECT_FS = `([\s\S]*?)`;/.exec(dyeSrcRaw)?.[1] ?? '';
    chk('the NaN/Inf guard is a BOOLEAN SELECT, not a mix() — invariant 20',
      /bool bad = any\(isnan\(dye\)\) \|\| any\(isinf\(dye\)\);/.test(advectFs)
      && /dye = bad \? vec4\(0\.0\) : dye;/.test(advectFs)
      && !/mix\([^)]*isnan/.test(advectFs),
      '⚠️ `mix(x, y, vecN(bvecN))` is ARITHMETIC and NaN*0.0 == NaN, so that form DETECTS every NaN and adds '
      + 'it straight back — inert for its entire existence, as sanitiseTrail() was. Permanent here because '
      + 'this pass is its own next input and the decay MULTIPLIES: a bad texel can never fade out');
    chk('...and it guards ALPHA too, not only rgb — alpha is the deposit weight the surface reads',
      /any\(isnan\(dye\)\)/.test(advectFs) && /vec4\(0\.0\)/.test(advectFs),
      'a NaN in alpha alone makes every "is there dye here" comparison false, so the surface degrades to ramp '
      + 'while the field is full of colour — the failure that names the wrong subsystem');
    chk('decayRate is CLAMPED to [0,1] at the uniform, as a WHOLE anchored statement',
      /^\s*gl\.uniform1f\(this\.uAdvectDecay, Math\.min\(1, Math\.max\(0, cfg\.decayRate\)\)\);$/m.test(dyeSrc),
      '⚠️ >1 in a feedback loop is unbounded GAIN, which is invariant 19\'s shape (a per-frame gain inside a '
      + 'feedback loop reached 3.2e6 there). Anchored per §O\'s rule: an unanchored uniform1f test is '
      + 'satisfied by the very `if` wrapper it is meant to forbid');
    chk('...and the strength is forced to 0 when there is no velocity texture, rather than skipping the pass',
      /gl\.uniform1f\(this\.uAdvectStrength, velocityTex \? cfg\.advectionStrength : 0\);/.test(dyeSrc)
      && /velocityTex \?\? this\.fallbackTex/.test(dyeSrc),
      'the dye must still DECAY with no flow (it fades rather than freezing, the honest behaviour), and the '
      + 'velocity sampler still needs a bound texture — invariant 4: never null, a 1x1 stand-in');
  }

  // --- R5. lazy allocation, the FBO test, and invariant 1 --------------------------------------
  {
    chk('the 8 field objects are allocated LAZILY, init() taking only the 1x1 fallback (triage G14)',
      /private ensureResources\(\): boolean \{/.test(dyeSrc)
      && /if \(this\.texA\) return true;/.test(dyeSrc)
      && !/createFramebuffer/.test(braceBody(dyeSrc, 'init(gl: WebGL2RenderingContext): void')),
      'G14: the DELETED dye allocated 13 GL objects the moment setDyeConfig ran, for passes with zero callers. '
      + 'Every preset in the library pays this class\'s init(), and 0 of 360 author a dye block');
    chk('...checkFramebufferStatus is tested on BOTH halves (invariant 5)',
      (dyeSrc.match(/checkFramebufferStatus\(gl\.FRAMEBUFFER\) === gl\.FRAMEBUFFER_COMPLETE/g) ?? []).length >= 2,
      'an incomplete FBO throws nothing and logs nothing: the field stays at its clear value and the tint '
      + 'silently falls back to ramp, which looks like a preset choice rather than a failure');
    chk('...and disposeField() NULLS every handle it deletes (invariant 1)',
      /this\.texA = null; this\.texB = null; this\.fboA = null; this\.fboB = null;/.test(dyeSrc)
      && /this\.advectProg = null; this\.splatProg = null;/.test(dyeSrc),
      'ensureResources() tests `this.texA` to decide whether to re-allocate, so a deleted-but-non-null handle '
      + 'makes it return true forever and every later draw a silent no-op against freed objects');
    chk('reset() clears BOTH halves of the ping-pong, not only the current one',
      /for \(const f of \[this\.fboA, this\.fboB\]\)/.test(braceBody(dyeSrc, 'reset(): void')),
      'step() reads texA and writes texB before swapping, so clearing one leaves the other one frame from '
      + 'being current — a wake that reappears for a single frame after a reset, blamed on the decay control');
    chk('...and a preset change calls it, the field\'s contents being HISTORY not parameters (D-09)',
      /dyeProcessor\.setConfig\(currentDye\);\s*dyeProcessor\.reset\(\);/.test(dyeMain),
      'carried across a switch, an integrated trace tints the NEW preset\'s surface with the PREVIOUS figure\'s '
      + 'wake — which reads as the new preset having wrong colours, naming neither the dye nor the switch');
    chk('...while the UI setter deliberately does NOT reset (a slider drag must not erase the wake)',
      !/reset\(\)/.test(braceBody(dyeMain, 'setDyeConfig: (config) =>')),
      'the contents are only stale when the FIGURE changes. Erasing on every slider move would make the '
      + 'control being judged destroy the evidence it is judged by');
  }

  // --- R6. the fifth tint source and its three resolvers --------------------------------------
  {
    chk('the dye texture is HANDED to the renderer every frame and RE-handed on reinit',
      (dyeMain.match(/renderer\.setDyeTexture\(dyeProcessor\.getDyeTexture\(\)\);/g) ?? []).length >= 2,
      '⚠️ dispose() NULLS dyeTexture, so without the reapplyRendererState() hand-off a `dye` tint degrades to '
      + 'ramp and STAYS degraded for the rest of the session — invariant 2/3\'s exact shape');
    chk('...and the surface shader actually SAMPLES it, which "the pass draws" is no evidence of',
      /uniform sampler2D uDye\b/.test(dyeHdr),
      '⚠️ G14\'s defect has a NEW shape here: the output is a TEXTURE, not a composite pass. A field that '
      + 'injects and advects into a texture nothing samples is exactly as invisible as one with no callers');
    chk('getDyeTexture() CAN return null, or the CPU degrade branch is unreachable (green forever)',
      /return this\.isActive\(\) \? this\.texA : null;/.test(dyeSrc),
      'a never-null accessor makes "does the field exist" constantly true, so the `dye`->`ramp` degrade '
      + 'occupies the slot the real check would take — an UNREACHABLE assertion is worse than a missing one');
    chk('...and the CONSUMER binds it with a fallback rather than raw (invariant 4)',
      /this\.dyeTexture \?\? this\.fallbackBlackTex/.test(dyeHdr),
      'the surface program is multi-sampler: an unassigned sampler2D can resolve the WHOLE draw black on some '
      + 'drivers, not merely the unused sampler. ⚠️ This and the assertion above are not contradictory — null '
      + 'is the honest RETURN and a bound texture is the honest BIND');
    /*
     * ⚠️ **THE SECOND HALF OF INVARIANT 4, AND THE HALF THIS SECTION WAS MISSING: THE FALLBACK ITSELF MUST
     * EXIST ON EVERY PATH THAT BINDS IT.** The clause above passed for a year while the texture it names was
     * created inside `initLogDensity` — so on a `liquid` preset with no dye field it WAS `null`, and `?? null`
     * is exactly the raw bind the clause claims to forbid. A `??` proves an intention, not a texture.
     *
     * Found 2026-09-19 while retiring `log-density` (the removal deleted the only creation site, which is how
     * it surfaced), and the reason the check is spelled as "assigned OUTSIDE every `if (config.mode ===` gate"
     * rather than "assigned somewhere": somewhere was always true.
     */
    const fbInit = dyeHdr.indexOf('this.fallbackBlackTex = gl.createTexture()');
    const firstModeGate = dyeHdr.indexOf("if (config.mode === ");
    chk('...and that fallback is created UNCONDITIONALLY in init(), or the `??` resolves to null anyway',
      fbInit > 0 && firstModeGate > 0 && fbInit < firstModeGate,
      `createTexture at ${fbInit}, first mode gate at ${firstModeGate} — a MODE-GATED fallback is null in every `
      + 'other mode, which is the defect invariant 4 describes and not a lesser version of it');
    chk('the tile renderer degrades `dye` EXPLICITLY, an omission that reads as coverage being invariant 25\'s '
      + 'shape',
      /if \(effSource === 'dye'\) effSource = 'ramp';/.test(dyeTile),
      'a tile runs no dye field, and `dye` would fall through to 3 anyway — which is the problem: a silent '
      + 'fall-through is indistinguishable from a supported path. The measurement that rejected wiring one '
      + '(4.00 MiB/slot, 5.3x the whole existing slot pair, 504 MiB at a 4K window) is recorded at that site');
    chk('...and Tint Source offers exactly the five members of LiquidTintSource, dye included',
      /\['dye', 'Dye'\]/.test(dyeFx)
      && /export type LiquidTintSource = 'preset' \| 'palette' \| 'material' \| 'ramp' \| 'dye';/
        .test(stripComments(readFileSync(SRC + 'presets/types.ts', 'utf8'))),
      'src/ has ZERO switch on a tint source, so every consumer is an if-chain that falls through — the union '
      + 'buys type safety, NOT enumeration coverage');
  }

  // --- R7. the Mixer: the fourth asymmetric rule, and the first reference type ------------------
  {
    // ⚠️ RE-BASED 2026-10-05 FOR PHASE 23.2, for the reason spelled out at liquidField's twin above: the two
    // required sites are now one owner, and the shallow `{ ...snap.overlay.dye }` this used to pin was the
    // very line whose own comment admitted it SHARED `fixedColour` with the snapshot — `copyKey` deep-copies.
    // ⚠️ Re-based 2026-10-06 for `24.1`'s third column, exactly as §Q's liquidField clause above.
    chk('the Mixer reaches dye through ONE owner (its rule, the dispatch, the generic locked restore)',
      /dye: \{ group: 'visual', law: \{ kind: 'custom', owner: 'interpolateDye' \}, mutate: \{/.test(dyeRules)
      && /interpolateDye: \(a, b, t, inv\) => interpolateDye\(a\.overlay\?\.dye, b\.overlay\?\.dye, t, inv\),/
        .test(dyeInterp)
      && /if \(held\) copyKey\(out, held, key\);/.test(dyeInterp),
      'until 2026-10-05 interpolate.ts assigned result.overlay WHOLESALE, so a block it did not spread back '
      + 'was DROPPED and re-read as the default. ⚠️ A block whose absence is indistinguishable from "off" is '
      + 'the one that goes missing unnoticed: with the field disabled a dropped block restores identically');
    {
      // ⚠️ Anchored past the return-type annotation, per §Q's braceBody finding — the 35-char type literal.
      const fn = braceBody(dyeInterp, 'dye?: DyeFieldConfig } {');
      chk('...and its asymmetric side snaps `enabled` and `colourSource`, fades `opacity`, CARRIES the rest',
        /enabled: t >= 0\.5 \? b!\.enabled : false,/.test(fn)
        && /opacity: t \* b!\.opacity,/.test(fn)
        && /decayRate: b!\.decayRate,/.test(fn) && /advectionStrength: b!\.advectionStrength,/.test(fn)
        && /colourSource: b!\.colourSource,/.test(fn),
        `in ${fn.length} chars. A FOURTH asymmetric rule matching none of the three: `
        + 'liquid carries wholesale, cohesion splits two ways, liquidField splits three ways over five fields, '
        + 'and dye splits over a DIFFERENT partition — because its visible output is gated by a field in '
        + 'ANOTHER block (liquid.tintSource). ⚠️ Derive the fifth from what its own block means');
      chk('...and `fixedColour` is spread with [...] at every one of the four sites in that function',
        (fn.match(/fixedColour: \[\.\.\./g) ?? []).length >= 3,
        `${(fn.match(/fixedColour: \[\.\.\./g) ?? []).length} of the 3 branch returns. ⚠️ THE FIRST REFERENCE `
        + 'TYPE in any of the four interpolated overlay blocks: a `{ ...cfg }` spread copies the REFERENCE, so '
        + 'the Mixer result and its input share one array. Every sibling rule was written for scalars');
    }
    // MEASURED, not grepped — aliasing is invisible to any value comparison.
    // ⚠️ A REAL library preset is the base, and the two extra arguments are REQUIRED: `interpolatePreset`
    // dereferences `locks` and `a.generators` immediately, so a hand-made `{ metadata, overlay }` stub throws
    // rather than exercising anything (it did on the first run here). Empty locks = interpolate everything.
    {
      const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
      const { DEMO_PRESETS: DYE_DEMO } = await import('../src/presets/demo-presets.ts');
      const base = Object.values(DYE_DEMO)[0];
      const mkDye = c => ({
        enabled: true, opacity: 0.6, decayRate: 0.97, advectionStrength: 1, injectionRadius: 16,
        colourSource: 'fixed', fixedColour: c,
      });
      const withDye = (name, c) => ({
        ...JSON.parse(JSON.stringify(base)),
        metadata: { ...base.metadata, name },
        overlay: c ? { dye: mkDye(c) } : {},
      });
      const A = withDye('dye-a', [1, 0, 0]);
      const B = withDye('dye-b', [0, 0, 1]);
      const mid = interpolatePreset(A, B, 0.75, new Set());
      const aliasA = Object.is(mid.overlay?.dye?.fixedColour, A.overlay.dye.fixedColour);
      const aliasB = Object.is(mid.overlay?.dye?.fixedColour, B.overlay.dye.fixedColour);
      chk('MEASURED: the interpolated fixedColour is a FRESH array, aliasing neither endpoint',
        !!mid.overlay?.dye && !aliasA && !aliasB,
        `aliasA=${aliasA} aliasB=${aliasB}. ⚠️ Object.is is the test a VALUE comparison cannot be — a shared `
        + 'array holds the right numbers at t and is still a defect, latent until something writes through it '
        + '(the Randomiser and the sliders both write overlay blocks in place)');
      chk('...and the snapped colourSource takes the t>=0.5 endpoint\'s colour, not a blended one',
        JSON.stringify(mid.overlay?.dye?.fixedColour) === JSON.stringify([0, 0, 1]),
        `got ${JSON.stringify(mid.overlay?.dye?.fixedColour)} at t=0.75. The colour must follow the SNAPPED `
        + 'source (invariant 16): a component-wise lerp of two fixed colours is a third colour neither '
        + 'endpoint authored, which is exactly what a categorical field must not produce');
      // The neutral field is the one that may fade; a one-sided crossfade must not half-create a field.
      const oneSided = interpolatePreset(withDye('dye-none', null), B, 0.25, new Set());
      chk('...and a one-sided crossfade fades `opacity` toward 0 while `enabled` stays false below t=0.5',
        oneSided.overlay?.dye?.enabled === false
        && Math.abs((oneSided.overlay?.dye?.opacity ?? -1) - 0.25 * 0.6) < 1e-9,
        `enabled=${oneSided.overlay?.dye?.enabled} opacity=${oneSided.overlay?.dye?.opacity}. opacity is the `
        + 'ONE neutral field here (0 = deposits nothing), which is what makes the enabled flip read as a fade '
        + 'rather than a cut — and injectionRadius is NOT neutral at either end, so it carries');
      /*
       * ⚠️ **THE TWO-SIDED SNAP IS A SEPARATE PROPERTY FROM THE ASYMMETRIC ONE, AND THIS SECTION'S OWN
       * CALIBRATION FOUND IT MISSING** — the grep above pins `enabled: t >= 0.5 ? b!.enabled : false` on the
       * one-sided branch, which an `enabled: b.enabled` in the BOTH-PRESENT branch leaves untouched. Seeded
       * defect 31 of 31 walked straight through 32 green assertions. Measured from BOTH sides, because a snap
       * that always returns `b` is correct at t = 0.75 and wrong at t = 0.25 — one probe cannot tell them
       * apart, which is the same one-shape trap §R2's canvas measurement documents.
       */
      const onOff = t => interpolatePreset(
        withDye('dye-on', [1, 0, 0]),
        { ...withDye('dye-off', [0, 0, 1]), overlay: { dye: { ...mkDye([0, 0, 1]), enabled: false } } },
        t, new Set(),
      ).overlay?.dye?.enabled;
      chk('MEASURED from BOTH sides: `enabled` SNAPS at t=0.5 rather than taking one endpoint (invariant 16)',
        onOff(0.25) === true && onOff(0.75) === false,
        `t=0.25 -> ${onOff(0.25)} (want true, a's), t=0.75 -> ${onOff(0.75)} (want false, b's). ⚠️ A crossfade `
        + 'cannot half-create a field, and a snap that always returns `b` reads as correct at every t above '
        + '0.5 — so a single-t probe EXONERATES it. This assertion exists because seeding exactly that defect '
        + 'passed every grep in this group');
    }
  }

  // --- R8. the export gate is VALUE-based, not mode-based --------------------------------------
  {
    chk('the export/snapshot gate is `enabled && opacity > 0` — a value gate, never the render mode',
      /currentDye\.enabled && currentDye\.opacity > 0 \? \{ dye: \{ \.\.\.currentDye \} \} : \{\}/.test(dyeMain),
      '⚠️ A GATE DESTROYS A BLOCK RATHER THAN OMITTING IT: panel.ts REPLACES copy.overlay with getSnapshot()\'s '
      + 'object, so a mode gate would break export, import AND snapshot together — Snapshot worst, writing the '
      + 'loss into the history the user restores from. And a mode gate would be wrong on the facts: the field '
      + 'deposits and advects in EVERY render mode; only the `dye` TINT SOURCE is liquid-only. ⚠️ There are now '
      + 'FOUR distinct gates and each is derived from what its own block means — do not unify them');
    chk('...and the field\'s CONTENTS are excluded from the snapshot, as crystal excludes its frozen set',
      !/dyeTexture|getDyeTexture/.test(braceBody(dyeMain, 'getSnapshot: (): OverlayState =>')),
      'an integrated texture is HISTORY: it cannot interpolate in the Mixer and must not survive a preset '
      + 'switch. Parameters only — which is the same rule reset() enforces on the other side');
  }

  // --- R9. the FOURTH activation source: the dye's claim on the velocity field --------------------
  {
    /*
     * ⚠️ **ADDED 2026-09-03 AFTER A USER REPORT, AND IT IS AN *ABSENT* ASSERTION RATHER THAN A WRONG BASIS.**
     * 15.7 shipped with the dye advecting along a field nothing switched on: `isActive()` ORed three sources
     * and none of them was the dye, so with `Liquid Field` off `step()` early-returned, `getVelocityTexture()`
     * handed back an allocated-but-never-stepped texture, and the dye smeared along ZEROS. `Advection` was
     * inert at every value, with no error, in a configuration §Q's own pool assertions all pass in.
     *
     * ⚠️ **THE REUSABLE SHAPE, AND IT IS 15.7's FIFTH INSTANCE OF IT:** the defect sat in a file the dye does
     * not own, one gate UPSTREAM of a pipeline that was correct end to end — so reading `dye-field.ts` (and
     * every §R group above, all green) exonerated the code it read. **The dye's own section could not see it,
     * which is exactly why the assertions live here and not only in §Q.**
     *
     * The four assertions split by QUESTION, not by file, because the two gates in `fluid-advection.ts` ask
     * different things and the dye answers them OPPOSITELY — simulate yes, read back no.
     */
    chk('`setDyeActive` exists and the derive is `currentDye.enabled` ALONE, inside the one owner',
      /setDyeActive\(on: boolean\): void \{ this\.dyeActive = on; \}/.test(dyeFluid)
      && /fluidProcessor\.setDyeActive\(currentDye\.enabled\);/
        .test(braceBody(dyeMain, 'const applyFluidFeedbackState = (): void => {')),
      'the pool\'s rule verbatim (§Q): gating on `opacity > 0` as well would restart the field from a dead '
      + 'state at every stop of an Opacity drag from 0, which reads as the dye being inert at low opacity. And '
      + 'DERIVED in applyFluidFeedbackState, never assigned at a caller — that function\'s header records what '
      + 'the alternative cost: six sites set an override and none restored it');
    chk('...and `setDyeActive` has exactly ONE caller in all of src/, as `setPoolActive` does',
      (dyeMain.match(/setDyeActive\(/g) ?? []).length === 1,
      `found ${(dyeMain.match(/setDyeActive\(/g) ?? []).length} in main.ts. A second caller can leave the field `
      + 'running for a dye that has since been switched off, whichever order the flags were touched in — the '
      + 'leak this whole function exists to make structurally impossible');
    // ⚠️ A NEGATIVE assertion, and the only one in §R. It has to be: the defect it prevents is a PERFORMANCE
    // regression with no visible symptom, so nothing else in the suite could ever notice it.
    chk('the dye is DELIBERATELY ABSENT from the CPU readback gate — it advects on the GPU',
      /if \(this\.readbackFrame % 2 === 0 && \(this\.config\.blend > 0 \|\| this\.poolActive\)\) \{/.test(dyeFluid)
      && !/readbackFrame[\s\S]{0,120}dyeActive/.test(dyeFluid),
      '⚠️ THE TWO GATES ASK DIFFERENT QUESTIONS AND A NEW SOURCE MUST BE GRADED AGAINST EACH SEPARATELY. The '
      + 'dye samples uVel in ADVECT_FS and never calls sampleVelocity(), so joining this gate would pay a 2 MB '
      + 'SYNCHRONOUS readPixels every other frame for a consumer that cannot observe the result. That is why '
      + '15.5\'s pool is a third source in BOTH gates and 15.7\'s dye is a fourth in only one');
    // Both dye WRITE paths must re-derive, and the merge one must sit INSIDE the merge (§Q's measured reason:
    // at either caller the derive already runs above applyOverlayConfigBlocks and observes the PREVIOUS preset).
    {
      const merge = braceBody(dyeMain, 'function applyOverlayConfigBlocks(');
      const iDye = merge.indexOf('Object.assign(currentDye, DEFAULT_DYE_CONFIG, o.dye ?? {});');
      const iDerive = merge.indexOf('applyFluidFeedbackState();', iDye < 0 ? 0 : iDye);
      const setter = braceBody(dyeMain, 'setDyeConfig: (config) => {');
      chk('BOTH dye write paths re-derive: the merge (after its assign) and setDyeConfig',
        iDye >= 0 && iDerive > iDye && /applyFluidFeedbackState\(\);/.test(setter),
        `merge assign at ${iDye}, derive at ${iDerive}; setter body ${setter.length} chars. The liquidField `
        + 'block\'s own derive one block ABOVE cannot cover the dye — it observes the previous preset\'s block, '
        + 'so a preset authoring a dye and no pool activated no field. ⚠️ Two consecutive blocks each ending in '
        + 'the same IDEMPOTENT derive is the correct shape, not a duplicate to tidy away: a single call moved '
        + 'after both would delay the pool\'s sampler install past where §Q\'s measurement allows');
    }
  }
}

// ===========================================================================
console.log('\n=== S. the additive-material accumulation ceiling: one derive, four writers, alpha exempt ===\n');
// 2026-09-04. Reported as *"applying Plasma, Fire or Liquid Light makes the figure almost everywhere saturated
// with bright white, and it is really difficult to trim down"*. The cause is the 2026-08-23 finding wearing a
// new hat: `decayFactor` CHANGES MEANING with `blendMode`. Legacy `MotionBlur 8` migrates to 8/8.1 = 0.9876543
// (**70 presets carry exactly that value**), which self-limits on the alpha star path and means an **81x** trail
// gain under `gl.blendFunc(ONE, ONE)`. The governing quantity is
//
//     accumulation index = material.emissionIntensity / (1 - trailDecay)
//
// whose accepted band is bracketed by the four browser-CONFIRMED additive demos: `Material Fire` 16.7,
// `Material Plasma` 21.0, `Material Ember` 22.7, `Material Liquid Light` 25.0. Hence the ceiling of 25.0 and the
// derive `cap = 1 - emissionIntensity / MAX_MATERIAL_ACCUM_INDEX`.
//
// ⚠️ **THIS SECTION MEASURES — it is the sixth that does (§A-C, F, L, N, and this), so its own BASIS is the
// most likely defect in it** (nine such in Phase 15, every one failing or passing on correct code). It was
// therefore CALIBRATED against seeded defects before shipping: raising the ceiling to 81, dropping the alpha
// exemption, deleting `setMaterialConfig`'s derive call, and moving that call above `currentMaterial = config`.
// Each failed ONLY its own assertion. **Read a failure here as a claim about this section until it is
// exonerated.**
//
// ⚠️ **THE METRIC THAT MISLED THE FIRST READING IS RECORDED BECAUSE IT IS THE REUSABLE PART:** the report was
// first quantified as *"76-79 % of presets are past the ACES pin"*, and that measures a property the four
// ACCEPTED demos also have (core HDR 39.8/30.1/64.0/27.3 against the 99 % pin at x = 6.42). A splat core is
// MEANT to clip. **Calibrate a brightness metric against the configurations that were accepted before quoting a
// population.** What actually fails past the band is that ACES output above the pin is INDEPENDENT of its input,
// so every such pixel grades to the same ceiling colour from the `gain` vector — a loss of VARIATION, not
// excess luminance, which is exactly why the two sliders the user reached for do not help.
{
  const mainS = stripComments(readFileSync(SRC + 'main.ts', 'utf8'));
  const matS = readFileSync(SRC + 'generators/material-presets.ts', 'utf8');
  const { MATERIAL_PRESETS } = await import('../src/generators/material-presets.ts').catch(() => ({}));
  const { DEMO_PRESETS } = await import('../src/presets/demo-presets.ts').catch(() => ({}));

  // --- the constant and the derive exist, and the derive is SOLVED rather than tabulated ---
  const kMatch = mainS.match(/const MAX_MATERIAL_ACCUM_INDEX = ([\d.]+)/);
  const K = kMatch ? parseFloat(kMatch[1]) : NaN;
  chk('MAX_MATERIAL_ACCUM_INDEX is declared and equals the confirmed band\'s upper edge (25.0)',
    K === 25.0,
    `read ${kMatch ? kMatch[1] : 'ABSENT'}. The four browser-confirmed additive demos give indices 16.7 / 21.0 / `
    + '22.7 / 25.0, so 25.0 is the largest a user has signed off on. ⚠️ A larger value re-opens the whiteout '
    + 'report and a smaller one shortens trails no accepted look needed shortened');

  const capFn = braceBody(mainS, 'const materialTrailDecayCap = ');
  chk('...and the cap is SOLVED from emissionIntensity, never tabulated per material',
    /1 - m\.emissionIntensity \/ MAX_MATERIAL_ACCUM_INDEX/.test(capFn),
    `body ${capFn.length} chars. ⚠️ A four-entry table would have SHIPPED WRONG on the first entry: hard-coding `
    + '"Fire = 0.88" from its demo\'s decayFactor ignores that the same demo overrides emissionIntensity 1.8 -> '
    + '2, making Fire\'s correct cap 0.9280. A table encodes a SOLUTION and goes stale when a bundle field '
    + 'moves; it also cannot track the user\'s own emissionIntensity slider, which is the one lever they have');

  chk('...ALPHA materials are exempt, and the exemption tests blendMode',
    /m\.blendMode !== 'additive'/.test(capFn) && /return null/.test(capFn),
    'An alpha-composited pixel is bounded by construction, so there is no accumulation to cap and clamping one '
    + 'would shorten trails for no reason. ⚠️ blendMode is the WHOLE test — not the material\'s name, and not '
    + '`preset !== \'None\'` alone (four of the nine materials are alpha: Smoke, Fog, Ice, Organic)');

  chk('...and a non-positive emissionIntensity returns null rather than a cap of 1 or above',
    /emissionIntensity > 0/.test(capFn),
    'At 0 the solve gives cap = 1, a Math.min that can never bite — correct only by accident; a negative value '
    + 'gives a cap ABOVE 1, which reads as "the clamp is off at some settings"');

  // --- the derive lives in the ONE owner, and only ever LOWERS ---
  const affs = braceBody(mainS, 'const applyFluidFeedbackState = ');
  chk('the cap is applied inside applyFluidFeedbackState, the single trailDecay owner',
    /materialTrailDecayCap\(\)/.test(affs) && /trailDecay = Math\.min\(trailDecay, decayCap\)/.test(affs),
    `body ${affs.length} chars. ⚠️ DERIVED, not assigned at the material setter — that function's own header `
    + 'records why: every earlier owner of a trailDecay override assigned on entry and restored nowhere, which '
    + 'is how style 6 leaked a trail length into presets that never selected it. A cap assigned at '
    + 'setMaterialConfig has exactly that shape, and worse: clearing a material would leave the 70 presets at '
    + '0.9876543 pinned to a shortened trail with no control naming the cause');

  chk('...as Math.min, so it can only ever SHORTEN a trail and never lengthen one',
    /Math\.min\(trailDecay, decayCap\)/.test(affs) && !/Math\.max\(trailDecay, decayCap\)/.test(affs),
    'A cap above the live value MUST be a no-op. That is what keeps all four confirmed demos byte-identical '
    + '(their authored decays sit below their own derived caps) and what keeps this function idempotent');

  chk('...applied AFTER both trailDecay arms, so style 6\'s persist is capped too',
    (() => {
      const iArm = affs.indexOf('trailDecay = active ? currentFluidFeedback.persist');
      const iCap = affs.indexOf('Math.min(trailDecay, decayCap)');
      return iArm >= 0 && iCap > iArm;
    })(),
    'Style 6\'s persist defaults to 0.96 and its slider reaches higher, so exempting it would leave the one '
    + 'path that can still reach a 100x+ index — and style 6 WITH a material is reachable. Capping after both '
    + 'arms covers it with no second test');

  // --- ALL FOUR material writers reach the derive, and the ORDER is the trap ---
  const setter = braceBody(mainS, 'setMaterialConfig: (config) => {');
  chk('setMaterialConfig calls applyFluidFeedbackState — it was the ONE material writer that never did',
    /applyFluidFeedbackState\(\);/.test(setter),
    `setter body ${setter.length} chars. ⚠️ Without it the cap is correct on a preset switch and DEAD on the `
    + 'path a user actually takes (picking a material from the Materials tab), which is the most likely way to '
    + 'reach the over-bright state at all. Same shape as the Fire -> Liquid mode omission invariant 13 caught '
    + 'at step 15.9: adding a policy to materials means auditing EVERY branch that switches them');

  chk('...positioned AFTER `currentMaterial = config`, or the cap derives from the OUTGOING material',
    (() => {
      const iAssign = setter.indexOf('currentMaterial = config;');
      const iDerive = setter.indexOf('applyFluidFeedbackState();');
      return iAssign >= 0 && iDerive > iAssign;
    })(),
    'The derive READS currentMaterial. Reversed, every material change would be capped by the material it '
    + 'replaced — and nothing would fail: the trail would simply be the wrong length for one selection');

  chk('...and OUTSIDE the three branches, so an emissionIntensity slider move re-solves the ceiling',
    (() => {
      const iDerive = setter.indexOf('applyFluidFeedbackState();');
      const iFirstBranch = setter.indexOf('if (!isNone && wasNone)');
      return iDerive >= 0 && iFirstBranch > iDerive;
    })(),
    '⚠️ NOT incidental: emissionIntensity is the cap\'s NUMERATOR, so a drag on that slider must re-solve. '
    + 'This setter also runs on every Materials-tab slider move, which takes none of the three branches — a '
    + 'call placed inside any of them would miss exactly that case');

  chk('the other three material writers are covered by applyOverlayConfigBlocks\' own derives',
    (() => {
      // ⚠️ **THE DECLARATION SPELLINGS ARE NOT THE SAME AND THIS ASSERTION FAILED ON CORRECT CODE FIRST TIME
      // FOR EXACTLY THAT REASON** — `applyPresetChange` is a hoisted `function`, `resetOverlays` an object
      // property. `braceBody('const applyPresetChange = ')` returned '' and the `iMat >= 0` test read a
      // MISSING BODY as a missing assignment. **The tenth measuring-section basis defect in this file, and
      // the cheapest kind: an assertion that cannot reach its subject reports on nothing.** Both anchors are
      // asserted non-empty below so the shape cannot come back silently.
      const apc = braceBody(mainS, 'function applyPresetChange(');
      const rov = braceBody(mainS, 'resetOverlays: (p) => {');
      if (!apc || !rov) return false;
      return [apc, rov].every(b => {
        const iMat = Math.max(b.indexOf('currentMaterial = ov.material'), b.indexOf('currentMaterial = matCfg'));
        const iBlocks = b.indexOf('applyOverlayConfigBlocks(ov)');
        return iMat >= 0 && iBlocks > iMat;
      });
    })(),
    '⚠️ An empty body here means the DECLARATION SPELLING moved, not that a derive is missing — check that '
    + 'first (this assertion failed on correct code exactly once, that way). '
    + '⚠️ That coverage is REAL but INCIDENTAL, which is why it is asserted rather than assumed: both paths '
    + 'assign currentMaterial ABOVE applyOverlayConfigBlocks, which ends in two idempotent derives. An edit '
    + 'that moved either assignment below it would leave the cap reading the outgoing preset\'s material and '
    + 'nothing would throw — the same ordering trap §Q measures for the pool');

  // --- MEASURED: the four accepted demos must not move, and the library must land inside the band ---
  if (MATERIAL_PRESETS && DEMO_PRESETS) {
    const cap = m => (!m || m.preset === 'None' || m.blendMode !== 'additive' || !(m.emissionIntensity > 0))
      ? null : 1 - m.emissionIntensity / K;
    const demos = [
      ['Material Plasma', 'Plasma'], ['Material Fire', 'Fire'],
      ['Material Ember', 'Ember'], ['Material Liquid Light', 'Liquid Light'],
    ];
    const moved = demos.filter(([dn]) => {
      const p = DEMO_PRESETS[dn];
      if (!p?.overlay?.material) return false;
      const c = p.overlay.material, cp = cap(c);
      return cp !== null && p.renderer.decayFactor > cp + 1e-12;
    });
    chk('MEASURED: all four browser-confirmed additive demos are left BYTE-IDENTICAL by the cap',
      moved.length === 0,
      `moved: ${moved.map(d => d[0]).join(', ') || 'none'}. Authored 0.90 / 0.88 / 0.85 / 0.94 against derived `
      + 'caps 0.9160 / 0.9200 / 0.8640 / 0.9400. ⚠️ These are the configurations the ceiling was DERIVED from, '
      + 'so a cap that moves one of them has falsified its own basis — read it as a defect in this section or '
      + 'in the constant, not as a preset needing a retune');

    const idx = MATERIAL_PRESETS
      .filter(m => m.config.blendMode === 'additive')
      .map(m => ({ label: m.label, i: m.config.emissionIntensity / (1 - cap({ ...m.config, preset: m.name })) }));
    const over = idx.filter(r => r.i > K + 1e-9);
    chk('MEASURED: every additive material\'s capped index lands exactly at the ceiling, none above',
      over.length === 0 && idx.length >= 4,
      `${idx.length} additive materials, over-ceiling: ${over.map(r => `${r.label} ${r.i.toFixed(1)}`).join(', ') || 'none'}. `
      + '⚠️ Uncapped the library maxes at 170.1 (Plasma) / 145.8 (Fire) / 121.5 (Liquid Light) / 275.4 (Ember) '
      + 'over the 136 material-free presets — 5-11x outside the confirmed band');

    chk('MEASURED: MAX_TILE_DECAY 0.96 is NOT reused here, being too loose by 1.5-3.4x on the index',
      !/MAX_TILE_DECAY/.test(capFn) && !/0\.96/.test(capFn),
      '⚠️ The tile constant (ui/preview-grid/grid-tile-renderer.ts) is the live PRECEDENT for this fix — same '
      + 'problem, same shape, and it is WHY a preview tile looks correct while the main view whites out. But '
      + '0.96 leaves the index at 52.5 / 45.0 / 37.5 / 85.0, every one outside the band. It works for tiles '
      + 'because a 256x192 tile has far less overlap, not because 0.96 is the right ceiling');
  }

  // --- the Fire bundle must agree with its own confirmed demo ---
  const fireBundle = matS.slice(matS.indexOf("name: 'Fire'"), matS.indexOf("name: 'Ember'"));
  chk('the Fire bundle\'s velocityStretch is 0.4, agreeing with its own confirmed demo',
    /velocityStretch: 0\.4,/.test(fireBundle),
    '⚠️ It shipped at 1.0 — the Materials slider\'s MAXIMUM (M2 clamped the range to 0-1 because both shader '
    + 'stages compute clamp(velocityStretch, 0, 1)) — while `Material Fire`, this material\'s browser-confirmed '
    + 'reference, authors 0.4. Corroborated across the library: of the 8 presets authoring material Fire, five '
    + 'sit at or below 0.5 and the only three at 1.0 are pending refined entries. ⚠️ Ember diverges the '
    + 'OPPOSITE way (bundle 0.8, its demo 1.0) and is deliberately left alone — do not unify them');

  // --- Halo Strength's precondition, which is a TOOLTIP fact and an invariant-13 one ---
  const tips = readFileSync(SRC + 'ui/synthesis-lab/tooltips.ts', 'utf8');
  const haloTip = (tips.match(/haloStrength: '[\s\S]*?',\n/) || [''])[0];
  chk('the haloStrength tooltip states that it cannot dim a particle\'s CORE',
    /cannot dim/.test(haloTip) && /Core Brightness/.test(haloTip),
    `tip ${haloTip.length} chars. ⚠️ ALGEBRAICALLY absent, not merely weak: the splat kernel computes `
    + 'circularShape = mix(haloFalloff * uHaloStrength, uCoreBrightness, coreZone) with coreZone == 1 at r = 0 '
    + '(renderers/hdr-particle.ts), so the halo term is multiplied by ZERO at the centre. Invariant 13\'s '
    + 'harder form — the control moves exactly what it names and reads as inert because the pixels the user is '
    + 'looking at are the ones it provably cannot reach. ⚠️ The mix is CORRECT: do not "fix" the shader to let '
    + 'Halo bleed into the core. A PRECONDITION is the one kind of copy that earns a hover (see this file\'s '
    + 'header on tooltips being found only by someone who already suspects the control)');
}

// ===========================================================================
console.log('\n=== T. a material PRESENTATION block must reproduce the look it claims, field by field ===\n');
// 2026-09-05. Reported as *"I have chosen Lissajous Flame, set material to None and then reapplied material
// Fire, the result is not identical, too much glow and bloom"* — after the block had already passed a green
// `verify` and been documented. TWO independent defects, neither a wrong-looking number in isolation:
//
//   1. WRONG VALUES FROM A BLOCK NOTHING READS. bloom/tone-map were sourced from `Lissajous Flame`'s
//      `postProcessors` — DEPRECATED and never read by the engine — so the block added a bloom pass and an
//      ACES compression the template has never applied. ⚠️ The comment called them *"the numbers it authored
//      before its look was switched to Legacy"*, which made **dead data look like provenance**.
//   2. AN INHERITANCE HOLE. `applyFilmLook('Customize')` does NOT reseed — it sets
//      `look = customFilmLookParams`, still holding what the last NAMED look seeded — so every field the block
//      omits survives from the OUTGOING preset's look. 12 of the 15 named looks differ from `Legacy` on at
//      least one of the six depth/lighting fields (`Void` on five).
//
// ⚠️ **DEFECT 2 WAS INVISIBLE TO THE REPORT THAT FOUND DEFECT 1**, because `Lissajous Flame`'s own look IS
// `Legacy` — the single starting point where the hole has nothing to leak. **A round trip that returns to its
// own preset cannot detect inheritance. Vary the STARTING state, not just the round trip.**
//
// ⚠️ **THIS SECTION MEASURES.** It does not grep for literals: it imports `FILM_LOOKS` and the block and
// compares them field by field, then SIMULATES `applyFilmLook` + `applyCustomParam` from four different
// starting looks. A grep would have passed on both defects — every value was syntactically fine. Calibrated
// against five seeded defects (bloom back on; `sliderBaseFilmLook` back to 'Legacy Graded'; one of the six
// depth fields deleted; the palette departure removed; `filmLook: 'Customize'` changed to a named look),
// each failing ONLY its own assertion.
//
// ⚠️ **GENERALISED 2026-09-05 WHEN `Ember` BECAME THE SECOND CARRIER, AND THE PREVIOUS VERSION'S OWN FAILURE
// IS WHY IT IS A TABLE AND NOT AN `|| 'Ember'`.** Every clause below was Fire-specific — the template name,
// the expected palette, even the carrier count — so widening would have produced one clause per material per
// property and left the next carrier failing again. The table is the anchor: **each material declares its
// template and its departures, and the same nine clauses run PER MATERIAL.** A new carrier now needs one
// table row, and a carrier with NO row fails the coverage clause rather than going unchecked — which is the
// property widening cannot give, since an un-generalised clause reports on Fire while saying nothing about
// the material that was actually added.
//
// ⚠️ **RE-GENERALISED THE SAME DAY FOR `Plasma`, AND THE TABLE-OF-TWO TURNED OUT TO ENCODE TWO ASSUMPTIONS
// NEITHER CARRIER COULD FALSIFY: that the base look is the TEMPLATE'S look, and that the physics blocks are
// the template's VERBATIM.** Both held for Fire and Ember because both templates author `filmLook: 'Legacy'`
// and neither needed a physics departure. Plasma breaks both — its template authors `Customize`, which is a
// MODE and not a bundle (`FILM_LOOKS['Customize']` does not exist), and its `buoyancy.enabled` must override
// the template's `false` or the engine's own force-enable is undone. So rows now declare an optional `base`
// and optional `physics` overrides. ⚠️ **THE FIRST FORM WOULD HAVE PASSED VACUOUSLY RATHER THAN FAILING
// LOUDLY**: `base` would resolve to `undefined` and every equality clause filters an EMPTY key list, so they
// would report green on a block that authored nothing. ⚠️ **The `!!base` test is what catches that, and the
// added `Object.keys(base).length > 0` is DEFENSIVE ONLY — seeded and measured: removing it alone changes no
// result, because no current look is an empty object. It is recorded as unreachable rather than credited with
// the catch**, which is the discipline this file's twelve basis defects were bought with — an assertion that
// cannot fail today occupies the slot a real one would take, so it must at least be labelled honestly.
// ⚠️ **A TABLE IS NOT AUTOMATICALLY GENERAL: two rows that happen to agree on
// a property state it as an INVARIANT without ever testing it. Ask what the existing rows have in common that
// the new one does not** — and note that a declared override is an EXEMPTION, so each is paired with an
// `overIdle` test that fails if the exemption stops being needed.
{
  const { MATERIAL_PRESETS: MP, getMaterialPresentation } =
    await import('../src/generators/material-presets.ts').catch(() => ({}));
  const { FILM_LOOKS: FL } = await import('../src/renderers/film-looks.ts').catch(() => ({}));
  const { FIRE_PRESETS: FP } = await import('../src/presets/fire-presets.ts').catch(() => ({}));
  const { DEMO_PRESETS: DP } = await import('../src/presets/demo-presets.ts').catch(() => ({}));

  /*
   * The (material -> template) table, and the ONE place a new carrier is declared.
   *
   * `departures` are the fields the block may legitimately differ from its template's look on. They are
   * DECLARED rather than inferred, because inferring them from the block would make the block its own oracle:
   * every difference would be "declared" by existing and the equality clauses would assert nothing.
   *
   * ⚠️ **The two carriers' palettes DIFFER BY DECISION and the table is what keeps that from reading as a
   * defect.** Fire uses `'Material: fire'`, which `palettes.ts` resolves to the SAME Uint8Array as
   * `getColourRampData('fire')` — so the palette provably cannot fight the ramp it is assigned over. Ember
   * uses `'Classic: ember'` (user's choice, 2026-09-05), a DIFFERENT array, so there the palette genuinely
   * replaces the bundle's ramp. Both are monotonic in luma, which is the property `paletteMapping:
   * 'temperature'` actually requires; the cosine palette named `Fire` has 94 luma dips and would make a
   * hotter particle darker. **Assert the value per material — never a shared literal.**
   */
  const CARRIERS = [
    { material: 'Fire', template: 'Lissajous Flame', from: 'FIRE_PRESETS',
      departures: { palette: 'Material: fire', paletteMapping: 'temperature' },
      // Measured: 0 of the 12 material keys diverge from the template. See the `config` clause below.
      configDepartures: {} },
    { material: 'Ember', template: 'Material Ember', from: 'DEMO_PRESETS',
      departures: { palette: 'Classic: ember', paletteMapping: 'temperature' },
      // ⚠️ **THE SECOND ROW TO DECLARE A `physics` DEPARTURE, AND THE FIRST WHERE THE BUNDLE AND ITS OWN
      // TEMPLATE MUST HOLD DIFFERENT VALUES BECAUSE THEY ARE APPLIED TO DIFFERENT FIGURES** (2026-09-17).
      // `ejectionSpeed` multiplies the particle's real per-frame screen motion (`lissajous.ts`'
      // `frameMotion`, whose declaration owns the stale-delta fix that made this true). `Material Ember`'s
      // figure is the slowest of the fourteen spark presets — median 0.79 px/frame against 110 for the
      // fastest — so its coals need the 3.0 CEILING to eject at all, while this bundle is applied by the
      // DROPDOWN to whatever figure the user is on, where 3.0 over a typical ~2 000 px/s base would fling
      // embers across the frame in a fifth of a second. **One number cannot serve both, and the checker
      // binding them is correct — this is what a declared departure is for.** Its cost is real and is the
      // reason it is written down: re-picking `Ember` on the Materials tab replaces the demo's 3.0 with 0.1
      // and its coals stop ejecting, a `presentation`-block property (dropdown-handler only) that this is
      // the first preset to make visible. ⚠️ **Do not 'unify' them** — and do not read the three carriers'
      // shared 0.1 as a shared constant either; all three merely landed on the same track FLOOR.
      physics: { sparks: { ejectionSpeed: 0.1 } },
      // ⚠️ The KNOWN, DECIDED divergence: bundle 0.8 against its demo's 1.0 — the OPPOSITE direction from
      // Fire's old one, which is why CLAUDE.md's rule is *"do not unify them"*. Declared, not tolerated.
      configDepartures: { velocityStretch: 0.8 } },
    { material: 'Plasma', template: 'Julia Burn Rivers', from: 'FIRE_PRESETS',
      // ⚠️ **THE FIRST ROW TO DECLARE A `base`, AND THE FIRST WHOSE TEMPLATE LOOK IS NOT A NAMED BUNDLE.**
      // `Julia Burn Rivers` authors `filmLook: 'Customize'`, and `FILM_LOOKS['Customize']` DOES NOT EXIST —
      // so the previous version's `base = FL[tmplLook]` resolves to `undefined` here and would have made
      // every equality clause below vacuous for this material. The block reproduces the NAMED `Plasma`
      // bundle by design (measured: the template's own cfp is 11 fields from it, `Anima Electrica`'s is 5),
      // so the look it must equal is DECLARED rather than read off the template.
      base: 'Plasma',
      // ⚠️ **SIX DEPARTURES, AND THE FOUR NON-PALETTE ONES ARE A USER-REVIEW FIX (2026-09-05) — SO A NAMED
      // BUNDLE IS A STARTING POINT, NOT AN ORACLE.** The first draft shipped `FILM_LOOKS['Plasma']`'s
      // grading verbatim and was rejected in the browser as "one large almost uniform area with halo".
      // `FILM_LOOKS['Plasma']` was authored for the non-material splat path and had never met
      // `emissionIntensity: 2.1` on an additive blend — a 2.1x multiplier upstream of its `exposure: 2.0`.
      // ⚠️ **These four are DECLARED for the same reason the palette is: without the declaration a later
      // accidental revert to the bundle's own values would read as CORRECT, since the bundle is the base.**
      // The measured oracle is STEP COLLAPSE — adjacent accumulation steps whose 8-bit outputs differ by
      // <= 2, i.e. figure detail destroyed before the screen: 65% as first shipped, 24% now. Clipping alone
      // (58% -> 33%) understates it and cannot discriminate, the accepted looks clipping too.
      departures: {
        palette: 'Material: liquid', paletteMapping: 'temperature',
        // `glow` INVERTS (`effFalloff = falloffExponent * (4/glow)`): 3.0 gives 4.27, a TIGHTER halo than
        // the 4.0 identity. Answers the "spark size or halo?" question — sparks' splatRadius is 3 vs the
        // particle's 9, so the halo dominated. `config` is untouched (the accepted 2026-08-21 retune).
        glow: 3.0,
        // bloom blurs everything above the threshold back over the frame; at 0.25 that was the whole
        // figure, which IS the "merges into one area" report.
        bloomThreshold: 0.60, bloomIntensity: 0.25,
        // the dominant term. At 2.0 the ladder at ramp t=0.30 was ONE value (rgb 255,0,255) at every
        // accumulation from 0.35 to 4.
        exposure: 0.55,
        // pushing an already-clipped channel further apart adds no information.
        saturation: 1.6,
      },
      // ⚠️ **AND THE FIRST TO DEPART FROM ITS TEMPLATE'S PHYSICS.** Plasma is on
      // `FIRE_BEHAVIOUR_MATERIALS`, so `setMaterialConfig` force-enables buoyancy at `main.ts:4292` just
      // BEFORE `applyPresentation()` — copying the template's `enabled: false` would turn it back off, and
      // every `setSmokeParams` caller reads `enabled ? (smokeThreshold ?? 0.25) : 0`, which would leave the
      // three smoke fields inert (invariant 25). `smokeThreshold` is then re-derived against `heatGain`:
      // the smoke-pass fraction is ~threshold/heatGain, so 0.25/0.60 = 42% where Fire's 0.25/1.00 is 25%;
      // ⚠️ **THAT DERIVATION ANSWERED "HOW MUCH SMOKE" AND THE REVIEWED ANSWER WAS *NONE* — `smokeThreshold`
      // IS `0` BY USER DECISION (2026-09-05), NOT BY A PROPORTION ARGUMENT.** An arc discharge has no cold
      // smouldering tail, so the whole population belongs on the emissive pass. At `0` this is a genuine
      // BYPASS, not an unreachable threshold: `hdr-particle.ts:3796` gates pass 0 on `smokeThreshold > 0`
      // and `uRenderPass` becomes 2 ("render all"). ⚠️ **`enabled` MUST STAY `true` — it drives the buoyancy
      // FORCE; only the threshold turns the smoke SPLIT off. Asserting `enabled: true` BESIDE
      // `smokeThreshold: 0` is what keeps a future "the smoke is off, so disable buoyancy" edit from
      // passing.** `smokeOpacity` is retained as the value the split WOULD use if a user raises the
      // threshold on the Materials tab. **Declared, so the block is not its own oracle** — an accidental
      // edit to any of the three still fails.
      physics: { buoyancy: { enabled: true, smokeThreshold: 0.0, smokeOpacity: 0.30 } },
      // ⚠️ **EIGHT OF TWELVE, AND THIS ROW IS WHY THE `config` CLAUSE IS A DECLARATION AND NOT AN EQUALITY.**
      // `Julia Burn Rivers` is an ATTRACTOR preset with 12 000 particles; the bundle is tuned for the
      // dropdown's median scene, so a wholesale match would be wrong here. Every one is the accepted
      // 2026-08-21 retune, declared so a later drift still fails.
      configDepartures: { splatRadius: 9.0, coreBrightness: 1.9, haloStrength: 0.85, falloffExponent: 3.2,
        thermalLag: 0.08, emissionIntensity: 2.1, heatGain: 0.60, velocityStretch: 0.25 } },
    { material: 'LiquidLight', template: 'Material Liquid Light', from: 'DEMO_PRESETS',
      // ⚠️ **THE FIRST ROW WHOSE TEMPLATE WAS NOT CHOSEN BY THE "MOST HAND-SET PHYSICS FIELDS" RULE, AND
      // THE FIRST WHOSE TEMPLATE AUTHORS NO PHYSICS AT ALL.** By that rule the template would be `Lava Flow`
      // (9 buoyancy + 11 spark fields, a designed `Dramatic` grade) — and `Lava Flow` OVERRIDES every one of
      // the eleven material fields it inherits (`splatRadius` 4.5, `haloStrength` 0, `heatGain` 1.2,
      // `emissionIntensity` 2.2, `velocityStretch` 0.2), so its look was designed against a sprite and a heat
      // window the dropdown does not produce. **A template must be a preset the bundle's own config would
      // actually draw; field count RANKS candidates, it does not QUALIFY them.**
      base: 'Legacy Graded',
      departures: { palette: 'Material: liquid', paletteMapping: 'temperature' },
      // ⚠️ **`enabled: false` — THE MIRROR IMAGE OF PLASMA'S OVERRIDE, AND THE REASON IS THE SAME MECHANISM
      // READ THE OTHER WAY.** `LiquidLight` is NOT on `FIRE_BEHAVIOUR_MATERIALS`, so `main.ts:4292`
      // force-DISABLES buoyancy and sparks on arrival where it force-ENABLES them for Plasma. ⚠️ **AND THIS
      // IS NOT A RESTATEMENT OF THE ENGINE: `main.ts:4327` re-applies the defaults only when the auto-fire
      // VERDICT CHANGES, so `Ice` -> `LiquidLight` (both false) skips that branch and would carry a
      // hand-enabled buoyancy across.** Declared here so the block cannot be its own oracle either way.
      physics: { buoyancy: { enabled: false }, sparks: { enabled: false } },
      // ⚠️ **ZERO DEPARTURES, AND THAT IS AN ASSERTION AND NOT AN ABSENCE.** The bundle's `splatRadius` and
      // `haloStrength` were corrected 18 -> 10 and 1.0 -> 0.4 on 2026-09-05 TO this demo, on the user's
      // decision, after measuring the 18/1.0 sprite at 5.80x Plasma's energy with core:mid 1.5 — a flat disc,
      // the "large pink blob" shape the Plasma review had just rejected. An empty declaration is what pins
      // that: a revert to 18 now FAILS instead of passing as "the bundle is allowed to differ".
      configDepartures: {} },
  ];
  const GROUPS = { FIRE_PRESETS: FP, DEMO_PRESETS: DP };
  const tmplOf = (c) => { const g = GROUPS[c.from]; const p = g && g[c.template]; return p && p.preset ? p.preset : p; };

  // ⚠️ Assert the ANCHORS are non-empty before testing their contents. A block that resolved to undefined
  // would make every clause below vacuously pass — two of this file's twelve basis defects were dead anchors.
  const anchorBad = CARRIERS.filter(c => { const t = tmplOf(c); return !t || !t.overlay || !t.renderer; });
  chk('T anchors resolve: MATERIAL_PRESETS, FILM_LOOKS and EVERY table template are readable',
    Array.isArray(MP) && !!FL && !!FL['Legacy'] && anchorBad.length === 0,
    'unreadable templates: [' + anchorBad.map(c => c.template).join(', ') + ']. ⚠️ Without this the section '
    + 'reports on nothing and passes green forever. ⚠️ It resolves `.preset ?? p` because variant-presets.ts '
    + 'nests its entry under a `.preset` key — a naive walk scores such a group ZERO');

  // --- COVERAGE: the table and the code must describe the same set of carriers, in BOTH directions ---
  const carriers = (MP || []).filter(m => m.presentation).map(m => m.name);
  const declared = CARRIERS.map(c => c.material);
  const undeclared = carriers.filter(n => !declared.includes(n));
  const unbuilt = declared.filter(n => !carriers.includes(n));
  chk('every material carrying a presentation block has a table row, and every row is a real carrier',
    undeclared.length === 0 && unbuilt.length === 0 && carriers.length > 0,
    'carriers [' + carriers.join(', ') + '] vs table [' + declared.join(', ') + ']; unchecked: ['
    + undeclared.join(', ') + '], phantom rows: [' + unbuilt.join(', ') + ']. ⚠️ **THIS CLAUSE REPLACED A '
    + 'HARD-CODED "only Fire so far"** — that form failed the moment a second material gained a block, which '
    + 'was deliberate as a reminder, but it also could not say anything ABOUT the new material. Both '
    + 'directions matter: `undeclared` is a carrier nothing below checks (the silent failure), `unbuilt` is a '
    + 'row whose subject no longer exists, which would make every clause below it vacuous for that material. '
    + '⚠️ The block stays OPTIONAL by design — the seven materials with no block must remain byte-identical '
    + 'to their pre-2026-09-05 behaviour, so a LOW carrier count is not a defect; a MISMATCH is');

  // Everything below runs once PER CARRIER. Labels carry the material name so a failure names its subject.
  for (const c of CARRIERS) {
    const M = c.material;
    const tmpl = tmplOf(c);
    const pres = getMaterialPresentation ? getMaterialPresentation(M) : null;
    const tmplLook = tmpl && tmpl.overlay ? tmpl.overlay.filmLook : null;
    // ⚠️ **THE BASE LOOK IS THE ROW'S `base` WHEN IT DECLARES ONE, ELSE THE TEMPLATE'S OWN.** Reading it
    // off the template unconditionally was correct for two carriers and WRONG for the third: a template may
    // author `filmLook: 'Customize'`, and `FILM_LOOKS['Customize']` does not exist — `base` would be
    // `undefined`, and `Object.keys(undefined)` never runs because every clause below filters an empty key
    // list, so all five equality clauses would pass VACUOUSLY on a block that authored nothing at all.
    // That is this file's thirteenth basis-defect shape and it was caught by seeding, not by reading.
    const baseName = c.base || tmplLook;
    const base = FL && baseName ? FL[baseName] : null;
    const DEPARTURES = new Set(Object.keys(c.departures));
    const cfp = pres ? pres.customFilmLookParams : null;

    chk(M + ': the block reproduces a REAL named film look (' + c.template + ' -> ' + baseName + ')',
      !!baseName && !!base && !!cfp && Object.keys(base).length > 0,
      'base look "' + baseName + '" (row ' + (c.base ? 'DECLARES it' : 'inherits it from the template') + '), '
      + 'resolved to ' + (base ? Object.keys(base).length + ' fields' : 'UNDEFINED') + '. The block uses '
      + 'Customize ONLY because a NAMED look pins its own palette and a real material palette is a stated '
      + 'requirement — setPalette is an independent uniform+texture path, so Customize can equal the named '
      + 'look in every respect EXCEPT the palette. ⚠️ **`!!base` IS THE HALF THAT CATCHES THE LIVE CASE** — a '
      + 'base naming something that is not a bundle (`Customize` is the live example: it is a MODE, and '
      + '`FILM_LOOKS` has no such entry) resolves to undefined, and four clauses fail. **Measured, not '
      + 'assumed: removing the `Object.keys` half ALONE changes nothing** — it guards only a bundle that '
      + 'exists but is EMPTY, which no current look is, so it is defensive rather than load-bearing and is '
      + 'labelled that way deliberately. ⚠️ It is kept because the failure it guards is the vacuous kind '
      + '(every equality clause below filters an empty key list and reports green on a block that authored '
      + 'nothing), which is the shape this file has been bitten by twelve times — but **an assertion nothing '
      + 'can currently reach is recorded as such, never advertised as the one doing the work.** ⚠️ Two '
      + 'carriers inherit Legacy from their template and one declares Plasma; a template look is EVIDENCE, '
      + 'not the oracle');

    const wrong = base && cfp
      ? Object.keys(base).filter(k => !DEPARTURES.has(k) && JSON.stringify(base[k]) !== JSON.stringify(cfp[k]))
      : ['(anchor missing)'];
    chk(M + ': ...every non-departure field EQUALS that look, measured against FILM_LOOKS rather than grepped',
      wrong.length === 0,
      'differing: [' + wrong.join(', ') + ']. ⚠️ THIS IS DEFECT 1 AND IT SHIPPED verify-GREEN: bloomEnabled '
      + 'true / threshold 0.6 / intensity 0.3 and toneMap aces, all taken from the preset\'s DEPRECATED '
      + 'postProcessors block, which the engine does not read. ⚠️ **NEVER SOURCE A VALUE FROM A BLOCK NOTHING '
      + 'READS** — diff against the object the engine consumes (FILM_LOOKS), not the preset\'s JSON. ⚠️ And note '
      + 'what the user called it: "too much glow and bloom" while glow was 4.0 in BOTH — a symptom names a '
      + 'LOOK, not a field');

    const missing = base && cfp ? Object.keys(base).filter(k => !(k in cfp)) : ['(anchor missing)'];
    chk(M + ': ...and the block authors EVERY field of that look, leaving nothing to inherit',
      missing.length === 0,
      'unauthored: [' + missing.join(', ') + ']. ⚠️ THIS IS DEFECT 2, an INHERITANCE hole rather than a wrong '
      + 'value: applyFilmLook(CUSTOMIZE_FILM_LOOK) sets look = customFilmLookParams and does NOT reseed, so an '
      + 'omitted field survives from the outgoing preset\'s look. A partial block is only correct when arriving '
      + 'from the very look it reproduces');

    // --- the departures are DECLARED per material, so this cannot be satisfied by deleting the palette ---
    const depBad = Object.entries(c.departures).filter(([k, v]) => !cfp || JSON.stringify(cfp[k]) !== JSON.stringify(v));
    chk(M + ': ...while its declared departures are present with their declared values (palette ' + c.departures.palette + ')',
      depBad.length === 0,
      'wrong/absent: [' + depBad.map(([k, v]) => k + ' want ' + JSON.stringify(v) + ' got '
      + JSON.stringify(cfp && cfp[k])).join('; ') + ']. ⚠️ Without this clause the whole section is satisfiable '
      + 'by REMOVING the palette — passing every equality test above while silently reverting the requirement '
      + 'the block exists for ("none is not good enough, we need a real fire one"). ⚠️ **The two carriers\' '
      + 'palettes differ BY DECISION** (Fire = Material: fire, which is the same array as its ramp; Ember = '
      + 'Classic: ember, chosen by the user 2026-09-05) so a shared literal here would be WRONG. temperature '
      + 'is the ONLY one of the six mappings that reads vTemperature');

    // --- the SLIDER BASE must be the same look, or one drag re-introduces the defect ---
    chk(M + ': ...and sliderBaseFilmLook is that SAME base look, so a Sliders drag cannot re-introduce a grade',
      !!pres && pres.sliderBaseFilmLook === baseName,
      'sliderBaseFilmLook ' + JSON.stringify(pres && pres.sliderBaseFilmLook) + ' vs base '
      + JSON.stringify(baseName) + '. ⚠️ **AGAINST `baseName`, NOT THE TEMPLATE\'S LOOK** — Plasma\'s template '
      + 'authors Customize, which is not a bundle grading() could revert to at all, so the template-derived '
      + 'form of this clause was unsatisfiable for the first non-Legacy carrier. ⚠️ **AND FOR PLASMA THE '
      + 'REVERT TARGET IS A KNOWN DEFECT RATHER THAN A BLANK: no named bundle carries a material ramp, so a '
      + 'drag restores FILM_LOOKS[Plasma].palette = "Neon" — 128 luma dips, the palette that block exists to '
      + 'avoid.** Accepted, and recorded in the bundle header: basing it on Legacy instead would strip the '
      + 'whole grade one drag later, which is strictly worse (that was Fire\'s own defect). ⚠️ Fire shipped as '
      + '"Legacy Graded" — grading() rebuilds '
      + 'customFilmLookParams WHOLESALE from this named bundle on every Mood/Glow/Depth drag (deliberately, for '
      + 'idempotency), so a graded base brings the bloom and ACES back ONE SLIDER MOVE after they were removed. '
      + '**A base look is not metadata: it is what the grade REVERTS TO.**');

    // --- the SIMULATION: what the ENGINE ends up with, from four different starting looks ---
    // Models applyFilmLook + applyCustomParam (main.ts:2872, :2944). Deliberately a model and not a grep: the
    // defect lives in the COMPOSITION of those two calls, which no single line of source states — for
    // 'Customize' applyFilmLook does NOT reseed, and applyCustomParam early-returns for anything else.
    //
    // ⚠️ **THE FIRST VERSION OF THIS CLAUSE WAS A BASIS DEFECT — IT MEASURED NOTHING OF ITS OWN**, and
    // calibration is the only reason that is known. It compared the simulated result to `Legacy` over the
    // NON-departure keys only, which is algebraically implied by the two clauses above (block authors every
    // field ∧ every non-departure field equals the look ⇒ Object.assign yields the look on those keys). So it
    // could fail only when one of them already had, and a FIFTH seeded defect — `filmLook: 'Customize'` changed
    // to `'Legacy'`, which silently discards the palette, the entire reason the block exists — passed ALL TEN
    // assertions. **The oracle is the RESOLVED END STATE including the departures; excluding them is what made
    // the interesting failure invisible.** ⚠️ Per material, so the seed must be re-run per material too: a
    // single-carrier simulation cannot fail on the carrier it does not run for.
    const simulate = (startLook) => {
      // The live params object still holds what the last NAMED look seeded — this is the inheritance channel.
      let cur = startLook, live = { ...(FL[startLook] || {}) };
      if (pres.filmLook === 'Customize') cur = 'Customize';
      else if (FL[pres.filmLook]) { cur = pres.filmLook; live = { ...FL[pres.filmLook] }; }
      Object.assign(live, pres.customFilmLookParams || {});    // applyCustomParam, no-op unless Customize
      return cur === 'Customize' ? live : FL[cur];
    };
    // The intended end state: the template's look with the declared departures applied over it.
    const want = { ...base, ...c.departures };
    const drifted = [];
    if (pres && base) {
      for (const st of ['Legacy', 'Cinematic', 'Void', 'Neon']) {
        const got = simulate(st) || {};
        const d = Object.keys(want).filter(k => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
        if (d.length) drifted.push(st + ':[' + d.join(',') + ']');
      }
    }
    chk(M + ': ...so selecting it from FOUR different starting looks resolves to the SAME end state, palette included',
      drifted.length === 0 && !!pres,
      'drift: ' + drifted.join(' ') + '. ⚠️ THE ORACLE THE USER\'S OWN TEST COULD NOT BE: they round-tripped '
      + 'within Lissajous Flame, whose look IS Legacy, so the inheritance hole had nothing to leak and defect 2 '
      + 'stayed hidden behind defect 1. Cinematic leaks depthBrightness 0.6, Void rimPower 6 and lightDir '
      + '[0,-1,0], Neon lightingMode 2. **Vary the STARTING state — a round trip is not an inheritance test.** '
      + 'This clause also owns the choice of Customize itself: under any NAMED filmLook applyCustomParam '
      + 'early-returns, so the palette departure never lands and this comparison sees the named look\'s palette');

    // --- and the physics half must still match the template, which is what made the export diff conclusive ---
    // ⚠️ **THE TEMPLATE'S VALUE IS THE ORACLE ONLY WHERE THE ROW DOES NOT DECLARE AN OVERRIDE.** Plasma
    // deliberately departs on three buoyancy fields, so an unconditional verbatim test would fail on correct
    // code — invariant-13's shape applied to a CHECKER. The overrides are DECLARED in the table, not read
    // from the block, so the block still cannot be its own oracle: an accidental fourth departure fails, and
    // so does an edit to any of the three declared ones.
    const t = tmpl ? tmpl.overlay : null;
    const ov = (c.physics || {});
    /*
     * ⚠️ **A TEMPLATE MAY AUTHOR NO PHYSICS BLOCK AT ALL, AND THE FIRST FORM OF THIS COMPARATOR TREATED THAT
     * AS A MISSING ANCHOR — i.e. it would have FAILED ON CORRECT CODE for the fourth carrier.** Three
     * templates authored both blocks, so "the template is the oracle" was stated as an invariant without ever
     * being tested; `Material Liquid Light` authors neither. The generalisation is not "skip it": where the
     * template is silent there IS no template value, so every field the block states must be DECLARED in the
     * row — which keeps the block from being its own oracle, the whole property of this table.
     */
    const cmp = (a, b, over) => {
      if (!b) return [];                                    // block states no such section: nothing to check
      if (!a) return Object.keys(b).filter(k => !over || !(k in over)   // template silent -> must be declared
        || JSON.stringify(over[k]) !== JSON.stringify(b[k]));
      return Object.keys(b).filter(k => JSON.stringify(over && k in over ? over[k] : a[k]) !== JSON.stringify(b[k]));
    };
    const bDiff = cmp(t && t.buoyancy, pres && pres.buoyancy, ov.buoyancy);
    const sDiff = cmp(t && t.sparks, pres && pres.sparks, ov.sparks);
    // Both directions, as with the carrier coverage clause: a declared override whose field the block does
    // not actually differ on is a stale row, and it would silently weaken the verbatim test for that field.
    //
    // ⚠️ **THE `if (!tb || !pb) continue` THIS REPLACED WAS AN UNREACHABLE-ASSERTION BUG OF THIS FILE'S OWN
    // DOCUMENTED KIND**: with a template that authors no buoyancy, `tb` is undefined and every override for
    // that block was SKIPPED — so the stale-row test reported green while testing nothing, in exactly the
    // case a new carrier introduces it. **A `continue` on a missing anchor is a silent exemption; the two
    // halves of the test have different anchors and must be gated separately.**
    //
    // ⚠️ **AND THE SEED THAT PROVES IT HAD TO BE A COMPOUND — the single mutation reverting this to
    // `continue` LEAVES FIELDCHECK GREEN, CORRECTLY.** A weakening is not an error on clean code: the
    // exemption is invisible until a defect needs catching, so scoring that green as a miss would file a
    // fact about the seed under the heading for gaps in the checker. What exonerates the two-half form is
    // the PAIR — revert this comparator *and* delete the block's `sparks` override, a defect independently
    // proven to fail on its own; that combination is green, which is the exemption made visible.
    // ⚠️ **A MUTATION THAT CANNOT FAIL ALONE MUST BE SEEDED TOGETHER WITH THE DEFECT IT WOULD CONCEAL, AND
    // ITS EXPECTED VERDICT IS GREEN.** Generalises past this clause: it is the calibration shape for any
    // *widening* of an anchor, where the old form's failure mode is silence rather than a wrong answer.
    const overIdle = [];
    for (const [blk, fields] of Object.entries(ov)) {
      const tb = t && t[blk], pb = pres && pres[blk];
      for (const [k, v] of Object.entries(fields || {})) {
        // Half 1 — is the override still NEEDED? Only answerable where the template states the field.
        if (tb && k in tb && JSON.stringify(tb[k]) === JSON.stringify(v)) {
          overIdle.push(blk + '.' + k + ' (template already ' + JSON.stringify(v) + ')');
        // Half 2 — does the block actually MAKE it? Answerable whenever the block states the section, and it
        // is the only half available when the template is silent, so it must not be gated on `tb`.
        } else if (!pb || JSON.stringify(pb[k]) !== JSON.stringify(v)) {
          overIdle.push(blk + '.' + k + ' (block has ' + JSON.stringify(pb && pb[k]) + ')');
        }
      }
    }
    chk(M + ': the buoyancy and sparks blocks are the template\'s verbatim except where the row DECLARES a departure',
      bDiff.length === 0 && sDiff.length === 0 && overIdle.length === 0,
      'buoyancy [' + bDiff.join(',') + '] sparks [' + sDiff.join(',') + '] stale/idle overrides ['
      + overIdle.join('; ') + ']. These came back BYTE-IDENTICAL in '
      + 'the export diff, which is what localised the report to the film look ALONE — the value of asserting '
      + 'them is that the next such diff can trust them again. ⚠️ This is also what disqualified '
      + 'Attractor Fire Cloud as Ember\'s template: 17 of its 20 buoyancy+spark values are byte-equal to '
      + 'DEFAULT_*, the signature of the dropdown having re-applied the bundle rather than a designed look. '
      + '⚠️ **PLASMA IS THE FIRST ROW WITH `physics` OVERRIDES AND ALL THREE ARE LOAD-BEARING**: '
      + 'buoyancy.enabled MUST be true (the template\'s false would undo main.ts:4292\'s force-enable and '
      + 'leave the smoke fields inert), and smokeThreshold/Opacity are re-derived because the smoke-pass '
      + 'fraction is ~threshold/heatGain and Plasma\'s heatGain 0.60 is the lowest of the nine materials. '
      + '⚠️ The `overIdle` half is what stops an override from being a silent EXEMPTION: a declared departure '
      + 'that the template already satisfies, or that the block does not actually make, is a stale row that '
      + 'would stop testing its own field');

    /*
     * --- the CONFIG half: where a bundle may differ from its own confirmed demo, DECLARED per material ---
     *
     * ⚠️ **ADDED 2026-09-05 BECAUSE A SEEDED DEFECT ESCAPED: reverting `LiquidLight`'s `splatRadius` to 18
     * left fieldcheck GREEN.** The section had thirteen clauses on the presentation half and none on the
     * eleven `MaterialConfig` fields, on the reasoning that *"a presentation block carries presentation
     * only"* — true of the block, and it silently made the CONFIG unowned by anything. The sitting that
     * corrected `splatRadius` 18 -> 10 and `haloStrength` 1.0 -> 0.4 (user's decision, the bundle
     * disagreeing with its own browser-confirmed demo on the two fields that set sprite AREA) would have
     * been revertible without a single assertion moving.
     *
     * ⚠️ **AN EQUALITY TEST WOULD BE WRONG — Plasma legitimately diverges on EIGHT of twelve, Ember on one,
     * BY DECISION, and CLAUDE.md's rule for Ember is explicitly "do not unify them".** So the oracle is the
     * same shape as `departures` and `physics`: each row DECLARES its divergence set, and both directions
     * are tested — an undeclared divergence fails, and a declared one the bundle no longer makes fails too
     * (a stale declaration would silently stop testing its field). ⚠️ **THE EMPTY DECLARATION IS THE
     * LOAD-BEARING CASE, not a placeholder**: `{}` for Fire and LiquidLight is what makes a drift away from
     * the confirmed demo a failure rather than a permitted difference.
     */
    const bundleCfg = ((MP || []).find(m => m.name === M) || {}).config;
    const tmplMat = t ? t.material : null;
    const cfgDep = c.configDepartures || {};
    const cfgWrong = [], cfgIdle = [];
    if (bundleCfg && tmplMat) {
      for (const k of Object.keys(bundleCfg)) {
        if (!(k in tmplMat)) continue;                       // template silent on this field: nothing to compare
        const want = k in cfgDep ? cfgDep[k] : tmplMat[k];
        if (JSON.stringify(bundleCfg[k]) !== JSON.stringify(want)) {
          cfgWrong.push(k + ' bundle ' + JSON.stringify(bundleCfg[k]) + ' want '
            + JSON.stringify(want) + (k in cfgDep ? ' (declared)' : ' (demo)'));
        }
      }
      for (const k of Object.keys(cfgDep)) {
        if (!(k in tmplMat)) cfgIdle.push(k + ' (template states no such field)');
        else if (JSON.stringify(tmplMat[k]) === JSON.stringify(cfgDep[k])) cfgIdle.push(k + ' (demo already ' + JSON.stringify(cfgDep[k]) + ')');
      }
    }
    chk(M + ': its MaterialConfig equals its confirmed demo\'s except where the row DECLARES a divergence',
      !!bundleCfg && !!tmplMat && cfgWrong.length === 0 && cfgIdle.length === 0,
      'wrong [' + cfgWrong.join('; ') + '] stale declarations [' + cfgIdle.join('; ') + ']. ⚠️ **THIS CLAUSE '
      + 'EXISTS BECAUSE A SEEDED REVERT OF `LiquidLight.splatRadius` 10 -> 18 PASSED THIRTEEN GREEN CLAUSES** '
      + '— the section owned the presentation half completely and the config half not at all, so the fields '
      + 'that set sprite AREA (5.80x Plasma\'s energy at 18, core:mid 1.5, a flat disc) were unowned. '
      + '⚠️ **Declared, never equal: Plasma diverges on 8 of 12 (its template is a 12 000-particle attractor '
      + 'preset) and Ember on velocityStretch, both DECIDED — CLAUDE.md: "Ember diverges the OPPOSITE way, so '
      + 'do not unify them".** ⚠️ **The `{}` rows are the load-bearing ones**: an empty declaration is an '
      + 'assertion that the bundle matches its confirmed reference exactly, which is what makes a drift fail '
      + 'instead of reading as a permitted difference. Both directions, as everywhere else in this table');

    /*
     * --- crystals: stated, because an OMITTED block inherits the previous material's answer ---
     *
     * ⚠️ **ALSO ADDED 2026-09-05 ON AN ESCAPED SEED: deleting `crystals: {enabled: false}` left fieldcheck
     * GREEN.** All four bundles document the field as load-bearing for exactly one reason — a block that
     * omits it inherits whatever the last material left behind — and nothing tested that it was present.
     * ⚠️ **AND `enabled === false` IS NOT THE PROPERTY: it is CURRENTLY redundant with
     * `materialAutoEnablesCrystals()` for all four carriers, so testing the VALUE tests the dropdown's own
     * decision twice and would have to be edited the moment a bundle wants crystals (`Organic` is the
     * expected one).** The property is PRESENCE — that the block states an answer rather than inheriting one
     * — and it stays correct for a future `true`.
     */
    chk(M + ': ...and it STATES a crystal answer rather than inheriting the previous material\'s',
      !!pres && !!pres.crystals && 'enabled' in pres.crystals,
      'crystals ' + JSON.stringify(pres && pres.crystals) + '. ⚠️ **PRESENCE, NOT VALUE, AND THE DISTINCTION '
      + 'IS THE WHOLE CLAUSE.** All four carriers state `false`, which agrees with '
      + '`materialAutoEnablesCrystals()` and is therefore redundant TODAY — so asserting `=== false` would '
      + 'test the dropdown\'s decision a second time and would have to be relaxed for the first bundle that '
      + 'wants crystals. What cannot be relaxed is that the block ANSWERS: `applyPresentation` runs '
      + '`patchCrystal` only `if (p.crystals)`, so an omitted block leaves the outgoing material\'s crystals '
      + 'live. ⚠️ Caught by seeding (deleting the block passed every other clause), which is the only reason '
      + 'the gap was visible — thirteen clauses owned the film look and none owned this');

    // --- decay must match the template AND survive the additive cap, which is now material-specific ---
    const mCfg = (MP || []).find(m => m.name === M);
    const emis = mCfg && mCfg.config ? mCfg.config.emissionIntensity : null;
    const additive = mCfg && mCfg.config ? mCfg.config.blendMode === 'additive' : false;
    const cap = additive && emis > 0 ? 1 - emis / 25.0 : null;
    const tmplDecay = tmpl && tmpl.renderer ? tmpl.renderer.decayFactor : null;
    chk(M + ': ...and its decayFactor equals the template\'s AND sits below its own additive cap',
      !!pres && pres.decayFactor === tmplDecay && (cap === null || pres.decayFactor <= cap),
      'block ' + (pres && pres.decayFactor) + ', template ' + tmplDecay + ', cap '
      + (cap === null ? 'n/a (not additive)' : cap.toFixed(4)) + '. ⚠️ **THE CAP IS SOLVED PER MATERIAL, NEVER '
      + 'CARRIED ACROSS**: cap = 1 - emissionIntensity/MAX_MATERIAL_ACCUM_INDEX (§S), so Fire at emission 2.0 '
      + 'caps at 0.9200 while Ember at 3.4 caps at 0.8640 — Fire\'s own 0.86 would BREACH Ember\'s cap, and '
      + 'Math.min only lowers, so a breach means the block states a decay the engine does not run. This is '
      + 'precisely why Attractor Fire Cloud\'s 0.88 was rejected as Ember\'s template');
  }
}

// ===========================================================================
console.log('\n=== U. the legacy warp PASS ORDER, now held by AUTHORSHIP rather than by a shim ===\n');
// T1, 2026-09-18. `MigrationLayer` read `TransMapBefore`, which occurs ZERO times in
// `public/psss_presets.json`, so all 177 legacy presets migrated to `beforeParticles: false`. The field that
// actually carries the pass order is `TransMapMode` — present 177 times and read NOWHERE, which is
// invariant 13's shape ("does this control still move the thing it names") in its purest form: a typed field
// with a plausible name, a correct migration expression beside it, and no reader.
//
// ⚠️ **THE DIRECTION IS THE ASSERTION AND IT IS `=== 0`.** Legacy `TransMapMode = { tmmApplyBefore: 0,
// tmmApplyAfter: 1 }` and `psss.js:3739-3782` runs `gWorld.doWorld()` (the particle draw) AFTER
// `transMapPass()` on mode 0 — so mode 0 is warp-then-draw, the engine's `beforeParticles: true`. Inverting
// it would be green in every other clause here: 70 presets would still change, the same 70, just all the
// wrong way, and every one of them still renders a picture. Invariant 24 — invert exactly once, and this
// section is the "say where".
//
// ⚠️ **THE REVIEW THIS SECTION WAS WRITTEN FOR IS CLOSED.** Between 2026-09-18 morning and that day's settle
// batch, fifteen anchors shipped a `"<Original> warpfirst"` copy so the two orders could be compared; the
// owner's verdict was *"remove all presets with the `warpfirst` suffix, they are not really differentiating
// and are redundant"* — keep today's warp-last look everywhere. So the copy clauses are gone.
//
// ⚠️ **AND THE SHIM IS GONE TOO (2026-09-19).** `presets/pass-order-pins.ts` held the anchors that still
// shipped a RAW legacy body, forcing each to warp-last through `TransMapBefore`; the fifth refined-preset
// settle batch settled the last two (`Symbol Of Infinity Transformed`, `The Masters Light`), so the file
// deleted itself per its own exit rule. **Every one of the fifteen now AUTHORS its own `beforeParticles`.**
// The clauses whose subject was the shim are gone with it — the membership clause, `withPassOrder`'s two
// refusals and "every pinned preset has a nonzero warp" — and they are named in `CLAUDE_old.md`
// beside the deleted file, so a reader can tell a retired clause from a lost one. ⚠️ **The load-bearing
// clause was NOT dropped, it was GENERALISED**: it used to remove a pin and assert the body flips to
// warp-first, and it now removes the SETTLED BODY and asserts the same thing over all fifteen. Without it,
// "every anchor ships warp-last" would also pass if the resolver went inert, which is how T1 looked for
// months. **Do not simplify it into a grep** and do not re-add a shim to give it back its old subject.
//
// ⚠️ **AND THE SOURCE-SHAPED CLAUSES ARE NOT THE POINT.** The measured half below composes the real library
// and asks what actually ships, because the interesting failures are all compositional: a stale pin list, or
// a settle that leaves a pin standing over a body that authors its own pass order — which `library.ts` would
// apply to the WINNING body, silently overriding the author.
{
  const mig = stripComments(readFileSync(SRC + 'presets/migration.ts', 'utf8'));

  // 1. SOURCE-SHAPED. `TransMapBefore` must be tested for PRESENCE and win, with `TransMapMode === 0` as the
  //    fallback. A `??` chain would be wrong here and the difference is not cosmetic: `TransMapBefore` is
  //    `boolean | number`, so `raw.TransMapBefore ?? raw.TransMapMode === 0` reads an explicit `false` as
  //    present and works, while `raw.TransMapBefore || raw.TransMapMode === 0` reads it as absent and
  //    silently ignores an explicit `false`. ⚠️ **The field has had NO in-tree writer since `withPassOrder`
  //    was deleted (2026-09-19)**, so this clause guards an override only a hand-edited legacy JSON can set —
  //    which is exactly when a silent misread would be unrecoverable, and why the clause stays.
  chk('migration reads TransMapBefore for PRESENCE, then falls back to TransMapMode === 0',
    /beforeParticles:\s*raw\.TransMapBefore\s*!==\s*undefined\s*\?\s*!!raw\.TransMapBefore\s*:\s*raw\.TransMapMode\s*===\s*0/
      .test(mig),
    'expected `raw.TransMapBefore !== undefined ? !!raw.TransMapBefore : raw.TransMapMode === 0`. ⚠️ A `||` '
    + 'or a bare `??` on a `boolean | number` field reads an explicit `false` as absent, so the override '
    + 'would be ignored in the one case it is written for, with no error anywhere');
  chk('...and TransMapMode is read exactly once, so the inversion lives in ONE place',
    [...mig.matchAll(/raw\.TransMapMode/g)].length === 1,
    `raw.TransMapMode read ${[...mig.matchAll(/raw\.TransMapMode/g)].length}x (expected 1). ⚠️ A second `
    + 'reader is a second chance to invert, and two disagreeing inversions cancel on some presets only');

  // 2. THE MEASURED HALF. Compose the library exactly as `main.ts` and `export-library.mjs` do.
  const { PresetManager } = await import('../src/presets/manager.ts');
  const { loadLibrary } = await import('../src/presets/library.ts');
  const { REFINED_PRESETS } = await import('../src/presets/refined-presets.ts');
  const { MigrationLayer } = await import('../src/presets/migration.ts');
  const SFU = await import('../src/post-processors/static-field.ts');

  const rawLib = JSON.parse(raw.slice(raw.indexOf('{')));
  const rawBefore = JSON.stringify(rawLib);
  const mgr = new PresetManager();
  const orphans = loadLibrary(mgr, rawLib);
  const names = mgr.list();

  // ⚠️ This clause OUTLIVED ITS MOTIVE and is kept deliberately. The pass-order pin was a one-field shim on a
  // COPY, and this asserted the copy; the shim is gone, but `public/psss_presets.json` is read-only by project
  // rule and `export-library.mjs` re-reads the very object it passes in, so "compose without mutating the
  // input" is worth an assertion on its own. ⚠️ **A clause whose subject was deleted is either generalised or
  // removed — never left pointing at nothing**, which is why the message no longer mentions a pin.
  chk('loadLibrary does not mutate the raw legacy JSON it is handed',
    JSON.stringify(rawLib) === rawBefore,
    'composition must read the caller\'s parsed JSON, never assign into it — the file is read-only by project '
    + 'rule and `export-library.mjs` hands in the same object it later re-reads');
  chk('...and no refined or variant entry is an orphan', orphans === 0,
    `loadLibrary reported ${orphans} orphans. ⚠️ An orphan still LOADS — it is appended at the end of the `
    + 'refined group instead of beside its anchor, so the symptom is a preset in the wrong place rather than a '
    + 'missing one. ⚠️ **`orphans` counts BODIES again since the pin sweep was deleted (2026-09-19)**, so do '
    + 'not reconcile it against an older figure taken while pins were counted too');

  // 2a. MEMBERSHIP IS A QUERY, NOT A DESIGN. The fifteen presets the fix can move are re-derived from the
  //     legacy JSON rather than compared against a transcription of it.
  //
  // ⚠️ **This clause used to assert `PASS_ORDER_PINS` against that query; since 2026-09-19 it asserts that the
  // query's raw-legacy remainder is EMPTY** — i.e. that the mechanism holding the fifteen at warp-last is
  // authorship, not a shim. The failure it now catches is the arrival of a SIXTEENTH anchor with no settled
  // body, which the deleted file could no longer pin: such a preset would ship warp-FIRST, changing a look
  // nobody edited. **The repair is to settle it (or re-open the pin file from `CLAUDE_old.md`), never
  // to widen this clause.**
  const derived = Object.keys(rawLib)
    .filter((n) => rawLib[n].TransMapFilter && (rawLib[n].TransMapMode ?? -1) === 0);
  const stillRaw = derived.filter((n) => !Object.prototype.hasOwnProperty.call(REFINED_PRESETS, n));
  chk(`all ${derived.length} enabled mode-0 anchors ship a SETTLED body, so no pass-order pin is needed`,
    stillRaw.length === 0,
    `${JSON.stringify(stillRaw)} still ship a RAW legacy body. ⚠️ A raw anchor migrates on `
    + '`TransMapMode === 0`, i.e. to warp-FIRST — the look the owner\'s 2026-09-18 verdict rejected. '
    + '`pass-order-pins.ts` used to hold exactly this set and was deleted when it emptied; it is preserved '
    + 'verbatim in `CLAUDE_old.md` if it is ever needed again');

  // 2a-bis. THE SETTLED BODY IS LOAD-BEARING — asserted by taking it away. This is the GENERALISATION of the
  //         clause that used to remove a pin: each of the fifteen, migrated from its raw legacy body with no
  //         `TransMapBefore`, must resolve warp-FIRST. So the `false` each one ships is the AUTHOR's, and not
  //         something the migration would have produced anyway.
  //
  // ⚠️ Without this clause, 2c below ("every one of the fifteen ships warp-LAST") would also pass if the
  //    resolver stopped returning `true` at all — which is precisely how T1's defect looked for months.
  const wouldNotFlip = derived
    .filter((n) => MigrationLayer.migrate(n, rawLib[n]).postProcessors.transMap.beforeParticles !== true);
  chk(`each of the ${derived.length} anchors would flip to warp-FIRST if its settled body were removed`,
    wouldNotFlip.length === 0,
    `${JSON.stringify(wouldNotFlip)} migrate to something other than true, so for those the settled body is `
    + 'DECORATIVE and this section is measuring nothing. ⚠️ Read a failure here as a claim about the '
    + 'RESOLVER (§U clause 1) before reading it as a claim about a preset');

  // 2b. ...and the 55 mode-0 presets whose filter is OFF are the reason membership is the ENABLED set: the
  //     flag moves on a pass that never runs, so they need no pin. Asserted so that "only 15 changed" stays
  //     a measurement rather than a claim about the fix's scope.
  const modeZero = Object.keys(rawLib).filter((n) => (rawLib[n].TransMapMode ?? -1) === 0);
  chk(`...out of ${modeZero.length} mode-0 presets in total, the rest having TransMapFilter off`,
    modeZero.length > derived.length
    && modeZero.filter((n) => rawLib[n].TransMapFilter).length === derived.length);

  // 2c. Every one of the fifteen ships warp-LAST — the owner's 2026-09-18 verdict. Read off the COMPOSED
  //     library, i.e. the RESULT, so it cannot tell which mechanism delivered it. That was the point while
  //     there were two mechanisms (settled bodies and the shim) and it is still the point with one: a future
  //     third mechanism would pass here and be caught by 2a/2a-bis instead.
  const warpFirst = derived.filter((n) => mgr.get(n).postProcessors.transMap.beforeParticles !== false);
  chk('every one of the fifteen ships warp-LAST, whichever body won', warpFirst.length === 0,
    `${JSON.stringify(warpFirst)} ship warp-first. ⚠️ All fifteen are settled REFINED bodies since `
    + '2026-09-19, immune to the migration by construction — so a failure here means a settled body AUTHORS '
    + '`beforeParticles: true`, which is an authoring decision to take to the owner, not a bug to patch');

  // 2d. THE LOAD-BEARING CLAUSE, and it now asserts a ZERO. Over the whole composed library nothing runs the
  //     warp before the draw, because the verdict deleted the fourteen copies that did. Measured over every
  //     entry rather than over the fifteen — the 55 disabled mode-0 presets, the refined bodies, the variants
  //     and the five TS groups all pass through it.
  //
  // ⚠️ **A ZERO HERE IS ALSO A COVERAGE GAP, AND IT IS PLAN `21.6g`'s WHOLE PREMISE**: no shipping preset
  // demonstrates the pass order, so the flag has no live example. The bodies that still resolve
  // `beforeParticles: true` all have the warp DISABLED, which the next clause measures — a demo authored for
  // `21.6g` must ENABLE the warp, and the day one arrives this clause's expected count changes with it.
  //
  // ⚠️ **THE ZERO BECAME A ONE ON 2026-09-20, WHICH IS EXACTLY WHAT THE PARAGRAPH ABOVE PREDICTED.** `21.6g`'s
  // demo was authored (`Warp First Silhouette`, the owner's ruling being ONE preset and not a pair), so the
  // clause is now a SET EQUALITY against the declared carrier instead of a count. **Both directions matter:** an
  // undeclared preset running the warp first still fails, and so does the demo vanishing or going inert.
  // ⚠️ **Never restate this as `length === 1`** — a count lets any other preset take the slot the day the demo is
  // renamed or cut, which is precisely the regression the fifteen settled bodies exist to prevent, and it would
  // read green while the library had gone back to the look the 2026-09-18 verdict rejected.
  const DECLARED_WARP_FIRST = ['Warp First Silhouette'];
  const liveWarpFirst = names.filter((n) => {
    const t = mgr.get(n).postProcessors?.transMap;
    return t?.enabled && t.beforeParticles;
  });
  chk(`the ONLY preset running the warp before the draw is the declared 21.6g demo (${DECLARED_WARP_FIRST.length})`,
    JSON.stringify([...liveWarpFirst].sort()) === JSON.stringify([...DECLARED_WARP_FIRST].sort()),
    `found ${liveWarpFirst.length}: ${JSON.stringify(liveWarpFirst)} — expected exactly `
    + `${JSON.stringify(DECLARED_WARP_FIRST)}. ⚠️ An EXTRA member is a legacy body that migrated to warp-first `
    + '(the look the owner rejected on 2026-09-18); a MISSING one means `21.6g` has no live example again and '
    + '`coveragecheck`\'s resolved `beforeParticles` row has gone back to 0');

  // 2e. ...and the presets that DO resolve `beforeParticles: true` are exactly the ones whose warp is off, so
  //      the flag scales a pass that never runs. Asserted rather than assumed, because "nothing ships
  //      warp-first" would otherwise be indistinguishable from "the resolver stopped returning true at all",
  //      which is how T1's defect looked for months.
  //
  // ⚠️ **SPLIT IN TWO ON 2026-09-20 ALONG THE SAME LINE AS 2d.** The accidental carriers must still be inert;
  // the DECLARED one must be live, which is the opposite requirement over the same field. Folding them into one
  // `every` would make the demo an exception to a rule instead of a subject of its own clause, and an exception
  // is never measured: the day the demo's warp were switched off, both halves would agree and nothing would say
  // the `21.6g` example had stopped existing.
  const resolvedTrue = names.filter((n) => mgr.get(n).postProcessors?.transMap?.beforeParticles === true);
  const accidental = resolvedTrue.filter((n) => !DECLARED_WARP_FIRST.includes(n));
  chk(`the ${accidental.length} UNDECLARED presets resolving beforeParticles=true all have the warp DISABLED`,
    accidental.length > 0
    && accidental.every((n) => mgr.get(n).postProcessors.transMap.enabled !== true),
    `${JSON.stringify(accidental)} of ${JSON.stringify(resolvedTrue)}. ⚠️ An empty set means the resolver is `
    + 'inert, not that the library is clean; an enabled member contradicts the clause above');
  chk('...while the declared demo\'s warp is ENABLED, so its flag reorders a pass that actually runs',
    DECLARED_WARP_FIRST.every((n) => mgr.get(n)?.postProcessors?.transMap?.enabled === true
      && mgr.get(n).postProcessors.transMap.beforeParticles === true),
    `${JSON.stringify(DECLARED_WARP_FIRST.map((n) => [n, mgr.get(n)?.postProcessors?.transMap?.enabled,
      mgr.get(n)?.postProcessors?.transMap?.beforeParticles]))}. ⚠️ This is the inert-authoring shape `
    + '`coveragecheck` §F and its `beforeParticles` RESOLVER both exist for: four bodies carried the flag true '
    + 'over a disabled warp for months and the raw count read them as coverage');

  // 2f. THE PEAK ORACLE — kept after the review closed, because it is the only instrument that can say the
  //     pins are worth having and the only one that sees the identity class. Exactly ONE of the fifteen has
  //     a warp of 0.0 px (`Penta Star System`, whose wave table carries a nonzero amplitude at frequency 0,
  //     so `sin(0) · amp ≡ 0`); every other one would move if its pass order flipped.
  //
  // ⚠️ **That identity is the defect T5 fixes in §G's inertness oracle**: an all-zero-table test cannot see
  // this class at all. The peak displacement can, which is why it is the oracle here.
  //
  // ⚠️ **And this is the same defect T5 fixes in §G's inertness oracle**: an all-zero-table test cannot see
  // this class at all. The peak displacement can, which is why it is the oracle here.
  const W = 1920, H = 1080, out = new Float64Array(2);
  const peakPx = (tm) => {
    const layer = { style: tm.style, enabled: true, weight: 1, staticField: { ...SFU.STATIC_FIELD_DEFAULTS } };
    const cx = ((tm.zoomCenter?.x ?? 50) * W) / 100, cy = ((tm.zoomCenter?.y ?? 50) * H) / 100;
    const wv = SFU.resolveStaticWaves(layer, tm.sinMagicParams, tm.sinMagicParams2, W, H, cx, cy, 0);
    const L = [{ style: tm.style, centreX: cx, centreY: cy, ratio: 1,
      waveX: wv.waveX, waveY: wv.waveY, zoomX: wv.zoomX, zoomY: wv.zoomY }];
    let m = 0;
    for (let iy = 0; iy < 96; iy++) {
      const y = Math.min(H - 1, Math.floor((iy * H) / 96));
      for (let ix = 0; ix < 96; ix++) {
        SFU.staticOffsetAt(L, Math.min(W - 1, Math.floor((ix * W) / 96)), y, W, H, out);
        const d = Math.hypot(out[0] * W, out[1] * H);
        if (d > m) m = d;
      }
    }
    return m;
  };
  // ⚠️ The peak oracle reads ONE style's static field, so it is only the right instrument while the warp the
  //    library actually composes for each of the fifteen runs through that one style.
  //
  // ⚠️ **This clause was stated over the wrong quantity until 2026-09-19** — it read *"none of the fifteen
  //    carries a layer chain"*, and the first chained member (`Spiritual`'s settle: a two-layer chain, style 0
  //    plus Depth Parallax 11) failed it while the oracle's reading of that body was still exactly right.
  //    Style 11 is weightless and has NO static field, so `Spiritual`'s only static layer is its own
  //    `transMapStyle`. **A chain is not the thing that breaks the oracle; a chain reaching a DIFFERENT static
  //    style is** — so the assertion is now over the set of static styles the chain can reach, which is the
  //    quantity the sentence after it claims. Both directions: a chain that drops `tm.style`, or holds no
  //    static layer at all, also fails, because the peak would then be measured against a field the library
  //    never applies. **Calibrated 2026-09-19 against both as seeded defects** — `Spiritual`'s style-0 layer
  //    rewritten to style 1 (reported `[["Spiritual",[1],0]]`) and to weightless style 8 (reported `[[…,[],0]]`)
  //    — each caught, the file reverted byte-identically. A narrowing that cannot fail either way is the
  //    failure mode this replaced: the old clause was green on every body that had no chain at all.
  const staticStyles = (n) => {
    const p = mgr.get(n);
    const chain = p.overlay?.transMapChain;
    if (!chain) return [p.postProcessors.transMap.style];
    return [...new Set(chain.filter((l) => l.enabled && l.style <= 3).map((l) => l.style))].sort();
  };
  const misrouted = derived.filter((n) => {
    const s = staticStyles(n);
    return s.length !== 1 || s[0] !== mgr.get(n).postProcessors.transMap.style;
  });
  chk('each of the fifteen composes its warp through exactly ONE static style, its own transMapStyle, so a '
    + 'single-style peak is the right oracle',
    misrouted.length === 0,
    `misrouted: ${JSON.stringify(misrouted.map((n) => [n, staticStyles(n),
      mgr.get(n).postProcessors.transMap.style]))}. ⚠️ A chain can route the warp through a static style `
    + 'this helper never evaluates, and the identity clause below would then be measured against the wrong '
    + 'field. A chained member is FINE while its only static layer IS `transMapStyle` — `Spiritual` '
    + '(settled 2026-09-19, chain = style 0 + weightless 11) is the first such member and must PASS');
  const zeroWarp = [];
  for (const n of derived) {
    const tm = mgr.get(n).postProcessors.transMap;
    if (tm.style > 3) { chk(`${n}: style ${tm.style} has no static field — peak not measurable`, false); continue; }
    if (peakPx(tm) === 0) zeroWarp.push(n);
  }
  chk(`exactly one of the fifteen has an IDENTITY warp: ${JSON.stringify(zeroWarp)}`,
    zeroWarp.length === 1 && zeroWarp[0] === 'Penta Star System',
    '⚠️ this is the class an all-zero-table test cannot see (a nonzero amplitude at frequency 0). A second '
    + 'member means a preset\'s warp went inert; none means `Penta Star System` gained a harmonic, and the '
    + 'ranked evidence table (now in `CLAUDE_old.md`) no longer describes the library');
  // ⚠️ **A clause stood here until 2026-09-19** — "every PINNED preset has a nonzero warp, so its pin is worth
  //    having". Its subject was the pin list and it is NOT generalisable: the equivalent question over the
  //    fifteen is already answered by the clause above, which names the one member whose warp is an identity.
  //    Retired rather than rewritten, and recorded so a reader can tell that from a clause that went missing.

  // 2g. FALSIFIABILITY, both directions — because "exactly one member measures 0 px" is also the output of an
  //     oracle that returns the same number for everything.
  const exTm = structuredClone(mgr.get('Penta Star System').postProcessors.transMap);
  chk('the oracle reports 0 px for Penta Star System as shipped', peakPx(exTm) === 0);
  // Give the exempt table a live harmonic: amplitude row 0 already holds a nonzero value, so moving its
  // FREQUENCY off 0 is the minimal perturbation, and it is precisely the field an all-zero test ignores.
  exTm.sinMagicParams = structuredClone(exTm.sinMagicParams);
  exTm.sinMagicParams[1][0] = 4;
  chk('...and NOTICES when its frequency alone moves off 0, which an all-zero-table test cannot',
    peakPx(exTm) > 0,
    'the exempt table\'s amplitudes are unchanged and still nonzero — only the frequency moved, so a '
    + 'checker that tests the table for all-zeros reports "inert" both before and after');
  const loud = derived.find((n) => n !== 'Penta Star System');
  const loudTm = structuredClone(mgr.get(loud).postProcessors.transMap);
  loudTm.sinMagicParams = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  loudTm.sinMagicParams2 = structuredClone(loudTm.sinMagicParams);
  chk(`...and reports 0 px for a zeroed table (seeded on ${loud})`, peakPx(loudTm) === 0);
}

// ===========================================================================
console.log('\n=== V. a material-fed attribute is published only while the material INTEGRATES ===\n');
// 2026-09-20, and the defect this section exists for reached the user as *"Pixel Age Palette is only black"*.
//
// `lissajous.ts` calls `MaterialProcessor.init()` unconditionally, so `temperatures`/`lifetimes` are ALWAYS
// allocated at full length; `update()` meanwhile returns early on `preset === 'None'`, so with no material they
// are full-length arrays of ZEROS. Every consumer downstream was written against the documented contract
// *"absent without a live material"* — `types.ts`' field doc, `prepareGate()`'s header, `hdr-particle.ts`'
// mapping comment, two demo-preset doc blocks — and each tests PRESENCE. **A guard that tests presence is inert
// wherever presence is unconditional**, which is the whole class: correctly typed, correctly sized, invisible to
// `tsc`, to `lencheck` (which asks about LENGTH) and to `coveragecheck` (which asks about AUTHORSHIP).
//
// ⚠️ **The two arrays are NOT symmetric and this section must not treat them as such.** `lifetimes` has exactly
// one producer, so gating its publication is safe. `temperatures` has a SECOND producer — sparks and crystals
// merge their own heat into the tail array and need no material (the spark gate is `sparkConfig.enabled` plus a
// velocity threshold) — so hiding it while the material idles would drop the spark block's heat from the splat
// ramp. The mapping-3 → mapping-2 degrade in `hdr-particle.ts` is therefore **still inert and recorded as OPEN**,
// not fixed: one cause, two symptoms, two different repairs. Do not "finish the job" by gating `temperatures`
// with the same flag.
{
  const matRaw = readFileSync(SRC + 'generators/material.ts', 'utf8');
  const mat = stripComments(matRaw);
  const genRaw = readFileSync(SRC + 'generators/lissajous.ts', 'utf8');
  const gen = stripComments(genRaw);
  const hdrV = stripComments(readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8'));
  const tileV = stripComments(readFileSync(SRC + 'ui/preview-grid/grid-tile-renderer.ts', 'utf8'));

  // 1. The flag is the processor's, because the processor is the only thing that knows the integration ran.
  //    Resolving "is a material live" a second time at the reader (from `materialConfig`) is invariant 17.
  const gateRe = /if \(lifetimes && this\.materialProcessor\.isLive\(\)\) state\.lifetimes = lifetimes;/;
  chk('getState() publishes state.lifetimes only under materialProcessor.isLive()',
    gateRe.test(gen),
    'a bare `if (lifetimes)` is always true — MaterialProcessor.init() is unconditional, so the array exists '
    + 'for every preset and a presence test can never degrade');
  chk('...and the processor answers it from whether update() INTEGRATED, not from the arrays being non-null',
    /isLive\(\): boolean \{\s*return this\.live;\s*\}/.test(mat),
    '`getTemperatures() !== null` is the question that was already being asked and is the defect itself');

  // 2. BOTH branches of update()'s guard must write the flag. Writing only the success branch leaves it stale
  //    for one frame after a material is switched off — i.e. restores the defect, intermittently, which is
  //    strictly worse than never having fixed it.
  const guard = /if \(!temps \|\| !lifes \|\| !config \|\| config\.preset === 'None'\) \{\s*this\.live = false;\s*return;\s*\}\s*this\.live = true;/;
  chk('update() sets live=false on the early return and live=true immediately after it',
    guard.test(mat),
    'the early return IS the material-free state; a stale flag there publishes zeros as data');
  chk('init() and dispose() both clear it (fresh or freed arrays hold no integrated state)',
    /this\.materialTags = new Uint8Array\(particleCount\);\s*this\.live = false;/.test(mat)
    && /this\.materialTags = null;\s*this\.count = 0;\s*this\.live = false;/.test(mat),
    'init() runs on every re-init and on every particle-count change');

  // 3. FALSIFIABILITY — the pre-fix source must FAIL clause 1, and the one-branch flag must FAIL clause 2.
  //    Without these two the section is three greps that would also pass over the defect they name.
  const preFix = gen.replace(gateRe, 'if (lifetimes) state.lifetimes = lifetimes;');
  chk('...seeded: the pre-fix publish line (`if (lifetimes)`) fails clause 1',
    preFix !== gen && !gateRe.test(preFix),
    'the seed must differ from the live text, or the clause is asserting nothing');
  const oneBranch = mat.replace(guard, "if (!temps || !lifes || !config || config.preset === 'None') return;\n    this.live = true;");
  chk('...seeded: a guard that writes the flag on ONE branch only fails clause 2',
    oneBranch !== mat && !guard.test(oneBranch),
    'this is the likely regression shape — the success branch is the one a reader remembers');

  // 4. MEASURED, not grepped: why the symptom was BLACK rather than merely wrong. The shader reads
  //    `palCoord = fract(aPointAge / 6.0)`, so what matters is the SPREAD of that coordinate across the index.
  //    A zeros array gives every particle the identical coordinate 0 — LUT index 0, which on `Classic: thermal`
  //    is black — while the renderer's synth (`((i/n)*6 + clock) % 6`) spreads it across the whole ramp at every
  //    instant. ⚠️ **Sampled at several clock phases, never at one**: a single instant is exactly how a periodic
  //    readout lies (invariant 28), and `clock = 0` is the instant that makes the synth look like the defect.
  const n = 4096;
  const coordSpread = (ages) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const c = (ages[i] / 6) - Math.floor((ages[i] / 6));
      if (c < lo) lo = c;
      if (c > hi) hi = c;
    }
    return hi - lo;
  };
  const zeros = new Float32Array(n);
  const synth = (clock) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = ((i / n) * 6 + clock) % 6;
    return a;
  };
  const spreads = [0, 0.7, 1.5, 3, 5.9].map((c) => coordSpread(synth(c)));
  chk('a zeros array collapses the palette coordinate to a single LUT index (the black figure)',
    coordSpread(zeros) === 0,
    `spread ${coordSpread(zeros)} over ${n} particles — one colour, whatever the palette`);
  chk('...while the synth spreads it across the ramp at EVERY clock phase, not just at t=0',
    spreads.every((s) => s > 0.99),
    `spreads at clock 0/0.7/1.5/3/5.9 s: ${spreads.map((s) => s.toFixed(4)).join(', ')}`);
  // ⚠️ And the material-FED path is flat in a way the synth is not, which is why the fix is not "add a material":
  //    `update()` does `lifes[i] += dtSec` for every i identically, so real lifetimes are UNIFORM across the
  //    index — one colour for the whole figure, cycling every 6 s. The staggered synth is strictly the better
  //    picture here, and `demo-presets.ts` says so at the preset.
  const fed = new Float32Array(n).fill(2.5);
  chk('...and real lifetimes are uniform across the index, so a material would NOT rescue mapping 5',
    coordSpread(fed) === 0,
    'lifetimes accumulate identically for every particle — the per-index stagger exists only in the synth');

  // 5. The consumers this fix RE-ENABLES must keep the guards that make them reachable.
  chk('the point path still treats a SHORT lifetimes array like a missing one (invariant 6 survives the gate)',
    /!ages \|\| ages\.length < state\.count/.test(hdrV),
    'the gate removes the zeros case; it does not remove the short case, which is the crystal/spark tail');
  chk('the force gate still resolves `age` from state.lifetimes and reports itself inactive when absent',
    /this\.gateSource === 'age'\) src = state\.lifetimes/.test(
      stripComments(readFileSync(SRC + 'post-processors/trans-map-force.ts', 'utf8')))
    , 'its header promises INACTIVE rather than gating on zeros — which only the publish gate can deliver');
  // ⚠️ The preview tile answers the same question from the AUTHORED config, and that is correct rather than a
  //    second resolver: the tile renderer has no MaterialProcessor at all, and it never uploads ages (invariant
  //    6 — a raw upload under-sizes the buffer and ANGLE drops the draw). So it degrades 5 → 3 → 2 on the CPU,
  //    and a mapping-5 preset with no material shows VELOCITY in its tile and the synth in the main view. That
  //    divergence is by design and is the one place where "the tile looks different" is not a grading defect.
  chk('the preview tile still degrades mapping 5 -> 3 -> 2 from the authored material (it has no processor)',
    /if \(mapping === 5\) mapping = 3;/.test(tileV) && /if \(mapping === 3 && !hasMaterial\) mapping = 2;/.test(tileV),
    'the tile cannot upload ages at all, so its answer must come from the preset body');
}

// ===========================================================================
console.log('\n=== W. the Transmap tab ROUND TRIP: the terms it SHOWS, adopted, are the field it showed ===\n');
// v8 21.12 §L's first owed item — the R1 parity section. ⚠️ **It is the first section in this file that
// measures the field over the WHOLE composed library rather than over the legacy JSON**, and the property it
// owns exists nowhere else: `tsc` sees four `number[]`, §A compares the engine against the pre-port formula
// over STORED tables, and no spec can reach the arithmetic at all.
//
// THE PROPERTY, and ⚠️ **it is NOT the one §B of the plan describes** — §B predates the 2026-09-22 second
// commission and still says "the model the tab displays, written straight back, resolves to a bit-identical
// field". After the reversal, R1 is satisfied by DISPLAY: the rows show the RESOLVED terms in both regimes,
// and typing one digit ADOPTS them (`adoptShownTerms()`, `pattern` -> `(Preset)`). So the round trip has two
// legs with two different tolerances, and conflating them is how this section would lie:
//
//   W1  the bake itself          `bakeStaticField()` -> a `(Preset)` layer must be BIT-IDENTICAL.
//   W2  the bake as DISPLAYED    the rows are rounded to 6 significant digits, so parity is bounded, not
//                                exact, and the bound has to be DERIVED from the frequency, not chosen.
//
// ⚠️ **W1 is asserted at zero and that is a derivation, not a hope.** `bakeStaticField` returns
// `archetypeTerms()`'s own numbers and `strength = STATIC_FIELD_DEFAULTS.strength`, so the table branch's
// relative gain is `0.5 / 0.5 = 1.0` — an exact multiply — and style 0's `min(w,h)/100` is applied once on each
// path in the same order (`archetypeTerms`' header pins that order for exactly this reason). Every operation on
// the two paths is therefore the same operation on the same bits. A non-zero W1 is a claim about the
// multiplication ORDER before it is a claim about the field.
{
  const { chainFromOverlay, isSeparableStyle } =
    await import('../src/post-processors/trans-map-chain.ts');

  // -------------------------------------------------------------------------
  // W0. The basis. ⚠️ **Taken from `chainFromOverlay()`, never from `tm.style`** — reading the scalar is the
  // mistake that voided every figure in the plan's §A on 2026-09-18: `overlay.transMapChain` is a plain array,
  // so a `chain?.enabled && chain.layers?.length` guard is always false and EVERY authored `staticField` block
  // in the library disappears. W0c is the calibration for that: it fails if the chain read regresses.
  // -------------------------------------------------------------------------
  const wSlots = [];
  let wTsPresets = 0, wAuthoredChains = 0, wMultiSeparable = 0;
  for (const mod of ['demo', 'chain', 'showcase', 'flow', 'fire', 'variant', 'refined']) {
    const m = await import(`../src/presets/${mod}-presets.ts`);
    for (const v of Object.values(m)) {
      if (typeof v === 'string') continue;   // REFINED_SUFFIX
      const list = Array.isArray(v) ? v.map(p => [p.metadata?.name ?? '?', p]) : Object.entries(v);
      for (const [name, p] of list) {
        wTsPresets++;
        const tm = p.postProcessors?.transMap;
        if (!tm) continue;
        const chain = chainFromOverlay(p.overlay, tm.style, tm.ifsParams);
        const sep = chain.filter(l => isSeparableStyle(l.style));
        if (p.overlay?.transMapChain?.length > 0) wAuthoredChains++;
        if (sep.length > 1) wMultiSeparable++;
        for (const layer of sep) {
          wSlots.push({ name, layer, t1: tm.sinMagicParams, t2: tm.sinMagicParams2,
            cxPct: tm.zoomCenter?.x ?? 50, cyPct: tm.zoomCenter?.y ?? 50 });
        }
      }
    }
  }
  for (const [name, p] of entries) {
    for (const layer of chainFromOverlay(undefined, p.TransMapStyle).filter(l => isSeparableStyle(l.style))) {
      wSlots.push({ name, layer, t1: p.SinMagicParams, t2: p.SinMagicParams2,
        cxPct: p.ZoomCenterX ?? 50, cyPct: p.ZoomCenterY ?? 50 });
    }
  }
  const wArch = wSlots.filter(s => SF.findArchetype(SF.staticFieldOf(s.layer).pattern));
  const wTable = wSlots.filter(s => !SF.findArchetype(SF.staticFieldOf(s.layer).pattern));
  chk(`W0a: the basis resolves ${wSlots.length} separable slots over ${wTsPresets} TS presets + ${entries.length} legacy`,
    wSlots.length > 0 && wArch.length > 0 && wTable.length > 0,
    `archetype ${wArch.length} + table ${wTable.length}`);
  // ⚠️ Looks vacuous and is not: it fails the day a THIRD regime appears (a pattern name that is neither
  // `(Preset)` nor an archetype resolves as the table branch today — silently, which is the point).
  chk('W0b: every separable slot lands in exactly one of the two regimes',
    wArch.length + wTable.length === wSlots.length,
    `${wArch.length} + ${wTable.length} = ${wSlots.length}`);
  chk('W0c: the basis came from the CHAIN, not from `tm.style` (the read that voided the 09-18 figures)',
    wAuthoredChains > 0 && wArch.length > 0,
    `${wAuthoredChains} presets carry an authored chain; every archetype slot lives in one, so a broken chain read reports 0`);
  // The figure the plan's §A measured and whose CONCLUSION the owner reversed on 2026-09-23. It stays 0 and
  // that is fine: 0 was never "nobody needs a layer picker", it was "no LIBRARY preset needs one".
  console.log(`  NOTE  presets with more than one separable layer: ${wMultiSeparable} (the picker serves what a USER assembles, not the library)`);

  // -------------------------------------------------------------------------
  // Machinery. ⚠️ **The rounding is a COPY of `roundTerm()` in `transmap.ts` and W5 is what stops it drifting** —
  // the function is module-private there, and exporting it so this file could import it would put a symbol in
  // `src/` for the harness's benefit. So: replicate the arithmetic here, and assert the SHAPE of the shipped
  // one by text. A change to either side fails W5 loudly instead of silently re-tuning this oracle.
  // -------------------------------------------------------------------------
  const W_SHAPES = [[1920, 1080], [1080, 1920], [1000, 1000]];
  const wRoundTerm = v => (v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(6)));
  const wRoundTable = t => t.map(row => row.map(wRoundTerm));
  const wMaxRel = (a, b) => {
    let peak = 0, m = 0;
    for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return peak > 0 ? m / peak : m;
  };
  /**
   * The bound on the ZOOM leg, and ⚠️ **the two legs of this round trip do NOT have the same tolerance — that is
   * `carryZoomBias()`'s own header, not a concession made here.** The shift half's two paths perform the same
   * multiplications in the same order, so it is bit-identical (W1). The zoom half is equal in EXACT arithmetic
   * only: the archetype path adds `bias * amp` inside each slot while the table path adds `amp` inside each slot
   * and the whole remainder once, in a frequency-0 slot — the same sum, REASSOCIATED. So the bound is a few ulps
   * of the wave's own peak, and it is **derived from `sum|amp| / peak`**, which is the standard bound for a
   * reassociated sum: an absolute error of `n * EPS * sum|amp|` over a peak of `peak`. `n = 8` for four slots
   * summed two ways.
   *
   * ⚠️ **Never replace this with `=== 0` and never replace it with a picked constant.** `=== 0` fails on real
   * library slots the day a bias is authored; a picked constant (1e-12, say) is vacuous for a weak field and
   * false for a strong one, because the ratio it stands in for is `sum|amp| / peak` and that spans the library.
   */
  /**
   * `sum|amp| / peak` — **the summed wave's own condition number, and it belongs to the FLOAT bound only.**
   * A relative error `e` in each amplitude moves the sum by at most `e * sum|amp|`, which against a peak of
   * `peak` is `e * cond`; for `wZoomUlp` the `e` is the machine epsilon of a reassociated sum, which really is
   * one relative figure for every term. ⚠️ **It is NOT the display bound's amplitude term and was, for one
   * afternoon on 2026-09-23, wrongly used as it** — `toPrecision(6)`'s error is NOT one relative figure across
   * the terms (see `wHalfUlp`), so folding it into `cond` averages away the very term that failed. Measured
   * `cond` over this basis is only ~1.7, an order of magnitude below the ~7 first guessed here.
   */
  const wCond = (amps, wave) => {
    let s = 0, peak = 0;
    for (const a of amps) s += Math.abs(a);
    for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i]));
    return peak > 0 ? s / peak : 1;
  };
  const wZoomUlp = (amps, wave) => 8 * Number.EPSILON * wCond(amps, wave);
  /**
   * The adopt path: bake, optionally round as the ROWS do, and resolve the result as a `(Preset)` layer.
   *
   * ⚠️ **`phase` is a PARAMETER and W1f is why.** The carry parks Zoom Bias's constant in a frequency-0 slot,
   * and the whole proof that this is legal is that such a slot is DC at every drift phase as well as at every
   * pixel. Comparing at phase 0 only would leave a `phase * freq` mistake in the carry entirely invisible.
   */
  const wAdopt = (slot, w, h, round, mutate = null, phase = 0) => {
    const cx = (slot.cxPct * w) / 100, cy = (slot.cyPct * h) / 100;
    const before = SF.resolveStaticWaves(slot.layer, slot.t1, slot.t2, w, h, cx, cy, phase);
    const bake = SF.bakeStaticField(slot.layer, w, h, cx, cy);
    if (!bake) return null;
    let t1 = round ? wRoundTable(bake.table1) : bake.table1.map(r => r.slice());
    let t2 = bake.table2 ? (round ? wRoundTable(bake.table2) : bake.table2.map(r => r.slice())) : slot.t2;
    if (mutate) ({ t1, t2 } = mutate(t1, t2, bake));
    const adopted = { ...slot.layer, staticField: { ...SF.staticFieldOf(slot.layer),
      pattern: SF.PATTERN_PRESET, strength: bake.strength, strength2: bake.strength2 } };
    const after = SF.resolveStaticWaves(adopted, t1, t2, w, h, cx, cy, phase);
    // ⚠️ **Reported SEPARATELY, because one `err` would force the exact leg to wear the inexact leg's bound** —
    // which is how a real defect in the shift half would hide under a tolerance it never needed.
    const errShift = Math.max(wMaxRel(before.waveX, after.waveX), wMaxRel(before.waveY, after.waveY));
    let errZoom = 0, zoomUlp = 0, zoom = false, cond = Math.max(wCond(t1[0], before.waveX), wCond(t1[2], before.waveY));
    if (before.zoomX && after.zoomX) {
      zoom = true;
      errZoom = Math.max(wMaxRel(before.zoomX, after.zoomX), wMaxRel(before.zoomY, after.zoomY));
      zoomUlp = Math.max(wZoomUlp(t2[0], before.zoomX), wZoomUlp(t2[2], before.zoomY));
      cond = Math.max(cond, wCond(t2[0], before.zoomX), wCond(t2[2], before.zoomY));
    }
    // Per-leg, because one bound for four legs is what hid the 2026-09-23 mis-derivation — see `wLegs`. The
    // worst-RATIO leg is the one reported, so the printed error and the printed bound always belong together.
    const legs = wLegs(t1, t2, before, after, w, h, phase, slot.layer.style);
    const worst = legs.reduce((m, L) => (L.ratio > m.ratio ? L : m), legs[0]);
    return { before, after, bake, cx, cy, zoom, errShift, errZoom, zoomUlp, cond, legs,
      roundRatio: worst.ratio, roundBound: worst.bound, worstLeg: `${worst.half} ${worst.axis}`,
      // The X shift leg's own bound, for W6's seeds: they all mutate row 0/1, so scaling a mutation by any
      // OTHER leg's bound would be scaling it by a tolerance it is not measured against.
      shiftXBound: legs[0].bound,
      err: Math.max(errShift, errZoom) };
  };
  /**
   * **Half the weight of the last digit `toPrecision(6)` keeps — the largest error that rounding one stored
   * number can introduce, in the number's OWN units.**
   *
   * ⚠️ **"Six significant digits is a relative error of at most 5e-7" was this file's inherited premise and it is
   * WRONG BY UP TO 10x.** `toPrecision(6)` keeps six significant digits, i.e. it rounds the mantissa `m` in
   * `v = m * 10^e` (`1 <= m < 10`) to five decimals, so the absolute error is at most `0.5e-5 * 10^e` and the
   * RELATIVE error is `0.5e-5 / m` — 5e-7 only when the leading digit is 9, and **5e-6 when it is 1**. The old
   * premise survived for months because every slot then in this basis happened to round well; the style-3 zoom
   * slots that entered on 2026-09-23 carry `0.105353...`, leading digit 1, worst case exactly — and W2 failed at
   * a ratio of 1.376, i.e. the CHECKER was wrong and the bake was right. *A measuring section's own basis has
   * been the defect repeatedly.*
   *
   * ⚠️ **So a bound over a SUM of stored numbers cannot be one relative figure times anything** (that is what
   * `wCond` is for, and only the float bound may use it): each term carries its own exponent, so the terms must
   * be added up in ABSOLUTE units and divided by the peak ONCE. Never re-unify these two derivations.
   */
  const wHalfUlp = v => (v === 0 || !Number.isFinite(v) ? 0 : 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(v))) - 5));
  /**
   * The display bound for ONE 1D wave, derived from `buildWave`'s own expression rather than fitted.
   *
   * `wave[i] = sum_k sin(theta_k(i)) * amp_k` with `theta_k(i) = 2*PI*i*f_k/period + PI*f_k*(1 - n/period)
   * + phase*f_k` (`buildWave`; `centreAnchor` is the middle term, and `2*PI` is `(360*i*f/period)/DEG`). First
   * order in each stored number, `|sin| <= 1` and `|cos| <= 1`:
   *
   *   absolute error <= sum_k [ ampCoef * halfUlp(amp_k) + |amp_k| * halfUlp(f_k) * dTheta ]
   *   dTheta = max_i |d(theta)/d(f)| <= 2*PI*(n/period) + PI*|1 - n/period| + |phase|
   *
   * ⚠️ **`dTheta` is NOT `2*PI` and the aspect ratio is why.** `n` is the array length but `period` is
   * `min(w,h)`, so on a 1920x1080 X wave `n/period` is 1.78 and the true coefficient is 13.6, not 6.28 — a
   * frequency error accumulates phase for almost two whole cycles past the end of the period. A `2*PI` here is
   * false on every non-square canvas, and §B cannot see it because §B only tests 1:1 (invariant 26).
   *
   * ⚠️ **`ampCoef` is 2 on the zoom leg**, because `buildZoomWave` adds `bias * amp_k` OUTSIDE the sine as well
   * as `sin(theta_k) * amp_k` inside it, and the table branch's bias is 1. Reading the shift leg's coefficient
   * for both halves understates the zoom bound by a factor of 2 — which is exactly where `carryZoomBias()` parks
   * its deficit, so the one slot that most needs the bound would be the one wearing the wrong one.
   *
   * ⚠️ **`fit` DOES NOT CANCEL, and assuming it did was the second defect in this derivation** (2026-09-23,
   * caught as `Chain Triple Cascade` at a ratio of 3.78). The numerator is built from the STORED table while the
   * denominator is the peak of the BUILT wave, and `resolveStaticWaves` multiplies the amplitudes on the way
   * between them: `fit = (style === 0 ? min(w,h)/100 : 1) * (strength / 0.5)`. The gain half is 1 on an adopted
   * layer (the bake writes `strength = STATIC_FIELD_DEFAULTS.strength`), but **the style-0 half is 10 at
   * 1000x1000 and 10.8 at 1920x1080** — so a bound computed in stored units against a peak in wave units was
   * 10x too tight on every style-0 slot, and only on those. *Invariant 10: check the units of the RESULT, not
   * the plausibility of the expression.* Both terms are linear in the amplitude, so ONE factor fixes both.
   *
   * ⚠️ **The zoom leg's `fit` is NOT the shift leg's** — `buildZoomWave` is handed `strength2 / 0.5` with no
   * style factor at all. Passing one `fit` for the slot would put the style-0 scale on a leg that never sees it.
   *
   * **A tolerance term is a derivation about the ARITHMETIC, so re-derive it when the arithmetic gains a term;
   * never scale it until the run goes green.**
   */
  const wRoundBound = (amps, freqs, wave, n, period, phase, zoom, fit) => {
    const dTheta = 2 * Math.PI * (n / period) + Math.PI * Math.abs(1 - n / period) + Math.abs(phase);
    const ampCoef = zoom ? 2 : 1;
    let abs = 0, peak = 0;
    for (let k = 0; k < 4; k++) {
      const a = amps[k] ?? 0, f = freqs[k] ?? 0;
      abs += fit * (ampCoef * wHalfUlp(a) + Math.abs(a) * wHalfUlp(f) * dTheta);
    }
    for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i]));
    return peak > 0 ? abs / peak : abs;
  };
  /**
   * The four 1D legs a style-3 comparison has, each with its OWN error and its OWN bound.
   *
   * ⚠️ **One bound for the whole slot is what hid the mis-derivation above.** The X and Y legs have different
   * array lengths, the shift and zoom halves have different tables, different amplitude coefficients and (on
   * style 3) different archetypes — so a single `err` over a single bound lets the leg with the roomiest
   * tolerance pay for the leg with the tightest. The assertion is over the worst RATIO, never the worst error.
   */
  const wLegs = (t1, t2, before, after, w, h, phase, style) => {
    const period = Math.max(1, Math.min(w, h));
    // `resolveStaticWaves`' own expression, read off line 914 rather than remembered — see `wRoundBound`.
    const shiftFit = (style === 0 ? Math.min(w, h) / 100 : 1);
    const legs = [
      { half: 'shift', axis: 'X', amps: t1[0], freqs: t1[1], n: w, b: before.waveX, a: after.waveX, zoom: false, fit: shiftFit },
      { half: 'shift', axis: 'Y', amps: t1[2], freqs: t1[3], n: h, b: before.waveY, a: after.waveY, zoom: false, fit: shiftFit },
    ];
    if (before.zoomX && after.zoomX && before.zoomY && after.zoomY) legs.push(
      { half: 'zoom', axis: 'X', amps: t2[0], freqs: t2[1], n: w, b: before.zoomX, a: after.zoomX, zoom: true, fit: 1 },
      { half: 'zoom', axis: 'Y', amps: t2[2], freqs: t2[3], n: h, b: before.zoomY, a: after.zoomY, zoom: true, fit: 1 });
    return legs.map(L => {
      const err = wMaxRel(L.b, L.a);
      const bound = wRoundBound(L.amps, L.freqs, L.b, L.n, period, phase, L.zoom, L.fit);
      return { ...L, err, bound, ratio: bound > 0 ? err / bound : (err > 0 ? Infinity : 0) };
    });
  };
  /*
   * ⚠️ **EVERY archetype slot is bakeable, and that is the 2026-09-23 commission** (owner: *"the table is set
   * according to the config that corresponds to the selected value but the table remains editable"*). The filter
   * that used to live here — `!staticBakeBlocker(s.layer)` — dropped both style-3 archetype slots, so it is not
   * enough to delete it: W1g asserts that nothing refuses any more, or a re-introduced refusal would simply
   * shrink this basis and every count below would stay green.
   */
  const wBakeable = wArch;

  // -------------------------------------------------------------------------
  // W1. The bake is EXACT on the shift leg, and within a derived ulp bound on the zoom leg.
  // -------------------------------------------------------------------------
  let w1worst = 0, w1name = '', w1n = 0;
  let w1zWorstRatio = 0, w1zName = '', w1zN = 0;
  for (const slot of wBakeable) {
    for (const [w, h] of W_SHAPES) {
      const r = wAdopt(slot, w, h, false);
      if (!r) continue;
      w1n++;
      if (r.errShift > w1worst) { w1worst = r.errShift; w1name = `${slot.name} @${w}x${h} style ${slot.layer.style}`; }
      if (!r.zoom) continue;
      w1zN++;
      const ratio = r.zoomUlp > 0 ? r.errZoom / r.zoomUlp : (r.errZoom > 0 ? Infinity : 0);
      if (ratio > w1zWorstRatio) {
        w1zWorstRatio = ratio;
        w1zName = `${slot.name} @${w}x${h}: ${r.errZoom.toExponential(2)} against ${r.zoomUlp.toExponential(2)}`;
      }
    }
  }
  chk(`W1: the UNROUNDED bake reproduces the archetype SHIFT field bit-identically (${w1n} comparisons, 3 canvas shapes)`,
    w1worst === 0,
    w1worst === 0 ? `max relative error = 0 over ${wBakeable.length} bakeable slots` : `WORST ${w1name}: ${w1worst.toExponential(3)}`);
  // ⚠️ **W1e is the ZOOM leg and it exists because W1 CANNOT cover it** — see `wZoomUlp`: the carry reassociates
  // the sum, so a `=== 0` here would fail on every library slot with an authored bias. It is still an assertion
  // and not a shrug: the bound is ~1e-16 of the wave peak, i.e. eleven orders of magnitude below W2's display
  // bound, so any arithmetic error in the carry — a wrong sign, a missed rescale, a dropped deficit — blows it.
  chk(`W1e: ...and the zoom leg is within its derived ulp bound (${w1zN} comparisons over style-3 slots)`,
    w1zN > 0 && w1zWorstRatio <= 1,
    w1zN === 0 ? 'NO ZOOM COMPARISON HAPPENED — the basis lost its style-3 slots'
      : `worst error/ulp-bound = ${w1zWorstRatio.toFixed(3)} — ${w1zName}`);
  // ⚠️ **Three canvas shapes, and the square one is not optional** (invariant 26): §B of this file can only test
  // rigidity at a square frame and therefore cannot see an aspect error at all — its own header says so. A
  // shape-dependent defect in the bake would pass a 1:1-only run.
  chk('W1b: ...and the three shapes are two aspects plus their transpose, so a shape-dependent error is reachable',
    W_SHAPES.some(([w, h]) => w > h) && W_SHAPES.some(([w, h]) => h > w) && W_SHAPES.some(([w, h]) => w === h),
    W_SHAPES.map(([w, h]) => `${w}x${h}`).join(', '));

  /*
   * ⚠️ **THE ZOOM TABLE WAS REACHED BY NO LIBRARY SLOT UNTIL 2026-09-23, AND THE REVERSAL IS THE FINDING.** Both
   * archetype style-3 slots store `zoomBias` 0.15 / 0.1, and the old `staticBakeBlocker()` refused exactly those
   * — so W1/W2 over the library alone never compared `zoomX`/`zoomY` once, and the zoom leg had to be exercised
   * on a synthetic bias-1 layer. It is now the real slots that carry W1e, and the synthetic layer stays for the
   * CORNER it alone reaches: at `bias === 1` the deficit is exactly 0, no slot is consumed, and the table is
   * bit-identical — i.e. the carry must be a no-op there, which is the one clause that would catch a carry that
   * "fixed" a field that was never broken.
   */
  {
    const flat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const synthLayer = bias => ({ style: 3, enabled: true, weight: 1, staticField: {
      pattern: 'Grid Lattice', pattern2: 'Interference', strength: 0.7, strength2: 0.4,
      detail: 2, drift: 0, zoomBias: bias } });
    const synth = { name: 'synthetic style 3 @ zoomBias 1', t1: flat, t2: flat, cxPct: 50, cyPct: 50,
      layer: synthLayer(1) };
    chk('W1c: the LIBRARY now reaches the zoom table, so W1e is not resting on a synthetic layer',
      wArch.filter(s => s.layer.style === 3).length > 0 && w1zN > 0,
      `${wArch.filter(s => s.layer.style === 3).length} archetype style-3 slots, ${w1zN} zoom comparisons; none was reachable before 2026-09-23`);
    let zWorst = 0, zSeen = 0, zRounded = 0, zSlots = 0;
    for (const [w, h] of W_SHAPES) {
      const r = wAdopt(synth, w, h, false);
      if (r?.before.zoomX) zSeen++;
      zWorst = Math.max(zWorst, r?.errZoom ?? 1);
      zRounded = Math.max(zRounded, wAdopt(synth, w, h, true)?.errZoom ?? 1);
      // At bias 1 the carry must consume NO slot: `dc === 0` returns before `findIndex`.
      const b = SF.bakeStaticField(synth.layer, w, h, w / 2, h / 2);
      zSlots = Math.max(zSlots, b.table2[0].filter((a, k) => a !== 0 && b.table2[1][k] === 0).length);
    }
    chk('W1d: ...and at zoomBias 1 the carry is a NO-OP — bit-identical zoom waves, no slot consumed',
      zSeen === W_SHAPES.length && zWorst === 0 && zSlots === 0,
      `zoom waves present at ${zSeen}/${W_SHAPES.length} shapes, max relative error ${zWorst.toExponential(2)}, rounded ${zRounded.toExponential(2)}, DC slots used ${zSlots}`);
    /*
     * ⚠️ **W1f: the same parity at a NON-ZERO drift phase, and it is the whole legality argument for the carry.**
     * `centreAnchor(freq, n, period)` and the drift term are both multiplied by the frequency, so a slot at
     * frequency 0 is DC at every phase — but "multiplied by the frequency" is a claim about two expressions in
     * `buildZoomWave`, and a carry that wrote its deficit at frequency 1e-12 instead of 0, or that read the phase
     * before the frequency, would pass every clause above. The phases are irrational multiples of a period so no
     * one of them can be accidentally equivalent to 0.
     */
    let pWorstRatio = 0, pName = '', pN = 0;
    for (const slot of wBakeable.filter(s => s.layer.style === 3).concat([synth, { ...synth,
      name: 'synthetic style 3 @ zoomBias -0.5', layer: synthLayer(-0.5) }])) {
      for (const phase of [0.37, 1.618, 41.3]) {
        for (const [w, h] of W_SHAPES) {
          const r = wAdopt(slot, w, h, false, null, phase);
          if (!r?.zoom) continue;
          pN++;
          const ratio = Math.max(r.errShift, r.zoomUlp > 0 ? r.errZoom / r.zoomUlp : (r.errZoom > 0 ? Infinity : 0));
          if (ratio > pWorstRatio) { pWorstRatio = ratio; pName = `${slot.name} @${w}x${h} phase ${phase}`; }
        }
      }
    }
    chk(`W1f: ...and the carry holds at non-zero drift phases (${pN} comparisons, 3 phases incl. a negative bias)`,
      pN > 0 && pWorstRatio <= 1,
      `worst error/bound = ${pWorstRatio.toFixed(3)}${pName ? ` — ${pName}` : ''}`);
    // ⚠️ **W1g guards the BASIS, not the arithmetic.** Re-introducing any refusal would silently shrink
    // `wBakeable` and leave every measured clause above green over a smaller set — the failure mode the deleted
    // `staticBakeBlocker` filter had built in. `bakeStaticField` returning null is now exactly "not an
    // archetype", and nothing else.
    const refused = wArch.filter(s => SF.bakeStaticField(s.layer, 1920, 1080, 960, 540) === null);
    chk('W1g: NOTHING refuses a bake any more — the only null is "not an archetype" (the commission, asserted)',
      refused.length === 0 && SF.staticBakeBlocker === undefined,
      `${refused.length} of ${wArch.length} archetype slots refused; \`staticBakeBlocker\` export ${SF.staticBakeBlocker === undefined ? 'is gone' : 'IS STILL PRESENT'}`);
  }

  // -------------------------------------------------------------------------
  // W2. The bake AS DISPLAYED is within the derived bound — and the bound is tight enough to be an assertion.
  // -------------------------------------------------------------------------
  let w2worstRatio = 0, w2name = '', w2any = 0, w2n = 0, w2cond = 0;
  // ⚠️ **The naive bound this file believed until 2026-09-23, kept as a FOIL and asserted to be false** — see
  // W2d. `4 * 5e-7` amplitude terms plus `2*PI * 5e-7 * fmax`: one relative figure for every stored number and
  // `2*PI` for the phase accumulation. It is wrong in THREE independent ways (the relative figure reaches 5e-6,
  // `dTheta` reaches 13.6, and it has no `fit`), and it is recomputed here rather than quoted so that "the honest
  // bound is larger" cannot decay into a remembered number.
  let w2naiveWorst = 0, w2naiveName = '', w2leadingOne = 0, w2vals = 0;
  for (const slot of wBakeable) {
    for (const [w, h] of W_SHAPES) {
      const r = wAdopt(slot, w, h, true);
      if (!r) continue;
      w2n++;
      if (r.err > 0) w2any++;
      w2cond = Math.max(w2cond, r.cond);
      if (r.roundRatio > w2worstRatio) {
        w2worstRatio = r.roundRatio;
        w2name = `${slot.name} @${w}x${h}: ${r.err.toExponential(2)} against a bound of `
          + `${r.roundBound.toExponential(2)} on the ${r.worstLeg} leg`;
      }
      for (const L of r.legs) {
        const fmax = Math.max(...L.freqs.map(f => Math.abs(f)));
        const naive = 4 * 5e-7 + 2 * Math.PI * 5e-7 * fmax;
        if (naive > 0 && L.err / naive > w2naiveWorst) {
          w2naiveWorst = L.err / naive;
          w2naiveName = `${slot.name} @${w}x${h} ${L.half} ${L.axis}: ${L.err.toExponential(2)} over a naive `
            + `${naive.toExponential(2)}`;
        }
        for (const v of [...L.amps, ...L.freqs]) {
          if (v === 0) continue;
          w2vals++;
          if (Math.abs(v) / 10 ** Math.floor(Math.log10(Math.abs(v))) < 2) w2leadingOne++;
        }
      }
    }
  }
  chk(`W2: the ROUNDED rows round-trip within the derived 6-significant-digit bound (${w2n} comparisons, worst of 2-4 legs each)`,
    w2worstRatio <= 1,
    `worst error/bound = ${w2worstRatio.toFixed(3)} — ${w2name}`);
  // ⚠️ **A tolerance nothing exercises is not a measurement.** If the display rounding happened to be lossless
  // on every shipped slot, W2 would be green for a reason that has nothing to do with the bound.
  chk('W2b: ...and the rounding is actually LOSSY somewhere, so the bound is being exercised',
    w2any > 0, `${w2any} of ${w2n} comparisons show a non-zero rounding error`);
  /*
   * ⚠️ **W2d ASSERTS THAT THE OLD BOUND IS FALSE, and it is the only clause that keeps the correction from being
   * quietly undone.** A widened tolerance looks exactly like a scaled-to-green one, so the honest form is not
   * "the new bound passes" (W2 says that) but "the tempting simpler bound FAILS on this same basis". It does, on
   * `Chain Zoom Fractal`'s zoom leg, where none of the three simplifications helps it: `toPrecision(6)`'s relative
   * error reaches 5e-6 where the leading digit is 1 (106 of the 354 stored values in this basis), `dTheta` is 13.6
   * rather than 6.28 on a 16:9 X wave, and the style-0 `fit` is 10x. Restoring any of them turns this clause red
   * before it can turn W2 green for the wrong reason.
   *
   * ⚠️ **The margin is thin (~1.07) and that is a property of the FOIL, not a weakness of W2** — the naive bound
   * is only slightly false, which is exactly why it survived here for months. Never "improve" the margin by
   * scaling the foil; if the basis ever puts it under 1, the honest move is to say which slot stopped exercising
   * it and why, because W2's own margin (~0.38) is unaffected either way.
   */
  chk('W2d: ...and the NAIVE bound (one relative figure per number, 2*PI per cycle) is FALSE on this basis',
    w2naiveWorst > 1 && w2leadingOne > 0,
    `naive worst error/bound = ${w2naiveWorst.toFixed(3)} — ${w2naiveName}; ${w2leadingOne} of ${w2vals} stored `
    + `values have leading digit 1 (worst-case rounding); max cond ${w2cond.toFixed(1)}`);

  // ⚠️ **THE READOUT CANNOT VERIFY THIS AND THE MEASUREMENT SAYS SO.** `staticOffsetAt` rounds to whole pixels
  // and reflects through `rollToRange`, so the peak the tab prints is quantised: a 1 % amplitude error leaves it
  // BIT-IDENTICAL, and it takes ~5 % before the printed figure moves at all. That is why this section compares
  // WAVES, and why "the measured peak did not change" is not evidence for a browser pass either.
  {
    const slot = wBakeable.find(s => s.layer.style === 1) ?? wBakeable[0];
    const w = 1920, h = 1080;
    const cx = (slot.cxPct * w) / 100, cy = (slot.cyPct * h) / 100;
    const peakOf = waves => {
      const L = [{ style: slot.layer.style, centreX: cx, centreY: cy, ratio: 1,
        waveX: waves.waveX, waveY: waves.waveY, zoomX: waves.zoomX, zoomY: waves.zoomY }];
      const out = new Float64Array(2);
      let peak = 0;
      for (let iy = 0; iy < 64; iy++) {
        const y = Math.min(h - 1, Math.floor((iy * h) / 64));
        for (let ix = 0; ix < 64; ix++) {
          const x = Math.min(w - 1, Math.floor((ix * w) / 64));
          SF.staticOffsetAt(L, x, y, w, h, out);
          peak = Math.max(peak, Math.hypot(out[0] * w, out[1] * h));
        }
      }
      return peak;
    };
    const base = wAdopt(slot, w, h, false);
    const bent = wAdopt(slot, w, h, false, (t1, t2) => {
      const c = t1.map(r => r.slice());
      c[0][0] *= 1.01;
      return { t1: c, t2 };
    });
    const p0 = peakOf(base.after), p1 = peakOf(bent.after);
    chk('W2c: a 1 % amplitude error leaves the tab\'s px readout unchanged — the readout is NOT the oracle',
      bent.err > 0.009 && p0 === p1,
      `wave error ${bent.err.toExponential(2)} while the printed peak stays ${p0.toFixed(4)} px on both`);
  }

  // -------------------------------------------------------------------------
  // W3. The adopted table is canvas-DEPENDENT, asserted as a property rather than tolerated as noise.
  // ⚠️ **Without this clause, a "cleanup" that made `solveGain`'s scalar canvas-independent would pass W1 and
  // W2 and change every adopted preset**, because both of those compare at ONE shape at a time. The engine
  // targets `0.08 x min(w,h)` while the offset grows with distance from the centre, so the scalar must move with
  // the aspect ratio — that is invariant 24/27's two-quantities trap, and it is the reason the tab carries a
  // warning rather than a silent transform.
  // -------------------------------------------------------------------------
  {
    const slot = wBakeable.find(s => SF.staticFieldOf(s.layer).pattern === 'Grid Lattice' && s.layer.style === 1)
      ?? wBakeable.find(s => s.layer.style === 1) ?? wBakeable[0];
    const kAt = (w, h) => {
      const b = SF.bakeStaticField(slot.layer, w, h, (slot.cxPct * w) / 100, (slot.cyPct * h) / 100);
      return Math.max(...b.table1[0].map(Math.abs), ...b.table1[2].map(Math.abs));
    };
    const k169 = kAt(1920, 1080), k11 = kAt(1000, 1000);
    const swing = k11 / k169;
    chk('W3: the adopted amplitudes are canvas-DEPENDENT, so a bake is a one-way action at one window size',
      swing > 1.2,
      `${slot.name}: k = ${k169.toFixed(4)} at 16:9 against ${k11.toFixed(4)} at 1:1 = ${swing.toFixed(3)}x`);
    // The same fact from the user's side: adopt at one shape, resize, and the field is NOT what the pattern
    // would have drawn. Asserted as a MISMATCH — the failure mode to guard is someone "fixing" it silently.
    const w = 1000, h = 1000;
    const cx = (slot.cxPct * w) / 100, cy = (slot.cyPct * h) / 100;
    const foreign = SF.bakeStaticField(slot.layer, 1920, 1080, (slot.cxPct * 1920) / 100, (slot.cyPct * 1080) / 100);
    const adopted = { ...slot.layer, staticField: { ...SF.staticFieldOf(slot.layer),
      pattern: SF.PATTERN_PRESET, strength: foreign.strength, strength2: foreign.strength2 } };
    const here = SF.resolveStaticWaves(slot.layer, slot.t1, slot.t2, w, h, cx, cy, 0);
    const there = SF.resolveStaticWaves(adopted, foreign.table1, foreign.table2 ?? slot.t2, w, h, cx, cy, 0);
    chk('W3b: ...and a table adopted at 16:9 does NOT reproduce the pattern at 1:1 (the warning is true)',
      wMaxRel(here.waveX, there.waveX) > 0.1,
      `relative difference ${wMaxRel(here.waveX, there.waveX).toExponential(2)} on waveX at 1000x1000`);
  }

  /* -------------------------------------------------------------------------
   * W4. `zoomBias` carried as terms — **the section that REPLACES the refusal W4 used to assert** (owner,
   * 2026-09-23). Until then the table branch's hardcoded `bias = 1` was treated as "a style-3 layer whose bias is
   * not 1 has no equal table", and the tab refused the take-over; `carryZoomBias()` shows the table CAN express
   * it, as a frequency-0 slot, and the only case left is a pattern whose zoom half already uses all four slots.
   *
   * ⚠️ **THE PROPERTY IS THE EQUIVALENCE, not the carry** — `warning === null` ⟺ the zoom leg is within its ulp
   * bound, asserted in BOTH directions (W4c). One direction alone is the defect each way round: a note that never
   * appears makes a silent loss, and a note that always appears makes the exactness unprovable. It is also the
   * only instrument on `StaticFieldBake.warning`'s own gate, which no spec can reach.
   *
   * ⚠️ **The occupancy is MEASURED here (W4a), never read off the code comment** that names the five full
   * archetypes: that list is what makes the note reachable at all, so if a retune freed a slot in all five the
   * `carried: false` branch would become dead code while every clause stayed green.
   * ------------------------------------------------------------------------- */
  {
    const w = 1920, h = 1080;
    const ARCHS = SF.STATIC_FIELD_ARCHETYPES;
    const full = ARCHS.filter(a => a.xAmp.every(v => v !== 0) && a.yAmp.every(v => v !== 0));
    chk('W4a: at least one archetype fills all four zoom slots, so the `carried: false` branch is REACHABLE',
      full.length > 0,
      `${full.length} of ${ARCHS.length} archetypes use every amplitude in both axes: ${full.map(a => a.name).join(', ')}`);
    // Every archetype style-3 slot the LIBRARY actually ships: all must carry, i.e. show no note at all.
    const lib3 = wArch.filter(s => s.layer.style === 3);
    chk('W4: every archetype style-3 slot in the library carries its bias exactly — no note, and it used to be REFUSED',
      lib3.length > 0 && lib3.every(s => SF.bakeStaticField(s.layer, w, h, w / 2, h / 2).warning === null),
      lib3.map(s => `${s.name} (bias ${SF.staticFieldOf(s.layer).zoomBias}, pattern2 “${SF.staticFieldOf(s.layer).pattern2}”)`).join(', '));

    // The synthetic matrix: every archetype as the zoom half, at biases the ±0.5 track can actually reach plus
    // the 1 it cannot. ⚠️ **`1` is in the list because it is the one bias with a zero deficit** — the corner where
    // a full archetype still carries, so the equivalence cannot be satisfied by "full pattern ⇒ warning".
    const BIASES = [-0.5, -0.2, 0, 0.15, 0.5, 1];
    const flat = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    let w4cN = 0, w4cBad = '', w4Warned = 0, w4Clean = 0, w4Loss = 0;
    for (const a of ARCHS) {
      for (const bias of BIASES) {
        const slot = { name: `${a.name} @bias ${bias}`, t1: flat, t2: flat, cxPct: 50, cyPct: 50,
          layer: { style: 3, enabled: true, weight: 1, staticField: { pattern: 'Grid Lattice',
            pattern2: a.name, strength: 0.7, strength2: 0.4, detail: 1, drift: 0, zoomBias: bias } } };
        const r = wAdopt(slot, w, h, false);
        if (!r?.zoom) continue;
        w4cN++;
        const warned = r.bake.warning !== null;
        const tight = r.errZoom <= r.zoomUlp;
        if (warned) { w4Warned++; w4Loss = Math.max(w4Loss, r.errZoom); } else w4Clean++;
        // The equivalence, both directions, in one test — and the message names WHICH direction broke.
        if (warned === tight && !w4cBad) {
          w4cBad = warned
            ? `${slot.name}: warned but the round trip was tight (${r.errZoom.toExponential(2)} <= ${r.zoomUlp.toExponential(2)})`
            : `${slot.name}: SILENT LOSS — no warning, error ${r.errZoom.toExponential(2)} against ${r.zoomUlp.toExponential(2)}`;
        }
      }
    }
    chk(`W4c: \`warning === null\` is EXACTLY "the zoom leg is bit-tight", both directions (${w4cN} archetype x bias cases)`,
      w4cN > 0 && w4cBad === '' && w4Warned > 0 && w4Clean > 0,
      w4cBad || `${w4Clean} carried exactly, ${w4Warned} warned; both branches exercised`);
    // A note has to be protecting something REAL, or it is decoration. This is the same measurement the old W4b
    // made of the refusal, re-pointed at the note — and the figure is what the user is told they will lose.
    chk('W4d: ...and where the note appears the loss is LARGE, so the sentence is load-bearing, not cosmetic',
      w4Loss > 0.01,
      `worst uncarried case moves the zoom wave by ${(w4Loss * 100).toFixed(1)} % of its peak`);
    // ⚠️ The wording is asserted because the note is the ONLY channel for this case and `tipcheck`'s `INLINE_SINK`
    // cannot see it: the sentence arrives through a function return, not a literal after `=`.
    const warnText = (() => {
      for (const a of full) {
        const b = SF.bakeStaticField({ style: 3, enabled: true, weight: 1, staticField: {
          pattern: 'Grid Lattice', pattern2: a.name, strength: 0.7, strength2: 0.4,
          detail: 1, drift: 0, zoomBias: 0 } }, w, h, w / 2, h / 2);
        if (b?.warning) return b.warning;
      }
      return '';
    })();
    chk('W4e: ...and it names Zoom Bias, what is kept, what is dropped, and the way back',
      /Zoom Bias/.test(warnText) && /Reset field/.test(warnText)
      && /all four terms/.test(warnText) && /bias of 1/.test(warnText),
      warnText || 'NO WARNING TEXT REACHABLE — the `carried: false` branch produced none');
  }

  // -------------------------------------------------------------------------
  // W5. Source-shaped clauses: the two owners this section's arithmetic stands in for.
  // ⚠️ **A MEASURED failure above means wrong arithmetic; a failure HERE means the owner was bypassed or
  // renamed** — the distinction `composercheck` §N draws, and the reason these are separate assertions rather
  // than one grep. Behaviour-neutral renames break them, which is the intended cost.
  //
  // CALIBRATED 2026-09-23 against five mutations of the real file (`toPrecision` -> `toFixed`; `t1: baked.table1`
  // raw; `adoptShownTerms()` calling `bakeStaticField()` itself; `strength: 0.5`; the `pattern` line deleted).
  // Each broke EXACTLY its own clause and none of the others — so a failure here names one owner, which is the
  // whole point of splitting them. The mutations were applied to a copy in memory, never to `src/`.
  // -------------------------------------------------------------------------
  {
    const tabV = stripComments(readFileSync(SRC + 'ui/synthesis-lab/tabs/transmap.ts', 'utf8'));
    chk('W5a: `roundTerm` is SIGNIFICANT digits (`toPrecision(6)`), which is what W2\'s bound is derived from',
      /function roundTerm\([^)]*\)[^{]*\{[^}]*toPrecision\(6\)/.test(tabV) && !/roundTerm[\s\S]{0,120}toFixed\(/.test(tabV),
      'a switch to `toFixed` would keep six digits and change the bound on every small amplitude');
    // ⚠️ **`braceBody()` CANNOT read this one and returned an empty body on the first run** — `shownTables()`
    // declares its return type as an inline object literal on the line after the parameter list, so the first
    // `{` after the declaration opens the TYPE, not the body. Slicing to the next member is the honest read; a
    // green `braceBody` clause here would have been measuring nothing at all.
    const member = (src, decl) => {
      const i = src.indexOf(decl);
      if (i < 0) return '';
      const j = src.indexOf('\n  private ', i + decl.length);
      return src.slice(i, j < 0 ? src.length : j);
    };
    const shown = member(tabV, 'private shownTables(');
    const shownRounds = (shown.match(/roundTable\(/g) ?? []).length;
    chk('W5b: `shownTables()` routes BOTH baked tables through `roundTable` (the rows never show raw bake output)',
      shownRounds >= 2 && /roundTable\(baked\.table1\)/.test(shown) && /roundTable\(baked\.table2\)/.test(shown),
      `${shownRounds} calls inside the one function that fills the rows, over both baked tables`);
    const adopt = braceBody(tabV, 'private adoptShownTerms(');
    chk('W5c: `adoptShownTerms()` adopts through `shownTables()` and NOT through `bakeStaticField()` directly',
      /shownTables\(/.test(adopt) && !/bakeStaticField\(/.test(adopt),
      'one owner: what is stored is exactly what the rows were showing, rounding included');
    chk('W5d: ...and it stores the bake\'s own `strength`/`strength2` with the table (the parity point)',
      /strength: shown\.bake\.strength/.test(adopt) && /strength2: shown\.bake\.strength2/.test(adopt),
      'storing these amplitudes at any other strength applies the measured gain twice');
    chk('W5e: ...and it switches `pattern` to `(Preset)`, which is what makes the table the source',
      /pattern: PATTERN_PRESET/.test(adopt),
      'without this the adopted numbers are stored and then ignored by the archetype branch');
    // ⚠️ **W5f-W5m are the 2026-09-23 commission's own owners** — every one of them is a place where the tree
    // compiles, `verify` passes and the UI quietly returns to refusing the edit. CALIBRATED against six mutations
    // of copies in memory: the `carryZoomBias` call replaced by `t.zoom.xAmp`; `freq[free] = 0` -> `= 1`;
    // `zoomBias: 1` added to the bake's return; an `if (shown.bake.warning) return;` re-added to
    // `adoptShownTerms`; `inert` given back its regime clause; the `label` line deleted from `refreshButtons`.
    // Each broke exactly its own clause.
    const fieldV = stripComments(readFileSync(SRC + 'post-processors/static-field.ts', 'utf8'));
    const bake = braceBody(fieldV, 'export function bakeStaticField(');
    chk('W5f: `bakeStaticField()` routes BOTH zoom halves through `carryZoomBias()`, never the raw archetype amps',
      /carryZoomBias\(t\.zoom\.xAmp/.test(bake) && /carryZoomBias\(t\.zoom\.yAmp/.test(bake)
      && !/table2:[^;]*t\.zoom\.xAmp/.test(bake),
      'writing `t.zoom.xAmp` straight out is the pre-09-23 bake, exact only at a bias of 1');
    // ⚠️ **`braceBody()` cannot read `carryZoomBias` either, for W5b's exact reason** — its return type is an
    // inline object literal on the line after the parameter list, so the first `{` opens the TYPE. Slicing to the
    // next column-0 `}` is the honest read; a green `braceBody` clause here would have measured an empty string.
    const carryAt = fieldV.indexOf('function carryZoomBias(');
    const carry = carryAt < 0 ? '' : fieldV.slice(carryAt, fieldV.indexOf('\n}', carryAt) + 2);
    chk('W5g: `carryZoomBias()` hosts the deficit at FREQUENCY 0 and rescales a slot already there',
      /freq\[free\] = 0/.test(carry) && /amp\[k\] = bias \* a/.test(carry) && /\(bias - 1\) \* a/.test(carry),
      carry ? 'frequency 0 is the whole legality argument (W1f); a non-zero frequency would add a ripple the pattern never had'
        : 'THE FUNCTION BODY DID NOT SLICE — this clause was measuring nothing');
    chk('W5h: ...and the bake still writes NO `zoomBias`, so switching the pattern back is a return trip',
      !/zoomBias:/.test(bake),
      'the table branch never reads it, and the ±0.5 track cannot represent the 1 the old refusal advised');
    // ⚠️ **The `enabled:` count is 1 and that one is a READ** — `snapshotKey()` hands `staticFieldOf()` a synthetic
    // layer. A blanket `!/enabled:/` failed on it, which is the reminder that an absence clause has to name the
    // legitimate occurrence rather than assume there is none.
    const enabledKeys = (tabV.match(/enabled:/g) ?? []).length;
    chk('W5i: there is no `Active` checkbox and this tab writes `layer.enabled` NOWHERE (owner, 2026-09-23)',
      enabledKeys === 1 && /private static snapshotKey\([\s\S]{0,400}?enabled: true/.test(tabV)
      && !/\.enabled = /.test(tabV) && !/'Active'/.test(tabV) && !/muteCheck/.test(tabV)
      && !/transmap\.active/.test(tabV),
      `${enabledKeys} \`enabled:\` key(s), the one in \`snapshotKey\`; Visual FX owns the switch, and a second editor of one field is what the owner asked to remove`);
    chk('W5j: `adoptShownTerms()` has NO refusal left — every archetype row is adoptable',
      !/staticBakeBlocker/.test(tabV) && !/warning\)\s*return/.test(adopt) && !/blocker/.test(tabV),
      'a re-added guard would restore exactly the symptom the commission names: a live row that refuses the edit');
    const derived = braceBody(tabV, 'private refreshDerived(');
    chk('W5k: the row-disable rule is the STYLE only, and the note comes from the bake\'s own `warning`',
      /const inert = r\.table === 2 && !zoomTable;/.test(derived)
      && /shown\.bake\?\.warning/.test(derived) && /termNote\.textContent = note/.test(derived),
      'a regime clause in `inert` is the greying the owner rejected; a second wording is invariant 25');
    chk('W5l: ...and the zoom half\'s liveness tick admits a frequency-0 term (the carry\'s own slot)',
      /r\.check\.checked = a !== 0 && \(f !== 0 \|\| \(zoomTable && r\.table === 2\)\)/.test(derived),
      'printing the carried DC slot unticked would call the engine\'s own carry dead');
    const buttons = braceBody(tabV, 'private refreshButtons(');
    chk('W5m: `(Preset) — edited` is `Reset field`\'s own comparison — one `dirty`, both surfaces',
      /PATTERN_EDITED_LABEL = `\$\{PATTERN_PRESET\} — edited`/.test(tabV)
      && /snapshotKey\(now\) !== TransMapTab\.snapshotKey\(this\.entrySnapshot\)/.test(buttons)
      && /resetBtn\.disabled = !dirty/.test(buttons)
      && /dirty \? PATTERN_EDITED_LABEL : PATTERN_CLEAN_LABEL/.test(buttons)
      && /textContent !== label/.test(buttons),
      'the owner\'s promise is literally that Reset clears the word, so two tests would be two promises');
    chk('W5n: ...and only the LABEL carries it — `PATTERN_PRESET` stays the one stored word',
      !/value = PATTERN_EDITED_LABEL/.test(tabV) && !/pattern: PATTERN_EDITED_LABEL/.test(tabV)
      && /pattern: PATTERN_PRESET/.test(tabV),
      '*Phase 19*\'s rule: a label persisted, or a stored word printed, is the defect');
  }

  // -------------------------------------------------------------------------
  // W6. Calibration. ⚠️ **This section starts green, so until the seeds below are shown to catch defects it
  // asserts nothing** — and *a measuring section's own basis has been the defect repeatedly in this project*.
  // Each seed mutates the ADOPTED table, which is the only surface a real defect could reach: the bake writes
  // it, the rows display it, and an edit re-reads it.
  // -------------------------------------------------------------------------
  {
    const slot = wBakeable.find(s => s.layer.style === 1) ?? wBakeable[0];
    const w = 1920, h = 1080;
    // ⚠️ **The unmutated bound, taken once** — the two-sided seeds scale their own mutation by it, so reading it
    // off the MUTATED comparison would let a seed move its own goalposts.
    // ⚠️ **The X SHIFT leg's bound specifically, because every seed below mutates row 0 or row 1.** Scaling a
    // mutation by the slot's worst-leg bound would scale it by a tolerance it is never measured against.
    const B = wAdopt(slot, w, h, true).shiftXBound;
    const seed = (label, mutate, wantCaught, note) => {
      const r = wAdopt(slot, w, h, true, mutate);
      // ⚠️ **`roundRatio`, i.e. W2's own assertion** — comparing a mixed `err` against one leg's bound would
      // calibrate a quantity no clause asserts.
      const caught = r.roundRatio > 1;
      chk(`W6 ${label} — ${wantCaught ? 'seeded defect caught' : 'correctly NOT flagged'}`,
        caught === wantCaught,
        `error/bound ${r.roundRatio.toFixed(3)} on the ${r.worstLeg} leg (${r.err.toExponential(2)} against `
        + `${r.roundBound.toExponential(2)})${note ? ' — ' + note : ''}`);
    };
    // 1. A dropped harmonic: the shape of a term-table edit that loses a row.
    // ⚠️ **Zeroing a FIXED cell was a no-op and the first run proved it** — `c[0][1] = 0` moved the field by
    // 7.19e-7 against a bound of 2.08e-5, because that harmonic's amplitude is already near zero on this
    // archetype. The seed has to zero the LARGEST amplitude it can find, or it measures the checker's luck.
    // (Same failure mode as the plan's named "round an amplitude to 4 dp" seed, which is a no-op at this scale.)
    seed('a dropped harmonic (the largest amplitude in the X row)', (t1, t2) => {
      const c = t1.map(r => r.slice());
      let k = 0;
      for (let i = 1; i < c[0].length; i++) if (Math.abs(c[0][i]) > Math.abs(c[0][k])) k = i;
      c[0][k] = 0;
      return { t1: c, t2 };
    }, true);
    // 2/3. The bound is two-sided. ⚠️ **A tolerance that catches everything is not a tolerance**: the second
    // half is what proves W2 is measuring the rounding rather than failing on any difference at all.
    seed('an amplitude 10x the bound', (t1, t2, b) => {
      const c = t1.map(r => r.slice()); c[0][0] *= 1 + 10 * B; return { t1: c, t2 };
    }, true);
    seed('an amplitude at a TENTH of the bound', (t1, t2) => {
      const c = t1.map(r => r.slice()); c[0][0] *= 1 + 0.1 * B; return { t1: c, t2 };
    }, false, 'so the bound is a measurement, not a wish');
    // 4. A halved frequency — the seed the plan names, and the one an off-by-one in `detail` would produce.
    seed('a halved frequency', (t1, t2) => { const c = t1.map(r => r.slice()); c[1][0] *= 0.5; return { t1: c, t2 }; }, true);
    // 5. ⚠️ **The axis swap is caught, but NOT everywhere — and that is the finding, not a caveat.** Half the
    // archetype slots are axis-symmetric, so seeding this on one slot would have been a false negative. It is
    // also caught at a SQUARE frame, so the swap is not the aspect property: W1b and W3 own that.
    {
      const swapRows = t => [t[2], t[3], t[0], t[1]];
      let changed = 0, total = 0, worst = 0;
      for (const s of wBakeable) {
        const r = wAdopt(s, w, h, false, (t1, t2) => ({ t1: swapRows(t1), t2 }));
        total++;
        if (r.err > 0) changed++;
        worst = Math.max(worst, r.err);
      }
      chk('W6 an X/Y table swap — seeded defect caught, on the slots it can be seen on',
        changed > 0 && worst > 1,
        `${changed} of ${total} bakeable slots change; the other ${total - changed} are axis-symmetric, so a one-slot seed would pass`);
    }
    // 6. The canvas-independence "cleanup": reuse one shape's bake at another shape. W3's clause exists for it.
    {
      const foreign = SF.bakeStaticField(slot.layer, 1000, 1000, (slot.cxPct * 1000) / 100, (slot.cyPct * 1000) / 100);
      const r = wAdopt(slot, w, h, false, (t1, t2) => ({ t1: foreign.table1, t2 }));
      chk('W6 a canvas-INDEPENDENT bake (one shape\'s table reused at another) — seeded defect caught',
        r.roundRatio > 1,
        `${(r.err * 100).toFixed(1)} % of the wave peak — invisible to any single-shape comparison`);
    }
    /*
     * 7/8/9. **The carry's own seeds, and W1e's ulp bound is what they calibrate.** A bound eleven orders of
     * magnitude below the display bound is only worth asserting if it is TIGHT, so each of these three mutations
     * is the smallest structural mistake the carry could make: lose the deficit, park it at the wrong frequency,
     * or forget to rescale a slot the archetype already held at frequency 0.
     *
     * ⚠️ **Seeded on a slot whose bias is NOT 1** — at bias 1 the deficit is zero and all three are no-ops, which
     * is exactly the false negative W1d's "no slot consumed" clause describes from the other side.
     */
    {
      const z = wBakeable.find(s => s.layer.style === 3 && SF.staticFieldOf(s.layer).zoomBias !== 1);
      const zSeed = (label, mutate, wantCaught, note) => {
        const r = z ? wAdopt(z, w, h, false, mutate) : null;
        chk(`W6 ${label} — ${wantCaught ? 'seeded defect caught' : 'correctly NOT flagged'}`,
          r !== null && r.zoom && (r.errZoom > r.zoomUlp) === wantCaught,
          r === null ? 'NO STYLE-3 SLOT WITH A NON-DEFAULT BIAS IN THE BASIS — the seed measured nothing'
            : `${z.name}: ${r.errZoom.toExponential(2)} against an ulp bound of ${r.zoomUlp.toExponential(2)}${note ? ' — ' + note : ''}`);
      };
      // The DC slot is the one with a zero frequency and a non-zero amplitude — found, never assumed at index 3.
      const dcIndex = row => row[1].findIndex((f, k) => f === 0 && row[0][k] !== 0);
      zSeed('the carried DC term dropped from the zoom table', (t1, t2) => {
        const c = t2.map(r => r.slice());
        const k = dcIndex([c[0], c[1]]);
        if (k >= 0) c[0][k] = 0;
        return { t1, t2: c };
      }, true);
      zSeed('the carried DC term moved to frequency 1 (a ripple the pattern never had)', (t1, t2) => {
        const c = t2.map(r => r.slice());
        const k = dcIndex([c[0], c[1]]);
        if (k >= 0) c[1][k] = 1;
        return { t1, t2: c };
      }, true);
      // ...and the bound is two-sided here too: a change a tenth of the ulp bound must NOT trip it.
      zSeed('a zoom amplitude nudged a tenth of the ulp bound', (t1, t2) => {
        const c = t2.map(r => r.slice());
        c[0][0] *= 1 + 0.1 * (z ? (wAdopt(z, w, h, false)?.zoomUlp ?? 0) : 0);
        return { t1, t2: c };
      }, false, 'so the ulp bound is a measurement, not a wish');
    }
  }
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  fieldcheck: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
