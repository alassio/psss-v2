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
const { walkTurtle } = await import('../src/generators/lsystem/turtle.ts');

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
  for (const r of LSYSTEM_RULES) {
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
    && !['figure:attractor', 'figure:open', 'figure:curve'].includes(k));
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
  for (const r of LSYSTEM_RULES) {
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
    for (let d = r.recursionRange[1]; d <= r.recursionRange[1] + 1; d++) {
      const e = expandRule(r, d);
      if (e.truncated && e.text.length === fullLen(r, d)) falseFlags++;
    }
    let d = 1; while (fullLen(r, d) <= EXPAND_SYMBOL_BUDGET) d++;
    const e = expandRule(r, d + 1);
    if (e.truncated) realOk++; else realMissed++;
  }
  chk('K1: "truncated" is never raised over a COMPLETE expansion, and still raised where a level is skipped',
    falseFlags === 0 && realMissed === 0 && realOk === LSYSTEM_RULES.length,
    `${falseFlags} false flags up to rMax+1; ${realOk}/${LSYSTEM_RULES.length} real skips flagged`);
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
    seedable.length >= 12 && refused === 0 && mismatch === 0 && worst < 1e-9,
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
  const genuine = carriers.filter((x) => {
    const r = C.resolveCustomRule(x.preset.generators.lsystem);
    if (r.kind !== 'custom') return false;
    const ls = x.preset.generators.lsystem;
    return C.walkCustom(r.gen, ls.yaw.base, ls.pitch.base, ls.stretch?.base ?? 1).validation.ok;
  });
  chk('K11: the library carries a GENUINELY custom, valid generator (spec 39.C7 — the clauses above are not vacuous)',
    genuine.length >= 1 && genuine.length === carriers.length, carriers.map((x) => x.name).join(', ') || 'NONE');
  const stale = VARIANT_PRESETS.filter((x) => x.preset.generators.lsystem?.custom !== undefined
    && x.preset.generators.lsystem.rule !== C.CUSTOM_RULE_KEY).map((x) => x.name);
  chk('K11b: `custom` is present IFF the rule is `customize` across the library (spec §3.5)', stale.length === 0,
    stale.length ? `stale: ${stale.join(', ')}` : 'none stale');

  // K12 — the density bands are calibrated on the library: no named rule reads clumpy.
  const dens = LSYSTEM_RULES.map((r) => {
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

  // K16 — Bush 3D stays disabled, and its reason says WHY (a growth rule), not just "no generator".
  const tipSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tooltips.ts'), 'utf8');
  chk('K16: Bush 3D is the ONE unseedable rule, and its reason names the growth rule and the future phase',
    LSYSTEM_RULES.filter((r) => !C.customSeedable(r.key)).map((r) => r.key).join() === 'bush3d'
    && /'composer\.customizeUnavailable': 'Bush 3D cannot be customized: it is a GROWTH rule[\s\S]*?future phase/.test(tipSrc), '');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log(`\nfigurecheck: ${pass} passed, ${fail} failed${calibFail ? `, ${calibFail} CALIBRATION FAILURES` : ''}`);
process.exit(fail > 0 || calibFail > 0 ? 1 : 0);
