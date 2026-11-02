import './panel.css';
import { ExplorationState, deepCopy, type TabId } from '../../exploration/state.ts';
import { TabRegistry } from '../../exploration/tab-module.ts';
import type { UnifiedPreset } from '../../presets/types.ts';
import type { PresetStatistics } from '../../exploration/preset-stats.ts';
import { MixerTab } from './tabs/mixer.ts';
import { RandomiserTab } from './tabs/randomiser.ts';
import { SlidersTab } from './tabs/sliders.ts';
import { EvolutionTab } from './tabs/evolution.ts';
import { HistoryTab } from './tabs/history.ts';
import { VisualFxTab, type VisualFxControls } from './tabs/visual-fx.ts';
import { MaterialsTab } from './tabs/materials.ts';
import { ComposerTab } from './tabs/composer.ts';
import { TransMapTab } from './tabs/transmap.ts';
import { ReelTab, type ReelControls } from './tabs/reel.ts';
import { exportPresetJSON, importPresetWithDialog, renamePresetWithDialog } from './export.ts';
import { CHROME_TIPS } from './tooltips.ts';
import type { GridTileRenderer } from '../preview-grid/grid-tile-renderer.ts';
import type { ReelStore } from '../../presets/reel-store.ts';
import type { PresetFilterModel } from '../preview-grid/filter-model.ts';

export interface SynthesisLabConfig {
  canvas: HTMLCanvasElement;
  /** Snapshot at construction — used to build the Mixer's deck dropdowns. Not refreshed after an import. */
  presetNames: string[];
  /** The CURRENT name list, read at call time. Required by the import dialog; see `importPresetWithDialog`. */
  getPresetNames: () => string[];
  getPreset: (name: string) => UnifiedPreset | undefined;
  stats: PresetStatistics;
  onPresetChanged: (preset: UnifiedPreset) => void;
  onImportPreset?: (name: string, preset: UnifiedPreset) => void;
  /**
   * Batch form of `onImportPreset`, for a multi-preset BUNDLE file. ⚠️ Not an optimisation — the
   * per-preset callback re-inits the whole pipeline and navigates on every call. See
   * `importPresetWithDialog`.
   */
  onImportBundle?: (entries: { name: string; preset: UnifiedPreset }[]) => void;
  /**
   * Commit a rename against `PresetManager`, returning the name actually applied — or `null` if the preset is
   * not in the library. `main.ts` owns this because a rename re-keys five name-keyed owners, only one of
   * which this panel can see.
   */
  onRenamePreset?: (from: string, to: string) => string | null;
  onGridClick?: () => void;
  evoTileRenderer: GridTileRenderer;
  historyTileRenderer: GridTileRenderer;
  visualFxControls?: VisualFxControls;
  /**
   * v8 Phase 19 — the Reel tab's three dependencies.
   *
   * ⚠️ **A THIRD door onto the engine, deliberately separate from `visualFxControls`.** Playing a reel switches
   * the preset, goes full screen and drives a transition; none of that is a Visual FX operation, and folding it
   * into that interface would have made every one of its ten existing consumers carry a playback method they
   * have no use for. The three travel together — the tab registers only when all three are present, for
   * `ComposerTab`'s reason (a tab that cannot reach the engine must be ABSENT, not present and inert).
   *
   * ⚠️ `reelTileRenderer` is a THIRD `GridTileRenderer` instance, beside the Evolution and History ones, and
   * it is one instance for BOTH of the Reel tab's panes — see the write-up in `tabs/reel.ts`.
   */
  reelTileRenderer?: GridTileRenderer;
  reelStore?: ReelStore;
  reelControls?: ReelControls;
  /**
   * v8 Phase 22 — the facet filter's shared state and cache, for the Reel tab's preset picker (`22.D3`).
   *
   * ⚠️ **Optional here and required by the preview grid, which is not an inconsistency.** The grid IS the filter's
   * home; the Reel picker borrows it, and `ReelTab` already registers only when its own three dependencies are
   * present. A picker with no model falls back to its pre-Phase-22 name search rather than being absent — the
   * opposite of the `reelControls` rule, because a picker that cannot filter still adds presets to a reel.
   */
  presetFilter?: PresetFilterModel;
}

