/**
 * @file v8 `36.6` — **the resolved figure: bracket caching, the two-list lerp, and continuous
 * recursion.** This is the module `36.10`'s figure source calls once per frame.
 *
 * ⚠️⚠️ **IMPORTS ONLY ITS OWN SIBLINGS (`36.D2`).** See `curve.ts`' header.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE REBUILD COST, MEASURED 2026-11-02 — AND IT FALSIFIES THE SPEC'S OWN HEADLINE RISK
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `SPEC-selfsimilar-curves` §8.3 calls the rebuild *"the phase's one unproven claim"* and predicts that
 * a breathing angle rebuilding per frame is **"a permanent stall, not an animation."** Measured over
 * all thirteen shipped rules at the TOP of each declared `recursionRange`, 12 000 particles:
 *
 *     6 of 13 under 2 ms          · worst case `Levy C` at **5.93 ms**
 *     7 of 13 between 2 and 6 ms  · **NONE above 16.7 ms, so nothing stalls**
 *
 * **So the prediction is wrong at the shipped bounds and the bracket below is an OPTIMISATION rather
 * than a rescue** — the phase would animate without it, visibly more expensively. That matters for
 * planning: if this machinery ever looks like the thing standing between the phase and a picture, it
 * can be bypassed and the figure still moves.
 *
 * ⚠️ **What the measurement DOES decide is WHAT to cache: the walk is 95 %+ of the cost** (2.1–5.9 ms)
 * **and the resample is 0.06–0.29 ms.** So the bracket exists to avoid the WALK, and anything that
 * still walks per frame has missed the point.
 *
 * ✅ **AND IT DECIDES THE SHAPE, through a fact neither spec states: an ANGLE CHANGE DOES NOT CHANGE
 * THE LIST LENGTH.** Two poses at the same recursion have identical symbol counts, so their point
 * lists are the same length and can be lerped **directly, before resampling**. Only a RECURSION change
 * alters the length. That is why the angle bracket is resolved at list level and the recursion bracket
 * at buffer level, which halves both the resampling work and the buffer count against the obvious
 * four-corner implementation.
 */

import {
  LSYSTEM_ANGLE_BRACKET, LSYSTEM_MIN_USEFUL_BRACKET_DEG, ruleAngleUsage, type LSystemRule,
} from './rules.ts';
import {
  buildPose, captureExtent, lerpInto, lerpTransform, normaliseInto,
  type ExtentTransform,
} from './curve.ts';
import {
  effectiveRecursion, zoomBandFromWalk, resampleBandInto, type ZoomBand,
} from './zoom.ts';

/**
 * The live parameter set the figure source resolves each frame. Degrees; recursion is continuous.
 *
 * ⚠️⚠️ **`multiAxis` IS NOT A CONVENIENCE FLAG — IT SELECTS THE BRACKET WIDTH AND THE TWO DIFFER BY 5×
 * ON `Hilbert 3D`.** Set it true while **pitch or roll is actually breathing** (a non-zero modulation
 * amplitude), false when they are constant. The caller owns that fact; this module cannot see a
 * modulation, only a resolved value, and inferring it from frame-to-frame change would be a second
 * source of truth for the same thing.
 */
export interface LSystemPose {
  readonly rule: LSystemRule;
  readonly recursion: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly multiAxis: boolean;
  /**
   * v8 `36.8` — 0 is a BRANCH, not a weight (`36.D10`): at 0 no spline is evaluated at all, so a
   * preset authoring nothing is bitwise the polyline.
   */
  readonly smoothness: number;
  /**
   * v8 `36.9` — the self-similar zoom in OCTAVES; 1 means no zoom.
   *
   * ⚠️ **It DEEPENS the list and then draws a BAND of it**, which is what makes it reveal structure
   * rather than magnify. ⚠️ **The depth it can reach is bounded by COST and not by taste** — see
   * `zoomCeiling`.
   */
  readonly descend: number;
  /** The zoom's centre in the figure's own `[-1, 1]` frame. Static (`36.D3`). */
  readonly centre: readonly number[];
}

interface CachedList {
  /** RAW turtle output -- un-normalised. The transform travels beside it, unapplied. */
  xyz: Float64Array;
  count: number;
  transform: ExtentTransform;
}

