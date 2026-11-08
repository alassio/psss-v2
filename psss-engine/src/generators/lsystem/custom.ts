/**
 * @file v8 `39.C1`–`39.C4` — **the `Customize` rule: a self-similar curve drawn from an EDITABLE generator.**
 *
 * ⚠️⚠️ **IMPORTS ONLY ITS SIBLINGS AND TYPES (`36.D2`)** — `score-canvas.ts` draws this type and `composercheck`
 * / `figurecheck` load it under bare Node, which strips types only. No `enum`, no class, no parameter property.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MODEL — the one `generator.ts` proved exact for the named rules, with the generator as DATA
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * A generator is a list of steps (`CustomCurveStep`); walked with the live Yaw (turn unit) and Pitch (lift unit)
 * it gives a polyline of k segments; the depth-n curve is k scaled copies of the depth-(n−1) curve laid along it,
 * each copy carrying `reverse` and an orientation `orient + (twistable ? twist : 0)` about its own axis — exactly
 * `buildGenerator`'s composition, through the same exported `copyTransform`/`compose`.
 *
 * ⚠️⚠️ **CHOOSING `Customize` IS A VISUAL NO-OP, AND THAT IS ENFORCED BY ROUTING, NOT BY ARITHMETIC (spec §3.3).**
 * While a custom generator is STRUCTURALLY EQUAL to a named rule's (`customMatchesRule`), `resolveCustomRule`
 * hands back THAT RULE and the figure is built by the rule's own path — so the picture is bit-identical, at any
 * recursion, including the turtle's per-level rotation. The first structural edit switches to the generator
 * path, whose frame (`gen.frame`) was captured at seeding so the figure does not spin; undoing the edit switches
 * back. ⚠️ This is also the "landmark" rule `39.D8` asks for: the readout names the rule while they are equal.
 *
 * ⚠️ **Retrace steps store nothing** (spec §2.2.1): segment, flags and the heading afterwards are the partner's,
 * so an edit to an out-leg can never leave its return leg drawing a different subtree.
 */

import type { CustomCurveGenerator, CustomCurveStep, LSystemConfig } from '../../core/interfaces.ts';
import { LSYSTEM_RULES, LSYSTEM_RULE_BY_KEY, LSYSTEM_DEFAULT_RULE, type LSystemRule, type RuleKey } from './rules.ts';
import { walkTurtle } from './turtle.ts';
import { LSYSTEM_GENERATORS, affine, compose, copyTransform, type Affine } from './generator.ts';

/** The stored rule key of the custom rule. ⚠️ Not a `RuleKey`: it has no production and no library entry. */
export const CUSTOM_RULE_KEY = 'customize';
/** The dropdown's label for it — the `Film Look → Customize` word (spec §3.1). */
export const CUSTOM_RULE_LABEL = 'Customize';

/** Spec §2.5's provisional constants. `K_MAX` 16: the largest library generator is Peano's 9. */
export const CUSTOM_K_MIN = 2;
export const CUSTOM_K_MAX = 16;
/** V2: the chord must be at least this fraction of the generator's total length. */
export const CUSTOM_CHORD_MIN = 0.02;
/** A normalised step longer than this is a WARNING: detail appears slowly with depth. */
export const CUSTOM_SHRINK_WARN = 0.9;
/**
 * The segment budget the recursion bound is DERIVED from (`maxDepth = floor(log BUDGET / log k)`, spec §2.5) —
 * never authored. 65 536 keeps a per-frame rebuild of a breathing custom figure inside a frame (two builds,
 * depth n and n + 1, the second capped by the same bound).
 */
export const CUSTOM_SEGMENT_BUDGET = 65_536;

/**
 * The custom rule's parameter ranges (spec §4.4). ⚠️ Each is a whole number of its row's power-of-two steps
 * (the Slider-tracks rule), and Yaw stops short of 0 and 180, where every turn vanishes or folds back.
 */
export const CUSTOM_RANGES = {
  yaw: [1, 179] as const,
  pitch: [-180, 180] as const,
  twist: [-180, 180] as const,
  stretch: [0.25, 2] as const,
};
/** The editor table's number inputs: negative powers of two (a form control steps in base-10 `Decimal`). */
export const CUSTOM_UNIT_RANGE = [-4, 4] as const;
export const CUSTOM_UNIT_STEP = 1 / 4;
export const CUSTOM_LENGTH_RANGE = [1 / 16, 4] as const;
export const CUSTOM_LENGTH_STEP = 1 / 16;

/** A move step with every field at its neutral value (`+ Move`). */
export function newMoveStep(): CustomCurveStep {
  return { kind: 'move', turn: 0, lift: 0, length: 1, reverse: false, orient: 0, twistable: false, stretchable: false };
}

/** One walked segment and the flags its copy carries (a retrace's are its partner's, `reverse` inverted). */
interface WalkedCopy { reverse: boolean; orient: number; twistable: boolean; stretchable: boolean }

export interface CustomWalk {
  /** Junctions in the CHORD frame: start (0,0,0), end (1,0,0). */
  readonly pts: number[][];
  readonly copies: WalkedCopy[];
  /** Normalised length of each segment, for V3 and the shrink warning. */
  readonly seg: number[];
  /** True when the segments are not all one length — the resample must then go by ARC LENGTH (`39.A2`). */
  readonly unequal: boolean;
}

export interface CustomValidation {
  readonly ok: boolean;
  /** The first failure, worded for the status line (spec §2.5), or null. */
  readonly error: string | null;
  /** The shrink warning, or null. */
  readonly warning: string | null;
}

