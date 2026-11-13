/*
 * `strandcheck.mjs` — v8 Phase 37 (`37.14`, `37.D15`): **the attractor STRAND keeps its ordering, and the cloud is
 * untouched by it.** Measures through the ENGINE (`generators/attractor-strand.ts`, `LissajousGenerator`), never a
 * sketch: the spec's own §11.1 table came from a 92-line prototype that imports nothing from the engine.
 *
 * ⚠️ **A POSITION-SHAPED ASSERTION CANNOT SEE AN ORDERING DEFECT** (`31`'s lesson: two features shipped with the
 * positions right and the ordering destroyed, every clause green). So the clauses here count ADJACENT-INDEX CHORDS —
 * the one quantity an ordering defect moves — and the first build of the emitter is the proof that this matters:
 * it restarted each frame's walk at the head, so every frame boundary wrote one chord up to 13× the spacing, while
 * every position was on the attractor.
 *
 *   §A  ordering: on every ODE registry entry, after 300 frames at three speeds, every adjacent-index chord is at most
 *       the spacing (a chord cannot exceed the arc it spans) and none is zero (a doubled point). SEEDED: an emitter
 *       that restarts at the head each call (the first build's defect) must fail it.
 *  §B  the centre is the CLOUD's (`37.D12`): the strand publishes the 32-reference bank's centre at the same count.
 *  §C  the cloud is bit-identical: every attractor preset in the composed library, run with non-default strand
 *       settings on the CLOUD layout, writes the same positions bit for bit as with none (`37.D15(b)` — measured
 *       against the live tree rather than a stored hash, so a legitimate preset edit cannot turn it red).
 *  §D  speed 0 FREEZES the strand exactly, and a positive speed moves it (threshold-free, `37.D6`'s shape).
 *  §E  a reseed does not clear the buffer and costs ONE adjacent pair, which scrolls off (`37.D14`).
 *  §F  the `Open figure` chip names the strand (`37.D10`) — nothing else fails if the disjunct is forgotten.
 *  §G  the capability table is the ODE set exactly, and the export gate is value-gated on the layout.
 *  §H  the preview TILE tier: a thinner warm-up keeps the attractor's footprint, tile grids never evict the main
 *       view's, and the tile renderer sets attractor and strand together.
 */
const { AttractorStrand, STRAND_CAPABLE, STRAND_FINE } = await import('../src/generators/attractor-strand.ts');
const ATTR = await import('../src/generators/attractors.ts');
const { ATTRACTOR_PRESETS, ATTRACTOR_FLATNESS, createAttractorState, initAttractorState } = ATTR;
const { LissajousGenerator } = await import('../src/generators/lissajous.ts');
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { computeFacets } = await import('../src/presets/preset-facets.ts');
const { resolveFigureType } = await import('../src/generators/figure-types.ts');
const { readFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0, calibFail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const seed = (n, caught) => {
  if (caught) console.log(`  CALIB  ${n} — seeded defect caught`);
  else { console.log(`  CALIBRATION FAIL  ${n} — seeded defect NOT caught`); calibFail++; }
};
const ODE = ATTRACTOR_PRESETS.map((a, i) => ({ ...a, i })).filter((a) => STRAND_CAPABLE[a.type]);
const paramsOf = (a) => ({ type: a.type, params: a.params, blend: 1, bounds: a.bounds });

/** Adjacent-index chords of a published window, as multiples of the spacing (normalised units). */
function chords(X, Y, Z, n, dsNorm) {
  let mx = 0, mn = Infinity, long = 0;
  for (let i = 1; i < n; i++) {
    const c = Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1], Z[i] - Z[i - 1]) / dsNorm;
    if (c > mx) mx = c; if (c < mn) mn = c; if (c > 1.5) long++;
  }
  return { mx, mn, long };
}

