import type { SparkConfig } from '../presets/types.ts';
// v8 `15.6-salvage` A — for `SPEED` and `INERTIA` alone. ⚠️ **The two constants are IMPORTED, never restated:
// `applyFieldFlow()` moves the same kind of body through the same field as `LiquidPool`, so a second copy of
// either number would let the two populations drift apart at different rates in one frame.**
import { LiquidPool } from './liquid-pool.ts';

export class SparkPool {
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private lifetime: Float32Array;
  private temperature: Float32Array;
  private poolSize: number;
  private activeCount = 0;

  constructor(poolSize: number) {
    this.poolSize = poolSize;
    this.x = new Float32Array(poolSize);
    this.y = new Float32Array(poolSize);
    this.vx = new Float32Array(poolSize);
    this.vy = new Float32Array(poolSize);
    this.lifetime = new Float32Array(poolSize);
    this.temperature = new Float32Array(poolSize);
  }

  spawn(px: number, py: number, pvx: number, pvy: number, config: SparkConfig): void {
    let slot: number;

    if (this.activeCount < this.poolSize) {
      slot = this.activeCount;
      this.activeCount++;
    } else {
      // Recycle the spark with shortest remaining lifetime
      slot = 0;
      let minLife = this.lifetime[0]!;
      for (let i = 1; i < this.poolSize; i++) {
        if (this.lifetime[i]! < minLife) {
          minLife = this.lifetime[i]!;
          slot = i;
        }
      }
    }

    const spread = 0.3;
    const ejSpeed = config.ejectionSpeed;
    /*
     * ⚠️ **THE SPREAD IS SCALED BY THE SPEED'S MAGNITUDE, `hypot(pvx, pvy)`, NOT BY `|pvx + pvy|`** — fixed
     * 2026-09-17 beside the stale-delta defect that hid it. The sum inside one `abs` is not a length: it
     * CANCELS on the whole anti-diagonal, so a particle travelling at 45° up-left got a mathematically exact
     * zero jitter while its neighbour travelling up-right got `1.41 ×` the intended amount. Every ember shed
     * from the cancelling direction left along one perfectly straight line, which reads as *"the sparks are
     * not spraying"* — a look complaint, not a bug report, and invisible to `tsc` because both spellings are
     * a `number` (invariant 10: check the units of the RESULT, not the plausibility of the expression).
     * The scale is unchanged for axis-aligned motion, so this is not a re-tune of `spread`.
     */
    const ejMag = Math.sqrt(pvx * pvx + pvy * pvy);
    this.x[slot] = px;
    this.y[slot] = py;
    this.vx[slot] = pvx * ejSpeed + (Math.random() - 0.5) * spread * ejMag;
    this.vy[slot] = pvy * ejSpeed + (Math.random() - 0.5) * spread * ejMag;
    this.lifetime[slot] = config.minLifetime + Math.random() * (config.maxLifetime - config.minLifetime);
    this.temperature[slot] = 1.0;
  }

  update(dt: number, config: SparkConfig): void {
    const dtSec = dt / 1000;
    const gravity = config.gravity;
    const drag = config.drag;
    const coolDecay = Math.pow(0.5, config.coolingRate * dtSec);

    let i = 0;
    while (i < this.activeCount) {
      this.lifetime[i] = this.lifetime[i]! - dtSec;

      if (this.lifetime[i]! <= 0) {
        // Swap with last active and shrink pool
        this.activeCount--;
        if (i < this.activeCount) {
          this.x[i] = this.x[this.activeCount]!;
          this.y[i] = this.y[this.activeCount]!;
          this.vx[i] = this.vx[this.activeCount]!;
          this.vy[i] = this.vy[this.activeCount]!;
          this.lifetime[i] = this.lifetime[this.activeCount]!;
          this.temperature[i] = this.temperature[this.activeCount]!;
        }
        continue;
      }

      // Gravity (positive Y = down in screen coords)
      this.vy[i] = this.vy[i]! + gravity * dtSec;

      // Linear drag
      const dragFactor = 1.0 - drag * dtSec;
      this.vx[i] = this.vx[i]! * Math.max(0, dragFactor);
      this.vy[i] = this.vy[i]! * Math.max(0, dragFactor);

      // Position integration
      this.x[i] = this.x[i]! + this.vx[i]! * dtSec;
      this.y[i] = this.y[i]! + this.vy[i]! * dtSec;

      // Cool down
      this.temperature[i] = this.temperature[i]! * coolDecay;

      i++;
    }
  }