const rot = (a: number[], b: number[], ang: number): [number[], number[]] => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [
    [a[0]! * c + b[0]! * s, a[1]! * c + b[1]! * s, a[2]! * c + b[2]! * s],
    [-a[0]! * s + b[0]! * c, -a[1]! * s + b[1]! * c, -a[2]! * s + b[2]! * c],
  ];
};

/**
 * Walk the steps (spec §2.3): `heading += turn · yaw` about the up axis, then `pitch += lift · pitchDeg` about the
 * left axis, then advance `length · (stretchable ? stretch : 1)`. Returns null for a V1 failure, with its message.
 */
function walkRaw(gen: { steps: readonly CustomCurveStep[] }, yawDeg: number, pitchDeg: number, stretch: number):
  { raw: number[][]; copies: WalkedCopy[]; error: string | null } {
  const yaw = (yawDeg * Math.PI) / 180, pit = (pitchDeg * Math.PI) / 180;
  let H = [1, 0, 0], L = [0, 1, 0], U = [0, 0, 1];
  let pos = [0, 0, 0];
  const raw: number[][] = [[0, 0, 0]];
  const copies: WalkedCopy[] = [];
  const open: { start: number[]; end: number[]; H: number[]; L: number[]; U: number[]; f: WalkedCopy }[] = [];
  for (let i = 0; i < gen.steps.length; i++) {
    const st = gen.steps[i]!;
    if (st.kind === 'retrace') {
      const p = open.pop();
      if (p === undefined) return { raw, copies, error: `Step ${i + 1} retraces nothing.` };
      pos = p.start.slice();
      H = p.H; L = p.L; U = p.U;
      raw.push(pos.slice());
      copies.push({ ...p.f, reverse: !p.f.reverse });
      continue;
    }
    if (!(Number.isFinite(st.turn) && Number.isFinite(st.lift) && Number.isFinite(st.length) && st.length > 0)) {
      return { raw, copies, error: `Step ${i + 1} needs a length above 0.` };
    }
    const before = { H, L, U };
    [H, L] = rot(H, L, st.turn * yaw);
    [H, U] = rot(H, U, st.lift * pit);
    const len = st.length * (st.stretchable ? stretch : 1);
    const start = pos.slice();
    pos = [pos[0]! + H[0]! * len, pos[1]! + H[1]! * len, pos[2]! + H[2]! * len];
    raw.push(pos.slice());
    const f = { reverse: st.reverse, orient: st.orient, twistable: st.twistable, stretchable: st.stretchable };
    copies.push(f);
    open.push({ start, end: pos.slice(), H: before.H, L: before.L, U: before.U, f });
  }
  return { raw, copies, error: null };
}

/** The generator in its chord frame, plus validation (spec §2.5). */
export function walkCustom(gen: CustomCurveGenerator, yawDeg: number, pitchDeg: number, stretch: number):
  { walk: CustomWalk | null; validation: CustomValidation } {
  const fail = (error: string): { walk: null; validation: CustomValidation } => ({ walk: null, validation: { ok: false, error, warning: null } });
  const k = gen.steps.length;
  if (k < CUSTOM_K_MIN) return fail(`A generator needs at least ${CUSTOM_K_MIN} steps.`);
  if (k > CUSTOM_K_MAX) return fail(`A generator can have at most ${CUSTOM_K_MAX} steps.`);
  const w = walkRaw(gen, yawDeg, pitchDeg, stretch);
  if (w.error !== null) return fail(w.error);
  const s = w.raw[0]!, e = w.raw[w.raw.length - 1]!;
  const chord = [e[0]! - s[0]!, e[1]! - s[1]!, e[2]! - s[2]!];
  const C = Math.hypot(chord[0]!, chord[1]!, chord[2]!);
  let total = 0;
  for (let i = 1; i < w.raw.length; i++) {
    const a = w.raw[i - 1]!, b = w.raw[i]!;
    total += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
  }
  if (!(C >= CUSTOM_CHORD_MIN * total) || !(C > 1e-12)) {
    return fail('Start and end nearly coincide — the curve has no direction to repeat along.');
  }
  // The chord frame: x along the chord, z the walk's up axis made orthogonal to it (y if the chord is vertical).
  const x = [chord[0]! / C, chord[1]! / C, chord[2]! / C];
  let zr = Math.abs(x[2]!) < 0.99 ? [0, 0, 1] : [0, 1, 0];
  const dz = zr[0]! * x[0]! + zr[1]! * x[1]! + zr[2]! * x[2]!;
  zr = [zr[0]! - dz * x[0]!, zr[1]! - dz * x[1]!, zr[2]! - dz * x[2]!];
  const zl = Math.hypot(zr[0]!, zr[1]!, zr[2]!);
  const z = [zr[0]! / zl, zr[1]! / zl, zr[2]! / zl];
  const y = [z[1]! * x[2]! - z[2]! * x[1]!, z[2]! * x[0]! - z[0]! * x[2]!, z[0]! * x[1]! - z[1]! * x[0]!];
  const pts = w.raw.map((p) => {
    const q = [p[0]! - s[0]!, p[1]! - s[1]!, p[2]! - s[2]!];
    return [
      (q[0]! * x[0]! + q[1]! * x[1]! + q[2]! * x[2]!) / C,
      (q[0]! * y[0]! + q[1]! * y[1]! + q[2]! * y[2]!) / C,
      (q[0]! * z[0]! + q[1]! * z[1]! + q[2]! * z[2]!) / C,
    ];
  });
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    seg.push(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!));
  }
  /*
   * V3 — every copy should SHRINK. ⚠️⚠️ **A WARNING HERE, NOT spec §2.5's FAILURE, AND THE REASON IS MEASURED:** the
   * SHIPPED rules break it inside their own ranges (the dragon above 90°, the arrowhead near 99° — `p61-custom-seed.mjs`)
   * and draw correctly there, because at a finite depth a non-contracting generator is still exact: the curve grows
   * with depth and the extent normalisation absorbs it. Refusing V3 would refuse figures the named rules already
   * draw, and `Customize` would stop being a no-op exactly there. V2 (no chord) stays a failure: that one divides by 0.
   */
  const big = seg.findIndex((l) => !(l < 1));
  const slow = seg.findIndex((l) => l > CUSTOM_SHRINK_WARN);
  const warning = big >= 0
    ? `Step ${big + 1} is as long as the whole curve — the copies grow instead of shrinking, so recursion adds size, not detail.`
    : slow >= 0 ? `Step ${slow + 1} barely shrinks; detail appears slowly with depth.` : null;
  const unequal = seg.some((l) => Math.abs(l - seg[0]!) > 1e-9 * seg[0]!);
  return {
    walk: { pts, copies: w.copies, seg, unequal },
    validation: { ok: true, error: null, warning },
  };
}

