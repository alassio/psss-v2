/**
 * @file v8 Phase 44 (`44.B`) — **`Customize` for the PLANTS: their own productions, edited.**
 *
 * ⚠️⚠️ **IMPORTS ONLY ITS SIBLINGS AND TYPES (`36.D2`)** — the Score draws this figure type and the checkers load it
 * under bare Node, which strips types only. No `enum`, no class, no parameter property. It does NOT import `custom.ts`
 * (which imports this module): the one shared budget is restated below and held equal by `figurecheck` §T.
 *
 * THE MODEL. A plant is an axiom plus productions (`X → F[+X]F[-X]+X`, `F → FF`) — not "a segment replaced by a copy",
 * so the generator editor cannot express six of the ten (`customSeedable`'s header). The block (`CustomProductions`)
 * stores the productions as DATA; the resolver turns an edited block into a SYNTHESIZED `LSystemRule`, so every reader
 * treats it as a named rule and draws it through the turtle path — growth by generation, Taper, Seed, leaf outlines
 * and the Score all come for free.
 *
 * ⚠️⚠️ **CHOOSING `Customize` IS A VISUAL NO-OP BY ROUTING (`39.D8`)**: while a block's axiom and productions are
 * DEEP-EQUAL to a plant's, it resolves to THAT plant. Equality is by content alone — `family` never enters it.
 */

import type { CustomProductions } from '../../core/interfaces.ts';
import { LSYSTEM_RULES, LSYSTEM_RULE_BY_KEY, isStochasticRule, type LSystemRule, type Production, type RuleKey } from './rules.ts';
import { expandRule, EXPAND_SYMBOL_BUDGET } from './turtle.ts';

/**
 * The point budget a custom figure may reach — ⚠️ the SAME number as `custom.ts`' `CUSTOM_SEGMENT_BUDGET` (restated:
 * this module cannot import that one), held equal by `figurecheck` §T.
 */
export const PRODUCTION_POINT_BUDGET = 65_536;
/** `44.X3` — the editor's limits; the validator enforces them on import too. */
export const PRODUCTION_LIMITS = { productions: 8, alternatives: 4, chips: 40, axiom: 16, maxDepth: 8 } as const;
/** `44.B4` — a random alternative's weight: 0.05–1 in steps of 0.05. */
export const PRODUCTION_WEIGHT = { min: 0.05, max: 1, step: 0.05 } as const;

/** The symbol groups — ONE table, read by the validator, the palette and the chip colours. */
export const PRODUCTION_SYMBOLS = {
  draw: 'FG',
  move: 'f',
  turn: '+-&^/\\|<>',
  branch: '[]',
  leaf: '{}',
  /** `44.X4` — the book's width / colour marks: the turtle IGNORES them; kept verbatim, never offered. */
  mark: '!\'',
} as const;
/** A non-terminal letter (it may carry a production). ⚠️ `f` is the pen-up move, never a letter here. */
export const isProductionLetter = (c: string): boolean => c.length === 1 && c >= 'A' && c <= 'Z';
const KNOWN = (c: string): boolean => isProductionLetter(c) || Object.values(PRODUCTION_SYMBOLS).some((g) => g.includes(c));

/** Is this `custom` block the production kind? (Absent `kind` = a generator — every stored preset.) */
export function isProductionsBlock(c: unknown): c is CustomProductions {
  return typeof c === 'object' && c !== null && (c as { kind?: unknown }).kind === 'productions';
}

/** The rules the production editor is offered on (`44.D4`): every PLANT, in library order. */
export function productionFamilies(): readonly LSystemRule[] {
  return LSYSTEM_RULES.filter((r) => r.plant === true);
}

const copyProduction = (p: Production): string | { p: number; to: string }[] =>
  typeof p === 'string' ? p : p.map((c) => ({ p: c.p, to: c.to }));

/** Seed a block from a plant — a DEEP copy of its axiom and productions (`44.B5.9`: choosing it changes nothing). */
export function seedProductions(key: RuleKey): CustomProductions | null {
  const r = LSYSTEM_RULE_BY_KEY[key];
  if (r === undefined || r.plant !== true || r.builder !== undefined) return null;
  const productions: Record<string, string | { p: number; to: string }[]> = {};
  for (const k of Object.keys(r.productions)) productions[k] = copyProduction(r.productions[k]!);
  return { kind: 'productions', family: key, axiom: r.axiom, productions };
}

