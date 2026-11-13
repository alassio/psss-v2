/**
 * @file v8 `39.A1` — **the generator builder: a self-similar curve as k scaled copies of itself laid along
 * a k-segment generator**, beside the turtle. It exists for the two Stage A axes the L-system model cannot
 * express: **`Twist`** (rotate chosen copies about their own axis) and **`Stretch`** (scale chosen steps'
 * length at every level at once).
 *
 * ⚠️⚠️ **IMPORTS ONLY ITS OWN SIBLINGS AND NOTHING AT RUNTIME BEYOND THEM (`36.D2`)** — see `rules.ts`' header:
 * `score-canvas.ts` draws this type and `composercheck` loads it under bare Node, which strips types only.
 * No `enum`, no constructor parameter property, no class.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MODEL, AND WHY IT IS EXACT HERE RATHER THAN ASSUMED
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * **The generator is the rule's own DEPTH-1 TURTLE WALK**, not a separately stored polyline. So the turn
 * angle (`yaw`) needs no second encoding — the walk already applies it — and a rule's generator can never
 * drift from its production. Each copy maps the unit chord `(0,0,0)→(1,0,0)` onto one generator segment
 * (onto `b→a` if the copy is REVERSED) and carries a frame rotated by `orient + (twistable ? twist : 0)`
 * about its own axis. ⚠️ **A 2-D MIRROR IS `orient: 180`** — a half-turn about the copy's own axis is the
 * same map as a reflection for a planar copy, and it is the form that composes with a 3-D twist.
 *
 * ✅ **Measured exact before this file existed** (the private probe `p39-generator-claim.mjs`, 11-05):
 * every EDGE rule reproduces its turtle walk point-for-point to 1e-16 at depth 3 with the flags recorded in
 * `LSYSTEM_GENERATORS` — `39.A0(a)`'s parity sweep then holds it across every shipped demo's angle range.
 *
 * ⚠️⚠️ **THE TURTLE STAYS THE BUILDER AT THE IDENTITY (`twist === 0 && stretch === 1`), AND THAT IS WHAT
 * KEEPS THE 14 SHIPPED CURVE DEMOS BIT-IDENTICAL (`39.A1`).** This path is taken only while a preset uses
 * Twist or Stretch. Its output is carried into the TURTLE's own depth-n frame (`turtleFrame`), so the
 * hand-over at the identity is continuous to rounding and the extent transform is the turtle's.
 *
 * ⚠️ **EDGE rules only.** The CELL rules (Hilbert 2D/3D, Peano) emit cell centres, not junctions, and
 * Moore is closed (start == end, so there is no chord to repeat along); a rule with no entry in
 * `LSYSTEM_GENERATORS` has no `Twist` or `Stretch` row at all (`36`'s absent-not-disabled rule).
 */

import type { LSystemRule, RuleKey } from './rules.ts';
import { walkTurtle } from './turtle.ts';

/**
 * One rule's generator flags, **1-based copy indices**, as the probe reports them.
 *
 * ⚠️ `twistable` / `stretchable` are MASKS with ONE shared angle / factor (`39.D4`), never per-copy values:
 * per-copy sliders would be k controls, most of them duplicates (spec §2.4).
 */
export interface GeneratorFlags {
  readonly reverse: readonly number[];
  /** Copies carrying a half-turn about their own axis — the 3-D form of the 2-D mirror. */
  readonly orient180: readonly number[];
  readonly twistable: readonly number[];
  readonly stretchable: readonly number[];
  /** The `Twist` row's range in degrees, from `39.A0(d)`'s density sweep. */
  readonly twistRange: readonly [number, number];
  /** The `Stretch` row's range; `[1, 1]` means the rule has no `Stretch` row. */
  readonly stretchRange: readonly [number, number];
  /**
   * v8 `39.Q2` (c) — **a CELL rule**: its turtle emits cell CENTRES, not junctions, so its generator is an
   * explicit junction path in turn units at the 90° lattice, and each leaf emits the centre of its TILE
   * (`sqEdge`: the square with the copy as an edge; `sqDiag`: the square with the copy as its diagonal).
   * ⚠️⚠️ **HYBRID AT THE LATTICE (owner, `39.Q2`):** the generator is used ONLY at the rule's landmark angle,
   * and while Twist acts the turn angles are HELD there — the tiles exist only on the lattice.
   */
  readonly cells?: { readonly units: readonly number[]; readonly tile: 'sqEdge' | 'sqDiag' };
}

