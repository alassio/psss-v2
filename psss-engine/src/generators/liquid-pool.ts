import type { LiquidFieldConfig, LiquidSeedPattern } from '../presets/types.ts';

/**
 * v8 Step 15.5 (E88) — **Relationship (B): the figure SWIRLS THROUGH a liquid.** A SECOND particle
 * population, seeded once as standing liquid and thereafter moved only by the velocity field the figure
 * already writes into `FluidAdvectionProcessor`. The curve itself stays a pure Lissajous figure — untouched
 * and unpolluted by physics — and this population is the response.
 *
 * ## What this is NOT: `fluidAdvection.blend`
 *
 * ⚠️ **`Field Coupling` CANNOT be implemented by writing `fluidAdvection.blend`, and that was established by
 * reading three separate mechanisms rather than by preference.** (1) `isActive()` is
 * `config.blend > 0 || forceFieldActive`, so `step()` early-returns at its second line and the 512² field is
 * never simulated at all unless one of those is set. (2) The CPU readback is gated a SECOND time on
 * `readbackFrame % 2 === 0 && blend > 0`, so at `blend` 0 — the state of all 24 authored blocks, which this
 * step must preserve byte-for-byte — `velReadbackBuf` is never filled and any sampler reads zeros. (3)
 * `advectParticles()` owns ONE particle-indexed `offsetX/offsetY` pair, derives its magnitude ceiling from
 * `cfg.blend`, and rewrites `wavePositions` IN PLACE clamped to [0,1] — so a pool riding it would collide with
 * the wave figure's own accumulated offsets, index for index.
 *
 * So the pool SAMPLES the shared field and integrates its own motion here. The processor gained exactly three
 * things for it: a public sampler, a pool-activation source feeding `isActive()`, and readback enablement
 * independent of `blend`. All three are resolved through `applyFluidFeedbackState()`, the single owner — never
 * assigned on entry at a call site, for the reason that function's own doc records.
 *
 * ## The field this pool reads has NO PRESSURE PROJECTION, and that is deliberate
 *
 * `fluid-advection.ts:370` runs four blur/decay passes and stops; `ADVECT_FS`/`DIVERGE_FS`/`JACOBI_FS`/
 * `GRAD_FS` are compiled and unreached. ⚠️ **For stirring that is a feature — do not "fix" it with a
 * projection pass, which is the first step down the dropped 15.8/`E61` road.** But it has one mechanical
 * consequence this class must answer: an unprojected field is COMPRESSIBLE, so mass piles up in convergence
 * zones without bound. Over a minute — and the step's own verification note says *watch it for a minute, not
 * five seconds* — a pool with no bound would collapse into a few static clumps and stop reading as liquid.
 *
 * The answer is invariant 12's, not a clamp: **out of bounds, or past the travel cap, or non-finite → RESEED
 * to the particle's own seed position.** ⚠️ **Clamping at the frame edge instead would build a permanent rim
 * of stuck particles, which under 15.1's iso-surface draws as a bright continuous line along the border** —
 * i.e. the clamp does not merely fail to fix the drift, it manufactures a second, more visible artefact. The
 * reseed target is the seed rather than a random point, so a long run self-heals toward the authored pattern.
 *
 * ## Positions are stored in PIXELS, and that is invariant 26's rule applied rather than restated
 *
 * The field is addressed in UV, whose two axes are `w` and `h` pixels per unit — **not one length scale**. A
 * pool holding UV would need every one of its four lengths (blob radius, cloud radius, basin depth, travel cap)
 * converted against a shared scale at each use site, which is exactly the per-site correction invariant 26 cost
 * a sitting over. Storing PIXELS makes the storage isotropic by construction, leaves exactly ONE conversion
 * (px → UV at the sample call), and is the unit publication needs anyway. Every length constant below is a
 * fraction of `min(w, h)` — already this engine's length scale (`solveGain`'s target fraction, style 0's `fit`,
 * `vortexOffset`'s `minDim`).
 *
 * The cost is that a canvas resize invalidates the seeds, so `ensure()` reseeds on a size change. That is
 * correct rather than merely acceptable: a pool authored as a `Basin` must sit at the bottom of the NEW frame.
 *
 * ## Seeding is deterministic AND count-independent, which is a stronger property than it looks
 *
 * No `Math.random()` anywhere (invariant 12): seeds come from a Halton sequence in bases 2 and 3, offset from
 * `i`. ⚠️ **The low-discrepancy sequence is not decoration — `seed(i)` must not depend on the pool's SIZE.** A
 * jittered grid would re-derive every particle's home the moment `Pool Size` moved one stop, so a slider drag
 * would tear the whole pool apart and re-form it 121 times; with Halton, growing the pool only APPENDS points
 * and every existing particle keeps the home it has been drifting from. That is why `ensure()` can seed
 * `[count, size)` alone.
 *
 * ## 15.6 (`E89`) lands HERE, and one spec instruction is deliberately not followed
 *
 * The step says to build this class with a `seedMode: 'pool'` field so 15.6 adds `'emit'` to the same class.
 * ⚠️ **The shared LIFECYCLE is built (that is the cost saving); the FIELD is not, because a branch with one
 * reachable value is a dormant mechanism** — and this very file's neighbour records what those cost
 * (`fluid-advection.ts:237`, triage G14: a dye field whose three draw passes had zero callers, *"build it as
 * its own render pass with its calls in the frame loop from the first commit, not as dormant methods"*). What
 * 15.6 needs is already factored: `seedSlot()` owns placement, and the end-of-life decision emission would
 * replace with a lifetime is the `escaped` branch inside `update()`. Adding the enum then costs one field and
 * one branch, against the whole lifecycle it would otherwise have duplicated.
 *
 * ⚠️ **This paragraph said `recycle()` until 2026-09-03, and there has never been such a method** — the
 * end-of-life decision is INLINE in `update()`'s loop, which is precisely why extracting it is part of any
 * `'emit'` work rather than free. A header that names a method the file does not have is the cheapest way to
 * make a future estimate wrong, and `grep` exonerates the file it is written in. ⚠️ **15.6 IS CUT** (a
 * material with sparks already ships that look), so this note stands as the record, not as a plan.
 */
