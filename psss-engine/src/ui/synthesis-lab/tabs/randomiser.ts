import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId, CategoryLock } from '../../../exploration/state.ts';
import type { PresetStatistics } from '../../../exploration/preset-stats.ts';
import type { UnifiedPreset } from '../../../presets/types.ts';
import { randomizePreset, type Intensity } from '../../../exploration/randomize.ts';
import { CATEGORY_LABELS, CATEGORY_LOCKS } from '../../../exploration/overlay-rules.ts';
import { deepCopy } from '../../../exploration/state.ts';
import { TAB_TIPS, LOCK_CATEGORY_TIPS } from '../tooltips.ts';

/**
 * v8 `24.2` — the chips are built from the **shared** array, as the Mixer's have been since 23.5.
 *
 * ⚠️ **THIS WAS A HAND-WRITTEN LIST OF SIX UNTIL 2026-10-05, AND IT IS THE REASON `24.2` IS A STEP.** The
 * seventh lock (`'material'`, 24.D3) is a member of `CategoryLock` and gets a rule in `OVERLAY_RULES` that
 * `tsc` enforces — but **nothing in the compiler relates either to a chip row.** With the literal still here
 * the Mixer would have grown its seventh fader (it reads the array) while this tab kept six chips, so
 * `randomizePreset` would have been free to re-roll the material on a preset whose user had locked every
 * category the UI offered. A lock the engine honours and the UI does not show is worse than no lock.
 */
const LOCKS: readonly CategoryLock[] = CATEGORY_LOCKS;

export class RandomiserTab implements TabModule {
  readonly id: TabId = 'randomiser';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private stats: PresetStatistics;
  private sendToEvolution: (() => void) | null;

  // Local navigation history: index 0 = preset on tab entry, last = most recent randomise
  private history: UnifiedPreset[] = [];
  private historyIndex = -1;
  /**
   * The exact preset object this tab last handed to the state.
   *
   * Used by `activate()` to distinguish its own work from an external preset change. A `metadata.name`
   * comparison cannot: `evolution-ops.ts` reuses `Evo Gen 1..9` every generation (SL1).
   */
  private lastEmitted: UnifiedPreset | null = null;
  private restartBtn: HTMLButtonElement | null = null;
  private backBtn: HTMLButtonElement | null = null;
  private forwardBtn: HTMLButtonElement | null = null;

  constructor(stats: PresetStatistics, sendToEvolution?: () => void) {
    this.stats = stats;
    this.sendToEvolution = sendToEvolution ?? null;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.render();
  }

  activate(): void {
    if (!this.state?.workingPreset) return;
    const current = this.state.workingPreset;
    // Reset the local history if it is empty, or if the working preset changed outside this tab while we
    // were away.
    //
    // "Outside this tab" was detected by comparing `metadata.name` against the tracked entry, which is
    // not sound: `evolution-ops.ts` names every child `Evo Gen ${i + 1}`, so those names repeat every
    // generation. Applying `Evo Gen 1` from two successive generations read as no change at all, leaving
    // the Back/Forward stack rooted at the PREVIOUS generation's preset (SL1).
    //
    // `lastEmitted` is the exact object this tab last handed to the state, so anything else is external
    // by construction — names cannot collide their way past it.
    if (this.historyIndex < 0 || current !== this.lastEmitted) {
      this.history = [deepCopy(current)];
      this.historyIndex = 0;
      this.lastEmitted = current;
    }
    this.updateNavButtons();
  }

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.restartBtn = null;
    this.backBtn = null;
    this.forwardBtn = null;

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    desc.textContent = 'Mutate the current preset at three intensities, stepping through the results with '
      + 'Back / Forward. Hover any control for what it does.';
    el.appendChild(desc);

    // Intensity buttons
    const intensitySection = document.createElement('div');
    intensitySection.className = 'sl-section';
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Intensity';
    title.title = 'How far each mutation strays from the current preset. Every press mutates what is on '
      + 'screen now, so repeated Subtle presses drift as far as one Wild press.';
    intensitySection.appendChild(title);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'sl-btn-group';
    const intensities: { label: string; value: Intensity; tip: string }[] = [
      { label: 'Subtle', value: 'subtle', tip: TAB_TIPS['rnd.subtle']! },
      { label: 'Medium', value: 'medium', tip: TAB_TIPS['rnd.medium']! },
      { label: 'Wild', value: 'wild', tip: TAB_TIPS['rnd.wild']! },
    ];

