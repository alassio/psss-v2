import type { CohesionConfig } from '../presets/types.ts';
import { CULL_SENTINEL } from '../core/projection.ts';

/**
 * v8 Step 15.4 (E87) — **Cohesion: drops FORM.** A short-range attraction between nearby particles,
 * accumulated as a persistent per-particle positional offset in SCREEN PIXELS, so the curve beads up into
 * discrete droplets that travel, collide and — with 15.1's iso-surface live — visibly fuse.
 *
 * ## The mechanism is CLOUD-IN-CELL, not the spec's per-particle neighbour search, and that is a MEASURED
 * substitution rather than a preference
 *
 * The step specifies `crystal/spatial-hash.ts`'s `rebuild()` + `queryRadius()` per particle, with a cost
 * model of *"~10 neighbours each"*. Both halves were falsified by measurement at 1024×768, radius 24:
 *
 * | n | `SpatialHash` per-particle | this file |
 * |---|---|---|
 * | 4 000 | 1.90 ms | **0.353 ms** |
 * | 10 000 | 6.55 ms | **0.753 ms** |
 * | 20 000 | **19.49 ms** | **1.407 ms** |
 * | 50 000 | 104.81 ms | **3.455 ms** |
 *
 * ⚠️ **THE COST MODEL WAS WRONG BECAUSE A LISSAJOUS FIGURE IS A 1-D LOCUS.** Consecutive indices sit ~1.2 px
 * apart on a typical figure, so a 24 px query returns **227.9 hits per particle**, not ~10 — and the hash's
 * cost is then linear in the radius (measured at n = 20 000: r 8 → 9.42 ms, r 80 → 74.97 ms). The specified
 * form would have needed a particle ceiling near 4 000, i.e. **below every liquid preset in the library**,
 * which would have made the step inert exactly where it is meant to be judged.
 *
 * A cloud-in-cell pass is flat in the radius instead (1.461 / 1.464 / 1.417 / 1.414 / 1.351 / 1.233 / 1.309 ms
 * at r = 4 / 8 / 16 / 24 / 40 / 80 / 160), because the work is one scatter and one gather per particle
 * regardless of how many neighbours that implies. It computes the local **centroid** of the surrounding mass
 * and pushes toward it, which is what "attract to your neighbours" means in the limit of many neighbours —
 * so at the densities this engine actually runs it is not an approximation of the pairwise sum, it is a
 * better-conditioned statement of the same thing.
 *
 * ⚠️ **A second, architectural consequence: no `crystal/spatial-hash.ts` import.** That file has exactly one
 * importer (`crystal-pool.ts`), which is what keeps Phase 8a's Removal Recipe a ONE-STEP deletion of
 * `src/crystal/`. Reaching into it from a liquid subsystem would have silently invalidated that recipe, and
 * nothing would have reported it.
 *
 * ## The deposit is an EXACT zero-order hold, and `sampleClusterForce`'s form does NOT transfer
 *
 * The offset recurrence is `off = off·retain + u·deposit` with `retain = exp(−ret·dt)`. `lissajous.ts`'s
 * cluster-force block divides by `rate60 = 1 − exp(−ret/60)`, and copying that here was measured and
 * rejected: the settled mean offset then ran 4.48 / 7.25 / 9.18 / 10.70 / 14.78 / 17.20 px at
 * dt = 8 / 13 / 16.7 / 20 / 33 / 50 ms — a **~3.8× frame-time drift**, i.e. the exact "whole figure breathes"
 * defect that formula exists to prevent, reintroduced by carrying it across a unit boundary (invariant 10).
 *
 * ⚠️ **The difference is what `u` IS.** `sampleClusterForce`'s push is a per-FRAME displacement, so it needs
 * renormalising to a 60 Hz frame. The push here is a **VELOCITY in px/s** (`cohesion · SPEED · radius`), so
 * the correct integral of `∫exp(−ret·s) ds` over the frame is `(1 − retain)/ret`, dividing by **`ret`** and
 * not by any frame rate. Measured with that form: **7.5866 → 7.5807 px over dt 8 → 50 ms, a 0.08 % drift**
 * (0.46 % at the shipped `SPEED`). The `ret → 0` limit is `dt`, which is why the guarded branch is `dtSec`.
 *
 * ## What each constant is, and why it is not a free choice
 *
 * ⚠️ **`SPEED` WAS CHOSEN BY MEASURING WHICH PART OF THE SLIDER IS LIVE, NOT BY TASTE.** Blob counts on the
 * real 15.1 iso-surface (`Liquid Surface`, n = 15 000, iso 0.8409, R = 8; baseline is **1** connected blob of
 * 19 958 px): at `SPEED = 1` the figure still reads as one shape until Cohesion 0.75 and only breaks at 1.0
 * (1 → 16 blobs), so five sixths of the track does nothing. At **3.0** the whole range is live and monotone —
 * Cohesion 0.15 → 1 blob, 0.3 → 9, 0.5 → 38, 0.75 → 61, 1.0 → **66** (median blob 87 px). That is invariant
 * 13's shape arriving through a constant rather than through a broken wire: a slider whose bottom two thirds
 * are inert reads as "cohesion barely works".
 *
 * `DEADBAND` ramps the push down inside 0.15·radius of the centroid. Without it a particle that has ALREADY
 * reached the local centroid keeps receiving a full-magnitude push toward it and jitters across it every
 * frame — the drop shimmers instead of sitting still.
 *
 * `MARGIN` is 2 cells of grid apron, so a particle just outside the canvas still contributes to the mass of a
 * cell that a particle just inside gathers from; without it a drop touching the frame edge is pulled inward
 * by the missing half of its own neighbourhood.
 *
 * `MAX_RADII` caps the accumulated offset at 4·radius. ⚠️ **The step's divergence warning did not
 * materialise and this cap is NOT what stands between it and a reseed** — measured at `returnForce = 0`,
 * Cohesion 1.0, radius 24 over 90 s: mean offset plateaus at 44.2 → 47.9 px, max pins at exactly 96.0 px
 * (= 4·radius) with 164–285 of 10 000 particles at the cap and **0 non-finite values**. At ordinary settings
 * (Cohesion 1.0, Return Force 1.5) **0 of 10 000** reach the cap and the max is 43.9 px. So the cap is a
 * backstop for the `returnForce = 0` corner, not a load-bearing stabiliser, and the non-finite reseed below
 * is defence against an upstream NaN rather than against this integrator.
 *
 * ## Memory, and why the grid is not reallocated per frame
 *
 * Three `Float32Array`s of `(⌈W/R⌉ + 2·MARGIN + 1)·(⌈H/R⌉ + 2·MARGIN + 1)` cells, allocated only when that
 * cell count changes. Worst case in the shipped ranges is radius 4 at 3840×2160: 526 k cells, **6.02 MB**,
 * once. At 1024×768 it is 0.59 MB at radius 4 and 0.04 MB at radius 16. ⚠️ **Per-frame allocation RATE is the
 * quantity that reaches a user, not allocation time** (invariant 8: 58 MB/s of `getState()` scratch was
 * reported as *"a jitter effect every few seconds"* — a GC pause), so the per-frame cost here is exactly
 * zero allocations. The cleared-cell list is likewise a grow-only `Int32Array`.
 *
 * ## The table above is PER INTEGRATED STEP, and since 2026-09-25 that is not once per frame
 *
 * `MIN_STEP_MS` samples the field at most every 33.4 ms while the caller keeps applying the offsets every
 * frame — read it before quoting any figure here as a per-frame cost, and before changing the integrator,
 * whose exactness is the only thing that makes the rate free.
 */