export class LiquidPool {
  /** Live positions, PIXELS. */
  private px: Float32Array = new Float32Array(0);
  private py: Float32Array = new Float32Array(0);
  /** Velocities, PIXELS PER SECOND. */
  private vx: Float32Array = new Float32Array(0);
  private vy: Float32Array = new Float32Array(0);
  /** The seed pattern's home for each slot, PIXELS — the reseed target and the travel-cap origin. */
  private seedX: Float32Array = new Float32Array(0);
  private seedY: Float32Array = new Float32Array(0);

  /**
   * Publication scratch, GROW-ONLY and reused across frames.
   *
   * ⚠️ **Never `SparkPool.getActiveState()`'s shape**, which allocates three arrays on every call: that is
   * invariant 8's exact reported failure (58 MB/s of `getState()` garbage reached the user as *"a jitter effect
   * every few seconds"*, i.e. a GC pause). At the 20 000-particle ceiling these three would be 320 KB/frame,
   * 19 MB/s — a third of the defect that was already fixed once in `ensureTailScratch`.
   */
  private posOut: Float32Array = new Float32Array(0);
  private speedOut: Float32Array = new Float32Array(0);
  private dirOut: Float32Array = new Float32Array(0);

  private count = 0;
  private capacity = 0;
  private seededW = 0;
  private seededH = 0;
  private seededPattern: LiquidSeedPattern | null = null;

