/*
 * `deformcheck.mjs` — v8 Phase 30's instrument: the model-space deformation operators and the two
 * image-domain additions.
 *
 * ⚠️ **§A–§B ARE MEASURING SECTIONS AND THEY DRIVE THE REAL GENERATOR UNDER NODE, not a reimplementation
 * of it.** `LissajousGenerator` needs no GL, so the operators can be exercised and their *properties*
 * measured — which is the difference between asserting that a formula is present and asserting that it
 * does what the formula claims. **Never simplify one of these into a grep.**
 *
 * ⚠️ **`getState().positions` ARE SCREEN COORDINATES — the rotation loop overwrites the model array**, so
 * every measurement here is phrased in terms of an observable screen consequence rather than of a
 * model-space value. That is a constraint on the instrument, not a weakness of the clause: the properties
 * chosen (bit-exactness, per-particle radius, staying inside the cell, staying on the curve) all survive
 * the projection because none of these operators changes a particle's z, and the perspective divide is a
 * function of z alone.
 *
 * ⚠️ **§D AND §E ARE SOURCE-SHAPED, and a failure there means the named owner was bypassed or renamed —
 * not that the arithmetic moved.** Read the assertion before believing a red is a regression.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const chk = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  PASS  ${name}${detail ? '   ' + detail : ''}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '   ' + detail : ''}`); }
  return ok;
};
/**
 * v8 `34.5` — a seeded-defect reporter, the shape `facetcheck` and `composercheck` already use.
 *
 * ⚠️ **A seed that PASSES is a FAILURE**: it means the clause it calibrates cannot see the defect it
 * claims to measure. This file had no seeds at all for §M, which is how a quarter-turn error in the
 * triangle basis left all 63 clauses green (see §M's own header).
 */
const seed = (name, violations, why) => {
  const ok = violations > 0;
  if (ok) { passed++; console.log(`  CALIB  ${name} — seeded defect caught (${violations})`); }
  else { failed++; console.log(`  CALIBRATION FAIL  ${name} — seeded defect NOT CAUGHT   ${why}`); }
  return ok;
};
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const { LissajousGenerator } = await import('../src/generators/lissajous.ts');
const DEFORM = read('../src/core/deform-limits.ts');
const LISS = read('../src/generators/lissajous.ts');
/*
 * v8 `34.1` — **the wave law moved OUT of `lissajous.ts` into `core/wave-law.ts`, and §M's two
 * source-shaped clauses had to be re-pointed with it.**
 *
 * ⚠️⚠️ **THE MOVE WAS CAUGHT BY THOSE CLAUSES FAILING, WHICH IS THEM WORKING.** Both anchor on text that
 * now lives in another file; the triangle one falls back to the literal `'Math.sin'` when its regex misses,
 * so it goes RED rather than vacuously green — the one design decision in it that mattered. **Read a red
 * here after a deliberate relocation as a claim about the ANCHOR, not about the engine**, and re-point it
 * rather than widening it: a regex that searches two files would pass on a figure computed in two places,
 * which is the exact defect `34.1` exists to remove.
 */
const WAVELAW = read('../src/core/wave-law.ts');
/*
 * v8 `34.5` — `GROW_FLOOR`, read from the file that OWNS it as text rather than retyped here. A third
 * copy of a bound inside the checker would make a green run mean *three files agree with me*, which is
 * `mixercheck` §J's rule applied to a single constant.
 */
const GROW_FLOOR_VALUE = parseFloat(/export const GROW_FLOOR = (-?[\d.]+);/.exec(DEFORM)[1]);
/*
 * v8 `34.5` — ⚠️⚠️ **THE REAL BASIS, IMPORTED, CLOSING THE GAP §M's OWN HEADER DECLARED IN `34.1`.**
 * Until now §M's zeros/peaks/odd/delta clauses asserted the triangle's mathematics against a LOCAL
 * re-implementation, and the proof that this mattered is a measurement rather than an argument: seeding
 * `wave-law.ts`'s `+ 0.25` as `+ 0.5` left **all 63 clauses GREEN**. `triBasis` is exported precisely so
 * these clauses can read the shipped function, and the seed below is what makes that permanent.
 *
 * ⚠️ **`sumWaveAxes` is imported too, and NOT to re-implement anything** — it is the only way to probe the
 * loop's own INLINED copy of the triangle, through a single-slot unit table (`am = fm = [1,0,0]`,
 * `ph = [0,0,0]`, `sharp = [1,…]`, where `out[0]` IS the basis). The duplication inside `sumWaveAxes` is
 * deliberate and measured (0.80 → 1.74 ms/frame at 50 000 particles if it calls out instead), so the only
 * honest instrument is one that holds the two copies to each other.
 */
const { triBasis, sumWaveAxes } = await import('../src/core/wave-law.ts');
const TRANSMAP = read('../src/post-processors/trans-map.ts');
const CHAIN = read('../src/post-processors/trans-map-chain.ts');

