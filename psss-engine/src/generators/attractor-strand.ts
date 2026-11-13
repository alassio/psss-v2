/**
 * @file v8 Phase 37 — **the attractor STRAND: one trajectory walked into a ring buffer, so consecutive particles are
 * consecutive points along the path** (`SPEC-attractor-ribbons.md`, plan Phase 37).
 *
 * ## What it is
 *
 * The cloud layout (`warmOdeAttractor`) harvests particle `i` from one of 32 UNRELATED reference trajectories, so
 * index-adjacent particles sit on different orbits — even coverage, no order. The strand walks ONE trajectory and
 * emits a point every `ds` of ARC LENGTH, so particle `i` reads the point `i·ds` behind the head: the ordering the
 * wave figure has always had, extended to a figure source that never had it. ⚠️ **It is a WINDOW onto an infinite
 * trajectory, not a closed loop: the figure is OPEN (two free ends) and it SCROLLS** — the head writes new geometry
 * and the tail scrolls off.
 *
 * ## The output contract — unchanged, so the blend site needs no edit
 *
 * `fill()` writes `outX/Y/Z` normalised exactly as `iterateAttractor` does — `(v − centre) / attractorHalfExtent` —
 * so `lissajous.ts`' blend loop reads the strand through the same `[-1, 1]` contract as the cloud.
 *
 * ## The three laws, each a measured necessity
 *
 * 1. ⚠️⚠️ **THE EMITTER INTERPOLATES INSIDE THE INTEGRATION STEP AND RESUMES FROM THE EMITTED POINT** (§3.3): a fine
 *    step can cover more than `ds` where the flow is fast, and emitting at the step's END writes one point several
 *    times (min chord 0). So the emission sits at `t = (ds − acc) / seg` along the crossing segment and the walk
 *    continues FROM it — `p = e; acc = 0`, never `p = end; acc −= ds`, which drifts. A zero-length step advances.
 * 2. **The length is READ, not re-emitted** (`37.5`): the buffer holds points at the spacing of the BASE length;
 *    a breathing length re-reads it at `span / base` points per particle with linear interpolation — the strand
 *    visibly STRETCHES, it is not re-drawn — so the buffer is sized for the excursion's TOP.
 * 3. **The head's divergence guard does NOT clear the buffer** (`37.D14`): an escape or a JUMP (a step longer than
 *    `STRAND_JUMP` half-extents — which is what `iterateHalvorsen`'s own constant-offset reseed looks like on a
 *    one-particle state) reseeds the head with a salt from the EMISSION COUNT, discards the transient and goes on.
 *    One adjacent index pair then straddles two trajectories until it scrolls off — the stated cost.
 *
 * ⚠️ **Imports `attractors.ts` only.** The scratch arrays are FIELDS (invariant 8: allocation RATE).
 */
import type { AttractorParams } from '../core/interfaces.ts';
import {
  attractorHalfExtent, createAttractorState, initAttractorState, iterateAttractor,
  isFlatAttractor, type AttractorState, type AttractorTierOpts,
} from './attractors.ts';

/** The two layouts. Stored words; the labels (`Cloud`, `Strand`) live in the UI (`37.D8`). */
export type AttractorLayout = 'cloud' | 'strand';

/**
 * `37.D16` — **which attractor types CAN draw a strand: a TOTAL `Record`, so a new type is a compile error here.**
 * Only the six continuous ODE types have a trajectory to order. The two discrete maps' consecutive iterates are
 * uncorrelated by construction (a mean hop of 51.6 % of the figure on `Clifford Classic`), and the two escape
 * fields are grid-placed. On those four the `Layout` row stays VISIBLE and states the precondition inline, and
 * the cloud draws.
 */
export const STRAND_CAPABLE: Record<AttractorParams['type'], boolean> = {
  lorenz: true,
  rossler: true,
  thomas: true,
  halvorsen: true,
  aizawa: true,
  'nose-hoover': true,
  clifford: false,
  dejong: false,
  julia: false,
  mandelbrot: false,
};

/**
 * `37.D9` — **sub-steps per authored integration step, a TOTAL per-type constant (not a preset field).** It buys
 * trajectory smoothness only — the interpolating emitter makes correctness independent of it. 4 keeps a fine
 * step below the spacing on the shipped bodies; `halvorsen` is 16 because forward Euler at its authored
 * `dt = 0.005` is unstable for it (see `iterateHalvorsen`), which is a property of the TYPE.
 */
