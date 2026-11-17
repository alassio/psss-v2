/**
 * @file v8 Phase 41 (`41.S9`) — **the Hill tetrahedron curve**: a continuous space-filling traversal of the Hill (Kuhn)
 * tetrahedron — one sixth of a cube — through its rep-8 dissection, drawn through the CENTRES of its pieces.
 *
 * ⚠️⚠️ **FOUND BY SEARCH, NOT RECALLED (`p81-hill-search.mjs`, 2026-11-14).** Phase 39 proved no
 * SINGLE-rule traversal of this dissection is continuous (`p60-hill*`); the literature points to multi-rule curves
 * (Bader, *Space-Filling Curves*, ch. 12, a "node-connected" tetrahedral curve) whose tables were not readable
 * (`RESEARCH-hill-tetrahedron.md`). The search here lets every child carry its own STATE — an (entry, exit)
 * vertex pair of the canonical root — and found that all 12 states decompose, a closed set of SEVEN suffices, and the
 * chain is continuous at every depth. Among the decompositions, each state takes the one with the most FACE contacts
 * between consecutive children (75 % face, the rest edge or vertex — a face-continuous curve is impossible on this
 * dissection, Haverkort/Bader). ⚠️ So this is an EXACT curve, not an approximation (`36`/`39.Q4`'s rule).
 *
 * ⚠️ **Drawn through piece CENTRES**: the chain's shared VERTICES are revisited by neighbouring pieces (81 % of them at
 * depth 5), so a vertex polyline would retrace mesh edges; the centres are all distinct — the way Hilbert 3D is drawn.
 * Centre steps take three lengths (ratio 5 : 1 — a vertex contact is the long one).
 *
 * ⚠️⚠️ **IMPORTS NOTHING (`36.D2`)** — reachable from `score-canvas.ts`, which a checker loads under bare Node.
 */

type Vec = [number, number, number];
type Tet = [Vec, Vec, Vec, Vec];

/** The Hill (Kuhn) tetrahedron: one sixth of the unit cube. */
const V: Tet = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]];

const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/*
 * Maubach bisection, verbatim from `p60-hill-rep8.mjs`: three generations give 8 children, each SIMILAR to the root at
 * half size (`figurecheck` §P9 measures it).
 */
function maubachChildren(t: Tet, k: number): [Tet, Tet, number] {
  const z = mid(t[0], t[k]!);
  const a = [...t.slice(0, k), z, ...t.slice(k + 1)] as Tet;
  const b = [...t.slice(1, k + 1), z, ...t.slice(k + 1)] as Tet;
  return [a, b, k - 1 === 0 ? 3 : k - 1];
}
const KIDS: Tet[] = (() => {
  let gen: [Tet, number][] = [[V, 3]];
  for (let g = 0; g < 3; g++) {
    gen = gen.flatMap(([t, k]) => { const [a, b, nk] = maubachChildren(t, k); return [[a, nk], [b, nk]] as [Tet, number][]; });
  }
  return gen.map(([t]) => t);
})();

/**
 * The FOUND rule (`p81-hill-rule.json`): per state `en ex` (the canonical root's entry and exit vertex), the 8 children
 * in traversal order, each as [child index, its similarity (root vertex i → child vertex p[i]), the child's state].
 */
const RULE: Record<string, readonly [number, string, string][]> = {
  '10': [[1, '0123', '02'], [2, '0123', '20'], [4, '0123', '01'], [5, '0123', '10'], [6, '0123', '02'], [7, '0123', '23'], [3, '3210', '01'], [0, '0123', '20']],
  '20': [[3, '0123', '01'], [2, '0123', '10'], [1, '0123', '03'], [4, '3210', '01'], [5, '0123', '20'], [6, '0123', '01'], [7, '3210', '20'], [0, '0123', '30']],
  '23': [[3, '0123', '01'], [2, '0123', '10'], [1, '0123', '01'], [0, '3210', '20'], [4, '3210', '01'], [5, '0123', '20'], [6, '0123', '01'], [7, '0123', '10']],
  '30': [[7, '0123', '01'], [6, '0123', '10'], [3, '0123', '01'], [5, '3210', '20'], [4, '0123', '30'], [2, '0123', '02'], [1, '0123', '23'], [0, '0123', '30']],
  '02': [[0, '0123', '01'], [1, '0123', '10'], [2, '0123', '01'], [3, '0123', '10'], [5, '0123', '02'], [4, '0123', '23'], [7, '3210', '02'], [6, '0123', '10']],
  '01': [[0, '0123', '01'], [1, '0123', '10'], [2, '0123', '02'], [3, '0123', '23'], [7, '3210', '01'], [6, '0123', '23'], [5, '3210', '02'], [4, '0123', '10']],
  '03': [[0, '0123', '01'], [1, '0123', '10'], [2, '0123', '01'], [3, '0123', '10'], [5, '0123', '01'], [4, '3210', '20'], [6, '3210', '01'], [7, '0123', '20']],
};
/** The traversal's root state: enter at vertex 0, leave at vertex 2. */
export const HILL_SEED_STATE = '02';
export const HILL_STATES: readonly string[] = Object.keys(RULE);

/** The affine map taking the root `V` onto tetrahedron `t` (barycentric coordinates carry over). */
function mapper(t: Tet): (x: Vec) => Vec {
  // V is the Kuhn simplex, so a point's barycentric coordinates are differences of its coordinates.
  return (x: Vec): Vec => {
    const b0 = 1 - x[0], b1 = x[0] - x[1], b2 = x[1] - x[2], b3 = x[2];
    return [
      b0 * t[0][0] + b1 * t[1][0] + b2 * t[2][0] + b3 * t[3][0],
      b0 * t[0][1] + b1 * t[1][1] + b2 * t[2][1] + b3 * t[3][1],
      b0 * t[0][2] + b1 * t[1][2] + b2 * t[2][2] + b3 * t[3][2],
    ];
  };
}

/** The leaves at `depth` in traversal order, each with its state (exported for `figurecheck` §P9). */
export function hillLeaves(depth: number): { tet: Tet; state: string }[] {
  let L: { tet: Tet; state: string }[] = [{ tet: V, state: HILL_SEED_STATE }];
  for (let d = 0; d < Math.max(0, Math.floor(depth)); d++) {
    const next: { tet: Tet; state: string }[] = [];
    for (const { tet, state } of L) {
      const m = mapper(tet);
      for (const [c, p, cs] of RULE[state]!) {
        const kid = KIDS[c]!;
        const child = [m(kid[+p[0]!]!), m(kid[+p[1]!]!), m(kid[+p[2]!]!), m(kid[+p[3]!]!)] as Tet;
        next.push({ tet: child, state: cs });
      }
    }
    L = next;
  }
  return L;
}

/** The curve at `depth`: the `8^depth` piece centres in traversal order, RAW (`buildPose` normalises). */
export function buildHill(depth: number): { xyz: Float64Array; count: number } {
  const L = hillLeaves(depth);
  const xyz = new Float64Array(L.length * 3);
  for (let i = 0; i < L.length; i++) {
    const t = L[i]!.tet;
    for (let q = 0; q < 3; q++) xyz[i * 3 + q] = (t[0][q]! + t[1][q]! + t[2][q]! + t[3][q]!) / 4;
  }
  return { xyz, count: L.length };
}
