/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The settings search's UI: the header field, the results dropdown, and the jump.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `settings-search.ts` owns the matching law (pure), `settings-index.ts` owns the DOM scan and what a
 * jump TARGETS (data). This file is the only one that moves anything on screen. Read those two
 * headers first.
 *
 * ⚠️⚠️ **A SEPARATE MODULE RATHER THAN MORE OF `panel.ts`, AND NOT BECAUSE OF LINE COUNT.** The panel
 * owns the header, the tab bar and the registry; this owns a field, a list and a navigation verb. The
 * seam is a config of callbacks, which is the shape `FilterDrawer` already uses next door — and it is
 * what lets `searchcheck` drive the search over a fixture with no panel at all.
 *
 * ⚠️⚠️ **THE SEARCH NEVER WRITES ENGINE STATE. NOT ONCE, NOT FOR CONVENIENCE.** It opens tabs, expands
 * groups, scrolls and highlights. It does NOT set the Transmap Style that would reveal a hidden row,
 * because that would rewrite the working preset as a side effect of looking something up — and
 * `CLAUDE.md` is explicit that the term rows' inputs are the only copy of what unticking gives back.
 * The owner's chosen policy is: show it, explain it, offer one explicit click. **That click navigates
 * to the gate; the user decides.**
 */

import type { TabId } from '../../exploration/state.ts';
import {
  SETTINGS_SEARCH_LIMIT, jumpTargetFor, mergeIndex, scanSettings,
} from './settings-index.ts';
import {
  pathSegments, reachReason, searchSettings, tipSnippet,
  type SettingsEntry, type SettingsHit,
} from './settings-search.ts';
import { CHROME_TIPS } from './tooltips.ts';

export interface SettingsSearchConfig {
  /** The element every `.tab-content[data-tab]` lives under. */
  readonly tabContent: () => HTMLElement | null;
  /** `TAB_DEFS`' id → visible label, passed rather than re-declared (one owner). */
  readonly tabLabels: ReadonlyMap<string, string>;
  /** Build every unbuilt tab so the scan can see it. Idempotent. */
  readonly buildAll: () => void;
  /** Switch to a tab, exactly as a tab-bar click would. */
  readonly openTab: (id: TabId) => void;
}

/**
 * How long the jump highlight stays on.
 *
 * ⚠️ **Long enough to be seen after a scroll, short enough not to look like a selection state.** The
 * row is not selected — nothing was chosen — so a persistent highlight would be a lie about state.
 */
const HIGHLIGHT_MS = 1600;

export class SettingsSearch {
  private config: SettingsSearchConfig;
  private field: HTMLInputElement | null = null;
  private dropdown: HTMLElement | null = null;
  /** The remembered union; see `mergeIndex`'s header for why it is kept. */
  private index: SettingsEntry[] = [];
  private built = false;
  private hits: SettingsHit[] = [];
  private active = -1;
  private highlightTimer: number | null = null;

  constructor(config: SettingsSearchConfig) {
    this.config = config;
  }

  /** The field, for the host to place in its header. */
  buildField(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sl-search';

    const field = document.createElement('input');
    field.type = 'search';
    field.className = 'sl-search-field';
    field.placeholder = 'Find a setting…';
    field.title = CHROME_TIPS.settingsSearch;
    field.setAttribute('aria-label', 'Find a setting');
    /*
     * ⚠️⚠️ **EVERY `keydown` STOPS PROPAGATION, AND THIS IS THE SAME HAZARD THE FACET SEARCH DOCUMENTS.**
     * `main.ts` binds a document-level handler for the arrow keys and digits, and `CLAUDE.md` is explicit
     * that `preventDefault()` does not stop another listener and that a guard on `tagName === 'INPUT'`
     * does not exclude a `<canvas role="slider">`. Owning a key here means `stopPropagation()`, in the
     * widget, never a new condition in the panel's or `main.ts`'s guard.
     */
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { this.close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.moveActive(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.moveActive(-1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = this.hits[this.active] ?? this.hits[0];
        if (hit !== undefined) this.jump(hit.entry);
      }
    });
    field.addEventListener('input', () => this.refresh());
    field.addEventListener('focus', () => this.refresh());
    /*
     * ⚠️ `mousedown` on the dropdown must not blur the field before the click lands — the same ordering
     * the grid's Rename and the facet search both record. The dropdown's own handler calls
     * `preventDefault()` on `mousedown` for exactly this, so `blur` here can close freely.
     */
    field.addEventListener('blur', () => this.close());
    wrap.appendChild(field);
    this.field = field;
    return wrap;
  }

  /** The results list, for the host to place where it overlays the panel. */
  buildDropdown(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'sl-search-results';
    el.style.display = 'none';
    el.addEventListener('mousedown', (e) => e.preventDefault());
    this.dropdown = el;
    return el;
  }

