/**
 * @file v8 2026-11-13 (owner) — **a preset PICKER with a search field, the grid's filter and live preview tiles**,
 * opened in place of a plain dropdown (first user: the Mixer's two decks).
 *
 * ⚠️ **It CHOOSES and nothing else.** Picking hands the name to the caller's `onPick`, which in the Mixer writes the
 * deck's own `<select>` and fires its `change` — so every existing path (the deck handler, the checks that set the
 * select, keyboard use of the select, the settings search's `<option>` index) stays exactly as it was. The picker
 * is a second way INTO the same control, never a second owner of the deck.
 *
 * ⚠️ **ITS OWN `GridTileRenderer`, active only while it is open.** The Reel tab's renderer keeps up to 96 slots
 * acquired while that tab is hidden, against a pool of 128 (`MAX_SLOTS`); sharing it would let the picker evict
 * the Reel's slots, and an evicted tile freezes silently for the life of the tab. A separate instance costs no
 * frame budget while closed (`setActive(false)` stops its `tick`), and the Lab shows one tab at a time, so the two
 * are never both animating.
 *
 * ⚠️ **ORDER = THE GRID'S CURRENT SORT** (`getNames` is the preview grid's own array, reordered in place by its Sort
 * dropdown), **FILTER = THE SHARED MODEL**: a chip ticked here moves the preview grid and the Reel picker too, as
 * the Reel tab's does (`22.D3`). The name search is the picker's own and is NOT a chip of the shared model.
 *
 * ⚠️ **Slots: acquire only what is in view, release everything on close** (the Reel's `reconcileSlots` rule —
 * releases before acquires, iteration in display order, a live ceiling below the pool).
 */
import type { UnifiedPreset } from '../../presets/types.ts';
import type { GridTileRenderer } from '../preview-grid/grid-tile-renderer.ts';
import type { PresetFilterModel } from '../preview-grid/filter-model.ts';
import { FilterDrawer } from '../preview-grid/filter-drawer.ts';
import { TAB_TIPS } from './tooltips.ts';

/** Tile bitmap size — MUST equal `GridTileRenderer`'s 256×192 (`putImageData` crops, never scales; see `reel.ts`). */
const TILE_W = 256;
const TILE_H = 192;
/** Live slots at once, below the renderer's 128-slot pool so it never evicts. */
const MAX_LIVE_TILES = 64;

export interface PresetPickerConfig {
  tileRenderer: GridTileRenderer;
  /** The names in the order to show them — the preview grid's current sort. */
  getNames: () => string[];
  getPreset: (name: string) => UnifiedPreset | undefined;
  /** The shared facet filter, or null for a host without one (then the picker searches by name only). */
  filter: PresetFilterModel | null;
  /** A slot-key namespace, so two pickers on one renderer can never collide. */
  keyPrefix: string;
}

