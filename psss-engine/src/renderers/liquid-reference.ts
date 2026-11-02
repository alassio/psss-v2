/**
 * v8 Step 15.1b — the density REFERENCE that `Iso Level` is a multiple of, and its temporal smoothing.
 *
 * ## The defect this file exists to fix
 *
 * 15.1 shipped `uIsoRef = isoLevel · max(dMean, 1e-3)` with `dMean = N·πR²/(4·W·H)`, the mean density over
 * the WHOLE FRAME. That gives perfect count independence (measured coverage spread **0.07 %** at N =
 * 2 000 → 20 000, against 38.9 % for an absolute threshold) and it is still the fallback below — but it is
 * the wrong reference for a **figure**, and the failure is one of CONSISTENCY rather than of magnitude.
 *
 * ⚠️ **A LISSAJOUS FIGURE IS A 1-D LOCUS, SO THE FRAME MEAN IS NOT A PROPERTY OF THE THING BEING
 * THRESHOLDED.** The figure occupies 1–19 % of the frame, and the ratio between the density ON the curve
 * and the mean OVER the frame is therefore roughly the reciprocal of that footprint — a per-preset number
 * spanning two orders of magnitude. Measured on 15 figures at 1280×960, the `isoLevel` at which the surface
 * is half eroded:
 *
 * | preset | spacing (px) | half-erosion `isoLevel`, frame-mean | with THIS reference |
 * |---|---|---|---|
 * | `Star` | 237.91 | 0.76 | 1.35 |
 * | `Milky Way` | 325.46 | 0.87 | 1.46 |
 * | `Black Hole` | 259.91 | 1.87 | 3.29 |
 * | `Quader` | 1.18 | 6.50 | 1.25 |
 * | `Aurora Borealis` | 1.49 | 7.46 | 1.35 |
 * | `Cylinder` / `Pipes` / `Waves` / `Rose` / `Barrock` / `Diffusion` / `Stripes` / `Pulse Color` | 0.02–0.81 | **16 (never halves)** | 0.71–3.03 |
 *
 * **21× spread → 4.9×, geometric mean 1.30.** So under the shipped reference one authored Iso Level could
 * not mean one look: on a dense curve the whole track was "solid", on a dot cloud the whole track was
 * "eroded", and WHICH half of the handle was dead depended on the preset. Reported as *"only very low levels
 * of Iso Level make sense, with larger values most of the figure doesn't even draw any more"*.
 *
 * ## The reference: density ON the curve
 *
 * For particles spaced `s` apart along a curve, the Wyvill kernel `(1−r²)³` summed at a point on the curve
 * is the line integral of the kernel divided by the spacing. `∫(1−(x/R)²)³ dx` over `[−R, R]` is `32R/35`,
 * so
 *
 *     d_line = (32/35) · R / s
 *
 * ⚠️ **`s` IS MEASURED, NOT ASSUMED — it is the mean distance between CONSECUTIVE INDICES**, which is what
 * makes this count-independent by construction: `s ∝ 1/N` at fixed curve length, so `d_line ∝ N`, exactly as
 * `dMean` does. Measured count spread at N = 2 000 → 30 000 is **12.3 %**, BETTER than the frame mean's
 * 17.3 %, so the property 15.1 was built around is preserved rather than traded away.
 *
 * ⚠️ **`max(d_line, dMean)` — THE FRAME MEAN IS A LOWER BOUND AND IS NOT VESTIGIAL.** Where there is no
 * curve, `d_line` is meaningless: `Sphere` measures 1119 px of consecutive-index spacing, `Milky Way` 325,
 * `Star` 238 — these are isolated dot clouds where consecutive particles are unrelated, and `R/s` collapses
 * toward zero, which would drive the threshold to zero and flood the frame. The frame mean degrades
 * gracefully there because it is a population statistic and needs no adjacency. Taking the larger of the two
 * lets each reference own the regime it is right about.
 *
 * ⚠️ **`CALIBRATION` FOLDS "isoLevel 1.0 = the typical half-eroded surface" INTO THE REFERENCE**, so the
 * track can be centred on the value that matters. It is the measured geometric-median half-erosion point in
 * on-curve units (0.567), not a fitted fudge: with it, the useful part of the track spans both sides of 1.0
 * on every figure measured.
 */

