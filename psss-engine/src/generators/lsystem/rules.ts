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
  | 'bush3d'
  | 'koch'
  | 'minkowski'
  | 'kochSnowflake'
  | 'pentigree'
  | 'twindragon'
  | 'fudgeflake'
  // v8 Phase 41 (2026-11-14): the Sierpinski tetrahedron (its own builder) and the book's plants.
  | 'sierpinskiTetra'
  | 'sprig'
  | 'thicketWeed'
  | 'forkTree'
  | 'firShoot'
  | 'windWeed'
  | 'wildPlant'
  | 'floweringPlant'
  | 'bush3dBook'
  // v8 Phase 41 (41.S9) — the Hill tetrahedron, FOUND by the multi-state search (its own builder, `hill.ts`).
  | 'hillTetra';

/**
 * v8 Phase 41 (`41.S2`) — **one branch of a STOCHASTIC production** (*The Algorithmic Beauty of Plants* §1.7): the
 * replacement `to`, chosen with probability `p`. A symbol's list must sum to 1; the choice is made per occurrence by a
 * seeded HASH (`turtle.ts`' `stochasticPick`), never a sequential stream.
 */
export interface StochasticChoice {
  readonly p: number;
  readonly to: string;
}

/** A production: a fixed replacement, or (v8 Phase 41) a weighted list of them. */
export type Production = string | readonly StochasticChoice[];

/**
 * v8 Phase 41 — **every replacement text of a production, flattened**, for the readers that scan a rule's ALPHABET
 * (`ruleAngleUsage`, the checkers). ⚠️ A scan that read only `typeof p === 'string'` would miss every symbol that
 * appears only in a stochastic branch — the same understatement `ruleAngleUsage` already guards against for axioms.
 */
export function productionTexts(p: Production): string[] {
  return typeof p === 'string' ? [p] : p.map((c) => c.to);
}

/** True when any production of the rule is stochastic — the rule then has a `Seed` row (`41.S6`). */
export function isStochasticRule(rule: LSystemRule): boolean {
  for (const k of Object.keys(rule.productions)) if (typeof rule.productions[k] !== 'string') return true;
  return false;
}

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
  /**
   * Symbol → replacement. A symbol with no entry is passed through unchanged. ⚠️ v8 Phase 41: a replacement may be a
   * weighted LIST (a stochastic production) — read the alphabet through `productionTexts`, never `as string`.
   */
  readonly productions: Readonly<Record<string, Production>>;
  /**
   * v8 Phase 41 (`41.S2`, `41.D13`) — **how the turtle reads `{…}`**. `'outline'`: inside the braces the pen-up `f`
   * DRAWS the polygon's boundary and `}` closes it back to its first vertex, so a leaf is a closed outline inside the
   * one continuous stroke. Absent or `'legacy'`: braces are ignored and `f` moves without drawing — today's walk, kept
   * BIT-IDENTICAL for `Coral Bush` (`bush3d`), whose look depends on it (`41.D16`).
   */
  readonly polygons?: 'outline' | 'legacy';
  /**
   * v8 Phase 41 (`41.S3`) — **a rule whose list is built by its OWN exact builder, not by the turtle.** `'tetra'` is
   * the Sierpinski tetrahedron (`tetra.ts`). Its `axiom`/`productions` are then empty and NOTHING reads them; its angle
   * rows are absent (`ruleAngleUsage` returns no axis) and `Customize` is disabled with a reason (`custom.ts`).
   */
  readonly builder?: 'tetra' | 'hill';
  /**
   * v8 Phase 41 — **the list's segments are NOT equal**, so it is resampled by ARC LENGTH (`figure.ts`), never by index.
   * ⚠️ `curve.ts`' `resampleInto` header names exactly this case: index resampling is licensed only while every segment
   * has one length, and *"a future rule that fails it needs arc-length resampling for itself alone … Hill tetrahedron is
   * the known candidate"*. Its centre steps take three lengths, ratio 5 : 1.
   */
  readonly unequalSteps?: boolean;
  /**
   * v8 Phase 41 (`41.S5`) — **a PLANT**: picking it in the Composer sets growth on (`41.D19`) and a taper (`41.S6`).
   * Optional and read `=== true`; the existing `Plant` and `Coral Bush` are plants too.
   */
  readonly plant?: boolean;
  /**
   * v8 Phase 41 — **the recursion a rule PICK starts at** (`41.D7` for the tetra). Absent ⇒ `min(rMax, rMin + 1)`, the
   * pick's rule since Phase 39, so every older rule starts exactly where it did.
   */
  readonly defaultRecursion?: number;
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
  /**
   * v8 `39.A7` — **the zoom's subdivision factor `s`**: how many cells per axis one recursion level adds.
   * Hilbert halves a cell (2), Peano thirds it (3), so one octave of `Descend` is `log(zoom)/log(s)` levels and
   * the band snaps to an aligned `s^k` sub-square (spec §2.6.2). ⚠️ **Optional and read `?? 2`** — the zoom
   * was Hilbert-only and wrote that factor into its arithmetic; only a rule that also zooms needs to say it.
   */
  readonly zoomBase?: number;
  readonly provenance: string;
  /**
   * v8 Phase 44 (`44.B2`) — **a rule SYNTHESIZED from edited productions** (`productions.ts`). It carries its family's
   * KEY for the label and landmark reads, so ⚠️⚠️ **no `Record<RuleKey, …>` table may be read by its key directly** —
   * the helpers (`generatorFlagsFor`, `angleBracketFor`, `twistBracketFor`, `stretchBracketFor`) return the identity for
   * it — and the figure cache compares the rule's IDENTITY, never its key. Absent on every library rule.
   */
  readonly synthesized?: true;
}