export const STRAND_FINE: Record<AttractorParams['type'], number> = {
  lorenz: 4,
  rossler: 4,
  thomas: 4,
  halvorsen: 16,
  aizawa: 4,
  'nose-hoover': 4,
  clifford: 1,
  dejong: 1,
  julia: 1,
  mandelbrot: 1,
};

/**
 * Strand length, in half-extents of arc (`ds = span · half / count`).
 *
 * ⚠️⚠️ **THE SPEC'S BAND (1–30, default 6) WAS A SKETCH FIGURE AND MEASURED FAR TOO SHORT** (`p72-span.mjs`,
 * 2026-11-13, 9 000 particles, a 48² footprint over the normalised XY against the CLOUD's own footprint): at span 6 a
 * strand covers only **8–23 %** of its attractor — one loop of a Lorenz lobe, not a butterfly — and it takes **48** to
 * reach about half (Lorenz 55 %, Halvorsen 48 %, Nosé-Hoover 89 %) and **192** to reach 80–98 %. ⚠️ **`thomas` and
 * `aizawa` PLATEAU at 54–63 %** — one orbit never visits all of a non-mixing attractor, the cloud's own
 * `ODE_WARM_REFS` finding seen from the strand's side — so no length makes those two read like their clouds.
 */
export const STRAND_SPAN_MIN = 2;
export const STRAND_SPAN_MAX = 192;
export const STRAND_SPAN_DEFAULT = 48;
/** Strand speed, in emitted points per 60 Hz frame. 0 FREEZES the strand. */
export const STRAND_ADVANCE_MIN = 0;
export const STRAND_ADVANCE_MAX = 64;
export const STRAND_ADVANCE_DEFAULT = 12;
/** A head step longer than this many half-extents is a reseed, not motion (`iterateHalvorsen`'s jump). */
const STRAND_JUMP = 0.5;
/** The head escape radius in half-extents — `warmOdeAttractor`'s `ODE_WARM_ESCAPE`. */
const STRAND_ESCAPE = 4;
/** Transient discarded after a reseed, in fine steps — `ODE_WARM_SKIP`'s order. */
const STRAND_SKIP = 2000;
/** Consecutive reseeds before the head gives up for this frame — `ODE_WARM_RETRIES`. */
const STRAND_RETRIES = 8;
/**
 * Hard ceilings on fine steps, so a pathological parameter set (a flow that has collapsed onto a fixed point, such as
 * `Lorenz Tight`, where no step ever covers `ds`) degrades rather than hangs: per running frame, and for the one-off
 * fill at build time, which must reach the whole capacity on the slowest shipped flow at the longest span.
 */
const STRAND_MAX_STEPS = 20_000;
const STRAND_FILL_MAX_STEPS = 4_000_000;

export interface StrandConfig {
  span: number;
  advance: number;
}

/** The per-frame resolved values (breathing applied by the caller through `resolveOp`). */
export interface StrandFrame {
  span: number;
  advance: number;
  /** The breathing excursion's TOP, so the buffer is sized for it. */
  spanTop: number;
}

export class AttractorStrand {
  readonly params: AttractorParams;
  count = 0;
  /** Ring buffer of emitted points, RAW attractor units, xyz interleaved. */
  buf: Float32Array = new Float32Array(0);
  /** Capacity in points (≥ count · spanTop / spanBase + 2). */
  cap = 0;
  /** Index of the newest point. */
  head = 0;
  /** Points written so far (saturates at `cap`); also the reseed SALT. */
  emitted = 0;
  /** The spacing the buffer was written at, and the base length it was derived from. */
  ds = 0;
  spanBase = 0;
  /** The published centre, from the 32-reference bank (`37.D12`) — the cloud path's own value. */
  centreX = 0;
  centreY = 0;
  centreZ = 0;
  /** The one-particle head state, stepped by `iterateAttractor` (the cloud's integrators, unchanged). */
  private readonly h: AttractorState;
  private readonly sink = new Float32Array(1);
  /** Arc length counted since the last emission, up to the walk CURSOR (see `emit`). */
  private acc = 0;
  private cx = 0;
  private cy = 0;
  private cz = 0;
  /** Fractional emissions carried across frames (the advance is a COUNT, quantised with its remainder carried). */
  private carry = 0;
  /** Reseeds since the strand was built — read by the checker. */
  reseeds = 0;

