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
  angleBracketFor, LSYSTEM_MIN_USEFUL_BRACKET_DEG, ruleAngleUsage, type LSystemRule,
} from './rules.ts';
import {
  buildPose, captureExtent, lerpInto, lerpTransform, normaliseInto, resampleArcInto,
  type ExtentTransform,
} from './curve.ts';
import {
  effectiveRecursion, zoomBandFromWalk, resampleBandInto, type ZoomBand,
} from './zoom.ts';
import {
  buildGenerator, stretchBracketFor, twistBracketFor, type GeneratorFlags,
} from './generator.ts';
import {
  buildCustom, walkCustom, customInitiatorError, customHasBranches, CUSTOM_CELL_YAW, CUSTOM_CELL_PITCH, CUSTOM_RULE_KEY,
  type CustomTile,
} from './custom.ts';
import type { CustomCurveGenerator } from '../../core/interfaces.ts';
import type { BranchData } from './turtle.ts';
import { isStochasticRule } from './rules.ts';

/**
 * v8 Phase 41 (`41.S5`) — **the lowest recursion growth UNFOLDS from.** A builder rule starts from its depth-0
 * segment; a turtle rule from depth 0 when its axiom already draws (≥ one forward symbol), else from its first depth —
 * a non-drawing axiom (`X`, `A`) is a single point at depth 0, and a one-point list cannot be framed.
 */
function unfoldFloor(rule: LSystemRule): number {
  // The tetra's depth 0 is its p0 → p3 segment; the Hill curve's is ONE centre, which cannot be framed — so it starts at 1.
  if (rule.builder === 'tetra') return 0;
  if (rule.builder === 'hill') return 1;
  const draws = /[FG]/.test(rule.axiom) || (rule.drawSymbols.length > 0
    && [...rule.axiom].some((c) => rule.drawSymbols.includes(c)));
  return draws ? 0 : rule.recursionRange[0];
}

/**
 * v8 Phase 41 (owner review 2026-11-15) — **the anchor pair of a list**: its first point and its last, or — on a CLOSED
 * list, where the two coincide — the point farthest from the first (the same fallback `similarityFit` uses).
 */
function anchorPair(x: Float64Array, n: number): [number, number] {
  const last = n - 1;
  const d = Math.hypot(x[last * 3]! - x[0]!, x[last * 3 + 1]! - x[1]!, x[last * 3 + 2]! - x[2]!);
  let ext = 0;
  let far = last, farD = -1;
  for (let i = 1; i < n; i++) {
    const di = Math.hypot(x[i * 3]! - x[0]!, x[i * 3 + 1]! - x[1]!, x[i * 3 + 2]! - x[2]!);
    if (di > ext) ext = di;
    if (di > farD) { farD = di; far = i; }
  }
  return d > 1e-6 * Math.max(ext, 1e-12) ? [0, last] : [0, far];
}

/**
 * v8 Phase 41 (owner review 2026-11-15) — **align a recursion level onto the TARGET level, in place**: the similarity
 * (uniform scale, the MINIMAL rotation, translation) carrying the level's anchor pair onto the target's. ⚠️ This is what
 * makes `unfold` an UNFOLDING: without it each turtle level sits rotated and scaled against the next (the dragon turns
 * 45° and grows √2 per level), so the index lerp between levels swirled one tangle into another. Pinned to the same
 * ends, a level's joints are points of the next level, and the lerp FOLDS each segment out in place (paper folding).
 */
function alignInPlace(x: Float64Array, n: number, t: Float64Array, tn: number): void {
  if (n < 2 || tn < 2) return;
  const [a0, a1] = anchorPair(x, n);
  const [b0, b1] = anchorPair(t, tn);
  const ax = x[a1 * 3]! - x[a0 * 3]!, ay = x[a1 * 3 + 1]! - x[a0 * 3 + 1]!, az = x[a1 * 3 + 2]! - x[a0 * 3 + 2]!;
  const bx = t[b1 * 3]! - t[b0 * 3]!, by = t[b1 * 3 + 1]! - t[b0 * 3 + 1]!, bz = t[b1 * 3 + 2]! - t[b0 * 3 + 2]!;
  const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
  if (!(la > 0) || !(lb > 0)) return;
  const s = lb / la;
  const ux = ax / la, uy = ay / la, uz = az / la, vx = bx / lb, vy = by / lb, vz = bz / lb;
  // Rodrigues: axis u × v, cos = u·v. Antiparallel ⇒ a half turn about any axis perpendicular to u.
  let kx = uy * vz - uz * vy, ky = uz * vx - ux * vz, kz = ux * vy - uy * vx;
  const c = ux * vx + uy * vy + uz * vz;
  let sn = Math.hypot(kx, ky, kz);
  if (sn < 1e-12) {
    if (c > 0) { kx = 0; ky = 0; kz = 1; sn = 0; }
    else { const px = Math.abs(ux) < 0.9 ? 1 : 0, py = px === 1 ? 0 : 1; kx = uy * 0 - uz * py; ky = uz * px - ux * 0; kz = ux * py - uy * px;
      const kl = Math.hypot(kx, ky, kz); kx /= kl; ky /= kl; kz /= kl; sn = 0; }
  } else { kx /= sn; ky /= sn; kz /= sn; }
  const cc = sn === 0 && c < 0 ? -1 : c, ss = sn;
  const ox = x[a0 * 3]!, oy = x[a0 * 3 + 1]!, oz = x[a0 * 3 + 2]!;
  const tx = t[b0 * 3]!, ty = t[b0 * 3 + 1]!, tz = t[b0 * 3 + 2]!;
  for (let i = 0; i < n; i++) {
    const px = (x[i * 3]! - ox) * s, py = (x[i * 3 + 1]! - oy) * s, pz = (x[i * 3 + 2]! - oz) * s;
    const dot = kx * px + ky * py + kz * pz;
    const cxp = ky * pz - kz * py, cyp = kz * px - kx * pz, czp = kx * py - ky * px;
    x[i * 3] = tx + px * cc + cxp * ss + kx * dot * (1 - cc);
    x[i * 3 + 1] = ty + py * cc + cyp * ss + ky * dot * (1 - cc);
    x[i * 3 + 2] = tz + pz * cc + czp * ss + kz * dot * (1 - cc);
  }
}

/** Each node's FIRST list point, computed once per cached list (a parent always precedes its children). */
function nodeFirstPoint(list: CachedList): Int32Array | null {
  const b = list.branch;
  if (b === null || b === undefined) return null;
  if (list.nodePoint !== undefined) return list.nodePoint;
  const np = new Int32Array(b.nodeCount).fill(-1);
  for (let i = 0; i < list.count; i++) {
    const n = b.pointNode[i]!;
    if (np[n] === -1) np[n] = i;
  }
  list.nodePoint = np;
  return np;
}

