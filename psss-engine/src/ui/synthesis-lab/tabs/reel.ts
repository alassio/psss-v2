/**
 * The Reel tab (v8 Phase 19) — assemble an ordered collection of presets and play it full screen.
 *
 * ⚠️ **Read `research_paper_psss_fractal_v8.md` → *Phase 19* → 19.6/19.7 before editing.** The layout is two
 * panes: the reel being edited on the left, the preset library on the right, **both animating**. That is the
 * owner's requirement and it is the expensive part of this tab, because the two panes share ONE
 * `GridTileRenderer` — see `TILE` below.
 *
 * ⚠️ **The tab is AFTER the Composer in the bar, which reverses the Composer's standing "never move the tab
 * off LAST" decision.** Owner instruction, recorded at `state.ts`'s `TabId` and in the plan; a reader who
 * knows only the Phase 16 rule will read this position as a violation of it.
 *
 * ⚠️ **The thing this tab EDITS is a `Reel` in `ReelStore`, never a preset**, so every reflex the other eight
 * tabs taught — commit by mutating `workingPreset`, push a snapshot, hold a baseline, guard against a
 * self-echo — is wrong here. The one preset this tab writes is the PREVIEW: the last tile selected in either
 * pane goes on screen in the main view (owner requirement, 2026-09-12), and it goes there through
 * `state.setWorkingPresetExternal` — the same one call a preview-grid tile click makes. See `setPreview()`.
 *
 * ⚠️ **`setWorkingPresetExternal` and NOTHING beside it.** The emit IS the apply (`state.ts`'s write-up on
 * that method): a caller that also reaches for `applyPresetChange` re-inits the generators, the renderer and
 * TransMap twice per click, which is the defect that renamed the method away from `…Silent`.
 */
import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type { UnifiedPreset } from '../../../presets/types.ts';
import type { GridTileRenderer } from '../../preview-grid/grid-tile-renderer.ts';
import type { PresetFilterModel } from '../../preview-grid/filter-model.ts';
import { FilterDrawer } from '../../preview-grid/filter-drawer.ts';
import { TAB_TIPS } from '../tooltips.ts';
import { exportReelsJSON, importReelsWithDialog } from '../export.ts';
import type { ReelStore } from '../../../presets/reel-store.ts';
import {
  REEL_DEFAULT_PLAY_MODE,
  REEL_DEFAULT_SECONDS,
  REEL_DEFAULT_TRANSITION,
  REEL_MAX_NAME_LENGTH,
  REEL_MAX_SECONDS,
  REEL_MIN_SECONDS,
  REEL_PLAY_MODE_LABELS,
  REEL_TRANSITION_LABELS,
  passSeconds,
  resolveReel,
  sameReelName,
  validateReel,
  type Reel,
  type ReelPlayMode,
  type ReelTransition,
} from '../../../exploration/reel-model.ts';

/**
 * The tile canvas size, in device pixels, for BOTH panes.
 *
 * ⚠️ **These MUST equal `GridTileRenderer`'s own internal `TILE_W`/`TILE_H` (256×192) exactly — a smaller
 * canvas does not scale the picture down, it CROPS it, and the crop is silent.** `blitToCanvases()` builds one
 * reused `ImageData(256, 192)` and calls `ctx.putImageData(imageData, 0, 0)`; `putImageData` never resamples,
 * so every pixel outside the destination bitmap is discarded. At 128×96 (shipped 2026-09-12, reported by the
 * owner on the first browser pass as "the presets in the two grids are not animating") each tile showed the
 * top-left QUADRANT of its render, which for a figure centred in the frame is almost entirely black — the
 * tile really was updating, and there was nothing in the visible corner to see it by.
 *
 * ⚠️ **The displayed size is CSS's business, not this constant's** (`.sl-reel-tile-canvas` is `width: 100%`),
 * which is why the fix costs nothing on screen: a 256×192 bitmap in a ~112 px box is simply oversampled.
 * `history.ts` and `evolution.ts` both hard-code the same 256×192 for the same reason.
 */
const TILE_W = 256;
const TILE_H = 192;

/**
 * Hard ceiling on live tile slots ACROSS BOTH PANES.
 *
 * ⚠️ **Below `GridTileRenderer`'s `MAX_SLOTS` (128), because past that the renderer EVICTS and the eviction is
 * invisible to this tab.** `acquireSlot` drops the least-recently-acquired slot when the free pool runs out;
 * `releaseSlot` does not clear the canvas and nothing calls back, so `acquiredBrowse`/`stripSlots` go on
 * claiming a slot that is gone. The tile then has no intersection change left to trigger a re-acquire, so it
 * is dead for the life of the tab — a frozen tile, which is indistinguishable from a broken renderer, and the
 * failure grows with the DISPLAY: at 96 px per tile a 4K panel can lay out several hundred library tiles at
 * once. This tab is therefore the first place in the engine where demand can exceed the pool at all.
 *
 * ⚠️ **A ceiling, not a target — it is `reconcileSlots()` that makes it true, and the strip is served first.**
 * Beyond it the trailing library tiles stay on their last frame, which is a bound the user can see and reason
 * about (the tiles at the top of the pane move) rather than a scatter of dead ones.
 *
 * 96 rather than 128: the renderer's own measured basis is ~32 tiles at 15 fps each out of one
 * `STEADY_BUDGET_MS`, so the per-tile refresh rate is inversely proportional to how many are live. 96 live
 * tiles is ~5 fps each; 128 would be ~3.7 fps with no eviction headroom left for the strip.
 */
const MAX_LIVE_TILES = 96;

/** The strip's slot keys are INDEX-based, the browser's are NAME-based. See `stripKey`. */
function stripKey(index: number): string { return `reel-strip-${index}`; }
function browseKey(name: string): string { return `reel-browse-${name}`; }

/**
 * ⚠️ **ONE `GridTileRenderer` FOR BOTH PANES, and that is a measured decision, not a convenience.**
 * `STEADY_BUDGET_MS` (10 ms) is per-INSTANCE with a rotating cursor over that instance's slots, so two
 * instances would ask for 2 × 10 ms of a 16.7 ms frame and the frame loop has no mechanism that would stop
 * them — `perfGuard`'s single gate turns every tile renderer off together, it does not arbitrate between
 * them. One instance means the strip and the library share one budget and each tile simply refreshes a little
 * less often, which is the trade `CLAUDE.md`'s preview-grid row already records as a won't-fix.
 *
 * ⚠️ **Which is why the two key spaces must not collide.** `acquireSlot` returns early on a key it already
 * holds, so a reel containing `Cylinder` while `Cylinder` is also visible in the library would give the two
 * tiles ONE slot: the second canvas never gets a frame and freezes black, which reads as a rendering fault
 * rather than as a name collision. Both prefixes are mandatory, and the strip's is by INDEX because a reel is
 * allowed to contain the same preset twice.
 */

export interface ReelControls {
  /** Start playing `reel` full screen, from its first preset. */
  play(reel: Reel): void;
  /** Stop playing and leave full screen. Safe to call when not playing. */
  stop(): void;
  isPlaying(): boolean;
  /**
   * ⚠️ **Required, and it is a LIST not a slot (invariant 15).** The runner can stop by itself — Escape, a
   * canvas click, a `requestFullscreen` rejection — so a Play button that only ever learns about its own
   * clicks says "Stop" over a stopped runner. The returned unsubscribe MUST be called in `dispose()`.
   */
  onPlayStateChange(cb: (playing: boolean) => void): () => void;
}

export class ReelTab implements TabModule {
  readonly id: TabId = 'reel';

  private container: HTMLElement | null = null;

  /** The reel in the editor. A working COPY — never the store's object. */
  private working: Reel = blankReel('');
  /**
   * The name the working reel was loaded under, or `null` for a reel that has never been saved.
   *
   * ⚠️ **Not the same as `working.name`**, and the difference is the whole rename mechanism: typing a new name
   * and saving leaves the original reel in place (a copy), because `editingName` still points at it. A single
   * field could not express "saved as X, now called Y".
   */
  private editingName: string | null = null;
  private dirty = false;

  /** Strip selection by INDEX; library selection by NAME. Both multi-select, by plain click. */
  private stripSelection = new Set<number>();
  private browseSelection = new Set<string>();
  /** The NAME search only. The facet half lives in the shared model — see `matchesFilter()`. */
  private filter = '';

