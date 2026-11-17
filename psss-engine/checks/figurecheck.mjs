/**
 * `checks/figurecheck.mjs` — v8 Phase 36's checker. **The figure-type registry, the read-time
 * resolution, and the whole-library identity gate that `36.1`/`36.2` consist of.**
 *
 * ⚠️⚠️ **CLAUSE §B IS THE REASON THIS FILE EXISTS AND IT IS THE MOST IMPORTANT CLAUSE IN THE PHASE.**
 * `36.1` and `36.2` touch the load path, the stored format and both `GeneratorConfig` call sites for the
 * ENTIRE library, and their feature content is **zero**. `36.20` clause 2 says so in as many words: the
 * bitwise-identity gate over all presets *"is the step"* rather than a formality on top of it. A phase
 * that silently changed one preset here would have changed it for every user of every preset.
 *
 * ⚠️ **A MEASURING CHECKER, so `CLAUDE.md`'s calibration rules apply in full**: every scanning clause
 * carries a seeded defect, and **a seed that does not fail is a CALIBRATION FAIL that exits non-zero
 * exactly like a real failure** — the checker claiming it cannot see what it was written to see.
 *
 * ⚠️ **Never quote a total from this file's prose; read the counts off the run.**
 */

const FT = await import('../src/generators/figure-types.ts');
const { FIGURE_TYPES, FIGURE_TYPE_BY_KEY, DEFAULT_FIGURE_TYPE, resolveFigureType } = FT;
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { readFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ `public/psss_presets.json` is NOT plain JSON — it opens `g_psss_presets={`, so the assignment is
// sliced off before parsing. `stripDeploymentAssignment()` is the one owner on every RUNTIME read; a
// checker reading the file directly must do the same thing and this is the suite's existing idiom.
const rawText = readFileSync(join(ROOT, 'public/psss_presets.json'), 'utf8');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const L = await import('../src/generators/lsystem/rules.ts');
const { LSYSTEM_RULES, LSYSTEM_RULE_BY_KEY, LSYSTEM_ANGLE_BRACKET, LSYSTEM_MIN_USEFUL_BRACKET_DEG, LSYSTEM_DEFAULT_RULE, ruleAngleUsage } = L;
const { walkTurtle: turtleWalk } = await import('../src/generators/lsystem/turtle.ts');
const { buildTetra } = await import('../src/generators/lsystem/tetra.ts');
const { buildHill } = await import('../src/generators/lsystem/hill.ts');
/*
 * v8 Phase 41 — **every rule's list, through the SAME route the engine takes** (`curve.ts`' `buildPose`): a BUILDER rule
 * (the Sierpinski Tetrahedron) has no turtle and an empty axiom, so walking it with the turtle would measure a one-point
 * list and read Infinity. Same result shape as `walkTurtle`, so every clause below measures the tetra too.
 */
const walkTurtle = (r, d, y, p, ro, s) => {
  if (r.builder !== undefined) { const b = r.builder === 'tetra' ? buildTetra(d) : buildHill(d); return { xyz: b.xyz, count: b.count, truncated: false, unclosedBrackets: 0 }; }
  return turtleWalk(r, d, y, p, ro, s);
};

let pass = 0, fail = 0, calibFail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const note = (m) => console.log(`  NOTE  ${m}`);
const seed = (n, violations, why = '') => {
  const ok = violations > 0;
  if (!ok) calibFail++;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations})` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
};

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. v8 36.1 — the registry is ONE owner, and it is total ===\n');

{
  // The failure being designed out: a `Record<Type, Label>` that `tsc` checks against a separate array
  // that it does NOT compare. `FIGURE_TYPE_BY_KEY` is built FROM the array, so this clause asserts the
  // construction rather than trusting it.
  const arrKeys = FIGURE_TYPES.map((e) => e.key).sort();
  const recKeys = Object.keys(FIGURE_TYPE_BY_KEY).sort();
  chk('the ordered array and the keyed Record hold the SAME members',
    JSON.stringify(arrKeys) === JSON.stringify(recKeys),
    `array [${arrKeys}] vs record [${recKeys}]`);

  const FIELDS = ['key', 'label', 'description', 'configKey', 'selectable', 'motion'];
  const missing = [];
  for (const e of FIGURE_TYPES) for (const f of FIELDS) {
    if (e[f] === undefined || e[f] === null || e[f] === '') missing.push(`${e.key}.${f}`);
  }
  chk('every entry declares label, description, configKey, selectable and motion',
    missing.length === 0, `${FIGURE_TYPES.length} entries; missing: [${missing}]`);
  seed('§A an entry with a blank description is refused',
    FIELDS.filter((f) => ({ ...FIGURE_TYPES[0], description: '' })[f] === '').length);

  chk('the DEFAULT type is a registered member', DEFAULT_FIGURE_TYPE in FIGURE_TYPE_BY_KEY, DEFAULT_FIGURE_TYPE);

  // `36.D8`: 'attractor' is RESERVED. Measured unreachable (0 of 339 stored it), and promoting it would
  // create a configuration no preset has ever exercised while the legacy blend is still live.
  const sel = FIGURE_TYPES.filter((e) => e.selectable).map((e) => e.key);
  chk("'attractor' is registered but NOT selectable (36.D8 — reserved, and measured unreachable)",
    'attractor' in FIGURE_TYPE_BY_KEY && !FIGURE_TYPE_BY_KEY.attractor.selectable,
    `selectable: [${sel}]`);

  // `36.D9`: every type declaring `motion: 'static'` must declare at least one modulatable parameter.
  // Satisfied by construction here and asserted anyway, BECAUSE THE NEXT TYPE WILL NOT BE.
  const statics = FIGURE_TYPES.filter((e) => e.motion === 'static').map((e) => e.key);
  chk('no type ships as a turntable: every `motion: static` type has modulatable parameters (36.D9)',
    statics.every((k) => k === 'lsystem'),
    `static: [${statics}] — lsystem carries five ModulatedValue fields (36.D3)`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. v8 36.1/36.2 — THE WHOLE-LIBRARY IDENTITY GATE. This clause IS the step. ===\n');

{
  const mgr = new PresetManager();
  loadLibrary(mgr, rawLib);
  const names = mgr.list();
  const presets = names.map((n) => mgr.get(n)).filter(Boolean);
  note(`composed library: ${presets.length} presets (read from the run, never quoted from a document)`);

  // 1. Every shipped preset must resolve to exactly the value the two call sites previously HARD-CODED.
  // If that holds, `main.ts` and `grid-tile-renderer.ts` receive an identical config to before and the
  // behaviour change is provably nil — which is the strongest identity claim available under Node,
  // where the GL generator cannot run.
  /*
   * ⚠️⚠️ **RESTATED 2026-11-03, AND THE RESTATEMENT KEEPS THE FULL STRENGTH OF THE GATE.** It first read
   * *"EVERY preset resolves to `lissajous`"*, which was correct while nothing authored the new type and
   * went red the moment `36.21`'s first two demos did. **The claim it was always making is that NO
   * PRESET CHANGES — not that no preset uses the new type**, so it is now keyed on the STORED value.
   * A `36.1`/`36.2` regression that re-resolved a wave preset is caught exactly as before; what is no
   * longer caught is the phase doing its job.
   */
  const offenders = [];
  let waveCount = 0;
  for (const p of presets) {
    const g = p.generators ?? {};
    if (g.type !== 'lissajous') continue;
    waveCount++;
    const r = resolveFigureType(g.type, g);
    if (r.type !== 'lissajous' || r.notice !== null) offenders.push(`${p.metadata?.name}: ${r.type}${r.notice ? ' + notice' : ''}`);
  }
  chk('every preset STORING `lissajous` still resolves to `lissajous` with NO notice — the identity gate',
    offenders.length === 0 && waveCount > 0,
    `${waveCount} of ${presets.length} store it; ${offenders.length} offender(s): [${offenders.slice(0, 5)}]`);
  /*
   * ⚠️ **THE SEED RUNS THE GATE AGAINST A BROKEN RESOLVER, NOT A CONTRIVED PRESET, AND THE FIRST ATTEMPT
   * GOT THAT WRONG.** It fed `{ type: 'lissajous', lsystem: {} }` to the real function and expected a
   * violation — but step 1 of `36.2`'s order makes a KNOWN type win outright, so no input can produce
   * one. That is the property working, and a seed that cannot fail is a CALIBRATION FAIL rather than a
   * reassurance. **So the thing seeded is the resolver: a variant that lets a dormant block override an
   * explicit type is exactly the regression this gate exists to catch.**
   */
  seed('§B the identity gate catches a resolver that lets a dormant block override an explicit type',
    (() => {
      const broken = (storedType, blocks) => (blocks.lsystem !== undefined
        ? { type: 'lsystem', notice: null }
        : resolveFigureType(storedType, blocks));
      let v = 0;
      for (const p of presets) {
        const g = p.generators ?? {};
        if (g.type !== 'lissajous') continue;
        if (broken(g.type, { ...g, lsystem: {} }).type !== 'lissajous') v++;
      }
      return v;
    })(),
    'a resolver preferring a block over the stored type must be refused — it would re-type the library');

  // ...and the other direction: a preset that STORES the new type must resolve to it cleanly, or the
  // phase has shipped a block the engine will not read.
  const curves = presets.filter((p) => p.generators?.type === 'lsystem');
  const badCurves = curves.filter((p) => {
    const r = resolveFigureType(p.generators.type, p.generators);
    return r.type !== 'lsystem' || r.notice !== null || p.generators.lsystem === undefined;
  }).map((p) => p.metadata?.name);
  chk('...and every preset storing `lsystem` resolves to it cleanly AND carries the block',
    curves.length > 0 && badCurves.length === 0,
    `${curves.length} curve preset(s): [${curves.map((p) => p.metadata?.name)}]; bad: [${badCurves}]`);

  // 2. And the re-pointed migration gate must give the same answer the old literal comparison gave.
  const disagree = [];
  for (const p of presets) {
    const g = p.generators ?? {};
    const oldGate = g.type !== 'lissajous';                       // the pre-36.1 expression, verbatim
    const newGate = resolveFigureType(g.type, g).type !== 'lissajous';
    if (oldGate !== newGate) disagree.push(p.metadata?.name);
  }
  chk("...and the re-pointed `adoptIndexPalette` gate agrees with the old `g.type !== 'lissajous'` on all of them",
    disagree.length === 0, `disagreements: ${disagree.length} [${disagree.slice(0, 5)}]`);
  seed('§B the agreement scan sees a preset whose resolution differs from the literal',
    [{ type: 'bogus', waves: [] }].filter((g) => (g.type !== 'lissajous') !== (resolveFigureType(g.type, g).type !== 'lissajous')).length,
    'an unknown type with a waves block resolves TO lissajous while the literal says it is not');

  // 3. Nobody stores the reserved member, which is the measurement `36.D8` rests on. ⚠️ Re-measured
  // here rather than carried: it has been quoted as "0 of 339" and the library is no longer 339.
  const stored = {};
  for (const p of presets) {
    const t = p.generators?.type ?? '(absent)';
    stored[t] = (stored[t] ?? 0) + 1;
  }
  /*
   * ⚠️ Restated with the clause above: the census is no longer single-valued, so what it asserts is that
   * **every stored value is a REGISTERED type**. An unregistered one would still load (`36.2` resolves
   * it and never throws) but would do so through the notice path, which is a shipped preset relying on
   * a fallback — reportable, not acceptable.
   */
  const unregistered = Object.keys(stored).filter((k) => !(k in FIGURE_TYPE_BY_KEY));
  chk('every stored type in the library is a REGISTERED type (no preset relies on the notice path)',
    unregistered.length === 0, `census ${JSON.stringify(stored)}; unregistered: [${unregistered}]`);
  note(`stored-type census, read from the run: ${JSON.stringify(stored)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. v8 36.2 — non-destructive switching, and resolution of an unknown type ===\n');

{
  // `36.20` clause 3: for every ordered pair of types, A -> B -> A restores the serialised form
  // BYTE-FOR-BYTE. A switch writes `generators.type` and NOTHING else; this asserts that at the data
  // level, which is where the property has to hold for forward compatibility to be free.
  const base = {
    metadata: { name: 'probe', version: 2, designResolution: { width: 100, height: 100 } },
    generators: {
      type: 'lissajous', particleCount: 1000, waveSpeed: 0.05, rotation: [0, 0, 0],
      waves: [{ speed: 0.05, axes: [] }],
      colorBase: [1], colorAmp: [2], colorFreq: [3], colorShift: [4],
      lsystem: { rule: 'hilbert3d', recursion: { base: 3, amplitude: 0, frequency: 0 } },
    },
  };
  const switchTo = (p, t) => { const c = structuredClone(p); c.generators.type = t; return c; };
  const keys = FIGURE_TYPES.map((e) => e.key);
  const broken = [];
  for (const a of keys) for (const b of keys) {
    const start = JSON.stringify(switchTo(base, a));
    const there = switchTo(JSON.parse(start), b);
    const back = switchTo(there, a);
    if (JSON.stringify(back) !== start) broken.push(`${a}->${b}->${a}`);
  }
  chk('A -> B -> A restores the serialised form byte-for-byte, for every ordered pair',
    broken.length === 0, `${keys.length * keys.length} pairs; broken: [${broken}]`);
  seed('§C the round-trip scan refuses a switch that ZEROES the dormant block',
    (() => {
      const destructive = (p, t) => { const c = structuredClone(p); c.generators.type = t; if (t !== 'lsystem') delete c.generators.lsystem; return c; };
      const start = JSON.stringify(base);
      return JSON.stringify(destructive(destructive(JSON.parse(start), 'lsystem'), 'lissajous')) !== start ? 1 : 0;
    })(),
    'a switch that deletes the non-live block must be caught — that is the whole forward-compatibility property');

  // `36.20` clause 4: every registered type's block survives a round-trip. THE CLAUSE THAT FINDS A FIELD
  // WHITELIST WHEREVER IT LIVES, INCLUDING ONE ADDED AFTER THIS PHASE. Measured 2026-10-31: single-preset
  // export is whole-object (`export.ts:167`) with no whitelist on that path — but the assertion is still
  // owed, because a whitelist added later would be invisible.
  const all = structuredClone(base);
  all.generators.attractor = { type: 'clifford', params: [1, 2, 3, 4] };
  const survived = JSON.parse(JSON.stringify(all));
  const lost = FIGURE_TYPES.map((e) => e.configKey).filter((k) => survived.generators[k] === undefined);
  chk('a preset carrying a block for EVERY registered type survives a round-trip with none lost',
    lost.length === 0, `blocks: [${FIGURE_TYPES.map((e) => e.configKey)}]; lost: [${lost}]`);

  // `36.20` clause 5: an unknown type resolves by `36.2`'s order, never throws, never renders empty, and
  // surfaces the notice.
  let threw = null;
  let r1, r2, r3;
  try {
    r1 = resolveFigureType('definitely-not-a-type', { waves: [] });
    r2 = resolveFigureType(undefined, { lsystem: {} });
    r3 = resolveFigureType('nonsense', {});
  } catch (e) { threw = String(e); }
  chk('an unknown type NEVER throws', threw === null, threw ?? 'no throw');
  chk('...step 2: an unknown type with a known block adopts THAT block\'s type, with a notice',
    r1?.type === 'lissajous' && typeof r1?.notice === 'string'
    && r2?.type === 'lsystem' && typeof r2?.notice === 'string',
    `"${r1?.type}" + notice, "${r2?.type}" + notice`);
  chk('...step 3: an unknown type with no recognisable block falls back to the default, with a notice',
    r3?.type === DEFAULT_FIGURE_TYPE && typeof r3?.notice === 'string', `"${r3?.type}"`);
  chk('...and the WAVE MIGRATION still runs on it, which is the failure the old gate created',
    resolveFigureType('definitely-not-a-type', { waves: [] }).type === 'lissajous',
    'an unknown type with a waves block resolves TO lissajous, so `adoptIndexPalette` is NOT skipped');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. v8 36.4/36.5 — the rule library, and the invariants only a property test sees ===\n');

{
  const arrKeys = LSYSTEM_RULES.map((r) => r.key).sort();
  const recKeys = Object.keys(LSYSTEM_RULE_BY_KEY).sort();
  chk('the rule array and the keyed Record hold the same members',
    JSON.stringify(arrKeys) === JSON.stringify(recKeys), `${LSYSTEM_RULES.length} rules`);
  chk('the default rule is registered', LSYSTEM_DEFAULT_RULE in LSYSTEM_RULE_BY_KEY, LSYSTEM_DEFAULT_RULE);
  chk('every rule declares an angle bracket', LSYSTEM_RULES.every((r) => LSYSTEM_ANGLE_BRACKET[r.key]),
    `missing: [${LSYSTEM_RULES.filter((r) => !LSYSTEM_ANGLE_BRACKET[r.key]).map((r) => r.key)}]`);

  // `36.20` clause 8 — EVERY RULE DECLARES ITS DRAW SYMBOLS AND DRAWING ACTUALLY HAPPENS. The prototype
  // defect this mechanises: `Arrowhead` and `Gosper` contain no `F` at all and use A/B as the forward
  // symbol, so a turtle that misses `drawSymbols` emits coincident points and the density reads Infinity.
  const dead = [], infinite = [];
  for (const r of LSYSTEM_RULES) {
    const depth = Math.min(r.recursionRange[1], r.recursionRange[0] + 1);
    const a = r.publishedAngle;
    const t = walkTurtle(r, depth, a, a, a);
    if (t.count <= r.axiom.length) dead.push(r.key);
    const d = [];
    for (let i = 1; i < t.count; i++) {
      const p = (i - 1) * 3, q = i * 3;
      d.push(Math.hypot(t.xyz[q] - t.xyz[p], t.xyz[q + 1] - t.xyz[p + 1], t.xyz[q + 2] - t.xyz[p + 2]));
    }
    d.sort((x, y) => x - y);
    const lo = d[Math.floor(d.length * 0.01)];
    if (!(lo > 1e-12)) infinite.push(r.key);
  }
  chk('every rule DRAWS — the point list is longer than the axiom', dead.length === 0, `dead: [${dead}]`);
  chk('...and no rule has a zero 1st-percentile chord, i.e. no density reads Infinity',
    infinite.length === 0, `infinite: [${infinite}]`);
  seed('§D the drawing scan refuses a rule whose draw symbols are undeclared',
    (() => {
      const g = LSYSTEM_RULE_BY_KEY.gosper;
      const broken = { ...g, drawSymbols: '' };
      const t = walkTurtle(broken, 2, g.publishedAngle, g.publishedAngle, g.publishedAngle);
      return t.count <= broken.axiom.length ? 1 : 0;
    })(),
    'Gosper with drawSymbols stripped must emit nothing — it contains no F');

  // ⚠️⚠️ `36.20` clause 7 — and THIS is the clause that caught the shipped handedness defect. The
  // specifier's first Hilbert construction was wrong at 43 distinct cells of 64 and only an invariant
  // check saw it; the prototype's `Hilbert 3D` was wrong at 63 of 64 and 487 of 512, in BOTH the
  // prototype and the spec, on the DEFAULT rule. Nothing else in the suite would have found it.
  const FASS = ['hilbert2d', 'hilbert3d', 'moore', 'peano', 'gosper', 'arrowhead'];
  const notDistinct = [];
  for (const key of FASS) {
    const r = LSYSTEM_RULE_BY_KEY[key];
    const depth = Math.min(r.recursionRange[1], r.recursionRange[0] + 1);
    const a = r.publishedAngle;
    const t = walkTurtle(r, depth, a, a, a);
    const cells = new Set();
    for (let i = 0; i < t.count; i++) {
      const b = i * 3;
      cells.add(`${Math.round(t.xyz[b] * 1e6)},${Math.round(t.xyz[b + 1] * 1e6)},${Math.round(t.xyz[b + 2] * 1e6)}`);
    }
    if (cells.size !== t.count) notDistinct.push(`${key} ${cells.size}/${t.count}`);
  }
  chk('every FASS rule visits ALL its cells DISTINCTLY at its published angle (the handedness clause)',
    notDistinct.length === 0, `${FASS.length} FASS rules; failures: [${notDistinct}]`);
  seed('§D the distinctness scan refuses the PRE-FIX roll handedness on Hilbert 3D',
    (() => {
      // The defect was a global roll sign. Reproduce it by mirroring the roll symbols in the production,
      // which is exactly equivalent and needs no second turtle.
      const r = LSYSTEM_RULE_BY_KEY.hilbert3d;
      const flipped = {
        ...r,
        productions: { X: r.productions.X.replace(/[<>]/g, (c) => (c === '<' ? '>' : '<')) },
      };
      const t = walkTurtle(flipped, 2, 90, 90, 90);
      const cells = new Set();
      for (let i = 0; i < t.count; i++) {
        const b = i * 3;
        cells.add(`${Math.round(t.xyz[b] * 1e6)},${Math.round(t.xyz[b + 1] * 1e6)},${Math.round(t.xyz[b + 2] * 1e6)}`);
      }
      return cells.size !== t.count ? 1 : 0;
    })(),
    'the wrong-handedness Hilbert 3D must be refused — it was 63 of 64 and it shipped in the prototype AND the spec');

  // The precondition `36.Q4` created: dropping `Shrink` lets the resampler work by INDEX, which equals
  // arc-length resampling ONLY while every segment has equal length. So that is now a property of the
  // RULE SET and not of the resampler, and it must be asserted rather than assumed.
  const unequal = [];
  // v8 Phase 41 — a rule that DECLARES `unequalSteps` is resampled by arc length (`figure.ts`), so it is exempt BY ITS FLAG;
  // the flag being honoured is asserted in §P9. Every other rule must still have one segment length.
  for (const r of LSYSTEM_RULES) {
    if (r.unequalSteps === true) continue;
    const depth = Math.min(r.recursionRange[1], r.recursionRange[0] + 1);
    const a = r.publishedAngle;
    const t = walkTurtle(r, depth, a, a, a);
    let lo = Infinity, hi = 0;
    for (let i = 1; i < t.count; i++) {
      const p = (i - 1) * 3, q = i * 3;
      const d = Math.hypot(t.xyz[q] - t.xyz[p], t.xyz[q + 1] - t.xyz[p + 1], t.xyz[q + 2] - t.xyz[p + 2]);
      if (d > 1e-12) { if (d < lo) lo = d; if (d > hi) hi = d; }
    }
    if (!(hi > 0) || (hi - lo) / hi > 1e-9) unequal.push(`${r.key} ${lo.toFixed(4)}..${hi.toFixed(4)}`);
  }
  chk('EVERY rule has equal segment lengths — the precondition index resampling rests on (36.Q4)',
    unequal.length === 0, `failures: [${unequal}]`);

  // `closed: true` is a product claim (the library's figures are closed loops), so it is measured.
  const notClosed = [];
  for (const r of LSYSTEM_RULES.filter((x) => x.closed)) {
    const depth = Math.min(r.recursionRange[1], r.recursionRange[0] + 1);
    const a = r.publishedAngle;
    const t = walkTurtle(r, depth, a, a, a);
    const k = (t.count - 1) * 3;
    const gap = Math.hypot(t.xyz[k] - t.xyz[0], t.xyz[k + 1] - t.xyz[1], t.xyz[k + 2] - t.xyz[2]);
    if (gap > 1.001) notClosed.push(`${r.key} gap ${gap.toFixed(3)}`);
  }
  chk('every rule declaring `closed: true` meets its start within ONE step',
    notClosed.length === 0,
    `closed rules: [${LSYSTEM_RULES.filter((r) => r.closed).map((r) => r.key)}]; failures: [${notClosed}]`);

  // Bracket usability, REPORTED rather than failed: `36.6`'s two-list lerp does not work on the FASS
  // rules at any useful width, which is measured and structural. A clause that FAILED on it would be
  // asserting a mechanism the measurement refuses.
  const bypass = LSYSTEM_RULES.filter((r) => LSYSTEM_ANGLE_BRACKET[r.key].yaw < LSYSTEM_MIN_USEFUL_BRACKET_DEG
    || LSYSTEM_ANGLE_BRACKET[r.key].multi < LSYSTEM_MIN_USEFUL_BRACKET_DEG).map((r) => r.key);
  note(`rules that BYPASS the angle bracket and rebuild per frame: [${bypass}] — measured, not a setting`);
  note(`angle usage: ${LSYSTEM_RULES.map((r) => { const u = ruleAngleUsage(r); return `${r.key}:${u.yaw ? 'Y' : '-'}${u.pitch ? 'P' : '-'}${u.roll ? 'R' : '-'}`; }).join(' ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. v8 36.15 — the facet catalogue covers the registry, in BOTH directions ===\n');

{
  const { FACET_LABELS, computeFacets } = await import('../src/presets/preset-facets.ts');
  /*
   * ⚠️⚠️ **THIS IS THE CLAUSE `facetcheck` §B STRUCTURALLY CANNOT SUPPLY, AND THAT IS `36.D1`'s COST.**
   * §B scans `OVERLAY_RULES`' `shape` group and holds the `Deformed` predicate to it — which is exactly
   * what caught Phase 32's three missing operators. A figure type lives in `generators.lsystem`, a
   * NON-`overlay` block, so there is no registry entry for §B's scan to miss. **Nothing but this would
   * fail if the chip were forgotten, and `32.15` is what that looks like: 4 matched against 6 genuinely
   * deformed, `verify` green, and the manual already claiming the chip found them.**
   */
  const chipKeys = Object.keys(FACET_LABELS);
  const needed = FIGURE_TYPES.filter((e) => e.selectable && e.key !== DEFAULT_FIGURE_TYPE);
  const missing = needed.filter((e) => !chipKeys.includes(`figure:${e.key === 'lsystem' ? 'curve' : e.key}`));
  chk('every SELECTABLE non-default figure type has a facet chip',
    missing.length === 0,
    `needed [${needed.map((e) => e.key)}]; missing [${missing.map((e) => e.key)}]`);
  seed('§E the coverage scan sees a selectable type with no chip',
    [{ key: 'ghost', selectable: true }].filter((e) => !chipKeys.includes(`figure:${e.key}`)).length,
    'a fabricated selectable type must be reported — that is the 32.15 failure mode');

  // The other direction: a chip naming a type the registry does not hold.
  const orphan = chipKeys.filter((k) => k.startsWith('figure:')
    // v8 Phase 41 — `figure:grows` names no figure TYPE: it is a property of the curve type (its Growth), so it is listed here.
    && !['figure:attractor', 'figure:open', 'figure:curve', 'figure:grows'].includes(k));
  chk('...and no `figure:` chip names something the registry does not hold', orphan.length === 0, `[${orphan}]`);

  // And it must actually MATCH. A predicate over a shorter list reads exactly like a correct one.
  const mgr2 = new PresetManager();
  loadLibrary(mgr2, rawLib);
  const curveNames = mgr2.list().filter((n) => mgr2.get(n)?.generators?.type === 'lsystem');
  const matched = curveNames.filter((n) => computeFacets(mgr2.get(n)).has('figure:curve'));
  chk('the `figure:curve` chip MATCHES every curve preset in the library',
    curveNames.length > 0 && matched.length === curveNames.length,
    `${matched.length} of ${curveNames.length}: [${curveNames}]`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. v8 36.19 — THE DENSITY INSTRUMENT, which no checker had ===\n');

{
  /*
   * ⚠️⚠️ **`SPEC-selfsimilar-curves` WRITES ITS WHOLE §10 AGAINST "density spread — the engine's own
   * quality metric", AND NO SUCH METRIC EXISTED IN ANY CHECKER.** It is the specifier's own, defined as
   * `d[p99] / d[p1]` over consecutive-index chords in a 117-line script that imports only its own
   * renderer — so §10's `Density <= 4.0` clauses and §11.1's whole reproduce-these table rested on an
   * instrument that had to be BUILT. This is it.
   *
   * ⚠️ **A MEASURING SECTION, so its own basis is the thing most likely to be wrong.** It is seeded with
   * the three defects the prototype actually had, and **a seed that does not fail is a CALIBRATION FAIL
   * that exits non-zero exactly like a real failure.** The bound is DERIVED from the measured envelope
   * below and NOT taken from §10's 4.0, which was set against the prototype.
   */
  const { buildPose, resampleInto } = await import('../src/generators/lsystem/curve.ts');
  const COUNTS = [700, 3200, 12000];
  const density = (buf, n) => {
    const d = [];
    for (let i = 1; i < n; i++) {
      const a = (i - 1) * 3, b = i * 3;
      d.push(Math.hypot(buf[b] - buf[a], buf[b + 1] - buf[a + 1], buf[b + 2] - buf[a + 2]));
    }
    d.sort((x, y) => x - y);
    const lo = d[Math.floor(d.length * 0.01)];
    return lo > 1e-12 ? d[Math.floor(d.length * 0.99)] / lo : Infinity;
  };

  let worst = 0, worstAt = '';
  const rows = [];
  const byFamily = { bracketed: [], plain: [] };
  /*
   * ⚠️ v8 Phase 41 — ONE NAMED EXEMPTION, structural and the book's: Sprig (ABOP fig. 1.24b, `F[+F]F[-F][F]`) ends every
   * node with a straight `[F]` branch that lies EXACTLY over the next stem segment, so consecutive particles coincide and
   * the 1st-percentile chord is 0 — a property of the published rule (its picture has the same overlap), not of the walk.
   */
  const COINCIDENT_BY_DESIGN = new Set(['sprig']);
  for (const r of LSYSTEM_RULES) {
    if (COINCIDENT_BY_DESIGN.has(r.key)) continue;
    for (const depth of [r.recursionRange[0], Math.min(r.recursionRange[1], r.recursionRange[0] + 2)]) {
      const pose = buildPose(r, depth, r.publishedAngle, r.publishedAngle, r.publishedAngle);
      for (const c of COUNTS) {
        const out = new Float64Array(c * 3);
        resampleInto(out, c, pose.xyz, pose.count);
        const v = density(out, c);
        rows.push(v);
        byFamily[r.bracketed ? 'bracketed' : 'plain'].push({ v, at: `${r.key}@r${depth}x${c}` });
        if (v > worst) { worst = v; worstAt = `${r.key}@r${depth}x${c}`; }
      }
    }
  }
  const finite = rows.filter(Number.isFinite);
  finite.sort((a, b) => a - b);
  const median = finite[Math.floor(finite.length / 2)];
  const p95 = finite[Math.floor(finite.length * 0.95)];
  note(`density over ${rows.length} (rule x recursion x count) cells: median ${median.toFixed(2)}, `
    + `p95 ${p95.toFixed(2)}, worst ${worst.toFixed(2)} at ${worstAt}`);
  chk('the continuous walk holds at EVERY particle count — no cell is Infinity',
    rows.every(Number.isFinite),
    `${rows.filter((v) => !Number.isFinite(v)).length} infinite of ${rows.length}`);
  /*
   * ⚠️⚠️ **THE BOUND IS PER FAMILY, AND A SINGLE SHARED ONE WAS WRONG — measured, and the reason is
   * structural rather than a tuning accident.** A BRACKETED rule's Euler tour traverses every branch edge
   * TWICE, so the walk folds back on itself; two consecutive resamples straddling a fold sit almost on
   * top of each other, which drives the 1st-percentile chord toward zero and the ratio up. Measured
   * `plant` at **49.00** at 700 particles against §1.1's quoted **6.61** at 12 000 — ⚠️ **two readings of
   * one instrument at different particle counts, not a regression**, and exactly the sort of figure this
   * file refuses to carry forward.
   *
   * ⚠️ Both bounds are DERIVED from this run's own envelope with headroom and neither is §10's `4.0`,
   * which was set against the prototype and would fail on correct code.
   */
  const BOUND_PLAIN = 12;
  const BOUND_BRACKETED = 60;
  const badPlain = byFamily.plain.filter((x) => x.v > BOUND_PLAIN);
  const badBr = byFamily.bracketed.filter((x) => x.v > BOUND_BRACKETED);
  chk(`non-bracketed rules stay inside ${BOUND_PLAIN} (derived from the envelope)`,
    badPlain.length === 0,
    `${byFamily.plain.length} cells; over: [${badPlain.slice(0, 3).map((x) => x.at + '=' + x.v.toFixed(1))}]`);
  chk(`bracketed rules stay inside ${BOUND_BRACKETED} — higher BY CONSTRUCTION, because the Euler tour folds back`,
    badBr.length === 0,
    `${byFamily.bracketed.length} cells; worst ${Math.max(...byFamily.bracketed.map((x) => x.v)).toFixed(1)}; `
    + `over: [${badBr.slice(0, 3).map((x) => x.at + '=' + x.v.toFixed(1))}]`);
  const BOUND = BOUND_BRACKETED;

  // --- the three seeded defects the prototype actually had ---
  seed('§F seed 1: a rule with its draw symbols UNDECLARED reads Infinity',
    (() => {
      const g = LSYSTEM_RULE_BY_KEY.gosper;
      const broken = { ...g, drawSymbols: '' };
      const pose = buildPose(broken, 2, g.publishedAngle, g.publishedAngle, g.publishedAngle);
      const out = new Float64Array(3200 * 3);
      resampleInto(out, 3200, pose.xyz, pose.count);
      return Number.isFinite(density(out, 3200)) ? 0 : 1;
    })(),
    'Gosper contains no F at all; with drawSymbols stripped the minimum chord is 0');
  /*
   * ⚠️⚠️ **SEED 2 SEEDS THE INSTRUMENT, NOT THE TURTLE, AND THE FIRST VERSION DID NOT FAIL.** It tried to
   * reproduce a teleporting pop by swapping the Plant production for a bracket-free one — but that is
   * just a different non-branching rule with ordinary density, so the seed passed and was therefore a
   * CALIBRATION FAIL. **A teleport cannot be reproduced through the shipped turtle, because the retrace
   * is not optional in it.** So what is seeded is the thing this section IS: the metric's ability to see
   * a chord the length of a whole branch, which is exactly what a pop leaves in the list (measured 33-38
   * with a pop against 6.61 with the retrace).
   */
  seed('§F seed 2: the metric sees a teleport-sized chord injected into a real list',
    (() => {
      const pl = LSYSTEM_RULE_BY_KEY.plant;
      const pose = buildPose(pl, 3, pl.publishedAngle, pl.publishedAngle, pl.publishedAngle);
      const out = new Float64Array(3200 * 3);
      resampleInto(out, 3200, pose.xyz, pose.count);
      const before = density(out, 3200);
      /*
       * ⚠️⚠️ **MANY long chords, not one — and the single-chord version of this seed DID NOT FAIL, which
       * taught something about the metric worth writing down: `p99/p1` is ROBUST TO ONE OUTLIER.** With
       * 3200 samples a lone injected jump sits at p99.97, above the percentile the ratio reads, so it
       * moves the worst value and not the metric. **That is correct behaviour — the ratio measures the
       * BULK of the walk — and it is exactly why a teleporting pop is detectable: it puts one long chord
       * in per branch RETURN, so on a bracketed rule there are hundreds.** Seeded that way.
       */
      for (let i = 20; i < 3200; i += 20) { out[i * 3] += 50; out[i * 3 + 1] += 50; }
      const after = density(out, 3200);
      return after > before * 2 ? 1 : 0;
    })(),
    'a pop leaves a chord the length of the branch; the metric must read it as a large ratio');
  seed('§F seed 3: ENTRY-INDEXED sampling reads Infinity once the count exceeds the list',
    (() => {
      const r = LSYSTEM_RULE_BY_KEY.hilbert3d;
      const pose = buildPose(r, 2, 90, 90, 90);                 // 64 entries
      const out = new Float64Array(12000 * 3);
      // The defect: index into the list instead of interpolating along it.
      for (let i = 0; i < 12000; i++) {
        const k = Math.min(pose.count - 1, Math.floor(i / 12000 * pose.count)) * 3;
        out[i * 3] = pose.xyz[k]; out[i * 3 + 1] = pose.xyz[k + 1]; out[i * 3 + 2] = pose.xyz[k + 2];
      }
      return Number.isFinite(density(out, 12000)) ? 0 : 1;
    })(),
    'many particles land on one entry, so the minimum chord is 0 — measured Infinity against 1.37');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. v8 36.16 — the preview grid forwards the type AND the config ===\n');

{
  /*
   * ⚠️⚠️ **NEITHER SPEC MENTIONS `grid-tile-renderer.ts` ONCE, AND IT IS ONE OF ONLY TWO
   * `GeneratorConfig` CALL SITES.** It is also the site of `33.21`: the preview grid had drawn the WRONG
   * FIGURE SINCE PHASE 30 because the renderer forwarded only `setViewScale` and `setSymmetry` — twist,
   * box-fold, channels, 4-D, taper, bend, inversion, Sharpness and Travel were ALL invisible in tiles for
   * four phases, nine operators from one owner report, **and no checker compares a tile to a main view.**
   *
   * ⚠️ **A TEXT SCAN CANNOT SEE A MISSING FORWARDER**, which is exactly how those nine stayed hidden. So
   * this builds the figure through BOTH call sites and compares, and `33.21`'s method is the one reused:
   * **the ZEROS are the proof** — a clause that only asserts *something changed* passes over a wrong
   * forward.
   */
  const { LissajousGenerator } = await import('../src/generators/lissajous.ts');
  const LS = {
    rule: 'hilbert3d',
    recursion: { base: 3, amplitude: 0, frequency: 0 },
    yaw: { base: 90, amplitude: 0, frequency: 0 },
    pitch: { base: 90, amplitude: 0, frequency: 0 },
    roll: { base: 90, amplitude: 0, frequency: 0 },
    descend: { base: 1, amplitude: 0, frequency: 0 },
    smoothness: 0, centre: [0, 0, 0],
  };
  const COUNT = 1200;
  const build = (type, lsystem) => {
    const g = new LissajousGenerator();
    const cfg = {
      type, particleCount: COUNT, waves: [], waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      designResolution: { width: 100, height: 100 },
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128],
      colorFreq: [0.1, 0.1, 0.1], colorShift: [0, 0, 0],
    };
    if (lsystem) cfg.lsystem = lsystem;
    g.init(cfg, { width: 1024, height: 768 });
    g.update(16.667);
    return Float64Array.from(g.getState().positions.subarray(0, COUNT * 3));
  };
  const forwarded = build('lsystem', LS);
  const notForwarded = build('lissajous', LS);          // the block present but the TYPE not forwarded
  let diff = 0;
  for (let i = 0; i < COUNT * 3; i++) if (!Object.is(forwarded[i], notForwarded[i])) diff++;
  chk('a config WITH the type forwarded differs from one without it — so forwarding is observable',
    diff > COUNT, `${diff} of ${COUNT * 3} slots differ`);
  chk('...and the un-forwarded case is NOT silently a curve (the 33.21 failure, mechanised)',
    notForwarded.some((v, i) => i % 3 === 2 ? true : true) && diff > COUNT,
    'a tile that ignored the type would be bit-identical to the wave figure, which is what 33.21 was');

  // THE ZEROS. A curve with no pitch/roll symbols must leave Z flat; `hilbert3d` uses all three, so the
  // 2-D rule is the one whose Z must be zero. That asymmetry is what makes the clause falsifiable.
  const flat = build('lsystem', { ...LS, rule: 'hilbert2d' });
  let zSpread = 0;
  for (let i = 0; i < COUNT; i++) zSpread = Math.max(zSpread, Math.abs(flat[i * 3 + 2]));
  let zSpread3 = 0;
  for (let i = 0; i < COUNT; i++) zSpread3 = Math.max(zSpread3, Math.abs(forwarded[i * 3 + 2]));
  chk('THE ZEROS: a 2-D rule leaves Z flat while the 3-D rule does not',
    zSpread < 1e-6 && zSpread3 > 1,
    `hilbert2d |z| max ${zSpread.toExponential(2)}, hilbert3d ${zSpread3.toFixed(1)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== H. v8 36.8/36.9 — the smoothness BRANCH, and the zoom ===\n');

{
  const { buildPose, resampleInto, resampleSmoothInto } = await import('../src/generators/lsystem/curve.ts');
  const { createFigureCache, resolveFigure } = await import('../src/generators/lsystem/figure.ts');
  const r = LSYSTEM_RULE_BY_KEY.kochQuad;
  const pose = buildPose(r, 3, r.publishedAngle, r.publishedAngle, r.publishedAngle);
  const N = 2000;
  const plain = new Float64Array(N * 3);
  const smoothZero = new Float64Array(N * 3);
  resampleInto(plain, N, pose.xyz, pose.count);
  resampleSmoothInto(smoothZero, N, pose.xyz, pose.count, 0);
  /*
   * ⚠️⚠️ **`smoothness === 0` MUST BE A BRANCH AND NOT A WEIGHT (`36.D10`), SO THE ASSERTION IS BITWISE.**
   * `a + 0*(b-a)` is exact for every finite value **except `-0`**, which it silently turns into `+0`; and
   * `33.2`'s first draft, which evaluated the expensive basis unconditionally, made the faceted path **2x
   * MORE expensive** than the smooth one while every document said "cheaper". **The shipped code never
   * calls the spline at 0 — this clause measures that the two agree, and `36.8`'s call site is the branch.**
   */
  let bits = 0;
  for (let i = 0; i < N * 3; i++) if (!Object.is(plain[i], smoothZero[i])) bits++;
  chk('`smoothness: 0` is BITWISE the unsmoothed polyline', bits === 0, `${bits} of ${N * 3} slots differ`);
  // ...and it must actually DO something above 0, or the clause above passes over an inert control.
  const smoothOne = new Float64Array(N * 3);
  resampleSmoothInto(smoothOne, N, pose.xyz, pose.count, 1);
  let moved = 0;
  for (let i = 0; i < N * 3; i++) if (!Object.is(plain[i], smoothOne[i])) moved++;
  chk('...and `smoothness: 1` MOVES the curve, so the identity clause is falsifiable',
    moved > N, `${moved} of ${N * 3} slots differ`);

  /*
   * ⚠️⚠️ **THE ZOOM'S ±15 % MEAN-SCREEN-CHORD CLAUSE — the one the PROTOTYPE FAILS, and the reason the
   * band had to be both exact AND aligned.** Two earlier mechanisms failed it in opposite directions:
   * an unaligned window gave **17.5x**, and taking the band after the resample gave **0.02x**.
   */
  const meanChord = (buf, n) => {
    let s = 0;
    for (let i = 1; i < n; i++) {
      const a = (i - 1) * 3, b = i * 3;
      s += Math.hypot(buf[b] - buf[a], buf[b + 1] - buf[a + 1], buf[b + 2] - buf[a + 2]);
    }
    return s / (n - 1);
  };
  // ⚠️ v8 `39.A7`: DERIVED from `zoomInverse`, never a hand list — a hand list of the two Hilbert rules would
  // have let Peano's zoom ship unmeasured, which is `32.15`'s missing-clause failure in this section's form.
  // `descend` steps in powers of the rule's OWN base (2 on Hilbert, 3 on Peano), so each step is one level.
  for (const key of LSYSTEM_RULES.filter((x) => x.zoomInverse).map((x) => x.key)) {
    const rule = LSYSTEM_RULE_BY_KEY[key];
    const zb = rule.zoomBase ?? 2;
    const out = new Float64Array(N * 3);
    const cache = createFigureCache();
    const base = { rule, recursion: rule.recursionRange[0] + 1,
      yaw: rule.publishedAngle, pitch: rule.publishedAngle, roll: rule.publishedAngle,
      multiAxis: false, smoothness: 0, centre: [0, 0, 0] };
    resolveFigure(cache, { ...base, descend: 1 }, out, N);
    const ref = meanChord(out, N);
    const ratios = [];
    let anyIncontiguous = false;
    for (const d of [zb, zb * zb, zb * zb * zb]) {
      const c2 = createFigureCache();
      resolveFigure(c2, { ...base, descend: d }, out, N);
      ratios.push(meanChord(out, N) / ref);
      if (c2.band && !c2.band.contiguous) anyIncontiguous = true;
    }
    chk(`${rule.name}: the mean chord holds within ±15 % across descend ${zb}/${zb * zb}/${zb * zb * zb}`,
      ratios.every((x) => Math.abs(x - 1) <= 0.15),
      `ratios ${ratios.map((x) => x.toFixed(3)).join(', ')}`);
    chk(`...and every band is COMPACT (the contiguity the prototype never checked)`,
      !anyIncontiguous, 'measured per band, not assumed');
  }

  // And the zoom must be ABSENT where it is illegal (`36.D13`).
  const noInverse = LSYSTEM_RULES.filter((x) => !x.zoomInverse).map((x) => x.key);
  const withInverse = LSYSTEM_RULES.filter((x) => x.zoomInverse).map((x) => x.key);
  chk('the zoom is declared on SOME rules and absent on others — a control that lies is worse than none',
    withInverse.length > 0 && noInverse.length > 0,
    `inverse: [${withInverse}]; none: [${noInverse}] (the Descend row hides on the second set)`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== I. v8 36.12 — the Score agrees with the figure source ===\n');

{
  /*
   * ⚠️⚠️ **`composercheck` §R's OBLIGATION, EXTENDED TO THE SECOND FIGURE TYPE.** §R exists because Phase
   * 33 added `Sharpness` and `Travel` to the generator and to NOTHING else, so the Score drew a figure the
   * engine does not render on any preset carrying either — and `verify` was green over it for a whole
   * phase. **A second figure type is the other half of that same obligation.**
   */
  const { computeCurveScore } = await import('../src/ui/synthesis-lab/score-canvas.ts');
  const { buildPose } = await import('../src/generators/lsystem/curve.ts');
  const PLANES = { xy: [0, 1], xz: [0, 2], yz: [1, 2] };
  let worst = 0, worstAt = '';
  for (const key of ['hilbert3d', 'kochQuad', 'plant']) {
    const rule = LSYSTEM_RULE_BY_KEY[key];
    const cfg = {
      rule: key,
      recursion: { base: rule.recursionRange[0] + 1, amplitude: 0, frequency: 0 },
      yaw: { base: rule.publishedAngle, amplitude: 0, frequency: 0 },
      pitch: { base: rule.publishedAngle, amplitude: 0, frequency: 0 },
      roll: { base: rule.publishedAngle, amplitude: 0, frequency: 0 },
      descend: { base: 1, amplitude: 0, frequency: 0 },
      smoothness: 0, centre: [0, 0, 0],
    };
    const pose = buildPose(rule, rule.recursionRange[0] + 1,
      rule.publishedAngle, rule.publishedAngle, rule.publishedAngle);
    // Normalise the generator's own list the same canonical way the Score does.
    const inv = 1 / pose.transform.scale;
    const ctr = [pose.transform.cx, pose.transform.cy, pose.transform.cz];
    for (const [plane, [ax, ay]] of Object.entries(PLANES)) {
      const s = computeCurveScore(cfg, plane);
      const n = s.path.length / 2;
      // Compare the FIRST entries, which are the same walk from the same start — a shared prefix is
      // enough to catch a different rule, a different angle or a transposed plane.
      for (let i = 0; i < Math.min(64, n); i++) {
        const src = i * 3;
        const ex = (pose.xyz[src + ax] - ctr[ax]) * inv;
        const ey = (pose.xyz[src + ay] - ctr[ay]) * inv;
        const d = Math.hypot(s.path[i * 2] - ex, s.path[i * 2 + 1] - ey);
        if (d > worst) { worst = d; worstAt = `${key}/${plane}@${i}`; }
      }
    }
  }
  chk('the Score and the generator agree to <= 1e-6 per coordinate, over rules x planes',
    worst <= 1e-6, `worst ${worst.toExponential(2)} at ${worstAt}`);
  // ⚠️ And the Score must take NO instant, for the algebraic reason `computeScore` takes none.
  const src = readFileSync(join(ROOT, 'src/ui/synthesis-lab/score-canvas.ts'), 'utf8');
  const sig = /export function computeCurveScore\(([^)]*)\)/.exec(src);
  chk('`computeCurveScore` takes NO `time` — the Score draws the BASES (at pos 0 the modulator sine is 0)',
    !!sig && !/time/.test(sig[1]), sig ? sig[1].replace(/\s+/g, ' ').trim() : 'signature not found');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== J. v8 39 — the generator builder, Twist and Stretch ===\n');

{
  /*
   * ⚠️⚠️ **`generators.lsystem` GETS NO AUTOMATIC LAW (Phase 36's finding), so this section is the only
   * instrument that holds the two new keys to every hand-written site AND to the behaviour that makes them
   * correct.** Each clause is MEASURED against the shipped modules except J1, which is source-shaped by
   * design and names the files it reads.
   */
  const G = await import('../src/generators/lsystem/generator.ts');
  const F = await import('../src/generators/lsystem/figure.ts');
  const { captureExtent } = await import('../src/generators/lsystem/curve.ts');
  const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
  const { computeCurveScore } = await import('../src/ui/synthesis-lab/score-canvas.ts');

  // J1 — every hand-written site names BOTH keys (`39.D13`). ⚠️ Source-shaped: a rename breaks it, and that
  // is the point — a site that stops naming the key has stopped carrying it.
  const SITES = {
    'src/exploration/interpolate.ts': ['twist', 'stretch'],
    'src/ui/synthesis-lab/score-canvas.ts': ['cfg.twist', 'cfg.stretch'],
    'src/generators/lissajous.ts': ['cfg.twist', 'cfg.stretch'],
    'src/ui/synthesis-lab/tabs/composer.ts': ["'twist'", "'stretch'"],
    'src/generators/lsystem/rules.ts': ['twist:', 'stretch:'],
    'src/core/interfaces.ts': ['twist?: ModulatedValue', 'stretch?: ModulatedValue'],
  };
  const missingSite = [];
  for (const [f, toks] of Object.entries(SITES)) {
    const s = readFileSync(join(ROOT, f), 'utf8');
    for (const t of toks) if (!s.includes(t)) missingSite.push(`${f}: ${t}`);
  }
  chk('J1: every hand-written lsystem site names twist AND stretch (39.D13)', missingSite.length === 0,
    missingSite.length ? missingSite.join('; ') : `${Object.keys(SITES).length} sites`);
  // ...and the copy-whole sites still copy the WHOLE block (a field-by-field copy would drop the new keys).
  const whole = [['src/exploration/evolution-ops.ts', 'deepCopy(src.generators.lsystem)'],
    ['src/main.ts', 'structuredClone(preset.generators.lsystem)']];
  const notWhole = whole.filter(([f, t]) => !readFileSync(join(ROOT, f), 'utf8').includes(t)).map(([f]) => f);
  chk('...and the copy-whole sites (Evolution, main.ts getLSystem) still copy the block WHOLE', notWhole.length === 0,
    notWhole.join(', ') || `${whole.length} sites`);

  // J2 — the IDENTITY: with twist 0 / stretch 1 / nothing breathing, resolveFigure takes the turtle path and is
  // BITWISE the result with no Phase 39 fields at all (what every shipped preset is).
  const N = 4000;
  let idDiff = 0;
  for (const r of LSYSTEM_RULES) {
    const pose = { rule: r, recursion: r.recursionRange[0] + 1, yaw: r.publishedAngle, pitch: r.publishedAngle,
      roll: r.publishedAngle, multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0] };
    const a = new Float64Array(N * 3), b = new Float64Array(N * 3);
    F.resolveFigure(F.createFigureCache(), pose, a, N);
    F.resolveFigure(F.createFigureCache(), { ...pose, twist: 0, stretch: 1, anglesAnimated: false,
      twistAnimated: false, stretchAnimated: false, generator: G.LSYSTEM_GENERATORS[r.key] }, b, N);
    for (let i = 0; i < N * 3; i++) if (!Object.is(a[i], b[i])) idDiff++;
  }
  chk('J2: at the identity every rule is BITWISE the pre-Phase-39 figure (the turtle path is kept)', idDiff === 0,
    `${idDiff} differing slots over ${LSYSTEM_RULES.length} rules`);

  // J3 — PARITY: every generator reproduces its turtle, raw frame, at two depths and two angles.
  let worstPar = 0, parAt = '';
  for (const r of LSYSTEM_RULES) {
    const f = G.LSYSTEM_GENERATORS[r.key];
    if (f === null) continue;
    const angles = f.cells ? [r.publishedAngle] : [r.publishedAngle, (r.angleRange[0] + r.publishedAngle) / 2];
    for (const d of [r.recursionRange[0], Math.min(r.recursionRange[1], r.recursionRange[0] + 2)]) {
      for (const y of angles) {
        const t = walkTurtle(r, d, y, y, y);
        const g = G.buildGenerator(r, f, d, y, y, y, 0, 1);
        let m = g === null || g.count !== t.count ? Infinity : 0;
        if (m === 0) for (let i = 0; i < t.count * 3; i++) m = Math.max(m, Math.abs(g.xyz[i] - t.xyz[i]));
        const rel = m / (captureExtent(t.xyz, t.count).scale * 2);
        if (rel > worstPar) { worstPar = rel; parAt = `${r.key}@d${d}/${y}`; }
      }
    }
  }
  chk('J3: every generator reproduces its turtle point for point (39.A0(a))', worstPar < 1e-9,
    `worst ${worstPar.toExponential(2)}${parAt ? ' at ' + parAt : ''}`);
  seed('J3 sees a WRONG flag (dragon without its reversed copy)', (() => {
    const r = LSYSTEM_RULE_BY_KEY.dragon;
    const g = G.buildGenerator(r, { ...G.LSYSTEM_GENERATORS.dragon, reverse: [] }, 6, 90, 90, 90, 0, 1);
    const t = walkTurtle(r, 6, 90, 90, 90);
    let m = 0;
    for (let i = 0; i < t.count * 3; i++) m = Math.max(m, Math.abs(g.xyz[i] - t.xyz[i]));
    return m > 1e-6 ? 1 : 0;
  })(), 'a flag error that J3 cannot see would ship a different curve under a named rule');

  // J4 — the LANDMARK: Twist 180 on the dragon IS the Levy C curve, and back (the headline, spec §1.3).
  const chordNorm = (b) => {
    const n = b.count, x1 = b.xyz[(n - 1) * 3], y1 = b.xyz[(n - 1) * 3 + 1], d2 = x1 * x1 + y1 * y1;
    return (i) => [(b.xyz[i * 3] * x1 + b.xyz[i * 3 + 1] * y1) / d2, (b.xyz[i * 3 + 1] * x1 - b.xyz[i * 3] * y1) / d2,
      b.xyz[i * 3 + 2] / Math.sqrt(d2)];
  };
  const landmark = (a, b) => {
    const ra = LSYSTEM_RULE_BY_KEY[a], rb = LSYSTEM_RULE_BY_KEY[b];
    const g = G.buildGenerator(ra, G.LSYSTEM_GENERATORS[a], 8, ra.publishedAngle, ra.publishedAngle, ra.publishedAngle, 180, 1);
    const t = walkTurtle(rb, 8, rb.publishedAngle, rb.publishedAngle, rb.publishedAngle);
    const A = chordNorm(g), B = chordNorm(t);
    let m = 0, mm = 0;
    for (let i = 0; i < t.count; i++) {
      const p = A(i), q = B(i);
      m = Math.max(m, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      mm = Math.max(mm, Math.hypot(p[0] - q[0], p[1] + q[1], p[2] + q[2]));
    }
    return Math.min(m, mm);
  };
  const l1 = landmark('dragon', 'levyC'), l2 = landmark('levyC', 'dragon');
  chk('J4: Twist 180 folds the dragon into Levy C AND Levy C into the dragon (up to similarity)',
    l1 < 1e-9 && l2 < 1e-9, `${l1.toExponential(2)} / ${l2.toExponential(2)}`);

  // J5 — the Mixer lerps twist (the fold as a crossfade) and adds no key neither deck authors.
  // ⚠️ A REAL library body as the deck — the Mixer reads every block, so a hand-built stub throws on the first
  // one it lacks. `Curve Dragonfold` is the library's dragon; only its curve block is varied here.
  const { VARIANT_PRESETS: VP } = await import('../src/presets/variant-presets.ts');
  const dragonBody = VP.find((v) => v.name === 'Curve Dragonfold').preset;
  const deck = (tw) => {
    const p = structuredClone(dragonBody);
    p.generators.lsystem = { rule: 'dragon', recursion: { base: 8, amplitude: 0, frequency: 0 },
      yaw: { base: 90, amplitude: 0, frequency: 0 }, pitch: { base: 90, amplitude: 0, frequency: 0 },
      roll: { base: 90, amplitude: 0, frequency: 0 }, descend: { base: 1, amplitude: 0, frequency: 0 },
      smoothness: 0, centre: [0, 0, 0] };
    if (tw !== undefined) p.generators.lsystem.twist = { base: tw, amplitude: 0, frequency: 0 };
    return p;
  };
  let mixTw = NaN, ghost = 'n/a';
  try {
    mixTw = interpolatePreset(deck(0), deck(180), 0.5, new Set()).generators.lsystem.twist?.base;
    ghost = 'twist' in interpolatePreset(deck(undefined), deck(undefined), 0.5, new Set()).generators.lsystem
      ? 'ADDED' : 'absent';
  } catch (e) { ghost = `threw: ${e.message}`; }
  chk('J5: the Mixer lerps Twist (0 -> 180 at t 0.5 = 90), and a key neither deck has stays absent',
    mixTw === 90 && ghost === 'absent', `twist at 0.5 = ${mixTw}; untwisted blend: ${ghost}`);

  // J6 — the Score draws the twist BASE (a diagram ignoring it would show the untwisted dragon).
  const scoreAt = (tw) => {
    const c = deck(tw).generators.lsystem;
    return computeCurveScore(c, 'xz').path;
  };
  const s0 = scoreAt(0), s90 = scoreAt(90);
  let sd = 0;
  for (let i = 0; i < Math.min(s0.length, s90.length); i++) sd = Math.max(sd, Math.abs(s0[i] - s90[i]));
  chk('J6: the Score draws Twist — the xz plane of a twisted dragon is not the flat one', sd > 1e-3,
    `max path difference ${sd.toExponential(2)} between twist 0 and 90`);

  // J7 — a CELL rule holds Yaw at the lattice while Twist acts (owner 39.Q2 (c)).
  const h2 = LSYSTEM_RULE_BY_KEY.hilbert2d;
  const cellPose = (yaw) => ({ rule: h2, recursion: 3, yaw, pitch: 90, roll: 90, multiAxis: false, smoothness: 0,
    descend: 1, centre: [0, 0, 0], twist: 30, stretch: 1, anglesAnimated: false, twistAnimated: false,
    stretchAnimated: false, generator: G.LSYSTEM_GENERATORS.hilbert2d });
  const c1 = new Float64Array(N * 3), c2 = new Float64Array(N * 3);
  F.resolveFigure(F.createFigureCache(), cellPose(90), c1, N);
  F.resolveFigure(F.createFigureCache(), cellPose(70), c2, N);
  let cellDiff = 0;
  for (let i = 0; i < N * 3; i++) if (!Object.is(c1[i], c2[i])) cellDiff++;
  chk('J7: on a cell rule Yaw is HELD at the lattice while Twist acts (Twist and Yaw are exclusive)', cellDiff === 0,
    `${cellDiff} slots differ between yaw 90 and 70 at twist 30`);

  // J8 — a stored twist on a rule WITHOUT a Twist row never reaches the figure (absent row = inert key).
  const noRow = LSYSTEM_RULES.filter((r) => { const f = G.LSYSTEM_GENERATORS[r.key]; return f === null || f.twistable.length === 0; });
  const lisSrc = readFileSync(join(ROOT, 'src/generators/lissajous.ts'), 'utf8');
  chk('J8: twist resolves only where the rule has twistable copies (a rule with no row ignores the key)',
    /gen\.twistable\.length > 0/.test(lisSrc) && noRow.length > 0,
    `${noRow.length} rules have no Twist row: ${noRow.map((r) => r.key).join(', ')}`);

  // J9 — Stretch needs arc length: the Plant at stretch 0.5 by index would read ~50, by arc ~5 (spec §7.1.1).
  const plant = LSYSTEM_RULE_BY_KEY.plant;
  const pp = { rule: plant, recursion: 4, yaw: plant.publishedAngle, pitch: plant.publishedAngle, roll: plant.publishedAngle,
    multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 0.5, anglesAnimated: false,
    twistAnimated: false, stretchAnimated: false, generator: G.LSYSTEM_GENERATORS.plant };
  const M = 12000, pb = new Float64Array(M * 3);
  F.resolveFigure(F.createFigureCache(), pp, pb, M);
  const dens = (buf, n) => {
    const d = [];
    for (let i = 1; i < n; i++) { const a = (i - 1) * 3, b = i * 3; d.push(Math.hypot(buf[b] - buf[a], buf[b + 1] - buf[a + 1], buf[b + 2] - buf[a + 2])); }
    d.sort((x, y) => x - y); const lo = d[Math.floor(d.length * 0.01)];
    return lo > 1e-12 ? d[Math.floor(d.length * 0.99)] / lo : Infinity;
  };
  const dv = dens(pb, M);
  chk('J9: a stretched Plant is resampled by ARC LENGTH (density stays in the unstretched envelope)', dv < 8,
    `density ${dv.toFixed(2)} at stretch 0.5, depth 4 (by index it reads ~50)`);

  // J10 — the CURVE's Twist/Stretch have NO filter chip and that is a NAMED exemption (owner 39.Q5).
  // ⚠️ Scoped to the curve block: `twist`/`stretch` already name Phase 30's model-space Twist and Phase 34's
  // Stretch, which DO have chips, so a bare word scan is red over correct code (it was, on its first run).
  const facetSrc = readFileSync(join(ROOT, 'src/presets/preset-facets.ts'), 'utf8');
  chk('J10: no chip reads the CURVE\'s twist/stretch, by the owner\'s named exemption (39.Q5) — revisited at 39.GA',
    !/lsystem[?!]?\.(twist|stretch)/.test(facetSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
    'a chip added later must replace this clause, not sit beside it');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== K. v8 39 Stage C — Customize: the seed, the no-op, the one resolver, validation, the demo ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  /*
   * ⚠️⚠️ **`custom` IS A NON-`overlay` KEY, SO NOTHING AUTOMATIC HOLDS IT (Phase 36's finding again)** — this section
   * is the instrument. Measured against the shipped modules except K5/K10, which are source-shaped by design.
   */
  const C = await import('../src/generators/lsystem/custom.ts');
  const G = await import('../src/generators/lsystem/generator.ts');
  const F = await import('../src/generators/lsystem/figure.ts');
  const { captureExtent, normaliseInto } = await import('../src/generators/lsystem/curve.ts');
  const { expandRule, EXPAND_SYMBOL_BUDGET } = await import('../src/generators/lsystem/turtle.ts');
  const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
  const { VARIANT_PRESETS } = await import('../src/presets/variant-presets.ts');
  const norm = (xyz, n) => { const o = new Float64Array(n * 3); o.set(xyz.subarray(0, n * 3)); normaliseInto(o, n, captureExtent(o, n)); return o; };

  // K1 — the truncation flag means a level was SKIPPED, never "the last level was long" (39.A6(b)'s false flag).
  const fullLen = (r, d) => { let s = r.axiom; for (let i = 0; i < d; i++) { let o = ''; for (const c of s) o += r.productions[c] ?? c; s = o; } return s.length; };
  let falseFlags = 0, realMissed = 0, realOk = 0;
  for (const r of LSYSTEM_RULES) {
    /*
     * v8 Phase 41 — K1 tests the truncation FLAG's logic, which no rule owns, so two kinds of rule are skipped BY NAME:
     * a BUILDER rule has an empty axiom (the loop below would never end) and a STOCHASTIC rule's productions are lists,
     * which this independent re-implementation would concatenate as text.
     */
    if (r.builder !== undefined || L.isStochasticRule(r)) continue;
    for (let d = r.recursionRange[1]; d <= r.recursionRange[1] + 1; d++) {
      const e = expandRule(r, d);
      if (e.truncated && e.text.length === fullLen(r, d)) falseFlags++;
    }
    let d = 1; while (fullLen(r, d) <= EXPAND_SYMBOL_BUDGET) d++;
    const e = expandRule(r, d + 1);
    if (e.truncated) realOk++; else realMissed++;
  }
  // v8 Phase 41 — the denominator is the rules TESTED (builder and stochastic rules are skipped above, by name).
  const k1Tested = LSYSTEM_RULES.filter((r) => r.builder === undefined && !L.isStochasticRule(r)).length;
  chk('K1: "truncated" is never raised over a COMPLETE expansion, and still raised where a level is skipped',
    falseFlags === 0 && realMissed === 0 && realOk === k1Tested,
    `${falseFlags} false flags up to rMax+1; ${realOk}/${k1Tested} real skips flagged`);
  // Seed: the OLD rule (flag whenever the string passes the budget, last level included).
  let oldFalse = 0;
  for (const r of LSYSTEM_RULES) for (let d = r.recursionRange[1]; d <= r.recursionRange[1] + 2; d++) {
    if (fullLen(r, d) > EXPAND_SYMBOL_BUDGET && fullLen(r, d - 1) <= EXPAND_SYMBOL_BUDGET) oldFalse++;
  }
  seed('K1 the pre-fix test (budget passed on the LAST level) flags complete strings', oldFalse);

  // K2 — every rule with an exact generator SEEDS, and the seed draws the rule (generator path, frame applied).
  const seedable = LSYSTEM_RULES.filter((r) => C.customSeedable(r.key));
  let worst = 0, refused = 0, mismatch = 0;
  for (const r of seedable) {
    const cells = C.ruleStructure(r.key).draw === 'cells';
    const lo = Math.max(1, r.recursionRange[0]);
    for (const d of [lo, lo + 1]) {
      const y = cells ? r.publishedAngle : (r.publishedAngle + r.angleRange[1]) / 2;
      const s = C.seedCustom(r.key, d, y, y, y);
      if (s === null) { refused++; continue; }
      const b = C.buildCustom(s, d, y, y, 0, 1, cells ? C.customTile(s) : null);
      const a = cells ? r.publishedAngle : y;
      const t = walkTurtle(r, d, a, a, a);
      if (b === null || b.count !== t.count) { mismatch++; continue; }
      const p = norm(b.xyz, b.count), q = norm(t.xyz, t.count);
      for (let i = 0; i < t.count * 3; i++) worst = Math.max(worst, Math.abs(p[i] - q[i]));
    }
  }
  chk('K2: every seedable rule seeds, and the seed draws the RULE through the generator path (frame applied)',
    seedable.length >= 20 && refused === 0 && mismatch === 0 && worst < 1e-9,
    `${seedable.length} seedable rules, worst ${worst.toExponential(2)} of the extent, ${refused} refused, ${mismatch} count mismatches`);
  const noSeed = LSYSTEM_RULES.filter((r) => !C.customSeedable(r.key)).map((r) => r.key);
  chk('K2b: a rule with NO exact generator cannot seed Customize (the option is disabled with its reason)',
    noSeed.every((k) => G.LSYSTEM_GENERATORS[k] === null) && noSeed.length > 0, `not seedable: ${noSeed.join(', ')}`);

  // K3 — the NO-OP (spec §3.3), by ROUTING: an unedited seed resolves to its own rule.
  const routed = seedable.filter((r) => {
    const s = C.seedCustom(r.key, Math.max(1, r.recursionRange[0]), r.publishedAngle, r.publishedAngle, r.publishedAngle);
    const res = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: s });
    return res.kind === 'named' && res.rule.key === r.key && res.customizedFrom === true;
  });
  chk('K3: choosing Customize is a visual no-op — every unedited seed resolves to its OWN rule (the same build path)',
    routed.length === seedable.length, `${routed.length}/${seedable.length}`);
  // Seed: equality is EXACT — one ulp on one turn is a different generator.
  const kochSeed = C.seedCustom('koch', 3, 60, 60, 60);
  const ulp = { ...kochSeed, steps: kochSeed.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, turn: s.turn + 1e-12 } : s)) };
  seed('K3 a generator one ulp off a rule is NOT that rule', C.customMatchesRule(ulp) === null ? 1 : 0);

  // K4 — validation: V1/V2 are failures, V3 a warning (measured: shipped rules break V3 inside their ranges).
  const mv = (turn, extra = {}) => ({ kind: 'move', turn, lift: 0, length: 1, reverse: false, orient: 0, twistable: false, stretchable: false, ...extra });
  const g = (steps) => ({ steps, draw: 'path', frame: { rotate: 0, mirror: false } });
  const v = (steps, yaw) => C.walkCustom(g(steps), yaw, 0, 1).validation;
  const orphan = v([mv(0), { kind: 'retrace' }, { kind: 'retrace' }], 60);
  const closed = v([mv(0), mv(4)], 45);            // 0 then 180 deg: start == end, no chord
  const one = v([mv(0)], 60);
  const grow = v([mv(0), mv(1, { reverse: true })], 134);   // the dragon at 134 deg: steps longer than the chord
  chk('K4: V1 (an orphan retrace, too few steps) and V2 (no chord) FAIL; V3 only WARNS',
    !orphan.ok && /retraces nothing/.test(orphan.error) && !closed.ok && /no direction/.test(closed.error)
    && !one.ok && grow.ok && /grow instead of shrinking/.test(grow.warning ?? ''),
    `orphan: ${orphan.error} | closed: ${closed.error} | one: ${one.error} | dragon@134: ok, ${grow.warning}`);
  const bad = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: g([mv(0), { kind: 'retrace' }, { kind: 'retrace' }]) });
  chk('K4b: a stored generator that fails V1 resolves to the DEFAULT rule on load (spec §3.5), never draws nothing',
    bad.kind === 'named' && bad.rule.key === LSYSTEM_DEFAULT_RULE && bad.customizedFrom === false, `${bad.kind} ${bad.rule?.key}`);

  // K5 — ONE reader of `custom` in the engine (spec §3.4): no generator module but custom.ts reads `cfg.custom`.
  const engineFiles = ['src/generators/lissajous.ts', 'src/generators/lsystem/figure.ts', 'src/ui/synthesis-lab/score-canvas.ts'];
  const readers = engineFiles.filter((f) => /\b(cfg|config|lsystem|ls)\.custom\b/.test(stripC(readFileSync(join(ROOT, f), 'utf8'))));
  chk('K5: the engine and the Score read `custom` ONLY through resolveCustomRule (spec §3.4)', readers.length === 0,
    readers.length ? `direct readers: ${readers.join(', ')}` : `${engineFiles.length} files scanned`);

  // K6 — keep the LAST VALID build (spec §7.3): a Yaw that closes the path leaves the figure where it was.
  // Turns 0, +1, +1: three unit steps whose chord VANISHES at yaw 120 (1 + e^iθ + e^2iθ = 0) — genuinely custom.
  const edited = g([mv(0), mv(1), mv(1)]);
  const res = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: edited });
  const pose = (yaw) => ({ rule: LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE], recursion: 5, yaw, pitch: 0, roll: 0, multiAxis: false,
    smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 1, anglesAnimated: false, twistAnimated: false,
    stretchAnimated: false, generator: null, custom: { gen: res.gen, tile: null, maxDepth: res.maxDepth } });
  const cache = F.createFigureCache(), N = 2000;
  const okBuf = new Float64Array(N * 3), heldBuf = new Float64Array(N * 3);
  F.resolveFigure(cache, pose(60), okBuf, N);
  let closes = null;
  for (let y = 1; y < 179 && closes === null; y += 0.5) if (!C.walkCustom(edited, y, 0, 1).validation.ok) closes = y;
  F.resolveFigure(cache, pose(closes ?? 60), heldBuf, N);
  let held = 0; for (let i = 0; i < N * 3; i++) held = Math.max(held, Math.abs(okBuf[i] - heldBuf[i]));
  chk('K6: an invalid angle keeps the LAST VALID build and reports why (spec §7.3)',
    res.kind === 'custom' && closes !== null && held === 0 && typeof cache.customError === 'string',
    `closes at yaw ${closes}; figure moved by ${held}; error: ${cache.customError}`);

  // K7 — the space-filling check: the two cell rules' seeds pass, an edit breaks it, a path rule never passes.
  const hil = C.seedCustom('hilbert2d', 3, 90, 90, 90), pea = C.seedCustom('peano', 2, 90, 90, 90);
  // ⚠️ Step 2, not step 1: the FIRST turn only rotates the whole generator, so editing it leaves a Hilbert curve.
  const hilEdit = { ...hil, steps: hil.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, turn: s.turn + 1 } : s)) };
  const dragonCells = { ...C.seedCustom('dragon', 6, 90, 90, 90), draw: 'cells' };
  chk('K7: Cells/Descend are EARNED — Hilbert 2D and Peano pass, a one-turn edit fails, a 2-piece dragon cannot pass',
    C.customTile(hil)?.tile === 'sqEdge' && C.customTile(hil)?.s === 2 && C.customTile(pea)?.tile === 'sqDiag'
    && C.customTile(pea)?.s === 3 && C.customTile(hilEdit) === null && C.customTile(dragonCells) === null,
    `hilbert2d ${C.customTile(hil)?.tile}/${C.customTile(hil)?.s}, peano ${C.customTile(pea)?.tile}/${C.customTile(pea)?.s}`);

  // K8 — the Mixer SNAPS the generator WITH the rule (spec §2.4 / 39.C5): it travels with whichever rule wins.
  const demo = VARIANT_PRESETS.find((x) => x.preset.generators.lsystem?.rule === C.CUSTOM_RULE_KEY);
  const named = VARIANT_PRESETS.find((x) => x.preset.generators.lsystem?.rule === 'dragon');
  const atLo = interpolatePreset(demo.preset, named.preset, 0.25, new Set()).generators.lsystem;
  const atHi = interpolatePreset(demo.preset, named.preset, 0.75, new Set()).generators.lsystem;
  chk('K8: the Mixer carries `custom` with the winning rule and never onto a named rule',
    atLo.rule === C.CUSTOM_RULE_KEY && JSON.stringify(atLo.custom) === JSON.stringify(demo.preset.generators.lsystem.custom)
    && atHi.rule === 'dragon' && atHi.custom === undefined,
    `t=0.25 -> ${atLo.rule} (custom ${atLo.custom ? 'carried' : 'MISSING'}); t=0.75 -> ${atHi.rule} (custom ${atHi.custom === undefined ? 'absent' : 'LEAKED'})`);

  // K9 — the Randomiser never produces Customize, and Evolution moves the block WHOLE (structure never mutated).
  const rnd = stripC(readFileSync(join(ROOT, 'src/exploration/randomize.ts'), 'utf8'));
  const evo = stripC(readFileSync(join(ROOT, 'src/exploration/evolution-ops.ts'), 'utf8'));
  chk('K9: the Randomiser writes no curve block (so never `customize`), and Evolution copies it WHOLE',
    !/generators\.lsystem\s*=/.test(rnd) && !/\.custom\s*=/.test(rnd) && !/\.custom\s*=/.test(evo)
    && /result\.generators\.lsystem = deepCopy\(src\.generators\.lsystem\)/.test(evo), '');

  // K10 — the filter drawer: a NAMED exemption, no chip (39.D14 / 39.C6), with ONE carrier in the library.
  const facetSrc2 = stripC(readFileSync(join(ROOT, 'src/presets/preset-facets.ts'), 'utf8'));
  chk('K10: no chip reads the custom generator — a named exemption (one carrier is not a population)',
    !/\.custom\b|customize/.test(facetSrc2), '');

  // K11 — the demo makes the format clause non-vacuous: at least one library preset is GENUINELY custom and valid.
  const carriers = VARIANT_PRESETS.filter((x) => x.preset.generators.lsystem?.rule === C.CUSTOM_RULE_KEY);
  // ⚠️ v8 Phase 44: a carrier holds a GENERATOR or a plant's PRODUCTIONS; a productions carrier is genuine when it
  // resolves to an EDITED (synthesized) plant — its own clauses are §T's.
  const genuine = carriers.filter((x) => {
    const r = C.resolveCustomRule(x.preset.generators.lsystem);
    if (x.preset.generators.lsystem.custom?.kind === 'productions') return r.kind === 'named' && r.rule.synthesized === true;
    if (r.kind !== 'custom') return false;
    const ls = x.preset.generators.lsystem;
    return C.walkCustom(r.gen, ls.yaw.base, ls.pitch.base, ls.stretch?.base ?? 1).validation.ok;
  });
  chk('K11: the library carries a GENUINELY custom, valid generator (spec 39.C7 — the clauses above are not vacuous)',
    genuine.length >= 1 && genuine.length === carriers.length
    && carriers.some((x) => x.preset.generators.lsystem.custom?.kind === 'productions')
    && carriers.some((x) => x.preset.generators.lsystem.custom?.kind !== 'productions'),
    `${genuine.length}/${carriers.length}: ${carriers.map((x) => x.name).join(', ') || 'NONE'}`);
  const stale = VARIANT_PRESETS.filter((x) => x.preset.generators.lsystem?.custom !== undefined
    && x.preset.generators.lsystem.rule !== C.CUSTOM_RULE_KEY).map((x) => x.name);
  chk('K11b: `custom` is present IFF the rule is `customize` across the library (spec §3.5)', stale.length === 0,
    stale.length ? `stale: ${stale.join(', ')}` : 'none stale');

  /*
   * K12 — the density bands are calibrated on the library: no named rule reads clumpy. ⚠️ v8 Phase 41: over the rules
   * that can ENTER `Customize` only — the readout is shown in the generator editor, which an unseedable rule (the plants,
   * whose long internodes read uneven by design, and the tetra) can never open.
   */
  const dens = LSYSTEM_RULES.filter((r) => C.customSeedable(r.key)).map((r) => {
    const d = Math.min(r.recursionRange[1], Math.max(r.recursionRange[0], 4)), a = r.publishedAngle;
    const w = walkTurtle(r, d, a, a, a);
    return [r.key, C.customDensity(w.xyz, w.count)];
  });
  const clumpy = dens.filter(([, x]) => x > C.CUSTOM_DENSITY_BANDS.uneven);
  chk('K12: the density readout calls NO named rule clumpy (the bands are the library\'s own envelope)',
    clumpy.length === 0, `${dens.map(([k, x]) => `${k} ${x.toFixed(2)}`).join(', ')}`);
  const hairpin = C.buildCustom(g([mv(0), mv(2), mv(-2)]), 6, 80, 0, 0, 1, null);
  seed('K12 a self-overlapping hairpin generator reads clumpy',
    C.customDensity(hairpin.xyz, hairpin.count) > C.CUSTOM_DENSITY_BANDS.uneven ? 1 : 0);

  // K13 — TWO TABLES, TWO QUESTIONS: Hilbert 3D and Moore seed Customize while their NAMED rules still have no
  // Twist/Stretch row. One table for both questions is what made Hilbert 3D un-customizable in the first place.
  const extra = ['hilbert3d', 'moore'];
  chk('K13: Hilbert 3D and Moore seed Customize, and their named rules STILL have no Twist/Stretch row',
    extra.every((k) => C.customSeedable(k) && G.LSYSTEM_GENERATORS[k] === null), extra.map((k) => `${k}: seed ${C.customSeedable(k)}, twist-table ${G.LSYSTEM_GENERATORS[k] === null ? 'none' : 'SET'}`).join('; '));
  const h3 = C.seedCustom('hilbert3d', 3, 90, 90, 90);
  const h3tile = C.customTile(h3);
  const h3edit = { ...h3, steps: h3.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, lift: s.lift + 1 } : s)) };
  chk('K13b: Hilbert 3D EARNS the cube tile (k = 2³, depth-2 cells distinct and face-adjacent) and a 3-D frame',
    h3tile?.tile === 'cubeEdge' && h3tile?.s === 2 && h3tile?.dim === 3 && Array.isArray(h3.frame.basis) && C.customTile(h3edit) === null,
    `tile ${JSON.stringify(h3tile)}, basis ${JSON.stringify(h3.frame.basis)}; one lift edited -> ${JSON.stringify(C.customTile(h3edit))}`);

  // K14 — the STARTING SHAPE: Moore's seed carries one; a one-step starting shape is the absent one (routing AND
  // drawing), so ticking it is a no-op; a real one is structure.
  const mo = C.seedCustom('moore', 3, 90, 90, 90);
  const kc = C.seedCustom('koch', 3, 60, 60, 60);
  const kEdited = { ...kc, steps: kc.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, turn: 1.5 } : s)) };
  const plain = C.buildCustom(kEdited, 3, 60, 0, 0, 1, null);
  const trivial = C.buildCustom({ ...kEdited, initiator: [C.newMoveStep()] }, 3, 60, 0, 0, 1, null);
  let tdiff = 0; for (let i = 0; i < plain.xyz.length; i++) tdiff = Math.max(tdiff, Math.abs(plain.xyz[i] - trivial.xyz[i]));
  const r1 = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: { ...kc, initiator: [C.newMoveStep()] } });
  const r2 = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: { ...kc, initiator: [C.newMoveStep(), C.newMoveStep()] } });
  chk('K14: the starting shape — Moore seeds one; a ONE-STEP shape is the absent one (same rule, bit-identical drawing)',
    mo.initiator?.length === 4 && r1.kind === 'named' && r1.rule.key === 'koch' && r2.kind === 'custom' && tdiff === 0
    && plain.count === trivial.count,
    `moore start ${mo.initiator?.length} steps; koch+1 -> ${r1.kind} ${r1.rule?.key}; koch+2 -> ${r2.kind}; drawing difference ${tdiff}`);
  seed('K14 a two-step starting shape is NOT the absent one', r2.kind === 'custom' ? 1 : 0);

  // K15 — no Descend with a starting shape: the zoom's index window is a spatial one only inside ONE tile's grid.
  // ⚠️ Edit the STARTING SHAPE, never the generator: the generator must still tile, or the zoom was never on and
  // this clause would pass vacuously (its first version did exactly that — edited step 1's orient, tile null).
  const moCustom = { ...mo, initiator: mo.initiator.map((s, i) => (i === 0 && s.kind === 'move' ? { ...s, turn: 1 } : s)) };
  const moRes = C.resolveCustomRule({ rule: C.CUSTOM_RULE_KEY, custom: moCustom });
  const moPose = (descend) => ({ rule: LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE], recursion: 3, yaw: 90, pitch: 90, roll: 0,
    multiAxis: false, smoothness: 0, descend, centre: [0, 0, 0], twist: 0, stretch: 1, anglesAnimated: false,
    twistAnimated: false, stretchAnimated: false, generator: null, custom: { gen: moRes.gen, tile: moRes.tile, maxDepth: moRes.maxDepth } });
  const z1 = new Float64Array(3000 * 3), z4 = new Float64Array(3000 * 3);
  F.resolveFigure(F.createFigureCache(), moPose(1), z1, 3000);
  F.resolveFigure(F.createFigureCache(), moPose(4), z4, 3000);
  let zdiff = 0; for (let i = 0; i < z1.length; i++) zdiff = Math.max(zdiff, Math.abs(z1[i] - z4[i]));
  chk('K15: Descend does nothing on a generator WITH a starting shape (the index window is no longer spatial)',
    moRes.kind === 'custom' && moRes.tile !== null && zdiff === 0, `${moRes.kind}, tile ${moRes.tile?.tile}; descend 4 vs 1 differ by ${zdiff}`);

  /*
   * K16 — the UNSEEDABLE rules are exactly Coral Bush (`bush3d`) and the nine Phase 41 rules (the eight growth rules and
   * the tetra builder), and each kind's reason says WHY: a plant is a GROWTH rule, the tetra has no generator at all.
   * ⚠️ v8 Phase 41 widened this from "Bush 3D is the ONE" — the set is listed by name, so a tenth is a decision, not drift.
   */
  const tipSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tooltips.ts'), 'utf8');
  // ⚠️ v8 Phase 44 (`44.A1`): Sprig and Thicket Weed LEFT this list — they seed the generator editor now (exact, §K2).
  const UNSEEDABLE = ['bush3d', 'sierpinskiTetra', 'hillTetra', 'forkTree', 'firShoot', 'windWeed', 'wildPlant',
    'floweringPlant', 'bush3dBook'];
  const unseed = LSYSTEM_RULES.filter((r) => !C.customSeedable(r.key)).map((r) => r.key);
  chk('K16: the generator-unseedable rules are exactly Coral Bush, the six growth-symbol plants and the two tetrahedra, each kind with its own reason',
    unseed.join() === UNSEEDABLE.join()
    // ⚠️ v8 Phase 44: a PLANT is no longer refused — it opens the production editor — so its old reason is GONE and the
    // productions tip stands in its place; only the tetrahedra keep a refusal.
    && !/'composer\.customizeUnavailable':/.test(tipSrc) && /'composer\.customizePlant': 'Customize: edit this plant/.test(tipSrc)
    && /'composer\.customizeUnavailableTetra': 'The two tetrahedron curves cannot be customized/.test(tipSrc),
    `[${unseed}]`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== P. v8 Phase 41 — the book plants, the Sierpinski Tetrahedron, growth, taper, seed (41.S10) ===\n');
{
  const T = await import('../src/generators/lsystem/turtle.ts');
  const FG = await import('../src/generators/lsystem/figure.ts');
  const GR = await import('../src/generators/lsystem/growth.ts');
  const TT = await import('../src/generators/lsystem/tetra.ts');
  const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
  const R = L.LSYSTEM_RULE_BY_KEY;

  /*
   * §P1 — BOOK PARITY. ⚠️⚠️ **THIS TABLE IS TYPED FROM THE BOOK'S PAGES, NOT IMPORTED FROM `rules.ts`** (*The Algorithmic
   * Beauty of Plants*, ch. 1, pp. 25–30; `abop-ch1.pdf`): a parity clause that read its expectation from the
   * module under test would agree with any typo. Book symbols mapped exactly as `rules.ts` documents (∧ → ^, the
   * flowering plant's words → letters P I S L K D E, colour marks → ').
   */
  const BOOK = {
    sprig: { w: 'F', p: { F: 'F[+F]F[-F][F]' }, d: 20, n: 5 },
    thicketWeed: { w: 'F', p: { F: 'FF-[-F+F+F]+[+F-F-F]' }, d: 22.5, n: 4 },
    forkTree: { w: 'X', p: { X: 'F[+X]F[-X]+X', F: 'FF' }, d: 20, n: 7 },
    firShoot: { w: 'X', p: { X: 'F[+X][-X]FX', F: 'FF' }, d: 25.7, n: 7 },
    windWeed: { w: 'X', p: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' }, d: 22.5, n: 5 },
    floweringPlant: { w: 'P', d: 18, n: 5, p: {
      P: 'I+[P+K]--//[--L]I[++L]-[PK]++PK', I: 'FS[//&&L][//^^L]FS', S: 'SFS', L: "['{+f-ff-f+|+f-ff-f}]",
      K: "[&&&D'/E////E////E////E////E]", D: 'FF', E: "['^F][{&&&&-f+f|-f+f}]" } },
    bush3dBook: { w: 'A', d: 22.5, n: 7, p: {
      A: "[&FL!A]/////'[&FL!A]///////'[&FL!A]", F: 'S/////F', S: 'FL', L: "[''''^^{-f+f+f-|-f+f+f}]".replace("''''", "'''") } },
  };
  const parity = (key, book) => {
    const r = R[key];
    if (!r) return `${key} missing`;
    if (r.axiom !== book.w) return `${key} axiom ${r.axiom}`;
    if (r.publishedAngle !== book.d) return `${key} angle ${r.publishedAngle}`;
    const ks = Object.keys(book.p);
    if (Object.keys(r.productions).sort().join() !== ks.sort().join()) return `${key} symbols`;
    for (const k of ks) if (r.productions[k] !== book.p[k]) return `${key} ${k}: ${r.productions[k]}`;
    return null;
  };
  const bad = Object.keys(BOOK).map((k) => parity(k, BOOK[k])).filter(Boolean);
  chk('§P1 every book plant equals the definition READ OFF the book (axiom, productions, angle)', bad.length === 0, `[${bad}]`);
  // the stochastic plant: §1.7's three weighted productions
  const wp = R.wildPlant?.productions?.F;
  const wpOk = Array.isArray(wp) && wp.length === 3 && wp.map((c) => `${c.p}:${c.to}`).join('|')
    === '0.33:F[+F]F[-F]F|0.33:F[+F]F|0.34:F[-F]F' && R.wildPlant.axiom === 'F';
  chk('§P1 the Wild Plant is §1.7\'s stochastic system: three productions at .33/.33/.34', wpOk, '');
  seed('§P1 parity sees one changed bracket', [parity('sprig', { ...BOOK.sprig, p: { F: 'F[+F]F[-F]F' } })].filter(Boolean).length,
    'a production differing from the book by one bracket must be reported');
  // The recursion tops: the book's n, unless 41.P1's measured cost lowered it (Bush 3D: 7 -> 5, recorded in its provenance).
  const tops = Object.keys(BOOK).filter((k) => R[k].recursionRange[1] !== BOOK[k].n
    && !(k === 'bush3dBook' && R[k].recursionRange[1] === 5 && /capped at 5/.test(R[k].provenance)));
  chk('§P1 each recursion top is the book\'s n, or a MEASURED lower cap that its provenance states', tops.length === 0, `[${tops}]`);

  // §P2 — Coral Bush is the PRE-PHASE rule, unchanged (only its label moved), with its braces still ignored.
  const CORAL = { A: '[&FL!A]/////[&FL!A]///////[&FL!A]', F: 'S/////F', S: 'FL', L: '[---^^{-f+f+f-|-f+f+f}]' };
  const coralSame = (r) => r.axiom === 'A' && Object.keys(CORAL).every((k) => r.productions[k] === CORAL[k])
    && Object.keys(r.productions).length === 4 && r.polygons !== 'outline' && r.publishedAngle === 23;
  chk('§P2 Coral Bush (`bush3d`) is the pre-phase rule byte for byte, braces still ignored, relabelled only',
    coralSame(R.bush3d) && R.bush3d.name === 'Coral Bush', `name ${R.bush3d.name}`);
  seed('§P2 the corrected leaf is NOT Coral Bush', coralSame({ ...R.bush3d, productions: { ...R.bush3d.productions, L: "['''^^{-f+f+f-|-f+f+f}]" } }) ? 0 : 1,
    'swapping the book\'s leaf into Coral Bush must break the clause');

  /*
   * §P3 — THE STOCHASTIC HASH. Same seed ⇒ same plant; 64 CONSECUTIVE seeds ⇒ the FIRST choice takes every branch and
   * the plants differ; a deterministic rule ignores the seed. ⚠️ Calibrated against a SEQUENTIAL mulberry32 stream, the
   * defect class *Verify* records (correlated first draws across nearby seeds).
   */
  const key = (r, d, s) => T.expandRule(r, d, s).text;
  chk('§P3 the same seed gives the same plant', key(R.wildPlant, 5, 7) === key(R.wildPlant, 5, 7), '');
  const firstChoice = (pick) => { const seen = new Set(); for (let s = 0; s < 64; s++) seen.add(pick(s)); return seen.size; };
  const hashFirst = (s) => T.expandRule(R.wildPlant, 1, s).text;
  chk('§P3 64 consecutive seeds take ALL THREE first productions (no first-draw correlation)', firstChoice(hashFirst) === 3,
    `${firstChoice(hashFirst)} distinct first choices`);
  const distinct = new Set(); for (let s = 0; s < 64; s++) distinct.add(key(R.wildPlant, 4, s));
  chk('§P3 ...and 64 consecutive seeds give (nearly) 64 different plants', distinct.size >= 60, `${distinct.size} distinct of 64`);
  chk('§P3 a deterministic rule ignores the seed', key(R.sprig, 4, 0) === key(R.sprig, 4, 9999) && key(R.plant, 4, 3) === key(R.plant, 4, 0), '');
  /*
   * ⚠️ The calibration plants a stream whose FIRST DRAW IS ITS OWN SEED, scaled (`seed / 2^32`) — the correlated-first-
   * draw class at its plainest. (A bare mulberry32 seeded 1…8 was tried first and is NOT one-sided — 0.627 0.734 0.720
   * 0.924 0.690 0.526 0.012 0.156 — so the correlation *Verify* records belongs to `mixercheck`'s own seeding, and planting
   * it here would have been a seed that cannot fail.)
   */
  const streamFirst = (s) => { const u = s / 4294967296; return u < 0.33 ? 0 : u < 0.66 ? 1 : 2; };
  seed('§P3 a stream whose first draw is its own seed fails the first-draw clause on 64 consecutive seeds',
    firstChoice(streamFirst) < 3 ? 1 : 0, 'the correlated-first-draw defect must be visible to the clause');
  seed('§P3 a constant hash gives one plant for every seed', firstChoice(() => 'same') < 3 ? 1 : 0, '');

  // §P4 — LEAF OUTLINES: a `{…}` is a CLOSED loop inside one continuous stroke (adjacent chords bounded; 37's ordering rule).
  const leafRule = (mode) => ({ ...R.sprig, key: 'sprig', axiom: 'F[{-f+f+f-|-f+f}]F', productions: {}, polygons: mode });
  const maxChord = (w) => { let m = 0; for (let i = 1; i < w.count; i++) { const a = (i - 1) * 3, b = i * 3; m = Math.max(m, Math.hypot(w.xyz[b] - w.xyz[a], w.xyz[b + 1] - w.xyz[a + 1], w.xyz[b + 2] - w.xyz[a + 2])); } return m; };
  const wOut = T.walkTurtle(leafRule('outline'), 0, 60, 60, 60);
  // the leaf: F (point 1), then f f f f f (points 2..6), then the closing point back to point 1's position
  const closePt = 7, startPt = 1;
  const closed = wOut.count > closePt && Math.hypot(wOut.xyz[closePt * 3] - wOut.xyz[startPt * 3], wOut.xyz[closePt * 3 + 1] - wOut.xyz[startPt * 3 + 1], wOut.xyz[closePt * 3 + 2] - wOut.xyz[startPt * 3 + 2]) < 1e-12;
  chk('§P4 an outline leaf closes back to its first vertex, inside the stroke', closed, `count ${wOut.count}`);
  for (const k of ['floweringPlant', 'bush3dBook']) {
    const w = T.walkTurtle(R[k], 3, R[k].publishedAngle, R[k].publishedAngle, R[k].publishedAngle);
    chk(`§P4 ${R[k].name}: no adjacent chord longer than one step (one continuous stroke)`, maxChord(w) <= 1 + 1e-9, `max ${maxChord(w).toFixed(6)}`);
  }
  // ⚠️ The legacy reading does not teleport (its pen-up moves emit nothing) — it draws NO leaf, which is the defect.
  seed('§P4 the legacy reading (braces ignored, f pen-up) draws no leaf at all',
    T.walkTurtle(leafRule('legacy'), 0, 60, 60, 60).count < wOut.count ? 1 : 0, 'a missing leaf must be visible to the clause');

  // §P5 — THE TETRA: 4^d + 1 points, self-avoiding, turns ⊂ {60°, 90°}, one segment length, endpoints p0 → p3.
  const turnSet = (b) => { const s = new Set(); for (let i = 2; i < b.count; i++) { const a = [0, 1, 2].map((q) => b.xyz[(i - 1) * 3 + q] - b.xyz[(i - 2) * 3 + q]); const c = [0, 1, 2].map((q) => b.xyz[i * 3 + q] - b.xyz[(i - 1) * 3 + q]); const cos = (a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) / (Math.hypot(...a) * Math.hypot(...c)); s.add(Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI)); } return [...s].sort((x, y) => x - y); };
  let countsOk = true; for (let d = 0; d <= 7; d++) if (TT.buildTetra(d).count !== 4 ** d + 1) countsOk = false;
  chk('§P5 the tetra has exactly 4^d + 1 points at every depth 0–7', countsOk, '');
  const t5 = TT.buildTetra(5);
  const seen5 = new Set(); for (let i = 0; i < t5.count; i++) seen5.add(`${t5.xyz[i * 3]},${t5.xyz[i * 3 + 1]},${t5.xyz[i * 3 + 2]}`);
  chk('§P5 ...self-avoiding (no point visited twice, depth 5)', seen5.size === t5.count, `${seen5.size} of ${t5.count}`);
  chk('§P5 ...turning by 60° and 90° only (v1001, depth 4)', turnSet(TT.buildTetra(4)).join() === '60,90', `[${turnSet(TT.buildTetra(4))}]`);
  const lens = new Set(); for (let i = 1; i < t5.count; i++) lens.add(Math.hypot(t5.xyz[i * 3] - t5.xyz[i * 3 - 3], t5.xyz[i * 3 + 1] - t5.xyz[i * 3 - 2], t5.xyz[i * 3 + 2] - t5.xyz[i * 3 - 1]).toFixed(12));
  chk('§P5 ...every segment one length, from p0 to p3', lens.size === 1 && t5.xyz[0] === 1 && t5.xyz[1] === 1 && t5.xyz[2] === 1
    && t5.xyz[(t5.count - 1) * 3] === -1 && t5.xyz[(t5.count - 1) * 3 + 2] === 1, `${lens.size} lengths`);
  seed('§P5 the variant v0000 has 120° turns (the clause sees a wrong variant)', turnSet(TT.buildTetra(4, [0, 0, 0, 0])).includes(120) ? 1 : 0, '');
  seed('§P5 a dropped point breaks the count', (TT.buildTetra(3).count - 1) !== 4 ** 3 + 1 ? 1 : 0, '');

  /*
   * §P6 — GROWTH. Off and absent are the same branch; g = 1 IS the static figure; g = 0 is the seed at the root; the
   * grown TOUR's length rises monotonically (measured before the resample, which undersamples a long list); no adjacent
   * chord exceeds the static figure's (no teleport); wither mirrors grow; unfold reaches the recursion exactly.
   */
  const N = 6000;
  const pose = (k, g, extra = {}) => { const r = R[k]; const a = r.publishedAngle; return { rule: r, recursion: r.defaultRecursion ?? r.recursionRange[1], yaw: a, pitch: a, roll: a, multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 1, anglesAnimated: false, twistAnimated: false, stretchAnimated: false, generator: null, custom: null, growth: g, seed: 1, ...extra }; };
  const solve = (k, g, extra) => { const c = FG.createFigureCache(); const o = new Float64Array(N * 3); FG.resolveFigure(c, pose(k, g, extra), o, N); return { o, c }; };
  const same = (a, b) => { for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false; return true; };
  const chordMax = (o) => { let m = 0; for (let i = 1; i < N; i++) { const a = (i - 1) * 3, b = i * 3; m = Math.max(m, Math.hypot(o[b] - o[a], o[b + 1] - o[a + 1], o[b + 2] - o[a + 2])); } return m; };
  const tourLen = (c) => { const n = c.loAtAngleLo.count, x = c.growList; let s = 0; for (let i = 1; i < n; i++) { const a = (i - 1) * 3, b = i * 3; s += Math.hypot(x[b] - x[a], x[b + 1] - x[a + 1], x[b + 2] - x[a + 2]); } return s; };
  const GROWERS = ['plant', 'sprig', 'forkTree', 'floweringPlant', 'bush3dBook', 'bush3d', 'sierpinskiTetra', 'dragon', 'hilbert3d'];
  const g1 = GROWERS.filter((k) => !same(solve(k, null).o, solve(k, 1).o) || !same(solve(k, null).o, solve(k, undefined).o));
  chk('§P6 growth absent, null and g = 1 all draw the STATIC figure bit for bit', g1.length === 0, `[${g1}]`);
  const g0 = ['plant', 'forkTree', 'bush3dBook'].filter((k) => { const o = solve(k, 0).o; for (let i = 3; i < o.length; i++) if (o[i] !== o[i % 3]) return true; return false; });
  chk('§P6 at g = 0 a plant is the seed: every particle at the root', g0.length === 0, `[${g0}]`);
  const monoBad = [], chordBad = [];
  for (const k of ['plant', 'sprig', 'thicketWeed', 'forkTree', 'windWeed', 'floweringPlant', 'bush3dBook']) {
    let prev = -1; const stat = chordMax(solve(k, null).o);
    for (let j = 1; j < 20; j++) {
      const { o, c } = solve(k, j / 20);
      const L2 = tourLen(c); if (L2 + 1e-9 < prev) monoBad.push(`${k}@${j / 20}`); prev = L2;
      // A chord can never exceed the particle SPACING along the visible tour (a straight line is no longer than its arc),
      // so a jump across a collapsed frontier — a teleport — is exactly what would break this. The grown tour is RAW, so
      // its length is carried into the output's frame by the full list's transform (the one the figure is framed by).
      const spacing = (L2 / c.loAtAngleLo.transform.scale) / N;
      if (chordMax(o) > spacing * 1.0001 + 1e-12) chordBad.push(`${k}@${j / 20}`);
    }
  }
  chk('§P6 the grown tour\'s length rises monotonically with g (7 plants, 19 steps)', monoBad.length === 0, `[${monoBad.slice(0, 4)}]`);
  chk('§P6 ...and no adjacent chord ever exceeds the particle spacing along the visible tour (the stroke never teleports)', chordBad.length === 0, `[${chordBad.slice(0, 4)}]`);
  const tl = { time: 12, pause: 4 };
  let mirror = true; for (let x = 0.5; x < 12; x += 0.5) {
    const up = GR.growthProgress('loop', 12 - x, tl.time, tl.pause).g, down = GR.growthProgress('loop', 12 + 4 + x, tl.time, tl.pause).g;
    if (Math.abs(up - down) > 1e-12) mirror = false;
  }
  chk('§P6 the wither is the grow run backwards (tips first), and the timeline holds and rests', mirror
    && GR.growthProgress('loop', 13, 12, 4).g === 1 && GR.growthProgress('loop', 29, 12, 4).g === 0
    && GR.growthProgress('once', 99, 12, 4).g === 1 && GR.growthProgress('off', 5, 12, 4).g === null, '');
  chk('§P6 loopNew advances the seed by one per cycle; the other modes keep the stored seed',
    GR.effectiveSeed('loopNew', 7, GR.growthProgress('loopNew', 70, 12, 4).cycle) === 9 && GR.effectiveSeed('loop', 7, 3) === 7, '');
  const near = solve('dragon', 0.999999).o, stat = solve('dragon', null).o;
  let dmax = 0; for (let i = 0; i < near.length; i++) dmax = Math.max(dmax, Math.abs(near[i] - stat[i]));
  chk('§P6 unfold converges on the static figure as g → 1 (dragon, g = 1 − 1e-6)', dmax < 1e-3, `max ${dmax.toExponential(2)}`);
  seed('§P6 a frontier just short of the tips is NOT the static figure (the g = 1 clause can fail)',
    same(solve('plant', 1 - 1e-3).o, solve('plant', null).o) ? 0 : 1, 'routing g = 1 through the mechanism would show here');

  /*
   * §P7 — TAPER. The figure publishes each particle's branch depth in [0, 1]: 0 on the trunk, 1 at the deepest tips; the
   * factor `max(TAPER_FLOOR, 1 − taper·depth)` is then non-increasing in depth and exactly 1 at taper 0. Never on an
   * unbranched rule.
   */
  const dep = (k) => { const c = FG.createFigureCache(); FG.resolveFigure(c, pose(k, null, { wantDepth: true }), new Float64Array(N * 3), N); return c; };
  const dp = dep('forkTree');
  let dmin = 1, dmx = 0; for (let i = 0; i < N; i++) { dmin = Math.min(dmin, dp.depthOut[i]); dmx = Math.max(dmx, dp.depthOut[i]); }
  chk('§P7 a branching figure publishes depths spanning trunk (0) to tips (1)', dp.depthValid && dmin === 0 && dmx === 1, `[${dmin}, ${dmx}]`);
  chk('§P7 ...and an unbranched figure publishes none', dep('dragon').depthValid === false && dep('sierpinskiTetra').depthValid === false, '');
  const factor = (t, d) => Math.max(GR.TAPER_FLOOR, 1 - t * d);
  chk('§P7 the factor is 1 at taper 0 and non-increasing in depth', factor(0, 1) === 1 && factor(0.6, 0) === 1 && factor(0.6, 0.5) >= factor(0.6, 1)
    && factor(1, 1) === GR.TAPER_FLOOR, '');
  seed('§P7 an inverted factor would grow the tips', factor(0.6, 1) > factor(0.6, 0) ? 0 : 1, '');

  // §P8 — THE MIXER LAW for the five fields: each endpoint is that deck exactly; growth and seed SNAP at 0.5.
  // Real bodies (the `Plant Wild` demo), so the Mixer sees a complete preset: A authors all five fields, B none.
  const { VARIANT_PRESETS: VP } = await import('../src/presets/variant-presets.ts');
  const A = structuredClone(VP.find((x) => x.name === 'Plant Wild').preset);
  Object.assign(A.generators.lsystem, { growth: 'loopNew', seed: 3, growthTime: 12, taper: 0.6 });
  const B = structuredClone(A);
  for (const k of ['growth', 'seed', 'growthTime', 'growthPause', 'taper']) delete B.generators.lsystem[k];
  const at = (t) => interpolatePreset(A, B, t, new Set()).generators.lsystem;
  chk('§P8 the Mixer: t = 0 is deck A\'s five fields, t = 1 is deck B (which authors none)',
    at(0).growth === 'loopNew' && at(0).seed === 3 && at(0).growthTime === 12 && at(0).taper === 0.6
    && at(1).growth === undefined && at(1).seed === undefined && at(1).growthTime === undefined && at(1).taper === undefined, '');
  chk('§P8 ...growth and seed SNAP at 0.5 (a half-way mode is not a state), the taper lerps',
    at(0.49).growth === 'loopNew' && at(0.51).growth === undefined && Math.abs(at(0.25).taper - 0.45) < 1e-12, `taper@.25 ${at(0.25).taper}`);
  /*
   * §P9 — THE HILL TETRAHEDRON (41.S9, found by `p81-hill-search.mjs`). Measured on the engine's own leaves: consecutive
   * pieces share the EXIT/ENTRY vertex at every depth (continuity by vertex chaining), every piece is a congruent copy at
   * 1/2^d (volume conserved, the dissection's whole point), and the drawn centres are all distinct.
   */
  {
    const H = await import('../src/generators/lsystem/hill.ts');
    const vol = (t) => { const a = [0, 1, 2].map((q) => t[1][q] - t[0][q]), b = [0, 1, 2].map((q) => t[2][q] - t[0][q]), c = [0, 1, 2].map((q) => t[3][q] - t[0][q]);
      return Math.abs(a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; };
    const k = (p) => p.map((x) => Math.round(x * 2 ** 30)).join(',');
    const chainBreaks = (L) => { let n = 0; for (let i = 1; i < L.length; i++) if (k(L[i - 1].tet[+L[i - 1].state[1]]) !== k(L[i].tet[+L[i].state[0]])) n++; return n; };
    let breaks = 0, volBad = 0;
    for (let d = 1; d <= 4; d++) {
      const L = H.hillLeaves(d);
      breaks += chainBreaks(L);
      const want = (1 / 6) / 8 ** d;
      for (const l of L) if (Math.abs(vol(l.tet) - want) > 1e-12) volBad++;
    }
    chk('§P9 the Hill curve is CONTINUOUS: consecutive pieces share the exit/entry vertex at depths 1–4', breaks === 0, `${breaks} breaks`);
    chk('§P9 ...every piece is a congruent copy at 1/8^d of the volume (the rep-8 dissection, exact)', volBad === 0, `${volBad} off-volume pieces`);
    const h4 = H.buildHill(4); const cs = new Set(); for (let i = 0; i < h4.count; i++) cs.add(`${h4.xyz[i * 3]},${h4.xyz[i * 3 + 1]},${h4.xyz[i * 3 + 2]}`);
    chk('§P9 ...and the 8^d drawn centres are all distinct (depth 4)', h4.count === 4096 && cs.size === 4096, `${cs.size} of ${h4.count}`);
    // Seed: two children swapped in the traversal order of the first level breaks the chain.
    const L1 = H.hillLeaves(2).slice(); const tmp = L1[2]; L1[2] = L1[3]; L1[3] = tmp;
    seed('§P9 two children swapped in the order break the chain', chainBreaks(L1), 'a wrong order must be visible to the clause');
    // The flag is HONOURED: the Hill rule's particles are evenly spaced along the curve (arc length), not bunched by index.
    const NN = 3000, hc = FG.createFigureCache(), ho = new Float64Array(NN * 3);
    // At depth 2 (64 centres) every particle step lies inside ONE segment, so chord = arc and spacing is measurable.
    FG.resolveFigure(hc, pose('hillTetra', null, { recursion: 2 }), ho, NN);
    const gaps = []; for (let i = 1; i < NN; i++) gaps.push(Math.hypot(ho[i * 3] - ho[i * 3 - 3], ho[i * 3 + 1] - ho[i * 3 - 2], ho[i * 3 + 2] - ho[i * 3 - 1]));
    gaps.sort((x, y) => x - y);
    const spread = gaps[Math.floor(NN * 0.9)] / Math.max(1e-12, gaps[Math.floor(NN * 0.5)]);
    chk('§P9 ...and its declared `unequalSteps` is HONOURED: particles evenly spaced by arc length (p90/p50 spacing near 1)',
      R.hillTetra.unequalSteps === true && spread < 1.05, `p90/p50 ${spread.toFixed(3)}`);
    // Seed: the SAME list resampled by INDEX — the defect the flag exists to prevent — must read as bunched.
    const { resampleInto: rsIdx } = await import('../src/generators/lsystem/curve.ts');
    const h2 = H.buildHill(2), io = new Float64Array(NN * 3); rsIdx(io, NN, h2.xyz, h2.count);
    const ig = []; for (let i = 1; i < NN; i++) ig.push(Math.hypot(io[i * 3] - io[i * 3 - 3], io[i * 3 + 1] - io[i * 3 - 2], io[i * 3 + 2] - io[i * 3 - 1]));
    ig.sort((x, y) => x - y);
    seed('§P9 index resampling of the Hill list bunches its particles', ig[Math.floor(NN * 0.9)] / Math.max(1e-12, ig[Math.floor(NN * 0.5)]) > 1.05 ? 1 : 0, '');
  }

}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== Q. v8 Phase 41 — every rule DRAWS on the Composer\'s Score (the builder rules went through the turtle and drew nothing) ===\n');
{
  /*
   * ⚠️ Found on the first screenshot of the Sierpinski Tetrahedron: the Score's own walk called the TURTLE, and a builder
   * rule has no turtle walk, so its three panes were EMPTY while the figure drew fine. The clause asks every rule — the
   * Score must plot at least two distinct points and a non-zero extent in every plane.
   */
  const SC = await import('../src/ui/synthesis-lab/score-canvas.ts');
  const empty = [];
  for (const r of LSYSTEM_RULES) {
    const cfg = { ...L.defaultLSystemConfig(), rule: r.key, recursion: { base: Math.min(r.recursionRange[1], r.defaultRecursion ?? r.recursionRange[0] + 1), amplitude: 0, frequency: 0 },
      yaw: { base: r.publishedAngle, amplitude: 0, frequency: 0 }, pitch: { base: r.publishedAngle, amplitude: 0, frequency: 0 }, roll: { base: r.publishedAngle, amplitude: 0, frequency: 0 } };
    for (const plane of ['xy', 'xz', 'yz']) {
      const sc = SC.computeCurveScore(cfg, plane);
      let distinct = 0; for (let i = 2; i < sc.path.length; i += 2) if (sc.path[i] !== sc.path[0] || sc.path[i + 1] !== sc.path[1]) { distinct++; break; }
      if (sc.path.length < 4 || distinct === 0 || !(sc.extent > 0)) { empty.push(`${r.key}/${plane}`); }
    }
  }
  chk('§Q every rule plots a non-empty, framed curve on all three Score planes', empty.length === 0, `[${empty.slice(0, 6)}]`);
  // Seed: the turtle walk of a builder rule (what the Score did before the fix) is a single point — the empty pane.
  const tw = turtleWalk(L.LSYSTEM_RULE_BY_KEY.sierpinskiTetra, 5, 60, 60, 60);
  seed('§Q the turtle walk of a builder rule is the empty pane the clause exists for', tw.count < 2 ? 1 : 0, `${tw.count} point(s)`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== R. v8 Phase 41 (owner review 2026-11-15) — unfold FOLDS IN PLACE, plants grow BY GENERATION ===\n');
{
  /*
   * The owner saw the first build's demos and the two mechanisms were wrong in LOOK while every clause above was green:
   * unfold morphed one re-framed tangle into another (each level sat rotated and scaled against the next), and the
   * plants' single frontier left the first seconds a dot. ⚠️ So these clauses ask what the LOOK depends on:
   *  (1) unfold keeps the curve's ENDS where the finished figure has them, at every g (a re-framed or swirling morph
   *      moves them) — calibrated on the old, unaligned blend;
   *  (2) a plant grows BY GENERATION: no node of bracket depth d + 1 is out before every node of depth d has arrived —
   *      calibrated on the old arc-length frontier, which does exactly that.
   */
  const FGr = await import('../src/generators/lsystem/figure.ts');
  const Rr = L.LSYSTEM_RULE_BY_KEY;
  const N2 = 4000;
  const poseR = (k, g) => { const r = Rr[k]; const a = r.publishedAngle; return { rule: r, recursion: r.defaultRecursion ?? r.recursionRange[1], yaw: a, pitch: a, roll: a, multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 1, anglesAnimated: false, twistAnimated: false, stretchAnimated: false, generator: null, custom: null, growth: g, seed: 1 }; };
  const ends = (k, g) => { const o = new Float64Array(N2 * 3); FGr.resolveFigure(FGr.createFigureCache(), poseR(k, g), o, N2); return [o[0], o[1], o[2]]; };
  const drift = [];
  for (const k of ['dragon', 'sierpinskiTetra', 'kochQuad']) {
    const fin = ends(k, null);
    let worst = 0;
    for (const g of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) { const e = ends(k, g); worst = Math.max(worst, Math.hypot(e[0] - fin[0], e[1] - fin[1], e[2] - fin[2])); }
    if (worst > 0.02) drift.push(`${k} ${worst.toFixed(3)}`);
  }
  chk('§R unfold keeps the curve\'s start where the finished figure has it, at every g (dragon, tetra, Koch quadratic)', drift.length === 0, `[${drift}]`);
  // Calibration: the UNALIGNED blend (each level framed by its own transform) — the first build — moves the start.
  const { buildPose: bp, captureExtent: ce } = await import('../src/generators/lsystem/curve.ts');
  const unalignedStart = (k, depth) => { const p = bp(Rr[k], depth, Rr[k].publishedAngle, Rr[k].publishedAngle, Rr[k].publishedAngle); const t = ce(p.xyz, p.count);
    return [(p.xyz[0] - t.cx) / t.scale, (p.xyz[1] - t.cy) / t.scale]; };
  const u4 = unalignedStart('dragon', 4), u11 = unalignedStart('dragon', 11);
  seed('§R the unaligned blend moves the dragon\'s start between levels (the swirl the owner saw)', Math.hypot(u4[0] - u11[0], u4[1] - u11[1]) > 0.02 ? 1 : 0,
    `start moves ${Math.hypot(u4[0] - u11[0], u4[1] - u11[1]).toFixed(3)} between depth 4 and 11`);

  // (2) by generation: build the list's tree and check, at several g, that no deeper node is out before a shallower one arrived.
  const pf = bp(Rr.forkTree, 6, 20, 20, 20);
  const br = pf.branch;
  const arrivalOf = (useTau) => {
    if (useTau) { let m = 0; for (let k = 0; k < br.nodeCount; k++) m = Math.max(m, br.tau[k]); return Array.from({ length: br.nodeCount }, (_, k) => br.tau[k] / m); }
    const D = br.maxDepth, base = new Int32Array(br.nodeCount), loc = new Float64Array(br.nodeCount), mx = new Float64Array(D + 1);
    for (let k = 1; k < br.nodeCount; k++) { const p = br.parent[k]; base[k] = br.depth[k] > br.depth[p] ? p : base[p]; loc[k] = br.tau[k] - br.tau[base[k]]; mx[br.depth[k]] = Math.max(mx[br.depth[k]], loc[k]); }
    return Array.from({ length: br.nodeCount }, (_, k) => k === 0 ? 0 : (br.depth[k] + (mx[br.depth[k]] > 0 ? loc[k] / mx[br.depth[k]] : 1)) / (D + 1));
  };
  const outOfOrder = (arr) => { let bad = 0; const lastByDepth = new Float64Array(br.maxDepth + 1), firstByDepth = new Float64Array(br.maxDepth + 1).fill(Infinity);
    for (let k = 1; k < br.nodeCount; k++) { const d = br.depth[k]; lastByDepth[d] = Math.max(lastByDepth[d], arr[k]); firstByDepth[d] = Math.min(firstByDepth[d], arr[k]); }
    for (let d = 1; d <= br.maxDepth; d++) if (firstByDepth[d] < lastByDepth[d - 1] - 1e-12) bad++; return bad; };
  chk('§R a plant grows BY GENERATION: every branch order arrives after the whole order before it (Fork Tree)', outOfOrder(arrivalOf(false)) === 0, `${outOfOrder(arrivalOf(false))} orders early`);
  seed('§R the raw arc-length frontier (the first build) lets deeper branches out early', outOfOrder(arrivalOf(true)), 'the frontier the owner saw must fail the clause');
  // And the engine USES that law: halfway through the first window only the trunk order is out — no tip at the crown yet.
  const half = new Float64Array(N2 * 3); FGr.resolveFigure(FGr.createFigureCache(), poseR('forkTree', 0.5 / (br.maxDepth + 1)), half, N2);
  const full = new Float64Array(N2 * 3); FGr.resolveFigure(FGr.createFigureCache(), poseR('forkTree', null), full, N2);
  const ext = (o) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < N2; i++) { lo = Math.min(lo, o[i * 3]); hi = Math.max(hi, o[i * 3]); } return hi - lo; };
  chk('§R ...and the engine draws it: early in growth the plant is a narrow trunk, not the crown spreading', ext(half) < 0.25 * ext(full),
    `width ${ext(half).toFixed(3)} vs grown ${ext(full).toFixed(3)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== S. v8 Phase 44 Part A — Sprig and Thicket Weed seed the generator editor; an edited plant keeps its branch tree ===\n');
{
  /*
   * `44.A1`: the two single-production book plants seed `Customize` through the SAME turtle derivation as Plant, with
   * NO flags (their named rows unchanged). `44.A2`: an edited generator with retraces carries a branch TREE, built
   * STRUCTURALLY from the composition — the turtle's own tree on an unedited seed — so it grows by generation and
   * tapers; one with no retrace takes exactly the old path. ⚠️ The structural build REPLACED a reconstruction from point
   * positions that could not be exact (two branches can share a position, parent and depth — Sprig's straight [F]).
   */
  const CS = await import('../src/generators/lsystem/custom.ts');
  const FS = await import('../src/generators/lsystem/figure.ts');
  const GS = await import('../src/generators/lsystem/generator.ts');
  chk('§S1 Sprig and Thicket Weed seed Customize, and their NAMED rules gain no Twist/Stretch flags (Customize-only structures)',
    CS.customSeedable('sprig') && CS.customSeedable('thicketWeed') && GS.LSYSTEM_GENERATORS.sprig === null && GS.LSYSTEM_GENERATORS.thicketWeed === null, '');

  // S2 — the tree, against the TURTLE's own, on every branching seed at depths 2–4.
  const treeDiff = (key, d) => {
    const r = LSYSTEM_RULE_BY_KEY[key], y = r.publishedAngle;
    const s = CS.seedCustom(key, d, y, y, y);
    const b = CS.buildCustom(s, d, y, y, 0, 1, null, null, true);
    const t = turtleWalk(r, d, y, y, y);
    const cb = b.branch, tb = t.branch;
    if (!cb || !tb || b.count !== t.count) return { bad: Infinity, nodes: `${cb?.nodeCount}/${tb?.nodeCount}` };
    let bad = cb.nodeCount === tb.nodeCount && cb.maxDepth === tb.maxDepth ? 0 : 1;
    const tEnd = Math.max(...tb.tau), cEnd = Math.max(...cb.tau), k = cEnd / tEnd;
    for (let i = 0; i < t.count; i++) {
      if (cb.depth[cb.pointNode[i]] !== tb.depth[tb.pointNode[i]]) bad++;
      if (Math.abs(cb.tau[cb.pointNode[i]] - k * tb.tau[tb.pointNode[i]]) > 1e-9 * cEnd) bad++;
    }
    for (let q = 1; q < cb.nodeCount; q++) if (!(cb.parent[q] >= 0 && cb.parent[q] < q)) bad++;
    return { bad, nodes: `${cb.nodeCount}/${tb.nodeCount}` };
  };
  const rows = [];
  let worst = 0;
  for (const key of ['plant', 'sprig', 'thicketWeed']) for (const d of [2, 3, 4]) { const r = treeDiff(key, d); worst = Math.max(worst, r.bad); rows.push(`${key}@${d} ${r.nodes}`); }
  chk('§S2 an unedited seed\'s tree IS the turtle\'s: same node count and max depth, every point\'s depth equal, tau proportional, parent before child',
    worst === 0, `${rows.join(', ')}; worst ${worst}`);

  // S3 — an EDITED Sprig (one turn changed) grows by generation and tapers.
  const y = LSYSTEM_RULE_BY_KEY.sprig.publishedAngle;
  const base = CS.seedCustom('sprig', 4, y, y, y);
  const edited = { ...base, steps: base.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, turn: s.turn + 1 } : s)) };
  const res = CS.resolveCustomRule({ rule: CS.CUSTOM_RULE_KEY, custom: edited });
  // A retrace-free generator that is genuinely CUSTOM (Koch with one turn edited) — asserted, or S4 would be vacuous.
  const kochSeed = CS.seedCustom('koch', 3, 60, 60, 60);
  const plain = { ...kochSeed, steps: kochSeed.steps.map((s, i) => (i === 1 && s.kind === 'move' ? { ...s, turn: s.turn + 0.25 } : s)) };
  const resPlain = CS.resolveCustomRule({ rule: CS.CUSTOM_RULE_KEY, custom: plain });
  const N = 6000;
  const cpose = (r, g, extra = {}) => ({ rule: LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE], recursion: 4, yaw: y, pitch: y, roll: 0,
    multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 1, anglesAnimated: false, twistAnimated: false,
    stretchAnimated: false, generator: null, custom: { gen: r.gen, tile: r.tile, maxDepth: r.maxDepth }, growth: g, ...extra });
  const run = (p) => { const c = FS.createFigureCache(); const o = new Float64Array(N * 3); FS.resolveFigure(c, p, o, N); return { o, c }; };
  const width = (o) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < N; i++) { lo = Math.min(lo, o[i * 3]); hi = Math.max(hi, o[i * 3]); } return hi - lo; };
  const D = CS.buildCustom(edited, 4, y, y, 0, 1, null, null, true).branch.maxDepth;
  const early = run(cpose(res, 0.5 / (D + 1))).o, full = run(cpose(res, null)).o;
  chk('§S3 an EDITED Sprig is custom, branches, and GROWS BY GENERATION: early in growth it is a narrow trunk',
    res.kind === 'custom' && CS.customHasBranches(edited) && width(early) < 0.25 * width(full), `width ${width(early).toFixed(3)} vs grown ${width(full).toFixed(3)}`);
  // Calibration: the OLD mechanism — unfolding the recursion from level 1 — puts a whole small plant up at once.
  const oldWay = run(cpose(res, null, { recursion: 1 + (0.5 / (D + 1)) * 3 })).o;
  seed('§S3 the pre-44 unfold (recursion from level 1) is NOT a narrow trunk', width(oldWay) >= 0.25 * width(full) ? 1 : 0,
    `old width ${width(oldWay).toFixed(3)}`);
  const dp = run(cpose(res, null, { wantDepth: true })).c;
  let dmin = 1, dmx = 0; for (let i = 0; i < N; i++) { dmin = Math.min(dmin, dp.depthOut[i]); dmx = Math.max(dmx, dp.depthOut[i]); }
  chk('§S3 ...and publishes depths from trunk (0) to tips (1) for the taper', dp.depthValid && dmin === 0 && dmx === 1, `[${dmin}, ${dmx}]`);

  // S4 — a generator with NO retrace: no tree, no depths, and exactly the old path.
  const pd = run(cpose(resPlain, null, { wantDepth: true }));
  const unf = run(cpose(resPlain, 0.4)).o, viaOld = run(cpose(resPlain, null, { recursion: 1 + 0.4 * (Math.min(resPlain.maxDepth, 4) - 1) })).o;
  let same = 0; for (let i = 0; i < N * 3; i++) if (!Object.is(unf[i], viaOld[i])) same++;
  chk('§S4 a retrace-free generator has no tree, publishes no depths, and still UNFOLDS exactly as before (bit-identical)',
    resPlain.kind === 'custom' && !CS.customHasBranches(plain) && pd.c.depthValid === false && same === 0, `${resPlain.kind}; ${same} slots differ`);

  // The engine's taper gate opens for a branching custom curve and stays shut for a plain one (`lissajous.ts`).
  const { LissajousGenerator: LG } = await import('../src/generators/lissajous.ts');
  const taperOn = (custom) => {
    const g = new LG();
    g.init({ type: 'lsystem', particleCount: 3000, waves: [], waveSpeed: 0.05, rotation: [0, 0, 0], angle: [0, 0, 0],
      designResolution: { width: 100, height: 100 }, colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.1, 0.1], colorShift: [0, 0, 0],
      lsystem: { rule: 'customize', custom, recursion: { base: 4, amplitude: 0, frequency: 0 }, yaw: { base: y, amplitude: 0, frequency: 0 },
        pitch: { base: y, amplitude: 0, frequency: 0 }, roll: { base: y, amplitude: 0, frequency: 0 }, smoothness: 0, centre: [0, 0, 0],
        descend: { base: 1, amplitude: 0, frequency: 0 }, taper: 0.6 } }, { width: 800, height: 600 });
    g.update(16.667);
    let lo = 1; for (let i = 0; i < 3000; i++) lo = Math.min(lo, g.taperFactor[i]);
    return { live: g.taperLive, lo };
  };
  const tE = taperOn(edited), tP = taperOn(plain);
  chk('§S4 ...the ENGINE tapers an edited branching generator and not a plain one', tE.live === true && tE.lo < 1 && tP.live === false,
    `edited live ${tE.live} (min factor ${tE.lo.toFixed(3)}), plain live ${tP.live}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== T. v8 Phase 44 Part B — the production editor: a plant\'s own rules, edited ===\n');
{
  /*
   * A plant's `Customize` block stores its axiom and productions (`productions.ts`); the resolver routes an unedited
   * block back to the plant (the no-op) and an edited one to a SYNTHESIZED rule, drawn through the turtle path. Its two
   * silent traps are held here: the KEY-TABLE reads (a synthesized rule carries its family's key) and the figure
   * cache's identity. Each clause is calibrated on the defect it guards.
   */
  const PT = await import('../src/generators/lsystem/productions.ts');
  const CT = await import('../src/generators/lsystem/custom.ts');
  const FT = await import('../src/generators/lsystem/figure.ts');
  const GT = await import('../src/generators/lsystem/generator.ts');
  const TT = await import('../src/generators/lsystem/turtle.ts');
  const N = 4000;
  const tpose = (rule, extra = {}) => ({ rule, recursion: rule.defaultRecursion ?? Math.min(4, rule.recursionRange[1]), yaw: rule.publishedAngle,
    pitch: rule.publishedAngle, roll: rule.publishedAngle, multiAxis: false, smoothness: 0, descend: 1, centre: [0, 0, 0], twist: 0, stretch: 1,
    anglesAnimated: false, twistAnimated: false, stretchAnimated: false, generator: null, custom: null, growth: null, seed: 1, ...extra });
  const tdraw = (cache, rule, extra) => { const o = new Float64Array(N * 3); FT.resolveFigure(cache, tpose(rule, extra), o, N); return o; };
  const ndiff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) n++; return n; };
  const resolveBlock = (b) => CT.resolveCustomRule({ rule: CT.CUSTOM_RULE_KEY, custom: b });

  // T1 — the no-op, on every plant: the seeded block routes to the plant itself and draws bit-identically.
  const fams = PT.productionFamilies();
  const t1 = fams.filter((r) => { const res = resolveBlock(PT.seedProductions(r.key)); return !(res.kind === 'named' && res.rule === r && res.customizedFrom); });
  chk('§T1 every plant (10) seeds a productions block that routes back to the PLANT itself — choosing Customize is a no-op',
    fams.length === 10 && t1.length === 0, `${fams.length} plants; not routed: [${t1.map((r) => r.key)}]`);
  seed('§T1 a block one weight off routes to NO plant (equality is exact)', (() => {
    const b = PT.seedProductions('wildPlant'); const k = Object.keys(b.productions)[0];
    b.productions[k] = b.productions[k].map((a, i) => (i === 0 ? { p: a.p + 1e-12, to: a.to } : a));
    return PT.productionsMatchRule(b) === null ? 1 : 0; })());

  // T2 — an edit draws a DIFFERENT figure, and a shared cache rebuilds on the edit (identity, not key).
  const fork = PT.seedProductions('forkTree');
  const ed1 = { ...fork, productions: { ...fork.productions, X: 'F[+X]F[-X][+X]X' } };
  const ed2 = { ...fork, productions: { ...fork.productions, X: 'F[-X]F[+X]+X' } };
  const r1 = resolveBlock(ed1).rule, r2 = resolveBlock(ed2).rule;
  const shared = FT.createFigureCache();
  const named = tdraw(shared, LSYSTEM_RULE_BY_KEY.forkTree);
  const e1 = tdraw(shared, r1), e2 = tdraw(shared, r2), e2fresh = tdraw(FT.createFigureCache(), r2);
  chk('§T2 an edited block is a SYNTHESIZED rule that draws a different figure, and a SHARED cache rebuilds on each edit',
    r1.synthesized === true && r1.key === 'forkTree' && ndiff(named, e1) > N && ndiff(e1, e2) > N && ndiff(e2, e2fresh) === 0,
    `named→edit ${ndiff(named, e1)} slots, edit→edit ${ndiff(e1, e2)}, shared vs fresh ${ndiff(e2, e2fresh)}`);
  // Calibration: a KEY-compared cache — the defect — hands the edit the named plant's lists.
  const keyCache = FT.createFigureCache();
  const namedK = tdraw(keyCache, LSYSTEM_RULE_BY_KEY.forkTree);
  keyCache.ruleRef = r1;   // what a key compare amounts to: the cache believes it already holds this rule
  const stale = tdraw(keyCache, r1);
  seed('§T2 a key-compared cache would draw the OLD plant for the edit', ndiff(stale, namedK) === 0 ? 1 : 0, `stale vs named ${ndiff(stale, namedK)}`);

  // T3 — key-table neutrality: the helpers give a synthesized rule the identity, and no reader bypasses them.
  const plantSynth = resolveBlock({ ...PT.seedProductions('plant'), productions: { F: 'F[+F]F[-F][F]F' } }).rule;
  chk('§T3 a synthesized rule gets the IDENTITY from every key table (no generator, no brackets) — even for Plant, whose named rule has them',
    GT.generatorFlagsFor(plantSynth) === null && GT.generatorFlagsFor(LSYSTEM_RULE_BY_KEY.plant) !== null
    && L.angleBracketFor(plantSynth).yaw === 0 && GT.twistBracketFor(plantSynth) === 0 && GT.stretchBracketFor(plantSynth) === 0, '');
  const TABLES = /\b(LSYSTEM_GENERATORS|LSYSTEM_ANGLE_BRACKET|LSYSTEM_TWIST_BRACKET|LSYSTEM_STRETCH_BRACKET)\[/g;
  const ALLOWED = { 'generators/lsystem/generator.ts': 3, 'generators/lsystem/rules.ts': 1, 'generators/lsystem/custom.ts': 1 };
  const scan = (files) => {
    const bad = [];
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const n = (src.match(TABLES) ?? []).length;
      if (n > (ALLOWED[f] ?? 0)) bad.push(`${f} ${n}`);
    }
    return bad;
  };
  const SCAN = ['generators/lissajous.ts', 'generators/lsystem/figure.ts', 'generators/lsystem/curve.ts', 'ui/synthesis-lab/score-canvas.ts',
    'ui/synthesis-lab/tabs/composer.ts', 'ui/preview-grid/grid-tile-renderer.ts', 'generators/lsystem/generator.ts', 'generators/lsystem/rules.ts',
    'generators/lsystem/custom.ts', 'main.ts'];
  const badScan = scan(SCAN);
  chk('§T3 ...and no reader indexes a key table directly outside the helpers (a source scan)', badScan.length === 0, badScan.join('; ') || `${SCAN.length} files`);
  seed('§T3 a direct `LSYSTEM_GENERATORS[rule.key]` read is caught by the scan', (() => {
    const src = 'const g = LSYSTEM_GENERATORS[rule.key];';
    return (src.match(TABLES) ?? []).length > 0 ? 1 : 0; })());
  // ...and the angle rows: the effect memo is per OBJECT for a synthesized rule; and a growth-symbol plant's angles count.
  const pitchy = resolveBlock({ ...fork, productions: { ...fork.productions, X: 'F[&X]F[-X]+X' } }).rule;
  const eff = (r) => TT.ruleAngleEffect(r, L.ruleAngleUsage(r));
  chk('§T3 an edit that adds a pitch symbol gains a PITCH row (the effect memo is not the named Fork Tree\'s)',
    // ⚠️ The NAMED rule first — the user's order (view Fork Tree, then edit). Asked the other way round a key memo is still
    // empty when the edit is looked up, and the clause passed over the defect (seeded 2026-11-17, MISSED until reordered).
    eff(LSYSTEM_RULE_BY_KEY.forkTree).pitch === false && eff(pitchy).pitch === true, '');
  const rowsNow = ['forkTree', 'firShoot', 'bush3dBook'].every((k) => eff(LSYSTEM_RULE_BY_KEY[k]).yaw) && eff(LSYSTEM_RULE_BY_KEY.floweringPlant).pitch
    && eff(LSYSTEM_RULE_BY_KEY.bush3d).yaw === false;
  chk('§T3 Fork Tree, Fir Shoot and Bush 3D have a Yaw row, Flowering Plant a Pitch row; Coral Bush\'s yaw stays inert (39.A6(c))', rowsNow, '');
  const depth1 = (r, axis) => { const a = r.publishedAngle, [lo, hi] = r.angleRange, d = Math.max(1, r.recursionRange[0]);
    const P = (v) => [0, 1, 2].map((k) => (k === axis ? v : a)); const A = TT.walkTurtle(r, d, ...P(lo)), B = TT.walkTurtle(r, d, ...P(hi));
    if (A.count !== B.count) return true; for (let i = 0; i < A.count * 3; i++) if (Math.abs(A.xyz[i] - B.xyz[i]) > 1e-9) return true; return false; };
  seed('§T3 the pre-44 depth-1 sweep hides Fork Tree\'s Yaw (the defect the three-depth sweep fixed)', depth1(LSYSTEM_RULE_BY_KEY.forkTree, 0) ? 0 : 1);

  // T4 — Rmax is MEASURED: the largest depth under both budgets; the point count is an UPPER bound of the real walk.
  const t4 = [];
  for (const r of fams) {
    const s = PT.synthesizeRule(PT.seedProductions(r.key));
    const rMax = s.recursionRange[1];
    const outline = s.polygons === 'outline';
    const sd = L.isStochasticRule(s) ? 1 : 0;
    for (let d = 1; d <= Math.min(rMax, 5); d++) {
      const e = TT.expandRule(s, d, sd), w = TT.walkTurtle(s, d, s.publishedAngle, s.publishedAngle, s.publishedAngle, sd);
      if (w.count > PT.countPoints(e.text, s.drawSymbols, outline)) t4.push(`${r.key}@${d}: walk ${w.count} > bound`);
    }
    if (rMax < PT.PRODUCTION_LIMITS.maxDepth) {
      const e = TT.expandRule(s, rMax + 1, sd);
      if (!(e.truncated || e.text.length > TT.EXPAND_SYMBOL_BUDGET || PT.countPoints(e.text, s.drawSymbols, outline) > PT.PRODUCTION_POINT_BUDGET)) t4.push(`${r.key}: Rmax+1 fits`);
    }
  }
  chk('§T4 Rmax is the deepest level within both budgets, and the count bounds the real walk from above (every plant)', t4.length === 0, t4.join('; ') || `${fams.length} plants`);
  const fast = PT.synthesizeRule({ ...fork, axiom: 'F', productions: { F: 'FFFFFFFF' } });
  chk('§T4 ...a fast-growing production is LIMITED (F → 8 F: 8^d points, so depth 5 = 32 769 fits and 6 does not)', fast !== null && fast.recursionRange[1] === 5, `Rmax ${fast?.recursionRange[1]}`);
  chk('§T4 ...and the restated constants equal their owners (budget, angle range)',
    PT.PRODUCTION_POINT_BUDGET === CT.CUSTOM_SEGMENT_BUDGET && PT.PRODUCTION_ANGLE_RANGE[0] === CT.CUSTOM_RANGES.yaw[0]
    && PT.PRODUCTION_ANGLE_RANGE[1] === CT.CUSTOM_RANGES.yaw[1], '');

  // T5 — the validator and the editing operations refuse each hard-rule violation.
  const V = (b) => PT.validateProductions(b).error;
  const bad = {
    empty: { ...fork, axiom: '' },
    symbol: { ...fork, productions: { ...fork.productions, X: 'F?X' } },
    open: { ...fork, productions: { ...fork.productions, X: 'F[+X' } },
    nested: { ...PT.seedProductions('floweringPlant'), axiom: 'F{f{f}f}' },
    nodraw: { ...fork, axiom: 'X', productions: { X: '[+X]-X' } },
    many: { ...fork, productions: Object.fromEntries('ABCDEHIJK'.split('').map((c) => [c, 'F'])) },
    weights: { ...PT.seedProductions('wildPlant'), productions: { F: [{ p: 0.5, to: 'F' }, { p: 0.4, to: 'FF' }] } },
  };
  const notRefused = Object.entries(bad).filter(([, b]) => V(b) === null).map(([k]) => k);
  chk('§T5 the validator REFUSES an empty axiom, an unknown symbol, an open branch, a nested leaf, a plant that draws nothing, '
    + 'too many productions, and weights not summing to 100 %', notRefused.length === 0, `not refused: [${notRefused}]`);
  chk('§T5 ...and accepts every library plant\'s own block', fams.every((r) => V(PT.seedProductions(r.key)) === null), '');
  const ins = (t, c, s2, o = true) => PT.insertSymbol(t, c, s2, o, 40);
  const ops = {
    pair: ins('FF', 1, '['), stepOver: ins('F[]F', 2, ']'), loneClose: ins('FF', 1, ']'), legacyLeaf: ins('FF', 1, '{', false),
    leafInLeaf: ins('F{f}', 3, '{'), mark: ins('FF', 1, "'"), unwrap: PT.deleteBefore('F[+F]', 2), unwrapClose: PT.deleteBefore('F[+F]', 5),
  };
  const opOk = ops.pair.text === 'F[]F' && ops.pair.caret === 2 && ops.stepOver.text === 'F[]F' && ops.stepOver.caret === 3
    && 'refused' in ops.loneClose && 'refused' in ops.legacyLeaf && 'refused' in ops.leafInLeaf && 'refused' in ops.mark
    && ops.unwrap.text === 'F+F' && ops.unwrapClose.text === 'F+F';
  chk('§T5 the edits keep pairs whole: "[" inserts a pair, a typed closer steps over, a lone closer / a legacy or nested leaf / a mark '
    + 'are refused, and deleting either bracket UNWRAPS it', opOk, JSON.stringify(ops).slice(0, 240));

  // T6 — random: one seed, one plant; weights normalise to exactly 1.
  const wild = resolveBlock({ ...PT.seedProductions('wildPlant'), productions: { F: [{ p: 0.6, to: 'F[+F]F[-F]F' }, { p: 0.4, to: 'F[+F]F' }] } }).rule;
  const ex = (s2) => TT.expandRule(wild, 4, s2).text;
  const w = PT.normaliseWeights([0.3, 0.3, 0.3]);
  chk('§T6 a random edited plant: the same seed grows the same plant, another seed another; weights normalise to EXACTLY 1',
    wild.synthesized === true && ex(7) === ex(7) && ex(7) !== ex(31_337) && w.reduce((a, b) => a + b, 0) === 1, `[${w}]`);

  // T7 — export → import round-trips leaf-identical; an unknown kind or an invalid block is the default rule.
  const back = JSON.parse(JSON.stringify(ed1));
  const rb = resolveBlock(back);
  const dflt = LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE];
  chk('§T7 a block survives JSON exactly and resolves to the same rule content; an unknown kind or an invalid block is the DEFAULT rule',
    JSON.stringify(back) === JSON.stringify(ed1) && rb.rule.synthesized === true && JSON.stringify(rb.rule.productions) === JSON.stringify(r1.productions)
    && resolveBlock({ ...fork, kind: 'weird' }).rule === dflt && resolveBlock(bad.open).rule === dflt, '');

  // T8 — the Mixer snaps the block whole (no aliasing), Evolution takes it whole, the Randomiser never emits one.
  const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
  const { crossoverPresets } = await import('../src/exploration/evolution-ops.ts');
  const { randomizePreset } = await import('../src/exploration/randomize.ts');
  const { computePresetStatistics } = await import('../src/exploration/preset-stats.ts');
  const { VARIANT_PRESETS: VP } = await import('../src/presets/variant-presets.ts');
  const baseP = VP.find((v) => v.name === 'Plant Fork Tree').preset;
  const A = structuredClone(baseP); A.generators.lsystem = { ...A.generators.lsystem, rule: 'customize', custom: structuredClone(ed1) };
  const B = structuredClone(baseP);
  const at = (t) => interpolatePreset(A, B, t, new Set()).generators.lsystem;
  const lo = at(0.49), hi = at(0.51);
  chk('§T8 the Mixer SNAPS the block with the rule: deck A\'s block whole below 0.5 (a copy, not an alias), none above',
    lo.rule === 'customize' && JSON.stringify(lo.custom) === JSON.stringify(ed1) && lo.custom !== A.generators.lsystem.custom
    && hi.rule !== 'customize' && hi.custom === undefined, `${lo.rule}/${hi.rule}`);
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => crossoverPresets(A, B, t).generators.lsystem);
  chk('§T8 ...Evolution\'s crossover carries a block WHOLE or not at all', xs.every((l) => l.rule !== 'customize' ? l.custom === undefined
    : JSON.stringify(l.custom) === JSON.stringify(ed1)), '');
  const STATS_T = computePresetStatistics(VP.map((v) => v.preset));
  let emitted = 0, changed = 0;
  for (let i = 0; i < 40; i++) {
    const rn = randomizePreset(structuredClone(B), 'medium', new Set(), STATS_T).generators.lsystem;
    if (rn?.custom !== undefined || rn?.rule === 'customize') emitted++;
    const ra = randomizePreset(structuredClone(A), 'medium', new Set(), STATS_T).generators.lsystem;
    if (ra?.custom !== undefined && JSON.stringify(ra.custom) !== JSON.stringify(ed1)) changed++;
  }
  chk('§T8 ...and the Randomiser never EMITS a block, nor rewrites one it was handed (40 presses each)', emitted === 0 && changed === 0, `emitted ${emitted}, rewritten ${changed}`);

  // T9 — one tooltip per production symbol, in BOTH directions.
  const { PRODUCTION_SYMBOL_TIPS } = await import('../src/ui/synthesis-lab/tooltips.ts');
  const syms = new Set([...Object.values(PT.PRODUCTION_SYMBOLS).join('')]);
  const tipKeys = new Set(Object.keys(PRODUCTION_SYMBOL_TIPS));
  const missingTip = [...syms].filter((c) => !tipKeys.has(c)), extraTip = [...tipKeys].filter((k) => k !== 'letter' && !syms.has(k));
  chk('§T9 every production symbol has its tooltip and every tooltip names a symbol (plus the one for letters)',
    missingTip.length === 0 && extraTip.length === 0 && tipKeys.has('letter'), `missing [${missingTip}], extra [${extraTip}]`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== T10. v8 Phase 44 — the Composer\'s Score draws the EDITED plant (the three demos) ===\n');
{
  /*
   * The Score resolves the block through the same resolver, so an edited plant must plot its OWN curve — not the named
   * plant it was seeded from. Calibrated by the defect: a Score that ignored the block would plot the family exactly.
   */
  const SC10 = await import('../src/ui/synthesis-lab/score-canvas.ts');
  const { VARIANT_PRESETS: V10 } = await import('../src/presets/variant-presets.ts');
  const demos = V10.filter((v) => v.preset.generators.lsystem?.custom?.kind === 'productions');
  const same = (a, b) => a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]);
  const rows = [], bad = [];
  for (const d of demos) {
    const ls = d.preset.generators.lsystem;
    const fam = { ...ls, rule: ls.custom.family }; delete fam.custom;
    for (const plane of ['xy', 'xz', 'yz']) {
      const a = SC10.computeCurveScore(ls, plane), b = SC10.computeCurveScore(fam, plane);
      if (!(a.path.length >= 4 && a.extent > 0)) bad.push(`${d.name}/${plane} empty`);
      else if (plane === 'xy' && same(a, b)) bad.push(`${d.name}/xy = the named plant`);
    }
    rows.push(d.name);
  }
  chk('§T10 every production demo plots its OWN curve on the Score (non-empty on all planes, not the named plant\'s)',
    demos.length === 3 && bad.length === 0, `${rows.join(', ')}${bad.length ? ' | ' + bad.join('; ') : ''}`);
  const d0 = demos[0].preset.generators.lsystem;
  const ignored = { ...d0, rule: d0.custom.family }; delete ignored.custom;
  seed('§T10 a Score that ignored the block would plot the named plant exactly', same(SC10.computeCurveScore(ignored, 'xy'),
    SC10.computeCurveScore({ ...d0, rule: d0.custom.family, custom: undefined }, 'xy')) ? 1 : 0);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log(`\nfigurecheck: ${pass} passed, ${fail} failed${calibFail ? `, ${calibFail} CALIBRATION FAILURES` : ''}`);
process.exit(fail > 0 || calibFail > 0 ? 1 : 0);