export class CohesionField {
  /** Persistent accumulated offset, screen pixels. Survives the wave recomputation, like `physarumOffsetX`. */
  private offsetX: Float32Array = new Float32Array(0);
  private offsetY: Float32Array = new Float32Array(0);
  private count = 0;

  // The cloud-in-cell grid: mass and the mass-weighted position sums, one entry per cell.
  private mass: Float32Array = new Float32Array(0);
  private sumX: Float32Array = new Float32Array(0);
  private sumY: Float32Array = new Float32Array(0);
  private gridW = 0;
  private gridH = 0;
  /** Indices written this frame, so the clear touches only them rather than the whole grid. */
  private touched: Int32Array = new Int32Array(0);

  /**
   * The push velocity at Cohesion 1.0, in radii per second — see the class header for the blob-count
   * measurement that fixed it at 3 rather than 1.
   */
  static readonly SPEED = 3.0;
  /** Ramp-down half-width around the centroid, as a fraction of `radius`. */
  static readonly DEADBAND = 0.15;
  /** Cells of apron beyond the canvas on every side. */
  static readonly MARGIN = 2;
  /** Accumulated-offset ceiling, in multiples of `radius`. */
  static readonly MAX_RADII = 4;
  /**
   * Ceiling on the grid's cell count, so the memory cannot follow the canvas × the smallest radius without
   * bound. 262 144 cells × 12 bytes = **3.00 MB**. ⚠️ **Measured before it was picked: this cap does NOT
   * bite at any ordinary size** — the effective pitch equals the requested radius at both 1024×768 and
   * 1920×1200 all the way down to 4 px, and only 3840×2160 raises it, to **5.70 px** (from 4). So the
   * degradation is invisible except at 4K with the two or three smallest stops, where the drops come out
   * marginally larger than the label says rather than the tab stuttering on a 6 MB allocation.
   */
  static readonly MAX_CELLS = 1 << 18;

