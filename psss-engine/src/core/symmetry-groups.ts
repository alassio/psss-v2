/**
 * @file v8 Phase 42 — **3-D Symmetry: where the copies of a figure sit, and how many share each place, as data.**
 *
 * ⚠️⚠️ **IMPORTS NOTHING AND MUST KEEP DOING SO** — `checks/symmetrycheck.mjs` loads it under bare Node, which strips
 * types only: no `enum`, no class, no constructor parameter property.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MODEL — two factors, controlled separately (owner, 2026-11-06)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * A solid's symmetry group always splits its copies into **positions × copies at each position** (the orbit–
 * stabiliser theorem): the cube's 24 rotations with the offset towards a vertex are 8 vertices × 3 copies turned about
 * each vertex axis. A group fixes both numbers, so nothing in between is reachable — the owner's observation. This
 * module therefore sets the two factors INDEPENDENTLY:
 *
 *  - **Arrangement + Positions** — where the copies sit around the centre: a RING of n (exact, evenly spaced), a
 *    SPHERE of n (spread evenly — most counts have no perfect symmetric arrangement, so a Fibonacci spiral), or a
 *    solid's vertices / edge midpoints / face centres (exact: the ORBIT of the axis under the solid's rotation group).
 *  - **Copies at each** — how many copies share each position, turned evenly about its radial axis; with **Mirrors**
 *    every second one is mirrored.
 *  - **Facing** — each copy turned so its own z axis points OUTWARD (a ring reads as a wreath, a sphere as a shell), or
 *    kept PARALLEL to the original.
 *
 * The operator REPLICATES (particle `i` → copy `i mod total`), never folds: a fold cuts the curve at every mirror plane
 * (`E131`, dropped: *"chops the figure into multiplied line segments"*).
 */

/** Where the copies sit. `off` = the operator does not run (a BRANCH, bit-identical). */
export type Sym3dLayout = 'off' | 'ring' | 'sphere' | 'tetrahedron' | 'octahedron' | 'cube' | 'icosahedron' | 'dodecahedron';
/** For a solid: which of its points carry a copy. */
export type Sym3dOn = 'vertices' | 'edges' | 'faces';
/** Each copy's orientation: turned outward along its position, or parallel to the original. */
export type Sym3dFacing = 'outward' | 'parallel';

/** The layouts in UI order and their labels — ⚠️ `Record`s over the unions, so a new member is a compile error. */
export const SYM3D_LAYOUTS: readonly Sym3dLayout[] = ['off', 'ring', 'sphere', 'tetrahedron', 'octahedron', 'cube', 'icosahedron', 'dodecahedron'];
export const SYM3D_LAYOUT_LABELS: Record<Sym3dLayout, string> = {
  off: 'Off', ring: 'Ring', sphere: 'Sphere', tetrahedron: 'Tetrahedron', octahedron: 'Octahedron',
  cube: 'Cube', icosahedron: 'Icosahedron', dodecahedron: 'Dodecahedron',
};
export const SYM3D_ONS: readonly Sym3dOn[] = ['vertices', 'edges', 'faces'];
export const SYM3D_ON_LABELS: Record<Sym3dOn, string> = { vertices: 'Vertices', edges: 'Edges', faces: 'Faces' };
export const SYM3D_FACINGS: readonly Sym3dFacing[] = ['outward', 'parallel'];
export const SYM3D_FACING_LABELS: Record<Sym3dFacing, string> = { outward: 'Outward', parallel: 'Parallel' };

/** The counted layouts (the others take their positions from the solid). */
export const SYM3D_COUNTED: readonly Sym3dLayout[] = ['ring', 'sphere'];
/** Positions per counted layout, and copies per position. */
export const SYM3D_POSITIONS_RANGE: Record<'ring' | 'sphere', readonly [number, number]> = { ring: [1, 24], sphere: [2, 60] };
export const SYM3D_POSITIONS_MAX = 60;
export const SYM3D_LOCAL_RANGE = [1, 12] as const;
/**
 * The Radius, in half-extents of the design box. ⚠️ It reaches 3 because a figure is itself ~1 half-extent in radius:
 * at ≤ 1 neighbouring copies overlap into one noisy ball and the legible picture — distinct copies arranged around the
 * centre — is unreachable (measured 2026-11-06 on the first demo set). The step is 1/64 (192 whole steps).
 */
export const SYM3D_RADIUS_RANGE = [0, 3] as const;
/** The defaults — `layout: 'off'` is the identity; `radius` 0 is centred. */
export const SYM3D_DEFAULTS = {
  layout: 'off' as Sym3dLayout, positions: 6, on: 'vertices' as Sym3dOn, local: 1, radius: 0,
  mirrors: false, facing: 'outward' as Sym3dFacing,
};
/**
 * From this many copies in total the row says the figure thins (`42.D6`: a notice, never an automatic particle
 * increase). Measured on the probe: 24 copies is where a 42 000-particle curve first thins visibly.
 */
