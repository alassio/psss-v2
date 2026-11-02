import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, HistoryEntry, TabId } from '../../../exploration/state.ts';
import type { GridTileRenderer } from '../../preview-grid/grid-tile-renderer.ts';
import { deepCopy } from '../../../exploration/state.ts';
import { TAB_TIPS } from '../tooltips.ts';

const TILE_W = 256;
const TILE_H = 192;

function slotKey(i: number): string { return `hist-${i}`; }

export class HistoryTab implements TabModule {
  readonly id: TabId = 'history';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private tileRenderer: GridTileRenderer;
  private tileCanvases: HTMLCanvasElement[] = [];
  private tileElements: HTMLElement[] = [];
  private historyListener: ((data?: unknown) => void) | null = null;
  /**
   * Which entry each slot is currently rendering, by OBJECT IDENTITY.
   *
   * This used to be a plain `renderedCount`, and `syncTiles` only acquired a slot when
   * `i >= renderedCount`. That is correct only while the list grows by appending. Once the list is full
   * `pushSnapshot` evicts FIFO (`state.ts` `history.shift()`), so **every** entry slides down one index
   * while the length stays at `HISTORY_MAX` — and with `entries.length === renderedCount === 10` the
   * release loop ran zero times *and* `i >= renderedCount` was false for every `i`, so `syncTiles`
   * degenerated into a pure label rewrite. All ten tiles kept animating the first ten snapshots forever,
   * every label was off by one, the newest snapshot was never rendered, and clicking a tile restored the
   * **labelled** preset rather than the one being animated.
   *
   * Identity is the right key because `HistoryEntry` objects are created once in `pushSnapshot` and never
   * mutated, so "same object" exactly means "same tile content". Comparing by index cannot express a
   * shift, and comparing by label or preset name cannot either — snapshots may share both.
   */
  private slotEntries: (HistoryEntry | null)[] = [];
  /**
   * The active entry as an OBJECT, not an index — for the same reason. A FIFO eviction shifts indices, so
   * a stored index would silently start pointing at a different snapshot and highlight the wrong tile.
   */
  private activeEntry: HistoryEntry | null = null;

  constructor(tileRenderer: GridTileRenderer) {
    this.tileRenderer = tileRenderer;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.render();

    this.historyListener = () => this.syncTiles();
    state.on('history-changed', this.historyListener);
  }

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.tileCanvases = [];
    this.tileElements = [];
    // The canvases these slots were drawing into are gone, so nothing is rendered any more. Releasing
    // first would be wrong: `syncTiles` below re-acquires, and a release/acquire pair on the same key
    // would needlessly rebuild the FBOs.
    this.slotEntries = [];

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Everything saved with the Snapshot button, as live tiles. Click one to make it the '
      + 'working preset again.';
    el.appendChild(desc);

    // Header row: title + Clear button
    const header = document.createElement('div');
    header.className = 'sl-section';
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.style.flex = '1';
    title.style.marginBottom = '0';
    title.textContent = 'Snapshots (click to restore)';
    title.title = 'The ten most recent snapshots, newest last — the eleventh evicts the oldest. They live for '
      + 'this session only, so Export anything you want to keep.';
    headerRow.appendChild(title);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'sl-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.title = TAB_TIPS['history.clear']!;
    clearBtn.addEventListener('click', () => {
      this.state?.clearHistory();
    });
    headerRow.appendChild(clearBtn);
    header.appendChild(headerRow);
    el.appendChild(header);

    // Grid of up to 10 tiles (2 columns × 5 rows)
    const grid = document.createElement('div');
    grid.className = 'sl-history-grid';
    el.appendChild(grid);

    // Pre-create 10 tile slots (hidden when empty)
    for (let i = 0; i < 10; i++) {
      const tile = document.createElement('div');
      tile.className = 'sl-history-tile';
      tile.title = TAB_TIPS['history.tile']!;
      tile.style.display = 'none';

      const canvas = document.createElement('canvas');
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      tile.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'sl-history-tile-label';
      tile.appendChild(label);

      this.tileCanvases.push(canvas);
      this.tileElements.push(tile);

      const idx = i;
      tile.addEventListener('click', () => this.selectEntry(idx));
      grid.appendChild(tile);
    }

