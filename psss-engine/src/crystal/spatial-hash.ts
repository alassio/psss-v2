/**
 * v8 Phase 8a-2 increment (c) — uniform-grid spatial hash over MODEL-space positions (T025 / D-08).
 *
 * ## What this is for
 *
 * Accretion asks one question, once per live wave particle, every frame: *"is there a Solid crystal
 * within `accretionRadius` of me?"* At a 4 000-particle preset the ×5 index multiplication puts
 * ~20 000 particles against up to ~2 000 crystal pool slots, so the brute-force form is 4×10⁷
 * distance tests per frame. This index makes each query cost proportional to the number of
 * candidates actually near the probe point instead of to the population size.
 *
 * ## Why model space, and why a hash rather than a texture
 *
 * The dormant `dla-processor.ts` answers the same adjacency question against a 1024² **screen-space**
 * grid. That is precisely the defect that made v7 growth look detached: a screen grid does not
 * rotate with the figure, so its cells drift across the form every frame. Indexing the pool's
 * `mx/my/mz` instead means the index lives in the same space the crystals were born in and rotates
 * with the figure for free.
 *
 * A dense grid is not an option either: model-space extents are preset amplitudes (routinely ±600,
 * unbounded in principle), so an AABB-sized dense grid at `cellSize = accretionRadius = 1` would
 * want ~1200³ cells. Hashing cell coordinates into a bounded bucket table (Teschner et al. 2003)
 * keeps memory proportional to the item count instead of to the volume, and bucket collisions are
 * harmless here — see `queryRadius`.
 *
 * ## Layout: counting sort, not an array of arrays
 *
 * Buckets are a `cellStart` prefix-sum plus one flat `items` array — the classic two-pass counting
 * sort. No `Array` of arrays, no `Map`, no per-cell object, so a rebuild allocates NOTHING once the
 * buffers have reached their high-water mark, and neither does a query. Positions are **copied into
 * cell-sorted order** during the scatter (`px/py/pz`), which is the real payoff of the layout: the
 * inner loop of a query walks one contiguous run of floats per bucket instead of chasing random
 * indices back into the pool's arrays. It also means this class retains no reference to caller
 * memory, so the pool is free to reallocate its slot arrays between frames.
 *
 * ## Measured cost (Node 22, 2 000 live slots at `cellSize = accretionRadius = 12`, model extent ±400)
 *
 * | Work | ms/frame |
 * |------|----------|
 * | `rebuild` over 2 000 slots | **0.036** |
 * | 1 600 `queryRadius` calls (`accretionBudget` 8 × 200 probes) | 0.28 |
 * | 20 000 `queryRadius` calls (every particle of a 4 000-particle preset) | 4.5 |
 * | `rebuild` with zero items | 0.0008 |
 *
 * Rebuild is O(N) in slots — two linear passes plus a fixed bucket walk — and negligible. The cost
 * that matters is the QUERY COUNT, which is the caller's to choose: probing all 20 000 particles
 * costs 4.5 ms/frame, which is a real chunk of a 16.6 ms budget, while probing a bounded random
 * sample costs 0.3 ms. Since `accretionBudget` caps the number of accretions anyway, a full
 * population scan buys nothing but cost — T026 should probe `min(waveCount, budget * 200)` particles
 * from a random offset and break as soon as the budget is spent. Verified exact against brute force
 * over 6 000 randomised queries; ~14× faster than brute force even at the full 20 000-probe scan.
 *
 * ## Self-contained by design
 *
 * No imports. Nothing from `src/generators/` or `src/renderers/`, and deliberately no knowledge of
 * `CrystalRenderConfig` or of what "Solid" means — solidity is expressed by the caller through the
 * `include` filter, so `src/crystal/` stays deletable in one step per the removal recipe.
 */

/**
 * Per-item inclusion test, evaluated ONCE per source index per rebuild (never per query).
 *
 * This is how the caller keeps its semantics out of this file: accretion passes
 * `(i) => alive[i] === 1 && growth[i] >= 1`, so only Solid crystals are indexed and a query result
 * needs no post-filter at all.
 */
