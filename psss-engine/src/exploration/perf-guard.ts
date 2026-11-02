/**
 * Enter the THROTTLED level below this — the historical `FPS_THRESHOLD`, unchanged.
 *
 * 50 was too aggressive once this guard gated the whole PREVIEW GRID and not just the 3x3 evolution
 * tiles it was written for. A heavy preset (`Miracle Frost`: 20 000 particles + a 970-slot crystal
 * pool + a material + TransMap style 3) legitimately runs the main loop below 50 fps, which latched
 * the guard and froze EVERY tile in the grid — and recovery was impossible, because reaching 55 fps
 * required deselecting the very preset the user had just chosen. 30 fps still catches genuine
 * pathology while letting a demanding-but-playable preset keep the grid alive.
 */
const FPS_THROTTLE_IN = 30;

/**
 * Leave the throttled level above this. **WAS `FPS_THRESHOLD + RECOVERY_MARGIN` = 35, and that 5 fps
 * band was the defect (2026-09-24).**
 *
 * ⚠️ **A hysteresis band must be WIDER THAN THE COST OF THE THING IT SWITCHES.** Measured on the built
 * artefact (ANGLE / AMD Radeon 8060S, 119.5 Hz panel, CDP `TaskDuration ÷ frames`), the tile grids cost
 * the main thread **4.4–7.3 ms per frame**: `Cylinder` 7.33, `Chemical` 4.93, `Boiling Milk` 4.37. At the
 * 30 fps trip a frame is 33.3 ms, so switching the grids off lands at 26.0–28.9 ms = **34.6–38.4 fps —
 * INSIDE the old 35 fps recovery.** The guard therefore recovered *because it had just degraded*, put the
 * cost straight back and tripped again. Measured: **21 latch/recover transitions in one run, and four
 * inside 30 s** of the `Cylinder`/`Chemical`/`Boiling Milk` probe, every trip at 29.x and every recovery
 * at 35.x — the signature of a band narrower than its own switch.
 *
 * 45 fps is 22.2 ms; adding the worst measured grid cost back gives 29.5 ms = 33.9 fps, which still
 * clears `FPS_THROTTLE_IN`. That is the property to preserve if either number is ever retuned:
 * **1000/(1000/FPS_THROTTLE_OUT + worstGridCostMs) must stay above `FPS_THROTTLE_IN`.**
 *
 * ⚠️ **The wider band is affordable only BECAUSE level 1 throttles instead of freezing.** With a boolean
 * latch, widening this number would have meant staying frozen for longer — strictly worse. Do not widen
 * one without the other.
 */
const FPS_THROTTLE_OUT = 45;

/**
 * Below this the tiles stop entirely — the old boolean's behaviour, now reserved for genuine pathology.
 *
 * ⚠️ **Freezing is what made the user-visible defect** (2026-09-24): a frozen tile has no warm-up left to
 * finish, so the grids stalled *while filling*. Measured after a scroll to a fresh region, time to first
 * ANIMATION in a newly revealed tile: `Boiling Milk` (50 675 particles, never tripped the guard)
 * 429–1041 ms and 50/50 distinct frames; `Barrock` (20 000 + Neon Lines, tripped) **2336–7307 ms** and
 * then 1/50 distinct frames; `Chemical` **NEVER, in 14 s**. At 15 fps the main view is itself unusable
 * and yielding the whole budget is right — but at 25 fps it is not, which is what level 1 exists for.
 */
const FPS_FREEZE_IN = 15;
/** Back to throttled above this. Same rule as `FPS_THROTTLE_OUT`: 22 fps = 45.5 ms, and the grids' own
 *  4.4–7.3 ms cannot push that back under 15 fps (66.7 ms). */
const FPS_FREEZE_OUT = 22;

/**
 * Steady-state tile cadence divisor at level 1 — **the reason this class no longer needs to freeze.**
 *
 * The grids' cost is dominated by the steady pass (a render plus a synchronous `readPixels` per tile), so
 * dividing that cadence by 3 removes roughly two thirds of the 4.4–7.3 ms rather than all of it, at the
 * price of 5 tile-fps instead of 15. ⚠️ **`GridTileRenderer` exempts a grid with warm-up still pending**
 * (see `tick`), because filling the grid is work the user is WAITING on — throttling that is what "the
 * previews take seconds to appear" is made of, and it is the half of the complaint a freeze cannot fix.
 */
const TILE_THROTTLE_SCALE = 3;

const SAMPLE_COUNT = 30;

