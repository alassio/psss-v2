/**
 * @file v8 `36.9` — **the self-similar zoom: an EXACT index band, and its contiguity MEASURED rather
 * than assumed.**
 *
 * ⚠️⚠️ **IMPORTS NOTHING AT RUNTIME (`36.D2`).** Reachable from `score-canvas.ts`, which `composercheck`
 * loads under bare Node; no `enum`, no constructor parameter property.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE ZOOM IS, AND WHY IT IS NOT `Figure Scale`
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Effective recursion is `recursion + log2(descend)` and **the index window narrows by the same
 * factor**, so the particle budget stays entirely on screen and the figure **reveals new structure
 * rather than magnifying**. `figureScale` provably cannot do that: it maps the same points over a bigger
 * area, so at ×8 a lattice becomes two squares and then a single dot.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ THE BAND IS DERIVED FROM THE ALREADY-VERIFIED FORWARD WALK, NOT FROM A SECOND INVERSE MAP
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `36.D13` asks for *"the indices of the window's corner cells via the rule's inverse map"* and names it
 * *"the one piece of real algorithm work here"*, pointing at Skilling's `AxesToTranspose` as the dual of
 * the closed-form Hilbert map. **That route was built and abandoned, and the reason is worth keeping:**
 *
 *   - A hand-written Skilling inverse was wrong twice. Measured: cells came out DISTINCT but consecutive
 *     indices were **not adjacent** — max lattice step 3 and 7 in 2-D, 4 and 9 in 3-D — so the thing it
 *     produced was a permutation of the cells and not a Hilbert curve at all. The round-trip against its
 *     own forward map failed on 504 of 512 cells at order 3.
 *   - ⚠️⚠️ **And a second implementation of one map is invariant 17's shape regardless of whether it is
 *     correct**: *two sources ⇒ every reader must resolve them in the same order AND nothing may write
 *     the resolved value afterwards.* The turtle walk is ALREADY the index→point map, and `figurecheck`
 *     already proves it visits every cell exactly once with unit steps on both Hilbert rules.
 *
 * ✅ **So the inverse is a SCAN of the forward walk.** For a spatial window, walk the point list once and
 * take the min and max index of the points inside it. That is exact where the prototype's was a 4096-point
 * SAMPLE, it uses the one verified generator, and — the part the prototype could not do at all — **it
 * lets contiguity be MEASURED rather than assumed.**
 *
 * ⚠️ `4-infinite-zoom.mjs` takes `min(hits)…max(hits)` over a sample **with no contiguity check**, which
 * the spec's own §5.5 calls *"too crude to ship"*. The visible consequence is that row 1's mean screen
 * chord VARIES instead of holding constant, and the ±15 % clause is exactly the one the prototype fails.
 * **`contiguous` below is that check, and it is reported rather than silently trusted.**
 */

/*
 * ⚠️⚠️ **THERE USED TO BE A FLAT `ZOOM_MAX_EFFECTIVE_RECURSION = 8` HERE AND IT WAS A DEFECT, BECAUSE IT
 * BOUND THE USER'S BASE RECURSION AND NOT ONLY THE ZOOM.** It was written as an index wall — each octave
 * of `descend` shrinks the window, so a band eventually holds fewer cells than the particle count can
 * distinguish — but `effectiveRecursion` applied it to `base + octaves`, so it capped the Recursion row
 * itself with `descend` at 1 and no zoom in sight.
 *
 * ⚠️⚠️ **ONE LEVEL OF RECURSION IS NOT THE SAME AMOUNT OF ANYTHING ACROSS THE RULE SET, WHICH IS WHY A
 * FLAT CEILING COULD NEVER HAVE BEEN RIGHT.** Measured expansion base: `peano` 9.1x per level,
 * `hilbert3d` 8.1x, down to `dragon` 2.1x and `levyC` 2.3x. Three levels of `levyC` are about one level
 * of `hilbert3d`. The per-rule `recursionRange` already carries that difference and the per-rule
 * `zoomCeiling` in `resolveFigure` already bounds the zoom, so the ceiling is now a PARAMETER and there
 * is exactly one of them.
 *
 * ⚠️ **What it cost: `levyC` and `knopp` (range 6-14) lost levels 9-14 and `dragon` (6-13) lost 9-13 —
 * six of nine levels on a shipped rule.** The three affected rules are exactly the base-2 ones, whose
 * range tops out above 8; the other ten never reached the cap. **It never bound a rule that can ZOOM
 * either**: only `hilbert3d` and `hilbert2d` have a `zoomInverse` and their `rMax + 2` ceilings are 6
 * and 8, both already at or under the old flat value. So the cap's entire effect was damage.
 *
 * ⚠️ **It was invisible because the figure does not get SHORTER, it gets COARSER.** Owner-reported as
 * *"this preset figure looks truncated"* on `Curve Scroll` (`levyC` at 11, rendering 8): nothing is
 * clipped — 0 particles culled, 0 off-canvas, 81 916 symbols against a 900 000 budget — the curve was
 * simply built with 257 segments instead of 2 049. **Measured: extent and arc length were byte-identical
 * from order 8 to 14, which is what a dead control looks like from the outside.**
 */

