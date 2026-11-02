import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId, CategoryLock } from '../../../exploration/state.ts';
import type { OverlayState, UnifiedPreset } from '../../../presets/types.ts';
import type { MixWeights } from '../../../exploration/overlay-rules.ts';
import { interpolatePreset } from '../../../exploration/interpolate.ts';
import { CATEGORY_LOCKS } from '../../../exploration/overlay-rules.ts';
import { deepCopy } from '../../../exploration/state.ts';
import { TAB_TIPS, LOCK_CATEGORY_TIPS } from '../tooltips.ts';

/**
 * v8 Phase 23.5 — one row per category, **built from `CATEGORY_LOCKS` and never hand-written six** (23.D4).
 *
 * ⚠️ **THE WHOLE POINT OF READING THE SHARED ARRAY WAS THE SEVENTH MEMBER, AND IT ARRIVED ON 2026-10-05.**
 * `24.D3` added `'material'` to `CategoryLock`; with a literal list here that member would have got a rule in
 * `OVERLAY_RULES` (which `tsc` enforces) and **no fader and no lock in the UI** (which nothing enforces) — a
 * category that crossfades but cannot be held, with no compile error and no checker to say so. **This file
 * was not edited for it: the row appeared.** The prediction is left standing as the record of a mechanism
 * that worked, which is rarer in this tree than a record of one that did not.
 */
const LOCKS: readonly CategoryLock[] = CATEGORY_LOCKS;

/** Per-category row state. Both maps are keyed by `CategoryLock` and survive a `render()`. */
interface CategoryRow {
  follow: boolean;
  /** 0..100, the row's own slider position. Only read while `follow` is false. */
  value: number;
  slider: HTMLInputElement | null;
  followBox: HTMLInputElement | null;
  lockBtn: HTMLElement | null;
  readout: HTMLElement | null;
}

export class MixerTab implements TabModule {
  readonly id: TabId = 'mixer';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private presetNames: string[];
  private getPreset: (name: string) => UnifiedPreset | undefined;
  private crossfader: HTMLInputElement | null = null;
  private deckASelect: HTMLSelectElement | null = null;
  private sendToEvolution: (() => void) | null;
  /**
   * The LIVE overlay, as the engine is rendering it this instant — `visualFxControls.getSnapshot()`, wired
   * through `panel.ts`.
   *
   * ⚠️ **23.D5: A LOCK MUST CAPTURE THIS AND NOT `state.workingPreset`.** The working preset is the last
   * thing the Mixer *published*; every Visual FX edit since then lives in the engine and not in it. Locking
   * `visual` off the working preset therefore froze the category at a value the user could no longer see on
   * screen — the lock appeared to discard their edits, which is the one thing a lock exists not to do.
   * `panel.ts`'s Export and Snapshot handlers resolve it exactly this way.
   *
   * ⚠️ **OPTIONAL, because `visualFxControls` is optional while this tab registers UNCONDITIONALLY.** With it
   * absent the fallback is the working preset, which is what the tab did before 23.5 — a stated degradation,
   * not a silent one.
   */
  private getLiveOverlay: (() => OverlayState) | null;
  private rows: Map<CategoryLock, CategoryRow> = new Map(
    LOCKS.map((l) => [l, { follow: true, value: 0, slider: null, followBox: null, lockBtn: null, readout: null }]));

  constructor(
    presetNames: string[],
    getPreset: (name: string) => UnifiedPreset | undefined,
    sendToEvolution?: () => void,
    getLiveOverlay?: () => OverlayState,
  ) {
    this.presetNames = presetNames;
    this.getPreset = getPreset;
    this.sendToEvolution = sendToEvolution ?? null;
    this.getLiveOverlay = getLiveOverlay ?? null;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.render();
  }

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Blend two presets with the crossfader — Deck A at the left, Deck B at the right. '
      + 'Hover any control for what it does.';
    el.appendChild(desc);

