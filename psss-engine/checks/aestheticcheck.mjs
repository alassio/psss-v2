// v8 step 11.1's surviving fragment: a headless DEGENERACY score, so a collapsed figure is caught by a
// checker instead of by a user.
//
// ⚠️ **THE JUSTIFYING MISS, AND WHY IT SHAPES THE CHECKER'S SCOPE.** `Mandelbrot Lightning` shipped, was
// reported by a user as *"just a noisy flow field"*, and was deleted on 2026-08-13. Its signature was an
// escape field with an escape range of **3.67** over the whole 512² grid — a near-CONSTANT field, so the
// gradient particles flow perpendicular to was both tiny and pointed almost the same way everywhere.
//
// ⚠️ **The metric 11.1 actually proposed — box-counting dimension + spatial entropy — CANNOT catch that
// preset, and the measurement is the reason this file is shaped the way it is rather than the way the phase
// text described.** Measured over all 35 attractor presets, Lightning scores **dim 1.859 / ent 0.861 — the
// HIGHEST of the whole set** (against `Mandelbrot Starfish`, a kept preset, at 1.848 / 0.830). A uniform
// drift fills the frame beautifully while carrying no followable structure at all. That is V7c's lesson in
// another form: *a measurement that is high can still be the wrong measurement.* So the occupancy metrics
// are NOT asserted as a library-wide quality floor here — see the two sections below for what each half
// does instead.
//
// ⚠️ **Scope: a checker, not a pipeline** (the phase plan's own banner). It answers pass/fail on figures that
// are already authored. It has no optimiser, no search and no scoring loop over candidates; the moment it
// acquires one it is step 11.2 by another name.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const { LissajousGenerator } = await import('../src/generators/lissajous.ts');
const { MigrationLayer } = await import('../src/presets/migration.ts');
const {
  escapeFieldStats, ATTRACTOR_PRESETS,
  createAttractorState, initAttractorState, iterateAttractor, attractorHalfExtent,
} = await import('../src/generators/attractors.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

// ---------------------------------------------------------------------------------------------------
// Occupancy metrics — box-counting fractal dimension and normalised spatial entropy of the PROJECTED
// screen positions, accumulated over a fixed sampling window.
// ---------------------------------------------------------------------------------------------------
//
// ⚠️ **`DT` IS IN MILLISECONDS.** `main.ts:440` computes `dt` as a `performance.now()` delta and
// `lissajous.ts:1108` divides it by 16.667, so a harness that passes `1/60` runs the figure 1000× slow.
// That mistake produced sixteen exact-zero rows on the first prototype and they were *arithmetically
// correct*: `Argus` genuinely had all 20 000 particles inside a 0.6 px box at frame 60. **Four separate
// units errors have now been found in this engine; this was the fourth.** Check the unit of the RESULT.
const DT = 16.667;
const CANVAS = 512;          // square, so the metric never depends on an aspect ratio
const GRID = 128;            // 16 384 cells — the occupancy grid
const WARM_FRAMES = 40;      // matches `MATH_WARM_FRAMES`, i.e. steps off frame 0's degenerate cases
const SAMPLE_FRAMES = 200;
// ⚠️ **The cap is CALIBRATED, not chosen for speed alone.** 4 000 reproduces the uncapped run's whole
// distribution exactly (dim p0 1.185 either way) at 15.3 s against 70 s; 3 000 drifts the floor to 1.149 and
// 2 000 to 1.082. Lowering `SAMPLE_FRAMES` to 100 drifts it to 1.051. **Any change to these four constants
// invalidates every pinned value below** — they are a property of the window, not of the preset.
const PARTICLE_CAP = 4000;

/** Box-counting dimension + normalised spatial entropy + occupied-cell count for one preset. */
function occupancy(preset) {
  const generators = { ...preset.generators };
  generators.particleCount = Math.min(generators.particleCount, PARTICLE_CAP);

  const gen = new LissajousGenerator();
  gen.init(
    { type: 'lissajous', ...generators, designResolution: preset.metadata.designResolution },
    { width: CANVAS, height: CANVAS },
  );

  const occ = new Float64Array(GRID * GRID);
  let samples = 0;
  for (let f = 0; f < WARM_FRAMES + SAMPLE_FRAMES; f++) {
    gen.update(DT);
    if (f < WARM_FRAMES) continue;
    const state = gen.getState();
    // ⚠️ `state.count` is the ONLY trustworthy length — `getState()` publishes grow-only reused scratch
    // whenever a tail block exists (V6), so `positions.length` can exceed the live population.
    for (let i = 0; i < state.count; i++) {
      const x = state.positions[i * 3];
      const y = state.positions[i * 3 + 1];
      // Rejects off-screen particles and, with them, anything parked at CULL_SENTINEL.
      if (x < 0 || y < 0 || x >= CANVAS || y >= CANVAS) continue;
      occ[(((y * GRID / CANVAS) | 0) * GRID) + ((x * GRID / CANVAS) | 0)]++;
      samples++;
    }
  }

  let cells = 0, entropy = 0;
  for (const v of occ) {
    if (v <= 0) continue;
    cells++;
    const p = v / samples;
    entropy -= p * Math.log2(p);
  }

  // Box-counting over five halvings of the cell size; the dimension is the slope of log N against log s.
  const pts = [];
  for (const s of [128, 64, 32, 16, 8]) {
    const box = new Uint8Array(s * s);
    let n = 0;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        if (!occ[gy * GRID + gx]) continue;
        const k = (((gy * s / GRID) | 0) * s) + ((gx * s / GRID) | 0);
        if (!box[k]) { box[k] = 1; n++; }
      }
    }
    pts.push([Math.log(s), Math.log(n || 1)]);
  }
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const k = pts.length;

  return {
    dim: (k * sxy - sx * sy) / (k * sxx - sx * sx),
    ent: samples ? entropy / Math.log2(GRID * GRID) : 0,
    cells,
  };
}