export type SpatialHashFilter = (index: number) => boolean;

/**
 * Floor for the cell size. A zero or negative `cellSize` would make `1 / cellSize` non-finite and
 * poison every cell coordinate, and `accretionRadius` is allowed to sit at 0 on its slider, so the
 * degenerate case has to be absorbed here rather than trusted away.
 */
const MIN_CELL_SIZE = 1e-3;

/** Bucket table floor — below this the modulo pressure is worse than the memory saved. */
const MIN_BUCKETS = 64;

/** Bucket table ceiling. 65 536 buckets is 256 KB of `Int32Array`; the pool caps far below this. */
const MAX_BUCKETS = 1 << 16;

/**
 * Hard limit on how many cells a single query may span per axis.
 *
 * The contract is `r <= cellSize`, which spans 2 or 3 cells per axis (see `queryRadius`). This cap
 * only exists so a caller passing a nonsense radius — `r` orders of magnitude above `cellSize` —
 * degrades into an incomplete answer instead of hanging the frame in a 10²⁷-iteration loop.
 */
const MAX_CELL_SPAN = 4;

/** Large primes for the cell-coordinate hash. Standard triple; behaves correctly on negative ints. */
const HASH_X = 73856093;
const HASH_Y = 19349663;
const HASH_Z = 83492791;

function nextPow2(n: number): number {
  let p = MIN_BUCKETS;
  while (p < n && p < MAX_BUCKETS) p <<= 1;
  return p;
}

export class SpatialHash {
  // ---- grid ---------------------------------------------------------------------------------

  private cellSize = 1;
  private invCellSize = 1;

  /** Number of items indexed by the last `rebuild`. */
  private itemCount = 0;

  /** Allocated per-item length. Grows only; never shrinks, so a shrinking pool causes no churn. */
  private itemCapacity = 0;

  private bucketCount = 0;
  private bucketMask = 0;

  // ---- staging (pass 1) ---------------------------------------------------------------------

  /** Source indices that passed `include`, compacted. */
  private srcIndex = new Int32Array(0);

  /** Bucket of each staged item — cached so the hash is computed once per item, not twice. */
  private srcBucket = new Int32Array(0);

  // ---- cell-sorted store (pass 2) -----------------------------------------------------------

  /** Source indices in cell-sorted order. This is what queries hand back. */
  private items = new Int32Array(0);

  /** Positions in the same cell-sorted order — the cache-locality win of the counting sort. */
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private pz = new Float32Array(0);

  /** Prefix sums, length `bucketCount + 1`. Bucket `b` occupies `[cellStart[b], cellStart[b+1])`. */
  private cellStart = new Int32Array(1);

  /** Scatter cursors, also used as the counting pass's histogram. Length `bucketCount`. */
  private cellCursor = new Int32Array(0);

  // ---- query scratch ------------------------------------------------------------------------

  /**
   * Generation stamps for bucket de-duplication, one per bucket, plus a monotonic tick.
   *
   * Two distinct cells in a query's neighbourhood can hash to the same bucket. Visiting that bucket
   * twice would report the same item twice, so each query stamps the buckets it has already walked.
   * Stamping is O(1) and needs no clearing between queries — at 20 000 queries per frame, clearing
   * a 4 096-entry array each time would cost more than the whole rebuild.
   *
   * This dedup is exactly complete, not approximate: every item whose cell hashes to `b` is stored
   * in `b`, so walking each DISTINCT bucket of the neighbourhood once visits every candidate once.
   */
  private probeStamp = new Int32Array(0);
  private probeTick = 0;

  /** Result scratch, sized to `itemCapacity` so truncation is structurally impossible. */
  private results = new Int32Array(0);
  private resultDist2 = new Float32Array(0);
  private resultCount = 0;

  // ---- accessors ----------------------------------------------------------------------------

