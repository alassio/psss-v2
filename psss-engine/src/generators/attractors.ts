import type { AttractorParams } from '../core/interfaces.ts';

// Per-particle attractor state (for continuous ODE attractors)
export interface AttractorState {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /**
   * RENDERED position for the discrete maps (`clifford`, `dejong`), decoupled from the map state above.
   *
   * ## Why the two must be separate
   *
   * A chaotic discrete map has no notion of a small step: consecutive iterates are *uncorrelated* points
   * on the attractor. Measured on `Clifford Classic`, the mean per-frame hop is **51.6 % of the whole
   * figure extent** (max 94 %), so at 60 fps a particle traverses ~3 100 % of the figure per second.
   * Drawing `x`/`y` directly is therefore not an animation at all — every particle teleports across the
   * attractor every frame, which reads exactly as the reported "random noise around an attractor" and
   * cannot be fixed by slowing anything down, because there is no `dt` to slow.
   *
   * So `x`/`y` keep iterating as the *target* ("where should this particle live"), and `rx`/`ry` are what
   * is drawn, EMA-chased toward it. Same device as `velRefEMA` and `velocityDirs` elsewhere in this
   * engine: the fast signal stays authoritative, the rendered one is continuous.
   *
   * Unused for the ODE and escape-flow types, which integrate smoothly and are drawn from `x`/`y`
   * directly — allocating three extra arrays for them would be pure waste, so the two discrete types are
   * the only ones that read these.
   */
  rx: Float32Array;
  ry: Float32Array;
  /** True once `rx`/`ry` hold a real position, so the first frame snaps instead of easing in from 0,0. */
  renderReady: boolean;
  /**
   * MEASURED centre of the ODE attractor in its own units, subtracted by `iterateAttractor`'s normalisation.
   *
   * ⚠️ **Scale and origin are two quantities, and `ATTRACTOR_HALF_EXTENT` only ever carried the scale.**
   * Measured at init over the reference bank and divided by that same half-extent, the ODE attractors do NOT
   * sit at the origin. **EVERY FIGURE IN THE LIST BELOW IS AT `particleCount` 4 000 — the basis is part of
   * the figure, see the drift paragraph after it:** `lorenz` centre **+0.91**, `halvorsen` −0.51 on all three
   * axes,
   * `aizawa` +0.40 in z, `Rössler Spiral` +0.50 and `Rössler Wide` **+1.96** in z. `nose-hoover` was already
   * centred (0.01/0.03/−0.11) and so is `thomas` — ⚠️ **`thomas` read +0.35 on all three axes with a single
   * reference and reads 0.00 with the bank of 32, because its attractor is a symmetric PAIR and one orbit
   * only ever occupies one lobe. A per-type offset table measured off one orbit would have been wrong by a
   * whole lobe, which is the second reason these are measured and not tabulated.** Uncentred, the figure is
   * displaced in the frame (x/y) and pushed away in depth (z), where the perspective divide shrinks it AND
   * the 3D rotation swings it around a pivot it
   * does not contain — this file already documents that exact failure for the pre-2026-08-13 un-normalised
   * z ("the figure sailing out of frame and back"), just three orders of magnitude smaller.
   *
   * ## ⚠️ The published centre is an EXTREMES statistic, so `particleCount` is part of it (measured 2026-09-20)
   *
   * `(lo + hi) / 2` over the harvest is a bounding-box midpoint, and a bounding box is decided by two
   * particles. `count` enters it TWICE — as the sample size, and through `stride`, which is
   * `round(ODE_WARM_BUDGET / (count · refCount))` and therefore an INTEGER that jumps (13, 8, 6, 4, 3, 2, 1
   * at 2 k, 3 k, 4 k, 6 k, 8 k, 12 k, 20 k), changing the spacing between consecutive samples along the
   * reference orbits. **So the same attractor publishes a different origin at a different Particle Number,
   * deterministically** (two runs at one count agree exactly — there is no `Math.random` on this path).
   *
   * **Swept for `lorenz` over 2 k…24 k: centre z 0.9078…0.9464, spread 0.039 half-extents ≈ 2 % of the
   * figure's width, while the population MEAN z is 0.882 ± 0.003 over the same sweep** — i.e. essentially
   * all of the drift is in the extremes and none of it is in the population. Re-measured at 4 k / 8 k / 20 k,
   * every OTHER entry above is stable to 2 dp (`Rössler Spiral` +0.50, `Rössler Wide` +1.96, `aizawa` +0.40,
   * `halvorsen` −0.51, `thomas` 0.00); the two that drift are `lorenz` (+0.91 → +0.95 → +0.94) and
   * `nose-hoover` (−0.11 → −0.07 → −0.16, a 2× spread that is invisible only because it is near zero).
   * `Lorenz Tight` reads 0.00 at every count, which is the collapse guard reverting to the seed circle.
   *
   * ⚠️ **Using the mean, or a percentile, instead of the midpoint would remove the drift — NOT DONE, and it
   * is not a bug report:** 2 % of the figure's width is below the threshold at which anything was noticed,
   * the subsystem is browser-confirmed as it stands (`Lorenz Twin Lobes`, 2026-09-20), and changing the
   * origin law would re-frame every body whose `figureScale` was measured against the current one — the same
   * blast radius the centring fix itself had. Propose it; do not quietly switch the statistic.
   *
   * ⚠️ **This is also where a documented +0.93 came from, and the mechanism is the one the house rule names:
   * arithmetic on a quoted figure.** An earlier version of this block quoted `lorenz` as "spans z 0.03…1.83
   * (centre +0.91)" — whose own midpoint is 0.93, not 0.91 — and `demo-presets.ts`' `Lorenz Twin Lobes`
   * block took that midpoint. The span and the centre were never one measurement: a snapshot of 4 000 seeded
   * points does not reach the box a long integration explores, so the two are **two measurements wearing the
   * same words**. The span is dropped from the list above rather than repaired, because there is no basis
   * recorded for it. `Lorenz Twin Lobes` ships 8 000 particles, where the centre is **+0.95** — so both
   * documented figures were stale for the body that actually uses them, in different ways.
   *
   * ⚠️ **Measured at init from the harvested bank rather than tabulated per TYPE, because a per-type
   * constant cannot be right here: the two `rossler` presets differ by 4× in their z centre (+0.50 against
   * +1.96) on identical `type`.** `ATTRACTOR_HALF_EXTENT` has the same weakness — see the ⏳ note there.
   * Zero for every type that does not go through `warmOdeAttractor` (the two maps, the two escape fields),
   * which are centred by construction, and zero whenever the seed circle is restored.
   */
  centreX: number;
  centreY: number;
  centreZ: number;
  /**
   * Rotating cursor for SUBSET iteration of the discrete maps.
   *
   * The second half of the flicker fix: iterating every particle every frame regenerates the entire point
   * cloud 60 times a second, so no structure can persist long enough to be seen. Advancing only a slice
   * per frame means most particles HOLD their target while the rest move, and the cloud reads as a stable
   * form being progressively redrawn rather than as noise.
   */
  cursor: number;
}

export function createAttractorState(count: number): AttractorState {
  return {
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    rx: new Float32Array(count),
    ry: new Float32Array(count),
    renderReady: false,
    centreX: 0,
    centreY: 0,
    centreZ: 0,
    cursor: 0,
  };
}

/**
 * Seed per-particle attractor state.
 *
 * `fromIndex` seeds only the tail `[fromIndex, count)`, for the Visual FX "Particle Number" slider: growing
 * the population must not re-seed particles that have already iterated for thousands of frames, or the
 * whole cloud would collapse back to its starting distribution on every step of a drag. Note the
 * distribution parameter stays `i / count` over the FULL population, so a grown tail lands where those
 * indices belong rather than being crowded into a fresh 0→1 sweep.
 *
 * A grown tail cannot simply be left at zero: for the ODE attractors the origin is a FIXED POINT, so those
 * particles would never move.
 */
/**
 * v8 Phase 37 follow-up — the TILE TIER's options. ⚠️ **Absent means the main view's exact behaviour**: every
 * field defaults to the constant it replaces, so a caller that passes nothing runs today's code path bit for bit.
 * `warmBudget` replaces `ODE_WARM_BUDGET` (integrator steps for the whole harvest); a preview tile passes a
 * fraction of it, because its one-shot setup must fit a tile's per-frame budget (`grid-tile-renderer.ts`).
 */
export interface AttractorTierOpts {
  warmBudget?: number;
}

export function initAttractorState(
  state: AttractorState, params: AttractorParams, fromIndex = 0, tier?: AttractorTierOpts,
): void {
  const count = state.x.length;
  const type = params.type;
  const start = Math.max(0, Math.min(count, fromIndex));

  if (type === 'julia' || type === 'mandelbrot') {
    // Distribute particles in the bounds rectangle
    const [xMin, yMin, xMax, yMax] = params.bounds;
    for (let i = start; i < count; i++) {
      const t = i / count;
      const angle = t * Math.PI * 2 * 7.3; // spiral distribution
      const r = Math.sqrt(t);
      state.x[i] = xMin + (xMax - xMin) * (0.5 + r * 0.45 * Math.cos(angle));
      state.y[i] = yMin + (yMax - yMin) * (0.5 + r * 0.45 * Math.sin(angle));
      state.z[i] = 0;
    }
  } else {
    // Small perturbation around the origin for the ODE attractors and the two maps. For the ODE types
    // this is only the STARTING point: `warmOdeAttractor` below replaces it with a position on the
    // attractor itself, and reverts to it when there is no attractor to land on.
    const flat = isFlatAttractor(type);
    for (let i = start; i < count; i++) seedCircle(state, i, count, flat);
  }

  // Seed the rendered position for the discrete maps so frame 1 draws the attractor rather than easing
  // out of the origin. `renderReady` is a whole-state flag, so a GROWN tail (fromIndex > 0) must be
  // seeded here too — it is already past the point where the flag would be flipped.
  if (isDiscreteMap(type)) {
    warmDiscreteMap(state, params, start, count);
    for (let i = start; i < count; i++) {
      state.rx[i] = state.x[i]!;
      state.ry[i] = state.y[i]!;
    }
    if (start === 0) state.renderReady = true;
  } else if (!isFlatAttractor(type)) {
    // The six continuous ODE types. `isFlatAttractor` excludes `julia`/`mandelbrot`, which took the
    // bounds branch above and whose particles are placed by the escape grid, not by integration.
    warmOdeAttractor(state, params, start, count, tier?.warmBudget ?? ODE_WARM_BUDGET);
  }
}

/**
 * The origin-circle seed, the one place its law is written for the init path.
 *
 * ⚠️ `clifford`/`dejong` are 2D MAPS — neither `iterateClifford` nor `iterateDeJong` ever assigns `s.z`,
 * so whatever is seeded here is what the particle keeps FOREVER. Seeding `r*sin(phi*0.7)` gave every
 * particle a fixed pseudo-random depth, i.e. a flat attractor rendered as a cloud of stationary depth
 * noise. Zero is the only correct seed for a type whose integrator has no z term.
 *
 * ⚠️ `iterateHalvorsen` writes the same law inline and is deliberately left alone: that one is a RUNTIME
 * escape reseed inside the integrator's hot loop, keyed to the particle's own index rather than to this
 * function's `count`, and the two must be free to diverge.
 */
function seedCircle(state: AttractorState, i: number, count: number, flat: boolean): void {
  const phi = (i / (count || 1)) * Math.PI * 2;
  const r = 0.1 + (i % 7) * 0.05;
  state.x[i] = r * Math.cos(phi);
  state.y[i] = r * Math.sin(phi);
  state.z[i] = flat ? 0 : r * Math.sin(phi * 0.7);
}

/**
 * Iterate each discrete-map particle a VARIED number of transient steps at init.
 *
 * ⚠️ **This became mandatory when subset iteration landed, and omitting it looks like a different bug.**
 * The seed above is a circle of radius 0.1–0.4 around the origin, which is not on the attractor at all;
 * the old code reached the attractor by iterating every particle every frame, so the cloud snapped into
 * shape within a few frames. Under `DISCRETE_SUBSET_FRACTION` a given particle now advances roughly every
 * 0.75 s, so the same convergence would take **tens of seconds**, and what the user would see meanwhile is
 * a small ring near the centre slowly dissolving — indistinguishable from a broken attractor.
 *
 * The step count is per-particle and coprime-strided (`% 61`, plus a 40-step floor for the transient) for
 * the reason that makes chaos usable here: consecutive iterates are uncorrelated, so *different iteration
 * counts* are what spreads the population over the attractor. A single shared count would leave all
 * particles at the same orbit position, i.e. one dot.
 */
function warmDiscreteMap(state: AttractorState, params: AttractorParams, start: number, count: number): void {
  const p = params.params;
  const a = p[0]!, b = p[1]!, c = p[2]!, d = p[3]!;
  const clifford = params.type === 'clifford';
  for (let i = start; i < count; i++) {
    const steps = 40 + (i % 61);
    let x = state.x[i]!;
    let y = state.y[i]!;
    for (let n = 0; n < steps; n++) {
      if (clifford) {
        const nx = Math.sin(a * y) + c * Math.cos(a * x);
        y = Math.sin(b * x) + d * Math.cos(b * y);
        x = nx;
      } else {
        const nx = Math.sin(a * y) - Math.cos(b * x);
        y = Math.sin(c * x) - Math.cos(d * y);
        x = nx;
      }
    }
    state.x[i] = x;
    state.y[i] = y;
  }
}

