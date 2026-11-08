/**
 * @file v8 `36.5` — **the expander and the 3-D turtle.** Takes a production system and three angles;
 * returns a RAW point list in the turtle's own units.
 *
 * ⚠️⚠️ **IMPORTS NOTHING (`36.D2`) — see `rules.ts`' header for why, and for the two syntaxes that are
 * banned outright (`enum`, constructor parameter property).** This file is reachable from
 * `score-canvas.ts`, which `composercheck` loads under bare Node.
 *
 * ⚠️⚠️ **IT DOES NOT NORMALISE, AND THAT IS `36.D14` RATHER THAN AN OMISSION.** The prototype
 * re-centres on the bbox midpoint and re-scales by the largest half-range **on every build**
 * (`4-lsystem-model.mjs:87-90`). Under `36.D3` that is a defect: an angle or a recursion that breathes
 * changes the bounding box, so a per-build normalisation would make the figure **pulse in SIZE and
 * wander in POSITION** on top of the shape change the author asked for — a motion nobody specified,
 * reading as the figure throbbing rather than morphing. **It also breaks the two-list lerp at its
 * foundation: lerping two independently-normalised lists interpolates between two different coordinate
 * systems.** The centre and scale are a TRANSFORM captured once at a reference pose — `extent.ts`.
 */

import type { LSystemRule } from './rules.ts';

/**
 * The hard ceiling on an expanded string, matching the prototype's own guard
 * (`4-lsystem-model.mjs:37`). ⚠️ **A budget rather than a trusted `recursionRange`**: the range is
 * per-rule data an author could widen, and an exponential expansion reaches gigabytes two levels past
 * where it looks fine. The expander stops and reports; it never allocates past this.
 */
export const EXPAND_SYMBOL_BUDGET = 900_000;

/**
 * Symbols the turtle deliberately IGNORES, enumerated so the set is reviewable rather than implicit
 * in a `default:` branch.
 *
 * ⚠️⚠️ **`!` IS HERE BECAUSE THE OWNER DROPPED THE `Shrink` ROW (`36.Q4`, 2026-11-02, reversing
 * `36.D12`).** It is the prototype's per-symbol length shrink. **A turtle that treats `!` as a length
 * change after that decision re-introduces a dropped control invisibly** — and silently breaks the
 * equal-segment-length precondition that `36.Q4` consequence 1 makes the resampler rely on.
 *
 * ⚠️ **`{` and `}` are the polygon-fill markers**, which this turtle does not implement. The prototype
 * ignored them too; the difference is that here it is a stated decision with a consequence attached
 * (see `bush3d`'s provenance).
 */
export const IGNORED_SYMBOLS = '!{}';

/**
 * Expand `rule`'s axiom `depth` times.
 *
 * Returns the string **and** whether the budget stopped it early, because a silently truncated
 * expansion draws a partial figure that looks like a different rule rather than like an error.
 */
export function expandRule(rule: LSystemRule, depth: number): { text: string; truncated: boolean } {
  const n = Math.max(0, Math.floor(depth));
  let s = rule.axiom;
  for (let i = 0; i < n; i++) {
    let out = '';
    for (const c of s) {
      const sub = rule.productions[c];
      out += sub === undefined ? c : sub;
    }
    s = out;
    /*
     * ⚠️ v8 Phase 39 — **truncated means an expansion was SKIPPED, so it can only be true with levels still to
     * go.** Past the budget on the LAST level the string is complete; the old test flagged it anyway, so the
     * zoom's deepest level reported a "truncated expansion" over a whole figure (`39.A6(b)`'s false flag).
     */
    if (s.length > EXPAND_SYMBOL_BUDGET && i < n - 1) return { text: s, truncated: true };
  }
  return { text: s, truncated: false };
}

/** A growable xyz buffer. Doubling, so a build is O(n) rather than O(n^2) in reallocation. */
interface PointSink {
  xyz: Float64Array;
  n: number;
}