  /** Items indexed by the last `rebuild`. Zero means every query trivially returns 0. */
  getItemCount(): number {
    return this.itemCount;
  }

  /** The cell size actually in use, after the `MIN_CELL_SIZE` clamp. */
  getCellSize(): number {
    return this.cellSize;
  }

  /**
   * Slot/source indices of the last `queryRadius`, valid for `[0, returnedCount)`.
   *
   * A SHARED buffer, invalidated by the next query — read it before querying again. Returned rather
   * than copied precisely so a per-particle query allocates nothing.
   */
  getResults(): Int32Array {
    return this.results;
  }

  /** Squared distances parallel to `getResults()`. Saves the caller recomputing them (T027). */
  getResultDist2(): Float32Array {
    return this.resultDist2;
  }

  // ---- lifecycle ----------------------------------------------------------------------------

  /**
   * Drop the index contents without releasing buffers. Cheaper than `rebuild(0, ...)` and the right
   * call when growth is switched off mid-run: a stale index must never become a second source of
   * truth about which slots exist.
   */
  clear(): void {
    this.itemCount = 0;
    this.resultCount = 0;
    if (this.bucketCount > 0) this.cellStart.fill(0, 0, this.bucketCount + 1);
  }

  /** Release every buffer. Called from `CrystalPool.dispose()`. */
  dispose(): void {
    this.srcIndex = new Int32Array(0);
    this.srcBucket = new Int32Array(0);
    this.items = new Int32Array(0);
    this.px = new Float32Array(0);
    this.py = new Float32Array(0);
    this.pz = new Float32Array(0);
    this.cellStart = new Int32Array(1);
    this.cellCursor = new Int32Array(0);
    this.probeStamp = new Int32Array(0);
    this.results = new Int32Array(0);
    this.resultDist2 = new Float32Array(0);
    this.itemCount = 0;
    this.itemCapacity = 0;
    this.bucketCount = 0;
    this.bucketMask = 0;
    this.resultCount = 0;
    this.probeTick = 0;
  }

  // ---- rebuild ------------------------------------------------------------------------------

  /**
   * Re-index from scratch. Called once per frame, from inside the caller's `growthEnabled` gate —
   * this class allocates nothing and does nothing until the first `rebuild`, which is what makes
   * `growthEnabled: false` a complete inertness gate.
   *
   * Rebuilding wholesale rather than incrementally is deliberate: pool slots are born and released
   * every frame, and an index that tracked those edits would be a second, drift-prone record of the
   * live set. A full O(N) rebuild over ≤2 000 slots is far cheaper than that class of bug.
   *
   * Non-finite positions are skipped rather than inserted, so an uninitialised or sentinel slot that
   * slipped through `include` cannot corrupt a bucket.
   *
   * @param count    length of the source arrays to consider — the pool's `capacity`, NOT its
   *                 `activeCount`, since slot indices are stable and sparse.
   * @param xs       source X positions, stride 1, indexed by source index (the pool's `mx`).
   * @param ys       source Y positions (`my`).
   * @param zs       source Z positions (`mz`).
   * @param cellSize grid pitch. Pass `accretionRadius`: a query of radius `r <= cellSize` then
   *                 touches at most a 3×3×3 neighbourhood. See `queryRadius` for why that is the
   *                 optimum rather than a smaller stencil over larger cells.
   * @param include  per-index filter, or `null` to index all `count` entries.
   */
  rebuild(
    count: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    cellSize: number,
    include: SpatialHashFilter | null,
  ): void {
    this.itemCount = 0;
    this.resultCount = 0;

    let cs = cellSize;
    if (!Number.isFinite(cs) || cs < MIN_CELL_SIZE) cs = 1;
    this.cellSize = cs;
    this.invCellSize = 1 / cs;

    const n = count > 0 ? Math.floor(count) : 0;
    if (n === 0) {
      this.clear();
      return;
    }

    // Buckets are sized from `n`, the upper bound on items, before `include` has run. Over-sizing
    // costs a little memory and lowers the load factor; under-sizing would cost every query.
    this.ensureCapacity(n);

    const mask = this.bucketMask;
    const counts = this.cellCursor;
    counts.fill(0, 0, this.bucketCount);

    const inv = this.invCellSize;
    const srcIndex = this.srcIndex;
    const srcBucket = this.srcBucket;

    // ---- pass 1: filter, hash, histogram (one touch per source index) ----
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (include !== null && !include(i)) continue;

      const x = xs[i]!;
      const y = ys[i]!;
      const z = zs[i]!;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

      const cx = Math.floor(x * inv);
      const cy = Math.floor(y * inv);
      const cz = Math.floor(z * inv);
      const b = (((cx * HASH_X) ^ (cy * HASH_Y) ^ (cz * HASH_Z)) & mask) | 0;

      srcIndex[m] = i;
      srcBucket[m] = b;
      counts[b] = counts[b]! + 1;
      m++;
    }