/**
 * Total reference-trajectory steps spent seeding the ODE attractors, and the bounds on the SPACING
 * between two harvested positions.
 *
 * The budget is a TOTAL rather than a per-particle count, which is the whole reason this approach is
 * affordable: the reference is one particle, so the cost of seeding 4 000 and 40 000 particles is the
 * same, and it is the *window* (`budget` steps of attractor time) that decides coverage — sampling it
 * more densely can only improve coverage, never reduce it. `STRIDE_MIN` keeps two consecutive indices
 * from being the same point at absurd counts; `STRIDE_MAX` caps the walk for a small population, whose
 * window would otherwise be shorter than the budget.
 */
const ODE_WARM_BUDGET = 800_000;
const ODE_WARM_STRIDE_MIN = 25;
const ODE_WARM_STRIDE_MAX = 400;

/** Reference steps discarded before the first harvest, and after a reseed — the reference's own transient. */
const ODE_WARM_SKIP = 2_000;

/** Reseed the reference if it leaves this multiple of the measured half-extent (or goes non-finite). */
const ODE_WARM_ESCAPE = 4;

/** Consecutive reference escapes tolerated before the seeding gives up and leaves the seed circle in place. */
const ODE_WARM_RETRIES = 8;

/**
 * How many independent reference trajectories the harvest runs, and why it is not one.
 *
 * ⚠️ **One reference is only the attractor where the flow is MIXING**, and two of the eight entries are not:
 * `nose-hoover` is conservative (nested tori, no attractor in the dissipative sense) and `thomas` at
 * `b = 0.208186` is weakly dissipative with coexisting orbits. There one orbit is ONE torus, so a
 * single-reference harvest lands the whole population on it and covers measurably LESS than the old seed
 * circle did — the circle's virtue was accidental, but it was real: it spread the initial conditions across
 * a FAMILY of orbits. Many references seeded at many points restore that, at no extra cost (below), and they
 * cost nothing where the flow IS mixing, because many segments of one attractor are still that attractor.
 *
 * ⚠️ **The budget is unchanged, because the references advance TOGETHER.** `stride` is divided by the
 * reference count, so `count × stride × refs` is still `ODE_WARM_BUDGET`, each reference still walks
 * `ODE_WARM_BUDGET / refs` steps, and two consecutive indices are still `stride × refs` steps apart on their
 * own orbit — which is why `ODE_WARM_STRIDE_MIN`, a constraint on THAT spacing, is divided too. Wall time
 * *falls* with the count, because the integrator work is fixed while the number of `iterateAttractor` CALLS
 * is `count × stride`: 24 ms at one reference, 6 ms at 32, for the same 800 k integrator steps.
 *
 * ⚠️ **32 is a measured balance and BOTH directions cost something.** Seeded-population occupancy of a 48²
 * grid over the half-extent, 4 000 particles, by reference count:
 *
 * | entry | 1 | 8 | 32 | 64 | 128 | free-running |
 * |---|---|---|---|---|---|---|
 * | `Nosé-Hoover Flow` | 11.6 | 20.0 | **24.0** | 28.7 | 30.0 | 25.0 |
 * | `Thomas Cyclone` | 20.2 | 32.8 | **34.6** | 35.2 | 35.5 | 34.1 |
 * | `Rössler Spiral` | 7.4 | 10.6 | **11.7** | 12.0 | 12.1 | 11.3 |
 * | `Rössler Wide` | 51.3 | 51.1 | **49.7** | 45.5 | 39.3 | 51.4 |
 * | `Lorenz Classic` | 23.3 | 23.4 | **23.3** | 23.2 | 22.6 | 23.8 |
 *
 * More references is more initial conditions and fewer steps each, so the two non-mixing types keep gaining
 * past 32 while **`Rössler Wide` loses**: its figure includes rare, slow excursions up the z spike, and at
 * 128 references each orbit gets only ~8 000 steps (t ≈ 40) — too short to make one, which shows up as the
 * SPREAD falling from 3.92 to 3.24 of the half-extent, i.e. a visibly shorter figure. At 32 every entry sits
 * within about a point of its free-running coverage or above it, the two shortfalls being `Rössler Wide`
 * (1.7 points) and `Nosé-Hoover Flow` (1.0) — and the free-running column is what the user reaches after a
 * minute or two, not what the frame ever showed at load. **The limit of this
 * direction is the rejected per-particle warm-up** (`refs === count`), which is where the step budget stops
 * bounding the cost at all.
 */
const ODE_WARM_REFS = 32;

/**
 * The collapse test: the smallest distance a reference may travel over `ODE_WARM_PROBE` steps, as a fraction
 * of the half-extent, for the harvest to be used at all.
 *
 * ⚠️ **This is the `Lorenz Tight` trap and it is the one place where "seed on the attractor" is the WRONG
 * thing to do.** Its `rho` is 15, below the 24.74 where the Lorenz system becomes chaotic, so its two fixed
 * points are STABLE: every reference spirals into one of them and every harvest returns the same two points.
 * On screen that is a dead frame — measured through the real generator at `figureScale` 1.0, grid occupancy
 * **0.1 %**, footprint churn 0.019 and mean per-particle motion **0.0 px per 30 frames**, against 12.3 % /
 * 0.106 / 64.5 px for `Lorenz Classic` on the identical code path. The harvest is not wrong there, it is
 * *correct* — a fixed point genuinely is that system's attractor — and what the preset always showed is the
 * long TRANSIENT, which only the seed circle produces. So the collapse is detected and the circle restored,
 * i.e. the pre-2026-09-20 behaviour for exactly the parameter sets that need it.
 *
 * ⚠️ **It tests MOTION and not extent, and the extent test it replaces was itself the defect — a measuring
 * section whose own basis was wrong, which is the failure this project keeps finding.** Extent looks like the
 * obvious measure and it is wrong twice over. The harvest bounding box for `Lorenz Tight` spans **0.075** of
 * the half-extent with one reference — the tail of the converging spiral, not the fixed point — so the 0.05
 * floor of this function's first draft NEVER TRIPPED, and the dead frame above is what it shipped. With 32
 * references the same box grows to **0.526**, because the references split between the two stable fixed
 * points, and that passes any floor low enough to be useful at all (the tightest healthy figure is
 * `Rössler Spiral` at 1.001). Displacement goes to zero at a fixed point whatever the geometry, which is the
 * property actually being asked about. Measured over `ODE_WARM_PROBE` steps at 32 references: `Lorenz Tight`
 * **exactly 0.0** — a converged Euler step is zero in float32, not merely small — against a minimum of
 * **0.672** over the seven healthy entries (`Rössler Spiral`; `Halvorsen Knot` 2.310). There is no threshold
 * to tune between those two, which is the point: the floor exists to be crossed by a NEW parameter set, not
 * by any of these.
 */
const ODE_WARM_MIN_STEP = 1e-4;

/**
 * Steps the collapse probe integrates, FIXED rather than `stride`.
 *
 * `stride` is derived from the particle count (200 at 500 particles, 5 at 20 000), so a floor measured
 * against it would mean forty times more travel demanded of a small population than a large one — the same
 * class of error as a tolerance that depends on the canvas size. The probe is its own fixed window, so
 * `ODE_WARM_MIN_STEP` is a property of the SYSTEM alone.
 */
const ODE_WARM_PROBE = 200;

/**
 * Seed the continuous ODE attractors ON their attractor, by harvesting a bank of reference trajectories.
 *
 * ## The defect this fixes, measured
 *
 * The seed above is a circle of radius 0.1–0.4 around the origin — for every one of these systems that is
 * a point near an unstable fixed point, *not* a point on the attractor, and nothing but chaotic divergence
 * separates 4 000 particles that all start within 0.3 of each other. Divergence is exponential but it
 * starts from ~0.1 units against a ±27.58 attractor, so the wait is measured in MINUTES. Occupancy of a
 * 48×48 grid over ±`attractorHalfExtent`, 4 000 particles, INSTANTANEOUS (not a window mean — a mean over
 * the first 10 s reads 2.3 % for `lorenz` and hides how empty frame 1 is), before → after this function:
 *
 * | preset | 0 s | 10 s | 30 s | 60 s | 120 s | churn/0.5 s |
 * |---|---|---|---|---|---|---|
 * | `Lorenz Classic` | 0.2 → **23.4** | 2.1 → 23.1 | 14.9 → 22.9 | 23.7 → 23.8 | 23.8 → 23.3 | 0.312 → 0.204 |
 * | `Rössler Wide` | 0.2 → **49.0** | 0.2 → 49.3 | 0.2 → 49.1 | 1.3 → 50.7 | 21.7 → 49.4 | 0.040 → 0.254 |
 * | `Halvorsen Knot` | 0.5 → **46.9** | 44.4 → 47.3 | 46.4 → 46.8 | 47.0 → 46.7 | 47.4 → 47.6 | 0.281 → 0.265 |
 * | `Aizawa Torus` | 5.6 → **42.5** | 4.2 → 41.6 | 24.3 → 41.8 | 40.1 → 42.1 | 42.7 → 41.6 | 0.617 → 0.559 |
 *
 * ⚠️ **The plateau is the attractor and the first minute is not.** Harvesting one 3.2 M-step trajectory
 * measures `lorenz`'s true support at **22.8 %**, i.e. the old t=120 s figure is convergence, not growth.
 * What the first minute actually showed is the population strung along its first few orbits: two thin rings
 * with nothing between them, which is exactly the reported *"starts fine, however very soon consolidates
 * into two small independent circles which are rotating and then nothing changes anymore, the circles are
 * too small, we need larger connected activity between them"* (`Lorenz Twin Lobes`, owner, 2026-09-20).
 * `Rössler Wide` is the extreme case — it needed **more than two minutes** to reach 21.7 % of a support
 * that is 51 %, so nobody has ever seen that attractor. `aizawa`'s 5.6 % at t=0 is the seed circle itself
 * being large relative to its ±1.61 extent, and it *falls* to 4.2 % as the ring collapses onto the
 * attractor before spreading — a dip a user sees as the figure dying.
 *
 * ## Why a reference trajectory and not a per-particle warm-up
 *
 * Integrating every particle for the same 3 600 steps works — it is by definition the t=60 s column above —
 * and varying the count per particle the way `warmDiscreteMap` must adds nothing measurable (22.0 % at
 * `400 + i % 1200`, 23.0 % at `2000 + i % 12000`). ⚠️ **The difference is not quality, it is cost, and
 * that is what decides it:** a per-particle warm-up is `count × steps`, so reaching the plateau costs
 * 14.4 M steps at 4 000 particles and 72 M at 20 000, which is a visible stall on every preset load and
 * on every step of the Particle Number drag. The reference bank is 32 particles whatever the count is, so the
 * same coverage costs `ODE_WARM_BUDGET` steps *whatever the count is* — measured 6–30 ms per full seed for
 * counts from 500 to 50 000 (flat in the count by construction; `thomas` is the dear one at 30–60 ms), and
 * **0.6–3.3 ms for a 100-particle grown tail** — see `stride`'s ⚠️ for why the tail is cheap, which is not
 * automatic. ⚠️ **Those are one machine's numbers and they move by 2× run to run** (same script, same
 * process count): read them as a ratio against the 14.4 M-step alternative, never as a budget.
 *
 * ⚠️ **The reason this is legitimate rather than a trick is ergodicity: a long enough orbit segment IS the
 * attractor**, so harvesting it every `stride` steps samples the invariant measure — the population lands
 * with the right SHAPE and the right DENSITY, which no distribution over the seed circle can do. The
 * accepted cost is that the population is a CONVEYOR: consecutive samples of one reference sit where that
 * reference will be `stride` steps from now. ⚠️ **Read the spacing off the bank, not off `stride`:** at 32
 * references and 4 000 particles `stride` is 6 steps, but each reference is harvested only every 32nd index,
 * so samples of the same orbit are 32 × 6 = **192** steps apart — ~1 Lyapunov time for `lorenz`, the same
 * spacing the single-reference draft got from `stride` 200 — and index-ADJACENT particles come from 32
 * unrelated orbits. So the conveyor is not visible; measured footprint churn over 0.5 s is **0.204** against
 * 0.255 free-running at t=60 s and 0.373 for the undeveloped seed ring.
 *
 * ⚠️ **Spreading the seed over the half-extent BOX instead is not an option, and the measurement says so
 * loudly: the box is not the basin.** Seeding `rossler` over ±0.9·26.39 by radical inverse and integrating
 * 200 steps sends **945 of 4 000 particles to Infinity** (`bad 945`, and 978 at full extent) because the
 * Rössler system escapes from most of that box; `lorenz`, `thomas`, `halvorsen` and `aizawa` survive it,
 * which is precisely what would make the bug look like a `rossler`-only defect.
 *
 * ## ⚠️ What this COSTS, on the types that are not mixing — what the reference BANK is for
 *
 * "A long orbit segment is the attractor" holds only where the flow is mixing. Where it is not, one orbit
 * is one torus, and the free-running population used to cover MORE because its seed circle spread the
 * initial conditions across a whole FAMILY of orbits. ⚠️ **This is the whole reason `ODE_WARM_REFS` is 32
 * and not 1** — the single-reference draft of this function measured, on the same instrument,
 * `Thomas Cyclone` 34.1 → 19.8 % occupancy at 120 s with its x-y span down from 1.98 to 1.29 h, and
 * `Nosé-Hoover Flow` 25.0 → 11.3 % at 2.00 → 1.24 h, i.e. **a figure a third smaller on screen** — and that
 * is the regression the bank removes. What the bank does NOT remove is the residual, which is real:
 *
 * | preset | occ @0 s | occ @120 s | x-y span @60 s | churn/0.5 s |
 * |---|---|---|---|---|
 * | `Thomas Cyclone` | 1.4 → **35.2 %** | 34.1 → 34.3 % | 1.98 → 1.99 h | 0.250 → 0.179 |
 * | `Nosé-Hoover Flow` | 0.7 → **23.6 %** | 25.0 → **18.9 %** | 2.00×1.79 → 2.03×**1.21** h | 0.441 → 0.243 |
 * | `Rössler Spiral` | 0.2 → **12.0 %** | 11.3 → 8.8 % | 0.79 → 0.80 h | 0.118 → 0.148 |
 *
 * `nose-hoover` is the textbook case (it is conservative — nested tori, no attractor in the dissipative
 * sense) and it is the one entry still paying: 32 tori are not a continuum of tori, so its steady-state
 * coverage is 6 points down and its y extent a third short. `thomas` at `b = 0.208186` sits in a weakly
 * dissipative regime with coexisting orbits and the bank covers both lobes of its symmetric pair, so its
 * residual is nil. ⚠️ **Judge these two on the RUN and not on the plateau:** both spend their whole first
 * minute far above the old curve, and the screen instrument — 4 000 particles through the real generator,
 * mean occupancy over 30 s from load — reads `Nosé-Hoover Flow` 14.7 → **17.1 %** and `Rössler Spiral`
 * 1.4 → **9.6 %**. Recovering the plateau too would need one of these, and both measured worse:
 *
 * ⚠️ **Both bullets' recovery figures were measured against the single-reference draft** (the 19.8 / 11.3 %
 * column above), so they say the remedy WORKS, not how much is left to win — that is now ~6 points on one
 * preset. They stay rejected, and the second reason is stronger than the first.
 *
 * - **A small index-derived positional offset off the harvested orbit recovers it** — `nose-hoover` back to
 *   23.9 % / 2.07 h at 0.05·half-extent, `thomas` to 31.4 % at 0.20 — **and hands `rossler` a NaN
 *   population**: an offset point is off the attractor, and the Rössler flow escapes from there. Measured at
 *   0.08·half-extent: `Rössler Spiral` **114 of 2 000 particles escape**, median 116 steps, and `Rössler
 *   Wide` **1 160 of 2 000**, median 4 782 steps and up to 11 961 — i.e. slow enough that NO init-time
 *   screen can catch them, so this needs a runtime escape reseed on every ODE integrator (`iterateHalvorsen`
 *   has one; the other five do not). That is a separate change, and it is what would make the offset safe.
 * - **Jittering the reference's own `dtScale` per segment is escape-free** (`bad 0` on all eight presets, as
 *   it must be — the reference never leaves the attractor's neighbourhood) **but recovers almost nothing**:
 *   `thomas` 20.1 → 20.7 % at ±0.6, `nose-hoover` 11.5 → 15.7 %. Rejected on measurement, not on principle.
 *
 * ⚠️ **`seedRef()`'s constants are load-bearing for COVERAGE, not just for avoiding a fixed point, and the
 * bank does not make them safe to tidy.** With one reference, moving the seed to `(0.15, 0.15, 0.10)` gave
 * `Rössler Wide` 25.2 % where this function's law gave 51.1 % — coverage depended on which orbit that one
 * reference found. The bank averages over 32 of them, which is why `ODE_WARM_REFS` is also what removed the
 * non-mixing regression, but its `phi`/`rad` law is what spreads those 32 across a family of orbits rather
 * than clustering them on one. Re-measure all eight dropdown entries if any of it changes.
 *
 * ## The reseed guard
 *
 * A reference that diverges poisons every index harvested from it afterwards. `halvorsen` is known
 * Euler-unstable at `dt = 0.005` (see `ATTRACTOR_HALF_EXTENT`) and `iterateHalvorsen` has its own reseed, but
 * that one derives its offset from `i / count` — over a 32-wide reference bank that is 32 fixed offsets,
 * reused on every divergence, so a reference that escapes comes back to the same place. So the escape is
 * tested here too, the reseed offset is derived from the HARVEST index as well as the reference slot, and the
 * transient is re-discarded before harvesting resumes. Measured escapes over a 4 000-particle harvest: zero
 * on seven of the eight entries and **3 on `Rössler Wide`**, all recovered.
 */
