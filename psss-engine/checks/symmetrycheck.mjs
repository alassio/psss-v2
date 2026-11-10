/**
 * symmetrycheck — v8 Phase 42, 3-D Symmetry (the POSITIONS × COPIES-AT-EACH model, owner 2026-11-06).
 *
 * ⚠️ **The arrangements are MEASURED, not trusted**: a solid's points are built by closure in `core/symmetry-groups.ts`,
 * and a wrong generator or a wrong axis gives a wrong arrangement silently — the figure still draws, just with the wrong
 * copies. So §A holds every solid's point count, the DUALITIES (the octahedron's vertices ARE the cube's face centres,
 * the dodecahedron's the icosahedron's, the tetrahedron's vertices and faces together the cube's vertices) and vertex-
 * transitivity (every point has the same neighbour distances — an orbit, not a list), plus the ring's exact spacing and
 * the sphere's spread. §B holds the operator: positions × copies, orthonormal, OUTWARD maps the copy's z to its
 * position, PARALLEL is position-independent, and Mirrors reflects exactly every second copy at a position.
 * §C/§D are source-shaped by design (a behaviour-neutral rename breaks them; read the assertion before believing a
 * failure is a regression); §E measures the demo set.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Line endings normalised: several sources are CRLF, and a pattern that spans lines must not depend on that.
const read = (f) => readFileSync(join(ROOT, 'src', f), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let pass = 0, fail = 0, calibFail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const seed = (n, caught) => { console.log(`  ${caught ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${caught ? 'caught' : 'NOT CAUGHT'}`); if (!caught) calibFail++; };

const S = await import('../src/core/symmetry-groups.ts');
const det = (a) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
const mats = (op) => Array.from({ length: op.copies }, (_, i) => Array.from(op.mats.subarray(i * 9, i * 9 + 9)));
const dirs = (op) => Array.from({ length: op.copies }, (_, i) => Array.from(op.dirs.subarray(i * 3, i * 3 + 3)));
const mul = (A, B) => { const R = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return R; };
const keyV = (v) => v.map((x) => Math.round(x * 1e6) + 0).join(',');
const setOf = (pts) => new Set(pts.map(keyV));
const sameSet = (a, b) => a.length === b.length && [...setOf(a)].every((k) => setOf(b).has(k));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cfg = (layout, extra = {}) => ({ ...S.SYM3D_DEFAULTS, layout, radius: 1, ...extra });
const SOLIDS = ['tetrahedron', 'octahedron', 'cube', 'icosahedron', 'dodecahedron'];
const pts = (layout, on, positions) => S.sym3dPositions({ layout, on, positions });
/** Every point sees the same sorted distance profile to all others — true of an orbit, false of an arbitrary list. */
const transitive = (P) => {
  const prof = (p) => P.map((q) => dist(p, q)).sort((a, b) => a - b).map((d) => d.toFixed(6)).join(',');
  const first = prof(P[0]);
  return P.every((p) => prof(p) === first);
};