/** The derived recursion bound (spec §2.5) — never authored. */
export function customMaxDepth(k: number, initiatorSegments = 1): number {
  const budget = CUSTOM_SEGMENT_BUDGET / Math.max(1, initiatorSegments);
  return Math.max(1, Math.floor(Math.log(budget) / Math.log(Math.max(2, k))));
}

/**
 * The lattice a `cells` generator is evaluated on: its turns AND its lifts are held at 90° (the hybrid `39.Q2` chose).
 * ⚠️ Both, because a 3-D cell generator (Hilbert 3D) lifts as well as turns; a planar one has no lift to hold.
 */
export const CUSTOM_CELL_YAW = 90;
export const CUSTOM_CELL_PITCH = 90;

/**
 * The three tiles (spec §2.6), in the spec's order: the square with the copy as an EDGE (Hilbert 2D), the square
 * with the copy as its DIAGONAL (Peano), the CUBE with the copy as an edge (Hilbert 3D). A leaf emits the tile's centre
 * in its own frame.
 */
export const CUSTOM_TILE_CENTRE = { sqEdge: [0.5, 0.5, 0], sqDiag: [0.5, 0, 0], cubeEdge: [0.5, 0.5, 0.5] } as const;
export type CustomTileKind = keyof typeof CUSTOM_TILE_CENTRE;

/** A passing tile, its subdivision factor `s` per axis, and the lattice DIMENSION the zoom works in. */
export interface CustomTile { readonly tile: CustomTileKind; readonly s: number; readonly dim: 2 | 3 }

const tileMemo = new Map<string, CustomTile | null>();

/**
 * ⚠️⚠️ **THE SPACE-FILLING CHECK THAT GRANTS `Cells` AND `Descend` (spec §2.6) — a generator EARNS them by passing
 * a test, never by a flag an author could set wrongly.** Planar, k a perfect square s², and at the 90° lattice the
 * depth-2 tile centres are all DISTINCT and every consecutive pair is ONE CELL apart (edge-adjacent). The tiles are
 * tried in the spec's order; the first that passes is the generator's. Evaluated at the lattice with Twist 0 and
 * Stretch 1 — the shape Descend needs (`39.D9`).
 */
export function customTile(gen: CustomCurveGenerator): CustomTile | null {
  const key = JSON.stringify(gen.steps);
  if (tileMemo.has(key)) return tileMemo.get(key)!;
  let found: CustomTile | null = null;
  const k = gen.steps.length;
  const planar = gen.steps.every((st) => st.kind === 'retrace' || st.lift === 0);
  // Planar: k = s² and a square tile. Otherwise k = s³ and the cube (a 3-D generator fills a volume, not a plane).
  const s = planar ? Math.round(Math.sqrt(k)) : Math.round(Math.cbrt(k));
  const tiles: readonly CustomTileKind[] = planar ? ['sqEdge', 'sqDiag'] : ['cubeEdge'];
  if ((planar ? s * s : s * s * s) === k && s >= 2) {
    const { walk } = walkCustom(gen, CUSTOM_CELL_YAW, CUSTOM_CELL_PITCH, 1);
    // ⚠️ A depth-2 cell is one depth-2 COPY, whose size is the normalised step SQUARED — equal steps required.
    if (walk !== null && !walk.unequal) {
      const leaf = walk.seg[0]! * walk.seg[0]!;
      for (const tile of tiles) {
        // The cell SIDE: the copy is the tile's edge (`sqEdge`, `cubeEdge`) or its diagonal (`sqDiag`, leaf / √2).
        const cell = tile === 'sqDiag' ? leaf / Math.SQRT2 : leaf;
        const xyz = emitCopies(walk, 2, 0, CUSTOM_TILE_CENTRE[tile], null);
        const n = xyz.length / 3;
        const seen = new Set<string>();
        for (let i = 0; i < n; i++) seen.add(`${Math.round(xyz[i * 3]! * 1e6)},${Math.round(xyz[i * 3 + 1]! * 1e6)},${Math.round(xyz[i * 3 + 2]! * 1e6)}`);
        if (seen.size !== n) continue;
        let ok = true;
        for (let i = 1; i < n && ok; i++) {
          const d = Math.hypot(xyz[i * 3]! - xyz[i * 3 - 3]!, xyz[i * 3 + 1]! - xyz[i * 3 - 2]!, xyz[i * 3 + 2]! - xyz[i * 3 - 1]!);
          if (Math.abs(d - cell) > 1e-9) ok = false;
        }
        if (ok) { found = { tile, s, dim: tile === 'cubeEdge' ? 3 : 2 }; break; }
      }
    }
  }
  tileMemo.set(key, found);
  return found;
}