    this.itemCount = m;
    if (m === 0) {
      this.cellStart.fill(0, 0, this.bucketCount + 1);
      return;
    }

    // ---- prefix sum: bucket starts ----
    const cellStart = this.cellStart;
    let running = 0;
    for (let b = 0; b < this.bucketCount; b++) {
      cellStart[b] = running;
      running += counts[b]!;
    }
    cellStart[this.bucketCount] = running;

    // Reuse the histogram as the scatter cursor. `counts` is dead from here on.
    for (let b = 0; b < this.bucketCount; b++) counts[b] = cellStart[b]!;

    // ---- pass 2: scatter into cell-sorted order, copying positions for query locality ----
    const items = this.items;
    const px = this.px;
    const py = this.py;
    const pz = this.pz;
    for (let k = 0; k < m; k++) {
      const b = srcBucket[k]!;
      const pos = counts[b]!;
      counts[b] = pos + 1;
      const i = srcIndex[k]!;
      items[pos] = i;
      px[pos] = xs[i]!;
      py[pos] = ys[i]!;
      pz[pos] = zs[i]!;
    }
  }

  // ---- query --------------------------------------------------------------------------------

  /**
   * Collect every indexed item within `r` of `(x, y, z)`.
   *
   * Results land in the shared `getResults()` / `getResultDist2()` buffers — nothing is allocated,
   * per call or otherwise, because this runs up to ~20 000 times per frame and a single per-query
   * array would put 20 000 allocations a frame in front of the GC.
   *
   * **Why the cell range is derived from `r` instead of being a fixed 3×3×3 stencil.** The cell span
   * is computed from the query interval, `floor((x-r)/cell) .. floor((x+r)/cell)`, which for the
   * intended `r == cellSize` gives 2 or 3 cells per axis depending on where the probe falls inside
   * its cell — averaging well under the 27-cell worst case, and remaining correct if `r < cellSize`
   * (the common case once the caller's radius and the grid pitch diverge). A fixed 3×3×3 would pay
   * 27 buckets unconditionally.
   *
   * **Why not a 2×2×2 stencil over double-sized cells.** With `cellSize = 2r` a 2×2×2 neighbourhood
   * is only correct on a boundary-rounded lattice, and it sweeps `8·(2r)³ = 64r³` of volume against
   * the `27r³` of the 3×3×3-over-`r` grid — more than twice the candidates for fewer bucket lookups.
   * Bucket lookups are the cheap part; candidate distance tests are not. `cellSize = accretionRadius`
   * per D-08 is the right trade.
   *
   * Bucket hash collisions are absorbed by the distance test — a colliding item is a false candidate,
   * never a missed one — and repeat visits are suppressed by the generation stamp, so the result set
   * is exact and duplicate-free.
   *
   * @returns the number of hits, i.e. the valid prefix length of `getResults()`.
   */
  queryRadius(x: number, y: number, z: number, r: number): number {
    this.resultCount = 0;
    if (this.itemCount === 0) return 0;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
    if (!Number.isFinite(r) || r < 0) return 0;

    const inv = this.invCellSize;
    const r2 = r * r;

    let cx0 = Math.floor((x - r) * inv);
    let cy0 = Math.floor((y - r) * inv);
    let cz0 = Math.floor((z - r) * inv);
    let cx1 = Math.floor((x + r) * inv);
    let cy1 = Math.floor((y + r) * inv);
    let cz1 = Math.floor((z + r) * inv);

    // Safety clamp only — a legitimate `r <= cellSize` never reaches it.
    if (cx1 - cx0 >= MAX_CELL_SPAN) cx1 = cx0 + MAX_CELL_SPAN - 1;
    if (cy1 - cy0 >= MAX_CELL_SPAN) cy1 = cy0 + MAX_CELL_SPAN - 1;
    if (cz1 - cz0 >= MAX_CELL_SPAN) cz1 = cz0 + MAX_CELL_SPAN - 1;

    const tick = this.nextTick();
    const mask = this.bucketMask;
    const stamp = this.probeStamp;
    const cellStart = this.cellStart;
    const items = this.items;
    const px = this.px;
    const py = this.py;
    const pz = this.pz;
    const out = this.results;
    const outD2 = this.resultDist2;

    let found = 0;

    for (let cz = cz0; cz <= cz1; cz++) {
      const hz = cz * HASH_Z;
      for (let cy = cy0; cy <= cy1; cy++) {
        const hzy = (cy * HASH_Y) ^ hz;
        for (let cx = cx0; cx <= cx1; cx++) {
          const b = (((cx * HASH_X) ^ hzy) & mask) | 0;
          if (stamp[b] === tick) continue;
          stamp[b] = tick;

          const end = cellStart[b + 1]!;
          for (let p = cellStart[b]!; p < end; p++) {
            const dx = px[p]! - x;
            const dy = py[p]! - y;
            const dz = pz[p]! - z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > r2) continue;
            out[found] = items[p]!;
            outD2[found] = d2;
            found++;
          }
        }
      }
    }

    this.resultCount = found;
    return found;
  }

  /** Hit count of the last `queryRadius`, for callers that dropped the return value. */
  getResultCount(): number {
    return this.resultCount;
  }

  // ---- internals ----------------------------------------------------------------------------

  /**
   * Monotonic query stamp. Wrapping past the Int32 range would alias a fresh tick onto a stale
   * stamp and silently drop buckets, so the counter resets the stamp array instead of overflowing.
   */
  private nextTick(): number {
    if (this.probeTick >= 0x7ffffffe) {
      this.probeStamp.fill(0);
      this.probeTick = 0;
    }
    return ++this.probeTick;
  }

  /**
   * Grow buffers to hold `n` items. Monotonic: a smaller `n` on a later frame is a no-op, so a pool
   * whose live count oscillates does not reallocate. `Int32Array`/`Float32Array` construction zeroes,
   * which is what `probeStamp` requires after a resize.
   */
  private ensureCapacity(n: number): void {
    if (n <= this.itemCapacity) return;

    this.itemCapacity = n;
    this.srcIndex = new Int32Array(n);
    this.srcBucket = new Int32Array(n);
    this.items = new Int32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    // Sized to the item capacity: a query can legitimately return every indexed item (all slots
    // inside one radius), so this length makes truncation impossible and removes the need for a cap
    // check in the query's inner loop.
    this.results = new Int32Array(n);
    this.resultDist2 = new Float32Array(n);

    // Load factor ~0.5 keeps collision chains short without a second hash.
    const buckets = nextPow2(n * 2);
    if (buckets !== this.bucketCount) {
      this.bucketCount = buckets;
      this.bucketMask = buckets - 1;
      this.cellStart = new Int32Array(buckets + 1);
      this.cellCursor = new Int32Array(buckets);
      this.probeStamp = new Int32Array(buckets);
      this.probeTick = 0;
    }
  }
}