  /**
   * The minimum integrated step, in ms — **the field is SAMPLED at most this often, while its offsets are
   * APPLIED by the caller every frame.** 2026-09-25, owner-commissioned as option G against a measured 9.0
   * ms/frame CPU floor at 50 000 particles, of which this stage is 3.9 ms (`cohesionAllowed`'s figure).
   *
   * ⚠️ **WHAT MAKES THIS LOSSLESS RATHER THAN A FRAME-RATE CHEAT IS THE ZERO-ORDER HOLD ABOVE, AND NOTHING
   * ELSE.** `off = off·retain + u·deposit` with `retain = exp(−ret·dt)` and `deposit = (1 − retain)/ret` is
   * the EXACT integral over the step, which is why the class header's measurement found the settled offset
   * moving 7.5866 → 7.5807 px across dt 8 → 50 ms — **a 0.08 % drift over a 6× change in step (0.46 % at the
   * shipped `SPEED`)**. Doubling the step therefore costs ~0.5 % of offset magnitude, against a 15 %
   * `DEADBAND`. Had this stage used `sampleClusterForce`'s `rate60` form — the one the header records as
   * measured and rejected — the same halving would have changed the settled offset by ~2×, and the whole
   * figure would have breathed. **A rate change is safe here BECAUSE of a decision made for another reason;
   * do not copy this gate into a stage that renormalises to 60 Hz.**
   *
   * ⚠️ **33.4 ms, and the accumulator is what keeps the step inside the MEASURED band** — `pendingDt` sums
   * real frame times and hands the SUM to the integration, so the step is the true elapsed time and never a
   * doubled guess. Consequences, all of them wanted: at 60 fps it runs every other frame at 33.4 ms (inside
   * the 8–50 ms band the header measured); at 30 fps or slower `pendingDt` clears the threshold every frame,
   * so **a struggling machine gets the ORIGINAL rate, not a chunkier one**. The one regime that exits the
   * measured band is 30–60 fps, where the step can reach ~2× the frame time and so up to ~67 ms; the drift
   * curve is flat enough there (0.46 % over 8 → 50 ms) that the extrapolation is worth far less than the
   * 1.9 ms it buys, but it IS an extrapolation and is recorded here as one.
   *
   * ⚠️ **Do NOT express this as "every other frame".** A frame count means 33 ms at 60 fps and 67 ms at
   * 30 fps — the opposite of the self-limiting behaviour above, degrading the look exactly where the machine
   * is already in trouble.
   *
   * **Measured 2026-09-25 at a basis of its own — `Boiling Milk`'s authored cohesion (strength 0.51, radius
   * 64, returnForce 2.75) at n = 50 000 on a 2859×1440 canvas, interleaved best-of-3 over 600 frames.** ⚠️
   * **That is NOT the basis of the 3.455 / 3.939 ms figures in the class header and in
   * `lissajous.ts`'s `cohesionAllowed()`** (radius 16, 1024×768) — three measurements wearing the same words;
   * do not reconcile them into one number.
   *
   * | | ms/frame, amortised |
   * |---|---|
   * | integrating every frame | 4.945 |
   * | this gate, at 60 fps | **2.843** |
   *
   * **−2.10 ms/frame, 57.5 % of the ungated cost, at a 2:1 step ratio** — the residue above half is the
   * `ensure()` call and the gate itself, both of which still run every frame.
   *
   * And the look, by the same run: the settled mean offset moves **0.38 % from dt 16.7 to dt 33.4 ms** (25.169
   * → 25.265 px) with the maximum flat at 35.1 px, and 0.77 % across the whole 8 → 50 ms band. That
   * independently reproduces the class header's 0.46 % on a DIFFERENT config, which is the reason to believe
   * either of them.
   */
  static readonly MIN_STEP_MS = 33.4;

