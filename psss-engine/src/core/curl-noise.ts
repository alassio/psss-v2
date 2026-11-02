// Divergence-free curl noise (Bridson et al. 2007).
// Uses 4D simplex noise evaluated at (x, y, z, t) to build a potential field
// whose curl gives a zero-divergence 3D velocity field.

// Simplex 4D gradient table — 32 gradients on the unit hypersphere edges
const GRAD4 = [
  [0, 1, 1, 1], [0, 1, 1, -1], [0, 1, -1, 1], [0, 1, -1, -1],
  [0, -1, 1, 1], [0, -1, 1, -1], [0, -1, -1, 1], [0, -1, -1, -1],
  [1, 0, 1, 1], [1, 0, 1, -1], [1, 0, -1, 1], [1, 0, -1, -1],
  [-1, 0, 1, 1], [-1, 0, 1, -1], [-1, 0, -1, 1], [-1, 0, -1, -1],
  [1, 1, 0, 1], [1, 1, 0, -1], [1, -1, 0, 1], [1, -1, 0, -1],
  [-1, 1, 0, 1], [-1, 1, 0, -1], [-1, -1, 0, 1], [-1, -1, 0, -1],
  [1, 1, 1, 0], [1, 1, -1, 0], [1, -1, 1, 0], [1, -1, -1, 0],
  [-1, 1, 1, 0], [-1, 1, -1, 0], [-1, -1, 1, 0], [-1, -1, -1, 0],
];

// Permutation table (512 entries, deterministic)
const PERM = new Uint8Array(512);
const P = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
  69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,
  203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,
  165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,
  92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,
  89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,
  226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,
  182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,
  43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
  228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,
  49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,
  236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
for (let i = 0; i < 256; i++) PERM[i] = PERM[i + 256] = P[i]!;

function dot4(g: number[], x: number, y: number, z: number, w: number): number {
  return g[0]! * x + g[1]! * y + g[2]! * z + g[3]! * w;
}

// 4D simplex noise — returns value in approximately [-1, 1]
export function simplex4D(x: number, y: number, z: number, w: number): number {
  const F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
  const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;
  const s = (x + y + z + w) * F4;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const l = Math.floor(w + s);
  const t = (i + j + k + l) * G4;
  const x0 = x - (i - t); const y0 = y - (j - t);
  const z0 = z - (k - t); const w0 = w - (l - t);

  // Rank ordering
  let rankx = 0, ranky = 0, rankz = 0, rankw = 0;
  if (x0 > y0) rankx++; else ranky++;
  if (x0 > z0) rankx++; else rankz++;
  if (x0 > w0) rankx++; else rankw++;
  if (y0 > z0) ranky++; else rankz++;
  if (y0 > w0) ranky++; else rankw++;
  if (z0 > w0) rankz++; else rankw++;

  const i1 = rankx >= 3 ? 1 : 0; const j1 = ranky >= 3 ? 1 : 0;
  const k1 = rankz >= 3 ? 1 : 0; const l1 = rankw >= 3 ? 1 : 0;
  const i2 = rankx >= 2 ? 1 : 0; const j2 = ranky >= 2 ? 1 : 0;
  const k2 = rankz >= 2 ? 1 : 0; const l2 = rankw >= 2 ? 1 : 0;
  const i3 = rankx >= 1 ? 1 : 0; const j3 = ranky >= 1 ? 1 : 0;
  const k3 = rankz >= 1 ? 1 : 0; const l3 = rankw >= 1 ? 1 : 0;

  const x1 = x0 - i1 + G4; const y1 = y0 - j1 + G4;
  const z1 = z0 - k1 + G4; const w1 = w0 - l1 + G4;
  const x2 = x0 - i2 + 2*G4; const y2 = y0 - j2 + 2*G4;
  const z2 = z0 - k2 + 2*G4; const w2 = w0 - l2 + 2*G4;
  const x3 = x0 - i3 + 3*G4; const y3 = y0 - j3 + 3*G4;
  const z3 = z0 - k3 + 3*G4; const w3 = w0 - l3 + 3*G4;
  const x4 = x0 - 1 + 4*G4; const y4 = y0 - 1 + 4*G4;
  const z4 = z0 - 1 + 4*G4; const w4 = w0 - 1 + 4*G4;

  const ii = i & 255; const jj = j & 255; const kk = k & 255; const ll = l & 255;
  const gi0 = PERM[ii + PERM[jj + PERM[kk + PERM[ll]!]!]!]! % 32;
  const gi1 = PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1 + PERM[ll + l1]!]!]!]! % 32;
  const gi2 = PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2 + PERM[ll + l2]!]!]!]! % 32;
  const gi3 = PERM[ii + i3 + PERM[jj + j3 + PERM[kk + k3 + PERM[ll + l3]!]!]!]! % 32;
  const gi4 = PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1 + PERM[ll + 1]!]!]!]! % 32;

  let n = 0;
  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0 - w0*w0;
  if (t0 > 0) { t0 *= t0; n += t0*t0 * dot4(GRAD4[gi0]!, x0, y0, z0, w0); }
  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1 - w1*w1;
  if (t1 > 0) { t1 *= t1; n += t1*t1 * dot4(GRAD4[gi1]!, x1, y1, z1, w1); }
  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2 - w2*w2;
  if (t2 > 0) { t2 *= t2; n += t2*t2 * dot4(GRAD4[gi2]!, x2, y2, z2, w2); }
  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3 - w3*w3;
  if (t3 > 0) { t3 *= t3; n += t3*t3 * dot4(GRAD4[gi3]!, x3, y3, z3, w3); }
  let t4 = 0.6 - x4*x4 - y4*y4 - z4*z4 - w4*w4;
  if (t4 > 0) { t4 *= t4; n += t4*t4 * dot4(GRAD4[gi4]!, x4, y4, z4, w4); }
  return 27.0 * n;
}

// Curl noise via central differences on a 3D potential field Ψ(x,y,z,t).
// Returns a divergence-free 3D displacement vector.
export function curlNoise3D(
  px: number, py: number, pz: number,
  t: number,
  scale: number,
): [number, number, number] {
  const e = 0.0001;
  const sx = px * scale; const sy = py * scale; const sz = pz * scale;

  // Three independent potential components (offset by constants to decorrelate)
  // ∂Ψ3/∂y − ∂Ψ2/∂z
  const dP3dy = (simplex4D(sx, sy + e, sz,     t + 3.7) - simplex4D(sx, sy - e, sz,     t + 3.7)) / (2 * e);
  const dP2dz = (simplex4D(sx, sy,     sz + e, t + 1.3) - simplex4D(sx, sy,     sz - e, t + 1.3)) / (2 * e);
  // ∂Ψ1/∂z − ∂Ψ3/∂x
  const dP1dz = (simplex4D(sx, sy,     sz + e, t      ) - simplex4D(sx, sy,     sz - e, t      )) / (2 * e);
  const dP3dx = (simplex4D(sx + e, sy, sz,     t + 3.7) - simplex4D(sx - e, sy, sz,     t + 3.7)) / (2 * e);
  // ∂Ψ2/∂x − ∂Ψ1/∂y
  const dP2dx = (simplex4D(sx + e, sy, sz,     t + 1.3) - simplex4D(sx - e, sy, sz,     t + 1.3)) / (2 * e);
  const dP1dy = (simplex4D(sx, sy + e, sz,     t      ) - simplex4D(sx, sy - e, sz,     t      )) / (2 * e);

  return [
    dP3dy - dP2dz,
    dP1dz - dP3dx,
    dP2dx - dP1dy,
  ];
}