function warmOdeAttractor(
  state: AttractorState, params: AttractorParams, start: number, count: number, budget: number = ODE_WARM_BUDGET,
): void {
  if (count <= start) return;
  const half = attractorHalfExtent(params.type) || 1;
  const escape = half * ODE_WARM_ESCAPE;
  // One state of `refCount` particles rather than `refCount` states of one: `iterateAttractor` steps a whole
  // population per call, so the references advance together for the price of a single call each step.
  const refCount = Math.max(1, Math.min(ODE_WARM_REFS, count - start));
  const ref = createAttractorState(refCount);
  const sink = new Float32Array(refCount);
  // ⚠️ The budget is divided by the WHOLE population and not by `count - start`, so a grown tail continues the
  // full seed's sampling law instead of spending a whole budget on 100 particles. With the tail size here, a
  // 100-particle tail wants `stride` 250 and the bank multiplies that by 32 references — 800 k steps, measured
  // 7–31 ms, on EVERY step of the Particle Number drag (the single-reference draft got away with it because
  // `ODE_WARM_STRIDE_MAX` clamped the product to 40 k). With the population it is `stride` 6, i.e. 19 k steps
  // and 0.6 ms, and the tail is decorrelated by the 32 ICs rather than by a long walk.
  const stride = Math.max(
    Math.ceil(ODE_WARM_STRIDE_MIN / refCount),
    Math.min(ODE_WARM_STRIDE_MAX, Math.round(budget / Math.max(1, count * refCount))),
  );
  // ⚠️ The sixth argument is `dtScale`, NOT a count — the population size comes from `state.x.length`, so
  // this must stay 1 however many references there are. Passing `refCount` here is the mistake this comment
  // exists to stop: it is clamped to 6.0 and every reference NaNs inside the first `ODE_WARM_SKIP` steps, the
  // harvest falls back to the seed circle, and the whole fix silently reverts to the defect it replaced.
  const advance = (steps: number): void => {
    for (let n = 0; n < steps; n++) iterateAttractor(ref, params, sink, sink, sink, 1);
  };

  // Off every coordinate axis: several of these systems have an invariant axis (the whole z-axis is
  // invariant for `lorenz`), on which a reference would sit at a fixed point forever. `salt` is the harvest
  // index on a re-seed and 0 on the initial spread, so a reference that escapes comes back somewhere else.
  const seedRef = (r: number, salt: number): void => {
    const phi = ((((r * 97) / refCount + salt) % 97) / 97) * Math.PI * 2;
    const rad = 0.1 + ((r + salt) % 7) * 0.05;
    ref.x[r] = rad * Math.cos(phi) + 0.05;
    ref.y[r] = rad * Math.sin(phi) + 0.05;
    ref.z[r] = rad * Math.sin(phi * 0.7) + 0.03;
  };
  for (let r = 0; r < refCount; r++) seedRef(r, 0);
  advance(ODE_WARM_SKIP);

  let retries = 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = start; i < count; i++) {
    advance(stride);
    const r = (i - start) % refCount;
    const x = ref.x[r]!, y = ref.y[r]!, z = ref.z[r]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
        x * x + y * y + z * z > escape * escape) {
      seedRef(r, i);
      // The whole set eats the transient, not just the re-seeded reference: a per-reference skip counter
      // would buy nothing — the other references are on their attractor already and extra steps there are
      // exactly the steps this function exists to spend.
      advance(ODE_WARM_SKIP);
      // ⚠️ The retry cap is what stops a hard-diverging parameter set (a user-authored `a` for
      // `halvorsen`, say) from spinning here forever: after `ODE_WARM_RETRIES` consecutive escapes the
      // remaining indices keep the seed-circle position written above, which is the pre-2026-09-20
      // behaviour — degraded, never hung. `break`, not `return`, so the collapse probe below still runs.
      if (++retries > ODE_WARM_RETRIES) break;
      i--; // this index has no position yet — harvest it after the fresh transient
      continue;
    }
    retries = 0;
    state.x[i] = x;
    state.y[i] = y;
    state.z[i] = z;
    if (x < lo[0]!) lo[0] = x; if (x > hi[0]!) hi[0] = x;
    if (y < lo[1]!) lo[1] = y; if (y > hi[1]!) hi[1] = y;
    if (z < lo[2]!) lo[2] = z; if (z > hi[2]!) hi[2] = z;
  }

  // The `Lorenz Tight` guard — see `ODE_WARM_MIN_STEP`. Measured on the harvest's own MOTION rather than on
  // the parameters, because "is this parameter set chaotic" has no cheap closed form and would have to be
  // re-derived for all six systems; asking whether the flow still moves answers it for every one of them at
  // once, including a user-authored set no table could cover.
  const px = ref.x.slice(0, refCount), py = ref.y.slice(0, refCount), pz = ref.z.slice(0, refCount);
  advance(ODE_WARM_PROBE);
  let travel = 0;
  for (let r = 0; r < refCount; r++) {
    const d = Math.hypot(ref.x[r]! - px[r]!, ref.y[r]! - py[r]!, ref.z[r]! - pz[r]!) / half;
    if (Number.isFinite(d) && d > travel) travel = d;
  }
  if (!(travel >= ODE_WARM_MIN_STEP)) {
    for (let i = start; i < count; i++) seedCircle(state, i, count, false);
    state.centreX = 0;
    state.centreY = 0;
    state.centreZ = 0;
    return;
  }

  // ⚠️ Only a FULL seed may publish the centre (`start === 0`), for the same reason `renderReady` is a
  // whole-state flag: a grown tail's bounding box is a sample of 100 points where the full seed's was a
  // sample of thousands, and adopting it would jiggle the whole figure's origin on every step of the
  // Particle Number drag. The tail is harvested against the centre already in force.
  if (start === 0) {
    state.centreX = (lo[0]! + hi[0]!) / 2;
    state.centreY = (lo[1]! + hi[1]!) / 2;
    state.centreZ = (lo[2]! + hi[2]!) / 2;
  }
}

/** The two discrete maps, whose rendered position is EMA-decoupled from their iteration. */
function isDiscreteMap(type: AttractorParams['type']): boolean {
  return type === 'clifford' || type === 'dejong';
}

/**
 * Types with NO meaningful third dimension, which must render perfectly flat and take their 3D purely
 * from the shared rotation pipeline.
 *
 * `clifford`/`dejong` are 2D maps (no `z` term in the recurrence at all); `julia`/`mandelbrot` are 2D
 * fields whose `z` carries ESCAPE TIME, an iteration count rather than a geometric coordinate. Feeding
 * either into the perspective divide tilts a flat figure onto a plane in space, which is exactly the
 * reported distortion.
 */
/**
 * v8 `33.5` — **does this type publish a per-particle escape scalar?**
 *
 * ⚠️ **A NAMED predicate rather than an inline `=== 'julia' || === 'mandelbrot'`, because it has FOUR
 * readers** — the generator's driver fallback, the channel array's fill gate, the Lab's option-hiding
 * test (`33.D17`) and `deformcheck`'s own clause. Four copies of one two-member test is how one of them
 * ends up disagreeing, which is the shape `closesAt` and `ratioBase` were both extracted for.
 *
 * ⚠️ **It is NOT `isFlatAttractor`**, even though the two currently overlap on these two members:
 * flatness is about whether `z` is a coordinate, this is about whether an escape GRID exists. `clifford`
 * and `dejong` are flat and have no escape field, so the sets differ already.
 */
export function hasEscapeField(type: AttractorParams['type']): boolean {
  return type === 'julia' || type === 'mandelbrot';
}