    for (const { label, value, tip } of intensities) {
      const btn = document.createElement('button');
      btn.className = 'sl-btn-primary';
      btn.textContent = label;
      btn.title = tip;
      btn.style.flex = '1';
      btn.addEventListener('click', () => this.applyRandomise(value));
      btnGroup.appendChild(btn);
    }
    intensitySection.appendChild(btnGroup);
    el.appendChild(intensitySection);

    // Category locks
    const lockSection = document.createElement('div');
    lockSection.className = 'sl-section';
    const lockTitle = document.createElement('div');
    lockTitle.className = 'sl-section-title';
    lockTitle.textContent = 'Category Locks';
    lockTitle.title = 'Click a category to EXCLUDE it from mutation, so randomising leaves that aspect of '
      + 'the preset exactly as it is. Lock everything but one to explore a single axis.';
    lockSection.appendChild(lockTitle);

    const lockRow = document.createElement('div');
    lockRow.className = 'sl-lock-row';
    for (const lock of LOCKS) {
      const chip = document.createElement('span');
      chip.className = `sl-lock-chip${this.state!.isLocked(lock) ? ' locked' : ''}`;
      chip.textContent = CATEGORY_LABELS[lock];   // the one label owner -- see overlay-rules.ts
      // Scope from the shared table, verb from this tab — the Mixer freezes a blended value instead.
      chip.title = `Leave ${LOCK_CATEGORY_TIPS[lock]} untouched when randomising.`;
      chip.addEventListener('click', () => {
        this.state!.toggleLock(lock);
        chip.classList.toggle('locked', this.state!.isLocked(lock));
      });
      lockRow.appendChild(chip);
    }
    lockSection.appendChild(lockRow);

    /*
     * v8 `24.6` — the masking caveat, VISIBLE rather than hovered.
     *
     * ⚠️ **It is a `textContent` and not a `title` because the thing it warns about looks like a BUG.** On
     * the 114 library presets that author a palette, a `color` mutation moves the four colour curves and the
     * frame does not change — precedence is palette > material ramp > preset colour. A user who presses
     * Medium twice on such a preset and sees nothing has no reason to hover anything; they conclude the tab
     * is broken. The sentence has to be on screen before the press, not behind it.
     *
     * ⚠️ **The text comes from `TAB_TIPS`, not from a literal here** (`tipcheck` §A/§B assert both
     * directions over the lock and tab tables), and it is deliberately NOT appended to
     * `LOCK_CATEGORY_TIPS['color']`: that table's values are composed into a sentence by this tab AND by the
     * Mixer, so §H holds them to a noun phrase — the first draft put the caveat there and the checker caught
     * it at 188 chars, which was a real defect in two tabs' copy.
     *
     * ⚠️ Assigned UNCONDITIONALLY and once, per the `INLINE_SINK` rule: copy toggled by a ternary is
     * invisible to §I's ceiling. There is nothing to toggle here — the caveat is true of the tab, not of a
     * state — so the element is simply always present.
     */
    const maskNote = document.createElement('p');
    maskNote.className = 'sl-mix-note';
    maskNote.textContent = TAB_TIPS['rnd.masking']!;
    lockSection.appendChild(maskNote);

    el.appendChild(lockSection);

    // Back / Forward navigation
    const navSection = document.createElement('div');
    navSection.className = 'sl-section';
    const navTitle = document.createElement('div');
    navTitle.className = 'sl-section-title';
    navTitle.textContent = 'History';
    navTitle.title = 'The chain of mutations made in this tab since you entered it. Separate from the '
      + 'Snapshot history, and discarded when you leave.';
    navSection.appendChild(navTitle);

    const navGroup = document.createElement('div');
    navGroup.className = 'sl-btn-group';

