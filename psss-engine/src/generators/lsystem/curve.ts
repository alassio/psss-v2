/**
 * @file v8 `36.6` + `36.7` — **the resampler, the two-list lerp and the extent transform.** Turns a
 * raw turtle point list into `particleCount` positions in the preset's own design units.
 *
 * ⚠️⚠️ **IMPORTS ONLY TYPE-FREE CONSTANTS AND ITS OWN SIBLINGS (`36.D2`).** `score-canvas.ts` draws this
 * figure type and `composercheck` loads that file under bare Node, which **strips types only**. Verified
 * 2026-11-02: `core/deform-limits.ts` loads under `node --experimental-strip-types` (its sole import is
 * an `import type`, which is erased), so sharing constants from there is safe. **Do not add an import
 * that reaches the DOM or a GL type, and no `enum` or constructor parameter property** — both throw
 * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under Node while `tsc --noEmit` stays green.
 */

import type { LSystemRule } from './rules.ts';
import { walkTurtle } from './turtle.ts';

/**
 * The figure's half-extent as a fraction of the preset's own design box.
 *
 * ⚠️⚠️ **THIS MIRRORS `ATTRACTOR_DESIGN_FRACTION` BY VALUE ON PURPOSE, AND THE DUPLICATION IS FORCED
 * RATHER THAN SLOPPY** — that constant is module-private in `lissajous.ts:89`, and this module may not
 * import `lissajous.ts` (it reaches GL). **The two must stay equal**, and the reason is the one
 * `lissajous.ts:80-88` records: a FRACTION rather than an absolute makes the projected size identical
 * for every preset by construction, where an absolute 45 is right for a 100×100 design box and **6.8×
 * too small for a 960×720 one**. Measured there: the median XY half-extent over the legacy library is
 * *exactly* 45 units in a 100×100 box, so a figure at this fraction is the size of a median figure —
 * which is what makes this type comparable with a wave figure rather than dwarfing it or vanishing.
 *
 * ⚠️ `36.7`'s requirement, met here: *"a contract to state in the same convention, not a mechanism to
 * invent."*
 */
export const LSYSTEM_DESIGN_FRACTION = 0.45;

/**
 * The centre and scale that carry a raw turtle list into `[-1, 1]`.
 *
 * ⚠️⚠️ **CAPTURED ONCE AT A REFERENCE POSE AND HELD — NEVER RE-DERIVED PER BUILD (`36.D14`).** The
 * prototype re-centres on the bbox midpoint and re-scales by the largest half-range on **every** build
 * (`4-lsystem-model.mjs:87-90`). Under `36.D3`'s five modulated parameters that is a defect rather than
 * a nicety: an angle or a recursion that breathes changes the bounding box, so a per-build
 * normalisation makes the figure **pulse in SIZE and wander in POSITION** on top of the shape change
 * the author asked for — a motion nobody specified, and one that reads as throbbing rather than
 * morphing. ⚠️⚠️ **And it is a PRECONDITION OF THE LERP, not an ornament: two lists normalised
 * independently are in two different coordinate systems, so lerping them interpolates between
 * coordinate systems and means nothing.**
 *
 * ⚠️ **It is a TRANSFORM and not a scalar, which is `36.D9` and invariant 27 arriving again** — *"a
 * subsystem's scale and its origin are two quantities"*, measured on `Rössler Wide` at +1.96 in z.
 */
export interface ExtentTransform {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  /** Divide by this. Never 0: a degenerate list falls back to 1 so a build cannot produce NaN. */
  readonly scale: number;
}

/** The identity, for a caller with no reference yet. */
export const EXTENT_IDENTITY: ExtentTransform = { cx: 0, cy: 0, cz: 0, scale: 1 };

/** Measure a transform from a point list. Call this at the REFERENCE pose only (`36.D14`). */
export function captureExtent(xyz: Float64Array, count: number): ExtentTransform {
  if (count <= 0) return EXTENT_IDENTITY;
  let loX = Infinity, loY = Infinity, loZ = Infinity;
  let hiX = -Infinity, hiY = -Infinity, hiZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const b = i * 3;
    const x = xyz[b]!, y = xyz[b + 1]!, z = xyz[b + 2]!;
    if (x < loX) loX = x; if (x > hiX) hiX = x;
    if (y < loY) loY = y; if (y > hiY) hiY = y;
    if (z < loZ) loZ = z; if (z > hiZ) hiZ = z;
  }
  // One isotropic scale from the LARGEST half-range, never three. A per-axis scale would stretch the
  // figure to the box and destroy the self-similarity that is the whole subject.
  const half = Math.max((hiX - loX) * 0.5, (hiY - loY) * 0.5, (hiZ - loZ) * 0.5);
  return {
    cx: (loX + hiX) * 0.5,
    cy: (loY + hiY) * 0.5,
    cz: (loZ + hiZ) * 0.5,
    scale: half > 1e-12 ? half : 1,
  };
}

