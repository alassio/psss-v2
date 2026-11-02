import { compileProgram } from '../core/gl-program.ts';
import type { GeneratorState } from '../core/interfaces.ts';

/**
 * Narrowest band worth fitting, in TEXTURE units. Below this the figure is planar for practical purposes and
 * the fit falls back to the raw `0…1`. 0.02 is the threshold the library measurement used: it separates the
 * **22 flat presets** from the **93 narrow-but-fittable** ones, whose median span is 0.331.
 *
 * ⚠️ **It is a RAMP, not a cliff — see `resolveDepthBand`.** As a hard switch it was a reported defect.
 */
export const MIN_BAND = 0.02;

/**
 * Time constant of the band's temporal smoothing, in SECONDS. See `smoothDepthBand`.
 *
 * ⚠️ **Chosen by measuring the OUTPUT in pixels, not by taste.** Worst single-frame warp snap over all 177
 * presets × 5 s, with the soft floor in place: **τ=0 → 37.1 px**, 0.10 → 7.56, 0.15 → 3.12, **0.25 → 1.95**,
 * 0.40 → 1.21. 0.25 s is where the worst case crosses below ~2 px (p99 **0.197 px**) without paying more lag
 * than that buys — 0.40 s halves the residue again for a visibly laggier fit.
 */
export const BAND_TAU_SECONDS = 0.25;

/**
 * ⚠️ **The percentile band, as a PURE function of a histogram — extracted so `fieldcheck` §N can MEASURE it
 * rather than grep for it.** Three of its four behaviours are silent when wrong and none is visible in a frame:
 * min/max instead of percentiles (the fit becomes the identity on the 7 presets with outlying strands), an
 * empty population (a division by a zero span), and a degenerate span (float noise amplified frame-wide).
 *
 * `counted` is the population the histogram was built from — the **visible** particles, never the array length.
 * See the trap comment at `render()`'s fill loop for why that distinction is the whole feature.
 *
 * ## ⚠️ THE `minBand` FALLBACK IS A RAMP, AND AS A CLIFF IT WAS A REPORTED DEFECT
 *
 * Reported as *"jitter every few seconds while the figure is moving, like small contractions"*. The original
 * form was `if (span < minBand) return [0, 1]` — a **hard switch**, and a rotating figure's span DRIFTS ACROSS
 * that threshold, so every crossing swapped the consumer's scale between 1.0 and up to 42.5 **in one frame**:
 * the whole warp field snapping between no parallax and maximum parallax, which reads as the figure contracting.
 * **41 of the 177 presets cross the threshold within 10 s** (`Quasar` 15 times, `Dual Spiral Wind`/`Dual System`/
 * `Hell Razer` 12 each), and `Sphere` — the preset it was reported on — sits astride it, spending 202 of 420
 * frames on the fallback side. Measured worst single-frame snap on `Sphere`: **43.2 px, with a p95 of 0.00 px**,
 * i.e. not a shimmer but a rare discrete event, exactly as described.
 *
 * ⚠️ **THAT RUN'S BASIS IS THE LEGACY JSON BODIES, AND THREE OF THE FIVE NAMES ABOVE NO LONGER SHIP ONE.**
 * `public/psss_presets.json` is read-only, so the *population* of 177 is frozen and the 41 is not stale — but
 * the refined-preset review has since SETTLED `Sphere`, `Dual Spiral Wind` and `Dual System` (measured
 * 2026-09-12; `Quasar` and `Hell Razer` are still pending pairs and do still ship their legacy bodies), and a
 * settled entry replaces the legacy body in place under the same name (`refined-presets.ts`). All three now
 * carry a different wave table, `rotation` [0,0,0] → [0,0,0.5] (`Sphere`: [0.5,0.5,0.5]) and `particleCount`
 * 500 → 20000. So **reproducing this run by selecting those presets in the UI measures different figures and
 * may not cross the threshold at all** — re-derive over the legacy bodies (via `MigrationLayer.migrate`, as
 * the run did), and read the names as identifiers of legacy FIGURES, not of whatever currently ships under
 * them. The `Sphere` row is the one that matters, since it is the preset the defect was REPORTED on.
 *
 * So the fitted band is now **blended toward the raw `0…1` over `[minBand, 2·minBand]`** rather than switched at
 * `minBand`. Both endpoints of the old behaviour are preserved exactly: at `span ≥ 2·minBand` the fit is
 * untouched, and at `span ≤ minBand` it is the full raw scale. ⚠️ **The ramp alone is NOT the fix** — it cuts
 * the worst snap only 43.2 → 37.1 px, because the `1/span` amplification below is the larger term. It earns its
 * place *under* the smoothing, where it improves p99 fourfold (0.793 → 0.197 px). Both halves are needed.
 *
 * @returns `[lo, hi]` in texture units (0 = far, 1 = near), or `[0, 1]` when there is nothing to fit — which the
 *   consumer then remaps as `(t − 0)/1 = t`, i.e. exactly `'canvas'`, with no branch of its own.
 */