// ── §A ordering ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('=== §A — adjacent-index chords on every ODE registry entry ===');
{
  const N = 4000, SPAN = 6;
  let worst = 0, least = Infinity, bad = [];
  for (const a of ODE) for (const adv of [1, 12, 40]) {
    const s = new AttractorStrand(paramsOf(a), N, { span: SPAN, advance: adv, spanTop: SPAN });
    const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    for (let f = 0; f < 300; f++) s.step({ span: SPAN, advance: adv, spanTop: SPAN }, 1, X, Y, Z, N);
    const c = chords(X, Y, Z, N, SPAN / N);
    worst = Math.max(worst, c.mx); least = Math.min(least, c.mn);
    if (c.mx > 1 + 1e-3 || !(c.mn > 0)) bad.push(`${a.name}@${adv}`);
  }
  chk('every adjacent chord is <= the spacing and > 0 (no jump, no doubled point), 8 entries x 3 speeds x 300 frames',
    bad.length === 0, `worst chord ${worst.toFixed(4)} x spacing, least ${least.toFixed(4)} x; failing: ${bad.join(', ') || 'none'}`);

  // SEED: the first build's emitter — each call restarts at the HEAD instead of the walk cursor. Re-implemented here
  // on a unit circle (a synthetic flow), beside the engine's law on the same flow, so the clause is shown to bite.
  const circle = (restartAtHead) => {
    const n = 2000, ds = 2 * Math.PI / n * 0.5, per = 12;
    let th = 0, acc = 0, cur = 0; const pts = [[1, 0]];
    const dth = 0.004;                                  // the integration step, ~1.6 x the spacing
    for (let frame = 0; frame < 120; frame++) {
      if (restartAtHead) { cur = th; acc = 0; }
      let left = per;
      while (left > 0) {
        const seg = th - cur;                           // arc on the unit circle = angle
        if (seg > 0 && acc + seg >= ds) { cur += ds - acc; acc = 0; pts.push([Math.cos(cur), Math.sin(cur)]); left--; continue; }
        acc += seg; cur = th; th += dth;
      }
    }
    let mx = 0;
    for (let i = 1; i < pts.length; i++) mx = Math.max(mx, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / ds);
    return mx;
  };
  const good = circle(false), broken = circle(true);
  chk('...the synthetic flow under the engine\'s cursor law holds the bound', good <= 1 + 1e-6, `max chord ${good.toFixed(4)} x spacing`);
  seed(`§A an emitter that restarts at the head each frame (max chord ${broken.toFixed(2)} x spacing)`, broken > 1 + 1e-3);
}

// ── §B centre ─────────────────────────────────────────────────────────────────────────────────────────────────
console.log('=== §B — the strand publishes the CLOUD\'s centre (37.D12) ===');
{
  let worst = 0;
  for (const a of ODE) {
    const N = 3000;
    const s = new AttractorStrand(paramsOf(a), N, { span: 6, advance: 12, spanTop: 6 });
    const bank = createAttractorState(N); initAttractorState(bank, paramsOf(a));
    worst = Math.max(worst, Math.abs(s.centreX - bank.centreX), Math.abs(s.centreY - bank.centreY), Math.abs(s.centreZ - bank.centreZ));
  }
  chk('the strand centre equals the 32-reference bank\'s at the same count, all 8 ODE entries', worst === 0, `worst |delta| ${worst}`);
}