import { CULL_SENTINEL } from '../core/projection.ts';

/**
 * `∫(1−(x/R)²)³ dx` over the kernel's support, in units of `R` — so the on-curve density is `LINE_INTEGRAL ·
 * R / spacing`. ⚠️ **It is 32/35 because the kernel is WYVILL, and a Gaussian would give a different
 * constant with no compact support to integrate over** — the same reason `πR²/4` is exact for the frame mean.
 * Changing the kernel invalidates BOTH constants, which is why they are documented together.
 */
export const LINE_INTEGRAL = 32 / 35;

/**
 * Folds "Iso Level 1.0 is the typical half-eroded surface" into the reference, so the track's own identity
 * value is the useful one. The measured geometric median of the half-erosion point over 15 figures, in
 * on-curve units. ⚠️ **Changing it RE-AUTHORS every liquid preset** — it is a multiplier on the threshold,
 * so it slides every authored `isoLevel` by its reciprocal.
 */
export const CALIBRATION = 0.567;

/**
 * The thickness/ramp coordinate's depth, in multiples of the density reference — **the scale `thickness`
 * divides by, which is deliberately NOT the threshold.**
 *
 * ⚠️ **SHARING ONE SCALE WITH `uIsoRef` WAS THE 15.1 DEFECT, AND IT IS WHY THE REPORT SAID "INVISIBLE"
 * RATHER THAN "SMALLER".** `thickness = (d − isoRef)/isoRef` divides by the very threshold it subtracts, so
 * raising Iso Level erodes the silhouette AND drags every surviving texel toward `thickness = 0` — which on
 * the `liquid` ramp is `(20,0,40)` at alpha 0. The two factors multiply: measured over Iso Level 0.25 → 16 on
 * `Liquid Surface`, coverage fell 5× while total on-screen light fell **10×**.
 *
 * `4.0` is measured, not assumed: it recovers Iso Level 8 from 0.222 → 0.295 of the track's peak light and 16
 * from 0.101 → 0.174, and it is the value at which the interior of a typical figure reaches the top of the
 * ramp without the rim's gradient collapsing into one ramp texel. ⚠️ **A LARGER value flattens the surface's
 * interior shading; a smaller one saturates it** — it sets how many multiples of the reference the ramp
 * spans, so it is a look control that is deliberately NOT exposed: it has no independent meaning to a user
 * once `Iso Level` and `Edge Softness` are both authorable.
 */
export const LIQUID_THICKNESS_DEPTH = 4.0;

/**
 * Format a TS number as a GLSL float literal — the reason 15.3's four constants can be interpolated into the
 * shader source instead of being transcribed into it.
 *
 * ⚠️ **`3` WOULD BE AN `int` IN GLSL, AND `pow(x, 3)` DOES NOT COMPILE** (no implicit int→float promotion in
 * ES 3.00 overload resolution for a `genType` argument), so a whole-numbered constant MUST carry a decimal
 * point. That is the whole job: a shader that fails to compile still links, still binds and draws as a
 * silent NO-OP (`core/gl-program.ts`), so this would present as a black surface with an empty console.
 *
 * ⚠️ **Interpolating rather than transcribing is what keeps the constant's DERIVATION next to its value.** A
 * digit typed into two shader bodies is three copies of one number, and `fieldcheck` §O asserts that neither
 * file spells the digits — the *three enumerations of one list* rule in its smallest form.
 */
export function glslFloat(v: number): string {
  return Number.isInteger(v) ? `${v}.0` : `${v}`;
}