const sameProduction = (a: Production | undefined, b: Production | undefined): boolean => {
  if (a === undefined || b === undefined) return a === b;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.length === b.length && a.every((c, i) => c.p === b[i]!.p && c.to === b[i]!.to);
};

/** The plant a block's content equals (axiom and productions, deep, weights exact), first in library order, or null. */
export function productionsMatchRule(block: CustomProductions): RuleKey | null {
  const fam = LSYSTEM_RULE_BY_KEY[block.family as RuleKey];
  for (const r of productionFamilies()) {
    if (r.axiom !== block.axiom) continue;
    // A leaf outline reads `{…}` differently from a legacy rule, so the reading must match too.
    if (fam !== undefined && (r.polygons ?? 'legacy') !== (fam.polygons ?? 'legacy')) continue;
    const ka = Object.keys(r.productions).sort(), kb = Object.keys(block.productions).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) continue;
    if (ka.every((k) => sameProduction(r.productions[k], block.productions[k]))) return r.key;
  }
  return null;
}

/** Every replacement text of a block (the axiom first), for the alphabet scans. */
export function blockTexts(block: CustomProductions): string[] {
  const out = [block.axiom];
  for (const k of Object.keys(block.productions)) {
    const p = block.productions[k]!;
    if (typeof p === 'string') out.push(p); else for (const c of p) out.push(c.to);
  }
  return out;
}

/**
 * The points the turtle would emit for an expanded string — an UPPER BOUND, from the text alone (no geometry): a draw
 * symbol emits one; `f` emits inside an outline; `}` closes an outline with at most one; `]` re-emits every point
 * since its `[` (the turtle's retrace: `sink.n − mark`). ⚠️ The closing point is emitted only across a real gap, so
 * the count can exceed the walk — never fall short of it (`figurecheck` §T4).
 */
export function countPoints(text: string, drawSymbols: string, outline: boolean): number {
  let pts = 1, inPoly = false;
  const marks: number[] = [];
  for (const c of text) {
    if (c === 'F' || c === 'G' || (drawSymbols.length > 0 && drawSymbols.includes(c))) pts++;
    else if (c === 'f') { if (outline && inPoly) pts++; }
    else if (c === '{') { if (outline) inPoly = true; }
    else if (c === '}') { if (outline && inPoly) { pts++; inPoly = false; } }
    else if (c === '[') marks.push(pts);
    else if (c === ']') { const m = marks.pop(); if (m !== undefined) { pts += pts - m; inPoly = false; } }
  }
  return pts;
}

/** Spread seeds (CLAUDE *Verify*: consecutive seeds correlate on the first draw) for a random block's worst case. */
const MEASURE_SEEDS = [1, 98, 1_001, 7_919, 31_337, 65_521, 99_991, 123_457, 271_829, 314_159, 424_243, 577_215, 662_607,
  777_767, 881_917, 999_983] as const;

/**
 * `44.B3` — **the deepest recursion that fits, MEASURED**: the largest `d ≤ maxDepth` whose expansion does not exceed
 * `EXPAND_SYMBOL_BUDGET` and whose point count stays within `PRODUCTION_POINT_BUDGET` — over 16 spread seeds for a
 * random rule (its worst case). 0 = even depth 1 does not fit (the editor refuses that edit).
 */
export function measureMaxDepth(rule: LSystemRule): number {
  const seeds: readonly number[] = isStochasticRule(rule) ? MEASURE_SEEDS : [0];
  const outline = rule.polygons === 'outline';
  let best = 0;
  for (let d = 1; d <= PRODUCTION_LIMITS.maxDepth; d++) {
    let fits = true;
    for (const sd of seeds) {
      const e = expandRule(rule, d, sd);
      if (e.truncated || e.text.length > EXPAND_SYMBOL_BUDGET || countPoints(e.text, rule.drawSymbols, outline) > PRODUCTION_POINT_BUDGET) {
        fits = false;
        break;
      }
    }
    if (!fits) break;
    best = d;
  }
  return best;
}