// ── §C cloud bit-identity over the composed library ────────────────────────────────────────────────────────────
console.log('=== §C — the cloud path is untouched by the strand (37.D15(b)) ===');
{
  const rawText = readFileSync(join(ROOT, 'public/psss_presets.json'), 'utf8');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgr = new PresetManager(); loadLibrary(mgr, rawLib);
  const presets = mgr.list().map((n) => mgr.get(n)).filter((p) => (p.overlay?.attractorIndex ?? -1) >= 0);
  const run = (p, strandSettings) => {
    const g = new LissajousGenerator();
    g.init({
      type: resolveFigureType(p.generators.type, p.generators ?? {}).type, particleCount: p.generators.particleCount ?? 500,
      ...(p.generators.lsystem !== undefined ? { lsystem: p.generators.lsystem } : {}),
      waves: p.generators.waves ?? [], waveSpeed: p.generators.waveSpeed ?? 0.05,
      rotation: p.generators.rotation ?? [0, 0, 0], angle: p.generators.angle ?? [0, 0, 0],
      colorBase: p.generators.colorBase ?? [128, 128, 128], colorAmp: p.generators.colorAmp ?? [128, 128, 128],
      colorFreq: p.generators.colorFreq ?? [0.1, 0.1, 0.1], colorShift: p.generators.colorShift ?? [0.1, 0.1, 0.1],
      designResolution: p.metadata.designResolution ?? { width: 100, height: 100 },
    }, { width: 800, height: 600 });
    const ap = ATTRACTOR_PRESETS[p.overlay.attractorIndex];
    g.setAttractor({ type: ap.type, params: ap.params, blend: p.overlay.attractorBlend ?? 0.6, bounds: ap.bounds, ...(ap.maxIter !== undefined ? { maxIter: ap.maxIter } : {}) });
    if (strandSettings) g.setAttractorStrand(strandSettings);
    const out = [];
    for (let f = 0; f < 12; f++) { g.update(16.667); const st = g.getState(); out.push(st.positions.slice(0, st.count * 3)); }
    return out;
  };
  const same = (a, b) => a.length === b.length && a.every((x, k) => x.length === b[k].length && x.every((v, i) => Object.is(v, b[k][i])));
  // Non-default strand values on the CLOUD layout: none of them may reach the cloud.
  const noisy = { layout: 'cloud', span: 11, spanDepth: 3, spanRate: 7, advance: 40, advanceDepth: 9, advanceRate: 5 };
  // ⚠️⚠️ **THE NOISE FLOOR FIRST.** The escape-time flow (`julia`/`mandelbrot`) draws from a MODULE-LEVEL LCG
  // (`pseudoRandom` in `attractors.ts`), so two runs of one such preset in one process differ with nothing changed.
  // So each preset runs untouched TWICE (A, C) around the noisy run (B): only presets with A == C are judged, and a
  // preset that does not reproduce is excluded ONLY if its type cannot reach the strand branch at all
  // (`STRAND_CAPABLE` false) — an excluded strand-capable preset would be a hole in the clause and fails it.
  const cloudPresets = presets.filter((p) => p.overlay.attractorLayout !== 'strand');
  const diff = [], unrepro = [], unreproCapable = [];
  for (const p of cloudPresets) {
    const A = run(p, null), B = run(p, noisy), C = run(p, null);
    if (!same(A, C)) {
      unrepro.push(p.metadata.name);
      if (STRAND_CAPABLE[ATTRACTOR_PRESETS[p.overlay.attractorIndex].type]) unreproCapable.push(p.metadata.name);
      continue;
    }
    if (!same(A, B)) diff.push(p.metadata.name);
  }
  const judged = cloudPresets.length - unrepro.length;
  chk(`every reproducible cloud attractor preset (${judged} of ${cloudPresets.length}) writes the SAME positions bit for bit with non-default strand settings on the cloud layout`,
    diff.length === 0 && judged > 0, `differ: ${diff.join(', ') || 'none'}`);
  chk(`...and every preset excluded as non-reproducible (${unrepro.length}) is on a type the strand cannot reach`,
    unreproCapable.length === 0, `excluded (in-process RNG, escape-time flow): ${unrepro.join(', ') || 'none'}; strand-capable among them: ${unreproCapable.join(', ') || 'none'}`);
  // SEED: a strand-capable preset whose attractor is LIVE, on the STRAND layout, must be seen as different.
  const host = cloudPresets.find((p) => STRAND_CAPABLE[ATTRACTOR_PRESETS[p.overlay.attractorIndex].type] && (p.overlay.attractorBlend ?? 0) > 0);
  seed(`§C the same preset on the STRAND layout (${host?.metadata.name}) is seen as different`, !!host && !same(run(host, null), run(host, { ...noisy, layout: 'strand' })));
}

// ── §D frozen vs moving ───────────────────────────────────────────────────────────────────────────────────────
console.log('=== §D — speed 0 freezes the strand exactly; a positive speed moves it ===');
{
  const a = ODE.find((x) => x.name === 'Lorenz Classic');
  const N = 2000;
  const spread = (adv) => {
    const s = new AttractorStrand(paramsOf(a), N, { span: 6, advance: adv, spanTop: 6 });
    const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let f = 0; f < 200; f++) {
      s.step({ span: 6, advance: adv, spanTop: 6 }, 1, X, Y, Z, N);
      const v = [X[0], Y[0], Z[0]];
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
    }
    return Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  };
  const frozen = spread(0), moving = spread(12);
  chk('the head of a speed-0 strand does not move at all over 200 frames (the cheap frozen route)', frozen === 0, `bbox diameter ${frozen}`);
  chk('...and at speed 12 it travels', moving > 0.05, `bbox diameter ${moving.toFixed(3)} half-extents`);
}

