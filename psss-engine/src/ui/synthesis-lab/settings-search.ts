/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The Lab's cross-tab SETTINGS SEARCH — the model half.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Type a word, get the controls that match it anywhere in the Lab, with the path to each one, and
 * jump there. Owner request: *"we can quickly find where some setting is configured and we can jump
 * to it in the UI"*, modelled on the preset grid's facet search, which the owner singles out as the
 * thing that works.
 *
 * ⚠️⚠️ **THIS FILE IS PURE AND MUST STAY PURE: NO DOM, NO VALUE IMPORTS, NO `enum`, NO CONSTRUCTOR
 * PARAMETER PROPERTIES.** `searchcheck` imports it under bare Node, which strips types and nothing
 * else — a constructor parameter property throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` while
 * `tsc --noEmit` stays green, which is exactly the trap `reel-model.ts` already carries a warning
 * about. `import type` is erased and is therefore the only import allowed here.
 *
 * ── why the index is SCANNED from the DOM rather than registered by the row builders ─────────────
 *
 * ⚠️⚠️ **THE FIRST DESIGN WAS TO HAVE EACH ROW BUILDER REGISTER ITSELF, AND MEASURING THE CODE
 * FALSIFIED IT.** There is no shared row builder: Visual FX owns six, Transmap two, the Composer one,
 * and Materials, Sliders, Mixer, Evolution and the rest each build rows their own way — nine-plus
 * owners across ten files. Instrumenting all of them would have meant a registration call that the
 * NEXT builder can forget, which is the failure mode this project already knows by name (a missing
 * entry in one of three enumerations is structurally invisible).
 *
 * ✅ **What they all converge on is the DOM**, because two existing rules force it:
 *   - every row's `title` comes from `tooltips.ts`, and `tipcheck` asserts that in BOTH directions,
 *     so a control with no tooltip already fails `verify`;
 *   - every control carries an `aria-label` equal to its visible label, because `CLAUDE.md` requires
 *     specs to select on the label and forbids `data-testid`.
 *
 * **So a scan of the rendered panel is automatically total: a row that renders cannot be missed, and
 * nothing has to remember to register.** That is strictly stronger than instrumenting the builders,
 * and it is why this module takes a flat entry list and knows nothing about where it came from.
 *
 * ── the four reachability states, which is the part that decides whether the feature is honest ────
 *
 * A hit is not always somewhere you can go, and collapsing the cases would make the search lie:
 *
 *   `visible`   — on screen now.
 *   `collapsed` — built, but inside a closed group or sub-section. The easy case, and the common one:
 *                 all five Visual FX groups ship CLOSED and `Deformation` is a closed section inside
 *                 one of them, so `Symmetry` is two separate clicks deep. Jumping opens the chain.
 *   `hidden`    — built, but switched off by a control elsewhere in its own section. Transmap hides
 *                 **31 of 62** controls by Style. Jumping lands you on the GATE, never on the hidden
 *                 row, and never silently changes the gate's value.
 *   `absent`    — not built at all in this state. `Pitch`, `Roll` and `Descend` are **absent, not
 *                 disabled**, on a curve rule whose symbol set does not use them. There is nothing to
 *                 jump to, so the result says why and offers no jump.
 *
 * ⚠️ **`absent` must be REPORTED, not filtered out.** Dropping it is the tempting simplification and
 * it turns the search into a liar by omission: someone searching `Roll` would get an empty list and
 * conclude the engine has no such control, when it has one that this figure cannot use.
 */

/** What an entry describes. `value` rows are the named members of a registry, not controls. */
export type SettingsEntryKind = 'control' | 'value' | 'section';

/** See the header's fourth block. Ordered best-to-worst, which `REACH_RANK` depends on. */
export type SettingsReach = 'visible' | 'collapsed' | 'hidden' | 'absent';

/**
 * ⚠️ **Ordered, and the order is load-bearing for the ranking**: with two entries otherwise equal, the
 * one you can actually get to comes first. A `Record` rather than an array index so a new state is a
 * compile error here instead of a silent `undefined` in the comparator.
 */
export const REACH_RANK: Record<SettingsReach, number> = {
  visible: 0,
  collapsed: 1,
  hidden: 2,
  absent: 3,
};

export interface SettingsEntry {
  /**
   * Stable within one scan and used as the dropdown's key.
   *
   * ⚠️ **NOT a primary key across scans** — a rescan after a rule change legitimately produces a
   * different set, and two controls in different sections may share a label (`Enable` appears in
   * several). The id therefore carries the tab and the path, which is what makes it unique; see
   * `entryId`.
   */
  readonly id: string;
  /** The word on screen, which is also the control's `aria-label`. */
  readonly label: string;
  readonly tabId: string;
  /** The tab's visible name, which differs from its id (`'visual-fx'` shows as `Visual FX`). */
  readonly tabLabel: string;
  /** Group then section, outermost first. May be empty for a row that sits directly on a tab. */
  readonly path: readonly string[];
  readonly kind: SettingsEntryKind;
  /** The control's own tooltip, verbatim. Searched, and shown trimmed in the result row. */
  readonly tip: string;
  readonly reach: SettingsReach;
  /**
   * For `hidden`, the label of the control that would reveal this one; `null` otherwise.
   *
   * ⚠️ **This is where the jump goes for a hidden row, and the search does NOT set it.** Changing a
   * Transmap Style to reveal a row would rewrite the working preset as a side effect of looking
   * something up, and `CLAUDE.md` is explicit that the term rows' inputs are the only copy of what
   * unticking gives back. The user gets taken to the switch and decides.
   */
  readonly gateLabel: string | null;
}

/** Which part of the entry the query hit. Drives both the ranking and the result row's emphasis. */
export type SettingsMatchField = 'label' | 'value' | 'path' | 'tip';

export interface SettingsHit {
  readonly entry: SettingsEntry;
  readonly score: number;
  readonly matched: SettingsMatchField;
}

/**
 * The id for an entry, from the three things that make it unique.
 *
 * ⚠️ **The label alone is NOT unique and that is not a corner case**: Materials labels three different
 * checkboxes just `Enable` (Buoyancy, Sparks, Crystals) and relies on the section header to
 * disambiguate them on screen. A label-keyed index would silently collapse them to one.
 */
export function entryId(tabId: string, path: readonly string[], label: string): string {
  return `${tabId}\u0000${path.join('\u0000')}\u0000${label}`;
}

/**
 * Split a query into terms. Every term must match SOMETHING for the entry to be a hit (AND), which is
 * what makes a second word narrow rather than widen.
 *
 * ⚠️ The facet search next door uses a single `includes` over one haystack, which cannot express
 * *"symmetry mirror"*. This is the same idea with the AND made explicit, and it is the whole reason a
 * two-word query is worth typing.
 */
export function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
}

/** Lower-cased haystacks, built once per entry per search rather than per entry per term. */
interface Haystack {
  readonly label: string;
  readonly path: string;
  readonly tip: string;
}

/**
 * Score one term against one entry, or `null` if it does not match at all.
 *
 * ⚠️ **A WORD-START MATCH BEATS A SUBSTRING, AND THAT IS NOT COSMETIC.** Searching `fold` should reach
 * `Fold` and `Box Fold` before it reaches a tooltip containing *"unfolded"*. Scoring is therefore by
 * WHERE the term landed, not by how many times it occurs: a frequency score would rank the longest
 * tooltip first, which is the opposite of useful.
 */
function scoreTerm(h: Haystack, kind: SettingsEntryKind, term: string): { score: number; field: SettingsMatchField } | null {
  if (h.label === term) return { score: 100, field: kind === 'value' ? 'value' : 'label' };
  if (h.label.startsWith(term)) return { score: 80, field: kind === 'value' ? 'value' : 'label' };
  if (wordStart(h.label, term)) return { score: 70, field: kind === 'value' ? 'value' : 'label' };
  if (h.label.includes(term)) return { score: 55, field: kind === 'value' ? 'value' : 'label' };
  if (wordStart(h.path, term)) return { score: 40, field: 'path' };
  /*
   * ⚠️⚠️ **PATH AND TIP MATCH ON A WORD START ONLY, NEVER A BARE SUBSTRING, AND THAT IS A MEASURED
   * CORRECTION.** With substring tiers present, searching `roll` returned four rows from the Film
   * Look section and one from Evolution before anything named Roll -- because a tooltip containing
   * *"cont-roll-ed"* matched. A tooltip is a paragraph of prose, so a substring over it hits inside
   * words constantly, and those hits outrank nothing: they simply fill the list.
   *
   * ⚠️ **The LABEL keeps its substring tier** (above), because labels are short, curated, and the one
   * place a mid-word match is genuinely wanted -- `fold` reaching `Box Fold` and `Unfold`.
   */
  if (wordStart(h.tip, term)) return { score: 20, field: 'tip' };
  return null;
}

/** Does `term` start a word in `text`? Hand-rolled because a `RegExp` per term per entry is waste. */
function wordStart(text: string, term: string): boolean {
  let i = text.indexOf(term);
  while (i >= 0) {
    if (i === 0) return true;
    const prev = text.charCodeAt(i - 1);
    // Anything that is not a letter or a digit starts a word: space, hyphen, slash, bracket, dot.
    const alnum = (prev >= 97 && prev <= 122) || (prev >= 48 && prev <= 57);
    if (!alnum) return true;
    i = text.indexOf(term, i + 1);
  }
  return false;
}

/**
 * The ONE search law: every term must match, the score is the sum, ties break by reachability and
 * then alphabetically.
 *
 * ⚠️ **An EMPTY query returns NOTHING rather than everything**, which is the opposite of the facet
 * search's rule and is deliberate: the facet drawer is a visible list being narrowed, while this is a
 * dropdown that must not spring open with 400 rows the moment the field is focused.
 *
 * ⚠️ **`limit` truncates AFTER sorting**, so the cap can never hide a better hit behind a worse one —
 * the failure the grid's own name search had before it was capped (*"a truncated dropdown showed fewer
 * names than the filter had matched"*).
 */
export function searchSettings(
  entries: readonly SettingsEntry[],
  query: string,
  limit: number,
): SettingsHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const hits: SettingsHit[] = [];
  for (const entry of entries) {
    const h: Haystack = {
      label: entry.label.toLowerCase(),
      path: `${entry.tabLabel} ${entry.path.join(' ')}`.toLowerCase(),
      tip: entry.tip.toLowerCase(),
    };
    let total = 0;
    let best: SettingsMatchField = 'tip';
    let bestScore = -1;
    let all = true;
    for (const term of terms) {
      const r = scoreTerm(h, entry.kind, term);
      if (r === null) { all = false; break; }
      total += r.score;
      if (r.score > bestScore) { bestScore = r.score; best = r.field; }
    }
    if (all) hits.push({ entry, score: total, matched: best });
  }

  hits.sort((a, b) => b.score - a.score
    || REACH_RANK[a.entry.reach] - REACH_RANK[b.entry.reach]
    || a.entry.label.localeCompare(b.entry.label)
    || a.entry.id.localeCompare(b.entry.id));
  return hits.slice(0, limit);
}

/**
 * The path as one line for the result row: `Visual FX › Figure › Deformation`.
 *
 * ⚠️ **The TAB comes first and is never omitted**, even for a hit in the tab you are already on: the
 * whole point of the feature is answering *where* a setting lives, and a path that starts at the group
 * is ambiguous across ten tabs (`Enable`, `Strength` and `Amount` each appear in several).
 */
export function formatPath(entry: SettingsEntry): string {
  return [entry.tabLabel, ...entry.path].join(' › ');
}

/*
 * ⚠️ **`formatPath` HAS NO CALLER IN `src/` SINCE THE ROW STARTED BUILDING THE PATH FROM SEGMENTS, AND
 * IT IS NOT DEAD — IT IS `searchcheck`'s ORACLE FOR `pathSegments`.** The clause asserts that
 * `[tab, ...rest].join(' › ')` reassembles to exactly this string, which is what proves the split
 * loses nothing; removing it would leave that clause comparing the segments against themselves.
 * ⚠️ **Do not "use it" by assigning it to a result row's `title` either**: `tipcheck` asserts every
 * `title` in the UI comes from `tooltips.ts`, so a computed one fails that checker.
 */

/**
 * The path as SEGMENTS, so the row can give the tab more weight than the rest.
 *
 * ⚠️⚠️ **THE PATH IS THE INFORMATION THE USER ACTUALLY DECIDES ON, AND IT SHIPPED AS THE DIMMEST THING
 * ON THE ROW — owner-reported.** Three hits called `Symmetry` are told apart ONLY by where they live,
 * so a path rendered as faint small print makes the list unusable for its one purpose. **The label
 * answers "is this the thing"; the path answers "is this the RIGHT one", which is the harder question
 * and the reason the search exists.**
 *
 * ⚠️ **The TAB is returned separately because it is the coarsest discriminator** — ten tabs, and
 * `Enable`, `Strength` and `Amount` each appear in several. Emphasising it is what lets the eye skip
 * to the right row without reading the whole chain.
 *
 * ⚠️ Returned as data rather than as marked-up text, for `tipSnippet`'s reason: the caller builds DOM
 * nodes, so no `innerHTML` path exists to be misused later.
 */
export function pathSegments(entry: SettingsEntry): { tab: string; rest: readonly string[] } {
  return { tab: entry.tabLabel, rest: entry.path };
}

/** The three pieces of a tooltip snippet, so the caller can emphasise the middle one safely. */
export interface TipSnippet {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

/** How much tooltip to show around a match. Long enough for a clause, short enough for one line. */
const SNIPPET_RADIUS = 46;

/**
 * The fragment of a tooltip that a query matched, for a row that matched ONLY on its tooltip.
 *
 * ⚠️⚠️ **THIS EXISTS BECAUSE A TIP-ONLY HIT READS AS A FALSE POSITIVE WHEN IT IS A TRUE ONE, AND THE
 * OWNER REPORTED EXACTLY THAT.** Searching `symme` returned `Master crossfader`, which looks like
 * noise — until you read its tooltip, which names *"symmetry fold"* among the categorical fields that
 * SNAP rather than blend. That is a real answer to *"what affects symmetry"*, so the fix is to SHOW
 * why the row is there, never to filter it out: **filtering would have thrown away a correct answer to
 * make the list look tidier**, and the user would never know it had happened.
 *
 * ⚠️ **Returned as three pieces rather than marked-up text.** The caller builds DOM nodes from them,
 * so the emphasis costs no `innerHTML` — these strings come from our own registries today, and an
 * `innerHTML` path here would be a standing invitation for the first one that does not.
 *
 * ⚠️ `null` when no term matches the tip, which is the normal case for a label hit: the snippet is
 * additional evidence for the rows that need it, not a second description for every row.
 */
export function tipSnippet(entry: SettingsEntry, query: string): TipSnippet | null {
  const tip = entry.tip;
  if (tip.length === 0) return null;
  const lower = tip.toLowerCase();
  for (const term of queryTerms(query)) {
    // The same word-start rule the scoring uses, so the snippet can never disagree with the match.
    let i = lower.indexOf(term);
    while (i >= 0) {
      const prev = i === 0 ? 0 : lower.charCodeAt(i - 1);
      const alnum = (prev >= 97 && prev <= 122) || (prev >= 48 && prev <= 57);
      if (i === 0 || !alnum) {
        const from = Math.max(0, i - SNIPPET_RADIUS);
        const to = Math.min(tip.length, i + term.length + SNIPPET_RADIUS);
        return {
          before: (from > 0 ? '…' : '') + tip.slice(from, i),
          match: tip.slice(i, i + term.length),
          after: tip.slice(i + term.length, to) + (to < tip.length ? '…' : ''),
        };
      }
      i = lower.indexOf(term, i + 1);
    }
  }
  return null;
}

/**
 * The one-line reason a result cannot be jumped to, or `null` when it can.
 *
 * ⚠️ **Prose lives here, in the model, rather than in the row builder** — `tipcheck`'s inline scan
 * matches a literal directly after `.textContent =`, so a ternary assigned into the DOM is invisible
 * to the ceiling that caps UI copy. Returning the string and letting the caller assign it once keeps
 * the copy checkable, which is the same mechanical reason the Composer's notices are built that way.
 */
export function reachReason(entry: SettingsEntry): string | null {
  switch (entry.reach) {
    case 'visible':
      return null;
    case 'collapsed':
      return null;
    case 'hidden':
      return entry.gateLabel === null
        ? 'Switched off in the current state.'
        : `Switched off by ${entry.gateLabel}, in the same section.`;
    case 'absent':
      return 'Not available in the current state, so there is nothing to jump to.';
  }
}