  /**
   * Frame time accumulated since the last integrated step. **Not a frame counter** — see `MIN_STEP_MS`.
   * Cleared by `reset()`, so the strength → 0 path in `setCohesionConfig` cannot bank a step.
   */
  private pendingDt = 0;

  constructor(particleCount: number) {
    this.resize(particleCount);
  }

  getOffsetX(): Float32Array { return this.offsetX; }
  getOffsetY(): Float32Array { return this.offsetY; }

  /**
   * ⚠️ **`positions` MUST be the PROJECTED, screen-space array**, because `radius` is in PIXELS.
   * `clusterForceRadius` is in MODEL units and this one is not — do not carry the name across without the
   * unit (invariant 10 at a subsystem boundary). The caller therefore runs this after the perspective
   * projection, beside fire buoyancy, and never in model space beside the cluster force.
   *
   * ⚠️ **Call this EVERY frame; it decides for itself whether to integrate** (`MIN_STEP_MS`). The caller's job
   * is to apply `getOffsetX()/getOffsetY()` every frame regardless — a caller that gated the CALL would break
   * the accumulator and lose the skipped frames' time.
   *
   * @param dt frame time in MILLISECONDS, as every other generator stage takes it. Accumulated, then
   *   converted — the integration sees the elapsed time since the last step, not this frame's alone.
   */
  update(dt: number, count: number, positions: Float32Array, width: number, height: number, config: CohesionConfig): void {
    // ⚠️ **ONE effective radius, not two.** The grid pitch IS the interaction radius (a bilinear gather sees
    // one cell in every direction), so where `MAX_CELLS` raises the pitch it raises the radius, and the
    // deadband, the push velocity and the offset cap all scale off the SAME resolved number below. Keeping
    // `config.radius` for the force scales while the neighbourhood grew would make the two disagree by up to
    // 1.4× at 4K — a strength error dressed as a size error, i.e. invariant 10's shape inside one function.
    const radius = this.resolveRadius(width, height, Math.max(1, config.radius));
    // ⚠️ **`ensure()` RUNS ON A SKIPPED FRAME TOO, AND ABOVE THE RATE GATE FOR THAT REASON.** The caller reads
    // `getOffsetX()/getOffsetY()` and indexes them to ITS OWN particle count every frame, so an offset array
    // left short by a skipped resize would be read past its end — `undefined` through a non-null assertion,
    // i.e. NaN positions for the whole tail of the population, silently and permanently. The two comparisons
    // it costs on an unchanged frame are not worth a correctness risk.
    this.ensure(count, width, height, radius);
    if (this.count === 0) return;

    // ---- RATE GATE: sample at most every `MIN_STEP_MS`, integrating the ACCUMULATED time ------------------
    //
    // Returning here leaves `offsetX/offsetY` exactly as they were, and the caller adds them to the positions
    // regardless — so the drops hold their displacement rather than snapping back, and a skipped frame is a
    // held frame, never a dropped one. Read `MIN_STEP_MS` before changing the number: the zero-order hold is
    // what licenses this, and 33.4 ms is the top of a measured band.
    //
    // ⚠️ Accepted cost: the `CULL_SENTINEL` zeroing below is skipped too, so a particle whose cull state
    // flickers on a one-frame timescale can re-enter view carrying an offset one step old. Bounded by
    // `MAX_RADII` and by one step — and a particle culled for LONGER than a step is still zeroed while
    // culled, which is the case that comment is actually about.
    this.pendingDt += Math.max(0, dt);
    if (this.pendingDt < CohesionField.MIN_STEP_MS) return;
    const step = this.pendingDt;
    this.pendingDt = 0;

    const gw = this.gridW, gh = this.gridH;
    const m = this.mass, sX = this.sumX, sY = this.sumY, T = this.touched;
    const ox = this.offsetX, oy = this.offsetY;
    const inv = 1 / radius;
    const apron = CohesionField.MARGIN;
    let tn = 0;

    // ---- SCATTER: bilinear deposit of (mass, mass·x, mass·y) at each particle's DISPLACED position -------
    //
    // Displaced, not the mathematical position: the beads are where the particles actually are, so the
    // centroid a particle gathers next has to be built from the same configuration it can see.
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const bx = positions[idx]!;
      const by = positions[idx + 1]!;
      // ⚠️ **A CULLED SLOT HOLDS `CULL_SENTINEL` (−10000) AND MUST BE EXCLUDED FROM BOTH LOOPS.** `positions`
      // is dense, so scattering a culled particle would build a phantom mass concentration far off screen and
      // every live particle near the frame edge would be pulled toward it. Its own offset is zeroed rather
      // than retained, so a particle that comes back into view arrives at its mathematical position instead
      // of resuming a displacement computed against a figure that has since rotated away.
      if (bx === CULL_SENTINEL || !Number.isFinite(bx) || !Number.isFinite(by)) { ox[i] = 0; oy[i] = 0; continue; }
      const x = bx + ox[i]!, y = by + oy[i]!;
      const fx = x * inv + apron, fy = y * inv + apron;
      const i0 = Math.floor(fx), j0 = Math.floor(fy);
      if (i0 < 0 || j0 < 0 || i0 + 1 >= gw || j0 + 1 >= gh) continue;
      const tx = fx - i0, ty = fy - j0;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const a = j0 * gw + i0, b = a + 1, c = a + gw, d = c + 1;
      m[a] = m[a]! + w00; sX[a] = sX[a]! + w00 * x; sY[a] = sY[a]! + w00 * y; T[tn++] = a;
      m[b] = m[b]! + w10; sX[b] = sX[b]! + w10 * x; sY[b] = sY[b]! + w10 * y; T[tn++] = b;
      m[c] = m[c]! + w01; sX[c] = sX[c]! + w01 * x; sY[c] = sY[c]! + w01 * y; T[tn++] = c;
      m[d] = m[d]! + w11; sX[d] = sX[d]! + w11 * x; sY[d] = sY[d]! + w11 * y; T[tn++] = d;
    }

