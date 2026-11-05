/**
 * @file v8 `36.4` — **the rule library as DATA.** One owner; the dropdown reads it; a
 * `Record<RuleKey, …>` makes `tsc` force an entry for every member.
 *
 * ⚠️⚠️ **THIS MODULE IMPORTS NOTHING AND MUST KEEP DOING SO (`36.D2`).** `composercheck` imports
 * `score-canvas.ts` under bare Node, the Score draws this figure type (`36.D2`), and Node **strips
 * types only** — it does not compile TypeScript. A transitive import reaching the DOM or a GL type
 * would make the whole chain unloadable from a checker **while `tsc --noEmit` stayed green**. The same
 * rule bans two syntaxes outright: **no `enum` and no constructor parameter property**, both of which
 * throw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at runtime under Node (`reel-model.ts`'s measured trap).
 * So: a `const` object plus a derived union, every field declared, no classes.
 *
 * ⚠️⚠️ **THE RULE STRINGS ARE THE SPECIFICATION'S AND ARE COPIED VERBATIM FROM THE PROTOTYPE**
 * (the prototype `4-lsystem-model.mjs`, which is not published). The plan's own precedence rule:
 * *"where this section and a spec disagree about the TREE, the section wins — where they disagree
 * about the MATHEMATICS or the RULE STRINGS, the spec wins."* **Do not "correct" a production here.**
 *
 * ⚠️ **`publishedAngles` IS A LANDMARK, NOT A LIMIT**, and that distinction is the model's whole idea:
 * the angle is **not part of the rule**, so the same production at another angle is a valid, different,
 * still self-similar curve. The tooltip must say so or an author treats the default as the only
 * correct value (`36.18`).
 *
 * ⚠️⚠️ **`shrink` DOES NOT EXIST HERE AND MUST NOT BE RE-ADDED (owner, 2026-11-02, `36.Q4` —
 * REVERSING `36.D12`).** The prototype's turtle applies a length shrink at the symbol `!`, and `!`
 * appears in exactly one production (`Bush 3D`), so the control was measured **inert on all eight
 * shipping rules** while §6.3 labelled it *"the density control"*. The row is dropped; **`!` is now an
 * IGNORED symbol** like `{` and `}`. A turtle that silently treats `!` as a length change
 * re-introduces a dropped control invisibly.
 */

/** Every rule the library ships. The stored word; never a label. */
export type RuleKey =
  | 'hilbert2d'
  | 'hilbert3d'
  | 'dragon'
  | 'terdragon'
  | 'kochQuad'
  | 'arrowhead'
  | 'gosper'
  | 'plant'
  | 'moore'
  | 'peano'
  | 'levyC'
  | 'knopp'
  | 'bush3d';

/**
 * One production system plus the metadata the UI and the checkers need.
 *
 * ⚠️ **`drawSymbols` IS LOAD-BEARING AND ITS ABSENCE IS NOT A COSMETIC BUG.** Several published rules
 * use their NON-TERMINALS as the forward symbol — `Arrowhead` and `Gosper` contain no `F` at all and
 * `A`/`B` both mean *draw*. A turtle that misses this emits coincident consecutive points, so the
 * minimum chord is 0 and the density metric reads **`Infinity`**. That was a real prototype defect and
 * it is seeded into the density instrument as a calibration (`36.19`).
 */
