/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The settings search's DOM half: SCAN the built panel into a flat index, and JUMP to an entry.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `settings-search.ts` owns the matching law and is pure; this file owns everything that touches the
 * document. Read that file's header first — it explains why the index is scanned rather than
 * registered by the row builders, and what the four reachability states mean.
 *
 * ⚠️⚠️ **NOTHING HERE READS A REGISTRY, AND THAT IS THE POINT.** Every control is found by its
 * `aria-label` and every named VALUE is found as an `<option>`'s text, so a new film look, palette,
 * material, render mode, Transmap style or curve rule becomes searchable the moment it renders —
 * with no list to extend. Importing `FILM_LOOKS`, the palette catalogue and the rest would have put
 * a second enumeration of each beside the one the `<select>` is already built from.
 *
 * ⚠️⚠️ **THE TWO DOM FACTS THIS RESTS ON ARE ALREADY ENFORCED ELSEWHERE, WHICH IS WHAT MAKES THE
 * INDEX TOTAL RATHER THAN HOPEFUL**: every control carries an `aria-label` equal to its visible label
 * (`CLAUDE.md` requires specs to select on it and forbids `data-testid`), and every row's `title`
 * comes from `tooltips.ts` with `tipcheck` asserting BOTH directions. **A control with no accessible
 * name or no tooltip fails `verify` today**, so it cannot quietly fall out of this index.
 *
 * ── the stated limit, rather than one discovered later ───────────────────────────────────────────
 *
 * ⚠️⚠️ **THE INDEX KNOWS ONLY WHAT HAS RENDERED AT LEAST ONCE THIS SESSION.** Every tab is built up
 * front (`TabRegistry.buildAll()`), so that is all ten tabs in their CURRENT state — but a control
 * that is *absent* in that state has nothing to scan. `Pitch`, `Roll` and `Descend` do not exist on a
 * curve rule whose symbol set never turns in those planes, so on such a preset they are simply not
 * there to find.
 *
 * ✅ **What closes most of that gap is the UNION: entries are remembered across rescans.** Switch to a
 * rule that has `Roll`, and `Roll` is in the index from then on — and if you switch away, it is
 * reported `absent` with its reason instead of vanishing. **A control never rendered in this session
 * is a miss, not a wrong answer**, which is the honest failure direction: the search can fail to find
 * something, but it never claims a control does not exist.
 */

import type { TabId } from '../../exploration/state.ts';
import {
  entryId, type SettingsEntry, type SettingsReach,
} from './settings-search.ts';

/** How many results the dropdown shows. Sorted first, so the cap can never hide a better hit. */
export const SETTINGS_SEARCH_LIMIT = 40;

/**
 * The classes a scan has to understand, named once.
 *
 * ⚠️ **These are read from the DOM and are therefore a coupling to the row builders' markup** — the
 * price of scanning instead of registering, and `searchcheck` is what holds them honest: a clause
 * asserts the scan finds a known control in every tab, so a class rename fails there rather than
 * silently emptying the index.
 *
 * ⚠️ **There is deliberately no selector for the collapsible HEAD.** `makeCollapsible` emits the head
 * as the body's immediately preceding sibling, so the body is the only anchor needed and a head
 * selector would be a second route to the same element — one that a markup change could leave
 * pointing at the wrong one while the other still worked.
 */
const GROUP_BODY = 'sl-vfx-group-body';
const SECTION_TITLE = '.sl-section-title';

/** A control worth indexing: it has an accessible name and a user can act on it. */
const CONTROL_SELECTOR = 'input[aria-label], select[aria-label], canvas[aria-label][role="slider"]';

export interface ScanResult {
  readonly entries: readonly SettingsEntry[];
  /** Per-tab counts, for the checker's report and for diagnosing an empty scan. */
  readonly perTab: ReadonlyMap<string, number>;
}

/**
 * A control worth indexing, beyond the input-like ones.
 *
 * ⚠️⚠️ **BUTTONS ARE INDEXED, BECAUSE WITHOUT THEM THREE TABS ARE ENTIRELY UNSEARCHABLE.**
 * Measured: Randomise, Evolution and History contain **zero** labelled inputs between them -- their
 * whole interface is buttons and tiles. A search that silently covered seven of ten tabs would be
 * worse than none, because nothing on screen says which tabs it knows about.
 *
 * ⚠️ **Collapsible HEADS are excluded**: they are navigation, they already appear in every enclosed
 * entry's path, and indexing them would put a second row for `Deformation` beside every control in
 * it. The exclusion is by class, which is also why the classes are named in one place.
 */
const BUTTON_SELECTOR = 'button';
const HEAD_CLASSES = ['sl-vfx-group-head', 'sl-vfx-sub-head'];

