import type { GeneratorState } from '../core/interfaces.ts';
import type { ForceGateSource } from '../presets/types.ts';

/** Reference frame time the force constants below were tuned at. */
const FRAME_MS_60 = 1000 / 60;

/** `forceMul` at 60 fps, i.e. the original `dt * 0.06` evaluated at 16.67 ms. Exactly 1.0. */
const FORCE_MUL_60 = FRAME_MS_60 * 0.06;

/**
 * Frame-time normalisation for the offset recurrence `off = off * retain + increment`.
 *
 * Both force paths accumulate into a persistent per-particle offset, so the visible AMPLITUDE is the
 * recurrence's steady state — `increment / (1 - retain)` — not the increment itself. Getting that
 * wrong makes the whole figure breathe in time with ordinary `requestAnimationFrame` jitter, because
 * every particle's offset scales by the same factor at once.
 *
 * The original code had `retain = exp(-k·dt)` and `forceMul = blend · dt · 0.06`. Both scaled with
 * `dt`, so they PARTLY cancelled — about a 4.7 % amplitude swing across a 13–20 ms frame spread,
 * which is mild. But `applyIfsForces` also clamps the increment to `maxForcePixels`, and **once that
 * clamp engages the increment is pinned while `retain` keeps varying**, so the cancellation stops
 * entirely: measured 47 % amplitude swing over the same frame spread. On a strong preset the clamp
 * engages on nearly every particle, every frame — which is why the jitter was reported on `Chemical`
 * with Force Blend enabled, and why it looked like the steering itself was unstable.
 *
 * The fix is to express the increment as "the 60 fps value, rescaled by how much decay this frame
 * actually applied": `depositScale = (1 - retain) / rate60`. Then
 * `increment / (1 - retain) = increment60 / rate60` for ANY `dt` — exactly invariant, verified to
 * 7e-15 across 10–33 ms. `depositScale` is 1.0 at 60 fps, so nothing changes there.
 *
 * ⚠️ The clamp must be scaled by `depositScale` too. It bounds the increment, and an unscaled bound
 * would re-break the invariance it exists inside — that is the whole mechanism above.
 */
function frameNormalisation(returnForce: number, dt: number): { retain: number; depositScale: number } {
  // The per-frame decay fraction this code was tuned with, at 60 fps.
  const rate60 = 1 - Math.exp(-Math.max(0, returnForce) * 0.15);
  if (rate60 <= 1e-6) {
    // returnForce ~0: no decay, so there is no steady state to preserve. Scale the increment by real
    // elapsed time instead, which is the correct limit and keeps drift rate frame-rate independent.
    return { retain: 1, depositScale: dt / FRAME_MS_60 };
  }
  const k = -Math.log(1 - rate60) * 60;
  const retain = Math.exp(-k * (dt / 1000));
  return { retain, depositScale: (1 - retain) / rate60 };
}

export class TransMapForceField {
  private gl: WebGL2RenderingContext | null = null;
  private width = 0;
  private height = 0;
  /**
   * The raw `readPixels` destination, RGBA at canvas resolution. `sampleForce` reads it with stride 4
   * and takes `.r`/`.g` in place.
   *
   * ⚠️ There used to be a SECOND, compact `readbackBuffer` of `width * height * 2`, and a loop in
   * `readback()` copying R and G into it. Deleted 2026-08-12 (triage H2) — see `readback()` for the
   * measurements. `sampleForce` was its only reader, and reading the RGBA buffer with a stride costs
   * nothing extra.
   */
  private rgbaBuffer: Float32Array | null = null;
  private frameCounter = 0;
  private active = false;
  private currentTexture: WebGLTexture | null = null;

  /** Reused readback FBO, and the texture currently attached to it. See `readback()`. */
  private readbackFBO: WebGLFramebuffer | null = null;
  private attachedTexture: WebGLTexture | null = null;
  /**
   * v8 performance pass (G4b, 2026-11-12) — the ASYNC readback: a PIXEL_PACK buffer the read lands in, the fence that
   * says it has, and the size it was issued at (a read that predates a resize is dropped, never copied — its rows
   * would be the wrong length). See `readback()`.
   */
  private packBuffer: WebGLBuffer | null = null;
  private packBytes = 0;
  private packSync: WebGLSync | null = null;
  private packW = 0;
  private packH = 0;

