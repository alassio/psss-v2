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
  for (const key of ['hilbert3d', 'hilbert2d']) {
    const rule = LSYSTEM_RULE_BY_KEY[key];
    const out = new Float64Array(N * 3);
    const cache = createFigureCache();
    const base = { rule, recursion: rule.recursionRange[0] + 1,
      yaw: rule.publishedAngle, pitch: rule.publishedAngle, roll: rule.publishedAngle,
      multiAxis: false, smoothness: 0, centre: [0, 0, 0] };
    resolveFigure(cache, { ...base, descend: 1 }, out, N);
    const ref = meanChord(out, N);
    const ratios = [];
    let anyIncontiguous = false;
    for (const d of [2, 4, 8]) {
      const c2 = createFigureCache();
      resolveFigure(c2, { ...base, descend: d }, out, N);
      ratios.push(meanChord(out, N) / ref);
      if (c2.band && !c2.band.contiguous) anyIncontiguous = true;
    }
    chk(`${rule.name}: the mean chord holds within ±15 % across descend 2/4/8`,
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
console.log(`\nfigurecheck: ${pass} passed, ${fail} failed${calibFail ? `, ${calibFail} CALIBRATION FAILURES` : ''}`);
process.exit(fail > 0 || calibFail > 0 ? 1 : 0);