export function resolveDepthBand(hist: Int32Array, counted: number, minBand: number): [number, number] {
  if (!(counted > 0)) return [0, 1];
  const bins = hist.length;
  if (bins < 2) return [0, 1];
  // 2nd and 98th percentile by cumulative count. One walk from each end — no sort, so no allocation.
  const tail = counted * 0.02;
  let acc = 0;
  let loBin = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b]!;
    if (acc >= tail) { loBin = b; break; }
  }
  acc = 0;
  let hiBin = bins - 1;
  for (let b = bins - 1; b >= 0; b--) {
    acc += hist[b]!;
    if (acc >= tail) { hiBin = b; break; }
  }
  const scale = 1 / (bins - 1);
  const lo = loBin * scale;
  const hi = hiBin * scale;
  // ⚠️ `!(span >= …)` rather than `<`, so a NaN span takes the fallback instead of passing the test.
  const span = hi - lo;
  if (!(span > minBand)) return [0, 1];
  if (span >= minBand * 2) return [lo, hi];
  // The ramp. `w` goes 0 -> 1 across [minBand, 2*minBand]; at w=0 this is exactly [0, 1] and at w=1 exactly
  // [lo, hi], so neither endpoint of the pre-ramp behaviour moves.
  const w = (span - minBand) / minBand;
  return [lo * w, hi * w + (1 - w)];
}

/**
 * One exponential step of the band toward its newly measured value, as a PURE function — so `fieldcheck` §N can
 * measure the thing that actually reaches the shader rather than the thing that was measured off it.
 *
 * ## ⚠️ WHY THIS EXISTS, AND WHY ITS ABSENCE WAS JUSTIFIED BY THE WRONG MEASUREMENT
 *
 * 14.7b originally shipped with **no** smoothing, and the stated basis was that the BAND's own per-frame jitter
 * is only 0.0014 — two orders below visible. That number was right and the conclusion did not follow: **the
 * shader does not consume the band, it consumes `1/(hi − lo)`**, and `d(1/s)/ds = −1/s²`. On a narrow band that
 * derivative is large, so a band wobble of 0.008 becomes a **Δscale of 0.37 per frame** on `Aurora Borealis`
 * (span ≈ 0.14, scale ≈ 7). Measured warp snap before smoothing: `Aurora Borealis` 4.3 px worst / 2.53 p95 with
 * **173 of 599 frames** jumping over 2 px, `Black Hole` 10.1 / 5.38 with 276 of 599.
 *
 * ⚠️ **This is invariant 10 in its purest form — the plausibility of the measurement was checked instead of the
 * UNITS OF THE RESULT.** Any future "is smoothing needed here" question about this band must be answered in
 * PIXELS OF WARP DISPLACEMENT at the consumer, never in band units.
 *
 * ## ⚠️ NO MAGNITUDE-BASED SNAP DETECTION — it was tried and it is unsound
 *
 * The obvious companion is "reset instantly if the band jumps more than X, so a preset change does not glide".
 * **Measured, that threshold cannot exist**: the largest *legitimate* per-frame band delta from ordinary motion
 * is **0.19** (`Blue Spiralo`, over all 177 presets), which is as large as a genuine discontinuity. A threshold
 * above it never fires; below it fires on fast rotation. So discontinuities are handled by an explicit
 * `resetBand()` at the sites that KNOW one happened (preset change, resize) — a fact the caller has and the
 * signal does not. This is the same shape as invariant 21's "a boolean scan cannot see a ramp".
 *
 * @param dtSeconds frame delta. Framerate-independent by construction: `1 − exp(−dt/τ)` gives the same decay per
 *   unit TIME at 30, 60 or 144 fps, which a bare `0.1` lerp would not (invariant 10 again — a per-frame constant
 *   is not a per-second one). Clamped, so a tab returning from background cannot produce `α > 1` and overshoot.
 */
