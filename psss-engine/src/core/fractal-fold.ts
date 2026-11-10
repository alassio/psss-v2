/**
 * @file v8 Phase 38 — **the Fractal Fold: the box fold and the ball fold composed, with a FEEDBACK term.**
 *
 * ⚠️⚠️ **IMPORTS NOTHING AND MUST KEEP DOING SO** — `checks/deformcheck.mjs` and the `MEASUREMENT-phase38-*`
 * instruments load it under bare Node, which strips types only: no `enum`, no class, no parameter property.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE LAW — per iteration, on X and Y only, in units of the figure's own XY RMS radius, `x₀` the position ENTERING it
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *     box fold   x and y:   |x| > L  ->  x = sign(x)·2L − x
 *     ball fold  r² = x²+y²: r² < (L/2)² -> (x,y) ·= 4 ;  r² < L² -> (x,y) ·= L²/r²
 *     scale      x = s·x
 *     feedback   x = x + x₀          <- the term that makes it self-similar rather than a repeated reflection
 *
 * The Mandelbox iteration with its two ball radii TIED to the cell size (`L/2` and `L`) on purpose: three of
 * its constants collapse into one slider (the plan's trap — exposing the radii is a different operator).
 * Without the feedback line this is the shipped box fold composed with a sphere inversion, and iterating it
 * reflects the figure N times; WITH it every iteration is re-anchored to where the particle started, which
 * also REGULARISES adjacency (the proof of concept: 0 adjacency breaks in every configuration).
 *
 * ⚠️⚠️ **THE UNIT IS THE FIGURE'S OWN SIZE, NOT THE DESIGN BOX — MEASURED, AND THE DESIGN-BOX FORM FAILED.** With the
 * cell as a fraction of the design half-extent (the box fold's convention), the compensated size over 40 library
 * presets ranged **0.10× … 85×** (default setting: p10 1.15×, p90 4.9×), because the fold's growth depends on how big
 * the figure is RELATIVE TO THE CELL and library figures fill their design boxes very differently; six calibration
 * bodies that happened to fill theirs had hidden it. So the input is divided by its own RMS radius `r₀` (measured
 * per frame from the UNFOLDED figure, O(n)), folded, divided by the table's growth and multiplied back by `r₀`.
 * ⚠️ **This is NOT the per-frame auto-fit `38.D3` forbids**: that fit measured the OUTPUT and would make the figure
 * breathe whenever a fold parameter animates; `r₀` is the INPUT's size, unchanged by any fold setting, so only the
 * figure's own motion moves it.
 *
 * ⚠️⚠️ **XY ONLY — Z IS NEVER FOLDED, SCALED, COMPENSATED OR LIMITED (owner, 2026-11-10; REVERSES `38.D2`).** The
 * depth gate, re-run THROUGH THE ENGINE (the private measurement `MEASUREMENT-phase38-fractalfold.mjs`; its first run folded SCREEN
 * coordinates and was withdrawn), found the three-axis fold swapping near and far with little image change on
 * more presets than the shipped X-45° pose rotation in 6 of 24 configurations, and a dedicated sweep over strong
 * scales (1.25–2, four cells, 1–3 iterations) in 31 of 96 — so no scale cut-off made it safe. With z untouched,
 * depth order is preserved by construction for every preset and every setting; the four demos looked as good or
 * better in an A/B. **This is the box fold's own conclusion (`30.D19`) reached a second time — do not re-add z.**
 *
 * ⚠️ **The fold GROWS the figure 2–4×** (not geometrically: the feedback re-anchors every iteration), so the
 * result is divided by a MEASURED growth table (`38.D3` + correction 3) interpolated over (iterations, cell,
 * scale) — never fitted per frame, which would make an animated figure breathe in size. The table is the
 * MEDIAN over six bodies; the residual body spread is printed by `MEASUREMENT-phase38-calibration.mjs` and
 * stated in the manual. The residual body spread is up to 2.55× at the extreme corner (iteration 1, cell 1,
 * scale 2.5) — a stated limit: at such settings one figure may sit larger or smaller than another.
 */