  getActiveState(): { positions: Float32Array; temperatures: Float32Array; velocities: Float32Array; count: number } {
    const count = this.activeCount;
    const positions = new Float32Array(count * 3);
    const temperatures = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = this.x[i]!;
      positions[i * 3 + 1] = this.y[i]!;
      positions[i * 3 + 2] = 0;
      temperatures[i] = this.temperature[i]!;
      velocities[i * 3] = this.vx[i]!;
      velocities[i * 3 + 1] = this.vy[i]!;
      velocities[i * 3 + 2] = 0;
    }
    return { positions, temperatures, velocities, count };
  }

  applyForceField(sampleForce: (x: number, y: number) => [number, number], blend: number, dt: number): void {
    if (blend <= 0) return;
    const dtSec = dt / 1000;
    const forceMul = blend * dtSec * 60;
    for (let i = 0; i < this.activeCount; i++) {
      const [fx, fy] = sampleForce(this.x[i]!, this.y[i]!);
      this.vx[i] = this.vx[i]! + fx * forceMul;
      this.vy[i] = this.vy[i]! + fy * forceMul;
    }
  }

  /**
   * v8 `15.6-salvage` A (2026-09-03) — carry the live sparks on the **liquid velocity field** the figure stirs,
   * i.e. relationship (C) crossed with (B): the curve sheds an ember and its own wake then carries it.
   *
   * ## Why this is a SECOND method rather than a widened `applyForceField`
   *
   * ⚠️ **The two fields differ in UNIT, in INTEGRATION and in GATE, and only the third is obvious.**
   * `applyForceField` above takes a TransMap force in pixels and ACCUMULATES it (`v += f·blend·dt·60`), which
   * suits a force. This field's readback is a **UV displacement per 60 Hz frame** — the same quantity
   * `LiquidPool` documents at length — so it is a *velocity*, and a velocity is something a body RELAXES
   * TOWARD, not something added to its own velocity every frame. Accumulating one would ramp an ember's speed
   * without bound for as long as it sat in a convergence zone, on a field that has no pressure projection to
   * bound divergence. Their gates are independently derived too (`currentTransMapForceSparks && blend > 0 &&
   * enabled && isActive()` versus `currentLiquidField.enabled`), so one method taking both would let either
   * field's gate suppress the other's.
   *
   * ## The unit chain, and the two constants that are IMPORTED rather than restated
   *
   * `LiquidPool.SPEED` and `LiquidPool.INERTIA` are read off that class, not re-typed: this is the same field
   * moving the same kind of body, and a second spelling of either number is how two populations in one frame
   * come to drift apart at different rates. `field · min(w,h) · 60 · SPEED` is the px/s conversion derived in
   * `LiquidPool.SPEED`'s own doc — ⚠️ **`min(w,h)` because the field is addressed in UV, whose two axes are
   * `w` and `h` pixels per unit, so a per-axis scale would make the coupling ANISOTROPIC** (invariant 26).
   *
   * ## Coupling 0 must be byte-identical to off, and a relaxation is not
   *
   * ⚠️ **RELAXING TOWARD A ZERO TARGET IS DRAG, NOT INERTNESS.** With no early return, a pool enabled at
   * `fieldCoupling: 0` would quietly damp every ember's ejection velocity toward zero — an inertness bug that
   * presents as *"sparks got weaker when I enabled the liquid field"*, which names the wrong control. The
   * `coupling <= 0` return is therefore load-bearing, and it is the force gate's *lerp from 1* rule in its
   * discrete form. Above 0 the drag-toward-the-field IS the intended behaviour: being carried by a wake means
   * losing your own velocity to it.
   *
   * @param sample bilinear field read, `(u, v, channel) => value`; the caller passes `null`-checked closure.
   * @param coupling `LiquidFieldConfig.fieldCoupling`, 0..1. **0 returns without touching a single spark.**
   * @param dt frame time in MILLISECONDS, as every other method here takes it.
   * @param width canvas width in pixels — the field is addressed in UV, so positions must be normalised.
   * @param height canvas height in pixels.
   */
  applyFieldFlow(
    sample: (u: number, v: number, channel: number) => number,
    coupling: number,
    dt: number,
    width: number,
    height: number,
  ): void {
    if (!(coupling > 0) || this.activeCount === 0) return;
    const w = Math.max(1, width), h = Math.max(1, height);
    const dtSec = dt / 1000;
    if (!(dtSec > 0)) return;
    const gain = coupling * LiquidPool.SPEED * Math.min(w, h) * 60;
    const relax = 1 - Math.exp(-LiquidPool.INERTIA * dtSec);
    for (let i = 0; i < this.activeCount; i++) {
      const tx = sample(this.x[i]! / w, this.y[i]! / h, 0) * gain;
      const ty = sample(this.x[i]! / w, this.y[i]! / h, 1) * gain;
      // A non-finite readback texel would latch this ember's velocity for the rest of its life, and every
      // GPU-side guard is upstream of the CPU copy (invariant 21 — scan the CPU arrays). `LiquidPool.update()`
      // carries the identical test at the identical point, for the identical reason.
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      this.vx[i] = this.vx[i]! + (tx - this.vx[i]!) * relax;
      this.vy[i] = this.vy[i]! + (ty - this.vy[i]!) * relax;
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Allocated capacity, i.e. the `poolSize` this pool was constructed with.
   *
   * Distinct from `getActiveCount()`, and the distinction is load-bearing: `setSparkConfig` decides
   * whether to REALLOCATE by comparing the requested size against the pool's size. Comparing against
   * the live spark count instead means the two agree only in the instant the pool happens to be
   * exactly full, so nearly every call reallocated and destroyed every in-flight spark.
   */
  getCapacity(): number {
    return this.poolSize;
  }

  reset(): void {
    this.activeCount = 0;
    this.lifetime.fill(0);
  }

  dispose(): void {
    this.x = new Float32Array(0);
    this.y = new Float32Array(0);
    this.vx = new Float32Array(0);
    this.vy = new Float32Array(0);
    this.lifetime = new Float32Array(0);
    this.temperature = new Float32Array(0);
    this.activeCount = 0;
    this.poolSize = 0;
  }
}