/**
 * v8 Step 15.3 — the chromatic dispersion offset, as a **FRACTION OF THE KERNEL RADIUS**.
 *
 * ⚠️ **NOT A TEXEL COUNT, AND BOTH FORMS WERE MEASURED — invariant 26's shape in a third guise.** A fixed
 * texel offset is not scale-invariant: median chromatic delta at 8 texels is **0.1006 at R = 6.08 px and
 * exactly 0.0000 at R = 2.5 px**, because past the kernel's own support both taps read the same value and
 * the difference vanishes — the control would read as dead at small Kernel Width and strong at large.
 * As a fraction of `R` it holds within 2.5× over a 6× kernel range (measured at **frac 0.3**, over
 * R = 2 / 4 / 6.08 / 12: 0.104 / 0.092 / 0.072 / 0.045). ⚠️ **That row is the 0.3 sweep point, NOT this
 * constant's own value** — the sweep bracketed 0.35 rather than landing on it, and attributing a neighbour's
 * numbers to the shipped value is this project's own extrapolation error in miniature. **A displacement in an
 * image-domain operator must be expressed in the units of the structure it displaces**, which here is the
 * kernel and not the screen.
 *
 * 0.35 rather than more: past ~0.5·R the two taps straddle the kernel and the delta saturates (0.5 → 0.107,
 * 0.7 → 0.134 at R = 6.08, i.e. diminishing), while the offset starts to read as a doubled edge rather than
 * as dispersion.
 */
export const REFRACT_SPREAD = 0.35;

/**
 * v8 Step 15.3 — the Blinn–Phong exponent for the liquid specular lobe.
 *
 * ⚠️ **16, NOT CRYSTAL'S 42, AND THE DIFFERENCE IS THE NORMAL, NOT TASTE.** Crystal's `pow(…, 42)` sits on a
 * **faceted** normal that is piecewise constant, so a tight lobe gives one glint per face. This normal is a
 * smooth central difference. Measured fraction of surface pixels with lobe > 0.25 on a realistic figure:
 * pow 8 → 68.6 %, pow 16 → 45.2 %, pow 32 → 22.3 %, pow 42 → 17.3 %, pow 64 → 11.5 %.
 *
 * ⚠️ **The naive reading of that table is backwards.** A smaller lit fraction looks like a tighter highlight,
 * but on a smooth normal the lobe's own PEAK barely moves (0.999 at pow 8 → 0.988 at pow 64), so a high
 * exponent does not sharpen the glint — it dims the whole surface roughly uniformly, which reads as the
 * specular control being weak rather than as a crisper highlight. **An exponent tuned against one normal
 * does not transfer to a different one.**
 */
export const SPEC_EXPONENT = 16.0;

/**
 * v8 Step 15.3 — the Fresnel exponent for the rim.
 *
 * ⚠️ **THE RIM SIGNAL IS `dot(n, view)` AND NOT `1 − thickness`, AND THAT WAS MEASURED ACROSS BOTH DENSITY
 * REGIMES.** On a dense curve `(1 − thickness)^1` lights **91.9 %** of the surface — a global tint, not a
 * rim — and its annulus width swings with the figure (60.9 % dense vs 41.5 % sparse at k = 4), because
 * `thickness` is a density ratio and the density distribution is exactly what differs between a curve and a
 * cloud. Fresnel at this exponent gives median **0.0001**, p90 0.011, p99 0.156: near-zero over the interior,
 * lifting only where the surface turns away.
 *
 * ⚠️ **`n.z` already carries `uThickRef · 0.5`, so `dot(n, view)` is reference-normalised and this term is
 * count-independent for free** — reintroducing a raw `|∇d|` anywhere in the rim would break that, which is
 * the trap the geometric alternative `(d − isoRef)/|∇d|` walks into despite measuring a stable annulus
 * (19.2 % at 1 px dense, 25.2 % sparse).
 */
export const FRESNEL_EXPONENT = 3.0;

/**
 * v8 Step 15.3 — nepers of Beer–Lambert absorption at `thickness = 1` and the `Thickness` control at 1.0.
 *
 * Measured on a dense curve: at this value the median surface keeps **0.707** of its light, p90 0.269, p99
 * 0.050 — a clear substance cue that leaves the thin rim alone (thickness p10 is 0.018, so `exp(−0.054)`
 * ≈ 0.95 there). ⚠️ **`DEFAULT_LIQUID_CONFIG.thickness` is 0.5, i.e. half of this**, because at the full
 * value a thick core goes far enough toward black to lose its chroma before the tone map, and this value
 * feeds the trail's feedback loop.
 *
 * ⚠️ **THIS IS NOT 15.2's `pigment` MODEL BY ANOTHER NAME.** `pigment` deepens by `wSum`, the weight sum of
 * contributing PARTICLES — a colour-mixing statistic. This reads the density field's own THICKNESS, exists at
 * `colourMix = 0` with no colour target sampled at all, and multiplies the composed tint rather than
 * exponentiating it. They compose deliberately.
 */