console.log('\n=== A. the arrangements ===\n');
{
  const bad = [];
  for (const s of SOLIDS) for (const on of S.SYM3D_ONS) {
    const P = pts(s, on);
    const want = S.SYM3D_SOLID_POINTS[s][on];
    if (P.length !== want || setOf(P).size !== want) bad.push(`${s} ${on}: ${P.length} points, expected ${want}`);
    else if (P.some((p) => Math.abs(Math.hypot(...p) - 1) > 1e-9)) bad.push(`${s} ${on}: not unit`);
    else if (!transitive(P)) bad.push(`${s} ${on}: not an orbit (distance profiles differ)`);
  }
  chk('every solid × {vertices, edges, faces} has its stated count, unit, distinct, and is an ORBIT (vertex-transitive)',
    bad.length === 0, bad.join('; ') || `${SOLIDS.length * 3} arrangements`);
  const cubeV = pts('cube', 'vertices');
  const duals = [
    ['octahedron vertices = cube faces', sameSet(pts('octahedron', 'vertices'), pts('cube', 'faces'))],
    ['octahedron faces = cube vertices', sameSet(pts('octahedron', 'faces'), cubeV)],
    ['dodecahedron vertices = icosahedron faces', sameSet(pts('dodecahedron', 'vertices'), pts('icosahedron', 'faces'))],
    ['dodecahedron faces = icosahedron vertices', sameSet(pts('dodecahedron', 'faces'), pts('icosahedron', 'vertices'))],
    ['tetrahedron vertices ∪ faces = cube vertices', sameSet([...pts('tetrahedron', 'vertices'), ...pts('tetrahedron', 'faces')], cubeV)],
    ['cube vertices are (±1,±1,±1)/√3', cubeV.every((p) => p.every((x) => Math.abs(Math.abs(x) - 1 / Math.sqrt(3)) < 1e-9))],
  ];
  const off = duals.filter(([, ok]) => !ok).map(([n]) => n);
  chk('the duals share their points (the solid is the right one, not merely one of the right size)', off.length === 0, off.join('; ') || `${duals.length} identities`);
  seed('§A a solid turned off its axes is not its dual\'s point set', (() => {
    const c = Math.cos(0.1), s = Math.sin(0.1);
    const turned = pts('octahedron', 'vertices').map((p) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]]);
    return !sameSet(turned, pts('cube', 'faces'));
  })());
  seed('§A an arbitrary point list of the right size is not an orbit', !transitive([...pts('cube', 'faces').slice(0, 5), [0.6, 0.8, 0]]));

  const ringBad = [];
  for (let n = S.SYM3D_POSITIONS_RANGE.ring[0]; n <= S.SYM3D_POSITIONS_RANGE.ring[1]; n++) {
    const P = pts('ring', 'vertices', n);
    if (P.length !== n || P.some((p) => Math.abs(p[2]) > 1e-12 || Math.abs(Math.hypot(...p) - 1) > 1e-9)) { ringBad.push(`ring ${n}`); continue; }
    if (n > 1 && P.some((p, j) => Math.abs(dist(p, P[(j + 1) % n]) - 2 * Math.sin(Math.PI / n)) > 1e-9)) ringBad.push(`ring ${n} uneven`);
  }
  const sphereBad = [];
  for (let n = S.SYM3D_POSITIONS_RANGE.sphere[0]; n <= S.SYM3D_POSITIONS_RANGE.sphere[1]; n++) {
    const P = pts('sphere', 'vertices', n);
    let dmin = Infinity;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) dmin = Math.min(dmin, dist(P[a], P[b]));
    // An even spread keeps the closest pair within a fixed fraction of the ideal spacing √(4π/n) (Fibonacci: ≥ ~0.55).
    if (P.length !== n || P.some((p) => Math.abs(Math.hypot(...p) - 1) > 1e-9) || dmin < 0.5 * Math.sqrt((4 * Math.PI) / n)) sphereBad.push(`sphere ${n} (closest ${dmin.toFixed(3)})`);
  }
  chk('a Ring of n is n points evenly spaced on the equator; a Sphere of n is n unit points spread evenly (closest pair ≥ ½ the ideal spacing)',
    ringBad.length === 0 && sphereBad.length === 0, [...ringBad, ...sphereBad].join('; ') || 'every n in both ranges');
  seed('§A the spread bound refuses a clumped sphere (all points in one cap)', (() => {
    const n = 20, P = Array.from({ length: n }, (_, j) => { const z = 1 - 0.2 * (j + 0.5) / n, r = Math.sqrt(1 - z * z); return [r * Math.cos(j * 2.4), r * Math.sin(j * 2.4), z]; });
    let dmin = Infinity; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) dmin = Math.min(dmin, dist(P[a], P[b]));
    return dmin < 0.5 * Math.sqrt((4 * Math.PI) / n);
  })());
  chk('Off is NO operator (the stage is skipped, so a preset without 3-D Symmetry is bit-identical)',
    S.resolveSym3d(cfg('off', { local: 4, mirrors: true })) === null && S.sym3dCopies(cfg('off')) === 1, '');
}