/**
 * The tabs, in bar order. ⚠️ **Count them — do not trust a number in this comment.**
 *
 * ⚠️ **`composer` WAS LAST BY THE OWNER'S DECISION AND `reel` NOW SITS AFTER IT, ALSO BY THE OWNER'S
 * DECISION.** Both facts are needed: the Composer's own write-ups say the tab must never move off last, and
 * v8 Phase 19 reverses that in the one direction the owner asked for (a reel is assembled from FINISHED
 * presets, so it belongs after everything that makes one). Do not "restore" the Composer to last, and do not
 * read the Reel's position as a violation of the Phase 16 rule.
 *
 * Every addition here is purely additive to the tabs before it: a user's muscle memory for `Visual FX`
 * at position seven is worth more than any argument about subject-matter order. ⚠️ **`transmap` (v8 21.12) is
 * therefore INSERTED between `composer` and `reel` rather than appended**, and it is the first entry to move
 * another tab: the Reel's index shifts by one. That is deliberate and it obeys the rule rather than breaking
 * it — the Reel was itself placed after the Composer because *a reel is assembled from finished presets*, so
 * a tab that authors a preset has to arrive before it or that reason stops being true. Nothing reads a tab's
 * INDEX (`?tab=` carries the id, `openTab()` asks the registry by id), so the shift costs nothing but the
 * Reel's position in the bar.
 *
 * ⚠️ **Spec `00`'s tab-order test DID assert "the Composer is last, Materials before it", and the interesting
 * part is that it was ALREADY WRONG: Phase 19's Reel had moved the tail months earlier and the assertion had
 * never been re-run.** Fixed 2026-09-22 to assert the decided ADJACENCIES by `indexOf` rather than the tail,
 * because the tail is the one part of the list an appended tab always moves — so the form a reader picks to
 * avoid maintenance is the form that needs it. **Read this as a bound on the suite, not on the bar**: the
 * enumeration a tab addition can break lives in `tests/`, `tipcheck`'s `TAB_FILES` and `TAB_TIPS`, and only
 * the first of those has to be RUN to say anything.
 *
 * `hint` is the button's hover tooltip and is REQUIRED, not optional: the tab bar is the most-hovered row in
 * the panel and it is where a user decides which tab holds what they want, so a tab with no hint is
 * the one place the tooltip pass could not afford a gap. The text lives beside the label rather than in
 * `tooltips.ts` because `TAB_DEFS` is already the tab bar's single descriptor table, and a second copy there
 * would be invariant 17's shape. `CHROME_TIPS` covers the HEADER BUTTONS above, which have no table of their
 * own to hang a field on.
 */
/*
 * ⚠️ **THE ORDER OF THIS ARRAY IS THE TAB BAR'S ORDER AND IT IS AN OWNER DECISION — REORDERED 2026-10-05**
 * (owner: *"we want the tabs shown with the 'Lab' button to be reshuffled in the following order: Reel,
 * Visual Fx, Materials, Composer, Transmap, Sliders, Mixer, Randomise, Evolution, History"*). The grouping it
 * expresses is **presentation first, then authoring, then exploration**: the Reel and the rendering tabs lead,
 * the figure and the field follow, and the four tabs that generate or recall whole presets trail.
 *
 * ⚠️ **THIS REVERSES PHASE 19's "the Reel is the LAST tab", WHICH ITSELF REVERSED PHASE 16's "never move the
 * Composer off LAST".** Both were the owner's call and so is this; the reasoning each time was about which tab
 * should be the *destination* of a session, and the Reel has now become its starting point instead. **Do not
 * "restore" either earlier order from a comment, a doc or a spec that still argues for it** — `CLAUDE.md`'s
 * *Phase 19* block and `tests/00-harness-smoke.spec.ts` were both updated on 2026-10-05 and are the live word.
 *
 * ⚠️ **THE LAB OPENS ON THIS ARRAY'S FIRST ENTRY — owner decision, 2026-10-05, in the same breath as the
 * order itself** (*"when the 'Lab' button is pressed, it should show the first tab by default, which is
 * 'Reels'"*). **So the order is NOT cosmetic: moving an entry to the front changes the default tab.** Until
 * 2026-10-05 both sites hardcoded `'mixer'` while the call site's comment read `// Show first tab` — true only
 * because Mixer happened to be first, and the reorder is what exposed it. **The two sites now read
 * `TAB_DEFS[0].id`, and the array is typed as a NON-EMPTY TUPLE so that stays a compile-time fact.**
 *
 * ⚠️ **But the opening switch resolves to the first entry WITH A MODULE, not blindly to `TAB_DEFS[0]`.** The
 * Reel registers inside a guard of its own, so a host that supplies no `reelStore`/`reelTileRenderer`/
 * `reelControls` shows a Reel button with nothing behind it; opening there would leave an empty container and
 * an `.active` button, which is exactly the failure `openTab`'s membership rule exists for. **`getTab()` is
 * the membership test, never `TAB_DEFS`.** `?tab=<TabId>` (20.8a) overrides the default either way.
 *
 * ⚠️ **NOTHING HERE CONSTRAINS REGISTRATION ORDER, AND `registerTabs()` IS DELIBERATELY NOT REORDERED TO
 * MATCH.** Visual FX, Materials, the Composer and the Transmap register inside `if (this.config
 * .visualFxControls)` and the Reel inside a guard of its own, so registration is grouped BY GUARD while the
 * bar is ordered by decision. **The bar can therefore show more tabs than the registry holds, and a button
 * that does nothing is a REGISTRY question before it is an order question.**
 */
