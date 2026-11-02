import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type { PresetStatistics } from '../../../exploration/preset-stats.ts';
import type { OverlayState, UnifiedPreset } from '../../../presets/types.ts';
import {
  SEMANTIC_SLIDERS,
  SLIDER_OWNED_OVERLAY_KEYS,
  beginGradingPass,
  rowLiveness,
  sliderMul,
  type SliderDef,
} from '../../../exploration/slider-mappings.ts';
import { deepCopy } from '../../../exploration/state.ts';
import { TAB_TIPS } from '../tooltips.ts';

/**
 * ⚠️ **`SLIDER_OWNED_OVERLAY_KEYS` MOVED TO `slider-mappings.ts` ON 2026-10-06 (v8 `26.D13`), AND THE
 * REASON IS THAT IT COULD NOT BE CHECKED HERE.** `26.D13`(e) asserts the list covers exactly the `overlay`
 * keys the rows write, **in both directions**, and `slidercheck` imports its subjects under Node — which
 * this file cannot be, because it reaches the DOM. It lives beside the rows that write those keys now,
 * which is also where a new row's author will be looking. **It is MOVED, not copied (`26.D11`): two copies
 * of the revert list is the leak this list exists to prevent, written twice.**
 */

type OverlayBag = Record<string, unknown>;

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export class SlidersTab implements TabModule {
  readonly id: TabId = 'sliders';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private stats: PresetStatistics;
  private sliderValues: Map<string, number> = new Map();
  private baseline: UnifiedPreset | null = null;
  /**
   * The exact preset object this tab last emitted, used to tell its own echo from an external change.
   *
   * This was a `baselineName` string compared against `metadata.name`, which is not unique:
   * `evolution-ops.ts` names every child `Evo Gen ${i + 1}`, repeating those names every generation. So
   * applying `Evo Gen 1` from two consecutive generations looked like the SAME preset, the baseline was
   * not re-captured, and every slider then multiplied against the previous generation's values (SL1).
   *
   * Identity is exact: `applyAllSliders` builds a fresh object and emits it, so `incoming === lastEmitted`
   * means "our own echo" and anything else is genuinely external — regardless of what it is called. It
   * also fixes the mirror case a name check gets wrong in the other direction: two DIFFERENT presets that
   * happen to share a name now correctly re-baseline.
   */
  private lastEmitted: UnifiedPreset | null = null;
  /** Values this tab last emitted for {@link SLIDER_OWNED_OVERLAY_KEYS}; null before the first apply. */
  private lastWroteOverlay: OverlayBag | null = null;
  /** Live values of those keys as they stood before the sliders touched them — the revert target. */
  private fxBaseline: OverlayBag | null = null;
  /** Per-row DOM handles, so `syncLiveness()` can disable a row without rebuilding the panel. */
  /** v8 26.8 — the host's `setStripToFigure`; absent when the panel has no Visual FX controls. */
  private strip: ((on: boolean) => void) | null = null;
  private stripOn = false;
  private rowEls: Map<string, {
    wrap: HTMLElement; slider: HTMLInputElement; reset: HTMLButtonElement; reason: HTMLElement;
  }> = new Map();

  constructor(stats: PresetStatistics) {
    this.stats = stats;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    for (const def of SEMANTIC_SLIDERS) {
      this.sliderValues.set(def.id, 0.5);
    }
    // Keep baseline in sync with external preset changes (grid clicks, arrow keys, mixer, etc.)
    // Ignore changes sourced from our own slider — those come back through 'preset-changed'
    // too but we must not re-baseline on them, or we'd bake slider mutations into the baseline.
    state.on('preset-changed', (incoming) => {
      const p = incoming as UnifiedPreset;
      if (p !== this.lastEmitted) {
        this.baseline = deepCopy(p);
        this.lastEmitted = p;
        // Revert targets were captured against the previous preset — meaningless now.
        this.lastWroteOverlay = null;
        this.fxBaseline = null;
        // Reset sliders to center so they read as "no change from new baseline"
        for (const def of SEMANTIC_SLIDERS) {
          this.sliderValues.set(def.id, 0.5);
        }
        this.render();
      }
    });
    this.render();
  }

  /**
   * v8 `26.D2` — the fourteen rows in THREE sections, and the boundary carries a real rule rather than a
   * cosmetic one: **every `Figure` row writes `generators` only and no `overlay` key at all, and every
   * `Grade` row goes through the single grading pass.** A new row is placed by which of those two things it
   * does, never by what it is called.
   *
   * ⚠️ **THE ORDER HERE IS THE UI'S, NOT THE APPLY ORDER.** `SEMANTIC_SLIDERS`' array order is the apply
   * order and `26.0` measured the library against it; this grouping is a view over it. Changing the array
   * changes behaviour, changing this does not.
   */
  private static readonly SECTIONS: { title: string; tip: string; rows: string[] }[] = [
    {
      title: 'Figure',
      tip: 'The shape itself — the wave table, the particle count and how the figure sits in space. These '
        + 'rows write the preset’s own generator values and never touch the rendering overlay.',
      rows: ['complexity', 'flow', 'density', 'symmetry', 'structure', 'depth'],
    },
    {
      title: 'Grade',
      tip: 'Colour and light. These three share ONE grading pass, so they compose instead of overwriting '
        + 'each other, and each scales the preset’s own authored grade rather than a bundle default.',
      rows: ['warmth', 'glow', 'mood'],
    },
    {
      title: 'Physics',
      tip: 'How the substance behaves — playback speed, the image warp, turbulence, material heat and how '
        + 'much stuff there is. Most presets light only one or two of these; the rest say why.',
      rows: ['speed', 'warp', 'turbulence', 'heat', 'substance'],
    },
  ];

  /**
   * v8 `26.8` — hand the tab the host's strip setter. Called by the panel before `init`.
   *
   * ⚠️ **It also RESETS the flag**, because the engine-side bypass is cleared by a genuine preset switch
   * (`applyPresetChange`'s tail, owner's 2026-09-10 ruling) and a toggle still showing "on" after that
   * would be the control lying about the picture — the one thing invariant 25 is about.
   */
  setStripControl(fn: (on: boolean) => void): void {
    this.strip = fn;
    this.stripOn = false;
  }

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.rowEls.clear();

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Each slider is a relative multiplier (0.2×–5.0×) on the preset’s own values, and '
      + 'centre always means no change. Hover any slider for what it moves.';
    el.appendChild(desc);

    /*
     * ⚠️ **THE SENTENCE `26.2` MADE TRUE, AND IT IS THE OPPOSITE OF THE OLD BEHAVIOUR.** Each row scales
     * the preset's OWN value, so two presets at the same position do not converge on a common result — they
     * each move by the same ratio from where they started. Before `26.2` a grading row rebuilt from the
     * `Legacy` bundle, so two presets at the same `Mood` DID converge, on a grade neither had authored.
     */
    const law = document.createElement('p');
    law.className = 'sl-mix-note';
    law.textContent = 'Every row scales this preset’s own value, so two presets at the same position do not '
      + 'end up the same — each moves by the same ratio from wherever it started.';
    el.appendChild(law);

    // ---- header: Reset all · Bake · Strip to figure (26.D7, 26.D1) --------------------------------
    const header = document.createElement('div');
    header.className = 'sl-btn-group';

    const resetAll = document.createElement('button');
    resetAll.className = 'sl-btn';
    resetAll.textContent = 'Reset all';
    resetAll.title = TAB_TIPS['sliders.resetAll']!;
    resetAll.setAttribute('aria-label', 'Reset all');
    resetAll.addEventListener('click', () => this.resetAllRows());
    header.appendChild(resetAll);

    const bake = document.createElement('button');
    bake.className = 'sl-btn';
    bake.textContent = 'Bake';
    bake.title = TAB_TIPS['sliders.bake']!;
    bake.setAttribute('aria-label', 'Bake');
    bake.addEventListener('click', () => this.bake());
    header.appendChild(bake);

    /*
     * v8 `26.8` / `26.D1` — `Strip to figure`, the one piece of the removed Archetypes tab the owner kept.
     *
     * ⚠️ **THE LABEL OWNS ITS GATE (invariant 25): it describes a BYPASS, so it must read as a view state
     * and not as an edit** — hence "Strip to figure" rather than a verb, and hence `aria-pressed`, which
     * says the control has an on state at all.
     *
     * ⚠️ **Only offered when the host supplies the control.** The strip is applied engine-side, so a panel
     * built without `visualFxControls` has nothing to drive it, and a dead toggle is worse than none.
     */
    if (this.strip) {
      const stripBtn = document.createElement('button');
      stripBtn.className = this.stripOn ? 'sl-btn-primary' : 'sl-btn';
      stripBtn.textContent = 'Strip to figure';
      stripBtn.title = TAB_TIPS['sliders.strip']!;
      stripBtn.setAttribute('aria-label', 'Strip to figure');
      stripBtn.setAttribute('aria-pressed', this.stripOn ? 'true' : 'false');
      stripBtn.addEventListener('click', () => {
        this.stripOn = !this.stripOn;
        this.strip!(this.stripOn);
        stripBtn.className = this.stripOn ? 'sl-btn-primary' : 'sl-btn';
        stripBtn.setAttribute('aria-pressed', this.stripOn ? 'true' : 'false');
      });
      header.appendChild(stripBtn);
    }

    el.appendChild(header);

    for (const section of SlidersTab.SECTIONS) {
      const title = document.createElement('div');
      title.className = 'sl-section-title';
      title.textContent = section.title;
      title.title = section.tip;
      el.appendChild(title);

      for (const id of section.rows) {
        const def = SEMANTIC_SLIDERS.find((d) => d.id === id);
        if (!def) continue;
        el.appendChild(this.buildRow(def));
      }
    }

    this.syncLiveness();
  }

  private buildRow(def: SliderDef): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sl-slider-cell';

    const row = document.createElement('div');
    row.className = 'sl-slider-row';

    const label = document.createElement('span');
    label.className = 'sl-slider-label';
    label.textContent = def.label;
    if (def.hint) {
      // On the ROW, so the whole cell is a hover target rather than the 12 px handle track — `title` is
      // inherited by descendants for tooltip purposes, so the slider and its readout are covered too. The
      // label repeats it explicitly because it is what a pointer aims at.
      row.title = def.hint;
      label.title = def.hint;
    }
    row.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sl-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round((this.sliderValues.get(def.id) ?? 0.5) * 100));
    slider.setAttribute('aria-label', def.label);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'sl-slider-value';
    valueDisplay.textContent = sliderMul(this.sliderValues.get(def.id) ?? 0.5).toFixed(2);

    slider.addEventListener('input', () => {
      const v = parseInt(slider.value) / 100;
      this.sliderValues.set(def.id, v);
      valueDisplay.textContent = sliderMul(v).toFixed(2);
      this.applyAllSliders();
    });

    row.appendChild(slider);
    row.appendChild(valueDisplay);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'sl-btn';
    resetBtn.textContent = '↺';
    resetBtn.style.padding = '2px 6px';
    resetBtn.style.fontSize = '14px';
    resetBtn.title = TAB_TIPS['sliders.reset']!;
    resetBtn.setAttribute('aria-label', `Reset ${def.label}`);
    resetBtn.addEventListener('click', () => {
      slider.value = '50';
      this.sliderValues.set(def.id, 0.5);
      valueDisplay.textContent = '1.00';
      this.applyAllSliders();
    });
    row.appendChild(resetBtn);

    wrap.appendChild(row);

    /*
     * ⚠️ **THE REASON LINE IS INLINE COPY AND IT MUST NOT GO THROUGH `tooltips.ts`** (`26.D4`): a tooltip
     * is only ever found by someone who already suspects the control, so it can carry a DESCRIPTION but
     * never the condition under which the control does nothing.
     *
     * ⚠️ **THE TEXT IS SET ONCE PER SYNC AND THE ROW IS TOGGLED BY `display`, NEVER BY A TERNARY.**
     * `tipcheck`'s `INLINE_SINK` matches a string literal after `=`, so ternary-assigned copy is invisible
     * to it. Here the text is a measured VALUE (which palette is overriding, which block is missing), not
     * copy — so it is assigned live, exactly as the Reel's name label is, and the element's existence
     * rather than its wording is what is asserted.
     */
    const reason = document.createElement('div');
    reason.className = 'sl-slider-reason';
    reason.style.display = 'none';
    wrap.appendChild(reason);

    this.rowEls.set(def.id, { wrap, slider, reset: resetBtn, reason });
    return wrap;
  }

  /**
   * v8 `26.6` — disable every row that cannot move anything on THIS preset, and say why in the row.
   *
   * ⚠️ **NOT HIDDEN, AND NOT TOOLTIP-ONLY (`26.D4`).** This is invariant 29's rule applied to a readout: a
   * lit slot can have a silent axis — **say so in the UI, do not grant the axis a size.** Hiding the row
   * would make the panel's shape change per preset, which is worse: the user cannot tell a missing control
   * from a control they have not found.
   *
   * ⚠️ **AT LEAST TWO ROWS ARE DEAD ON EVERY PRESET IN THE LIBRARY** (measured 2026-10-06: the distribution
   * of dead rows per preset is 2 → 7, 3 → 37, 4 → 71, 5 → 83, 6 → 57, 7 → 18, 8 → 1, and **not one preset
   * has all fourteen live**). So this state is the normal case, not an edge case — judge the panel with it
   * on, never after.
   */
  private syncLiveness(): void {
    const preset = this.state?.workingPreset ?? this.baseline;
    if (!preset) return;
    for (const [id, els] of this.rowEls) {
      const { live, reason } = rowLiveness(preset, id);
      els.slider.disabled = !live;
      els.reset.disabled = !live;
      els.wrap.classList.toggle('inert', !live);
      /*
       * ⚠️ **THE LINE IS KEYED ON `reason`, THE DISABLING ON `live`, AND THEY ARE NOT THE SAME TEST.**
       * Since `26.4`, `Warmth` is live under two different laws and its line says WHICH — so a live row can
       * carry a line. Tying both to `live` would either hide that line or, worse, disable a row that works.
       */
      els.reason.textContent = reason;
      els.reason.style.display = reason === '' ? 'none' : '';
    }
  }

  /**
   * `26.D7` — all fourteen rows to centre and the preset back to the entry state.
   *
   * ⚠️ **IT GOES THROUGH THE SAME PATH AS FOURTEEN `↺` CLICKS**, deliberately, so the two cannot diverge:
   * one of them being a shortcut for the other is the whole promise of the control.
   */
  private resetAllRows(): void {
    for (const def of SEMANTIC_SLIDERS) this.sliderValues.set(def.id, 0.5);
    this.render();
    this.applyAllSliders();
  }

  /**
   * `26.D7` / `26.D12` — adopt the current result as the new baseline and re-centre every row.
   *
   * ⚠️ **THE ONLY NON-IDEMPOTENT CONTROL IN THIS TAB, WHICH IS WHY IT EXISTS AT ALL:** returning to centre
   * REVERTS, so without `Bake` there is no way to compose two rounds of shaping without going out through
   * Snapshot.
   *
   * ⚠️ **IT REWRITES BOTH BASELINES — the preset baseline AND `fxBaseline` — and it is the only thing
   * allowed to after `activate()`.** Leaving `fxBaseline` behind would make the next round revert the
   * slider-owned overlay keys to values from before the bake.
   *
   * ⚠️ **`this.lastEmitted` IS CLAIMED BEFORE `setWorkingPreset`, WHICH NOTIFIES SYNCHRONOUSLY** — the
   * external-change handler runs during that call and must recognise this preset as our own, or it
   * re-baselines on top of the bake. Echo detection is OBJECT IDENTITY, never a name compare.
   *
   * ⚠️ **It must NOT create a library preset** — no `PresetManager` path, the same boundary the Composer
   * holds.
   */
  private bake(): void {
    if (!this.state?.workingPreset) return;
    const baked = deepCopy(this.state.workingPreset);
    this.baseline = baked;
    const liveBag = (baked.overlay ?? {}) as OverlayBag;
    const captured: OverlayBag = {};
    for (const k of SLIDER_OWNED_OVERLAY_KEYS) {
      if (k in liveBag) captured[k] = deepCopy(liveBag[k]);
    }
    this.fxBaseline = captured;
    this.lastWroteOverlay = null;
    for (const def of SEMANTIC_SLIDERS) this.sliderValues.set(def.id, 0.5);

    // `pushSnapshot` is the only way to add history, and the label has to say what happened — a Bake is
    // otherwise indistinguishable from a manual edit when the user comes back to History.
    //
    // ⚠️ **The preset NAME now leads it (2026-10-11), and the reason is kept rather than replaced.** The
    // Snapshot button's labels carry the name as of that date, so a bare `Sliders baked` would have been
    // the one caption in the History grid that did not say which preset it was a snapshot of — the
    // inconsistency that change exists to remove, reintroduced by the one caller that passes a reason
    // instead of a name. **Both halves are load-bearing: the name says WHICH, the reason says WHY.**
    const bakedName = baked.metadata.name || '(unnamed)';
    this.state.pushSnapshot(`${bakedName} — Sliders baked`);
    this.lastEmitted = baked;
    this.state.setWorkingPreset(baked, 'slider-bake');
    this.render();
  }

  private applyAllSliders(): void {
    if (!this.state || !this.baseline) return;
    // Always start from the captured baseline so sliders don't compound.
    const preset = deepCopy(this.baseline);

    // Carry the LIVE overlay forward before applying the sliders.
    //
    // The baseline is captured on tab entry (or on an external preset change) and then held, so any
    // Visual FX choice made afterwards is absent from it. Re-applying it therefore reverted that choice,
    // and `renderMode` made this visible: pick Blend, nudge a slider, and `applyPresetChange` put you
    // back in the baseline's star mode — where `uGlow` is ignored, so the Glow slider looked broken.
    // Reported 2026-08-06.
    //
    // Overlay fields are LIVE FX state, not the baseline's to own; the sliders own only the preset's own
    // parameters. Four sliders legitimately write overlay fields (`Speed` → `speedFactor`, and
    // `Mood`/`Glow`/`Depth` → `filmLook`/`customFilmLookParams`/`sliderBaseFilmLook` via `grading()`), so
    // the live snapshot is taken FIRST and the slider passes below are free to overwrite those keys.
    //
    // ## Why the slider-owned keys need separate handling
    //
    // A baseline-last spread restores only the keys the baseline DECLARES. Keys it does not declare leaked
    // in from the live overlay and stuck there forever, because at centre `apply()` never runs and so never
    // writes a corrected value — returning every slider to centre did NOT restore the preset. Worst on the
    // 177 legacy presets, which have no `overlay` block at all: a `Mood` drag left them permanently on
    // `Customize` at exposure 1.76 / saturation 2.50 instead of the `Legacy` bundle's 1.0 / 1.0, and a
    // `Speed` drag left the animation running fast. Reported 2026-08-06.
    //
    // So for the owned keys the revert target is, in order: what the BASELINE declares; else the live value
    // as it stood BEFORE the sliders touched it (`fxBaseline`); else absent — and absent must stay absent,
    // hence `delete` rather than assigning undefined.
    const live = this.state.workingPreset?.overlay;
    if (live) {
      // An owned key that no longer matches what we emitted was changed from outside (the Visual FX tab),
      // so it becomes the new revert target. Without this, picking a film look after entering this tab and
      // then nudging any slider would silently throw that choice away.
      const liveBag = live as OverlayBag;
      const external = this.lastWroteOverlay === null
        || SLIDER_OWNED_OVERLAY_KEYS.some((k) => !sameValue(liveBag[k], this.lastWroteOverlay![k]));
      if (external) {
        const captured: OverlayBag = {};
        for (const k of SLIDER_OWNED_OVERLAY_KEYS) {
          if (k in liveBag) captured[k] = deepCopy(liveBag[k]);
        }
        this.fxBaseline = captured;
      }

      const merged: OverlayBag = { ...liveBag, ...((preset.overlay ?? {}) as OverlayBag) };
      const baseBag = preset.overlay as OverlayBag | undefined;
      /*
       * ⚠️ **`fxBaseline` IS CONSULTED FIRST SINCE 2026-10-16, AND THE ORDER IS THE WHOLE FIX.** It used to
       * `continue` on any owned key the baseline declared, which made the baseline win over an external
       * change — so the capture three lines above, whose entire purpose is *"an owned key that no longer
       * matches what we emitted was changed from outside and BECOMES the new revert target"*, was written
       * and then never read for exactly those keys. **The repair covered the keys the baseline does NOT
       * declare and silently missed the ones it does**, which is the half of the case that a preset
       * authoring the block puts you in.
       *
       * ⚠️ **It reached a user as a COLOUR RESET, not as a lost setting** (owner, 2026-10-16): `dye` became
       * slider-owned in `26.5`, so choosing `Dye Colour = Palette` in Visual FX and then dragging any slider
       * put the authored `colourSource` back and the dye returned to the figure's own colours. Measured on
       * `Dye Wake`, mean dye chromaticity `0.795, 0.111, 0.094` → `0.345, 0.332, 0.322`. Reported against
       * `Warmth` and reproduced with `Density`: ⚠️ **the row named in a report is rarely the row at fault
       * when every row shares one apply path.**
       *
       * ⚠️ **THE THREE TIERS ARE UNCHANGED IN MEANING — only their ORDER is** — and `fxBaseline` is still
       * "the live value as it stood BEFORE the sliders touched it", so putting it first cannot resurrect
       * slider output: on first entry `external` is true and it is captured from the live overlay, which
       * equals the baseline. **The 2026-08-06 defect this ladder exists for is a key the baseline does not
       * declare leaking in and sticking, and that case still falls to the `delete`.**
       *
       * ⚠️ **NO CHECKER CONSTRAINS THIS — `npm run verify` is green with the old order AND the new one**, so
       * the revert property was measured in a browser instead: on `Aliens DNA` (a pure legacy body with no
       * `overlay` at all, the case the ladder was built for) a `Speed` drag and return to centre gives
       * `speedFactor` 1 → 2.6265278044037674 → 1, **byte-identical readings before and after this change**.
       * Re-measure it that way if you touch this, and do not trust a green suite here.
       */
      for (const k of SLIDER_OWNED_OVERLAY_KEYS) {
        if (this.fxBaseline && k in this.fxBaseline) merged[k] = deepCopy(this.fxBaseline[k]);
        else if (baseBag && k in baseBag) continue;                  // baseline declares it: already merged
        else delete merged[k];
      }
      if (Object.keys(merged).length > 0) preset.overlay = merged as OverlayState;
      else delete preset.overlay;
    }

    /**
     * ⚠️ **ONE GRADING PASS PER APPLY, OPENED UNCONDITIONALLY (v8 `26.1`, `26.D9`).**
     *
     * It is opened here and nowhere else — **`applyAllSliders()` is the only caller that may open a pass** —
     * and it is opened **even when no grading row is off-centre**, because a conditional pass boundary is
     * one the next reader will not know exists. Opening costs nothing; `grading()` is what writes, and only
     * an off-centre row calls it.
     *
     * ⚠️ **IT IS SEEDED FROM `this.baseline`, NOT FROM `preset`.** `preset` is the working copy the rows are
     * about to mutate; the baseline is captured once per shaping round and fixed for its duration, so it is
     * the only reference that is both stable and the preset's own. **Handing `preset` here would re-create
     * the ×875 compounding defect in a new place** — a slider fires on every `input` event, so a drag is
     * dozens of applies, and a seed that drifts with the output re-multiplies on each one.
     */
    const pass = beginGradingPass(this.baseline);

    for (const def of SEMANTIC_SLIDERS) {
      const value = this.sliderValues.get(def.id) ?? 0.5;
      if (value !== 0.5) {
        def.apply(preset, value, this.stats, pass);
      }
    }

    // Record what we emitted, so the next pass can tell our own residue from an external change.
    const emitted: OverlayBag = {};
    const outBag = preset.overlay as OverlayBag | undefined;
    for (const k of SLIDER_OWNED_OVERLAY_KEYS) {
      if (outBag && k in outBag) emitted[k] = deepCopy(outBag[k]);
    }
    this.lastWroteOverlay = emitted;

    // Claim the object BEFORE emitting: `setWorkingPreset` notifies listeners synchronously, so the
    // handler above runs during this call and must recognise this preset as our own.
    this.lastEmitted = preset;
    this.state.setWorkingPreset(preset, 'slider');
    // A row can change another row's liveness — e.g. `Substance` cannot move until a liquid block exists —
    // so liveness is re-read after every apply rather than only on entry.
    this.syncLiveness();
  }

  activate(): void {
    // First-time open: listener hasn't fired yet, capture baseline manually.
    if (!this.baseline && this.state?.workingPreset) {
      this.baseline = deepCopy(this.state.workingPreset);
      this.lastEmitted = this.state.workingPreset;
      this.lastWroteOverlay = null;
      this.fxBaseline = null;
      for (const def of SEMANTIC_SLIDERS) {
        this.sliderValues.set(def.id, 0.5);
      }
      this.render();
    }
  }

  reset(entryPreset: UnifiedPreset): void {
    this.baseline = deepCopy(entryPreset);
    // The BASELINE is `entryPreset` (the values sliders multiply against), but `lastEmitted` must name the
    // object the STATE holds — `panel.resetCurrentTab` emits a different deep copy than it passes here.
    this.lastEmitted = this.state?.workingPreset ?? entryPreset;
    this.lastWroteOverlay = null;
    this.fxBaseline = null;
    for (const def of SEMANTIC_SLIDERS) {
      this.sliderValues.set(def.id, 0.5);
    }
    this.render();
  }

  deactivate(): void {}
  dispose(): void { this.container = null; this.state = null; }
}