    const empty = document.createElement('div');
    empty.className = 'sl-history-empty';
    empty.textContent = 'No snapshots yet. Use the Snapshot button to save the current preset.';
    el.appendChild(empty);

    this.syncTiles();
  }

  private syncTiles(): void {
    if (!this.state || !this.container) return;
    const entries = this.state.history;

    // Release slots past the end of the list.
    for (let i = entries.length; i < this.slotEntries.length; i++) {
      if (this.slotEntries[i]) this.tileRenderer.releaseSlot(slotKey(i));
      this.slotEntries[i] = null;
      const tile = this.tileElements[i];
      if (tile) tile.style.display = 'none';
    }
    if (this.slotEntries.length > entries.length) this.slotEntries.length = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const canvas = this.tileCanvases[i];
      const tile = this.tileElements[i];
      if (!canvas || !tile) continue;

      tile.style.display = '';
      const labelEl = tile.querySelector('.sl-history-tile-label') as HTMLElement | null;
      if (labelEl) {
        labelEl.textContent = entry.label;
        // ⚠️ A VALUE, not copy, so it is assigned live rather than coming from `tooltips.ts` — the same
        // rule the palette NAME readout follows. Since 2026-10-11 the label carries the preset's name as
        // well as the time, and the caption is one ellipsised line (`text-overflow: ellipsis` in
        // `panel.css`), so a long name is unreadable without this. ⚠️ **On the LABEL, not the tile:**
        // `tile.title` is the tab's own tooltip and overwriting it would trade a precondition for a name.
        labelEl.title = entry.label;
      }

      // Re-acquire whenever this slot's CONTENT changed, which a count comparison cannot detect after a
      // FIFO eviction shifts every entry down one index. Releasing first is required: `acquireSlot` on a
      // live key would otherwise leave the previous preset's renderer state attached.
      if (this.slotEntries[i] !== entry) {
        if (this.slotEntries[i]) this.tileRenderer.releaseSlot(slotKey(i));
        this.tileRenderer.acquireSlot(slotKey(i), deepCopy(entry.preset), canvas);
        this.slotEntries[i] = entry;
      }
      // Unchanged slots keep animating — a snapshot's preset never changes after it is taken.
    }

    // Show/hide empty state
    const emptyEl = this.container.querySelector('.sl-history-empty') as HTMLElement | null;
    if (emptyEl) emptyEl.style.display = entries.length === 0 ? '' : 'none';

    // Update active highlight
    this.updateActiveHighlight();
  }

  private selectEntry(index: number): void {
    if (!this.state) return;
    const entry = this.state.history[index];
    if (!entry) return;
    this.activeEntry = entry;
    this.state.restoreFromHistory(index);
    this.updateActiveHighlight();
  }

  private updateActiveHighlight(): void {
    // Resolved from the entry object each time, so the highlight follows its snapshot across a FIFO
    // eviction instead of staying on a fixed index that now holds something else. An evicted entry is no
    // longer in the list, so `indexOf` returns −1 and nothing is highlighted, which is correct.
    const active = this.activeEntry ? (this.state?.history.indexOf(this.activeEntry) ?? -1) : -1;
    for (let i = 0; i < this.tileElements.length; i++) {
      this.tileElements[i]?.classList.toggle('active', i === active);
    }
  }

  activate(): void {
    this.tileRenderer.setActive(true);
    this.syncTiles();
  }

  deactivate(): void {
    this.tileRenderer.setActive(false);
  }

  reset(): void {
    // History is not modified by Reset — only cleared by the Clear button
  }

  dispose(): void {
    if (this.historyListener && this.state) {
      this.state.off('history-changed', this.historyListener);
    }
    for (let i = 0; i < this.slotEntries.length; i++) {
      if (this.slotEntries[i]) this.tileRenderer.releaseSlot(slotKey(i));
    }
    this.slotEntries = [];
    this.activeEntry = null;
    this.container = null;
    this.state = null;
    this.tileCanvases = [];
    this.tileElements = [];
  }
}