export function smoothDepthBand(
  prev: readonly [number, number],
  next: readonly [number, number],
  dtSeconds: number,
  tauSeconds: number,
): [number, number] {
  if (!(tauSeconds > 0) || !(dtSeconds > 0)) return [next[0], next[1]];
  const a = Math.min(1 - Math.exp(-dtSeconds / tauSeconds), 1);
  return [prev[0] + a * (next[0] - prev[0]), prev[1] + a * (next[1] - prev[1])];
}

/**
 * Per-pixel DEPTH of the figure — the input channel TransMap style 11 (Depth Parallax) reads, and the
 * only thing in the engine that tells the post chain how far away anything is (v8 Step 14.7 / E81).
 *
 * ## ⚠️ Why this is a SEPARATE PASS and not the MRT the plan specified
 *
 * The spec's design was a second attachment on the trail FBO plus a depth write in **all three** renderers
 * (`hdr-particle.ts`, ribbon, neon). That premise was re-derived rather than taken, per the working method,
 * and the MRT is the worse of the two:
 *
 * - **The trail FBO is a PING-PONG pair, and its contents ACCUMULATE.** Depth must not: it describes THIS
 *   frame's geometry, so it has to be cleared every frame while RGBA must not be. On one FBO with two
 *   attachments there is no per-attachment clear without either a `drawBuffers` mask dance around every
 *   draw in the frame or `clearBufferfv` on attachment 1 alone — and the decay blit, the physarum overlay,
 *   the crystal pass and the warp all write that FBO too. Every one of them would need a correct
 *   `drawBuffers` state or it would scribble garbage into depth. That is five write sites, invariant 6's
 *   shape ("two passes sharing a target must both handle every attachment"), against one here.
 * - **It would touch all three renderers and the crystal pass** — four shader pairs, each needing a second
 *   `out` and each a chance to leak a `drawBuffers` state. This module is ~200 lines that no renderer knows
 *   about, and the renderers stay byte-identical, which is what keeps invariants 1/2/3/6 off them entirely.
 * - **It costs nothing extra to allocate.** `R16F` at 1080p is 4 MB either way. The extra cost is one draw
 *   of `state.count` point sprites, and it is paid ONLY when a style-11 layer is live with `amount > 0`
 *   (`TranslationMapProcessor.needsDepth()`), i.e. on **1 of 359 shipped presets** — `Sphere II` (2026-08-28),
 *   which carries an enabled style-11 layer at `amount 1`, `Near 0.2 / Far 2.0`, manual range 0.3–0.7.
 *   ⚠️ **This read 0 of 364 for the whole of Phase 14 and is now stale in that direction**: there IS a shipped
 *   preset exercising this pass, so judge a change to it there rather than assuming nothing can regress.
 *
 * What the separate pass gives up is exactness: it re-splats the particles as discs rather than reusing
 * each renderer's own shape, so a ribbon's depth is the depth of the vertices along it rather than of the
 * swept quad. For a parallax MULTIPLIER on a smooth displacement field that is the right trade — the field
 * is smooth over tens of texels and the depth only has to be right to within a strand's width. If a future
 * step needs per-fragment-exact depth (`12.1`/`E56` fog would), that is the point to revisit this, and the
 * consumer interface (`getTexture()`) does not change.
 *
 * ## ⚠️ THE TWO CONVENTIONS ARE OPPOSITE, and this pass is where they meet
 *
 * Neither direction is checkable by `tsc`, both were MEASURED rather than read off a comment, and the
 * plan's own GLSL sketch has the texture one **backwards** (`// 0 = near, 1 = far`) — so the source to
 * trust is the built shader, not the spec:
 *
 * | quantity | 0 means | 1 means | how it was established |
 * |---|---|---|---|
 * | `state.depths[i]` (the SOURCE) | **near** | **far** | `(z − perspZ) / (−perspZ·2)` at `perspZ = −1500`: a particle at `z = −1400` (100 in front of the camera) evaluates to **0.033**, mid-scene to 0.5, `z = +1400` to **0.967**. Corroborated by every renderer's `size *= 1 + uDepthSize * (1 − aDepth)`, which makes LOW values BIG. |
 * | `uDepth` texel (the CONSUMER) | **far** | **near** | the warp computes `mix(uParallaxFar, uParallaxNear, depth)`, so 1 selects NEAR. Corroborated by the 1×1 fallback: it reads 0 and its own comment says that yields `uParallaxFar` uniformly. |
 *
 * So this pass writes **`1 − depths[i]`**, inverting once, in the vertex shader. Getting it backwards
 * would make FAR strands sweep and near ones hold — a plausible-looking effect, not a visible fault, which
 * is why the numbers above are recorded rather than the reasoning.
 *
 * Two consequences follow from "1 = near" and both would be wrong under the opposite reading:
 *
 * - **The clear value is `0` (FAR).** Empty space must read as maximally distant so the background's
 *   multiplier is `uParallaxFar`. Clearing to 1 would put the whole background at the front of the scene,
 *   and since the warp samples depth at the DESTINATION uv, that drags near-field parallax frame-wide.
 * - **Overlapping strands resolve with `MAX`, not `MIN`.** The nearest surface is the LARGEST texel, so
 *   `MAX` is what an opaque figure does. `MIN` would let the farthest strand win every overlap — i.e. the
 *   figure would take its depth from whatever is hidden behind it.
 *
 * ## ⚠️ THE DYNAMIC RANGE IS SET BY THE CANVAS, NOT BY THE FIGURE — so most presets occupy a narrow band
 *
 * `depths[i] = (z − perspZ) / (−perspZ·2)` with `perspZ = −(canvasW + canvasH)/2`, so the denominator is
 * `canvasW + canvasH` while the numerator is the figure's own projected z-extent. **The two are unrelated**,
 * and the consequence is that a legacy figure — authored in a 75×100-ish design box against a legacy Canvas
 * 2D renderer that had no depth channel at all — lands in a thin slice around 0.5 rather than spanning the
 * texture. Nothing here is wrong; it is what the normalisation means, and `state.depths` is shared with the
 * renderers' `size *= 1 + uDepthSize*(1 − aDepth)`, so the scale is not this pass's to change.
 *
 * Measured at 1000×800 (`depthRange` 1800), simulating the generator and this pass's `MAX` splat:
 *
 * | preset | z-extent px | figure texels p5/med/p95 | span |
 * |---|---|---|---|
 * | `Aurora Borealis` | 626 | 0.43 / 0.54 / 0.63 | **0.20** |
 * | `Milky Way` | — | 0.43 / 0.65 / 0.69 | 0.26 |
 * | `Star`, `Voyager` | — | 0.24 / 0.58 / 0.79 | 0.54 |
 * | `Black Hole` (refined) | — | 0.09 / 0.54 / 0.75 | **0.66** |
 * | `The Real Black Hole` | — | 0.07 / 0.51 / 0.87 | 0.80 |
 *
 * Across all 177 legacy presets, taking each one's WIDEST span over t ∈ {0, 5, 20, 60, 120} s: median
 * **0.304**, 71 above 0.4, and **22 flat at every sampled t**. ⚠️ **At the INITIAL pose alone the flat count
 * is 112 of 177** — a figure with zero model-z and no `Angle` tilt is exactly planar, and it is `Rotation`
 * that tilts it into depth over the following seconds. So CLAUDE.md's standing *"`depth` collapses to exactly
 * 0.5 on a flat legacy figure"* is a statement about the POSE, not about the preset: 90 of those 112 acquire
 * real depth as they turn, and reading a span at t=0 undercounts the library by a factor of five.
 *
 * ⚠️ **Two consequences for judging style 11, and the first is what a user reports as "everything looks far".**
 * (1) The EMPTY BACKGROUND is the only thing in the frame at texel 0, and it is the MAJORITY of the frame —
 * `Aurora Borealis` covers 22 % of the pixels at t = 20 s. So at `Near 0.5 / Far 2.0` its figure spans ×1.06 to
 * ×1.36 — a 1.3× ratio end to end — while the background sits at ×2.00 and is therefore the most strongly
 * warped region on screen. The reading "everything is far" is accurate about the *frame* and wrong only about
 * the *figure*, which is uniformly MID. (2) A narrow span is not fixable by widening `Near`/`Far`: those scale
 * the whole mapped interval, so the figure-internal contrast stays proportional to the span. **Pick a preset by
 * its z-extent, not by its looks** — `Black Hole` and `The Real Black Hole` have 3× the span and already carry
 * `TransMapFilter: true`.
 *
 * ## ⚠️ Culled slots must not write depth
 *
 * `CULL_SENTINEL` (−10000) parks a particle behind the camera far outside the viewport, and `depths` is
 * still computed for it (see `projection.ts`) — so the value is real but the geometry is not. Off-viewport
 * fragments are discarded by clipping anyway, which covers it for free; the vertex shader nonetheless
 * pushes such slots outside clip space explicitly rather than relying on the sentinel's magnitude, because
 * that magnitude is documented as load-bearing-by-accident and a future 8K canvas would erode its margin.
 *
 * ## Blending
 *
 * ⚠️ `blendEquation` is GLOBAL GL state and the fade pass asserts `FUNC_ADD` for exactly this reason
 * (`blendcheck`), so this pass restores it before returning. A leaked equation is one of the five defects
 * that passed `tsc` **and** `vite build` and appeared only in a browser, and it would not present here — it
 * would present as the trail fade misbehaving somewhere else entirely.
 */
