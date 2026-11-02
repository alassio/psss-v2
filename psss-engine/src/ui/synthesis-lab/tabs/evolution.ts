import type { TabModule } from '../../../exploration/tab-module.ts';
import type { CategoryLock, ExplorationState, TabId } from '../../../exploration/state.ts';
import type { UnifiedPreset } from '../../../presets/types.ts';
import type { PresetStatistics } from '../../../exploration/preset-stats.ts';
import type { GridTileRenderer } from '../../preview-grid/grid-tile-renderer.ts';
import { breedGeneration, mutatePreset } from '../../../exploration/evolution-ops.ts';
import { CATEGORY_LOCKS } from '../../../exploration/overlay-rules.ts';
import type { Intensity } from '../../../exploration/randomize.ts';
import { deepCopy } from '../../../exploration/state.ts';
import { LOCK_CATEGORY_TIPS, TAB_TIPS } from '../tooltips.ts';

const TILE_COUNT = 9;
/**
 * ⚠️ **ONE OF FOUR HAND-WRITTEN COPIES, AND PHASE 25 DELIBERATELY DID NOT CENTRALISE THEM.** `TILE_W`/`TILE_H`
 * = 256/192 is also declared in `preview-grid/grid-tile-renderer.ts`, `tabs/history.ts` and `tabs/reel.ts`,
 * with **no compiler between them**, and only `reel.ts` carries the paragraph explaining why they must agree
 * (`blitToCanvases()` uses `putImageData`, which never resamples, so a canvas smaller than the renderer's
 * tile **CROPS to the top-left** rather than scaling). All four are equal; the widening test settled it —
 * centralising would alter no rendered pixel and prevent no measurable defect today, and it is a four-file
 * edit touching the Reel and the Grid to serve this tab. **Recorded as a named latent trap, not as debt.**
 */
const TILE_W = 256;
const TILE_H = 192;

/**
 * ⚠️ **THE LOCK CHIPS ARE BUILT FROM THE SHARED ARRAY, NEVER HAND-WRITTEN (`25.5`).** This is the THIRD
 * consumer after the Mixer's faders and the Randomiser's chips, so hand-writing a row is now three times as
 * expensive — and the seventh member (`'material'`) would become an owed item no compiler and no checker can
 * see, in three places instead of one.
 */
const LOCKS: readonly CategoryLock[] = CATEGORY_LOCKS;

/** Human labels for the chips; the stored value is the bare `CategoryLock` word. */
const LOCK_LABELS: Record<CategoryLock, string> = {
  shape: 'Shape',
  color: 'Colour',
  motion: 'Motion',
  transmap: 'TransMap',
  attractor: 'Attractor',
  material: 'Material',
  visual: 'Visual',
};

// Stable slot keys for the 9 evo tiles in GridTileRenderer
function slotKey(i: number): string { return `evo-${i}`; }

export class EvolutionTab implements TabModule {
  readonly id: TabId = 'evolution';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private stats: PresetStatistics;
  private tileRenderer: GridTileRenderer;
  private tileCanvases: HTMLCanvasElement[] = [];
  private tileElements: HTMLElement[] = [];
  private selected: Set<number> = new Set();
  private generation: UnifiedPreset[] = [];

  /** `25.D10` — Evolution-local strength, driving BOTH buttons. `medium` default, so today is the midpoint. */
  private intensity: Intensity = 'medium';
  /** Which slots hold a carried-over parent, for the `◆` badge. A slot can be both carried and selected. */
  private carried: Set<number> = new Set();
  /** `25.D7` — ONE stored generation and its selection. No stack and no `Forward`. */
  private previous: { generation: UnifiedPreset[]; selected: Set<number>; carried: Set<number> } | null = null;

  private strengthBtns: Map<Intensity, HTMLButtonElement> = new Map();
  private chipEls: Map<CategoryLock, HTMLElement> = new Map();
  private counterEl: HTMLElement | null = null;
  private seedNoteEl: HTMLElement | null = null;
  private backBtn: HTMLButtonElement | null = null;

  /**
   * ⚠️ **HELD AS FIELDS BECAUSE `ExplorationState.on()` RETURNS NOTHING (`25.D14`).** The unsubscribe is
   * `state.off(event, listener)`, so there is no handle to forget — which makes this invariant 15 in its
   * less obvious form: the leak is not a dropped unsubscribe function, it is a listener nobody kept a
   * reference to. Both are `off()`-ed in `dispose()`.
   */
  private onPresetChanged: (() => void) | null = null;
  private onLocksChanged: (() => void) | null = null;