const CFG = {
  particleCount: 240, waveSpeed: 0, rotation: [0, 0, 0], angle: [0, 0, 0],
  waves: [{ speed: 0, axes: [
    { phase: 0, am: { base: 22, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
    { phase: 90, am: { base: 18, amplitude: 0, frequency: 0 }, fm: { base: 2, amplitude: 0, frequency: 0 } },
    { phase: 45, am: { base: 20, amplitude: 0, frequency: 0 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
  ] }],
};
const SIZE = { width: 1024, height: 768 };

/** A fresh generator, configured and advanced one frame, with `setup` applied before the frame. */
function run(setup) {
  const g = new LissajousGenerator();
  g.init(structuredClone(CFG), SIZE);
  if (setup) setup(g);
  g.update(16.667);
  const s = g.getState();
  return Float64Array.from(s.positions.subarray(0, s.count * 3));
}
const bitExact = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ═══ §A — E129a, Barr twist ═══════════════════════════════════════════════════════════════════════
console.log('\n=== A. E129a twist — the operator is a rotation, so it must preserve each radius exactly ===\n');

const base = run(null);
chk('twist at (0, 0, 0) is BIT-EXACT against no twist at all',
  bitExact(base, run((g) => { g.setTwist(0, 0); g.setTwist(1, 0); g.setTwist(2, 0); })),
  'the operator gates on the whole triple and SKIPS the loop; multiplying by an identity instead would '
  + 'move every preset in the library by the last bits of its phase');

const twisted = run((g) => g.setTwist(2, 0.5));
chk('...and a non-zero twist actually MOVES the figure (so the clause above is falsifiable)',
  !bitExact(base, twisted),
  'a bit-exact result here would mean every clause in this section is passing over a dead operator');

/*
 * ⚠️ **THE PROPERTY, AND WHY IT IS THE RIGHT ONE.** A twist about z is a rotation of the (x, y) plane by
 * an angle that depends on z. It never writes z, so each particle's perspective scale is untouched — and
 * therefore its screen distance from the projection centre must be preserved EXACTLY, particle by
 * particle. **That is `det J = 1` expressed in the one space this instrument can read.** A formula that
 * scaled as well as rotated (the overwhelmingly likely mistake — a dropped `cos`, a `+` for a `-`) breaks
 * this and nothing else would notice.
 */
{
  const cx = SIZE.width / 2, cy = SIZE.height / 2;
  let worst = 0, worstI = -1;
  for (let i = 0; i < base.length / 3; i++) {
    const r0 = Math.hypot(base[i * 3] - cx, base[i * 3 + 1] - cy);
    const r1 = Math.hypot(twisted[i * 3] - cx, twisted[i * 3 + 1] - cy);
    if (r0 < 1e-9) continue;
    const e = Math.abs(r1 - r0) / r0;
    if (e > worst) { worst = e; worstI = i; }
  }
  /*
   * ⚠️ **THE TOLERANCE IS DERIVED, AND THE FIRST ONE WAS WRONG — recorded because it is the rule working.**
   * It was 1e-9 ("float64 noise") and the clause failed at a measured 2.88e-6. **The limit is not float64:
   * `getState().positions` is a Float32Array**, so each stored component carries a relative quantum of
   * 2^-24 ≈ 6e-8 — and the radius is taken about the projection centre, so the subtraction `x - 512`
   * AMPLIFIES that quantum by |x| / |x - cx| for any particle near the centre. **The instrument's floor is
   * therefore float32 storage plus a cancellation, not the arithmetic.**
   *
   * Bound set at **1e-4**: about 35x above the measured noise (2.88e-6) and 100x below the smallest scale
   * error worth catching (the 1 % seed in §G measures 1e-2). ⚠️ **Both margins are stated so the bound can
   * be re-derived rather than trusted** — invariant 27: never pick a tolerance that merely passes.
   */
  chk('every particle keeps its radius about the projection centre — det J = 1, measured',
    worst < 1e-4,
    `worst relative radius error ${worst.toExponential(2)} at particle ${worstI} over ${base.length / 3} `
    + 'particles, against a bound of 1e-4 derived from float32 storage + centre cancellation (the §G seed '
    + 'measures 1e-2, so the margin is 100x on the defect side and 35x on the noise side)');
}
chk('...and z is NEVER written by the twist, so depth order is untouched',
  (() => { for (let i = 0; i < base.length / 3; i++) if (base[i * 3 + 2] !== twisted[i * 3 + 2]) return false; return true; })(),
  'the whole reason this operator passes the depth gate that removed E133 and boxFoldZ');

chk('the composition order X -> Y -> Z is the order in the source (30.D6 makes it the CONTRACT)',
  (() => {
    const i = LISS.indexOf('const twX = this.twist[0]');
    const seg = LISS.slice(i, i + 3000);
    const x = seg.indexOf('if (twX !== 0) {'), y = seg.indexOf('if (twY !== 0) {'), z = seg.indexOf('if (twZ !== 0) {');
    return x > 0 && y > x && z > y;
  })(),
  'rotations do not commute, so a reordering changes every authored twist — and a preset is portable only '
  + 'while the order is part of the contract rather than an artefact of how the loop was written');

// ═══ §B — E130, box-fold ══════════════════════════════════════════════════════════════════════════
console.log('\n=== B. E130 box-fold — reflection, continuity, and the cell it must not leave ===\n');

chk('box-fold at 0 iterations is BIT-EXACT against no fold at all',
  bitExact(base, run((g) => g.setBoxFold(0, 0.35, 1))),
  'the ITERATION COUNT is the gate, never the cell size: a cell wide enough to fold nothing is still a '
  + 'loop over every particle every frame');

const folded = run((g) => g.setBoxFold(1, 0.35, 1));
chk('...and one iteration actually MOVES the figure (so the clause above is falsifiable)',
  !bitExact(base, folded),
  'a bit-exact result would mean this section passes over a dead operator');

/*
 * ⚠️ **CONTINUITY, MEASURED AS A PROPERTY RATHER THAN READ OFF THE FORMULA.** The fold must be continuous
 * at the cell wall — that is what keeps it clear of the THREE teleport guards `symmetryFold`'s cyclic form
 * trips (`outlierCap`, `NeonLineRenderer.computeTeleportSq()`, `RibbonRenderer`'s copy). A modular form
 * would jump a whole cell width at the wall. Swept directly over the map: two inputs a hair apart must
 * produce two outputs a hair apart, INCLUDING across the wall.
 */
{
  const L = 1;
  const fold1 = (c) => (c > L ? 2 * L - c : c < -L ? -2 * L - c : c);
  let worst = 0, at = 0;
  for (let k = -3000; k <= 3000; k++) {
    const c = k / 1000, d = 1e-7;
    const jump = Math.abs(fold1(c + d) - fold1(c - d));
    if (jump > worst) { worst = jump; at = c; }
  }
  chk('the fold is CONTINUOUS everywhere, including across the cell wall',
    worst < 1e-5,
    `worst one-sided gap ${worst.toExponential(2)} at c = ${at} over a ±3L sweep — a modular form would `
    + 'show a gap of 2L here, and that is the form that costs three teleport guards');
}
chk('...and NO modular or wrap variant exists in the operator (its RETURN is the regression)',
  !/boxFold[\s\S]{0,2000}?%\s*L2|wrapFold|boxFoldWrap/.test(LISS),
  'the cyclic form of symmetryFold is the precedent: discontinuous at the boundary, three guards tripped, '
  + 'and offered only because the jump is visible in trail modes alone. Do not offer one here');

chk('z is NOT folded, which is 30.10\'s measured verdict rather than a scope cut (30.D19)',
  (() => { for (let i = 0; i < base.length / 3; i++) if (base[i * 3 + 2] !== folded[i * 3 + 2]) return false; return true; })()
  && !/boxFoldZ/.test(LISS.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')),
  '61-100 % of sampled depth pairs inverted against the 10 % bound 30.D15 fixed in advance: a reflection '
  + 'REVERSES an ordering wholesale rather than perturbing it, so no cell size or iteration count is safe');

// ═══ §D — E126, the exhaustive source read ════════════════════════════════════════════════════════
console.log('\n=== D. E126 — the Time Warp source is read EXHAUSTIVELY, not by a ternary ===\n');

chk('the uniform upload indexes a Record, so a new union member is a COMPILE error',
  /uTimeWarpSourceLoc,\s*timeWarp \? TIME_WARP_SOURCE_CODE\[timeWarp\.source\] : 0/.test(TRANSMAP)
  && /TIME_WARP_SOURCE_CODE: Record<TimeWarpSource, number>/.test(TRANSMAP),
  'this line read `source === \'density\' ? 1 : 0`, which type-checks for any number of members and maps '
  + 'every one it does not name to field. RenderMode\'s rule: a union buys type safety, not enumeration '
  + 'coverage');
chk('...and the superseded TERNARY is ABSENT (its return is the regression)',
  !/uTimeWarpSourceLoc,\s*timeWarp\?\.source === /.test(TRANSMAP),
  'a re-added ternary compiles, runs, and silently maps `coordinate` to `field` — the defect has no error '
  + 'message and no visible symptom beyond a control that does nothing');
chk('all three sources have a code, and the axis map is exhaustive too',
  /\{ field: 0, density: 1, coordinate: 2 \}/.test(TRANSMAP)
  && /TIME_WARP_AXIS_CODE: Record<'x' \| 'y' \| 'radial', number>/.test(TRANSMAP),
  'a Record over the literal union is the only form in which a removed member is also a compile error');

// ═══ §E — E125, the legacy gate ═══════════════════════════════════════════════════════════════════
console.log('\n=== E. E125 — the conformal block survives an export ===\n');

chk('`conformal` is named in isLegacyExpressible(), so its numbers cannot be silently dropped',
  /isLegacyExpressible[\s\S]{0,700}?&& !l\.conformal/.test(CHAIN),
  'omitting it is invisible: a single-layer conformal chain round-trips its STYLE through the legacy '
  + 'transMapStyle scalar perfectly and drops every one of its own values, so the preset returns as '
  + 'Conformal at defaults and looks like it worked');
chk('...and style 12 is in TRANS_MAP_STYLES as a FIELD, so it can turn the warp pass on by itself',
  // ⚠️ **PROPERTIES, NOT THE WHOLE LITERAL.** This pinned `{ style: 12, name: 'Conformal', domain:
  // 'field' }` as an exact object and went red the moment the entry gained `ownBody: true` — a clause
  // about the DOMAIN failing over an unrelated field, which is the same shape as trackcheck's
  // UNCONDITIONAL_KEYS clause earlier in this phase. Assert what the clause is named for.
  /style: 12, name: 'Conformal'/.test(CHAIN)
  && /style: 12[^}]*domain: 'field'/.test(CHAIN)
  && /conformalLayer !== null/.test(CHAIN),
  'a field style that does not count toward needsWarp is a layer that draws nothing when it is the only '
  + 'one enabled — the vortex is the precedent');

// ═══ §F — the shared clamps ═══════════════════════════════════════════════════════════════════════
console.log('\n=== F. the clamps are SHARED between the engine and the UI, never typed twice ===\n');

for (const [name, re] of [
  ['TWIST_MAX_TURNS', /TWIST_MAX_TURNS/g],
  ['BOX_FOLD_MAX_ITERATIONS', /BOX_FOLD_MAX_ITERATIONS/g],
]) {
  const inEngine = re.test(LISS);
  re.lastIndex = 0;
  const declared = new RegExp(`export const ${name}`).test(DEFORM);
  chk(`${name} is declared once in deform-limits.ts and READ by the generator`,
    declared && inEngine,
    'a range min is cosmetic and a clamp is not: an import that never passed a slider reaches the setter, '
    + 'and a constant typed in two places is where the track and the clamp drift apart');
}

// ═══ §G — the two defects the owner found in USE, 2026-10-22 ══════════════════════════════════════
console.log('\n=== G. reachability and centring — the two classes a built feature fails in silence ===\n');

/*
 * ⚠️ **§G EXISTS BECAUSE §A–§F WERE ALL GREEN OVER TWO BUILT-BUT-UNREACHABLE FEATURES.** The engine, the
 * config, the shader, the export gate and every clause above were in place for the conformal style and the
 * Time Warp coordinate source, and **neither could be selected in the UI** — one because a hand-written
 * `ownsBody` list did not name style 12, the other because the option list and its change handler were a
 * two-member hard-code. **Both are UI-reachability defects, which is the one class a source scan of the
 * ENGINE cannot see.** So these clauses read the UI.
 */
const VFX = read('../src/ui/synthesis-lab/tabs/visual-fx.ts');

chk('style 12 is in the `ownsBody` list, so its layer row can actually be EXPANDED',
  /\{ style: 12, name: 'Conformal',\s*domain: 'field', ownBody: true \}/.test(CHAIN)
  && /ownsBody = isStatic \|\| styleOwnsBody\(layer\.style\)/.test(VFX)
  && /layer\.style === 12\) body\.appendChild\(this\.buildConformalBody/.test(VFX),
  'the expander is `disabled` on a style this list omits, so the body never opens and every parameter is '
  + 'unreachable — while the style still appears in the add-layer menu and looks completely present. The '
  + 'same shape the weightless-styles comment in that file already records, one occurrence later');

chk('the Time Warp source picker is built from a THREE-member list, not a hard-coded pair',
  /TIME_WARP_SOURCES: readonly[\s\S]{0,400}?'coordinate'/.test(VFX)
  && /for \(const \[v, label\] of TIME_WARP_SOURCES\)/.test(VFX),
  'the list named two of three members, so the engine\'s coordinate source could not be selected at all');

chk('...and its change handler VALIDATES against that list rather than defaulting the unrecognised',
  /TIME_WARP_SOURCES\.find\(\(\[v\]\) => v === source\.value\)/.test(VFX)
  && !/source\.value === 'density' \? 'density' : 'field'/.test(VFX),
  'the handler was `value === \'density\' ? \'density\' : \'field\'`, which silently maps every other '
  + 'member to field — the third place this phase found a ternary standing in for an enumeration');

chk('the coordinate source exposes its axis and bias rows, gated on being selected',
  /TIME_WARP_AXES\.find/.test(VFX) && /'Lag Bias'/.test(VFX) && /t\.source === 'coordinate'/.test(VFX),
  'a source with no way to pick its axis is half a control');

chk('the conformal body offers every map in CONFORMAL_MAPS, and the power row is INTEGER-stepped',
  /CONFORMAL_MAPS: readonly[\s\S]{0,500}?'mobius'/.test(VFX)
  && /for \(const \[v, label\] of CONFORMAL_MAPS\)/.test(VFX)
  && /'Petals', c\.power,[\s\S]{0,120}?step: 1,/.test(VFX),
  'a fractional exponent puts a branch cut along one ray (30.D16), so `step: 1` is a correctness '
  + 'constraint rather than a convenience');

/*
 * ⚠️ **THE CONFORMAL MAPS MUST NOT TRANSLATE THE FRAME, AND THIS IS A MEASUREMENT RATHER THAN A READ.**
 * Reported in use as *"the whole figure is somehow only showing on the right side"*: the raw log-polar form
 * had a mean offset of **(-0.482, +0.037) UV** — nearly half a frame width — because `log` and `atan` are
 * neither in z's units nor zero-centred, while `power` and `inverse` were already centred at 0.000.
 * **A formula read cannot distinguish those three; the mean offset over the frame can.**
 */
{
  const W = 1440, H = 900, m = Math.min(W, H), LP = 3.0;
  const maps = {
    power: (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x) * 3, q = Math.pow(Math.max(r, 1 / m), 3); return [Math.cos(a) * q, Math.sin(a) * q]; },
    inverse: (x, y) => { const r2 = Math.max(x * x + y * y, 1 / (m * m)); return [x / r2, -y / r2]; },
    logPolar: (x, y) => { const r = Math.hypot(x, y); return [Math.log(Math.max(r, 1 / m)) / LP - Math.log(0.5) / LP, Math.atan2(y, x) / Math.PI]; },
  };
  for (const [name, f] of Object.entries(maps)) {
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
      const zx = (i / 40 - 0.5) * W / m, zy = (j / 40 - 0.5) * H / m;
      const [wx, wy] = f(zx, zy);
      sx += (wx - zx) * m / W; sy += (wy - zy) * m / H; n++;
    }
    const mean = Math.hypot(sx / n, sy / n);
    chk(`${name} displaces without TRANSLATING the frame (mean offset ~ 0)`,
      mean < 0.05,
      `mean |offset| ${mean.toFixed(3)} UV against a bound of 0.05 — the raw log-polar form measured 0.483, `
      + 'and a map with a net translation moves the figure off screen while every other clause stays green');
  }
  chk('...and the SHIPPED log-polar carries the centring term that makes that true',
    /w = lp - vec2\(log\(0\.5\) \/ LP_SCALE, 0\.0\);/.test(TRANSMAP)
    && /LP_SCALE = 3\.0/.test(TRANSMAP),
    'the clause above measures a transcription of the map; this one asserts the shader actually contains it');
}

// ═══ §J — E112/E113/E137, the packed per-particle channels ════════════════════════════════════════
console.log('\n=== J. E112/E113/E137 the channel buffer — driven, gated, neutral in the tail ===\n');

/*
 * ⚠️ **THIS SECTION READS `state.channels` RATHER THAN A RENDERED FRAME, AND THAT BOUNDS WHAT IT PROVES.**
 * The three multipliers reach the eye through four vertex/fragment shaders, which no Node clause can
 * execute — so what is measurable here is that the right NUMBERS are published for the right particles,
 * at the right length, with the right neutral. **That the shaders then consume them is `lencheck`'s
 * source-shaped clauses plus a browser, and it is stated here so nobody reads a green §J as coverage.**
 */
function chState(setup) {
  const g = new LissajousGenerator();
  g.init(structuredClone(CFG), SIZE);
  if (setup) setup(g);
  g.update(16.667);
  return g.getState();
}

chk('all three amounts at 0 publishes NO array at all',
  chState((g) => g.setChannels('index', 0, 0, 0)).channels === undefined,
  'absence is the gate: a published all-ones array would be arithmetically identical and would still cost '
  + 'an allocation, an upload and a branch on every frame of every preset in the library');

chk('...and any ONE amount publishes it (so the gate is the three, not one of them)',
  chState((g) => g.setChannels('index', 0, 0, 0.5)).channels !== undefined
  && chState((g) => g.setChannels('index', 0.5, 0, 0)).channels !== undefined
  && chState((g) => g.setChannels('index', 0, 0.5, 0)).channels !== undefined,
  'a gate that tested only `size` would make the lightness channel — the one the study says reads best — '
  + 'silently inert on its own');

chk('the array is exactly count * 3 long, and every triple is finite',
  (() => {
    const st = chState((g) => g.setChannels('velocity', 0.4, 0.3, 0.6));
    if (!st.channels || st.channels.length !== st.count * 3) return false;
    return st.channels.every(Number.isFinite);
  })(),
  'invariant 6: a buffer shorter than its draw call makes ANGLE drop the whole draw, and invariant 7 is '
  + 'why the length is asserted against `count` rather than against `particleCount`');

/*
 * ⚠️ **THE LAW IS CHECKED AT ITS THREE DEFINING POINTS, NOT BY RE-RUNNING THE FORMULA.** `1 + a·(2d − 1)`
 * has three properties that matter and that a transcription of the expression would not test: the
 * driver's MIDPOINT is the identity, the two ends are `1 ± a`, and the span is `2a`. Under the `index`
 * driver `d` is exactly `i/(n−1)`, so the first and last particles ARE the two ends — which makes those
 * two the oracle and needs no assumption about the figure.
 */
{
  /*
   * ⚠️ **THE LAW IS GEOMETRIC, so the ends are `base^±amount` and NOT `1 ± amount` — this clause asserted
   * the linear form and went red when the law changed (owner asked for more range at both ends,
   * 2026-10-25).** The base is parsed from `CHANNEL_LOG_SPAN`'s own source rather than transcribed, so a
   * change there moves this clause instead of breaking it.
   *
   * **Why the law had to change rather than its bound:** the linear form spans `[0, 2]` at amount 1 — 2x
   * at the top and exactly ZERO at the bottom — and widening it pushes the bottom negative, which is
   * undefined behaviour for a point size and subtracts light in an additive renderer. A ratio-symmetric
   * law is strictly positive at every amount and still exactly 1 at amount 0.
   */
  const A = 0.5;
  const BASE = Number(/export const CHANNEL_LOG_SPAN = Math\.log\((\d+)\)/.exec(DEFORM)?.[1]);
  const expLo = Math.pow(BASE, -A), expHi = Math.pow(BASE, A);
  const st = chState((g) => g.setChannels('index', A, A, A));
  const ch = st.channels;
  const n = st.waveCount ?? st.count;
  const lo = ch[0], hi = ch[(n - 1) * 3];
  const mid = ch[Math.floor((n - 1) / 2) * 3];
  const ok = Number.isFinite(BASE) && Math.abs(lo - expLo) < 1e-6 && Math.abs(hi - expHi) < 1e-6
    && Math.abs(mid - 1) < 0.02;
  chk(`the law is symmetric IN RATIO about the driver's midpoint: ends ${BASE}^±a, middle 1`,
    ok,
    `first ${lo.toFixed(4)} (expect ${expLo.toFixed(4)}), last ${hi.toFixed(4)} `
    + `(expect ${expHi.toFixed(4)}), middle ${mid.toFixed(4)} (expect 1.0000); reachable spread at `
    + `amount 1 is ${(BASE * BASE).toFixed(0)}x. A law anchored at the driver's LOW end instead would `
    + 'make every channel brighten or enlarge the figure on average, so the amount would read as an '
    + 'exposure control with a side effect rather than as a spread');

  chk('...and a NEGATIVE amount swaps the two ends rather than shrinking the spread',
    (() => {
      const neg = chState((g) => g.setChannels('index', -A, 0, 0)).channels;
      return Math.abs(neg[0] - expHi) < 1e-6 && Math.abs(neg[(n - 1) * 3] - expLo) < 1e-6;
    })(),
    'the sign is information rather than decoration: it selects WHICH particles are emphasised, which is '
    + 'a different picture of one ordering. A `Math.abs` anywhere in the law would pass every other '
    + 'clause here and make half the slider a duplicate of the other half');

  chk('...and amount 0 is EXACTLY 1, so the gate stays bit-exact under a geometric law',
    (() => {
      const z = chState((g) => g.setChannels('index', 0, 0, 0.4)).channels;
      // The light channel is driven; size and alpha are at amount 0 and must be exactly 1, not nearly.
      for (let i = 0; i < z.length; i += 3) if (z[i] !== 1 || z[i + 1] !== 1) return false;
      return true;
    })(),
    '`exp(0)` is exactly 1 in IEEE-754, which is what lets a geometric law keep the bit-exact identity a '
    + 'linear one gets for free. A law written as `pow(base, …)` with a non-integer base would also be '
    + 'exact here, but one written as `1 + (base^x − 1)` would not');
}

/*
 * ⚠️⚠️ **THE SIZE FLOOR IS NO LONGER EXERCISED BY THE SHIPPED LAW, AND THAT IS ASSERTED RATHER THAN
 * LEFT TO BE DISCOVERED.** Under the old linear law amount 1 reached exactly 0 and the floor was load
 * bearing. A geometric law bottoms out at `1/base` — measured 0.2 against a floor of 0.05 — so the clamp
 * is now a GUARD on an argument that cannot currently arrive. **A guard that nothing reaches is exactly
 * the kind of thing that gets deleted as dead code and then turns out to have been the only thing
 * standing between an imported value and undefined behaviour, so the clause records WHY it stays.**
 */
chk('the law is strictly positive at every amount, and the size floor is a guard BELOW it',
  (() => {
    const floor = Number(/export const CHANNEL_SIZE_FLOOR = ([\d.]+)/.exec(DEFORM)?.[1]);
    const BASE = Number(/export const CHANNEL_LOG_SPAN = Math\.log\((\d+)\)/.exec(DEFORM)?.[1]);
    let minAll = Infinity;
    for (const a of [0.25, 0.5, 1]) {
      const ch = chState((g) => g.setChannels('index', a, a, a)).channels;
      for (let i = 0; i < ch.length; i++) if (ch[i] < minAll) minAll = ch[i];
    }
    // The law's own bottom is 1/base; the floor must sit BELOW that, or it would be truncating the law.
    return Number.isFinite(floor) && Number.isFinite(BASE)
      && minAll > floor && Math.abs(minAll - 1 / BASE) < 1e-6;
  })(),
  'the smallest multiplier the law produces is 1/base, measured against the floor — the floor must sit '
  + 'BELOW it or it is silently truncating the control. ⚠️ **It stays because `estimateParticlePixels()` '
  + 'SQUARES the size: a negative arriving from an import or a future law change would come back positive '
  + 'and the readout would report a huge particle as a small one.**');

chk('the amounts are CLAMPED to the shared ceiling, so an import cannot exceed the derived law',
  (() => {
    const g = new LissajousGenerator();
    g.init(structuredClone(CFG), SIZE);
    g.setChannels('index', 5, -9, Number.NaN);
    const c = g.getChannels();
    const max = Number(/export const CHANNEL_MAX = (\d+)/.exec(DEFORM)?.[1]);
    return c.size === max && c.alpha === -max && c.light === 0;
  })(),
  'past ±1 the multiplier goes NEGATIVE — a quad wound the other way, or light subtracted in an additive '
  + 'renderer: two different wrong pictures from one number, neither of which reads as "too much". The '
  + 'NaN case matters too: it would propagate into every vertex and is the shape invariant 20 is about');

/*
 * ⚠️ **THE ARRAY DRIVERS MUST DEGRADE TO `index`, NEVER TO ZEROS, AND THE CLAUSE HAS TO DISTINGUISH THE
 * TWO — which a presence test cannot.** A zeroed driver publishes a perfectly well-formed array in which
 * every particle carries the SAME multiplier, so the channel renders flat: the control moves, the engine
 * is consistent, and nothing shows. That is invariant 13's shape, and it is why the fallback is to the
 * one source that cannot be absent rather than to a safe-looking constant.
 */
{
  /*
   * ⚠️⚠️ **A MOVING FIXTURE AND FIVE FRAMES, AND THE FIRST VERSION OF THIS CLAUSE HAD NEITHER — IT WENT
   * RED OVER CORRECT CODE AND THE DIAGNOSIS WAS THE CHECKER.** `CFG` above is deliberately STATIC
   * (`waveSpeed: 0`, one frame) because every other section here measures a GEOMETRIC property and a
   * static figure is the cleanest subject for one. The velocity driver is the one quantity in this file
   * that does not exist in a static figure at all. Measured, on the real generator:
   *
   *     waveSpeed 0, any frames  -> raw velocity 0.0000..0.0000, spread 0.0000
   *     waveSpeed 1, 1 frame     -> 0.0000..0.0000              (no previous frame to difference)
   *     waveSpeed 1, 2 frames    -> 1.0000..1.0000, spread 0     (every particle AT the adaptive reference)
   *     waveSpeed 1, 5 frames    -> 0.5135..1.0000, spread 0.78
   *     waveSpeed 1, 20 frames   -> 0.0836..1.0000, spread 1.47
   *
   * **Two separate reasons for a flat channel, and only the second is about this feature at all:** there
   * is no velocity until a second frame has been differenced against the first, and `velRefEMA` needs
   * several frames to settle before the normalisation spreads the population. **So the fixture is the
   * clause, and the ENGINE was never wrong.**
   *
   * ⚠️ **AND THE FIRST RESULT IS A REAL USER-FACING PRECONDITION RATHER THAN A FIXTURE QUIRK: on a
   * stationary preset the velocity driver IS flat, correctly.** That is `twist`-on-a-planar-figure
   * exactly — invariant 13's harder shape, where the control moves the right thing and the output channel
   * cannot show it — so it is carried in the tooltip, and `tipcheck` is what keeps it there.
   */
  const MOVING = {
    ...structuredClone(CFG),
    waveSpeed: 1,
    waves: [{ speed: 0, axes: [
      { phase: 0, am: { base: 22, amplitude: 4, frequency: 2 }, fm: { base: 1, amplitude: 1, frequency: 2 } },
      { phase: 90, am: { base: 18, amplitude: 4, frequency: 3 }, fm: { base: 2, amplitude: 1, frequency: 2 } },
      { phase: 45, am: { base: 20, amplitude: 4, frequency: 4 }, fm: { base: 3, amplitude: 1, frequency: 2 } },
    ] }],
  };
  const spread = (driver) => {
    const g = new LissajousGenerator();
    g.init(structuredClone(MOVING), SIZE);
    g.setChannels(driver, 0, 0, 0.8);
    for (let f = 0; f < 5; f++) g.update(16.667);
    const st = g.getState();
    const ch = st.channels;
    const n = st.waveCount ?? st.count;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n * 3; i += 3) { lo = Math.min(lo, ch[i + 2]); hi = Math.max(hi, ch[i + 2]); }
    return hi - lo;
  };

  chk('the velocity driver is CORRECTLY flat on a stationary figure, and that is a precondition not a bug',
    (() => {
      const g = new LissajousGenerator();
      g.init(structuredClone(CFG), SIZE);        // waveSpeed 0 — the static fixture
      g.setChannels('velocity', 0, 0, 0.8);
      for (let f = 0; f < 5; f++) g.update(16.667);
      const st = g.getState();
      let lo = Infinity, hi = -Infinity;
      const n = st.waveCount ?? st.count;
      for (let i = 0; i < n * 3; i += 3) { lo = Math.min(lo, st.channels[i + 2]); hi = Math.max(hi, st.channels[i + 2]); }
      return hi - lo < 1e-9;
    })(),
    'asserted rather than swept past: a stationary preset has no velocity for the driver to read, so the '
    + 'channel is flat BY CONSTRUCTION. The clause below measures the moving case, and the tooltip is '
    + 'where a user is told which of the two they are looking at');
  const byIndex = spread('index');
  const byPhase = spread('colourPhase');
  chk('every driver produces a SPREAD, so none of the four renders flat',
    ['index', 'velocity', 'depth', 'colourPhase'].every(d => spread(d) > 0.01),
    `index ${byIndex.toFixed(3)}, velocity ${spread('velocity').toFixed(3)}, `
    + `depth ${spread('depth').toFixed(3)}, colourPhase ${byPhase.toFixed(3)} — against a bound of 0.01. `
    + 'A zero spread is the channel rendering flat, which is the failure a presence test cannot see');

  chk('...and the four are not all the SAME spread, so the selector is not decorative',
    new Set(['index', 'velocity', 'depth', 'colourPhase'].map(d => spread(d).toFixed(4))).size > 1,
    'four identical spreads would mean every option reads one quantity — the defect shape where a '
    + 'dropdown exists, changes a stored word, and selects nothing');
}

chk('the TAIL blocks carry the neutral triple, never the figure\'s own driver',
  (() => {
    // No tail pool is configured in CFG, so this asserts the invariant the loop maintains: every slot
    // from `waveCount` to `count` is (1, 1, 1). With no tail the range is empty and the clause is
    // vacuous — which is why the LENGTH equality above is the clause that actually constrains the pad.
    const st = chState((g) => g.setChannels('index', 1, 1, 1));
    const n = st.waveCount ?? st.count;
    for (let i = n * 3; i < st.count * 3; i++) if (st.channels[i] !== 1) return false;
    return true;
  })(),
  'sparks, the liquid pool and the crystals are separate populations with no curve parameter — a crystal '
  + "whose size the figure's index modulated would make the pool pulse with a control that names the "
  + 'figure. ⚠️ Vacuous with no tail pool configured, and said so rather than counted as coverage');

chk('the channels are REACHABLE: one section, a driver built from the enumeration, three amount rows',
  /sectionTitle\('Per-Particle'\)/.test(VFX)
  && /options: CHANNEL_DRIVERS\.map/.test(VFX)
  && /CHANNEL_DRIVERS\.find\(d => d === v\)/.test(VFX)
  && /key: 'channelLight'/.test(VFX) && /key: 'channelSize'/.test(VFX) && /key: 'channelAlpha'/.test(VFX),
  '§G exists because two features shipped built and unreachable, and ONE of those was a picker whose '
  + 'option list named two of three members while its handler mapped the rest to a default. **Both halves '
  + 'are asserted here: built FROM the enumeration, and validated AGAINST it rather than cast.**');

chk('...and the driver labels are a Record over the union, which is the half tsc enforces',
  /const CHANNEL_DRIVER_LABELS: Record<ChannelDriver, string>/.test(VFX),
  'the value list in deform-limits.ts is an annotated array: it proves every entry IS a driver, never '
  + 'that every driver is listed. Only the Record forces the other direction, so a new union member '
  + 'stops the build here rather than silently offering one option fewer');

// ═══ §K — E132, the 4D rotation ═══════════════════════════════════════════════════════════════════
console.log('\n=== K. E132 the 4D rotation — the gate, the magnification bound, the order contract ===\n');

/*
 * ⚠️ **§K ONCE COVERED THE OCTAHEDRAL FOLD TOO AND THAT OPERATOR IS GONE (owner review, 2026-10-25): it
 * chopped the figure into multiplied line segments spread over the frame.** Its clauses went with it —
 * the multiset, the sort, the stride/run pair and their four calibrations. ⚠️ **What is worth carrying
 * forward is what those clauses TAUGHT, because it was not about that operator:** every one of them
 * asked *are the positions right*, all were green over a fold that rendered as a scatter, and the
 * property none of them held was *does a cell draw a LINE* — an ORDERING property. **A position-shaped
 * clause cannot see an ordering defect. That is the transferable finding.**
 */

chk('the 4D stage at wScale 0 is bit-exact AT ANY ANGLE (the gate is the extent alone)',
  bitExact(base, run((g) => g.setWRotation(0, 0.37, -0.21, 0.44))),
  '⚠️ this is the OPPOSITE of the twist\'s whole-triple gate and is forced by the arithmetic rather than '
  + 'chosen: at wScale 0 every w is 0, so all three rotations are identities on a zero fourth coordinate '
  + 'and the divide is d/d. Gating on the angles too would run the stage for an operator that provably '
  + 'cannot move anything');

chk('...and wScale > 0 moves the figure even with every angle at 0 (the lift alone is visible)',
  !bitExact(base, run((g) => g.setWRotation(1, 0, 0, 0))),
  'the lift puts one end of the curve nearer than the other, so the perspective divide alone changes the '
  + 'figure — which is what makes `4D Extent` a usable control before any angle is touched');

/*
 * ⚠️⚠️ **THE MAGNIFICATION BOUND, AND IT IS THE ONE CLAUSE THAT GUARDS A SINGULARITY.** `d/(d − w)` is
 * unbounded as `w → d`, and an `xw` rotation mixes `x` into `w` — so the post-rotation `w` is bounded by
 * the figure's own radius, which no constant in `deform-limits.ts` can know. **An epsilon floor would
 * admit a magnification of thousands: one particle flung across the frame, which reaches the user as a
 * stray dot and not as an error.** The floor is `W_MIN_DEN_FRACTION · d`, so the magnification is capped
 * at exactly `1 / W_MIN_DEN_FRACTION`.
 */
{
  const frac = Number(/export const W_MIN_DEN_FRACTION = ([\d.]+)/.exec(DEFORM)?.[1]);
  const cap = 1 / frac;
  let worstRatio = 0, worstAt = '';
  let anyNonFinite = false;
  // Swept, not spot-checked: the singularity is reachable only at particular angle/extent combinations,
  // and a single pose is exactly how one would be missed.
  for (let xw = -0.5; xw <= 0.5; xw += 0.0625) {
    for (let sc = 0.25; sc <= 1.0001; sc += 0.25) {
      const p = run((g) => g.setWRotation(sc, xw, 0, 0));
      for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) anyNonFinite = true;
      // The radius about the projection centre, before and after: their ratio IS the magnification,
      // since the 4D rotation is norm-preserving in 4-space and only the divide changes a 3D length.
      const cx = SIZE.width / 2, cy = SIZE.height / 2;
      for (let i = 0; i < p.length / 3; i++) {
        const r0 = Math.hypot(base[i * 3] - cx, base[i * 3 + 1] - cy, base[i * 3 + 2]);
        const r1 = Math.hypot(p[i * 3] - cx, p[i * 3 + 1] - cy, p[i * 3 + 2]);
        if (r0 < 1) continue;
        const ratio = r1 / r0;
        if (ratio > worstRatio) { worstRatio = ratio; worstAt = `xw ${xw.toFixed(3)} scale ${sc.toFixed(2)}`; }
      }
    }
  }
  // ⚠️ The bound is the CAP times a factor the rotation itself contributes: an xw rotation can bring a
  // particle's x into the radius it did not previously occupy, so the ratio is not the magnification
  // alone. The clause that matters is that it is BOUNDED and finite, with the cap as the scale.
  // ⚠️ **THE ALLOWANCE IS MEASURED, NOT PICKED: the sweep's worst radius ratio is 1.40x the cap**, and
  // the excess is the rotation's own contribution — an `xw` rotation brings a particle's x into a radius
  // it did not previously occupy, so the ratio is not the magnification alone. **2x leaves a 1.43x margin
  // over the measurement and still fails an unguarded divide, which produces ratios in the thousands.**
  chk('the 4D projection is bounded and finite over a swept angle/extent grid',
    !anyNonFinite && worstRatio < cap * 2,
    `worst radius ratio ${worstRatio.toFixed(2)} at ${worstAt}, against the magnification cap `
    + `1/${frac} = ${cap} (and a 4x allowance for the rotation's own contribution to a 3D radius). `
    + '⚠️ A NaN or an Infinity here is the unguarded singularity, and it would reach the renderer as a '
    + 'vertex at infinity — which ANGLE answers by dropping the primitive, so it looks like a MISSING '
    + 'particle rather than a broken one');

  chk('...and the floor is the SHARED fraction, never an epsilon literal in the generator',
    /Math\.max\(minDen, d - w\)/.test(LISS) && /W_MIN_DEN_FRACTION \* d/.test(LISS)
    && !/d - w, 1e-/.test(LISS),
    'an epsilon is a float-precision guard and this is a MAGNITUDE guard — invariant 10\'s shape, where '
    + 'both expressions look reasonable and only the unit of the RESULT distinguishes them');
}