/**
 * The figure's XY RMS radius about the origin — the operator's length unit (z plays no part: the fold is XY-only). Guarded below so a collapsed figure
 * (every particle at the centre) folds as the identity rather than dividing by zero.
 */
export function fractalFoldUnit(positions: ArrayLike<number>, count: number): number {
  let s = 0;
  for (let i = 0; i < count; i++) { const x = positions[i * 3]!, y = positions[i * 3 + 1]!; s += x * x + y * y; }
  return count > 0 ? Math.sqrt(s / count) : 0;
}

/** The iteration ceiling. ⚠️ 3, not the box fold's 4: `38.0` licensed 1–3 and nothing beyond was measured. */
export const FRACTAL_FOLD_MAX_ITERATIONS = 3;

/** The cell half-width, as a fraction of the figure's own RMS radius. Steps are negative powers of two (the
 * base-10 `Decimal` stepping rule — a 1/100 step can make an endpoint unreachable in Chromium). */
export const FRACTAL_FOLD_MIN_LIMIT = 0.125;
export const FRACTAL_FOLD_MAX_LIMIT = 1;
export const FRACTAL_FOLD_LIMIT_STEP = 1 / 128;
/** The default cell: 40/128, on the grid. */
export const FRACTAL_FOLD_DEFAULT_LIMIT = 0.3125;

/**
 * The scale, SIGNED (`38.D7`: the best picture of the proof of concept is at −1.7). ⚠️ Not the box fold's
 * `0.5 … 1.5`: that cap exists because a box-fold scale compounds geometrically, and the feedback term
 * re-anchors every iteration, so growth here is 2–4× where the geometric reading predicts 16× (`38.D6`).
 */
export const FRACTAL_FOLD_MAX_SCALE = 2.5;
export const FRACTAL_FOLD_SCALE_STEP = 1 / 64;
export const FRACTAL_FOLD_DEFAULT_SCALE = 2;
/** `38.D9` — the dead zone about 0, DERIVED from `DEAD_ZONE_FRACTION` (0.08 of half travel), as twist's is.
 * Written as the product, not imported, because this module imports nothing; `deformcheck` holds it equal. */
export const FRACTAL_FOLD_SCALE_SNAP = FRACTAL_FOLD_MAX_SCALE * 0.08;

/** `38.D4` — the breathing depths: half-width of each base's range, signed, with their own dead zones. */
export const FRACTAL_FOLD_LIMIT_DEPTH_MAX = (FRACTAL_FOLD_MAX_LIMIT - FRACTAL_FOLD_MIN_LIMIT) / 2;
export const FRACTAL_FOLD_SCALE_DEPTH_MAX = FRACTAL_FOLD_MAX_SCALE;
export const FRACTAL_FOLD_LIMIT_DEPTH_SNAP = FRACTAL_FOLD_LIMIT_DEPTH_MAX * 0.08;
export const FRACTAL_FOLD_SCALE_DEPTH_SNAP = FRACTAL_FOLD_SCALE_DEPTH_MAX * 0.08;

/**
 * The compensation's guard: growth is clamped to `[1/span, span]`. ⚠️ 25, not the Barr compensation's 5 —
 * measured 2026-11-09, the median growth over the shipped range spans **0.128 … 22.2**, so 5 would have let the
 * extreme corners (a large cell at |scale| ≥ 2) overflow the frame up to 4×. This is a POSITION scale, not a
 * brightness, so nothing argues for saturating inside the range; the span only guards a value the setters
 * could not produce.
 */
export const FRACTAL_FOLD_GROWTH_SPAN = 25;

/**
 * One point through the fold, in half-extent units. Writes the result into `out` (no allocation: this runs
 * once per particle per frame, and invariant 8 is about the allocation RATE).
 */