/** Apply a transform in place, carrying a raw list into the reference pose's `[-1, 1]` frame. */
export function normaliseInto(xyz: Float64Array, count: number, t: ExtentTransform): void {
  const inv = 1 / t.scale;
  for (let i = 0; i < count; i++) {
    const b = i * 3;
    xyz[b] = (xyz[b]! - t.cx) * inv;
    xyz[b + 1] = (xyz[b + 1]! - t.cy) * inv;
    xyz[b + 2] = (xyz[b + 2]! - t.cz) * inv;
  }
}

/**
 * Resample a point list to exactly `outCount` points, **walking it continuously and interpolating**.
 *
 * ⚠️⚠️ **NEVER INDEX INTO THE LIST — INTERPOLATE BETWEEN ENTRIES.** Entry-indexed sampling gives a
 * density of **`Infinity`** whenever `outCount` exceeds the list length, because many particles land on
 * one entry and the minimum consecutive chord is then 0. Measured in the prototype: `Infinity` against
 * **1.37** at 12 000 particles over a 512-entry list. That failure is seeded into the density
 * instrument as a calibration (`36.19`).
 *
 * ⚠️⚠️ **THIS RESAMPLES BY INDEX, AND THAT IS LICENSED BY MEASUREMENT RATHER THAN ASSUMED.** Index-lerp
 * equals arc-length-lerp **only while every segment has equal length**. `36.D12` would have broken that
 * by making `shrink` per-level, which is why it required an arc-length prefix sum — but the owner
 * **dropped the `Shrink` row entirely** (`36.Q4`, 2026-11-02), so the precondition holds again.
 * ⚠️ **Measured 2026-11-02 over all thirteen shipped rules at their published angles: equal segment
 * lengths on every one.** So the precondition is now a property of the RULE SET, which means
 * `36.20` clause 10 asserts *every shipped rule has equal segments* rather than *the two resamplers
 * agree* — and a future rule that fails it needs arc-length resampling **for itself alone**, which is a
 * per-rule fact and not a reason to change this function. `Hill tetrahedron` is the known candidate.
 *
 * ⚠️ `out` is written in place and never allocated here — invariant 8 is about allocation RATE, and
 * this runs per frame.
 */
export function resampleInto(
  out: Float64Array,
  outCount: number,
  src: Float64Array,
  srcCount: number,
): void {
  if (outCount <= 0) return;
  if (srcCount <= 0) {
    out.fill(0, 0, outCount * 3);
    return;
  }
  if (srcCount === 1) {
    for (let i = 0; i < outCount; i++) {
      const b = i * 3;
      out[b] = src[0]!; out[b + 1] = src[1]!; out[b + 2] = src[2]!;
    }
    return;
  }
  // `i / outCount * (srcCount - 1)` is the prototype's own parameterisation and is kept verbatim so its
  // density figures stay comparable with anything measured here. It deliberately stops short of the
  // final entry, which on a CLOSED rule leaves the closing edge implied rather than drawn twice.
  const span = srcCount - 1;
  const step = span / outCount;
  for (let i = 0; i < outCount; i++) {
    const u = i * step;
    const k = Math.floor(u);
    const f = u - k;
    const a = k * 3;
    const b = (k + 1 < srcCount ? k + 1 : srcCount - 1) * 3;
    const o = i * 3;
    out[o] = src[a]! + (src[b]! - src[a]!) * f;
    out[o + 1] = src[a + 1]! + (src[b + 1]! - src[a + 1]!) * f;
    out[o + 2] = src[a + 2]! + (src[b + 2]! - src[a + 2]!) * f;
  }
}