/**
 * The depth-n composition: each copy maps the unit chord onto its segment; a leaf emits `at` in its local frame —
 * the END of the unit chord for `path` (`null` = path mode), a tile centre for `cells`. The chord frame throughout.
 * ⚠️ `tops` are the STARTING SHAPE's copies (one transform + reverse flag each); null = the single unit chord, which is
 * exactly the pre-initiator composition, so a generator without one is unchanged.
 */
function emitCopies(walk: CustomWalk, depth: number, twist: number, at: readonly number[] | null,
  tops: { A: Affine; rev: boolean }[] | null): Float64Array {
  const k = walk.copies.length;
  const local: Affine[] = [];
  const rev: boolean[] = [];
  for (let i = 0; i < k; i++) {
    const c = walk.copies[i]!;
    const tau = c.orient + (c.twistable ? twist : 0);
    const A = affine();
    copyTransform(A, c.reverse ? walk.pts[i + 1]! : walk.pts[i]!, c.reverse ? walk.pts[i]! : walk.pts[i + 1]!, tau);
    local.push(A);
    rev.push(c.reverse);
  }
  const n = Math.max(1, Math.floor(depth));
  const topList = tops ?? [{ A: (() => { const t = affine(); t.a[0] = 1; t.a[4] = 1; t.a[8] = 1; return t; })(), rev: false }];
  const leaves = Math.pow(k, n) * topList.length;
  const xyz = new Float64Array((leaves + (at === null ? 1 : 0)) * 3);
  let m = 0;
  // The start point: (0,0,0) for both — a starting shape's walk begins at the origin, as the unit chord does.
  if (at === null) m = 1;
  // One scratch transform per level — the recursion allocates nothing per node (invariant 8; `buildGenerator`).
  const scratch: Affine[] = [];
  for (let d = 0; d <= n; d++) scratch.push(affine());
  const emit = (T: Affine, d: number, reversed: boolean): void => {
    if (d === 0) {
      if (at === null) {
        const u = reversed ? 0 : 1;
        xyz[m * 3] = T.o[0]! + T.a[0]! * u; xyz[m * 3 + 1] = T.o[1]! + T.a[3]! * u; xyz[m * 3 + 2] = T.o[2]! + T.a[6]! * u;
      } else {
        xyz[m * 3] = T.o[0]! + T.a[0]! * at[0]! + T.a[1]! * at[1]! + T.a[2]! * at[2]!;
        xyz[m * 3 + 1] = T.o[1]! + T.a[3]! * at[0]! + T.a[4]! * at[1]! + T.a[5]! * at[2]!;
        xyz[m * 3 + 2] = T.o[2]! + T.a[6]! * at[0]! + T.a[7]! * at[1]! + T.a[8]! * at[2]!;
      }
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
  for (const t of topList) emit(t.A, n, t.rev);
  return xyz;
}

/**
 * The starting shape's top-level copies, walked with the SAME law as the generator but NOT normalised (it may close,
 * so it has no chord to normalise by — the extent fit sizes the figure). Null when there is none; an error string for
 * a starting shape that cannot be walked.
 */
function initiatorTops(gen: CustomCurveGenerator, yaw: number, pitch: number, stretch: number, twist: number):
  { tops: { A: Affine; rev: boolean }[] | null; error: string | null } {
  if (gen.initiator === undefined) return { tops: null, error: null };
  if (gen.initiator.length < 1) return { tops: null, error: 'The starting shape needs at least one step.' };
  const w = walkRaw({ steps: gen.initiator }, yaw, pitch, stretch);
  if (w.error !== null) return { tops: null, error: `Starting shape: ${w.error}` };
  const tops: { A: Affine; rev: boolean }[] = [];
  for (let i = 0; i < w.copies.length; i++) {
    const c = w.copies[i]!;
    const A = affine();
    const a = w.raw[i]!, b = w.raw[i + 1]!;
    copyTransform(A, c.reverse ? b : a, c.reverse ? a : b, c.orient + (c.twistable ? twist : 0));
    tops.push({ A, rev: c.reverse });
  }
  return { tops, error: null };
}

/** The starting shape's validation failure at these values, or null (also null when there is no starting shape). */
export function customInitiatorError(gen: CustomCurveGenerator, yaw: number, pitch: number, stretch: number): string | null {
  return initiatorTops(gen, yaw, pitch, stretch, 0).error;
}

/**
 * Build a custom curve at `depth`, in the generator's captured frame. ⚠️ Returns null when the generator fails
 * validation at these values — the caller keeps its last valid build (spec §7.3), never divides by a zero chord.
 */
export function buildCustom(
  gen: CustomCurveGenerator, depth: number, yaw: number, pitch: number, twist: number, stretch: number,
  tile: CustomTile | null,
): { xyz: Float64Array; count: number } | null {
  const cells = gen.draw === 'cells' && tile !== null;
  const y = cells ? CUSTOM_CELL_YAW : yaw, p = cells ? CUSTOM_CELL_PITCH : pitch;
  const { walk } = walkCustom(gen, y, p, stretch);
  if (walk === null) return null;
  const init = initiatorTops(gen, y, p, stretch, twist);
  if (init.error !== null) return null;
  const xyz = emitCopies(walk, depth, twist, cells ? CUSTOM_TILE_CENTRE[tile.tile] : null, init.tops);
  const count = xyz.length / 3;
  const B = gen.frame.basis;
  if (B !== undefined && B.length === 9) {
    // A 3-D seed's captured frame: a full orthonormal basis.
    for (let i = 0; i < count; i++) {
      const u = xyz[i * 3]!, v = xyz[i * 3 + 1]!, w = xyz[i * 3 + 2]!;
      xyz[i * 3] = B[0]! * u + B[1]! * v + B[2]! * w;
      xyz[i * 3 + 1] = B[3]! * u + B[4]! * v + B[5]! * w;
      xyz[i * 3 + 2] = B[6]! * u + B[7]! * v + B[8]! * w;
    }
    return { xyz, count };
  }
  // Into the captured frame: an in-plane rotation and a mirror (about the view axis, so z is untouched).
  const a = (gen.frame.rotate * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), my = gen.frame.mirror ? -1 : 1;
  for (let i = 0; i < count; i++) {
    const x = xyz[i * 3]!, yy = xyz[i * 3 + 1]! * my;
    xyz[i * 3] = c * x - s * yy;
    xyz[i * 3 + 1] = s * x + c * yy;
  }
  return { xyz, count };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Seeding from a named rule, and structural equality (spec §3.2, `39.D8`)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Whether a rule can seed `Customize`: it needs an EXACT structure (`ruleStructure`). ⚠️ Bush 3D has none and cannot
 * have one in this model: it is a GROWTH rule (each level adds branches at the tips and lengthens the stems), not a
 * self-similar subdivision — a plant-growth editor is a FUTURE phase. So the option is DISABLED there, with that reason.
 */
export function customSeedable(key: RuleKey): boolean {
  return ruleStructure(key) !== null;
}

/**
 * For each step, the index of the move a RETRACE walks back along (LIFO, spec §2.2.1), or -1 — for a move, and for
 * a retrace with nothing open. ⚠️ The ONE derivation of the pairing: the walk, the editor's derived cells and the
 * delete-with-partner rule all read it, so they cannot disagree about which move a retrace belongs to.
 */
export function retracePartners(steps: readonly CustomCurveStep[]): number[] {
  const out: number[] = [];
  const open: number[] = [];
  steps.forEach((s, i) => {
    if (s.kind === 'move') { open.push(i); out.push(-1); return; }
    const p = open.pop();
    out.push(p === undefined ? -1 : p);
  });
  return out;
}

/**
 * The PARAMETER-INDEPENDENT half of validation (V1: step count, every retrace partnered, every length > 0). A stored
 * generator failing it cannot be drawn at ANY angle, so it resolves to the default rule on load (spec §3.5) — the
 * generator itself is KEPT in the preset, so choosing `Customize` shows it with its error rather than destroying it.
 */
export function customStructureError(gen: CustomCurveGenerator): string | null {
  const k = gen.steps.length;
  if (k < CUSTOM_K_MIN) return `A generator needs at least ${CUSTOM_K_MIN} steps.`;
  if (k > CUSTOM_K_MAX) return `A generator can have at most ${CUSTOM_K_MAX} steps.`;
  const partners = retracePartners(gen.steps);
  for (let i = 0; i < k; i++) {
    const s = gen.steps[i]!;
    if (s.kind === 'retrace' && partners[i] === -1) return `Step ${i + 1} retraces nothing.`;
    if (s.kind === 'move' && !(Number.isFinite(s.turn) && Number.isFinite(s.lift) && Number.isFinite(s.length) && s.length > 0)) {
      return `Step ${i + 1} needs a length above 0.`;
    }
  }
  return null;
}

const near = (v: number): number => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);

/** A rule's structure: its generator steps, draw mode and (Moore) starting shape — parameter-free. */
export interface RuleStructure { steps: CustomCurveStep[]; draw: 'path' | 'cells'; initiator?: CustomCurveStep[] }

/**
 * ⚠️⚠️ **CUSTOMIZE-ONLY STRUCTURES, KEPT APART FROM `LSYSTEM_GENERATORS` ON PURPOSE.** That table also decides the
 * named rule's Twist/Stretch rows, and Hilbert 3D was left out of it because Twist turned it into a tangle — which
 * silently made it un-customizable too. Two questions, two tables: an entry here seeds `Customize` and changes NOTHING
 * about the named rule. Each was found by an exhaustive search through THIS module's own composition and is exact
 * against the turtle (`figurecheck` §K2; search `p68-search.mjs`).
 */
const mv = (turn: number, lift: number, orient: 0 | 90 | 180 | 270): CustomCurveStep =>
  ({ kind: 'move', turn, lift, length: 1, reverse: false, orient, twistable: false, stretchable: false });
const CUSTOM_ONLY_STRUCTURES: Partial<Record<RuleKey, () => RuleStructure>> = {
  /*
   * Hilbert 3D — eight unit moves on the cube lattice (Turn/Lift at 90°, NO Roll needed), each copy oriented, none
   * reversed, drawn through the centre of the CUBE with the copy as an edge. The ONE exact set among all 4⁸ orientations
   * (`p68-search.mjs`), equal to Stage A's (`p39cells-twist.mjs`), exact at depths 2–4.
   */
  hilbert3d: () => ({
    draw: 'cells',
    steps: [mv(1, 0, 90), mv(0, 1, 270), mv(0, 0, 270), mv(-1, 0, 180), mv(0, 0, 180), mv(-1, 0, 270), mv(0, 0, 270), mv(0, 1, 90)],
  }),
  /*
   * Moore — Hilbert 2D's generator, laid along a STARTING SHAPE of four steps: up the square's centre line, a U-turn,
   * and back down (turns 0, 0, 2, 0). ⚠️ That shape is not a workaround: Moore's four Hilbert quadrants have their
   * chords ON the centre line, and each square tile lies to one side of its segment, so the forward pass fills one
   * half and the return the other. 128 starting shapes are exact (the square's symmetries); this is the one with no
   * flags, and NO shape walking round the square is (`p68-moore-pick.mjs`). Exact at depths 1–4.
   */
  moore: () => {
    const h = ruleStructure('hilbert2d')!;
    return { draw: 'cells', steps: h.steps.map((s) => ({ ...s })), initiator: [mv(0, 0, 0), mv(0, 0, 0), mv(2, 0, 0), mv(0, 0, 0)] };
  },
};

/** The STRUCTURE of a rule's generator — its steps and draw mode, independent of every parameter. Memoised. */
const structureMemo = new Map<string, RuleStructure | null>();
export function ruleStructure(key: RuleKey): RuleStructure | null {
  if (structureMemo.has(key)) return structureMemo.get(key)!;
  const flags = LSYSTEM_GENERATORS[key];
  const rule = LSYSTEM_RULE_BY_KEY[key];
  let out: RuleStructure | null = CUSTOM_ONLY_STRUCTURES[key]?.() ?? null;
  if (out === null && flags !== null) {
    const has = (list: readonly number[], i: number): boolean => list.includes(i + 1);
    if (flags.cells !== undefined) {
      out = {
        draw: 'cells',
        steps: flags.cells.units.map((u, i) => ({
          kind: 'move' as const, turn: u, lift: 0, length: 1, reverse: has(flags.reverse, i),
          orient: (has(flags.orient180, i) ? 180 : 0) as 0 | 180, twistable: has(flags.twistable, i), stretchable: false,
        })),
      };
    } else {
      // The depth-1 walk at the published angle: turn units are heading changes / yaw, and a segment that undoes
      // the most recent OPEN move is a RETRACE (the Plant's return legs).
      const a = rule.publishedAngle;
      const w = walkTurtle(rule, 1, a, a, a);
      const steps: CustomCurveStep[] = [];
      const open: { vx: number; vy: number; before: number }[] = [];
      let theta = NaN;
      for (let i = 1; i < w.count; i++) {
        const vx = w.xyz[i * 3]! - w.xyz[i * 3 - 3]!, vy = w.xyz[i * 3 + 1]! - w.xyz[i * 3 - 2]!;
        const top = open[open.length - 1];
        if (top !== undefined && Math.abs(vx + top.vx) < 1e-9 && Math.abs(vy + top.vy) < 1e-9) {
          open.pop();
          steps.push({ kind: 'retrace' });
          theta = top.before;
          continue;
        }
        const ang = Math.atan2(vy, vx);
        const before = Number.isNaN(theta) ? ang : theta;
        let d = ((ang - before) * 180) / Math.PI;
        d = ((d + 540) % 360) - 180;
        steps.push({
          kind: 'move', turn: near(d / a), lift: 0, length: near(Math.hypot(vx, vy)),
          reverse: has(flags.reverse, i - 1), orient: (has(flags.orient180, i - 1) ? 180 : 0) as 0 | 180,
          twistable: has(flags.twistable, i - 1), stretchable: has(flags.stretchable, i - 1),
        });
        open.push({ vx, vy, before });
        theta = ang;
      }
      out = { draw: 'path', steps };
    }
  }
  structureMemo.set(key, out);
  return out;
}

/** One move, every field at its identity — what `+ Move` / ticking `Starting shape` creates. */
const isTrivialInitiator = (ini: readonly CustomCurveStep[]): boolean =>
  ini.length === 1 && JSON.stringify(ini[0]) === JSON.stringify(newMoveStep());

const sameSteps = (a: readonly CustomCurveStep[], b: readonly CustomCurveStep[]): boolean =>
  a.length === b.length && a.every((s, i) => JSON.stringify(s) === JSON.stringify(b[i]));

/**
 * ⚠️⚠️ **`39.D8`'s equality: deep, exact, over steps and draw — never over parameters, and never against a
 * remembered seed source**, so an unedited `Customize` preset reloaded later still finds its rule with no
 * `basedOn` field persisted. Returns the FIRST matching rule in library order.
 */
export function customMatchesRule(gen: CustomCurveGenerator): RuleKey | null {
  for (const r of LSYSTEM_RULES) {
    const st = ruleStructure(r.key);
    if (st === null || st.draw !== gen.draw || !sameSteps(st.steps, gen.steps)) continue;
    /*
     * The starting shape is structure too: both absent, or both equal. ⚠️ A starting shape of ONE plain straight step
     * IS the absent one (it lays a single copy along the unit chord), so ticking `Starting shape` keeps the rule — the
     * toggle is a no-op like choosing Customize, rather than silently moving the figure onto the custom path.
     */
    const g = gen.initiator !== undefined && isTrivialInitiator(gen.initiator) ? undefined : gen.initiator;
    if ((st.initiator === undefined) !== (g === undefined)) continue;
    if (st.initiator !== undefined && !sameSteps(st.initiator, g!)) continue;
    return r.key;
  }
  return null;
}

/**
 * Seed a custom generator from a named rule at the CURRENT parameters (spec §3.2's seed, taken when `Customize` is
 * chosen). ⚠️ The frame is FITTED, not guessed: the custom build at the current recursion floor is matched to the
 * rule's own drawing by a similarity (rotation + optional mirror); a fit that is not exact refuses the seed.
 */
export function seedCustom(key: RuleKey, recursion: number, yaw: number, pitch: number, roll: number):
  CustomCurveGenerator | null {
  const st = ruleStructure(key);
  if (st === null) return null;
  const rule = LSYSTEM_RULE_BY_KEY[key];
  const n = Math.max(1, Math.min(rule.recursionRange[1], Math.floor(recursion)));
  const cells = st.draw === 'cells';
  const probe: CustomCurveGenerator = {
    steps: st.steps.map((s) => ({ ...s })), draw: st.draw, frame: { rotate: 0, mirror: false },
    ...(st.initiator !== undefined ? { initiator: st.initiator.map((s) => ({ ...s })) } : {}),
  };
  const tile = cells ? customTile(probe) : null;
  if (cells && tile === null) return null;
  const frameAt = (y: number, p: number, r: number): CustomCurveGenerator['frame'] | null => {
    const ref = cells
      ? walkTurtle(rule, n, rule.publishedAngle, rule.publishedAngle, rule.publishedAngle)
      : walkTurtle(rule, n, y, p, r);
    const mine = buildCustom(probe, n, y, p, 0, 1, tile);
    if (mine === null || mine.count !== ref.count || ref.count < 3) return null;
    // ⚠️ A figure that leaves the plane needs a full 3-D frame; an in-plane rotation cannot capture it.
    let flat = true;
    for (let i = 0; i < ref.count && flat; i++) if (Math.abs(ref.xyz[i * 3 + 2]!) > 1e-9) flat = false;
    return flat ? similarityFit(mine.xyz, ref.xyz, ref.count) : latticeFit(mine.xyz, ref.xyz, ref.count);
  };
  /*
   * ⚠️ At an angle where the generator has NO CHORD (Lévy C / Knopp near 90°, V2) the frame cannot be fitted there,
   * so it is taken at the rule's PUBLISHED angle instead. Nothing changes on screen: an unedited seed is drawn by the
   * rule itself (`resolveCustomRule`), and the frame only matters once an edit leaves the rule.
   */
  const fit = frameAt(yaw, pitch, roll)
    ?? frameAt(rule.publishedAngle, rule.publishedAngle, rule.publishedAngle);
  if (fit === null) return null;
  return { ...probe, frame: fit };
}

/**
 * The 3-D frame of a LATTICE seed: the signed permutation (one of 48) that carries the custom build onto the rule's
 * own cells, after both are centred and scaled to unit step. Null unless exact to 1e-6. ⚠️ Lattice-only on purpose:
 * the only 3-D seed is Hilbert 3D, whose cells lie on the cube grid, so the exact answer is one of these 48 — a general
 * rotation fit would be a numerical answer to a question that has an exact one.
 */
function latticeFit(src: Float64Array, ref: Float64Array, n: number): CustomCurveGenerator['frame'] | null {
  const prep = (q: Float64Array): number[][] => {
    const c = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) c[a]! += q[i * 3 + a]! / n;
    let step = 0;
    for (let i = 1; i < n; i++) step += Math.hypot(q[i * 3]! - q[i * 3 - 3]!, q[i * 3 + 1]! - q[i * 3 - 2]!, q[i * 3 + 2]! - q[i * 3 - 1]!);
    step /= Math.max(1, n - 1);
    const out: number[][] = [];
    for (let i = 0; i < n; i++) out.push([0, 1, 2].map((a) => (q[i * 3 + a]! - c[a]!) / (step || 1)));
    return out;
  };
  const S = prep(src), R = prep(ref);
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) for (let sg = 0; sg < 8; sg++) {
    const sign = [sg & 1 ? -1 : 1, sg & 2 ? -1 : 1, sg & 4 ? -1 : 1];
    let err = 0;
    for (let i = 0; i < n && err < 1e-6; i++) {
      for (let a = 0; a < 3; a++) err = Math.max(err, Math.abs(sign[a]! * S[i]![p[a]!]! - R[i]![a]!));
    }
    if (err < 1e-6) {
      // Row a of the basis picks source axis p[a] with sign[a]: out[a] = sign[a] · in[p[a]].
      const basis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let a = 0; a < 3; a++) basis[a * 3 + p[a]!] = sign[a]!;
      return { rotate: 0, mirror: false, basis };
    }
  }
  return null;
}

