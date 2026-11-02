/**
 * v8 Phase 22 steps 22.4 / 22.5 — **the facet filter's three pieces of UI, built once and hosted twice.**
 *
 * The component owns four elements and the host decides where each goes:
 *
 * - **`button`** — the header's `Filter ▾ n` (`22.D15`), beside Sort.
 * - **`summary`** — the removable-chip row with `Clear all` and the `m / N` readout, shown only while something
 *   is active. The host may contribute one more removable chip for its own text search (`22.4`).
 * - **`drawer`** — the groups, in `FACET_GROUPS` order, with the semantics sentence and the facet search.
 * - **`empty`** — `22.5`'s empty state, which the host shows INSTEAD of its tile area.
 *
 * ⚠️ **This is a VIEW and it deliberately does NOT subscribe to `FilterState`.** The host subscribes, applies
 * the filter to its own tiles, and then calls `refresh()` — in that order, because the `m / N` readout and the
 * empty state's measurement both describe the result the host has just produced. A drawer that refreshed itself
 * off the change list would race the host and print the PREVIOUS count, which is the kind of off-by-one-click
 * error a user reads as "the number is wrong sometimes".
 *
 * ⚠️ **`refresh()` is the one writer of every piece of visible text here.** Two writers is how a chip's `×` and
 * its highlight end up disagreeing about which chips are active.
 *
 * ⚠️ **No facet tooltip is written here.** Each comes from its own `FacetDef.tip`, beside the predicate that
 * earns it — see the note in `tooltips.ts`'s `CHROME_TIPS`. The filter's CHROME text comes from `CHROME_TIPS`,
 * which is the rule for every `title` that has no descriptor of its own.
 *
 * ⚠️ **Every `keydown` in the facet search `stopPropagation()`s.** `main.ts`'s document handler binds the arrows
 * to preset navigation and the digits to film looks, and its guard tests `tagName === 'INPUT'` — which this
 * field satisfies, but the guard is not the contract and `22.D11` has just made the arrows mean something new.
 * Owning a key means stopping it at the widget (Phase 17's rule), never trusting a guard in `main.ts`.
 */

import type { FacetKey, FacetGroup, FacetRow } from '../../presets/preset-facets.ts';
import { FACET_GROUPS } from '../../presets/preset-facets.ts';
import { CHROME_TIPS } from '../synthesis-lab/tooltips.ts';
import type { FilterState, FacetIndex, FacetChipState } from './filter-model.ts';
import { diagnoseEmpty } from './filter-model.ts';

export interface FilterDrawerConfig {
  readonly state: FilterState;
  readonly index: FacetIndex;
  /** The names the host is showing right now, in display order — the `m` of `m / N` and `22.5`'s subject. */
  readonly getVisibleNames: () => string[];
  /** Every name the filter runs over, in display order. `22.5` drops each chip in turn against THIS list. */
  readonly getAllNames: () => string[];
  /**
   * The host's own text search, rendered as one more removable chip in the same row (`22.4`). ⚠️ **The host
   * owns it because the two hosts search different things** — the grid's field is also the rename editor.
   */
  readonly getSearchChip?: () => { readonly text: string; readonly onRemove: () => void } | null;
  /**
   * The host's own button class, for the `Filter ▾` button alone.
   *
   * ⚠️ **Only the BUTTON takes a host class, and only because it sits in the host's own row of buttons.** The
   * grid's header is `pg-mode-btn` and the Lab's is `sl-btn`, and a button that does not match the three beside
   * it reads as broken rather than as shared. Everything else the drawer builds is its own panel, so a second
   * skin for it would be two stylesheets to keep in step for no visible gain. ⚠️ **`pg-filter-btn` stays on
   * regardless** — `refresh()` and `setOpen()` toggle state classes that are defined against it.
   */
  readonly buttonClass?: string;
}

/** How many chips a collapsed group names before it gives up and counts the rest. */
const COLLAPSED_PREVIEW = 5;

export class FilterDrawer {
  private readonly config: FilterDrawerConfig;
  readonly button: HTMLButtonElement;
  readonly summary: HTMLElement;
  readonly drawer: HTMLElement;
  readonly empty: HTMLElement;

  /** Every chip button, by key — `refresh()` walks this rather than re-querying the DOM. */
  private readonly chips: Map<FacetKey, HTMLButtonElement> = new Map();
  /** Every group's `<details>` plus the rows it can hide, for the facet search. */
  private readonly rowEls: { readonly group: HTMLDetailsElement; readonly row: HTMLElement; readonly words: string }[] = [];
  private readonly countEls: Map<FacetKey, HTMLElement> = new Map();
  private semanticsEl: HTMLElement | null = null;
  private summaryChipsEl: HTMLElement | null = null;
  private countReadoutEl: HTMLElement | null = null;
  private emptyBodyEl: HTMLElement | null = null;
  private facetSearch: HTMLInputElement | null = null;
  private open = false;