  /**
   * v8 Phase 22 step 22.7 — the facet filter, over the same tiles the name search narrows.
   *
   * ⚠️ **ONE predicate, not two side by side.** The tab shipped with `matchesFilter()`/`applyFilter()` doing a
   * name substring test; the facet filter was folded INTO that pair rather than added beside it, because two
   * filters over one `tile.style.display` is invariant 17's shape and is exactly the defect this phase exists to
   * remove. `matchesFilter()` is still the only predicate and `applyFilter()` is still the only writer.
   *
   * ⚠️ **The model is SHARED with the preview grid** (`22.D3`), so ticking a chip here moves the grid too. That
   * is the decision, not a leak: the two views answer the same question about the same library.
   */
  private filterDrawer: FilterDrawer | null = null;
  /** ⚠️ The unsubscribe from the shared state's change LIST (invariant 15) — called in `dispose()`. */
  private unsubFilter: (() => void) | null = null;

  /**
   * The tile whose preset the main view is showing — a SLOT KEY plus the preset name it was taken from.
   *
   * ⚠️ **Two fields, because the key alone goes stale and the name alone is ambiguous.** The strip's keys are
   * positional (`reel-strip-3`), so a Remove or a Move leaves that key naming a different preset and the red
   * marker would sit on whatever slid into the position; the name alone cannot separate the two tiles of a reel
   * that contains the same preset twice, nor a strip tile from its library twin. The name is re-checked when
   * the marker is drawn and a mismatch DROPS the marker rather than moving it — the main view still shows the
   * previewed preset, it is just that no tile is entitled to claim it any more.
   */
  private previewKey: string | null = null;
  private previewName: string | null = null;

  /**
   * The drag in progress: the index the drag STARTED on, and the index currently highlighted as its landing
   * place.
   *
   * ⚠️ **`dragIndex` is the authoritative payload, not `dataTransfer`** — the string in the transfer exists
   * only because Firefox refuses to start a drag with an empty payload, and a drag from anywhere else on the
   * page could carry a plain-text integer that would otherwise be read as a strip index.
   *
   * ⚠️ **Both are cleared in the `drop` handler BEFORE the reorder, not in `dragend`.** A reorder rebuilds the
   * strip, so the node the drag started on leaves the document, and `dragend` is not guaranteed to fire on a
   * detached node — the fields would stay set for the rest of the session and the next `dragover` would act on
   * a stale index. `dragend` still clears them for the cancelled cases (ESC, a drop outside the strip), which
   * is the one path where no rebuild happens.
   */
  private dragIndex: number | null = null;
  private dropIndex: number | null = null;

  // DOM the sync functions write to.
  private selectEl: HTMLSelectElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private modeSelect: HTMLSelectElement | null = null;
  private secondsInput: HTMLInputElement | null = null;
  private transitionSelect: HTMLSelectElement | null = null;
  private mainCheckbox: HTMLInputElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;
  private deleteBtn: HTMLButtonElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private toFirstBtn: HTMLButtonElement | null = null;
  private removeSelBtn: HTMLButtonElement | null = null;
  private removeAllBtn: HTMLButtonElement | null = null;
  private addBtn: HTMLButtonElement | null = null;
  private addAllBtn: HTMLButtonElement | null = null;
  /** The name-search field, kept so the summary row's `×` can clear the box as well as the filter (22.7). */
  private searchEl: HTMLInputElement | null = null;
  private statusEl: HTMLElement | null = null;
  private stripEl: HTMLElement | null = null;
  private stripScroll: HTMLElement | null = null;
  private browseEl: HTMLElement | null = null;
  private browseScroll: HTMLElement | null = null;
  private stripCountEl: HTMLElement | null = null;

  /** Which preset each strip slot is animating, so an unchanged tile is not needlessly re-acquired. */
  private stripSlots: (string | null)[] = [];
  private browseTiles = new Map<string, { tile: HTMLElement; canvas: HTMLCanvasElement }>();
  private acquiredBrowse = new Set<string>();

  /**
   * What the observers report as on screen, which is NOT the same as what holds a slot.
   *
   * ⚠️ **The two must be separate sets, because `MAX_LIVE_TILES` means "visible" and "live" can differ**, and
   * the difference has to survive: a tile refused a slot this pass gets one as soon as another scrolls away,
   * and the only record that it still wants one is this set. Acquiring straight from the observer callback —
   * which is what shipped — has no such record, so the refusal was permanent.
   */
  private browseVisible = new Set<string>();
  private stripVisible = new Set<number>();

  /** Handed in by `init()`; the ONLY thing it is used for is `setPreview()`. */
  private state: ExplorationState | null = null;

  private stripObserver: IntersectionObserver | null = null;
  private browseObserver: IntersectionObserver | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribePlay: (() => void) | null = null;

  constructor(
    private readonly store: ReelStore,
    private readonly tileRenderer: GridTileRenderer,
    private readonly getPresetNames: () => string[],
    private readonly getPreset: (name: string) => UnifiedPreset | undefined,
    private readonly controls: ReelControls,
    /**
     * The shared facet filter, or `null` for a host that has none (v8 Phase 22).
     *
     * ⚠️ **Nullable, unlike the five above.** The other dependencies gate REGISTRATION — a tab that cannot reach
     * the engine must be absent. This one does not: a picker with no facet filter is the tab exactly as it
     * shipped, name search and all, so degrading is the honest answer and hiding the whole tab would not be.
     */
    private readonly presetFilter: PresetFilterModel | null = null,
  ) {}

  // ── lifecycle ──────────────────────────────────────────────────────────────────────────────────────

  init(container: HTMLElement, state: ExplorationState): void {
    this.container = container;
    this.state = state;
    this.build();
    this.loadReel(this.store.mainReelName());

    // ⚠️ The store handler refreshes the DROPDOWN and the status line ONLY — never the working reel. This
    // tab's own `save()`/`remove()` calls come back through here, and re-seeding the editor from the store on
    // its own write is how a tab clobbers the edit the user is in the middle of. An external change (an
    // import) therefore appears in the dropdown immediately and in the editor when the user picks it, which
    // is the same partial-resync trade the Composer's `onExternalChange` settled on.
    this.unsubscribeStore = this.store.onChange(() => {
      this.syncSelect();
      this.syncStatus();
    });
    this.unsubscribePlay = this.controls.onPlayStateChange(() => this.syncPlayButton());
  }

  activate(): void {
    this.tileRenderer.setActive(true);
    // The library list can have grown since this tab was last shown (an import), and its tiles are built
    // once. Rebuilding here rather than on every store change keeps the cost off the frame that imports 177
    // presets.
    if (this.browseTiles.size !== this.getPresetNames().length) this.buildBrowseTiles();
    // ⚠️ The red marker is a claim about what the MAIN VIEW is showing, and anything can have changed it while
    // this tab was away — a Grid click, an arrow key, another tab, Reset. So the claim is re-checked against
    // `workingPreset` on the way back in and dropped if it no longer holds, rather than left to describe a
    // preset that is no longer on screen (`CLAUDE.md` invariant 13: a readout that cannot show the result).
    if (this.previewName !== null && this.state?.workingPreset?.metadata.name !== this.previewName) {
      this.previewKey = null;
      this.previewName = null;
    }
    this.syncSelect();
    this.syncStrip();
    this.syncStatus();
    this.syncPlayButton();
    // ⚠️ The shared filter can have moved in the preview grid while this tab was hidden. The subscription did
    // fire (it is live whether or not the tab is shown, and its work is `display` and text only), but the tiles
    // may also have been REBUILT by the line above, so the predicate is re-applied on the way in rather than
    // trusted — a rebuilt tile is born `display: ''`.
    this.applyFilter();
  }

  deactivate(): void {
    this.tileRenderer.setActive(false);
  }