  /** Close the dropdown without clearing the query, so a re-focus shows the same results. */
  close(): void {
    if (this.dropdown !== null) this.dropdown.style.display = 'none';
    this.active = -1;
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // INDEX
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * Make sure every tab has been built and rescan.
   *
   * ⚠️⚠️ **`buildAll()` RUNS ONCE AND THE RESCAN RUNS EVERY TIME, AND THE SPLIT IS THE WHOLE POINT.**
   * Building is expensive and idempotent; the *state* is not static — a rule change adds or removes
   * `Pitch`/`Roll`/`Descend`, a render-mode change reveals a whole section — so an index built once
   * and trusted would answer about a panel that no longer exists. Rescanning on every keystroke is a
   * `querySelectorAll` over ten already-built containers, which is cheap; **`mergeIndex` is what keeps
   * the deleted rows findable** instead of silently absent.
   */
  private ensureIndex(): void {
    if (!this.built) { this.config.buildAll(); this.built = true; }
    const root = this.config.tabContent();
    if (root === null) return;
    const fresh = scanSettings(root, this.config.tabLabels);
    this.index = mergeIndex(this.index, fresh.entries);
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  private refresh(): void {
    const q = this.field?.value ?? '';
    if (q.trim().length === 0) { this.hits = []; this.close(); return; }
    this.ensureIndex();
    this.hits = searchSettings(this.index, q, SETTINGS_SEARCH_LIMIT);
    this.active = this.hits.length > 0 ? 0 : -1;
    this.render();
  }

  private render(): void {
    const el = this.dropdown;
    const query = this.field?.value ?? '';
    if (el === null) return;
    el.textContent = '';
    el.style.display = '';

    if (this.hits.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'sl-search-empty';
      /*
       * ⚠️ **ONE literal, set once** — `tipcheck`'s inline scan matches a literal directly after
       * `.textContent =`, so copy assembled in a ternary is invisible to the ceiling that caps UI
       * prose. Same mechanical reason as the Composer's notices.
       */
      empty.textContent = 'No setting matches that. Try a word from the control’s own name, or from '
        + 'what it does — the search reads the tooltips too.';
      el.appendChild(empty);
      return;
    }

    for (const [i, hit] of this.hits.entries()) {
      el.appendChild(this.buildRow(hit, i === this.active, query));
    }
  }

  private buildRow(hit: SettingsHit, isActive: boolean, query: string): HTMLElement {
    const { entry } = hit;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'sl-search-row';
    if (isActive) row.classList.add('active');
    if (entry.reach === 'absent') row.classList.add('absent');

    const head = document.createElement('span');
    head.className = 'sl-search-row-label';
    head.textContent = entry.label;
    row.appendChild(head);

    /*
     * ⚠️ **A `value` hit is tagged, because otherwise the list lies by looking uniform.** `Neon` is a
     * film look AND a palette AND part of a section name; without the tag three rows read as three
     * copies of one thing. The tag is the kind, not a friendlier invented word.
     */
    if (entry.kind === 'value') {
      const tag = document.createElement('span');
      tag.className = 'sl-search-row-tag';
      tag.textContent = 'value';
      row.appendChild(tag);
    }

    /*
     * ⚠️⚠️ **THE PATH IS BUILT FROM SEGMENTS, NOT ONE STRING, SO THE TAB CAN CARRY MORE WEIGHT.** The
     * owner reported the path as *"barely readable"* and said why it matters: *"the location of the
     * functionality is an important information to decide which of the hits is the right one"*. Three
     * rows called `Symmetry` are told apart by nothing else. The label answers *is this the thing*;
     * the path answers *is this the RIGHT one*, which is the harder question and the reason the search
     * exists — so it is no longer small print.
     *
     * ⚠️ The separator is its own dim span so the segments read as units rather than as one run of
     * text, and it is a literal set once (see the empty-state note on `tipcheck`'s inline scan).
     */
    const seg = pathSegments(entry);
    const path = document.createElement('span');
    path.className = 'sl-search-row-path';
    const tab = document.createElement('b');
    tab.className = 'sl-search-row-tab';
    tab.textContent = seg.tab;
    path.appendChild(tab);
    for (const part of seg.rest) {
      const sep = document.createElement('span');
      sep.className = 'sl-search-row-sep';
      sep.textContent = '›';
      path.appendChild(sep);
      path.append(part);
    }
    row.appendChild(path);

    /*
     * ⚠️⚠️ **A ROW THAT MATCHED ONLY ITS TOOLTIP SHOWS THE MATCHING FRAGMENT, AND THAT IS A REPORTED
     * DEFECT FIX RATHER THAN DECORATION.** The owner searched `symme` and got `Master crossfader`,
     * which reads as a false positive — it is a TRUE one: that tooltip names *"symmetry fold"* among
     * the categorical fields the Mixer SNAPS instead of blending, so it genuinely answers *"what
     * affects symmetry"*. **Without the fragment the row cannot be judged at all**, and the obvious
     * alternative — dropping tip-only hits — would have discarded a correct answer to make the list
     * look tidier, invisibly.
     *
     * ⚠️ Only for `matched === 'tip'`: a label hit needs no evidence, and a snippet on every row would
     * turn the dropdown into a wall of prose and bury the paths, which are the actual answer.
     */
    if (hit.matched === 'tip') {
      const snip = tipSnippet(entry, query);
      if (snip !== null) {
        const why = document.createElement('span');
        why.className = 'sl-search-row-tip';
        why.append(snip.before);
        const mark = document.createElement('b');
        mark.textContent = snip.match;
        why.appendChild(mark);
        why.append(snip.after);
        row.appendChild(why);
      }
    }

    const reason = reachReason(entry);
    if (reason !== null) {
      const why = document.createElement('span');
      why.className = 'sl-search-row-why';
      why.textContent = reason;
      row.appendChild(why);
    }

    row.addEventListener('click', () => this.jump(entry));
    return row;
  }

  private moveActive(delta: number): void {
    if (this.hits.length === 0) return;
    this.active = (this.active + delta + this.hits.length) % this.hits.length;
    this.render();
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // JUMP
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * Go to an entry: open its tab, expand the chain, scroll, highlight.
   *
   * ⚠️⚠️ **AN `absent` ENTRY OPENS ITS TAB AND STOPS, WHICH IS THE HONEST ACTION.** There is no element
   * to scroll to — the control does not exist in this state — so scrolling somewhere plausible and
   * flashing it would point at the wrong row. The result row already carries the reason.
   */
  private jump(entry: SettingsEntry): void {
    const target = jumpTargetFor(entry);
    this.close();
    this.config.openTab(target.tabId);

    const root = this.config.tabContent();
    const container = root?.querySelector<HTMLElement>(`.tab-content[data-tab="${target.tabId}"]`);
    if (container === null || container === undefined) return;

    /*
     * ⚠️⚠️ **EXPAND BEFORE MEASURING, AND EXPAND THE WHOLE CHAIN OUTERMOST FIRST.** `Symmetry` sits in
     * a closed section inside a closed group — two separate clicks — and an inner head inside a
     * collapsed body has no layout, so opening the inner one first measures nothing and scrolls
     * nowhere. This is the same lesson `capture-ui.mjs` and `ComposerFixture` each record: without the
     * expansion a target that is built, correct and one click away reads as a deleted section.
     */
    for (const name of target.expand) this.expandNamed(container, name);

    if (target.label === null) return;
    const el = container.querySelector<HTMLElement>(`[aria-label="${cssEscape(target.label)}"]`);
    if (el === null) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.highlight(el);
  }

  /** Open one collapsible by its head text, if it is closed. */
  private expandNamed(container: HTMLElement, name: string): void {
    for (const head of Array.from(
      container.querySelectorAll<HTMLElement>('.sl-vfx-group-head, .sl-vfx-sub-head'),
    )) {
      const text = head.querySelector('span')?.textContent?.trim();
      if (text !== name) continue;
      /*
       * ⚠️ **Click only where `aria-expanded` DISAGREES with open** — the heads are toggles, so an
       * unconditional click on an already-open group CLOSES it, which would hide the very row the jump
       * is on its way to. `capture-ui.mjs` carries the same warning from having done it.
       */
      if (head.getAttribute('aria-expanded') === 'false') head.click();
      return;
    }
  }

  /**
   * Flash the target.
   *
   * ⚠️ **The row, not the control**, so a 16-px checkbox is still findable by eye; and the class is
   * removed on a timer that is CLEARED first, or two jumps in quick succession leave the first
   * element lit forever — a stale highlight reads as a selection that cannot be dismissed.
   */
  private highlight(el: HTMLElement): void {
    if (this.highlightTimer !== null) window.clearTimeout(this.highlightTimer);
    for (const old of Array.from(document.querySelectorAll('.sl-search-hit'))) {
      old.classList.remove('sl-search-hit');
    }
    const row = el.closest<HTMLElement>('.sl-vfx-row') ?? el;
    row.classList.add('sl-search-hit');
    this.highlightTimer = window.setTimeout(() => {
      row.classList.remove('sl-search-hit');
      this.highlightTimer = null;
    }, HIGHLIGHT_MS);
  }
}

/**
 * Escape a label for an attribute selector.
 *
 * ⚠️ **Hand-rolled because `CSS.escape` escapes an IDENT, not a STRING literal**, and these are
 * attribute VALUES in quotes: the only characters that can break out are the quote and the backslash.
 * Labels here contain spaces, `°`, `/` and `&` (`Teal & Orange`), all of which are fine inside quotes
 * and all of which `CSS.escape` would mangle into a selector that matches nothing.
 */
function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