export function fractalFoldPoint(
  x0: number, y0: number, z0: number, iterations: number, L: number, s: number, out: number[],
): void {
  let x = x0, y = y0;
  const L2 = 2 * L, minR2 = 0.25 * L * L, fixR2 = L * L;
  for (let k = 0; k < iterations; k++) {
    if (x > L) x = L2 - x; else if (x < -L) x = -L2 - x;
    if (y > L) y = L2 - y; else if (y < -L) y = -L2 - y;
    const r2 = x * x + y * y;
    // The ball fold. ⚠️ `r2 < minR2` scales by the constant 4 — the pole at r = 0 never divides.
    const m = r2 < minR2 ? 4 : (r2 < fixR2 ? fixR2 / r2 : 1);
    const k2 = m * s;
    x = x * k2 + x0; y = y * k2 + y0;
  }
  // ⚠️ Z PASSES THROUGH UNTOUCHED (owner, 2026-11-10 — see the header): depth order is preserved by construction.
  out[0] = x; out[1] = y; out[2] = z0;
}

/**
 * The soft radial limiter's knee, in units of the figure's own RMS radius. ⚠️ **MEASURED NECESSITY, NOT TASTE:**
 * with the table alone the MEDIAN compensated size over 40 library presets is 1.00× at every tested setting, but the
 * TAILS reach 8–85× — a few particles flung far (the ball fold's ×4 near the centre, then scaled) dominate the RMS
 * and leave the frame. Beyond the knee a particle's radius is compressed LOGARITHMICALLY: `ρ -> K + ln(1 + ρ − K)`.
 * Continuous with slope 1 at the knee, monotone along every ray (so depth order along a ray is kept), and
 * PER-PARTICLE — no global fit, so `38.D3`'s rule stands.
 */
export const FRACTAL_FOLD_KNEE = 2.5;

/** Apply the limiter in place to one point given in r₀ units (no allocation). */
export function fractalFoldLimit(out: number[]): void {
  const x = out[0]!, y = out[1]!;
  const r = Math.sqrt(x * x + y * y);
  if (r <= FRACTAL_FOLD_KNEE) return;
  const k = (FRACTAL_FOLD_KNEE + Math.log(1 + r - FRACTAL_FOLD_KNEE)) / r;
  out[0] = x * k; out[1] = y * k;   // XY only — z is never touched
}

/** The compensation table's grid: cells along one axis, scales along the other, one plane per iteration. */
export const FRACTAL_FOLD_TABLE_LIMITS: readonly number[] = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
export const FRACTAL_FOLD_TABLE_SCALES: readonly number[] = [
  -2.5, -2.25, -2, -1.75, -1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];

/**
 * The measured growth, `[iteration-1][cell][scale]` — calibrated THROUGH THE ENGINE as a fixed point (the median
 * over 24 library bodies of the model-space XY size ratio, three passes) by the private measurement `MEASUREMENT-phase38-calibration.mjs`:
 * worst cell median residual 1.001×, body spread typically 0.94–1.06× and at worst 0.38–1.32× (2026-11-10, XY-only).
 * Regenerate it with that script; never hand-edit a value.
 */