// ── §E a reseed costs one pair ────────────────────────────────────────────────────────────────────────────────
console.log('=== §E — a reseed does not clear the buffer and costs ONE adjacent pair, which scrolls off (37.D14) ===');
{
  const a = ODE.find((x) => x.name === 'Lorenz Classic');
  const N = 2000, ADV = 20;
  const s = new AttractorStrand(paramsOf(a), N, { span: 6, advance: ADV, spanTop: 6 });
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
  s.step({ span: 6, advance: ADV, spanTop: 6 }, 1, X, Y, Z, N);
  s['reseed']();                                        // force one, as a divergence would
  s.step({ span: 6, advance: ADV, spanTop: 6 }, 1, X, Y, Z, N);
  const after = chords(X, Y, Z, N, 6 / N);
  let frames = 0;
  while (frames < 2 * N / ADV) { s.step({ span: 6, advance: ADV, spanTop: 6 }, 1, X, Y, Z, N); frames++; if (chords(X, Y, Z, N, 6 / N).long === 0) break; }
  chk('right after a reseed exactly ONE adjacent pair is long (the buffer was not cleared)', after.long === 1, `${after.long} long pair(s)`);
  chk('...and it scrolls off within count / speed frames', chords(X, Y, Z, N, 6 / N).long === 0 && frames <= Math.ceil(N / ADV) + 2,
    `gone after ${frames} frames (bound ${Math.ceil(N / ADV) + 2})`);
}

// ── §F the Open figure chip ───────────────────────────────────────────────────────────────────────────────────
console.log('=== §F — the `Open figure` chip names the strand (37.D10) ===');
{
  const rawText = readFileSync(join(ROOT, 'public/psss_presets.json'), 'utf8');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgr = new PresetManager(); loadLibrary(mgr, rawLib);
  const all = mgr.list().map((n) => mgr.get(n));
  const strands = all.filter((p) => p.overlay?.attractorLayout === 'strand' && (p.overlay?.attractorIndex ?? -1) >= 0
    && (p.overlay?.attractorBlend ?? 0) > 0 && STRAND_CAPABLE[ATTRACTOR_PRESETS[p.overlay.attractorIndex].type]);
  const missed = strands.filter((p) => !computeFacets(p).has('figure:open')).map((p) => p.metadata.name);
  chk(`every live strand preset (${strands.length}) carries the Open figure facet`, strands.length > 0 && missed.length === 0, `missed: ${missed.join(', ') || 'none'}`);
  // SEED: the same body forced back to the cloud must LOSE the facet (unless it travels), so the clause is the disjunct's.
  const back = strands.map((p) => ({ ...p, overlay: { ...p.overlay, attractorLayout: 'cloud' } }))
    .filter((p) => !['travelX', 'travelY', 'travelZ'].some((k) => (p.overlay[k] ?? 0) !== 0));
  seed('§F a strand preset forced back to the cloud loses the facet', back.length > 0 && back.every((p) => !computeFacets(p).has('figure:open')));
}