/**
 * v8 `33.D6` — **does this source live in a plane?** A TOTAL `Record`, so the build refuses a new member.
 *
 * ⚠️⚠️ **THIS REPLACED AN `if`-CHAIN, AND THE CHAIN WAS THE DEFECT RATHER THAN THE STYLE.** It read
 * `type === 'clifford' || type === 'dejong' || type === 'julia' || type === 'mandelbrot'`, so a new union
 * member **fell through to `false`** — inheriting a 3D-ness nobody had assigned it, silently, with `tsc`
 * clean. Measured the same day: `ATTRACTOR_HALF_EXTENT` is a `Partial<Record<...>>` and enforces nothing
 * either, so before this there was NO site at which adding a type was a compile error.
 *
 * ⚠️⚠️ **THIS RECORD OUTLIVED THE FEATURE THAT PROMPTED IT, AND THAT IS DELIBERATE.** It was written for
 * `33.6`'s `cylinderknot`, which the owner then dropped — but the DEFECT it found is older and still
 * here: before this, adding an attractor type was invisible to `tsc` at every site, because
 * `ATTRACTOR_HALF_EXTENT` is a `Partial<Record<...>>` and `isDiscreteMap` is an `if`-chain. **Deleting
 * this with the feature would have thrown away the only compile-time guard the union has**, which is the
 * shape `CLAUDE.md` already records for `TabId` and `RenderMode`.
 */
export const ATTRACTOR_FLATNESS: Record<AttractorParams['type'], boolean> = {
  clifford: true,
  dejong: true,
  julia: true,
  mandelbrot: true,
  lorenz: false,
  rossler: false,
  thomas: false,
  halvorsen: false,
  aizawa: false,
  'nose-hoover': false,
};

export function isFlatAttractor(type: AttractorParams['type']): boolean {
  return ATTRACTOR_FLATNESS[type];
}

/**
 * Half-extent of each attractor in its OWN units, measured rather than guessed.
 *
 * Sampled over 40 seeds × 40 000 iterations, discarding a 4 000-iteration transient. Used to fit the
 * figure to the canvas — see `attractorFit()` in `lissajous.ts`. The `bounds` field in the preset table
 * cannot serve this purpose: it is the escape-grid sampling window for julia/mandelbrot and only a rough
 * hand-written guess for the others, and several entries are off by 2× or more (`thomas` declares ±5
 * against a true ±3.84, `rossler` ±12 against ±26.4).
 *
 * ⚠️ `halvorsen` is deliberately absent. Its measured extent is **6 989** because forward Euler at
 * `dt = 0.005` is UNSTABLE for it — 1 % of particles (4 of 400) diverge to Infinity/NaN within 60 s from
 * the engine's own seed circle, and a NaN extent would poison the fit for every particle. It is clamped
 * instead; see `iterateHalvorsen`.
 */
const ATTRACTOR_HALF_EXTENT: Partial<Record<AttractorParams['type'], number>> = {
  clifford: 2.20,
  dejong: 2.00,
  lorenz: 27.58,
  rossler: 26.39,
  thomas: 3.84,
  halvorsen: 8.00,
  aizawa: 1.61,
  'nose-hoover': 5.91,
};

/** Measured half-extent in attractor units, or a sane default for an unlisted type. */
export function attractorHalfExtent(type: AttractorParams['type']): number {
  return ATTRACTOR_HALF_EXTENT[type] ?? 2.0;
}

/**
 * Fraction of the population whose discrete-map TARGET is re-iterated per frame at speed 1.0.
 *
 * 1/45 means a given particle's target moves roughly every 0.75 s at 60 fps, so ~98 % of the cloud is
 * holding still on any one frame and the structure is legible. Combined with `DISCRETE_EMA_BASE` below,
 * a particle then *travels* to its new target over several frames instead of jumping.
 */
const DISCRETE_SUBSET_FRACTION = 1 / 45;

/**
 * Per-frame EMA weight for chasing the discrete-map target at speed 1.0 and 60 fps.
 *
 * Deliberately low: the target is up to 94 % of the figure away, so this is the difference between a
 * teleport and a visible sweep along the attractor. Scaled by `dtScale` below so the visual rate is
 * frame-rate independent.
 */
const DISCRETE_EMA_BASE = 0.06;

/**
 * Advance the attractor one frame and write normalised positions.
 *
 * ## `dtScale` — the parameter this function did not used to have (2026-08-13)
 *
 * `dtScale` is `(frameMs / 16.667) × speedFactor`, i.e. 1.0 at 60 fps with the speed slider centred.
 * Before it existed this function took no time argument at all, which caused two separate defects:
 *
 * 1. **The Visual FX Speed slider was completely inert for attractors** — `main.ts` scales nine other
 *    subsystems by `speedFactor` and this was the one that never received it, so at blend 1 the speed
 *    control did nothing whatsoever.
 * 2. **Attractors ran at a frame-rate-dependent speed** — one integration step per *frame* with a
 *    hardcoded `dt`, so the same preset evolved **2.4× faster at 144 Hz than at 60 Hz**. Same class of
 *    defect as the old per-frame `dissipation`, which `thermalLag` was introduced to fix.
 *
 * ⚠️ **The two families consume it differently, and conflating them is wrong.** The ODE types scale their
 * integration `dt`, which is a true continuous time step. The discrete maps have NO `dt` to scale — a
 * chaotic recurrence has no continuous time parameter — so for them `dtScale` instead governs how much of
 * the population is re-targeted per frame and how fast the render position chases it. That is why the
 * flicker fix and the speed fix had to be built together: the EMA is what gives a discrete map a
 * meaningful speed control in the first place.
 *
 * `dtScale` is clamped to 6.0, matching the existing `correction` clamp in `LissajousGenerator.update()`,
 * so a long stall (tab restore, GC pause) cannot integrate a huge unstable step.
 */
/**
 * v8 `33.4`/`33.5` — the escape-time extras, as ONE options object rather than two trailing positionals.
 *
 * ⚠️ **Optional in both halves, so no existing caller changes and no behaviour moves.** Absent
 * `escapeFlow` means `'contour'`, which is what every preset authored before this phase gets; absent
 * `outEscape` means the scalar is computed and dropped exactly as it was before.
 *
 * ⚠️ **Both are inert for 9 of the 11 attractor types** — only `julia` and `mandelbrot` build an escape
 * grid at all. That is why the UI HIDES the escape driver rather than offering it everywhere (`33.D17`),
 * and why the generator falls back to `index` when the array is short.
 */
export interface EscapeFlowOpts {
  escapeFlow?: 'contour' | 'ray';
  outEscape?: Float32Array;
  /**
   * v8 Phase 37 follow-up — the escape grid's resolution. Absent = `GRID_SIZE` (512), the main view's. A preview
   * tile passes a smaller grid: the build is `size²` escape evaluations, and the grid cache keys on the size, so a
   * tile grid and a main-view grid never stand in for each other.
   */
  gridSize?: number;
}

export function iterateAttractor(
  state: AttractorState,
  params: AttractorParams,
  outX: Float32Array,
  outY: Float32Array,
  outZ: Float32Array,
  dtScale = 1,
  opts?: EscapeFlowOpts,
): void {
  const ray = opts?.escapeFlow === 'ray';
  const outEscape = opts?.outEscape;
  const gridSize = opts?.gridSize ?? GRID_SIZE;
  const count = state.x.length;
  const type = params.type;
  const p = params.params;
  const ts = Math.max(0, Math.min(dtScale, 6.0));

  switch (type) {
    case 'clifford':
      iterateClifford(state, count, p[0]!, p[1]!, p[2]!, p[3]!, ts);
      break;
    case 'dejong':
      iterateDeJong(state, count, p[0]!, p[1]!, p[2]!, p[3]!, ts);
      break;
    case 'lorenz':
      iterateLorenz(state, count, p[0]!, p[1]!, p[2]!, p[3]! * ts);
      break;
    case 'rossler':
      iterateRossler(state, count, p[0]!, p[1]!, p[2]!, p[3]! * ts);
      break;
    case 'thomas':
      iterateThomas(state, count, p[0]!, p[1]! * ts);
      break;
    case 'halvorsen':
      iterateHalvorsen(state, count, p[0]!, p[1]! * ts);
      break;
    case 'aizawa':
      iterateAizawa(state, count, p[0]!, p[1]!, p[2]!, p[3]! * ts);
      break;
    case 'nose-hoover':
      iterateNoseHoover(state, count, p[0]!, p[1]! * ts);
      break;
    case 'julia':
      iterateJuliaFlow(state, count, p[0]!, p[1]!, params.bounds, params.maxIter ?? 256, ts, ray, outEscape, gridSize);
      break;
    case 'mandelbrot':
      iterateMandelbrotFlow(state, count, params.bounds, params.maxIter ?? 256, ts, ray, outEscape, gridSize);
      break;
  }

  // --- Normalisation to [-1, 1] ---
  //
  // ⚠️ The SOURCE of the normalising extent differs by family, and this is load-bearing.
  //
  // `julia`/`mandelbrot` normalise against `bounds`, because for them `bounds` genuinely IS the figure:
  // it is the sampling window of the escape grid and particles are hard-confined inside it.
  //
  // Everything else normalises against its MEASURED extent, because for those types `bounds` is only a
  // hand-written guess that was never checked against the dynamics — `thomas` declares ±5 against a true
  // ±3.84, `rossler` ±12 against ±26.4. Normalising a ±26.4 attractor by ±12 emits values out to 2.2,
  // i.e. more than double the [-1,1] the name of this step promises, which then propagates straight into
  // the screen-space fit downstream.
  const flat = isFlatAttractor(type);
  const discrete = isDiscreteMap(type);

  if (type === 'julia' || type === 'mandelbrot') {
    const [xMin, yMin, xMax, yMax] = params.bounds;
    const xRange = (xMax - xMin) || 4;
    const yRange = (yMax - yMin) || 4;
    const xCenter = (xMin + xMax) / 2;
    const yCenter = (yMin + yMax) / 2;
    for (let i = 0; i < count; i++) {
      outX[i] = (state.x[i]! - xCenter) / (xRange / 2);
      outY[i] = (state.y[i]! - yCenter) / (yRange / 2);
      outZ[i] = 0; // escape time is not a coordinate — see `isFlatAttractor`
    }
    return;
  }

  const half = attractorHalfExtent(type) || 1;
  // Z shares the XY scale so the figure keeps its true proportions in depth. Previously this was a bare
  // `state.z[i] * 0.3` with the comment "Z is less pronounced" — un-normalised, so `lorenz` (whose z
  // climbs to ~50) emitted 15.0 where x and y were inside ±1. Downstream that placed the figure ~9 900 px
  // BEHIND the near plane, where perspective shrank it 12–20× and rotation swung it on a radius of that
  // same 9 900 px — measured 468 px of screen travel for a 30° turn, i.e. the figure sailing out of frame
  // and back. That is the "evolves for 3 s then the screen goes black" report; it was never a cull.
  // ⚠️ The centre is subtracted BEFORE the divide and is zero for every type that is centred by
  // construction, so this is one expression for all eight — see `AttractorState.centreX` for why a
  // translation is needed at all and why it may not be a per-type constant.
  const cx = state.centreX;
  const cy = state.centreY;
  const cz = state.centreZ;
  for (let i = 0; i < count; i++) {
    outX[i] = ((discrete ? state.rx[i]! : state.x[i]!) - cx) / half;
    outY[i] = ((discrete ? state.ry[i]! : state.y[i]!) - cy) / half;
    outZ[i] = flat ? 0 : (state.z[i]! - cz) / half;
  }
}

// --- Discrete map attractors ---

/**
 * Advance a `count`-sized rotating SUBSET of the map, then EMA-chase the rendered position.
 *
 * ## Why the whole population must not be iterated every frame
 *
 * Consecutive iterates of a chaotic map are UNCORRELATED — that is the definition of chaos, not an
 * artifact. Measured on `Clifford Classic`, the mean per-frame hop is **51.6 % of the whole figure
 * extent** (max 94 %), so at 60 fps a particle covered ~3 100 % of the figure per second. The attractor's
 * *shape* was still statistically correct at any instant, which is why it read as "a random position
 * assigned to each particle in a short time" — a cloud of noise in the shape of a Clifford attractor,
 * flickering at the refresh rate.
 *
 * ⚠️ **There is no "slow it down" fix, because a discrete map has no `dt`.** Halving anything inside the
 * recurrence changes which attractor it is. The only two available levers are *how many* particles jump
 * per frame and *how fast the drawn dot travels* to its new target, which is exactly what this does:
 *
 * - **Subset:** only `count × DISCRETE_SUBSET_FRACTION × speed` particles re-iterate per frame, walked
 *   from a rotating `cursor` so coverage is uniform over time. The rest hold their target.
 * - **EMA:** `rx`/`ry` chase `x`/`y` at `DISCRETE_EMA_BASE × dtScale`, so a re-targeted particle sweeps
 *   along a visible path instead of teleporting.
 *
 * Together these give the maps a real speed control for the first time — at `dtScale` 0.1 the cloud
 * crawls, at 5.0 it approaches the old behaviour. Both terms are `dtScale`-proportional, so the visual
 * rate is frame-rate independent.
 *
 * ⚠️ **`rx`/`ry` are what gets DRAWN and `x`/`y` are the map state; they must not be conflated.** Writing
 * the EMA back into `x`/`y` would corrupt the recurrence — the map would iterate from a point that is not
 * on its own orbit, and the attractor's structure would dissolve.
 */