function sinkPush(s: PointSink, x: number, y: number, z: number): void {
  if ((s.n + 1) * 3 > s.xyz.length) {
    const grown = new Float64Array(Math.max(96, s.xyz.length * 2));
    grown.set(s.xyz);
    s.xyz = grown;
  }
  const k = s.n * 3;
  s.xyz[k] = x;
  s.xyz[k + 1] = y;
  s.xyz[k + 2] = z;
  s.n++;
}

/** Rodrigues rotation of `v` about the unit axis `a` by `ang`, written into `v`. */
function rotateInto(v: Float64Array, a: Float64Array, cos: number, sin: number): void {
  const x = v[0]!, y = v[1]!, z = v[2]!;
  const u = a[0]!, w = a[1]!, q = a[2]!;
  const dd = u * x + w * y + q * z;
  v[0] = x * cos + (w * z - q * y) * sin + u * dd * (1 - cos);
  v[1] = y * cos + (q * x - u * z) * sin + w * dd * (1 - cos);
  v[2] = z * cos + (u * y - w * x) * sin + q * dd * (1 - cos);
}

function normalise(v: Float64Array): void {
  const m = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  v[0] = v[0]! / m;
  v[1] = v[1]! / m;
  v[2] = v[2]! / m;
}

export interface TurtleResult {
  /** Raw, un-normalised xyz triples; `count` points are valid. */
  readonly xyz: Float64Array;
  readonly count: number;
  /** True when `EXPAND_SYMBOL_BUDGET` stopped the expansion short. */
  readonly truncated: boolean;
  /** Bracket pushes that were never popped — a malformed production, surfaced rather than swallowed. */
  readonly unclosedBrackets: number;
}

/**
 * Walk an expanded string with a 3-D turtle.
 *
 * ⚠️⚠️ **THE BRACKET POP MUST RETRACE, NOT TELEPORT, AND THIS IS THE SINGLE MOST CONSEQUENTIAL LINE IN
 * THE FILE.** A stack-based turtle normally jumps straight back to the branch point, which puts a chord
 * the length of the whole branch into the point list — **measured density 33–38 with the pop against
 * 6.61 with the retrace.** Re-emitting the sub-path in REVERSE is the Euler tour's return leg, and it
 * is what makes a BRANCHING structure a single continuous curve with index adjacency preserved: a tree
 * drawn with a teleporting pop is a scatter of disconnected branches, drawn with a retrace it is **one
 * pen stroke**. ⚠️ It roughly doubles the list length per branch level, which is why `recursionRange`
 * is per rule.
 *
 * ⚠️ **`f` MOVES WITHOUT DRAWING** — the prototype conflates it with `F` (`:61`–`:62`), which is
 * harmless on the eight spec rules (none contains `f`) and wrong on `Bush 3D`. **Stated consequence: a
 * pen-up move is an index DISCONTINUITY in a list whose whole value is index adjacency**, so a rule
 * using `f` for anything other than a polygon interior will read as a broken stroke. That is correct
 * behaviour for the symbol and it is part of why `bush3d` is flagged for review rather than trusted.
 *
 * ⚠️ **Angles are applied per axis and are INDEPENDENT** (`36.D3`). ⚠️⚠️ **§1.1's whole table was
 * measured with `yaw === pitch === roll` (`4-lsystem-model.mjs:108`), so no quoted density figure is
 * evidence about an independent pitch or roll** — premise correction 3, and `36.Q5` is still open on
 * whether either gets a demo carrier.
 */