    // Determine active preset name
    const activeName = this.state?.workingPreset?.metadata.name ?? '';

    // Deck A — pre-select the active preset
    const { section: deckASection, select: deckASelect } = this.createDeckSection('A', (name) => {
      const preset = this.getPreset(name);
      if (preset && this.state) {
        this.state.deckA = deepCopy(preset);
        this.applyCrossfade();
      }
    }, activeName);
    this.deckASelect = deckASelect;
    el.appendChild(deckASection);

    // Initialize deckA state to the active preset
    if (activeName && this.state) {
      const active = this.getPreset(activeName);
      if (active) this.state.deckA = deepCopy(active);
    }

    // Deck B
    const { section: deckBSection } = this.createDeckSection('B', (name) => {
      const preset = this.getPreset(name);
      if (preset && this.state) {
        this.state.deckB = deepCopy(preset);
        this.applyCrossfade();
      }
    });
    el.appendChild(deckBSection);

    // Crossfader
    const faderSection = document.createElement('div');
    faderSection.className = 'sl-section';
    const faderTitle = document.createElement('div');
    faderTitle.className = 'sl-section-title';
    faderTitle.textContent = 'Crossfader';
    faderTitle.title = TAB_TIPS['mixer.crossfader']!;
    faderSection.appendChild(faderTitle);

    const faderRow = document.createElement('div');
    faderRow.className = 'sl-slider-row';
    faderRow.title = TAB_TIPS['mixer.crossfader']!;
    const labelA = document.createElement('span');
    labelA.textContent = 'A';
    labelA.style.color = '#7ec8e3';
    faderRow.appendChild(labelA);

    this.crossfader = document.createElement('input');
    this.crossfader.type = 'range';
    this.crossfader.className = 'sl-slider';
    this.crossfader.min = '0';
    this.crossfader.max = '100';
    this.crossfader.value = '0';
    this.crossfader.title = TAB_TIPS['mixer.crossfader']!;
    this.crossfader.setAttribute('aria-label', 'Master crossfader');
    // Mirror the master into every FOLLOWING row before blending, so the per-category sliders are a readout of
    // where their category actually sits. A follower whose slider stayed at 0 while the blend moved would be
    // invariant 13's harder half: the control moves the right thing and reads inert.
    this.crossfader.addEventListener('input', () => { this.syncFollowers(); this.applyCrossfade(); });
    faderRow.appendChild(this.crossfader);

    const labelB = document.createElement('span');
    labelB.textContent = 'B';
    labelB.style.color = '#e37e7e';
    faderRow.appendChild(labelB);
    faderSection.appendChild(faderRow);
    el.appendChild(faderSection);

    /*
     * Categories — ONE row per `CategoryLock`, carrying that category's lock, its `follow master` box and its
     * own fader.
     *
     * ⚠️ **THE SECTION WAS TITLED `Category Locks` UNTIL 23.5 (2026-10-05) and held the chips alone.** The
     * faders joined the chips rather than forming a seventh section because the two answer the same question
     * about the same six things — "where is this category, and may the crossfader move it" — and a user who
     * had to pair a chip in one section with a slider in another would be doing the pairing the DOM should do.
     * Specs `04` and `05` quote the old title in PROSE (in a dated count of the Mixer's four sections, which is
     * still four); neither asserts it.
     */
    const catSection = document.createElement('div');
    catSection.className = 'sl-section';
    const catTitle = document.createElement('div');
    catTitle.className = 'sl-section-title';
    catTitle.textContent = 'Categories';
    catTitle.title = TAB_TIPS['mixer.categoryLocks']!;
    catSection.appendChild(catTitle);

    for (const lock of LOCKS) {
      catSection.appendChild(this.createCategoryRow(lock));
    }
    catSection.appendChild(this.createCategoryNote());
    el.appendChild(catSection);

