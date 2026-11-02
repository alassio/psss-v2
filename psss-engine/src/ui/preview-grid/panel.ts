import './panel.css';
import type { UnifiedPreset } from '../../presets/types.ts';
import type { PresetSortMode } from '../../presets/manager.ts';
import { GridTileRenderer } from './grid-tile-renderer.ts';
import { exportAllPresetsJSON, importPresetWithDialog, nextVersionedName } from '../synthesis-lab/export.ts';
import { CHROME_TIPS } from '../synthesis-lab/tooltips.ts';
import type { FacetIndex, FilterState, PresetFilterModel } from './filter-model.ts';
import { FilterDrawer } from './filter-drawer.ts';

/** The sort dropdown's entries. One place, so the label and the mode cannot drift apart. */
const SORT_OPTIONS: readonly { mode: PresetSortMode; label: string; title: string }[] = [
  { mode: 'order-asc', label: 'Order ▲', title: 'Library order — built-in presets first, imports in arrival order' },
  { mode: 'order-desc', label: 'Order ▼', title: 'Library order, reversed — most recently imported first' },
  { mode: 'name-asc', label: 'Name ▲', title: 'Alphabetical by name, A to Z' },
  { mode: 'name-desc', label: 'Name ▼', title: 'Alphabetical by name, Z to A' },
];

export interface PreviewGridConfig {
  presetNames: string[];
  /**
   * Start the main reel. Optional: when it is absent the header shows no Play button, which is what
   * keeps this panel usable by a host that has no reel runner.
   *
   * ⚠️ **This must be wired to the SAME `ReelControls.play` the Reel tab uses**, never to a second
   * start path — `reelStart` resolves missing preset names, resets the performance guard and owns the
   * presentation, so a caller reaching past it would diverge from the tab's Play on all three.
   */
  playMainReel?: () => void;
  /**
   * The CURRENT name list, read at call time. Distinct from `presetNames` — which is this panel's own
   * array, mutated in place by `prependPreset` — because the import dialog must validate against
   * `PresetManager`, the authoritative owner. See `importPresetWithDialog`.
   */
  getPresetNames: () => string[];
  getPreset: (name: string) => UnifiedPreset | undefined;
  gl: WebGL2RenderingContext;
  onSelect: (presetName: string) => void;
  onLabClick: () => void;
  onImportPreset?: (name: string, preset: UnifiedPreset) => void;
  /**
   * Batch form of `onImportPreset`, used when the imported file is a multi-preset BUNDLE.
   *
   * ⚠️ Required rather than an optimisation: `onImportPreset` re-inits the generators, renderer and
   * TransMap, prepends a tile and navigates, all per call. Running that 177 times in a synchronous loop
   * locks the frame loop and thrashes `GridTileRenderer`'s slots. See `importPresetWithDialog`.
   */
  onImportBundle?: (entries: { name: string; preset: UnifiedPreset }[]) => void;
  /**
   * Commit a rename. The panel does NOT rename anything itself — a preset name is the primary key of
   * `PresetManager.library`, this panel's `tileElements`/`tileCanvases` and `GridTileRenderer.activeSlots`,
   * and only `main.ts` can see all of them. It returns the name actually applied, which may differ from the
   * one requested: the inline editor auto-applies a ` v<n>` suffix on a clash rather than opening a dialog
   * mid-double-click, so the panel has to be told what it ended up called.
   */
  onRenamePreset?: (from: string, to: string) => string | null;
  /**
   * Names in a given sort order, from `PresetManager` — the authoritative owner. Sorting is a VIEW: this
   * returns a fresh array and never reorders the library.
   */
  getSortedPresetNames?: (sort: PresetSortMode) => string[];
  presetsFilename?: string;
  /**
   * The facet filter's state and cache (v8 Phase 22). ⚠️ **Handed IN, never built here**, because the Reel tab's
   * picker shares the same two objects (`22.D3`) and is constructed before this panel exists.
   */
  presetFilter: PresetFilterModel;
}

export class PreviewGridPanel {
  private config: PreviewGridConfig;
  private container: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private clearBtn: HTMLElement | null = null;
  private suggestionsDiv: HTMLElement | null = null;
  private tileElements: Map<string, HTMLElement> = new Map();
  private tileCanvases: Map<string, HTMLCanvasElement> = new Map();
  private gridRenderer: GridTileRenderer | null = null;
  private gridEl: HTMLElement | null = null;
  /** Current sort. `order-asc` is insertion order, i.e. byte-for-byte the pre-2026-08-25 grid. */
  private sortMode: PresetSortMode = 'order-asc';
  /**
   * The preset being renamed, or `null` outside rename mode — i.e. the mode itself, not a hint about it.
   *
   * ⚠️ Read by `onSearchInput`, the search box's `blur`/`keydown` and the tile click handler, all of which
   * would otherwise fight the rename for ownership of the shared search field. It holds the ORIGINAL name, so
   * a commit knows what to rename FROM after the user has typed over it.
   */
  private renamingName: string | null = null;
  private renameBtn: HTMLButtonElement | null = null;
  private observer: IntersectionObserver | null = null;
  private activeName = '';
  private savedScrollTop = 0;
  private visible = false;
  private isSearching = false;