export function walkTurtle(
  rule: LSystemRule,
  depth: number,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
): TurtleResult {
  const { text, truncated } = expandRule(rule, depth);

  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const roll = (rollDeg * Math.PI) / 180;
  const cY = Math.cos(yaw), sY = Math.sin(yaw);
  const cP = Math.cos(pitch), sP = Math.sin(pitch);
  const cR = Math.cos(roll), sR = Math.sin(roll);

  // Heading / left / up, the standard turtle frame. Seeded exactly as the prototype seeds it, because
  // the frame choice fixes which plane a 2-D rule lands in and every published render assumes it.
  const H = new Float64Array([0, 1, 0]);
  const L = new Float64Array([-1, 0, 0]);
  const U = new Float64Array([0, 0, 1]);
  let px = 0, py = 0, pz = 0;

  const sink: PointSink = { xyz: new Float64Array(96), n: 0 };
  sinkPush(sink, 0, 0, 0);

  // One flat stack of saved state; `mark` is the point-list length at the push, which is what the
  // retrace walks back to.
  const stack: { x: number; y: number; z: number; h: Float64Array; l: Float64Array; u: Float64Array; mark: number }[] = [];

  const advance = (emit: boolean): void => {
    px += H[0]!;
    py += H[1]!;
    pz += H[2]!;
    if (emit) sinkPush(sink, px, py, pz);
  };

  const draws = rule.drawSymbols;

  for (const c of text) {
    // Per-rule draw symbols first: several published rules use their NON-TERMINALS as the forward
    // symbol (`Arrowhead`, `Gosper` -- A and B both mean draw, and neither contains an `F`).
    if (draws.length > 0 && draws.includes(c)) {
      advance(true);
      continue;
    }
    switch (c) {
      case 'F':
      case 'G':
        advance(true);
        break;
      case 'f':
        advance(false);
        break;
      case '+':
        rotateInto(H, U, cY, sY); rotateInto(L, U, cY, sY); normalise(H); normalise(L);
        break;
      case '-':
        rotateInto(H, U, cY, -sY); rotateInto(L, U, cY, -sY); normalise(H); normalise(L);
        break;
      case '&':
        rotateInto(H, L, cP, sP); rotateInto(U, L, cP, sP); normalise(H); normalise(U);
        break;
      case '^':
        rotateInto(H, L, cP, -sP); rotateInto(U, L, cP, -sP); normalise(H); normalise(U);
        break;
      /*
       * ⚠️⚠️ **THE ROLL SENSE IS INVERTED RELATIVE TO THE PROTOTYPE, AND THAT IS A MEASURED BUG FIX ON
       * THE DEFAULT RULE — DO NOT "RESTORE" IT.**
       *
       * `4-lsystem-model.mjs:67-68` rolls `<`/`/` POSITIVE about `H`. With that sense the `Hilbert 3D`
       * production — **the default rule** — takes unit steps but **revisits cells**: measured **63
       * distinct of 64** at recursion 2 and **487 of 512** at recursion 3. A lattice walk that revisits
       * is not a Hamiltonian path, so it is **not a Hilbert curve at all**, and `36.20` clause 7's
       * all-cells-distinct assertion is what caught it. ⚠️ **Attributed before it was acted on: the
       * prototype's own turtle reproduces 8/8, 63/64 and 487/512 exactly, so the defect is in the
       * symbol CONVENTION and not in this file.** Premise correction 4 had already flagged `Hilbert 3D`
       * as *"the one rule §1.1 never measured"* and *"the unmeasured one is the default"* — this is what
       * was hiding there.
       *
       * The convention space was searched rather than guessed: 2 yaw senses × 2 pitch × 2 roll × 3
       * roll-axis choices. **Exactly four of the 24 pass at 64/64 and 512/512 with every step one
       * lattice unit, and all four have `yawSign · pitchSign · rollSign = −1`** — i.e. the production is
       * written for the opposite HANDEDNESS, and flipping any single axis sense fixes it. The roll is
       * the one flipped here because `<` and `>` are **not in Prusinkiewicz's standard alphabet** (`+`/`-`
       * yaw, `&`/`^` pitch and `\`/`/` roll are), so the two symbols whose sense was transcribed without
       * a published convention to check against are exactly these two. Yaw and pitch keep the standard
       * reading.
       *
       * ⚠️ **COST, STATED: `Bush 3D` is the only other rule using roll, so it is now MIRRORED relative
       * to the prototype's render.** A chirality flip is not a correctness change and that rule's
       * correctness was never established anyway (see its `provenance`), but a reviewer comparing
       * against `4-lsystem-model.mjs`'s picture must know why it differs.
       */
      case '<':
      case '/':
        rotateInto(L, H, cR, -sR); rotateInto(U, H, cR, -sR); normalise(L); normalise(U);
        break;
      case '>':
      case '\\':
        rotateInto(L, H, cR, sR); rotateInto(U, H, cR, sR); normalise(L); normalise(U);
        break;
      case '|':
        H[0] = -H[0]!; H[1] = -H[1]!; H[2] = -H[2]!;
        L[0] = -L[0]!; L[1] = -L[1]!; L[2] = -L[2]!;
        break;
      case '[':
        stack.push({
          x: px, y: py, z: pz,
          h: H.slice(), l: L.slice(), u: U.slice(),
          mark: sink.n,
        });
        break;
      case ']': {
        const st = stack.pop();
        if (st === undefined) break;
        // THE RETRACE. Re-emit the sub-path in reverse, from the point before the current head back to
        // the branch point itself, so the return leg exists in the list as geometry.
        for (let k = sink.n - 2; k >= st.mark - 1 && k >= 0; k--) {
          const b = k * 3;
          sinkPush(sink, sink.xyz[b]!, sink.xyz[b + 1]!, sink.xyz[b + 2]!);
        }
        px = st.x; py = st.y; pz = st.z;
        H.set(st.h); L.set(st.l); U.set(st.u);
        break;
      }
      default:
        // `IGNORED_SYMBOLS` and every non-terminal that survived expansion land here.
        break;
    }
  }

  return { xyz: sink.xyz, count: sink.n, truncated, unclosedBrackets: stack.length };
}