/**
 * Consecutive above-`FPS_THROTTLE_OUT` windows required to leave level 1, DOUBLING each time a recovery
 * fails to hold — and its ceiling.
 *
 * ⚠️ **A hysteresis BAND cannot fix an oscillation whose switch costs a FRACTION of the frame** (2026-09-24).
 * `FPS_THROTTLE_OUT`'s note derives 45 fps from the grids' measured 4.4–7.3 ms, and that derivation assumed an
 * absolute cost. Since the grids now spend a duty cycle (15 % of every frame — `GridTileRenderer`'s
 * `STEADY_DUTY`), their cost SCALES with the frame they are added back into, so no fixed band can be proved
 * wide enough: measured on `Chemical` (20 000 particles, `star`, 100 % CPU-bound with the grid hidden), the
 * recovery lands at 45.4 and the next window reads 29.x — **8 transitions in one 20 s phase**, every trip at
 * 28.8–29.8 and every recovery at 45.1–45.9, which is the same signature the boolean latch printed.
 *
 * The band stays as it is; what changes is that a FAILED recovery makes the next one slower to try. Level 1
 * animates the tiles at 5 fps rather than stopping them, so probing less often costs only tile frame rate,
 * while probing too often is what the user SEES — the previews speeding up and slowing down about twice a
 * second. ⚠️ **The down-shift is never dwelled.** A guard that is slow to degrade is a guard that does not
 * work; only the optimistic direction may be made expensive.
 */
const RECOVER_DWELL_MAX = 8;
/**
 * Frames a recovery must survive before it counts as having HELD, resetting the dwell to 1.
 *
 * Without this the dwell only ever grows, so one bad preset would permanently slow every later recovery in
 * the session — the ratchet that `updateSlotCap`'s `peakConcurrentDemand` relaxation exists to avoid, in a
 * different subsystem. 600 frames is 5 s at 120 Hz and 10 s at 60 Hz: long enough that a recovery which
 * survives it was genuinely affordable, and it is deliberately read in FRAMES rather than seconds because
 * every other figure in this class is a frame count and mixing the two units is how a threshold silently
 * becomes refresh-rate-dependent.
 */
const RECOVER_STICK_FRAMES = 600;

/**
 * Frames to wait after a preset change before the guard may trip again.
 *
 * A preset switch reallocates buffers, recompiles programs and re-warms trails, so the frames right
 * after it are unrepresentatively slow. Without this the guard latched on the switch itself.
 */
const SETTLE_FRAMES = 90;

/** 0 = full cadence, 1 = throttled steady cadence, 2 = tiles stopped. */
export type PerfLevel = 0 | 1 | 2;

/**
 * FPS latch. Owns no renderer references — it only reports, via `level()` and its two derived readings.
 *
 * It used to hold an `EvoTileRenderer` supplied by `attach()` and call `setActive()` on it directly.
 * `attach()` had no callers, so those calls were always no-ops, and the reference existed solely to
 * keep a 288-line unused predecessor of `GridTileRenderer` alive; all of it was deleted on 2026-08-06.
 * Gating happens where it belongs: the single `if (!perfGuard.tilesFrozen())` check in `main.ts`, which
 * covers all four tile renderers at once and hands each one `tileThrottle()`.
 *
 * That gate is deliberately all-or-nothing ACROSS GRIDS and cannot shed one grid to save another — see
 * triage item H1 for the unshared-budget problem it only partly mitigates. What it is no longer
 * all-or-nothing about is the RESPONSE: see `FPS_THROTTLE_OUT` and `TILE_THROTTLE_SCALE`.
 */
export class PerfGuard {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private lvl: PerfLevel = 0;
  private settle = 0;
  /** Consecutive evaluations at or above `FPS_THROTTLE_OUT` while throttled. See `RECOVER_DWELL_MAX`. */
  private windowsAbove = 0;
  /** Windows the next recovery must wait for. Doubles on a recovery that fails to hold, capped. */
  private recoverDwell = 1;
  /** Frames since the last 1 -> 0 recovery, or -1 when there has not been one. */
  private framesSinceRecover = -1;

  /**
   * Call on any event that makes the next few frames unrepresentative (preset change, resize).
   * Clears the sample window, releases the degraded latch and holds off re-evaluation.
   */
  reset(): void {
    this.frameTimes = [];
    this.lastTime = 0;
    this.settle = SETTLE_FRAMES;
    this.lvl = 0;
    // ⚠️ The dwell state is cleared too. It describes how this MACHINE coped with the OUTGOING preset, and
    // `reset()`'s callers are exactly the events that make that reading obsolete — a preset switch or a
    // resize. Carrying a doubled dwell across a switch would make a cheap preset inherit an expensive one's
    // pessimism, with no measurement of its own able to say so for up to eight windows.
    this.windowsAbove = 0;
    this.recoverDwell = 1;
    this.framesSinceRecover = -1;
  }