type TabDef = { id: TabId; label: string; hint: string };

// ⚠️ **A NON-EMPTY TUPLE, not `TabDef[]`** — `noUncheckedIndexedAccess` is on, so this is what makes
// `TAB_DEFS[0].id` a fact rather than a `?? fallback`, and it turns an accidentally emptied array into a
// compile error instead of a Lab with no tabs and no default.
const TAB_DEFS: [TabDef, ...TabDef[]] = [
  { id: 'reel', label: 'Reel', hint: 'Assemble presets into a reel that plays by itself, full screen — pick them, order them, choose how long each one runs and how it hands over to the next.' },
  { id: 'visual-fx', label: 'Visual FX', hint: 'The full rendering pipeline — framing, ribbons, film look, attractors, image warps. Changes are live and are only saved by Export or Snapshot.' },
  { id: 'materials', label: 'Materials', hint: 'Give particles physical behaviour: heat, buoyancy, sparks and crystals.' },
  { id: 'composer', label: 'Composer', hint: 'The figure itself — the three stacked sine waves every preset is built from. Winding, size, phase, and the harmonic stack between them. Everything else in the Lab decorates what you set here.' },
  { id: 'transmap', label: 'Transmap', hint: 'The image-domain field the whole frame is sampled through: the wave terms it is built from, the pattern that can replace them, and a measurement of how big the warp actually is.' },
  { id: 'sliders', label: 'Sliders', hint: 'Fourteen high-level qualities in three groups — Figure, Grade, Physics — as relative multipliers on the preset’s own values, leaving the wave mathematics alone. A row that cannot reach anything on this preset is disabled and says why.' },
  { id: 'mixer', label: 'Mixer', hint: 'Blend two presets with a crossfader, freezing individual aspects with category locks.' },
  { id: 'randomiser', label: 'Randomise', hint: 'Mutate the current preset at three intensities, with Back / Forward through the results.' },
  { id: 'evolution', label: 'Evolution', hint: 'Breed presets: generate nine live mutations, pick parents, and cross them into a new generation.' },
  { id: 'history', label: 'History', hint: 'Every preset saved with Snapshot, as live tiles. Click one to restore it.' },
];

/**
 * Runtime membership test for a `TabId`, for `?tab=<TabId>` (v8 Phase 20.8a) — a URL carries a string, and
 * `TabId` is a type that erases.
 *
 * ⚠️ **`TAB_DEFS` is the basis and it is checked in ONE direction only.** Every entry is `TabId`-typed, so a
 * misspelling here is a compile error; a `TabId` member that never reaches `TAB_DEFS` is invisible to `tsc`
 * (the dispatch is a `Map`) and `tipcheck`'s `TAB_FILES` is the only thing that catches it. So this answers
 * "is it a spelling the tab bar knows", never "does a module exist for it" — `openTab()` asks the registry for
 * that, and the two questions have different answers whenever a registration guard is false.
 */
export function isTabId(value: string): value is TabId {
  return TAB_DEFS.some((def) => def.id === value);
}

export class SynthesisLabPanel {
  private container: HTMLElement | null = null;
  private tabBar: HTMLElement | null = null;
  private tabContent: HTMLElement | null = null;
  private state: ExplorationState;
  private registry: TabRegistry | null = null;
  private visible = false;
  private config: SynthesisLabConfig;