  constructor(stats: PresetStatistics, tileRenderer: GridTileRenderer) {
    this.stats = stats;
    this.tileRenderer = tileRenderer;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.render();

    /**
     * `25.6` — subscribe. ⚠️ **A SEED CHANGE IS ANNOUNCED, NEVER ACTED ON (`25.D14`).** Auto-regenerating
     * would destroy nine tiles the user may be mid-way through judging because they loaded a preset in
     * another tab; a one-line notice reports the staleness the regeneration would "fix".
     */
    this.onPresetChanged = () => { this.setSeedNote(true); };
    this.onLocksChanged = () => { this.syncChips(); };
    state.on('preset-changed', this.onPresetChanged);
    // The same `Set` is now written by two other tabs, so the chips here can go stale without this.
    state.on('locks-changed', this.onLocksChanged);
  }

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.tileCanvases = [];
    this.tileElements = [];
    this.strengthBtns.clear();
    this.chipEls.clear();

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Breed variations of the current preset. Pick up to three tiles as parents; your picks '
      + 'come back, lightly varied, in the first slots.';
    el.appendChild(desc);

    /**
     * ---- ONE control row: four actions, then the three strength toggles -----------------------------
     *
     * ⚠️ **THE STRENGTH TOGGLES MOVED ONTO `Back`'s ROW ON 2026-10-06 (owner), AND WHAT IT BUYS IS GRID
     * HEIGHT.** They had a `sl-section` of their own — a section title plus a button row — and this tab's
     * whole purpose is the nine tiles below, so two lines of chrome above them is two lines the user is
     * scanning tiles without. The section is gone, not hidden: its title is now the `Strength` label below,
     * which is what keeps `TAB_TIPS['evo.strength']` from becoming an orphan (`tipcheck` asserts both
     * directions, so a tip with no reader fails exactly as loudly as a `title` with no tip).
     *
     * ⚠️ **TWO AFFORDANCES SHARE ONE ROW NOW, AND THAT IS THE RISK THE LAYOUT HAS TO ANSWER.** `Generate`,
     * `Breed`, `Apply Selected` and `Back` DO something when pressed; `Subtle`/`Medium`/`Wild` SELECT a mode
     * and stay selected. Three things keep them apart: the toggles are pushed to the far end of the row by
     * `margin-left: auto` on the label, they carry a visible `Strength` label the action buttons do not, and
     * the active one is `aria-pressed` + `sl-btn-primary` while the others are plain. **A row of seven
     * identical-looking buttons would have been the wrong way to spend the space saved.**
     *
     * ⚠️ **`flex-wrap` IS LOAD-BEARING AND IT IS ON A TAB-LOCAL CLASS.** The right panel is `1fr` of a
     * two-column layout, i.e. half the viewport, so at a 1000 px window it is ~500 px — about what one label
     * and seven buttons need. Wrapping degrades to two rows there instead of overflowing, which is no worse
     * than what this tab had before. ⚠️ **It is `.sl-evo-controls`, NOT a change to the shared
     * `.sl-btn-group`**, because every other tab uses that class and nobody asked for their rows to wrap.
     */
    const controls = document.createElement('div');
    controls.className = 'sl-btn-group sl-evo-controls';

    const mkBtn = (label: string, cls: string, tip: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.title = tip;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      controls.appendChild(b);
      return b;
    };

    mkBtn('Generate', 'sl-btn-primary', TAB_TIPS['evo.generate']!, () => this.generate());
    mkBtn('Breed', 'sl-btn-primary', TAB_TIPS['evo.breed']!, () => this.breed());
    mkBtn('Apply Selected', 'sl-btn', TAB_TIPS['evo.apply']!, () => this.applySelected());
    this.backBtn = mkBtn('Back', 'sl-btn', TAB_TIPS['evo.back']!, () => this.back());

    // The strength group's label — and the former section title's tooltip, now on its only reader.
    const strengthLabel = document.createElement('span');
    strengthLabel.className = 'sl-evo-strength-label';
    strengthLabel.textContent = 'Strength';
    strengthLabel.title = TAB_TIPS['evo.strength']!;
    controls.appendChild(strengthLabel);

