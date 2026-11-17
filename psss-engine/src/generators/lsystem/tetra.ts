/**
 * @file v8 Phase 41 (`41.S3`) — **the Sierpinski-tetrahedron curve, built EXACTLY** — the 3-D counterpart of the
 * Sierpinski arrowhead (owner question 2026-11-13; look accepted in the viewer, `41.D3`).
 *
 * A regular tetrahedron `[p0, p1, p2, p3]` is traversed from `p0` to `p3` through its four CORNER copies at half
 * size, which touch pairwise at edge midpoints: `p0 → m01 → m12 → m23 → p3`. Each copy is again a tetrahedron
 * entered at one vertex and left at another, so the construction recurses with the tetrahedron's own symmetries.
 * The middle octahedron stays EMPTY — four copies at ½ give dimension 2, a lacy shell, not a volume-filler.
 *
 * ⚠️⚠️ **`build` IS COPIED VERBATIM FROM `p70-sierpinski-tetra.mjs`** — the probe that measured
 * all 16 variants continuous and self-avoiding, and `v1001` turning by only 60° and 90° (`41.D6`). Do not "improve"
 * it: `figurecheck` §P5 holds its point count, self-avoidance and turn set.
 *
 * ⚠️ **Not a turtle rule, and that is measured**: the torsion between consecutive turn planes takes 4–6 values, which
 * one shared turtle angle cannot express (`p70`). Hence its own builder, no angle rows and no `Customize` (`41.D9`).
 *
 * ⚠️⚠️ **IMPORTS NOTHING (`36.D2`)** — reachable from `score-canvas.ts`, which a checker loads under bare Node.
 */

/** v8 `41.D6` — the one shipped variant: the copies' free-vertex order bits. */
export const TETRA_VARIANT: readonly number[] = [1, 0, 0, 1];

/** Regular tetrahedron on alternate cube corners — exact in binary at every depth (midpoints halve). */
const T0: readonly (readonly number[])[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];

const mid = (a: readonly number[], b: readonly number[]): number[] =>
  [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, (a[2]! + b[2]!) / 2];

/**
 * The curve at `depth` (0 = the single segment `p0 → p3`): `4^depth + 1` points, RAW (the same contract as
 * `walkTurtle` — `buildPose` normalises), as a tight xyz buffer.
 */
export function buildTetra(depth: number, v: readonly number[] = TETRA_VARIANT): { xyz: Float64Array; count: number } {
  const d0 = Math.max(0, Math.floor(depth));
  const pts: number[][] = [];
  // ---- VERBATIM from p70-sierpinski-tetra.mjs `build` (types added) ----
  const rec = (t: readonly (readonly number[])[], d: number): void => {
    if (d === 0) { if (pts.length === 0) pts.push([...t[0]!]); pts.push([...t[3]!]); return; }
    const [p0, p1, p2, p3] = t as [readonly number[], readonly number[], readonly number[], readonly number[]];
    const m01 = mid(p0, p1), m02 = mid(p0, p2), m03 = mid(p0, p3), m12 = mid(p1, p2), m13 = mid(p1, p3), m23 = mid(p2, p3);
    // [entry, free a, free b, exit] for each corner copy.
    const copies: (readonly number[])[][] = [
      [p0, m02, m03, m01],   // corner p0: vertices p0, m01, m02, m03
      [m01, p1, m13, m12],   // corner p1: vertices p1, m01, m12, m13
      [m12, p2, m02, m23],   // corner p2: vertices p2, m02, m12, m23
      [m23, m03, m13, p3],   // corner p3: vertices p3, m03, m13, m23
    ];
    copies.forEach((c, k) => rec(v[k] ? [c[0]!, c[2]!, c[1]!, c[3]!] : c, d - 1));
  };
  rec(T0, d0);
  // ---- end verbatim ----
  const xyz = new Float64Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    xyz[i * 3] = pts[i]![0]!; xyz[i * 3 + 1] = pts[i]![1]!; xyz[i * 3 + 2] = pts[i]![2]!;
  }
  return { xyz, count: pts.length };
}