  // Persistent per-particle offsets
  private offsetX: Float32Array | null = null;
  private offsetY: Float32Array | null = null;

  // IFS per-particle transform assignments
  private transformAssignments: Uint8Array | null = null;
  private reassignCounter: number = 0;
  private lastIfsTransformCount: number = 0;

  // ---- Particle-attribute gate (v8 Step 14.4) ---------------------------------------------------
  private gateSource: ForceGateSource = 'none';
  private gateAmount = 0;
  private gateInvert = false;
  private gateHalfLife = 2.0;
  /**
   * Per-particle force multiplier for THIS frame, grow-only and rebuilt by `prepareGate()`.
   *
   * ⚠️ **`gateActive` is a flag over this buffer and must die with it** (invariant 3). It is also the ONLY
   * gate on reading it: both force loops multiply by `buf[i]` without re-testing the source, so a true flag
   * over a null or stale buffer would either throw or apply a previous preset's gate.
   */
  private gateBuf: Float32Array | null = null;
  private gateActive = false;

  init(gl: WebGL2RenderingContext, width: number, height: number): void {
    // Drop any FBO from a previous init — a re-init can carry a different context, and an FBO is not
    // valid across contexts. Cheap insurance: this is called once at startup today.
    if (this.gl && this.readbackFBO) this.gl.deleteFramebuffer(this.readbackFBO);
    this.readbackFBO = null;
    this.attachedTexture = null;
    // G4b: likewise the async readback's buffer and fence (they belong to the previous context).
    if (this.gl && this.packBuffer) this.gl.deleteBuffer(this.packBuffer);
    if (this.gl && this.packSync) this.gl.deleteSync(this.packSync);
    this.packBuffer = null; this.packSync = null; this.packBytes = 0; this.packW = 0; this.packH = 0;
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.rgbaBuffer = new Float32Array(width * height * 4);
    this.frameCounter = 0;
  }

  setFlowTexture(tex: WebGLTexture | null): void {
    this.currentTexture = tex;
    // A texture is not the only source any more — see `setAnalyticSampler`. Keying `active` on `tex` alone
    // here would switch the static force path off the moment a chain's flow layer was removed.
    this.active = tex !== null || this.analyticSampler !== null;
    // `readback()` re-attaches lazily on mismatch, so nothing to do here. Identity comparison is sound
    // because WebGL objects are opaque handles, not reusable integer names.
  }

  /**
   * An O(1) CPU sampler for the field, used INSTEAD of the readback where one exists.
   *
   * ⚠️ **This is what replaced a 31.6 MB synchronous `readPixels` every 4th frame** (the largest of the
   * engine's three, and the only one that grew with the window). Styles 0-3 became separable 1D waves on
   * 2026-08-20, so there is no canvas-sized texture left to read back — and evaluating the same waves per
   * particle is both cheaper and FRESHER, since the readback path fed particles a field up to 4 frames old.
   *
   * ⚠️ **`active` must account for this too.** It used to mean "a texture was handed over", and the spark
   * force path gates on `isActive()` alone; an analytic-only chain has no texture, so leaving `active` keyed
   * on the texture would have silently killed the static force path AND sparks. Pass `null` to detach —
   * a sampler left installed over a disposed chain is invariant 3's "flag over a dead resource".
   *
   * The callback writes into the 2-element buffer it is handed rather than returning a tuple: it runs once
   * per particle per frame, and the buffer is this object's own (invariant 8 — see `staticOffsetAt`).
   */
  setAnalyticSampler(fn: ((x: number, y: number, out: Float64Array) => void) | null): void {
    this.analyticSampler = fn;
    this.active = this.currentTexture !== null || fn !== null;
  }