    const tiers: { label: string; value: Intensity; tip: string }[] = [
      { label: 'Subtle', value: 'subtle', tip: TAB_TIPS['evo.subtle']! },
      { label: 'Medium', value: 'medium', tip: TAB_TIPS['evo.medium']! },
      { label: 'Wild', value: 'wild', tip: TAB_TIPS['evo.wild']! },
    ];
    for (const { label, value, tip } of tiers) {
      const btn = document.createElement('button');
      btn.className = 'sl-btn';
      btn.textContent = label;
      btn.title = tip;
      // ⚠️ **NO `flex: 1` ANY MORE.** It was right when the three of them owned a row and would now make
      // them steal width from `Apply Selected`, which is the longest label on the row.
      btn.setAttribute('aria-label', `Mutation strength ${label}`);
      btn.addEventListener('click', () => { this.intensity = value; this.syncStrength(); });
      controls.appendChild(btn);
      this.strengthBtns.set(value, btn);
    }

    el.appendChild(controls);

    // ---- Keep untouched (25.D4) ---------------------------------------------------------------------
    const lockSection = document.createElement('div');
    lockSection.className = 'sl-section';
    const lockTitle = document.createElement('div');
    lockTitle.className = 'sl-section-title';
    lockTitle.textContent = 'Keep untouched';
    lockTitle.title = TAB_TIPS['evo.locks']!;
    lockSection.appendChild(lockTitle);

    const lockRow = document.createElement('div');
    lockRow.className = 'sl-lock-row';
    for (const lock of LOCKS) {
      const chip = document.createElement('span');
      chip.className = 'sl-lock-chip';
      chip.textContent = LOCK_LABELS[lock];
      /**
       * ⚠️ **THE VERB HERE IS BOTH VERBS, AND THAT IS `25.D4` (`P3`'s accepted cost).** One `Set` now has
       * three meanings — freeze (Mixer), exclude from mutation (Randomiser) and **both** (here) — and
       * nothing in the UI says a chip travels between tabs, so the tooltip has to.
       */
      chip.title = `Keep ${LOCK_CATEGORY_TIPS[lock]} exactly as your first pick has it — neither mutated nor `
        + 'inherited from another parent. Shared with the Mixer and Randomise tabs.';
      chip.setAttribute('aria-label', `Keep ${LOCK_LABELS[lock]} untouched`);
      chip.addEventListener('click', () => {
        this.state!.toggleLock(lock);
        this.syncChips();
      });
      lockRow.appendChild(chip);
      this.chipEls.set(lock, chip);
    }
    lockSection.appendChild(lockRow);
    el.appendChild(lockSection);

    // ---- Status row: parent counter + seed note ------------------------------------------------------
    const statusRow = document.createElement('div');
    statusRow.className = 'sl-evo-status';

    this.counterEl = document.createElement('div');
    this.counterEl.className = 'sl-section-title';
    this.counterEl.title = TAB_TIPS['evo.counter']!;
    statusRow.appendChild(this.counterEl);

    /**
     * ⚠️ **RESERVED SPACE, TOGGLED BY `display` — NEVER BY SWAPPING THE TEXT AND NEVER BY A TERNARY.**
     * `INLINE_SINK` matches a literal after `=`, so ternary-assigned copy is invisible to `tipcheck`; and a
     * line that appears from nowhere reflows the panel under the user's cursor. The text is set ONCE here.
     */
    this.seedNoteEl = document.createElement('div');
    this.seedNoteEl.className = 'sl-mix-note';
    this.seedNoteEl.textContent = 'Seed changed — press Generate to refresh';
    this.seedNoteEl.style.display = 'none';
    statusRow.appendChild(this.seedNoteEl);

    el.appendChild(statusRow);

    // ---- Grid ---------------------------------------------------------------------------------------
    const grid = document.createElement('div');
    grid.className = 'sl-evo-grid';

    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = document.createElement('div');
      tile.className = 'sl-evo-tile';
      tile.title = TAB_TIPS['evo.tile']!;

      const canvas = document.createElement('canvas');
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      tile.appendChild(canvas);

      // `★` parent, `◆` carried over. One element holding both marks, so a tile that is both does not need
      // two badges fighting for the same corner.
      const badge = document.createElement('span');
      badge.className = 'sl-evo-badge';
      tile.appendChild(badge);

      this.tileCanvases.push(canvas);
      this.tileElements.push(tile);