console.log('\n=== B. the operator ===\n');
{
  const outwardOk = (op) => mats(op).every((M, c) => { const d = dirs(op)[c]; return Math.hypot(M[2] - d[0], M[5] - d[1], M[8] - d[2]) < 1e-9; });
  const cases = [
    cfg('ring', { positions: 5, local: 2, mirrors: true }), cfg('ring', { positions: 7 }), cfg('sphere', { positions: 13, local: 3 }),
    cfg('cube', { on: 'faces', local: 4 }), cfg('tetrahedron', { on: 'faces', local: 3, mirrors: true }),
    cfg('icosahedron', { on: 'edges', local: 2, facing: 'parallel' }), cfg('dodecahedron', { on: 'vertices', local: 5, mirrors: true }),
    cfg('octahedron', { on: 'vertices', local: 1 }),
  ];
  const bad = [];
  for (const c of cases) {
    const op = S.resolveSym3d(c);
    const P = S.sym3dPositions(c).length, label = `${c.layout}/${c.on}/${c.positions}×${c.local}${c.mirrors ? '+m' : ''}/${c.facing}`;
    const M = mats(op);
    if (op.copies !== P * c.local) { bad.push(`${label}: ${op.copies} copies, expected ${P}×${c.local}`); continue; }
    if (M.some((A) => mul(A, [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]]).some((v, i) => Math.abs(v - (i % 4 === 0 ? 1 : 0)) > 1e-9))) bad.push(`${label}: non-orthonormal`);
    // Mirrors: within each position, copy k is a reflection iff k is odd.
    const reflWrong = M.filter((A, i) => (det(A) < 0) !== (c.mirrors && (i % c.local) % 2 === 1)).length;
    if (reflWrong) bad.push(`${label}: ${reflWrong} copies with the wrong handedness`);
    if (c.facing === 'outward' && !outwardOk(op)) bad.push(`${label}: a copy's z does not point to its position`);
    if (c.facing === 'parallel' && M.some((A, i) => keyV(A) !== keyV(M[i % c.local]))) bad.push(`${label}: parallel copies differ between positions`);
    // The copies at one position are DISTINCT (turned 2πk/local), else Copies at Each would stack copies invisibly.
    for (let p = 0; p < P; p++) if (setOf(M.slice(p * c.local, (p + 1) * c.local)).size !== c.local) { bad.push(`${label}: stacked copies at position ${p}`); break; }
  }
  chk('copies = positions × copies at each; orthonormal; Outward points each copy\'s z at its position; Parallel is the same at every position; '
    + 'Mirrors reflects exactly every second copy; the copies at one position are distinct',
    bad.length === 0, bad.join('; ') || `${cases.length} configurations`);
  seed('§B a Parallel operator fails the Outward test (the facing is really applied)', !outwardOk(S.resolveSym3d(cfg('cube', { on: 'vertices', facing: 'parallel' }))));
  seed('§B a mirrorless operator has no reflections where Mirrors asks for every second', (() => {
    const M = mats(S.resolveSym3d(cfg('ring', { positions: 3, local: 4, mirrors: false })));
    return M.filter((A, i) => (det(A) < 0) !== ((i % 4) % 2 === 1)).length > 0;
  })());
  chk('the copy count clamps to the published ranges (a stored value out of range cannot run away)',
    S.sym3dCopies(cfg('ring', { positions: 999, local: 999 })) === S.SYM3D_POSITIONS_RANGE.ring[1] * S.SYM3D_LOCAL_RANGE[1]
    && S.sym3dCopies(cfg('sphere', { positions: Number.NaN })) === S.SYM3D_POSITIONS_RANGE.sphere[0], '');
}

