/**
 * Perspective-projection constants shared by everything that projects model space to screen space.
 *
 * Currently that is `LissajousGenerator.project()` (wave particles) and `CrystalPool.project()`
 * (crystals) — two independent copies of the same rotate → divide-by-`q` pipeline, which is why the
 * sentinel below has to be one value rather than one per file.
 */

/**
 * Screen position written for a particle BEHIND the camera, i.e. when `z - perspectiveZ <= 0` and the
 * perspective divide has no finite result.
 *
 * ## ⚠️ The MAGNITUDE is load-bearing (triage I13)
 *
 * Nothing tests for this value. Every consumer instead relies on it being so far off-screen that the
 * consumer's own guard rejects it, so the constant is only correct while `|CULL_SENTINEL|` stays larger
 * than every one of those thresholds. Lowering it toward the screen edge would not produce a type error,
 * a GL error or an exception — it would produce a stray bright dot or a line stitched across the figure.
 * The four dependants, measured at 1024×768 (diagonal 1280):
 *
 * | consumer | its own guard | threshold in px | margin |
 * |---|---|---|---|
 * | point / splat / crystal passes | clip space — off-viewport fragments are discarded | ~1280 | 7.8× |
 * | `lissajous.ts` velocity loop | `outlierCap = diag * 0.1`, sets `velocities[i] = 0` above it | 128 | 78× |
 * | `NeonLineRenderer` | `computeTeleportSq()` ceiling of `(diag * 0.5)²`, drops the segment | 640 | 15× |
 * | `RibbonRenderer` | same teleport test, sets `alpha = 0` rather than dropping geometry | 640 | 15× |
 *
 * The tightest margin is the viewport itself, so the practical rule is that the sentinel must stay at
 * least a few multiples of the canvas diagonal away from the origin. 10 000 clears a 4K diagonal (4406)
 * by 2.3×; a hypothetical 8K canvas (8811) would leave only 1.13× and wants this raised.
 *
 * The velocity guard is why a culled particle does not register as a huge frame-to-frame step: it is
 * caught by `outlierCap`, NOT by the "distance² > 900" test that older documentation described. That
 * `900` was the flat legacy constant inside the two TRAJECTORY renderers, and both replaced it with
 * adaptive thresholds — there is no `900` anywhere in `lissajous.ts`.
 *
 * ## Why a sentinel at all, rather than a skip
 *
 * `positions` is a dense `Float32Array` uploaded whole and drawn with one instanced call per pass, so
 * there is no per-particle skip to take: a culled slot must still hold SOME finite number. Writing
 * `NaN` would poison the velocity EMA and the depth sort; writing 0 would paint the particle at the
 * canvas origin. Parking it far outside the viewport is what lets every consumer stay branch-free.
 *
 * `depths` is deliberately still computed for a culled slot (from the post-rotation `z`), so the
 * crystal pass's back-to-front sort keeps a total order.
 */
export const CULL_SENTINEL = -10000;