  // The preset that was active when the Lab was last opened (or when the tab changed).
  // Reset restores each tab to this snapshot.
  private tabEntryPresets: Map<TabId, UnifiedPreset> = new Map();
  // ⚠️ **`TAB_DEFS[0].id`, not a literal** — the default tab follows the bar's order by owner decision
  // (2026-10-05); see `TAB_DEFS`' header. This initialiser is read by `resetCurrentTab()`, `showInPanel()`
  // and `getSnapshot()` before any switch happens, so a literal here would disagree with the opening switch
  // for one window and nothing would say so.
  private activeTabId: TabId = TAB_DEFS[0].id;

  constructor(config: SynthesisLabConfig) {
    this.config = config;
    this.state = new ExplorationState();

    this.state.on('preset-changed', (preset) => {
      config.onPresetChanged(preset as UnifiedPreset);
    });
  }

  getState(): ExplorationState {
    return this.state;
  }

  private parentElement: HTMLElement | null = null;

  init(initialPreset: UnifiedPreset, parent?: HTMLElement): void {
    this.parentElement = parent ?? null;
    this.state.workingPreset = deepCopy(initialPreset);
    this.buildDOM();
    this.registerTabs();
  }

  private buildDOM(): void {
    this.container = document.createElement('div');
    this.container.className = 'synthesis-lab';

    // Header
    const header = document.createElement('div');
    header.className = 'sl-header';
    const title = document.createElement('span');
    title.className = 'sl-title';
    title.textContent = 'Synthesis Lab';
    header.appendChild(title);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'sl-btn sl-btn-reset';
    resetBtn.textContent = 'Reset';
    resetBtn.title = CHROME_TIPS.reset;
    resetBtn.addEventListener('click', () => this.resetCurrentTab());
    header.appendChild(resetBtn);

    const snapshotBtn = document.createElement('button');
    snapshotBtn.className = 'sl-btn sl-btn-snapshot';
    snapshotBtn.textContent = 'Snapshot';
    snapshotBtn.title = CHROME_TIPS.snapshot;
    snapshotBtn.addEventListener('click', () => {
      /*
       * The label is `<preset name> <HH:MM:SS>` (owner, 2026-10-11). It was the bare
       * `toLocaleTimeString()`, so the History tab's tile captions read `14:32:07` — a list of times with
       * nothing saying WHICH preset each tile was a snapshot OF, while every other tile grid in the UI
       * captions its tiles by name.
       *
       * ⚠️ **The name is read from the preset, not from a UI field**, so it is the name the snapshot was
       * taken from even if the dropdown has moved on since. ⚠️ **And the TIME is kept rather than
       * replaced**: it is the only thing that separates two snapshots of one preset, which is the normal
       * case — the Snapshot button exists to compare successive edits of the SAME figure.
       *
       * `entry.timestamp` also holds the time as a number, and composing the label here rather than
       * formatting that at the tile is deliberate: `HistoryEntry.label` is the snapshot's NAME, one
       * string, and the Sliders tab's `Sliders baked` label is a second caller that means something else
       * by it. Two formatters for one caption is how the two drift apart.
       */
      const name = this.state.workingPreset?.metadata.name || '(unnamed)';
      const label = `${name} ${new Date().toLocaleTimeString()}`;
      if (this.state.workingPreset && this.config.visualFxControls) {
        const copy = deepCopy(this.state.workingPreset);
        copy.overlay = this.config.visualFxControls.getSnapshot();
        this.state.pushSnapshot(label, copy);
      } else {
        this.state.pushSnapshot(label);
      }
    });
    header.appendChild(snapshotBtn);

    // Only built when a rename handler exists — a Rename button that cannot re-key the five name-keyed
    // owners would be invariant 13's shape (a control that no longer moves what it names).
    if (this.config.onRenamePreset) {
      const renameBtn = document.createElement('button');
      renameBtn.className = 'sl-btn sl-btn-rename';
      renameBtn.textContent = 'Rename';
      renameBtn.title = CHROME_TIPS.rename;
      renameBtn.addEventListener('click', () => this.renameCurrentPreset());
      header.appendChild(renameBtn);
    }

    const exportBtn = document.createElement('button');
    exportBtn.className = 'sl-btn sl-btn-export';
    exportBtn.textContent = 'Export';
    exportBtn.title = CHROME_TIPS.export;
    exportBtn.addEventListener('click', () => this.exportPreset());
    header.appendChild(exportBtn);

    const importBtn = document.createElement('button');
    importBtn.className = 'sl-btn sl-btn-import';
    importBtn.textContent = 'Import';
    // Accepts a bundle as well as a single preset — see `isPresetBundle`, and note that until 2026-08-25
    // an `Export All` file fed back in here silently produced one nonsense preset out of all of them.
    importBtn.title = CHROME_TIPS.import;
    importBtn.addEventListener('click', () => this.importPreset());
    header.appendChild(importBtn);

    if (this.config.onGridClick) {
      const gridBtn = document.createElement('button');
      gridBtn.className = 'sl-btn sl-btn-grid';
      gridBtn.textContent = 'Grid';
      gridBtn.title = CHROME_TIPS.grid;
      gridBtn.addEventListener('click', () => this.config.onGridClick!());
      header.appendChild(gridBtn);
    }

    this.container.appendChild(header);

    // Tab bar
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'sl-tab-bar';
    for (const def of TAB_DEFS) {
      const btn = document.createElement('button');
      btn.className = 'sl-tab-btn';
      btn.dataset.tab = def.id;
      btn.textContent = def.label;
      btn.title = def.hint;
      btn.addEventListener('click', () => this.switchTab(def.id));
      this.tabBar.appendChild(btn);
    }
    this.container.appendChild(this.tabBar);

    // Tab content area
    this.tabContent = document.createElement('div');
    this.tabContent.className = 'sl-tab-content';
    this.container.appendChild(this.tabContent);

    const target = this.parentElement ?? document.body;
    target.appendChild(this.container);
  }