// ---------------------------------------------------------------------------------------------------
// Assertion 1 — the occupancy metrics are a REGRESSION set with pinned values, not a quality floor.
// ---------------------------------------------------------------------------------------------------
//
// ⚠️ **A library-wide floor was measured and REJECTED; do not reinstate one.** Two findings kill it:
//   - It would false-positive on content the user explicitly approved. `Rössler Spiral` occupies **5 of
//     16 384 cells** (dim 0.064) and `Rössler Wide` **4** (dim 0.000) at blend 1.0, and both were accepted
//     in the V7e browser pass — a continuous ODE is still inside its transient at 20 s, so a low occupancy
//     score there is a property of the SAMPLING WINDOW, not of the figure. `Thomas Cyclone` moves 286 →
//     3 158 cells (11×) between a 240-frame and a 1 200-frame window.
//   - It guards nothing that can change. The 177 legacy presets are immutable input data; re-deriving a
//     floor over them on every `verify` proves only that arithmetic is still arithmetic.
//
// **What CAN change is the generator math**, and that is what these pinned values catch. They are a
// tripwire on `lissajous.ts`'s projection and wave pipeline — the E30 symmetry fold moves `Cylinder` from
// 769 to 948 cells (+23 %), so an accidental fold, a lost `?? 1`, or a units slip in the projection shows
// up here as a numeric diff on a named preset rather than as a silent change in 177 thumbnails.
//
// The set spans the whole measured distribution rather than sampling it randomly: `Subspace` is the p0 of
// dimension, `Distortion` and `Star Dust` saturate the grid, and `Quasar`/`Warp` are the two high-cell /
// low-entropy figures (a few dense filaments) that a mean-based metric would misread.
//
// ⚠️ **Tolerances are loose on purpose, and 0 is the WRONG tolerance even though the harness is
// bit-deterministic on one machine** (verified: three runs of three presets, byte-identical). `Math.sin`
// and `Math.cos` are **implementation-defined** in ECMAScript, so a different engine or platform may differ
// by an ULP — enough to move a particle across a cell boundary. The bands below are still ~10× tighter than
// the smallest real regression measured (E30's +23 % on `Cylinder`).
const DIM_TOL = 0.02;        // absolute; dimension is an aggregate slope and very stable
const ENT_TOL = 0.02;        // absolute; entropy likewise
const CELLS_REL_TOL = 0.02;  // relative; an integer count, so it is the ULP-sensitive one