/**
 * v8 Phase 41 (`41.S5`) — **growth's `extend` mechanism: the branch FRONTIER at `g · tau_max`, written into
 * `cache.growList`** (same length as `src`). Each node's displayed position is resolved in ONE forward pass in node
 * order (a parent precedes its children): on or inside the frontier ⇒ itself; its parent inside but itself outside ⇒
 * the point on its edge AT the frontier; else ⇒ its parent's displayed position. Every tour point then copies its
 * node's. So branches EXTEND from the trunk outwards and, run backwards, retract tips-first (`41.D20`) — and the
 * stroke stays one continuous stroke at every `g`. ⚠️ Allocates nothing per frame (invariant 8).
 */
/**
 * v8 Phase 41 (owner review 2026-11-15) — **each node's ARRIVAL time in [0, 1]: growth by GENERATION.** A node of bracket
 * depth `d` arrives in the window `[d, d + 1] / (D + 1)`, at the fraction of that window its distance along its OWN branch
 * gives (measured from the branch's base, normalised by the longest branch of that depth). So the trunk grows first, the
 * first-order branches sprout from it together and lengthen, then the next order — the book's developmental picture —
 * instead of one frontier racing out from the root (which left the first seconds an empty screen and a bright dot).
 * ⚠️ Monotone along every path (a child's window starts where its parent's ends), so `growExtend`'s one forward pass
 * still extends every branch smoothly and the wither still retracts tips first (`41.D12`/`D20`). Computed once per list.
 */
function nodeArrival(list: CachedList): Float64Array {
  if (list.arrival !== undefined) return list.arrival;
  const b = list.branch!;
  const nodes = b.nodeCount;
  const base = new Int32Array(nodes);
  const local = new Float64Array(nodes);
  const D = Math.max(0, b.maxDepth);
  const maxLocal = new Float64Array(D + 1);
  for (let k = 1; k < nodes; k++) {
    const par = b.parent[k]!;
    base[k] = b.depth[k]! > b.depth[par]! ? par : base[par]!;
    local[k] = b.tau[k]! - b.tau[base[k]!]!;
    const d = b.depth[k]!;
    if (local[k]! > maxLocal[d]!) maxLocal[d] = local[k]!;
  }
  const out = new Float64Array(nodes);
  for (let k = 1; k < nodes; k++) {
    const d = b.depth[k]!;
    const s = maxLocal[d]! > 0 ? local[k]! / maxLocal[d]! : 1;
    out[k] = (d + s) / (D + 1);
  }
  list.arrival = out;
  return out;
}

function growExtend(cache: LSystemFigureCache, src: Float64Array, list: CachedList, n: number, g: number): Float64Array {
  const b = list.branch!;
  const np = nodeFirstPoint(list)!;
  const nodes = b.nodeCount;
  // v8 Phase 41 (owner review) — the frontier is in ARRIVAL time (growth by generation), not raw arc length.
  const arr = nodeArrival(list);
  const T = g;
  cache.growNode = ensure(cache.growNode, nodes * 3);
  cache.growList = ensure(cache.growList, n * 3);
  const disp = cache.growNode;
  for (let k = 0; k < nodes; k++) {
    const t = arr[k]!;
    const pIdx = np[k]!;
    const o = k * 3;
    if (pIdx < 0) { disp[o] = 0; disp[o + 1] = 0; disp[o + 2] = 0; continue; }
    const s = pIdx * 3;
    if (t <= T || k === 0) { disp[o] = src[s]!; disp[o + 1] = src[s + 1]!; disp[o + 2] = src[s + 2]!; continue; }
    const par = b.parent[k]!;
    const po = par * 3;
    const tp = arr[par]!;
    if (tp <= T) {
      const f = t > tp ? (T - tp) / (t - tp) : 0;
      const ps = np[par]! * 3;
      disp[o] = src[ps]! + (src[s]! - src[ps]!) * f;
      disp[o + 1] = src[ps + 1]! + (src[s + 1]! - src[ps + 1]!) * f;
      disp[o + 2] = src[ps + 2]! + (src[s + 2]! - src[ps + 2]!) * f;
    } else {
      disp[o] = disp[po]!; disp[o + 1] = disp[po + 1]!; disp[o + 2] = disp[po + 2]!;
    }
  }
  const out = cache.growList;
  for (let i = 0; i < n; i++) {
    const o = b.pointNode[i]! * 3, d = i * 3;
    out[d] = disp[o]!; out[d + 1] = disp[o + 1]!; out[d + 2] = disp[o + 2]!;
  }
  return out;
}

/**
 * v8 Phase 41 (`41.S6`) — **each particle's normalised branch depth**, by the SAME parameterisation the resample
 * used: arc length when `arc` (then `cum` holds the list's cumulative lengths, left there by `resampleArcInto`),
 * else the index map of `resampleBandInto` over the whole list. Nearest-below list point; written into `cache.depthOut`.
 */
function writeDepths(cache: LSystemFigureCache, list: CachedList, n: number, count: number, arc: boolean): void {
  const b = list.branch;
  if (b === null || b === undefined || b.maxDepth <= 0) { cache.depthValid = false; return; }
  if (cache.depthOut.length < count) cache.depthOut = new Float64Array(count);
  const inv = 1 / b.maxDepth;
  if (arc) {
    const total = cache.cum[n - 1]!;
    let k = 0;
    for (let i = 0; i < count; i++) {
      const u = (i / count) * total;
      while (k < n - 2 && cache.cum[k + 1]! <= u) k++;
      cache.depthOut[i] = b.depth[b.pointNode[k]!]! * inv;
    }
  } else {
    const step = (n - 1) / count;
    for (let i = 0; i < count; i++) {
      const k = Math.min(n - 1, Math.floor(i * step));
      cache.depthOut[i] = b.depth[b.pointNode[k]!]! * inv;
    }
  }
  cache.depthValid = true;
}

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
  /**
   * v8 `39.A3`/`39.A4` — the two generator axes, RESOLVED (degrees / factor), and whether each one is
   * BREATHING. ⚠️ Like `multiAxis`, "animated" is the caller's fact (a non-zero modulation amplitude); this
   * module sees only resolved values and must not infer motion from frame-to-frame change.
   */
  readonly twist: number;
  readonly stretch: number;
  readonly anglesAnimated: boolean;
  readonly twistAnimated: boolean;
  readonly stretchAnimated: boolean;
  /** The rule's generator flags, or null where the turtle is the only builder (`LSYSTEM_GENERATORS`). */
  readonly generator: GeneratorFlags | null;
  /**
   * v8 `39.C` -- a `Customize` generator that is NOT structurally a named rule (`resolveCustomRule`), or null.
   * When set, `rule` is only a placeholder and is never read: the custom path takes its ranges from here.
   */
  readonly custom?: { readonly gen: CustomCurveGenerator; readonly tile: CustomTile | null; readonly maxDepth: number } | null;
  /**
   * v8 Phase 41 (`41.S5`) — **the growth progress `g` in [0, 1], or null/absent when growth is OFF.** ⚠️⚠️ Off is a
   * BRANCH: absent/null runs every line below exactly as before (bit-identical), and so does `g >= 1` — a fully grown
   * figure is the static figure, never the mechanism at its end. The caller owns the timeline and the easing.
   */
  readonly growth?: number | null;
  /** v8 Phase 41 (`41.S2`) — the stochastic rule's EFFECTIVE seed (a deterministic rule ignores it). */
  readonly seed?: number;
  /** v8 Phase 41 (`41.S6`) — publish each particle's normalised branch depth in `cache.depthOut` (the taper's input). */
  readonly wantDepth?: boolean;
}