/** Does some draw symbol stay REACHABLE from the axiom through the productions? (`44.B4`: a rule must draw.) */
export function blockDraws(block: CustomProductions, drawSymbols: string, outline: boolean): boolean {
  const seen = new Set<string>();
  const todo: string[] = [block.axiom];
  while (todo.length > 0) {
    const t = todo.pop()!;
    let inPoly = false;
    for (const c of t) {
      if (c === 'F' || c === 'G' || drawSymbols.includes(c)) return true;
      if (c === '{') inPoly = true;
      else if (c === '}') inPoly = false;
      else if (c === 'f' && outline && inPoly) return true;
      if (isProductionLetter(c) && !seen.has(c)) {
        seen.add(c);
        const p = block.productions[c];
        if (p !== undefined) { if (typeof p === 'string') todo.push(p); else for (const a of p) todo.push(a.to); }
      }
    }
  }
  return false;
}

/** The validation of one text: its symbols, its pairs, no nested braces. Null when valid. */
function textError(t: string, where: string): string | null {
  let sq = 0, br = 0;
  for (const c of t) {
    if (!KNOWN(c)) return `${where}: "${c}" is not a symbol this editor knows.`;
    if (c === '[') sq++;
    else if (c === ']') { if (--sq < 0) return `${where}: a branch closes that was never opened.`; }
    else if (c === '{') { if (br > 0) return `${where}: a leaf cannot open inside another leaf.`; br++; }
    else if (c === '}') { if (--br < 0) return `${where}: a leaf closes that was never opened.`; }
  }
  if (sq !== 0) return `${where}: a branch is never closed.`;
  if (br !== 0) return `${where}: a leaf is never closed.`;
  return null;
}

export interface ProductionsValidation {
  /** The hard failure (the block cannot be drawn), or null. */
  readonly error: string | null;
  /** Soft notes for the status line (allowed). */
  readonly notes: readonly string[];
}

/**
 * `44.B4` — **the hard rules and the soft notes.** The editor makes most hard failures UNREACHABLE (pairs by
 * construction, a disabled last draw, refused insertions); this function is the gate for everything else — an
 * imported block above all, which resolves to the default rule rather than being "repaired".
 */