// ── §G tables ─────────────────────────────────────────────────────────────────────────────────────────────────
console.log('=== §G — the capability table and the export gate ===');
{
  const types = Object.keys(ATTRACTOR_FLATNESS);
  const capable = types.filter((t) => STRAND_CAPABLE[t]);
  chk('STRAND_CAPABLE is exactly the non-flat (ODE) attractor types', capable.length === 6 && capable.every((t) => !ATTRACTOR_FLATNESS[t])
    && types.filter((t) => !ATTRACTOR_FLATNESS[t]).every((t) => STRAND_CAPABLE[t]), `capable: ${capable.join(', ')}`);
  chk('STRAND_FINE is a positive integer for every type', types.every((t) => Number.isInteger(STRAND_FINE[t]) && STRAND_FINE[t] >= 1));
  const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  chk('the export is value-gated on the layout (a cloud preset exports no strand key)',
    /attractorStrandExport = \(\): Partial<OverlayState> => \(attractorStrand\.layout === 'strand' \?/.test(main)
    && /\.\.\.attractorStrandExport\(\)/.test(main));
  chk('adoptAttractorStrand runs on the boot, preset-change and Reset paths', (main.match(/adoptAttractorStrand\((preset\??\.overlay|ov)\)/g) ?? []).length === 3,
    `${(main.match(/adoptAttractorStrand\((preset\??\.overlay|ov)\)/g) ?? []).length} call sites`);
}

// ── §H the preview TILE tier ──────────────────────────────────────────────────────────────────────────────────
console.log('=== §H — the tile tier: a thinner sample of the SAME attractor, cached, never touching the main view ===');
{
  const tiles = readFileSync(join(ROOT, 'src/ui/preview-grid/grid-tile-renderer.ts'), 'utf8');
  const attr = readFileSync(join(ROOT, 'src/generators/attractors.ts'), 'utf8');
  const budget = Number(/const TILE_ATTRACTOR_WARM_BUDGET = ([\d_]+);/.exec(tiles)?.[1]?.replace(/_/g, ''));
  // Measured: each ODE entry at the tile budget keeps most of the main view's footprint (the same attractor, sampled
  // more thinly). The floor is the probe's own worst case (`Rössler Wide` 53 % at 200 k) less a margin — a budget cut
  // that dropped below it would draw a different figure (`Rössler Wide` falls to 4 % at 50 k).
  const N = 2000, G = 48;
  const foot = (st, params) => {
    const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    const { iterateAttractor } = ATTR;
    iterateAttractor(st, params, X, Y, Z, 0);
    const s = new Set();
    for (let i = 0; i < N; i++) { const gx = Math.floor((X[i] + 1.2) / 2.4 * G), gy = Math.floor((Y[i] + 1.2) / 2.4 * G); if (gx >= 0 && gx < G && gy >= 0 && gy < G) s.add(gx * G + gy); }
    return s.size;
  };
  let worst = Infinity, at = '';
  for (const a of ODE.filter((x) => x.name !== 'Lorenz Tight')) {
    const full = createAttractorState(N); initAttractorState(full, paramsOf(a));
    const thin = createAttractorState(N); initAttractorState(thin, paramsOf(a), 0, { warmBudget: budget });
    const r = foot(thin, paramsOf(a)) / foot(full, paramsOf(a));
    if (r < worst) { worst = r; at = a.name; }
  }
  chk(`at the tile budget (${budget} steps) every ODE entry keeps >= 40 % of the main view's footprint`,
    Number.isFinite(budget) && worst >= 0.4, `worst ${(100 * worst).toFixed(0)} % (${at}); \`Lorenz Tight\` excluded — its main view is the collapse guard's seed circle`);
  // SEED: a quarter of that budget — `Rössler Wide`'s long orbits no longer reach its spike, and the clause must say so.
  {
    const a = ODE.find((x) => x.name === 'Rössler Wide');
    const full = createAttractorState(N); initAttractorState(full, paramsOf(a));
    const thin = createAttractorState(N); initAttractorState(thin, paramsOf(a), 0, { warmBudget: Math.round(budget / 4) });
    const r = foot(thin, paramsOf(a)) / foot(full, paramsOf(a));
    seed(`§H a quarter of the tile budget (Rössler Wide keeps ${(100 * r).toFixed(0)} %)`, r < 0.4);
  }
  chk('tile escape grids live in a cache of their own, so a tile can never evict the main view\'s 512² grid',
    /const cache = gridSize === GRID_SIZE \? cachedGrids : cachedTileGrids;/.test(attr));
  chk('the tile renderer sets the attractor on the TILE TIER with the shared cache, and forwards the strand layout with it',
    /generator\.setAttractor\(tileAttractor, \{[\s\S]{0,200}prewarmed: tileAttractorState\(/.test(tiles)
    && /generator\.setAttractorStrand\(\{[\s\S]{0,80}layout: ov\?\.attractorLayout/.test(tiles));
}

console.log(`\n${fail === 0 && calibFail === 0 ? 'PASS' : 'FAIL'}  strandcheck: ${pass} passed, ${fail} failed${calibFail ? `, ${calibFail} CALIBRATION FAIL` : ''}`);
process.exitCode = fail || calibFail ? 1 : 0;