  /**
   * Lab Reset: discard the edit and reload the reel from the store.
   *
   * ⚠️ **Explicitly NOT a no-op, and not a preset restore either.** `reset(entryPreset)` hands every other tab
   * the preset to go back to; this tab does not edit a preset, so the argument is irrelevant to it and the
   * honest equivalent is "throw away my unsaved reel changes". Leaving the body empty would make Reset appear
   * to do nothing on this tab, which is exactly what `TabModule.reset`'s write-up exists to prevent.
   *
   * ⚠️ **It deliberately does NOT clear the facet filter** (22.7). Reset restores what the Lab EDITS, and the
   * filter is neither this tab's state nor the preset's: it is a session-wide view shared with the preview grid,
   * so clearing it here would silently reset the OTHER panel from a button that never mentions it. The filter's
   * own `Clear all` is the way out, in both views.
   */
  reset(): void {
    this.loadReel(this.editingName);
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.unsubscribePlay?.();
    this.unsubscribePlay = null;
    // ⚠️ The shared state OUTLIVES this tab (it is `main.ts`'s), so an un-removed callback would keep writing
    // into a detached DOM for the rest of the session — invariant 15's cost, and silent.
    this.unsubFilter?.();
    this.unsubFilter = null;
    this.filterDrawer = null;
    this.searchEl = null;
    this.stripObserver?.disconnect();
    this.stripObserver = null;
    this.browseObserver?.disconnect();
    this.browseObserver = null;
    this.releaseStripSlots();
    for (const name of this.acquiredBrowse) this.tileRenderer.releaseSlot(browseKey(name));
    this.acquiredBrowse.clear();
    this.browseVisible.clear();
    this.browseTiles.clear();
    this.container = null;
    this.state = null;
  }

  // ── construction ───────────────────────────────────────────────────────────────────────────────────

  private build(): void {
    const el = this.container!;
    el.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'A reel is an ordered list of presets that plays by itself, full screen. Pick presets '
      + 'on the right, arrange them on the left, then Play. Hover any control for what it does.';
    el.appendChild(desc);

    const body = document.createElement('div');
    body.className = 'sl-reel-body';
    // v8 Phase 22 step 22.7 — the shared facet filter. ⚠️ **Built BEFORE the right pane**, which appends the
    // button and the summary row out of `this.filterDrawer`; and ⚠️ **the drawer itself goes in the TAB BODY,
    // above the two panes**, so it spans the full width and PUSHES them down (`22.D5`) — the right pane is half
    // a tab wide and 24 rows of chips inside it would be unreadable.
    this.buildFilterDrawer();
    if (this.filterDrawer) el.appendChild(this.filterDrawer.drawer);

    el.appendChild(body);

    body.appendChild(this.buildLeftPane());
    body.appendChild(this.buildRightPane());

    this.buildBrowseTiles();
    this.setupObservers();
  }

  /**
   * The drawer, or nothing at all when no model was handed in.
   *
   * ⚠️ **The subscription lives here and its unsubscribe is kept for `dispose()`** — the change list is a LIST
   * (invariant 15) precisely because the preview grid is already on it. ⚠️ **`applyFilter()` is the callback**,
   * not `refresh()`: the tiles have to move before the drawer describes the result, and `applyFilter()` ends by
   * refreshing the drawer — one order, one owner.
   *
   * ⚠️ **This runs on FIRST SHOW, not at registration** (`TabRegistry.show()` builds the container lazily), so a
   * filter the owner set in the grid weeks-of-clicks ago is already active when the tab is first opened. It
   * applies anyway because `build()` ends in `buildBrowseTiles()`, which ends in `applyFilter()` — but nothing
   * here may assume the state is empty at construction, and `FilterDrawer`'s own constructor calls `refresh()`
   * for the same reason.
   */
  private buildFilterDrawer(): void {
    const model = this.presetFilter;
    if (!model) return;
    this.filterDrawer = new FilterDrawer({
      state: model.state,
      index: model.index,
      getVisibleNames: () => this.visibleNames(),
      getAllNames: () => this.getPresetNames(),
      // The Lab's button skin, so it matches `Add` and `Add All` beside it rather than the grid's header.
      buttonClass: 'sl-btn',
      // The tab's own name search as one more removable chip — the grid hands over its search field the same
      // way. Removing it clears the field as well as the filter, because a chip that vanished while the text
      // stayed in the box would leave the box lying about what it is doing.
      getSearchChip: () => {
        if (this.filter.length === 0) return null;
        return {
          text: this.filter,
          onRemove: () => {
            this.filter = '';
            if (this.searchEl) this.searchEl.value = '';
            this.applyFilter();
          },
        };
      },
    });
    this.unsubFilter = model.state.onChange(() => this.applyFilter());
  }

  /** What the picker is showing right now, in library order — the drawer's `m / N` and `22.5`'s subject. */
  private visibleNames(): string[] {
    return this.getPresetNames().filter((n) => this.matchesFilter(n));
  }