/**
 * The figure's mutable cache. ⚠️ **A plain interface plus functions rather than a class** — not style:
 * `reel-model.ts`'s measured rule is that a constructor parameter property throws
 * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under bare Node while `tsc --noEmit` stays green, and this module
 * is reachable from a file a checker loads.
 *
 * ⚠️ **Every buffer is a FIELD, never a fresh allocation per frame** — invariant 8 is about allocation
 * RATE, and `opTriple`'s header already records the same rule for the operator scratch.
 */
export interface LSystemFigureCache {
  ruleKey: string | null;

  /** Integer recursion floor of the live bracket, and the two lists bracketing the angle at it. */
  depthLo: number;
  loAtAngleLo: CachedList | null;
  loAtAngleHi: CachedList | null;
  /** The same at `depthLo + 1`. Null when the recursion is exactly integral at the top of its range. */
  hiAtAngleLo: CachedList | null;
  hiAtAngleHi: CachedList | null;

  /** Bracket corners in degrees: [yaw, pitch, roll]. */
  angleLo: [number, number, number];
  angleHi: [number, number, number];
  /**
   * The full bracket width the corners were built at. ⚠️ **Cached because `multiAxis` can flip at
   * runtime** — a preset whose pitch modulation is switched on moves from the wide width to the narrow
   * one, and corners built on the old grid are no longer the bracket the lerp fraction is measured
   * against. Without this the figure would jump silently.
   */
  bracketWidth: number;

  /** Angle-blended lists, one per recursion level. Same length as their inputs. */
  blendLo: Float64Array;
  blendHi: Float64Array;
  /** Resampled buffers, one per recursion level, each `capacity` points. */
  bufLo: Float64Array;
  bufHi: Float64Array;
  capacity: number;

  /** Diagnostics the UI and the checkers read rather than infer. */
  truncated: boolean;
  rebuilds: number;
  /** The last band resolved, for the readout. `null` while the zoom is off. */
  band: ZoomBand | null;
  /** True when the cost ceiling or the wall clamped the requested depth — surfaced, never silent. */
  zoomClamped: boolean;
}

export function createFigureCache(): LSystemFigureCache {
  return {
    ruleKey: null,
    depthLo: -1,
    loAtAngleLo: null, loAtAngleHi: null, hiAtAngleLo: null, hiAtAngleHi: null,
    angleLo: [0, 0, 0], angleHi: [0, 0, 0], bracketWidth: 0,
    blendLo: new Float64Array(0), blendHi: new Float64Array(0),
    bufLo: new Float64Array(0), bufHi: new Float64Array(0),
    capacity: 0,
    truncated: false,
    rebuilds: 0,
    band: null,
    zoomClamped: false,
  };
}

/** Snap an angle to the bracket grid so the two corners are stable rather than drifting with the input. */
function bracketFloor(deg: number, width: number): number {
  return Math.floor(deg / width) * width;
}

function ensure(buf: Float64Array, n: number): Float64Array {
  return buf.length >= n ? buf : new Float64Array(n);
}

/**
 * Resolve the pose into `out` as `count` xyz triples, in the reference frame's `[-1, 1]`.
 *
 * ⚠️ The caller multiplies by `LSYSTEM_DESIGN_FRACTION * min(designW, designH)` — the figure is handed
 * back normalised so the design-box convention lives at ONE site (`36.7`).
 */