console.log('\n=== C. the operator (lissajous.ts) ===\n');
{
  const src = strip(read('generators/lissajous.ts'));
  const block = (src.match(/const s3 = this\.sym3d;[\s\S]*?\n {4}\}\n/) ?? [''])[0];
  chk('the stage is a BRANCH on the resolved operator (null = Off)', /if \(s3 !== null\) \{/.test(block), '');
  chk('it REPLICATES, never folds: copy = i mod copies, no angle arithmetic (E131\'s chopped segments)',
    /const c = i % copies/.test(block) && !/atan2|% sector/.test(block), 'a fold would cut the curve at every mirror plane');
  chk('the arrangement is fitted back to the figure\'s size: scaled by 1 / (1 + radius)', /const fit = 1 \/ \(1 \+ s3\.radius\);/.test(block), '');
  // ⚠️ The rotation statement also appears in an EARLIER, separate update path, so "before the rotation" means the
  // first rotation AFTER the stage — the first version of this clause matched that other copy and failed correct code.
  const iFold = src.indexOf('const fold = this.symmetryFold;'), iS3 = src.indexOf('const s3 = this.sym3d;');
  const iRot = src.indexOf('this.angle[0]! += this.rotationSpeed[0]! * rotFactor;', iS3);
  chk('it runs after the 2-D fold and before the rotation (model space)',
    iFold >= 0 && iFold < iS3 && iRot > iS3 && iRot - iS3 < 4000, `fold ${iFold}, 3-D ${iS3}, rotation ${iRot}`);
}