function advanceDiscreteMap(
  s: AttractorState,
  count: number,
  dtScale: number,
  step: (i: number) => void,
): void {
  if (count <= 0) return;

  // How many targets to advance this frame. `ceil` on a fractional budget would advance one particle per
  // frame even at speed 0, so the fraction is accumulated as a cursor over the population instead: the
  // subset size is a plain rounded count, and `cursor` carries the remainder across frames by construction.
  const budget = Math.min(count, Math.max(0, Math.round(count * DISCRETE_SUBSET_FRACTION * dtScale)));
  let c = s.cursor % count;
  for (let n = 0; n < budget; n++) {
    step(c);
    c = c + 1 === count ? 0 : c + 1;
  }
  s.cursor = c;

  if (!s.renderReady) {
    for (let i = 0; i < count; i++) {
      s.rx[i] = s.x[i]!;
      s.ry[i] = s.y[i]!;
    }
    s.renderReady = true;
    return;
  }

  const k = Math.min(1, DISCRETE_EMA_BASE * dtScale);
  for (let i = 0; i < count; i++) {
    s.rx[i] = s.rx[i]! + (s.x[i]! - s.rx[i]!) * k;
    s.ry[i] = s.ry[i]! + (s.y[i]! - s.ry[i]!) * k;
  }
}

function iterateClifford(
  s: AttractorState, count: number, a: number, b: number, c: number, d: number, dtScale: number,
): void {
  advanceDiscreteMap(s, count, dtScale, (i) => {
    const x = s.x[i]!;
    const y = s.y[i]!;
    s.x[i] = Math.sin(a * y) + c * Math.cos(a * x);
    s.y[i] = Math.sin(b * x) + d * Math.cos(b * y);
  });
}

function iterateDeJong(
  s: AttractorState, count: number, a: number, b: number, c: number, d: number, dtScale: number,
): void {
  advanceDiscreteMap(s, count, dtScale, (i) => {
    const x = s.x[i]!;
    const y = s.y[i]!;
    s.x[i] = Math.sin(a * y) - Math.cos(b * x);
    s.y[i] = Math.sin(c * x) - Math.cos(d * y);
  });
}

// --- Continuous ODE attractors ---

function iterateLorenz(s: AttractorState, count: number, sigma: number, rho: number, beta: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    s.x[i] = x + dx * dt;
    s.y[i] = y + dy * dt;
    s.z[i] = z + dz * dt;
  }
}

function iterateRossler(s: AttractorState, count: number, a: number, b: number, c: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = -y - z;
    const dy = x + a * y;
    const dz = b + z * (x - c);
    s.x[i] = x + dx * dt;
    s.y[i] = y + dy * dt;
    s.z[i] = z + dz * dt;
  }
}

function iterateThomas(s: AttractorState, count: number, b: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = Math.sin(y) - b * x;
    const dy = Math.sin(z) - b * y;
    const dz = Math.sin(x) - b * z;
    s.x[i] = x + dx * dt;
    s.y[i] = y + dy * dt;
    s.z[i] = z + dz * dt;
  }
}

/**
 * Radius beyond which a Halvorsen particle is treated as having escaped and is reseeded.
 *
 * The true attractor lives inside about ±8, so 24 is 3× clear of anything legitimate.
 */
const HALVORSEN_ESCAPE_RADIUS = 24;

/**
 * ⚠️ **Halvorsen genuinely DIVERGES under forward Euler at its authored `dt`, and this is not cosmetic.**
 *
 * Its quadratic terms are all `-y²`/`-z²`/`-x²` — same sign, no restoring cross-term — so an over-large
 * step compounds outward without bound. Measured from the engine's own seed circle at `dt = 0.005`:
 * **4 of 400 particles (1 %) reach Infinity or NaN within 60 s**, and the population's measured extent is
 * **6 989** against a true attractor of roughly ±8.
 *
 * A NaN or 6 989 outlier is not merely an invisible particle: it poisons any population-wide statistic
 * computed over these arrays, and it is written into the shared `positions` buffer where downstream
 * consumers (teleport guards, the velocity EMA) see it. So escapees are **reseeded near the origin**
 * rather than clamped — the origin region is on the attractor's basin, so a reseeded particle rejoins the
 * structure within a few hundred steps, whereas clamping to the escape radius would park a permanent dot
 * on a sphere that is not part of the attractor at all.
 *
 * The reseed offset is derived from `i`, not from `Math.random()`, so it is deterministic and so that two
 * particles escaping on the same frame do not land on the same point.
 */
function iterateHalvorsen(s: AttractorState, count: number, a: number, dt: number): void {
  const rEsc = HALVORSEN_ESCAPE_RADIUS;
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = -a * x - 4 * y - 4 * z - y * y;
    const dy = -a * y - 4 * z - 4 * x - z * z;
    const dz = -a * z - 4 * x - 4 * y - x * x;
    const nx = x + dx * dt;
    const ny = y + dy * dt;
    const nz = z + dz * dt;
    if (
      !Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz) ||
      nx * nx + ny * ny + nz * nz > rEsc * rEsc
    ) {
      const phi = (i / (count || 1)) * Math.PI * 2;
      const r = 0.1 + (i % 7) * 0.05;
      s.x[i] = r * Math.cos(phi);
      s.y[i] = r * Math.sin(phi);
      s.z[i] = r * Math.sin(phi * 0.7);
      continue;
    }
    s.x[i] = nx;
    s.y[i] = ny;
    s.z[i] = nz;
  }
}

function iterateAizawa(s: AttractorState, count: number, a: number, b: number, c: number, dt: number): void {
  const d = 3.5;
  const e = 0.25;
  const f = 0.1;
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = (z - b) * x - d * y;
    const dy = d * x + (z - b) * y;
    const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
    s.x[i] = x + dx * dt;
    s.y[i] = y + dy * dt;
    s.z[i] = z + dz * dt;
  }
}

function iterateNoseHoover(s: AttractorState, count: number, a: number, dt: number): void {
  for (let i = 0; i < count; i++) {
    const x = s.x[i]!;
    const y = s.y[i]!;
    const z = s.z[i]!;
    const dx = y;
    const dy = -x + y * z;
    const dz = a - y * y;
    s.x[i] = x + dx * dt;
    s.y[i] = y + dy * dt;
    s.z[i] = z + dz * dt;
  }
}

// --- Escape-time flow attractors ---
// Matches legacy: precomputed 512×512 blurred grid, bilinear sampling, central differences

const GRID_SIZE = 512;

interface EscapeGrid {
  data: Float32Array;
  bounds: [number, number, number, number];
  maxIter: number;
  size: number;
  fracType: 'julia' | 'mandelbrot';
  params: number[];
  /**
   * Interleaved `x, y` model-space positions where the flow field is KNOWN to be followable — i.e. cells
   * that pass the same three tests `escapeFlowStep` applies before it will move a particle. Empty when the
   * whole window is interior or unsampled (`Mandelbrot Needle` before its re-bounding was exactly that).
   *
   * See `pickRespawn` for why respawning here rather than uniformly in the rectangle is the whole fix for
   * the "a rectangle in space filled with noise" report.
   */
  seeds: Float32Array;
}

/**
 * Cap on stored respawn seeds per grid, ~128 KB. 512² valid cells would be 2 MB per cached grid and buy
 * nothing — respawn only needs a representative sample of the followable region, not every cell of it.
 */
const MAX_SEEDS = 16384;

/**
 * Width of the density taper at the mask edge, as a fraction of the ellipse radius.
 *
 * `0` would give a hard-edged oval — better than a rectangle, but still a visible cut line. The taper
 * thins the SEED DENSITY over the outer 18 % of the radius so the figure dissolves instead of stopping.
 */
const MASK_TAPER = 0.18;

/**
 * Normalised radius inside the window's inscribed ellipse: `<= 1` is inside, `> 1` outside.
 *
 * ## Why an ellipse and not the `bounds` rectangle
 *
 * ⚠️ **This is the fix for "it runs inside a cutoff rectangle, which doesn't look nice" (2026-08-13), and
 * the defect was STRUCTURAL — not a property of any one preset.** `escapeFlowStep` refused a step that left
 * `bounds` and `collectSeeds` seeded valid cells right up to the border, so wherever the escape field is
 * followable at the window edge, particles were both *drawn* there and *stopped* there. The window edge
 * therefore became a crisp four-sided clip line. Measured perimeter-fill fraction (share of border cells
 * that are followable, i.e. that produce a clip line) over the shipped Mandelbrot windows:
 *
 *   Starfish 100 %, Spiral Galaxy 100 %, Mini-brot 100 %, Needle 100 %, Full Set 100 %, Antenna Tip 100 %,
 *   Scepter Valley 84 %, Double Spiral 72 %, Seahorse Valley 48 %, Elephant Valley 33 %
 *
 * — **six of ten clipped on all four sides**, including both windows re-bounded earlier the same day, so
 * this was already predicting their appearance before either had been looked at.
 *
 * ⚠️ **Read the `bounds` out of `ATTRACTOR_PRESETS` when re-measuring any of this.** Reconstructing them
 * from notes produced a table that was wrong on four of the ten windows *and* reported a mode flip on
 * `Scepter Valley` that does not exist — twice in one day, the second time after the first had been caught.
 *
 * ⚠️ **All 12 Julia presets ALSO measure 100 % perimeter fill and were never reported as rectangular**,
 * which is the observation that makes the ellipse the right shape rather than a wider rectangle. Far from
 * the Julia set the iso-contours are near-circles, so particles orbit *within* the box and the visible
 * silhouette is already an inscribed disc; in a deep Mandelbrot zoom the contours run straight across the
 * window, so every flow line terminates on the wall. Masking to an ellipse gives the Mandelbrot windows the
 * silhouette the Julia ones get for free, and is a no-op for the Julia ones by construction.
 *
 * **Widening `bounds` was measured and rejected as the general fix — it buys silhouette with zoom.**
 * Sweeping `Spiral Galaxy` outward from its shipped span of 0.002: 0.004 → 99.7 % perimeter (no gain),
 * 0.01 → 74 % perimeter but followable area collapses 100 % → 86 %, 0.05 → 37 % followable, i.e. back to
 * the noise-in-a-rectangle failure the re-bounding existed to cure. `Starfish` tolerates more (span 0.08 →
 * 90 % perimeter at 95 % followable) but by then the starfish is no longer in frame.
 *
 * ## Measured cost and effect
 *
 * ## Measured effect and cost
 *
 * **Perimeter fill falls to 0.0–0.1 % on all ten windows** — the clip line is gone, the residual being the
 * four cells where the ellipse osculates the rectangle.
 *
 * ⚠️ **The cost is 0–50 % of the SEED LIST, and it is NOT the `1 - π/4 = 21.5 %` a pure-ellipse argument
 * gives.** Two reasons, and quoting the geometric figure (as an earlier version of this comment did) is
 * wrong on both counts: the taper thins a band *inside* the ellipse as well as removing the corners outside
 * it, and for 8 of the 10 windows the list is the boundary-adjacent cells rather than all valid ones, so
 * what matters is where the *filaments* sit, not the area. Retained, measured at 512² on the shipped bounds:
 *
 *   Full Set 100 %, Needle 99.8 %, Mini-brot 99.1 %, Antenna Tip 98.1 %, Elephant Valley 74.6 %,
 *   Seahorse Valley 72.2 %, Double Spiral 69.7 %, Scepter Valley 68.5 %, Starfish 65.8 %,
 *   Spiral Galaxy 50.2 %
 *
 * The four cheapest are the deep zooms whose structure runs through the middle; the ellipse only removes
 * corners they had nothing in. That is the intended shape of the trade — the corners are exactly the region
 * whose flow lines cannot curve back into frame.
 *
 * ⚠️ **Seed count is not particle count.** Population is fixed by `particleCount`; the list only decides
 * *where* a respawning particle is placed, so a shorter list means denser reuse of good positions, not a
 * sparser figure.
 *
 * ⚠️ **`collectSeeds`' `nEdge >= 64` mode switch was checked against the mask and does NOT flip on any
 * shipped window** — that was a real hazard, since halving the edge count could drop a window under the
 * threshold and silently switch it from boundary seeding to seeding everywhere. Closest cases: `Spiral
 * Galaxy` 231 → 116 (stays above) and `Starfish` 55 → 44 (was already below, so unchanged). **Re-check this
 * if `MASK_TAPER` is widened or a new window is added.**
 */
function maskRadius(bounds: [number, number, number, number], x: number, y: number): number {
  const hw = (bounds[2] - bounds[0]) * 0.5;
  const hh = (bounds[3] - bounds[1]) * 0.5;
  const u = (x - (bounds[0] + hw)) / hw;
  const v = (y - (bounds[1] + hh)) / hh;
  return Math.sqrt(u * u + v * v);
}

/**
 * Deterministic per-cell value in [0,1) for the seed-density taper.
 *
 * ⚠️ **Must NOT be `pseudoRandom()`.** That generator is shared with particle iteration, and `collectSeeds`
 * runs during a grid BUILD — so drawing from it would make a cached grid's seed list depend on how many
 * frames had been rendered when the build happened, i.e. the same `bounds` would yield different seeds on a
 * cache miss than on a rebuild. Hashing the cell coordinates keeps the grid a pure function of its inputs.
 */