const PINNED = [
  // name                       dim      ent     cells
  ['Subspace',                 1.1848, 0.5922,    427],
  ['Lonely Particle',          1.2481, 0.6140,    594],
  ['Fogs Of Another World',    1.3723, 0.5648,    358],
  ['Diffusion',                1.4646, 0.6485,    631],
  ['Cylinder',                 1.5611, 0.6497,    769],
  ['Quasar',                   1.3840, 0.4216,   2959],
  ['Warp',                     1.4029, 0.3960,   3090],
  ['Scanner',                  1.8839, 0.8877,   8836],
  ['Argus',                    1.8645, 0.8770,   9119],
  ['Rose',                     1.9496, 0.9325,  13880],
  ['Star Dust',                1.9998, 0.9858,  16374],
  ['Distortion',               2.0000, 0.9902,  16384],
];

console.log('=== aestheticcheck: degeneracy score (v8 step 11.1) ===\n');
console.log('--- occupancy regression set (pinned values, not a quality floor) ---');

// The preset file is a JS assignment, not JSON — strip exactly as `main.ts`'s dev branch does (a line
// number would drift; grep `g_psss_presets` there). `scripts/export-library.mjs` strips the same way.
const presetText = readFileSync(join(ROOT, 'public', 'psss_presets.json'), 'utf8');
const rawPresets = JSON.parse(
  presetText.replace(/^\s*(var\s+)?g_psss_presets\s*=\s*/, '').replace(/;\s*$/, ''),
);

for (const [name, dim, ent, cells] of PINNED) {
  const raw = rawPresets[name];
  if (!raw) { chk(`${name} is present in the library`, false, 'preset not found'); continue; }
  const m = occupancy(MigrationLayer.migrate(name, raw));
  const dOk = Math.abs(m.dim - dim) <= DIM_TOL;
  const eOk = Math.abs(m.ent - ent) <= ENT_TOL;
  const cOk = Math.abs(m.cells - cells) <= Math.max(1, cells * CELLS_REL_TOL);
  chk(
    name.padEnd(22),
    dOk && eOk && cOk,
    `dim ${m.dim.toFixed(4)} ent ${m.ent.toFixed(4)} cells ${m.cells}` +
      (dOk && eOk && cOk ? '' : `   EXPECTED dim ${dim} ent ${ent} cells ${cells}`),
  );
}

// ---------------------------------------------------------------------------------------------------
// Assertion 2 — the escape-field floor. THIS is the half that catches the miss 11.1 was justified by.
// ---------------------------------------------------------------------------------------------------
//
// Two independent axes, both needed, measured over every julia/mandelbrot window in `ATTRACTOR_PRESETS`:
//
//   - `followable` — the fraction of the grid where `escapeFlowStep` will actually move a particle. Catches
//     a window sitting inside the set: `Mandelbrot Mini-brot` shipped at **0.119** and `Needle` at **0.006**
//     (98.3 % interior), both reported by a user as *"a rectangle in space showing noise"* and re-bounded to
//     0.924 / 0.910. Floor is well below the lowest kept preset (`Elephant Valley`, 0.549).
//
//   - `escapeRange` — max − min of the smooth escape value over followable cells. **The only axis that
//     separates `Mandelbrot Lightning`**, and the reason this checker exists at all.
//
// ⚠️ **`edgeCells` is deliberately NOT asserted, and reaching for it is the trap.** It reads **0 for six
// KEPT presets** at the real iteration count — Julia Dendrite, Pinwheel, Firework, Neuron and Mandelbrot
// Starfish, with Spiral Galaxy at 1 — so any floor above zero fails user-approved content. It remains
// worth *reporting* when choosing a new window by hand (a fully-escaping field is structureless), but it
// cannot be a gate.
//
// ⚠️ **A preset's DECLARED `maxIter` is dead code — `attractors.ts` has `void maxIter;` at both escape
// sites, and `computeAdaptiveMaxIter(bounds)` governs via five span bands.** So `Starfish` declares 600 and
// resolves to 1000, `Spiral Galaxy` 800 → 1000, and the deleted Lightning 600 → 1000. Any edge/range figure
// quoted against a declared value was measured on a grid the engine never builds. `escapeFieldStats()`
// calls the real `buildEscapeGrid()` precisely so this checker cannot drift that way.
const FOLLOWABLE_FLOOR = 0.40;   // lowest kept: Elephant Valley 0.549; caught: Mini-brot 0.119, Needle 0.006
const ESCAPE_RANGE_FLOOR = 10.0; // lowest kept: Julia Dendrite 17.4; caught: Lightning 3.67

console.log('\n--- escape-field floor (all julia/mandelbrot windows) ---');