  private buildLeftPane(): HTMLElement {
    const pane = document.createElement('div');
    pane.className = 'sl-reel-pane sl-reel-left';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'The reel';
    pane.appendChild(title);

    // Row: reel dropdown + New Reel
    const pickRow = document.createElement('div');
    pickRow.className = 'sl-reel-row';
    this.selectEl = document.createElement('select');
    this.selectEl.className = 'sl-select sl-reel-select';
    this.selectEl.title = TAB_TIPS['reel.select']!;
    this.selectEl.addEventListener('change', () => {
      const name = this.selectEl!.value;
      if (!this.confirmDiscard()) {
        this.syncSelect();
        return;
      }
      this.loadReel(name);
    });
    pickRow.appendChild(this.selectEl);
    pickRow.appendChild(this.button('New Reel', TAB_TIPS['reel.new']!, () => {
      if (!this.confirmDiscard()) return;
      this.loadReel(null);
      this.nameInput?.focus();
      this.nameInput?.select();
    }));
    pane.appendChild(pickRow);

    // Row: name
    const nameRow = document.createElement('div');
    nameRow.className = 'sl-reel-row';
    nameRow.appendChild(this.label('Name'));
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.className = 'sl-input sl-reel-name';
    this.nameInput.maxLength = REEL_MAX_NAME_LENGTH;
    this.nameInput.title = TAB_TIPS['reel.name']!;
    this.nameInput.addEventListener('input', () => {
      this.working.name = this.nameInput!.value;
      this.markDirty();
    });
    // ⚠️ `stopPropagation`, not `preventDefault`: `main.ts` owns single-letter keyboard shortcuts on
    // `document`, and its guard excludes `tagName === 'INPUT'` — but that guard is the wrong place to fix
    // anything, and a future widget without an `INPUT` tag would be unprotected. Stopping the event in the
    // widget is the rule (`CLAUDE.md` → Phase 17): the fix goes in the widget, never in the guard.
    this.nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    nameRow.appendChild(this.nameInput);
    pane.appendChild(nameRow);

    // Row: play mode, play time, transition
    const attrRow = document.createElement('div');
    attrRow.className = 'sl-reel-row sl-reel-attrs';

    attrRow.appendChild(this.label('Play mode'));
    this.modeSelect = document.createElement('select');
    this.modeSelect.className = 'sl-select';
    this.modeSelect.title = TAB_TIPS['reel.playMode']!;
    for (const mode of ['sequential', 'random'] as ReelPlayMode[]) {
      const opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = REEL_PLAY_MODE_LABELS[mode];
      this.modeSelect.appendChild(opt);
    }
    this.modeSelect.addEventListener('change', () => {
      this.working.playMode = this.modeSelect!.value as ReelPlayMode;
      this.markDirty();
      this.syncStrip();
      this.syncStatus();
    });
    attrRow.appendChild(this.modeSelect);

    attrRow.appendChild(this.label('Play time'));
    this.secondsInput = document.createElement('input');
    this.secondsInput.type = 'number';
    this.secondsInput.className = 'sl-input sl-reel-seconds';
    this.secondsInput.min = String(REEL_MIN_SECONDS);
    this.secondsInput.max = String(REEL_MAX_SECONDS);
    // ⚠️ `step="1"` carries TWO properties — typing an integer verbatim, and stepping by an integer. Never
    // `step="any"`, which loses the second one silently (Phase 16's stepper rule, same trap here).
    this.secondsInput.step = '1';
    this.secondsInput.title = TAB_TIPS['reel.playSeconds']!;
    this.secondsInput.addEventListener('keydown', (e) => e.stopPropagation());
    this.secondsInput.addEventListener('input', () => this.readSeconds());
    this.secondsInput.addEventListener('change', () => {
      this.readSeconds();
      // Only a committed change is clamped back into the field: clamping per keystroke would rewrite `1` to
      // `2` while the user was still typing `18`.
      this.secondsInput!.value = String(this.working.playSeconds);
    });
    attrRow.appendChild(this.secondsInput);
    const secUnit = document.createElement('span');
    secUnit.className = 'sl-reel-unit';
    secUnit.textContent = 's';
    attrRow.appendChild(secUnit);

    attrRow.appendChild(this.label('Transition'));
    this.transitionSelect = document.createElement('select');
    this.transitionSelect.className = 'sl-select';
    this.transitionSelect.title = TAB_TIPS['reel.transition']!;
    for (const t of ['black', 'fade'] as ReelTransition[]) {
      const opt = document.createElement('option');
      opt.value = t;
      // ⚠️ The LABEL comes from the model's table and the VALUE is the stored string. The two differ
      // (`Fade to black` vs `black`), so writing the label into `value` would persist a name nothing reads and
      // `sanitiseReel` would silently substitute the default transition on the next load.
      opt.textContent = REEL_TRANSITION_LABELS[t];
      this.transitionSelect.appendChild(opt);
    }
    this.transitionSelect.addEventListener('change', () => {
      this.working.transition = this.transitionSelect!.value as ReelTransition;
      this.markDirty();
      this.syncStatus();
    });
    attrRow.appendChild(this.transitionSelect);
    pane.appendChild(attrRow);

    // Row: main reel
    const mainRow = document.createElement('div');
    mainRow.className = 'sl-reel-row';
    const mainLabel = document.createElement('label');
    mainLabel.className = 'sl-checkbox sl-reel-main';
    this.mainCheckbox = document.createElement('input');
    this.mainCheckbox.type = 'checkbox';
    this.mainCheckbox.addEventListener('change', () => {
      const name = this.editingName;
      if (name === null) return;
      // ⚠️ Un-ticking cannot clear the mark — `ReelStore.mainReelName()` resolves a fallback, so the box would
      // spring straight back on and read as a broken control. The box is therefore re-synced from the store
      // rather than from the click.
      if (this.mainCheckbox!.checked) this.store.setMainReel(name);
      this.syncMainCheckbox();
    });
    mainLabel.appendChild(this.mainCheckbox);
    const mainText = document.createElement('span');
    mainText.textContent = 'Main reel';
    mainLabel.appendChild(mainText);
    mainLabel.title = TAB_TIPS['reel.main']!;
    mainRow.appendChild(mainLabel);
    pane.appendChild(mainRow);

    // Row: Save / Delete / Play / Export Reels / Import Reels
    //
    // ⚠️ **ONE row for all five, on the owner's instruction (2026-09-12) — the two file buttons had a row of
    // their own.** `.sl-reel-row` is `flex-wrap: wrap`, so this is a wrapping row and not a horizontal
    // overflow; the pane is narrow and the two long labels WILL wrap to a second line at most pane widths,
    // which is the intended result rather than a layout that failed to fit.
    const actionRow = document.createElement('div');
    actionRow.className = 'sl-reel-row';
    this.saveBtn = this.button('Save', TAB_TIPS['reel.save']!, () => this.saveReel());
    actionRow.appendChild(this.saveBtn);
    this.deleteBtn = this.button('Delete', TAB_TIPS['reel.delete']!, () => this.deleteReel());
    actionRow.appendChild(this.deleteBtn);
    this.playBtn = this.button('Play', TAB_TIPS['reel.play']!, () => this.togglePlay());
    this.playBtn.classList.add('sl-btn-primary');
    actionRow.appendChild(this.playBtn);
    actionRow.appendChild(this.button('Export Reels', TAB_TIPS['reel.export']!, () => {
      exportReelsJSON(this.store.toFileText());
    }));
    actionRow.appendChild(this.button('Import Reels', TAB_TIPS['reel.import']!, () => {
      importReelsWithDialog((parsed) => {
        const result = this.store.importReels(parsed);
        const parts = [`${result.added} reel${result.added === 1 ? '' : 's'} imported`];
        if (result.renamed) parts.push(`${result.renamed} version-suffixed`);
        if (result.rejected) parts.push(`${result.rejected} unreadable`);
        alert(`${parts.join(', ')}.`);
        this.syncSelect();
      });
    }));
    pane.appendChild(actionRow);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'sl-reel-status';
    pane.appendChild(this.statusEl);

    // Strip header
    const stripHead = document.createElement('div');
    stripHead.className = 'sl-reel-row sl-reel-strip-head';
    this.stripCountEl = document.createElement('span');
    this.stripCountEl.className = 'sl-reel-count';
    stripHead.appendChild(this.stripCountEl);
    this.toFirstBtn = this.button('To Front', TAB_TIPS['reel.stripToFirst']!, () => this.moveSelectedToFront());
    stripHead.appendChild(this.toFirstBtn);
    this.removeSelBtn = this.button('Remove Selected', TAB_TIPS['reel.removeSelected']!, () => this.removeSelected());
    stripHead.appendChild(this.removeSelBtn);
    this.removeAllBtn = this.button('Remove All', TAB_TIPS['reel.removeAll']!, () => {
      if (this.working.presets.length === 0) return;
      this.working.presets = [];
      this.stripSelection.clear();
      this.markDirty();
      this.syncStrip();
      this.syncStatus();
    });
    stripHead.appendChild(this.removeAllBtn);
    pane.appendChild(stripHead);

    this.stripScroll = document.createElement('div');
    this.stripScroll.className = 'sl-reel-strip-scroll';
    this.stripEl = document.createElement('div');
    this.stripEl.className = 'sl-reel-strip';
    this.stripScroll.appendChild(this.stripEl);
    pane.appendChild(this.stripScroll);

    return pane;
  }