export class DepthFieldPass {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private depthBuffer: WebGLBuffer | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  private width = 0;
  private height = 0;
  /**
   * Set when the FBO came back incomplete (invariant 5). Latched so the failure is logged ONCE rather than
   * per frame, and cleared by `resize()`/`init()` so a later size retries — a driver that refuses `R16F` at
   * 4K may well accept it at 1080p.
   */
  private failed = false;

  private uResolution: WebGLUniformLocation | null = null;
  private uPointSize: WebGLUniformLocation | null = null;

  /** Scratch for the depth attribute, so `render()` allocates nothing per frame (invariant 8). */
  private depthScratch = new Float32Array(0);

  /**
   * Histogram resolution for the band measurement. 256 bins over 0…1 gives a quantisation of 0.004, an order
   * below the 0.02 degenerate-band threshold and two below the smallest span worth fitting.
   */
  private static readonly BAND_BINS = 256;
  /**
   * ⚠️ **PERCENTILES, NOT MIN/MAX — and a histogram rather than a sort, because a sort would allocate.**
   * Measured over 175 presets, min/max inflates the band by up to **0.35** (`Flight Through Milky Way`) and
   * 0.31 (`Black Hole`) against p2…p98, from a handful of outlying strands. Median inflation is only 0.008, so
   * it bites on **7 of 175** — the shape of defect that survives a browser pass on whichever preset was tested
   * and shows up later as "auto-fit does nothing on this one".
   */
  private readonly bandHist = new Int32Array(DepthFieldPass.BAND_BINS);
  /**
   * Last resolved band, in TEXTURE units (0 = far, 1 = near). Degenerate/empty resolves to the raw 0…1.
   * ⚠️ **SMOOTHED, not this frame's measurement** — see `smoothDepthBand` for why, and `getBand()`.
   */
  private bandLo = 0;
  private bandHi = 1;
  /**
   * False until the first measurement after a `resetBand()`, which is taken WHOLE rather than glided into.
   *
   * ⚠️ **Without this, every preset change would visibly slide its parallax into place over a quarter second** —
   * the EMA cannot tell a discontinuity from fast motion (a magnitude threshold was measured and rejected; see
   * `smoothDepthBand`), so the callers that KNOW one happened say so explicitly.
   */
  private bandPrimed = false;
  /** Scratch for the 2D positions, ditto. `state.positions` is stride 3 and this pass wants stride 2. */
  private posScratch = new Float32Array(0);