const windows = ATTRACTOR_PRESETS.filter((p) => p.type === 'julia' || p.type === 'mandelbrot');
chk('every escape-time window is measured', windows.length > 0, `${windows.length} windows`);

let worstFoll = Infinity, worstRange = Infinity, worstFollName = '', worstRangeName = '';
const offenders = [];
for (const p of windows) {
  const s = escapeFieldStats(p.type, p.params, p.bounds);
  if (s.followable < worstFoll) { worstFoll = s.followable; worstFollName = p.name; }
  if (s.escapeRange < worstRange) { worstRange = s.escapeRange; worstRangeName = p.name; }
  if (s.followable < FOLLOWABLE_FLOOR || s.escapeRange < ESCAPE_RANGE_FLOOR) {
    offenders.push(`${p.name} (foll ${s.followable.toFixed(3)}, range ${s.escapeRange.toFixed(1)})`);
  }
}
chk(
  `every window is followable (>= ${FOLLOWABLE_FLOOR})`,
  worstFoll >= FOLLOWABLE_FLOOR,
  `worst ${worstFollName} ${worstFoll.toFixed(4)}`,
);
chk(
  `every window has escape structure (range >= ${ESCAPE_RANGE_FLOOR})`,
  worstRange >= ESCAPE_RANGE_FLOOR,
  `worst ${worstRangeName} ${worstRange.toFixed(1)}`,
);
if (offenders.length) console.log('        offenders: ' + offenders.join('; '));

// ---------------------------------------------------------------------------------------------------
// Assertion 3 — the deleted preset must still be REJECTED by the floor above.
// ---------------------------------------------------------------------------------------------------
//
// A floor that no longer catches the case it was calibrated on is a floor that has silently drifted. This
// is the fixture form of the same idea as `deadcheck`'s two-directional assertions: the guard must fail on
// bad input as well as pass on good.
//
// Recovered verbatim from `backup_20260813_attractor_fixes/src/generators/attractors.ts:615`. Its declared
// `maxIter: 600` is retained for fidelity to the deleted row and, per the note above, is discarded by
// `computeAdaptiveMaxIter` in favour of 1000 — which is the grid it was actually rendered from.
const LIGHTNING = {
  type: 'mandelbrot',
  params: [2.0, 0, 0, 0],
  bounds: [-0.194, 0.655, -0.188, 0.661],
};

console.log('\n--- regression fixture: the deleted `Mandelbrot Lightning` must be rejected ---');
const lit = escapeFieldStats(LIGHTNING.type, LIGHTNING.params, LIGHTNING.bounds);
chk(
  'Mandelbrot Lightning fails the escape-range floor',
  lit.escapeRange < ESCAPE_RANGE_FLOOR,
  `range ${lit.escapeRange.toFixed(2)} < ${ESCAPE_RANGE_FLOOR} (iter ${lit.maxIter})`,
);
// The two axes it did NOT fail are asserted too, because that asymmetry is the whole finding: a preset can
// be perfectly followable, fill the frame, and still have nothing to follow.
chk(
  'and it is followable and fully-escaping, which is why the other axes cannot catch it',
  lit.followable >= FOLLOWABLE_FLOOR && lit.edgeCells === 0,
  `foll ${lit.followable.toFixed(4)} (passes), edge ${lit.edgeCells}`,
);
chk(
  'no live preset reuses its bounds',
  !windows.some((p) =>
    p.bounds.every((b, i) => Math.abs(b - LIGHTNING.bounds[i]) < 1e-9)),
  'deletion holds',
);