/**
 * Subtrees the scan refuses to enter.
 *
 * ⚠️⚠️ **THE PRESET FILTER DRAWER IS NOT A SETTINGS SURFACE, AND INDEXING IT WAS ACTIVELY MISLEADING.**
 * The Reel tab hosts a copy of it, and its chips carry a COMPOSED accessible name -- the scan showed
 * rows reading *"Symmetry fold, 2 presets, not filtered"* beside the real `Symmetry` control. Those
 * are filters over PRESETS, they already have their own search (the one this feature is modelled on),
 * and a filter chip is worth having only when enough presets carry the feature while a settings entry
 * is worth having for every control -- two different universes that must not be merged in one list.
 *
 * ⚠️ **An EXCLUSION rather than a narrower include**, because the include side is what makes the index
 * total: anything labelled is indexed unless it is named here, so a new tab cannot be missed by
 * omission. A new non-settings surface inside a tab has to be added to this list deliberately.
 */
const SKIP_SUBTREES = '.pg-filter-drawer, .pg-fd-summary, .sl-search-results';

/** Is this element a gate -- something that can switch a sibling block off? */
function isGate(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'select' || (tag === 'input' && (el as HTMLInputElement).type === 'checkbox');
}

/** The accessible name of a control, or `null` when it has none worth indexing. */
function controlLabel(el: HTMLElement): string | null {
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria !== undefined && aria.length > 0) return aria;
  // A button's visible text is its name; an input without one is not indexable.
  if (el.tagName.toLowerCase() !== 'button') return null;
  const text = el.textContent?.trim();
  return text !== undefined && text.length > 0 && text.length <= 40 ? text : null;
}

/** State carried down one branch of the walk. */
interface WalkFrame {
  readonly path: readonly string[];
  readonly section: string | null;
  /** The outermost hidden ancestor, or null. */
  readonly hiddenBy: HTMLElement | null;
  /** True while every hidden ancestor so far is a collapsed group body. */
  readonly collapsedOnly: boolean;
  /** The tooltip inherited from the nearest ancestor that carried one. */
  readonly tip: string;
}

/**
 * Scan one tab container in ONE document-order pass.
 *
 * ⚠️⚠️ **THIS REPLACED A PER-CONTROL ANCESTOR WALK AND THE REASON IS A MEASUREMENT, NOT TASTE.**
 * The first version resolved each control's section by walking its previous siblings and running a
 * subtree query on each one, so the scan was quadratic in the DOM and the first keystroke in the
 * search field cost **4307 ms of frozen UI**. A single pass that carries the section and the
 * collapsible chain down with it is O(n) **and** correct by construction: the earlier version also
 * climbed out of `Deformation` and picked up the section before it, giving `Symmetry` the path
 * `Visual FX › Figure › Deformation › Curve Basis` -- a path naming a section it is not in.
 *
 * ⚠️ **The GATE is tracked the same way** -- the last visible gate seen in the current section,
 * reset at every section title. The old backward walk could cross a section boundary, which is how a
 * hidden Crystals row came to blame `Enable Sparks`: Materials labels three different checkboxes just
 * `Enable` and relies on the heading to tell them apart.
 */
function scanContainer(
  container: HTMLElement,
  tabId: string,
  tabLabel: string,
  seen: Set<string>,
  out: SettingsEntry[],
): number {
  let count = 0;

  const visit = (node: Element, frame: WalkFrame, gate: { label: string | null }): void => {
    let section = frame.section;
    for (const child of Array.from(node.children)) {
      const el = child as HTMLElement;

      // A refused subtree is skipped WHOLE, children included -- see `SKIP_SUBTREES`.
      if (el.matches(SKIP_SUBTREES)) continue;

      if (el.matches(SECTION_TITLE)) {
        // A new section starts here, and it resets the gate: a gate belongs to one section only.
        section = el.textContent?.trim() ?? null;
        gate.label = null;
        continue;
      }

      const isHidden = el.style.display === 'none' || el.hidden;
      const isBody = el.classList.contains(GROUP_BODY);
      const hiddenBy = frame.hiddenBy ?? (isHidden ? el : null);
      const collapsedOnly = frame.collapsedOnly && (frame.hiddenBy !== null || !isHidden || isBody);
      const ownTip = el.getAttribute('title');
      const tip = ownTip !== null && ownTip.length > 0 ? ownTip : frame.tip;

      let path = frame.path;
      let childSection = section;
      if (isBody) {
        /*
         * ⚠️ The head is the body's immediately preceding sibling and its FIRST span is the label --
         * the second is the live count badge, so `head.textContent` would read "Deformation3 active
         * here". ⚠️ A collapsible also RESETS the section: inside it, the enclosing section's title
         * is no longer the answer to "where is this", the collapsible's own name is.
         */
        const name = el.previousElementSibling?.querySelector('span')?.textContent?.trim();
        if (name !== undefined && name.length > 0) path = [...path, name];
        childSection = null;
      }

      const label = controlLabel(el);
      const indexable = label !== null
        && (el.matches(CONTROL_SELECTOR)
          || (el.matches(BUTTON_SELECTOR) && !HEAD_CLASSES.some((c) => el.classList.contains(c))));

      if (indexable && label !== null) {
        const fullPath = childSection === null ? path : [...path, childSection];
        const reach: SettingsReach = hiddenBy === null
          ? 'visible' : collapsedOnly ? 'collapsed' : 'hidden';
        const id = entryId(tabId, fullPath, label);
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            id, label, tabId, tabLabel, path: fullPath, kind: 'control', tip,
            reach, gateLabel: reach === 'hidden' ? gate.label : null,
          });
          count++;
        }

        /*
         * A select's OPTIONS are the named values, indexed from the element rather than from any
         * catalogue. ⚠️ The option's own text is the shipped word, so the rule that labels must be
         * the shipped words and not invented friendlier ones holds for free -- which a hand-written
         * value list could not promise. The entry's path ends with the SELECT's own label, so `Neon`
         * reads as `Visual FX › Colour › Film Look › Look` and is distinguishable from the `Neon
         * Lines` section and from the `Neon` palette.
         */
        if (el.tagName.toLowerCase() === 'select') {
          const valuePath = [...fullPath, label];
          for (const opt of Array.from((el as HTMLSelectElement).options)) {
            const text = opt.textContent?.trim() ?? '';
            if (text.length === 0) continue;
            const vid = entryId(tabId, valuePath, text);
            if (seen.has(vid)) continue;
            seen.add(vid);
            out.push({
              id: vid, label: text, tabId, tabLabel, path: valuePath, kind: 'value', tip,
              reach, gateLabel: reach === 'hidden' ? gate.label : null,
            });
            count++;
          }
        }
      }

      // Remember a VISIBLE gate for the rest of this section -- what a hidden row below it needs.
      if (isGate(el) && !isHidden && hiddenBy === null) {
        gate.label = el.getAttribute('aria-label') ?? gate.label;
      }

      if (el.children.length > 0) {
        visit(el, { path, section: childSection, hiddenBy, collapsedOnly, tip }, gate);
      }
    }
  };

  visit(container, { path: [], section: null, hiddenBy: null, collapsedOnly: true, tip: '' },
    { label: null });
  return count;
}