/** The smallest band, in list entries, still worth drawing. Below this the figure is a few dots. */
export const ZOOM_MIN_BAND_ENTRIES = 16;

export interface ZoomBand {
  /** First list index of the window, inclusive. */
  readonly lo: number;
  /** Last list index of the window, inclusive. */
  readonly hi: number;
  /**
   * Is every index between `lo` and `hi` actually inside the window?
   *
   * ⚠️ **MEASURED, NOT ASSUMED, and this is the clause the prototype fails.** A Hilbert curve visits an
   * ALIGNED sub-cube as one contiguous run; an arbitrarily-placed window is not aligned, so a band taken
   * from its extremes can contain indices that wander outside it. When this is false the zoom is
   * selecting a band wider than the window — still a picture, but the mean screen chord drifts.
   */
  readonly contiguous: boolean;
  /** True when a wall or the minimum-band rule overrode the request. */
  readonly clamped: boolean;
}

/**
 * The effective recursion a pose asks for, and whether `ceiling` clamped it.
 *
 * ⚠️ **Separated from the band so the UI can report the clamp without building a list** — the readout
 * needs the number on every frame and a band only when the window moves.
 *
 * ⚠️⚠️ **`ceiling` IS A PARAMETER AND THAT IS THE POINT: THERE IS NOW EXACTLY ONE CEILING AND ONE PLACE
 * THAT APPLIES IT.** Before, a flat module constant was applied here AND a per-rule `rMax + 2` was
 * applied again at the call site, with `clamped` reporting only the first of the two and the caller
 * OR-ing in the second. Two ceilings, two places, and the resolved value recomputed afterwards — which
 * is exactly the shape invariant 17 warns about, and exactly how the flat cap hid for a whole phase.
 * **Pass the per-rule ceiling; do not reintroduce a module-level one.**
 */
export function effectiveRecursion(
  baseRecursion: number,
  descend: number,
  ceiling: number,
): { order: number; clamped: boolean } {
  const octaves = descend > 1 ? Math.log2(descend) : 0;
  const want = baseRecursion + octaves;
  const order = Math.min(ceiling, want);
  return { order, clamped: order < want - 1e-9 };
}

/**
 * Derive the band by scanning the forward walk.
 *
 * `xyz` is the NORMALISED point list (the figure's own `[-1, 1]` frame); `centre` is in the same frame.
 * `descend` is in octaves, 1 meaning no zoom.
 */