export class PresetPicker {
  private readonly cfg: PresetPickerConfig;
  private root: HTMLElement | null = null;
  private drawer: FilterDrawer | null = null;
  private query = '';
  private tiles = new Map<string, { tile: HTMLElement; canvas: HTMLCanvasElement }>();
  private visible = new Set<string>();
  private acquired = new Set<string>();
  private observer: IntersectionObserver | null = null;
  private unsubFilter: (() => void) | null = null;
  private onPick: ((name: string) => void) | null = null;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
  };
  private host: HTMLElement | null = null;
  private readonly onResize = (): void => this.place();

  constructor(cfg: PresetPickerConfig) {
    this.cfg = cfg;
  }

  isOpen(): boolean { return this.root !== null; }

  /**
   * Open over `host` (the tab body), with `current` marked and scrolled into view. `onPick` receives the chosen
   * name; closing without a pick calls nothing.
   */
  open(host: HTMLElement, title: string, current: string, onPick: (name: string) => void): void {
    this.close();
    this.onPick = onPick;
    const root = document.createElement('div');
    root.className = 'sl-picker';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', title);

    const head = document.createElement('div');
    head.className = 'sl-picker-head';
    const ttl = document.createElement('div');
    ttl.className = 'sl-picker-title';
    ttl.textContent = title;
    head.appendChild(ttl);

    // The preview grid's OWN search-field markup and classes (`.pg-search-wrap` / `.pg-search` / `.pg-search-clear`,
    // `preview-grid/panel.css`), so the two fields look alike and cannot drift apart (owner 2026-11-13).
    const searchWrap = document.createElement('div');
    searchWrap.className = 'pg-search-wrap sl-picker-search';
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'pg-search';
    search.placeholder = 'Search presets...';
    search.title = TAB_TIPS['picker.search']!;
    search.setAttribute('aria-label', 'Search presets');
    const clear = document.createElement('span');
    clear.className = 'pg-search-clear';
    clear.textContent = '×';
    clear.title = TAB_TIPS['picker.searchClear']!;
    clear.style.display = 'none';
    const setQuery = (v: string): void => {
      search.value = v;
      this.query = v.trim().toLowerCase();
      clear.style.display = v.length > 0 ? '' : 'none';
      this.applyFilter();
    };
    search.addEventListener('input', () => setQuery(search.value));
    clear.addEventListener('mousedown', (e) => { e.preventDefault(); setQuery(''); search.focus(); });
    searchWrap.appendChild(search);
    searchWrap.appendChild(clear);
    head.appendChild(searchWrap);

    const model = this.cfg.filter;
    if (model) {
      this.drawer = new FilterDrawer({
        state: model.state,
        index: model.index,
        getVisibleNames: () => this.visibleNames(),
        getAllNames: () => this.cfg.getNames(),
        buttonClass: 'sl-btn',
        getSearchChip: () => (this.query.length === 0 ? null : {
          text: this.query,
          onRemove: () => setQuery(''),
        }),
      });
      head.appendChild(this.drawer.button);
      this.unsubFilter = model.state.onChange(() => this.applyFilter());
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sl-btn sl-picker-close';
    closeBtn.textContent = 'Close';
    closeBtn.title = TAB_TIPS['picker.close']!;
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);
    root.appendChild(head);

    if (this.drawer) {
      root.appendChild(this.drawer.summary);
      root.appendChild(this.drawer.drawer);
    }

    const scroll = document.createElement('div');
    scroll.className = 'sl-reel-browse-scroll sl-picker-scroll';
    const grid = document.createElement('div');
    grid.className = 'sl-reel-browse';
    scroll.appendChild(grid);
    if (this.drawer) scroll.appendChild(this.drawer.empty);
    root.appendChild(scroll);

    for (const name of this.cfg.getNames()) {
      const tile = document.createElement('div');
      tile.className = 'sl-reel-tile' + (name === current ? ' selected' : '');
      tile.dataset.preset = name;
      tile.title = TAB_TIPS['picker.tile']!;
      const canvas = document.createElement('canvas');
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      canvas.className = 'sl-reel-tile-canvas';
      tile.appendChild(canvas);
      const label = document.createElement('div');
      label.className = 'sl-reel-tile-label';
      label.textContent = name;
      tile.appendChild(label);
      tile.addEventListener('click', () => {
        const cb = this.onPick;
        this.close();
        cb?.(name);
      });
      grid.appendChild(tile);
      this.tiles.set(name, { tile, canvas });
    }

    host.appendChild(root);
    this.root = root;
    this.host = host;
    this.place();
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.onResize);
    this.cfg.tileRenderer.setActive(true);

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.preset;
        if (name === undefined) continue;
        if (entry.isIntersecting) this.visible.add(name); else this.visible.delete(name);
      }
      this.reconcile();
    }, { root: scroll, rootMargin: '80px', threshold: 0 });
    for (const { tile } of this.tiles.values()) this.observer.observe(tile);

    this.applyFilter();
    this.tiles.get(current)?.tile.scrollIntoView({ block: 'center' });
    search.focus();
  }

  /** Close without picking: release every slot, stop the renderer, drop the DOM. */
  close(): void {
    if (!this.root) return;
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.onResize);
    this.host = null;
    this.observer?.disconnect();
    this.observer = null;
    for (const name of this.acquired) this.cfg.tileRenderer.releaseSlot(this.key(name));
    this.acquired.clear();
    this.visible.clear();
    this.tiles.clear();
    this.cfg.tileRenderer.setActive(false);
    this.unsubFilter?.();
    this.unsubFilter = null;
    this.drawer = null;
    this.root.remove();
    this.root = null;
    this.query = '';
    this.onPick = null;
  }

  dispose(): void { this.close(); }

  /**
   * Fit the panel to the host's visible width, from its visible top to the viewport's bottom — the tab body may be
   * taller than the screen and scrolled, so `inset: 0` on it would put the picker partly off-screen.
   */
  private place(): void {
    if (!this.root || !this.host) return;
    const r = this.host.getBoundingClientRect();
    const top = Math.max(r.top, 0) + 4;
    // To the viewport's bottom, not the host's: a short tab body would otherwise cramp the tile grid.
    const bottom = window.innerHeight - 4;
    const st = this.root.style;
    st.left = `${r.left + 4}px`;
    st.width = `${Math.max(r.width - 8, 200)}px`;
    st.top = `${top}px`;
    st.height = `${Math.max(bottom - top, 240)}px`;
  }

  private key(name: string): string { return `${this.cfg.keyPrefix}${name}`; }

  private matches(name: string): boolean {
    if (this.query.length > 0 && !name.toLowerCase().includes(this.query)) return false;
    const model = this.cfg.filter;
    if (!model || !model.state.isActive()) return true;
    return model.index.matches(name, model.state.query());
  }

  private visibleNames(): string[] { return this.cfg.getNames().filter((n) => this.matches(n)); }

  /** Toggles `display` only (a rebuild would restart every visible tile); the observer then releases the hidden. */
  private applyFilter(): void {
    for (const [name, { tile }] of this.tiles) tile.style.display = this.matches(name) ? '' : 'none';
    this.drawer?.refresh();
  }

  /** Releases first, then acquires in DISPLAY order up to the ceiling (the Reel's rule). */
  private reconcile(): void {
    for (const name of [...this.acquired]) {
      if (this.visible.has(name)) continue;
      this.cfg.tileRenderer.releaseSlot(this.key(name));
      this.acquired.delete(name);
    }
    let live = this.acquired.size;
    for (const name of this.tiles.keys()) {
      if (live >= MAX_LIVE_TILES) break;
      if (!this.visible.has(name) || this.acquired.has(name)) continue;
      const entry = this.tiles.get(name);
      const preset = this.cfg.getPreset(name);
      if (!entry || !preset) continue;
      this.cfg.tileRenderer.acquireSlot(this.key(name), preset, entry.canvas);
      this.acquired.add(name);
      live++;
    }
  }
}