  private evolutionTab: EvolutionTab | null = null;

  private registerTabs(): void {
    if (!this.tabContent) return;
    this.registry = new TabRegistry(this.tabContent, this.state);

    const { presetNames, getPreset, stats } = this.config;

    const sendToEvolution = () => {
      if (this.state.workingPreset && this.evolutionTab) {
        this.switchTab('evolution');
        this.evolutionTab.seedFromExternal(this.state.workingPreset);
      }
    };

    /*
     * ⚠️ **THE FOURTH ARGUMENT IS 23.D5 AND IT IS OPTIONAL WHILE THIS REGISTRATION IS UNCONDITIONAL** — the
     * Mixer, unlike the Composer below, has nothing it needs the engine door for except this one read, so it
     * must register with `visualFxControls` absent and degrade to the working preset rather than vanish.
     * A category lock captures the LIVE overlay (the same read Export and Snapshot do above), because the
     * working preset is only what the Mixer last published: a Visual FX edit made since the blend lives in the
     * engine, and locking `visual` off the stale copy silently discarded it.
     */
    const vfx = this.config.visualFxControls;
    this.registry.register(new MixerTab(
      presetNames, getPreset, sendToEvolution, vfx ? () => vfx.getSnapshot() : undefined));
    this.registry.register(new RandomiserTab(stats, sendToEvolution));
    // v8 26.8 — the strip is applied ENGINE-side, so the tab is handed the host's setter rather than
    // reaching for it: a panel built without `visualFxControls` then simply has no toggle, instead of a
    // dead one. ⚠️ The call is bound here and not stored by the tab as a reference to `this.config`,
    // because the tab must not learn the shape of the host's control object.
    const slidersTab = new SlidersTab(stats);
    const stripHost = this.config.visualFxControls;
    if (stripHost) slidersTab.setStripControl((on) => stripHost.setStripToFigure(on));
    this.registry.register(slidersTab);
    this.evolutionTab = new EvolutionTab(stats, this.config.evoTileRenderer);
    this.registry.register(this.evolutionTab);
    this.registry.register(new HistoryTab(this.config.historyTileRenderer));

    if (this.config.visualFxControls) {
      this.registry.register(new VisualFxTab(this.config.visualFxControls));
      this.registry.register(new MaterialsTab(this.config.visualFxControls));
      // ⚠️ **INSIDE THIS GUARD, and that is not a stylistic choice: `visualFxControls` is OPTIONAL, and it is
      // the ONE door onto the engine.** `ComposerTab` cannot exist without `getWaves`/`setWaves`, so with the
      // config absent the tab must be absent too — not present and inert, which would be invariant 13 with a
      // whole tab as the dead control. ⚠️ **This also means the tab bar can show more buttons than the registry
      // holds**, and `TabRegistry.show()` iterates the registry, so an unregistered id shows an empty
      // container. That predates the Composer (Visual FX and Materials have the same shape) and is left alone.
      // ⚠️ **The two figures here read NINE and six until 2026-10-05; both were stale and the ratio is the
      // finding, so they are now named rather than counted.** Count `TAB_DEFS` for the bar and the
      // `register(` calls for the floor — a figure in a comment is the one thing no checker re-measures.
      this.registry.register(new ComposerTab(this.config.visualFxControls));
      // ⚠️ **The SAME guard as the Composer's, and for a stronger reason than sharing a config object:** every
      // one of this tab's controls is a read-modify-write through `getTransMapChain`/`setTransMapChain` and
      // `set/getTransMapWaveTables`, so with the config absent there is nothing for it to edit AND nothing to
      // measure — its readout would print a peak for a field no pass resolves. Registered here rather than in
      // a guard of its own (the Reel's shape) because it has no second dependency to test: one door, one guard.
      this.registry.register(new TransMapTab(this.config.visualFxControls));
    }

    // ⚠️ Its OWN guard, not the Visual FX one: the Reel tab's door is `reelControls` and the two configs are
    // independent, so nesting this inside the block above would make a reel-capable host without Visual FX
    // silently lose the tab. All three dependencies are tested because each is separately optional and a
    // missing one would fail at the first tile rather than at registration.
    if (this.config.reelStore && this.config.reelTileRenderer && this.config.reelControls) {
      this.registry.register(new ReelTab(
        this.config.reelStore,
        this.config.reelTileRenderer,
        this.config.getPresetNames,
        getPreset,
        this.config.reelControls,
        // ⚠️ The SHARED model, so a chip ticked in the picker moves the preview grid too (`22.D3`). Passed
        // through rather than built here: this panel is not the filter's owner either — see `main.ts`.
        this.config.presetFilter ?? null,
      ));
    }

    // Show the first tab in `TAB_DEFS`' order — the owner's default-tab decision of 2026-10-05, which is why
    // this reads the table rather than naming a tab. ⚠️ **The first entry WITH A MODULE**: `getTab()` is the
    // membership test and `TAB_DEFS` would answer for a tab that never registered (`openTab`'s rule, and the
    // reason the Reel — now first — is the one default that could ever be unavailable). The `??` arm is
    // unreachable today because five tabs above register unconditionally; it is here so that stays true by
    // construction rather than by reading the registrations.
    this.switchTab(TAB_DEFS.find((def) => this.registry?.getTab(def.id))?.id ?? TAB_DEFS[0].id);
  }