  init(gl: WebGL2RenderingContext, width: number, height: number): void {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.failed = false;
    // ⚠️ The `label` is load-bearing: a shader that fails to compile still links, still binds, and every draw
    // succeeds as a NO-OP, so without it nothing says which of 34 shaders failed.
    this.program = compileProgram(gl, VERT, FRAG, 'Depth field (TransMap style 11)');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uPointSize = gl.getUniformLocation(this.program, 'uPointSize');
    this.createTarget(gl, width, height);
    this.createVao(gl);
  }

  /**
   * Splat this frame's particles into the depth target. Call BEFORE the warp reads it.
   *
   * @param pointSize disc diameter in pixels. Wider than the particles themselves on purpose: depth is a
   *   modulation field, and a gap between splats would read as background (far) INSIDE the figure, giving
   *   a near strand a far multiplier in the holes. Over-covering costs nothing — `MAX` keeps the nearest.
   * @param dtSeconds real frame delta, for the band's temporal smoothing. ⚠️ **Must be the REAL delta, not a
   *   nominal 1/60** — the smoothing is specified in seconds precisely so it behaves the same at any frame rate,
   *   and a hardcoded constant would silently turn τ into a per-frame quantity (invariant 10).
   */
  render(state: GeneratorState, pointSize: number, dtSeconds: number): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.fbo || this.failed) return;
    // ⚠️ `state.count` is the ONLY trustworthy length (invariant 7) — `getState()` publishes grow-only reused
    // scratch, so `.length` overstates it.
    const n = state.count;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    // FAR everywhere first. ⚠️ FAR is **0** in the texture's convention, not 1 — the warp reads
    // `mix(uParallaxFar, uParallaxNear, depth)`. See the class header's table.
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return;
    }

    if (this.depthScratch.length < n) {
      this.depthScratch = new Float32Array(n);
      this.posScratch = new Float32Array(n * 2);
    }
    const d = this.depthScratch;
    const p = this.posScratch;
    // ⚠️ Invariant 6's pad question, answered by LENGTH rather than truthiness: `state.depths` is extended to
    // `totalCount` by the generator (unlike `lifetimes`), but a short array here would silently write
    // `undefined -> NaN` across the tail, and a NaN in `gl_Position` discards the whole point.
    // ⚠️ The pad value is **1.0 in the SOURCE convention** (= far), which the shader inverts to 0 = far in the
    // texture. `0` here would pad to NEAR and give every unwritten slot maximum parallax — the pad's units are
    // the generator's, not the target's (invariant 10: check the units of the RESULT). The positions put those
    // slots off screen anyway; the value is belt-and-braces for the day something moves them back on.
    const src = state.depths;
    const have = Math.min(src.length, n);
    // The band histogram is rebuilt from scratch every frame, in the SAME loop that fills the scratch arrays
    // (invariant 8: no per-frame allocation, and no second pass over 32 000 particles either).
    const hist = this.bandHist;
    hist.fill(0);
    let counted = 0;
    const margin = pointSize;
    for (let i = 0; i < have; i++) {
      const px = state.positions[i * 3]!;
      const py = state.positions[i * 3 + 1]!;
      p[i * 2] = px;
      p[i * 2 + 1] = py;
      const dv = src[i]!;
      d[i] = dv;
      // ⚠️ **THE BAND MUST BE MEASURED OVER THE SLOTS THAT ACTUALLY SPLAT, AND THIS IS THE TRAP THAT WOULD
      // SILENTLY NEUTER AUTO-FIT.** `depths` is computed for culled particles too (`projection.ts` parks them
      // at `CULL_SENTINEL` but still writes a depth), and a particle behind the camera CLAMPS to exactly 0 or
      // 1 — so a naive min/max over the whole array returns 0…1 and the fit becomes the identity. Measured at
      // 1000×800: `Sphere`, `Black Hole`, `Star`, `Milky Way` and most others have **38–48 % of their slots
      // culled**, and every one of them reports a full 0…1 band that way while the VISIBLE population spans
      // 0.00…0.50 (`Star`) or 0.00…0.82 (`Black Hole`). It fails GREEN — `verify` passes, no frame is wrong,
      // the feature just does nothing — which is invariant 13's shape reached through a sampling population.
      if (px > -margin && py > -margin && px < this.width + margin && py < this.height + margin
        && Number.isFinite(dv)) {
        // Texture convention (0 = far, 1 = near), so the band is in the units the shader consumes.
        const t = 1 - (dv < 0 ? 0 : dv > 1 ? 1 : dv);
        const bin = (t * (DepthFieldPass.BAND_BINS - 1)) | 0;
        hist[bin]! += 1;
        counted++;
      }
    }
    for (let i = have; i < n; i++) {
      p[i * 2] = -1e5;
      p[i * 2 + 1] = -1e5;
      d[i] = 1;
    }
    this.resolveBand(counted, dtSeconds);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, p.subarray(0, n * 2), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n), gl.DYNAMIC_DRAW);

    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uPointSize, pointSize);

    // ⚠️ **MAX**, not MIN: the texture's convention is 1 = near, so the LARGEST texel is the nearest surface,
    // which is what an opaque figure does. MIN would let whatever is hidden BEHIND a strand win every overlap.
    // ⚠️ Restored to FUNC_ADD immediately — `blendEquation` is global state the fade pass asserts.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** `null` when the target could not be created — the consumer must bind its own fallback (invariant 4). */
  getTexture(): WebGLTexture | null {
    return this.failed ? null : this.texture;
  }

  /**
   * The figure's own depth band this frame, in TEXTURE units (0 = far, 1 = near), for `depthRange: 'figure'`.
   *
   * ⚠️ **Returns the RAW `0…1` when there is nothing to fit** — an empty visible population, or a band narrower
   * than `MIN_BAND` (see `resolveDepthBand`). **Falling back is not clamping**: 22 of the 177 legacy presets are flat at
   * every pose (a zero-model-z figure with no `Angle` tilt is exactly planar), so dividing by the span would
   * turn a 1e-9 band into a frame-wide sign flip driven by float noise. The consumer then computes
   * `(t − lo)/(hi − lo)` = `t`, i.e. exactly the `'canvas'` behaviour, with no branch of its own.
   *
   * ⚠️ **TEMPORALLY SMOOTHED (τ = `BAND_TAU_SECONDS`), and the ABSENCE of smoothing was a reported defect** —
   * *"jitter every few seconds while the figure is moving, like small contractions"*. The original claim here was
   * "no temporal smoothing, and that was MEASURED": max per-frame BAND jitter is 0.0014, two orders below
   * visible. **That measurement was of the wrong quantity.** The consumer divides by the span, so it sees
   * `1/(hi − lo)`, whose sensitivity is `1/s²` — on a narrow band the same 0.0014 becomes a Δ of 0.37 in the
   * multiplier the warp is scaled by. See `smoothDepthBand` for the pixel figures and for why no magnitude-based
   * snap detector is possible; see `resolveDepthBand` for the second, discrete half of the same report.
   *
   * ⚠️ **The lag is real and is the property `Manual From/To` exists to avoid**: after a fast pose change the fit
   * trails the figure by ~τ. At library rotation rates that is invisible, but a future faster generator would
   * make it visible before it made the jitter visible again — reduce τ then, do not remove it.
   */
  getBand(): { lo: number; hi: number } {
    return { lo: this.bandLo, hi: this.bandHi };
  }

  /**
   * Take the next band WHOLE rather than gliding into it. Call from every site that knows the depth distribution
   * just changed discontinuously — preset change and resize.
   *
   * ⚠️ **This is not an optimisation, and it cannot be inferred from the signal.** Measured over all 177 presets,
   * a legitimate per-frame band delta from ordinary motion reaches **0.19**, which is as large as any genuine
   * discontinuity — so a magnitude threshold either never fires or fires on fast rotation. The knowledge lives
   * with the caller. ⚠️ **A new caller of `applyPresetChange`-like scope must call this**, or the first quarter
   * second of the new preset warps with the old preset's band.
   */
  resetBand(): void {
    this.bandPrimed = false;
  }

  /**
   * Collapse this frame's histogram into a p2…p98 band, then ease the live band toward it. Called from `render()`
   * only, once per frame.
   *
   * `counted` is the VISIBLE population — see the trap comment at the fill loop for why it is not `n`.
   */
  private resolveBand(counted: number, dtSeconds: number): void {
    const measured = resolveDepthBand(this.bandHist, counted, MIN_BAND);
    // ⚠️ Smoothing runs on BOTH endpoints and on the fallback too. Easing only the fitted case would leave the
    // fallback transition — the very discontinuity `resolveDepthBand`'s ramp softens — as a one-frame jump again.
    const band = this.bandPrimed
      ? smoothDepthBand([this.bandLo, this.bandHi], measured, dtSeconds, BAND_TAU_SECONDS)
      : measured;
    this.bandPrimed = true;
    this.bandLo = band[0]!;
    this.bandHi = band[1]!;
  }

  resize(width: number, height: number): void {
    const gl = this.gl;
    if (!gl) return;
    this.width = width;
    this.height = height;
    this.releaseTarget(gl);
    // Cleared so a size that failed once does not condemn every later size.
    this.failed = false;
    this.createTarget(gl, width, height);
    // ⚠️ A resize changes `perspZ = −(w+h)/2`, which is the band's own DENOMINATOR — so the whole distribution
    // shifts in one frame. Gliding through that is the jitter, at full amplitude.
    this.resetBand();
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.depthBuffer) gl.deleteBuffer(this.depthBuffer);
    this.releaseTarget(gl);
    // ⚠️ Invariant 1: every deleted handle is also NULLED. `init()` may not reassign one, and a handle left
    // pointing at a deleted object is the use-after-dispose that once handed the force field a freed texture.
    this.program = null;
    this.vao = null;
    this.posBuffer = null;
    this.depthBuffer = null;
    this.uResolution = null;
    this.uPointSize = null;
    this.gl = null;
  }

  private releaseTarget(gl: WebGL2RenderingContext): void {
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.texture) gl.deleteTexture(this.texture);
    this.fbo = null;
    this.texture = null;
  }

  private createTarget(gl: WebGL2RenderingContext, w: number, h: number): void {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.HALF_FLOAT, null);
    // LINEAR: the warp samples this at a warped UV, and nearest-neighbour would step the parallax
    // multiplier texel by texel, which shows up as stair-stepping along a strand's edge.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    // ⚠️ Invariant 5: TEST it. An incomplete FBO throws nothing and logs nothing — every draw into it is
    // silently dropped, and here that would mean depth reads as whatever the texture was created with while
    // `getTexture()` kept handing out a live-looking handle. `R16F` as a COLOUR ATTACHMENT is exactly the
    // case a driver may refuse (it is renderable only with `EXT_color_buffer_float`), so this is not
    // theoretical.
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(`[DepthField] R16F target incomplete (0x${status.toString(16)}) — style 11 disabled`);
      this.failed = true;
      this.releaseTarget(gl);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private createVao(gl: WebGL2RenderingContext): void {
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.depthBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}