// ---------------------------------------------------------------------------------------------------
// Assertion 4 — the continuous ODE attractors are seeded ON their attractor, and CENTRED on it.
// ---------------------------------------------------------------------------------------------------
//
// ⚠️ **Two defects, both of which passed `verify` and every section above for as long as they existed, and
// both of which a user reported as one complaint** (`Lorenz Twin Lobes`, owner, 2026-09-20: *"very soon
// consolidates into two small independent circles which are rotating and then nothing changes anymore, the
// circles are too small"*).
//
//   1. **The population did not start on the attractor.** Every ODE particle was seeded on a circle of
//      radius 0.1–0.4 about the origin, which for these systems is a point near an UNSTABLE fixed point, so
//      only chaotic divergence separated them — minutes of screen time before the figure appeared. Fixed by
//      `warmOdeAttractor`, which harvests a bank of reference trajectories. Here: the seeded population's
//      extent, which is ~0.03 h for a seed circle and ~1–4 h for an attractor.
//   2. **The attractor was not centred on the origin** (invariant 27 — `ATTRACTOR_HALF_EXTENT` carries SCALE
//      and no ORIGIN). `lorenz` z runs 0.03…1.83 of the half-extent, so the figure sat pushed away in depth,
//      shrunk by the perspective divide and rotating about a pivot outside itself. Fixed by measuring the
//      centre at seed time (`state.centre*`) and subtracting it in `iterateAttractor`.
//
// ⚠️ **Nothing above this line can see either one**, which is why they are asserted here and not folded into
// the occupancy metrics: both figures have a high box-counting dimension and a high spatial entropy the
// whole time — the particles are perfectly well distributed along their first few orbits. The defect is
// WHERE those orbits are, and how much of the attractor they are on.
//
// ⚠️ **`Lorenz Tight` is the exception and it is a FIXTURE, not a tolerance.** Its `rho` is 15, below the
// 24.74 that makes the Lorenz system chaotic, so its two fixed points are STABLE: the harvest is *correct*
// there and lands the whole population on a point, which is a dead frame. `warmOdeAttractor` detects the
// collapse by MOTION and restores the seed circle, and what that preset has always shown is the long
// transient. So the assertion below is two-directional: the seven live systems must develop, and this one
// must NOT — a new entry that collapses fails here and has to be triaged rather than silently shipping a
// dead frame.
const SEED_SPAN_FLOOR = 0.50;   // lowest developed: Rössler Spiral 1.00; the seed circle is 0.075
const SEED_CENTRE_TOL = 0.25;   // normalised units, after subtraction; worst live: Rössler Wide 0.15
const COLLAPSED_BY_DESIGN = ['Lorenz Tight'];
const ODE_TYPES = ['lorenz', 'rossler', 'thomas', 'halvorsen', 'aizawa', 'nose-hoover'];

/** Seed one entry and report the population's extent and centre, in units of the half-extent. */
function seedStats(p, count) {
  const params = { type: p.type, params: p.params, bounds: p.bounds };
  if (p.maxIter !== undefined) params.maxIter = p.maxIter;
  const st = createAttractorState(count);
  const t0 = performance.now();
  initAttractorState(st, params);
  const ms = performance.now() - t0;
  const half = attractorHalfExtent(p.type) || 1;
  // ⚠️ Measured through `iterateAttractor`'s published output, NOT off `state.x` — the subtraction being
  // asserted lives in that function, and a checker that read the arrays directly would pass with the
  // centring removed. The one step it costs is why the tolerance is not tighter: `Rössler Wide` travels
  // 0.15 h up its z spike in a single step.
  const ox = new Float32Array(count), oy = new Float32Array(count), oz = new Float32Array(count);
  iterateAttractor(st, params, ox, oy, oz, 1);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const v = [ox[i], oy[i], oz[i]];
    for (let k = 0; k < 3; k++) {
      if (!Number.isFinite(v[k])) continue;
      if (v[k] < lo[k]) lo[k] = v[k];
      if (v[k] > hi[k]) hi[k] = v[k];
    }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const ctr = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  // The same centre WITHOUT the subtraction, i.e. what the frame showed before the fix — the ratio of the
  // two is what says the subtraction is doing work rather than the attractor happening to be centred.
  const raw = [st.centreX / half, st.centreY / half, st.centreZ / half];
  const rawCtr = ctr.map((c, k) => c + raw[k]);
  return { span, off: Math.max(...ctr.map(Math.abs)), rawOff: Math.max(...rawCtr.map(Math.abs)), ms };
}

console.log('\n--- ODE seeding: on the attractor, and centred on it ---');

const odes = ATTRACTOR_PRESETS.filter((p) => ODE_TYPES.includes(p.type));
chk('every continuous ODE entry is measured', odes.length >= 8, `${odes.length} entries`);