export function resolveFigure(
  cache: LSystemFigureCache,
  pose: LSystemPose,
  out: Float64Array,
  count: number,
): void {
  const rule = pose.rule;

  // --- a rule change invalidates every transform and both brackets.
  if (cache.ruleKey !== rule.key) {
    cache.ruleKey = rule.key;
    cache.depthLo = -1;                       // force a rebuild of both brackets
    cache.loAtAngleLo = null; cache.loAtAngleHi = null;
    cache.hiAtAngleLo = null; cache.hiAtAngleHi = null;
  }


  /*
   * --- the recursion the LIST is built at, which the zoom DEEPENS (`36.9`).
   *
   * ⚠️⚠️ **THE ZOOM IS ALLOWED PAST THE RULE'S OWN `recursionRange` AND THAT IS THE WHOLE MECHANISM** —
   * the range caps what the USER's Recursion row can ask for, and the zoom extends it, because a zoom
   * that could not deepen the list would reveal no new structure at all.
   *
   * ⚠️⚠️ **BUT THE EXTENSION IS BOUNDED BY MEASURED COST, NOT BY THE INDEX WALL, AND THAT CORRECTS
   * `36.9`'s OWN CLAIM.** `36.9` says *"from recursion 3 this allows roughly seven octaves"*, which is
   * true of the index arithmetic and false of the engine: measured list-build cost on `Hilbert 3D` is
   * **2.4 ms at order 4 and 5.9 ms at order 5**, and each further order multiplies the symbol count by
   * eight. **Seven octaves would be a multi-second stall.** So the ceiling is `recursionRange[1] + 2`,
   * which buys about **two octaves of genuinely new detail** — stated here rather than discovered, and
   * surfaced to the user through `zoomClamped`.
   */
  const rMin = rule.recursionRange[0];
  const rMax = rule.recursionRange[1];
  const zoomCeiling = rMax + 2;
  /*
   * ⚠️⚠️ **`zoomCeiling` IS THE ONLY CEILING AND IT IS PASSED IN — see `effectiveRecursion`'s header.**
   * A flat `ZOOM_MAX_EFFECTIVE_RECURSION = 8` used to be applied inside that function as well, which
   * capped the USER's Recursion row (not just the zoom) and silently cost `levyC`/`knopp` levels 9-14
   * and `dragon` levels 9-13. Two ceilings in two places with `zoomClamped` OR-ing the second is what
   * made it survive; one ceiling applied once is what makes `clamped` trustworthy.
   */
  const userRec = Math.min(rMax, Math.max(rMin, pose.recursion));
  const eff = effectiveRecursion(userRec, pose.descend, zoomCeiling);
  const rec = eff.order;
  cache.zoomClamped = eff.clamped;
  const depthLo = Math.min(zoomCeiling, Math.floor(rec));
  const depthFrac = rec - depthLo;
  const needHi = depthFrac > 0 && depthLo + 1 <= zoomCeiling;

  // --- the angle bracket. Snapped to a grid so the corners do not drift with the input, which would
  // rebuild on every frame of a slow drift and defeat the whole mechanism.
  // ⚠️ The width is PER RULE and solved against a stated error budget — see `LSYSTEM_ANGLE_BRACKET`.
  // A single shared width is wrong by up to 20x across the rule set.
  const bracket = LSYSTEM_ANGLE_BRACKET[rule.key];
  const half = pose.multiAxis ? bracket.multi : bracket.yaw;
  // ⚠️ Below the usable threshold the bracket costs MORE than it saves (`Hilbert 3D` would cross it
  // ~1000 times over a 90 deg sweep at four walks each), so the figure is rebuilt per frame at the
  // exact angle instead. See `LSYSTEM_MIN_USEFUL_BRACKET_DEG` for the measurement and why this is a
  // structural limit of the space-filling rules rather than a tuning choice.
  const useBracket = half >= LSYSTEM_MIN_USEFUL_BRACKET_DEG;
  const w = useBracket ? half * 2 : 0;
  const yLo = useBracket ? bracketFloor(pose.yaw, w) : pose.yaw;
  const pLo = useBracket ? bracketFloor(pose.pitch, w) : pose.pitch;
  const rLo = useBracket ? bracketFloor(pose.roll, w) : pose.roll;

  const angleMoved = cache.angleLo[0] !== yLo || cache.angleLo[1] !== pLo || cache.angleLo[2] !== rLo
    || cache.bracketWidth !== w;
  const depthMoved = cache.depthLo !== depthLo;

  if (angleMoved || depthMoved || cache.loAtAngleLo === null) {
    cache.angleLo = [yLo, pLo, rLo];
    cache.angleHi = [yLo + w, pLo + w, rLo + w];
    cache.bracketWidth = w;
    cache.depthLo = depthLo;
    cache.truncated = false;

    const buildAt = (depth: number, a: [number, number, number]): CachedList => {
      const p = buildPose(rule, depth, a[0], a[1], a[2]);
      if (p.truncated) cache.truncated = true;
      cache.rebuilds++;
      return { xyz: p.xyz, count: p.count, transform: p.transform };
    };
    cache.loAtAngleLo = buildAt(depthLo, cache.angleLo);
    // ⚠️ With no bracket the two corners are the SAME angle, so the second build would be identical
    // work for an identical result -- share it rather than paying twice.
    cache.loAtAngleHi = useBracket ? buildAt(depthLo, cache.angleHi) : cache.loAtAngleLo;
    if (depthLo + 1 <= zoomCeiling) {
      cache.hiAtAngleLo = buildAt(depthLo + 1, cache.angleLo);
      cache.hiAtAngleHi = useBracket ? buildAt(depthLo + 1, cache.angleHi) : cache.hiAtAngleLo;
    } else {
      cache.hiAtAngleLo = null;
      cache.hiAtAngleHi = null;
    }
  }

  // --- scratch capacity. Fields, not fresh arrays (invariant 8).
  if (cache.capacity < count) {
    cache.bufLo = new Float64Array(count * 3);
    cache.bufHi = new Float64Array(count * 3);
    cache.capacity = count;
  }

  const lA = cache.loAtAngleLo;
  const lB = cache.loAtAngleHi;
  if (lA === null || lB === null) { out.fill(0, 0, count * 3); return; }

  // --- the ANGLE lerp, at LIST level: both corners share a symbol count, so their lists are the same
  // length and lerping them directly costs one pass over a few thousand entries instead of a walk.
  // The fraction is per axis only insofar as all three share one grid; a single `t` is correct because
  // the three angles advance together through the same bracket width.
  // With no bracket the corners coincide and the fraction is 0 -- which `lerpInto` takes as a COPY
  // branch, so the un-bracketed path costs one pass and no arithmetic.
  const tAngle = useBracket ? (pose.yaw - cache.angleLo[0]) / w : 0;
  const nLo = Math.min(lA.count, lB.count);
  cache.blendLo = ensure(cache.blendLo, nLo * 3);
  lerpInto(cache.blendLo, nLo, lA.xyz, lB.xyz, tAngle);
  /*
   * ⚠️⚠️ **THE ZOOM'S BAND IS TAKEN ON THE LIST, BEFORE THE RESAMPLE, AND TAKING IT AFTERWARDS WAS A
   * MEASURED DEFECT.** Applied to the already-resampled output the band threw the deepening away: the
   * mean screen chord collapsed to **0.02x–0.20x** of its `descend = 1` value instead of holding within
   * §10's ±15 %, because the output always has `count` points whatever order built it.
   *
   * ✅ **Here the arithmetic works out to a constant on purpose.** The zoom raises the order by
   * `log2(descend)`, so cells-per-axis grows by `descend`; the aligned sub-cube's side is
   * `cellsPerAxis / descend`, which is therefore **constant**; so the band holds a constant number of
   * cells and stretching it over `count` particles holds the density. **That identity IS the zoom.**
   */
  const bandLo = zoomBand(cache, pose, cache.blendLo, nLo);
  // ⚠️ The BRANCH (`36.D10`): at 0 the spline is never evaluated and never multiplied.
  if (pose.smoothness > 0) resampleSmoothBandInto(cache.bufLo, count, cache.blendLo, bandLo, pose.smoothness);
  else resampleBandInto(cache.bufLo, count, cache.blendLo, bandLo.lo, bandLo.hi);

  if (!needHi || cache.hiAtAngleLo === null || cache.hiAtAngleHi === null) {
    out.set(cache.bufLo.subarray(0, count * 3));
    normaliseResolved(out, count, pose, lerpTransform(lA.transform, lB.transform, tAngle));
    return;
  }

  const hA = cache.hiAtAngleLo;
  const hB = cache.hiAtAngleHi;
  const nHi = Math.min(hA.count, hB.count);
  cache.blendHi = ensure(cache.blendHi, nHi * 3);
  lerpInto(cache.blendHi, nHi, hA.xyz, hB.xyz, tAngle);
  const bandHi = zoomBand(cache, pose, cache.blendHi, nHi);
  if (pose.smoothness > 0) resampleSmoothBandInto(cache.bufHi, count, cache.blendHi, bandHi, pose.smoothness);
  else resampleBandInto(cache.bufHi, count, cache.blendHi, bandHi.lo, bandHi.hi);

  // --- the RECURSION lerp, at BUFFER level: the two levels have different list lengths, so they can
  // only be combined after each has been resampled to the common particle count. Both depend solely on
  // `i / count`, which is what makes them precomputable at all.
  lerpInto(out, count, cache.bufLo, cache.bufHi, depthFrac);

  // --- and ONE normalisation at the end, using the transform bilinearly lerped over the same four
  // corners and the same two fractions. ⚠️ **This is what keeps the figure FRAMED without making the
  // lerp carry a fit mismatch** -- see `buildPose`'s header for the two mechanisms this replaced.
  normaliseResolved(out, count, pose, lerpTransform(
    lerpTransform(lA.transform, lB.transform, tAngle),
    lerpTransform(hA.transform, hB.transform, tAngle),
    depthFrac,
  ));
}