  private switchTab(id: TabId): void {
    if (!this.registry || !this.tabBar) return;

    // Capture a fresh tab-entry preset for the tab we're switching TO,
    // so Reset can return to the state when this tab was most recently entered.
    if (this.state.workingPreset) {
      this.tabEntryPresets.set(id, deepCopy(this.state.workingPreset));
    }
    this.activeTabId = id;

    this.registry.show(id);

    for (const btn of this.tabBar.querySelectorAll('.sl-tab-btn')) {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.tab === id);
    }
  }

  private resetCurrentTab(): void {
    const entryPreset = this.tabEntryPresets.get(this.activeTabId);
    if (!entryPreset) return;

    // Restore the working preset to what it was when this tab was entered.
    this.state.setWorkingPreset(deepCopy(entryPreset), 'reset');

    // Reset all visual overlay state to match the entry preset (or defaults if no overlay).
    this.config.visualFxControls?.resetOverlays(deepCopy(entryPreset));

    // Let the active tab restore its own internal state too. `reset` is REQUIRED on TabModule as of
    // 2026-08-06, so the only optional link left is the registry itself.
    const tab = this.registry?.getTab(this.activeTabId);
    tab?.reset(deepCopy(entryPreset));
  }

  showInPanel(): void {
    this.visible = true;
    if (this.container) {
      this.container.style.display = 'flex';
    }
    // Re-activate the tab that `hideInPanel` suspended. See the comment there.
    this.registry?.resume();
    // Capture entry preset for the current tab whenever the Lab becomes visible.
    if (this.state.workingPreset) {
      this.tabEntryPresets.set(this.activeTabId, deepCopy(this.state.workingPreset));
    }
  }

  /**
   * Hide the Lab and SUSPEND the shown tab.
   *
   * ⚠️ The `suspend()` call is load-bearing, not tidiness. `display: none` stops the tab being seen; it
   * does not stop the tab doing work, because a tab's per-frame cost lives in objects the render loop
   * drives directly. Without it, one visit to Evolution or History left that tab's `GridTileRenderer`
   * active for the rest of the session, and switching to Grid mode then ran two — or after visiting both
   * tabs, three — tile renderers concurrently, each with a 4 + 12 + 10 ms budget against a 16.7 ms
   * frame. `MaterialsTab` likewise left a 250 ms interval polling into an invisible DOM node.
   */
  hideInPanel(): void {
    this.visible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.registry?.suspend();
  }

  toggle(): void {
    if (this.visible) {
      this.hideInPanel();
    } else {
      this.showInPanel();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Open a named tab from outside the panel — the entry point `?tab=<TabId>` needs (v8 Phase 20.8a).
   *
   * Returns whether the tab was opened. ⚠️ **The membership test is the REGISTRY, never `TAB_DEFS`**: three
   * tabs register only inside `if (this.config.visualFxControls)` and the Reel inside a guard of its own, so
   * the bar can show more tabs than the registry holds, and `TAB_DEFS` would answer `true` for a tab that has
   * no module to show. `getTab()` asks the one structure that knows.
   *
   * ⚠️ **It goes through `switchTab`, the same path a tab-bar click takes** — that is the whole reason this
   * method exists rather than the host clicking a button through `ExecuteScriptAsync`. `TabRegistry` builds a
   * tab's container on FIRST SHOW, so `[data-tab="reel"]` matches nothing until the tab has been opened (a
   * Phase 17 rule), and a click by position is the brittleness the "select on the `aria-label`, never on
   * position" habit exists to prevent. The tab-entry preset, the button's `active` class and the registry's
   * suspend/resume bookkeeping all come along for free precisely because nothing here is re-implemented.
   *
   * ⚠️ **It does NOT make the Lab visible** — the caller owns the panel mode (`setPanelMode('lab')`), and
   * `showInPanel()` is what resumes the tab. Opening a tab inside a hidden panel is legitimate: the Grid and
   * the Lab are mutually exclusive views of one panel, so a caller may want the tab prepared first.
   */
  openTab(id: TabId): boolean {
    if (!this.registry?.getTab(id)) return false;
    this.switchTab(id);
    return true;
  }

  private exportPreset(): void {
    const preset = this.state.workingPreset;
    if (!preset) return;
    const copy = deepCopy(preset);
    if (this.config.visualFxControls) {
      copy.overlay = this.config.visualFxControls.getSnapshot();
    }
    exportPresetJSON(copy);
  }

  /**
   * Rename the preset currently loaded in the Lab.
   *
   * ⚠️ **The name comes from `state.workingPreset.metadata.name`, which is the Lab's own copy.** It agrees
   * with `main.ts`'s active preset name in normal use, but the rename is applied by `main.ts` against
   * `PresetManager` — so if the Lab is showing an edited or mixed preset that is not in the library, the
   * handler returns `null` and nothing happens. That is the honest outcome: there is no library entry to
   * rename, and inventing one would make Rename a covert "save as".
   */
  private renameCurrentPreset(): void {
    const { getPresetNames, onRenamePreset } = this.config;
    const current = this.state.workingPreset?.metadata.name;
    if (!current || !onRenamePreset) return;
    // ⚠️ `getPresetNames`, not `presetNames` — same construction-time-snapshot trap as `importPreset`.
    renamePresetWithDialog(current, getPresetNames, (newName) => {
      const applied = onRenamePreset(current, newName);
      if (applied === null) {
        alert(`"${current}" is not a saved preset, so it cannot be renamed.\n\nExport it, or snapshot it to History, first.`);
      }
    });
  }

  private importPreset(): void {
    const { getPresetNames, onImportPreset, onImportBundle } = this.config;
    // ⚠️ `getPresetNames`, not `presetNames`. This panel's `presetNames` is a snapshot taken at construction
    // and nothing ever refreshes it, so it was still 177 entries after an import — which is exactly how the
    // same name got accepted twice. See `importPresetWithDialog`.
    importPresetWithDialog(
      getPresetNames,
      (name, preset) => { onImportPreset?.(name, preset); },
      onImportBundle,
    );
  }

  dispose(): void {
    this.registry?.dispose();
    this.container?.remove();
  }
}