export interface LSystemRule {
  readonly key: RuleKey;
  /** The UI label. `namecheck`/`tipcheck` read it in both directions. */
  readonly name: string;
  readonly axiom: string;
  /** Symbol → replacement. A symbol with no entry is passed through unchanged. */
  readonly productions: Readonly<Record<string, string>>;
  /**
   * Symbols that advance the turtle and emit a point, **in addition to** the universal `F`/`G`.
   * Empty for rules whose only forward symbol is `F`.
   */
  readonly drawSymbols: string;
  /** The landmark angle in degrees, applied to whichever of yaw/pitch/roll the rule actually uses. */
  readonly publishedAngle: number;
  /** The useful sweep, per rule — a rule's interesting territory is not the same width for all. */
  readonly angleRange: readonly [number, number];
  /** Per rule because expansion factors differ by ~6x (`36.4`, §4.2). */
  readonly recursionRange: readonly [number, number];
  /** Does the production contain `[`/`]`? Derived data, stored so a checker can assert the pair. */
  readonly bracketed: boolean;
  /**
   * Does the curve meet its own start? ⚠️ **The library's own convention is a CLOSED loop** — `travel`
   * earned its own `Open figure` facet chip for breaking it — so this is a product fact, not trivia.
   * **Asserted, never trusted:** `36.20` clause 7 measures the first-to-last gap against one step.
   */
  readonly closed: boolean;
  /**
   * Does this rule have an INVERSE index→point map, i.e. can a window's corner cells be turned back into
   * a contiguous index band?
   *
   * ⚠️⚠️ **THIS IS THE ZOOM'S REAL PRECONDITION AND IT IS NOT `locality: 'fass'` (`36.D13`).**
   * `SPEC-selfsimilar-curves` §4.4 promises the zoom for *"Hilbert 2-D / 3-D, Peano, Gosper"* and its
   * prototype implements it for NONE of them via the L-system — `4-infinite-zoom.mjs` builds the curve
   * from Skilling's closed-form map instead, and gets the band by SAMPLING 4096 points and taking
   * `min(hits)…max(hits)` with no contiguity check, which the spec's own §5.5 calls *"too crude to
   * ship"*. **There is no published Gosper inverse.** So the gate is per-rule and concrete, not a
   * per-rule adjective.
   *
   * ⚠️ **Where it is false the `Descend` and `Centre` rows HIDE** — on a rule with no inverse the band is
   * not contiguous, so a zoom would select a scattered subset: a picture, but not a zoom. **A control
   * that lies is worse than an absent one.**
   */
  readonly zoomInverse: boolean;
  readonly provenance: string;
}

/**
 * ⚠️ **ONE ORDERED ARRAY IS THE OWNER AND THE DROPDOWN DERIVES FROM IT AT RUN TIME.** The recurring
 * failure this guards is a `Record<Key, Label>` that `tsc` checks against a separate array that it does
 * not — see `LSYSTEM_RULE_BY_KEY` below, which closes the gap in the other direction.
 *
 * ⚠️⚠️ **FOURTEEN RULES WERE ADMITTED BY THE OWNER (`36.Q3`, 2026-11-02: *"ship all of them without a
 * conditional gate, we will check it in UI later and do a review"*) AND THIRTEEN ARE HERE.** The
 * fourteenth, **`Hill tetrahedron`, IS NOT AN L-SYSTEM AND IS NOT FAKED**: it is a rep-tile traversal
 * with no production string in the prototype and none published in the spec, so admitting it needs a
 * SECOND list builder. `36.D11`'s own note says so (*"may require a SECOND list builder, which
 * `36.D11`'s method cannot price"*). **It is recorded as owed rather than approximated, because a
 * wrong production would ship as a named fractal that is not that fractal.**
 *
 * ⚠️⚠️ **AND TWO OF THE ADMITTED THIRTEEN ARE FLAGGED FOR THE REVIEW, NOT MERELY UNTESTED:**
 * `knopp` is very likely the `levyC` production reflected (both are base-2 two-child turn sequences at
 * 45°) — `36.D11`'s distinctness measurement is now a REPORT rather than a gate, so it will say so
 * rather than refuse; and `bush3d`'s correctness was never established even in the prototype.
 */