/** Fit `ref ≈ t + b · (mirror ? conj(src) : src)` in the plane; null unless exact to 1e-6 of the extent. */
function similarityFit(src: Float64Array, ref: Float64Array, n: number): { rotate: number; mirror: boolean } | null {
  let ext = 0;
  for (let i = 0; i < n; i++) ext = Math.max(ext, Math.abs(ref[i * 3]!), Math.abs(ref[i * 3 + 1]!));
  let best: { rotate: number; mirror: boolean; err: number } | null = null;
  for (const mirror of [false, true]) {
    const sy = (i: number): number => (mirror ? -src[i * 3 + 1]! : src[i * 3 + 1]!);
    const j = n - 1;
    const dsr = src[j * 3]! - src[0]!, dsi = sy(j) - sy(0);
    const drr = ref[j * 3]! - ref[0]!, dri = ref[j * 3 + 1]! - ref[1]!;
    const den = dsr * dsr + dsi * dsi;
    if (!(den > 0)) continue;
    const br = (drr * dsr + dri * dsi) / den, bi = (dri * dsr - drr * dsi) / den;
    const ar = ref[0]! - (br * src[0]! - bi * sy(0)), ai = ref[1]! - (br * sy(0) + bi * src[0]!);
    let err = 0;
    for (let i = 0; i < n; i++) {
      const x = ar + br * src[i * 3]! - bi * sy(i), y = ai + br * sy(i) + bi * src[i * 3]!;
      err = Math.max(err, Math.hypot(x - ref[i * 3]!, y - ref[i * 3 + 1]!));
    }
    if (best === null || err < best.err) best = { rotate: (Math.atan2(bi, br) * 180) / Math.PI, mirror, err };
  }
  if (best === null || !(best.err <= 1e-6 * Math.max(ext, 1e-12))) return null;
  // The z scale of a planar figure is irrelevant (z = 0); a rotation, not a scale, is what the frame stores.
  return { rotate: best.rotate, mirror: best.mirror };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// The ONE resolver (spec §3.4), and the density readout (`39.D6`)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

const resolvedMemo = new WeakMap<CustomCurveGenerator, ResolvedCurveRule>();

export type ResolvedCurveRule =
  | { readonly kind: 'named'; readonly rule: LSystemRule; readonly customizedFrom: boolean }
  | { readonly kind: 'custom'; readonly gen: CustomCurveGenerator; readonly tile: CustomTile | null; readonly maxDepth: number };

/**
 * ⚠️⚠️ **THE ONE READER OF `custom` (spec §3.4).** `rule === 'customize'` with a generator that equals a library
 * rule resolves to THAT RULE (`customizedFrom: true`) — the no-op. An unknown key, or `customize` with no
 * generator, resolves to the default rule (spec §3.5). Every other site — the engine, the Score, the Composer —
 * calls this and never reads `cfg.custom` itself.
 */
export function resolveCustomRule(cfg: Pick<LSystemConfig, 'rule' | 'custom'>): ResolvedCurveRule {
  if (cfg.rule === CUSTOM_RULE_KEY && cfg.custom !== undefined) {
    /*
     * ⚠️ Memoised by generator IDENTITY: this runs every frame and the structural comparison builds strings, so an
     * unmemoised call is an allocation RATE (invariant 8). ⚠️⚠️ **So a generator is NEVER mutated in place** — every
     * editor commit builds a new object (`composer.ts`), or this memo would hand back the old resolution.
     */
    const hit = resolvedMemo.get(cfg.custom);
    if (hit !== undefined) return hit;
    const match = customMatchesRule(cfg.custom);
    const tile = cfg.custom.draw === 'cells' ? customTile(cfg.custom) : null;
    const r: ResolvedCurveRule = match !== null
      ? { kind: 'named', rule: LSYSTEM_RULE_BY_KEY[match], customizedFrom: true }
      : customStructureError(cfg.custom) !== null
        ? { kind: 'named', rule: LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE], customizedFrom: false }
        : { kind: 'custom', gen: cfg.custom, tile, maxDepth: customMaxDepth(cfg.custom.steps.length, cfg.custom.initiator?.length ?? 1) };
    resolvedMemo.set(cfg.custom, r);
    return r;
  }
  const rule = LSYSTEM_RULE_BY_KEY[cfg.rule as RuleKey] ?? LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE];
  return { kind: 'named', rule, customizedFrom: false };
}