    // ---- INTEGRATE: gather the local centroid and step the offset toward it ------------------------------
    // `step`, never `dt` — the accumulated time since the last integrated frame, so the zero-order hold below
    // integrates the interval it actually spans. Using `dt` here would under-integrate by the skip factor and
    // reintroduce the frame-rate dependence the class header exists to rule out.
    const dtSec = step * 0.001;
    const ret = Math.max(0, config.returnForce);
    const retain = Math.exp(-ret * dtSec);
    // ⚠️ **DIVIDE BY `ret`, NOT BY A 60 Hz RATE — the class header records the 3.8 % vs 0.08 % measurement.**
    // `u` is a velocity, so the exact zero-order-hold integral over the frame is `(1 − retain)/ret`, whose
    // `ret → 0` limit is `dtSec`.
    const deposit = ret > 1e-6 ? (1 - retain) / ret : dtSec;
    const speed = Math.max(0, config.strength) * CohesionField.SPEED * radius;
    const band = CohesionField.DEADBAND * radius;
    const cap = CohesionField.MAX_RADII * radius;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const bx = positions[idx]!;
      const by = positions[idx + 1]!;
      if (bx === CULL_SENTINEL || !Number.isFinite(bx) || !Number.isFinite(by)) continue;
      const x = bx + ox[i]!, y = by + oy[i]!;
      let ux = 0, uy = 0;
      const fx = x * inv + apron, fy = y * inv + apron;
      const i0 = Math.floor(fx), j0 = Math.floor(fy);
      if (!(i0 < 0 || j0 < 0 || i0 + 1 >= gw || j0 + 1 >= gh)) {
        const tx = fx - i0, ty = fy - j0;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        const a = j0 * gw + i0, b = a + 1, c = a + gw, d = c + 1;
        const mLocal = m[a]! * w00 + m[b]! * w10 + m[c]! * w01 + m[d]! * w11;
        if (mLocal > 1e-6) {
          const cx = (sX[a]! * w00 + sX[b]! * w10 + sX[c]! * w01 + sX[d]! * w11) / mLocal;
          const cy = (sY[a]! * w00 + sY[b]! * w10 + sY[c]! * w01 + sY[d]! * w11) / mLocal;
          const dx = cx - x, dy = cy - y;
          // `sqrt` of the squares, not `Math.hypot` (2026-11-12): −12 % of this update, measured; values move at rounding
          // level only — `hypot` merely guards an overflow these pixel-scale distances cannot reach.
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1e-6) {
            // The deadband ramp: full push outside `band`, tapering linearly to 0 at the centroid itself.
            const ramp = dist < band ? dist / band : 1;
            const s = (speed * ramp) / dist;
            ux = dx * s; uy = dy * s;
          }
        }
      }
      let nx = ox[i]! * retain + ux * deposit;
      let ny = oy[i]! * retain + uy * deposit;
      // Invariant 12 — RESEED, do not clamp, and the reseed is to the mathematical position rather than to a
      // random one: a non-finite value here can only have come from a non-finite `positions` upstream, and
      // holding a NaN offset would take the particle out of the figure for the rest of the session.
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) { nx = 0; ny = 0; }
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len > cap) { const k = cap / len; nx *= k; ny *= k; }
      ox[i] = nx; oy[i] = ny;
    }

    // ---- CLEAR: only the cells actually written, so the cost does not follow the grid's size -------------
    for (let k = 0; k < tn; k++) { const ci = T[k]!; m[ci] = 0; sX[ci] = 0; sY[ci] = 0; }
  }

  /**
   * The requested radius, raised if and only if the grid it implies would exceed `MAX_CELLS`.
   *
   * Solved rather than iterated: cells are `(W/r + k)(H/r + k)` with `k = 2·MARGIN + 1`, so the smallest
   * admissible `r` is the positive root of `k²r² + k(W+H)r + WH − CAP·r² = 0`. A loop halving the radius
   * would overshoot to the next power of two and cost more degradation than the cap requires.
   *
   * ⚠️ `k` is taken **one larger** here than the apron `ensure()` adds, because `ensure()` takes the CEILING
   * of each axis's cell count. Solving against the exact quotient would leave the real grid up to one row and
   * one column over the cap — a bound that is nearly right is not a bound.
   */
  private resolveRadius(width: number, height: number, radius: number): number {
    const w = Math.max(1, width), h = Math.max(1, height);
    const k = 2 * CohesionField.MARGIN + 2;
    const cells = (w / radius + k) * (h / radius + k);
    if (cells <= CohesionField.MAX_CELLS) return radius;
    const a = k * k - CohesionField.MAX_CELLS;
    const b = k * (w + h);
    const c = w * h;
    // `a` is negative for any usable cap (k² is 25), so the root is the `−` branch of the quadratic formula.
    const root = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    return Math.max(radius, root);
  }

  /**
   * Allocate on a SIZE CHANGE only — never per frame (invariant 8).
   *
   * The grid is keyed on its cell COUNT, which is a function of the canvas size AND the radius — the pitch
   * IS the radius, so a radius slider drag rebuilds too (121 log-track stops between 4 and 64 px walk the
   * cell count over two orders of magnitude). No pitch is cached: the grid holds no pitch-dependent content
   * across frames, being fully cleared at the end of every `update()`, so only its SIZE has to track.
   */
  private ensure(count: number, width: number, height: number, radius: number): void {
    if (count !== this.count) this.resize(count);
    if (this.touched.length < count * 4) this.touched = new Int32Array(count * 4);
    const apron = 2 * CohesionField.MARGIN + 1;
    const gw = Math.ceil(Math.max(1, width) / radius) + apron;
    const gh = Math.ceil(Math.max(1, height) / radius) + apron;
    if (gw === this.gridW && gh === this.gridH) return;
    this.gridW = gw;
    this.gridH = gh;
    const cells = gw * gh;
    this.mass = new Float32Array(cells);
    this.sumX = new Float32Array(cells);
    this.sumY = new Float32Array(cells);
  }

  /**
   * Re-size the per-particle offsets, PRESERVING them — `FireProcessor.resize()`'s contract and for the same
   * reason: these are integrated state, so reallocating to zeros on every step of a Particle Number drag
   * would snap the whole population off its drops at once rather than only the slots that appeared.
   */
  resize(particleCount: number): void {
    const next = Math.max(0, Math.floor(particleCount));
    if (next === this.count && this.offsetX.length === next) return;
    const carry = (src: Float32Array): Float32Array => {
      const out = new Float32Array(next);
      out.set(src.length <= next ? src : src.subarray(0, next));
      return out;
    };
    this.offsetX = carry(this.offsetX);
    this.offsetY = carry(this.offsetY);
    this.count = next;
  }

  /** Drop every accumulated displacement, so disabling the feature restores the pre-feature figure exactly. */
  reset(): void {
    this.offsetX.fill(0);
    this.offsetY.fill(0);
    // The banked step goes with them: `setCohesionConfig` calls this when strength reaches 0, and a re-enable
    // that inherited a nearly-full accumulator would integrate its first frame at up to 33 ms instead of one.
    this.pendingDt = 0;
  }

  dispose(): void {
    this.offsetX = new Float32Array(0);
    this.offsetY = new Float32Array(0);
    this.mass = new Float32Array(0);
    this.sumX = new Float32Array(0);
    this.sumY = new Float32Array(0);
    this.touched = new Int32Array(0);
    this.gridW = 0;
    this.gridH = 0;
    this.count = 0;
    this.pendingDt = 0;
  }
}