/**
 * ⚠️ **ONE ORDERED ARRAY IS THE OWNER AND THE DROPDOWN DERIVES FROM IT AT RUN TIME.** The recurring
 * failure this guards is a `Record<Key, Label>` that `tsc` checks against a separate array that it does
 * not — see `LSYSTEM_RULE_BY_KEY` below, which closes the gap in the other direction.
 *
 * ⚠️⚠️ **FOURTEEN RULES WERE ADMITTED BY THE OWNER (`36.Q3`, 2026-11-02: *"ship all of them without a
 * conditional gate, we will check it in UI later and do a review"*) AND THIRTEEN OF THEM ARE HERE** —
 * plus Koch and Minkowski (Phase 39) and the four CLOSED tiles of 2026-11-13 (Koch snowflake, Pentigree,
 * Twindragon, Fudgeflake), so nineteen rules in all. The fourteenth admitted, **`Hill
 * tetrahedron`, IS NOT AN L-SYSTEM AND IS NOT FAKED**: it is a rep-tile traversal, and Phase 39 MEASURED
 * that no single-generator traversal of its rep-8 dissection is continuous (`p60-hill*.mjs`) — an exact
 * curve needs several alternating rules. ⛔ **OUT-SCOPED to Phase 41 by the owner (2026-11-06, `39.D16`),
 * never approximated, because a wrong construction would ship as a named fractal that is not that fractal.**
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
    plant: true,
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
    // v8 `39.A7` — Peano visits every aligned 3^k sub-square as one contiguous run, so it zooms by thirds.
    zoomInverse: true,
    zoomBase: 3,
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
    /*
     * ⚠️⚠️ v8 Phase 41 (`41.D16`, owner 2026-11-14): **THIS RULE IS KEPT EXACTLY AS IT WAS AND ONLY ITS LABEL CHANGED, to
     * `Coral Bush`.** Its leaf `[---^^{…}]` is the prototype's MISREADING of the book's `['''^^{…}]` — three COLOUR
     * marks read as three turns — and that misreading IS the look of the owner's finetuned `Growing Corals`. The key
     * stays `bush3d` because stored keys are never renamed (`39.D12`). The book's own rule is `bush3dBook`, below.
     * ⚠️ Do NOT give it `polygons: 'outline'`: its braces must stay ignored for the walk to stay bit-identical.
     */
    key: 'bush3d',
    name: 'Coral Bush',
    plant: true,
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
  {
    key: 'koch',
    name: 'Koch',
    axiom: 'F',
    productions: { F: 'F+F--F+F' },
    drawSymbols: '',
    publishedAngle: 60,
    angleRange: [20, 88],
    recursionRange: [1, 7],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 39.A5, the textbook Koch curve (Prusinkiewicz & Lindenmayer, The Algorithmic Beauty of '
      + 'Plants, fig. 1.9). ONE rule with TWO landmarks, because the angle is not part of the rule (36): 60deg '
      + 'is the Koch curve and 85deg is the CESARO curve -- the same production, measured by the spec (s1.2) as '
      + 'density 1.68 -> 2.61 across the sweep. The range stops at 88 because at 90 the two middle segments '
      + 'fold back onto each other and the curve degenerates',
  },
  {
    key: 'minkowski',
    name: 'Minkowski sausage',
    axiom: 'F',
    productions: { F: 'F+F-F-FF+F+F-F' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [45, 135],
    recursionRange: [1, 5],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 39.A5, the Minkowski sausage (Prusinkiewicz & Lindenmayer, fig. 1.10) -- the square-wave '
      + 'coastline, eight segments per step, a silhouette no other shipped rule draws. Its 39.A10 demo carries '
      + 'the drop condition "reads like a third square maze beside Hilbert 2D / Moore"',
  },
  /*
   * v8 2026-11-13 (owner) — FOUR CLOSED TILES, each an existing generator laid round a STARTING SHAPE in the axiom.
   * Probed first (`p71-new-curves.mjs`, renders `p71-out/p71-planar.png`): each closes EXACTLY at its published
   * angle (first-to-last gap 0) and draws every edge once. Each has an EXACT Customize structure — the base
   * generator plus that starting shape (`custom.ts` CUSTOM_ONLY_STRUCTURES, searched by `p71d-structures.mjs` /
   * `p71e-twin90.mjs`, held by `figurecheck` §K2). ⚠️ The closure belongs to the PUBLISHED angle: the axiom's turns
   * scale with Yaw like every other turn, so away from it the loop opens — the engine's angle convention, not a defect.
   */
  {
    key: 'kochSnowflake',
    name: 'Koch snowflake',
    axiom: 'F--F--F',
    productions: { F: 'F+F--F+F' },
    drawSymbols: '',
    publishedAngle: 60,
    angleRange: [20, 88],
    recursionRange: [1, 6],
    bracketed: false,
    closed: true,
    zoomInverse: false,
    provenance: 'v8 2026-11-13, the Koch snowflake (Prusinkiewicz & Lindenmayer, fig. 1.9a): the Koch curve on '
      + 'the three sides of a triangle. Closed and self-avoiding at 60deg (p71). Its anti-snowflake (axiom '
      + 'F++F++F) was probed and REFUSED: in this turtle it draws a three-armed open figure, not the inward tile',
  },
  {
    key: 'pentigree',
    name: 'Pentigree',
    axiom: 'F-F-F-F-F',
    productions: { F: 'F-F++F+F-F-F' },
    drawSymbols: '',
    publishedAngle: 72,
    angleRange: [50, 95],
    recursionRange: [1, 4],
    bracketed: false,
    closed: true,
    zoomInverse: false,
    provenance: 'v8 2026-11-13, the McWorter pentigree: six-segment generator at 72deg round a pentagon -- the '
      + 'the ONLY five-fold figure. It touches itself at pentagon corners by construction (p71: 261 '
      + 'shared points at depth 3), never along an edge',
  },
  {
    key: 'twindragon',
    name: 'Twindragon',
    axiom: 'F+F+',
    productions: { F: 'F+G', G: 'F-G' },
    drawSymbols: '',
    publishedAngle: 90,
    angleRange: [45, 135],
    recursionRange: [6, 13],
    bracketed: false,
    closed: true,
    zoomInverse: false,
    provenance: 'v8 2026-11-13, the twindragon (Davis & Knuth): two Heighway dragons back to back, a plane TILE. '
      + 'p71b: F+F+ with F -> F+G, G -> F-G closes exactly with 0 repeated edges at every depth; the textbook '
      + 'FX+FX+ over the Dragon rule productions does NOT close (gap 0.85 of the extent) and was refused',
  },
  {
    key: 'fudgeflake',
    name: 'Fudgeflake',
    axiom: 'F+F+F',
    productions: { F: 'F+F-F' },
    drawSymbols: '',
    publishedAngle: 120,
    angleRange: [60, 170],
    recursionRange: [2, 7],
    bracketed: false,
    closed: true,
    zoomInverse: false,
    provenance: 'v8 2026-11-13, the fudgeflake: three terdragons round a triangle, a three-fold plane tile. '
      + 'Closed at 120deg (p71); like the terdragon it revisits lattice points by construction',
  },
  /*
   * v8 Phase 41 (2026-11-14) — **the Sierpinski tetrahedron and the book's plants.** ⚠️⚠️ **EVERY PLANT DEFINITION BELOW
   * WAS READ OFF THE BOOK'S OWN PAGES** (*The Algorithmic Beauty of Plants*, ch. 1, pp. 25–30; a copy is kept at
   * `abop-ch1.pdf`) — never recalled. `figurecheck` §P1 holds each against a table typed from the same
   * pages. ⚠️ The book's `∧` is `^` here and its colour marks (`'`, `‘`) are `'`, which this turtle ignores.
   * ⚠️ `recursionRange`'s top is the book's `n` unless `41.P1`'s measured cost lowered it (said in the provenance).
   */
  {
    key: 'sierpinskiTetra',
    defaultRecursion: 5,
    name: 'Sierpinski Tetrahedron',
    axiom: '',
    productions: {},
    drawSymbols: '',
    publishedAngle: 60,
    angleRange: [60, 60],
    recursionRange: [1, 7],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    builder: 'tetra',
    provenance: 'v8 Phase 41 (41.S3): the 3-D Sierpinski arrowhead -- a regular tetrahedron traversed through its four '
      + 'corner copies at half size (p0 -> m01 -> m12 -> m23 -> p3), variant v1001 (41.D6), built EXACTLY by tetra.ts '
      + '(copied from p70-sierpinski-tetra.mjs). Self-avoiding, turns 60/90 deg only, 4^d + 1 points. Not a turtle '
      + 'rule: its torsion takes 4-6 values, which one shared turtle angle cannot express (p70). NO DESCEND (41.S4, '
      + 'p80-tetra-zoom.mjs): its seam is exact (chord x1.00 at every whole octave, band compact) but its mid-octave '
      + 'density dip is x0.68, worse than every shipped zoom rule (Hilbert 3D x0.79, Hilbert 2D x0.83), so by 41.S4\'s '
      + 'predetermined rule it ships without the zoom. (The first probe criterion, +-15 % at every descend, failed the '
      + 'SHIPPED rules too -- the instrument was wrong, so the comparison is against them, not against a number)',
  },
  {
    key: 'hillTetra',
    defaultRecursion: 5,
    name: 'Hill Tetrahedron',
    axiom: '',
    productions: {},
    drawSymbols: '',
    publishedAngle: 60,
    angleRange: [60, 60],
    recursionRange: [1, 5],
    bracketed: false,
    closed: false,
    zoomInverse: false,
    builder: 'hill',
    unequalSteps: true,
    provenance: 'v8 Phase 41 (41.S9): a continuous space-filling traversal of the Hill (Kuhn) tetrahedron -- one sixth '
      + 'of a cube -- through its rep-8 Maubach dissection, FOUND by p81-hill-search.mjs: multi-state (a closed set of 7 '
      + 'of the 12 entry/exit states), every piece congruent to the root at 1/2, chained at vertices at every depth, '
      + '75 % face contacts. Drawn through the 8^d piece CENTRES (distinct by construction). Recursion to 5 = 32 768 '
      + 'pieces, inside the curve budget. Not a turtle rule and not customizable',
  },
  {
    key: 'sprig',
    defaultRecursion: 5,
    name: 'Sprig',
    axiom: 'F',
    productions: { F: 'F[+F]F[-F][F]' },
    drawSymbols: '',
    publishedAngle: 20,
    angleRange: [10, 60],
    recursionRange: [1, 5],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.24b, n=5, delta=20 (edge-rewriting), read off p. 25',
  },
  {
    key: 'thicketWeed',
    defaultRecursion: 4,
    name: 'Thicket Weed',
    axiom: 'F',
    productions: { F: 'FF-[-F+F+F]+[+F-F-F]' },
    drawSymbols: '',
    publishedAngle: 22.5,
    angleRange: [10, 60],
    recursionRange: [1, 4],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.24c, n=4, delta=22.5 (edge-rewriting), read off p. 25',
  },
  {
    key: 'forkTree',
    defaultRecursion: 6,
    name: 'Fork Tree',
    axiom: 'X',
    productions: { X: 'F[+X]F[-X]+X', F: 'FF' },
    drawSymbols: '',
    publishedAngle: 20,
    angleRange: [10, 60],
    recursionRange: [1, 7],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.24d, n=7, delta=20 (node-rewriting), read off p. 25',
  },
  {
    key: 'firShoot',
    defaultRecursion: 6,
    name: 'Fir Shoot',
    axiom: 'X',
    productions: { X: 'F[+X][-X]FX', F: 'FF' },
    drawSymbols: '',
    publishedAngle: 25.7,
    angleRange: [10, 60],
    recursionRange: [1, 7],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.24e, n=7, delta=25.7 (node-rewriting), read off p. 25',
  },
  {
    key: 'windWeed',
    defaultRecursion: 5,
    name: 'Wind Weed',
    axiom: 'X',
    productions: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' },
    drawSymbols: '',
    publishedAngle: 22.5,
    angleRange: [10, 60],
    recursionRange: [1, 5],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.24f, n=5, delta=22.5 (node-rewriting), read off p. 25',
  },
  {
    key: 'wildPlant',
    defaultRecursion: 5,
    name: 'Wild Plant',
    axiom: 'F',
    productions: {
      F: [
        { p: 0.33, to: 'F[+F]F[-F]F' },
        { p: 0.33, to: 'F[+F]F' },
        { p: 0.34, to: 'F[-F]F' },
      ],
    },
    drawSymbols: '',
    publishedAngle: 25.7,
    angleRange: [10, 60],
    recursionRange: [1, 5],
    plant: true,
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP s1.7 (figs. 1.27), the stochastic OL-system, derivation length 5, read off p. 28. '
      + 'ANGLE IS A CHOICE, NOT A QUOTATION: s1.7 gives none; it is fig. 1.24a split three ways, so it takes 1.24a\'s 25.7',
  },
  {
    key: 'floweringPlant',
    defaultRecursion: 5,
    name: 'Flowering Plant',
    axiom: 'P',
    productions: {
      // plant P, internode I, seg S, leaf L, flower K, pedicel D, wedge E (the book's multi-letter symbols).
      P: 'I+[P+K]--//[--L]I[++L]-[PK]++PK',
      I: 'FS[//&&L][//^^L]FS',
      S: 'SFS',
      L: '[\'{+f-ff-f+|+f-ff-f}]',
      K: '[&&&D\'/E////E////E////E////E]',
      D: 'FF',
      E: '[\'^F][{&&&&-f+f|-f+f}]',
    },
    drawSymbols: '',
    publishedAngle: 18,
    angleRange: [10, 45],
    // ⚠️ Starts at 2, MEASURED: depth 1 is a single point (the first stem appears only at depth 2, p82-rule-sizes).
    recursionRange: [2, 5],
    plant: true,
    polygons: 'outline',
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.26, n=5, delta=18, read off p. 27; leaves and petals drawn as closed '
      + 'outlines (41.D13)',
  },
  {
    key: 'bush3dBook',
    defaultRecursion: 5,
    name: 'Bush 3D',
    axiom: 'A',
    productions: {
      A: '[&FL!A]/////\'[&FL!A]///////\'[&FL!A]',
      F: 'S/////F',
      S: 'FL',
      L: '[\'\'\'^^{-f+f+f-|-f+f+f}]',
    },
    drawSymbols: '',
    publishedAngle: 22.5,
    angleRange: [10, 50],
    // ⚠️ The book's n is 7, LOWERED to 5 by measurement (41.P1): depth 6 is 188 433 points and depth 7 1 110 447
    // (36 ms a build), past the 65 536-segment curve budget the engine already holds `Customize` to (p82-rule-sizes).
    recursionRange: [1, 5],
    plant: true,
    polygons: 'outline',
    bracketed: true,
    closed: false,
    zoomInverse: false,
    provenance: 'v8 Phase 41: ABOP fig. 1.25, n=7, delta=22.5, read off p. 26 -- the CORRECTED bush (the colour marks '
      + 'are colour marks), leaves as closed outlines. The prototype misreading is kept as Coral Bush (bush3d, 41.D16). '
      + 'Recursion capped at 5 (book n = 7) by the measured list size',
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
 * ⚠️⚠️ **v8 `39.A6(a)`, 2026-11-05: THE FIVE RULES THAT WERE STILL SOLVED SHALLOW ARE RE-SOLVED** — `terdragon`
 * 6.30 -> **3.35**, `kochQuad` 12.00 -> **3.51**, `arrowhead` 4.50 -> **1.92**, `gosper` 4.20 -> **1.72**, `hilbert2d`
 * 1.40 -> **1.25** (`p39a6-a2-alldepth.mjs`). ⚠️⚠️ **AND THE RULE THEY WERE SOLVED BY IS NOT "AT THE RANGE MAXIMUM":
 * THAT PREMISE WAS FALSIFIED.** The error is NOT monotone in depth on every rule — on `hilbert2d` it FALLS with
 * depth (2.7e-2 at depth 2, 1.0e-2 at 6, at 3.65°) and `gosper` is worst at depth 1 — so each width is the
 * MINIMUM over every depth in range AND over a solve centred on the rule's own demo sweep (which is what binds
 * `kochQuad`, `arrowhead` and `terdragon`, whose demos sweep away from the landmark). Demo error at the shipped
 * pose fell 3-11x (e.g. `Curve Morph` 6.75e-2 -> 6.2e-3). ⚠️ Five shipped demos' wobble became visibly smoother
 * at the cost of more crossings (14 / 13 / 24 / 27 / 36 per 90° sweep); every new width stays above
 * `LSYSTEM_MIN_USEFUL_BRACKET_DEG`, so all five remain bracketed. The engine-grid sweep sits at 1.00-1.04e-2
 * at rMax, i.e. the round-down margin is thin. `dragon`/`levyC`/`knopp` (11-04, solved at rMax) are unchanged.
 *
 * ⚠️ **`bush3d`'s `yaw` figure solved to the 32° ceiling and is CAPPED at 12 here, because the ceiling
 * is an artefact rather than a tolerance: its yaw symbols sit inside the `{…}` polygon-fill block, whose
 * `f` moves emit no points once `f` is correct, so YAW IS INERT ON THAT RULE and a zero displacement
 * solves to any width.** Capping keeps the number honest if the inertness is ever fixed. **The
 * inertness itself is a finding, not a setting — see that rule's `provenance`.**
 */
/**
 * v8 Phase 44 (`44.B2.3`) — the angle bracket read through the RULE: a synthesized rule (edited productions) has
 * none (width 0 — the exact "rebuild per frame" path), whatever its family's entry says.
 */
export function angleBracketFor(rule: { readonly key: RuleKey; readonly synthesized?: true }): { yaw: number; multi: number } {
  return rule.synthesized === true ? { yaw: 0, multi: 0 } : LSYSTEM_ANGLE_BRACKET[rule.key];
}
export const LSYSTEM_ANGLE_BRACKET: Record<RuleKey, { yaw: number; multi: number }> = {
  hilbert3d: { yaw: 0.22, multi: 0.04 },
  hilbert2d: { yaw: 1.25, multi: 1.25 },
  dragon: { yaw: 1.17, multi: 1.17 },
  terdragon: { yaw: 3.35, multi: 3.35 },
  kochQuad: { yaw: 3.51, multi: 3.51 },
  arrowhead: { yaw: 1.92, multi: 1.92 },
  gosper: { yaw: 1.72, multi: 1.72 },
  plant: { yaw: 12.00, multi: 12.00 },
  moore: { yaw: 0.85, multi: 0.85 },
  peano: { yaw: 0.69, multi: 0.69 },
  levyC: { yaw: 1.43, multi: 1.43 },
  knopp: { yaw: 1.43, multi: 1.43 },
  bush3d: { yaw: 12.00, multi: 0.72 },
  // v8 `39.A5` — solved 2026-11-05 by the `39.A6` rule (min over every depth and the landmark-centred sweep).
  koch: { yaw: 2.59, multi: 2.59 },        // binds at depth 7 near Cesaro (83 deg) -- p39a5-bracket-new.mjs
  minkowski: { yaw: 2.35, multi: 2.35 },   // binds at depth 5, centre 116 deg
  // v8 2026-11-13 — the four closed tiles, SOLVED by the same rule (p71f-bracket.mjs, min over every depth and 7 centres).
  kochSnowflake: { yaw: 1.95, multi: 1.95 },   // binds at depth 6, centre 44 deg
  pentigree: { yaw: 1.81, multi: 1.81 },       // binds at depth 4, centre 85 deg
  twindragon: { yaw: 0.47, multi: 0.47 },      // binds at depth 12, centre 51 deg -- BELOW the useful floor: rebuilt per frame
  fudgeflake: { yaw: 1.68, multi: 1.68 },      // binds at depth 7, centre 84 deg
  /*
   * v8 Phase 41 — ⚠️ **NOT SOLVED, SO 0: below `LSYSTEM_MIN_USEFUL_BRACKET_DEG`, i.e. no bracket — a breathing angle
   * rebuilds per frame at the EXACT angle (correct, only slower), and a still angle builds once.** This file forbids an
   * invented width; solve with `t36-bracket-solve.mjs` before giving any of these a bracket. The tetra has no angle.
   */
  sierpinskiTetra: { yaw: 0, multi: 0 },
  sprig: { yaw: 0, multi: 0 },
  thicketWeed: { yaw: 0, multi: 0 },
  forkTree: { yaw: 0, multi: 0 },
  firShoot: { yaw: 0, multi: 0 },
  windWeed: { yaw: 0, multi: 0 },
  wildPlant: { yaw: 0, multi: 0 },
  floweringPlant: { yaw: 0, multi: 0 },
  bush3dBook: { yaw: 0, multi: 0 },
  hillTetra: { yaw: 0, multi: 0 },
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
  // v8 Phase 41 — a BUILDER rule has no turtle, so no angle row can change it (`41.D9`): none is shown.
  if (rule.builder !== undefined) return { yaw: false, pitch: false, roll: false };
  // Scan the axiom AND every production body: a symbol can be introduced at any expansion level, so
  // reading the axiom alone understates the alphabet on every rule whose axiom is a bare non-terminal.
  let text = rule.axiom;
  for (const key of Object.keys(rule.productions)) {
    const p = rule.productions[key];
    if (p !== undefined) text += productionTexts(p).join('');
  }
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
  twist: { base: number; amplitude: number; frequency: number };
  stretch: { base: number; amplitude: number; frequency: number };
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
    // v8 `39.A3`/`39.A4` — both at their IDENTITY, so a fresh curve takes the turtle path bit-exactly.
    twist: still(0),
    stretch: still(1),
  };
}
