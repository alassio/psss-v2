import type { CrystalRenderConfig, CrystalBirthRule } from '../presets/types.ts';
import { SpatialHash, type SpatialHashFilter } from './spatial-hash.ts';
import { MAX_GROWTH_CEILING, crystalSizeFor } from './crystal-config.ts';
import { CULL_SENTINEL } from '../core/projection.ts';

/**
 * v8 Phase 8a-3 — ADDITIVE crystal pool.
 *
 * ## Why this file exists
 *
 * Phase 8a/8a-2 made freezing **destructive**: `frozen[i] = 1` took wave particle `i` out of the
 * wave evaluation and pinned it. Because a preset has a FIXED particle count, every crystal was a
 * particle SUBTRACTED from the figure — freeze 30% and 30% of the figure is gone, as holes and
 * contiguous arc gaps exactly at the curve's cusps (which is where `birthRule: 'slow'` nucleates).
 * That was rejected on sight.
 *
 * Freezing is now **BIRTH, not conversion**, mirroring `SparkPool`
 * (`src/generators/spark-pool.ts`): this pool owns its own arrays, and its active slots are
 * CONCATENATED onto the wave particles by `LissajousGenerator.getState()`. The source wave particle
 * is **never** modified — nucleation only READS its model-space position and velocity direction.
 * The figure always renders its full particle count. No holes, ever.
 *
 * ## Canonical slot order
 *
 * `[wave][sparks][liquid][crystals]` — crystals occupy the HIGHEST indices of the concatenated
 * arrays. This ordering is assumed by every accessor here and must be applied consistently at the
 * concat site; mixing crystal and spark blocks is silent and invisible by eye.
 *
 * ⚠️ v8 15.5 inserted a fourth block (the liquid pool) BEFORE the crystals rather than after them,
 * and nothing here changed as a result — which is the whole reason it went in at that position.
 * `crystalCount` is published as a TRAILING-block length, so every consumer excludes crystals as
 * `count - crystalCount`; appending the pool would have made that expression name the pool instead,
 * and the crystals would have been drawn twice while the pool was drawn not at all. **Crystals must
 * stay last.** A future block goes before them too.
 *
 * ## The one place this must NOT copy SparkPool
 *
 * Sparks live in SCREEN space with their own Newtonian physics. Crystals must stay ATTACHED to the
 * figure, so each slot holds a **MODEL-space** position and is pushed through the same
 * rotate → perspective-project maths as wave particles every frame (`project()`), reusing the
 * generator's already-advanced angle state. That is what makes a crystal rotate with the figure,
 * scale with perspective and receive a REAL depth for the crystal pass's back-to-front sort.
 * Padding crystal depths to a constant (as sparks are padded to 0.5) silently destroys that sort.
 *
 * Also unlike `SparkPool`: slots are **STABLE**. SparkPool compacts with swap-with-last, so a slot
 * index does not survive a frame; the lifecycle's derived-phase model needs an index to keep its
 * identity, and the neon/ribbon histories are keyed by slot index. Dead slots are marked by
 * `alive[i] === 0` and recycled through a free-list.
 *
 * ## Lifecycle ownership
 *
 * This class **absorbed** the former `src/crystal/crystal-lifecycle.ts` in full — the four-phase
 * state machine, jittered lifetimes, the 64-bucket histogram percentile, the three birth rules,
 * budgeted nucleation, the soft cap and early melt-on-heat all live here now, over POOL SLOTS.
 * That file was deleted when this pool was wired in; the two must never both own this state.
 *
 * ## Growth (increment c)
 *
 * Accretion is a SECOND birth path (`accrete()`), sitting between `advance()` and `nucleate()`, and
 * swelling is a third branch of the phase machine (Solid grows `growth` past 1 toward `maxGrowth`).
 * Both are gated on `config.growthEnabled`, which defaults to false: with it off the spatial hash is
 * never even constructed, so the added per-frame cost is one boolean test.
 */

/** Histogram resolution for the percentile birth rules (RF-08b / D-05). */
const BUCKETS = 64;

/**
 * Overshoot margin on `freezeCap`. `freezeCap` is a SOFT target: nucleation halts above
 * `freezeCap * CAP_OVERSHOOT` while melting stays UNCONDITIONAL, so the population is bounded
 * above and self-corrects back toward the target. A hard clamp at exactly `freezeCap` deadlocks
 * the population and puts the image back to the Phase 8a still frame.
 *
 * NOTE the changed denominator: `freezeCap` is now a fraction of the POOL, not of the figure.
 */
const CAP_OVERSHOOT = 1.1;

/**
 * How many wave particles accretion probes per unit of `accretionBudget`, per frame.
 *
 * A full population scan is what the naive reading of T026 implies — "for each live particle, query
 * the hash" — and it is pure waste: `accretionBudget` caps the number of accretions anyway, so once
 * the budget is spent every remaining probe is thrown away. Measured (see `spatial-hash.ts`), a
 * 20 000-particle scan costs 4.5 ms/frame against 0.28 ms for 1 600 probes. At the default budget of
 * 8 this gives 1 600 probes, sampled from a random offset so no particle is structurally favoured.
 *
 * A sample rather than a scan does mean accretion can under-fill its budget on a frame where few
 * probes landed near a crystal. That is the right failure: growth is a rate, not a quota.
 */
const PROBES_PER_BUDGET = 200;

/**
 * Number of directional lobes for `growthAnisotropy` (T027). Six, because that is ice — the same
 * 6-fold grain the crystal fragment shader already quantises facets to, so the dendrite axes and the
 * facet orientation agree.
 *
 * This is a probability BIAS over a continuous direction, NOT a lattice: nothing is snapped to an
 * axis, and there is no symmetry folding. Both of those are Phase 8b.1.
 */
const ANISO_LOBES = 6;

/**
 * v8 Phase 8b.2 — minimum `growth` before a crystal exerts cluster force.
 *
 * 0.6, i.e. a crystal must be most of the way formed. Lower values let newborn ghosts push at full
 * strength from their first frame, which reads as jitter rather than as an obstacle; higher values
 * make the field lag visibly behind the ice the user can see.
 */
const FORCE_MIN_GROWTH = 0.6;

/**
 * Exponent scale for the anisotropy bias: the effective power is `ANISO_SHARPNESS * growthAnisotropy`,
 * so 0 is exactly isotropic and 1 is strongly directional.
 *
 * 8 is tuned, not arbitrary. Measured on a single seed with candidates on a uniform ring, binned into
 * 12 angular bins, the coefficient of variation across bins runs 0.13 (anisotropy 0, i.e. the
 * sampling noise floor) → 0.30 at the default 0.3 → 0.43 at 0.6 → 0.65 at 1.0, with the histogram
 * showing the expected alternating 6-fold pattern from the default upward. Much below 8 and the
 * default setting is indistinguishable from isotropic; much above and mid-slider positions are
 * already hard spokes, leaving most of the slider's travel doing nothing.
 */
const ANISO_SHARPNESS = 8;

/**
 * Floor on the in-plane factor of the anisotropy bias, so a deposit directly along Z is discouraged
 * rather than forbidden. A hard zero flattens every cluster into the XY plane, which destroys the
 * real per-crystal depth the crystal pass's back-to-front sort depends on.
 */
const PLANAR_FLOOR = 0.25;

/**
 * MINIMUM SEPARATION between a new deposit and the crystal it is accreting onto, as a fraction of
 * `accretionRadius`. A deposit closer than this is rejected outright.
 *
 * This is not a tuning knob, it is a correctness rule, and without it growth adds density instead of
 * EXTENT. Accretion places the new slot at the probing particle's own model position and the seed is
 * the NEAREST Solid crystal — which, because `srcIndex` records that the seed frequently nucleated
 * from this very particle, is very often the crystal the particle is standing inside. So the
 * most-likely separation is ~0, i.e. a bit-exact duplicate stacked on an existing hexagon.
 *
 * That is not hypothetical. On a preset whose geometry is fully static (every `Am.Amp`/`Fm.Amp` zero
 * — six shipped presets are, e.g. `Cylinder`, `Patterns`) `calcWaveParam` returns a constant, so
 * `modelPos` is IEEE-identical every frame and every accretion lands exactly on its seed. And off
 * those presets, `birthRule: 'slow'` deliberately clusters crystals around the SLOWEST particles,
 * whose per-frame model displacement is a tiny fraction of the radius. Both cases spend the whole
 * `accretionBudget` on invisible duplicates: no dendrite can form, `growthAnisotropy` becomes a dead
 * control, and the stacked alpha-composited hexagons drive themselves to full opacity regardless of
 * the user's Ice Opacity setting.
 *
 * 0.35 rejects only the inner 4.3% of the sphere's volume, so the accretion opportunity is
 * essentially unchanged while stacking is structurally impossible.
 */
const MIN_SEPARATION_FRAC = 0.35;

/**
 * How close two NUCLEATED crystals may sit, as a fraction of their own DRAWN radius.
 *
 * Nucleation had no separation test at all before this — `MIN_SEPARATION_FRAC` guarded only
 * `accrete()`. Newborn crystals could land arbitrarily close, or exactly on top of one another, and
 * this file already records what that looks like for the accretion case: "stacked hexagons are
 * invisible individually while driving themselves to full opacity". Reported as a white-out in which
 * individual crystals could no longer be told apart.
 *
 * 0.55 lets crystals touch and slightly overlap — a frost bed should look connected, not like evenly
 * spaced dots — while making a full stack impossible.
 *
 * ⚠️ **UNITS: this must be converted from PIXELS to MODEL units before use.** `crystalSize` is in
 * pixels; the pool stores authored model-space positions and `figScale` is applied only at projection
 * (9.0 on `Miracle Frost` from its 80x80 design box, 7.2 from a 100x100 one). Comparing a pixel
 * radius against model distances over-rejects by exactly that factor — measured, it collapsed the
 * population from 640 crystals to 69. See `nucleate()` for the conversion.
 *
 * Not user-facing: `nucleationBudget` and `freezeCap` remain the density controls. This only removes
 * the degenerate stacked case.
 */
const NUCLEATION_SEPARATION_FRAC = 0.55;