interface CachedList {
  /** RAW turtle output -- un-normalised. The transform travels beside it, unapplied. */
  xyz: Float64Array;
  count: number;
  transform: ExtentTransform;
  /** v8 Phase 41 — the branch tree behind a BRACKETED turtle list (growth's `extend`, the taper), else absent/null. */
  branch?: BranchData | null;
  /** v8 Phase 41 — each node's FIRST list point, derived lazily from `branch.pointNode` (`nodeFirstPoint`). */
  nodePoint?: Int32Array;
  /** v8 Phase 41 — each node's growth ARRIVAL time in [0, 1] (`nodeArrival`), derived lazily. */
  arrival?: Float64Array;
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
  /**
   * v8 Phase 44 (`44.B2.4`) — **the rule OBJECT the turtle lists were built for.** ⚠️⚠️ A plant's edited productions
   * resolve to a SYNTHESIZED rule carrying the family's KEY, so a key-compared cache would hand an edited Fork Tree the
   * named Fork Tree's lists — the edit would silently draw the old plant. Library rules are singletons, so comparing
   * identity changes nothing for them; a synthesized rule is a new object per edit.
   */
  ruleRef: LSystemRule | null;

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
   * v8 `39.A1` — the generator path's own corner state: whether the corners were built by the GENERATOR,
   * which axis is bracketed, and the corners' twist/stretch. ⚠️ Part of the cache key: the turtle path and
   * the generator path must never share corners, and flipping between them must force a rebuild.
   */
  genOn: boolean;
  genAxis: 'none' | 'angles' | 'twist' | 'stretch';
  shapeLo: [number, number];
  shapeHi: [number, number];
  /** Arc-length scratch for `resampleArcInto` (invariant 8: a field, never a per-frame array). */
  cum: Float64Array;
  /**
   * v8 `39` smoothness — **every bracket-corner list built for this rule, memoised (LRU, size-bounded).** A
   * breathing value sweeps back and forth over the SAME bracket edges, so without this each cycle rebuilt the
   * same four lists at every crossing — a 12-24 ms frame, i.e. a visible hitch (`p53-frame-cost.mjs`). A build
   * is deterministic, so a hit returns exactly the list a rebuild would: the figure cannot change.
   */
  lists: Map<string, CachedList>;
  listFloats: number;
  /** The previous frame's value on the bracketed axis and recursion, for the prefetch's direction. */
  prevAxis: number;
  prevRec: number;
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
  /**
   * v8 `39.C` -- the custom generator the lists were built from (identity first, then its JSON as the real key),
   * and the live validation failure while the figure is held on its last valid build (spec 7.3), or null.
   */
  customRef: CustomCurveGenerator | null;
  customSig: string;
  customError: string | null;
  /**
   * v8 CPU pass (2026-11-10) — **the custom lists' REUSED arrays, one per depth, for a curve that is NOT still.** Such
   * a list is never memoised (`memoList`'s `keep` is false), so it lives one frame; reusing its array avoids ~0.9 MB of
   * large-object allocation per frame, which measured as a 2–6 ms Mark-Compact pause every ~70 frames on
   * `Chaos to Order`. ⚠️ **Never for a memoised list** — the memo keeps its array, and a reused one would be
   * overwritten under it. Bounded: one array per depth up to the rule's `maxDepth`.
   */
  customScratch: Map<number, Float64Array>;
  /*
   * v8 Phase 41 (`41.S5`/`41.S6`) — growth and taper scratch, FIELDS (invariant 8: the growth pass runs per frame and
   * allocates nothing). `growNode` holds each node's displayed position, `growList` the grown tour.
   */
  growNode: Float64Array;
  growList: Float64Array;
  /** Each particle's branch depth in [0, 1] (0 = trunk), valid for `count` entries while `depthValid`. */
  depthOut: Float64Array;
  depthValid: boolean;
  /** v8 Phase 41 — the unfold TARGET (the finished level at the exact angle), scratch. */
  unfoldXYZ: Float64Array;
}

export function createFigureCache(): LSystemFigureCache {
  return {
    ruleKey: null,
    ruleRef: null,
    depthLo: -1,
    loAtAngleLo: null, loAtAngleHi: null, hiAtAngleLo: null, hiAtAngleHi: null,
    angleLo: [0, 0, 0], angleHi: [0, 0, 0], bracketWidth: 0,
    genOn: false, genAxis: 'none', shapeLo: [0, 1], shapeHi: [0, 1], cum: new Float64Array(0),
    lists: new Map(), listFloats: 0, prevAxis: NaN, prevRec: NaN,
    blendLo: new Float64Array(0), blendHi: new Float64Array(0),
    bufLo: new Float64Array(0), bufHi: new Float64Array(0),
    capacity: 0,
    truncated: false,
    rebuilds: 0,
    band: null,
    zoomClamped: false,
    customRef: null,
    customSig: '',
    customError: null,
    customScratch: new Map(),
    growNode: new Float64Array(0),
    growList: new Float64Array(0),
    depthOut: new Float64Array(0),
    depthValid: false,
    unfoldXYZ: new Float64Array(0),
  };
}

/**
 * The memo's size bound, in doubles (8 bytes each): 3 M doubles = 24 MB. ⚠️ Sized for the worst shipped case —
 * a few dozen deep lists — and LRU beyond it, so a long session cannot grow without bound.
 */
const LIST_CACHE_MAX_FLOATS = 3_000_000;

/** Fetch a corner list from the memo, building it (and evicting the least recently used) on a miss. */
function memoList(cache: LSystemFigureCache, key: string, build: () => CachedList, keep: boolean): CachedList {
  const hit = cache.lists.get(key);
  if (hit !== undefined) {
    cache.lists.delete(key);           // re-insert = most recently used
    cache.lists.set(key, hit);
    return hit;
  }
  const v = build();
  cache.rebuilds++;
  // ⚠️ A list built at an EXACT, moving value is never asked for again, so storing it would only churn the memo.
  if (!keep) return v;
  cache.lists.set(key, v);
  cache.listFloats += v.xyz.length;
  while (cache.listFloats > LIST_CACHE_MAX_FLOATS && cache.lists.size > 1) {
    const oldest = cache.lists.keys().next().value as string;
    cache.listFloats -= cache.lists.get(oldest)!.xyz.length;
    cache.lists.delete(oldest);
  }
  return v;
}