function cellHash(gx: number, gy: number): number {
  let h = (gx * 374761393 + gy * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Collect positions where `escapeFlowStep` will actually produce motion.
 *
 * ⚠️ **The three tests here must stay in step with `escapeFlowStep`'s own.** A seed that fails them is a
 * particle that respawns and immediately respawns again — the exact per-frame teleport loop this exists to
 * remove.
 *
 * Cells adjacent to a *failing* cell are preferred, because that is the escape-time boundary: the
 * filaments and "rivers" that give these presets their structure. Where no such boundary exists inside the
 * window (a fully-escaping view — `Mandelbrot Starfish` is the shipped extreme at 62 edge cells out of 512²)
 * that set is nearly empty and valid cells are used instead — biasing toward a boundary that is not in frame
 * would otherwise pile every particle onto the window edge.
 *
 * ⚠️ **A high valid fraction is necessary and NOT sufficient for a usable window, and the boundary count is
 * only half of the sufficient test.** `Mandelbrot Lightning` was 100 % valid with **0** edge cells *and* an
 * escape range of only 3.7 across the whole grid — a near-constant field, so the perpendicular gradient was
 * both tiny and near-uniform in direction, and it rendered as uniform drift. It was deleted 2026-08-13.
 * Starfish and Spiral Galaxy have the same 100 % figure with ranges of 490.7 and 756.4 and read correctly.
 * **When choosing a new window, measure (valid fraction, edge cells, escape range) — not just the first.**
 */
function collectSeeds(grid: Float32Array, size: number, maxIter: number, bounds: [number, number, number, number]): Float32Array {
  const ok = (v: number): boolean => v >= 0 && v > 2 && v < maxIter - 2;
  const dx = (bounds[2] - bounds[0]) / size;
  const dy = (bounds[3] - bounds[1]) / size;

  /**
   * Accept a cell for seeding, thinning with depth into the taper band so the figure's edge dissolves.
   *
   * ⚠️ **The taper is in SEED DENSITY, not in particle alpha, and that is a deliberate choice rather than an
   * approximation of one.** A true alpha fade needs a per-particle channel, and `AttractorState` has none
   * free — `x`/`y` are position and `z` is already the escape value feeding depth *and* colour. Adding one
   * would mean a fourth array plumbed through the blend site in `lissajous.ts` and both renderer paths, for
   * a cue that thinning delivers for free: fewer particles per unit area reads as a fade, because the eye
   * judges the edge of a particle cloud by local density.
   */
  const keep = (gx: number, gy: number): boolean => {
    const r = maskRadius(bounds, bounds[0] + (gx + 0.5) * dx, bounds[1] + (gy + 0.5) * dy);
    if (r >= 1) return false;
    if (r <= 1 - MASK_TAPER) return true;
    // Linear in radius across the band: 1.0 at the inner edge falling to 0.0 at the ellipse.
    return cellHash(gx, gy) < (1 - r) / MASK_TAPER;
  };

  // Pass 1 — count, twice: boundary-adjacent cells and all valid cells.
  let nEdge = 0;
  let nAll = 0;
  for (let gy = 1; gy < size - 1; gy++) {
    for (let gx = 1; gx < size - 1; gx++) {
      const idx = gy * size + gx;
      if (!ok(grid[idx]!)) continue;
      if (!keep(gx, gy)) continue;
      nAll++;
      if (
        !ok(grid[idx - 1]!) || !ok(grid[idx + 1]!) ||
        !ok(grid[idx - size]!) || !ok(grid[idx + size]!)
      ) nEdge++;
    }
  }

  const edgeOnly = nEdge >= 64;
  const total = edgeOnly ? nEdge : nAll;
  if (total === 0) return new Float32Array(0);

  const stride = Math.max(1, Math.ceil(total / MAX_SEEDS));
  const out = new Float32Array(Math.ceil(total / stride) * 2);
  let seen = 0;
  let w = 0;
  for (let gy = 1; gy < size - 1 && w < out.length; gy++) {
    for (let gx = 1; gx < size - 1 && w < out.length; gx++) {
      const idx = gy * size + gx;
      if (!ok(grid[idx]!)) continue;
      // Same predicate and same order as pass 1 — `keep` is deterministic per cell, so the two passes agree.
      if (!keep(gx, gy)) continue;
      if (edgeOnly && ok(grid[idx - 1]!) && ok(grid[idx + 1]!) && ok(grid[idx - size]!) && ok(grid[idx + size]!)) continue;
      if (seen++ % stride !== 0) continue;
      out[w++] = bounds[0] + (gx + 0.5) * dx;
      out[w++] = bounds[1] + (gy + 0.5) * dy;
    }
  }
  return w === out.length ? out : out.subarray(0, w);
}

/**
 * Cached escape grids, most-recently-used first.
 *
 * ## Why exact-match caching was not enough
 *
 * Building one grid is `512² × maxIter` iterations plus 3 blur passes. Measured on this machine:
 * **23 ms** (full set, span 4.0, 256 iter), **147 ms** (span 0.4, 600 iter), **67 ms** (deep zoom,
 * span 0.005, 1000 iter) — i.e. a 6.8 fps ceiling in the worst case if it happens every frame.
 *
 * The previous cache was a single slot keyed on an EXACT string,
 * `` `${fracType}:${params}:${bounds}` ``. That is a perfect hit for a static preset, and a guaranteed
 * MISS for the one case that matters: `interpolatePreset` lerps `fractal.params` and `fractal.bounds`
 * continuously, and the Mixer crossfader fires `applyCrossfade` on every `input` event, so every frame
 * of a fractal crossfade produced a brand-new key. Enlarging that slot into an LRU would not have
 * helped — with continuously-varying floats the hit rate stays at **0%** however many entries it has,
 * because no key is ever requested twice.
 *
 * So reuse is decided by TOLERANCE rather than identity: a cached grid is accepted when it is close
 * enough that rebuilding would not visibly change the flow field. The escape field is smooth in both
 * `bounds` and `params`, and it drives a direction field rather than being displayed directly, so a
 * sub-percent offset is not observable. A large jump still misses and rebuilds, which is what keeps a
 * deck A → deck B switch correct instead of sampling a non-overlapping grid.
 *
 * Two entries, not one: tolerance handles a continuous drag, but flicking the crossfader between the
 * two ends alternates between two distant keys, which would thrash a single slot. Cost is 1 MB per
 * entry (512² × 4 bytes), so this is deliberately small.
 */
const MAX_CACHED_GRIDS = 2;
const cachedGrids: EscapeGrid[] = [];
/*
 * v8 Phase 37 follow-up — ⚠️⚠️ **THE TILE TIER'S SMALL GRIDS LIVE IN A CACHE OF THEIR OWN.** The main view's cache holds
 * TWO entries, so a handful of Julia/Mandelbrot tiles sharing it would evict the main view's 512² grid on every scroll
 * and cost it a 50–90 ms rebuild. A grid whose size is not `GRID_SIZE` goes here instead: 32 entries of a 64² grid
 * are ~0.5 MB, and the main view's two slots are never touched by a tile.
 */
const MAX_CACHED_TILE_GRIDS = 32;
const cachedTileGrids: EscapeGrid[] = [];

/**
 * Bounds tolerance, as a fraction of the view span — so it tightens automatically as the user zooms in
 * and the same *relative* precision is kept at every scale.
 */
const BOUNDS_REUSE_TOLERANCE = 0.015;

/**
 * Params tolerance, ABSOLUTE rather than span-relative. Julia's `c` lives in a fixed ~[-2, 2] plane
 * whose scale is independent of how far the view is zoomed in, so scaling this by the span would make
 * it meaninglessly tight at deep zoom (7.5e-5 at span 0.005) and force a rebuild per frame again —
 * reintroducing exactly the defect this cache exists to fix.
 *
 * Deliberately CONSERVATIVE, and not raised further because the obvious measurement does not support
 * it. Perturbing `c` and comparing the resulting flow directions (the quantity `escapeFlowStep`
 * actually follows) gives a mean change that is *non-monotonic* in the perturbation — 3.9° at 0.0005,
 * 6.3° at 0.005, then back to 2.7° at 0.01 — because the field is chaotic at pixel scale near the set
 * boundary, where the gradient is small and its direction is noise-dominated. There is no clean
 * threshold to read off, so the value is set low enough that its effect stays within that intrinsic
 * noise floor rather than being tuned against a metric that cannot discriminate.
 */
const PARAMS_REUSE_TOLERANCE = 0.002;

function canReuseGrid(
  g: EscapeGrid,
  fracType: 'julia' | 'mandelbrot',
  params: number[],
  bounds: [number, number, number, number],
  size: number = GRID_SIZE,
): boolean {
  if (g.fracType !== fracType || g.size !== size) return false;
  if (g.params.length !== params.length) return false;

  const span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (!(span > 0)) return false;

  // A grid whose adaptive iteration count would differ is NOT interchangeable: `escapeFlowStep` gates
  // on `iter >= maxIter - 2` to detect interior points, so a mismatch changes which particles respawn.
  if (computeAdaptiveMaxIter(bounds) !== g.maxIter) return false;

  const boundsTol = span * BOUNDS_REUSE_TOLERANCE;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(g.bounds[i]! - bounds[i]!) > boundsTol) return false;
  }
  for (let i = 0; i < params.length; i++) {
    if (Math.abs(g.params[i]! - params[i]!) > PARAMS_REUSE_TOLERANCE) return false;
  }
  return true;
}

function computeAdaptiveMaxIter(bounds: [number, number, number, number]): number {
  const bw = bounds[2] - bounds[0];
  const bh = bounds[3] - bounds[1];
  const span = Math.max(bw, bh);
  if (span > 2.0) return 256;
  if (span > 0.5) return 400;
  if (span > 0.1) return 600;
  if (span > 0.01) return 800;
  return 1000;
}

function blurGrid(grid: Float32Array, size: number, passes: number): void {
  const tmp = new Float32Array(size * size);
  for (let p = 0; p < passes; p++) {
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        tmp[idx] = (
          grid[idx - size - 1]! + grid[idx - size]! + grid[idx - size + 1]! +
          grid[idx - 1]! + grid[idx]! * 4 + grid[idx + 1]! +
          grid[idx + size - 1]! + grid[idx + size]! + grid[idx + size + 1]!
        ) / 12.0;
      }
    }
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        grid[y * size + x] = tmp[y * size + x]!;
      }
    }
  }
}

function buildEscapeGrid(
  fracType: 'julia' | 'mandelbrot', params: number[], bounds: [number, number, number, number], gridSize: number = GRID_SIZE,
): EscapeGrid {
  const cache = gridSize === GRID_SIZE ? cachedGrids : cachedTileGrids;
  const cap = gridSize === GRID_SIZE ? MAX_CACHED_GRIDS : MAX_CACHED_TILE_GRIDS;
  for (let i = 0; i < cache.length; i++) {
    const g = cache[i]!;
    if (canReuseGrid(g, fracType, params, bounds, gridSize)) {
      // Promote to most-recently-used so alternating between two configurations keeps both alive.
      if (i > 0) {
        cache.splice(i, 1);
        cache.unshift(g);
      }
      return g;
    }
  }

  const size = gridSize;
  const grid = new Float32Array(size * size);
  const maxIter = computeAdaptiveMaxIter(bounds);
  const dx = (bounds[2] - bounds[0]) / size;
  const dy = (bounds[3] - bounds[1]) / size;

  for (let gy = 0; gy < size; gy++) {
    const py = bounds[1] + (gy + 0.5) * dy;
    for (let gx = 0; gx < size; gx++) {
      const px = bounds[0] + (gx + 0.5) * dx;
      if (fracType === 'julia') {
        grid[gy * size + gx] = smoothEscapeJulia(px, py, params[0]!, params[1]!, maxIter);
      } else {
        grid[gy * size + gx] = smoothEscapeMandelbrot(px, py, maxIter);
      }
    }
  }

  blurGrid(grid, size, 3);

  // Copy both, so a later mutation of the caller's arrays cannot silently invalidate a cached grid
  // while leaving it matchable. `bounds` in particular arrives straight off the preset object.
  const entry: EscapeGrid = {
    data: grid,
    bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
    maxIter,
    size,
    fracType,
    params: params.slice(),
    // Computed once per grid BUILD, not per frame: it is a full 512² scan, and it is cached alongside the
    // grid it describes so a tolerance hit reuses both.
    seeds: collectSeeds(grid, size, maxIter, bounds),
  };
  cache.unshift(entry);
  if (cache.length > cap) cache.length = cap;
  return entry;
}

