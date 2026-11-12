/**
 * Compact 3D simplex noise + curl2D for divergence-free turbulence.
 *
 * v8 performance pass (C1, 2026-11-12) — the owner's DevTools trace of `Curtains Falling` put `simplex3D` at 59 % of
 * all main-thread CPU, 11.2 ms a frame: the buoyancy turbulence (`fire-processor.ts`) takes `curl2D` at three
 * octaves per hot particle, four noise evaluations each — 23 fire/smoke presets, cost in proportion to the count.
 *
 * ⚠️ **`simplex3D` reads FLAT gradient and permutation tables** (`GX`/`GY`/`GZ`, `PERM`, `PERM_MOD12` as typed
 * arrays) with the same arithmetic in the same order as the nested-array form it replaced, so it returns the SAME
 * double — verified over 200 000 random points. `curl2D`'s finite difference is unchanged (see its note on ε).
 */

// 12 gradient vectors (edges of a cube), flat per component.
const GRAD3_FLAT = [1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1];
const GX = new Float64Array(12), GY = new Float64Array(12), GZ = new Float64Array(12);
for (let g = 0; g < 12; g++) { GX[g] = GRAD3_FLAT[g * 3]!; GY[g] = GRAD3_FLAT[g * 3 + 1]!; GZ[g] = GRAD3_FLAT[g * 3 + 2]!; }

// Deterministic permutation table (256 entries, doubled to avoid wrapping)
const PERM = new Int32Array(512);
const PERM_MOD12 = new Int32Array(512);
{
  const p: number[] = [];
  for (let i = 0; i < 256; i++) {
    p[i] = ((i * 1103515245 + 12345) >>> 16) & 255;
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255]!;
    PERM_MOD12[i] = PERM[i]! % 12;
  }
}

const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

/**
 * 3D simplex noise. Returns value in [-1, 1].
 */
export function simplex3D(x: number, y: number, z: number): number {
  // Skew input space to determine which simplex cell we're in
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  const t = (i + j + k) * G3;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);

  // Determine which simplex we are in
  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
    else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
  } else {
    if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
    else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
  if (t0 > 0) { t0 *= t0; const g = PERM_MOD12[ii + PERM[jj + PERM[kk]!]!]!; n0 = t0 * t0 * (GX[g]! * x0 + GY[g]! * y0 + GZ[g]! * z0); }

  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
  if (t1 > 0) { t1 *= t1; const g = PERM_MOD12[ii + i1 + PERM[jj + j1 + PERM[kk + k1]!]!]!; n1 = t1 * t1 * (GX[g]! * x1 + GY[g]! * y1 + GZ[g]! * z1); }

  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
  if (t2 > 0) { t2 *= t2; const g = PERM_MOD12[ii + i2 + PERM[jj + j2 + PERM[kk + k2]!]!]!; n2 = t2 * t2 * (GX[g]! * x2 + GY[g]! * y2 + GZ[g]! * z2); }

  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
  if (t3 > 0) { t3 *= t3; const g = PERM_MOD12[ii + 1 + PERM[jj + 1 + PERM[kk + 1]!]!]!; n3 = t3 * t3 * (GX[g]! * x3 + GY[g]! * y3 + GZ[g]! * z3); }

  // Scale to [-1, 1]
  return 32.0 * (n0 + n1 + n2 + n3);
}

/**
 * Divergence-free 2D curl displacement via central differences of simplex3D.
 * Returns [dx, dy] perpendicular to the noise gradient.
 *
 * ⚠️ **ε = 0.5 is HALF A NOISE CELL — a deliberately SMOOTHED difference, not an approximation of the gradient.** It
 * is part of the flames' look: an analytic gradient is a different, SHARPER field — tried 2026-11-12 (~3× faster) and
 * REJECTED by the owner on the look (rougher smoke and flame edges). Do not re-propose it as an optimisation.
 */
export function curl2D(x: number, y: number, t: number): [number, number] {
  const EPS = 0.5;
  const dx = (simplex3D(x + EPS, y, t) - simplex3D(x - EPS, y, t)) / (2 * EPS);
  const dy = (simplex3D(x, y + EPS, t) - simplex3D(x, y - EPS, t)) / (2 * EPS);
  return [dy, -dx];
}

/** `curl2D` into `out[0..1]` — the same expressions, no array per call (the turbulence makes three per particle). */
export function curl2DInto(x: number, y: number, t: number, out: Float64Array): void {
  const EPS = 0.5;
  const dx = (simplex3D(x + EPS, y, t) - simplex3D(x - EPS, y, t)) / (2 * EPS);
  const dy = (simplex3D(x, y + EPS, t) - simplex3D(x, y - EPS, t)) / (2 * EPS);
  out[0] = dy;
  out[1] = -dx;
}