/**
 * How much of the sticking probability the HOTTEST particle in the population loses (T026's
 * "cold sticks more readily"). 0.8, not 1.0: a hard cutoff makes accretion read as broken the moment
 * a material is enabled, because the hot end of the population would become permanently ineligible.
 */
const HEAT_STICK_PENALTY = 0.8;

/** Pool capacity bounds — mirrors the spark pool slider range. */
export const MIN_CRYSTAL_POOL = 50;
export const MAX_CRYSTAL_POOL = 2000;
export const DEFAULT_CRYSTAL_POOL = 600;

/**
 * Crystals take their colour from `crystalRampTexture` inside the crystal pass, so `state.colors`
 * is never read for their appearance. A pale ice tint is published per slot anyway so that the
 * concatenated `colors` array is valid in range for every slot — today `state.colors` is left at
 * `particleCount * 3` while `state.count` is larger, and several consumers index past its end.
 * Storing this as a constant rather than a per-slot array keeps 24 KB of identical values out of
 * the pool.
 */
export const CRYSTAL_BASE_COLOUR: readonly [number, number, number] = [0.72, 0.85, 1.0];

/**
 * The generator's per-frame projection state, hoisted once and shared. Passed as a plain object
 * literal so `src/generators/` needs no type import from `src/crystal/` — the whole of
 * `src/crystal/` stays deletable in one step (D-11 / removal recipe).
 *
 * All six trig values are of `angle[a] / DEG` and must be the SAME ones the wave particles used
 * this frame: the pool projects AFTER the generator has advanced `angle`, and must not advance it
 * again.
 */
export interface CrystalProjection {
  sinWx: number;
  cosWx: number;
  sinWy: number;
  cosWy: number;
  sinWz: number;
  cosWz: number;
  originX: number;
  originY: number;
  perspZ: number;
  /**
   * Figure scale (uniform canvas fit x the user's Figure Scale slider), applied BEFORE the rotation.
   *
   * Must be the SAME value the wave loop uses. Crystals store MODEL-space positions in authored units,
   * exactly like the wave amplitudes, so if this were omitted (or stale) the ice would sit at a
   * different scale from the figure it grew out of and visibly detach from it.
   */
  figScale: number;
}

/**
 * Everything one frame of pool work needs. Also passed as an object literal, for the same
 * deletability reason.
 *
 * Must be supplied from inside `LissajousGenerator.update()` at the point the old
 * `crystalLifecycle.update()` call sat: after `velocities[]` has been normalised, after the
 * material processor has refreshed `temperatures[]`, and while `modelPos` still holds this frame's
 * model space.
 */
export interface CrystalUpdateInput {
  /** Frame delta in MILLISECONDS (same contract as `MaterialProcessor.update`). */
  dt: number;
  /** `null` or `enabled: false` ⇒ this update does nothing and allocates nothing. */
  config: CrystalRenderConfig | null;
  /** Number of WAVE particles. Nucleation candidates are wave particles; slots are separate. */
  waveCount: number;
  /**
   * Per-wave-particle speed, ALREADY normalised to 0–1 against the preset's own 95th percentile
   * via `velRefEMA` — so `slow` is inherently preset-relative and must not be re-normalised.
   */
  velocities: Float32Array;
  /** Per-wave-particle heat 0–1, or `null` when no material is active. */
  temperatures: Float32Array | null;
  /** Pre-rotation model-space snapshot of the wave particles, stride 3. */
  modelPos: Float32Array;
  /** False until the generator has taken its first `modelPos` snapshot. */
  modelPosReady: boolean;
  /** Per-wave-particle EMA-smoothed velocity direction, stride 2. */
  velocityDirs: Float32Array;
  projection: CrystalProjection;
}

/**
 * The pool's contribution to `GeneratorState`, shaped for concatenation and mirroring
 * `SparkPool.getActiveState()`. COMPACTED: only live slots, so the crystal block of the
 * concatenated arrays is dense and `frozen` is 1 across exactly `[waveCount + sparkCount, count)`.
 */
export interface CrystalPoolState {
  count: number;
  /** stride 3 — SCREEN x, SCREEN y, POST-ROTATION z (same layout as wave particles). */
  positions: Float32Array;
  /** REAL per-crystal depth in [0,1], larger = further. Never a constant: the crystal pass sorts on it. */
  depths: Float32Array;
  /** Always 0 — a crystal is not moving relative to the figure, and must not grow velocity streaks. */
  velocities: Float32Array;
  /** stride 2 — velocity direction captured AT BIRTH; the shader quantises facet grain from it. */
  velocityDirs: Float32Array;
  /** Always 0 — ice is cold, and the crystal pass binds a zero temperature buffer anyway. */
  temperatures: Float32Array;
  /** stride 3 — `CRYSTAL_BASE_COLOUR` per slot. */
  colors: Float32Array;
  /** 0 → 1 nucleating, 1 solid, 1 → 0 melting. Drives BOTH hexagon radius and alpha. */
  growth: Float32Array;
}

const EMPTY_STATE: CrystalPoolState = {
  count: 0,
  positions: new Float32Array(0),
  depths: new Float32Array(0),
  velocities: new Float32Array(0),
  velocityDirs: new Float32Array(0),
  temperatures: new Float32Array(0),
  colors: new Float32Array(0),
  growth: new Float32Array(0),
};

export class CrystalPool {
  // ---- slot state (all length `capacity`) --------------------------------------------------

  /** 1 = this slot holds a crystal. Slot indices are STABLE across frames. */
  private alive = new Uint8Array(0);

  /** MODEL-space birth position — the whole reason a crystal rotates with the figure. */
  private mx = new Float32Array(0);
  private my = new Float32Array(0);
  private mz = new Float32Array(0);

  /** Per-frame projection output: screen x, screen y, post-rotation z, normalised depth. */
  private sx = new Float32Array(0);
  private sy = new Float32Array(0);
  private sz = new Float32Array(0);
  private depth = new Float32Array(0);

  /** Velocity direction at birth (facet specular orientation). Never re-derived. */
  private vdx = new Float32Array(0);
  private vdy = new Float32Array(0);

  /** The lifecycle triple. `growth` is the single scalar behind fade-in and fade-out. */
  private growth = new Float32Array(0);
  private age = new Float32Array(0);
  private life = new Float32Array(0);

  /**
   * Wave particle this crystal nucleated from, or -1. Used ONLY as the ambient-heat probe for
   * early melt: `temperatures[]` is wave-indexed, so once the slot index is its own space there is
   * no other way to ask "is it hot here". The source particle keeps flowing and repeatedly sweeps
   * back past the crystal's birth position, which makes it a serviceable proxy. When it is -1, or
   * when no material is active, early melt is simply skipped for that slot.
   */
  private srcIndex = new Int32Array(0);

  /** Monotonic birth ticket, for exact FIFO-oldest eviction. */
  private birthSeq = new Float64Array(0);

  private capacity = 0;
  private activeCount = 0;
  private seq = 0;

  /** Dead-slot stack: O(1) allocation without scanning. */
  private freeList = new Int32Array(0);
  private freeTop = 0;

  /** Scratch histogram — reused every frame so percentile selection allocates nothing. */
  private readonly buckets = new Int32Array(BUCKETS);

  /**
   * Publication scratch for `getActiveState()`, capacity-sized and reused across frames so publishing
   * allocates nothing. Two of them are never written and stay all-zero by construction
   * (`pubVelocities`, `pubTemperatures`) — that IS their contract, so they must not be filled with
   * anything else. The rest are overwritten over `[0, count)` on every call; the caller copies only
   * that range, so slots above it may hold values from a previous, larger frame.
   */
  private pubPositions = new Float32Array(0);
  private pubDepths = new Float32Array(0);
  private pubVelocities = new Float32Array(0);
  private pubVelocityDirs = new Float32Array(0);
  private pubTemperatures = new Float32Array(0);
  private pubColors = new Float32Array(0);
  private pubGrowth = new Float32Array(0);

  /**
   * Per-frame min and span of the wave population's temperatures, recomputed in `advance()`.
   * Early melt compares relative heat because raw `MaterialProcessor` temperatures saturate at 1.0
   * for nearly every particle. `heatRange === 0` means "degenerate or absent" and disables the check.
   */
  private heatFloor = 0;
  private heatRange = 0;

  /**
   * Increment (c) — neighbour index over LIVE SOLID slots' model positions, for accretion.
   *
   * Constructed LAZILY on the first frame growth is actually enabled, and that laziness is the whole
   * inertness gate: with `growthEnabled: false` this stays null, so nothing is allocated, nothing is
   * rebuilt and nothing is queried. Never indexes the WAVE arrays — the proximity question is "is a
   * crystal near this particle", and only the crystal side is small enough to index.
   */
  private hash: SpatialHash | null = null;

  /**
   * The hash's `include` predicate, allocated ONCE. A fresh closure per frame would put one
   * allocation per frame in front of the GC for no reason; `rebuild` calls it once per slot.
   *
   * Indexes every NON-MELTING live crystal, and the Solid test is then applied per HIT inside
   * `accrete()` instead of here. That split is deliberate, because the two questions accretion asks
   * of its neighbourhood have DIFFERENT eligibility rules:
   *
   * - *"what do I grow from?"* — only a SOLID crystal (`growth >= 1`) may be a seed; one still
   *   forming has not finished, so it should not yet be recruiting.
   * - *"is this spot already taken?"* — ANY live crystal occupies space, including one that is still
   *   nucleating.
   *
   * Indexing only Solid crystals (the previous behaviour) answers the first question but makes the
   * second one blind for the whole `nucleationTime` fade-in: a fresh deposit is invisible to the
   * minimum-separation test, so a particle sitting still re-deposits onto the same spot every frame
   * until the first one matures — measured, 231 bit-exact coincident deposits over 600 frames on a
   * static-geometry preset even WITH the separation reject in place.
   *
   * A melting crystal (`age >= life`) is excluded from both: it is on its way out, so it should
   * neither seed nor block.
   */
  private readonly liveFilter: SpatialHashFilter = (i: number): boolean =>
    this.alive[i] === 1 && this.age[i]! < this.life[i]!;