/**
 * v8 `36.8` — **the smoothed resample: a uniform quadratic B-spline over the same control points,
 * blended toward the polyline by `smoothness`.**
 *
 * ⚠️⚠️ **THIS IS A SEPARATE FUNCTION AND `smoothness === 0` NEVER REACHES IT — `36.D10`, AND IT IS A
 * BRANCH RATHER THAN A WEIGHT FOR A MEASURED REASON.** `SPEC-selfsimilar-curves` §1.6 asks for *"the
 * `Sharpness` idiom — two evaluations of one control set, a convex blend"*, and following that prose
 * re-introduces a defect this project already fixed: `33.2`'s first draft called the expensive basis
 * unconditionally and made the faceted path **2x MORE expensive** than the smooth one, while the
 * tooltip, the plan and the manual all said "cheaper". ✅ **The spec's own PROTOTYPE already branches**
 * (`4-organic-families.mjs:44`: `if(smooth<=0) return polyline(P,u);`) — only its prose does not.
 * ⚠️ And bit-identity is not algebraic identity: `a + 0*(b-a)` is exact for every finite value **except
 * `-0`**, so a zero weight would not even be bitwise the polyline.
 *
 * ⚠️ **The basis is the standard uniform quadratic B-spline**, which sums to 1 at every `f` and so
 * cannot change the figure's scale — `b0 = (1-f)²/2`, `b1 = 1/2 + f(1-f)`, `b2 = f²/2`. A spline that
 * did not partition unity would shrink the curve toward its control hull as smoothness rose, which
 * would read as the figure deflating rather than relaxing.
 *
 * ⚠️ **It does NOT pass through its control points**, which is the point: a B-spline cuts the corners a
 * space-filling curve is made of, and that corner-cutting is the whole visual effect. An interpolating
 * spline (Catmull-Rom) would keep every corner and only round the segments between them.
 */
export function resampleSmoothInto(
  out: Float64Array,
  outCount: number,
  src: Float64Array,
  srcCount: number,
  smoothness: number,
): void {
  if (outCount <= 0) return;
  if (srcCount < 3) { resampleInto(out, outCount, src, srcCount); return; }
  const span = srcCount - 1;
  const step = span / outCount;
  const last = srcCount - 1;
  for (let i = 0; i < outCount; i++) {
    const u = i * step;
    const k = Math.floor(u);
    const f = u - k;
    // the polyline sample, which the spline is blended against
    const a = k * 3;
    const b = (k + 1 <= last ? k + 1 : last) * 3;
    // the three control points, clamped at both ends so the curve does not fly off at the extremes
    const c0 = (k - 1 >= 0 ? k - 1 : 0) * 3;
    const c1 = a;
    const c2 = b;
    const w0 = 0.5 * (1 - f) * (1 - f);
    const w1 = 0.5 + f * (1 - f);
    const w2 = 0.5 * f * f;
    const o = i * 3;
    for (let q = 0; q < 3; q++) {
      const lin = src[a + q]! + (src[b + q]! - src[a + q]!) * f;
      const spl = w0 * src[c0 + q]! + w1 * src[c1 + q]! + w2 * src[c2 + q]!;
      out[o + q] = lin + (spl - lin) * smoothness;
    }
  }
}

/**
 * Component-wise lerp of two already-resampled buffers of the same length, into `out`.
 *
 * ⚠️ **`t === 0` and `t === 1` take a COPY branch rather than arithmetic.** `a + 0*(b-a)` is exact for
 * every finite value **except `-0`**, which it silently turns into `+0` — the rule `33.2` established
 * and this project keeps re-deriving: **branch, never weight.** It also makes a non-breathing preset
 * bit-identical to one with no bracket at all.
 */
export function lerpInto(
  out: Float64Array,
  count: number,
  a: Float64Array,
  b: Float64Array,
  t: number,
): void {
  const n = count * 3;
  if (t === 0) { out.set(a.subarray(0, n)); return; }
  if (t === 1) { out.set(b.subarray(0, n)); return; }
  for (let i = 0; i < n; i++) out[i] = a[i]! + (b[i]! - a[i]!) * t;
}

/**
 * Build a point list at one pose, already carried into the reference frame.
 *
 * Returns a fresh buffer: this is the **rebuild** path, which runs on a rule / recursion-bracket /
 * angle-bracket change and not per frame. ⚠️ **Watch the rebuild RATE, not its time (invariant 8)** —
 * a rebuild every few seconds reaches the user as a jitter whose period must be derived before the
 * nearest periodic parameter is blamed.
 */