  // ---- v8 Phase 22: the facet filter -------------------------------------------------------------------
  //
  // ⚠️ **Search and filter are TWO sources over one `tile.style.display`, so they need ONE resolver**
  // (invariant 17). `applyVisibility()` is it, and `filterGrid()` — which used to be called from four places —
  // is now called from there alone. A second writer would let a search cancel un-hide a filtered-out tile.
  //
  // ⚠️ **Both objects are the CONFIG's, shared with the Reel tab's picker** (`22.D3`, `22.7`). They are read
  // through these getters rather than copied into fields so that there is visibly no second instance here.
  private filterDrawer: FilterDrawer | null = null;
  /** The current text search's matches, or `null` when no search is narrowing the grid. */
  private searchMatches: string[] | null = null;
  /** ⚠️ The empty SEARCH state, deliberately NOT the empty FILTER state (`22.5`) — different copy, different act. */
  private emptySearchEl: HTMLElement | null = null;
  private emptySearchTextEl: HTMLElement | null = null;
  /** ⚠️ The unsubscribe from `filterState.onChange` — a LIST, not a slot (invariant 15); called in `dispose()`. */
  private unsubFilter: (() => void) | null = null;
  /**
   * The tiles the `IntersectionObserver` last reported as on screen, by preset name (2026-09-25).
   *
   * ⚠️ **The observer is the ONE owner of "is this tile visible", and this set exists so that rule can be
   * re-READ without being re-implemented.** `reconcileSlots()` needs to know what should hold a slot; deriving
   * it from geometry would be a second copy of `rootMargin: '100px'` and of the `display: none` rule that
   * filtering uses, and two answers to one question is the defect. Maintained only in the observer callback
   * and in the paths that destroy a tile.
   */
  private intersecting: Set<string> = new Set();

  private get filterState(): FilterState { return this.config.presetFilter.state; }
  private get facetIndex(): FacetIndex { return this.config.presetFilter.index; }

  constructor(config: PreviewGridConfig) {
    this.config = config;
  }