function sampleGrid(grid: EscapeGrid, x: number, y: number): number {
  const { data, bounds, size } = grid;
  const fx = (x - bounds[0]) / (bounds[2] - bounds[0]) * size - 0.5;
  const fy = (y - bounds[1]) / (bounds[3] - bounds[1]) * size - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  if (ix < 0 || ix >= size - 1 || iy < 0 || iy >= size - 1) return -1;
  const tx = fx - ix;
  const ty = fy - iy;
  const idx = iy * size + ix;
  const v00 = data[idx]!;
  const v10 = data[idx + 1]!;
  const v01 = data[idx + size]!;
  const v11 = data[idx + size + 1]!;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

// Simple seeded PRNG for deterministic random respawn (no Math.random in iteration)
let _rngState = 12345;
function pseudoRandom(): number {
  _rngState = (_rngState * 1664525 + 1013904223) & 0x7fffffff;
  return _rngState / 0x7fffffff;
}

function escapeFlowStep(
  grid: EscapeGrid, x: number, y: number, ray: boolean
): [number, number] | null {
  const { bounds, maxIter, size } = grid;
  const bw = bounds[2] - bounds[0];
  const bh = bounds[3] - bounds[1];
  const gridPixel = Math.max(bw, bh) / size;
  const eps = gridPixel * 1.5;

  const iterHere = sampleGrid(grid, x, y);
  if (iterHere < 0 || iterHere <= 2 || iterHere >= maxIter - 2) {
    return null;
  }

  let iterR = sampleGrid(grid, x + eps, y);
  let iterL = sampleGrid(grid, x - eps, y);
  let iterU = sampleGrid(grid, x, y + eps);
  let iterD = sampleGrid(grid, x, y - eps);
  if (iterR < 0) iterR = iterHere;
  if (iterL < 0) iterL = iterHere;
  if (iterU < 0) iterU = iterHere;
  if (iterD < 0) iterD = iterHere;

  const gx = (iterR - iterL) / (2 * eps);
  const gy = (iterU - iterD) / (2 * eps);
  const gradMag = Math.sqrt(gx * gx + gy * gy);
  if (gradMag < 1e-8) return null;

  /*
   * v8 `33.4` — **TWO FOLIATIONS OF ONE FIELD, AND THE ONLY DIFFERENCE IS WHICH VECTOR IS TAKEN.**
   *
   * `(−g_y, g_x)/|∇|` is the level-set TANGENT, so a particle slides along an iso-contour — and because
   * the smooth escape count is a monotone function of the Douady–Hubbard potential, those contours are
   * its **equipotentials**. That is the shipped behaviour and it is what every Julia and Mandelbrot
   * preset has always drawn.
   *
   * `(g_x, g_y)/|∇|` is the GRADIENT, orthogonal to it: the particle climbs the field instead of circling
   * it, so the population reads as radial filaments converging on the set's boundary rather than as
   * contour lines wrapping it.
   *
   * ⚠️⚠️ **THIS IS NOT AN EXTERNAL-RAY TRACER AND MUST NOT BE DOCUMENTED AS ONE.** `buildEscapeGrid` runs
   * `blurGrid(grid, size, 3)` — three 3x3 passes — so the field is a LOW-PASS of the potential and its
   * gradient lines diverge from true external rays by more than the 512-square sampling alone implies.
   * Two independent research agents reached that conclusion separately in 2026-10. **It is a new visual
   * family, not the exact object.**
   *
   * ⚠️ **The step length is unchanged and deliberately so.** `gridPixel * 0.4` was chosen so a
   * contour-follower stays glued to its contour; a ray wants no such thing, but lengthening the step for
   * it would make the two modes differ in two variables at once and nothing downstream could attribute a
   * change to either.
   */
  const dirX = ray ? gx / gradMag : -gy / gradMag;
  const dirY = ray ? gy / gradMag : gx / gradMag;
  const speed = gridPixel * 0.4;

  const nx = x + dirX * speed;
  const ny = y + dirY * speed;

  if (!isFinite(nx) || !isFinite(ny)) return null;
  // ⚠️ The ELLIPSE, not the rectangle — see `maskRadius`. A rectangular test made the window edge a crisp
  // four-sided clip line on 6 of the 10 shipped Mandelbrot presets. This must stay in step with
  // `collectSeeds`' own mask, or a particle respawns into a corner the flow test will refuse next frame.
  if (maskRadius(bounds, nx, ny) >= 1) return null;

  const newIter = sampleGrid(grid, nx, ny);
  if (newIter < 0 || newIter <= 2 || newIter >= maxIter - 2) return null;

  return [nx, ny];
}

/**
 * Place a particle that has nowhere to flow.
 *
 * ⚠️ **The old behaviour was `bounds[0] + random() * bw` — uniform in the RECTANGLE — and that is the
 * single cause of the "we have taken a quadratic cut and outside it there are never any particles, filled
 * with noise" report.** Two distinct symptoms came out of it:
 *
 * - **The rectangle is visible** because respawn fills the window uniformly, so the sampling box becomes
 *   the figure's silhouette. The attractor's actual structure is a set of filaments *inside* that box.
 * - **It reads as noise** in proportion to how much of the window is unfollowable, because those particles
 *   respawn EVERY frame and never take a single flow step. Measured valid-flow area per preset, at the
 *   ORIGINAL bounds: `Starfish`/`Spiral Galaxy` 100 %, `Full Set` ~85 %, `Elephant Valley` 51.7 %,
 *   **`Mini-brot` ~11 %**, **`Needle` <1 %** — which is exactly the reported severity ordering, from
 *   "nice flow" through "mostly darkness with some noise" to "just a rectangle showing noise". Both of the
 *   last two were re-bounded the same day to ~91–92 % (see `ATTRACTOR_PRESETS`).
 *
 * ⚠️ **Fixing respawn does NOT fix a window whose escape field is flat.** `Mandelbrot Lightning` measured
 * 100 % followable — so every particle flowed, every frame — and still read as a noisy drift field, because
 * its escape range was 3.7 across the whole grid with 0 boundary cells. It was deleted 2026-08-13 rather
 * than re-bounded, the two neighbouring windows in that region already being kept.
 *
 * Respawning onto a known-followable cell means a particle joins the flow on its first step, so what is
 * drawn is the flow field rather than the sampling window. Falls back to the old uniform placement only
 * when the grid has no followable cell at all, which after the `Needle`/`Mini-brot` re-bounding is no
 * shipped preset — but an imported or Mixer-interpolated `bounds` can still land inside the set.
 */
function pickRespawn(grid: EscapeGrid, out: [number, number]): void {
  const seeds = grid.seeds;
  if (seeds.length >= 2) {
    const k = (Math.floor(pseudoRandom() * (seeds.length >> 1)) << 1) % seeds.length;
    out[0] = seeds[k]!;
    out[1] = seeds[k + 1]!;
    return;
  }
  // Fallback: uniform inside the INSCRIBED ELLIPSE, not the rectangle. A rectangular placement would put
  // particles where `escapeFlowStep`'s mask test refuses to move them, i.e. straight back into the
  // respawn-every-frame loop this function exists to break — and in the corners, which is precisely the
  // region the mask removes. Polar with a sqrt radius gives uniform area density.
  const b = grid.bounds;
  const theta = pseudoRandom() * Math.PI * 2;
  const r = Math.sqrt(pseudoRandom());
  out[0] = (b[0] + b[2]) * 0.5 + Math.cos(theta) * r * (b[2] - b[0]) * 0.5;
  out[1] = (b[1] + b[3]) * 0.5 + Math.sin(theta) * r * (b[3] - b[1]) * 0.5;
}

/**
 * Advance the escape-flow particles.
 *
 * `dtScale` multiplies the number of flow STEPS taken per frame, not a step length: the step is fixed at
 * `gridPixel * 0.4` so that the path stays glued to an iso-contour of the escape field, and lengthening it
 * would let a particle cut across contours and leave the filament it is tracing. Fractional values are
 * carried by taking `floor` plus a probabilistic extra step, so speed 0.3 genuinely runs at 0.3× rather
 * than rounding to a stop or to full speed.
 */
/** See `advanceEscapeFlow`: the most flow steps a particle takes in one frame. */
const FLOW_MAX_STEPS = 1;

function advanceEscapeFlow(
  s: AttractorState, count: number, grid: EscapeGrid, dtScale: number,
  ray: boolean, outEscape: Float32Array | undefined,
): void {
  const whole = Math.floor(dtScale);
  const frac = dtScale - whole;
  const respawn: [number, number] = [0, 0];

  for (let i = 0; i < count; i++) {
    /*
     * ⚠️ **AT MOST `FLOW_MAX_STEPS` (1) STEP PER PARTICLE PER FRAME** (owner, 2026-11-12). The step count followed the
     * frame time (`dtScale = dt / 16.667`), and the cost follows the step count — so these presets were BISTABLE: started
     * fast they held 60 fps (`Mandelbrot River Glow`: one step, `figure` 14.7 ms on the owner's fast machine); after one
     * slow frame (a preset switch) they took two or more steps, ~29–35 ms, and the next frame was slow again — stuck at
     * 26–32 fps. A cap of 2 does NOT break that (two steps fill a 33 ms frame); 1 does. ⚠️ At 60 fps and above
     * (`dtScale ≤ 1`) nothing changes — the same draw, the same steps, bit-identical; below 60 fps the contours drift
     * more slowly in real time instead of the frame rate collapsing. The `pseudoRandom` draw is still taken, so the
     * respawn sequence is unchanged.
     */
    const steps = Math.min(FLOW_MAX_STEPS, whole + (pseudoRandom() < frac ? 1 : 0));
    let x = s.x[i]!;
    let y = s.y[i]!;
    for (let n = 0; n < steps; n++) {
      const result = escapeFlowStep(grid, x, y, ray);
      if (result) {
        x = result[0];
        y = result[1];
      } else {
        pickRespawn(grid, respawn);
        x = respawn[0];
        y = respawn[1];
        break; // a fresh seed gets its first real step on the next frame, not the same one
      }
    }
    s.x[i] = x;
    s.y[i] = y;
    const esc = sampleGrid(grid, x, y);
    const norm = esc >= 0 ? esc / grid.maxIter : 0;
    s.z[i] = norm;
    /*
     * v8 `33.5` — **PUBLISH THE SMOOTH ESCAPE COUNT, which this function has computed every frame since
     * the escape flow shipped and then thrown away.**
     *
     * ⚠️⚠️ **`s.z` IS NOT THE PLACE, AND THAT IS WHY THIS ARRAY EXISTS.** The normaliser overwrites
     * `s.z[i]` with 0 a few lines later under the comment *"escape time is not a coordinate"* — a refusal
     * that is CORRECT and that `33.5` deliberately does not reopen: the count is a POTENTIAL, so as a
     * height it gives a monotone terraced cone, and the engine's own `BOUNDS_REUSE_TOLERANCE` measurement
     * found the field near-CONSTANT over bad windows. Writing it to a separate array keeps `outZ`'s
     * contract unconditional (invariant 11) instead of making it depend on which driver the user picked.
     *
     * ⚠️ **Already in `[0, 1]`, which is exactly what the channel driver consumes** — no rescale, and none
     * may be added: the driver clamps to the same range and a second normalisation would be
     * `TW_COORD_DEPTH`'s double-normalisation defect in a new place.
     * ⚠️ `esc < 0` is OUTSIDE the grid and maps to 0, which **conflates "off-window" with "deep interior"**.
     * Stated rather than fixed: both mean "no filament here", and separating them would need a sentinel
     * the driver has no way to read.
     */
    if (outEscape && outEscape.length > i) outEscape[i] = norm;
  }
}

function iterateJuliaFlow(
  s: AttractorState, count: number,
  cRe: number, cIm: number,
  bounds: [number, number, number, number],
  maxIter: number,
  dtScale: number,
  ray: boolean,
  outEscape: Float32Array | undefined,
  gridSize: number = GRID_SIZE,
): void {
  void maxIter; // the grid's own adaptive value governs; see computeAdaptiveMaxIter
  advanceEscapeFlow(s, count, buildEscapeGrid('julia', [cRe, cIm], bounds, gridSize), dtScale, ray, outEscape);
}

function iterateMandelbrotFlow(
  s: AttractorState, count: number,
  bounds: [number, number, number, number],
  maxIter: number,
  dtScale: number,
  ray: boolean,
  outEscape: Float32Array | undefined,
  gridSize: number = GRID_SIZE,
): void {
  void maxIter;
  advanceEscapeFlow(s, count, buildEscapeGrid('mandelbrot', [], bounds, gridSize), dtScale, ray, outEscape);
}

// Smooth escape count: i - log2(log2(|z|²)) + 4
function smoothEscapeJulia(x: number, y: number, cRe: number, cIm: number, maxIter: number): number {
  let zr = x, zi = y;
  let i = 0;
  for (; i < maxIter; i++) {
    const zr2 = zr * zr;
    const zi2 = zi * zi;
    if (zr2 + zi2 > 256) break;
    const newZr = zr2 - zi2 + cRe;
    zi = 2 * zr * zi + cIm;
    zr = newZr;
  }
  if (i === maxIter) return maxIter;
  const mag2 = zr * zr + zi * zi;
  return i - Math.log2(Math.log2(mag2)) + 4;
}

function smoothEscapeMandelbrot(cRe: number, cIm: number, maxIter: number): number {
  let zr = 0, zi = 0;
  let i = 0;
  for (; i < maxIter; i++) {
    const zr2 = zr * zr;
    const zi2 = zi * zi;
    if (zr2 + zi2 > 256) break;
    const newZr = zr2 - zi2 + cRe;
    zi = 2 * zr * zi + cIm;
    zr = newZr;
  }
  if (i === maxIter) return maxIter;
  const mag2 = zr * zr + zi * zi;
  return i - Math.log2(Math.log2(mag2)) + 4;
}

/**
 * Escape-field health for one (fracType, bounds) window — the three quantities that discriminated
 * `Mandelbrot Lightning` (v8 step 11.1's fast proxy).
 *
 * ## Why this exists as an EXPORT rather than as code inside the checker
 *
 * ⚠️ **The checker must measure the grid the engine actually flows over, not a re-implementation of it.**
 * The field is `smoothEscape*` → **3-pass box blur** → `ok(v) = v >= 0 && v > 2 && v < maxIter - 2`, with
 * `maxIter` chosen by `computeAdaptiveMaxIter(bounds)` — five span bands, so the *same* window measured at
 * the wrong iteration count reports a different interior fraction. A copy of that chain in `checks/` would
 * be four separate opportunities to drift, and the drift would be invisible: the checker would keep
 * passing while measuring a field nothing renders. So this calls `buildEscapeGrid()` itself.
 *
 * ## What the three numbers mean, and why ALL THREE are needed
 *
 * `Mandelbrot Lightning` shipped, was reported as *"just a noisy flow field"* and was deleted on
 * observation — no checker caught it. Its signature was the pair below, and each metric alone is blind to
 * it:
 *
 * - `followable` — fraction of cells where a particle can move at all. **Lightning measured 1.00**, the
 *   same as `Starfish` and `Spiral Galaxy`, which were liked. Catches the OPPOSITE failure — `Needle`
 *   shipped at 0.006 (98.3 % inside the set) and `Mini-brot` at 0.119, both reported as *"a rectangle in
 *   space showing noise"* and both re-bounded.
 * - `edgeCells` — cells adjacent to an unfollowable one, i.e. where iso-contours crowd. **Lightning
 *   measured 0.** These are what a filament is made of, and what `collectSeeds` prefers.
 * - `escapeRange` — max − min over the followable cells. **Lightning measured 3.7 across the whole 512²
 *   grid**, i.e. a near-CONSTANT field. Particles flow perpendicular to the gradient, so a flat field
 *   gives a tiny gradient pointing almost the same way everywhere: uniform drift, no structure. A window
 *   can have some edge cells and still be flat, which is why range is a third axis and not a proxy.
 *
 * ⚠️ **This is a field-level measure and it does NOT reduce to the occupancy metrics** (fractal dimension,
 * spatial entropy) that `checks/aestheticcheck.mjs` applies to the rendered figure. Measured there,
 * Lightning scores dim 1.859 / ent 0.861 — **the highest of all 35 attractor presets**, because a uniform
 * drift fills the frame beautifully while carrying no followable structure at all. That is the same lesson
 * V7c recorded in another form: *a measurement that is high can still be the wrong measurement.* The two
 * metrics answer different questions and neither bounds the other.
 */
export interface EscapeFieldStats {
  /** Fraction of the 512² grid where `escapeFlowStep` will move a particle. 0–1. */
  followable: number;
  /** Count of followable cells having at least one unfollowable 4-neighbour. */
  edgeCells: number;
  /** max − min of the smooth escape value over followable cells. */
  escapeRange: number;
  /** The adaptive iteration count this window resolves to — reported because it gates `ok()`. */
  maxIter: number;
}

/**
 * Measure the escape field for a julia/mandelbrot window. See {@link EscapeFieldStats}.
 *
 * `params` is `[cRe, cIm]` for julia and ignored for mandelbrot, matching `iterateJuliaFlow` /
 * `iterateMandelbrotFlow`. Costs one grid build (23 ms at 256 iterations, 147 ms at 1000) unless the
 * tolerance cache already holds the window.
 */
export function escapeFieldStats(
  fracType: 'julia' | 'mandelbrot',
  params: number[],
  bounds: [number, number, number, number],
): EscapeFieldStats {
  const grid = buildEscapeGrid(fracType, params, bounds);
  const { data, size, maxIter } = grid;
  // Identical predicate to `collectSeeds`' own `ok()`, and to the tests `escapeFlowStep` applies.
  const ok = (v: number): boolean => v >= 0 && v > 2 && v < maxIter - 2;

  let followableCells = 0;
  let edgeCells = 0;
  let min = Infinity;
  let max = -Infinity;

  // Border cells are skipped for the same reason `collectSeeds` skips them: the blur never wrote them, so
  // they hold raw unblurred values and have no complete 4-neighbourhood to test for edgeness.
  for (let gy = 1; gy < size - 1; gy++) {
    for (let gx = 1; gx < size - 1; gx++) {
      const idx = gy * size + gx;
      const v = data[idx]!;
      if (!ok(v)) continue;
      followableCells++;
      if (v < min) min = v;
      if (v > max) max = v;
      if (
        !ok(data[idx - 1]!) || !ok(data[idx + 1]!) ||
        !ok(data[idx - size]!) || !ok(data[idx + size]!)
      ) edgeCells++;
    }
  }

  const interior = (size - 2) * (size - 2);
  return {
    followable: followableCells / interior,
    edgeCells,
    escapeRange: followableCells > 0 ? max - min : 0,
    maxIter,
  };
}

// --- Preset collections ---

export interface AttractorPreset {
  name: string;
  type: AttractorParams['type'];
  params: number[];
  bounds: [number, number, number, number];
  maxIter?: number;
}

export const ATTRACTOR_PRESETS: AttractorPreset[] = [
  // Clifford variants
  { name: 'Clifford Classic', type: 'clifford', params: [-1.4, 1.6, 1.0, 0.7], bounds: [-3, -3, 3, 3] },
  { name: 'Clifford Swirl', type: 'clifford', params: [1.7, 1.7, 0.6, 1.2], bounds: [-3, -3, 3, 3] },
  { name: 'Clifford Fern', type: 'clifford', params: [-1.7, 1.3, -0.1, -1.2], bounds: [-3, -3, 3, 3] },

  // De Jong variants
  { name: 'De Jong Butterfly', type: 'dejong', params: [-2.0, -2.0, -1.2, 2.0], bounds: [-3, -3, 3, 3] },
  { name: 'De Jong Vortex', type: 'dejong', params: [1.4, -2.3, 2.4, -2.1], bounds: [-3, -3, 3, 3] },

  // Lorenz
  { name: 'Lorenz Classic', type: 'lorenz', params: [10, 28, 8/3, 0.005], bounds: [-30, -30, 30, 30] },
  { name: 'Lorenz Tight', type: 'lorenz', params: [10, 15, 8/3, 0.005], bounds: [-20, -20, 20, 20] },

  // Rössler
  { name: 'Rössler Spiral', type: 'rossler', params: [0.2, 0.2, 5.7, 0.01], bounds: [-12, -12, 12, 12] },
  { name: 'Rössler Wide', type: 'rossler', params: [0.2, 0.2, 14, 0.005], bounds: [-20, -20, 20, 20] },

  // Thomas
  { name: 'Thomas Cyclone', type: 'thomas', params: [0.208186, 0.03], bounds: [-5, -5, 5, 5] },

  // Halvorsen
  { name: 'Halvorsen Knot', type: 'halvorsen', params: [1.4, 0.005], bounds: [-8, -8, 8, 8] },

  // Aizawa
  { name: 'Aizawa Torus', type: 'aizawa', params: [0.95, 0.7, 0.6, 0.01], bounds: [-2, -2, 2, 2] },

  // Nosé-Hoover
  { name: 'Nosé-Hoover Flow', type: 'nose-hoover', params: [1.5, 0.02], bounds: [-3, -3, 3, 3] },

  // Julia sets
  { name: 'Julia Dendrite', type: 'julia', params: [0.0, 1.0, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Spiral Galaxy', type: 'julia', params: [-0.75, 0.11, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  // ⚠️ `Julia Sea-Horse` (-0.74543, 0.11301) was REMOVED 2026-08-13: it sits **0.0055** from Spiral Galaxy
  // in the c-plane, which is the same Julia set to the eye. Worse, `PARAMS_REUSE_TOLERANCE` is 0.002, so the
  // two did not even share a cached escape grid — switching between them paid a 23 ms rebuild to render an
  // indistinguishable figure.
  { name: 'Julia Douady Rabbit', type: 'julia', params: [-0.123, 0.745, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Fractal Dust', type: 'julia', params: [0.36, 0.1, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia San Marco', type: 'julia', params: [-0.75, 0.0, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  // Renamed from `Julia Lightning` 2026-08-13. c = −1 exactly IS the Basilica (the centre of the period-2
  // bulb); the entry that carried that name sat at (−1.0, 0.1), a mere 0.10 away and therefore a blurred
  // copy of this one. Deleting the copy and moving its correct name here fixes both at once.
  { name: 'Julia Basilica', type: 'julia', params: [-1.0, 0.0, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Siegel Disk', type: 'julia', params: [-0.391, -0.587, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Pinwheel', type: 'julia', params: [0.285, 0.01, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  // `Julia Snowflake` (-0.1, 0.651) REMOVED 2026-08-13 — 0.097 from Douady Rabbit, same basin, same look.
  { name: 'Julia Electric', type: 'julia', params: [-0.7, 0.27015, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Swirl', type: 'julia', params: [0.355534, -0.337292, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Firework', type: 'julia', params: [-0.4, 0.6, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },
  { name: 'Julia Neuron', type: 'julia', params: [0.0, -0.8, 2.0, 0], bounds: [-2, -2, 2, 2], maxIter: 256 },

  // Mandelbrot zoom regions
  { name: 'Mandelbrot Full Set', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-2.5, -1.5, 1.0, 1.5], maxIter: 256 },
  { name: 'Mandelbrot Seahorse Valley', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-0.77, -0.13, -0.73, -0.09], maxIter: 400 },
  { name: 'Mandelbrot Elephant Valley', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [0.26, -0.01, 0.29, 0.02], maxIter: 400 },
  { name: 'Mandelbrot Antenna Tip', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-1.79, -0.02, -1.74, 0.02], maxIter: 600 },
  { name: 'Mandelbrot Double Spiral', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-0.088, 0.654, -0.084, 0.658], maxIter: 800 },
  // ⚠️ RE-BOUNDED 2026-08-13. Both windows were measured as sitting almost entirely INSIDE the set, where
  // the escape field is constant and `escapeFlowStep` refuses to move a particle — so every particle
  // respawned every frame and the preset rendered as pure noise in a rectangle. Reported as "Mini-brot
  // shows only the top right corner, the rest is darkness with some noise" and "Needle is just a rectangle
  // in space showing noise". Measured followable-cell fraction, before → after:
  //   Mini-brot  11.9 % → **92.4 %**  (span 0.01 → 0.08, centred on the real period-3 satellite at −1.7499
  //                                    rather than 0.01 to its left, which was 57 % interior)
  //   Needle      0.6 % → **91.0 %**  (was [-0.752, ±0.005] — dead centre of the NECK, 98.3 % interior and
  //                                    therefore 0 % followable; the name never matched the window either)
  // ⚠️ The two windows must not overlap, or they become the redundancy just deleted from the Julia list.
  // They are 0.27 apart on the real axis. Both keep a high boundary-cell count (742 / 834), which is what
  // respawn seeds onto and what makes the filaments read as filaments rather than as a uniform fill.
  { name: 'Mandelbrot Mini-brot', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-1.79, -0.04, -1.71, 0.04], maxIter: 800 },
  { name: 'Mandelbrot Needle', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-1.4859, -0.01, -1.4659, 0.01], maxIter: 800 },
  { name: 'Mandelbrot Scepter Valley', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-1.256, -0.382, -1.248, -0.375], maxIter: 400 },
  // `Mandelbrot Lightning` ([-0.194, 0.655, -0.188, 0.661], maxIter 600) REMOVED 2026-08-13 after a browser
  // pass — reported as "still just a noisy flow field" once the scaling was correct, and it measured as the
  // one degenerate window in the list. ⚠️ **Followable fraction is NOT the criterion that separates it**: it
  // was 100 % followable, exactly like the two entries below. The pair that does is (boundary cells, escape
  // dynamic range): Lightning had **0 edge cells** and a range of **3.7** (27.9..31.5) over the whole 512²
  // grid, i.e. a near-CONSTANT escape field — so the gradient it flows perpendicular to was tiny and pointed
  // almost the same way everywhere, which is what reads as uniform drift rather than as filaments. Starfish
  // (62 edge cells, range 490.7) and Spiral Galaxy (228, 756.4) share the 100 % figure and have real
  // iso-contour structure, so they are NOT the same case and were kept.
  { name: 'Mandelbrot Starfish', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-0.375, 0.659, -0.369, 0.665], maxIter: 600 },
  { name: 'Mandelbrot Spiral Galaxy', type: 'mandelbrot', params: [2.0, 0, 0, 0], bounds: [-0.761, -0.085, -0.759, -0.083], maxIter: 800 },

];