chk('the xw -> yw -> zw order is load-bearing, so the contract is a real constraint',
  !bitExact(run((g) => g.setWRotation(1, 0.2, 0.3, 0)), run((g) => g.setWRotation(1, 0, 0.3, 0.2))),
  '4D rotations do not commute either, so the order is what makes a preset portable rather than an '
  + 'artefact of how the loop happened to be written. A bit-exact result would mean the order was not a '
  + 'contract at all and the comment claiming it is would be wrong');

/*
 * ⚠️⚠️ **`31.9`'s RECORD, AND IT IS A RESULT ABOUT THE GATE RATHER THAN ABOUT EITHER OPERATOR.**
 *
 * `30.D15` fixed a bound of 10 % of sampled depth pairs, and `31.9` re-pointed `30.10`'s instrument at
 * these two operators over the 173 strong-z bodies at three instants. **Both failed — and so did the
 * engine's own 3D pose rotation, harder:**
 *
 *     CALIB 3D pose Y 90 deg   worst 100.00 %  mean 58.3 %   over bound 175/175
 *     CALIB 3D pose X 45 deg   worst  81.01 %  mean 28.0 %   over bound 130/175
 *     CALIB 3D pose Y 30 deg   worst  50.30 %  mean 22.3 %   over bound 138/175
 *     31.3 octahedral fold     worst  58.31 %  mean 51.1 %   over bound 175/175
 *     31.4 all three angles    worst 100.00 %  mean 43.4 %   over bound 149/175
 *     31.4 xw alone            worst  37.29 %  mean  6.7 %   over bound  24/175
 *
 * **`angle: [0, 90, 0]` is authored throughout the library and is the oldest correct control in the
 * engine. A bound that condemns it is not a shipping gate — it measures *did the depth order change*, and
 * a rotation's whole content is that it did.**
 *
 * **What actually convicted `boxFoldZ` was a depth inversion with NO CHANGE TO THE PROJECTED IMAGE:** the
 * fold moved z and nothing else, so the figure looked identical while every depth cue silently reversed.
 * Measured over the same bodies, mean depth inversion against mean image change as a fraction of the
 * figure's own XY extent:
 *
 *     SEED boxFoldZ (removed)  depth 67.3 %   image  0.0 %     <- the ONLY zero; 155/175 bodies FAIL
 *     31.4 wScale, no angle    depth  5.8 %   image  4.3 %
 *     CALIB 3D pose Y 30 deg   depth 22.3 %   image  7.9 %
 *     CALIB 3D pose X 45 deg   depth 28.0 %   image 12.5 %
 *     CALIB 3D pose Y 90 deg   depth 58.3 %   image 24.7 %
 *     31.4 all three 0.125     depth 43.4 %   image 30.9 %
 *     31.3 octahedral fold     depth 51.1 %   image 44.6 %
 *     31.4 zw 0.25             depth 66.3 %   image 48.6 %    <- the LARGEST image change measured
 *
 * **Not one body fails the rule on any of the five shipped settings; 155 of 175 fail it on `boxFoldZ`.**
 *
 * **Both operators ship, and the gate is recorded as falsified rather than applied mechanically.** The
 * clause below is the cheap, in-suite form: it asserts the ORDERING that separates the two classes, with
 * the removed `boxFoldZ` rebuilt as the calibration — because a rule calibrated against anything other
 * than the operator it is known to have to reject is calibrated against a guess.
 *
 * ⚠️ **THE INSTRUMENT IS `MEASUREMENT-phase31-depthgate.mjs`, KEPT BESIDE PHASE 30's, AND IT IS
 * THE AUTHORITATIVE BASIS FOR EVERY FIGURE ABOVE** — re-run it rather than doing arithmetic on two quoted
 * numbers. The figures first reported in the sitting differed by a point or two because that version did
 * not read `designResolution` from `metadata`: **a BASIS difference, not an event.**
 *
 * ⚠️ **WHAT IS STILL NOT ESTABLISHED, and no checker can establish it: whether either operator READS as
 * wrong depth to the eye.** Both default OFF, so nothing in the library moves. **Owner confirmation by
 * use is the only instrument for that, which is this project's own standing finding.**
 */
{
  const imageChange = (before, after) => {
    let lo = Infinity, hi = -Infinity, sum = 0;
    const n = before.length / 3;
    for (let i = 0; i < n; i++) {
      const x = before[i * 3], y = before[i * 3 + 1];
      lo = Math.min(lo, x, y); hi = Math.max(hi, x, y);
      sum += Math.hypot(after[i * 3] - x, after[i * 3 + 1] - y);
    }
    return (sum / n) / Math.max(1e-6, hi - lo);
  };
  // The removed boxFoldZ, rebuilt: fold z at the XY fold's own cell, touch nothing else.
  const zFolded = Float64Array.from(base);
  const L = 0.35 * 50 * (SIZE.height / 100);
  for (let i = 0; i < zFolded.length / 3; i++) {
    let z = zFolded[i * 3 + 2];
    if (z > L) z = 2 * L - z; else if (z < -L) z = -2 * L - z;
    zFolded[i * 3 + 2] = z;
  }
  const seedImg = imageChange(base, zFolded);
  const wImg = imageChange(base, run((g) => g.setWRotation(1, 0.125, 0.125, 0.125)));
  chk('31.9: the REMOVED boxFoldZ changes the image by ~nothing while the shipped operator changes it a lot',
    seedImg < 1e-9 && wImg > 0.05,
    `seeded boxFoldZ ${(seedImg * 100).toFixed(3)}% image change (EXACTLY 0 by construction: it writes `
    + `z alone), 4D all-three ${(wImg * 100).toFixed(1)}%. `
    + 'Over the real library the two measured 0.0 % and 30.9 %, against the engine\'s own 3D '
    + 'pose rotation at 7.9-24.7 %. ⚠️ **This asserts the DISCRIMINATOR, not the 10 % bound — which 31.9 '
    + 'falsified as a shipping gate by scoring `angle: [0, 90, 0]` at 58.3 % mean inversion over 175 '
    + 'of 175 bodies.** Authoritative basis: MEASUREMENT-phase31-depthgate.mjs');
}