/**
 * Build at most ONE missing list per frame, in the direction the value is moving, so the next bracket crossing
 * finds its lists ready. ⚠️ Only on a frame that built nothing itself — a prefetch on a rebuild frame would
 * deepen exactly the spike it exists to remove.
 */
function prefetchOne(cache: LSystemFigureCache, candidates: [string, () => CachedList][]): void {
  for (const [key, build] of candidates) {
    if (cache.lists.has(key)) continue;
    memoList(cache, key, build, true);
    return;
  }
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
  // v8 Phase 41 — growth progress; null = OFF (a branch). `g >= 1` is the static figure, so it is OFF here too.
  const gRaw = pose.growth ?? null;
  const g = gRaw !== null && gRaw < 1 && pose.descend <= 1 ? Math.max(0, gRaw) : null;
  cache.depthValid = false;
  // v8 `39.C` -- a custom generator takes its own path; nothing below reads `pose.rule` for it.
  if (pose.custom !== undefined && pose.custom !== null) {
    /*
     * v8 Phase 41 — a Customize curve UNFOLDS from its first level (its path lerps levels from depth 1). ⚠️ v8 Phase 44
     * (`44.A2`): one that BRANCHES (a retrace step — an edited plant) GROWS BY GENERATION instead, on the branch tree
     * `customBranches` builds; Descend owns the recursion, so a zoom keeps it static (`g` is already null there).
     */
    const extendCustom = g !== null && customHasBranches(pose.custom.gen);
    const cp = g === null || extendCustom ? pose
      : { ...pose, recursion: 1 + g * (Math.min(pose.custom.maxDepth, Math.max(1, pose.recursion)) - 1) };
    resolveCustomFigure(cache, cp, pose.custom, out, count, extendCustom ? g : null);
    return;
  }
  const rule = pose.rule;

  // --- a rule change invalidates every transform and both brackets.
  if (cache.ruleKey !== rule.key || cache.ruleRef !== rule) {
    cache.ruleKey = rule.key;
    cache.ruleRef = rule;
    cache.depthLo = -1;                       // force a rebuild of both brackets
    cache.lists.clear();
    cache.listFloats = 0;
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
   * eight. **Seven octaves would be a multi-second stall.** So the ceiling is `recursionRange[1] + 1`,
   * which buys **one octave of genuinely new detail** — stated here rather than discovered, and surfaced to
   * the user through `zoomClamped`. ⚠️ It was `+ 2` until `39.A6(b)` measured the octave-crossing rebuild.
   */
  const rMin = rule.recursionRange[0];
  const rMax = rule.recursionRange[1];
  // ⚠️ v8 `39.A6(b)`: `+ 1`, not `+ 2` -- measured, the rebuild at an octave crossing is 6.5-11 ms at rMax+1
  // and 24-260 ms at rMax+2 (hilbert3d / hilbert2d / peano, p39a6-b-cost.mjs), a visible hitch every octave.
  const zoomCeiling = rMax + 1;
  /*
   * ⚠️⚠️ **`zoomCeiling` IS THE ONLY CEILING AND IT IS PASSED IN — see `effectiveRecursion`'s header.**
   * A flat `ZOOM_MAX_EFFECTIVE_RECURSION = 8` used to be applied inside that function as well, which
   * capped the USER's Recursion row (not just the zoom) and silently cost `levyC`/`knopp` levels 9-14
   * and `dragon` levels 9-13. Two ceilings in two places with `zoomClamped` OR-ing the second is what
   * made it survive; one ceiling applied once is what makes `clamped` trustworthy.
   */
  const userRec = Math.min(rMax, Math.max(rMin, pose.recursion));
  const eff = effectiveRecursion(userRec, pose.descend, zoomCeiling, rule.zoomBase ?? 2);
  /*
   * v8 Phase 41 (`41.S5`) — which growth mechanism. `extend` needs the branch TREE, which only the TURTLE path's
   * bracketed lists carry; everything else — an unbranched rule, a builder rule, and a bracketed rule while the
   * GENERATOR path runs (Twist/Stretch in use) — UNFOLDS: the recursion itself rises from `unfoldFloor` (below the
   * rule's own `recursionRange` on purpose — a seed is shallower than any shipped depth).
   */
  const genPath = (pose.generator ?? null) !== null && pose.descend <= 1
    && ((pose.twist ?? 0) !== 0 || (pose.stretch ?? 1) !== 1 || pose.twistAnimated === true
      || pose.stretchAnimated === true);
  const extend = g !== null && rule.bracketed && !genPath;
  const unfoldFrom = unfoldFloor(rule);
  const rec = g !== null && !extend ? unfoldFrom + g * (userRec - unfoldFrom) : eff.order;
  cache.zoomClamped = eff.clamped;
  const depthLo = Math.min(zoomCeiling, Math.floor(rec));
  const depthFrac = rec - depthLo;
  const needHi = depthFrac > 0 && depthLo + 1 <= zoomCeiling;

  /*
   * v8 `39.A1` — **THE GENERATOR PATH, TAKEN ONLY WHILE `Twist` OR `Stretch` IS IN USE.** At the identity
   * (twist 0, stretch 1, neither breathing) the turtle code below runs exactly as before, which is what keeps
   * every shipped curve preset bit-identical. ⚠️ **`Descend` wins (`39.D9`)**: with the zoom on, the shape
   * axes are ignored here, because the zoom's contiguous index band exists only at the space-filling shape.
   */
  // ⚠️ Every Phase 39 field is read at its IDENTITY when absent (`?? null`, `?? 0`, `?? 1`): a caller written
  // before the phase (`figurecheck`'s poses are) must take the turtle path, never the generator by accident.
  const gen = pose.generator ?? null;
  if (gen !== null && pose.descend <= 1
    && ((pose.twist ?? 0) !== 0 || (pose.stretch ?? 1) !== 1 || pose.twistAnimated === true
      || pose.stretchAnimated === true)) {
    resolveGenerated(cache, pose, gen, out, count, depthLo, depthFrac, needHi, zoomCeiling);
    return;
  }

  // --- the angle bracket. Snapped to a grid so the corners do not drift with the input, which would
  // rebuild on every frame of a slow drift and defeat the whole mechanism.
  // ⚠️ The width is PER RULE and solved against a stated error budget — see `LSYSTEM_ANGLE_BRACKET`.
  // A single shared width is wrong by up to 20x across the rule set.
  const bracket = angleBracketFor(rule);
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

  // The memo key and builder for one TURTLE corner. ⚠️ Kept only when the corner sits on a bracket grid or the
  // angles are still — a corner at an exact, moving angle is never asked for twice.
  // v8 Phase 41 — a STOCHASTIC rule's list depends on the seed, so the seed is part of its key (and only of its key:
  // a deterministic rule's keys are unchanged, so its memo behaves exactly as before).
  const seed = isStochasticRule(rule) ? Math.floor(pose.seed ?? 1) : 0;
  const seedTag = isStochasticRule(rule) ? `|s${seed}` : '';
  const turtleKey = (depth: number, a: readonly number[]): string => `t|${depth}|${a[0]}|${a[1]}|${a[2]}${seedTag}`;
  const turtleBuild = (depth: number, a: readonly number[]): CachedList => {
    const p = buildPose(rule, depth, a[0]!, a[1]!, a[2]!, seed);
    if (p.truncated) cache.truncated = true;
    return { xyz: p.xyz, count: p.count, transform: p.transform, branch: p.branch };
  };
  const keepTurtle = useBracket || pose.anglesAnimated === false;
  const rebuildsBefore = cache.rebuilds;

  // ⚠️ `cache.genOn`: corners left by the GENERATOR path are not turtle corners, so leaving that path
  // must rebuild even when the angles and depth did not move.
  if (angleMoved || depthMoved || cache.loAtAngleLo === null || cache.genOn) {
    cache.genOn = false;
    cache.genAxis = 'none';
    cache.angleLo = [yLo, pLo, rLo];
    cache.angleHi = [yLo + w, pLo + w, rLo + w];
    cache.bracketWidth = w;
    cache.depthLo = depthLo;
    cache.truncated = false;

    const buildAt = (depth: number, a: [number, number, number]): CachedList =>
      memoList(cache, turtleKey(depth, a), () => turtleBuild(depth, a), keepTurtle);
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

  /*
   * --- the PREFETCH: on a frame that built nothing, build the next corner the motion will need — the next
   * angle bracket in the direction of travel, at both depths, then the next recursion level. One build a frame.
   */
  if (cache.rebuilds === rebuildsBefore && keepTurtle) {
    const cand: [string, () => CachedList][] = [];
    const dirA = Math.sign(pose.yaw - cache.prevAxis);
    if (useBracket && dirA !== 0) {
      const off = dirA > 0 ? 2 * w : -w;
      const a = [yLo + off, pLo + off, rLo + off];
      for (const d of [depthLo, depthLo + 1]) {
        if (d <= zoomCeiling) cand.push([turtleKey(d, a), () => turtleBuild(d, a)]);
      }
    }
    const dirR = Math.sign(rec - cache.prevRec);
    const dNext = dirR > 0 ? depthLo + 2 : dirR < 0 ? depthLo - 1 : NaN;
    if (Number.isFinite(dNext) && dNext >= 1 && dNext <= zoomCeiling) {
      for (const a of [cache.angleLo, cache.angleHi]) cand.push([turtleKey(dNext, a), () => turtleBuild(dNext, a)]);
    }
    prefetchOne(cache, cand);
  }
  cache.prevAxis = pose.yaw;
  cache.prevRec = rec;

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
   * v8 Phase 41 (owner review 2026-11-15) — **while a curve UNFOLDS, every level is pinned to the TARGET level's ends**
   * (`alignInPlace`) and the whole figure is framed by the TARGET's transform, so the curve keeps its place and size and
   * each segment folds out into the next level in place. Off the growth branch none of this runs.
   */
  const targetDepth = Math.min(zoomCeiling, Math.max(unfoldFrom, Math.floor(userRec)));
  /*
   * ⚠️ The target is the finished figure AT THE EXACT ANGLE — the same corner blend the static path draws (`tAngle`), not
   * the lower corner alone: on a bracketed rule (dragon, Koch) the lower corner sits up to a bracket width off, and the
   * curve's ends drifted 0.05 while it unfolded and missed the static figure at the end (`figurecheck` §R / §P6).
   */
  let unfoldTarget: { xyz: Float64Array; count: number; transform: ExtentTransform } | null = null;
  if (g !== null && !extend) {
    const tLo = memoList(cache, turtleKey(targetDepth, cache.angleLo), () => turtleBuild(targetDepth, cache.angleLo), true);
    const tHi = useBracket ? memoList(cache, turtleKey(targetDepth, cache.angleHi), () => turtleBuild(targetDepth, cache.angleHi), true) : tLo;
    const tn = Math.min(tLo.count, tHi.count);
    cache.unfoldXYZ = ensure(cache.unfoldXYZ, tn * 3);
    lerpInto(cache.unfoldXYZ, tn, tLo.xyz, tHi.xyz, tAngle);
    unfoldTarget = { xyz: cache.unfoldXYZ, count: tn, transform: lerpTransform(tLo.transform, tHi.transform, tAngle) };
  }
  if (unfoldTarget !== null) alignInPlace(cache.blendLo, nLo, unfoldTarget.xyz, unfoldTarget.count);
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
  /*
   * v8 Phase 41 (`41.S5`) — **while a bracketed figure GROWS, its list is cut at the branch frontier and resampled by
   * ARC LENGTH**, so the particles sit only on the visible part (a collapsed edge has zero length and gets none). Off
   * the growth branch this is exactly the code that was here. ⚠️ The transform stays the FULL list's, so the plant
   * grows in place rather than being re-fitted to the frame at every instant.
   */
  const growInto = (dst: Float64Array, blend: Float64Array, n: number, list: CachedList): boolean => {
    /*
     * v8 Phase 41 — a rule with UNEQUAL steps (the Hill curve's centres, ratio 5 : 1) is resampled by ARC LENGTH always:
     * index resampling would bunch its particles on the short steps (`curve.ts` names this case). No other rule
     * declares the flag, so every other list takes exactly the path it took before.
     */
    if (rule.unequalSteps === true && pose.descend <= 1) {
      if (cache.cum.length < n) cache.cum = new Float64Array(n);
      resampleArcInto(dst, count, blend, n, pose.smoothness, cache.cum);
      return true;
    }
    if (!extend || g === null || list.branch === null || list.branch === undefined) return false;
    const grown = growExtend(cache, blend, list, n, g);
    if (cache.cum.length < n) cache.cum = new Float64Array(n);
    resampleArcInto(dst, count, grown, n, pose.smoothness, cache.cum);
    return true;
  };
  const bandLo = zoomBand(cache, pose, cache.blendLo, nLo);
  const arcLo = growInto(cache.bufLo, cache.blendLo, nLo, lA);
  // ⚠️ The BRANCH (`36.D10`): at 0 the spline is never evaluated and never multiplied.
  if (arcLo) { /* grown above */ }
  else if (pose.smoothness > 0) resampleSmoothBandInto(cache.bufLo, count, cache.blendLo, bandLo, pose.smoothness);
  else resampleBandInto(cache.bufLo, count, cache.blendLo, bandLo.lo, bandLo.hi);
  // v8 Phase 41 (`41.S6`) — the taper's input, by the same parameterisation, before the hi list reuses `cum`.
  if (pose.wantDepth === true && nLo > 1) writeDepths(cache, lA, nLo, count, arcLo);

  if (!needHi || cache.hiAtAngleLo === null || cache.hiAtAngleHi === null) {
    out.set(cache.bufLo.subarray(0, count * 3));
    normaliseResolved(out, count, pose, unfoldTarget !== null ? unfoldTarget.transform
      : lerpTransform(lA.transform, lB.transform, tAngle));
    return;
  }

  const hA = cache.hiAtAngleLo;
  const hB = cache.hiAtAngleHi;
  const nHi = Math.min(hA.count, hB.count);
  cache.blendHi = ensure(cache.blendHi, nHi * 3);
  lerpInto(cache.blendHi, nHi, hA.xyz, hB.xyz, tAngle);
  if (unfoldTarget !== null) alignInPlace(cache.blendHi, nHi, unfoldTarget.xyz, unfoldTarget.count);
  const bandHi = zoomBand(cache, pose, cache.blendHi, nHi);
  if (growInto(cache.bufHi, cache.blendHi, nHi, hA)) { /* grown */ }
  else if (pose.smoothness > 0) resampleSmoothBandInto(cache.bufHi, count, cache.blendHi, bandHi, pose.smoothness);
  else resampleBandInto(cache.bufHi, count, cache.blendHi, bandHi.lo, bandHi.hi);

  // --- the RECURSION lerp, at BUFFER level: the two levels have different list lengths, so they can
  // only be combined after each has been resampled to the common particle count. Both depend solely on
  // `i / count`, which is what makes them precomputable at all.
  lerpInto(out, count, cache.bufLo, cache.bufHi, depthFrac);

  // --- and ONE normalisation at the end, using the transform bilinearly lerped over the same four
  // corners and the same two fractions. ⚠️ **This is what keeps the figure FRAMED without making the
  // lerp carry a fit mismatch** -- see `buildPose`'s header for the two mechanisms this replaced.
  normaliseResolved(out, count, pose, unfoldTarget !== null ? unfoldTarget.transform : lerpTransform(
    lerpTransform(lA.transform, lB.transform, tAngle),
    lerpTransform(hA.transform, hB.transform, tAngle),
    depthFrac,
  ));
}

/**
 * v8 `39.A1`/`39.A3`/`39.A4` — **the generator path of `resolveFigure`**: the same two-level structure
 * (a list-level lerp across ONE bracketed axis, a buffer-level lerp across recursion, one normalisation by
 * the bilinearly lerped held transform), with the corners built by `buildGenerator`.
 *
 * ⚠️⚠️ **EXACTLY ONE SHAPE AXIS IS BRACKETED, AND ONLY IF IT IS THE ONLY ONE BREATHING.** The angle, twist and
 * stretch brackets were each solved with the other two HELD, so a bracket across one axis says nothing about
 * the error while a second axis moves under it. With two or more breathing the corners are built at the
 * EXACT values every frame — correct, and affordable because the generator builds 1.3–6.6x faster than the
 * turtle at the top of every range (`p39a0-parity.mjs`). With none breathing it builds once and holds.
 *
 * ⚠️ **A generator with no chord** (Lévy C / Knopp at exactly 90°, spec §2.5's V2) falls back to the turtle
 * corner for that build — §7.3's *"keep the last valid build"* in the form a named rule needs.
 */
function resolveGenerated(
  cache: LSystemFigureCache,
  pose: LSystemPose,
  gen: GeneratorFlags,
  out: Float64Array,
  count: number,
  depthLo: number,
  depthFrac: number,
  needHi: boolean,
  zoomCeiling: number,
): void {
  const rule = pose.rule;
  /*
   * ⚠️⚠️ **A CELL RULE HOLDS ITS TURN ANGLES AT THE LATTICE WHILE THIS PATH RUNS (owner, `39.Q2` (c)).** Its tiles
   * exist only at the landmark, so Twist and Yaw are mutually exclusive exactly as Descend and the shape axes
   * are (`39.D9`); the Composer disables the Yaw rows while Twist is in use and says why.
   */
  const held = gen.cells !== undefined;
  const yaw = held ? rule.publishedAngle : pose.yaw;
  const pitch = held ? rule.publishedAngle : pose.pitch;
  const roll = held ? rule.publishedAngle : pose.roll;
  const anglesAnimated = held ? false : pose.anglesAnimated;
  const anim = (anglesAnimated ? 1 : 0) + (pose.twistAnimated ? 1 : 0) + (pose.stretchAnimated ? 1 : 0);
  let axis: 'none' | 'angles' | 'twist' | 'stretch' = 'none';
  let w = 0;
  if (anim === 1) {
    if (anglesAnimated) {
      const b = angleBracketFor(rule);
      const half = pose.multiAxis ? b.multi : b.yaw;
      if (half >= LSYSTEM_MIN_USEFUL_BRACKET_DEG) { axis = 'angles'; w = half * 2; }
    } else if (pose.twistAnimated) {
      const half = twistBracketFor(rule);
      if (half > 0) { axis = 'twist'; w = half * 2; }
    } else {
      const half = stretchBracketFor(rule);
      if (half > 0) { axis = 'stretch'; w = half * 2; }
    }
  }
  const yLo = axis === 'angles' ? bracketFloor(yaw, w) : yaw;
  const pLo = axis === 'angles' ? bracketFloor(pitch, w) : pitch;
  const rLo = axis === 'angles' ? bracketFloor(roll, w) : roll;
  const tLo = axis === 'twist' ? bracketFloor(pose.twist, w) : pose.twist;
  const sLo = axis === 'stretch' ? bracketFloor(pose.stretch, w) : pose.stretch;

  // The memo key and builder for one GENERATOR corner (the key is disjoint from the turtle's by its prefix).
  const genKey = (depth: number, a: readonly number[], s: readonly number[]): string =>
    `g|${depth}|${a[0]}|${a[1]}|${a[2]}|${s[0]}|${s[1]}`;
  const genBuild = (depth: number, a: readonly number[], s: readonly number[]): CachedList => {
    const g = buildGenerator(rule, gen, depth, a[0]!, a[1]!, a[2]!, s[0]!, s[1]!);
    if (g === null) {
      const p = buildPose(rule, depth, a[0]!, a[1]!, a[2]!);
      if (p.truncated) cache.truncated = true;
      return { xyz: p.xyz, count: p.count, transform: p.transform };
    }
    const xyz = g.xyz.length === g.count * 3 ? g.xyz : g.xyz.slice(0, g.count * 3);
    return { xyz, count: g.count, transform: captureExtent(xyz, g.count) };
  };
  const rebuildsBefore = cache.rebuilds;

  const moved = !cache.genOn || cache.genAxis !== axis || cache.bracketWidth !== w
    || cache.depthLo !== depthLo || cache.loAtAngleLo === null
    || cache.angleLo[0] !== yLo || cache.angleLo[1] !== pLo || cache.angleLo[2] !== rLo
    || cache.shapeLo[0] !== tLo || cache.shapeLo[1] !== sLo;
  if (moved) {
    cache.genOn = true;
    cache.genAxis = axis;
    cache.bracketWidth = w;
    cache.depthLo = depthLo;
    cache.truncated = false;
    const aw = axis === 'angles' ? w : 0;
    cache.angleLo = [yLo, pLo, rLo];
    cache.angleHi = [yLo + aw, pLo + aw, rLo + aw];
    cache.shapeLo = [tLo, sLo];
    cache.shapeHi = [tLo + (axis === 'twist' ? w : 0), sLo + (axis === 'stretch' ? w : 0)];
    const buildAt = (depth: number, a: [number, number, number], s: [number, number]): CachedList =>
      memoList(cache, genKey(depth, a, s), () => genBuild(depth, a, s), anim <= 1);
    const bracketed = axis !== 'none';
    cache.loAtAngleLo = buildAt(depthLo, cache.angleLo, cache.shapeLo);
    cache.loAtAngleHi = bracketed ? buildAt(depthLo, cache.angleHi, cache.shapeHi) : cache.loAtAngleLo;
    if (depthLo + 1 <= zoomCeiling) {
      cache.hiAtAngleLo = buildAt(depthLo + 1, cache.angleLo, cache.shapeLo);
      cache.hiAtAngleHi = bracketed ? buildAt(depthLo + 1, cache.angleHi, cache.shapeHi) : cache.hiAtAngleLo;
    } else {
      cache.hiAtAngleLo = null;
      cache.hiAtAngleHi = null;
    }
  }
  cache.band = null;

  // --- the PREFETCH, as on the turtle path: the next bracket along the moving axis, then the next recursion level.
  const axisValue = axis === 'angles' ? yaw : axis === 'twist' ? pose.twist : axis === 'stretch' ? pose.stretch : NaN;
  if (cache.rebuilds === rebuildsBefore && anim <= 1) {
    const cand: [string, () => CachedList][] = [];
    const dirA = Math.sign(axisValue - cache.prevAxis);
    if (axis !== 'none' && dirA !== 0) {
      const off = dirA > 0 ? 2 * w : -w;
      const a: [number, number, number] = axis === 'angles' ? [yLo + off, pLo + off, rLo + off] : [yLo, pLo, rLo];
      const s: [number, number] = [tLo + (axis === 'twist' ? off : 0), sLo + (axis === 'stretch' ? off : 0)];
      for (const d of [depthLo, depthLo + 1]) {
        if (d <= zoomCeiling) cand.push([genKey(d, a, s), () => genBuild(d, a, s)]);
      }
    }
    prefetchOne(cache, cand);
  }
  cache.prevAxis = axisValue;

  if (cache.capacity < count) {
    cache.bufLo = new Float64Array(count * 3);
    cache.bufHi = new Float64Array(count * 3);
    cache.capacity = count;
  }
  const lA = cache.loAtAngleLo;
  const lB = cache.loAtAngleHi;
  if (lA === null || lB === null) { out.fill(0, 0, count * 3); return; }

  const t = axis === 'angles' ? (yaw - cache.angleLo[0]) / w
    : axis === 'twist' ? (pose.twist - cache.shapeLo[0]) / w
      : axis === 'stretch' ? (pose.stretch - cache.shapeLo[1]) / w : 0;
  // ⚠️ ARC LENGTH only while the step lengths are unequal, i.e. while Stretch is off its identity (`39.A2`).
  const arc = pose.stretch !== 1 || pose.stretchAnimated;
  const resampleList = (dst: Float64Array, src: Float64Array, n: number): void => {
    if (arc) {
      if (cache.cum.length < n) cache.cum = new Float64Array(n);
      resampleArcInto(dst, count, src, n, pose.smoothness, cache.cum);
    } else if (pose.smoothness > 0) {
      resampleSmoothBandInto(dst, count, src, { lo: 0, hi: n - 1, contiguous: true, clamped: false }, pose.smoothness);
    } else {
      resampleBandInto(dst, count, src, 0, n - 1);
    }
  };

  const nLo = Math.min(lA.count, lB.count);
  cache.blendLo = ensure(cache.blendLo, nLo * 3);
  lerpInto(cache.blendLo, nLo, lA.xyz, lB.xyz, t);
  resampleList(cache.bufLo, cache.blendLo, nLo);

  if (!needHi || cache.hiAtAngleLo === null || cache.hiAtAngleHi === null) {
    out.set(cache.bufLo.subarray(0, count * 3));
    normaliseInto(out, count, lerpTransform(lA.transform, lB.transform, t));
    return;
  }
  const hA = cache.hiAtAngleLo;
  const hB = cache.hiAtAngleHi;
  const nHi = Math.min(hA.count, hB.count);
  cache.blendHi = ensure(cache.blendHi, nHi * 3);
  lerpInto(cache.blendHi, nHi, hA.xyz, hB.xyz, t);
  resampleList(cache.bufHi, cache.blendHi, nHi);
  lerpInto(out, count, cache.bufLo, cache.bufHi, depthFrac);
  normaliseInto(out, count, lerpTransform(
    lerpTransform(lA.transform, lB.transform, t),
    lerpTransform(hA.transform, hB.transform, t),
    depthFrac,
  ));
}

/**
 * v8 `39.C2` — **the `Customize` path**: the same two-level structure as the named paths (two recursion levels,
 * lerped at buffer level, one normalisation by the lerped held transform), with lists built by `buildCustom`.
 *
 * ⚠️⚠️ **NO SHAPE BRACKET.** The named rules' brackets are SOLVED per rule against an error budget; a custom
 * generator has no solved width, and a guessed one is exactly the tolerance invariant 27 forbids picking. So a
 * breathing Yaw / Pitch / Twist / Stretch rebuilds at the EXACT value every frame — affordable because the
 * recursion bound is DERIVED from `CUSTOM_SEGMENT_BUDGET` — and a still figure builds once and is memoised.
 *
 * ⚠️ **An invalid generator keeps the LAST VALID build (spec §7.3)** and reports why in `cache.customError`: a
 * breathing Yaw can pass through an angle where the path closes, and the figure must hold rather than vanish.
 *
 * ⚠️ **`Descend` only in `cells` mode, at the space-filling shape (`39.D9`)**: Twist 0, Stretch 1, nothing
 * breathing among them — the contiguous index band is a spatial window only there. The zoom octave is the tile's
 * own subdivision factor `s` (spec §2.6.2).
 */
function resolveCustomFigure(
  cache: LSystemFigureCache,
  pose: LSystemPose,
  c: { readonly gen: CustomCurveGenerator; readonly tile: CustomTile | null; readonly maxDepth: number },
  out: Float64Array,
  count: number,
  gExt: number | null = null,
): void {
  const gen = c.gen;
  // v8 Phase 44 (`44.A2`) — a branching generator carries its tree on every list (growth by generation, the taper).
  const branches = customHasBranches(gen);
  if (cache.customRef !== gen || cache.ruleKey !== CUSTOM_RULE_KEY) {
    const sig = JSON.stringify(gen);
    if (cache.ruleKey !== CUSTOM_RULE_KEY || cache.customSig !== sig) {
      cache.ruleKey = CUSTOM_RULE_KEY;
      cache.ruleRef = null;
      cache.customSig = sig;
      cache.lists.clear();
      cache.listFloats = 0;
      cache.depthLo = -1;
      cache.loAtAngleLo = null; cache.loAtAngleHi = null;
      cache.hiAtAngleLo = null; cache.hiAtAngleHi = null;
    }
    cache.customRef = gen;
  }
  cache.genOn = true;
  cache.genAxis = 'none';
  const cells = gen.draw === 'cells' && c.tile !== null;
  const yaw = cells ? CUSTOM_CELL_YAW : pose.yaw;
  const pitch = cells ? CUSTOM_CELL_PITCH : pose.pitch;
  const twist = pose.twist ?? 0;
  const stretch = pose.stretch ?? 1;
  // ⚠️ No zoom with a STARTING SHAPE: the band arithmetic assumes ONE tile's grid, and a closed starting shape (Moore)
  // lays several tiles side by side, so a contiguous index window would no longer be a spatial one.
  const zoomOn = cells && gen.initiator === undefined && pose.descend > 1 && twist === 0 && stretch === 1
    && pose.twistAnimated !== true && pose.stretchAnimated !== true;
  const userRec = Math.min(c.maxDepth, Math.max(1, pose.recursion));
  const ceiling = zoomOn ? c.maxDepth + 1 : c.maxDepth;
  const eff = zoomOn ? effectiveRecursion(userRec, pose.descend, ceiling, c.tile!.s) : { order: userRec, clamped: false };
  cache.zoomClamped = eff.clamped;
  const depthLo = Math.min(ceiling, Math.max(1, Math.floor(eff.order)));
  const depthFrac = eff.order - depthLo;
  const needHi = depthFrac > 0 && depthLo + 1 <= ceiling;

  const { walk, validation: v0 } = walkCustom(gen, yaw, pitch, stretch);
  const initErr = customInitiatorError(gen, yaw, pitch, stretch);
  const validation = initErr !== null ? { ok: false, error: initErr, warning: null } : v0;
  cache.customError = validation.error;
  const still = pose.anglesAnimated !== true && pose.twistAnimated !== true && pose.stretchAnimated !== true;
  const key = (d: number): string => `c|${d}|${yaw}|${pitch}|${twist}|${stretch}`;
  const build = (d: number): CachedList => {
    // A list that is not kept reuses its depth's array (`customScratch`); a kept one gets its own.
    const into = still ? null : (cache.customScratch.get(d) ?? null);
    const b = buildCustom(gen, d, yaw, pitch, twist, stretch, cells ? c.tile : null, into, branches)!;
    if (!still) cache.customScratch.set(d, b.xyz);
    return { xyz: b.xyz, count: b.count, transform: captureExtent(b.xyz, b.count), branch: b.branch ?? null };
  };
  if (validation.ok) {
    cache.depthLo = depthLo;
    cache.loAtAngleLo = memoList(cache, key(depthLo), () => build(depthLo), still);
    cache.hiAtAngleLo = needHi ? memoList(cache, key(depthLo + 1), () => build(depthLo + 1), still) : null;
  }
  cache.loAtAngleHi = cache.loAtAngleLo;
  cache.hiAtAngleHi = cache.hiAtAngleLo;
  const lo = cache.loAtAngleLo;
  if (lo === null) { out.fill(0, 0, count * 3); return; }
  const hi = cache.hiAtAngleLo;

  if (cache.capacity < count) {
    cache.bufLo = new Float64Array(count * 3);
    cache.bufHi = new Float64Array(count * 3);
    cache.capacity = count;
  }
  // ⚠️ ARC LENGTH while the steps are unequal (authored lengths, or Stretch off its identity) — `39.A2`'s rule.
  const arc = (walk !== null && walk.unequal) || pose.stretchAnimated === true;
  const resampleList = (dst: Float64Array, list: CachedList): void => {
    if (zoomOn) {
      const band = zoomBandFromWalk(list.xyz, list.count, pose.centre, pose.descend, c.tile!.dim, c.tile!.s);
      cache.band = band;
      if (band.clamped) cache.zoomClamped = true;
      if (pose.smoothness > 0) resampleSmoothBandInto(dst, count, list.xyz, band, pose.smoothness);
      else resampleBandInto(dst, count, list.xyz, band.lo, band.hi);
      return;
    }
    cache.band = null;
    if (arc) {
      if (cache.cum.length < list.count) cache.cum = new Float64Array(list.count);
      resampleArcInto(dst, count, list.xyz, list.count, pose.smoothness, cache.cum);
    } else if (pose.smoothness > 0) {
      resampleSmoothBandInto(dst, count, list.xyz, { lo: 0, hi: list.count - 1, contiguous: true, clamped: false }, pose.smoothness);
    } else {
      resampleBandInto(dst, count, list.xyz, 0, list.count - 1);
    }
  };
  /*
   * v8 Phase 44 (`44.A2`) — **a branching generator GROWS BY GENERATION**: its list is cut at the arrival frontier and
   * resampled by arc length, exactly the turtle path's `growInto`; the transform stays the FULL list's, so the plant
   * grows in place. Off the growth branch (`gExt` null) this is the code that was here.
   */
  const growList = (dst: Float64Array, list: CachedList): boolean => {
    if (gExt === null || zoomOn || list.branch === null || list.branch === undefined) return false;
    const grown = growExtend(cache, list.xyz, list, list.count, gExt);
    if (cache.cum.length < list.count) cache.cum = new Float64Array(list.count);
    resampleArcInto(dst, count, grown, list.count, pose.smoothness, cache.cum);
    return true;
  };
  const grownLo = growList(cache.bufLo, lo);
  if (!grownLo) resampleList(cache.bufLo, lo);
  // v8 Phase 44 (`44.A2`) — the taper's input, by the same parameterisation, before the hi list reuses `cum`.
  if (pose.wantDepth === true && lo.count > 1) writeDepths(cache, lo, lo.count, count, grownLo || arc);
  if (!needHi || hi === null) {
    out.set(cache.bufLo.subarray(0, count * 3));
    if (zoomOn) normaliseInto(out, count, captureExtent(out, count));
    else normaliseInto(out, count, lo.transform);
    return;
  }
  if (!growList(cache.bufHi, hi)) resampleList(cache.bufHi, hi);
  lerpInto(out, count, cache.bufLo, cache.bufHi, depthFrac);
  if (zoomOn) normaliseInto(out, count, captureExtent(out, count));
  else normaliseInto(out, count, lerpTransform(lo.transform, hi.transform, depthFrac));
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
  const band = zoomBandFromWalk(list, n, pose.centre, pose.descend, dim, pose.rule.zoomBase ?? 2);
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