export function validateProductions(block: CustomProductions): ProductionsValidation {
  const fail = (error: string): ProductionsValidation => ({ error, notes: [] });
  const fam = LSYSTEM_RULE_BY_KEY[block.family as RuleKey];
  if (fam === undefined || fam.plant !== true || fam.builder !== undefined) return fail('This block names no plant it was seeded from.');
  if (typeof block.axiom !== 'string' || block.axiom.length === 0) return fail('The axiom is empty.');
  const axiomLen = [...block.axiom].length;
  if (axiomLen > PRODUCTION_LIMITS.axiom) return fail(`The axiom can have at most ${PRODUCTION_LIMITS.axiom} symbols.`);
  const keys = Object.keys(block.productions ?? {});
  if (keys.length > PRODUCTION_LIMITS.productions) return fail(`A plant can have at most ${PRODUCTION_LIMITS.productions} productions.`);
  const e0 = textError(block.axiom, 'Axiom');
  if (e0 !== null) return fail(e0);
  for (const k of keys) {
    if (!isProductionLetter(k)) return fail(`"${k}" cannot have a production — only capital letters can.`);
    const p = block.productions[k]!;
    const alts = typeof p === 'string' ? [{ p: 1, to: p }] : p;
    if (!Array.isArray(alts) && typeof p !== 'string') return fail(`The ${k} production is not readable.`);
    if (typeof p !== 'string') {
      if (alts.length < 2 || alts.length > PRODUCTION_LIMITS.alternatives) return fail(`The ${k} production needs 2–${PRODUCTION_LIMITS.alternatives} alternatives.`);
      let sum = 0;
      for (const a of alts) {
        if (!(typeof a.p === 'number' && a.p > 0 && a.p <= 1)) return fail(`A ${k} alternative has no valid weight.`);
        sum += a.p;
      }
      if (Math.abs(sum - 1) > 1e-9) return fail(`The ${k} alternatives' weights do not add up to 100 %.`);
    }
    for (const a of alts) {
      if (typeof a.to !== 'string') return fail(`The ${k} production is not readable.`);
      if ([...a.to].length > PRODUCTION_LIMITS.chips) return fail(`A ${k} production can have at most ${PRODUCTION_LIMITS.chips} symbols.`);
      const e = textError(a.to, `${k} production`);
      if (e !== null) return fail(e);
    }
  }
  const outline = fam.polygons === 'outline';
  if (!blockDraws(block, fam.drawSymbols, outline)) return fail('Nothing draws: no F is reachable from the axiom.');
  const notes: string[] = [];
  const used = new Set<string>();
  for (const t of blockTexts(block)) for (const c of t) if (isProductionLetter(c)) used.add(c);
  for (const c of [...used].sort()) {
    if (c !== 'F' && c !== 'G' && !fam.drawSymbols.includes(c) && block.productions[c] === undefined) notes.push(`${c} has no production — it draws nothing.`);
  }
  for (const k of keys.sort()) if (!used.has(k)) notes.push(`Nothing uses the ${k} production.`);
  return { error: null, notes };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// The synthesized rule (`44.B2`)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/** The angle range of an edited plant — `CUSTOM_RANGES.yaw` restated (`figurecheck` §T holds them equal). */
export const PRODUCTION_ANGLE_RANGE: readonly [number, number] = [1, 179];

const synthMemo = new WeakMap<CustomProductions, LSystemRule | null>();

/**
 * `44.B2` — **the edited block as a rule**, memoised by BLOCK IDENTITY (invariant 8: the resolver runs per frame;
 * ⚠️ a block is never mutated in place — every editor commit builds a new object). Null when the block fails
 * validation or does not fit at depth 1.
 */
export function synthesizeRule(block: CustomProductions): LSystemRule | null {
  if (synthMemo.has(block)) return synthMemo.get(block)!;
  const v = validateProductions(block);
  let out: LSystemRule | null = null;
  if (v.error === null) {
    const fam = LSYSTEM_RULE_BY_KEY[block.family as RuleKey];
    const productions: Record<string, Production> = {};
    for (const k of Object.keys(block.productions)) productions[k] = copyProduction(block.productions[k]!);
    const texts = blockTexts(block);
    const draft: LSystemRule = {
      key: fam.key,
      name: fam.name,
      axiom: block.axiom,
      productions,
      ...(fam.polygons !== undefined ? { polygons: fam.polygons } : {}),
      plant: true,
      drawSymbols: fam.drawSymbols,
      publishedAngle: fam.publishedAngle,
      angleRange: PRODUCTION_ANGLE_RANGE,
      recursionRange: [1, PRODUCTION_LIMITS.maxDepth],
      bracketed: texts.some((t) => t.includes('[')),
      closed: false,
      zoomInverse: false,
      provenance: `v8 Phase 44: productions edited from ${fam.name}`,
      synthesized: true,
    };
    const rMax = measureMaxDepth(draft);
    if (rMax >= 1) {
      // ⚠️ The family's own minimum (Flowering Plant starts at 2: its depth 1 is one point), never above `rMax`.
      out = {
        ...draft,
        recursionRange: [Math.min(fam.recursionRange[0], rMax), rMax],
        ...(fam.defaultRecursion !== undefined ? { defaultRecursion: Math.min(rMax, fam.defaultRecursion) } : {}),
      };
    }
  }
  synthMemo.set(block, out);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Editing operations (`44.B4`/`44.B5.5`) — PURE, on one text and a caret, so the editor and the checkers share them
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/** An edit's result: the new text and caret, or a refusal with its reason (the editor shows it, commits nothing). */
export type TextEdit = { readonly text: string; readonly caret: number } | { readonly refused: string };

const OPENER: Record<string, string> = { '[': ']', '{': '}' };
const CLOSER: Record<string, string> = { ']': '[', '}': '{' };

/** Is `caret` inside a `{…}` of `text`? (Braces never nest — the turtle has ONE open polygon.) */
export function insideLeaf(text: string, caret: number): boolean {
  let open = false;
  for (let i = 0; i < caret && i < text.length; i++) { if (text[i] === '{') open = true; else if (text[i] === '}') open = false; }
  return open;
}

/** The index of the partner of the pair character at `i`, or -1. */
export function pairPartner(text: string, i: number): number {
  const c = text[i]!;
  if (OPENER[c] !== undefined) {
    let d = 0;
    for (let j = i; j < text.length; j++) { if (text[j] === c) d++; else if (text[j] === OPENER[c]) { d--; if (d === 0) return j; } }
  } else if (CLOSER[c] !== undefined) {
    let d = 0;
    for (let j = i; j >= 0; j--) { if (text[j] === c) d++; else if (text[j] === CLOSER[c]) { d--; if (d === 0) return j; } }
  }
  return -1;
}

/**
 * Insert `sym` at `caret`. ⚠️ **Pairs by construction**: `[` / `{` insert `[]` / `{}` with the caret inside; a typed
 * closer steps OVER the closer already there, and is refused anywhere else. `{` is refused inside a leaf and on a plant
 * that does not draw outlines (`44.X5`); the marks `'` `!` are never inserted (`44.X4`).
 */
export function insertSymbol(text: string, caret: number, sym: string, outline: boolean, limit: number): TextEdit {
  const at = Math.max(0, Math.min(text.length, caret));
  if (CLOSER[sym] !== undefined) {
    return text[at] === sym ? { text, caret: at + 1 } : { refused: `"${sym}" closes the pair it belongs to — type it only to step over one.` };
  }
  if (PRODUCTION_SYMBOLS.mark.includes(sym)) return { refused: `"${sym}" has no effect in this engine and cannot be added.` };
  if (!KNOWN(sym)) return { refused: `"${sym}" is not a symbol this editor knows.` };
  if (sym === '{' && !outline) return { refused: 'This plant does not draw leaf outlines, so it has no leaves to open.' };
  if (sym === '{' && insideLeaf(text, at)) return { refused: 'A leaf cannot open inside another leaf.' };
  const add = OPENER[sym] !== undefined ? sym + OPENER[sym] : sym;
  if ([...text].length + add.length > limit) return { refused: `At most ${limit} symbols here.` };
  return { text: text.slice(0, at) + add + text.slice(at), caret: at + 1 };
}

/** Remove the symbol at index `i`; a pair character UNWRAPS its pair (`44.X2`: the contents stay). */
function removeAt(text: string, i: number): { text: string; removedBefore: number } {
  const partner = pairPartner(text, i);
  if (partner < 0) return { text: text.slice(0, i) + text.slice(i + 1), removedBefore: 0 };
  const a = Math.min(i, partner), b = Math.max(i, partner);
  return { text: text.slice(0, a) + text.slice(a + 1, b) + text.slice(b + 1), removedBefore: a < i ? 1 : 0 };
}

/** Backspace: remove the symbol BEFORE the caret. */
export function deleteBefore(text: string, caret: number): TextEdit {
  if (caret <= 0) return { refused: 'Nothing before the caret.' };
  const r = removeAt(text, caret - 1);
  return { text: r.text, caret: caret - 1 - r.removedBefore };
}

/** Delete: remove the symbol AFTER the caret. */
export function deleteAfter(text: string, caret: number): TextEdit {
  if (caret >= text.length) return { refused: 'Nothing after the caret.' };
  const r = removeAt(text, caret);
  return { text: r.text, caret: caret - r.removedBefore };
}

/** Snap a weight to the editor's grid (`PRODUCTION_WEIGHT`). */
export function snapWeight(v: number): number {
  const s = Math.round(v / PRODUCTION_WEIGHT.step) * PRODUCTION_WEIGHT.step;
  return Math.min(PRODUCTION_WEIGHT.max, Math.max(PRODUCTION_WEIGHT.min, Math.round(s * 100) / 100));
}

/**
 * Normalise raw weights so they sum to EXACTLY 1 (`44.B4`): each scaled, rounded to 1e-6, the remainder on the last.
 * The stored `p` are these; the editor shows the raw (snapped) weights the author typed beside the percentages.
 */
export function normaliseWeights(raw: readonly number[]): number[] {
  const total = raw.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return raw.map(() => 1 / raw.length);
  const out = raw.map((w) => Math.round((w / total) * 1e6) / 1e6);
  const rest = 1 - out.slice(0, -1).reduce((a, b) => a + b, 0);
  out[out.length - 1] = Math.round(rest * 1e6) / 1e6;
  return out;
}

/** The first capital letter not yet used in the block (never `F`/`G`, which draw) — the `New letter` choice. */
export function freeLetter(block: CustomProductions): string | null {
  const used = new Set<string>();
  for (const t of blockTexts(block)) for (const c of t) used.add(c);
  for (const k of Object.keys(block.productions)) used.add(k);
  for (const c of 'XYZABCDEHIJKLMNOPQRSTUVW') if (!used.has(c)) return c;
  return null;
}