  /**
   * Coupling gain, dimensionless, applied on top of the field's own unit.
   *
   * ⚠️ **THE UNIT CHAIN IS THE WHOLE JUSTIFICATION (invariant 10) AND IT CROSSES A SUBSYSTEM BOUNDARY.** The
   * readback holds the field's smoothed per-frame UV displacement — `main.ts` seeds it as
   * `(dx / w) * 0.08`, EMA-smoothed at α = 0.3 — so it is a **UV displacement per 60 Hz frame**, not a
   * velocity. Converting to the px/s this class integrates in is therefore `field · min(w,h) · 60 · SPEED`.
   * Worked at a representative 1024×768 with a field of 5e-4: `5e-4 × 768 × 60 = 23 px/s` per unit of gain, so
   * 6.0 gives ~138 px/s at Coupling 1 and ~69 px/s at the default 0.5 — a visible stir that crosses a 768 px
   * frame in a few seconds rather than in one.
   *
   * ⚠️ **This is the step's ONE constant that could not be measured offline** (the field's magnitude is the
   * output of six GL passes over a 512² RGBA16F target and exists only in a live context), so the arithmetic
   * above is its derivation and the browser pass owes it a verdict. The slider spans 0–1 linearly, so any
   * strength BELOW this gain is reachable — the failure mode to watch for is "too strong at 0.5", not "inert".
   */
  static readonly SPEED = 6.0;
  /**
   * Velocity relaxation rate, per second: the pool's velocity chases the local field velocity with
   * τ = 1/INERTIA ≈ 0.2 s rather than snapping to it. Applied as `1 − exp(−INERTIA·dt)`, so it is
   * frame-rate correct by construction and needs no per-frame renormalisation (unlike an accumulator —
   * `CohesionField`'s zero-order-hold deposit exists because that one integrates, and this one does not).
   *
   * Without it the pool would take the field's direction changes instantaneously and read as dust blown by a
   * fan; the lag is what makes it read as a body with mass.
   */
  static readonly INERTIA = 5.0;
  /** Reseed distance from the seed, as a fraction of `min(w,h)`. See the compressibility note in the header. */
  static readonly MAX_TRAVEL = 0.6;
  /** Reseed apron beyond the frame, as a fraction of `min(w,h)`. */
  static readonly OUT_MARGIN = 0.06;
  /**
   * Speed that publishes as `velocities = 1.0`, as a fraction of `min(w,h)` per second.
   *
   * The published value is a REAL normalised speed rather than the spark block's constant 1.0, because a pool
   * particle's speed is meaningful and three consumers read it (palette mapping 2, spark spawning's threshold,
   * velocity stretch). At 0.25 a particle crossing a quarter of the short axis per second saturates.
   */
  static readonly VEL_REF = 0.25;
  /** Hard ceiling on the pool, matching the `Pool Size` slider's own maximum. */
  static readonly MAX_PARTICLES = 20000;
  /** `Blobs` seeds this many discs. */
  static readonly BLOB_COUNT = 5;

  getCount(): number { return this.count; }
  /** Concatenation-ready `[x, y, 0]` triples over `[0, getCount())`. */
  getPositions(): Float32Array { return this.posOut; }
  /** Normalised speed per slot, 0..1 — see `VEL_REF`. */
  getSpeeds(): Float32Array { return this.speedOut; }
  /** Unit motion direction per slot; `(0, -1)` for a slot that is standing still. */
  getVelocityDirs(): Float32Array { return this.dirOut; }