      tile.addEventListener('click', () => this.toggleSelection(i));
      grid.appendChild(tile);
    }

    el.appendChild(grid);

    this.syncStrength();
    this.syncChips();
    this.updateTileVisuals();
  }

  /**
   * The selected tier reads as selected. Mirrors the Randomiser's `sl-btn-primary` convention.
   *
   * ⚠️ **`aria-pressed` IS NOT DECORATION HERE — it is the only thing that says "toggle" rather than
   * "button" now that these three share a row with four action buttons.** The colour says which one is
   * active; the attribute says the control is the kind of thing that HAS an active state.
   */
  private syncStrength(): void {
    for (const [tier, btn] of this.strengthBtns) {
      const on = tier === this.intensity;
      btn.className = on ? 'sl-btn-primary' : 'sl-btn';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  private syncChips(): void {
    if (!this.state) return;
    for (const [lock, chip] of this.chipEls) {
      chip.classList.toggle('locked', this.state.isLocked(lock));
    }
  }

  private setSeedNote(on: boolean): void {
    if (this.seedNoteEl) this.seedNoteEl.style.display = on ? '' : 'none';
  }

  /**
   * `25.5` — the parent counter, which replaces defect 6's silence. The fourth click used to be
   * `if (this.selected.size >= 3) return;` with **no feedback of any kind**: the control did the right thing
   * and the output channel could not show it, which is invariant 13's harder half.
   */
  private updateCounter(): void {
    if (!this.counterEl) return;
    const n = this.selected.size;
    this.counterEl.textContent = n >= 3
      ? '3 of 3 — click a selected tile to free a slot'
      : `${n} of 3 parents selected`;
    if (this.backBtn) this.backBtn.disabled = this.previous === null;
  }

  /**
   * ⚠️ **RELEASE-THEN-ACQUIRE ON A STABLE POSITIONAL KEY, AND THAT IS WHAT `P5` ASKS FOR HERE.** `P5` says
   * the `Back` restore must "re-key the existing tile slots, not release and re-acquire them" — and
   * `GridTileRenderer` has **no update verb**: `acquireSlot()` returns early when the key is already active,
   * so changing the preset behind a key requires a release first. What `P5` is protecting against is a slot
   * going away without a replacement, because `MAX_SLOTS` evicts by **LRU with no callback** and an evicted
   * tile has no intersection change left to fire — dead for the life of the tab. The keys here are
   * `evo-0..8`, fixed for the tab's lifetime, so **the key SET never changes and no slot is ever orphaned**.
   * `Back` therefore goes through this one owner rather than inventing a second path.
   */
  private loadGeneration(): void {
    for (let i = 0; i < TILE_COUNT; i++) {
      this.tileRenderer.releaseSlot(slotKey(i));
    }
    for (let i = 0; i < TILE_COUNT; i++) {
      const preset = this.generation[i];
      const canvas = this.tileCanvases[i];
      if (preset && canvas) {
        this.tileRenderer.acquireSlot(slotKey(i), preset, canvas);
      }
    }
  }

  /** Fill the grid with mutations of one seed. `Generate` explores AWAY from what you have. */
  private fillFrom(seed: UnifiedPreset): void {
    this.generation = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      this.generation.push(
        mutatePreset(deepCopy(seed), this.stats, this.intensity, this.state?.categoryLocks ?? new Set()),
      );
    }
    this.selected.clear();
    this.carried.clear();
    this.updateTileVisuals();
    this.loadGeneration();
  }

  private generate(): void {
    if (!this.state?.workingPreset) return;
    this.rememberGeneration();
    this.fillFrom(this.state.workingPreset);
    this.setSeedNote(false);
  }

  /** `25.D7` — one stored generation, captured before anything replaces the grid. */
  private rememberGeneration(): void {
    if (this.generation.length === 0) return;
    this.previous = {
      generation: this.generation.map((p) => deepCopy(p)),
      selected: new Set(this.selected),
      carried: new Set(this.carried),
    };
  }

  private back(): void {
    if (!this.previous) return;
    this.generation = this.previous.generation;
    this.selected = this.previous.selected;
    this.carried = this.previous.carried;
    // One stored generation means `Back` is not a stack: consuming it is what keeps a second `Back` from
    // looking like it failed. `25.D7` declined `Forward` and any depth beyond one.
    this.previous = null;
    this.updateTileVisuals();
    this.loadGeneration();
  }

  private breed(): void {
    if (this.selected.size === 0 || this.generation.length === 0) return;
    // ⚠️ **The parent order is the SLOT order, because `25.D4`'s "first selected tile" must be the lowest
    // selected slot index** — determinate, stable across a Breed, and explainable in one line of UI copy.
    // A `Set`'s iteration order is insertion order, i.e. CLICK order, which is none of those things.
    const indices = [...this.selected].sort((x, y) => x - y);
    const parents: UnifiedPreset[] = [];
    for (const idx of indices) {
      if (this.generation[idx]) parents.push(this.generation[idx]!);
    }
    if (parents.length === 0) return;

    this.rememberGeneration();
    this.generation = breedGeneration(parents, TILE_COUNT, this.stats, {
      intensity: this.intensity,
      locks: this.state?.categoryLocks ?? new Set(),
      carryParents: true,
    });
    // The carry occupies the first `parents.length` slots — `breedGeneration` places them there first.
    this.carried = new Set(parents.map((_, i) => i));
    this.selected.clear();
    this.updateTileVisuals();
    this.loadGeneration();
  }

  private applySelected(): void {
    if (this.selected.size === 0) return;
    const first = [...this.selected].sort((x, y) => x - y)[0]!;
    const preset = this.generation[first];
    if (preset && this.state) {
      this.state.setWorkingPreset(deepCopy(preset), 'evolution-apply');
      // Our own apply is not a stale seed — the grid already shows what the engine now holds.
      this.setSeedNote(false);
    }
  }

  private toggleSelection(index: number): void {
    if (this.selected.has(index)) {
      this.selected.delete(index);
    } else {
      // Still refused at three, but the counter now SAYS so — see `updateCounter()`.
      if (this.selected.size >= 3) { this.updateCounter(); return; }
      this.selected.add(index);
    }
    this.updateTileVisuals();
  }

  private updateTileVisuals(): void {
    for (let i = 0; i < this.tileElements.length; i++) {
      const tile = this.tileElements[i]!;
      const isParent = this.selected.has(i);
      tile.classList.toggle('selected', isParent);
      // At three parents the unselected tiles dim, so the refusal has a visible cause.
      tile.classList.toggle('dimmed', this.selected.size >= 3 && !isParent);
      const badge = tile.querySelector('.sl-evo-badge');
      if (badge) {
        badge.textContent = `${isParent ? '★' : ''}${this.carried.has(i) ? '◆' : ''}`;
      }
    }
    this.updateCounter();
  }

  seedFromExternal(preset: UnifiedPreset): void {
    if (!this.state) return;
    this.rememberGeneration();
    this.fillFrom(preset);
    this.setSeedNote(false);
  }

  activate(): void {
    this.tileRenderer.setActive(true);
    /**
     * ⚠️ **THE COMMENT AND THE CODE DISAGREED HERE UNTIL 2026-10-06 AND `25.D14` MADE THE CODE RIGHT.** It
     * read *"Auto-generate on first entry, or when the working preset has changed since last generation"* —
     * but the test was `this.generation.length === 0` and nothing else, and the tab held **no subscription
     * of any kind**, so a preset loaded anywhere else left nine tiles bred from a seed that was no longer on
     * screen with nothing saying so. The second half of that comment is now a NOTICE (`init()` subscribes),
     * not an auto-regeneration, which is a decision rather than an omission: regenerating would destroy nine
     * tiles the user may be mid-judgement on.
     */
    if (this.generation.length === 0) {
      this.generate();
    }
    this.syncChips();
  }

  deactivate(): void {
    this.tileRenderer.setActive(false);
  }

  /**
   * Regenerate the grid from the entry preset.
   *
   * This tab had NO reset until 2026-08-06 (defect SL5), because `TabModule.reset` was optional. So
   * Reset restored the working preset and the overlays while leaving all 9 tiles animating mutations
   * of the pre-reset preset — the grid contradicted the preview beside it, with nothing to say why.
   *
   * Regenerates rather than merely clearing: the tab auto-generates on entry whenever the grid is
   * empty, so clearing would leave nine blank tiles until the user switched away and back. Mutating
   * from the entry preset is what "return to how this tab looked on entry" actually means here.
   *
   * ⚠️ **Reset clears the stored generation too** — `Back` after a Reset would restore a grid from before
   * the state the user just asked to return to, which is the one thing Reset promises not to do.
   */
  reset(entryPreset: UnifiedPreset): void {
    this.previous = null;
    this.fillFrom(entryPreset);
    this.setSeedNote(false);
  }

  getGeneration(): UnifiedPreset[] {
    return this.generation;
  }

  dispose(): void {
    // Release all slots back to the pool
    for (let i = 0; i < TILE_COUNT; i++) {
      this.tileRenderer.releaseSlot(slotKey(i));
    }
    // Invariant 15: both listeners were held as fields precisely so they could be removed here.
    if (this.state) {
      if (this.onPresetChanged) this.state.off('preset-changed', this.onPresetChanged);
      if (this.onLocksChanged) this.state.off('locks-changed', this.onLocksChanged);
    }
    this.onPresetChanged = null;
    this.onLocksChanged = null;
    this.container = null;
    this.state = null;
    this.tileCanvases = [];
    this.tileElements = [];
    this.strengthBtns.clear();
    this.chipEls.clear();
    this.counterEl = null;
    this.seedNoteEl = null;
    this.backBtn = null;
    this.previous = null;
  }
}