const undeveloped = [], uncentred = [], rows = [];
for (const p of odes) {
  const s = seedStats(p, 4000);
  rows.push(`${p.name} span ${s.span.toFixed(2)}h off ${s.off.toFixed(3)} (raw ${s.rawOff.toFixed(2)})`);
  const expectCollapse = COLLAPSED_BY_DESIGN.includes(p.name);
  if ((s.span >= SEED_SPAN_FLOOR) === expectCollapse) undeveloped.push(`${p.name} span ${s.span.toFixed(3)}h`);
  // Either centred outright, or moved most of the way there — `nose-hoover` is centred to begin with, so a
  // ratio alone would fail it and an absolute tolerance alone would pass an entry the fix never reached.
  if (s.off > SEED_CENTRE_TOL && s.off > 0.25 * s.rawOff) uncentred.push(`${p.name} off ${s.off.toFixed(3)}`);
}
chk(
  `every ODE entry lands on its attractor (span >= ${SEED_SPAN_FLOOR}h), and only ${COLLAPSED_BY_DESIGN.join('/')} does not`,
  undeveloped.length === 0,
  undeveloped.length ? undeveloped.join('; ') : `${odes.length - COLLAPSED_BY_DESIGN.length} developed, ${COLLAPSED_BY_DESIGN.length} reverted by design`,
);
chk(
  `every ODE entry is centred (|centre| <= ${SEED_CENTRE_TOL} of the half-extent)`,
  uncentred.length === 0,
  uncentred.length ? uncentred.join('; ') : 'invariant 27 holds on all ' + odes.length,
);
// The other direction: at least one entry must be genuinely off-origin, or the subtraction above is being
// asserted against a set of attractors that never needed it and the whole section is vacuous.
const worstRaw = Math.max(...odes.map((p) => seedStats(p, 2000).rawOff));
chk(
  'and the offsets are real — some entry would be off-centre without the subtraction',
  worstRaw >= 0.5,
  `worst uncorrected offset ${worstRaw.toFixed(2)} of the half-extent`,
);

// The centre is published only by a FULL seed: a grown tail (`fromIndex > 0`) must not republish it off its
// own 100-point sample, or the whole figure's origin jiggles on every step of the Particle Number drag.
const lorenz = odes.find((p) => p.name === 'Lorenz Classic');
const lp = { type: lorenz.type, params: lorenz.params, bounds: lorenz.bounds };
const grown = createAttractorState(4100);
initAttractorState(grown, lp);
const beforeGrow = [grown.centreX, grown.centreY, grown.centreZ];
initAttractorState(grown, lp, 4000);
chk(
  'a grown tail does not republish the centre',
  [grown.centreX, grown.centreY, grown.centreZ].every((v, i) => v === beforeGrow[i]),
  `${beforeGrow.map((v) => v.toFixed(2)).join(', ')} unchanged`,
);

// Non-ODE types keep the scale-only rule: their centre must stay exactly zero, because `warmDiscreteMap`
// and the escape grid place particles symmetrically and a measured centre there would move a figure that
// was already framed.
const nonOde = ATTRACTOR_PRESETS.filter((p) => !ODE_TYPES.includes(p.type));
const centredNonOde = nonOde.filter((p) => {
  const st = createAttractorState(64);
  const params = { type: p.type, params: p.params, bounds: p.bounds };
  if (p.maxIter !== undefined) params.maxIter = p.maxIter;
  initAttractorState(st, params);
  return st.centreX !== 0 || st.centreY !== 0 || st.centreZ !== 0;
});
chk(
  'the discrete maps and escape-time windows publish NO centre',
  centredNonOde.length === 0,
  `${nonOde.length} entries, ${centredNonOde.length} with a centre`,
);

// ⚠️ The design claim behind the reference bank is that the seeding cost is a TOTAL, so the figure must not
// depend on the particle count either — a preset whose Particle Number slider changes the SHAPE of the
// attractor would be the same class of defect one layer up.
const spans = [500, 4000, 20000].map((n) => seedStats(lorenz, n));
const spanLo = Math.min(...spans.map((s) => s.span)), spanHi = Math.max(...spans.map((s) => s.span));
chk(
  'the seeded figure does not depend on the particle count',
  spanHi <= spanLo * 1.3,
  `span ${spans.map((s) => s.span.toFixed(2)).join(' / ')}h at 500 / 4 000 / 20 000`,
);
console.log(`        seed cost ${spans.map((s) => s.ms.toFixed(0) + 'ms').join(' / ')} — reported, not asserted: `
  + 'a wall-clock floor on a shared machine is a flaky gate, and the count-independence above is the property');
for (const r of rows) console.log('        ' + r);

console.log(`\naestheticcheck: ${fail === 0 ? 'OK' : 'FAILED'} (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
