import type { ExplorationState, TabId } from './state.ts';
import type { UnifiedPreset } from '../presets/types.ts';

export interface TabModule {
  readonly id: TabId;
  init(container: HTMLElement, state: ExplorationState): void;
  activate(): void;
  deactivate(): void;
  dispose(): void;
  /**
   * Called by the panel Reset button. Restore the tab to the state it had on entry.
   *
   * REQUIRED, deliberately. It was optional until 2026-08-06, and that is precisely how
   * `EvolutionTab`'s omission went unnoticed: Reset restored the working preset and the overlays but
   * left 9 tiles animating mutations of the pre-reset preset, with nothing to signal the gap. A tab
   * with genuinely nothing to restore should say so with an explicit empty body **carrying a comment
   * that says WHY** — `HistoryTab.reset()` is the exemplar ("History is not modified by Reset — only
   * cleared by the Clear button") — rather than by leaving the method off. ⚠️ **`ArchetypesTab` was the
   * exemplar named here until 2026-10-04, and its body was empty with no comment**, which is the weaker
   * form: an uncommented empty body is indistinguishable from a forgotten one.
   */
  reset(entryPreset: UnifiedPreset): void;
}

export class TabRegistry {
  private tabs: Map<TabId, TabModule> = new Map();
  private containers: Map<TabId, HTMLElement> = new Map();
  private initialized: Set<TabId> = new Set();
  private state: ExplorationState;
  private parentEl: HTMLElement;

  /** The tab currently shown, or null while the whole registry is suspended. */
  private shownId: TabId | null = null;
  /** The tab `suspend()` put away, so `resume()` knows what to bring back. */
  private suspendedId: TabId | null = null;

  constructor(parentEl: HTMLElement, state: ExplorationState) {
    this.parentEl = parentEl;
    this.state = state;
  }

  register(tab: TabModule): void {
    this.tabs.set(tab.id, tab);
  }

  show(id: TabId): void {
    for (const [tabId, tab] of this.tabs) {
      if (tabId === id) {
        if (!this.initialized.has(tabId)) {
          const container = this.createContainer(tabId);
          tab.init(container, this.state);
          this.initialized.add(tabId);
        }
        this.containers.get(tabId)!.style.display = '';
        tab.activate();
      } else if (this.initialized.has(tabId)) {
        this.containers.get(tabId)!.style.display = 'none';
        tab.deactivate();
      }
    }
    this.shownId = id;
    // An explicit switch supersedes any suspension, so `resume()` cannot later re-show a stale tab.
    this.suspendedId = null;
    this.state.setTab(id);
  }

  /**
   * Deactivate the shown tab because the whole Lab is being hidden — WITHOUT forgetting which tab it
   * was, so `resume()` can restore it.
   *
   * `show()` only ever deactivates the tabs it is switching AWAY from, which is correct for a switch and
   * wrong for hiding the panel: nothing was switching, so the shown tab kept every per-frame cost it
   * had acquired on entry. Two costs leaked this way, both for the life of the session:
   *
   * - `EvolutionTab`/`HistoryTab` leave their `GridTileRenderer` on `setActive(true)`. Its `tick()` is
   *   called unconditionally from the render loop and returns early only when inactive, so after one
   *   visit to either tab that renderer kept spending its full 4 + 12 + 10 ms budget. Switching to
   *   Grid mode then ran the preview grid's renderer CONCURRENTLY with it — 2 x 26 ms against a 16.7 ms
   *   frame. Visiting both tabs first made it three.
   * - `MaterialsTab` leaves a 250 ms `setInterval` polling crystal pool occupancy into a DOM node
   *   nobody can see.
   *
   * Idempotent: suspending an already-suspended registry does nothing, so a repeated hide cannot
   * double-deactivate (which would clear `MaterialsTab`'s timer twice — harmless — but would also call
   * `setActive(false)` after a `resume()` had legitimately turned it back on, were the two interleaved).
   */
  suspend(): void {
    if (this.shownId === null) return;
    const tab = this.tabs.get(this.shownId);
    if (tab && this.initialized.has(this.shownId)) tab.deactivate();
    this.suspendedId = this.shownId;
    this.shownId = null;
  }

  /** Re-activate the tab that `suspend()` put away. No-op if not suspended. */
  resume(): void {
    if (this.shownId !== null || this.suspendedId === null) return;
    this.show(this.suspendedId);
    this.suspendedId = null;
  }

  private createContainer(id: TabId): HTMLElement {
    const el = document.createElement('div');
    el.className = `tab-content tab-${id}`;
    el.dataset.tab = id;
    this.parentEl.appendChild(el);
    this.containers.set(id, el);
    return el;
  }

  getTab(id: TabId): TabModule | undefined {
    return this.tabs.get(id);
  }

  dispose(): void {
    for (const [id, tab] of this.tabs) {
      if (this.initialized.has(id)) {
        tab.dispose();
      }
    }
    this.tabs.clear();
    this.containers.clear();
    this.initialized.clear();
  }
}