/**
 * Scan every built tab container into entries.
 *
 * ⚠️ **`tabLabels` is passed in rather than imported from `panel.ts`**, which keeps this module free
 * of the panel and lets `searchcheck` drive it with a fixture. The panel already owns `TAB_DEFS`, so
 * passing the map is the one-owner arrangement; a second copy of the id-to-label pairing here would be
 * invariant 17's shape.
 */
export function scanSettings(
  root: ParentNode,
  tabLabels: ReadonlyMap<string, string>,
): ScanResult {
  const entries: SettingsEntry[] = [];
  const perTab = new Map<string, number>();
  const seen = new Set<string>();
  for (const container of Array.from(root.querySelectorAll<HTMLElement>('.tab-content[data-tab]'))) {
    const tabId = container.dataset['tab'] ?? '';
    const tabLabel = tabLabels.get(tabId) ?? tabId;
    perTab.set(tabId, scanContainer(container, tabId, tabLabel, seen, entries));
  }
  return { entries, perTab };
}

/**
 * Merge a fresh scan over a remembered index, so a control that has disappeared becomes `absent`
 * rather than vanishing.
 *
 * ⚠️⚠️ **THE DIRECTION MATTERS: the FRESH scan wins for anything it contains, and the remembered copy
 * survives only for ids the scan no longer has.** The other way round would pin the first state the
 * app was ever in — a `Roll` that is back would still read "not available", which is the stale-readout
 * defect this project has hit before.
 */
export function mergeIndex(
  remembered: readonly SettingsEntry[],
  fresh: readonly SettingsEntry[],
): SettingsEntry[] {
  const out: SettingsEntry[] = [...fresh];
  const have = new Set(fresh.map((e) => e.id));
  for (const old of remembered) {
    if (have.has(old.id)) continue;
    out.push({ ...old, reach: 'absent', gateLabel: null });
  }
  return out;
}

export interface JumpTarget {
  readonly tabId: TabId;
  /** The `aria-label` to find once the tab is shown; `null` for an `absent` entry. */
  readonly label: string | null;
  /** Expand these group heads, outermost first, before scrolling. */
  readonly expand: readonly string[];
}

/**
 * What a click on a result should do, as DATA — so the panel performs it and this module stays
 * testable without a panel.
 *
 * ⚠️ **A `hidden` entry targets its GATE, not itself.** Scrolling to a `display: none` row lands on
 * nothing and reads as a broken jump; landing on the switch that would reveal it is the honest
 * destination, and it is the owner's chosen policy — show it, explain it, offer one explicit click,
 * and never change the gate's value as a side effect of a lookup.
 */
export function jumpTargetFor(entry: SettingsEntry): JumpTarget {
  const expand = entry.path;
  if (entry.reach === 'absent') {
    return { tabId: entry.tabId as TabId, label: null, expand };
  }
  if (entry.reach === 'hidden' && entry.gateLabel !== null) {
    return { tabId: entry.tabId as TabId, label: entry.gateLabel, expand };
  }
  // A `value` entry's own label is an option, not a control: jump to the select that holds it.
  const label = entry.kind === 'value' ? (entry.path[entry.path.length - 1] ?? null) : entry.label;
  return { tabId: entry.tabId as TabId, label, expand };
}
