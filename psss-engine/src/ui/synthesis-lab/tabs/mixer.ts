import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId, CategoryLock } from '../../../exploration/state.ts';
import type { OverlayState, UnifiedPreset } from '../../../presets/types.ts';
import type { MixWeights } from '../../../exploration/overlay-rules.ts';
import { interpolatePreset } from '../../../exploration/interpolate.ts';
import {
  CATEGORY_LABELS, CATEGORY_LOCKS, FIGURE_CATEGORIES,
} from '../../../exploration/overlay-rules.ts';
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
  /**
   * The row's three source buttons.
   *
   * ⚠ A RECORD over the three states rather than three fields, so `syncFollowers` can mark the active
   * one in a loop and a fourth state would be a compile error at the record rather than a forgotten
   * `if` in the sync.
   */
  srcBtns: Record<'A' | 'follow' | 'B', HTMLElement | null>;
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
  private deckBSelect: HTMLSelectElement | null = null;
  /**
   * The PANEL's reset for this tab, handed in rather than re-implemented.
   *
   * ⚠️⚠️ **THE MIXER'S `Reset` BUTTON IS THE HEADER'S `Reset`, NOT A SECOND ONE.** The panel already
   * owns "the state as this tab was entered": it captures `tabEntryPresets` on every switch, restores the
   * working preset from it, re-applies its overlays through `resetOverlays`, and then calls this tab's
   * own `reset()`, which puts every row back to *follow at 0*. A tab-local reset would have to repeat
   * all three, and the one it forgot -- most likely the overlay re-apply -- would leave the preview
   * showing a look the rows no longer describe. **One owner, two buttons.**
   */
  private resetToEntry: (() => void) | null = null;
  /** The sentence under the recipes; see `updateSourceLine`. */
  private sourceLine: HTMLParagraphElement | null = null;
  private getLiveOverlay: (() => OverlayState) | null;
  private rows: Map<CategoryLock, CategoryRow> = new Map(
    LOCKS.map((l) => [l, {
      follow: true, value: 0, slider: null, followBox: null, lockBtn: null, readout: null,
      srcBtns: { A: null, follow: null, B: null },
    }]));

  constructor(
    presetNames: string[],
    getPreset: (name: string) => UnifiedPreset | undefined,
    sendToEvolution?: () => void,
    getLiveOverlay?: () => OverlayState,
    resetToEntry?: () => void,
  ) {
    this.presetNames = presetNames;
    this.getPreset = getPreset;
    this.sendToEvolution = sendToEvolution ?? null;
    this.getLiveOverlay = getLiveOverlay ?? null;
    this.resetToEntry = resetToEntry ?? null;
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
    /*
     * ⚠️ **THE DEFAULT IS THE DECK B THE MIXER ALREADY HOLDS.** `reset()` re-renders the whole tab, and
     * this dropdown was rebuilt with NO default -- so after any reset (the header's too, before this
     * fix) it showed empty while `state.deckB` still held the old preset, and the next crossfade blended
     * against a deck the UI said was not there. A dropdown that disagrees with the state it controls is
     * the invariant-17 shape.
     */
    const { section: deckBSection, select: deckBSelect } = this.createDeckSection('B', (name) => {
      const preset = this.getPreset(name);
      if (preset && this.state) {
        this.state.deckB = deepCopy(preset);
        this.applyCrossfade();
      }
    }, this.state?.deckB?.metadata.name);
    this.deckBSelect = deckBSelect;
    el.appendChild(deckBSection);
    el.appendChild(this.buildSourceSection());

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
    /*
     * WW **THE LABEL, NOT THE KEY.** This printed the raw `lock` -- so the UI said `shape`, `color`,
     * `visual` in lowercase while every other tab calls the first of those **the figure**. The owner's
     * figure-swap request was about a row nobody could name. `CATEGORY_LABELS` is the one owner, and the
     * stored value is still the bare word.
     */
    chip.textContent = CATEGORY_LABELS[lock];
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

    /*
     * WW **THE SOURCE SELECTOR, AND IT IS THE WHOLE POINT OF THIS PASS.** The capability to take one
     * category from one deck already existed and nobody could find it: it needed unticking `follow`,
     * knowing that the row called `shape` is the figure, dragging to 100, and knowing to leave the
     * master at 0 -- five steps, each a guess. **The question a user has is "where does this come
     * from", not "what blend position is this at"**, so the endpoints get one click each and the fader
     * stays for when a real blend is wanted.
     */
    const src = document.createElement('div');
    src.className = 'sl-mix-src';
    src.title = TAB_TIPS['mixer.rowSource']!;
    for (const [key, text, aria] of [
      ['A', 'A', `${CATEGORY_LABELS[lock]} from Deck A`],
      ['follow', '\u21c4', `${CATEGORY_LABELS[lock]} follows the master crossfader`],
      ['B', 'B', `${CATEGORY_LABELS[lock]} from Deck B`],
    ] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sl-mix-src-btn sl-mix-src-${key}`;
      b.textContent = text;
      b.title = TAB_TIPS['mixer.rowSource']!;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => this.setRowSource(lock, key));
      src.appendChild(b);
      entry.srcBtns[key] = b;
    }
    row.appendChild(src);

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
    /*
     * ⚠️ **THE CATCH-ALL IS NAMED BY ITS LABEL, NOT ITS KEY.** This read `"visual"` in quotes, which was
     * the row's own text until `CATEGORY_LABELS` arrived — so the sentence pointed at a word that is no
     * longer on screen. **Copy that names a control must use the word the control shows**, and the two
     * drifting apart is invisible to every checker here: `mixercheck` deliberately does not scan this
     * prose, because a quoted-word scan cannot tell copy from code.
     */
    note.textContent = 'Each fader moves its own category, and Visual FX is the catch-all: trail length, '
      + 'glow, bloom, the symmetry fold and every Visual FX field system answer to it — nearly half of all '
      + 'settings. Lock it to hold the look still while the figure, its colour and its material blend across.';
    return note;
  }

  /**
   * Push model → DOM for every row, and only in that direction.
   *
   * A FOLLOWING row shows the master's position; a LOCKED row says `held`, because its fader has no effect at
   * all while the lock's snapshot wins at each of the category's keys — a disabled slider with a stale number
   * beside it would be describing a blend that is not happening.
   */
  /*
   * ⚠️ **THE SENTENCE IS UPDATED FROM `syncFollowers()` AND NOWHERE ELSE.** Every path that can change
   * a row -- the fader, the follow box, the source buttons, a recipe, a lock -- already calls this, so
   * one call site cannot go stale. Updating it from each of those instead would be six writers of one
   * fact, and the one that got forgotten would leave a sentence describing a state that is gone.
   */
  private syncFollowers(): void {
    this.updateSourceLine();
    if (!this.crossfader) return;
    /*
     * ⚠️⚠️ **A CROSSFADER THAT CAN MOVE NOTHING IS DISABLED, AND THE STATUS LINE SAYS WHY.** With every
     * row held at A or B it used to stay draggable and do nothing — the project's *dead control* defect,
     * the one `26.D4` answers with *disabled and says why*. The reason lives in the status line rather
     * than a tooltip because the user needs it BEFORE trying the slider, not after.
     */
    const anyFollow = LOCKS.some((l) => this.rows.get(l)!.follow);
    this.crossfader.disabled = !anyFollow;
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
      /*
       * ⚠️ **THE ACTIVE SOURCE IS DERIVED, NEVER STORED.** A fourth field saying "which button is on"
       * would be a second copy of what `follow` and `value` already say, and the two would disagree the
       * first time a fader was dragged to 50 — which is exactly the state that must light NEITHER deck.
       * ⚠️ `>= 100` / `<= 0` rather than `===`, because the row is an integer slider the user can also
       * drag: 99 is a blend and must not read as "from B".
       */
      const active = entry.follow ? 'follow' : entry.value >= 100 ? 'B' : entry.value <= 0 ? 'A' : null;
      for (const key of ['A', 'follow', 'B'] as const) {
        const btn = entry.srcBtns[key];
        if (btn === null) continue;
        btn.classList.toggle('active', key === active);
        btn.toggleAttribute('disabled', locked);
      }
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

  /**
   * The one-click source recipes and the sentence that says where things stand.
   *
   * ⚠️⚠️ **A RECIPE IS A PRESET OF THE FADER STATE AND NOTHING ELSE -- NO NEW ENGINE PATH.** Measured
   * before building: with `shape` at 100 and the rest at 0, `interpolatePreset` already returns deck
   * B's waves, figure type, curve block and particle count while every meaningful overlay key
   * (`customFilmLookParams`, `material`, `palette`, `paletteMapping`, `renderMode`, `splatShear`),
   * the transmap, the renderer and the colour curves come from deck A. **The capability existed; only
   * the UX was missing**, which is why this adds buttons rather than arithmetic.
   */
  private buildSourceSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Take one part from the other deck';
    title.title = TAB_TIPS['mixer.sourceFigure']!;
    sec.appendChild(title);

    const row = document.createElement('div');
    row.className = 'sl-mix-recipes';
    for (const [tip, text, figureFrom] of [
      [TAB_TIPS['mixer.sourceFigure']!, 'Figure from B, look from A', 'B'],
      [TAB_TIPS['mixer.sourceLook']!, 'Look from B, figure from A', 'A'],
    ] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sl-btn sl-mix-recipe';
      b.textContent = text;
      b.title = tip;
      b.setAttribute('aria-label', text);
      b.addEventListener('click', () => this.applyRecipe(figureFrom));
      row.appendChild(b);
    }
    /*
     * ⚠️ **`Reset` sits WITH the recipes because it is their undo** (owner, 2026-11-04): a recipe pins
     * seven rows, and getting back to the entry state by hand means un-pinning seven rows, re-centring
     * the master and remembering which preset you came in with. Absent when no reset is wired -- a
     * button that did nothing would be worse than none.
     */
    /*
     * ⚠️ **`All ⇄` is the owner's first idea made EXPLICIT**: every row back to following the crossfader,
     * the crossfader left where it is, the preview and Deck B untouched. A deliberate click instead of a
     * side effect of the first drag, so nothing is ever discarded by touching a slider.
     */
    const allFollow = document.createElement('button');
    allFollow.type = 'button';
    allFollow.className = 'sl-btn sl-mix-recipe sl-mix-all';
    allFollow.textContent = 'All \u21c4';
    allFollow.title = TAB_TIPS['mixer.allFollow']!;
    allFollow.setAttribute('aria-label', 'Hand every row back to the crossfader');
    allFollow.addEventListener('click', () => {
      for (const lock of LOCKS) {
        const entry = this.rows.get(lock)!;
        entry.follow = true;
        if (entry.followBox) entry.followBox.checked = true;
      }
      this.syncFollowers();
      this.applyCrossfade();
    });
    row.appendChild(allFollow);

    if (this.resetToEntry !== null) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'sl-btn sl-mix-recipe sl-mix-reset';
      reset.textContent = 'Reset';
      reset.title = TAB_TIPS['mixer.reset']!;
      reset.setAttribute('aria-label', 'Reset the Mixer to how it was on entry');
      reset.addEventListener('click', () => this.resetToEntry?.());
      row.appendChild(reset);
    }
    sec.appendChild(row);

    this.sourceLine = document.createElement('p');
    this.sourceLine.className = 'sl-mix-source-line';
    this.sourceLine.title = TAB_TIPS['mixer.sourceLine']!;
    sec.appendChild(this.sourceLine);
    return sec;
  }

  /**
   * Pin every category to one deck or the other.
   *
   * ⚠️⚠️ **IT PINS ALL SEVEN ROWS, NOT JUST THE THREE IT MOVES (owner decision).** The alternative was to
   * leave the look rows following the master, so a later drag would fade deck B's look in on top -- a
   * useful second move, but it means the state stops matching the button that produced it. **A named
   * action whose result silently drifts is worse than no named action**, so the master goes inert and
   * the sentence below says so.
   *
   * ⚠️⚠️ **DECK A IS REFRESHED FROM THE LIVE PRESET FIRST, AND THAT IS NOT A CONVENIENCE.** Deck A is
   * pre-selected when the tab is BUILT; if the preset changed since, it is stale -- the same latent
   * shape as the Composer body defect, where a tab built at one moment answered about another. The
   * gesture this feature exists for is *"I like what I am looking at, now give me that one's figure"*,
   * and that is a lie if Deck A is whatever was loaded when the tab first opened.
   */
  private applyRecipe(figureFrom: 'A' | 'B'): void {
    if (!this.state) return;
    this.refreshDeckAFromLive();
    /*
     * ⚠️⚠️ **THE SWAPPED PART IS HANDED TO THE CROSSFADER, NOT PINNED TO B — owner decision 2026-11-05.**
     * The rule the whole tab now follows: **the crossfader moves every row set to follow; rows set to A or B
     * are held.** The first version pinned all seven rows, so after a recipe the crossfader moved nothing —
     * the control the tab is named after was dead in the state the tab's own buttons produce. Now the KEPT
     * part is held at A and the TAKEN part follows a crossfader moved to B: the picture at that moment is
     * identical to the pinned version, and the crossfader stays meaningful afterwards as *"how much of the
     * other deck's figure"* (or look).
     *
     * ⚠️ **The owner's own first idea was a reset on the first crossfader move.** Rejected with the owner
     * because one touch would discard a hand-built mix with no undo, *"first move"* is a mode nobody can
     * see, and it would make the crossfader and the rows exclusive. `All ⇄` is that reset made explicit.
     */
    for (const lock of LOCKS) {
      const entry = this.rows.get(lock)!;
      const taken = FIGURE_CATEGORIES.includes(lock) === (figureFrom === 'B');
      entry.follow = taken;
      entry.value = 0;   // only read while a row does NOT follow, and a held row is held at A
      if (entry.followBox) entry.followBox.checked = taken;
    }
    if (this.crossfader) this.crossfader.value = '100';
    this.syncFollowers();
    this.applyCrossfade();
    /*
     * ⚠️ **The Deck B picker is focused only when it is EMPTY.** Stealing focus on every click would
     * fight a user who is pressing the two recipes alternately to compare them, which is the obvious
     * way to use a pair of buttons.
     */
    if (!this.state.deckB && this.deckBSelect) this.deckBSelect.focus();
  }

  /** Put the live working preset on Deck A, and move the picker with it. */
  private refreshDeckAFromLive(): void {
    const live = this.state?.workingPreset;
    if (!live || !this.state) return;
    this.state.deckA = deepCopy(live);
    const name = live.metadata.name;
    if (this.deckASelect && name) {
      const has = Array.from(this.deckASelect.options).some((o) => o.value === name);
      if (has) this.deckASelect.value = name;
    }
  }

  /**
   * One row's source: a deck pins it, the double arrow hands it back to the master.
   *
   * ⚠️ **Picking a deck sets BOTH `follow` and the value**, because either alone is a half-state: an
   * unticked row at the master's position looks pinned and is not, and a value with `follow` still on
   * is ignored by `readWeights()` entirely.
   */
  private setRowSource(lock: CategoryLock, source: 'A' | 'follow' | 'B'): void {
    const entry = this.rows.get(lock);
    if (!entry) return;
    if (source === 'follow') {
      entry.follow = true;
    } else {
      entry.follow = false;
      entry.value = source === 'B' ? 100 : 0;
    }
    if (entry.followBox) entry.followBox.checked = entry.follow;
    this.syncFollowers();
    this.applyCrossfade();
  }

  /**
   * The sentence under the recipes.
   *
   * ⚠️⚠️ **IT NAMES THE CATEGORIES RATHER THAN COUNTING THEM**, for the reason a badge that counts is
   * wrong here: "3 from B" does not tell you WHICH three, and the whole question this tab answers is
   * which part came from where. W It also says when the master is inert, because a fader that does
   * nothing and does not say so is the defect this project calls a dead control.
   */
  private updateSourceLine(): void {
    const el = this.sourceLine;
    if (el === null) return;
    const fromB: string[] = [];
    const fromA: string[] = [];
    const following: string[] = [];
    /*
     * ⚠️ **A row blended on its OWN fader is its own bucket.** It used to be listed under *"Following the
     * crossfader"* with its percentage — false, because a row whose follow box is unticked ignores the
     * crossfader entirely.
     */
    const ownBlend: string[] = [];
    for (const lock of LOCKS) {
      const e = this.rows.get(lock)!;
      if (e.follow) following.push(CATEGORY_LABELS[lock]);
      else if (e.value >= 100) fromB.push(CATEGORY_LABELS[lock]);
      else if (e.value <= 0) fromA.push(CATEGORY_LABELS[lock]);
      else ownBlend.push(`${CATEGORY_LABELS[lock]} (${e.value}% towards B)`);
    }
    /*
     * ⚠️ **THE ENTRY STATE GETS ITS OWN SENTENCE.** On entry every row FOLLOWS a master at A, so the
     * generic form read *"Following the crossfader: Figure, Colour, Motion, Transmap, Attractor,
     * Materials, Visual FX."* -- true, and no help to someone checking that `Reset` worked. **The
     * question after a reset is "is everything from A again", so the line answers it in those words.**
     */
    const master = this.crossfader ? parseInt(this.crossfader.value) : 0;
    if (following.length === LOCKS.length && fromA.length === 0 && fromB.length === 0) {
      el.textContent = master <= 0
        ? 'Everything comes from Deck A — the crossfader is at A, and every row follows it.'
        : master >= 100
          ? 'Everything comes from Deck B — the crossfader is at B, and every row follows it.'
          : `Every row follows the crossfader, at ${master}% of the way from Deck A to Deck B.`;
      return;
    }
    const where = master <= 0 ? 'now at A' : master >= 100 ? 'now at B' : `now ${master}% towards B`;
    const parts: string[] = [];
    if (following.length > 0) parts.push(`Following the crossfader, ${where}: ${following.join(', ')}.`);
    if (fromA.length > 0) parts.push(`Held at Deck A: ${fromA.join(', ')}.`);
    if (fromB.length > 0) parts.push(`Held at Deck B: ${fromB.join(', ')}.`);
    if (ownBlend.length > 0) parts.push(`Blended on their own: ${ownBlend.join(', ')}.`);
    if (following.length === 0) {
      parts.push('No row follows the crossfader, so it is switched off — click ⇄ on a row, or All ⇄, to '
        + 'hand it back.');
    }
    el.textContent = parts.join(' ');
  }
}