    this.addSendToEvoButton(el);
    this.syncFollowers();
  }

  /**
   * One category's row: `[lock chip] [follow] [fader] [readout]`.
   *
   * The chip is both the lock and the row's label, so the category is named exactly once.
   */
  private createCategoryRow(lock: CategoryLock): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-slider-row';
    const entry = this.rows.get(lock)!;

    const chip = document.createElement('span');
    chip.className = `sl-lock-chip sl-mix-cat-chip${this.state!.isLocked(lock) ? ' locked' : ''}`;
    chip.textContent = lock;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `Lock ${lock} category`);
    // The lock's SCOPE comes from the shared table; the verb is this tab's own — the Randomiser excludes
    // the category from mutation instead, so a shared sentence would be wrong in one of the two tabs.
    chip.title = `Freeze ${LOCK_CATEGORY_TIPS[lock]} at its current blended value while the faders move.`;
    chip.addEventListener('click', () => {
      if (this.state!.isLocked(lock)) {
        this.state!.unlockCategory(lock);
      } else {
        const snap = this.captureLive();
        if (!snap) return;   // nothing on the decks yet — a lock with no snapshot would hold nothing
        this.state!.lockWithSnapshot(lock, snap);
      }
      chip.classList.toggle('locked', this.state!.isLocked(lock));
      this.syncFollowers();
      this.applyCrossfade();
    });
    entry.lockBtn = chip;
    row.appendChild(chip);

    const followLabel = document.createElement('label');
    followLabel.className = 'sl-mix-follow';
    followLabel.title = TAB_TIPS['mixer.followMaster']!;
    const followBox = document.createElement('input');
    followBox.type = 'checkbox';
    followBox.checked = entry.follow;
    followBox.setAttribute('aria-label', `${lock} follows master crossfader`);
    followBox.addEventListener('change', () => {
      entry.follow = followBox.checked;
      // Adopting the master's position on UNTICK is what makes the hand-off continuous: the category is
      // already there, so the first thing the new fader does is nothing. Taking the row's last independent
      // value instead would jump the blend on a click that only asked for a control.
      if (!entry.follow) entry.value = parseInt(this.crossfader!.value);
      this.syncFollowers();
      this.applyCrossfade();
    });
    entry.followBox = followBox;
    followLabel.appendChild(followBox);
    followLabel.appendChild(document.createTextNode('follow'));
    row.appendChild(followLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sl-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(entry.value);
    slider.title = TAB_TIPS['mixer.categoryFader']!;
    slider.setAttribute('aria-label', `${lock} blend`);
    slider.addEventListener('input', () => {
      entry.value = parseInt(slider.value);
      this.syncFollowers();
      this.applyCrossfade();
    });
    entry.slider = slider;
    row.appendChild(slider);

    const readout = document.createElement('span');
    readout.className = 'sl-slider-value';
    row.appendChild(readout);
    entry.readout = readout;

    return row;
  }

  /**
   * The line under the rows that says where the **catch-all** is, because no fader's own name can.
   *
   * ⚠️ **RENAMED FROM `createZeroKeyNote` ON 2026-10-05 (24.2), BECAUSE ITS SUBJECT CEASED TO EXIST.** The
   * note was written at 23.6 to confess that **three of the six categories owned no `overlay` key at all** —
   * the census then was `shape 0, color 0, motion 0, transmap 14, attractor 2, visual 30`, and a user reading
   * "colour" while the grade followed the master anyway needed the line said out loud. `24.1` moved nine keys
   * and added a seventh category, so the census is now **`shape 2, color 5, motion 1, transmap 14,
   * attractor 2, material 1, visual 21`** (dated 2026-10-05; count it from `OVERLAY_RULES`, never from this
   * sentence) and **every category owns at least one key.** The old name would now be describing an empty
   * set, which is the worst kind of stale comment: one that still parses.
   *
   * ⚠️ **THE NOTE SURVIVES THE REBASE BECAUSE THE REAL ASYMMETRY SURVIVED IT.** `visual` still holds 21 of
   * the 46 keys and is the only group whose name does not predict its contents — it is where every field
   * system, every renderer scalar and the symmetry fold live. A fader that holds nearly half the keys needs
   * saying; the other six now say themselves.
   *
   * It is set ONCE with no ternary: `tipcheck`'s `INLINE_SINK` matches a literal after `=`, so copy assembled
   * conditionally would be invisible to it. ⚠️ **The class stays `sl-mix-note`** — `panel.css` owns it and
   * `mixercheck` §G asserts this function and that class together.
   */
  private createCategoryNote(): HTMLElement {
    const note = document.createElement('div');
    note.className = 'sl-mix-note';
    /*
     * ⚠️ **TWO EARLIER WORDINGS ARE RETIRED HERE AND BOTH WERE WRONG IN THE SAME DIRECTION** — they told the
     * user that a fader reached LESS than it does. "the generator and renderer settings only" named the wrong
     * fader outright (every `renderer` field the blend moves is in `visual`), and the sentence that replaced
     * it on the same day — *"The shape, colour and motion faders move the figure itself only"* — was true for
     * about six hours: `figureScale`, `particleSize`, the palette pair, the grade and `speedFactor` now answer
     * to exactly those three. **A fader that reaches more than its note claims is the harder defect of the
     * two**, because nothing the user does will reveal it; they simply never drag that one.
     */
    note.textContent = 'Each fader moves its own category, and "visual" is the catch-all: trail length, glow, '
      + 'bloom, the symmetry fold and every Visual FX field system answer to it — nearly half of all settings. '
      + 'Lock it to hold the look still while the figure, its colour and its material blend across.';
    return note;
  }

  /**
   * Push model → DOM for every row, and only in that direction.
   *
   * A FOLLOWING row shows the master's position; a LOCKED row says `held`, because its fader has no effect at
   * all while the lock's snapshot wins at each of the category's keys — a disabled slider with a stale number
   * beside it would be describing a blend that is not happening.
   */
  private syncFollowers(): void {
    if (!this.crossfader) return;
    const master = parseInt(this.crossfader.value);
    for (const lock of LOCKS) {
      const entry = this.rows.get(lock)!;
      const locked = this.state?.isLocked(lock) ?? false;
      const shown = entry.follow ? master : entry.value;
      if (entry.slider) {
        entry.slider.value = String(shown);
        entry.slider.disabled = entry.follow || locked;
      }
      if (entry.followBox) entry.followBox.disabled = locked;
      if (entry.readout) entry.readout.textContent = locked ? 'held' : `${shown}%`;
    }
  }

  /**
   * The preset a lock's snapshot is taken from: the working preset, with the LIVE overlay written over it.
   *
   * ⚠️ See `getLiveOverlay`'s own note — this is 23.D5, and the two halves come from two places on purpose.
   * The non-`overlay` blocks are only ever written by the Mixer itself (`setWorkingPreset`), so the working
   * preset is authoritative for them; `overlay` is the one block Visual FX edits behind the Mixer's back.
   */
  private captureLive(): UnifiedPreset | null {
    const base = this.state?.workingPreset;
    if (!base) return null;
    const snap = deepCopy(base);
    const live = this.getLiveOverlay?.();
    if (live) snap.overlay = deepCopy(live);
    return snap;
  }

  private createDeckSection(label: string, onSelect: (name: string) => void, defaultValue?: string): { section: HTMLElement; select: HTMLSelectElement } {
    const section = document.createElement('div');
    section.className = 'sl-section';
    // Two whole subscripts rather than one with a ternary INSIDE the brackets: `tipcheck` §H collects every
    // string literal in a subscript, so a ternary there hands it the condition's own `'A'` as if it were a
    // third table key, and a variable key defeats the coverage scan entirely. One literal per read.
    const tip = label === 'A' ? TAB_TIPS['mixer.deckA']! : TAB_TIPS['mixer.deckB']!;

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = `Deck ${label}`;
    title.title = tip;
    section.appendChild(title);

    const select = document.createElement('select');
    select.className = 'sl-dropdown';
    select.title = tip;
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = `— Select preset for Deck ${label} —`;
    select.appendChild(emptyOpt);

    for (const name of this.presetNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === defaultValue) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      if (select.value) onSelect(select.value);
    });
    section.appendChild(select);
    return { section, select };
  }

  private applyCrossfade(): void {
    if (!this.state || !this.crossfader) return;
    const { deckA, deckB } = this.state;
    if (!deckA || !deckB) return;

    const blended = interpolatePreset(
      deckA, deckB, this.readWeights(), this.state.categoryLocks, this.state.lockedValues);
    this.state.setWorkingPreset(blended, 'crossfade');
  }

  /**
   * Assemble the `MixWeights` for one blend.
   *
   * ⚠️ **A FOLLOWING CATEGORY IS OMITTED RATHER THAN SET TO `master`, AND THE TWO ARE IDENTICAL BY
   * CONSTRUCTION**, not by coincidence: `weightsFor()` resolves `mix[group] ?? mix.master`, so an absent
   * member IS the master. Omitting is the better of the two because it keeps the all-following case — every
   * category on load — a `MixWeights` whose only member is `master`, which is the one shape the endpoint
   * oracle and `fieldcheck`'s bare-number call sites both exercise.
   *
   * ⚠️ **AND IT IS ALWAYS AN OBJECT, NEVER A BARE NUMBER.** The union exists so that a `number` reaching
   * arithmetic is a type error (`overlay-rules.ts`); handing this tab's only call site a number would make the
   * UI the one place that never proves the widened path works.
   */
  private readWeights(): MixWeights {
    const weights: MixWeights = { master: parseInt(this.crossfader!.value) / 100 };
    for (const lock of LOCKS) {
      const entry = this.rows.get(lock)!;
      if (!entry.follow) weights[lock] = entry.value / 100;
    }
    return weights;
  }

  activate(): void {
    if (!this.state || !this.deckASelect) return;
    const activeName = this.state.workingPreset?.metadata.name ?? '';
    if (!activeName) return;
    this.deckASelect.value = activeName;
    // Always sync deckA to the current working preset on tab entry,
    // even if the dropdown value didn't change (preset content may differ).
    const libPreset = this.getPreset(activeName);
    this.state.deckA = deepCopy(libPreset ?? this.state.workingPreset!);
  }

  reset(entryPreset: UnifiedPreset): void {
    if (!this.state || !this.crossfader || !this.deckASelect) return;
    // Restore crossfader to 0 (full Deck A) and point Deck A at entry preset.
    this.crossfader.value = '0';
    this.state.categoryLocks.clear();
    this.state.lockedValues.clear();
    // Every category back to following at 0 — the load state. The row MODEL is reset before `render()`,
    // because `render()` builds each row FROM it; clearing only the DOM would leave an unticked box ticked
    // again while `readWeights()` went on reading the old independent value.
    for (const lock of LOCKS) {
      const entry = this.rows.get(lock)!;
      entry.follow = true;
      entry.value = 0;
    }
    // Re-render so lock chips reflect cleared state
    this.render();
    // Re-acquire the deckA select after render
    const activeName = entryPreset.metadata.name;
    if (this.deckASelect) {
      this.deckASelect.value = activeName;
    }
    const preset = this.getPreset(activeName);
    if (preset) this.state.deckA = deepCopy(preset);
  }

  deactivate(): void {}
  dispose(): void { this.container = null; this.state = null; }

  private addSendToEvoButton(parent: HTMLElement): void {
    if (!this.sendToEvolution) return;
    const btn = document.createElement('button');
    btn.className = 'sl-btn';
    btn.textContent = 'Send to Evolution';
    btn.title = TAB_TIPS['mixer.sendToEvo']!;
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => this.sendToEvolution!());
    parent.appendChild(btn);
  }
}