export const LSYSTEM_RULES: readonly LSystemRule[] = [
  {
    key: 'hilbert3d',
    name: 'Hilbert 3D',
    axiom: 'X',
    productions: { X: '^<XF^<XFX-F^>>XFX&F+>>XFX-F>X->' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [30, 150],
    recursionRange: [1, 4],
    bracketed: false,
    closed: false,
    zoomInverse: true,
    provenance: 'prototype 4-lsystem-model.mjs:23; the DEFAULT rule and the one rule §1.1 never '
      + 'measured (premise correction 4) -- its density envelope is owed to 36.19, not inherited',
  },
  {
    key: 'hilbert2d',
    name: 'Hilbert 2D',
    axiom: 'A',
    productions: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [30, 150],
    recursionRange: [2, 6],
    bracketed: false,
    closed: false,
    zoomInverse: true,
    provenance: 'prototype 4-lsystem-model.mjs:22; FASS, planar. §1.1 measured it across the sweep',
  },
  {
    key: 'dragon',
    name: 'Dragon',
    axiom: 'FX',
    productions: { X: 'X+YF+', Y: '-FX-Y' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [45, 135],
    recursionRange: [6, 13],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:24; base-2 paperfolding turn sequence, self-avoiding '
      + 'at 90deg -- both asserted as PROPERTIES rather than against a table (36.20 clause 7)',
  },
  {
    key: 'terdragon',
    name: 'Terdragon',
    axiom: 'F',
    productions: { F: 'F+F-F' },
    drawSymbols: '',
    publishedAngle: 120,
    angleRange: [60, 170],
    recursionRange: [3, 8],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:25; §1.1 measured it diffusing by 1.3x at the top of '
      + 'its sweep, which is why angleRange is per rule and not shared',
  },
  {
    key: 'kochQuad',
    name: 'Koch quadratic',
    axiom: 'F',
    productions: { F: 'F+F-F-F+F' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [45, 135],
    recursionRange: [1, 5],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:26; hosts the headline morph (demo #4) -- 90deg to '
      + '117deg is the interval the spec calls "this phase\'s entire argument" and it is UNRENDERED',
  },
  {
    key: 'arrowhead',
    name: 'Sierpinski arrowhead',
    axiom: 'A',
    productions: { A: 'B-A-B', B: 'A+B+A' },
    drawSymbols: 'AB',
    publishedAngle: 60,
    angleRange: [30, 100],
    recursionRange: [3, 8],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:27; NO F symbol -- A and B both draw. The best-behaved '
      + 'rule in the set: density 1.05-1.29 across its WHOLE sweep (§1.1)',
  },
  {
    key: 'gosper',
    name: 'Gosper',
    axiom: 'A',
    productions: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' },
    drawSymbols: 'AB',
    publishedAngle: 60,
    angleRange: [30, 100],
    recursionRange: [1, 5],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:28; NO F symbol -- A and B both draw. FASS',
  },
  {
    key: 'plant',
    name: 'Plant',
    axiom: 'F',
    productions: { F: 'F[+F]F[-F]F' },
    drawSymbols: '',
    publishedAngle: 26,
    angleRange: [10, 60],
    recursionRange: [1, 5],
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'prototype 4-lsystem-model.mjs:29; bracketed. ITS DENSITY COMES FROM THE EULER-TOUR '
      + 'RETRACE, not from any length shrink -- §1.1\'s "set by the per-level length shrink" is half '
      + 'false because this production contains no ! symbol at all (premise correction 2)',
  },
  {
    key: 'moore',
    name: 'Moore',
    axiom: 'LFL+F+LFL',
    productions: { L: '-RF+LFL+FR-', R: '+LF-RFR-FL+' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [30, 150],
    recursionRange: [1, 5],
    bracketed: false,
    closed: true,
    zoomInverse: false,
    provenance: 'widened by 36.Q3. Admitted on CLOSURE -- a combinatorial property of the production '
      + 'that NO angle can reach, and the only candidate that makes this figure type a CLOSED loop, '
      + 'which is the library\'s own convention. §8.5\'s open-curve seam disappears on it entirely',
  },
  {
    key: 'peano',
    name: 'Peano',
    axiom: 'X',
    productions: {
      X: 'XFYFX+F+YFXFY-F-XFYFX',
      Y: 'YFXFY-F-XFYFX+F+YFXFY',
    },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [45, 135],
    recursionRange: [1, 4],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'widened by 36.Q3. Admitted on EXPANSION FACTOR -- base 9 against Hilbert\'s 4 -- and '
      + 'it self-touches at corners where Hilbert does not. FASS with a known inverse, so it is the '
      + 'cheapest SECOND zoom host when 36.9 lands',
  },
  {
    key: 'levyC',
    name: 'Levy C',
    axiom: 'F',
    productions: { F: '+F--F+' },
    drawSymbols: '',
    publishedAngle: 45,
    angleRange: [20, 90],
    recursionRange: [6, 14],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'widened by 36.Q3. Admitted on SELF-AVOIDANCE -- it overlaps itself at 45deg where '
      + 'the dragon at 90deg does not. Both are base-2 turn sequences, so the turn-sequence multiset '
      + 'is the discriminator and 36.D11\'s measurement reports it',
  },
  {
    key: 'knopp',
    name: 'Sierpinski-Knopp',
    axiom: 'F',
    productions: { F: '-F++F-' },
    drawSymbols: '',
    publishedAngle: 45,
    angleRange: [20, 90],
    recursionRange: [6, 14],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'widened by 36.Q3, AND FLAGGED FOR THE REVIEW: this is very likely the levyC '
      + 'production REFLECTED -- two children, base 2, same 45deg landmark -- which is the Brick Weave '
      + 'case the plan predicted for exactly this candidate. 36.D11\'s distinctness measurement is a '
      + 'REPORT not a gate (36.Q3), so it will SAY SO rather than refuse. If it duplicates levyC the '
      + 'honest outcome is to drop it and add 45deg as a levyC publishedAngles landmark',
  },
  {
    key: 'bush3d',
    name: 'Bush 3D',
    axiom: 'A',
    productions: {
      A: '[&FL!A]/////[&FL!A]///////[&FL!A]',
      F: 'S/////F',
      S: 'FL',
      L: '[---^^{-f+f+f-|-f+f+f}]',
    },
    drawSymbols: '',
    publishedAngle: 23,
    angleRange: [10, 50],
    recursionRange: [1, 5],
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'widened by 36.Q3 (it was in the prototype but NOT in the spec\'s shipping set), AND '
      + 'FLAGGED FOR THE REVIEW: its distinctness is real -- bracket depth 3 branches per node -- but '
      + 'its CORRECTNESS was never established even in the prototype, which ignores { and } entirely '
      + 'and DRAWS on f where f means move-without-drawing. Both are fixed here; the figure is '
      + 'therefore NOT the one the prototype rendered, and that is deliberate',
  },
];

/**
 * ⚠️ **THE SECOND HALF OF THE ONE-OWNER GUARANTEE.** The array above gives order; this gives
 * **totality** — `Record<RuleKey, LSystemRule>` means adding a `RuleKey` member without an entry is a
 * compile error. Built FROM the array, so the two can never disagree: the failure mode being designed
 * out is a hand-written map checked against a separate list that `tsc` does not compare.
 */
export const LSYSTEM_RULE_BY_KEY: Record<RuleKey, LSystemRule> = (() => {
  const out = {} as Record<RuleKey, LSystemRule>;
  for (const r of LSYSTEM_RULES) out[r.key] = r;
  return out;
})();

/** The default rule. ⚠️ It is also the one rule §1.1 never measured (premise correction 4). */
export const LSYSTEM_DEFAULT_RULE: RuleKey = 'hilbert3d';

/**
 * v8 `36.6` — **the angle-bracket half-width, PER RULE and SOLVED, not picked.**
 *
 * The two-list lerp is exact at the bracket corners and approximate between, so the width trades
 * rebuild RATE against geometric ERROR — the same trade the escape grid's `PARAMS_REUSE_TOLERANCE`
 * records (*"a 0.0055 step in the c-plane is the same figure to the eye and paid a rebuild to render an
 * indistinguishable figure"*).
 *
 * ⚠️⚠️ **A SINGLE SHARED WIDTH IS WRONG BY UP TO 20×, WHICH IS WHY THIS TABLE EXISTS.** Measured
 * 2026-11-02: the lerp error at a ±4° bracket ranges from **0.0048** (`Plant`) to **2.95**
 * (`Hilbert 3D`) as a fraction of the figure's own extent — a 600× spread. One width would either waste
 * rebuilds on the smooth rules or ship a scrambled figure on the rough ones. **This follows the plan's
 * own established pattern: *"track bounds come from the RULE LIBRARY, not from the row."***
 *
 * **BUDGET, STATED BEFORE THE SOLVE: 0.01 of the figure extent — 10 px on a 1000 px figure.** Each
 * width is bisected against that budget at three probe points inside the bracket (not just the
 * midpoint), then rounded DOWN so the shipped value is inside the budget rather than at it.
 * ⚠️ **Never widen one of these without re-running `t36-bracket-solve.mjs`, and never pick a value
 * because it passes** — invariant 27's rule.
 *
 * ⚠️⚠️ **TWO WIDTHS PER RULE, BECAUSE THE ERROR IS DRIVEN BY THE COMPOSITION OF ROTATIONS AND NOT BY
 * ANY ONE ANGLE.** With yaw alone moving, `Hilbert 3D` tolerates **1.60°**; with all three moving
 * together it tolerates **0.32°** — a 5× narrowing from the same rule, because three composed rotations
 * are far more non-linear than one. So `multi` applies only while pitch or roll is actually breathing,
 * and `yaw` applies when they are constant. ⚠️ **Both were solved at the PUBLISHED angles; a rule driven
 * far from its landmark may be more non-linear than its number says.**
 *
 * ⚠️⚠️ **EVERY WIDTH HERE WAS ORIGINALLY SOLVED AT `min(rMax, rMin + 1)`, AND THAT IS NOT DEEP ENOUGH:
 * THE ERROR IS MONOTONE IN RECURSION AT A FIXED WIDTH.** Measured on `levyC` at its old 4.4°, the error
 * ran 9.9e-3 / 2.7e-2 / 5.4e-2 / 9.1e-2 / 1.2e-1 at depths 7 / 9 / 11 / 13 / 14 — inside budget only at
 * the depth it was solved at, and **11.6x over at the top of its own declared range.** A deeper curve
 * composes more rotations, so a width solved shallow is a promise the rule cannot keep.
 *
 * ⚠️⚠️ **THE THREE BASE-2 RULES ARE NOW SOLVED AT THEIR RANGE MAXIMUM** (`dragon` 2.10 -> **1.17**,
 * `levyC` and `knopp` 4.40 -> **1.43**), which holds the budget at EVERY depth in range precisely
 * because the error is monotone. They stay above `LSYSTEM_MIN_USEFUL_BRACKET_DEG`, so they remain
 * bracketed rather than rebuilding per frame. **This was forced by the removal of the flat recursion
 * cap**: those three rules are exactly the ones whose deep end the cap had been hiding, and shipping the
 * cap removal without this would have traded a coarse figure for a visibly jittering one.
 *
 * ⚠️⚠️ **THE OTHER BRACKET-USING RULES ARE STILL SOLVED SHALLOW AND STILL OVER BUDGET AT THE DEPTHS
 * THEIR OWN DEMOS RUN AT — PRE-EXISTING, MEASURED, AND DELIBERATELY NOT TOUCHED HERE**: `terdragon` 6.3°
 * (`Curve Triad` at 6), `kochQuad` 12° (`Curve Morph` at 4), `arrowhead` 4.5° (`Curve Gasket` at 7),
 * `gosper` 4.2° (`Curve Island` at 4), and `hilbert2d` 1.4° (over at depth 2 only). `plant` and `bush3d`
 * hold across their whole range. **Re-solving those five is a separate change with five shipped demos in
 * its blast radius; do not fold it into an unrelated sitting.**
 *
 * ⚠️ **`bush3d`'s `yaw` figure solved to the 32° ceiling and is CAPPED at 12 here, because the ceiling
 * is an artefact rather than a tolerance: its yaw symbols sit inside the `{…}` polygon-fill block, whose
 * `f` moves emit no points once `f` is correct, so YAW IS INERT ON THAT RULE and a zero displacement
 * solves to any width.** Capping keeps the number honest if the inertness is ever fixed. **The
 * inertness itself is a finding, not a setting — see that rule's `provenance`.**
 */
export const LSYSTEM_ANGLE_BRACKET: Record<RuleKey, { yaw: number; multi: number }> = {
  hilbert3d: { yaw: 0.22, multi: 0.04 },
  hilbert2d: { yaw: 1.40, multi: 1.40 },
  dragon: { yaw: 1.17, multi: 1.17 },
  terdragon: { yaw: 6.30, multi: 6.30 },
  kochQuad: { yaw: 12.00, multi: 12.00 },
  arrowhead: { yaw: 4.50, multi: 4.50 },
  gosper: { yaw: 4.20, multi: 4.20 },
  plant: { yaw: 12.00, multi: 12.00 },
  moore: { yaw: 0.85, multi: 0.85 },
  peano: { yaw: 0.69, multi: 0.69 },
  levyC: { yaw: 1.43, multi: 1.43 },
  knopp: { yaw: 1.43, multi: 1.43 },
  bush3d: { yaw: 12.00, multi: 0.72 },
};

/**
 * Below this half-width the bracket is not worth having and the figure is rebuilt **per frame** at the
 * exact angle instead.
 *
 * ⚠️⚠️ **THIS THRESHOLD EXISTS BECAUSE `36.6`'s MAIN IDEA DOES NOT WORK ON THE SPACE-FILLING RULES,
 * WHICH IS MEASURED AND IS THE PHASE'S MOST SURPRISING RESULT SO FAR.** `36.6` calls the two-list lerp
 * *"the main implementation idea in the phase"*. Solved against the shipped path it gives a usable
 * width on nine rules (**4.2°–12°**, i.e. 3–11 bracket crossings over a 90° sweep) and collapses on the
 * FASS rules: **`Hilbert 3D` 0.23°, `Peano` 0.70°, `Moore` 0.86°** — 50 to 1000 crossings over the same
 * sweep, each costing four walks, which is far worse than simply rebuilding. **The cause is structural:
 * a deep space-filling curve composes hundreds of rotations, so position error accumulates
 * multiplicatively along the walk and the figure is not a near-linear function of the angle at any
 * useful width.** Three normalisation mechanisms were tried and none of them changes this; it is not a
 * fit artefact.
 *
 * ✅ **AND THE FALLBACK IS AFFORDABLE, WHICH IS WHY THIS IS A LIMIT RATHER THAN A BLOCKER.** Measured
 * rebuild cost at the top of each `recursionRange`, 12 000 particles: **worst case 5.93 ms against a
 * 16.7 ms frame, with nothing above it** — so `SPEC-selfsimilar-curves` §8.3's *"a permanent stall, not
 * an animation"* is falsified at the shipped bounds. A per-frame rebuild is visible against the
 * engine's own ~1.86 ms figure loop and is not fatal.
 *
 * ✅ **AND THE DEMO SET NEVER NEEDS IT: no demo animates the ANGLE on a FASS rule.** #1/#2/#3/#8 use
 * `Hilbert 3D` but animate recursion and zoom; the angle-morph demos (#4 Koch, #5 Arrowhead, #7 Plant)
 * all sit on rules whose solved width is 4.5°–12°. ⚠️ **State this in the `Yaw` tooltip's precondition
 * rather than leaving an author to discover that a breathing yaw is cheap on Koch and expensive on
 * Hilbert.**
 */
export const LSYSTEM_MIN_USEFUL_BRACKET_DEG = 1.0;

/**
 * Which turtle angles a production actually uses, **DERIVED from the symbol set and never
 * hand-listed** (`36.11`): a hand-written list and the productions drift apart silently, and the
 * consequence is a UI row that moves and changes nothing — the zero-carrier defect in live form.
 *
 * ⚠️ `Pitch` and `Roll` hide in the Composer for a rule that uses neither, so this function is the
 * single source for that visibility and `36.20` clause 6 asserts the forward direction against it.
 */
export function ruleAngleUsage(rule: LSystemRule): { yaw: boolean; pitch: boolean; roll: boolean } {
  // Scan the axiom AND every production body: a symbol can be introduced at any expansion level, so
  // reading the axiom alone understates the alphabet on every rule whose axiom is a bare non-terminal.
  let text = rule.axiom;
  for (const key of Object.keys(rule.productions)) text += rule.productions[key] ?? '';
  return {
    yaw: /[+\-]/.test(text),
    pitch: /[&^]/.test(text),
    roll: /[<>/\\]/.test(text),
  };
}

/**
 * v8 `36.9` — the self-similar zoom's bounds, in OCTAVES of effective recursion.
 *
 * ⚠️ **GEOMETRIC, so every interpolator and the Mixer must treat it multiplicatively** — `36.13` already
 * does, and `lerpTransform`'s scale term takes the same treatment for the same reason: octaves are
 * multiplicative and a linear lerp from 1 to 128 spends half the crossfade above ×64.
 *
 * ⚠️ **The ceiling is the INDEX WALL and it is a real limit rather than a taste one.** Effective recursion
 * is `recursion + log2(descend)`, and the index window narrows by the same factor, so from recursion 3 this
 * allows roughly seven octaves before the band is a single cell. **A documented wall beats a silent one:
 * the readout surfaces the clamp.**
 */
export const DESCEND_MIN = 1;
export const DESCEND_MAX = 128;
export const DESCEND_STEP = 0.01;

/**
 * The config a preset gets when it adopts this figure type for the first time.
 *
 * ⚠️ **Every angle sits at the default rule's PUBLISHED landmark, not at a range midpoint** — that is
 * where the production is the named fractal, and a type switch landing on an unnamed intermediate would
 * make the author's first sight of the figure an arbitrary one.
 *
 * ⚠️ **No modulation at all, deliberately.** `amplitude: 0` takes `resolveOp`'s `depth === 0` BRANCH, so a
 * freshly switched preset is bit-exact against one authoring no breathing — and the author adds motion
 * rather than having to remove it.
 */
export function defaultLSystemConfig(): {
  rule: string;
  recursion: { base: number; amplitude: number; frequency: number };
  yaw: { base: number; amplitude: number; frequency: number };
  pitch: { base: number; amplitude: number; frequency: number };
  roll: { base: number; amplitude: number; frequency: number };
  descend: { base: number; amplitude: number; frequency: number };
  smoothness: number;
  centre: number[];
} {
  const r = LSYSTEM_RULE_BY_KEY[LSYSTEM_DEFAULT_RULE];
  const still = (base: number) => ({ base, amplitude: 0, frequency: 0 });
  return {
    rule: r.key,
    recursion: still(Math.min(r.recursionRange[1], r.recursionRange[0] + 1)),
    yaw: still(r.publishedAngle),
    pitch: still(r.publishedAngle),
    roll: still(r.publishedAngle),
    descend: still(DESCEND_MIN),
    smoothness: 0,
    centre: [0, 0, 0],
  };
}