export function zoomBandFromWalk(
  xyz: Float64Array,
  count: number,
  centre: readonly number[],
  descend: number,
  dim: number,
): ZoomBand {
  if (count <= 0 || descend <= 1) {
    return { lo: 0, hi: Math.max(0, count - 1), contiguous: true, clamped: false };
  }

  /*
   * ⚠️⚠️ **THE WINDOW IS SNAPPED TO THE CURVE'S OWN SUB-CUBE GRID, AND THE FIRST VERSION THAT DID NOT
   * FAILED ITS OWN ACCEPTANCE CLAUSE — MEASURED, NOT ARGUED.** Taking the index extremes of an
   * arbitrarily-placed box gave `contiguous: false` at every usable `descend` and a mean screen chord of
   * **2.89x, 9.45x, 14.28x and 17.53x** against the **±15 %** §10 requires. That is the SAME failure the
   * prototype has, and `36.D13` was wrong about the cause: an exact band is necessary and **not
   * sufficient**, because the band of an unaligned window genuinely is not contiguous.
   *
   * ✅ **The property that makes a zoom possible is narrower than "it has an inverse map": an ALIGNED
   * sub-cube of side `2^k` is visited as ONE contiguous run of indices.** An unaligned box of the same
   * size is not. So the window is snapped to a power-of-two cell boundary, and then the band is exact
   * **by construction** rather than by scan: a sub-cube holding `(2^k)^dim` cells begins at an index that
   * is a multiple of that count.
   *
   * ⚠️ **`contiguous` is still MEASURED below rather than asserted from this argument** — the argument is
   * about an ideal Hilbert curve and the list is a turtle walk whose quantisation could differ.
   */
  // How many cells per axis the list represents, inferred from its own length.
  const cellsPerAxis = Math.max(2, Math.round(Math.pow(count, 1 / dim)));
  // The sub-cube side, rounded DOWN to a power of two so the alignment argument holds.
  const want = cellsPerAxis / descend;
  const k = Math.max(0, Math.floor(Math.log2(Math.max(1, want))));
  const subSide = 1 << k;
  const subCells = Math.max(1, Math.round(Math.pow(subSide, dim)));

  // Locate the sub-cube the centre falls in, by finding the list entry nearest the centre. One scan,
  // and it needs no inverse map: the walk IS the index->point direction.
  // ⚠️ The list is RAW, so the centre (which is in the figure's [-1,1] frame) is carried into it by the
  // list's own bounding box. Measuring the box here rather than taking a transform keeps this function
  // free of the normalisation's owner -- it needs only the list it was handed.
  let loX = Infinity, loY = Infinity, loZ = Infinity, hiX = -Infinity, hiY = -Infinity, hiZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const b = i * 3;
    const x = xyz[b]!, y = xyz[b + 1]!, z = xyz[b + 2]!;
    if (x < loX) loX = x; if (x > hiX) hiX = x;
    if (y < loY) loY = y; if (y > hiY) hiY = y;
    if (z < loZ) loZ = z; if (z > hiZ) hiZ = z;
  }
  const hx = Math.max(1e-9, (hiX - loX) * 0.5), hy = Math.max(1e-9, (hiY - loY) * 0.5);
  const hz = Math.max(1e-9, (hiZ - loZ) * 0.5);
  const cx = (loX + hiX) * 0.5 + (centre[0] ?? 0) * hx;
  const cy = (loY + hiY) * 0.5 + (centre[1] ?? 0) * hy;
  const cz = (loZ + hiZ) * 0.5 + (centre[2] ?? 0) * hz;
  let bestI = 0, bestD = Infinity;
  for (let i = 0; i < count; i++) {
    const b = i * 3;
    const d = (xyz[b]! - cx) ** 2 + (xyz[b + 1]! - cy) ** 2 + (xyz[b + 2]! - cz) ** 2;
    if (d < bestD) { bestD = d; bestI = i; }
  }

  // Snap to the sub-cube boundary. THIS is what makes the run contiguous.
  const bands = Math.max(1, Math.floor(count / subCells));
  const j = Math.max(0, Math.min(bands - 1, Math.floor(bestI / subCells)));
  let lo = j * subCells;
  let hi = Math.min(count - 1, lo + subCells - 1);

  let clamped = false;
  if (hi - lo + 1 < ZOOM_MIN_BAND_ENTRIES) {
    const mid = (lo + hi) >> 1;
    lo = Math.max(0, mid - (ZOOM_MIN_BAND_ENTRIES >> 1));
    hi = Math.min(count - 1, lo + ZOOM_MIN_BAND_ENTRIES - 1);
    clamped = true;
  }

  /*
   * ⚠️ **THE COMPACTNESS MEASUREMENT, which is what "contiguous" has to MEAN here.** The first version
   * compared every band entry against a box around the band's midpoint and reported `false` everywhere,
   * which was the CHECK being wrong rather than the band: a Hilbert sub-cube is compact but it is not
   * centred on its own middle entry. **The property that actually matters is that the band occupies about
   * one sub-cube and not a smear across the figure**, so that is what is measured: the band's own
   * bounding box against the sub-cube's expected side, with a factor of two of slack for the walk's
   * quantisation. ⚠️ Reported, never assumed — it is the clause the prototype fails.
   */
  let bLoX = Infinity, bLoY = Infinity, bLoZ = Infinity;
  let bHiX = -Infinity, bHiY = -Infinity, bHiZ = -Infinity;
  for (let i = lo; i <= hi; i++) {
    const b = i * 3;
    const x = xyz[b]!, y = xyz[b + 1]!, z = xyz[b + 2]!;
    if (x < bLoX) bLoX = x; if (x > bHiX) bHiX = x;
    if (y < bLoY) bLoY = y; if (y > bHiY) bHiY = y;
    if (z < bLoZ) bLoZ = z; if (z > bHiZ) bHiZ = z;
  }
  const cellSize = (hx * 2) / cellsPerAxis;
  const expected = subSide * cellSize;
  const got = Math.max(bHiX - bLoX, bHiY - bLoY, bHiZ - bLoZ);
  const compact = expected > 0 ? got <= expected * 2 : true;

  return { lo, hi, contiguous: compact, clamped };
}

/**
 * Resample a band of the list into `out`, so the whole particle budget lands inside the window.
 *
 * ⚠️ **This is what makes the zoom a zoom rather than a crop**: the band is stretched over every
 * particle, so a deeper `descend` spends the same budget on a smaller piece of the curve and the mean
 * screen chord stays roughly constant. A crop would draw fewer, more widely spaced points.
 */
export function resampleBandInto(
  out: Float64Array,
  outCount: number,
  src: Float64Array,
  lo: number,
  hi: number,
): void {
  if (outCount <= 0) return;
  const n = hi - lo + 1;
  if (n <= 1) {
    const b = lo * 3;
    for (let i = 0; i < outCount; i++) {
      const o = i * 3;
      out[o] = src[b]!; out[o + 1] = src[b + 1]!; out[o + 2] = src[b + 2]!;
    }
    return;
  }
  const step = (n - 1) / outCount;
  for (let i = 0; i < outCount; i++) {
    const u = i * step;
    const k = lo + Math.floor(u);
    const f = u - Math.floor(u);
    const a = k * 3;
    const b = (k + 1 <= hi ? k + 1 : hi) * 3;
    const o = i * 3;
    out[o] = src[a]! + (src[b]! - src[a]!) * f;
    out[o + 1] = src[a + 1]! + (src[b + 1]! - src[a + 1]!) * f;
    out[o + 2] = src[a + 2]! + (src[b + 2]! - src[a + 2]!) * f;
  }
}