  /**
   * ⚠️ **Every control here mutates `FilterState` and then STOPS.** The state's change list is what tells each
   * host to re-apply visibility and refresh its own drawer, so there is no callback from the drawer to its host:
   * a chip cycled in the Reel tab's copy has to move the grid too (`22.7` shares one state instance), and a
   * direct callback would have updated only the copy that was clicked.
   */
  constructor(config: FilterDrawerConfig) {
    this.config = config;
    this.button = this.buildButton();
    this.summary = this.buildSummary();
    this.drawer = this.buildDrawer();
    this.empty = this.buildEmpty();
    this.refresh();
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    // ⚠️ `display` is the toggle, so the drawer PUSHES the tiles down rather than floating over them
    // (`22.D5`) — the layout does that on its own once the element is in normal flow.
    this.drawer.style.display = open ? 'block' : 'none';
    this.button.classList.toggle('pg-mode-btn-active', open);
    this.button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) this.facetSearch?.focus();
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  // BUILD
  // ════════════════════════════════════════════════════════════════════════════════════════════════════

  private buildButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `${this.config.buttonClass ?? 'pg-mode-btn'} pg-filter-btn`;
    btn.title = CHROME_TIPS.filter;
    btn.setAttribute('aria-expanded', 'false');
    // ⚠️ `mousedown` for the same reason as Rename: the press blurs the search field first, and on the grid that
    // blur is what runs `cancelSearch()` 150 ms later. Acting on the press keeps the two independent.
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); this.toggle(); });
    return btn;
  }

  private buildSummary(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pg-filter-summary';
    row.style.display = 'none';

    this.summaryChipsEl = document.createElement('div');
    this.summaryChipsEl.className = 'pg-filter-summary-chips';
    row.appendChild(this.summaryChipsEl);

    const clear = document.createElement('button');
    clear.className = 'pg-filter-clear';
    clear.textContent = 'Clear all';
    clear.title = CHROME_TIPS.filterClear;
    clear.addEventListener('click', () => this.config.state.clear());
    row.appendChild(clear);

    this.countReadoutEl = document.createElement('span');
    this.countReadoutEl.className = 'pg-filter-count';
    this.countReadoutEl.title = CHROME_TIPS.filterCount;
    row.appendChild(this.countReadoutEl);

    return row;
  }

  private buildDrawer(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'pg-filter-drawer';
    root.style.display = 'none';

    const head = document.createElement('div');
    head.className = 'pg-fd-head';

    // ⚠️ **The law is PRINTED from the state** (`FilterState.describe()`), never a fixed caption — see that
    // method's own note. Set once here, rewritten only by `refresh()`.
    this.semanticsEl = document.createElement('span');
    this.semanticsEl.className = 'pg-fd-semantics';
    head.appendChild(this.semanticsEl);

    this.facetSearch = document.createElement('input');
    this.facetSearch.type = 'text';
    this.facetSearch.className = 'pg-fd-search';
    this.facetSearch.placeholder = 'Find a filter...';
    this.facetSearch.title = CHROME_TIPS.filterSearch;
    this.facetSearch.setAttribute('aria-label', 'Find a filter by name');
    this.facetSearch.addEventListener('input', () => this.applyFacetSearch());
    this.facetSearch.addEventListener('keydown', (e) => {
      e.stopPropagation();                                 // see the header's fourth ⚠️
      if (e.key === 'Escape') { this.facetSearch!.value = ''; this.applyFacetSearch(); }
    });
    head.appendChild(this.facetSearch);
    root.appendChild(head);

    for (const group of FACET_GROUPS) root.appendChild(this.buildGroup(group));
    return root;
  }

  /**
   * One group as a `<details>`.
   *
   * ⚠️ **`<details>`/`<summary>` rather than a hand-rolled collapse**, because it arrives with the disclosure
   * triangle, the keyboard behaviour and the `aria-expanded` semantics already correct — and because a
   * hand-rolled one would need a second copy of the open state (the element's and ours) with nothing to keep
   * them in step. ⚠️ **A collapsed group NAMES its contents** (`22.0`): a heading alone gives the owner no
   * reason to open the long ones.
   */
  private buildGroup(group: FacetGroup): HTMLDetailsElement {
    const details = document.createElement('details');
    details.className = 'pg-fd-group';
    details.open = group.defaultOpen;

    const head = document.createElement('summary');
    head.className = 'pg-fd-group-head';

    const title = document.createElement('span');
    title.className = 'pg-fd-group-title';
    title.textContent = group.label;
    head.appendChild(title);

    const hint = document.createElement('span');
    hint.className = 'pg-fd-group-hint';
    hint.textContent = this.contentsHint(group);
    head.appendChild(hint);
    details.appendChild(head);

    for (const row of group.rows) details.appendChild(this.buildRow(details, row));
    return details;
  }

  /** The collapsed row's preview — the first few chip names, then a count of what is left. */
  private contentsHint(group: FacetGroup): string {
    const words: string[] = [];
    for (const row of group.rows) {
      if (row.kind === 'boolean') words.push(row.facet.label);
      else words.push(row.label);
    }
    if (words.length <= COLLAPSED_PREVIEW) return words.join(' · ');
    const shown = words.slice(0, COLLAPSED_PREVIEW).join(' · ');
    return `${shown} · +${words.length - COLLAPSED_PREVIEW} more`;
  }

  private buildRow(group: HTMLDetailsElement, row: FacetRow): HTMLElement {
    const el = document.createElement('div');
    el.className = 'pg-fd-row';

    if (row.kind === 'boolean') {
      el.appendChild(this.buildChip(row.facet.key, row.facet.label, row.facet.tip));
      this.rowEls.push({ group, row: el, words: row.facet.label.toLowerCase() });
      return el;
    }

    const label = document.createElement('span');
    label.className = 'pg-fd-row-label';
    label.textContent = row.label;
    label.title = row.tip;
    el.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'pg-fd-row-chips';
    for (const facet of row.values) chips.appendChild(this.buildChip(facet.key, facet.label, facet.tip));
    el.appendChild(chips);

    // The row is findable by its own heading as well as by any of its values' labels.
    const words = [row.label, ...row.values.map((f) => f.label)].join(' ').toLowerCase();
    this.rowEls.push({ group, row: el, words });
    return el;
  }

  /**
   * One three-state chip.
   *
   * ⚠️ **`aria-pressed` cannot express three states, so the state is on `data-state` and the accessible name
   * carries it in words.** A chip that says only `Sparks` while excluding sparks is the one state a screen
   * reader user could not recover, and `22.D1`'s third state is the whole reason the row exists.
   */
  private buildChip(key: FacetKey, label: string, tip: string): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.className = 'pg-fd-chip';
    chip.dataset.facet = key;
    chip.title = tip;

    const text = document.createElement('span');
    text.className = 'pg-fd-chip-label';
    text.textContent = label;
    chip.appendChild(text);

    const count = document.createElement('span');
    count.className = 'pg-fd-chip-count';
    chip.appendChild(count);
    this.countEls.set(key, count);

    chip.addEventListener('click', () => {
      this.config.state.cycle(key);
    });

    this.chips.set(key, chip);
    return chip;
  }

  private buildEmpty(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'pg-filter-empty';
    root.style.display = 'none';

    const head = document.createElement('div');
    head.className = 'pg-filter-empty-head';
    // ⚠️ **Set ONCE, not composed with a ternary** — `tipcheck`'s `INLINE_SINK` matches a literal after `=`, so
    // ternary-assigned copy is invisible to it. The variable part goes in the body below.
    head.textContent = 'No preset matches this filter.';
    root.appendChild(head);

    this.emptyBodyEl = document.createElement('div');
    this.emptyBodyEl.className = 'pg-filter-empty-body';
    root.appendChild(this.emptyBodyEl);

    return root;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  // REFRESH — the one writer
  // ════════════════════════════════════════════════════════════════════════════════════════════════════

  refresh(): void {
    const { state, index } = this.config;
    const active = state.activeCount();

    this.button.textContent = active > 0 ? `Filter ▾ ${active}` : 'Filter ▾';
    this.button.classList.toggle('pg-filter-btn-on', active > 0);

    for (const [key, chip] of this.chips) {
      const s: FacetChipState = state.stateOf(key);
      chip.dataset.state = s;
      const n = index.count(key);
      const countEl = this.countEls.get(key);
      if (countEl) countEl.textContent = String(n);
      // ⚠️ **`22.D7`: a zero-count chip is GREYED BUT CLICKABLE** — never `disabled`. A disabled chip cannot be
      // hovered for its tooltip on every browser, and the tooltip is where the facet says what it would match;
      // the zero is also information about the library, which a dead control hides.
      chip.classList.toggle('pg-fd-chip-zero', n === 0);
      chip.setAttribute('aria-label', `${chip.querySelector('.pg-fd-chip-label')?.textContent ?? ''}, ${n} presets, ${ARIA_STATE[s]}`);
    }

    if (this.semanticsEl) this.semanticsEl.textContent = state.describe();

    const searchChip = this.config.getSearchChip?.() ?? null;
    this.summary.style.display = active > 0 || searchChip !== null ? 'flex' : 'none';
    this.renderSummaryChips(searchChip);

    const visible = this.config.getVisibleNames();
    if (this.countReadoutEl) this.countReadoutEl.textContent = `${visible.length} / ${index.total()}`;

    this.renderEmpty(visible.length === 0 && active > 0);
  }

  private renderSummaryChips(searchChip: { text: string; onRemove: () => void } | null): void {
    const host = this.summaryChipsEl;
    if (!host) return;
    host.innerHTML = '';

    if (searchChip) {
      const chip = document.createElement('button');
      chip.className = 'pg-filter-tag pg-filter-tag-search';
      chip.textContent = `⌕ ${searchChip.text} ×`;
      chip.title = CHROME_TIPS.filterSearchChip;
      chip.addEventListener('click', () => { searchChip.onRemove(); });
      host.appendChild(chip);
    }

    for (const key of this.config.state.activeKeys()) {
      const s = this.config.state.stateOf(key);
      const chip = document.createElement('button');
      chip.className = 'pg-filter-tag';
      chip.dataset.state = s;
      const label = this.chips.get(key)?.querySelector('.pg-fd-chip-label')?.textContent ?? key;
      chip.textContent = s === 'exclude' ? `− ${label} ×` : `${label} ×`;
      chip.setAttribute('aria-label', `Remove filter ${label}`);
      chip.addEventListener('click', () => this.config.state.drop(key));
      host.appendChild(chip);
    }
  }

  /**
   * `22.5` — the empty state, and the part of it that is a MEASUREMENT.
   *
   * ⚠️ **The two actions are `22.D9`'s**, and the first one is only offered when dropping a single chip actually
   * recovers something; `diagnoseEmpty` answers `null` otherwise and the state says so rather than offering a
   * button that would leave the result empty.
   */
  private renderEmpty(show: boolean): void {
    this.empty.style.display = show ? 'block' : 'none';
    const body = this.emptyBodyEl;
    if (!show || !body) return;
    body.innerHTML = '';

    const { state, index } = this.config;
    const diag = diagnoseEmpty(index, this.config.getAllNames(), state);

    const line = document.createElement('div');
    line.className = 'pg-filter-empty-line';
    line.textContent = `${diag.activeCount} filter${diag.activeCount === 1 ? '' : 's'} active: ${state.describe()}`;
    body.appendChild(line);

    const actions = document.createElement('div');
    actions.className = 'pg-filter-empty-actions';

    if (diag.bestDrop) {
      const drop = document.createElement('button');
      drop.className = 'pg-mode-btn';
      drop.textContent = `Drop “${diag.bestDrop.label}” — ${diag.bestDrop.recovered} presets come back`;
      drop.title = CHROME_TIPS.filterDrop;
      const key = diag.bestDrop.key;
      drop.addEventListener('click', () => state.drop(key));
      actions.appendChild(drop);
    } else {
      const note = document.createElement('div');
      note.className = 'pg-filter-empty-line';
      note.textContent = 'No single chip recovers anything — nothing in the library combines these.';
      actions.appendChild(note);
    }

    const clear = document.createElement('button');
    clear.className = 'pg-mode-btn';
    clear.textContent = 'Clear all';
    clear.title = CHROME_TIPS.filterClear;
    clear.addEventListener('click', () => state.clear());
    actions.appendChild(clear);

    body.appendChild(actions);
  }

  /** Narrows the visible ROWS by label. Groups with nothing left are hidden whole and forced open otherwise. */
  private applyFacetSearch(): void {
    const q = (this.facetSearch?.value ?? '').trim().toLowerCase();
    const live = new Set<HTMLDetailsElement>();
    for (const entry of this.rowEls) {
      const hit = q.length === 0 || entry.words.includes(q);
      entry.row.style.display = hit ? '' : 'none';
      if (hit) live.add(entry.group);
    }
    for (const entry of this.rowEls) {
      entry.group.style.display = live.has(entry.group) ? '' : 'none';
      // ⚠️ A hit inside a COLLAPSED group would otherwise be invisible — the search's whole purpose is the
      // long groups, and those are the collapsed ones.
      if (q.length > 0 && live.has(entry.group)) entry.group.open = true;
    }
  }
}

/** The words `aria-label` uses for the three states — one place, so the chip and the summary tag agree. */
const ARIA_STATE: Record<FacetChipState, string> = {
  any: 'not filtered',
  include: 'required',
  exclude: 'excluded',
};