export const SYM3D_THIN_COPIES = 24;

export interface Sym3dConfig {
  layout: Sym3dLayout;
  positions: number;
  on: Sym3dOn;
  local: number;
  radius: number;
  mirrors: boolean;
  facing: Sym3dFacing;
}

type M3 = number[];   // row-major 3×3
type V3 = number[];

const mul = (A: M3, B: M3): M3 => {
  const R = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    R[i * 3 + j] = A[i * 3]! * B[j]! + A[i * 3 + 1]! * B[3 + j]! + A[i * 3 + 2]! * B[6 + j]!;
  }
  return R;
};
const apply = (M: M3, v: V3): V3 => [
  M[0]! * v[0]! + M[1]! * v[1]! + M[2]! * v[2]!, M[3]! * v[0]! + M[4]! * v[1]! + M[5]! * v[2]!, M[6]! * v[0]! + M[7]! * v[1]! + M[8]! * v[2]!];
const unit = (v: V3): V3 => { const l = Math.hypot(v[0]!, v[1]!, v[2]!); return [v[0]! / l, v[1]! / l, v[2]! / l]; };
const axisRot = (ax: V3, ang: number): M3 => {
  const [x, y, z] = unit(ax) as [number, number, number];
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c];
};
/** Close generators into their group (entries snapped so round-off cannot split an element). */
function closure(gens: readonly M3[]): M3[] {
  const snap = (M: M3): M3 => M.map((v) => (Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v) + 0);
  const key = (M: M3): string => M.map((v) => Math.round(v * 1e9)).join(',');
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const seen = new Map<string, M3>([[key(I), I]]);
  const queue: M3[] = [I];
  while (queue.length > 0) {
    const A = queue.shift()!;
    for (const g of gens) {
      const B = snap(mul(g, A));
      const k = key(B);
      if (!seen.has(k)) { seen.set(k, B); queue.push(B); }
    }
  }
  return [...seen.values()];
}

const PHI = (1 + Math.sqrt(5)) / 2;
type Solid = 'tetrahedron' | 'octahedron' | 'cube' | 'icosahedron' | 'dodecahedron';
/** The rotation group generating each solid's points (the cube and octahedron share O; icosa and dodeca share I). */
const GROUP_GENS: Record<'T' | 'O' | 'I', M3[]> = {
  T: [axisRot([1, 1, 1], (2 * Math.PI) / 3), axisRot([1, 0, 0], Math.PI)],
  O: [axisRot([0, 0, 1], Math.PI / 2), axisRot([1, 1, 1], (2 * Math.PI) / 3)],
  I: [axisRot([0, 1, PHI], (2 * Math.PI) / 5), axisRot([1, 1, 1], (2 * Math.PI) / 3)],
};
/**
 * Each solid's group and the axis whose ORBIT is its vertices / edge midpoints / face centres. ⚠️ Duals share a group
 * and swap axes: the octahedron's vertices are the cube's face centres, the dodecahedron's vertices the icosahedron's.
 */
const SOLID: Record<Solid, { group: 'T' | 'O' | 'I'; axis: Record<Sym3dOn, V3> }> = {
  tetrahedron: { group: 'T', axis: { vertices: [1, 1, 1], edges: [1, 0, 0], faces: [-1, -1, -1] } },
  cube: { group: 'O', axis: { vertices: [1, 1, 1], edges: [1, 1, 0], faces: [0, 0, 1] } },
  octahedron: { group: 'O', axis: { vertices: [0, 0, 1], edges: [1, 1, 0], faces: [1, 1, 1] } },
  icosahedron: { group: 'I', axis: { vertices: [0, 1, PHI], edges: [1, 0, 0], faces: [1, 1, 1] } },
  dodecahedron: { group: 'I', axis: { vertices: [1, 1, 1], edges: [1, 0, 0], faces: [0, 1, PHI] } },
};
/** The number of points per solid and choice — what the readout and the checker hold the orbits to. */
export const SYM3D_SOLID_POINTS: Record<Solid, Record<Sym3dOn, number>> = {
  tetrahedron: { vertices: 4, edges: 6, faces: 4 }, cube: { vertices: 8, edges: 12, faces: 6 },
  octahedron: { vertices: 6, edges: 12, faces: 8 }, icosahedron: { vertices: 12, edges: 30, faces: 20 },
  dodecahedron: { vertices: 20, edges: 30, faces: 12 },
};