/**
 * The density bands: `even` ≤ `clean`, `uneven` ≤ `uneven`, `clumpy` above. ⚠️⚠️ **CALIBRATED ON THE NAMED RULES IN
 * THIS ENGINE, NOT COPIED FROM THE SPEC** (whose 2.5 / 7.6 belong to a different metric in a prototype this tree does
 * not hold). Measured 2026-11-05 with `customDensity` at each rule's published angle, recursion 4: the fifteen span
 * 1.00 (Hilbert 3D) to 5.33 (Bush 3D), median 2.25 — 9 even, 6 uneven, 0 clumpy — so `clumpy` means *worse than
 * anything the library ships*; a 160° hairpin generator reads 6.20.
 */
export const CUSTOM_DENSITY_BANDS = { clean: 2.5, uneven: 5.5 } as const;

/**
 * The density readout: how unevenly the curve covers space — density IS brightness in this engine. The build is
 * resampled to 4 096 points along its length (what the engine draws), binned on a 32-cell grid over its extent,
 * and the readout is the p99 / median of the occupied cells' counts. 1 is perfectly even; a self-overlapping
 * generator piles points into a few cells and reads high.
 */
export function customDensity(xyz: Float64Array, count: number): number {
  if (count < 2) return 1;
  const N = 4096;
  const cum = new Float64Array(count);
  for (let i = 1; i < count; i++) {
    cum[i] = cum[i - 1]! + Math.hypot(xyz[i * 3]! - xyz[i * 3 - 3]!, xyz[i * 3 + 1]! - xyz[i * 3 - 2]!, xyz[i * 3 + 2]! - xyz[i * 3 - 1]!);
  }
  const total = cum[count - 1]!;
  if (!(total > 0)) return 1;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a]!, xyz[i * 3 + a]!); hi[a] = Math.max(hi[a]!, xyz[i * 3 + a]!); }
  const span = Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) || 1;
  const G = 32;
  const bins = new Map<number, number>();
  let j = 0;
  for (let q = 0; q < N; q++) {
    const t = (q / (N - 1)) * total;
    while (j < count - 2 && cum[j + 1]! < t) j++;
    const seg = cum[j + 1]! - cum[j]!;
    const f = seg > 0 ? (t - cum[j]!) / seg : 0;
    const c = [0, 1, 2].map((a) => xyz[j * 3 + a]! + (xyz[(j + 1) * 3 + a]! - xyz[j * 3 + a]!) * f);
    const ix = c.map((v, a) => Math.min(G - 1, Math.floor(((v - lo[a]!) / span) * G)));
    const id = (ix[0]! * G + ix[1]!) * G + ix[2]!;
    bins.set(id, (bins.get(id) ?? 0) + 1);
  }
  const counts = [...bins.values()].sort((a, b) => a - b);
  const med = counts[Math.floor(counts.length / 2)]!;
  const p99 = counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.99))]!;
  return p99 / med;
}