export const ABSORB_SCALE = 3.0;

/**
 * Below this the spacing measurement is quantisation noise, not a length: at ~1/20 of a texel the
 * consecutive-index step is smaller than the sampling grid, and `spacing === 0` (a stationary or degenerate
 * table) would divide by zero.
 *
 * ⚠️ **0.05 AND NOT 0.25, WHICH WAS MEASURED AND REJECTED** — swept at 0.02 / 0.05 / 0.1 / 0.25, the first
 * three all preserve the 4.6× cross-preset spread while 0.25 degrades it to 6.3× (`Barrock`'s half-erosion
 * point moves 0.418 → 2.146). A floor high enough to be "safely" above the noise is high enough to become
 * the reference on the densest third of the library, which is invariant 10's shape: the units are right and
 * the magnitude silently takes over.
 */
export const SPACING_FLOOR = 0.05;

/**
 * ⚠️ **THE SMOOTHING IS NOT OPTIONAL AND ITS NECESSITY WAS MEASURED IN THE CONSUMED QUANTITY, NOT IN THE
 * REFERENCE** — 14.7b's lesson applied before shipping the defect this time. The shader consumes `1/isoRef`
 * (as `thickness`'s divisor and the normal's z term), whose sensitivity is `1/ref²`, so a small relative
 * wobble in a small reference is a large wobble at the consumer. Measured worst per-frame jump in `1/isoRef`
 * without smoothing: `Waves` **99.29 %**, `Barrock` 33.33 %, `Aurora Borealis` 18.96 % — a visible pulsing.
 * With τ = 0.25 s: **≤ 1.15 %** on all three (`Aurora Borealis` 4.83 %).
 *
 * Seconds rather than frames, so it is frame-rate independent — and that makes the `* 0.001` at any
 * millisecond call site load-bearing, exactly as `BAND_TAU_SECONDS` documents.
 */
export const LIQUID_REF_TAU_SECONDS = 0.25;

/**
 * Mean distance between CONSECUTIVE INDICES of the live population, in pixels — the `s` of `d_line`.
 *
 * ⚠️ **THE CHAIN MUST BREAK AT EVERY CULLED PARTICLE, NOT MERELY SKIP IT.** `positions` is dense and a
 * culled slot holds `CULL_SENTINEL`, so measuring `|p[i] − p[i−1]|` across a gap would bridge two unrelated
 * segments of the curve and add a spurious length of up to the sentinel's own magnitude. On the 7 presets
 * that are 38–48 % culled that is not a small error, it is the dominant term — the same population trap
 * invariant 21 records for the depth band, where a min/max over the whole array returned the identity.
 *
 * ⚠️ **`state.count` IS THE ONLY TRUSTWORTHY LENGTH** (invariant 7) and the caller passes the **CURVE** count
 * — `state.waveCount`, i.e. the LEADING wave block alone.
 *
 * ⚠️ **NOT the solid count, and this doc said "SOLID" until 2026-09-03 (`15.6-salvage` B) — which both callers
 * then honoured, one of them literally.** Canonical slot order is `[wave][sparks][liquid][crystals]`, and only
 * the wave block lies on a curve at all: a spark is a ballistic ember and a pool particle is a Halton cloud
 * point, so in both tail blocks consecutive indices hold positions with no relationship whatever. Walking into
 * them bridges unrelated segments exactly as a culled slot does — the error the sentinel test below exists to
 * prevent — but with no sentinel to catch it, so it is silent. It inflates the returned spacing, which drives
 * the caller's `(32/35)·R/s` DOWN and hands the threshold to the frame-mean lower bound: 15.1b's dot-cloud
 * regime, on a figure that is still a curve.
 *
 * @param curveCount particles ON THE CURVE — `state.waveCount`. Excludes ALL THREE tail blocks: sparks and the
 *   liquid pool for the reason above, crystals because a crystal is drawn by its own pass and is not part of
 *   the field.
 * @returns the mean consecutive-index distance, or `Infinity` when fewer than two adjacent live particles
 *   exist (so the caller's `max()` falls to the frame mean rather than dividing by zero).
 */