const groupMemo = new Map<string, M3[]>();
function groupOf(g: 'T' | 'O' | 'I'): M3[] {
  let G = groupMemo.get(g);
  if (G === undefined) { G = closure(GROUP_GENS[g]); groupMemo.set(g, G); }
  return G;
}

/** The unit position vectors of a layout, in a deterministic order. */
export function sym3dPositions(cfg: Pick<Sym3dConfig, 'layout' | 'positions' | 'on'>): V3[] {
  if (cfg.layout === 'off') return [];
  if (cfg.layout === 'ring' || cfg.layout === 'sphere') {
    const [lo, hi] = SYM3D_POSITIONS_RANGE[cfg.layout];
    const n = Math.max(lo, Math.min(hi, Math.round(Number.isFinite(cfg.positions) ? cfg.positions : lo)));
    const out: V3[] = [];
    if (cfg.layout === 'ring') {
      for (let j = 0; j < n; j++) out.push([Math.cos((2 * Math.PI * j) / n), Math.sin((2 * Math.PI * j) / n), 0]);
    } else {
      // A Fibonacci spiral: n points spread evenly — most n have no perfect symmetric arrangement on a sphere.
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let j = 0; j < n; j++) {
        const z = 1 - (2 * (j + 0.5)) / n, r = Math.sqrt(Math.max(0, 1 - z * z));
        out.push([r * Math.cos(j * ga), r * Math.sin(j * ga), z]);
      }
    }
    return out;
  }
  const s = SOLID[cfg.layout];
  const ax = unit(s.axis[cfg.on]);
  const seen = new Map<string, V3>();
  for (const M of groupOf(s.group)) {
    const p = apply(M, ax);
    const k = p.map((v) => Math.round(v * 1e9)).join(',');
    if (!seen.has(k)) seen.set(k, p);
  }
  return [...seen.values()];
}

/** The minimal rotation taking +z to `d` (a half-turn about x when `d` is −z). */
function zTo(d: V3): M3 {
  const c = d[2]!;
  if (c < -1 + 1e-12) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const ax = -d[1]!, ay = d[0]!;   // z × d
  const k = 1 / (1 + c);
  return [c + ax * ax * k, ax * ay * k, ay,
    ax * ay * k, c + ay * ay * k, -ax,
    -ay, ax, c];
}

/** The resolved operator: one 3×3 matrix and one unit translation per copy, flat. */
export interface Sym3dOperator {
  readonly mats: Float64Array;     // 9 per copy
  readonly dirs: Float64Array;     // 3 per copy — the position the copy is moved to (× radius · half-extent)
  readonly copies: number;
  readonly radius: number;
}

const opMemo = new Map<string, Sym3dOperator>();

/** Resolve a configuration into its operator, or null when it is OFF. Memoised — built once per configuration. */
export function resolveSym3d(cfg: Sym3dConfig): Sym3dOperator | null {
  if (cfg.layout === 'off') return null;
  const local = Math.max(SYM3D_LOCAL_RANGE[0], Math.min(SYM3D_LOCAL_RANGE[1], Math.round(Number.isFinite(cfg.local) ? cfg.local : 1)));
  const radius = Math.max(SYM3D_RADIUS_RANGE[0], Math.min(SYM3D_RADIUS_RANGE[1], Number.isFinite(cfg.radius) ? cfg.radius : 0));
  const pos = sym3dPositions(cfg);
  const key = `${cfg.layout}|${pos.length}|${cfg.on}|${local}|${radius}|${cfg.mirrors}|${cfg.facing}`;
  const hit = opMemo.get(key);
  if (hit !== undefined) return hit;
  const copies = pos.length * local;
  const mats = new Float64Array(copies * 9);
  const dirs = new Float64Array(copies * 3);
  const MIRROR: M3 = [1, 0, 0, 0, -1, 0, 0, 0, 1];
  let c = 0;
  for (const p of pos) {
    const face = cfg.facing === 'outward' ? zTo(p) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let k = 0; k < local; k++) {
      // The k-th copy at this position: turned 2πk/local about the copy's own z (its radial axis when facing out),
      // every second one mirrored — then carried to face the position.
      let L = axisRot([0, 0, 1], (2 * Math.PI * k) / local);
      if (cfg.mirrors && k % 2 === 1) L = mul(L, MIRROR);
      mats.set(mul(face, L), c * 9);
      dirs.set(p, c * 3);
      c++;
    }
  }
  const op: Sym3dOperator = { mats, dirs, copies, radius };
  opMemo.set(key, op);
  return op;
}

/** The number of copies a configuration makes (1 when off) — the readout's figure. */
export function sym3dCopies(cfg: Sym3dConfig): number {
  return resolveSym3d(cfg)?.copies ?? 1;
}