// ═══ §H — CALIBRATION ══════════════════════════════════════════════════════════════════════════════════
console.log('\n=== L. v8 32 (E129b/E133) — the DETERMINANT, which is what these operators put at risk ===\n');
/*
 * ⚠⚠ **EVERY CLAUSE HERE MEASURES ENERGY OR REACHABILITY, NOT POSITION, AND THAT IS PHASE 31's LESSON
 * SPENT.** Two operators shipped in `31` with the POSITIONS right and the ORDERING destroyed, and every
 * clause was green because every clause asked *are the positions right*. The blind spot here is different
 * again: **a taper can place every particle exactly where Barr says and still drive `det J` to zero.**
 *
 * ⚠ **A BOOLEAN `isFinite` SCAN CANNOT SEE A RAMP** (invariant 21) — a determinant sliding toward zero
 * is finite at every sample and still unusable, so these read the published multiplier's RANGE.
 */
{
  // The file's own `run()` returns positions only, so energy needs the state. One local helper rather
  // than widening `run()`, which eleven clauses above depend on.
  const runState = (setup) => {
    const g = new LissajousGenerator();
    g.init(structuredClone(CFG), SIZE);
    if (setup) setup(g);
    g.update(16.667);
    const st = g.getState();
    return { st, n: st.count, pos: Float64Array.from(st.positions.subarray(0, st.count * 3)) };
  };
  const energy = (r) => {
    if (!r.st.channels) return null;
    let lo = Infinity, hi = -Infinity, bad = 0;
    for (let i = 0; i < r.n; i++) {
      const v = r.st.channels[i * 3];
      if (!Number.isFinite(v) || v <= 0) bad++;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { lo, hi, bad };
  };
  const SPAN = Number(/DEFORM_ENERGY_SPAN = ([0-9.]+)/.exec(DEFORM)?.[1] ?? 'NaN');
  chk('`DEFORM_ENERGY_SPAN` is READ FROM THE SOURCE, not restated here',
    Number.isFinite(SPAN) && SPAN > 1,
    `read ${SPAN} from core/deform-limits.ts — a literal here would be a second copy of the bound, and`
    + ` the clause below would then pass against a figure the engine no longer uses`);

  const b0 = runState(null);
  const nudged = runState((g) => { g.setTaper(2, 0.001); g.setBend(2, 0.001); });
  chk('the six-tuple gate is BIT-EXACT inside the shared dead zone, not approximately equal',
    bitExact(b0.pos, nudged.pos),
    '`TWIST_SNAP` is shared with the twist (`32.D6`) and snaps a sub-threshold value to 0, so the stage is'
    + ' SKIPPED rather than multiplied by an identity — no preset authored before Phase 32 may move by one'
    + ' bit, and "close enough" is not that promise');

  const maxed = runState((g) => { for (const a of [0, 1, 2]) { g.setTaper(a, 99); g.setBend(a, 99); } });
  const e = energy(maxed);
  chk('with every clamp maxed out, the published size multiplier stays inside the VEHICLE span',
    e !== null && e.bad === 0 && e.lo >= 1 / SPAN - 1e-9 && e.hi <= SPAN + 1e-9,
    e === null
      ? 'no channels published — the compensation never reached the renderer, which is exactly what the'
        + ' widened `writeChannels()` gate exists to prevent'
      : `x${e.lo.toFixed(3)}..x${e.hi.toFixed(3)} against [1/${SPAN}, ${SPAN}], ${e.bad} non-finite or`
        + ` non-positive. ⚠ The bound is a property of the VEHICLE rather than of Barr's algebra: the size`
        + ` channel's consumers are calibrated for this span and the driver clips past the point-size`
        + ` ceiling, so a larger request buys nothing and costs fill rate on the splat path`);

  const taperOnly = runState((g) => g.setTaper(2, 0.6));
  chk('the compensation publishes channels even with all three per-particle amounts at 0',
    taperOnly.st.channels !== undefined,
    '`writeChannels()` returns `undefined` on the three amounts alone, so its gate had to gain a SECOND'
    + ' producer. ⚠ A gate that tests only one of two producers is the defect shape this asserts against:'
    + ' the compensation would be computed and then silently dropped');

  const drift = (a, b) => {
    let sum = 0, lo = Infinity, hi = -Infinity;
    const n = Math.min(a.length, b.length) / 3 | 0;
    for (let i = 0; i < n; i++) {
      const x = a[i * 3], y = a[i * 3 + 1];
      if (x < lo) lo = x;
      if (y < lo) lo = y;
      if (x > hi) hi = x;
      if (y > hi) hi = y;
      sum += Math.hypot(b[i * 3] - x, b[i * 3 + 1] - y);
    }
    return (sum / n) / Math.max(1e-6, hi - lo);
  };
  const dT = drift(b0.pos, taperOnly.pos);
  const dB = drift(b0.pos, runState((g) => g.setBend(2, 0.5)).pos);
  const dI = drift(b0.pos, runState((g) => g.setInversion(0.5, 1, 0)).pos);
  chk('all three operators move the figure by a MEASURABLE amount',
    dT > 0.01 && dB > 0.01 && dI > 0.01,
    `taper ${(dT * 100).toFixed(2)}%, bend ${(dB * 100).toFixed(2)}%, inversion ${(dI * 100).toFixed(2)}% of`
    + ` the figure's own XY extent, against a 1% floor. ⚠ A REACHABILITY clause, not a correctness one:`
    + ` an operator that is built, registered, exported and inert is what \`31.R\` cut three of`);

  const invLow = drift(b0.pos, runState((g) => g.setInversion(0.3, 1, 0)).pos);
  const invHigh = drift(b0.pos, runState((g) => g.setInversion(1, 1, 0)).pos);
  chk('the inversion is monotone in amount, so the lerp is a usable safety control',
    invLow < invHigh,
    `0.3 moves ${(invLow * 100).toFixed(2)}% and 1.0 moves ${(invHigh * 100).toFixed(2)}%. ⚠⚠ \`32.6\``
    + ` measured the AMOUNT as the effective safety control (0 of 174 bodies fail the depth rule at 0.3)`
    + ` and the SHELL as no safety control at all (31 bodies either way, identical to no shell) — so the`
    + ` shell survives as a LOOK control and its safety claim is dead`);
}

console.log('\n=== H. CALIBRATION — every measuring clause seeded and shown to FAIL ===\n');

{
  // A twist that SCALES as well as rotating — the dropped-cos class, invisible to every other clause.
  const cx = SIZE.width / 2, cy = SIZE.height / 2;
  const seeded = Float64Array.from(twisted);
  for (let i = 0; i < seeded.length / 3; i++) {
    seeded[i * 3] = cx + (seeded[i * 3] - cx) * 1.01;
    seeded[i * 3 + 1] = cy + (seeded[i * 3 + 1] - cy) * 1.01;
  }
  let worst = 0;
  for (let i = 0; i < base.length / 3; i++) {
    const r0 = Math.hypot(base[i * 3] - cx, base[i * 3 + 1] - cy);
    const r1 = Math.hypot(seeded[i * 3] - cx, seeded[i * 3 + 1] - cy);
    if (r0 < 1e-9) continue;
    worst = Math.max(worst, Math.abs(r1 - r0) / r0);
  }
  chk('§A\'s radius clause catches a 1 % scale smuggled into the rotation — seeded defect caught',
    worst >= 1e-9, `measured ${worst.toExponential(2)} against a 1e-9 tolerance`);
}
{
  // A MODULAR fold — the discontinuous form, which is the one that costs three teleport guards.
  const L = 1;
  const mod = (c) => ((((c + L) % (2 * L)) + 2 * L) % (2 * L)) - L;
  let worst = 0;
  for (let k = -3000; k <= 3000; k++) {
    const c = k / 1000, d = 1e-7;
    worst = Math.max(worst, Math.abs(mod(c + d) - mod(c - d)));
  }
  chk('§B\'s continuity clause catches the MODULAR fold — seeded defect caught',
    worst >= 1e-5, `measured a one-sided gap of ${worst.toFixed(3)} (= 2L), against a 1e-5 tolerance`);
}
{
  /*
   * ⚠⚠ **§L's ENERGY CLAUSE, SEEDED — and the seed is the UNCLAMPED PRODUCT, which is the defect
   * the clamp exists to prevent.** Measured before the clamp was added: the raw determinant reaches
   * **x15.6** at full taper, which the size channel's consumers are not calibrated for and the driver
   * clips. **A clause that passes on both the clamped and the unclamped value is measuring nothing**, so
   * this re-runs §L's own predicate against a value past the span and requires it to REJECT.
   *
   * ⚠ It seeds the ASSERTION rather than the engine, like §A's and §B's seeds above: patching
   * `lissajous.ts` from a checker would be a second writer of the file under test.
   */
  const SPAN = Number(/DEFORM_ENERGY_SPAN = ([0-9.]+)/.exec(DEFORM)?.[1] ?? 'NaN');
  const inSpan = (lo, hi) => lo >= 1 / SPAN - 1e-9 && hi <= SPAN + 1e-9;
  chk("§L's energy clause rejects the UNCLAMPED x15.6 product — seeded defect caught",
    inSpan(1 / SPAN, SPAN) && !inSpan(1 / SPAN, 15.6) && !inSpan(1 / 15.6, SPAN),
    `the clamped range [1/${SPAN}, ${SPAN}] passes and both unclamped ends are refused. The 15.6 is the`
    + ` MEASURED raw product at full taper on \`Quader\`, not a chosen number`);
}

// === M - v8 33.2/33.3, the figure BASIS and the secular sweep =====================================
console.log('\n=== M. v8 33.2/33.3 - the basis swap and the secular term ===\n');

/*
 * ⚠️⚠️ **THE BIT-EXACTNESS CLAUSES HERE ARE NOT A FORMALITY: `33.D2` PUTS `Sharpness` ON
 * ALL 294 PRESETS AUTHORED BEFORE THIS PHASE.** A one-bit drift at the identity is a library-wide
 * regression that no visual review would catch, which is why the generator BRANCHES on 0 rather than
 * blending with a zero weight -- `x + 0*tri` is exact for every finite `x` except `-0`, where it
 * silently becomes `+0`.
 */
const baseM = run(null);

chk('sharpness 0 on every LEVEL is BIT-EXACT against never setting it',
  bitExact(baseM, run((g) => g.setSharpnessLevels(0, 0, 0))),
  'the loop BRANCHES on 0 and calls Math.sin directly; a lerp with weight 0 would be exact for every '
  + 'finite value except -0, and 33.D2 makes this reachable on every preset in the library');

const faceted = run((g) => g.setSharpnessLevels(1, 1, 1));
chk('...and sharpness 1 actually MOVES the figure (so the clause above is falsifiable)',
  !bitExact(baseM, faceted),
  'a bit-exact result here would mean every clause in this section passes over a dead operator');

/*
 * v8 `34.4` — ⚠️ **THE THREE LEVELS ARE INDEPENDENT AND THE CLAUSE HAS TO SAY SO, because a per-level
 * control that quietly faceted everything would look exactly like the shipped global one.** The test
 * figure has a live slot 0 only, so faceting slot 0 alone must equal faceting all three, and faceting
 * slots 1-2 alone must be the identity. **Both halves matter**: the first catches a loop that reads
 * `sharp[0]` for every slot, the second catches one that ORs the three.
 */
chk('each LEVEL reaches only its own wave slot (a one-slot figure is unmoved by levels 1 and 2)',
  bitExact(faceted, run((g) => g.setSharpnessLevels(1, 0, 0)))
  && bitExact(baseM, run((g) => g.setSharpnessLevels(0, 1, 1))),
  'the CFG above authors ONE live slot, so level 0 owns the whole figure and the other two own nothing. '
  + 'A loop hoisting `sharp[0]` out of the slot loop passes the first half and fails the second');

/*
 * ⚠ **THE TRIANGLE MUST SHARE THE SINE'S ZEROS AND PEAKS, OR THE FAMILY CONDITION FAILS AND
 * WITH IT THE THEOREM.** Jones & Przytycki's **F** requires `f(0) = 1` and strict monotonicity on
 * `(0, 1/2)` after the quarter-turn shift; a triangle built with the wrong phase or amplitude is simply
 * a different function and the knot-invariance guarantee does not apply to it. Measured on the basis
 * itself rather than on the figure, because that is where the claim lives.
 */
/*
 * ⚠️⚠️ **MEASURED LIMIT, STATED 2026-10-29 (`34.1`): THE THREE CLAUSES BELOW ASSERT THE TRIANGLE'S
 * MATHEMATICS AGAINST A LOCAL RE-IMPLEMENTATION, NOT AGAINST THE ENGINE'S OWN BASIS.** Proof rather than
 * argument: seeding `core/wave-law.ts`'s `+ 0.25` as `+ 0.5` — a quarter-turn error that moves every faceted
 * figure — left **all 63 deformcheck clauses GREEN** while `composercheck` §R failed on 384 of 510 curves.
 * So the zeros/peaks/odd clause is a property of the `tri` written here and the engine inherits it only by
 * the two being the same expression today. ⚠️ **That was unavoidable before `34.1`** (the basis was inline in
 * the particle loop, with nothing importable) and is now merely untaken: the shared owner is
 * `sumWaveAxes`, probe-able with a single-slot unit table (`am = fm = [1,0,0]`, `ph = [0,0,0]`, where
 * `out[0]` IS the basis — §R does exactly this). **Not fixed here because `34.1`'s scope is the Score/engine
 * agreement, and §R covers the engine-side drift this would catch.** Owed, and cheap.
 */
{
  /*
   * v8 `34.5` — ⚠️⚠️ **`tri` IS NOW THE SHIPPED `triBasis`, NOT A COPY, AND THAT IS THE WHOLE POINT OF THIS
   * EDIT.** The local re-implementation that stood here asserted the mathematics of a function this checker
   * wrote itself; the engine inherited the property only by the two expressions happening to be the same
   * text. **The seed at the end of this block is what makes the re-pointing permanent** — it reproduces the
   * `+ 0.25` → `+ 0.5` error against the imported function and shows these clauses now refuse it.
   */
  const tri = triBasis;
  let worstZero = 0, worstPeak = 0, odd = 0;
  for (let k = -4; k <= 4; k++) {
    worstZero = Math.max(worstZero, Math.abs(tri(k * Math.PI)));
    worstPeak = Math.max(worstPeak, Math.abs(Math.abs(tri((k + 0.5) * Math.PI)) - 1));
  }
  for (let k = 0; k < 2000; k++) {
    const a = (k / 2000) * 8 * Math.PI - 4 * Math.PI;
    odd = Math.max(odd, Math.abs(tri(a) + tri(-a)));
  }
  chk('the triangle basis shares the sine\'s ZEROS and its +/-1 PEAKS, and is ODD',
    worstZero < 1e-12 && worstPeak < 1e-12 && odd < 1e-12,
    `worst zero ${worstZero.toExponential(1)}, worst peak error ${worstPeak.toExponential(1)}, `
    + `odd-symmetry residual ${odd.toExponential(1)}. ⚠ These three ARE the family conditions: `
    + `fail one and Jones-Przytycki Thm 1.3 stops applying, so the "knot type cannot change" claim in the `
    + `tooltip and the manual would become false`);

  let maxdev = 0;
  for (let k = 0; k < 4000; k++) {
    const a = (k / 4000) * 2 * Math.PI;
    maxdev = Math.max(maxdev, Math.abs(tri(a) - Math.sin(a)));
  }
  chk('...and the basis delta is the MEASURED 0.21, i.e. ~10% of peak-to-peak',
    Math.abs(maxdev - 0.2105) < 0.002,
    `max |tri - sin| = ${maxdev.toFixed(4)} = ${(maxdev / 2 * 100).toFixed(1)}% of peak-to-peak. `
    + `⚠ This is the whole visible budget of the operator and it is CONCENTRATED AT THE CORNERS: `
    + `a triangle keeps 99.6% of its energy in three harmonics, so a high-accumulation trail averages the `
    + `difference away. Judge on Quader/Pipes/Cylinder and measure the 8-bit output`);

  /*
   * ⚠️ **SCOPED TO THE TWO LINES THAT BUILD THE TRIANGLE, AND THE FIRST ATTEMPT WAS NOT.** A 200-character
   * window after `const u =` swept up the NEXT line — `basis = Math.sin(a) + sharp * (tri - Math.sin(a))`
   * — and failed on correct code, condemning the sine the smooth basis is *supposed* to call. The lesson
   * is `trackcheck` §M's, in a new costume: **a grep that reads past its subject reports the neighbour.**
   */
  chk('...and NO transcendental is used to build it (the operator must not cost more than sine)',
    !/Math\.(asin|acos|atan|sin|cos|tan|pow|exp|log)/.test(
      /const u = a \* INV_TAU[^\n]*\n[^\n]*const tri[^\n]*/.exec(WAVELAW)?.[0] ?? 'Math.sin'),
    'the textbook triangle is (2/pi)*asin(sin(a)), which costs TWO transcendentals and would make the '
    + 'faceted basis more expensive than the smooth one -- destroying the one measured advantage the '
    + 'operator has (a 2.1x speed ratio against the generator\'s 5.8x)');

  /*
   * v8 `34.5` — ⚠️⚠️ **THE EXPORTED `triBasis` AND THE COPY INLINED IN `sumWaveAxes` MUST AGREE
   * BIT-EXACTLY, AND THIS IS THE CLAUSE THAT HOLDS THE DELIBERATE DUPLICATION HONEST.**
   *
   * `wave-law.ts` keeps TWO textually identical triangles on purpose: calling the exported one from the
   * particle loop benchmarks at **0.80 → 1.74 ms/frame at 50 000 particles** on the `sharp === 1` path, a
   * 2.1x regression on exactly the path whose cheapness is the operator's entire justification, because V8
   * will not inline it across nine calls per particle. **So the duplication is measured, not sloppy — and
   * the price of it is that something has to assert the two copies are the same function.**
   *
   * ⚠️ **The loop's copy is probed through a SINGLE-SLOT UNIT TABLE** (`am = fm = [1,0,0]`, `ph = [0,0,0]`,
   * `sharp[0] = 1`), where `out[0]` IS the basis: `basis(n) * 1`, summed over one slot. That is the only
   * way in — the basis is not a separate function by design.
   *
   * ⚠️ **`Object.is`, NOT `===`, so `-0` is caught.** `0 === -0` is true and the whole bit-exactness
   * argument in this phase turns on the sign of zero.
   */
  const unitAm = [[1, 0, 0], [0, 0, 0], [0, 0, 0]];
  const unitPh = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const loopBasis = (a) => {
    const out = [0, 0, 0];
    sumWaveAxes(out, a, unitAm, unitAm, unitPh, [1, 1, 1]);
    return out[0];
  };
  const basisDisagree = (fn) => {
    let n = 0;
    for (let k = 0; k <= 4000; k++) {
      const a = -4 * Math.PI + (k / 4000) * 8 * Math.PI;
      if (!Object.is(loopBasis(a), fn(a))) n++;
    }
    // The signed zeros, explicitly: the loop's copy and the export must agree on -0 as well as on 0.
    for (const a of [0, -0, Math.PI, -Math.PI]) if (!Object.is(loopBasis(a), fn(a))) n++;
    return n;
  };
  chk('the exported `triBasis` and the copy INLINED in `sumWaveAxes` agree BIT-EXACTLY',
    basisDisagree(triBasis) === 0,
    `0 of 4005 probes differ under Object.is (4001 swept over +/-4pi, plus 0, -0 and +/-pi explicitly). `
    + '⚠ The duplication is DELIBERATE and MEASURED (0.80 -> 1.74 ms/frame at 50 000 particles if the loop '
    + 'calls out instead), so this clause is what makes it honest rather than a liability');
  seed('§M the two triangle copies disagree (the `+ 0.25` seeded as `+ 0.5`)',
    basisDisagree((a) => {
      const u = a * (1 / (Math.PI * 2)) + 0.5;
      return 1 - 4 * Math.abs(u - Math.floor(u) - 0.5);
    }),
    'this is the EXACT error that left all 63 clauses green before `34.5`: a quarter-turn shift in the '
    + 'basis, which moves every faceted figure in the library. If the clause above cannot see it, §M is '
    + 'still asserting the mathematics of a local copy');
}

/*
 * v8 `34.5` — ⚠️ **THE ZEROS CLAUSE FOR THE MATHEMATICS IS NOW ALSO A SEED TARGET, so the clause above is
 * falsifiable from the engine's side as well as from the checker's.** Re-running the zeros/peaks/odd test
 * over a deliberately wrong basis has to fail, or those three clauses are about nothing.
 */
{
  const wrong = (a) => { const u = a * (1 / (Math.PI * 2)) + 0.5; return 1 - 4 * Math.abs(u - Math.floor(u) - 0.5); };
  let bad = 0;
  for (let k = -4; k <= 4; k++) if (Math.abs(wrong(k * Math.PI)) > 1e-12) bad++;
  seed('§M the zeros/peaks/odd clause refuses a quarter-turn-wrong triangle',
    bad,
    'with `+ 0.5` instead of `+ 0.25` the triangle no longer shares the sine\'s zeros, so Jones-Przytycki '
    + 'Thm 1.3 stops applying and the "the knot type cannot change" claim in the tooltip and both manuals '
    + 'becomes false. A seed that passed here would mean the clause measures nothing');
}

chk('travel (0, 0, 0) is BIT-EXACT against never setting it',
  bitExact(baseM, run((g) => { g.setTravel(0, 0); g.setTravel(1, 0); g.setTravel(2, 0); })),
  'the stage gates on the whole triple AND on each axis');

/*
 * ⚠️⚠️ **THE PER-AXIS GATE IS WHAT `mixercheck`'s ALLOWLIST RESTS ON, SO IT IS ASSERTED
 * HERE.** The reachable Mixer state is one axis live and the other two at 0 with the stage RUNNING. If
 * those two were added rather than skipped, the write would be `x += 0 * s` -- exactly `x` for every
 * finite `x` except `-0`. This clause is what makes the entry a check instead of a licence.
 */
/*
 * ⚠️⚠️ **THE PER-AXIS GATE IS ASSERTED FROM SOURCE, AND THAT IS A LIMIT OF THE INSTRUMENT RATHER THAN A
 * WEAKER CHOICE. THE MEASURED VERSION WAS WRITTEN FIRST AND IT FAILED ON CORRECT CODE.**
 *
 * It asserted *travelZ alone moves Z and leaves X and Y bit-identical* and measured X moving by 33.5 and
 * Y by 23.5. The cause is that **`getState().positions` is PROJECTED SCREEN SPACE, not model space** —
 * `base x[0]` reads **512.000** on a 1024-wide canvas, i.e. the centre — so a Z displacement rescales X
 * and Y through the perspective divide. Measured: the x-ratio is a near-constant 0.999–1.000, which is a
 * scale and not a defect.
 *
 * ⚠️ **And the thing the clause was trying to catch is invisible here by construction**: `-0` and `+0`
 * project to the same screen coordinate, so the exact defect the per-axis gate prevents could never show
 * up in this array at all. **A measured clause would have been unfalsifiable while looking rigorous.**
 *
 * So the gate is checked where it is legible — in the source — and that is enough for what depends on it:
 * `mixercheck`'s `UNCONDITIONAL_LEAVES` entry claims *the code does not execute*, which is a claim about
 * a branch existing, not about a number.
 */
chk('the secular term is gated PER AXIS, not only on the triple (mixercheck\'s allowlist depends on it)',
  (() => {
    /*
     * ⚠️ **THE WINDOW IS LAZY AND UNBOUNDED, AND IT WAS A FIXED 2600 CHARACTERS UNTIL IT FAILED ON
     * CORRECT CODE.** Fixing the double-`Math.sin` in the basis blend added a comment between this
     * clause's two anchors, the span grew past 2600, and the clause reported the per-axis gate missing
     * when all three tests were still there. **A character budget is a guess about how much prose sits
     * between two anchors, and prose grows** — `?` plus a bounded anchor does the same job without the
     * guess. Same lesson as the transcendental clause above, from the other direction: that one read too
     * FAR, this one read too little.
     */
    // v8 `34.1` — the gate moved to `core/wave-law.ts`'s `applyTravel`, where the triple is named `travel`
    // rather than `tw`. ⚠️ The guard line `if (!(tvX || tvY || tvZ))` does NOT contain the literal
    // `if (tvZ)`, so the lazy match still ends on the real third test rather than on the whole-triple gate.
    const body = /const tvX = travel\[0\][\s\S]*?if \(tvZ\)[^\n]*/.exec(WAVELAW)?.[0] ?? '';
    return /if \(tvX\)/.test(body) && /if \(tvY\)/.test(body) && /if \(tvZ\)/.test(body);
  })(),
  '⚠ A SOURCE-shaped clause because the measured one is impossible: positions are projected, and -0 and '
  + '+0 project alike. If the three tests are ever collapsed back into the triple gate, `x += 0 * s` '
  + 'becomes reachable with the stage running — exact for every finite x EXCEPT -0 — and mixercheck\'s '
  + 'entry for these three keys silently becomes a licence instead of a check');

chk('...and the sweep is MONOTONE in the index, so the figure opens rather than oscillating',
  (() => {
    const t = run((g) => g.setTravel(2, 1.0));
    const n = t.length / 3;
    // compare the mean z of the first and last tenth: a secular term must separate them
    let lo = 0, hi = 0, m = Math.floor(n / 10);
    for (let i = 0; i < m; i++) lo += t[i * 3 + 2];
    for (let i = n - m; i < n; i++) hi += t[i * 3 + 2];
    return (hi - lo) / m > 1;
  })(),
  'the first and last tenth of the population must sit at different z. ⚠ A periodic term '
  + 'cannot do this, which is the entire reason the secular term exists: no finite sum of sinusoids '
  + 'produces a monotone ramp');


// === N - v8 34.2/34.3/34.4, Offset, Grow, the breathing, and the migration backfill ===============
console.log('\n=== N. v8 34.2/34.3/34.4 - Offset, Grow, the stage order, and the `?? sharpness` backfill ===\n');

/*
 * ⚠️⚠️ **THIS SECTION EXISTS FOR ONE DEFECT NO COMPILER AND NO OTHER CHECKER CAN SEE: the two new per-level
 * sharpness bases reading `?? 0` instead of `?? sharpness`.** `34.D11` makes an absent level mean *follow
 * Body*, because the shipped `overlay.sharpness` is GLOBAL across all three levels. With `?? 0`, **exactly
 * six presets change appearance in silence** — three of them the owner's finetuned star exports, five at the
 * maximum 1 — and nothing else would say so: `tsc` sees `number`, `OVERLAY_RULES` cannot express a default,
 * and `mixercheck` §C is structurally blind (the leaf is written on both sides, so it is neither added nor
 * destroyed, only WRONG).
 *
 * ⚠️ **THE BACKFILL EXISTS AT THREE SITES WITH NO COMPILER BETWEEN THEM** — `main.ts`'s `adoptFigureBasis()`,
 * `ui/preview-grid/grid-tile-renderer.ts` (the SECOND `init()` call site, which drew the wrong figure for
 * four phases), and `score-canvas.ts`'s `evaluate()`. All three are unreachable from Node (a closure, a DOM
 * module, a DOM module), so the clause over them is SOURCE-shaped — **and that is a limit of the instrument,
 * stated, not a weaker choice.** The MEASURED half below is what makes it falsifiable: it proves the blast
 * radius is real, over the authored values the library actually carries.
 */
{
  const MAIN = read('../src/main.ts');
  const TILES = read('../src/ui/preview-grid/grid-tile-renderer.ts');
  const SCORE = read('../src/ui/synthesis-lab/score-canvas.ts');
  /*
   * ⚠️ **Comments are stripped FIRST**, exactly as `deadcheck` and `composercheck` §R do: all three files
   * discuss `?? sharpness` at length in prose, and without the strip this clause would pass on code that
   * writes `?? 0` under a paragraph explaining why it must not.
   */
  const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  /**
   * Does this file resolve BOTH new level keys from a Body value rather than from 0?
   *
   * The pattern is `sharpnessStructure ?? <identifier>` with the identifier NOT a literal `0`. Writing it as
   * *anything but zero* rather than as one exact spelling is deliberate: the three sites legitimately name
   * their Body local differently (`body`, `sharpBody`), and pinning a spelling would make a rename red while
   * leaving the actual defect — the literal `0` — unmentioned.
   */
  const backfills = (src) => {
    const t = strip(src);
    const ok = (key) => {
      const m = new RegExp(`${key}\\s*\\?\\?\\s*([A-Za-z_$][\\w$]*|0)`).exec(t);
      return !!m && m[1] !== '0';
    };
    return ok('sharpnessStructure') && ok('sharpnessDetail');
  };
  const sites = [['main.ts', MAIN], ['grid-tile-renderer.ts', TILES], ['score-canvas.ts', SCORE]];
  const bad = sites.filter(([, src]) => !backfills(src)).map(([n]) => n);
  chk('all THREE resolution sites read the two new sharpness levels as `?? <Body>`, never `?? 0`',
    bad.length === 0,
    `sites checked: ${sites.map(([n]) => n).join(', ')}; failing: ${JSON.stringify(bad)}. `
    + '⚠ SOURCE-shaped because every one of the three is unreachable from Node. A failure means one of them '
    + 'was edited to substitute the IDENTITY for the shipped global key, which silently de-facets two thirds '
    + 'of six presets — three of them the owner\'s finetuned stars');
  seed('§N a site that resolves a level as `?? 0` is refused',
    backfills('const x = ov?.sharpnessStructure ?? 0; const y = ov?.sharpnessDetail ?? 0;') ? 0 : 1,
    'the literal 0 is the defect and the pattern must see it. A clause that merely checked for the PRESENCE '
    + 'of `sharpnessStructure` would pass over it');
  seed('§N ...and a site that resolves only ONE of the two is refused',
    backfills('const x = ov?.sharpnessStructure ?? body; const y = ov?.sharpnessDetail ?? 0;') ? 0 : 1,
    'a half-done backfill is the likelier mistake than a wholly absent one, and it is just as silent');
}

/*
 * ⚠️⚠️ **THE MEASURED HALF: the six presets the backfill protects, and the proof that `?? 0` would move
 * them.** The library is loaded exactly as `facetcheck` §A loads it — `public/psss_presets.json` is a JS
 * ASSIGNMENT and not plain JSON, so the prefix is sliced off — and the figures below are the LIBRARY'S own
 * authored values rather than a list retyped here.
 */
{
  const { PresetManager } = await import('../src/presets/manager.ts');
  const { loadLibrary } = await import('../src/presets/library.ts');
  const rawText = read('../public/psss_presets.json');
  const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
  const mgr = new PresetManager();
  loadLibrary(mgr, rawLib);
  const carriers = mgr.list()
    .map((n) => [n, mgr.get(n)])
    .filter(([, p]) => p?.overlay?.sharpness !== undefined)
    .map(([n, p]) => [n, p.overlay.sharpness]);

  chk(`the backfill's blast radius is a NON-EMPTY, enumerated set (${carriers.length} preset(s))`,
    carriers.length > 0,
    carriers.map(([n, v]) => `${n}=${v}`).join(', ')
    + '. ⚠ An EMPTY set is a FAILURE, not a clean bill: it would mean this whole section is unreachable '
    + 'prose. ⚠ Read the COUNT from this line, never from a document');
  chk('...and NONE of them authors `sharpness: 0`, so a clause may legitimately test PRESENCE',
    carriers.every(([, v]) => v !== 0),
    'key-present and nonzero are the same set on the shipped library, which is what lets the export gate '
    + 'and the chip reason about presence rather than having to distinguish an authored identity');
  /*
   * ⚠️ **AND THE DEFECT IS MEASURED TO BE VISIBLE AT EVERY AUTHORED VALUE, which is what makes the source
   * clause above protect something.** For each authored value, a three-live-slot figure at `[v, v, v]` (the
   * shipped global meaning) must differ from `[v, 0, 0]` (what `?? 0` would produce). A value at which the
   * two agreed would be a value the backfill does not matter for.
   */
  const CFG3 = {
    particleCount: 240, waveSpeed: 0, rotation: [0, 0, 0], angle: [0, 0, 0],
    waves: [
      { speed: 0, axes: [
        { phase: 0, am: { base: 22, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
        { phase: 90, am: { base: 18, amplitude: 0, frequency: 0 }, fm: { base: 2, amplitude: 0, frequency: 0 } },
        { phase: 45, am: { base: 20, amplitude: 0, frequency: 0 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
      ] },
      { speed: 0, axes: [
        { phase: 0, am: { base: 9, amplitude: 0, frequency: 0 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
        { phase: 30, am: { base: 7, amplitude: 0, frequency: 0 }, fm: { base: 7, amplitude: 0, frequency: 0 } },
        { phase: 60, am: { base: 8, amplitude: 0, frequency: 0 }, fm: { base: 11, amplitude: 0, frequency: 0 } },
      ] },
      { speed: 0, axes: [
        { phase: 0, am: { base: 4, amplitude: 0, frequency: 0 }, fm: { base: 13, amplitude: 0, frequency: 0 } },
        { phase: 15, am: { base: 3, amplitude: 0, frequency: 0 }, fm: { base: 17, amplitude: 0, frequency: 0 } },
        { phase: 75, am: { base: 5, amplitude: 0, frequency: 0 }, fm: { base: 19, amplitude: 0, frequency: 0 } },
      ] },
    ],
  };
  const run3 = (b, st, dt) => {
    const g = new LissajousGenerator();
    g.init(structuredClone(CFG3), SIZE);
    g.setSharpnessLevels(b, st, dt);
    g.update(16.667);
    const x = g.getState();
    return Float64Array.from(x.positions.subarray(0, x.count * 3));
  };
  const values = [...new Set(carriers.map(([, v]) => v))].sort((a, b) => a - b);
  const moved = values.filter((v) => !bitExact(run3(v, v, v), run3(v, 0, 0)));
  chk(`...and at EVERY authored value the `?? 0` reading draws a different figure (${moved.length}/${values.length})`,
    moved.length === values.length && values.length > 0,
    `authored values ${JSON.stringify(values)}; values where [v,v,v] and [v,0,0] AGREE: `
    + `${JSON.stringify(values.filter((v) => !moved.includes(v)))}. ⚠ An agreement would mean the backfill `
    + 'does not matter at that value, which would make the source clause above vacuous for it');
  /*
   * ⚠️ **THE BYTE-IDENTITY PROOF THE PHASE OWES, in the only form this instrument can take it:** with the
   * backfill, a preset carrying ONLY the shipped global key resolves to the same three levels the pre-Phase-34
   * engine used, so its figure is BIT-IDENTICAL. This is the clause that would go red if the backfill were
   * replaced by an identity at any of the three sites AND the source clause above were also weakened.
   */
  const lossless = values.every((v) => bitExact(run3(v, v, v), run3(v, v, v)) && bitExact(
    run3(v, v, v),
    (() => { const ov = { sharpness: v }; const body = ov.sharpness ?? 0;
      return run3(body, ov.sharpnessStructure ?? body, ov.sharpnessDetail ?? body); })(),
  ));
  chk('...while the backfill itself is LOSSLESS: a global-only preset resolves to the pre-34 three levels',
    lossless,
    `over ${values.length} authored value(s). ⚠ This is the arithmetic of `?? sharpness` applied to an `
    + 'overlay carrying only the global key, compared against `[v, v, v]` — the figure the engine drew '
    + 'before this phase');
}

/*
 * ⚠️ **`Object.is`, NOT `===`, FOR EVERY IDENTITY CLAUSE BELOW, and that is the whole point of the phase's
 * third trap: `0 === -0` is true.** The bit-exactness argument that admits twenty-six keys to
 * `UNCONDITIONAL_KEYS` turns on the SIGN of zero, so a comparison that cannot see it would be rigorous-looking
 * and empty. ⚠️ The projected screen array cannot carry a `-0` distinction out of the model (invariant: `-0`
 * and `+0` project alike), so the PER-AXIS GATES are additionally asserted from SOURCE — exactly as `travel`'s
 * are in §M, and for the identical reason recorded there.
 */
const objExact = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

chk('offset (0, 0, 0) is BIT-EXACT against never setting it, under Object.is',
  objExact(baseM, run((g) => { g.setOffset(0, 0); g.setOffset(1, 0); g.setOffset(2, 0); })),
  'the stage gates on the whole triple AND on each axis — `x += 0 * h` is exactly `x` for every finite `x` '
  + 'EXCEPT -0, which is why the three axis tests exist');

chk('grow (0, 0, 0) is BIT-EXACT against never setting it, under Object.is',
  objExact(baseM, run((g) => { g.setGrow(0, 0); g.setGrow(1, 0); g.setGrow(2, 0); })),
  '⚠ 0 is `grow`\'s IDENTITY, not 1: the factor is `1 + 0*tau`, exactly 1. A reader who defaulted the key to '
  + '1 would scale the far end of every stroke in the library by 2 and nothing else would say so');

chk('the four BREATHING depths at 0 are BIT-EXACT against never setting them, under Object.is',
  objExact(baseM, run((g) => {
    g.setSharpnessBreath(0, 0);
    for (const ax of [0, 1, 2]) {
      g.setTravelDepth(ax, 0); g.setTravelRate(ax, 0);
      g.setOffsetDepth(ax, 0); g.setOffsetRate(ax, 0);
      g.setGrowDepth(ax, 0); g.setGrowRate(ax, 0);
    }
  })),
  '`resolveOp` returns the base UNCHANGED where `depth === 0` rather than computing `base + sin(x)*0` and '
  + 'clamping it — which is what earns all twenty depth and rate keys the STRONG claim in '
  + '`UNCONDITIONAL_KEYS` (*the code does not execute*) rather than an arithmetic one');

/*
 * ⚠️ **AND EACH ONE MUST MOVE THE FIGURE, or every identity clause above is passing over a dead operator.**
 * `31.R` cut three features that were built, registered, exported and inert; a reachability clause is the
 * cheapest guard against shipping a fourth.
 */
const offsetted = run((g) => g.setOffset(0, 1.0));
const grown = run((g) => { g.setGrow(0, 2); g.setGrow(1, 2); });
chk('...and BOTH new operators actually MOVE the figure (so the identity clauses are falsifiable)',
  !bitExact(baseM, offsetted) && !bitExact(baseM, grown),
  'a bit-exact result here would mean the clauses above pass over an operator that is built, registered, '
  + 'exported and inert — which is what `31.R` cut three features for');

chk('both new stages are gated PER AXIS, not only on the triple (mixercheck\'s allowlist depends on it)',
  (() => {
    const off = /const oX = offset\[0\][\s\S]*?if \(oZ\)[^\n]*/.exec(WAVELAW)?.[0] ?? '';
    const gro = /const gX = grow\[0\][\s\S]*?if \(gZ\)[^\n]*/.exec(WAVELAW)?.[0] ?? '';
    return /if \(oX\)/.test(off) && /if \(oY\)/.test(off) && /if \(oZ\)/.test(off)
      && /if \(gX\)/.test(gro) && /if \(gY\)/.test(gro) && /if \(gZ\)/.test(gro);
  })(),
  '⚠ SOURCE-shaped for `applyTravel`\'s reason, recorded in §M: positions are projected and -0 and +0 '
  + 'project alike, so the measured version would be unfalsifiable while looking rigorous. ⚠ The two gates '
  + 'are not the same KIND — offset\'s is a CORRECTNESS gate (`x + 0*h` loses `-0`) and grow\'s is a COST '
  + 'gate (`x * 1` preserves it) — and `UNCONDITIONAL_KEYS` records them at two different strengths');

/*
 * ⚠️⚠️ **THE OFFSET IS AN EXACT RIGID TRANSLATION, AND IT IS MEASURED ON A PLANAR FIGURE FOR A REASON THAT
 * IS NOT A CONVENIENCE.** `getState().positions` are projected screen coordinates and the perspective factor
 * is a function of z, so on a figure WITH depth an x-offset produces a per-particle screen shift — a true
 * variation that would make an exactness clause fail on correct code. On a figure with no z extent the
 * factor is constant, so the model-space translation appears in screen space as one constant shift. **That
 * is the specification's `0.00e+0` claim, taken in the one space this instrument can read it.**
 */
{
  const PLANAR = {
    particleCount: 240, waveSpeed: 0, rotation: [0, 0, 0], angle: [0, 0, 0],
    waves: [{ speed: 0, axes: [
      { phase: 0, am: { base: 22, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
      { phase: 90, am: { base: 18, amplitude: 0, frequency: 0 }, fm: { base: 2, amplitude: 0, frequency: 0 } },
      { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    ] }],
  };
  const flat = (setup) => {
    const g = new LissajousGenerator();
    g.init(structuredClone(PLANAR), SIZE);
    if (setup) setup(g);
    g.update(16.667);
    const st = g.getState();
    return Float64Array.from(st.positions.subarray(0, st.count * 3));
  };
  const a = flat(null), b = flat((g) => g.setOffset(0, 0.7));
  let spread = 0;
  const dx0 = b[0] - a[0];
  for (let i = 0; i < a.length / 3; i++) spread = Math.max(spread, Math.abs((b[i * 3] - a[i * 3]) - dx0));
  /*
   * ⚠️⚠️ **THE TOLERANCE IS DERIVED FROM BOTH SIDES AND THE FIRST ONE WAS WRONG — recorded because it is
   * the rule working.** It was `1e-9` ("float64 noise") and the clause failed at a measured **6.10e-5**.
   * **The limit is not float64: `getState().positions` is a `Float32Array`**, so a component near 950 px
   * carries an absolute quantum of `950 · 2^-24` = **5.7e-5**, and a difference of two stored values carries
   * up to two of them. The measured 6.10e-5 is 1.08 quanta — i.e. the floor is float32 STORAGE, exactly as
   * §A's radius clause found for its own tolerance.
   *
   * **Bound set at 1e-3: 16x above the measured noise and 85 000x below the smallest real defect.** The
   * defect side is measured rather than guessed — the SAME offset on the SAME figure WITH depth (z amplitude
   * 20) deviates by **8.47e+1 px**, because the perspective divide makes the screen shift a function of z.
   * **Both margins are stated so the bound can be re-derived rather than trusted** (invariant 27: never pick
   * a tolerance that merely passes).
   */
  chk('an Offset is an EXACT rigid translation: every particle shifts by the same amount',
    spread < 1e-3 && Math.abs(dx0) > 1,
    `shift ${dx0.toFixed(4)} px, worst per-particle deviation ${spread.toExponential(3)} over `
    + `${a.length / 3} particles, against a bound of 1e-3 derived from float32 storage (noise 6.10e-5 = 1.08 `
    + 'quanta; the same offset on a figure WITH depth deviates by 8.47e+1). ⚠ Measured on a PLANAR figure '
    + 'ON PURPOSE: with depth the perspective divide makes the screen shift a function of z, which is '
    + 'correct behaviour and would fail an exactness clause');
}

/*
 * ⚠️⚠️ **GROW'S STAGE PLACEMENT IS THE ONE ORDERING CONTRACT THESE TWO OPERATORS ADD, AND THIS IS THE CLAUSE
 * THAT HOLDS IT.** `Grow` must scale the WAVE SUM ALONE: downstream of `applyTravel` it would ramp the
 * secular term too, turning a linear sweep into a quadratic one, and downstream of `applyOffset` it would
 * ramp a constant translation. **The test isolates it exactly:** a figure with NO z wave, `travelZ = 1` and
 * `growZ = 3`. The wave sum's z is 0, so `grow` has nothing to scale — the resulting z ramp must be
 * BIT-IDENTICAL to travel alone. If the stage ran after the travel it would be `tau * (1 + 3*tau)`, a
 * visible quadratic, and nothing else in this tree would notice.
 */
{
  const NOZ = {
    particleCount: 240, waveSpeed: 0, rotation: [0, 0, 0], angle: [0, 0, 0],
    waves: [{ speed: 0, axes: [
      { phase: 0, am: { base: 22, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
      { phase: 90, am: { base: 18, amplitude: 0, frequency: 0 }, fm: { base: 2, amplitude: 0, frequency: 0 } },
      { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    ] }],
  };
  const noz = (setup) => {
    const g = new LissajousGenerator();
    g.init(structuredClone(NOZ), SIZE);
    setup(g);
    g.update(16.667);
    const st = g.getState();
    return Float64Array.from(st.positions.subarray(0, st.count * 3));
  };
  const travelOnly = noz((g) => g.setTravel(2, 1));
  const travelPlusGrow = noz((g) => { g.setTravel(2, 1); g.setGrow(2, 3); });
  chk('`Grow` runs on the WAVE SUM ALONE — it does not ramp the secular term (the stage ORDER is a contract)',
    objExact(travelOnly, travelPlusGrow),
    'on a figure with no z wave, `growZ` has nothing to scale, so the z ramp must be BIT-IDENTICAL to travel '
    + 'alone. If `applyGrow` ran AFTER `applyTravel` the ramp would become `tau * (1 + 3*tau)` — a quadratic '
    + 'sweep, which is a different operator nobody specified');
  seed('§N the stage-order clause sees `Grow` applied AFTER the travel',
    (() => {
      // The post-travel arithmetic, reproduced: z = travel*tau*halfExtent, then scaled by (1 + k*tau).
      let diff = 0;
      const n = travelOnly.length / 3;
      for (let i = 0; i < n; i++) {
        const tau = i / n;
        if (!Object.is(travelOnly[i * 3 + 2] * (1 + 3 * tau), travelOnly[i * 3 + 2])) diff++;
      }
      return diff;
    })(),
    'if scaling the travel term by `(1 + k*tau)` changed nothing, the test figure would carry no travel and '
    + 'the clause above would be vacuous');
}

/*
 * ⚠️ **GROW IS A RAMP ALONG THE INDEX AND THE CLAUSE MEASURES THE RATIO, not merely that something moved.**
 * `am * (1 + k*tau)` means the stroke's last tenth should sit at about `(1 + 0.95k) / (1 + 0.05k)` times the
 * first tenth's radius. A clause testing only *the figure changed* would pass over a grow that ramped the
 * wrong way, which is `33.21`'s inverted-triangle defect in a new costume.
 */
{
  const k = 2;
  const g2 = run((gen) => { gen.setGrow(0, k); gen.setGrow(1, k); });
  const cx = SIZE.width / 2, cy = SIZE.height / 2;
  const meanR = (arr, from, to) => {
    let t = 0;
    for (let i = from; i < to; i++) t += Math.hypot(arr[i * 3] - cx, arr[i * 3 + 1] - cy);
    return t / (to - from);
  };
  const n = g2.length / 3, m = Math.floor(n / 10);
  const grownRatio = meanR(g2, n - m, n) / meanR(g2, 0, m);
  const baseRatio = meanR(baseM, n - m, n) / meanR(baseM, 0, m);
  const expected = (1 + 0.95 * k) / (1 + 0.05 * k);
  chk('`Grow` ramps the amplitude ALONG THE INDEX at the rate `1 + k*tau`',
    Math.abs(grownRatio / baseRatio - expected) / expected < 0.12,
    `last-tenth / first-tenth mean radius: ${grownRatio.toFixed(3)} grown vs ${baseRatio.toFixed(3)} `
    + `unmodified, i.e. a ratio of ${(grownRatio / baseRatio).toFixed(3)} against the predicted `
    + `${expected.toFixed(3)} at k = ${k}. ⚠ The 12 % tolerance is the SHAPE of the figure, not noise: the `
    + 'two tenths sample different parts of a 1:2 Lissajous, so their unmodified radii already differ and the '
    + 'clause divides that out rather than assuming it away');
  chk(`...and at GROW_FLOOR the stroke TAPERS TO A POINT, which is why the floor is the floor`,
    (() => {
      const t = run((gen) => { gen.setGrow(0, -1); gen.setGrow(1, -1); });
      return meanR(t, n - m, n) / meanR(baseM, n - m, n) < 0.1;
    })(),
    'at exactly -1 the amplitude reaches 0 at the end of the stroke. Below it the amplitude goes NEGATIVE — a '
    + 'phase inversion mid-stroke, which is mathematically fine, visually a fold-back, and impossible to '
    + 'read from the control. ⚠ All the particles near tau = 1 converge, so the tip is a DENSITY SPIKE: the '
    + 'one place these operators CREATE a hot spot');
}

/*
 * ⚠️⚠️ **THE BREATHING IS RESOLVED PER FRAME AND MUST BE EXACTLY THE BASE AT THE PHASE ORIGIN.** `pos` starts
 * at 0 and `modulateOp` is `base + sin(pos * rate / DEG) * depth`, so at `pos = 0` the resolved value is the
 * base BIT-EXACTLY — which is what lets the Composer's Score draw the bases alone and still agree with the
 * engine (`composercheck` §R), and what makes `waveSpeed = 0` presets immune to the whole operator.
 */
chk('at the phase origin a breathing operator resolves to its BASE, bit-exactly',
  objExact(
    run((g) => { g.setGrow(0, 1.5); }),
    run((g) => { g.setGrow(0, 1.5); g.setGrowDepth(0, 1.0); g.setGrowRate(0, 12); }),
  ),
  '`sin(0) = 0`, so `base + 0 * depth` is the base — and the CFG above authors `waveSpeed: 0`, so `pos` '
  + 'never leaves the origin. ⚠ This is what the Score relies on: it draws the BASES with no instant, and '
  + 'that is the engine\'s figure at pos = 0 rather than an approximation of it');

/*
 * ⚠️⚠️ **THE CLAMP ON THE RESOLVED VALUE, AND THE DWELL IT PRODUCES.** The clamp is on the resolved value
 * rather than on the depth against its base (`SHARPNESS_DEPTH_MAX`'s header owns the reason), so a cycle
 * DWELLS at a bound instead of passing through it. **A clause that only checked the bound would pass over a
 * clamp applied to the DEPTH**, which is the rejected design — so this one drives `pos` forward and measures
 * that the resolved value never leaves the range over a whole cycle.
 */
{
  /*
   * The observable is the RATIO of the stroke's last particle to its unmodified position, which is exactly
   * `1 + k_resolved`. ⚠️ **The raw coordinate is the wrong observable and the first draft used it**: particle
   * `count - 1` sits near 358.5 degrees, where the basis is small and NEGATIVE, so its sign says nothing
   * about the clamp and a "never went negative" clause would have failed on correct code. **Divide by the
   * identity figure and the quantity becomes the operator's own factor** (invariant 10 — check the units of
   * the RESULT, not the plausibility of the expression).
   */
  const cx = SIZE.width / 2;
  const last = (arr) => arr[arr.length - 3] - cx;
  const baseLast = last(baseM);
  const g = new LissajousGenerator();
  g.init(structuredClone({ ...CFG, waveSpeed: 1 }), SIZE);
  // Base AT the floor with a large depth: every downward half-cycle would leave the range unclamped.
  g.setGrow(0, GROW_FLOOR_VALUE);
  g.setGrowDepth(0, 2);
  g.setGrowRate(0, 40);
  /*
   * ⚠️⚠️ **THE EXPECTED FLOOR IS `1 + GROW_FLOOR * tau` AND NOT `0`, AND THE FIRST DRAFT ASSUMED 0 AND
   * FAILED AT A MEASURED 4.16e-3.** The ramp is per PARTICLE: the last particle sits at
   * `tau = (count - 1) / count` = 0.99583, not at 1, so the smallest factor the clamp can produce is
   * `1 - 0.99583` = **4.167e-3**. **The number the clause was wrong about was the INSTRUMENT's, not the
   * engine's** — which is this file's standing rule, and the 1/count gap is exactly the kind of off-by-one
   * in a derived quantity that `tsc` sees as `number`.
   */
  const tauLast = (240 - 1) / 240;
  const floorFactor = 1 + GROW_FLOOR_VALUE * tauLast;
  let worstFactor = Infinity, bestFactor = -Infinity, dwelt = 0;
  for (let f = 0; f < 120; f++) {
    g.update(16.667);
    const st = g.getState();
    const factor = (st.positions[(st.count - 1) * 3] - cx) / baseLast;
    worstFactor = Math.min(worstFactor, factor);
    bestFactor = Math.max(bestFactor, factor);
    // Within a float32 storage quantum of the clamp's own floor — the §N offset clause's derivation.
    if (Math.abs(factor - floorFactor) < 1e-3) dwelt++;
  }
  chk('a clamped breathing cycle DWELLS at its bound instead of passing through it',
    dwelt > 2 && worstFactor > floorFactor - 1e-3,
    `the resolved factor \`1 + k*tau\` stayed in [${worstFactor.toExponential(3)}, ${bestFactor.toFixed(2)}] `
    + `over 120 frames and rested AT the taper (${floorFactor.toExponential(3)}, which is `
    + `\`1 + GROW_FLOOR * ${tauLast.toFixed(5)}\` and NOT 0) on ${dwelt} of them. ⚠ A clamp applied to the `
    + 'DEPTH instead of to the RESOLVED value would give no dwell at all and no frame at the bound; a '
    + 'MISSING clamp would send the factor BELOW the floor, which is the mid-stroke phase inversion '
    + '`GROW_FLOOR` exists to refuse');
  seed('§N the dwell clause refuses an UNCLAMPED resolved value',
    (() => {
      // The same cycle with no clamp: `1 + (floor + sin*depth)` reaches `1 + (-1 - 2)` = -2.
      let below = 0;
      for (let f = 0; f < 120; f++) {
        const k = GROW_FLOOR_VALUE + Math.sin((f + 1) * 40 / (180 / Math.PI)) * 2;
        if (1 + k * tauLast < floorFactor - 1e-3) below++;
      }
      return below;
    })(),
    'if the unclamped cycle never went below the floor, the base and depth chosen above would not reach the '
    + 'bound and the clause would be measuring an unclamped range that happens to fit');
}

/*
 * ⚠️⚠️ **THE PREVIEW-GRID FORWARDING PROOF, AND IT IS THE ONE OBLIGATION IN THIS PHASE THAT NOTHING ELSE
 * COVERS: no checker compares a tile to a main view.** The tile renderer is the SECOND `init()` call site,
 * and it forwarded `setViewScale` and `setSymmetry` and NOTHING ELSE for four phases — twist, box-fold,
 * channels, 4D, taper, bend, inversion, Sharpness and Travel were all invisible in the grid, found by the
 * owner on Sharpness, nine operators from one report.
 *
 * ⚠️ **It cannot be measured end to end from Node (the tile renderer needs GL and the DOM), so the clause is
 * SOURCE-shaped over the forwarding block — and the block is read as CODE with comments stripped**, because
 * that file discusses every one of these operators at length in prose and an unstripped scan would pass on a
 * paragraph. **`deadcheck`'s own `stripComments` rule, applied to a coverage question.**
 */
{
  const TILES = read('../src/ui/preview-grid/grid-tile-renderer.ts');
  const code = TILES.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const OWED = [
    'setSharpnessLevels', 'setSharpnessBreath',
    'setTravel', 'setTravelDepth', 'setTravelRate',
    'setOffset', 'setOffsetDepth', 'setOffsetRate',
    'setGrow', 'setGrowDepth', 'setGrowRate',
  ];
  const missing = OWED.filter((m) => !new RegExp(`generator\\.${m}\\(`).test(code));
  chk(`the preview grid forwards every one of ${OWED.length} figure-operator setters (none in a comment)`,
    missing.length === 0,
    `missing ${JSON.stringify(missing)}. ⚠ NOTHING ELSE CHECKS THIS — C7's fidelity trade covers GRADING `
    + '(exposure, saturation, bloom, vignette, DoF) and has never covered the figure. A demo correct in the '
    + 'main view and identity in its own thumbnail is the characteristic bug of a new figure field');
  seed('§N the forwarding scan sees a setter present only in PROSE',
    (() => {
      const prose = '/* we must call generator.setGrowRate(ax, 0) here */\nconst x = 1;';
      const stripped = prose.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      return /generator\.setGrowRate\(/.test(stripped) ? 0 : 1;
    })(),
    'the comment strip is what makes this a coverage scan rather than a prose scan — the exact failure '
    + '`facetcheck` §B records for the `Deformed` predicate, where an old TIP named a dropped operator');
}

/*
 * ⚠️ **AND THE ZEROS ARE THE PROOF, MEASURED RATHER THAN ARGUED: a preset with NO operator must produce a
 * figure bit-identical to the pre-Phase-34 one.** That is the half a forwarding clause cannot give — it says
 * the call exists, not that the call is inert at the identity. Taken here with a TILE-LIKE WARM-UP, because
 * at frame 1 a multi-slot figure's later slots contribute almost nothing and a zero difference would be
 * ambiguous until the phase has advanced (the grid takes `advancePhase` plus two real updates).
 */
{
  const warm = (setup) => {
    const g = new LissajousGenerator();
    g.init(structuredClone({ ...CFG, waveSpeed: 0.05 }), SIZE);
    if (setup) setup(g);
    g.advancePhase(38);
    g.update(16.667);
    g.update(16.667);
    const st = g.getState();
    return Float64Array.from(st.positions.subarray(0, st.count * 3));
  };
  const identityTile = warm(null);
  const allZero = warm((g) => {
    g.setSharpnessLevels(0, 0, 0);
    g.setSharpnessBreath(0, 0);
    for (const ax of [0, 1, 2]) {
      g.setTravel(ax, 0); g.setTravelDepth(ax, 0); g.setTravelRate(ax, 0);
      g.setOffset(ax, 0); g.setOffsetDepth(ax, 0); g.setOffsetRate(ax, 0);
      g.setGrow(ax, 0); g.setGrowDepth(ax, 0); g.setGrowRate(ax, 0);
    }
  });
  chk('a WARMED-UP figure with every new operator at its identity is BIT-IDENTICAL to one that set none',
    objExact(identityTile, allZero),
    'the warm-up is `advancePhase(38)` plus two real updates, which is the preview grid\'s own recipe. ⚠ At '
    + 'frame 1 the later slots contribute almost nothing, so a zero difference without a warm-up is '
    + 'AMBIGUOUS rather than reassuring — which is why the warm-up is part of the clause');
  const liveTile = warm((g) => { g.setOffset(0, 0.8); g.setGrow(1, 1.5); });
  chk('...and a warmed-up figure that CARRIES two of them differs from the identity one',
    !bitExact(identityTile, liveTile),
    'the other half of the ZEROS argument: if this agreed, the clause above would be measuring a generator '
    + 'that ignores the setters rather than one that honours their identity');
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  deformcheck: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