// ⚠️ Attribute LOCATIONS are pinned with `layout(location=)` rather than queried, because this VAO is built in
// `createVao()` against the numbers 0 and 1 — a linker free to assign them differently would silently feed
// depth into position. `vaocheck` polices the shared-VAO case; this program owns its VAO outright, so the
// pinning is what makes that ownership safe.
const VERT = `#version 300 es
layout(location = 0) in vec2 aPosition;   // screen pixels, as every renderer receives them
layout(location = 1) in float aDepth;     // GENERATOR convention: 0 = NEAR, 1 = FAR
uniform vec2 uResolution;
uniform float uPointSize;
out float vDepth;
void main() {
  // INVERTED here, ONCE, because the two conventions are opposite: the warp reads this texture as
  // mix(uParallaxFar, uParallaxNear, depth), i.e. 1 = near. Doing it in the fragment shader instead would be
  // equivalent; doing it in BOTH, or in neither, produces a plausible-looking inverted effect rather than a
  // visible fault — hence the measured table in the class header. (No backticks in here: invariant 18.)
  vDepth = 1.0 - clamp(aDepth, 0.0, 1.0);
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  // A culled slot (CULL_SENTINEL, far outside the viewport) is pushed out of clip space EXPLICITLY rather
  // than relying on the sentinel's magnitude clearing the viewport — see the class header.
  if (abs(ndc.x) > 4.0 || abs(ndc.y) > 4.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);   // z > w: clipped
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = uPointSize;
}`;

const FRAG = `#version 300 es
precision highp float;
in float vDepth;
out vec4 fragColor;
void main() {
  // A round disc, not the square point sprite: a square splat leaves axis-aligned depth steps that the warp
  // then samples, and those read as blocky artefacts along a strand rather than as a soft field.
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  if (dot(pc, pc) > 1.0) discard;
  // ⚠️ Only .r is read (R16F), but write all four: an R16F attachment ignores gba, while a driver that gave
  // us RGBA instead (a fallback path, or a future format change) would leave them undefined.
  fragColor = vec4(vDepth, vDepth, vDepth, 1.0);
}`;