console.log('\n=== D. the wiring ===\n');
{
  const KEYS = ['sym3dLayout', 'sym3dPositions', 'sym3dOn', 'sym3dLocal', 'sym3dRadius', 'sym3dMirrors', 'sym3dFacing'];
  const main = strip(read('main.ts'));
  chk('ONE reader, adopted on BOTH preset apply paths (applyPresetChange and Reset)',
    (main.match(/adoptSym3d\((preset\.overlay|ov)\);/g) ?? []).length === 2 && KEYS.every((k) => main.includes(`ov?.${k} ??`)), '');
  // ⚠️ The export helper is used ONCE (the snapshot's plain branch) and is ABSENT from `livePreservedOverlay()`
  // (owner, 2026-11-10): `Apply Visual FX` off must switch 3-D Symmetry off with every other Visual FX operator.
  const lpo = (() => { const s = main.indexOf('function livePreservedOverlay(): OverlayState {'); return main.slice(s, main.indexOf('\n  }\n', s)); })();
  chk('the export is value-GATED on the layout, written by the snapshot, and NOT in the bypass\'s preserved set',
    (main.match(/\.\.\.sym3dExport\(\),/g) ?? []).length === 1 && /sym3d\.layout !== 'off' \?/.test(main)
    && lpo.length > 0 && !/sym3d|symmetryFold/.test(lpo), '');
  const tiles = strip(read('ui/preview-grid/grid-tile-renderer.ts'));
  chk('the preview tiles forward all seven keys (a tile without them shows a different SHAPE — 33.21\'s failure)',
    /generator\.setSymmetry3d\(\{/.test(tiles) && KEYS.every((k) => tiles.includes(`overlay?.${k} ??`)), '');
  const rules = strip(read('exploration/overlay-rules.ts'));
  const snapped = KEYS.filter((k) => k !== 'sym3dRadius');
  chk('the arrangement, counts, mirrors and facing SNAP; the Radius lerps (invariant 16)',
    snapped.every((k) => new RegExp(`${k}: \\{\\s*group: 'visual', law: \\{ kind: 'snap' \\}`).test(rules))
    && /sym3dRadius: \{\s*group: 'visual', law: \{ kind: 'lerp' \}/.test(rules), '');
  const interp = read('exploration/interpolate.ts');
  chk('the Mixer identity of the Radius IS the default (centred)',
    Number((interp.match(/\n\s*sym3dRadius: ([\d.]+),/) ?? [])[1]) === S.SYM3D_DEFAULTS.radius, '');
}

console.log('\n=== E. the demos ===\n');
{
  const { VARIANT_PRESETS } = await import('../src/presets/variant-presets.ts');
  const vfx = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tabs/visual-fx.ts'), 'utf8');
  const MAXP = Number((vfx.match(/export const MAX_PARTICLE_COUNT = (\d+);/) ?? [])[1]);
  const demos = VARIANT_PRESETS.filter((v) => (v.preset.overlay?.sym3dLayout ?? 'off') !== 'off');
  const ov = (d) => d.preset.overlay;
  const layouts = new Set(demos.map((d) => ov(d).sym3dLayout));
  const solids = demos.filter((d) => SOLIDS.includes(ov(d).sym3dLayout));
  const desc = demos.map((d) => `${d.name} (${ov(d).sym3dLayout}${SOLIDS.includes(ov(d).sym3dLayout) ? '/' + (ov(d).sym3dOn ?? 'vertices') : ' ' + ov(d).sym3dPositions}×${ov(d).sym3dLocal ?? 1}${ov(d).sym3dMirrors ? '+m' : ''})`);
  chk('the demos show a Ring, a Sphere and ≥ 3 solids; both vertices and faces; local copies with AND without Mirrors; both facings',
    layouts.has('ring') && layouts.has('sphere') && new Set(solids.map((d) => ov(d).sym3dLayout)).size >= 3
    && ['vertices', 'faces'].every((o) => solids.some((d) => (ov(d).sym3dOn ?? 'vertices') === o))
    && demos.some((d) => (ov(d).sym3dLocal ?? 1) > 1 && ov(d).sym3dMirrors === true)
    && demos.some((d) => (ov(d).sym3dLocal ?? 1) > 1 && ov(d).sym3dMirrors !== true)
    && ['outward', 'parallel'].every((f) => demos.some((d) => (ov(d).sym3dFacing ?? 'outward') === f)),
    desc.join(', '));
  // Owner 2026-11-06: the demos animate by themselves — no Neon Lines, no Electric Discharge. ⚠️ The Radius is NOT
  // bounded per demo: a first version required every demo to SEPARATE its copies (≥ 1.5), and the owner's finetuned
  // exports (2026-11-07) put `Thicket Globe` at 0 and `Cesaro Cube` at 0.5 — overlapping copies are the other legible
  // picture, not a defect. The clause asks that the SET show both pictures.
  const lit = demos.filter((d) => ov(d).linesEnabled || ov(d).dischargeEnabled).map((d) => d.name);
  const apart = demos.filter((d) => (ov(d).sym3dRadius ?? 0) >= 1.5).map((d) => d.name);
  const close = demos.filter((d) => (ov(d).sym3dRadius ?? 0) < 1.5).map((d) => d.name);
  chk('no demo draws Neon Lines or Electric Discharge, and the set shows copies both SEPARATED (Radius ≥ 1.5) and OVERLAPPING',
    lit.length === 0 && apart.length > 0 && close.length > 0,
    lit.length ? lit.map((n) => `${n}: lines/discharge`).join('; ') : `separated: ${apart.join(', ')} | overlapping: ${close.join(', ') || 'none'}`);
  const over = demos.filter((d) => d.preset.generators.particleCount > MAXP).map((d) => d.name);
  chk('no demo asks for more particles than the Particle Number track can show', over.length === 0 && MAXP > 0,
    over.length ? `over ${MAXP}: ${over.join(', ')}` : `track max ${MAXP}`);
}

console.log(`\nsymmetrycheck: ${pass} passed, ${fail} failed${calibFail ? `, ${calibFail} CALIBRATION FAILURES` : ''}`);
process.exit(fail > 0 || calibFail > 0 ? 1 : 0);