/**
 * v8 `36.9` — the band for one list, in RAW list coordinates.
 *
 * ⚠️ **The centre is carried into RAW space rather than the list into normalised space.** The transform
 * is a uniform scale plus a translate, so transforming the one centre is exact and costs nothing, where
 * normalising the list would be a pass over every entry on every frame.
 *
 * ⚠️ `descend <= 1` returns the whole list as a BRANCH, so the zoom-off path costs one compare — the
 * reason `36.D10` gives about `smoothness`: an identity that is computed is not an identity that is free.
 */
function zoomBand(
  cache: LSystemFigureCache,
  pose: LSystemPose,
  list: Float64Array,
  n: number,
): ZoomBand {
  if (pose.descend <= 1) {
    cache.band = null;
    return { lo: 0, hi: Math.max(0, n - 1), contiguous: true, clamped: false };
  }
  // ⚠️ The lattice DIMENSION, inferred from the rule's own symbol set rather than hard-coded: a 2-D
  // production fills a plane, so treating it as 3-D would take the sub-cube side from the wrong root.
  const u = ruleAngleUsage(pose.rule);
  const dim = (u.pitch || u.roll) ? 3 : 2;
  const band = zoomBandFromWalk(list, n, pose.centre, pose.descend, dim);
  cache.band = band;
  if (band.clamped) cache.zoomClamped = true;
  return band;
}