  /**
   * v8 Phase 8b.2 — which crystals exert cluster force.
   *
   * Stricter than `liveFilter`: also requires `growth >= FORCE_MIN_GROWTH`, so a crystal only starts
   * pushing once it has substantially formed. Without the growth test the field would flicker in
   * lockstep with nucleation and melting — every newborn ghost would shove particles at full strength
   * from its first frame, which reads as random jitter rather than an obstacle.
   */
  private readonly forceFilter: SpatialHashFilter = (i: number): boolean =>
    this.alive[i] === 1 && this.age[i]! < this.life[i]! && this.growth[i]! >= FORCE_MIN_GROWTH;

  /** Lazily create the shared spatial index. Nothing is allocated until a feature needs it. */
  private ensureHash(): SpatialHash {
    if (this.hash === null) this.hash = new SpatialHash();
    return this.hash;
  }

  // ---- capacity -----------------------------------------------------------------------------

  getCapacity(): number {
    return this.capacity;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Population as a fraction of the POOL (Rico's decision 2) — NOT of the figure, which is the
   * denominator Phase 8a used. `freezeCap` is compared against this.
   */
  getFrozenFraction(): number {
    return this.capacity > 0 ? this.activeCount / this.capacity : 0;
  }

  /**
   * v8 Phase 8b.2 — cluster force field.
   *
   * Accumulate this frame's cluster-derived displacement for every live wave particle into
   * `outX`/`outY`, in MODEL space. The caller owns the persistent offset arrays and the return
   * force; this method only reports the instantaneous push.
   *
   * `force` is signed: negative deflects particles AROUND the ice (obstacle), positive draws them
   * TOWARD it (accretion bias). Magnitude scales the push.
   *
   * Uses its OWN hash rebuild rather than sharing accretion's, because the two want different cell
   * sizes (`accretionRadius` vs `clusterForceRadius`) and because the force must work with
   * `growthEnabled: false`, where accretion never runs and its hash is never built.
   *
   * Cost: one rebuild plus one `queryRadius` per particle. `spatial-hash.ts` measures 20 000 queries
   * (a 4 000-particle preset) at 4.5 ms, so this is gated on `force !== 0` and skipped entirely when
   * off.
   *
   * @returns true if any displacement was written
   */
  sampleClusterForce(
    count: number,
    px: Float32Array,
    py: Float32Array,
    pz: Float32Array,
    config: CrystalRenderConfig,
    outX: Float32Array,
    outY: Float32Array,
    /**
     * Scales this frame's push so the offset recurrence's STEADY STATE is frame-time independent.
     *
     * The caller applies `offset *= retain` before calling and adds our push after, i.e.
     * `offset = offset * retain + push`, whose settled amplitude is `push / (1 - retain)`. `retain`
     * is dt-dependent, so a fixed per-frame push makes the amplitude vary with frame time — and
     * because every particle scales by the same factor, the whole figure breathes on ordinary rAF
     * jitter (measured ~53 % swing at `clusterForceReturn` 1.5). 1.0 reproduces 60 fps behaviour.
     */
    depositScale = 1,
  ): boolean {
    const force = config.clusterForce;
    if (!force || !Number.isFinite(force) || this.activeCount === 0) return false;

    const radius = Math.max(4, Math.min(120, config.clusterForceRadius));
    const hash = this.ensureHash();
    // Only SOLID-ish crystals exert force. A nucleating or melting crystal is a ghost; letting it
    // push particles would make the field flicker in step with the lifecycle.
    hash.rebuild(this.capacity, this.mx, this.my, this.mz, radius, this.forceFilter);
    if (hash.getItemCount() === 0) return false;

    const results = hash.getResults();
    const dist2 = hash.getResultDist2();
    // Peak displacement per frame, in model units. Deliberately modest: this is a supporting nudge
    // around a hard-edged primitive, not the primary visual output.
    //
    // NEGATED: the accumulator below sums directions pointing AWAY from each crystal, so a positive
    // `force` (accretion bias, "draw particles toward the ice") must invert them. Without this the
    // slider's two halves both pushed the same way — verified by a sign test before wiring.
    const strength = -force * radius * 0.10 * depositScale;
    let wrote = false;

    for (let i = 0; i < count; i++) {
      const x = px[i]!;
      const y = py[i]!;
      const z = pz[i]!;
      const n = hash.queryRadius(x, y, z, radius);
      if (n === 0) continue;

      // Weighted sum of directions away from each nearby crystal. Weight falls off smoothly to 0 at
      // the radius, so a particle crossing the influence boundary does not jolt.
      let ax = 0;
      let ay = 0;
      let wsum = 0;
      // Largest single-neighbour weight, which carries the distance falloff into the magnitude.
      let peak = 0;
      for (let k = 0; k < n; k++) {
        const s = results[k]!;
        const d2 = dist2[k]!;
        const d = Math.sqrt(d2);
        if (d < 1e-4) continue;
        const t = 1 - d / radius;
        if (t <= 0) continue;
        const w = t * t;
        ax += ((x - this.mx[s]!) / d) * w;
        ay += ((y - this.my[s]!) / d) * w;
        wsum += w;
        if (w > peak) peak = w;
      }
      if (wsum <= 0) continue;

      // Normalise the DIRECTION by total weight — not the magnitude. Dividing the whole accumulator
      // by `wsum` (the obvious form, and what this did first) cancels the distance falloff exactly:
      // one crystal at the far edge of the radius then pushes as hard as one right next to the
      // particle, and the force jumps discontinuously to zero at the boundary. Verified by sampling
      // across the radius before wiring.
      //
      // So: unit direction from the weighted sum, magnitude from `peak` = the largest single
      // neighbour weight, which preserves the smooth (1 - d/r)² ramp to zero at the boundary and
      // still cannot grow without bound in a dense cluster.
      const invLen = 1 / Math.sqrt(ax * ax + ay * ay);
      if (!Number.isFinite(invLen)) continue;
      const mag = peak * strength;
      outX[i]! += ax * invLen * mag;
      outY[i]! += ay * invLen * mag;
      wrote = true;
    }

    return wrote;
  }

  /**
   * Allocate or re-allocate to `requested` slots. Changing capacity DROPS every crystal — pool
   * contents are transient history, so that is correct, and it mirrors `SparkPool` being recreated
   * on a pool-size change.
   *
   * Compares against the stored capacity, deliberately not against `activeCount`
   * (`setSparkConfig` compares against `getActiveCount()`, which reallocates the spark pool almost
   * every frame — do not copy that).
   */
  private ensureCapacity(requested: number): void {
    let cap = Math.floor(requested);
    if (!Number.isFinite(cap)) cap = DEFAULT_CRYSTAL_POOL;
    if (cap < MIN_CRYSTAL_POOL) cap = MIN_CRYSTAL_POOL;
    else if (cap > MAX_CRYSTAL_POOL) cap = MAX_CRYSTAL_POOL;
    if (cap === this.capacity) return;

    this.capacity = cap;
    this.alive = new Uint8Array(cap);
    this.mx = new Float32Array(cap);
    this.my = new Float32Array(cap);
    this.mz = new Float32Array(cap);
    this.sx = new Float32Array(cap);
    this.sy = new Float32Array(cap);
    this.sz = new Float32Array(cap);
    this.depth = new Float32Array(cap);
    this.vdx = new Float32Array(cap);
    this.vdy = new Float32Array(cap);
    this.growth = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.srcIndex = new Int32Array(cap);
    this.birthSeq = new Float64Array(cap);
    this.freeList = new Int32Array(cap);
    this.activeCount = 0;
    this.seq = 0;
    this.rebuildFreeList();
    // Every slot just died with the old arrays; the index must not outlive them.
    this.hash?.clear();
  }

  private rebuildFreeList(): void {
    // Pushed in descending order so slots are handed out ascending — the first crystals of a run
    // land in low slots, which keeps the debug picture readable.
    this.freeTop = 0;
    for (let i = this.capacity - 1; i >= 0; i--) this.freeList[this.freeTop++] = i;
  }

  /**
   * Drop every crystal and all lifecycle history. Called on preset change: pool CONTENTS are
   * history, not parameters (D-09/RF-18), and are never serialised.
   */
  reset(): void {
    // The neighbour index describes which slots exist, so it must never survive a wipe of the slots
    // — a stale index would become a second source of truth and hand accretion dead seeds. Cleared
    // before the capacity guard so it is dropped even on an unallocated pool.
    this.hash?.clear();
    if (this.capacity === 0) return;
    this.alive.fill(0);
    this.growth.fill(0);
    this.age.fill(0);
    this.life.fill(0);
    this.srcIndex.fill(-1);
    this.birthSeq.fill(0);
    this.activeCount = 0;
    this.seq = 0;
    this.rebuildFreeList();
  }

  dispose(): void {
    this.alive = new Uint8Array(0);
    this.mx = new Float32Array(0);
    this.my = new Float32Array(0);
    this.mz = new Float32Array(0);
    this.sx = new Float32Array(0);
    this.sy = new Float32Array(0);
    this.sz = new Float32Array(0);
    this.depth = new Float32Array(0);
    this.vdx = new Float32Array(0);
    this.vdy = new Float32Array(0);
    this.growth = new Float32Array(0);
    this.age = new Float32Array(0);
    this.life = new Float32Array(0);
    this.srcIndex = new Int32Array(0);
    this.birthSeq = new Float64Array(0);
    this.freeList = new Int32Array(0);
    this.capacity = 0;
    this.activeCount = 0;
    this.freeTop = 0;
    this.seq = 0;
    this.hash?.dispose();
    this.hash = null;
  }

  // ---- frame --------------------------------------------------------------------------------

  /**
   * One frame of pool work: advance existing crystals, accrete onto them, nucleate new ones, then
   * project every live slot into screen space.
   *
   * Zero-cost-when-off: a null or disabled config returns before anything is allocated, so a build
   * with Crystal off never even sizes the pool. Nucleate-then-project means a crystal born this
   * frame is published with a valid screen position and growth already seeded — no one-frame
   * flicker.
   *
   * ## Why accretion sits between advance and nucleate
   *
   * - **After `advance()`**, because advance has just released every fully-melted slot and stepped
   *   `growth`, so the neighbour index it builds holds exactly this frame's live set and the Solid
   *   test is current. It also means the index cannot contain a slot born THIS frame, which is what
   *   stops a single frame chaining into runaway growth (a crystal accreted at the start of a frame
   *   would otherwise be a seed for the rest of it).
   * - **Before `project()`**, because `spawn()` parks a new slot at the `CULL_SENTINEL` / depth 0.5
   *   sentinel and only `project()` overwrites it. Accreting after projection would publish one frame of
   *   off-screen crystals with a fake depth, corrupting the crystal pass's back-to-front sort.
   * - **Before `nucleate()`**, which is a deliberate PRIORITY decision, not line-order accident.
   *   Both are birth paths competing for the same headroom under `freezeCap * 1.1`; whichever runs
   *   first gets it. Accretion first means that at cap you see existing clusters thickening and no
   *   new seeds — which is exactly the increment-(c) look. Reversed, accretion would starve behind a
   *   nucleation budget that refills every frame and growth would read as broken. `nucleate()` needs
   *   no change for this to be safe: it recomputes its headroom from `this.activeCount`, which
   *   accretion has already raised.
   */
  update(input: CrystalUpdateInput): void {
    const config = input.config;
    if (!config || !config.enabled) return;

    this.ensureCapacity(config.poolSize ?? DEFAULT_CRYSTAL_POOL);
    if (this.capacity === 0) return;

    const dtSec = input.dt / 1000;
    if (dtSec <= 0) return;

    // Hoisted out of advance() so accretion can read a VALID heat range on every frame, including
    // the first (advance() early-returns at activeCount 0) and whenever meltThreshold is 1 (advance()
    // skips it as unused). Reading a zeroed range as "everything is maximally cold" would make every
    // accretion candidate stick and saturate the pool in one frame.
    this.computeHeatRange(input.temperatures, input.waveCount, config);

    this.advance(dtSec, config, input.temperatures, input.waveCount);
    this.accrete(input, config);
    this.nucleate(input, config);
    this.project(input.projection);
  }

  /**
   * Per-frame min and span of the wave population's temperatures.
   *
   * Both consumers (early melt, and accretion's temperature modulation) compare RELATIVE heat,
   * because raw `MaterialProcessor` temperatures saturate: `temp = temp * coolFactor + heat`
   * converges to `heat / (1 - coolFactor)`, a ceiling above 1.0 for most presets, so nearly every
   * particle clamps at 1.0. Testing raw values makes both thresholds unreachable in the useful
   * direction.
   *
   * `heatRange === 0` is the explicit "degenerate or absent" signal and DISABLES both consumers
   * rather than making everything read as cold.
   */
  private computeHeatRange(
    temperatures: Float32Array | null,
    waveCount: number,
    config: CrystalRenderConfig,
  ): void {
    this.heatFloor = 0;
    this.heatRange = 0;
    if (!temperatures || waveCount <= 0) return;

    // Only worth the O(N) pass when a consumer could actually fire.
    const meltWants = config.meltThreshold < 1;
    const growthWants = config.growthEnabled === true;
    if (!meltWants && !growthWants) return;

    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < waveCount; i++) {
      const t = temperatures[i] ?? 0;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    if (hi > lo) {
      this.heatFloor = lo;
      this.heatRange = hi - lo;
    }
  }

  // ---- phase advance ------------------------------------------------------------------------

  /**
   * The four-phase state machine, one O(capacity) pass over slots. The phase is DERIVED, never
   * stored:
   *
   * ```
   * alive === 0                 → Released   (slot is free)
   * age >= lifetime             → Melting    (growth → 0, then released)
   * growth < 1                  → Nucleating (growth 0 → 1)
   * otherwise                   → Solid      (growth 1 → maxGrowth, swelling)
   * ```
   *
   * Melting is checked FIRST and is never gated on the population cap: that is what makes the soft
   * cap self-correcting instead of a deadlock. Note the ORDER also settles T030's ambiguity: a
   * swollen crystal has `growth > 1`, so it falls through the `growth < 1` nucleating test and stays
   * Solid — swelling can never be mistaken for forming.
   */
  private advance(
    dtSec: number,
    config: CrystalRenderConfig,
    temperatures: Float32Array | null,
    waveCount: number,
  ): void {
    if (this.activeCount <= 0) return;

    const nucTime = Math.max(0.01, config.nucleationTime);
    const meltTime = Math.max(0.01, config.meltTime);
    const nucRate = 1 / nucTime;
    const meltRate = 1 / meltTime;
    const meltThreshold = config.meltThreshold;
    const base = Math.max(0.1, config.crystalLifetime);
    const minLife = nucTime + meltTime;

    // T030 swelling. Only past 1.0 when growth is on: with it off the ceiling is exactly 1 and this
    // whole branch collapses to the previous "hold at 1" behaviour. Ceiling shared with the crystal
    // pass — see MAX_GROWTH_CEILING. Both sites clamped to a hardcoded 3 until 2026-08-06, which made
    // the top 60 % of the Max Growth slider inert.
    const swellCeiling = config.growthEnabled === true
      ? Math.max(1, Math.min(MAX_GROWTH_CEILING, config.maxGrowth))
      : 1;
    // Swell over the crystal's own SOLID span rather than at a fixed rate, so `maxGrowth` reads as a
    // shape ("how much bigger does it end up") independent of `crystalLifetime`. Approximated by the
    // nominal lifetime minus the fade-in, which is the same denominator for every slot — per-slot
    // jitter then makes each one arrive at its ceiling at a slightly different time, which is the
    // desired de-synchronisation and costs nothing.
    const solidSpan = Math.max(0.1, base - nucTime);
    const swellRate = (swellCeiling - 1) / solidSpan;

    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] !== 1) continue;

      // Safety net for a slot carrying no lifetime. `spawn()` always seeds one, so this cannot
      // happen through nucleation — it covers lifecycle arrays cleared without the alive flags.
      // Without it such a slot is instantly past its lifetime and melts on the next frame, which
      // reads as "crystals never form" and is expensive to diagnose.
      if (this.life[s]! <= 0) {
        this.life[s] = Math.max(minLife, base * (0.7 + Math.random() * 0.6));
        this.age[s] = 0;
        this.growth[s] = 0;
      }

      let a = this.age[s]! + dtSec;
      const lt = this.life[s]!;

      // Early melt on heat — the Fire-Ice duel: a crystal sitting in a hot region gives way.
      // Implemented by snapping the age forward to the melt boundary rather than storing a phase
      // flag, so the derivation above stays the only source of truth and the transition is
      // monotonic (a crystal never un-melts).
      //
      // Compared against the population's RELATIVE heat, not the raw temperature. `MaterialProcessor`
      // integrates `temp = temp * coolFactor + heat` every frame, which converges to
      // `heat / (1 - coolFactor)` — and for most presets that ceiling is far above 1, so temperatures
      // CLAMP AT 1.0 for essentially every particle. Ice is the extreme case: even the slowest
      // particle saturates, because the heat formula carries a 0.3 base floor. Testing the raw value
      // therefore made `meltThreshold` unreachable in the useful direction — every crystal was
      // force-melted on the frame after birth, so the population never grew beyond one frame's
      // nucleation budget and the feature read as "crystals never appear".
      if (temperatures && a < lt && meltThreshold < 1) {
        const src = this.srcIndex[s]!;
        if (src >= 0 && src < waveCount) {
          const rel = this.heatRange > 0 ? (temperatures[src]! - this.heatFloor) / this.heatRange : 0;
          if (rel > meltThreshold) a = lt;
        }
      }

      this.age[s] = a;

      let g = this.growth[s]!;

      if (a >= lt) {
        // --- Melting: growth → 0 from WHEREVER it reached, then Released ---
        // Deliberately not normalised by the swollen height: `meltTime` is the time to fade a
        // NOMINAL crystal away, and a swollen one taking proportionally longer to disappear is the
        // physically legible reading (more ice to melt). The rate is what is fixed, not the duration.
        g -= meltRate * dtSec;
        if (g <= 0) {
          this.release(s);
        } else {
          this.growth[s] = g;
        }
      } else if (g < 1) {
        // --- Nucleating: growth 0 → 1 over nucleationTime ---
        g += nucRate * dtSec;
        this.growth[s] = g > 1 ? 1 : g;
      } else if (g > swellCeiling) {
        // --- Solid, but ABOVE the current ceiling: ease back down to it. ---
        // Only reachable when the ceiling has just DROPPED under a live population — i.e. the user
        // lowered Max Growth, or switched Enable Growth off (which sets the ceiling to exactly 1).
        //
        // Without this branch the swollen value is simply stranded: nothing walks `growth` back down,
        // while the renderer's `uMaxGrowth` clamp drops to 1 on the same frame, so every swollen
        // crystal SNAPS from up to 3x to 1x in one frame. Worse, melting then subtracts a fixed rate
        // from 3.0 while the shader clamps the radius at 1.0, so a crystal renders at unchanged full
        // size for the first two thirds of its melt and only visibly shrinks in the last third —
        // roughly 2 s of a melting crystal that looks perfectly solid.
        //
        // Eased at the fade-in rate rather than snapped, so lowering the slider reads as the frost
        // receding. Clamped so it lands exactly on the ceiling and cannot undershoot into the
        // `g < 1` nucleating branch, which would make a solid crystal re-form.
        g -= nucRate * dtSec;
        this.growth[s] = g < swellCeiling ? swellCeiling : g;
      } else if (swellCeiling > 1) {
        // --- Solid + swelling (T030): growth 1 → maxGrowth. Reads as thickening frost, and works
        // with accretion disabled. Clamped at the ceiling, so a long-lived crystal plateaus rather
        // than growing without bound. ---
        g += swellRate * dtSec;
        this.growth[s] = g > swellCeiling ? swellCeiling : g;
      }
      // --- else Solid at the ceiling (or swelling off and already at 1): growth held. ---
    }
  }

  /** Return slot `s` to the free list and clear its lifecycle state. */
  private release(s: number): void {
    if (this.alive[s] !== 1) return;
    this.alive[s] = 0;
    this.growth[s] = 0;
    this.age[s] = 0;
    this.life[s] = 0;
    this.srcIndex[s] = -1;
    this.birthSeq[s] = 0;
    // Park the dead slot off-screen so a stale position can never be painted if some consumer
    // reads it without checking the mask.
    this.sx[s] = CULL_SENTINEL;
    this.sy[s] = CULL_SENTINEL;
    this.activeCount--;
    this.freeList[this.freeTop++] = s;
  }

  // ---- growth: accretion (increment c) ------------------------------------------------------

  /**
   * Nominal (pre-jitter) lifetime, and the floor the jitter may not go below.
   *
   * Shared by BOTH birth paths deliberately. A lifetime shorter than fade-in + fade-out would make a
   * crystal start melting before it finished forming; if accretion computed a different floor from
   * nucleation, that defect would come back on one path only and be near-impossible to see.
   */
  private lifetimeBase(config: CrystalRenderConfig): number {
    return Math.max(0.1, config.crystalLifetime);
  }

  private lifetimeFloor(config: CrystalRenderConfig): number {
    return Math.max(0.01, config.nucleationTime) + Math.max(0.01, config.meltTime);
  }

  /**
   * T026/T027/T029 — ACCRETION: the DLA rule, reused in model space.
   *
   * A live wave particle passing within `accretionRadius` of a SOLID crystal has a chance to deposit
   * a NEW crystal at its own model-space position. Three things this is not:
   *
   * - **It is not a conversion.** The wave particle is only READ (`spawnFrom`), exactly as nucleation
   *   reads it. It keeps flowing, undimmed, and may seed many accretions over its life — that is
   *   correct and must not be "fixed" with a per-particle used flag, which would put the
   *   holes-in-the-figure defect back.
   * - **It is not DLA's grid.** The dormant `dla-processor.ts` asks the same adjacency question
   *   against a 1024² SCREEN grid, which does not rotate with the figure and is precisely why v7
   *   growth looked detached. Only DLA's three *concepts* are reused: stochastic sticking,
   *   temperature modulation, anisotropy.
   * - **It is not a lattice.** `growthAnisotropy` biases a PROBABILITY by direction. Nothing snaps to
   *   an axis and there is no symmetry folding; both are Phase 8b.1.
   *
   * Cost is governed by the PROBE COUNT, not by the population: probing all ~20 000 particles of a
   * 4 000-particle preset costs 4.5 ms/frame while a `budget * PROBES_PER_BUDGET` sample costs
   * ~0.3 ms, and since the budget caps accretions anyway the extra probes buy nothing. The walk also
   * breaks the instant the budget is spent.
   */
  private accrete(input: CrystalUpdateInput, config: CrystalRenderConfig): void {
    // ---- inertness gate. Nothing above this line touched the hash, so with growth off there is no
    // allocation, no rebuild, no query — the added per-frame cost is this one boolean test. ----
    if (config.growthEnabled !== true) {
      // Drop a stale index if growth was just switched off mid-run, so it can never become a second
      // record of which slots exist. Cheap, and only when a hash was ever built.
      if (this.hash !== null && this.hash.getItemCount() > 0) this.hash.clear();
      return;
    }

    // Accretion needs something to accrete ONTO: with no live crystals there are no seeds, and this
    // is also the "growth enabled before the first nucleation" case.
    if (this.activeCount <= 0) return;

    const count = input.waveCount;
    if (count <= 0) return;

    // Same precondition as nucleate(): without a model-space snapshot there is nowhere to put a
    // crystal, and no space to measure proximity in.
    if (!input.modelPosReady) return;

    // Radius 0 is an explicit off position on the slider (the field's documented range starts at 0).
    const radius = Math.max(0, Math.min(40, config.accretionRadius));
    if (radius <= 0) return;

    // Sticking probability 0 likewise means "never".
    const stick = Math.max(0, Math.min(1, config.stickingProbability));
    if (stick <= 0) return;

    // ---- T029: the SAME soft cap as nucleation, applied to this path too. Melting stays
    // unconditional in advance(), so the population still self-corrects toward freezeCap. Without
    // this early-out accretion could push occupancy past freezeCap * 1.1 — melting is rate-limited
    // by meltTime while accretion is not, so the overshoot would not correct within a frame. ----
    const capFrac = Math.max(0, Math.min(1, config.freezeCap)) * CAP_OVERSHOOT;
    if (this.getFrozenFraction() > capFrac) return;

    // Headroom clamp for the same reason nucleate() has one: testing the cap only once before the
    // loop would let a single frame add the whole budget on top of an at-cap population, so the true
    // bound would be `cap + budget/capacity`.
    let headroom = Math.floor(capFrac * this.capacity) - this.activeCount;
    if (headroom <= 0) return;

    // Additionally clamped by the FREE LIST, which nucleation does not do.
    //
    // `capFrac` is `freezeCap * 1.1`, so at `freezeCap = 1.0` the headroom stays positive even with
    // every slot occupied — and `spawn()` cannot report that, because `acquireSlot()` falls back to
    // stealing the FIFO-oldest live crystal and returns a perfectly valid slot index. The stolen
    // crystal disappears mid-life with no melt ramp, which reads as flicker rather than as erosion.
    //
    // Nucleation alone essentially never reached that path (one budget of 8 per frame against a soft
    // cap of 0.6). Accretion is a second birth path that can drive occupancy to the ceiling and hold
    // it there, which makes it reachable, so this path declines to be the one that evicts: growth
    // yields to existing crystals rather than churning them. Melting still frees slots every frame,
    // so accretion resumes on its own.
    if (headroom > this.freeTop) headroom = this.freeTop;
    if (headroom <= 0) return;

    const budget = Math.min(headroom, Math.max(0, Math.floor(config.accretionBudget)));
    if (budget <= 0) return;

    // ---- neighbour index over LIVE SOLID slots, in MODEL space ----
    // Built here rather than in update() so the whole thing lives behind `growthEnabled`. Rebuilt
    // wholesale every frame by design: an incrementally-maintained index would be a second,
    // drift-prone record of the live set, and an O(N) rebuild over <=2000 slots costs ~0.04 ms.
    const hash = this.ensureHash();
    hash.rebuild(this.capacity, this.mx, this.my, this.mz, radius, this.liveFilter);
    if (hash.getItemCount() === 0) return; // crystals exist, but all are melting

    const aniso = Math.max(0, Math.min(1, config.growthAnisotropy));
    // 8b.1 lattice + symmetry. Read once per frame, not per candidate.
    const latSnap = Math.max(0, Math.min(1, config.latticeSnap ?? 0));
    const latCell = Math.max(2, Math.min(40, config.latticeCell ?? 10));
    const fold = config.symmetryFold === true;
    // Squared, so the separation test compares against the hash's squared distances directly and no
    // per-candidate sqrt is paid.
    const minSep = radius * MIN_SEPARATION_FRAC;
    const minSep2 = minSep * minSep;
    const temps = input.temperatures;
    // heatRange === 0 means "degenerate or absent" — see computeHeatRange(). Treated as MODULATION
    // OFF, never as "everything is cold": the latter would make every candidate stick and saturate
    // the pool in a single frame.
    const useHeat = temps !== null && this.heatRange > 0;
    const heatFloor = this.heatFloor;
    const invHeatRange = useHeat ? 1 / this.heatRange : 0;

    const base = this.lifetimeBase(config);
    const minLife = this.lifetimeFloor(config);

    const modelPos = input.modelPos;
    const results = hash.getResults();
    const dist2 = hash.getResultDist2();

    // Bounded random SAMPLE of the population, walked from a random offset so the same low-index
    // particles are not always the ones tested (particle index maps directly to arc position, so a
    // fixed start would grow clusters at one place on the curve).
    const probes = Math.min(count, budget * PROBES_PER_BUDGET);
    const start = (Math.random() * count) | 0;

    let accreted = 0;
    for (let p = 0; p < probes && accreted < budget; p++) {
      const i = (start + p) % count;
      const m = i * 3;
      const x = modelPos[m] ?? 0;
      const y = modelPos[m + 1] ?? 0;
      const z = modelPos[m + 2] ?? 0;

      const hits = hash.queryRadius(x, y, z, radius);
      if (hits === 0) continue;

      // One walk over the hits answers both of accretion's neighbourhood questions, which have
      // different eligibility rules (see `liveFilter`):
      //
      //  - `nearestAny`  — distance to the closest LIVE crystal of any phase. This is the OCCUPANCY
      //                    test: anything already there blocks a new deposit, including a crystal
      //                    still fading in.
      //  - `seed`        — the nearest SOLID crystal, which is what the deposit grows FROM. Nearest
      //                    rather than first-found so the anisotropy axis is measured from the crystal
      //                    the particle is actually touching, which is what makes a dendrite extend
      //                    from its own tip instead of from an arbitrary cluster member.
      let nearestAny2 = Infinity;
      let seed = -1;
      let bestD2 = Infinity;
      for (let k = 0; k < hits; k++) {
        const d = dist2[k] ?? 0;
        if (d < nearestAny2) nearestAny2 = d;
        const cand = results[k] ?? -1;
        if (cand < 0) continue;
        // Solid = finished forming. Swollen crystals (growth > 1, T030) are Solid too, hence `>= 1`.
        if (this.growth[cand]! < 1) continue;
        if (d < bestD2) {
          bestD2 = d;
          seed = cand;
        }
      }

      // ---- MINIMUM SEPARATION: growth must add EXTENT, not density ----
      // Tested against the nearest crystal of ANY phase, not against the seed. The new slot goes at
      // this particle's own position, so without this the single most likely deposit is one stacked
      // exactly on top of an existing hexagon — invisible, budget-consuming and self-opacifying.
      // See MIN_SEPARATION_FRAC.
      if (nearestAny2 < minSep2) continue;

      // No Solid crystal in range: the neighbourhood is all still forming, so there is nothing to
      // grow from yet. Checked AFTER the occupancy reject so a blocked spot is never also counted as
      // a missing seed.
      if (seed < 0) continue;

      let prob = stick;

      // ---- T026: temperature modulation — cold sticks more readily ----
      // RELATIVE heat against the population's own per-frame min/max, because raw temperatures
      // saturate at 1.0 on most presets (see computeHeatRange). The hottest particle keeps
      // `1 - HEAT_PENALTY` of its chance rather than zero: a hard cutoff makes the whole effect read
      // as "accretion stopped working" the moment a material is switched on.
      if (useHeat) {
        const rel = (temps![i]! - heatFloor) * invHeatRange;
        const r = rel < 0 ? 0 : rel > 1 ? 1 : rel;
        prob *= 1 - HEAT_STICK_PENALTY * r;
      }

      // ---- T027: 6-fold directional bias — dendrites, not blobs ----
      // No `bestD2 > 0` guard is needed any more: the minimum-separation reject above guarantees
      // `bestD2 >= minSep2 > 0`, so `dist` is non-zero and the direction is real rather than the
      // direction of floating-point noise. (The old guard SKIPPED the bias in exactly the degenerate
      // case, which made a coincident deposit the most-favoured outcome of all.)
      if (aniso > 0) {
        const dx = x - this.mx[seed]!;
        const dy = y - this.my[seed]!;
        // No `dz` term: the full 3D length is already `sqrt(bestD2)` from the hash, and the lobe
        // construction itself is an XY-plane one.
        const dist = Math.sqrt(bestD2);
        // In-plane share of the direction. Growth straight along Z has a meaningless XY angle, so
        // without this factor the six lobes would be six infinite SHEETS rather than six arms.
        // Floored at PLANAR_FLOOR so a Z-ward deposit is discouraged, never forbidden — a hard zero
        // would flatten every cluster into the XY plane and lose the depth the crystal pass sorts on.
        const planar = Math.sqrt(dx * dx + dy * dy) / dist;
        // 1 at each of the six lobe axes, 0 exactly between them. Six because that is ice, and
        // because it agrees with the 60-degree facet grain the crystal shader already quantises to.
        const theta = Math.atan2(dy, dx);
        const lobe = 0.5 * (1 + Math.cos(ANISO_LOBES * theta));
        const align = lobe * (PLANAR_FLOOR + (1 - PLANAR_FLOOR) * planar);
        // A POWER LAW, not a lerp toward the bias.
        //
        // The lerp form (`prob *= 1 - aniso + aniso * align`) was tried first and is too weak to be
        // usable: at the default 0.3 it leaves the least-favoured direction with 70% of the chance of
        // the most-favoured, which is below the sampling noise floor of a real cluster — measured, the
        // angular histogram was indistinguishable from isotropic until anisotropy was pushed past
        // ~0.9. The exponent form gives a visible 6-fold structure at 0.3 while staying EXACTLY
        // isotropic at 0 (`pow(align, 0) === 1`, and the whole branch is skipped anyway).
        prob *= Math.pow(align, ANISO_SHARPNESS * aniso);
      }

      if (Math.random() >= prob) continue;

      // T028 is satisfied HERE, by spawn() itself: it assigns an independent jittered lifetime, a
      // fresh age-0 clock and growth 0, for every birth path. That is what makes a cluster erode from
      // its EDGES with no parent/child tracking — deliberately no `parentSeed[]` (D-07). Passing the
      // shared base/minLife helpers is the only obligation on this call site.
      //
      // 8b.1: the deposit position may be snapped to a hex lattice, and may then be mirrored into the
      // other five sectors. Both are relative to the SEED, which is the cluster's local origin — the
      // lattice is anchored in absolute model space (so neighbouring clusters share one grid) while
      // the fold is anchored on the seed (so each cluster is its own snowflake).
      let depX = x;
      let depY = y;
      if (latSnap > 0) {
        const snapped = this.snapToHexLattice(depX, depY, latCell, latSnap);
        depX = snapped[0];
        depY = snapped[1];
        // A snap can land the deposit on top of an existing crystal even though the pre-snap position
        // passed the separation test. Re-check, or the lattice quietly reintroduces the stacking that
        // MIN_SEPARATION_FRAC exists to prevent.
        if (this.occupiedNear(depX, depY, minSep2)) continue;
      }

      if (this.spawnAt(input, i, depX, depY, base, minLife) < 0) break; // pool truly exhausted
      accreted++;

      if (fold) {
        // Each fold spends up to 5 more slots. Counted against the budget so `accretionBudget` stays
        // a real per-frame bound rather than being silently multiplied by six.
        accreted += this.foldDeposit(
          input, i, this.mx[seed]!, this.my[seed]!, depX, depY, base, minLife,
        );
      }
    }
  }

  // ---- birth --------------------------------------------------------------------------------

  /**
   * Apply the birth rule, budget-limited per frame.
   *
   * Candidates are ALL wave particles. Under the destructive design frozen particles had to be
   * filtered out of both the histogram and the selection walk; nothing is frozen any more, so
   * those filters are gone — which is also why `selectByPercentile` no longer takes a mask.
   *
   * The chosen particle is only READ. It keeps flowing, undimmed and unmodified.
   */
  private nucleate(input: CrystalUpdateInput, config: CrystalRenderConfig): void {
    const count = input.waveCount;
    if (count <= 0) return;

    // Global precondition: without a model-space snapshot there is nowhere to put a crystal.
    // Checked once here rather than per candidate, so a full pool (which is recoverable via FIFO
    // eviction) is never confused with "no snapshot yet" (which must abort the whole walk).
    if (!input.modelPosReady) return;

    // SOFT cap. Above the margin nucleation simply stops; melting continues unconditionally in
    // advance(), so the population falls back toward freezeCap on its own.
    const capFrac = Math.max(0, Math.min(1, config.freezeCap)) * CAP_OVERSHOOT;
    if (this.getFrozenFraction() > capFrac) return;

    // The per-frame budget is additionally clamped by the headroom left under the cap. Testing the
    // cap only once before the loop would let a single frame add the full budget on top of an
    // already-at-cap population, so the true bound would be `cap + budget/capacity` rather than
    // `cap` — enough to break the "never exceeds freezeCap * 1.1" bound on a small pool.
    let headroom = Math.floor(capFrac * this.capacity) - this.activeCount;
    if (headroom <= 0) return;

    // Additionally clamped by the FREE LIST, exactly as accretion is.
    //
    // `capFrac` is `freezeCap * 1.1`, so above `freezeCap = 1/1.1 ≈ 0.909` the cap headroom stays
    // POSITIVE even with every slot occupied (at capacity 600 and freezeCap 1.0 it is +60). `spawn()`
    // cannot report that, because `acquireSlot()` falls back to stealing the FIFO-oldest LIVE crystal
    // and returns a perfectly valid slot index — so a mid-life crystal vanishes with no melt ramp,
    // which reads as flicker rather than as erosion, and each eviction also pays an O(capacity) scan.
    //
    // Freeze Cap is a user-facing slider over the full 0–1 range, so that band is one drag away. The
    // threshold is sharp: at 0.90 the headroom when full is -6 (safe), at 0.91 it is 0 or above.
    // Melting frees slots every frame and is unconditional, so declining here costs nothing but a
    // frame of delay, and the population still self-corrects toward the cap.
    if (headroom > this.freeTop) headroom = this.freeTop;
    if (headroom <= 0) return;

    const budget = Math.min(headroom, Math.max(0, Math.floor(config.nucleationBudget)));
    if (budget <= 0) return;

    // Resolve the rule. 'cold' needs temperatures, which are null on any preset without an active
    // material; selecting on all-zeros would put every particle in bucket 0 and saturate the cap
    // instantly, so it degrades to 'slow' instead.
    let rule: CrystalBirthRule = config.birthRule;
    if (rule === 'cold' && !input.temperatures) rule = 'slow';

    // Both percentile rules select the LOW end of their metric — the slowest and the coldest — so
    // the cutoff is always an upper bound and `selectByPercentile` is called without `invert`.
    let values: Float32Array | null = null;
    let fraction = 0;
    if (rule === 'slow') {
      values = input.velocities;
      fraction = config.slowFraction;
    } else if (rule === 'cold') {
      values = input.temperatures;
      fraction = config.coldFraction;
    }

    let cutoff = Infinity;
    if (values) {
      // A percentile of 0 means "nothing is eligible" — an explicit off position on the slider.
      if (fraction <= 0) return;
      cutoff = this.selectByPercentile(values, count, fraction);
      if (cutoff < 0) return; // no candidates at all
    }

    // Shared with accretion via these two helpers, so the two birth paths cannot diverge on the
    // lifetime floor (see `lifetimeFloor`).
    const base = this.lifetimeBase(config);
    const minLife = this.lifetimeFloor(config);

    // ---- SEPARATION, for nucleation as well as accretion ----
    //
    // `MIN_SEPARATION_FRAC` was previously enforced ONLY inside `accrete()`. Nucleation had no
    // proximity test at all, so newborn crystals could land arbitrarily close together or exactly on
    // top of one another. The consequence is the one this file already documents for the accretion
    // case: "stacked hexagons are invisible individually while driving themselves to full opacity".
    //
    // Reported as: with `birthRule: 'slow'` and a small pool, a `slowFraction` barely above 0 filled
    // the whole area with white and individual crystals could not be told apart. Two mechanics
    // combined to make that worse than it sounds:
    //
    //  - `slowFraction` is an ELIGIBILITY percentile, not a rate. Births are pinned at
    //    `nucleationBudget` per frame, so above roughly `budget / particleCount` (0.0001 on a
    //    20 000-particle preset) raising it changes nothing about how many crystals appear.
    //  - Particle index maps directly to arc position and the slowest particles bunch at the curve's
    //    cusps, so a SMALLER eligible set is a more spatially CONCENTRATED one. Lowering the slider
    //    therefore increased clustering.
    //
    // With separation enforced, `nucleationBudget` becomes a genuine density control: the pool fills
    // until the figure has no room left at `minSep`, rather than until `freezeCap` is hit.
    // Separation distance, converted PIXELS -> MODEL units.
    //
    // `crystalSizeFor()` returns the per-shape-compensated radius in pixels — the same value the
    // renderer uploads as `uSplatRadius` for the crystal pass, so it is genuinely "how big is this
    // crystal drawn". But this pool stores AUTHORED model positions, with `figScale` applied only at
    // projection, so the pixel radius must be divided by that factor to be comparable.
    //
    // Getting this wrong is not subtle: using the raw pixel value over-rejects by ~9x on
    // `Miracle Frost` and cut the population from 640 crystals to 69.
    //
    // Deliberately derived from `crystalSize` rather than `accretionRadius`: the question here is
    // whether two crystals will visually OVERLAP, which depends on how large they are drawn.
    // `accretionRadius` is a growth parameter and is irrelevant — worse, a preset with
    // `growthEnabled: false` would still carry one, so the coupling would be arbitrary.
    const fs = input.projection.figScale;
    const figScale = Number.isFinite(fs) && fs > 0 ? fs : 1;
    const sepRadius = (crystalSizeFor(config) * NUCLEATION_SEPARATION_FRAC) / figScale;
    const sepRadius2 = sepRadius * sepRadius;
    // Rebuilt here per nucleation pass. `accrete()` builds its own with an accretion-sized radius,
    // and the two must not share: SpatialHash requires `r <= cellSize`, so an index built for the
    // larger accretion radius would be correct but coarse, while one built for the smaller
    // separation radius would make accretion's own queries miss neighbours. Cheap enough to do twice
    // (~0.04 ms over <=2000 slots) and unambiguous.
    const sepHash = this.ensureHash();
    sepHash.rebuild(this.capacity, this.mx, this.my, this.mz, sepRadius, this.liveFilter);

    let nucleated = 0;

    if (rule === 'random') {
      // Independent random probes. A sequential walk would nucleate `budget` ADJACENT arc
      // positions (particle index maps directly to arc position), reading as one cluster rather
      // than the scattered speckle this rule is for.
      const maxProbes = count * 2;
      for (let p = 0; p < maxProbes && nucleated < budget; p++) {
        const i = (Math.random() * count) | 0;
        const m = i * 3;
        if (this.occupiedNearHashed(
          input.modelPos[m] ?? 0, input.modelPos[m + 1] ?? 0, input.modelPos[m + 2] ?? 0,
          sepRadius, sepRadius2,
        )) continue;
        if (this.spawnFrom(input, i, base, minLife) < 0) break;
        nucleated++;
      }
      return;
    }

    // Percentile rules: walk the population from a random offset, exactly the per-frame budget
    // pattern used for spark spawning, so the same particles are not favoured every frame.
    const startIdx = (Math.random() * count) | 0;
    for (let j = 0; j < count && nucleated < budget; j++) {
      const i = (startIdx + j) % count;
      const v = values![i] ?? 0;
      if (v >= cutoff) continue;
      const m = i * 3;
      // Eligible by metric, but is there already ice here? The walk continues rather than breaking,
      // so a crowded region does not stop nucleation elsewhere on the figure.
      if (this.occupiedNearHashed(
        input.modelPos[m] ?? 0, input.modelPos[m + 1] ?? 0, input.modelPos[m + 2] ?? 0,
        sepRadius, sepRadius2,
      )) continue;
      if (this.spawnFrom(input, i, base, minLife) < 0) break;
      nucleated++;
    }
  }

  /**
   * v8 Phase 8b.1 — is any live crystal within `minSep2` (squared) of this XY position?
   *
   * Needed because a lattice snap MOVES a deposit after it has already passed the separation test:
   * the pre-snap position was clear, the snapped one may not be. Without this re-check the lattice
   * quietly reintroduces exactly the stacked-duplicate problem `MIN_SEPARATION_FRAC` exists to
   * prevent — and stacked hexagons are invisible individually while driving themselves to full
   * opacity, so it would present as "the lattice makes crystals look wrong" rather than as stacking.
   *
   * Linear over the pool rather than a hash query: it runs only on snapped deposits (bounded by
   * `accretionBudget`, default 8) and the pool is <= 2000 slots, so this is far cheaper than the
   * rebuild a differently-sized second hash would need.
   */
  private occupiedNear(x: number, y: number, minSep2: number): boolean {
    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] !== 1) continue;
      const dx = x - this.mx[s]!;
      const dy = y - this.my[s]!;
      if (dx * dx + dy * dy < minSep2) return true;
    }
    return false;
  }

  /**
   * Same separation test as `occupiedNear`, but answered from the spatial hash instead of a linear
   * scan over every slot.
   *
   * Needed because NUCLEATION now tests separation too, and it runs on a different budget from
   * accretion: `occupiedNear` is O(capacity) per candidate, and nucleation can probe the whole
   * particle population (20 000 on `Miracle Frost`) looking for an eligible slot. 20 000 x 2 000 is
   * 40 M distance tests per frame, which would be far more expensive than everything else the pool
   * does. The hash makes it proportional to the local neighbour count instead.
   *
   * ⚠️ The caller MUST have rebuilt the hash with a radius >= the separation distance this frame.
   * `SpatialHash` requires `r <= cellSize` (it only scans 2-3 cells per axis), so querying a radius
   * larger than the one the index was built for silently misses neighbours — which here would mean
   * silently permitting the stacking this method exists to prevent.
   */
  private occupiedNearHashed(x: number, y: number, z: number, minSep: number, minSep2: number): boolean {
    const hash = this.hash;
    if (hash === null || hash.getItemCount() === 0) return false;
    const n = hash.queryRadius(x, y, z, minSep);
    if (n === 0) return false;
    // The hash already computed squared distances (T027), so reuse them rather than recomputing.
    // NOTE these are 3D distances while `occupiedNear` compares in XY only; for a separation test
    // that is the stricter and more correct comparison, since two crystals at the same XY but
    // different depth are drawn at different projected positions and do not visually stack.
    const d2 = hash.getResultDist2();
    for (let k = 0; k < n; k++) {
      if (d2[k]! < minSep2) return true;
    }
    return false;
  }

  /**
   * v8 Phase 8b.1 — snap a point to the nearest site of a hexagonal lattice, blended by `strength`.
   *
   * A hex lattice is a sheared square lattice: axial coordinates `q = (x·√3/3 − y/3)/cell`,
   * `r = (y·2/3)/cell`. Rounding in *cube* space (q, r, −q−r) is what gives the correct nearest
   * site — rounding q and r independently picks the wrong cell near hexagon edges, which shows up as
   * deposits landing on a slightly wrong grid and the lattice reading as "almost regular".
   *
   * `strength` lerps between the free position and the snapped one, so the control is continuous
   * rather than a hard on/off.
   */
  private snapToHexLattice(x: number, y: number, cell: number, strength: number): [number, number] {
    if (strength <= 0 || cell <= 0) return [x, y];

    const SQRT3 = 1.7320508075688772;
    const q = ((SQRT3 / 3) * x - y / 3) / cell;
    const r = ((2 / 3) * y) / cell;

    // Cube rounding: round all three, then fix up the coordinate with the largest error so the
    // constraint x + y + z === 0 still holds.
    let cx = Math.round(q);
    let cz = Math.round(r);
    let cy = Math.round(-q - r);
    const dq = Math.abs(cx - q);
    const dr = Math.abs(cz - r);
    const ds = Math.abs(cy - (-q - r));
    if (dq > dr && dq > ds) cx = -cy - cz;
    else if (dr > ds) cz = -cx - cy;

    const sx = cell * SQRT3 * (cx + cz / 2);
    const sy = cell * (3 / 2) * cz;
    const t = strength > 1 ? 1 : strength;
    return [x + (sx - x) * t, y + (sy - y) * t];
  }

  /**
   * v8 Phase 8b.1 — mirror a deposit into all six sectors around its seed.
   *
   * This is what makes a cluster read as a *snowflake* rather than as six independently grown lumps:
   * `growthAnisotropy` biases the DIRECTION of growth six ways, but each arm still accretes by its own
   * random walk, so the arms are never alike. Folding copies one deposit to the same relative position
   * in every sector, so all six arms are identical by construction.
   *
   * Sector 0 is the original deposit, already spawned by the caller — this adds the other five.
   * Budget-bounded by the caller: each fold consumes pool slots, so a fold is 6 slots not 1.
   */
  private foldDeposit(
    input: CrystalUpdateInput,
    i: number,
    seedX: number,
    seedY: number,
    depX: number,
    depY: number,
    base: number,
    minLife: number,
  ): number {
    const rx = depX - seedX;
    const ry = depY - seedY;
    let made = 0;
    // 5 copies at 60-degree increments; k=0 is the caller's own deposit.
    for (let k = 1; k < 6; k++) {
      // STOP ON A DRY FREE LIST rather than trusting the caller's budget.
      //
      // `accrete()` clamps its budget to `freeTop`, but it does so per DEPOSIT, and a folded deposit
      // costs 6 slots instead of 1 — so the final iteration of a budget-bounded loop can ask for 5
      // more slots than exist. `spawn()` cannot refuse: `acquireSlot()` falls back to stealing the
      // FIFO-oldest live crystal and returns a valid index, and that crystal then disappears with no
      // melt ramp, which reads as flicker rather than as erosion. Yield instead: a partial fold this
      // frame is invisible, an evicted neighbour is not.
      if (this.freeTop <= 0) break;
      const a = (k * Math.PI) / 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const fx = seedX + rx * ca - ry * sa;
      const fy = seedY + rx * sa + ry * ca;
      // Reuse the source particle's velocity direction and heat probe: a folded copy is the same
      // crystal seen in another sector, so it should share the facet grain rather than get a new one.
      if (this.spawnAt(input, i, fx, fy, base, minLife) < 0) break;
      made++;
    }
    return made;
  }

  /**
   * Spawn at an EXPLICIT model position, taking everything else from wave particle `i`.
   * Used by the lattice/fold paths, where the deposit is not at the particle's own position.
   */
  private spawnAt(
    input: CrystalUpdateInput,
    i: number,
    mx: number,
    my: number,
    base: number,
    minLife: number,
  ): number {
    const m = i * 3;
    const d = i * 2;
    return this.spawn(
      mx,
      my,
      input.modelPos[m + 2] ?? 0,
      input.velocityDirs[d] ?? 0,
      input.velocityDirs[d + 1] ?? -1,
      base,
      minLife,
      i,
    );
  }

  /** Read wave particle `i`'s model position and velocity direction into a fresh slot. */
  private spawnFrom(input: CrystalUpdateInput, i: number, base: number, minLife: number): number {
    const m = i * 3;
    const d = i * 2;
    return this.spawn(
      input.modelPos[m] ?? 0,
      input.modelPos[m + 1] ?? 0,
      input.modelPos[m + 2] ?? 0,
      input.velocityDirs[d] ?? 0,
      input.velocityDirs[d + 1] ?? -1,
      base,
      minLife,
      i,
    );
  }

  /**
   * Give birth to a crystal at a MODEL-space position. The source particle is NOT touched —
   * this method has no way to reach it.
   *
   * @param base        `config.crystalLifetime` before jitter, seconds
   * @param minLife     floor for the jittered lifetime (nucleationTime + meltTime)
   * @param sourceIndex wave particle to probe for ambient heat, or -1 to disable early melt
   * @returns the slot index, or -1 if the pool has no capacity at all
   */
  spawn(
    mx: number,
    my: number,
    mz: number,
    vdx: number,
    vdy: number,
    base: number,
    minLife: number,
    sourceIndex = -1,
  ): number {
    if (this.capacity === 0) return -1;

    const slot = this.acquireSlot();
    if (slot < 0) return -1;

    this.alive[slot] = 1;
    this.mx[slot] = mx;
    this.my[slot] = my;
    this.mz[slot] = mz;
    this.vdx[slot] = vdx;
    this.vdy[slot] = vdy;
    this.srcIndex[slot] = sourceIndex;
    this.birthSeq[slot] = ++this.seq;

    // Jittered per-particle lifetime, the `SparkPool.spawn()` formula. This is the whole mechanism
    // that desynchronises melts (RF-07) — without it a whole generation of crystals vanishes at
    // once. In increment (c) it is also what makes a cluster erode from its edges with no
    // parent/child tracking.
    const jittered = base * (0.7 + Math.random() * 0.6);
    this.life[slot] = jittered > minLife ? jittered : minLife;
    this.age[slot] = 0;
    this.growth[slot] = 0; // starts invisible, so a new crystal fades in rather than popping

    // Park it at the projection sentinel until project() runs later this same frame.
    this.sx[slot] = CULL_SENTINEL;
    this.sy[slot] = CULL_SENTINEL;
    this.sz[slot] = mz;
    this.depth[slot] = 0.5;

    return slot;
  }

  /**
   * A free slot, or the OLDEST live one when the pool is full (Rico's FIFO reuse). Note that
   * `SparkPool` instead evicts the spark with the least remaining lifetime — crystals have no
   * shrinking lifetime to scan, so that heuristic does not transfer.
   *
   * The O(capacity) oldest-scan is on a path that essentially never runs: `freezeCap * 1.1` caps
   * the population as a fraction of the POOL, so at the default 0.6 the free list only empties if
   * `freezeCap` is pushed to 1.0.
   */
  private acquireSlot(): number {
    if (this.freeTop > 0) {
      const slot = this.freeList[--this.freeTop]!;
      this.activeCount++;
      return slot;
    }

    let oldest = -1;
    let oldestSeq = Infinity;
    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] !== 1) continue;
      const q = this.birthSeq[s]!;
      if (q < oldestSeq) {
        oldestSeq = q;
        oldest = s;
      }
    }
    return oldest; // already alive, so activeCount is unchanged
  }

  // ---- projection ---------------------------------------------------------------------------

  /**
   * Rotate → perspective-project every live slot, using the SAME angle state and maths as the wave
   * particles (`LissajousGenerator.update()`). Reproduced rather than shared because the wave loop
   * is the hottest loop in the engine and must not gain a call boundary; the two must be kept in
   * step.
   *
   * There is no separate view matrix in this engine — the camera-relative step is exactly the
   * `originX`/`originY` offset and the `perspZ` subtraction.
   */
  private project(p: CrystalProjection): void {
    if (this.activeCount <= 0) return;

    const { sinWx, cosWx, sinWy, cosWy, sinWz, cosWz, originX, originY, perspZ, figScale } = p;
    const depthRange = -perspZ * 2;
    const fs = Number.isFinite(figScale) && figScale > 0 ? figScale : 1;

    for (let s = 0; s < this.capacity; s++) {
      if (this.alive[s] !== 1) continue;

      // Scaled before rotation, matching the wave loop exactly — see `figScale` on CrystalProjection.
      let x = this.mx[s]! * fs;
      let y = this.my[s]! * fs;
      let z = this.mz[s]! * fs;

      // Rotate X
      let k = y * cosWx - z * sinWx;
      z = y * sinWx + z * cosWx;
      y = k;

      // Rotate Y
      k = x * cosWy + z * sinWy;
      z = -x * sinWy + z * cosWy;
      x = k;

      // Rotate Z
      k = x * cosWz - y * sinWz;
      y = x * sinWz + y * cosWz;
      x = k;

      const q = z - perspZ;
      if (q > 0) {
        const proj = perspZ / q;
        this.sx[s] = originX - x * proj;
        this.sy[s] = originY - y * proj;
      } else {
        this.sx[s] = CULL_SENTINEL;
        this.sy[s] = CULL_SENTINEL;
      }
      this.sz[s] = z;

      // REAL depth from the POST-rotation z, identical to the wave-particle formula. The crystal
      // pass sorts descending on this, so a constant here would silently disable the sort.
      const dRaw = depthRange !== 0 ? (z - perspZ) / depthRange : 0.5;
      this.depth[s] = dRaw < 0 ? 0 : dRaw > 1 ? 1 : dRaw;
    }
  }

  // ---- publication --------------------------------------------------------------------------

  /**
   * Compacted live slots, shaped for `[wave][sparks][liquid][crystals]` concatenation.
   *
   * Compacted rather than capacity-sized so the crystal block is dense and `frozen` is 1 across
   * exactly one contiguous tail range. The block length therefore varies frame to frame, as the
   * spark block already does.
   */
  getActiveState(): CrystalPoolState {
    const count = this.activeCount;
    if (count === 0) return EMPTY_STATE;

    // Sized to CAPACITY, not to the live count, and allocated once: the live count changes every frame
    // as crystals nucleate and melt, so sizing to it would reallocate almost every frame — which was
    // half of the ~1 MB/frame that caused the reported periodic GC jitter (see
    // `LissajousGenerator.ensureTailScratch` for the measurement). Capacity is bounded by
    // MAX_CRYSTAL_POOL (2000), so the fixed cost is small and the caller only ever copies `[0, count)`.
    if (this.pubPositions.length < this.capacity * 3) {
      this.pubPositions = new Float32Array(this.capacity * 3);
      this.pubDepths = new Float32Array(this.capacity);
      this.pubVelocities = new Float32Array(this.capacity); // stays all-zero: ice does not streak
      this.pubVelocityDirs = new Float32Array(this.capacity * 2);
      this.pubTemperatures = new Float32Array(this.capacity); // stays all-zero: ice is cold
      this.pubColors = new Float32Array(this.capacity * 3);
      this.pubGrowth = new Float32Array(this.capacity);
    }
    const positions = this.pubPositions;
    const depths = this.pubDepths;
    const velocities = this.pubVelocities;
    const velocityDirs = this.pubVelocityDirs;
    const temperatures = this.pubTemperatures;
    const colors = this.pubColors;
    const growth = this.pubGrowth;

    const cr = CRYSTAL_BASE_COLOUR[0];
    const cg = CRYSTAL_BASE_COLOUR[1];
    const cb = CRYSTAL_BASE_COLOUR[2];

    let k = 0;
    for (let s = 0; s < this.capacity && k < count; s++) {
      if (this.alive[s] !== 1) continue;
      const o3 = k * 3;
      const o2 = k * 2;
      positions[o3] = this.sx[s]!;
      positions[o3 + 1] = this.sy[s]!;
      positions[o3 + 2] = this.sz[s]!;
      depths[k] = this.depth[s]!;
      velocityDirs[o2] = this.vdx[s]!;
      velocityDirs[o2 + 1] = this.vdy[s]!;
      colors[o3] = cr;
      colors[o3 + 1] = cg;
      colors[o3 + 2] = cb;
      growth[k] = this.growth[s]!;
      k++;
    }

    return { count: k, positions, depths, velocities, velocityDirs, temperatures, colors, growth };
  }

  // ---- percentile selection -----------------------------------------------------------------

  /**
   * Percentile cutoff via a 64-bucket histogram: two O(N) passes and a fixed 64-entry walk, NO
   * sort. Measured 0.109 ms/frame at 20 000 particles; an O(N log N) sort would cost ~286k ops for
   * a number we only need to bucket resolution.
   *
   * `values` are expected in 0–1 (both `velocities[]` and `temperatures[]` are normalised);
   * out-of-range values are clamped into the end buckets rather than rejected.
   *
   * Both birth rules select the LOW end of their metric (the slowest, the coldest), so the returned
   * cutoff is always an UPPER bound. There was a symmetric `invert` branch for a high-end selection;
   * it had no caller and was therefore untested, so it is gone. Re-add it if a high-end rule ever
   * lands, rather than carrying an unexercised contract.
   *
   * @returns the cutoff value, or -1 when there are no candidates
   */
  private selectByPercentile(values: Float32Array, count: number, fraction: number): number {
    if (fraction <= 0) return -1;
    if (count <= 0) return -1;

    const b = this.buckets;
    b.fill(0);

    // Pass 1 — histogram over every wave particle. Nothing is frozen any more, so there is no
    // exclusion mask: every particle is a candidate, every frame.
    let n = 0;
    for (let i = 0; i < count; i++) {
      const v = values[i] ?? 0;
      let k = (v * BUCKETS) | 0;
      if (k < 0) k = 0;
      else if (k >= BUCKETS) k = BUCKETS - 1;
      b[k] = b[k]! + 1;
      n++;
    }
    if (n === 0) return -1;
    if (fraction >= 1) return Infinity;

    // Pass 2 — walk buckets until the target share is covered. The cutoff lands on a bucket EDGE,
    // so the candidate pool may overshoot `fraction` by at most one bucket width (1/64).
    const target = fraction * n;
    let acc = 0;
    for (let k = 0; k < BUCKETS; k++) {
      acc += b[k]!;
      if (acc >= target) return (k + 1) / BUCKETS;
    }
    return Infinity;
  }
}