export function buildPose(
  rule: LSystemRule,
  depth: number,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
): { xyz: Float64Array; count: number; truncated: boolean; transform: ExtentTransform } {
  const t = walkTurtle(rule, depth, yawDeg, pitchDeg, rollDeg);
  // Copy out of the growable sink so the caller owns a tight buffer and the sink can be collected.
  const xyz = t.xyz.slice(0, t.count * 3);
  // ⚠️⚠️ **RETURNED RAW, WITH ITS TRANSFORM ALONGSIDE AND NOT APPLIED — the third mechanism, and the
  // two before it were each falsified by a measurement.** (1) ONE held transform made an angle sweep
  // SHRINK the figure and a deeper recursion GROW it. (2) Normalising each corner by its own extent
  // fixed both but wrecked the bracket on the FASS rules, because lerping two differently-FITTED
  // figures carries the mismatch between their fits into the result: the solved half-width collapsed
  // from 1.60 deg to 0.23 deg on `Hilbert 3D` and from 2.90 to 0.85 on `Moore`, i.e. 4x the rebuilds.
  // (3) So the caller lerps the RAW lists and lerps the TRANSFORMS alongside, then normalises once.
  // Raw positions are sums of rotated unit vectors and respond to an angle far more linearly than a
  // fitted figure does, so the lerp is accurate where it matters AND the figure stays framed.
  const transform = captureExtent(xyz, t.count);
  return { xyz, count: t.count, truncated: t.truncated, transform };
}

/**
 * Lerp two transforms. ⚠️ **The SCALE is lerped geometrically and the CENTRE linearly** — a scale is a
 * multiplicative quantity, and `36.13` records the same rule for `descend` (*"octaves are
 * multiplicative and a linear lerp from 1 to 128 spends half the crossfade above x64"*).
 */
export function lerpTransform(a: ExtentTransform, b: ExtentTransform, t: number): ExtentTransform {
  if (t === 0) return a;
  if (t === 1) return b;
  return {
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    cz: a.cz + (b.cz - a.cz) * t,
    scale: a.scale * Math.pow(b.scale / a.scale, t),
  };
}

/*
 * ⚠️⚠️ **`36.D14`'s MECHANISM IS REPLACED, AND BOTH OF ITS CLAUSES WERE FALSIFIED BY A PICTURE.**
 *
 * `36.D14` specifies ONE transform, captured at the rule's published angle and base depth and *"re-derived
 * only when the RULE changes — never when an angle, depth or zoom moves."* Built that way and rendered,
 * it fails twice:
 *
 *   1. **Across DEPTH.** With unit segments a Hilbert curve spans 4×4 at recursion 2 and 8×8 at
 *      recursion 3, so one held transform makes a deeper recursion a **bigger figure**. Demo #2's whole
 *      subject is the opposite — *"new detail appearing between existing strokes rather than the whole
 *      figure scaling"* — so continuous recursion read as a zoom.
 *   2. **Across ANGLE.** A rule's raw extent changes with its turn angle, so holding the transform made
 *      the Koch 90°→117° sweep **shrink monotonically** instead of morphing. Measured on the first
 *      render of demo #4's own interval: the figure lost most of its size across the sweep.
 *
 * ✅ **THE REPLACEMENT IS SIMPLER AND IT IS WHAT THE PICTURE ASKED FOR: every bracket corner is
 * normalised BY ITS OWN EXTENT, and the lerp runs between the normalised lists.** Both corners are then
 * framed in the same canonical `[-1, 1]` box, so the lerp is a pure SHAPE morph at constant size — and
 * the same mechanism gives subdivision across depth, because both recursion levels are framed alike too.
 *
 * ⚠️ **`36.D14`'s CONCERN is still honoured, and that is why this is a replacement rather than a
 * reversal.** It objected to (a) a per-build normalisation making a breathing angle **pulse** the
 * figure, and (b) lerping *"two differently-normalised point lists"* being meaningless. Neither bites
 * here: the normalisation is captured per **cached bracket corner**, not per frame, so within a bracket
 * the output varies smoothly with the lerp fraction and there is no per-build jitter; and the two
 * normalisations are not arbitrary but the *same canonical fit*, which is precisely what makes
 * interpolating them a shape morph. **Crossing a bracket does shift the normalisation, and that shift is
 * bounded by the same error budget `LSYSTEM_ANGLE_BRACKET` was solved against.**
 *
 * ⚠️ **So there is no `captureReference` any more. Do not re-add one** — a single held transform is the
 * mechanism that was measured wrong.
 */