/**
 * ⚠️⚠️ **THE `builder` COLUMN OF `39.D11`, AS A TOTAL `Record`** — a new `RuleKey` without an entry is a
 * compile error, so a rule cannot silently get no decision. `null` = the turtle is the only builder and the
 * rule has NO `Twist`/`Stretch` rows.
 *
 * The REVERSE/ORIENT flags are the probe's brute-forced answers (`p39-generator-claim.mjs`, 1e-16 at depth
 * 3) and the parity sweep `39.A0(a)` (`p39a0-parity.mjs`) holds them across each rule's whole angle and
 * recursion range. The RANGES are `39.A0(d)`'s, read off the density sweep.
 */
export const LSYSTEM_GENERATORS: Record<RuleKey, GeneratorFlags | null> = {
  // Twist on copy 2 is the fold: 0 = the rule itself, 180 = its partner (dragon <-> Levy C), BOTH ways.
  // ⚠️ Levy C / Knopp take `2R + 2O` and not the probe's `none`: both reproduce Levy at twist 0 (1e-16), but
  // only `2R + 2O` lands on the DRAGON at 180 (2.5e-16; `none` misses by 0.56) -- p39a0-fix.mjs.
  dragon: { reverse: [2], orient180: [], twistable: [2], stretchable: [], twistRange: [0, 180], stretchRange: [1, 1] },
  levyC: { reverse: [2], orient180: [2], twistable: [2], stretchable: [], twistRange: [0, 180], stretchRange: [1, 1] },
  knopp: { reverse: [2], orient180: [2], twistable: [2], stretchable: [], twistRange: [0, 180], stretchRange: [1, 1] },
  terdragon: { reverse: [], orient180: [], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  kochQuad: { reverse: [5], orient180: [5], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  arrowhead: { reverse: [], orient180: [1, 3], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  gosper: { reverse: [2, 3, 7], orient180: [], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  // The Plant: trunk copies 1, 4, 7 twist (the 3-D tree); the two branches and their RETRACES stretch.
  // ⚠️ Stretch 0.5-1.5, not the spec's 0.5-1.6: the row's step is 2^-6 and `max/step` must be an INTEGER or a
  // browser refuses the top stop (CLAUDE.md, Slider tracks). Arc-length density across it: 5.0-6.9 at depth 4.
  plant: { reverse: [3, 6], orient180: [], twistable: [1, 4, 7], stretchable: [2, 3, 5, 6], twistRange: [0, 180], stretchRange: [0.5, 1.5] },
  // ⚠️ terdragon / kochQuad / arrowhead / gosper: parity EXACT (p39a0-parity.mjs) but NO Twist row —
  // `39.A0(c)` rendered their twist intermediates as noisy wire between two landmarks
  // (p39a0c-fold.png, p39a0c-fold2.png). Flags kept: they are the proven generator for a later axis.
  // Cell rules and the closed/branching 3-D rules: decided by `39.A0(a)`, provisionally turtle-only.
  /*
   * ⚠️⚠️ The two PLANAR cell rules, both measured EXACT against the turtle (p39cells-parity2d.mjs: 1.8e-15 to
   * 3.2e-14 at depths 2-5) and both LOOKED at under Twist (p39cells-twist.png: the lattice opens into a
   * structured figure). **Hilbert 2D takes the agent's class 4, NOT the spec's flag set**: the 16 parity-exact
   * sets are equivalent at twist 0 and split into 10 classes under twist, and the spec's set collapses past
   * ±27° where class 4 holds to ±80° (closest pair >= 0.5 step). ⚠️ The spec's *"H-fractal at 180°"* is
   * FALSIFIED: 456 of 1024 cells coincide there in every class, so the range stops at 80.
   */
  hilbert2d: {
    reverse: [3, 4], orient180: [1, 3], twistable: [1, 2, 3, 4], stretchable: [],
    twistRange: [-80, 80], stretchRange: [1, 1], cells: { units: [1, -1, 0, -1], tile: 'sqEdge' },
  },
  // Peano: the spec's set (2, 4, 6, 8 half-turned), safe across the WHOLE ±180 by every criterion, and at 180
  // it is a different planar lattice curve.
  peano: {
    reverse: [], orient180: [2, 4, 6, 8], twistable: [1, 2, 3, 4, 5, 6, 7, 8, 9], stretchable: [],
    twistRange: [-180, 180], stretchRange: [1, 1], cells: { units: [0, 1, -1, -1, -1, 1, 1, 1, -1], tile: 'sqDiag' },
  },
  /*
   * ⚠️⚠️ Hilbert 3D: parity holds with exactly ONE flag set (not the spec's), but under Twist both paths turn
   * into an unreadable tangle within 5° and path B ('Ring') is indistinguishable from path A
   * (p39cells-twist.png rows 1-2). `39.A0(c)`'s drop condition, so no Twist row and no Ring rule.
   */
  hilbert3d: null,
  /*
   * v8 `39.A5` — the two new turtle rules. ⚠️ Generator flags but EMPTY masks: no Twist / Stretch row, so their
   * presets are untouched; the entry exists so `Customize` can seed from them (Stage C). The plain flag set (no
   * reversed or mirrored copy) is EXACT against the turtle over each rule's whole angle and recursion range:
   * worst 1.6e-14 (Koch) and 9.1e-13 (Minkowski) of the extent, measured 2026-11-05.
   */
  koch: { reverse: [], orient180: [], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  minkowski: { reverse: [], orient180: [], twistable: [], stretchable: [], twistRange: [0, 0], stretchRange: [1, 1] },
  moore: null,
  bush3d: null,
  /*
   * v8 2026-11-13 — the four CLOSED tiles: NO flags here, because the depth-1 derivation `ruleStructure` performs
   * from these flags would read the AXIOM's starting shape as part of the generator. Their Customize structure (base
   * generator + starting shape) lives in `custom.ts` CUSTOM_ONLY_STRUCTURES, exact against the turtle (§K2). No
   * Twist / Stretch row, as for Koch and Minkowski.
   */
  kochSnowflake: null,
  pentigree: null,
  twindragon: null,
  fudgeflake: null,
};

/**
 * v8 `39.A0(b)` — **the twist and stretch bracket HALF-widths, per rule, SOLVED and not picked** — degrees
 * and stretch units. Same budget and method as `LSYSTEM_ANGLE_BRACKET` (0.01 of the figure extent, mean
 * deviation over 3 000 points, round DOWN), and ⚠️⚠️ **the minimum over EVERY depth in range and seven
 * centres across the row's range** — `39.A6` falsified *"solve at the range maximum"* (the error is not
 * monotone in depth on `hilbert2d` and `gosper`). `0` means no bracket: the figure is rebuilt per frame at
 * the exact value, which the generator affords (`p39a0-parity.mjs`). Solver: `p39a0b-shape-bracket.mjs`.
 */
export const LSYSTEM_TWIST_BRACKET: Record<RuleKey, number> = {
  // Solved 2026-11-05: dragon binds at depth 7 around 90 deg; levyC/knopp at depth 8 around 90 deg.
  // ⚠️ plant solved to the solver's 32 deg CEILING at every depth (the trunk twist barely moves the figure),
  // so 30 is shipped BELOW the ceiling: a ceiling is an artefact of the search, not a tolerance.
  dragon: 11.16, levyC: 16.51, knopp: 16.51, plant: 30,
  terdragon: 0, kochQuad: 0, arrowhead: 0, gosper: 0,
  hilbert2d: 0, hilbert3d: 0, peano: 0, moore: 0, bush3d: 0, koch: 0, minkowski: 0,
  kochSnowflake: 0, pentigree: 0, twindragon: 0, fudgeflake: 0,
};
export const LSYSTEM_STRETCH_BRACKET: Record<RuleKey, number> = {
  // Solved 2026-11-05 through the ARC-LENGTH resample the engine uses here; binds at depth 5, stretch 1.52.
  dragon: 0, levyC: 0, knopp: 0, plant: 0.051,
  terdragon: 0, kochQuad: 0, arrowhead: 0, gosper: 0,
  hilbert2d: 0, hilbert3d: 0, peano: 0, moore: 0, bush3d: 0, koch: 0, minkowski: 0,
  kochSnowflake: 0, pentigree: 0, twindragon: 0, fudgeflake: 0,
};

/** A small 3-D affine map `p → o + A·p`, row-major `A`. Plain data so the build allocates nothing per leaf. */
export interface Affine {
  a: Float64Array; // 9
  o: Float64Array; // 3
}

export function affine(): Affine {
  return { a: new Float64Array(9), o: new Float64Array(3) };
}

/** `out = P ∘ C` — apply C first, then P. */
export function compose(out: Affine, P: Affine, C: Affine): void {
  const p = P.a, c = C.a, r = out.a;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = p[i * 3]! * c[j]! + p[i * 3 + 1]! * c[3 + j]! + p[i * 3 + 2]! * c[6 + j]!;
    }
    out.o[i] = P.o[i]! + p[i * 3]! * C.o[0]! + p[i * 3 + 1]! * C.o[1]! + p[i * 3 + 2]! * C.o[2]!;
  }
}

/**
 * The local transform of one copy: the unit chord onto segment `s→e`, rotated by `tauDeg` about its own
 * axis. ⚠️ **The frame convention is spec §2.3's**: the minimal rotation from the parent's x-axis to the
 * copy's direction, then the copy's own `tau` about that direction; an antiparallel copy takes a half-turn
 * about the parent's third axis.
 */
export function copyTransform(out: Affine, s: number[], e: number[], tauDeg: number): void {
  const dx = e[0]! - s[0]!, dy = e[1]! - s[1]!, dz = e[2]! - s[2]!;
  const len = Math.hypot(dx, dy, dz) || 1;
  const x = [dx / len, dy / len, dz / len];
  // Minimal rotation taking (1,0,0) to x (Rodrigues about (1,0,0) × x).
  let R: number[];
  const c = x[0]!;
  if (c < -1 + 1e-12) {
    R = [-1, 0, 0, 0, -1, 0, 0, 0, 1];               // half-turn about the third axis
  } else {
    const ax = 0, ay = -x[2]!, az = x[1]!;            // (1,0,0) × x
    const k = 1 / (1 + c);
    R = [
      c + ax * ax * k, ax * ay * k - az, ax * az * k + ay,
      ay * ax * k + az, c + ay * ay * k, ay * az * k - ax,
      az * ax * k - ay, az * ay * k + ax, c + az * az * k,
    ];
  }
  // Then the copy's own rotation by tau about x: T = Rot(x, tau) · R.
  const t = (tauDeg * Math.PI) / 180;
  const ct = Math.cos(t), st = Math.sin(t);
  const ux = x[0]!, uy = x[1]!, uz = x[2]!;
  const Q = [
    ct + ux * ux * (1 - ct), ux * uy * (1 - ct) - uz * st, ux * uz * (1 - ct) + uy * st,
    uy * ux * (1 - ct) + uz * st, ct + uy * uy * (1 - ct), uy * uz * (1 - ct) - ux * st,
    uz * ux * (1 - ct) - uy * st, uz * uy * (1 - ct) + ux * st, ct + uz * uz * (1 - ct),
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out.a[i * 3 + j] = len * (Q[i * 3]! * R[j]! + Q[i * 3 + 1]! * R[3 + j]! + Q[i * 3 + 2]! * R[6 + j]!);
    }
  }
  out.o[0] = s[0]!; out.o[1] = s[1]!; out.o[2] = s[2]!;
}

/** The generator polyline in the CHORD frame: start at the origin, end at (1,0,0). Null if it has no chord. */
/** Junctions of a cell rule's generator in the chord frame, from turn units at `turnDeg`. */
function cellJunctions(units: readonly number[], turnDeg: number): number[][] {
  let h = 0;
  const P: number[][] = [[0, 0]];
  for (const u of units) {
    h += (u * turnDeg * Math.PI) / 180;
    const q = P[P.length - 1]!;
    P.push([q[0]! + Math.cos(h), q[1]! + Math.sin(h)]);
  }
  const e = P[P.length - 1]!;
  const d2 = e[0]! * e[0]! + e[1]! * e[1]!;
  return P.map((q) => [(q[0]! * e[0]! + q[1]! * e[1]!) / d2, (q[1]! * e[0]! - q[0]! * e[1]!) / d2, 0]);
}

/**
 * The similarity carrying a cell rule's generator output onto the TURTLE's own cells at one depth, fitted once
 * from the untwisted build and memoised. ⚠️ Exact data, so two points fix it and the max error over every cell
 * decides the mirror and refuses a generator that is not the rule.
 */
const cellFitMemo = new Map<string, { ar: number; ai: number; br: number; bi: number; mirror: boolean }>();

function generatorPolyline(
  rule: LSystemRule, flags: GeneratorFlags, yaw: number, pitch: number, roll: number, stretch: number,
): { pts: number[][]; chord: number[] } | null {
  const w = walkTurtle(rule, 1, yaw, pitch, roll);
  if (w.count < 2) return null;
  // Rebuild the polyline from its segment vectors so `Stretch` can scale the masked steps' lengths.
  // ⚠️ A retrace step is its own masked step (the Plant's 3 and 6), so a stretched branch's return leg
  // stretches with it and the stroke still retraces exactly — the property spec §2.2.1 derives.
  const raw: number[][] = [[w.xyz[0]!, w.xyz[1]!, w.xyz[2]!]];
  for (let i = 1; i < w.count; i++) {
    const f = flags.stretchable.includes(i) ? stretch : 1;
    const prev = raw[i - 1]!;
    raw.push([
      prev[0]! + (w.xyz[i * 3]! - w.xyz[(i - 1) * 3]!) * f,
      prev[1]! + (w.xyz[i * 3 + 1]! - w.xyz[(i - 1) * 3 + 1]!) * f,
      prev[2]! + (w.xyz[i * 3 + 2]! - w.xyz[(i - 1) * 3 + 2]!) * f,
    ]);
  }
  const s = raw[0]!, e = raw[raw.length - 1]!;
  const chord = [e[0]! - s[0]!, e[1]! - s[1]!, e[2]! - s[2]!];
  const L = Math.hypot(chord[0]!, chord[1]!, chord[2]!);
  if (L < 1e-9) return null;
  // Into the chord frame: x along the chord, z the turtle's U (the plane normal of every planar rule).
  const x = [chord[0]! / L, chord[1]! / L, chord[2]! / L];
  const z = [0, 0, 1];
  const y = [z[1]! * x[2]! - z[2]! * x[1]!, z[2]! * x[0]! - z[0]! * x[2]!, z[0]! * x[1]! - z[1]! * x[0]!];
  const pts = raw.map((p) => {
    const q = [p[0]! - s[0]!, p[1]! - s[1]!, p[2]! - s[2]!];
    return [
      (q[0]! * x[0]! + q[1]! * x[1]! + q[2]! * x[2]!) / L,
      (q[0]! * y[0]! + q[1]! * y[1]! + q[2]! * y[2]!) / L,
      (q[0]! * z[0]! + q[1]! * z[1]! + q[2]! * z[2]!) / L,
    ];
  });
  return { pts, chord };
}

/**
 * One symbol's effect after `m` expansions, relative to the heading it is entered with: a displacement
 * `(dx, dy)` and a net turn `(c, s)` as a unit complex number, plus the heading of its FIRST drawn step
 * (`fx, fy`, or `has: false` if it draws nothing).
 */
interface SymbolEffect { dx: number; dy: number; c: number; s: number; fx: number; fy: number; has: boolean }

/**
 * The turtle's own depth-n frame — where its chord points, and the direction of its first step — computed
 * EXACTLY without walking it.
 *
 * ⚠️⚠️ **`chord_n = chord_1^n` IS FALSE AND WAS THE FIRST VERSION OF THIS FUNCTION.** It holds only when every
 * symbol expands to the same pattern; the arrowhead alternates two MIRROR-IMAGE productions (`A`, `B`), so its
 * chord turns differently per level and the generator landed rotated — 2.25 of the extent off at depth 5,
 * caught by `39.A0(a)`. So each symbol's displacement and net turn are tabulated level by level instead
 * (planar complex arithmetic, `O(depth × production length)`), which is exact for every planar rule.
 *
 * ⚠️ Brackets contribute nothing to the net effect — the turtle pops back to the branch point — but a
 * bracketed branch CAN be the first drawn step, which is why the first-step heading walks into it.
 */
function turtleFrame(rule: LSystemRule, yawDeg: number, depth: number): { x: number[]; len: number; first: number[] } {
  const th = (yawDeg * Math.PI) / 180;
  const cY = Math.cos(th), sY = Math.sin(th);
  const draws = 'FGf' + rule.drawSymbols;
  const base = (ch: string): SymbolEffect => {
    if (draws.includes(ch)) return { dx: 1, dy: 0, c: 1, s: 0, fx: 1, fy: 0, has: ch !== 'f' };
    if (ch === '+') return { dx: 0, dy: 0, c: cY, s: sY, fx: 0, fy: 0, has: false };
    if (ch === '-') return { dx: 0, dy: 0, c: cY, s: -sY, fx: 0, fy: 0, has: false };
    if (ch === '|') return { dx: 0, dy: 0, c: -1, s: 0, fx: 0, fy: 0, has: false };
    return { dx: 0, dy: 0, c: 1, s: 0, fx: 0, fy: 0, has: false };
  };
  /** Walk a string, each symbol already resolved to its effect, from heading (1, 0). */
  const walk = (str: string, eff: (ch: string) => SymbolEffect): SymbolEffect => {
    let px = 0, py = 0, hc = 1, hs = 0, fx = 0, fy = 0, has = false;
    const stack: number[][] = [];
    for (const ch of str) {
      if (ch === '[') { stack.push([px, py, hc, hs]); continue; }
      if (ch === ']') { const st = stack.pop(); if (st) { px = st[0]!; py = st[1]!; hc = st[2]!; hs = st[3]!; } continue; }
      const e = eff(ch);
      if (!has && e.has) { fx = hc * e.fx - hs * e.fy; fy = hc * e.fy + hs * e.fx; has = true; }
      px += hc * e.dx - hs * e.dy; py += hc * e.dy + hs * e.dx;
      const nc = hc * e.c - hs * e.s; hs = hc * e.s + hs * e.c; hc = nc;
    }
    return { dx: px, dy: py, c: hc, s: hs, fx, fy, has };
  };
  let level = new Map<string, SymbolEffect>();
  const lookup = (m: Map<string, SymbolEffect>) => (ch: string): SymbolEffect => m.get(ch) ?? base(ch);
  for (let m = 1; m <= depth; m++) {
    const next = new Map<string, SymbolEffect>();
    for (const key of Object.keys(rule.productions)) next.set(key, walk(rule.productions[key]!, lookup(level)));
    level = next;
  }
  const a = walk(rule.axiom, lookup(level));
  // The turtle's initial heading is +y (turtle.ts seeds H = (0,1,0)): rotate the local (1,0) frame by 90°.
  const cx = -a.dy, cy = a.dx;
  const len = Math.hypot(cx, cy) || 1;
  return { x: [cx / len, cy / len, 0], len, first: [-a.fy, a.fx, 0] };
}

export interface GeneratorBuild {
  readonly xyz: Float64Array;
  readonly count: number;
}

/**
 * Build the depth-`depth` curve through the generator, in the TURTLE's raw frame.
 *
 * ⚠️ Returns null when the rule has no generator or the generator has no chord (spec §2.5's V2) — the
 * caller keeps the turtle, which is §7.3's *"keep the last valid build"* for the named rules.
 */
export function buildGenerator(
  rule: LSystemRule, flags: GeneratorFlags, depth: number,
  yaw: number, pitch: number, roll: number, twist: number, stretch: number,
): GeneratorBuild | null {
  if (flags.cells) return buildCells(rule, flags, depth, twist);
  const n = Math.max(1, Math.floor(depth));
  const g = generatorPolyline(rule, flags, yaw, pitch, roll, stretch);
  if (g === null) return null;
  const k = g.pts.length - 1;
  // Each copy's local transform, fixed for the whole build.
  const local: Affine[] = [];
  const rev: boolean[] = [];
  for (let i = 1; i <= k; i++) {
    const r = flags.reverse.includes(i);
    const tau = (flags.orient180.includes(i) ? 180 : 0) + (flags.twistable.includes(i) ? twist : 0);
    const A = affine();
    copyTransform(A, r ? g.pts[i]! : g.pts[i - 1]!, r ? g.pts[i - 1]! : g.pts[i]!, tau);
    local.push(A);
    rev.push(r);
  }
  // Built in the CHORD frame (identity top); carried into the turtle's frame in one pass at the end.
  const top = affine();
  top.a[0] = 1; top.a[4] = 1; top.a[8] = 1;
  const count = Math.pow(k, n) + 1;
  const xyz = new Float64Array(count * 3);
  let m = 0;
  const push = (T: Affine, at: number): void => {
    // T applied to (at, 0, 0)
    xyz[m * 3] = T.o[0]! + T.a[0]! * at;
    xyz[m * 3 + 1] = T.o[1]! + T.a[3]! * at;
    xyz[m * 3 + 2] = T.o[2]! + T.a[6]! * at;
    m++;
  };
  /*
   * One scratch transform PER LEVEL, so the recursion allocates nothing per node (invariant 8). ⚠️ This is
   * safe only because a level-`d` call writes `scratch[d]` and its descendants write strictly LOWER slots:
   * the parent transform a call receives lives in `scratch[d + 1]` (or is `top`), which nothing beneath it
   * touches, and a sibling overwrites `scratch[d]` only after the previous sibling's whole subtree is done.
   */
  const scratch: Affine[] = [];
  for (let d = 0; d <= n; d++) scratch.push(affine());
  const emit = (T: Affine, d: number, reversed: boolean): void => {
    if (d === 0) { push(T, reversed ? 0 : 1); return; }
    const child = scratch[d - 1]!;
    for (let s = 0; s < k; s++) {
      const i = reversed ? k - 1 - s : s;
      compose(child, T, local[i]!);
      emit(child, d - 1, rev[i] !== reversed);
    }
  };
  push(top, 0);
  emit(top, n, false);

  /*
   * Into the turtle's own frame: x along its exact depth-n chord (`turtleFrame`), scaled to its length, and
   * MIRRORED if the turtle's first step lies on the other side of the chord from ours. ⚠️ The mirror keeps the
   * plane normal (+z = the turtle's `U`), so a twisted copy leaves the plane on the same side either way.
   * ⚠️ `walkTurtle` starts at the origin, so the start needs no translation.
   */
  const f = turtleFrame(rule, yaw, n);
  const x = f.x;
  let y = [-x[1]!, x[0]!, 0];                         // z × x with z = (0,0,1)
  if (m > 1) {
    const v = xyz[4]! - xyz[1]!;                      // our first step's component across the chord
    const fv = f.first[0]! * y[0]! + f.first[1]! * y[1]!;
    if (Math.abs(v) > 1e-12 && Math.abs(fv) > 1e-12 && Math.sign(v) !== Math.sign(fv)) y = [-y[0]!, -y[1]!, 0];
  }
  const L = f.len;
  for (let i = 0; i < m; i++) {
    const b = i * 3, u = xyz[b]!, w = xyz[b + 1]!, h = xyz[b + 2]!;
    xyz[b] = (x[0]! * u + y[0]! * w) * L;
    xyz[b + 1] = (x[1]! * u + y[1]! * w) * L;
    xyz[b + 2] = h * L;
  }
  return { xyz, count: m };
}

/** The tile centre in a copy's local frame (spec §2.6). */
export const TILE_CENTRE: Record<'sqEdge' | 'sqDiag', readonly number[]> = { sqEdge: [0.5, 0.5, 0], sqDiag: [0.5, 0, 0] };

/** Emit a cell rule's tile centres at `depth` in the chord frame. */
function cellPoints(flags: GeneratorFlags, depth: number, twist: number): Float64Array {
  const cells = flags.cells!;
  const J = cellJunctions(cells.units, 90);
  const k = J.length - 1;
  const local: Affine[] = [];
  const rev: boolean[] = [];
  for (let i = 1; i <= k; i++) {
    const r = flags.reverse.includes(i);
    const tau = (flags.orient180.includes(i) ? 180 : 0) + (flags.twistable.includes(i) ? twist : 0);
    const A = affine();
    copyTransform(A, r ? J[i]! : J[i - 1]!, r ? J[i - 1]! : J[i]!, tau);
    local.push(A);
    rev.push(r);
  }
  const n = Math.max(1, Math.floor(depth));
  const c = TILE_CENTRE[cells.tile];
  const xyz = new Float64Array(Math.pow(k, n) * 3);
  let m = 0;
  const scratch: Affine[] = [];
  for (let d = 0; d <= n; d++) scratch.push(affine());
  const top = affine();
  top.a[0] = 1; top.a[4] = 1; top.a[8] = 1;
  const emit = (T: Affine, d: number, reversed: boolean): void => {
    if (d === 0) {
      xyz[m * 3] = T.o[0]! + T.a[0]! * c[0]! + T.a[1]! * c[1]! + T.a[2]! * c[2]!;
      xyz[m * 3 + 1] = T.o[1]! + T.a[3]! * c[0]! + T.a[4]! * c[1]! + T.a[5]! * c[2]!;
      xyz[m * 3 + 2] = T.o[2]! + T.a[6]! * c[0]! + T.a[7]! * c[1]! + T.a[8]! * c[2]!;
      m++;
      return;
    }
    const child = scratch[d - 1]!;
    for (let s = 0; s < k; s++) {
      const i = reversed ? k - 1 - s : s;
      compose(child, T, local[i]!);
      emit(child, d - 1, rev[i] !== reversed);
    }
  };
  emit(top, n, false);
  return xyz;
}

/**
 * v8 `39.Q2` (c) — a CELL rule through the generator, carried onto the turtle's own cells at the lattice
 * angle. ⚠️ The turn angles are the rule's LANDMARK here by construction: the tiles exist only on the lattice,
 * which is the hybrid the owner chose — the caller holds Yaw at the landmark while Twist acts.
 */
function buildCells(rule: LSystemRule, flags: GeneratorFlags, depth: number, twist: number): GeneratorBuild | null {
  const n = Math.max(1, Math.floor(depth));
  const key = `${rule.key}:${n}`;
  let fit = cellFitMemo.get(key);
  if (fit === undefined) {
    const g0 = cellPoints(flags, n, 0);
    const a = rule.publishedAngle;
    const t = walkTurtle(rule, n, a, a, a);
    if (t.count * 3 !== g0.length || t.count < 3) return null;
    const solve = (mirror: boolean) => {
      const gy = (i: number): number => (mirror ? -g0[i * 3 + 1]! : g0[i * 3 + 1]!);
      const dgr = g0[3]! - g0[0]!, dgi = gy(1) - gy(0);
      const dtr = t.xyz[3]! - t.xyz[0]!, dti = t.xyz[4]! - t.xyz[1]!;
      const den = dgr * dgr + dgi * dgi;
      const br = (dtr * dgr + dti * dgi) / den, bi = (dti * dgr - dtr * dgi) / den;
      const ar = t.xyz[0]! - (br * g0[0]! - bi * gy(0)), ai = t.xyz[1]! - (br * gy(0) + bi * g0[0]!);
      let err = 0;
      for (let i = 0; i < t.count; i++) {
        const x = ar + br * g0[i * 3]! - bi * gy(i), y = ai + br * gy(i) + bi * g0[i * 3]!;
        err = Math.max(err, Math.hypot(x - t.xyz[i * 3]!, y - t.xyz[i * 3 + 1]!));
      }
      return { ar, ai, br, bi, mirror, err };
    };
    const p = solve(false), q = solve(true);
    const best = p.err <= q.err ? p : q;
    // ⚠️ Not an approximation: if neither fit is exact the generator is NOT this rule, and the turtle stays.
    if (!(best.err < 1e-6)) return null;
    fit = { ar: best.ar, ai: best.ai, br: best.br, bi: best.bi, mirror: best.mirror };
    cellFitMemo.set(key, fit);
  }
  const g = cellPoints(flags, n, twist);
  const count = g.length / 3;
  const L = Math.hypot(fit.br, fit.bi);
  for (let i = 0; i < count; i++) {
    const x = g[i * 3]!, y = fit.mirror ? -g[i * 3 + 1]! : g[i * 3 + 1]!, z = g[i * 3 + 2]!;
    g[i * 3] = fit.ar + fit.br * x - fit.bi * y;
    g[i * 3 + 1] = fit.ai + fit.br * y + fit.bi * x;
    g[i * 3 + 2] = z * L;
  }
  return { xyz: g, count };
}