export const FRACTAL_FOLD_GROWTH: readonly (readonly (readonly number[])[])[] = [
  [ // iterations 1
    [2.7696, 2.5916, 2.4136, 2.2358, 2.0581, 1.8807, 1.7034, 1.5266, 1.3502, 1.1746, 1, 0.8264, 0.6559, 0.4917, 0.343, 0.2394, 0.2492, 0.3629, 0.5132, 0.6773, 0.8474],
    [2.1761, 2.0517, 1.9281, 1.8053, 1.6837, 1.5635, 1.445, 1.3286, 1.215, 1.1051, 1, 0.9015, 0.8101, 0.7328, 0.6681, 0.6249, 0.6101, 0.6234, 0.6498, 0.6977, 0.7689],
    [1.8159, 1.7086, 1.6044, 1.504, 1.4081, 1.3178, 1.2343, 1.1589, 1.0919, 1.038, 1, 0.9755, 0.9667, 0.9765, 1.0019, 1.0427, 1.0945, 1.1627, 1.239, 1.323, 1.4217],
    [1.6703, 1.5168, 1.3913, 1.2752, 1.1711, 1.0825, 1.0136, 0.9684, 0.9505, 0.9614, 1, 1.0632, 1.147, 1.2481, 1.3616, 1.4849, 1.616, 1.7529, 1.8945, 2.0397, 2.1793],
    [1.5202, 1.3346, 1.1574, 0.9933, 0.8497, 0.7441, 0.7048, 0.7161, 0.7759, 0.8743, 1, 1.1421, 1.2998, 1.4679, 1.6433, 1.8247, 2.0126, 2.2063, 2.403, 2.5931, 2.7848],
    [1.6625, 1.4315, 1.2058, 0.9891, 0.7895, 0.6388, 0.5514, 0.5479, 0.6441, 0.809, 1, 1.2079, 1.4209, 1.646, 1.8762, 2.1098, 2.3458, 2.5781, 2.8094, 3.044, 3.2791],
    [2.0195, 1.7477, 1.4736, 1.2028, 0.9411, 0.6972, 0.5102, 0.4555, 0.5644, 0.7572, 1, 1.259, 1.5217, 1.7938, 2.0728, 2.3548, 2.6333, 2.9158, 3.2, 3.4801, 3.7569],
    [2.3279, 2.0128, 1.7055, 1.4024, 1.1076, 0.8311, 0.5891, 0.457, 0.5, 0.7232, 1, 1.2962, 1.601, 1.9138, 2.2282, 2.5417, 2.8562, 3.1712, 3.4867, 3.8026, 4.1303],
  ],
  [ // iterations 2
    [7.2265, 6.2011, 5.2647, 4.4177, 3.6601, 2.9921, 2.4138, 1.9253, 1.5268, 1.2185, 1, 0.8698, 0.8269, 0.8643, 1.0051, 1.1379, 1.0233, 1.1593, 1.4572, 1.884, 2.4126],
    [5.1726, 4.4782, 3.8429, 3.265, 2.7502, 2.2978, 1.9095, 1.5826, 1.3242, 1.131, 1, 0.925, 0.8994, 0.8682, 1.0444, 1.3493, 1.3629, 1.2636, 1.2143, 1.2421, 1.3525],
    [3.6782, 3.2354, 2.8262, 2.4391, 2.1104, 1.7917, 1.5122, 1.2945, 1.1459, 1.0486, 1, 0.9838, 1.0063, 1.0297, 1.1428, 1.3077, 1.4095, 1.4078, 1.4979, 1.6279, 1.8021],
    [3.0652, 2.7444, 2.418, 2.1371, 1.9158, 1.5899, 1.291, 1.0805, 0.9838, 0.9697, 1, 1.0598, 1.1217, 1.1664, 1.1527, 1.1754, 1.2689, 1.3146, 1.5118, 1.8625, 2.3289],
    [2.7539, 2.5029, 2.2611, 2.104, 1.9057, 1.5155, 1.0668, 0.8064, 0.7699, 0.8642, 1, 1.123, 1.2501, 1.3012, 1.2257, 1.1044, 1.1318, 1.2283, 1.4964, 2.0028, 2.6086],
    [3.0675, 2.8131, 2.5638, 2.3972, 2.3092, 1.7285, 1.1414, 0.7717, 0.6659, 0.8014, 1, 1.1783, 1.3375, 1.4368, 1.4046, 1.2732, 1.2818, 1.369, 1.7077, 2.2796, 3.0361],
    [3.49, 3.2182, 2.9204, 2.7958, 2.7448, 2.0993, 1.3903, 0.8338, 0.6558, 0.7639, 1, 1.2241, 1.4515, 1.5926, 1.6148, 1.6239, 1.5936, 1.6697, 2.0679, 2.6825, 3.5412],
    [3.8698, 3.5835, 3.2354, 3.082, 3.14, 2.4472, 1.618, 0.991, 0.6832, 0.7304, 1, 1.2747, 1.5495, 1.7534, 1.8455, 1.9453, 1.916, 1.9833, 2.4133, 3.0377, 3.9861],
  ],
  [ // iterations 3
    [18.3737, 14.3266, 10.9708, 8.2395, 6.0661, 4.3836, 3.1254, 2.2248, 1.6152, 1.2294, 1, 0.8589, 0.7411, 0.5872, 0.3382, 0.2025, 0.3154, 0.7435, 1.5895, 2.8312, 4.5333],
    [12.6652, 9.9254, 7.6538, 5.8051, 4.3382, 3.2077, 2.3657, 1.7699, 1.3759, 1.1375, 1, 0.919, 0.8577, 0.7859, 0.6363, 0.4663, 0.5382, 0.6913, 0.9188, 1.2631, 1.7248],
    [8.3479, 6.5292, 5.0569, 3.8893, 2.972, 2.2637, 1.7359, 1.3816, 1.1599, 1.051, 1, 0.9776, 0.9742, 0.9484, 0.9159, 0.7946, 0.8178, 0.96, 1.2506, 1.8176, 2.5679],
    [6.2226, 4.9189, 3.8641, 3.0331, 2.3466, 1.7825, 1.3414, 1.0924, 0.9708, 0.9658, 1, 1.0645, 1.1452, 1.2104, 1.2497, 1.2048, 1.1009, 1.221, 1.6104, 2.4348, 3.6776],
    [4.2956, 3.2812, 2.8621, 2.3803, 1.9152, 1.4464, 0.9616, 0.7922, 0.7591, 0.8621, 1, 1.1361, 1.2649, 1.4492, 1.5379, 1.5454, 1.3787, 1.4694, 1.8808, 2.7217, 4.2302],
    [4.0161, 3.3451, 2.9103, 2.5391, 2.108, 1.4612, 0.889, 0.7041, 0.6431, 0.7952, 1, 1.193, 1.3785, 1.5995, 1.7662, 1.8006, 1.5414, 1.6788, 2.1326, 3.1975, 5.0219],
    [4.4149, 3.708, 3.1615, 2.8037, 2.384, 1.6801, 0.9589, 0.7052, 0.5815, 0.7451, 1, 1.2361, 1.4599, 1.7258, 1.9117, 1.9928, 1.7383, 1.8703, 2.3733, 3.7039, 5.8584],
    [4.7096, 4.0572, 3.4807, 3.0738, 2.6617, 1.8317, 1.0394, 0.6923, 0.5386, 0.7068, 1, 1.283, 1.5391, 1.8249, 2.0641, 2.1673, 2.0279, 2.1184, 2.6412, 3.8933, 6.3612],
  ],
];