  constructor(params: AttractorParams, count: number, cfg: StrandFrame,
    tile?: { tier: AttractorTierOpts; bank: AttractorState | null }) {
    this.params = params;
    this.h = createAttractorState(1);
    // `37.D12`: the centre and the head's start come from the cloud's OWN 32-reference bank at THIS count, so the
    // strand cannot measure its own orbit (a single Lorenz orbit sits in one lobe — wrong by a lobe). A preview tile
    // hands the state it already warmed (its own cheaper bank), so a strand tile costs no second warm-up.
    let bank = tile?.bank ?? null;
    if (!bank || bank.x.length < 1) {
      bank = createAttractorState(Math.max(1, count));
      initAttractorState(bank, params, 0, tile?.tier);
    }
    this.centreX = bank.centreX; this.centreY = bank.centreY; this.centreZ = bank.centreZ;
    this.h.x[0] = bank.x[0]!; this.h.y[0] = bank.y[0]!; this.h.z[0] = bank.z[0]!;
    this.rebuild(count, cfg);
  }

  /** Size the buffer for `count` particles at this base span and refill it by walking forward from the head. */
  rebuild(count: number, cfg: StrandFrame): void {
    const half = attractorHalfExtent(this.params.type) || 1;
    this.count = Math.max(1, count);
    this.spanBase = cfg.span;
    this.ds = (cfg.span * half) / this.count;
    this.cap = Math.ceil(this.count * Math.max(1, cfg.spanTop / cfg.span)) + 2;
    if (this.buf.length < this.cap * 3) this.buf = new Float32Array(this.cap * 3);
    this.head = 0;
    this.emitted = 0;
    this.acc = 0;
    // The first point is the head itself; then fill the whole capacity so frame 1 draws the full strand.
    this.cx = this.h.x[0]!; this.cy = this.h.y[0]!; this.cz = this.h.z[0]!;
    this.write(this.cx, this.cy, this.cz);
    this.emit(this.cap - 1, STRAND_FILL_MAX_STEPS);
  }

  private write(x: number, y: number, z: number): void {
    this.head = (this.head + 1) % this.cap;
    const k = this.head * 3;
    this.buf[k] = x; this.buf[k + 1] = y; this.buf[k + 2] = z;
    this.emitted++;
  }

  /** Re-place the head off its orbit, salted by the emission count, and eat the transient. */
  private reseed(): void {
    this.reseeds++;
    const salt = this.emitted + this.reseeds * 7919;
    const phi = ((salt * 97) % 997) / 997 * Math.PI * 2;
    const rad = 0.1 + (salt % 7) * 0.05;
    this.h.x[0] = rad * Math.cos(phi) + 0.05;
    this.h.y[0] = rad * Math.sin(phi) + 0.05;
    this.h.z[0] = rad * Math.sin(phi * 0.7) + 0.03;
    const fine = STRAND_FINE[this.params.type];
    for (let n = 0; n < STRAND_SKIP; n++) iterateAttractor(this.h, this.params, this.sink, this.sink, this.sink, 1 / fine);
    // Resume the walk from the new head: the emission continues there (the buffer is NOT cleared).
    this.cx = this.h.x[0]!; this.cy = this.h.y[0]!; this.cz = this.h.z[0]!;
    this.acc = 0;
  }