  /**
   * Advance the pool by one frame.
   *
   * ⚠️ **`sample` reads the PREVIOUS frame's field, by construction and harmlessly.** The generator runs
   * upstream of `fluidProcessor.step()` (which needs `getState()`'s positions to seed from), so the pool cannot
   * see the field its own frame produced. The field is EMA-smoothed at α = 0.3 and decays at 0.985 per frame,
   * so one frame of lag is far below its own time constant — and closing that loop would mean advecting the
   * pool from a field seeded by the pool, which is precisely the feedback `main.ts` excludes it from.
   *
   * @param dt frame time in MILLISECONDS, as every other generator stage takes it. Converted here.
   * @param sample bilinear field read, `(u, v, channel) => value`; `null` when no field is running, which
   *        leaves the pool standing exactly still rather than drifting from stale state.
   */
  update(
    dt: number,
    width: number,
    height: number,
    config: LiquidFieldConfig,
    sample: ((u: number, v: number, channel: number) => number) | null,
  ): void {
    // ⚠️ **`Number.isFinite` FIRST, BECAUSE `Math.max`/`Math.min` DO NOT SANITISE — THEY PROPAGATE.**
    // `Math.max(0, Math.min(MAX, Math.floor(NaN)))` is **NaN**, so a clamp that looks like a guard is not one.
    // Measured, before this line existed: ONE frame with a non-finite `poolSize` collapsed the entire pool to a
    // single point at (0, 0) and **LATCHED there for the session** — 4000/4000 particles coincident, bbox
    // 0.0×0.0 against a healthy 488×487, still collapsed after 720 further frames of a perfectly sane config.
    //
    // The mechanism is two NaN comparisons in a row, neither of which throws: `ensure()` sets `this.count = size`
    // unconditionally, while its seeding bound `from = Math.min(this.count, size)` is also NaN, so
    // `for (i = NaN; i < size; i++)` runs **zero** times and every slot keeps its zero-initialised home. The
    // only escape a user could stumble on is changing `Seed Pattern`, which forces `geometryChanged` and reseeds
    // from 0. Invariant 12's *reseed, do not clamp* has a precondition this line supplies: the reseed bound must
    // be a NUMBER. It is also invariant 7 from the other end — `getCount()` then promises slots whose published
    // positions are all one point, so the length is honest and the CONTENT is not.
    //
    // ⚠️ **The reachable door is the CONFIG, exactly as §P's cohesion reseed found (a `positions` poison never
    // reaches it): `poolSize` arrives from a slider and from an imported preset's JSON, where a `null` or a
    // malformed number lands as `NaN` with nothing upstream to catch it.** `null` and `-Infinity` were already
    // safe (both clamp to 0); `NaN` and `undefined` were not.
    //
    // `Number()` first, then the finiteness test: an imported file is JSON and its number fields are whatever a
    // hand-edit put there, so `"4000"` must keep working exactly as `Math.floor` already coerced it. Testing
    // `Number.isFinite(config.poolSize)` alone would send every numeric string to 0 — a NARROWER contract than
    // the line it replaces, i.e. trading one silent failure for another. A malformed value resolves to **0** (no
    // pool) rather than to the ceiling, because `Infinity` is not a request for 20 000 particles.
    const requested = Number(config.poolSize);
    const size = Number.isFinite(requested)
      ? Math.max(0, Math.min(LiquidPool.MAX_PARTICLES, Math.floor(requested)))
      : 0;
    this.ensure(size, Math.max(1, width), Math.max(1, height), config.seedPattern);
    if (this.count === 0) return;

    const w = Math.max(1, width), h = Math.max(1, height);
    const minDim = Math.min(w, h);
    const dtSec = dt * 0.001;
    // See `SPEED` — `field · minDim · 60` converts the readback's per-60 Hz-frame UV displacement into px/s.
    const gain = Math.max(0, config.fieldCoupling) * LiquidPool.SPEED * minDim * 60;
    const relax = 1 - Math.exp(-LiquidPool.INERTIA * dtSec);
    const travel2 = (LiquidPool.MAX_TRAVEL * minDim) ** 2;
    const apron = LiquidPool.OUT_MARGIN * minDim;
    const invVelRef = 1 / (LiquidPool.VEL_REF * minDim);

    const X = this.px, Y = this.py, VX = this.vx, VY = this.vy;
    const out = this.posOut, spd = this.speedOut, dir = this.dirOut;

    for (let i = 0; i < this.count; i++) {
      let tx = 0, ty = 0;
      if (sample) {
        // The sampler clamps its own UV, so no bounds test is duplicated here.
        const u = X[i]! / w, v = Y[i]! / h;
        tx = sample(u, v, 0) * gain;
        ty = sample(u, v, 1) * gain;
        // A non-finite readback texel would latch this slot's velocity for the rest of the session, and every
        // GPU-side guard is upstream of the CPU copy (invariant 21 — scan the CPU arrays).
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) { tx = 0; ty = 0; }
      }
      const nvx = VX[i]! + (tx - VX[i]!) * relax;
      const nvy = VY[i]! + (ty - VY[i]!) * relax;
      let nx = X[i]! + nvx * dtSec;
      let ny = Y[i]! + nvy * dtSec;

      const dx = nx - this.seedX[i]!, dy = ny - this.seedY[i]!;
      const escaped = !Number.isFinite(nx) || !Number.isFinite(ny)
        || nx < -apron || nx > w + apron || ny < -apron || ny > h + apron
        || dx * dx + dy * dy > travel2;
      if (escaped) {
        // Invariant 12 — RESEED, do not clamp. The header records why a clamp is worse than the drift.
        nx = this.seedX[i]!;
        ny = this.seedY[i]!;
        VX[i] = 0; VY[i] = 0;
      } else {
        VX[i] = nvx; VY[i] = nvy;
      }
      X[i] = nx; Y[i] = ny;

      const o3 = i * 3;
      out[o3] = nx; out[o3 + 1] = ny; out[o3 + 2] = 0;
      const sp = Math.hypot(VX[i]!, VY[i]!);
      spd[i] = Math.min(1, sp * invVelRef);
      const o2 = i * 2;
      if (sp > 1e-4) { dir[o2] = VX[i]! / sp; dir[o2 + 1] = VY[i]! / sp; }
      else { dir[o2] = 0; dir[o2 + 1] = -1; }
    }
  }

  /**
   * Grow the arrays and seed whatever is not already seeded.
   *
   * Three cases, and the middle one is the reason the Halton sequence is used at all (see the header): a
   * geometry or pattern change reseeds EVERYTHING, a pure growth seeds only the appended slots, and a
   * shrink just lowers `count` — the retired slots keep their homes, so dragging `Pool Size` down and back
   * up restores the same pool rather than a new one.
   */
  private ensure(size: number, width: number, height: number, pattern: LiquidSeedPattern): void {
    if (size > this.capacity) {
      const grow = (src: Float32Array, stride: number): Float32Array => {
        const next = new Float32Array(size * stride);
        next.set(src);
        return next;
      };
      this.px = grow(this.px, 1);
      this.py = grow(this.py, 1);
      this.vx = grow(this.vx, 1);
      this.vy = grow(this.vy, 1);
      this.seedX = grow(this.seedX, 1);
      this.seedY = grow(this.seedY, 1);
      this.posOut = grow(this.posOut, 3);
      this.speedOut = grow(this.speedOut, 1);
      this.dirOut = grow(this.dirOut, 2);
      this.capacity = size;
    }
    const geometryChanged = width !== this.seededW || height !== this.seededH || pattern !== this.seededPattern;
    const from = geometryChanged ? 0 : Math.min(this.count, size);
    for (let i = from; i < size; i++) this.seedSlot(i, width, height, pattern);
    this.seededW = width;
    this.seededH = height;
    this.seededPattern = pattern;
    this.count = size;
  }

  /**
   * Place slot `i`'s home. Deterministic in `i` alone — never in the pool's size, and never `Math.random()`.
   *
   * ⚠️ **Every length here is a fraction of `min(w, h)`, never of `w` or of `h` separately** (invariant 26): a
   * cloud whose radius were `0.32·w` horizontally and `0.32·h` vertically is an ELLIPSE that changes shape with
   * the window, which reads as a stylistic difference between the preview and fullscreen rather than as a bug.
   * `Fill` and `Basin` spread across the full width because that is what those patterns MEAN, which is a
   * different statement from measuring a length.
   */
  private seedSlot(i: number, w: number, h: number, pattern: LiquidSeedPattern): void {
    const minDim = Math.min(w, h);
    const h1 = radicalInverse(i + 1, 2);
    const h2 = radicalInverse(i + 1, 3);
    let x: number, y: number;
    switch (pattern) {
      case 'fill':
        x = h1 * w;
        y = h2 * h;
        break;
      case 'blobs': {
        // `i % BLOB_COUNT` rather than `floor(i / perBlob)`: the modulo is size-independent, where a division
        // by a per-blob count derived from the pool size would move every particle to a different blob on a
        // `Pool Size` drag — the same property the Halton sequence is here for.
        const b = i % LiquidPool.BLOB_COUNT;
        const j = Math.floor(i / LiquidPool.BLOB_COUNT);
        const ang = (b / LiquidPool.BLOB_COUNT) * Math.PI * 2;
        const cx = w * 0.5 + Math.cos(ang) * 0.26 * minDim;
        const cy = h * 0.5 + Math.sin(ang) * 0.26 * minDim;
        // `sqrt` of a uniform gives an AREA-uniform disc; without it the centre would carry a density spike
        // that the iso-surface renders as a permanently brighter core.
        const r = Math.sqrt(radicalInverse(j + 1, 2)) * 0.11 * minDim;
        const t = radicalInverse(j + 1, 3) * Math.PI * 2;
        x = cx + Math.cos(t) * r;
        y = cy + Math.sin(t) * r;
        break;
      }
      case 'basin':
        // Screen coords: +y is DOWN (`fireProcessor`'s own note), so the basin is the HIGH-y band.
        x = h1 * w;
        y = h - h2 * 0.22 * minDim;
        break;
      case 'cloud':
      default: {
        // Exponent 0.7 rather than 0.5: slightly centre-weighted, so the blob has a soft falloff instead of
        // the hard circular edge an area-uniform disc gives under a thresholded iso-surface.
        const r = Math.pow(h1, 0.7) * 0.32 * minDim;
        const t = h2 * Math.PI * 2;
        x = w * 0.5 + Math.cos(t) * r;
        y = h * 0.5 + Math.sin(t) * r;
        break;
      }
    }
    this.seedX[i] = x;
    this.seedY[i] = y;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = 0;
    this.vy[i] = 0;
    const o3 = i * 3;
    this.posOut[o3] = x; this.posOut[o3 + 1] = y; this.posOut[o3 + 2] = 0;
    this.speedOut[i] = 0;
    this.dirOut[i * 2] = 0;
    this.dirOut[i * 2 + 1] = -1;
  }

  /** Return every particle to its seed, so turning the feature off and on again is not history-dependent. */
  reset(): void {
    for (let i = 0; i < this.count; i++) {
      this.px[i] = this.seedX[i]!;
      this.py[i] = this.seedY[i]!;
      this.vx[i] = 0;
      this.vy[i] = 0;
      const o3 = i * 3;
      this.posOut[o3] = this.px[i]!; this.posOut[o3 + 1] = this.py[i]!; this.posOut[o3 + 2] = 0;
      this.speedOut[i] = 0;
      this.dirOut[i * 2] = 0;
      this.dirOut[i * 2 + 1] = -1;
    }
  }

  dispose(): void {
    this.px = new Float32Array(0);
    this.py = new Float32Array(0);
    this.vx = new Float32Array(0);
    this.vy = new Float32Array(0);
    this.seedX = new Float32Array(0);
    this.seedY = new Float32Array(0);
    this.posOut = new Float32Array(0);
    this.speedOut = new Float32Array(0);
    this.dirOut = new Float32Array(0);
    this.count = 0;
    this.capacity = 0;
    this.seededPattern = null;
    this.seededW = 0;
    this.seededH = 0;
  }
}

/**
 * The van der Corput radical inverse of `i` in `base` — the 1-D component of a Halton sequence.
 *
 * Used instead of `Math.random()` for the reason invariant 12 states about reseeding, and instead of a grid
 * for the size-independence reason in `LiquidPool`'s header. Called only from `seedSlot`, i.e. once per slot
 * per seeding, never per frame.
 */
function radicalInverse(i: number, base: number): number {
  let f = 1, r = 0, n = i;
  while (n > 0) {
    f /= base;
    r += f * (n % base);
    n = Math.floor(n / base);
  }
  return r;
}