  init(parent: HTMLElement): void {
    this.gridRenderer = new GridTileRenderer(this.config.gl);
    this.gridRenderer.init();
    this.buildDOM(parent);
    this.setupObserver();
    this.visible = true;
  }

  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      if (this.gridContainer) {
        this.gridContainer.scrollTop = this.savedScrollTop;
      }
    }
    this.visible = true;
    this.gridRenderer?.setActive(true);
    // The observer will re-report everything it released on `hide()` — but on its own schedule, and only for
    // tiles whose intersection actually CHANGED. Repairing here costs one Map lookup per on-screen tile and
    // makes the grid come back in the same frame it is shown.
    this.reconcileSlots();
  }

  /**
   * Re-acquire a slot for every tile the observer believes is on screen but the renderer no longer holds — the
   * belt under F1's eviction fix (2026-09-25).
   *
   * ⚠️ **This exists because an `IntersectionObserver` reports CHANGES, and a tile that lost its slot while
   * staying put has no change left to fire.** It is therefore frozen on its last painted frame — or black, if
   * it never painted one — for the life of the tab. Eviction below `MAX_SLOTS` can no longer happen, so the
   * routes left are the hard 128 ceiling and any future path that releases without re-acquiring; this repairs
   * all of them without any of them having to know it exists.
   *
   * ⚠️ **`ReelTab` has a private method of the SAME NAME and it is a different subject** — that one reconciles
   * which reel TILES are live against `MAX_LIVE_TILES`, and the documented "one `reconcileSlots()` owner" rule
   * is about that set. This one is about `GridTileRenderer`'s slots for the preset grid. Neither calls the
   * other; they are two instances of the same shape, not two owners of one set.
   *
   * ⚠️ **Idempotent, and cheap when there is nothing to do**: `hasSlot()` is a `Map.has`, and `acquireSlot` is
   * itself name-keyed and returns early. Call it freely after a layout change — a window resize, a panel-mode
   * switch, the drawer opening — never in `tick()`, where a per-frame scan of the visible set would be a cost
   * with no event to justify it.
   */
  reconcileSlots(): void {
    if (!this.gridRenderer || !this.visible) return;
    for (const name of this.intersecting) {
      if (this.gridRenderer.hasSlot(name)) continue;
      const canvas = this.tileCanvases.get(name);
      const preset = this.config.getPreset(name);
      if (canvas && preset) this.gridRenderer.acquireSlot(name, preset, canvas);
    }
  }

  hide(): void {
    if (this.gridContainer) {
      this.savedScrollTop = this.gridContainer.scrollTop;
    }
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.visible = false;
    this.gridRenderer?.setActive(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  setActivePreset(name: string): void {
    // Cancel any active search so the full grid is visible
    if (this.isSearching) {
      this.cancelSearch();
    }

    if (this.activeName) {
      const prev = this.tileElements.get(this.activeName);
      if (prev) prev.classList.remove('active-tile');
    }
    this.activeName = name;

    // ⚠️ Not during rename mode: this is the third writer of the shared field, and it runs on the commit path
    // itself (`renameTile` → `main.ts` → `setActivePreset`), so writing here would overwrite the name the user
    // is typing. `endRenameMode` restores the field from `activeName` when the mode ends.
    if (this.searchInput && this.renamingName === null) {
      this.searchInput.value = name;
    }

    const tile = this.tileElements.get(name);
    if (tile) {
      tile.classList.add('active-tile');
      if (this.visible && this.gridContainer) {
        const containerRect = this.gridContainer.getBoundingClientRect();
        const tileRect = tile.getBoundingClientRect();
        if (tileRect.top < containerRect.top || tileRect.bottom > containerRect.bottom) {
          tile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }

  scrollToActive(): void {
    const tile = this.activeName ? this.tileElements.get(this.activeName) : undefined;
    if (tile && this.gridContainer) {
      tile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  prependPreset(name: string): void {
    if (!this.gridEl) return;

    // ⚠️ **A name already on the grid REPLACES its tile; it never gets a second one** (2026-08-20).
    //
    // The import dialog refuses duplicates, so reaching this branch means some other path produced one —
    // and every map downstream is keyed by name (`tileElements`, `tileCanvases`, `GridTileRenderer`'s
    // `activeSlots`, `PresetManager.library`), so a second tile under a live name is not a cosmetic
    // repeat. That is the reported bug's actual mechanism: `acquireSlot` returns early on
    // `activeSlots.has(name)`, so the newcomer got no slot, and the two canvases split one identity —
    // one animating, one frozen on whatever it had last painted.
    //
    // Replacing is the honest recovery. `releaseSlot` first, because the old tile owns a slot that must be
    // freed before the new tile asks for one, and its `Map` entries are about to be overwritten — dropping
    // them without releasing would leak the generator, the TransMap and up to three textures with no
    // remaining handle to reach them (invariant 1's shape: a dropped reference is not a disposal).
    const existingTile = this.tileElements.get(name);
    if (existingTile) {
      this.observer?.unobserve(existingTile);
      this.gridRenderer?.releaseSlot(name);
      existingTile.remove();
      this.tileElements.delete(name);
      this.tileCanvases.delete(name);
      // The element is gone, so nothing will ever report it as leaving. A stale entry here would have
      // `reconcileSlots()` re-acquire the name against the canvas of a tile that is no longer in the document.
      this.intersecting.delete(name);
      // `presetNames` already contains it; re-`unshift`ing would list one name twice.
      const dup = this.config.presetNames.indexOf(name);
      if (dup >= 0) this.config.presetNames.splice(dup, 1);
      console.warn(`Preview grid: "${name}" was already present — its tile has been replaced.`);
    }

    // Add to name list at the front
    this.config.presetNames.unshift(name);

    const { tile, canvas } = this.buildTile(name);

    // Scroll to top BEFORE prepending. When the grid is visible and scrolled
    // down, the new tile at position 0 would be outside the viewport. The
    // IntersectionObserver fires isIntersecting:false for it (releasing the
    // just-acquired slot) and every renderer slot may already be occupied
    // by visible tiles. Scrolling to top first frees slots (tiles scroll out
    // → observer fires false → releaseSlot) and ensures the new tile is
    // visible when observed. Works correctly whether grid is hidden or shown.
    if (this.gridContainer) this.gridContainer.scrollTop = 0;
    if (this.gridContainer) this.savedScrollTop = 0;

    this.gridEl.prepend(tile);
    this.tileElements.set(name, tile);
    this.tileCanvases.set(name, canvas);

    // Observe for future scroll-out/scroll-in lifecycle management
    this.observer?.observe(tile);

    // Directly acquire a slot. Since we scrolled to top the tile is in the
    // viewport, so the observer will also fire true — acquireSlot is idempotent.
    const preset = this.config.getPreset(name);
    if (preset && this.gridRenderer) {
      this.gridRenderer.acquireSlot(name, preset, canvas);
    }

    // ⚠️ **A new BODY arrived, so the cache and the visibility are both stale.** The new tile is built with
    // `display: ''`, so without this it would sit visible inside a filtered grid — the one tile on screen that
    // the active filter says should not be there. ⚠️ **`add`, not `rebuild`**: a bundle import calls this once
    // per entry, and that path exists precisely to keep per-entry work down to one DOM node.
    this.facetIndex.add(name);
    this.applyVisibility();
  }

  /**
   * Build one tile. Shared by the initial grid build and `prependPreset`, which had the same 12 lines twice.
   *
   * ⚠️ **The listeners close over a `name` that a rename CHANGES.** They therefore read `tile.dataset.preset`
   * rather than the captured parameter: `renameTile` rewrites that attribute, so the handlers follow the
   * rename instead of selecting a name the library no longer has.
   *
   * ⚠️ **There is deliberately NO `dblclick` handler here.** Renaming from a tile was tried and removed on
   * 2026-08-25: the user reported it simply did not work, and the mechanism is inherently fragile — the
   * handler could only be bound to the label SPAN (the canvas fills most of the tile, so most of the target
   * a user aims at was never a rename target at all), a `dblclick` on a tile also fires two `click`s that
   * navigate and re-apply the preset, and the affordance was invisible apart from a `title` tooltip.
   * Renaming is now an explicit Rename/Save mode on the header, which has one hit target and one state.
   */
  private buildTile(name: string): { tile: HTMLElement; canvas: HTMLCanvasElement } {
    const tile = document.createElement('div');
    tile.className = 'pg-tile';
    tile.dataset.preset = name;
    // Same source as `dataset.preset`, so a rename keeps them in step (`renameTile` rewrites both). A tile
    // is a live 256×192 render at reduced fidelity — C7, a won't-fix — hence the note about the main view.
    tile.title = `${name} — click to load this preset into the main view at full size and fidelity.`;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    canvas.className = 'pg-tile-canvas';
    tile.appendChild(canvas);

    const label = document.createElement('span');
    label.className = 'pg-tile-label';
    label.textContent = name;
    tile.appendChild(label);

    tile.addEventListener('click', () => {
      // Selecting a different preset mid-rename would leave the header editing a name the grid is no longer
      // showing, so a click during rename mode cancels it rather than being ignored (which read as a dead UI).
      if (this.renamingName !== null) this.endRenameMode(false);
      const current = tile.dataset.preset;
      if (current) this.config.onSelect(current);
    });

    return { tile, canvas };
  }

  /**
   * Enter or leave rename mode. The header's one button drives both, so the two states cannot disagree.
   *
   * ⚠️ **The search box IS the rename field**, by design: it already displays the active preset's name, so
   * there is no second input to keep in sync. That makes its normal handlers hostile for the duration —
   * `onSearchInput` would filter the grid on every keystroke and its `blur` would `cancelSearch`, which
   * rewrites the value back to `activeName` and would erase what the user typed the instant they reached for
   * Save. Both are gated on `renamingName === null`; the flag is the mode, and nothing else may own it.
   */
  private beginRenameMode(): void {
    if (!this.config.onRenamePreset || !this.searchInput || this.renamingName !== null) return;
    const target = this.activeName;
    if (!target || !this.tileElements.has(target)) return;

    // Any open search UI belongs to the mode being left, not the one being entered.
    this.closeSuggestions();
    this.searchMatches = null;
    // ⚠️ **The facet filter is SUSPENDED, not cleared** (`22.4`). The whole grid has to be visible for the
    // duration — a rename of a preset the filter is hiding would otherwise edit a name with no tile on screen —
    // but the filter must come back on both exits, and `restore()` is the one owner of taking it back. Clearing
    // it here instead would lose every exclusion silently, since a chip has no third DOM state to read back.
    this.filterState.suspend();
    this.applyVisibility();
    this.isSearching = false;

    this.renamingName = target;
    this.searchInput.value = target;
    this.searchInput.classList.add('pg-search-renaming');
    this.searchInput.placeholder = 'New preset name...';
    this.updateRenameButton();
    this.searchInput.focus();
    this.searchInput.select();
  }

  /**
   * Leave rename mode, committing the typed name when `commit` is set.
   *
   * ⚠️ **A conflict is resolved to the next free ` v<n>` and left in the field for a SECOND explicit Save**,
   * per the agreed design — the correction is never applied behind the user's back. `renamingName` is cleared
   * only when the rename actually completes, so the mode survives the bounce and the button still says Save.
   */
  private endRenameMode(commit: boolean): void {
    const original = this.renamingName;
    if (original === null || !this.searchInput) return;

    const typed = this.searchInput.value.trim();

    if (commit && typed && typed !== original) {
      // The library's names, minus this preset's own — renaming `X` while `X v2` exists must not skip `X v2`.
      // Same rule and the same function as the import path; a second implementation would drift from it.
      const taken = new Set(
        this.config.getPresetNames().map((n) => n.toLowerCase()).filter((n) => n !== original.toLowerCase()),
      );
      if (taken.has(typed.toLowerCase())) {
        // Offer the versioned name and stay in rename mode. Returning here is what makes the next Save a
        // deliberate second press rather than an auto-apply.
        this.searchInput.value = nextVersionedName(typed, taken);
        this.searchInput.classList.add('pg-search-renaming-conflict');
        setTimeout(() => this.searchInput?.classList.remove('pg-search-renaming-conflict'), 900);
        this.searchInput.select();
        return;
      }
      this.config.onRenamePreset?.(original, typed);
    }

    this.renamingName = null;
    // ⚠️ **BOTH exits restore the filter** — this line is reached by Save, by Escape, by the tile click that
    // cancels the mode and by the `blur` path, which is the trap `22.4` names: `blur` fires 150 ms later and is
    // the one exit with no button press behind it. `restore()` is idempotent, so the double-fire is harmless;
    // an exit that skipped it would leave the owner with a `Filter ▾ 3` button over an unfiltered grid.
    this.filterState.restore();
    this.searchInput.classList.remove('pg-search-renaming');
    this.searchInput.placeholder = 'Search presets...';
    // From `activeName`, not from `original`: a successful rename above has already updated it via
    // `renameTile`, and the field must end up showing whatever the preset is now actually called.
    this.searchInput.value = this.activeName;
    this.updateRenameButton();
    this.searchInput.blur();
  }

  /** The button's label, title and pressed state — one writer, so the caption cannot drift from the mode. */
  private updateRenameButton(): void {
    if (!this.renameBtn) return;
    const renaming = this.renamingName !== null;
    this.renameBtn.textContent = renaming ? 'Save' : 'Rename';
    this.renameBtn.title = renaming ? CHROME_TIPS.renameGridSave : CHROME_TIPS.renameGrid;
    this.renameBtn.classList.toggle('pg-mode-btn-active', renaming);
  }

  /**
   * Re-key a tile after `main.ts` has renamed the preset in `PresetManager`.
   *
   * ⚠️ **`releaseSlot` BEFORE the map entries are re-keyed, and re-acquire under the new name** — the slot is
   * keyed by name, so leaving it under the old key strands a generator, a TransMap and up to three textures
   * with no handle able to reach them (invariant 1: a dropped reference is not a disposal). Re-acquiring is
   * what makes the tile continue animating under its new identity; `acquireSlot` returns early if the name is
   * already active, so ordering it after the release is not optional.
   */
  renameTile(from: string, to: string): void {
    const tile = this.tileElements.get(from);
    const canvas = this.tileCanvases.get(from);
    if (!tile || !canvas) return;

    this.gridRenderer?.releaseSlot(from);

    this.tileElements.delete(from);
    this.tileCanvases.delete(from);
    this.tileElements.set(to, tile);
    this.tileCanvases.set(to, canvas);
    // Re-key the visibility set with the same rule as every other name-keyed map here: the ELEMENT did not
    // move, so if the old name was on screen the new one is. Left stale, `reconcileSlots()` would keep trying
    // to re-acquire a name the library no longer has (harmless — `getPreset` returns nothing — but it would
    // also fail to repair the tile that IS there).
    if (this.intersecting.delete(from)) this.intersecting.add(to);

    tile.dataset.preset = to;
    tile.title = `${to} — click to load this preset into the main view at full size and fidelity.`;
    const label = tile.querySelector('.pg-tile-label');
    if (label) label.textContent = to;

    const idx = this.config.presetNames.indexOf(from);
    if (idx >= 0) this.config.presetNames[idx] = to;
    if (this.activeName === from) this.activeName = to;
    // The header's own record of what it is renaming. `endRenameMode` is mid-flight when this runs, and it
    // reads `activeName` afterwards — but the flag must not still name a preset the library no longer has.
    if (this.renamingName === from) this.renamingName = to;

    // ⚠️ **The facet cache is keyed by NAME too** (`filter-model.ts` rule 4). Left un-re-keyed, the renamed
    // tile's facet lookup misses, it matches nothing, and it vanishes from the grid the moment any chip is
    // ticked — with the preset itself perfectly intact, which is what makes it hard to read.
    this.facetIndex.renameKey(from, to);

    const preset = this.config.getPreset(to);
    if (preset && this.gridRenderer) this.gridRenderer.acquireSlot(to, preset, canvas);

    // A rename can change alphabetical position, and the grid is currently showing one order or another.
    if (this.sortMode === 'name-asc' || this.sortMode === 'name-desc') this.applySort(this.sortMode);
  }

  /**
   * Reorder the tiles that already exist. Called by the sort dropdown and after a rename under a name sort.
   *
   * ⚠️ **Tiles are MOVED, never rebuilt.** `appendChild` on an already-parented node relocates it, so every
   * tile keeps its element, its canvas and — critically — its `GridTileRenderer` slot. Rebuilding would
   * release and re-acquire up to 128 slots in one synchronous pass, thrashing the eviction path
   * (`MAX_SLOTS`, adaptive `slotCap`) and blanking every visible tile for several frames.
   *
   * ⚠️ **`presetNames` is reordered to match, not just the DOM.** It drives `onSearchInput`'s suggestion
   * order and `Export All`'s entry order, so leaving it in the old order would make the search list disagree
   * with the grid the user is looking at (invariant 17's shape: two sources, resolved inconsistently).
   */
  private applySort(mode: PresetSortMode): void {
    this.sortMode = mode;
    const sorted = this.config.getSortedPresetNames?.(mode);
    if (!sorted || !this.gridEl) return;

    // Only names this panel actually has a tile for, so a library entry with no tile cannot inject a hole.
    const present = sorted.filter((n) => this.tileElements.has(n));

    // `presetNames` is this panel's own array (the D4 split) and is mutated in place, because `prependPreset`
    // and `main.ts` hold references to this same array object.
    this.config.presetNames.length = 0;
    this.config.presetNames.push(...present);

    // ⚠️ The IntersectionObserver is deliberately NOT disconnected around this. Moving a node keeps its
    // observation; the observer re-fires for whatever changed visibility, which is exactly the intended
    // acquire/release behaviour for tiles that scrolled in or out of view as a result of the reorder.
    for (const name of present) {
      const tile = this.tileElements.get(name);
      if (tile) this.gridEl.appendChild(tile);
    }

    // The reorder moves the active tile somewhere else entirely; keep it in view.
    if (this.visible) this.scrollToActive();
  }

  getScrollPosition(): number {
    return this.gridContainer?.scrollTop ?? this.savedScrollTop;
  }

  /** `throttle` is `PerfGuard.tileThrottle()`, forwarded verbatim — see `GridTileRenderer.tick`. */
  tick(dt: number, throttle = 1): void {
    if (this.visible) {
      this.gridRenderer?.tick(dt, throttle);
    }
  }

  dispose(): void {
    // ⚠️ Invariant 15: the unsubscribe is the only thing that removes this panel's entry from the change list,
    // and the callback closes over `tileElements` — a leaked subscriber would keep the whole grid alive.
    this.unsubFilter?.();
    this.unsubFilter = null;
    this.observer?.disconnect();
    this.gridRenderer?.dispose();
    this.container?.remove();
    this.tileElements.clear();
    this.tileCanvases.clear();
    this.intersecting.clear();
  }

  private buildDOM(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'preview-grid-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'pg-header';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'pg-search-wrap';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'pg-search';
    this.searchInput.placeholder = 'Search presets...';
    this.searchInput.value = this.activeName;
    this.searchInput.title = CHROME_TIPS.search;
    // ⚠️ Every one of these four is gated on rename mode, because the field is SHARED. Ungated, `input`
    // filters the grid on each keystroke of a new name, `focus` re-selects, and `blur` → `cancelSearch`
    // rewrites the value back to `activeName` — which fires when the user reaches for Save and would erase
    // what they typed before the click landed. The mode owns the field for its duration.
    this.searchInput.addEventListener('input', () => {
      if (this.renamingName === null) this.onSearchInput();
    });
    this.searchInput.addEventListener('focus', () => {
      if (this.renamingName !== null) return;
      this.isSearching = true;
      this.searchInput!.select();
    });
    this.searchInput.addEventListener('blur', () => {
      if (this.renamingName !== null) return;
      setTimeout(() => this.cancelSearch(), 150);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (this.renamingName !== null) {
        // Stopped from reaching `main.ts`'s document-level handler, which binds arrows to preset navigation
        // and digits to film looks — both would fire while a name is being typed.
        e.stopPropagation();
        if (e.key === 'Enter') this.endRenameMode(true);
        if (e.key === 'Escape') this.endRenameMode(false);
        return;
      }
      if (e.key === 'Escape') {
        this.cancelSearch();
        this.searchInput!.blur();
      }
    });
    searchWrap.appendChild(this.searchInput);

    this.clearBtn = document.createElement('span');
    this.clearBtn.className = 'pg-search-clear';
    this.clearBtn.textContent = '×';
    this.clearBtn.title = CHROME_TIPS.searchClear!;
    this.clearBtn.style.display = 'none';
    this.clearBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // It is hidden during rename mode (only `onSearchInput` shows it, and that is gated), but clearing the
      // field out from under a rename would leave the mode editing an empty name.
      if (this.renamingName !== null) return;
      this.cancelSearch();
      this.searchInput!.blur();
    });
    searchWrap.appendChild(this.clearBtn);

    header.appendChild(searchWrap);

    // Sort control, immediately right of the search box: both are views over the same list, and neither
    // changes the library. Only built when `main.ts` supplies the sorted-name getter, so a caller that has
    // not been taught about sorting gets the old header rather than a control that cannot work
    // (invariant 13: a control that does not move what it names).
    if (this.config.getSortedPresetNames) {
      /*
       * **Play — to the LEFT of the Order control, and emphasised** (owner, 2026-10-10). The browser
       * deployment no longer autostarts its reel, so this is the front door to playback for anyone who
       * never opens the Lab.
       */
      if (this.config.playMainReel) {
        const playBtn = document.createElement('button');
        playBtn.className = 'pg-mode-btn pg-play-btn';
        playBtn.textContent = '▶ Play';
        playBtn.title = CHROME_TIPS.playMainReel;
        playBtn.addEventListener('click', () => this.config.playMainReel?.());
        header.appendChild(playBtn);
      }

      const sortWrap = document.createElement('div');
      sortWrap.className = 'pg-sort-wrap';

      const sortLabel = document.createElement('span');
      sortLabel.className = 'pg-sort-label';
      sortLabel.textContent = 'Sort:';
      sortLabel.title = CHROME_TIPS.sort;
      sortWrap.appendChild(sortLabel);

      const sortSelect = document.createElement('select');
      sortSelect.className = 'pg-sort-select';
      for (const opt of SORT_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.mode;
        o.textContent = opt.label;
        o.title = opt.title;
        sortSelect.appendChild(o);
      }
      sortSelect.value = this.sortMode;
      sortSelect.title = SORT_OPTIONS.find((o) => o.mode === this.sortMode)?.title ?? '';
      sortSelect.addEventListener('change', () => {
        this.applySort(sortSelect.value as PresetSortMode);
        sortSelect.title = SORT_OPTIONS.find((o) => o.mode === this.sortMode)?.title ?? '';
      });
      sortWrap.appendChild(sortSelect);
      header.appendChild(sortWrap);
    }

    // The facet filter (v8 Phase 22), immediately right of Sort — `22.D15`'s position, and both are views over
    // the same list that neither of them changes. ⚠️ **Sort and filter compose and this phase does not touch
    // ordering**: `applyVisibility()` reads `presetNames`, which `applySort` keeps in step with the DOM, so a
    // reorder needs no filter code at all and the filter never triggers a reorder (which MOVES tiles).
    this.filterDrawer = new FilterDrawer({
      state: this.filterState,
      index: this.facetIndex,
      getVisibleNames: () => this.visibleNames(),
      getAllNames: () => [...this.config.presetNames],
      // The active text search, as one more removable chip in the same row. Removing it clears the SEARCH
      // only — the field's own `×` and this chip are the same action, so they call the same method.
      getSearchChip: () => {
        if (this.searchMatches === null) return null;
        const text = this.searchInput?.value.trim() ?? '';
        if (!text) return null;
        return { text, onRemove: () => { this.cancelSearch(); this.searchInput?.blur(); } };
      },
    });
    header.appendChild(this.filterDrawer.button);
    // ⚠️ **ONE subscription, and its unsubscribe is kept for `dispose()`** — the change list is a list, not a
    // slot (invariant 15), because `22.7`'s Reel picker subscribes to the same state.
    this.unsubFilter = this.filterState.onChange(() => this.applyVisibility());

    // Rename / Save — one button, two states, sitting beside the field it edits. Built only when a rename
    // handler was supplied, so a caller that has not been taught about renaming gets the old header rather
    // than a button that cannot work (invariant 13: a control that does not move what it names).
    //
    // ⚠️ **`mousedown`, not `click`.** Pressing the button blurs the search field first, and a `click` fires
    // only after that blur — so with the default handler order a `click` listener still works, but the
    // ordering is doing load-bearing work invisibly. Committing on `mousedown` means the button acts before
    // any focus change can touch the field it is about to read.
    if (this.config.onRenamePreset) {
      this.renameBtn = document.createElement('button');
      this.renameBtn.className = 'pg-mode-btn';
      this.renameBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.renamingName === null) this.beginRenameMode();
        else this.endRenameMode(true);
      });
      this.updateRenameButton();
      header.appendChild(this.renameBtn);
    }

    const exportAllBtn = document.createElement('button');
    exportAllBtn.className = 'pg-mode-btn';
    exportAllBtn.textContent = 'Export All';
    exportAllBtn.title = CHROME_TIPS.exportAll;
    exportAllBtn.addEventListener('click', () => {
      exportAllPresetsJSON(
        this.config.presetNames,
        this.config.getPreset,
        this.config.presetsFilename ?? 'psss_presets',
      );
    });
    header.appendChild(exportAllBtn);

    const importBtn = document.createElement('button');
    importBtn.className = 'pg-mode-btn';
    importBtn.textContent = 'Import';
    // Accepts a bundle as well as a single preset — see `isPresetBundle`, and note that until 2026-08-25
    // an `Export All` file fed back in here silently produced one nonsense preset out of all of them.
    importBtn.title = CHROME_TIPS.import;
    importBtn.addEventListener('click', () => {
      // The list is fetched HERE, on click, not captured at build time — see `importPresetWithDialog`.
      importPresetWithDialog(
        this.config.getPresetNames,
        (name, preset) => { this.config.onImportPreset?.(name, preset); },
        this.config.onImportBundle,
      );
    });
    header.appendChild(importBtn);

    const labBtn = document.createElement('button');
    labBtn.className = 'pg-mode-btn';
    labBtn.textContent = 'Lab';
    labBtn.title = CHROME_TIPS.lab;
    labBtn.addEventListener('click', () => this.config.onLabClick());
    header.appendChild(labBtn);

    this.container.appendChild(header);

    // Suggestions dropdown
    this.suggestionsDiv = document.createElement('div');
    this.suggestionsDiv.className = 'pg-suggestions';
    this.suggestionsDiv.style.display = 'none';
    this.container.appendChild(this.suggestionsDiv);

    // The summary row and the drawer sit BETWEEN the header and the grid, in normal flow, so opening the drawer
    // pushes the tiles down instead of covering them (`22.D5`). `.pg-suggestions` is absolutely positioned and
    // z-indexed above both, so the search dropdown still overlays them.
    if (this.filterDrawer) {
      this.container.appendChild(this.filterDrawer.summary);
      this.container.appendChild(this.filterDrawer.drawer);
    }

    // Grid
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'pg-grid-scroll';

    const grid = document.createElement('div');
    grid.className = 'pg-grid';
    this.gridEl = grid;

    for (const name of this.config.presetNames) {
      const { tile, canvas } = this.buildTile(name);
      grid.appendChild(tile);
      this.tileElements.set(name, tile);
      this.tileCanvases.set(name, canvas);
    }

    this.gridContainer.appendChild(grid);

    // ⚠️ **Two empty states in the tile area, and they are NOT one state with two messages** (`22.5`). Both live
    // here rather than replacing `gridEl`, so the tiles keep their elements, their canvases and their slots —
    // removing the grid to show a message would release up to 128 slots and blank every tile for several frames.
    this.emptySearchEl = document.createElement('div');
    this.emptySearchEl.className = 'pg-filter-empty';
    this.emptySearchEl.style.display = 'none';
    const searchEmptyHead = document.createElement('div');
    searchEmptyHead.className = 'pg-filter-empty-head';
    // ⚠️ Set once as a literal, never composed with a ternary — `tipcheck`'s `INLINE_SINK` cannot see ternaries.
    searchEmptyHead.textContent = 'No preset matches that name.';
    this.emptySearchEl.appendChild(searchEmptyHead);
    this.emptySearchTextEl = document.createElement('div');
    this.emptySearchTextEl.className = 'pg-filter-empty-line';
    this.emptySearchEl.appendChild(this.emptySearchTextEl);
    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.className = 'pg-mode-btn';
    clearSearchBtn.textContent = 'Clear the search';
    clearSearchBtn.title = CHROME_TIPS.searchClear!;
    clearSearchBtn.addEventListener('click', () => { this.cancelSearch(); this.searchInput?.blur(); });
    this.emptySearchEl.appendChild(clearSearchBtn);
    this.gridContainer.appendChild(this.emptySearchEl);

    if (this.filterDrawer) this.gridContainer.appendChild(this.filterDrawer.empty);

    this.container.appendChild(this.gridContainer);
    parent.appendChild(this.container);
  }

  private setupObserver(): void {
    if (!this.gridContainer || !this.gridRenderer) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        // Releases must be drained before any acquire: a single callback can carry both directions, and
        // interleaving would starve the trailing entries of capacity that outgoing tiles in the same batch
        // are about to free.
        //
        // The ORDERING is still required; the reason recorded here was stale (E6). It used to say
        // `acquireSlot()` "gives up silently when the slot pool is empty" — it now EVICTS the
        // least-recently-acquired slot instead. So the failure mode is no longer a black tile that never
        // renders, it is a visible tile being stolen and frozen on its last painted frame. Same fix, worse
        // symptom than the comment implied.
        const incoming: HTMLElement[] = [];

        for (const entry of entries) {
          const tile = entry.target as HTMLElement;
          const name = tile.dataset.preset;
          if (!name || !this.tileCanvases.has(name)) continue;

          if (entry.isIntersecting) {
            incoming.push(tile);
            this.intersecting.add(name);
          } else {
            this.intersecting.delete(name);
            this.gridRenderer!.releaseSlot(name);
          }
        }

        for (const tile of incoming) {
          const name = tile.dataset.preset!;
          const canvas = this.tileCanvases.get(name)!;
          const preset = this.config.getPreset(name);
          if (preset) {
            this.gridRenderer!.acquireSlot(name, preset, canvas);
          }
        }
      },
      {
        root: this.gridContainer,
        rootMargin: '100px',
        threshold: 0,
      }
    );

    for (const tile of this.tileElements.values()) {
      this.observer.observe(tile);
    }
  }

  private onSearchInput(): void {
    const query = this.searchInput?.value.trim().toLowerCase() ?? '';

    if (query.length < 2) {
      this.closeSuggestions();
      this.searchMatches = null;
      this.applyVisibility();
      if (this.clearBtn) this.clearBtn.style.display = 'none';
      return;
    }

    if (this.clearBtn) this.clearBtn.style.display = 'block';

    const matches = this.config.presetNames.filter(n =>
      n.toLowerCase().includes(query)
    );

    this.searchMatches = matches;
    this.applyVisibility();

    if (matches.length === 0) {
      this.closeSuggestions();
      return;
    }

    // ⚠️ **UNCAPPED ON PURPOSE — a cap here made the dropdown DISAGREE with the grid about one query.**
    // `filterGrid(matches)` above has never been capped, so a truncated dropdown showed fewer names than the
    // tiles behind it, with nothing to say a name had been dropped. Measured 2026-09-13 (library 326): the query
    // `new` matches 94 presets and the retired `.slice(0, 20)` hid 74 of them, cutting off at
    // `Mirrors In Mirror new` — `Storm new` is match 67 and was unreachable through the field the tooltip calls
    // the way to pick a preset. ⚠️ **And the cap bought no layout protection**, which is the part that reads as
    // a reason to keep it: `.pg-suggestions` is `max-height: 200px; overflow-y: auto` and a `.pg-suggestion-item`
    // is ~31px, so ~6 fit and even 20 scrolled. The worst case over every 2-char query is 115 (`ne`), still one
    // scrolling list. **If a limit is ever wanted back it belongs in the CSS or in a "N more" line, never as a
    // silent slice of the SAME list the grid filter reads.**
    this.showSuggestions(matches);
  }

  /**
   * ⚠️ **Clears the SEARCH and nothing else.** A facet filter is not a search and survives this — which is the
   * whole point of the two being separate chips in the summary row, and the reason this does not call `clear()`.
   */
  private cancelSearch(): void {
    this.isSearching = false;
    this.closeSuggestions();
    this.searchMatches = null;
    this.applyVisibility();
    if (this.searchInput) {
      this.searchInput.value = this.activeName;
    }
    if (this.clearBtn) this.clearBtn.style.display = 'none';
  }

  /**
   * ⚠️ **The one DOM writer, and `applyVisibility()` is now its only caller.** Before Phase 22 it was called
   * from four places, each of which knew about exactly one of the two things that can hide a tile.
   */
  private filterGrid(names: string[] | null): void {
    // ⚠️ A `Set`, not `names.includes` — this used to be O(tiles × matches), which a bundle import pays once per
    // entry (177 × 274 × 274 string compares on the measured library) now that it re-applies visibility.
    const keep = names === null ? null : new Set(names);
    for (const [name, tile] of this.tileElements) {
      if (keep === null) {
        tile.style.display = '';
      } else {
        tile.style.display = keep.has(name) ? '' : 'none';
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  // v8 Phase 22 — the facet filter
  // ════════════════════════════════════════════════════════════════════════════════════════════════════

  /**
   * **The ONE resolver** for what the grid shows: the text search AND the facet filter, in that order, over
   * `presetNames` — which is the display order (`applySort` keeps it in step with the DOM).
   *
   * ⚠️ **`null` means "no opinion", not "nothing matches"**, and the two are one keystroke apart: a search of
   * one character sets `searchMatches` back to `null` while a search matching nothing sets it to `[]`. Collapsing
   * them would make an unmatched search show the whole library.
   *
   * ⚠️ **Never rebuilds the grid** (`22.3`): tiles are hidden, so a hidden tile stops intersecting and
   * `reconcileSlots()`'s LRU gets its slot back on its own. Nothing here may touch a slot — an evicted tile has
   * no intersection change left to fire and would be dead for the life of the tab.
   */
  private applyVisibility(): void {
    const query = this.filterState.query();
    const base = this.searchMatches ?? this.config.presetNames;
    const visible = this.filterState.isActive() ? this.facetIndex.filter(base, query) : [...base];

    // The search alone with no filter is the pre-Phase-22 behaviour, byte for byte: `null` restores every tile.
    this.filterGrid(this.searchMatches === null && !this.filterState.isActive() ? null : visible);

    // ⚠️ The drawer refreshes AFTER the tiles, because its `m / N` describes the result just produced.
    this.filterDrawer?.refresh();

    // ⚠️ **Two empty states, never unified** (`22.5`). A search that matches nothing is the user's typo and its
    // action is "clear the search"; an empty filter result is a claim about the LIBRARY and needs the measured
    // drop. When both are empty the SEARCH one wins, because it is the thing the user typed last.
    const emptyBySearch = this.searchMatches !== null && visible.length === 0;
    if (this.emptySearchEl) this.emptySearchEl.style.display = emptyBySearch ? 'block' : 'none';
    if (emptyBySearch && this.emptySearchTextEl) {
      this.emptySearchTextEl.textContent = `Nothing in the library is called “${this.searchInput?.value.trim() ?? ''}”.`;
    }
    if (emptyBySearch && this.filterDrawer) this.filterDrawer.empty.style.display = 'none';
  }

  /**
   * `22.6` — **the visible names in display order, published once for every reader.** `main.ts`'s ←/→ walks
   * this (`22.D11`) and falls back to the library when it is empty.
   *
   * ⚠️ **Read off `presetNames`, not off the DOM**, so it agrees with `applySort` by construction; and ⚠️ **it
   * reports what is VISIBLE, which may not contain the selected preset** — the selection deliberately survives
   * being filtered out, so a caller must handle "the current name is not in this list" rather than assume an
   * index into it.
   */
  visibleNames(): string[] {
    const query = this.filterState.query();
    const base = this.searchMatches ?? this.config.presetNames;
    if (!this.filterState.isActive()) return [...base];
    return this.facetIndex.filter(base, query);
  }

  /**
   * Recompute the facet cache. ⚠️ **Must be called wherever the library's BODIES change** — an import, a bundle
   * import, a delete, a settle. An index built once at boot keeps answering from the old library with no error
   * of any kind (`filter-model.ts` rule 3); the tile that pays for it is the one just imported.
   */
  rebuildFacetIndex(): void {
    this.facetIndex.rebuild();
    this.applyVisibility();
  }

  private showSuggestions(names: string[]): void {
    if (!this.suggestionsDiv) return;
    this.suggestionsDiv.innerHTML = '';
    for (const name of names) {
      const item = document.createElement('div');
      item.className = 'pg-suggestion-item';
      item.textContent = name;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.config.onSelect(name);
        this.cancelSearch();
        this.searchInput?.blur();
      });
      this.suggestionsDiv.appendChild(item);
    }
    this.suggestionsDiv.style.display = 'block';
  }

  private closeSuggestions(): void {
    if (this.suggestionsDiv) {
      this.suggestionsDiv.style.display = 'none';
    }
  }
}