  /**
   * Emit `n` points along the trajectory, stepping the head at `dt / STRAND_FINE`.
   *
   * ⚠️⚠️ **THE WALK CURSOR PERSISTS ACROSS CALLS, AND ITS FIRST DRAFT DID NOT.** The cursor (`cx/cy/cz`) is the
   * point on the path up to which arc has been counted into `acc`; the path from it to the head is the straight
   * remainder of the current integration step. A call that runs out of emissions MID-STEP leaves the cursor at the
   * last emitted point, and the next call consumes that remainder BEFORE stepping again. The first draft restarted
   * each call at the head, so the part of a step between the last emission and the head was never counted: every
   * frame boundary wrote one chord of `(head − e) + ds` — measured up to 7× `ds` on `Lorenz Classic`, 13× on
   * `Nosé-Hoover Flow`, one long chord per frame, i.e. an index-adjacency break the frame rate kept re-cutting.
   */
  emit(n: number, maxSteps = STRAND_MAX_STEPS): void {
    if (n <= 0) return;
    const half = attractorHalfExtent(this.params.type) || 1;
    const jump2 = (STRAND_JUMP * half) ** 2, esc2 = (STRAND_ESCAPE * half) ** 2;
    const fine = STRAND_FINE[this.params.type];
    const ds = this.ds;
    let left = n, steps = 0, retries = 0;
    while (left > 0) {
      const hx = this.h.x[0]!, hy = this.h.y[0]!, hz = this.h.z[0]!;
      const sx = hx - this.cx, sy = hy - this.cy, sz = hz - this.cz;
      const seg = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (seg > 0 && this.acc + seg >= ds) {
        // Emit INSIDE the remaining segment, then RESUME from the emitted point (law 1) — never from its end.
        const t = (ds - this.acc) / seg;
        const x = this.cx + sx * t, y = this.cy + sy * t, z = this.cz + sz * t;
        this.write(x, y, z);
        this.cx = x; this.cy = y; this.cz = z;
        this.acc = 0;
        left--;
        continue;
      }
      // The remaining segment holds no emission: count it and take the next integration step.
      this.acc += seg;
      this.cx = hx; this.cy = hy; this.cz = hz;
      if (steps >= maxSteps) break;
      iterateAttractor(this.h, this.params, this.sink, this.sink, this.sink, 1 / fine);
      steps++;
      const bx = this.h.x[0]!, by = this.h.y[0]!, bz = this.h.z[0]!;
      const dx = bx - hx, dy = by - hy, dz = bz - hz;
      const step2 = dx * dx + dy * dy + dz * dz;
      if (!Number.isFinite(step2) || step2 > jump2 || bx * bx + by * by + bz * bz > esc2) {
        if (++retries > STRAND_RETRIES) break;
        this.reseed();
        continue;
      }
      retries = 0;
    }
  }

  /** One frame: advance by `advance · dtScale` points (remainder carried), then publish the window. */
  step(frame: StrandFrame, dtScale: number, outX: Float32Array, outY: Float32Array, outZ: Float32Array, count: number): void {
    if (count !== this.count || frame.span !== this.spanBase || this.cap < Math.ceil(count * Math.max(1, frame.spanTop / frame.span)) + 2) {
      this.rebuild(count, frame);
    }
    const ts = Math.max(0, Math.min(dtScale, 6.0));
    const want = frame.advance * ts + this.carry;
    const whole = Math.floor(want);
    this.carry = want - whole;
    this.emit(whole);
    this.fill(frame.span, outX, outY, outZ, count);
  }

  /** Publish particle `i` = the point `i · ds · (span / spanBase)` behind the head, normalised (law 2). */
  fill(span: number, outX: Float32Array, outY: Float32Array, outZ: Float32Array, count: number): void {
    const half = attractorHalfExtent(this.params.type) || 1;
    const flat = isFlatAttractor(this.params.type);
    const cx = this.centreX, cy = this.centreY, cz = this.centreZ;
    const avail = Math.min(this.emitted, this.cap) - 1;
    const r = count > 1 ? (span / this.spanBase) * (this.count / count) : 0;
    const buf = this.buf, cap = this.cap, head = this.head;
    for (let i = 0; i < count; i++) {
      let u = i * r;
      if (u > avail) u = avail;
      const k0 = Math.floor(u), f = u - k0;
      const a = ((head - k0) % cap + cap) % cap, b = ((head - k0 - 1) % cap + cap) % cap;
      const ia = a * 3, ib = b * 3;
      const x = f === 0 ? buf[ia]! : buf[ia]! + (buf[ib]! - buf[ia]!) * f;
      const y = f === 0 ? buf[ia + 1]! : buf[ia + 1]! + (buf[ib + 1]! - buf[ia + 1]!) * f;
      const z = f === 0 ? buf[ia + 2]! : buf[ia + 2]! + (buf[ib + 2]! - buf[ia + 2]!) * f;
      outX[i] = (x - cx) / half;
      outY[i] = (y - cy) / half;
      outZ[i] = flat ? 0 : (z - cz) / half;
    }
  }
}