export function measureIndexSpacing(positions: Float32Array | readonly number[], curveCount: number): number {
  let sum = 0, pairs = 0;
  let contiguous = false, px = 0, py = 0;
  for (let i = 0; i < curveCount; i++) {
    const x = positions[i * 3]!;
    const y = positions[i * 3 + 1]!;
    // The sentinel test is `=== CULL_SENTINEL` on x, matching how every other consumer identifies a culled
    // slot; the finite test catches an integrator that diverged (invariant 21 — scan the CPU arrays).
    if (x === CULL_SENTINEL || !Number.isFinite(x) || !Number.isFinite(y)) { contiguous = false; continue; }
    if (contiguous) { sum += Math.hypot(x - px, y - py); pairs++; }
    px = x; py = y; contiguous = true;
  }
  return pairs > 0 ? sum / pairs : Infinity;
}

/**
 * The density reference `Iso Level` multiplies — **the ONE owner of this arithmetic**, shared by the main
 * renderer and the preview tiles so a tile cannot drift from the view it previews.
 *
 * @param curveCount particles ON THE CURVE — `state.waveCount`, excluding all three tail blocks. ⚠️ **MUST be
 *   the same population `spacing` was measured over (`15.6-salvage` B, 2026-09-03; this said "solid count"
 *   before).** The two arguments are the two arms of one `max()`: counting the sparks and the pool here while
 *   excluding them from the spacing would raise the frame-mean arm by exactly the population the on-curve arm
 *   was told to ignore, so the reference would be handed to the lower bound *because* of the fix. Invariant
 *   27's shape — a scale and its basis are two quantities, and correcting one can silently break the other.
 * @param radius the sprite radius in pixels, **after the hardware clamp** — `liquidPointDiameter()`'s
 *   output halved. An unclamped radius overstates both terms (measured 1.576× at 3840×2160, kw 3).
 * @param width canvas width in pixels.
 * @param height canvas height in pixels.
 * @param spacing `measureIndexSpacing()`'s output. `Infinity` (no adjacency) yields the frame mean alone.
 */
export function liquidDensityReference(
  curveCount: number,
  radius: number,
  width: number,
  height: number,
  spacing: number,
): number {
  const frameMean = (curveCount * Math.PI * radius * radius) / (4.0 * Math.max(1, width * height));
  const onCurve = Number.isFinite(spacing)
    ? (LINE_INTEGRAL * radius) / Math.max(spacing, SPACING_FLOOR)
    : 0;
  // `1e-3` keeps the 15.1 floor: an empty or fully-culled frame must not produce a zero threshold, which
  // would make every texel including the cleared background pass the test.
  return CALIBRATION * Math.max(onCurve, frameMean, 1e-3);
}

/**
 * One EMA step on the reference. ⚠️ **GEOMETRIC, because the quantity is a DENSITY spanning two orders of
 * magnitude across the library and is consumed as a reciprocal** — a linear lerp between 0.05 and 5.0 spends
 * almost all of its travel near the top, so the visual midpoint is not the arithmetic one. This is the same
 * reasoning `interpolateLiquid` uses to lerp `isoLevel` geometrically through the Mixer.
 *
 * `1 − exp(−dt/τ)` is frame-rate independent by construction, and `α` is clamped so a tab returning from the
 * background cannot overshoot. A non-positive `dt` or `τ` snaps, which is what `resetReference`'s callers
 * want on a known discontinuity.
 */
export function smoothLiquidReference(prev: number, next: number, dtSeconds: number, tauSeconds: number): number {
  if (!(prev > 0) || !(next > 0)) return next;
  if (!(tauSeconds > 0) || !(dtSeconds > 0)) return next;
  const a = Math.min(1 - Math.exp(-dtSeconds / tauSeconds), 1);
  return Math.exp(Math.log(prev) + a * (Math.log(next) - Math.log(prev)));
}