  private buildRightPane(): HTMLElement {
    const pane = document.createElement('div');
    pane.className = 'sl-reel-pane sl-reel-right';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'The library';
    pane.appendChild(title);

    const head = document.createElement('div');
    head.className = 'sl-reel-row';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'sl-input sl-reel-search';
    search.placeholder = 'Search by name…';
    search.title = TAB_TIPS['reel.search']!;
    search.addEventListener('keydown', (e) => e.stopPropagation());
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.applyFilter();
    });
    head.appendChild(search);
    this.searchEl = search;
    // The filter's own button, immediately right of the search field it composes with (`22.D15`'s position in
    // this tab's terms — the grid puts it beside Sort for the same reason: next to the other narrowing control).
    if (this.filterDrawer) head.appendChild(this.filterDrawer.button);
    this.addBtn = this.button('Add', TAB_TIPS['reel.add']!, () => this.addSelected());
    head.appendChild(this.addBtn);
    this.addAllBtn = this.button('Add All', TAB_TIPS['reel.addAll']!, () => this.addAllVisible());
    head.appendChild(this.addAllBtn);
    pane.appendChild(head);

    // The removable-chip row, above the tiles it describes.
    if (this.filterDrawer) pane.appendChild(this.filterDrawer.summary);

    this.browseScroll = document.createElement('div');
    this.browseScroll.className = 'sl-reel-browse-scroll';
    this.browseEl = document.createElement('div');
    this.browseEl.className = 'sl-reel-browse';
    // ⚠️ **The empty state goes INSIDE the scroller, above the tiles** — the tiles are all hidden when it shows,
    // so it occupies the space they left rather than adding a band the layout has to find room for. It is the
    // same element the grid hosts, so the measured `Drop “X”` sentence is identical in both views.
    if (this.filterDrawer) this.browseScroll.appendChild(this.filterDrawer.empty);
    this.browseScroll.appendChild(this.browseEl);
    pane.appendChild(this.browseScroll);

    return pane;
  }

  /**
   * Build one tile per library preset, once.
   *
   * ⚠️ **No slot is acquired here.** 177 slots at once would blow past `slotCap` and evict each other in a
   * loop; the `IntersectionObserver` is what decides which tiles are animating, exactly as the preview grid
   * does. A tile that has never been on screen therefore shows its background colour, which is why the tile
   * carries its NAME as text rather than relying on the picture to identify it.
   */
  private buildBrowseTiles(): void {
    const grid = this.browseEl;
    if (!grid) return;
    for (const name of this.acquiredBrowse) this.tileRenderer.releaseSlot(browseKey(name));
    this.acquiredBrowse.clear();
    // ⚠️ The visibility record dies with the DOM nodes it described: the tiles below are new elements, so a
    // surviving entry would let `reconcileSlots` acquire a slot against a detached canvas and hold the
    // ceiling against the tile that replaced it.
    this.browseVisible.clear();
    this.browseObserver?.disconnect();
    grid.innerHTML = '';
    this.browseTiles.clear();

    for (const name of this.getPresetNames()) {
      const tile = document.createElement('div');
      tile.className = 'sl-reel-tile';
      tile.dataset.preset = name;
      tile.title = TAB_TIPS['reel.browseTile']!;

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
        if (this.browseSelection.has(name)) {
          this.browseSelection.delete(name);
        } else {
          this.browseSelection.add(name);
          this.setPreview(browseKey(name), name);
        }
        this.syncBrowseSelection();
      });
      // Double-click appends immediately — the owner's decision, so a single preset does not cost two clicks.
      // ⚠️ The `click` handler fires first and toggles the selection, so the selection is cleaned up here to
      // stop a double-clicked preset being added a second time by the next `Add`.
      tile.addEventListener('dblclick', () => {
        this.browseSelection.delete(name);
        this.syncBrowseSelection();
        this.appendPresets([name]);
      });

      grid.appendChild(tile);
      this.browseTiles.set(name, { tile, canvas });
    }
    this.setupBrowseObserver();
    this.applyFilter();
    this.syncPreviewMarker();
  }

  // ── the preview: what the main view is showing ──────────────────────────────────────────────────────

  /**
   * Put `name` on screen in the main view and give its tile the red marker.
   *
   * ⚠️ **Only a click that SELECTS previews; a click that DESELECTS deliberately leaves the main view alone.**
   * The engine is still rendering that preset, so dropping the marker on a deselect would leave the red line
   * nowhere while nothing on screen had changed — the marker would then be describing the selection, which the
   * blue one already does. This is why the two are separate classes rather than one "last selected" state.
   *
   * ⚠️ **A missing preset returns without previewing and without moving the marker.** A strip entry can name a
   * preset this library does not have (that is what `.missing` renders), and there is nothing to apply for one.
   *
   * ⚠️ `getPreset` is `PresetManager.getWorkingCopy` — already a fresh mutable deep clone, so it is handed
   * straight to the state. A second `deepCopy` here would clone a clone; passing the LIBRARY object instead
   * (which this tab never sees) is the trap that shape guards against.
   */
  private setPreview(key: string, name: string): void {
    const preset = this.getPreset(name);
    if (!preset) return;
    this.previewKey = key;
    this.previewName = name;
    // ⚠️ ONE call. See the header: the emit is the apply, and a second caller-side apply re-inits everything.
    // Nothing here updates `main.ts`'s own `currentPresetIndex` or the Grid's active highlight, so arrow-key
    // navigation still resumes from wherever the GRID last was — the same accepted limit `HistoryTab` and
    // `MixerTab` have, and the reason this is a preview rather than a navigation.
    this.state?.setWorkingPresetExternal(preset);
    this.syncPreviewMarker();
  }

  /**
   * Draw the red marker in both panes.
   *
   * ⚠️ **Called from every path that REBUILDS tiles**, because `classList` lives on the DOM node and a rebuild
   * makes a new one: `syncStrip()` (Add, Remove, Move, a reel load) and `buildBrowseTiles()` (an import). A
   * marker restored only on click would vanish on the next Add and read as the preview having been dropped.
   */
  private syncPreviewMarker(): void {
    for (const [name, { tile }] of this.browseTiles) {
      tile.classList.toggle('preview', this.previewKey === browseKey(name));
    }
    const children = this.stripEl?.children;
    if (!children) return;
    for (let i = 0; i < children.length; i++) {
      // Both halves — see `previewKey`: the positional key survives a Move, the preset at that position does not.
      const marked = this.previewKey === stripKey(i) && this.working.presets[i] === this.previewName;
      (children[i] as HTMLElement).classList.toggle('preview', marked);
    }
  }

  // ── the observers: which tiles are allowed to animate ──────────────────────────────────────────────

  private setupObservers(): void {
    this.setupBrowseObserver();
    this.setupStripObserver();
  }

  /**
   * ⚠️ **An observer callback only records WHAT IS ON SCREEN; every acquire and release goes through
   * `reconcileSlots()`.** Two properties depend on that split and both fail silently without it. Releases must
   * be drained before any acquire — one callback carries both directions, and interleaving starves the
   * trailing entries of capacity that outgoing tiles in the same batch are about to free, so `acquireSlot`
   * evicts a visible tile instead and it freezes on its last painted frame. And a tile refused a slot by
   * `MAX_LIVE_TILES` has to stay a candidate, which needs a record of the wish outliving the callback.
   */
  private setupBrowseObserver(): void {
    if (!this.browseScroll) return;
    this.browseObserver?.disconnect();
    this.browseObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.preset;
        if (name === undefined) continue;
        if (entry.isIntersecting) this.browseVisible.add(name);
        else this.browseVisible.delete(name);
      }
      this.reconcileSlots();
    }, { root: this.browseScroll, rootMargin: '80px', threshold: 0 });
    for (const { tile } of this.browseTiles.values()) this.browseObserver.observe(tile);
  }

  private setupStripObserver(): void {
    if (!this.stripScroll) return;
    this.stripObserver?.disconnect();
    this.stripObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const raw = (entry.target as HTMLElement).dataset.index;
        if (raw === undefined) continue;
        const index = Number(raw);
        if (entry.isIntersecting) this.stripVisible.add(index);
        else this.stripVisible.delete(index);
      }
      this.reconcileSlots();
    }, { root: this.stripScroll, rootMargin: '80px', threshold: 0 });
    for (const tile of this.stripEl?.children ?? []) this.stripObserver.observe(tile);
  }

  /**
   * Bring the live slot set in line with the visible tile set, under `MAX_LIVE_TILES`.
   *
   * ⚠️ **The two loops are ordered: every release first, then the acquires.** See the observer note above.
   *
   * ⚠️ **The strip is served before the library, and that priority is the point** — the reel being authored is
   * the smaller set and the one the user is arranging, so a display wide enough to overflow the ceiling loses
   * library tiles at the bottom of the pane rather than losing the reel.
   *
   * ⚠️ **Idempotent, so it is safe to call from anything.** Both acquire paths test what they already hold, and
   * `acquireStripSlot` can decline (a `.missing` entry has no preset to render), which is why the live count is
   * re-read from the mirror rather than incremented on the assumption that the call worked.
   */
  private reconcileSlots(): void {
    for (let i = 0; i < this.stripSlots.length; i++) {
      if (!this.stripVisible.has(i)) this.releaseStripSlot(i);
    }
    for (const name of [...this.acquiredBrowse]) {
      if (this.browseVisible.has(name)) continue;
      this.tileRenderer.releaseSlot(browseKey(name));
      this.acquiredBrowse.delete(name);
    }

    let live = this.liveTileCount();
    for (let i = 0; i < this.stripSlots.length && live < MAX_LIVE_TILES; i++) {
      if (!this.stripVisible.has(i) || this.stripSlots[i] != null) continue;
      this.acquireStripSlot(i);
      if (this.stripSlots[i] != null) live++;
    }
    // ⚠️ Iterated in LIBRARY order (`browseTiles` is insertion-ordered), never in observer-callback order:
    // which tiles win the last few slots must not depend on the direction the user scrolled from.
    for (const name of this.browseTiles.keys()) {
      if (live >= MAX_LIVE_TILES) break;
      if (!this.browseVisible.has(name) || this.acquiredBrowse.has(name)) continue;
      const entry = this.browseTiles.get(name);
      const preset = this.getPreset(name);
      if (!entry || !preset) continue;
      this.tileRenderer.acquireSlot(browseKey(name), preset, entry.canvas);
      this.acquiredBrowse.add(name);
      live++;
    }
  }

  private liveTileCount(): number {
    let n = this.acquiredBrowse.size;
    for (const slot of this.stripSlots) if (slot != null) n++;
    return n;
  }

  private acquireStripSlot(index: number): void {
    const name = this.working.presets[index];
    const tile = this.stripEl?.children[index] as HTMLElement | undefined;
    if (name === undefined || !tile) return;
    if (this.stripSlots[index] === name) return;
    const canvas = tile.querySelector('canvas');
    const preset = this.getPreset(name);
    if (!canvas || !preset) return;
    // Release first: `acquireSlot` returns early on a live key, so re-using a key without releasing leaves the
    // PREVIOUS preset's generator attached to the new canvas — the tile animates the wrong preset.
    if (this.stripSlots[index] !== null && this.stripSlots[index] !== undefined) {
      this.tileRenderer.releaseSlot(stripKey(index));
    }
    this.tileRenderer.acquireSlot(stripKey(index), preset, canvas);
    this.stripSlots[index] = name;
  }

  private releaseStripSlot(index: number): void {
    if (this.stripSlots[index] === null || this.stripSlots[index] === undefined) return;
    this.tileRenderer.releaseSlot(stripKey(index));
    this.stripSlots[index] = null;
  }

  private releaseStripSlots(): void {
    for (let i = 0; i < this.stripSlots.length; i++) this.releaseStripSlot(i);
    this.stripSlots = [];
    // Same reason as `buildBrowseTiles`: the indices are about to describe different tiles, or none.
    this.stripVisible.clear();
  }

  // ── editing the reel ───────────────────────────────────────────────────────────────────────────────

  private loadReel(name: string | null): void {
    const stored = name === null ? undefined : this.store.get(name);
    this.working = stored ? { ...stored, presets: [...stored.presets] } : blankReel(this.freshReelName());
    this.editingName = stored ? stored.name : null;
    this.dirty = false;
    this.stripSelection.clear();
    this.syncSelect();
    this.syncFields();
    this.syncStrip();
    this.syncStatus();
    this.syncPlayButton();
  }

  /** A name no reel is using, so a new reel can be saved without first thinking of one. */
  private freshReelName(): string {
    const taken = new Set(this.store.names().map((n) => n.toLowerCase()));
    if (!taken.has('new reel')) return 'New Reel';
    let n = 2;
    while (taken.has(`new reel ${n}`)) n++;
    return `New Reel ${n}`;
  }

  private markDirty(): void {
    this.dirty = true;
    this.syncSaveState();
    this.syncSelect();
  }

  /**
   * ⚠️ **A BLANK numeric input is not a zero.** `Number('')` is 0, which here would clamp to
   * `REEL_MIN_SECONDS` and rewrite the field the instant the user cleared it to retype. So a blank field is
   * left alone entirely — the model keeps its last value and `change` writes the clamped one back.
   */
  private readSeconds(): void {
    const raw = this.secondsInput?.value ?? '';
    if (raw.trim().length === 0) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    this.working.playSeconds = Math.min(REEL_MAX_SECONDS, Math.max(REEL_MIN_SECONDS, Math.round(value)));
    this.markDirty();
    this.syncStatus();
  }

  private appendPresets(names: readonly string[]): void {
    if (names.length === 0) return;
    this.working.presets = [...this.working.presets, ...names];
    this.markDirty();
    this.syncStrip();
    this.syncStatus();
  }

  private addSelected(): void {
    // In LIBRARY order, not selection order: the tiles are what the user was looking at, and a set has no
    // order a user could have predicted anyway.
    const names = this.getPresetNames().filter((n) => this.browseSelection.has(n));
    this.appendPresets(names);
    this.browseSelection.clear();
    this.syncBrowseSelection();
  }

  private addAllVisible(): void {
    // ⚠️ The VISIBLE set, which is what the tooltip promises — `Add All` under a search or a facet filter is the
    // two-click themed-reel path, and adding the whole library instead would be a 274-entry mistake to undo by
    // hand. ⚠️ **`visibleNames()`, not a second `matchesFilter` walk**: one publisher, so the button and the
    // drawer's `m / N` cannot disagree about what "listed" means.
    this.appendPresets(this.visibleNames());
  }

  private removeSelected(): void {
    if (this.stripSelection.size === 0) return;
    this.working.presets = this.working.presets.filter((_, i) => !this.stripSelection.has(i));
    this.stripSelection.clear();
    this.markDirty();
    this.syncStrip();
    this.syncStatus();
  }

  private removeAt(index: number): void {
    if (index < 0 || index >= this.working.presets.length) return;
    this.working.presets = this.working.presets.filter((_, i) => i !== index);
    this.stripSelection.clear();
    this.markDirty();
    this.syncStrip();
    this.syncStatus();
  }

  // ── reordering ─────────────────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ **Every reorder is expressed as a PERMUTATION and goes through `reorderStrip`, which is the only place
  // the strip's order changes.** The three ways in — the ◀/▶ arrows, a drag, and `To Front` — differ in nothing
  // but the permutation they build, while each of them has to fix up the same two by-INDEX structures
  // (`stripSelection` and `previewKey`). Written per call site, that fix-up is three chances to get it wrong,
  // and getting it wrong is silent: the highlight and the red marker sit on whichever preset slid into the old
  // position, so a following `Remove Selected` takes out something the user never selected. That was the
  // shipped behaviour of `moveAt`, which sidestepped the problem by CLEARING the selection — acceptable for a
  // one-place nudge, but not for a drag, where losing the selection on every drop is what the user is trying
  // to build with.

  /** One place earlier or later. A nudge is just a move to the neighbouring index. */
  private moveAt(index: number, delta: number): void {
    this.moveToIndex(index, index + delta);
  }

  /**
   * Move the entry at `from` so that it OCCUPIES index `to`, sliding everything between along by one.
   *
   * ⚠️ **This is remove-then-insert, not a swap**, which is the semantics a drag needs: dropping tile 7 onto
   * tile 2 has to leave it at position 2 with 2…6 pushed back, not trade it with whatever was at 2. For
   * neighbouring indices the two are identical, which is why the arrows can share it.
   */
  private moveToIndex(from: number, to: number): void {
    const n = this.working.presets.length;
    if (from === to || from < 0 || from >= n || to < 0 || to >= n) return;
    const order: number[] = [];
    for (let i = 0; i < n; i++) if (i !== from) order.push(i);
    order.splice(to, 0, from);
    this.reorderStrip(order);
  }

  /**
   * Move every selected preset to the front, keeping their order relative to one another.
   *
   * ⚠️ **The moved block stays selected** — unlike the pre-drag `moveAt`, whose cleared selection would make a
   * second press a no-op with no explanation. The early-out is what makes pressing it twice harmless: an
   * already-leading selection would otherwise mark the reel dirty and re-warm every tile for nothing.
   */
  private moveSelectedToFront(): void {
    const n = this.working.presets.length;
    const selected = [...this.stripSelection].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
    if (selected.length === 0) return;
    if (selected.every((index, k) => index === k)) return;
    const rest: number[] = [];
    for (let i = 0; i < n; i++) if (!this.stripSelection.has(i)) rest.push(i);
    this.reorderStrip([...selected, ...rest]);
  }

  /**
   * Apply a permutation of the strip: `order[k]` is the index that ENDS UP at position k.
   *
   * ⚠️ **A malformed `order` is refused outright rather than applied partially.** It is built from indices in
   * three places, and a length mismatch or a repeated index would duplicate one preset and drop another —
   * damage to the user's reel that no undo exists for. Both tests are cheap; neither can be reached by a
   * correct caller.
   */
  private reorderStrip(order: readonly number[]): void {
    const list = this.working.presets;
    if (order.length !== list.length) return;
    const next: string[] = [];
    const newIndexOf = new Map<number, number>();
    for (let k = 0; k < order.length; k++) {
      const from = order[k]!;
      const name = list[from];
      if (name === undefined) return;
      next.push(name);
      newIndexOf.set(from, k);
    }
    if (newIndexOf.size !== list.length) return;

    // Read the preview's OLD index before the array moves under it; `previewKey` is positional.
    const previewFrom = this.previewStripIndex();
    this.working.presets = next;
    this.stripSelection = new Set(
      [...this.stripSelection].map((i) => newIndexOf.get(i)).filter((i): i is number => i !== undefined),
    );
    if (previewFrom !== null) {
      const previewTo = newIndexOf.get(previewFrom);
      if (previewTo !== undefined) this.previewKey = stripKey(previewTo);
    }
    this.markDirty();
    this.syncStrip();
    this.syncStatus();
  }

  /** Which strip position currently holds the preview marker, or `null` if the marker is not on the strip. */
  private previewStripIndex(): number | null {
    if (this.previewKey === null) return null;
    for (let i = 0; i < this.working.presets.length; i++) {
      if (this.previewKey === stripKey(i)) return i;
    }
    return null;
  }

  /**
   * Highlight `index` as the drag's landing place, or clear the highlight with `null`.
   *
   * ⚠️ **The class is written only when the target CHANGES, and it is never removed on the tile's own
   * `dragleave`.** A tile contains a canvas, a label and three buttons, so moving the pointer within it fires
   * `dragleave` on the tile every time it crosses into a child — removing the class there makes the highlight
   * strobe. Tracking the index instead means `dragover` (which fires continuously, and bubbles from the
   * children) can be the only writer, and the highlight is cleared by the two events that really end the
   * drag: `drop` and `dragend`.
   */
  private setDropTarget(index: number | null): void {
    if (this.dropIndex === index) return;
    const children = this.stripEl?.children;
    if (children) {
      if (this.dropIndex !== null) children[this.dropIndex]?.classList.remove('drag-over');
      if (index !== null) children[index]?.classList.add('drag-over');
    }
    this.dropIndex = index;
  }

  /**
   * Forget the drag and take its two classes off whatever still carries them.
   *
   * ⚠️ Queried out of the DOM rather than remembered in a field: the tile that started the drag may already
   * have been replaced by `syncStrip()`, in which case there is nothing to clean and the query finds nothing.
   */
  private clearDrag(): void {
    this.dragIndex = null;
    this.setDropTarget(null);
    this.stripEl?.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  }

  // ── saving, deleting, playing ──────────────────────────────────────────────────────────────────────

  private saveReel(): void {
    const problems = validateReel(this.working);
    if (problems.length > 0) {
      alert(problems.map((p) => `• ${p.message}`).join('\n'));
      return;
    }
    const name = this.working.name.trim();
    // An overwrite is confirmed; a save under the SAME name the reel was loaded under is still an overwrite of
    // that reel and still asks, because a user who renamed and then changed their mind back would otherwise
    // lose the original silently.
    if (this.store.has(name) && !(this.editingName !== null && sameReelName(this.editingName, name))) {
      if (!confirm(`A reel named "${name}" already exists.\n\nReplace it?`)) return;
    } else if (this.editingName !== null && sameReelName(this.editingName, name) && this.store.has(name)) {
      if (!confirm(`Replace the saved version of "${name}" with your changes?`)) return;
    }
    this.working.name = name;
    this.store.save(this.working);
    this.editingName = name;
    this.dirty = false;
    this.syncSelect();
    this.syncSaveState();
    this.syncMainCheckbox();
    this.syncStatus();
  }

  private deleteReel(): void {
    const name = this.editingName;
    if (name === null || !this.store.canRemove(name)) return;
    const restores = this.store.isShadowing(name);
    const message = restores
      ? `Delete your version of "${name}"?\n\nThe version shipped with the engine will come back in its place.`
      : `Delete the reel "${name}"?\n\nThis cannot be undone.`;
    if (!confirm(message)) return;
    const outcome = this.store.remove(name);
    // Land on whatever the name resolves to now: the restored built-in if there was one, otherwise the main
    // reel. Loading `null` after a delete would drop the user into an empty editor, which reads as data loss.
    this.loadReel(outcome === 'restored' ? name : this.store.mainReelName());
  }

  private togglePlay(): void {
    if (this.controls.isPlaying()) {
      this.controls.stop();
      return;
    }
    const resolved = resolveReel(this.working, (n) => this.getPreset(n) !== undefined);
    if (resolved.order.length === 0) {
      alert('This reel has no presets that exist in this library, so there is nothing to play.');
      return;
    }
    // ⚠️ The WORKING reel is played, not the stored one — an edit has to be auditionable before it is saved,
    // and the alternative (play only what is saved) makes Play lie about what is on screen.
    this.controls.play({ ...this.working, presets: [...this.working.presets] });
  }

  private confirmDiscard(): boolean {
    if (!this.dirty) return true;
    return confirm('This reel has unsaved changes.\n\nDiscard them?');
  }

  // ── sync ───────────────────────────────────────────────────────────────────────────────────────────

  private syncSelect(): void {
    const sel = this.selectEl;
    if (!sel) return;
    const main = this.store.mainReelName();
    sel.innerHTML = '';
    for (const reel of this.store.list()) {
      const opt = document.createElement('option');
      opt.value = reel.name;
      // ★ marks the main reel — the requirement is that the dropdown shows which one it is, and a prefix
      // survives the native `<select>` rendering where a class or an icon would not.
      //
      // ⚠️ **NO ORIGIN SUFFIX.** A ` (shipped)` suffix on every built-in reel was here until 2026-09-24 and the
      // owner removed it: *"some reels are listed with suffix (shipped), although they do not contain this text
      // in their name. Do not show any suffix like that, use only the assigned name."* The decoration is also a
      // lie waiting to happen — the origin is a LAYER, so the same reel is "shipped" until the user saves over
      // it and then silently is not, while the name it is stored under never changed. `store.origin()` stays;
      // it has two real readers (`isShadowing`, `canRemove`), where the answer decides BEHAVIOUR rather than
      // decorating a label. The one decoration that remains is the ★, which marks a CHOICE the user made.
      const star = main !== null && sameReelName(main, reel.name) ? '★ ' : '';
      opt.textContent = `${star}${reel.name}`;
      sel.appendChild(opt);
    }
    if (this.editingName === null) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = `${this.working.name || 'New reel'} (unsaved)`;
      sel.appendChild(opt);
      sel.value = '';
    } else {
      sel.value = this.editingName;
    }
  }

  private syncFields(): void {
    if (this.nameInput) this.nameInput.value = this.working.name;
    if (this.modeSelect) this.modeSelect.value = this.working.playMode;
    if (this.secondsInput) this.secondsInput.value = String(this.working.playSeconds);
    if (this.transitionSelect) this.transitionSelect.value = this.working.transition;
    this.syncMainCheckbox();
    this.syncSaveState();
  }

  private syncMainCheckbox(): void {
    const box = this.mainCheckbox;
    if (!box) return;
    const name = this.editingName;
    const saved = name !== null;
    box.disabled = !saved;
    box.checked = saved && this.store.isMainReel(name);
    const label = box.parentElement;
    if (label) {
      // ⚠️ The disabled reason replaces the tooltip rather than sitting beside it: a disabled control's
      // `title` is the only channel it has left, and a control that explains nothing about why it cannot be
      // used is the shape invariant 25 describes.
      label.title = saved
        ? TAB_TIPS['reel.main']!
        : 'Save this reel first — an unsaved reel has no name to mark as main.';
    }
  }

  private syncSaveState(): void {
    if (this.saveBtn) {
      this.saveBtn.disabled = false;
      this.saveBtn.classList.toggle('sl-btn-primary', this.dirty || this.editingName === null);
    }
    const name = this.editingName;
    if (this.deleteBtn) {
      const can = name !== null && this.store.canRemove(name);
      this.deleteBtn.disabled = !can;
      this.deleteBtn.title = can
        ? TAB_TIPS['reel.delete']!
        : name === null
          ? 'This reel has never been saved, so there is nothing to delete.'
          : 'This reel is shipped with the engine and cannot be deleted. Edit it and Save to keep your own '
            + 'version under the same name.';
    }
  }

  private syncPlayButton(): void {
    const btn = this.playBtn;
    if (!btn) return;
    const playing = this.controls.isPlaying();
    btn.textContent = playing ? 'Stop' : 'Play';
    btn.disabled = !playing && this.working.presets.length === 0;
  }

  /**
   * Rebuild the strip.
   *
   * ⚠️ **The DOM is rebuilt wholesale and every slot is released first**, which is deliberate rather than
   * lazy: the canvases the slots were drawing into are gone, so a surviving slot would be rendering into a
   * detached node forever (the same reasoning as `HistoryTab.render`). The cost is bounded by the reel length
   * and paid only on a user action — an Add, a Remove or a Move — never per frame.
   */
  private syncStrip(): void {
    const grid = this.stripEl;
    if (!grid) return;
    this.releaseStripSlots();
    grid.innerHTML = '';
    // The nodes the drag state named are gone with the rebuild. Forget the indices rather than let a later
    // `setDropTarget` write a highlight onto whichever tile inherited the position.
    this.dragIndex = null;
    this.dropIndex = null;

    const presets = this.working.presets;
    this.stripSlots = new Array<string | null>(presets.length).fill(null);

    for (let i = 0; i < presets.length; i++) {
      const name = presets[i]!;
      const missing = this.getPreset(name) === undefined;
      const tile = document.createElement('div');
      tile.className = 'sl-reel-tile sl-reel-strip-tile';
      tile.dataset.index = String(i);
      tile.title = TAB_TIPS['reel.stripTile']!;
      if (this.stripSelection.has(i)) tile.classList.add('selected');
      if (missing) tile.classList.add('missing');

      const canvas = document.createElement('canvas');
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      canvas.className = 'sl-reel-tile-canvas';
      tile.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'sl-reel-tile-label';
      // In Random mode the number would be a lie, so it is dropped rather than shown as an order.
      const badge = this.working.playMode === 'sequential' ? `${i + 1}. ` : '';
      label.textContent = missing ? `${badge}${name} — not in this library` : `${badge}${name}`;
      tile.appendChild(label);

      const tools = document.createElement('div');
      tools.className = 'sl-reel-tile-tools';
      tools.appendChild(this.tileTool('◀', TAB_TIPS['reel.stripMove']!, () => this.moveAt(i, -1), i === 0));
      tools.appendChild(this.tileTool('▶', TAB_TIPS['reel.stripMove']!, () => this.moveAt(i, 1), i === presets.length - 1));
      tools.appendChild(this.tileTool('✕', TAB_TIPS['reel.stripRemove']!, () => this.removeAt(i), false));
      tile.appendChild(tools);

      tile.addEventListener('click', () => {
        if (this.stripSelection.has(i)) {
          this.stripSelection.delete(i);
        } else {
          this.stripSelection.add(i);
          this.setPreview(stripKey(i), name);
        }
        tile.classList.toggle('selected', this.stripSelection.has(i));
        this.syncStripHead();
      });

      // ── drag to reorder ──
      // ⚠️ **`draggable` is set on the TILE, and the three tool buttons sit inside it**, so a press on ◀/▶/✕
      // that drifts by a pixel starts a drag of the whole tile and the click never lands. `dragstart` is
      // therefore refused when it comes from a tool: cancelling the drag is what lets the button keep its
      // click, and `stopPropagation` on the buttons cannot help, since the drag is the ancestor's own gesture
      // rather than a bubbling event.
      tile.draggable = true;
      tile.addEventListener('dragstart', (e) => {
        if ((e.target as HTMLElement | null)?.closest('.sl-reel-tile-tool')) {
          e.preventDefault();
          return;
        }
        this.dragIndex = i;
        tile.classList.add('dragging');
        // Firefox will not start a drag with an empty payload. The VALUE is never read back — see `dragIndex`.
        e.dataTransfer?.setData('text/plain', String(i));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      tile.addEventListener('dragover', (e) => {
        if (this.dragIndex === null) return;
        // Without this the `drop` event never fires at all — the default action is "refuse the drop".
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        this.setDropTarget(this.dragIndex === i ? null : i);
      });
      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = this.dragIndex;
        this.clearDrag();
        if (from === null) return;
        this.moveToIndex(from, i);
      });
      tile.addEventListener('dragend', () => this.clearDrag());

      grid.appendChild(tile);
    }

    this.setupStripObserver();
    this.syncStripHead();
    this.syncPreviewMarker();
    this.syncPlayButton();
  }

  private syncStripHead(): void {
    const count = this.working.presets.length;
    if (this.stripCountEl) {
      this.stripCountEl.textContent = count === 0
        ? 'Empty — add presets from the right'
        : `${count} preset${count === 1 ? '' : 's'}${this.stripSelection.size > 0 ? `, ${this.stripSelection.size} selected` : ''}`;
    }
    // ⚠️ `To Front` is greyed on an empty selection ONLY — deliberately not on "the selection is already at the
    // front", which is a "cannot be seen" rather than a "cannot be applied" (CLAUDE.md invariant 25). The
    // no-op case is handled by `moveSelectedToFront`'s early-out, silently and without marking the reel dirty.
    if (this.toFirstBtn) this.toFirstBtn.disabled = this.stripSelection.size === 0;
    if (this.removeSelBtn) this.removeSelBtn.disabled = this.stripSelection.size === 0;
    if (this.removeAllBtn) this.removeAllBtn.disabled = count === 0;
  }

  private syncBrowseSelection(): void {
    for (const [name, { tile }] of this.browseTiles) {
      tile.classList.toggle('selected', this.browseSelection.has(name));
    }
    if (this.addBtn) {
      this.addBtn.disabled = this.browseSelection.size === 0;
      this.addBtn.textContent = this.browseSelection.size > 0 ? `Add (${this.browseSelection.size})` : 'Add';
    }
  }

  /**
   * **The ONE predicate the picker narrows by**, and since 22.7 it answers for both halves: the name search AND
   * the shared facet filter, AND-ed.
   *
   * ⚠️ **Folded in here rather than added beside it.** A second `display` writer over the same tiles is
   * invariant 17's shape — whichever of the two ran last would win, so cancelling the search would un-hide every
   * tile the facet filter had excluded. There is one predicate and `applyFilter()` is its one writer.
   */
  private matchesFilter(name: string): boolean {
    if (this.filter.length > 0 && !name.toLowerCase().includes(this.filter)) return false;
    const model = this.presetFilter;
    if (!model || !model.state.isActive()) return true;
    return model.index.matches(name, model.state.query());
  }

  /**
   * ⚠️ **Filtering toggles `display`, it does not rebuild the grid** — a rebuild would drop every slot and
   * re-acquire on the next observer pass, so typing in the search box would restart the animation of every
   * visible tile on every keystroke. `display: none` also makes the observer fire `isIntersecting: false`,
   * which releases the hidden tiles' slots for free.
   */
  private applyFilter(): void {
    let visible = 0;
    for (const [name, { tile }] of this.browseTiles) {
      const show = this.matchesFilter(name);
      tile.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    if (this.addAllBtn) {
      this.addAllBtn.disabled = visible === 0;
      // ⚠️ **The count shows whenever ANYTHING is narrowing, the facet filter included.** `Add All` adds the
      // VISIBLE set (`addAllVisible()` shares `matchesFilter`), so testing only `this.filter` would have left
      // the button saying a bare `Add All` while it was about to add 12 presets out of 274 — the one state in
      // which the label misdescribes the action rather than merely omitting a number.
      const narrowed = this.filter.length > 0 || (this.presetFilter?.state.isActive() ?? false);
      this.addAllBtn.textContent = narrowed ? `Add All (${visible})` : 'Add All';
    }
    // ⚠️ AFTER the tiles: the drawer's `m / N` and its empty state both describe the result just produced.
    this.filterDrawer?.refresh();
  }

  private syncStatus(): void {
    const el = this.statusEl;
    if (!el) return;
    const resolved = resolveReel(this.working, (n) => this.getPreset(n) !== undefined);
    const parts: string[] = [];

    if (resolved.order.length === 0) {
      parts.push('Nothing to play yet.');
    } else {
      const total = passSeconds(resolved.order.length, this.working.playSeconds, this.working.transition);
      // ⚠️ "one pass" and not "total length": both play modes loop forever, so a total run time does not
      // exist. Naming the pass is what keeps the figure honest.
      parts.push(`${resolved.order.length} preset${resolved.order.length === 1 ? '' : 's'}, one pass ${formatDuration(total)}`);
    }
    if (resolved.skipped.length > 0) {
      parts.push(`${resolved.skipped.length} not in this library and will be skipped`);
    }
    if (this.dirty) parts.push('unsaved changes');
    if (!this.store.status().persistent) {
      parts.push('this browser will not remember reels — use Export Reels');
    } else if (this.store.status().writeFailed) {
      parts.push('could not be written to this browser');
    }
    el.textContent = parts.join(' · ');
  }

  // ── small builders ─────────────────────────────────────────────────────────────────────────────────

  private label(text: string): HTMLElement {
    const el = document.createElement('span');
    el.className = 'sl-reel-label';
    el.textContent = text;
    return el;
  }

  private button(text: string, tip: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sl-btn';
    btn.textContent = text;
    btn.title = tip;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private tileTool(glyph: string, tip: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sl-reel-tile-tool';
    btn.textContent = glyph;
    btn.title = tip;
    btn.disabled = disabled;
    // ⚠️ `stopPropagation` is required: the tile itself toggles its selection on click, so without this every
    // move or remove would also flip the selection of the tile it was aimed at.
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
}

function blankReel(name: string): Reel {
  return {
    name,
    presets: [],
    playMode: REEL_DEFAULT_PLAY_MODE,
    playSeconds: REEL_DEFAULT_SECONDS,
    transition: REEL_DEFAULT_TRANSITION,
  };
}

/** `m min s s` / `s s` — the readout unit is a PASS, never a total; the reel loops. */
function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} s`;
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}