  /**
   * Set when styles 0-3 are live. ⚠️ Checked BEFORE `rgbaBuffer` in `sampleForce`, because a chain with both
   * a static layer and the flow layer has both sources, and the two must SUM — the old combine pass summed
   * them on the GPU, and dropping it without summing here would have silently discarded one layer.
   */
  private analyticSampler: ((x: number, y: number, out: Float64Array) => void) | null = null;
  /** Scratch for `analyticSampler`'s output. One buffer for the whole loop; never escapes `sampleForce`. */
  private readonly analyticOut = new Float64Array(2);

  /**
   * H2 — this is the largest of the engine's three synchronous `readPixels` calls, by a wide margin,
   * and the fix here was NOT the one the triage row asked for.
   *
   * ⚠️ **The row's premise is that three readbacks on 2/4/4-frame cadences co-land every 4th frame.
   * They do, but that framing hides which one matters, and it needs a hand-built preset to reach at
   * all** — no shipped preset enables physarum, fluid advection and TransMap force together (all 177
   * legacy presets have no `overlay` block whatsoever, and of the 5 fire presets only one touches
   * TransMap). Volumes per occurrence:
   *
   *   physarum   512²  RGBA FLOAT   4.00 MB   every 4th frame
   *   fluid      512²  RGBA HALF    2.00 MB   every 2nd frame
   *   **this one  CANVAS RGBA FLOAT  12.0 MB at 1024×768, 31.6 MB at 1080p, 56.3 MB at 1440p**
   *
   * So the other two are fixed-size and small, and this one is 5-15× both combined and **grows with the
   * window**. Chasing the co-landing — staggering the cadences — would spread the total over more frames
   * while leaving the dominant term untouched, and staggering is not free: each simulation's sensing
   * lag is tuned against its own cadence.
   *
   * What was pure waste is the second buffer this used to fill. `readPixels` landed in `rgbaBuffer`, and
   * a loop then copied R and G into a compact `readbackBuffer` for `sampleForce` — its only reader.
   * Measured cost of that loop alone, per readback:
   *
   *   1024×768    0.79 ms   (786 k iterations, 12.0 MB read + 6.0 MB written)
   *   1920×1080   1.73 ms   (2.07 M iterations, 31.6 MB read + 15.8 MB written)
   *   2560×1440   3.03 ms   (3.69 M iterations, 56.3 MB read + 28.1 MB written)
   *
   * `sampleForce` now strides the RGBA buffer directly, which is the same number of loads at the same
   * offsets. That removes the loop, the extra 6-28 MB of writes, and `width * height * 2` floats of
   * resident memory (6.0 MB at 1080p), for identical output.
   *
   * ⚠️ **The remaining inefficiency is deliberate and left alone: the readback pulls the WHOLE canvas
   * for a consumer that samples at most a few percent of it** — `sampleForce` runs once per particle,
   * so 20 000 particles bilinearly tap under 80 000 texels of 2.07 M at 1080p (**3.9 %**, and that is an
   * upper bound since taps overlap). A gather-only path would need either a GPU scatter/gather pass
   * keyed on particle positions or `readPixels` on a sub-rect per particle, and the latter is far worse:
   * a `readPixels` call has a fixed sync cost that dwarfs its transfer at this size. Reducing the
   * SOURCE resolution is the tractable option — the displacement field is smooth and 512² would very
   * likely suffice — but that changes what particles feel, so it is a visual change, not a perf fix,
   * and belongs in its own item with a browser check.
   */
  readback(): void {
    const gl = this.gl;
    // ⚠️ Gated on `currentTexture`, NOT on `active` — `active` is now also true for an analytic-only chain
    // (styles 0-3 with no flow layer), which has nothing to read back. The `!currentTexture` test already
    // covered it, but the ordering is load-bearing enough to say so.
    if (!gl || !this.currentTexture || !this.rgbaBuffer) return;

    /*
     * ⚠️ **ASYNCHRONOUS since 2026-11-12 (G4b).** A synchronous `readPixels` of the whole canvas as float waited for
     * every queued GPU command; on the owner's three machines `Lava Flow` (one of the 9 force presets) ran at
     * p50 = the refresh but p95 50–183 ms and worst 67–200 ms — the 4th-frame stall. Now the read goes into a
     * PIXEL_PACK buffer with a fence and returns at once; each frame the fence is POLLED (never waited on) and, once
     * it has signalled, the data is copied into `rgbaBuffer` — the one array `sampleForce` reads. The field arrives
     * one or two frames later than before; it was already up to four frames old by design.
     */
    if (this.packSync) {
      const status = gl.getSyncParameter(this.packSync, gl.SYNC_STATUS);
      if (status === gl.SIGNALED) {
        if (this.packW === this.width && this.packH === this.height && this.packBuffer) {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.packBuffer);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.rgbaBuffer);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        }
        gl.deleteSync(this.packSync);
        this.packSync = null;
      }
    }

    this.frameCounter++;
    if (this.frameCounter % 4 !== 0 || this.packSync) return;

    // One FBO for the life of the object, re-attached only when the source texture actually changes.
    //
    // This used to `createFramebuffer` + `deleteFramebuffer` on every readback — 15 driver-side object
    // create/destroy pairs per second, all to read the same texture with the same attachment. The
    // attachment is the only thing that varies, and `setFlowTexture` is the only thing that varies it,
    // so caching what is attached makes the steady-state cost a single `bindFramebuffer`.
    if (!this.readbackFBO) {
      this.readbackFBO = gl.createFramebuffer();
      this.attachedTexture = null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.readbackFBO);
    if (this.attachedTexture !== this.currentTexture) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.currentTexture, 0);
      this.attachedTexture = this.currentTexture;
    }
    const bytes = this.width * this.height * 16;
    if (!this.packBuffer) this.packBuffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.packBuffer);
    if (this.packBytes !== bytes) {
      gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ);
      this.packBytes = bytes;
    }
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.packSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.packW = this.width;
    this.packH = this.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }


  /**
   * The field at a pixel, in PIXELS — the sum of whatever sources are live.
   *
   * Two independent contributions, and a chain can have both:
   *   - `analyticSampler` — styles 0-3, evaluated from their 1D waves, exact and current-frame.
   *   - `rgbaBuffer` — the style-5 flow texture, bilinear over the last readback (up to 4 frames old).
   */
  sampleForce(x: number, y: number): [number, number] {
    if (!this.active) return [0, 0];

    let ax = 0;
    let ay = 0;
    if (this.analyticSampler) {
      this.analyticSampler(x, y, this.analyticOut);
      // Same UV→pixel conversion as the texture path below, for the same reason: the field stores a
      // RELATIVE offset in UV, and the caller wants pixels (invariant 10 — check the units of the result).
      ax = this.analyticOut[0]! * this.width;
      ay = this.analyticOut[1]! * this.height;
    }
    if (!this.rgbaBuffer) return [ax, ay];

    // Convert pixel coords to buffer coords with bilinear interpolation
    const fx = Math.max(0, Math.min(this.width - 1.001, x));
    const fy = Math.max(0, Math.min(this.height - 1.001, y));
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const fracX = fx - ix;
    const fracY = fy - iy;

    const ix1 = Math.min(ix + 1, this.width - 1);
    const iy1 = Math.min(iy + 1, this.height - 1);

    // Stride 4, reading R and G in place. This was stride 2 over a compact RG copy until H2 deleted
    // that copy — the displacement is in `.rg`, so `+ 1` is still the G channel and the interpolation
    // below is unchanged.
    const idx00 = (iy * this.width + ix) * 4;
    const idx10 = (iy * this.width + ix1) * 4;
    const idx01 = (iy1 * this.width + ix) * 4;
    const idx11 = (iy1 * this.width + ix1) * 4;

    const buf = this.rgbaBuffer;
    const dx = (buf[idx00]! * (1 - fracX) * (1 - fracY) +
                buf[idx10]! * fracX * (1 - fracY) +
                buf[idx01]! * (1 - fracX) * fracY +
                buf[idx11]! * fracX * fracY);
    const dy = (buf[idx00 + 1]! * (1 - fracX) * (1 - fracY) +
                buf[idx10 + 1]! * fracX * (1 - fracY) +
                buf[idx01 + 1]! * (1 - fracX) * fracY +
                buf[idx11 + 1]! * fracX * fracY);

    return [ax + dx * this.width, ay + dy * this.height];
  }

  // ---- Particle-attribute gate (v8 Step 14.4) ---------------------------------------------------

  /**
   * Configure which per-particle attribute scales the force. See `overlay.transMapForceGateBy`.
   *
   * Separate from `prepareGate()` because these four values change on a slider drag while the BUFFER has
   * to be rebuilt every frame from live state — keeping them apart is what lets `prepareGate` be the one
   * place that decides whether the gate is genuinely usable this frame.
   */
  setGate(source: ForceGateSource, amount: number, invert: boolean, halfLife: number): void {
    this.gateSource = source;
    this.gateAmount = Math.max(0, Math.min(1, amount));
    this.gateInvert = invert;
    // Floored well above zero: `exp(-age * ln2 / halfLife)` diverges at 0, and a half-life below a frame
    // would make every particle read gate 0 within one step, which is indistinguishable from the force
    // being switched off — a control that appears to work and does nothing.
    this.gateHalfLife = Math.max(0.05, halfLife);
  }

  /**
   * Rebuild this frame's per-particle gate from `state`. Call once per frame BEFORE the force calls.
   *
   * ⚠️ **Invariant 6, verbatim: `state.lifetimes` is the ONE `GeneratorState` array `lissajous.ts` does not
   * extend to `totalCount`.** So the test is `array.length < state.count`, NOT `!array` — a truthy-but-short
   * array passes a `!array` guard and then reads `undefined` across the whole spark and crystal tail. Here
   * that would gate the tail to 0, i.e. sparks that never move: a *spark* bug to look at, not a gate bug.
   * The pad is 1 (ungated) rather than 0, because a slot the attribute says nothing about should behave as
   * it did before the feature existed.
   *
   * ⚠️ **`temperature` and `age` are absent without a live material** (`MaterialProcessor.update()` returns
   * early on `preset === 'None'`). The gate then reports itself INACTIVE rather than silently gating on
   * zeros, and the Visual FX rows disable themselves for the same reason — invariant 13.
   */
  prepareGate(state: GeneratorState): void {
    const n = state.count;
    if (this.gateSource === 'none' || this.gateAmount <= 0 || n <= 0) {
      this.gateActive = false;
      return;
    }

    // The RAW attribute per slot, before normalisation. Absent means this source is unavailable now.
    let src: Float32Array | undefined;
    if (this.gateSource === 'age') src = state.lifetimes;
    else if (this.gateSource === 'temperature') src = state.temperatures;
    else src = state.depths;
    if (!src) {
      this.gateActive = false;
      return;
    }

    if (!this.gateBuf || this.gateBuf.length < n) this.gateBuf = new Float32Array(n);
    const g = this.gateBuf;
    const amount = this.gateAmount;
    const invert = this.gateInvert;
    // ⚠️ Guards a SHORT array, not a missing one — see the note above. `min` is what makes the tail read the
    // pad instead of `undefined`.
    const m = Math.min(src.length, n);
    // `ln2 / halfLife`: `exp(-age * k)` is 0.5 exactly at `age === halfLife`.
    const ageK = Math.LN2 / this.gateHalfLife;

    for (let i = 0; i < n; i++) {
      // 1 for the untracked tail: a slot the attribute says nothing about keeps the pre-feature behaviour.
      let a01 = 1;
      if (i < m) {
        const raw = src[i]!;
        if (this.gateSource === 'age') {
          // ⚠️ **`lifetimes` is an UNBOUNDED accumulating age in seconds** and cannot be used raw — it would
          // grow past 1 within two seconds and the gate would saturate for the rest of the session. The
          // exponential maps it into (0,1] monotonically with no ceiling to hit, and its parameter is a
          // half-life, which is the unit the Return Force control already speaks in.
          a01 = Math.exp(-Math.max(0, raw) * ageK);
        } else {
          // `temperatures` and `depths` are both already normalised to [0,1] by their writers; clamped here
          // anyway because a rogue value would scale the force rather than merely mis-colour a pixel.
          a01 = raw <= 0 ? 0 : (raw >= 1 ? 1 : raw);
        }
        if (invert) a01 = 1 - a01;
      }
      // The lerp from 1, not a bare multiply: at `amount` 0 this is exactly 1 for every particle, which is
      // what makes the default byte-identical to the pre-feature behaviour at any attribute value.
      g[i] = 1 + amount * (a01 - 1);
    }
    this.gateActive = true;
  }

  /**
   * The gate buffer, or `null` when there is nothing to apply — the single read gate for both force loops.
   *
   * ⚠️ **`count` is re-checked here even though `prepareGate` sized against it.** The two see `state.count`
   * one after the other in the same frame today, but `prepareGate` is a public method and this is a
   * per-index read: a buffer shorter than the loop would read `undefined` and multiply the force by `NaN`,
   * which propagates into `positions` and drops the whole draw. Returning `null` degrades to ungated.
   */
  private gateFor(count: number): Float32Array | null {
    if (!this.gateActive || !this.gateBuf || this.gateBuf.length < count) return null;
    return this.gateBuf;
  }

  /**
   * @param frozen Optional crystal mask (v8 Phase 8a-3: 1 = this slot is a crystal). A crystal's
   *   screen position is projected from model space by `CrystalPool` using the figure's own
   *   rotation, so it is authoritative and must not be displaced by the force field. Optional so
   *   the undefined path is byte-for-byte the original behaviour.
   */
  applyForces(
    positions: Float32Array,
    count: number,
    blend: number,
    returnForce: number,
    dt: number,
    fractalFade: number,
    frozen?: Uint8Array,
  ): void {
    if (!this.active || blend <= 0 || fractalFade <= 0) return;

    if (!this.offsetX || this.offsetX.length < count) {
      const newOffX = new Float32Array(count);
      const newOffY = new Float32Array(count);
      if (this.offsetX) {
        newOffX.set(this.offsetX.subarray(0, Math.min(this.offsetX.length, count)));
        newOffY.set(this.offsetY!.subarray(0, Math.min(this.offsetY!.length, count)));
      }
      this.offsetX = newOffX;
      this.offsetY = newOffY;
    }

    // Return force decay, amplitude-stabilised — see `frameNormalisation`.
    const { retain: decayPerFrame, depositScale } = frameNormalisation(returnForce, dt);
    const effectiveBlend = blend * fractalFade;
    const forceMul = effectiveBlend * FORCE_MUL_60 * depositScale;

    const offX = this.offsetX;
    const offY = this.offsetY!;
    const gate = this.gateFor(count);

    for (let i = 0; i < count; i++) {
      // Crystal slots hold an authoritative projected position — skip entirely.
      if (frozen && frozen[i] === 1) continue;
      const baseX = positions[i * 3]!;
      const baseY = positions[i * 3 + 1]!;

      const [fx, fy] = this.sampleForce(baseX, baseY);

      // ⚠️ The gate scales the INCREMENT only, never `decayPerFrame`. That is the whole reason a gated
      // particle reads as "holding the curve": its accumulated offset keeps decaying back toward the
      // mathematical position at the full Return Force rate while it stops receiving new displacement.
      // Gating the decay too would freeze it wherever it happened to be — a stuck particle, not a held one.
      const m = gate ? forceMul * gate[i]! : forceMul;
      offX[i] = offX[i]! * decayPerFrame + fx * m;
      offY[i] = offY[i]! * decayPerFrame + fy * m;

      positions[i * 3] = baseX + offX[i]!;
      positions[i * 3 + 1] = baseY + offY[i]!;
    }
  }

  /**
   * @param frozen Optional crystal mask (v8 Phase 8a-3: 1 = this slot is a crystal). Crystals hold
   *   an authoritative projected position and must not be displaced by the IFS chaos-game force.
   *   Optional so the undefined path is byte-for-byte the original behaviour.
   */
  applyIfsForces(
    positions: Float32Array,
    count: number,
    blend: number,
    returnForce: number,
    dt: number,
    fractalFade: number,
    ifsParams: Array<{angle: number; scale: number; tx: number; ty: number; weight: number}>,
    frozen?: Uint8Array,
  ): void {
    if (blend <= 0 || fractalFade <= 0 || ifsParams.length === 0) return;

    // Ensure offset arrays exist and are sized
    if (!this.offsetX || this.offsetX.length < count) {
      const newOffX = new Float32Array(count);
      const newOffY = new Float32Array(count);
      if (this.offsetX) {
        newOffX.set(this.offsetX.subarray(0, Math.min(this.offsetX.length, count)));
        newOffY.set(this.offsetY!.subarray(0, Math.min(this.offsetY!.length, count)));
      }
      this.offsetX = newOffX;
      this.offsetY = newOffY;
    }

    // Build cumulative weight distribution
    let totalWeight = 0;
    for (let t = 0; t < ifsParams.length; t++) {
      totalWeight += ifsParams[t]!.weight;
    }
    const cumWeights: number[] = [];
    let cumSum = 0;
    for (let t = 0; t < ifsParams.length; t++) {
      cumSum += ifsParams[t]!.weight / totalWeight;
      cumWeights.push(cumSum);
    }

    // Rebuild assignments when array is missing, undersized, or transform count changed
    if (!this.transformAssignments ||
        this.transformAssignments.length < count ||
        this.lastIfsTransformCount !== ifsParams.length) {
      this.transformAssignments = new Uint8Array(count);
      this.lastIfsTransformCount = ifsParams.length;
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        let idx = 0;
        for (let t = 0; t < cumWeights.length; t++) {
          if (r <= cumWeights[t]!) { idx = t; break; }
        }
        this.transformAssignments[i] = idx;
      }
    }

    // Gradual re-roll: re-assign 1 particle per frame (spreads transitions evenly)
    this.reassignCounter++;
    if (this.reassignCounter >= 2) {
      this.reassignCounter = 0;
      const pi = Math.floor(Math.random() * count);
      const r = Math.random();
      let idx = 0;
      for (let t = 0; t < cumWeights.length; t++) {
        if (r <= cumWeights[t]!) { idx = t; break; }
      }
      this.transformAssignments![pi] = idx;
      // Zero offset on re-roll to prevent whiplash between old and new direction
      this.offsetX![pi] = 0;
      this.offsetY![pi] = 0;
    }

    // Decay and force parameters, amplitude-stabilised — see `frameNormalisation`.
    const { retain: decayPerFrame, depositScale } = frameNormalisation(returnForce, dt);
    const effectiveBlend = blend * fractalFade;
    const forceMul = effectiveBlend * FORCE_MUL_60 * depositScale;
    // Scaled by `depositScale` for the same reason as `forceMul`: this clamp bounds the per-frame
    // INCREMENT of a recurrence, so a fixed bound would pin the increment while `decayPerFrame` kept
    // varying with frame time — which is exactly what made the amplitude swing ~47 % on rAF jitter.
    // 8 px at 60 fps, unchanged.
    const maxForcePixels = 8.0 * depositScale;

    const offX = this.offsetX;
    const offY = this.offsetY!;
    const assigns = this.transformAssignments;
    const gate = this.gateFor(count);

    for (let i = 0; i < count; i++) {
      // Crystal slots hold an authoritative projected position — skip entirely.
      if (frozen && frozen[i] === 1) continue;
      const baseX = positions[i * 3]!;
      const baseY = positions[i * 3 + 1]!;

      // Subtract current offset to get the mathematical (un-displaced) position
      const mathX = baseX - offX[i]!;
      const mathY = baseY - offY[i]!;

      // Get assigned transform
      const tIdx = assigns[i]!;
      const t = ifsParams[tIdx]!;

      // Convert mathematical position to UV
      const uvX = mathX / this.width;
      const uvY = mathY / this.height;

      // Apply IFS transform
      const angleRad = t.angle * Math.PI / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      const centeredX = uvX - 0.5;
      const centeredY = uvY - 0.5;
      const mappedX = (cosA * centeredX - sinA * centeredY) * t.scale + 0.5 + t.tx;
      const mappedY = (sinA * centeredX + cosA * centeredY) * t.scale + 0.5 + t.ty;

      // Displacement in pixels, clamped to prevent teleport jitter.
      //
      // ⚠️ The gate multiplies BEFORE the clamp, deliberately: `maxForcePixels` bounds the per-frame
      // increment this recurrence actually receives, and the gate is part of that increment. Applying it
      // after the clamp would leave every strongly-driven particle pinned at 8 px and then scaled, so the
      // gate's effect would vanish exactly where the IFS force is strongest — which is where it matters.
      const gm = gate ? forceMul * gate[i]! : forceMul;
      let dx = (mappedX - uvX) * this.width * gm;
      let dy = (mappedY - uvY) * this.height * gm;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > maxForcePixels) {
        const scale = maxForcePixels / mag;
        dx *= scale;
        dy *= scale;
      }

      // Accumulate offsets
      offX[i] = offX[i]! * decayPerFrame + dx;
      offY[i] = offY[i]! * decayPerFrame + dy;

      positions[i * 3] = mathX + offX[i]!;
      positions[i * 3 + 1] = mathY + offY[i]!;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.rgbaBuffer = new Float32Array(width * height * 4);
  }

  /**
   * ⚠️ **The gate is deliberately NOT touched here.** `prepareGate()` rebuilds the whole buffer from live
   * state every frame, so clearing it would be a no-op with a misleading name — the same reasoning that
   * keeps `analyticSampler` out of this function. The gate SETTINGS are owned by `main.ts` and reset from
   * the incoming overlay on the same lines as `transMapForceBlend`.
   */
  resetOffsets(): void {
    if (this.offsetX) this.offsetX.fill(0);
    if (this.offsetY) this.offsetY.fill(0);
    this.transformAssignments = null;
  }

  dispose(): void {
    // Delete BEFORE nulling `gl` — the handle is unreachable afterwards and would leak.
    if (this.gl && this.readbackFBO) this.gl.deleteFramebuffer(this.readbackFBO);
    this.readbackFBO = null;
    // G4b — invariant 1: the async readback's buffer and fence die with the object, and their records with them.
    if (this.gl && this.packBuffer) this.gl.deleteBuffer(this.packBuffer);
    if (this.gl && this.packSync) this.gl.deleteSync(this.packSync);
    this.packBuffer = null; this.packSync = null; this.packBytes = 0; this.packW = 0; this.packH = 0;
    this.attachedTexture = null;
    this.gl = null;
    this.rgbaBuffer = null;
    this.offsetX = null;
    this.offsetY = null;
    this.transformAssignments = null;
    this.currentTexture = null;
    // ⚠️ Invariant 3 — the sampler is a CLOSURE OVER `transMap`, so leaving it installed here would leave
    // `active` true over a disposed force field, and the spark path gates on `isActive()` alone. Not cleared
    // in `resetOffsets()` by contrast: that runs on every preset change, and `main.ts` re-installs the
    // sampler each frame from `getForceModes()`, so clearing it there would be a no-op with a misleading name.
    this.analyticSampler = null;
    this.active = false;
    // ⚠️ Invariant 3 again, and the reason `gateActive` is nulled BESIDE its buffer rather than left to
    // `prepareGate`: both force loops read `gateBuf[i]` on the strength of this flag alone. A true flag over
    // a null buffer would multiply every force by `undefined` — `NaN` into `positions`, which drops the draw.
    this.gateBuf = null;
    this.gateActive = false;
  }
}