    this.restartBtn = document.createElement('button');
    this.restartBtn.className = 'sl-btn';
    this.restartBtn.textContent = 'Restart';
    this.restartBtn.title = TAB_TIPS['rnd.restart']!;
    this.restartBtn.style.flex = '1';
    this.restartBtn.addEventListener('click', () => this.navigateRestart());
    navGroup.appendChild(this.restartBtn);

    this.backBtn = document.createElement('button');
    this.backBtn.className = 'sl-btn';
    this.backBtn.textContent = '← Back';
    this.backBtn.title = TAB_TIPS['rnd.back']!;
    this.backBtn.style.flex = '1';
    this.backBtn.addEventListener('click', () => this.navigateBack());
    navGroup.appendChild(this.backBtn);

    this.forwardBtn = document.createElement('button');
    this.forwardBtn.className = 'sl-btn';
    this.forwardBtn.textContent = 'Forward →';
    this.forwardBtn.title = TAB_TIPS['rnd.forward']!;
    this.forwardBtn.style.flex = '1';
    this.forwardBtn.addEventListener('click', () => this.navigateForward());
    navGroup.appendChild(this.forwardBtn);

    navSection.appendChild(navGroup);
    el.appendChild(navSection);

    if (this.sendToEvolution) {
      const evoBtn = document.createElement('button');
      evoBtn.className = 'sl-btn';
      evoBtn.textContent = 'Send to Evolution';
      evoBtn.title = TAB_TIPS['rnd.sendToEvo']!;
      evoBtn.style.marginTop = '12px';
      evoBtn.addEventListener('click', () => this.sendToEvolution!());
      el.appendChild(evoBtn);
    }

    this.updateNavButtons();
  }

  private applyRandomise(intensity: Intensity): void {
    if (!this.state?.workingPreset) return;

    const result = randomizePreset(
      this.state.workingPreset,
      intensity,
      this.state.categoryLocks,
      this.stats,
    );

    // Truncate any forward history, then push the new result
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(deepCopy(result));
    this.historyIndex = this.history.length - 1;

    this.lastEmitted = result;
    this.state.setWorkingPreset(result, `randomise-${intensity}`);
    this.updateNavButtons();
  }

  private navigateRestart(): void {
    if (!this.state || this.history.length === 0) return;
    this.historyIndex = 0;
    // `deepCopy` produces a NEW object, so it must be captured before emitting rather than reusing the
    // history entry — otherwise `activate()` would later see it as external and reset the stack.
    const restart = deepCopy(this.history[0]!);
    this.lastEmitted = restart;
    this.state.setWorkingPreset(restart, 'randomise-restart');
    this.updateNavButtons();
  }

  private navigateBack(): void {
    if (!this.state || this.historyIndex <= 0) return;
    this.historyIndex--;
    const back = deepCopy(this.history[this.historyIndex]!);
    this.lastEmitted = back;
    this.state.setWorkingPreset(back, 'randomise-back');
    this.updateNavButtons();
  }

  private navigateForward(): void {
    if (!this.state || this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const forward = deepCopy(this.history[this.historyIndex]!);
    this.lastEmitted = forward;
    this.state.setWorkingPreset(forward, 'randomise-forward');
    this.updateNavButtons();
  }

  private updateNavButtons(): void {
    if (this.restartBtn) {
      this.restartBtn.disabled = this.historyIndex <= 0;
    }
    if (this.backBtn) {
      this.backBtn.disabled = this.historyIndex <= 0;
    }
    if (this.forwardBtn) {
      this.forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  reset(entryPreset: UnifiedPreset): void {
    // Adopt whatever the state actually holds, NOT `entryPreset`.
    //
    // `panel.resetCurrentTab` deep-copies three times — one copy is emitted via `setWorkingPreset`, a
    // second goes to `resetOverlays`, and a third arrives here — so this argument is a different object
    // from the one the state now holds. Recording this one would leave `activate()` seeing a mismatch and
    // discarding the history it is being handed right now.
    this.lastEmitted = this.state?.workingPreset ?? entryPreset;
    this.history = [deepCopy(entryPreset)];
    this.historyIndex = 0;
    this.updateNavButtons();
  }

  deactivate(): void {}
  dispose(): void { this.container = null; this.state = null; }
}