/** The smoothed resample, restricted to a band. */
function resampleSmoothBandInto(
  out: Float64Array,
  outCount: number,
  src: Float64Array,
  band: ZoomBand,
  smoothness: number,
): void {
  const n = band.hi - band.lo + 1;
  if (n < 3) { resampleBandInto(out, outCount, src, band.lo, band.hi); return; }
  // Re-use the polyline band resample, then relax it toward the spline over the same control points.
  resampleBandInto(out, outCount, src, band.lo, band.hi);
  const step = (n - 1) / outCount;
  for (let i = 0; i < outCount; i++) {
    const u = band.lo + i * step;
    const k = Math.floor(u);
    const f = u - k;
    const c0 = (k - 1 >= band.lo ? k - 1 : band.lo) * 3;
    const c1 = k * 3;
    const c2 = (k + 1 <= band.hi ? k + 1 : band.hi) * 3;
    const w0 = 0.5 * (1 - f) * (1 - f);
    const w1 = 0.5 + f * (1 - f);
    const w2 = 0.5 * f * f;
    const o = i * 3;
    for (let q = 0; q < 3; q++) {
      const spl = w0 * src[c0 + q]! + w1 * src[c1 + q]! + w2 * src[c2 + q]!;
      out[o + q] = out[o + q]! + (spl - out[o + q]!) * smoothness;
    }
  }
}

/**
 * v8 `36.9` — normalise the resolved figure.
 *
 * ⚠️⚠️ **WITH THE ZOOM OFF THIS IS `36.D14`'s RULE EXACTLY: the held, lerped transform.** With the zoom
 * ON the figure is fitted to the BAND's own extent instead, and that difference is the zoom — **measured,
 * because fitting the band to the WHOLE list's extent was a defect.** The band holds a constant number of
 * cells by construction, but a deeper order makes each cell a smaller fraction of the whole figure, so
 * normalising by the whole figure shrank the result by half an octave at a time: mean screen chord
 * **0.43x, 0.20x, 0.10x, 0.05x** against §10's ±15 %. **Fitting the selected piece to the frame is what
 * "travel INTO the curve" means.**
 *
 * ⚠️ **This does NOT reintroduce the per-build pulse `36.D14` refuses, and the reason is the snapping.**
 * The band is aligned to a power-of-two sub-cube boundary, so it changes only when the window crosses
 * one — not every frame. Between crossings the fit is constant and the figure is steady; at a crossing it
 * steps, which is the same bounded discontinuity the angle bracket already has.
 */
function normaliseResolved(
  out: Float64Array,
  count: number,
  pose: LSystemPose,
  held: ExtentTransform,
): void {
  if (pose.descend <= 1) { normaliseInto(out, count, held); return; }
  normaliseInto(out, count, captureExtent(out, count));
}