  tick(time: number): void {
    if (this.framesSinceRecover >= 0) {
      this.framesSinceRecover++;
      // A recovery that has held this long was affordable; stop making the next one wait.
      if (this.framesSinceRecover >= RECOVER_STICK_FRAMES) {
        this.framesSinceRecover = -1;
        this.recoverDwell = 1;
      }
    }
    if (this.settle > 0) {
      this.settle--;
      this.lastTime = time;
      return;
    }
    if (this.lastTime > 0) {
      const dt = time - this.lastTime;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > SAMPLE_COUNT) {
        this.frameTimes.shift();
      }
      if (this.frameTimes.length === SAMPLE_COUNT) {
        this.evaluate();
      }
    }
    this.lastTime = time;
  }

  private evaluate(): void {
    const avgDt = this.frameTimes.reduce((s, v) => s + v, 0) / this.frameTimes.length;
    const avgFps = 1000 / avgDt;

    // ⚠️ `debug`, not `warn`, and the reason is diagnostic rather than cosmetic (2026-08-23). Degrading is
    // this class WORKING — it is a designed response to a slow frame, not a defect — and a preset that sits
    // near the threshold flips repeatedly, so at `warn` level these two lines dominate the console during
    // exactly the heavy sessions a real fault is being hunted in. They stay retrievable at Verbose level.
    //
    // They are also actively MISLEADING next to a black-frame report: the 2026-08-22 log showed
    // "fps recovered — 115.6" while the canvas was black, and a `warn` beside a `[GLDIAG]` line reads as
    // related evidence when it is unrelated. Neither line is deleted; both are still the only signal that
    // the tile grids stopped ticking.
    //
    // ⚠️ **One transition per evaluation, and the DOWN tests come first.** A single evaluation may not skip
    // level 1 on the way down: the throttle is what the machine is then measured under, so jumping straight
    // to frozen would decide against a cost that had not been reduced yet — the same mistake as judging
    // recovery against the degraded state. The window is `SAMPLE_COUNT` frames, so the ladder descends one
    // rung per ~30 frames, which at any refresh rate is well under half a second.
    //
    // ⚠️ **The dwell counter is updated on EVERY evaluation at level 1, including the ones that do not
    // recover** — it is a count of CONSECUTIVE good windows, so a single window below the band has to reset it.
    // Reading it only inside the recovery branch would make it a count of good windows ever seen, which any
    // oscillating preset accumulates.
    if (this.lvl === 1) {
      this.windowsAbove = avgFps >= FPS_THROTTLE_OUT ? this.windowsAbove + 1 : 0;
    }
    const next: PerfLevel = this.lvl === 0
      ? (avgFps < FPS_THROTTLE_IN ? 1 : 0)
      : this.lvl === 1
        ? (avgFps < FPS_FREEZE_IN ? 2 : this.windowsAbove >= this.recoverDwell ? 0 : 1)
        : (avgFps >= FPS_FREEZE_OUT ? 1 : 2);
    if (next === this.lvl) return;

    const was = this.lvl;
    this.lvl = next;
    if (next === 1 && was === 0) {
      // Trip. If the recovery we are undoing has not yet HELD, it was optimistic — make the next one wait
      // longer. `framesSinceRecover` is still counting exactly while that is true, which is why the test is on
      // the counter rather than on a remembered timestamp.
      if (this.framesSinceRecover >= 0) {
        this.recoverDwell = Math.min(RECOVER_DWELL_MAX, this.recoverDwell * 2);
      }
      this.framesSinceRecover = -1;
      this.windowsAbove = 0;
    } else if (next === 0 && was === 1) {
      this.framesSinceRecover = 0;
      this.windowsAbove = 0;
    }
    const what = next === 0
      ? 'full tile cadence restored'
      : next === 1
        ? `throttling ALL tile grids to 1/${TILE_THROTTLE_SCALE} steady cadence (warm-up exempt)`
        : 'pausing ALL tile grids (evolution, history, reel, preview)';
    // The dwell is printed on every transition, not only when it changes: an oscillation is only diagnosable
    // from the console if the line says how hard the guard was already trying not to oscillate.
    console.debug(`[PerfGuard] fps=${avgFps.toFixed(1)} dwell=${this.recoverDwell} — level ${was} -> ${next}: ${what}`);
  }

  level(): PerfLevel {
    return this.lvl;
  }

  /** Level 2 only. The gate in `main.ts` skips every `tick()` on this. */
  tilesFrozen(): boolean {
    return this.lvl === 2;
  }

  /**
   * Cadence divisor to hand `GridTileRenderer.tick`. 1 at level 0.
   *
   * ⚠️ Returns a divisor even at level 2, where the caller never reads it — the meaningful value at level 2
   * is "no tick at all", which a number cannot express. `tilesFrozen()` is the only reading for that.
   */
  tileThrottle(): number {
    return this.lvl === 1 ? TILE_THROTTLE_SCALE : 1;
  }
}