/** Bilinear interpolation of the growth at (cell, scale) on one iteration's plane, saturated to the span. */
export function fractalFoldGrowth(iterations: number, L: number, s: number): number {
  const plane = FRACTAL_FOLD_GROWTH[Math.max(1, Math.min(FRACTAL_FOLD_MAX_ITERATIONS, iterations)) - 1];
  if (!plane || plane.length === 0) return 1;
  const LS = FRACTAL_FOLD_TABLE_LIMITS, SS = FRACTAL_FOLD_TABLE_SCALES;
  const seg = (grid: readonly number[], v: number): [number, number] => {
    const c = Math.max(grid[0]!, Math.min(grid[grid.length - 1]!, v));
    let i = 0;
    while (i < grid.length - 2 && c > grid[i + 1]!) i++;
    return [i, (c - grid[i]!) / (grid[i + 1]! - grid[i]!)];
  };
  const [li, lt] = seg(LS, L), [si, st] = seg(SS, s);
  const g00 = plane[li]![si]!, g01 = plane[li]![si + 1]!, g10 = plane[li + 1]![si]!, g11 = plane[li + 1]![si + 1]!;
  const g = (g00 * (1 - st) + g01 * st) * (1 - lt) + (g10 * (1 - st) + g11 * st) * lt;
  return Math.max(1 / FRACTAL_FOLD_GROWTH_SPAN, Math.min(FRACTAL_FOLD_GROWTH_SPAN, g));
}