/**
 * v8 Step 15.7, added 2026-09-03. Converts the dye field's **accumulated deposit weight** into a saturation
 * toward the dye's own hue: `sat = 1 − exp(−a · DYE_SATURATION_K)`.
 *
 * ⚠️ **IT EXISTS BECAUSE THE HUE READ IS SCALE-INVARIANT AND THEREFORE HIDES EVERY SLIDER.** The surface
 * resolves the field as `rgb / a` — the same weighted-mean form the colour target uses, and correct for the
 * hue — but that quotient divides out exactly what `opacity` (Dye Amount), `decayRate` (Dye Decay),
 * `injectionRadius` and every overlapping deposit change. Measured: all four returned the identical colour at
 * every value, which reached the user as *"none of the sliders seems to have an effect"*. The hue comes from
 * the quotient; the DENSITY has to come from the alpha, or it never reaches the screen.
 *
 * **0.02 is DERIVED from the field's own steady state, not tuned.** A texel receiving `n` deposits per frame
 * settles at `a = opacity · n / (1 − decayRate)`, so at the shipped defaults (0.5, 0.985) `a ≈ 33` and this
 * constant puts the saturation at **0.487** — near mid-range, so both directions of both sliders are visible.
 * The extremes reach **0.010** (amount 0.05, decay 0.90) and **1.000** (amount 1.0, decay 0.999). ⚠️ **A larger
 * k saturates the default and makes the upper half of both tracks inert; a smaller one wastes the lower half —
 * so this is a REACHABILITY property of two slider tracks, not a look preference** (the trackcheck rule:
 * reachability and resolution are separate properties, and the first passes green on a useless track).
 *
 * ⚠️ **Do not fold this into `opacity`.** They are different quantities: `opacity` is a per-particle deposit
 * weight applied at INJECTION, inside the feedback loop and therefore compounding through the decay, while
 * this is a read-time mapping applied ONCE at the surface. Multiplying them would make the exponent
 * quadratic in the slider and un-derive the range above.
 */
export const DYE_SATURATION_K = 0.02;

/**
 * v8 28.1 (`28.D10`) — **THE ONE SOURCE OF THE DYE'S PREMULTIPLIED-TO-HUE QUOTIENT, as GLSL.**
 *
 * ⚠️ **IT IS A SHARED STRING RATHER THAN A FUNCTION TYPED INTO EACH SHADER, AND THE REASON IS WRITTEN IN
 * ITS OWN OLD COMMENT:** the quotient was already read in THREE places (the surface body's tint, the
 * wake-only fragment, the composited edge) and *"a second spelling of it is how the wake would come to
 * disagree with the body it trails"*. Phase 28 adds a FOURTH reader in a different file — the standalone
 * dye overlay — so a retyped copy is that risk realised across a module boundary, where no compiler and
 * no grep over one file can see the divergence.
 *
 * The 1e-6 guard is **not** about sparsity: the field is LINEAR-filtered, so an edge texel can interpolate
 * a numerator and a denominator that both round to 0 in half float, and 0/0 is NaN — which reaches
 * acesToneMap on the screen path, past every sanitiseTrail() (invariant 20).
 *
 * ⚠️ **NO BACKTICK MAY EVER APPEAR IN THIS STRING OR ITS COMMENT.** It is interpolated into template
 * literals in two files, so invariant 18's failure here terminates a shader in whichever file it reaches
 * and reports the error somewhere else entirely — which happened three times in one sitting on 2026-10-19.
 *
 * ⚠️ **The file name predates the dye's independence and is now slightly wrong** — since 28.1 the dye
 * reaches the screen outside `liquid` mode, so a dye constant living in `liquid-reference.ts` reads as a
 * coupling that no longer exists. It stays here because this file already owns `DYE_SATURATION_K` and its
 * whole derivation, and splitting the two dye constants across two files to fix a NAME would be the worse
 * trade. **A rename is a separate, mechanical change; do not do it halfway.**
 */
export const DYE_HUE_GLSL = `
vec3 dyeHueOf(vec4 s, vec3 fallback) {
  return s.a > 1e-6 ? clamp(s.rgb / s.a, 0.0, 1.0) : fallback;
}
`;