/**
 * v8 `39.A6(c)` — **which turtle angles a rule uses, decided by their MEASURED EFFECT and not by the symbol
 * set alone.** `ruleAngleUsage` (rules.ts) scans the productions, and on `Bush 3D` that scan is WRONG: every
 * `+`/`-` sits inside the `L` production's `{…}` polygon block, whose `f` moves emit no point, so the turn is
 * thrown away and the `Yaw` row moved nothing (measured 0 displacement at two depths, `p39a6-c-inert.mjs`).
 * **A row that moves nothing is ABSENT** (`36`'s rule), so the Composer reads this.
 *
 * ⚠️ An axis counts only if the symbol scan says it is used AND sweeping it across the rule's `angleRange`
 * (the other two held at the landmark) moves a point of the shallowest walk. Noise floor: an unused axis reads
 * exactly 0 and a 1e-9° nudge reads >= 1.5e-11, so `1e-9` separates them with margin. Memoised per rule —
 * the answer is a property of the rule, and the walks are a few hundred points.
 */
const angleEffectMemo = new Map<string, { yaw: boolean; pitch: boolean; roll: boolean }>();
export function ruleAngleEffect(
  rule: LSystemRule,
  usage: { yaw: boolean; pitch: boolean; roll: boolean },
): { yaw: boolean; pitch: boolean; roll: boolean } {
  const hit = angleEffectMemo.get(rule.key);
  if (hit) return hit;
  const depth = Math.max(1, rule.recursionRange[0]);
  const a = rule.publishedAngle;
  const [lo, hi] = rule.angleRange;
  const moves = (axis: 0 | 1 | 2): boolean => {
    const pose = (v: number): number[] => [axis === 0 ? v : a, axis === 1 ? v : a, axis === 2 ? v : a];
    const p = pose(lo), q = pose(hi);
    const A = walkTurtle(rule, depth, p[0]!, p[1]!, p[2]!);
    const B = walkTurtle(rule, depth, q[0]!, q[1]!, q[2]!);
    if (A.count !== B.count) return true;
    for (let i = 0; i < A.count * 3; i++) if (Math.abs(A.xyz[i]! - B.xyz[i]!) > 1e-9) return true;
    return false;
  };
  const out = {
    yaw: usage.yaw && moves(0),
    pitch: usage.pitch && moves(1),
    roll: usage.roll && moves(2),
  };
  angleEffectMemo.set(rule.key, out);
  return out;
}
